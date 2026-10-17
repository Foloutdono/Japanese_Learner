// ── 乗換 — what one transfer may send (plans 243, 243b) ──────────
// Held equal to backend/study/transfer.py and routes/transfer.py by
// backend/tests/test_transfer.py: a device sending more is refused
// whole, and one sending less would lose notes it need not.
export const MAX_NOTES = 20000
export const MAX_TYPES = 64
export const MAX_FIELDS = 16
export const MAX_FIELD = 40

// Where the notes come from, in the order the ticket offers them.
export const SOURCES = ['anki', 'wanikani', 'renshuu']

// The bounds routes/transfer.py holds a note's schedule to.
export const DAYS = 100000

export class TransferError extends Error {
  /** `code` names the locale key the page prints (trErr). */
  constructor(code) {
    super(code)
    this.code = code
  }
}

export const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, Math.round(v)))

const DAY_MS = 86400000

/** Whole days from `now` to an instant (negative when it is past). */
export const daysUntil = (ms, now) => Math.floor((ms - now) / DAY_MS)

/** A collection of notes per kind, in the shape lib/anki's
 *  readCollection returns and buildPayload takes: one "deck" a kind
 *  (vocab, kanji), named by the page; one note type a kind too, its
 *  fields the written form and the reading. */
export function kindCollection(notes) {
  const decks = ['vocab', 'kanji']
    .map(id => ({ id, name: null, known: notes.filter(n => n.cards[0].did === id).length }))
    .filter(d => d.known > 0)
  const types = {
    vocab: { name: null, fields: ['word', 'reading'] },
    kanji: { name: null, fields: ['kanji'] },
  }
  return { decks, types, notes, cards: notes.length, graduated: notes.length, suspended: 0 }
}

/** Seconds a 429 asks to wait: Retry-After (Renshuu), or until
 *  RateLimit-Reset, an instant in Unix seconds (WaniKani exposes that
 *  one alone to a browser); ten when neither says. */
function waitAsked(headers, now) {
  const after = Number(headers?.get?.('Retry-After'))
  if (after > 0) return after
  const reset = Number(headers?.get?.('RateLimit-Reset'))
  if (reset > 0) return Math.max(1, Math.ceil(reset - now / 1000))
  return 10
}

/** One page after another until `next(body)` says there is none. A
 *  429 waits what the API asks (at most a minute) and tries again,
 *  twice; anything else that is not a 200 ends the read. */
export async function pages(first, { fetch, headers, next, onPage, sleep, limit = 400 }) {
  const out = []
  let url = first
  for (let n = 0; url && n < limit; n++) {
    let r
    for (let attempt = 0; ; attempt++) {
      try {
        r = await fetch(url, { headers })
      } catch {
        throw new TransferError('network')
      }
      if (r.status !== 429 || attempt >= 2) break
      await sleep(Math.min(60, waitAsked(r.headers, Date.now())) * 1000)
    }
    if (r.status === 401 || r.status === 403) throw new TransferError('badKey')
    if (r.status === 429) throw new TransferError('rate')
    if (!r.ok) throw new TransferError('unreachable')
    const body = await r.json()
    out.push(body)
    onPage?.(n + 1, body)
    url = next(body, n + 1)
  }
  return out
}

export const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))
