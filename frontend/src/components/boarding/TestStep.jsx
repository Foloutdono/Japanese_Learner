import { useState } from 'react'
import { useLang } from '../../LangContext'
import { useDesk } from '../../hooks/useDesk'
import QuestionRenderer from '../../exam/QuestionRenderer'
import { Loading } from '../ui/Loading'
import { BoardLink, BoardQuestion, Continue } from './BoardFrame'
import { PickMark } from './BoardOption'
import { ClimbRungs } from '../onboarding/PlacementTest'
import { useClimb } from '../onboarding/useClimb'
import { LEVEL_HOW } from '../../domain/boarding'

// ── 4 · the level, asked first (plan 224, the owner's B) ─────────
// A reader of both scripts used to be handed the level line and asked
// to name their own stop, and the stops behind it were marked known on
// that word alone: a learner who thought they were N3 started with
// 1,797 cards they had never been asked. Now the question comes first
// -- choose it, or let the test find it -- with the same weight on
// both, as two roads out of the question's hub: down the phone, a
// junction of one rung (WhyStep's), on the desk two roads either side
// of the hub (WhyRoads').

// The phone's junction, on the stage's 358px canvas (brd-map): the hub
// at the top, the trunk down to one rung, a way at either end of it.
const RUNG = 150
const SIDES = [85, 273]
const HEIGHT = 330
// The desk's two roads, straight back and straight on (WhyRoads' ROADS).
const ROADS = [{ x: 24.2, y: 50, side: 'start' }, { x: 75.8, y: 50, side: 'under' }]

function HowRing({ how }) {
  // "I know it": the stop the learner will name, not yet named. "Find it
  // for me": the climb, a step a level.
  return how === 'pick'
    ? <span className="brd-how__code" aria-hidden="true">N?</span>
    : (
      <svg className="desk-brd__pic" viewBox="0 0 48 48" aria-hidden="true" fill="currentColor">
        <path d="M6 42h36V10h-9v8h-9v8h-9v8H6Z" />
      </svg>
    )
}

export function LevelHowStep({ value, onChange, onContinue, no = null }) {
  const { t } = useLang()
  const desk = useDesk()
  const picked = LEVEL_HOW.indexOf(value)
  return (
    <>
      <div className="brd__body">
        <BoardQuestion hint={desk ? t.brdHowHint : null}>{t.brdHowQ}</BoardQuestion>
        <div className="brd__stage">
          {desk ? (
            <div className="desk-brd__roads">
              <svg className="desk-brd__map" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                {ROADS.map((road, i) => (
                  <line key={i} className={`desk-brd__road${i === picked ? ' desk-brd__road--on' : ''}`} x1="50" y1="50" x2={road.x} y2={road.y} />
                ))}
              </svg>
              <span className="desk-brd__hub" aria-hidden="true">{no}</span>
              {LEVEL_HOW.map((how, i) => {
                const digit = String(i + 1)
                return (
                  <button
                    key={how}
                    type="button"
                    className={`desk-brd__way desk-brd__way--${ROADS[i].side}`}
                    // Plain numbers, placed by the sheet (see ROADS).
                    style={{ '--x': ROADS[i].x, '--y': ROADS[i].y }}
                    aria-pressed={value === how}
                    aria-keyshortcuts={digit}
                    onClick={() => onChange(how)}
                    data-how={how}
                  >
                    <span className="desk-brd__ring"><HowRing how={how} /></span>
                    <span className="desk-brd__way-name">
                      <PickMark digit={digit} />
                      {t.brdHow[how]}
                    </span>
                  </button>
                )
              })}
            </div>
          ) : (
            <div className="brd-map brd-junction" style={{ '--h': HEIGHT }}>
              <svg className="brd-map__lines" viewBox={`0 0 358 ${HEIGHT}`} preserveAspectRatio="none" aria-hidden="true">
                <path className="brd-road" d={`M179 22V${RUNG}`} />
                <path className="brd-road" d={`M${SIDES[0]} ${RUNG}H${SIDES[1]}`} />
                {picked >= 0 && <path className="brd-road brd-road--on" d={`M179 44V${RUNG}H${SIDES[picked]}`} />}
              </svg>
              <span className="brd-hub brd-map__at" style={{ '--x': 179, '--y': 22 }} aria-hidden="true">{no}</span>
              {LEVEL_HOW.map((how, i) => (
                <button
                  key={how}
                  type="button"
                  className="brd-way"
                  // Plain numbers, placed by the sheet: the ring's centre.
                  style={{ '--x': SIDES[i], '--y': RUNG }}
                  aria-pressed={value === how}
                  onClick={() => onChange(how)}
                  data-how={how}
                >
                  <span className="brd-way__ring"><HowRing how={how} /></span>
                  <span className="brd-way__name">{t.brdHow[how]}</span>
                  <span className="brd-how__desc">{t.brdHowDesc[how]}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
      <div className="brd__foot">
        <Continue keys label={t.onbContinue} onClick={onContinue} disabled={!value} data-action="continue" />
      </div>
    </>
  )
}

// ── 4 · the test, in the boarding's car (plan 224) ───────────────
// The climb (study/placement.walk): N5 first, a level up each time one
// is cleared, the first not cleared where the learner boards. The
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
