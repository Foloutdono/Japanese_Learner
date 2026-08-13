// ── Cosmetic previews ─────────────────────────────────────
// Every slot needs a preview that is the actual thing rather than an
// icon standing in for it: a paper swatch is a real card surface with
// real ink on it, a ring is a real progress ring, a seal is a real
// stage badge. All three are driven by the same
// `[data-*-preview="<id>"]` attributes the live components read off
// <html> (see cosmetics.js), so a swatch can never drift from what
// equipping it will actually look like — there is exactly one
// definition of each material in index.css and both paths read it.

// A ring preview is the profile ring at a fixed 68%, close enough to
// full to show the treatment along most of the circumference without
// looking complete.
const PREVIEW_PCT = 0.68

export function CosmeticSwatch({ item, size = 64 }) {
  if (item.slot === 'paper') return <PaperSwatch item={item} size={size} />
  if (item.slot === 'ring')  return <RingSwatch item={item} size={size} />
  if (item.slot === 'seal')  return <SealSwatch item={item} size={size} />
  return <TitleSwatch item={item} />
}

function PaperSwatch({ item, size }) {
  return (
    <div
      className="cos-swatch cos-swatch--paper"
      data-paper-preview={item.id}
      style={{ width: size * 1.35, height: size }}
    >
      <span className="cos-swatch__ink" lang="ja" aria-hidden="true">永</span>
    </div>
  )
}

// 永 ("eternity") is the character calligraphy students practise
// first, because its eight strokes cover every basic brush movement —
// the traditional single-glyph test of a writing surface, which is
// exactly what this swatch is.

function RingSwatch({ item, size }) {
  const r = 26
  const c = 2 * Math.PI * r
  return (
    <svg
      className="cos-swatch cos-swatch--ring"
      data-ring-preview={item.id}
      viewBox="0 0 64 64"
      width={size}
      height={size}
      aria-hidden="true"
    >
      <circle className="cos-ring__track" cx="32" cy="32" r={r} />
      <circle className="cos-ring__deco" cx="32" cy="32" r={r} />
      <circle
        className="cos-ring__fill"
        cx="32" cy="32" r={r}
        strokeDasharray={c}
        strokeDashoffset={c * (1 - PREVIEW_PCT)}
      />
    </svg>
  )
}

// Shown at the 'learning' stage rather than 'new' or 'mastered': it's
// the middle of the three, so the material reads without the faded
// 'new' treatment or the gold-leaf 'mastered' one overwhelming it.
function SealSwatch({ item }) {
  return (
    <div className="cos-swatch cos-swatch--seal" data-seal-preview={item.id}>
      <div className="stage-badge stage-badge--learning stage-badge--inline" aria-hidden="true">
        <span className="stage-badge__glyph">習</span>
      </div>
    </div>
  )
}

function TitleSwatch({ item }) {
  return (
    <div className="cos-swatch cos-swatch--title">
      <span className="cos-swatch__title-jp" lang="ja">{item.jp}</span>
    </div>
  )
}
