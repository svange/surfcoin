import { randomBytes, randomUUID } from 'node:crypto'
import type { APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyResultV2 } from 'aws-lambda'
import type {
  ActivityEntry,
  AutopilotRule,
  ClaimFeesRequest,
  LinkPumpPortalRequest,
  LinkWalletRequest,
  MeResponse,
  PlaygroundSettings,
  PumpCoin,
  RuleInput,
  TradeBuildRequest,
  TradeRequest,
  TradeSubmitRequest,
} from '../../shared/types'
import { runTick } from './autopilot'
import {
  DEFAULT_SETTINGS,
  deleteRule,
  getProfile,
  getRule,
  listActivity,
  listRules,
  patchProfile,
  putActivity,
  putNonce,
  putRule,
  takeNonce,
  type Profile,
} from './db'
import { HttpError, json, noContent } from './http'
import {
  getCandles,
  getCoin,
  getCreatedCoins,
  getExplore,
  getHeldCoins,
  getSolPriceUsd,
  getTrades,
  rawProxy,
} from './pump'
import {
  buildLocalTrade,
  claimFeesBody,
  decryptApiKey,
  encryptApiKey,
  lightningTrade,
  toPortalBody,
  validateTradeParams,
} from './pumpportal'
import {
  getSolBalance,
  isBase58Address,
  sendRawTransaction,
  transactionFeePayer,
  verifyWalletSignature,
} from './solana'

const SITE = process.env.SITE_ORIGIN ?? 'https://surfcoin.aillc.link'

type TickEvent = { source: 'autopilot-tick' }
type LambdaEvent = APIGatewayProxyEventV2WithJWTAuthorizer | TickEvent

export const handler = async (event: LambdaEvent): Promise<APIGatewayProxyResultV2 | void> => {
  if ('source' in event && event.source === 'autopilot-tick') {
    await runTick()
    return
  }
  const http = event as APIGatewayProxyEventV2WithJWTAuthorizer
  try {
    const method = http.requestContext.http.method
    const path = '/' + (http.pathParameters?.proxy ?? '')
    // Public, unauthenticated routes (no Cognito sub) — read-only pump.fun data
    // for the public /coins page. Routed via GET /public/{proxy+} (no authorizer).
    if (http.requestContext.http.path.startsWith('/public/')) {
      return await publicRoute(method, path, http)
    }
    const sub = http.requestContext.authorizer?.jwt?.claims?.sub
    if (typeof sub !== 'string' || !sub) throw new HttpError(401, 'no subject claim')
    return await route(sub, method, path, http)
  } catch (e) {
    if (e instanceof HttpError) return json(e.status, { error: e.message })
    console.error(e)
    return json(500, { error: 'internal error' })
  }
}

function body<T>(event: APIGatewayProxyEventV2WithJWTAuthorizer): T {
  if (!event.body) throw new HttpError(400, 'missing request body')
  try {
    const raw = event.isBase64Encoded ? Buffer.from(event.body, 'base64').toString('utf8') : event.body
    return JSON.parse(raw) as T
  } catch {
    throw new HttpError(400, 'request body is not valid JSON')
  }
}

function q(event: APIGatewayProxyEventV2WithJWTAuthorizer, name: string): string | undefined {
  return event.queryStringParameters?.[name]
}

function intParam(v: string | undefined, fallback: number, max: number): number {
  const n = v === undefined ? fallback : Number(v)
  if (!Number.isInteger(n) || n < 1 || n > max) throw new HttpError(400, `limit must be 1–${max}`)
  return n
}

async function route(
  sub: string,
  method: string,
  path: string,
  event: APIGatewayProxyEventV2WithJWTAuthorizer,
): Promise<APIGatewayProxyResultV2> {
  const key = `${method} ${path}`

  // ── account & linking ─────────────────────────────────────────────────────
  if (key === 'GET /me') return json(200, await me(sub))

  if (key === 'GET /wallet/nonce') {
    const address = q(event, 'address') ?? ''
    if (!isBase58Address(address)) throw new HttpError(400, 'address is not a valid Solana address')
    const nonce = randomBytes(16).toString('hex')
    const issued = new Date().toISOString()
    const message = [
      `${new URL(SITE).host} — SURF Shaping Bay`,
      '',
      'Sign to prove you own this wallet and link it to your playground account.',
      'This is a signature only: no transaction, no fees, no spending authority.',
      '',
      `Wallet: ${address}`,
      `Nonce: ${nonce}`,
      `Issued: ${issued}`,
    ].join('\n')
    await putNonce(sub, nonce, message)
    return json(200, {
      nonce,
      message,
      expiresAt: new Date(Date.now() + 600_000).toISOString(),
    })
  }

  if (key === 'POST /wallet/link') {
    const req = body<LinkWalletRequest>(event)
    if (!isBase58Address(req.address)) throw new HttpError(400, 'invalid address')
    if (typeof req.nonce !== 'string' || typeof req.signatureB64 !== 'string') {
      throw new HttpError(400, 'nonce and signatureB64 are required')
    }
    const message = await takeNonce(sub, req.nonce)
    if (!message) throw new HttpError(400, 'nonce expired or already used — fetch a fresh one')
    if (!message.includes(`Wallet: ${req.address}`)) {
      throw new HttpError(400, 'nonce was issued for a different wallet')
    }
    if (!verifyWalletSignature(message, req.signatureB64, req.address)) {
      throw new HttpError(401, 'signature verification failed')
    }
    await patchProfile(sub, { walletAddress: req.address, walletLinkedAt: new Date().toISOString() })
    return json(200, await me(sub))
  }

  if (key === 'DELETE /wallet/link') {
    await patchProfile(sub, { walletAddress: undefined, walletLinkedAt: undefined })
    return json(200, await me(sub))
  }

  if (key === 'PUT /pumpportal') {
    const req = body<LinkPumpPortalRequest>(event)
    // PumpPortal keys have no fixed prefix and can be long tokens — only
    // sanity-check that it's a non-empty string within KMS's plaintext limit.
    const apiKeyLen = typeof req.apiKey === 'string' ? req.apiKey.trim().length : -1
    if (apiKeyLen < 1 || apiKeyLen > 1024) {
      throw new HttpError(400, `apiKey looks wrong (got ${apiKeyLen} chars; expected 1–1024)`)
    }
    if (req.walletPublicKey !== undefined && !isBase58Address(req.walletPublicKey)) {
      throw new HttpError(400, 'walletPublicKey is not a valid Solana address')
    }
    await patchProfile(sub, {
      ppCiphertextB64: await encryptApiKey(req.apiKey.trim()),
      ppWalletPublicKey: req.walletPublicKey ?? null,
      ppLinkedAt: new Date().toISOString(),
    })
    return json(200, await me(sub))
  }

  if (key === 'DELETE /pumpportal') {
    await patchProfile(sub, {
      ppCiphertextB64: undefined,
      ppWalletPublicKey: undefined,
      ppLinkedAt: undefined,
    })
    return json(200, await me(sub))
  }

  if (key === 'PUT /settings') {
    const req = body<Partial<PlaygroundSettings>>(event)
    const profile = await getProfile(sub)
    const settings: PlaygroundSettings = { ...DEFAULT_SETTINGS, ...profile.settings }
    if (req.autopilotEnabled !== undefined) {
      if (typeof req.autopilotEnabled !== 'boolean') throw new HttpError(400, 'autopilotEnabled must be boolean')
      settings.autopilotEnabled = req.autopilotEnabled
    }
    if (req.liveTrading !== undefined) {
      if (typeof req.liveTrading !== 'boolean') throw new HttpError(400, 'liveTrading must be boolean')
      settings.liveTrading = req.liveTrading
    }
    await patchProfile(sub, { settings })
    return json(200, await me(sub))
  }

  // ── pump.fun data ─────────────────────────────────────────────────────────
  if (key === 'GET /portfolio') {
    const profile = await getProfile(sub)
    if (!profile.walletAddress) throw new HttpError(409, 'no wallet linked yet')
    const solUsd = await getSolPriceUsd().catch(() => null)
    const [coins, solBalance] = await Promise.all([
      getHeldCoins(profile.walletAddress, solUsd),
      getSolBalance(profile.walletAddress).catch(() => 0),
    ])
    return json(200, { wallet: profile.walletAddress, solBalance, solUsd, coins })
  }

  if (key === 'GET /coins/created') {
    const profile = await getProfile(sub)
    if (!profile.walletAddress) throw new HttpError(409, 'no wallet linked yet')
    return json(200, await getCreatedCoins(profile.walletAddress))
  }

  if (key === 'GET /explore') {
    const view = q(event, 'view') ?? 'new'
    if (view !== 'new' && view !== 'topmc') throw new HttpError(400, 'view must be new or topmc')
    return json(200, await getExplore(view))
  }

  const coinMatch = path.match(/^\/coin\/([1-9A-HJ-NP-Za-km-z]{32,44})(\/(candles|trades))?$/)
  if (method === 'GET' && coinMatch) {
    const mint = coinMatch[1]
    if (!coinMatch[3]) return json(200, await getCoin(mint))
    if (coinMatch[3] === 'candles') {
      return json(
        200,
        await getCandles(mint, q(event, 'interval') ?? '1m', intParam(q(event, 'limit'), 120, 500)),
      )
    }
    return json(200, await getTrades(mint, intParam(q(event, 'limit'), 30, 200)))
  }

  if (key === 'GET /pump/raw') {
    const host = q(event, 'host') ?? 'frontend'
    const p = q(event, 'path') ?? '/'
    const r = await rawProxy(host, p)
    return json(200, { path: p, ...r })
  }

  // ── trading ───────────────────────────────────────────────────────────────
  if (key === 'POST /trade') {
    const req = body<TradeRequest>(event)
    validateTradeParams(req)
    const profile = await getProfile(sub)
    const settings = { ...DEFAULT_SETTINGS, ...profile.settings }

    // Dry runs never need a key — exploring the exact upstream payload is the
    // whole point. A key + armed LIVE is required only to actually send.
    const wantLive = req.dryRun === false
    const live = wantLive && settings.liveTrading && !!profile.ppCiphertextB64
    const sent = toPortalBody(req)

    let signature: string | null = null
    let error: string | null = null
    if (live) {
      try {
        const apiKey = await decryptApiKey(profile.ppCiphertextB64!)
        const result = await lightningTrade(apiKey, sent)
        signature = result.signature
        error = result.error
      } catch (e) {
        // Always log — a thrown send may still have executed on-chain.
        error = `send failed — order may or may not have executed: ${e instanceof Error ? e.message : String(e)}`
      }
    } else if (wantLive && !settings.liveTrading) {
      error = 'liveTrading is off in settings — ran as dry run'
    } else if (wantLive && !profile.ppCiphertextB64) {
      error = 'no PumpPortal Lightning key linked — ran as dry run'
    }

    await logManualTrade(sub, req, !live, signature, error)
    return json(200, { ok: error === null, dryRun: !live, signature, sent, error })
  }

  if (key === 'POST /claim-fees') {
    const req = body<ClaimFeesRequest>(event)
    const sent = claimFeesBody(req)
    const profile = await getProfile(sub)
    const settings = { ...DEFAULT_SETTINGS, ...profile.settings }
    const live = req.dryRun === false && settings.liveTrading && !!profile.ppCiphertextB64
    let signature: string | null = null
    let error: string | null = null
    if (live) {
      try {
        const apiKey = await decryptApiKey(profile.ppCiphertextB64!)
        const result = await lightningTrade(apiKey, sent)
        signature = result.signature
        error = result.error
      } catch (e) {
        error = `send failed — claim may or may not have executed: ${e instanceof Error ? e.message : String(e)}`
      }
    } else if (req.dryRun === false && !profile.ppCiphertextB64) {
      error = 'no PumpPortal Lightning key linked — ran as dry run'
    }
    const entry: ActivityEntry = {
      id: randomUUID().slice(0, 8),
      at: new Date().toISOString(),
      source: 'manual',
      ruleId: null,
      mint: req.mint ?? '',
      symbol: 'FEES',
      summary: `claim creator fees (${req.pool})`,
      dryRun: !live,
      ok: error === null,
      signature,
      detail: error,
    }
    await putActivity(sub, entry)
    return json(200, { ok: error === null, dryRun: !live, signature, sent, error })
  }

  if (key === 'POST /trade/build') {
    const req = body<TradeBuildRequest>(event)
    validateTradeParams(req)
    if (!isBase58Address(req.publicKey)) throw new HttpError(400, 'publicKey is not a valid address')
    return json(200, await buildLocalTrade(req.publicKey, req))
  }

  if (key === 'POST /trade/submit') {
    const req = body<TradeSubmitRequest>(event)
    if (typeof req.signedTxBase64 !== 'string' || req.signedTxBase64.length > 10_000) {
      throw new HttpError(400, 'signedTxBase64 required')
    }
    // Only relay transactions that pay from the caller's own linked wallet —
    // not an open broadcast relay for arbitrary signed transactions.
    const profile = await getProfile(sub)
    if (!profile.walletAddress) throw new HttpError(409, 'link a wallet before submitting transactions')
    const feePayer = transactionFeePayer(req.signedTxBase64)
    if (feePayer !== profile.walletAddress) {
      throw new HttpError(400, 'transaction fee-payer does not match your linked wallet')
    }
    const signature = await sendRawTransaction(req.signedTxBase64)
    const entry: ActivityEntry = {
      id: randomUUID().slice(0, 8),
      at: new Date().toISOString(),
      source: 'manual',
      ruleId: null,
      mint: req.mint ?? '',
      symbol: req.symbol ?? '',
      summary: req.summary ?? 'wallet-signed trade submitted',
      dryRun: false,
      ok: true,
      signature,
      detail: null,
    }
    await putActivity(sub, entry)
    return json(200, { signature })
  }

  // ── autopilot rules ───────────────────────────────────────────────────────
  if (key === 'GET /rules') return json(200, await listRules(sub))

  if (key === 'POST /rules') {
    const req = body<RuleInput>(event)
    validateRuleInput(req)
    const rule: AutopilotRule = {
      ...req,
      trade: { ...req.trade, mint: req.mint },
      id: randomUUID().slice(0, 8),
      createdAt: new Date().toISOString(),
      lastFiredAt: null,
      fireCount: 0,
      lastObserved: null,
    }
    await putRule(sub, rule)
    return json(200, rule)
  }

  const ruleMatch = path.match(/^\/rules\/([A-Za-z0-9-]{1,40})$/)
  if (ruleMatch && (method === 'PUT' || method === 'DELETE')) {
    const id = ruleMatch[1]
    if (method === 'DELETE') {
      await deleteRule(sub, id)
      return noContent()
    }
    const existing = await getRule(sub, id)
    if (!existing) throw new HttpError(404, 'rule not found')
    const req = body<Partial<RuleInput>>(event)
    // Only the user-mutable fields may come from the body; server-managed
    // fields (id, createdAt, fireCount, lastFiredAt, lastObserved) stay from
    // `existing` so a crafted body can't rewrite fire history or cooldown.
    const merged: AutopilotRule = {
      ...existing,
      mint: req.mint ?? existing.mint,
      symbol: req.symbol ?? existing.symbol,
      trigger: req.trigger ?? existing.trigger,
      trade: { ...existing.trade, ...req.trade },
      oneShot: req.oneShot ?? existing.oneShot,
      enabled: req.enabled ?? existing.enabled,
    }
    merged.trade.mint = merged.mint
    validateRuleInput(merged)
    await putRule(sub, merged)
    return json(200, merged)
  }

  if (key === 'GET /activity') {
    return json(200, await listActivity(sub, intParam(q(event, 'limit'), 50, 200)))
  }

  throw new HttpError(404, `no route for ${key}`)
}

/**
 * Unauthenticated read-only routes for the public /coins page. pump.fun blocks
 * cross-origin browser calls, so the page reads its live bonding-curve stats
 * through here. Inputs are base58-validated and capped; the HTTP API's
 * per-route throttle bounds abuse of this as a generic pump.fun proxy.
 */
async function publicRoute(
  method: string,
  path: string,
  event: APIGatewayProxyEventV2WithJWTAuthorizer,
): Promise<APIGatewayProxyResultV2> {
  if (method === 'GET' && path === '/coins') {
    const creator = q(event, 'creator')?.trim()
    if (creator && !isBase58Address(creator)) throw new HttpError(400, 'invalid creator address')

    const mints = (q(event, 'mints') ?? '')
      .split(',')
      .map(s => s.trim())
      .filter(Boolean)
      .slice(0, 20)
    for (const m of mints) if (!isBase58Address(m)) throw new HttpError(400, `invalid mint: ${m}`)

    const solUsd = await getSolPriceUsd().catch(() => null)
    const byMint = new Map<string, PumpCoin>()

    if (creator) {
      const created = await getCreatedCoins(creator, 30).catch(() => [])
      for (const c of created) byMint.set(c.mint, c)
    }
    const missing = mints.filter(m => !byMint.has(m))
    const fetched = await Promise.allSettled(missing.map(m => getCoin(m)))
    fetched.forEach((r, i) => {
      if (r.status === 'fulfilled') byMint.set(missing[i], r.value)
    })

    const coins = [...byMint.values()].sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0))
    return json(200, { coins, solUsd, at: new Date().toISOString() })
  }

  throw new HttpError(404, `no public route for ${method} ${path}`)
}

async function me(sub: string): Promise<MeResponse> {
  const p: Profile = await getProfile(sub)
  return {
    userSub: sub,
    wallet:
      p.walletAddress && p.walletLinkedAt
        ? { address: p.walletAddress, linkedAt: p.walletLinkedAt }
        : null,
    pumpPortal: p.ppLinkedAt
      ? { walletPublicKey: p.ppWalletPublicKey ?? null, linkedAt: p.ppLinkedAt }
      : null,
    settings: { ...DEFAULT_SETTINGS, ...p.settings },
  }
}

const TRIGGER_KINDS = new Set(['price-below', 'price-above', 'mcap-below', 'mcap-above'])

function validateRuleInput(r: RuleInput): void {
  if (!isBase58Address(r.mint)) throw new HttpError(400, 'mint is not a valid address')
  if (typeof r.symbol !== 'string' || r.symbol.length === 0 || r.symbol.length > 20) {
    throw new HttpError(400, 'symbol required (≤20 chars)')
  }
  if (!r.trigger || !TRIGGER_KINDS.has(r.trigger.kind)) throw new HttpError(400, 'unknown trigger kind')
  if (typeof r.trigger.usd !== 'number' || !Number.isFinite(r.trigger.usd) || r.trigger.usd <= 0) {
    throw new HttpError(400, 'trigger.usd must be a positive number')
  }
  if (typeof r.oneShot !== 'boolean' || typeof r.enabled !== 'boolean') {
    throw new HttpError(400, 'oneShot and enabled must be booleans')
  }
  validateTradeParams({ ...r.trade, mint: r.mint })
}

async function logManualTrade(
  sub: string,
  req: TradeRequest,
  dryRun: boolean,
  signature: string | null,
  error: string | null,
): Promise<void> {
  const entry: ActivityEntry = {
    id: randomUUID().slice(0, 8),
    at: new Date().toISOString(),
    source: 'manual',
    ruleId: null,
    mint: req.mint,
    symbol: req.symbol ?? '',
    summary: `${req.action} ${req.amount}${req.denominatedInSol ? ' SOL' : ' tokens'} of ${req.symbol ?? req.mint.slice(0, 6)}`,
    dryRun,
    ok: error === null,
    signature,
    detail: error,
  }
  await putActivity(sub, entry)
}
