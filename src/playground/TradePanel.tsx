import { useState } from 'react'
import type {
  MeResponse,
  Pool,
  PumpCoin,
  TradeBuildResponse,
  TradeResponse,
} from '../../shared/types'
import { toast } from '../lib/toast'
import { Button, Field, inputClass, TradeResult } from './ui'
import { useApi } from './useApi'
import { base64FromBytes, detectWallets } from './wallet'

const POOLS: Pool[] = ['auto', 'pump', 'pump-amm', 'raydium', 'bonk']

/**
 * Manual trade ticket. Two execution modes:
 *  - Lightning: server signs with the stored key (fast, custodial to that key)
 *  - Local wallet: server returns an unsigned tx, the browser wallet signs it,
 *    server relays it (keys stay in the wallet)
 * A dry run just echoes the exact upstream request without sending. LIVE off
 * downgrades Lightning sends to dry runs; wallet-signed trades have no dry-run
 * form, so the backend refuses them outright until LIVE is armed.
 */
export function TradePanel({
  coin,
  me,
  onActivity,
}: {
  coin: PumpCoin
  me: MeResponse
  onActivity: () => void
}) {
  const api = useApi()
  const [action, setAction] = useState<'buy' | 'sell'>('buy')
  const [amount, setAmount] = useState('0.01')
  const [denomSol, setDenomSol] = useState(true)
  const [slippage, setSlippage] = useState('10')
  const [priorityFee, setPriorityFee] = useState('0.00005')
  const [pool, setPool] = useState<Pool>('auto')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<TradeResponse | null>(null)

  const params = () => ({
    action,
    mint: coin.mint,
    amount: /%$/.test(amount) ? amount : Number(amount),
    denominatedInSol: action === 'sell' ? false : denomSol,
    slippage: Number(slippage),
    priorityFee: Number(priorityFee),
    pool,
    symbol: coin.symbol,
  })

  async function lightning(dryRun: boolean) {
    setBusy(true)
    setResult(null)
    try {
      const res = await api<TradeResponse>('/trade', { method: 'POST', body: { ...params(), dryRun } })
      setResult(res)
      onActivity()
      if (!dryRun && res.ok) toast('order sent')
    } catch (e) {
      toast(e instanceof Error ? e.message : 'trade failed')
    } finally {
      setBusy(false)
    }
  }

  async function localWallet() {
    if (!me.settings.liveTrading) {
      toast('LIVE is off — wallet-signed orders move real SOL. Arm LIVE in Safety, or Dry run to preview.')
      return
    }
    setBusy(true)
    setResult(null)
    try {
      const wallets = detectWallets()
      if (!wallets.length) {
        toast('no wallet found')
        return
      }
      const provider = wallets[0].provider
      // Always connect and build for the ACTUALLY connected account — the
      // wallet may be on a different account than the one linked, and the
      // backend relay requires the fee-payer to match the signer.
      const pubkey = (await provider.connect()).publicKey.toString()
      if (me.wallet && pubkey !== me.wallet.address) {
        toast('connected wallet differs from your linked wallet — switch accounts or re-link')
        return
      }
      const { txBase64 } = await api<TradeBuildResponse>('/trade/build', {
        method: 'POST',
        body: { ...params(), publicKey: pubkey },
      })
      // deserialize → sign → serialize, using the wallet's own tx handling
      const bytes = Uint8Array.from(atob(txBase64), c => c.charCodeAt(0))
      if (!provider.signTransaction) {
        toast('wallet cannot sign transactions')
        return
      }
      const { VersionedTransaction } = await import('@solana/web3.js')
      const tx = VersionedTransaction.deserialize(bytes)
      const signed = (await provider.signTransaction(tx)) as InstanceType<typeof VersionedTransaction>
      const signedB64 = base64FromBytes(signed.serialize())
      const res = await api<{ signature: string }>('/trade/submit', {
        method: 'POST',
        body: {
          signedTxBase64: signedB64,
          mint: coin.mint,
          symbol: coin.symbol,
          summary: `${action} ${amount} of ${coin.symbol} (wallet-signed)`,
        },
      })
      setResult({ ok: true, dryRun: false, signature: res.signature, sent: params(), error: null })
      onActivity()
      toast('wallet-signed order sent')
    } catch (e) {
      toast(e instanceof Error ? e.message : 'local trade failed')
    } finally {
      setBusy(false)
    }
  }

  const canTrade = !!me.pumpPortal
  const liveArmed = me.settings.liveTrading

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {(['buy', 'sell'] as const).map(a => (
          <button
            key={a}
            type="button"
            onClick={() => setAction(a)}
            className={`flex-1 rounded-lg py-2 font-mono text-sm font-bold uppercase transition-colors ${
              action === a
                ? a === 'buy'
                  ? 'bg-seafoam text-night'
                  : 'bg-coral text-night'
                : 'border border-seafoam/25 text-seafoam/70'
            }`}
          >
            {a}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field
          label={action === 'sell' ? 'Amount (tokens or %)' : denomSol ? 'Amount (SOL)' : 'Amount (tokens)'}
          hint={action === 'sell' ? 'e.g. 100% to dump all' : undefined}
        >
          <input className={inputClass} value={amount} onChange={e => setAmount(e.target.value)} />
        </Field>
        <Field label="Pool">
          <select className={inputClass} value={pool} onChange={e => setPool(e.target.value as Pool)}>
            {POOLS.map(p => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Slippage %">
          <input className={inputClass} value={slippage} onChange={e => setSlippage(e.target.value)} />
        </Field>
        <Field label="Priority fee (SOL)">
          <input
            className={inputClass}
            value={priorityFee}
            onChange={e => setPriorityFee(e.target.value)}
          />
        </Field>
      </div>

      {action === 'buy' && (
        <label className="flex items-center gap-2 font-mono text-[11px] text-seafoam/70">
          <input type="checkbox" checked={denomSol} onChange={e => setDenomSol(e.target.checked)} />
          amount is denominated in SOL
        </label>
      )}

      {!canTrade && (
        <p className="rounded-lg border border-coral/30 bg-coral/5 p-2 font-mono text-[10px] text-coral">
          Link a PumpPortal Lightning key to place orders. You can still dry-run.
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <Button variant="ghost" onClick={() => lightning(true)} disabled={busy}>
          Dry run
        </Button>
        {/* When this client believes LIVE is off, ask for a dry run outright —
            the server never upgrades one, so a stale tab can't fire for real. */}
        <Button
          variant={action === 'buy' ? 'primary' : 'sell'}
          onClick={() => lightning(!liveArmed)}
          disabled={busy || !canTrade}
          title={!liveArmed ? 'LIVE is off — this will simulate' : undefined}
        >
          {liveArmed ? `${action} via Lightning` : `${action} (dry — arm LIVE)`}
        </Button>
        {me.wallet && (
          <Button
            variant="ghost"
            onClick={localWallet}
            disabled={busy}
            title={!liveArmed ? 'LIVE is off — wallet-signed trades are always real, so they wait' : undefined}
          >
            {liveArmed ? `${action} with my wallet` : `${action} with wallet (arm LIVE)`}
          </Button>
        )}
      </div>

      {result && <TradeResult result={result} />}
    </div>
  )
}
