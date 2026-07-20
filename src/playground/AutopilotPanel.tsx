import { useState } from 'react'
import type { AutopilotRule, PumpCoin, RuleInput, RuleTrigger } from '../../shared/types'
import { formatUsd, truncateAddress } from '../lib/format'
import { toast } from '../lib/toast'
import { Button, Empty, Field, inputClass, Panel, Spinner } from './ui'
import { useApi, useQuery } from './useApi'

const TRIGGERS: { kind: RuleTrigger['kind']; label: string }[] = [
  { kind: 'price-below', label: 'price falls to' },
  { kind: 'price-above', label: 'price rises to' },
  { kind: 'mcap-below', label: 'mcap falls to' },
  { kind: 'mcap-above', label: 'mcap rises to' },
]

export function AutopilotPanel({ seed }: { seed: PumpCoin | null }) {
  const api = useApi()
  const rules = useQuery<AutopilotRule[]>('/rules')
  const [showForm, setShowForm] = useState(false)

  async function remove(id: string) {
    try {
      await api(`/rules/${id}`, { method: 'DELETE' })
      rules.reload()
      toast('rule deleted')
    } catch (e) {
      toast(e instanceof Error ? e.message : 'delete failed')
    }
  }

  async function toggle(rule: AutopilotRule) {
    try {
      await api(`/rules/${rule.id}`, { method: 'PUT', body: { enabled: !rule.enabled } })
      rules.reload()
    } catch (e) {
      toast(e instanceof Error ? e.message : 'could not toggle rule')
    }
  }

  return (
    <Panel
      title="Autopilot rules"
      right={
        <Button variant="ghost" onClick={() => setShowForm(v => !v)}>
          {showForm ? 'close' : '+ new rule'}
        </Button>
      }
    >
      <p className="mb-4 font-mono text-[11px] text-seafoam/60">
        Each rule is checked once a minute against live pump.fun data. It only places a real order
        when both <span className="text-seafoam">Autopilot</span> and{' '}
        <span className="text-coral">LIVE</span> are armed in Safety — otherwise it logs a dry run.
      </p>

      {(showForm || seed) && (
        <RuleForm
          seed={seed}
          onCreated={() => {
            setShowForm(false)
            rules.reload()
          }}
        />
      )}

      {rules.loading && !rules.data ? (
        <Spinner />
      ) : rules.data && rules.data.length > 0 ? (
        <ul className="mt-4 space-y-2">
          {rules.data.map(r => (
            <li
              key={r.id}
              className="flex items-center justify-between gap-3 rounded-lg border border-seafoam/15 bg-night/40 p-3"
            >
              <div className="min-w-0">
                <p className="font-mono text-xs text-salt">
                  <span className={r.trade.action === 'buy' ? 'text-seafoam' : 'text-coral'}>
                    {r.trade.action}
                  </span>{' '}
                  {String(r.trade.amount)}
                  {r.trade.denominatedInSol ? ' SOL' : ''} of {r.symbol}
                </p>
                <p className="font-mono text-[10px] text-seafoam/60">
                  when {TRIGGERS.find(t => t.kind === r.trigger.kind)?.label}{' '}
                  {formatUsd(r.trigger.usd)} · {truncateAddress(r.mint, 4)}
                  {r.oneShot ? ' · one-shot' : ' · repeating'}
                </p>
                <p className="font-mono text-[10px] text-seafoam/40">
                  fired {r.fireCount}×
                  {r.lastObserved &&
                    ` · last seen ${r.lastObserved.priceUsd !== null ? formatUsd(r.lastObserved.priceUsd) : '—'}`}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  onClick={() => toggle(r)}
                  className={`font-mono text-[10px] ${r.enabled ? 'text-seafoam' : 'text-seafoam/40'}`}
                >
                  {r.enabled ? 'on' : 'off'}
                </button>
                <button
                  type="button"
                  onClick={() => remove(r.id)}
                  className="font-mono text-[10px] text-coral/70 hover:text-coral"
                >
                  delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        !showForm && !seed && <Empty>no rules yet — the water's calm</Empty>
      )}
    </Panel>
  )
}

function RuleForm({ seed, onCreated }: { seed: PumpCoin | null; onCreated: () => void }) {
  const api = useApi()
  const [mint, setMint] = useState(seed?.mint ?? '')
  const [symbol, setSymbol] = useState(seed?.symbol ?? '')
  const [triggerKind, setTriggerKind] = useState<RuleTrigger['kind']>('price-below')
  const [threshold, setThreshold] = useState('')
  const [action, setAction] = useState<'buy' | 'sell'>('buy')
  const [amount, setAmount] = useState('0.01')
  const [oneShot, setOneShot] = useState(true)
  const [busy, setBusy] = useState(false)

  async function create() {
    setBusy(true)
    try {
      const denominatedInSol = action === 'buy'
      const rule: RuleInput = {
        mint: mint.trim(),
        symbol: symbol.trim().toUpperCase(),
        trigger: { kind: triggerKind, usd: Number(threshold) } as RuleTrigger,
        trade: {
          action,
          mint: mint.trim(),
          amount: /%$/.test(amount) ? amount : Number(amount),
          denominatedInSol,
          slippage: 10,
          priorityFee: 0.00005,
          pool: 'auto',
        },
        oneShot,
        enabled: true,
      }
      await api('/rules', { method: 'POST', body: rule })
      toast('rule created')
      onCreated()
    } catch (e) {
      toast(e instanceof Error ? e.message : 'could not create rule')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="rounded-lg border border-golden/30 bg-golden/5 p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Mint">
          <input className={inputClass} value={mint} onChange={e => setMint(e.target.value)} />
        </Field>
        <Field label="Symbol">
          <input className={inputClass} value={symbol} onChange={e => setSymbol(e.target.value)} />
        </Field>
        <Field label="Trigger">
          <select
            className={inputClass}
            value={triggerKind}
            onChange={e => setTriggerKind(e.target.value as RuleTrigger['kind'])}
          >
            {TRIGGERS.map(t => (
              <option key={t.kind} value={t.kind}>
                {t.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Threshold (USD)">
          <input
            className={inputClass}
            value={threshold}
            onChange={e => setThreshold(e.target.value)}
            placeholder="0.00005"
          />
        </Field>
        <Field label="Then">
          <select
            className={inputClass}
            value={action}
            onChange={e => setAction(e.target.value as 'buy' | 'sell')}
          >
            <option value="buy">buy (SOL)</option>
            <option value="sell">sell (tokens / %)</option>
          </select>
        </Field>
        <Field label="Amount">
          <input className={inputClass} value={amount} onChange={e => setAmount(e.target.value)} />
        </Field>
      </div>
      <label className="mt-3 flex items-center gap-2 font-mono text-[11px] text-seafoam/70">
        <input type="checkbox" checked={oneShot} onChange={e => setOneShot(e.target.checked)} />
        one-shot (disable after it fires once)
      </label>
      <Button
        className="mt-3"
        onClick={create}
        disabled={busy || !mint.trim() || !symbol.trim() || !threshold}
      >
        {busy ? 'saving…' : 'Create rule'}
      </Button>
    </div>
  )
}
