import { useEffect, useRef, useState } from 'react'
import { useLang } from '../../../LangContext'

// ── The fare's count and its figures (plan 191) ─────────────────────
// The two hooks XpTotal's figures lean on, apart from the components so
// a screen can count without drawing (kit/XpTotal.jsx draws).

/** The French table writes 1 387 with a narrow space, the English 1,387. */
export function useXpFormat() {
  const { lang } = useLang()
  const locale = lang === 'fr' ? 'fr-FR' : 'en-US'
  return n => Number(n).toLocaleString(locale)
}

/**
 * A number counted from `from` to `to` over `duration` ms once `run`
 * turns true, eased out; `onTick(value)` on each whole step it passes
 * (for the fare's tick), `onDone()` when it lands. Not running, it is
 * `to` at once (reduced motion, a skip, the rest state).
 */
export function useCountUp(to, { from = 0, duration = 900, run = true, onTick, onDone } = {}) {
  const [value, setValue] = useState(from)
  const tick = useRef(onTick)
  const done = useRef(onDone)
  useEffect(() => { tick.current = onTick; done.current = onDone })
  useEffect(() => {
    if (!run) return undefined
    let raf = 0
    let last = null
    const start = performance.now()
    const step = now => {
      const k = Math.min(1, (now - start) / Math.max(1, duration))
      const eased = 1 - (1 - k) ** 3
      const v = Math.round(from + (to - from) * eased)
      if (last !== null && v !== last) tick.current?.(v)
      last = v
      setValue(v)
      if (k < 1) raf = requestAnimationFrame(step)
      else done.current?.()
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [to, from, duration, run])
  return run ? value : to
}
