import { useLang } from '../../LangContext'
import { Emphasized } from '../ui/Emphasized'
import { MOTIVES } from '../../domain/boarding'
import { useDesk } from '../../hooks/useDesk'
import { BoardQuestion, Continue } from './BoardFrame'
import { PickMark } from './BoardOption'
import { MotiveGlyph } from './icons'

// ── 2 · why (plan 075) ───────────────────────────────────────────
// Six reasons, one choice; the plan's two promise lines come from it.
// Drawn as roads out of the question's hub: six round the hub on the
// desk (WhyRoads, plan 163), a junction down the phone (Junction, plan
// 167). `no` is the question's place on the line, which the hub prints.
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
          {desk ? <WhyRoads value={value} onChange={onChange} no={no} /> : <Junction value={value} onChange={onChange} no={no} />}
        </div>
      </div>
      <div className="brd__foot">
        <Continue keys label={t.onbContinue} onClick={onContinue} disabled={!value} data-action="continue" />
      </div>
    </>
  )
}

// ── 辻 on a phone — the junction (plan 167) ──────────────────────
// The owner's A02: the question's hub at the top of the stage, a trunk
// down the middle, and at each of three rungs a road to a reason on
// either side -- the pictogram in its ring, its name under it. The
// reason picked lights the road from the hub to it, down the trunk and
// out along its rung, and its ring, in the pass's gold.
//
// The drawing's own figures, on the canvas's 358px stage (brd-map, the
// phone's map in index.css): the rows' rings' centres, and the two
// columns' (each road runs to its ring's centre, under the ring).
const ROWS = [86, 220, 354]
const SIDES = [85, 273]

function Junction({ value, onChange, no }) {
  const { t } = useLang()
  const picked = MOTIVES.indexOf(value)
  const on = picked >= 0
    ? `M179 44V${ROWS[Math.floor(picked / 2)]}H${SIDES[picked % 2]}`
    : null
  return (
    <div className="brd-map brd-junction" style={{ '--h': 440 }}>
      <svg className="brd-map__lines" viewBox="0 0 358 440" preserveAspectRatio="none" aria-hidden="true">
        <path className="brd-road" d="M179 22V354" />
        {ROWS.map(y => <path key={y} className="brd-road" d={`M${SIDES[0]} ${y}H${SIDES[1]}`} />)}
        {on && <path className="brd-road brd-road--on" d={on} />}
      </svg>
      <span className="brd-hub brd-map__at" style={{ '--x': 179, '--y': 22 }} aria-hidden="true">{no}</span>
      {MOTIVES.map((m, i) => (
        <button
          key={m}
          type="button"
          className="brd-way"
          // Plain numbers, placed by the sheet: the ring's centre.
          style={{ '--x': SIDES[i % 2], '--y': ROWS[Math.floor(i / 2)] }}
          aria-pressed={value === m}
          onClick={() => onChange(m)}
          data-motive={m}
        >
          <span className="brd-way__ring"><MotiveGlyph motive={m} /></span>
          <span className="brd-way__name">{t.brdMotive[m]}</span>
        </button>
      ))}
    </div>
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
