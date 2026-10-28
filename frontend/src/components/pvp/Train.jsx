// ── 対戦 — the train (plan 285) ─────────────────────────────────────
// The owner's T1 of the canvas "C1": the Shinkansen, the learner's in
// the pass's charcoal with its gold band, the other player's white with
// a blue one. The line moves the box it rides in, never a shape inside
// the drawing (DESIGN.md, Motion). Behind the learner's: speed lines
// each time it gains (keyed by `gain`), and a heat trail while the combo
// pays ×2 (gold) or ×3 (red, flickering).

const WINDOW_GAPS = [14.5, 22.5, 30.5, 38.5, 46.5]

/** The drawing alone, 120×30 units, its nose to the right. */
export function T1({ className = '' }) {
  return (
    <svg className={['pvp-t1', className].filter(Boolean).join(' ')} viewBox="0 0 120 30" aria-hidden="true">
      <ellipse className="pvp-t1__shade" cx="58" cy="28.6" rx="55" ry="1.4" />
      <path className="pvp-t1__panto" d="M24 6.2 L29 2.2 H35" />
      <path className="pvp-t1__body" d="M2 9.2 Q2 6.2 5.2 6.2 H62 C79 6.2 95 9.6 108 16.4 Q117.5 21 113.6 23 Q111.6 24 107 24 H5.2 Q2 24 2 21 Z" />
      <rect className="pvp-t1__win" x="6.5" y="10" width="52" height="4.4" rx="2.2" />
      {WINDOW_GAPS.map(x => <rect key={x} className="pvp-t1__gap" x={x} y="10" width="0.9" height="4.4" />)}
      <path className="pvp-t1__cab" d="M66.5 9.7 C79 9.8 89.5 12.2 97 15.9 H73.5 Q69 15.9 67.4 13.6 Z" />
      <path className="pvp-t1__stripe" d="M2 17.6 H103.5 Q105.6 18.5 106.6 19.4 H2 Z" />
      <rect className="pvp-t1__skirt" x="5.5" y="24" width="99" height="2.4" rx="1.2" />
      <rect className="pvp-t1__bogie" x="12" y="25" width="15" height="2.8" rx="1.4" />
      <rect className="pvp-t1__bogie" x="80" y="25" width="15" height="2.8" rx="1.4" />
      <ellipse className="pvp-t1__lamp" cx="110.6" cy="20.6" rx="1.9" ry="0.9" />
    </svg>
  )
}

/** The train as it rides: its livery, its speed lines, its heat. */
export function Train({ me = false, mult = 1, gain = 0, flip = false }) {
  const heat = me && mult >= 2 ? (mult >= 3 ? ' pvp-loco--x3' : ' pvp-loco--x2') : ''
  return (
    <span className={`pvp-loco${me ? ' pvp-loco--me' : ''}${heat}${flip ? ' pvp-loco--flip' : ''}`}>
      {heat && <span className="pvp-loco__heat" aria-hidden="true" />}
      {gain ? <span className="pvp-loco__lines" key={gain} aria-hidden="true"><i className="pvp-loco__line" /><i className="pvp-loco__line" /><i className="pvp-loco__line" /></span> : null}
      <T1 />
    </span>
  )
}
