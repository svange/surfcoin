import { useEffect, useRef } from 'react'

/** Scroll progress as a rising tide along the left edge, buoy riding the top. */
export function TideProgress() {
  const fillRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let raf = 0
    function onScroll() {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        const max = document.documentElement.scrollHeight - window.innerHeight
        const p = max > 0 ? window.scrollY / max : 0
        if (fillRef.current) fillRef.current.style.height = `${p * 100}%`
      })
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      cancelAnimationFrame(raf)
    }
  }, [])

  return (
    <div
      className="pointer-events-none fixed inset-y-0 left-0 z-30 hidden w-[3px] md:block"
      aria-hidden="true"
    >
      <div ref={fillRef} className="absolute bottom-0 w-full bg-seafoam/60" style={{ height: 0 }}>
        <span className="absolute -top-1.5 -left-[4px] h-2.5 w-2.5 rounded-full bg-coral shadow" />
      </div>
    </div>
  )
}
