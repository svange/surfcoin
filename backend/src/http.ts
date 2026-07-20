import type { APIGatewayProxyResultV2 } from 'aws-lambda'

export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message)
  }
}

export function json(status: number, body: unknown): APIGatewayProxyResultV2 {
  return {
    statusCode: status,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  }
}

export function noContent(): APIGatewayProxyResultV2 {
  return { statusCode: 204 }
}

/** Fetch with a hard timeout — upstreams must never pin the Lambda. */
export async function fetchWithTimeout(
  url: string,
  init: RequestInit = {},
  timeoutMs = 10_000,
): Promise<Response> {
  const ctl = new AbortController()
  const timer = setTimeout(() => ctl.abort(), timeoutMs)
  // redirect:'manual' so an open redirect on an allowlisted host can't bounce a
  // proxied request to an unintended origin (e.g. cloud metadata).
  try {
    return await fetch(url, { redirect: 'manual', ...init, signal: ctl.signal })
  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError') {
      let host = 'upstream'
      try {
        host = new URL(url).host
      } catch {
        /* keep default */
      }
      throw new HttpError(504, `timeout contacting ${host}`)
    }
    throw e
  } finally {
    clearTimeout(timer)
  }
}
