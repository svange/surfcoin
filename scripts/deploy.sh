#!/usr/bin/env bash
# Build the site and push it to the S3 bucket behind CloudFront, then invalidate.
# Prereqs: AWS credentials configured, infra/stack.yaml deployed (see README).
set -euo pipefail

STACK_NAME="${STACK_NAME:-surfcoin-site}"
REGION="${AWS_REGION:-us-east-1}"

cd "$(dirname "$0")/.."

echo "==> Building"
npm run build

echo "==> Reading stack outputs ($STACK_NAME, $REGION)"
BUCKET=$(aws cloudformation describe-stacks --stack-name "$STACK_NAME" --region "$REGION" \
  --query "Stacks[0].Outputs[?OutputKey=='BucketName'].OutputValue" --output text)
DIST_ID=$(aws cloudformation describe-stacks --stack-name "$STACK_NAME" --region "$REGION" \
  --query "Stacks[0].Outputs[?OutputKey=='DistributionId'].OutputValue" --output text)

if [[ -z "$BUCKET" || "$BUCKET" == "None" ]]; then
  echo "Could not read BucketName output from stack '$STACK_NAME'. Is the stack deployed?" >&2
  exit 1
fi
if [[ -z "$DIST_ID" || "$DIST_ID" == "None" ]]; then
  echo "Could not read DistributionId output from stack '$STACK_NAME'. Is the stack deployed?" >&2
  exit 1
fi

# Hashed files under assets/ are content-addressed — safe to cache forever.
echo "==> Syncing hashed assets (immutable) to s3://$BUCKET/assets"
aws s3 sync dist/assets/ "s3://$BUCKET/assets" --delete \
  --cache-control "public,max-age=31536000,immutable"

# Root files (og.png, favicon.svg, robots.txt, …) have stable names but can
# change between deploys — cache briefly, never immutable, or an updated OG
# image / favicon would be stuck for a year.
echo "==> Syncing root assets (short cache) to s3://$BUCKET"
aws s3 sync dist/ "s3://$BUCKET" --delete \
  --exclude "assets/*" --exclude "index.html" \
  --cache-control "public,max-age=3600"

# index.html: never cache, so a launch-day CA change appears immediately.
echo "==> Uploading index.html (no-cache)"
aws s3 cp dist/index.html "s3://$BUCKET/index.html" \
  --cache-control "no-cache"

echo "==> Invalidating CloudFront ($DIST_ID)"
aws cloudfront create-invalidation --distribution-id "$DIST_ID" --paths "/*" >/dev/null

DOMAIN=$(aws cloudformation describe-stacks --stack-name "$STACK_NAME" --region "$REGION" \
  --query "Stacks[0].Parameters[?ParameterKey=='DomainName'].ParameterValue" --output text)
echo "==> Done: https://${DOMAIN:-surfcoin.fail}"
