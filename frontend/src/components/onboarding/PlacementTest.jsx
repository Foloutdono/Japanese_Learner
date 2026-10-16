import { useEffect, useState } from 'react'
import { useLang } from '../../LangContext'
import { playUi } from '../../lib/audio'
import QuestionRenderer from '../../exam/QuestionRenderer'
import { Loading } from '../ui/Loading'
import { useDesk } from '../../hooks/useDesk'
import { CHOICE_KEY_INDEX } from '../../domain/choiceKeys'
import { runKey } from '../../lib/keyGuards'
import { useClimb } from './useClimb'

// ── 実力診断 — the placement test ────────────────────────────────
// The climb (plan 224): asked at N5, up a level each time one is
// cleared, as far as N1 -- one question at a time through the exam
// screens' own QuestionRenderer (mcq-text hits McqBlock, which brings
// the roving-tabindex radiogroup for free). How many questions it asks
// is the learner's answers' doing, so the head draws the levels rather
// than a count: the ones cleared, the one being asked. useClimb holds
// the round trips; this is Settings' frame for them, and the boarding
// draws its own (boarding/TestStep).
//
// Self-contained on purpose: reports the verdict through
// onResult(result) and renders no follow-up of its own -- Settings
// offers "apply?".
//
// Props:
//   session    — Supabase session for the API calls
//   onResult   — ({recommendedLevel, correct, total, perLevel}) => void
//   onCancel   — optional; renders a quiet leave link when present
export default function PlacementTest({ session, onResult, onCancel }) {
  const { t } = useLang()
  const climb = useClimb(session, onResult)
  const [picked, setPicked] = useState({ id: null, choice: null })
  const desk = useDesk()

  if (climb.phase === 'loading') return <Loading />
  if (climb.phase === 'error') {
    return (
      <div className="onb-test__error">
        <p>{t.onbTestError}</p>
        <div className="onb-test__escape">
          <button type="button" className="onb-link" onClick={climb.retry}>{t.retry}</button>
          {onCancel && <button type="button" className="onb-link" onClick={onCancel}>{t.back}</button>}
        </div>
      </div>
    )
  }

  const question = climb.question
  const waiting = climb.phase === 'waiting'
  // The choice belongs to the question it was made on: the next one
  // arrives with nothing picked.
  const selected = picked.id === question.id ? picked.choice : null

  function advance() {
    if (selected == null || waiting) return
    playUi('click')
    climb.answer(selected)
  }
  function pick(id) {
    if (!waiting) setPicked({ id: question.id, choice: id })
  }

  return (
    <div className="onb-test" aria-busy={waiting}>
      <div className="onb-test__meta">
        <ClimbRungs level={climb.level} perLevel={climb.perLevel} />
      </div>

      <div className="onb-test__instructions">{t.onbTestKind[question.kind] ?? ''}</div>

      <QuestionRenderer
        key={question.id}
        question={question}
        selected={selected}
        onSelect={pick}
        keys={desk}
      />
      {desk && <PlacementKeys choices={question.choices ?? []} selected={selected} onPick={pick} onAdvance={advance} />}

      <div className="onb-step__actions">
        <button
          type="button"
          className="onb-action"
          disabled={selected == null || waiting}
          onClick={advance}
          aria-keyshortcuts={desk ? 'Enter' : undefined}
        >
          {t.onbContinue}
          {desk && <kbd className="desk-kbd" aria-hidden="true">{t.keyEnter}</kbd>}
        </button>
      </div>

      <div className="onb-test__escape">
        {/* The early exit: the level being asked is not cleared, and the
            learner boards there -- what "it got too hard here" means. */}
        <button type="button" className="onb-link" disabled={waiting} onClick={climb.stop} data-action="climb-stop">
          {t.onbTestStop}
        </button>
        {onCancel && (
          <button type="button" className="onb-link" onClick={onCancel}>{t.cancel}</button>
        )}
      </div>
    </div>
  )
}

// ── The climb's levels, as the test's head ───────────────────────
// N5 to N1, the ones cleared in the pass's gold, the one being asked
// ringed, the rest ahead. Shared with the boarding's test.
const CLIMB_LEVELS = ['N5', 'N4', 'N3', 'N2', 'N1']

export function ClimbRungs({ level, perLevel = {} }) {
  const { t } = useLang()
  return (
    <ol className="onb-climb" aria-label={t.onbClimbLabel}>
      {CLIMB_LEVELS.map(code => {
        const state = perLevel[code]?.cleared ? 'done' : code === level ? 'at' : 'ahead'
        return (
          <li
            key={code}
            className={`onb-climb__rung onb-climb__rung--${state}`}
            aria-current={state === 'at' ? 'step' : undefined}
          >
            {code}
          </li>
        )
      })}
    </ol>
  )
}

// ── 机 — the test's keys (plan 123) ────────────────────────────────
// The test in Settings answers keys the way the mock exam on the same
// questions does -- a digit picks, Enter goes on. Enter from a choice
// the pointer or the arrows left focused goes on too; Stop and Cancel
// keep their own. Rendered on the desk only, here and in the boarding.
export function PlacementKeys({ choices, selected, onPick, onAdvance }) {
  useEffect(() => {
    const onKey = e => {
      if (!runKey(e)) return
      const idx = CHOICE_KEY_INDEX[e.key]
      if (idx !== undefined && idx < choices.length) {
        e.preventDefault()
        playUi('click-mode-selection')
        onPick(choices[idx].id)
        return
      }
      if (e.key !== 'Enter' || e.shiftKey || selected == null) return
      const target = e.target
      if (/^(BUTTON|A)$/.test(target?.tagName ?? '') && target.getAttribute('role') !== 'radio') return
      e.preventDefault()
      target?.blur?.()
      onAdvance()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [choices, selected, onPick, onAdvance])
  return null
}
