import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from 'vitest-browser-react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { LangProvider } from '../LangContext'
// Same stylesheet-import trick as PromptCard.browser.test.jsx (plan 048):
// the rules these tests pin only exist once the real sheet is loaded.
import '../index.css'

// ── The gate (plan 070) ───────────────────────────────────────
// /today is the bar, the fare gate with the day's lanes as the run's
// picker, and the strip. The finish comes back from the run through
// the router's state and is printed here, under the chrome.
//
// The two .btn-primary contracts below predate the gate (plans 051 and
// 052): the screen's filled action used to be a .btn-primary and the
// class had lost its rule once, unnoticed, so the rule is pinned on the
// class itself — the run's Submit and Reveal buttons still wear it.

const todayRef = { current: null }
vi.mock('../stores/today', () => ({
  useTodaySummary: () => ({ data: todayRef.current, failed: false }),
  refreshToday: vi.fn(),
  seedTodaySummary: vi.fn(),
}))
vi.mock('../stores/profileSummary', () => ({
  useProfileSummary: () => ({ username: 'Aiko', week: [], streak: 3, level: 12 }),
}))
vi.mock('../stores/credits', async (o) => ({
  ...(await o()),
  useCredits: () => ({ balance: 30, cap: 50, dailyRefill: 30, refillAt: null, plan: 'free', unlimited: false, enforced: false }),
}))
vi.mock('../stores/departure', () => ({ beginDeparture: vi.fn() }))
vi.mock('../lib/audio', async (o) => ({ ...(await o()), playAnnouncement: vi.fn() }))
globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) })

const { default: TodayScreen } = await import('./TodayScreen')
const { beginDeparture } = await import('../stores/departure')

const settle = (ms = 80) => new Promise(r => setTimeout(r, ms))

const LANES = [
  { id: 's~kanji~N4~kanji.flashcard.f2b', kind: 'section', source: 'kanji', deck: 'N4', mode: 'kanji.flashcard.f2b', due: 9 },
  { id: 's~vocab~N5~vocab.flashcard.f2b', kind: 'section', source: 'vocab', deck: 'N5', mode: 'vocab.flashcard.f2b', due: 8 },
  { id: 'p~3~vocab.flashcard.f2b', kind: 'personal', deck_id: 3, deck_name: '旅行', mode: 'vocab.flashcard.f2b', due: 2 },
]

function mount(entry = '/today') {
  return render(
    <LangProvider>
      <MemoryRouter initialEntries={[entry]}>
        <Routes>
          <Route path="/today" element={<TodayScreen />} />
        </Routes>
      </MemoryRouter>
    </LangProvider>
  )
}

// Plan 052 — Chromium serialises a resolved `color-mix(in srgb, ...)`
// as `color(srgb 0.673569 0.241255 0.160784)`, at float precision, not
// as the `rgb(172, 62, 41)` an 8-bit hex would give. Both forms have to
// be read, and the float one must not be rounded before it is measured.
function rgbOf(str) {
  const nums = str.match(/[\d.]+/g).slice(0, 3).map(Number)
  return str.startsWith('color(') ? nums.map(n => n * 255) : nums
}

// WCAG 2.x relative luminance and contrast ratio.
function contrast(a, b) {
  const lum = c => {
    const [r, g, bl] = c.map(v => {
      const s = v / 255
      return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
    })
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl
  }
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

beforeEach(() => {
  todayRef.current = { total: 19, lanes: LANES, next_due: null, pace: { target: 10, newToday: 4, remaining: 6 } }
  beginDeparture.mockClear()
})

describe('TodayScreen — the gate', () => {
  it('opens on the bar, the gate with every lane on, and the strip', async () => {
    const screen = await mount()
    await settle()
    expect(screen.container.querySelector('.bar__roundel').textContent).toBe('HN')
    expect(screen.container.querySelector('h1.bar__title').textContent).toBe('Service du jour')
    const lanes = screen.container.querySelectorAll('.lane')
    expect(lanes).toHaveLength(3)
    expect([...lanes].every(l => l.getAttribute('aria-pressed') === 'true')).toBe(true)
    expect(screen.container.querySelector('.gate-card__count').textContent).toBe('19')
    expect(screen.container.querySelector('.pass--strip .stamp-rally')).toBeTruthy()
    expect(screen.container.querySelector('.hall-pace')).toBeTruthy()
  })

  it('a lane switched off leaves the fare, and the run carries the choice', async () => {
    const screen = await mount()
    await settle()
    // The lanes are grouped by line, vocab before kanji: pick by name.
    const kanji = [...screen.container.querySelectorAll('.lane')].find(l => l.textContent.includes('N4'))
    kanji.click()
    await settle()
    expect(kanji.classList.contains('lane--off')).toBe(true)
    expect(screen.container.querySelector('.gate-card__count').textContent).toBe('10')
    expect(screen.container.querySelector('.gate-card__fare b').textContent).toBe('10')

    screen.container.querySelector('.btn-depart').click()
    expect(beginDeparture).toHaveBeenCalledTimes(1)
    const section = beginDeparture.mock.calls[0][0]
    expect(section.path).toBe('/today/run?lanes=' + encodeURIComponent('s~vocab~N5~vocab.flashcard.f2b,p~3~vocab.flashcard.f2b'))
  })

  it('every lane on departs without a query; none on cannot depart', async () => {
    const screen = await mount()
    await settle()
    screen.container.querySelector('.btn-depart').click()
    expect(beginDeparture.mock.calls[0][0].path).toBe('/today/run')

    screen.container.querySelector('.gate-card__pick').click()
    await settle()
    expect(screen.container.querySelectorAll('.lane--off')).toHaveLength(3)
    expect(screen.container.querySelector('.btn-depart').disabled).toBe(true)
  })

  it('prints the finish the run handed back, and the way back to the gate', async () => {
    const screen = await render(
      <LangProvider>
        <MemoryRouter initialEntries={[{ pathname: '/today', state: { run: { cleared: 12, xp: 48 } } }]}>
          <Routes>
            <Route path="/today" element={<TodayScreen />} />
          </Routes>
        </MemoryRouter>
      </LangProvider>
    )
    await settle()
    const clear = screen.container.querySelector('.today-clear')
    expect(clear).toBeTruthy()
    expect(clear.querySelector('.today-clear__body').textContent).toContain('12')
    expect(clear.querySelector('.fare-slip')).toBeTruthy()
    expect(screen.container.querySelector('.gate-card')).toBeNull()

    clear.querySelector('.btn-depart--ghost').click()
    await settle()
    expect(screen.container.querySelector('.today-clear')).toBeNull()
    expect(screen.container.querySelector('.gate-card')).toBeTruthy()
  })
})

describe('.btn-primary — the filled action (plans 051, 052)', () => {
  function mountButton() {
    return render(
      <LangProvider>
        <MemoryRouter>
          <main className="stage"><button type="button" className="btn-primary">Submit</button></main>
        </MemoryRouter>
      </LangProvider>
    )
  }

  it('renders as a real filled button, not the bare-button default', async () => {
    const screen = await mountButton()
    const style = getComputedStyle(screen.container.querySelector('.btn-primary'))
    expect(style.backgroundColor).not.toBe('rgba(0, 0, 0, 0)')
    expect(style.backgroundColor).not.toBe('transparent')
    expect(style.fontFamily).toContain('Space Grotesk')
  })

  it('inks the paper ink on a deepened pigment fill, above the 4.5:1 floor', async () => {
    const screen = await mountButton()
    const style = getComputedStyle(screen.container.querySelector('.btn-primary'))
    // --text-on-panel #f3ecdf, the mockup's ink at every primary swatch.
    expect(rgbOf(style.color)).toEqual([243, 236, 223])
    // color-mix(in srgb, #c1442c 70%, #100e13): the raw pigment measures
    // 4.33:1, under the floor; 70/79 is the one pair that clears it on
    // all twelve pigments in both themes (plan 060).
    const fill = rgbOf(style.backgroundColor)
    expect(fill[0]).toBeCloseTo(139.9, 0)
    expect(fill[1]).toBeCloseTo(51.8, 0)
    expect(fill[2]).toBeCloseTo(36.5, 0)
    expect(contrast(rgbOf(style.color), fill)).toBeGreaterThanOrEqual(4.5)
  })
})
