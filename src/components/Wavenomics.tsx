import { SectionHeading } from './SectionHeading'
import { Sun } from './Sun'

const ROWS = [
  {
    term: 'total supply',
    copy: '1,000,000,000 $SURF. One billion. We counted the grains of sand on one (1) beach and rounded.',
  },
  { term: 'tax', copy: '0% buy / 0% sell. Taxes are for people with income.' },
  {
    term: 'team allocation',
    copy: '0%. The team buys at launch like everyone else, with money they should be spending on board wax.',
  },
  { term: 'presale', copy: 'None. VCs — none. Insiders — the ocean, arguably.' },
  {
    term: 'liquidity',
    copy: 'Fair-launched on pump.fun. On graduation, LP gets burned like an Irish tourist in Byron Bay.',
  },
  {
    term: 'mint',
    copy: "Handled by pump.fun's bonding curve, the closest thing this coin has to adult supervision.",
  },
  {
    term: 'audit',
    copy: 'The contract is a standard pump.fun deployment, reviewed extensively by no one of note.',
  },
  {
    term: 'utility',
    copy: "None. It floats. Some days that's more than the rest of your portfolio can say.",
  },
]

export function Wavenomics() {
  return (
    <section id="wavenomics" className="bg-salt px-4 py-20 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <SectionHeading kicker="tokenomics, but honest">Wavenomics</SectionHeading>
        <div className="grid items-start gap-12 md:grid-cols-[3fr_2fr]">
          <dl className="divide-y divide-driftwood/15">
            {ROWS.map(r => (
              <div key={r.term} className="grid gap-1 py-4 sm:grid-cols-[160px_1fr] sm:gap-6">
                <dt className="font-mono text-sm font-bold tracking-wider text-burnt uppercase">
                  {r.term}
                </dt>
                <dd className="text-driftwood">{r.copy}</dd>
              </div>
            ))}
          </dl>
          <figure className="mx-auto text-center">
            <Sun className="mx-auto h-56 w-56" idSuffix="pie" />
            <figcaption className="mt-4 font-mono text-xs text-driftwood/70">
              Fig. 1 — supply distribution. One slice: 100% vibes.
            </figcaption>
          </figure>
        </div>
        <p className="mx-auto mt-10 max-w-2xl text-center font-bold text-driftwood">
          That's it. That's the wavenomics. No pie chart with 14 slices. The pie is the sun. The
          sun is round. Everything else is marketing.
        </p>
      </div>
    </section>
  )
}
