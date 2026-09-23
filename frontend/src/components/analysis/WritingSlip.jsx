import { useRef, useLayoutEffect } from 'react'
import { useDesk } from '../../hooks/useDesk'

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
  // 机 (plan 114): on the desk Ctrl+Enter (⌘+Enter on a Mac) submits
  // from the field, the way a computer's multi-line fields do — Enter
  // alone is a new line, which a pasted paragraph needs. Its cap is on
  // the button it presses.
  const desk = useDesk()
  const mac = typeof navigator !== 'undefined' && /Mac|iP(hone|ad|od)/.test(navigator.platform || navigator.userAgent)
  const canSubmit = Boolean(value.trim()) && !busy
  const onKeyDown = desk
    ? e => {
      if (e.key !== 'Enter' || !(mac ? e.metaKey : e.ctrlKey) || !canSubmit) return
      e.preventDefault()
      onSubmit()
    }
    : undefined

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
        onKeyDown={onKeyDown}
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
        aria-keyshortcuts={desk ? (mac ? 'Meta+Enter' : 'Control+Enter') : undefined}
      >
        {busy ? '…' : submitLabel}
        {desk && !busy && <kbd className="desk-kbd" aria-hidden="true">{mac ? '⌘' : 'Ctrl'} ↵</kbd>}
      </button>
    </div>
  )
}
