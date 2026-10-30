import { describe, it, expect, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { MemoryRouter } from 'react-router-dom'
import { LangProvider } from '../LangContext'
// The shipped face (main.jsx), so the plates' names are measured in the
// font they are drawn in (gates.wide.test.jsx says why).
import '@fontsource/space-grotesk/latin-700.css'
// ... and the wells' Japanese in the app's own face (main.jsx), so a
// sentence breaks where a learner sees it break.
import '@fontsource/noto-sans-jp/400.css'
import '@fontsource/noto-sans-jp/700.css'
import '../index.css'

// ── 見本 — every platform's specimen, on the desk (plans 165, 254) ──────
// The owner's pick A of the canvas "Tsuji — Practice, new directions":
// the desk's Practice gate hangs a plate per platform again, after the
// painted platform of plan 244, each holding under its name the run's
// own card in a well, at the learner's grade -- the one door to the
// station. Seven since plan 254, 会話 among them: at the desk's
// tightest, 1100×800, two to a row and the exam's paper the whole last
// row, the gate a row taller than the window. A laptop's three across
// is gates.wide.test.jsx, the short window's gates.short.test.jsx.

// Every platform's card at every grade, as /api/station/{platform}/samples
// serves it (testing/practiceCards.json is its `stops`, cards only).
const { default: CARDS } = await import('../testing/practiceCards.json')
vi.mock('../lib/api', () => ({
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
vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: async () => ({ data: { session: { access_token: 'tok' } } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
    },
  },
}))
const playAnnouncement = vi.hoisted(() => vi.fn())
vi.mock('../lib/audio', async o => ({ ...(await o()), playUi: vi.fn(), playAnnouncement, playClick: vi.fn() }))
// The learner's grade: N4, unless a test walks them all.
const learner = vi.hoisted(() => ({ grade: 'N4' }))
vi.mock('../stores/profileSummary', async (o) => ({
  ...(await o()),
  useProfileSummary: () => ({ jlptLevel: learner.grade }),
  useProfileSummaryState: () => ({ summary: { jlptLevel: learner.grade }, failed: false }),
}))
const beginDeparture = vi.hoisted(() => vi.fn())
vi.mock('../stores/departure', async o => ({ ...(await o()), beginDeparture }))
globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) })

const { default: PracticeScreen } = await import('./PracticeScreen')
const { getSections } = await import('../config/tabs')
const { apiFetch } = await import('../lib/api')
const { default: fr } = await import('../locales/fr/index.js')

const SECTIONS = getSections('practice', fr)
const EXAM = '/practice/exam'
// The desk's order: the config's, the exam's paper last.
const ORDER = [...SECTIONS.filter(s => s.path !== EXAM), ...SECTIONS.filter(s => s.path === EXAM)]
const KEY = {
  '/practice/reading': 'reading', '/practice/comprehension': 'comprehension', '/practice/translation': 'translation',
  '/practice/dictation': 'dictation', '/practice/composition': 'composition', '/practice/exam': 'exam',
  '/practice/conversation': 'conversation',
}

// The plates arrive staggered (index.css's `arrive`), and a well's face
// is chosen from its measured room: wait for both. The arrivals by their
// own end, not the timer's: a slow runner can still be lifting the last
// plates when it fires.
const settle = async (ms = 620) => {
  await new Promise(r => setTimeout(r, ms))
  await document.fonts.ready
  await Promise.all(document.getAnimations()
    .filter(a => a.effect?.getComputedTiming().iterations !== Infinity)
    .map(a => a.finished.catch(() => {})))
}
// The shell's frame without the shell: the content column beside a
// rail's width of nothing, which is what the desk leaves a screen.
const gate = () => render(
  <LangProvider>
    <MemoryRouter initialEntries={['/practice']}>
      <div className="phone phone--desk">
        <div className="phone__content"><PracticeScreen /></div>
      </div>
    </MemoryRouter>
  </LangProvider>
)
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)]
const box = el => el.getBoundingClientRect()
const plates = () => $$('.practice > .plates > .plate')
const well = plate => plate.querySelector('.plate__head .plate__body .prc-spec--plate')
const nameOf = plate => plate.querySelector('.plate__title').textContent

describe('every platform\'s specimen on the Practice gate (plans 165, 254)', () => {
  it('hangs the seven two to a row at the desk\'s tightest, the exam\'s paper the last row', async () => {
    await gate()
    await settle()
    expect(plates().map(nameOf)).toEqual(ORDER.map(s => s.title))
    const boxes = plates().map(box)
    const whole = box(document.querySelector('.practice > .plates'))
    for (let i = 0; i < 6; i += 2) {
      // A pair shares a row: one top, one height, one width, half the gate.
      expect(Math.abs(boxes[i].top - boxes[i + 1].top)).toBeLessThanOrEqual(1)
      expect(Math.abs(boxes[i].height - boxes[i + 1].height)).toBeLessThanOrEqual(1)
      expect(Math.abs(boxes[i].width - boxes[i + 1].width)).toBeLessThanOrEqual(1)
      expect(boxes[i].width).toBeLessThan(whole.width / 2)
      if (i > 0) expect(boxes[i].top).toBeGreaterThan(boxes[i - 2].bottom)
    }
    // The paper takes the whole last row, its edges on the columns above.
    const paper = boxes[6]
    expect(paper.top).toBeGreaterThan(boxes[5].bottom)
    expect(Math.abs(paper.left - boxes[0].left)).toBeLessThanOrEqual(1)
    expect(Math.abs(paper.right - boxes[1].right)).toBeLessThanOrEqual(1)
    // The rows keep the room a specimen needs, and the window scrolls
    // the one it cannot hold.
    for (const b of boxes) expect(b.height).toBeGreaterThanOrEqual(240 - 1)
    expect(document.scrollingElement.scrollHeight).toBeGreaterThan(window.innerHeight)
    // Every French name whole: a long one takes two lines, never an ellipsis.
    for (const title of $$('.plate__title')) expect(title.scrollWidth).toBeLessThanOrEqual(title.clientWidth)
  })

  it('draws each platform\'s card at the learner\'s grade, whole, and asks no record', async () => {
    await gate()
    await settle()
    // No grades on the desk's plates, nor a foot: the station a plate
    // opens has them, and the record with them.
    expect(document.querySelector('.plate__foot')).toBeNull()
    expect(apiFetch.mock.calls.some(([path]) => path === '/api/practice/record')).toBe(false)
    for (const plate of plates()) {
      const w = well(plate)
      expect(w, nameOf(plate)).not.toBeNull()
      expect(w.scrollHeight, nameOf(plate)).toBeLessThanOrEqual(w.clientHeight + 1)
      expect(w.scrollWidth, nameOf(plate)).toBeLessThanOrEqual(w.clientWidth + 1)
      expect(w.getAttribute('aria-hidden')).toBe('true')
    }
    // The registry's order, its three groups (plan 290), the paper last.
    const [reading, comprehension, dictation, translation, composition, conversation, exam] = plates().map(well)
    expect(reading.querySelector('.prc-spec__jp').textContent).toBe(CARDS.reading.N4.card.jp)
    expect(reading.querySelector('.prc-spec__clock')).not.toBeNull()
    expect(translation.querySelector('.prc-spec__prompt').textContent).toBe(CARDS.translation.N4.card.en)
    expect(dictation.querySelector('.prc-spec__audio')).not.toBeNull()
    expect(composition.querySelector('.prc-spec__jp').textContent).toBe(CARDS.composition.N4.card.jp)
    expect(conversation.querySelector('.prc-spec__jp').textContent).toBe(CARDS.conversation.N4.card.opener)
    // The exam's 漢字読み: its word underlined, the paper's four readings.
    const vocab = CARDS.exam.N4.card.vocab
    expect(exam.querySelector('.prc-spec__mark').textContent).toBe(vocab.word)
    expect($$('.prc-spec__opt', exam).map(o => o.textContent.slice(1))).toEqual(vocab.options)
    // Two to a row at 800px, the plates are short: comprehension holds
    // its text alone, and no line is drawn over any well.
    expect(comprehension.querySelector('.prc-spec__title').textContent).toBe(CARDS.comprehension.N4.card.title)
    expect(comprehension.querySelector('.prc-spec__q')).toBeNull()
    for (const how of $$('.plate__how')) expect(how.hidden).toBe(true)
  })

  it('holds every grade\'s card whole, N1\'s longest sentences too', async () => {
    try {
      for (const grade of ['N5', 'N4', 'N3', 'N2', 'N1']) {
        learner.grade = grade
        const screen = await gate()
        await settle(300)
        for (const plate of plates()) {
          const w = well(plate)
          const what = `${grade} ${nameOf(plate)}`
          expect(w.textContent, what).not.toBe('')
          expect(w.scrollHeight, what).toBeLessThanOrEqual(w.clientHeight + 1)
          expect(w.scrollWidth, what).toBeLessThanOrEqual(w.clientWidth + 1)
        }
        expect(plates()[0].querySelector('.prc-spec__jp').textContent).toBe(CARDS.reading[grade].card.jp)
        await screen.unmount()
      }
    } finally {
      learner.grade = 'N4'
    }
  })

  // The line saying what the run asks is the plate's description, drawn
  // or not: the button's name stays the platform's.
  it('names each plate by its platform and describes it by what its run asks', async () => {
    await gate()
    await settle()
    for (const [i, plate] of plates().entries()) {
      const head = plate.querySelector('.plate__head')
      const how = document.getElementById(head.getAttribute('aria-describedby'))
      expect(how.textContent).toBe(fr.practiceHow[KEY[ORDER[i].path]])
      expect(how.getAttribute('aria-hidden')).toBe('true')
    }
  })

  it('opens each platform\'s station, the whole plate one door', async () => {
    await gate()
    await settle()
    for (const [i, plate] of plates().entries()) {
      beginDeparture.mockClear()
      playAnnouncement.mockClear()
      // The well is inside the door: a click on the card opens it too.
      well(plate).click()
      expect(beginDeparture).toHaveBeenCalledTimes(1)
      expect(beginDeparture.mock.calls[0][0]).toEqual(ORDER[i])
      expect(playAnnouncement).toHaveBeenCalledWith(ORDER[i].clip)
    }
  })

  // ── 案内 (plan 100) ──
  it('marks the first platform and the exam for the guide, and no foot', async () => {
    await gate()
    await settle()
    expect($$('[data-guide="practice.plate"]')).toHaveLength(1)
    expect(nameOf($$('[data-guide="practice.plate"]')[0])).toBe(ORDER[0].title)
    expect(nameOf($$('[data-guide="practice.exam"]')[0])).toBe(fr.examTitle)
    expect(document.querySelector('[data-guide="practice.stops"]')).toBeNull()
  })
})
