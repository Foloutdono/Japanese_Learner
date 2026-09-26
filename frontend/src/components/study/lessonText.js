// ── 文法 — a lesson's text, read for its shape (plan 145) ───────────
// The catalogue writes a lesson as French or English prose with the
// Japanese inline (content/grammar/*.json): "Pour poser ce dont on
// parle : わたしは, 今日は, この本は." Printed as it comes, the browser
// breaks the Japanese wherever a line runs out (ではありませんで | した),
// opens a line on the semicolon a French space left free, and gives
// the forms the reader came for the same weight as the words around
// them. So the text is read once, here, into the three shapes the
// lesson prints:
//
// - inline pieces (`inline`): plain text, the **…** emphasis the
//   locale tables also use, and Japanese runs, marked so the screen
//   can set them as Japanese and never cut a word. A run takes a
//   placeholder beside it along (A は B です is one formula).
// - a use (`readUse`): nine use lines in ten are a description, a
//   colon, and the forms that illustrate it. That becomes the
//   description over the forms, each form whole, its gloss beside it.
// - a paradigm (`readUse`'s `table`): a line made of "Label : form."
//   sentences (Négatif : …. Passé : ….) becomes label beside form.
//
// Anything that does not parse cleanly is printed as prose: a line is
// never reshaped on a guess. Pure, so the node lane holds it.

import { weld } from '../../locales/frenchSpacing'

// Kana, kanji, the iteration mark, and the punctuation a Japanese form
// carries inside it: the wave dash of 〜ている, the slash between
// alternatives (あります／います), the middle dot, the Japanese comma
// and full stop, brackets and the long ellipsis.
const JA = '々぀-ヿ㐀-鿿豈-﫿～〜／・、。「-』（）…'
const JA_CHAR = new RegExp(`[${JA}]`)
// A run, and a formula: runs and lone capital placeholders joined by
// single spaces, at least one of them Japanese (A は B です, B のほうが A より).
const PIECE = `(?:[${JA}]+|\\b[A-Z]\\b)`
const RUN = new RegExp(`${PIECE}(?: ${PIECE})*`, 'g')
const NBSP = ' '

const isJa = s => JA_CHAR.test(s)

// A term that opens a sentence belongs to the word after it: "A est B.
// **だ** est le même mot" set だ alone at a line's end. The space after
// it is welded; so is French punctuation (locales/frenchSpacing).
const OPENER = new RegExp(`(^|[.!?;]\\s+)(\\*\\*[^*]+\\*\\*|[${JA}]+) (?=\\S)`, 'g')
// A short quotation is one unit too: « il y a » broke between y and a.
const QUOTE = /«(\s)([^»]{1,12}?)(\s)»/g
export function prepare(text) {
  return weld(String(text ?? ''))
    .replace(OPENER, `$1$2${NBSP}`)
    .replace(QUOTE, (_, a, inner, b) => `«${a}${inner.replaceAll(' ', NBSP)}${b}»`)
}

// A word or a short form is never broken; a whole sentence may be, at
// its 、 first (index.css, .gl-ja). Twelve characters stand in the
// narrowest column the lesson has at the lead's rung.
export const SHORT_RUN = 12

function runs(text, strong) {
  const out = []
  let at = 0
  for (const m of text.matchAll(RUN)) {
    if (!isJa(m[0])) continue
    if (m.index > at) out.push({ text: text.slice(at, m.index), strong })
    out.push({ text: m[0].replaceAll(' ', NBSP), strong, ja: true })
    at = m.index + m[0].length
  }
  if (at < text.length) out.push({ text: text.slice(at), strong })
  return out
}

/** A line as pieces: {text, strong?, ja?}. **…** is the one markup. */
export function inline(text) {
  return prepare(text).split(/\*\*(.+?)\*\*/s).flatMap((part, i) => (part ? runs(part, i % 2 === 1) : []))
}

// One form: Japanese (a placeholder may sit in it), then an optional
// gloss in brackets -- 取るに足らない (insignifiant).
const FORM = new RegExp(`^(${PIECE}(?: ${PIECE})*)(?: \\(([^()]+)\\))?$`)
function forms(tail) {
  const body = tail.trim().replace(/\.$/, '').trim()
  if (!body) return null
  // A comma inside a gloss is the gloss's (いただく (eat, receive)).
  const HOLD = '\u0001'
  const held = body.replace(/\([^()]*\)/g, g => g.replaceAll(',', HOLD))
  const items = held.split(/,\s+(?:ou |or |et |and )?|\s+(?:ou|or|\/)\s+/)
  const out = []
  for (const item of items) {
    const m = item.replaceAll(HOLD, ',').trim().match(FORM)
    if (!m || !isJa(m[1])) return null
    out.push({ ja: m[1], gloss: m[2] ?? null })
  }
  return out
}

// The colon a description ends on: " : " in French, ": " in English,
// and never one inside a gloss's brackets (spoken: じゃありません).
const COLON = /\s?:\s/g
function splitAtLastColon(line) {
  let last = null
  for (const m of line.matchAll(COLON)) {
    const before = line.slice(0, m.index)
    if ((before.match(/\(/g)?.length ?? 0) === (before.match(/\)/g)?.length ?? 0)) last = m
  }
  if (!last) return null
  return [line.slice(0, last.index), line.slice(last.index + last[0].length)]
}

/**
 * A use line's shape: {say, forms} for "description : forms", {table}
 * for a paradigm of two or more "Label : forms." sentences, or null to
 * print the line as prose.
 */
export function readUse(line) {
  const text = String(line ?? '').trim()
  const sentences = text.split(/(?<=\.)\s+(?=\S)/)
  if (sentences.length > 1) {
    const rows = sentences.map(s => {
      const cut = splitAtLastColon(s)
      const f = cut && !/:/.test(cut[0]) && cut[0].trim() && forms(cut[1])
      return f ? { label: cut[0].trim(), forms: f } : null
    })
    if (rows.every(Boolean)) return { table: rows }
  }
  const cut = splitAtLastColon(text)
  if (!cut || !cut[0].trim()) return null
  const f = forms(cut[1])
  return f ? { say: cut[0].trim(), forms: f } : null
}
