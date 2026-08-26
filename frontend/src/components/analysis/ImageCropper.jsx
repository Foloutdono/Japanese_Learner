import { useState, useRef, useCallback } from 'react'
import { rectToNatural } from '../../lib/image'

// Drag a box around the sentence you actually want. This is the single
// largest accuracy lever in photo input: recognition quality is
// dominated by how much irrelevant pixel area surrounds the target
// text, and a whole-page photo also hands the analyzer a wall of text
// the learner never asked about.
//
// Pointer events throughout, not separate mouse and touch handlers --
// one code path covers both, and setPointerCapture keeps a drag alive
// when the pointer leaves the element.
//
// The one real invariant: the rectangle is reported in NATURAL image
// coordinates, never display ones. The image is shown scaled to fit its
// container, so the two differ by a factor this component must get
// right -- everything downstream is wrong if it doesn't. That factor is
// what ImageCropper.browser.test.jsx pins.

// Below this, treat the drag as a tap rather than a selection: a stray
// click should not crop to nothing.
const MIN_DRAG_PX = 8

export function ImageCropper({ src, t, onConfirm, onCancel, busy = false }) {
  const imgRef = useRef(null)
  const [natural, setNatural] = useState(null)   // { width, height }
  const [rect, setRect] = useState(null)         // display-space { x, y, w, h }
  const dragStart = useRef(null)

  const onImageLoad = useCallback(e => {
    setNatural({ width: e.target.naturalWidth, height: e.target.naturalHeight })
    setRect(null)
  }, [])

  function displayToNatural(r) {
    const img = imgRef.current
    if (!img || !natural) return null
    // getBoundingClientRect, not naturalWidth/clientWidth: the image may
    // be letterboxed by object-fit, and only the measured box reflects
    // what the learner actually dragged over.
    const box = img.getBoundingClientRect()
    if (!box.width || !box.height) return null
    return rectToNatural(r, box, natural)
  }

  function pointFrom(e) {
    const box = imgRef.current.getBoundingClientRect()
    return {
      x: Math.min(Math.max(0, e.clientX - box.left), box.width),
      y: Math.min(Math.max(0, e.clientY - box.top), box.height),
    }
  }

  function handlePointerDown(e) {
    if (busy) return
    e.currentTarget.setPointerCapture(e.pointerId)
    dragStart.current = pointFrom(e)
    setRect(null)
  }

  function handlePointerMove(e) {
    if (!dragStart.current) return
    const now = pointFrom(e)
    const start = dragStart.current
    setRect({
      x: Math.min(start.x, now.x),
      y: Math.min(start.y, now.y),
      w: Math.abs(now.x - start.x),
      h: Math.abs(now.y - start.y),
    })
  }

  function handlePointerUp() {
    dragStart.current = null
    setRect(prev => (prev && (prev.w < MIN_DRAG_PX || prev.h < MIN_DRAG_PX) ? null : prev))
  }

  // Arrow keys nudge the selection. This repo has an accessibility wave
  // behind it (plans 002-007); a mouse-only control would regress it.
  function handleKeyDown(e) {
    if (!rect) return
    const step = e.shiftKey ? 20 : 4
    const moves = {
      ArrowLeft: { x: -step }, ArrowRight: { x: step },
      ArrowUp: { y: -step }, ArrowDown: { y: step },
    }
    const move = moves[e.key]
    if (!move) return
    e.preventDefault()
    setRect(r => ({ ...r, x: Math.max(0, r.x + (move.x ?? 0)), y: Math.max(0, r.y + (move.y ?? 0)) }))
  }

  return (
    <div className="analysis-cropper">
      <div
        className="analysis-cropper__stage"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onKeyDown={handleKeyDown}
        tabIndex={0}
        role="application"
        aria-label={t.cropHint}
      >
        <img
          ref={imgRef}
          src={src}
          alt=""
          onLoad={onImageLoad}
          className="analysis-cropper__image"
          draggable={false}
        />
        {rect && (
          <div
            className="analysis-cropper__rect"
            style={{ left: rect.x, top: rect.y, width: rect.w, height: rect.h }}
          />
        )}
      </div>

      <div className="analysis-cropper__hint">{t.cropHint}</div>

      <div className="phrase-input-actions">
        <button
          type="button"
          onClick={() => onConfirm(rect ? displayToNatural(rect) : null)}
          disabled={busy || !rect}
          className="phrase-analyze-btn"
        >
          {t.useThisArea}
        </button>
        <button
          type="button"
          onClick={() => onConfirm(null)}
          disabled={busy}
          className="phrase-history-toggle"
        >
          {t.useWholeImage}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={busy}
          className="phrase-history-toggle"
        >
          {t.cancel}
        </button>
      </div>
    </div>
  )
}
