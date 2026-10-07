import { useEffect, useRef } from 'react'
import { useLang } from '../../LangContext'
import { playDayClear } from '../../lib/audio'
import {
  ClearHeader, WeekStamps, XpTotal, LevelBar, Pile, Slot, GateButton,
} from './kit'
import { longDate, weekParts } from './aria'
import { daysBefore, weekdayKanji } from '../../domain/dayClear'

// ── 終着 — the everyday clear on a phone (plan 191) ───────────────────
// The canvas's Main board (390×844): the run's cards swept through a
// gate reader into three piles, the day's station stamp pressed and
// flown into the week row, the fare counted, then the rest. Drawn full
// screen, without the HUD or the tab bar (the route's stage frame).
//
// PLACEHOLDER (foundation): the rest state, static, so the app works
// end to end; the screen agent ports the board's sweep, stamp, fare and
// rest beats here and owns the `day` region of index.css and the
// `clrDay` locale group.
//
// Props (the contract the view relies on):
//   result    POST /api/today/clear's cleared answer
//   run       the run's tally: { at, cleared, xp, minutes, cards: [{ id,
//             term, kana, line, verdict 0|1|2, up, mastered }] }
//   model     domain/dayClear's clearModel(result, run): tier, streak,
//             week, seal, piles, marks, minutes, fare { run, bonus,
//             jackpot, total }, level { level, next, from, to }, tomorrow,
//             next { milestone, jackpot }, rest, already
//   reduced   the rest state at once, fades only (root: .clrk--reduced)
//   handover  a milestone day: after the stamp beat call onHandover()
//             instead of playing the fare and the rest (the milestone's
//             ceremony replaces them)
//   onHandover()  the stamp has landed on a milestone day
//   onFareBeat()  the fare has landed (the view then plays a level-up)
//   onLeave()     the gate: back to the station (/today)
export default function ClearPhone({ result, model, reduced, handover, onHandover, onFareBeat, onLeave }) {
  const { t, lang } = useLang()
  const once = useRef(false)
  useEffect(() => {
    if (once.current) return
    once.current = true
    playDayClear()
    if (handover) onHandover?.()
    else onFareBeat?.()
  }, [handover, onHandover, onFareBeat])

  const { fare, level, piles, marks, tomorrow, next } = model
  return (
    <main id="main-content" className={['clr-phone', reduced && 'clrk--reduced'].filter(Boolean).join(' ')}>
      <ClearHeader center cap="本日の運行 終了" title={t.clrTitle} />
      <WeekStamps week={model.week} label={t.clrWeekAria(weekParts(model.week, t, lang))} className="clr-phone__week" />
      <p className="clr-phone__streak"><b>{model.streak}</b> {t.clrStreakWord}</p>
      <div className="clr-phone__fare">
        <XpTotal value={fare.total} shine={!reduced} figureClass="clr-phone__total" />
        <p className="clr-phone__break">
          <span><b>+{fare.run}</b> {t.clrFareRun}</span>
          {fare.bonus > 0 && <span><b>+{fare.bonus}</b> {t.clrFarePrime}</span>}
        </p>
        {level && (
          <LevelBar
            from={level.from} to={level.to} className="clr-phone__lvl"
            label={t.clrLevelAria(level.level, Math.round(level.to * 100))}
          />
        )}
      </div>
      <div className="clr-phone__piles">
        {piles.map((n, v) => (
          <Pile key={v} as="button" type="button" verdict={v} count={n} className="clr-phone__pile" aria-label={t.clrPileAria(t.clrPiles[v], n)}>
            <b>{n}</b>
            <span>{t.clrPiles[v]}</span>
          </Pile>
        ))}
      </div>
      <p className="clr-phone__sum">
        <span><b>{marks.up}</b> {t.clrSumUp(marks.up)}</span>
        <span><b>{marks.mastered}</b> {t.clrSumMastered(marks.mastered)}</span>
        {model.minutes != null && <span><b>{model.minutes}</b> {t.clrSumMin}</span>}
      </p>
      {tomorrow && (
        <div className="clr-phone__tomorrow">
          <Slot glyph={weekdayKanji(daysBefore(result.day, -1))} state="wait" still tilt={-3} aria-hidden="true" />
          <p>
            {t.clrTomorrow(tomorrow.cards, tomorrow.minutes)}
            {next.milestone === model.streak + 1 && next.jackpot ? ` · ${t.clrNextTicketName(next.milestone)} +${next.jackpot} xp` : ''}
          </p>
        </div>
      )}
      <GateButton compact arrive label={t.backToStation} onClick={onLeave} className="clr-phone__gate" />
      <span className="sr-only">{t.clrSealAria(longDate(result.day, lang))}</span>
    </main>
  )
}
