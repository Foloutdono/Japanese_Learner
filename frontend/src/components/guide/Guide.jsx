import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useLang } from '../../LangContext'
import { useDialog } from '../../hooks/useDialog'
import { track } from '../../lib/track'
import { stopwatch } from '../../lib/dwell'
import { playClick } from '../../lib/audio'
import { GUIDES, deskStops } from './guides'
import { Spot, PAD } from './Spot'
import { useDesk } from '../../hooks/useDesk'

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
// The note's height before it has been measured: a sentence and the
// 44px controls. Only the first frame of a stop reads it.
const NOTE_H = 150

function rectOf(anchor) {
  const el = document.querySelector(`[data-guide="${anchor}"]`)
  if (!el) return null
  const r = el.getBoundingClientRect()
  if (r.width === 0 && r.height === 0) return null
  // 机 (plan 115): an anchor in the desk's rail has its note to its
  // right, one in a side column to its left — beside the thing it is
  // about, never a screen's width away over the page.
  // A run's left column (plan 133, the ride's tour) is the rail's case.
  const beside = el.closest('.desk-rail, .desk-run__left') ? 'right' : el.closest('.desk-side, .desk-run__side') ? 'left' : null
  return { el, top: r.top, left: r.left, width: r.width, height: r.height, bottom: r.bottom, beside }
}

// 机 (plan 123): a note under or over an anchor in the page's column
// stands on the anchor, not on the canvas's middle -- Today's gate sits
// beside a side column, Learn's first plate in a grid of two, and a
// note centred on the canvas lay half over the neighbour. As wide as
// the anchor, between a column and a card, and kept inside the canvas.
function centredOn(rect) {
  const tokens = getComputedStyle(document.documentElement)
  const cardW = parseFloat(tokens.getPropertyValue('--card-w')) || 640
  const sideW = parseFloat(tokens.getPropertyValue('--desk-side-w')) || 360
  const width = Math.min(cardW, Math.max(rect.width, sideW))
  const canvas = document.querySelector('.phone__content')?.getBoundingClientRect()
  const from = (canvas?.left ?? 0) + width / 2
  const to = (canvas?.right ?? window.innerWidth) - width / 2
  const centre = rect.left + rect.width / 2
  return { left: Math.min(Math.max(centre, from), Math.max(from, to)), width }
}

// `stops`, when given, is a tour that is not a gate's: walked the same
// way, in the same spot and note, but not counted as a gate's guide --
// `gate` then only names it on the DOM. The first ride walked one on
// the desk (plan 133) until the owner cut its explain-only stops
// (2026-09-28); the ride now lights only what its notes ask to be
// pressed (guide/Spot.jsx's Cue), and this is kept for a tour to come.
export function Guide({ gate, stops: given = null, onEnd }) {
  const { t } = useLang()
  const desk = useDesk()
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
  // The note's own height, measured once it is drawn: where it goes
  // depends on whether it fits beside the spot.
  const [noteH, setNoteH] = useState(NOTE_H)
  const watch = useRef(null)
  const ended = useRef(false)
  const stop = stops?.[index] ?? null

  function end(skipped) {
    if (ended.current) return
    ended.current = true
    setOver(true)
    const total = stops?.length ?? 0
    if (!given) track('guide_done', { gate, skipped, stops: skipped ? index : total, ms: watch.current?.read() ?? 0 })
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
    setStops((given ?? (desk ? deskStops(gate) : GUIDES[gate] ?? [])).filter(s => rectOf(s.anchor)))
    // `given` is read once, as the gate's registry is: a tour does not
    // change under the learner.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gate, desk])

  // Nothing to point at: over before it begins, and not a skip.
  useEffect(() => {
    if (stops && !stop) end(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stops, stop])

  useEffect(() => {
    if (stop && !given) track('guide_step', { gate, stop: stop.anchor, index })
  }, [gate, stop, index, given])

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
        setRect(r ? { top: r.top, left: r.left, width: r.width, height: r.height, bottom: r.bottom, beside: r.beside } : null)
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

  // 机 (plan 123): → is Next wherever the focus is, and Enter is Next
  // on the note itself -- the panel holds the focus, and Enter there did
  // nothing, so a desk learner went Tab, Tab, Enter at every stop. Enter
  // on a focused Skip or Next keeps its own meaning. Taken in the
  // capture phase and stopped, so the page under the note never hears
  // them (the dictionary's → would walk the catalogue under it). Esc
  // stays the dialog's skip.
  useEffect(() => {
    if (!desk || !stop || over) return undefined
    const onKey = e => {
      if (e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return
      if (e.key !== 'ArrowRight' && !(e.key === 'Enter' && e.target === ref.current)) return
      e.preventDefault()
      e.stopPropagation()
      if (e.repeat) return
      playClick()
      if (index === stops.length - 1) end(false)
      else setIndex(i => i + 1)
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
    // `end` is this render's; the stop and its index are what it reads.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [desk, stop, index, stops, over])

  // Re-read whenever the note may have changed height: the sentence
  // changes with the stop, and its width with the spot's.
  useLayoutEffect(() => {
    const h = ref.current?.offsetHeight
    if (h && Math.abs(h - noteH) > 1) setNoteH(h)
  }, [stop, rect, noteH, ref])

  if (over || !stop || !rect) return null

  const last = index === stops.length - 1
  // `above` is the tab bar's stop: on the phone the bar is the bottom
  // edge and the note rests on it. On the desk (plan 113) the same
  // anchor is the rail's list of gates, which starts at the top of the
  // screen — a note "above" it would be off the screen, so there it
  // takes the ordinary rule and hangs under it.
  const lower = (stop.place === 'above' && rect.top > window.innerHeight / 2)
    || rect.top + rect.height / 2 > window.innerHeight / 2
  const beside = desk ? rect.beside : null
  // Whether the note fits over or under the spot. An anchor as tall as
  // the window -- the desk's fare gate, which takes the hall's height
  // since plan 135 -- leaves room on neither side, and the note was
  // drawn under the window's floor; it then stands inside the spot, in
  // its middle, over the anchor's own empty room.
  const fitsAbove = rect.top - PAD - GAP - noteH >= GAP
  const fitsBelow = rect.bottom + PAD + GAP + noteH <= window.innerHeight - GAP
  const side = lower ? (fitsAbove ? 'above' : fitsBelow ? 'below' : 'over')
    : (fitsBelow ? 'below' : fitsAbove ? 'above' : 'over')
  const maxTop = Math.max(GAP, window.innerHeight - noteH - GAP)
  const pos = beside
    ? {
      // Beside a rail or side anchor, level with its top (or its foot,
      // in the lower half), and never past the window's edge.
      top: Math.min(Math.max(GAP, lower ? rect.bottom + PAD - noteH : rect.top - PAD), maxTop),
      ...(beside === 'right'
        ? { left: rect.left + rect.width + PAD + GAP }
        : { left: 'auto', right: window.innerWidth - rect.left + PAD + GAP }),
    }
    : {
      ...(side === 'above' ? { bottom: window.innerHeight - rect.top + PAD + GAP }
        : side === 'below' ? { top: rect.bottom + PAD + GAP }
        : { top: Math.min(Math.max(GAP, rect.top + (rect.height - noteH) / 2), maxTop) }),
      ...(desk ? centredOn(rect) : {}),
    }
  // The desk's own wording where a note teaches a key (plan 115).
  const text = (desk && t[`guide${stop.key}Desk`]) || t[`guide${stop.key}`]

  function next() {
    playClick()
    if (last) end(false)
    else setIndex(i => i + 1)
  }

  return createPortal(
    <div className="guide" data-gate={gate} data-stop={stop.anchor}>
      <Spot rect={rect} radius={stop.radius ?? 'card'} />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={t.guideLabel}
        className="guide-callout guide-callout--live"
        tabIndex={-1}
        style={pos}
        data-place={beside ?? side}
      >
        <p className="guide-callout__text">{text}</p>
        <div className="guide-callout__foot">
          <span className="guide-callout__count" aria-hidden="true">{index + 1}/{stops.length}</span>
          <button type="button" className="guide-callout__skip" onClick={() => end(true)} data-action="guide-skip" aria-keyshortcuts={desk ? 'Escape' : undefined}>
            {t.guideSkip}
            {desk && <kbd className="desk-kbd" aria-hidden="true">{t.keyEscape}</kbd>}
          </button>
          <button type="button" className="guide-callout__next" onClick={next} data-action="guide-next" aria-keyshortcuts={desk ? 'Enter ArrowRight' : undefined}>
            {last ? t.guideDone : t.guideNext}
            {desk && <kbd className="desk-kbd" aria-hidden="true">{t.keyEnter}</kbd>}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
