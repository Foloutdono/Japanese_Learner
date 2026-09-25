import { describe, it, expect, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { LangProvider } from './LangContext'
import './index.css'

// ── 机 — the gates laid out for the width (plan 113) ────────────
// At the desk's tightest (1100, the rail taking 256 of it) the two
// plated gates hang their plates two by two — Learn's odd fifth across
// the row, Practice's six in three rows of two since 作文 (plan 125) —
// and Today sets the strip beside the fare gate. The phone's own
// column (layout.phone.test, PracticeScreen.phone.test) does not move.

// The learner's record on the Practice gate (plan 130): reading at N5
// and N4, one text at N5, one paper at N5; nothing anywhere else.
const RECORD = {
  reading: { N5: { done: 24, right: 20, of: 24 }, N4: { done: 3, right: 2, of: 3 } },
  comprehension: { N5: { done: 1, right: 3, of: 4 } },
  translation: {}, dictation: {}, composition: {},
  exam: { N5: { done: 1, right: 26, of: 40 } },
}
vi.mock('./lib/api', () => ({
  api: p => p,
  apiFetch: vi.fn(async path => ({ ok: true, status: 200, json: async () => (path === '/api/practice/record' ? RECORD : {}) })),
  apiJson: vi.fn(async () => ({})),
  apiJsonWithTimeout: vi.fn(async () => ({})),
  apiUpload: vi.fn(),
  ApiError: class extends Error {},
}))
vi.mock('./lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: async () => ({ data: { session: { access_token: 'tok' } } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
    },
  },
}))
vi.mock('./lib/audio', async o => ({
  ...(await o()), playUi: vi.fn(), playAnnouncement: vi.fn(), playClick: vi.fn(),
}))
vi.mock('./stores/boarding', () => ({ board: commit => commit() }))
vi.mock('./stores/profileSummary', async (o) => ({ ...(await o()), useProfileSummary: () => ({ jlptLevel: 'N4' }) }))
// The distance on each line (plan 130's upright foot): kana finished,
// vocab N5 met but not yet learned.
const STATS = {
  items: {
    kana: Object.fromEntries(['hiragana_basic', 'hiragana_combos', 'katakana_basic', 'katakana_combos'].map(k => [k, { total: 40, learned: 40, started: 40, score: 1 }])),
    vocab: { N5: { total: 600, learned: 60, started: 180, score: 0.2 }, N4: { total: 640 }, N3: { total: 1700 }, N2: { total: 1760 }, N1: { total: 3200 } },
  },
}
vi.mock('./stores/stats', async (o) => ({ ...(await o()), useStats: () => ({ data: STATS, failed: false }) }))
globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) })

const { default: PracticeScreen } = await import('./screens/PracticeScreen')
const { default: LearnScreen } = await import('./screens/LearnScreen')

// The plates arrive staggered (index.css's `arrive`); a slow runner can
// still be finishing the last of them when the timer fires, and a plate
// a fraction of a pixel short of its place reads as a row out of line.
// So the wait is for the arrivals themselves, once the timer is up.
const settle = async (ms = 620) => {
  await new Promise(r => setTimeout(r, ms))
  await Promise.all(document.getAnimations()
    .filter(a => a.effect?.getComputedTiming().iterations !== Infinity)
    .map(a => a.finished.catch(() => {})))
}

// The shell's frame without the shell: the content column beside a
// rail's width of nothing, which is what the desk leaves a screen.
const seen = { path: null }
function Probe() {
  const { pathname, search } = useLocation()
  seen.path = pathname + search
  return null
}
function framed(path, screen) {
  return render(
    <LangProvider>
      <MemoryRouter initialEntries={[path]}>
        <div className="phone phone--desk">
          <div className="phone__content">{screen}</div>
        </div>
        <Probe />
      </MemoryRouter>
    </LangProvider>
  )
}
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)]
const box = el => el.getBoundingClientRect()
const press = (key, el = document.activeElement) => el.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }))

// Two across: every pair shares a top and a height, and each half is
// half. An odd last plate takes the row (`spans`); an even count ends
// on a full pair.
function lattice(plates, { count, spans }) {
  const boxes = [...plates.children].map(p => p.getBoundingClientRect())
  const whole = plates.getBoundingClientRect()
  expect(boxes).toHaveLength(count)
  for (let i = 0; i + 1 < count; i += 2) {
    // Within a pixel rather than rounded apiece: since plan 130 the rows
    // share the window, so a row can start on a half pixel, and two
    // rounds of 369.5 measured a hair apart land either side of it.
    expect(Math.abs(boxes[i].top - boxes[i + 1].top)).toBeLessThanOrEqual(1)
    expect(boxes[i + 1].left).toBeGreaterThan(boxes[i].right)
    expect(Math.abs(boxes[i].width - boxes[i + 1].width)).toBeLessThanOrEqual(1)
    expect(boxes[i].width).toBeLessThan(whole.width / 2)
    expect(Math.abs(boxes[i].height - boxes[i + 1].height)).toBeLessThanOrEqual(1)
    if (i > 0) expect(boxes[i].top).toBeGreaterThan(boxes[i - 2].bottom)
  }
  const last = boxes[count - 1]
  if (spans) {
    expect(last.top).toBeGreaterThan(boxes[count - 2].bottom)
    expect(Math.abs(last.width - whole.width)).toBeLessThanOrEqual(1)
  } else {
    expect(last.width).toBeLessThan(whole.width / 2)
  }
}

describe('the plated gates on the desk', () => {
  it('hangs Practice\'s six platforms in three rows of two, the exam last beside 作文', async () => {
    await framed('/practice', <PracticeScreen />)
    await settle()
    const plates = document.querySelector('.practice > .plates')
    expect(getComputedStyle(plates).display).toBe('grid')
    // Six divide by two, so the odd-last rule has nothing to span: the
    // exam keeps its place at the end of the gate and shares the third
    // row with the platform added before it (plan 125).
    lattice(plates, { count: 6, spans: false })
    expect(plates.lastElementChild.querySelector('.plate__head').textContent).toMatch(/examen|exam/i)
    expect(plates.children[4].querySelector('.plate__head').textContent).toMatch(/rédaction|composition/i)
    for (const title of document.querySelectorAll('.plate__title')) {
      expect(title.scrollWidth).toBeLessThanOrEqual(title.clientWidth)
    }
  })

  it('hangs Learn\'s lines two by two, the deck shelf across the row', async () => {
    await framed('/learn', <LearnScreen />)
    await settle()
    const plates = document.querySelector('.learn > .plates')
    expect(getComputedStyle(plates).display).toBe('grid')
    lattice(plates, { count: 5, spans: true })
    expect(plates.lastElementChild.classList.contains('plate--shelf')).toBe(true)
  })
})

// Today's layout on the desk is today.desktop.test.jsx (plan 114), on the
// real screen.

// ── plan 130 — the gates take the window ────────────────────────
// The plates stood a third of the way down the window with the rest of
// it empty. They fill it now, their rows sharing the room, and the room
// goes to each plate's body: the line upright on Learn, the grades as
// rows with the learner's record on Practice.
describe('the gates take the window (plan 130)', () => {
  // The page does not scroll, and the last plate stands a gutter from
  // the window's floor: the plates took the room rather than leaving it.
  function fills(gate) {
    const plates = document.querySelector(`.${gate} > .plates`)
    const gutter = parseFloat(getComputedStyle(document.querySelector(`.${gate}`)).paddingBottom)
    expect(document.scrollingElement.scrollHeight).toBeLessThanOrEqual(window.innerHeight + 1)
    expect(Math.abs(box(plates).bottom - (window.innerHeight - gutter))).toBeLessThanOrEqual(2)
  }

  it('draws each Learn line upright, filling its plate, the shelf at its own height', async () => {
    await framed('/learn', <LearnScreen />)
    await settle()
    fills('learn')
    const lines = $$('.learn > .plates > .plate--line')
    expect(lines).toHaveLength(4)
    const shelf = document.querySelector('.plate--shelf')
    expect(box(shelf).height).toBeLessThan(box(lines[0]).height / 2)
    for (const plate of lines) {
      const rows = $$('.desk-line > *', plate)
      // The novice's stop and a row per stop, stacked, sharing the body.
      const heights = rows.map(r => Math.round(box(r).height))
      expect(Math.max(...heights) - Math.min(...heights)).toBeLessThanOrEqual(1)
      rows.slice(1).forEach((r, i) => expect(box(r).top).toBeGreaterThanOrEqual(box(rows[i]).bottom - 1))
      // Every bar starts and ends where the others do.
      const bars = $$('.desk-line__bar', plate).map(box)
      expect(new Set(bars.map(b => Math.round(b.left))).size).toBe(1)
      expect(new Set(bars.map(b => Math.round(b.width))).size).toBe(1)
    }
  })

  it('reads a Learn row as the level\'s make-up and its figure, the ridden leg the one tab stop', async () => {
    await framed('/learn', <LearnScreen />)
    await settle()
    const vocab = $$('.plate--line').find(p => /vocabulaire/i.test(p.querySelector('.plate__title').textContent))
    const [n5, n4] = $$('.desk-line__leg', vocab)
    expect(n5.getAttribute('aria-current')).toBe('location')
    expect($$('.desk-line__leg', vocab).map(l => l.tabIndex)).toEqual([0, -1, -1, -1, -1])
    expect(n5.querySelector('.desk-line__fig').textContent).toBe('60 / 600')
    const bar = box(n5.querySelector('.desk-line__bar')).width
    expect(box(n5.querySelector('.desk-line__learned')).width / bar).toBeCloseTo(0.1, 1)
    expect(box(n5.querySelector('.desk-line__met')).width / bar).toBeCloseTo(0.3, 1)
    expect(box(n4.querySelector('.desk-line__learned')).width).toBe(0)
    // Kana is finished: every station filled, no leg left to ride.
    const kana = $$('.plate--line').find(p => /kana/i.test(p.querySelector('.plate__title').textContent))
    expect($$('.desk-line__leg--done', kana)).toHaveLength(4)
    expect(kana.querySelector('[aria-current]')).toBeNull()
    // The legs are a list: ↓ walks it.
    n5.focus()
    press('ArrowDown')
    expect(document.activeElement).toBe(n4)
  })

  it('hangs Practice\'s grades as rows sharing each plate, with what was done at each', async () => {
    await framed('/practice', <PracticeScreen />)
    await settle()
    fills('practice')
    expect(document.querySelector('.plate__foot--dests')).toBeNull()
    const plates = $$('.practice > .plates > .plate')
    for (const plate of plates) {
      const rows = $$('.desk-grade', plate)
      expect(rows.map(r => r.querySelector('.desk-grade__code').textContent)).toEqual(['N5', 'N4', 'N3', 'N2', 'N1'])
      const heights = rows.map(r => Math.round(box(r).height))
      expect(Math.max(...heights) - Math.min(...heights)).toBeLessThanOrEqual(1)
      // The learner's grade is marked, and is the list's one tab stop.
      expect(rows.map(r => r.getAttribute('aria-current'))).toEqual([null, 'location', null, null, null])
      expect(rows.map(r => r.tabIndex)).toEqual([-1, 0, -1, -1, -1])
      for (const rec of $$('.desk-grade__rec', plate)) expect(rec.scrollWidth).toBeLessThanOrEqual(rec.clientWidth)
    }
    const rec = (plate, i) => $$('.desk-grade__rec', plates[plate])[i].textContent
    expect(rec(0, 0)).toMatch(/^24 phrases · 83\s% justes$/)
    expect(rec(0, 1)).toMatch(/^3 phrases · 67\s% justes$/)
    expect(rec(0, 2)).toBe('Pas encore')
    expect(rec(1, 0)).toMatch(/^1 texte · 75\s% justes$/)
    expect(rec(5, 0)).toMatch(/^1 épreuve · 65\s% justes$/)
    expect(rec(4, 0)).toBe('Pas encore')
    // The row names its platform to a screen reader, as the chip did.
    expect($$('.desk-grade', plates[0])[0].getAttribute('aria-label')).toMatch(/^Entraînement à la lecture — N5 · 24 phrases/)
  })

  it('walks a platform\'s grades with ↑/↓ and departs from the row as from its chip', async () => {
    await framed('/practice', <PracticeScreen />)
    await settle()
    const rows = $$('.desk-grade', document.querySelector('.practice > .plates > .plate'))
    rows[1].focus()
    press('ArrowDown')
    expect(document.activeElement).toBe(rows[2])
    press('Home')
    expect(document.activeElement).toBe(rows[0])
    rows[2].click()
    await settle(80)
    expect(seen.path).toBe('/practice/reading/level/N3')
    const exam = $$('.desk-grade', document.querySelector('.practice > .plates > .plate:last-child'))
    exam[0].click()
    await settle(80)
    expect(seen.path).toBe('/practice/exam?level=N5')
  })
})
