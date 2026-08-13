import { useId } from 'react'

// ── 達磨 ───────────────────────────────────────────────────
// One papier-mâché daruma, drawn rather than illustrated.
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
//     shop brushes 福 or the buyer's own goal onto a real one.
//
// ── What the face is made of ──
// A daruma's face is not decoration, it's two animals. The eyebrows
// are cranes (鶴) and the moustache is a tortoise (亀) — the pair that
// stands for a thousand and ten thousand years of life. Both are drawn
// as filled, tapered brush shapes rather than uniform strokes, because
// a real brush loads heavy at the start and lifts to a point at the
// end, and a constant-width line reads as clip-art the moment you put
// it beside the real thing.
//
// ── The one gradient ──
// Everything else in this app is flat fill on purpose. The doll gets a
// single exception: a soft light-to-shadow wash across the body, keyed
// off nothing but white and black at low alpha so one definition
// rounds all eight pigments in both themes. Without it a daruma is a
// coloured egg; with it, it's an object with a lit side and a shaded
// one. That's most of the distance between "a shape" and "a thing
// you'd want on a shelf", and it's worth the deviation.

// Body outline, in a 0 0 100 120 box. The silhouette is the whole
// tell, and it's a narrow target between two failure modes: an
// evenly-curved egg reads as an egg, and pinching in a neck above the
// belly reads as a cone or a hooded figure. What works is one convex
// sweep per side with no inflection at all — a dome about half the
// width of the belly at the top, widest low around y=88, and no base,
// because a roly-poly shouldn't look like it's standing on anything.
const BODY = `
  M 50 6
  C 72 6, 85 26, 88 54
  C 93 82, 88 116, 50 116
  C 12 116, 7 82, 12 54
  C 15 26, 28 6, 50 6
  Z
`

// The face is a mask left unpainted when the body is dipped, so it's a
// shape on the front rather than a head: wide at the brows, narrowing
// to the chin, sitting high enough that a band of pigment reads as a
// hood all the way around it.
const FACE = `
  M 50 16
  C 61.5 16, 69 24.5, 69.5 36
  C 70 51.5, 61.5 67, 50 67
  C 38.5 67, 30 51.5, 30.5 36
  C 31 24.5, 38.5 16, 50 16
  Z
`

// 鶴 — crane eyebrows. Heavy at the outer end, lifting to a point at
// the inner one, which is the direction the brush actually travels.
const BROW_L = 'M 29 30.5 C 31 18, 43 14.5, 49.5 21.5 C 43 18.5, 35.5 24, 33 32.5 Z'
const BROW_R = 'M 71 30.5 C 69 18, 57 14.5, 50.5 21.5 C 57 18.5, 64.5 24, 67 32.5 Z'

// 亀 — the tortoise moustache: one broad horizontal mass, heaviest at
// the centre, tapering to tips that flick *upward*.
//
// That last detail is the whole face. Whiskers that fall away at the
// ends read as a frown no matter what the eyes and brows are doing,
// and no amount of work elsewhere rescues it — two earlier attempts
// died here, one as a sad emoji and one, with a beard hanging between
// the whiskers, as a gaping mouth. Tips that rise read as stern, which
// is what Bodhidharma is supposed to look like.
const MOUSTACHE = `
  M 50 45.5
  C 55 45.5, 58.5 47, 62 49.5
  C 65.5 52, 68.5 53, 72 52
  C 69 55, 65 55.5, 61 53.5
  C 57.5 51.8, 54 51, 50 51
  C 46 51, 42.5 51.8, 39 53.5
  C 35 55.5, 31 55, 28 52
  C 31.5 53, 35 52.5, 39 49.5
  C 42.5 47, 45 45.5, 50 45.5
  Z
`

const EYE = { left: 40.5, right: 59.5, y: 36, rx: 5.2, ry: 6 }

// 並 → 極. Only the top two tiers get any extra treatment at all: a
// hairline ring for 特, a gold double ring for 極 — the same escalation
// StageBadge uses for learning → mastered, so a rare daruma reads as
// "rare" in vocabulary the app has already taught.
const RING = { toku: 1, kiwami: 2 }

// Detail is dropped by size, not scaled with it. A cartouche rendered
// at the shelf tally's 20px is three muddy pixels that make the doll
// look dirty rather than detailed, so each tier of ornament has a size
// below which it simply isn't drawn.
const DETAIL_FULL = 64   // the belly glyph
const DETAIL_FACE = 34   // brows, moustache

export function Daruma({
  color = 'aka',
  eyes = 0,
  progress = 0,
  glyph,
  rarity = 'nami',
  size = 96,
  dim = false,
  ceremonial = false,
  className = '',
}) {
  const uid = useId().replace(/:/g, '')
  const clipId = `dfill-${uid}`
  const bodyId = `dbody-${uid}`
  const shadeId = `dshade-${uid}`

  const pct = Math.max(0, Math.min(1, progress))
  // Pigment rises from the very bottom of the body box to the very
  // top; 116 and 6 are the extremes of BODY above.
  const fillTop = 116 - pct * 110
  const rings = RING[rarity] ?? 0
  const full = size >= DETAIL_FULL
  const face = size >= DETAIL_FACE

  return (
    <svg
      viewBox="0 0 100 120"
      width={size}
      height={size * 1.2}
      className={`daruma${dim ? ' daruma--dim' : ''}${ceremonial ? ' daruma--ceremonial' : ''} ${className}`}
      style={{ '--daruma-color': `var(--daruma-${color})` }}
      role="presentation"
      aria-hidden="true"
    >
      <defs>
        <path id={bodyId} d={BODY} />
        <clipPath id={clipId}>
          <rect x="0" y={fillTop} width="100" height={120 - fillTop} />
        </clipPath>
        {/* Light from the upper left, shadow gathering low right. */}
        <radialGradient id={shadeId} cx="33%" cy="24%" r="82%">
          <stop offset="0%"   stopColor="#ffffff" stopOpacity="0.20" />
          <stop offset="46%"  stopColor="#ffffff" stopOpacity="0.03" />
          <stop offset="72%"  stopColor="#000000" stopOpacity="0.06" />
          <stop offset="100%" stopColor="#000000" stopOpacity="0.30" />
        </radialGradient>
      </defs>

      {rings > 0 && (
        <>
          <ellipse className="daruma__ring" cx="50" cy="61" rx="49" ry="59" />
          {rings > 1 && <ellipse className="daruma__ring daruma__ring--inner" cx="50" cy="61" rx="45.5" ry="55.5" />}
        </>
      )}

      {/* Bare paper first, pigment clipped over it — so a doll at 40%
          is genuinely 40% painted rather than tinted at 40% alpha. */}
      <use href={`#${bodyId}`} className="daruma__paper" />
      <g clipPath={`url(#${clipId})`}>
        <use href={`#${bodyId}`} className="daruma__pigment" />
      </g>
      <use href={`#${bodyId}`} fill={`url(#${shadeId})`} />
      <use href={`#${bodyId}`} className="daruma__outline" />

      {/* Masked off before the body is dipped, on a real doll and
          here — the face never takes pigment. */}
      <path className="daruma__face" d={FACE} />

      {face && (
        <>
          <path className="daruma__brush" d={BROW_L} />
          <path className="daruma__brush" d={BROW_R} />
        </>
      )}

      <Eye side="left"  painted={eyes >= 2} />
      <Eye side="right" painted={eyes >= 1} />

      {face && <path className="daruma__brush" d={MOUSTACHE} />}

      {glyph && full && (
        <text className="daruma__glyph" x="50" y="98" textAnchor="middle">{glyph}</text>
      )}
    </svg>
  )
}

// An unpainted eye is a white hollow ringed in heavy sumi; a painted
// one is the whole thing flooded, spilling very slightly past the ring
// the way real ink does. No pupil and no catchlight — a daruma's flat
// stare is the point, and a highlight would turn it into a cartoon.
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

// ── 起 — the rise token ───────────────────────────────────
// This used to be a miniature <Daruma/>, and at the 17px a counter
// gives it that was a red blob with two dots in it — the shape that
// makes a daruma legible needs about 40px to survive, and a currency
// mark has to work at half that.
//
// So the token is its own object: a coin. A gold-rimmed disc with a
// tipped daruma struck into the face, which is a thing temples
// genuinely sell, and which reads at any size because a ring plus one
// silhouette is about as robust as a mark gets. The figure leans, and
// the arc under it is the swing it's already making on the way back
// up — 七転び八起き compressed into one glyph.
const TOKEN_BODY = 'M16 7.4 C19.3 7.4, 21.5 10.3, 22 14.4 C22.6 18.8, 20.9 23, 16 23 C11.1 23, 9.4 18.8, 10 14.4 C10.5 10.3, 12.7 7.4, 16 7.4 Z'

export function RiseToken({ size = 20, className = '' }) {
  return (
    <svg
      viewBox="0 0 32 32"
      width={size}
      height={size}
      className={`rise-token ${className}`}
      role="presentation"
      aria-hidden="true"
    >
      <circle className="rise-token__disc" cx="16" cy="16" r="15" />
      <circle className="rise-token__rim" cx="16" cy="16" r="12.4" />
      <g transform="rotate(-15 16 16)">
        <path className="rise-token__body" d={TOKEN_BODY} />
        {size >= 22 && (
          <>
            <circle className="rise-token__eye" cx="13.7" cy="14.2" r="1.5" />
            <circle className="rise-token__eye" cx="18.3" cy="14.2" r="1.5" />
          </>
        )}
      </g>
      {/* The righting swing, only where there's room to read it. */}
      {size >= 26 && <path className="rise-token__swing" d="M8.6 21.6 A 9 9 0 0 0 23.4 21.6" />}
    </svg>
  )
}
