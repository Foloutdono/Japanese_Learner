import { useLang } from '../../LangContext'
import { Emphasized } from '../ui/Emphasized'
import { MOTIVES } from '../../domain/boarding'
import { useDesk } from '../../hooks/useDesk'
import { BoardQuestion, Continue } from './BoardFrame'
import { BoardOption, PickMark } from './BoardOption'
import { MotiveGlyph, MotiveIcon } from './icons'

// ── 2 · why (plan 075) ───────────────────────────────────────────
// Six rows, one choice; the plan's two promise lines come from it. On
// the desk, six roads out of the question's hub (WhyRoads, plan 163).
// `no` is the question's place on the strip, which the hub prints.
export default function WhyStep({ name, value, onChange, onContinue, no = null }) {
  const { t } = useLang()
  const desk = useDesk()
  return (
    <>
      <div className="brd__body">
        <BoardQuestion>
          <Emphasized text={t.brdWhyQ(name)} strongClassName="brd__q-em" />
        </BoardQuestion>
        <div className="brd__stage">
          {desk ? <WhyRoads value={value} onChange={onChange} no={no} /> : (
            <div className="brd__opts">
              {MOTIVES.map((m, i) => (
                <BoardOption
                  key={m}
                  pick={i + 1}
                  on={value === m}
                  onClick={() => onChange(m)}
                  icon={<MotiveIcon motive={m} />}
                  label={t.brdMotive[m]}
                  data-motive={m}
                />
              ))}
            </div>
          )}
        </div>
      </div>
      <div className="brd__foot">
        <Continue keys label={t.onbContinue} onClick={onContinue} disabled={!value} data-action="continue" />
      </div>
    </>
  )
}

// ── 辻 — six reasons, six roads (plan 163) ───────────────────────
// The owner's D02: the question's hub in the middle of the paper, its
// number on it, and a road out of it to each reason -- clockwise from
// the top left, in the order the digits pick them. A road ends at its
// reason's pictogram in a ring, the reason's name on the ring's far
// side (under it on the road straight out to the right, the one with no
// far side to spare); the reason picked lights its road and its ring in
// the pass's gold.
//
// Where each road ends: `x` across the paper's width, `y` down the band
// from the top rings' centres to the bottom ones', both out of 100, so
// the roads stretch with the paper while the rings keep their size (the
// 机 section of index.css places the buttons on the same figures).
const ROADS = [
  { x: 32.3, y: 0, side: 'start' },   // up and left
  { x: 67.7, y: 0, side: 'end' },     // up and right
  { x: 75.8, y: 50, side: 'under' },  // straight on
  { x: 67.7, y: 100, side: 'end' },   // down and right
  { x: 32.3, y: 100, side: 'start' }, // down and left
  { x: 24.2, y: 50, side: 'start' },  // straight back
]

function WhyRoads({ value, onChange, no }) {
  const { t } = useLang()
  const picked = MOTIVES.indexOf(value)
  // The road picked is drawn last, over the others where they meet.
  const order = ROADS.map((_, i) => i).sort((a, b) => (a === picked) - (b === picked))
  return (
    <div className="desk-brd__roads">
      <svg className="desk-brd__map" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        {order.map(i => (
          <line
            key={i}
            className={`desk-brd__road${i === picked ? ' desk-brd__road--on' : ''}`}
            x1="50" y1="50" x2={ROADS[i].x} y2={ROADS[i].y}
          />
        ))}
      </svg>
      <span className="desk-brd__hub" aria-hidden="true">{no}</span>
      {MOTIVES.map((m, i) => {
        const digit = String(i + 1)
        return (
          <button
            key={m}
            type="button"
            className={`desk-brd__way desk-brd__way--${ROADS[i].side}`}
            // Plain numbers, placed by the sheet (see ROADS).
            style={{ '--x': ROADS[i].x, '--y': ROADS[i].y }}
            aria-pressed={value === m}
            aria-keyshortcuts={digit}
            onClick={() => onChange(m)}
            data-motive={m}
          >
            <span className="desk-brd__ring"><MotiveGlyph motive={m} /></span>
            <span className="desk-brd__way-name">
              <PickMark digit={digit} />
              {t.brdMotive[m]}
            </span>
          </button>
        )
      })}
    </div>
  )
}
