#!/usr/bin/env bash
# Deploy the playground backend: CFN stack (Cognito/API/DDB) if changed, then
# bundle backend/ with esbuild and push it to the Lambda. Run with
# AWS_PROFILE=sandbox for surfcoin.aillc.link.
set -euo pipefail

STACK_NAME="${PLAYGROUND_STACK_NAME:-surfcoin-playground}"
REGION="${AWS_REGION:-us-east-1}"
FUNCTION_NAME="surfcoin-playground-api"

cd "$(dirname "$0")/.."

echo "==> Deploying stack $STACK_NAME"
aws cloudformation deploy \
  --stack-name "$STACK_NAME" \
  --region "$REGION" \
  --template-file infra/playground.yaml \
  --capabilities CAPABILITY_NAMED_IAM \
  --no-fail-on-empty-changeset

echo "==> Type-checking backend"
npx tsc -p backend/tsconfig.json --noEmit

echo "==> Bundling backend"
rm -rf backend/dist && mkdir -p backend/dist
npx esbuild backend/src/index.ts \
  --bundle \
  --platform=node \
  --target=node22 \
  --format=cjs \
  --outfile=backend/dist/index.js \
  --minify

# python zipfile: no zip binary in minimal containers
(cd backend/dist && rm -f bundle.zip && python3 -m zipfile -c bundle.zip index.js)

echo "==> Updating $FUNCTION_NAME code"
aws lambda update-function-code \
  --function-name "$FUNCTION_NAME" \
  --region "$REGION" \
  --zip-file fileb://backend/dist/bundle.zip \
  --query "LastUpdateStatus" --output text

aws lambda wait function-updated --function-name "$FUNCTION_NAME" --region "$REGION"

echo "==> Syncing frontend runtime config"
bash scripts/sync-playground-config.sh

echo "==> Done"
