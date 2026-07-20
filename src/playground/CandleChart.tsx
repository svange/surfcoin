import { useMemo, useRef, useState } from 'react'
import type { Candle } from '../../shared/types'
import { chart } from './ui'

/**
 * Hand-rolled SVG candlestick chart. A dedicated lib (lightweight-charts) is
 * overkill for a read-only pane and would ship a canvas renderer we'd have to
 * theme separately; SVG inherits the site's palette and stays crisp.
 *
 * Follows the dataviz interaction spec: a crosshair snaps to the nearest
 * candle and one tooltip reads out OHLC. Up = aqua, down = coral (identity is
 * also the candle's fill, never color-on-text).
 */

const W = 720
const H = 320
const PAD = { top: 12, right: 56, bottom: 22, left: 8 }
const VOL_H = 46

function fmtPrice(n: number): string {
  if (n === 0) return '0'
  if (n >= 1) return n.toFixed(4)
  // show 3 significant digits for sub-dollar memecoin prices
  const s = n.toExponential(2)
  return Number(s) < 0.0001 ? s : n.toFixed(8).replace(/0+$/, '')
}

function fmtTime(sec: number): string {
  const d = new Date(sec * 1000)
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

export function CandleChart({ candles }: { candles: Candle[] }) {
  const svgRef = useRef<SVGSVGElement>(null)
  const [hover, setHover] = useState<number | null>(null)

  const geom = useMemo(() => {
    if (candles.length === 0) return null
    const plotW = W - PAD.left - PAD.right
    const priceH = H - PAD.top - PAD.bottom - VOL_H
    const lo = Math.min(...candles.map(c => c.low))
    const hi = Math.max(...candles.map(c => c.high))
    const span = hi - lo || hi || 1
    const maxVol = Math.max(...candles.map(c => c.volume), 1e-9)
    const n = candles.length
    const slot = plotW / n
    const bodyW = Math.max(1, Math.min(14, slot * 0.7))

    const yPrice = (p: number) => PAD.top + (1 - (p - lo) / span) * priceH
    const xCenter = (i: number) => PAD.left + slot * (i + 0.5)
    const volTop = PAD.top + priceH + 10
    const yVol = (v: number) => volTop + (1 - v / maxVol) * (VOL_H - 10)

    const ticks = Array.from({ length: 5 }, (_, k) => lo + (span * k) / 4)
    return { plotW, priceH, lo, hi, span, slot, bodyW, yPrice, xCenter, volTop, yVol, ticks, n }
  }, [candles])

  if (!geom) return null

  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const rect = svgRef.current!.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * W
    const i = Math.floor((x - PAD.left) / geom.slot)
    setHover(i >= 0 && i < geom.n ? i : null)
  }

  const hc = hover !== null ? candles[hover] : null

  return (
    <div className="relative">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        className="w-full touch-none"
        role="img"
        aria-label="price candlestick chart"
        onPointerMove={onMove}
        onPointerLeave={() => setHover(null)}
      >
        {geom.ticks.map((t, k) => (
          <g key={k}>
            <line
              x1={PAD.left}
              x2={W - PAD.right}
              y1={geom.yPrice(t)}
              y2={geom.yPrice(t)}
              stroke={chart.grid}
              strokeWidth={1}
            />
            <text
              x={W - PAD.right + 4}
              y={geom.yPrice(t) + 3}
              fill={chart.muted}
              fontSize={9}
              fontFamily="monospace"
            >
              {fmtPrice(t)}
            </text>
          </g>
        ))}

        {candles.map((c, i) => {
          const up = c.close >= c.open
          const color = up ? chart.up : chart.down
          const cx = geom.xCenter(i)
          const yO = geom.yPrice(c.open)
          const yC = geom.yPrice(c.close)
          const bodyTop = Math.min(yO, yC)
          const bodyH = Math.max(1, Math.abs(yC - yO))
          return (
            <g key={i}>
              <line
                x1={cx}
                x2={cx}
                y1={geom.yPrice(c.high)}
                y2={geom.yPrice(c.low)}
                stroke={color}
                strokeWidth={1}
              />
              <rect
                x={cx - geom.bodyW / 2}
                y={bodyTop}
                width={geom.bodyW}
                height={bodyH}
                fill={color}
                rx={0.5}
              />
              <rect
                x={cx - geom.bodyW / 2}
                y={geom.yVol(c.volume)}
                width={geom.bodyW}
                height={geom.volTop + VOL_H - 10 - geom.yVol(c.volume)}
                fill={color}
                opacity={0.35}
              />
            </g>
          )
        })}

        {hover !== null && hc && (
          <line
            x1={geom.xCenter(hover)}
            x2={geom.xCenter(hover)}
            y1={PAD.top}
            y2={H - PAD.bottom}
            stroke={chart.ink}
            strokeWidth={1}
            strokeDasharray="3 3"
            opacity={0.4}
          />
        )}
        <text x={PAD.left} y={H - 6} fill={chart.muted} fontSize={9} fontFamily="monospace">
          {fmtTime(candles[0].time)}
        </text>
        <text
          x={W - PAD.right}
          y={H - 6}
          fill={chart.muted}
          fontSize={9}
          fontFamily="monospace"
          textAnchor="end"
        >
          {fmtTime(candles[candles.length - 1].time)}
        </text>
      </svg>

      {hc && (
        <div className="pointer-events-none absolute top-2 left-2 rounded-md border border-seafoam/25 bg-night/95 px-3 py-2 font-mono text-[10px] text-salt">
          <div className="text-seafoam/70">{fmtTime(hc.time)}</div>
          <div className="mt-1 grid grid-cols-2 gap-x-3 gap-y-0.5">
            <span className="text-seafoam/60">O</span>
            <span className="text-right">{fmtPrice(hc.open)}</span>
            <span className="text-seafoam/60">H</span>
            <span className="text-right">{fmtPrice(hc.high)}</span>
            <span className="text-seafoam/60">L</span>
            <span className="text-right">{fmtPrice(hc.low)}</span>
            <span className="text-seafoam/60">C</span>
            <span
              className="text-right font-bold"
              style={{ color: hc.close >= hc.open ? chart.up : chart.down }}
            >
              {fmtPrice(hc.close)}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
