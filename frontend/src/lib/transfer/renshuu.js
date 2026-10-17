import { sendable } from '../anki/collection'
import { TransferError, clamp, daysUntil, kindCollection, pages, sleep as wait, DAYS } from './bounds'

// ── Renshuu, read on the device (plan 243b) ───────────────────────
// Through Renshuu's own API (api.renshuu.org/v1, its /api-docs), with
// the learner's API key from Renshuu's settings, from the browser: the
// API answers any origin, so the key goes to Renshuu and nowhere else
// -- never to our server, never into storage.
//
// What is read: every word and kanji the learner has studied
// (GET /list/all/vocab and /kanji, fifty a page). Each carries, per
// direction it is quizzed in (`user_data.study_vectors`), when it was
// last quizzed and when it is next; the gap between the two is the
// interval Renshuu chose, and the direction with the longest is the
// card's, as Anki's strongest card is a note's. A term never quizzed,
// or due again within the day, has not been taught yet and is left
// out. Renshuu keeps no ease. Its grammar has no card here yet.
const API = 'https://api.renshuu.org/v1'
const KINDS = ['vocab', 'kanji']
const DAY_MS = 86400000

// Renshuu writes its dates as "2024/03/18", a day with no time; "Not
// yet" and anything else is no date.
function day(text) {
  const m = /^(\d{4})\/(\d{1,2})\/(\d{1,2})$/.exec(String(text ?? '').trim())
  return m ? Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : NaN
}

/** The strongest direction's (interval, next quiz), or null. */
function schedule(term) {
  let best = null
  for (const vector of Object.values(term?.user_data?.study_vectors ?? {})) {
    const last = day(vector?.last_quizzed)
    const next = day(vector?.next_quiz)
    if (!Number.isFinite(last) || !Number.isFinite(next)) continue
    const interval = Math.round((next - last) / DAY_MS)
    if (interval >= 1 && (!best || interval > best.interval)) best = { interval, next }
  }
  return best
}

function fieldsOf(kind, term) {
  if (kind === 'kanji') return [sendable(term.kanji)]
  const kana = sendable(term.hiragana_full)
  const written = sendable(term.kanji_full) || kana
  return kana && kana !== written ? [written, kana] : [written]
}

/**
 * The learner's Renshuu progress as a collection buildPayload takes.
 * `onProgress(n)` is told how many pages have been read so far.
 */
export async function readRenshuu(key, { fetch = globalThis.fetch.bind(globalThis), now = Date.now(), onProgress, sleep = wait } = {}) {
  const token = String(key ?? '').trim()
  if (!token) throw new TransferError('badKey')
  const headers = { Authorization: `Bearer ${token}` }
  let read = 0
  const onPage = () => onProgress?.(++read)
  // Midnight UTC today: Renshuu's next quiz is a day, so is ours.
  const today = Math.floor(now / DAY_MS) * DAY_MS

  const notes = []
  for (const kind of KINDS) {
    const bodies = await pages(`${API}/list/all/${kind}?pg=1`, {
      fetch, headers, onPage, sleep,
      next: (body, n) => (n < (body?.contents?.total_pg ?? 0) ? `${API}/list/all/${kind}?pg=${n + 1}` : null),
    })
    for (const term of bodies.flatMap(body => body?.contents?.terms ?? [])) {
      const when = schedule(term)
      const fields = fieldsOf(kind, term)
      if (!when || !fields[0]) continue
      notes.push({
        mid: kind,
        fields,
        cards: [{ did: kind, i: clamp(when.interval, 1, DAYS), e: 0, d: null, u: clamp(daysUntil(when.next, today), -DAYS, DAYS) }],
      })
    }
  }
  if (!notes.length) throw new TransferError('nothing')
  return kindCollection(notes)
}
