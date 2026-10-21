import { useState, useRef, useEffect } from 'react'
import { parseTimecode, formatTimecode } from '../../lib/timecode'
import { parseVideoId } from '../../lib/youtube'
import { VideoStill } from './VideoStill'
import { useBookmarkletCopy, watchUrlFor } from './useBookmarkletCopy'
import { isNative } from '../../lib/platform'
import { GrabTutorial } from './GrabTutorial'
import { useDesk } from '../../hooks/useDesk'
import { composing } from '../../lib/keyGuards'
import { SUBTITLE_ACCEPT, MEDIA_ACCEPT } from '../../lib/subtitleFiles'
import { readFeed, feedAddress } from '../../lib/podcast'
import { useCachedJson, invalidateCachedJson } from '../../lib/cachedJson'
import { Seg, Chip } from '../chrome/Console'
import { videoErrorMessage } from './videoErrors'

// ── 3番線 動画 — the subtitle dock ────────────────────────
// Three doors, one at a time (plan 265, the owner's pick B of the
// canvas "Tsuji analyser — new ways in"): Lien · Fichier · Podcast.
// Plan 136 had drawn one column with every way in on it; once a
// recording and a podcast could come in too, the column held five
// actions and a field that meant two things, so each source has its
// own door and the doors are one control at the top.
//
//   Lien     the link, the video's still and ONE filled action, as plan
//            136 drew it (the owner's pick C there):
//              the server can fetch links      ->  Get the subtitles
//              the bookmark has never been used ->  Set up the bookmark
//              otherwise                        ->  Open on YouTube
//            The server's fetch through a residential proxy
//            (docs/adr/0003, 2026-09-10) is CONDITIONAL on
//            /api/video/capabilities; the bookmark (lib/captionGrab.js)
//            needs a browser with bookmarks, so not the native shell.
//   Fichier  a subtitle file, or where the server can hear one a
//            recording (sound or film): picked here or dropped anywhere
//            on the desk's page. The accept list carries MIME types
//            beside extensions on purpose: Android's picker matches by
//            MIME, and `.srt`/`.vtt` map to none.
//   Podcast  where the server can hear one: the podcasts the learner
//            has heard before, a feed's address, its episodes, and what
//            is left of the day's listening.
//
// The link field's video still plays beside lines from a file: the
// link names the video for the player whichever door the lines came
// in by. Nothing here is gated behind the paid path: Fichier is always
// there, and leads in the native shell where no link can be fetched.
//
// `door`/`onDoorChange` and `feedInput`/`onFeedInputChange` are the
// screen's when it holds them (a feed pasted in the phone's line opens
// the Podcast door with it), the panel's own otherwise. `grabUsed` is
// the screen's (a passage has arrived by the bookmark). `onTutorial`
// opens the walkthrough where the screen keeps it -- the desk's column,
// or a dialog on a phone; without it (a bare mount) the walkthrough is
// this panel's own dialog. `grab` is the copy state the screen shares
// with that walkthrough, and `tutorialPopup` says what the screen's
// opens ('dialog' on a phone, nothing in the desk's column). `dropRef`
// is the screen's hold on this panel's file ingest, for a file dropped
// anywhere on the desk's page: it is cut to the window set here, as one
// chosen here is. `minutesLeft` is the day's listening left.
//
// `youtubeHear` (the 2026-10-21 amendment of docs/adr/0003): a video
// with no subtitle track at all can be heard instead, by Gemini watching
// it on Google's side. Its button sits under the Lien door's filled
// action, quiet, once a link names a video (`onHearLink`, cut to the
// window).
export function IntakeVideo({
  t, url, onUrlChange, onStartFromFile, onStartFromLink, onStartFromEpisode, session,
  transcribe = false, minutesLeft = null, linkFetch, grab, onTutorial, tutorialPopup, grabUsed = false, dropRef,
  youtubeHear = false, onHearLink,
  door: heldDoor, onDoorChange, feedInput: heldFeed, onFeedInputChange,
}) {
  // The Window is OPTIONAL and blank by default -- the whole Track is
  // the sensible thing to study, and MAX_SENTENCES already bounds the
  // work. See docs/adr/0003's 2026-08-27 amendment.
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [windowOpen, setWindowOpen] = useState(false)
  const own = useBookmarkletCopy(t)
  const { copied, copy: copyBookmarklet } = grab ?? own
  const [showTutorial, setShowTutorial] = useState(false)
  const fileRef = useRef(null)
  const grabbable = !isNative()

  // The doors (see the head): Podcast only where a recording can be
  // heard, and Fichier first where no link can be fetched or grabbed.
  const doors = [
    { key: 'link', label: t.doorLink },
    { key: 'file', label: t.doorFile },
    ...(transcribe ? [{ key: 'podcast', label: t.doorPodcast }] : []),
  ]
  const [ownDoor, setOwnDoor] = useState(() => (!grabbable && !linkFetch ? 'file' : 'link'))
  const wanted = heldDoor ?? ownDoor
  const door = doors.some(d => d.key === wanted) ? wanted : 'link'
  const setDoor = onDoorChange ?? setOwnDoor
  const [ownFeed, setOwnFeed] = useState('')
  const feedInput = heldFeed ?? ownFeed
  const setFeedInput = onFeedInputChange ?? setOwnFeed
  // A podcast's feed, once read: { url, title, image, episodes } | { url,
  // error } | { url, loading }. Kept for the address it was read for, so
  // a new address in the field puts the list away.
  const [feed, setFeed] = useState(null)

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
  // Where the server can fetch, the fetch is the lead whether or not a
  // link has been pasted yet: the button waits, disabled, for a link
  // that names a video, rather than the door leading with the bookmark
  // and switching under the learner's paste.
  const canFetch = Boolean(linkFetch && parsedVideoId)
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

  // Which is the Lien door's one filled action (see the head); none in
  // the native shell, where the Fichier door leads instead.
  const lead = linkFetch ? 'fetch' : !grabbable ? null : grabUsed ? 'open' : 'install'

  // The Podcast door: the learner's own podcasts, asked only while the
  // door is open, and the feed in the field.
  const recent = useCachedJson(transcribe && door === 'podcast' ? '/api/video/podcasts' : null, session)
  const feedUrl = feedAddress(feedInput, s => Boolean(parseVideoId(s)))
  const shownFeed = feed && feed.url === feedUrl ? feed : null
  async function openFeed(address = feedUrl) {
    if (!address || (feed?.url === address && feed.loading)) return
    setFeed({ url: address, loading: true })
    try {
      const read = await readFeed(session, address)
      setFeed({ url: address, ...read })
    } catch (e) {
      setFeed({ url: address, error: videoErrorMessage(e, t) })
    }
  }
  function reopen(podcast) {
    setFeedInput(podcast.url)
    openFeed(podcast.url)
  }
  function hear(episode) {
    // The episode's podcast is the door's first next time.
    invalidateCachedJson('/api/video/podcasts')
    onStartFromEpisode?.(episode, {
      start: startSec, end: endSec,
      feed: { url: shownFeed.url, title: shownFeed.title ?? '', image: shownFeed.image ?? null },
    })
  }
  const left = minutesLeft != null && <p className="anl-link__say">{t.podcastMinutesLeft(minutesLeft)}</p>

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
  const downsub = (
    <a className="anl-vlink anl-grab__downsub" href={downsubHref} target="_blank" rel="noopener noreferrer" title={t.downsubHint}>
      DownSub
    </a>
  )
  const windowToggle = (
    <button type="button" className="anl-vlink anl-window-toggle" aria-expanded={windowOpen} onClick={() => setWindowOpen(o => !o)}>
      {t.windowLabel}
    </button>
  )

  return (
    <>
      <Seg full options={doors} value={door} onChange={setDoor} label={t.doorsLabel} className="anl-doors" />

      {door === 'link' && (
        <>
          {/* The link leads: it names the video for the player, opens the
              right page for the bookmark, and pre-fills DownSub. Its
              placeholder is a link, which is its label on screen; the
              name is for a reader. */}
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
                disabled={!canFetch}
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

          {youtubeHear && parsedVideoId && (
            <div className="anl-link">
              <button
                type="button"
                className="btn-secondary anl-hear-link"
                onClick={() => onHearLink?.(url, { start: startSec, end: endSec })}
              >
                {t.hearThisVideo}
              </button>
              {minutesLeft != null && <p className="anl-link__say">{t.podcastMinutesLeft(minutesLeft)}</p>}
            </div>
          )}

          {/* The rest, quiet, on one line. The bookmark's door stays here
              once it is no longer the filled action: a second device
              needs it again. */}
          <p className="anl-vlinks">
            {grabbable && lead !== 'install' && installDoor('anl-vlink anl-grab__tutorial', t.grabInstallLink)}
            {grabbable && lead === 'install' && openLink('anl-vlink anl-grab__open', t.openOnYoutube)}
            {downsub}
            {windowToggle}
          </p>
        </>
      )}

      {door === 'file' && (
        <>
          {/* A real file input, clipped rather than display:none (which
              would take it out of the accessibility tree), pressed by
              the button: the one control that reads the same on a phone
              and on a desk, where the page takes a dropped file too. */}
          <div className="anl-link">
            <button
              type="button"
              className="btn-primary anl-file"
              onClick={() => fileRef.current?.click()}
            >
              {transcribe ? t.chooseSubtitlesOrRecording : t.chooseSubtitles}
            </button>
            <p className="anl-link__say">{transcribe ? t.recordingAccepted : t.subtitleAccepted}</p>
          </div>
          {transcribe && left}
          <p className="anl-vlinks">
            {downsub}
            {windowToggle}
          </p>
        </>
      )}

      {door === 'podcast' && (
        <>
          {Array.isArray(recent) && recent.length > 0 && (
            <div className="chip-row anl-pod__recent" role="group" aria-label={t.podcastRecent}>
              {recent.map(p => (
                <Chip key={p.url} aria-pressed={undefined} onClick={() => reopen(p)} lang={/[぀-ヿ一-鿿]/.test(p.title) ? 'ja' : undefined}>
                  {p.title || p.url.replace(/^https?:\/\//, '')}
                </Chip>
              ))}
            </div>
          )}
          <label className="anl-field-row">
            <input
              type="text"
              className="field field--page anl-field"
              value={feedInput}
              onChange={e => setFeedInput(e.target.value)}
              placeholder={t.feedPlaceholder}
              aria-label={t.feedAddress}
            />
          </label>
          <div className="anl-pod">
            {!shownFeed?.episodes && (
              <button type="button" className="btn-primary" onClick={() => openFeed()} disabled={!feedUrl || Boolean(shownFeed?.loading)}>
                {shownFeed?.loading ? t.podcastReading : t.podcastOpen}
              </button>
            )}
            {shownFeed?.error && <p className="anl-pod__error" role="alert">{shownFeed.error}</p>}
            {shownFeed?.episodes && (
              <>
                <p className="anl-pod__show">{shownFeed.title || t.podcastUntitled}</p>
                <ul className="anl-pod__list" aria-label={t.podcastEpisodes}>
                  {shownFeed.episodes.map(ep => (
                    <li key={ep.audioUrl}>
                      <button type="button" className="anl-pod__ep" onClick={() => hear(ep)}>
                        <span className="anl-pod__title">{ep.title}</span>
                        <span className="anl-pod__meta">
                          {[ep.published, ep.duration ? formatTimecode(ep.duration) : null].filter(Boolean).join(' · ')}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            )}
            {left}
          </div>
          <p className="anl-vlinks">{windowToggle}</p>
        </>
      )}

      {/* The file input stays mounted whichever door is open: the desk's
          page hands it a dropped file through `dropRef`, and the phone's
          line opens it from its own button. */}
      <input
        ref={fileRef}
        type="file"
        accept={transcribe ? `${SUBTITLE_ACCEPT},${MEDIA_ACCEPT}` : SUBTITLE_ACCEPT}
        className="anl-drop__input"
        tabIndex={-1}
        aria-hidden="true"
        onChange={e => onStartFromFile(e.target.files?.[0], windowOpts)}
      />

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
