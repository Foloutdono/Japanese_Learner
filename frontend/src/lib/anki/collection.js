// ── An Anki collection, read for its progress (plan 243) ────────
// What the device sends the server out of a learner's collection, and
// nothing more (backend/study/transfer.py has the other half and the
// reasons): for each note of the chosen decks, its note type, its short
// Japanese fields (any other field sent empty, so a field keeps its
// place) and the schedule of its strongest graduated card. A deck's
// name, a note's other fields and every card Anki has not taught yet
// stay on the device.
//
// Both of Anki's schemas: the legacy one (collection.anki2/.anki21),
// whose note types and decks are JSON in `col`, and the current one
// (collection.anki21b, schema 18), whose are tables of their own.

import { DAYS, MAX_FIELD, MAX_FIELDS, MAX_NOTES, MAX_TYPES } from '../transfer/bounds'

// The bounds are every source's (lib/transfer/bounds.js, held equal to
// the server's); this module's consumers read them from here too.
export { MAX_FIELD, MAX_FIELDS, MAX_NOTES, MAX_TYPES }

export class AnkiError extends Error {
  /** `code` names the locale key the page prints (trErr). */
  constructor(code) {
    super(code)
    this.code = code
  }
}

const JAPANESE = /[぀-ヿ㐀-䶿一-鿿ｦ-ﾟ]/
const ENTITIES = { nbsp: ' ', amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" }

/** A field's HTML as text: ruby kept as Anki's own furigana (漢字[かんじ]),
 *  sounds, tags and entities gone, whitespace collapsed. */
export function cleanField(html) {
  return String(html ?? '')
    .replace(/<rp>[\s\S]*?<\/rp>/gi, '')
    .replace(/<ruby>([\s\S]*?)<\/ruby>/gi, (_, inner) => ` ${inner.replace(/<rt>([\s\S]*?)<\/rt>/gi, '[$1]')}`)
    .replace(/\[sound:[^\]]*\]/g, ' ')
    .replace(/\{\{c\d+::([\s\S]*?)(?:::[\s\S]*?)?\}\}/g, '$1')
    .replace(/<br\s*\/?>|<\/(?:div|p|li)>/gi, ' ')
    .replace(/<[^>]*>/g, '')
    .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
      if (e[0] === '#') {
        const code = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10)
        return Number.isFinite(code) && code > 0 && code < 0x110000 ? String.fromCodePoint(code) : ''
      }
      return ENTITIES[e.toLowerCase()] ?? m
    })
    .replace(/\s+/g, ' ')
    .trim()
}

/** The field as sent: its text when it is short and has Japanese in it,
 *  else empty. */
export function sendable(html) {
  const text = cleanField(html)
  return text.length <= MAX_FIELD && JAPANESE.test(text) ? text : ''
}

function rows(db, sql) {
  const result = db.exec(sql)[0]
  return result ? result.values : []
}

function tables(db) {
  return new Set(rows(db, "SELECT name FROM sqlite_master WHERE type = 'table'").map(r => r[0]))
}

function json(text) {
  try { return JSON.parse(text || '{}') || {} } catch { return {} }
}

function noteTypes(db, names, col) {
  if (names.has('notetypes') && names.has('fields')) {
    const fields = new Map()
    for (const [ntid, , name] of rows(db, 'SELECT ntid, ord, name FROM fields ORDER BY ntid, ord')) {
      if (!fields.has(String(ntid))) fields.set(String(ntid), [])
      fields.get(String(ntid)).push(name)
    }
    return rows(db, 'SELECT id, name FROM notetypes').map(([id, name]) => ({
      id: String(id), name, fields: fields.get(String(id)) ?? [],
    }))
  }
  return Object.values(json(col.models)).map(m => ({
    id: String(m.id),
    name: m.name ?? '',
    fields: [...(m.flds ?? [])].sort((a, b) => a.ord - b.ord).map(f => f.name),
  }))
}

function deckNames(db, names, col) {
  if (names.has('decks')) {
    // Schema 18 joins a deck's path with \x1f where the legacy one wrote ::.
    return new Map(rows(db, 'SELECT id, name FROM decks').map(([id, name]) => [String(id), String(name).replaceAll('\x1f', '::')]))
  }
  return new Map(Object.values(json(col.decks)).map(d => [String(d.id), d.name ?? '']))
}

function fsrsDifficulty(data) {
  if (!data || data[0] !== '{') return null
  try {
    const d = JSON.parse(data).d
    return typeof d === 'number' && Number.isFinite(d) ? d : null
  } catch {
    return null
  }
}

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, Math.round(v)))

/**
 * What the page and the payload need out of an open collection (a
 * sql.js Database):
 *   decks  [{id, name, known}] -- known: the notes with a Japanese field
 *          and a graduated card in that deck, the decks with none left out
 *   types  {id: {name, fields}} -- to name the field the server read
 *   notes  [{mid, fields, cards: [{did, i, e, d, u}]}], those with both
 *   cards, graduated, suspended -- counts, for what to say when none came
 * A card's due day `u` is counted from the learner's today, by Anki's
 * own day count from the collection's creation; one in intraday
 * learning carries a time, and is due now.
 */
export function readCollection(db, now = Date.now()) {
  const names = tables(db)
  if (!names.has('notes') || !names.has('cards') || !names.has('col')) throw new AnkiError('notAnki')
  const [crt, models, decksJson] = rows(db, 'SELECT crt, models, decks FROM col')[0] ?? [0, '', '']
  const col = { models, decks: decksJson }
  const nowSec = now / 1000
  const today = Math.floor((nowSec - Number(crt)) / 86400)

  const [[cards = 0] = []] = rows(db, 'SELECT COUNT(*) FROM cards')
  const byNote = new Map()
  let graduated = 0
  let suspended = 0
  // Review (2) and relearning (3) cards: what Anki has taught. A
  // suspended card (queue -1) was set aside by the learner, for being
  // known too well or never learnt, and says neither.
  const graded = rows(db, 'SELECT nid, did, odid, queue, due, odue, ivl, factor, data FROM cards WHERE type IN (2, 3)')
  for (const [nid, did, odid, queue, due, odue, ivl, factor, data] of graded) {
    graduated++
    if (queue === -1) { suspended++; continue }
    // A card in a filtered deck belongs to the deck it came from, and
    // keeps its own due day there.
    const own = odid ? odue || due : due
    const u = queue === 1 || own > 1e9 ? Math.floor((own - nowSec) / 86400) : own - today
    const card = {
      did: String(odid || did),
      i: clamp(ivl, 1, DAYS),
      e: clamp(factor || 0, 0, DAYS),
      d: fsrsDifficulty(data),
      u: clamp(u, -DAYS, DAYS),
    }
    if (card.d != null) card.d = Math.min(10, Math.max(1, card.d))
    const key = String(nid)
    if (!byNote.has(key)) byNote.set(key, [])
    byNote.get(key).push(card)
  }

  const notes = []
  const known = new Map()
  for (const [id, mid, flds] of rows(db, 'SELECT id, mid, flds FROM notes')) {
    const held = byNote.get(String(id))
    if (!held) continue
    const fields = String(flds).split('\x1f').slice(0, MAX_FIELDS).map(sendable)
    if (!fields.some(Boolean)) continue
    while (fields.length && !fields[fields.length - 1]) fields.pop()
    notes.push({ mid: String(mid), fields, cards: held })
    for (const did of new Set(held.map(c => c.did))) known.set(did, (known.get(did) ?? 0) + 1)
  }

  const deckName = deckNames(db, names, col)
  const decks = [...known]
    .map(([id, n]) => ({ id, name: deckName.get(id) ?? id, known: n }))
    .sort((a, b) => a.name.localeCompare(b.name))
  const types = Object.fromEntries(noteTypes(db, names, col).map(t => [t.id, { name: t.name, fields: t.fields }]))
  return { decks, types, notes, cards, graduated, suspended }
}

/**
 * The body POST /api/transfer/preview and /import take, for the decks
 * chosen: each note's strongest card among those decks (the longest
 * interval, then the one due later), its note type as an index into
 * `mids`. `over` says the decks hold more notes than one import takes.
 */
export function buildPayload(collection, deckIds) {
  const chosen = new Set(deckIds)
  const index = new Map()
  const notes = []
  for (const note of collection.notes) {
    let best = null
    for (const c of note.cards) {
      if (!chosen.has(c.did)) continue
      if (!best || c.i > best.i || (c.i === best.i && c.u > best.u)) best = c
    }
    if (!best) continue
    if (!index.has(note.mid)) {
      if (index.size >= MAX_TYPES) continue
      index.set(note.mid, index.size)
    }
    const out = { t: index.get(note.mid), f: note.fields, i: best.i, u: best.u }
    if (best.e) out.e = best.e
    if (best.d != null) out.d = best.d
    notes.push(out)
  }
  return { body: { notes: notes.slice(0, MAX_NOTES) }, mids: [...index.keys()], over: notes.length > MAX_NOTES }
}
