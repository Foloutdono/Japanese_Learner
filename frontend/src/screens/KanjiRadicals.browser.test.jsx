import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from 'vitest-browser-react'
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom'
import { LangProvider } from '../LangContext'
import '../index.css'

// ── 部首 — the kanji station's third source (plan 086) ──────────
// The index is the dictionary's own strip and page, dressed as a
// choice: a tile prints the form the learner meets, its meaning and
// `learned / total` over the COURSE's kanji. A radical is a lesson
// before it is a list of platforms: the plate (the strokes drawn on
// washi, the names, the forms) and the platforms, every drill but the
// radical one. Its family is a door on the plate rather than a tail
// under the screen — ?family=1, the same screen, each kanji in its
// stage ink. These pin that shape and the three ways out — back to
// the lesson from the family, back to the page of the index the
// radical is on, and back to the index from a number it does not know.

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
// The native shell's one build-time knob (lib/origin, ADR 0008), stubbed
// to a sentinel origin so the assertion below can tell a backend path
// resolved against it from a bare one. Inside the WebView that
// difference is the whole bug: its own origin serves the bundle and
// nothing else, so a bare /kanjivg path 404s there and the plate falls
// back to the character as type. The literal is repeated rather than
// read from SHELL_ORIGIN because vi.mock is hoisted above every
// declaration.
vi.mock('../lib/origin', () => ({
  API_ORIGIN: 'https://shell.test',
  api: path => 'https://shell.test' + path,
}))
const SHELL_ORIGIN = 'https://shell.test'
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
  it('teaches the radical, then offers every drill but the radical one', async () => {
    const s = await station('/learn/kanji/radical/85')
    await expect.poll(() => s.one('.rad-plate')).not.toBeNull()
    expect(s.text('.rad-plate__names')).toBe('みず · さんずい')
    expect(s.text('.rad-plate__meaning')).toBe('eau')
    expect(s.all('.rad-plate__form').map(n => n.textContent)).toEqual(['水', '氵', '氺'])
    expect(s.text('.rad-plate__note')).toContain(fr.radPosition.hen)
    // The bar names the radical once the lesson has it.
    expect(s.text('.bar__sub')).toBe(`${fr.byRadicalShort} · 水 eau`)

    const titles = s.all('.platform-card__title').map(n => n.textContent)
    expect(titles).toContain(fr.mode_kanji_flashcard_f2b)
    expect(titles).toContain(fr.mode_fast_review)
    expect(titles, 'one family, one radical: the radical drill has one answer').not.toContain(fr.mode_kanji_radical)

    // The family is behind the door, not under the platforms.
    expect(s.one('.rad-family')).toBeNull()
    expect(s.text('.rad-door__fig')).toBe('1/ 3')
    expect(s.text('.rad-door__started')).toBe(fr.startedNote(2))
    expect(s.text('.rad-door__label')).toBe(fr.radFamilyShort)
  })

  // The strokes are what the lesson is for, so they are fetched
  // through the API origin rather than as the bare path the API hands
  // back (ADR 0008; the stubbed origin above is what makes the two
  // distinguishable here). The suite's fetch answers 404 to
  // everything, so what renders is the character-as-type fallback —
  // the box it renders in is what this checks.
  it('draws the strokes from the API origin, undressed of KanjiVG\'s numerals', async () => {
    const s = await station('/learn/kanji/radical/85')
    await expect.poll(() => s.one('.rad-plate')).not.toBeNull()
    expect(s.one('.rad-plate__glyph')).not.toBeNull()
    const asked = globalThis.fetch.mock.calls.map(c => String(c[0])).filter(u => u.includes('kanjivg'))
    expect(asked).toContain(`${SHELL_ORIGIN}/kanjivg/06c34.svg`)
  })

  it('opens the family from the door, at its own top, and leaves it back to the lesson', async () => {
    // The door is a screen down the plate and the path does not
    // change, so without this the family opens already scrolled.
    const scrolled = vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
    const s = await station('/learn/kanji/radical/85')
    await expect.poll(() => s.one('.rad-door')).not.toBeNull()
    s.one('.rad-door').click()
    await expect.poll(s.where).toBe('/learn/kanji/radical/85?family=1')
    expect(scrolled).toHaveBeenCalledWith(0, 0)

    // The family, by level; the lesson and its platforms stand down.
    await expect.poll(() => s.one('.rad-family')).not.toBeNull()
    expect(s.one('.rad-plate')).toBeNull()
    expect(s.all('.platform-card').length).toBe(0)
    expect(s.all('.rad-family .dict-mark__jp').map(n => n.textContent)).toEqual(['N5', 'N4'])
    const tiles = s.all('.rad-kanji')
    expect(tiles.map(n => n.querySelector('.rad-kanji__char').textContent)).toEqual(['水', '海', '泳'])
    expect(tiles.map(n => n.className)).toEqual(['rad-kanji rad-kanji--mastered', 'rad-kanji rad-kanji--learning', 'rad-kanji rad-kanji--new'])
    // The first gloss only, sentence-cased as the dictionary casts it: the tile is 88px wide.
    expect(tiles[2].querySelector('.rad-kanji__meaning').textContent).toBe('Nager')

    // One fetch for the two views: the lesson never unmounts.
    expect(apiJson.mock.calls.filter(c => String(c[0]).startsWith('/api/kanji/radical/85')).length).toBe(1)

    const leave = s.one('.bar__aside .stage__leave')
    expect(leave.textContent).toBe(fr.radLesson)
    scrolled.mockClear()
    leave.click()
    await expect.poll(s.where).toBe('/learn/kanji/radical/85')
    await expect.poll(() => s.one('.rad-plate')).not.toBeNull()
    expect(scrolled, 'and the lesson comes back at its own top too').toHaveBeenCalledWith(0, 0)
    scrolled.mockRestore()
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
