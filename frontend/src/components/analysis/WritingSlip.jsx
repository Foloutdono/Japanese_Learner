import { useRef, useLayoutEffect } from 'react'

// ── The writing slip ──────────────────────────────────────
// The field both 文字 and 写真 submit from — one component, because
// they were one field on one screen before the merge and OCR output the
// learner corrects by hand should not behave differently from something
// they typed.
//
// Sumi ink (--bg-panel), the app's one high-contrast structural
// surface, so the thing you are about to hand over reads as a slip
// rather than as another panel.
//
// It GROWS with its content. The field it replaces was a hard rows={3},
// which meant a pasted paragraph scrolled inside three lines while the
// panel around it stayed empty.
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
      {provenance && (
        <div className="anl-slip__provenance">
          <span className="anl-slip__stamp" lang="ja">写</span>
          {hint}
        </div>
      )}

      <textarea
        ref={fieldRef}
        className="field field--panel field--bare field--multi anl-slip__field"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        rows={4}
        lang="ja"
      />

      <div className="anl-slip__foot">
        <span className="anl-slip__count">{t.charCount(value.length)}</span>
        <button
          type="button"
          className="anl-action"
          onClick={onSubmit}
          disabled={!value.trim() || busy}
        >
          {busy ? '…' : submitLabel}
        </button>
      </div>
    </div>
  )
}
