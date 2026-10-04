import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from 'vitest-browser-react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { LangProvider } from '../LangContext'
// Same stylesheet-import trick as PromptCard.browser.test.jsx (plan 048):
// the rules these tests pin only exist once the real sheet is loaded.
import '../index.css'

// ── The gate (plan 070) ───────────────────────────────────────
// /today is the fare gate with the day's lanes as the run's
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
const summaryRef = { current: { username: 'Aiko', week: [], streak: 3, level: 12 } }
vi.mock('../stores/profileSummary', async (o) => ({ ...(await o()),
  useProfileSummary: () => summaryRef.current,
  refreshSummary: vi.fn(async () => {}),
}))
const apiJson = vi.fn(async () => ({}))
vi.mock('../lib/api', async (o) => ({ ...(await o()), apiJson: (...a) => apiJson(...a) }))
vi.mock('../lib/supabase', () => ({
  supabase: { auth: { getSession: async () => ({ data: { session: { access_token: 'tok', user: { id: 'u1' } } } }) } },
}))
vi.mock('../lib/track', () => ({ track: vi.fn(), flush: vi.fn() }))
vi.mock('../stores/credits', async (o) => ({
  ...(await o()),
  useCredits: () => ({ balance: 30, cap: 50, dailyRefill: 30, nextCreditAt: null, plan: 'free', unlimited: false, enforced: false }),
}))
vi.mock('../stores/departure', () => ({ beginDeparture: vi.fn(), useDeparture: () => null }))
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

// The switches stand in the services sheet since plan 166, which
// portals to the body.
async function services(screen) {
  screen.container.querySelector('.gate-one__services').click()
  await settle()
  return [...document.querySelectorAll('.gate-sheet .lane')]
}

describe('TodayScreen — the gate', () => {
  it('opens on the strip and the gate with every lane on, and no bar', async () => {
    const screen = await mount()
    await settle()
    // No bar (owner's call, 2026-09-20): the name is the clipped <h1>.
    expect(screen.container.querySelector('.bar')).toBeNull()
    expect(screen.container.querySelector('h1.sr-only').textContent).toBe('Service du jour')
    // The strip reads over the gate, not under it: a status line
    // belongs above the object it is about, and it leaves the gate the
    // last thing on the screen, free to take the rest of it.
    const order = [...screen.container.querySelectorAll('.pass--strip, .gate-card')]
      .map(el => (el.classList.contains('pass--strip') ? 'strip' : 'gate'))
    expect(order).toEqual(['strip', 'gate'])
    const lanes = await services(screen)
    expect(lanes).toHaveLength(3)
    expect([...lanes].every(l => l.getAttribute('aria-pressed') === 'true')).toBe(true)
    expect(screen.container.querySelector('.gate-card__count').textContent).toBe('19')
    expect(screen.container.querySelector('.pass--strip .stamp-rally')).toBeTruthy()
    expect(screen.container.querySelector('.hall-pace')).toBeTruthy()
  })

  it('a lane switched off leaves the count, and the run carries the choice', async () => {
    const screen = await mount()
    await settle()
    // The lanes are grouped by line, vocab before kanji: pick by name.
    const kanji = (await services(screen)).find(l => l.textContent.includes('N4'))
    kanji.click()
    await settle()
    expect(kanji.classList.contains('lane--off')).toBe(true)
    expect(screen.container.querySelector('.gate-card__count').textContent).toBe('10')

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

    // Every line switched off is the whole day off — the all/none link
    // that used to do it in one tap is gone, and the line switches are
    // what stands in for it.
    await services(screen)
    for (const head of document.querySelectorAll('.gate-sheet__head')) {
      if (head.getAttribute('aria-pressed') === 'true') head.click()
      await settle()
    }
    expect(document.querySelectorAll('.gate-sheet .lane--off')).toHaveLength(3)
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

describe('.btn-primary — the filled action (plans 051, 052, 174)', () => {
  function mountButton() {
    return render(
      <LangProvider>
        <MemoryRouter>
          <main className="stage" style={{ '--line-color': 'var(--line-kana)' }}><button type="button" className="btn-primary">Submit</button></main>
        </MemoryRouter>
      </LangProvider>
    )
  }

  it('renders as a real filled button, not the bare-button default', async () => {
    const screen = await mountButton()
    const style = getComputedStyle(screen.container.querySelector('.btn-primary'))
    expect(style.backgroundImage).toMatch(/linear-gradient/)
    expect(style.fontFamily).toContain('Space Grotesk')
  })

  // 一金 (plan 174): the primary is the gate's metal in every section --
  // a line's pigment no longer fills it, so the section's colour here
  // changes nothing -- inked --text-on-fill, clear of the floor on the
  // gradient's lighter stop and its deeper one alike.
  it('inks the fill ink on the gate\'s gold, above the 4.5:1 floor', async () => {
    const screen = await mountButton()
    const style = getComputedStyle(screen.container.querySelector('.btn-primary'))
    // --text-on-fill #1c1811.
    expect(rgbOf(style.color)).toEqual([28, 24, 17])
    const root = getComputedStyle(document.documentElement)
    const hex = name => root.getPropertyValue(name).trim().replace('#', '').match(/../g).map(h => parseInt(h, 16))
    for (const stop of ['--gate-gold-lit', '--gate-gold']) {
      expect(style.backgroundImage).toContain(`rgb(${hex(stop).join(', ')})`)
      expect(contrast(rgbOf(style.color), hex(stop))).toBeGreaterThanOrEqual(4.5)
    }
  })
})


// ── 案内 — the gate's guide (plan 100) ────────────────────────────
describe('TodayScreen — the guide', () => {
  const settleLong = (ms = 200) => new Promise(r => setTimeout(r, ms))

  it('carries its anchors, and opens the guide once the lanes have painted for a learner who has not seen it', async () => {
    summaryRef.current = { username: 'Aiko', week: [], streak: 3, level: 12, guided: {} }
    apiJson.mockReset()
    apiJson.mockResolvedValue({})
    const screen = await mount()
    await settleLong()
    const root = screen.container
    expect(root.querySelector('[data-guide="today.strip"]')).toBeTruthy()
    expect(root.querySelector('[data-guide="today.gate"]')).toBeTruthy()
    const guide = document.querySelector('.guide')
    expect(guide).toBeTruthy()
    // The tab bar is the shell's, not this screen's: the guide starts
    // on the gate, and never stops at the strip.
    expect(guide.dataset.stop).toBe('today.gate')
    document.querySelector('[data-action="guide-skip"]').click()
    await settleLong()
    expect(document.querySelector('.guide')).toBeNull()
    const stamp = apiJson.mock.calls.find(([u]) => u === '/api/onboarding/guided/today')
    expect(stamp).toBeTruthy()
    expect(stamp[2]).toMatchObject({ method: 'POST' })
    summaryRef.current = { username: 'Aiko', week: [], streak: 3, level: 12 }
    localStorage.removeItem('jp-guided')
  })

  it('opens no guide on a gate the profile says was guided, or on a profile that has not answered', async () => {
    summaryRef.current = { username: 'Aiko', week: [], streak: 3, level: 12, guided: { today: '2026-09-21T00:00:00Z' } }
    let screen = await mount()
    await settleLong()
    expect(document.querySelector('.guide')).toBeNull()
    screen.unmount()
    summaryRef.current = { username: 'Aiko', week: [], streak: 3, level: 12 }
    screen = await mount()
    await settleLong()
    expect(document.querySelector('.guide')).toBeNull()
    screen.unmount()
  })
})
