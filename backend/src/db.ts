import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import {
  DeleteCommand,
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
  ScanCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb'
import type { ActivityEntry, AutopilotRule, PlaygroundSettings } from '../../shared/types'

const TABLE = process.env.TABLE_NAME!
const doc = DynamoDBDocumentClient.from(new DynamoDBClient({}), {
  marshallOptions: { removeUndefinedValues: true },
})

export const DEFAULT_SETTINGS: PlaygroundSettings = {
  autopilotEnabled: false,
  liveTrading: false,
}

export interface Profile {
  walletAddress?: string
  walletLinkedAt?: string
  ppCiphertextB64?: string
  ppWalletPublicKey?: string
  ppLinkedAt?: string
  settings?: PlaygroundSettings
}

const userPk = (sub: string) => `USER#${sub}`

// ── tracked-coins registry (single site-wide item) ──────────────────────────

export interface Registry {
  ownerSub?: string
  creatorWallet?: string | null
  mints?: string[]
  updatedAt?: string
}

const REGISTRY_KEY = { pk: 'SITE', sk: 'REGISTRY' }

export async function getRegistry(): Promise<Registry> {
  const r = await doc.send(new GetCommand({ TableName: TABLE, Key: REGISTRY_KEY }))
  return (r.Item as Registry | undefined) ?? {}
}

export async function putRegistry(reg: Registry): Promise<void> {
  await doc.send(new PutCommand({ TableName: TABLE, Item: { ...REGISTRY_KEY, ...reg } }))
}

export async function getProfile(sub: string): Promise<Profile> {
  const r = await doc.send(
    new GetCommand({ TableName: TABLE, Key: { pk: userPk(sub), sk: 'PROFILE' } }),
  )
  return (r.Item as Profile | undefined) ?? {}
}

export async function patchProfile(sub: string, fields: Record<string, unknown>): Promise<void> {
  const names: Record<string, string> = {}
  const values: Record<string, unknown> = {}
  const sets: string[] = []
  const removes: string[] = []
  for (const [k, v] of Object.entries(fields)) {
    names[`#${k}`] = k
    if (v === undefined) {
      removes.push(`#${k}`)
    } else {
      values[`:${k}`] = v
      sets.push(`#${k} = :${k}`)
    }
  }
  const expr =
    (sets.length ? `SET ${sets.join(', ')}` : '') +
    (removes.length ? ` REMOVE ${removes.join(', ')}` : '')
  await doc.send(
    new UpdateCommand({
      TableName: TABLE,
      Key: { pk: userPk(sub), sk: 'PROFILE' },
      UpdateExpression: expr.trim(),
      ExpressionAttributeNames: names,
      ...(Object.keys(values).length ? { ExpressionAttributeValues: values } : {}),
    }),
  )
}

// ── wallet-link nonces ───────────────────────────────────────────────────────

export async function putNonce(sub: string, nonce: string, message: string): Promise<void> {
  await doc.send(
    new PutCommand({
      TableName: TABLE,
      Item: {
        pk: userPk(sub),
        sk: `NONCE#${nonce}`,
        message,
        // DynamoDB TTL — also checked on read since TTL sweeps lag
        expiresAt: Math.floor(Date.now() / 1000) + 600,
      },
    }),
  )
}

export async function takeNonce(sub: string, nonce: string): Promise<string | null> {
  const key = { pk: userPk(sub), sk: `NONCE#${nonce}` }
  const r = await doc.send(new GetCommand({ TableName: TABLE, Key: key }))
  if (!r.Item) return null
  await doc.send(new DeleteCommand({ TableName: TABLE, Key: key }))
  if ((r.Item.expiresAt as number) < Date.now() / 1000) return null
  return r.Item.message as string
}

// ── autopilot rules ──────────────────────────────────────────────────────────

export async function listRules(sub: string): Promise<AutopilotRule[]> {
  const r = await doc.send(
    new QueryCommand({
      TableName: TABLE,
      KeyConditionExpression: 'pk = :pk AND begins_with(sk, :sk)',
      ExpressionAttributeValues: { ':pk': userPk(sub), ':sk': 'RULE#' },
    }),
  )
  return (r.Items ?? []).map(itemToRule)
}

export async function getRule(sub: string, id: string): Promise<AutopilotRule | null> {
  const r = await doc.send(
    new GetCommand({ TableName: TABLE, Key: { pk: userPk(sub), sk: `RULE#${id}` } }),
  )
  return r.Item ? itemToRule(r.Item) : null
}

export async function putRule(sub: string, rule: AutopilotRule): Promise<void> {
  await doc.send(
    new PutCommand({
      TableName: TABLE,
      // pk/sk last so a client-supplied rule.pk/rule.sk can never override the keys
      Item: { ...rule, pk: userPk(sub), sk: `RULE#${rule.id}` },
    }),
  )
}

/**
 * Atomically claim a rule fire before any trade is sent. The conditional
 * update only succeeds if lastFiredAt still equals what the caller observed,
 * so a concurrent tick (or a retry racing the next schedule) can't double-fire,
 * and — critically — the cooldown is armed even if the subsequent trade call
 * times out or throws. Returns false when another execution already claimed it.
 */
export async function claimRuleFire(
  sub: string,
  rule: AutopilotRule,
  now: string,
  observed: AutopilotRule['lastObserved'],
): Promise<boolean> {
  const values: Record<string, unknown> = {
    ':now': now,
    ':one': 1,
    ':zero': 0,
    ':obs': observed,
    ':expected': rule.lastFiredAt,
  }
  let expr = 'SET lastFiredAt = :now, fireCount = if_not_exists(fireCount, :zero) + :one, lastObserved = :obs'
  if (rule.oneShot) {
    expr += ', enabled = :off'
    values[':off'] = false
  }
  try {
    await doc.send(
      new UpdateCommand({
        TableName: TABLE,
        Key: { pk: userPk(sub), sk: `RULE#${rule.id}` },
        UpdateExpression: expr,
        ConditionExpression: 'lastFiredAt = :expected',
        ExpressionAttributeValues: values,
      }),
    )
    return true
  } catch (e) {
    if (e instanceof Error && e.name === 'ConditionalCheckFailedException') return false
    throw e
  }
}

export async function deleteRule(sub: string, id: string): Promise<void> {
  await doc.send(
    new DeleteCommand({ TableName: TABLE, Key: { pk: userPk(sub), sk: `RULE#${id}` } }),
  )
}

function itemToRule(item: Record<string, unknown>): AutopilotRule {
  const { pk: _pk, sk: _sk, ...rest } = item
  return rest as unknown as AutopilotRule
}

/**
 * All enabled rules across all users, for the tick. A Scan is deliberate:
 * this is a personal playground (a handful of users, a handful of rules), so
 * a 1/minute scan of a tiny table beats maintaining a GSI.
 */
export async function scanEnabledRules(): Promise<Array<{ sub: string; rule: AutopilotRule }>> {
  const out: Array<{ sub: string; rule: AutopilotRule }> = []
  let startKey: Record<string, unknown> | undefined
  do {
    const r = await doc.send(
      new ScanCommand({
        TableName: TABLE,
        FilterExpression: 'begins_with(sk, :sk) AND enabled = :on',
        ExpressionAttributeValues: { ':sk': 'RULE#', ':on': true },
        ExclusiveStartKey: startKey,
      }),
    )
    for (const item of r.Items ?? []) {
      out.push({ sub: (item.pk as string).slice('USER#'.length), rule: itemToRule(item) })
    }
    startKey = r.LastEvaluatedKey as Record<string, unknown> | undefined
  } while (startKey)
  return out
}

// ── activity log ─────────────────────────────────────────────────────────────

export async function putActivity(sub: string, entry: ActivityEntry): Promise<void> {
  await doc.send(
    new PutCommand({
      TableName: TABLE,
      Item: {
        pk: userPk(sub),
        sk: `ACT#${entry.at}#${entry.id}`,
        ...entry,
        // keep the log tidy: entries evaporate after 30 days
        expiresAt: Math.floor(Date.now() / 1000) + 30 * 24 * 3600,
      },
    }),
  )
}

export async function listActivity(sub: string, limit: number): Promise<ActivityEntry[]> {
  const r = await doc.send(
    new QueryCommand({
      TableName: TABLE,
      KeyConditionExpression: 'pk = :pk AND begins_with(sk, :sk)',
      ExpressionAttributeValues: { ':pk': userPk(sub), ':sk': 'ACT#' },
      ScanIndexForward: false,
      Limit: limit,
    }),
  )
  return (r.Items ?? []).map(i => {
    const { pk: _pk, sk: _sk, expiresAt: _t, ...rest } = i
    return rest as unknown as ActivityEntry
  })
}
