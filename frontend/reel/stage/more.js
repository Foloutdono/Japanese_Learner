// ── 其の他 — the exam, the library, the pass's figures (plan 210) ─────
// The mock exam is a small paper of the JLPT's shape (the reading of a
// word, its writing, a word in context), marked from the answers posted
// as the server marks it; the library is a handful of decks learners
// publish; the pass's figures are the app's own test record
// (src/testing/statsRecord.js), so the profile reads as a learner's.

import { route } from './backend'
import { award } from './fixtures'
import { STATS, REPORT } from '../../src/testing/statsRecord'

const PAPER_ID = 'n4-vocab-reel'

function paperOf(level) {
  const q = (id, promptJp, underlineJp, choices, answer) => ({
    id, promptJp, underlineJp, answer: `${id}-${answer}`,
    choices: choices.map((textJp, i) => ({ id: `${id}-${i + 1}`, textJp })),
  })
  return {
    id: PAPER_ID, level, revision: 1, title: 'Vocabulary',
    sections: [{
      id: 'vocabulary', label: 'Vocabulary', labelJp: '文字・語彙', timeLimitMin: 5,
      mondai: [
        {
          id: 'm1', number: 1, nameJp: '漢字読み', type: 'mcq-text',
          instructionsJp: '＿＿＿のことばはひらがなでどうかきますか。',
          questions: [
            q('q1', '駅で友だちに会います。', '駅', ['えん', 'えき', 'いき', 'えさ'], 2),
            q('q2', '毎朝、電車に乗ります。', '電車', ['でんしゃ', 'でんしや', 'てんしゃ', 'でんじゃ'], 1),
          ],
        },
        {
          id: 'm2', number: 2, nameJp: '表記', type: 'mcq-text',
          instructionsJp: '＿＿＿のことばはどうかきますか。',
          questions: [q('q3', 'きっぷを買いました。', 'きっぷ', ['切府', '切符', '功符', '切付'], 2)],
        },
        {
          id: 'm3', number: 3, nameJp: '文脈規定', type: 'mcq-text',
          instructionsJp: '（　　）になにをいれますか。',
          questions: [q('q4', '雨が降っているので、（　　）を持って行きます。', null, ['くつ', 'かさ', 'かばん', 'めがね'], 2)],
        },
      ],
    }],
  }
}

const DECKS = lang => [
  { id: 41, name: lang === 'fr' ? 'Le japonais du voyage' : 'Travel Japanese', description: lang === 'fr' ? 'Gares, billets, hôtels : ce qu’on lit en route.' : 'Stations, tickets, hotels: what you read on the way.', type: 'vocab', card_count: 120, followers: 3412, author: 'Rin', followed: false },
  { id: 42, name: 'アニメの名台詞', description: lang === 'fr' ? 'Les répliques qu’on entend dans tous les animes.' : 'The lines every anime has.', type: 'standard', card_count: 86, followers: 2876, author: 'Kaito', followed: false },
  { id: 43, name: 'JLPT N4 verbs', description: lang === 'fr' ? 'Les verbes du N4, avec leurs conjugaisons.' : 'Every N4 verb, with its forms.', type: 'vocab', card_count: 214, followers: 1980, author: 'Léa', followed: false },
  { id: 44, name: lang === 'fr' ? 'Menus et restaurants' : 'Menus & restaurants', description: lang === 'fr' ? 'Pour commander sans pointer du doigt.' : 'Order without pointing.', type: 'vocab', card_count: 64, followers: 1204, author: 'Sam', followed: false },
]

const PREVIEW = lang => [
  { id: 1, front: '切符', kana: 'きっぷ', back: lang === 'fr' ? 'billet' : 'ticket' },
  { id: 2, front: '乗り換え', kana: 'のりかえ', back: lang === 'fr' ? 'correspondance' : 'transfer' },
  { id: 3, front: '改札', kana: 'かいさつ', back: lang === 'fr' ? 'portique' : 'ticket gate' },
  { id: 4, front: '出口', kana: 'でぐち', back: lang === 'fr' ? 'sortie' : 'exit' },
  { id: 5, front: '時刻表', kana: 'じこくひょう', back: lang === 'fr' ? 'horaires' : 'timetable' },
]

// ── The learner's record, over the app's real decks ──
// /api/stats' shape (routes/stats.py): per deck and graded mode a
// bucket, and per deck `items`, its cards counted once. The decks and
// their sizes are the bundle's (reel_fixtures.deck_sizes); how far the
// learner has come in each is theirs: kana held, the levels under
// theirs nearly done, their own level a third of the way.
const LEVELS = ['N5', 'N4', 'N3', 'N2', 'N1']
const KANA_HELD = { hiragana_basic: 1, hiragana_combos: 1, katakana_basic: 0.97, katakana_combos: 0.78 }

function shareOf(source, deck, level) {
  if (source === 'kana') return KANA_HELD[deck] ?? 0
  const at = LEVELS.indexOf(level)
  const i = LEVELS.indexOf(deck)
  if (i < at) return source === 'grammar' ? 0.88 : 0.93
  if (i === at) return source === 'grammar' ? 0.27 : 0.36
  return 0
}

export function statsOf(decks, level) {
  if (!decks) return STATS
  const out = { items: {} }
  for (const [source, byDeck] of Object.entries(decks)) {
    out[source] = {}
    out.items[source] = {}
    for (const [deck, { items, modes }] of Object.entries(byDeck)) {
      const share = shareOf(source, deck, level)
      const learned = Math.round(items * share)
      out.items[source][deck] = {
        total: items, learned, started: Math.min(items, Math.round(items * Math.min(1, share * 1.08))),
        score: Math.round(share * 10000) / 10000,
      }
      // The first two modes are the ones practised; the rest at half.
      out[source][deck] = Object.fromEntries(Object.entries(modes).map(([mode, total], i) => {
        const f = i < 2 ? share : share / 2
        const mastered = Math.round(total * f * 0.6)
        const learning = Math.round(total * f * 0.4)
        const reviews = mastered * 7 + learning * 3
        return [mode, {
          total, new: total - mastered - learning, learning, mastered, learned: Math.round(total * f),
          due_now: Math.round(learning * 0.08), reviews, correct: Math.round(reviews * 0.89),
        }]
      }))
    }
  }
  return out
}

export function installMoreFixtures(part) {
  const lang = part.lang

  // ── 模試 — the mock exam ──
  const paper = paperOf(part.level)
  const questions = paper.sections.flatMap(s => s.mondai.flatMap(m => m.questions.map(q => ({ ...q, sectionId: s.id }))))
  route('GET', '/api/exams', () => [{
    id: PAPER_ID, kind: 'vocab', level: part.level, title: 'Vocabulary', titleJp: '文字・語彙',
    questionCount: questions.length, generated: true, revision: 1, minutes: 5,
    mondai: paper.sections[0].mondai.map(m => m.nameJp),
    parts: paper.sections[0].mondai.map(m => ({ nameJp: m.nameJp, count: m.questions.length })), last: null,
  }])
  route('GET', /^\/api\/exams\/(?<id>[\w-]+)$/, () => paper)
  route('POST', /^\/api\/exams\/(?<id>[\w-]+)\/attempts$/, ({ body }) => {
    const answers = body?.answers ?? {}
    const review = questions.map(q => ({ id: q.id, sectionId: q.sectionId, given: answers[q.id] ?? null, answer: q.answer, isCorrect: answers[q.id] === q.answer }))
    const correct = review.filter(r => r.isCorrect).length
    award(part.profile, 30)
    return {
      body: {
        attemptId: 501, revision: 1, startedAt: body?.started_at, finishedAt: body?.finished_at, review,
        perSection: { vocabulary: { correct, total: review.length, pct: Math.round((100 * correct) / review.length) } },
        xp_earned: 30,
      },
      delay: 500,
    }
  })
  route('GET', /^\/api\/exams\/[\w-]+\/revisions\/\d+\/questions\/[\w-]+\/study$/, () => ({ status: 404, body: { detail: 'reel' } }))

  // ── 図書館 — the library ──
  const decks = DECKS(lang)
  const followed = new Set()
  route('GET', '/api/decks/library', () => ({
    results: decks.map(d => ({ ...d, followed: followed.has(d.id) })), total: decks.length, page: 0, limit: 20, has_more: false,
    types: ['vocab', 'standard'],
  }))
  route('GET', /^\/api\/decks\/library\/(?<id>\d+)$/, ({ params }) => {
    const d = decks.find(x => x.id === Number(params.id)) ?? decks[0]
    return { ...d, followed: followed.has(d.id), preview: PREVIEW(lang) }
  })
  route('POST', /^\/api\/decks\/(?<id>\d+)\/subscribe$/, ({ params }) => {
    followed.add(Number(params.id))
    const d = decks.find(x => x.id === Number(params.id)) ?? decks[0]
    return { ...d, role: 'follower', followed: true }
  })
  route('GET', /^\/api\/decks\/(?<id>\d+)$/, ({ params }) => {
    const d = decks.find(x => x.id === Number(params.id)) ?? decks[0]
    return { ...d, role: followed.has(d.id) ? 'follower' : 'owner', visibility: 'public' }
  })
  route('GET', /^\/api\/decks\/(?<id>\d+)\/cards$/, () => ({
    cards: PREVIEW(lang).map((c, i) => ({ ...c, origin: 'custom', notes: '', hint: '', fields: {}, state: ['due', 'learning', 'mastered', 'new', 'learning'][i] })),
  }))
  route('GET', '/api/decks/structures', () => ({ structures: [] }))
  route('GET', /^\/api\/decks\/(?<id>\d+)\/modes$/, () => ({ modes: ['vocab.flashcard.f2b', 'vocab.flashcard.b2f'] }))

  // ── 定期券 — the pass's figures ──
  route('GET', '/api/stats', () => statsOf(part.bundle?.decks, part.level))
  route('GET', '/api/stats/report', () => REPORT)
  route('GET', '/api/dictionary/radicals', () => ({ groups: [] }))
  route('GET', '/api/basics', () => ({ units: [] }))
  route('GET', '/api/agenda', () => ({ blocks: [] }))
}
