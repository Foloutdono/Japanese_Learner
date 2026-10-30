// ── 実践の改札 — the phone's Practice gate, as data (plan 290) ──────
// The gate hangs its platforms folded, in three groups, and a plate
// raises a sheet whose pages board the runs themselves (the owner's
// pick D4 of the canvas "Tsuji — the practice gate", improved). What
// the gate and the sheet both need to know about a platform lives
// here, with no network and no React: where a run at a grade goes, what
// a record says, and which ride was the last.

// What a platform's record counts (its station's figures).
export const UNIT = {
  reading: 'sentences', translation: 'sentences', dictation: 'sentences', composition: 'sentences',
  comprehension: 'texts', exam: 'papers', conversation: 'replies',
}

// The platforms a grade alone boards: the exam needs a paper and 会話 a
// scene, so the last ride and a grade's ticket are these five's.
export const BY_GRADE = ['reading', 'comprehension', 'dictation', 'translation', 'composition']

// The two whose runs also start from the learner's own cards or from a
// frequency tier (reading.get_reading_batch).
const SOURCED = new Set(['reading', 'translation'])

/** 'reading' for '/practice/reading', the key /api/practice/record uses. */
export const platformOf = path => path.split('/')[2]

export const isSourced = platform => SOURCED.has(platform)

/** The run at a grade, on the stage (App.jsx's run routes). */
export function runAt(platform, grade) {
  return isSourced(platform) ? `/practice/${platform}/level/${grade}` : `/practice/${platform}/${grade}`
}

/** The share of a record that went right, in whole percent; null when
 *  nothing was graded. */
export function shareRight(rec) {
  return rec?.of > 0 ? Math.round((rec.right / rec.of) * 100) : null
}

/**
 * The newest ride a grade alone boards again: {platform, grade, rec},
 * or null for a learner with none. Read from /api/practice/record's
 * `last`, which a frequency or own-cards run never writes (it logs no
 * grade), so the ride resumed is always a grade's.
 */
export function lastRide(records) {
  let best = null
  for (const platform of BY_GRADE) {
    for (const [grade, rec] of Object.entries(records?.[platform] ?? {})) {
      const at = Date.parse(rec?.last ?? '')
      if (Number.isNaN(at)) continue
      if (!best || at > best.at) best = { platform, grade, rec, at }
    }
  }
  return best && { platform: best.platform, grade: best.grade, rec: best.rec }
}

/** The exam's next paper at a grade, as its station offers it: the first
 *  the learner has not sat, in the kinds' order, else the first. */
export function nextPaper(papers) {
  return papers.find(p => !p.last) ?? papers[0] ?? null
}

/** 会話's next scene at a grade: the first with no answer graded yet. */
export function nextScene(scenes, record) {
  return scenes.find(s => !record?.[s.id]) ?? scenes[0] ?? null
}
