import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import type { RegistryResponse } from '../../shared/types'
import { truncateAddress } from '../lib/format'
import { toast } from '../lib/toast'
import { Button, Field, inputClass, Panel } from './ui'
import { useApi } from './useApi'

/**
 * Owner-managed registry of coins featured on the public /coins page. First
 * user to save claims ownership; afterwards only they can change it.
 */
export function TrackedCoinsPanel() {
  const api = useApi()
  const [reg, setReg] = useState<RegistryResponse | null>(null)
  const [creator, setCreator] = useState('')
  const [mintInput, setMintInput] = useState('')
  const [mints, setMints] = useState<string[]>([])
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    api<RegistryResponse>('/registry')
      .then(r => {
        setReg(r)
        setCreator(r.creatorWallet ?? '')
        setMints(r.mints)
      })
      .catch(e => toast(e instanceof Error ? e.message : 'could not load registry'))
  }, [api])

  const readOnly = !!reg && reg.claimed && !reg.isOwner

  function addMint() {
    const m = mintInput.trim()
    if (!m || mints.includes(m)) {
      setMintInput('')
      return
    }
    setMints([...mints, m])
    setMintInput('')
  }

  async function save() {
    setBusy(true)
    try {
      const r = await api<RegistryResponse>('/registry', {
        method: 'PUT',
        body: { creatorWallet: creator.trim() || null, mints },
      })
      setReg(r)
      setMints(r.mints)
      toast('tracked coins saved')
    } catch (e) {
      toast(e instanceof Error ? e.message : 'save failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Panel title="Tracked coins" className="md:col-span-2">
      <p className="mb-4 font-mono text-[11px] text-seafoam/60">
        These drive the public{' '}
        <Link to="/coins" className="text-golden underline">
          /coins
        </Link>{' '}
        page. Set your pump.fun creator wallet to auto-track every coin you launch, and pin specific
        mints.
        {readOnly && (
          <span className="text-coral"> This registry is managed by another account.</span>
        )}
      </p>

      {!reg ? (
        <p className="font-mono text-xs text-seafoam/60">loading…</p>
      ) : (
        <div className="space-y-3">
          <Field
            label="Creator wallet"
            hint="every coin launched from this pump.fun wallet is tracked"
          >
            <input
              className={inputClass}
              value={creator}
              onChange={e => setCreator(e.target.value)}
              placeholder="base58 address"
              disabled={readOnly}
            />
          </Field>

          <Field label="Pinned mints" hint="feature specific coins (optional)">
            <div className="flex gap-2">
              <input
                className={inputClass}
                value={mintInput}
                onChange={e => setMintInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addMint()}
                placeholder="mint address"
                disabled={readOnly}
              />
              <Button variant="ghost" onClick={addMint} disabled={readOnly}>
                add
              </Button>
            </div>
          </Field>

          {mints.length > 0 && (
            <ul className="space-y-1">
              {mints.map(m => (
                <li
                  key={m}
                  className="flex items-center justify-between rounded border border-seafoam/15 bg-night/40 px-3 py-1.5 font-mono text-[11px]"
                >
                  <span className="text-seafoam">{truncateAddress(m, 6)}</span>
                  {!readOnly && (
                    <button
                      type="button"
                      onClick={() => setMints(mints.filter(x => x !== m))}
                      className="text-coral/70 hover:text-coral"
                    >
                      remove
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}

          {!readOnly && (
            <Button onClick={save} disabled={busy}>
              {busy ? 'saving…' : 'Save tracked coins'}
            </Button>
          )}
        </div>
      )}
    </Panel>
  )
}
