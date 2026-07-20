interface WaveDividerProps {
  /** Background of the section above (tailwind class, e.g. "bg-deepset"). */
  bgClass: string
  /** Fill color of the incoming wave — the section below's background hex. */
  fill: string
}

/**
 * One period of wave, drawn twice across a 2880-wide viewBox so a -50%
 * translateX loop is seamless. Three depths drifting at different speeds.
 */
const WAVE_D =
  'M0,50 ' +
  'C120,20 240,20 360,50 C480,80 600,80 720,50 C840,20 960,20 1080,50 C1200,80 1320,80 1440,50 ' +
  'C1560,20 1680,20 1800,50 C1920,80 2040,80 2160,50 C2280,20 2400,20 2520,50 C2640,80 2760,80 2880,50 ' +
  'L2880,90 L0,90 Z'

function WaveLayer({ fill, opacity, animation, offsetY }: {
  fill: string
  opacity: number
  animation: string
  offsetY: number
}) {
  return (
    // The drift animation drives `transform` (translateX), so the vertical
    // offset must ride on `bottom` — an inline transform here would be clobbered
    // by the keyframes and every layer would stack at the same height.
    <svg
      className={`absolute left-0 h-full w-[200%] ${animation}`}
      style={{ bottom: `${-offsetY}px` }}
      viewBox="0 0 2880 90"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <path d={WAVE_D} fill={fill} opacity={opacity} />
    </svg>
  )
}

export function WaveDivider({ bgClass, fill }: WaveDividerProps) {
  return (
    <div className={`relative h-16 overflow-hidden sm:h-20 ${bgClass}`} aria-hidden="true">
      <WaveLayer fill={fill} opacity={0.3} animation="animate-drift-slow" offsetY={-14} />
      <WaveLayer fill={fill} opacity={0.5} animation="animate-drift-mid" offsetY={-7} />
      <WaveLayer fill={fill} opacity={1} animation="animate-drift-fast" offsetY={0} />
    </div>
  )
}
