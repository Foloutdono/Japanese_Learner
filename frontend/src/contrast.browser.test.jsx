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
    {/* DecksScreen.jsx -- the shared console (components/chrome/Console),
        on --surface: a chip, the index field, the count */}
    <div className="console">
      <div className="console__top">
        <div className="console__chips">
          <button type="button" className="chip dk-chip">ALL</button>
        </div>
      </div>
      <div className="console__index">
        <input className="console__field dk-field" placeholder="search" />
        <span className="console__count dk-count">12 DECKS</span>
      </div>
    </div>

    {/* GateCard.jsx -- the fare gate on --surface, its lane tint, and
        the gold depart action (the wall-map redesign's one fill) */}
    <div className="gate-card">
      <span className="gate-card__title gc-latin">Fare gate</span>
      <span className="gate-card__unit gc-unit">due</span>
      <span className="gate-card__when gc-when">3h</span>
      <button type="button" className="lane" style={{ '--lane-color': 'var(--line-kanji)' }}>
        <span className="lane__where gc-where">Kanji N4</span>
        <span className="lane__mode gc-mode">writing</span>
      </button>
      <button type="button" className="btn-depart">
        <span className="btn-depart__jp gc-depart-jp">Depart</span>
        <span className="btn-depart__go gc-depart-latin" aria-hidden="true">▶</span>
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
      <button type="button" className="wmap-row" style={{ '--line-color': 'var(--line-decks)' }}>
        <span className="wmap-row__latin wm-note">3 decks · 214 cards</span>
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

    {/* DecksScreen.jsx -- the shelf's card (plan 071): the count aside
        and today's due count on the platform card's surface */}
    <div className="platform-grid">
      <button type="button" className="platform-card deck-card" style={{ '--line-color': 'var(--line-kanji)' }}>
        <span className="platform-card__lead deck-card__lead">
          <span className="wmap-roundel deck-card__glyph dk-glyph" lang="ja">漢</span>
        </span>
        <span className="platform-card__body">
          <span className="platform-card__title">漢字</span>
          <span className="platform-card__desc">Kanji · <span className="deck-card__due dk-due">2 due</span></span>
        </span>
        <span className="platform-card__aside deck-card__aside">
          <span className="deck-card__count"><b className="deck-card__fig">42</b><span className="deck-card__unit dk-count-cap">cartes</span></span>
        </span>
      </button>
    </div>

    {/* DecksScreen.jsx -- the create form's type list (plan 071) */}
    <div className="form">
      <div className="type-list">
        <button type="button" className="type-row type-row--on">
          <span className="chip__glyph type-row__glyph dk-type-glyph" lang="ja" style={{ '--tab-color': 'var(--line-vocab)' }}>単</span>
          <span className="type-row__names">
            <span className="type-row__label">Vocabulaire</span>
            <span className="type-row__desc dk-type-desc">Mots et expressions</span>
          </span>
        </button>
      </div>
    </div>

    {/* DeckDetailScreen.jsx -- the identity block, a chip, and the card
        rows on one surface (plan 071) */}
    <div className="deck-identity" style={{ '--line-color': 'var(--line-decks)' }}>
      <span className="wmap-roundel deck-identity__roundel dk-id-glyph" lang="ja">単</span>
      <span className="deck-identity__names">
        <span className="deck-identity__name">旅行</span>
        <span className="deck-identity__meta dk-meta">Vocabulary · 47 cards · <span className="deck-identity__due dk-id-due">2 due</span></span>
      </span>
    </div>
    <div className="chip-row">
      <button type="button" className="chip dk-row-chip">Sélectionner</button>
    </div>
    {/* The form's row: the quiet button beside the filled one. */}
    <div className="form">
      <div className="form__row">
        <button type="button" className="btn-secondary">Annuler</button>
        <button type="button" className="btn-primary">Enregistrer</button>
      </div>
    </div>
    <div className="card-list" style={{ '--line-color': 'var(--line-decks)' }}>
      <button type="button" className="card-row">
        <span className="card-row__front">
          <span className="card-row__jp" lang="ja">駅</span>
          <span className="card-row__kana dk-kana" lang="ja">えき</span>
        </span>
        <span className="card-row__back dk-back">station<span className="card-row__note dk-note">a note</span></span>
        <span className="card-row__badge dk-badge" style={{ '--rail': 'var(--line-kanji)' }}>Kanji · N4</span>
      </button>
      <div className="card-row">
        <span className="card-row__front"><span className="card-row__jp" lang="ja">切符</span></span>
        <span className="card-row__back">ticket</span>
        <button type="button" className="card-row__remove dk-remove" aria-label="delete">x</button>
      </div>
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

    {/* ── Practice (plan 072): the sessions on the stage and the exam's
        result under the bar. Inks the contract cannot predict — a pigment
        mixed toward the ink on the card or on a tint of itself, the soft
        ink on the sheet bar's sumi. */}
    <main className="stage" style={{ '--line-color': 'var(--line-reading)' }}>
      <div className="stage__head">
        <span className="stage__streak pr-streak">3</span>
      </div>
      <div className="timer"><span className="timer__label pr-timer">12.3s</span></div>
      <div className="prompt-card prompt-card--footed">
        <div className="prompt-card__body prompt-card__body--prose prose">
          <span className="prose__label pr-label">EN</span>
          <span className="prose__romaji pr-romaji">ashita wa</span>
          <span className="prose__ai pr-ai">Natural and correct.</span>
          <span className="prose__verdict prose__verdict--ok pr-ok">Correct!</span>
          <span className="prose__verdict prose__verdict--x pr-x">Not quite</span>
        </div>
      </div>
      <div className="prompt-card prompt-card--ask">
        <span className="type-badge type-badge--comprehension pr-badge">Detail</span>
        <span className="cap pr-cap">Q7</span>
      </div>
      <div className="surface qrows">
        <div className="qrow-item">
          <button type="button" className="qrow">
            <span className="qrow__q">Q3</span>
            <span className="qrow__note pr-note">You · B — correct · D</span>
          </button>
        </div>
      </div>
      <div className="exam-meta"><span className="exam-timer exam-timer--low pr-low">0:42</span></div>
      <button type="button" className="exam-mondai pr-mondai">
        <span><b className="exam-mondai__part pr-part">Part 3</b> · Show instructions</span>
      </button>
      <div className="exam-nav"><button type="button" className="exam-flag exam-flag--on pr-flag">f</button></div>
      <div className="exam-sheetbar">
        <button type="button" className="exam-sheetbar__open">
          <span className="exam-sheetbar__label">
            <b className="exam-sheetbar__fig pr-fig">7 / 21</b>
            <span className="exam-sheetbar__cap pr-sheetcap">Answer sheet</span>
          </span>
        </button>
        <button type="button" className="exam-finish pr-finish">Finish</button>
      </div>
    </main>
    <main className="practice" style={{ '--line-color': 'var(--line-exam)' }}>
      <div className="exam-result-head">
        <div className="exam-result-figs">
          <span className="exam-result-figs__cap pr-rcap">correct</span>
          <span className="exam-result-figs__note pr-rnote">Practice target 60%</span>
        </div>
      </div>
      <p className="hint pr-hint">Tap a question.</p>
      <div className="surface exam-review">
        <div className="exam-review__part">
          <div className="exam-group"><b className="exam-group__part">Part 1</b><span className="exam-group__score pr-gscore">6 / 6</span></div>
          <button type="button" className="exam-review-row">
            <span className="exam-review-row__mark exam-review-row__mark--x pr-mark-x">x</span>
            <span className="exam-review-row__jp pr-rjp">この本は</span>
            <span className="exam-review-row__blank pr-rblank">Left blank</span>
          </button>
          <button type="button" className="exam-review-row">
            <span className="exam-review-row__mark exam-review-row__mark--ok pr-mark-ok">v</span>
          </button>
        </div>
      </div>
      <div className="platform-slot"><span className="platform-slot__action pr-slot">Different paper</span></div>
    </main>

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
  ['.dk-chip', 'console chip'],
  ['.dk-count', 'console count'],
  ['.gc-latin', 'fare gate title'],
  ['.gc-unit', 'fare gate unit'],
  ['.gc-when', 'fare gate next-review line'],
  ['.gc-where', 'gate lane name (tinted surface)'],
  ['.gc-mode', 'gate lane mode (tinted surface)'],
  ['.gc-depart-jp', 'depart button name (gold fill)'],
  ['.gc-depart-latin', 'depart button arrow (gold fill)'],
  ['.wm-latin', 'map line caption (sumi)'],
  ['.wm-stop', 'map stop label (sumi)'],
  ['.wm-due', 'map due chip (sumi)'],
  ['.wm-note', 'decks row meta (sumi)'],
  ['.station-sign__kana', 'station sign kana'],
  ['.station-sign__romaji', 'station sign romaji'],
  ['.record__label', 'record label'],
  ['.record__unit', 'record unit'],
  ['.phrase-kanji-chip__level', 'kanji chip level (sumi)'],
  // Placeholders are text and carry the same floor. Measured through
  // getComputedStyle's pseudo-element argument, since ::placeholder has a
  // colour of its own that the host input's computed style does not show.
  ['.dk-field::placeholder', 'console search placeholder'],
  ['.dict-index-bar__input::placeholder', 'dictionary search placeholder'],

  // Settled by measurement rather than by reading a selector -- see the
  // comment beside their markup above.
  ['.leaderboard-row__level', 'leaderboard row level'],
  ['.leaderboard-row__gap', 'leaderboard elision row'],
  ['.dk-glyph', 'deck card glyph (tinted roundel)'],
  ['.dk-due', 'deck card due (warning ink)'],
  ['.dk-count-cap', 'deck card count caption'],
  ['.dk-type-glyph', 'type row glyph (on)'],
  ['.dk-type-desc', 'type row description (on)'],
  ['.dk-id-glyph', 'deck identity glyph'],
  ['.dk-meta', 'deck identity meta'],
  ['.dk-id-due', 'deck identity due (warning ink)'],
  ['.dk-row-chip', 'deck page action chip'],
  ['.dk-kana', 'card row kana'],
  ['.dk-back', 'card row meaning'],
  ['.dk-note', 'card row note'],
  ['.dk-badge', 'card row source badge'],
  ['.dk-remove', 'card row remove affordance'],
  ['.btn-secondary', 'deck detail ghost button (shared family)'],
  ['.phrase-word-card__reading', 'token card reading'],
  ['.phrase-word-card__pos', 'token card part of speech'],

  // Plan 072 — the practice sessions on the stage, the exam on the stage
  // and its result under the bar.
  ['.pr-streak', 'practice streak (warning ink mixed)'],
  ['.pr-timer', 'practice timer label'],
  ['.pr-label', 'prose label'],
  ['.pr-romaji', 'prose romaji'],
  ['.pr-ai', 'prose AI analysis'],
  ['.pr-ok', 'verdict (success ink mixed)'],
  ['.pr-x', 'verdict (danger ink mixed)'],
  ['.pr-badge', 'question type badge (tinted)'],
  ['.pr-cap', 'question cap'],
  ['.pr-note', 'result row note'],
  ['.pr-low', 'exam timer, last minute (danger ink mixed)'],
  ['.pr-mondai', 'exam part row'],
  ['.pr-part', 'exam part label'],
  ['.pr-flag', 'exam flag, on (warning ink mixed)'],
  ['.pr-fig', 'sheet bar count (on sumi)'],
  ['.pr-sheetcap', 'sheet bar caption (soft ink on sumi)'],
  ['.pr-finish', 'sheet bar finish (on sumi)'],
  ['.pr-rcap', 'result figures caption'],
  ['.pr-rnote', 'result figures note'],
  ['.pr-hint', 'hint line'],
  ['.pr-gscore', 'exam part score'],
  ['.pr-mark-x', 'review mark, missed (danger ink on its tint)'],
  ['.pr-mark-ok', 'review mark, correct (success ink on its tint)'],
  ['.pr-rjp', 'review row question line'],
  ['.pr-rblank', 'review row left blank'],
  ['.pr-slot', 'paper slot (Different paper)'],

  // Plan 055's deck shelf, merged in after the guards were written.

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
