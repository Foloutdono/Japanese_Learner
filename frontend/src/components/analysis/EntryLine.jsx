import { useLayoutEffect, useRef, useState } from 'react'
import { PlusIcon } from '../ui/Icons'

// ── The phone's way in (plan 136) ─────────────────────────
// Under the desk the analyser opens on the learner's passages, so the
// way in is one line over them rather than a page of three intakes
// (the owner's pick C, "les passages d'abord"): a field to paste into,
// and beside it the ＋ that holds every other way in. Japanese typed or
// pasted opens the line into the writing slip -- the count and Analyse
// under it -- and a YouTube link is taken by the screen to the video
// sheet (AnalyzerScreen's editDraft), since a link is not text to
// analyse.
//
// The ＋ is plan 317b's (the owner's pick E3 of the canvas "Tsuji
// analyser — a song from an audio file"): with the song the line held
// four doors -- the camera, the video, the ♪ and a subtitle file -- and
// its field no longer held its own words on one line. One door now
// opens the screen's sheet of ways in (AnalyzerScreen, `sheet ===
// 'ways'`), each named with what it takes, and the field has the line.
//
// The field grows with its content, as the slip's does, and folds back
// to one line when it is empty and left.
export function EntryLine({ t, value, onChange, onAnalyze, busy, onWays }) {
  const fieldRef = useRef(null)
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
        <button type="button" className="anl-entry__add" onClick={onWays} aria-label={t.entryWays} aria-haspopup="dialog">
          <PlusIcon size={20} />
        </button>
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
