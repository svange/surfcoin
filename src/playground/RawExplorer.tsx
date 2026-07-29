import { useState } from 'react'
import type { RawProxyResponse } from '../../shared/types'
import { Button, Field, inputClass, Panel } from './ui'
import { useApi } from './useApi'

const HOSTS = [
  { id: 'frontend', label: 'frontend-api-v3' },
  { id: 'swap', label: 'swap-api' },
  { id: 'advanced', label: 'advanced-api-v2' },
]

/** {x} is filled from the "Mint / address" box (a mint, or a wallet for balances). */
const PRESETS = [
  { host: 'frontend', path: '/coins?offset=0&limit=10&sort=created_timestamp&order=DESC', label: 'newest coins' },
  { host: 'advanced', path: '/coins/list?sortBy=marketCap&limit=10', label: 'top by mcap' },
  { host: 'frontend', path: '/sol-price', label: 'SOL price' },
  { host: 'frontend', path: '/coins/{x}', label: 'coin details', needsParam: true },
  { host: 'swap', path: '/v1/coins/{x}/candles?interval=1m&limit=60&currency=USD', label: 'candles', needsParam: true },
  { host: 'swap', path: '/v2/coins/{x}/trades?limit=30', label: 'recent trades', needsParam: true },
  { host: 'frontend', path: '/balances/{x}?limit=100&offset=0&minBalance=-1', label: 'wallet balances', needsParam: true },
]

/**
 * Raw pump.fun API explorer. GET-only, host-restricted, routed through the
 * Lambda (browsers can't call pump.fun cross-origin — Cloudflare 403s). This
 * is the "see everything the API exposes" learning surface.
 */
export function RawExplorer() {
  const api = useApi()
  const [host, setHost] = useState('frontend')
  const [path, setPath] = useState('/coins?offset=0&limit=5&sort=created_timestamp&order=DESC')
  const [param, setParam] = useState('')
  const [busy, setBusy] = useState(false)
  const [res, setRes] = useState<RawProxyResponse | null>(null)
  const [err, setErr] = useState<string | null>(null)

  async function run() {
    setBusy(true)
    setErr(null)
    try {
      const r = await api<RawProxyResponse>(
        `/pump/raw?host=${host}&path=${encodeURIComponent(path)}`,
      )
      setRes(r)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'request failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Panel title="Raw API explorer">
      <p className="mb-3 font-mono text-[11px] text-seafoam/60">
        Poke pump.fun's public data APIs directly — this is where the numbers on every other tab
        come from. GET-only and read-only, proxied through the Lambda because pump.fun blocks
        browser calls.
      </p>

      <div className="flex flex-wrap gap-2">
        {PRESETS.map(p => (
          <button
            key={p.label}
            type="button"
            disabled={p.needsParam && !param.trim()}
            title={p.needsParam && !param.trim() ? 'fill in Mint / address first' : undefined}
            onClick={() => {
              setHost(p.host)
              setPath(p.path.replace('{x}', param.trim()))
            }}
            className="rounded-full border border-seafoam/25 px-3 py-1 font-mono text-[10px] text-seafoam/70 hover:border-golden hover:text-golden disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-seafoam/25 disabled:hover:text-seafoam/70"
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-[160px_1fr]">
        <Field label="Host">
          <select className={inputClass} value={host} onChange={e => setHost(e.target.value)}>
            {HOSTS.map(h => (
              <option key={h.id} value={h.id}>
                {h.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Path">
          <input
            className={inputClass}
            value={path}
            onChange={e => setPath(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && run()}
          />
        </Field>
        <div className="sm:col-span-2">
          <Field
            label="Mint / address"
            hint="unlocks the per-coin presets — a coin mint, or a wallet address for balances"
          >
            <input
              className={inputClass}
              value={param}
              onChange={e => setParam(e.target.value)}
              placeholder="paste a mint from the Trade desk, or a wallet address"
            />
          </Field>
        </div>
      </div>
      <Button className="mt-3" onClick={run} disabled={busy}>
        {busy ? 'fetching…' : 'GET'}
      </Button>

      <details className="mt-3">
        <summary className="cursor-pointer font-mono text-[10px] text-seafoam/60 hover:text-seafoam">
          known endpoints
        </summary>
        <div className="mt-2 space-y-1 font-mono text-[10px] text-seafoam/50">
          <p>{'frontend-api-v3 · /coins · /coins/{mint} · /balances/{address} · /sol-price'}</p>
          <p>{'swap-api · /v1/coins/{mint}/candles?interval=1m&limit=60&currency=USD · /v2/coins/{mint}/trades?limit=30'}</p>
          <p>{'advanced-api-v2 · /coins/list?sortBy=marketCap&limit=10'}</p>
          <p className="text-seafoam/40">
            probed 2026-07-20 — undocumented APIs, pump.fun reshuffles them without notice
          </p>
        </div>
      </details>

      {err && <p className="mt-3 font-mono text-[11px] text-coral">{err}</p>}
      {res && (
        <div className="mt-3">
          <p className="font-mono text-[10px] text-seafoam/60">
            HTTP {res.status} · {res.path}
          </p>
          <pre className="mt-1 max-h-96 overflow-auto rounded-lg border border-seafoam/15 bg-night/80 p-3 font-mono text-[10px] text-seafoam/80">
            {JSON.stringify(res.body, null, 2)}
          </pre>
        </div>
      )}
    </Panel>
  )
}
