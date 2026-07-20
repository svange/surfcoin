import { useInView } from '../hooks/useInView'

interface SectionHeadingProps {
  children: string
  /** Tailwind text color class; defaults to burnt orange on light sections. */
  colorClass?: string
  kicker?: string
  kickerClass?: string
}

/** Vintage title card: fades up while letter-spacing settles from wide to tight. */
export function SectionHeading({
  children,
  colorClass = 'text-burnt',
  kicker,
  kickerClass = 'text-driftwood/60',
}: SectionHeadingProps) {
  const { ref, inView } = useInView<HTMLDivElement>()
  return (
    <div ref={ref} className="mb-10 text-center">
      {kicker && (
        <p className={`mb-2 font-mono text-xs tracking-[0.3em] uppercase ${kickerClass}`}>
          {kicker}
        </p>
      )}
      <h2
        className={`title-card ${inView ? 'is-in' : ''} font-display -rotate-1 text-4xl sm:text-5xl ${colorClass}`}
      >
        {children}
      </h2>
    </div>
  )
}
