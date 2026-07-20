import { useState } from 'react'
import type { MeResponse, PortfolioResponse, PumpCoin } from '../../shared/types'
import { formatUsd } from '../lib/format'
import { CoinCard } from './CoinCard'
import { Empty, Panel, Spinner } from './ui'
import { useQuery } from './useApi'

type Source = 'held' | 'created' | 'explore-new' | 'explore-mc'

const TABS: { id: Source; label: string; needsWallet?: boolean }[] = [
  { id: 'held', label: 'Holdings', needsWallet: true },
  { id: 'created', label: 'Created', needsWallet: true },
  { id: 'explore-new', label: 'New' },
  { id: 'explore-mc', label: 'Top' },
]

export function CoinsPanel({
  me,
  selectedMint,
  onSelect,
}: {
  me: MeResponse
  selectedMint: string | null
  onSelect: (coin: PumpCoin) => void
}) {
  const [source, setSource] = useState<Source>(me.wallet ? 'held' : 'explore-new')

  const path =
    source === 'held'
      ? me.wallet
        ? '/portfolio'
        : null
      : source === 'created'
        ? me.wallet
          ? '/coins/created'
          : null
        : source === 'explore-new'
          ? '/explore?view=new'
          : '/explore?view=topmc'

  const portfolio = useQuery<PortfolioResponse>(source === 'held' ? path : null, [source])
  const list = useQuery<PumpCoin[]>(source === 'held' ? null : path, [source])

  const coins: PumpCoin[] =
    source === 'held' ? (portfolio.data?.coins ?? []) : (list.data ?? [])
  const loading = source === 'held' ? portfolio.loading : list.loading
  const error = source === 'held' ? portfolio.error : list.error

  return (
    <Panel
      title="Coins"
      right={
        <div className="flex flex-wrap gap-1">
          {TABS.filter(t => !t.needsWallet || me.wallet).map(t => (
            <button
              key={t.id}
              type="button"
              onClick={() => setSource(t.id)}
              className={`rounded px-2 py-0.5 font-mono text-[10px] ${
                source === t.id ? 'bg-golden text-night' : 'text-seafoam/60 hover:text-seafoam'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      }
    >
      {source === 'held' && portfolio.data && (
        <div className="mb-3 flex items-center justify-between rounded-lg border border-seafoam/15 bg-night/40 px-3 py-2">
          <span className="font-mono text-[10px] tracking-wider text-seafoam/60 uppercase">
            SOL balance
          </span>
          <span className="font-mono text-sm text-salt">
            {portfolio.data.solBalance.toFixed(3)} SOL
            {portfolio.data.solUsd !== null && (
              <span className="ml-2 text-seafoam/50">
                {formatUsd(portfolio.data.solBalance * portfolio.data.solUsd)}
              </span>
            )}
          </span>
        </div>
      )}

      {loading && coins.length === 0 ? (
        <Spinner label="reading the lineup…" />
      ) : error ? (
        <Empty>{error}</Empty>
      ) : coins.length === 0 ? (
        <Empty>
          {source === 'held'
            ? 'no coins held by this wallet'
            : source === 'created'
              ? 'this wallet has created no coins'
              : 'nothing here'}
        </Empty>
      ) : (
        <div className="grid max-h-[70vh] gap-2 overflow-y-auto pr-1">
          {coins.map(c => (
            <CoinCard
              key={c.mint}
              coin={c}
              selected={c.mint === selectedMint}
              onSelect={() => onSelect(c)}
            />
          ))}
        </div>
      )}
    </Panel>
  )
}
