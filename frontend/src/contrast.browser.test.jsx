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

    {/* DictionaryScreen.jsx / DictionaryDetail.jsx (plan 073) -- the
        analyzer's door, the catalogue card, the plate and the entry's
        blocks, all on --surface. The inks the contract cannot predict:
        the door's roundel and intakes (the analyzer's pigment mixed
        toward the ink), the card's level (the level's pigment mixed),
        the entry ink (--dict-ink, the line's pigment mixed) on sense
        numbers and word hits, and the due note (the state ink mixed). */}
    <button type="button" className="anl-door">
      <span className="wmap-roundel anl-door__roundel dc-roundel">KS</span>
      <span className="anl-door__names">
        <span className="anl-door__title dc-title">Analyzer</span>
        <span className="anl-door__desc dc-desc">Text, photo, video</span>
      </span>
      <span className="anl-door__intakes"><span className="anl-door__intake dc-intake">T</span></span>
    </button>
    <div className="dict-grid">
      <button type="button" className="dict-entry-card" style={{ '--level-color': 'var(--line-kanji)' }}>
        <span className="dict-level-badge dc-level">N5</span>
        <span className="dict-entry-card__char">
          <ruby>駅<rt className="dc-kana">えき</rt></ruby>
        </span>
        <span className="dict-entry-card__meaning dc-meaning">station</span>
      </button>
    </div>
    {/* AnalyzerScreen.jsx, SentenceBreakdown.jsx, StageCard.jsx,
        AnalyzerHistory.jsx, DeckPicker.jsx (plan 073) -- the line's
        particle and the furigana over the focused (tinted) token, the
        card's reading and its i+1 mark (the success ink mixed), the
        legend, the stepper count, the history's meta and its Kept mark
        (the stamp ink mixed), the deck picker's count. */}
    <div className="analyzer">
      <div className="anl-stage">
        <div className="anl-stepper"><span className="anl-stepper__count an-count">1 / 2 · <i className="anl-stepper__i1">i+1</i></span></div>
        <div className="tok-line">
          <button type="button" className="tok tok--mastered tok--on"><span className="tok__furi an-furi">でんしゃ</span><span className="tok__word">電車</span></button>
          <button type="button" className="tok tok--particle an-particle"><span className="tok__furi" /><span className="tok__word">は</span></button>
        </div>
        <div className="anl-legend"><span className="anl-legend__item an-legend"><i className="anl-legend__ink anl-legend__ink--mastered" />Mastered</span></div>
        <div className="token-card token-card--i1">
          <div className="token-card__head">
            <span className="token-card__reading an-reading">でんしゃ</span>
            <span className="type-badge token-card__pos an-pos">noun</span>
          </div>
          <span className="token-card__gloss">electric train</span>
          <span className="token-card__i1 an-i1">One step beyond you</span>
        </div>
        <div className="anl-dials"><div className="anl-dial"><span className="cap anl-dial__cap an-cap">Furigana</span></div></div>
      </div>
      <section className="anl-history">
        <div className="head2"><span className="head2__latin">History</span><span className="head2__count an-hcount">2 passages</span></div>
        <div className="surface anl-hist-list">
          <div className="anl-hist-row">
            <button type="button" className="anl-hist">
              <span className="anl-hist__n an-n">1</span>
              <span className="anl-hist__body">
                <span className="anl-hist__jp">駅前の掲示板。</span>
                <span className="anl-hist__meta an-meta"><span className="anl-kept an-kept">Kept</span><span className="anl-hist__count">3 sentences</span></span>
              </span>
            </button>
          </div>
        </div>
      </section>
    </div>
    <div className="surface picker">
      <button type="button" className="picker-row picker-row--current">
        <span className="picker-row__name">N5 words</span>
        <span className="picker-row__count an-pcount">12 cards</span>
      </button>
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

    {/* Banzuke.jsx -- the ranking as the canvas draws it (plan 074): a
        head carrying the This week / All time toggle, then one list of
        rows. The selected segment is the ambient ink on a 14% gold wash
        over --surface, which is a mix on a mix and so invisible to part
        1; the medal roundels are three metal inks on sumi. */}
    <div className="banzuke">
      <div className="bz__head">
        <span className="bz__mark"><span className="bz__jp">Ranking</span></span>
        <span className="seg bz__seg">
          <button type="button" className="seg__opt seg__opt--on bz-seg-on"><span className="seg__opt-latin">This week</span></button>
          <button type="button" className="seg__opt bz-seg-off"><span className="seg__opt-latin">All time</span></button>
        </span>
      </div>
      <div className="leaderboard-row">
        <span className="leaderboard-row__rank leaderboard-row__rank--gold bz-rank-gold">1</span>
        <span className="leaderboard-row__name bz-name">Aoi</span>
        <span className="leaderboard-row__xp bz-xp">4,210 XP</span>
      </div>
      <div className="leaderboard-row">
        <span className="leaderboard-row__rank leaderboard-row__rank--silver bz-rank-silver">2</span>
        <span className="leaderboard-row__name">Mei</span>
        <span className="leaderboard-row__xp">3,900 XP</span>
      </div>
      <div className="leaderboard-row leaderboard-row--me">
        <span className="leaderboard-row__rank leaderboard-row__rank--bronze bz-rank-bronze">3</span>
        <span className="leaderboard-row__name bz-me-name">Aiko</span>
        <span className="leaderboard-row__xp">960 XP</span>
      </div>
      <div className="leaderboard-row">
        <span className="leaderboard-row__rank bz-rank">4</span>
        <span className="leaderboard-row__name">Sora</span>
        <span className="leaderboard-row__xp">720 XP</span>
      </div>
      <div className="leaderboard-row leaderboard-row__gap" aria-hidden="true">⋯</div>
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
    {/* The status sheet (進捗が主役 round): sumi in both themes, pinned
        inline like the board above. The head's count, its percent in
        the state's ink and its leg line; a comparison row's value,
        unit, key, promise and state-inked delta; the goal-less line
        and its link, the error line. */}
    <div className="status-sheet jour-st--slightlyBehind" style={{ background: 'var(--bg-panel)' }}>
      <div className="jour-dist">
        <span className="jour-dist__count ss-dist-v">1,830<span className="jour-dist__of ss-dist-of">/ 4,206</span></span>
        <span className="jour-dist__pct ss-dist-pct">43%</span>
        <span className="jour-dist__leg ss-dist-leg">Next stop N4 · 474 behind plan</span>
      </div>
      <div className="jour-cmps">
        <div className="jour-cmp">
          <span className="jour-cmp__k ss-cmp-k">Pace</span>
          <span className="jour-cmp__v ss-cmp-v">7.1<span className="jour-cmp__u ss-cmp-u">/ day</span></span>
          <span className="jour-cmp__d ss-cmp-d">-1.5</span>
          <span className="jour-cmp__sub ss-cmp-sub">promised 10 / day · last 14 days</span>
        </div>
      </div>
      <p className="hint status-sheet__none ss-none">
        No destination. <button type="button" className="status-sheet__office ss-office">Set one</button>
      </p>
      <p className="hint status-sheet__error ss-error">error line</p>
    </div>
    {/* The pass's footer (plan 074): the balance line on the pass's own
        sumi — the word, the gold figure, the cap and the refill. */}
    <div className="pass" style={{ background: 'var(--bg-panel)' }}>
      <div className="jour-line balance-line">
        <span className="jour-line__status"><b className="bl-word">Balance</b></span>
        <span className="jour-line__validity"><b className="bl-fig">30</b><span className="jour-cap bl-cap">/ 50 credits</span></span>
        <span className="jour-cap balance-line__refill bl-refill">+30 at 00:00</span>
      </div>
    </div>
    {/* Plan 074 -- the statistics' notes and caps, the settings' rows,
        the service cards (on the pass-ink wash when chosen), the level
        strip, the destination chips and the pass line on paper. */}
    <div className="records"><div className="record"><span className="record__value">24</span><span className="record__label">Due today</span><span className="record__note st-note">318 this week</span></div></div>
    <div className="stat-cap st-cap"><span>Practice calendar</span><span>14 weeks · best day <b className="stat-cap__fig st-fig">88</b></span></div>
    <div className="cal cal--gold"><div className="cal__foot st-cal-foot"><span>One square a day</span></div></div>
    <div className="forecast forecast--pass">
      <div className="forecast__bars"><span className="forecast__col"><span className="forecast__v st-fc-v">24</span></span></div>
      <div className="forecast__days st-fc-days"><span>Sat</span></div>
    </div>
    <section className="sbook"><div className="sbook__dows"><span className="sbook__dow sb-dow">M</span></div></section>
    <div className="stg-list">
      <button type="button" className="stg-row">
        <span className="stg-row__names"><span className="stg-row__jp st-row">Learning</span></span>
        <span className="stg-row__value st-value">N4 · 10 / day</span>
      </button>
    </div>
    <div className="slip">
      <div className="slip__label"><b className="slip__name st-slip-name">JLPT level</b><span className="cap st-slip-cap">You are here</span></div>
      <span className="slip__hint st-slip-hint">A hint.</span>
      <div className="lvlstrip">
        <button type="button" className="lvlstrip__stop"><span className="lvlstrip__dot" /><span className="lvlstrip__code lv-code">N5</span></button>
        <button type="button" className="lvlstrip__stop lvlstrip__stop--on"><span className="lvlstrip__dot" /><span className="lvlstrip__code lv-code-on">N4</span><span className="lvlstrip__jp lv-jp">Elementary</span></button>
      </div>
      <p className="lvl-note lv-note">Moving up marks the stops <strong className="lvl-note__strong lv-strong">known</strong>.</p>
    </div>
    <div className="svc-grid">
      <button type="button" className="svc"><span className="svc__jp sv-jp">Local</span><span className="svc__pace sv-pace">5 / day</span></button>
      <button type="button" className="svc svc--on">
        <span className="svc__jp sv-on-jp">Rapid</span>
        <span className="svc__pace sv-on-pace">10 / day</span>
        <span className="svc__words sv-on-words">Wrong · Correct</span>
      </button>
    </div>
    <div className="dest-grid">
      <button type="button" className="dest dest--on"><span className="dest__code ds-code">N3</span><span className="dest__load ds-load">Intermediate</span></button>
    </div>
    <div className="jour-line dest-line">
      <span className="jour-line__validity"><span className="jour-cap ds-cap">Valid until</span><b className="dest-line__date ds-date">14 Mar 2027</b></span>
      <span className="jour-cap dest-line__note ds-note">moves to 23 Mar</span>
    </div>
    <div className="lvl-sheet__figs"><div className="lvl-sheet__fig"><b className="lvl-sheet__fig-v ls-v">1,318</b><span className="lvl-sheet__fig-l ls-l">Marked known</span></div></div>
    <p className="lvl-sheet__body ls-body">The stops are marked <strong className="lvl-sheet__strong ls-strong">known</strong>.</p>

    {/* ── Plan 075 — the boarding and the sign-in ──
        The boarding stands on the page ground with its cards on
        --surface; the departure board, the notification's app mark and
        the printed pass are sumi (pinned inline like the panels above,
        whose gradients the walker cannot composite). The gold inks --
        the name in a question, a kana's meaning, the tag's ring -- are
        exactly the pairs part 1's contract cannot see. */}
    <div className="brd" data-step="why">
      <h1 className="brd__q">Why, <strong className="brd__q-em ob-q-em">Aiko</strong>?</h1>
      <p className="brd__hint ob-hint">The stops behind you will be marked known.</p>
      <span className="brd__count ob-count">2/8</span>
      <p className="brd__error ob-error">Saving failed</p>
      <button type="button" className="brd__link ob-link">Not now</button>
      <button type="button" className="brd-opt brd-opt--on" aria-pressed="true">
        <span className="brd-opt__code ob-code-on">N5</span>
        <span className="brd-opt__names">
          <span className="brd-opt__label ob-label-on">Beginner<span className="brd-tag ob-tag">Next stop</span></span>
          <span className="brd-opt__desc ob-desc-on">Simple phrases · ~100 kanji</span>
        </span>
      </button>
      <button type="button" className="brd-opt" aria-pressed="false">
        <span className="brd-opt__code ob-code">N4</span>
        <span className="brd-opt__names"><span className="brd-opt__desc ob-desc">Everyday talk</span></span>
      </button>
      <button type="button" className="brd-cell brd-cell--on" aria-pressed="true">
        <span className="brd-cell__n ob-cell-n">10</span>
        <span className="brd-cell__u ob-cell-u">min a day</span>
        <span className="brd-cell__sub ob-cell-sub">~10 new items</span>
      </button>
      <button type="button" className="brd-kopt"><span className="brd-kopt__jp ob-kopt-jp" lang="ja">すし</span></button>
      <div className="brd-kana">
        <div className="brd-kana__pane">
          <span className="brd-kana__romaji ob-romaji">su · shi</span>
          <span className="brd-kana__en ob-kana-en">sushi</span>
          <span className="brd-kana__script ob-script">Hiragana</span>
        </div>
      </div>
      <div className="brd-demo" style={{ '--line-color': 'var(--line-kanji)' }}>
        <span className="brd-demo__tag ob-demo-tag">Kanji</span>
        <span className="brd-demo__meaning ob-demo-meaning">station</span>
        <span className="brd-demo__foot ob-demo-foot">Kanji → meaning</span>
      </div>
      <div className="brd-demo" style={{ '--line-color': 'var(--line-exam)' }}>
        <span className="brd-demo__tag ob-demo-tag-exam">Listening</span>
      </div>
      <div className="brd-board" style={{ background: 'var(--bg-panel)' }}>
        <span className="brd-board__cap ob-board-cap">Departure</span>
        <span className="brd-flap ob-flap">0</span>
        <span className="brd-board__colon ob-colon">:</span>
      </div>
      <div className="brd-day"><span className="brd-day__tick ob-tick">06</span></div>
      <div className="brd-notif">
        <span className="brd-notif__app ob-notif-app" style={{ background: 'var(--bg-panel)' }}>JP</span>
        <div className="brd-notif__head ob-notif-head"><span>Japanese Learner</span></div>
        <span className="brd-notif__text ob-notif-text">Your cards are waiting at the gate.</span>
      </div>
      <div className="brd-step brd-step--done"><span className="brd-step__val ob-step-val">N5 → N4</span></div>
      <div className="brd-chart">
        <span className="brd-chart__title ob-chart-title">Your projection</span>
        <div className="brd-legend ob-legend">Daily reviews</div>
        <span className="brd-chart__cap ob-chart-cap">an illustration, not a measurement</span>
      </div>
      <p className="brd-lead ob-lead">At <strong className="brd-lead__em ob-lead-em">10 min a day</strong></p>
      <div className="brd-bullet ob-bullet">~1,300 words</div>
      <div className="brd-issue" style={{ background: 'var(--bg-panel)' }}>
        <span className="brd-gift ob-gift">+200 credits</span>
      </div>
    </div>
    <main className="auth">
      <span className="auth-header__glyph ob-auth-glyph" lang="ja">日本語</span>
      <h1 className="auth-header__title ob-auth-title">Learn Japanese</h1>
      <div className="auth-card">
        <p className="auth-message auth-message--error ob-auth-error">Wrong password</p>
        <button type="button" className="auth-submit ob-auth-submit">Login</button>
      </div>
      <p className="auth-foot ob-auth-foot">Everything can be changed later in Settings.</p>
    </main>
    {/* ── 辞書 — the entry plate and its body (2026-09 redesign) ──
        The dock injects the 辞書 pigment; the entry mixes it 60% toward
        the ambient ink for its numerals and the highlighted headword
        (--dict-ink), and the due note mixes the due ink the same way.
        Raw 山吹 is 2.9:1 on light paper, which is exactly why these are
        measured rather than trusted. The stroke sheet is the one
        theme-independent white in the app, so its fallback line takes
        the fixed dark ink. */}
    <aside className="dict-dock">
      <article className="dict-entry">
        <header className="dict-plate">
          <div className="dict-plate__marks">
            <span className="stage-mark stage-mark--new stage-mark--inline dj-stage-new">New</span>
            <span className="stage-mark stage-mark--learning stage-mark--inline dj-stage-learning">In progress</span>
            <span className="stage-mark stage-mark--mastered stage-mark--inline dj-stage-mastered">Mastered</span>
            <span className="dict-plate__level dj-level">N5</span>
          </div>
          <div className="dict-plate__readings">
            <span className="dict-plate__yomi dj-reading" lang="ja">
              <span className="dict-kind dj-kind">音</span>モク
            </span>
            <button type="button" className="dict-plate__more dj-more">+2</button>
          </div>
          <span className="dict-plate__caption dj-caption">Tree</span>
        </header>
        <div className="dict-entry__body">
          <section className="dict-block">
            <ol className="dict-senses">
              <li className="dict-sense">
                <span className="dict-sense__n dj-n">1</span>
                <div className="dict-sense__body">
                  <button type="button" className="dict-tag dj-tag">v1</button>
                  <div className="dict-ex">
                    <div className="dict-ex__jp" lang="ja">
                      <mark className="dict-ex__hl dict-ex__seg dj-hl">食</mark>
                    </div>
                    <div className="dict-ex__tr dj-tr">I ate.</div>
                  </div>
                </div>
              </li>
            </ol>
          </section>
          <section className="dict-block">
            <div className="dict-form">
              <div className="dict-form__sheet">
                <div className="dict-form__fallback dj-fallback">Not available</div>
              </div>
            </div>
          </section>
          <section className="dict-block">
            <div className="dict-words">
              <button type="button" className="dict-word">
                <span className="dict-word__jp" lang="ja">
                  <ruby className="dict-word__hit dj-hit">木<rt className="dj-hit-rt">もく</rt></ruby>曜日
                </span>
                <span className="dict-word__gloss dj-word-gloss">Thursday</span>
              </button>
            </div>
          </section>
          <section className="dict-block">
            <div className="dict-block__note dj-due">Due now</div>
          </section>
        </div>
      </article>
    </aside>
    <span className="dict-tag__tip dj-tip" style={{ position: 'static' }}>Ichidan verb</span>
    {/* The catalogue card wears the same word, faded to marginalia. */}
    <div className="dict-results-grid">
      <div className="dict-entry-card">
        <span className="stage-mark stage-mark--learning dj-card-stage">In progress</span>
        <span className="stage-mark stage-mark--mastered dj-card-stage-gold">Mastered</span>
      </div>
    </div>

    <div className="jour-st--delayed" style={{ background: 'var(--bg-panel)' }}>
      <div className="jour-line">
        <span className="jour-line__status"><b className="jr-status-b" lang="ja">遅延</b></span>
        <span className="jour-line__validity"><b className="jr-validity-b">2 sept. ’27</b></span>
      </div>
      {/* 遅延's ink is the mixed one (raw 臙脂 reads 2.6:1 on sumi), and
          the delta on a comparison row is where it now lands as TEXT —
          the day-bracket that used to carry it went with the two-lane
          track. Measured under delayed on purpose: the sheet's other
          fixture above wears slightlyBehind, whose 琥珀 carries itself. */}
      <div className="jour-cmps">
        <div className="jour-cmp">
          <span className="jour-cmp__v">2 sept. 2027</span>
          <span className="jour-cmp__d jr-delta-b">+400 j</span>
        </div>
      </div>
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

  // Plan 073 -- the dictionary and the analyzer (see the fixture).
  ['.dc-roundel', 'analyzer door roundel (kaiseki mixed toward the ink)'],
  ['.dc-title', 'analyzer door title'],
  ['.dc-desc', 'analyzer door description'],
  ['.dc-intake', 'analyzer door intake (kaiseki mixed toward the ink)'],
  ['.dc-level', 'catalogue card level (level pigment mixed toward the ink)'],
  ['.dc-kana', 'catalogue card furigana'],
  ['.dc-meaning', 'catalogue card meaning'],
  ['.an-count', 'stepper count'],
  ['.an-furi', 'furigana over the focused token (on its tint)'],
  ['.an-particle', 'particle token'],
  ['.an-legend', 'line legend'],
  ['.an-reading', 'token card reading'],
  ['.an-pos', 'token card part of speech (type badge)'],
  ['.an-i1', 'token card i+1 mark (success ink mixed)'],
  ['.an-cap', 'dial caption'],
  ['.an-hcount', 'history head count'],
  ['.an-n', 'history row number'],
  ['.an-meta', 'history row meta'],
  ['.an-kept', 'history Kept mark (stamp ink mixed)'],
  ['.an-pcount', 'deck picker card count'],
  // Placeholders are text and carry the same floor. Measured through
  // getComputedStyle's pseudo-element argument, since ::placeholder has a
  // colour of its own that the host input's computed style does not show.
  ['.dk-field::placeholder', 'console search placeholder'],

  // Settled by measurement rather than by reading a selector -- see the
  // comment beside their markup above.
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
  ['.ob-q-em', 'boarding question, the name in gold'],
  ['.ob-hint', 'boarding hint (soft ink on page)'],
  ['.ob-count', 'boarding track count'],
  ['.ob-error', 'boarding error line (danger on page)'],
  ['.ob-link', 'boarding ghost link'],
  ['.ob-code-on', 'chosen row code (ink on gold tint)'],
  ['.ob-label-on', 'chosen row label (ink on gold tint)'],
  ['.ob-tag', 'the tag (ink in a gold ring)'],
  ['.ob-desc-on', 'chosen row description (soft ink on gold tint)'],
  ['.ob-code', 'row code (soft ink on surface)'],
  ['.ob-desc', 'row description (soft ink on surface)'],
  ['.ob-cell-n', 'chosen cell figure (ink on gold tint)'],
  ['.ob-cell-u', 'chosen cell unit (soft ink on gold tint)'],
  ['.ob-cell-sub', 'chosen cell sub (soft ink on gold tint)'],
  ['.ob-kopt-jp', 'kana answer sample (soft ink on surface)'],
  ['.ob-romaji', 'kana reading (soft ink on surface)'],
  ['.ob-kana-en', 'kana meaning (gold on surface)'],
  ['.ob-script', 'kana script caption (soft ink on surface)'],
  ['.ob-demo-tag', 'demo card tag (kanji pigment on surface)'],
  ['.ob-demo-tag-exam', 'demo card tag (exam pigment on surface)'],
  ['.ob-demo-meaning', 'demo card meaning (shu-iro on surface)'],
  ['.ob-demo-foot', 'demo card foot (soft ink on surface)'],
  ['.ob-board-cap', 'departure board caption (soft panel ink on sumi)'],
  ['.ob-flap', 'departure board flap (panel ink on flap face)'],
  ['.ob-colon', 'departure board colon (soft panel ink on sumi)'],
  ['.ob-tick', 'day track tick (soft ink on page)'],
  ['.ob-notif-app', 'notification app mark (gold on sumi)'],
  ['.ob-notif-head', 'notification head (soft ink on surface)'],
  ['.ob-notif-text', 'notification text (soft ink on surface)'],
  ['.ob-step-val', 'build step value (soft ink on surface)'],
  ['.ob-chart-title', 'chart title (soft ink on surface)'],
  ['.ob-legend', 'chart legend (soft ink on surface)'],
  ['.ob-chart-cap', 'chart caption (soft ink on surface)'],
  ['.ob-lead', 'plan lead (soft ink on page)'],
  ['.ob-lead-em', 'plan lead term (ink on page)'],
  ['.ob-bullet', 'plan promise (ink on page)'],
  ['.ob-gift', 'the welcome on the printed pass (gold mixed toward the panel ink)'],
  ['.ob-auth-glyph', 'sign-in glyph (ink on page)'],
  ['.ob-auth-title', 'sign-in title (soft ink on page)'],
  ['.ob-auth-error', 'sign-in error (danger on surface)'],
  ['.ob-auth-submit', 'sign-in action (panel ink on shu-iro fill)'],
  ['.ob-auth-foot', 'sign-in foot (soft ink on page)'],
  ['.jr-status-b', 'pass footer status word (state ink on sumi)'],
  ['.jr-validity-b', 'pass footer 有効期限 (gold on sumi)'],
  ['.jr-delta-b', 'status sheet delta, delayed (state ink on sumi)'],

  // The 定期入れ profile — every one a mix on a mix (see the fixture).
  ['.pf-stamp', 'eki stamp day (lacquer ink on lacquer wash)'],
  ['.pf-stamp-today', "today's eki stamp (lacquer ink on denser wash)"],
  ['.pf-roundel-kana', 'ledger roundel, 朱 (line pigment mixed toward the ink)'],
  ['.pf-roundel-grammar', 'ledger roundel, 松葉'],
  ['.pf-roundel-stats', 'records door roundel, 桜 (the hall pigment mixed toward the ink)'],
  ['.pf-line-of', 'ledger reachable total'],
  ['.bz-seg-on', '番付 selected period (ambient ink on gold wash)'],
  ['.bz-seg-off', '番付 unselected period'],
  ['.bz-rank-gold', 'ranking gold roundel (medal ink on sumi)'],
  ['.bz-rank-silver', 'ranking silver roundel (medal ink on sumi)'],
  ['.bz-rank-bronze', 'ranking bronze roundel (medal ink on sumi)'],
  ['.bz-rank', 'ranking roundel (soft ink on sumi)'],
  ['.bz-name', 'ranking name'],
  ['.bz-xp', 'ranking XP'],
  ['.bz-me-name', 'your own ranking row (on the hover wash)'],

  // Plan 074 — the status sheet, the pass footer, the statistics and
  // the settings (see the fixture).
  ['.ss-dist-v', 'status sheet distance count (sumi)'],
  ['.ss-dist-of', 'status sheet distance total (soft ink on sumi)'],
  ['.ss-dist-pct', 'status sheet percent (state ink on sumi)'],
  ['.ss-dist-leg', 'status sheet leg line (soft ink on sumi)'],
  ['.ss-cmp-k', 'status sheet row key (soft ink on sumi)'],
  ['.ss-cmp-v', 'status sheet row value (sumi)'],
  ['.ss-cmp-u', 'status sheet row unit (soft ink on sumi)'],
  ['.ss-cmp-d', 'status sheet row delta (state ink on sumi)'],
  ['.ss-cmp-sub', 'status sheet row promise (soft ink on sumi)'],
  ['.ss-none', 'status sheet goal-less line (soft ink on sumi)'],
  ['.ss-office', 'status sheet office link (on sumi)'],
  ['.ss-error', 'status sheet error (state ink on sumi)'],
  ['.bl-word', 'pass balance word (on sumi)'],
  ['.bl-fig', 'pass balance figure (gold on sumi)'],
  ['.bl-cap', 'pass balance cap (soft ink on sumi)'],
  ['.bl-refill', 'pass balance refill (soft ink on sumi)'],
  ['.st-note', 'record note'],
  ['.st-cap', 'statistics cap'],
  ['.st-fig', 'statistics cap figure'],
  ['.st-cal-foot', 'calendar foot'],
  ['.st-fc-v', 'forecast value'],
  ['.st-fc-days', 'forecast day names'],
  ['.sb-dow', 'stamp book weekday'],
  ['.st-row', 'settings row'],
  ['.st-value', 'settings row value'],
  ['.st-slip-name', 'slip label'],
  ['.st-slip-cap', 'slip cap'],
  ['.st-slip-hint', 'slip hint'],
  ['.lv-code', 'level strip stop'],
  ['.lv-code-on', 'level strip current stop'],
  ['.lv-jp', 'level strip current name'],
  ['.lv-note', 'level note'],
  ['.lv-strong', 'level note emphasis'],
  ['.sv-jp', 'service card name'],
  ['.sv-pace', 'service card pace'],
  ['.sv-on-jp', 'chosen service card name (on the pass-ink wash)'],
  ['.sv-on-pace', 'chosen service card pace (on the pass-ink wash)'],
  ['.sv-on-words', 'chosen grade card words (on the pass-ink wash)'],
  ['.ds-code', 'chosen destination code (on the pass-ink wash)'],
  ['.ds-load', 'chosen destination name (on the pass-ink wash)'],
  ['.ds-cap', 'pass line cap on paper'],
  ['.ds-date', 'pass line date on paper'],
  ['.ds-note', 'pass line drift note on paper'],
  ['.ls-v', 'level sheet figure'],
  ['.ls-l', 'level sheet figure label'],
  ['.ls-body', 'level sheet body'],
  ['.ls-strong', 'level sheet emphasis'],
  // The 辞書 entry — 山吹 mixed toward the ink, and the due ink likewise.
  ['.dj-level', 'entry plate level numeral'],
  ['.dj-stage-new', 'entry plate stage word, new'],
  ['.dj-stage-learning', 'entry plate stage word, in progress (state ink mixed toward the ink)'],
  ['.dj-stage-mastered', 'entry plate stage word, mastered (gold mixed toward the ink)'],
  ['.dj-kind', 'entry plate 音/訓 mark'],
  ['.dj-reading', 'entry plate reading'],
  ['.dj-more', 'entry plate readings door'],
  ['.dj-card-stage', 'catalogue card stage word, in progress'],
  ['.dj-card-stage-gold', 'catalogue card stage word, mastered'],
  ['.dj-caption', 'entry plate caption (first gloss)'],
  ['.dj-n', 'sense numeral (辞書 pigment mixed toward the ink)'],
  ['.dj-tag', 'grammatical tag'],
  ['.dj-hl', 'headword highlighted in an example (辞書 pigment mixed toward the ink)'],
  ['.dj-tr', 'example translation'],
  ['.dj-fallback', 'stroke sheet fallback (fixed ink on washi)'],
  ['.dj-word-gloss', 'word row gloss'],
  ['.dj-hit', 'word row: the kanji picked out (辞書 pigment mixed toward the ink)'],
  ['.dj-hit-rt', 'word row: its furigana, in the same ink'],
  ['.dj-due', 'due note (due ink mixed toward the ink)'],
  ['.dj-tip', 'tag note (panel ink on sumi)'],
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
