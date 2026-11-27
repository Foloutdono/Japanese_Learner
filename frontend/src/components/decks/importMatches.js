// ── 取込 — a pasted row against the app's own cards (plan 335) ──
// The import dialog's second half, kept pure so node tests can hold it.
// The server finds the cards a row may mean (POST /api/decks/{id}/import/
// match, study/import_match.py: one list of candidates per row); this
// decides what the dialog starts on and what a choice sends where.
//
//   * a row's choice is the index of a candidate, or OWN (-1): the
//     learner's written card, which is what every row was before;
//   * nothing is taken without being asked. The dialog asks once ("N cards
//     match the app's: use them?"), and until the answer a row stays as
//     written. Yes puts the rows whose match is `exact` on the app's card;
//     a word typed in kana, two cards written alike or a reading that
//     disagrees stay the learner's own unless they pick it in the details;
//   * a choice made in the details is the learner's and outlasts the
//     answer: Yes does not undo it, No (every row as written) does;
//   * a chosen candidate is sent to /cards/app as {source, level, raw_id}
//     and the row is not written; the rest go to /cards/batch as before.

export const OWN = -1

// How many candidates a row shows. The server caps its list too; this is
// what fits a phone's width as a segmented choice.
export const SHOWN = 3

/** The answer to the notice: nothing yet, or yes, or no. */
export const YES = 'yes'
export const NO = 'no'

/** What "yes" puts a row on: its exact candidate (always first), else its own. */
export function defaultPick(candidates) {
  return candidates?.[0]?.exact ? 0 : OWN
}

/** The candidates a row offers, as shown. */
export function offered(candidates) {
  return (candidates ?? []).slice(0, SHOWN)
}

/** The choice for row `i`: the learner's own, else what the answer gives it. */
export function pickOf(picks, matches, i, answer = null) {
  const own = picks[i]
  const list = offered(matches?.[i])
  if (own != null && own < list.length) return own
  return answer === YES ? defaultPick(list) : OWN
}

/** How many rows have something to choose between. */
export function matchedCount(matches) {
  return (matches ?? []).filter(c => offered(c).length > 0).length
}

/** How many rows have a candidate the server is sure of: the notice's figure. */
export function exactCount(matches) {
  return (matches ?? []).filter(c => offered(c)[0]?.exact).length
}

/** How many rows are on an app card now. */
export function usingCount(picks, matches, answer = null) {
  let n = 0
  for (let i = 0; i < (matches?.length ?? 0); i++) {
    if (pickOf(picks, matches, i, answer) !== OWN) n++
  }
  return n
}

/**
 * What the import sends: `own` the rows to write, `apps` the cards to link
 * (once each, a row naming a card another row already took is not asked
 * twice) and `same` how many rows landed on a card another row had taken.
 *
 * `rows` are the dialog's whole rows ({fields, notes}), `matches` the
 * server's lists in the same order.
 */
export function splitImport(rows, matches, picks, answer = null) {
  const own = []
  const apps = []
  const seen = new Set()
  let same = 0
  rows.forEach((row, i) => {
    const at = pickOf(picks, matches, i, answer)
    if (at === OWN) { own.push(row); return }
    const c = offered(matches[i])[at]
    const key = `${c.source}:${c.raw_id}`
    if (seen.has(key)) { same++; return }
    seen.add(key)
    apps.push({ source: c.source, level: c.level, raw_id: c.raw_id })
  })
  return { own, apps, same }
}

/** A deck's own written cards, as a key the matches belong to. */
export function matchKey(rows) {
  return JSON.stringify(rows.map(r => r.fields))
}
