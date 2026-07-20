/**
 * Typed fetch wrapper for the playground backend. Every call carries the
 * Cognito access token; the HTTP API's JWT authorizer rejects anything else.
 */
import { runtime } from './runtime'

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message)
  }
}

export async function apiFetch<T>(
  getAccessToken: () => Promise<string | null>,
  path: string,
  init?: { method?: 'GET' | 'POST' | 'PUT' | 'DELETE'; body?: unknown },
): Promise<T> {
  const token = await getAccessToken()
  if (!token) throw new ApiError(401, 'signed out')
  const res = await fetch(`${runtime.apiBase}/api${path}`, {
    method: init?.method ?? 'GET',
    headers: {
      authorization: `Bearer ${token}`,
      ...(init?.body !== undefined ? { 'content-type': 'application/json' } : {}),
    },
    body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
  })
  if (!res.ok) {
    let detail = ''
    try {
      const j = await res.json()
      detail = j.error ?? JSON.stringify(j)
    } catch {
      /* non-JSON error body */
    }
    throw new ApiError(res.status, detail || `API ${res.status}`)
  }
  if (res.status === 204) return undefined as T
  return res.json()
}
