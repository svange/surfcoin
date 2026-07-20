import { useEffect, useState } from 'react'
import { config } from '../config'

export interface MarketData {
  priceUsd: number
  marketCap: number
  volume24h: number
  priceChange24h: number
  liquidityUsd: number
}

const POLL_MS = 30_000

interface DexScreenerPair {
  priceUsd?: string
  marketCap?: number
  fdv?: number
  volume?: { h24?: number }
  priceChange?: { h24?: number }
  liquidity?: { usd?: number }
}

/**
 * Polls the public DexScreener API for live stats once a contract address is
 * set. Pre-launch (or if DexScreener has no pair yet, e.g. still on the
 * pump.fun bonding curve) this returns null and the UI shows its pre-launch
 * state instead.
 */
export function useMarketData(): MarketData | null {
  const [data, setData] = useState<MarketData | null>(null)

  useEffect(() => {
    const ca = config.contractAddress
    if (!ca) return

    let cancelled = false

    async function fetchData() {
      try {
        const res = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${ca}`)
        if (!res.ok) return
        const json: { pairs?: DexScreenerPair[] } = await res.json()
        if (cancelled || !json.pairs?.length) return
        // Most liquid pair is the real market; the rest are dust.
        const pair = json.pairs.reduce((best, p) =>
          (p.liquidity?.usd ?? 0) > (best.liquidity?.usd ?? 0) ? p : best,
        )
        setData({
          priceUsd: Number(pair.priceUsd ?? 0),
          marketCap: pair.marketCap ?? pair.fdv ?? 0,
          volume24h: pair.volume?.h24 ?? 0,
          priceChange24h: pair.priceChange?.h24 ?? 0,
          liquidityUsd: pair.liquidity?.usd ?? 0,
        })
      } catch {
        // Network hiccup — keep last data, try again next poll.
      }
    }

    fetchData()
    const id = setInterval(fetchData, POLL_MS)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [])

  return data
}
