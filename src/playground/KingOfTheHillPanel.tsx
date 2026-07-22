import { useEffect, useMemo, useState } from 'react'
import type { PumpCoin, RegistryResponse } from '../../shared/types'
import { formatUsd, truncateAddress } from '../lib/format'
import {
  bondingProgress,
  KOTH_MARKET_CAP_USD,
  solRaisedFromMarketCapUsd,
  solToReachMarketCapSol,
} from '../lib/bondingCurve'
import { toast } from '../lib/toast'
import { Button, chart, Empty, inputClass, Panel, safeImageUrl, Spinner } from './ui'
import { useApi, useQuery } from './useApi'

interface Row {
  coin: PumpCoin
  mcapUsd: number
  reached: boolean
  progress: number
  solNeeded: number
  gradProgress: number
}

function KothBar({ progress, reached }: { progress: number; reached: boolean }) {
  return (
    <div className="mt-2">
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-seafoam/15">
        <div
          className="h-full rounded-full transition-all"
          style={{
            width: `${Math.round(progress * 100)}%`,
            background: reached ? chart.up : chart.neutral,
          }}
        />
      </div>
    </div>
  )
}

function KothRow({ row, onPush }: { row: Row; onPush: (coin: PumpCoin, sol: number) => void }) {
  const { coin, mcapUsd, reached, progress, solNeeded, gradProgress } = row
  return (
    <li className="rounded-lg border border-seafoam/15 bg-night/40 p-3">
      <div className="flex items-center gap-3">
        {safeImageUrl(coin.imageUri) ? (
          <img
            src={safeImageUrl(coin.imageUri)!}
            alt=""
            className="h-9 w-9 shrink-0 rounded-full object-cover"
            loading="lazy"
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="h-9 w-9 shrink-0 rounded-full bg-seafoam/15" />
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate font-mono text-sm font-bold text-salt">{coin.symbol}</p>
          <a
            href={`https://pump.fun/coin/${coin.mint}`}
            target="_blank"
            rel="noopener noreferrer"
            className="font-mono text-[10px] text-seafoam/50 hover:text-golden"
          >
            {truncateAddress(coin.mint, 4)} ↗
          </a>
        </div>
        <div className="text-right">
          <p className="font-mono text-sm text-salt">{formatUsd(mcapUsd)}</p>
          <p className="font-mono text-[10px] text-seafoam/50">
            {reached ? 'at/over KOTH' : `${formatUsd(KOTH_MARKET_CAP_USD - mcapUsd)} to go`}
          </p>
        </div>
      </div>

      <KothBar progress={progress} reached={reached} />

      <div className="mt-2 flex items-center justify-between gap-2">
        <span className="font-mono text-[10px] text-seafoam/50">
          {reached ? (
            <span className="text-seafoam">👑 KOTH range — {Math.round(gradProgress * 100)}% to graduation</span>
          ) : (
            <>
              buy <span className="text-golden">~{solNeeded.toFixed(3)} SOL</span> to reach KOTH
            </>
          )}
        </span>
        {!reached && (
          <Button variant="primary" onClick={() => onPush(coin, solNeeded)} className="px-3 py-1 text-xs">
            Push to KOTH →
          </Button>
        )}
      </div>
    </li>
  )
}

/**
 * King of the Hill tracker for the coins you launch/track. Pulls your created
 * coins and pinned mints, and for each still on the bonding curve computes how
 * far it is from the ~$30k KOTH market cap and how much SOL a buy would need to
 * push it there. "Push to KOTH" seeds that buy straight into the trade desk.
 */
export function KingOfTheHillPanel({
  solUsd,
  onPush,
}: {
  solUsd: number
  onPush: (coin: PumpCoin, sol: number) => void
}) {
  const api = useApi()
  const created = useQuery<PumpCoin[]>('/coins/created', [])
  const registry = useQuery<RegistryResponse>('/registry', [])
  const [pinned, setPinned] = useState<PumpCoin[]>([])
  const [manualMint, setManualMint] = useState('')
  const [extra, setExtra] = useState<PumpCoin[]>([])
  const [checking, setChecking] = useState(false)

  // Pinned mints from the registry aren't necessarily creator coins, so fetch
  // each one's live stats directly.
  useEffect(() => {
    const mints = registry.data?.mints ?? []
    if (mints.length === 0) {
      setPinned([])
      return
    }
    let cancelled = false
    Promise.all(mints.map(m => api<PumpCoin>(`/coin/${m}`).catch(() => null))).then(list => {
      if (!cancelled) setPinned(list.filter((c): c is PumpCoin => c !== null))
    })
    return () => {
      cancelled = true
    }
  }, [api, registry.data?.mints])

  async function checkMint() {
    const mint = manualMint.trim()
    if (!mint) return
    setChecking(true)
    try {
      const coin = await api<PumpCoin>(`/coin/${mint}`)
      setExtra(prev => [coin, ...prev.filter(c => c.mint !== coin.mint)])
      setManualMint('')
    } catch (e) {
      toast(e instanceof Error ? e.message : 'could not load that mint')
    } finally {
      setChecking(false)
    }
  }

  const rows = useMemo<Row[]>(() => {
    const all = [...(created.data ?? []), ...pinned, ...extra]
    const seen = new Set<string>()
    const target = KOTH_MARKET_CAP_USD
    return all
      .filter(c => {
        if (seen.has(c.mint)) return false
        seen.add(c.mint)
        return !c.complete && c.marketCapUsd !== null && c.marketCapUsd > 0
      })
      .map((coin): Row => {
        const mcapUsd = coin.marketCapUsd as number
        const solRaisedNow = solRaisedFromMarketCapUsd(mcapUsd, solUsd)
        return {
          coin,
          mcapUsd,
          reached: mcapUsd >= target,
          progress: Math.min(1, mcapUsd / target),
          solNeeded: solToReachMarketCapSol(solRaisedNow, target / solUsd),
          gradProgress: coin.bondingProgress ?? bondingProgress(solRaisedNow),
        }
      })
      .sort((a, b) => b.mcapUsd - a.mcapUsd)
  }, [created.data, pinned, extra, solUsd])

  const noWallet = created.error?.includes('no wallet linked')
  const loading = created.loading || registry.loading

  return (
    <Panel title="King of the Hill">
      <p className="mb-4 font-mono text-[11px] text-seafoam/60">
        Take the crown at ~{formatUsd(KOTH_MARKET_CAP_USD)} market cap and pump.fun features your coin
        at the top of its homepage — free marketing. These are your{' '}
        <span className="text-seafoam">Created</span> coins and{' '}
        <span className="text-seafoam">pinned mints</span>, still on the curve.
      </p>

      <div className="mb-4 flex gap-2">
        <input
          className={inputClass}
          value={manualMint}
          onChange={e => setManualMint(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && checkMint()}
          placeholder="check any mint address…"
        />
        <Button variant="ghost" onClick={checkMint} disabled={checking}>
          {checking ? '…' : 'check'}
        </Button>
      </div>

      {loading && rows.length === 0 ? (
        <Spinner label="reading the leaderboard…" />
      ) : rows.length === 0 ? (
        <Empty>
          {noWallet
            ? 'Link a wallet (Connections) to auto-load your created coins, or check a mint above.'
            : 'No on-curve coins yet — launch one, pin a mint in Connections, or check a mint above.'}
        </Empty>
      ) : (
        <ul className="space-y-2">
          {rows.map(row => (
            <KothRow key={row.coin.mint} row={row} onPush={onPush} />
          ))}
        </ul>
      )}
    </Panel>
  )
}
