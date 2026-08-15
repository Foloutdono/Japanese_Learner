// ── Cosmetic previews ─────────────────────────────────────
// Every slot needs a preview that is the actual thing rather than an
// icon standing in for it: a paper swatch is a real card surface with
// real ink on it, a ring is a real progress ring, a seal is a real
// stage badge. All three are driven by the same
// `[data-*-preview="<id>"]` attributes the live components read off
// <html> (see cosmetics.js), so a swatch can never drift from what
// equipping it will actually look like — there is exactly one
// definition of each material in index.css and both paths read it.

import { flourishGlyph } from '../../stores/cosmetics'

// A ring preview is the profile ring at a fixed 68%, close enough to
// full to show the treatment along most of the circumference without
// looking complete.
const PREVIEW_PCT = 0.68

export function CosmeticSwatch({ item, size = 64 }) {
  if (item.slot === 'paper')    return <PaperSwatch item={item} size={size} />
  if (item.slot === 'ring')     return <RingSwatch item={item} size={size} />
  if (item.slot === 'seal')     return <SealSwatch item={item} size={size} />
  if (item.slot === 'backdrop') return <BackdropSwatch item={item} size={size} />
  if (item.slot === 'flourish') return <FlourishSwatch item={item} />
  if (item.slot === 'brush')    return <BrushSwatch item={item} />
  if (item.slot === 'mcq')      return <McqSwatch item={item} />
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

// A scrap of the actual room, cut to swatch size — same
// `--backdrop-*` properties #root paints itself with.
function BackdropSwatch({ item, size }) {
  return (
    <div
      className="cos-swatch cos-swatch--backdrop"
      data-backdrop-preview={item.id}
      style={{ width: size * 1.35, height: size }}
      aria-hidden="true"
    />
  )
}

// A real toast pill, in miniature: the fill and the trim are the two
// things a flourish actually changes at the speed a reward happens.
// The glyph comes from the same map XpToast reads, so the preview and
// the celebration can't show different characters.
function FlourishSwatch({ item }) {
  return (
    <div className="cos-swatch cos-swatch--flourish" data-flourish-preview={item.id} aria-hidden="true">
      <span className="cos-swatch__pill">
        <span className="cos-swatch__pill-glyph" lang="ja">{flourishGlyph(item.id)}</span>
        +8 XP
      </span>
    </div>
  )
}

// One stroke, drawn with the real ink at the real width — including
// the bleed, which is the whole of what 滲み is.
function BrushSwatch({ item }) {
  return (
    <div className="cos-swatch cos-swatch--brush" data-brush-preview={item.id} aria-hidden="true">
      <span className="cos-swatch__stroke" />
    </div>
  )
}

// 番線 — three stacked answer rows under the material, which is what
// the slot actually changes. Uses the same -preview attribute contract
// as every other swatch, so one definition dresses both the live rows
// and the case.
function McqSwatch({ item, size = 44 }) {
  return (
    <span
      className="cos-swatch cos-swatch--mcq"
      data-mcq-preview={item.id}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <span className="cos-swatch__mcq-row" />
      <span className="cos-swatch__mcq-row" />
      <span className="cos-swatch__mcq-row" />
    </span>
  )
}
