import { useEffect, useRef, useState } from 'react'

/** Keeps `mounted` true for `duration` ms after `open` turns false so exit animations can play. */
export function useExitAnimation(open: boolean, duration = 170): { mounted: boolean; closing: boolean } {
  const [state, setState] = useState({ mounted: open, closing: false })
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (open) {
      if (timer.current) clearTimeout(timer.current)
      timer.current = null
      setState({ mounted: true, closing: false })
      return
    }
    setState((previous) => (previous.mounted ? { mounted: true, closing: true } : previous))
    timer.current = setTimeout(() => setState({ mounted: false, closing: false }), duration)
    return () => {
      if (timer.current) clearTimeout(timer.current)
    }
  }, [open, duration])

  return state
}

/** Remembers the last non-null value so closing overlays keep rendering their content. */
export function useLatched<T>(value: T | null): T | null {
  const [last, setLast] = useState<T | null>(value)
  useEffect(() => {
    if (value !== null) setLast(value)
  }, [value])
  return value ?? last
}
