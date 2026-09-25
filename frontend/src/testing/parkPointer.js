import { userEvent } from 'vitest/browser'

// ── The lane's pointer, parked clear of the page ──
// A lane's pointer is shared: a file before this one may have left it
// over a row, and a hovered row is not the row at rest. So a test that
// reads a face at rest first hovers a probe in the document's top-left
// corner, over everything, and takes it away.
//
// The probe is `absolute`, never `fixed`. Vitest runs a batch of files
// in iframes stacked one under the other in its own page, so a file late
// in the batch runs in a frame below that page's viewport, and Playwright
// cannot scroll a fixed element into view there: the hover failed with
// "Element is outside of the viewport" whenever the file happened to run
// late (about one full desktop run in four). An absolute probe scrolls
// into view like any other element.
export async function parkPointer() {
  const corner = document.createElement('div')
  corner.style.cssText = 'position: absolute; left: 0; top: 0; width: 4px; height: 4px; z-index: 9999'
  document.body.appendChild(corner)
  await userEvent.hover(corner, { force: true })
  corner.remove()
}
