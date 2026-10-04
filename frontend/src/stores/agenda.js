import { apiJson } from '../lib/api'
import { currentSession } from '../lib/session'
import { forServer } from '../domain/agenda'
import { createRemoteStore } from './remote'

// ── 時間割 — the learner's weekly agenda, shared (plan 181) ──────
// Settings › Agenda edits it and NativeBridge plans its notifications
// from it, so the two read one answer. Five minutes before a revisit
// refetches; a save replaces the answer on the spot with the server's
// own (ids included), so nothing waits for a second request.
const store = createRemoteStore('/api/agenda', { ttlMs: 300_000 })

/** { blocks, failed }: `blocks` is null until the first answer. */
export function useAgenda() {
  const { data, failed } = store.use()
  return { blocks: data?.blocks ?? null, failed }
}

export function refreshAgenda() {
  return store.refresh()
}

export function seedAgenda(blocks) {
  store.seed({ blocks })
}

/** Replace the week. Resolves to the blocks as stored; rejects with the
 *  ApiError the page words (an overlap is a 422 whose detail.code says
 *  so). */
export async function saveAgenda(blocks) {
  const out = await apiJson('/api/agenda', await currentSession(), { method: 'PUT', body: JSON.stringify({ blocks: forServer(blocks) }) })
  store.seed(out)
  return out.blocks
}

/** The learner has signed out (stores/account): the week was theirs. */
export function forgetAgenda() {
  store.forget()
}
