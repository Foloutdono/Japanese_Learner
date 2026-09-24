import { useEffect, useRef, useState } from 'react'
import { useLang } from '../../LangContext'
import { apiJsonWithTimeout } from '../../lib/api'
import { playUi } from '../../lib/audio'
import QuestionRenderer from '../../exam/QuestionRenderer'
import { Loading } from '../ui/Loading'
import { useDesk } from '../../hooks/useDesk'
import { CHOICE_KEY_INDEX } from '../../domain/choiceKeys'
import { runKey } from '../../lib/keyGuards'

// ── 実力診断 — the placement test ────────────────────────────────
// Twelve deterministic questions laddering N5→N1, one at a time,
// through the exam screens' own QuestionRenderer (mcq-text hits
// McqBlock, which brings the roving-tabindex radiogroup for free).
// Synchronous by design: the paper builds in milliseconds server-side
// (study/placement.py), so there is no 202 polling here and must never
// be — see that module's header for why the exam pipeline is the wrong
// tool for a first-run experience.
//
// Self-contained on purpose: fetches its own paper, reports the score
// result through onResult(result), renders no follow-up of its own —
// the onboarding flow offers the boarding-station override, Settings
// offers "apply?", and both reuse this same component.
//
// Props:
//   session    — Supabase session for the API calls
//   onResult   — ({recommendedLevel, correct, total, perLevel}) => void
//   onCancel   — optional; renders a quiet leave link when present
export default function PlacementTest({ session, onResult, onCancel }) {
  const { t } = useLang()
  const [phase, setPhase] = useState('loading') // loading | question | scoring | error
  const [paper, setPaper] = useState(null)      // {seed, questions}
  const [index, setIndex] = useState(0)
  const answersRef = useRef({})
  const [selected, setSelected] = useState(null)
  const desk = useDesk()

  // Initial phase is already 'loading', so the effect only reports the
  // fetch's outcome — no synchronous setState on mount.
  useEffect(() => {
    let cancelled = false
    apiJsonWithTimeout('/api/onboarding/placement', session, { method: 'POST', timeoutMs: 10000 })
      .then(body => { if (!cancelled) { setPaper(body); setPhase('question') } })
      .catch(() => { if (!cancelled) setPhase('error') })
    return () => { cancelled = true }
  }, [session])

  function submit(answers) {
    setPhase('scoring')
    apiJsonWithTimeout('/api/onboarding/placement/score', session, {
      method: 'POST',
      timeoutMs: 10000,
      body: JSON.stringify({ seed: paper.seed, answers }),
    })
      .then(onResult)
      .catch(() => setPhase('error'))
  }

  if (phase === 'loading' || phase === 'scoring') return <Loading />
  if (phase === 'error') {
    return (
      <div className="onb-test__error">
        <p>{t.onbTestError}</p>
        {onCancel && (
          <button type="button" className="onb-link" onClick={onCancel}>{t.back}</button>
        )}
      </div>
    )
  }

  const questions = paper.questions
  const question = questions[index]
  const isLast = index === questions.length - 1
  // The early exit: past the N5 block, a learner deep over their head
  // can stop and be placed on what they've answered — unanswered
  // questions score as wrong server-side, which is exactly what "it
  // got too hard here" should mean.
  const pastFirstSection = question.sectionId !== questions[0].sectionId

  function advance() {
    playUi('click')
    if (isLast) {
      submit(answersRef.current)
    } else {
      setIndex(i => i + 1)
      setSelected(answersRef.current[questions[index + 1].id] ?? null)
    }
  }
  function pick(id) {
    answersRef.current[question.id] = id
    setSelected(id)
  }

  return (
    <div className="onb-test">
      <div className="onb-test__meta">
        {/* The section id IS the level — one section per level is the
            paper's whole structure (study/placement.py). */}
        <span className="onb-test__level" lang="ja">{question.sectionId}</span>
        <span className="onb-test__progress">{t.onbTestProgress(index + 1, questions.length)}</span>
      </div>

      <div className="onb-test__instructions">{t.onbTestKind[question.kind] ?? ''}</div>

      <QuestionRenderer
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
          disabled={selected == null}
          onClick={advance}
          aria-keyshortcuts={desk ? 'Enter' : undefined}
        >
          {isLast ? t.onbTestFinish : t.onbContinue}
          {desk && <kbd className="desk-kbd" aria-hidden="true">{t.keyEnter}</kbd>}
        </button>
      </div>

      <div className="onb-test__escape">
        {pastFirstSection && (
          <button type="button" className="onb-link" onClick={() => submit(answersRef.current)}>
            {t.onbTestStop}
          </button>
        )}
        {onCancel && (
          <button type="button" className="onb-link" onClick={onCancel}>{t.cancel}</button>
        )}
      </div>
    </div>
  )
}

// ── 机 — the retake's keys (plan 123) ──────────────────────────────
// The retake in Settings answers keys the way the mock exam on the same
// questions does -- a digit picks, Enter goes on -- where it was twelve
// questions by pointer while the rows printed digits that did nothing.
// Enter from a choice the pointer or the arrows left focused goes on
// too; Stop and Cancel keep their own. Rendered on the desk only.
function PlacementKeys({ choices, selected, onPick, onAdvance }) {
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
