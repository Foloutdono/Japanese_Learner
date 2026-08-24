import { useEffect, useRef, useState } from 'react'

// ── Stroke-order animation ────────────────────────────────
// Draws a KanjiVG stroke-order SVG one stroke at a time using the
// classic stroke-dasharray/stroke-dashoffset trick: each <path>
// starts fully "hidden" (dashoffset == its own length) then animates
// to 0, staggered per stroke. Pass either:
//   - `src`     a URL to fetch the raw .svg file from (e.g. the same
//               kanjivg endpoint an <img src="..."/> used to point
//               at), or
//   - `svgText` the raw SVG markup directly, if you already have it.
//
// Drop-in replacement for a static <img>: it fills its container
// (width/height: 100%) the same way `.stroke-ref__img` /
// `.dict-detail__stroke-img` sized the old <img>, so no CSS changes
// are needed at the call site beyond swapping the tag. On fetch
// failure it calls `onError()` instead of rendering anything, so the
// caller can show its own existing fallback markup exactly like the
// old <img onError=...> did.
const STROKE_DURATION_MS = 550   // how long one stroke takes to draw
const STROKE_STAGGER_MS  = 450   // delay between successive strokes
const LOOP_PAUSE_MS      = 900   // hold on the finished glyph before replaying

export function StrokeOrderAnimation({ src, svgText: svgTextProp, loop = false, className, onError }) {
  const containerRef = useRef(null)
  const [svgText, setSvgText] = useState(svgTextProp ?? null)

  // Fetch the SVG text when `src` is given instead of `svgText` —
  // aborted on unmount or if `src` changes again before it resolves,
  // so a fast kanji-to-kanji swap can't apply a stale response.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- syncing `svgText` to the `svgText` prop, or clearing it to show nothing while a new `src` fetch is in flight; the fetch itself (below) is the real side effect this reset kicks off alongside, not an id-keyed reset a key-remount could replace.
    if (svgTextProp) { setSvgText(svgTextProp); return }
    if (!src) return
    const controller = new AbortController()
    setSvgText(null)
    fetch(src, { signal: controller.signal })
      .then(r => (r.ok ? r.text() : Promise.reject(new Error('not ok'))))
      .then(setSvgText)
      .catch(err => { if (err.name !== 'AbortError') onError?.() })
    return () => controller.abort()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src, svgTextProp])

  // Parse + play whenever the resolved SVG text changes.
  useEffect(() => {
    const container = containerRef.current
    if (!container || !svgText) return

    // KanjiVG files ship an XML DOCTYPE with an internal subset (the
    // <!ATTLIST ... [ ... ]> block declaring the kvg: attributes).
    // innerHTML runs the HTML parser, not an XML one, and it doesn't
    // understand that subset syntax — it bails out partway through
    // and leaves the trailing "]>" behind as a literal text node
    // (that's the stray "]>" rendering above the strokes). Only the
    // <svg>...</svg> element itself is actually needed, so cut
    // everything before it — prolog, comments, and DOCTYPE included.
    const match = svgText.match(/<svg[\s\S]*<\/svg>/)
    if (!match) { onError?.(); return }
    container.innerHTML = match[0]
    const svgEl = container.querySelector('svg')
    if (!svgEl) { onError?.(); return }

    svgEl.removeAttribute('width')
    svgEl.removeAttribute('height')
    svgEl.style.width = '100%'
    svgEl.style.height = '100%'
    svgEl.style.display = 'block'

    const paths = Array.from(svgEl.querySelectorAll('path'))
    let timers = []
    let cancelled = false

    function play() {
      if (cancelled) return
      paths.forEach((path, i) => {
        const len = path.getTotalLength()
        path.style.strokeDasharray = len
        path.style.strokeDashoffset = len
        path.style.transition = 'none'
        // Force a reflow so the browser registers the "hidden" state
        // before the transition below is applied — otherwise both can
        // collapse into one frame and skip the draw-in entirely.
        // eslint-disable-next-line no-unused-expressions
        path.getBoundingClientRect()
        path.style.transition = `stroke-dashoffset ${STROKE_DURATION_MS}ms ease-in-out`
        path.style.transitionDelay = `${i * STROKE_STAGGER_MS}ms`
      })
      const raf = requestAnimationFrame(() => {
        if (cancelled) return
        paths.forEach(path => { path.style.strokeDashoffset = '0' })
      })
      timers.push(raf)

      if (loop) {
        const totalMs = paths.length * STROKE_STAGGER_MS + STROKE_DURATION_MS + LOOP_PAUSE_MS
        const t = setTimeout(play, totalMs)
        timers.push(t)
      }
    }
    play()

    return () => {
      cancelled = true
      timers.forEach(id => { clearTimeout(id); cancelAnimationFrame(id) })
    }
  }, [svgText, loop, onError])

  if (!svgText) return null
  return <div ref={containerRef} className={className} style={{ width: '100%', height: '100%' }} />
}