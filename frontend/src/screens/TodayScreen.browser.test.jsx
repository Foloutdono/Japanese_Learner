import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from 'vitest-browser-react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { LangProvider } from '../LangContext'
// Same stylesheet-import trick as PromptCard.browser.test.jsx (plan 048):
// the rules these tests pin only exist once the real sheet is loaded.
import '../index.css'

// ── The gate (plan 070) ───────────────────────────────────────
// /today is the fare gate with the day's lanes as the run's picker,
// drawn since plan 199 as a dial with the switches in the services
// sheet. The finish is the run's own since plan 191 (/today/clear);
// the gate prints none.
//
// The two .btn-primary contracts below predate the gate (plans 051 and
// 052): the screen's filled action used to be a .btn-primary and the
// class had lost its rule once, unnoticed, so the rule is pinned on the
// class itself — the run's Submit and Reveal buttons still wear it.

const todayRef = { current: null }
vi.mock('../stores/today', () => ({
  useTodaySummary: () => ({ data: todayRef.current, failed: false }),
  refreshToday: vi.fn(),
  refetchToday: vi.fn(() => Promise.resolve()),
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
const { forgetShown } = await import('../stores/guide')

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
// portals to the body. A line of one lane is its own switch.
async function services(screen) {
  screen.container.querySelector('.tdy-door').click()
  await settle()
  return [...document.querySelectorAll('.tdy-sheet .tdy-line__head')]
}

describe('TodayScreen — the gate', () => {
  it('opens on the dial and the gate with every lane on, and no bar', async () => {
    const screen = await mount()
    await settle()
    // No bar (owner's call, 2026-09-20): the name is the clipped <h1>.
    expect(screen.container.querySelector('.bar')).toBeNull()
    expect(screen.container.querySelector('h1.sr-only').textContent).toBe('Service du jour')
    // The day at a glance (plan 199): the strip and the pace that stood
    // over the gate are the sheet's figures and the HUD's ring now.
    expect(screen.container.querySelector('.pass--strip, .hall-pace')).toBeNull()
    expect(screen.container.querySelector('.tdy-hero .tdy-dial')).toBeTruthy()
    expect(screen.container.querySelector('.tdy-dial__count').textContent).toBe('19')
    const lines = await services(screen)
    expect(lines).toHaveLength(3)
    expect(lines.every(l => l.getAttribute('aria-pressed') === 'true')).toBe(true)
  })

  it('a line switched off leaves the count, and the run carries the choice', async () => {
    const screen = await mount()
    await settle()
    // The lanes are grouped by line, vocab before kanji: pick by name.
    const kanji = (await services(screen)).find(l => l.textContent.includes('Kanji'))
    kanji.click()
    await settle()
    expect(kanji.getAttribute('aria-pressed')).toBe('false')
    expect(screen.container.querySelector('.tdy-dial__count').textContent).toBe('10')

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
    for (const head of await services(screen)) {
      if (head.getAttribute('aria-pressed') === 'true') head.click()
      await settle()
    }
    expect(document.querySelectorAll('.tdy-sheet .tdy-line--off')).toHaveLength(3)
    expect(screen.container.querySelector('.btn-depart').disabled).toBe(true)
  })

  it('no longer prints a finish: a run ends on /today/clear (plan 191)', async () => {
    todayRef.current = { total: 19, by_source: {}, lanes: LANES, next_due: null }
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
    expect(screen.container.querySelector('.today-clear')).toBeNull()
    expect(screen.container.querySelector('.tdy-hero')).toBeTruthy()
  })

  // 運休 (plan 191): the morning after a missed day a rest day covered,
  // the gate gives way once to the notice; Départ tells the server it was
  // seen and boards the day's run.
  it('shows the rest-day notice once, and marks it seen on the way out', async () => {
    todayRef.current = {
      total: 41, seconds_per_review: 20.5, by_source: {}, lanes: LANES, next_due: null,
      rest: { held: 0, unseen: ['2026-10-06'], streak: 8, next_at: 14 },
    }
    apiJson.mockClear()
    const screen = await render(
      <LangProvider>
        <MemoryRouter initialEntries={['/today']}>
          <Routes>
            <Route path="/today" element={<TodayScreen />} />
            <Route path="/today/run" element={<main className="run-stub" />} />
          </Routes>
        </MemoryRouter>
      </LangProvider>
    )
    await settle()
    const notice = screen.container.querySelector('.rst')
    expect(notice).toBeTruthy()
    expect(screen.container.querySelector('.gate-card')).toBeNull()
    expect(notice.querySelector('.clrk-hdr__title').textContent).toBe('Ta série tient')
    notice.querySelector('.btn-depart--gate').click()
    await settle()
    expect(apiJson).toHaveBeenCalledWith('/api/today/rest/seen', undefined, expect.objectContaining({ method: 'POST' }))
    // The router boards the run as a transition, after the urgent render
    // that puts the gate back (since plan 205 a print, not a quick paint):
    // wait for the run rather than a fixed beat, which a loaded runner
    // outlasts.
    await vi.waitFor(() => expect(screen.container.querySelector('.run-stub')).toBeTruthy())
  })

  // 回復運転 (plan 217): a catch-up is a figure of the day, and a door to
  // where it is changed; a share spent with reviews held back leaves a
  // quiet way on over the shut gate.
  it('counts the catch-up among the day\'s figures, a door to Settings › Reviews', async () => {
    todayRef.current = {
      total: 19, by_source: {}, lanes: LANES, next_due: null,
      review: { cap: null, held: 40, catchup: { per_day: 23, day: 2, of: 5 }, away: null, comeback: null },
    }
    const screen = await mount()
    await settle()
    await services(screen)
    const cell = document.querySelector('.tdy-sheet a.tdy-day__cell[href="/profile/settings/reviews"]')
    expect(cell).toBeTruthy()
    expect(cell.querySelector('.tdy-day__fig').textContent).toBe('2/ 5')
  })

  it('offers the reviews held back past the spent share as a run of their own', async () => {
    todayRef.current = {
      total: 0, by_source: {}, lanes: [], next_due: null, reviewed: { total: 20, by_line: { vocab: 20 } },
      tomorrow: { cards: 20, minutes: 4 },
      review: { cap: 20, held: 37, catchup: null, away: null, comeback: null },
    }
    beginDeparture.mockClear()
    const screen = await mount()
    await settle()
    const extra = screen.container.querySelector('[data-action="review-extra"]')
    expect(extra).toBeTruthy()
    expect(extra.textContent).toContain('37')
    extra.click()
    expect(beginDeparture.mock.calls[0][0].path).toBe('/today/run?extra=1')
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
    // Waited for, not slept on (the transfer sheet's tests below say why).
    await vi.waitFor(() => expect(document.querySelector('.guide')).toBeTruthy(), { timeout: 5000, interval: 20 })
    const root = screen.container
    expect(root.querySelector('[data-guide="today.gate"]')).toBeTruthy()
    const guide = document.querySelector('.guide')
    // The tab bar is the shell's, not this screen's: the guide starts
    // on the gate.
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
    await screen.unmount()
    summaryRef.current = { username: 'Aiko', week: [], streak: 3, level: 12 }
    screen = await mount()
    await settleLong()
    expect(document.querySelector('.guide')).toBeNull()
    await screen.unmount()
  })
})

// 乗換 (plan 243b): the sheet that asks a new learner, once, whether
// they studied in another app -- after the gate's guide, never with it,
// and gone the moment it is answered, whichever way.
describe('TodayScreen — the transfer sheet', () => {
  const GUIDED = { today: '2026-10-17T00:00:00Z' }
  const offered = extra => ({ username: 'Aiko', week: [], streak: 0, level: 1, guided: GUIDED, transferOffer: true, ...extra })
  const sheet = () => document.querySelector('.tr-sheet')
  const settleLong = (ms = 200) => new Promise(r => setTimeout(r, ms))
  // What should appear is waited for, never slept on: the guide and the
  // sheet open after the lanes paint, which a fixed 200ms lost on a
  // loaded CI runner. A fixed settle stays only before an absence.
  const arrives = el => vi.waitFor(() => expect(el()).toBeTruthy(), { timeout: 5000, interval: 20 })

  function mountWithSettings() {
    return render(
      <LangProvider>
        <MemoryRouter initialEntries={['/today']}>
          <Routes>
            <Route path="/today" element={<TodayScreen />} />
            <Route path="/profile/settings/:page" element={<p data-page="settings">settings</p>} />
          </Routes>
        </MemoryRouter>
      </LangProvider>
    )
  }

  beforeEach(() => {
    apiJson.mockClear()
    forgetShown()
  })

  it('asks, with the apps it reads, and "I’m starting here" answers it', async () => {
    summaryRef.current = offered()
    const screen = await mountWithSettings()
    await arrives(sheet)
    expect(document.querySelector('.guide')).toBeNull()
    expect(sheet().querySelector('h2').textContent.replace(/\u00a0/g, ' ')).toBe('Tu as déjà appris ailleurs ?')
    expect([...sheet().querySelectorAll('.tr-chip')].map(c => c.textContent)).toEqual(['Anki', 'WaniKani', 'Renshuu'])
    sheet().querySelector('[data-action="transfer-offer-later"]').click()
    await settle()
    expect(sheet()).toBeNull()
    const posted = apiJson.mock.calls.filter(([u]) => u === '/api/transfer/offer')
    expect(posted).toHaveLength(1)
    expect(JSON.parse(posted[0][2].body)).toEqual({ choice: 'later' })
    await screen.unmount()
  })

  it('goes to Settings › Correspondance', async () => {
    summaryRef.current = offered()
    const screen = await mountWithSettings()
    await arrives(sheet)
    sheet().querySelector('[data-action="transfer-offer-go"]').click()
    // Waited for, not slept on: the page arrives through the router's
    // transition, which a fixed 80ms lost on a loaded CI runner.
    await vi.waitFor(() => expect(document.querySelector('[data-page="settings"]')).toBeTruthy(), { timeout: 5000, interval: 20 })
    const posted = apiJson.mock.calls.filter(([u]) => u === '/api/transfer/offer')
    expect(posted.map(([, , o]) => JSON.parse(o.body))).toEqual([{ choice: 'go' }])
    await screen.unmount()
  })

  it('shut with Escape counts as an answer', async () => {
    summaryRef.current = offered()
    const screen = await mountWithSettings()
    await arrives(sheet)
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await settle()
    expect(sheet()).toBeNull()
    expect(apiJson.mock.calls.filter(([u]) => u === '/api/transfer/offer')).toHaveLength(1)
    await screen.unmount()
  })

  it('waits for the gate’s guide, and is not drawn when the profile does not offer', async () => {
    summaryRef.current = offered({ guided: {} })
    let screen = await mountWithSettings()
    await arrives(() => document.querySelector('.guide'))
    expect(sheet()).toBeNull()
    await screen.unmount()
    localStorage.removeItem('jp-guided')
    summaryRef.current = offered({ transferOffer: false })
    screen = await mountWithSettings()
    await settleLong()
    expect(sheet()).toBeNull()
    await screen.unmount()
    summaryRef.current = { username: 'Aiko', week: [], streak: 3, level: 12 }
  })
})

// 本乗車券 (plan 269): a guest is asked to keep the card with an address
// at most once a day, after the guide and the transfer offer, and may
// always go on as a guest.
describe('TodayScreen — asking a guest to keep the card', () => {
  const GUIDED = { today: '2026-10-17T00:00:00Z' }
  const guest = { access_token: 'tok', user: { id: 'g1', is_anonymous: true } }
  const sheet = () => document.querySelector('.brd-sheet--account')
  const arrives = el => vi.waitFor(() => expect(el()).toBeTruthy(), { timeout: 5000, interval: 20 })

  function mountAs(session) {
    return render(
      <LangProvider>
        <MemoryRouter initialEntries={['/today']}>
          <Routes>
            <Route path="/today" element={<TodayScreen session={session} />} />
          </Routes>
        </MemoryRouter>
      </LangProvider>
    )
  }

  beforeEach(() => {
    localStorage.removeItem('tsuji.keepAsked')
    summaryRef.current = { username: 'Aiko', week: [], streak: 0, level: 1, guided: GUIDED }
  })

  it('asks a guest once a day, and « Continuer en invité » goes on', async () => {
    let screen = await mountAs(guest)
    await arrives(sheet)
    expect(sheet().querySelector('[data-action="account-guest"]').textContent).toBe('Continuer en invité')
    sheet().querySelector('[data-action="account-guest"]').click()
    await settle()
    expect(sheet()).toBeNull()
    await screen.unmount()
    // The same day, the next visit is not asked again.
    screen = await mountAs(guest)
    await settle(200)
    expect(sheet()).toBeNull()
    await screen.unmount()
  })

  it('waits for the transfer offer, and never asks an account', async () => {
    summaryRef.current = { ...summaryRef.current, transferOffer: true }
    let screen = await mountAs(guest)
    await arrives(() => document.querySelector('.tr-sheet'))
    expect(sheet()).toBeNull()
    await screen.unmount()
    summaryRef.current = { ...summaryRef.current, transferOffer: false }
    screen = await mountAs({ access_token: 'tok', user: { id: 'a1', is_anonymous: false, email: 'a@b.c' } })
    await settle(200)
    expect(sheet()).toBeNull()
    await screen.unmount()
    summaryRef.current = { username: 'Aiko', week: [], streak: 3, level: 12 }
  })
})
