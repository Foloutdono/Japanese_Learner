import { useCallback } from 'react'
import { useLang } from '../../LangContext'
import { EnterKey, KeyCap } from '../chrome/DeskKeys'
import { useBoxWidth } from '../../hooks/useBoxWidth'

// ── 実践 — a practice stop's page, beside the station's list (plan 158) ──
// The owner's pick A of the canvas "Practice screens — layout options":
// the practice stations were five grades in a row across the top of an
// empty window (or three source cards, or four paper names), so on the
// desk the stop chosen in the list gets the page, and the page says, in
// the order a learner asks it:
//
//   the head      the stop's name and what the run asks, with the one
//                 filled action -- Board -- and Enter for it;
//   the specimen  the exercise as the run will ask it (PracticeSpecimen);
//   the figures   a lattice of four: what has been done here, the share
//                 right, the words the stop is built from, the last time;
//   the lower     two panels side by side: the newest misses (or, for
//                 comprehension, the newest texts) and the grade's points
//                 with those studied at Learn inked -- or the tier's words.
//
// The page takes the window's height beside its list, the specimen and
// the lower panels sharing what the head and the figures leave, and the
// panels scroll inside themselves (the 机 section of index.css).
//
// Unless the page is narrow: at the desk's narrowest a page beside the
// list is under 400px, and four figures across and two panels side by
// side each came out a word wide. Measured rather than set at a window
// width (plan 137's rule, LinePlatforms): under NARROW the head stacks,
// the figures go two by two, the panels one under the other, and the
// page takes its own height and scrolls in the window instead.
const NARROW = 600
export function PracticePage({ label, title, desc, onDepart, actionLabel = null, spec, figures, lower = true, children }) {
  const { t } = useLang()
  const depart = useCallback(() => onDepart?.(), [onDepart])
  const [boxRef, width] = useBoxWidth(true)
  const narrow = width != null && width < NARROW
  return (
    <section className={narrow ? 'prc-page prc-page--narrow' : 'prc-page'} aria-label={label} ref={boxRef}>
      <header className="prc-head">
        <span className="prc-head__names">
          <h2 className="prc-title">{title}</h2>
          {desc && <p className="prc-desc">{desc}</p>}
        </span>
        {onDepart && (
          <>
            <button type="button" className="btn-primary prc-go" onClick={depart} aria-keyshortcuts="Enter">
              {actionLabel ?? t.depart}
              <KeyCap>{t.keyEnter}</KeyCap>
            </button>
            <EnterKey onEnter={depart} />
          </>
        )}
      </header>
      {spec}
      {figures?.length > 0 && <Figures cells={figures} />}
      {children && (lower ? <div className="prc-lower">{children}</div> : children)}
    </section>
  )
}

// The lattice (the profile's .records, four across): a label over a
// figure and its unit, and under it the bar the figure is a share of --
// the grade's words drawn as the Learn plate draws them (learned in the
// pigment, met in half of it), a share right as one plain bar.
function Figures({ cells }) {
  return (
    <div className="records prc-figs">
      {cells.map(cell => (
        <div key={cell.key} className="record prc-fig">
          <span className="record__label">{cell.label}</span>
          <span className="record__value">
            {cell.value}
            {cell.unit && <span className="record__unit">{cell.unit}</span>}
          </span>
          {cell.bar && (
            <span className="desk-line__bar prc-fig__bar" aria-hidden="true">
              {cell.bar.met != null && <i className="desk-line__met" style={{ width: share(cell.bar.met, cell.bar.of) }} />}
              <i className="desk-line__learned" style={{ width: share(cell.bar.value, cell.bar.of) }} />
            </span>
          )}
          {cell.note && <span className="prc-fig__note">{cell.note}</span>}
        </div>
      ))}
    </div>
  )
}

const share = (n, of) => `${of > 0 ? Math.round(Math.min(1, n / of) * 1000) / 10 : 0}%`

/**
 * A panel of lines: the newest misses at the stop, or a station's texts.
 * rows — [{key, mark: 'miss'|'hit'|'none', jp, sub, fig, when}]
 */
export function PracticeLines({ title, fig = null, rows, empty }) {
  return (
    <section className="prc-panel" aria-label={title}>
      <div className="prc-panel__head">
        <h3 className="prc-panel__title">{title}</h3>
        {fig != null && <span className="prc-panel__fig">{fig}</span>}
      </div>
      {rows?.length > 0 ? (
        <ul className="prc-lines">
          {rows.map(row => (
            <li key={row.key} className="prc-line">
              <span className={`prc-line__mark prc-line__mark--${row.mark}`} aria-hidden="true" />
              <span className="prc-line__main">
                <span className="prc-line__jp" lang="ja">{row.jp}</span>
                {row.sub && <span className="prc-line__sub" lang="ja">{row.sub}</span>}
              </span>
              <span className="prc-line__end">
                {row.fig && <span className="prc-line__fig">{row.fig}</span>}
                {row.when && <span className="prc-line__when">{row.when}</span>}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        rows && <p className="prc-panel__empty">{empty}</p>
      )}
    </section>
  )
}

/**
 * A panel of chips: the grade's grammar points (those studied at Learn
 * inked, a mark and not the colour alone), or a tier's words.
 */
export function PracticeChips({ title, fig = null, items, known = null, knownLabel = null, lang = 'ja' }) {
  const { lang: uiLang } = useLang()
  return (
    <section className="prc-panel" aria-label={title}>
      <div className="prc-panel__head">
        <h3 className="prc-panel__title">{title}</h3>
        {fig != null && <span className="prc-panel__fig">{fig}</span>}
      </div>
      <ul className="prc-chips" lang={lang}>
        {items.map(item => {
          const on = known?.has(item)
          return (
            <li key={item} className={on ? 'prc-chip prc-chip--known' : 'prc-chip'}>
              {item}
              {on && knownLabel && <span className="sr-only" lang={uiLang}> — {knownLabel}</span>}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
