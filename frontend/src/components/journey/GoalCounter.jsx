import { useEffect, useMemo, useState } from 'react'
import { useLang } from '../../LangContext'
import { apiJson } from '../../lib/api'
import { playClick, playUi } from '../../lib/audio'
import { refreshSummary, useProfileSummary } from '../../stores/profileSummary'
import { DAYS_PER_MONTH, addDays, journeyLevels } from '../../domain/goalMath'
import CallingAt from '../onboarding/CallingAt'
import DepartureBoard from '../onboarding/DepartureBoard'
import { DepartureChips } from '../onboarding/DepartureChips'
import { goalDerived } from '../onboarding/goalDerived'
import { DEFAULT_PER_DAY, MAX_PACE } from '../onboarding/paces'
import { ContractGrid } from './ContractGrid'

// ── 行先 — the destination counter (settings) ────────────────────
// The office signs the first contract; this signs every one after it.
// Until it existed, the pass's own back could say "no destination on
// this pass — set one at the office" and the office was a flow that
// only runs once: the link led to a settings screen with nothing about
// a goal on it. Now it lands here (/settings#goal).
//
// Deliberately the SAME instruments, not a second set:
//   ContractGrid   what the pass prints today
//   DepartureBoard the destination chips, the 期日/種別 toggle, the
//                  months dial, and the board that prices every
//                  service — including its 運休 refusal, so an
//                  impossible ask is refused here exactly as it is at
//                  the office
//   CallingAt      the milestones the chosen service reaches
//   DepartureChips the daily hour
// Anything the office learns about honesty, this counter learns too.
//
// Three writes, and each is a different promise:
//   POST   /api/journey/goal     a NEW contract (stamps 発行日)
//   DELETE /api/journey/goal     hand the destination back (払戻)
//   POST   /api/journey/reprint  the hour alone — a habit, not a promise
// The pace rides on the contract because a destination and the pace
// that reaches it are one decision (the board prices them together);
// the 学習 counter next door keeps the same knob for a learner who
// only wants to ride faster.

const MS_PER_DAY = 86400000
// The months dial's own bounds (see DepartureBoard's <input type=
// "range">) — a pass whose printed date falls outside them opens on
// the nearest month the dial can actually show.
const MIN_MONTHS = 2
const MAX_MONTHS = 30
const DEFAULT_MONTHS = 12
const MIN_PACE = 3 // the charter dial's floor

const iso = d => d.toISOString().slice(0, 10)
const clamp = (n, lo, hi) => Math.min(Math.max(n, lo), hi)

export function GoalCounter({ session }) {
  const { t, lang } = useLang()
  const summary = useProfileSummary()
  const [status, setStatus] = useState(null)
  const [volumes, setVolumes] = useState(null)
  const [loadFailed, setLoadFailed] = useState(false)
  // The board's whole state while it is open, null when it is shut —
  // one value, so closing the counter cannot leave a half-dialled
  // destination behind.
  const [editing, setEditing] = useState(null)
  // The clock reading taken when the board opened: every date it
  // prints derives from it, so nothing drifts while the learner dials
  // and render never reads the clock (the React purity rule the pass
  // back follows for the same reason).
  const [editNow, setEditNow] = useState(null)
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)
  const [done, setDone] = useState(null) // 'issued' | 'dropped' | null

  useEffect(() => {
    let cancelled = false
    apiJson('/api/journey/status', session)
      .then(s => { if (!cancelled) setStatus(s) })
      .catch(() => { if (!cancelled) setLoadFailed(true) })
    // The board prices the journey in items, so it needs the volumes.
    // Their failure closes the board (there is nothing honest to show
    // without them), never the counter.
    apiJson('/api/onboarding/volumes', session)
      .then(v => { if (!cancelled) setVolumes(v) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [session])

  // Where a NEW contract boards: where the learner stands today, not
  // where an older one boarded — routes/journey.py stamps exactly this
  // level, and the board must price what the backend will promise.
  const startLevel = summary?.jlptLevel ?? null
  const editNowDate = useMemo(() => (editNow != null ? new Date(editNow) : null), [editNow])
  const derived = useMemo(
    () => (volumes && editing && editNowDate && startLevel
      ? goalDerived(volumes, startLevel, editing, editNowDate)
      : null),
    [volumes, editing, editNowDate, startLevel],
  )

  const fmt = new Intl.DateTimeFormat(lang === 'fr' ? 'fr' : 'en', {
    day: 'numeric', month: 'short', year: 'numeric',
  })

  const hasGoal = !!status?.goalLevel
  const contract = status && (hasGoal || status.plannedPerDay != null) ? status : null
  // An N1 learner is already at 終着: there is no station further down
  // the line to promise, so the counter says so instead of offering an
  // empty board.
  const terminus = !!startLevel && journeyLevels(startLevel).length < 2
  const canEdit = !!(volumes && startLevel) && !terminus

  function open() {
    playClick()
    const now = Date.now()
    setDone(null)
    setFailed(false)
    setEditNow(now)
    setEditing({
      // The board opens ON the contract the pass carries — the first
      // thing the counter shows is the promise already made, never a
      // fresh suggestion that quietly proposes a different one.
      dest: status?.goalLevel ?? null,
      mode: 'date',
      months: status?.goalTargetDate
        ? clamp(
          Math.round((new Date(status.goalTargetDate) - now) / (DAYS_PER_MONTH * MS_PER_DAY)),
          MIN_MONTHS, MAX_MONTHS,
        )
        : DEFAULT_MONTHS,
      // The column is a free integer and the charter dial is not, so a
      // pace outside its range opens at the nearest end rather than
      // letting the dial and the figure beside it disagree.
      perDay: clamp(status?.plannedPerDay ?? DEFAULT_PER_DAY, MIN_PACE, MAX_PACE),
    })
  }

  function send(request, outcome) {
    if (busy) return
    setBusy(true)
    setFailed(false)
    setDone(null)
    request
      // Every write answers with the fresh facts, so the counter
      // redraws without a second round trip.
      .then(fresh => {
        setStatus(fresh)
        if (outcome) setEditing(null)
        setDone(outcome)
        // The pace travels with the contract, and the HUD, the daily
        // queue and the 学習 counter next door all read it off the
        // summary.
        refreshSummary()
      })
      .catch(() => setFailed(true))
      .finally(() => setBusy(false))
  }

  function issue() {
    if (!derived?.feasible || editing?.dest == null) return
    playUi('click')
    // The date this exact configuration promises, computed with a
    // FRESH clock at POST time — the office's own rule, so a counter
    // left open for an hour cannot print a stale date.
    const days = editing.mode === 'date'
      ? editing.months * DAYS_PER_MONTH
      : derived.items / editing.perDay
    send(apiJson('/api/journey/goal', session, {
      method: 'POST',
      body: JSON.stringify({
        goalLevel: editing.dest,
        goalTargetDate: iso(addDays(new Date(), days)),
        dailyNewTarget: derived.effectivePerDay,
      }),
    }), 'issued')
  }

  function drop() {
    playUi('click')
    send(apiJson('/api/journey/goal', session, { method: 'DELETE' }), 'dropped')
  }

  function setDeparture(id) {
    if (id === (status?.dailyDeparture ?? null)) return
    playClick()
    send(apiJson('/api/journey/reprint', session, {
      method: 'POST',
      body: JSON.stringify({ dailyDeparture: id }),
    }), null)
  }

  // 未定 on a pass that carries a destination is the 払戻: the board's
  // own "just ride" chip IS how a destination is handed back, so the
  // counter has one action button, never two that mean the same thing.
  const dropping = !!editing && editing.dest == null && hasGoal
  const promised = derived?.hasDest && derived.feasible && derived.targetDate
    ? fmt.format(derived.targetDate)
    : null

  return (
    <>
      {contract && !editing && (
        <div className="settings-row settings-row--stack">
          <div className="stg-contract">
            <ContractGrid
              status={contract}
              start={contract.goalStartLevel ?? startLevel}
              fmt={fmt}
              t={t}
            />
          </div>
        </div>
      )}

      {!editing && (
        <div className="settings-row stg-row--wrap">
          <span className="settings-row__label">
            {hasGoal ? t.settingsGoalChangeDesc : t.settingsGoalNoneDesc}
            {terminus && <span className="stg-hint">{t.settingsGoalTerminus}</span>}
          </span>
          <button
            type="button"
            className="btn-secondary"
            disabled={!canEdit || busy}
            onClick={open}
          >
            {hasGoal ? t.settingsGoalChange : t.settingsGoalSet}
          </button>
        </div>
      )}

      {editing && (
        <div className="settings-row settings-row--stack">
          <div className="stg-goal">
            {derived ? (
              <>
                <DepartureBoard
                  volumes={volumes}
                  startLevel={startLevel}
                  goal={editing}
                  derived={derived}
                  now={editNowDate}
                  onGoal={setEditing}
                />
                {derived.hasDest && derived.feasible && derived.items != null && (
                  <CallingAt
                    volumes={volumes}
                    startLevel={startLevel}
                    destLevel={editing.dest}
                    perDay={derived.effectivePerDay}
                    now={editNowDate}
                  />
                )}
              </>
            ) : (
              <p className="stg-hint">{t.onbMapUnavailable}</p>
            )}

            {/* The one line the board cannot draw: pressing 発行 moves
                the pace too, and a settings screen must say exactly
                what a button will do. */}
            <span className="stg-hint">
              {dropping
                ? t.settingsGoalDropHint
                : promised
                  ? t.settingsGoalIssueHint(editing.dest, promised, derived.effectivePerDay)
                  : t.settingsGoalPickHint}
            </span>

            <div className="stg-goal__acts">
              {dropping ? (
                <button type="button" className="onb-action" disabled={busy} onClick={drop}>
                  {t.settingsGoalDrop} <span lang="ja">払戻</span>
                </button>
              ) : (
                <button
                  type="button"
                  className="onb-action"
                  disabled={busy || !promised}
                  onClick={issue}
                >
                  {t.settingsGoalIssue} <span lang="ja">発行</span>
                </button>
              )}
              <button
                type="button"
                className="onb-link"
                disabled={busy}
                onClick={() => { playClick(); setEditing(null) }}
              >
                {t.cancel}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 発車時刻 rides with or without a destination — it is a habit,
          not a promise, and the pass prints it either way. */}
      <div className="settings-row stg-row--wrap">
        <span className="settings-row__label">
          {t.onbFormDepart}
          <span className="stg-hint">{t.settingsGoalDepartHint}</span>
        </span>
        <DepartureChips
          t={t}
          value={status?.dailyDeparture ?? null}
          onChange={setDeparture}
          disabled={busy || !status}
        />
      </div>

      {done && (
        <div className="settings-row">
          <span className="stg-done" role="status">
            {done === 'issued' ? t.settingsGoalIssued : t.settingsGoalDropped}
          </span>
        </div>
      )}
      {(failed || loadFailed) && (
        <div className="settings-row">
          <span className="onb-error" role="alert">{t.onbPassError}</span>
        </div>
      )}
    </>
  )
}
