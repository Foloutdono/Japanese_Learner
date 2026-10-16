import { useEffect, useRef, useState } from 'react'
import { apiJsonWithTimeout } from '../../lib/api'

// ── 実力診断 — the climb, as a screen's state (plan 224) ──────────
// The test asks at N5 and goes up a level each time the learner clears
// one; the first level they do not clear is where they board
// (study/placement.walk). The server is the judge and keeps nothing:
// every answer so far is sent back with the seed, and it answers with
// the next question or the verdict. So there is one round trip a
// question, and the answer key never reaches the browser.
//
// Shared by the test in Settings (PlacementTest) and the boarding's
// own (boarding/TestStep), which draw it each in their frame.
//
//   phase    loading | question | waiting | error
//   question the question being asked (no answer key)
//   level    the level it is asked at
//   perLevel { N5: { correct, total, cleared } ... } so far
//   answer(choiceId)  send it; the next question or the verdict follows
//   stop()            "too hard": board at the level being asked
//   retry()           after an error: the last send again (or a new start)
//
// `onResult` receives the verdict: { recommendedLevel, perLevel,
// correct, total }.
const TIMEOUT_MS = 10000

export function useClimb(session, onResult) {
  const [state, setState] = useState({ phase: 'loading', question: null, level: null, perLevel: {} })
  const [attempt, setAttempt] = useState(0)
  const seed = useRef(null)
  const answers = useRef({})
  const stopped = useRef(false)
  const report = useRef(onResult)
  // The session as it stands at each call: a token refreshed mid-test
  // is a new session object, and must not start the test over.
  const auth = useRef(session)
  useEffect(() => { report.current = onResult; auth.current = session })

  function take(body) {
    if (body.done) {
      report.current?.(body)
      return
    }
    setState({ phase: 'question', question: body.question, level: body.level, perLevel: body.perLevel ?? {} })
  }

  // Initial phase is already 'loading', so the effect only reports the
  // fetch's outcome -- no synchronous setState on mount; a retry sets
  // 'loading' itself before it bumps the attempt.
  useEffect(() => {
    let live = true
    seed.current = null
    answers.current = {}
    apiJsonWithTimeout('/api/onboarding/placement/start', auth.current, { method: 'POST', timeoutMs: TIMEOUT_MS })
      .then(body => {
        if (!live) return
        seed.current = body.seed
        take(body)
      })
      .catch(() => { if (live) setState(s => ({ ...s, phase: 'error' })) })
    return () => { live = false }
  }, [attempt])

  function send() {
    setState(s => ({ ...s, phase: 'waiting' }))
    apiJsonWithTimeout('/api/onboarding/placement/answer', auth.current, {
      method: 'POST',
      timeoutMs: TIMEOUT_MS,
      body: JSON.stringify({ seed: seed.current, answers: answers.current, ...(stopped.current ? { stop: true } : {}) }),
    })
      .then(take)
      .catch(() => setState(s => ({ ...s, phase: 'error' })))
  }

  // One send at a time: a second press while the first is on its way
  // is the same answer twice.
  function answer(choiceId) {
    if (state.phase !== 'question' || !state.question) return
    answers.current = { ...answers.current, [state.question.id]: choiceId }
    send()
  }

  function stop() {
    if (state.phase !== 'question') return
    stopped.current = true
    send()
  }

  function retry() {
    if (seed.current == null) {
      setState(s => ({ ...s, phase: 'loading' }))
      setAttempt(n => n + 1)
    } else {
      send()
    }
  }

  return { ...state, answer, stop, retry }
}
