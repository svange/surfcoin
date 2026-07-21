/**
 * Cognito admin operations for the user-management page. Roles live entirely
 * in user-pool groups (`approved` / `admins`) — membership shows up in tokens
 * as the cognito:groups claim, which is what the handler authorizes on.
 */
import {
  AdminAddUserToGroupCommand,
  AdminRemoveUserFromGroupCommand,
  CognitoIdentityProviderClient,
  ListUsersCommand,
  ListUsersInGroupCommand,
  type UserType,
} from '@aws-sdk/client-cognito-identity-provider'
import type { AdminUserSummary, Role } from '../../shared/types'

const USER_POOL_ID = process.env.USER_POOL_ID!
const client = new CognitoIdentityProviderClient({})

function attr(u: UserType, name: string): string | null {
  return u.Attributes?.find(a => a.Name === name)?.Value ?? null
}

/** All users merged with their group memberships. Hobby scale: no pagination. */
export async function listUsersWithGroups(): Promise<AdminUserSummary[]> {
  const groups: Role[] = ['approved', 'admins']
  const [users, ...members] = await Promise.all([
    client.send(new ListUsersCommand({ UserPoolId: USER_POOL_ID, Limit: 60 })),
    ...groups.map(g =>
      client.send(new ListUsersInGroupCommand({ UserPoolId: USER_POOL_ID, GroupName: g, Limit: 60 })),
    ),
  ])
  const membership = new Map<Role, Set<string>>(
    groups.map((g, i) => [g, new Set((members[i].Users ?? []).map(u => u.Username ?? ''))]),
  )
  return (users.Users ?? []).map(u => {
    // In this pool (UsernameAttributes: email) the generated Username IS the sub.
    const sub = attr(u, 'sub') ?? u.Username ?? ''
    return {
      sub,
      email: attr(u, 'email'),
      status: u.UserStatus ?? 'UNKNOWN',
      createdAt: u.UserCreateDate?.toISOString() ?? null,
      groups: groups.filter(g => membership.get(g)!.has(u.Username ?? '')),
    }
  })
}

export async function addToGroup(username: string, group: Role): Promise<void> {
  await client.send(
    new AdminAddUserToGroupCommand({ UserPoolId: USER_POOL_ID, Username: username, GroupName: group }),
  )
}

export async function removeFromGroup(username: string, group: Role): Promise<void> {
  await client.send(
    new AdminRemoveUserFromGroupCommand({ UserPoolId: USER_POOL_ID, Username: username, GroupName: group }),
  )
}
