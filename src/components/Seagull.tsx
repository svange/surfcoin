import { useEffect, useState } from 'react'

/** A lone seagull crosses the sky every 25-70 seconds. Blink and you miss it. */
export function Seagull() {
  const [flying, setFlying] = useState(false)

  useEffect(() => {
    let scheduleT = 0
    let flightT = 0
    function schedule() {
      scheduleT = window.setTimeout(
        () => {
          setFlying(true)
          flightT = window.setTimeout(() => {
            setFlying(false)
            schedule()
          }, 14_000)
        },
        25_000 + Math.random() * 45_000,
      )
    }
    schedule()
    return () => {
      clearTimeout(scheduleT)
      clearTimeout(flightT)
    }
  }, [])

  if (!flying) return null
  return (
    <div
      className="pointer-events-none fixed top-[16%] left-0 z-30"
      style={{ animation: 'seagull-cross 14s linear both' }}
      aria-hidden="true"
    >
      <svg width="26" height="12" viewBox="0 0 26 12">
        <path
          d="M1,9 Q7,2 13,9 M13,9 Q19,2 25,9"
          fill="none"
          stroke="#5C3A21"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
    </div>
  )
}
