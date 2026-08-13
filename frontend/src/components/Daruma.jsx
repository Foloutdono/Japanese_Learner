import { useId } from 'react'

// ── 達磨 ───────────────────────────────────────────────────
// One papier-mâché daruma, drawn rather than illustrated — same
// hairline-and-flat-fill discipline the rest of the app uses, no
// gradients, no drop shadows, every colour a theme token so the doll
// works on paper and on ink without a second asset.
//
// Three things it says at a glance:
//
//   • the pigment level — an unstarted doll is bare kōzo paper and
//     fills upward with its colour as you close on the target, so the
//     progress bar and the collectible are the same object. There is
//     no separate track anywhere on the screen.
//   • the eyes — 0 blank (not begun), 1 (vowed, in progress), 2
//     (fulfilled). Traditionally the first eye goes in on the doll's
//     own left, which is the viewer's right, so that's the one that
//     gets painted first here.
//   • the belly glyph — the wish itself, brushed on in gold the way a
//     shop brushes 福 or the buyer's goal onto a real one.
//
// Everything else — the crane eyebrows (鶴) and tortoise moustache
// (亀), the two auspicious long-lived animals a daruma's face is
// always drawn from — is fixed decoration.

// Body outline, in a 0 0 100 120 box. The silhouette is the whole
// tell, and it's a narrow target between two failure modes: an
// evenly-curved egg reads as an egg, and pinching in a neck above
// the belly reads as a cone or a hooded figure. What works is one
// convex sweep per side with no inflection at all — a dome about
// half the width of the belly at the top, widest low around y=85,
// and no base, because a roly-poly shouldn't look like it's standing
// on anything.
const BODY = `
  M 50 6
  C 72 6, 85 26, 88 54
  C 93 82, 88 116, 50 116
  C 12 116, 7 82, 12 54
  C 15 26, 28 6, 50 6
  Z
`

// Sits high on the narrow shoulders, not centred on the belly, and
// stays well inside the outline so a band of pigment shows either
// side of it. Oversizing this panel is what turns the doll into a
// smiley — it has to read as a mask painted onto a body, not a head.
const FACE = { cx: 50, cy: 39, rx: 19.5, ry: 21 }
const EYE = { left: 41, right: 59, y: 39, rx: 5.8, ry: 7.4 }

// 並 → 極. Only the top two tiers get any extra treatment at all: a
// hairline ring for 特, a gold double ring for 極 — the exact same
// escalation StageBadge uses for learning → mastered, so a rare
// daruma reads as "rare" using vocabulary the app has already taught.
const RING = { toku: 1, kiwami: 2 }

export function Daruma({
  color = 'aka',
  eyes = 0,
  progress = 0,
  glyph,
  rarity = 'nami',
  size = 96,
  dim = false,
  className = '',
}) {
  const uid = useId().replace(/:/g, '')
  const clipId = `daruma-fill-${uid}`
  const bodyId = `daruma-body-${uid}`

  const pct = Math.max(0, Math.min(1, progress))
  // Pigment rises from the very bottom of the body box to the very
  // top; 116 and 6 are the extremes of BODY above.
  const fillTop = 116 - pct * 110
  const rings = RING[rarity] ?? 0

  return (
    <svg
      viewBox="0 0 100 120"
      width={size}
      height={size * 1.2}
      className={`daruma${dim ? ' daruma--dim' : ''} ${className}`}
      style={{ '--daruma-color': `var(--daruma-${color})` }}
      role="presentation"
      aria-hidden="true"
    >
      <defs>
        <path id={bodyId} d={BODY} />
        <clipPath id={clipId}>
          <rect x="0" y={fillTop} width="100" height={120 - fillTop} />
        </clipPath>
      </defs>

      {rings > 0 && (
        <>
          <ellipse className="daruma__ring" cx="50" cy="61" rx="49" ry="59" />
          {rings > 1 && <ellipse className="daruma__ring daruma__ring--inner" cx="50" cy="61" rx="45.5" ry="55.5" />}
        </>
      )}

      {/* Bare paper first, pigment clipped over it — so a doll at 40%
          is genuinely half-painted rather than tinted at 40% alpha. */}
      <use href={`#${bodyId}`} className="daruma__paper" />
      <g clipPath={`url(#${clipId})`}>
        <use href={`#${bodyId}`} className="daruma__pigment" />
      </g>
      <use href={`#${bodyId}`} className="daruma__outline" />

      {/* Face: always bare paper, never pigmented — on a real doll the
          face panel is masked off before the body is dipped. */}
      <ellipse className="daruma__face" cx={FACE.cx} cy={FACE.cy} rx={FACE.rx} ry={FACE.ry} />

      {/* Crane eyebrows and tortoise moustache. Stroked with round
          caps rather than drawn as filled slivers — a filled sliver
          is only as thick as the gap between its two edges, which
          vanishes at the sizes this renders at (20px on the shelf
          tally, 13px inside a reward chip). */}
      <path className="daruma__brow" d="M 33 30 Q 39.5 23 47 27.5" />
      <path className="daruma__brow" d="M 67 30 Q 60.5 23 53 27.5" />

      <Eye side="left"  painted={eyes >= 2} />
      <Eye side="right" painted={eyes >= 1} />

      <path className="daruma__brow" d="M 50 52 Q 42.5 52.5 36 58.5" />
      <path className="daruma__brow" d="M 50 52 Q 57.5 52.5 64 58.5" />

      {/* The belly kanji is dropped below ~64px rather than shrunk:
          a glyph like 願 rasterises to an illegible blob at the
          shelf's 52px, and a blob of ink on the belly is worse than
          a clean doll. The shelf's own title attribute carries the
          goal name instead. */}
      {glyph && size >= 64 && (
        <text className="daruma__glyph" x="50" y="93" textAnchor="middle">{glyph}</text>
      )}
    </svg>
  )
}

// An unpainted eye is an outlined hollow, a painted one is solid sumi
// — the whole eye inked in, which is how it's actually done. No pupil,
// no catchlight; a daruma's stare is the point.
function Eye({ side, painted }) {
  return (
    <ellipse
      className={`daruma__eye${painted ? ' daruma__eye--painted' : ''}`}
      cx={EYE[side]}
      cy={EYE.y}
      rx={EYE.rx}
      ry={EYE.ry}
    />
  )
}

// The 起 token — a daruma tipped over and already coming back up.
// Same doll, 22° off vertical, drawn small enough to sit inline in a
// counter or a button label.
export function RiseToken({ size = 20, className = '' }) {
  return (
    <span className={`rise-token ${className}`} aria-hidden="true">
      <Daruma color="aka" eyes={2} progress={1} size={size} className="rise-token__doll" />
    </span>
  )
}
