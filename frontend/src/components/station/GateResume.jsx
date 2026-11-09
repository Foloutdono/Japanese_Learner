import { useLang } from '../../LangContext'
import { stationFor } from '../../config/stations'
import { relativeDate } from '../../lib/formatDate'

// ── 前回 — the last ride, boarded again in one tap (plans 290, 291) ──
// Over the phone's folded plates, Practice's gate (the platform and its
// grade) and Learn's (the line, its stop and the mode) offer the last
// ride as one row: a panel like a plate's, the roundel, what it was and
// when, and Reprendre in the metal's ink. One component, so the two
// gates' rows cannot drift apart; its classes are Practice's, where the
// row was first drawn (.prc-resume, index.css).
//
// `title` is the ride's name, `facts` what is said under it (when it
// was, what was done, the mode), `at` its time, said first.
export function GateResume({ section, title, at = null, facts = [], onClick }) {
  const { t, lang } = useLang()
  const when = relativeDate(at, lang, t)
  const sub = [when && when.charAt(0).toUpperCase() + when.slice(1), ...facts].filter(Boolean).join(' · ')
  return (
    <button type="button" className="prc-resume" style={{ '--line-color': section.color }} onClick={onClick}>
      <span className="pf-line__roundel" aria-hidden="true">{stationFor(section.path).code}</span>
      <span className="prc-resume__names">
        <span className="prc-resume__title">{title}</span>
        <span className="prc-resume__sub">{sub}</span>
      </span>
      <span className="prc-resume__go">{t.practiceResume}</span>
    </button>
  )
}
