import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import type { PumpCoin } from '../../shared/types'
import { config, hasTrackedCoins, trackedMints } from '../config'
import { formatUsd, truncateAddress } from '../lib/format'
import { runtime } from '../playground/runtime'

const POLL_MS = 30_000

interface CoinsResponse {
  coins: PumpCoin[]
  solUsd: number | null
  at: string
}

function safeImg(uri: string | null): string | null {
  if (!uri) return null
  try {
    const u = new URL(uri)
    return u.protocol === 'https:' ? uri : null
  } catch {
    return null
  }
}

function BondingBar({ progress }: { progress: number }) {
  const pct = Math.round(progress * 100)
  return (
    <div className="mt-3">
      <div className="flex items-center justify-between font-mono text-[11px] text-driftwood/70">
        <span>bonding curve</span>
        <span className="font-bold text-burnt">{pct}%</span>
      </div>
      <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-driftwood/10">
        <div
          className="h-full rounded-full bg-gradient-to-r from-golden to-coral transition-[width] duration-700"
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="mt-1 font-mono text-[10px] text-driftwood/50">
        {pct >= 100 ? 'ready to graduate' : `${100 - pct}% to graduation`}
      </p>
    </div>
  )
}

function CoinCard({ coin }: { coin: PumpCoin }) {
  const img = safeImg(coin.imageUri)
  return (
    <article className="rounded-2xl border border-driftwood/10 bg-white/60 p-5 shadow-sm">
      <div className="flex items-start gap-3">
        {img ? (
          <img
            src={img}
            alt=""
            loading="lazy"
            referrerPolicy="no-referrer"
            className="h-12 w-12 shrink-0 rounded-full object-cover"
          />
        ) : (
          <div className="h-12 w-12 shrink-0 rounded-full bg-seafoam/40" />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate font-display text-xl text-burnt">{coin.symbol}</h3>
            {coin.complete ? (
              <span className="rounded-full bg-seafoam/40 px-2 py-0.5 font-mono text-[9px] font-bold tracking-wider text-deepset uppercase">
                graduated
              </span>
            ) : (
              <span className="rounded-full bg-golden/20 px-2 py-0.5 font-mono text-[9px] font-bold tracking-wider text-burnt uppercase">
                on the curve
              </span>
            )}
          </div>
          <p className="truncate font-mono text-xs text-driftwood/60">{coin.name}</p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className="rounded-lg bg-salt/70 p-2.5">
          <p className="font-mono text-[10px] tracking-wider text-driftwood/50 uppercase">
            market cap
          </p>
          <p className="font-mono text-lg font-bold text-deepset">
            {coin.marketCapUsd !== null ? formatUsd(coin.marketCapUsd) : '—'}
          </p>
        </div>
        <div className="rounded-lg bg-salt/70 p-2.5">
          <p className="font-mono text-[10px] tracking-wider text-driftwood/50 uppercase">price</p>
          <p className="font-mono text-lg font-bold text-deepset">
            {coin.priceUsd !== null ? formatUsd(coin.priceUsd) : '—'}
          </p>
        </div>
      </div>

      {coin.bondingProgress !== null && !coin.complete && (
        <BondingBar progress={coin.bondingProgress} />
      )}

      <div className="mt-4 flex items-center justify-between">
        <button
          type="button"
          onClick={() => navigator.clipboard?.writeText(coin.mint)}
          className="font-mono text-[10px] text-driftwood/50 hover:text-burnt"
          title="copy mint"
        >
          {truncateAddress(coin.mint, 5)} ⧉
        </button>
        <div className="flex gap-3">
          <a
            href={`https://pump.fun/coin/${coin.mint}`}
            target="_blank"
            rel="noopener noreferrer"
            className="font-mono text-xs font-bold text-golden hover:text-coral"
          >
            pump.fun ↗
          </a>
          {coin.complete && (
            <a
              href={`https://dexscreener.com/solana/${coin.mint}`}
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono text-xs font-bold text-golden hover:text-coral"
            >
              chart ↗
            </a>
          )}
        </div>
      </div>
    </article>
  )
}

export default function CoinsPage() {
  const [data, setData] = useState<CoinsResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(hasTrackedCoins)

  const query = useMemo(() => {
    const p = new URLSearchParams()
    if (config.creatorWallet) p.set('creator', config.creatorWallet)
    if (trackedMints.length) p.set('mints', trackedMints.join(','))
    return p.toString()
  }, [])

  const load = useCallback(async () => {
    if (!hasTrackedCoins) return
    try {
      const res = await fetch(`${runtime.apiBase}/public/coins?${query}`)
      if (!res.ok) throw new Error(`server ${res.status}`)
      const json: CoinsResponse = await res.json()
      setData(json)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'could not load')
    } finally {
      setLoading(false)
    }
  }, [query])

  useEffect(() => {
    load()
    if (!hasTrackedCoins) return
    const id = setInterval(load, POLL_MS)
    const onVis = () => document.visibilityState === 'visible' && load()
    document.addEventListener('visibilitychange', onVis)
    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [load])

  const coins = data?.coins ?? []

  return (
    <div className="min-h-screen bg-salt text-driftwood">
      <header className="sticky top-0 z-40 border-b border-driftwood/10 bg-salt/80 backdrop-blur-md">
        <nav className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
          <Link to="/" className="flex items-center gap-2">
            <span className="font-display text-2xl text-burnt">SURF</span>
            <span className="font-mono text-xs text-driftwood/60">← back to the beach</span>
          </Link>
          <Link
            to="/playground"
            className="text-sm font-bold text-deepset transition-colors hover:text-burnt"
          >
            Log in
          </Link>
        </nav>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <div className="mb-2 flex items-end justify-between gap-4">
          <div>
            <p className="font-mono text-xs tracking-[0.25em] text-coral uppercase">Coin check</p>
            <h1 className="font-display text-4xl text-burnt sm:text-5xl">Live on the curve</h1>
          </div>
          {data && (
            <p className="hidden font-mono text-[11px] text-driftwood/50 sm:block">
              updated {new Date(data.at).toLocaleTimeString()} · refreshes every 30s
            </p>
          )}
        </div>
        <p className="mb-8 max-w-2xl font-mono text-sm text-driftwood/70">
          Every {config.name} coin launched on pump.fun, with live bonding-curve progress and market
          cap. Pre-graduation numbers come straight from pump.fun; charts appear on DexScreener once
          a coin graduates.
        </p>

        {!hasTrackedCoins ? (
          <EmptyState kind="unconfigured" />
        ) : loading && !data ? (
          <p className="py-16 text-center font-mono text-sm text-driftwood/50">
            checking the lineup…
          </p>
        ) : error && !data ? (
          <p className="py-16 text-center font-mono text-sm text-coral">
            couldn't load coins — {error}
          </p>
        ) : coins.length === 0 ? (
          <EmptyState kind="nothing-yet" />
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {coins.map(c => (
              <CoinCard key={c.mint} coin={c} />
            ))}
          </div>
        )}
      </main>
    </div>
  )
}

function EmptyState({ kind }: { kind: 'unconfigured' | 'nothing-yet' }) {
  return (
    <div className="rounded-2xl border border-dashed border-driftwood/20 bg-white/40 px-6 py-16 text-center">
      <p className="font-display text-2xl text-deepset">
        {kind === 'unconfigured' ? 'No coins registered yet' : 'Nothing on the curve yet'}
      </p>
      <p className="mx-auto mt-3 max-w-lg font-mono text-sm text-driftwood/60">
        {kind === 'unconfigured' ? (
          <>
            Set <code className="rounded bg-driftwood/10 px-1">creatorWallet</code> in{' '}
            <code className="rounded bg-driftwood/10 px-1">src/config.ts</code> to your pump.fun
            wallet and every coin you launch from it shows up here automatically — no manual
            registration.
          </>
        ) : (
          <>
            Your creator wallet has no coins yet. The moment you launch one on pump.fun, it appears
            here live.
          </>
        )}
      </p>
      <a
        href="https://pump.fun"
        target="_blank"
        rel="noopener noreferrer"
        className="mt-6 inline-block rounded-full bg-burnt px-5 py-2 text-sm font-bold text-salt hover:bg-dusk"
      >
        Launch on pump.fun ↗
      </a>
    </div>
  )
}
