import { useRef, useLayoutEffect } from 'react'

// ── The writing slip ──────────────────────────────────────
// The field both the text and the photo intakes submit from — one
// component, because they were one field on one screen before the
// merge and OCR output the learner corrects by hand should not behave
// differently from something they typed.
//
// The canvas's shape (plan 073): the field on the page, the count,
// the filled action across the row. It GROWS with its content: the
// field it replaced was a hard rows={3}, which meant a pasted
// paragraph scrolled inside three lines while the panel around it
// stayed empty.
export function WritingSlip({
  value, onChange, placeholder, t, provenance, hint, onSubmit, submitLabel, busy,
}) {
  const fieldRef = useRef(null)

  // useLayoutEffect, not useEffect: the height is corrected before the
  // browser paints, so a paste does not flash at the old size first.
  useLayoutEffect(() => {
    const el = fieldRef.current
    if (!el) return
    // Reset before measuring, or scrollHeight only ever ratchets upward
    // and the field can never shrink back after a deletion.
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [value])

  return (
    <div className="anl-slip">
      <textarea
        ref={fieldRef}
        className={`textarea anl-slip__field${provenance ? ' field--filled' : ''}`}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        rows={4}
        lang="ja"
      />
      {provenance && <p className="hint">{hint}</p>}
      <span className="cap anl-slip__count">{t.charCount(value.length)}</span>
      <button
        type="button"
        className="btn-primary anl-action"
        onClick={onSubmit}
        disabled={!value.trim() || busy}
      >
        {busy ? '…' : submitLabel}
      </button>
    </div>
  )
}
