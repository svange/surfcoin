/**
 * Deployed-stack wiring for the playground. These are public identifiers
 * (safe to ship in the bundle). Values come from the surfcoin-playground
 * CloudFormation stack outputs — regenerate with:
 *
 *   bash scripts/sync-playground-config.sh
 */
export const runtime = {
  cognitoDomain: 'https://surfcoin-play-5658.auth.us-east-1.amazoncognito.com',
  userPoolId: 'us-east-1_XstAJ0Khp',
  clientId: '7lsa9u98a7cvm5uuijisn58g0i',
  apiBase: 'https://m5vwmgmnxb.execute-api.us-east-1.amazonaws.com',
} as const

export const isPlaygroundConfigured = !runtime.clientId.startsWith('REPLACE')
