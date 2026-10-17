import { useState } from 'react'
import { useLang } from '../../LangContext'
import { useDesk } from '../../hooks/useDesk'
import QuestionRenderer from '../../exam/QuestionRenderer'
import { Loading } from '../ui/Loading'
import { BoardLink, BoardQuestion, Continue } from './BoardFrame'
import { ClimbRungs } from '../onboarding/PlacementTest'
import { useClimb } from '../onboarding/useClimb'

// ── 4 · the test, in the boarding's car (plan 224) ───────────────
// The climb (study/placement.walk): N5 first, a level up each time one
// is cleared, the first not cleared where the learner boards. Reached
// from the level's line, its quiet way (plan 246), and back to it. The
// question in the car's stage, the levels over it (ClimbRungs), the
// two ways out under it: "I know my level" to the line with nothing
// chosen, "Too hard? Stop here" to the line with the level being asked
// chosen. On the desk a digit picks a choice and Enter goes on, as on
// every question here (useBoardKeys reads the choices' own keys).
// `still`: the car pulling out once the test is done or left -- drawn
// for the pull with no climb of its own, which would start a new test
// only to be dropped.
export function TestStep({ still = false, ...props }) {
  const { t } = useLang()
  if (still) {
    return (
      <>
        <div className="brd__body"><BoardQuestion>{t.brdTestQ}</BoardQuestion></div>
        <div className="brd__foot" />
      </>
    )
  }
  return <ClimbingTest {...props} />
}

function ClimbingTest({ session, onResult, onPick }) {
  const { t } = useLang()
  const desk = useDesk()
  const climb = useClimb(session, onResult)
  const [picked, setPicked] = useState({ id: null, choice: null })
  const question = climb.question
  const waiting = climb.phase === 'waiting'
  const asking = question && (climb.phase === 'question' || waiting)
  const selected = question && picked.id === question.id ? picked.choice : null

  function pick(id) {
    if (!waiting) setPicked({ id: question.id, choice: id })
  }
  function advance() {
    if (selected != null && !waiting) climb.answer(selected)
  }

  return (
    <>
      <div className="brd__body">
        <BoardQuestion>{t.brdTestQ}</BoardQuestion>
        <div className="brd__stage brd-test" aria-busy={waiting}>
          {climb.phase === 'loading' && <Loading />}
          {climb.phase === 'error' && (
            <p className="brd__error" role="alert">
              {t.onbTestError}{' '}
              <BoardLink onClick={climb.retry} data-action="climb-retry">{t.retry}</BoardLink>
            </p>
          )}
          {asking && (
            <>
              <ClimbRungs level={climb.level} perLevel={climb.perLevel} />
              <p className="brd-test__kind">{t.onbTestKind[question.kind] ?? ''}</p>
              <QuestionRenderer key={question.id} question={question} selected={selected} onSelect={pick} keys={desk} />
            </>
          )}
        </div>
      </div>
      <div className="brd__foot">
        <div className="brd-test__ways">
          <BoardLink onClick={onPick} data-action="climb-pick">{t.brdTestPick}</BoardLink>
          {asking && <BoardLink onClick={climb.stop} disabled={waiting} data-action="climb-stop">{t.onbTestStop}</BoardLink>}
        </div>
        <Continue keys label={t.onbContinue} onClick={advance} disabled={selected == null || waiting} data-action="continue" />
      </div>
    </>
  )
}
