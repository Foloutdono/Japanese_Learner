import { describe, it, expect, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { useDialog } from './useDialog'

// Mirrors the real usage shape: a scrim wrapping a panel that carries the
// dialogRef, with visible focusable controls inside. Visibility matters —
// useDialog's Tab-wrap handler filters by `offsetParent !== null`, so a
// fixture using `display: none` controls would make the trap see zero
// items and no-op.
function Dialog({ onClose }) {
  const dialogRef = useDialog(onClose)
  return (
    <div className="scrim">
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-label="Test dialog">
        <button type="button">First</button>
        <button type="button">Second</button>
        <button type="button">Third</button>
      </div>
    </div>
  )
}

function Opener({ showDialog, onClose }) {
  return (
    <div>
      <button type="button">Opener</button>
      {showDialog && <Dialog onClose={onClose} />}
    </div>
  )
}

describe('useDialog', () => {
  it('moves focus into the dialog on mount', async () => {
    const onClose = vi.fn()
    const screen = await render(<Dialog onClose={onClose} />)
    const first = screen.getByText('First').element()
    expect(document.activeElement).toBe(first)
  })

  it('calls onClose when Escape is pressed', async () => {
    const onClose = vi.fn()
    await render(<Dialog onClose={onClose} />)

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))

    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('wraps focus with Tab and Shift+Tab', async () => {
    const onClose = vi.fn()
    const screen = await render(<Dialog onClose={onClose} />)
    const first = screen.getByText('First').element()
    const last = screen.getByText('Third').element()

    last.focus()
    expect(document.activeElement).toBe(last)
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }))
    expect(document.activeElement).toBe(first)

    first.focus()
    expect(document.activeElement).toBe(first)
    window.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true })
    )
    expect(document.activeElement).toBe(last)
  })

  it('restores focus to the opener on unmount', async () => {
    const onClose = vi.fn()
    // Mount without the dialog first and focus the opener button, so that
    // when the dialog then mounts, useDialog captures *this* element as
    // the thing to restore focus to.
    const screen = await render(<Opener showDialog={false} onClose={onClose} />)
    const opener = screen.getByText('Opener').element()
    opener.focus()
    expect(document.activeElement).toBe(opener)

    await screen.rerender(<Opener showDialog={true} onClose={onClose} />)
    // Dialog is now open and has stolen focus.
    expect(document.activeElement).not.toBe(opener)

    // Re-render without the dialog to trigger useDialog's cleanup/unmount.
    await screen.rerender(<Opener showDialog={false} onClose={onClose} />)

    expect(document.activeElement).toBe(opener)
  })
})
