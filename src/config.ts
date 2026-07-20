/**
 * Launch-day control panel. Everything on the site that depends on the coin
 * being live reads from here — set `contractAddress` the moment the coin
 * exists on pump.fun and the site flips from pre-launch to live on its own.
 */
export const config = {
  name: 'SURF',
  ticker: '$SURF',
  domain: 'surfcoin.fail',

  /** Solana mint address from pump.fun. null = pre-launch mode. */
  contractAddress: null as string | null,

  /** pump.fun standard: 1B supply, fair launch, no presale, no team bags. */
  totalSupply: 1_000_000_000,

  /** Socials — null hides the link until it exists. */
  links: {
    twitter: null as string | null,
    telegram: null as string | null,
  },
} as const

export const isLive = config.contractAddress !== null

export const pumpFunUrl = config.contractAddress
  ? `https://pump.fun/coin/${config.contractAddress}`
  : 'https://pump.fun'

export const dexScreenerUrl = config.contractAddress
  ? `https://dexscreener.com/solana/${config.contractAddress}`
  : null
