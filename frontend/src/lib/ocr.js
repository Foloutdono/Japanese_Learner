// ── In-browser OCR (tesseract.js) ─────────────────────────────
// Tier 1 of the photo-input feature (docs/adr/0004-ocr-runs-client-
// first.md): runs entirely on the learner's device, costs nothing, and
// the image never leaves it.
//
// `tesseract.js` itself is imported DYNAMICALLY, inside recognize()
// below, rather than with a static top-level import -- a static import
// would put the whole package in whatever chunk imports this module
// (i.e. the main bundle, since PhraseAnalyzerScreen.jsx is not itself
// lazy-loaded), which is exactly what plan 018 says not to do. The
// dynamic import gives it its own chunk, fetched only when a learner
// actually picks an image. The `jpn`/`jpn_vert` traineddata (15-25 MB)
// is fetched by tesseract.js itself at that same point, over the
// network -- never bundled at all.

// Tesseract's own regex range for Japanese script (hiragana, katakana,
// CJK unified ideographs) -- used by callers deciding whether to
// escalate to a vision model, not by this module itself.
export const JAPANESE_SCRIPT_RE = /[぀-ゟ゠-ヿ一-鿿]/

// Tesseract inserts a space between every CJK "word" it segments --
// an artifact of its space-delimited-language assumption, which does
// not hold for Japanese. Stripped here rather than left for every
// downstream consumer (split_sentences, furigana alignment, mining) to
// work around independently.
//
// [ \t]+ rather than \s+ deliberately -- \s also matches newlines, and
// a newline between two Japanese characters is a genuine line break
// Tesseract detected (paragraph/line structure), not an inserted
// word-separator. Matching \s+ here would silently eat those breaks
// before collapseBlankLines ever saw them.
//
// Exported separately from `recognize` so it (and collapseBlankLines)
// can be unit-tested as pure functions, without spinning up a worker.
export function stripInterCjkSpaces(text) {
  return text.replace(
    new RegExp(`(${JAPANESE_SCRIPT_RE.source})[ \\t]+(?=${JAPANESE_SCRIPT_RE.source})`, 'gu'),
    '$1'
  )
}

export function collapseBlankLines(text) {
  return text.replace(/\n{2,}/g, '\n').trim()
}

export function normalize(text) {
  return collapseBlankLines(stripInterCjkSpaces(text))
}

/**
 * Recognize Japanese text in `file` (an image File/Blob), entirely
 * client-side.
 *
 * @param {File|Blob} file
 * @param {{ vertical?: boolean, onProgress?: (info: {status: string, progress: number}) => void }} options
 * @returns {Promise<{ text: string, confidence: number }>}
 */
export async function recognize(file, { vertical = false, onProgress } = {}) {
  const { createWorker } = await import('tesseract.js')
  const lang = vertical ? 'jpn_vert' : 'jpn'
  const worker = await createWorker(lang, undefined, {
    logger: onProgress
      ? m => onProgress({ status: m.status, progress: m.progress })
      : undefined,
  })
  try {
    const { data } = await worker.recognize(file)
    return { text: normalize(data.text), confidence: data.confidence }
  } finally {
    // Never leak a worker per image -- each one holds a WASM instance
    // and the loaded traineddata in memory.
    await worker.terminate()
  }
}
