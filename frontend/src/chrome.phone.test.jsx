import { describe, it, expect, vi, afterEach } from 'vitest'
import { render } from 'vitest-browser-react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { LangProvider } from './LangContext'
import './index.css'

// ── The chrome's contract at phone width (plan 068) ─────────────
// The canvas's backbone, pinned against the real cascade at 390×844:
// the HUD is sumi at --hud-h over the safe-area inset with the two
// panel inks; the tab bar is five gates at --tabbar-h on the bottom
// edge with the active one in full ink under a rule and the badge
// clear of the glyph; under the shell every docked object clears the
// tab bar and on a stage it sits on the inset; the bar prints the
// section's pigment as its stripe; the sheet traps focus and closes on
// Escape. The stores behind the HUD are stubbed: this is about the
// chrome, not the feeds.

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
vi.mock('./stores/profileSummary', () => ({
  useProfileSummary: () => ({ level: 12, xp: 1200, xpPrevLevel: 1000, xpForNext: 1500, username: 'Aiko', streak: 3 }),
  useProfileSummaryState: () => ({ summary: null, failed: false }),
  refreshSummary: vi.fn(),
}))
const journeyRef = { current: null }
vi.mock('./stores/journey', () => ({
  useJourneyStatus: () => ({ data: journeyRef.current, failed: false }),
  refreshJourney: vi.fn(),
  seedJourneyStatus: vi.fn(),
  // The panel opens the status sheet (plan 074); the sheet itself is
  // not mounted here.
  openStatus: vi.fn(),
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
const { Bar } = await import('./components/chrome/Bar')
const { Sheet } = await import('./components/chrome/Sheet')

const settle = (ms = 60) => new Promise(r => setTimeout(r, ms))
const HUD_H = 48
const TABBAR_H = 50

function mountShell(path = '/today', screen = <main id="main-content">here</main>) {
  return render(
    <LangProvider>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route element={<Shell />}>
            <Route path="/today" element={screen} />
            <Route path="/learn" element={screen} />
            <Route path="/learn/decks" element={screen} />
            <Route path="/profile" element={screen} />
          </Route>
          <Route element={<StageFrame />}>
            <Route path="/learn/kana" element={screen} />
          </Route>
        </Routes>
      </MemoryRouter>
    </LangProvider>
  )
}

afterEach(() => { journeyRef.current = null })

describe('the shell', () => {
  it('stamps itself on the document and docks the content over the tab bar', async () => {
    await mountShell()
    await settle()
    expect(document.documentElement.dataset.chrome).toBe('shell')
    // Custom properties come back substituted: the tab bar's height and
    // the (zero, in chromium) inset.
    const dock = getComputedStyle(document.documentElement).getPropertyValue('--dock-bottom').replace(/\s/g, '')
    expect(dock).toBe(`calc(${TABBAR_H}px+0px)`)
    const content = document.querySelector('.phone__content')
    expect(getComputedStyle(content).paddingBottom).toBe(`${TABBAR_H}px`)
  })

  // ── The screen begins under the chrome, not against it ──
  // 8px of padding put the bar's roundel on the underside of the HUD,
  // and 12px of block rhythm put the first panel on the bar's own rule:
  // chrome, head and body read as one stack of type. 22 above the head
  // and 16 under it — less under, because a head belongs to what it
  // heads. Owner's call.
  it('sets the screen down clear of the HUD, and its body under its head', async () => {
    await mountShell('/learn', (
      <main id="main-content" className="learn">
        <Bar code="TJ" title="Plan de ligne" sub="Quatre lignes" color="var(--accent2)" />
        <div className="wmap" style={{ height: '120px' }} />
      </main>
    ))
    // Past the `arrive` animation, which lifts the screen into place —
    // measured during it, every distance here is 5px short.
    await settle(420)
    const box = s => document.querySelector(s).getBoundingClientRect()
    expect(Math.round(box('.bar').top - box('.hud').bottom)).toBe(22)
    expect(Math.round(box('.wmap').top - box('.bar__stripe').bottom)).toBe(16)
  })

  it('leaves both bars on a stage and docks on the inset', async () => {
    await mountShell('/learn/kana')
    await settle()
    expect(document.documentElement.dataset.chrome).toBe('stage')
    expect(document.querySelector('.hud')).toBeNull()
    expect(document.querySelector('.tabbar')).toBeNull()
    const note = document.createElement('div')
    note.className = 'dock-note'
    document.body.appendChild(note)
    expect(getComputedStyle(note).bottom).toBe('0px')
    note.remove()
  })
})

describe('the HUD', () => {
  it('is sumi at its height, under the notch, with the level in a roundel and the pass beside it', async () => {
    await mountShell()
    await settle()
    const hud = document.querySelector('.hud')
    const inner = hud.querySelector('.hud__inner')
    expect(getComputedStyle(inner).height).toBe(`${HUD_H}px`)
    // ── The chrome's edge, at both ends of the screen ──
    // The HUD and the tab bar are the same object: a panel the page
    // passes under. Their ground and the page's are seven values apart
    // in the dark theme, so without an edge the page continued into
    // them — and the HUD had no edge at all. One line in a cast of the
    // panel's own ink, and a shadow thrown at the content: down from
    // the HUD, up from the bar.
    const bar = document.querySelector('.tabbar')
    expect(getComputedStyle(hud).borderBottomWidth).toBe('1px')
    expect(getComputedStyle(bar).borderTopWidth).toBe('1px')
    // One declaration behind both, so they cannot drift apart.
    expect(getComputedStyle(hud).borderBottomColor)
      .toBe(getComputedStyle(bar).borderTopColor)
    // Thrown in opposite directions — the offsets are one negation.
    const off = cs => cs.boxShadow.match(/(-?\d+)px (-?\d+)px/)?.[2]
    expect(off(getComputedStyle(hud))).toBe('10')
    expect(off(getComputedStyle(bar))).toBe('-10')
    expect(getComputedStyle(hud).paddingTop).toBe('0px') // --safe-top is 0 in chromium
    expect(getComputedStyle(hud).position).toBe('sticky')
    const level = hud.querySelector('.hud__level')
    expect(level.textContent).toBe('12')
    expect(getComputedStyle(level).color).toBe(getComputedStyle(hud).color)
    expect(hud.querySelector('.hud__pass')).toBeTruthy()
    expect(hud.querySelectorAll('.hud__pass-ring')).toHaveLength(3)
    // No contract yet: no panel, and nothing pretends there is one.
    expect(hud.querySelector('.hud__status')).toBeNull()
  })

  it('prints the journey model\'s word on the station panel, with the drift', async () => {
    journeyRef.current = {
      goalLevel: 'N4', goalTargetDate: '2027-03-14', goalSetAt: '2026-09-01T00:00:00Z',
      plannedPerDay: 10, itemsTotal: 1000, itemsDone: 100, actual14: 14, days14: 14,
    }
    await mountShell()
    await settle()
    const panel = document.querySelector('.hud__status')
    expect(panel).toBeTruthy()
    // 1 a day against 10 promised: the projected arrival is far past
    // the printed one — late, by a delta the panel prints in days.
    expect(panel.classList.contains('hud__status--delayed')).toBe(true)
    expect(panel.querySelector('.hud__status-word').textContent.length).toBeGreaterThan(0)
    expect(panel.querySelector('.hud__status-delta').textContent).toMatch(/\d/)
  })
})

describe('the tab bar', () => {
  it('is five gates on the bottom edge, the active one in full ink under a rule', async () => {
    await mountShell('/learn')
    await settle()
    const bar = document.querySelector('.tabbar')
    expect(getComputedStyle(bar).position).toBe('fixed')
    expect(Math.round(bar.getBoundingClientRect().bottom)).toBe(window.innerHeight)
    const tabs = bar.querySelectorAll('.tab')
    expect(tabs).toHaveLength(5)
    expect(tabs[0].tagName).toBe('A')
    expect(getComputedStyle(tabs[0]).height).toBe(`${TABBAR_H}px`)
    const on = bar.querySelector('.tab--on')
    expect(on.getAttribute('aria-current')).toBe('page')
    expect(on.dataset.tab).toBe('learn')
    expect(getComputedStyle(on).color).toBe(getComputedStyle(bar).color)
    expect(getComputedStyle(on, '::before').height).toBe('2px')
    const off = tabs[1]
    expect(getComputedStyle(off).color).not.toBe(getComputedStyle(bar).color)
    // ── And its glyph is the bigger one ──
    // Full ink, a ground, a rule and a word already; the size is the
    // one that carries across the room. It grows about its own centre
    // inside a lozenge every gate reserves at full height, so the row
    // does not move to make space for it — pinned by the case below,
    // which measures the centres across four screens.
    const glyph = t => t.querySelector('.tab__ico svg').getBoundingClientRect().width
    expect(glyph(on)).toBeGreaterThan(glyph(off))
    expect(new Set(tabs.length && [...tabs].filter(t => t !== on).map(glyph)).size).toBe(1)
    const box = t => t.querySelector('.tab__ico').getBoundingClientRect()
    expect(Math.round(box(on).height)).toBe(Math.round(box(off).height))
    expect(glyph(on)).toBeLessThanOrEqual(box(on).height)
  })

  // ── One word, on the gate you are on ──
  // The bar set a kanji where a pictogram goes and printed the word
  // under every gate. Five gates are 78px on this phone and
  // "DICTIONNAIRE" is 94, so in French two captions printed over their
  // neighbours. The glyphs are drawn now, and only the lit gate is
  // captioned — it takes the width its word needs and the other four
  // share what is left.
  it('captions the gate you are on and no other, without taking width for it', async () => {
    await mountShell('/learn')
    await settle()
    const bar = document.querySelector('.tabbar')
    const caps = bar.querySelectorAll('.tab__cap')
    expect(caps).toHaveLength(1)
    expect(caps[0].closest('.tab').dataset.tab).toBe('learn')
    expect(caps[0].textContent.length).toBeGreaterThan(0)
    // Out of the flow: the lit gate is a fifth like every other, and
    // the word is centred on it — free to run past its own fifth,
    // because what is beside it is an unlit gate's empty half-height.
    expect(getComputedStyle(caps[0]).position).toBe('absolute')
    expect(getComputedStyle(caps[0]).whiteSpace).toBe('nowrap')
    expect(caps[0].scrollWidth).toBeLessThanOrEqual(caps[0].clientWidth)
    const gates = [...bar.querySelectorAll('.tab')]
    const widths = gates.map(g => Math.round(g.getBoundingClientRect().width))
    expect(new Set(widths).size).toBe(1)
    // Every gate keeps its word as its name, printed or not.
    for (const gate of gates) expect(gate.getAttribute('aria-label').length).toBeGreaterThan(0)
    // And the glyphs are a straight row: one line, whatever is lit.
    const tops = gates.map(g => Math.round(g.querySelector('.tab__ico').getBoundingClientRect().top))
    expect(new Set(tops).size).toBe(1)
  })

  // ── The row holds still ──
  // The lit gate used to take the width its own word needed and the
  // other four shared what was left, so every navigation re-dealt the
  // row: a glyph travelled up to 35px at 390px, and the outer two slid
  // toward the edges whenever a far gate lit. Nothing about that said
  // WHICH gate was lit — it only made the bar move.
  it('puts every glyph in the same place on every screen', async () => {
    // The five screens at once, each in its own router: a tab bar is
    // fixed to the viewport's edges, so where its glyphs sit across x
    // is the same question whether it is alone on the page or fifth in
    // a stack of them — and one render is one cleanup.
    const PATHS = ['/today', '/learn', '/learn/decks', '/profile']
    await render(
      <LangProvider>
        {PATHS.map(path => (
          <MemoryRouter key={path} initialEntries={[path]}>
            <Routes>
              <Route element={<Shell />}>
                {PATHS.map(p => <Route key={p} path={p} element={<main id="main-content">here</main>} />)}
              </Route>
            </Routes>
          </MemoryRouter>
        ))}
      </LangProvider>
    )
    await settle()
    const bars = [...document.querySelectorAll('.tabbar')]
    expect(bars).toHaveLength(PATHS.length)
    const centres = bars.map(bar => [...bar.querySelectorAll('.tab__ico')].map(ico => {
      const r = ico.getBoundingClientRect()
      return Math.round(r.left + r.width / 2)
    }))
    for (const row of centres) expect(row).toHaveLength(5)
    // Each bar lights a different gate, and every glyph is where it was.
    expect(new Set(bars.map(b => b.querySelector('.tab--on').dataset.tab)).size)
      .toBeGreaterThan(1)
    for (const row of centres) expect(JSON.stringify(row)).toBe(JSON.stringify(centres[0]))
  })

  it('carries the due count on the shoulder of Today\'s glyph, capped at 99+', async () => {
    await mountShell('/profile')
    await settle()
    const today = document.querySelector('[data-tab="today"]')
    const due = today.querySelector('.tab__due')
    expect(due.textContent).toBe('24')
    const glyph = today.querySelector('.tab__ico').getBoundingClientRect()
    const badge = due.getBoundingClientRect()
    // On the glyph's right shoulder: past its centre, inside its gate.
    expect(badge.left).toBeGreaterThan(glyph.left + glyph.width / 2)
    expect(badge.right).toBeLessThanOrEqual(today.getBoundingClientRect().right)
    // The count is in the gate's name, where the badge itself is not read.
    expect(today.getAttribute('aria-label')).toMatch(/24/)
  })

  // Three figures are wider than the gate they sit on, and 239 due
  // against 312 is not a difference anyone acts on.
  it('says 99+ rather than a third figure', async () => {
    const was = todayRef.current
    todayRef.current = { ...was, total: 239 }
    try {
      await mountShell('/profile')
      await settle()
      const today = document.querySelector('[data-tab="today"]')
      expect(today.querySelector('.tab__due').textContent).toBe('99+')
      // The real figure survives where there is room for it.
      expect(today.getAttribute('aria-label')).toMatch(/239/)
      expect(today.querySelector('.tab__due').getBoundingClientRect().right)
        .toBeLessThanOrEqual(today.getBoundingClientRect().right)
    } finally {
      todayRef.current = was
    }
  })

  it('lights the gate a nested screen is behind', async () => {
    await mountShell('/learn/decks')
    await settle()
    expect(document.querySelector('.tab--on').dataset.tab).toBe('learn')
  })
})

describe('the bar', () => {
  it('prints the roundel and the section\'s pigment as its stripe; the register form has neither', async () => {
    const screen = await render(
      <LangProvider>
        <div>
          <Bar code="KJ" title="Kanji" sub="JLPT" color="var(--line-kanji)" />
          <Bar register title="Practice" sub="Four platforms" />
        </div>
      </LangProvider>
    )
    const [plate, register] = screen.container.querySelectorAll('.bar')
    expect(plate.querySelector('.bar__roundel').textContent).toBe('KJ')
    expect(plate.querySelector('h1.bar__title').textContent).toBe('Kanji')
    const stripe = getComputedStyle(plate.querySelector('.bar__stripe'))
    expect(stripe.height).toBe('2px')
    expect(stripe.backgroundColor).toBe(getComputedStyle(plate.querySelector('.bar__roundel')).borderTopColor)
    expect(register.querySelector('.bar__roundel')).toBeNull()
    expect(getComputedStyle(register.querySelector('.bar__stripe')).height).toBe('1px')
  })

  // The canvas sets both registers on one baseline, on titles like かな.
  // A section whose name is a sentence, with a sub and a way out beside
  // it, had ~200 px for all of it at 390 and printed "Entra…".
  it('stacks the two registers on a phone, so a long name is not cut', async () => {
    const screen = await render(
      <LangProvider>
        <Bar
          code="DS"
          title="Entraînement à la lecture"
          sub="Choisissez votre source d'étude"
          color="var(--line-reading)"
          aside={<button type="button" className="bar__link">Pratique</button>}
        />
      </LangProvider>
    )
    const bar = screen.container.querySelector('.bar')
    const title = bar.querySelector('.bar__title')
    const sub = bar.querySelector('.bar__sub')
    // The sub is under the title, not beside it.
    expect(sub.getBoundingClientRect().top).toBeGreaterThanOrEqual(title.getBoundingClientRect().bottom - 2)
    // And the whole name is drawn: nothing is clipped inside the title.
    expect(title.scrollWidth).toBeLessThanOrEqual(title.clientWidth + 1)
    expect(title.textContent).toBe('Entraînement à la lecture')
  })

  // The sign wants the row's two ends, and the aside is already at one
  // of them: `Vocabulaire ... SOURCES [‹ Apprendre]` read as a label on
  // the button rather than a caption on the name.
  it('drops the sub under the title when the bar carries a way out', async () => {
    const screen = await render(
      <LangProvider>
        <div>
          <Bar code="VC" title="Vocabulaire" sub="Sources" color="var(--line-vocab)" />
          <Bar
            code="VC"
            title="Vocabulaire"
            sub="Sources"
            color="var(--line-vocab)"
            aside={<button type="button" className="bar__link">Apprendre</button>}
          />
        </div>
      </LangProvider>
    )
    const [plain, withAside] = screen.container.querySelectorAll('.bar')
    // On its own the short name keeps its sign: both registers on one
    // baseline, the caption against the right.
    const beside = plain.querySelector('.bar__sub').getBoundingClientRect()
    const besideTitle = plain.querySelector('.bar__title').getBoundingClientRect()
    expect(beside.left).toBeGreaterThan(besideTitle.right)
    // With a way out it stacks: under the title and flush with it.
    const stacked = withAside.querySelector('.bar__sub').getBoundingClientRect()
    const stackedTitle = withAside.querySelector('.bar__title').getBoundingClientRect()
    expect(stacked.top).toBeGreaterThanOrEqual(stackedTitle.bottom - 2)
    expect(Math.round(stacked.left)).toBe(Math.round(stackedTitle.left))
    // And the button still has the end to itself.
    const aside = withAside.querySelector('.bar__aside').getBoundingClientRect()
    expect(aside.left).toBeGreaterThanOrEqual(stacked.right)
  })

  // Flush by their boxes is not flush to the eye: the serif V inks the
  // box edge only at the tips of its top arms, so a caption whose S
  // hugs that edge reads ~4px left of the name. The tracking rule's
  // indent is what puts the caption back under it.
  it('indents the stacked sub by its own tracking, and only there', async () => {
    const screen = await render(
      <LangProvider>
        <div>
          <Bar code="VC" title="Vocabulaire" sub="Sources" color="var(--line-vocab)" />
          <Bar
            code="VC"
            title="Vocabulaire"
            sub="Sources"
            color="var(--line-vocab)"
            aside={<button type="button" className="bar__link">Apprendre</button>}
          />
        </div>
      </LangProvider>
    )
    const [plain, withAside] = screen.container.querySelectorAll('.bar')
    // The sign's caption is flush right; an indent there would push it
    // off its own edge, so it keeps none.
    expect(getComputedStyle(plain.querySelector('.bar__sub')).textIndent).toBe('0px')
    // The stacked one carries it, and it moves the ink, not the box.
    const sub = withAside.querySelector('.bar__sub')
    const indent = parseFloat(getComputedStyle(sub).textIndent)
    expect(indent).toBeGreaterThan(1)
    const ink = document.createRange()
    ink.selectNodeContents(sub)
    const box = sub.getBoundingClientRect()
    expect(ink.getBoundingClientRect().left - box.left).toBeCloseTo(indent, 0)
  })
})

describe('the sheet', () => {
  it('rises from the bottom edge, holds focus, and closes on Escape', async () => {
    const onClose = vi.fn()
    await render(
      <LangProvider>
        <button type="button" id="opener">open</button>
        <Sheet open onClose={onClose} jp="残高" cap="Balance">
          <button type="button" id="first">one</button>
          <button type="button" id="last">two</button>
        </Sheet>
      </LangProvider>
    )
    await settle()
    const sheet = document.querySelector('.sheet')
    expect(sheet.getAttribute('role')).toBe('dialog')
    expect(getComputedStyle(sheet).position).toBe('fixed')
    expect(Math.round(sheet.getBoundingClientRect().bottom)).toBe(window.innerHeight)
    expect(document.querySelector('.scrim')).toBeTruthy()
    expect(sheet.contains(document.activeElement)).toBe(true)
    document.activeElement.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
