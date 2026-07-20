import type { ButtonHTMLAttributes, ReactNode } from 'react'

/** Chart palette — validated dark-surface categorical set (dataviz skill).
 *  aqua=up/positive, coral=down/negative, gold=neutral/volume. */
export const chart = {
  up: '#2EA189',
  down: '#DC5240',
  neutral: '#C48122',
  surface: '#0B3038',
  grid: '#1c4a52',
  ink: '#F7EDDA',
  muted: '#9FD3C7',
} as const

export function Panel({
  title,
  right,
  children,
  className = '',
}: {
  title?: string
  right?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <section
      className={`rounded-xl border border-seafoam/15 bg-night/60 p-5 shadow-lg shadow-black/20 ${className}`}
    >
      {title && (
        <header className="mb-4 flex items-center justify-between gap-3">
          <h2 className="font-mono text-xs tracking-[0.2em] text-seafoam uppercase">{title}</h2>
          {right}
        </header>
      )}
      {children}
    </section>
  )
}

export function Button({
  variant = 'primary',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'ghost' | 'danger' | 'sell' }) {
  const styles = {
    primary: 'bg-burnt text-salt hover:bg-dusk',
    sell: 'bg-coral text-night hover:bg-coral/80',
    ghost: 'border border-seafoam/40 text-seafoam hover:bg-seafoam/10',
    danger: 'border border-coral/50 text-coral hover:bg-coral/10',
  }[variant]
  return (
    <button
      className={`rounded-full px-4 py-2 text-sm font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${styles} ${className}`}
      {...props}
    />
  )
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: ReactNode
}) {
  return (
    <label className="block">
      <span className="font-mono text-[11px] tracking-wider text-seafoam/80 uppercase">{label}</span>
      <div className="mt-1">{children}</div>
      {hint && <p className="mt-1 font-mono text-[10px] text-seafoam/50">{hint}</p>}
    </label>
  )
}

export const inputClass =
  'w-full rounded-lg border border-seafoam/25 bg-night/80 px-3 py-2 font-mono text-sm text-salt outline-none focus:border-golden'

export function Toggle({
  checked,
  onChange,
  label,
  danger,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label: string
  danger?: boolean
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex items-center gap-2"
    >
      <span
        className={`relative h-5 w-9 rounded-full transition-colors ${
          checked ? (danger ? 'bg-coral' : 'bg-seafoam') : 'bg-seafoam/20'
        }`}
      >
        <span
          className={`absolute top-0.5 h-4 w-4 rounded-full bg-night transition-transform ${
            checked ? 'translate-x-4' : 'translate-x-0.5'
          }`}
        />
      </span>
      <span className={`font-mono text-xs ${danger && checked ? 'text-coral' : 'text-seafoam'}`}>
        {label}
      </span>
    </button>
  )
}

/** Coin images come from arbitrary token creators — only render http(s) URLs
 *  (never data:/javascript:/blob:), and always with no referrer. */
export function safeImageUrl(uri: string | null): string | null {
  if (!uri) return null
  try {
    const u = new URL(uri)
    return u.protocol === 'https:' || u.protocol === 'http:' ? uri : null
  } catch {
    return null
  }
}

export function Spinner({ label = 'loading…' }: { label?: string }) {
  return <p className="py-6 text-center font-mono text-xs text-seafoam/60">{label}</p>
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="py-6 text-center font-mono text-xs text-seafoam/50">{children}</p>
}
