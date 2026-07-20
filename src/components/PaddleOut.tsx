import { isLive, pumpFunUrl } from '../config'
import { hex } from '../lib/palette'
import { SectionHeading } from './SectionHeading'

const STEPS = [
  {
    title: 'Get a board',
    copy: "Download Phantom (or your Solana wallet of choice). It's free, unlike surf lessons.",
  },
  {
    title: 'Get some SOL',
    copy: "Buy SOL on any exchange and send it to your wallet. Start with an amount you'd happily leave in a beach locker.",
  },
  {
    title: 'Find the break',
    copy: 'At launch, come back HERE, copy the CA from THIS page, and paste it into pump.fun. Not from a DM. Not from a reply guy. From here. This is the entire security model — respect it.',
  },
  {
    title: 'Catch the wave',
    copy: 'Swap SOL for $SURF. Congratulations: you now hold a golden-hour daydream with a ticker symbol.',
  },
  {
    title: 'Assume the position',
    copy: 'Lie back. Float. Do not check the chart from the water; phones and saltwater have a rough history.',
  },
]

function SharkAdvisory() {
  return (
    <aside className="my-8 rounded-lg border-2 border-dashed border-burnt bg-salt p-5">
      <p className="font-mono text-sm font-bold tracking-wider text-burnt uppercase">
        🦈 shark advisory
      </p>
      <p className="mt-2 text-driftwood">
        Before launch there is <strong>no</strong> contract address. Anyone selling you $SURF
        today is selling you seawater. Anyone DMing you an &ldquo;early CA&rdquo; is a riptide in
        a hoodie — swim parallel to shore and block them. Sharks DM first. We never will.
      </p>
    </aside>
  )
}

/** A longboard bobbing in place, waiting with you. */
function Longboard() {
  return (
    <svg viewBox="0 0 120 36" className="animate-bob h-9 w-30" aria-hidden="true">
      <ellipse cx="60" cy="18" rx="56" ry="10" fill={hex.burnt} />
      <ellipse cx="60" cy="16" rx="56" ry="9" fill={hex.coral} />
      <line x1="14" y1="16" x2="106" y2="16" stroke={hex.salt} strokeWidth="1.5" />
    </svg>
  )
}

export function PaddleOut() {
  return (
    <section id="paddle-out" className="bg-shore px-4 py-20 sm:px-6">
      <div className="mx-auto max-w-3xl">
        <SectionHeading kicker="how to buy, eventually">How to Paddle Out</SectionHeading>
        <ol className="space-y-6">
          {STEPS.map((step, i) => (
            <li key={step.title} className="flex gap-5">
              <span className="font-display flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-burnt text-xl text-salt">
                {i + 1}
              </span>
              <div className="pt-1">
                <h3 className="font-bold tracking-wide text-burnt uppercase">{step.title}</h3>
                <p className="mt-1 text-driftwood">
                  {i === 2 && isLive ? (
                    <>
                      Copy the CA from the top of this page and paste it into{' '}
                      <a
                        href={pumpFunUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-bold text-burnt underline decoration-dotted underline-offset-2"
                      >
                        pump.fun
                      </a>
                      . Not from a DM. Not from a reply guy. From here. This is the entire
                      security model — respect it.
                    </>
                  ) : (
                    step.copy
                  )}
                </p>
              </div>
            </li>
          ))}
        </ol>
        <SharkAdvisory />
        <div className="flex items-center justify-center gap-4">
          <Longboard />
          <p className="font-mono text-xs text-driftwood/60 italic">
            the board waits with you
          </p>
        </div>
      </div>
    </section>
  )
}
