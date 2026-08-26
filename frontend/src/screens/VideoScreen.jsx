import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiJson, apiUpload } from '../lib/api'
import { useLang } from '../LangContext'
import { TopBar } from '../components/ui/TopBar'
import { SentenceBreakdown } from '../components/analysis/SentenceBreakdown'
import { WordDetail } from '../components/analysis/WordDetail'
import { useMining } from '../components/analysis/useMining'
import { VideoPlayer } from '../components/video/VideoPlayer'
import { Transcript } from '../components/video/Transcript'

const POLL_MS = 1200

// Enough to be a real transcript rather than a stray line, low enough
// that a short clip still qualifies. Guards the obvious mistake of
// pasting only the URL into both fields.
const MIN_TRANSCRIPT_CHARS = 12

// Client-side twin of study/captions.py's _YOUTUBE_URL_RES, used only to
// build the "Open on YouTube" convenience link next to the paste
// instructions. The BACKEND remains the authority on whether a URL is
// acceptable -- this never gates submission, so the two drifting apart
// costs a missing link, not a rejected video.
const YOUTUBE_ID_RES = [
  /(?:youtube\.com\/watch\?(?:.*&)?v=|youtube\.com\/shorts\/)([A-Za-z0-9_-]{11})/,
  /youtu\.be\/([A-Za-z0-9_-]{11})/,
]

function videoIdFrom(url) {
  for (const re of YOUTUBE_ID_RES) {
    const m = re.exec(url)
    if (m) return m[1]
  }
  return null
}

// The single unknown Token in an i+1 Sentence -- mirrors
// study/analysis.py's _CONTENT_POS + unknown_count predicate exactly,
// same as components/analysis/SentenceBreakdown.jsx's own
// isUnknownToken (duplicated rather than imported: that one isn't
// exported, and this screen needs it for a different purpose --
// picking WHICH sentence is active-worthy isn't relevant here, only
// the transcript's own i+1 flag, already computed by Transcript from
// unknown_count directly).

export default function VideoScreen({ session }) {
  const navigate = useNavigate()
  const { t, lang } = useLang()
  const mining = useMining(session)
  const playerRef = useRef(null)

  // 'setup' | 'loading' | 'ready' | 'failed'
  const [stage, setStage] = useState('setup')
  const [url, setUrl] = useState('')
  const [windowStart, setWindowStart] = useState('0')
  const [windowEnd, setWindowEnd] = useState('180')
  const [transcript, setTranscript] = useState('')
  const [error, setError] = useState(null)
  const [isYoutubeError, setIsYoutubeError] = useState(false)

  const [sessionId, setSessionId] = useState(null)
  const [sessionInfo, setSessionInfo] = useState(null) // { source, sourceRef, windowCapped, truncated }
  const [sentences, setSentences] = useState([])
  const [activeIndex, setActiveIndex] = useState(0)
  const [explaining, setExplaining] = useState({})
  const [detail, setDetail] = useState(null)
  const closeDetail = useCallback(() => setDetail(null), [])

  // ── Session creation ──────────────────────────────────────
  async function startFromUrl() {
    if (!url.trim()) return
    setStage('loading')
    setError(null)
    try {
      const data = await apiJson('/api/video/session', session, {
        method: 'POST',
        body: JSON.stringify({ url: url.trim(), start: Number(windowStart), end: Number(windowEnd) }),
      })
      setSessionId(data.sessionId)
    } catch (e) {
      setStage('setup')
      setError(e.message || t.captionsUnavailable)
    }
  }

  // The ingest that cannot be IP-blocked. YouTube blocks datacenter IPs
  // for its caption endpoints and this backend deploys to Render, so the
  // URL path above fails in production for reasons nothing here can fix
  // -- but the learner's own browser already rendered the transcript, so
  // pasting it works every time. See plans/025 and docs/adr/0003.
  async function startFromTranscript() {
    if (!url.trim() || transcript.trim().length < MIN_TRANSCRIPT_CHARS) {
      setError(t.transcriptTooShort)
      return
    }
    setStage('loading')
    setError(null)
    try {
      const data = await apiJson('/api/video/session', session, {
        method: 'POST',
        body: JSON.stringify({
          url: url.trim(), transcript: transcript.trim(),
          start: Number(windowStart), end: Number(windowEnd),
        }),
      })
      setSessionId(data.sessionId)
    } catch (e) {
      setStage('setup')
      // Surface the parser's own message: it says what was wrong with
      // the paste, which is the useful thing. A generic failure here
      // would leave the learner with nothing to act on.
      setError((e.body && e.body.detail) || e.message)
    }
  }

  async function startFromFile(file) {
    if (!file) return
    setStage('loading')
    setError(null)
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('start', String(Number(windowStart)))
      formData.append('end', String(Number(windowEnd)))
      const data = await apiUpload('/api/video/session', session, formData)
      setSessionId(data.sessionId)
    } catch (e) {
      setStage('setup')
      setError(e.message || t.subtitleTooLarge)
    }
  }

  // ── Polling ───────────────────────────────────────────────
  useEffect(() => {
    if (sessionId == null) return
    let cancelled = false

    async function poll() {
      try {
        const data = await apiJson(`/api/video/session/${sessionId}`, session)
        if (cancelled) return
        setSessionInfo({
          source: data.source, sourceRef: data.sourceRef,
          windowCapped: data.windowCapped, truncated: data.truncated,
        })
        setSentences(data.sentences)
        setStage('ready')
      } catch (e) {
        if (cancelled) return
        if (e.status === 202) {
          setTimeout(poll, POLL_MS)
          return
        }
        setStage('failed')
        setError((e.body && e.body.error) || e.message)
        setIsYoutubeError(Boolean(e.body && e.body.isYoutube))
      }
    }
    poll()
    return () => { cancelled = true }
  }, [sessionId, session])

  // ── Playback sync ─────────────────────────────────────────
  const handleTimeUpdate = useCallback(seconds => {
    setActiveIndex(prev => {
      const idx = sentences.findIndex(s => seconds >= s.cue_start && seconds < s.cue_end)
      return idx === -1 ? prev : idx
    })
  }, [sentences])

  function seekTo(index) {
    setActiveIndex(index)
    const target = sentences[index]
    if (target && playerRef.current) {
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
      title: word.surface, reading: word.reading, contextMeaning: word.meaning,
      entry: word.vocab_match.entry, stats: word.vocab_match.stats, level: word.vocab_match.level,
      rawId: word.vocab_match.raw_id, kind: 'vocab', source: 'vocab',
    })
  }

  function openKanjiDetail(k) {
    playerRef.current?.pause()
    setDetail({
      title: k.kanji, entry: k.entry, stats: k.stats, level: k.level,
      rawId: k.raw_id, kind: 'kanji', source: 'kanji',
    })
  }

  // ── Explain (deep tier, one Sentence, never the whole session) ───
  function explainActiveSentence() {
    if (explaining[activeIndex]) return
    setExplaining(prev => ({ ...prev, [activeIndex]: true }))
    apiJson(`/api/video/session/${sessionId}/sentence/${activeIndex}/explain`, session, {
      method: 'POST',
      body: JSON.stringify({ lang }),
    })
      .then(explained => {
        setSentences(prev => prev.map((s, i) => (i === activeIndex ? explained : s)))
      })
      .catch(() => {})
      .finally(() => {
        setExplaining(prev => ({ ...prev, [activeIndex]: false }))
      })
  }

  // One implementation, two call sites: the setup stage offers paste as
  // a first-class option, and the failure state below drops the learner
  // straight into it with their URL still filled in. Duplicating the
  // markup would let the two drift.
  function pastePanel() {
    return (
      <>
        <label className="video-setup__label video-setup__label--paste">
          {t.pasteTranscript}
        </label>
        <div className="video-setup__how">
          <div className="video-setup__how-lead">{t.pasteTranscriptHow}</div>
          <ol className="video-setup__how-steps">
            <li>
              {t.pasteTranscriptStep1}
              {parsedVideoId && (
                <> — <a
                  href={`https://www.youtube.com/watch?v=${parsedVideoId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >{t.openOnYoutube}</a></>
              )}
            </li>
            <li>{t.pasteTranscriptStep2}</li>
            <li>{t.pasteTranscriptStep3}</li>
          </ol>
        </div>
        <textarea
          value={transcript}
          onChange={e => setTranscript(e.target.value)}
          rows={5}
          className="phrase-textarea"
          placeholder={'0:00\n…'}
        />
        <div className="phrase-input-actions">
          <button
            onClick={startFromTranscript}
            disabled={!url.trim() || !transcript.trim()}
            className="phrase-analyze-btn"
          >
            {t.useTranscript}
          </button>
        </div>
      </>
    )
  }

  const active = sentences[activeIndex]
  const parsedVideoId = videoIdFrom(url)

  return (
    <div className="screen">
      <TopBar onBack={() => navigate('/')} title={t.videoTitle ?? 'Video'} />

      <main id="main-content" className="container page-pad">

        {stage === 'setup' && (
          <div className="card phrase-input-card">
            <label className="video-setup__label">{t.pasteVideoUrl ?? 'Paste a YouTube link'}</label>
            <input
              type="text"
              value={url}
              onChange={e => setUrl(e.target.value)}
              placeholder="https://youtu.be/…"
              className="phrase-textarea"
            />
            <div className="video-setup__window-row">
              <label>
                {t.windowStart ?? 'Start (seconds)'}
                <input type="number" min="0" value={windowStart} onChange={e => setWindowStart(e.target.value)} />
              </label>
              <label>
                {t.windowEnd ?? 'End (seconds)'}
                <input type="number" min="0" value={windowEnd} onChange={e => setWindowEnd(e.target.value)} />
              </label>
            </div>
            <div className="phrase-input-actions">
              <button onClick={startFromUrl} disabled={!url.trim()} className="phrase-analyze-btn">
                {t.loadVideo ?? 'Load'}
              </button>
            </div>

            {/* Paste sits directly under the URL box, above upload, on
                purpose: it is the path that actually works in production
                (see plans/025), so the ordering says so. */}
            {pastePanel()}

            <label className="video-setup__label video-setup__label--upload">
              {t.uploadSubtitles ?? 'Or upload a subtitle file'}
            </label>
            <input
              type="file"
              accept=".srt,.vtt,.ass,.ssa"
              onChange={e => startFromFile(e.target.files?.[0])}
            />

            {error && <div className="card phrase-error-card">{error}</div>}
          </div>
        )}

        {stage === 'loading' && (
          <div className="card phrase-input-card">{t.analyzing ?? 'Analyzing the subtitles…'}</div>
        )}

        {/* Not a dead end. The server cannot fetch captions from a
            datacenter IP -- that is about WHERE the request came from,
            not about the video -- and the paste ingest right here works
            every time. The URL is deliberately NOT cleared, so the
            learner retypes nothing. See plans/026. */}
        {stage === 'failed' && (
          <div className="card phrase-input-card">
            <div className="video-failed__lead">
              {isYoutubeError ? t.captionsServerBlocked : t.captionsUnavailable}
            </div>
            {error && <div className="video-failed__detail">{error}</div>}

            {isYoutubeError ? (
              <>
                <div className="video-failed__keep-url">{t.captionsTryPaste}</div>
                {pastePanel()}
                <label className="video-setup__label video-setup__label--upload">
                  {t.uploadSubtitles}
                </label>
                <input
                  type="file"
                  accept=".srt,.vtt,.ass,.ssa"
                  onChange={e => startFromFile(e.target.files?.[0])}
                />
              </>
            ) : (
              <div className="phrase-input-actions">
                <button onClick={() => setStage('setup')} className="phrase-analyze-btn">
                  {t.back ?? '←'}
                </button>
              </div>
            )}
          </div>
        )}

        {stage === 'ready' && (
          <>
            {sessionInfo?.windowCapped && (
              <div className="card phrase-error-card">{t.windowCapped ?? 'The window was capped at 5 minutes.'}</div>
            )}
            {sessionInfo?.truncated > 0 && (
              <div className="card phrase-error-card">
                {typeof t.passageTruncated === 'function'
                  ? t.passageTruncated(sentences.length)
                  : t.passageTruncated}
              </div>
            )}

            {/* 'paste' embeds the player too: a pasted transcript still
                carries the video id in sourceRef, and the IFrame API runs
                in the learner's browser on their own IP -- only the
                server-side caption FETCH is datacenter-blocked, never
                playback. 'upload' is the one source with no video. */}
            {(sessionInfo?.source === 'youtube' || sessionInfo?.source === 'paste') && (
              <VideoPlayer ref={playerRef} videoId={sessionInfo.sourceRef} onTimeUpdate={handleTimeUpdate} />
            )}

            {active && (
              <>
                <SentenceBreakdown
                  analysis={active}
                  t={t}
                  layout="list"
                  onTokenClick={openVocabDetail}
                  onKanjiClick={openKanjiDetail}
                  mining={mining}
                />
                {!active.explanation && (
                  <div className="phrase-explain-row">
                    <button
                      onClick={explainActiveSentence}
                      disabled={!!explaining[activeIndex]}
                      className="phrase-analyze-btn"
                    >
                      {explaining[activeIndex] ? (t.explaining ?? 'Explaining…') : (t.breakThisDown ?? 'Break this down')}
                    </button>
                  </div>
                )}
              </>
            )}

            <div className="video-transcript-label">{t.transcript ?? 'Transcript'}</div>
            <Transcript sentences={sentences} activeIndex={activeIndex} onSeek={seekTo} t={t} />
          </>
        )}
      </main>

      {detail && <WordDetail detail={detail} t={t} onClose={closeDetail} mining={mining} />}
    </div>
  )
}
