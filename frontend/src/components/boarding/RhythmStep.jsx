import { useLang } from '../../LangContext'
import { RHYTHMS, RECOMMENDED_RHYTHM, itemsForRhythm } from '../../domain/boarding'
import { BoardQuestion, Continue } from './BoardFrame'

// ── 6 · the rhythm (plan 075) ────────────────────────────────────
// Four cards in a lattice: minutes a day, and the new items that fit
// in them. The recommended one wears the tag and is preselected by the
// flow; the picked card lifts to its wash.
export default function RhythmStep({ value, onChange, onContinue }) {
  const { t } = useLang()
  return (
    <>
      <div className="brd__body">
        <BoardQuestion>{t.brdRhythmQ}</BoardQuestion>
        <div className="brd__stage">
          <div className="brd-grid" role="group" aria-label={t.brdRhythmQ}>
            {RHYTHMS.map(min => (
              <button
                key={min}
                type="button"
                className={`brd-cell${value === min ? ' brd-cell--on' : ''}`}
                aria-pressed={value === min}
                onClick={() => onChange(min)}
                data-rhythm={min}
              >
                {min === RECOMMENDED_RHYTHM && <span className="brd-tag">{t.onbPaceRecommended}</span>}
                <span className="brd-cell__n">{min}</span>
                <span className="brd-cell__u">{t.brdMinADay}</span>
                <span className="brd-cell__sub">{t.brdNewItems(itemsForRhythm(min))}</span>
              </button>
            ))}
          </div>
          <p className="brd__hint">{t.brdChangeLater}</p>
        </div>
      </div>
      <div className="brd__foot">
        <Continue label={t.onbContinue} onClick={onContinue} data-action="continue" />
      </div>
    </>
  )
}
