// ── A written grammar card's reading of its rule ────────────────
// The form's preview of what the server will print over the rule
// (study/grammar_examples.py's _learners_reading, whose rule this is):
// the reading spells the rule with each kanji run in kana and everything
// else as written, leniently -- a typed ~ or ～ is the 〜, the 〜 (or the
// English) the rule opens or closes on may be left out, katakana stands
// for hiragana. Each kanji run takes at least one kana per kanji, as the
// server's aligner requires. The preview reads by run; the card divides
// a run per kanji where it can (小|さ), which is the same reading.

const TILDES = /[~～]/g
const KANJI = /[一-龯々]/
const KANJI_RUNS = /[一-龯々]+|[^一-龯々]+/g
const KANA = '[ぁ-ゖァ-ヺー・]'
const LEAD = /^[^぀-ヿ一-龯々]*/
const TRAIL = /[^぀-ヿ一-龯々]*$/

/** Whether `rule` has a kanji for a reading to go over. */
export const hasKanji = rule => KANJI.test(String(rule ?? ''))

const hiragana = s => s.replace(/[ァ-ヶ]/g, c => String.fromCharCode(c.charCodeAt(0) - 0x60))
const escape = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/**
 * [{text, reading?}] for `rule` read by `reading`, spelling the rule as
 * the learner wrote it; null when the reading does not spell it, or the
 * rule has no kanji to read.
 */
export function readRule(rule, reading) {
  const text = String(rule ?? '')
  const norm = text.replace(TILDES, '〜')
  const typed = String(reading ?? '').trim().replace(TILDES, '〜')
  if (!typed || !KANJI.test(norm)) return null
  const runs = norm.match(KANJI_RUNS)
  const shape = new RegExp('^' + runs.map(run => (
    KANJI.test(run) ? `(${KANA}{${run.length},})` : escape(run)
  )).join('') + '$')
  const lead = norm.match(LEAD)[0]
  const trail = norm.match(TRAIL)[0]
  const tries = []
  for (const cand of [typed, hiragana(typed)]) {
    tries.push(cand)
    tries.push((cand.startsWith(lead) ? '' : lead) + cand + (cand.endsWith(trail) ? '' : trail))
  }
  for (const cand of new Set(tries)) {
    const m = shape.exec(cand)
    if (!m) continue
    let at = 0
    let group = 1
    return runs.map(run => {
      const part = { text: text.slice(at, at + run.length) }
      at += run.length
      return KANJI.test(run) ? { ...part, reading: m[group++] } : part
    })
  }
  return null
}
