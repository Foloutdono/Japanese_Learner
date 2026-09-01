import { useState, useCallback, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLang } from '../LangContext'
import { TopBar } from '../components/ui/TopBar'
import { StationHeader } from '../components/station/StationHeader'
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
import { sourceFor, SOURCES } from '../components/analysis/sources'
import SelectionScreen from '../components/selection/SelectionScreen'
import ModeSelector from '../components/selection/ModeSelector'
import { board } from '../stores/boarding'
import { useMediaQuery } from '../hooks/useMediaQuery'
import { parseVideoId } from '../lib/youtube'
import { VideoPlayer } from '../components/video/VideoPlayer'
import { formatTimecode } from '../lib/timecode'
import { relativeDate } from '../lib/formatDate'

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
// bench and the subtitle dock -- and since the selection-screen gate
// replaced the tab rail, exactly one of them is ever mounted: the
// platform the learner boarded at のりば.
export default function AnalyzerScreen({ session }) {
  const navigate = useNavigate()
  const { t, lang } = useLang()
  const mining = useMining(session)
  const analyzer = useAnalyzerSession(session)
  const playerRef = useRef(null)

  // 'text' | 'photo' | 'video' -- which platform the learner is standing
  // on, or null before they have chosen one. Null means the learner is
  // still on the concourse: the screen renders the same SelectionScreen
  // every other section boards through (see the gate below), and the
  // workbench only mounts once a platform card is picked. Changing
  // source afterwards goes back through that gate (the stub strip's
  // one affordance for it); the Passage survives the trip either way,
  // because it belongs to the hook, not to a platform.
  const [source, setSource] = useState(null)
  // The last platform actually boarded, surviving the trip through the
  // gate (where `source` is null) — what boardPlatform compares
  // against to tell a mode SWITCH (clear the workbench) from a
  // same-mode round trip (keep it).
  const lastBoardedRef = useRef(null)

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
  // detail sheet is open -- see ReadingScreen.jsx's closeDetail for the
  // same fix, and plans/README.md's plan-004 note for the bug class
  // this avoids.
  const closeDetail = useCallback(() => setDetail(null), [])

  // Focus lands here when a Passage arrives. It has to be a real focus
  // move, not just a scroll: the Analyze button lives INSIDE the panel
  // that folds away, so hiding it blurs the document to <body> and a
  // keyboard user's next Tab restarts from the top of the page.
  const resultsRef = useRef(null)

  const { passage, sentences, status, error, focusIndex, explaining, explainError } = analyzer
  const busy = status === 'working'
  const ready = status === 'ready' && Boolean(analyzer.focused)

  // The player needs an id, not a session: prefer the link the learner
  // has typed right now, fall back to whatever the session was created
  // with. This is what makes a link pasted AFTER an upload work.
  const playerVideoId = parseVideoId(videoUrl) ?? passage?.videoId ?? null
  // The platform standing on. Everything about it -- its name, its
  // panel's opening line, whether 運行履歴 applies -- comes from the one
  // registry, so a fourth source is one entry there rather than five
  // edits spread across two files. See components/analysis/sources.js.
  const platform = sourceFor(source)

  // The route diagram stands beside the stage when there is room for
  // both, and stacks above it when there is not — the CSS split at
  // 1100px handles that on its own (the mockup's one drawing at every
  // width; the strip orientation is retired). This flag survives for
  // the one thing that is not pure CSS: WordDetail's sheet-vs-panel
  // choice.
  const wide = useMediaQuery('(min-width: 1100px)')

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
    // Next frame: the results region does not exist in the DOM until
    // this render commits, and focusing a node that is not there yet is
    // a silent no-op.
    const id = requestAnimationFrame(() => {
      // Never pull focus out of an open dialog. Step 2a removes the one
      // path that could leave one open across a new Passage, so this is
      // belt-and-braces -- but a focus move that fights a focus trap is
      // the kind of bug that is invisible until someone is navigating by
      // keyboard, and the guard costs one query.
      if (document.querySelector('[role="dialog"]')) return
      resultsRef.current?.focus()
    })
    return () => cancelAnimationFrame(id)
  }, [status, passage])

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

  function startVideoFromTranscript(text, opts) {
    setDetail(null)
    analyzer.startVideoFromTranscript(text, opts)
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
    if (lastBoardedRef.current !== null && lastBoardedRef.current !== key) {
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

  // ── のりば案内 — the mode selection, as a real selection screen ──
  // The same shell every other section boards through: station plate
  // overhead (SelectionScreen derives 解析 and its 葡萄色 from the
  // route), platform cards below, the door on the choice. This is the
  // ONLY way onto a platform -- the workbench's stub strip states
  // where you boarded and offers the way back here, replacing the
  // in-place tab rail the mockup retired.
  //
  // The cards are deliberately plain-language-first: the localized
  // name as the title, the localized hint as the line under it, no
  // Japanese specimen and no 番線 caption (a decided call — the
  // learner picking an intake shouldn't need vocabulary to do it).
  //
  // Below every hook on purpose (rules of hooks), and above the
  // notice/announcement block, which dereferences `platform` — a
  // registry lookup this branch has no key for yet.
  if (!source) {
    // The learner's own record on each platform, derived from the
    // merged history the hook already fetches: sessions are the video
    // platform's, image-sourced passages the photo's, the rest typed.
    // This is the right-hand column the density contract asks a
    // 440px+ card to earn — real figures, not decoration.
    const bySource = key => analyzer.history.filter(h => (
      key === 'video'
        ? h.kind === 'session'
        : h.kind === 'passage' && (key === 'photo' ? h.source === 'image' : h.source !== 'image')
    ))

    // Reopening from the concourse is boarding + opening in one act:
    // the row says which platform it came from, so the learner does
    // not have to know that a 写 stamp means "board Photo first".
    function openHistoryFromGate(entry) {
      boardPlatform(entry.kind === 'session' ? 'video' : entry.source === 'image' ? 'photo' : 'text')
      openHistoryEntry(entry)
    }

    return (
      <div className="screen">
        <TopBar onBack={() => navigate('/')} title={t.analyzerTitle} autoHide />
        <main id="main-content">
          <SelectionScreen>
            <ModeSelector
              unit={false}
              modes={SOURCES.map(s => {
                const rows = bySource(s.key)
                return {
                  key: s.key,
                  label: t[s.label],
                  desc: t[s.hint],
                  jp: s.jp,
                  aside: (
                    <>
                      <span className="platform-card__figure">
                        <span className="platform-card__num">{rows.length}</span>
                        <span className="platform-card__cap">{t.passagesCap}</span>
                      </span>
                      {rows[0]?.createdAt && (
                        <span className="platform-card__figure">
                          <span className="platform-card__num platform-card__num--date">
                            {relativeDate(rows[0].createdAt, lang, t)}
                          </span>
                          <span className="platform-card__cap">{t.lastUsedCap}</span>
                        </span>
                      )}
                    </>
                  ),
                }
              })}
              onSelect={key => board(() => boardPlatform(key))}
            />
            {/* 運行履歴 on the concourse, not under the workbench: a
                recent Passage is one tap from the front door, and a
                row reopens it on the platform it came from. */}
            <div className="anl-concourse">
              <AnalyzerHistory
                t={t}
                entries={analyzer.history}
                onOpen={openHistoryFromGate}
                onDelete={entry => analyzer.deleteHistoryEntry(entry)}
                lastDeleted={analyzer.lastDeleted}
                onUndo={analyzer.undoDelete}
                onDismissUndo={analyzer.dismissUndo}
              />
            </div>
          </SelectionScreen>
        </main>
      </div>
    )
  }

  const focused = analyzer.focused

  // One place maps state to copy, so a fifth notice is one entry here
  // rather than a fifth <div> in the render. `tone` is load-bearing: a
  // capped Window and a truncated Passage are FACTS about what was
  // analysed, not failures, and used to be drawn in --danger alongside
  // a real error.
  const notices = []
  if (busy) notices.push({ id: 'busy', tone: 'info', text: t[platform.busy] })
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

  return (
    <div className="screen">
      {/* Back steps out to the platform choice, not straight home —
          the same one-layer-at-a-time retreat every other section's
          selection flow makes. The Passage survives the trip AS LONG
          AS the learner re-boards the same platform; picking a
          different one is a mode switch and starts fresh (see
          boardPlatform). */}
      <TopBar onBack={() => setSource(null)} title={t.analyzerTitle} />

      <main id="main-content" className="container page-pad analyzer">
        <StationHeader />

        {/* ── The boarding stub ──
            Where you boarded, as a fact rather than a menu: the choice
            was made at the gate, so up here it is one plate and the
            ways out. 乗換 goes back through the gate (the Passage
            survives a same-platform round trip; boarding a DIFFERENT
            platform clears the workbench — see boardPlatform); 出場
            clears; the reopen affordance appears only once a result
            has folded the intake away, which is the only time it has
            a job. */}
        <div className="anl-stub">
          <span className="anl-stub__plate">
            <span className="anl-stub__no">{t.platformNumber(platform.no)}</span>
            <span className="anl-stub__name">{t[platform.label]}</span>
            <span className="anl-stub__jp" lang="ja">{platform.jp}</span>
          </span>
          <span className="anl-stub__spacer" aria-hidden="true" />
          {ready && !intakeOpen && (
            <button
              type="button"
              className="anl-ghost anl-stub__reopen"
              onClick={() => setIntakeOpen(true)}
            >
              {t.reopenIntake}
            </button>
          )}
          <button
            type="button"
            className="anl-ghost anl-stub__change"
            onClick={() => setSource(null)}
          >
            {t.changeSource}
          </button>
          {(status !== 'idle' || draft) && (
            <button
              type="button"
              className="anl-ghost anl-stub__clear"
              onClick={clearPassage}
              title={t.clearPassageHint}
            >
              {t.clearPassage}
            </button>
          )}
        </div>

        <div
          id={`anl-panel-${source}`}
          tabIndex={-1}
          className="anl-panel"
          hidden={ready && !intakeOpen}
        >
          {/* The panel and its head are the same object on all three
              platforms, so they live here and take their name and their
              opening line from the registry. The intakes below are only
              their own bodies. */}
          <div className="anl-intake__head">
            <span className="anl-intake__jp" lang="ja">{platform.jp}</span>
            <span className="anl-intake__lead">{t[platform.lead]}</span>
          </div>

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
              onStartFromTranscript={startVideoFromTranscript}
              onError={analyzer.fail}
            />
          )}
        </div>

        <Notices notices={notices} announcement={announcement} t={t} />

        {/* ── 路線図 — the Passage as a line ──
            One drawing for all three sources (plan 028). The line is
            every Sentence as a stop; the stage is the one you are
            standing at. A video Passage additionally carries the player,
            whose clock moves the same position the line reads from. */}
        {status === 'ready' && focused && (
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
                    className="anl-railhead__search"
                    value={stopQuery}
                    onChange={e => setStopQuery(e.target.value)}
                    placeholder={t.searchPassage}
                    aria-label={t.searchPassage}
                    lang="ja"
                  />
                  <div className="anl-chips" role="group" aria-label={t.filterStops}>
                    {[
                      ['all', t.filterAll],
                      ['kept', t.filterKept],
                      ['i1', 'i+1'],
                      ['new', t.filterHasNew],
                    ].map(([key, label]) => (
                      <button
                        key={key}
                        type="button"
                        className="anl-chip"
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

            <div className="anl-stage" data-furigana={furigana}>
              {playerVideoId && (
                <div className="anl-player">
                  <VideoPlayer
                    ref={playerRef}
                    videoId={playerVideoId}
                    onTimeUpdate={handleTimeUpdate}
                    onPlayingChange={setPlaying}
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
                    <button
                      type="button"
                      className={`anl-follow${followPlayback ? ' anl-follow--on' : ''}`}
                      aria-pressed={followPlayback}
                      onClick={() => setFollowPlayback(f => !f)}
                    >
                      <span className="anl-follow__label">{t.followPlayback}</span>
                      <span className="anl-follow__jp" lang="ja">追従</span>
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
                <div className="anl-panel anl-notice-line anl-notice-line--bad">{t.sentenceAnalysisUnavailable}</div>
              ) : (
                <>
                  {/* One Token at a time on the stage (the mockup's
                      arrangement — the dials sit BETWEEN the sentence
                      pane and the card, so they are handed to the
                      breakdown as its `controls` slot), or every Token
                      at once as the mockup's table. Both are the same
                      'stage' layout: the sentence pane and the dials
                      stay put, only the half below them switches. */}
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
                         View: carousel or the full token list.
                         Furigana: readings over everything, only over
                         words the SRS hasn't mastered (the default),
                         or none — applied by the data-furigana
                         attribute on the stage, so one rule governs
                         every phrase line inside it. */
                      <div className="anl-stagectl">
                        <div className="anl-stagectl__group">
                          <span className="anl-stagectl__label" id="anl-view-label">{t.viewLabel}</span>
                          <div className="anl-seg" role="group" aria-labelledby="anl-view-label">
                            {[
                              ['stepper', t.viewStepper],
                              ['table', t.viewTable],
                            ].map(([key, label]) => (
                              <button
                                key={key}
                                type="button"
                                className="anl-seg__opt"
                                aria-pressed={view === key}
                                onClick={() => setView(key)}
                              >
                                {label}
                              </button>
                            ))}
                          </div>
                        </div>
                        <div className="anl-stagectl__group">
                          <span className="anl-stagectl__label" id="anl-furigana-label">{t.furiganaLabel}</span>
                          <div className="anl-seg" role="group" aria-labelledby="anl-furigana-label">
                            {[
                              ['all', t.furiganaAll],
                              ['unknown', t.furiganaUnknown],
                              ['none', t.furiganaNone],
                            ].map(([key, label]) => (
                              <button
                                key={key}
                                type="button"
                                className="anl-seg__opt"
                                aria-pressed={furigana === key}
                                onClick={() => setFurigana(key)}
                              >
                                {label}
                              </button>
                            ))}
                          </div>
                        </div>
                        <span className="anl-stagectl__meta">
                          {t.tokensCount(focused.tokens?.length ?? 0)}
                          {focused.level ? ` · ${focused.level}` : ''}
                        </span>
                      </div>
                    }
                  />
                  {/* The control does not disappear once an explanation
                      exists. The backend caches per (phrase, lang), so a
                      learner who switches interface language can get the
                      explanation in the new one -- and it used to be
                      unreachable, because the only affordance was gated
                      on `!focused.explanation`.

                      The explanation TEXT lives here too, above the
                      control that bought it (the mockup's explain__body)
                      — not inside the sentence pane, which holds the
                      sentence and nothing else. */}
                  <div className="anl-panel anl-explainbox">
                    {focused.explanation && (
                      <p className="anl-explain__body">{focused.explanation}</p>
                    )}
                    <div className="anl-explain">
                      <span className={`anl-explain__hint${explainError[focusIndex] ? ' anl-explain__hint--bad' : ''}`}>
                        {explainError[focusIndex]
                          ? explainError[focusIndex]
                          : focused.explanation
                            ? t.explanationBought
                            : t.noExplanationYet}
                      </span>
                      <button
                        onClick={() => analyzer.explain(focusIndex)}
                        disabled={!!explaining[focusIndex]}
                        className="anl-ghost anl-explain__btn"
                      >
                        {explaining[focusIndex]
                          ? t.explaining
                          : focused.explanation
                            ? t.explainAgain
                            : t.explainSentence}
                      </button>
                    </div>
                  </div>
                  {/* The keyboard map, printed the way the mockup does:
                      the stage IS a keyboard instrument, and nothing
                      else on the screen says so. */}
                  <div className="anl-kbd" aria-hidden="true">
                    <span><kbd>←</kbd><kbd>→</kbd> {t.kbdToken}</span>
                    <span><kbd>↑</kbd><kbd>↓</kbd> {t.kbdSentence}</span>
                    {playerVideoId && <span><kbd>Space</kbd> {t.kbdPlay}</span>}
                  </div>
                </>
              )}

            </div>
          </div>
        )}

        {/* 運行履歴 lives on the concourse now (the selection screen
            above), where a recent Passage is one tap from the front
            door — not below a finished analysis where finding it
            meant scrolling past the very thing it would replace. */}
      </main>

      {detail && (
        // The screen has computed `wide` since plan 030; WordDetail has
        // supported a side panel since the merge. They were never wired
        // together, so a 27-inch monitor got a phone bottom sheet.
        <WordDetail detail={detail} t={t} isMobile={!wide} onClose={closeDetail} mining={mining} />
      )}
    </div>
  )
}
