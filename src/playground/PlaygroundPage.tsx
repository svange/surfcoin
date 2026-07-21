import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import type { MeResponse } from '../../shared/types'
import { Toaster } from '../lib/toast'
import { AuthProvider, useAuth } from './AuthContext'
import { Dashboard } from './Dashboard'
import { isPlaygroundConfigured } from './runtime'
import { Spinner } from './ui'
import { ApiError, useApi } from './useApi'

function SignedOut() {
  const { login } = useAuth()
  return (
    <div className="mx-auto max-w-xl px-4 py-24 text-center">
      <h1 className="font-display text-4xl text-golden sm:text-5xl">The Shaping Bay</h1>
      <p className="mt-4 font-mono text-sm text-seafoam">
        The back room where $SURF meets the pump.fun API. A safe, controlled place to link your
        wallet, watch your coins, and play with every knob the API exposes — dry-run by default.
      </p>
      <button
        type="button"
        onClick={login}
        disabled={!isPlaygroundConfigured}
        className="mt-8 rounded-full bg-burnt px-6 py-2.5 font-bold text-salt transition-colors hover:bg-dusk disabled:opacity-40"
      >
        Sign in / sign up
      </button>
      {!isPlaygroundConfigured && (
        <p className="mt-4 font-mono text-xs text-coral">
          backend stack not deployed yet — run scripts/deploy-playground.sh
        </p>
      )}
    </div>
  )
}

/**
 * Signed in but not yet in the `approved` group. Approval lands in the token
 * only on refresh, so poll (and offer a button) until the claim shows up.
 */
function PendingApproval() {
  const { email, logout, recheckApproval } = useAuth()
  const [checking, setChecking] = useState(false)

  async function recheck() {
    setChecking(true)
    try {
      await recheckApproval()
    } finally {
      setChecking(false)
    }
  }

  useEffect(() => {
    const id = setInterval(() => {
      recheckApproval().catch(() => {})
    }, 60_000)
    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <>
      <TopBar email={email} onLogout={logout} />
      <div className="mx-auto max-w-xl px-4 py-24 text-center">
        <h1 className="font-display text-4xl text-golden">Waiting on the tide</h1>
        <p className="mt-4 font-mono text-sm text-seafoam">
          Your account is pending approval. The shaper has to wave you into the bay before you can
          paddle out — check back soon.
        </p>
        <button
          type="button"
          onClick={recheck}
          disabled={checking}
          className="mt-8 rounded-full border border-seafoam/40 px-6 py-2.5 font-mono text-xs text-seafoam transition-colors hover:bg-seafoam/10 disabled:opacity-40"
        >
          {checking ? 'checking…' : 'check again'}
        </button>
      </div>
    </>
  )
}

function LoadMe() {
  const api = useApi()
  const { email, logout } = useAuth()
  const [me, setMe] = useState<MeResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  useEffect(() => {
    let cancelled = false
    api<MeResponse>('/me')
      .then(m => !cancelled && setMe(m))
      .catch((e: unknown) => {
        if (cancelled) return
        // Token says approved but the backend disagrees (revoked, stale claim
        // handling drift) — show the pending view rather than a raw error.
        if (e instanceof ApiError && e.status === 403) setPending(true)
        else setError(e instanceof Error ? e.message : String(e))
      })
    return () => {
      cancelled = true
    }
  }, [api])

  if (pending) return <PendingApproval />

  return (
    <>
      <TopBar email={email} onLogout={logout} />
      {error ? (
        <p className="py-24 text-center font-mono text-sm text-coral">
          couldn't reach the backend — {error}
        </p>
      ) : !me ? (
        <Spinner label="loading your locker…" />
      ) : (
        <Dashboard me={me} onMe={setMe} />
      )}
    </>
  )
}

function TopBar({ email, onLogout }: { email: string | null; onLogout: () => void }) {
  return (
    <header className="border-b border-seafoam/15">
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link to="/" className="font-display text-xl text-golden">
          SURF <span className="font-mono text-xs text-seafoam/60">← back to the beach</span>
        </Link>
        <div className="flex items-center gap-4">
          {email && <span className="hidden font-mono text-xs text-seafoam sm:inline">{email}</span>}
          <button
            type="button"
            onClick={onLogout}
            className="rounded-full border border-seafoam/40 px-4 py-1.5 font-mono text-xs text-seafoam hover:bg-seafoam/10"
          >
            sign out
          </button>
        </div>
      </nav>
    </header>
  )
}

function Gate() {
  const { status, isApproved } = useAuth()
  if (status === 'loading') {
    return <p className="py-24 text-center font-mono text-sm text-seafoam">checking the tide…</p>
  }
  if (status !== 'signed-in') return <SignedOut />
  return isApproved ? <LoadMe /> : <PendingApproval />
}

export default function PlaygroundPage() {
  return (
    <AuthProvider>
      <div className="min-h-screen bg-night text-salt">
        <Gate />
      </div>
      <Toaster />
    </AuthProvider>
  )
}
