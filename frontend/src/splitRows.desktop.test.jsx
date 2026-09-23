import { describe, it, expect, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { userEvent } from 'vitest/browser'
import { MemoryRouter, Routes, Route, useLocation, useNavigationType } from 'react-router-dom'
import { LangProvider } from './LangContext'
import './index.css'

// ── 机 — a split's rows are links (plan 117) ─────────────────────
// On the desk a row of a StationSplit's list — a level, a kana set, a
// theme band, a tier, a grammar point, a library deck, an exam question,
// and since plan 120 a radical's tile — opens its item beside the list. It is a link to that item's URL
// (components/selection/SplitRow), so the middle click, Ctrl/⌘-click and
// "open in new tab" work, and a plain click still replaces the page in
// place. Two promises are held here: the link LOOKS like the button it
// replaced, to the pixel (index.css, the 机 block, gives the link the
// button's face), and a modified click is left to the browser. The
// screens' own tests (stations, folds, shelf, exam, session) hold where
// each link leads; the phone's side is deskfree.phone.

vi.mock('./lib/audio', async o => ({ ...(await o()), playUi: vi.fn(), playClick: vi.fn() }))
const TIERS = [1, 2, 3].map(n => ({ tier: n, start_rank: (n - 1) * 200 + 1, end_rank: n * 200, count: 200 }))
vi.mock('./lib/api', () => ({
  api: p => p,
  apiFetch: vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ tiers: TIERS }) })),
  apiJson: vi.fn(), apiJsonWithTimeout: vi.fn(), apiUpload: vi.fn(),
  ApiError: class extends Error {},
}))

const { RouteStops } = await import('./components/selection/RouteStops')
const { default: GrammarIndex } = await import('./components/selection/GrammarIndex')
const { default: TierSelector } = await import('./components/selection/TierSelector')
const { LibraryCard } = await import('./components/decks/LibraryCard')
const { RadicalGrid } = await import('./components/dictionary/RadicalIndex')
const { useLang } = await import('./LangContext')

const settle = (ms = 200) => new Promise(r => setTimeout(r, ms))
const $$ = sel => [...document.querySelectorAll(sel)]

const STOPS = [
  { key: 'N5', code: 'N5', name: 'Débutant', hint: 'Les bases', learned: 300, total: 665, started: 400, startedLabel: '400 vues' },
  { key: 'N4', code: 'N4', name: 'Élémentaire', hereLabel: 'Vous êtes ici', learned: 50, total: 632 },
  { key: 'N3', code: 'N3', name: 'Intermédiaire', hint: 'Le milieu', learned: 0, total: 1800 },
]
const POINTS = [
  { raw_id: 'wa', pattern: 'は', meaning: 'thème', stage: 'mastered' },
  { raw_id: 'ga', pattern: 'が', meaning: 'sujet', stage: 'learning' },
  { raw_id: 'mo', pattern: 'も', meaning: 'aussi', stage: 'new' },
]
const DECK = { id: 7, name: 'Voyage', type: 'standard', author: 'Aki', description: 'Les mots du voyage', card_count: 40, followers: 3 }
const RADICALS = [{ stroke_count: 3, radicals: [
  { number: 85, glyph: '氵', meaning: 'eau', count: 123, learned: 30, started: 40 },
  { number: 64, glyph: '扌', meaning: 'main', count: 90, learned: 0, started: 0 },
  { number: 61, glyph: '忄', meaning: 'cœur', count: 40, learned: 5, started: 5 },
] }]

// A split as the desk draws it, its list holding `list`.
function Split({ list, className = '' }) {
  return (
    <div className={`desk-split ${className}`}>
      <nav className="desk-split__list">{list}</nav>
      <div className="desk-split__page" />
    </div>
  )
}

function Shelf({ link }) {
  const { t } = useLang()
  return (
    <div className="platform-grid">
      <LibraryCard deck={DECK} t={t} open to={link ? '/learn/decks/library/7' : null} onOpen={() => {}} />
      <LibraryCard deck={{ ...DECK, id: 8 }} t={t} to={link ? '/learn/decks/library/8' : null} onOpen={() => {}} />
    </div>
  )
}

// The radicals index as the desk's kanji station draws it
// (RadicalSelector's tile: the meaning under the glyph, the figure).
function Radicals({ link }) {
  const { t } = useLang()
  return (
    <RadicalGrid
      groups={RADICALS}
      onPick={() => {}}
      t={t}
      order="rank"
      selected={85}
      tile={r => ({ glyph: r.glyph, sub: r.meaning, count: r.count, learned: r.learned, started: r.started > 0, title: r.meaning })}
      linkTo={link ? n => `/learn/kanji/radical/${n}` : null}
    />
  )
}

// ExamResult's ReviewRow is not exported: its markup, as a button and
// as the link the desk now draws.
function Review({ link }) {
  const Row = link ? 'a' : 'button'
  const props = link ? { href: '/practice/exam/e1/results?attempt=9&question=2' } : { type: 'button' }
  return (
    <div className="surface exam-review">
      <div className="exam-review__part">
        <div className="exam-group"><b className="exam-group__part">Partie 1</b><span className="exam-group__score">1 / 2</span></div>
        <Row {...props} className="exam-review-row" aria-current="page">
          <span className="exam-review-row__mark exam-review-row__mark--x" aria-hidden="true"><svg width="11" height="11" /></span>
          <span className="exam-review-row__q">Q2</span>
          <span className="exam-review-row__jp" lang="ja">かれはがっこうにいきます。</span>
        </Row>
      </div>
    </div>
  )
}

// Both forms of every row kind, side by side in two desk splits: the
// buttons as the desk drew them before (no URL passed), the links as it
// draws them now.
function Both({ link }) {
  const tag = link ? 'link' : 'button'
  const to = prefix => (link ? key => `${prefix}/${key}` : null)
  return (
    <div data-form={tag}>
      <Split list={<RouteStops stops={STOPS} here="N4" selected="N4" onSelect={() => {}} linkTo={to('/learn/vocab')} />} />
      <Split list={<GrammarIndex points={POINTS} selected="ga" onOpen={() => {}} linkTo={link ? id => `/learn/grammar/N4?index=1&point=${id}` : null} />} />
      <Split list={<TierSelector domain="vocab" session={null} tierSize={200} selected={2} onSelect={() => {}} linkTo={to('/learn/vocab/tier')} />} />
      <Split className="desk-split--shelf" list={<Shelf link={link} />} />
      <Split list={<Review link={link} />} />
      <Split list={<Radicals link={link} />} />
    </div>
  )
}

const ROWS = ['.route-stop', '.gl-index__row', '.platform-grid > .platform-card:not(.lib-card)', '.lib-card', '.exam-review-row', '.radical-tile']

// The same geometry on a phone-sized desk would prove nothing, so the
// splits sit in the desk's own frame, one form above the other.
async function mountBoth() {
  await render(
    <LangProvider>
      <MemoryRouter initialEntries={['/learn']}>
        <div className="phone phone--desk">
          <div className="phone__content">
            <main className="learn"><Both link={false} /><Both link /></main>
          </div>
        </div>
      </MemoryRouter>
    </LangProvider>
  )
  await settle()
}

const PROPS = [
  'display', 'box-sizing', 'font-family', 'font-size', 'font-weight', 'font-style', 'line-height', 'letter-spacing',
  'text-transform', 'text-align', 'text-decoration-line', 'color', 'background-color', 'cursor', 'filter',
  'padding-top', 'padding-right', 'padding-bottom', 'padding-left', 'border-top-width', 'border-top-style',
  'border-top-left-radius', 'outline-style', 'outline-width', 'outline-color', 'outline-offset', 'white-space',
]

// Every element of the row and everything in it, its box and its
// computed face; the differences between the two forms, by path. The
// font size is compared where it sets ink — an element with text of
// its own. A button's own size is the browser's (13.33px), which no
// token spells; a wrapper with no text of its own inherits it and does
// nothing with it, and every box beside is compared all the same.
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

function pairs(sel) {
  const buttons = $$(`[data-form="button"] ${sel}`)
  const links = $$(`[data-form="link"] ${sel}`)
  return { buttons, links }
}

describe('a split row as a link looks like the button it was', () => {
  it('draws every row kind as a link in the link form, and as a button in the other', async () => {
    await mountBoth()
    for (const sel of ROWS) {
      const { buttons, links } = pairs(sel)
      expect(buttons.length, sel).toBeGreaterThan(0)
      expect(links).toHaveLength(buttons.length)
      expect(buttons.every(b => b.tagName === 'BUTTON'), sel).toBe(true)
      expect(links.every(l => l.tagName === 'A' && l.hasAttribute('href')), sel).toBe(true)
    }
  })

  it('at rest: the same boxes and the same face, row by row', async () => {
    await mountBoth()
    for (const sel of ROWS) {
      const { buttons, links } = pairs(sel)
      buttons.forEach((b, i) => expect.soft(differences(b, links[i]), `${sel} #${i}`).toEqual([]))
    }
  })

  // The hover's end state, not its tween: the rows' transitions are
  // switched off here, so each reading is taken the moment the pointer
  // arrives rather than after waiting out 0.15s of filter per row. Ten
  // real pointer moves are still slow under a full parallel run, hence
  // the headroom on the timeout.
  it('under the pointer: the same hover', async () => {
    await mountBoth()
    const still = document.createElement('style')
    still.textContent = '[data-form] * { transition: none !important; }'
    document.head.append(still)
    const face = el => {
      const s = getComputedStyle(el)
      return { filter: s.filter, background: s.backgroundColor, color: s.color, border: s.borderTopColor }
    }
    try {
      for (const sel of ROWS) {
        const { buttons, links } = pairs(sel)
        await userEvent.hover(buttons[0])
        const hovered = face(buttons[0])
        await userEvent.hover(links[0])
        expect.soft(face(links[0]), sel).toEqual(hovered)
      }
    } finally {
      still.remove()
      await userEvent.unhover(document.body)
    }
  }, 30_000)

  it('from the keyboard: the same focus ring', async () => {
    await mountBoth()
    for (const sel of ROWS) {
      const { buttons, links } = pairs(sel)
      const ring = el => {
        el.focus()
        const s = getComputedStyle(el)
        return { visible: el.matches(':focus-visible'), style: s.outlineStyle, width: s.outlineWidth, color: s.outlineColor, offset: s.outlineOffset, background: s.backgroundColor }
      }
      await userEvent.keyboard('{Shift}')
      expect.soft(ring(links[0]), sel).toEqual(ring(buttons[0]))
    }
  })
})

describe('a modified click is the browser\'s', () => {
  const where = { path: null, type: null }
  function Probe() {
    const loc = useLocation()
    where.path = loc.pathname
    where.type = useNavigationType()
    return null
  }

  // What the router did with a click: a plain one it takes (and
  // prevents), a modified one it leaves for the browser's new tab or
  // window. The listener runs after React's (it is on window, above
  // the root) and cancels the browser's own navigation, so the test
  // runner stays on its page.
  async function clickWith(el, init) {
    let prevented = null
    const seen = e => { prevented = e.defaultPrevented; e.preventDefault() }
    window.addEventListener('click', seen, { once: true })
    el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, button: 0, ...init }))
    await settle(50)
    return prevented
  }

  it('Ctrl-, ⌘- and Shift-click leave the page where it is; a plain click replaces it', async () => {
    await render(
      <LangProvider>
        <MemoryRouter initialEntries={['/learn/vocab/N4']}>
          <Routes>
            <Route path="*" element={<Split list={<RouteStops stops={STOPS} selected="N4" onSelect={() => {}} linkTo={k => `/learn/vocab/${k}`} />} />} />
          </Routes>
          <Probe />
        </MemoryRouter>
      </LangProvider>
    )
    await settle()
    const n5 = $$('.route-stop').find(s => s.textContent.includes('N5'))
    expect(n5.getAttribute('href')).toBe('/learn/vocab/N5')
    for (const mod of [{ ctrlKey: true }, { metaKey: true }, { shiftKey: true }]) {
      expect(await clickWith(n5, mod), JSON.stringify(mod)).toBe(false)
      expect(where.path).toBe('/learn/vocab/N4')
    }
    expect(await clickWith(n5, {})).toBe(true)
    expect(where.path).toBe('/learn/vocab/N5')
    expect(where.type).toBe('REPLACE')
  })
})
