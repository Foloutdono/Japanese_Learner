// ── 走行計 — the odometer (plan 191) ───────────────────────────────
// The canvas kit's §11: a figure that rolls to its value, a column a
// digit. The finish rolls the dial's count and the streak with it
// (components/station/GateCard.jsx, plan 250).

// One tabular digit's advance in Space Grotesk 700, and the thin space
// between thousands -- the odometer's columns are drawn at these.
const DIGIT_EM = 0.62
const SEP_EM = 0.28

/**
 * The odometer (kit §11): one column per digit, rolled by its value.
 * Change `value` and each column rolls (.9s, a small overshoot); `delay`
 * (ms) cascades the columns, units first. `group` puts a thin space
 * between thousands (1 000). The window clips the digits not shown, by
 * design: the value is said by `label` in a hidden sibling.
 */
export function Odometer({ value, sign = '', group = false, delay = 0, className = '', label }) {
  const digits = String(Math.max(0, Math.round(value))).split('').map(Number)
  const parts = []
  let o = 0
  if (sign) {
    parts.push({ kind: 'sign', o })
    o += DIGIT_EM
  }
  digits.forEach((d, i) => {
    const fromEnd = digits.length - i
    if (group && i > 0 && fromEnd % 3 === 0) {
      parts.push({ kind: 'sep' })
      o += SEP_EM
    }
    parts.push({ kind: 'digit', d, o, rank: fromEnd - 1 })
    o += DIGIT_EM
  })
  const figW = o
  return (
    <>
      <span className={['clrk-odo', className].filter(Boolean).join(' ')} aria-hidden="true" style={{ '--fig-w': figW }}>
        {parts.map((p, i) => {
          if (p.kind === 'sep') return <span key={i} className="clrk-odo__sep" />
          if (p.kind === 'sign') return <span key={i} className="clrk-odo__sign" style={{ '--o': p.o }}>{sign}</span>
          return (
            <span key={i} className="clrk-odo__col" style={{ '--n': p.d, '--d': `${delay * p.rank}ms` }}>
              {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => (
                <span key={n} className="clrk-odo__d" style={{ '--o': p.o }}>{n}</span>
              ))}
            </span>
          )
        })}
      </span>
      {label && <span className="sr-only">{label}</span>}
    </>
  )
}
