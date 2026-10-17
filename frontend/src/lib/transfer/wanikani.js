import { sendable } from '../anki/collection'
import { TransferError, clamp, daysUntil, kindCollection, pages, sleep as wait, DAYS } from './bounds'

// ── WaniKani, read on the device (plan 243b) ──────────────────────
// Through WaniKani's own API (v2, docs.api.wanikani.com), with the
// learner's personal access token, from the browser: the API answers
// any origin, so the token goes to WaniKani and nowhere else -- never
// to our server, never into storage. A token with no write permission
// is enough; nothing here writes.
//
// What is read: the assignments WaniKani has passed (Guru and up,
// srs_stage 5 to 9, burned included) for kanji and vocabulary, and the
// subjects they name, for their characters and reading. Radicals have
// no card here. WaniKani keeps no ease; a stage's interval is its
// default system's (Guru 1 a week ... Enlightened four months), a
// burned item's a half-year, and it is due with the rest of the
// checks (study/transfer.rows spreads them). Its content is WaniKani's:
// only the characters and the reading are sent, to find our own card.
const API = 'https://api.wanikani.com/v2'
const STAGES = '5,6,7,8,9'
const TYPES = 'kanji,vocabulary,kana_vocabulary'
// WaniKani's default spaced-repetition system, from Guru up, in days.
const STAGE_DAYS = { 5: 7, 6: 14, 7: 30, 8: 120, 9: 180 }
// Subjects asked for by id, this many to a request: well under a URL's
// length, and one page of the API's thousand.
const CHUNK = 500

function primaryReading(subject) {
  const readings = subject.data?.readings ?? []
  return (readings.find(r => r.primary) ?? readings[0])?.reading ?? ''
}

/**
 * The learner's WaniKani progress as a collection buildPayload takes.
 * `onProgress(n)` is told how many pages have been read so far.
 */
export async function readWaniKani(token, { fetch = globalThis.fetch.bind(globalThis), now = Date.now(), onProgress, sleep = wait } = {}) {
  const key = String(token ?? '').trim()
  if (!key) throw new TransferError('badKey')
  const headers = { Authorization: `Bearer ${key}` }
  let read = 0
  const onPage = () => onProgress?.(++read)
  const next = body => body?.pages?.next_url ?? null

  const assignments = (await pages(
    `${API}/assignments?srs_stages=${STAGES}&subject_types=${TYPES}&hidden=false`,
    { fetch, headers, next, onPage, sleep },
  )).flatMap(body => body.data ?? [])
  if (!assignments.length) throw new TransferError('nothing')

  const ids = [...new Set(assignments.map(a => a.data?.subject_id).filter(Number.isInteger))]
  const subjects = new Map()
  for (let i = 0; i < ids.length; i += CHUNK) {
    const found = await pages(`${API}/subjects?ids=${ids.slice(i, i + CHUNK).join(',')}`, { fetch, headers, next, onPage, sleep })
    for (const s of found.flatMap(body => body.data ?? [])) subjects.set(s.id, s)
  }

  const notes = []
  for (const a of assignments) {
    const subject = subjects.get(a.data?.subject_id)
    const stage = a.data?.srs_stage
    if (!subject || !STAGE_DAYS[stage]) continue
    const kanji = subject.object === 'kanji'
    const written = sendable(subject.data?.characters ?? '')
    if (!written) continue
    const fields = kanji ? [written] : [written, sendable(primaryReading(subject))]
    const due = a.data?.available_at ? Date.parse(a.data.available_at) : NaN
    notes.push({
      mid: kanji ? 'kanji' : 'vocab',
      fields: fields[1] === '' ? [written] : fields,
      cards: [{
        did: kanji ? 'kanji' : 'vocab',
        i: STAGE_DAYS[stage],
        e: 0,
        d: null,
        u: Number.isFinite(due) ? clamp(daysUntil(due, now), -DAYS, DAYS) : 0,
      }],
    })
  }
  if (!notes.length) throw new TransferError('nothing')
  return kindCollection(notes)
}
