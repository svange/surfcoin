#!/usr/bin/env bash
# Build the SPA against the live stack's identifiers and publish it to the
# site bucket behind CloudFront, then invalidate. Run after `sam deploy`.
# Reads BucketName / DistributionId from the stack outputs.
set -euo pipefail

STACK_NAME="${STACK_NAME:-surfcoin}"
REGION="${AWS_REGION:-us-east-1}"

cd "$(dirname "$0")/.."

out() {
  aws cloudformation describe-stacks --stack-name "$STACK_NAME" --region "$REGION" \
    --query "Stacks[0].Outputs[?OutputKey=='$1'].OutputValue" --output text
}

BUCKET=$(out BucketName)
DIST_ID=$(out DistributionId)
if [[ -z "$BUCKET" || "$BUCKET" == "None" ]]; then
  echo "Could not read BucketName from stack '$STACK_NAME'." >&2
  exit 1
fi

echo "==> Syncing frontend runtime config from stack outputs"
bash scripts/sync-playground-config.sh

echo "==> Building SPA"
npm run build

# Hashed assets are content-addressed — safe to cache forever.
echo "==> Syncing hashed assets (immutable)"
aws s3 sync dist/assets/ "s3://$BUCKET/assets" --delete \
  --cache-control "public,max-age=31536000,immutable"

# Root files (og.png, favicon, robots) have stable names but can change — cache
# briefly so an updated card/favicon isn't stuck.
echo "==> Syncing root assets (short cache)"
aws s3 sync dist/ "s3://$BUCKET" --delete \
  --exclude "assets/*" --exclude "index.html" \
  --cache-control "public,max-age=3600"

# index.html: never cache so launch-day changes appear immediately.
echo "==> Uploading index.html (no-cache)"
aws s3 cp dist/index.html "s3://$BUCKET/index.html" --cache-control "no-cache"

echo "==> Invalidating CloudFront ($DIST_ID)"
aws cloudfront create-invalidation --distribution-id "$DIST_ID" --paths "/*" >/dev/null

echo "==> Published to https://$(out SiteUrl 2>/dev/null || echo surfcoin.fail)"
