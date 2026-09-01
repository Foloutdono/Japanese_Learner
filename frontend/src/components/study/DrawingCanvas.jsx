import { useRef, useEffect, useState } from 'react'
import { useLang } from '../../LangContext'
import { StrokeOrderAnimation } from './StrokeOrderAnimation'
import { playClick } from '../../lib/audio'
import { UndoIcon, CheckIcon } from '../ui/Icons'

const API_BASE = ''  // same-origin, always — see lib/api.js

// The board stays a fixed sumi slab: it's the writing surface, not a
// cosmetic, and it has to stay dark enough for pale ink in either
// theme.
const CANVAS_BOARD_COLOR = '#201d24'

// The ink, though, is the equipped 筆 (see the brush block in
// index.css). Canvas takes numbers rather than custom properties, so
// rather than keep a second palette in JavaScript — which is exactly
// how the old hardcoded CANVAS_STROKE_COLOR drifted out of step with
// --text-primary — the value is read back off the computed style at
// the moment it's needed. Resolved per stroke, not once at module
// load, so equipping a brush mid-session (the quick-change drawer is
// reachable from the quiz itself now) takes effect on the very next
// line without a remount.
const FALLBACK_INK = '#ece5d8'

function brush() {
  if (typeof window === 'undefined') return { ink: FALLBACK_INK, width: 5, blur: 0 }
  const css = getComputedStyle(document.documentElement)
  const ink = css.getPropertyValue('--brush-ink').trim()
  const width = parseFloat(css.getPropertyValue('--brush-width'))
  const blur = parseFloat(css.getPropertyValue('--brush-blur'))
  return {
    ink: ink || FALLBACK_INK,
    width: Number.isFinite(width) ? width : 5,
    blur: Number.isFinite(blur) ? blur : 0,
  }
}

// Everything a stroke needs, applied together — the two draw handlers
// and the initial clear all have to agree, and they only do if they
// ask the same function.
function applyBrush(ctx) {
  const { ink, width, blur } = brush()
  ctx.strokeStyle = ink
  ctx.fillStyle   = ink
  ctx.lineWidth   = width
  ctx.lineCap     = 'round'
  ctx.lineJoin    = 'round'
  // 滲み — ink bleeding into wet paper. The only brush that sets this.
  ctx.filter = blur > 0 ? `blur(${blur}px)` : 'none'
  return width
}

// KanjiVG files are one per CHARACTER, so this takes a character, not a
// string. See StrokeRef for why that distinction is load-bearing.
function charToSvgUrl(char) {
  const codepoint = char.codePointAt(0).toString(16).padStart(5, '0')
  return `${API_BASE}/kanjivg/${codepoint}.svg`
}

// ── Shared canvas drawing logic ───────────────────────────
function Canvas({ canvasRef, onClear, resetKey }) {
  const { t } = useLang()
  const drawing = useRef(false)
  const lastPos = useRef(null)

  // Re-clears whenever resetKey changes (pass the card's id) —
  // previously this only ran once on mount, so if the parent
  // DrawingQuiz/DrawingOverlay instance was reused across cards
  // instead of remounting, the board kept whatever was drawn on the
  // very first card and never wiped it for any card after that.
  useEffect(() => { clear() }, [resetKey])

  function getPos(e, canvas) {
    const rect   = canvas.getBoundingClientRect()
    const scaleX = canvas.width  / rect.width
    const scaleY = canvas.height / rect.height
    const src    = e.touches ? e.touches[0] : e
    return {
      x: (src.clientX - rect.left) * scaleX,
      y: (src.clientY - rect.top)  * scaleY,
    }
  }

  function clear() {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    // The board is wiped with the filter off — a blurred brush must
    // not soften the edges of the slab it's drawn on.
    ctx.filter = 'none'
    ctx.fillStyle = CANVAS_BOARD_COLOR
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    applyBrush(ctx)
    onClear?.()
  }

  function startDraw(e) {
    e.preventDefault()
    drawing.current = true
    const canvas = canvasRef.current
    const pos    = getPos(e, canvas)
    lastPos.current = pos
    const ctx = canvas.getContext('2d')
    // The dot that makes a single tap leave a mark. Sized off the
    // brush, so the fine 面相筆 doesn't start every stroke with a blob
    // three times the width of the line that follows it.
    const width = applyBrush(ctx)
    ctx.beginPath()
    ctx.arc(pos.x, pos.y, width / 2, 0, Math.PI * 2)
    ctx.fill()
  }

  function draw(e) {
    e.preventDefault()
    if (!drawing.current) return
    const canvas = canvasRef.current
    const ctx    = canvas.getContext('2d')
    const pos    = getPos(e, canvas)
    ctx.beginPath()
    ctx.moveTo(lastPos.current.x, lastPos.current.y)
    ctx.lineTo(pos.x, pos.y)
    ctx.stroke()
    lastPos.current = pos
  }

  function stopDraw(e) {
    e.preventDefault()
    drawing.current = false
    lastPos.current = null
  }

  return (
    <div className="canvas-wrap">
      <canvas
        ref={canvasRef}
        width={260} height={260}
        className="canvas-board"
        onMouseDown={startDraw} onMouseMove={draw}
        onMouseUp={stopDraw}   onMouseLeave={stopDraw}
        onTouchStart={startDraw} onTouchMove={draw} onTouchEnd={stopDraw}
      />
      <button onClick={() => { playClick(); clear() }} className="canvas-clear-btn">
        <UndoIcon size={14} /> {t.eraseBtn}
      </button>
    </div>
  )
}

// ── Stroke order reference panel ──────────────────────────
// One character's stroke-order animation, owning its own failure state so
// one missing glyph in a combination doesn't blank the others.
function StrokeGlyph({ char }) {
  const { t } = useLang()
  const [failed, setFailed] = useState(false)

  // No reset effect needed: the caller (StrokeRef below) already keys
  // each StrokeGlyph by `${c}-${i}`, which embeds the character itself
  // — so a changed `char` always means a fresh mount, and `failed`
  // starts back at false for free instead of needing to be reset.

  if (failed) {
    return <div className="stroke-ref__fallback" style={{ display: 'flex' }}>{t.notAvailable}</div>
  }
  return (
    <StrokeOrderAnimation
      src={charToSvgUrl(char)}
      loop
      className="stroke-ref__img"
      onError={() => setFailed(true)}
    />
  )
}

function StrokeRef({ kanji, meaning, showMeaning = true }) {
  const { t } = useLang()

  // ── One animation per character, not per string ──
  // 81 of the 224 kana entries are combinations — きゃ, しゅ, ジョ — two
  // characters each. The old code took codePointAt(0) of the whole string
  // and asked for that one file, so a third of all kana cards animated き
  // while the card said きゃ. Nothing errored: a valid SVG for the wrong
  // character loads perfectly, and the learner has no way to notice they
  // are being taught the wrong strokes.
  //
  // Spread, not split(''), so a character outside the BMP stays intact
  // rather than being torn into surrogate halves.
  const chars = [...(kanji ?? '')]

  return (
    <div className="stroke-ref">
      <div className="stroke-ref__label">{t.strokeOrder}</div>
      <div className={`stroke-ref__frame${chars.length > 1 ? ' stroke-ref__frame--multi' : ''}`}>
        {chars.map((c, i) => <StrokeGlyph key={`${c}-${i}`} char={c} />)}
      </div>
      {showMeaning && (
        <div className="stroke-ref__meaning-wrap">
          <CharDisplay char={kanji} size={32} />
          {meaning && <div className="stroke-ref__meaning">{meaning}</div>}
        </div>
      )}
    </div>
  )
}

// Local mini version of QuizComponents' CharDisplay — kept self-contained
// here to avoid a cross-import just for one glyph; same CSS class/vars.
function CharDisplay({ char, size = 110 }) {
  return (
    <div className="char-display" style={{ '--char-size': `${size}px`, '--char-font': 'inherit' }}>
      {char}
    </div>
  )
}

// ── MODE 1: Fullscreen overlay (post-wrong-answer remediation) ──
// Used when the SRS review was already submitted and we just want practice.
// onDone → goes to next card.
export function DrawingOverlay({ kanji, meaning, onDone, resetKey }) {
  const { t }      = useLang()
  const canvasRef  = useRef(null)

  return (
    <div className="drawing-overlay">
      <div className="drawing-overlay__label">{t.writingPractice}</div>
      <div className="drawing-overlay__panels">
        <div className="canvas-wrap">
          <div className="stroke-ref__label">{t.yourDrawing}</div>
          <Canvas canvasRef={canvasRef} resetKey={resetKey ?? kanji} />
        </div>
        <StrokeRef kanji={kanji} meaning={meaning} />
      </div>
      <button onClick={() => { playClick(); onDone() }} className="drawing-overlay__continue">
        <CheckIcon size={14} /> {t.continueBtn}
      </button>
    </div>
  )
}

// ── MODE 2: Inline quiz phase (phase 4) ──
// Shows the prompt, user draws, clicks validate, sees correction, then rates.
// onValidate() → parent shows RatingBar.
export function DrawingQuiz({ kanji, meaning, onValidate, resetKey }) {
  // A fresh card must snap back to the undrawn/unrevealed state —
  // without this, DrawingQuiz kept reusing the same component instance
  // across cards (React doesn't remount it just because the props
  // changed), so `revealed` stayed true and the canvas kept whatever
  // was drawn for the very first card, which is exactly the "only
  // works for the first card" bug. Rather than an effect resetting
  // state, the interactive part is a child keyed on the card's own
  // identity — a fresh mount's `useState(false)` already starts
  // correctly, no reset needed.
  return (
    <DrawingQuizCard
      key={resetKey ?? kanji}
      kanji={kanji}
      meaning={meaning}
      onValidate={onValidate}
      resetKey={resetKey}
    />
  )
}

function DrawingQuizCard({ kanji, meaning, onValidate, resetKey }) {
  const { t }          = useLang()
  const canvasRef      = useRef(null)
  const [revealed, setRevealed] = useState(false)

  function handleValidate() {
    playClick()
    setRevealed(true)
    onValidate()
  }

  return (
    <div className="drawing-quiz">
      {/* .prompt-card gives this the exact same elevated surface every
          other quiz interaction sits on — without it this floated
          straight on the page background, the one card-less screen in
          the app. */}
      <div className="prompt-card drawing-quiz__card">
        <div className="drawing-quiz__panels">
          {/* Drawing side */}
          <div className="drawing-quiz__side">
            <div className="stroke-ref__label">{t.yourDrawing}</div>
            <Canvas canvasRef={canvasRef} resetKey={resetKey ?? kanji} />
          </div>

          {/* Correction side — hidden until validated */}
          <div className="drawing-quiz__correction">
            {!revealed ? (
              <>
                <div className="stroke-ref__label">{t.strokeOrder}</div>
                <div className="drawing-quiz__placeholder">
                  <span className="drawing-quiz__placeholder-mark">?</span>
                </div>
              </>
            ) : (
              <StrokeRef kanji={kanji} meaning={meaning} showMeaning={false} />
            )}
          </div>
        </div>
      </div>

      {/* Validate button — only before revealed */}
      {!revealed && (
        <button onClick={handleValidate} className="drawing-quiz__validate">
          {t.revealAnswer}
        </button>
      )}
    </div>
  )
}

// ── Default export: fullscreen overlay (backwards compat) ──
export default DrawingOverlay