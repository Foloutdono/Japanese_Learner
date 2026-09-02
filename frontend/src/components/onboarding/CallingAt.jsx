import { useLang } from '../../LangContext'
import { LEVEL_JP } from './levelSigns'
import { callingAt } from '../../domain/goalMath'

// ── 停車駅 — the calling-at strip (plan 063, phase E) ────────────
// The chosen service's milestones, drawn once under the board: each
// level of the journey with the date a steady pace reaches it. This
// is what survives of the live-route option — B chooses, this
// confirms. Stops are equally spaced on purpose (the dates carry the
// time; cramming true proportions into 680px crushed the near stops
// in every mockup round). The flow hides the strip while a date-mode
// ask is infeasible — there is no train to list stops for.

export default function CallingAt({ volumes, startLevel, destLevel, perDay, now }) {
  const { t, lang } = useLang()
  const fmtDs = new Intl.DateTimeFormat(lang === 'fr' ? 'fr' : 'en', { day: 'numeric', month: 'short' })
  const fmtDy = d => `${fmtDs.format(d)} ’${String(d.getFullYear()).slice(2)}`
  const stops = callingAt(volumes, startLevel, destLevel, perDay, { now })

  return (
    <div className="onb-call">
      <span className="onb-call__label">
        <span lang="ja">停車駅</span>
        {t.onbCallingAt}
      </span>
      <div className="onb-call__line">
        <span className="onb-call__stop">
          <span className="onb-call__dot onb-call__dot--now" />
          <span className="onb-call__lvl">{t.onbCallNow}</span>
          <span className="onb-call__when">{fmtDs.format(now)}</span>
        </span>
        {stops.map(st => (
          <span
            key={st.level}
            className={`onb-call__stop${destLevel != null && st.level === destLevel ? ' onb-call__stop--goal' : ''}`}
          >
            <span className="onb-call__dot" />
            <span className="onb-call__lvl">
              {st.level}
              <span className="onb-call__jp" lang="ja">{LEVEL_JP[st.level]}</span>
            </span>
            <span className="onb-call__when">{fmtDy(st.date)}</span>
          </span>
        ))}
      </div>
    </div>
  )
}
