import { useState, useMemo } from 'react'
import { useLang } from '../../LangContext'
import {
  CATEGORIES, DIMENSIONS, categoryLabel, dimensionLabel,
  groupRows, sortItems, sortLabel, sortArrow, sumRows, SORTS,
} from '../../domain/statsModel'
import { BoltIcon, ChevronIcon } from '../ui/Icons'

// ── 一覧 — the Explorer ────────────────────────────────────
// The old stats screen printed the payload: four sections, eighteen
// cards, seventy little progress bars, in the order the backend
// happened to nest them. Everything was on the page and nothing was
// answerable — you cannot see from it whether your recall is worse
// than your recognition, which level is dragging, or where the due
// pile actually is.
//
// This is the same seventy rows, pivotable. Pick an axis to group by,
// a measure to sort by, a category to narrow to; the totals bar
// recomputes against whatever is on screen, and any group opens to
// show the rows underneath it. Nothing is fetched — every arrangement
// is the same flattened array read a different way, so it's instant
// and it can't disagree with itself.
export function Explorer({ rows, onStartReview }) {
  const { t } = useLang()
  const [category, setCategory] = useState('all')
  const [dim, setDim]           = useState('group')
  const [sort, setSort]         = useState('mastery')
  const [desc, setDesc]         = useState(true)
  const [open, setOpen]         = useState(() => new Set())

  const filtered = useMemo(
    () => (category === 'all' ? rows : rows.filter(r => r.category === category)),
    [rows, category],
  )

  const groups = useMemo(
    () => sortItems(groupRows(filtered, dim, t), sort, desc),
    [filtered, dim, sort, desc, t],
  )

  const totals = useMemo(() => sumRows(filtered), [filtered])

  function toggle(key) {
    setOpen(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  // Re-sorting by the measure already selected flips its direction —
  // the second click on "accuracy" is always "no, the other end".
  function pickSort(key) {
    if (key === sort) setDesc(d => !d)
    else { setSort(key); setDesc(true) }
  }

  return (
    <div className="explorer">
      <div className="explorer__controls">
        <ChipRow
          label={t.dimCategory}
          value={category}
          onChange={setCategory}
          options={[
            { key: 'all', label: t.allCategories },
            ...CATEGORIES.map(c => ({ key: c, label: categoryLabel(t, c) })),
          ]}
        />
        <ChipRow
          label={t.groupBy}
          value={dim}
          onChange={setDim}
          options={DIMENSIONS.map(d => ({ key: d, label: dimensionLabel(t, d) }))}
        />
        <ChipRow
          label={t.sortBy}
          value={sort}
          onChange={pickSort}
          options={SORTS.map(s => ({
            key: s,
            label: s === sort ? `${sortLabel(t, s)} ${sortArrow(s, desc)}` : sortLabel(t, s),
          }))}
        />
      </div>

      <TotalsBar totals={totals} count={filtered.length} t={t} />

      <div className="explorer__rows">
        {groups.map(group => (
          <GroupRow
            key={`${group.dim}:${group.key}`}
            group={group}
            expanded={open.has(group.key)}
            onToggle={() => toggle(group.key)}
            sort={sort}
            desc={desc}
            onStartReview={onStartReview}
            t={t}
          />
        ))}
      </div>
    </div>
  )
}

function ChipRow({ label, value, options, onChange }) {
  return (
    <div className="explorer__control">
      <span className="explorer__control-label">{label}</span>
      <div className="explorer__chips">
        {options.map(o => (
          <button
            key={o.key}
            type="button"
            onClick={() => onChange(o.key)}
            className={`explorer__chip${o.key === value ? ' explorer__chip--on' : ''}`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  )
}

// The one line that answers "so where does that leave me" for whatever
// slice is currently on screen.
function TotalsBar({ totals, count, t }) {
  return (
    <div className="explorer__totals">
      <Composition row={totals} />
      <div className="explorer__totals-figures">
        <Figure value={`${Math.round(totals.masteryPct)}%`} label={t.mastered} tone="mastered" />
        <Figure value={totals.learning.toLocaleString()} label={t.learning} tone="learning" />
        <Figure value={totals.new.toLocaleString()} label={t.new} tone="new" />
        <Figure value={totals.due.toLocaleString()} label={t.dueNow} tone="due" />
        <Figure
          value={totals.accuracyPct === null ? '—' : `${Math.round(totals.accuracyPct)}%`}
          label={t.accuracy}
          tone="accuracy"
        />
        <Figure value={count} label={t.buckets} tone="muted" />
      </div>
    </div>
  )
}

function Figure({ value, label, tone }) {
  return (
    <span className={`explorer__figure explorer__figure--${tone}`}>
      <span className="explorer__figure-value">{value}</span>
      <span className="explorer__figure-label">{label}</span>
    </span>
  )
}

function GroupRow({ group, expanded, onToggle, sort, desc, onStartReview, t }) {
  const leaves = useMemo(() => sortItems(group.rows, sort, desc), [group.rows, sort, desc])
  const { totals } = group

  return (
    <div className={`explorer-group${expanded ? ' explorer-group--open' : ''}`}>
      <button type="button" className="explorer-group__head" onClick={onToggle}>
        <ChevronIcon direction={expanded ? 'down' : 'right'} size={13} className="explorer-group__caret" />
        <span className="explorer-group__label">{group.label}</span>
        <span className="explorer-group__pct">{Math.round(totals.masteryPct)}%</span>
        <Composition row={totals} />
        <span className="explorer-group__counts">
          {totals.mastered.toLocaleString()} / {totals.total.toLocaleString()}
        </span>
        {/* The empty case is rendered, not skipped — same as LeafRow
            below. Dropping the element entirely let the composition bar
            grow into the space on rows with nothing due, so the bars
            ended at a different x on every row. */}
        {totals.due > 0
          ? <span className="explorer-group__due">{totals.due}</span>
          : <span className="explorer-group__due explorer-group__due--empty" aria-hidden="true" />}
      </button>

      {expanded && (
        <div className="explorer-group__body">
          {leaves.map(row => (
            <LeafRow key={row.id} row={row} dim={group.dim} onStartReview={onStartReview} t={t} />
          ))}
        </div>
      )}
    </div>
  )
}

// A leaf has to name the coordinates its group *doesn't*. Under "N3"
// every row is N3, so repeating it says nothing while "vocabulary" vs
// "kanji" is the thing you need; under "kanji" it's the other way
// round; under "recall" you need both. Printing row.group regardless —
// which is what this did first — makes three different rows under N3
// all read "N3 · MCQ → word".
function LeafRow({ row, dim, onStartReview, t }) {
  const kicker =
    dim === 'group'    ? categoryLabel(t, row.category) :
    dim === 'category' ? row.group :
    `${categoryLabel(t, row.category)} · ${row.group}`

  return (
    <div className="explorer-leaf">
      <span className="explorer-leaf__name">
        <span className="explorer-leaf__group">{kicker}</span>
        <span className="explorer-leaf__mode">{row.label}</span>
      </span>

      <Composition row={row} />

      <span className="explorer-leaf__numbers">
        <span className="explorer-leaf__pct">{Math.round(row.masteryPct)}%</span>
        <span className="explorer-leaf__acc" title={t.accuracy}>
          {row.accuracyPct === null ? '—' : `${Math.round(row.accuracyPct)}%`}
        </span>
        <span className="explorer-leaf__size">{row.total}</span>
      </span>

      {row.due > 0 ? (
        <button
          type="button"
          className="explorer-leaf__due"
          title={t.reviewNow}
          onClick={() => onStartReview(row.category, row.group, row.mode)}
        >
          <BoltIcon size={11} /> {row.due}
        </button>
      ) : (
        <span className="explorer-leaf__due explorer-leaf__due--empty" aria-hidden="true" />
      )}
    </div>
  )
}

// Three segments over the whole width: mastered, learning, and the
// untouched remainder. Percentages of the same total, so the bar is
// comparable between a 12-card kana set and a 1500-word level — which
// is the entire reason it isn't a count.
function Composition({ row }) {
  const total = Math.max(1, row.total)
  const mastered = (row.mastered / total) * 100
  const learning = (row.learning / total) * 100

  return (
    <span className="composition" aria-hidden="true">
      <span className="composition__seg composition__seg--mastered" style={{ width: `${mastered}%` }} />
      <span className="composition__seg composition__seg--learning" style={{ width: `${learning}%` }} />
    </span>
  )
}
