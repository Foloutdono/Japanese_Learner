import { describe, it, expect, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { userEvent } from 'vitest/browser'
import { MemoryRouter, Routes, Route, useLocation, useNavigationType } from 'react-router-dom'
import { LangProvider, useLang } from './LangContext'
import './index.css'

// ── 机 — places are links, and look like the buttons they were (plan 123, P16)
// Plan 117 made a split's rows links: a place gets a link, so the middle
// click, Ctrl/⌘-click and "open in a new tab" work. The rest of the
// desk's places were still buttons -- Settings' rows (which pushed a
// history entry per page looked at), the shelf's decks and its door to
// the library, a radical page's tiles, the way up in a bar, the
// profile's halls and its lines. On the desk each is a link now, and
// each must read exactly as the button it replaced: every link below is
// measured against a button twin -- the same classes, the same children,
// in a copy of the same container -- property by property.

vi.mock('./lib/audio', async o => ({ ...(await o()), playUi: vi.fn(), playClick: vi.fn() }))
const DECK = { id: 1, name: 'Voyage', type: 'standard', role: 'owner', card_count: 2 }
vi.mock('./lib/api', () => ({
  api: p => p,
  apiFetch: vi.fn(async path => ({ ok: true, status: 200, json: async () => (path === '/api/decks' ? { decks: [DECK, { ...DECK, id: 2, name: 'Métro' }] } : {}) })),
  apiJson: vi.fn(async () => ({})),
  apiJsonWithTimeout: vi.fn(async () => ({})),
  apiUpload: vi.fn(),
  ApiError: class extends Error {},
}))
vi.mock('./stores/today', () => ({
  useTodaySummary: () => ({ data: { total: 0, by_source: {}, lanes: [], next_due: null }, failed: false }),
  refreshToday: vi.fn(), seedTodaySummary: vi.fn(),
}))
globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) })

const { default: SettingsScreen } = await import('./screens/SettingsScreen')
const { default: DecksScreen } = await import('./screens/DecksScreen')
const { Bar, Leave } = await import('./components/chrome/Bar')
const { Records } = await import('./components/profile/ProfileBlocks')
const { LineLedger } = await import('./components/profile/LineLedger')
const { RadicalTile } = await import('./components/dictionary/RadicalIndex')

const settle = (ms = 250) => new Promise(r => setTimeout(r, ms))
const $ = s => document.querySelector(s)
const $$ = s => [...document.querySelectorAll(s)]

const PROPS = [
  'display', 'box-sizing', 'font-family', 'font-size', 'font-weight', 'font-style', 'line-height', 'letter-spacing',
  'text-transform', 'text-align', 'text-decoration-line', 'color', 'background-color', 'cursor', 'filter',
  'padding-top', 'padding-right', 'padding-bottom', 'padding-left', 'border-top-width', 'border-top-style',
  'border-top-left-radius', 'outline-style', 'white-space', 'align-items', 'justify-content',
]
const inks = el => [...el.childNodes].some(n => n.nodeType === Node.TEXT_NODE && n.textContent.trim())
function differences(a, b) {
  const out = []
  const walkPair = (x, y, path) => {
    const rx = x.getBoundingClientRect()
    const ry = y.getBoundingClientRect()
    if (Math.abs(rx.width - ry.width) > 0.5 || Math.abs(rx.height - ry.height) > 0.5) {
      out.push(`${path} box ${rx.width}×${rx.height} ≠ ${ry.width}×${ry.height}`)
    }
    const sx = getComputedStyle(x)
    const sy = getComputedStyle(y)
    for (const p of PROPS) {
      if (p === 'font-size' && !inks(x) && !inks(y)) continue
      if (sx.getPropertyValue(p) !== sy.getPropertyValue(p)) out.push(`${path} ${p}: ${sx.getPropertyValue(p)} ≠ ${sy.getPropertyValue(p)}`)
    }
    const kx = [...x.children]
    const ky = [...y.children]
    if (kx.length !== ky.length) { out.push(`${path} children ${kx.length} ≠ ${ky.length}`); return }
    kx.forEach((c, i) => walkPair(c, ky[i], `${path} > ${c.className?.baseVal ?? c.className ?? c.tagName}`))
  }
  walkPair(a, b, a.className)
  return out
}

// A copy of `container` beside it, every link in it a button with the
// same attributes and children: the phone's element, in the desk's place.
function twin(container) {
  const copy = container.cloneNode(true)
  for (const a of copy.querySelectorAll('a[href]')) {
    const b = document.createElement('button')
    b.type = 'button'
    for (const at of a.attributes) if (at.name !== 'href') b.setAttribute(at.name, at.value)
    b.innerHTML = a.innerHTML
    a.replaceWith(b)
  }
  container.after(copy)
  return copy
}
// At rest: the pointer parked on a probe in the window's corner, clear
// of every row (a test before this one may have left it over a row),
// nothing focused, and every transition out of either finished.
async function rest() {
  const corner = document.createElement('div')
  corner.style.cssText = 'position: fixed; left: 0; top: 0; width: 4px; height: 4px; z-index: 9999'
  document.body.appendChild(corner)
  await userEvent.hover(corner, { force: true })
  corner.remove()
  document.activeElement?.blur()
  // Past a hover's transition out (the halls ease 0.15s).
  await settle(300)
}
async function compare(container, sel) {
  await rest()
  const links = [...container.querySelectorAll(sel)]
  expect(links.length, sel).toBeGreaterThan(0)
  expect(links.every(l => l.tagName === 'A' && l.hasAttribute('href')), sel).toBe(true)
  const copy = twin(container)
  const buttons = [...copy.querySelectorAll(sel)]
  links.forEach((l, i) => expect.soft(differences(buttons[i], l), `${sel} #${i}`).toEqual([]))
  copy.remove()
}

// Where the router stands, and how it got there: a PUSH is a new entry
// for Back, a REPLACE is not.
const here = { path: null, type: null }
function Probe() {
  here.path = useLocation().pathname
  here.type = useNavigationType()
  return null
}

function Page({ at, path = '*', children }) {
  return (
    <LangProvider>
      <MemoryRouter initialEntries={[at]}>
        <div className="phone phone--desk">
          <div className="phone__content">
            <Routes><Route path={path} element={children} /></Routes>
          </div>
        </div>
        <Probe />
      </MemoryRouter>
    </LangProvider>
  )
}

describe('Settings\' rows on the desk', () => {
  it('are links that replace the page beside them, one tab stop, with no ›', async () => {
    await render(<Page at="/profile/settings/sound" path="/profile/settings/:page"><SettingsScreen session={{ access_token: 't', user: { email: 'a@b.c' } }} /></Page>)
    await settle()
    const rows = $$('.desk-settings__list .stg-row[data-page]:not([data-page="pass"])')
    expect(rows.every(r => r.tagName === 'A')).toBe(true)
    expect(rows.map(r => r.getAttribute('href'))).toContain('/profile/settings/display')
    expect(rows.filter(r => r.tabIndex === 0).map(r => r.dataset.page)).toEqual(['sound'])
    expect(getComputedStyle($('.desk-settings__list .stg-row[data-page="sound"] .stg-row__chev')).display).toBe('none')
    await compare($('.desk-settings__list .stg-list'), '.stg-row[data-page]:not([data-page="pass"])')
  })

  it('opens three pages with no entry for Back, walked with ↑/↓, with the button\'s hover and ring', async () => {
    await render(<Page at="/profile/settings/sound" path="/profile/settings/:page"><SettingsScreen session={{ access_token: 't', user: { email: 'a@b.c' } }} /></Page>)
    await settle()
    const row = page => $(`.desk-settings__list .stg-row[data-page="${page}"]`)
    for (const page of ['display', 'data', 'account']) {
      await userEvent.click(row(page))
      await settle(150)
      expect(here.path).toBe(`/profile/settings/${page}`)
      expect(here.type).toBe('REPLACE')
    }
    expect(row('account').tabIndex).toBe(0)
    expect(row('sound').tabIndex).toBe(-1)
    row('account').focus()
    await userEvent.keyboard('{ArrowUp}')
    expect(document.activeElement).toBe(row('data'))
    await userEvent.keyboard('{Home}')
    expect(document.activeElement).toBe(row('display'))
    // Moving is focus only; Space opens, as on a split's row.
    expect(here.path).toBe('/profile/settings/account')
    await userEvent.keyboard(' ')
    await settle(150)
    expect(here.path).toBe('/profile/settings/display')
    expect(here.type).toBe('REPLACE')
    // The ring a button draws, and the hover it keeps.
    await userEvent.keyboard('{ArrowDown}')
    const ring = getComputedStyle(row('sound'))
    expect(document.activeElement).toBe(row('sound'))
    expect([ring.outlineStyle, ring.outlineWidth]).toEqual(['solid', '2px'])
    await userEvent.hover(row('learning'))
    await settle(250)
    expect(getComputedStyle(row('learning')).filter).toBe('brightness(1.15)')
  })
})

describe('the shelf\'s decks and its library door on the desk', () => {
  it('are links that look like the buttons they were', async () => {
    await render(<Page at="/learn/decks"><DecksScreen session={{}} /></Page>)
    await settle(400)
    const cards = $$('.platform-grid > .deck-card')
    expect(cards.map(c => c.getAttribute('href'))).toEqual(['/learn/decks/1', '/learn/decks/2'])
    await compare($('.platform-grid'), '.deck-card')
    expect($('.decks-doors > a.chip').getAttribute('href')).toBe('/learn/decks/library')
    await compare($('.decks-doors'), 'a.chip, button.chip')
    // A deck is left for, not opened beside the shelf: Back comes back.
    await userEvent.click(cards[1])
    await settle(150)
    expect([here.path, here.type]).toEqual(['/learn/decks/2', 'PUSH'])
  })
})

describe('the way up, the halls and the lines on the desk', () => {
  function Profile() {
    const { t } = useLang()
    return (
      <main className="profile">
        <Bar title="Thèmes" aside={<Leave to="/learn/vocab/themes">Thèmes</Leave>} />
        <span className="bar__aside"><Leave to="/learn/kana">Syllabaires</Leave></span>
        <Records profile={{ totalReviews: 3 }} t={t} navigate={() => {}} />
        <LineLedger stats={null} t={t} navigate={() => {}} />
      </main>
    )
  }
  it('are links that look like the buttons they were', async () => {
    await render(<Page at="/profile"><Profile /></Page>)
    await settle()
    const up = $$('.stage__leave')
    expect(up.map(u => u.getAttribute('href'))).toEqual(['/learn/vocab/themes', '/learn/kana'])
    for (const u of up) await compare(u.parentElement, '.stage__leave')
    expect($$('.record--door').every(d => d.tagName === 'A')).toBe(true)
    await compare($('.record--door').parentElement, '.record--door')
    await compare($('.pf-ledger'), '.pf-line')
  })
})

describe('a radical page\'s tiles on the desk', () => {
  it('are links that look like the buttons they were', async () => {
    await render(
      <Page at="/learn/kanji/radical/9">
        <div className="desk-split">
          <nav className="desk-split__list">
            <div className="radical-page"><div className="radical-page__grid">
              <RadicalTile to="/learn/kanji/radical/9" glyph="亻" sub="personne" count={10} learned={3} started current onPick={() => {}} />
              <RadicalTile to="/learn/kanji/radical/85" glyph="氵" sub="eau" count={12} onPick={() => {}} />
            </div></div>
          </nav>
        </div>
      </Page>
    )
    await settle()
    expect($$('.radical-tile').map(a => a.getAttribute('href'))).toEqual(['/learn/kanji/radical/9', '/learn/kanji/radical/85'])
    await compare($('.radical-page__grid'), '.radical-tile')
  })
})
