import { useCallback, useEffect, useRef, useState } from 'react'
import { apiFetch, ApiError } from './api'
import { useAuth } from './AuthContext'

export { ApiError }

/** Bound apiFetch that always carries the current access token. */
export function useApi() {
  const { getAccessToken } = useAuth()
  return useCallback(
    <T>(path: string, init?: { method?: 'GET' | 'POST' | 'PUT' | 'DELETE'; body?: unknown }) =>
      apiFetch<T>(getAccessToken, path, init),
    [getAccessToken],
  )
}

interface Query<T> {
  data: T | null
  error: string | null
  loading: boolean
  reload: () => void
}

/** GET-and-cache with manual reload; re-runs when `path` changes. */
export function useQuery<T>(path: string | null, deps: unknown[] = []): Query<T> {
  const api = useApi()
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(path !== null)
  const [tick, setTick] = useState(0)
  const latest = useRef(0)
  const prevPath = useRef(path)

  useEffect(() => {
    if (path === null) {
      setLoading(false)
      return
    }
    // On a genuine path change, drop the previous query's data so the UI never
    // shows one coin's/tab's data under another's label. On a manual reload
    // (same path, tick bump) keep it — "refetch keeps the frame".
    if (prevPath.current !== path) {
      setData(null)
      prevPath.current = path
    }
    const seq = ++latest.current
    setLoading(true)
    setError(null)
    api<T>(path)
      .then(d => {
        if (seq === latest.current) {
          setData(d)
          setLoading(false)
        }
      })
      .catch((e: unknown) => {
        if (seq === latest.current) {
          setError(e instanceof Error ? e.message : String(e))
          setLoading(false)
        }
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, tick, ...deps])

  return { data, error, loading, reload: () => setTick(t => t + 1) }
}
