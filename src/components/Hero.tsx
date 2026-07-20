import { useEffect, useRef, useState } from 'react'
import { isLive, pumpFunUrl } from '../config'
import { hex } from '../lib/palette'
import { toast } from '../lib/toast'
import { CABar } from './CABar'
import { Sun } from './Sun'

const DISABLED_TOOLTIPS = ['flat day', 'lifeguard says no', 'wax still drying']

function BuyButton() {
  const [hovers, setHovers] = useState(0)
  if (isLive) {
    return (
      <a
        href={pumpFunUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="rounded-full bg-burnt px-8 py-3.5 text-lg font-bold text-salt shadow-lg transition-transform hover:scale-105 hover:bg-dusk"
      >
        Paddle Out — buy on pump.fun
      </a>
    )
  }
  const label = hovers >= 3 ? "(it's pre-launch, champ)" : 'Paddle Out — buy at launch'
  return (
    <div className="flex flex-col items-center gap-1.5">
      <button
        disabled
        onMouseEnter={() => setHovers(h => h + 1)}
        title={DISABLED_TOOLTIPS[Math.min(hovers, DISABLED_TOOLTIPS.length - 1)]}
        className="cursor-not-allowed rounded-full bg-burnt/50 px-8 py-3.5 text-lg font-bold text-salt/80 shadow-lg"
      >
        {label}
      </button>
      <span className="font-mono text-xs font-bold text-night/75 italic">
        The buy button is asleep until launch. It dreams of candles.
      </span>
    </div>
  )
}

/** Three foam waves wash the screen when someone clicks the sun 7 times. */
function SwellOfTheDay() {
  return (
    <div className="pointer-events-none fixed inset-0 z-50" aria-hidden="true">
      {[0, 1, 2].map(i => (
        <div
          key={i}
          className="absolute right-0 left-0 h-1/3 opacity-80"
          style={{
            top: `${i * 33}%`,
            background: `linear-gradient(90deg, transparent, ${hex.seafoam}, ${hex.salt}, transparent)`,
            animation: `swell-wave 1.4s ease-in ${i * 0.25}s both`,
          }}
        />
      ))}
    </div>
  )
}

export function Hero() {
  const sunRef = useRef<HTMLDivElement>(null)
  const sectionRef = useRef<HTMLElement>(null)
  const [sunClicks, setSunClicks] = useState(0)
  const [swell, setSwell] = useState(false)

  // The sun sets as you scroll — transform only, no re-renders. Skipped
  // entirely for visitors who prefer reduced motion.
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    let raf = 0
    function onScroll() {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        const heroH = sectionRef.current?.offsetHeight ?? window.innerHeight
        const progress = Math.min(1, window.scrollY / (heroH * 0.9))
        if (sunRef.current) {
          // Keep the -50% X centering (Tailwind's class is overridden by this
          // inline transform) while sliding the sun down toward the horizon.
          sunRef.current.style.transform = `translate(-50%, ${progress * 220}px)`
        }
      })
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      cancelAnimationFrame(raf)
    }
  }, [])

  function handleSunClick() {
    const n = sunClicks + 1
    setSunClicks(n)
    if (n === 7) {
      setSwell(true)
      toast('swell of the day')
      setTimeout(() => setSwell(false), 2500)
    }
  }

  return (
    <section
      id="top"
      ref={sectionRef}
      className="relative flex min-h-[92vh] flex-col items-center justify-center overflow-hidden px-4 pt-16 pb-40 text-center"
      style={{
        background: `linear-gradient(180deg, ${hex.dusk} 0%, ${hex.coral} 45%, ${hex.golden} 78%, ${hex.shore} 100%)`,
      }}
    >
      {swell && <SwellOfTheDay />}

      <div
        ref={sunRef}
        className="absolute top-[16%] left-1/2 -translate-x-1/2 will-change-transform"
      >
        <button
          onClick={handleSunClick}
          aria-label="the sun"
          className="cursor-default rounded-full border-none bg-transparent p-0 focus-visible:ring-4 focus-visible:ring-salt/70 focus-visible:outline-none"
        >
          <Sun className="h-52 w-52 opacity-95 sm:h-72 sm:w-72" idSuffix="hero" />
        </button>
      </div>

      <div className="relative z-10 flex w-full max-w-2xl flex-col items-center gap-6">
        <span className="rounded-full border border-salt/50 bg-night/30 px-4 py-1.5 font-mono text-[11px] font-bold tracking-[0.2em] text-salt uppercase backdrop-blur-sm">
          {isLive ? 'live on pump.fun' : 'pre-launch — currently waxing the board'}
        </span>
        <h1 className="font-display max-w-3xl -rotate-1 text-[2rem] leading-tight text-salt drop-shadow-[0_3px_0_rgba(92,58,33,0.35)] sm:text-6xl lg:text-7xl">
          Surf's up.
          <br />
          Expectations down.
        </h1>
        <p className="max-w-xl text-lg font-bold text-night/80">
          $SURF is a golden-hour daydream on Solana. No utility, no promises, no rush — a fair
          launch on pump.fun, LP that burns like an August shoulder on graduation, and a domain
          that's been honest since day one. Paddle out, zoom out, float.
        </p>
        <div className="flex flex-col items-center gap-4 sm:flex-row">
          <BuyButton />
          <a
            href="#tide-chart"
            className="rounded-full border-2 border-night/60 px-6 py-3 font-bold text-night/80 transition-colors hover:bg-night/10"
          >
            Read the Tide Chart
          </a>
        </div>
        <CABar
          microcopy={
            <span className="text-night/70">
              surfcoin.fail — the URL is the risk disclosure. The only real $SURF CA will appear
              right here. Every other SURF is a different, worse wipeout.
            </span>
          }
        />
      </div>

      {/* Ocean horizon: three teal swells stacked at the shoreline. */}
      <div className="absolute right-0 bottom-0 left-0" aria-hidden="true">
        <svg viewBox="0 0 1440 160" preserveAspectRatio="none" className="block h-28 w-full sm:h-40">
          <path
            d="M0,80 C240,40 480,110 720,80 C960,50 1200,110 1440,70 L1440,160 L0,160 Z"
            fill={hex.seafoam}
            opacity="0.5"
          />
          <path
            d="M0,100 C280,70 520,130 760,100 C1000,70 1240,130 1440,95 L1440,160 L0,160 Z"
            fill={hex.deepset}
            opacity="0.75"
          />
          <path
            d="M0,125 C320,95 640,150 960,120 C1180,100 1320,140 1440,120 L1440,160 L0,160 Z"
            fill={hex.deepset}
          />
        </svg>
      </div>
    </section>
  )
}
