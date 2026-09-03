// ── **…** — the load-bearing half of a sentence ──────────────────
// Some copy in this app is a contract, not prose: the honest line
// under the departure board, the sentence under the ghost train, the
// two halves of the vow. The mockup prints the terms you are actually
// agreeing to — the pace, the item count, the destination, the date —
// in the full ink at tabular figures, and the connective tissue around
// them in the soft one. Without that, the one line whose job is to
// name the number the drawing can only gesture at gives that number no
// more weight than the words beside it (and its figures are then the
// only ones on the screen that are neither 700 nor tabular — see
// DESIGN.md, Figures).
//
// That needs an element to hang the ink on, and a locale table cannot
// give you one: the tables are .js data, the parity test compares
// plain values, and a sentence with three emphasised runs mid-clause
// does not survive being split into six keys — French and English do
// not agree on word order. So the tables mark the runs with **…**,
// which is what a translator expects to see, and this turns them into
// <strong>.
//
// Deliberately NOT markdown: one delimiter, no nesting, no escapes,
// no links. Anything more is a parser, and a parser in the copy path
// is how a string table starts rendering arbitrary markup. Text with
// no marker is returned untouched, so a locale that has not been
// marked up yet simply prints flat.

const RUN = /\*\*(.+?)\*\*/s

export function Emphasized({ text }) {
  if (typeof text !== 'string') return text ?? null
  // split() on a capturing group alternates plain, captured, plain… so
  // the odd indices ARE the emphasised runs.
  const parts = text.split(new RegExp(RUN, 'gs'))
  if (parts.length === 1) return text
  return parts.map((part, i) => (i % 2 ? <strong key={i}>{part}</strong> : part))
}
