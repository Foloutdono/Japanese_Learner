import { useState, useCallback, useRef, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useLang } from '../LangContext'
import { Bar, Leave } from '../components/chrome/Bar'
import { Seg } from '../components/chrome/Console'
import { stationFor } from '../config/stations'
import { SentenceBreakdown } from '../components/analysis/SentenceBreakdown'
import { WordDetail } from '../components/analysis/WordDetail'
import { useMining } from '../components/analysis/useMining'
import { useAnalyzerSession } from '../components/analysis/useAnalyzerSession'
import { IntakeText } from '../components/analysis/IntakeText'
import { IntakePhoto } from '../components/analysis/IntakePhoto'
import { IntakeVideo } from '../components/analysis/IntakeVideo'
import { PassageLine } from '../components/analysis/PassageLine'
import { Notices } from '../components/analysis/Notices'
import { AnalyzerHistory } from '../components/analysis/AnalyzerHistory'
import { sourceFor, SOURCES, DEFAULT_SOURCE } from '../components/analysis/sources'
import { board } from '../stores/boarding'
import { parseVideoId } from '../lib/youtube'
import { apiJson } from '../lib/api'
import { VideoPlayer } from '../components/video/VideoPlayer'
import { formatTimecode } from '../lib/timecode'
import { decodeGrabHash, transcriptXmlToVtt } from '../lib/captionGrab'
import { ChevronIcon, CrossIcon, SpeakerIcon, SpeakerOffIcon } from '../components/ui/Icons'
import { readVideoSound, saveVideoSound, clampVolume, DEFAULT_VIDEO_SOUND } from '../lib/videoVolume'

const KAISEKI = 'var(--line-kaiseki)'
// The stepper's dots: past this many stops the count alone says where
// you are, and the route map below the stage carries every stop.
const MAX_STOP_DOTS = 12

// ── 解析駅 — one station, three platforms ─────────────────
// The merge of PhraseAnalyzerScreen and VideoScreen (plan 027). They
// did one job through two screens: take Japanese from the world, split
// it into Sentences, take each apart. They already shared
// SentenceBreakdown, WordDetail, useMining and the deep tier, and
// duplicated the rest verbatim -- including the comment explaining why
// closeDetail is a useCallback.
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
  const navigate = useNavigate()
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
  const [draft, setDraft] = useState('')
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

  // The transport bar's two readouts. `playing` is the iframe's own
  // truth (VideoPlayer's onPlayingChange), never a boolean kept beside
  // it; `playTime` is the poll the follow logic already rides, kept in
  // state so the playhead can draw. React bails out of the setState
  // while paused (same float every poll), so the 4Hz poll only
  // re-renders while the video actually moves.
  const [playing, setPlaying] = useState(false)
  const [playTime, setPlayTime] = useState(0)
  // 音量 — the player's sound. Read from storage on the first render
  // rather than defaulted and corrected, so a learner who turned a
  // loud track down never meets the next one at full (lib/videoVolume).
  const [sound, setSound] = useState(readVideoSound)
  // The same clock as playTime, readable from closures that must not go
  // stale (the Space handler, the bar's play) without re-binding a
  // listener four times a second.
  const playTimeRef = useRef(0)

  // ── The working rail (the mockup's 司令室 half) ──────────
  // Which stops the route map shows. 'all' | 'kept' | 'i1' | 'new',
  // plus a free-text search within the Passage. Client-side only: the
  // Passage is already in hand, and a fifty-stop subtitle track is
  // exactly the input these exist for.
  const [stopFilter, setStopFilter] = useState('all')
  const [stopQuery, setStopQuery] = useState('')
  // The stage's token view: one at a time (the carousel) or every
  // Token at once (SentenceBreakdown's own 'list' layout).
  const [view, setView] = useState('stepper')
  // ふりがな -- which readings the phrase line shows. 'unknown' is the
  // default on purpose: readings exactly where the SRS says the
  // learner still needs them, bare everywhere they've earned it.
  const [furigana, setFurigana] = useState('unknown')

  const [detail, setDetail] = useState(null) // { title, entry, stats }
  // Stable so WordDetail's useDialog doesn't re-run its focus-on-open
  // effect (and steal focus) on every render of this screen while the
  // detail sheet is open -- see ReadingRun.jsx's closeDetail for the
  // same fix, and plans/README.md's plan-004 note for the bug class
  // this avoids.
  const closeDetail = useCallback(() => setDetail(null), [])

  // Focus lands here when a Passage arrives. It has to be a real focus
  // move, not just a scroll: the Analyze button lives INSIDE the panel
  // that folds away, so hiding it blurs the document to <body> and a
  // keyboard user's next Tab restarts from the top of the page.
  const resultsRef = useRef(null)
  // Raised when a Passage arrives, spent by the effect that focuses the
  // result. See there for why it is a flag and not a frame.
  const wantsResultFocus = useRef(false)

  const { passage, sentences, status, error, focusIndex, explaining, explainError } = analyzer
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
      let vtt
      try {
        vtt = transcriptXmlToVtt(grab.xml)
      } catch {
        analyzer.fail(t.grabEmpty)
        return
      }
      const url = `https://youtu.be/${grab.videoId}`
      boardPlatform('video')
      setVideoUrl(url)
      setDetail(null)
      analyzer.startVideoFromFile(
        new File([vtt], `${grab.videoId}.ja.vtt`, { type: 'text/vtt' }),
        { url },
      )
    })
    return () => { cancelled = true }
    // Mount-only by design: the hash is read once and consumed.
    // boardPlatform/analyzer are stable enough for a one-shot effect,
    // and re-running on their change would re-read a hash already gone.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- id-keyed reset: a new Sentence starts at its first Token, or you land on token 7 of a 3-token line.
    setTokenIndex(0)
  }, [focusIndex, passage])

  useEffect(() => {
    // A NEW Passage starts with the whole line visible. A filter or a
    // search kept from the last one would silently hide stops of a
    // Passage it was never about -- the same stale-state class as the
    // token index above, reset the same way.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- id-keyed reset, keyed off the Passage's identity.
    setStopFilter('all')
    setStopQuery('')
  }, [passage])

  useEffect(() => {
    // A DIFFERENT video means a fresh player: the destroyed one can no
    // longer report its state, and a playhead held over from the last
    // clip would draw a full bar on a player that hasn't started.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- id-keyed reset, keyed off the player's identity.
    setPlaying(false)
    setPlayTime(0)
    playTimeRef.current = 0
  }, [playerVideoId])

  useEffect(() => {
    if (status !== 'ready') return
    // eslint-disable-next-line react-hooks/set-state-in-effect -- a Passage ARRIVING folds the intake away; keyed off a status transition, not off a render-time value.
    setIntakeOpen(false)
    // A NEW Passage follows the clock by default — watching along is
    // the point, and 追従 switched off by a hand-pick on the LAST
    // Passage is not a choice the learner made about this one.
    setFollowPlayback(true)
    wantsResultFocus.current = true
  }, [status, passage])

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
  }, [showResult, passage])

  // ← / → step through the focused Sentence's Tokens, ↑ / ↓ walk the
  // Sentences themselves, Space drives the player — the map the kbd
  // strip under the stage prints. Ignored while typing, or the arrow
  // keys would fight the caret in the writing slip.
  useEffect(() => {
    if (!ready) return undefined
    function onKey(e) {
      const handled = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' ']
      if (!handled.includes(e.key)) return
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
  }, [ready, analyzer.focused, focusIndex, sentences.length, playing, playerVideoId])

  function editDraft(text) {
    setDraft(text)
    setFromImage(false)
  }

  function analyzeDraft() {
    setDetail(null)
    analyzer.analyzeText(draft, { source: fromImage ? 'image' : 'typed' })
  }

  // Every route into a new Passage closes the open detail sheet, not
  // just this one. A WordDetail describes a Token of the Passage that
  // was on screen when it was opened; once a NEW Passage arrives it is
  // describing content the learner has already replaced. analyzeDraft
  // has always done this; the two video ingests did not, which is the
  // only path by which a dialog could still be open when the arrival
  // effect below moves focus to the result -- stealing focus out of a
  // live dialog and silently defeating useDialog's Tab-wrap trap.
  function startVideoFromFile(file, opts) {
    setDetail(null)
    analyzer.startVideoFromFile(file, opts)
  }

  function startVideoFromLink(url, opts) {
    setDetail(null)
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
      setDetail(null)
      setDraft('')
      setFromImage(false)
      setVideoUrl('')
      setPlayTime(0)
      playTimeRef.current = 0
    }
    lastBoardedRef.current = key
    setSource(key)
    setIntakeOpen(true)
    // A fresh player mounts paused; the destroyed one can no longer
    // report its own state, so this is the one boolean reset by hand.
    setPlaying(false)
  }

  // 出場 -- leaving the gate. `reset()` has existed on the hook since
  // the merge and has never had a caller, so the only way back to an
  // empty analyser was to navigate away and return. It also clears the
  // draft and the detail sheet, which the hook cannot see.
  function clearPassage() {
    analyzer.reset()
    setDetail(null)
    setDraft('')
    setFromImage(false)
    setIntakeOpen(true)
    setPlaying(false)
    setPlayTime(0)
    playTimeRef.current = 0
  }

  // ── Playback sync ─────────────────────────────────────────
  const handleTimeUpdate = useCallback(seconds => {
    playTimeRef.current = seconds
    setPlayTime(seconds)
    if (!followPlayback) return
    analyzer.setFocusIndex(prev => {
      const idx = sentences.findIndex(s => seconds >= s.cue_start && seconds < s.cue_end)
      // -1 during the silence between cues: hold the current stop
      // rather than snapping back to the first one.
      return idx === -1 ? prev : idx
    })
  }, [sentences, analyzer, followPlayback])

  // The transport spans the PASSAGE's window, not the whole video: the
  // learner is studying these cues, and a bar scaled to a 2-hour VOD
  // would make a 5-minute window an unusable sliver at its left edge.
  const cued = sentences.filter(s => s.cue_end != null)
  const windowStart = cued.length ? Math.min(...cued.map(s => s.cue_start ?? 0)) : null
  const windowEnd = cued.length ? Math.max(...cued.map(s => s.cue_end)) : null
  const hasWindow = windowStart != null && windowEnd != null && windowEnd > windowStart
  const trackPct = hasWindow
    ? Math.max(0, Math.min(100, (100 * (playTime - windowStart)) / (windowEnd - windowStart)))
    : 0

  // Play means "play the PASSAGE". A window opening at 0:36 on a track
  // that starts at 0:00 left the bar clamped at 0:00 for thirty-six
  // silent seconds — a player that looks dead while doing exactly what
  // it was told. From before the window, seek to its start first; from
  // inside (or past) it, plain play/pause. Reads the ref, not playTime
  // state, so the Space handler's closure can never act on a stale poll.
  function togglePassagePlayback() {
    if (playing) {
      playerRef.current?.pause()
      return
    }
    if (hasWindow && playTimeRef.current < windowStart) {
      playerRef.current?.seekTo(windowStart)
    }
    playerRef.current?.play()
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

  function changeVolume(value) {
    // Reaching for the dial is asking to hear it: moving off zero lifts
    // a mute, rather than leaving a silent player reading 60%.
    const volume = clampVolume(value)
    changeSound({ volume, muted: volume === 0 })
  }

  // Mouse convenience only (aria-hidden on the track): the route line
  // IS the accessible seek control, stop by stop, with real names.
  function seekFromTrack(e) {
    if (!hasWindow) return
    const r = e.currentTarget.getBoundingClientRect()
    const frac = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width))
    playerRef.current?.seekTo(windowStart + frac * (windowEnd - windowStart))
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
    // Choosing by hand means the learner has taken the wheel.
    setFollowPlayback(false)
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

  // ── Word/kanji detail (pauses playback -- tapping a word to look
  // something up is a deliberate break from watching, not something
  // that should keep advancing under the learner) ──────────────────
  function openVocabDetail(word) {
    if (!word.vocab_match) return
    playerRef.current?.pause()
    setDetail({
      title: word.surface,
      reading: word.reading,
      contextMeaning: word.meaning,
      entry: word.vocab_match.entry,
      stats: word.vocab_match.stats,
      level: word.vocab_match.level,
      rawId: word.vocab_match.raw_id,
      kind: 'vocab',
      source: 'vocab',
    })
  }

  function openKanjiDetail(k) {
    playerRef.current?.pause()
    setDetail({
      title: k.kanji,
      entry: k.entry,
      stats: k.stats,
      level: k.level,
      rawId: k.raw_id,
      kind: 'kanji',
      source: 'kanji',
    })
  }

  function openHistoryEntry(entry) {
    setDetail(null)
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

  return (
    <main id="main-content" className="dictionary analyzer" style={{ '--line-color': KAISEKI }}>
      {showResult ? (
        /* ── The result's head ──
           The first sentence names the Passage, the sub counts it and
           grades the stop you are on, Kept says the stop is kept, and
           Clear empties the analyser (see clearPassage). */
        <div className="stage__head anl-head">
          <Leave onClick={() => setIntakeOpen(true)}>{t.leaveAnalyzer}</Leave>
          <span className="stage__where">
            <h1 className="stage__where-jp" lang="ja">{sentences[0]?.text}</h1>
            <span className="stage__where-latin">
              {t.sentencesCount(sentences.length)}
              {focused.level ? ` · ${focused.level}` : ''}
            </span>
          </span>
          {analyzer.kept.has(focused.text) && <span className="anl-kept">{t.keptTitle}</span>}
          <button type="button" className="anl-clear" onClick={clearPassage} aria-label={t.clearPassage} title={t.clearPassageHint}>
            <CrossIcon size={14} />
          </button>
        </div>
      ) : (
        <Bar
          code={station.code}
          color={KAISEKI}
          title={t.analyzerTitle}
          aside={<Leave onClick={() => navigate('/dictionary')}>{t.dictionaryTitle}</Leave>}
        />
      )}

      {!showResult && (
        <>
          {/* ── The three platforms, on one control (canvas Analyzer) ──
              Choosing another is a mode switch: the workbench clears
              (see boardPlatform), because a Passage typed on Text has
              no business waiting behind the Photo bench. */}
          <Seg
            full
            className="seg--kaiseki anl-sources"
            label={t.changeSource}
            value={source}
            onChange={key => board(() => boardPlatform(key))}
            options={SOURCES.map(s => ({ key: s.key, label: t[s.label] }))}
          />

          {/* A finished Passage waits behind the intake while you are
              here; this is the way back to it without analysing again. */}
          {ready && (
            <button type="button" className="btn-secondary anl-resume" onClick={() => setIntakeOpen(false)}>
              {t.analysisResult} · {t.sentencesCount(sentences.length)}
            </button>
          )}

          <div
            id={`anl-panel-${source}`}
            tabIndex={-1}
            className="anl-panel"
          >
            {/* The intakes are only their own bodies; the panel and its
                opening line come from the registry, so a fourth source
                is one entry there. */}
            <p className="hint anl-panel__lead">{t[platform.lead]}</p>

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
              />
            )}
            {source === 'video' && (
              <IntakeVideo
                t={t}
                url={videoUrl}
                onUrlChange={setVideoUrl}
                onStartFromFile={startVideoFromFile}
                onStartFromLink={startVideoFromLink}
                linkFetch={linkFetch}
              />
            )}
          </div>
        </>
      )}

      <Notices notices={notices} announcement={announcement} t={t} />

      {/* History, under the intake: a recent Passage is one tap from the
          field, and a row reopens it on the platform it came from. */}
      {!showResult && (
        <AnalyzerHistory
          t={t}
          entries={analyzer.history}
          onOpen={openHistoryFromRow}
          onDelete={entry => analyzer.deleteHistoryEntry(entry)}
          lastDeleted={analyzer.lastDeleted}
          onUndo={analyzer.undoDelete}
          onDismissUndo={analyzer.dismissUndo}
        />
      )}

      {/* ── The result (canvas AnalyzerResult) ──
          The stepper walks the stops, the line shows the sentence as
          tokens, the card the one on the stage, the dials the view and
          the furigana; the route map with its filters and pins stands
          beside the stage on a wide screen and below it on a phone. A
          video Passage additionally carries the player, whose clock
          moves the same position the stepper reads from. */}
      {showResult && focused && (
        <div
          ref={resultsRef}
          className="anl-results"
          // -1, not 0: this is a focus TARGET for the arrival
          // transition, not a tab stop the learner should have to
          // walk past on every pass through the screen.
          tabIndex={-1}
          role="region"
          aria-label={t.analysisResult}
        >
          <div className="anl-stage" data-furigana={furigana}>
            {sentences.length > 1 && (
              <div className="anl-stepper">
                <button
                  type="button"
                  className="anl-stepper__btn"
                  disabled={focusIndex === 0}
                  onClick={() => goToStop(focusIndex - 1)}
                  aria-label={t.stopNumber(focusIndex, sentences.length)}
                >
                  <ChevronIcon direction="left" size={16} />
                </button>
                {sentences.length <= MAX_STOP_DOTS && (
                  <span className="anl-stops" aria-hidden="true">
                    {sentences.map((_, i) => <i key={i} className={`anl-stops__dot${i <= focusIndex ? ' anl-stops__dot--on' : ''}`} />)}
                  </span>
                )}
                <span className="anl-stepper__count">
                  {focusIndex + 1} / {sentences.length}
                  {isI1 && <> · <i className="anl-stepper__i1">i+1</i></>}
                </span>
                <button
                  type="button"
                  className="anl-stepper__btn"
                  disabled={focusIndex === sentences.length - 1}
                  onClick={() => goToStop(focusIndex + 1)}
                  aria-label={t.stopNumber(focusIndex + 2, sentences.length)}
                >
                  <ChevronIcon direction="right" size={16} />
                </button>
              </div>
            )}

            {playerVideoId && (
              <div className="anl-player">
                <VideoPlayer
                  ref={playerRef}
                  videoId={playerVideoId}
                  volume={sound.volume}
                  muted={sound.muted}
                  onTimeUpdate={handleTimeUpdate}
                  onPlayingChange={setPlaying}
                  // The learner can reach YouTube's own volume slider
                  // under the video; when they do, the bar follows the
                  // player rather than showing a number nothing obeys.
                  onVolumeChange={changeSound}
                />
                {/* The transport bar. Scaled to the Passage's own cue
                    window, and the track is a mouse convenience only
                    (aria-hidden): the route line is the accessible
                    seek, stop by named stop. */}
                <div className="anl-player__bar">
                  <button
                    type="button"
                    className="anl-player__btn"
                    aria-label={playing ? t.pauseVideo : t.playVideo}
                    onClick={togglePassagePlayback}
                  >
                    {playing ? '❚❚' : '▶'}
                  </button>
                  {hasWindow && (
                    <>
                      <div className="anl-player__track" onClick={seekFromTrack} aria-hidden="true">
                        <span className="anl-player__fill" style={{ width: `${trackPct}%` }} />
                      </div>
                      <span className="anl-player__time">
                        {formatTimecode(Math.max(0, playTime - windowStart))} / {formatTimecode(windowEnd - windowStart)}
                      </span>
                    </>
                  )}
                  {/* 音量 — the mute and the dial, one object. Both are
                      here rather than left to the iframe's own bar,
                      which a learner has to hover the video to reach
                      and which vanishes with its controls. The dial
                      does nothing on iOS (the hardware buttons own
                      playback volume there); the mute lands on every
                      platform, which is why they are two controls. */}
                  <div className="anl-player__vol">
                    <button
                      type="button"
                      className="anl-player__btn"
                      aria-pressed={silent}
                      aria-label={silent ? t.unmuteVideo : t.muteVideo}
                      title={silent ? t.unmuteVideo : t.muteVideo}
                      onClick={toggleMute}
                    >
                      {silent ? <SpeakerOffIcon size={16} /> : <SpeakerIcon size={16} />}
                    </button>
                    <input
                      type="range"
                      className="dial anl-player__dial"
                      min={0}
                      max={100}
                      step={5}
                      // A muted player reads zero, whatever number the
                      // dial would otherwise be holding for it.
                      value={silent ? 0 : sound.volume}
                      onChange={e => changeVolume(e.target.value)}
                      aria-label={t.videoVolume}
                      // Without this a screen reader announces a bare
                      // number with no unit -- the same fix the exam
                      // player's scrubber carries.
                      aria-valuetext={t.videoVolumePct(silent ? 0 : sound.volume)}
                    />
                  </div>
                  <button
                    type="button"
                    className={`anl-follow${followPlayback ? ' anl-follow--on' : ''}`}
                    aria-pressed={followPlayback}
                    onClick={() => setFollowPlayback(f => !f)}
                  >
                    <span className="anl-follow__label">{t.followPlayback}</span>
                  </button>
                </div>
              </div>
            )}

            {/* A line the app cannot take apart -- a Korean verse, an
                English ad-lib. It is still part of the track the
                learner is reading along with, so it is shown as it
                appears in the file and simply says why there is no
                breakdown under it. */}
            {focused.foreign ? (
              <div className="anl-foreign">
                <p className="anl-foreign__text">{focused.text}</p>
                <p className="anl-foreign__note">{t.notJapaneseLine}</p>
              </div>
            ) : focused.available === false ? (
              <div className="anl-notice-line anl-notice-line--bad">{t.sentenceAnalysisUnavailable}</div>
            ) : (
              <>
                {/* One Token at a time on the stage (the card), or every
                    Token at once as the table. Both are the same 'stage'
                    layout: the line and the dials stay put, only the
                    half below them switches. */}
                <SentenceBreakdown
                  analysis={focused}
                  t={t}
                  layout="stage"
                  tokenView={view}
                  onJumpToToken={i => { setTokenIndex(i); setView('stepper') }}
                  index={tokenIndex}
                  setIndex={setTokenIndex}
                  onTokenClick={openVocabDetail}
                  onKanjiClick={openKanjiDetail}
                  mining={mining}
                  controls={
                    /* ── The stage's two dials ──
                       Furigana: readings over everything, only over
                       words the SRS hasn't mastered (the default), or
                       none — applied by the data-furigana attribute on
                       the stage, so one rule governs every line inside
                       it. View: the card or the full token table. */
                    <div className="anl-dials">
                      <div className="anl-dial">
                        <span className="cap anl-dial__cap">{t.furiganaCap}</span>
                        <Seg
                          full
                          className="seg--kaiseki"
                          label={t.furiganaLabel}
                          value={furigana}
                          onChange={setFurigana}
                          options={[
                            { key: 'all', label: t.furiganaAll },
                            { key: 'unknown', label: t.furiganaUnknown },
                            { key: 'none', label: t.furiganaNone },
                          ]}
                        />
                      </div>
                      <div className="anl-dial">
                        <span className="cap anl-dial__cap">{t.viewLabel}</span>
                        <Seg
                          full
                          className="seg--kaiseki"
                          label={t.viewLabel}
                          value={view}
                          onChange={setView}
                          options={[
                            { key: 'stepper', label: t.viewStepper },
                            { key: 'table', label: t.viewTable },
                          ]}
                        />
                      </div>
                    </div>
                  }
                />
                {/* The control does not disappear once an explanation
                    exists. The backend caches per (phrase, lang), so a
                    learner who switches interface language can get the
                    explanation in the new one -- and it used to be
                    unreachable, because the only affordance was gated
                    on `!focused.explanation`. The explanation TEXT
                    lives here too, above the control that bought it. */}
                <div className="anl-explainbox">
                  {focused.explanation && (
                    <p className="anl-explain__body">{focused.explanation}</p>
                  )}
                  <div className="anl-explain">
                    <span className={`hint anl-explain__hint${explainError[focusIndex] ? ' anl-explain__hint--bad' : ''}`}>
                      {explainError[focusIndex]
                        ? explainError[focusIndex]
                        : focused.explanation
                          ? t.explanationBought
                          : t.noExplanationYet}
                    </span>
                    <button
                      type="button"
                      onClick={() => analyzer.explain(focusIndex)}
                      disabled={!!explaining[focusIndex]}
                      className="btn-secondary anl-explain__btn"
                    >
                      {explaining[focusIndex]
                        ? t.explaining
                        : focused.explanation
                          ? t.explainAgain
                          : t.explainSentence}
                    </button>
                  </div>
                </div>
                {/* The keyboard map — the stage IS a keyboard instrument
                    on a desktop, and nothing else on the screen says
                    so. Hidden on a phone (index.css). */}
                <div className="anl-kbd" aria-hidden="true">
                  <span><kbd>←</kbd><kbd>→</kbd> {t.kbdToken}</span>
                  <span><kbd>↑</kbd><kbd>↓</kbd> {t.kbdSentence}</span>
                  {playerVideoId && <span><kbd>Space</kbd> {t.kbdPlay}</span>}
                </div>
              </>
            )}
          </div>

          {/* A route diagram of one stop is a joke at the reader's
              expense -- below the threshold the stage takes the column
              on its own. */}
          {sentences.length > 1 && (
            <div className="anl-railcol">
              {/* ── The working rail head ──
                  Search and filters over the stops, with the count
                  always visible so a filter that hides everything
                  says so ("0 / 47") instead of looking like a lost
                  Passage. Client-side: the Passage is in hand. */}
              <div className="anl-railhead">
                <input
                  type="search"
                  className="field field--page anl-railhead__search"
                  value={stopQuery}
                  onChange={e => setStopQuery(e.target.value)}
                  placeholder={t.searchPassage}
                  aria-label={t.searchPassage}
                  lang="ja"
                />
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
                // Only auto-scroll when something OTHER than the learner
                // is moving the marker. A stop they just clicked is
                // already under their pointer; scrolling it "into view"
                // moves the list out from under them.
                scrollOnChange={playerVideoId ? followPlayback : false}
                t={t}
                kept={analyzer.kept}
                onKeep={vi => analyzer.keepSentence(visibleStops[vi].i)}
              />
            </div>
          )}
        </div>
      )}

      {detail && (
        <WordDetail detail={detail} t={t} onClose={closeDetail} mining={mining} />
      )}
    </main>
  )
}
