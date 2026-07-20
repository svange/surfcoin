const LINES = [
  "$SURF on Solana — the water's warm, the fees are low",
  'no utility. it floats.',
  'the .fail is honesty, priced in',
  'CA: soon — sunset: daily',
  'zoom out. paddle out.',
  'wipeouts are just re-entries',
  'fair launch. unfair tan.',
  'AUDITED BY NO ONE OF NOTE',
  'hold loose, like your grip on the board',
  '1,000,000,000 supply. one ocean.',
  'sharks DM first. we never will.',
  'gm forever',
]

/**
 * The degen recognition signal, at walking pace. Content is doubled for a
 * seamless -50% loop; a lone shark fin rides a faster lane and laps the text.
 * Hovering pauses everything — leisure is a feature.
 */
export function Ticker() {
  const row = LINES.map((line, i) => (
    <span key={i} className="mx-5 inline-flex items-center gap-5">
      <span>{line}</span>
      <span aria-hidden="true" className="text-burnt">
        ☼
      </span>
    </span>
  ))
  return (
    <div className="group relative overflow-hidden bg-golden py-1.5 font-mono text-xs font-bold tracking-wide whitespace-nowrap text-driftwood uppercase select-none">
      <div className="animate-marquee inline-block group-hover:[animation-play-state:paused]">
        {row}
        <span aria-hidden="true">{row}</span>
      </div>
      <div
        aria-hidden="true"
        className="animate-marquee-fin absolute inset-y-0 inline-flex items-center group-hover:[animation-play-state:paused]"
      >
        <span className="inline-block w-[70vw]" />
        🦈
        <span className="inline-block w-[130vw]" />
        🦈
      </div>
      <span className="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 rounded-sm bg-driftwood px-1.5 py-0.5 text-[10px] text-salt opacity-0 transition-opacity duration-300 group-hover:opacity-100">
        PAUSED FOR LEISURE
      </span>
    </div>
  )
}
