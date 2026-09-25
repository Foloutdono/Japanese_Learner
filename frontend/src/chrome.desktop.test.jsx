import { describe, it, expect, vi, afterEach } from 'vitest'
import { render } from 'vitest-browser-react'
import { page } from 'vitest/browser'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { LangProvider } from './LangContext'
import { DESK_QUERY } from './hooks/useDesk'
import { DESK_TAB_IDS } from './config/tabs'
import './index.css'

// ── 机 — the desk's chrome at its tightest (plan 113) ───────────
// The `desktop` lane: 1100×800 from the first paint, the first width
// the desk answers and the narrowest one it has to fit — 1100 less the
// rail is where two plates still sit side by side and a French label is
// likeliest to overflow. What chrome.phone.test.jsx is for the phone's
// chrome, this is for the rail: the HUD and the tab bar are gone, one
// sumi column down the left edge holds both, every gate is captioned,
// the lit gate's stations hang under it, and nothing in it wears a
// line's pigment. The stores behind it are stubbed the same way.

const apiFetch = vi.fn(async () => ({ ok: false, status: 500, json: async () => ({}) }))
vi.mock('./lib/api', () => ({
  api: p => p,
  apiFetch: (...a) => apiFetch(...a),
  apiJson: vi.fn(async () => ({})),
  apiJsonWithTimeout: vi.fn(),
  apiUpload: vi.fn(),
  ApiError: class ApiError extends Error {},
}))
vi.mock('./lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: async () => ({ data: { session: { access_token: 'tok' } } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
    },
  },
}))
vi.mock('./stores/profileSummary', async (o) => ({ ...(await o()),
  useProfileSummary: () => ({ level: 12, xp: 1200, xpPrevLevel: 1000, xpForNext: 1500, username: 'Aiko', streak: 3 }),
  useProfileSummaryState: () => ({ summary: null, failed: false }),
  refreshSummary: vi.fn(),
}))
const journeyRef = { current: null }
vi.mock('./stores/journey', () => ({
  useJourneyStatus: () => ({ data: journeyRef.current, failed: false }),
  refreshJourney: vi.fn(),
  seedJourneyStatus: vi.fn(),
  openStatus: vi.fn(),
}))
// The balance on the rail's pass (plan 127): null is the store before
// the API has answered.
const creditsRef = { current: null }
vi.mock('./stores/credits', async (o) => ({ ...(await o()),
  useCredits: () => creditsRef.current,
  openBalance: vi.fn(),
}))
const todayRef = { current: { total: 24, by_source: {}, lanes: [], next_due: null } }
vi.mock('./stores/today', () => ({
  useTodaySummary: () => ({ data: todayRef.current, failed: false }),
  refreshToday: vi.fn(),
  seedTodaySummary: vi.fn(),
}))
vi.mock('./lib/audio', async (importOriginal) => ({
  ...(await importOriginal()),
  playClick: vi.fn(),
}))
globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) })

const { Shell, StageFrame } = await import('./components/chrome/Shell')

const settle = (ms = 60) => new Promise(r => setTimeout(r, ms))
const RAIL_W = 256

function mountShell(path = '/today', screen = <main id="main-content">here</main>) {
  return render(
    <LangProvider>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route element={<Shell />}>
            <Route path="/today" element={screen} />
            <Route path="/learn" element={screen} />
            <Route path="/learn/decks" element={screen} />
            <Route path="/learn/decks/:id" element={screen} />
            <Route path="/practice" element={screen} />
            <Route path="/dictionary" element={screen} />
            <Route path="/profile" element={screen} />
            <Route path="/profile/settings/:page" element={screen} />
          </Route>
          <Route element={<StageFrame />}>
            <Route path="/learn/kana/:set/:mode" element={screen} />
          </Route>
        </Routes>
      </MemoryRouter>
    </LangProvider>
  )
}

const rail = () => document.querySelector('.desk-rail')
const gates = () => [...document.querySelectorAll('.desk-rail [data-tab]')]
const stations = () => [...document.querySelectorAll('.desk-rail .desk-sec')]

afterEach(() => {
  journeyRef.current = null
  creditsRef.current = null
  todayRef.current = { total: 24, by_source: {}, lanes: [], next_due: null }
})

describe('the desktop lane', () => {
  it('is the first width the desk answers', () => {
    expect(window.innerWidth).toBe(1100)
    expect(window.matchMedia(DESK_QUERY).matches).toBe(true)
    // One pixel under is the phone's frame, centred.
    expect(window.matchMedia('(max-width: 1099px)').matches).toBe(false)
  })
})

describe('the rail', () => {
  it('replaces both bars: no HUD, no tab bar, one column down the left edge', async () => {
    await mountShell()
    await settle()
    expect(document.querySelector('.phone').className).toBe('phone phone--desk')
    expect(document.querySelector('.hud')).toBeNull()
    expect(document.querySelector('.tabbar')).toBeNull()
    const box = rail().getBoundingClientRect()
    expect(box.left).toBe(0)
    expect(box.top).toBe(0)
    expect(box.width).toBe(RAIL_W)
    expect(box.height).toBe(window.innerHeight)
    expect(getComputedStyle(rail()).position).toBe('fixed')
    // A banner, as the HUD was.
    expect(rail().tagName).toBe('HEADER')
  })

  it('docks nothing over a tab bar that is not there, and sets the screen beside the rail', async () => {
    await mountShell()
    await settle(420)
    expect(document.documentElement.dataset.chrome).toBe('shell')
    const content = document.querySelector('.phone__content')
    expect(getComputedStyle(content).paddingBottom).toBe('0px')
    const c = content.getBoundingClientRect()
    expect(c.left).toBeGreaterThanOrEqual(rail().getBoundingClientRect().right)
    expect(c.right).toBeLessThanOrEqual(window.innerWidth)
    // No sideways scroll anywhere on the desk.
    expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth)
  })

  it('is sumi, with the HUD\'s own edge turned to face the screen', async () => {
    await mountShell()
    await settle()
    const ground = getComputedStyle(rail()).backgroundColor
    // The HUD this replaces, drawn off-screen for its values.
    const hud = document.createElement('header')
    hud.className = 'hud'
    document.body.appendChild(hud)
    try {
      expect(ground).toBe(getComputedStyle(hud).backgroundColor)
      expect(getComputedStyle(rail()).borderRightColor).toBe(getComputedStyle(hud).borderBottomColor)
      expect(getComputedStyle(rail()).borderRightWidth).toBe('1px')
    } finally {
      hud.remove()
    }
  })

  it('names the app at its head: 辻 over its name', async () => {
    await mountShell()
    await settle()
    const glyph = rail().querySelector('.desk-rail__glyph')
    expect(glyph.textContent).toBe('辻')
    expect(glyph.getAttribute('lang')).toBe('ja')
    expect(rail().querySelector('.desk-rail__name').textContent).toBe('Tsuji')
  })

  it('lists the five gates, Today first, every one of them captioned', async () => {
    await mountShell('/learn')
    await settle()
    expect(gates().map(g => g.dataset.tab)).toEqual(DESK_TAB_IDS)
    expect(gates().map(g => g.getAttribute('href'))).toEqual(DESK_TAB_IDS.map(id => `/${id}`))
    for (const gate of gates()) {
      const label = gate.querySelector('.desk-gate__label')
      expect(label.textContent.trim().length).toBeGreaterThan(0)
      expect(getComputedStyle(label).display).not.toBe('none')
      // In French, the longest (DICTIONNAIRE, AUJOURD'HUI) — never cut.
      expect(label.scrollWidth).toBeLessThanOrEqual(label.clientWidth)
    }
    // The gates' list is the navigation, under the tab bar's own name
    // and guide anchor.
    const nav = rail().querySelector('nav')
    expect(nav.getAttribute('aria-label')).toBeTruthy()
    expect(nav.dataset.guide).toBe('tabbar')
  })

  it('lights the gate you are on, and lists its stations under it', async () => {
    await mountShell('/learn')
    await settle()
    const learn = gates().find(g => g.dataset.tab === 'learn')
    expect(learn.classList.contains('desk-gate--on')).toBe(true)
    expect(learn.getAttribute('aria-current')).toBe('page')
    expect(gates().filter(g => g.classList.contains('desk-gate--on'))).toHaveLength(1)
    expect(stations().map(s => s.getAttribute('href'))).toEqual([
      '/learn/kana', '/learn/vocab', '/learn/kanji', '/learn/grammar', '/learn/decks', '/learn/decks/library',
    ])
    // Standing on the gate, no station is lit.
    expect(stations().filter(s => s.getAttribute('aria-current'))).toHaveLength(0)
  })

  it('lights the station a nested screen stands in, and says the gate is where it is', async () => {
    await mountShell('/learn/decks/abc')
    await settle()
    const lit = stations().filter(s => s.getAttribute('aria-current') === 'page')
    expect(lit.map(s => s.getAttribute('href'))).toEqual(['/learn/decks'])
    expect(lit[0].classList.contains('desk-sec--on')).toBe(true)
    const learn = gates().find(g => g.dataset.tab === 'learn')
    expect(learn.getAttribute('aria-current')).toBe('true')
  })

  it("lights the library's own station, not the shelf's, inside the library (plan 132)", async () => {
    await mountShell('/learn/decks/library')
    await settle()
    const lit = stations().filter(s => s.getAttribute('aria-current') === 'page')
    expect(lit.map(s => s.getAttribute('href'))).toEqual(['/learn/decks/library'])
  })

  it('lists no stations under a gate that is its own only place', async () => {
    await mountShell('/today')
    await settle()
    expect(stations()).toHaveLength(0)
  })

  it('lists the pass\'s halls under Profile, settings included', async () => {
    await mountShell('/profile/settings/sound')
    await settle()
    expect(stations().map(s => s.getAttribute('href'))).toEqual(['/profile/stats', '/profile/settings'])
    expect(stations()[1].getAttribute('aria-current')).toBe('page')
  })

  it('prints a French station name whole', async () => {
    await mountShell('/practice')
    await settle()
    expect(stations()).toHaveLength(6)
    for (const s of stations()) expect(s.scrollWidth, s.textContent).toBeLessThanOrEqual(s.clientWidth)
  })

  it('carries the due count on Today, capped at 99+, with the real number spoken', async () => {
    await mountShell('/learn')
    await settle()
    const today = () => gates().find(g => g.dataset.tab === 'today')
    expect(today().querySelector('.desk-gate__due').textContent).toBe('24')
    expect(today().getAttribute('aria-label')).toMatch(/24/)
    expect(gates().filter(g => g.querySelector('.desk-gate__due'))).toHaveLength(1)
  })

  it('says 99+ rather than a third figure', async () => {
    todayRef.current = { total: 312, by_source: {}, lanes: [], next_due: null }
    await mountShell('/learn')
    await settle()
    const today = gates().find(g => g.dataset.tab === 'today')
    expect(today.querySelector('.desk-gate__due').textContent).toBe('99+')
    expect(today.getAttribute('aria-label')).toMatch(/312/)
  })

  // ── 定期券 — the learner's pass at the foot (plan 127) ──
  // The HUD's three instruments were set at the foot as the phone draws
  // them, three shapes on three alignments. They are one card now, the
  // learner's pass, with the HUD's three doors on it and their anchors:
  // the face (the level and its climb), the purse (the balance) and the
  // stub (the journey's word), and the card's edge is the balance's.
  it('sets the learner\'s pass at its foot: one card, the HUD\'s three doors and anchors', async () => {
    journeyRef.current = {
      goalLevel: 'N4', goalTargetDate: '2027-03-14', goalSetAt: '2026-09-01T00:00:00Z',
      plannedPerDay: 10, itemsTotal: 1000, itemsDone: 100, actual14: 14, days14: 14,
    }
    creditsRef.current = { balance: 34, cap: 50, dailyRefill: 30, refillAt: null, unlimited: false }
    await mountShell()
    await settle()
    const foot = rail().querySelector('.desk-rail__foot')
    const pass = foot.querySelector('.desk-pass')
    expect(foot.children).toHaveLength(1)
    expect(foot.firstElementChild).toBe(pass)
    // One object: every door inside the card, none outside it.
    for (const anchor of ['hud.level', 'hud.status', 'hud.pass']) {
      expect(foot.querySelectorAll(`[data-guide="${anchor}"]`), anchor).toHaveLength(1)
      expect(pass.querySelector(`[data-guide="${anchor}"]`).tagName, anchor).toBe('BUTTON')
    }
    // The face: the HUD's roundel, and the climb to the next level as
    // the run's level bar measures it -- 1200 xp between 1000 and 1500.
    const level = pass.querySelector('[data-guide="hud.level"]')
    expect(level.querySelector('.hud__level').textContent).toBe('12')
    expect(level.querySelector('.desk-pass__xp').textContent).toMatch(/^200 \/ 500\s*xp$/)
    expect(level.querySelector('.desk-pass__fill').style.width).toBe('40%')
    expect(level.getAttribute('aria-label')).toMatch(/12.*200 \/ 500/)
    expect(level.title).toMatch(/12$/)
    // The purse beside it, the stub across the card under both.
    const purse = pass.querySelector('[data-guide="hud.pass"]')
    const stub = pass.querySelector('[data-guide="hud.status"]')
    const card = pass.getBoundingClientRect()
    expect(Math.round(purse.getBoundingClientRect().left)).toBeGreaterThanOrEqual(Math.round(level.getBoundingClientRect().right))
    expect(Math.round(stub.getBoundingClientRect().top)).toBe(Math.round(level.getBoundingClientRect().bottom))
    expect(Math.round(stub.getBoundingClientRect().width)).toBe(Math.round(card.width) - 2)
    // The stub prints the journey's word and drift, and says both.
    expect(stub.classList.contains('desk-pass__stub--delayed')).toBe(true)
    expect(stub.querySelector('.desk-pass__word').textContent.length).toBeGreaterThan(0)
    expect(stub.querySelector('.desk-pass__drift').textContent).toMatch(/\d/)
    expect(stub.getAttribute('aria-label')).toContain(stub.querySelector('.desk-pass__word').textContent)
    // The card: the pass's identity corner, inset on the rail's floor.
    const cs = getComputedStyle(pass)
    expect(cs.borderTopLeftRadius).toBe('10px')
    expect(Math.round(card.left)).toBe(12)
    // The rail's own edge is its last pixel: the card stands 12px in
    // from it, as from the window's left.
    expect(Math.round(card.right)).toBe(rail().clientWidth - 12)
    // At the foot: under the last gate, on the rail's bottom edge.
    const last = gates().at(-1).getBoundingClientRect()
    expect(foot.getBoundingClientRect().top).toBeGreaterThan(last.bottom)
    expect(Math.round(foot.getBoundingClientRect().bottom)).toBe(window.innerHeight)
    expect(Math.round(window.innerHeight - card.bottom)).toBe(12)
  })

  // The purse, at a balance, at five or fewer and spent. The edge is the
  // balance's, as the pocket pass's was; spent, the caption says when
  // it comes back rather than what it counts.
  const note = () => rail().querySelector('.desk-pass__note')
  const edge = () => getComputedStyle(rail().querySelector('.desk-pass')).borderTopColor
  const fig = () => rail().querySelector('.desk-pass .hud__pass-fig')
  // A value as the rail resolves it, for a colour-mix the browser
  // prints in its own notation.
  const resolved = (value) => {
    const probe = document.createElement('span')
    probe.style.borderTop = `1px solid ${value}`
    rail().appendChild(probe)
    const c = getComputedStyle(probe).borderTopColor
    probe.remove()
    return c
  }
  const PLAIN_EDGE = 'color-mix(in srgb, var(--pass-ink) 70%, transparent)'
  const LOW_EDGE = 'color-mix(in srgb, var(--warning) 70%, transparent)'
  const OUT_EDGE = 'color-mix(in srgb, var(--danger) 70%, var(--text-on-panel))'
  const METAL = 'rgb(201, 154, 62)'
  const purseAt = async (balance) => {
    creditsRef.current = { balance, cap: 50, dailyRefill: 30, refillAt: null, unlimited: false }
    await mountShell()
    await settle()
  }

  it('says what the balance counts, in the pass\'s metal on the pass\'s edge', async () => {
    await purseAt(34)
    expect(fig().textContent).toBe('34/50')
    expect(note().textContent).toBe('crédits')
    expect(edge()).toBe(resolved(PLAIN_EDGE))
    expect(getComputedStyle(fig()).color).toBe(METAL)
  })

  it('warns on its edge at five or fewer, the figure keeping its metal', async () => {
    await purseAt(4)
    expect(rail().querySelector('.desk-pass').classList.contains('desk-pass--low')).toBe(true)
    expect(edge()).toBe(resolved(LOW_EDGE))
    expect(edge()).not.toBe(resolved(PLAIN_EDGE))
    expect(getComputedStyle(fig()).color).toBe(METAL)
  })

  it('says when a spent balance comes back, edge and figure in the danger\'s ink', async () => {
    await purseAt(0)
    const pass = rail().querySelector('.desk-pass')
    expect(pass.classList.contains('desk-pass--out')).toBe(true)
    expect(edge()).toBe(resolved(OUT_EDGE))
    expect(getComputedStyle(fig()).color).not.toBe(METAL)
    expect(note().textContent).toBe('+30 à 00:00')
    expect(pass.querySelector('[data-guide="hud.pass"]').getAttribute('aria-label')).toContain('+30 à 00:00')
  })

  it('prints no figure and no caption before the balance arrives, nor a stub with no contract', async () => {
    await mountShell()
    await settle()
    const pass = rail().querySelector('.desk-pass')
    expect(pass.querySelectorAll('.hud__pass-ring')).toHaveLength(3)
    expect(pass.querySelector('.hud__pass-fig')).toBeNull()
    expect(pass.querySelector('.desk-pass__note')).toBeNull()
    expect(pass.querySelector('[data-guide="hud.status"]')).toBeNull()
  })

  // A laptop's short window (plan 123): the rail used to scroll as one,
  // so at 600px with Learn's eleven stations hung under it the foot --
  // the level, the status, the pass -- fell under the window's floor.
  // The gates scroll alone now, and the foot stays on the bottom edge.
  it('keeps its foot on the bottom edge of a short window, the gates scrolling alone', async () => {
    await page.viewport(1100, 600)
    try {
      await mountShell('/learn')
      await settle(120)
      const foot = rail().querySelector('.desk-rail__foot')
      expect(Math.round(foot.getBoundingClientRect().bottom)).toBe(window.innerHeight)
      expect(rail().scrollHeight).toBe(rail().clientHeight)
      const list = rail().querySelector('.desk-rail__gates')
      expect(getComputedStyle(list).overflowY).toBe('auto')
    } finally {
      await page.viewport(1100, 800)
    }
  })

  it('wears no line\'s pigment: the rail is chrome', async () => {
    await mountShell('/practice')
    await settle()
    // Every --line-* token, resolved to the colour it paints.
    const names = new Set()
    for (const sheet of document.styleSheets) {
      let rules
      try { rules = sheet.cssRules } catch { continue }
      for (const rule of rules) {
        if (rule.selectorText !== ':root' || !rule.style) continue
        for (const prop of rule.style) if (prop.startsWith('--line-')) names.add(prop)
      }
    }
    expect(names.size).toBeGreaterThan(5)
    const probe = document.createElement('span')
    document.body.appendChild(probe)
    const pigments = new Set([...names].map(n => {
      probe.style.color = `var(${n})`
      return getComputedStyle(probe).color
    }))
    // The pass at the foot (plan 127) is the learner's object, not the
    // rail's: it wears the pass's metal, whose hex 辞書's pigment shares
    // (DESIGN.md, "The test is the object, not the hex"). That one value
    // is the pass's inside the card, and a line's everywhere else.
    probe.style.color = 'var(--accent2)'
    const metal = getComputedStyle(probe).color
    probe.remove()
    for (const el of [rail(), ...rail().querySelectorAll('*')]) {
      const cs = getComputedStyle(el)
      const onPass = el.closest('.desk-pass') != null
      for (const c of [cs.color, cs.backgroundColor, cs.borderTopColor, cs.borderLeftColor]) {
        if (onPass && c === metal) continue
        expect(pigments.has(c), `${el.className} ${c}`).toBe(false)
      }
    }
  })

  it('leaves the desk on a run, as the phone\'s chrome does', async () => {
    await mountShell('/learn/kana/hiragana/flashcard')
    await settle()
    expect(rail()).toBeNull()
    expect(document.querySelector('.phone').className).toBe('phone phone--stage')
    expect(document.documentElement.dataset.chrome).toBe('stage')
  })
})
