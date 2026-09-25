import { useCallback, useRef, useState } from 'react'
import { apiFetch } from '../lib/api'
import { useLang } from '../LangContext'
import { askHistory, askResetsAt, MAX_TURNS } from '../domain/ask'

// ── 問 — the asking's state, for one practice run (plan 131) ──────────
// A thread per sentence, keyed as the run's lines are (hooks/useRunLines):
// the sentence on the stage has its key, and a line reopened from the
// list keeps its own thread, so going back to a sentence finds what was
// asked about it. A question goes out with the exercise's context
// (domain/ask's askContext) and the thread's answered exchanges; the
// answer, a decline (the question was not the exercise's) or a failure
// comes back into the same entry.
//
//   thread(key)          the entries, oldest first: { id, question,
//                        answer, state: 'pending'|'done'|'off'|'error',
//                        error }
//   ask(key, context, q) one question; nothing while one is out, past
//                        MAX_TURNS for the sentence, or on a spent day
//   left                 today's questions still to ask, once known
//   spent                the day's are spent: { at } (when they come
//                        back, ISO, or null)
//
// Nothing is kept past the run: the threads are this component's
// state, the server stores nothing the learner typed, and a new run
// starts with none (`reset`).
export function useAsk(session, mode) {
  const { t, lang } = useLang()
  const [threads, setThreads] = useState({})
  const [left, setLeft] = useState(null)
  const [spent, setSpent] = useState(null)
  const counter = useRef(0)
  const busy = useRef(false)

  const patch = useCallback((key, id, fields) => {
    setThreads(all => ({
      ...all,
      [key]: (all[key] ?? []).map(x => (x.id === id ? { ...x, ...fields } : x)),
    }))
  }, [])

  const thread = useCallback(key => threads[key] ?? [], [threads])

  const ask = useCallback((key, context, question) => {
    const q = question.trim()
    const current = threads[key] ?? []
    if (!q || busy.current || spent || current.length >= MAX_TURNS) return false
    const id = ++counter.current
    busy.current = true
    setThreads(all => ({ ...all, [key]: [...(all[key] ?? []), { id, question: q, answer: null, state: 'pending' }] }))
    apiFetch('/api/ask', session, {
      method: 'POST',
      body: JSON.stringify({ mode, ...context, history: askHistory(current), question: q, lang }),
    })
      .then(async r => {
        const body = await r.json().catch(() => ({}))
        if (r.status === 429) {
          setSpent({ at: askResetsAt(body?.detail) })
          setLeft(0)
          patch(key, id, { state: 'error', error: 'spent' })
          return
        }
        if (!r.ok) {
          patch(key, id, { state: 'error', error: r.status === 503 ? 'unavailable' : 'failed' })
          return
        }
        if (typeof body.left === 'number') setLeft(body.left)
        if (body.off_topic) patch(key, id, { state: 'off' })
        else patch(key, id, { state: 'done', answer: body.answer })
      })
      .catch(() => patch(key, id, { state: 'error', error: 'failed' }))
      .finally(() => { busy.current = false })
    return true
  }, [threads, spent, session, mode, lang, patch])

  const reset = useCallback(() => {
    setThreads({})
    busy.current = false
  }, [])

  const pending = Object.values(threads).some(list => list.some(x => x.state === 'pending'))
  const message = useCallback(entry => {
    if (entry.state === 'off') return t.askOffTopic
    if (entry.error === 'unavailable') return t.askUnavailable
    if (entry.error === 'spent') return t.askSpent(null)
    return t.askFailed
  }, [t])

  return { thread, ask, reset, left, spent, pending, message }
}
