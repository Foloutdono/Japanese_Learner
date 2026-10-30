import { describe, it, expect, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom'
import { LangProvider } from '../LangContext'
// The shipped face (main.jsx), so a platform's name is measured in the
// font it is drawn in: CI's fallback (DejaVu Sans) sets « Entraînement
// à la lecture » wider than Space Grotesk does.
import '@fontsource/space-grotesk/latin-700.css'
import '../index.css'

// ── 実践 — the gate's platforms, at 390px (plan 290) ──────────────
// The owner's pick D4 of the canvas "Tsuji — the practice gate",
// improved: every platform folded to one line, its record at the
// learner's grade under its name, in three captioned groups; the last
// grade's ride over them, one tap to board; and a plate raising a
// sheet whose pages board the runs themselves and swipe from platform
// to platform. The desk's plates carry each platform's exercise
// instead (PracticeScreen.desktop.test.jsx).

const RECORD = vi.hoisted(() => ({
  reading: { N4: { done: 24, right: 20, of: 24, last: '2026-10-10T08:00:00+00:00' } },
  // The newest of all, but a scene is no grade's ride to resume.
  conversation: { N4: { done: 11, right: 8, of: 11, last: '2026-10-12T08:00:00+00:00' } },
  // A grade the learner is not at: nothing of it reaches their plate,
  // and it is the last ride a grade alone boards again.
  translation: { N3: { done: 5, right: 5, of: 5, last: '2026-10-11T08:00:00.123456+00:00' } },
}))
const EXAMS = vi.hoisted(() => ['vocab', 'grammar', 'reading', 'listening'].flatMap(kind => ['N5', 'N4'].map(level => ({
  id: `${level.toLowerCase()}-${kind}-01`, kind, level, title: `${level} ${kind}`, generated: true, revision: 3,
  // N4's vocabulary has been sat: the next paper is its grammar.
  last: level === 'N4' && kind === 'vocab' ? { correct: 14, total: 20 } : null,
}))))
const SCENES = vi.hoisted(() => ({
  scenarios: [
    { id: 'post-office', level: 'N4', title: 'À la poste' },
    { id: 'doctor', level: 'N4', title: 'Chez le médecin' },
    { id: 'cafe', level: 'N5', title: 'Au café' },
  ],
  record: { 'post-office': { done: 6, right: 5, last: '2026-10-01T08:00:00+00:00' } },
}))
const feed = vi.hoisted(() => ({ record: true }))
vi.mock('../lib/api', () => ({
  api: p => p,
  apiFetch: vi.fn(async path => {
    const ok = body => ({ ok: true, status: 200, json: async () => body })
    if (path === '/api/practice/record') return feed.record ? ok(RECORD) : { ok: false, status: 500, json: async () => ({}) }
    if (path === '/api/exams') return ok(EXAMS)
    if (path.startsWith('/api/station/')) return ok({ stops: { N4: { card: { jp: '雨が降りそうです。', text: '来週、山に登ります。', vocab: null } } } })
    return { ok: false, status: 500, json: async () => ({}) }
  }),
  apiJson: vi.fn(async path => (path.startsWith('/api/conversation/scenarios') ? SCENES : {})),
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
// A station's departure is the cutscene's (stores/departure), and a
// run's boarding the gate's (stores/boarding); here the one only has to
// be asked for, and the other boards at once.
const beginDeparture = vi.hoisted(() => vi.fn())
vi.mock('../stores/departure', async o => ({ ...(await o()), beginDeparture }))
vi.mock('../stores/boarding', async o => ({ ...(await o()), board: commit => commit() }))
globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) })

const { default: PracticeScreen } = await import('./PracticeScreen')
const { getSections, PRACTICE_GROUPS } = await import('../config/tabs')
const { apiFetch } = await import('../lib/api')
const { default: fr } = await import('../locales/fr/index.js')
const { forgetPracticeRecord } = await import('../stores/practiceRecord')

const SECTIONS = getSections('practice', fr)
const NB = ' '

// Long enough for the shared `arrive` to land: it starts the plate
// 10px low, and everything below measures against it.
const settle = async (ms = 620) => {
  await new Promise(r => setTimeout(r, ms))
  await document.fonts.ready
}

// Where a departure went: the route the run is on, and the state it
// carried.
const went = { path: null, state: null }
function Arrived() {
  const { pathname, search, state } = useLocation()
  went.path = pathname + search
  went.state = state
  return <p data-testid="arrived">{pathname}</p>
}

async function gate() {
  forgetPracticeRecord()
  went.path = null
  went.state = null
  const screen = await render(
    <LangProvider>
      <MemoryRouter initialEntries={['/practice']}>
        <div className="phone">
          <div className="phone__content">
            <Routes>
              <Route path="/practice" element={<PracticeScreen session={{}} />} />
              <Route path="*" element={<Arrived />} />
            </Routes>
          </div>
        </div>
      </MemoryRouter>
    </LangProvider>
  )
  await settle()
  return screen
}
const plates = root => [...root.querySelectorAll('.practice .prc-group .plate')]
const plateOf = (root, path) => plates(root)[SECTIONS.findIndex(s => s.path === path)]
const record = plate => plate.querySelector('.plate__meta').textContent
const sheet = () => document.body.querySelector('.prc-sheet')
const page = () => sheet().querySelector('.prc-page:not([inert])')
const tickets = () => [...page().querySelectorAll('.prc-tk')]
const ticket = name => tickets().find(tk => tk.querySelector('.prc-tk__name').textContent === name)

async function raise(path) {
  const screen = await gate()
  await vi.waitFor(() => expect(record(plateOf(screen.container, '/practice/reading'))).toContain('phrases'))
  plateOf(screen.container, path).querySelector('.plate__head').click()
  await vi.waitFor(() => expect(sheet()).toBeTruthy())
  await settle(80)
  return screen
}

describe('the practice gate at phone width (plan 290)', () => {
  it('hangs the platforms in three groups, each captioned in the learner\'s language', async () => {
    const screen = await gate()
    const groups = [...screen.container.querySelectorAll('.prc-group')]
    expect(groups.map(g => g.querySelector('.prc-group__cap').textContent)).toEqual(PRACTICE_GROUPS.map(g => fr.practiceGroups[g]))
    // Each group holds its own platforms, and the groups read in the
    // registry's order: the gate's order is the config's.
    for (const [i, g] of groups.entries()) {
      const titles = [...g.querySelectorAll('.plate__title')].map(t => t.textContent)
      expect(titles).toEqual(SECTIONS.filter(s => s.group === PRACTICE_GROUPS[i]).map(s => s.title))
      // A group is named for a screen reader by its caption.
      expect(g.getAttribute('aria-labelledby')).toBe(g.querySelector('.prc-group__cap').id)
    }
    expect(plates(screen.container).map(p => p.querySelector('.plate__title').textContent)).toEqual(SECTIONS.map(s => s.title))
  })

  it('names each platform once, in one language and on one line', async () => {
    const screen = await gate()
    const gateEl = screen.container.querySelector('.practice')
    expect(gateEl.querySelector('[lang="ja"]')).toBeNull()
    for (const title of gateEl.querySelectorAll('.plate__title')) {
      expect(title.children).toHaveLength(0)
      const line = parseFloat(getComputedStyle(title).lineHeight)
      expect(title.getBoundingClientRect().height).toBeLessThan(line * 1.6)
      expect(title.scrollWidth).toBeLessThanOrEqual(title.clientWidth)
    }
  })

  // ── Folded ──
  // One line a plate: a thumb's worth of door, no more, so an eighth
  // platform is one more line rather than a squeeze of the seven.
  it('folds every platform to one line of the same height, each a door to a sheet', async () => {
    const screen = await gate()
    const boxes = plates(screen.container).map(el => el.getBoundingClientRect())
    expect(boxes).toHaveLength(SECTIONS.length)
    for (const box of boxes) {
      expect(box.height).toBeCloseTo(boxes[0].height, 0)
      expect(box.height).toBeGreaterThanOrEqual(44)
      expect(box.height).toBeLessThan(72)
    }
    const titles = [...screen.container.querySelectorAll('.plate__title')].map(el => el.getBoundingClientRect())
    for (const box of titles) expect(box.left).toBeCloseTo(titles[0].left, 0)
    for (const plate of plates(screen.container)) {
      expect(plate.querySelector('.plate__head').getAttribute('aria-haspopup')).toBe('dialog')
      // No foot: the record is under the name. The stripe is painted
      // raw: a platform has no track behind it.
      expect(plate.querySelector('.plate__foot')).toBeNull()
      expect(plate.querySelector('.plate__stripe i').style.width).toBe('100%')
    }
  })

  it('prints the learner\'s grade on every plate, what they did there and the share right', async () => {
    const screen = await gate()
    await vi.waitFor(() => expect(record(plateOf(screen.container, '/practice/reading'))).toBe(`N4 · 24 phrases · 83${NB}% justes`))
    expect(record(plateOf(screen.container, '/practice/conversation'))).toBe(`N4 · 11 réponses · 73${NB}% justes`)
    // Nothing at the learner's grade: said so. Another grade's record
    // is that grade's (translation's N3).
    for (const path of ['/practice/comprehension', '/practice/translation', '/practice/dictation', '/practice/composition', '/practice/exam']) {
      expect(record(plateOf(screen.container, path)), path).toBe(`N4 · ${fr.practiceNotYet}`)
    }
  })

  it('hangs the grade alone, and no ride to resume, while the record cannot be read', async () => {
    feed.record = false
    try {
      const screen = await gate()
      for (const plate of plates(screen.container)) expect(record(plate)).toBe('N4')
      expect(screen.container.querySelector('.prc-resume')).toBeNull()
      expect(apiFetch.mock.calls.some(([path]) => path === '/api/practice/record')).toBe(true)
    } finally {
      feed.record = true
    }
  })

  // ── The last ride ──
  it('boards the last grade\'s ride again in one tap', async () => {
    const screen = await gate()
    const resume = await vi.waitFor(() => {
      const el = screen.container.querySelector('.prc-resume')
      expect(el).toBeTruthy()
      return el
    })
    // Translation's N3 is the newest a grade alone boards: the scene
    // after it is conversation's, which needs a scene picked.
    expect(resume.querySelector('.prc-resume__title').textContent).toBe(`${fr.translationTitle} · N3`)
    expect(resume.querySelector('.prc-resume__go').textContent).toBe(fr.practiceResume)
    // Over the groups: the first thing on the gate.
    expect(resume.compareDocumentPosition(screen.container.querySelector('.prc-group')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    resume.click()
    await vi.waitFor(() => expect(went.path).toBe('/practice/translation/level/N3'))
  })

  // The gate reads the record and nothing else: a sample is a sheet's.
  it('never asks for a sample while no sheet is up', async () => {
    apiFetch.mockClear()
    await gate()
    expect(apiFetch.mock.calls.some(([path]) => path.startsWith('/api/station/') || path === '/api/exams')).toBe(false)
  })
})

describe('the platform\'s sheet (plan 290)', () => {
  it('rises on the plate tapped, every platform a page and the others a swipe away', async () => {
    apiFetch.mockClear()
    await raise('/practice/dictation')
    const pages = [...sheet().querySelectorAll('.prc-page')]
    expect(pages.map(p => p.getAttribute('aria-label'))).toEqual(SECTIONS.map(s => s.title))
    // Only the page in view is in the tab order and the tree.
    expect(pages.filter(p => !p.inert).map(p => p.getAttribute('aria-label'))).toEqual([fr.dictationTitle])
    const stops = [...sheet().querySelectorAll('.prc-sheet__stop')]
    expect(stops.map(s => s.getAttribute('aria-label'))).toEqual(SECTIONS.map(s => s.title))
    expect(stops.filter(s => s.getAttribute('aria-current')).map(s => s.getAttribute('aria-label'))).toEqual([fr.dictationTitle])
    // A gap between the gate's groups, two of them.
    expect(sheet().querySelectorAll('.prc-sheet__sep')).toHaveLength(PRACTICE_GROUPS.length - 1)
    // The page in view sits in the sheet, whole.
    const box = page().getBoundingClientRect()
    const panel = sheet().getBoundingClientRect()
    expect(box.left).toBeCloseTo(panel.left + sheet().clientLeft, 0)
    expect(box.right).toBeLessThanOrEqual(panel.right)
    // The sheet's first focus is the page in view's roundel, the one
    // stop of the strip.
    const focusable = [...sheet().querySelectorAll('.prc-sheet__stop')].filter(s => s.tabIndex === 0)
    expect(focusable.map(s => s.getAttribute('aria-label'))).toEqual([fr.dictationTitle])
    // It asks for the samples of the page in view and its neighbours,
    // not every platform's.
    const asked = apiFetch.mock.calls.map(([path]) => path).filter(path => path.startsWith('/api/station/'))
    expect(asked.map(path => path.split('/')[3]).sort()).toEqual(['comprehension', 'dictation', 'translation'])
  })

  it('opens with the focus on the page in view\'s roundel, and keeps Tab to it and its page', async () => {
    // Not the first platform: the strip's first roundel is a button too,
    // at tabindex -1, and was where the focus landed.
    await raise('/practice/dictation')
    const stop = sheet().querySelector('.prc-sheet__stop[aria-current]')
    expect(stop.getAttribute('aria-label')).toBe(fr.dictationTitle)
    expect(document.activeElement).toBe(stop)
    // The trap's stops are that roundel and the page in view's controls,
    // the inert pages' none of them: Tab past Embarquer comes back to
    // the roundel, and Shift+Tab from it goes back to Embarquer.
    const go = page().querySelector('.prc-page__go')
    go.focus()
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }))
    expect(document.activeElement).toBe(stop)
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true }))
    expect(document.activeElement).toBe(go)
  })

  it('slides to another platform from its roundel, and follows a swipe', async () => {
    await raise('/practice/reading')
    const pager = sheet().querySelector('.prc-sheet__pager')
    const stop = [...sheet().querySelectorAll('.prc-sheet__stop')].find(s => s.getAttribute('aria-label') === fr.compositionTitle)
    stop.click()
    await vi.waitFor(() => expect(page().getAttribute('aria-label')).toBe(fr.compositionTitle))
    pager.scrollLeft = 0
    pager.dispatchEvent(new Event('scroll'))
    await vi.waitFor(() => expect(page().getAttribute('aria-label')).toBe(fr.readingTitle))
    // And from the keys: → walks to the next platform.
    const current = sheet().querySelector('.prc-sheet__stop[aria-current]')
    current.focus()
    current.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }))
    await vi.waitFor(() => expect(page().getAttribute('aria-label')).toBe(fr.readingComprehensionTitle))
    expect(document.activeElement.getAttribute('aria-label')).toBe(fr.readingComprehensionTitle)
  })

  it('pins Embarquer to the foot, at one height on every page', async () => {
    await raise('/practice/reading')
    const pager = sheet().querySelector('.prc-sheet__pager')
    const feet = [...pager.querySelectorAll('.prc-page__go')].map(go => go.getBoundingClientRect().bottom)
    expect(feet.length).toBeGreaterThanOrEqual(5)
    for (const y of feet) expect(y).toBeCloseTo(feet[0], 0)
  })

  it('boards a sentence platform at the learner\'s grade, another grade, their cards; the tiers are a station\'s', async () => {
    await raise('/practice/reading')
    expect(page().querySelector('.prc-page__title').textContent).toBe(fr.readingTitle)
    expect(page().querySelector('.prc-page__meta').textContent).toBe(`N4 · 24 phrases · 83${NB}% justes`)
    // The other grades, then the two other sources.
    expect(tickets().map(tk => tk.querySelector('.prc-tk__name').textContent)).toEqual(['N5', 'N3', 'N2', 'N1', fr.byMastery, fr.practiceSourceFrequency])
    // The run's card, the station's sample at the grade.
    await vi.waitFor(() => expect(page().querySelector('.prc-card').textContent).toBe('雨が降りそうです。'))
    page().querySelector('.prc-page__go').click()
    await vi.waitFor(() => expect(went.path).toBe('/practice/reading/level/N4'))

    await raise('/practice/reading')
    ticket('N3').click()
    await vi.waitFor(() => expect(went.path).toBe('/practice/reading/level/N3'))

    await raise('/practice/reading')
    ticket(fr.byMastery).click()
    await vi.waitFor(() => expect(went.path).toBe('/practice/reading/mastery'))

    await raise('/practice/reading')
    beginDeparture.mockClear()
    ticket(fr.practiceSourceFrequency).click()
    await vi.waitFor(() => expect(beginDeparture).toHaveBeenCalledTimes(1))
    expect(beginDeparture.mock.calls[0][0].path).toBe('/practice/reading/tiers')
    // The sheet goes down before the gate departs.
    expect(sheet()).toBeNull()
  })

  it('boards a one-axis platform by its grade alone', async () => {
    await raise('/practice/dictation')
    expect(tickets().map(tk => tk.querySelector('.prc-tk__name').textContent)).toEqual(['N5', 'N3', 'N2', 'N1'])
    ticket('N5').click()
    await vi.waitFor(() => expect(went.path).toBe('/practice/dictation/N5'))
  })

  it('sits the exam\'s next paper, or any of the grade\'s four, or opens its station', async () => {
    await raise('/practice/exam')
    await vi.waitFor(() => expect(tickets().length).toBe(5))
    expect(tickets().map(tk => tk.querySelector('.prc-tk__name').textContent))
      .toEqual([fr.examKindVocab, fr.examKindGrammar, fr.examKindReading, fr.examKindListening, fr.practiceAllPapers])
    expect(ticket(fr.examKindVocab).querySelector('.prc-tk__value').textContent).toBe('14/20')
    // The first paper not yet sat.
    expect(page().querySelector('.prc-page__go').textContent).toBe(`${fr.depart} · ${fr.examKindGrammar}`)
    page().querySelector('.prc-page__go').click()
    await vi.waitFor(() => expect(went.path).toBe('/practice/exam/n4-grammar-01'))
    expect(went.state).toEqual({ last: null })

    // Another grade's papers, in place.
    await raise('/practice/exam')
    await vi.waitFor(() => expect(tickets().length).toBe(5))
    ;[...page().querySelectorAll('.seg__opt')].find(o => o.textContent === 'N5').click()
    await vi.waitFor(() => expect(page().querySelector('.prc-page__go').textContent).toBe(`${fr.depart} · ${fr.examKindVocab}`))
    ticket(fr.practiceAllPapers).click()
    await vi.waitFor(() => expect(beginDeparture).toHaveBeenCalled())
    expect(beginDeparture.mock.calls.at(-1)[0].path).toBe('/practice/exam?level=N5')
  })

  it('boards 会話\'s next scene, in the way of answering chosen', async () => {
    await raise('/practice/conversation')
    await vi.waitFor(() => expect(tickets().length).toBe(3))
    expect(tickets().map(tk => tk.querySelector('.prc-tk__name').textContent)).toEqual(['À la poste', 'Chez le médecin', fr.practiceAllScenes])
    expect(ticket('À la poste').querySelector('.prc-tk__value').textContent).toBe('5/6')
    // The first scene not done; Libre chosen first.
    ;[...page().querySelectorAll('.seg__opt')].find(o => o.textContent === fr.cvsModes.free).click()
    await vi.waitFor(() => expect(page().querySelector('.prc-page__go').textContent).toBe(`${fr.depart} · Chez le médecin`))
    page().querySelector('.prc-page__go').click()
    await vi.waitFor(() => expect(went.path).toBe('/practice/conversation/doctor/free'))
  })
})

// ── 案内 — the anchors the guide points at (plan 100) ────────────
describe('the practice gate\'s guide anchors', () => {
  it('marks the first platform and its record, and the exam, once each', async () => {
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
