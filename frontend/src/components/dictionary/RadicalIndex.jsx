import { useEffect, useRef, useState } from 'react'
import { Loading } from '../ui/Loading'
import { ChevronIcon } from '../ui/Icons'
import { byRank } from '../../domain/radicals'
import { SplitRow } from '../selection/SplitRow'

// ── 部首索引 — the radical index, shared ─────────────────────
// Lifted out of DictionaryScreen.jsx (plan 086) because the kanji
// station now asks the same question the dictionary does — which
// radical? — as a study source (components/selection/RadicalSelector.jsx).
// DESIGN.md: a component's markup is used, never hand-copied; so the
// rail, the tile and the page live here once and the screens that ask
// the question dress them — the two indexes, and the deck form's
// radical field (screens/DeckDetailScreen.jsx), which files a personal
// card under a radical and reaches for the rail alone. What differs between them is what a tile SAYS about its
// radical, and that is the `tile` function RadicalGrid takes.
//
// The pigment is read as `--line-color`: 辞書's gold under the
// dictionary shell, 漢字's ink under the kanji station.

// ── A block's own mark ──
// The station sign, at the size a block gets: the block's name in the
// collection's own ink, a rule under it, and the tally riding the far
// end as data. For the blocks that used to carry a SectionHeader — the
// syllabary charts and the radical index's stroke groups — and, since
// plan 086, the levels of a radical's family.
//
// It was a pair, the Japanese term set large with its plain-language
// twin tracked out beside it. The owner's call of 2026-09-21 retired
// the Japanese half wherever it captioned a part rather than naming a
// place: 五十音 alone tells a learner nothing they can act on, which
// was the argument for printing the twin in the first place, and the
// twin is the whole mark now — set at the rung and in the ink the term
// used to hold (see .dict-mark__name).
//
// `code` is the ONE lead the mark still carries, and it is never
// Japanese: the JLPT level over a radical family's grid (N5), where
// the level is the thing being named and the plain-language line under
// it is the gloss.
export function BlockMark({ code, name, tally }) {
  return (
    <div className="dict-mark">
      {code && <span className="dict-mark__code">{code}</span>}
      {name && <span className="dict-mark__name">{name}</span>}
      {tally != null && <span className="dict-mark__tally">{tally}</span>}
    </div>
  )
}

// "3 traits" — the count in the learner's own words, for the places a
// stroke count is read rather than seen: a key's accessible name and
// the page's label.
const strokes = (n, t) => `${n} ${n === 1 ? t.dictStrokeSingular : t.dictStrokesPlural}`

// ── 画数 — the stroke rail ──
// One line of stroke counts: swiped, or walked with a button at
// either end.
//
// It was a rail the learner could ONLY drag: seven of eighteen counts
// fit a 390px phone, the eighth was cut by a fade, and the rest were
// behind a sideways drag inside a page that scrolls the other way —
// the one gesture a thumb holding the phone cannot make cleanly. The
// page under it had to name its own neighbours (‹ 1画 · 6 … 2画 · 23 ›)
// precisely because the rail was hiding them.
//
// So the two chevrons do the walking: each steps to the next stroke
// count, the rail carries the read one to the middle of the track, and
// the counts either side of it stay one tap away. The swipe stays as
// the shortcut for a thumb that would rather flick — it is the only
// way to reach a count without also reading its page, which is what
// makes it worth keeping beside the buttons.
//
// Eighteen keys wrapped onto three rows was the other way to show them
// all, and it read as a number pad over an index rather than as the
// page's own control. Owner's call, from the two side by side.
//
// A key is a bare figure. The chosen one carried 画 for a while —
// DESIGN.md's "only the gate you are on is captioned", applied to a
// row that would otherwise print the unit eighteen times — and the
// owner took it off: the numerals under a page of radicals are read
// as what they are, and the one mark that broke their line was the
// caption. `strokes()` still says "3 traits" to a screen reader on
// every key, where a unit costs no ink.
export function StrokeRail({ groups, active, onPick, t }) {
  const keys = useRef(new Map())
  const at = Math.max(0, groups.findIndex(g => g.stroke_count === active))
  const prev = groups[at - 1]
  const next = groups[at + 1]

  // The read key, carried to the middle of the track. Smoothly, unless
  // the phone has asked for stillness — a rail that jumps under the
  // thumb that moved it is the motion this is for.
  useEffect(() => {
    const el = keys.current.get(active)
    if (!el?.scrollIntoView) return
    const still = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    el.scrollIntoView({ inline: 'center', block: 'nearest', behavior: still ? 'auto' : 'smooth' })
  }, [active])

  const step = (to, dir, label) => (
    <button
      type="button"
      className={`stroke-rail__step stroke-rail__step--${dir}`}
      disabled={!to}
      aria-label={label}
      onClick={() => to && onPick(to.stroke_count)}
    >
      <ChevronIcon direction={dir} size={16} />
    </button>
  )

  return (
    <nav className="stroke-rail" aria-label={t.dictStrokeIndex}>
      {step(prev, 'left', t.dictStrokePrev)}
      {/* The clip is what keeps a scrollbar off the swipe: the track
          scrolls inside a wrapper that hides its bottom edge, where a
          bar — overlay or classic — is drawn. Styling one instead is
          what summons a phone's classic bar (index.css, "Themed
          scrollbar"). */}
      <div className="stroke-rail__clip">
        <div className="stroke-rail__track">
          {groups.map(g => {
            const on = g.stroke_count === active
            return (
              <button
                key={g.stroke_count}
                type="button"
                ref={el => { keys.current.set(g.stroke_count, el) }}
                onClick={() => onPick(g.stroke_count)}
                aria-current={on ? 'true' : undefined}
                aria-label={strokes(g.stroke_count, t)}
                className={`stroke-rail__key${on ? ' stroke-rail__key--on' : ''}`}
              >
                <span className="stroke-rail__n">{g.stroke_count}</span>
              </button>
            )
          })}
        </div>
      </div>
      {step(next, 'right', t.dictStrokeNext)}
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
//
// `current` is the desk's (plan 118): the radical whose page stands
// beside the index, marked the way an open stop is. So is `to` (plan
// 120): the radical's page's URL, which makes the tile a link that
// replaces the page (SplitRow), so a radical opens in a tab of its own
// too. Without it — a phone, the dictionary — the tile is the button it
// always was.
export function RadicalTile({ glyph, count, sub, learned, title, started, current, onPick, to = null }) {
  const done = learned != null && count > 0 ? Math.min(1, learned / count) : null
  return (
    <SplitRow
      to={to}
      onClick={onPick}
      title={title}
      aria-current={current ? 'page' : undefined}
      className={`radical-tile${started ? ' radical-tile--started' : ''}`}
    >
      <span className="radical-tile__char" lang="ja">{glyph}</span>
      {sub && <span className="radical-tile__sub">{sub}</span>}
      <span className="radical-tile__count">
        {learned != null ? <><b>{learned}</b>/ {count}</> : count}
      </span>
      {done != null && <span className="radical-tile__run" style={{ '--done': done }} aria-hidden="true" />}
    </SplitRow>
  )
}

// The tail of the index is thin — 15画 files one radical, 12画 a
// couple, 10画 nine — and a short page drawn at the full grid's
// column count left a screen of nothing under two rows of small
// tiles. At or below this many, the page picks its own column count
// instead and spends the width on its own tiles (see `columns` below
// and `[data-fill="short"]` in index.css).
const ROOMY_MAX = 12

// How many columns a short page uses: about the square root of what
// it holds, so the block reads as wide as it is tall — nine radicals
// as three rows of three, not as six and then three — and every tile
// grows to an equal share of the row. Capped, because past four
// columns the tiles stop growing and past two the room is already
// spent: a page of two is two tiles, not two plates (the cap on the
// track itself, in index.css, is what stops them). A labelled tile
// prints a meaning and is wider to start with, so it takes one column
// fewer.
const columns = (n, labelled) => Math.min(labelled ? 3 : 4, Math.max(1, Math.ceil(Math.sqrt(n))))

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
 *   selected — the desk's (plan 118): the radical whose lesson stands
 *              beside the index. Its tile is marked, the index opens on
 *              the page it is on rather than on the first, and the tile
 *              is kept in view in the list's own scroll.
 *   linkTo(number) — the desk's (plan 120): the URL a radical's page
 *              stands at, which makes each tile a link to it (RadicalTile's
 *              `to`); `onPick` still runs on the click, for its sound.
 *   t        — the string table
 */
export function RadicalGrid({ groups, loading, onPick, t, tile = dictionaryTile, stroke: strokeProp, onStroke, order = 'index', selected, linkTo = null }) {
  const [ownStroke, setOwnStroke] = useState(null)
  const page = useRef(null)
  const stroke = strokeProp ?? ownStroke
  const setStroke = n => { if (onStroke) onStroke(n); else setOwnStroke(n) }

  // The open radical's tile, kept in view in the column it scrolls in —
  // the grammar index does the same for its open row. Nothing without
  // a selection, which is every caller but the desk's.
  useEffect(() => {
    if (selected == null) return
    page.current?.querySelector('[aria-current="page"]')?.scrollIntoView?.({ block: 'nearest' })
  }, [selected, groups])

  if (loading || !groups) {
    return <Loading />
  }
  if (!groups.length) return null

  let index = groups.findIndex(g => g.stroke_count === stroke)
  if (index < 0 && selected != null) index = groups.findIndex(g => g.radicals.some(r => r.number === selected))
  const group = groups[Math.max(0, index)]

  const rows = group.radicals.map(r => ({ number: r.number, ...tile(r) }))
  if (order === 'rank') rows.sort(byRank)

  // A tile that carries a meaning is chosen ON that meaning, so it
  // needs the width to print one — four to a phone rather than six,
  // where "marche…", "soi-mê…" and "tête de …" were what the learner
  // had to pick between. Read off the tiles rather than taken as a
  // prop: whether there is a second line is the `tile` function's
  // answer, and the grid should not have to be told it twice.
  const labelled = rows.some(r => r.sub)
  const short = rows.length <= ROOMY_MAX

  return (
    <div className="dict-radical-index">
      <StrokeRail groups={groups} active={group.stroke_count} onPick={setStroke} t={t} />

      {/* No mark over the page: the rail above names the stroke count
          and lights the one being read, and the section's aria-label
          says it for a reader. */}
      <section
        ref={page}
        className="radical-page"
        data-stroke={group.stroke_count}
        data-fill={short ? 'short' : undefined}
        style={short ? { '--cols': columns(rows.length, labelled) } : undefined}
        aria-label={strokes(group.stroke_count, t)}
      >
        <div className={`radical-page__grid${labelled ? ' radical-page__grid--labelled' : ''}`}>
          {rows.map(r => <RadicalTile key={r.number} {...r} current={selected != null && r.number === selected} onPick={() => onPick(r.number)} to={linkTo?.(r.number)} />)}
        </div>
      </section>
    </div>
  )
}
