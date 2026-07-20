import { toast } from '../lib/toast'
import { CABar } from './CABar'

const LEGAL_LINES = [
  '$SURF is a memecoin created for entertainment purposes only. It has no intrinsic value, no utility, no roadmap obligations, and no expectation of financial return.',
  'Nothing on this website constitutes financial, investment, legal, or tax advice. Cryptocurrencies are extremely volatile; the price of $SURF may go to zero, and realistically it might. Never spend more than you can afford to lose entirely.',
  '$SURF is not affiliated with, endorsed by, or connected to pump.fun, the Solana Foundation, or any other entity mentioned or implied. You are responsible for complying with the laws of your own jurisdiction.',
  'Past performance of other memecoins is not indicative of anything, least of all this one.',
]

const NAV = [
  { href: '#report', label: 'Report' },
  { href: '#wavenomics', label: 'Wavenomics' },
  { href: '#paddle-out', label: 'Paddle Out' },
  { href: '#tide-chart', label: 'Tide Chart' },
  { href: '#lineup', label: 'Lineup' },
  { href: '#lifeguard', label: 'Lifeguard' },
]

export function FinePrint() {
  return (
    <footer className="bg-night px-4 pt-20 pb-10 text-salt/80 sm:px-6">
      <div className="mx-auto max-w-3xl">
        <h2 className="font-display mb-8 -rotate-1 text-center text-3xl text-golden">
          The Fine Print, Sun-Faded
        </h2>

        <p className="text-center leading-relaxed">
          $SURF has no whitepaper — the tide erased it, and honestly it reads better now. Nothing
          on this site is financial advice; it's barely advice about surfing. Never spend money
          you need for rent, wetsuits, or sunscreen. (SPF 50, reapply every two hours —{' '}
          <em>this</em> part IS advice.)
        </p>

        <div className="mx-auto mt-8 w-fit rounded border border-golden/40 bg-gradient-to-b from-golden/15 to-golden/5 px-6 py-3 text-center">
          <p className="font-mono text-sm text-golden">
            every memecoin domain eventually tells the truth.
            <br />
            ours starts there.
          </p>
        </div>

        <div className="mt-10 flex justify-center">
          <CABar
            compact
            microcopy={
              <span className="text-salt/50">
                the only real $SURF CA, when it exists, lives on this page.
              </span>
            }
          />
        </div>

        <nav
          aria-label="Footer"
          className="mt-10 flex flex-wrap items-center justify-center gap-x-4 gap-y-1"
        >
          {NAV.map(l => (
            <a
              key={l.href}
              href={l.href}
              className="inline-flex min-h-11 items-center px-2 text-sm font-bold text-seafoam/80 transition-colors hover:text-golden"
            >
              {l.label}
            </a>
          ))}
          <button
            onClick={() => toast('gm')}
            className="inline-flex min-h-11 items-center rounded-full border border-seafoam/40 px-3 text-sm font-bold text-seafoam/80 transition-colors hover:border-golden hover:text-golden"
          >
            gm
          </button>
        </nav>

        <div className="mt-10 space-y-2 border-t border-salt/10 pt-6">
          {LEGAL_LINES.map((line, i) => (
            <p key={i} className="text-center text-xs leading-relaxed text-salt/65">
              {line}
            </p>
          ))}
        </div>

        <p className="mt-8 text-center font-mono text-xs text-salt/60">
          © whenever — time is a flat circle on the beach. Built by hand, hosted on a static
          bucket, powered by residual summer.
          <br />
          surfcoin.fail — wipeout responsibly.
        </p>

        <p id="sea-floor" className="mt-16 text-center font-mono text-[10px] text-salt/25">
          You scrolled to the sea floor. There's no alpha down here. Just sand. Respect the
          commitment though.
        </p>
      </div>
    </footer>
  )
}
