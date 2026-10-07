import { useXpFormat } from './useCountUp'

// ── 運賃 — the fare's gold figure (plan 191) ────────────────────────
// The canvas kit's §10 and §11. XP is the pass's balance, the only gold
// text on the screen: a tabular Space Grotesk figure with its unit hung
// beside it, and -- once it has landed, never while it counts -- the
// shimmer: a band of light crossing the digits every 4.1s and two or
// three four-point stars twinkling at its corners.
//
// The count itself is useCountUp (rAF, from → to over a duration), so a
// screen can count the run's XP to the total and sound the fare's tick
// as it goes; XpTotal only prints the figure it is given.

/**
 * A four-point star at (x, y) -- its centre, px inside the positioned
 * figure -- `size` px across (8–14; the larger by the figure's top-right
 * shoulder), its twinkle `delay` ms into a 3.6s loop (stagger by 1.2s).
 * Place stars in the figure's empty corners, never over a glyph.
 */
export function Glint({ x, y, size = 12, delay = 0 }) {
  return (
    <span className="clrk-xp-glint" style={{ left: x, top: y, '--gs': size, '--gd': `${delay}ms` }} aria-hidden="true">
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path fill="#e6bd62" d="M12 0C12.8 7.4 16.6 11.2 24 12C16.6 12.8 12.8 16.6 12 24C11.2 16.6 7.4 12.8 0 12C7.4 11.2 11.2 7.4 12 0Z" />
        <path fill="#fff6dc" d="M12 4.5C12.4 9.4 14.6 11.6 19.5 12C14.6 12.4 12.4 14.6 12 19.5C11.6 14.6 9.4 12.4 4.5 12C9.4 11.6 11.6 9.4 12 4.5Z" />
      </svg>
    </span>
  )
}

/**
 * The gold figure: `+197`, its unit (`xp`, or none with unit={null}).
 * `shine` puts the sweep on (only once the count has landed; the screen
 * decides when), `shineDelay` delays its first pass (200ms after a count
 * lands; 900ms after mount for a figure that does not count), `glints`
 * the stars ([{ x, y, size, delay }]). The figure's font-size is the
 * caller's (a class or a style).
 */
export function XpTotal({
  value, sign = '+', unit = 'xp', shine = false, shineDelay = 200, glints = [],
  className = '', figureClass = '', style, label,
}) {
  const fmt = useXpFormat()
  return (
    <span className={['clrk-xp-total', className].filter(Boolean).join(' ')} style={style} role={label ? 'img' : undefined} aria-label={label}>
      <span
        className={['clrk-xp', shine && 'clrk-xp-shine', figureClass].filter(Boolean).join(' ')}
        style={{ '--shine-d': `${shineDelay}ms` }}
        aria-hidden={label ? 'true' : undefined}
      >
        {sign}{fmt(value)}
        {shine && glints.map((g, i) => <Glint key={i} {...g} />)}
      </span>
      {unit && <span className="clrk-xp__unit" aria-hidden={label ? 'true' : undefined}>{unit}</span>}
    </span>
  )
}

// One tabular digit's advance in Space Grotesk 700, and the thin space
// between thousands -- the odometer's columns are drawn at these, so a
// figure in parts knows each part's offset in it (the shimmer's slice).
const DIGIT_EM = 0.62
const SEP_EM = 0.28

/**
 * The odometer (kit §11): one column per digit, rolled by its value.
 * Change `value` and each column rolls (.9s, a small overshoot); `delay`
 * (ms) cascades the columns, units first. `group` puts a thin space
 * between thousands (1 000). `shine` paints the sweep across the parts
 * as one figure. The window clips the digits not shown, by design: the
 * value is said by `label` in a hidden sibling.
 */
export function Odometer({ value, sign = '', group = false, shine = false, delay = 0, className = '', label }) {
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
  const part = shine ? 'clrk-xp-shine clrk-xp-shine--part' : ''
  return (
    <>
      <span className={['clrk-odo', className].filter(Boolean).join(' ')} aria-hidden="true" style={{ '--fig-w': figW }}>
        {parts.map((p, i) => {
          if (p.kind === 'sep') return <span key={i} className="clrk-odo__sep" />
          if (p.kind === 'sign') return <span key={i} className={['clrk-odo__sign', part].filter(Boolean).join(' ')} style={{ '--o': p.o }}>{sign}</span>
          return (
            <span key={i} className="clrk-odo__col" style={{ '--n': p.d, '--d': `${delay * p.rank}ms` }}>
              {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => (
                <span key={n} className={['clrk-odo__d', part].filter(Boolean).join(' ')} style={{ '--o': p.o }}>{n}</span>
              ))}
            </span>
          )
        })}
      </span>
      {label && <span className="sr-only">{label}</span>}
    </>
  )
}

/** The prime's chip (kit §10): a sumi pill with a gold hairline, "+55 prime de série". */
export function XpChip({ amount, label, className = '', style }) {
  const fmt = useXpFormat()
  return (
    <span className={['clrk-xp-chip', className].filter(Boolean).join(' ')} style={style}>
      <span className="clrk-xp-chip__n">+{fmt(amount)}</span> {label}
    </span>
  )
}

/**
 * The level bar (kit §10): the old level in deep gold (`from`, a share)
 * and the gain in lit gold under it reaching `to`; raising `to` fills it
 * (1.2s). `label` says it ("Niveau 14, 64 % vers le niveau 15").
 */
export function LevelBar({ from = 0, to = 0, label, className = '', style }) {
  return (
    <div
      className={['clrk-lvl', className].filter(Boolean).join(' ')}
      style={{ '--from': from, '--to': to, ...style }}
      role={label ? 'img' : undefined}
      aria-label={label}
    >
      <i className="clrk-lvl__gain" />
      <i className="clrk-lvl__fill" />
    </div>
  )
}
