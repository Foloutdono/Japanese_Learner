import { useState, useRef } from 'react'
import { parseTimecode, formatTimecode } from '../../lib/timecode'
import { parseVideoId } from '../../lib/youtube'
import { buildBookmarklet } from '../../lib/captionGrab'
import { GrabTutorial } from './GrabTutorial'

// ── 3番線 動画 — the subtitle dock ────────────────────────
// Two ways in, in the order they should be tried:
//
//   1. 字幕取り — the bookmarklet the app mints (lib/captionGrab.js,
//      where the measurements live). It runs ON the YouTube page —
//      the one origin where captions are still fetchable — grabs the
//      Japanese track and comes back here through the URL hash.
//      Works on phones: a bookmark is the one programmable thing a
//      mobile browser allows.
//   2. A subtitle file, dropped or picked. The accept list carries
//      MIME types alongside extensions on purpose: Android's picker
//      matches by MIME, and `.srt`/`.vtt` map to none, so the
//      extension-only list greyed out every file on mobile — the
//      "they don't let you use these types of files" report.
//
// The transcript-paste ingest is GONE (owner-directed, 2026-09-01):
// YouTube's transcript panel hands out a translation by default —
// learners kept getting English for Japanese videos — and the panel
// is genuinely hard to find. The yt-dlp instructions went with it;
// DownSub, pre-filled with the pasted link, is the no-install
// fallback for anything the bookmarklet cannot reach.

export function IntakeVideo({ t, url, onUrlChange, onStartFromFile }) {
  // The Window is OPTIONAL and blank by default -- the whole Track is
  // the sensible thing to study, and MAX_SENTENCES already bounds the
  // work. See docs/adr/0003's 2026-08-27 amendment.
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [dragging, setDragging] = useState(false)
  const [copied, setCopied] = useState(false)
  const [showTutorial, setShowTutorial] = useState(false)
  const fileRef = useRef(null)
  const copiedTimer = useRef(null)

  const parsedVideoId = parseVideoId(url)
  const watchUrl = parsedVideoId ? `https://www.youtube.com/watch?v=${parsedVideoId}` : null
  const downsubHref = watchUrl
    ? `https://downsub.com/?url=${encodeURIComponent(watchUrl)}`
    : 'https://downsub.com/'

  // Parsed at the edge; the API takes numbers or nothing at all. A blank
  // field is not an error -- it means "no bound that side".
  const startSec = parseTimecode(from)
  const endSec = parseTimecode(to)
  const startBad = from.trim() !== '' && startSec == null
  const endBad = to.trim() !== '' && endSec == null
  const backwards = startSec != null && endSec != null && endSec <= startSec
  const span = startSec != null && endSec != null && !backwards
    ? formatTimecode(endSec - startSec)
    : null
  const windowOpts = { url, start: startSec, end: endSec }

  // Copy, not drag: React (rightly) refuses javascript: hrefs, and on
  // a phone there is nothing to drag to anyway — copy → new bookmark
  // → paste is the flow that works everywhere.
  async function copyBookmarklet() {
    try {
      await navigator.clipboard.writeText(buildBookmarklet(window.location.origin))
      setCopied(true)
      clearTimeout(copiedTimer.current)
      copiedTimer.current = setTimeout(() => setCopied(false), 2400)
    } catch {
      // Clipboard refused (permissions, insecure context) — the
      // button simply doesn't confirm, and the file path remains.
    }
  }

  function handleDrop(e) {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer?.files?.[0]
    if (file) onStartFromFile(file, windowOpts)
  }

  return (
    <>
      {/* The link leads: it names the video for the player, opens the
          right page for the bookmarklet, and pre-fills DownSub. */}
      <label className="anl-field-row">
        <span className="anl-window__label">{t.videoUrlOptional}</span>
        <input
          type="text"
          className="field field--panel anl-field"
          value={url}
          onChange={e => onUrlChange(e.target.value)}
          placeholder="https://youtu.be/…"
        />
        <span className="anl-window__readout">{t.videoUrlOptionalHint}</span>
      </label>

      {/* ── 字幕取り — the grab ── */}
      <div className="anl-grab">
        <div className="anl-grab__head">
          <span className="anl-grab__title">{t.grabTitle}</span>
          <span className="anl-grab__jp" lang="ja">字幕取り</span>
        </div>
        <p className="anl-grab__lead">{t.grabLead}</p>
        <div className="anl-grab__row">
          <button type="button" className="anl-action anl-grab__copy" onClick={copyBookmarklet}>
            {copied ? t.bookmarkletCopied : t.copyBookmarklet}
          </button>
          {/* The real walkthrough — what a bookmarklet is, and how to
              save one on THIS device — lives in a dialog, because the
              honest version is too long to sit in an intake panel. */}
          <button
            type="button"
            className="anl-ghost anl-grab__tutorial"
            onClick={() => setShowTutorial(true)}
          >
            {t.grabTutorialBtn}
          </button>
          {watchUrl && (
            <a
              className="anl-ghost anl-grab__open"
              href={watchUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              {t.openOnYoutube}
            </a>
          )}
          <a
            className="anl-ghost anl-grab__downsub"
            href={downsubHref}
            target="_blank"
            rel="noopener noreferrer"
            title={t.downsubHint}
          >
            {t.downsubAlt}
          </a>
        </div>
      </div>

      {showTutorial && (
        <GrabTutorial
          t={t}
          onClose={() => setShowTutorial(false)}
          onCopy={copyBookmarklet}
          copied={copied}
          watchUrl={watchUrl}
        />
      )}

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
          accept=".srt,.vtt,.ass,.ssa,text/vtt,text/plain,text/*,application/octet-stream"
          className="anl-drop__input"
          onChange={e => onStartFromFile(e.target.files?.[0], windowOpts)}
        />
      </div>

      {/* 区間 — optional. Blank means the whole Track, which is what
          almost everybody wants; MAX_SENTENCES bounds the work either
          way. */}
      <details className="anl-notice anl-window-set">
        <summary>{t.windowLabel}</summary>
        <div className="anl-window">
          <label className="anl-window__field">
            <span className="anl-window__label">{t.windowFrom}</span>
            <input
              type="text"
              inputMode="numeric"
              className={`field field--panel anl-field${startBad ? ' anl-field--bad' : ''}`}
              value={from}
              onChange={e => setFrom(e.target.value)}
              placeholder={t.windowWhole}
            />
          </label>
          <label className="anl-window__field">
            <span className="anl-window__label">{t.windowTo}</span>
            <input
              type="text"
              inputMode="numeric"
              className={`field field--panel anl-field${endBad || backwards ? ' anl-field--bad' : ''}`}
              value={to}
              onChange={e => setTo(e.target.value)}
              placeholder={t.windowWhole}
            />
          </label>
          <span className="anl-window__readout">
            {backwards ? t.windowBackwards : (span ? t.windowSpan(span) : t.windowFormatHint)}
          </span>
        </div>
      </details>
    </>
  )
}
