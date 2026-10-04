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
        on --surface: a chip, then the index field and the count in the
        search well (plan 157), on the well's ground and not the
        console's */}
    <div className="console">
      <div className="console__top">
        <div className="console__chips">
          <button type="button" className="chip dk-chip">ALL</button>
        </div>
      </div>
      <div className="console__index">
        <div className="field field--search console__well">
          <input className="console__field dk-field" placeholder="search" />
          <span className="console__count dk-count">12 DECKS</span>
        </div>
      </div>
    </div>

    {/* Console.jsx -- the console's band (the library's ordering): the
        chosen half's ink on its own 14% wash, and the other half's on
        the bare surface. A new ground, so it is measured rather than
        assumed from .chip--on, which wears the same mix on --surface
        and not on a wash of itself. */}
    <div className="console">
      <div className="console__band" style={{ '--line-color': 'var(--line-decks)' }}>
        <button type="button" className="console__band-opt console__band-opt--on lb-band-on">Plus récents</button>
        <button type="button" className="console__band-opt lb-band-off">Plus suivis</button>
      </div>
    </div>

    {/* LibraryCard.jsx / DeckDetailScreen.jsx -- the library's own
        inks on --surface: the attribution beside the deck type, the
        clamped description, the follower tally in the aside, and the
        withdrawn warning's lead, which is a STATE colour mixed toward
        the text ink rather than the raw --warning that reads as a
        label. */}
    <div className="platform-card deck-card lib-card" style={{ '--rail': 'var(--line-vocab)', '--line-color': 'var(--line-vocab)' }}>
      <span className="platform-card__body">
        <span className="platform-card__title lib-title">Verbes N3</span>
        <span className="platform-card__desc lib-desc">
          Vocabulaire · <span className="lib-card__author lib-by">par SwiftKitsune4821</span>
        </span>
        <span className="lib-card__blurb lib-blurb-ink">Les verbes irréguliers</span>
      </span>
      <span className="platform-card__aside deck-card__aside">
        <span className="lib-card__follows lib-follows">12 abonnés</span>
      </span>
    </div>
    <p className="lib-warning">
      <span className="lib-warning__lead lib-warn-lead">Retiré.</span>
      <span className="lib-warn-body"> Son auteur a supprimé ce paquet.</span>
    </p>
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

    {/* LinePlate.jsx (plan 094) -- the gates' plates on --surface: the
        name, the foot's stop names in both registers, the due chip. */}
    <div className="plate" style={{ '--line-color': 'var(--line-vocab)' }}>
      <button type="button" className="plate__head">
        <span className="pf-line__roundel plate__roundel lp-roundel">TG</span>
        <span className="plate__names">
          <span className="plate__title lp-title">Vocabulary</span>
          <span className="plate__meta lp-meta">3 decks · 214 cards</span>
        </span>
        <span className="plate__aside"><span className="plate__due lp-due">8<span className="plate__due__unit">due</span></span></span>
      </button>
      <span className="plate__foot">
        <span className="plate__prev lp-edge">‹ Novice</span>
        <span className="plate__here lp-here">N5</span>
        <span className="plate__next lp-edge">N4 ›</span>
      </span>
    </div>

    {/* 作文 (plan 125) -- the thirteenth pigment, 紫, measured where the
        twelve before it were assumed: its filled action at rest and at
        the hover mix (the guard cannot hover, so the 79% recipe is
        written inline), and its plate roundel. */}
    <div style={{ '--line-color': 'var(--line-sakubun)' }}>
      <button type="button" className="btn-primary sb-btn">Valider</button>
      <button
        type="button"
        className="btn-primary sb-btn-hover"
        style={{ background: 'color-mix(in srgb, var(--line-sakubun) 79%, var(--bg-panel))' }}
      >
        Valider
      </button>
    </div>
    <div className="plate" style={{ '--line-color': 'var(--line-sakubun)' }}>
      <button type="button" className="plate__head">
        <span className="pf-line__roundel plate__roundel sb-roundel">SB</span>
        <span className="plate__names"><span className="plate__title">Rédaction</span></span>
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
    {/* SubtitleLine.jsx, PassageShelf.jsx, DeckPicker.jsx (plans 073,
        134 and 136) -- the line's particle and the furigana over the
        focused (tinted) token, the shelf's chip count, a row's glyph,
        its meta and its Kept mark (the stamp ink mixed), the deck
        picker's count. */}
    <div className="analyzer">
      <div className="tok-line">
        <button type="button" className="tok tok--mastered tok--on"><span className="tok__furi an-furi">でんしゃ</span><span className="tok__word">電車</span></button>
        <button type="button" className="tok tok--particle an-particle"><span className="tok__furi" /><span className="tok__word">は</span></button>
      </div>
      <section className="anl-shelf">
        <div className="anl-shelf__chips"><button type="button" className="chip">All<span className="chip__n an-hcount">2</span></button></div>
        <div className="anl-shelf__rows">
          <div className="anl-row">
            <button type="button" className="anl-row__open">
              <span className="anl-row__lead"><span className="anl-row__glyph an-n">T</span></span>
              <span className="anl-row__body">
                <span className="anl-row__jp">駅前の掲示板。</span>
                <span className="anl-row__meta an-meta"><span className="anl-kept an-kept">Kept</span><span>3 sentences</span></span>
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
      <div className="card-row">
        <button type="button" className="card-row__body">
          <span className="card-row__front">
            <span className="card-row__jp" lang="ja">駅</span>
            <span className="card-row__kana dk-kana" lang="ja">えき</span>
          </span>
          <span className="card-row__back dk-back">station<span className="card-row__note dk-note">a note</span></span>
          <span className="card-row__badge dk-badge" style={{ '--rail': 'var(--line-kanji)' }}>N4</span>
        </button>
      </div>
      <div className="card-row">
        <div className="card-row__body">
          <span className="card-row__front"><span className="card-row__jp" lang="ja">切符</span></span>
          <span className="card-row__back">ticket</span>
        </div>
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
      {/* ReadingRun/TranslationRun -- the run's entry docked in the
          foot. Its well is --surface here rather than the page (see
          .stage__foot .field), which is a ground neither the contract
          above nor any other site measures a field on. */}
      <form className="stage__foot">
        <input className="field pr-entry" placeholder="ex. konnichiwa" defaultValue="konnichiwa" />
      </form>
      <div className="exam-nav"><button type="button" className="exam-flag exam-flag--on pr-flag">f</button></div>
      <div className="exam-dock">
        <div className="exam-tiles">
          <button type="button" className="exam-tile exam-tile--on"><span className="exam-tile__b pr-tile-b-on">1</span><span className="exam-tile__t pr-tile">あめ</span></button>
          <button type="button" className="exam-tile"><span className="exam-tile__b pr-tile-b">2</span><span className="exam-tile__t exam-tile__t--long pr-tile-long">雨が降っています</span></button>
        </div>
        <div className="exam-dock__nav">
          <button type="button" className="exam-dock__go pr-dock-prev">Previous</button>
          <button type="button" className="exam-dock__go exam-dock__go--next pr-dock-next">Next</button>
        </div>
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
    {/* Plan 173 -- the learner's card, in its three materials: the back's
        print, its meters and its class, the face's foot on the free
        card's band, and the HUD's strip. Each material is a gradient the
        walker cannot composite, so each is pinned at its mid tone, and
        the band where a line is printed on it. */}
    <div className="pcb pcb--free" style={{ background: '#eae8e4' }}>
      <div className="pcb__print"><b className="pcb__value pc-free-value">Rapid · 10 / day</b></div>
      <span className="pcb__meter"><b className="pcb__fig pc-free-fig">640 / 1,000</b><em className="pc-free-note">+1 at 14:48</em></span>
    </div>
    <div className="pcb pcb--free" style={{ background: 'var(--pass-band)' }}>
      <span className="pcb__issued pc-free-issued"><b className="pcb__class">Free</b></span>
    </div>
    <div className="pcf pcf--free" style={{ background: 'var(--pass-band)' }}>
      <span className="pcf__meta pc-free-meta">Practice · locked</span>
      <span className="pcf__class pc-free-class">Free</span>
    </div>
    <div className="pcb pcb--pro" style={{ background: '#221f25' }}>
      <div className="pcb__print"><b className="pcb__value pc-pro-value">Rapid · 10 / day</b></div>
      <span className="pcb__meter"><b className="pcb__fig pc-pro-fig">24 / 60</b><em className="pc-pro-note">1 credit an exercise</em></span>
      <span className="pcb__issued pc-pro-issued"><b className="pcb__class pc-pro-class">Pro</b><span className="pcb__month">Issued March 2026</span></span>
    </div>
    <div className="pcf pcf--pro" style={{ background: '#221f25' }}>
      <span className="pcf__meta pc-pro-meta">1 credit an exercise</span>
    </div>
    <div className="pcb pcb--max" style={{ background: '#e2e4e7' }}>
      <div className="pcb__print"><b className="pcb__value pc-max-value">Rapid · 10 / day</b></div>
      <span className="pcb__meter"><b className="pcb__fig pcb__fig--inf pc-max-inf">∞</b><em className="pc-max-note">No credit</em></span>
      <span className="pcb__issued pc-max-issued"><b className="pcb__class pc-max-class">Max</b><span className="pcb__month">Issued March 2026</span></span>
    </div>
    <div className="pcf pcf--max" style={{ background: '#e2e4e7' }}>
      <span className="pcf__meta pc-max-meta">Unlimited</span>
    </div>
    <div className="hstrip hstrip--free" style={{ background: '#eae8e4' }}>
      <span className="hstrip__lv"><b className="hs-free-lv">12</b></span>
      <span className="hstrip__fig hs-free-fig"><b>12</b></span>
    </div>
    <div className="hstrip hstrip--free hstrip--out" style={{ background: '#eae8e4' }}>
      <span className="hstrip__fig hs-out-fig"><b>0</b></span>
    </div>
    <div className="hstrip hstrip--pro" style={{ background: '#221f25' }}>
      <span className="hstrip__lv"><b className="hs-pro-lv">12</b></span>
      <span className="hstrip__fig hs-pro-fig"><b>24</b></span>
    </div>
    <div className="hstrip hstrip--max" style={{ background: '#e2e4e7' }}>
      <span className="hstrip__lv"><b className="hs-max-lv">12</b></span>
      <span className="hstrip__fig hs-max-fig">∞</span>
    </div>
    {/* Plan 074 -- the statistics' notes and caps, the settings' rows,
        the service cards (on the pass-ink wash when chosen), the level
        strip, the destination chips and the pass line on paper. */}
    <section className="rep-plate">
      <div className="rep-head"><span className="rep-fig">87<span className="rep-fig__u st-unit">%</span></span><span className="rep-delta st-delta">+4 · 12 wk</span></div>
      <span className="rep-cap st-cap">Retention</span>
      <div className="rep-axis"><span className="st-axis">12 wk ago</span></div>
      <div className="rep-ladder"><span className="rep-ladder__step"><b className="rep-ladder__n st-rung-n">231</b><span className="rep-ladder__reach st-rung-cap">1 m</span></span></div>
      <table className="rep-grid"><thead><tr><th className="rep-grid__deck st-deck">N5</th></tr></thead><tbody><tr><td><span className="rep-cell rep-cell--none st-pct-none">—</span></td></tr></tbody></table>
      <button type="button" className="rep-tile"><span className="rep-tile__pct st-tile-pct">40%</span></button>
      <p className="rep-plate__none st-none">Nothing missed</p>
    </section>
    <section className="sbook"><div className="sbook__dows"><span className="sbook__dow sb-dow">M</span></div></section>
    <div className="stg-list">
      <button type="button" className="stg-row">
        <span className="stg-row__names"><span className="stg-row__jp st-row">Sound</span></span>
        <span className="stg-row__value st-value"><span className="stg-meter" /><span className="stg-row__text">Busy station</span></span>
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
        <span className="svc__words sv-on-words">≈ 20 min</span>
      </button>
    </div>
    <div className="svc-chart">
      <button type="button" className="svc-row svc-row--on">
        <span className="svc-row__names"><span className="svc-row__name">Rapid</span><span className="svc-row__pace sr-on-pace">10 / day · ≈ 20 min</span><span className="svc-row__tag sr-on-tag">On the pass</span></span>
        <span className="svc-row__track"><span className="svc-row__when sr-when">7 Aug 2027</span></span>
      </button>
      <button type="button" className="svc-row">
        <span className="svc-row__names"><span className="svc-row__name">Express</span><span className="svc-row__pace sr-pace">20 / day · ≈ 35 min</span></span>
        <span className="svc-row__track"><span className="svc-row__end sr-end">N3</span></span>
      </button>
    </div>
    <div className="dest-stops">
      <div className="dest-here"><span className="dest__dot" /><span className="dest__names"><span className="dest__code">N4</span><span className="dest__load ds-here-load">Elementary</span></span><span className="dest__when dest__when--here ds-here">You are here</span></div>
      <div className="dest-grid">
        <button type="button" className="dest dest--on"><span className="dest__dot" /><span className="dest__names"><span className="dest__code ds-code">N3</span><span className="dest__load ds-load">Intermediate</span></span><span className="dest__when ds-when">7 Aug 2027<span className="dest__tag ds-tag">On the pass</span></span></button>
      </div>
    </div>
    <div className="stg-foot">
      <div className="stg-foot__line dest-line"><span className="cap ds-cap">Valid until</span><b className="dest-line__date ds-date">14 Mar 2027</b><span className="stg-foot__was ds-note">instead of 23 Mar</span></div>
    </div>
    <div className="theme-picks">
      <button type="button" className="theme-pick theme-pick--on"><span className="theme-pick__name tp-on">System</span></button>
      <button type="button" className="theme-pick"><span className="theme-pick__name tp-name">Dark</span></button>
    </div>
    <div className="lang-picks">
      <button type="button" className="lang-pick lang-pick--on"><span className="lang-pick__name">Français</span><span className="lang-pick__sample lp-on-sample">Aujourd’hui · Dictionnaire</span></button>
      <button type="button" className="lang-pick"><span className="lang-pick__name">English</span><span className="lang-pick__sample lp-sample">Today · Dictionary</span></button>
    </div>
    <div className="grades">
      <button type="button" className="grade grade--on"><span className="grade__name gr-on">4 levels</span></button>
    </div>
    <div className="lvl-sheet__figs"><div className="lvl-sheet__fig"><b className="lvl-sheet__fig-v ls-v">1,318</b><span className="lvl-sheet__fig-l ls-l">Marked known</span></div></div>
    <p className="lvl-sheet__body ls-body">The stops are marked <strong className="lvl-sheet__strong ls-strong">known</strong>.</p>

    {/* ── Plans 075 and 168 — the boarding and the sign-in ──
        The boarding stands on the page ground with its answers on
        --surface or drawn on the paper as a map; the departure boards,
        the notification's app mark and the printed pass are sumi
        (pinned inline like the panels above, whose gradients the walker
        cannot composite). The gold inks -- the name in a question, the
        stop picked, the arrival's date, a tag's ring -- and the kana
        line's pigment as ink are exactly the pairs part 1's contract
        cannot see. The desk's own answers (.brd-cell) stand here too. */}
    <div className="brd" data-step="why">
      <h1 className="brd__q">Why, <strong className="brd__q-em ob-q-em">Aiko</strong>?</h1>
      <p className="brd__hint ob-hint">The stops behind you will be marked known.</p>
      <p className="brd__error ob-error">Saving failed</p>
      <button type="button" className="brd__link ob-link">Not now</button>
      <span className="brd-hub ob-hub">2</span>
      <label className="brd-plate"><span className="brd-plate__count ob-plate-count">7 / 20</span></label>
      <span className="brd-name__lab ob-name-next">Why</span>
      <button type="button" className="brd-way"><span className="brd-way__name ob-way">To travel</span></button>
      <button type="button" className="brd-cross__ans" aria-pressed="true">
        <span className="brd-cross__label ob-cross-on">Only <span className="brd-cross__jp" lang="ja">すし</span></span>
        <span className="brd-cross__sub ob-cross-sub-on">the hiragana</span>
      </button>
      <button type="button" className="brd-cross__ans" aria-pressed="false">
        <span className="brd-cross__sub ob-cross-sub">the katakana</span>
      </button>
      <p className="brd-read__script ob-read-script">Hiragana</p>
      <span className="brd-read__glyph ob-read-glyph" lang="ja">あ</span>
      <span className="brd-read__sign"><span className="brd-read__sign-jp ob-read-sign" lang="ja">す</span></span>
      <span className="brd-read__sound ob-read-sound">su</span>
      <span className="brd-read__cap ob-read-cap">means</span>
      <span className="brd-first__ring ob-first-ring" lang="ja">あ</span>
      <div className="brd-map brd-climb">
        <button type="button" className="brd-stn brd-stn--known">
          <span className="brd-stn__ring ob-stn-known">N5</span>
        </button>
        <button type="button" className="brd-stn brd-stn--on" aria-pressed="true">
          <span className="brd-stn__ring ob-stn-on">N4</span>
          <span className="brd-stn__lab">
            <span className="brd-stn__name">Elementary<span className="brd-tag brd-stn__tag ob-tag">Next stop</span></span>
            <span className="brd-stn__desc ob-stn-desc">Everyday talk · ~300 kanji</span>
            <span className="brd-stn__note ob-stn-note">You are here</span>
          </span>
        </button>
      </div>
      <span className="brd-fan__kana ob-fan-kana" lang="ja">あ</span>
      <span className="brd-fan__ticket-lock ob-fan-lock">On every ticket</span>
      <button type="button" className="brd-lcard" data-line="kanji" aria-pressed="true">
        <span className="brd-lcard__ring ob-lcard-ring" lang="ja">漢</span>
        <span className="brd-lcard__desc ob-lcard-desc">The characters</span>
        <span className="brd-lcard__unit ob-lcard-unit">kanji to N4</span>
      </button>
      <p className="brd-arrive">Arrives in <strong className="ob-arrive">June 2027</strong></p>
      <p className="brd-arrive brd-arrive--none ob-arrive-none">Keep one line at least.</p>
      <div className="brd-trains" style={{ background: 'var(--bg-panel)' }}>
        <p className="brd-trains__head ob-trains-head"><span>Service</span></p>
        <button type="button" className="brd-train" aria-pressed="true">
          <span className="brd-train__jp ob-train-jp" lang="ja">快速</span>
          <span className="brd-train__tag ob-train-tag">Recommended</span>
          <span className="brd-train__date ob-train-date">3 Jun 2027</span>
        </button>
        <button type="button" className="brd-train" aria-pressed="false">
          <span className="brd-train__new ob-train-new">~15 new a day</span>
          <span className="brd-train__days ob-train-days">in 248 days</span>
        </button>
      </div>
      <p className="brd-trains__first">First stop: the kana, by <strong className="ob-first-stop">12 Oct</strong></p>
      <div className="brd-board" style={{ background: 'var(--bg-panel)' }}>
        <span className="brd-board__cap ob-board-cap">Departure</span>
        <span className="brd-flap ob-flap">0</span>
        <span className="brd-board__colon ob-colon">:</span>
      </div>
      <button type="button" className="brd-hour" aria-pressed="true">
        <span className="brd-hour__jp ob-hour-jp" lang="ja">朝</span>
        <span className="brd-hour__name ob-hour-name">Morning</span>
      </button>
      <p className="brd-clock__when">Your train · <strong className="ob-when">07:30</strong></p>
      <div className="brd-notif">
        <span className="brd-notif__app ob-notif-app" style={{ background: 'var(--bg-panel)' }}>辻</span>
        <div className="brd-notif__head ob-notif-head"><span>Tsuji</span></div>
        <span className="brd-notif__text ob-notif-text">Your cards are waiting at the gate.</span>
      </div>
      <span className="brd-week__day ob-week-day">1</span>
      <span className="brd-week__date ob-week-date">29 Sep</span>
      <p className="brd-plan__cap ob-plan-cap">Terminus · JLPT N4</p>
      <p className="brd-plan__date ob-plan-date"><span className="brd-plan__day">3 Jun</span></p>
      <p className="brd-plan__sub ob-plan-sub">in <strong>248 days</strong></p>
      <span className="brd-ride__lab brd-ride__lab--today ob-ride-today">Today</span>
      <span className="brd-ride__lab ob-ride-lab">Kana · 12 Oct</span>
      <ul className="brd-held">
        <li className="brd-held__cell" data-line="kanji">
          <span className="brd-held__jp ob-held-jp" lang="ja">漢</span>
          <span className="brd-held__unit ob-held-unit">kanji</span>
        </li>
      </ul>
      <p className="brd-keep__note ob-keep-note">Kept on this phone only.</p>
      <section className="brd-tk">
        <div className="brd-tk__body">
          <span className="brd-tk__kind ob-tk-kind">Ticket</span>
          <span className="brd-tk__stop brd-tk__stop--end"><span className="brd-tk__ring ob-tk-end">N4</span></span>
          <dl className="brd-tk__terms"><div className="brd-tk__term"><dt className="ob-tk-term">Service</dt></div></dl>
        </div>
        <div className="brd-tk__stub">
          <b className="brd-tk__credits ob-tk-credits">200</b>
          <span className="brd-tk__unit ob-tk-unit">credits</span>
          <span className="brd-tk__punch ob-tk-punch">Punched</span>
        </div>
      </section>
      <button type="button" className="brd-cell brd-cell--on" aria-pressed="true">
        <span className="brd-cell__n ob-cell-n">10</span>
        <span className="brd-cell__u ob-cell-u">min a day</span>
        <span className="brd-cell__sub ob-cell-sub">~10 new items</span>
      </button>
    </div>
    <main className="brd brd--welcome brd-front">
      <p className="brd-front__door ob-front-door"><span>Have an account?</span></p>
      <p className="brd-tagline ob-tagline">A ride cut to your size</p>
      <span className="brd-front__stn" style={{ '--pig': 'var(--line-kanji)' }}>
        <span className="brd-front__sign ob-front-sign" lang="ja">漢</span>
        <span className="brd-front__name ob-front-name">Kanji</span>
      </span>
      <div className="brd-signin">
        <div className="brd-signin__form">
          <div className="auth-card brd-signin__card">
            <p className="auth-message auth-message--error ob-auth-error">Wrong password</p>
          </div>
          <p className="auth-foot ob-auth-foot">Everything can be changed later in Settings.</p>
        </div>
      </div>
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
            {/* The due state, where plan 089 put it: the schedule's own
                record cell, and the action under the lattice. The
                floating note this used to measure is retired. */}
            <div className="records">
              <div className="record">
                <span className="record__body">
                  <span className="record__value record__value--due dj-due">Now</span>
                  <span className="record__label">Next review</span>
                </span>
              </div>
            </div>
            <button type="button" className="dict-due dj-due-action">Review this card</button>
          </section>
        </div>
      </article>
    </aside>
    {/* ── 文法 — the lesson in its sheet (plan 146) ──
        Its own shell, under 文法's pine: the Japanese picked out of the
        prose and a use's forms in the lesson's ink (--dict-ink, named on
        .gl too), a form's gloss and a paradigm's label in the secondary
        register, and a sentence's numeral and register tag. */}
    <div className="dict-sheet gl-sheet" style={{ position: 'static' }}>
      <article className="gl gl--sheet">
        <div className="dict-entry__body gl-body">
          <section className="dict-block gl-block gl-block--steps">
            <ol className="gl-steps">
              <li className="gl-step gl-step--use">
                <div className="gl-step__body">
                  <p className="gl-step__p"><span className="gl-ja dj-gl-ja" lang="ja">です</span> relie</p>
                  <ul className="gl-step__list">
                    <li className="gl-use">
                      <span className="gl-use__say">Pour dire ce qu'une chose est</span>
                      <span className="gl-forms"><span className="gl-form">
                        <span className="gl-form__ja dj-gl-form" lang="ja">学生です</span>
                        <span className="gl-form__gloss dj-gl-gloss">je suis étudiant</span>
                      </span></span>
                    </li>
                    <li className="gl-use">
                      <dl className="gl-paradigm"><div className="gl-paradigm__row">
                        <dt className="gl-paradigm__label dj-gl-label">Passé</dt>
                        <dd className="gl-paradigm__forms">でした</dd>
                      </div></dl>
                    </li>
                  </ul>
                </div>
              </li>
            </ol>
          </section>
          <section className="dict-block gl-block gl-block--examples">
            <div className="dict-examples">
              <div className="dict-ex">
                <span className="dict-sense__n dict-ex__n dj-gl-n">5</span>
                <div className="dict-ex__jp" lang="ja">この店はしずかだ。</div>
                <span className="dict-ex__tag dj-gl-tag">Familier</span>
              </div>
            </div>
          </section>
        </div>
      </article>
    </div>
    <span className="dict-tag__tip dj-tip" style={{ position: 'static' }}>Ichidan verb</span>
    {/* The catalogue card wears the same word, faded to marginalia. */}
    <div className="dict-results-grid">
      <div className="dict-entry-card">
        <span className="stage-mark stage-mark--learning dj-card-stage">In progress</span>
        <span className="stage-mark stage-mark--mastered dj-card-stage-gold">Mastered</span>
      </div>
    </div>

    <div className="jour-st--delayed" style={{ background: 'var(--bg-panel)' }}>
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
  ['.lb-band-on', 'console band, the chosen ordering'],
  ['.lb-band-off', 'console band, the other ordering'],
  ['.gc-latin', 'fare gate title'],
  ['.gc-unit', 'fare gate unit'],
  ['.gc-when', 'fare gate next-review line'],
  ['.gc-where', 'gate lane name (tinted surface)'],
  ['.gc-mode', 'gate lane mode (tinted surface)'],
  ['.gc-depart-jp', 'depart button name (gold fill)'],
  ['.gc-depart-latin', 'depart button arrow (gold fill)'],
  ['.lp-roundel', 'plate roundel (pigment mixed toward the ink)'],
  ['.lp-title', 'plate title'],
  ['.lp-meta', 'shelf plate meta'],
  ['.lp-due', 'plate due chip (warning ink)'],
  ['.lp-edge', 'plate foot, the stops either side'],
  ['.lp-here', 'plate foot, the stop reached'],
  // Plan 124 -- 紫, the composition platform's pigment (see the fixture).
  ['.sb-btn', "composition's filled action at rest (紫 mixed 70% toward the panel)"],
  ['.sb-btn-hover', "composition's filled action hovering (the 79% mix)"],
  ['.sb-roundel', "composition's plate roundel (紫 mixed toward the ink)"],
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
  ['.an-furi', 'furigana over the focused token (on its tint)'],
  ['.an-particle', 'particle token'],
  ['.an-hcount', 'shelf chip count'],
  ['.an-n', 'shelf row glyph'],
  ['.an-meta', 'shelf row meta'],
  ['.an-kept', 'shelf Kept mark (stamp ink mixed)'],
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
  ['.pr-tile', 'answer tile (on sumi)'],
  ['.pr-tile-long', 'answer tile, a long answer (on sumi)'],
  ['.pr-tile-b', 'answer tile bubble (on sumi)'],
  ['.pr-tile-b-on', 'answer tile bubble, picked (sumi on its fill)'],
  ['.pr-dock-prev', 'exam dock, previous (soft ink on sumi)'],
  ['.pr-dock-next', 'exam dock, next (on sumi)'],
  ['.pr-rcap', 'result figures caption'],
  ['.pr-rnote', 'result figures note'],
  ['.pr-hint', 'hint line'],
  ['.pr-gscore', 'exam part score'],
  ['.pr-mark-x', 'review mark, missed (danger ink on its tint)'],
  ['.pr-mark-ok', 'review mark, correct (success ink on its tint)'],
  ['.pr-rjp', 'review row question line'],
  ['.pr-rblank', 'review row left blank'],
  ['.pr-slot', 'paper slot (Different paper)'],
  ['.pr-entry', "the run's entry, what the learner typed (on the entry well)"],
  ['.pr-entry::placeholder', "the run's entry placeholder (on the entry well)"],

  // Plan 055's deck shelf, merged in after the guards were written.

  // Plan 063 — the goal line's sumi surfaces and tinted chips.
  ['.ob-q-em', 'boarding question, the name in gold'],
  ['.ob-hint', 'boarding hint (soft ink on page)'],
  ['.ob-error', 'boarding error line (danger on page)'],
  ['.ob-link', 'boarding ghost link'],
  ['.ob-hub', 'a question\'s hub (ink on page)'],
  ['.ob-plate-count', 'the name plate\'s count (soft ink on surface)'],
  ['.ob-name-next', 'the next stop\'s name (soft ink on page)'],
  ['.ob-way', 'a reason at the junction (ink on page)'],
  ['.ob-cross-on', 'the kana answer picked (ink on gold wash)'],
  ['.ob-cross-sub-on', 'the kana answer picked, its script (soft ink on gold wash)'],
  ['.ob-cross-sub', 'a kana answer\'s script (soft ink on surface)'],
  ['.ob-read-script', 'the reveal\'s script caption (soft ink on page)'],
  ['.ob-read-glyph', 'the reveal\'s script glyph (kana pigment on page)'],
  ['.ob-read-sign', 'a sign on its line (ink on page)'],
  ['.ob-read-sound', 'a sign\'s sound (soft ink on page)'],
  ['.ob-read-cap', 'a word\'s meaning caption (soft ink on page)'],
  ['.ob-first-ring', 'the kana\'s stop (kana pigment on page)'],
  ['.ob-stn-known', 'a stop behind (ink on gold fill)'],
  ['.ob-stn-on', 'the stop picked (gold ink on gold wash)'],
  ['.ob-tag', 'the tag (ink in a gold ring)'],
  ['.ob-stn-desc', 'a stop\'s description (soft ink on page)'],
  ['.ob-stn-note', 'you are here (gold ink on page)'],
  ['.ob-fan-kana', 'the kana over the lines\' hub (kana pigment on page)'],
  ['.ob-fan-lock', 'on every ticket (soft ink on page)'],
  ['.ob-lcard-ring', 'a line card\'s glyph (kanji pigment on page)'],
  ['.ob-lcard-desc', 'a line card\'s description (soft ink on gold wash)'],
  ['.ob-lcard-unit', 'a line card\'s unit (soft ink on gold wash)'],
  ['.ob-arrive', 'the lines\' arrival (gold ink on page)'],
  ['.ob-arrive-none', 'no line left (danger on page)'],
  ['.ob-trains-head', 'departure board head (soft panel ink on sumi)'],
  ['.ob-train-jp', 'a train\'s service (lamp on the lit row)'],
  ['.ob-train-tag', 'the recommended train (lamp on the lit row)'],
  ['.ob-train-date', 'the picked train\'s arrival (lamp on the lit row)'],
  ['.ob-train-new', 'a train\'s new items (soft panel ink on sumi)'],
  ['.ob-train-days', 'a train\'s days (soft panel ink on sumi)'],
  ['.ob-first-stop', 'the kana\'s date under the board (gold ink on page)'],
  ['.ob-board-cap', 'departure board caption (soft panel ink on sumi)'],
  ['.ob-flap', 'departure board flap (panel ink on flap face)'],
  ['.ob-colon', 'departure board colon (soft panel ink on sumi)'],
  ['.ob-hour-jp', 'the hour picked (gold ink on gold wash)'],
  ['.ob-hour-name', 'the hour\'s name (soft ink on gold wash)'],
  ['.ob-when', 'the train\'s hour (gold ink on page)'],
  ['.ob-notif-app', 'notification app mark (the mark\'s ink on sumi, plan 158)'],
  ['.ob-notif-head', 'notification head (soft ink on surface)'],
  ['.ob-notif-text', 'notification text (soft ink on surface)'],
  ['.ob-week-day', 'a day\'s bell (gold ink on page)'],
  ['.ob-week-date', 'a day\'s date (soft ink on page)'],
  ['.ob-plan-cap', 'the terminus caption (soft ink on page)'],
  ['.ob-plan-date', 'the arrival\'s date (gold ink on page)'],
  ['.ob-plan-sub', 'the arrival\'s line (soft ink on page)'],
  ['.ob-ride-today', 'the ride\'s today (soft ink on page)'],
  ['.ob-ride-lab', 'a halt on the ride (ink on page)'],
  ['.ob-held-jp', 'what a line holds, its glyph (kanji pigment on page)'],
  ['.ob-held-unit', 'what a line holds, its unit (soft ink on page)'],
  ['.ob-keep-note', 'the account\'s skip note (soft ink on page)'],
  ['.ob-tk-kind', 'the ticket\'s kind (soft ink on surface)'],
  ['.ob-tk-term', 'the ticket\'s term (soft ink on surface)'],
  ['.ob-tk-end', 'the ticket\'s terminus (gold ink on gold wash)'],
  ['.ob-tk-credits', 'the ticket\'s credits (gold ink on surface)'],
  ['.ob-tk-unit', 'the ticket\'s unit (soft ink on surface)'],
  ['.ob-tk-punch', 'the ticket\'s punch (stamp ink on surface)'],
  ['.ob-cell-n', 'chosen cell figure (ink on gold tint)'],
  ['.ob-cell-u', 'chosen cell unit (soft ink on gold tint)'],
  ['.ob-cell-sub', 'chosen cell sub (soft ink on gold tint)'],
  ['.ob-front-door', 'the front door\'s question (soft ink on page)'],
  ['.ob-tagline', 'the promise\'s tagline (soft ink on page)'],
  ['.ob-front-sign', 'a line\'s sign at the crossroads (kanji pigment on page)'],
  ['.ob-front-name', 'a line\'s name at the crossroads (ink on page)'],
  ['.ob-auth-error', 'sign-in error (danger on page)'],
  ['.ob-auth-foot', 'sign-in foot (soft ink on page)'],
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
  ['.st-unit', 'statistics figure unit'],
  ['.st-delta', 'retention delta'],
  ['.st-cap', 'statistics cap'],
  ['.st-axis', 'retention axis caption'],
  ['.st-rung-n', 'ladder rung count'],
  ['.st-rung-cap', 'ladder rung reach'],
  ['.st-pct-none', 'grid cell, none yet'],
  ['.st-deck', 'grid deck head'],
  ['.st-tile-pct', 'weak tile accuracy'],
  ['.st-none', 'line plate note'],
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
  ['.sv-on-jp', 'chosen service card name (on the gold wash)'],
  ['.sv-on-pace', 'chosen service card pace (on the gold wash)'],
  ['.sv-on-words', 'chosen service card minutes (on the gold wash)'],
  ['.sr-on-pace', 'chosen service line pace (on the gold wash)'],
  ['.sr-on-tag', 'chosen service line tag (on the gold wash)'],
  ['.sr-when', 'service line arrival'],
  ['.sr-pace', 'service line pace'],
  ['.sr-end', 'service line stop roundel'],
  ['.ds-here', 'destination, you are here'],
  ['.ds-here-load', 'destination, the stop you stand at'],
  ['.ds-code', 'chosen destination code (on the gold wash)'],
  ['.ds-load', 'chosen destination name (on the gold wash)'],
  ['.ds-when', 'chosen destination arrival (on the gold wash)'],
  ['.ds-tag', 'chosen destination tag (on the gold wash)'],
  ['.ds-cap', 'pass line cap on paper'],
  ['.ds-date', 'pass line date on paper'],
  ['.ds-note', 'pass line former date on paper'],
  ['.tp-on', 'chosen theme name (on the gold wash)'],
  ['.tp-name', 'theme name'],
  ['.lp-on-sample', 'chosen language sample (on the gold wash)'],
  ['.lp-sample', 'language sample'],
  ['.gr-on', 'chosen rating bar name (on the gold wash)'],
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
  ['.dj-gl-ja', 'lesson: Japanese in the prose (文法 pigment mixed toward the ink)'],
  ['.dj-gl-form', 'lesson: a use\'s form (文法 pigment mixed toward the ink)'],
  ['.dj-gl-gloss', 'lesson: a form\'s gloss'],
  ['.dj-gl-label', 'lesson: a paradigm\'s label'],
  ['.dj-gl-n', 'lesson: a sentence\'s numeral (文法 pigment mixed toward the ink)'],
  ['.dj-gl-tag', 'lesson: a sentence\'s register tag (文法 pigment mixed toward the ink)'],
  ['.dj-hit-rt', 'word row: its furigana, in the same ink'],
  ['.dj-due', 'record cell: a card that is due (due ink mixed toward the ink)'],
  ['.dj-due-action', 'the review action under the record (same ink, ghost ground)'],
  ['.dj-tip', 'tag note (panel ink on sumi)'],
  // Plan 173 -- the learner's card and the HUD's strip, on each material.
  ['.pc-free-value', 'card back: the print on white plastic'],
  ['.pc-free-fig', 'card back: a meter\'s figure on white plastic'],
  ['.pc-free-note', 'card back: a meter\'s note on white plastic'],
  ['.pc-free-issued', 'card back: the class on the free card\'s band'],
  ['.pc-free-meta', 'card face: the fare on the free card\'s band'],
  ['.pc-free-class', 'card face: the class on the free card\'s band'],
  ['.pc-pro-value', 'card back: the print on charcoal'],
  ['.pc-pro-fig', 'card back: a meter\'s figure on charcoal'],
  ['.pc-pro-note', 'card back: a meter\'s note on charcoal'],
  ['.pc-pro-issued', 'card back: the month issued on charcoal'],
  ['.pc-pro-class', 'card back: the class in gold on charcoal'],
  ['.pc-pro-meta', 'card face: the fare on charcoal'],
  ['.pc-max-value', 'card back: the print on platinum'],
  ['.pc-max-inf', 'card back: ∞ in gold on platinum'],
  ['.pc-max-note', 'card back: a meter\'s note on platinum'],
  ['.pc-max-issued', 'card back: the month issued on platinum'],
  ['.pc-max-class', 'card back: the class in gold on platinum'],
  ['.pc-max-meta', 'card face: the fare on platinum'],
  ['.hs-free-lv', 'HUD strip: the level on white plastic'],
  ['.hs-free-fig', 'HUD strip: the balance in the band\'s indigo'],
  ['.hs-out-fig', 'HUD strip: a spent balance in the danger\'s ink'],
  ['.hs-pro-lv', 'HUD strip: the level on charcoal'],
  ['.hs-pro-fig', 'HUD strip: the balance in gold on charcoal'],
  ['.hs-max-lv', 'HUD strip: the level on platinum'],
  ['.hs-max-fig', 'HUD strip: ∞ in gold on platinum'],
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
