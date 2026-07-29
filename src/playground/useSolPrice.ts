import { useEffect, useState } from 'react'
import type { RawProxyResponse } from '../../shared/types'
import { useApi } from './useApi'

/** Assumed SOL/USD before the live price resolves (or if the fetch fails). */
const FALLBACK_SOL_USD = 150

/**
 * Live SOL/USD via the authenticated pump.fun proxy (`/sol-price`). Returns the
 * price plus a setter so the user can override the assumption — every USD figure
 * in the curve tools is only as good as this number.
 */
export function useSolPrice(): [number, (n: number) => void] {
  const api = useApi()
  const [price, setPrice] = useState(FALLBACK_SOL_USD)

  useEffect(() => {
    let cancelled = false
    api<RawProxyResponse>('/pump/raw?host=frontend&path=/sol-price')
      .then(r => {
        const p = (r.body as { solPrice?: number } | null)?.solPrice
        if (!cancelled && typeof p === 'number' && p > 0) setPrice(p)
      })
      .catch(() => {
        /* keep the fallback — the tools still work, just on an assumed price */
      })
    return () => {
      cancelled = true
    }
  }, [api])

  return [price, setPrice]
}
