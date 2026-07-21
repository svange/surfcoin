import { lazy, StrictMode, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import './index.css'
import App from './App'

// Code-split: the marketing page ships none of the playground (auth, wallet,
// charts) and vice versa. The public /coins page is also its own lean chunk.
const PlaygroundPage = lazy(() => import('./playground/PlaygroundPage'))
const CoinsPage = lazy(() => import('./coins/CoinsPage'))

function PlaygroundFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-night">
      <p className="font-mono text-sm text-seafoam">paddling out…</p>
    </div>
  )
}

function CoinsFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-salt">
      <p className="font-mono text-sm text-driftwood/60">checking the lineup…</p>
    </div>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App />} />
        <Route
          path="/coins"
          element={
            <Suspense fallback={<CoinsFallback />}>
              <CoinsPage />
            </Suspense>
          }
        />
        <Route
          path="/playground"
          element={
            <Suspense fallback={<PlaygroundFallback />}>
              <PlaygroundPage />
            </Suspense>
          }
        />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
)
