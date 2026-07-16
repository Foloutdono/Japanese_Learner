/**
 * SelectionScreen
 * A centered layout wrapper used on level/phase/mode selection screens.
 *
 * Props:
 *   title    — TopBar title (passed to whatever TopBar the parent renders)
 *   subtitle — grey subtitle text shown above the grid
 *   children — the grid/buttons to display
 *   maxWidth — optional max-width for the grid container (default 700)
 */
export default function SelectionScreen({children, maxWidth = 700 }) {
  return (
    <div className="container" style={{ padding: '60px 24px', textAlign: 'center' }}>
      <div style={{ maxWidth, margin: '0 auto' }}>
        {children}
      </div>
    </div>
  )
}
