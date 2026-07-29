import { describe, it, expect } from 'vitest'
import {
  VIRTUAL_SOL,
  VIRTUAL_TOKENS,
  K,
  TOTAL_SUPPLY,
  GRADUATION_SOL,
  tokensSold,
  spotPriceSol,
  marketCapSol,
  solRaisedForTokensSold,
  solRaisedForSpotPrice,
  solRaisedForMarketCapSol,
  bondingProgress,
  buy,
  sell,
  solToReachMarketCapSol,
  solRaisedFromMarketCapUsd,
  priceCurveSamples,
} from './bondingCurve'

describe('curve constants', () => {
  it('K is the product of the virtual reserves', () => {
    expect(K).toBe(VIRTUAL_SOL * VIRTUAL_TOKENS)
    expect(K).toBe(32_190_005_730)
  })
})

describe('tokensSold', () => {
  it('is zero at the start of the curve', () => {
    expect(tokensSold(0)).toBeCloseTo(0, 6)
  })
  it('increases monotonically with SOL raised', () => {
    expect(tokensSold(10)).toBeGreaterThan(tokensSold(1))
    expect(tokensSold(85)).toBeGreaterThan(tokensSold(50))
  })
  it('matches the published ~793M tokens sold at graduation', () => {
    expect(tokensSold(GRADUATION_SOL) / 1e6).toBeCloseTo(793.1, 0)
  })
})

describe('spotPriceSol / marketCapSol', () => {
  it('reproduces the published spot price at x=0', () => {
    expect(spotPriceSol(0)).toBeCloseTo(2.7959e-8, 11)
  })
  it('reproduces the published spot price at graduation', () => {
    expect(spotPriceSol(85)).toBeCloseTo(4.108e-7, 10)
  })
  it('gives a market cap of ~411 SOL at graduation', () => {
    expect(marketCapSol(85)).toBeCloseTo(411, 0)
  })
  it('market cap is spot price times total supply', () => {
    expect(marketCapSol(42)).toBeCloseTo(spotPriceSol(42) * TOTAL_SUPPLY, 6)
  })
})

describe('inverse functions round-trip', () => {
  it('solRaisedForTokensSold inverts tokensSold', () => {
    for (const x of [0, 5, 30, 85, 120]) {
      expect(solRaisedForTokensSold(tokensSold(x))).toBeCloseTo(x, 6)
    }
  })
  it('solRaisedForSpotPrice inverts spotPriceSol', () => {
    for (const x of [0, 12.5, 85]) {
      expect(solRaisedForSpotPrice(spotPriceSol(x))).toBeCloseTo(x, 6)
    }
  })
  it('solRaisedForMarketCapSol inverts marketCapSol', () => {
    expect(solRaisedForMarketCapSol(marketCapSol(60))).toBeCloseTo(60, 6)
  })
})

describe('bondingProgress', () => {
  it('is 0 at the start', () => {
    expect(bondingProgress(0)).toBeCloseTo(0, 6)
  })
  it('is 1 at graduation', () => {
    expect(bondingProgress(GRADUATION_SOL)).toBeCloseTo(1, 6)
  })
  it('clamps to 1 past graduation', () => {
    expect(bondingProgress(200)).toBe(1)
  })
  it('stays within [0, 1] mid-curve', () => {
    const p = bondingProgress(40)
    expect(p).toBeGreaterThan(0)
    expect(p).toBeLessThan(1)
  })
})

describe('buy', () => {
  it('splits SOL into curve amount and fee', () => {
    const r = buy(0, 1)
    expect(r.fee).toBeCloseTo(0.01, 9)
    expect(r.solToCurve).toBeCloseTo(0.99, 9)
    expect(r.solRaisedAfter).toBeCloseTo(0.99, 9)
    expect(r.solIn).toBe(1)
  })
  it('honours a custom fee rate (0 = no fee)', () => {
    const r = buy(0, 1, 0)
    expect(r.fee).toBe(0)
    expect(r.solToCurve).toBe(1)
  })
  it('returns tokens equal to the curve delta and a positive impact', () => {
    const r = buy(10, 5)
    expect(r.tokensOut).toBeCloseTo(tokensSold(r.solRaisedAfter) - tokensSold(10), 3)
    expect(r.tokensOut).toBeGreaterThan(0)
    expect(r.spotAfter).toBeGreaterThan(r.spotBefore)
    expect(r.priceImpactPct).toBeGreaterThan(0)
    expect(r.avgPriceSol).toBeGreaterThan(0)
  })
  it('yields a zero average price when nothing is spent', () => {
    const r = buy(10, 0)
    expect(r.tokensOut).toBeCloseTo(0, 6)
    expect(r.avgPriceSol).toBe(0)
    expect(r.priceImpactPct).toBeCloseTo(0, 6)
  })
})

describe('sell', () => {
  it('is approximately the inverse of a buy', () => {
    const bought = buy(20, 3, 0)
    const back = sell(bought.solRaisedAfter, bought.tokensOut, 0)
    expect(back.solOut).toBeCloseTo(3, 3)
    expect(back.solRaisedAfter).toBeCloseTo(20, 3)
  })
  it('charges the fee on the gross proceeds', () => {
    const r = sell(30, 1_000_000)
    expect(r.fee).toBeCloseTo(r.solGross * 0.01, 9)
    expect(r.solOut).toBeCloseTo(r.solGross - r.fee, 9)
    expect(r.spotAfter).toBeLessThan(r.spotBefore)
    expect(r.avgPriceSol).toBeGreaterThan(0)
  })
  it('clamps at the bottom of the curve when oversold', () => {
    const r = sell(10, VIRTUAL_TOKENS * 2)
    expect(r.solRaisedAfter).toBe(0)
    expect(r.solGross).toBeLessThanOrEqual(10)
  })
  it('yields a zero average price when nothing is sold', () => {
    const r = sell(30, 0)
    expect(r.avgPriceSol).toBe(0)
    expect(r.solGross).toBeCloseTo(0, 6)
  })
})

describe('solToReachMarketCapSol', () => {
  it('is the fee-grossed SOL needed to climb to the target', () => {
    const solRaised = 10
    const targetMcap = marketCapSol(40)
    const need = solToReachMarketCapSol(solRaised, targetMcap, 0)
    expect(solRaised + need).toBeCloseTo(40, 4)
  })
  it('grosses up for the trading fee', () => {
    const withFee = solToReachMarketCapSol(10, marketCapSol(40))
    const withoutFee = solToReachMarketCapSol(10, marketCapSol(40), 0)
    expect(withFee).toBeGreaterThan(withoutFee)
  })
  it('is zero when already at or past the target', () => {
    expect(solToReachMarketCapSol(50, marketCapSol(40))).toBe(0)
  })
})

describe('solRaisedFromMarketCapUsd', () => {
  it('recovers the curve position from a USD market cap', () => {
    const solUsd = 150
    const solRaised = 45
    const mcapUsd = marketCapSol(solRaised) * solUsd
    expect(solRaisedFromMarketCapUsd(mcapUsd, solUsd)).toBeCloseTo(solRaised, 4)
  })
})

describe('priceCurveSamples', () => {
  it('returns n+1 evenly spaced samples with matching prices', () => {
    const samples = priceCurveSamples(85, 10)
    expect(samples).toHaveLength(11)
    expect(samples[0].solRaised).toBe(0)
    expect(samples[10].solRaised).toBeCloseTo(85, 9)
    expect(samples[5].priceSol).toBeCloseTo(spotPriceSol(samples[5].solRaised), 12)
    expect(samples[5].mcapSol).toBeCloseTo(marketCapSol(samples[5].solRaised), 6)
  })
  it('defaults to 96 intervals', () => {
    expect(priceCurveSamples(85)).toHaveLength(97)
  })
})
