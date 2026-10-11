// ── 駅スタンプ — the day's seal (plan 191) ─────────────────────────
// The canvas kit's §5: a double ring in the seal's ink, 辻駅 at its top,
// the day's weekday in the middle (Noto Serif JP 900), the date at its
// foot in a band of two rules clipped by the ring. Drawn at 192px with
// rung type and scaled by `size` (a px count), so its print never leaves
// the scale; `tilt` is its rest angle, in degrees. Needs <InkFilters/>
// on the screen for its grain (`crisp` draws it without, as the board
// draws the stamp in the air before it hits).
//
//   paper  the impression on paper: the stamp's own ink (--stamp-ink)
//   pair   two glyphs (三十): no date band, the pair on the centre
//   slam   the way in: from above, a lift, the hit at .94, settled on
//          its tilt (.62s) -- pair it with Shake on the screen's frame
//          at ~380ms and a Bloom
//
// `label` makes it an image for a screen reader (the board's "Tampon du
// jour : gare de Tsuji, mardi 6 octobre 2026"); without one it is
// decoration.
export function Seal({
  day, top = '辻駅', foot, size = 192, tilt = 0,
  paper = false, pair = false, slam = false, crisp = false,
  label, className = '', style, ...rest
}) {
  const classes = [
    'clrk-seal',
    paper && 'clrk-seal--paper',
    pair && 'clrk-seal--pair',
    slam && 'clrk-seal--slam',
    crisp && 'clrk-seal--crisp',
    className,
  ].filter(Boolean).join(' ')
  return (
    <div
      className={classes}
      style={{ '--seal-size': size, '--tilt': `${tilt}deg`, ...style }}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : 'true'}
      {...rest}
    >
      <div className="clrk-seal__face">
        <span className="clrk-seal__top" lang="ja" aria-hidden="true">{top}</span>
        <span className="clrk-seal__day" lang="ja" aria-hidden="true">{day}</span>
        {foot && <span className="clrk-seal__foot" aria-hidden="true">{foot}</span>}
      </div>
    </div>
  )
}

/** The ring the hit throws (2px, scale .7 → 1.75, fading). Placed by the caller's box. */
export function Bloom({ left, top, size, go = true, className = '', style }) {
  return (
    <span
      className={['clrk-bloom', go && 'clrk-bloom--go', className].filter(Boolean).join(' ')}
      style={{ left, top, width: size, height: size, ...style }}
      aria-hidden="true"
    />
  )
}

/**
 * The ink specks thrown off the hit: `specks` is [{ x, y, dx, dy, d, s }]
 * -- where each starts (px in the caller's box), how far it flies (px),
 * its delay (ms) and its size (px, default 4). makeSpecks() (kit/constants.js)
 * deals a deterministic set.
 */
export function Specks({ specks, go = true }) {
  return specks.map((k, i) => (
    <span
      key={i}
      className={go ? 'clrk-speck clrk-speck--go' : 'clrk-speck'}
      style={{ left: k.x, top: k.y, width: k.s ?? 4, height: k.s ?? 4, '--dx': k.dx, '--dy': k.dy, '--d': `${k.d ?? 0}ms` }}
      aria-hidden="true"
    />
  ))
}
