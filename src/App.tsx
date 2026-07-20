import { EasterEggs } from './components/EasterEggs'
import { FinePrint } from './components/FinePrint'
import { Hero } from './components/Hero'
import { Lifeguard } from './components/Lifeguard'
import { Lineup } from './components/Lineup'
import { Lore } from './components/Lore'
import { Nav } from './components/Nav'
import { PaddleOut } from './components/PaddleOut'
import { Seagull } from './components/Seagull'
import { SurfReport } from './components/SurfReport'
import { Ticker } from './components/Ticker'
import { TideChart } from './components/TideChart'
import { TideProgress } from './components/TideProgress'
import { WaveDivider } from './components/WaveDivider'
import { Wavenomics } from './components/Wavenomics'
import { hex } from './lib/palette'
import { Toaster } from './lib/toast'

function Squiggle() {
  return (
    <div className="bg-salt py-2" aria-hidden="true">
      <svg viewBox="0 0 120 12" className="mx-auto h-3 w-28 text-coral">
        <path
          d="M2,8 Q12,2 22,8 T42,8 T62,8 T82,8 T102,8 T118,8"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
      </svg>
    </div>
  )
}

export default function App() {
  return (
    <>
      <Ticker />
      <Nav />
      <main>
        <Hero />
        <WaveDivider bgClass="bg-deepset" fill={hex.salt} />
        <Lore />
        <WaveDivider bgClass="bg-salt" fill={hex.deepset} />
        <SurfReport />
        <WaveDivider bgClass="bg-deepset" fill={hex.salt} />
        <Wavenomics />
        <WaveDivider bgClass="bg-salt" fill={hex.shore} />
        <PaddleOut />
        <WaveDivider bgClass="bg-shore" fill={hex.lagoon} />
        <TideChart />
        <WaveDivider bgClass="bg-lagoon" fill={hex.salt} />
        <Lineup />
        <Squiggle />
        <Lifeguard />
        <WaveDivider bgClass="bg-salt" fill={hex.night} />
      </main>
      <FinePrint />
      <div
        className="film-grain pointer-events-none fixed inset-0 z-[60] opacity-[0.05]"
        aria-hidden="true"
      />
      <Toaster />
      <Seagull />
      <TideProgress />
      <EasterEggs />
    </>
  )
}
