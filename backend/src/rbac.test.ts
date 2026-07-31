import { describe, expect, it } from 'vitest'
import {
  authorize,
  filterApprovedOwners,
  isAdmin,
  isAdminPath,
  isApproved,
  parseGroups,
  PENDING_APPROVAL_CODE,
} from './rbac'

describe('parseGroups', () => {
  it('reads a real JSON array (raw JWT shape)', () => {
    expect([...parseGroups(['admins', 'approved'])]).toEqual(['admins', 'approved'])
  })

  it('coerces non-string array members', () => {
    expect([...parseGroups([1, 'approved'])]).toEqual(['1', 'approved'])
  })

  it('parses the HTTP API bracketed, space-separated string', () => {
    // The Cognito JWT authorizer stringifies the array claim like this.
    const g = parseGroups('[admins approved]')
    expect(g.has('admins')).toBe(true)
    expect(g.has('approved')).toBe(true)
    expect(g.size).toBe(2)
  })

  it('parses a comma-separated string', () => {
    expect([...parseGroups('approved, admins')].sort()).toEqual(['admins', 'approved'])
  })

  it('parses a single plain group name', () => {
    expect([...parseGroups('approved')]).toEqual(['approved'])
  })

  it('treats an empty string as no groups', () => {
    expect(parseGroups('').size).toBe(0)
  })

  it('treats undefined / null / non-string as no groups (fresh signup)', () => {
    expect(parseGroups(undefined).size).toBe(0)
    expect(parseGroups(null).size).toBe(0)
    expect(parseGroups(42).size).toBe(0)
  })
})

describe('role predicates', () => {
  it('isAdmin only for the admins group', () => {
    expect(isAdmin(new Set(['admins']))).toBe(true)
    expect(isAdmin(new Set(['approved']))).toBe(false)
    expect(isAdmin(new Set())).toBe(false)
  })

  it('isApproved for approved or admins (admins imply approval)', () => {
    expect(isApproved(new Set(['approved']))).toBe(true)
    expect(isApproved(new Set(['admins']))).toBe(true)
    expect(isApproved(new Set())).toBe(false)
  })
})

describe('isAdminPath', () => {
  it('matches the admin root and sub-paths', () => {
    expect(isAdminPath('/admin')).toBe(true)
    expect(isAdminPath('/admin/users')).toBe(true)
    expect(isAdminPath('/admin/users/abc/groups')).toBe(true)
  })

  it('does not match other paths', () => {
    expect(isAdminPath('/me')).toBe(false)
    expect(isAdminPath('/rules')).toBe(false)
    // Requires the trailing slash boundary — a sibling prefix must not match.
    expect(isAdminPath('/administrators')).toBe(false)
  })
})

describe('authorize', () => {
  it('denies a fresh signup (no groups) with a PENDING_APPROVAL 403', () => {
    const d = authorize('/me', parseGroups(undefined))
    expect(d).toEqual({
      ok: false,
      status: 403,
      body: { error: 'account pending approval', code: PENDING_APPROVAL_CODE },
    })
  })

  it('allows an approved user on a normal route', () => {
    expect(authorize('/me', new Set(['approved']))).toEqual({ ok: true, admin: false })
  })

  it('allows an admin on a normal route and flags admin', () => {
    expect(authorize('/rules', new Set(['admins']))).toEqual({ ok: true, admin: true })
  })

  it('blocks a non-admin (even if approved) from admin routes', () => {
    expect(authorize('/admin/users', new Set(['approved']))).toEqual({
      ok: false,
      status: 403,
      body: { error: 'admin only' },
    })
  })

  it('blocks a pending user from admin routes', () => {
    expect(authorize('/admin', new Set())).toEqual({
      ok: false,
      status: 403,
      body: { error: 'admin only' },
    })
  })

  it('allows an admin on admin routes', () => {
    expect(authorize('/admin/users', new Set(['admins']))).toEqual({ ok: true, admin: true })
  })
})

describe('filterApprovedOwners', () => {
  const rules = [
    { sub: 'alice', id: 'r1' },
    { sub: 'bob', id: 'r2' },
    { sub: 'carol', id: 'r3' },
  ]

  it('keeps only rules whose owner is currently approved', () => {
    const kept = filterApprovedOwners(rules, new Set(['alice', 'carol']))
    expect(kept.map(r => r.id)).toEqual(['r1', 'r3'])
  })

  it('drops everything when no owner is approved (all revoked)', () => {
    expect(filterApprovedOwners(rules, new Set())).toEqual([])
  })

  it('keeps everything when all owners are approved', () => {
    expect(filterApprovedOwners(rules, new Set(['alice', 'bob', 'carol']))).toHaveLength(3)
  })
})
