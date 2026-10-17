import { describe, expect, it } from 'vitest'
import initSqlJs from 'sql.js'
import { strToU8, zipSync } from 'fflate'
import { readAnkiFile, buildPayload, AnkiError, MAX_NOTES } from './index'
import { cleanField, sendable, MAX_FIELD } from './collection'
import { listEntries, readEntry } from './zip'

// ── Reading an Anki file (plan 243) ─────────────────────────────
// Real collections, built here with the same SQLite the reader opens:
// the legacy schema (note types and decks as JSON in `col`) and the
// current one (tables of their own, the file zstd-compressed beside a
// stub), zipped deflated and stored as Anki writes them.

const DAY = 86400
const NOW = Date.UTC(2026, 9, 17, 12) // the reader's clock in every test
const CRT = NOW / 1000 - 100 * DAY // the collection is 100 days old: today is day 100
const LONG = '毎日パンを食べます。とてもおいしいですから、毎朝かならず駅の前のパン屋で買って食べています。'

const SCHEMA = `
  CREATE TABLE col (id integer primary key, crt integer, models text, decks text);
  CREATE TABLE notes (id integer primary key, mid integer, flds text);
  CREATE TABLE cards (id integer primary key, nid integer, did integer, odid integer, type integer,
                      queue integer, due integer, odue integer, ivl integer, factor integer, data text);`

// [note id, fields, cards: [did, odid, type, queue, due, odue, ivl, factor, data]]
const NOTES = [
  [1, ['1', '食べる', '<b>食[た]べる</b>', 'to eat', LONG], [
    [1, 0, 2, 2, 110, 0, 30, 2500, ''],
    [1, 0, 2, 2, 103, 0, 5, 2300, ''],
  ]],
  [2, ['2', '学校', 'がっこう', 'school'], [[1, 0, 0, 0, 2, 0, 0, 0, '']]],         // new: not taught yet
  [3, ['3', '飲む', 'のむ', 'to drink'], [[1, 0, 2, -1, 120, 0, 40, 2500, '']]],    // suspended
  [4, ['4', '見る', 'みる', 'to see'], [[99, 1, 2, 2, 101, 95, 12, 2500, '{"s":3.1,"d":7.5}']]], // in a filtered deck
  [5, ['hello', 'world'], [[2, 0, 2, 2, 130, 0, 9, 2500, '']]],                       // nothing Japanese
]

async function sql() {
  return initSqlJs()
}

async function collection({ modern = false, schedule = true } = {}) {
  const SQL = await sql()
  const db = new SQL.Database()
  db.run(SCHEMA)
  const fields = ['Index', 'Expression', 'Reading', 'Meaning', 'Sentence']
  if (modern) {
    db.run('CREATE TABLE notetypes (id integer primary key, name text); CREATE TABLE fields (ntid integer, ord integer, name text); CREATE TABLE decks (id integer primary key, name text)')
    db.run('INSERT INTO notetypes VALUES (7, ?)', ['Core'])
    fields.forEach((name, ord) => db.run('INSERT INTO fields VALUES (7, ?, ?)', [ord, name]))
    db.run('INSERT INTO decks VALUES (1, ?), (2, ?), (99, ?)', ['Japanese\x1fCore', 'English', 'Filtered'])
    db.run('INSERT INTO col VALUES (1, ?, ?, ?)', [CRT, '', ''])
  } else {
    const models = { 7: { id: 7, name: 'Core', flds: fields.map((name, ord) => ({ name, ord })).reverse() } }
    const decks = { 1: { id: 1, name: 'Japanese::Core' }, 2: { id: 2, name: 'English' }, 99: { id: 99, name: 'Filtered' } }
    db.run('INSERT INTO col VALUES (1, ?, ?, ?)', [CRT, JSON.stringify(models), JSON.stringify(decks)])
  }
  let card = 1
  for (const [id, flds, cards] of NOTES) {
    db.run('INSERT INTO notes VALUES (?, 7, ?)', [id, flds.join('\x1f')])
    for (const [did, odid, type, queue, due, odue, ivl, factor, data] of cards) {
      db.run('INSERT INTO cards VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [card++, id, did, odid, schedule ? type : 0, schedule ? queue : 0, due, odue, schedule ? ivl : 0, factor, data])
    }
  }
  const bytes = db.export()
  db.close()
  return bytes
}

// A zstd frame of raw blocks: the format fzstd reads, without a
// compressor to make it.
function zstdRaw(data) {
  const parts = [Uint8Array.of(0x28, 0xb5, 0x2f, 0xfd, 0xa0, ...new Uint8Array(new Uint32Array([data.length]).buffer))]
  const MAX = 128 * 1024
  for (let at = 0; at < data.length || at === 0; at += MAX) {
    const block = data.subarray(at, at + MAX)
    const last = at + MAX >= data.length ? 1 : 0
    const header = (block.length << 3) | last
    parts.push(Uint8Array.of(header & 0xff, (header >> 8) & 0xff, (header >> 16) & 0xff), block)
    if (last) break
  }
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0))
  let at = 0
  for (const p of parts) { out.set(p, at); at += p.length }
  return out
}

async function legacyFile(opts) {
  return new Blob([zipSync({ 'collection.anki21': await collection(opts), media: strToU8('{}') })])
}

async function modernFile() {
  return new Blob([zipSync({
    'collection.anki2': strToU8('please update to the latest Anki version'),
    'collection.anki21b': [zstdRaw(await collection({ modern: true })), { level: 0 }],
    media: strToU8(''),
  })])
}

function realNow(fn) {
  const real = Date.now
  Date.now = () => NOW
  return fn().finally(() => { Date.now = real })
}

describe('reading a field', () => {
  it('keeps ruby as Anki furigana and drops markup', () => {
    expect(cleanField('<ruby>漢字<rt>かんじ</rt></ruby>')).toBe('漢字[かんじ]')
    expect(cleanField('お<ruby>茶<rp>(</rp><rt>ちゃ</rt><rp>)</rp></ruby>')).toBe('お 茶[ちゃ]')
    expect(cleanField('<div>食べる</div><br>[sound:taberu.mp3]')).toBe('食べる')
    expect(cleanField('&nbsp;犬&amp;猫&#x732b;&#29483;')).toBe('犬&猫猫猫')
    expect(cleanField('{{c1::食べ::eat}}る')).toBe('食べる')
  })

  it('sends only short fields with Japanese in them', () => {
    expect(sendable('to eat')).toBe('')
    expect(sendable('食べる')).toBe('食べる')
    expect(sendable('あ'.repeat(MAX_FIELD + 1))).toBe('')
  })
})

describe('reading a collection', () => {
  for (const [label, file] of [['the legacy schema, deflated', () => legacyFile()], ['schema 18, zstd', modernFile]]) {
    it(`reads ${label}`, () => realNow(async () => {
      const c = await readAnkiFile(await file())
      // Japanese::Core holds 食べる and, through the filtered deck it sits
      // in, 見る; the suspended 飲む, the new 学校 and the English note
      // count for nothing.
      expect(c.decks).toEqual([{ id: '1', name: 'Japanese::Core', known: 2 }])
      expect(c.types['7']).toEqual({ name: 'Core', fields: ['Index', 'Expression', 'Reading', 'Meaning', 'Sentence'] })
      expect([c.cards, c.graduated, c.suspended]).toEqual([6, 5, 1])
      const [eat, see] = c.notes
      expect(eat.fields).toEqual(['', '食べる', '食[た]べる'])
      expect(eat.cards).toEqual([
        { did: '1', i: 30, e: 2500, d: null, u: 10 },
        { did: '1', i: 5, e: 2300, d: null, u: 3 },
      ])
      expect(see.cards).toEqual([{ did: '1', i: 12, e: 2500, d: 7.5, u: -5 }])
    }))
  }

  it('says when a deck was exported without its scheduling', async () => {
    await expect(readAnkiFile(await legacyFile({ schedule: false }))).rejects.toMatchObject({ code: 'noSchedule' })
  })

  it('refuses what is not an Anki file', async () => {
    await expect(readAnkiFile(new Blob(['not a zip at all']))).rejects.toBeInstanceOf(AnkiError)
    await expect(readAnkiFile(new Blob([zipSync({ 'a.txt': strToU8('x') })]))).rejects.toMatchObject({ code: 'notAnki' })
    await expect(readAnkiFile(new Blob([zipSync({ 'collection.anki21': strToU8('garbage') })]))).rejects.toMatchObject({ code: 'unreadable' })
  })

  it('reads one entry out of a zip, stored or deflated', async () => {
    const zip = new Blob([zipSync({ a: [strToU8('stored'), { level: 0 }], b: [strToU8('deflated '.repeat(50)), { level: 9 }] })])
    const entries = await listEntries(zip)
    expect(entries.map(e => [e.name, e.method])).toEqual([['a', 0], ['b', 8]])
    expect(new TextDecoder().decode(await readEntry(zip, entries[1]))).toBe('deflated '.repeat(50))
  })
})

describe('the payload', () => {
  const coll = {
    notes: [
      { mid: 'm1', fields: ['食べる'], cards: [{ did: 'a', i: 5, e: 2500, d: null, u: 3 }, { did: 'b', i: 40, e: 0, d: 6, u: 9 }] },
      { mid: 'm2', fields: ['', '日'], cards: [{ did: 'a', i: 8, e: 2100, d: null, u: -2 }] },
      { mid: 'm1', fields: ['見る'], cards: [{ did: 'b', i: 2, e: 2500, d: null, u: 1 }] },
    ],
  }

  it('takes each note’s strongest card among the decks chosen', () => {
    const { body, mids, over } = buildPayload(coll, ['a', 'b'])
    expect(body.notes[0]).toEqual({ t: 0, f: ['食べる'], i: 40, u: 9, d: 6 })
    expect(body.notes[1]).toEqual({ t: 1, f: ['', '日'], i: 8, u: -2, e: 2100 })
    expect(mids).toEqual(['m1', 'm2'])
    expect(over).toBe(false)
  })

  it('leaves out the decks not chosen', () => {
    const { body } = buildPayload(coll, ['a'])
    expect(body.notes.map(n => [n.f, n.i])).toEqual([[['食べる'], 5], [['', '日'], 8]])
  })

  it('says when the decks hold more than one import takes', () => {
    const many = { notes: Array.from({ length: MAX_NOTES + 1 }, () => coll.notes[0]) }
    const { body, over } = buildPayload(many, ['a'])
    expect(over).toBe(true)
    expect(body.notes).toHaveLength(MAX_NOTES)
  })
})
