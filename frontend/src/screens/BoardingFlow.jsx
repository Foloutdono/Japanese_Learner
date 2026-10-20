import { startTransition, useEffect, useRef, useState } from 'react'
import { useLang } from '../LangContext'
import { ApiError, apiJson, apiJsonWithTimeout } from '../lib/api'
import { canNudge, nudgePermission, requestNudgePermission } from '../lib/platform'
import { track } from '../lib/track'
import { stopwatch } from '../lib/dwell'
import { refreshSummary } from '../stores/profileSummary'
import { refreshCredits } from '../stores/credits'
import { playBoardFlap, playToggle, playUi } from '../lib/audio'
import { dailyTrain, saveCalendar } from '../lib/calendarFile'
import { DEPART_TIMES } from '../components/onboarding/departures'
import {
  LINES, RECOMMENDED_RHYTHM, RHYTHMS, bucketFor, firstDeparture, goalStops, itemsForRhythm, kanaFigures,
  levelAnswers, levelForKana, levelStop, minutesToTime, planFigures, timeToMinutes,
} from '../domain/boarding'
import { cleanCardName } from '../domain/passCard'
import { dateFormat, paceLabel, stopParts } from '../components/settings/contract'
import { BoardHead } from '../components/boarding/BoardFrame'
import { useBoardKeys } from '../hooks/useBoardKeys'
import { useErrorStep } from '../hooks/useErrorStep'
import { BOARDING_STEPS } from '../domain/flowSteps'
import { useDesk } from '../hooks/useDesk'
import { useBoxWidth } from '../hooks/useBoxWidth'
import { KanaStep, KanaReveal } from '../components/boarding/KanaStep'
import { LevelStep } from '../components/boarding/LevelStep'
import { TestStep } from '../components/boarding/TestStep'
import CardStep from '../components/boarding/CardStep'
import { AccountSheet, GoalSheet, HourSheet, LinesSheet, NameSheet, RhythmSheet } from '../components/boarding/CardSheets'
import { DeskStrip } from '../components/boarding/DeskStrip'
import { FeedbackSheet } from '../components/feedback/FeedbackSheet'
import { failureOf } from '../lib/feedback'
import { BoardBack } from '../components/boarding/boardBack'

// ── 乗車 — the boarding (plan 075; the card is the form, plan 247) ──
// The owner's pick C of the boarding's canvas ("Tsuji — the boarding,
// audit and new directions"): the boarding asks only what it cannot
// guess, then hands the learner their card already filled in, every
// printed field a door to a sheet. Welcome is step zero
// (components/boarding/Welcome.jsx, mounted by App.jsx); then
//
//   the kana check → the reveal (a reader of one script or none)
//                  → the level (a reader of both; the test is the line's
//                    quiet way, and its verdict lands back on the line)
//   → the card (CardStep: the goal, the rhythm, the hour, the lines, the
//     name and the account, each a sheet) → the 改札.
//
// What left the questions in plan 247: the name (a field on the card,
// optional, a first name rather than the public username), why (no
// longer asked), how the level is found (the test is the line's quiet
// way), the goal, the lines, the rhythm and the hour (fields, filled
// with what most keep), the nudge (the hour's sheet on a native shell),
// the plan and the pass (the card is both), and the account (one line
// under the card until it is kept).
//
// The boarding runs on a guest pass -- a real Supabase user with no
// credentials on it (lib/guest.js) -- and the card's account sheet
// offers to keep it on the very row the learner is filling in: Google,
// or a link sent to an address. Nothing is migrated because nothing
// moved; a learner who says « Plus tard » rides on as they were.
//
// `onExit` is the way back OUT of the first question: back on the kana
// has nowhere to go inside the flow, so it leaves for Welcome, where the
// sign-in is. `onSignIn` is the same door, named (the Welcome's), and
// the card's line offers it to a session that holds an address: a new
// pass for it, which may not be the one the learner meant.
//
// The track at the head is the progress bar -- a stop per question, the
// card the last; the card is an arrival screen and stands with no head:
// its origin is the door back to the question that set it, and Back (a
// phone's, the browser's) keeps every answer. Nothing persists until
// the single POST /api/onboarding/complete on « Émettre ma carte ». A
// mid-flow refresh is a clean restart. The TicketGate finale is
// rendered by App, not here: this component unmounts the moment
// onComplete flips the gate state, and a cutscene rendered by the thing
// it unmounts would pop mid-wipe.
//
// Between screens the train pulls: the leaving screen slides left as
// the next arrives from the right, 260 ms ease-out, and back runs it in
// reverse. The leaving screen stays mounted for the pull (the `--out`
// car, inert) and is dropped after it. Under reduced motion no car
// moves and only the rest state is drawn.
//
// `dryRun` is the dev workbench's hook (/dev/onboarding): the whole
// flow, the real volumes, and no write.
//
// 音 — the boarding speaks the app's own sound vocabulary: the frame
// carries the presses every screen shares (BoardFrame: the gate's
// departure, the click of ‹ and of the quiet links); this file the
// answers, each where it is set -- a pick the wood pick of every list in
// the app, a line switched the switch's two step, the hour the departure
// board's flaps; then the gate's chime into the station (App.jsx's
// TicketGate).

// ── The stash — surviving an OAuth redirect ──────────────────────
// Keeping the card with Google on the WEB navigates the page away and
// comes back as a fresh load, which would otherwise mean answering
// everything again for the crime of choosing the fast way to keep it.
// So the answers are written down at exactly the moment the redirect is
// about to happen, and picked back up on the next mount -- the card, its
// account sheet open again if the round trip came back refused.
//
// sessionStorage, not local: the stash belongs to this tab and this
// attempt. Cleared the instant it is read, and again when the contract
// is signed, so a later boarding can never resume someone else's.
// Deliberately NOT a general autosave -- a mid-flow refresh is still a
// clean restart.
//
// And an hour at most (plan 247): a round trip that never came back to
// the boarding -- Google's other account signed in instead, the tab
// left -- must not seat a later boarding in this tab on a card it did
// not fill in. A stash written before the stamp is read as fresh.
const STASH_KEY = 'jp-boarding-stash'
const STASH_TTL_MS = 60 * 60 * 1000

function stash(state) {
  try { sessionStorage.setItem(STASH_KEY, JSON.stringify({ ...state, at: Date.now() })) } catch { /* private mode */ }
}

function takeStash() {
  try {
    const raw = sessionStorage.getItem(STASH_KEY)
    sessionStorage.removeItem(STASH_KEY)
    const kept = raw ? JSON.parse(raw) : null
    return kept && (kept.at == null || Date.now() - kept.at < STASH_TTL_MS) ? kept : null
  } catch {
    return null
  }
}

function clearStash() {
  try { sessionStorage.removeItem(STASH_KEY) } catch { /* private mode */ }
}

const PULL_MS = 260
// 机 (plan 155): the desk's pull is a short one -- a rung sideways and a
// fade, not the paper's whole width -- and the arriving car's answers
// follow it in a beat apart (the 机 section of index.css, "the pull on
// the desk"). The leaving car is kept until all of that has landed.
const DESK_PULL_MS = 820
const REDUCED = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
const DEFAULT_TIME = DEPART_TIMES.am

// The track's stops: the kana, a reader's level, the card -- the reveal
// is the kana's stop's second half and the test the level's own, never
// stops of their own. Whether the level is asked depends on the kana's
// answer, so the count reads the answers so far.
function trackStops(answers) {
  return ['kana', ...(answers.kana === 'both' ? ['level'] : []), 'card']
}

const STOP_OF = { reveal: 'kana', test: 'level' }
const stopOf = step => STOP_OF[step] ?? step

// What the card's fields were before a sheet changed them: what
// boarding_done reports, so "most keep the defaults" can be read.
const UNEDITED = { goal: false, rhythm: false, hour: false, lines: false }

export default function BoardingFlow({
  session, onComplete, onExit = null, onSignIn = null, guest = false, dryRun = false,
}) {
  const { t, lang } = useLang()
  const desk = useDesk()

  // Read once, in the initialiser rather than an effect: the flow must
  // never paint the first question before resuming the step it left from.
  const [resumed] = useState(takeStash)

  const [answers, setAnswers] = useState({
    kana: null,
    levelChoice: null,   // 'novice' | 'N5'..'N1' on the level list
    jlpt: null,          // the level the office stores
    placed: null,        // the test's verdict, when it was taken
    goal: null,
    lines: LINES,        // what to learn: any of vocab / kanji / grammar
    rhythm: RECOMMENDED_RHYTHM,
    minute: timeToMinutes(DEFAULT_TIME),
    notifications: false,
    cardName: '',
    ...(resumed?.answers ?? {}),
  })
  const [step, setStep] = useState(() => (BOARDING_STEPS.includes(resumed?.step) ? resumed.step : 'kana'))
  useErrorStep(step)
  // The card's open sheet. A Google round trip that came back refused
  // reopens the account's, where the refusal is said; one that worked
  // comes back to the card, kept.
  const [sheet, setSheet] = useState(() => (resumed?.sheet === 'account' && guest ? 'account' : null))
  const [edited, setEdited] = useState(() => ({ ...UNEDITED, ...(resumed?.edited ?? {}) }))
  // How the card was kept here: 'google' (the round trip, or the native
  // sheet), 'link' (an address sent its link). null is not kept here.
  const [keptBy, setKeptBy] = useState(() => (!guest && resumed?.keeping === 'google' ? 'google' : null))
  const [linkSent, setLinkSent] = useState(null)
  const [history, setHistory] = useState(() => resumed?.history ?? [])
  const [leaving, setLeaving] = useState(null)   // { step, dir } during a pull
  const [volumes, setVolumes] = useState(null)
  const [busy, setBusy] = useState(false)
  // null | 'network' | 'busy' | 'refused' -- which of the three the card
  // says, and the status a refusal came with, for the report under it.
  const [saveError, setSaveError] = useState(null)
  const [refusedWith, setRefusedWith] = useState(0)
  // « Signaler ce problème » under a refusal: the feedback sheet, here
  // rather than App's FeedbackHost, which the boarding stands in for.
  const [reporting, setReporting] = useState(false)
  // On a native shell, the OS's own answer when it will not ask again:
  // the reminder's switch says why it stays off (plan 247).
  const [nudgeDenied, setNudgeDenied] = useState(false)
  const [now] = useState(() => new Date())
  const frameRef = useRef(null)
  // 辻 (plan 163): the strip at the floor's left end, measured so the
  // floor gives way before it (--desk-strip-w).
  const [stripRef, stripW] = useBoxWidth(desk)
  // Two stopwatches counting only time the tab was actually looked at
  // (lib/dwell.js): one lapped at every question, one for the whole
  // line. Built in an effect, not in render -- each attaches a listener,
  // and StrictMode would double it.
  const watches = useRef(null)

  const set = patch => setAnswers(a => ({ ...a, ...patch }))
  // 机 (plan 122): Enter goes on from anywhere in the live car.
  useBoardKeys(frameRef)

  useEffect(() => {
    document.title = `${t.brdDocumentTitle} — ${t.appTitle}`
  }, [t])

  useEffect(() => {
    watches.current = { total: stopwatch(), step: stopwatch() }
    const w = watches.current
    return () => { w.total.stop(); w.step.stop(); watches.current = null }
  }, [])

  // The volumes price the level list and the card; the canvas's round
  // figures stand in until they arrive, and a failed fetch leaves the
  // card's date to the office (the POST then carries no date).
  useEffect(() => {
    let live = true
    apiJson('/api/onboarding/volumes', session)
      .then(v => { if (live) setVolumes(v) })
      .catch(() => {})
    return () => { live = false }
  }, [session])

  // The pull: the leaving car is dropped once it has left.
  useEffect(() => {
    if (!leaving) return
    const id = setTimeout(() => setLeaving(null), desk ? DESK_PULL_MS : PULL_MS)
    return () => clearTimeout(id)
  }, [leaving, desk])

  // Focus lands on the new screen's question.
  useEffect(() => {
    const q = frameRef.current?.querySelector('.brd__car:not(.brd__car--out) .brd__q')
    q?.focus({ preventScroll: true })
  }, [step])

  // 足跡 — every transition in the boarding runs through these, so
  // instrumenting them is the whole of it. There is no "abandoned"
  // event and there does not need to be: it is a boarding_step with no
  // boarding_done after it. (`track` here is the analytics seam,
  // lib/track.js; `trackStops` above is the railway kind.)
  function mark(from, to, dir) {
    track('boarding_step', {
      step: from, to, dir,
      // How long `from` actually held them, then reset for the next
      // question.
      ms: watches.current?.step.lap() ?? 0,
      index: trackStops(answers).indexOf(stopOf(from)) + 1,
    })
  }

  // 速度: a move between screens is a transition. Rendered inside the
  // tap, the next screen held the tap's paint for 250-370 ms of a cheap
  // phone's CPU (608 ms on a learner's, 2026-10-18, the trail's INP);
  // as a transition the tap paints its press at once and the screen
  // follows a frame later, in a render that can yield. Every move
  // below is one.
  function go(next) {
    mark(step, next, 'fwd')
    startTransition(() => {
      setHistory(h => [...h, step])
      if (!REDUCED) setLeaving({ step, dir: 'fwd' })
      setStep(next)
    })
  }

  function back() {
    if (history.length === 0) return
    const prev = history[history.length - 1]
    mark(step, prev, 'back')
    startTransition(() => {
      setHistory(h => h.slice(0, -1))
      if (!REDUCED) setLeaving({ step, dir: 'back' })
      setSheet(null)
      setStep(prev)
    })
  }

  // 机 (plan 140): a stop already passed is a door straight back to its
  // question -- Back pressed as many times as it takes, in one pull, every
  // answer kept. The strip's stops on the desk, and the card's origin.
  function jumpTo(target) {
    const at = history.lastIndexOf(target)
    if (at < 0) return
    mark(step, target, 'back')
    startTransition(() => {
      setHistory(h => h.slice(0, at))
      if (!REDUCED) setLeaving({ step, dir: 'back' })
      setSheet(null)
      setStep(target)
    })
  }

  // The test hands back to the line it was reached from: the test is not
  // a question Back returns to, so it leaves the history as it goes.
  function returnToLevel() {
    mark(step, 'level', 'fwd')
    startTransition(() => {
      setHistory(h => (h[h.length - 1] === 'level' ? h.slice(0, -1) : h))
      if (!REDUCED) setLeaving({ step, dir: 'back' })
      setStep('level')
    })
  }

  // ── The browser's Back (plan 123) ────────────────────────────
  // The flow changes screens through state alone, so the browser's Back
  // -- Alt+←, a mouse's side button, a phone's back gesture -- would
  // leave Tsuji from the card, and coming back would be a fresh load
  // with the answers gone. One guard entry stands in the browser's
  // history exactly while the flow has a question behind it: Back pops
  // the guard and steps back one question, and the guard is put back
  // while more remain. It is taken out again (history.back(), its pop
  // ignored) the moment none do, so by the time the router mounts no
  // dead entry is left. From the first question Back leaves, as it
  // always has.
  //
  // A sheet open over the card is shut by Back first, as a phone's Back
  // shuts any sheet, and the card stays (plan 247): the pop took the
  // guard, so it goes straight back in.
  const guard = useRef(false)
  const ignorePop = useRef(false)
  const backRef = useRef(back)
  const overRef = useRef(false)
  useEffect(() => { backRef.current = back; overRef.current = sheet != null || reporting })
  useEffect(() => {
    function onPop() {
      if (ignorePop.current) { ignorePop.current = false; return }
      if (!guard.current) return
      if (overRef.current) {
        setSheet(null)
        setReporting(false)
        try { window.history.pushState({ brd: true }, '') } catch { guard.current = false }
        return
      }
      guard.current = false
      backRef.current()
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])
  const depth = history.length
  useEffect(() => {
    try {
      if (depth > 0 && !guard.current) {
        window.history.pushState({ brd: true }, '')
        guard.current = true
      } else if (depth === 0 && guard.current) {
        guard.current = false
        ignorePop.current = true
        window.history.back()
      }
    } catch { /* a browser refusing the history API: Back leaves, as before */ }
  }, [depth])

  // ── The answers ──────────────────────────────────────────────
  // The kana decides the level: a reader of both scripts is asked it on
  // the line; anyone else is a novice, whose card takes the nearest stop
  // ahead (levelAnswers) -- the kana's own stop, still ahead of them, is
  // on the goal's sheet as a destination they can name.
  // A goal the learner picked on the card rides on through a return to
  // the question that set the level, while it is still a stop ahead of
  // the answer given there (plan 247); a goal never picked is the new
  // level's next stop, as the card was first filled in.
  function keepingGoal(next, kana) {
    const ahead = goalStops(next.levelChoice, kana)
    return edited.goal && ahead.includes(answers.goal) ? { ...next, goal: answers.goal } : next
  }

  function answerKana(kana) {
    // A pick that goes on by itself: it sounds the gate it stands for.
    playUi('click-screen-selection')
    const choice = levelForKana(kana)
    if (choice) {
      set({ kana, ...keepingGoal(levelAnswers(choice, kana), kana) })
      go('reveal')
    } else {
      set({ kana })
      go('level')
    }
  }

  // The verdict: the line with the stop the answers reached chosen,
  // still the learner's to change.
  function placedBy(result) {
    set({ placed: result, levelChoice: result.recommendedLevel })
    returnToLevel()
  }

  function skipTest() {
    set({ placed: null })
    returnToLevel()
  }

  function continueLevel() {
    set(keepingGoal(levelAnswers(answers.levelChoice, answers.kana), answers.kana))
    go('card')
  }

  // ── The card's sheets ────────────────────────────────────────
  const close = () => setSheet(null)
  const edit = field => setEdited(e => (e[field] ? e : { ...e, [field]: true }))
  // The origin goes back to the question that set it: a reader's level,
  // or the kana.
  function openDoor(page) {
    if (page === 'level') { jumpTo(answers.kana === 'both' ? 'level' : 'kana'); return }
    setSheet({ destination: 'goal', service: 'rhythm', hour: 'hour', lines: 'lines' }[page] ?? null)
  }
  function pickGoal(goal) {
    if (goal !== answers.goal) { set({ goal }); edit('goal') }
    close()
  }
  function pickRhythm(rhythm) {
    if (rhythm !== answers.rhythm) { set({ rhythm }); edit('rhythm') }
    close()
  }
  // The board turns: a run of its flaps each half hour the hour moves.
  function turnHour(minute) {
    if (minute === answers.minute) return
    playBoardFlap()
    set({ minute })
    edit('hour')
  }
  function pickHour(minute) {
    turnHour(minute)
    close()
  }
  function switchLines(lines) {
    // A line is a switch, on or off: the switch's two step.
    playToggle()
    set({ lines })
    edit('lines')
  }
  // Allow asks the OS -- its own prompt, its own words -- and the answer
  // is the answer: a refusal boards without the nudge. One the OS keeps
  // (it will not ask a second time) is said under the switch, which
  // would otherwise do nothing at every press (plan 247).
  function remind() {
    if (answers.notifications) { set({ notifications: false }); return }
    requestNudgePermission()
      .then(granted => {
        set({ notifications: granted })
        if (granted) { setNudgeDenied(false); return null }
        return nudgePermission().then(state => setNudgeDenied(state === 'denied'))
      })
      .catch(() => set({ notifications: false }))
  }
  function addToCalendar() {
    const { first } = firstDeparture(new Date(), answers.minute)
    saveCalendar(dailyTrain({
      first,
      minutes: answers.rhythm,
      title: t.brdAgendaTitle,
      body: t.brdAgendaBody(answers.rhythm),
      url: `${window.location.origin}/app`,
    }))
  }
  function saveName(name) {
    set({ cardName: cleanCardName(name) })
    close()
  }

  // ── The contract ─────────────────────────────────────────────
  const jlpt = answers.jlpt ?? 'N5'
  const perDay = itemsForRhythm(answers.rhythm)
  const figures = planFigures(volumes, jlpt, answers.goal, perDay, answers.kana, now, answers.lines)
  const time = minutesToTime(answers.minute)
  const fullDate = dateFormat(lang)
  // The month the goal picked is reached in, for the lines' sheet -- once
  // the volumes that price it have answered.
  const arrivalMonth = volumes
    ? new Intl.DateTimeFormat(lang, { month: 'short', year: 'numeric' }).format(figures.date)
    : null
  // What each line carries on the ride to the goal, taken or not.
  const everyLine = volumes
    ? planFigures(volumes, jlpt, answers.goal, perDay, answers.kana, now, LINES)
    : null
  const lineCarries = everyLine && { vocab: everyLine.words, kanji: everyLine.kanji, grammar: everyLine.grammar }
  // What each rhythm's ride comes to, for the departure board.
  const rhythmRides = volumes
    ? RHYTHMS.map(min => planFigures(volumes, jlpt, answers.goal, itemsForRhythm(min), answers.kana, now, answers.lines))
    : null
  // And the kana's own stop -- the signs still unread, at the ride's pace.
  // A reader of both scripts has none.
  const kanaLeft = volumes ? kanaFigures(volumes, answers.kana, perDay, now) : null
  const kanaStop = kanaLeft && kanaLeft.kana > 0
    ? { date: new Intl.DateTimeFormat(lang, { day: 'numeric', month: 'short' }).format(kanaLeft.date), min: answers.rhythm }
    : null
  // The goal's sheet: the stops ahead, each priced at the card's pace on
  // its lines, and where a reader stands.
  const choice = answers.levelChoice
  const goalRows = choice
    ? goalStops(choice, answers.kana).map(stop => ({
        ...levelStop(t, lang, volumes, stop),
        jp: stop === 'novice',
        date: volumes ? fullDate.format(planFigures(volumes, jlpt, stop, perDay, answers.kana, now, answers.lines).date) : '',
      }))
    : []
  const here = answers.kana === 'both' && choice ? levelStop(t, lang, volumes, choice) : null

  // The print, as the card's back takes it (PassBack's data): a beginner
  // rides from 初 -- the novice has passed no stop to print -- and the
  // kana's own stop, as a destination, is printed in its sign.
  const contract = {
    from: choice && choice !== 'novice' ? stopParts(t, choice) : { code: '初', name: t.brdNovice, jp: true },
    to: answers.goal === 'novice' ? { code: 'あ', name: t.kanaTitle, jp: true } : stopParts(t, answers.goal),
    valid: answers.goal && volumes ? fullDate.format(figures.date) : null,
    service: paceLabel(t, perDay),
    hour: `${t.destHour[bucketFor(answers.minute)]} · ${time}`,
    lines: answers.lines,
    name: answers.cardName,
    // The list under the card names the rhythm in minutes, as its sheet does.
    minutes: answers.rhythm,
  }

  // Where the card lives: an account the learner boarded with, or one
  // kept here; a link on its way; or this device alone.
  const user = session?.user ?? null
  const viaGoogle = keptBy === 'google'
    || user?.app_metadata?.provider === 'google'
    || (user?.identities ?? []).some(i => i.provider === 'google')
  const kept = !guest
    ? { state: viaGoogle ? 'google' : 'account', email: user?.email ?? null }
    : linkSent ? { state: 'sent', email: linkSent } : { state: 'device' }

  function complete() {
    if (busy) return
    if (dryRun) { onComplete(); return }
    setBusy(true)
    setSaveError(null)
    const fresh = planFigures(volumes, jlpt, answers.goal, perDay, answers.kana, new Date(), answers.lines)
    const body = {
      jlptLevel: jlpt,
      dailyNewTarget: perDay,
      // The novice's stop rides in this field like any JLPT one: the
      // office stores it (routes/onboarding.py GOAL_LEVELS), and the
      // pass then measures the promise in kana.
      ...(answers.goal ? { goalLevel: answers.goal } : {}),
      ...(answers.goal && volumes ? { goalTargetDate: fresh.date.toISOString().slice(0, 10) } : {}),
      dailyDeparture: bucketFor(answers.minute),
      kanaKnown: answers.kana,
      // The lines to ride (backend core/lines.py): the plates' order,
      // the promise's price, the ghost train's scope.
      lines: answers.lines,
      rhythmMin: answers.rhythm,
      reminderTime: time,
      notifications: answers.notifications,
      tzOffsetMin: -new Date().getTimezoneOffset(),
      // The name the card prints, '' for none (routes/profile.py card_name).
      cardName: answers.cardName,
    }
    apiJsonWithTimeout('/api/onboarding/complete', session, {
      method: 'POST',
      timeoutMs: 10000,
      body: JSON.stringify(body),
    })
      .then(() => {
        clearStash()
        // The far end of the funnel every boarding_step above measures.
        // The answers, never text a learner typed: whether a name was
        // given, never the name.
        track('boarding_done', {
          kana_known: answers.kana,
          level: jlpt,
          pace: perDay,
          // The chosen names joined, never text a learner typed.
          lines: answers.lines.join(','),
          notifications: answers.notifications,
          // How the level was found (plan 224), and where the test placed
          // the learner when they took it.
          ...(answers.kana === 'both' ? { level_how: answers.placed ? 'test' : 'pick' } : {}),
          ...(answers.placed ? { placed: answers.placed.recommendedLevel } : {}),
          // The card (plan 247): which of its fields a sheet changed --
          // the defaults are what most keep, or they are not -- whether
          // it carries a name, and where it was left.
          edited_goal: edited.goal,
          edited_rhythm: edited.rhythm,
          edited_hour: edited.hour,
          edited_lines: edited.lines,
          named: answers.cardName.length > 0,
          kept: keptBy ?? (guest ? (linkSent ? 'link' : 'none') : 'already'),
          // The same measure across the whole line.
          ms: watches.current?.total.read() ?? 0,
        })
        // The gate reads the profile summary for the card's holder and
        // the HUD reads the balance -- refresh both before the cutscene
        // mounts. Fire-and-forget: both stores fail quietly.
        refreshSummary()
        refreshCredits()
        // What App's copy of the profile, read before the boarding,
        // cannot know: the kana answer decides the first ride (入門 for
        // « Pas encore », plan 170).
        onComplete({ kanaKnown: answers.kana })
      })
      .catch(err => {
        setBusy(false)
        // An ApiError means the office ANSWERED. A 4xx is a refusal,
        // which the same press earns again; a 5xx, a 408 or a 429 is the
        // office unable to answer just now, which a second press a moment
        // later is not (plan 247). Anything else -- a dead fetch, the
        // timeout's own abort -- never reached it.
        const answered = err instanceof ApiError
        const status = answered ? Number(err.status) || 0 : 0
        setRefusedWith(status)
        setSaveError(!answered ? 'network' : status >= 500 || status === 408 || status === 429 ? 'busy' : 'refused')
      })
  }

  // ── The screens ──────────────────────────────────────────────
  const stops = trackStops(answers)
  const arrival = step === 'card'
  const onTrack = !arrival && stops.includes(stopOf(step))
  const index = stops.indexOf(stopOf(step)) + 1
  const total = stops.length
  // The number a question's hub prints: its place on the line.
  const hubNo = key => String(stops.indexOf(key) + 1).padStart(2, '0')

  const sheets = (
    <>
      <GoalSheet
        open={sheet === 'goal'}
        onClose={close}
        stops={goalRows}
        here={here}
        value={answers.goal}
        onPick={pickGoal}
        cap={t.brdGoalCap(answers.rhythm)}
      />
      <RhythmSheet
        open={sheet === 'rhythm'}
        onClose={close}
        value={answers.rhythm}
        onPick={pickRhythm}
        rides={rhythmRides}
        stop={answers.goal ?? jlpt}
        first={kanaStop}
      />
      <HourSheet
        open={sheet === 'hour'}
        onClose={close}
        minute={answers.minute}
        onChange={turnHour}
        onPick={pickHour}
        now={now}
        native={canNudge()}
        notifications={answers.notifications}
        denied={nudgeDenied}
        onRemind={remind}
        onAgenda={addToCalendar}
      />
      <LinesSheet
        open={sheet === 'lines'}
        onClose={close}
        value={answers.lines}
        onChange={switchLines}
        carries={lineCarries}
        stop={answers.goal ?? jlpt}
        arrival={arrivalMonth}
        novice={answers.kana !== 'both'}
      />
      <NameSheet open={sheet === 'name'} onClose={close} value={answers.cardName} onSave={saveName} />
      <AccountSheet
        open={sheet === 'account'}
        onClose={close}
        sent={linkSent}
        // The last moment before the web navigates away for Google, when
        // the answers still only exist in memory.
        onLeaveForAuth={() => stash({ answers, step: 'card', sheet: 'account', keeping: 'google', edited, history })}
        onKept={by => { setKeptBy(by); close() }}
        onSent={email => { setLinkSent(email); setKeptBy('link'); close() }}
      />
    </>
  )

  // `leaving`: the car pulling out, drawn for the pull and dropped -- a
  // screen that fetches as it mounts (the test) is drawn still there, and
  // the card pulling out takes no sheet with it.
  function renderStep(key, leaving = false) {
    switch (key) {
      case 'kana':
        return <KanaStep value={answers.kana} onAnswer={answerKana} />
      case 'reveal':
        return <KanaReveal onContinue={() => go('card')} first={kanaStop} />
      case 'test':
        return <TestStep session={session} onResult={placedBy} onPick={skipTest} still={leaving} />
      case 'level':
        return (
          <LevelStep
            volumes={volumes}
            value={answers.levelChoice}
            // An answer picked: the wood pick every list in the app makes.
            onChange={v => { playUi('click-mode-selection'); set({ levelChoice: v }) }}
            onContinue={continueLevel}
            onTest={() => go('test')}
            no={hubNo('level')}
            placed={answers.placed}
          />
        )
      case 'card':
        return (
          <CardStep
            contract={contract}
            kept={kept}
            onOpen={openDoor}
            onSign={() => setSheet('name')}
            onKeep={() => setSheet('account')}
            onEnter={complete}
            onSwitch={guest ? null : onSignIn}
            onReport={() => setReporting(true)}
            busy={busy}
            error={saveError}
          >
            {!leaving && sheets}
            {!leaving && (
              <FeedbackSheet
                open={reporting}
                onClose={() => setReporting(false)}
                session={session}
                failure={failureOf('/api/onboarding/complete', refusedWith)}
              />
            )}
          </CardStep>
        )
      default:
        return null
    }
  }

  // ── 辻 — the strip at the floor's left end (plans 140, 163) ──────
  // A stop per question, each named, the ones ridden filled and the one
  // being asked lit; the answer given is said on its stop, and a stop
  // behind is a door back to its question while there is a way back.
  const stopValue = {
    kana: answers.kana ? t.brdKana[answers.kana] : null,
    level: choice == null ? null : choice === 'novice' ? t.brdNovice : choice,
    card: null,
  }
  const atStop = stops.indexOf(stopOf(step))
  const deskStops = stops.map((key, i) => {
    const state = atStop < 0 || i < atStop ? 'done' : i === atStop ? 'now' : 'next'
    return {
      key,
      label: t.brdStop[key],
      value: stopValue[key],
      state,
      onOpen: state === 'done' && history.includes(key) ? () => jumpTo(key) : undefined,
    }
  })
  // The way back the floor draws beside Continue (BoardBack): the
  // question before, or out of the flow from the first.
  const floorBack = desk && onTrack ? (history.length > 0 ? back : onExit) : null

  return (
    <main
      // The card stands with no head, as an arrival screen (plan 168).
      className={desk ? 'brd desk-brd' : onTrack ? 'brd' : 'brd brd--arrival'}
      id="main-content"
      data-step={step}
      ref={frameRef}
      // A plain number, read as pixels by the sheet: a measured length,
      // not one chosen from the scale.
      style={desk && stripW ? { '--desk-strip-w': stripW } : undefined}
    >
      {onTrack && !desk && <BoardHead index={index} total={total} onBack={history.length > 0 ? back : onExit} />}
      <BoardBack.Provider value={floorBack}>
        <div className="brd__cars">
          {leaving && (
            <div key={`out:${leaving.step}`} className="brd__car brd__car--out" data-dir={leaving.dir} data-car={desk ? leaving.step : undefined} aria-hidden="true" inert>
              {renderStep(leaving.step, true)}
            </div>
          )}
          <div key={step} className={`brd__car${leaving ? ' brd__car--in' : ''}`} data-dir={leaving?.dir ?? 'none'} data-car={desk ? step : undefined}>
            {renderStep(step)}
          </div>
        </div>
      </BoardBack.Provider>
      {desk && <DeskStrip stops={deskStops} stripRef={stripRef} />}
    </main>
  )
}
