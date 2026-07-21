/**
 * Framework-free Cognito auth via OAuth2 authorization code + PKCE against
 * the hosted managed-login pages. No SDK: the whole flow is four endpoints
 * (/oauth2/authorize, /oauth2/token, /oauth2/userInfo, /logout).
 *
 * Tokens live in localStorage — standard SPA tradeoff (readable by any XSS
 * in this origin). Nothing rendered on this site comes from third-party
 * user content, which keeps that surface small.
 */
import { runtime } from './runtime'

export interface Tokens {
  idToken: string
  accessToken: string
  refreshToken: string | null
  /** epoch ms when the access token expires */
  expiresAt: number
}

const STORE_KEY = 'surfplay.auth'
const PKCE_KEY = 'surfplay.pkce'

const redirectUri = () => `${window.location.origin}/playground`

function b64url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

function randomString(byteLen = 32): string {
  const bytes = new Uint8Array(byteLen)
  crypto.getRandomValues(bytes)
  return b64url(bytes)
}

async function sha256b64url(input: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input))
  return b64url(new Uint8Array(digest))
}

export function loadTokens(): Tokens | null {
  try {
    const raw = localStorage.getItem(STORE_KEY)
    if (!raw) return null
    const t = JSON.parse(raw) as Tokens
    return typeof t.accessToken === 'string' ? t : null
  } catch {
    return null
  }
}

function saveTokens(t: Tokens | null) {
  if (t) localStorage.setItem(STORE_KEY, JSON.stringify(t))
  else localStorage.removeItem(STORE_KEY)
}

/** Kick off the hosted-UI login redirect. */
export async function beginLogin(): Promise<void> {
  const verifier = randomString()
  const state = randomString(16)
  sessionStorage.setItem(PKCE_KEY, JSON.stringify({ verifier, state }))
  const params = new URLSearchParams({
    client_id: runtime.clientId,
    response_type: 'code',
    scope: 'openid email profile',
    redirect_uri: redirectUri(),
    state,
    code_challenge: await sha256b64url(verifier),
    code_challenge_method: 'S256',
  })
  window.location.assign(`${runtime.cognitoDomain}/oauth2/authorize?${params}`)
}

interface TokenEndpointResponse {
  id_token: string
  access_token: string
  refresh_token?: string
  expires_in: number
}

class TokenEndpointError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message)
  }
}

async function callTokenEndpoint(body: URLSearchParams): Promise<TokenEndpointResponse> {
  const res = await fetch(`${runtime.cognitoDomain}/oauth2/token`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body,
  })
  if (!res.ok) throw new TokenEndpointError(res.status, `token endpoint ${res.status}: ${await res.text()}`)
  return res.json()
}

function toTokens(r: TokenEndpointResponse, previousRefresh: string | null): Tokens {
  return {
    idToken: r.id_token,
    accessToken: r.access_token,
    refreshToken: r.refresh_token ?? previousRefresh,
    // refresh one minute early so in-flight requests never carry a dead token
    expiresAt: Date.now() + (r.expires_in - 60) * 1000,
  }
}

// Memoized so React StrictMode's double-mount (and any duplicate call) shares
// ONE exchange — the code + PKCE verifier are single-use, so a second real
// attempt would fail and log the user out right after a successful login.
let callbackCompletion: Promise<Tokens | null> | undefined

export function completeLoginIfCallback(): Promise<Tokens | null> {
  return (callbackCompletion ??= doCompleteLoginIfCallback())
}

/**
 * If the current URL is the OAuth redirect (?code=...&state=...), finish the
 * exchange and clean the URL. Returns tokens, or null when not a callback.
 */
async function doCompleteLoginIfCallback(): Promise<Tokens | null> {
  const url = new URL(window.location.href)
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  if (!code) return null

  const stored = sessionStorage.getItem(PKCE_KEY)
  sessionStorage.removeItem(PKCE_KEY)
  url.searchParams.delete('code')
  url.searchParams.delete('state')
  window.history.replaceState({}, '', url.pathname + url.search + url.hash)

  if (!stored) return null
  const { verifier, state: expectedState } = JSON.parse(stored) as {
    verifier: string
    state: string
  }
  if (state !== expectedState) throw new Error('OAuth state mismatch — possible CSRF, login aborted')

  const tokens = toTokens(
    await callTokenEndpoint(
      new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: runtime.clientId,
        code,
        redirect_uri: redirectUri(),
        code_verifier: verifier,
      }),
    ),
    null,
  )
  saveTokens(tokens)
  return tokens
}

async function refreshTokens(current: Tokens): Promise<Tokens | null> {
  if (!current.refreshToken) return null
  try {
    const tokens = toTokens(
      await callTokenEndpoint(
        new URLSearchParams({
          grant_type: 'refresh_token',
          client_id: runtime.clientId,
          refresh_token: current.refreshToken,
        }),
      ),
      current.refreshToken,
    )
    saveTokens(tokens)
    return tokens
  } catch (e) {
    // Only a 4xx (invalid_grant — refresh token truly revoked/expired) means
    // signed out. A network blip or 5xx is transient: keep the token so the
    // next call can retry instead of forcing a re-login.
    if (e instanceof TokenEndpointError && e.status >= 400 && e.status < 500) {
      saveTokens(null)
      return null
    }
    return current
  }
}

// Single-flight: many API calls firing at once share ONE refresh request
// instead of racing N grants (which also race saveTokens).
let refreshing: Promise<Tokens | null> | null = null

/** Valid (refreshing when needed) tokens, or null when signed out. */
export async function currentTokens(): Promise<Tokens | null> {
  const t = loadTokens()
  if (!t) return null
  if (Date.now() < t.expiresAt) return t
  refreshing ??= refreshTokens(t).finally(() => {
    refreshing = null
  })
  return refreshing
}

/**
 * Refresh even if the access token hasn't expired yet. A refresh grant mints
 * tokens with current group membership, so this is how a pending user picks
 * up an approval without signing out and back in.
 */
export async function forceRefresh(): Promise<Tokens | null> {
  const t = loadTokens()
  if (!t) return null
  refreshing ??= refreshTokens(t).finally(() => {
    refreshing = null
  })
  return refreshing
}

export function signOut(): void {
  saveTokens(null)
  const params = new URLSearchParams({
    client_id: runtime.clientId,
    logout_uri: redirectUri(),
  })
  window.location.assign(`${runtime.cognitoDomain}/logout?${params}`)
}

function decodeJwtPayload(jwt: string): Record<string, unknown> {
  try {
    const payload = jwt.split('.')[1]
    return JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')))
  } catch {
    return {}
  }
}

/** Claims from the (already-verified-by-Cognito) id token. Display only. */
export function idTokenClaims(t: Tokens): { email?: string; sub?: string } {
  return decodeJwtPayload(t.idToken) as { email?: string; sub?: string }
}

/**
 * Role groups from the access token, for UI gating only — the backend
 * re-checks the same claim on every request.
 */
export function accessTokenGroups(t: Tokens): string[] {
  const raw = decodeJwtPayload(t.accessToken)['cognito:groups']
  return Array.isArray(raw) ? raw.map(String) : []
}
