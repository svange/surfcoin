import { useState } from 'react'
import type { LinkWalletRequest, MeResponse, NonceResponse } from '../../shared/types'
import { toast } from '../lib/toast'
import { truncateAddress } from '../lib/format'
import { Button, Field, inputClass, Panel, Toggle } from './ui'
import { useApi } from './useApi'
import { connectWallet, detectWallets, signMessage } from './wallet'

/**
 * The "link with one button" surface. Solana has no OAuth, so linking is a
 * wallet-signature handshake: fetch a server nonce, sign it in Phantom, send
 * the signature back. The Lightning key is a separate paste-in — it is what
 * actually authorizes trades.
 */
export function LinkPanel({ me, onChange }: { me: MeResponse; onChange: (me: MeResponse) => void }) {
  return (
    <div className="grid gap-5 md:grid-cols-2">
      <WalletLink me={me} onChange={onChange} />
      <PumpPortalLink me={me} onChange={onChange} />
      <TradingSettings me={me} onChange={onChange} />
    </div>
  )
}

function WalletLink({ me, onChange }: { me: MeResponse; onChange: (me: MeResponse) => void }) {
  const api = useApi()
  const [busy, setBusy] = useState(false)

  async function link() {
    setBusy(true)
    try {
      const wallets = detectWallets()
      if (!wallets.length) {
        toast('No Solana wallet found — install Phantom')
        return
      }
      const { provider, name } = wallets[0]
      const address = await connectWallet(provider)
      const nonce = await api<NonceResponse>(`/wallet/nonce?address=${address}`)
      const signatureB64 = await signMessage(provider, nonce.message)
      const body: LinkWalletRequest = { address, signatureB64, nonce: nonce.nonce }
      const updated = await api<MeResponse>('/wallet/link', { method: 'POST', body })
      onChange(updated)
      toast(`${name} linked`)
    } catch (e) {
      toast(e instanceof Error ? e.message : 'link failed')
    } finally {
      setBusy(false)
    }
  }

  async function unlink() {
    try {
      onChange(await api<MeResponse>('/wallet/link', { method: 'DELETE' }))
      toast('wallet unlinked')
    } catch (e) {
      toast(e instanceof Error ? e.message : 'unlink failed')
    }
  }

  return (
    <Panel title="Solana wallet">
      {me.wallet ? (
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="font-mono text-sm text-seafoam">{truncateAddress(me.wallet.address, 6)}</p>
            <p className="font-mono text-[10px] text-seafoam/50">
              linked {new Date(me.wallet.linkedAt).toLocaleDateString()}
            </p>
          </div>
          <Button variant="ghost" onClick={unlink}>
            unlink
          </Button>
        </div>
      ) : (
        <>
          <p className="mb-4 font-mono text-xs text-seafoam/70">
            Connect a wallet and sign a message (no transaction, no fees) to show your coins and
            portfolio. Read-only — signing here never spends.
          </p>
          <Button onClick={link} disabled={busy}>
            {busy ? 'check your wallet…' : 'Connect wallet'}
          </Button>
        </>
      )}
    </Panel>
  )
}

function PumpPortalLink({ me, onChange }: { me: MeResponse; onChange: (me: MeResponse) => void }) {
  const api = useApi()
  const [apiKey, setApiKey] = useState('')
  const [pubkey, setPubkey] = useState('')
  const [busy, setBusy] = useState(false)

  async function save() {
    setBusy(true)
    try {
      const updated = await api<MeResponse>('/pumpportal', {
        method: 'PUT',
        body: { apiKey: apiKey.trim(), walletPublicKey: pubkey.trim() || undefined },
      })
      onChange(updated)
      setApiKey('')
      setPubkey('')
      toast('Lightning key linked')
    } catch (e) {
      toast(e instanceof Error ? e.message : 'link failed')
    } finally {
      setBusy(false)
    }
  }

  async function unlink() {
    try {
      onChange(await api<MeResponse>('/pumpportal', { method: 'DELETE' }))
      toast('Lightning key removed')
    } catch (e) {
      toast(e instanceof Error ? e.message : 'could not remove key')
    }
  }

  return (
    <Panel title="PumpPortal Lightning key">
      {me.pumpPortal ? (
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="font-mono text-sm text-seafoam">key stored (encrypted)</p>
            {me.pumpPortal.walletPublicKey && (
              <p className="font-mono text-[10px] text-seafoam/50">
                wallet {truncateAddress(me.pumpPortal.walletPublicKey, 6)}
              </p>
            )}
          </div>
          <Button variant="danger" onClick={unlink}>
            remove
          </Button>
        </div>
      ) : (
        <>
          <p className="mb-3 font-mono text-xs text-seafoam/70">
            Trading uses a{' '}
            <a
              href="https://pumpportal.fun/trading-api/setup"
              target="_blank"
              rel="noopener noreferrer"
              className="text-golden underline"
            >
              PumpPortal Lightning key
            </a>
            . Stored KMS-encrypted, never shown again. It authorizes trades from its own funded
            wallet.
          </p>
          <div className="space-y-3">
            <Field label="API key">
              <input
                className={inputClass}
                value={apiKey}
                onChange={e => setApiKey(e.target.value)}
                placeholder="paste your PumpPortal API key"
                type="password"
              />
            </Field>
            <Field label="Lightning wallet pubkey" hint="optional — for display only">
              <input
                className={inputClass}
                value={pubkey}
                onChange={e => setPubkey(e.target.value)}
                placeholder="base58 address"
              />
            </Field>
            <Button onClick={save} disabled={busy || apiKey.trim().length < 1}>
              {busy ? 'saving…' : 'Link Lightning key'}
            </Button>
          </div>
        </>
      )}
    </Panel>
  )
}

function TradingSettings({ me, onChange }: { me: MeResponse; onChange: (me: MeResponse) => void }) {
  const api = useApi()

  async function set(patch: Partial<MeResponse['settings']>) {
    try {
      const updated = await api<MeResponse>('/settings', { method: 'PUT', body: patch })
      onChange(updated)
    } catch (e) {
      // toggle stays bound to server-confirmed me.settings, so a failure just
      // leaves the switch where it was — tell the user why.
      toast(e instanceof Error ? e.message : 'could not update setting')
    }
  }

  return (
    <Panel title="Safety" className="md:col-span-2">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <Toggle
            checked={me.settings.liveTrading}
            onChange={v => set({ liveTrading: v })}
            label={me.settings.liveTrading ? 'LIVE trading armed' : 'Dry-run only (safe)'}
            danger
          />
          <p className="font-mono text-[10px] text-seafoam/50">
            Off = Lightning trades and fee claims run as dry runs; wallet-signed trades are
            refused (no dry-run form). The master safety.
          </p>
        </div>
        <div className="space-y-1">
          <Toggle
            checked={me.settings.autopilotEnabled}
            onChange={v => set({ autopilotEnabled: v })}
            label={me.settings.autopilotEnabled ? 'Autopilot on' : 'Autopilot off'}
          />
          <p className="font-mono text-[10px] text-seafoam/50">
            Lets rules fire on the 1-min tick. Still needs LIVE armed to place real orders.
          </p>
        </div>
      </div>
    </Panel>
  )
}
