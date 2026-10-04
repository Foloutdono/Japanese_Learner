import { useMemo, useState } from 'react'
import { useLang } from '../../LangContext'
import { apiJson } from '../../lib/api'
import { currentSession } from '../../lib/session'
import { playClick, playUi } from '../../lib/audio'
import { refreshSummary, useProfileSummary } from '../../stores/profileSummary'
import { useJourneyStatus, useVolumes, refreshJourney } from '../../stores/journey'
import { NOVICE_GOAL, journeyLevels, journeyModel } from '../../domain/goalMath'
import { goalDerived } from '../onboarding/goalDerived'
import { DEFAULT_PER_DAY } from '../onboarding/paces'
import { SettingsPage, Slip } from './SettingsPage'
import { dateFormat, stopParts } from './contract'
import { useDesk } from '../../hooks/useDesk'
import { useRadioWalk, radioTab } from '../../hooks/useRadioWalk'

const iso = d => d.toISOString().slice(0, 10)

// The first JLPT stop: the only boarding level the kana stop is still
// ahead of (routes/journey.py refuses it from any other).
const FIRST_STOP = 'N5'

// ── Destination (canvas SettingsDestination, plan 074; plan 139) ──
// The office signs the first contract at the boarding; this signs every
// one after it. The line drawn upright from the stop you stand at, every
// stop ahead with the date the pass's own service reaches it — the
// price of each destination printed beside it rather than only once it
// is chosen — and the two moves: hand the destination back, or reprint.
// The service itself is the pass's next field (ServicePage.jsx); here
// it prices the stops and rides along with the contract.
//
// Two writes, each a different promise:
//   POST   /api/journey/goal     a NEW contract — a different stop
//   DELETE /api/journey/goal     hand the destination back (払戻)
// The date a reprint prints is the one the service promises from today
// (goalDerived), computed with a fresh clock at POST time, so a page
// left open for an hour cannot print a stale date.
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
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)
  const [done, setDone] = useState(null) // 'issued' | 'dropped' | null
  // One tab stop on the desk (plan 123). The destination is dialled here
  // and issued by the button under it, so the arrows check it.
  const desk = useDesk()
  const onWalk = useRadioWalk(desk)

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
  const pace = status?.plannedPerDay ?? summary?.dailyNewTarget ?? DEFAULT_PER_DAY
  const chosenDest = dest === undefined ? printedDest : dest
  const dirty = chosenDest !== printedDest
  const chosenAt = options.indexOf(chosenDest)

  // Every stop's arrival at the pass's service, from the moment the
  // facts arrived — the same arithmetic Reprint prints with.
  // A handful of sums a stop, so it is not memoised.
  const arrivals = volumes && startLevel && nowMs
    ? Object.fromEntries(options.map(level => [
      level,
      goalDerived(volumes, startLevel, { dest: level, mode: 'service', perDay: pace }, new Date(nowMs)).targetDate,
    ]))
    : {}
  const model = useMemo(() => (status && nowMs ? journeyModel(status, new Date(nowMs)) : null), [status, nowMs])

  const fmt = dateFormat(lang)
  const printed = status?.goalTargetDate ? new Date(status.goalTargetDate) : null
  const validUntil = dirty ? arrivals[chosenDest] ?? null : printed
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
      .then(() => { setDest(undefined); setDone(outcome) })
      .catch(() => setFailed(true))
      .finally(() => setBusy(false))
  }

  function reprint() {
    if (!chosenDest || !dirty || !volumes) return
    playUi('click')
    // A fresh clock for the printed date: the office's own rule.
    const target = iso(goalDerived(volumes, startLevel, { dest: chosenDest, mode: 'service', perDay: pace }, new Date()).targetDate)
    const body = { goalLevel: chosenDest, goalTargetDate: target, dailyNewTarget: pace }
    send(currentSession().then(session => apiJson('/api/journey/goal', session, { method: 'POST', body: JSON.stringify(body) })), 'issued')
  }

  function drop() {
    playUi('click')
    send(currentSession().then(session => apiJson('/api/journey/goal', session, { method: 'DELETE' })), 'dropped')
  }

  const here = stopParts(t, startLevel)

  return (
    <SettingsPage title={t.settingsGoal}>
      <Slip>
        <div className="dest-stops">
          {startLevel && (
            <div className={`dest-here${chosenAt >= 0 ? ' dest-here--leaving' : ''}`}>
              <span className="dest__dot" aria-hidden="true" />
              <span className="dest__names"><span className="dest__code">{here.code}</span><span className="dest__load">{here.name}</span></span>
              <span className="dest__when dest__when--here">{t.levelCurrentMark}</span>
            </div>
          )}
          <div className="dest-grid" role="radiogroup" aria-label={t.settingsGoal} onKeyDown={onWalk}>
            {options.map((level, i) => {
              const stop = stopParts(t, level)
              const at = arrivals[level]
              return (
                <button
                  key={level}
                  type="button"
                  role="radio"
                  aria-checked={chosenDest === level}
                  tabIndex={radioTab(desk, i, chosenAt)}
                  disabled={busy}
                  className={`dest${chosenDest === level ? ' dest--on' : ''}${i <= chosenAt ? ' dest--ridden' : ''}${i < chosenAt ? ' dest--through' : ''}`}
                  onClick={() => { playClick(); setDest(level) }}
                  data-dest={level}
                >
                  <span className="dest__dot" aria-hidden="true" />
                  <span className="dest__names"><span className="dest__code">{stop.code}</span><span className="dest__load">{stop.name}</span></span>
                  <span className="dest__when">
                    {at ? fmt.format(at) : ''}
                    {level === printedDest && <span className="dest__tag">{t.destOnPass}</span>}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
        {terminus && <span className="slip__hint">{t.settingsGoalTerminus}</span>}
        {!terminus && !chosenDest && <span className="slip__hint">{t.settingsGoalNoneDesc}</span>}
      </Slip>

      <div className="stg-foot">
        {chosenDest && validUntil && (
          <div className="stg-foot__line dest-line">
            <span className="cap">{t.destValidUntil}</span>
            <b className="dest-line__date">{fmt.format(validUntil)}</b>
            {dirty && printed && <span className="stg-foot__was">{t.settingsInsteadOf(fmt.format(printed))}</span>}
            {drift && <span className="stg-foot__was">{t.destMovesTo(fmt.format(drift))}</span>}
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
      </div>

      {done && <p className="hint" role="status">{done === 'issued' ? t.settingsGoalIssued : t.settingsGoalDropped}</p>}
      {failed && <p className="hint" role="alert">{t.onbPassError}</p>}
    </SettingsPage>
  )
}
