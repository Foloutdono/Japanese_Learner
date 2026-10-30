import { useLayoutEffect, useRef, useState } from 'react'

// ── 引き上げ — a sheet of pages, one in view (plans 290, 291) ──────
// The phone's Practice gate raises its platforms as one sheet and the
// Learn gate its lines (components/practice/PracticeSheet,
// components/learn/LineSheet): every page side by side in a pager that
// scrolls sideways, the one tapped in view, and a strip of roundels over
// them that is the pages' index. This is the pager under both.
//
// The page in view is the scroll's to say (onScroll), for a swipe and a
// tap on a roundel alike. The roundels are one tab stop, the page in
// view's, and the arrows walk them: `walk` goes on the strip, and every
// roundel carries `data-page-stop` so it can be found.

const reduced = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

export function useSheetPager(count, start) {
  const pager = useRef(null)
  const [at, setAt] = useState(() => Math.max(0, start))

  // The sheet opens on the page that raised it.
  useLayoutEffect(() => {
    const el = pager.current
    if (el) el.scrollLeft = at * el.clientWidth
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once: where the sheet opened
  }, [])

  function onScroll(e) {
    const el = e.currentTarget
    const i = Math.min(count - 1, Math.max(0, Math.round(el.scrollLeft / Math.max(1, el.clientWidth))))
    if (i !== at) setAt(i)
  }
  function slideTo(i) {
    const el = pager.current
    if (!el) return
    el.scrollTo({ left: i * el.clientWidth, behavior: reduced() ? 'auto' : 'smooth' })
  }
  function walk(e) {
    const step = { ArrowLeft: -1, ArrowRight: 1 }[e.key]
    if (!step) return
    e.preventDefault()
    const i = Math.min(count - 1, Math.max(0, at + step))
    slideTo(i)
    e.currentTarget.querySelectorAll('[data-page-stop]')[i]?.focus()
  }
  return { pager, at, onScroll, slideTo, walk }
}
