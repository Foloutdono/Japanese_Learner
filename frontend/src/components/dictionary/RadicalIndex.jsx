import { useState } from 'react'
import { Loading } from '../ui/Loading'

// ── 部首索引 — the radical index, shared ─────────────────────
// Lifted out of DictionaryScreen.jsx (plan 086) because the kanji
// station now asks the same question the dictionary does — which
// radical? — as a study source (components/selection/RadicalSelector.jsx).
// DESIGN.md: a component's markup is used, never hand-copied; so the
// pad, the tile and the page live here once and the two screens
// dress them. What differs between them is what a tile SAYS about its
// radical, and that is the `tile` function RadicalGrid takes.
//
// The pigment is read as `--line-color`: 辞書's gold under the
// dictionary shell, 漢字's ink under the kanji station.

// ── A block's own mark ──
// The station sign, at the size a block gets: the Japanese term set
// large in the collection's own ink, its plain-language twin tracked
// out beside it, a rule under both, and the tally riding the far end as
// data. For the blocks that used to carry a SectionHeader — the
// syllabary charts and the radical index's stroke groups — and, since
// plan 086, the levels of a radical's family.
//
// The rule the heading broke was its bulk, not its second language:
// 五十音 alone tells a learner nothing they can act on, and the charts
// under these marks no longer name their own rows. So the twin is
// printed, not only read out. It is one line either way.
export function BlockMark({ jp, name, tally }) {
  return (
    <div className="dict-mark">
      <span className="dict-mark__jp" lang="ja">{jp}</span>
      {name && <span className="dict-mark__name">{name}</span>}
      {tally != null && <span className="dict-mark__tally">{tally}</span>}
    </div>
  )
}

// "3 traits" — the count in the learner's own words, for the places a
// stroke count is read rather than seen: a key's accessible name and
// the page's label.
const strokes = (n, t) => `${n} ${n === 1 ? t.dictStrokeSingular : t.dictStrokesPlural}`

// ── 画数 — the stroke pad ──
// Every stroke count of the index, on screen at once.
//
// This was a thumb rail off a printed index: one line of numerals that
// scrolled sideways under a fade. On a phone that is seven counts
// visible, the eighth cut in half, and 17画 four flicks away along an
// axis the page itself does not scroll — a sideways drag inside a
// vertical scroller is the one gesture a thumb holding the phone
// cannot make cleanly, and the fade meant to say "there is more" reads
// as a shadow. The page under it had to name its own neighbours
// (‹ 1画 · 6 … 2画 · 23 ›) precisely because the rail was hiding them.
//
// A pad hides nothing. The counts wrap onto as many rows as they need,
// every one is a key a thumb can hit, the page below drops the pager
// with the rail, and nothing on the screen scrolls sideways.
//
// The unit rides the chosen key alone — DESIGN.md, "A gate is a
// pictogram, and only the gate you are on is captioned": a fixed row
// that would otherwise print 画 eighteen times captions the one you
// are on and lets the rest be numerals. The keys are equal cells of a
// grid, so that caption changes no width and the pad never reflows
// under the thumb that just tapped it.
export function StrokePad({ groups, active, onPick, t }) {
  return (
    <nav className="stroke-pad" aria-label={t.dictStrokeIndex}>
      {groups.map(g => {
        const on = g.stroke_count === active
        return (
          <button
            key={g.stroke_count}
            type="button"
            onClick={() => onPick(g.stroke_count)}
            aria-current={on ? 'true' : undefined}
            aria-label={strokes(g.stroke_count, t)}
            className={`stroke-pad__key${on ? ' stroke-pad__key--on' : ''}`}
          >
            <span className="stroke-pad__n">{g.stroke_count}</span>
            {on && <span className="stroke-pad__unit" lang="ja" aria-hidden="true">画</span>}
          </button>
        )
      })}
    </nav>
  )
}

// What the dictionary's tile says: the index's glyph and how many
// characters of the language it files.
function dictionaryTile(r) {
  return { glyph: r.char, count: r.kanji_count, title: `${r.kanji_count} kanji` }
}

// One radical. `learned` is optional — the dictionary has no such
// figure, the study index prints `learned / count` — and `sub` is the
// plain-language meaning the study index needs and the dictionary's
// browse does not (its tiles stand under a search field; the study
// tiles are the choice itself).
//
// Where there is a figure, the share of the family already learned is
// drawn along the tile's own bottom edge as well as printed: the
// catalogue tile's instrument (DESIGN.md, "the stage is that card's
// own bottom edge"), and the difference between a number you read and
// a thing you see on a page of thirty-seven of them.
export function RadicalTile({ glyph, count, sub, learned, title, started, onPick }) {
  const done = learned != null && count > 0 ? Math.min(1, learned / count) : null
  return (
    <button
      type="button"
      onClick={onPick}
      title={title}
      className={`radical-tile${started ? ' radical-tile--started' : ''}`}
    >
      <span className="radical-tile__char" lang="ja">{glyph}</span>
      {sub && <span className="radical-tile__sub">{sub}</span>}
      <span className="radical-tile__count">
        {learned != null ? <><b>{learned}</b>/ {count}</> : count}
      </span>
      {done != null && <span className="radical-tile__run" style={{ '--done': done }} aria-hidden="true" />}
    </button>
  )
}

// The tail of the index is thin — 15画 files one radical, 12画 four —
// and a short page in the full grid's column count left a screen of
// nothing under two rows of small tiles. At or below this many, the
// page spends the room it has on its own tiles instead (see
// `[data-fill="short"]` in index.css).
const ROOMY_MAX = 8

/**
 * RadicalGrid — one stroke count at a time.
 *
 * Props:
 *   groups   — [{ stroke_count, radicals: [...] }], stroke count ascending
 *   loading  — the three dots while the groups are on their way
 *   onPick(number)
 *   tile(r)  — what a tile prints for radical `r`:
 *              { glyph, count, sub?, learned?, title?, started? }.
 *   order    — 'index' (the default) keeps the index's own order, by
 *              Kangxi number, because that is what a lookup runs on;
 *              'rank' puts the biggest families first, which is what a
 *              learner CHOOSING one is choosing on (氵 files 123 of the
 *              course's kanji and 夂 one).
 *
 *              One grid, one order, either way. It was two grids — the
 *              six biggest of a page, larger, over the rest in Kangxi
 *              order — and on a page whose first row read 水 手 心 口
 *              辶 土 and whose second went back to 口 土 夂, the index
 *              looked broken rather than weighted. The weight is the
 *              order now, and the figure on each tile says what it is.
 *   stroke / onStroke — the page, controlled by the caller when it
 *              carries the page in its URL (so leaving a lesson lands
 *              back on the page it was opened from); local otherwise.
 *   t        — the string table
 */
export function RadicalGrid({ groups, loading, onPick, t, tile = dictionaryTile, stroke: strokeProp, onStroke, order = 'index' }) {
  const [ownStroke, setOwnStroke] = useState(null)
  const stroke = strokeProp ?? ownStroke
  const setStroke = n => { if (onStroke) onStroke(n); else setOwnStroke(n) }

  if (loading || !groups) {
    return <Loading />
  }
  if (!groups.length) return null

  const index = Math.max(0, groups.findIndex(g => g.stroke_count === stroke))
  const group = groups[index]

  const rows = group.radicals.map(r => ({ number: r.number, ...tile(r) }))
  if (order === 'rank') rows.sort((a, b) => b.count - a.count || a.number - b.number)

  // A tile that carries a meaning is chosen ON that meaning, so it
  // needs the width to print one — four to a phone rather than six,
  // where "marche…", "soi-mê…" and "tête de …" were what the learner
  // had to pick between. Read off the tiles rather than taken as a
  // prop: whether there is a second line is the `tile` function's
  // answer, and the grid should not have to be told it twice.
  const labelled = rows.some(r => r.sub)

  return (
    <div className="dict-radical-index">
      <StrokePad groups={groups} active={group.stroke_count} onPick={setStroke} t={t} />

      {/* No mark over the page: the pad above names the stroke count
          and lights the one being read, and the section's aria-label
          says it for a reader. */}
      <section
        className="radical-page"
        data-stroke={group.stroke_count}
        data-fill={rows.length <= ROOMY_MAX ? 'short' : undefined}
        aria-label={strokes(group.stroke_count, t)}
      >
        <div className={`radical-page__grid${labelled ? ' radical-page__grid--labelled' : ''}`}>
          {rows.map(r => <RadicalTile key={r.number} {...r} onPick={() => onPick(r.number)} />)}
        </div>
      </section>
    </div>
  )
}
