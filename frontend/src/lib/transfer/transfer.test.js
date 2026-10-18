import { describe, expect, it, vi } from 'vitest'
import { readWaniKani } from './wanikani'
import { readRenshuu } from './renshuu'
import { TransferError } from './bounds'
import { buildPayload } from '../anki/collection'

// ── WaniKani and Renshuu, read on the device (plan 243b) ─────────
// Each API answered by a fake fetch in the shape its documentation
// gives (docs.api.wanikani.com v2; api.renshuu.org/api-docs), so what
// is pinned is the mapping: which items are taught, the interval and
// due day each carries, the fields sent, the key in the header alone,
// and every way a read can fail as a code the page prints.

const NOW = Date.UTC(2026, 9, 17, 12)
const DAY = 86400000
const iso = days => new Date(NOW + days * DAY).toISOString()

function answer(routes) {
  const calls = []
  const fetch = vi.fn(async (url, init) => {
    calls.push({ url: String(url), init })
    const hit = routes.find(([match]) => String(url).includes(match))
    if (!hit) return { ok: false, status: 404, json: async () => ({}) }
    const [, body, status = 200] = hit
    return { ok: status === 200, status, headers: { get: () => null }, json: async () => body }
  })
  return { fetch, calls }
}

describe('WaniKani', () => {
  const assignments = {
    pages: { next_url: 'https://api.wanikani.com/v2/assignments?page_after_id=2' },
    data: [
      { id: 1, data: { subject_id: 440, subject_type: 'kanji', srs_stage: 5, available_at: iso(3) } },
      { id: 2, data: { subject_id: 2467, subject_type: 'vocabulary', srs_stage: 9, available_at: null, burned_at: iso(-10) } },
    ],
  }
  const page2 = {
    pages: { next_url: null },
    data: [{ id: 3, data: { subject_id: 9001, subject_type: 'kana_vocabulary', srs_stage: 7, available_at: iso(-4) } }],
  }
  const subjects = {
    pages: { next_url: null },
    data: [
      { id: 440, object: 'kanji', data: { characters: '一', readings: [{ reading: 'いち', primary: true }] } },
      { id: 2467, object: 'vocabulary', data: { characters: '食べる', readings: [{ reading: 'たべる', primary: true }] } },
      { id: 9001, object: 'kana_vocabulary', data: { characters: 'コーヒー' } },
    ],
  }

  it('reads what WaniKani has passed, with its stage’s interval', async () => {
    const { fetch, calls } = answer([['page_after_id', page2], ['/assignments', assignments], ['/subjects', subjects]])
    const progress = vi.fn()
    const c = await readWaniKani(' token-1 ', { fetch, now: NOW, onProgress: progress })
    expect(c.decks).toEqual([{ id: 'vocab', name: null, known: 2 }, { id: 'kanji', name: null, known: 1 }])
    const by = Object.fromEntries(c.notes.map(n => [n.fields[0], n]))
    expect(by['一']).toMatchObject({ mid: 'kanji', fields: ['一'], cards: [{ did: 'kanji', i: 7, e: 0, u: 3 }] })
    // Burned: a half-year, due with the checks.
    expect(by['食べる']).toMatchObject({ mid: 'vocab', fields: ['食べる', 'たべる'], cards: [{ did: 'vocab', i: 180, u: 0 }] })
    expect(by['コーヒー']).toMatchObject({ fields: ['コーヒー'], cards: [{ i: 30, u: -4 }] })
    // Guru and up, kanji and vocabulary only, and the key in the header.
    expect(calls[0].url).toContain('srs_stages=5,6,7,8,9')
    expect(calls[0].url).toContain('subject_types=kanji,vocabulary,kana_vocabulary')
    expect(calls.every(c => c.init.headers.Authorization === 'Bearer token-1')).toBe(true)
    expect(calls.every(c => !c.url.includes('token-1'))).toBe(true)
    expect(progress).toHaveBeenLastCalledWith(3)
    // And the body the server takes, one note type a kind.
    const { body } = buildPayload(c, ['vocab', 'kanji'])
    expect(body.notes).toHaveLength(3)
  })

  it('says what went wrong', async () => {
    await expect(readWaniKani('', {})).rejects.toMatchObject({ code: 'badKey' })
    await expect(readWaniKani('k', answer([['/assignments', {}, 401]]))).rejects.toMatchObject({ code: 'badKey' })
    await expect(readWaniKani('k', answer([['/assignments', { pages: {}, data: [] }]]))).rejects.toMatchObject({ code: 'nothing' })
    const offline = vi.fn(async () => { throw new TypeError('Failed to fetch') })
    await expect(readWaniKani('k', { fetch: offline })).rejects.toBeInstanceOf(TransferError)
    await expect(readWaniKani('k', { fetch: offline })).rejects.toMatchObject({ code: 'network' })
  })

  it('waits when asked to slow down, then gives up', async () => {
    const sleep = vi.fn(async () => {})
    const { fetch } = answer([['/assignments', {}, 429]])
    await expect(readWaniKani('k', { fetch, sleep })).rejects.toMatchObject({ code: 'rate' })
    expect(sleep).toHaveBeenCalledTimes(2)
    expect(fetch).toHaveBeenCalledTimes(3)
  })

  it('waits until the limit resets, the one header WaniKani lets a browser read', async () => {
    const sleep = vi.fn(async () => {})
    const reset = String(Math.floor(Date.now() / 1000) + 20)
    let calls = 0
    const fetch = vi.fn(async () => (++calls === 1
      ? { ok: false, status: 429, headers: { get: h => (h === 'RateLimit-Reset' ? reset : null) }, json: async () => ({}) }
      : { ok: true, status: 200, headers: { get: () => null }, json: async () => ({ pages: {}, data: [] }) }))
    await expect(readWaniKani('k', { fetch, sleep })).rejects.toMatchObject({ code: 'nothing' })
    expect(sleep).toHaveBeenCalledTimes(1)
    const waited = sleep.mock.calls[0][0]
    expect(waited).toBeGreaterThanOrEqual(19000)
    expect(waited).toBeLessThanOrEqual(21000)
  })
})

describe('Renshuu', () => {
  const vector = (last, next) => ({ name: 'Kanji > Kana', correct_count: 4, missed_count: 1, mastery_perc: 60, last_quizzed: last, next_quiz: next })
  const vocab1 = {
    contents: {
      total_pg: 2, pg: 1,
      terms: [
        { kanji_full: '食べる', hiragana_full: 'たべる', user_data: { study_vectors: {
          a: vector('2026/10/01', '2026/10/09'),
          b: vector('2026/10/10', '2026/10/30'),
        } } },
        { kanji_full: '', hiragana_full: 'すごい', user_data: { study_vectors: { a: vector('Not yet', '2026/10/18') } } },
      ],
    },
  }
  const vocab2 = {
    contents: { total_pg: 2, pg: 2, terms: [{ kanji_full: 'コーヒー', hiragana_full: 'コーヒー', user_data: { study_vectors: { a: vector('2026/10/15', '2026/10/16') } } }] },
  }
  const kanji = {
    contents: { total_pg: 1, pg: 1, terms: [{ kanji: '食', user_data: { study_vectors: { a: vector('2026/09/01', '2026/10/01') } } }] },
  }

  it('reads every studied word and kanji, its strongest direction’s gap the interval', async () => {
    const { fetch, calls } = answer([['/list/all/vocab?pg=2', vocab2], ['/list/all/vocab?pg=1', vocab1], ['/list/all/kanji', kanji]])
    const c = await readRenshuu('key-9', { fetch, now: NOW })
    const by = Object.fromEntries(c.notes.map(n => [n.fields[0], n]))
    // The longer of the two directions: 20 days, next quiz in 13.
    expect(by['食べる']).toMatchObject({ mid: 'vocab', fields: ['食べる', 'たべる'], cards: [{ did: 'vocab', i: 20, u: 13 }] })
    // Never quizzed: not taught yet.
    expect(by['すごい']).toBeUndefined()
    // Written in kana alone: its own reading, sent once.
    expect(by['コーヒー']).toMatchObject({ fields: ['コーヒー'], cards: [{ i: 1, u: -1 }] })
    expect(by['食']).toMatchObject({ mid: 'kanji', fields: ['食'], cards: [{ did: 'kanji', i: 30, u: -16 }] })
    expect(calls.map(c => c.url)).toEqual([
      'https://api.renshuu.org/v1/list/all/vocab?pg=1',
      'https://api.renshuu.org/v1/list/all/vocab?pg=2',
      'https://api.renshuu.org/v1/list/all/kanji?pg=1',
    ])
    expect(calls.every(c => c.init.headers.Authorization === 'Bearer key-9')).toBe(true)
  })

  it('says what went wrong', async () => {
    await expect(readRenshuu('  ', {})).rejects.toMatchObject({ code: 'badKey' })
    await expect(readRenshuu('k', answer([['/list/all/vocab', {}, 403]]))).rejects.toMatchObject({ code: 'badKey' })
    const empty = { contents: { total_pg: 1, terms: [] } }
    await expect(readRenshuu('k', answer([['/list/all/vocab', empty], ['/list/all/kanji', empty]]))).rejects.toMatchObject({ code: 'nothing' })
    await expect(readRenshuu('k', answer([['/list/all/vocab', {}, 500]]))).rejects.toMatchObject({ code: 'unreachable' })
  })
})
