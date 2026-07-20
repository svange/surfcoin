import { dexScreenerUrl, isLive } from '../config'
import { useMarketData } from '../hooks/useMarketData'
import { formatPercent, formatUsd } from '../lib/format'
import { SectionHeading } from './SectionHeading'

interface Tile {
  label: string
  value: string
  note?: string
}

const PRELAUNCH_TILES: Tile[] = [
  { label: 'market cap', value: '$0', note: 'a perfect, round, un-ruggable number' },
  { label: 'holders', value: '1', note: '(you, spiritually)' },
  { label: '24h volume', value: "the ocean's", note: 'not ours. yet.' },
  { label: 'all-time high', value: '6:47 PM', note: 'sunset. daily. without fail.' },
  { label: 'wind (fud)', value: 'offshore, light', note: 'nobody cares about us yet. this is the good part.' },
  { label: 'liquidity', value: 'the Pacific', note: 'pending' },
]

// Coin is minted but still on the pump.fun bonding curve, so DexScreener has no
// pair yet. Honest "it's live, data's catching up" state — not the $0 joke.
const LAUNCHING_TILES: Tile[] = [
  { label: 'market cap', value: 'on the curve', note: 'climbing the bonding curve' },
  { label: 'holders', value: 'more than 1', note: 'the lineup is filling in' },
  { label: '24h volume', value: 'live', note: 'the swell just arrived' },
  { label: 'all-time high', value: '6:47 PM', note: 'sunset. daily. without fail.' },
  { label: 'status', value: 'pre-graduation', note: 'charts land on DexScreener at graduation' },
  { label: 'liquidity', value: 'bonding', note: 'burns on graduation' },
]

function StatTile({ tile }: { tile: Tile }) {
  return (
    <div className="rounded-lg border border-seafoam/25 bg-night/40 p-5">
      <p className="font-mono text-[11px] tracking-[0.2em] text-seafoam uppercase">
        {tile.label}
      </p>
      <p className="mt-1.5 font-mono text-2xl font-bold break-words text-salt">{tile.value}</p>
      {tile.note && <p className="mt-1 font-mono text-xs text-seafoam/85">{tile.note}</p>}
    </div>
  )
}

export function SurfReport() {
  const market = useMarketData()

  const tiles: Tile[] = market
    ? [
        { label: 'price', value: formatUsd(market.priceUsd) },
        { label: 'market cap', value: formatUsd(market.marketCap) },
        { label: '24h volume', value: formatUsd(market.volume24h) },
        {
          label: '24h swell',
          value: formatPercent(market.priceChange24h),
          note: market.priceChange24h >= 0 ? 'clean faces' : "the water's reloading",
        },
        { label: 'liquidity', value: formatUsd(market.liquidityUsd) },
        { label: 'all-time high', value: '6:47 PM', note: 'sunset. daily. without fail.' },
      ]
    : isLive
      ? LAUNCHING_TILES
      : PRELAUNCH_TILES

  return (
    <section id="report" className="bg-deepset px-4 py-20 text-salt sm:px-6">
      <div className="mx-auto max-w-5xl">
        <SectionHeading kicker="updated whenever" colorClass="text-golden" kickerClass="text-seafoam/60">
          Today's Surf Report
        </SectionHeading>
        <p className="mb-10 text-center font-mono text-sm text-seafoam">
          {isLive && market ? (
            <>CONDITIONS: Live. Rideable. Trading on Solana — keep your leash on.</>
          ) : isLive ? (
            <>CONDITIONS: Just launched. Still on the bonding curve — DexScreener catches the swell after graduation.</>
          ) : (
            <>CONDITIONS: Flat. Glassy. Pre-launch. A chart never looks better than right before it exists.</>
          )}
        </p>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
          {tiles.map(t => (
            <StatTile key={t.label} tile={t} />
          ))}
        </div>
        {dexScreenerUrl && (
          <p className="mt-8 text-center">
            <a
              href={dexScreenerUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono text-sm font-bold text-golden underline decoration-dotted underline-offset-4 hover:text-coral"
            >
              full chart on DexScreener →
            </a>
          </p>
        )}
        {!isLive && (
          <p className="mx-auto mt-10 max-w-xl text-center text-sm text-seafoam/80">
            The contract address is still in the shaping bay. It appears at the top of this page
            at launch — and nowhere else first.
          </p>
        )}
        <p className="mt-6 text-center font-mono text-xs text-seafoam/50 italic">
          Real surfers love a flat spell. Builds character. And dip-buying discipline.
        </p>
      </div>
    </section>
  )
}
