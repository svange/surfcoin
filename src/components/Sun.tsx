import { hex } from '../lib/palette'

interface SunProps {
  className?: string
  /** Unique per instance so gradient/mask ids don't collide. */
  idSuffix?: string
}

/** Classic 70s surf-poster sun: warm gradient disc with horizontal slats. */
export function Sun({ className, idSuffix = 'main' }: SunProps) {
  const grad = `sun-grad-${idSuffix}`
  const mask = `sun-mask-${idSuffix}`
  return (
    <svg viewBox="0 0 200 200" className={className} aria-hidden="true">
      <defs>
        <linearGradient id={grad} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={hex.golden} />
          <stop offset="70%" stopColor={hex.coral} />
          <stop offset="100%" stopColor={hex.burnt} />
        </linearGradient>
        <mask id={mask}>
          <circle cx="100" cy="100" r="92" fill="white" />
          <rect x="0" y="116" width="200" height="4" fill="black" />
          <rect x="0" y="130" width="200" height="6" fill="black" />
          <rect x="0" y="147" width="200" height="9" fill="black" />
          <rect x="0" y="168" width="200" height="13" fill="black" />
        </mask>
      </defs>
      <circle cx="100" cy="100" r="92" fill={`url(#${grad})`} mask={`url(#${mask})`} />
    </svg>
  )
}
