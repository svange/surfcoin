/**
 * pump.fun bonding-curve math, ported from the pricing model the platform
 * publishes. Every pump.fun coin shares one curve, so this module is a
 * closed-form model — no network, no per-coin state beyond a single scalar
 * (`solRaised`, the amount of SOL that has entered the curve so far).
 *
 * The curve is a constant-product AMM over *virtual* reserves:
 *   solReserve   = VIRTUAL_SOL + solRaised
 *   tokenReserve = K / solReserve
 *   tokensSold   = VIRTUAL_TOKENS - tokenReserve
 * which is exactly the published pricing function
 *   y = 1_073_000_191 - 32_190_005_730 / (30 + x).
 *
 * Anchoring against the platform's own headline numbers (graduation at
 * 85 SOL raised) reproduces them to the quoted precision:
 *   spot at x=0   → 0.0000000280 SOL   (published: ~0.000000028)
 *   spot at x=85  → 0.0000004108 SOL   (published: 0.00000041, "14.64×")
 *   mcap at x=85  → 411 SOL            (published: 410 SOL)
 *   tokens sold   → 793.1M             (published: ~800M)
 */

/** Initial virtual SOL reserve seeded into every curve. */
export const VIRTUAL_SOL = 30
/** Initial virtual token reserve. */
export const VIRTUAL_TOKENS = 1_073_000_191
/** Constant product: VIRTUAL_SOL * VIRTUAL_TOKENS. */
export const K = VIRTUAL_SOL * VIRTUAL_TOKENS // 32_190_005_730
/** Fixed total supply of every pump.fun coin (used for market cap). */
export const TOTAL_SUPPLY = 1_000_000_000
/** SOL raised into the curve at which the coin graduates to Raydium. */
export const GRADUATION_SOL = 85
/** Listing fee taken from the raise when a coin graduates. */
export const LISTING_FEE_SOL = 6
/** pump.fun's trading fee, charged on both buys and sells. */
export const TRADE_FEE = 0.01
/** King of the Hill market-cap threshold (~$30k, per pump.fun). */
export const KOTH_MARKET_CAP_USD = 30_000

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n))

/** Tokens sold out of the curve once `solRaised` SOL has entered it. */
export function tokensSold(solRaised: number): number {
  return VIRTUAL_TOKENS - K / (VIRTUAL_SOL + solRaised)
}

/** Spot price (SOL per token): the marginal cost d(solRaised)/d(tokensSold). */
export function spotPriceSol(solRaised: number): number {
  const r = VIRTUAL_SOL + solRaised
  return (r * r) / K
}

/** Fully-diluted market cap in SOL at a given curve position. */
export function marketCapSol(solRaised: number): number {
  return spotPriceSol(solRaised) * TOTAL_SUPPLY
}

/** Inverse of {@link tokensSold}: SOL raised once `sold` tokens are out. */
export function solRaisedForTokensSold(sold: number): number {
  return K / (VIRTUAL_TOKENS - sold) - VIRTUAL_SOL
}

/** Inverse of {@link spotPriceSol}: SOL raised at a given spot price. */
export function solRaisedForSpotPrice(priceSol: number): number {
  return Math.sqrt(priceSol * K) - VIRTUAL_SOL
}

/** SOL raised needed to reach a target market cap (in SOL). */
export function solRaisedForMarketCapSol(mcapSol: number): number {
  return solRaisedForSpotPrice(mcapSol / TOTAL_SUPPLY)
}

/**
 * Progress along the curve, 0..1, measured by token-reserve depletion toward
 * graduation — the same "% up the bonding curve" pump.fun shows.
 */
export function bondingProgress(solRaised: number): number {
  return clamp(tokensSold(solRaised) / tokensSold(GRADUATION_SOL), 0, 1)
}

export interface BuyResult {
  /** Total SOL the buyer spends (fee inclusive). */
  solIn: number
  /** SOL that actually reaches the curve after the trading fee. */
  solToCurve: number
  fee: number
  tokensOut: number
  /** Effective price paid per token, fee included. */
  avgPriceSol: number
  spotBefore: number
  spotAfter: number
  priceImpactPct: number
  solRaisedAfter: number
}

/** Buy tokens by spending `solIn` SOL at curve position `solRaised`. */
export function buy(solRaised: number, solIn: number, feeRate = TRADE_FEE): BuyResult {
  const fee = solIn * feeRate
  const solToCurve = solIn - fee
  const solRaisedAfter = solRaised + solToCurve
  const tokensOut = tokensSold(solRaisedAfter) - tokensSold(solRaised)
  const spotBefore = spotPriceSol(solRaised)
  const spotAfter = spotPriceSol(solRaisedAfter)
  return {
    solIn,
    solToCurve,
    fee,
    tokensOut,
    avgPriceSol: tokensOut > 0 ? solIn / tokensOut : 0,
    spotBefore,
    spotAfter,
    priceImpactPct: spotBefore > 0 ? (spotAfter / spotBefore - 1) * 100 : 0,
    solRaisedAfter,
  }
}

export interface SellResult {
  tokensIn: number
  /** SOL the curve returns before the trading fee. */
  solGross: number
  fee: number
  /** SOL the seller receives after the fee. */
  solOut: number
  avgPriceSol: number
  spotBefore: number
  spotAfter: number
  priceImpactPct: number
  solRaisedAfter: number
}

/** Sell `tokensIn` tokens back into the curve at position `solRaised`. */
export function sell(solRaised: number, tokensIn: number, feeRate = TRADE_FEE): SellResult {
  const soldBefore = tokensSold(solRaised)
  const soldAfter = Math.max(0, soldBefore - tokensIn)
  const solRaisedAfter = Math.max(0, solRaisedForTokensSold(soldAfter))
  const solGross = solRaised - solRaisedAfter
  const fee = solGross * feeRate
  const solOut = solGross - fee
  const spotBefore = spotPriceSol(solRaised)
  const spotAfter = spotPriceSol(solRaisedAfter)
  return {
    tokensIn,
    solGross,
    fee,
    solOut,
    avgPriceSol: tokensIn > 0 ? solOut / tokensIn : 0,
    spotBefore,
    spotAfter,
    priceImpactPct: spotBefore > 0 ? (spotAfter / spotBefore - 1) * 100 : 0,
    solRaisedAfter,
  }
}

/**
 * SOL a buyer must spend (fee inclusive) to move the curve from its current
 * position up to `targetMcapSol`. Returns 0 if already at or past the target.
 */
export function solToReachMarketCapSol(solRaised: number, targetMcapSol: number, feeRate = TRADE_FEE): number {
  const targetSolRaised = solRaisedForMarketCapSol(targetMcapSol)
  if (targetSolRaised <= solRaised) return 0
  return (targetSolRaised - solRaised) / (1 - feeRate)
}

/** Recover the curve position implied by a live market cap (USD). */
export function solRaisedFromMarketCapUsd(mcapUsd: number, solUsd: number): number {
  return solRaisedForMarketCapSol(mcapUsd / solUsd)
}

export interface CurveSample {
  solRaised: number
  priceSol: number
  mcapSol: number
}

/** Evenly-spaced samples of the price curve, for plotting. */
export function priceCurveSamples(maxSol: number, n = 96): CurveSample[] {
  return Array.from({ length: n + 1 }, (_, i) => {
    const solRaised = (maxSol * i) / n
    return { solRaised, priceSol: spotPriceSol(solRaised), mcapSol: marketCapSol(solRaised) }
  })
}
