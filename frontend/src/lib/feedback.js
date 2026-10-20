import { apiJson } from './api'
import { routePattern, apiArea } from './routePattern'
import { visitContext } from './visitContext'

// ── Nous écrire — what a message carries (plan 222) ─────────────────
// backend/routes/feedback.py holds the same lists and bounds, and
// backend/tests/test_feedback.py holds the two equal. The
// context beside the words is the trail's own coarse classes
// (session_start's, lib/visitContext.js) and the route as a pattern,
// never a path: the server drops any value outside them all the same.

export const KINDS = ['problem', 'idea', 'fault']
export const CARD_REASONS = ['reading', 'meaning', 'audio', 'example', 'other']
// A mock-exam question's: `answer` is a wrong key.
export const QUESTION_REASONS = ['answer', 'ambiguous', 'audio', 'other']

/** What a mock-exam question's sheet is opened with: the paper (exam id
 *  and revision) and the question, which is all its report carries. */
export function questionReport(examId, revision, question) {
  return { exam: { examId, revision, questionId: question.id, number: question.number } }
}
export const TEXT_MAX = 1000

const OS_NAMES = {
  ios: 'iOS', android: 'Android', windows: 'Windows', mac: 'macOS', linux: 'Linux', chromeos: 'ChromeOS',
}

/** The context a message may carry: where, and on what. Read when the
 *  sheet opens, so what it shows is what is sent. */
export function feedbackContext(pathname = typeof window !== 'undefined' ? window.location.pathname : '') {
  const visit = visitContext()
  return {
    route: routePattern(pathname),
    platform: visit.platform ?? null,
    vp: visit.vp ?? null,
    os: visit.os ?? null,
    lang: visit.lang ?? null,
  }
}

/** The context in words, as the sheet prints it beside its box:
 *  the device's class, its system, web or app. */
export function contextWords(context, t) {
  return [
    t.fbDevice[context.vp],
    OS_NAMES[context.os],
    t.fbPlatform[context.platform],
  ].filter(Boolean)
}

/** A failure the sheet was opened from: its API area and status, or
 *  null when there is no area to name. */
export function failureOf(path, status) {
  const area = apiArea(path)
  return area ? { area, status: Number.isInteger(status) ? status : 0 } : null
}

/** What a card's strip prints: its face, reading, gloss and level, from
 *  whichever fields the card's kind carries. */
export function cardFace(card) {
  if (!card) return null
  const face = card.grammar || card.kanji || card.kana || ''
  const reading = card.grammar ? null : card.kanji ? (card.kana || null) : (card.romaji || null)
  const meaning = Array.isArray(card.meaning) ? card.meaning.join(', ') : (card.meaning || null)
  const level = /_(N[1-5])_/.exec(card.card_id ?? '')?.[1] ?? null
  return { face, reading, meaning, level }
}

/** A card the flag may report: the app's own content. A personal card
 *  is the learner's (or a deck author's) words, reported as a deck. */
export function reportable(card) {
  const id = card?.card_id
  return typeof id === 'string' && id.length > 0 && id.length <= 160 && !id.startsWith('custom_') && !id.includes(':')
}

export function sendFeedback(session, body) {
  return apiJson('/api/feedback', session, { method: 'POST', body: JSON.stringify(body) })
}
