import { describe, it, expect, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { LangProvider } from './LangContext'
import './index.css'

// ── 机 — the gates laid out for the width (plan 113) ────────────
// At the desk's tightest (1100, the rail taking 256 of it) Practice
// hangs its six plates in three rows of two since 作文 (plan 125),
// Learn its four lines in one column beside the shelf (plan 132) —
// and Today sets the strip beside the fare gate. The phone's own
// column (layout.phone.test, PracticeScreen.phone.test) does not move.

// Every practice platform's card at every grade, as
// /api/station/{platform}/samples serves it (plan 165: the Practice
// gate's specimens; testing/practiceCards.json is its `stops`, cards
// only).
const { default: CARDS } = await import('./testing/practiceCards.json')
vi.mock('./lib/api', () => ({
  api: p => p,
  apiFetch: vi.fn(async path => {
    const line = path.match(/^\/api\/station\/(\w+)\/samples/)?.[1]
    return { ok: true, status: 200, json: async () => (line ? { stops: CARDS[line] } : {}) }
  }),
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
// The learner's grade: N4, unless a test walks them all.
const learner = vi.hoisted(() => ({ grade: 'N4' }))
vi.mock('./stores/profileSummary', async (o) => ({
  ...(await o()),
  useProfileSummary: () => ({ jlptLevel: 'N4' }),
  useProfileSummaryState: () => ({ summary: { jlptLevel: learner.grade }, failed: false }),
}))
vi.mock('./stores/departure', async (o) => ({ ...(await o()), beginDeparture: vi.fn() }))
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
const { apiFetch } = await import('./lib/api')
const { beginDeparture } = await import('./stores/departure')
const { default: fr } = await import('./locales/fr/index.js')

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

  it("stands Learn's four lines in one column beside the shelf over the library (plan 132)", async () => {
    await framed('/learn', <LearnScreen />)
    await settle()
    const lines = $$('.learn-desk > .plates > .plate--line').map(box)
    expect(lines).toHaveLength(4)
    // One column: the plates share a left edge and a width, stacked.
    expect(new Set(lines.map(b => Math.round(b.left))).size).toBe(1)
    expect(new Set(lines.map(b => Math.round(b.width))).size).toBe(1)
    lines.slice(1).forEach((b, i) => expect(b.top).toBeGreaterThan(lines[i].bottom))
    // The side beside them, at a station's side on the tightest desk (it
    // grows to the entry's width on a wider one): the shelf over the library.
    const side = document.querySelector('.learn-desk__side')
    expect(Math.round(box(side).width)).toBe(360)
    expect(box(side).left).toBeGreaterThan(lines[0].right)
    const [shelf, library] = [...side.children]
    expect(shelf.classList.contains('gate-panel--shelf')).toBe(true)
    expect(library.classList.contains('gate-panel--library')).toBe(true)
    expect(box(library).top).toBeGreaterThan(box(shelf).bottom)
    // The phone's fifth plate is not drawn on the desk.
    expect(document.querySelector('.plate--shelf')).toBeNull()
  })
})

// Today's layout on the desk is today.desktop.test.jsx (plan 114), on the
// real screen.

// ── plan 130 — the gates take the window ────────────────────────
// The plates stood a third of the way down the window with the rest of
// it empty. They fill it now, their rows sharing the room, and the room
// goes to each plate's body: the line upright on Learn, and on Practice
// the grades as rows with the learner's record -- since plan 165, each
// platform's specimen (below).
//
// The page does not scroll, and the last plate stands a gutter from
// the window's floor: the plates took the room rather than leaving it.
function fills(gate) {
  const plates = document.querySelector(`.${gate} > .plates`)
  const gutter = parseFloat(getComputedStyle(document.querySelector(`.${gate}`)).paddingBottom)
  expect(document.scrollingElement.scrollHeight).toBeLessThanOrEqual(window.innerHeight + 1)
  expect(Math.abs(box(plates).bottom - (window.innerHeight - gutter))).toBeLessThanOrEqual(2)
}

describe('the gates take the window (plan 130)', () => {
  it('draws each Learn line across its plate, the four filling the window (plan 132)', async () => {
    await framed('/learn', <LearnScreen />)
    await settle()
    const gutter = parseFloat(getComputedStyle(document.querySelector('.learn')).paddingBottom)
    expect(document.scrollingElement.scrollHeight).toBeLessThanOrEqual(window.innerHeight + 1)
    const column = document.querySelector('.learn-desk > .plates')
    expect(Math.abs(box(column).bottom - (window.innerHeight - gutter))).toBeLessThanOrEqual(2)
    const lines = $$('.learn-desk > .plates > .plate--line')
    const heights = lines.map(p => Math.round(box(p).height))
    expect(Math.max(...heights) - Math.min(...heights)).toBeLessThanOrEqual(1)
    for (const plate of lines) {
      const stops = $$('.desk-line > *', plate).map(box)
      // The novice's stop and a column per stop, side by side, one width each.
      stops.slice(1).forEach((b, i) => expect(b.left).toBeGreaterThanOrEqual(stops[i].right - 1))
      expect(new Set(stops.map(b => Math.round(b.width))).size).toBe(1)
      // The rings on one rail.
      const rings = $$('.desk-line__ring', plate).map(r => Math.round(box(r).top + box(r).height / 2))
      expect(Math.max(...rings) - Math.min(...rings)).toBeLessThanOrEqual(1)
      expect($$('.desk-line__bar', plate).every(b => getComputedStyle(b).display === 'none')).toBe(true)
    }
  })

  it('reads a Learn stop as its figure, the ridden leg in the lead rung and the one tab stop', async () => {
    await framed('/learn', <LearnScreen />)
    await settle()
    const vocab = $$('.plate--line').find(p => /vocabulaire/i.test(p.querySelector('.plate__title').textContent))
    const [n5, n4] = $$('.desk-line__leg', vocab)
    expect(n5.getAttribute('aria-current')).toBe('location')
    expect($$('.desk-line__leg', vocab).map(l => l.tabIndex)).toEqual([0, -1, -1, -1, -1])
    expect(n5.querySelector('.desk-line__fig').textContent).toBe('60 / 600')
    const size = el => parseFloat(getComputedStyle(el.querySelector('.desk-line__stop')).fontSize)
    expect(size(n5)).toBeGreaterThan(size(n4))
    // Kana is finished: every station filled, no leg left to ride.
    const kana = $$('.plate--line').find(p => /kana/i.test(p.querySelector('.plate__title').textContent))
    expect($$('.desk-line__leg--done', kana)).toHaveLength(4)
    expect(kana.querySelector('[aria-current]')).toBeNull()
    // The legs are a list: the arrow walks it.
    n5.focus()
    press('ArrowDown')
    expect(document.activeElement).toBe(n4)
  })
})

// ── plan 165 — every platform's specimen ───────────────────────
// The canvas's last board: each Practice plate holds, under its name,
// the run's own card in a well, at the learner's grade -- the one door
// to the station. At the desk's tightest the plates stand three rows
// deep, so the line over the well gives its room to the well and
// comprehension holds its text without its question; every well shows
// its card whole, and the gate still takes the window without a scroll.
describe('every platform\'s specimen on the Practice gate (plan 165)', () => {
  const plates = () => $$('.practice > .plates > .plate')
  const well = plate => plate.querySelector('.plate__head .plate__body .prc-spec--plate')
  const platformOf = plate => ['reading', 'comprehension', 'translation', 'dictation', 'composition', 'exam'][plates().indexOf(plate)]

  it('draws each platform\'s card at the learner\'s grade, whole, in a gate that fills the window', async () => {
    await framed('/practice', <PracticeScreen />)
    await settle()
    fills('practice')
    // No grades on the desk's plates: the station a plate opens has them.
    expect(document.querySelector('.plate__foot')).toBeNull()
    expect(apiFetch.mock.calls.some(([path]) => path === '/api/practice/record')).toBe(false)
    expect(plates()).toHaveLength(6)
    for (const plate of plates()) {
      const w = well(plate)
      expect(w, platformOf(plate)).not.toBeNull()
      // Whole: nothing in the well cut at its foot or its edge.
      expect(w.scrollHeight, platformOf(plate)).toBeLessThanOrEqual(w.clientHeight + 1)
      expect(w.scrollWidth, platformOf(plate)).toBeLessThanOrEqual(w.clientWidth + 1)
      expect(w.getAttribute('aria-hidden')).toBe('true')
    }
    const [reading, comprehension, translation, dictation, composition, exam] = plates().map(well)
    expect(reading.querySelector('.prc-spec__jp').textContent).toBe(CARDS.reading.N4.card.jp)
    expect(reading.querySelector('.prc-spec__clock')).not.toBeNull()
    expect(translation.querySelector('.prc-spec__prompt').textContent).toBe(CARDS.translation.N4.card.en)
    expect(dictation.querySelector('.prc-spec__audio')).not.toBeNull()
    expect(composition.querySelector('.prc-spec__jp').textContent).toBe(CARDS.composition.N4.card.jp)
    expect(composition.querySelector('.prc-spec__gloss').textContent).toBe(CARDS.composition.N4.card.meaning)
    // The exam's 漢字読み: its word underlined, the paper's four readings.
    const vocab = CARDS.exam.N4.card.vocab
    expect(exam.querySelector('.prc-spec__mark').textContent).toBe(vocab.word)
    expect($$('.prc-spec__opt', exam).map(o => o.textContent.slice(1))).toEqual(vocab.options)
    // Three rows deep, the plates are short: comprehension holds its
    // text alone, and no line is drawn over any well.
    expect(comprehension.querySelector('.prc-spec__title').textContent).toBe(CARDS.comprehension.N4.card.title)
    expect(comprehension.querySelector('.prc-spec__q')).toBeNull()
    for (const how of $$('.plate__how')) expect(how.hidden).toBe(true)
  })

  it('holds every grade\'s card whole, N1\'s longest sentences too', async () => {
    for (const grade of ['N5', 'N4', 'N3', 'N2', 'N1']) {
      learner.grade = grade
      const screen = await framed('/practice', <PracticeScreen />)
      await settle(300)
      expect(document.scrollingElement.scrollHeight, grade).toBeLessThanOrEqual(window.innerHeight + 1)
      for (const plate of plates()) {
        const w = well(plate)
        expect(w.textContent, `${grade} ${platformOf(plate)}`).not.toBe('')
        expect(w.scrollHeight, `${grade} ${platformOf(plate)}`).toBeLessThanOrEqual(w.clientHeight + 1)
        expect(w.scrollWidth, `${grade} ${platformOf(plate)}`).toBeLessThanOrEqual(w.clientWidth + 1)
      }
      expect(plates()[0].querySelector('.prc-spec__jp').textContent).toBe(CARDS.reading[grade].card.jp)
      await screen.unmount()
    }
    learner.grade = 'N4'
  })

  it('makes the plate one door, named for its platform and described by what it asks', async () => {
    await framed('/practice', <PracticeScreen />)
    await settle()
    const heads = plates().map(p => p.querySelector(':scope > .plate__head'))
    expect(heads.every(h => h.tagName === 'BUTTON')).toBe(true)
    // The head is the plate: it runs from the plate's top to its stripe.
    for (const [i, head] of heads.entries()) {
      expect(Math.abs(box(head).height - (box(plates()[i]).height - box(plates()[i].querySelector('.plate__stripe')).height - 2))).toBeLessThanOrEqual(1)
    }
    // The name is the name; what the platform asks is the description,
    // there to a screen reader even where the plate is too short to draw it.
    const how = document.getElementById(heads[0].getAttribute('aria-describedby'))
    expect(how.textContent).toBe(fr.practiceHow.reading)
    expect(how.getAttribute('aria-hidden')).toBe('true')
    expect(heads[5].querySelector('.plate__title').textContent).toBe(fr.examTitle)
    // A click anywhere on the plate -- the well too -- departs for its station.
    beginDeparture.mockClear()
    heads[1].querySelector('.prc-spec').click()
    expect(beginDeparture).toHaveBeenCalledTimes(1)
    expect(beginDeparture.mock.calls[0][0].path).toBe('/practice/comprehension')
  })
})
