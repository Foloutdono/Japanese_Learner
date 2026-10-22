// ── 調整 — what can be tuned from the studio (plan 248) ──────────────
// Every number a maker may want to set per post lives here, once: its
// default (what the modules did before it was tunable), its range and
// step, the sources it acts on and its label in the studio's Tune panel.
// A module reads a value with `tuned(tune, key)`, which falls back to the
// default and holds it to its range, so a stale, hand-edited or missing
// value never breaks a drawing or a timeline. The studio keeps the
// maker's values per viewer and writes the ones that differ from their
// defaults into every render command (`--tune key=value,…`), so the video
// rendered is the one previewed. Sizes are not tunable: they stay on the
// type scale (draw.js), as the README's "Easy to read" asks.

export const TUNABLES = []

const BY = new Map()
/** Adds a group's tunables to the registry. */
function group(name, sources, items) {
  for (const t of items) {
    const entry = { ...t, group: name, sources }
    TUNABLES.push(entry)
    BY.set(entry.key, entry)
  }
}

const decimals = step => (String(step).split('.')[1] || '').length
/** A value held to its tunable's range and step. */
function hold(t, v) {
  const clamped = Math.min(t.max, Math.max(t.min, v))
  const stepped = t.min + Math.round((clamped - t.min) / t.step) * t.step
  return +stepped.toFixed(decimals(t.step))
}

// Every source drawn as slides, and so a short made of one: any source
// but the clips and the videos, a source added later included.
const SLIDES = 'carousel'
const NOT_SLIDES = new Set(['promo', 'echo', 'long', 'challenge', 'words'])

group('Reading challenge', ['challenge'], [
  { key: 'challenge.pace', label: 'Reading pace', unit: '×', def: 1, min: 0.5, max: 1.6, step: 0.05, hint: 'the characters a minute of every level, times this' },
  { key: 'challenge.hook', label: 'Hook', unit: 's', def: 3.2, min: 1.5, max: 6, step: 0.1, hint: '“Can you read this?”, before the text' },
  { key: 'challenge.into', label: 'Text comes in', unit: 's', def: 1, min: 0, max: 3, step: 0.25, hint: 'the scroll stands still while it fades in' },
  { key: 'challenge.out', label: 'Last line held', unit: 's', def: 4, min: 1, max: 8, step: 0.5, hint: 'after the last line passes the reading line' },
  { key: 'challenge.gap', label: 'Pause between sentences', unit: 's', def: 0.3, min: 0.1, max: 1.5, step: 0.1, hint: 'read along: after each sentence said' },
  { key: 'challenge.ask', label: 'Question alone', unit: 's', def: 2.2, min: 1, max: 5, step: 0.1, hint: 'before the countdown starts' },
  { key: 'challenge.count', label: 'Countdown', unit: 's', def: 5, min: 0, max: 10, step: 1, hint: 'one click a second' },
  { key: 'challenge.answer', label: 'Answer shown', unit: 's', def: 3.6, min: 2, max: 8, step: 0.2 },
  { key: 'challenge.cta', label: 'The app, last', unit: 's', def: 6.5, min: 3, max: 10, step: 0.1 },
  { key: 'challenge.wash', label: 'Picture wash', unit: '×', def: 1, min: 0.6, max: 1.2, step: 0.05, hint: 'how much paper lies over the print (scroll)' },
])
group('Word echo', ['echo'], [
  { key: 'echo.seconds', label: 'Saying for', unit: 's', def: 10, min: 5, max: 20, step: 0.5, hint: 'how long the word is said over and over' },
  { key: 'echo.gap', label: 'Silence between two', unit: 's', def: 0.3, min: 0.1, max: 1.2, step: 0.05 },
  { key: 'echo.keep', label: 'Word kept', unit: 's', def: 3.5, min: 2, max: 7, step: 0.5, hint: 'the ask and the way to the app, last' },
])
group('Short video', [SLIDES], [
  { key: 'short.pace', label: 'Slide held', unit: '×', def: 1, min: 0.6, max: 1.8, step: 0.05, hint: 'each slide’s reading time, times this' },
  { key: 'short.answer', label: 'Time to answer', unit: 's', def: 4, min: 2, max: 8, step: 0.5, hint: 'added on a slide that asks' },
  { key: 'short.limit', label: 'Longest short', unit: 's', def: 59, min: 30, max: 90, step: 1, hint: 'past it, every hold is tightened alike' },
])
group('Long video', ['long'], [
  { key: 'long.pause', label: 'Pauses', unit: '×', def: 1, min: 0.5, max: 2, step: 0.05, hint: 'thinking time and the silences between lines' },
  { key: 'long.count', label: 'Quiz countdown', unit: 's', def: 5, min: 3, max: 10, step: 1 },
])
group('Reply video', ['long'], [
  { key: 'reply.count', label: 'Time to reply', unit: 's', def: 7, min: 3, max: 15, step: 1, hint: 'the timer on each question, once the three replies are up (plan 249)' },
])
// Plan 252: the vocabulary shorts, a word's beats in either look.
group('Word short', ['words'], [
  { key: 'words.think', label: 'Time to read it', unit: 's', def: 3, min: 1, max: 8, step: 0.5, hint: 'the card: the word alone, before its reading is shown and said' },
  { key: 'words.count', label: 'Time to answer', unit: 's', def: 5, min: 2, max: 10, step: 1, hint: 'the quiz: the four meanings against the fuse, a tick a second' },
  { key: 'words.hold', label: 'Meaning held', unit: 's', def: 1.4, min: 0.6, max: 4, step: 0.2, hint: 'after the word is said, before its sentence' },
  { key: 'words.after', label: 'Sentence held', unit: 's', def: 1.6, min: 0.6, max: 4, step: 0.2, hint: 'after the sentence is said, before the next word' },
])
group('Export', [SLIDES, 'promo', 'echo', 'challenge'], [
  { key: 'export.mbps', label: 'Video quality', unit: 'Mb/s', def: 8, min: 4, max: 20, step: 1, hint: 'at thirty frames a second; doubled at sixty' },
  { key: 'export.audio', label: 'Sound quality', unit: 'kb/s', def: 160, min: 96, max: 256, step: 32 },
  { key: 'export.keyframe', label: 'Keyframe every', unit: 's', def: 1, min: 0.5, max: 4, step: 0.5, hint: 'shorter seeks better, longer is smaller' },
])

/** The value a module uses for `key`: the maker's, held to its range, else the default. */
export function tuned(tune, key) {
  const t = BY.get(key)
  if (!t) throw new Error(`no tunable ${key}`)
  const v = Number(tune?.[key])
  return tune && key in tune && Number.isFinite(v) ? hold(t, v) : t.def
}

/** The tunables a source shows in the panel. */
export const tunablesFor = source => TUNABLES.filter(t => t.sources.includes(source) || (t.sources.includes(SLIDES) && !NOT_SLIDES.has(source)))

/** Only the values that differ from their defaults, held to their ranges. */
export function changed(tune) {
  const out = {}
  for (const [k, v] of Object.entries(tune || {})) {
    const t = BY.get(k)
    if (!t || !Number.isFinite(Number(v))) continue
    const h = hold(t, Number(v))
    if (h !== t.def) out[k] = h
  }
  return out
}

/** The command's flag for a source: `--tune k=v,…`, or nothing when all are defaults. */
export function tuneFlag(tune, source) {
  const keys = new Set(tunablesFor(source).map(t => t.key))
  const pairs = Object.entries(changed(tune)).filter(([k]) => keys.has(k))
  return pairs.length ? ` --tune ${pairs.map(([k, v]) => `${k}=${v}`).join(',')}` : ''
}

/** A `--tune` flag read back: unknown keys and bad numbers are dropped. */
export function parseTune(str) {
  const out = {}
  for (const pair of String(str || '').split(',')) {
    const [k, v] = pair.split('=')
    if (BY.has(k?.trim()) && Number.isFinite(Number(v))) out[k.trim()] = Number(v)
  }
  return changed(out)
}
