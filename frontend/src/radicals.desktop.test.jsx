import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from 'vitest-browser-react'
import { MemoryRouter, Routes, Route, useLocation, useNavigationType } from 'react-router-dom'
import { LangProvider } from './LangContext'
import './index.css'

// ── 机 — a radical's page as two panes (plan 117) ──────────────────
// Plan 115 left the kanji station's third source a phone's two screens:
// the lesson with its platforms, and the family behind a door that took
// the lesson's place. On the desk the radicals index stands beside the
// lesson and its platforms, the open radical in gold, and another
// radical is one click that swaps the page by replacing the URL; the
// family's door swaps the index for the family, in the list, and back,
// the lesson staying where it is. The bare index opens on its page's
// biggest family, the way the tiers open on the first. The phone's side
// is deskfree.phone.

vi.mock('./lib/audio', async o => ({
  ...(await o()),
  playUi: vi.fn(), playClick: vi.fn(), playAnnouncement: vi.fn(), startAmbiance: vi.fn(), stopAmbiance: vi.fn(),
}))
const apiFetch = vi.fn()
const apiJson = vi.fn()
vi.mock('./lib/api', () => ({
  api: p => p,
  apiFetch: (...a) => apiFetch(...a),
  apiJson: (...a) => apiJson(...a),
  apiJsonWithTimeout: vi.fn(), apiUpload: vi.fn(),
  ApiError: class extends Error {},
}))
vi.mock('./stores/boarding', () => ({ board: commit => commit() }))
globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) })

const { default: KanjiScreen } = await import('./screens/KanjiScreen')

// The index as /api/kanji/radicals serves it: two stroke pages, each in
// Kangxi order (the station ranks them by family size itself).
const tile = (number, glyph, meaning, stroke_count, count, learned = 0) => ({
  number, char: glyph, glyph, stroke_count, meaning, count, learned, started: learned,
})
const GROUPS = [
  { stroke_count: 3, radicals: [tile(30, '口', 'bouche', 3, 40, 4), tile(32, '土', 'terre', 3, 30)] },
  { stroke_count: 4, radicals: [tile(61, '心', 'cœur', 4, 40, 2), tile(64, '手', 'main', 4, 50), tile(85, '水', 'eau', 4, 123, 10)] },
]
const FAMILY = [
  { card_id: 'kanji_N5_a', kanji: '水', kana: 'みず', meaning: 'eau', stroke_count: 4, stage: 'mastered' },
  { card_id: 'kanji_N5_b', kanji: '海', kana: 'うみ', meaning: 'mer', stroke_count: 9, stage: 'learning' },
  { card_id: 'kanji_N5_c', kanji: '泳', kana: 'およ.ぐ', meaning: 'nager', stroke_count: 8, stage: 'new' },
]
const lesson = number => {
  const r = GROUPS.flatMap(g => g.radicals).find(x => x.number === number)
  return {
    number, glyph: r.glyph, char: r.char, meaning: r.meaning, stroke_count: r.stroke_count,
    forms: [r.glyph], names_ja: ['みず'], position: 'hen', svg_url: null,
    total: 3, learned: 1, started: 2,
    levels: [{ level: 'N5', kanji: FAMILY }],
  }
}
const BUCKET = { total: 3, new: 1, learning: 1, mastered: 1, due_now: 2 }
const ok = body => ({ ok: true, status: 200, json: async () => body })

beforeEach(() => {
  apiJson.mockReset()
  apiJson.mockImplementation(async url => {
    const m = String(url).match(/^\/api\/kanji\/radical\/(\d+)\?/)
    return m ? lesson(Number(m[1])) : {}
  })
  apiFetch.mockReset()
  apiFetch.mockImplementation(async url => {
    const u = String(url)
    if (u.startsWith('/api/kanji/radicals')) return ok({ groups: GROUPS })
    if (u.startsWith('/api/kanji/stats')) return ok(BUCKET)
    return ok({})
  })
})

const settle = (ms = 250) => new Promise(r => setTimeout(r, ms))
const $ = s => document.querySelector(s)
const $$ = s => [...document.querySelectorAll(s)]
const where = { path: null, search: null, type: null }
function Probe() {
  const loc = useLocation()
  where.path = loc.pathname
  where.search = loc.search
  where.type = useNavigationType()
  return null
}

const ROUTES = (
  <>
    <Route path="/learn/kanji" element={<KanjiScreen session={null} />} />
    <Route path="/learn/kanji/radicals" element={<KanjiScreen session={null} />} />
    <Route path="/learn/kanji/radical/:radical" element={<KanjiScreen session={null} />} />
  </>
)

function mount(entry) {
  return render(
    <LangProvider>
      <MemoryRouter initialEntries={[entry]}>
        <div className="phone phone--desk">
          <div className="phone__content"><Routes>{ROUTES}</Routes></div>
        </div>
        <Probe />
      </MemoryRouter>
    </LangProvider>
  )
}

const openTile = () => $$('.desk-split__list .radical-tile[aria-current="page"]')
const lessonCalls = () => apiJson.mock.calls.map(([u]) => String(u)).filter(u => u.startsWith('/api/kanji/radical/'))
const indexCalls = () => apiFetch.mock.calls.map(([u]) => String(u)).filter(u => u.startsWith('/api/kanji/radicals'))

describe('a radical\'s page beside the index', () => {
  it('stands the index beside the lesson and its platforms, the radical open in gold', async () => {
    await mount('/learn/kanji/radical/85')
    await settle(400)
    const list = $('.desk-split__list')
    const page = $('.desk-split__page')
    expect(list.getBoundingClientRect().right).toBeLessThanOrEqual(page.getBoundingClientRect().left)
    // The index opens on the page the radical is on, not on its first.
    expect($('.desk-split__list .stroke-rail__key[aria-current="true"]').textContent).toBe('4')
    expect(openTile()).toHaveLength(1)
    expect(openTile()[0].querySelector('.radical-tile__char').textContent).toBe('水')
    const [open, other] = [openTile()[0], $('.desk-split__list .radical-tile:not([aria-current])')]
    expect(getComputedStyle(open).borderColor).not.toBe(getComputedStyle(other).borderColor)
    // The page is the phone's lesson: the plate, the door, the platforms.
    expect($('.desk-split__page .rad-plate__id').textContent).toBe('水')
    expect($('.desk-split__page .rad-door')).not.toBeNull()
    expect($$('.desk-split__page .platform-card').length).toBeGreaterThan(1)
    expect($('[role="dialog"]')).toBeNull()
  })

  it('swaps the page for another radical in one click, replacing the URL', async () => {
    await mount('/learn/kanji/radical/85')
    await settle(400)
    const heart = $$('.desk-split__list .radical-tile').find(el => el.querySelector('.radical-tile__char').textContent === '心')
    heart.click()
    await settle(400)
    expect(where.path).toBe('/learn/kanji/radical/61')
    expect(where.type).toBe('REPLACE')
    expect($('.desk-split__page .rad-plate__id').textContent).toBe('心')
    expect(openTile()[0].querySelector('.radical-tile__char').textContent).toBe('心')
    // The index stood still: fetched once, for both radicals.
    expect(indexCalls()).toHaveLength(1)
  })

  it('figures each platform from the family\'s own stats, one to a row', async () => {
    await mount('/learn/kanji/radical/85')
    await settle(400)
    const figs = $$('.desk-split__page .desk-mode-fig')
    expect(figs.length).toBeGreaterThanOrEqual(2)
    expect(figs[0].querySelector('.desk-mode-fig__due').textContent).toMatch(/^2/)
    const stats = apiFetch.mock.calls.map(([u]) => String(u)).filter(u => u.includes('/stats'))
    expect(stats.length).toBeGreaterThan(0)
    expect(stats.every(u => u.startsWith('/api/kanji/stats?radical=85&mode='))).toBe(true)
    // The radical drill is never offered over one family.
    expect(stats.some(u => /mode=kanji\.radical/.test(u))).toBe(false)
    const cards = $$('.desk-split__page .platform-card')
    expect(cards[1].getBoundingClientRect().top).toBeGreaterThan(cards[0].getBoundingClientRect().bottom - 1)
    const grid = $('.desk-split__page .platform-grid').getBoundingClientRect()
    expect(grid.right).toBeLessThanOrEqual($('.desk-split__page').getBoundingClientRect().right + 1)
  })
})

describe('the family beside the lesson', () => {
  it('swaps the index for the family, the lesson staying', async () => {
    await mount('/learn/kanji/radical/85')
    await settle(400)
    $('.desk-split__page .rad-door').click()
    await settle(400)
    expect(where.search).toBe('?family=1')
    expect(where.type).toBe('PUSH')
    expect($$('.desk-split__list .rad-family .rad-kanji')).toHaveLength(3)
    expect($('.desk-split__list .radical-tile')).toBeNull()
    expect($('.desk-split__page .rad-plate')).not.toBeNull()
    expect($$('.desk-split__page .platform-card').length).toBeGreaterThan(1)
    const door = $('.desk-split__page .rad-door')
    expect(door.getAttribute('aria-expanded')).toBe('true')
    expect(getComputedStyle(door.querySelector('.rad-door__chev')).display).toBe('none')
    // The family is the lesson's own answer, not a second fetch.
    expect(lessonCalls()).toHaveLength(1)
  })

  it('puts the index back by the crumb or by the door', async () => {
    await mount('/learn/kanji/radical/85?family=1')
    await settle(400)
    expect($$('.desk-split__list .rad-kanji')).toHaveLength(3)
    const crumb = $('.desk-crumb')
    expect(crumb.textContent).toContain('Radicaux')
    crumb.querySelector('button').click()
    await settle(400)
    expect(where.search).toBe('')
    expect(openTile()).toHaveLength(1)
    expect($('.desk-split__page .rad-door').getAttribute('aria-expanded')).toBe('false')
    $('.desk-split__page .rad-door').click()
    await settle(400)
    expect(where.search).toBe('?family=1')
    $('.desk-split__page .rad-door').click()
    await settle(400)
    expect(where.search).toBe('')
    expect(openTile()).toHaveLength(1)
  })
})

describe('the bare index', () => {
  it('opens on its page\'s biggest family, replacing itself', async () => {
    await mount('/learn/kanji/radicals?stroke=4')
    await settle(400)
    expect(where.path).toBe('/learn/kanji/radical/85')
    expect(where.type).toBe('REPLACE')
    expect(openTile()[0].querySelector('.radical-tile__char').textContent).toBe('水')
  })

  it('opens on the first page without a stroke count', async () => {
    await mount('/learn/kanji/radicals')
    await settle(400)
    expect(where.path).toBe('/learn/kanji/radical/30')
    expect(where.type).toBe('REPLACE')
  })
})
