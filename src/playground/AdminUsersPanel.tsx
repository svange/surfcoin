import { useEffect, useState } from 'react'
import type { AdminGroupChangeRequest, AdminUsersResponse, Role } from '../../shared/types'
import { toast } from '../lib/toast'
import { useAuth } from './AuthContext'
import { Button, Panel, Spinner } from './ui'
import { useApi } from './useApi'

/**
 * Admin-only user management. New signups arrive with no groups (= pending);
 * approving adds them to the `approved` Cognito group. Changes land in the
 * user's tokens on their next refresh (the pending page polls for it).
 */
export function AdminUsersPanel() {
  const api = useApi()
  const { sub: mySub } = useAuth()
  const [users, setUsers] = useState<AdminUsersResponse['users'] | null>(null)
  const [busySub, setBusySub] = useState<string | null>(null)

  useEffect(() => {
    api<AdminUsersResponse>('/admin/users')
      .then(r => setUsers(r.users))
      .catch(e => toast(e instanceof Error ? e.message : 'could not load users'))
  }, [api])

  async function changeGroup(sub: string, group: Role, action: 'add' | 'remove') {
    setBusySub(sub)
    try {
      const r = await api<AdminUsersResponse>(`/admin/users/${sub}/groups`, {
        method: 'POST',
        body: { group, action } satisfies AdminGroupChangeRequest,
      })
      setUsers(r.users)
      toast(`${action === 'add' ? 'added to' : 'removed from'} ${group}`)
    } catch (e) {
      toast(e instanceof Error ? e.message : 'change failed')
    } finally {
      setBusySub(null)
    }
  }

  return (
    <Panel title="Users">
      <p className="mb-4 font-mono text-[11px] text-seafoam/60">
        New signups start pending — approve them to open the bay. Admins can manage users; approval
        changes reach the user within a minute (their pending page polls for it).
      </p>

      {!users ? (
        <Spinner label="loading users…" />
      ) : (
        <ul className="space-y-2">
          {users.map(u => {
            const approved = u.groups.includes('approved')
            const admin = u.groups.includes('admins')
            const self = u.sub === mySub
            const busy = busySub === u.sub
            return (
              <li
                key={u.sub}
                className="flex flex-wrap items-center justify-between gap-3 rounded border border-seafoam/15 bg-night/40 px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="truncate font-mono text-xs text-salt">
                    {u.email ?? u.sub}
                    {self && <span className="ml-2 text-seafoam/50">(you)</span>}
                  </p>
                  <p className="mt-0.5 font-mono text-[10px] text-seafoam/50">
                    {u.status.toLowerCase()}
                    {u.createdAt && ` · joined ${u.createdAt.slice(0, 10)}`}
                    <span className={admin ? 'text-golden' : approved ? 'text-seafoam' : 'text-coral'}>
                      {' · '}
                      {admin ? 'admin' : approved ? 'approved' : 'pending'}
                    </span>
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant={approved ? 'danger' : 'primary'}
                    className="px-3 py-1 text-xs"
                    disabled={busy}
                    onClick={() => changeGroup(u.sub, 'approved', approved ? 'remove' : 'add')}
                  >
                    {approved ? 'revoke' : 'approve'}
                  </Button>
                  <Button
                    variant="ghost"
                    className="px-3 py-1 text-xs"
                    disabled={busy || (admin && self)}
                    title={admin && self ? 'cannot remove your own admin role' : undefined}
                    onClick={() => changeGroup(u.sub, 'admins', admin ? 'remove' : 'add')}
                  >
                    {admin ? 'remove admin' : 'make admin'}
                  </Button>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </Panel>
  )
}
