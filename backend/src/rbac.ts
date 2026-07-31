/**
 * Role-based access decisions for the playground — the single source of truth
 * for the approved-role gate.
 *
 * Authentication (a valid Cognito JWT) only proves *who* you are. Capability is
 * gated on *roles*, which live in Cognito user-pool groups (`approved` /
 * `admins`) and arrive as the `cognito:groups` claim. A signed-in user in
 * neither group is **pending**: they have no capability until an admin approves
 * them. Both enforcement paths import this module — the Lambda handler
 * (synchronous JWT API) and the autopilot tick (asynchronous EventBridge) — so
 * the rule lives in exactly one place and is unit-tested against regression.
 */

export const APPROVED_GROUP = 'approved'
export const ADMINS_GROUP = 'admins'

/** SPA-recognized code for the pending-approval 403 (drives the waiting page). */
export const PENDING_APPROVAL_CODE = 'PENDING_APPROVAL'

/**
 * Normalize the `cognito:groups` claim into a Set. The HTTP API JWT authorizer
 * stringifies array claims as "[admins approved]" (bracketed, space-separated,
 * unquoted); a raw JWT carries a real JSON array. Handle both, plus a plain
 * string and the absent case (fresh signups have no groups).
 */
export function parseGroups(raw: unknown): Set<string> {
  if (Array.isArray(raw)) return new Set(raw.map(String))
  if (typeof raw !== 'string' || !raw) return new Set()
  return new Set(
    raw
      .replace(/^\[|\]$/g, '')
      .split(/[\s,]+/)
      .filter(Boolean),
  )
}

export function isAdmin(groups: Set<string>): boolean {
  return groups.has(ADMINS_GROUP)
}

/** Admins implicitly count as approved. */
export function isApproved(groups: Set<string>): boolean {
  return groups.has(APPROVED_GROUP) || groups.has(ADMINS_GROUP)
}

/** Admin-only user-management routes (`/admin`, `/admin/...`). */
export function isAdminPath(path: string): boolean {
  return path === '/admin' || path.startsWith('/admin/')
}

export type AuthDecision =
  | { ok: true; admin: boolean }
  | { ok: false; status: number; body: { error: string; code?: string } }

/**
 * Decide whether a caller in `groups` may reach `path`. Admin routes require the
 * `admins` group; every other authenticated route requires approval (`approved`
 * or `admins`). Pending users get a 403 the SPA recognizes by
 * `PENDING_APPROVAL_CODE` and renders the approval-pending page for.
 */
export function authorize(path: string, groups: Set<string>): AuthDecision {
  if (isAdminPath(path)) {
    if (!isAdmin(groups)) return { ok: false, status: 403, body: { error: 'admin only' } }
    return { ok: true, admin: true }
  }
  if (!isApproved(groups)) {
    return {
      ok: false,
      status: 403,
      body: { error: 'account pending approval', code: PENDING_APPROVAL_CODE },
    }
  }
  return { ok: true, admin: isAdmin(groups) }
}

/**
 * Keep only items whose owner (`sub`) is currently approved. Used by the
 * autopilot tick to enforce the approved-role gate on the async path: a user
 * removed from the groups loses autopilot too, not just the synchronous API.
 */
export function filterApprovedOwners<T extends { sub: string }>(
  items: readonly T[],
  approvedSubs: ReadonlySet<string>,
): T[] {
  return items.filter(i => approvedSubs.has(i.sub))
}
