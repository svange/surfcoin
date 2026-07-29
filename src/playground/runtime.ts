/**
 * Deployed-stack wiring for the playground. Public identifiers, safe to ship.
 * Generated from the 'surfcoin' CloudFormation stack outputs by the
 * pipeline (scripts/sync-playground-config.sh) — do not edit by hand.
 */
export const runtime = {
  cognitoDomain: 'https://surfcoin-play.auth.us-east-1.amazoncognito.com',
  userPoolId: 'us-east-1_Wkrhpuyun',
  clientId: '1d210k9k93tbl2ifjd6pjgg698',
  apiBase: 'https://eeujqnb6ie.execute-api.us-east-1.amazonaws.com',
} as const

export const isPlaygroundConfigured = !runtime.clientId.startsWith('REPLACE')
