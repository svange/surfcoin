/**
 * Server-side client for pump.fun's public data APIs. These endpoints reject
 * cross-origin browser calls (Cloudflare 403s any request carrying an Origin
 * header), which is why the SPA goes through this Lambda.
 *
 * Endpoint inventory verified 2026-07-20 by probing:
 *   frontend-api-v3.pump.fun  /coins /coins/{mint} /balances/{addr} /sol-price
 *   swap-api.pump.fun         /v1/coins/{mint}/candles /v2/coins/{mint}/trades
 *   advanced-api-v2.pump.fun  /coins/list
 */
import type { Candle, HeldCoin, PumpCoin, PumpTrade } from '../../shared/types'
import { fetchWithTimeout, HttpError } from './http'

export const PUMP_HOSTS = {
  frontend: 'https://frontend-api-v3.pump.fun',
  swap: 'https://swap-api.pump.fun',
  advanced: 'https://advanced-api-v2.pump.fun',
} as const

const UA = 'surfcoin-playground/0.1 (+https://surfcoin.aillc.link)'

async function getJson<T>(url: string): Promise<T> {
  const res = await fetchWithTimeout(url, { headers: { accept: 'application/json', 'user-agent': UA } })
  if (!res.ok) throw new HttpError(502, `pump.fun upstream ${res.status} for ${new URL(url).pathname}`)
  return res.json() as Promise<T>
}

// bonding-curve virtual token reserves: launch value → graduation value
const CURVE_START = 1_073_000_000_000_000
const CURVE_END = 206_900_000_000_000

interface RawCoin {
  mint: string
  name: string
  symbol: string
  image_uri?: string | null
  description?: string | null
  creator?: string | null
  created_timestamp?: number | null
  complete?: boolean
  virtual_token_reserves?: number
  total_supply?: number
  market_cap?: number
  usd_market_cap?: number
}

function normalizeCoin(raw: RawCoin): PumpCoin {
  const supply = raw.total_supply ? raw.total_supply / 1e6 : 1e9
  const mcapUsd = raw.usd_market_cap ?? null
  let bondingProgress: number | null = null
  if (!raw.complete && typeof raw.virtual_token_reserves === 'number') {
    bondingProgress = Math.min(
      1,
      Math.max(0, (CURVE_START - raw.virtual_token_reserves) / (CURVE_START - CURVE_END)),
    )
  }
  return {
    mint: raw.mint,
    name: raw.name,
    symbol: raw.symbol,
    imageUri: raw.image_uri ?? null,
    creator: raw.creator ?? null,
    createdAt: raw.created_timestamp ?? null,
    description: raw.description ?? null,
    marketCapUsd: mcapUsd,
    priceUsd: mcapUsd !== null ? mcapUsd / supply : null,
    bondingProgress,
    complete: raw.complete ?? false,
  }
}

export async function getSolPriceUsd(): Promise<number> {
  const r = await getJson<{ solPrice: number }>(`${PUMP_HOSTS.frontend}/sol-price`)
  return r.solPrice
}

export async function getCoin(mint: string): Promise<PumpCoin> {
  return normalizeCoin(await getJson<RawCoin>(`${PUMP_HOSTS.frontend}/coins/${mint}`))
}

export async function getCreatedCoins(creator: string, limit = 50): Promise<PumpCoin[]> {
  const raw = await getJson<RawCoin[]>(
    `${PUMP_HOSTS.frontend}/coins?creator=${creator}&offset=0&limit=${limit}&sort=created_timestamp&order=DESC`,
  )
  return raw.map(normalizeCoin)
}

export async function getExplore(view: 'new' | 'topmc', limit = 24): Promise<PumpCoin[]> {
  const sort = view === 'new' ? 'created_timestamp' : 'market_cap'
  const raw = await getJson<RawCoin[]>(
    `${PUMP_HOSTS.frontend}/coins?offset=0&limit=${limit}&sort=${sort}&order=DESC&includeNsfw=false`,
  )
  return raw.map(normalizeCoin)
}

interface RawBalance {
  mint: string
  balance: number
  symbol: string
  name: string
  image_uri?: string | null
  market_cap?: number
  /** value of the holding, denominated in SOL */
  value?: number
}

/**
 * Held coins for a wallet. Balance amounts come back in raw units (6
 * decimals); values and market caps in SOL, converted here with the live
 * SOL price. Per-coin curve status comes from a bounded meta join.
 */
export async function getHeldCoins(address: string, solUsd: number | null): Promise<HeldCoin[]> {
  const raw = await getJson<RawBalance[]>(
    `${PUMP_HOSTS.frontend}/balances/${address}?limit=100&offset=0&minBalance=-1`,
  )
  const held = raw
    .filter(b => b.balance > 0)
    .map((b): HeldCoin => {
      const uiBalance = b.balance / 1e6
      // solUsd null (price fetch failed) → USD unknown, not zero
      const valueUsd = solUsd !== null && typeof b.value === 'number' ? b.value * solUsd : null
      return {
        mint: b.mint,
        name: b.name,
        symbol: b.symbol,
        imageUri: b.image_uri ?? null,
        creator: null,
        createdAt: null,
        description: null,
        marketCapUsd:
          solUsd !== null && typeof b.market_cap === 'number' ? b.market_cap * solUsd : null,
        priceUsd: valueUsd !== null && uiBalance > 0 ? valueUsd / uiBalance : null,
        bondingProgress: null,
        complete: false,
        balance: uiBalance,
        valueUsd,
      }
    })
    .sort((a, b) => (b.valueUsd ?? 0) - (a.valueUsd ?? 0))

  // enrich the top holdings with curve status; leave the tail as-is
  const enriched = await Promise.allSettled(held.slice(0, 15).map(h => getCoin(h.mint)))
  enriched.forEach((r, i) => {
    if (r.status === 'fulfilled') {
      held[i] = { ...held[i], ...r.value, balance: held[i].balance, valueUsd: held[i].valueUsd }
    }
  })
  return held
}

interface RawCandle {
  timestamp: number
  open: string
  high: string
  low: string
  close: string
  volume: string
}

const CANDLE_INTERVALS = new Set(['1s', '1m', '5m', '15m', '1h', '4h', '1d'])

export async function getCandles(mint: string, interval: string, limit: number): Promise<Candle[]> {
  if (!CANDLE_INTERVALS.has(interval)) throw new HttpError(400, `interval must be one of ${[...CANDLE_INTERVALS].join(', ')}`)
  const raw = await getJson<RawCandle[]>(
    `${PUMP_HOSTS.swap}/v1/coins/${mint}/candles?interval=${interval}&limit=${limit}&currency=USD`,
  )
  return raw
    .map(c => ({
      time: Math.floor(c.timestamp / 1000),
      open: Number(c.open),
      high: Number(c.high),
      low: Number(c.low),
      close: Number(c.close),
      volume: Number(c.volume),
    }))
    .sort((a, b) => a.time - b.time)
}

interface RawTrade {
  tx: string
  timestamp: string
  userAddress: string
  type: 'buy' | 'sell'
  amountSol: string
  baseAmount: string
}

export async function getTrades(mint: string, limit: number): Promise<PumpTrade[]> {
  const r = await getJson<{ trades: RawTrade[] }>(
    `${PUMP_HOSTS.swap}/v2/coins/${mint}/trades?limit=${limit}`,
  )
  return r.trades.map(t => ({
    signature: t.tx,
    isBuy: t.type === 'buy',
    solAmount: Number(t.amountSol),
    tokenAmount: Number(t.baseAmount),
    user: t.userAddress,
    timestamp: Math.floor(new Date(t.timestamp).getTime() / 1000),
  }))
}

// ── raw explorer proxy ──────────────────────────────────────────────────────

const RAW_PATH_RE = /^\/[A-Za-z0-9/_\-.]*(\?[A-Za-z0-9/_\-.&=%+]*)?$/

/**
 * GET-only passthrough for the API-explorer panel. Host is picked from a
 * fixed map and the path is shape-validated, so this cannot be aimed at
 * anything but the three pump.fun data hosts.
 */
export async function rawProxy(host: string, path: string): Promise<{ status: number; body: unknown }> {
  const base = PUMP_HOSTS[host as keyof typeof PUMP_HOSTS]
  if (!base) throw new HttpError(400, `host must be one of ${Object.keys(PUMP_HOSTS).join(', ')}`)
  if (path.length > 500 || path.includes('..') || !RAW_PATH_RE.test(path)) {
    throw new HttpError(400, 'path failed validation')
  }
  const res = await fetchWithTimeout(`${base}${path}`, {
    headers: { accept: 'application/json', 'user-agent': UA },
  })
  let body: unknown
  const text = await res.text()
  try {
    body = JSON.parse(text)
  } catch {
    body = text.slice(0, 5000)
  }
  return { status: res.status, body }
}
