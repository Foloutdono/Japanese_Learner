import { describe, it, expect } from 'vitest'
import { render } from 'vitest-browser-react'
import './index.css'
import baseline from './design-contrast.json'

/* Guard 4: contrast.
 *
 * DESIGN.md, "The primary button": the button shipped at 3.48:1 and every
 * guard and every test passed, because *nothing in the app checked contrast*.
 * This is that check.
 *
 * It lives in the browser lane, not in `frontend/scripts/`, and that is the
 * whole point. The other two guards are source-level text scans, which is
 * right for "is this literal on the scale" but cannot answer "what colour is
 * this". Every ground in this sheet is a color-mix() over tokens --
 * `--surface` is `color-mix(in srgb, var(--text-primary) 4%, var(--bg-card))`,
 * the Today strip is `color-mix(in srgb, var(--accent2) 7%, var(--bg-panel))`
 * -- and Chrome serialises those as `color(srgb ...)`, not `rgb()`. A script
 * that parsed the CSS text would have to reimplement CSS Color 4 mixing to
 * find out what is actually on screen, and a guard that gets that subtly
 * wrong is worse than no guard: it is the 3.48:1 button passing again.
 *
 * So: real Chromium resolves the colour, a real canvas paint composites it,
 * and the pixel that comes back is the one the user sees.
 *
 * Two parts, because there are two distinct ways to fail:
 *
 *   1. THE CONTRACT. Ambient inks (--text-primary/--text-secondary) belong on
 *      paper/card grounds; panel inks (--text-on-panel/-soft) belong on sumi.
 *      This part measures those intended pairings. It catches a *token* drift
 *      -- someone deepens --bg-card-hover and pushes the pair under the floor.
 *
 *   2. THE SITES. Part 1 cannot catch a rule that puts the WRONG ink on a
 *      ground, because the pair it forms is not in the contract at all. That
 *      is a real defect class here: the Today strip is sumi in both themes,
 *      and it used the ambient --text-secondary, which flips dark in light
 *      theme and landed at 2.80:1. So part 2 renders real markup and walks
 *      real ancestors, compositing every background it meets.
 *
 * Ratcheted like the other guards, against design-contrast.json's `allow`:
 * a pair below the floor must be listed with its recorded ratio, may never
 * get worse, and must be REMOVED once it clears the floor. Nothing may be
 * added to `allow` without a note saying why.
 */

const FLOOR = baseline.floor

// ── measurement ──────────────────────────────────────────────
const canvas = document.createElement('canvas')
canvas.width = 4
canvas.height = 4
const ctx = canvas.getContext('2d', { willReadFrequently: true })

const toLinear = (c) => {
  const s = c / 255
  return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
}
const luminance = ([r, g, b]) =>
  0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b)
function contrast(fg, bg) {
  const a = luminance(fg)
  const b = luminance(bg)
  const [hi, lo] = a > b ? [a, b] : [b, a]
  return (hi + 0.05) / (lo + 0.05)
}
const hex = ([r, g, b]) =>
  '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')

function readPixel() {
  const d = ctx.getImageData(1, 1, 1, 1).data
  return [d[0], d[1], d[2]]
}
// Paint `over` on `under` and read back the composited pixel. Going through a
// real paint is what makes color-mix() and alpha both come out right.
function over(under, ink) {
  ctx.clearRect(0, 0, 4, 4)
  ctx.fillStyle = under
  ctx.fillRect(0, 0, 4, 4)
  if (ink) {
    ctx.fillStyle = ink
    ctx.fillRect(0, 0, 4, 4)
  }
  return readPixel()
}
// Resolve any CSS colour expression in the theme currently on <html>.
function resolve(expr, backdrop) {
  const el = document.createElement('div')
  el.style.color = expr
  document.body.appendChild(el)
  const serialised = getComputedStyle(el).color
  el.remove()
  return over(backdrop, serialised)
}

/* Theme flips must settle before anything is read. .decks-filter-btn
 * transitions `color` and .next-service transitions `background`, so a
 * measurement taken straight after the flip reads a mid-animation colour and
 * reports a ratio that is not on screen at any resting moment. */
const STILL = '*,*::before,*::after{transition:none !important;animation:none !important}'
function setTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme)
  let st = document.getElementById('contrast-guard-still')
  if (!st) {
    st = document.createElement('style')
    st.id = 'contrast-guard-still'
    document.head.appendChild(st)
  }
  st.textContent = STILL
}

const THEMES = ['dark', 'light']

// ── part 1: the contract ─────────────────────────────────────
// --bg-panel is dark in BOTH themes and --text-on-panel(-soft) never flip, so
// sumi is its own closed system; the ambient inks are the ones that flip.
const AMBIENT_INKS = ['--text-primary', '--text-secondary']
const AMBIENT_GROUNDS = ['--bg-main', '--bg-card', '--surface', '--bg-card-hover']
const PANEL_INKS = ['--text-on-panel', '--text-on-panel-soft']
const PANEL_GROUNDS = [
  ['--bg-panel', 'var(--bg-panel)'],
  // The Today strip paints its own sumi tint rather than the bare token.
  ['next-service tint', 'color-mix(in srgb, var(--accent2) 7%, var(--bg-panel))'],
]

function contractPairs() {
  const pairs = []
  for (const ink of AMBIENT_INKS) {
    for (const g of AMBIENT_GROUNDS) pairs.push([ink, g, `var(${g})`])
  }
  for (const ink of PANEL_INKS) {
    for (const [name, expr] of PANEL_GROUNDS) pairs.push([ink, name, expr])
  }
  return pairs
}

// ── part 2: the sites ────────────────────────────────────────
/* Real markup, copied from the components named beside each block. These are
 * the places where an ink meets a ground that part 1 cannot predict. */
const Fixture = () => (
  <div className="container">
    {/* DecksScreen.jsx:139 / TodayScreen -- the shared console, on --surface */}
    <div className="decks-console">
      <div className="decks-console__top">
        <div className="decks-filter-row">
          <button className="decks-filter-btn">ALL</button>
        </div>
      </div>
      <div className="decks-index-bar">
        <input className="decks-index-bar__input" placeholder="search" />
        <div className="decks-index-bar__count">12 DECKS</div>
      </div>
    </div>

    {/* NextService.jsx:105 -- the plain strip, sumi in BOTH themes */}
    <button type="button" className="next-service">
      <span className="next-service__head">
        <span className="next-service__name">
          <span className="next-service__jp ns-plain-jp" lang="ja">本日の運行</span>
          <span className="next-service__latin ns-plain-latin">Today</span>
        </span>
      </span>
      <span className="next-service__when ns-plain-when">3h</span>
    </button>

    {/* NextService.jsx:77 -- the --clear strip is background: transparent,
        so the SAME child rules sit on the page ground instead. */}
    <div className="next-service next-service--clear">
      <span className="next-service__name">
        <span className="next-service__jp ns-clear-jp" lang="ja">本日の運行</span>
        <span className="next-service__latin ns-clear-latin">Today</span>
      </span>
    </div>

    {/* --surface cards carrying secondary text */}
    <div className="station-sign">
      <span className="station-sign__kana">えき</span>
      <span className="station-sign__romaji">EKI</span>
    </div>
    <div className="record">
      <span className="record__label">STREAK</span>
      <span className="record__unit">days</span>
    </div>

    {/* DictionaryScreen.jsx:313 -- the bar MUST stay wrapped in the console.
        `.dict-console .dict-index-bar` sets `background: none`, so inside the
        console the ground is the console's --surface, not the --bg-card the
        bar paints when it stands alone. Rendered bare, this measured a ground
        that appears nowhere in the app. */}
    <div className="dict-console">
      <div className="dict-index-bar">
        <input className="dict-index-bar__input" placeholder="search" />
      </div>
    </div>

    {/* PhraseScreen -- a sumi chip */}
    <div className="phrase-kanji-chip">
      <span className="phrase-kanji-chip__char">水</span>
      <span className="phrase-kanji-chip__level">N5</span>
    </div>

    {/* The rest are rules a block-level scan flagged as *possibly* putting an
        ambient ink on sumi, because somewhere in their block a rule paints
        --bg-panel. A selector cannot answer that -- only the ancestor chain
        can, and several of these turned out to be siblings of the sumi
        element rather than children. They are here so the question is
        settled by measurement and stays settled. */}

    {/* ProfileScreen.jsx:447 */}
    <div className="banzuke">
      <div className="banzuke__rows">
        <div className="leaderboard-row">
          <span className="leaderboard-row__rank">1</span>
          <span className="leaderboard-row__name">Aoi</span>
          <span className="leaderboard-row__level">Niveau 12</span>
          <span className="leaderboard-row__xp">4,210 XP</span>
        </div>
        <div className="leaderboard-row leaderboard-row__gap" aria-hidden="true">⋯</div>
      </div>
    </div>

    {/* DecksScreen.jsx:259 -- the deck shelf as plan 055 rebuilt it. The card
        carries TWO block classes, `platform-card deck-card`, and the ground
        comes from .platform-card while the inks are named on .deck-card__*.
        Guard 5 keys on one block at a time and cannot follow that, so these
        are measured here instead. */}
    <div className="platform-grid decks-grid">
      <div className="platform-card deck-card">
        <span className="platform-card__body deck-card__body">
          <span className="deck-card__text">
            <span className="platform-card__title">漢字</span>
            <span className="platform-card__desc">
              <span className="deck-card__type">Kanji</span>
            </span>
          </span>
          <span className="deck-card__actions">
            <span className="deck-card__confirm-q">Supprimer ce paquet ?</span>
            <button className="deck-card__btn deck-card__btn--muted">Annuler</button>
          </span>
        </span>
        <span className="deck-card__count">
          <span className="deck-card__count-fig">42</span>
          <span className="deck-card__count-cap">cartes</span>
        </span>
        <button className="deck-card__delete" aria-label="delete">🗑</button>
      </div>
    </div>

    {/* DecksScreen.jsx:215 -- the type chooser, also plan 055 */}
    <div className="decks-type-row">
      <button className="decks-type-btn">
        <span className="decks-type-btn__glyph" lang="ja">語</span>
        <span className="decks-type-btn__label">Vocabulaire</span>
        <span className="decks-type-btn__desc">Mots et expressions</span>
      </button>
    </div>

    {/* DeckDetailScreen.jsx:424. Plan 057 retired .deckdetail-btn and its
        four modifiers -- the toolbar is the shared button family now, so
        the quiet button this guard was measuring is a .btn-secondary. */}
    <div className="deckdetail-actions">
      <button className="btn-secondary">Sélectionner</button>
    </div>

    {/* TokenCard.jsx:60 -- reading/pos sit in the wrap, whose sumi
        background belongs to the --clickable :hover state only. */}
    <div className="card phrase-word-card">
      <div className="phrase-word-card__top">
        <div className="phrase-word-card__surface-wrap">
          <span className="phrase-word-card__surface">水</span>
          <span className="phrase-word-card__reading">(みず)</span>
          <span className="phrase-word-card__pos">noun</span>
        </div>
      </div>
    </div>

    {/* ReadingComprehensionScreen.jsx:264 */}
    <div className="comp-options">
      <button className="comp-option-btn">
        <span className="comp-option-btn__letter">A.</span>
        answer
      </button>
    </div>
  </div>
)

const SITES = [
  ['.decks-filter-btn', 'decks/today console chip'],
  ['.decks-index-bar__count', 'decks/today console count'],
  ['.ns-plain-jp', 'today strip, name (sumi)'],
  ['.ns-plain-latin', 'today strip, romaji (sumi)'],
  ['.ns-plain-when', 'today strip, time (sumi)'],
  ['.ns-clear-jp', 'today strip cleared, name (paper)'],
  ['.ns-clear-latin', 'today strip cleared, romaji (paper)'],
  ['.station-sign__kana', 'station sign kana'],
  ['.station-sign__romaji', 'station sign romaji'],
  ['.record__label', 'record label'],
  ['.record__unit', 'record unit'],
  ['.phrase-kanji-chip__level', 'kanji chip level (sumi)'],
  // Placeholders are text and carry the same floor. Measured through
  // getComputedStyle's pseudo-element argument, since ::placeholder has a
  // colour of its own that the host input's computed style does not show.
  ['.decks-index-bar__input::placeholder', 'decks console search placeholder'],
  ['.dict-index-bar__input::placeholder', 'dictionary search placeholder'],

  // Settled by measurement rather than by reading a selector -- see the
  // comment beside their markup above.
  ['.leaderboard-row__level', 'leaderboard row level'],
  ['.leaderboard-row__gap', 'leaderboard elision row'],
  ['.deck-card__delete', 'deck card delete affordance'],
  ['.deck-card__btn--muted', 'deck card cancel button'],
  ['.deck-card__confirm-q', 'deck card delete question'],
  ['.btn-secondary', 'deck detail ghost button (shared family)'],
  ['.phrase-word-card__reading', 'token card reading'],
  ['.phrase-word-card__pos', 'token card part of speech'],
  ['.comp-option-btn__letter', 'comprehension option letter'],

  // Plan 055's deck shelf, merged in after the guards were written.
  ['.deck-card__count-cap', 'deck card count caption'],
  ['.deck-card__count-fig', 'deck card count figure'],
  ['.deck-card__type', 'deck card type label'],
  ['.decks-type-btn__desc', 'deck type chooser description'],
  ['.decks-type-btn__label', 'deck type chooser label'],
]

// Composite every non-transparent background from <html> down to the element.
function effectiveGround(el) {
  const stack = []
  for (let n = el; n; n = n.parentElement) stack.push(getComputedStyle(n).backgroundColor)
  ctx.clearRect(0, 0, 4, 4)
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, 4, 4)
  for (const c of stack.reverse()) {
    if (!c || c === 'rgba(0, 0, 0, 0)' || c === 'transparent') continue
    ctx.fillStyle = c
    ctx.fillRect(0, 0, 4, 4)
  }
  return readPixel()
}

/* WCAG's large-text exemption is deliberately NOT applied. Of 383 rules that
 * use a soft ink, exactly two are large enough to qualify, so honouring it
 * would buy nothing and would let a 3.2:1 heading through on a technicality. */
function judge(violations, seen, key, label, ratio, detail) {
  seen.add(key)
  const allowed = baseline.allow[key]
  if (ratio < FLOOR) {
    if (allowed === undefined) {
      violations.push(`${key}\n      ${label} measures ${ratio.toFixed(2)}:1, below the ${FLOOR}:1 floor.\n      ${detail}`)
    } else if (ratio < allowed - 0.02) {
      violations.push(`${key}\n      ${label} fell from a recorded ${allowed}:1 to ${ratio.toFixed(2)}:1.\n      ${detail}`)
    }
  } else if (allowed !== undefined) {
    violations.push(`${key}\n      ${label} now measures ${ratio.toFixed(2)}:1 and clears the floor.\n      Remove "${key}" from design-contrast.json's allow.`)
  }
}

describe('Guard 4: contrast', () => {
  it('holds the ink/ground contract in both themes', async () => {
    await render(<div />)
    const violations = []
    const seen = new Set()

    for (const theme of THEMES) {
      setTheme(theme)
      for (const [ink, groundName, groundExpr] of contractPairs()) {
        const bg = resolve(groundExpr, '#ffffff')
        const fg = resolve(`var(${ink})`, hex(bg))
        const ratio = contrast(fg, bg)
        judge(
          violations, seen,
          `${theme}|${ink}|${groundName}`,
          `${ink} on ${groundName} (${theme})`,
          ratio,
          `ink ${hex(fg)} on ground ${hex(bg)}`
        )
      }
    }
    setTheme('dark')

    const stale = Object.keys(baseline.allow).filter(
      (k) => !k.includes('@') && !seen.has(k)
    )
    for (const k of stale) {
      violations.push(`${k}\n      is in design-contrast.json's allow but no longer measured.\n      Remove it.`)
    }

    expect(violations, `\n\n${violations.length} contrast violation(s):\n\n  ${violations.join('\n\n  ')}\n\n`).toEqual([])
  })

  it('holds at the real call sites, through real ancestors', async () => {
    const screen = await render(<Fixture />)
    const root = screen.container
    const violations = []
    const seen = new Set()

    for (const theme of THEMES) {
      setTheme(theme)
      for (const [selector, label] of SITES) {
        const [host, pseudo] = selector.split('::')
        const el = root.querySelector(host)
        expect(el, `fixture is missing ${host} -- the markup drifted from the component`).toBeTruthy()
        const bg = effectiveGround(el)
        ctx.clearRect(0, 0, 4, 4)
        ctx.fillStyle = hex(bg)
        ctx.fillRect(0, 0, 4, 4)
        ctx.fillStyle = getComputedStyle(el, pseudo ? `::${pseudo}` : undefined).color
        ctx.fillRect(0, 0, 4, 4)
        const fg = readPixel()
        const ratio = contrast(fg, bg)
        judge(
          violations, seen,
          `${theme}|@${selector}`,
          `${label} (${theme})`,
          ratio,
          `ink ${hex(fg)} on effective ground ${hex(bg)}`
        )
      }
    }
    setTheme('dark')

    const stale = Object.keys(baseline.allow).filter(
      (k) => k.includes('@') && !seen.has(k)
    )
    for (const k of stale) {
      violations.push(`${k}\n      is in design-contrast.json's allow but no longer measured.\n      Remove it.`)
    }

    expect(violations, `\n\n${violations.length} contrast violation(s):\n\n  ${violations.join('\n\n  ')}\n\n`).toEqual([])
  })
})
