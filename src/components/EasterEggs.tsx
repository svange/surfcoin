import { useEffect, useRef, useState } from 'react'
import { toast } from '../lib/toast'

let consoleLogged = false

const WAVE_ART = String.raw`
      ~~~~     ~~~~     ~~~~
   ~~~    ~~~~~    ~~~~~    ~~~
  $SURF · surfcoin.fail · gm
`

/**
 * Everything that rewards the curious: the console note, the tab-title swap,
 * typing s-u-r-f, the favicon sun that sets as you scroll, and the sea-floor
 * toast for anyone who reads all the way down.
 */
export function EasterEggs() {
  const [foam, setFoam] = useState(false)
  const foamFired = useRef(false)

  useEffect(() => {
    if (consoleLogged) return
    consoleLogged = true
    console.log(`%c${WAVE_ART}`, 'color:#F5A83C;font-weight:bold')
    console.log(
      "%cYou checked the console. Certified degen. The CA isn't in here either — and the seed phrase is not in the source. We checked.",
      'color:#14535D',
    )
  }, [])

  useEffect(() => {
    const original = document.title
    let t: number | undefined
    function onVis() {
      if (document.hidden) {
        document.title = 'paddling out...'
        t = window.setTimeout(() => {
          document.title = 'come back — golden hour is peaking'
        }, 15_000)
      } else {
        if (t) clearTimeout(t)
        document.title = original
      }
    }
    document.addEventListener('visibilitychange', onVis)
    return () => {
      document.removeEventListener('visibilitychange', onVis)
      if (t) clearTimeout(t)
    }
  }, [])

  useEffect(() => {
    let buffer = ''
    function onKey(e: KeyboardEvent) {
      if (e.key.length !== 1) return
      buffer = (buffer + e.key.toLowerCase()).slice(-4)
      if (buffer === 'surf' && !foamFired.current) {
        foamFired.current = true
        setFoam(true)
        setTimeout(() => setFoam(false), 1_900)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    const link = document.getElementById('favicon') as HTMLLinkElement | null
    if (!link) return
    const originalHref = link.href
    // Four suns, each a step lower; the last one has set behind the wave.
    const favicons = [10, 14, 18, 24].map(
      cy =>
        'data:image/svg+xml,' +
        encodeURIComponent(
          `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="7" fill="#AE4B63"/><circle cx="16" cy="${cy}" r="7" fill="#F5A83C"/><path d="M0,22 Q8,18 16,22 T32,22 L32,32 L0,32 Z" fill="#14535D"/></svg>`,
        ),
    )
    let bucket = -1
    let raf = 0
    function onScroll() {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        const max = document.documentElement.scrollHeight - window.innerHeight
        const p = max > 0 ? window.scrollY / max : 0
        const b = Math.min(3, Math.floor(p * 4))
        if (b !== bucket && link) {
          bucket = b
          link.href = favicons[b]
        }
      })
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      cancelAnimationFrame(raf)
      link.href = originalHref
    }
  }, [])

  useEffect(() => {
    const el = document.getElementById('sea-floor')
    if (!el) return
    const obs = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting) {
        toast('You have now read more of this site than the dev.')
        obs.disconnect()
      }
    })
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  if (!foam) return null
  return (
    <div className="pointer-events-none fixed inset-0 z-50" aria-hidden="true">
      <div
        className="absolute inset-y-0 w-[60vw]"
        style={{
          background:
            'linear-gradient(90deg, transparent, rgba(159,211,199,0.9), rgba(247,237,218,0.95), transparent)',
          animation: 'foam-wash 1.7s ease-in both',
        }}
      />
    </div>
  )
}
