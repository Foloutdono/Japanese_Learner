import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLang } from '../LangContext'
import { apiJson } from '../lib/api'
import { track } from '../lib/track'
import { stopwatch } from '../lib/dwell'
import { playClick } from '../lib/audio'
import { useDesk } from '../hooks/useDesk'
import { useBoardKeys } from '../hooks/useBoardKeys'
import { useBoxWidth } from '../hooks/useBoxWidth'
import { useProfileSummary } from '../stores/profileSummary'
import { BoardHead, BoardLink } from '../components/boarding/BoardFrame'
import { BoardBack } from '../components/boarding/boardBack'
import { DeskStrip } from '../components/boarding/DeskStrip'
import { INTRO_STEPS } from '../domain/nyumon'
import { kanaFigures, linesOrAll, planFigures } from '../domain/boarding'
import ScriptsStep from '../components/intro/ScriptsStep'
import SoundsStep from '../components/intro/SoundsStep'
import TableStep from '../components/intro/TableStep'
import PairsStep from '../components/intro/PairsStep'
import SentenceStep from '../components/intro/SentenceStep'
import RouteStep from '../components/intro/RouteStep'

// ── 入門 — the introduction before the first card (plan 170) ────
// A learner who answered « Pas encore » to the boarding's kana question
// was handed, straight after the 改札, a kanji card and a timed sentence
// they could not read one sign of. They are now handed the MAP first:
// six screens -- the three scripts, the five vowels, the table, the
// katakana, how a sentence works, the ride ahead -- drawn on the owner's
// canvas "Tsuji — 入門, day one", then the card ride (試乗) as before.
// Nobody else sees it: a reader of one script or both goes straight to
// the cards (App.jsx's index route).
//
// It stands in the boarding's own frame, not a copy of it: the head's ‹
// and track on a phone, the question over its drawing, the gate at the
// foot with the quiet way out over it, the train pulling between screens;
// on the desk the question at the corner, the strip of six named stops
// and the floor, Enter and the digits (useBoardKeys). Nothing here is a
// review and nothing is written: the way on and the way out both enter
// the card ride, whose own end stamps the lesson (ADR 0017). The trail
// records every screen as a ride_step (`intro-<step>`), a skip as a
// ride_step to 'cards' with dir 'skip'.
//
// `covered` is App's "the 改札 cutscene is still playing": the stopwatch
// waits for it. `dryRun` is the workbench's (/dev/ride): `onNext` instead
// of the route, and no request.
export const INTRO_NEXT = '/ride/cards'
const PULL_MS = 260
const DESK_PULL_MS = 820
const REDUCED = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false

const STEP_COMPONENTS = {
  scripts: ScriptsStep,
  sounds: SoundsStep,
  table: TableStep,
  katakana: PairsStep,
  sentence: SentenceStep,
  route: RouteStep,
}

export default function RideIntro({ session, covered = false, dryRun = false, onNext = null, volumes: given = null }) {
  const navigate = useNavigate()
  const { t, lang } = useLang()
  const desk = useDesk()
  const summary = useProfileSummary()
  const [index, setIndex] = useState(0)
  const [leaving, setLeaving] = useState(null)
  const [volumes, setVolumes] = useState(given)
  const frameRef = useRef(null)
  const watches = useRef(null)
  const done = useRef(false)
  const [stripRef, stripW] = useBoxWidth(desk)
  const step = INTRO_STEPS[index]

  useBoardKeys(frameRef)

  useEffect(() => {
    document.title = `${t.nyuDocumentTitle} — ${t.appTitle}`
  }, [t])

  // Engaged time, as the rides keep it (lib/dwell.js), started once the
  // cutscene has lifted.
  useEffect(() => {
    if (covered || watches.current) return undefined
    watches.current = { step: stopwatch() }
    const w = watches.current
    return () => { w.step.stop(); watches.current = null }
  }, [covered])

  // The office's volumes price the ride on the last screen; without them
  // it says "soon" and draws its stops undated.
  useEffect(() => {
    if (given || dryRun) return undefined
    let live = true
    apiJson('/api/onboarding/volumes', session)
      .then(v => { if (live) setVolumes(v) })
      .catch(() => {})
    return () => { live = false }
  }, [session, given, dryRun])

  // The pull: the leaving car is dropped once it has left.
  useEffect(() => {
    if (!leaving) return undefined
    const id = setTimeout(() => setLeaving(null), desk ? DESK_PULL_MS : PULL_MS)
    return () => clearTimeout(id)
  }, [leaving, desk])

  // Focus lands on the new screen's question, as in the boarding.
  useEffect(() => {
    const q = frameRef.current?.querySelector('.brd__car:not(.brd__car--out) .brd__q')
    q?.focus({ preventScroll: true })
  }, [index])

  const mark = useCallback((from, to, dir) => {
    track('ride_step', { step: `intro-${from}`, to, dir, ms: watches.current?.step.lap() ?? 0 })
  }, [])

  function leave(dir) {
    if (done.current) return
    done.current = true
    mark(step, 'cards', dir)
    if (onNext) onNext()
    else if (!dryRun) navigate(INTRO_NEXT, { replace: true })
  }

  function goTo(next, dir) {
    if (next === index || next < 0 || next >= INTRO_STEPS.length) return
    mark(step, `intro-${INTRO_STEPS[next]}`, dir)
    if (!REDUCED) setLeaving({ index, dir })
    setIndex(next)
  }
  const forward = () => (index === INTRO_STEPS.length - 1 ? leave('fwd') : goTo(index + 1, 'fwd'))
  const back = index > 0 ? () => goTo(index - 1, 'back') : null
  const skip = () => leave('skip')

  // The ride on the last screen: the kana and N5 dated at the learner's
  // own pace and lines, from the boarding's arithmetic.
  const route = useMemo(() => {
    const perDay = summary?.dailyNewTarget ?? 10
    if (!volumes) return { perDay }
    const now = new Date()
    const kana = kanaFigures(volumes, summary?.kanaKnown ?? 'none', perDay, now)
    const n5 = planFigures(volumes, 'N5', 'N5', perDay, summary?.kanaKnown ?? 'none', now, linesOrAll(summary?.lines))
    const day = new Intl.DateTimeFormat(lang, { day: 'numeric', month: 'short' })
    const full = new Intl.DateTimeFormat(lang, { day: 'numeric', month: 'short', year: 'numeric' })
    return { perDay, kana: kana.kana > 0 ? day.format(kana.date) : null, n5: full.format(n5.date) }
  }, [volumes, summary?.dailyNewTarget, summary?.kanaKnown, summary?.lines, lang])

  // The phone's way out stands over the gate; the desk's at the corner.
  const skipLink = desk ? null : <BoardLink onClick={skip} data-action="skip">{t.nyuSkip}</BoardLink>

  function renderStep(i) {
    const key = INTRO_STEPS[i]
    const Step = STEP_COMPONENTS[key]
    return <Step onContinue={forward} skip={skipLink} route={route} />
  }

  const deskStops = INTRO_STEPS.map((key, i) => ({
    key,
    label: t.nyuStop[key],
    value: null,
    state: i < index ? 'done' : i === index ? 'now' : 'next',
    onOpen: i < index ? () => goTo(i, 'back') : undefined,
  }))

  return (
    <main
      className={desk ? 'brd desk-brd nyu' : 'brd nyu'}
      id="main-content"
      data-step={step}
      ref={frameRef}
      // A plain number, read as pixels by the sheet: the strip's measure.
      style={desk && stripW ? { '--desk-strip-w': stripW } : undefined}
    >
      {!desk && <BoardHead index={index + 1} total={INTRO_STEPS.length} onBack={back} />}
      {desk && (
        <button type="button" className="brd__link nyu-skip" onClick={() => { playClick(); skip() }} data-action="skip">{t.nyuSkip}</button>
      )}
      <BoardBack.Provider value={desk ? back : null}>
        <div className="brd__cars">
          {leaving && (
            <div key={`out:${leaving.index}`} className="brd__car brd__car--out" data-dir={leaving.dir} data-intro={INTRO_STEPS[leaving.index]} aria-hidden="true" inert>
              {renderStep(leaving.index)}
            </div>
          )}
          <div key={step} className={`brd__car${leaving ? ' brd__car--in' : ''}`} data-dir={leaving?.dir ?? 'none'} data-intro={step}>
            {renderStep(index)}
          </div>
        </div>
      </BoardBack.Provider>
      {desk && <DeskStrip stops={deskStops} stripRef={stripRef} label={t.nyuStripAria} />}
    </main>
  )
}
