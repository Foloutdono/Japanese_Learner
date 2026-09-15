import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from 'vitest-browser-react'
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom'
import { LangProvider } from '../LangContext'
import '../index.css'

// ── 部首 — the kanji station's third source (plan 086) ──────────
// The index is the dictionary's own pad and page, dressed as a
// choice: a tile prints the form the learner meets, its meaning and
// `learned / total` over the COURSE's kanji. A radical is a lesson
// before it is a list of platforms: the plate, the platforms (every
// drill but the radical one), then the family by level, each kanji in
// its stage ink. These pin that shape and the two ways out — back to
// the page of the index the radical is on, and back to the index from
// a number it does not know.

vi.mock('../lib/api', () => {
  class ApiError extends Error { constructor(status) { super(`Request failed (${status})`); this.status = status } }
  return { apiFetch: vi.fn(), apiJson: vi.fn(), apiJsonWithTimeout: vi.fn(), apiUpload: vi.fn(), ApiError }
})
vi.mock('../lib/audio', async o => ({
  ...(await o()), playUi: vi.fn(), speakJapanese: vi.fn(), startAmbiance: vi.fn(), stopAmbiance: vi.fn(),
}))
vi.mock('../lib/supabase', () => ({
  supabase: { auth: { getSession: async () => ({ data: { session: null } }) } },
}))
// KanjiVG is fetched by the stroke animation itself; a failed fetch is
// the glyph-as-type fallback, which is all this suite needs.
globalThis.fetch = vi.fn().mockResolvedValue({ ok: false, status: 404, json: async () => ({}), text: async () => '' })

const { default: KanjiScreen } = await import('./KanjiScreen')
const { apiFetch, apiJson, ApiError } = await import('../lib/api')
const { default: fr } = await import('../locales/fr/index.js')

const INDEX = {
  groups: [
    { stroke_count: 1, radicals: [
      { number: 1, char: '一', glyph: '一', stroke_count: 1, meaning: 'un', count: 17, started: 3, learned: 1 },
    ] },
    { stroke_count: 3, radicals: [
      { number: 85, char: '氵', glyph: '水', stroke_count: 3, meaning: 'eau', count: 123, started: 0, learned: 0 },
      { number: 75, char: '木', glyph: '木', stroke_count: 3, meaning: 'arbre', count: 102, started: 0, learned: 0 },
    ] },
  ],
}
const WATER = {
  number: 85, char: '氵', stroke_count: 3, glyph: '水', forms: ['水', '氵', '氺'], meaning: 'eau',
  names_ja: ['みず', 'さんずい'], position: 'hen', svg_url: '/kanjivg/06c34.svg',
  total: 3, started: 2, learned: 1,
  levels: [
    { level: 'N5', kanji: [{ card_id: 'kanji_N5_水', kanji: '水', kana: 'みず', meaning: 'eau', stroke_count: 4, stage: 'mastered' }] },
    { level: 'N4', kanji: [
      { card_id: 'kanji_N4_海', kanji: '海', kana: 'うみ', meaning: 'mer', stroke_count: 9, stage: 'learning' },
      { card_id: 'kanji_N4_泳', kanji: '泳', kana: 'およ.ぐ', meaning: 'nager; brasse', stroke_count: 8, stage: 'new' },
    ] },
  ],
}

function Where() {
  const { pathname, search } = useLocation()
  return <b data-testid="where">{pathname + search}</b>
}

const ROUTES = ['/learn/kanji', '/learn/kanji/radicals', '/learn/kanji/radical/:radical', '/learn/kanji/:level']

async function station(at) {
  const screen = await render(
    <LangProvider>
      <MemoryRouter initialEntries={[at]}>
        <Routes>
          {ROUTES.map(path => <Route key={path} path={path} element={<KanjiScreen session={null} />} />)}
          <Route path="*" element={<main id="main-content">elsewhere</main>} />
        </Routes>
        <Where />
      </MemoryRouter>
    </LangProvider>
  )
  const all = sel => [...screen.container.querySelectorAll(sel)]
  return {
    all,
    one: sel => screen.container.querySelector(sel),
    where: () => screen.container.querySelector('[data-testid="where"]')?.textContent,
    text: sel => screen.container.querySelector(sel)?.textContent,
  }
}

beforeEach(() => {
  apiFetch.mockReset()
  apiFetch.mockImplementation(async path => ({
    ok: true, status: 200,
    json: async () => (String(path).startsWith('/api/kanji/radicals') ? INDEX : {}),
  }))
  apiJson.mockReset()
  apiJson.mockImplementation(async path => {
    const p = String(path)
    if (p.startsWith('/api/kanji/radical/85')) return WATER
    if (p.startsWith('/api/kanji/radical/1?')) return { ...WATER, number: 1, glyph: '一', meaning: 'un', stroke_count: 1 }
    if (p.startsWith('/api/kanji/radical/')) throw new ApiError(404)
    return {}
  })
})

describe('the index', () => {
  it('prints the course figures on each tile, and pages by stroke count from the URL', async () => {
    const s = await station('/learn/kanji/radicals?stroke=3')
    await expect.poll(() => s.all('.radical-tile').length).toBe(2)
    expect(s.text('.bar__sub')).toBe(fr.byRadicalShort)
    // The lesson's glyph, never the index's filing character.
    expect(s.all('.radical-tile__char').map(n => n.textContent)).toEqual(['水', '木'])
    expect(s.all('.radical-tile__sub').map(n => n.textContent)).toEqual(['eau', 'arbre'])
    expect(s.text('.radical-tile__count')).toBe('0/ 123')
    expect(apiFetch.mock.calls[0][0]).toBe('/api/kanji/radicals?lang=fr')
  })

  it('turns the page from the stroke rail, and carries it in the URL', async () => {
    const s = await station('/learn/kanji/radicals?stroke=3')
    await expect.poll(() => s.all('.stroke-rail__key').length).toBe(2)
    // Every stroke count the index has is a key on one line, and the
    // two chevrons walk between them — the drag that used to reach the
    // far ones, and the ‹ prev / next › row under the tiles that
    // existed because it hid them, are both gone.
    expect(s.all('.stroke-rail__key .stroke-rail__n').map(n => n.textContent)).toEqual(['1', '3'])
    s.one('.stroke-rail__step--left').click()
    await expect.poll(s.where).toBe('/learn/kanji/radicals?stroke=1')
    await expect.poll(() => s.all('.radical-tile').length).toBe(1)
    // At the near end of the index there is nothing before 1画, and a
    // key is still a direct jump.
    expect(s.one('.stroke-rail__step--left').disabled).toBe(true)
    s.all('.stroke-rail__key')[1].click()
    await expect.poll(s.where).toBe('/learn/kanji/radicals?stroke=3')
  })

  it('marks a radical the learner has opened, and a tile opens its lesson', async () => {
    const s = await station('/learn/kanji/radicals')
    await expect.poll(() => s.all('.radical-tile').length).toBe(1)
    expect(s.one('.radical-tile').classList.contains('radical-tile--started')).toBe(true)
    expect(s.text('.radical-tile__count')).toBe('1/ 17')
    s.one('.radical-tile').click()
    await expect.poll(s.where).toBe('/learn/kanji/radical/1')
  })
})

describe('the lesson', () => {
  it('teaches the radical, then offers every drill but the radical one, then its family by level', async () => {
    const s = await station('/learn/kanji/radical/85')
    await expect.poll(() => s.one('.rad-plate')).not.toBeNull()
    expect(s.text('.rad-plate__names')).toBe('みず · さんずい')
    expect(s.text('.rad-plate__meaning')).toBe('eau')
    expect(s.all('.rad-plate__form').map(n => n.textContent)).toEqual(['水', '氵', '氺'])
    expect(s.text('.rad-plate__note')).toContain(fr.radPosition.hen)
    expect(s.text('.rad-plate__note')).toContain(fr.radFamilyNote(3))
    expect(s.text('.rad-plate__learned')).toBe('1/ 3')
    expect(s.text('.rad-plate__started')).toBe(fr.startedNote(2))
    // The bar names the radical once the lesson has it.
    expect(s.text('.bar__sub')).toBe(`${fr.byRadicalShort} · 水 eau`)

    const titles = s.all('.platform-card__title').map(n => n.textContent)
    expect(titles).toContain(fr.mode_kanji_flashcard_f2b)
    expect(titles).toContain(fr.mode_fast_review)
    expect(titles, 'one family, one radical: the radical drill has one answer').not.toContain(fr.mode_kanji_radical)

    expect(s.all('.rad-family .dict-mark__jp').map(n => n.textContent)).toEqual(['N5', 'N4'])
    const tiles = s.all('.rad-kanji')
    expect(tiles.map(n => n.querySelector('.rad-kanji__char').textContent)).toEqual(['水', '海', '泳'])
    expect(tiles.map(n => n.className)).toEqual(['rad-kanji rad-kanji--mastered', 'rad-kanji rad-kanji--learning', 'rad-kanji rad-kanji--new'])
    // The first gloss only, sentence-cased as the dictionary casts it: the tile is 88px wide.
    expect(tiles[2].querySelector('.rad-kanji__meaning').textContent).toBe('Nager')
  })

  it('leaves to the page of the index the radical is on', async () => {
    const s = await station('/learn/kanji/radical/85')
    await expect.poll(() => s.one('.rad-plate')).not.toBeNull()
    const leave = s.one('.bar__aside .stage__leave')
    expect(leave.textContent).toBe(fr.leaveRadicals)
    leave.click()
    await expect.poll(s.where).toBe('/learn/kanji/radicals?stroke=3')
  })

  it('sends a number the index does not know back to the index', async () => {
    const s = await station('/learn/kanji/radical/999')
    await expect.poll(s.where).toBe('/learn/kanji/radicals')
  })
})
