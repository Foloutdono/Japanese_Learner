import { useLayoutEffect, useState } from 'react'

// ── A box's own width, for a drawing that must be drawn at it (plan 113) ──
// An SVG whose viewBox is fixed scales with its box: the retention line's
// 326 units are a phone's card, and on the desk's 800px card every stroke
// and every stop came out two and a half times too heavy. A drawing that
// wants its strokes 1:1 measures the box it sits in and uses the figure
// as its viewBox width.
//
// Returns [ref, width]: a callback ref for the box, and its width in
// whole pixels — null while disabled or not yet measured. The first
// reading happens before paint (a layout effect), so the drawing never
// shows at the wrong scale; a ResizeObserver keeps it in step after that.
export function useBoxWidth(enabled) {
  const [node, setNode] = useState(null)
  const [width, setWidth] = useState(null)

  useLayoutEffect(() => {
    if (!enabled || !node) return
    const read = () => setWidth(Math.round(node.getBoundingClientRect().width) || null)
    read()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(read)
    observer.observe(node)
    return () => observer.disconnect()
  }, [enabled, node])

  return [setNode, enabled && node ? width : null]
}
