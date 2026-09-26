import { useLang } from '../../LangContext'
import { stationFor } from '../../config/stations'
import { modeLabel, groupLabel, deckCode, cardHeadword } from '../../domain/statsModel'

// ── 路線別 — a line's plate (plan 136) ─────────────────────
// The statistics are the four lines, one plate each (the owner's pick B
// of four drawn directions). A plate answers, for its own line, the
// question the screen asks — is it holding, and where is it leaking:
//
//   the head    the roundel and the name, the line's reviews and its
//               retention (lifetime, correct over reviews)
//   the grid    retention by exercise and by deck, a row per exercise
//               ridden and a column per deck ridden (lineGrid); the one
//               cell furthest under the learner's own average wears the
//               danger ink, and every cell opens that exercise's run
//   the tiles   the line's most-missed cards (the report's weakest, per
//               line), each opening its own run — or, with nothing
//               missed, the line says so and nothing more
//
// Colour: the line's pigment is its roundel and the 3px stripe under
// the plate, a place's; everything about study state is ink, and the
// leak is the state's danger. The grid's column heads are the decks'
// short names (N5, あ); the full ones are in each cell's name.
export function LineReport({ section, grid, weakest, onStartReview }) {
  const { t } = useLang()
  const empty = grid.reviews === 0
  return (
    <section className="rep-plate" style={{ '--line-color': section.color }} aria-label={section.title}>
      <div className="rep-plate__head">
        <span className="pf-line__roundel" aria-hidden="true">{stationFor(section.path).code}</span>
        <span className="rep-plate__names">
          <h2 className="rep-plate__name">{section.title}</h2>
          {!empty && <span className="rep-cap">{t.reportLineReviews(grid.reviews.toLocaleString())}</span>}
        </span>
        <span className="rep-fig rep-fig--heading rep-plate__fig">
          {grid.retention === null ? '—' : grid.retention}
          {grid.retention !== null && <span className="rep-fig__u">%</span>}
        </span>
      </div>

      {empty ? (
        <p className="rep-plate__none">{t.reportLineEmpty}</p>
      ) : (
        <>
          <div className="rep-plate__body">
            <ExerciseGrid grid={grid} onStartReview={onStartReview} />
            {weakest.length > 0 && (
              <div className="rep-plate__side">
                <span className="rep-cap">{t.reportToReview}</span>
                <div className="rep-tiles">
                  {weakest.map(w => (
                    <WeakTile key={`${w.card_id}:${w.mode}`} card={w} onStartReview={onStartReview} />
                  ))}
                </div>
              </div>
            )}
          </div>
          {/* Under the grid, never beside it: beside, it stood level
              with the decks' heads and read as a fifth column. */}
          {weakest.length === 0 && <p className="rep-plate__none">{t.reportNoMiss}</p>}
        </>
      )}
    </section>
  )
}

function ExerciseGrid({ grid, onStartReview }) {
  const { t } = useLang()
  const { category } = grid
  return (
    <div className="rep-grid-box">
      <table className="rep-grid">
        <thead>
          <tr>
            <td />
            {grid.decks.map(deck => (
              <th key={deck} scope="col" className="rep-grid__deck" title={groupLabel(t, deck)} lang={deckCode(deck) === deck ? undefined : 'ja'}>
                {deckCode(deck)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {grid.rows.map(row => {
            const mode = modeLabel(t, category, row.mode)
            return (
              <tr key={row.mode}>
                <th scope="row" className="rep-grid__mode">{mode}</th>
                {row.cells.map(cell => (
                  <td key={cell.deck}>
                    {cell.pct === null ? (
                      <span className="rep-cell rep-cell--none" aria-label={t.reportCellNone(mode, groupLabel(t, cell.deck))}>—</span>
                    ) : (
                      <button
                        type="button"
                        className={`rep-cell${cell.leak ? ' rep-cell--leak' : ''}`}
                        onClick={() => onStartReview(category, cell.deck, cell.mode)}
                        aria-label={t.reportCell(mode, groupLabel(t, cell.deck), cell.pct, cell.reviews)}
                      >
                        <span className="rep-cell__pct">{cell.pct}<span className="rep-fig__u">%</span></span>
                        <span className="rep-cell__track" aria-hidden="true">
                          <span className="rep-cell__fill" style={{ width: `${cell.pct}%` }} />
                        </span>
                      </button>
                    )}
                  </td>
                ))}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function WeakTile({ card, onStartReview }) {
  const { t } = useLang()
  const head = cardHeadword(card.raw_id, card.category, card.key)
  const pct = Math.round(card.accuracy)
  const label = t.reportTile(head, groupLabel(t, card.key), modeLabel(t, card.category, card.mode), pct, card.lapses)
  return (
    <button
      type="button"
      className="rep-tile"
      onClick={() => onStartReview(card.category, card.key, card.mode)}
      aria-label={label}
      title={label}
    >
      <span className="rep-tile__glyph" lang="ja">{head}</span>
      <span className="rep-tile__pct">{pct}%</span>
    </button>
  )
}
