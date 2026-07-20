import { useImperativeHandle, type Ref } from 'react'
import type { ActivityEntry } from '../../shared/types'
import { Empty, Panel, Spinner } from './ui'
import { useQuery } from './useApi'

export interface ActivityHandle {
  reload: () => void
}

/** Ledger of every trade attempt — manual and rule-driven, live and dry. */
export function ActivityPanel({ handleRef }: { handleRef?: Ref<ActivityHandle> }) {
  const activity = useQuery<ActivityEntry[]>('/activity?limit=50')
  useImperativeHandle(handleRef, () => ({ reload: activity.reload }), [activity.reload])

  return (
    <Panel title="Activity log">
      {activity.loading && !activity.data ? (
        <Spinner />
      ) : activity.data && activity.data.length > 0 ? (
        <ul className="max-h-[60vh] space-y-1.5 overflow-y-auto">
          {activity.data.map(a => (
            <li
              key={a.id}
              className="flex items-start justify-between gap-3 border-b border-seafoam/10 pb-1.5"
            >
              <div className="min-w-0">
                <p className="truncate font-mono text-[11px] text-salt">{a.summary}</p>
                <p className="font-mono text-[9px] text-seafoam/50">
                  {new Date(a.at).toLocaleString()} · {a.source}
                  {a.detail && <span className="text-coral"> · {a.detail}</span>}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <span
                  className={`font-mono text-[9px] tracking-wider uppercase ${
                    a.dryRun ? 'text-seafoam/50' : a.ok ? 'text-seafoam' : 'text-coral'
                  }`}
                >
                  {a.dryRun ? 'dry' : a.ok ? 'live' : 'fail'}
                </span>
                {a.signature && (
                  <a
                    href={`https://solscan.io/tx/${a.signature}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block font-mono text-[9px] text-golden underline"
                  >
                    tx ↗
                  </a>
                )}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <Empty>nothing logged yet</Empty>
      )}
    </Panel>
  )
}
