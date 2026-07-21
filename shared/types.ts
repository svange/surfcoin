/**
 * Contract between the playground SPA and the Lambda API. Everything the
 * browser sees is normalized here — raw pump.fun / PumpPortal shapes stay
 * behind the Lambda so upstream renames don't ripple into components.
 *
 * Imported by both `src/` (tsconfig.app) and `backend/` (its own tsconfig).
 */

// ── account & linking ────────────────────────────────────────────────────────

export interface PlaygroundSettings {
  /** Master switch for the rule engine. Off = ticks are no-ops. */
  autopilotEnabled: boolean
  /**
   * false = every trade (manual Lightning + rules) runs as a dry run no
   * matter what the request says. The safety default.
   */
  liveTrading: boolean
}

export interface MeResponse {
  userSub: string
  wallet: { address: string; linkedAt: string } | null
  /** Lightning key is write-only; only its wallet + link time come back. */
  pumpPortal: { walletPublicKey: string | null; linkedAt: string } | null
  settings: PlaygroundSettings
}

export interface NonceResponse {
  nonce: string
  /** Exact message the wallet must sign (contains domain + nonce + time). */
  message: string
  expiresAt: string
}

export interface LinkWalletRequest {
  /** base58 Solana address the user connected */
  address: string
  /** base64 of the ed25519 signature over the nonce message */
  signatureB64: string
  nonce: string
}

export interface LinkPumpPortalRequest {
  /** Lightning API key from pumpportal.fun — stored KMS-encrypted, never returned */
  apiKey: string
  /** public key of the Lightning wallet, for display */
  walletPublicKey?: string
}

// ── tracked-coins registry (drives the public /coins page) ───────────────────

export interface RegistryResponse {
  /** pump.fun creator wallet — every coin it launches is auto-tracked */
  creatorWallet: string | null
  /** explicitly pinned mints */
  mints: string[]
  /** has an owner claimed the registry yet? */
  claimed: boolean
  /** is the calling user the owner (or free to claim)? */
  isOwner: boolean
}

export interface RegistrySaveRequest {
  creatorWallet: string | null
  mints: string[]
}

// ── pump.fun data (normalized) ───────────────────────────────────────────────

export interface PumpCoin {
  mint: string
  name: string
  symbol: string
  imageUri: string | null
  creator: string | null
  createdAt: number | null
  description: string | null
  marketCapUsd: number | null
  priceUsd: number | null
  /** 0..1 along the bonding curve; null once graduated */
  bondingProgress: number | null
  /** true = graduated off the curve (trades on the AMM) */
  complete: boolean
  raw?: unknown
}

export interface HeldCoin extends PumpCoin {
  /** UI token amount held by the linked wallet */
  balance: number
  valueUsd: number | null
}

export interface PortfolioResponse {
  wallet: string
  solBalance: number
  solUsd: number | null
  coins: HeldCoin[]
}

export interface Candle {
  /** unix seconds, bucket open */
  time: number
  open: number
  high: number
  low: number
  close: number
  volume: number
}

export interface PumpTrade {
  signature: string
  isBuy: boolean
  solAmount: number
  tokenAmount: number
  user: string
  timestamp: number
}

/** Allowlisted raw proxy for the API-explorer panel. */
export interface RawProxyResponse {
  path: string
  status: number
  body: unknown
}

// ── trading ──────────────────────────────────────────────────────────────────

/** Liquidity venue hint understood by PumpPortal. */
export type Pool =
  | 'auto'
  | 'pump'
  | 'pump-amm'
  | 'raydium'
  | 'raydium-cpmm'
  | 'launchlab'
  | 'bonk'
  | (string & {})

export interface TradeParams {
  action: 'buy' | 'sell'
  mint: string
  /** SOL amount when denominatedInSol, else token amount; "100%" sells all */
  amount: number | string
  denominatedInSol: boolean
  /** percent, e.g. 10 = 10% */
  slippage: number
  /** SOL tip for validator priority, e.g. 0.00005 */
  priorityFee: number
  pool: Pool
}

export interface TradeRequest extends TradeParams {
  /** true (default) = validate + echo what would be sent, execute nothing */
  dryRun: boolean
  /** for the activity log */
  symbol?: string
}

export interface TradeResponse {
  ok: boolean
  dryRun: boolean
  /** tx signature when executed */
  signature: string | null
  /** exact upstream request that was (or would be) sent, secrets redacted */
  sent: unknown
  error: string | null
}

/** Build an unsigned tx for the browser wallet to sign (keys stay local). */
export interface TradeBuildRequest extends TradeParams {
  /** public key that will sign — the linked browser wallet */
  publicKey: string
}

export interface TradeBuildResponse {
  /** base64-encoded serialized transaction for wallet.signTransaction */
  txBase64: string
}

export interface TradeSubmitRequest {
  /** base64 of the signed serialized transaction */
  signedTxBase64: string
  /** context for the activity log */
  mint?: string
  symbol?: string
  summary?: string
}

export interface TradeSubmitResponse {
  signature: string
}

/** pump.fun pays creators a cut of trading fees; claim via Lightning key. */
export interface ClaimFeesRequest {
  priorityFee: number
  /** pump claims all coins at once; meteora-dbc needs a mint */
  pool: 'pump' | 'meteora-dbc'
  mint?: string
  dryRun: boolean
}

// ── autopilot rules ──────────────────────────────────────────────────────────

export type RuleTrigger =
  | { kind: 'price-below'; usd: number }
  | { kind: 'price-above'; usd: number }
  | { kind: 'mcap-below'; usd: number }
  | { kind: 'mcap-above'; usd: number }

export interface RuleInput {
  mint: string
  symbol: string
  trigger: RuleTrigger
  trade: TradeParams
  /** disable after first fire (limit-order style) vs keep watching */
  oneShot: boolean
  enabled: boolean
}

export interface AutopilotRule extends RuleInput {
  id: string
  createdAt: string
  lastFiredAt: string | null
  fireCount: number
  /** last tick's observed price/mcap, for the UI */
  lastObserved: { priceUsd: number | null; marketCapUsd: number | null; at: string } | null
}

export interface ActivityEntry {
  id: string
  at: string
  source: 'manual' | 'rule'
  ruleId: string | null
  mint: string
  symbol: string
  summary: string
  dryRun: boolean
  ok: boolean
  signature: string | null
  detail: string | null
}

// ── error envelope ───────────────────────────────────────────────────────────

export interface ApiErrorBody {
  error: string
}
