#!/usr/bin/env bash
# Regenerate src/playground/runtime.ts from the deployed stack outputs. Run by
# the pipeline after `sam deploy`, before the frontend build. AWS creds must be
# for the account holding the stack.
set -euo pipefail

STACK_NAME="${STACK_NAME:-surfcoin}"
REGION="${AWS_REGION:-us-east-1}"

cd "$(dirname "$0")/.."

out() {
  aws cloudformation describe-stacks --stack-name "$STACK_NAME" --region "$REGION" \
    --query "Stacks[0].Outputs[?OutputKey=='$1'].OutputValue" --output text
}

COGNITO_DOMAIN=$(out CognitoDomain)
USER_POOL_ID=$(out UserPoolId)
CLIENT_ID=$(out UserPoolClientId)
API_ENDPOINT=$(out ApiEndpoint)

if [[ -z "$CLIENT_ID" || "$CLIENT_ID" == "None" ]]; then
  echo "Could not read outputs from stack '$STACK_NAME'. Is it deployed?" >&2
  exit 1
fi

cat > src/playground/runtime.ts <<EOF
/**
 * Deployed-stack wiring for the playground. Public identifiers, safe to ship.
 * Generated from the '${STACK_NAME}' CloudFormation stack outputs by the
 * pipeline (scripts/sync-playground-config.sh) — do not edit by hand.
 */
export const runtime = {
  cognitoDomain: '$COGNITO_DOMAIN',
  userPoolId: '$USER_POOL_ID',
  clientId: '$CLIENT_ID',
  apiBase: '$API_ENDPOINT',
} as const

export const isPlaygroundConfigured = !runtime.clientId.startsWith('REPLACE')
EOF

echo "Wrote src/playground/runtime.ts from stack '$STACK_NAME'."
