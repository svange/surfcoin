import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import {
  accessTokenGroups,
  beginLogin,
  completeLoginIfCallback,
  currentTokens,
  forceRefresh,
  idTokenClaims,
  signOut,
  type Tokens,
} from './auth'

interface AuthState {
  status: 'loading' | 'signed-out' | 'signed-in'
  email: string | null
  sub: string | null
  /** cognito:groups from the access token — UI gating only, backend re-checks. */
  groups: string[]
  /** member of `approved` (or `admins`, which implies approval) */
  isApproved: boolean
  isAdmin: boolean
  /** Fresh bearer token for API calls; refreshes itself when expired. */
  getAccessToken: () => Promise<string | null>
  /** Force a token refresh to pick up a just-granted approval. */
  recheckApproval: () => Promise<void>
  login: () => void
  logout: () => void
}

const AuthCtx = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthState['status']>('loading')
  const [email, setEmail] = useState<string | null>(null)
  const [sub, setSub] = useState<string | null>(null)
  const [groups, setGroups] = useState<string[]>([])

  function applyTokens(tokens: Tokens) {
    const claims = idTokenClaims(tokens)
    setEmail(claims.email ?? null)
    setSub(claims.sub ?? null)
    setGroups(accessTokenGroups(tokens))
    setStatus('signed-in')
  }

  useEffect(() => {
    let cancelled = false
    async function boot() {
      let tokens: Tokens | null = null
      try {
        tokens = await completeLoginIfCallback()
      } catch (e) {
        console.error(e)
      }
      tokens ??= await currentTokens()
      if (cancelled) return
      if (tokens) applyTokens(tokens)
      else setStatus('signed-out')
    }
    boot()
    return () => {
      cancelled = true
    }
  }, [])

  const value: AuthState = {
    status,
    email,
    sub,
    groups,
    isApproved: groups.includes('approved') || groups.includes('admins'),
    isAdmin: groups.includes('admins'),
    getAccessToken: async () => {
      const t = await currentTokens()
      if (!t) setStatus('signed-out')
      return t?.accessToken ?? null
    },
    recheckApproval: async () => {
      const t = await forceRefresh()
      if (t) applyTokens(t)
      else setStatus('signed-out')
    },
    login: () => {
      beginLogin()
    },
    logout: () => {
      setStatus('signed-out')
      setEmail(null)
      setSub(null)
      setGroups([])
      signOut()
    },
  }

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthCtx)
  if (!ctx) throw new Error('useAuth outside <AuthProvider>')
  return ctx
}
