// ── Exam data service ─────────────────────────────────────────
// Every function here returns a Promise, even though today's
// implementation resolves instantly from a local JSON file. That's
// deliberate: once the backend exists, each function body becomes a
// `apiFetch('/api/...')` call (see api.js, same as TierSelector uses)
// and nothing in any screen changes — screens only ever depend on
// this module's exported shape, never on "is this local or remote".
//
// Swap plan (when the backend lands):
//   listExams()        -> GET  /api/exams
//   getExam(id)         -> GET  /api/exams/:id
//   submitAttempt(..)   -> POST /api/exams/:id/attempts
// Keep the return shapes identical and every screen below keeps working.

// Registry of locally-bundled exams. Add a new entry here (and drop
// the matching .exam.json in ./data) to make another past paper
// available — nothing else in the app needs to change, since every
// screen only ever reads through this service.
const LOCAL_EXAMS = {
  'n5-2024-07': () => import('./data/n5-2024-07.exam.json'),
}

/** List available exams (id, title, level, counts) for the picker screen. */
export async function listExams() {
  return Promise.all(
    Object.entries(LOCAL_EXAMS).map(async ([id, loader]) => {
      const mod = await loader()
      const exam = mod.default ?? mod
      return {
        id: exam.id,
        level: exam.level,
        title: exam.title,
        titleJp: exam.titleJp,
        sectionCount: exam.sections.length,
        questionCount: countQuestions(exam),
      }
    })
  )
}

/** Fetch one exam in full (all sections/mondai/questions). */
export async function getExam(examId) {
  const loader = LOCAL_EXAMS[examId]
  if (!loader) throw new Error(`Unknown exam id: ${examId}`)
  const mod = await loader()
  return mod.default ?? mod
}

/**
 * Persist a finished attempt. Local-only for now (returns the score
 * summary immediately); once there's a backend this becomes a POST
 * and the summary comes back from the server instead of being
 * computed client-side, so the call site barely changes.
 */
export async function submitAttempt(examId, { answers, startedAt, finishedAt }) {
  const exam = await getExam(examId)
  const summary = scoreAttempt(exam, answers)
  return { examId, startedAt, finishedAt, ...summary }
}

// ── Scoring + shape helpers ────────────────────────────────────
// Pure functions, no I/O — kept here (not in a screen) so the future
// backend can reuse this exact scoring logic server-side if/when
// scoring moves off the client.

export function flattenQuestions(exam) {
  const out = []
  for (const section of exam.sections) {
    for (const mondai of section.mondai) {
      pushMondaiQuestions(section, mondai, out)
    }
  }
  return out
}

function pushMondaiQuestions(section, mondai, out) {
  const common = {
    sectionId: section.id,
    sectionLabel: section.label,
    mondaiId: mondai.id,
    mondaiNumber: mondai.number,
    type: mondai.type,
    // Mondai-level extras some renderers need alongside the question
    // itself (table-reading's flyer is the only one so far) — spread
    // in only when present so other question types stay unaffected.
    ...(mondai.flyer ? { flyer: mondai.flyer } : {}),
  }
  if (mondai.questions) {
    for (const q of mondai.questions) out.push({ ...common, ...q })
  }
  if (mondai.passages) {
    for (const passage of mondai.passages) {
      if (passage.questions) for (const q of passage.questions) out.push({ ...common, passage, ...q })
      if (passage.blanks) for (const q of passage.blanks) out.push({ ...common, passage, ...q })
    }
  }
}

function countQuestions(exam) {
  return flattenQuestions(exam).length
}

function scoreAttempt(exam, answers) {
  const questions = flattenQuestions(exam)
  let correct = 0
  const perSection = {}
  const review = questions.map(q => {
    const given = answers[q.id]
    const isCorrect = given != null && given === q.answer
    if (isCorrect) correct++
    perSection[q.sectionId] ??= { correct: 0, total: 0 }
    perSection[q.sectionId].total++
    if (isCorrect) perSection[q.sectionId].correct++
    return { id: q.id, sectionId: q.sectionId, mondaiId: q.mondaiId, given: given ?? null, answer: q.answer, isCorrect }
  })
  return {
    total: questions.length,
    correct,
    scorePct: questions.length ? Math.round((correct / questions.length) * 100) : 0,
    perSection,
    review,
  }
}
