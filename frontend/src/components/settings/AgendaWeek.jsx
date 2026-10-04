import { useLang } from '../../LangContext'
import { playClick } from '../../lib/audio'
import { subjectInfo } from '../../lib/agenda'
import { useBoxWidth } from '../../hooks/useBoxWidth'
import { DAYS, axisFor, axisTicks, clock, dayName, snap } from '../../domain/agenda'

// ── The week, drawn (plan 181) ───────────────────────────────────
// Seven columns, Monday first, under the hours of the day marked down
// the side; each block stands in its day's column where its hours fall,
// in its subject's line colour. The day being looked at is lit, today is
// named in gold, and on today's column a gold rule stands at the time
// the page opened.
//
// Two ways in, by what the hand holds:
//   a finger   (`pointer` false) a column is one target, the whole day:
//              a tap chooses the day the list under the week shows, and
//              the list's rows are the blocks to tap. A block a few
//              pixels tall is no target for a thumb.
//   a pointer  (`pointer` true, the desk) a block opens its editor, a day's
//              name chooses the day, and a click in a day's free time
//              begins a block there, on the half hour.
//
// The density is the box's, measured (hooks/useBoxWidth): where a day's
// column is wide enough a block prints its name (and, from an hour and a
// half, when it starts), otherwise its glyph alone; the hours are marked every two hours on the tall week
// and every three on the short one.
const ROOMY = 480
const LONG = 90

export function AgendaWeek({ blocks, today = -1, nowMinute = null, selected, onSelect, onOpen, onAddAt, pointer = false }) {
  const { t, lang } = useLang()
  const [ref, width] = useBoxWidth(true)
  const roomy = (width ?? 0) >= ROOMY
  const step = roomy ? 120 : 180
  const axis = axisFor(blocks, step)
  const span = axis.to - axis.from
  const ticks = axisTicks(axis, step)
  const at = minute => (minute - axis.from) / span

  function addAt(day, e) {
    if (e.target.closest('.agd-block')) return
    const box = e.currentTarget.getBoundingClientRect()
    const minute = axis.from + ((e.clientY - box.top) / box.height) * span
    playClick()
    onAddAt(day, Math.min(axis.to - 60, Math.max(axis.from, Math.floor(snap(minute) / 30) * 30)))
  }

  return (
    <div
      ref={ref}
      className={`agd-week${roomy ? ' agd-week--roomy' : ''}${pointer ? ' agd-week--pointer' : ''}`}
      style={{ '--agd-rows': span / step }}
      role="group"
      aria-label={t.agdWeekAria}
    >
      <span className="agd-week__corner" aria-hidden="true" />
      {DAYS.map(day => {
        const n = blocks.filter(b => b.days.includes(day)).length
        const name = <span className="agd-dayhead__name">{dayName(day, lang, roomy ? 'short' : 'narrow')}</span>
        const cls = `agd-dayhead${day === selected ? ' agd-dayhead--on' : ''}${day === today ? ' agd-dayhead--today' : ''}`
        // On a finger's week the column below is the day's target, and
        // its name is its label: the header is drawn, not pressed.
        return pointer ? (
          <button
            key={day}
            type="button"
            className={cls}
            aria-pressed={day === selected}
            aria-label={t.agdDayAria(dayName(day, lang, 'long'), n)}
            onClick={() => { playClick(); onSelect(day) }}
          >
            {name}
          </button>
        ) : (
          <span key={day} className={cls} aria-hidden="true">{name}</span>
        )
      })}

      <div className="agd-hours" role="img" aria-label={t.agdHoursAria}>
        {ticks.map((minute, i) => (
          <span
            key={minute}
            className={`agd-hours__mark${i === 0 ? ' agd-hours__mark--first' : ''}${i === ticks.length - 1 ? ' agd-hours__mark--last' : ''}`}
            style={{ '--agd-at': at(minute) }}
          >
            {clock(minute)}
          </span>
        ))}
      </div>

      {DAYS.map(day => {
        const cls = `agd-track${day === selected ? ' agd-track--on' : ''}${day === today ? ' agd-track--today' : ''}`
        const inside = (
          <>
            {blocks.map((block, i) => {
              if (!block.days.includes(day)) return null
              const info = subjectInfo(block.subject, t)
              const style = { '--agd-top': at(block.start), '--agd-size': (block.end - block.start) / span, '--agd-line': info.color }
              const face = (
                <>
                  <span className="agd-block__glyph" lang="ja" aria-hidden="true">{info.icon}</span>
                  <span className="agd-block__name">{info.title}</span>
                  <span className="agd-block__time">{clock(block.start)}</span>
                </>
              )
              // A block long enough for two lines on the tall week says
              // when it starts under its name; a shorter one, its name.
              const cls = `agd-block${block.end - block.start >= LONG ? ' agd-block--long' : ''}`
              return pointer ? (
                <button
                  key={i}
                  type="button"
                  className={cls}
                  style={style}
                  aria-label={t.agdBlockAria(info.title, dayName(day, lang, 'long'), clock(block.start), clock(block.end))}
                  onClick={() => { playClick(); onOpen(i) }}
                >
                  {face}
                </button>
              ) : (
                <span key={i} className={cls} style={style}>{face}</span>
              )
            })}
            {day === today && nowMinute != null && nowMinute >= axis.from && nowMinute <= axis.to && (
              <span className="agd-track__now" style={{ '--agd-top': at(nowMinute) }} aria-hidden="true" />
            )}
          </>
        )
        return pointer ? (
          <div key={day} className={cls} onClick={e => addAt(day, e)}>{inside}</div>
        ) : (
          <button
            key={day}
            type="button"
            className={cls}
            aria-pressed={day === selected}
            aria-label={t.agdDayAria(dayName(day, lang, 'long'), blocks.filter(b => b.days.includes(day)).length)}
            onClick={() => { playClick(); onSelect(day) }}
          >
            {inside}
          </button>
        )
      })}
    </div>
  )
}
