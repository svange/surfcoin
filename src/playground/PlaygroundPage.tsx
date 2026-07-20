import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import type { MeResponse } from '../../shared/types'
import { Toaster } from '../lib/toast'
import { AuthProvider, useAuth } from './AuthContext'
import { Dashboard } from './Dashboard'
import { isPlaygroundConfigured } from './runtime'
import { Spinner } from './ui'
import { useApi } from './useApi'

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

function LoadMe() {
  const api = useApi()
  const { email, logout } = useAuth()
  const [me, setMe] = useState<MeResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    api<MeResponse>('/me')
      .then(m => !cancelled && setMe(m))
      .catch((e: unknown) => !cancelled && setError(e instanceof Error ? e.message : String(e)))
    return () => {
      cancelled = true
    }
  }, [api])

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
  const { status } = useAuth()
  if (status === 'loading') {
    return <p className="py-24 text-center font-mono text-sm text-seafoam">checking the tide…</p>
  }
  return status === 'signed-in' ? <LoadMe /> : <SignedOut />
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
