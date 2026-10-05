import { useState } from 'react'
import { useLang } from '../../LangContext'
import { playClick } from '../../lib/audio'
import { CloseIcon } from '../ui/Icons'

// ── 基礎 — the basics on the gate (plan 186f) ───────────────────
// An N5 learner's day rides the basics course first (plan 186e), and
// the gate says where on it they stand: the unit the next new card
// comes from, by its name, and a bar of the fourteen with the ones met
// filled. Neutral inks: the course is no line, so it wears no line's
// pigment. `basics` is /api/today's -- null above N5, where nothing is
// drawn -- and once the course is met, one note says so until it is
// put away, which is remembered on the device.
const DONE_KEY = 'tsuji.basicsDoneSeen'

function readSeen() {
  try {
    return window.localStorage.getItem(DONE_KEY) === '1'
  } catch {
    return false
  }
}
function writeSeen() {
  try {
    window.localStorage.setItem(DONE_KEY, '1')
  } catch { /* private window: the note comes back next visit */ }
}

export default function BasicsLine({ basics }) {
  const { t, lang } = useLang()
  const [seen, setSeen] = useState(readSeen)
  if (!basics) return null

  if (basics.done) {
    if (seen) return null
    return (
      <div className="basics-line basics-line--done" role="status">
        <span className="basics-line__head">
          <span className="basics-line__jp" lang="ja">基礎</span>
          <span className="basics-line__name">{t.basicsDone}</span>
        </span>
        <button
          type="button"
          className="basics-line__close"
          aria-label={t.close}
          onClick={() => { playClick(); writeSeen(); setSeen(true) }}
        >
          <CloseIcon />
        </button>
      </div>
    )
  }

  const met = basics.unit - 1
  const title = basics.title?.[lang] ?? basics.title?.en ?? ''
  return (
    <div className="basics-line" data-basics-unit={basics.id}>
      <span className="basics-line__head">
        <span className="basics-line__jp" lang="ja">基礎</span>
        <span className="basics-line__of">{t.basicsUnit(basics.unit, basics.of)}</span>
      </span>
      <span className="basics-line__name">
        <span lang="ja">{basics.jp}</span>
        <span className="basics-line__title">{title}</span>
      </span>
      <span
        className="basics-line__bar"
        role="img"
        aria-label={t.basicsMet(met, basics.of)}
      >
        {Array.from({ length: basics.of }, (_, i) => (
          <span
            key={i}
            className={`basics-line__unit${i < met ? ' basics-line__unit--met' : ''}${i === met ? ' basics-line__unit--on' : ''}`}
          />
        ))}
      </span>
    </div>
  )
}
