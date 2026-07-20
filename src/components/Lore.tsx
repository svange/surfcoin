import { hex } from '../lib/palette'
import { SectionHeading } from './SectionHeading'
import { Sun } from './Sun'

/** Sun-faded postcard: the closest thing $SURF has to brand collateral. */
function Postcard() {
  return (
    <figure className="animate-bob mx-auto w-64 rotate-2 rounded-lg border-4 border-salt bg-shore p-3 shadow-xl sm:w-72">
      <div
        className="relative overflow-hidden rounded-sm"
        role="img"
        aria-label="a sun-faded postcard of a sunset over the ocean, which is also the entire business plan"
      >
        <div
          className="h-40 w-full"
          style={{
            background: `linear-gradient(180deg, ${hex.dusk}, ${hex.coral} 55%, ${hex.golden})`,
          }}
        />
        <Sun className="absolute top-6 left-1/2 h-20 w-20 -translate-x-1/2" idSuffix="postcard" />
        <svg
          viewBox="0 0 288 40"
          className="absolute bottom-0 w-full"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <path
            d="M0,20 C48,8 96,28 144,18 C192,8 240,28 288,16 L288,40 L0,40 Z"
            fill={hex.deepset}
          />
        </svg>
      </div>
      <figcaption className="pt-2 text-center font-mono text-[11px] text-driftwood/70">
        greetings from surfcoin.fail — wish you were liquid
      </figcaption>
    </figure>
  )
}

export function Lore() {
  return (
    <section id="lore" className="bg-salt px-4 py-20 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <SectionHeading kicker="the origin story, roughly">The Legend of $SURF</SectionHeading>
        <div className="grid items-center gap-12 md:grid-cols-[3fr_2fr]">
          <div className="space-y-5 text-lg leading-relaxed">
            <p>
              In the winter of never, a longboarder known only as Dale found a Ledger Nano in a
              tide pool. The seed phrase was written on the back in zinc sunscreen. Twelve words.
              All of them were &ldquo;chill.&rdquo;
            </p>
            <p>
              That wallet became $SURF: a coin with no whitepaper, no venture round, and no
              particular hurry. It doesn't promise you a lambo — lambos are terrible on sand. It
              promises what the ocean promises everyone: another wave, eventually, if you sit
              still long enough to see it.
            </p>
            <p>
              $SURF is what happens when a memecoin stops paddling and starts floating. It's on
              Solana because the fees are low and the water's warm. It lives at surfcoin.fail
              because we looked up the stats on coins like this one and decided to be the first
              honest domain in crypto.
            </p>
            <p className="font-bold text-burnt">
              There is no utility. There is a sunset. Most utilities can't do that.
            </p>
          </div>
          <Postcard />
        </div>
      </div>
    </section>
  )
}
