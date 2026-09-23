import { useState } from 'react'
import { useLang } from '../../LangContext'
import { Sheet } from '../chrome/Sheet'
import { getSections } from '../../config/tabs'
import { stationFor } from '../../config/stations'
import { TRACKED_LINES } from '../../domain/lineProgress'
import { groupLabel } from '../../domain/statsModel'

// ── 路線別 — by line (plan 085) ───────────────────────────
// One row per SRS line, the way the profile's ledger draws them — the
// roundel in the line's own pigment (a place may wear it), the name —
// then the composition in the three state inks and the line's
// retention as a numeral. A row opens a sheet with the same reading
// per level, which is the one drill-down the old Explorer's five
// dimensions were ever used for.
//
// `inline` is the desk's reading (plan 114): no sheet. A row opens its
// levels right under itself, the first line open on arrival, one line
// open at a time — the drill-down is on the page it drills into.
export function LineRows({ rows, inline = false }) {
  const { t } = useLang()
  const [open, setOpen] = useState(null)
  // The desk's open line; null until a row is pressed, which reads as
  // the first line. A second press on the open row folds it.
  const [shown, setShown] = useState(undefined)
  const sections = getSections('learn', t).filter(s => TRACKED_LINES[s.path])
  const byCategory = new Map(rows.map(r => [r.category, r]))

  const lines = sections
    .map(s => ({ section: s, row: byCategory.get(TRACKED_LINES[s.path]) }))
    .filter(l => l.row && l.row.total > 0)
  if (!lines.length) return null

  if (inline) {
    const current = shown === undefined ? lines[0].row.category : shown
    return (
      <div className="rep-lines desk-lines">
        {lines.map(({ section, row }) => {
          const on = row.category === current
          return (
            <div key={row.category} className={`desk-lines__line${on ? ' desk-lines__line--open' : ''}`} style={{ '--line-color': section.color }}>
              <button
                type="button"
                className="rep-line-row"
                onClick={() => setShown(on ? null : row.category)}
                aria-expanded={on}
                aria-label={`${section.title}${row.retention === null ? '' : ` · ${row.retention}%`}`}
              >
                <span className="pf-line__roundel" aria-hidden="true">{stationFor(section.path).code}</span>
                <span className="rep-line-row__name">{section.title}</span>
                <Composition row={row} />
                <Pct value={row.retention} />
              </button>
              {on && <div className="desk-lines__levels"><LevelRows row={row} /></div>}
            </div>
          )
        })}
      </div>
    )
  }

  const opened = open && lines.find(l => l.row.category === open)

  return (
    <>
      <div className="rep-lines">
        {lines.map(({ section, row }) => (
          <button
            type="button"
            key={row.category}
            className="rep-line-row"
            style={{ '--line-color': section.color }}
            onClick={() => setOpen(row.category)}
            aria-label={`${section.title}${row.retention === null ? '' : ` · ${row.retention}%`}`}
          >
            <span className="pf-line__roundel" aria-hidden="true">{stationFor(section.path).code}</span>
            <span className="rep-line-row__name">{section.title}</span>
            <Composition row={row} />
            <Pct value={row.retention} />
          </button>
        ))}
      </div>

      <Sheet
        open={Boolean(opened)}
        onClose={() => setOpen(null)}
        jp={opened ? opened.section.icon : undefined}
        cap={opened ? opened.section.title : undefined}
        label={opened ? opened.section.title : undefined}
      >
        {opened && (
          <div className="rep-lines rep-lines--sheet" style={{ '--line-color': opened.section.color }}>
            <LevelRows row={opened.row} />
          </div>
        )}
      </Sheet>
    </>
  )
}

function LevelRows({ row }) {
  const { t } = useLang()
  return row.levels.map(level => (
    <div key={level.key} className="rep-line-row rep-line-row--level">
      <span className="rep-line-row__name">{groupLabel(t, level.key)}</span>
      <Composition row={level} />
      <Pct value={level.retention} />
    </div>
  ))
}

// Shared with the desk's station split (components/selection/
// ModeFigures.jsx, plan 114), which draws one platform's share of it.
export function Composition({ row }) {
  return (
    <span className="composition" aria-hidden="true">
      <span className="composition__seg composition__seg--mastered" style={{ width: `${row.masteredPct}%` }} />
      <span className="composition__seg composition__seg--learning" style={{ width: `${row.learningPct}%` }} />
    </span>
  )
}

function Pct({ value }) {
  return (
    <span className={`rep-line-row__pct${value === null ? ' rep-line-row__pct--none' : ''}`}>
      {value === null ? '—' : `${value}%`}
    </span>
  )
}

