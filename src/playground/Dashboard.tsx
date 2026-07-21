import { useRef, useState } from 'react'
import type { MeResponse, PumpCoin } from '../../shared/types'
import { ActivityPanel, type ActivityHandle } from './ActivityPanel'
import { AdminUsersPanel } from './AdminUsersPanel'
import { useAuth } from './AuthContext'
import { AutopilotPanel } from './AutopilotPanel'
import { ClaimFeesPanel } from './ClaimFeesPanel'
import { CoinDetail } from './CoinDetail'
import { CoinsPanel } from './CoinsPanel'
import { LinkPanel } from './LinkPanel'
import { RawExplorer } from './RawExplorer'
import { TrackedCoinsPanel } from './TrackedCoinsPanel'
import { Empty, Panel } from './ui'

type Tab = 'trade' | 'autopilot' | 'explorer' | 'connections' | 'users'

const TABS: { id: Tab; label: string; adminOnly?: boolean }[] = [
  { id: 'trade', label: 'Trade desk' },
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
  const activityRef = useRef<ActivityHandle>(null)

  const notifyActivity = () => activityRef.current?.reload()

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
