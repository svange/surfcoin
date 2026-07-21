import { Link } from 'react-router-dom'
import { config, isLive, pumpFunUrl } from '../config'
import { Sun } from './Sun'

const LINKS = [
  { href: '#report', label: 'Report' },
  { href: '#wavenomics', label: 'Wavenomics' },
  { href: '#paddle-out', label: 'Paddle Out' },
  { href: '#tide-chart', label: 'Tide Chart' },
  { href: '#lineup', label: 'Lineup' },
  { href: '#lifeguard', label: 'Lifeguard' },
]

export function Nav() {
  return (
    <header className="sticky top-0 z-40 border-b border-driftwood/10 bg-salt/80 backdrop-blur-md">
      <nav
        aria-label="Primary"
        className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6"
      >
        <a href="#top" className="flex items-center gap-2">
          <Sun className="h-8 w-8" idSuffix="nav" />
          <span className="font-display text-2xl text-burnt">SURF</span>
          <span className="font-mono text-xs text-driftwood/70">.fail</span>
        </a>
        <div className="hidden items-center gap-6 md:flex">
          {LINKS.map(l => (
            <a
              key={l.href}
              href={l.href}
              className="text-sm font-bold text-driftwood/80 transition-colors hover:text-burnt"
            >
              {l.label}
            </a>
          ))}
          <Link
            to="/playground"
            className="text-sm font-bold text-deepset transition-colors hover:text-burnt"
          >
            Shaping Bay
          </Link>
        </div>
        <div className="flex items-center gap-3">
          {/* Always visible (incl. mobile) — the playground/login entry point. */}
          <Link
            to="/playground"
            className="text-sm font-bold text-deepset transition-colors hover:text-burnt"
          >
            Log in
          </Link>
          {isLive ? (
            <a
              href={pumpFunUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-full bg-burnt px-4 py-1.5 text-sm font-bold text-salt transition-colors hover:bg-dusk"
            >
              Buy {config.ticker}
            </a>
          ) : (
            <span className="rounded-full border border-coral/60 bg-coral/10 px-3 py-1.5 font-mono text-[11px] font-bold tracking-wider text-burnt uppercase">
              pre-launch
            </span>
          )}
        </div>
      </nav>
    </header>
  )
}
