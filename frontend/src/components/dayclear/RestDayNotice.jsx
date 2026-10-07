import { useLang } from '../../LangContext'
import { EnterKey } from '../chrome/DeskKeys'
import { ClearHeader, WeekStamps, Slot, GateButton } from './kit'
import { dayName, weekParts } from './aria'

// ── 運休 — a rest day covered a missed one (plan 191) ─────────────────
// The canvas's RestDay board, shown once on Today the morning after: the
// week row with the missed day covered by a 運休 ticket (pass ink, not
// stamp ink) and today waiting; "Ta série tient" and the streak kept;
// the rest days left and when the next comes; today's ride (41 cartes ·
// ~14 min) and the gate "Départ". TodayScreen shows it while
// `today.rest.unseen` names a day and marks it seen (POST
// /api/today/rest/seen) the moment it leaves, by Départ or any other
// way out.
//
// PLACEHOLDER (foundation): static. The screen agent ports the board and
// owns the `restday` region of index.css and the `clrRestday` locale group.
//
// Props:
//   rest     Today's `rest`: { held, unseen: [YYYY-MM-DD], streak, next_at }
//   week     the 7 days ending today ({ day, kanji, state: studied |
//            rest | missed | today }) -- domain/dayClear's restWeek()
//   total    the day's cards (Today's `total`)
//   minutes  what they take (from the gate's pace), or null
//   desk     drawn beside the rail
//   reduced  the rest state at once
//   onDepart()  "Départ": the day's run
export default function RestDayNotice({ rest, week, total, minutes, desk, reduced, onDepart }) {
  const { t, lang } = useLang()
  const used = rest?.unseen?.at(-1)
  return (
    <section className={['rst', desk && 'rst--desk', reduced && 'clrk--reduced'].filter(Boolean).join(' ')} aria-labelledby="rst-title">
      <ClearHeader center cap="連続乗車 継続" title={t.rstTitle} titleId="rst-title" as="h2" />
      <WeekStamps week={week} label={t.rstWeekAria(weekParts(week, t, lang))} />
      <p className="rst__streak"><b>{rest?.streak ?? 0}</b> {t.clrStreakWord}</p>
      <div className="rst__reserve">
        <Slot state="rest" aria-hidden="true" />
        <p>
          {used && <span>{t.rstUsed(dayName(used, lang))}</span>}
          <span><b>{rest?.held ?? 0}</b> {t.clrRestHeld}{rest?.next_at ? ` · ${t.clrRestNext(rest.next_at)}` : ''}</span>
        </p>
      </div>
      <div className="rst__today" role="group" aria-label={t.rstTodayAria(total ?? 0, minutes ?? 0)}>
        <span><b>{total ?? 0}</b> {t.rstCards}</span>
        {minutes != null && <span><b>~{minutes}</b> {t.clrSumMin}</span>}
      </div>
      <GateButton compact arrive keys={desk} label={t.rstDepart} onClick={onDepart} />
      <EnterKey onEnter={onDepart} />
    </section>
  )
}
