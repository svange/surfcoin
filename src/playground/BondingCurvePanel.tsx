import { useMemo, useState } from 'react'
import {
  bondingProgress,
  buy,
  GRADUATION_SOL,
  KOTH_MARKET_CAP_USD,
  marketCapSol,
  priceCurveSamples,
  sell,
  solRaisedForMarketCapSol,
  spotPriceSol,
  tokensSold,
  TOTAL_SUPPLY,
  VIRTUAL_SOL,
  VIRTUAL_TOKENS,
} from '../lib/bondingCurve'
import { formatUsd } from '../lib/format'
import { chart, Field, inputClass, Panel, Toggle } from './ui'

/** Compact SOL price for sub-cent token prices. */
function fmtSol(n: number): string {
  if (n === 0) return '0'
  if (n >= 1) return n.toFixed(4)
  if (n < 1e-6) return n.toExponential(2)
  return n.toFixed(9).replace(/0+$/, '')
}

function fmtTokens(n: number): string {
  if (Math.abs(n) >= 1e6) return `${(n / 1e6).toFixed(2)}M`
  if (Math.abs(n) >= 1e3) return `${(n / 1e3).toFixed(1)}K`
  return Math.round(n).toLocaleString('en-US')
}

/** SOL raised range to plot — a little past graduation so the tail is visible. */
const PLOT_MAX_SOL = GRADUATION_SOL * 1.25

function CurveViz({
  solRaised,
  solRaisedAfter,
  kothSol,
  solUsd,
}: {
  solRaised: number
  solRaisedAfter: number | null
  kothSol: number | null
  solUsd: number
}) {
  const W = 720
  const H = 260
  const PAD = { top: 14, right: 60, bottom: 26, left: 46 }

  const geom = useMemo(() => {
    const samples = priceCurveSamples(PLOT_MAX_SOL)
    const plotW = W - PAD.left - PAD.right
    const plotH = H - PAD.top - PAD.bottom
    const maxPrice = spotPriceSol(PLOT_MAX_SOL)
    const x = (sol: number) => PAD.left + (sol / PLOT_MAX_SOL) * plotW
    const y = (price: number) => PAD.top + (1 - price / maxPrice) * plotH
    const path = samples
      .map((s, i) => `${i === 0 ? 'M' : 'L'}${x(s.solRaised).toFixed(1)},${y(s.priceSol).toFixed(1)}`)
      .join(' ')
    // Filled area under the traded segment [solRaised, solRaisedAfter].
    let tradeArea: string | null = null
    if (solRaisedAfter !== null && Math.abs(solRaisedAfter - solRaised) > 1e-9) {
      const [lo, hi] = [Math.min(solRaised, solRaisedAfter), Math.max(solRaised, solRaisedAfter)]
      const seg = samples.filter(s => s.solRaised >= lo && s.solRaised <= hi)
      const pts = [
        { solRaised: lo, priceSol: spotPriceSol(lo) },
        ...seg,
        { solRaised: hi, priceSol: spotPriceSol(hi) },
      ]
      tradeArea =
        `M${x(lo).toFixed(1)},${y(0).toFixed(1)} ` +
        pts.map(s => `L${x(s.solRaised).toFixed(1)},${y(s.priceSol).toFixed(1)}`).join(' ') +
        ` L${x(hi).toFixed(1)},${y(0).toFixed(1)} Z`
    }
    const priceTicks = Array.from({ length: 4 }, (_, k) => (maxPrice * (k + 1)) / 4)
    return { plotW, plotH, maxPrice, x, y, path, tradeArea, priceTicks }
  }, [solRaised, solRaisedAfter])

  const marker = (sol: number, color: string, label: string, dashed = false) => {
    if (sol < 0 || sol > PLOT_MAX_SOL) return null
    const mx = geom.x(sol)
    return (
      <g key={label}>
        <line
          x1={mx}
          x2={mx}
          y1={PAD.top}
          y2={H - PAD.bottom}
          stroke={color}
          strokeWidth={1.5}
          strokeDasharray={dashed ? '4 3' : undefined}
          opacity={dashed ? 0.7 : 0.9}
        />
        <circle cx={mx} cy={geom.y(spotPriceSol(sol))} r={3.5} fill={color} />
        <text x={mx} y={PAD.top - 4} fill={color} fontSize={9} fontFamily="monospace" textAnchor="middle">
          {label}
        </text>
      </g>
    )
  }

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="bonding price curve">
      {geom.priceTicks.map((p, k) => (
        <g key={k}>
          <line
            x1={PAD.left}
            x2={W - PAD.right}
            y1={geom.y(p)}
            y2={geom.y(p)}
            stroke={chart.grid}
            strokeWidth={1}
          />
          <text x={PAD.left - 4} y={geom.y(p) + 3} fill={chart.muted} fontSize={8} fontFamily="monospace" textAnchor="end">
            {fmtSol(p)}
          </text>
        </g>
      ))}

      {geom.tradeArea && <path d={geom.tradeArea} fill={chart.up} opacity={0.16} />}
      <path d={geom.path} fill="none" stroke={chart.down} strokeWidth={2} />

      {marker(GRADUATION_SOL, chart.neutral, 'graduate')}
      {kothSol !== null && marker(kothSol, chart.ink, 'KOTH', true)}
      {marker(solRaised, chart.muted, 'now')}
      {solRaisedAfter !== null && marker(solRaisedAfter, chart.up, 'after', true)}

      <text x={PAD.left} y={H - 8} fill={chart.muted} fontSize={8} fontFamily="monospace">
        0 SOL raised
      </text>
      <text x={W - PAD.right} y={H - 8} fill={chart.muted} fontSize={8} fontFamily="monospace" textAnchor="end">
        {PLOT_MAX_SOL.toFixed(0)} SOL · {formatUsd(marketCapSol(PLOT_MAX_SOL) * solUsd)} mcap
      </text>
      <text x={PAD.left} y={PAD.top - 4} fill={chart.muted} fontSize={8} fontFamily="monospace">
        price (SOL/token)
      </text>
    </svg>
  )
}

function Stat({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: string }) {
  return (
    <div className="rounded-lg border border-seafoam/15 bg-night/40 px-3 py-2">
      <p className="font-mono text-[9px] tracking-wider text-seafoam/50 uppercase">{label}</p>
      <p className={`font-mono text-sm ${tone ?? 'text-salt'}`}>{value}</p>
      {sub && <p className="font-mono text-[10px] text-seafoam/50">{sub}</p>}
    </div>
  )
}

/**
 * Self-contained pump.fun bonding-curve calculator. Pick a position on the
 * curve (fresh / KOTH / graduated presets, or drag the slider), quote a buy or
 * sell, and read out tokens, effective price, price impact, market cap, and
 * bonding progress — with the price curve drawn alongside.
 */
export function BondingCurvePanel({ solUsd }: { solUsd: number }) {
  const [solRaised, setSolRaised] = useState(20)
  const [action, setAction] = useState<'buy' | 'sell'>('buy')
  const [amount, setAmount] = useState('1')
  const [applyFee, setApplyFee] = useState(true)

  const feeRate = applyFee ? undefined : 0
  const amt = Number(amount) || 0

  const kothSol = useMemo(
    () => solRaisedForMarketCapSol(KOTH_MARKET_CAP_USD / solUsd),
    [solUsd],
  )

  const quote = useMemo(() => {
    if (action === 'buy') return buy(solRaised, amt, feeRate)
    // Cap a sell at the tokens the curve has actually issued.
    const maxSell = tokensSold(solRaised)
    return sell(solRaised, Math.min(amt, maxSell), feeRate)
  }, [action, solRaised, amt, feeRate])

  const nowPrice = spotPriceSol(solRaised)
  const nowMcapSol = marketCapSol(solRaised)
  const afterMcapSol = marketCapSol(quote.solRaisedAfter)
  const progressNow = bondingProgress(solRaised)
  const progressAfter = bondingProgress(quote.solRaisedAfter)

  const presets: { label: string; sol: number }[] = [
    { label: 'fresh', sol: 0 },
    { label: 'KOTH', sol: Math.max(0, kothSol) },
    { label: 'graduated', sol: GRADUATION_SOL },
  ]

  return (
    <Panel title="Bonding curve calculator">
      <p className="mb-4 font-mono text-[11px] text-seafoam/60">
        The shared pump.fun curve: {VIRTUAL_SOL} virtual SOL + {VIRTUAL_TOKENS.toLocaleString('en-US')}{' '}
        virtual tokens, constant product, {TOTAL_SUPPLY.toLocaleString('en-US')} supply. Graduates to
        Raydium at {GRADUATION_SOL} SOL raised.
      </p>

      {/* curve position */}
      <div className="mb-4 rounded-lg border border-seafoam/15 bg-night/40 p-3">
        <div className="flex items-center justify-between">
          <span className="font-mono text-[10px] tracking-wider text-seafoam/60 uppercase">
            Curve position
          </span>
          <div className="flex gap-1">
            {presets.map(p => (
              <button
                key={p.label}
                type="button"
                onClick={() => setSolRaised(Number(p.sol.toFixed(2)))}
                className="rounded px-2 py-0.5 font-mono text-[10px] text-seafoam/60 hover:bg-seafoam/10 hover:text-seafoam"
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
        <input
          type="range"
          min={0}
          max={PLOT_MAX_SOL}
          step={0.5}
          value={solRaised}
          onChange={e => setSolRaised(Number(e.target.value))}
          className="mt-2 w-full accent-golden"
        />
        <div className="mt-1 flex items-center justify-between font-mono text-[11px] text-seafoam/70">
          <span>
            {solRaised.toFixed(1)} SOL raised · {Math.round(progressNow * 100)}% up the curve
          </span>
          <span className="text-salt">
            {fmtSol(nowPrice)} SOL · {formatUsd(nowMcapSol * solUsd)} mcap
          </span>
        </div>
      </div>

      {/* trade ticket */}
      <div className="grid gap-3 sm:grid-cols-[auto_1fr]">
        <div className="flex gap-2 sm:flex-col">
          {(['buy', 'sell'] as const).map(a => (
            <button
              key={a}
              type="button"
              onClick={() => {
                setAction(a)
                setAmount(a === 'buy' ? '1' : '1000000')
              }}
              className={`flex-1 rounded-lg px-4 py-2 font-mono text-xs font-bold uppercase transition-colors ${
                action === a
                  ? a === 'buy'
                    ? 'bg-seafoam text-night'
                    : 'bg-coral text-night'
                  : 'border border-seafoam/25 text-seafoam/70'
              }`}
            >
              {a}
            </button>
          ))}
        </div>
        <div className="space-y-3">
          <Field label={action === 'buy' ? 'Spend (SOL)' : 'Sell (tokens)'}>
            <input className={inputClass} value={amount} onChange={e => setAmount(e.target.value)} inputMode="decimal" />
          </Field>
          <Toggle checked={applyFee} onChange={setApplyFee} label="apply pump.fun 1% fee" />
        </div>
      </div>

      {/* results */}
      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {action === 'buy' ? (
          <Stat label="Tokens out" value={fmtTokens((quote as ReturnType<typeof buy>).tokensOut)} tone="text-seafoam" />
        ) : (
          <Stat
            label="SOL out"
            value={`${(quote as ReturnType<typeof sell>).solOut.toFixed(4)}`}
            sub={formatUsd((quote as ReturnType<typeof sell>).solOut * solUsd)}
            tone="text-seafoam"
          />
        )}
        <Stat label="Avg price" value={`${fmtSol(quote.avgPriceSol)} SOL`} sub={formatUsd(quote.avgPriceSol * solUsd)} />
        <Stat
          label="Price impact"
          value={`${quote.priceImpactPct >= 0 ? '+' : ''}${quote.priceImpactPct.toFixed(1)}%`}
          tone={quote.priceImpactPct >= 0 ? 'text-seafoam' : 'text-coral'}
        />
        <Stat label="Fee" value={`${quote.fee.toFixed(4)} SOL`} sub={formatUsd(quote.fee * solUsd)} />
        <Stat
          label="New price"
          value={`${fmtSol(quote.spotAfter)} SOL`}
          sub={formatUsd(quote.spotAfter * solUsd)}
        />
        <Stat
          label="New mcap"
          value={formatUsd(afterMcapSol * solUsd)}
          sub={`${Math.round(progressAfter * 100)}% up the curve`}
        />
      </div>

      <div className="mt-4">
        <CurveViz solRaised={solRaised} solRaisedAfter={quote.solRaisedAfter} kothSol={kothSol} solUsd={solUsd} />
      </div>
    </Panel>
  )
}
