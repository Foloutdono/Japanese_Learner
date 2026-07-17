import { useRef, useEffect, useState } from 'react'
import { useLang } from '../LangContext'

const API_BASE = import.meta.env.VITE_API_URL || ''

// Canvas 2D drawing colors — these are JS canvas-API values, not CSS,
// so they can't reference CSS custom properties directly. Kept in sync
// with the palette by hand: board matches --bg-card (sumi ink slab),
// stroke matches --text-primary (kinari — warm off-white "ink" line).
const CANVAS_BOARD_COLOR  = '#201d24'
const CANVAS_STROKE_COLOR = '#ece5d8'

function kanjiToSvgUrl(kanji) {
  const codepoint = kanji.codePointAt(0).toString(16).padStart(5, '0')
  return `${API_BASE}/kanjivg/${codepoint}.svg`
}

// ── Shared canvas drawing logic ───────────────────────────
function Canvas({ canvasRef, onClear }) {
  const { t } = useLang()
  const drawing = useRef(false)
  const lastPos = useRef(null)

  useEffect(() => { clear() }, [])

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
    ctx.fillStyle = CANVAS_BOARD_COLOR
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.strokeStyle = CANVAS_STROKE_COLOR
    ctx.lineWidth   = 5
    ctx.lineCap     = 'round'
    ctx.lineJoin    = 'round'
    onClear?.()
  }

  function startDraw(e) {
    e.preventDefault()
    drawing.current = true
    const canvas = canvasRef.current
    const pos    = getPos(e, canvas)
    lastPos.current = pos
    const ctx = canvas.getContext('2d')
    ctx.beginPath()
    ctx.arc(pos.x, pos.y, 2, 0, Math.PI * 2)
    ctx.fillStyle = CANVAS_STROKE_COLOR
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
      <button onClick={clear} className="canvas-clear-btn">
        {t.eraseBtn}
      </button>
    </div>
  )
}

// ── Stroke order reference panel ──────────────────────────
function StrokeRef({ kanji, meaning, showMeaning = true }) {
  const { t } = useLang()
  return (
    <div className="stroke-ref">
      <div className="stroke-ref__label">{t.strokeOrder}</div>
      <div className="stroke-ref__frame">
        <img
          src={kanjiToSvgUrl(kanji)}
          alt={`${t.strokeOrder} ${kanji}`}
          className="stroke-ref__img"
          onError={e => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex' }}
        />
        <div className="stroke-ref__fallback">{t.notAvailable}</div>
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
export function DrawingOverlay({ kanji, meaning, onDone }) {
  const { t }      = useLang()
  const canvasRef  = useRef(null)

  return (
    <div className="drawing-overlay">
      <div className="drawing-overlay__label">{t.writingPractice}</div>
      <div className="drawing-overlay__panels">
        <div className="canvas-wrap">
          <div className="stroke-ref__label">{t.yourDrawing}</div>
          <Canvas canvasRef={canvasRef} />
        </div>
        <StrokeRef kanji={kanji} meaning={meaning} />
      </div>
      <button onClick={onDone} className="drawing-overlay__continue">
        {t.continueBtn}
      </button>
    </div>
  )
}

// ── MODE 2: Inline quiz phase (phase 4) ──
// Shows the prompt, user draws, clicks validate, sees correction, then rates.
// onValidate() → parent shows RatingBar.
export function DrawingQuiz({ kanji, meaning, kana, onValidate }) {
  const { t }          = useLang()
  const canvasRef      = useRef(null)
  const [revealed, setRevealed] = useState(false)

  function handleValidate() {
    setRevealed(true)
    onValidate()
  }

  return (
    <div className="drawing-quiz">
      <div className="drawing-quiz__panels">
        {/* Drawing side */}
        <div className="drawing-quiz__side">
          <div className="stroke-ref__label">{t.yourDrawing}</div>
          <Canvas canvasRef={canvasRef} />
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