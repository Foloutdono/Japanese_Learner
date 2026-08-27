import { useState, useRef, useEffect, useCallback } from 'react'
import { apiJson, apiUpload, apiFetch } from '../../lib/api'
import { useLang } from '../../LangContext'

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

/** An empty Passage, so callers never have to null-check the shape. */
function emptyPassage() {
  return { sentences: [], truncated: 0, videoId: null, windowCapped: false, source: 'typed' }
}

export function useAnalyzerSession(session) {
  const { t, lang } = useLang()

  const [passage, setPassage]   = useState(null)
  const [status, setStatus]     = useState('idle')   // idle | working | ready | failed
  const [error, setError]       = useState(null)
  const [focusIndex, setFocus]  = useState(0)
  const [explaining, setExplaining] = useState({})
  const [history, setHistory]   = useState([])

  // The id of the video session currently being polled. Kept in state
  // (not a ref) because the poll effect is keyed on it.
  const [videoSessionId, setVideoSessionId] = useState(null)

  // Survives unmount/replacement: every async continuation checks it
  // before writing, so a Passage that arrives after the learner has
  // started another one cannot overwrite the newer result.
  const runIdRef = useRef(0)

  // ── History (typed and photographed Passages only) ────────
  // Video sessions are not listed: routes/video.py exposes a session by
  // id and nothing that enumerates them. Deliberate scope for wave 5,
  // not an omission -- see plans/README.md's open questions.
  const fetchHistory = useCallback(() => {
    apiFetch('/api/phrase/history', session)
      .then(r => (r.ok ? r.json() : []))
      .then(setHistory)
      .catch(() => setHistory([]))
  }, [session])

  useEffect(() => { fetchHistory() }, [fetchHistory])

  function beginRun() {
    runIdRef.current += 1
    setStatus('working')
    setError(null)
    setExplaining({})
    return runIdRef.current
  }

  function reset() {
    runIdRef.current += 1        // orphan anything in flight
    setVideoSessionId(null)
    setPassage(null)
    setStatus('idle')
    setError(null)
    setFocus(0)
    setExplaining({})
  }

  // Lets an intake surface a problem it can detect BEFORE a request --
  // a paste too short to be a transcript, say -- through the same
  // channel as a server failure, so the screen has one place errors
  // appear rather than each intake inventing its own.
  function fail(message) {
    runIdRef.current += 1
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

    const run = beginRun()
    setVideoSessionId(null)
    try {
      const data = await apiJson('/api/phrase/analyze', session, {
        method: 'POST',
        body: JSON.stringify({ phrase: trimmed, lang, source }),
      })
      if (run !== runIdRef.current) return
      setPassage({
        ...emptyPassage(),
        source,
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

  // ── video ─────────────────────────────────────────────────
  // There is no "load from URL": a server cannot get captions from
  // YouTube -- datacenter IPs are blocked AND the endpoint needs a token
  // YouTube's own player generates -- so both ingests are local, and
  // `url` is only ever the optional name of a video to play alongside
  // them. See docs/adr/0003's 2026-08-26 amendment.
  async function startVideoFromTranscript(transcript, { url, start, end }) {
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
      // Surface the parser's own message: it says what was wrong with
      // the paste, which is the useful thing. A generic failure here
      // would leave the learner with nothing to act on.
      setError((e.body && e.body.detail) || e.message)
      setStatus('failed')
    }
  }

  async function startVideoFromFile(file, { url, start, end }) {
    if (!file) return
    const run = beginRun()
    try {
      const formData = new FormData()
      formData.append('file', file)
      // Same rule as the JSON ingest: an absent bound is absent, not 0.
      if (start != null) formData.append('start', String(start))
      if (end != null) formData.append('end', String(end))
      // Optional, and never fetched from -- it just tells the player
      // which video to embed next to the subtitles.
      if (url?.trim()) formData.append('url', url.trim())
      const data = await apiUpload('/api/video/session', session, formData)
      if (run !== runIdRef.current) return
      setVideoSessionId(data.sessionId)
    } catch (e) {
      if (run !== runIdRef.current) return
      setError((e.body && e.body.detail) || e.message || t.subtitleTooLarge)
      setStatus('failed')
    }
  }

  // ── The poll ──────────────────────────────────────────────
  useEffect(() => {
    if (videoSessionId == null) return undefined
    let cancelled = false
    let timer = null

    async function poll() {
      try {
        const data = await apiJson(`/api/video/session/${videoSessionId}`, session)
        if (cancelled) return
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
          source: data.source ?? 'video',
          sourceRef: data.sourceRef,
          videoId: data.videoId ?? null,
          windowCapped: !!data.windowCapped,
          truncated: data.truncated ?? 0,
          sentences: data.sentences,
        })
        setFocus(0)
        setStatus('ready')
      } catch (e) {
        if (cancelled) return
        setError((e.body && e.body.error) || e.message)
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
  }, [videoSessionId, session])

  // ── The deep tier, one Sentence at a time ─────────────────
  // Never the whole Passage: it can be up to study/sentences
  // .MAX_SENTENCES long, and `deep` on every one of them would
  // multiply the cost by that many. See docs/adr/0001.
  async function explain(index) {
    const sentence = passage?.sentences?.[index]
    if (!sentence || explaining[index]) return

    setExplaining(prev => ({ ...prev, [index]: true }))
    const run = runIdRef.current
    try {
      const explained = videoSessionId != null
        ? await apiJson(
            `/api/video/session/${videoSessionId}/sentence/${index}/explain`,
            session,
            { method: 'POST', body: JSON.stringify({ lang }) },
          )
        : await apiJson('/api/phrase/analyze', session, {
            method: 'POST',
            body: JSON.stringify({ phrase: sentence.text, deep: true, lang, save: false }),
          }).then(data => data.sentences?.[0] ?? data)

      if (run !== runIdRef.current) return
      setPassage(prev => (prev
        ? { ...prev, sentences: prev.sentences.map((s, i) => (i === index ? explained : s)) }
        : prev))
    } catch {
      /* The Sentence keeps its local tier; nothing to undo. */
    } finally {
      setExplaining(prev => ({ ...prev, [index]: false }))
    }
  }

  function deleteHistoryEntry(id) {
    return apiFetch(`/api/phrase/history/${id}`, session, { method: 'DELETE' })
      .then(fetchHistory)
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
    error,
    history,
    focusIndex: safeIndex,
    setFocusIndex: setFocus,
    focused: sentences[safeIndex] ?? null,
    explaining,
    analyzeText,
    startVideoFromFile,
    startVideoFromTranscript,
    explain,
    loadHistoryEntry,
    deleteHistoryEntry,
    reset,
    fail,
  }
}
