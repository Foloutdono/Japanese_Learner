import { describe, it, expect, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { MemoryRouter } from 'react-router-dom'
import { LangProvider } from '../LangContext'
// The shipped face (main.jsx), so a platform's name is measured in the
// font it is drawn in: CI's fallback (DejaVu Sans) sets « Entraînement
// à la lecture » wider than Space Grotesk does.
import '@fontsource/space-grotesk/latin-700.css'
import '../index.css'

// ── 実践 — the gate's platforms, at 390px (plan 254) ──────────────
// One station plate per platform, the Learn gate's own (plan 094): the
// owner's pick B of the canvas "Tsuji — Practice, new directions",
// after the painted platform of plan 225. A plate opens where the
// learner is, as Learn's does -- the platform's list of grades, their
// own marked -- and its foot prints that grade between what they did
// there and the share of it that went right. The desk's plates carry
// each platform's exercise instead (PracticeScreen.desktop.test.jsx).

const RECORD = vi.hoisted(() => ({
  reading: { N4: { done: 24, right: 20, of: 24, last: '2026-10-10T08:00:00+00:00' } },
  conversation: { N4: { done: 11, right: 8, of: 11, last: '2026-10-12T08:00:00+00:00' } },
  // A grade the learner is not at: nothing of it reaches their plate.
  translation: { N3: { done: 5, right: 5, of: 5, last: '2026-10-11T08:00:00+00:00' } },
}))
const feed = vi.hoisted(() => ({ record: true }))
vi.mock('../lib/api', () => ({
  api: p => p,
  apiFetch: vi.fn(async path => (path === '/api/practice/record' && feed.record
    ? { ok: true, status: 200, json: async () => RECORD }
    : { ok: false, status: 500, json: async () => ({}) })),
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
vi.mock('../stores/profileSummary', async (o) => ({
  ...(await o()),
  useProfileSummary: () => ({ jlptLevel: 'N4' }),
  useProfileSummaryState: () => ({ summary: { jlptLevel: 'N4' }, failed: false }),
}))
// The station's own departure is the cutscene's (stores/departure); here
// it only has to be asked for.
const beginDeparture = vi.hoisted(() => vi.fn())
vi.mock('../stores/departure', async o => ({ ...(await o()), beginDeparture }))
globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) })

const { default: PracticeScreen } = await import('./PracticeScreen')
const { getSections } = await import('../config/tabs')
const { apiFetch } = await import('../lib/api')
const { default: fr } = await import('../locales/fr/index.js')
const { forgetPracticeRecord } = await import('../stores/practiceRecord')

// How many platforms the gate has, asked of the registry rather than
// written down: the contract is that each platform gets a plate and an
// equal share of the gate, not that there are seven of them.
const SECTIONS = getSections('practice', fr)
const PLATFORMS = SECTIONS.length

// Long enough for the shared `arrive` to land: it starts the plate
// 10px low, and everything below measures against the page's foot.
const settle = async (ms = 620) => {
  await new Promise(r => setTimeout(r, ms))
  await document.fonts.ready
}

async function gate() {
  forgetPracticeRecord()
  const screen = await render(
    <LangProvider>
      <MemoryRouter initialEntries={['/practice']}>
        <div className="phone">
          <div className="phone__content"><PracticeScreen /></div>
        </div>
      </MemoryRouter>
    </LangProvider>
  )
  await settle()
  return screen
}
const plates = root => [...root.querySelectorAll('.practice > .plates > .plate')]
const foot = plate => {
  const [done, grade, right] = ['.plate__prev', '.plate__here', '.plate__next'].map(sel => plate.querySelector(sel).textContent)
  return { done, grade, right }
}

describe('the practice gate at phone width (plan 254)', () => {
  it('names each platform once, in one language and on one line', async () => {
    const screen = await gate()
    const grid = screen.container.querySelector('.plates')
    // No Japanese caption on a plate -- the sections still carry their
    // Japanese, for the roundel's station and the departure's gate.
    expect(grid.querySelector('[lang="ja"]')).toBeNull()
    expect(SECTIONS.every(s => s.icon)).toBe(true)
    const titles = [...grid.querySelectorAll('.plate__title')]
    expect(titles.map(t => t.textContent)).toEqual(SECTIONS.map(s => s.title))
    // Nothing under the name: the foot says the rest.
    expect(grid.querySelectorAll('.plate__meta, .plate__body')).toHaveLength(0)
    for (const title of titles) {
      expect(title.children).toHaveLength(0)
      const line = parseFloat(getComputedStyle(title).lineHeight)
      expect(title.getBoundingClientRect().height).toBeLessThan(line * 1.6)
      expect(title.scrollWidth).toBeLessThanOrEqual(title.clientWidth)
    }
  })

  // ── The plates take the gate ──
  // Seven where Learn hangs five or six: their heads a rung tighter,
  // the seven share the gate and hold its height.
  it('gives every platform an equal share of the gate, all seven in it', async () => {
    const screen = await gate()
    const content = screen.container.querySelector('.phone__content').getBoundingClientRect()
    const grid = screen.container.querySelector('.plates').getBoundingClientRect()
    expect(grid.bottom).toBeLessThanOrEqual(content.bottom + 1)
    expect(content.bottom - grid.bottom).toBeLessThanOrEqual(24)
    const boxes = plates(screen.container).map(el => el.getBoundingClientRect())
    expect(boxes).toHaveLength(PLATFORMS)
    for (const box of boxes) {
      expect(box.height).toBeCloseTo(boxes[0].height, 0)
      // A thumb's worth of door each.
      expect(box.height).toBeGreaterThan(80)
    }
    // Every title starts on the same x, the roundels in one column.
    const titles = [...screen.container.querySelectorAll('.plate__title')].map(el => el.getBoundingClientRect())
    for (const box of titles) expect(box.left).toBeCloseTo(titles[0].left, 0)
  })

  // ── The foot: the learner's grade, and what they did there ──
  it('prints the learner\'s grade at every foot, between what they did there and the share right', async () => {
    const screen = await gate()
    const at = path => plates(screen.container)[SECTIONS.findIndex(s => s.path === path)]
    await vi.waitFor(() => expect(foot(at('/practice/reading')).done).toBe('24 phrases'))
    expect(foot(at('/practice/reading'))).toEqual({ done: '24 phrases', grade: 'N4', right: '83 % justes' })
    expect(foot(at('/practice/conversation'))).toEqual({ done: '11 réponses', grade: 'N4', right: '73 % justes' })
    // Nothing at the learner's grade: said so, and no share. Another
    // grade's record is that grade's (translation's N3).
    for (const path of ['/practice/comprehension', '/practice/translation', '/practice/dictation', '/practice/composition', '/practice/exam']) {
      expect(foot(at(path)), path).toEqual({ done: fr.practiceNotYet, grade: 'N4', right: '' })
    }
    // The grade is the foot's lead, the figures either side of it, and
    // the stripe is painted raw: a platform has no track behind it.
    for (const plate of plates(screen.container)) {
      expect(plate.querySelector('.plate__foot--stops')).not.toBeNull()
      expect(plate.querySelector('.plate__stripe i').style.width).toBe('100%')
    }
  })

  it('hangs the grade alone while the record cannot be read', async () => {
    feed.record = false
    try {
      const screen = await gate()
      for (const plate of plates(screen.container)) expect(foot(plate)).toEqual({ done: '', grade: 'N4', right: '' })
      expect(apiFetch.mock.calls.some(([path]) => path === '/api/practice/record')).toBe(true)
    } finally {
      feed.record = true
    }
  })

  // ── A plate opens where the learner is ──
  it('opens each platform\'s list of grades, the one the learner stands at marked', async () => {
    const screen = await gate()
    const where = {}
    for (const [i, plate] of plates(screen.container).entries()) {
      beginDeparture.mockClear()
      playAnnouncement.mockClear()
      plate.querySelector('.plate__head').click()
      expect(beginDeparture).toHaveBeenCalledTimes(1)
      const section = beginDeparture.mock.calls[0][0]
      // The gate wipes in the platform's own pigment and plate.
      expect(section.title).toBe(SECTIONS[i].title)
      expect(section.color).toBe(SECTIONS[i].color)
      expect(playAnnouncement).toHaveBeenCalledWith(SECTIONS[i].clip)
      where[SECTIONS[i].path] = section.path
    }
    expect(where).toEqual({
      // Reading and translation: their JLPT list, past the choice of a
      // source, which is one tap back.
      '/practice/reading': '/practice/reading/levels',
      '/practice/translation': '/practice/translation/levels',
      // One axis each: the station is the list.
      '/practice/comprehension': '/practice/comprehension',
      '/practice/dictation': '/practice/dictation',
      '/practice/composition': '/practice/composition',
      // The exam's papers and 会話's scenes, which open on the learner's
      // grade by themselves.
      '/practice/exam': '/practice/exam',
      '/practice/conversation': '/practice/conversation',
    })
  })

  // The desk's specimens draw from the station's samples; a phone has
  // no well to draw them in.
  it('never asks for a sample', async () => {
    apiFetch.mockClear()
    await gate()
    expect(apiFetch.mock.calls.some(([path]) => path.startsWith('/api/station/'))).toBe(false)
  })
})

// ── 案内 — the anchors the guide points at (plan 100) ────────────
describe('the practice gate\'s guide anchors', () => {
  it('marks the first platform and its foot, and the exam, once each', async () => {
    const screen = await gate()
    const root = screen.container
    expect(root.querySelectorAll('[data-guide="practice.plate"]')).toHaveLength(1)
    expect(root.querySelector('[data-guide="practice.plate"] [data-guide="practice.stops"]')).toBeTruthy()
    expect(root.querySelectorAll('[data-guide="practice.stops"]')).toHaveLength(1)
    const exam = root.querySelectorAll('[data-guide="practice.exam"]')
    expect(exam).toHaveLength(1)
    expect(exam[0].querySelector('.plate__title').textContent).toBe(fr.examTitle)
    // No pass tag is drawn while nothing is for sale: the guide skips
    // that stop rather than pointing at nothing.
    expect(root.querySelector('[data-guide="practice.pass"]')).toBeNull()
  })
})
