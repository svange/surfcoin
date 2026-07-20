import { DecryptCommand, EncryptCommand, KMSClient } from '@aws-sdk/client-kms'
import type { ClaimFeesRequest, TradeParams } from '../../shared/types'
import { fetchWithTimeout, HttpError } from './http'

const kms = new KMSClient({})
const KEY_ID = process.env.KMS_KEY_ID!

const TRADE_URL = 'https://pumpportal.fun/api/trade'
const TRADE_LOCAL_URL = 'https://pumpportal.fun/api/trade-local'

export async function encryptApiKey(apiKey: string): Promise<string> {
  const r = await kms.send(
    new EncryptCommand({ KeyId: KEY_ID, Plaintext: Buffer.from(apiKey, 'utf8') }),
  )
  return Buffer.from(r.CiphertextBlob!).toString('base64')
}

export async function decryptApiKey(ciphertextB64: string): Promise<string> {
  const r = await kms.send(
    new DecryptCommand({ CiphertextBlob: Buffer.from(ciphertextB64, 'base64') }),
  )
  return Buffer.from(r.Plaintext!).toString('utf8')
}

export function validateTradeParams(p: TradeParams): void {
  if (p.action !== 'buy' && p.action !== 'sell') throw new HttpError(400, 'action must be buy or sell')
  if (typeof p.mint !== 'string' || !/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(p.mint)) {
    throw new HttpError(400, 'mint is not a valid base58 address')
  }
  const amountOk =
    (typeof p.amount === 'number' && p.amount > 0) ||
    (typeof p.amount === 'string' && /^\d+(\.\d+)?%$/.test(p.amount))
  if (!amountOk) throw new HttpError(400, 'amount must be a positive number or a percentage like "100%"')
  if (typeof p.slippage !== 'number' || p.slippage < 0 || p.slippage > 100) {
    throw new HttpError(400, 'slippage must be 0–100 (percent)')
  }
  if (typeof p.priorityFee !== 'number' || p.priorityFee < 0 || p.priorityFee > 0.1) {
    throw new HttpError(400, 'priorityFee must be 0–0.1 SOL')
  }
}

/** The exact body PumpPortal expects (booleans go over as strings). */
export function toPortalBody(p: TradeParams): Record<string, unknown> {
  return {
    action: p.action,
    mint: p.mint,
    amount: p.amount,
    denominatedInSol: String(p.denominatedInSol),
    slippage: p.slippage,
    priorityFee: p.priorityFee,
    pool: p.pool || 'auto',
  }
}

interface PortalResult {
  signature: string | null
  error: string | null
}

async function postPortal(url: string, body: Record<string, unknown>): Promise<Response> {
  return fetchWithTimeout(
    url,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    },
    20_000,
  )
}

/** Execute a trade with the stored Lightning key. */
export async function lightningTrade(
  apiKey: string,
  body: Record<string, unknown>,
): Promise<PortalResult> {
  const res = await postPortal(`${TRADE_URL}?api-key=${encodeURIComponent(apiKey)}`, body)
  const json = (await res.json().catch(() => ({}))) as {
    signature?: string
    errors?: unknown[]
    error?: string
  }
  if (json.signature) return { signature: json.signature, error: null }
  const err =
    json.error ??
    (Array.isArray(json.errors) && json.errors.length ? JSON.stringify(json.errors) : null)
  return { signature: null, error: err ?? `pumpportal ${res.status}` }
}

export function claimFeesBody(p: ClaimFeesRequest): Record<string, unknown> {
  if (typeof p.priorityFee !== 'number' || p.priorityFee < 0 || p.priorityFee > 0.1) {
    throw new HttpError(400, 'priorityFee must be 0–0.1 SOL')
  }
  if (p.pool !== 'pump' && p.pool !== 'meteora-dbc') {
    throw new HttpError(400, 'pool must be pump or meteora-dbc')
  }
  return {
    action: 'collectCreatorFee',
    priorityFee: p.priorityFee,
    pool: p.pool,
    ...(p.mint ? { mint: p.mint } : {}),
  }
}

/**
 * Build an unsigned transaction for local (browser-wallet) signing. Keys
 * never touch this server; PumpPortal returns serialized tx bytes.
 */
export async function buildLocalTrade(
  publicKey: string,
  p: TradeParams,
): Promise<{ txBase64: string }> {
  const res = await postPortal(TRADE_LOCAL_URL, { publicKey, ...toPortalBody(p) })
  const buf = Buffer.from(await res.arrayBuffer())
  if (!res.ok) {
    throw new HttpError(502, `pumpportal trade-local ${res.status}: ${buf.toString('utf8').slice(0, 300)}`)
  }
  // error bodies are JSON; a real transaction is raw bytes
  const asText = buf.toString('utf8')
  if (asText.trimStart().startsWith('{') || asText.trimStart().startsWith('[')) {
    throw new HttpError(502, `pumpportal trade-local: ${asText.slice(0, 300)}`)
  }
  return { txBase64: buf.toString('base64') }
}
