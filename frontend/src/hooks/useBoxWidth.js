import { useLayoutEffect, useState } from 'react'

// ── A box's own width, for a drawing that must be drawn at it (plan 114) ──
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

// ── A box's width and height, for a layout that must fit the window ──
// The desk's stylesheet answers one query only (hooks/useDesk.js), so a
// screen that must change what it shows when the window is short or
// narrow measures the box it has instead (plan 154: a deck's page drops
// its mode cards for a row of chips when they would crowd the cards and
// the button off the window). Same contract as useBoxWidth: a callback
// ref, then { width, height } in whole pixels, or null while disabled
// or not yet measured.
export function useBoxSize(enabled) {
  const [node, setNode] = useState(null)
  const [size, setSize] = useState(null)

  useLayoutEffect(() => {
    if (!enabled || !node) return
    const read = () => {
      const rect = node.getBoundingClientRect()
      const next = { width: Math.round(rect.width), height: Math.round(rect.height) }
      setSize(prev => (prev && prev.width === next.width && prev.height === next.height ? prev : next))
    }
    read()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(read)
    observer.observe(node)
    return () => observer.disconnect()
  }, [enabled, node])

  return [setNode, enabled && node ? size : null]
}
