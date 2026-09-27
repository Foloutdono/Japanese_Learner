// ── One reading per run of kanji ─────────────────────────────────
// The server divides a reading per kanji where it can (間|かん 接|せつ).
// On a headline that is the point; on a small line -- a grammar card's
// formation -- a reading wider than its kanji pushes each kanji apart
// (間 接 疑 問), so there the run's readings are joined into one, the
// way the dictionary's sentences join a word's
// (components/dictionary/ExampleSentence.jsx).

/** `parts` with each run of consecutive readings joined into one part. */
export function joinRuns(parts) {
  const out = []
  for (const part of parts ?? []) {
    const last = out[out.length - 1]
    if (part.reading && last?.reading) {
      out[out.length - 1] = { text: last.text + part.text, reading: last.reading + part.reading }
    } else {
      out.push(part.reading ? { text: part.text, reading: part.reading } : part)
    }
  }
  return out
}
