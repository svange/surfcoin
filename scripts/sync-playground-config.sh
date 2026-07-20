#!/usr/bin/env bash
# Regenerate src/playground/runtime.ts from the surfcoin-playground stack
# outputs. Run after any playground-stack deploy. AWS_PROFILE must point at
# the account holding the stack (sandbox for surfcoin.aillc.link).
set -euo pipefail

STACK_NAME="${PLAYGROUND_STACK_NAME:-surfcoin-playground}"
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
 * Deployed-stack wiring for the playground. These are public identifiers
 * (safe to ship in the bundle). Values come from the surfcoin-playground
 * CloudFormation stack outputs — regenerate with:
 *
 *   bash scripts/sync-playground-config.sh
 */
export const runtime = {
  cognitoDomain: '$COGNITO_DOMAIN',
  userPoolId: '$USER_POOL_ID',
  clientId: '$CLIENT_ID',
  apiBase: '$API_ENDPOINT',
} as const

export const isPlaygroundConfigured = !runtime.clientId.startsWith('REPLACE')
EOF

echo "Wrote src/playground/runtime.ts:"
grep -E "cognitoDomain|userPoolId|clientId|apiBase" src/playground/runtime.ts
