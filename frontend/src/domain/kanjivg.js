// ── 辻 — what a KanjiVG file holds, as data (plan 267) ───────────
// The stroke-order animation draws the file as it comes (StrokeOrderAnimation);
// the trace board needs the strokes themselves, in their order, to judge a
// hand against them (TraceBoard, as the glyph tour's backend sends them).
// Pure, with no DOM: the file's strokes are the paths of its
// `kvg:StrokePaths` group, in document order, which is the stroke order.

const PATH_D = /<path\b[^>]*?\sd="([^"]+)"/g

/** The `d` of every stroke of a KanjiVG file, in stroke order. */
export function strokesOf(svgText) {
  const text = String(svgText ?? '')
  // The strokes are nested groups (radicals); the group ends where the
  // numbers' group, or the file, does.
  const start = text.search(/<g[^>]*id="kvg:StrokePaths/)
  if (start < 0) return []
  const end = text.indexOf('id="kvg:StrokeNumbers', start)
  const body = text.slice(start, end < 0 ? undefined : end)
  return [...body.matchAll(PATH_D)].map(m => m[1])
}

/** The character a `/kanjivg/<codepoint>.svg` url draws, or null. */
export function glyphOfUrl(url) {
  const m = String(url ?? '').match(/\/([0-9a-f]{4,6})(?:-[^/]*)?\.svg(?:\?.*)?$/i)
  if (!m) return null
  try { return String.fromCodePoint(parseInt(m[1], 16)) } catch { return null }
}
