import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, cleanup } from 'vitest-browser-react'
import { userEvent } from 'vitest/browser'
import { MemoryRouter } from 'react-router-dom'
import { LangProvider } from './LangContext'
import { PRINT } from './components/station/print/usePrint'
import './index.css'

// ── 机 — the day at a glance, on a wide desk (plan 199) ────────────
// The owner's pick A2 of the canvas "Tsuji — Today at a glance", drawn
// for the desk: the dial on a panel the window's height, its legend in
// words and the gate at its foot; beside it, at the entry's width, what
// the services sheet holds on a phone, open (the two choices, the lines
// with their modes), and the day (its figures and the week ahead). It
// replaces plan 135's bands. The desk's tightest width is
// today.desktop.test.jsx's, and a phone keeps its own gate
// (deskfree.phone.test.jsx).

vi.mock('./lib/api', () => ({
  api: p => p,
  apiFetch: vi.fn(async () => ({ ok: true, status: 200, json: async () => ({}) })),
  apiJson: vi.fn(async () => ({})),
  apiJsonWithTimeout: vi.fn(), apiUpload: vi.fn(),
  ApiError: class extends Error {},
}))
vi.mock('./lib/audio', async o => ({ ...(await o()), playUi: vi.fn(), playClick: vi.fn(), playAnnouncement: vi.fn() }))
const departure = vi.hoisted(() => ({ begin: vi.fn(), current: null }))
vi.mock('./stores/departure', () => ({
  beginDeparture: (...a) => departure.begin(...a),
  endDeparture: vi.fn(),
  useDeparture: () => departure.current,
}))
const lane = (source, deck, mode, due) => ({ id: `${source}:${deck}:${mode}`, kind: 'section', source, deck, mode, due, new: 0 })
// Eight lanes over four lines, two of them odd: the day a learner a few
// weeks in actually has.
const EIGHT = [
  lane('kana', 'hiragana_basic', 'kana.flashcard.f2b', 18),
  lane('kana', 'katakana_basic', 'kana.flashcard.f2b', 9),
  lane('vocab', 'N5', 'vocab.flashcard.f2b', 30),
  lane('vocab', 'N5', 'vocab.word_reading', 12),
  lane('vocab', 'N4', 'vocab.flashcard.b2f', 7),
  lane('kanji', 'N5', 'kanji.flashcard.f2b', 14),
  lane('kanji', 'N5', 'kanji.readings', 6),
  lane('grammar', 'N5', 'grammar.flashcard.f2b', 5),
]
const todayOf = lanes => ({
  total: lanes.reduce((n, l) => n + l.due, 0), by_source: {}, next_due: null,
  pace: { target: 10, newToday: 4, remaining: 6 }, lanes,
})
const todayRef = vi.hoisted(() => ({ current: null }))
vi.mock('./stores/today', () => ({
  useTodaySummary: () => ({ data: todayRef.current, failed: false }),
  refreshToday: vi.fn(), seedTodaySummary: vi.fn(),
}))
const forecastRef = vi.hoisted(() => ({ current: null }))
vi.mock('./stores/forecast', () => ({
  useForecast: () => ({ data: forecastRef.current, failed: false }),
  forgetForecast: vi.fn(),
}))
vi.mock('./stores/journey', () => ({
  useJourneyStatus: () => ({ data: null, failed: false }),
  useVolumes: () => ({ data: null }),
  refreshJourney: vi.fn(), seedJourneyStatus: vi.fn(), openStatus: vi.fn(),
}))
vi.mock('./stores/profileSummary', async o => ({ ...(await o()),
  useProfileSummary: () => ({ level: 12, jlptLevel: 'N5', streak: 3, week: [], guided: { today: true } }),
}))
const creditsRef = vi.hoisted(() => ({ current: null }))
vi.mock('./stores/credits', async o => ({ ...(await o()),
  useCredits: () => creditsRef.current,
}))
globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) })

const { default: TodayScreen } = await import('./screens/TodayScreen')

const settle = (ms = 300) => new Promise(r => setTimeout(r, ms))
const press = key => window.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }))
const $ = s => document.querySelector(s)
const $$ = s => [...document.querySelectorAll(s)]

beforeEach(() => {
  departure.begin.mockReset()
  departure.current = null
  todayRef.current = todayOf(EIGHT)
  creditsRef.current = { balance: 30, cap: 50, unlimited: false, nextCreditAt: '2026-09-07T14:48:00+00:00' }
  forecastRef.current = null
  localStorage.clear()
  // The lines, the fare and the week are drawn with every lane riding:
  // the learner who chose every mode. The main flashcards are the
  // gate's default since plan 199 (the 主 block below).
  localStorage.setItem('tsuji.gateMain', '0')
})

async function mount(entry = '/today') {
  const screen = await render(
    <LangProvider>
      <MemoryRouter initialEntries={[entry]}>
        <div className="phone phone--desk">
          <div className="phone__content"><TodayScreen session={{}} /></div>
        </div>
      </MemoryRouter>
    </LangProvider>
  )
  await settle()
  return screen
}

const text = el => el.textContent.replace(/\s+/g, ' ').trim()
// The words as read: each text node apart, so two elements side by side
// read as two words.
const words = el => {
  const walk = document.createTreeWalker(el, NodeFilter.SHOW_TEXT)
  const out = []
  while (walk.nextNode()) out.push(walk.currentNode.textContent.trim())
  return out.filter(Boolean).join(' ').replace(/\s+/g, ' ')
}
const count = () => text($('.tdy-dial__count'))
const lengths = () => $$('.tdy-desk .tdy-seg--two .seg__opt')
const lines = () => $$('.tdy-desk .tdy-line')
const head = name => lines().find(l => text(l.querySelector('.tdy-line__name')).startsWith(name)).querySelector('.tdy-line__head')
// A line's modes are behind its chevron on the desk too (plan 199b).
async function openModes() {
  for (const more of $$('.tdy-desk .tdy-line__more')) await userEvent.click(more)
  await settle(60)
}

describe('the gate on a wide desk', () => {
  it('stands the dial on a panel the window\'s height, the gate at its foot, the services beside it', async () => {
    await mount()
    const desk = $('.tdy-desk').getBoundingClientRect()
    expect(desk.height).toBeGreaterThan(window.innerHeight * 0.85)
    expect(desk.bottom).toBeLessThanOrEqual(window.innerHeight)
    const hero = $('.tdy-desk__hero').getBoundingClientRect()
    // The dial by its rings: on the print (plan 205) its box is the
    // disc's glow.
    const dial = $('.tdy-desk .tdy-dial__gate').getBoundingClientRect()
    const go = $('.tdy-desk__go .btn-depart').getBoundingClientRect()
    // The dial at the size the print draws it, over the gate, both on
    // the panel's axis.
    expect(Math.abs(dial.width - 2 * (PRINT.frames.desk.fare + 4))).toBeLessThan(3)
    expect(go.top).toBeGreaterThan(dial.bottom)
    expect(go.bottom).toBeLessThanOrEqual(hero.bottom)
    const axis = hero.left + hero.width / 2
    expect(Math.abs(dial.left + dial.width / 2 - axis)).toBeLessThan(2)
    expect(Math.abs(go.left + go.width / 2 - axis)).toBeLessThan(2)
    // The column beside it, its own height.
    const col = $('.tdy-desk__col').getBoundingClientRect()
    expect(col.left).toBeGreaterThan(hero.right)
    expect(col.bottom).toBeLessThanOrEqual(window.innerHeight)
    expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth)
  })

  it('names each line under the dial, and lists them in the column with their modes behind a chevron', async () => {
    await mount()
    // The legend has the room for the lines' names.
    const keys = $$('.tdy-desk__keys .tdy-key--lines .tdy-key__item')
    expect(keys.map(k => words(k))).toEqual(['Kana 27', 'Vocabulaire JLPT 49', 'Kanji 20', 'Grammaire 5'])
    // Two across, in the ring's order: no line left alone on a row.
    const tops = keys.map(k => Math.round(k.getBoundingClientRect().top))
    expect(tops[0]).toBe(tops[1])
    expect(tops[2]).toBe(tops[3])
    expect(tops[2]).toBeGreaterThan(tops[0])
    // The free line's tag rides on its name.
    expect(lines().map(l => l.querySelector('.tdy-line__name').firstChild.textContent)).toEqual(['Kana', 'Vocabulaire JLPT', 'Kanji', 'Grammaire'])
    expect(text(lines()[0].querySelector('.tdy-line__tag'))).toBe('gratuit')
    // Nothing opened by default (plan 199b, the owner's word): each line
    // says what rides of it, and a line of several modes keeps them
    // behind its chevron.
    expect($$('.tdy-desk .lane')).toHaveLength(0)
    expect(lines().map(l => Boolean(l.querySelector('.tdy-line__more')))).toEqual([true, true, true, false])
    // A line a row on the desk's board (A3·1): what rides of it is
    // behind its chevron, or, for a line of one mode, a tap on the phone.
    expect($$('.tdy-desk .tdy-line__sub')).toHaveLength(0)
    for (const l of lines()) expect(Math.round(l.querySelector('.tdy-line__head').getBoundingClientRect().height)).toBe(44)
    await userEvent.click(lines()[2].querySelector('.tdy-line__more'))
    await settle(60)
    expect(lines().map(l => l.querySelectorAll('.tdy-line__lanes .lane').length)).toEqual([0, 0, 2, 0])
    await userEvent.click(lines()[1].querySelector('.tdy-line__more'))
    await settle(60)
    // A line's head takes its whole line out.
    await userEvent.click(head('Vocabulaire'))
    await settle(60)
    expect([...lines()[1].querySelectorAll('.lane')].every(l => l.getAttribute('aria-pressed') === 'false')).toBe(true)
    expect(count()).toBe(String(101 - 49))
    expect($$('.tdy-desk .tdy-dial__ring g')).toHaveLength(3)
  })

  // 一枚 (plan 199b, the owner's pick A3·1): the column is one board --
  // the choices, a line a row, a rule, the day in one strip, the week.
  it('draws the column as one board, the day a strip of figures across it', async () => {
    forecastRef.current = { days: [0, 1, 2, 3, 4, 5, 6].map(i => ({ date: `2026-10-${12 + i}`, count: 20 })) }
    await mount()
    const col = $('.tdy-desk__col')
    expect(col.children).toHaveLength(1)
    const board = col.firstElementChild
    expect(board.classList.contains('tdy-desk__svc')).toBe(true)
    const day = board.querySelector(':scope > .tdy-desk__day')
    expect(getComputedStyle(day).borderTopWidth).toBe('1px')
    // The rule runs the board's width.
    expect(Math.round(day.getBoundingClientRect().width)).toBe(Math.round(board.getBoundingClientRect().width) - 2)
    const cells = [...day.querySelectorAll('.tdy-day--strip .tdy-day__cell')]
    expect(cells.map(c => text(c.querySelector('.tdy-day__what')))).toEqual(['de suite', 'nouveautés'])
    expect(new Set(cells.map(c => Math.round(c.getBoundingClientRect().top))).size).toBe(1)
    expect(day.querySelector('.desk-week')).not.toBeNull()
    expect(col.scrollHeight).toBeLessThanOrEqual(col.clientHeight)
  })

  it('cuts the run to a length, each line printing its share as the queue deals', async () => {
    await mount()
    expect(lengths().map(words)).toEqual(['20', '50', '100', 'Tout'])
    expect(text($('.tdy-desk .tdy-seg--two [aria-checked="true"]'))).toBe('Tout')
    await userEvent.click(lengths()[0])
    await settle(60)
    expect(count()).toBe('20')
    expect(text($('.tdy-dial__unit'))).toBe('sur 101')
    // 20 over eight lanes: two rounds, then the first four once more.
    expect(lines().map(l => text(l.querySelector('.tdy-line__n')))).toEqual(['6 / 27', '8 / 49', '4 / 20', '2 / 5'])
    // What the run leaves of each line dims under what it takes.
    expect($$('.tdy-dial__arc--dim')).toHaveLength(4)
    // The gate carries the shares.
    press('Enter')
    await settle(60)
    const path = departure.begin.mock.calls[0][0].path
    expect(path.startsWith('/today/run?quota=')).toBe(true)
    const quota = decodeURIComponent(path.split('quota=')[1]).split(',')
    expect(quota).toHaveLength(8)
    expect(quota).toContain(`${EIGHT[2].id}:3`)
    // Remembered for the next visit.
    expect(localStorage.getItem('tsuji.gateTake')).toBe('20')
  })

  it('opens on the length chosen last time, and on the whole day when it is longer', async () => {
    localStorage.setItem('tsuji.gateTake', '20')
    await mount()
    expect(text($('.tdy-desk .tdy-seg--two [aria-checked="true"]'))).toBe('20')
    expect(count()).toBe('20')
    await cleanup()
    localStorage.setItem('tsuji.gateTake', '50')
    todayRef.current = todayOf(EIGHT.slice(0, 3))
    await mount()
    // Lengths shorter than the day, and the day.
    expect(lengths().map(words)).toEqual(['20', '50', 'Tout'])
    await cleanup()
    // Fifty over a day of 27: the whole day.
    todayRef.current = todayOf(EIGHT.slice(0, 2))
    await mount()
    expect(count()).toBe('27')
    expect(lengths()).toHaveLength(2)
    expect(text($('.tdy-desk .tdy-seg--two [aria-checked="true"]'))).toBe('Tout')
  })

  it('prints no time before the pace is known', async () => {
    await mount()
    expect($('.tdy-dial__time')).toBeNull()
    expect($('.tdy-dial__end')).toBeNull()
  })

  it('prints what the run will take, and what each shorter one will', async () => {
    todayRef.current = { ...todayOf(EIGHT), seconds_per_review: 12 }
    await mount()
    expect($('.tdy-dial__time').getAttribute('aria-label')).toBe('environ 20 minutes')
    expect(text($('.tdy-dial__end'))).toMatch(/^fini vers \d\d:\d\d$/)
    expect(lengths().map(words)).toEqual(['20 4 min', '50 10 min', '100 20 min', 'Tout 20 min'])
    await userEvent.click(lengths()[1])
    await settle(60)
    expect(text($('.tdy-dial__time'))).toBe('≈ 10 min')
  })
})

describe('the fare, inside the dial', () => {
  const C = 2 * Math.PI * PRINT.frames.desk.fare

  it('rings what boards inside the lines, and says what boards, what waits and until when', async () => {
    await mount()
    // 27 kana ride free; 30 of the 74 paid ride on the balance.
    const [rides, waits] = $$('.tdy-key--fare .tdy-key__item')
    expect(words(rides)).toBe('57 embarquent')
    // Waiting for the refill's next credit, a credit at a time (plan 141).
    expect(words(waits)).toMatch(/^44 attendent · \+1 à /)
    const ride = $('.tdy-dial__fare-ride')
    expect(Number(ride.getAttribute('stroke-dasharray').split(' ')[0])).toBeCloseTo((57 / 101) * C, 1)
    expect($('.tdy-dial__fare-end')).toBeTruthy()
    // The free line says so, on its head and on each of its modes.
    expect(text(lines()[0].querySelector('.tdy-line__tag'))).toBe('gratuit')
    await openModes()
    expect($$('.tdy-desk .lane__free')).toHaveLength(2)
  })

  it('rings nothing as boarding when nothing paid can ride', async () => {
    creditsRef.current = { balance: 0, cap: 50, unlimited: false }
    todayRef.current = todayOf(EIGHT.slice(2))
    await mount()
    expect($$('.tdy-key--fare b').map(text)).toEqual(['0', '74'])
    expect($('.tdy-dial__fare-ride')).toBeNull()
    expect($('.tdy-dial__fare-wait')).toBeTruthy()
  })

  it('draws no fare on a pass', async () => {
    creditsRef.current = { balance: null, unlimited: true }
    await mount()
    expect($('.tdy-key--fare')).toBeNull()
    expect($('.tdy-dial__fare')).toBeNull()
    expect($$('.lane__free, .tdy-line__tag')).toHaveLength(0)
  })
})

describe('Enter, on the desk', () => {
  it('departs with the whole day when every lane is on', async () => {
    await mount()
    press('Enter')
    await settle(60)
    expect(departure.begin).toHaveBeenCalledTimes(1)
    expect(departure.begin.mock.calls[0][0].path).toBe('/today/run')
    // Into a run: the gate spans the window, rail and all (cutscenes.desktop).
    expect(departure.begin.mock.calls[0][0].stage).toBe(true)
  })

  it('departs with the choice made on a mode', async () => {
    await mount()
    await openModes()
    const tile = $$('.tdy-desk .lane')[3]
    // A real click, which leaves the focus on the lane, as Chrome does.
    // The page's Enter departs from there: a lane pressed by the pointer
    // does not own the key (plan 123).
    await userEvent.click(tile)
    await settle(60)
    expect(tile.getAttribute('aria-pressed')).toBe('false')
    expect(document.activeElement).toBe(tile)
    await userEvent.keyboard('{Enter}')
    await settle(60)
    expect(tile.getAttribute('aria-pressed')).toBe('false')
    expect(departure.begin).toHaveBeenCalledTimes(1)
    const path = departure.begin.mock.calls[0][0].path
    const chosen = decodeURIComponent(path.split('lanes=')[1] ?? '').split(',')
    expect(path.startsWith('/today/run?lanes=')).toBe(true)
    expect(chosen).toHaveLength(7)
    expect(chosen).not.toContain(EIGHT[3].id)
  })
})

describe('the week ahead, in the column', () => {
  const WEEK = ['2026-09-25', '2026-09-26', '2026-09-27', '2026-09-28', '2026-09-29', '2026-09-30', '2026-10-01']
    .map((date, i) => ({ date, count: [140, 41, 36, 58, 29, 47, 33][i] }))

  it('draws seven days under the day\'s figures, today the gate\'s own total', async () => {
    forecastRef.current = { days: WEEK }
    await mount()
    const days = $$('.tdy-desk__day .desk-week__day')
    expect(days).toHaveLength(7)
    // Today is what the gate counts, not the forecast's row count.
    expect(text(days[0].querySelector('.desk-week__n'))).toBe('101')
    expect(days[0].classList.contains('desk-week__day--today')).toBe(true)
    expect(days.map(d => text(d.querySelector('.desk-week__d')))).toEqual(['金', '土', '日', '月', '火', '水', '木'])
    // The tallest bar is today's; the rest in proportion.
    const h = days.map(d => d.querySelector('.desk-week__bar').getBoundingClientRect().height)
    expect(h[0]).toBe(Math.max(...h))
    expect(h[3]).toBeGreaterThan(h[4])
    // Under the day's figures, in the day's panel.
    const figures = $('.tdy-desk__day .tdy-day').getBoundingClientRect()
    expect($('.desk-week').getBoundingClientRect().top).toBeGreaterThanOrEqual(figures.bottom)
    // Nothing is left for tomorrow while the whole day rides.
    expect($('.desk-week__left')).toBeNull()
  })

  // Plan 199: the cleared dial says "31 cartes aujourd'hui" beside it,
  // and a bar of 0 under that read as a day off.
  it('stands what the day reviewed as today\'s bar on a day with nothing left', async () => {
    forecastRef.current = { days: WEEK }
    todayRef.current = {
      total: 0, lanes: [], by_source: {}, next_due: null, pace: { target: 10, newToday: 10 },
      reviewed: { total: 31, by_line: { vocab: 20, kanji: 11 } }, tomorrow: { cards: 41, minutes: 9 },
    }
    await mount()
    const days = $$('.tdy-desk__day .desk-week__day')
    expect(text(days[0].querySelector('.desk-week__n'))).toBe('31')
    expect(text($('.tdy-recap'))).toBe('31 cartes aujourd’hui')
    expect(days[0].querySelector('.desk-week__bar').getBoundingClientRect().height)
      .toBeGreaterThan(days[4].querySelector('.desk-week__bar').getBoundingClientRect().height)
  })

  it('says what a shorter run leaves for tomorrow', async () => {
    forecastRef.current = { days: WEEK }
    await mount()
    await userEvent.click(lengths()[0])
    await settle(60)
    expect([...$('.desk-week__left').children].map(text)).toEqual(['Laissées pour demain', '81'])
  })

  it('stands nothing before the forecast answers', async () => {
    await mount()
    expect($('.desk-week')).toBeNull()
  })
})

// ── 主 — the main flashcards alone, and Depart as the gate ──────────
// The owner's ask: a way to board each line's main flashcard (the
// recognition card, `<source>.flashcard.f2b`) and nothing else, and
// Depart drawn as the boarding's gate button (改札, plan 164).
describe('the main flashcards alone', () => {
  const modes = () => $$('.tdy-desk .tdy-seg:not(.tdy-seg--two) .seg__opt')
  // The default (plan 199): nothing kept is the main cards.
  beforeEach(() => { localStorage.removeItem('tsuji.gateMain') })

  it('opens on each line\'s recognition card alone, and remembers every mode', async () => {
    await mount()
    // What each way would ride: 76 the main cards, 101 every mode.
    expect(modes().map(words)).toEqual(['Principales 76', 'Tous les modes 101'])
    expect(count()).toBe('76')
    expect(modes()[0].getAttribute('aria-checked')).toBe('true')
    // The other modes stay on the platform, switched off.
    await openModes()
    expect($$('.tdy-desk .lane--off')).toHaveLength(3)
    expect($$('.tdy-desk .lane:not(.lane--off)')).toHaveLength(4)
    press('Enter')
    await settle(60)
    const path = decodeURIComponent(departure.begin.mock.calls[0][0].path)
    expect(path.startsWith('/today/run?lanes=')).toBe(true)
    const ids = path.split('=')[1].split(',')
    expect(ids).toHaveLength(5)
    expect(ids.every(id => id.endsWith('.flashcard.f2b'))).toBe(true)
    // Every mode, chosen, is what the next visit opens on.
    await userEvent.click(modes()[1])
    await settle(60)
    expect(count()).toBe('101')
    expect(localStorage.getItem('tsuji.gateMain')).toBe('0')
  })

  it('opens on every mode when it was chosen last time', async () => {
    localStorage.setItem('tsuji.gateMain', '0')
    await mount()
    expect(count()).toBe('101')
    expect(modes()[1].getAttribute('aria-checked')).toBe('true')
  })

  it('opens on the main cards where an earlier build kept them', async () => {
    localStorage.setItem('tsuji.gateMain', '1')
    await mount()
    expect(count()).toBe('76')
    expect(modes()[0].getAttribute('aria-checked')).toBe('true')
  })

  it('leaves the filter when another mode is switched on, keeping what the gate shows', async () => {
    await mount()
    await openModes()
    await userEvent.click($$('.tdy-desk .lane--off')[0])
    await settle(60)
    expect(modes()[1].getAttribute('aria-checked')).toBe('true')
    // One lane back on; the other two stay off.
    expect($$('.tdy-desk .lane--off')).toHaveLength(2)
    expect(Number(count())).toBeGreaterThan(76)
    expect(Number(count())).toBeLessThan(101)
    expect(localStorage.getItem('tsuji.gateMain')).toBe('0')
  })

  it('gives back the learner\'s own switches with every mode', async () => {
    await mount()
    // Every mode, kana off, then the main cards, then every mode again:
    // kana stays off.
    await userEvent.click(modes()[1])
    await settle(60)
    expect(count()).toBe('101')
    await userEvent.click(head('Kana'))
    await settle(60)
    expect(count()).toBe('74')
    await userEvent.click(modes()[0])
    await settle(60)
    expect(count()).toBe('49')
    await userEvent.click(modes()[1])
    await settle(60)
    expect(count()).toBe('74')
  })

  it('departs through the boarding\'s gate button', async () => {
    // Every lane riding, so every line's head takes its line out.
    localStorage.setItem('tsuji.gateMain', '0')
    await mount()
    const go = $('.tdy-desk__go .btn-depart')
    expect(go.classList.contains('btn-depart--gate')).toBe(true)
    expect(go.querySelector('.btn-depart__reader .pass__wave')).not.toBeNull()
    expect(text(go.querySelector('.btn-depart__jp'))).toBe('Embarquer')
    expect(go.querySelector('.desk-kbd')).not.toBeNull()
    expect(go.getAttribute('aria-keyshortcuts')).toBe('Enter')
    expect(Math.round(go.getBoundingClientRect().height)).toBe(66)
    // Nothing chosen: the gate's outline; a line back on wakes it.
    for (const line of lines()) await userEvent.click(line.querySelector('.tdy-line__head'))
    await settle(400)
    expect(go.disabled).toBe(true)
    expect(getComputedStyle(go, '::before').opacity).toBe('0')
    // The wake is caught as its pop starts: the class only lasts the
    // pop's 540ms, and on a loaded runner the click's round trip
    // outlasted it, so the class was already gone when it was read.
    let woke = false
    go.addEventListener('animationstart', e => { if (e.animationName === 'btn-gate-wake') woke = true })
    await userEvent.click(lines()[0].querySelector('.tdy-line__head'))
    await settle(20)
    expect(go.disabled).toBe(false)
    await vi.waitFor(() => expect(woke).toBe(true))
  })
})
