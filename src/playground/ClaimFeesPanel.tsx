import { useState } from 'react'
import type { MeResponse, TradeResponse } from '../../shared/types'
import { toast } from '../lib/toast'
import { Button, Field, inputClass, Panel, TradeResult } from './ui'
import { useApi } from './useApi'

/**
 * Claim pump.fun creator fees through the Lightning key. Fees follow the
 * on-chain creator, so this only collects for coins the Lightning wallet
 * created; coins launched with another wallet are claimed on pump.fun itself.
 */
export function ClaimFeesPanel({ me }: { me: MeResponse }) {
  const api = useApi()
  const [pool, setPool] = useState<'pump' | 'meteora-dbc'>('pump')
  const [mint, setMint] = useState('')
  const [priorityFee, setPriorityFee] = useState('0.00005')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<TradeResponse | null>(null)

  const canClaim = !!me.pumpPortal
  const liveArmed = me.settings.liveTrading
  const profileUrl = me.wallet
    ? `https://pump.fun/profile/${me.wallet.address}`
    : 'https://pump.fun/profile'

  async function claim(dryRun: boolean) {
    setBusy(true)
    setResult(null)
    try {
      const res = await api<TradeResponse>('/claim-fees', {
        method: 'POST',
        body: {
          pool,
          priorityFee: Number(priorityFee),
          mint: pool === 'meteora-dbc' ? mint.trim() || undefined : undefined,
          dryRun,
        },
      })
      setResult(res)
      if (!res.dryRun && res.ok) toast('claim sent')
    } catch (e) {
      toast(e instanceof Error ? e.message : 'claim failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Panel title="Creator fees">
      <p className="mb-4 font-mono text-[11px] text-seafoam/60">
        pump.fun pays coin creators a cut of every trade. This claims through your Lightning key,
        so it only collects for coins the Lightning wallet created. Coins you launched with another
        wallet are claimed on your{' '}
        <a
          href={profileUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-golden underline"
        >
          pump.fun profile
        </a>{' '}
        instead.
      </p>

      <div className="grid grid-cols-2 gap-3">
        <Field
          label="Pool"
          hint={pool === 'pump' ? 'claims all your pump coins at once' : 'needs the coin mint'}
        >
          <select
            className={inputClass}
            value={pool}
            onChange={e => setPool(e.target.value as 'pump' | 'meteora-dbc')}
          >
            <option value="pump">pump</option>
            <option value="meteora-dbc">meteora-dbc</option>
          </select>
        </Field>
        <Field label="Priority fee (SOL)">
          <input
            className={inputClass}
            value={priorityFee}
            onChange={e => setPriorityFee(e.target.value)}
          />
        </Field>
        {pool === 'meteora-dbc' && (
          <div className="col-span-2">
            <Field label="Mint">
              <input
                className={inputClass}
                value={mint}
                onChange={e => setMint(e.target.value)}
                placeholder="mint address"
              />
            </Field>
          </div>
        )}
      </div>

      {!canClaim && (
        <p className="mt-3 rounded-lg border border-coral/30 bg-coral/5 p-2 font-mono text-[10px] text-coral">
          Link a PumpPortal Lightning key to claim. You can still dry-run.
        </p>
      )}

      <div className="my-4 flex flex-wrap gap-2">
        <Button
          variant="ghost"
          onClick={() => claim(true)}
          disabled={busy || (pool === 'meteora-dbc' && !mint.trim())}
        >
          Dry run
        </Button>
        {/* When this client believes LIVE is off, ask for a dry run outright —
            the server never upgrades one, so a stale tab can't fire for real. */}
        <Button
          onClick={() => claim(!liveArmed)}
          disabled={busy || !canClaim || (pool === 'meteora-dbc' && !mint.trim())}
          title={!liveArmed ? 'LIVE is off — this will simulate' : undefined}
        >
          {liveArmed ? 'Claim fees' : 'Claim (dry — arm LIVE)'}
        </Button>
      </div>

      {result && <TradeResult result={result} />}
    </Panel>
  )
}
