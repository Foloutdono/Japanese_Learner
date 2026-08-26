import { useState, useRef } from 'react'
import { playUi } from '../../lib/audio'
import { parseTimecode, formatTimecode } from '../../lib/timecode'
import { WritingSlip } from './WritingSlip'

// ── 3番線 動画 — the subtitle dock ────────────────────────
// Two ingests, side by side as peers. Paste used to be a <details>
// nested BELOW a second <details> of yt-dlp instructions, which is not a
// hierarchy, it is a filing cabinet -- and it hid a first-class ingest
// (docs/adr/0003 makes the pipeline source-agnostic precisely so paste
// can be one).

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

const INGESTS = [
  { key: 'file',  jp: '字幕ファイル', label: 'ingestFile' },
  { key: 'paste', jp: '貼り付け',     label: 'ingestPaste' },
]

export function IntakeVideo({ t, onStartFromFile, onStartFromTranscript, onError }) {
  const [ingest, setIngest] = useState('file')
  const [url, setUrl] = useState('')
  const [from, setFrom] = useState('0:00')
  const [to, setTo] = useState('3:00')
  const [transcript, setTranscript] = useState('')
  const [dragging, setDragging] = useState(false)
  const fileRef = useRef(null)

  const parsedVideoId = videoIdFrom(url)
  // Shown so "how do I get a JAPANESE .srt" is answered on the screen
  // rather than being left as an exercise. --sub-langs ja is the whole
  // point: it is what stops YouTube handing over an English translation.
  const ytdlpTarget = parsedVideoId ? `https://youtu.be/${parsedVideoId}` : '<video URL>'
  // One line, deliberately: it is meant to be copied and pasted, and a
  // backslash-continued command breaks when pasted into PowerShell.
  const ytdlpCommand =
    'yt-dlp --skip-download --write-subs --write-auto-subs ' +
    `--sub-langs ja --convert-subs srt "${ytdlpTarget}"`
  const ytdlpListCommand = `yt-dlp --list-subs "${ytdlpTarget}"`

  // Parsed at the edge, sent as numbers: routes/video.py does
  // float(form.get("start", 0)) and 400s on anything else.
  const startSec = parseTimecode(from)
  const endSec = parseTimecode(to)
  const windowValid = startSec != null && endSec != null && endSec > startSec
  const span = windowValid ? formatTimecode(endSec - startSec) : null
  const windowOpts = { url, start: startSec ?? 0, end: endSec ?? 0 }

  function startFromTranscript() {
    if (transcript.trim().length < MIN_TRANSCRIPT_CHARS) {
      onError(t.transcriptTooShort)
      return
    }
    onStartFromTranscript(transcript, windowOpts)
  }

  function handleDrop(e) {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer?.files?.[0]
    if (file) onStartFromFile(file, windowOpts)
  }

  return (
    <>
      {/* Two ingests as peers, same roving-tabindex pattern as the
          platform rail above. */}
      <div className="anl-ingest" role="tablist" aria-label={t.intakeVideoLead}>
        {INGESTS.map(g => {
          const active = g.key === ingest
          return (
            <button
              key={g.key}
              type="button"
              role="tab"
              aria-selected={active}
              tabIndex={active ? 0 : -1}
              className="anl-ingest__tab"
              onClick={() => { if (!active) { playUi('click-mode-selection'); setIngest(g.key) } }}
            >
              <span className="anl-ingest__jp" lang="ja">{g.jp}</span>
              <span className="anl-ingest__latin">{t[g.label]}</span>
            </button>
          )
        })}
      </div>

      {ingest === 'file' && (
        <>
          {/* A real drop target. preventDefault on BOTH dragover and drop
              -- without it the browser navigates away to the dropped
              file, which loses whatever the learner had typed. */}
          <div
            className={`anl-drop${dragging ? ' anl-drop--over' : ''}`}
            onDragOver={e => { e.preventDefault(); setDragging(true) }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileRef.current?.click()}
          >
            <span className="anl-drop__jp" lang="ja">字幕</span>
            <span className="anl-drop__lead">{t.dropSubtitles}</span>
            <span className="anl-drop__note">{t.subtitleAccepted}</span>
            {/* Visually hidden rather than display:none, which would take
                it out of the accessibility tree -- same clip pattern as
                .analysis-image-input__file. */}
            <input
              ref={fileRef}
              type="file"
              accept=".srt,.vtt,.ass,.ssa"
              className="anl-drop__input"
              onChange={e => onStartFromFile(e.target.files?.[0], windowOpts)}
            />
          </div>

          <details className="anl-notice">
            <summary>{t.howToGetSubs}</summary>
            <div className="anl-notice__lead">{t.howToGetSubsLead}</div>
            <pre className="anl-notice__cmd">{ytdlpCommand}</pre>
            <div className="anl-notice__lead">{t.howToGetSubsList}</div>
            <pre className="anl-notice__cmd">{ytdlpListCommand}</pre>
            <div className="anl-notice__lead">{t.howToGetSubsNote}</div>
          </details>
        </>
      )}

      {ingest === 'paste' && (
        <>
          <div className="anl-notice">
            <div className="anl-notice__lead">{t.pasteTranscriptHow}</div>
            <ol className="anl-notice__steps">
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

          <WritingSlip
            t={t}
            value={transcript}
            onChange={setTranscript}
            placeholder={'0:00\n…'}
            onSubmit={startFromTranscript}
            submitLabel={t.useTranscript}
          />
        </>
      )}

      {/* A real single-line field. Was .phrase-textarea -- an 18px
          textarea rule, resize: vertical and all, on an <input>. */}
      <label className="anl-field-row">
        <span className="anl-window__label">{t.videoUrlOptional}</span>
        <input
          type="text"
          className="anl-field"
          value={url}
          onChange={e => setUrl(e.target.value)}
          placeholder="https://youtu.be/…"
        />
        <span className="anl-window__readout">{t.videoUrlOptionalHint}</span>
      </label>

      {/* 区間 — the window. Time fields, not number spinners labelled
          "(seconds)": nobody knows the bit they want starts at 154. */}
      <div className="anl-window">
        <label className="anl-window__field">
          <span className="anl-window__label">{t.windowFrom}</span>
          <input
            type="text"
            inputMode="numeric"
            className={`anl-field${startSec == null ? ' anl-field--bad' : ''}`}
            value={from}
            onChange={e => setFrom(e.target.value)}
            placeholder="0:00"
          />
        </label>
        <label className="anl-window__field">
          <span className="anl-window__label">{t.windowTo}</span>
          <input
            type="text"
            inputMode="numeric"
            className={`anl-field${endSec == null ? ' anl-field--bad' : ''}`}
            value={to}
            onChange={e => setTo(e.target.value)}
            placeholder="3:00"
          />
        </label>
        <span className="anl-window__readout">
          {windowValid ? t.windowHint(span) : t.windowFormatHint}
        </span>
      </div>
    </>
  )
}
