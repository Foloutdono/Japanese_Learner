import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useLang } from '../../LangContext'
import { useDialog } from '../../hooks/useDialog'
import { track } from '../../lib/track'
import { stopwatch } from '../../lib/dwell'
import { playClick } from '../../lib/audio'
import { GUIDES } from './guides'

// ── 案内 — the guide over a gate (plan 100) ────────────────────────
// A spotlight on the live screen and one sentence beside it, stop by
// stop. The spot is one element over the anchor's rect whose shadow IS
// the scrim (box-shadow 0 0 0 100vmax), wearing the anchor's own
// corner; the note is the callout's card under it (above it when the
// spot is in the lower half), with the pair as its heading and two
// 44 px controls, Next (Done on the last) and Skip.
//
// The guide points at the DOM through `data-guide`; it never draws the
// thing it explains. A replica is the hand-copy DESIGN.md forbids, and
// it would be wrong within two features. Re-measured on resize, on
// scroll and whenever the anchor changes size, so the spot follows the
// thing it is about; an anchor that is not on the screen is skipped in
// silence rather than stranded on.
//
// Modal through hooks/useDialog: Escape ends it as a skip, focus is
// held in the note and returns to the screen. Portalled to body like
// the sheets. Under the sheets' z-index and the cutscenes': a sheet
// opened from a stop's own control covers the guide, as it should.
const GAP = 8
const PAD = 6
const MOVE_MS = 260

function rectOf(anchor) {
  const el = document.querySelector(`[data-guide="${anchor}"]`)
  if (!el) return null
  const r = el.getBoundingClientRect()
  if (r.width === 0 && r.height === 0) return null
  return { el, top: r.top, left: r.left, width: r.width, height: r.height, bottom: r.bottom }
}

export function Guide({ gate, onEnd }) {
  const { t } = useLang()
  // Which stops have an anchor on the screen, decided once the guide
  // is in the DOM: a screen that mounts the guide in the same commit
  // as its blocks has no rects to read during render, and a guide that
  // found nothing at that moment would end before it began.
  const [stops, setStops] = useState(null)
  const [index, setIndex] = useState(0)
  const [rect, setRect] = useState(null)
  // Over: nothing is drawn from the moment it ends, whether or not the
  // screen that mounted it has let go yet.
  const [over, setOver] = useState(false)
  const watch = useRef(null)
  const ended = useRef(false)
  const stop = stops?.[index] ?? null

  function end(skipped) {
    if (ended.current) return
    ended.current = true
    setOver(true)
    const total = stops?.length ?? 0
    track('guide_done', { gate, skipped, stops: skipped ? index : total, ms: watch.current?.read() ?? 0 })
    onEnd?.(skipped, total)
  }

  const ref = useDialog(() => end(true), { focus: 'panel' })
  // The note is not in the DOM when the dialog hook runs (nothing is
  // drawn until the first rect lands), so it takes focus itself the
  // first time it appears: the panel, not a control, so no button opens
  // wearing a ring; Tab then reaches Skip and Next in order.
  const focused = useRef(false)
  useEffect(() => {
    if (rect && !focused.current && ref.current) {
      focused.current = true
      ref.current.focus()
    }
  }, [rect, ref])

  useEffect(() => {
    watch.current = stopwatch()
    return () => { watch.current?.stop(); watch.current = null }
  }, [])

  useLayoutEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the anchors are DOM, read once the guide is in it.
    setStops((GUIDES[gate] ?? []).filter(s => rectOf(s.anchor)))
  }, [gate])

  // Nothing to point at: over before it begins, and not a skip.
  useEffect(() => {
    if (stops && !stop) end(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stops, stop])

  useEffect(() => {
    if (stop) track('guide_step', { gate, stop: stop.anchor, index })
  }, [gate, stop, index])

  // The spot follows the anchor: scrolled into view first, then
  // measured on every frame the layout could have moved it -- a
  // resize, a scroll, the anchor changing size, and the end of any
  // animation or transition on the page (the plates and cards ARRIVE,
  // a few pixels low, and a rect taken mid-flight is a spot a few
  // pixels off). Two late measures cover an arrival that fires no
  // event the document sees.
  useLayoutEffect(() => {
    if (!stop) return undefined
    const found = rectOf(stop.anchor)
    found?.el.scrollIntoView({ block: 'center', inline: 'nearest' })
    let raf = 0
    const update = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        const r = rectOf(stop.anchor)
        // eslint-disable-next-line react-hooks/set-state-in-effect -- a measurement of the DOM after layout; there is no render-time source for a rect.
        setRect(r ? { top: r.top, left: r.left, width: r.width, height: r.height, bottom: r.bottom } : null)
      })
    }
    update()
    const late = [setTimeout(update, 320), setTimeout(update, 760)]
    window.addEventListener('resize', update)
    window.addEventListener('scroll', update, true)
    document.addEventListener('animationend', update, true)
    document.addEventListener('transitionend', update, true)
    const ro = found && typeof ResizeObserver !== 'undefined' ? new ResizeObserver(update) : null
    if (found) ro?.observe(found.el)
    return () => {
      cancelAnimationFrame(raf)
      late.forEach(clearTimeout)
      window.removeEventListener('resize', update)
      window.removeEventListener('scroll', update, true)
      document.removeEventListener('animationend', update, true)
      document.removeEventListener('transitionend', update, true)
      ro?.disconnect()
    }
  }, [stop])

  if (over || !stop || !rect) return null

  const last = index === stops.length - 1
  const lower = stop.place === 'above' || rect.top + rect.height / 2 > window.innerHeight / 2
  const pos = lower
    ? { bottom: Math.max(0, window.innerHeight - rect.top + PAD + GAP) }
    : { top: rect.bottom + PAD + GAP }
  const text = t[`guide${stop.key}`]

  function next() {
    playClick()
    if (last) end(false)
    else setIndex(i => i + 1)
  }

  return createPortal(
    <div className="guide" data-gate={gate} data-stop={stop.anchor}>
      <div
        className={`guide__spot guide__spot--${stop.radius ?? 'card'}`}
        style={{
          top: rect.top - PAD, left: rect.left - PAD,
          width: rect.width + 2 * PAD, height: rect.height + 2 * PAD,
          '--guide-move': `${MOVE_MS}ms`,
        }}
        aria-hidden="true"
      />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={t.guideLabel}
        className="guide-callout guide-callout--live"
        tabIndex={-1}
        style={pos}
        data-place={lower ? 'above' : 'below'}
      >
        <p className="guide-callout__text">{text}</p>
        <div className="guide-callout__foot">
          <span className="guide-callout__count" aria-hidden="true">{index + 1}/{stops.length}</span>
          <button type="button" className="guide-callout__skip" onClick={() => end(true)} data-action="guide-skip">
            {t.guideSkip}
          </button>
          <button type="button" className="guide-callout__next" onClick={next} data-action="guide-next">
            {last ? t.guideDone : t.guideNext}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
