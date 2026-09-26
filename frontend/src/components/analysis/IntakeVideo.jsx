import { useState, useRef, useEffect } from 'react'
import { parseTimecode, formatTimecode } from '../../lib/timecode'
import { parseVideoId } from '../../lib/youtube'
import { VideoStill } from './VideoStill'
import { useBookmarkletCopy, watchUrlFor } from './useBookmarkletCopy'
import { isNative } from '../../lib/platform'
import { GrabTutorial } from './GrabTutorial'
import { useDesk } from '../../hooks/useDesk'
import { composing } from '../../lib/keyGuards'

// ── 3番線 動画 — the subtitle dock ────────────────────────
// Three ways in, in the order they should be tried:
//
//   0. The link alone — the server fetches the Japanese track through
//      a residential proxy (docs/adr/0003, 2026-09-10). CONDITIONAL:
//      it appears only where /api/video/capabilities says the proxy
//      is configured, because it is a paid credential that decides,
//      not the code. Where it is on, it is the only thing the learner
//      has to do, and it is the one route that also works inside the
//      native shell, where a bookmarklet has no bookmarks bar to live
//      in.
//   1. 字幕取り — the bookmarklet the app mints (lib/captionGrab.js,
//      where the measurements live). It runs ON the YouTube page —
//      the one origin where captions are still fetchable — grabs the
//      Japanese track and comes back here through the URL hash.
//      Works on phones: a bookmark is the one programmable thing a
//      mobile browser allows.
//   2. A subtitle file, picked here or dropped anywhere on the desk's
//      page (AnalyzerScreen). The accept list carries MIME types
//      alongside extensions on purpose: Android's picker matches by
//      MIME, and `.srt`/`.vtt` map to none, so the extension-only list
//      greyed out every file on mobile — the "they don't let you use
//      these types of files" report.
//
// 1 and 2 never move: they cost nothing, cannot be blocked, and are
// what 0 degrades TO. Nothing here is gated behind the paid path.
//
// The column (plan 136, the owner's pick C): the link, the video's
// still once the link names one, ONE filled action, the file, and a
// quiet line of the rest. The paragraph that explained the bookmark on
// every visit is gone; which action is filled says it instead:
//
//   the server can fetch the link   ->  Get the subtitles
//   the bookmark has never been used ->  Set up the bookmark (the
//                                        walkthrough, where the copy is)
//   otherwise                        ->  Open on YouTube, then the
//                                        bookmark there
//
// `grabUsed` is the screen's (a passage has arrived by the bookmark).
// `onTutorial` opens the walkthrough where the screen keeps it -- the
// desk's column, or a dialog on a phone; without it (a bare mount) the
// walkthrough is this panel's own dialog. `grab` is the copy state the
// screen shares with that walkthrough, and `tutorialPopup` says what
// the screen's opens ('dialog' on a phone, nothing in the desk's column).
// `dropRef` is the screen's hold
// on this panel's file ingest, for a file dropped anywhere on the desk's
// page: it is cut to the window set here, as one chosen here is.
export function IntakeVideo({ t, url, onUrlChange, onStartFromFile, onStartFromLink, linkFetch, grab, onTutorial, tutorialPopup, grabUsed = false, dropRef }) {
  // The Window is OPTIONAL and blank by default -- the whole Track is
  // the sensible thing to study, and MAX_SENTENCES already bounds the
  // work. See docs/adr/0003's 2026-08-27 amendment.
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [windowOpen, setWindowOpen] = useState(false)
  const own = useBookmarkletCopy()
  const { copied, copy: copyBookmarklet } = grab ?? own
  const [showTutorial, setShowTutorial] = useState(false)
  const fileRef = useRef(null)

  const parsedVideoId = parseVideoId(url)
  const watchUrl = watchUrlFor(url)
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
  useEffect(() => {
    if (!dropRef) return undefined
    dropRef.current = file => onStartFromFile(file, { url, start: startSec, end: endSec })
    return () => { dropRef.current = null }
  })
  // 机 (plan 123): Enter in the link field analyses the link, as the
  // text platform's Ctrl/⌘+Enter does -- only where the button it
  // presses is drawn.
  const desk = useDesk()
  const canFetch = Boolean(linkFetch && parsedVideoId)
  const grabbable = !isNative()
  const startLink = () => onStartFromLink(url, { start: startSec, end: endSec })
  const onUrlKey = desk && canFetch
    ? e => {
      if (e.key !== 'Enter' || e.repeat || composing(e) || e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return
      e.preventDefault()
      startLink()
    }
    : undefined
  const openTutorial = () => (onTutorial ? onTutorial() : setShowTutorial(true))
  const popup = onTutorial ? tutorialPopup : 'dialog'

  // Which of the three is the one filled action (see the head).
  const lead = canFetch ? 'fetch' : !grabbable ? 'file' : grabUsed ? 'open' : 'install'

  const openLink = (className, children) => (
    <a className={className} href={watchUrl ?? 'https://www.youtube.com/'} target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  )
  const installDoor = (className, children) => (
    <button type="button" className={className} onClick={openTutorial} aria-haspopup={popup}>
      {children}
    </button>
  )

  return (
    <>
      {/* The link leads: it names the video for the player, opens the
          right page for the bookmark, and pre-fills DownSub. Its
          placeholder is a link, which is its label on screen; the name
          is for a reader. */}
      <label className="anl-field-row">
        <input
          type="text"
          className="field field--page anl-field"
          value={url}
          onChange={e => onUrlChange(e.target.value)}
          onKeyDown={onUrlKey}
          placeholder="https://youtu.be/…"
          aria-label={t.videoUrlOptional}
        />
      </label>

      <VideoStill videoId={parsedVideoId} frame="anl-still" className="anl-still__img" />

      {lead === 'fetch' && (
        <div className="anl-link">
          <button
            type="button"
            className="btn-primary"
            onClick={startLink}
            aria-keyshortcuts={desk ? 'Enter' : undefined}
          >
            {t.analyzeThisLink}
            {desk && <kbd className="desk-kbd" aria-hidden="true">{t.keyEnter}</kbd>}
          </button>
        </div>
      )}
      {lead === 'install' && (
        <div className="anl-link">
          {installDoor('btn-primary anl-grab__tutorial', t.grabInstall)}
          <p className="anl-link__say">{t.grabInstallSay}</p>
        </div>
      )}
      {lead === 'open' && (
        <div className="anl-link">
          {openLink('btn-primary anl-grab__open', t.openOnYoutube)}
          <p className="anl-link__say">{t.grabThenSay}</p>
        </div>
      )}

      {/* A real file input, clipped rather than display:none (which
          would take it out of the accessibility tree), pressed by the
          button: the one control that reads the same on a phone and on
          a desk, where the page takes a dropped file too. */}
      <button
        type="button"
        className={`${lead === 'file' ? 'btn-primary' : 'btn-secondary'} anl-file`}
        onClick={() => fileRef.current?.click()}
        title={t.subtitleAccepted}
      >
        {t.chooseSubtitles}
      </button>
      <input
        ref={fileRef}
        type="file"
        accept=".srt,.vtt,.ass,.ssa,text/vtt,text/plain,text/*,application/octet-stream"
        className="anl-drop__input"
        tabIndex={-1}
        aria-hidden="true"
        onChange={e => onStartFromFile(e.target.files?.[0], windowOpts)}
      />

      {/* The rest, quiet, on one line. The bookmark's door stays here
          once it is no longer the filled action: a second device needs
          it again. */}
      <p className="anl-vlinks">
        {grabbable && lead !== 'install' && installDoor('anl-vlink anl-grab__tutorial', t.grabInstallLink)}
        {grabbable && lead === 'install' && openLink('anl-vlink anl-grab__open', t.openOnYoutube)}
        <a className="anl-vlink anl-grab__downsub" href={downsubHref} target="_blank" rel="noopener noreferrer" title={t.downsubHint}>
          DownSub
        </a>
        <button type="button" className="anl-vlink anl-window-toggle" aria-expanded={windowOpen} onClick={() => setWindowOpen(o => !o)}>
          {t.windowLabel}
        </button>
      </p>

      {grabbable && showTutorial && (
        <GrabTutorial
          t={t}
          onClose={() => setShowTutorial(false)}
          onCopy={copyBookmarklet}
          copied={copied}
          watchUrl={watchUrl}
        />
      )}

      {/* 区間 — optional. Blank means the whole Track, which is what
          almost everybody wants; MAX_SENTENCES bounds the work either
          way. */}
      {windowOpen && (
        <div className="anl-window">
          <label className="anl-window__field">
            <span className="anl-window__label">{t.windowFrom}</span>
            <input
              type="text"
              inputMode="numeric"
              className={`field field--page anl-field${startBad ? ' anl-field--bad' : ''}`}
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
              className={`field field--page anl-field${endBad || backwards ? ' anl-field--bad' : ''}`}
              value={to}
              onChange={e => setTo(e.target.value)}
              placeholder={t.windowWhole}
            />
          </label>
          <span className="anl-window__readout">
            {backwards ? t.windowBackwards : (span ? t.windowSpan(span) : t.windowFormatHint)}
          </span>
        </div>
      )}
    </>
  )
}
