/**
 * SelectionScreen
 * Centered layout shell shared by every level/phase/mode selection
 * screen. Adds a soft colour-tinted atmosphere behind the content so
 * every selection screen feels alive, even a plain grid of buttons —
 * and gives all selection screens the same header treatment.
 *
 * Props:
 *   eyebrow, heading, subtitle — optional page header, rendered above
 *     children. Leave all three unset to render just the children —
 *     e.g. when the LevelSelector/ModeSelector below already supplies
 *     its own header. (Backward compatible: existing callers that only
 *     pass `subtitle` keep working, just inside the shared header block.)
 *   glyph   — a single Japanese character shown as a large, faint
 *             watermark for atmosphere (e.g. '級' for level screens,
 *             '式' for mode screens). Optional, purely decorative.
 *   color   — accent colour used for the eyebrow, the glow and the
 *             watermark, so the atmosphere matches the section's own
 *             brand colour. Defaults to var(--accent2).
 *   maxWidth — max-width for the content column (default 880).
 */
export default function SelectionScreen({
  children,
  eyebrow,
  heading,
  subtitle,
  glyph,
  color = 'var(--accent2)',
  maxWidth = 880,
}) {
  return (
    <div className="container selection-screen">
      <div className="selection-screen__atmosphere" style={{ '--glow-color': color }} aria-hidden="true">
        {glyph && <span className="selection-screen__glyph">{glyph}</span>}
      </div>

      <div className="selection-screen__inner" style={{ maxWidth }}>
        {(eyebrow || heading || subtitle) && (
          <div className="selector-header">
            {eyebrow && <div className="selector-header__eyebrow" style={{ color }}>{eyebrow}</div>}
            {heading && <div className="selector-header__title">{heading}</div>}
            {subtitle && <div className="selector-header__subtitle">{subtitle}</div>}
          </div>
        )}
        {children}
      </div>
    </div>
  )
}