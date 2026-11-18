import { useEffect, useSyncExternalStore } from 'react'
import { apiJson } from './api'

// ── 札の帯 — what a card shows under its answer, fetched (plan 326) ──
// GET /api/card-extras?ids=…&lang=…: { extras: { card_id: {…} }, chosen }
// (backend study/card_extras.py). The learner's choice is read on the
// server, so the client sends ids alone, and asks for none when the
// learner chose nothing (stores/cardContents says so before any ask).
//
// Cards asked for in the same moment go as one request: a run asks for
// the card it shows and the next ones it holds (`ids`), so the strip is
// there when the card is turned, and the next card's comes with it.
// What came back is kept per language for the visit; a change of
// choice forgets it all (forgetCardExtras).

const WINDOW_MS = 30
// The server reads at most thirty a request (routes/card_extras.py).
const MAX_IDS = 30

const kept = new Map()        // `${lang}:${id}` -> extras | null (asked, nothing)
const asked = new Map()       // lang -> Set of ids waiting for the window
const listeners = new Set()
let timer = null
let lastSession = null
let generation = 0

function notify() { listeners.forEach(fn => fn()) }

function flush() {
  timer = null
  const gen = generation
  for (const [lang, ids] of asked) {
    asked.delete(lang)
    const list = [...ids]
    for (let i = 0; i < list.length; i += MAX_IDS) {
      const part = list.slice(i, i + MAX_IDS)
      const qs = `ids=${encodeURIComponent(part.join(','))}&lang=${encodeURIComponent(lang)}`
      apiJson(`/api/card-extras?${qs}`, lastSession)
        .then(res => {
          if (gen !== generation) return
          for (const id of part) {
            kept.delete(`${lang}:${id}:asking`)
            kept.set(`${lang}:${id}`, res?.extras?.[id] ?? null)
          }
          notify()
        })
        // A strip is an extra: a failed ask leaves the card as it was,
        // and the next card asks again.
        .catch(() => { if (gen === generation) for (const id of part) kept.delete(`${lang}:${id}:asking`) })
    }
  }
}

/** Ask for the strips of `ids` in `lang`, once each. */
export function askCardExtras(ids, lang, session) {
  if (!session) return
  lastSession = session
  let added = false
  for (const id of ids) {
    if (!id || kept.has(`${lang}:${id}`) || kept.has(`${lang}:${id}:asking`)) continue
    kept.set(`${lang}:${id}:asking`, true)
    if (!asked.has(lang)) asked.set(lang, new Set())
    asked.get(lang).add(id)
    added = true
  }
  if (added && !timer) timer = setTimeout(flush, WINDOW_MS)
}

/** The strip of card `id` in `lang`: undefined while unknown, null for none. */
export function peekCardExtras(id, lang) {
  const key = `${lang}:${id}`
  return kept.has(key) ? kept.get(key) : undefined
}

/** Forget every strip: the learner's choice changed, or they left. */
export function forgetCardExtras() {
  generation += 1
  kept.clear()
  asked.clear()
  if (timer) { clearTimeout(timer); timer = null }
  notify()
}

function subscribe(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

/** The strip of `id`, asking for it (and for `also`, the cards after it)
 *  when `active`. Re-renders when it arrives. */
export function useCardExtras(id, lang, session, active, also = []) {
  const extras = useSyncExternalStore(subscribe, () => (id ? peekCardExtras(id, lang) : undefined))
  const alsoKey = also.join(',')
  useEffect(() => {
    if (!active || !id) return
    askCardExtras([id, ...(alsoKey ? alsoKey.split(',') : [])], lang, session)
  }, [active, id, lang, session, alsoKey])
  return extras
}
