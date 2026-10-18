import { useEffect, useRef, useState } from 'react'
import { apiJson } from '../../lib/api'

// ── 訳 — the translation under each line (plan 235) ─────────────────
// A Passage's lines are translated a block at a time on the server
// (backend/study/line_translate.py: one model call for BLOCK lines,
// kept where the Passage is kept), so this asks for the block the line
// in focus falls in, and the next one a few lines before the learner
// reaches it, so the translation is there when the line is. A block is
// asked once per Passage and language: a refusal (the day's ceiling,
// the model down) leaves its lines without a translation rather than
// asking again on every step -- a translation helps the line, and the
// line reads without it. A request the link dropped got no answer at
// all, and is asked again when the line next moves.
//
// `path` is where the Passage's translations are asked: a video
// session's (`/api/video/session/<id>/translations`) or a typed or
// photographed Passage's history row (`/api/phrase/history/<id>/
// translations`); null for a Passage saved nowhere, whose translation
// is still the one Explain buys (plan 161).
//
// `about()` says what the video is, where the player knows (its title
// and channel), read when a block is asked.

// The server's study/line_translate.BLOCK (backend/tests/
// test_line_translate.py holds the two equal).
export const BLOCK = 20
// How many lines before a block's end the next one is asked.
const AHEAD = 5

const NONE = {}

export function useLineTranslations({ session, path, count, focusIndex, lang, about }) {
  // The translations of one Passage in one language, under its key: a
  // new Passage or another language reads as none until its own come.
  const key = path ? `${path}:${lang}` : ''
  const [held, setHeld] = useState({ key: '', lines: NONE })
  // The blocks asked for the Passage and language in hand: a Passage
  // opened again after another is asked again (its row keeps its
  // translations, so that costs no model call).
  const asked = useRef({ key: '', starts: new Set() })
  const current = useRef(key)
  const aboutRef = useRef(about)
  useEffect(() => {
    current.current = key
    aboutRef.current = about
  })

  useEffect(() => {
    if (!key || !(count > 0)) return
    if (asked.current.key !== key) asked.current = { key, starts: new Set() }
    const start = focusIndex - (focusIndex % BLOCK)
    const starts = [start]
    if (focusIndex - start >= BLOCK - AHEAD && start + BLOCK < count) starts.push(start + BLOCK)
    for (const from of starts) {
      if (asked.current.starts.has(from)) continue
      asked.current.starts.add(from)
      const { title = '', channel = '' } = aboutRef.current?.() ?? {}
      apiJson(path, session, {
        method: 'POST',
        body: JSON.stringify({ lang, index: from, title, channel }),
      })
        .then(data => {
          // A block that lands after the Passage or the language moved on.
          if (current.current !== key) return
          setHeld(prev => {
            const lines = { ...(prev.key === key ? prev.lines : NONE) }
            ;(data?.lines ?? []).forEach((text, k) => { if (text) lines[data.start + k] = text })
            return { key, lines }
          })
        })
        // A request that got no answer at all (the link dropped) is not
        // a refusal: its block is asked again at the next step.
        .catch(e => {
          if (e?.status == null && asked.current.key === key) asked.current.starts.delete(from)
        })
    }
  }, [key, count, focusIndex, session, path, lang])

  return held.key === key ? held.lines : NONE
}
