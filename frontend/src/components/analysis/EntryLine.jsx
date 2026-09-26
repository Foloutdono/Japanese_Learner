import { useLayoutEffect, useRef, useState } from 'react'
import { CameraIcon, SubtitleFileIcon } from '../ui/Icons'

// ── The phone's way in (plan 136) ─────────────────────────
// Under the desk the analyser opens on the learner's passages, so the
// way in is one line over them rather than a page of three intakes
// (the owner's pick C, "les passages d'abord"): a field to paste into,
// the camera and a subtitle file beside it. Japanese typed or pasted
// opens the line into the writing slip -- the count and Analyse under
// it -- and a YouTube link is taken by the screen to the video sheet
// (AnalyzerScreen's editDraft), since a link is not text to analyse.
//
// The field grows with its content, as the slip's does, and folds back
// to one line when it is empty and left.
export function EntryLine({ t, value, onChange, onAnalyze, busy, onPhoto, onFile }) {
  const fieldRef = useRef(null)
  const fileRef = useRef(null)
  const [focused, setFocused] = useState(false)
  const open = focused || Boolean(value)

  // Before the paint, so a paste does not flash at the old height.
  useLayoutEffect(() => {
    const el = fieldRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [value, open])

  return (
    <div className={`anl-entry${open ? ' anl-entry--open' : ''}`}>
      <div className="anl-entry__row">
        <textarea
          ref={fieldRef}
          className="anl-entry__field"
          value={value}
          onChange={e => onChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={t.entryPlaceholder}
          aria-label={t.newPassage}
          rows={1}
          lang="ja"
        />
        <button type="button" className="anl-entry__tool" onClick={onPhoto} aria-label={t.sourcePhoto} aria-haspopup="dialog">
          <CameraIcon size={20} />
        </button>
        <button type="button" className="anl-entry__tool" onClick={() => fileRef.current?.click()} aria-label={t.chooseSubtitles}>
          <SubtitleFileIcon size={20} />
        </button>
        {/* Clipped, not display:none; the MIME types are what Android's
            picker matches on (see IntakeVideo). */}
        <input
          ref={fileRef}
          type="file"
          accept=".srt,.vtt,.ass,.ssa,text/vtt,text/plain,text/*,application/octet-stream"
          className="anl-drop__input"
          tabIndex={-1}
          aria-hidden="true"
          onChange={e => onFile(e.target.files?.[0])}
        />
      </div>
      {open && (
        <div className="anl-entry__foot">
          <span className="cap anl-slip__count">{t.charCount(value.length)}</span>
          <button
            type="button"
            className="btn-primary anl-action"
            onClick={onAnalyze}
            disabled={!value.trim() || busy}
          >
            {busy ? '…' : t.analyze}
          </button>
        </div>
      )}
    </div>
  )
}
