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
  // The failure of the one PAID action on this screen used to be an
  // empty catch: the button greyed out, came back, and nothing changed.
  // A provider outage arrives as a 503 with a usable `detail` (see
  // routes/phrase.py's LLMUnavailable handler); everything else is a
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
  const fetchHistory = useCallback(() => {
    return Promise.all([
      apiFetch('/api/phrase/history', session)
        .then(r => (r.ok ? r.json() : []))
        .catch(() => []),
      apiFetch('/api/video/sessions', session)
        .then(r => (r.ok ? r.json() : []))
        .catch(() => []),
    ]).then(([passages, sessions]) => {
      const merged = [
        ...passages.map(p => ({
          kind: 'passage',
          id: p.id,
          label: p.phrase,
          source: p.source,
          createdAt: p.created_at,
          kept: p.kept,
        })),
        ...sessions.map(s => ({
          kind: 'session',
          id: s.id,
          label: s.sourceRef,
          source: s.source,
          createdAt: s.createdAt,
          sentenceCount: s.sentenceCount,
          videoId: s.videoId,
        })),
      ]
      merged.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      setHistory(merged)
      setKept(new Set(
        merged.filter(h => h.kind === 'passage' && h.kept).map(h => h.label),
      ))
    }).catch(() => setHistory([]))
  }, [session])

  useEffect(() => { fetchHistory() }, [fetchHistory])

  function beginRun() {
    runIdRef.current += 1
    setStatus('working')
    setError(null)
    setExplaining({})
    setExplainError({})
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
    setExplainError({})
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
    setExplainError(prev => ({ ...prev, [index]: null }))
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
        // saying so. Anything else is a generic failure.
        [index]: e?.status === 503 ? (e.message || t.explainUnavailable) : t.explainFailed,
      }))
    } finally {
      setExplaining(prev => ({ ...prev, [index]: false }))
    }
  }

  // 保存 -- pin or unpin ONE Sentence. Optimistic: pinning is a small,
  // reversible act and a spinner on it would cost more than the
  // occasional revert.
  async function keepSentence(index) {
    const sentence = passage?.sentences?.[index]
    if (!sentence) return
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
      fetchHistory()
    }
  }

  // Optimistic, with the row kept in hand. Deleting is frequent and
  // low-stakes, so a confirmation dialog is friction; an undo is not.
  //
  // The restore goes through the ordinary analyze-and-save path because
  // the DELETE is a hard delete -- there is no soft-delete column and
  // this is a frontend plan. So what comes back is the Passage with its
  // provenance, at a NEW id and a new timestamp. The copy says "Undo",
  // not "Restore", for exactly that reason.
  function deleteHistoryEntry(entry) {
    setLastDeleted(entry)
    setHistory(prev => prev.filter(h => !(h.kind === entry.kind && h.id === entry.id)))
    return apiFetch(`/api/phrase/history/${entry.id}`, session, { method: 'DELETE' })
      .then(fetchHistory)
      .catch(() => { setLastDeleted(null); fetchHistory() })
  }

  async function undoDelete() {
    const entry = lastDeleted
    if (!entry) return
    setLastDeleted(null)
    try {
      await apiJson('/api/phrase/analyze', session, {
        method: 'POST',
        body: JSON.stringify({ phrase: entry.label, lang, source: entry.source ?? 'typed' }),
      })
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
    error,
    history,
    focusIndex: safeIndex,
    setFocusIndex: setFocus,
    focused: sentences[safeIndex] ?? null,
    explaining,
    explainError,
    kept,
    keepSentence,
    analyzeText,
    startVideoFromFile,
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
