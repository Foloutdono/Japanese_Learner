import { useState, useRef, useEffect, useCallback } from 'react'
import { countUse } from '../../lib/screenTrail'
import { apiJson, apiUpload, apiFetch } from '../../lib/api'
import { useLang } from '../../LangContext'
import { videoErrorMessage } from './videoErrors'
import { recordingFor } from '../../lib/mediaAudio'
import { episodeAudio } from '../../lib/podcast'
import { keepLocalMedia, localMediaFor } from '../../lib/localMedia'

// ── One Passage, three ways in ────────────────────────────
// The seam that makes 解析 one screen instead of two (plan 027). A
// Passage is what the learner submits as one act -- typed text, a
// photo, or a video window (see CONTEXT.md) -- and every source
// reaches the same shape by a different route:
//
//   text/photo  POST /api/phrase/analyze         -> {sentences, truncated}
//               ...synchronously, one round trip.
//   video       POST /api/video/session -> 202   -> poll GET .../{id}
//               ...until the worker has a Track parsed into Sentences.
//
// Explaining one Sentence differs too: the phrase route re-analyzes
// that Sentence's own text with `deep`, the video route has a
// per-index endpoint. Everything above this hook sees one `explain(i)`.
//
// The screen holds ONE of these across all three platforms, so
// switching source to check something does not throw away a finished
// Passage.

const POLL_MS = 1200
// A poll that got no answer is asked again, a little later each time,
// for about a minute before the session is given up on.
const RETRIES = 8
const RETRY_CAP_MS = 10000

// A failure that says nothing about the session: no answer at all (the
// link dropped), a token being mended (lib/api refreshes it on a 401),
// too many requests at once, or a server or its gateway down a moment.
// A 503 carrying the stored failure is the session's own.
function transient(e) {
  if (e?.status == null) return e?.name !== 'AbortError'
  if (e.status === 401 || e.status === 408 || e.status === 429) return true
  return e.status >= 500 && e.body?.status !== 'failed'
}

/** An empty Passage, so callers never have to null-check the shape. */
function emptyPassage() {
  return { sentences: [], truncated: 0, videoId: null, mediaUrl: null, mediaTitle: '', windowCapped: false, source: 'typed' }
}

export function useAnalyzerSession(session) {
  const { t, lang } = useLang()

  const [passage, setPassage]   = useState(null)
  const [status, setStatus]     = useState('idle')   // idle | working | ready | failed
  // A sentence from the table, or { video: <what was thrown> } for a
  // video session's failure, which is worded at the return below.
  const [error, setError]       = useState(null)
  // Where a recording is on its way to being heard (plan 265): null, or
  // { stage: 'fetch' | 'read' | 'decode' | 'encode' | 'upload' | 'hear',
  // ratio? } -- what the busy line says while the browser keeps its
  // sound and the server's recogniser listens.
  const [progress, setProgress] = useState(null)
  const [focusIndex, setFocus]  = useState(0)
  const [explaining, setExplaining] = useState({})
  // The failure of the one PAID action on this screen used to be an
  // empty catch: the button greyed out, came back, and nothing changed.
  // A provider outage arrives as a 503 (see routes/phrase.py's
  // LLMUnavailable handler), said as its own line; everything else is a
  // generic failure. Both are now reported per-Sentence, so a failure
  // on stop 12 does not blank the whole Passage's status.
  const [explainError, setExplainError] = useState({})
  const [history, setHistory]   = useState([])
  // The set of Sentence texts this learner has kept. Kept as a Set of
  // TEXTS rather than of indices, because a Passage's indices change
  // under it (a new analysis, a history entry) and the identity of a
  // kept Sentence is its text -- which is exactly what the bank stores
  // (docs/adr/0002).
  const [kept, setKept] = useState(() => new Set())
  // The entry just removed from `history`, kept in hand so it can be
  // put back. See deleteHistoryEntry/undoDelete below.
  const [lastDeleted, setLastDeleted] = useState(null)

  // The id of the video session currently being polled. Kept in state
  // (not a ref) because the poll effect is keyed on it.
  const [videoSessionId, setVideoSessionId] = useState(null)

  // Survives unmount/replacement: every async continuation checks it
  // before writing, so a Passage that arrives after the learner has
  // started another one cannot overwrite the newer result.
  const runIdRef = useRef(0)

  // ── History (all three platforms, plan 040) ────────────────
  // 運行履歴 covers all three platforms now. Two endpoints rather than
  // one, because the two live in different tables for good reasons --
  // a Passage of typed text is text plus provenance (docs/adr/0002),
  // a video session is a parsed Track with cue times and a job history.
  // Merging them in the CLIENT keeps that separation while giving the
  // learner one list, which is the only place the distinction does not
  // matter.
  //
  // Each entry carries a `kind`: 'passage' or 'session'. That field is
  // what decides how a row is reopened, and it is the ONLY place the
  // difference shows.
  //
  // A half that cannot be asked (the link dropped, a server error) keeps
  // the rows already in hand: read as an empty list, it unmarked every
  // kept sentence each time a poor connection dropped a refresh -- and a
  // refresh comes on every return to the tab (a new session object).
  const fetchHistory = useCallback(() => {
    const rows = path => apiFetch(path, session)
      .then(r => (r.ok ? r.json() : null))
      .then(list => (Array.isArray(list) ? list : null))
      .catch(() => null)
    return Promise.all([
      rows('/api/phrase/history'),
      rows('/api/video/sessions'),
    ]).then(([passages, sessions]) => {
      if (passages === null && sessions === null) return
      setHistory(prev => mergeHistory(prev, passages, sessions))
      if (passages !== null) {
        setKept(new Set(passages.filter(p => p.kept).map(p => p.phrase)))
      }
    })
  }, [session])

  useEffect(() => { fetchHistory() }, [fetchHistory])

  function mergeHistory(prev, passages, sessions) {
    const merged = [
      ...(passages === null ? prev.filter(h => h.kind === 'passage') : passages.map(p => ({
        kind: 'passage',
        id: p.id,
        label: p.phrase,
        source: p.source,
        createdAt: p.created_at,
        kept: p.kept,
      }))),
      ...(sessions === null ? prev.filter(h => h.kind === 'session') : sessions.map(s => ({
        kind: 'session',
        id: s.id,
        label: s.sourceRef,
        source: s.source,
        createdAt: s.createdAt,
        sentenceCount: s.sentenceCount,
        videoId: s.videoId,
        // The first sentence (plan 136), what a card prints in place
        // of the file name the grab gave the session.
        firstLine: s.firstLine ?? null,
      }))),
    ]
    merged.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    return merged
  }

  function beginRun() {
    runIdRef.current += 1
    setStatus('working')
    setProgress(null)
    setError(null)
    setExplaining({})
    setExplainError({})
    return runIdRef.current
  }

  function reset() {
    runIdRef.current += 1        // orphan anything in flight
    setVideoSessionId(null)
    setPassage(null)
    setProgress(null)
    setStatus('idle')
    setError(null)
    setFocus(0)
    setExplaining({})
    setExplainError({})
  }

  // Lets an intake surface a problem it can detect BEFORE a request --
  // a paste too short to be a transcript, say -- through the same
  // channel as a server failure, so the screen has one place errors
  // appear rather than each intake inventing its own.
  function fail(message) {
    runIdRef.current += 1
    setProgress(null)
    setError(message)
    setStatus('failed')
  }

  // ── text / photo ──────────────────────────────────────────
  // Local tier only -- no `deep`, so this is a single free, instant
  // round trip with no LLM call. See docs/adr/0001. The per-Sentence
  // deep tier is bought separately, on demand, via explain().
  //
  // `source` is the Passage's provenance ('typed' | 'image'), which the
  // Sentence bank stores (plan 016) and the history row badges.
  async function analyzeText(text, { source = 'typed' } = {}) {
    const trimmed = (text ?? '').trim()
    if (!trimmed || status === 'working') return
    // 足跡 (plan 218): which door the breakdown was asked through, never
    // the text. A photo's text arrives here too, after the OCR.
    countUse('analyzer', source === 'typed' ? 'text' : 'photo')

    const run = beginRun()
    setVideoSessionId(null)
    try {
      const data = await apiJson('/api/phrase/analyze', session, {
        method: 'POST',
        // `lines` (plan 235): each sentence held to the width a video's
        // lines are, which only the analyser asks for.
        body: JSON.stringify({ phrase: trimmed, lang, source, lines: true }),
      })
      if (run !== runIdRef.current) return
      setPassage({
        ...emptyPassage(),
        source,
        // The history row it was saved as: what its translations and its
        // explanations are asked by (plan 235).
        historyId: data.id ?? null,
        sentences: data.sentences ?? [],
        truncated: data.truncated ?? 0,
      })
      setFocus(0)
      setStatus('ready')
      fetchHistory()
    } catch {
      if (run !== runIdRef.current) return
      setError(t.phraseAnalyzeError)
      setStatus('failed')
    }
  }

  // Re-derives from the stored Passage text -- a local-tier operation,
  // never an LLM call (see routes/phrase.py's get_phrase_history_entry).
  // `lang` lets the server merge in a previously-bought deep tier for
  // THIS language from phrase_analysis_cache, when one exists.
  async function loadHistoryEntry(id) {
    const run = beginRun()
    setVideoSessionId(null)
    try {
      const data = await apiJson(`/api/phrase/history/${id}?lang=${lang}`, session)
      if (run !== runIdRef.current) return
      setPassage({
        ...emptyPassage(),
        source: data.source ?? 'typed',
        historyId: id,
        text: data.passage ?? '',
        sentences: data.sentences ?? [],
        truncated: data.truncated ?? 0,
      })
      setFocus(0)
      setStatus('ready')
      return data.passage ?? ''
    } catch {
      if (run !== runIdRef.current) return
      setStatus('failed')
    }
  }

  // A single reopen dispatcher for the merged history list. `kind` is
  // the only place the passage/session distinction shows on this side.
  function openHistoryEntry(entry) {
    if (entry.kind === 'session') {
      // Reopening a ready session is exactly what the poll already
      // does: the first GET returns 200 with sentences and the effect
      // builds the Passage. One line, no second loader.
      beginRun()
      setVideoSessionId(entry.id)
      return Promise.resolve(null)
    }
    return loadHistoryEntry(entry.id)
  }

  // ── video ─────────────────────────────────────────────────
  // There is no "load from URL": a server cannot get captions from
  // YouTube -- datacenter IPs are blocked AND the endpoint needs a token
  // YouTube's own player generates -- so both ingests are local, and
  // `url` is only ever the optional name of a video to play alongside
  // them. See docs/adr/0003's 2026-08-26 amendment.
  async function startVideoFromTranscript(transcript, { url, start, end }) {
    countUse('analyzer', 'video')
    const run = beginRun()
    try {
      const data = await apiJson('/api/video/session', session, {
        method: 'POST',
        body: JSON.stringify({
          transcript: transcript.trim(),
          // Omitted entirely when blank, so a transcript can be studied
          // on its own with no player.
          ...(url?.trim() ? { url: url.trim() } : {}),
          // Omitted entirely when unbounded. Number(null) is 0, which
          // the API would read as a real bound rather than "no bound".
          ...(start != null ? { start } : {}),
          ...(end != null ? { end } : {}),
        }),
      })
      if (run !== runIdRef.current) return
      setVideoSessionId(data.sessionId)
    } catch (e) {
      if (run !== runIdRef.current) return
      // What was wrong with the paste, which is the useful thing -- in
      // the learner's language, from the refusal's code
      // (./videoErrors.js), never the server's English.
      setError({ video: e })
      setStatus('failed')
    }
  }

  // ── The link ingest ──────────────────────────────────────
  // A URL and nothing else. The server fetches the Japanese track
  // through a residential proxy, which is the one route that clears
  // YouTube's datacenter block (docs/adr/0003, 2026-09-10) -- and it
  // is off unless that proxy is paid for, which is why the screen
  // asks /api/video/capabilities before offering this at all.
  //
  // Deliberately shaped like the two ingests above rather than shared
  // with them: the only thing they have in common is the 202 they
  // land on, and a single "start a video session somehow" helper
  // taking a mode flag would hide which of them can fail on the
  // network.
  async function startVideoFromLink(url, { start, end } = {}) {
    const trimmed = url?.trim()
    if (!trimmed) return
    countUse('analyzer', 'video')
    const run = beginRun()
    try {
      const data = await apiJson('/api/video/session', session, {
        method: 'POST',
        body: JSON.stringify({
          url: trimmed,
          ...(start != null ? { start } : {}),
          ...(end != null ? { end } : {}),
        }),
      })
      if (run !== runIdRef.current) return
      setVideoSessionId(data.sessionId)
    } catch (e) {
      if (run !== runIdRef.current) return
      // Named, always. A 400 here means this server cannot fetch, a
      // 429 means the day's allowance is spent, and both sentences name
      // the file path as the way through -- which a generic "something
      // went wrong" would throw away. Worded from the refusal's code
      // (./videoErrors.js), in the learner's language.
      setError({ video: e })
      setStatus('failed')
    }
  }

  async function startVideoFromFile(file, { url, start, end, timing, translations, mediaUrl, mediaTitle }) {
    if (!file) return
    countUse('analyzer', 'video')
    const run = beginRun()
    try {
      const formData = new FormData()
      formData.append('file', file)
      // The grab's recognised track, the clock the lines' words are
      // read out on (backend/study/word_timing.py). Never the lines.
      if (timing) formData.append('timing', timing)
      // The video's own translation, {lang: file} (plan 242): what the
      // server prints under the lines it lines up with. Never the lines.
      for (const [lang, track] of Object.entries(translations ?? {})) {
        formData.append(`translation_${lang}`, track)
      }
      // Same rule as the JSON ingest: an absent bound is absent, not 0.
      if (start != null) formData.append('start', String(start))
      if (end != null) formData.append('end', String(end))
      // Optional, and never fetched from -- it just tells the player
      // which video to embed next to the subtitles.
      if (url?.trim()) formData.append('url', url.trim())
      // The page grab's own media file (plan 265), played beside the
      // lines by the analyser's player where it is a plain web address.
      if (mediaUrl) formData.append('media_url', mediaUrl)
      if (mediaTitle) formData.append('media_title', mediaTitle)
      const data = await apiUpload('/api/video/session', session, formData)
      if (run !== runIdRef.current) return
      setVideoSessionId(data.sessionId)
    } catch (e) {
      if (run !== runIdRef.current) return
      setError({ video: e })
      setStatus('failed')
    }
  }

  // ── A recording, heard (plan 265) ─────────────────────────
  // A file the learner holds, or a podcast's episode: its sound kept
  // and encoded here (lib/mediaAudio.js), heard by the server's
  // recogniser, the session polled like any other. `caps` is what the
  // server said it takes (/api/video/capabilities), checked before a
  // minute is spent encoding. A file's player plays the file itself,
  // this visit (lib/localMedia.js); an episode's plays its address.
  //
  // `progress` is what the steps card draws while it goes (the owner's
  // pick B, components/analysis/HearingSteps.jsx): the stage, the
  // encoding's share, the recording's name and length, and what was
  // left of the day before it. Until the sound is sent it can be
  // called off (cancelRecording); once sent, the recogniser is paid
  // and the session lands on the shelf whatever the screen does.
  const abortRef = useRef(null)

  async function startVideoFromRecording(file, { start, end, caps, url, name, podcast = null, feed = null, controller = null }) {
    if (!file) return
    countUse('analyzer', 'video')
    const run = beginRun()
    const abort = controller ?? new AbortController()
    abortRef.current = abort
    const title = (name ?? file.name ?? '').slice(0, 200)
    const step = next => {
      if (run === runIdRef.current) setProgress(prev => ({ ...prev, ...next }))
    }
    setProgress({
      stage: 'read',
      title,
      seconds: podcast?.duration ?? null,
      minutesLeft: caps?.transcribeMinutesLeft ?? null,
    })
    try {
      const recording = await recordingFor(file, {
        start, end,
        maxSeconds: caps?.transcribeMaxSeconds ?? null,
        minutesLeft: caps?.transcribeMinutesLeft ?? null,
        onProgress: step,
        signal: abort.signal,
      })
      if (run !== runIdRef.current) return
      step({ stage: 'upload', seconds: recording.seconds })
      const formData = new FormData()
      formData.append('audio', recording.blob, 'audio.mp3')
      formData.append('source', podcast ? 'podcast' : 'media')
      formData.append('name', title)
      // Where the recording starts in the video: the window's start, as
      // the cut made it. Its end only bounds the lines.
      formData.append('start', String(recording.offset))
      if (end != null) formData.append('end', String(end))
      if (podcast?.audioUrl) formData.append('media_url', podcast.audioUrl)
      if (podcast?.title) formData.append('media_title', podcast.title.slice(0, 200))
      // The episode's podcast and picture (the owner's picks B and C):
      // what the Podcast door lists again, and what the frame shows.
      if (podcast && feed?.url) formData.append('feed_url', feed.url)
      if (podcast && feed?.title) formData.append('feed_title', feed.title.slice(0, 200))
      if (podcast && (podcast.image ?? feed?.image)) formData.append('media_image', podcast.image ?? feed.image)
      if (url?.trim()) formData.append('url', url.trim())
      const data = await apiUpload('/api/video/recording', session, formData, { signal: abort.signal })
      if (run !== runIdRef.current) return
      abortRef.current = null
      if (!podcast) keepLocalMedia(data.sessionId, file)
      step({ stage: 'hear' })
      setVideoSessionId(data.sessionId)
    } catch (e) {
      if (run !== runIdRef.current || e?.name === 'AbortError') return
      setProgress(null)
      setError({ video: e })
      setStatus('failed')
    }
  }

  // A podcast's episode: its audio fetched (its own address, or the
  // server's relay), then heard as a recording. `feed` is the podcast
  // it was picked from ({url, title, image}).
  async function startVideoFromEpisode(episode, { start, end, caps, feed = null }) {
    if (!episode?.audioUrl) return
    const run = beginRun()
    const name = episode.title || episode.audioUrl.split('/').pop()
    const controller = new AbortController()
    abortRef.current = controller
    setProgress({
      stage: 'fetch', title: name, seconds: episode.duration ?? null,
      minutesLeft: caps?.transcribeMinutesLeft ?? null,
    })
    let blob
    try {
      blob = await episodeAudio(session, episode.audioUrl, { signal: controller.signal })
    } catch (e) {
      if (run !== runIdRef.current || e?.name === 'AbortError') return
      setProgress(null)
      setError({ video: e?.code ? e : Object.assign(new Error('episode_unreachable'), { code: 'episode_unreachable' }) })
      setStatus('failed')
      return
    }
    if (run !== runIdRef.current) return
    await startVideoFromRecording(new File([blob], name, { type: blob.type || 'audio/mpeg' }), {
      start, end, caps, name, podcast: episode, feed, controller,
    })
  }

  // A YouTube video with no subtitles (the 2026-10-21 amendment of
  // docs/adr/0003): its address sent, and Gemini watches it on Google's
  // side (backend/study/youtube_hearing.py). Nothing is kept or sent
  // from here but the link and the window; the steps card has two
  // steps, the second the model's, so nothing can be called off.
  async function startVideoFromHearing(url, { start, end, caps } = {}) {
    const trimmed = url?.trim()
    if (!trimmed) return
    countUse('analyzer', 'video')
    const run = beginRun()
    setProgress({
      kind: 'link',
      stage: 'hear',
      title: trimmed.replace(/^https?:\/\/(www\.)?/, ''),
      seconds: end != null ? end - (start ?? 0) : null,
      minutesLeft: caps?.transcribeMinutesLeft ?? null,
    })
    try {
      const data = await apiJson('/api/video/youtube-hear', session, {
        method: 'POST',
        body: JSON.stringify({
          url: trimmed,
          ...(start != null ? { start } : {}),
          ...(end != null ? { end } : {}),
        }),
      })
      if (run !== runIdRef.current) return
      setVideoSessionId(data.sessionId)
    } catch (e) {
      if (run !== runIdRef.current) return
      setProgress(null)
      setError({ video: e })
      setStatus('failed')
    }
  }

  // Called off before the sound is sent: nothing reached the server, so
  // nothing was spent, and the screen is back where it was.
  function cancelRecording() {
    abortRef.current?.abort()
    abortRef.current = null
    runIdRef.current += 1
    setProgress(null)
    setError(null)
    setStatus('idle')
  }

  // ── The poll ──────────────────────────────────────────────
  // Keyed on the session id alone. Supabase hands the app a new session
  // object on every token refresh and every return to the tab -- the
  // same sign-in -- and a ready Passage asked for again on it put the
  // line back on its first stop under a playing video, or, the request
  // dropped on a poor connection, took the Passage and its player off
  // the screen. The poll asks with the session current when it asks.
  const sessionRef = useRef(session)
  useEffect(() => { sessionRef.current = session })
  useEffect(() => {
    if (videoSessionId == null) return undefined
    let cancelled = false
    let timer = null
    let misses = 0

    async function poll() {
      try {
        const data = await apiJson(`/api/video/session/${videoSessionId}`, sessionRef.current)
        if (cancelled) return
        misses = 0
        // "Still generating" arrives as HTTP 202 -- which is a SUCCESS
        // status, so apiJson RESOLVES with {status: 'generating'} and
        // the catch below never sees it. This used to be handled as
        // `catch (e) { if (e.status === 202) ... }`, which was dead code:
        // the happy path ran instead, setSentences(undefined) landed,
        // and the next render threw
        // "Cannot read properties of undefined (reading '0')".
        // It never showed on an upload (the worker finishes in
        // milliseconds, so the FIRST poll is already 200) and always
        // showed on a slow ingest. Discriminate on the payload, not on
        // a throw.
        if (data.status === 'generating' || !Array.isArray(data.sentences)) {
          timer = setTimeout(poll, POLL_MS)
          return
        }
        setPassage({
          ...emptyPassage(),
          // What the line's translations are asked by (plan 235,
          // ./useLineTranslations.js).
          sessionId: videoSessionId,
          source: data.source ?? 'video',
          sourceRef: data.sourceRef,
          videoId: data.videoId ?? null,
          // A recording's player (plan 265): its own address where the
          // server keeps one, else the file this device holds, this visit.
          mediaUrl: data.mediaUrl ?? localMediaFor(videoSessionId)?.url ?? null,
          mediaTitle: data.mediaTitle ?? '',
          // What the player's frame shows for a recording with no
          // picture (the owner's pick C): an episode's podcast and
          // image, and whether it is sound alone (a podcast, or a sound
          // file this device holds).
          feedTitle: data.feedTitle ?? '',
          mediaImage: data.mediaImage ?? null,
          soundOnly: data.source === 'podcast' || Boolean(localMediaFor(videoSessionId)?.sound),
          windowCapped: !!data.windowCapped,
          truncated: data.truncated ?? 0,
          sentences: data.sentences,
        })
        setFocus(0)
        setProgress(null)
        setStatus('ready')
      } catch (e) {
        if (cancelled) return
        if (transient(e) && misses < RETRIES) {
          misses += 1
          timer = setTimeout(poll, Math.min(POLL_MS * 2 ** (misses - 1), RETRY_CAP_MS))
          return
        }
        // A failed session is a 503 whose body is the stored failure:
        // its `code` is worded below, its English `error` is the logs'.
        setProgress(null)
        setError({ video: e })
        setStatus('failed')
      }
    }
    poll()

    // Both halves matter: `cancelled` stops a resolved fetch from
    // writing after teardown, and clearTimeout stops the NEXT poll from
    // ever firing. Without the timer clear, switching platform
    // mid-generation leaves a request loop running for the life of the
    // screen.
    return () => { cancelled = true; if (timer) clearTimeout(timer) }
  }, [videoSessionId])

  // ── The deep tier, one Sentence at a time ─────────────────
  // Never the whole Passage: it can be up to study/sentences
  // .MAX_SENTENCES long, and `deep` on every one of them would
  // multiply the cost by that many. See docs/adr/0001.
  //
  // A line is explained where it stands (plan 235): the server has its
  // place and its neighbours -- a video's on its session, a typed
  // Passage's on its history row -- and `about` the video's title and
  // channel, which only the player knows. A Passage saved nowhere is
  // explained as the sentence alone.
  async function explain(index, about = {}) {
    const sentence = passage?.sentences?.[index]
    if (!sentence || explaining[index]) return
    countUse('explain', 'open')

    setExplaining(prev => ({ ...prev, [index]: true }))
    setExplainError(prev => ({ ...prev, [index]: null }))
    const run = runIdRef.current
    try {
      const explained = videoSessionId != null
        ? await apiJson(
            `/api/video/session/${videoSessionId}/sentence/${index}/explain`,
            session,
            {
              method: 'POST',
              body: JSON.stringify({ lang, title: about.title ?? '', channel: about.channel ?? '' }),
            },
          )
        : passage?.historyId != null
          ? await apiJson(
              `/api/phrase/history/${passage.historyId}/sentence/${index}/explain`,
              session,
              { method: 'POST', body: JSON.stringify({ lang }) },
            )
          : await apiJson('/api/phrase/analyze', session, {
              method: 'POST',
              body: JSON.stringify({ phrase: sentence.text, deep: true, lang, save: false }),
            }).then(data => data.sentences?.[0] ?? data)

      if (run !== runIdRef.current) return
      setPassage(prev => (prev
        ? {
            ...prev,
            // MERGE, never replace. The backend now preserves the cue
            // fields too (routes/video.py), but the client keeping the
            // Sentence it already had as the base means a future field
            // added upstream cannot be silently dropped here either.
            sentences: prev.sentences.map((s, i) => (i === index ? { ...s, ...explained } : s)),
          }
        : prev))
    } catch (e) {
      if (run !== runIdRef.current) return
      setExplainError(prev => ({
        ...prev,
        // 503 is the provider being down, which is temporary and worth
        // saying so. Anything else is a generic failure. Never the
        // server's own sentence: ApiError's message is never empty, so
        // the backend's English used to win every time (plan 215).
        [index]: e?.status === 503 ? t.explainUnavailable : t.explainFailed,
      }))
    } finally {
      setExplaining(prev => ({ ...prev, [index]: false }))
    }
  }

  // 保存 -- pin or unpin ONE Sentence. Optimistic: pinning is a small,
  // reversible act and a spinner on it would cost more than the
  // occasional revert.
  //
  // One request per Sentence at a time (plan 211): a double press
  // pinned and unpinned it in two crossing requests. `refresh: false`
  // leaves the history to the caller (keepSentences, below).
  const keeping = useRef(new Set())
  async function keepSentence(index, { refresh = true } = {}) {
    const sentence = passage?.sentences?.[index]
    if (!sentence || keeping.current.has(sentence.text)) return
    keeping.current.add(sentence.text)
    const alreadyKept = kept.has(sentence.text)
    setKept(prev => {
      const next = new Set(prev)
      if (alreadyKept) next.delete(sentence.text)
      else next.add(sentence.text)
      return next
    })
    try {
      if (alreadyKept) {
        const row = history.find(h => h.kind === 'passage' && h.label === sentence.text && h.kept)
        if (row) await apiFetch(`/api/phrase/keep/${row.id}`, session, { method: 'DELETE' })
      } else {
        await apiJson('/api/phrase/keep', session, {
          method: 'POST',
          body: JSON.stringify({
            sentence: sentence.text,
            source: passage.source ?? 'typed',
            // A video Sentence's provenance is its cue -- the same
            // "<ref>@<cue_start>" convention routes/video.py's explain
            // endpoint already writes.
            source_ref: sentence.cue_start != null
              ? `${passage.sourceRef ?? ''}@${sentence.cue_start}`
              : (passage.sourceRef ?? ''),
          }),
        })
      }
    } finally {
      keeping.current.delete(sentence.text)
      if (refresh) fetchHistory()
    }
  }

  // Several Sentences pinned at once (the analyser's "keep every i+1"):
  // one after another and the history asked once at the end, where a
  // keep each in parallel sent three requests per Sentence at once
  // (plan 211). A failure leaves the rest to go on.
  async function keepSentences(indices) {
    try {
      for (const index of indices) {
        await keepSentence(index, { refresh: false }).catch(() => {})
      }
    } finally {
      fetchHistory()
    }
  }

  // Optimistic, with the row kept in hand. Deleting is frequent and
  // low-stakes, so a confirmation dialog is friction; an undo is not.
  //
  // A passage's DELETE is a hard delete, so its restore goes through the
  // ordinary analyze-and-save path: what comes back is the Passage with
  // its provenance, at a NEW id and a new timestamp. The copy says
  // "Undo", not "Restore", for exactly that reason. A video session
  // cannot be analysed again from here -- its track is not kept -- so
  // the server marks it removed instead, and Undo takes the mark off
  // (backend core/history.py): it comes back as it was, where it was.
  function deleteHistoryEntry(entry) {
    setLastDeleted(entry)
    setHistory(prev => prev.filter(h => !(h.kind === entry.kind && h.id === entry.id)))
    const path = entry.kind === 'session' ? `/api/video/session/${entry.id}` : `/api/phrase/history/${entry.id}`
    return apiFetch(path, session, { method: 'DELETE' })
      .then(fetchHistory)
      .catch(() => { setLastDeleted(null); fetchHistory() })
  }

  async function undoDelete() {
    const entry = lastDeleted
    if (!entry) return
    setLastDeleted(null)
    try {
      if (entry.kind === 'session') {
        await apiFetch(`/api/video/session/${entry.id}/restore`, session, { method: 'POST' })
      } else {
        await apiJson('/api/phrase/analyze', session, {
          method: 'POST',
          body: JSON.stringify({ phrase: entry.label, lang, source: entry.source ?? 'typed', lines: true }),
        })
      }
    } finally {
      fetchHistory()
    }
  }

  function dismissUndo() {
    setLastDeleted(null)
  }

  const sentences = passage?.sentences ?? []
  // Clamped on every read. A Passage can be REPLACED under this index
  // (a new analysis, a history entry) while it still holds a value from
  // the last one -- a stale index into a shorter array is the same
  // failure class as the 202 crash above.
  const safeIndex = sentences.length ? Math.min(focusIndex, sentences.length - 1) : 0

  return {
    passage,
    sentences,
    status,
    progress,
    // A video failure is kept as it was thrown and worded here, at
    // render, so the sentence follows the learner's language rather
    // than the one in force when it failed (./videoErrors.js).
    error: error?.video ? videoErrorMessage(error.video, t) : error,
    history,
    focusIndex: safeIndex,
    setFocusIndex: setFocus,
    focused: sentences[safeIndex] ?? null,
    explaining,
    explainError,
    kept,
    keepSentence,
    keepSentences,
    analyzeText,
    startVideoFromFile,
    startVideoFromRecording,
    startVideoFromEpisode,
    startVideoFromHearing,
    cancelRecording,
    startVideoFromLink,
    startVideoFromTranscript,
    explain,
    loadHistoryEntry,
    openHistoryEntry,
    deleteHistoryEntry,
    lastDeleted,
    undoDelete,
    dismissUndo,
    reset,
    fail,
  }
}
