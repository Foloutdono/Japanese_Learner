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
  // The fare gate's gold fill is deliberately NOT in this matrix: the
  // contract would pair it with the soft panel ink too, and nothing on
  // that fill may ever use the soft ink (it measures 2.33:1 there —
  // the 60%-gold ruling carries the FULL panel ink only). The real
  // pairs are measured as call sites: .gc-depart-jp / .gc-depart-latin.
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

    {/* GateCard.jsx -- the fare gate on --surface, its lane tint, and
        the gold depart action (the wall-map redesign's one fill) */}
    <div className="gate-card">
      <span className="gate-card__latin gc-latin">Today</span>
      <span className="gate-card__unit gc-unit" lang="ja">件</span>
      <span className="gate-card__when gc-when">3h</span>
      <span className="gate-lane" style={{ '--lane-color': 'var(--line-kanji)' }}>
        <span className="gate-lane__where gc-where" lang="ja">漢字</span>
        <span className="gate-lane__mode gc-mode">writing</span>
      </span>
      <button type="button" className="btn-depart">
        <span className="btn-depart__jp gc-depart-jp" lang="ja">出発する</span>
        <span className="btn-depart__latin gc-depart-latin">Depart</span>
      </button>
    </div>

    {/* WallMap.jsx -- the panel-ink registers on the sumi panel: line
        captions, stop labels, due chips, group captions, facility
        chips, practice-row remarks.

        The real .board paints its sumi as a GRADIENT, and
        effectiveGround() below composites backgroundColor only -- a
        gradient contributes nothing, so without help these sites
        would measure against the PAGE and pass/fail on the wrong
        ground entirely (they reported kinari-on-washi at 1.04:1 in
        light theme). The inline colour pins the ground to the
        gradient's own midpoint token, which is what the panel
        composites to within ±3%. */}
    <div className="board" style={{ background: 'var(--bg-panel)' }}>
      <button type="button" className="wmap-line" style={{ '--line-color': 'var(--line-vocab)' }}>
        <span className="wmap-line__latin wm-latin">Vocabulary</span>
        <span className="wmap-track">
          <span className="wmap-track__label wm-stop">N5</span>
        </span>
        <span className="wmap-due wm-due">8<span className="wmap-due__unit" lang="ja">件</span></span>
      </button>
      <div className="wmap__caption">
        <span className="wmap__caption-latin wm-caption">Practice</span>
      </div>
      <button type="button" className="wmap-row" style={{ '--line-color': 'var(--line-reading)' }}>
        <span className="wmap-row__note wm-note">remark</span>
      </button>
      <button type="button" className="fac-chip" style={{ '--line-color': 'var(--line-jisho)' }}>
        <span className="fac-chip__title wm-fac">Dictionary</span>
      </button>
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

    {/* Banzuke.jsx -- the 番付 as the 定期入れ round rebuilt it: a head
        carrying the 今週/通算 toggle, then 東 and 西 sides. The selected
        segment is the ambient ink on a 14% gold wash over --surface,
        which is a mix on a mix and so invisible to part 1. */}
    <div className="banzuke">
      <div className="bz__head">
        <span className="bz__mark">
          <span className="bz__jp" lang="ja">番付</span>
        </span>
        <span className="seg">
          <button type="button" className="seg__opt bz-seg-off">
            <span className="seg__opt-jp" lang="ja">今週</span>
          </button>
          <button type="button" className="seg__opt seg__opt--on bz-seg-on">
            <span className="seg__opt-jp" lang="ja">通算</span>
          </button>
        </span>
      </div>
      <div className="bz__sides">
        <div className="bz__side">
          <div className="bz__side-head">
            <span className="bz__side-jp bz-side-jp" lang="ja">東</span>
          </div>
          <div className="leaderboard-row">
            <span className="leaderboard-row__rank">1</span>
            <span className="leaderboard-row__name">Aoi</span>
            <span className="leaderboard-row__level">Niveau 12</span>
            <span className="leaderboard-row__xp">4,210 XP</span>
          </div>
          <div className="leaderboard-row leaderboard-row__gap" aria-hidden="true">⋯</div>
        </div>
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

    {/* ── The 定期入れ profile (2026-09) ──
        Inks the contract cannot predict, because each is a color-mix
        sitting on another color-mix: the eki stamp's lacquer on its own
        lacquer wash, and a line pigment mixed toward the ambient ink on
        a bare --surface. A pair like these once shipped at 4.44:1 in
        light theme and was only caught by measuring, which is exactly
        the failure this guard exists for. */}
    <section className="sbook">
      <div className="sbook__grid">
        <span className="sbook__stamp pf-stamp">18</span>
        <span className="sbook__stamp sbook__stamp--today pf-stamp-today">31</span>
      </div>
    </section>
    {/* Both extremes of the four line pigments: 朱 is the tightest of
        them in dark theme, 松葉 in light. The roundel is the profile's
        one line-coloured ink. */}
    <div className="pf-ledger">
      <button type="button" className="pf-line" style={{ '--line-color': 'var(--line-kana)' }}>
        <span className="pf-line__roundel pf-roundel-kana">KN</span>
        <span className="pf-line__of pf-line-of">/ 896</span>
      </button>
      <button type="button" className="pf-line" style={{ '--line-color': 'var(--line-grammar)' }}>
        <span className="pf-line__roundel pf-roundel-grammar">BP</span>
      </button>
    </div>
    {/* The records' door to 統計 wears the hall's own pigment, 桜色 — the
        palest of any roundel on the profile, so it is measured too. */}
    <div className="records">
      <button type="button" className="record record--door" style={{ '--line-color': 'var(--accent8)' }}>
        <span className="pf-line__roundel pf-roundel-stats">TO</span>
      </button>
    </div>
    {/* The pass's back: sumi in both themes, pinned inline like the board
        above because the real face paints a gradient the ground-walker
        cannot composite. */}
    <div className="jour-flip__face--back" style={{ background: 'var(--bg-panel)' }}>
      <div className="jour-grid">
        <div className="jour-grid__cell">
          <span className="jour-grid__k pf-grid-k" lang="ja">種別</span>
          <span className="jour-grid__v pf-grid-v">
            10<span className="jour-grid__u pf-grid-u"> / jour</span>
          </span>
        </div>
        <div className="jour-grid__cell">
          <span className="jour-grid__v jour-grid__v--gold pf-grid-gold">1 juin 2027</span>
        </div>
      </div>
    </div>

    {/* ── Plan 063 — the goal line (onboarding board, pass, journey) ──
        The 行先 board and the 定期券/journey surfaces are sumi in both
        themes; their gold, state and gold-tint inks are exactly the
        pairs part 1's contract cannot see. Like the wall map above,
        the real panels paint gradients/shadows the ground-walker
        cannot composite, so the sumi is pinned inline to the token it
        resolves to. Status TEXT reads --jour-st-ink (the pigment
        mixed toward the panel ink — raw --danger on sumi measures
        ~2.6:1); the cars, rails and bracket lines keep the raw
        pigment, being graphics, not text. */}
    <div className="onb" data-step="goal">
      <div className="onb-board" style={{ background: 'var(--bg-panel)' }}>
        <span className="onb-board__clock ob-clock"><span lang="ja">目標</span> 2 sept. ’27</span>
        <button type="button" className="onb-board__row">
          <span className="onb-board__svc-name">
            <span className="onb-board__reco ob-reco" lang="ja">推奨</span>
          </span>
          <span className="onb-board__eta">
            2 sept. ’27
            <span className="onb-board__late ob-late" lang="ja">遅</span>
          </span>
        </button>
        <div className="onb-board__row onb-board__row--charter onb-board__row--yours">
          <span className="onb-board__pace ob-yours-pace">12</span>
        </div>
        <div className="onb-board__row onb-board__row--void">
          <span className="onb-board__pace ob-void-pace">47</span>
          <span className="onb-board__eta ob-void-eta" lang="ja">運休</span>
        </div>
        <div className="onb-board__notice">
          <p className="onb-board__notice-line ob-notice">no service</p>
        </div>
      </div>
      <button type="button" className="onb-dest__chip" aria-pressed="true">
        <span className="onb-dest__roundel ob-dest-on">N3</span>
      </button>
      <div className="onb-form">
        <button type="button" className="onb-form__chip ob-dep-on" aria-pressed="true">
          <span lang="ja">夜</span>21:00
        </button>
      </div>
      <div className="onb-ride">
        <div className="onb-ride__won">
          <span className="ob-won-body">honest rating <strong className="ob-won-strong">taken</strong></span>
        </div>
      </div>
      <div className="onb-promise jour-st--delayed" style={{ background: 'var(--bg-panel)' }}>
        <span className="onb-promise__status"><b className="ob-promise-b" lang="ja">遅延</b></span>
      </div>
      <div className="onb-pass" style={{ background: 'var(--bg-panel)' }}>
        <span className="onb-pass__v onb-pass__v--gold ob-pass-gold">2 sept. ’27</span>
      </div>
    </div>
    <div className="jour-st--delayed" style={{ background: 'var(--bg-panel)' }}>
      <div className="jour-line">
        <span className="jour-line__status"><b className="jr-status-b" lang="ja">遅延</b></span>
        <span className="jour-line__validity"><b className="jr-validity-b">2 sept. ’27</b></span>
      </div>
      <div className="jour-track">
        <span className="jour-track__span">
          <span className="jour-track__gap" style={{ left: '10%', width: '40%' }}>
            <b className="jr-gap-b">+400 jours</b>
          </span>
        </span>
      </div>
      <p className="jour-rev__error jr-error">error line</p>
    </div>
  </div>
)

const SITES = [
  ['.decks-filter-btn', 'decks/today console chip'],
  ['.decks-index-bar__count', 'decks/today console count'],
  ['.gc-latin', 'fare gate caption'],
  ['.gc-unit', 'fare gate unit'],
  ['.gc-when', 'fare gate next-review line'],
  ['.gc-where', 'gate lane name (tinted surface)'],
  ['.gc-mode', 'gate lane mode (tinted surface)'],
  ['.gc-depart-jp', 'depart button name (gold fill)'],
  ['.gc-depart-latin', 'depart button caption (gold fill)'],
  ['.wm-latin', 'map line caption (sumi)'],
  ['.wm-stop', 'map stop label (sumi)'],
  ['.wm-due', 'map due chip (sumi)'],
  ['.wm-caption', 'map group caption (sumi)'],
  ['.wm-note', 'practice row remark (sumi)'],
  ['.wm-fac', 'facility chip label (sumi)'],
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

  // Plan 063 — the goal line's sumi surfaces and tinted chips.
  ['.ob-clock', 'departure board clock (gold on sumi)'],
  ['.ob-reco', 'departure board 推奨 badge (gold on sumi)'],
  ['.ob-late', 'departure board 遅 mark (amber on sumi)'],
  ['.ob-yours-pace', 'charter row pace (kinari on gold tint)'],
  ['.ob-void-pace', 'voided charter pace (state ink on sumi)'],
  ['.ob-void-eta', 'voided charter 運休 (state ink on sumi)'],
  ['.ob-notice', '運休 notice line (amber on sumi)'],
  ['.ob-dest-on', 'chosen destination roundel (kinari on accent fill)'],
  ['.ob-dep-on', 'chosen departure chip (ink on accent tint)'],
  ['.ob-won-body', 'first-ride won line (soft ink on success tint)'],
  ['.ob-won-strong', 'first-ride won strong (ink on success tint)'],
  ['.ob-promise-b', 'promise status word (state ink on sumi)'],
  ['.ob-pass-gold', 'printed pass 有効期限 (gold on sumi)'],
  ['.jr-status-b', 'pass footer status word (state ink on sumi)'],
  ['.jr-validity-b', 'pass footer 有効期限 (gold on sumi)'],
  ['.jr-gap-b', 'ghost track day bracket (state ink on sumi)'],
  ['.jr-error', 'journey reprint error (state ink on sumi)'],

  // The 定期入れ profile — every one a mix on a mix (see the fixture).
  ['.pf-stamp', 'eki stamp day (lacquer ink on lacquer wash)'],
  ['.pf-stamp-today', "today's eki stamp (lacquer ink on denser wash)"],
  ['.pf-roundel-kana', 'ledger roundel, 朱 (line pigment mixed toward the ink)'],
  ['.pf-roundel-grammar', 'ledger roundel, 松葉'],
  ['.pf-roundel-stats', 'records door roundel, 桜 (the hall pigment mixed toward the ink)'],
  ['.pf-line-of', 'ledger reachable total'],
  ['.bz-seg-on', '番付 selected period (ambient ink on gold wash)'],
  ['.bz-seg-off', '番付 unselected period'],
  ['.bz-side-jp', '番付 東/西 side mark'],
  ['.pf-grid-k', 'pass contract key (sumi)'],
  ['.pf-grid-v', 'pass contract value (sumi)'],
  ['.pf-grid-u', 'pass contract unit (sumi)'],
  ['.pf-grid-gold', 'pass contract 有効期限 (gold on sumi)'],
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
