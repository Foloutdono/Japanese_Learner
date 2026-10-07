import { useEffect, useRef } from 'react'
import { useLang } from '../../LangContext'
import { playDayClear } from '../../lib/audio'
import { EnterKey } from '../chrome/DeskKeys'
import {
  ClearHeader, WeekStamps, XpTotal, LevelBar, RunCard, Seal, GateButton,
} from './kit'
import { longDate, weekParts } from './aria'

// ── 終着 — the everyday clear on the desk (plan 191) ──────────────────
// The canvas's Desk board (1440×900), less its drawn rail: in the app
// the real DeskRail stands at the left (the route's Shell on the desk),
// so this draws the centre and side columns only -- the header with the
// seal beside the title once pressed, the week row and the streak, the
// reader at the top of the centre column and the 32 cards swept into
// their slots of an 8×4 grid; at the side the fare (run, prime, total
// in gold, the level bar), tomorrow (dashed, the next ticket's preview)
// and the 運休 note; the gate at the bottom right with its Entrée cap.
//
// PLACEHOLDER (foundation): the rest state, static. The screen agent
// ports the board here and owns the `desk-day` region of index.css's
// 机 section (and may add to `day` for rules shared with the phone).
//
// Props: as ClearPhone's (result, run, model, reduced, handover,
// onHandover, onFareBeat, onLeave). Enter presses the gate (the board's
// cap); a click or Enter during the ceremony skips to its rest.
export default function ClearDesk({ result, model, reduced, handover, onHandover, onFareBeat, onLeave }) {
  const { t, lang } = useLang()
  const once = useRef(false)
  useEffect(() => {
    if (once.current) return
    once.current = true
    playDayClear()
    if (handover) onHandover?.()
    else onFareBeat?.()
  }, [handover, onHandover, onFareBeat])

  const { fare, level, tomorrow } = model
  return (
    <main id="main-content" className={['clr-desk', reduced && 'clrk--reduced'].filter(Boolean).join(' ')}>
      <section className="clr-desk__centre">
        <div className="clr-desk__head">
          <ClearHeader cap="本日の運行 終了" title={t.clrTitle} />
          {model.seal && <Seal day={model.seal.day} foot={model.seal.foot} size={64} tilt={-8} label={t.clrSealAria(longDate(result.day, lang))} />}
        </div>
        <WeekStamps week={model.week} label={t.clrWeekAria(weekParts(model.week, t, lang))} />
        <p className="clr-desk__streak"><b>{model.streak}</b> {t.clrStreakWord}</p>
        <ol className="clr-desk__grid">
          {model.cards.map(face => (
            <li key={face.id}>
              <RunCard
                face={face}
                style={{ '--rail': ['var(--rating-wrong)', 'var(--rating-correct)', 'var(--rating-perfect)'][face.verdict] }}
                aria-label={`${face.term}, ${t.clrVerdicts[face.verdict]}${face.mastered ? `, ${t.clrCardMastered}` : face.up ? `, ${t.clrCardUp}` : ''}`}
              >
                {(face.up || face.mastered) && <span className="clr-desk__mark" aria-hidden="true">{face.mastered ? '◆' : '↑'}</span>}
              </RunCard>
            </li>
          ))}
        </ol>
      </section>
      <aside className="clr-desk__side">
        <div className="clrk-card clr-desk__fare">
          <XpTotal value={fare.total} shine={!reduced} />
          <p><b>+{fare.run}</b> {t.clrFareRun} · <b>+{fare.bonus}</b> {t.clrFarePrime}</p>
          {level && <LevelBar from={level.from} to={level.to} label={t.clrLevelAria(level.level, Math.round(level.to * 100))} />}
        </div>
        {tomorrow && <p className="clrk-dash">{t.clrTomorrowSub(tomorrow.cards, tomorrow.minutes)}</p>}
        <GateButton compact arrive keys label={t.backToStation} onClick={onLeave} className="clr-desk__gate" />
      </aside>
      <EnterKey onEnter={onLeave} />
    </main>
  )
}
