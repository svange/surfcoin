import { useState } from 'react'
import type { RawProxyResponse } from '../../shared/types'
import { Button, Field, inputClass, Panel } from './ui'
import { useApi } from './useApi'

const HOSTS = [
  { id: 'frontend', label: 'frontend-api-v3' },
  { id: 'swap', label: 'swap-api' },
  { id: 'advanced', label: 'advanced-api-v2' },
]

const PRESETS = [
  { host: 'frontend', path: '/coins?offset=0&limit=10&sort=created_timestamp&order=DESC', label: 'newest coins' },
  { host: 'frontend', path: '/sol-price', label: 'SOL price' },
  { host: 'advanced', path: '/coins/list?sortBy=marketCap&limit=10', label: 'top by mcap' },
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
      <div className="flex flex-wrap gap-2">
        {PRESETS.map(p => (
          <button
            key={p.label}
            type="button"
            onClick={() => {
              setHost(p.host)
              setPath(p.path)
            }}
            className="rounded-full border border-seafoam/25 px-3 py-1 font-mono text-[10px] text-seafoam/70 hover:border-golden hover:text-golden"
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
      </div>
      <Button className="mt-3" onClick={run} disabled={busy}>
        {busy ? 'fetching…' : 'GET'}
      </Button>

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
