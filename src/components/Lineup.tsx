import { config } from '../config'
import { SectionHeading } from './SectionHeading'
import { Sun } from './Sun'

const RULES = [
  "Don't drop in on someone else's wave. One meme at a time.",
  'Never call the top. The ocean hates hubris.',
  '“Wen” is not a question. It’s a tide. It arrives when it arrives.',
  'gm is mandatory. gn is optional. Golden hour is sacred.',
  'All price predictions must be phrased as weather forecasts.',
  'When the chart dips, we say the water’s “reloading.” Because it is.',
]

function SocialCard({
  name,
  status,
  detail,
  href,
}: {
  name: string
  status: string
  detail: string
  href: string | null
}) {
  const inner = (
    <>
      <p className="font-display text-2xl text-burnt">{name}</p>
      <p className="mt-1 font-mono text-xs font-bold tracking-wider text-coral uppercase">
        {href ? 'open' : status}
      </p>
      <p className="mt-3 text-sm text-driftwood/80">{detail}</p>
    </>
  )
  if (href) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="block rounded-lg border-2 border-burnt/40 bg-shore/60 p-6 transition-transform hover:-translate-y-0.5 hover:border-burnt"
      >
        {inner}
      </a>
    )
  }
  return (
    <div className="rounded-lg border-2 border-dashed border-driftwood/30 bg-shore/40 p-6">
      {inner}
    </div>
  )
}

/** The screenshot-for-the-group-chat moment: a laminated pass to nothing. */
function LineupPass() {
  return (
    <figure className="mx-auto max-w-sm">
      <div className="-rotate-2 rounded-xl border border-driftwood/20 bg-gradient-to-br from-salt via-shore to-salt p-6 shadow-xl ring-4 ring-white/50">
        <div className="flex items-center justify-between">
          <p className="font-display text-xl text-burnt">SURF LINEUP PASS</p>
          <Sun className="h-9 w-9" idSuffix="pass" />
        </div>
        <dl className="mt-4 space-y-1.5 font-mono text-xs text-driftwood">
          <div className="flex justify-between">
            <dt className="opacity-60">MEMBER</dt>
            <dd className="font-bold">Nº 000000</dd>
          </div>
          <div className="flex justify-between">
            <dt className="opacity-60">STATUS</dt>
            <dd className="font-bold">PENDING TIDE</dd>
          </div>
          <div className="flex justify-between">
            <dt className="opacity-60">PRIVILEGES</dt>
            <dd className="font-bold">NONE</dd>
          </div>
          <div className="flex justify-between">
            <dt className="opacity-60">REVOCABLE</dt>
            <dd className="font-bold">NEVER</dd>
          </div>
        </dl>
        <p className="mt-4 border-t border-dashed border-driftwood/30 pt-3 text-center font-mono text-[10px] tracking-wider text-driftwood/60 uppercase">
          valid wherever the tide reaches
        </p>
      </div>
      <figcaption className="mt-4 text-center font-mono text-xs text-driftwood/60">
        Screenshot it. That's the whole onboarding.
      </figcaption>
    </figure>
  )
}

export function Lineup() {
  return (
    <section id="lineup" className="bg-salt px-4 py-20 sm:px-6">
      <div className="mx-auto max-w-5xl">
        <SectionHeading kicker="community, allegedly">The Lineup</SectionHeading>
        <p className="mx-auto mb-10 max-w-2xl text-center text-lg">
          Here's the thing: the X account doesn't exist yet. The Telegram doesn't exist yet. We
          could've shipped fake buttons that go nowhere, but the domain is .fail, not .fraud.
        </p>
        <div className="mb-12 grid gap-5 sm:grid-cols-2">
          <SocialCard
            name="X"
            status="paddling out soon"
            detail={
              'The first post has been through four rounds of review and now reads, in its entirety: “gm.”'
            }
            href={config.links.twitter}
          />
          <SocialCard
            name="Telegram"
            status="shack under construction"
            detail="Same rule as the CA: when it exists, it'll be linked here — from this page or not at all."
            href={config.links.telegram}
          />
        </div>
        <div className="grid items-center gap-12 md:grid-cols-2">
          <div>
            <h3 className="mb-4 font-mono text-sm font-bold tracking-[0.2em] text-burnt uppercase">
              Lineup rules (enforced by vibe)
            </h3>
            <ol className="space-y-3">
              {RULES.map((rule, i) => (
                <li key={i} className="flex gap-3">
                  <span className="font-mono text-sm font-bold text-coral">{i + 1}.</span>
                  <span className="text-driftwood">{rule}</span>
                </li>
              ))}
            </ol>
          </div>
          <LineupPass />
        </div>
      </div>
    </section>
  )
}
