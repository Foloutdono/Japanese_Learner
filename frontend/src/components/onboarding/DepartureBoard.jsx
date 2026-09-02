import { useLang } from '../../LangContext'
import { SERVICES, MAX_PACE, CHARTER_PATTERN } from './paces'
import { LEVEL_JP } from './levelSigns'
import {
  DAYS_PER_MONTH,
  addDays,
  journeyItems,
  journeyLevels,
  minutesFor,
} from '../../domain/goalMath'

// ── 時刻表 — the departure board (plan 063, phase E) ─────────────
// Scene three's whole control cluster: destination chips (+ 未定),
// the 期日/種別 mode toggle, the months dial in date mode, and the
// board itself — five scheduled services priced in items/day,
// ≈minutes/day, a year-bearing arrival and a journey length, plus the
// 貸切 charter row: FIRST and gold-ringed in date mode (it is your
// train, at the exact required pace), LAST with its inline slider in
// pace mode (any pace the schedule doesn't run). An impossible ask is
// refused ON the board — 運休, with the two honest fixes as buttons —
// never sold rounded-down.
//
// The board is the control: no pace slider beside it. Clicking a
// scheduled row in date mode is "I'll take that service instead" and
// switches to pace mode with that pace. All state lives in the flow's
// one `goal` object; `now` is the clock reading the flow captured on
// entering the scene (a render must not read the clock — see
// JourneyPass for the same rule), so the printed dates hold still
// while the learner dials.

const MONTH_CHIPS = [3, 6, 12, 18]

/** Six stops, calls and passes — the 種別 diagram every service row
 *  draws (and, dashed, the charter). Exported for the pass step. */
export function StopPattern({ served, dashed = false }) {
  const n = served.length
  const x = i => 7 + (106 * i) / (n - 1)
  return (
    <svg className="onb-board__pat" viewBox="0 0 120 14" aria-hidden="true">
      <line
        className={`onb-board__pat-rail${dashed ? ' onb-board__pat-rail--dash' : ''}`}
        x1="7" y1="7" x2="113" y2="7"
      />
      {served.map((s, i) => (
        <circle
          key={i}
          className={s ? 'onb-board__pat-stop' : 'onb-board__pat-skip'}
          cx={x(i)} cy="7" r={s ? 3.6 : 1.8}
        />
      ))}
    </svg>
  )
}

export default function DepartureBoard({ volumes, startLevel, goal, derived, now, onGoal }) {
  const { t, lang } = useLang()
  const numberFmt = lang === 'fr' ? 'fr-FR' : 'en'
  const fmtDs = new Intl.DateTimeFormat(lang === 'fr' ? 'fr' : 'en', { day: 'numeric', month: 'short' })
  // Future dates always carry their year — "2 Sep" twelve months out
  // is a lie of omission.
  const fmtDy = d => `${fmtDs.format(d)} ’${String(d.getFullYear()).slice(2)}`
  const durFor = days => {
    const m = days / DAYS_PER_MONTH
    if (m < 1) return t.durDays(Math.round(days))
    if (m < 21.5) return t.durMonths((Math.round(m * 2) / 2).toLocaleString(numberFmt))
    return t.durYears((Math.round((m / 12) * 10) / 10).toLocaleString(numberFmt))
  }

  const destOptions = journeyLevels(startLevel).slice(1)
  const dateMode = derived.hasDest && goal.mode === 'date'

  const rows = SERVICES.map(sv => {
    const days = derived.items / sv.perDay
    const eta = addDays(now, days)
    return {
      sv,
      days,
      eta,
      makes: dateMode ? eta <= derived.targetDate : true,
    }
  })
  // 推奨: by date, the SLOWEST service that still makes it — the
  // cheapest sufficient ticket; by pace, the ladder's own steady 快速.
  const reco = dateMode ? rows.find(r => r.makes) : rows.find(r => r.sv.recommended)
  const nearer = derived.hasDest
    && journeyLevels(startLevel).indexOf(goal.dest) > 1
    ? journeyLevels(startLevel)[journeyLevels(startLevel).indexOf(goal.dest) - 1]
    : null

  const paceCell = perDay => (
    <span className="onb-board__pace">
      {perDay}
      <span className="onb-board__per">/{t.onbGoalDay}</span>
      <span className="onb-board__min">{t.onbGoalMin(minutesFor(perDay))}</span>
    </span>
  )

  return (
    <div className="onb-goal">
      <div className="onb-dest" role="group" aria-label={t.onbGoalDestAria}>
        {destOptions.map(level => (
          <button
            key={level}
            type="button"
            className="onb-dest__chip"
            aria-pressed={goal.dest === level}
            onClick={() => onGoal({ ...goal, dest: level })}
          >
            <span className="onb-dest__roundel">{level}</span>
            <span className="onb-dest__jp" lang="ja">{LEVEL_JP[level]}</span>
            {volumes && (
              <span className="onb-dest__load">
                {t.onbDestLoad(journeyItems(volumes, startLevel, level).toLocaleString(numberFmt))}
              </span>
            )}
          </button>
        ))}
        <button
          type="button"
          className="onb-dest__chip onb-dest__chip--free"
          aria-pressed={goal.dest === null}
          onClick={() => onGoal({ ...goal, dest: null })}
        >
          <span className="onb-dest__roundel" lang="ja">未定</span>
          <span className="onb-dest__jp" lang="ja">気まま</span>
          <span className="onb-dest__load">{t.onbDestFree}</span>
        </button>
      </div>

      {derived.hasDest && (
        <div className="onb-mode" role="group" aria-label={t.onbGoalModeAria}>
          <button
            type="button"
            className="onb-mode__btn"
            aria-pressed={goal.mode === 'date'}
            onClick={() => onGoal({ ...goal, mode: 'date' })}
          >
            <span lang="ja">期日</span>{t.onbModeDate}
          </button>
          <button
            type="button"
            className="onb-mode__btn"
            aria-pressed={goal.mode === 'pace'}
            onClick={() => onGoal({ ...goal, mode: 'pace' })}
          >
            <span lang="ja">種別</span>{t.onbModePace}
          </button>
        </div>
      )}

      {dateMode && (
        <div className="onb-months">
          <span className="onb-months__label">{t.onbArriveIn}</span>
          <span className="onb-months__chips">
            {MONTH_CHIPS.map(m => (
              <button
                key={m}
                type="button"
                className="onb-months__chip"
                aria-pressed={goal.months === m}
                onClick={() => onGoal({ ...goal, months: m })}
              >
                {t.onbMonths(m)}
              </button>
            ))}
          </span>
          <span className="onb-months__dial">
            <input
              type="range"
              min="2"
              max="30"
              step="1"
              value={goal.months}
              aria-label={t.onbArriveIn}
              onChange={e => onGoal({ ...goal, months: +e.target.value })}
            />
            <output>{t.onbMonths(goal.months)} · {fmtDy(derived.targetDate)}</output>
          </span>
        </div>
      )}

      <div className="onb-board">
        <div className="onb-board__head">
          <span className="onb-board__title" lang="ja">
            {startLevel} → {derived.hasDest ? goal.dest : 'N1'}
            <span className="onb-board__cap">{t.onbGoalDepartures}</span>
          </span>
          <span className="onb-board__clock">
            {dateMode
              ? <><span lang="ja">目標</span> {fmtDy(derived.targetDate)}</>
              : fmtDs.format(now)}
          </span>
        </div>

        <div className="onb-board__cols" aria-hidden="true">
          <span>{t.onbColService}</span>
          <span>{t.onbColPace}</span>
          <span>{t.onbColArrival}</span>
          <span className="onb-board__col-dur">{t.onbColJourney}</span>
        </div>

        {/* 貸切 in date mode: YOUR train, first on the board. */}
        {dateMode && (
          <div className={`onb-board__row onb-board__row--charter onb-board__row--yours${derived.feasible ? '' : ' onb-board__row--void'}`}>
            <span className="onb-board__svc">
              <span className="onb-board__svc-name">
                <span lang="ja">貸切</span>
                <span className="onb-board__en">{t.onbCharterYours}</span>
              </span>
              <StopPattern served={CHARTER_PATTERN} dashed />
            </span>
            {paceCell(derived.required)}
            <span className="onb-board__eta" lang={derived.feasible ? undefined : 'ja'}>
              {derived.feasible ? fmtDy(derived.targetDate) : '運休'}
            </span>
            <span className="onb-board__dur">
              {derived.feasible ? durFor(goal.months * DAYS_PER_MONTH) : '—'}
            </span>
          </div>
        )}

        {rows.map(r => (
          <button
            key={r.sv.id}
            type="button"
            className={`onb-board__row${r.makes ? '' : ' onb-board__row--late'}`}
            aria-pressed={!dateMode && goal.perDay === r.sv.perDay}
            onClick={() => onGoal({ ...goal, mode: 'pace', perDay: r.sv.perDay })}
          >
            <span className="onb-board__svc">
              <span className="onb-board__svc-name">
                <span lang="ja">{r.sv.jp}</span>
                <span className="onb-board__en">{r.sv.en}</span>
                {reco?.sv.id === r.sv.id && (
                  <span className="onb-board__reco" lang="ja" title={t.onbPaceRecommended}>推奨</span>
                )}
              </span>
              <StopPattern served={r.sv.pattern} />
            </span>
            {paceCell(r.sv.perDay)}
            <span className="onb-board__eta">
              {fmtDy(r.eta)}
              {!r.makes && <span className="onb-board__late" lang="ja">遅</span>}
            </span>
            <span className="onb-board__dur">{durFor(r.days)}</span>
          </button>
        ))}

        {/* 貸切 in pace mode: any pace the schedule doesn't run, last. */}
        {!dateMode && (
          <div
            className="onb-board__row onb-board__row--charter"
            data-selected={!SERVICES.some(sv => sv.perDay === goal.perDay) || undefined}
          >
            <span className="onb-board__svc">
              <span className="onb-board__svc-name">
                <span lang="ja">貸切</span>
                <span className="onb-board__en">{t.onbCharterAny}</span>
              </span>
              <input
                className="onb-board__dial"
                type="range"
                min="3"
                max={MAX_PACE}
                step="1"
                value={goal.perDay}
                aria-label={t.onbCharterAria}
                onChange={e => onGoal({ ...goal, perDay: +e.target.value })}
              />
            </span>
            {paceCell(goal.perDay)}
            <span className="onb-board__eta">{fmtDy(addDays(now, derived.items / goal.perDay))}</span>
            <span className="onb-board__dur">{durFor(derived.items / goal.perDay)}</span>
          </div>
        )}

        {dateMode && !derived.feasible && (
          <div className="onb-board__notice">
            <p className="onb-board__notice-line">
              <span lang="ja">運休</span>
              {t.onbNoService(derived.required, MAX_PACE)}
            </p>
            <div className="onb-board__fixes">
              <button
                type="button"
                className="onb-board__fix"
                onClick={() => onGoal({
                  ...goal,
                  months: Math.ceil((derived.items / 20) / DAYS_PER_MONTH),
                })}
              >
                <strong>{t.onbFixDate}</strong>
                {t.onbFixDateSub(goal.dest, durFor(derived.items / 20))}
              </button>
              {nearer && (
                <button
                  type="button"
                  className="onb-board__fix"
                  onClick={() => onGoal({ ...goal, dest: nearer })}
                >
                  <strong>{t.onbFixDest}</strong>
                  {t.onbFixDestSub(nearer, journeyItems(volumes, startLevel, nearer).toLocaleString(numberFmt))}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
