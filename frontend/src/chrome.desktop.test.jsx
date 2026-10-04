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
    // The mark (plan 158), named as the text was, in the text's box:
    // 1em square at the glyph's rung.
    const mark = glyph.querySelector('svg.mark')
    expect(mark.getAttribute('aria-label')).toBe('辻')
    const em = parseFloat(getComputedStyle(glyph).fontSize)
    expect(mark.getBoundingClientRect().width).toBeCloseTo(em, 1)
    expect(mark.getBoundingClientRect().height).toBeCloseTo(em, 1)
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

  it("draws the stations' line from the first stop to the last and no further", async () => {
    await mountShell('/learn')
    await settle()
    const rows = [...document.querySelectorAll('.desk-rail__stations > li')]
    const line = li => getComputedStyle(li, '::before')
    const half = li => li.getBoundingClientRect().height / 2
    expect(parseFloat(line(rows[0]).top)).toBeCloseTo(half(rows[0]), 0)
    expect(parseFloat(line(rows.at(-1)).bottom)).toBeCloseTo(half(rows.at(-1)), 0)
    // In between, each row's segment meets the next.
    expect(line(rows[1]).top).toBe('0px')
    expect(line(rows[1]).bottom).toBe('0px')
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
    // The profile draws no Settings door on the desk (plan 143): the
    // guide's Settings stop stands on this station instead, and its
    // Statistics stop on the one beside it.
    expect(stations().map(s => s.dataset.guide)).toEqual(['profile.stats', 'profile.settings'])
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

  // ── 定期入れ — the learner's card in its holder (plans 127, 173) ──
  // Plan 127 set the HUD's three instruments at the foot as one card,
  // the learner's pass. Plan 173 drew the pass as the learner's card,
  // and the foot is the holder it is carried in: the card's top edge out
  // of its mouth, and on the case the HUD's three doors and their
  // anchors -- the climb, the balance and the journey -- the case's edge
  // the balance's.
  const holder = () => rail().querySelector('.desk-holder')
  const CONTRACT = {
    goalLevel: 'N4', goalTargetDate: '2027-03-14', goalSetAt: '2026-09-01T00:00:00Z',
    plannedPerDay: 10, itemsTotal: 1000, itemsDone: 100, actual14: 14, days14: 14,
  }

  it.each(['fr', 'en'])('prints a journey with no drift -- its word alone -- whole on the case (%s)', async lang => {
    // Suspended (nothing done in 14 days) has no days to print, so the
    // stub prints the word in the figure's place; "Suspendu" and
    // "Suspended" were cut at the case's edge (the stub's column was
    // sized for "+89 j").
    localStorage.setItem('lang', lang)
    try {
      journeyRef.current = { ...CONTRACT, actual14: 0 }
      creditsRef.current = { balance: 26, cap: 50, dailyRefill: 30, nextCreditAt: new Date(Date.now() + 3600e3).toISOString(), unlimited: false, plan: 'free' }
      await mountShell()
      await settle()
      const stub = holder().querySelector('[data-guide="hud.status"]')
      expect(stub.classList.contains('desk-holder__st--suspended')).toBe(true)
      const b = stub.querySelector('b')
      expect.soft(b.scrollWidth).toBeLessThanOrEqual(stub.clientWidth)
      const s = stub.getBoundingClientRect()
      expect.soft(b.getBoundingClientRect().right).toBeLessThanOrEqual(s.right - 8)
      for (const el of holder().querySelector('[data-guide="hud.pass"]').children) {
        expect.soft(el.getBoundingClientRect().right, el.className).toBeLessThanOrEqual(s.left + 0.5)
      }
    } finally {
      localStorage.removeItem('lang')
    }
  })

  it('carries the learner\'s card in its holder at its foot, the HUD\'s three doors on the case', async () => {
    journeyRef.current = CONTRACT
    creditsRef.current = { balance: 34, cap: 50, dailyRefill: 30, nextCreditAt: null, unlimited: false, plan: 'free' }
    await mountShell()
    await settle()
    const foot = rail().querySelector('.desk-rail__foot')
    expect(foot.children).toHaveLength(1)
    expect(foot.firstElementChild).toBe(holder())
    // One object: every door on the case, none outside it.
    for (const anchor of ['hud.level', 'hud.status', 'hud.pass']) {
      expect(foot.querySelectorAll(`[data-guide="${anchor}"]`), anchor).toHaveLength(1)
      expect(holder().querySelector(`[data-guide="${anchor}"]`).tagName, anchor).toBe('BUTTON')
    }
    // The card's real face, its top edge alone out of the mouth: the
    // free card, its struck 辻 filled to the climb.
    const card = holder().querySelector('.desk-holder__card')
    expect(card.querySelector('.pcard.pcard--free')).not.toBeNull()
    expect(Math.round(card.getBoundingClientRect().height)).toBe(60)
    expect(getComputedStyle(card).overflow).toBe('hidden')
    // The climb: 1200 xp between 1000 and 1500.
    const level = holder().querySelector('[data-guide="hud.level"]')
    expect(level.querySelector('.desk-holder__level').textContent).toMatch(/^12\s+200 \/ 500$/)
    expect(level.querySelector('.desk-holder__mark').style.getPropertyValue('--ofr-xp')).toBe('0.4')
    expect(level.querySelector('.desk-holder__track i').style.getPropertyValue('--holder-xp')).toBe('0.4')
    expect(level.getAttribute('aria-label')).toMatch(/12.*200 \/ 500/)
    expect(level.title).toMatch(/12$/)
    // The balance beside the journey, in one row under the climb.
    const purse = holder().querySelector('[data-guide="hud.pass"]')
    const stub = holder().querySelector('[data-guide="hud.status"]')
    const p = purse.getBoundingClientRect()
    const st = stub.getBoundingClientRect()
    expect(Math.round(p.top)).toBe(Math.round(st.top))
    expect(p.top).toBeGreaterThanOrEqual(level.getBoundingClientRect().bottom - 1)
    expect(st.left).toBeGreaterThanOrEqual(p.right - 1)
    // The journey prints its drift over its word, and says both.
    expect(stub.classList.contains('desk-holder__st--delayed')).toBe(true)
    expect(stub.querySelector('b').textContent).toMatch(/\d/)
    const word = stub.querySelector('em').textContent
    expect(word.length).toBeGreaterThan(0)
    expect(stub.getAttribute('aria-label')).toContain(word)
    // The case stands as far in from the rail's edges as from its floor.
    const box = holder().querySelector('.desk-holder__case').getBoundingClientRect()
    const r = rail().getBoundingClientRect()
    const inset = Math.round(box.left - r.left)
    expect(inset).toBeGreaterThan(0)
    expect(Math.round(r.left + rail().clientWidth - box.right)).toBe(inset)
    expect(Math.round(window.innerHeight - box.bottom)).toBe(inset)
    // At the foot: under the last gate, on the rail's bottom edge.
    const last = gates().at(-1).getBoundingClientRect()
    expect(foot.getBoundingClientRect().top).toBeGreaterThan(last.bottom)
    expect(Math.round(foot.getBoundingClientRect().bottom)).toBe(window.innerHeight)
  })

  // The profile and Settings print the whole card: there it is out of
  // the holder, and the mouth says so, so it is never drawn twice.
  it('leaves its mouth empty where the page prints the card, saying where it went', async () => {
    // Each mount stands beside the one before it: read the newest.
    const latest = () => [...document.querySelectorAll('.desk-holder')].at(-1)
    for (const path of ['/profile', '/profile/settings/level']) {
      await mountShell(path)
      await settle()
      expect(latest().classList.contains('desk-holder--away'), path).toBe(true)
      expect(latest().querySelector('.desk-holder__card'), path).toBeNull()
      expect(latest().querySelector('.desk-holder__slot').textContent, path).toBe('Sur la page')
      expect(latest().querySelector('[data-guide="hud.level"]'), path).not.toBeNull()
    }
    await mountShell('/learn')
    await settle()
    expect(latest().classList.contains('desk-holder--away')).toBe(false)
    expect(latest().querySelector('.desk-holder__card .pcard')).not.toBeNull()
  })

  // The guide centres each stop's anchor in view (Guide.jsx), and the
  // journey is Today's third on the desk. Plan 127's card, clipped with
  // `hidden`, was a scroll container and scrolled inside itself; the
  // case must not be one.
  it('keeps the case in place when the guide centres its journey', async () => {
    journeyRef.current = CONTRACT
    creditsRef.current = { balance: 34, cap: 50, dailyRefill: 30, nextCreditAt: null, unlimited: false }
    await mountShell()
    await settle()
    const level = holder().querySelector('[data-guide="hud.level"]')
    const stub = holder().querySelector('[data-guide="hud.status"]')
    const top = level.getBoundingClientRect().top
    stub.scrollIntoView({ block: 'center', inline: 'nearest' })
    expect(holder().scrollTop).toBe(0)
    expect(holder().querySelector('.desk-holder__case').scrollTop).toBe(0)
    expect(level.getBoundingClientRect().top).toBe(top)
  })

  // The balance, at a figure, at five or fewer and spent. The case's
  // edge is the balance's; spent, the caption says when it comes back
  // rather than what it counts.
  const note = () => rail().querySelector('.desk-holder__cr em')
  const edge = () => getComputedStyle(rail().querySelector('.desk-holder__case')).borderTopColor
  const fig = () => rail().querySelector('.desk-holder__fig')
  // A value as the rail resolves it, for a colour-mix the browser
  // prints in its own notation.
  const resolved = (value, prop = 'borderTopColor') => {
    const probe = document.createElement('span')
    probe.className = holder().className
    if (prop === 'color') probe.style.color = value
    else probe.style.borderTop = `1px solid ${value}`
    rail().appendChild(probe)
    const c = getComputedStyle(probe)[prop]
    probe.remove()
    return c
  }
  const PLAIN_EDGE = 'rgba(255, 255, 255, 0.1)'
  const LOW_EDGE = 'color-mix(in srgb, var(--warning) 70%, transparent)'
  const OUT_EDGE = 'color-mix(in srgb, var(--danger) 70%, var(--text-on-panel))'
  const purseAt = async (balance, nextCreditAt = null) => {
    creditsRef.current = { balance, cap: 50, dailyRefill: 30, nextCreditAt, unlimited: false, plan: 'free' }
    await mountShell()
    await settle()
  }

  it('says what the balance counts, in the card\'s ink, on a plain edge', async () => {
    await purseAt(34)
    expect(fig().textContent).toBe('34/50')
    expect(note().textContent).toBe('crédits')
    expect(edge()).toBe(resolved(PLAIN_EDGE))
    expect(getComputedStyle(fig()).color).toBe(resolved('var(--holder-ink)', 'color'))
  })

  it('warns on its edge at five or fewer, the figure keeping the card\'s ink', async () => {
    await purseAt(4)
    expect(holder().classList.contains('desk-holder--low')).toBe(true)
    expect(edge()).toBe(resolved(LOW_EDGE))
    expect(edge()).not.toBe(resolved(PLAIN_EDGE))
    expect(getComputedStyle(fig()).color).toBe(resolved('var(--holder-ink)', 'color'))
  })

  // Spent, it names the hour the refill lands its next credit (plan
  // 141) -- on the learner's clock, so the expectation is read off it.
  it('says when a spent balance comes back, edge and figure in the danger\'s ink', async () => {
    const at = '2026-09-07T14:48:00+00:00'
    await purseAt(0, at)
    const clock = new Intl.DateTimeFormat('fr', { hour: '2-digit', minute: '2-digit' }).format(new Date(at))
    expect(holder().classList.contains('desk-holder--out')).toBe(true)
    expect(edge()).toBe(resolved(OUT_EDGE))
    expect(getComputedStyle(fig()).color).not.toBe(resolved('var(--holder-ink)', 'color'))
    expect(note().textContent).toBe(`+1 à ${clock}`)
    expect(holder().querySelector('[data-guide="hud.pass"]').getAttribute('aria-label')).toContain(`+1 à ${clock}`)
  })

  it('draws ∞ on a plan without a ceiling, on the Max card', async () => {
    creditsRef.current = { balance: null, cap: 50, unlimited: true, plan: 'pass' }
    await mountShell()
    await settle()
    expect(holder().classList.contains('desk-holder--max')).toBe(true)
    expect(holder().querySelector('.desk-holder__card .pcard--max')).not.toBeNull()
    expect(holder().querySelector('.desk-holder__fig--inf .pinf')).not.toBeNull()
    expect(note().textContent.length).toBeGreaterThan(0)
  })

  it('prints no figure and no caption before the balance arrives, nor a journey with no contract', async () => {
    await mountShell()
    await settle()
    expect(holder().querySelector('.desk-holder__fig')).toBeNull()
    expect(note()).toBeNull()
    expect(holder().querySelector('[data-guide="hud.status"]')).toBeNull()
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
    // The card in the holder (plan 173) is the learner's object, not the
    // rail's: the free card's band is its own --pass-band, whose hex the
    // vocab line's pigment shares, and the holder's figures wear the
    // card's ink, as plan 127's pass wore its metal (DESIGN.md, "The
    // test is the object, not the hex"). Those values are the card's
    // inside the holder, and a line's everywhere else.
    const own = new Set(['var(--accent2)', 'var(--pass-band)'].map(v => {
      probe.style.color = v
      return getComputedStyle(probe).color
    }))
    probe.remove()
    for (const el of [rail(), ...rail().querySelectorAll('*')]) {
      const cs = getComputedStyle(el)
      const onCard = el.closest('.desk-holder') != null
      for (const c of [cs.color, cs.backgroundColor, cs.borderTopColor, cs.borderLeftColor]) {
        if (onCard && own.has(c)) continue
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
