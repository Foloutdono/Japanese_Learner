import { useMemo, useState } from 'react'
import { useLang } from '../../LangContext'
import { apiJson } from '../../lib/api'
import { playClick, playUi } from '../../lib/audio'
import { refreshSummary, useProfileSummary } from '../../stores/profileSummary'
import { useJourneyStatus, useVolumes, refreshJourney } from '../../stores/journey'
import { NOVICE_GOAL, journeyLevels, journeyModel } from '../../domain/goalMath'
import { goalDerived } from '../onboarding/goalDerived'
import { DEFAULT_PER_DAY, PACES } from '../onboarding/paces'
import { DEPARTURES, DEPART_TIMES } from '../onboarding/departures'
import { SettingsPage, Slip } from './SettingsPage'

const iso = d => d.toISOString().slice(0, 10)

// The first JLPT stop: the only boarding level the kana stop is still
// ahead of (routes/journey.py refuses it from any other).
const FIRST_STOP = 'N5'

// ── Destination (canvas SettingsDestination, plan 074) ────────
// The office signs the first contract at the boarding; this signs every
// one after it. The destination as the stops ahead, the service as the
// three paces, the daily ride hour, then the line the pass will print
// (Valid until …, and where today's pace would actually land) and the
// two moves: hand the destination back, or reprint.
//
// Three writes, each a different promise:
//   POST   /api/journey/goal     a NEW contract — a different stop
//   POST   /api/journey/reprint  the date and the pace on the contract
//                                that exists, or the hour alone
//   DELETE /api/journey/goal     hand the destination back (払戻)
// The date a reprint prints is the one THIS service promises from
// today (goalDerived), computed with a fresh clock at POST time, so a
// page left open for an hour cannot print a stale date. The pace rides
// with the contract because a destination and the pace that reaches
// it are one decision.
export function DestinationPage() {
  const { t, lang } = useLang()
  const summary = useProfileSummary()
  // The facts and the moment they arrived: every date the page prints
  // derives from that reading (at most the store's TTL old, which is
  // nothing in days), so render never reads the clock; the writes
  // below take a fresh one in their handlers.
  const { data: status, at: nowMs } = useJourneyStatus()
  const { data: volumes } = useVolumes()
  // What is dialled on the page, undefined while it follows the pass.
  const [dest, setDest] = useState(undefined)
  const [perDay, setPerDay] = useState(undefined)
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)
  const [done, setDone] = useState(null) // 'issued' | 'dropped' | null

  const startLevel = summary?.jlptLevel ?? null
  // 行先 — the stops ahead. The kana stop rides at the head of the list
  // for a learner still short of the syllabaries: the counter issues it
  // like any other destination (routes/journey.py), and only from the
  // first JLPT stop, since nobody standing above N5 is still on them.
  const kanaAhead = startLevel === FIRST_STOP && summary?.kanaKnown !== 'both'
  const options = startLevel
    ? [...(kanaAhead ? [NOVICE_GOAL] : []), ...journeyLevels(startLevel).slice(1)]
    : []
  const terminus = !!startLevel && options.length === 0
  const printedDest = status?.goalLevel ?? null
  const printedPace = status?.plannedPerDay ?? null
  const chosenDest = dest === undefined ? printedDest : dest
  const chosenPace = perDay === undefined ? (printedPace ?? DEFAULT_PER_DAY) : perDay
  const dirty = chosenDest !== printedDest || (chosenDest != null && chosenPace !== printedPace)

  const derived = useMemo(
    () => (volumes && startLevel && chosenDest && nowMs
      ? goalDerived(volumes, startLevel, { dest: chosenDest, mode: 'service', perDay: chosenPace }, new Date(nowMs))
      : null),
    [volumes, startLevel, chosenDest, chosenPace, nowMs],
  )
  const model = useMemo(() => (status && nowMs ? journeyModel(status, new Date(nowMs)) : null), [status, nowMs])

  const fmt = new Intl.DateTimeFormat(lang === 'fr' ? 'fr' : 'en', { day: 'numeric', month: 'short', year: 'numeric' })
  const printed = status?.goalTargetDate ? new Date(status.goalTargetDate) : null
  const validUntil = dirty ? derived?.targetDate ?? null : printed
  const drift = !dirty && model?.hasGoal && model.projected && model.deltaDays != null && Math.abs(model.deltaDays) >= 1
    ? model.projected
    : null

  function send(request, outcome) {
    if (busy) return
    setBusy(true)
    setFailed(false)
    setDone(null)
    request
      .then(() => Promise.all([refreshJourney(), refreshSummary()]))
      .then(() => { setDest(undefined); setPerDay(undefined); setDone(outcome) })
      .catch(() => setFailed(true))
      .finally(() => setBusy(false))
  }

  function reprint() {
    if (!chosenDest || !derived?.targetDate) return
    playUi('click')
    // A fresh clock for the printed date: the office's own rule.
    const target = iso(goalDerived(volumes, startLevel, { dest: chosenDest, mode: 'service', perDay: chosenPace }, new Date()).targetDate)
    const body = chosenDest === printedDest
      ? { goalTargetDate: target, dailyNewTarget: chosenPace }
      : { goalLevel: chosenDest, goalTargetDate: target, dailyNewTarget: chosenPace }
    const path = chosenDest === printedDest ? '/api/journey/reprint' : '/api/journey/goal'
    send(apiJson(path, null, { method: 'POST', body: JSON.stringify(body) }), 'issued')
  }

  function drop() {
    playUi('click')
    send(apiJson('/api/journey/goal', null, { method: 'DELETE' }), 'dropped')
  }

  function setHour(id) {
    if (id === (status?.dailyDeparture ?? null)) return
    playClick()
    send(apiJson('/api/journey/reprint', null, { method: 'POST', body: JSON.stringify({ dailyDeparture: id }) }), null)
  }

  return (
    <SettingsPage title={t.settingsGoal}>
      <Slip label={t.settingsGoal} cap={t.destOnPass}>
        <div className="dest-grid" role="radiogroup" aria-label={t.settingsGoal}>
          {options.map(level => (
            <button
              key={level}
              type="button"
              role="radio"
              aria-checked={chosenDest === level}
              disabled={busy}
              className={`dest${chosenDest === level ? ' dest--on' : ''}`}
              onClick={() => { playClick(); setDest(level) }}
              data-dest={level}
            >
              <span className="dest__code">{level === NOVICE_GOAL ? '—' : level}</span>
              <span className="dest__load">{level === NOVICE_GOAL ? t.brdNovice : t.levelName[level]}</span>
            </button>
          ))}
        </div>
        {terminus && <span className="slip__hint">{t.settingsGoalTerminus}</span>}
        {!terminus && !chosenDest && <span className="slip__hint">{t.settingsGoalNoneDesc}</span>}
      </Slip>

      <Slip label={t.destService} cap={t.settingsPaceCap}>
        <div className="svc-grid" role="radiogroup" aria-label={t.destService}>
          {PACES.map(p => (
            <button
              key={p.id}
              type="button"
              role="radio"
              aria-checked={chosenPace === p.perDay}
              disabled={busy}
              className={`svc${chosenPace === p.perDay ? ' svc--on' : ''}`}
              onClick={() => { playClick(); setPerDay(p.perDay) }}
            >
              <span className="svc__jp">{t.paceName[p.id]}</span>
              <span className="svc__pace">
                {p.perDay} {t.settingsPerDay}
                {p.recommended && <> <span className="svc__star" aria-hidden="true">★</span></>}
              </span>
            </button>
          ))}
        </div>
      </Slip>

      {/* The hour rides with or without a destination — it is a habit,
          not a promise, and the pass prints it either way. */}
      <Slip label={t.destDailyRide} cap={t.destOptional}>
        <div className="hour-grid" role="radiogroup" aria-label={t.destDailyRide}>
          {[...DEPARTURES, null].map(id => {
            const on = (status?.dailyDeparture ?? null) === id
            return (
              <button
                key={id ?? 'free'}
                type="button"
                role="radio"
                aria-checked={on}
                disabled={busy || !status}
                data-hour={id ?? 'free'}
                className={`svc${on ? ' svc--on' : ''}`}
                onClick={() => setHour(id)}
              >
                <span className="svc__jp">{id ? t.destHour[id] : t.destFlexible}</span>
                <span className="svc__pace">{id ? DEPART_TIMES[id] : t.destAnyTime}</span>
              </button>
            )
          })}
        </div>
      </Slip>

      {chosenDest && validUntil && (
        <div className="jour-line dest-line">
          <span className="jour-line__validity">
            <span className="jour-cap">{t.destValidUntil}</span>
            <b className="dest-line__date">{fmt.format(validUntil)}</b>
          </span>
          {drift && <span className="jour-cap dest-line__note">{t.destMovesTo(fmt.format(drift))}</span>}
        </div>
      )}

      <div className="form__row">
        <button type="button" className="btn-secondary" disabled={busy || !printedDest} data-action="goal-drop" onClick={drop}>
          {t.settingsGoalDrop}
        </button>
        <button type="button" className="btn-depart btn-depart--sheet" disabled={busy || !chosenDest || !dirty} data-action="goal-reprint" onClick={reprint}>
          <span className="btn-depart__jp">{t.destReprint}</span>
        </button>
      </div>

      {done && <p className="hint" role="status">{done === 'issued' ? t.settingsGoalIssued : t.settingsGoalDropped}</p>}
      {failed && <p className="hint" role="alert">{t.onbPassError}</p>}
    </SettingsPage>
  )
}
