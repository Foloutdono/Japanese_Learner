import { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { useLang } from '../LangContext'
import { useDesk } from '../hooks/useDesk'
import { Bar, Leave } from '../components/chrome/Bar'
import { DeskSide } from '../components/chrome/DeskSide'
import { dialogOpen } from '../lib/dialogOpen'
import { Seg } from '../components/chrome/Console'
import { Sheet } from '../components/chrome/Sheet'
import { stationFor } from '../config/stations'
import { WordsList } from '../components/analysis/WordsList'
import { FocusCard } from '../components/analysis/FocusCard'
import { SubtitleLine } from '../components/analysis/SubtitleLine'
import { PlayerBar } from '../components/analysis/PlayerBar'
import { createPlayhead } from '../components/analysis/playhead'
import { passageTiming } from '../components/analysis/wordTimes'
import { ExplainPanel, ExplainSheet } from '../components/analysis/ExplainPanel'
import { GrammarPoints } from '../components/analysis/GrammarPoints'
import { coversToken, numberedPointsOf } from '../components/analysis/grammarSpans'
import { useLight } from '../components/analysis/useLight'
import { Dots } from '../components/ui/Loading'
import { DictionaryLookupSheet, DictionaryLookupBody } from '../components/dictionary/DictionaryDetail'
import { grammarLookup, lookupKey, tokenLookup } from '../components/analysis/lookup'
import { useMining } from '../components/analysis/useMining'
import { useAnalyzerSession } from '../components/analysis/useAnalyzerSession'
import { IntakeText } from '../components/analysis/IntakeText'
import { IntakePhoto } from '../components/analysis/IntakePhoto'
import { IntakeVideo } from '../components/analysis/IntakeVideo'
import { GrabTutorial, GrabTutorialDock } from '../components/analysis/GrabTutorial'
import { useBookmarkletCopy, watchUrlFor } from '../components/analysis/useBookmarkletCopy'
import { PassageLine } from '../components/analysis/PassageLine'
import { Notices } from '../components/analysis/Notices'
import { PassageShelf } from '../components/analysis/PassageShelf'
import { EntryLine } from '../components/analysis/EntryLine'
import { sourceFor, SOURCES, DEFAULT_SOURCE } from '../components/analysis/sources'
import { parseVideoId } from '../lib/youtube'
import { apiJson } from '../lib/api'
import { VideoPlayer } from '../components/video/VideoPlayer'
import { decodeGrabHash, transcriptXmlToVtt } from '../lib/captionGrab'
import { ChevronIcon, PlusIcon, CheckIcon, OpenBookIcon, TextLinesIcon, CameraIcon, VideoIcon, SearchIcon } from '../components/ui/Icons'
import { readVideoSound, saveVideoSound, DEFAULT_VIDEO_SOUND } from '../lib/videoVolume'

const KAISEKI = 'var(--line-kaiseki)'
// The three platforms' glyphs, the dictionary door's (plan 136).
const SOURCE_GLYPHS = { text: TextLinesIcon, photo: CameraIcon, video: VideoIcon }
// A link pasted where Japanese goes (plan 136): the whole field is one
// YouTube URL. The video intake takes it, since a link is not text to
// analyse.
function videoLinkIn(text) {
  const s = text.trim()
  return /^https?:\/\/\S+$/.test(s) && parseVideoId(s) ? s : null
}
// A subtitle file, by its name or its type: what a drop on the desk's
// page hands the video intake rather than the photo one. Anything else
// dropped is refused quietly (the browser would open it over the page).
const SUBTITLE_FILE = /\.(srt|vtt|ass|ssa)$/i
// The grab has been used on this browser (plan 136) -- a bookmark lives
// in a browser, so the browser is what remembers it. The history says
// so too, by the name the arrival gives its file (see the grab arrival).
const GRAB_USED_KEY = 'tsuji.grabUsed'
function readGrabUsed() {
  try { return window.localStorage.getItem(GRAB_USED_KEY) === '1' } catch { return false }
}
function rememberGrabUsed() {
  try { window.localStorage.setItem(GRAB_USED_KEY, '1') } catch { /* private mode: the history still says so */ }
}
const grabbedSession = h => h.kind === 'session' && Boolean(h.videoId) && h.label === `${h.videoId}.ja.vtt`
// 速度 (plan 134): the desk bar's speed, one press through the three.
const RATES = [1, 0.75, 0.5]
// A poll that jumps further than this was a seek, not playback: the
// loop and the stop at each sentence's end act on playback only, so a
// click far down the track is never dragged back or paused under the
// learner.
const PLAYBACK_STEP = 1.5
// The stop at each sentence's end (plan 134) is timed, not polled: the
// player reports its clock four times a second, and a stop made on the
// poll that finds the end already crossed let up to a quarter second of
// the NEXT sentence play -- and 追従 moved the line on to it, so the
// replay and the words were the next sentence's, not the one just
// heard. Within this much of the end (wall-clock seconds, more than one
// poll) a timer is set for the end itself...
const HOLD_LOOKAHEAD = 0.4
// ...which fires this early, the player's own pause taking a beat...
const HOLD_LEAD_MS = 80
// ...and a clock found past the end is set back this far inside it, so
// the sentence held is the one the subtitle, the words and Rejouer show.
const HOLD_INSET = 0.05
// The furigana dial's three settings, in the order the desk's one
// quiet button walks them.
const FURIGANA = ['all', 'unknown', 'none']
const FURIGANA_LABEL = { all: 'furiganaAll', unknown: 'furiganaUnknown', none: 'furiganaNone' }

// ── 解析駅 — one station, three platforms ─────────────────
// The merge of PhraseAnalyzerScreen and VideoScreen (plan 027). They
// did one job through two screens: take Japanese from the world, split
// it into Sentences, take each apart. They already shared
// SentenceBreakdown, the word sheet, useMining and the deep tier, and
// duplicated the rest verbatim -- including the comment explaining why
// the sheet's close handler is a useCallback.
//
// CONTEXT.md's own definition says this is one screen: "Passage --
// what the user submits for analysis, as one act: typed text, a photo,
// a video window". One noun, three sources, one `source` field.
//
// The result is one drawing for all three sources (plan 028): the
// Passage as a 路線図, every Sentence a stop, one of them open. The
// three intakes are 改札口 (plan 029) -- the writing slip, the photo
// bench and the subtitle dock -- and exactly one of them is ever
// mounted: the platform the segmented control over the page selects.
export default function AnalyzerScreen({ session }) {
  const { t } = useLang()
  const mining = useMining(session)
  const analyzer = useAnalyzerSession(session)
  const playerRef = useRef(null)

  // 'text' | 'photo' | 'video' -- which platform the learner is standing
  // on. The text platform from the first paint (plan 073): the canvas puts
  // the three intakes on one segmented control over the page, so there
  // is no gate to board through any more — switching is a mode switch
  // (see boardPlatform), and the Passage a platform built stays behind
  // it while you are on it.
  //
  // ?intake= is the door's deep link: the dictionary draws the three
  // platforms on the analyzer's row (screens/DictionaryScreen.jsx), and
  // a tap on the camera there means "open standing on 写真", not "open
  // on 文字 with the camera one tap further in". Read once, as the
  // initial platform — the segmented control owns the mode from then
  // on, and a key that is not one of the three is simply ignored.
  // ── Can this deployment fetch a link at all? ─────────────
  // Asked, never assumed. The fetch removed in docs/adr/0003 spent a
  // release cycle looking like the primary route while never working
  // in production ("every link i try doesnt work"), and it is a paid
  // proxy that decides -- so the server is the only thing that knows.
  //
  // False until proven otherwise, including when the probe itself
  // fails: the two ingests that always work are already on screen, so
  // the cost of guessing wrong in this direction is a hidden button
  // rather than a broken promise.
  const [linkFetch, setLinkFetch] = useState(false)
  useEffect(() => {
    let cancelled = false
    apiJson('/api/video/capabilities', session)
      .then(caps => { if (!cancelled) setLinkFetch(Boolean(caps?.linkFetch)) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [session])

  const [sp] = useSearchParams()
  const [source, setSource] = useState(() => (sourceFor(sp.get('intake')) ? sp.get('intake') : DEFAULT_SOURCE))
  // The last platform actually boarded — what boardPlatform compares
  // against to tell a mode SWITCH (clear the workbench) from a
  // same-mode press (keep it).
  const lastBoardedRef = useRef(source)

  // The draft text, shared by the 文字 and 写真 platforms on purpose --
  // they were one field on one screen before the merge, and OCR output
  // the learner wants to edit by hand should survive a switch to 文字.
  // A sentence handed over by the dictionary (plan 115: a search that
  // found no entry, on the desk, offers to analyse what was typed) is
  // the draft the screen opens on, analysed once on arrival below.
  const location = useLocation()
  const navigate = useNavigate()
  const [draft, setDraft] = useState(() => location.state?.draft ?? '')
  // Whether the current draft came from OCR rather than being typed --
  // sent as the Passage's `source` on analyze (plan 016's Sentence bank
  // provenance). Reset on any direct edit, since a full retype is no
  // longer "from a photo"; a correction made through ImageInput's own
  // flow is still the same image's text and keeps it.
  const [fromImage, setFromImage] = useState(false)

  // The optional video link. Held HERE, not in the video intake, so the
  // player can read it live: a learner who uploads a file and pastes the
  // link afterwards used to get no player at all, because the session
  // had already been created without a video_id and nothing re-read it.
  const [videoUrl, setVideoUrl] = useState('')

  // 机 (plan 120): the grab's walkthrough, open in the intake's column
  // on the desk rather than over the intake, and the copy state its
  // button shares with the panel's (both are on screen at once there).
  // A phone leaves both to IntakeVideo, whose dialog it is.
  const grab = useBookmarkletCopy()
  const [tutorial, setTutorial] = useState(false)
  const closeTutorial = useCallback(() => setTutorial(false), [])

  // Once a Passage is ready the intake folds away, giving the breakdown
  // the screen. Reopened on demand; reset whenever a new Passage lands.
  const [intakeOpen, setIntakeOpen] = useState(true)

  // Which Token of the focused Sentence the stepper is showing. Reset on
  // every change of Sentence, or you land on token 7 of a 3-token line.
  const [tokenIndex, setTokenIndex] = useState(0)

  // 追従 — whether the line follows the video's clock. On by default,
  // because watching along is the point. Off the moment the learner
  // picks a stop by hand while the video is running: they have said
  // where they want to be, and being dragged back to the playhead
  // mid-sentence is the defect this closes.
  const [followPlayback, setFollowPlayback] = useState(true)

  // The transport bar's readouts. `playing` is the iframe's own truth
  // (VideoPlayer's onPlayingChange), never a boolean kept beside it;
  // `duration` is the video's length, which the bar runs to.
  const [playing, setPlaying] = useState(false)
  const [duration, setDuration] = useState(0)
  // 音量 — the player's sound. Read from storage on the first render
  // rather than defaulted and corrected, so a learner who turned a
  // loud track down never meets the next one at full (lib/videoVolume).
  const [sound, setSound] = useState(readVideoSound)
  // The player's clock (components/analysis/playhead): the poll the
  // follow logic rides, readable from closures that must not go stale
  // (the Space handler, the bar's play), and, carried between polls, the
  // clock the subtitle's words are lit on (字幕の流れ). Not state: the
  // bar and the subtitle subscribe to it, so the 4Hz poll renders them
  // and not this screen.
  const [playhead] = useState(() => createPlayhead({ read: () => playerRef.current?.currentTime?.() }))

  // ── The working rail (the mockup's 司令室 half) ──────────
  // Which stops the route map shows. 'all' | 'kept' | 'i1' | 'new',
  // plus a free-text search within the Passage. Client-side only: the
  // Passage is already in hand, and a fifty-stop subtitle track is
  // exactly the input these exist for.
  const [stopFilter, setStopFilter] = useState('all')
  const [stopQuery, setStopQuery] = useState('')
  // ...and whether there is a column to put it in. The rail is a
  // DESKTOP instrument (2026-09-11): below the split it used to stack
  // above the stage as a 170px window -- three stops of a Passage the
  // stepper already walks, a search field, four filter chips and a
  // bulk pin, all in the room a phone needed for the sentence itself.
  // Not hidden in CSS: a control the learner cannot see should not be
  // in the document, and PassageLine's scroll effect should not run
  // for a rail nobody can read. The split is the desk's (hooks/useDesk,
  // plan 113): the width index.css draws the two-column layout at, and
  // the width the app's second chrome starts at — one line, not three.
  const wide = useDesk()
  // 帳 (plan 136): under the desk the page is the passages and the way in
  // is one line over them; the video and photo intakes open as sheets
  // over it, and the grab's walkthrough as a dialog from the video one.
  // The dictionary's door (?intake=) opens the sheet it names.
  const [sheet, setSheet] = useState(() => (!wide && source !== 'text' ? source : null))
  // On the desk a file dropped anywhere on the page is taken (plan 136):
  // subtitles by the video intake, a picture by the photo one.
  const [dragging, setDragging] = useState(false)
  const [incomingImage, setIncomingImage] = useState(null)
  // The video intake's own drop: it holds the window a file is cut to.
  const videoDropRef = useRef(null)
  const [grabFlag, setGrabFlag] = useState(readGrabUsed)
  // ふりがな -- which readings the phrase line shows. 'unknown' is the
  // default on purpose: readings exactly where the SRS says the
  // learner still needs them, bare everywhere they've earned it.
  const [furigana, setFurigana] = useState('unknown')

  // ONE sheet over the stage (plan 096), whatever was pressed: a word
  // or a kanji opens its dictionary entry, a chip or a rule opens the
  // point's lesson -- the same plate, on the same ‹ stack. It used to
  // be two, a WordDetail for the word and this one for the rule, and
  // the word's was the poorer of the pair: the deck row's three fields
  // and the SRS record, where the dictionary carries the readings, the
  // examples, the kanji the word is built from and the ★ as well.
  // Stable so the sheet's useDialog doesn't re-run its focus-on-open
  // effect (and steal focus) on every render of this screen while it
  // is open -- see plans/README.md's plan-004 note for the bug class
  // this avoids.
  const [lookup, setLookup] = useState(null)
  const closeLookup = useCallback(() => setLookup(null), [])
  // 机 (plan 134): on the desk the result is three columns and the
  // right one is the card in focus -- its entry in the runs' band (plan
  // 126), following the token the learner walks to, or the door they
  // pressed (`lookup`). Explain puts the sentence's explanation in the
  // entry's description's place, and the swap on the column's edge goes
  // back and forth: `side` is which of the two the column shows.
  const [side, setSide] = useState('card')
  // The phone's explanation opens in a sheet (plan 134).
  const [explainOpen, setExplainOpen] = useState(false)
  const closeExplain = useCallback(() => setExplainOpen(false), [])
  // Every route into a new Passage starts the focus over: the first
  // word, its own entry, the card rather than an explanation.
  const clearFocus = useCallback(() => { setLookup(null); setSide('card'); setTokenIndex(0); setExplainOpen(false) }, [])
  // The desk's transport (plan 134, components/analysis/PlayerBar): the
  // focused sentence on a loop, a stop at each sentence's end, the
  // speed, and the video folded away to give the sentence the column.
  const [loop, setLoop] = useState(false)
  const [pauseEach, setPauseEach] = useState(false)
  const [rate, setRate] = useState(1)
  const [videoFolded, setVideoFolded] = useState(false)
  // The previous poll, which tells playback (a small step) from a seek.
  const lastPollRef = useRef(0)
  // The sentence the stop at each sentence's end is holding at (its
  // index), so Play goes on past it rather than stopping there again;
  // and the timer set for the end of the one playing.
  const heldRef = useRef(null)
  const holdTimerRef = useRef(null)
  const clearHoldTimer = useCallback(() => {
    clearTimeout(holdTimerRef.current)
    holdTimerRef.current = null
  }, [])
  useEffect(() => clearHoldTimer, [clearHoldTimer])
  // The clock's two inputs besides the poll. Play and pause reach the
  // playhead before the render that tells the subtitle, which reads it
  // in its layout effect.
  const changePlaying = useCallback(value => {
    playhead.setPlaying(value)
    setPlaying(value)
  }, [playhead])
  useEffect(() => { playhead.setRate(rate) }, [playhead, rate])
  // Paused by hand, or the stop turned off: no stop is owed.
  useEffect(() => { if (!playing) clearHoldTimer() }, [playing, clearHoldTimer])
  useEffect(() => {
    if (pauseEach) return
    clearHoldTimer()
    heldRef.current = null
  }, [pauseEach, clearHoldTimer])

  // Focus lands here when a Passage arrives. It has to be a real focus
  // move, not just a scroll: the Analyze button lives INSIDE the panel
  // that folds away, so hiding it blurs the document to <body> and a
  // keyboard user's next Tab restarts from the top of the page.
  const resultsRef = useRef(null)
  // Raised when a Passage arrives, spent by the effect that focuses the
  // result. See there for why it is a flag and not a frame.
  const wantsResultFocus = useRef(false)

  const { passage, sentences, status, error, focusIndex, explaining, explainError } = analyzer
  // Which Passage this is, by what it says rather than by the object
  // holding it: an explanation arriving is MERGED into the Passage (a
  // new object, the same sentences), and the effects below that start a
  // new Passage over -- the first word, the card, the filters, 追従 and
  // the focus on the result -- used to run again on it, putting the
  // word in focus back to the first and the focus off the Explain
  // button that had just been pressed (plan 134).
  const passageKey = passage ? [passage.videoId ?? '', ...sentences.map(s => s.text)].join('\n') : null
  // Where a grammar point sits, lit across the desk's three columns (the
  // subtitle line, the numbered points, the words list and the card).
  const light = useLight(analyzer.focused)
  const busy = status === 'working'
  const ready = status === 'ready' && Boolean(analyzer.focused)
  // The page is the intake until a Passage is ready, and the result
  // once one is: the canvas's AnalyzerResult, with ‹ Analyzer as the
  // way back to the intake (the Passage survives the trip — the Resume
  // row brings it back). Declared up here because the arrival effect
  // below depends on it, not only the markup at the foot of the file.
  const showResult = ready && !intakeOpen

  // The player needs an id, not a session: prefer the link the learner
  // has typed right now, fall back to whatever the session was created
  // with. This is what makes a link pasted AFTER an upload work.
  const playerVideoId = parseVideoId(videoUrl) ?? passage?.videoId ?? null
  // 字幕の流れ: what the whole track says about when its words are said
  // (its pace, how early its subtitles come up), for the lines it did
  // not time word by word. Read once a Passage, not once a line.
  const timing = useMemo(() => passageTiming(sentences), [sentences])
  // The platform standing on. Everything about it -- its name, its
  // panel's opening line, whether 運行履歴 applies -- comes from the one
  // registry, so a fourth source is one entry there rather than five
  // edits spread across two files. See components/analysis/sources.js.
  const platform = sourceFor(source)

  const station = stationFor('/dictionary/analyzer')

  // ── 字幕取り arrival ──
  // The bookmarklet (lib/captionGrab.js) leaves the YouTube page for
  // /analyzer#grab=… with the transcript XML riding the hash — the
  // one channel that crosses origins with no server and no CORS in
  // the way. Arriving with a readable grab IS a complete video
  // intake: board 動画, convert to VTT, and feed the EXISTING file
  // ingest, so nothing downstream of Cue knows the difference. The
  // hash is consumed first so a reload cannot re-submit, and an
  // unreadable one is silently none of our business (a stray anchor
  // must not hijack the screen).
  useEffect(() => {
    let cancelled = false
    decodeGrabHash(window.location.hash).then(grab => {
      if (!grab || cancelled) return
      window.history.replaceState(null, '', window.location.pathname + window.location.search)
      // The lines studied are the hand-written track's where there is
      // one; the recognised track then goes up beside it only as the
      // clock its words are read out on. Alone, the recognised track is
      // both, its words already timed.
      let vtt
      let timing = null
      try {
        vtt = transcriptXmlToVtt(grab.manual ?? grab.asr)
      } catch {
        analyzer.fail(t.grabEmpty)
        return
      }
      if (grab.manual && grab.asr) {
        try { timing = transcriptXmlToVtt(grab.asr) } catch { /* the words go estimated */ }
      }
      const url = `https://youtu.be/${grab.videoId}`
      rememberGrabUsed()
      setGrabFlag(true)
      boardPlatform('video')
      setVideoUrl(url)
      clearFocus()
      analyzer.startVideoFromFile(
        new File([vtt], `${grab.videoId}.ja.vtt`, { type: 'text/vtt' }),
        { url, timing: timing && new File([timing], `${grab.videoId}.ja-asr.vtt`, { type: 'text/vtt' }) },
      )
    })
    return () => { cancelled = true }
    // Mount-only by design: the hash is read once and consumed.
    // boardPlatform/analyzer are stable enough for a one-shot effect,
    // and re-running on their change would re-read a hash already gone.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // The dictionary's handoff, spent once: the draft is already in the
  // field (its initial state above); this analyses it, and drops the
  // route state so a reload or a Back does not analyse it again.
  const handedOver = useRef(false)
  useEffect(() => {
    const text = location.state?.draft
    if (handedOver.current || !text) return
    handedOver.current = true
    analyzer.analyzeText(text, { source: 'typed' })
    navigate({ pathname: location.pathname, search: location.search }, { replace: true, state: null })
    // Mount-only, like the grab arrival above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- id-keyed reset: a new Sentence starts at its first Token, or you land on token 7 of a 3-token line.
    setTokenIndex(0)
    // An explanation belongs to its sentence: another sentence opens on
    // its card (plan 134).
    setSide('card')
  }, [focusIndex, passageKey])

  useEffect(() => {
    // A NEW Passage starts with the whole line visible. A filter or a
    // search kept from the last one would silently hide stops of a
    // Passage it was never about -- the same stale-state class as the
    // token index above, reset the same way.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- id-keyed reset, keyed off the Passage's identity.
    setStopFilter('all')
    setStopQuery('')
  }, [passageKey])

  useEffect(() => {
    // A DIFFERENT video means a fresh player: the destroyed one can no
    // longer report its state, and a playhead held over from the last
    // clip would draw a full bar on a player that hasn't started.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- id-keyed reset, keyed off the player's identity.
    setPlaying(false)
    setDuration(0)
    playhead.reset()
  }, [playerVideoId, playhead])

  useEffect(() => {
    if (status !== 'ready') return
    // eslint-disable-next-line react-hooks/set-state-in-effect -- a Passage ARRIVING folds the intake away; keyed off a status transition, not off a render-time value.
    setIntakeOpen(false)
    // A NEW Passage follows the clock by default — watching along is
    // the point, and 追従 switched off by a hand-pick on the LAST
    // Passage is not a choice the learner made about this one.
    setFollowPlayback(true)
    wantsResultFocus.current = true
  }, [status, passageKey])

  // The arrival takes focus into the result, but not in the render that
  // decides it: folding the intake away is what MOUNTS the region, so
  // the node does not exist until the commit after the effect above.
  //
  // This waited a frame for it — and a frame is a promise the browser
  // does not keep. requestAnimationFrame is throttled to nothing in a
  // page that is not visible, so on a backgrounded tab the focus move
  // was simply dropped and a keyboard learner was left standing on the
  // 解析 button with the result unannounced beside them. (It is also
  // what made this screen's focus case fail about one full test run in
  // five, and it reproduces every time with rAF starved.) The arrival
  // raises a flag; this spends it on the render where the region is
  // actually in the DOM, which React gives us with no clock at all.
  useEffect(() => {
    if (!showResult || !wantsResultFocus.current) return
    wantsResultFocus.current = false
    // Never pull focus out of an open dialog. Step 2a removes the one
    // path that could leave one open across a new Passage, so this is
    // belt-and-braces -- but a focus move that fights a focus trap is
    // the kind of bug that is invisible until someone is navigating by
    // keyboard, and the guard costs one query.
    if (document.querySelector('[role="dialog"]')) return
    resultsRef.current?.focus()
  }, [showResult, passageKey])

  // ← / → step through the focused Sentence's Tokens, ↑ / ↓ walk the
  // Sentences themselves, Space drives the player — the map the kbd
  // strip under the stage prints. Ignored while typing, or the arrow
  // keys would fight the caret in the writing slip.
  useEffect(() => {
    if (!ready) return undefined
    function onKey(e) {
      const handled = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' ']
      if (!handled.includes(e.key)) return
      // Not under a dialog -- the deck picker's ↑/↓ walked the Passage
      // behind it -- and not on a chord: Alt/⌘+← is the browser's Back
      // (plan 123).
      if (e.metaKey || e.ctrlKey || e.altKey || dialogOpen()) return
      const el = document.activeElement
      const tag = el?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || el?.isContentEditable) return
      // The route map owns its own arrows (roving tabindex) -- inside
      // it the arrow keys mean "move along the line", not this map.
      if (el?.closest?.('.anl-line')) return
      // Space on a focused button is the button's own activation.
      if (e.key === ' ' && tag === 'BUTTON') return

      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault()
        // On the desk the dock follows the token walked to: a door
        // pressed before stops being what it shows.
        if (wide) setLookup(null)
        const last = (analyzer.focused?.tokens?.length ?? 1) - 1
        setTokenIndex(i => e.key === 'ArrowRight'
          ? Math.min(last, i + 1)
          : Math.max(0, i - 1))
      } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        e.preventDefault()
        // Through goToStop, not setFocusIndex: walking the line by
        // key is the same act as clicking a stop, so it breaks 追従
        // and seeks the player exactly the same way.
        const next = e.key === 'ArrowDown'
          ? Math.min(sentences.length - 1, focusIndex + 1)
          : Math.max(0, focusIndex - 1)
        if (next !== focusIndex) goToStop(next)
      } else if (e.key === ' ' && playerVideoId) {
        e.preventDefault()
        // Through togglePassagePlayback, not a bare play(): Space is
        // the transport bar's key, and from before the Passage's
        // window both must seek to the window first.
        togglePassagePlayback()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // goToStop is a function declaration in this same scope: the
    // closure re-binds on every dep change below, which covers every
    // value it reads.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, analyzer.focused, focusIndex, sentences.length, playing, playerVideoId, wide])

  // Esc gives the dock back: the route map for a longer Passage, the
  // stage's own token for a one-sentence one. Not from a field, not
  // under a dialog. The desk's only.
  useEffect(() => {
    if (!wide || !ready) return undefined
    function onKey(e) {
      if (e.key !== 'Escape' || dialogOpen()) return
      const tag = document.activeElement?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
      // One step back per press (plan 134): the explanation gives the
      // card's description back first, then a door pressed gives the
      // walked token's entry back.
      if (side === 'explain') setSide('card')
      else setLookup(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [wide, ready, side])

  function editDraft(text) {
    const link = videoLinkIn(text)
    if (link) { takeLink(link); return }
    setDraft(text)
    setFromImage(false)
  }

  // A YouTube link pasted where Japanese goes (plan 136): the video
  // intake, with the link in its field -- the desk's platform, a phone's
  // sheet.
  function takeLink(link) {
    setDraft('')
    setFromImage(false)
    if (wide) boardPlatform('video')
    else openSheet('video')
    setVideoUrl(link)
  }

  function analyzeDraft() {
    clearFocus()
    setSheet(null)
    // The phone's line is the text platform, its photo sheet the photo
    // one: what the busy line names.
    if (!wide) setSource(fromImage ? 'photo' : 'text')
    analyzer.analyzeText(draft, { source: fromImage ? 'image' : 'typed' })
  }

  // A phone's sheet stands on its platform without clearing anything: it
  // is a door opened over the passages, not a switch of the page.
  function openSheet(kind) {
    lastBoardedRef.current = kind
    setSource(kind)
    setSheet(kind)
  }
  const closeSheet = useCallback(() => setSheet(null), [])

  // The desk's page takes a dropped file (plan 136). A drop the photo
  // tiles already took is theirs.
  const grabUsed = grabFlag || analyzer.history.some(grabbedSession)
  const showTutorial = tutorial && source === 'video'
  function onPageDragOver(e) {
    if (![...(e.dataTransfer?.types ?? [])].includes('Files')) return
    e.preventDefault()
    setDragging(true)
  }
  function onPageDragLeave(e) {
    if (e.currentTarget.contains(e.relatedTarget)) return
    setDragging(false)
  }
  function onPageDrop(e) {
    setDragging(false)
    if (e.defaultPrevented) return
    const file = e.dataTransfer?.files?.[0]
    if (!file) return
    e.preventDefault()
    if (file.type.startsWith('image/')) {
      boardPlatform('photo')
      setIncomingImage(file)
    } else if (SUBTITLE_FILE.test(file.name) || file.type === 'text/vtt') {
      if (source === 'video' && videoDropRef.current) videoDropRef.current(file)
      else {
        boardPlatform('video')
        startVideoFromFile(file, { url: '' })
      }
    }
  }

  // Every route into a new Passage closes the open sheet, not just
  // this one. The sheet was opened on a Token of the Passage that was
  // on screen at the time; once a NEW Passage arrives it is describing
  // content the learner has already replaced. analyzeDraft has always
  // done this; the two video ingests did not, which is the only path
  // by which a dialog could still be open when the arrival effect
  // below moves focus to the result -- stealing focus out of a live
  // dialog and silently defeating useDialog's Tab-wrap trap.
  function startVideoFromFile(file, opts) {
    if (!file) return
    clearFocus()
    setSheet(null)
    analyzer.startVideoFromFile(file, opts)
  }

  function startVideoFromLink(url, opts) {
    clearFocus()
    setSheet(null)
    analyzer.startVideoFromLink(url, opts)
  }

  // Boarding a platform ALWAYS opens its intake, even when a result
  // has already folded it away: arriving somewhere with the counter
  // shut is a platform that appears to do nothing -- the exact defect
  // the old rail's plan-032 fix closed, kept closed across the move to
  // the selection-screen gate.
  //
  // Switching MODES is a new job: boarding a DIFFERENT platform clears
  // the whole workbench — Passage, draft, video link, detail sheet —
  // because a Passage typed on 文字 has no business waiting behind the
  // 写真 bench (owner-directed, 2026-09-01; this supersedes the
  // merge-era rule that the Passage survived every platform change,
  // and with it the OCR-text-survives-a-switch-to-文字 rationale for
  // the shared draft). Re-boarding the SAME platform keeps everything:
  // a trip out to the gate and back is not a switch, and history rows
  // reopened from the concourse land on their own platform unharmed.
  // Compared against a ref, not `source`: the gate only renders once
  // source is null, so by the time a card is picked the state no
  // longer remembers where the learner came from.
  function boardPlatform(key) {
    if (lastBoardedRef.current !== key) {
      analyzer.reset()
      clearFocus()
      setDraft('')
      setFromImage(false)
      setVideoUrl('')
      playhead.reset()
    }
    lastBoardedRef.current = key
    setSource(key)
    setTutorial(false)
    setIncomingImage(null)
    setIntakeOpen(true)
    // A fresh player mounts paused; the destroyed one can no longer
    // report its own state, so this is the one boolean reset by hand.
    changePlaying(false)
  }

  // ── Playback sync ─────────────────────────────────────────
  const handleTimeUpdate = useCallback(seconds => {
    const last = lastPollRef.current
    lastPollRef.current = seconds
    playhead.poll(seconds)
    const played = seconds >= last && seconds - last < PLAYBACK_STEP
    // 反復 (plan 134): on a loop, the focused sentence's end sends the
    // clock back to its start -- the line does not move on, whatever
    // 追従 says.
    const here = sentences[focusIndex]
    if (loop && played && here?.cue_end != null && here.cue_start != null
        && last < here.cue_end && seconds >= here.cue_end) {
      playerRef.current?.seekTo(here.cue_start)
      return
    }
    // 一時停止 (plan 134): stop where the sentence that was playing ends,
    // BEFORE the next one starts -- the line stays on it, so the learner
    // can replay it and read its breakdown; Play goes on to the next.
    if (!played) clearHoldTimer()
    if (pauseEach) {
      const held = heldRef.current
      const inside = at => sentences.findIndex(s => s.cue_end != null && at >= (s.cue_start ?? 0) && at < s.cue_end)
      // Loop owns the focused sentence's end.
      const stops = i => i !== -1 && i !== held && !(loop && i === focusIndex)
      const hold = i => {
        const s = sentences[i]
        clearHoldTimer()
        heldRef.current = i
        const player = playerRef.current
        player?.pause()
        const at = player?.currentTime?.() ?? playhead.polled()
        if (at >= s.cue_end - HOLD_INSET) player?.seekTo(Math.max(s.cue_start ?? 0, s.cue_end - HOLD_INSET))
        if (followPlayback) analyzer.setFocusIndex(i)
      }
      // The end crossed between two polls with no timer set (a clock
      // that jumped, a first poll): stop, and step back inside.
      const was = played ? inside(last) : -1
      if (stops(was) && seconds >= sentences[was].cue_end) {
        hold(was)
        return
      }
      // The end is close: a timer for it.
      const now = inside(seconds)
      if (seconds > last && stops(now) && !holdTimerRef.current) {
        const left = (sentences[now].cue_end - seconds) / rate
        if (left <= HOLD_LOOKAHEAD) {
          const s = sentences[now]
          holdTimerRef.current = setTimeout(() => {
            holdTimerRef.current = null
            // Unless the learner seeked away in the meantime.
            const at = playhead.polled()
            if (at >= (s.cue_start ?? 0) && at < s.cue_end + PLAYBACK_STEP) hold(now)
          }, Math.max(0, left * 1000 - HOLD_LEAD_MS))
        }
      }
      // Out of the sentence held: its end stops the clock again next time.
      if (held !== null && now !== held) heldRef.current = null
    }
    // While it plays, the follow runs on time (below); a poll reads a
    // clock up to a quarter second old, and would send the line back.
    if (!followPlayback || (playing && !loop && !pauseEach)) return
    analyzer.setFocusIndex(prev => {
      const idx = sentences.findIndex(s => seconds >= s.cue_start && seconds < s.cue_end)
      // -1 during the silence between cues: hold the current stop
      // rather than snapping back to the first one.
      return idx === -1 ? prev : idx
    })
  }, [sentences, analyzer, followPlayback, loop, pauseEach, focusIndex, rate, clearHoldTimer, playhead, playing])

  // 追従 on time (2026-09-27): while the video plays, the line in focus
  // moves on at the moment the clock reaches the next line's cue, on a
  // timer set for it from the playhead and set again on every poll (a
  // seek moves the moment). It moved on the next poll, up to a quarter
  // second late -- and the new line's first word with it, where a
  // recognised line's cue starts on that word. The loop and the stop at
  // each sentence's end own the line's end, so they keep the poll.
  const setFocusIndex = analyzer.setFocusIndex
  useEffect(() => {
    if (!playing || !followPlayback || loop || pauseEach || !playerVideoId) return undefined
    const timer = { id: 0 }
    const step = () => {
      clearTimeout(timer.id)
      const t = playhead.at()
      const idx = sentences.findIndex(s => t >= s.cue_start && t < s.cue_end)
      // A new focus runs this effect again, from there.
      if (idx !== -1 && idx !== focusIndex) {
        setFocusIndex(idx)
        return
      }
      let next = Infinity
      for (const s of sentences) if (s.cue_start > t && s.cue_start < next) next = s.cue_start
      if (next !== Infinity) timer.id = setTimeout(step, ((next - t) / rate) * 1000)
    }
    step()
    const off = playhead.subscribe(step)
    return () => {
      off()
      clearTimeout(timer.id)
    }
  }, [playing, followPlayback, loop, pauseEach, playerVideoId, sentences, focusIndex, playhead, setFocusIndex, rate])

  // The Passage's window, the first cue to the last: where Play starts.
  const cued = sentences.filter(s => s.cue_end != null)
  const windowStart = cued.length ? Math.min(...cued.map(s => s.cue_start ?? 0)) : null
  const windowEnd = cued.length ? Math.max(...cued.map(s => s.cue_end)) : null
  const hasWindow = windowStart != null && windowEnd != null && windowEnd > windowStart
  // The transport spans the VIDEO, 0 to its length, so its clock reads
  // what YouTube's own bar does (owner-directed, 2026-09-27: the window's
  // clock read 3:32 / 2:56 beside YouTube's 3:48 / 4:07). The last cue's
  // end stands in until the player knows the length.
  const span = Math.max(duration, hasWindow ? windowEnd : 0)

  // Play means "play the PASSAGE". A window opening at 0:36 on a track
  // that starts at 0:00 left the bar clamped at 0:00 for thirty-six
  // silent seconds — a player that looks dead while doing exactly what
  // it was told. From before the window, seek to its start first; from
  // inside (or past) it, plain play/pause. Reads the playhead, not
  // state, so the Space handler's closure can never act on a stale poll.
  function togglePassagePlayback() {
    if (playing) {
      playerRef.current?.pause()
      return
    }
    if (hasWindow && playhead.polled() < windowStart) {
      playerRef.current?.seekTo(windowStart)
    }
    playerRef.current?.play()
  }

  // Rejouer (plan 134): the focused sentence again, from its first cue.
  function replaySentence() {
    const here = sentences[focusIndex]
    if (here?.cue_start == null) return
    // Heard again, stopped again at its end.
    heldRef.current = null
    playerRef.current?.seekTo(here.cue_start)
    playerRef.current?.play()
  }

  function nextRate() {
    setRate(r => RATES[(RATES.indexOf(r) + 1) % RATES.length])
  }

  // ── 音量 ──────────────────────────────────────────────────
  // One writer for the whole setting, so the dial, the mute and the
  // player's own read-back can never persist half of it.
  function changeSound(patch) {
    const next = { ...sound, ...patch }
    setSound(next)
    saveVideoSound(next)
  }

  // Nothing is coming out of the player: an explicit mute, or a dial
  // sitting at zero. One word for both, because they are one fact to
  // the learner -- the icon, the dial's reading and the toggle's label
  // all follow it.
  const silent = sound.muted || sound.volume === 0

  function toggleMute() {
    // Unmuting a dial already at zero has to give the learner something
    // to hear, or the button reads as dead.
    if (silent) changeSound({ muted: false, volume: sound.volume || DEFAULT_VIDEO_SOUND.volume })
    else changeSound({ muted: true })
  }

  // Mouse convenience only (aria-hidden on the track): the route line
  // IS the accessible seek control, stop by stop, with real names.
  function seekFromTrack(e) {
    if (!(span > 0)) return
    const r = e.currentTarget.getBoundingClientRect()
    const frac = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width))
    playerRef.current?.seekTo(frac * span)
  }

  // The line, the stage, and the player are three views of ONE
  // position, so they all move through here. A video Passage seeks; a
  // typed or photographed one has no cue times and simply changes stop.
  //
  // Two intents, deliberately separated. Selecting a stop moves the
  // marker and seeks; it does NOT start playback, because clicking a
  // Sentence to read it is not a request to watch. `play()` is left to
  // the player's own control.
  function goToStop(index) {
    analyzer.setFocusIndex(index)
    // A new stop on the desk: the dock follows its first token.
    if (wide) setLookup(null)
    // Choosing by hand means the learner has taken the wheel.
    setFollowPlayback(false)
    heldRef.current = null
    clearHoldTimer()
    const target = sentences[index]
    if (target?.cue_start != null && playerRef.current) {
      playerRef.current.seekTo(target.cue_start)
    }
  }

  // ── The filtered line ─────────────────────────────────────
  // Which stops the route map draws, as {s, i} pairs so a click on the
  // filtered line still selects by the Passage's OWN index -- the
  // focus, the player seek and keepSentence all speak original
  // indices, and a filtered view that renumbered them would keep the
  // wrong sentence.
  function stopMatches(s) {
    if (stopFilter === 'kept' && !analyzer.kept.has(s.text)) return false
    if (stopFilter === 'i1' && (s.foreign || s.unknown_count !== 1)) return false
    if (stopFilter === 'new' && !(s.unknown_count > 0)) return false
    if (stopQuery && !s.text.includes(stopQuery)) return false
    return true
  }
  const visibleStops = sentences
    .map((s, i) => ({ s, i }))
    .filter(({ s }) => stopMatches(s))

  // i+1 in one press. Sequential keepSentence calls, because that is
  // the exact act the pin performs and the pin is already optimistic --
  // a bespoke bulk endpoint would be a second way to keep a Sentence.
  const iPlusOneStops = sentences.filter(s => !s.foreign && s.unknown_count === 1)
  const unkeptIPlusOne = iPlusOneStops.filter(s => !analyzer.kept.has(s.text))
  function keepAllIPlusOne() {
    sentences.forEach((s, i) => {
      if (!s.foreign && s.unknown_count === 1 && !analyzer.kept.has(s.text)) {
        analyzer.keepSentence(i)
      }
    })
  }

  // ── A grammar point's lesson (pauses playback -- opening a rule to
  // read it is a deliberate break from watching, not something that
  // should keep advancing under the learner) ──────────────────────
  function openGrammar(point) {
    const target = grammarLookup(point)
    if (!target) return
    playerRef.current?.pause()
    setLookup(target)
    setSide('card')
  }

  function openHistoryEntry(entry) {
    clearFocus()
    analyzer.openHistoryEntry(entry).then(text => {
      // Only a passage entry resolves with its text (a session resolves
      // with null -- see useAnalyzerSession's openHistoryEntry). The
      // draft is the typed/photo intake's own state; a reopened session
      // has no draft, it has a Passage the poll is already building.
      if (typeof text === 'string') { setDraft(text); setFromImage(false) }
    })
  }

  // The rows of history, reopened where they came from: a row says
  // which platform it belongs to, so the learner does not have to know
  // that a photo passage means "board Photo first".
  function openHistoryFromRow(entry) {
    boardPlatform(entry.kind === 'session' ? 'video' : entry.source === 'image' ? 'photo' : 'text')
    openHistoryEntry(entry)
  }

  const focused = analyzer.focused
  // A token picked on the stage; on the desk the dock follows it, so a
  // door pressed before stops being what the dock shows.
  function walkTo(i) {
    if (wide) setLookup(null)
    setTokenIndex(i)
  }
  // The token on the stage — the one the desk's right column follows.
  // Clamped both ways: a Sentence can legitimately have no tokens, and
  // that must read as nothing in focus, not a white screen.
  const stageTokens = focused?.tokens ?? focused?.words ?? []
  const stageToken = stageTokens[Math.min(tokenIndex, stageTokens.length - 1)] ?? null
  // A row of the desk's words list puts its word in focus (plan 134).
  function selectRow(row) {
    const i = stageTokens.indexOf(row.head)
    if (i !== -1) walkTo(i)
  }

  // One place maps state to copy, so a fifth notice is one entry here
  // rather than a fifth <div> in the render. `tone` is load-bearing: a
  // capped Window and a truncated Passage are FACTS about what was
  // analysed, not failures, and used to be drawn in --danger alongside
  // a real error.
  const notices = []
  if (busy) notices.push({ id: 'busy', tone: 'info', text: t[platform.busy], wait: true })
  if (status === 'failed' && error) notices.push({ id: 'failed', tone: 'bad', text: error })
  if (passage?.windowCapped) notices.push({ id: 'capped', tone: 'info', text: t.windowCapped })
  if (passage?.truncated > 0) notices.push({ id: 'truncated', tone: 'info', text: t.passageTruncated(sentences.length) })

  // What a screen reader hears. Deliberately NOT the notice text: the
  // notices are on screen and can be read at leisure, while the two
  // things that need announcing are the transitions -- work started,
  // and a Passage arrived with this many Sentences.
  const announcement =
    explaining[focusIndex] ? t.explaining
    : explainError[focusIndex] ? explainError[focusIndex]
    : mining.lastOutcome ? (
        mining.lastOutcome.error ? (t.mineFailed ?? "Couldn't add this card.")
        : mining.lastOutcome.count > 0 ? (t.mineAdded ?? 'Added to your deck')
        : (t.mineAlready ?? 'That card was already in the deck')
      )
    : busy ? t[platform.busy]
    : status === 'failed' ? t.analysisFailed
    : ready ? t.passageReady(sentences.length)
    : analyzer.lastDeleted ? t.entryDeleted
    : t[platform.lead]

  const isI1 = !!focused && !focused.foreign && focused.unknown_count === 1
  const isKept = !!focused && analyzer.kept.has(focused.text)

  // The video intake, in the desk's column or a phone's sheet. The
  // walkthrough opens where the screen keeps it: in the column on the
  // desk (plan 120), as a dialog from the sheet on a phone.
  const videoIntake = (
    <IntakeVideo
      t={t}
      url={videoUrl}
      onUrlChange={setVideoUrl}
      onStartFromFile={startVideoFromFile}
      onStartFromLink={startVideoFromLink}
      linkFetch={linkFetch}
      grab={grab}
      onTutorial={() => (wide ? setTutorial(true) : setSheet('tutorial'))}
      tutorialPopup={wide ? undefined : 'dialog'}
      grabUsed={grabUsed}
      dropRef={videoDropRef}
    />
  )
  // A finished Passage waits behind the intake while you are here; this
  // is the way back to it without analysing again.
  const resume = ready && (
    <button type="button" className="btn-secondary anl-resume" onClick={() => setIntakeOpen(false)}>
      {t.analysisResult} · {t.sentencesCount(sentences.length)}
    </button>
  )
  // The intake — the three platforms and the one standing on — beside
  // the learner's passages on the desk (plan 136, the owner's pick C:
  // the passages are the page, the intake the column beside them). A
  // phone has the line over the passages instead, and the video and
  // photo intakes as sheets (below).
  const intake = (
    <>
      {/* ── The three platforms, on one control (canvas Analyzer) ──
          Choosing another is a mode switch: the workbench clears
          (see boardPlatform), because a Passage typed on Text has
          no business waiting behind the Photo bench.

          It commits on the press, with no 扉 over it. The door is
          the bookend to the ticket gate — the last choice of a
          selection screen, the one that turns it into a session —
          and this control is neither: the three intakes sit on one
          segmented control over the page the learner is already
          standing on (plan 073), so a switch changes a panel rather
          than arriving anywhere. Nearly a second of shut doors to
          reveal the same screen with a different field in it read
          as the app stalling, and it is paid every time a learner
          corrects a mis-tap (owner-directed, 2026-09-16). The door
          still plays where boarding is real — kana, vocab, kanji,
          grammar, study, practice, exams. */}
      <Seg
        full
        className="seg--kaiseki anl-sources"
        label={t.changeSource}
        value={source}
        onChange={boardPlatform}
        options={SOURCES.map(s => {
          const Glyph = SOURCE_GLYPHS[s.key]
          return { key: s.key, label: t[s.label], icon: <Glyph size={16} className="seg__opt-icon" /> }
        })}
      />

      {resume}

      <div
        id={`anl-panel-${source}`}
        tabIndex={-1}
        className="anl-panel"
      >
        {/* The intakes are only their own bodies; the panel comes from
            the registry, so a fourth source is one entry there. Its
            opening line went with the column (plan 136): the field's
            placeholder and the one filled action say it. */}
        {source === 'text' && (
          <IntakeText
            t={t}
            value={draft}
            onChange={editDraft}
            onAnalyze={analyzeDraft}
            busy={busy}
          />
        )}
        {source === 'photo' && (
          <IntakePhoto
            t={t}
            session={session}
            value={draft}
            onChange={editDraft}
            onTextRecognized={text => { setDraft(text); setFromImage(true) }}
            onAnalyze={analyzeDraft}
            busy={busy}
            fromImage={fromImage}
            incoming={incomingImage}
          />
        )}
        {source === 'video' && videoIntake}
      </div>
    </>
  )
  const shelf = (
    <PassageShelf
      t={t}
      entries={analyzer.history}
      onOpen={openHistoryFromRow}
      onDelete={entry => analyzer.deleteHistoryEntry(entry)}
      lastDeleted={analyzer.lastDeleted}
      onUndo={analyzer.undoDelete}
      onDismissUndo={analyzer.dismissUndo}
    />
  )

  // ── 机 — the result on three columns (plan 134) ─────────────
  // The owner's drawing (the "Choix" boards of the analyser canvas), with
  // the desk's rail taken away to give it the window: the Passage's
  // sentences over the focused one's grammar, numbered, on the left; the
  // head, then the video, the sentence as its subtitle and the player's
  // bar as one sumi object, then the sentence's words beside the card in
  // focus and Explain, in the middle; the card in focus in the runs' band
  // (plan 126) on the right, Explain standing the explanation in its
  // description's place. One grid, so the grammar's box and the words'
  // row share their top and their foot.
  const deskEntry = lookup ?? tokenLookup(stageToken)
  const explainShown = side === 'explain'
  const hasExplanation = Boolean(focused?.explanation)
  const explainingHere = Boolean(explaining[focusIndex])
  const readable = Boolean(focused) && !focused.foreign && focused.available !== false
  const points = readable ? numberedPointsOf(focused) : []
  const openPoint = light.open(openGrammar)
  // A grammar point pressed is the card in focus until a word is.
  const pointAt = lookup?.category === 'grammar' ? points.findIndex(g => g.raw_id === lookup.id) : -1
  function pressExplain() {
    if (explainShown) { setSide('card'); return }
    setSide('explain')
    if (!hasExplanation && !explainingHere) analyzer.explain(focusIndex)
  }
  const arrow = (dir, disabled, onClick, label) => (
    <button type="button" className="anl-slab__arrow" disabled={disabled} onClick={onClick} aria-label={label}>
      <ChevronIcon direction={dir} size={20} />
    </button>
  )
  const several = sentences.length > 1
  const prevArrow = several && arrow('left', focusIndex === 0, () => goToStop(focusIndex - 1), t.prevSentence)
  const nextArrow = several && arrow('right', focusIndex >= sentences.length - 1, () => goToStop(focusIndex + 1), t.nextSentence)
  const deskResult = focused && (
    <div
      ref={resultsRef}
      className={`anl-results anl-desk${several ? '' : ' anl-desk--one'}${points.length ? '' : ' anl-desk--bare'}`}
      tabIndex={-1}
      role="region"
      aria-label={t.analysisResult}
    >
      {several && (
        <div className="anl-railcol anl-desk__rail">
          {/* ── The working rail head ──
              Search and filters over the stops, with the count
              always visible so a filter that hides everything
              says so ("0 / 47") instead of looking like a lost
              Passage. Client-side: the Passage is in hand. The
              search well (plan 157) steps down from the rail's
              surface, so it is the base well and never the page's. */}
          <div className="anl-railhead">
            <label className="field field--search anl-railhead__well">
              <SearchIcon />
              <input
                type="search"
                className="anl-railhead__search"
                value={stopQuery}
                onChange={e => setStopQuery(e.target.value)}
                placeholder={t.searchPassage}
                aria-label={t.searchPassage}
                lang="ja"
              />
            </label>
            <div className="chip-row anl-chips" role="group" aria-label={t.filterStops}>
              {[
                ['all', t.filterAll],
                ['kept', t.filterKept],
                ['i1', 'i+1'],
                ['new', t.filterHasNew],
              ].map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  className={`chip anl-chip${stopFilter === key ? ' chip--on' : ''}`}
                  aria-pressed={stopFilter === key}
                  onClick={() => setStopFilter(key)}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="anl-railfoot">
              <span
                className="anl-railfoot__count"
                aria-label={t.stopsShown(visibleStops.length, sentences.length)}
              >
                {visibleStops.length} / {sentences.length}
              </span>
              {/* i+1 is the app's highest-value signal, and on a
                  long track keeping each one by hand is N trips
                  down the line. Disabled once they are all kept:
                  the button's job is done and it says so. */}
              {iPlusOneStops.length > 0 && (
                <button
                  type="button"
                  className="anl-ghost"
                  onClick={keepAllIPlusOne}
                  disabled={unkeptIPlusOne.length === 0}
                >
                  {t.keepAllIPlusOne}
                </button>
              )}
            </div>
          </div>
          <PassageLine
            sentences={visibleStops.map(v => v.s)}
            // Position WITHIN the filtered view; -1 when the
            // focused stop is filtered out, which simply draws no
            // current marker -- the stage still shows it.
            activeIndex={visibleStops.findIndex(v => v.i === focusIndex)}
            onSelect={vi => goToStop(visibleStops[vi].i)}
            // The current stop is kept in the rail's middle, whoever
            // moved it -- the clock, the arrows, the keys -- except a
            // stop the pointer pressed, already under the pointer
            // (PassageLine holds that one where it is).
            t={t}
            kept={analyzer.kept}
            onKeep={vi => analyzer.keepSentence(visibleStops[vi].i)}
          />
        </div>
      )}
      {points.length > 0 && (
        <section className="anl-desk__points anl-points" aria-label={t.grammarSpotted}>
          <GrammarPoints analysis={focused} t={t} lit={light.litKey} onLight={light.onLight} onOpen={openPoint} />
        </section>
      )}

      <div className="anl-desk__head">
        <Leave onClick={() => setIntakeOpen(true)}>{t.leaveAnalyzer}</Leave>
        <h1 className="anl-desk__title" lang="ja">{sentences[0]?.text}</h1>
        <button
          type="button"
          className={`anl-head__keep${isKept ? ' anl-head__keep--on' : ''}`}
          aria-pressed={isKept}
          aria-label={isKept ? t.unkeepSentence : t.keepSentence}
          title={isKept ? t.unkeepSentence : t.keepSentence}
          onClick={() => analyzer.keepSentence(focusIndex)}
        >
          {isKept ? <CheckIcon size={16} /> : <PlusIcon size={16} />}
        </button>
      </div>

      <div className={`anl-slab${videoFolded ? ' anl-slab--folded' : ''}`}>
        {playerVideoId && (
          <div className="anl-slab__screen">
            {prevArrow}
            <div className="anl-slab__video">
              <VideoPlayer
                ref={playerRef}
                videoId={playerVideoId}
                volume={sound.volume}
                muted={sound.muted}
                rate={rate}
                onTimeUpdate={handleTimeUpdate}
                onPlayingChange={changePlaying}
                onVolumeChange={changeSound}
                onDurationChange={setDuration}
              />
            </div>
            {nextArrow}
          </div>
        )}
        <div className="anl-subs" data-furigana={furigana}>
          <div className="anl-subs__head">
            <span className="anl-subs__count">
              {focusIndex + 1} / {sentences.length}
              {focused.level ? ` · ${focused.level}` : ''}
              {isI1 && ' · i+1'}
            </span>
            {readable && (
              <button
                type="button"
                className="anl-subs__furi"
                onClick={() => setFurigana(f => FURIGANA[(FURIGANA.indexOf(f) + 1) % FURIGANA.length])}
                aria-label={t.furiganaNow(t[FURIGANA_LABEL[furigana]])}
              >
                <span lang="ja" aria-hidden="true">あ</span>
                <b aria-hidden="true">{t[FURIGANA_LABEL[furigana]]}</b>
              </button>
            )}
          </div>
          <div className="anl-subs__body">
            {!playerVideoId && prevArrow}
            {focused.foreign ? (
              <p className="anl-subs__note">
                <span lang="ja">{focused.text}</span>
                <span>{t.notJapaneseLine}</span>
              </p>
            ) : focused.available === false ? (
              <p className="anl-subs__note">{t.sentenceAnalysisUnavailable}</p>
            ) : (
              <SubtitleLine
                analysis={focused}
                index={tokenIndex}
                setIndex={walkTo}
                lit={light.lit}
                t={t}
                playhead={playerVideoId ? playhead : null}
                playing={playing}
                timing={timing}
              />
            )}
            {!playerVideoId && nextArrow}
          </div>
        </div>
        {playerVideoId && (
          <PlayerBar
            t={t}
            playing={playing}
            onToggle={togglePassagePlayback}
            onPrev={() => goToStop(focusIndex - 1)}
            onNext={() => goToStop(focusIndex + 1)}
            canPrev={focusIndex > 0}
            canNext={focusIndex < sentences.length - 1}
            onReplay={replaySentence}
            canReplay={focused.cue_start != null}
            loop={loop}
            onLoop={() => setLoop(v => !v)}
            pauseEach={pauseEach}
            onPauseEach={() => setPauseEach(v => !v)}
            playhead={playhead}
            span={span}
            onSeek={seekFromTrack}
            rate={rate}
            onRate={nextRate}
            silent={silent}
            onMute={toggleMute}
            follow={followPlayback}
            onFollow={() => setFollowPlayback(f => !f)}
            folded={videoFolded}
            onFold={() => setVideoFolded(v => !v)}
          />
        )}
      </div>

      {readable && (
        <div className="anl-desk__work">
          <section className="anl-desk__words" aria-label={t.wordsInSentence}>
            <WordsList analysis={focused} current={pointAt === -1 ? stageToken : null} onSelect={selectRow} t={t} />
          </section>
          <div className="anl-desk__focus">
            <FocusCard
              analysis={focused}
              token={stageToken}
              point={pointAt === -1 ? null : points[pointAt]}
              number={pointAt + 1}
              mining={mining}
              t={t}
            />
            <button
              type="button"
              className={`anl-explainbtn anl-desk__explain${explainShown ? ' anl-explainbtn--on' : ''}`}
              onClick={pressExplain}
              aria-pressed={explainShown}
            >
              <OpenBookIcon size={14} />
              {explainingHere && !hasExplanation
                ? <>{t.explaining}<Dots /></>
                : explainShown ? t.explanationOpen : t.explainThisSentence}
            </button>
          </div>
        </div>
      )}

      <section className={`desk-entry anl-desk__entry${explainShown ? ' anl-desk__entry--explain' : ''}`} aria-label={t.openDictionary}>
        {deskEntry ? (
          <DictionaryLookupBody
            key={lookupKey(deskEntry)}
            {...deskEntry}
            exact={!lookup}
            session={session}
            mining={mining}
            onExit={lookup ? closeLookup : undefined}
            band
          />
        ) : (
          <p className="anl-desk__none">{t.dockNoEntry}</p>
        )}
        {explainShown && (
          <ExplainPanel
            explanation={focused.explanation}
            explaining={explainingHere}
            error={explainError[focusIndex]}
            onExplain={() => analyzer.explain(focusIndex)}
            t={t}
          />
        )}
        {(hasExplanation || explainShown) && (
          <button
            type="button"
            className="anl-swap"
            onClick={() => setSide(v => (v === 'explain' ? 'card' : 'explain'))}
            aria-pressed={explainShown}
            aria-label={explainShown ? t.showEntry : t.showExplanation}
            title={explainShown ? t.showEntry : t.showExplanation}
          >
            <ChevronIcon direction={explainShown ? 'left' : 'right'} size={16} />
          </button>
        )}
      </section>
    </div>
  )

  // ── 手 — the result on a phone (plan 134) ─────────────────
  // The owner's drawing for every width under the desk: the way back and
  // keep; the video with a trimmed bar under it; the subtitles -- the
  // next sentence over the current one, the previous one under it, both
  // quieter and neither lit, each a tap away; the grammar points,
  // numbered; Explain. A word tapped on the line opens its dictionary
  // card, a point its lesson, both in the dictionary's sheet; Explain
  // opens the explanation in a sheet of the same shape.
  const nextText = sentences[focusIndex + 1]?.text
  const prevText = sentences[focusIndex - 1]?.text
  function openTokenAt(i) {
    const tok = stageTokens[i]
    if (!tok) return
    // A word opens its entry; a particle, the marker it is.
    const target = tokenLookup(tok)
      ?? grammarLookup(points.find(g => g.kind === 'marker' && coversToken(g, tok)))
    if (!target) return
    playerRef.current?.pause()
    setLookup(target)
  }
  function openExplain() {
    playerRef.current?.pause()
    setExplainOpen(true)
    if (!hasExplanation && !explainingHere) analyzer.explain(focusIndex)
  }
  const sideLine = (text, dir, go) => (text
    ? (
      <button type="button" className="anl-m__line" onClick={go} aria-label={`${dir}: ${text}`} lang="ja">
        {text}
      </button>
    )
    : <span className="anl-m__line anl-m__line--none" aria-hidden="true" />)
  const mobileResult = focused && (
    <div
      ref={resultsRef}
      className="anl-results anl-m"
      tabIndex={-1}
      role="region"
      aria-label={t.analysisResult}
    >
      <div className="anl-m__head">
        <Leave onClick={() => setIntakeOpen(true)}>{t.leaveAnalyzer}</Leave>
        <h1 className="sr-only" lang="ja">{sentences[0]?.text}</h1>
        <button
          type="button"
          className={`anl-head__keep${isKept ? ' anl-head__keep--on' : ''}`}
          aria-pressed={isKept}
          aria-label={isKept ? t.unkeepSentence : t.keepSentence}
          title={isKept ? t.unkeepSentence : t.keepSentence}
          onClick={() => analyzer.keepSentence(focusIndex)}
        >
          {isKept ? <CheckIcon size={16} /> : <PlusIcon size={16} />}
        </button>
      </div>

      {playerVideoId && (
        <div className="anl-m__player">
          <div className="anl-m__video">
            <VideoPlayer
              ref={playerRef}
              videoId={playerVideoId}
              volume={sound.volume}
              muted={sound.muted}
              onTimeUpdate={handleTimeUpdate}
              onPlayingChange={changePlaying}
              onVolumeChange={changeSound}
              onDurationChange={setDuration}
            />
          </div>
          <PlayerBar
            compact
            t={t}
            playing={playing}
            // Play takes the line back to the clock: the phone has no
            // 追従 toggle, so a stop picked by hand lets go of it until
            // the learner plays again.
            onToggle={() => { if (!playing) setFollowPlayback(true); togglePassagePlayback() }}
            onPrev={() => goToStop(focusIndex - 1)}
            onNext={() => goToStop(focusIndex + 1)}
            canPrev={focusIndex > 0}
            canNext={focusIndex < sentences.length - 1}
            onReplay={replaySentence}
            canReplay={focused.cue_start != null}
            loop={loop}
            onLoop={() => setLoop(v => !v)}
            playhead={playhead}
            span={span}
            onSeek={seekFromTrack}
          />
        </div>
      )}

      <section className="anl-m__subs" data-furigana={furigana} aria-label={t.stopNumber(focusIndex + 1, sentences.length)}>
        {sideLine(nextText, t.nextSentence, () => goToStop(focusIndex + 1))}
        {focused.foreign ? (
          <p className="anl-m__note">
            <span lang="ja">{focused.text}</span>
            <span>{t.notJapaneseLine}</span>
          </p>
        ) : focused.available === false ? (
          <p className="anl-m__note">{t.sentenceAnalysisUnavailable}</p>
        ) : (
          <SubtitleLine
            analysis={focused}
            index={-1}
            setIndex={openTokenAt}
            lit={light.lit}
            t={t}
            playhead={playerVideoId ? playhead : null}
            playing={playing}
            timing={timing}
          />
        )}
        {sideLine(prevText, t.prevSentence, () => goToStop(focusIndex - 1))}
      </section>

      {points.length > 0 && (
        <section className="anl-m__points anl-points" aria-label={t.grammarSpotted}>
          <GrammarPoints analysis={focused} t={t} lit={light.litKey} onLight={light.onLight} onOpen={openPoint} />
        </section>
      )}

      {readable && (
        <button type="button" className="anl-explainbtn anl-m__explain" onClick={openExplain}>
          <OpenBookIcon size={14} />
          {explainingHere && !hasExplanation ? <>{t.explaining}<Dots /></> : t.explainThisSentence}
        </button>
      )}
    </div>
  )

  return (
    <main id="main-content" className="dictionary analyzer" style={{ '--line-color': KAISEKI }}>
      {!showResult && (
        <Bar
          code={station.code}
          color={KAISEKI}
          title={t.analyzerTitle}
          aside={<Leave to={'/dictionary'}>{t.dictionaryTitle}</Leave>}
        />
      )}

      {!showResult && (wide ? (
        /* 帳 (plan 136, the owner's pick C): the passages are the page and
           the intake stands in the column beside them, drawn at the
           width a phone draws it. A file dropped anywhere on the page is
           taken: subtitles by the video intake, a picture by the photo
           one. */
        <div
          className={`desk-intake${dragging ? ' desk-intake--drop' : ''}`}
          onDragOver={onPageDragOver}
          onDragLeave={onPageDragLeave}
          onDrop={onPageDrop}
        >
          <div className="desk-intake__main">{shelf}</div>
          {/* The grab's walkthrough takes the column while it is open
              (plan 120), the intake back on its ✕ or Esc. The intake
              stays mounted under it, hidden: its link and its section
              are still there, and so is the door the focus goes back
              to. */}
          <DeskSide label={showTutorial ? t.tutTitle : t.newPassage} className="desk-intake__side">
            {showTutorial && (
              <GrabTutorialDock t={t} onClose={closeTutorial} onCopy={grab.copy}
                copied={grab.copied} watchUrl={watchUrlFor(videoUrl)} />
            )}
            <div className="desk-intake__dock" hidden={showTutorial}>
              {intake}
              {/* The notices stand under the intake they are about, in
                  view (plan 123). The live region stays below. */}
              <Notices notices={notices} region={false} />
            </div>
            {dragging && !showTutorial && <p className="desk-intake__drop" aria-hidden="true">{t.dropHere}</p>}
          </DeskSide>
        </div>
      ) : (
        /* Under the desk: the way back to a finished Passage, then one
           line to paste into over the passages (plan 136). */
        <>
          {resume}
          <EntryLine
            t={t}
            value={draft}
            onChange={editDraft}
            onAnalyze={analyzeDraft}
            busy={busy}
            onPhoto={() => openSheet('photo')}
            onFile={file => startVideoFromFile(file, { url: videoUrl })}
          />
        </>
      ))}

      <Notices notices={notices} announcement={announcement} t={t} lines={!(wide && !showResult)} />

      {/* The passages, under the line: a row reopens its Passage on the
          platform it came from. */}
      {!showResult && !wide && shelf}

      {/* A phone's intakes that are not a line of text, as sheets over
          the passages: the video's (a link pasted in the line lands
          here), the photo's, and the grab's walkthrough from the
          video's, which gives the video's back when it closes. */}
      {!showResult && !wide && (
        <>
          {/* A sheet is portalled to the body, out of <main>: the
              station's pigment is set again on what it holds. */}
          <Sheet open={sheet === 'video'} onClose={closeSheet} jp={t.sourceVideo} className="anl-sheet">
            <div id="anl-panel-video" className="anl-panel" style={{ '--line-color': KAISEKI }}>{videoIntake}</div>
          </Sheet>
          <Sheet open={sheet === 'photo'} onClose={closeSheet} jp={t.sourcePhoto} className="anl-sheet">
            <div id="anl-panel-photo" className="anl-panel" style={{ '--line-color': KAISEKI }}>
              <IntakePhoto
                t={t}
                session={session}
                value={draft}
                onChange={editDraft}
                onTextRecognized={text => { setDraft(text); setFromImage(true) }}
                onAnalyze={analyzeDraft}
                busy={busy}
                fromImage={fromImage}
              />
            </div>
          </Sheet>
          {sheet === 'tutorial' && (
            <GrabTutorial t={t} onClose={() => setSheet('video')} onCopy={grab.copy}
              copied={grab.copied} watchUrl={watchUrlFor(videoUrl)} />
          )}
        </>
      )}

      {/* ── The result (canvas AnalyzerResult) ──
          The stepper walks the stops, the line shows the sentence as
          tokens, the card the one on the stage, the dials the view and
          the furigana; the route map with its filters and pins stands
          beside the stage on a wide screen and below it on a phone. A
          video Passage additionally carries the player, whose clock
          moves the same position the stepper reads from. */}
      {showResult && focused && wide && deskResult}

      {showResult && focused && !wide && mobileResult}

      {lookup && !wide && (
        <DictionaryLookupSheet
          key={lookupKey(lookup)}
          {...lookup}
          session={session}
          mining={mining}
          onClose={closeLookup}
        />
      )}

      {explainOpen && !wide && focused && (
        <ExplainSheet
          sentence={focused.text}
          explanation={focused.explanation}
          explaining={explainingHere}
          error={explainError[focusIndex]}
          onExplain={() => analyzer.explain(focusIndex)}
          onClose={closeExplain}
          t={t}
        />
      )}
    </main>
  )
}
