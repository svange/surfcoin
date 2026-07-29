import { useRef, useState } from 'react'
import type { MeResponse, PumpCoin } from '../../shared/types'
import { ActivityPanel, type ActivityHandle } from './ActivityPanel'
import { AdminUsersPanel } from './AdminUsersPanel'
import { useAuth } from './AuthContext'
import { AutopilotPanel } from './AutopilotPanel'
import { BondingCurvePanel } from './BondingCurvePanel'
import { ClaimFeesPanel } from './ClaimFeesPanel'
import { CoinDetail, type TradeSeed } from './CoinDetail'
import { CoinsPanel } from './CoinsPanel'
import { KingOfTheHillPanel } from './KingOfTheHillPanel'
import { LinkPanel } from './LinkPanel'
import { RawExplorer } from './RawExplorer'
import { TrackedCoinsPanel } from './TrackedCoinsPanel'
import { useSolPrice } from './useSolPrice'
import { Empty, Panel } from './ui'

type Tab = 'trade' | 'koth' | 'autopilot' | 'explorer' | 'connections' | 'users'

const TABS: { id: Tab; label: string; adminOnly?: boolean }[] = [
  { id: 'trade', label: 'Trade desk' },
  { id: 'koth', label: 'King of the Hill' },
  { id: 'autopilot', label: 'Autopilot' },
  { id: 'explorer', label: 'API explorer' },
  { id: 'connections', label: 'Connections' },
  { id: 'users', label: 'Users', adminOnly: true },
]

export function Dashboard({ me, onMe }: { me: MeResponse; onMe: (me: MeResponse) => void }) {
  const { isAdmin } = useAuth()
  const [tab, setTab] = useState<Tab>(me.wallet || me.pumpPortal ? 'trade' : 'connections')
  const [selected, setSelected] = useState<PumpCoin | null>(null)
  const [ruleSeed, setRuleSeed] = useState<PumpCoin | null>(null)
  const [tradeSeed, setTradeSeed] = useState<TradeSeed | null>(null)
  const [solUsd, setSolUsd] = useSolPrice()
  const activityRef = useRef<ActivityHandle>(null)

  const notifyActivity = () => activityRef.current?.reload()

  // KOTH "Push to KOTH" → select the coin, prefill a buy, jump to the trade desk.
  const pushToKoth = (coin: PumpCoin, sol: number) => {
    setSelected(coin)
    setTradeSeed({ mint: coin.mint, action: 'buy', amount: sol.toFixed(4), nonce: Date.now() })
    setTab('trade')
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <nav className="mb-6 flex flex-wrap gap-2">
        {TABS.filter(t => !t.adminOnly || isAdmin).map(t => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`rounded-full px-4 py-1.5 font-mono text-xs font-bold transition-colors ${
              tab === t.id
                ? 'bg-golden text-night'
                : 'border border-seafoam/25 text-seafoam/70 hover:text-seafoam'
            }`}
          >
            {t.label}
          </button>
        ))}
        <span className="ml-auto flex items-center gap-3 font-mono text-[10px] text-seafoam/50">
          <span className={me.wallet ? 'text-seafoam' : ''}>
            {me.wallet ? '● wallet' : '○ wallet'}
          </span>
          <span className={me.pumpPortal ? 'text-seafoam' : ''}>
            {me.pumpPortal ? '● lightning' : '○ lightning'}
          </span>
          <span className={me.settings.liveTrading ? 'text-coral' : ''}>
            {me.settings.liveTrading ? '● LIVE' : '○ dry'}
          </span>
        </span>
      </nav>

      {tab === 'connections' && (
        <div className="space-y-5">
          <LinkPanel me={me} onChange={onMe} />
          <div className="grid gap-5 md:grid-cols-2">
            <ClaimFeesPanel me={me} />
            <TrackedCoinsPanel />
          </div>
        </div>
      )}

      {tab === 'trade' && (
        <div className="grid gap-5 lg:grid-cols-[minmax(280px,340px)_1fr]">
          <CoinsPanel
            me={me}
            selectedMint={selected?.mint ?? null}
            onSelect={setSelected}
          />
          <div className="space-y-5">
            {selected ? (
              <CoinDetail
                coin={selected}
                me={me}
                seed={tradeSeed && tradeSeed.mint === selected.mint ? tradeSeed : null}
                onActivity={notifyActivity}
                onNewRule={c => {
                  setRuleSeed(c)
                  setTab('autopilot')
                }}
              />
            ) : (
              <Panel>
                <Empty>Pick a coin from the lineup to chart it and trade.</Empty>
              </Panel>
            )}
            <ActivityPanel handleRef={activityRef} />
          </div>
        </div>
      )}

      {tab === 'koth' && (
        <div className="space-y-5">
          <KingOfTheHillPanel solUsd={solUsd} onPush={pushToKoth} />
          <BondingCurvePanel solUsd={solUsd} />
          <SolPriceNote solUsd={solUsd} onChange={setSolUsd} />
        </div>
      )}

      {tab === 'autopilot' && (
        <div className="grid gap-5 lg:grid-cols-2">
          <AutopilotPanel seed={ruleSeed} />
          <ActivityPanel handleRef={activityRef} />
        </div>
      )}

      {tab === 'explorer' && <RawExplorer />}

      {tab === 'users' && isAdmin && <AdminUsersPanel />}
    </div>
  )
}

/** Editable SOL/USD assumption shared by the KOTH tracker and the calculator. */
function SolPriceNote({ solUsd, onChange }: { solUsd: number; onChange: (n: number) => void }) {
  return (
    <p className="text-center font-mono text-[11px] text-seafoam/50">
      USD figures assume SOL ={' '}
      <input
        type="number"
        value={solUsd}
        min={0}
        step={1}
        onChange={e => onChange(Number(e.target.value) || 0)}
        className="w-20 rounded border border-seafoam/25 bg-night/60 px-2 py-0.5 text-center font-mono text-salt outline-none focus:border-golden"
      />{' '}
      USD · live from pump.fun, editable
    </p>
  )
}
