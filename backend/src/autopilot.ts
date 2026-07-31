/**
 * The rule engine. Runs on a 1-minute EventBridge tick: re-reads every
 * enabled rule, checks its trigger against live pump.fun data, and — only
 * when the owner has flipped BOTH autopilotEnabled and liveTrading — fires
 * the trade through their stored Lightning key. Otherwise the fire is
 * recorded as a dry run, so the loop is observable before it is armed.
 */
import { randomUUID } from 'node:crypto'
import type { ActivityEntry, AutopilotRule } from '../../shared/types'
import { listApprovedSubs } from './cognito'
import { claimRuleFire, DEFAULT_SETTINGS, getProfile, putActivity, putRule, scanEnabledRules } from './db'
import { getCoin } from './pump'
import { decryptApiKey, lightningTrade, toPortalBody } from './pumpportal'
import { filterApprovedOwners } from './rbac'

/** A repeating rule may fire at most once per this window. */
const REFIRE_COOLDOWN_MS = 5 * 60_000

function triggerHit(rule: AutopilotRule, priceUsd: number | null, mcapUsd: number | null): boolean {
  const t = rule.trigger
  switch (t.kind) {
    case 'price-below':
      return priceUsd !== null && priceUsd <= t.usd
    case 'price-above':
      return priceUsd !== null && priceUsd >= t.usd
    case 'mcap-below':
      return mcapUsd !== null && mcapUsd <= t.usd
    case 'mcap-above':
      return mcapUsd !== null && mcapUsd >= t.usd
  }
}

export async function runTick(): Promise<void> {
  const enabled = await scanEnabledRules()
  if (enabled.length === 0) return

  // Enforce the approved-role gate on the async path too: a user removed from
  // the `approved`/`admins` groups must lose autopilot, not just the synchronous
  // API. Fail CLOSED — if the membership lookup fails we skip this tick rather
  // than fire for owners we can't verify. Autopilot is dry-run by default and
  // ticks every minute, so a skipped minute is harmless; the next tick retries.
  let approvedSubs: Set<string>
  try {
    approvedSubs = await listApprovedSubs()
  } catch (e) {
    console.error('approved-membership lookup failed; skipping tick', e)
    return
  }
  const rules = filterApprovedOwners(enabled, approvedSubs)
  if (rules.length === 0) return

  const profiles = new Map<string, Awaited<ReturnType<typeof getProfile>>>()
  for (const { sub } of rules) {
    if (!profiles.has(sub)) {
      try {
        profiles.set(sub, await getProfile(sub))
      } catch (e) {
        console.error(`profile load failed for ${sub}`, e)
      }
    }
  }

  for (const { sub, rule } of rules) {
    const profile = profiles.get(sub)
    if (!profile) continue // couldn't load the owner's profile this tick; skip
    try {
      await evaluateRule(sub, rule, profile)
    } catch (e) {
      console.error(`rule ${rule.id} failed`, e)
      // best-effort: never let logging failure abort the batch
      await recordActivity(sub, rule, false, true, null, e instanceof Error ? e.message : String(e)).catch(
        err => console.error('recordActivity failed', err),
      )
    }
  }
}

async function evaluateRule(
  sub: string,
  rule: AutopilotRule,
  profile: Awaited<ReturnType<typeof getProfile>>,
): Promise<void> {
  const settings = profile.settings ?? DEFAULT_SETTINGS
  const now = new Date().toISOString()

  const coin = await getCoin(rule.mint)
  const observed = { priceUsd: coin.priceUsd, marketCapUsd: coin.marketCapUsd, at: now }

  const hit = triggerHit(rule, coin.priceUsd, coin.marketCapUsd)
  const inCooldown =
    rule.lastFiredAt !== null && Date.now() - Date.parse(rule.lastFiredAt) < REFIRE_COOLDOWN_MS

  if (!settings.autopilotEnabled || !hit || inCooldown) {
    await putRule(sub, { ...rule, lastObserved: observed })
    return
  }

  // Arm the cooldown ATOMICALLY before sending anything. If this loses the
  // compare-and-set (a concurrent tick/retry already claimed the fire), bail.
  // Because the claim commits first, a trade that later times out or throws
  // still can't re-fire next tick — the whole point of the safety.
  const claimed = await claimRuleFire(sub, rule, now, observed)
  if (!claimed) return

  const live = settings.liveTrading && !!profile.ppCiphertextB64
  let signature: string | null = null
  let error: string | null = null
  if (live) {
    try {
      const apiKey = await decryptApiKey(profile.ppCiphertextB64!)
      const result = await lightningTrade(apiKey, toPortalBody({ ...rule.trade, mint: rule.mint }))
      signature = result.signature
      error = result.error
    } catch (e) {
      // The send threw (e.g. upstream timeout) — the order may or may not have
      // landed. Cooldown is already committed, so we won't hammer it; surface
      // the uncertainty honestly rather than mislabeling it a dry run.
      error = `send failed — order may or may not have executed: ${e instanceof Error ? e.message : String(e)}`
    }
  }

  const ok = live ? error === null : true
  await recordActivity(sub, rule, ok, !live, signature, error)
}

async function recordActivity(
  sub: string,
  rule: AutopilotRule,
  ok: boolean,
  dryRun: boolean,
  signature: string | null,
  detail: string | null,
): Promise<void> {
  const t = rule.trigger
  const entry: ActivityEntry = {
    id: randomUUID().slice(0, 8),
    at: new Date().toISOString(),
    source: 'rule',
    ruleId: rule.id,
    mint: rule.mint,
    symbol: rule.symbol,
    summary: `${rule.trade.action} ${rule.trade.amount}${rule.trade.denominatedInSol ? ' SOL' : ''} of ${rule.symbol} (${t.kind} $${t.usd})`,
    dryRun,
    ok,
    signature,
    detail,
  }
  await putActivity(sub, entry)
}
