import { useEffect, useRef, useState } from 'react'
import { Loading } from '../ui/Loading'

// ── 部首索引 — the radical index, shared ─────────────────────
// Lifted out of DictionaryScreen.jsx (plan 086) because the kanji
// station now asks the same question the dictionary does — which
// radical? — as a study source (components/selection/RadicalSelector.jsx).
// DESIGN.md: a component's markup is used, never hand-copied; so the
// strip, the tile and the page live here once and the two screens
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

// The thumb rail off a printed radical index, one line: the stroke
// counts that scroll sideways, the read one underlined in the line's
// ink and kept in view.
//
// No scrollbar under it, on any pointer — and no scrollbar DECLARATION
// either, since styling one at all is what summons a phone's classic
// bar (index.css, "Themed scrollbar"; index.scrollbar.browser.test.jsx
// holds every such rule behind `pointer: fine`). The bar is clipped
// instead: the rail scrolls inside a wrapper that hides its bottom
// edge, where the bar is drawn. What says "there is more" is quieter
// than a bar: the numerals run off the edge into a fade, on whichever
// side there is more to see — `data-edge` is which — and the page
// under it names its neighbours.
function edgeOf(el) {
  if (!el || el.scrollWidth <= el.clientWidth + 1) return 'none'
  const atStart = el.scrollLeft <= 1
  const atEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - 1
  return atStart ? 'start' : atEnd ? 'end' : 'mid'
}

export function StrokeStrip({ groups, active, onPick, t }) {
  const tabRefs = useRef(new Map())
  const railRef = useRef(null)
  const [edge, setEdge] = useState('none')
  useEffect(() => {
    tabRefs.current.get(active)?.scrollIntoView({ inline: 'center', block: 'nearest' })
  }, [active])
  useEffect(() => {
    const el = railRef.current
    if (!el) return undefined
    const update = () => setEdge(edgeOf(el))
    update()
    el.addEventListener('scroll', update, { passive: true })
    const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(update) : null
    ro?.observe(el)
    return () => { el.removeEventListener('scroll', update); ro?.disconnect() }
  }, [groups])
  return (
    <div className="stroke-strip__clip">
      <nav className="stroke-strip" ref={railRef} data-edge={edge} aria-label={t.dictStrokeIndex}>
        {groups.map(g => (
          <button
            key={g.stroke_count}
            type="button"
            ref={el => { tabRefs.current.set(g.stroke_count, el) }}
            onClick={() => onPick(g.stroke_count)}
            aria-current={active === g.stroke_count ? 'true' : undefined}
            className={`stroke-strip__tab${active === g.stroke_count ? ' stroke-strip__tab--active' : ''}`}
          >
            <span className="stroke-strip__n">{g.stroke_count}</span>
            <span className="stroke-strip__unit" lang="ja">画</span>
          </button>
        ))}
      </nav>
    </div>
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
export function RadicalTile({ glyph, count, sub, learned, title, lead, started, onPick }) {
  return (
    <button
      type="button"
      onClick={onPick}
      title={title}
      className={`radical-tile${lead ? ' radical-tile--lead' : ''}${started ? ' radical-tile--started' : ''}`}
    >
      <span className="radical-tile__char" lang="ja">{glyph}</span>
      {sub && <span className="radical-tile__sub">{sub}</span>}
      <span className="radical-tile__count">
        {learned != null ? <><b>{learned}</b>/ {count}</> : count}
      </span>
    </button>
  )
}

const LEAD_COUNT = 6

/**
 * RadicalGrid — one stroke count at a time.
 *
 * Props:
 *   groups   — [{ stroke_count, radicals: [...] }], stroke count ascending
 *   loading  — the three dots while the groups are on their way
 *   onPick(number)
 *   tile(r)  — what a tile prints for radical `r`:
 *              { glyph, count, sub?, learned?, title?, started? }.
 *              The lead six of a page are the six with the biggest
 *              `count` — 氵 files 656 characters and 夂 four, and on a
 *              page of 37 the big ones are what the eye should land
 *              on. The rest keep the index's own order, by number.
 *   stroke / onStroke — the page, controlled by the caller when it
 *              carries the page in its URL (so leaving a lesson lands
 *              back on the page it was opened from); local otherwise.
 *   t        — the string table
 */
export function RadicalGrid({ groups, loading, onPick, t, tile = dictionaryTile, stroke: strokeProp, onStroke }) {
  const [ownStroke, setOwnStroke] = useState(null)
  const stroke = strokeProp ?? ownStroke
  const setStroke = n => { if (onStroke) onStroke(n); else setOwnStroke(n) }

  if (loading || !groups) {
    return <Loading />
  }
  if (!groups.length) return null

  const index = Math.max(0, groups.findIndex(g => g.stroke_count === stroke))
  const group = groups[index]
  const prev = groups[index - 1]
  const next = groups[index + 1]

  const rows = group.radicals.map(r => ({ number: r.number, ...tile(r) }))
  const ranked = [...rows].sort((a, b) => b.count - a.count)
  const leadSet = new Set(ranked.slice(0, LEAD_COUNT).map(r => r.number))
  const lead = ranked.slice(0, LEAD_COUNT)
  const rest = rows.filter(r => !leadSet.has(r.number))

  const unit = n => `${n} ${n === 1 ? t.dictStrokeSingular : t.dictStrokesPlural}`
  const draw = (r, isLead) => (
    <RadicalTile key={r.number} {...r} lead={isLead} onPick={() => onPick(r.number)} />
  )

  return (
    <div className="dict-radical-index">
      <StrokeStrip groups={groups} active={group.stroke_count} onPick={setStroke} t={t} />

      <section className="radical-page" data-stroke={group.stroke_count} aria-label={unit(group.stroke_count)}>
        {/* No mark over the page: the strip above already names the
            stroke count and lights the one being read, and the
            section's aria-label says it for a reader. */}
        <div className="radical-page__lead">
          {lead.map(r => draw(r, true))}
        </div>
        {rest.length > 0 && (
          <div className="radical-page__rest">
            {rest.map(r => draw(r, false))}
          </div>
        )}
        {/* The neighbouring pages, named — the strip above scrolls
            the far counts out of view, and a page should say what
            is either side of it. */}
        <div className="radical-page__pager">
          {prev && (
            <button type="button" className="radical-page__turn" onClick={() => setStroke(prev.stroke_count)}>
              ‹ <span lang="ja">{prev.stroke_count}画</span> · {prev.radicals.length}
            </button>
          )}
          {next && (
            <button type="button" className="radical-page__turn radical-page__turn--next" onClick={() => setStroke(next.stroke_count)}>
              <span lang="ja">{next.stroke_count}画</span> · {next.radicals.length} ›
            </button>
          )}
        </div>
      </section>
    </div>
  )
}
