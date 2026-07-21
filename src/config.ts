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

  /**
   * Your pump.fun creator wallet (base58). Every coin you launch from it is
   * auto-discovered and shown on /coins — no manual registration needed.
   * null = not set yet.
   */
  creatorWallet: null as string | null,

  /**
   * Extra mints to feature on /coins even if launched from another wallet.
   * The main `contractAddress` is always included automatically.
   */
  pinnedMints: [] as string[],

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

/** Mints to feature on /coins: the main CA + any pinned, de-duped. */
export const trackedMints: string[] = [
  ...new Set([config.contractAddress, ...config.pinnedMints].filter(Boolean) as string[]),
]

/** Whether /coins has anything to show/track yet. */
export const hasTrackedCoins = config.creatorWallet !== null || trackedMints.length > 0
