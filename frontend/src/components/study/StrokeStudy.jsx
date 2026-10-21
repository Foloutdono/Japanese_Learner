import { useEffect, useMemo, useState } from 'react'
import { useLang } from '../../LangContext'
import { Sheet } from '../chrome/Sheet'
import { Seg } from '../chrome/Console'
import { SearchIcon } from '../ui/Icons'
import { playClick } from '../../lib/audio'
import { glyphOfUrl, strokesOf } from '../../domain/kanjivg'
import { useTraceRun } from '../../hooks/useTraceRun'
import { StrokeOrderAnimation } from './StrokeOrderAnimation'
import { TraceBoard } from './TraceBoard'

// ── 辻 — a character's strokes, big, and traced over (plan 267) ──
// The stroke-order animation is small wherever it sits (the dictionary's
// sheet, the writing practice's reference), so a tap on it opens this
// sheet: the same animation at the width of the screen, and, beside it,
// the calque -- the glyph's strokes traced in their turn on the trace
// board the glyph tour writes on (TraceBoard, plan 263), each a hollow
// from its dot to its ring that the ink fills as the hand goes. The
// order and the shape are the file's own (KanjiVG, domain/kanjivg), so
// any character the animation can draw can be traced; one with no file
// has no tap.
//
// Nothing is graded and nothing is kept: a trace here is practice, never
// a review. The walk of misses is the tour's (hooks/useTraceRun).

/** The animation, as a door: a tap anywhere on it opens the study. The
    door is a button laid over it, so what it holds stays what it was.
    `className` is the box's own (the sheet, the frame), `glyph` the
    character for the sheet's head, read off the file's name if none. */
export function StrokeZoom({ src, glyph, className = '', children }) {
  const { t } = useLang()
  const [open, setOpen] = useState(null)
  return (
    <div className={`stroke-zoom ${className}`.trim()}>
      {children}
      <button
        type="button"
        className="stroke-zoom__open"
        aria-label={t.strokeZoom}
        // The sheet is a portal: it does not inherit the pigment the
        // shell injected, so it is read here and handed over.
        onClick={e => setOpen({ line: getComputedStyle(e.currentTarget).getPropertyValue('--line-color').trim() })}
      >
        <SearchIcon size={14} className="stroke-zoom__mark" />
      </button>
      <StrokeStudy
        open={open != null}
        src={src}
        glyph={glyph ?? glyphOfUrl(src)}
        line={open?.line}
        onClose={() => setOpen(null)}
      />
    </div>
  )
}

export function StrokeStudy({ open, src, glyph, line, onClose }) {
  const { t } = useLang()
  return (
    <Sheet open={open} onClose={onClose} jp={glyph} cap={t.strokeOrder} label={t.strokeOrder} className="ss-sheet" over dismiss>
      <Study src={src} glyph={glyph} line={line} />
    </Sheet>
  )
}

// Mounted only while open, so the file is fetched when it is wanted.
function Study({ src, glyph, line }) {
  const { t } = useLang()
  const [svgText, setSvgText] = useState(null)
  const [failed, setFailed] = useState(false)
  const [mode, setMode] = useState('watch')
  const strokes = useMemo(() => strokesOf(svgText), [svgText])

  useEffect(() => {
    const controller = new AbortController()
    fetch(src, { signal: controller.signal })
      .then(r => (r.ok ? r.text() : Promise.reject(new Error('not ok'))))
      .then(setSvgText)
      .catch(err => { if (err.name !== 'AbortError') setFailed(true) })
    return () => controller.abort()
  }, [src])

  if (failed) return <p className="ss-fallback">{t.notAvailable}</p>
  if (!svgText) return <div className="ss-stage ss-stage--wait" aria-busy="true" />

  const options = [{ key: 'watch', label: t.strokeWatch }]
  if (strokes.length) options.push({ key: 'trace', label: t.strokeTrace })
  return (
    <div className="ss" style={line ? { '--line-color': line } : undefined}>
      {options.length > 1 && <Seg full label={t.strokeOrder} value={mode} onChange={setMode} options={options} />}
      {mode === 'trace'
        ? <Trace strokes={strokes} glyph={glyph} />
        : (
          <div className="ss-stage">
            <div className="ss-paper">
              <StrokeOrderAnimation svgText={svgText} loop className="ss-paper__glyph" />
            </div>
          </div>
        )}
    </div>
  )
}

function Trace({ strokes, glyph }) {
  const { t } = useLang()
  const { trace, verdict, show, reset } = useTraceRun()
  const total = strokes.length
  const traced = trace.at >= total || trace.shownFrom != null
  const n = Math.min(trace.at + 1, total)
  let said = null
  if (trace.shownFrom != null) said = t.glyphShown
  else if (traced) said = t.glyphTraced(trace.misses)
  else if (trace.last === 'given') said = t.glyphGiven

  function onVerdict(v) {
    if (v === 'ok') playClick()
    verdict(v)
  }

  return (
    <div className="ss-trace">
      <div className="ss-stage">
        <TraceBoard
          strokes={strokes}
          at={trace.at}
          given={trace.given}
          shownFrom={trace.shownFrom}
          label={t.glyphBoardAria(glyph ?? '', n, total)}
          onVerdict={onVerdict}
        />
      </div>
      <p className="ss-said" aria-live="polite">{said ?? <span className="sr-only">{t.glyphTraceQ}</span>}</p>
      {traced
        ? <button type="button" className="brd__link ss-act" onClick={() => { playClick(); reset() }}>{t.strokeAgain}</button>
        : <button type="button" className="brd__link ss-act" onClick={() => { playClick(); show() }}>{t.glyphShowMe}</button>}
    </div>
  )
}
