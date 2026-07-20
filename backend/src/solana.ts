import { createPublicKey, verify as edVerify } from 'node:crypto'
import bs58 from 'bs58'
import { fetchWithTimeout, HttpError } from './http'

const RPC_URL = process.env.SOLANA_RPC_URL ?? 'https://api.mainnet-beta.solana.com'

/** DER prefix that wraps a raw 32-byte ed25519 public key into SPKI. */
const ED25519_SPKI_PREFIX = Buffer.from('302a300506032b6570032100', 'hex')

export function isBase58Address(s: string): boolean {
  if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(s)) return false
  try {
    return bs58.decode(s).length === 32
  } catch {
    return false
  }
}

/** Verify an ed25519 signature over a utf8 message — node:crypto, no nacl. */
export function verifyWalletSignature(
  message: string,
  signatureB64: string,
  addressB58: string,
): boolean {
  try {
    const raw = bs58.decode(addressB58)
    if (raw.length !== 32) return false
    const key = createPublicKey({
      key: Buffer.concat([ED25519_SPKI_PREFIX, Buffer.from(raw)]),
      format: 'der',
      type: 'spki',
    })
    const sig = Buffer.from(signatureB64, 'base64')
    if (sig.length !== 64) return false
    return edVerify(null, Buffer.from(message, 'utf8'), key, sig)
  } catch {
    return false
  }
}

/** Solana "shortvec" (compact-u16) length prefix decode. */
function decodeShortVec(buf: Buffer, offset: number): { value: number; offset: number } {
  let value = 0
  let shift = 0
  let o = offset
  for (;;) {
    const b = buf[o++]
    value |= (b & 0x7f) << shift
    if ((b & 0x80) === 0) break
    shift += 7
  }
  return { value, offset: o }
}

/**
 * Fee-payer (first account key) of a serialized transaction, base58. Works for
 * both legacy and v0 messages without pulling in @solana/web3.js. Returns null
 * if the bytes don't parse as a transaction. Used to assert a relayed,
 * wallet-signed tx actually belongs to the caller's linked wallet.
 */
export function transactionFeePayer(signedTxB64: string): string | null {
  try {
    const buf = Buffer.from(signedTxB64, 'base64')
    if (buf.length < 64) return null
    const sigs = decodeShortVec(buf, 0)
    let o = sigs.offset + sigs.value * 64 // skip signatures
    if ((buf[o] & 0x80) !== 0) o += 1 // versioned message: skip version byte
    o += 3 // message header (3 bytes)
    const keys = decodeShortVec(buf, o)
    o = keys.offset
    if (keys.value < 1 || o + 32 > buf.length) return null
    return bs58.encode(buf.subarray(o, o + 32))
  } catch {
    return null
  }
}

async function rpc<T>(method: string, params: unknown[]): Promise<T> {
  const res = await fetchWithTimeout(RPC_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  })
  if (!res.ok) throw new HttpError(502, `solana rpc ${res.status}`)
  const body = (await res.json()) as { result?: T; error?: { message: string } }
  if (body.error) throw new HttpError(502, `solana rpc: ${body.error.message}`)
  return body.result as T
}

export async function getSolBalance(address: string): Promise<number> {
  const r = await rpc<{ value: number }>('getBalance', [address])
  return r.value / 1e9
}

/** Submit a signed base64 transaction; returns the signature. */
export async function sendRawTransaction(signedTxB64: string): Promise<string> {
  return rpc<string>('sendTransaction', [
    signedTxB64,
    { encoding: 'base64', skipPreflight: false, maxRetries: 3 },
  ])
}
