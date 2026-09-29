import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from 'vitest-browser-react'
import { userEvent } from 'vitest/browser'
import { MemoryRouter } from 'react-router-dom'
import { LangProvider } from './LangContext'
import './index.css'

// ── 机 — the fare gate takes the hall, on a laptop (plan 135) ──────
// The owner's pick (A·2 of the Today canvas), replacing plan 116's two
// lanes across: the gate is the window's height; each line a band, its
// switch beside its lanes; the run's length (20 / 50 / 100 / all) and
// its minutes in the head, each lane's share on it and whether it
// boards; the fare beside Depart. The desk's tightest width is
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
const figure = el => text(el.querySelector('.lane__due'))

describe('the gate on a laptop', () => {
  it('takes the window\'s height, its bands between the head and the fare', async () => {
    await mount()
    const gate = $('.gate-card--desk').getBoundingClientRect()
    expect(gate.height).toBeGreaterThan(window.innerHeight * 0.85)
    expect(gate.bottom).toBeLessThanOrEqual(window.innerHeight)
    const go = $('.gate-card__fare .btn-depart').getBoundingClientRect()
    expect(go.bottom).toBeLessThanOrEqual(gate.bottom)
    // An eight-lane day whole, with nothing under the cut.
    const bands = $('.gate-card__bands')
    expect(bands.scrollHeight).toBeLessThanOrEqual(bands.clientHeight)
  })

  it('draws a line as a band, its switch beside its lanes, and no chips', async () => {
    await mount()
    expect($('.gate-card__lines')).toBeNull()
    const bands = $$('.gate-band')
    expect(bands.map(b => text(b.querySelector('.gate-band__name')))).toEqual(['Kana', 'Vocabulaire JLPT', 'Kanji', 'Grammaire'])
    for (const band of bands) {
      const line = band.querySelector('.gate-band__line').getBoundingClientRect()
      for (const tile of band.querySelectorAll('.lane')) {
        expect(tile.getBoundingClientRect().left).toBeGreaterThan(line.right)
      }
    }
    // Every switch as wide as the next, whatever its line's name.
    const widths = bands.map(b => Math.round(b.querySelector('.gate-band__line').getBoundingClientRect().width))
    expect(new Set(widths).size).toBe(1)
    // A·2's measures: the switch column at 230px, the lanes three across.
    expect(widths[0]).toBe(230)
    const kanji = [...bands[2].querySelectorAll('.lane')].map(el => Math.round(el.getBoundingClientRect().top))
    expect(kanji.filter(top => top === kanji[0])).toHaveLength(2)
    const vocabTops = [...bands[1].querySelectorAll('.lane')].map(el => Math.round(el.getBoundingClientRect().top))
    expect(new Set(vocabTops).size).toBe(1)
    // A line's lanes in the list's order, left to right then down.
    const vocab = [...bands[1].querySelectorAll('.lane')].map(el => el.getBoundingClientRect())
    expect(vocab[1].top > vocab[0].top || vocab[1].left > vocab[0].right).toBe(true)
    // The band's switch turns its whole line off.
    await userEvent.click(bands[1].querySelector('.gate-band__line'))
    await settle(60)
    expect([...bands[1].querySelectorAll('.lane')].every(l => l.getAttribute('aria-pressed') === 'false')).toBe(true)
    expect(text($('.gate-card__count'))).toBe(String(101 - 49))
  })

  it('cuts the run to a length, each lane printing its share as the queue deals', async () => {
    await mount()
    const options = $$('.gate-card__take .seg__opt').map(text)
    expect(options).toEqual(['20', '50', '100', 'Tout · 101'])
    expect($('.gate-card__take [aria-checked="true"]').textContent).toContain('Tout')
    await userEvent.click($$('.gate-card__take .seg__opt')[0])
    await settle(60)
    expect(text($('.gate-card__count'))).toBe('20')
    expect(text($('.gate-card--desk .gate-card__figure .gate-card__unit'))).toBe('sur 101')
    // 20 over eight lanes: two rounds, then the first four once more.
    expect($$('.lane').map(figure)).toEqual(['3 / 18', '3 / 9', '3 / 30', '3 / 12', '2 / 7', '2 / 14', '2 / 6', '2 / 5'])
    expect(text($$('.gate-band__due')[2])).toBe('4 / 20')
    // Depart carries the shares.
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

  it('opens on the length chosen last time, and fades a lane the length leaves out', async () => {
    localStorage.setItem('tsuji.gateTake', '20')
    const many = Array.from({ length: 12 }, (_, i) => lane('vocab', `N${(i % 5) + 1}`, `vocab.mode${i}`, 2))
    todayRef.current = todayOf(many)
    await mount()
    expect($('.gate-card__take [aria-checked="true"]').textContent).toBe('20')
    expect(text($('.gate-card__count'))).toBe('20')
    // 20 over twelve lanes of two: the last four get one each, none out.
    expect($$('.lane--out')).toHaveLength(0)
    todayRef.current = todayOf(Array.from({ length: 24 }, (_, i) => lane('vocab', 'N5', `vocab.mode${i}`, 1)))
    await mount()
    // Twenty-four lanes of one: the last four are on, and ride nothing.
    const out = $$('.lane--out')
    expect(out).toHaveLength(4)
    expect(out.every(l => l.getAttribute('aria-pressed') === 'true')).toBe(true)
  })

  it('prints no time before the pace is known', async () => {
    await mount()
    expect($('.gate-card__time')).toBeNull()
  })

  it('prints what the run will take, and what a shorter one will', async () => {
    todayRef.current = { ...todayOf(EIGHT), seconds_per_review: 12 }
    await mount()
    expect($('.gate-card__time').getAttribute('aria-label')).toBe('environ 20 minutes')
    await userEvent.click($$('.gate-card__take .seg__opt')[1])
    await settle(60)
    expect(text($('.gate-card__minutes'))).toBe('≈ 10')
  })
})

describe('the fare beside Depart', () => {
  it('counts what boards, what waits and until when, and the balance', async () => {
    await mount()
    const parts = $$('.gate-card__part').map(p => [...p.children].map(text).join(' '))
    // 27 kana ride free; 30 of the 74 paid ride on the balance.
    expect(parts[0]).toBe('57 embarquent')
    // Waiting for the refill's next credit, a credit at a time (plan 141).
    expect(parts[1]).toMatch(/^44 attendent · \+1 à /)
    expect(parts[2]).toBe('30 / 50 crédits')
    expect($$('.lane--waits')).toHaveLength(0)
  })

  it('marks every paid lane as waiting when nothing paid can ride', async () => {
    creditsRef.current = { balance: 0, cap: 50, unlimited: false }
    await mount()
    const waiting = $$('.lane--waits')
    expect(waiting).toHaveLength(6)
    expect(waiting.every(l => l.querySelector('.lane__waits'))).toBe(true)
    const kana = [...$$('.gate-band')[0].querySelectorAll('.lane')]
    for (const l of kana) {
      expect(l.classList.contains('lane--waits')).toBe(false)
      expect(text(l.querySelector('.lane__free'))).toBe('gratuit')
    }
    expect(text($$('.gate-card__part-n')[0])).toBe('27')
  })

  it('prints no fare on a pass, and Depart takes the row', async () => {
    creditsRef.current = { balance: null, unlimited: true }
    await mount()
    expect($('.gate-card__fare-parts')).toBeNull()
    expect($$('.lane__free')).toHaveLength(0)
    const foot = $('.gate-card__fare').getBoundingClientRect()
    const go = $('.gate-card__fare .btn-depart').getBoundingClientRect()
    expect(go.width).toBeGreaterThan(foot.width * 0.9)
  })
})

describe('Enter, on the bands', () => {
  it('departs with the whole day when every lane is on', async () => {
    await mount()
    press('Enter')
    await settle(60)
    expect(departure.begin).toHaveBeenCalledTimes(1)
    expect(departure.begin.mock.calls[0][0].path).toBe('/today/run')
  })

  it('departs with the choice made on a tile', async () => {
    await mount()
    const tile = $$('.lane')[3]
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

describe('the week ahead, under the journey', () => {
  const WEEK = ['2026-09-25', '2026-09-26', '2026-09-27', '2026-09-28', '2026-09-29', '2026-09-30', '2026-10-01']
    .map((date, i) => ({ date, count: [140, 41, 36, 58, 29, 47, 33][i] }))

  it('draws seven days at the side\'s foot, today the gate\'s own total', async () => {
    forecastRef.current = { days: WEEK }
    await mount()
    const days = $$('.desk-side .desk-week__day')
    expect(days).toHaveLength(7)
    // Today is what the gate counts, not the forecast's row count.
    expect(text(days[0].querySelector('.desk-week__n'))).toBe('101')
    expect(days[0].classList.contains('desk-week__day--today')).toBe(true)
    expect(days.map(d => text(d.querySelector('.desk-week__d')))).toEqual(['金', '土', '日', '月', '火', '水', '木'])
    // The tallest bar is today's; the rest in proportion.
    const h = days.map(d => d.querySelector('.desk-week__bar').getBoundingClientRect().height)
    expect(h[0]).toBe(Math.max(...h))
    expect(h[3]).toBeGreaterThan(h[4])
    // At the column's foot, the column the window's height.
    const side = $('.desk-side').getBoundingClientRect()
    expect($('.desk-week').getBoundingClientRect().bottom).toBeGreaterThan(side.bottom - 24)
    // Nothing is left for tomorrow while the whole day rides.
    expect($('.desk-week__left')).toBeNull()
  })

  it('says what a shorter run leaves for tomorrow', async () => {
    forecastRef.current = { days: WEEK }
    await mount()
    await userEvent.click($$('.gate-card__take .seg__opt')[0])
    await settle(60)
    expect([...$('.desk-week__left').children].map(text)).toEqual(['Laissées pour demain', '81'])
  })

  it('stands nothing before the forecast answers', async () => {
    await mount()
    expect($('.desk-week')).toBeNull()
  })
})

// ── plan 123 — a finished run's slip at the card's width ──
describe('Today\'s finish at 1440', () => {
  it('stands the slip at the card\'s width, centred in the gate\'s column', async () => {
    await mount({ pathname: '/today', state: { run: { cleared: 12, xp: 40 } } })
    const clear = $('main.today > .today-clear').getBoundingClientRect()
    expect(Math.round(clear.width)).toBe(640)
    const side = $('main.today > .desk-side').getBoundingClientRect()
    const main = $('main.today').getBoundingClientRect()
    // Centred in what the side leaves.
    const column = side.left - main.left
    expect(Math.abs((clear.left - main.left) - (column - clear.width - 24) / 2)).toBeLessThan(40)
    expect($('main.today > .desk-side .pass--strip')).not.toBeNull()
  })
})


// ── 主 — the main flashcards alone, and Depart as the gate ──────────
// The owner's ask: a way to board each line's main flashcard (the
// recognition card, `<source>.flashcard.f2b`) and nothing else, and
// Depart drawn as the boarding's gate button (改札, plan 164).
describe('the main flashcards alone', () => {
  const count = () => text($('.gate-card__count'))
  const modes = () => $$('.gate-card__modes .seg__opt')

  it('boards each line\'s recognition card alone, and remembers it', async () => {
    await mount()
    // What each way would ride: 101 every mode, 76 the main cards.
    expect(modes().map(text)).toEqual(['Tous les modes · 101', 'Principales · 76'])
    expect(count()).toBe('101')
    await userEvent.click(modes()[1])
    await settle(60)
    expect(count()).toBe('76')
    expect(modes()[1].getAttribute('aria-checked')).toBe('true')
    // The other modes stay on the platform, switched off.
    expect($$('.lane--tile.lane--off')).toHaveLength(3)
    expect($$('.lane--tile:not(.lane--off)')).toHaveLength(5)
    press('Enter')
    await settle(60)
    const path = decodeURIComponent(departure.begin.mock.calls[0][0].path)
    expect(path.startsWith('/today/run?lanes=')).toBe(true)
    const ids = path.split('=')[1].split(',')
    expect(ids).toHaveLength(5)
    expect(ids.every(id => id.endsWith('.flashcard.f2b'))).toBe(true)
    // The next visit opens on it.
    expect(localStorage.getItem('tsuji.gateMain')).toBe('1')
  })

  it('opens on the main cards when they were chosen last time', async () => {
    localStorage.setItem('tsuji.gateMain', '1')
    await mount()
    expect(count()).toBe('76')
    expect(modes()[1].getAttribute('aria-checked')).toBe('true')
  })

  it('leaves the filter when another mode is switched on, keeping what the gate shows', async () => {
    await mount()
    await userEvent.click(modes()[1])
    await settle(60)
    const off = $$('.lane--tile.lane--off')
    await userEvent.click(off[0])
    await settle(60)
    expect(modes()[0].getAttribute('aria-checked')).toBe('true')
    // One lane back on; the other two stay off.
    expect($$('.lane--tile.lane--off')).toHaveLength(2)
    expect(Number(count())).toBeGreaterThan(76)
    expect(Number(count())).toBeLessThan(101)
  })

  it('gives back the learner\'s own switches with every mode', async () => {
    await mount()
    // Kana off, then the main cards, then every mode again: kana stays off.
    await userEvent.click($$('.gate-band__line')[0])
    await settle(60)
    expect(count()).toBe('74')
    await userEvent.click(modes()[1])
    await settle(60)
    expect(count()).toBe('49')
    await userEvent.click(modes()[0])
    await settle(60)
    expect(count()).toBe('74')
  })

  it('departs through the boarding\'s gate button', async () => {
    await mount()
    const go = $('.gate-card__fare .btn-depart')
    expect(go.classList.contains('btn-depart--gate')).toBe(true)
    expect(go.querySelector('.btn-depart__reader .pass__wave')).not.toBeNull()
    expect(text(go.querySelector('.btn-depart__jp'))).toBe('Embarquer')
    expect(go.querySelector('.desk-kbd')).not.toBeNull()
    expect(go.getAttribute('aria-keyshortcuts')).toBe('Enter')
    expect(Math.round(go.getBoundingClientRect().height)).toBe(66)
    // Nothing chosen: the gate's outline; a lane back on wakes it.
    for (const line of $$('.gate-band__line')) await userEvent.click(line)
    await settle(400)
    expect(go.disabled).toBe(true)
    expect(getComputedStyle(go, '::before').opacity).toBe('0')
    await userEvent.click($$('.gate-band__line')[0])
    await settle(20)
    expect(go.disabled).toBe(false)
    expect(go.classList.contains('btn-depart--waking')).toBe(true)
  })
})
