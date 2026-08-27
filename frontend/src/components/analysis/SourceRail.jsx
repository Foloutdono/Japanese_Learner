import { useRef } from 'react'
import { playUi } from '../../lib/audio'
import { SOURCES } from './sources'

// ── のりば案内 — the platform rail ─────────────────────────
// The three ways into 解析 station, drawn as the signs at the head of
// three platforms. Each carries the four registers a 駅名標 always
// carries -- 番線 number, the reading, the name, the plain-language
// name -- because it is the same signage system the plate overhead
// uses (see components/station/StationSign.jsx). The active platform's
// stripe fills; the others keep a hairline.
//
// These are REAL tabs, not a div strip: role="tablist"/"tab", a roving
// tabindex, and Left/Right/Home/End. Three plans in this repo have
// already been spent on heading structure (003), dialog semantics
// (004) and focus indicators (005); a keyboard-inert selector would
// spend them again.
//
// The panels are NOT rendered here. This reports a choice; the screen
// owns which intake is mounted -- which is also what keeps only the
// active panel in the DOM, so focus can never land inside a hidden one.
//
// The list itself lives in ./sources.js, not here: the screen needs the
// same key space to mount panels against, and two copies of it is the
// drift config/stations.js already documents having been bitten by.

export function SourceRail({ value, onChange, t }) {
  const refs = useRef({})

  function select(key) {
    if (key === value) return
    playUi('click-mode-selection')
    onChange(key)
  }

  // Arrow keys move AND activate, which is the expected behaviour for a
  // tablist whose panels are cheap to render. Home/End jump to the ends.
  function onKeyDown(e) {
    const i = SOURCES.findIndex(s => s.key === value)
    let next = null
    if (e.key === 'ArrowRight') next = (i + 1) % SOURCES.length
    else if (e.key === 'ArrowLeft') next = (i - 1 + SOURCES.length) % SOURCES.length
    else if (e.key === 'Home') next = 0
    else if (e.key === 'End') next = SOURCES.length - 1
    if (next === null) return

    e.preventDefault()
    const key = SOURCES[next].key
    select(key)
    refs.current[key]?.focus()
  }

  return (
    <div className="anl-rail" role="tablist" aria-label={t.platformUnit} onKeyDown={onKeyDown}>
      {SOURCES.map(s => {
        const active = s.key === value
        return (
          <button
            key={s.key}
            id={`anl-tab-${s.key}`}
            ref={el => { refs.current[s.key] = el }}
            type="button"
            role="tab"
            aria-selected={active}
            aria-controls={`anl-panel-${s.key}`}
            // Roving tabindex: one stop for the whole rail, then the
            // arrow keys move within it.
            tabIndex={active ? 0 : -1}
            // The sign carries four registers of 駅名標 typography, and
            // concatenated they announce as "1 番線 もじ 文字 Text".
            // The name is the plain-language one; the number is a
            // separate fact; the hint is a real description instead of
            // a `title` that never appears on touch.
            aria-label={`${t[s.label]} — ${t.platformNumber(s.no)}`}
            aria-describedby={`anl-tab-hint-${s.key}`}
            className="anl-rail__sign"
            onClick={() => select(s.key)}
          >
            <span className="anl-rail__no" aria-hidden="true">{s.no}<span lang="ja">番線</span></span>
            <span className="anl-rail__kana" lang="ja" aria-hidden="true">{s.kana}</span>
            <span className="anl-rail__jp" lang="ja" aria-hidden="true">{s.jp}</span>
            <span className="anl-rail__latin" aria-hidden="true">{t[s.label]}</span>
            <span className="anl-rail__stripe" aria-hidden="true" />
            <span id={`anl-tab-hint-${s.key}`} className="anl-sr-only">{t[s.hint]}</span>
          </button>
        )
      })}
    </div>
  )
}
