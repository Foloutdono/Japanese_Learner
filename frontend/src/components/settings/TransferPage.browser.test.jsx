import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, cleanup } from 'vitest-browser-react'
import { userEvent } from 'vitest/browser'
import { MemoryRouter } from 'react-router-dom'
import initSqlJs from 'sql.js'
import wasmUrl from 'sql.js/dist/sql-wasm-browser.wasm?url'
import { zipSync } from 'fflate'
import { LangProvider } from '../../LangContext'
import fr from '../../locales/fr/index.js'
import '../../index.css'

// ── Settings › Correspondance, the transfer ticket (plans 243, 243b) ──
// A real Anki collection, read in the browser by the real reader
// (SQLite in WebAssembly, found where the page says), and WaniKani read
// through its API by the real reader: the ticket previews what the
// device read as soon as it has read it, prints what the server found,
// takes its decks from the chips, sends the same body to be punched,
// and offers the way back while imported cards wait for their check.

const apiJson = vi.hoisted(() => vi.fn())
vi.mock('../../lib/api', () => ({ apiFetch: vi.fn(async () => ({ ok: false })), apiJson: (...a) => apiJson(...a) }))
const refreshToday = vi.hoisted(() => vi.fn())
vi.mock('../../stores/today', () => ({ refreshToday: (...a) => refreshToday(...a), useTodaySummary: () => ({ data: null }) }))
const refreshSummary = vi.hoisted(() => vi.fn())
vi.mock('../../stores/profileSummary', async importOriginal => ({
  ...(await importOriginal()),
  refreshSummary: (...a) => refreshSummary(...a),
}))
// The page's own requests go through the mocked lib/api; WaniKani's
// API is answered by `wanikani` below; SQLite's WebAssembly is real.
let wanikani = () => ({ status: 404, body: {} })
const realFetch = globalThis.fetch.bind(globalThis)
globalThis.fetch = vi.fn(async (url, ...rest) => {
  if (String(url).includes('.wasm')) return realFetch(url, ...rest)
  if (String(url).startsWith('https://api.wanikani.com/')) {
    const { status, body } = await wanikani(String(url), rest[0])
    return { ok: status === 200, status, headers: { get: () => null }, json: async () => body }
  }
  return { ok: true, status: 200, json: async () => ({}) }
})

const { TransferPage } = await import('./TransferPage')

const settle = (ms = 80) => new Promise(r => setTimeout(r, ms))
const $ = sel => document.querySelector(sel)
const $$ = sel => [...document.querySelectorAll(sel)]
const text = () => document.body.textContent.replace(/\u00a0/g, ' ')
const said = s => s.replace(/\u00a0/g, ' ')

const PREVIEW = {
  notes: 2, cards: 2, bySource: { vocab: 1, kanji: 1, kana: 0 },
  byLevel: { N5: 2, N4: 0, N3: 0, N2: 0, N1: 0 },
  kept: 0, above: 1, write: 2, dueNow: 1, spreadWeeks: 6, unmatched: 1, sample: ['蜃気楼'],
  types: [{ type: 0, notes: 3, field: 0, kind: 'vocab', reading: 1 }],
}

async function ankiFile() {
  const SQL = await initSqlJs({ locateFile: () => wasmUrl })
  const db = new SQL.Database()
  db.run(`
    CREATE TABLE col (id integer primary key, crt integer, models text, decks text);
    CREATE TABLE notes (id integer primary key, mid integer, flds text);
    CREATE TABLE cards (id integer primary key, nid integer, did integer, odid integer, type integer,
                        queue integer, due integer, odue integer, ivl integer, factor integer, data text);`)
  const models = { 7: { id: 7, name: 'Core', flds: [{ name: 'Expression', ord: 0 }, { name: 'Reading', ord: 1 }] } }
  const decks = { 1: { id: 1, name: 'Japonais::Core' }, 2: { id: 2, name: 'Kanji' } }
  db.run('INSERT INTO col VALUES (1, ?, ?, ?)', [Math.floor(Date.now() / 1000) - 10 * 86400, JSON.stringify(models), JSON.stringify(decks)])
  const notes = [[1, '食べる\x1fたべる', 1], [2, '日\x1fひ', 2], [3, '蜃気楼\x1fしんきろう', 1]]
  for (const [id, flds, did] of notes) {
    db.run('INSERT INTO notes VALUES (?, 7, ?)', [id, flds])
    db.run('INSERT INTO cards VALUES (?, ?, ?, 0, 2, 2, 20, 0, 30, 2500, ?)', [id, id, did, ''])
  }
  const bytes = db.export()
  db.close()
  return new File([zipSync({ 'collection.anki21': bytes })], 'core.apkg')
}

function pick(file) {
  const input = $('input[type="file"]')
  const dt = new DataTransfer()
  dt.items.add(file)
  input.files = dt.files
  input.dispatchEvent(new Event('change', { bubbles: true }))
}

async function mount() {
  await render(
    <LangProvider>
      <MemoryRouter><TransferPage session={{ access_token: 'tok' }} /></MemoryRouter>
    </LangProvider>,
  )
  await settle()
}

function serve({ waiting = 0, preview = PREVIEW, result = { ...PREVIEW, written: 2, waiting: 2 } } = {}) {
  apiJson.mockImplementation(async (path, _s, opts = {}) => {
    if (path === '/api/transfer' && opts.method === 'DELETE') return { removed: 2, waiting: 0 }
    if (path === '/api/transfer') return { waiting }
    if (path === '/api/transfer/preview') return preview
    if (path === '/api/transfer/import') return result
    throw new Error(path)
  })
}

describe('Settings › Correspondance', () => {
  beforeEach(() => {
    localStorage.setItem('lang', 'fr')
    apiJson.mockReset()
    refreshToday.mockReset()
    refreshSummary.mockReset()
    globalThis.fetch.mockClear()
    serve()
  })
  afterEach(() => cleanup())

  it('reads an Anki file, prints what the course finds and punches it', async () => {
    await mount()
    expect($('[data-action="transfer-undo"]')).toBeNull()
    expect($('[role="radio"][aria-checked="true"]').textContent).toBe('Anki')
    pick(await ankiFile())
    // No second button: the ticket is printed as soon as the file is read.
    await vi.waitFor(() => expect($('[data-figure="cards"]')).not.toBeNull(), { timeout: 5000 })

    const [path, , opts] = apiJson.mock.calls.at(-1)
    expect(path).toBe('/api/transfer/preview')
    const sent = JSON.parse(opts.body)
    expect(sent.source).toBe('anki')
    expect(sent.notes.map(n => n.f)).toEqual([['食べる', 'たべる'], ['日', 'ひ'], ['蜃気楼', 'しんきろう']])
    expect(sent.notes[0]).toMatchObject({ t: 0, i: 30, e: 2500, u: 10 })

    // The route: the file, and the levels the cards were found at.
    expect(said($('.tr-ticket__route').textContent)).toContain('core.apkg')
    expect(said($('.tr-ticket__route').textContent)).toContain('N5')
    expect($('[data-figure="cards"]').textContent).toBe('2')
    expect($$('.tr-line').map(l => l.dataset.line)).toEqual(['vocab', 'kanji'])
    const chips = $$('[data-deck]')
    expect(chips.map(c => c.textContent.replace('✓ ', ''))).toEqual(['Japonais::Core', 'Kanji'])
    expect(chips.every(c => c.getAttribute('aria-checked') === 'true')).toBe(true)
    expect(said($('.tr-stub').textContent)).toContain(said(fr.trDue(1, 6)))
    expect(said($('.tr-stub').textContent)).toContain(said(fr.trAbove(1)))
    expect(said($('.tr-stub').textContent)).toContain(said(fr.trCheck))

    // The notes left out, folded until asked for.
    expect(text()).not.toContain('蜃気楼。')
    await userEvent.click([...$$('button')].find(b => said(b.textContent) === said(fr.trMissing(1))))
    expect(text()).toContain(said(fr.trMissingSample('蜃気楼')))
    expect(text()).toContain(said(fr.trReadFrom('Core › Expression')))

    await userEvent.click($('[data-action="transfer-punch"]'))
    await settle()
    const [importPath, , importOpts] = apiJson.mock.calls.at(-1)
    expect(importPath).toBe('/api/transfer/import')
    expect(importOpts.body).toBe(opts.body)
    expect($('[data-figure="written"]').textContent).toBe('2')
    expect($('.tr-stamp').getAttribute('aria-label')).toBe(fr.trPunched)
    expect($('[data-action="transfer-today"]').getAttribute('href')).toBe('/today')
    expect(refreshToday).toHaveBeenCalled()
    expect(refreshSummary).toHaveBeenCalled()
    // The cards wait for their check: the way back is offered, and
    // taken, it leaves a blank ticket.
    expect($('[data-action="transfer-undo"]')).not.toBeNull()
    await userEvent.click($('[data-action="transfer-undo"]'))
    await userEvent.click($('[data-action="transfer-undo-confirm"]'))
    await settle()
    expect($('.tr-stamp')).toBeNull()
    expect($('[data-action="transfer-choose"]')).not.toBeNull()
    expect(text()).toContain(said(fr.trUndone(2)))
  })

  it('asks again for the decks chosen, and keeps one', async () => {
    await mount()
    pick(await ankiFile())
    await vi.waitFor(() => expect($$('[data-deck]')).toHaveLength(2), { timeout: 5000 })
    const asked = apiJson.mock.calls.length

    await userEvent.click($('[data-deck="2"]'))
    await settle()
    expect($('[data-deck="2"]').getAttribute('aria-checked')).toBe('false')
    expect(apiJson.mock.calls).toHaveLength(asked + 1)
    const sent = JSON.parse(apiJson.mock.calls.at(-1)[2].body)
    expect(sent.notes.map(n => n.f[0])).toEqual(['食べる', '蜃気楼'])

    // The last deck stays: a ticket for nothing is not printed.
    await userEvent.click($('[data-deck="1"]'))
    await settle()
    expect($('[data-deck="1"]').getAttribute('aria-checked')).toBe('true')
    expect(apiJson.mock.calls).toHaveLength(asked + 1)

    await userEvent.click($('[data-action="transfer-restart"]'))
    expect($('[data-action="transfer-choose"]')).not.toBeNull()
  })

  it('never punches the decks the chips no longer show', async () => {
    await mount()
    pick(await ankiFile())
    await vi.waitFor(() => expect($$('[data-deck]')).toHaveLength(2), { timeout: 5000 })

    // A deck taken out while its new preview is still on its way: the
    // old ticket (both decks) is printed, but cannot be punched.
    let release
    const held = new Promise(r => { release = r })
    apiJson.mockImplementation(async (path, _s, opts = {}) => {
      if (path === '/api/transfer/preview') { await held; return PREVIEW }
      if (path === '/api/transfer/import') return { ...PREVIEW, written: 2, waiting: 2 }
      if (opts.method !== 'DELETE') return { waiting: 0 }
      throw new Error(path)
    })
    await userEvent.click($('[data-deck="2"]'))
    await settle()
    expect($('[data-action="transfer-punch"]').disabled).toBe(true)

    release()
    await vi.waitFor(() => expect($('[data-action="transfer-punch"]').disabled).toBe(false))
    await userEvent.click($('[data-action="transfer-punch"]'))
    await settle()
    const [path, , opts] = apiJson.mock.calls.at(-1)
    expect(path).toBe('/api/transfer/import')
    expect(JSON.parse(opts.body).notes.map(n => n.f[0])).toEqual(['食べる', '蜃気楼'])
  })

  it('drops a read the learner left for another source', async () => {
    let release
    const held = new Promise(r => { release = r })
    wanikani = async url => {
      await held
      return url.includes('/assignments')
        ? { status: 200, body: { pages: { next_url: null }, data: [{ data: { subject_id: 1, subject_type: 'kanji', srs_stage: 5, available_at: null } }] } }
        : { status: 200, body: { pages: { next_url: null }, data: [{ id: 1, object: 'kanji', data: { characters: '日' } }] } }
    }
    await mount()
    await userEvent.click([...$$('[role="radio"]')].find(r => r.textContent === 'WaniKani'))
    await userEvent.fill($('#tr-key'), 'wk-token')
    await userEvent.click($('[data-action="transfer-read"]'))
    await settle()
    expect($('.tr-slot .loading')).not.toBeNull()
    await userEvent.click([...$$('[role="radio"]')].find(r => r.textContent === 'Anki'))
    release()
    await settle(200)
    // WaniKani answered, after the learner had gone back to Anki.
    expect($('[data-action="transfer-choose"]')).not.toBeNull()
    expect($('[data-figure="cards"]')).toBeNull()
    expect(apiJson.mock.calls.filter(([u]) => u === '/api/transfer/preview')).toHaveLength(0)
  })

  it('reads WaniKani with the learner’s token, which goes to WaniKani alone', async () => {
    wanikani = (url, init) => {
      if (init?.headers?.Authorization !== 'Bearer wk-token') return { status: 401, body: {} }
      if (url.includes('/assignments')) {
        return { status: 200, body: { pages: { next_url: null }, data: [
          { data: { subject_id: 1, subject_type: 'vocabulary', srs_stage: 6, available_at: new Date(Date.now() + 5 * 86400000).toISOString() } },
        ] } }
      }
      return { status: 200, body: { pages: { next_url: null }, data: [
        { id: 1, object: 'vocabulary', data: { characters: '食べる', readings: [{ reading: 'たべる', primary: true }] } },
      ] } }
    }
    await mount()
    await userEvent.click([...$$('[role="radio"]')].find(r => r.textContent === 'WaniKani'))
    expect($('[data-action="transfer-choose"]')).toBeNull()
    expect(said($('.tr-foot').textContent)).toBe(said(fr.trPrivacyKey('WaniKani')))
    expect(said($('.tr-how summary').textContent)).toBe(said(fr.trHowQ.wanikani))
    const read = $('[data-action="transfer-read"]')
    expect(read.disabled).toBe(true)

    await userEvent.fill($('#tr-key'), 'wk-token')
    await userEvent.click(read)
    await vi.waitFor(() => expect($('[data-figure="cards"]')).not.toBeNull(), { timeout: 5000 })
    const sent = JSON.parse(apiJson.mock.calls.at(-1)[2].body)
    expect(sent).toEqual({ source: 'wanikani', notes: [{ t: 0, f: ['食べる', 'たべる'], i: 14, u: 5 }] })
    // The token went in a header to WaniKani, and to nothing of ours.
    const calls = globalThis.fetch.mock.calls.map(([u]) => String(u)).filter(u => !u.includes('.wasm'))
    expect(calls.every(u => u.startsWith('https://api.wanikani.com/'))).toBe(true)
    expect(apiJson.mock.calls.every(c => !JSON.stringify(c).includes('wk-token'))).toBe(true)
    expect($$('[data-deck]')).toHaveLength(0)
    expect(said($('.tr-ticket__route').textContent)).toContain('WaniKani')

    // And a wrong token is said as one.
    await userEvent.click($('[data-action="transfer-restart"]'))
    await userEvent.fill($('#tr-key'), 'wrong')
    await userEvent.click($('[data-action="transfer-read"]'))
    await vi.waitFor(() => expect(text()).toContain(said(fr.trErr.badKey)), { timeout: 5000 })
  })

  it('takes the import back after asking', async () => {
    serve({ waiting: 5 })
    await mount()
    expect(text()).toContain(said(fr.trWaiting(5)))
    await userEvent.click($('[data-action="transfer-undo"]'))
    await userEvent.click($('[data-action="transfer-undo-confirm"]'))
    await settle()
    expect(apiJson).toHaveBeenLastCalledWith('/api/transfer', expect.anything(), expect.objectContaining({ method: 'DELETE' }))
    expect($('[data-action="transfer-undo"]')).toBeNull()
    expect(text()).toContain(said(fr.trUndone(2)))
    expect(refreshToday).toHaveBeenCalled()
  })

  it('says, in French, what is wrong with a file', async () => {
    await mount()
    pick(new File(['not a zip'], 'notes.txt'))
    await vi.waitFor(() => expect(text()).toContain(said(fr.trErr.notAnki)), { timeout: 5000 })
    expect($('[data-figure="cards"]')).toBeNull()
    expect($('[data-action="transfer-choose"]')).not.toBeNull()
  })
})
