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
export function LineRows({ rows }) {
  const { t } = useLang()
  const [open, setOpen] = useState(null)
  const sections = getSections('learn', t).filter(s => TRACKED_LINES[s.path])
  const byCategory = new Map(rows.map(r => [r.category, r]))

  const lines = sections
    .map(s => ({ section: s, row: byCategory.get(TRACKED_LINES[s.path]) }))
    .filter(l => l.row && l.row.total > 0)
  if (!lines.length) return null

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
            {opened.row.levels.map(level => (
              <div key={level.key} className="rep-line-row rep-line-row--level">
                <span className="rep-line-row__name">{groupLabel(t, level.key)}</span>
                <Composition row={level} />
                <Pct value={level.retention} />
              </div>
            ))}
          </div>
        )}
      </Sheet>
    </>
  )
}

function Composition({ row }) {
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

