import { useState, useCallback, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLang } from '../LangContext'
import { TopBar } from '../components/ui/TopBar'
import { StationHeader } from '../components/station/StationHeader'
import { SectionHeader } from '../components/ui/SectionHeader'
import { SentenceBreakdown } from '../components/analysis/SentenceBreakdown'
import { WordDetail } from '../components/analysis/WordDetail'
import { useMining } from '../components/analysis/useMining'
import { useAnalyzerSession } from '../components/analysis/useAnalyzerSession'
import { SourceRail } from '../components/analysis/SourceRail'
import { IntakeText } from '../components/analysis/IntakeText'
import { IntakePhoto } from '../components/analysis/IntakePhoto'
import { IntakeVideo } from '../components/analysis/IntakeVideo'
import { PassageLine } from '../components/analysis/PassageLine'
import { NextStop } from '../components/analysis/NextStop'
import { AnalyzerHistory } from '../components/analysis/AnalyzerHistory'
import { sourceFor, DEFAULT_SOURCE } from '../components/analysis/sources'
import { useMediaQuery } from '../hooks/useMediaQuery'
import { parseVideoId } from '../lib/youtube'
import { VideoPlayer } from '../components/video/VideoPlayer'

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
// three intakes below the rail are 改札口 (plan 029) -- the writing
// slip, the photo bench and the subtitle dock.
export default function AnalyzerScreen({ session }) {
  const navigate = useNavigate()
  const { t } = useLang()
  const mining = useMining(session)
  const analyzer = useAnalyzerSession(session)
  const playerRef = useRef(null)

  // 'text' | 'photo' | 'video' -- which platform the learner is standing
  // on. Only the state of the RAIL: the Passage below it belongs to the
  // hook, so switching platform to check something never throws away a
  // finished analysis.
  const [source, setSource] = useState(DEFAULT_SOURCE)

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

  const [detail, setDetail] = useState(null) // { title, entry, stats }
  // Stable so WordDetail's useDialog doesn't re-run its focus-on-open
  // effect (and steal focus) on every render of this screen while the
  // detail sheet is open -- see ReadingScreen.jsx's closeDetail for the
  // same fix, and plans/README.md's plan-004 note for the bug class
  // this avoids.
  const closeDetail = useCallback(() => setDetail(null), [])

  const { passage, sentences, status, error, focusIndex, explaining } = analyzer
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

  // The route diagram stands up beside the stage only when there is
  // room for both (plan 030). Below that it lies down as the stopping-
  // pattern band above a train door. One component, two orientations,
  // so nothing can disagree about where you are. The 1100px bound is
  // the same complementary integer pair .dict-dock uses -- see the
  // @media block in index.css for why it earns a one-off.
  const wide = useMediaQuery('(min-width: 1100px)')

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- id-keyed reset: a new Sentence starts at its first Token, or you land on token 7 of a 3-token line.
    setTokenIndex(0)
  }, [focusIndex, passage])

  useEffect(() => {
    if (status !== 'ready') return
    // eslint-disable-next-line react-hooks/set-state-in-effect -- a Passage ARRIVING folds the intake away; keyed off a status transition, not off a render-time value.
    setIntakeOpen(false)
  }, [status, passage])

  // ← / → step through the focused Sentence's Tokens, the way reading
  // practice does. Ignored while typing, or the arrow keys would fight
  // the caret in the writing slip.
  useEffect(() => {
    if (!ready) return undefined
    function onKey(e) {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
      const el = document.activeElement
      const tag = el?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || el?.isContentEditable) return
      // The platform rail owns its own arrows (roving tabindex).
      if (el?.getAttribute?.('role') === 'tab') return
      e.preventDefault()
      const last = (analyzer.focused?.tokens?.length ?? 1) - 1
      setTokenIndex(i => e.key === 'ArrowRight'
        ? Math.min(last, i + 1)
        : Math.max(0, i - 1))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [ready, analyzer.focused])

  function editDraft(text) {
    setDraft(text)
    setFromImage(false)
  }

  function analyzeDraft() {
    setDetail(null)
    analyzer.analyzeText(draft, { source: fromImage ? 'image' : 'typed' })
  }

  // ── Playback sync ─────────────────────────────────────────
  const handleTimeUpdate = useCallback(seconds => {
    analyzer.setFocusIndex(prev => {
      const idx = sentences.findIndex(s => seconds >= s.cue_start && seconds < s.cue_end)
      // -1 during the silence between cues: hold the current stop
      // rather than snapping back to the first one.
      return idx === -1 ? prev : idx
    })
  }, [sentences, analyzer])

  // The line, the stage, 次は and the player are four views of ONE
  // position, so they all move through here. A video Passage seeks; a
  // typed or photographed one has no cue times and simply changes stop.
  function goToStop(index) {
    analyzer.setFocusIndex(index)
    const target = sentences[index]
    if (target?.cue_start != null && playerRef.current) {
      playerRef.current.seekTo(target.cue_start)
      playerRef.current.play()
    }
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

  function loadHistoryEntry(id) {
    setDetail(null)
    analyzer.loadHistoryEntry(id).then(text => {
      if (typeof text === 'string') { setDraft(text); setFromImage(false) }
    })
  }

  const focused = analyzer.focused

  return (
    <div className="screen">
      <TopBar onBack={() => navigate('/')} title={t.analyzerTitle} />

      <main id="main-content" className="container page-pad analyzer">
        <StationHeader />

        <SourceRail value={source} onChange={setSource} t={t} />

        {/* Folded once a Passage is ready: the breakdown is what the
            learner came for, and a full-height writing slip above it was
            pushing the result off the screen. */}
        {ready && !intakeOpen && (
          <button
            type="button"
            className="anl-panel anl-reopen"
            onClick={() => setIntakeOpen(true)}
          >
            <span className="anl-reopen__jp" lang="ja">{platform.jp}</span>
            <span className="anl-reopen__label">{t.changeSource}</span>
            <span className="anl-reopen__go" aria-hidden="true">▾</span>
          </button>
        )}

        <div
          id={`anl-panel-${source}`}
          role="tabpanel"
          aria-labelledby={`anl-tab-${source}`}
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
              onStartFromFile={(file, opts) => analyzer.startVideoFromFile(file, opts)}
              onStartFromTranscript={(text, opts) => analyzer.startVideoFromTranscript(text, opts)}
              onError={analyzer.fail}
            />
          )}
        </div>

        {busy && (
          <div className="anl-panel anl-status">{t.analyzing}</div>
        )}

        {status === 'failed' && error && (
          <div className="anl-panel anl-status anl-status--bad">{error}</div>
        )}

        {passage?.windowCapped && (
          <div className="anl-panel anl-status anl-status--bad">{t.windowCapped}</div>
        )}

        {passage?.truncated > 0 && (
          <div className="anl-panel anl-status anl-status--bad">
            {typeof t.passageTruncated === 'function'
              ? t.passageTruncated(sentences.length)
              : t.passageTruncated}
          </div>
        )}

        {/* ── 路線図 — the Passage as a line ──
            One drawing for all three sources (plan 028). The line is
            every Sentence as a stop; the stage is the one you are
            standing at. A video Passage additionally carries the player,
            whose clock moves the same position the line reads from. */}
        {status === 'ready' && focused && (
          <div className="anl-results">
            {/* A route diagram of one stop is a joke at the reader's
                expense -- below the threshold the stage takes the column
                on its own. */}
            {sentences.length > 1 && (
              <PassageLine
                sentences={sentences}
                activeIndex={focusIndex}
                onSelect={goToStop}
                orientation={wide ? 'vertical' : 'strip'}
                t={t}
              />
            )}

            <div className="anl-stage">
              {playerVideoId && (
                <div className="anl-player">
                  <VideoPlayer ref={playerRef} videoId={playerVideoId} onTimeUpdate={handleTimeUpdate} />
                </div>
              )}

              <SectionHeader
                jp="現在の停車駅"
                title={t.currentStop}
                count={sentences.length > 1
                  ? `${focusIndex + 1} / ${sentences.length}`
                  : t.stopsInPassage(sentences.length)}
              />

              {focused.available === false ? (
                <div className="card phrase-error-card">{t.sentenceAnalysisUnavailable}</div>
              ) : (
                <>
                  {/* One Token at a time, ← / → to step -- the same
                      carousel reading practice uses, instead of a wall
                      of Token cards under every Sentence. */}
                  <SentenceBreakdown
                    analysis={focused}
                    t={t}
                    layout="stepper"
                    index={tokenIndex}
                    setIndex={setTokenIndex}
                    onTokenClick={openVocabDetail}
                    onKanjiClick={openKanjiDetail}
                    mining={mining}
                  />
                  {!focused.explanation && (
                    <div className="anl-explain">
                      <span className="anl-explain__hint">{t.noExplanationYet}</span>
                      <button
                        onClick={() => analyzer.explain(focusIndex)}
                        disabled={!!explaining[focusIndex]}
                        className="anl-action"
                      >
                        {explaining[focusIndex] ? t.explaining : t.explainSentence}
                      </button>
                    </div>
                  )}
                </>
              )}

              <NextStop
                sentences={sentences}
                activeIndex={focusIndex}
                onAdvance={() => goToStop(focusIndex + 1)}
                t={t}
              />
            </div>
          </div>
        )}

        {/* 運行履歴 — its own panel under its own heading, below the
            result rather than a button sharing a row with Analyze.
            Hidden on 動画 because nothing lists video sessions; see
            AnalyzerHistory.jsx. */}
        {platform.history && (
          <AnalyzerHistory
            t={t}
            entries={analyzer.history}
            onOpen={loadHistoryEntry}
            onDelete={id => analyzer.deleteHistoryEntry(id)}
          />
        )}
      </main>

      {detail && (
        <WordDetail detail={detail} t={t} onClose={closeDetail} mining={mining} />
      )}
    </div>
  )
}
