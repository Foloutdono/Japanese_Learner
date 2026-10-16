// ── 実践 — the practice runs' answers (plan 210) ──────────────────────
// Translation, composition, dictation and comprehension. What the app's
// backend code computes (the breakdowns, the readings, how much of an
// answer was right, the comprehension seed) comes from the bundle; what
// a model writes (the tutor's review) comes from the script, or reads,
// by default, as the review of a sentence that was simply right.

import { route } from './backend'
import { award } from './fixtures'

const REVIEW = {
  en: { correct: 'Natural and correct: this is how a native speaker would put it.' },
  fr: { correct: "Naturel et correct : c'est ainsi qu'un natif le dirait." },
}

// Two seconds of silence, for a dictation clip no voice engine made
// (VOICEVOX_URL unset): the player runs, and the film says so in the log.
function silence(seconds = 2.2) {
  const rate = 8000
  const n = Math.round(rate * seconds)
  const bytes = new Uint8Array(44 + n * 2)
  const v = new DataView(bytes.buffer)
  const w = (at, s) => [...s].forEach((c, i) => v.setUint8(at + i, c.charCodeAt(0)))
  w(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); w(8, 'WAVE'); w(12, 'fmt ')
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true)
  v.setUint32(24, rate, true); v.setUint32(28, rate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true)
  w(36, 'data'); v.setUint32(40, n * 2, true)
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return `data:audio/wav;base64,${btoa(bin)}`
}

/** The sentence's reading in hiragana, from its breakdown's tokens. */
export function readingOf(bundle, text) {
  const tokens = bundle.analyze?.[text]?.tokens ?? []
  return tokens.map(t => (/[一-鿿]/.test(t.surface) ? t.reading : t.surface)).join('')
}

export function installPracticeFixtures(part, { beat, beatsOf, phraseOf }) {
  const bundle = part.bundle ?? {}
  const lang = part.lang
  const reviewOf = b => ({
    verdict: b.verdict ?? 'correct',
    summary: b.review ?? REVIEW[lang]?.correct ?? REVIEW.en.correct,
    meaning: b.translation ?? '',
    good: b.good ?? [],
    fix: b.fix ?? [],
    grammar_used: true,
    better: null,
    better_parts: [],
    better_romaji: '',
  })
  const paid = (xp, extra = {}) => { award(part.profile, xp); return { xp_earned: xp, correct: true, ...extra } }

  // ── 翻訳 — translation ──
  route('GET', '/api/translation/batch', ({ query }) => {
    const exclude = (query.get('exclude') ?? '').split('|')
    const beats = beatsOf('translation')
    const fresh = beats.filter(b => !exclude.includes(`reel:${(b.text ?? '').trim()}`))
    return { phrases: (fresh.length ? fresh : beats).map(phraseOf) }
  })
  route('POST', '/api/translation/analyze', ({ body }) => {
    const b = beatsOf('translation').find(x => (x.text ?? '').trim() === String(body?.target_phrase ?? '').trim()) ?? beat()
    return { body: { review: reviewOf(b), analysis: null }, delay: 1300 }
  })
  route('POST', '/api/translation/result', () => paid(14))

  // ── 作文 — composition ──
  route('GET', '/api/composition/batch', () => {
    const points = beatsOf('composition').map(b => {
      const g = bundle.grammar?.[b.point] ?? {}
      return {
        raw_id: b.point, level: g.level ?? 'N5', pattern: g.pattern ?? '', structure: g.structure ?? '',
        meaning: g.meaning ?? '', register: g.register ?? 'polite', stage: 'learning',
      }
    })
    return { level: points[0]?.level ?? part.level, points }
  })
  route('POST', '/api/composition/check', () => ({ body: { found: true, japanese: null }, delay: 300 }))
  route('POST', '/api/composition/review', ({ body }) => {
    const b = beatsOf('composition').find(x => x.point === body?.raw_id) ?? beat()
    return { body: { review: reviewOf(b), analysis: null, japanese: null, found: true }, delay: 1300 }
  })
  route('POST', '/api/composition/result', () => paid(16, { leveled_up: false }))

  // ── 書取 — dictation ──
  const clipOf = b => {
    const text = (b.text ?? '').trim()
    const voiced = bundle.voice?.[text]
    return { id: `reel-${text}`, level: b.level ?? part.level, audioSrc: voiced ? `/__reel/files/${voiced}` : silence() }
  }
  route('GET', '/api/dictation/batch', ({ query }) => {
    const exclude = (query.get('exclude') ?? '').split('|')
    const beats = beatsOf('dictation')
    const fresh = beats.filter(b => !exclude.includes(`reel-${(b.text ?? '').trim()}`))
    return { level: part.level, max_plays: 2, clips: (fresh.length ? fresh : beats).map(clipOf) }
  })
  route('POST', '/api/dictation/check', ({ body }) => {
    const b = beatsOf('dictation').find(x => `reel-${(x.text ?? '').trim()}` === body?.clip_id) ?? beat()
    const text = (b.text ?? '').trim()
    const p = bundle.phrase?.[text] ?? {}
    const measured = bundle.check?.[text]?.[body?.answer] ?? { accuracy: 100, matched: 'romaji' }
    return {
      body: {
        id: body?.clip_id, level: b.level ?? part.level, jp: text, kana: readingOf(bundle, text),
        romaji: p.romaji ?? '', furigana: p.furigana ?? [{ text }], words: p.words ?? null,
        translation: b.translation ?? '', translation_lang: lang, ...measured,
      },
      delay: 450,
    }
  })
  route('POST', '/api/dictation/result', () => paid(12))

  // ── 理解 — comprehension ──
  route('GET', '/api/reading/comprehension', ({ query }) => {
    const level = query.get('level') ?? part.level
    const found = bundle.comprehension?.[level] ?? Object.values(bundle.comprehension ?? {})[0]
    return found ? { body: found, delay: 900 } : { status: 404, body: { detail: 'reel: no exercise' } }
  })
  route('POST', '/api/reading/comprehension/result', ({ body }) => {
    const questions = body?.questions ?? []
    const answers = body?.answers ?? []
    const results = questions.map((q, i) => ({
      type: q.type, question: q.question, options: q.options, correct: q.correct,
      user_answer: answers[i] ?? null, is_correct: answers[i] === q.correct,
    }))
    const score = results.filter(r => r.is_correct).length
    award(part.profile, 10 + score * 3)
    return { body: { xp_earned: 10 + score * 3, score, total: results.length, results }, delay: 600 }
  })
}
