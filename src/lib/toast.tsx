import { useEffect, useState } from 'react'

type Listener = (msg: string) => void

let listener: Listener | null = null
let nextId = 0

export function toast(msg: string) {
  listener?.(msg)
}

interface Toast {
  id: number
  msg: string
}

export function Toaster() {
  const [toasts, setToasts] = useState<Toast[]>([])

  useEffect(() => {
    listener = (msg: string) => {
      const id = nextId++
      setToasts(prev => [...prev, { id, msg }])
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== id))
      }, 3500)
    }
    return () => {
      listener = null
    }
  }, [])

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 flex-col items-center gap-2"
    >
      {toasts.map(t => (
        <div
          key={t.id}
          className="toast-item rounded-full bg-dusk px-5 py-2.5 font-mono text-sm text-salt shadow-lg"
        >
          {t.msg}
        </div>
      ))}
    </div>
  )
}
