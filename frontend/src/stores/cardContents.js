import { createRemoteStore } from './remote'
import { apiJson } from '../lib/api'
import { track } from '../lib/track'
import { forgetCardExtras } from '../lib/cardExtras'

// ── 札の中身 — what the learner's flip cards show (plan 326) ──
// GET /api/profile/card-contents: { vocab: [field], kanji: [field],
// choices: { line: { question: [field], answer: [field] } } }, every
// line answered (backend study/card_contents.py). Asked by Réglages ›
// Card contents and by a card run once it draws a card of a line that
// has a strip, never at boot: a learner who chose nothing asks for no
// strip after that one answer. A change writes through PATCH
// /api/profile/learning, and the strips kept for the old choice go.
const store = createRemoteStore('/api/profile/card-contents', { ttlMs: 5 * 60_000 })

/** { data, failed } -- data null until the first answer. */
export function useCardContents() {
  return store.use()
}

let saving = Promise.resolve()

/** What `line`'s cards show from now on: the whole list of its fields. */
export function setCardContents(line, fields, session) {
  track('setting_change', { setting: 'card_contents', value: 'changed' })   // plan 218
  const now = store.peek()
  // Drawn at once: a switch answers the finger, the save follows.
  if (now) store.seed({ ...now, [line]: fields })
  forgetCardExtras()
  const saved = saving.then(() => apiJson('/api/profile/learning', session, {
    method: 'PATCH',
    body: JSON.stringify({ cardContents: { [line]: fields } }),
  }))
  saving = saved.catch(() => {})
  return saved
    .then(res => {
      const after = store.peek()
      if (res?.cardContents && after) store.seed({ ...after, ...res.cardContents })
      return res
    })
    .catch(err => {
      store.refresh()
      throw err
    })
}

/** The learner these choices belong to has signed out (stores/account). */
export function forgetCardContents() {
  store.forget()
  forgetCardExtras()
}
