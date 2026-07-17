/**
 * SelectionScreen
 * Layout shell shared by every level/phase/mode selection screen.
 * No glow, no watermark — negative space (ma, 間) is the atmosphere.
 * A single hairline under the header is the only ornament; the
 * eyebrow/title/list carry the visual weight.
 *
 * Props:
 *   eyebrow, heading, subtitle — optional page header, rendered above
 *     children. Leave all three unset to render just the children —
 *     e.g. when the LevelSelector/ModeSelector below already supplies
 *     its own header. (Backward compatible: existing callers that only
 *     pass `subtitle` keep working, just inside the shared header block.)
 *   maxWidth — max-width for the content column (default 720).
 *
 * Removed: `glyph` and `color` (formerly the atmosphere glow/watermark
 * tint). Callers passing them are simply ignored now — no visual
 * effect, no error.
 */
export default function SelectionScreen({
  children,
  eyebrow,
  heading,
  subtitle,
  maxWidth = 720,
}) {
  const innerStyle =
    maxWidth !== 720 ? { '--content-max-w': `${maxWidth}px` } : undefined

  return (
    <div className="container selection-screen">
      <div className="selection-screen__inner" style={innerStyle}>
        {(eyebrow || heading || subtitle) && (
          <div className="selector-header">
            {eyebrow && <div className="selector-header__eyebrow">{eyebrow}</div>}
            {heading && <div className="selector-header__title">{heading}</div>}
            {subtitle && <div className="selector-header__subtitle">{subtitle}</div>}
          </div>
        )}
        {children}
      </div>
    </div>
  )
}