import { apiFetch } from '../lib/api'

// ── Exam data service ─────────────────────────────────────────
// The seam every exam screen goes through — nothing reaches
// backend/routes/exams.py directly. Scoring is server-authoritative
// (backend/study/exam_scoring.py): submitAttempt() posts raw answers
// and the score that comes back is the one the app trusts, so a
// learner's result can never disagree with what the server recorded.
//
// There is deliberately no bundled exam file here. The one that used
// to ship (n5-2024-07.exam.json) was a transcription of a real JLPT
// paper and has been removed — every exam this app offers is
// generated from data the project actually owns, never copied from a
// past paper. See backend/routes/exams.py's EXAM_GENERATORS for what's
// registered: four generated papers (vocabulary, grammar, reading,
// listening) at each of the five levels.

/** List available exams (id, title, level, counts) for the picker screen. */
export async function listExams(session) {
  const res = await apiFetch('/api/exams', session)
  if (!res.ok) throw new Error(`Failed to list exams: ${res.status}`)
  return res.json()
}

/**
 * Error thrown when a paper's last generation attempt failed and the
 * server is in its cooldown window. `retryAfter` is the number of
 * seconds until another attempt is allowed — the screen shows it rather
 * than offering a retry button that would only get the same 503 back.
 */
export class ExamGenerationError extends Error {
  constructor(message, retryAfter) {
    super(message)
    this.name = 'ExamGenerationError'
    this.retryAfter = retryAfter
  }
}

/**
 * Fetch one exam in full (all sections/mondai/questions), or
 * `{ generating: true }` if the server is still building it.
 *
 * An LLM-backed paper takes minutes to generate, so the backend does
 * that on its own thread and answers 202 until it's ready (see
 * backend/routes/exams.py's get_exam) — callers poll. `apiFetch` rather
 * than `apiJson` deliberately, despite the project's usual preference:
 * this is precisely the call that needs to branch on the raw status.
 */
export async function getExam(examId, session) {
  const res = await apiFetch(`/api/exams/${examId}`, session)
  if (res.status === 202) return { generating: true }
  if (res.status === 503) {
    const body = await res.json().catch(() => ({}))
    throw new ExamGenerationError(body.error || 'Generation failed', body.retryAfter ?? 0)
  }
  if (!res.ok) throw new Error(`Unknown exam id: ${examId}`)
  return res.json()
}

/**
 * Persist a finished section attempt and return its score summary,
 * scored server-side against the materialized paper — never trust a
 * client-computed score, since a generated exam's content isn't
 * guaranteed to still match whatever the client last fetched.
 */
export async function submitAttempt(examId, { sectionId, answers, startedAt, finishedAt }, session) {
  const res = await apiFetch(`/api/exams/${examId}/attempts`, session, {
    method: 'POST',
    body: JSON.stringify({
      section_id: sectionId,
      answers,
      started_at: startedAt,
      finished_at: finishedAt,
    }),
  })
  if (!res.ok) throw new Error(`Failed to submit attempt: ${res.status}`)
  return res.json()
}

/** Reload a previously-submitted attempt — what makes a result URL survive a refresh. */
export async function getAttempt(examId, attemptId, session) {
  const res = await apiFetch(`/api/exams/${examId}/attempts/${attemptId}`, session)
  if (!res.ok) throw new Error(`Unknown attempt: ${attemptId}`)
  return res.json()
}

// ── Shape helpers ────────────────────────────────────────────
// Client-side mirror of exam_scoring.py's flatten_questions — used to
// map a question id back to its full question object for rendering
// (the server's `review` only carries ids/given/answer), never to
// compute a score itself. Kept in sync by hand with the Python
// version; if the two ever drift, question rendering breaks loudly
// (a missing field) rather than silently mis-scoring anything, since
// scoring never runs here.
export function flattenQuestions(exam) {
  const out = []
  for (const section of exam.sections) {
    for (const mondai of section.mondai) {
      pushMondaiQuestions(section, mondai, out)
    }
  }

  // Renumber continuously per section — see exam_scoring.py's
  // flatten_questions for why: every generator numbers its own
  // mondai's items starting at 1 in isolation, so without this pass
  // three mondai in one paper each show a "Q1".
  const nextNumber = {}
  for (const q of out) {
    nextNumber[q.sectionId] = (nextNumber[q.sectionId] ?? 0) + 1
    q.number = nextNumber[q.sectionId]
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
