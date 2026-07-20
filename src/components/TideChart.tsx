import { useInView } from '../hooks/useInView'
import { hex } from '../lib/palette'
import { SectionHeading } from './SectionHeading'

interface Phase {
  name: string
  copy: string
  checklist?: { label: string; done: boolean }[]
}

const PHASES: Phase[] = [
  {
    name: 'Low Tide (now)',
    copy: 'Where every wave starts: no water, all potential.',
    checklist: [
      { label: 'launch on pump.fun', done: false },
      { label: "have a website (you're soaking in it)", done: true },
      { label: 'tell roughly 40 people, 12 of whom surf', done: false },
    ],
  },
  {
    name: 'Incoming Swell',
    copy: "Spin up the X account and the Telegram. Someone makes a meme we didn't approve and it's better than anything we made. First flat spell. First “dev do something.” Dev goes surfing.",
  },
  {
    name: 'High Tide',
    copy: 'Graduate when the bonding curve says so. DexScreener listing. A sticker pack. One (1) mid-tier influencer calls us “interesting” and we frame it.',
  },
  {
    name: 'Wipeout (scheduled)',
    copy: "Every wave breaks. Ours will too, possibly several times. Roadmaps that don't include the wipeout are lying to you. We paddle back out.",
  },
  {
    name: 'Golden Hour',
    copy: "Unknown. Genuinely. The tide comes in, the tide goes out, and anyone who says they can schedule that is selling something. We'll be here either way, watching the sun perform the only guaranteed burn in crypto.",
  },
]

/** The roadmap as sea level: rises, peaks, wipes out, and drifts into golden hour. */
function TideCurve({ inView }: { inView: boolean }) {
  const dots: [number, number][] = [
    [60, 92],
    [300, 62],
    [560, 24],
    [820, 78],
    [1120, 38],
  ]
  return (
    <svg
      viewBox="0 0 1200 120"
      className="mb-10 hidden h-24 w-full md:block"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <path
        className={`tide-path ${inView ? 'is-in' : ''}`}
        d="M0,100 C120,96 200,74 300,62 C420,48 480,26 560,24 C640,22 700,40 760,60 C800,74 840,82 900,74 C1000,62 1080,44 1200,34"
        fill="none"
        stroke={hex.deepset}
        strokeWidth="3"
        strokeLinecap="round"
      />
      {dots.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="7" fill={hex.coral} stroke={hex.salt} strokeWidth="2.5" />
      ))}
    </svg>
  )
}

export function TideChart() {
  const { ref, inView } = useInView<HTMLDivElement>(0.2)
  return (
    <section id="tide-chart" className="bg-lagoon px-4 py-20 sm:px-6">
      <div className="mx-auto max-w-6xl" ref={ref}>
        <SectionHeading kicker="the roadmap, oceanographically">The Tide Chart</SectionHeading>
        <p className="mb-10 text-center text-lg font-bold text-deepset">
          We don't do roadmaps. Roads are a land thing. We do tides.
        </p>
        <TideCurve inView={inView} />
        <div className="grid gap-5 md:grid-cols-5">
          {PHASES.map(phase => (
            <div
              key={phase.name}
              className="flex flex-col rounded-lg border border-deepset/15 bg-salt p-5 shadow-sm"
            >
              <h3 className="font-display text-lg leading-snug text-deepset">{phase.name}</h3>
              <p className="mt-2 flex-1 text-sm text-driftwood">{phase.copy}</p>
              {phase.checklist ? (
                <ul className="mt-3 space-y-1.5 font-mono text-xs text-driftwood">
                  {phase.checklist.map(item => (
                    <li key={item.label} className="flex gap-2">
                      <span aria-hidden="true">{item.done ? '☑' : '☐'}</span>
                      <span className={item.done ? 'font-bold text-deepset' : ''}>
                        {item.label}
                        <span className="sr-only">{item.done ? ' (done)' : ' (not done)'}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-3 font-mono text-xs text-driftwood/60">☐ awaiting tide</p>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
