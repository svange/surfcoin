import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import {
  beginLogin,
  completeLoginIfCallback,
  currentTokens,
  idTokenClaims,
  signOut,
  type Tokens,
} from './auth'

interface AuthState {
  status: 'loading' | 'signed-out' | 'signed-in'
  email: string | null
  /** Fresh bearer token for API calls; refreshes itself when expired. */
  getAccessToken: () => Promise<string | null>
  login: () => void
  logout: () => void
}

const AuthCtx = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthState['status']>('loading')
  const [email, setEmail] = useState<string | null>(null)

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
      if (tokens) {
        setEmail(idTokenClaims(tokens).email ?? null)
        setStatus('signed-in')
      } else {
        setStatus('signed-out')
      }
    }
    boot()
    return () => {
      cancelled = true
    }
  }, [])

  const value: AuthState = {
    status,
    email,
    getAccessToken: async () => {
      const t = await currentTokens()
      if (!t) setStatus('signed-out')
      return t?.accessToken ?? null
    },
    login: () => {
      beginLogin()
    },
    logout: () => {
      setStatus('signed-out')
      setEmail(null)
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
