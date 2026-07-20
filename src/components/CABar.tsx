import { useState, type ReactNode } from 'react'
import { config } from '../config'
import { toast } from '../lib/toast'
import { truncateAddress } from '../lib/format'

interface CABarProps {
  /** Small line rendered under the bar. */
  microcopy?: ReactNode
  /** Compact variant for the footer. */
  compact?: boolean
}

/**
 * THE memecoin recognition signal. Pre-launch it stays visible (that's the
 * point) but the copy button hands you the only thing available: patience.
 */
export function CABar({ microcopy, compact = false }: CABarProps) {
  const [copied, setCopied] = useState(false)
  const ca = config.contractAddress

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(ca ?? 'patience')
    } catch {
      // Clipboard can be blocked; the toast still tells the joke.
    }
    if (ca) {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
      toast('Copied. See you in the lineup.')
    } else {
      toast("Copied: patience. You'll need it.")
    }
  }

  return (
    <div className={compact ? '' : 'w-full max-w-xl'}>
      <div className="flex items-stretch overflow-hidden rounded-lg border-2 border-burnt/70 bg-night/90 font-mono text-sm shadow-lg">
        <span className="flex items-center bg-burnt/90 px-3 font-bold text-salt select-none">
          CA:
        </span>
        <span
          className={`flex min-w-0 flex-1 items-center overflow-hidden px-3 py-2.5 text-ellipsis whitespace-nowrap ${ca ? 'text-seafoam' : 'text-salt/70 italic'}`}
          title={ca ?? undefined}
        >
          {ca
            ? compact
              ? truncateAddress(ca, 6)
              : ca
            : '[ drops here at launch — nowhere else first ]'}
        </span>
        <button
          onClick={handleCopy}
          className={`shrink-0 px-4 font-bold uppercase transition-colors ${
            copied
              ? 'bg-seafoam text-night'
              : 'bg-golden text-driftwood hover:bg-coral hover:text-salt'
          }`}
        >
          {copied ? 'copied ✓' : ca ? 'copy' : 'nothing to copy yet'}
        </button>
      </div>
      {microcopy && <p className="mt-2 font-mono text-xs opacity-70">{microcopy}</p>}
    </div>
  )
}
