import { useState } from 'react'
import type { Candle, MeResponse, PumpCoin, PumpTrade } from '../../shared/types'
import { formatUsd, truncateAddress } from '../lib/format'
import { toast } from '../lib/toast'
import { CandleChart } from './CandleChart'
import { TradePanel } from './TradePanel'
import { Button, Empty, Panel, safeImageUrl, Spinner } from './ui'
import { useQuery } from './useApi'

const INTERVALS = ['1m', '5m', '15m', '1h'] as const

/** A buy/sell prefilled from elsewhere (e.g. the KOTH "Push to KOTH" action). */
export interface TradeSeed {
  mint: string
  action: 'buy' | 'sell'
  amount: string
  /** bump to re-apply the same seed */
  nonce: number
}

export function CoinDetail({
  coin,
  me,
  seed,
  onNewRule,
  onActivity,
}: {
  coin: PumpCoin
  me: MeResponse
  seed?: TradeSeed | null
  onNewRule: (coin: PumpCoin) => void
  onActivity: () => void
}) {
  const [interval, setInterval] = useState<(typeof INTERVALS)[number]>('1m')
  const candles = useQuery<Candle[]>(`/coin/${coin.mint}/candles?interval=${interval}&limit=120`, [
    coin.mint,
    interval,
  ])
  const trades = useQuery<PumpTrade[]>(`/coin/${coin.mint}/trades?limit=15`, [coin.mint])

  return (
    <div className="space-y-5">
      <Panel>
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            {safeImageUrl(coin.imageUri) && (
              <img
                src={safeImageUrl(coin.imageUri)!}
                alt=""
                className="h-12 w-12 rounded-full object-cover"
                referrerPolicy="no-referrer"
              />
            )}
            <div>
              <h2 className="font-display text-2xl text-golden">{coin.symbol}</h2>
              <p className="font-mono text-xs text-seafoam/70">{coin.name}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="font-mono text-lg text-salt">
              {coin.priceUsd !== null ? formatUsd(coin.priceUsd) : '—'}
            </p>
            <p className="font-mono text-[11px] text-seafoam/60">
              mcap {coin.marketCapUsd !== null ? formatUsd(coin.marketCapUsd) : '—'}
            </p>
          </div>
        </div>
        <div className="mt-2 flex items-center gap-3">
          <button
            type="button"
            onClick={() => {
              navigator.clipboard?.writeText(coin.mint)
              toast('mint copied')
            }}
            className="font-mono text-[10px] text-seafoam/50 hover:text-golden"
          >
            {truncateAddress(coin.mint, 6)} ⧉
          </button>
          <a
            href={`https://pump.fun/coin/${coin.mint}`}
            target="_blank"
            rel="noopener noreferrer"
            className="font-mono text-[10px] text-golden underline"
          >
            pump.fun ↗
          </a>
        </div>
      </Panel>

      <Panel
        title="Price"
        right={
          <div className="flex gap-1">
            {INTERVALS.map(iv => (
              <button
                key={iv}
                type="button"
                onClick={() => setInterval(iv)}
                className={`rounded px-2 py-0.5 font-mono text-[10px] ${
                  interval === iv ? 'bg-golden text-night' : 'text-seafoam/60 hover:text-seafoam'
                }`}
              >
                {iv}
              </button>
            ))}
          </div>
        }
      >
        {candles.loading && !candles.data ? (
          <Spinner label="loading candles…" />
        ) : candles.error ? (
          <Empty>couldn't load candles — {candles.error}</Empty>
        ) : candles.data && candles.data.length > 0 ? (
          <CandleChart candles={candles.data} />
        ) : (
          <Empty>no candle data yet for this coin</Empty>
        )}
      </Panel>

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel title="Trade">
          <TradePanel coin={coin} me={me} seed={seed} onActivity={onActivity} />
          <div className="mt-3 border-t border-seafoam/10 pt-3">
            <Button variant="ghost" onClick={() => onNewRule(coin)}>
              + Autopilot rule for {coin.symbol}
            </Button>
          </div>
        </Panel>

        <Panel title="Recent trades">
          {trades.loading && !trades.data ? (
            <Spinner />
          ) : trades.data && trades.data.length > 0 ? (
            <ul className="space-y-1">
              {trades.data.map(t => (
                <li
                  key={t.signature}
                  className="flex items-center justify-between font-mono text-[11px]"
                >
                  <span className={t.isBuy ? 'text-seafoam' : 'text-coral'}>
                    {t.isBuy ? 'buy' : 'sell'}
                  </span>
                  <span className="text-seafoam/70">{t.solAmount.toFixed(4)} SOL</span>
                  <span className="text-seafoam/40">{truncateAddress(t.user, 3)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <Empty>no trades yet</Empty>
          )}
        </Panel>
      </div>
    </div>
  )
}
