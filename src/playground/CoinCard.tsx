import type { HeldCoin, PumpCoin } from '../../shared/types'
import { formatUsd, truncateAddress } from '../lib/format'
import { chart, safeImageUrl } from './ui'

function BondingBar({ progress }: { progress: number }) {
  return (
    <div className="mt-2">
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-seafoam/15">
        <div
          className="h-full rounded-full"
          style={{ width: `${Math.round(progress * 100)}%`, background: chart.neutral }}
        />
      </div>
      <p className="mt-1 font-mono text-[9px] text-seafoam/50">
        {Math.round(progress * 100)}% up the bonding curve
      </p>
    </div>
  )
}

export function CoinCard({
  coin,
  onSelect,
  selected,
}: {
  coin: PumpCoin | HeldCoin
  onSelect: () => void
  selected: boolean
}) {
  const held = 'balance' in coin ? coin : null
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full rounded-lg border p-3 text-left transition-colors ${
        selected
          ? 'border-golden bg-golden/10'
          : 'border-seafoam/15 bg-night/40 hover:border-seafoam/40'
      }`}
    >
      <div className="flex items-center gap-3">
        {safeImageUrl(coin.imageUri) ? (
          <img
            src={safeImageUrl(coin.imageUri)!}
            alt=""
            className="h-9 w-9 shrink-0 rounded-full object-cover"
            loading="lazy"
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="h-9 w-9 shrink-0 rounded-full bg-seafoam/15" />
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate font-mono text-sm font-bold text-salt">{coin.symbol}</p>
          <p className="truncate font-mono text-[10px] text-seafoam/60">
            {truncateAddress(coin.mint, 4)}
          </p>
        </div>
        <div className="text-right">
          {held ? (
            <>
              <p className="font-mono text-xs text-seafoam">
                {held.valueUsd !== null ? formatUsd(held.valueUsd) : '—'}
              </p>
              <p className="font-mono text-[10px] text-seafoam/50">
                {held.balance.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </p>
            </>
          ) : (
            <p className="font-mono text-xs text-seafoam">
              {coin.marketCapUsd !== null ? formatUsd(coin.marketCapUsd) : '—'}
            </p>
          )}
        </div>
      </div>
      {coin.bondingProgress !== null && !coin.complete && (
        <BondingBar progress={coin.bondingProgress} />
      )}
      {coin.complete && (
        <p className="mt-1.5 font-mono text-[9px] tracking-wider text-seafoam/50 uppercase">
          graduated · trades on AMM
        </p>
      )}
    </button>
  )
}
