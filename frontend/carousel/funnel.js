// ── 導線 — the carousel that converts (plan 234) ─────────────────
// Every carousel type and source drawn on one path, five slides at most:
//   ask       the hook: the item, and the question it asks the reader
//   answer    the solution: the item answered, as the app shows it
//   cta       the feature the item comes from, illustrated, and the app
//   more      the content suite: the item in more detail
//   keys      the key points, and a reason to save the post
// The studio sets how many are dealt (3: up to the call to action, 4:
// and the key points, 5: and the detail before them) and the look:
//   clarte   清  the washi, the item large, the app's analyser in a phone
//   defi     挑  the sumi, a countdown in gold, the item in a card
//   fiche    札  a sheet to keep: the line's band over every slide
// What a slide says is the plan's (sources.js, `funnel`): the catalogue's,
// the deck's and the explainers' own lines, never written here. What the
// call to action promises is what the app does today (CLAUDE.md, the
// carousel studio): its copy is the app's own descriptions, its pictures
// are schemas of the feature, never a figure.
import {
  ASC, EDGE, FORMATS, FS, SP, R, alpha, fit, font, frame, hasKanji, layoutSentence, drawSentence, mark, measure, metal, METAL_H,
  mix, palette, paragraph, paragraphH, rrect, strokeBox, text,
} from './draw.js'
import { analyserLine, departButton, pointCard } from './app.js'
import { SITE } from './strings.js'
import { picked } from './sources.js'
import { withoutGiveaways } from './quizzes.js'

export const DESIGNS = ['clarte', 'defi', 'fiche']
export const LENGTHS = [3, 4, 5, 6, 7, 8]
// The app's features a call to action can show (plan 234b: every practice
// mode, the analyser, the question after an exercise, Today).
export const FEATURES = ['reading', 'comprehension', 'translation', 'listen', 'composition', 'exam', 'analyser', 'ask', 'today', 'words', 'kanji', 'grammar', 'kana']

// ── The words ─────────────────────────────────────────────────
export const WORDS = {
  en: {
    design: { clarte: 'Clarté', defi: 'Défi', fiche: 'Fiche' },
    ask: {
      read: 'Can you read it?', say: 'How do you say it?', know: 'Do you know this one?', mean: 'What does it mean?',
      apart: 'Can you tell them apart?', reply: 'What would you answer?', answer: 'Your answer?', pictures: 'How many do you know?',
      odd: 'Which one is the odd one out?', build: 'Can you build it?', which: 'Which one, and when?', list: 'Do you know them all?',
      passage: 'Read it, then answer',
    },
    seconds: { read: 'seconds to read it', say: 'seconds to say it', answer: 'seconds to answer' },
    count: n => `Count to ${NUM.en[n] || n}, then swipe.`,
    swipe: 'Swipe for the answer',
    save: 'Save it for later',
    answer: 'The answer',
    analyser: 'As Tsuji’s analyser cuts it',
    meaning: 'Meaning',
    detail: {
      words: 'Word by word', sentences: 'In sentences', kanjiWords: 'Words written with it', more: 'More', scene: 'The whole scene',
      pair: 'Side by side', lookalike: 'Its lookalikes', list: 'The list', next: 'Next turn', round: 'Next round', question: 'One more',
    },
    // A question the carousel leaves to its reader: answered on the slide after.
    yours: 'Your turn',
    yoursFoot: 'The answer is on the next slide',
    yoursAnswer: 'Your turn: the answer',
    keys: 'Key points',
    kinds: {
      use: ['🔧', 'How it works'], mean: ['📖', 'Meaning'], form: ['🧩', 'Form'], careful: ['⚠️', 'Watch out'], contrast: ['↔️', 'Don’t mix up'],
      reading: ['🗣️', 'Reading'], word: ['📝', 'In a word'], example: ['💬', 'Example'], parts: ['🧱', 'Its parts'], sound: ['🔊', 'Sound'],
      twin: ['🔁', 'Its twin'], why: ['💡', 'Why'], note: ['✨', 'Remember'],
    },
    saveFor: 'Save it for your next review',
    or: 'or',
    them: 'Them', you: 'You',
    cta: { head: 'Want more like this?', also: 'Also', go: `Go to ${SITE}`, band: 'More on Tsuji' },
    features: {
      reading: { name: 'Read against the clock', line: 'Read the sentence before the clock covers it, write its reading in rōmaji, then see it cut word by word.', short: 'Reading', steps: ['Read', 'Write', 'Check'], romaji: 'rōmaji' },
      comprehension: { name: 'Read a whole text', line: 'A short text, then its questions: the exam’s reading section, rehearsed.', short: 'Comprehension', steps: ['Read', 'Answer', 'Check'] },
      translation: { name: 'Say it in Japanese', line: 'A sentence to put into Japanese, then a reference answer and the tutor’s read on yours.', short: 'Translation', steps: ['Read', 'Say it', 'Tutor'] },
      composition: { name: 'Write your own sentences', line: 'You are given a grammar point: write a sentence that uses it, and a tutor reads it back.', short: 'Composition', steps: ['Point', 'Write', 'Tutor'] },
      analyser: { name: 'Read anything', line: 'Paste a sentence, a YouTube link or a photo: Tsuji cuts it word by word.', short: 'Analyser', inputs: ['Text', 'YouTube', 'Photo'] },
      ask: { name: 'Ask about it', line: 'After an exercise, ask a short question about it: a short, precise answer comes back.', short: 'Questions', ask: p => `What does ${p} do here?`, fallback: ['Why に here, and not で?', 'に marks where something is; で, where an action takes place.'] },
      today: { name: 'Today, in one run', line: 'Every review due, across every section, in one queue: one tap on Depart.', short: 'Today', depart: 'Depart', unit: 'due', lines: ['かな', '単語', '漢字', '文法'] },
      listen: { name: 'Train your ear', line: 'Two listens, no more: write what you hear, in rōmaji. N5 to N1.', short: 'Dictation', steps: ['Listen', 'Write', 'Check'] },
      exam: { name: 'Mock JLPT exams', line: 'Whole papers in the JLPT’s format, timed and scored, listening included.', short: 'Mock exams' },
      words: { name: 'Never lose a word', line: 'Words from N5 to N1, brought back by spaced repetition. Nothing to set up.', short: 'Vocabulary', memory: 'memory', time: 'time', review: 'review' },
      kanji: { name: 'Kanji, stroke by stroke', line: 'Draw each kanji in its stroke order, with its readings and the words it makes.', short: 'Kanji' },
      grammar: { name: 'Grammar that clicks', line: 'Every JLPT pattern: what it attaches to, what it does, a scene and a quiz.', short: 'Grammar', steps: ['The rule', 'A scene', 'A quiz'] },
      kana: { name: 'Kana, sound by sound', line: 'Every kana heard and traced.', short: 'Kana', free: 'Free', freeLine: 'Kana reviews cost nothing' },
    },
  },
  fr: {
    design: { clarte: 'Clarté', defi: 'Défi', fiche: 'Fiche' },
    ask: {
      read: 'Tu sais la lire ?', say: 'Comment le dire ?', know: 'Tu connais celui-ci ?', mean: 'Ça veut dire quoi ?',
      apart: 'Tu sais les distinguer ?', reply: 'Tu réponds quoi ?', answer: 'Ta réponse ?', pictures: 'Tu en connais combien ?',
      odd: 'Lequel n’est pas à sa place ?', build: 'Tu sais la construire ?', which: 'Lequel, et quand ?', list: 'Tu les connais tous ?',
      passage: 'Lis, puis réponds',
    },
    seconds: { read: 'secondes pour lire', say: 'secondes pour le dire', answer: 'secondes pour répondre' },
    count: n => `Compte jusqu’à ${NUM.fr[n] || n}, puis glisse.`,
    swipe: 'Glisse pour la réponse',
    save: 'Enregistre-le pour plus tard',
    answer: 'La réponse',
    analyser: 'Découpée par l’analyseur de Tsuji',
    meaning: 'Sens',
    detail: {
      words: 'Mot à mot', sentences: 'En phrases', kanjiWords: 'Des mots qui l’écrivent', more: 'Encore', scene: 'Toute la scène',
      pair: 'Côte à côte', lookalike: 'Ses sosies', list: 'La liste', next: 'Le tour suivant', round: 'La manche suivante', question: 'Encore une',
    },
    yours: 'À toi',
    yoursFoot: 'La réponse est juste après',
    yoursAnswer: 'À toi : la réponse',
    keys: 'À retenir',
    kinds: {
      use: ['🔧', 'Comment ça marche'], mean: ['📖', 'Sens'], form: ['🧩', 'Forme'], careful: ['⚠️', 'Attention'], contrast: ['↔️', 'À ne pas confondre'],
      reading: ['🗣️', 'Lecture'], word: ['📝', 'Dans un mot'], example: ['💬', 'Exemple'], parts: ['🧱', 'Ses parties'], sound: ['🔊', 'Son'],
      twin: ['🔁', 'Son jumeau'], why: ['💡', 'Pourquoi'], note: ['✨', 'À retenir'],
    },
    saveFor: 'Enregistre-le pour ta prochaine révision',
    or: 'ou',
    them: 'En face', you: 'Toi',
    cta: { head: 'Envie d’en voir plus ?', also: 'Et aussi', go: `Va sur ${SITE}`, band: 'Plus sur Tsuji' },
    features: {
      reading: { name: 'Lis contre la montre', line: 'Lis la phrase avant que le chrono ne la couvre, écris sa lecture en rōmaji, puis découvre-la mot à mot.', short: 'Lecture', steps: ['Lis', 'Écris', 'Vérifie'], romaji: 'rōmaji' },
      comprehension: { name: 'Lis un texte entier', line: 'Un texte court, puis ses questions : l’épreuve de lecture de l’examen, en répétition.', short: 'Compréhension', steps: ['Lis', 'Réponds', 'Vérifie'] },
      translation: { name: 'Dis-le en japonais', line: 'Une phrase à dire en japonais, puis une réponse de référence et l’avis du tuteur sur la tienne.', short: 'Traduction', steps: ['Lis', 'Dis-le', 'Tuteur'] },
      composition: { name: 'Écris tes propres phrases', line: 'Un point de grammaire est donné : écris une phrase qui l’emploie, un tuteur te la relit.', short: 'Rédaction', steps: ['Le point', 'Écris', 'Tuteur'] },
      analyser: { name: 'Tout lire', line: 'Colle une phrase, un lien YouTube ou une photo : Tsuji la découpe mot à mot.', short: 'Analyseur', inputs: ['Texte', 'YouTube', 'Photo'] },
      ask: { name: 'Pose ta question', line: 'Après un exercice, pose une courte question dessus : une réponse courte et précise arrive.', short: 'Questions', ask: p => `Que fait ${p} ici ?`, fallback: ['Pourquoi に ici, et pas で ?', 'に marque où se trouve une chose ; で, où se fait une action.'] },
      today: { name: 'Aujourd’hui, en un trajet', line: 'Toutes les révisions dues, toutes sections confondues, dans une file unique : un geste sur Embarquer.', short: 'Aujourd’hui', depart: 'Embarquer', unit: 'à réviser', lines: ['かな', '単語', '漢字', '文法'] },
      listen: { name: 'Entraîne ton oreille', line: 'Deux écoutes, pas plus : écris en rōmaji ce que tu entends. Du N5 au N1.', short: 'Dictée', steps: ['Écoute', 'Écris', 'Vérifie'] },
      exam: { name: 'Des JLPT blancs', line: 'Des épreuves entières au format du JLPT, chronométrées et notées, écoute comprise.', short: 'Examens blancs' },
      words: { name: 'Ne perds plus un mot', line: 'Les mots du N5 au N1, ramenés par la répétition espacée. Rien à régler.', short: 'Vocabulaire', memory: 'mémoire', time: 'temps', review: 'révision' },
      kanji: { name: 'Les kanji, trait par trait', line: 'Trace chaque kanji dans l’ordre de ses traits, avec ses lectures et les mots qu’il écrit.', short: 'Kanji' },
      grammar: { name: 'La grammaire qui fait tilt', line: 'Chaque point du JLPT : à quoi il s’attache, ce qu’il fait, une scène et un quiz.', short: 'Grammaire', steps: ['La règle', 'Une scène', 'Un quiz'] },
      kana: { name: 'Les kana, son par son', line: 'Chaque kana écouté et tracé.', short: 'Kana', free: 'Gratuit', freeLine: 'Les révisions de kana ne coûtent rien' },
    },
  },
}
const NUM = { en: { 3: 'three', 5: 'five', 10: 'ten', 30: 'thirty' }, fr: { 3: 'trois', 5: 'cinq', 10: 'dix', 30: 'trente' } }
// French sets a space before : ; ! ? that a line may not break at.
const weld = (lang, s) => (lang === 'fr' ? String(s).replace(/ ([:;!?»])/g, ' $1') : String(s))
const wordsOf = lang => WORDS[lang === 'fr' ? 'fr' : 'en']

// Each feature's line (config/tabs.js) and its picture in the "also" row.
const FEATURE_LINE = {
  reading: 'reading', comprehension: 'rikai', translation: 'honyaku', listen: 'kakitori', composition: 'sakubun', exam: 'exam',
  analyser: 'reading', ask: 'gold', today: 'gold', words: 'vocab', kanji: 'kanji', grammar: 'grammar', kana: 'kana',
}
const FEATURE_ICON = {
  reading: '📖', comprehension: '📰', translation: '🌐', listen: '🎧', composition: '✍️', exam: '⏱️',
  analyser: '🔍', ask: '💬', today: '🌅', words: '🔁', kanji: '🖌️', grammar: '🧩', kana: '🔤',
}
const featureInk = (p, f) => p.line[FEATURE_LINE[f]] || p.gold
// The two features shown beside the one a post promotes: reading,
// dictation and the mock exams first, as the owner asked (plan 234).
const ALSO = {
  reading: ['listen', 'ask'], comprehension: ['reading', 'exam'], translation: ['composition', 'ask'], listen: ['reading', 'exam'],
  composition: ['translation', 'ask'], exam: ['comprehension', 'listen'], analyser: ['reading', 'ask'], ask: ['reading', 'translation'],
  today: ['words', 'reading'], words: ['today', 'reading'], kanji: ['words', 'listen'], grammar: ['composition', 'exam'], kana: ['listen', 'words'],
}
const FEATURE_OF = {
  sentence: 'reading', translation: 'translation', passage: 'comprehension', lesson: 'grammar', dialogue: 'grammar', trap: 'grammar',
  word: 'words', theme: 'words', kanji: 'kanji', lookalike: 'kanji', kana: 'kana',
}

// ── What each slide shows ─────────────────────────────────────
/** The path of a type over a plan: { hook, solution, detail, keys,
 *  feature }, each a spec the slides below draw. Null where the plan
 *  has nothing to draw it from. */
/** Why a question's answer is the right one, in a line. */
const whyOf = q => q.explain?.why || (q.explain?.head && q.explain?.sense ? `${q.explain.head}: ${q.explain.sense}` : '')
export function funnelOf(type, pl, opts = {}) {
  const spec = specOf(type, pl, opts)
  if (!spec || !SENTENCED.has(pl.source)) return spec
  // A sentence's carousel breaks the sentence down whole after the call
  // to action, word by word, and asks nothing more (plan 234d): the
  // type's own detail follows it where it is not a question nor the same
  // words again.
  const own = spec.detail && !spec.detail.yours && spec.detail.kind !== 'rows' ? [spec.detail] : []
  return { ...spec, detail: null, further: [], lead: [...glossPages(pl, opts.fmt || FORMATS.post), ...own] }
}
// The sources whose item is a sentence of the reading bank.
const SENTENCED = new Set(['sentence', 'translation'])
function specOf(type, pl, opts) {
  const f = pl.funnel || {}
  const base = { keys: f.keys || [], notes: f.notes || (f.keys || []).map(text => ({ kind: 'note', text })), feature: FEATURE_OF[pl.source] || 'reading' }
  const as = (kind, list) => list.filter(Boolean).map(text => ({ kind, text }))
  const whys = qs => qs.map(whyOf).filter(Boolean)
  const asked = (qs, extra = {}) => qs.length ? {
    ...base, feature: 'exam', ...extra,
    hook: { kind: 'question', q: qs[0], ask: 'answer', seconds: 10 },
    solution: { kind: 'question', q: qs[0], revealed: true },
    detail: qs.length > 1 ? { kind: 'question', q: qs[1], yours: true } : null,
    further: qs.slice(2).map(q => ({ kind: 'question', q, yours: true })),
    keys: (whys(qs).length ? whys(qs) : base.keys).slice(0, 3),
    notes: (whys(qs).length ? as('why', whys(qs)) : base.notes).slice(0, 3),
  } : null
  switch (type) {
    case 'exam': return asked(withoutGiveaways(picked(pl, opts.picks, 3)))
    case 'spelling': return pl.spelling?.length ? asked(pl.spelling.slice(0, 3)) : null
    case 'compare': {
      const C = pl.compare
      if (!C) return null
      const ex = C.sides.filter(x => x.ex)
      return {
        ...base,
        hook: { kind: 'pair', heads: C.sides.map(x => x.head), line: C.sides[0].line, ask: 'which', seconds: 5 },
        solution: { kind: 'sides', sides: C.sides },
        detail: ex.length ? { kind: 'examples', items: ex.map(x => ({ rows: x.ex.rows, tr: x.ex.tr, head: x.head })), label: 'sentences' } : null,
        keys: [C.diff, C.careful].filter(Boolean).slice(0, 3),
        notes: [...as('contrast', [C.diff]), ...as('careful', [C.careful])],
      }
    }
    case 'build': {
      const b = pl.build
      if (!b) return null
      return {
        ...base,
        feature: 'translation',
        hook: { kind: 'quote', text: b.translation, ask: 'build', seconds: 10 },
        solution: { kind: 'answer', rows: b.rows, romaji: b.romaji, translation: b.translation },
        detail: { kind: 'rows', items: b.steps.flatMap(s => s.items).filter(x => x.t && x.label).map(x => ({ t: x.t, main: x.label, line: x.line })), label: 'words' },
      }
    }
    case 'list': {
      const L = pl.list
      if (!L) return null
      const words = L.items[0].kind === 'word'
      return {
        ...base,
        hook: { kind: 'title', head: L.head, title: L.title, line: L.line, ask: 'list', seconds: 10 },
        solution: words
          ? { kind: 'rows', items: L.items.map(x => ({ t: x.head, reading: x.reading, ro: x.ro, main: x.main, line: L.line === 'kana' ? 'vocab' : L.line })) }
          : { kind: 'sentences', items: L.items },
        detail: words && f.examples?.length ? { kind: 'examples', items: f.examples, label: 'sentences' } : null,
      }
    }
    case 'talk': {
      const T = pl.talk
      if (!T) return null
      return {
        ...base,
        hook: { kind: 'bubble', line: T.lines[0], them: T.them, place: T.place, ask: 'reply', seconds: 10 },
        solution: { kind: 'chat', lines: T.lines, them: T.them },
        detail: T.quiz ? { kind: 'question', q: T.quiz, yours: true } : null,
        keys: [T.why, T.note, ...base.keys].filter(Boolean).slice(0, 3),
        notes: [...as('use', [T.why]), ...as('note', [T.note]), ...base.notes].slice(0, 3),
      }
    }
    case 'impostor': {
      // Drawn as pictures: the rounds of pictured words, where the theme has them.
      const I = f.impostor || pl.impostor
      if (!I) return null
      const [r0, r1] = I.rounds
      return {
        ...base,
        hook: { kind: 'pictures', words: r0.words, ask: 'odd', seconds: 5 },
        solution: { kind: 'pictures', words: r0.words, odd: r0.at, reveal: true, why: r0.why },
        detail: r1 ? { kind: 'pictures', words: r1.words, odd: r1.at, why: r1.why, ask: 'odd', yours: true } : null,
        further: I.rounds.slice(2).map(r => ({ kind: 'pictures', words: r.words, odd: r.at, why: r.why, ask: 'odd', yours: true })),
        keys: I.rounds.map(r => r.why).slice(0, 3),
        notes: as('why', I.rounds.map(r => r.why)).slice(0, 3),
      }
    }
    case 'plates':
      return platesOf(pl, f, base)
    default:
      return null
  }
}

function platesOf(pl, f, base) {
  switch (pl.source) {
    case 'sentence': return {
      ...base,
      hook: { kind: 'sentence', rows: f.rows, ask: 'read', seconds: 5 },
      solution: { kind: 'analyser', toks: f.toks, points: f.points, translation: f.translation, rows: f.rows },
      detail: f.breakdown?.length ? { kind: 'rows', items: f.breakdown.map(x => ({ t: x.t, reading: x.kanji ? x.reading : '', ro: x.ro, main: x.main, sub: x.pos, line: x.line })), label: 'words' } : null,
    }
    case 'translation': return {
      ...base,
      hook: { kind: 'quote', text: f.translation, ask: 'say', seconds: 10 },
      solution: { kind: 'answer', rows: f.rows, romaji: f.romaji, translation: f.translation },
      detail: f.breakdown?.length ? { kind: 'rows', items: f.breakdown.map(x => ({ t: x.t, reading: x.kanji ? x.reading : '', ro: x.ro, main: x.main, sub: x.pos, line: x.line })), label: 'words' } : null,
    }
    case 'lesson': return {
      ...base,
      hook: { kind: 'pattern', pattern: f.point.pattern, rows: f.rows, ask: 'know', seconds: 5 },
      solution: { kind: 'point', point: f.point, rows: f.rows, translation: f.translation },
      detail: f.examples?.length ? { kind: 'examples', items: f.examples, label: 'sentences' } : null,
    }
    case 'word': return {
      ...base,
      hook: { kind: 'glyph', text: f.word.t, ask: 'read', seconds: 3 },
      solution: { kind: 'word', word: f.word },
      detail: f.examples?.length ? { kind: 'examples', items: f.examples, label: 'sentences' }
        : f.words?.length ? { kind: 'rows', items: f.words, label: 'kanjiWords' } : null,
    }
    case 'kanji': return {
      ...base,
      hook: { kind: 'glyph', text: f.kanji.c, ask: 'mean', seconds: 3 },
      solution: { kind: 'kanji', kanji: f.kanji, strokes: f.strokes },
      detail: f.words?.length ? { kind: 'rows', items: f.words, label: 'kanjiWords' } : null,
    }
    case 'kana': return {
      ...base,
      hook: { kind: 'glyph', text: f.kana.k, ask: 'read', seconds: 3 },
      solution: { kind: 'kana', kana: f.kana, strokes: f.strokes },
      detail: f.lookalike?.length > 1 ? { kind: 'kanas', items: f.lookalike, here: f.kana.k, label: 'lookalike' }
        : f.words?.length ? { kind: 'rows', items: f.words, label: 'sentences' } : null,
    }
    case 'passage': {
      const q = pl.quizzes.find(x => x.kind === 'passage') || pl.quizzes[0]
      return {
        ...base,
        // The question is asked under the text, and answered on the next slide.
        hook: { kind: 'passage', title: f.title, sents: f.sents, q, ask: 'passage', seconds: 30 },
        solution: q ? { kind: 'question', q, revealed: true } : { kind: 'rows', items: f.words },
        detail: q && f.words?.length ? { kind: 'rows', items: f.words, label: 'words' } : null,
      }
    }
    case 'theme': return {
      ...base,
      hook: { kind: 'pictures', words: f.pictures, ask: 'pictures', seconds: 10 },
      solution: { kind: 'pictures', words: f.pictures, reveal: true },
      detail: (f.impostor || pl.impostor) ? (r => ({ kind: 'pictures', words: r.words, odd: r.at, why: r.why, ask: 'odd', yours: true }))((f.impostor || pl.impostor).rounds[0]) : null,
    }
    case 'lookalike': return {
      ...base,
      hook: { kind: 'chars', chars: f.chars.map(k => k.c), ask: 'apart', seconds: 5 },
      solution: { kind: 'apart', chars: f.chars },
      detail: pl.quizzes[0] ? { kind: 'question', q: pl.quizzes[0], yours: true } : null,
    }
    case 'dialogue': {
      const [t0, t1] = f.turns
      return {
        ...base,
        hook: { kind: 'turn', turn: t0, them: f.them, romaji: f.romaji, ask: 'reply', seconds: 10 },
        solution: { kind: 'turn', turn: t0, them: f.them, romaji: f.romaji, revealed: true },
        detail: t1 ? { kind: 'turn', turn: t1, them: f.them, romaji: f.romaji, yours: true } : null,
        further: f.turns.slice(2).map(turn => ({ kind: 'turn', turn, them: f.them, romaji: f.romaji, yours: true })),
      }
    }
    case 'trap': return {
      ...base,
      hook: { kind: 'question', q: pl.quiz, ask: 'answer', seconds: 10 },
      solution: { kind: 'question', q: pl.quiz, revealed: true },
      detail: f.pair ? { kind: 'pairs', pair: f.pair, notion: f.notion, label: 'pair' } : null,
    }
    default: return null
  }
}

/** The slides a funnel deals: [{ key, draw(ctx) }]. */
export function funnelDeck(type, pl, fmt, opts = {}) {
  const spec = funnelOf(type, pl, { ...opts, fmt })
  if (!spec) return []
  const design = DESIGNS.includes(opts.design) ? opts.design : 'clarte'
  const n = LENGTHS.includes(+opts.length) ? +opts.length : 5
  const feature = FEATURES.includes(opts.feature) ? opts.feature : spec.feature
  const look = lookOf(design, fmt, pl)
  const out = [
    { key: 'ask', fn: c => hookSlide(c, spec.hook) },
    { key: 'answer', fn: c => solutionSlide(c, spec.solution) },
    { key: 'cta', fn: c => ctaSlide(c, feature) },
  ]
  // After the call to action, the suite: the detail, then more of the
  // item and more questions in turn, each question answered on the slide
  // after it; as much of it as the length leaves room for, the key points
  // last. A question with no room left for its answer has it on the key points.
  const suite = n >= 5 ? suiteOf(spec, pl) : []
  let room = n - 4
  let answer = null
  let q = 1
  let m = 0
  for (const d of suite) {
    // A sentence's breakdown is dealt whole: its later slides past the length.
    if (room <= 0 && !(d.kind === 'gloss' && d.page > 1)) break
    if (d.yours) {
      q += 1
      const k = q
      out.push({ key: `question-${k}`, fn: c => detailSlide(c, d) })
      room -= 1
      if (room > 0) {
        out.push({ key: `answer-${k}`, fn: c => solutionSlide(c, revealOf(d)) })
        room -= 1
      } else answer = answerOf(d)
    } else {
      m += 1
      out.push({ key: m === 1 ? 'more' : `more-${m}`, fn: c => detailSlide(c, d) })
      room -= 1
    }
  }
  const notes = (spec.notes || spec.keys.map(text => ({ kind: 'note', text }))).filter(x => !answer || x.text !== answer.why)
  if (n >= 4 && (notes.length || answer)) out.push({ key: 'keys', fn: c => keysSlide(c, notes, answer) })
  return out.map(sl => ({ key: sl.key, draw: ctx => sl.fn(context(ctx, look)) }))
}

// ── The look ──────────────────────────────────────────────────
function lookOf(design, fmt, pl) {
  const p = palette(design === 'defi' ? 'sumi' : 'paper')
  return { design, fmt, fr: frame(fmt), p, pl, W: wordsOf(pl.lang), lang: pl.lang, line: p.line[pl.line] || featureInk(p, FEATURE_OF[pl.source]) }
}
function context(ctx, look) {
  ctx.shadowColor = 'transparent'
  ctx.shadowBlur = 0
  ctx.fillStyle = look.p.bg
  ctx.fillRect(0, 0, look.fmt.w, look.fmt.h)
  return { ctx, ...look }
}
const tall = c => c.fmt.h > c.fmt.w * 1.5
/** How far a card reaches past the safe box's sides: less on TikTok's
 *  9:16 frame, so it stops clear of the feed's column of buttons. */
const reach = c => (tall(c) && c.fmt.fit === 'tiktok' ? SP[2] : SP[4])
// What a card stands on, and its edge, on either ground.
const cardInk = p => (p.paper ? p.card : p.panel)
const faceInk = p => (p.paper ? p.surface : mix(p.onPanel, p.panel, 0.06))
const success = p => (p.paper ? '#4d7639' : '#74a15f')

/** The head of a slide: the mark and the name (清, 挑), or the line's band
 *  with its station and what the slide is (札). Returns where content starts. */
function chrome(c, { band, jp, label, center = false, thin = false } = {}) {
  const { ctx, p, fr } = c
  // A call to action keeps the room for its picture: the band thins to
  // the strip under the feed's own bar, the mark gives way to the button.
  if (thin) {
    if (c.design === 'fiche') {
      ctx.fillStyle = band || p.gold
      ctx.fillRect(0, 0, c.fmt.w, fr.y - SP[6])
    }
    return fr.y
  }
  if (c.design === 'fiche') {
    const h = fr.y + 96
    ctx.fillStyle = band || c.line
    ctx.fillRect(0, 0, c.fmt.w, h)
    const jz = FS.display * 0.62
    let x = fr.x
    if (jp) x += text(ctx, jp, x, fr.y + 64, { f: font(900, jz, 'serif'), color: p.onLine }) + SP[5]
    if (label) {
      const room = fr.right - 70 - SP[4] - x
      const b = fit(ctx, label.toLocaleUpperCase(), { sizes: [FS.caption, FS.xs], maxW: room, maxLines: 1 })
      text(ctx, b.lines[0], x, fr.y + 54, { f: b.f, color: p.onLine, tr: 0.16 })
    }
    mark(ctx, fr.right - 60, fr.y + 4, 60, p.onLine, p.goldLit)
    return h + SP[7]
  }
  const s = 56
  const name = font(700, FS.xs, 'latin')
  const w = s + SP[4] + measure(ctx, 'TSUJI', name, 0.32)
  const x = center ? fr.cx - w / 2 : fr.x
  mark(ctx, x, fr.y, s, p.ink, p.gold)
  text(ctx, 'TSUJI', x + s + SP[4], fr.y + s * 0.68, { f: name, color: p.ink, tr: 0.32 })
  return fr.y + s + SP[7]
}
/** A small heading in capitals: what the slide is. */
function kicker(c, str, x, y, align = 'left', color = c.p.gold, maxW = c.fr.w) {
  const caps = str.toLocaleUpperCase()
  // Measured with its tracking, which fit() does not count.
  const size = [FS.caption * 1.08, FS.caption, FS.xs].find(z => measure(c.ctx, caps, font(700, z, 'latin'), 0.18) <= maxW) || FS.xs
  text(c.ctx, caps, x, y + size * 0.8, { f: font(700, size, 'latin'), color, align, tr: 0.18 })
  return size * 1.2
}
/** A card with a soft shadow, the station plates' material. */
function card(c, x, y, w, h, r = R.card * 2, fill = cardInk(c.p)) {
  const { ctx, p } = c
  ctx.save()
  ctx.shadowColor = p.paper ? 'rgba(60,45,20,0.13)' : 'rgba(0,0,0,0.35)'
  ctx.shadowBlur = 36
  ctx.shadowOffsetY = 12
  ctx.fillStyle = fill
  rrect(ctx, x, y, w, h, r)
  ctx.fill()
  ctx.restore()
  if (!p.paper) {
    ctx.strokeStyle = p.panelLine
    ctx.lineWidth = 2
    rrect(ctx, x + 1, y + 1, w - 2, h - 2, r)
    ctx.stroke()
  }
}
/** The gold stroke under a headline, as a brush leaves it. */
function swoosh(c, cx, y, w, color = c.p.gold, weight = 10) {
  const { ctx } = c
  ctx.save()
  ctx.strokeStyle = color
  ctx.lineWidth = weight
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(cx - w / 2, y + 5)
  ctx.quadraticCurveTo(cx, y - 9, cx + w / 2, y + 1)
  ctx.stroke()
  ctx.restore()
}
/** Three short strokes either side of a thing that has just happened. */
function sparks(c, cx, cy, r, color, side = 1) {
  const { ctx } = c
  ctx.save()
  ctx.strokeStyle = color
  ctx.lineWidth = 7
  ctx.lineCap = 'round'
  for (const a of [-0.55, 0, 0.55]) {
    const ang = (side > 0 ? 0 : Math.PI) + a
    ctx.beginPath()
    ctx.moveTo(cx + Math.cos(ang) * r, cy + Math.sin(ang) * r)
    ctx.lineTo(cx + Math.cos(ang) * (r + 34), cy + Math.sin(ang) * (r + 34))
    ctx.stroke()
  }
  ctx.restore()
}
/** A pill with an icon in a roundel: the foot of a hook. */
function pill(c, label, cx, y, { icon = '→', fill = faceInk(c.p), ink = c.p.ink, dot = c.line, emoji = false } = {}) {
  const { ctx, p } = c
  const h = 92
  // A pill says its line whole: a size down where the frame is narrow, never cut.
  const b = fit(ctx, label, { sizes: [FS.body, FS.sm, FS.caption], maxW: c.fr.w - h - SP[6] * 2, maxLines: 1 })
  const w = h + SP[3] + measure(ctx, b.lines[0], b.f) + SP[7]
  const x = cx - w / 2
  ctx.fillStyle = fill
  rrect(ctx, x, y, w, h, h / 2)
  ctx.fill()
  ctx.fillStyle = dot
  ctx.beginPath()
  ctx.arc(x + h / 2, y + h / 2, h / 2 - 10, 0, Math.PI * 2)
  ctx.fill()
  if (emoji) text(ctx, icon, x + h / 2, y + h / 2 + 15, { f: font(400, 40, 'emoji'), color: p.onLine, align: 'center' })
  else if (icon === 'save') bookmark(ctx, x + h / 2, y + h / 2, 36, p.onLine, { fill: true })
  else chevronIcon(ctx, x + h / 2, y + h / 2, 18, p.onLine)
  text(ctx, b.lines[0], x + h + SP[3], y + h / 2 + b.size * 0.36, { f: b.f, color: ink })
  return h
}
function chevronIcon(ctx, cx, cy, s, color) {
  ctx.save()
  ctx.strokeStyle = color
  ctx.lineWidth = s * 0.34
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.beginPath()
  ctx.moveTo(cx - s * 0.8, cy)
  ctx.lineTo(cx + s * 0.8, cy)
  ctx.moveTo(cx + s * 0.15, cy - s * 0.7)
  ctx.lineTo(cx + s * 0.85, cy)
  ctx.lineTo(cx + s * 0.15, cy + s * 0.7)
  ctx.stroke()
  ctx.restore()
}
function check(ctx, x, y, r, color, ink = '#fff') {
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.arc(x, y, r, 0, Math.PI * 2)
  ctx.fill()
  ctx.save()
  ctx.strokeStyle = ink
  ctx.lineWidth = r * 0.22
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.beginPath()
  ctx.moveTo(x - r * 0.42, y + r * 0.02)
  ctx.lineTo(x - r * 0.1, y + r * 0.34)
  ctx.lineTo(x + r * 0.45, y - r * 0.32)
  ctx.stroke()
  ctx.restore()
}
const emojiAt = (ctx, e, cx, cy, size) => text(ctx, e, cx, cy + size * 0.36, { f: font(400, size, 'emoji'), color: '#000', align: 'center' })

/** A block centred in [top, bottom]; one taller than the room (a long N1
 *  sentence at its smallest rung) is drawn smaller, never past the foot. */
function place(c, b, top, bottom) {
  const room = bottom - top
  if (b.h <= room) return b.draw(top + (room - b.h) / 2)
  const k = room / b.h
  const { ctx, fr } = c
  ctx.save()
  ctx.translate(fr.cx, top)
  ctx.scale(k, k)
  ctx.translate(-fr.cx, -top)
  b.draw(top)
  ctx.restore()
}
/** Blocks one under the other, centred in [top, bottom] where they leave room. */
function stack(blocks, top, bottom, gap) {
  const list = blocks.filter(b => b && b.h > 0)
  const total = list.reduce((a, b) => a + b.h, 0) + gap * Math.max(0, list.length - 1)
  let y = top + Math.max(0, (bottom - top - total) / 2)
  for (const b of list) {
    b.draw(y)
    y += b.h + gap
  }
  return total
}
const none = { h: 0, draw() {} }
// A part measured by drawing it where nobody sees: a canvas of its own
// in a browser, else the slide's own with nothing laid down.
let SCRATCH = null
function measured(ctx, fn) {
  if (typeof document !== 'undefined') return fn(SCRATCH ||= document.createElement('canvas').getContext('2d'))
  ctx.save()
  ctx.globalAlpha = 0
  const h = fn(ctx)
  ctx.restore()
  return h
}
/** The longest list that fits: `make(k)` for k from `n` down to one. */
function fitting(n, maxH, make) {
  let b = none
  for (let k = n; k >= 1; k--) {
    b = make(k)
    if (b.h <= maxH) return b
  }
  return b
}
const textBlock = (c, str, { x, w, sizes, weight = 700, fam = 'latin', color = c.p.ink, align = 'center', maxLines = 3, lh = 1.2, maxH = Infinity }) => {
  if (!str) return none
  const b = fit(c.ctx, str, { weight, fam, sizes, maxW: w, maxLines, maxH, lh, balanced: align === 'center' })
  const ax = align === 'center' ? x + w / 2 : align === 'right' ? x + w : x
  return { h: paragraphH(b, lh), b, cut: !!b.cut, draw: y => paragraph(c.ctx, b, ax, y, color, align, lh) }
}

// ── The item, as large as it can be read ──────────────────────
/** A sentence, each word over its line's rule (a word the vocabulary's, a
 *  particle the grammar's), or the lit words alone ruled in gold. */
function sentenceBlock(c, rows, { x, w, maxH, max = FS.display * 1.15, min = FS.title, script = c.pl.script, romaji = false, lines = 3, lit = null, align = 'center', ink = c.p.ink, fam = 'serif', fewest = false }) {
  if (!rows?.length) return none
  const at = k => layoutSentence(c.ctx, rows, { max, min, maxW: w, maxH, maxLines: k, script, romaji, rules: false, under: 0.34, gap: 0.08, fam, weight: 700 })
  // `fewest`: on as few lines as it sets in, then as large as they hold
  // (plan 234d): これはわたしの本です。 on one line, not three.
  let L = null
  if (fewest) for (let k = 1; k <= lines && !L; k++) { const T = at(k); if (T && T.lines.length <= k && T.h <= maxH) L = T }
  L ||= at(lines)
  if (!L) return none
  const ruleOf = (u) => {
    if (u.row.k === 'punct') return null
    if (lit) return lit(u.row) ? c.p.gold : null
    return u.row.k === 'word' ? c.p.line.vocab : c.p.line.grammar
  }
  const ax = align === 'center' ? x + w / 2 : x
  return { h: L.h, L, draw: y => drawSentence(c.ctx, L, ax, y, align, u => ({ ink, ruby: c.p.ink2, romaji: c.p.ink2, rule: ruleOf(u), ruleW: Math.max(6, L.size * 0.075) })) }
}
/** A word, a kanji or a kana alone, as large as the room lets it be. */
function glyphBlock(c, str, { x, w, maxH, max, fam = 'serif', color = c.p.ink, rule = true }) {
  const { ctx } = c
  const one = [...str].length === 1
  let size = Math.min(max ?? (one ? FS.glyph * 1.35 : FS.word * 1.15), maxH * (rule ? 0.78 : 0.88))
  while (size > FS.title && measure(ctx, str, font(700, size, fam)) > w) size -= 4
  if (measure(ctx, str, font(700, size, fam)) > w) {
    const b = fit(ctx, str, { fam, weight: 700, sizes: [FS.display, FS.heading, FS.title, FS.lead], maxW: w, maxLines: 3, maxH })
    return { h: paragraphH(b), draw: y => paragraph(ctx, b, x + w / 2, y, color, 'center') }
  }
  const rh = rule ? SP[6] + 12 : 0
  return {
    h: size * 1.04 + rh,
    draw: y => {
      const tw = text(ctx, str, x + w / 2, y + size * ASC, { f: font(700, size, fam), color, align: 'center' })
      if (rule) swoosh(c, x + w / 2, y + size * 1.04 + SP[5], Math.min(tw * 0.8, w * 0.6), c.line, 11)
    },
  }
}
const quoteBlock = (c, str, o) => textBlock(c, `“${str}”`, { sizes: [FS.display, FS.heading, FS.title, FS.lead], fam: 'serif', weight: 700, maxLines: 5, lh: 1.15, ...o })

/** A question's choices as the app's answer rows: a numbered roundel and
 *  the answer, the right one in the success ink once answered. */
function choicesBlock(c, q, { x, w, maxH = Infinity, revealed = false, sizes = [FS.title, FS.lead, FS.body, FS.sm, FS.caption] }) {
  const { ctx, p } = c
  const all = q.choices.map(ch => ({ label: ch.rows ? ch.rows.map(r => r.t).join('') : ch.text, fam: ch.rows || ch.fam === 'jp' ? 'jp' : ch.fam === 'serif' ? 'serif' : 'latin' }))
  const show = revealed && q.answerOnly ? [q.right] : all.map((_, i) => i)
  const gap = SP[3]
  let lay = null
  for (const z of sizes) {
    const r = z * 0.62
    const tw = w - SP[5] - r * 2 - SP[5] - SP[5]
    const rows = show.map(i => {
      const o = { weight: all[i].fam === 'jp' ? 500 : 700, fam: all[i].fam, sizes: [z], maxW: tw, balanced: false }
      // A long choice (a sentence's translation) takes a fourth line before it is cut.
      const b3 = fit(ctx, all[i].label, { ...o, maxLines: 3 })
      const b = b3.cut ? fit(ctx, all[i].label, { ...o, maxLines: 4 }) : b3
      return { i, b, h: Math.max(z * 1.9, paragraphH(b) + z * 1.1) }
    })
    const total = rows.reduce((a, r2) => a + r2.h, 0) + gap * (rows.length - 1)
    lay = { z, r, rows, total }
    if (total <= maxH && rows.every(r2 => !r2.b.cut)) break
  }
  const ok = success(p)
  return {
    h: lay.total,
    cut: lay.rows.some(r2 => r2.b.cut),
    draw: y => {
      let at = y
      for (const row of lay.rows) {
        const right = revealed && row.i === q.right
        ctx.fillStyle = right ? mix(ok, cardInk(p), 0.14) : faceInk(p)
        rrect(ctx, x, at, w, row.h, R.card * 1.4)
        ctx.fill()
        ctx.strokeStyle = right ? ok : p.paper ? p.surfaceLine : p.panelLine
        ctx.lineWidth = right ? 4 : 2
        rrect(ctx, x + 1, at + 1, w - 2, row.h - 2, R.card * 1.4)
        ctx.stroke()
        const cx = x + SP[5] + lay.r
        const cy = at + row.h / 2
        if (right) check(ctx, cx, cy, lay.r, ok, cardInk(p))
        else {
          ctx.strokeStyle = revealed ? alpha(p.ink2, 0.5) : c.line
          ctx.lineWidth = 4
          ctx.beginPath()
          ctx.arc(cx, cy, lay.r - 2, 0, Math.PI * 2)
          ctx.stroke()
          const nz = Math.max(FS.xs * 0.85, lay.z * 0.8)
          text(ctx, String(row.i + 1), cx, cy + nz * 0.36, { f: font(700, nz, 'latin'), color: revealed ? p.ink2 : p.ink, align: 'center' })
        }
        const ink = right ? ok : revealed ? p.ink2 : p.ink
        paragraph(ctx, row.b, cx + lay.r + SP[5], cy - paragraphH(row.b) / 2, ink, 'left')
        at += row.h + gap
      }
    },
  }
}
/** What a question asks over: its sentence (the asked word ruled in
 *  gold), its word, its quoted text, its picture, or the line it answers. */
function stemBlock(c, q, { x, w, maxH, revealed }) {
  const st = revealed && q.stem?.after ? q.stem.after : q.stem?.cue && revealed ? { task: q.stem.task } : q.stem
  if (!st) return none
  if (st.rows) {
    const target = st.target
    const lit = target != null ? r => st.rows.indexOf(r) === target : st.underLit ? r => r.lit : null
    const s = sentenceBlock(c, st.rows, { x, w, maxH: maxH - (st.tr ? FS.body * 2 : 0), max: FS.heading, min: FS.body, script: st.script || c.pl.script, lit: lit || (() => false), lines: 3 })
    const t = st.tr ? textBlock(c, st.tr, { x, w, sizes: [FS.body, FS.sm], weight: 500, color: c.p.ink2, maxLines: 2 }) : none
    return { h: s.h + (t.h ? SP[4] + t.h : 0), draw: y => { s.draw(y); t.draw(y + s.h + SP[4]) } }
  }
  if (st.specimen) return glyphBlock(c, st.specimen, { x, w, maxH, max: FS.word, rule: false })
  if (st.text) return quoteBlock(c, st.text, { x, w, maxH, sizes: [FS.heading, FS.title, FS.lead, FS.body, FS.sm] })
  if (st.emoji) return { h: Math.min(FS.glyph, maxH), draw: y => emojiAt(c.ctx, st.emoji, x + w / 2, y + Math.min(FS.glyph, maxH) / 2, Math.min(FS.glyph, maxH) * 0.8) }
  if (st.cue) return bubbleBlock(c, st.cue, { x, w, maxH, who: st.them })
  if (st.task) return textBlock(c, st.task, { x, w, sizes: [FS.lead, FS.body], weight: 500, color: c.p.ink2 })
  return none
}
/** A question whole: what it asks, over what, its choices, and once
 *  answered, why. */
function questionBlock(c, q, { x, w, maxH, revealed = false }) {
  const whyText = q.explain?.why || (q.explain?.sense ? `${q.explain.head ? `${q.explain.head} · ` : ''}${q.explain.sense}` : '')
  // The largest set of sizes at which the question, its stem, its choices
  // and its why all fit; the why gives way before anything is set small.
  let lay = null
  // A layout that cuts a text is kept only where none down to the small
  // rung fits whole: a size down is read, a sentence cut short is not.
  let pick = null
  let firstFit = null
  const whole = L => !L.ask.cut && !L.stem.cut && !L.choices.cut && !L.why.cut
  for (const withWhy of revealed && whyText ? [true, false] : [false]) {
    for (const z of [FS.title, FS.lead, FS.body, FS.sm, FS.caption, FS.xs]) {
      const gap = z >= FS.body ? SP[6] : z >= FS.caption ? SP[5] : SP[4]
      const ask = textBlock(c, q.ask, { x, w, sizes: [Math.min(FS.title, z * 1.12), FS.body, FS.sm], align: 'left', maxLines: 4 })
      const why = withWhy ? textBlock(c, whyText, { x, w, sizes: [Math.min(FS.body, z), FS.sm, FS.caption], weight: 500, color: c.p.ink2, align: 'left', maxLines: 4 }) : none
      const choices = choicesBlock(c, q, { x, w, revealed, sizes: [z] })
      const rest = maxH - ask.h - choices.h - (why.h ? why.h + gap : 0) - gap * 2
      const stem = rest > FS.body * 1.6 ? stemBlock(c, q, { x, w, maxH: rest, revealed }) : none
      const total = ask.h + (stem.h ? gap + stem.h : 0) + gap + choices.h + (why.h ? gap + why.h : 0)
      lay = { gap, ask, why, choices, stem, total }
      if (total > maxH || (q.stem && !stem.h)) continue
      if (z >= FS.sm && whole(lay)) { pick = lay; break }
      firstFit ||= lay
      if (z < FS.sm) break
    }
    if (pick) break
  }
  lay = pick || firstFit || lay
  const { gap, ask, why, choices, stem } = lay
  return {
    h: lay.total,
    cut: !whole(lay),
    draw: y => {
      let at = y
      ask.draw(at)
      at += ask.h + gap
      if (stem.h) { stem.draw(at); at += stem.h + gap }
      choices.draw(at)
      at += choices.h + gap
      why.draw(at)
    },
  }
}
/** A question answered, on the slide after the one that asked it: what
 *  it asked about as answered (the sentence completed, the word or the
 *  kanji itself), the right answer large on its card, and why. Never the
 *  question again, nor its other choices. */
function solutionBlock(c, q, { x, w, maxH }) {
  const { ctx, p } = c
  const ch = q.choices[q.right]
  const said = ch.rows ? ch.rows.map(r => r.t).join('') : ch.text
  const fam = ch.rows || ch.fam === 'jp' ? 'jp' : ch.fam === 'serif' ? 'serif' : 'latin'
  const whyText = q.explain?.why || (q.explain?.sense ? `${q.explain.head ? `${q.explain.head} · ` : ''}${q.explain.sense}` : '')
  // What was asked about, as answered: a sentence's own completed form; a
  // word, a kanji, a picture or a gloss as it was shown.
  const st = q.stem?.after || (q.stem?.specimen || q.stem?.text || q.stem?.emoji ? q.stem : null)
  const ok = success(p)
  const r = 34
  const pad = SP[6]
  const card = z => {
    // On one line where any size holds it: Japanese has no space to break at.
    const maxW = w - pad * 2 - r * 2 - SP[5]
    const sizes = [z, FS.title, FS.lead, FS.body].filter(v => v <= z)
    const one = fit(ctx, said, { fam, weight: 700, sizes, maxW, maxLines: 1 })
    const two = one.cut ? fit(ctx, said, { fam, weight: 700, sizes, maxW, maxLines: 2, balanced: false }) : one
    // A long answer takes a third line, a rung down, before it is cut.
    const b = two.cut ? fit(ctx, said, { fam, weight: 700, sizes: [...sizes.slice(-1), FS.sm], maxW, maxLines: 3, balanced: false }) : two
    const h = pad * 2 + Math.max(r * 2, paragraphH(b))
    return {
      h,
      cut: !!b.cut,
      draw: y => {
        ctx.fillStyle = mix(ok, cardInk(p), p.paper ? 0.14 : 0.2)
        rrect(ctx, x, y, w, h, R.card * 2)
        ctx.fill()
        ctx.strokeStyle = ok
        ctx.lineWidth = 4
        rrect(ctx, x + 2, y + 2, w - 4, h - 4, R.card * 2)
        ctx.stroke()
        check(ctx, x + pad + r, y + h / 2, r, ok, cardInk(p))
        paragraph(ctx, b, x + pad + r * 2 + SP[5], y + (h - paragraphH(b)) / 2, p.ink, 'left')
      },
    }
  }
  const itemOf = room => {
    if (!st || room < FS.body * 1.6) return none
    if (st.rows) {
      const lit = st.target != null ? row => st.rows.indexOf(row) === st.target : () => false
      return sentenceBlock(c, st.rows, { x, w, maxH: room, max: FS.heading, min: FS.body, script: st.script || c.pl.script, lit, lines: 3 })
    }
    if (st.specimen) return glyphBlock(c, st.specimen, { x, w, maxH: room, max: FS.word, rule: false })
    if (st.text) return quoteBlock(c, st.text, { x, w, maxH: room, sizes: [FS.heading, FS.title, FS.lead] })
    const z = Math.min(FS.glyph, room)
    return { h: z, draw: y => emojiAt(ctx, st.emoji, x + w / 2, y + z / 2, z * 0.8) }
  }
  // The answer large, then why; the why gives way, then the item's room.
  // A layout that cuts the answer or its why is kept only where none fits whole.
  let out = none
  let firstFit = null
  for (const z of [FS.heading, FS.title, FS.lead]) {
    const a = card(z)
    for (const whyZ of [[FS.lead, FS.body], [FS.body, FS.sm], [FS.sm, FS.caption]]) {
      const why = whyText ? textBlock(c, whyText, { x, w, sizes: whyZ, weight: 500, color: p.ink2, align: 'left', maxLines: 5 }) : none
      const room = Math.min(maxH * 0.45, maxH - a.h - why.h - SP[7] - SP[6])
      out = stackOf([itemOf(room), a, why], [SP[7], SP[6]])
      if (out.h > maxH) continue
      if (!a.cut && !why.cut) return out
      firstFit ||= out
    }
  }
  return firstFit || out
}
/** One line of a scene, in its bubble: who says it, the line, its sense. */
function bubbleBlock(c, line, o) {
  // Where the line does not fit, its romaji gives way, then its sense.
  const tries = [o, { ...o, romaji: false }, { ...o, romaji: false, tr: false }]
  let b = null
  for (const t of tries) {
    b = bubbleOnce(c, line, t)
    if (b.h <= (o.maxH ?? Infinity)) return b
  }
  return b
}
function bubbleOnce(c, line, { x, w, maxH = Infinity, who, me = false, romaji = false, tr = true }) {
  const { ctx, p } = c
  const pad = SP[6]
  const bw = w * 0.9
  const bx = me ? x + w - bw : x
  const name = who ? textBlock(c, who.toLocaleUpperCase(), { x: bx + pad, w: bw - pad * 2, sizes: [FS.caption], align: me ? 'right' : 'left', color: me ? c.line : p.ink2, maxLines: 1 }) : none
  const t = tr && line.tr ? textBlock(c, line.tr, { x: bx + pad, w: bw - pad * 2, sizes: [FS.body, FS.sm], weight: 500, color: p.ink2, align: me ? 'right' : 'left', maxLines: 3 }) : none
  const s = sentenceBlock(c, line.rows, { x: bx + pad, w: bw - pad * 2, maxH: maxH - name.h - t.h - pad * 2 - SP[4] * 2, max: FS.heading, min: FS.sm, script: 'furigana', romaji, align: me ? 'right' : 'left', fam: 'jp', lines: 3 })
  const h = pad * 2 + name.h + (name.h ? SP[3] : 0) + s.h + (t.h ? SP[4] + t.h : 0)
  // Its height counts the tail under it.
  return {
    h: h + 26,
    draw: y => {
      ctx.fillStyle = me ? mix(c.line, cardInk(p), 0.12) : faceInk(p)
      rrect(ctx, bx, y, bw, h, R.card * 2)
      ctx.fill()
      if (me) {
        ctx.strokeStyle = c.line
        ctx.lineWidth = 3
        rrect(ctx, bx + 1.5, y + 1.5, bw - 3, h - 3, R.card * 2)
        ctx.stroke()
      }
      // The bubble's tail, on the speaker's side.
      ctx.fillStyle = me ? c.line : faceInk(p)
      ctx.beginPath()
      const tx = me ? bx + bw - 40 : bx + 40
      ctx.moveTo(tx - 18, y + h - 2)
      ctx.lineTo(tx + (me ? 24 : -24), y + h + 26)
      ctx.lineTo(tx + 18, y + h - 2)
      ctx.fill()
      let at = y + pad
      name.draw(at)
      at += name.h + (name.h ? SP[3] : 0)
      s.draw(at)
      at += s.h + SP[4]
      t.draw(at)
    },
  }
}

// ── The answers, as the app shows them ───────────────────────
/** The phone the app runs in, its screen's content box returned. */
function phone(c, x, y, w, h) {
  const { ctx, p } = c
  ctx.save()
  ctx.shadowColor = 'rgba(40,30,10,0.2)'
  ctx.shadowBlur = 50
  ctx.shadowOffsetY = 18
  ctx.fillStyle = p.paper ? '#2a2620' : '#0b0a0d'
  rrect(ctx, x, y, w, h, 64)
  ctx.fill()
  ctx.restore()
  ctx.fillStyle = cardInk(p)
  rrect(ctx, x + 14, y + 14, w - 28, h - 28, 52)
  ctx.fill()
  ctx.fillStyle = p.paper ? '#2a2620' : '#0b0a0d'
  rrect(ctx, x + w / 2 - 70, y + 30, 140, 30, 15)
  ctx.fill()
  return { x: x + 46, y: y + 86, w: w - 92, h: h - 86 - 50 }
}
/** The analyser's line at the largest scale that fits, its points under it. */
function analyserBlock(c, s, o) {
  const tries = [o, { ...o, framed: false }, { ...o, framed: false, small: true }, { ...o, framed: false, small: true, bare: true }]
  let b = none
  let firstFit = null
  for (const t of tries) {
    b = analyserOnce(c, s, t)
    if (b.h > o.maxH) continue
    if (!b.cut) return b
    firstFit ||= b
  }
  return firstFit || b
}
function analyserOnce(c, s, { x, w, maxH, framed, small = false, bare = false }) {
  const { ctx, p } = c
  // The closing stop stays off: on a line of its own it reads as a stray mark.
  const toks = (s.toks || []).filter((tk, i, all) => !(i === all.length - 1 && tk.k === 'punct'))
  const pad = framed ? 46 : bare ? SP[5] : SP[6]
  const inner = w - pad * 2
  const ghost = u => measured(ctx, m => analyserLine(m, p, 0, 0, inner, u, toks))
  const mean = textBlock(c, s.translation, { x: x + pad, w: inner, sizes: small ? [FS.body, FS.sm] : [FS.title, FS.lead, FS.body], align: 'left', maxLines: 4 })
  const head = bare ? 0 : FS.caption * 1.3
  // Its furigana keep 22px at the smallest scale (9.92px at a phone's).
  let u = 3.2
  const least = small ? 2.3 : 2.4
  while (u - 0.1 >= least - 1e-9 && ghost(u) > (maxH - mean.h - head - pad * 3) * 0.6) u = +(u - 0.1).toFixed(2)
  const ah = ghost(u)
  const pu = Math.min(u * 0.92, inner / 300)
  const room = maxH - pad * 2 - ah - SP[6] - head - mean.h - (framed ? 86 + 50 : 0)
  const pts = (s.points || []).slice(0, Math.max(0, Math.min(2, Math.floor((room - SP[6]) / (102 * pu + SP[4])))))
  const ph = pts.length ? SP[6] + pts.length * (102 * pu) + (pts.length - 1) * SP[4] : 0
  const body = ah + SP[6] + head + mean.h + ph
  const h = body + pad * 2 + (framed ? 86 + 50 - pad : 0)
  return {
    h,
    cut: mean.cut,
    draw: y => {
      let at
      if (framed) at = phone(c, x, y, w, h).y
      else { card(c, x, y, w, h); at = y + pad }
      analyserLine(ctx, p, x + pad, at, inner, u, toks)
      at += ah + SP[6]
      if (head) kicker(c, c.W.meaning, x + pad, at, 'left', p.ink2)
      at += head
      mean.draw(at)
      at += mean.h + (pts.length ? SP[6] : 0)
      for (const pt of pts) at += pointCard(ctx, p, x + pad, at, inner, pu, pt) + SP[4]
    },
  }
}
/** The sentence answered: with its furigana, its romaji, what it says. */
function answerBlock(c, s, { x, w, maxH }) {
  let out = none
  let firstFit = null
  // A rung down at a time; a long sentence's romaji gives way last, and a
  // layout that cuts a line is kept only where none fits whole.
  for (let k = 0; k < 4; k++) {
    const z = i => RUNGS[Math.min(RUNGS.length - 1, i + k)]
    const ro = k < 3 ? textBlock(c, s.romaji, { x, w, sizes: [z(4), z(5)], weight: 500, color: c.p.ink2, maxLines: 3 }) : none
    const tr = textBlock(c, `“${s.translation}”`, { x, w, sizes: [z(2), z(3), z(4)], maxLines: 4 })
    const gap = k < 2 ? SP[7] : SP[5]
    const sent = sentenceBlock(c, s.rows, { x, w, maxH: maxH - ro.h - tr.h - gap * 2, max: z(0), min: z(3), script: 'furigana', fewest: true })
    out = stackOf([sent, ro, tr], [SP[5], gap])
    if (out.h > maxH) continue
    if (!ro.cut && !tr.cut) return out
    firstFit ||= out
  }
  return firstFit || out
}
/** A grammar point: its pattern, what it does, its form, a sentence with it. */
function pointBlock(c, s, { x, w, maxH }) {
  const { ctx, p } = c
  const pt = s.point
  const head = glyphBlock(c, pt.pattern, { x, w, maxH: maxH * 0.3, max: FS.word * 0.9 })
  const mean = textBlock(c, pt.meaning, { x, w, sizes: [FS.heading, FS.title, FS.lead], maxLines: 3 })
  // The form on its pill, on one line where it goes, else on two.
  const one = pt.form ? fit(ctx, pt.form, { sizes: [FS.body, FS.sm], maxW: w - SP[7] * 2, maxLines: 1 }) : null
  const fb = one?.cut ? fit(ctx, pt.form, { sizes: [FS.body, FS.sm], maxW: w - SP[7] * 2, maxLines: 2 }) : one
  const formH = fb ? Math.max(FS.body * 2.1, paragraphH(fb) + FS.body) : 0
  const form = fb ? { h: formH, draw: y => {
    const tw = Math.min(w, Math.max(...fb.lines.map(l => measure(ctx, l, fb.f))) + SP[7] * 2)
    ctx.fillStyle = faceInk(p)
    rrect(ctx, x + (w - tw) / 2, y, tw, formH, FS.body * 1.05)
    ctx.fill()
    paragraph(ctx, fb, x + w / 2, y + (formH - paragraphH(fb)) / 2, p.line.grammar, 'center')
  } } : none
  const rest = maxH - head.h - mean.h - form.h - SP[7] * 3
  let ex = s.rows?.length ? exampleCard(c, { rows: s.rows, tr: s.translation }, { x, w, maxH: rest, lit: r => (r.g || []).includes(pt.pattern) || r.lit }) : none
  if (ex.h > rest) ex = none
  return {
    h: head.h + SP[6] + mean.h + (form.h ? SP[6] + form.h : 0) + (ex.h ? SP[7] + ex.h : 0),
    draw: y => {
      let at = y
      head.draw(at); at += head.h + SP[6]
      mean.draw(at); at += mean.h + SP[6]
      if (form.h) { form.draw(at); at += form.h + SP[7] }
      ex.draw(at)
    },
  }
}
/** One sentence on a card: the lit words ruled in gold, its sense under it. */
function exampleCard(c, item, { x, w, maxH, lit = r => r.lit, head }) {
  const pad = SP[6]
  const t = textBlock(c, item.tr, { x: x + pad, w: w - pad * 2, sizes: [FS.body, FS.sm, FS.caption], weight: 500, color: c.p.ink2, maxLines: 3 })
  const hd = head ? textBlock(c, head, { x: x + pad, w: w - pad * 2, sizes: [FS.lead, FS.body], fam: 'serif', color: c.p.line.grammar, align: 'left', maxLines: 1 }) : none
  const s = sentenceBlock(c, item.rows, { x: x + pad, w: w - pad * 2, maxH: Math.max(FS.lead * 2, maxH - t.h - hd.h - pad * 2 - SP[4] * 2), max: FS.title * 1.1, min: FS.sm, script: 'furigana', lit, fam: 'jp', lines: 3 })
  const h = pad * 2 + hd.h + (hd.h ? SP[3] : 0) + s.h + SP[4] + t.h
  return { h, draw: y => { card(c, x, y, w, h); hd.draw(y + pad); s.draw(y + pad + hd.h + (hd.h ? SP[3] : 0)); t.draw(y + pad + hd.h + (hd.h ? SP[3] : 0) + s.h + SP[4]) } }
}
/** A word answered: its reading over it, its romaji, its sense. */
function wordBlock(c, word, { x, w, maxH }) {
  const ro = textBlock(c, word.ro, { x, w, sizes: [FS.lead, FS.body], weight: 500, color: c.p.ink2, maxLines: 1 })
  const mean = textBlock(c, word.main, { x, w, sizes: [FS.display, FS.heading, FS.title], maxLines: 3 })
  const sub = textBlock(c, word.sub, { x, w, sizes: [FS.body, FS.sm], weight: 500, color: c.p.ink2, maxLines: 2 })
  const rows = [{ t: word.t, fu: word.fu, k: 'word', ro: word.ro }]
  const big = sentenceBlock(c, rows, { x, w, maxH: maxH - ro.h - mean.h - sub.h - SP[7] * 3, max: FS.word, min: FS.display * 0.8, script: 'furigana', lit: () => true, lines: 1 })
  return stackOf([big, ro, mean, sub], [SP[5], SP[7], SP[4]])
}
/** A kanji answered: the character, what it means, its readings. */
function kanjiBlock(c, s, { x, w, maxH }) {
  const { ctx, p } = c
  const K = s.kanji
  const mean = textBlock(c, K.meaning, { x, w, sizes: [FS.display, FS.heading, FS.title], maxLines: 2 })
  const chip = (label, list, color) => list.length ? { h: FS.title * 1.9, draw: y => {
    const lf = font(700, FS.caption, 'latin')
    const lw = measure(ctx, label, lf, 0.16) + SP[6]
    const jf = font(700, FS.title, 'jp')
    const widths = list.slice(0, 3).map(r => measure(ctx, r, jf) + SP[6] * 2)
    // As many readings as the width holds, one at least.
    let n = widths.length
    while (n > 1 && lw + widths.slice(0, n).reduce((a, b) => a + b + SP[3], 0) > w) n--
    const items = list.slice(0, n)
    const ws = widths.slice(0, n).map(v => Math.min(v, w - lw))
    const total = lw + ws.reduce((a, b) => a + b + SP[3], 0)
    let at = x + Math.max(0, (w - total) / 2)
    text(ctx, label, at, y + FS.title * 0.95 + FS.caption * 0.36, { f: lf, color: p.ink2, tr: 0.16 })
    at += lw
    items.forEach((r, i) => {
      ctx.fillStyle = mix(color, cardInk(p), 0.14)
      rrect(ctx, at, y, ws[i], FS.title * 1.9, FS.title * 0.95)
      ctx.fill()
      const rb = fit(ctx, r, { fam: 'jp', weight: 700, sizes: [FS.title, FS.lead, FS.body], maxW: ws[i] - SP[5] * 2, maxLines: 1 })
      text(ctx, rb.lines[0], at + ws[i] / 2, y + FS.title * 0.95 + rb.size * 0.36, { f: rb.f, color: p.ink, align: 'center' })
      at += ws[i] + SP[3]
    })
  } } : none
  const on = chip('ON', K.on, p.line.kanji)
  const kun = chip('KUN', K.kun, p.line.vocab)
  const room = maxH - mean.h - on.h - kun.h - SP[7] * 2 - SP[4]
  const size = Math.min(FS.glyph * 1.2, room)
  const g = { h: size, draw: y => {
    if (s.strokes?.k?.s) {
      strokeBoxAll(ctx, s.strokes.k, x + (w - size) / 2, y, size, p.ink, c.line)
    } else text(ctx, K.c, x + w / 2, y + size * ASC, { f: font(700, size, 'serif'), color: p.ink, align: 'center' })
  } }
  return stackOf([g, mean, on, kun], [SP[7], SP[7], SP[4]])
}
/** Every stroke of a character, the last in the line's ink, numbered at its start. */
function strokeBoxAll(ctx, k, x, y, size, ink, last) {
  const n = k.s.d.length
  ctx.save()
  ctx.translate(x, y)
  ctx.scale(size / 109, size / 109)
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.lineWidth = 6.5
  k.s.d.forEach((d, i) => {
    ctx.strokeStyle = i === n - 1 ? last : ink
    ctx.stroke(new Path2D(d))
  })
  ctx.restore()
}
/** A kana answered: the kana, its sound, its twin in the other script. */
function kanaBlock(c, s, { x, w, maxH }) {
  const { ctx, p } = c
  const K = s.kana
  const ro = { h: FS.word * 0.8, draw: y => text(ctx, K.ro, x + w / 2, y + FS.word * 0.62, { f: font(700, FS.word * 0.62, 'latin'), color: c.line, align: 'center' }) }
  const twin = K.twin ? textBlock(c, `${K.k} · ${K.twin}`, { x, w, sizes: [FS.heading], fam: 'jp', color: p.ink2, maxLines: 1 }) : none
  const g = glyphBlock(c, K.k, { x, w, maxH: maxH - ro.h - twin.h - SP[7] * 2, rule: false })
  return stackOf([g, ro, twin], [SP[5], SP[7]])
}
function stackOf(blocks, gaps) {
  const list = blocks.map((b, i) => ({ b, gap: i ? gaps[i - 1] ?? gaps.at(-1) : 0 })).filter(x => x.b.h > 0)
  const h = list.reduce((a, x, i) => a + x.b.h + (i ? x.gap : 0), 0)
  return { h, draw: y => { let at = y; list.forEach((x, i) => { if (i) at += x.gap; x.b.draw(at); at += x.b.h }) } }
}

// ── The detail ────────────────────────────────────────────────
// ── A sentence word by word (plan 234d) ───────────────────────
/** A gloss's first sense, its brackets left off: what a word says in a
 *  breakdown set under it. */
function firstSense(str) {
  const first = (sensesOf(str)[0] || '').replace(/\s*[([（][^)\]）]*[)\]）]/g, '').trim()
  return first || String(str || '').trim()
}
// What a word slide's head takes over the frame's top: the mark or the
// band, and the kicker under it.
const HEAD_H = 56 + SP[7] + FS.caption * 1.3 + SP[6]
const wide = ch => /[\u3000-\u9fff\uff00-\uffef]/.test(ch)
/** How tall a run of words sets at the body rung, guessed from its
 *  characters, where there is no canvas to measure it on (the tests). */
function glossGuess(items, rows, maxW) {
  const z = FS.body
  const gz = Math.max(FS.xs, z * 0.5)
  const rs = Math.max(z * 0.4, FS.caption)
  const cells = items.map(it => {
    // A pattern's pieces read as one word (ので, とは限らない), its ruby theirs.
    const row = (it.j ?? it.i) > it.i ? { t: it.t, fu: it.fu } : rows[it.i] || {}
    const ruby = (row.fu || []).filter(([, r]) => r).reduce((a, [, r]) => a + [...r].length * rs, 0)
    const ww = Math.max([...it.t].reduce((a, ch) => a + (wide(ch) ? z : z * 0.6), 0), ruby)
    const rw = (it.ro || '').length * gz * 0.58
    const gl = (it.gloss || '').length * gz * 0.58
    const gmax = Math.max(ww, rw, gz * 6)
    const lines = Math.min(3, Math.max(1, Math.ceil(gl / gmax)))
    return { w: Math.max(ww, rw, Math.min(gl, gmax)), h: (ruby ? rs * 1.3 : 0) + z * 1.1 + SP[3] * 2 + EDGE + gz * 1.25 + lines * gz * 1.18 }
  })
  const lines = [[]]
  let lw = 0
  for (const cl of cells) {
    if (lines.at(-1).length && lw + SP[5] + cl.w > maxW) { lines.push([]); lw = 0 }
    lw += (lines.at(-1).length ? SP[5] : 0) + cl.w
    lines.at(-1).push(cl)
  }
  return lines.reduce((a, ln) => a + Math.max(...ln.map(cl => cl.h)) + SP[6], -SP[6])
}
/** Where `n` words cut into `k` runs as even as the phrases allow: before
 *  a word, never before a particle or an ending (`starts`). */
function cutsOf(n, starts, k) {
  const cuts = []
  for (let j = 1; j < k; j++) {
    const left = starts.filter(x => x > (cuts.at(-1) ?? 0))
    if (!left.length) return null
    cuts.push(left.reduce((a, x) => (Math.abs(x - (j * n) / k) < Math.abs(a - (j * n) / k) ? x : a), left[0]))
  }
  return cuts
}
/** The largest rung a run of words sets whole at (0 where none does):
 *  measured as it is drawn, in a browser, the fonts loaded before a deck
 *  is dealt; guessed from its characters elsewhere. */
function glossRung(items, rows, fr, room) {
  if (typeof document === 'undefined') return glossGuess(items, rows, fr.w) <= room ? FS.body : 0
  const b = glossBlock({ ctx: SCRATCH ||= document.createElement('canvas').getContext('2d'), p: palette('paper') }, { items, rows }, { x: 0, w: fr.w, maxH: room })
  return b.h <= room && !b.cut ? b.z : 0
}
/** A sentence's breakdown, every word of it, on as many slides as it
 *  takes: one where it sets at the body rung, else the fewest at the sm
 *  rung or larger, every slide at the size the most crowded one takes. */
function glossPages(pl, fmt) {
  const f = pl.funnel || {}
  const rows = f.rows || []
  const items = (f.breakdown || []).map(it => ({ ...it, gloss: firstSense(it.main) }))
  if (!items.length) return []
  const fr = frame(fmt)
  const room = fr.h - HEAD_H
  const starts = items.map((_, k) => k).filter(k => k && rows[items[k].i]?.k === 'word')
  let chunks = [items]
  let z = 0
  for (let k = 1; k <= 4; k++) {
    const cuts = cutsOf(items.length, starts, k)
    if (!cuts) break
    chunks = [0, ...cuts].map((at, j) => items.slice(at, j < cuts.length ? cuts[j] : items.length))
    z = Math.min(...chunks.map(ch => glossRung(ch, rows, fr, room)))
    if (z >= (k === 1 ? FS.body : FS.sm)) break
  }
  return chunks.map((ch, j) => ({ kind: 'gloss', items: ch, rows, page: j + 1, pages: chunks.length, label: 'words', z: z || null }))
}
/** The sentence cut into its words, as a gloss is printed: each word
 *  with its furigana, ruled in its line's colour, its romaji and what it
 *  says under it; the lines as even as the words allow. */
function glossBlock(c, s, { x, w, maxH }) {
  const { ctx, p } = c
  const inkOf = it => (it.line === 'grammar' ? p.line.grammar : p.line.vocab)
  const gap = SP[5]
  const layAt = z => {
    const gz = Math.max(FS.xs, z * 0.5)
    const cells = s.items.map(it => {
      // A pattern's pieces read as one word (ので, plan 234e).
      const row = (it.j ?? it.i) > it.i ? { t: it.t, k: 'word', ro: it.ro, fu: it.fu } : s.rows[it.i] || { t: it.t, k: 'word' }
      const L = layoutSentence(ctx, [row], { max: z, min: z, maxW: w, maxLines: 1, script: 'furigana', romaji: false, rules: false, under: 0.1, gap: 0, fam: 'jp', weight: 700 })
      const ww = L ? L.lineW(L.lines[0]) : measure(ctx, it.t, font(700, z, 'jp'))
      const rw = measure(ctx, it.ro || '', font(500, gz, 'latin'))
      // A long gloss widens its column before it takes a fourth line, or is
      // cut; never narrower than its longest word, which is never broken.
      const gf = font(700, gz, 'latin')
      const longest = Math.max(0, ...String(it.gloss || '').split(/\s+/).map(wd => measure(ctx, wd, gf)))
      let g = null
      for (const [span, lines] of [[6, 3], [9, 3], [12, 3], [12, 4]]) {
        g = fit(ctx, it.gloss || '', { weight: 700, sizes: [gz], maxW: Math.min(w, Math.max(ww, rw, longest, gz * span)), maxLines: lines })
        if (!g.cut) break
      }
      const cw = Math.max(ww, rw, ...g.lines.map(l => measure(ctx, l, g.f)))
      return { it, L, cw, g }
    })
    const pack = limit => {
      const lines = [[]]
      let lw = 0
      for (const cl of cells) {
        if (lines.at(-1).length && lw + gap + cl.cw > limit) { lines.push([]); lw = 0 }
        lw += (lines.at(-1).length ? gap : 0) + cl.cw
        lines.at(-1).push(cl)
      }
      return lines
    }
    // The narrowest measure that keeps as few lines: no word left alone on the last.
    let lines = pack(w)
    let lo = w * 0.4, hi = w
    for (let k = 0; k < 14; k++) {
      const mid = (lo + hi) / 2
      if (pack(mid).length > lines.length) lo = mid
      else hi = mid
    }
    lines = pack(hi)
    const wordH = ln => Math.max(...ln.map(cl => (cl.L ? cl.L.h : z)))
    const lineH = ln => wordH(ln) + SP[3] * 2 + EDGE + gz * 1.25 + Math.max(...ln.map(cl => paragraphH(cl.g)))
    const h = lines.reduce((a, ln) => a + lineH(ln) + SP[6], -SP[6])
    return { z, gz, lines, wordH, lineH, h, cut: cells.some(cl => cl.g.cut) }
  }
  let lay = null
  let firstFit = null
  // A breakdown over several slides is set at one size on all of them.
  for (const z of [FS.heading, FS.title, FS.lead, FS.body, FS.sm].filter(r => !s.z || r <= s.z)) {
    lay = layAt(z)
    if (lay.h > maxH) continue
    if (!lay.cut) break
    firstFit ||= lay
  }
  if (firstFit && (lay.h > maxH || lay.cut)) lay = firstFit
  return {
    h: lay.h,
    z: lay.z,
    cut: lay.cut,
    draw: y => {
      let at = y
      for (const ln of lay.lines) {
        const lw = ln.reduce((a, cl, i) => a + cl.cw + (i ? gap : 0), 0)
        let cx0 = x + (w - lw) / 2
        const wh = lay.wordH(ln)
        for (const cl of ln) {
          const ink = inkOf(cl.it)
          const mid = cx0 + cl.cw / 2
          if (cl.L) drawSentence(ctx, cl.L, mid, at + wh - cl.L.h, 'center', () => ({ ink: p.ink, ruby: p.ink2 }))
          else text(ctx, cl.it.t, mid, at + wh - lay.z * 0.2, { f: font(700, lay.z, 'jp'), color: p.ink, align: 'center' })
          let yy = at + wh + SP[3]
          ctx.fillStyle = ink
          rrect(ctx, cx0, yy, cl.cw, EDGE, EDGE / 2)
          ctx.fill()
          yy += EDGE + SP[3]
          text(ctx, cl.it.ro || '', mid, yy + lay.gz * 0.85, { f: font(500, lay.gz, 'latin'), color: p.ink2, align: 'center' })
          yy += lay.gz * 1.25
          paragraph(ctx, cl.g, mid, yy, ink, 'center')
          cx0 += cl.cw + gap
        }
        at += lay.lineH(ln) + SP[6]
      }
    },
  }
}

/** Words one by one: each in its line's pill, its sense and its reading. */
function rowsBlock(c, items, { x, w, maxH }) {
  if (!items.length) return none
  return fitting(Math.min(8, items.length), maxH, k => rowsOf(c, items.slice(0, k), { x, w, maxH }))
}
function rowsOf(c, list, { x, w, maxH }) {
  const { ctx, p } = c
  const gap = SP[4]
  let lay = null
  let firstFit = null
  for (const z of [FS.title, FS.lead, FS.body, FS.sm]) {
    const jf = font(700, z, 'jp')
    const pw = Math.min(w * 0.42, Math.max(z * 2.4, ...list.map(it => measure(ctx, it.t, jf) + z * 1.2)))
    const tw = w - pw - SP[6]
    const rows = list.map(it => {
      const sub = [it.reading && it.reading !== it.t ? it.reading : '', it.ro, it.sub].filter(Boolean).join(' · ')
      const m = glossFit(ctx, it.main || '', { sizes: [z * 0.9], maxW: tw, maxLines: 2, balanced: false })
      const sz = Math.max(FS.caption * 0.9, z * 0.62)
      const sb1 = sub ? fit(ctx, sub, { weight: 500, sizes: [sz], maxW: tw, maxLines: 1, balanced: false }) : null
      // A reading too long for its line takes a second before it is cut.
      const sb = sb1?.cut ? fit(ctx, sub, { weight: 500, sizes: [sz], maxW: tw, maxLines: 2, balanced: false }) : sb1
      const h = Math.max(z * 1.75, paragraphH(m) + (sb ? paragraphH(sb) + SP[1] : 0))
      return { it, m, sb, h }
    })
    const total = rows.reduce((a, r) => a + r.h, 0) + gap * (rows.length - 1)
    const cut = rows.some(r => r.m.cut || r.sb?.cut)
    lay = { z, jf, pw, rows, total, cut }
    if (total <= maxH && !cut) break
    if (total <= maxH) firstFit ||= lay
  }
  if (firstFit && (lay.total > maxH || lay.cut)) lay = firstFit
  return {
    h: lay.total,
    draw: y => {
      let at = y
      for (const r of lay.rows) {
        const ph = lay.z * 1.75
        const py = at + (r.h - ph) / 2
        ctx.fillStyle = p.line[r.it.line] || c.line
        rrect(ctx, x, py, lay.pw, ph, ph / 2)
        ctx.fill()
        const tb = fit(ctx, r.it.t, { weight: 700, fam: 'jp', sizes: [lay.z, lay.z * 0.85, lay.z * 0.7], maxW: lay.pw - lay.z * 0.6, maxLines: 1 })
        text(ctx, tb.lines[0], x + lay.pw / 2, py + ph / 2 + tb.size * 0.36, { f: tb.f, color: p.onLine, align: 'center' })
        const tx = x + lay.pw + SP[6]
        const mh = paragraphH(r.m) + (r.sb ? paragraphH(r.sb) + SP[1] : 0)
        let ty = at + (r.h - mh) / 2
        ty += paragraph(ctx, r.m, tx, ty, p.ink, 'left')
        if (r.sb) paragraph(ctx, r.sb, tx, ty + SP[1], p.ink2, 'left')
        at += r.h + gap
      }
    },
  }
}
/** A few sentences, a card each. */
function examplesBlock(c, items, { x, w, maxH }) {
  const gap = SP[5]
  return fitting(Math.min(3, items.length), maxH, k => {
    const per = (maxH - gap * (k - 1)) / k
    return stackOf(items.slice(0, k).map(it => exampleCard(c, it, { x, w, maxH: per, head: it.head, lit: r => r.lit })), [gap])
  })
}
/** A list of sentences, one under the other without cards: as many as fit. */
function sentencesBlock(c, items, { x, w, maxH }) {
  const { ctx, p } = c
  const gap = SP[5]
  return fitting(Math.min(5, items.length), maxH, k => {
    const per = (maxH - gap * (k - 1)) / k
    const blocks = items.slice(0, k).map((it, i) => {
      const t = textBlock(c, it.tr, { x: x + 64, w: w - 64, sizes: [FS.body, FS.sm, FS.caption], weight: 500, color: p.ink2, align: 'left', maxLines: 2 })
      const sb = sentenceBlock(c, it.rows, { x: x + 64, w: w - 64, maxH: per - t.h - SP[3], max: FS.title, min: FS.body, script: 'furigana', lit: r => r.lit, fam: 'jp', align: 'left', lines: 2 })
      return { h: sb.h + SP[3] + t.h, draw: y => {
        ctx.fillStyle = c.line
        ctx.beginPath()
        ctx.arc(x + 22, y + sb.h / 2, 22, 0, Math.PI * 2)
        ctx.fill()
        text(ctx, String(i + 1), x + 22, y + sb.h / 2 + FS.sm * 0.36, { f: font(700, FS.sm, 'latin'), color: p.onLine, align: 'center' })
        sb.draw(y)
        t.draw(y + sb.h + SP[3])
      } }
    })
    return stackOf(blocks, [gap])
  })
}
/** Two points side by side: each its pattern, what it does, its form. */
const RUNGS = [FS.display, FS.heading, FS.title, FS.lead, FS.body, FS.sm, FS.caption]
function sidesBlock(c, sides, { x, w, maxH }) {
  let out = none
  // Every text a rung down at a time, until the cards fit.
  for (let k = 0; k < 4; k++) {
    const pad = k < 2 ? SP[6] : SP[5]
    const z = i => RUNGS[Math.min(RUNGS.length - 1, i + k)]
    const cards = sides.slice(0, 3).map(sd => {
      const head = textBlock(c, sd.head, { x: x + pad, w: w - pad * 2, sizes: [z(0), z(1), z(2)], fam: 'serif', align: 'left', maxLines: 2, color: c.p.ink })
      const mean = textBlock(c, sd.meaning, { x: x + pad, w: w - pad * 2, sizes: [z(2), z(3), z(4)], align: 'left', maxLines: 3 })
      const form = textBlock(c, sd.form || sd.sub, { x: x + pad, w: w - pad * 2, sizes: [z(4), z(5)], weight: 500, color: c.p.ink2, align: 'left', maxLines: 2 })
      const inner = stackOf([head, mean, form], [SP[4], SP[3]])
      const h = inner.h + pad * 2
      return { h, draw: y => { card(c, x, y, w, h); c.ctx.fillStyle = c.p.line[sd.line] || c.line; c.ctx.fillRect(x, y + SP[6], 8, h - SP[6] * 2); inner.draw(y + pad) } }
    })
    out = stackOf(cards, [SP[6]])
    if (out.h <= maxH) return out
  }
  return out
}
/** A whole scene, bubble after bubble. */
function chatBlock(c, lines, { x, w, maxH, them }) {
  const gap = SP[6]
  return fitting(Math.min(4, lines.length), maxH, k => {
    const per = (maxH - gap * (k - 1)) / k
    return stackOf(lines.slice(0, k).map(l => bubbleBlock(c, l, { x, w, maxH: per, who: l.who === 'me' ? c.W.you : them, me: l.who === 'me', tr: true })), [gap])
  })
}
/** A turn of a conversation: their line, then the three replies, or the right one. */
function turnBlock(c, s, { x, w, maxH }) {
  const turn = s.turn
  const gap = SP[7]
  if (!s.revealed) {
    const q = { choices: turn.choices.map(rows => ({ rows })), right: turn.right }
    // The replies at the largest rung that leaves their line its bubble.
    let out = none
    for (const z of [FS.title, FS.lead, FS.body, FS.sm, FS.caption]) {
      const ch = choicesBlock(c, q, { x, w, sizes: [z] })
      const them = bubbleBlock(c, turn.them, { x, w, maxH: maxH - ch.h - gap, who: s.them, romaji: s.romaji })
      out = stackOf([them, ch], [gap])
      if (out.h <= maxH) break
    }
    return out
  }
  const why = textBlock(c, turn.why, { x, w, sizes: [FS.body, FS.sm, FS.caption], weight: 500, color: c.p.ink2, align: 'left', maxLines: 4 })
  const room = maxH - why.h - gap * 2
  const mine = bubbleBlock(c, { rows: turn.choices[turn.right], tr: turn.reply }, { x, w, maxH: room * 0.45, who: c.W.you, me: true, romaji: s.romaji })
  const them = bubbleBlock(c, turn.them, { x, w, maxH: room - mine.h, who: s.them, romaji: s.romaji })
  const all = stackOf([them, mine, why], [gap, gap])
  return all.h <= maxH ? all : stackOf([them, mine], [gap])
}
/** Pictures in a grid; answered, each with its word, the odd one ringed. */
function picturesBlock(c, s, { x, w, maxH }) {
  const { ctx, p } = c
  const words = s.words.slice(0, 9)
  const n = words.length
  const gap = SP[4]
  const why = s.reveal && s.why ? textBlock(c, s.why, { x, w, sizes: [FS.body, FS.sm], weight: 500, color: p.ink2, maxLines: 3 }) : none
  const room = maxH - (why.h ? why.h + SP[6] : 0)
  const cellOf = k => Math.min((w - gap * (k - 1)) / k, (room - gap * (Math.ceil(n / k) - 1)) / Math.ceil(n / k))
  const cols = [2, 3, 4].filter(k => k <= Math.max(2, n)).reduce((a, k) => (cellOf(k) > cellOf(a) ? k : a), 2)
  const rowsN = Math.ceil(n / cols)
  const cell = cellOf(cols)
  // Named, a tile widens into the room the frame leaves beside it (the
  // 9:16 frame's height sets a tile before its width does): its word and
  // gloss are read across it.
  const tw = s.reveal ? Math.min((w - gap * (cols - 1)) / cols, cell * 1.5) : cell
  // Each gloss on one line where it goes, else on two, a size down; the
  // tiles' pictures make room for the longest.
  const glossOf = wd => {
    const one = glossFit(ctx, wd.main, { weight: 500, sizes: [FS.sm, FS.caption, FS.xs], maxW: tw - SP[4], maxLines: 1 })
    return one.cut ? glossFit(ctx, wd.main, { weight: 500, sizes: [FS.caption, FS.xs], maxW: tw - SP[4], maxLines: 2, balanced: false }) : one
  }
  const glosses = s.reveal ? words.map(glossOf) : []
  const label = s.reveal ? FS.lead * 1.25 + Math.max(FS.sm * 1.3, ...glosses.map(b => paragraphH(b))) + SP[3] : 0
  const h = rowsN * cell + (rowsN - 1) * gap
  return {
    h: h + (why.h ? SP[6] + why.h : 0),
    draw: y => {
      words.forEach((wd, i) => {
        const col = i % cols
        const row = Math.floor(i / cols)
        const inRow = Math.min(cols, n - row * cols)
        const cx0 = x + (w - (inRow * tw + (inRow - 1) * gap)) / 2 + col * (tw + gap)
        const cy0 = y + row * (cell + gap)
        const odd = s.odd === i
        card(c, cx0, cy0, tw, cell, R.card * 1.6)
        if (s.reveal && s.odd != null) {
          ctx.strokeStyle = odd ? p.stamp : alpha(success(p), 0.7)
          ctx.lineWidth = odd ? 8 : 3
          rrect(ctx, cx0 + 4, cy0 + 4, tw - 8, cell - 8, R.card * 1.4)
          ctx.stroke()
        }
        const es = (cell - label) * 0.62
        if (wd.e) emojiAt(ctx, wd.e, cx0 + tw / 2, cy0 + (cell - label) / 2 + SP[2], es)
        else if (!s.reveal) {
          // No picture for it: the word itself, as large as the tile holds.
          const wb = fit(ctx, wd.t, { fam: 'jp', weight: 700, sizes: [FS.display, FS.heading, FS.title, FS.lead, FS.body], maxW: cell - SP[5] * 2, maxLines: 2 })
          paragraph(ctx, wb, cx0 + cell / 2, cy0 + (cell - paragraphH(wb)) / 2, odd && s.reveal ? p.stamp : p.ink, 'center')
        }
        if (s.reveal) {
          const jb = fit(ctx, wd.t, { fam: 'jp', weight: 700, sizes: [FS.lead, FS.body, FS.sm, FS.caption], maxW: tw - SP[4], maxLines: 1 })
          text(ctx, jb.lines[0], cx0 + tw / 2, cy0 + cell - label + jb.size, { f: jb.f, color: odd ? p.stamp : p.ink, align: 'center' })
          paragraph(ctx, glosses[i], cx0 + tw / 2, cy0 + cell - label + FS.lead * 1.25 + glosses[i].size * 0.2, p.ink2, 'center')
        }
      })
      why.draw(y + h + SP[6])
    },
  }
}
/** Kanji alike, side by side, as large as they fit, each ruled. */
function charsBlock(c, chars, { x, w, maxH }) {
  const { ctx, p } = c
  const n = chars.length
  const gap = SP[6]
  const size = Math.min(FS.glyph, (w - gap * (n - 1)) / n, maxH * 0.8)
  return {
    h: size * 1.05 + SP[5] + 10,
    draw: y => {
      const total = n * size + (n - 1) * gap
      chars.forEach((ch, i) => {
        const at = x + (w - total) / 2 + i * (size + gap)
        text(ctx, ch, at + size / 2, y + size * ASC, { f: font(700, size, 'serif'), color: p.ink, align: 'center' })
        ctx.fillStyle = p.line.kanji
        rrect(ctx, at + size * 0.2, y + size * 1.05 + SP[3], size * 0.6, 10, 5)
        ctx.fill()
      })
    },
  }
}
/** Kanji alike, told apart: each with its meaning, its note and a word. */
function apartBlock(c, chars, { x, w, maxH }) {
  const items = chars.slice(0, 5).map(k => ({ t: k.c, main: k.meaning, sub: k.word ? `${k.word.t} ${k.word.r} · ${k.word.main}` : k.note, line: 'kanji' }))
  return rowsBlock(c, items, { x, w, maxH })
}
/** Kana alike: each large, its sound under it, the one asked in its line's ink. */
function kanasBlock(c, s, { x, w, maxH }) {
  const { ctx, p } = c
  const list = s.items.slice(0, 4)
  const gap = SP[6]
  const size = Math.min(FS.glyph * 0.8, (w - gap * (list.length - 1)) / list.length, maxH * 0.6)
  return {
    h: size * 1.05 + FS.title * 1.6,
    draw: y => {
      const total = list.length * size + (list.length - 1) * gap
      list.forEach((it, i) => {
        const at = x + (w - total) / 2 + i * (size + gap)
        const here = it.k === s.here
        card(c, at, y, size, size, R.card * 1.6, here ? mix(c.line, cardInk(p), 0.14) : cardInk(p))
        text(ctx, it.k, at + size / 2, y + size * 0.5 + size * 0.62 * 0.36, { f: font(700, size * 0.62, 'jp'), color: p.ink, align: 'center' })
        text(ctx, it.ro, at + size / 2, y + size + FS.title * 1.2, { f: font(700, FS.title, 'latin'), color: here ? c.line : p.ink2, align: 'center' })
      })
    },
  }
}
/** A trap's two sentences, the notion over them. */
function pairBlock(c, s, { x, w }) {
  const head = textBlock(c, s.notion, { x, w, sizes: [FS.title, FS.lead], maxLines: 3 })
  const cards = s.pair.slice(0, 2).map((jp, i) => {
    const b = fit(c.ctx, jp, { fam: 'serif', weight: 700, sizes: [FS.display * 0.8, FS.heading, FS.title, FS.lead], maxW: w - SP[7] * 2 - 70, maxLines: 2 })
    const h = paragraphH(b) + SP[7] * 2
    return { h, draw: y => {
      card(c, x, y, w, h)
      text(c.ctx, String(i + 1), x + SP[7], y + h / 2 + FS.lead * 0.36, { f: font(700, FS.lead, 'latin'), color: c.line })
      paragraph(c.ctx, b, x + SP[7] + 70, y + SP[7], c.p.ink, 'left')
    } }
  })
  return stackOf([head, ...cards], [SP[7], SP[5]])
}
/** A passage to read, as large as it fits. */
/** A text, and under it the question asked of it: its choices too where
 *  the text keeps a size that reads, else the question alone; the
 *  choices come with the answer. */
function passageBlock(c, s, box) {
  if (!s.q) return passageOnce(c, s, box)
  const { x, w, maxH } = box
  const ask = textBlock(c, s.q.ask, { x, w, sizes: [FS.lead, FS.body], align: 'left', maxLines: 3 })
  const choices = choicesBlock(c, s.q, { x, w, sizes: [FS.body, FS.sm] })
  const both = stackOf([ask, choices], [SP[5]])
  // The whole text before anything else: the choices give way, then the
  // title's size, then the text's; only past all of them is it cut.
  const lean = textBlock(c, s.q.ask, { x, w, sizes: [FS.body, FS.sm], align: 'left', maxLines: 3 })
  const tries = [
    [both, FS.sm, [FS.heading, FS.title]], [ask, FS.sm, [FS.heading, FS.title]], [ask, FS.caption, [FS.heading, FS.title]],
    [ask, FS.caption, [FS.title]], [lean, FS.caption, [FS.title], true], [lean, FS.xs, [FS.title], true],
  ]
  for (const [asked, least, heads, tight] of tries) {
    const text = passageOnce(c, s, { x, w, maxH: maxH - asked.h - SP[6], least, heads, tight })
    if (!text.cut) return stackOf([text, asked], [SP[6]])
  }
  return stackOf([passageOnce(c, s, { x, w, maxH: maxH - lean.h - SP[6], least: FS.xs, heads: [FS.title], tight: true }), lean], [SP[6]])
}
function passageOnce(c, s, { x, w, maxH, least = FS.caption, heads = [FS.heading, FS.title], tight = false }) {
  const { ctx, p } = c
  // Tight: the card's margin and the space between sentences give way.
  const pad = tight ? SP[5] : SP[7]
  const sep = tight ? SP[1] : SP[3]
  const title = textBlock(c, s.title, { x, w, sizes: heads, fam: 'serif', maxLines: 2 })
  const room = maxH - title.h - SP[6] - pad * 2
  let lays = null
  for (const z of [FS.title, FS.lead, FS.body, FS.sm, FS.caption, FS.xs].filter(z => z >= least)) {
    lays = s.sents.map(rows => layoutSentence(ctx, rows, { max: z, min: z, maxW: w - pad * 2, maxLines: 20, script: c.pl.script, rules: false, gap: 0.02, fam: 'jp', weight: 500 }))
    if (lays.reduce((a, L) => a + (L?.h || 0) + sep, 0) <= room) break
  }
  // A passage longer than the slide at the caption rung is cut at a
  // sentence: the answer's slide quotes what the question asks of.
  let used = 0
  const all = lays.length
  lays = lays.filter(L => (used += (L?.h || 0) + sep) <= room + sep)
  const body = lays.reduce((a, L) => a + (L?.h || 0) + sep, -sep)
  const h = title.h + SP[6] + body + pad * 2
  return {
    h, cut: lays.length < all,
    draw: y => {
      title.draw(y)
      const cy = y + title.h + SP[6]
      card(c, x, cy, w, body + pad * 2)
      let at = cy + pad
      for (const L of lays) {
        if (!L) continue
        drawSentence(ctx, L, x + pad, at, 'left', () => ({ ink: p.ink, ruby: p.ink2 }))
        at += L.h + sep
      }
    },
  }
}
/** A list's head: what it is about, large, and its title. */
function titleBlock(c, s, { x, w, maxH }) {
  const t = textBlock(c, s.title, { x, w, sizes: [FS.heading, FS.title], maxLines: 3 })
  const g = glyphBlock(c, s.head, { x, w, maxH: maxH - t.h - SP[7] })
  return stackOf([g, t], [SP[7]])
}
/** Two things a learner mixes up: one, “or”, the other. */
function pairHeadsBlock(c, s, { x, w, maxH }) {
  const { ctx, p } = c
  const orF = font(700, FS.title, 'latin')
  let size = FS.word * 0.9
  const widthOf = z => s.heads.reduce((a, hd) => a + measure(ctx, hd, font(700, z, 'serif')), 0) + measure(ctx, ` ${c.W.or} `, orF)
  while (size > FS.display * 0.8 && widthOf(size) > w) size -= 4
  if (widthOf(size) <= w) {
    return {
      h: size * 1.2 + 14,
      draw: y => {
        let at = x + (w - widthOf(size)) / 2
        s.heads.forEach((hd, i) => {
          if (i) at += text(ctx, ` ${c.W.or} `, at, y + size * 0.62, { f: orF, color: p.ink2 })
          const tw = text(ctx, hd, at, y + size * ASC, { f: font(700, size, 'serif'), color: p.ink })
          ctx.fillStyle = p.line[s.line] || c.line
          rrect(ctx, at, y + size * 1.1, tw, 12, 6)
          ctx.fill()
          at += tw
        })
      },
    }
  }
  const blocks = s.heads.map(hd => glyphBlock(c, hd, { x, w, maxH: (maxH - FS.title * 2) / 2, max: FS.display * 1.2 }))
  const or = textBlock(c, c.W.or, { x, w, sizes: [FS.title], color: p.ink2 })
  return stackOf([blocks[0], or, blocks[1]], [SP[4]])
}

/** The item, drawn as its spec says, in the box given. */
function content(c, s, box) {
  switch (s.kind) {
    case 'sentence': return sentenceBlock(c, s.rows, { ...box, romaji: c.pl.showRomaji, min: FS.lead, lines: 4 })
    case 'glyph': return glyphBlock(c, s.text, box)
    case 'quote': return quoteBlock(c, s.text, box)
    case 'pattern': {
      const g = glyphBlock(c, s.pattern, { ...box, maxH: box.maxH * 0.5, max: FS.word })
      const ex = s.rows?.length ? sentenceBlock(c, s.rows, { ...box, maxH: box.maxH - g.h - SP[8], max: FS.title * 1.2, min: FS.body, lit: r => (r.g || []).includes(s.pattern) || r.lit, fam: 'jp' }) : none
      return stackOf([g, ex], [SP[8]])
    }
    // Answered, a question is never asked again: its solution alone.
    case 'question': return s.revealed ? solutionBlock(c, s.q, box) : questionBlock(c, s.q, box)
    case 'pair': return pairHeadsBlock(c, s, box)
    case 'pairs': return pairBlock(c, s, box)
    case 'chars': return charsBlock(c, s.chars, box)
    case 'pictures': return picturesBlock(c, s, box)
    case 'turn': return turnBlock(c, s, box)
    case 'bubble': return bubbleBlock(c, s.line, { ...box, who: s.line.who === 'me' ? c.W.you : s.them, me: s.line.who === 'me' })
    case 'passage': return passageBlock(c, s, box)
    case 'title': return titleBlock(c, s, box)
    case 'analyser': return analyserBlock(c, s, { ...box, framed: c.design === 'clarte' })
    case 'answer': return answerBlock(c, s, box)
    case 'point': return pointBlock(c, s, box)
    case 'word': return wordBlock(c, s.word, box)
    case 'kanji': return kanjiBlock(c, s, box)
    case 'kana': return kanaBlock(c, s, box)
    case 'rows': return rowsBlock(c, s.items, box)
    case 'gloss': return glossBlock(c, s, box)
    case 'examples': return examplesBlock(c, s.items, box)
    case 'sentences': return sentencesBlock(c, s.items, box)
    case 'sides': return sidesBlock(c, s.sides, box)
    case 'chat': return chatBlock(c, s.lines, { ...box, them: s.them })
    case 'apart': return apartBlock(c, s.chars, box)
    case 'kanas': return kanasBlock(c, s, box)
    default: return none
  }
}
// What reads best centred: the item alone; a list or a question reads from the left.
const CENTRED = new Set(['sentence', 'glyph', 'quote', 'pattern', 'pair', 'chars', 'pictures', 'title', 'word', 'kanji', 'kana', 'answer', 'point', 'kanas'])

// ── The slides ────────────────────────────────────────────────
/** The hook: the item and the question it asks, the way on to the answer.
 *  Its heading is large where the item leaves it room, and steps down to
 *  a line where the item needs the room (a question and its answers, a
 *  long sentence): the item is never set smaller to keep the heading. */
function hookSlide(c, s) {
  const { W } = c
  const ask = weld(c.lang, W.ask[s.ask] || W.ask.read)
  const secs = W.seconds[s.ask === 'say' ? 'say' : s.ask === 'read' ? 'read' : 'answer']
  const centred = CENTRED.has(s.kind)
  const layouts = [false, true].map(compact => hookLayout(c, s, { ask, secs, compact: compact || !centred, centred }))
  // The compact head before a text is cut.
  const L = layouts.find(l => l.b.h <= l.room && !l.b.cut) || layouts.find(l => l.b.h <= l.room) || layouts[1]
  L.draw()
}
function hookLayout(c, s, { ask, secs, compact, centred }) {
  const { ctx, p, fr, W } = c
  if (c.design === 'defi') {
    const top = fr.y + 56 + SP[7]
    const nz = compact ? FS.heading : tall(c) ? FS.glyph : FS.word
    const kh = FS.caption * 1.08 * 1.2
    const q = compact ? none : textBlock(c, ask, { x: fr.x, w: fr.w, sizes: [FS.lead, FS.body], weight: 500, color: p.ink2, maxLines: 2 })
    const y = top + nz * 0.95 + kh + SP[3] + q.h + (compact ? SP[5] : SP[7])
    const foot = FS.body * 1.6
    const bottom = fr.bottom - foot - SP[6]
    // The item on a card; a question with its answers on the ground, whole.
    const pad = centred ? SP[6] : 0
    const room = bottom - y - pad * 2
    const b = content(c, s, { x: fr.x + pad, w: fr.w - pad * 2, maxH: room })
    return {
      b, room,
      draw() {
        chrome(c)
        text(ctx, String(s.seconds || 5), fr.cx, top + nz * 0.8, { f: font(900, nz, 'serif'), color: p.gold, align: 'center' })
        kicker(c, `${secs}`, fr.cx, top + nz * 0.95, 'center', p.ink)
        q.draw(top + nz * 0.95 + kh + SP[3])
        const ch = Math.min(bottom - y, b.h + pad * 2)
        const cy = y + (bottom - y - ch) / 2
        if (centred) card(c, fr.x - reach(c), cy, fr.w + reach(c) * 2, ch)
        place(c, b, cy + pad, cy + ch - pad)
        text(ctx, weld(c.lang, W.count(s.seconds || 5)), fr.cx, fr.bottom - FS.body * 0.4, { f: font(500, FS.body, 'latin'), color: p.ink2, align: 'center' })
      },
    }
  }
  if (c.design === 'fiche') {
    const top = fr.y + 96 + SP[7]
    const head = compact ? none : textBlock(c, ask, { x: fr.x, w: fr.w, sizes: [FS.display, FS.heading], fam: 'serif', weight: 900, maxLines: 2, lh: 1.08 })
    const kh = compact ? FS.caption * 1.08 * 1.2 : 0
    const y = top + (compact ? kh + SP[5] : head.h + SP[8])
    const bottom = fr.bottom - 92 - (compact ? SP[5] : SP[7])
    const room = bottom - y
    const b = content(c, s, { x: fr.x, w: fr.w, maxH: room })
    return {
      b, room,
      draw() {
        chrome(c, { jp: c.pl.station?.jp || '', label: c.pl.station?.name || '' })
        // The question alone, unruled: the item under it carries the line.
        if (compact) kicker(c, ask, fr.cx, top, 'center')
        else head.draw(top)
        place(c, b, y, bottom)
        pill(c, weld(c.lang, W.save), fr.cx, fr.bottom - 92, { icon: 'save', dot: p.gold })
      },
    }
  }
  const top = fr.y + 56 + SP[7]
  const kh = FS.caption * 1.08 * 1.2
  const bottom = fr.bottom - 92 - (compact ? SP[5] : SP[8])
  const level = /^N\d$/.test(c.pl.level) && !compact ? `JLPT ${c.pl.level}` : ''
  const lv = level ? textBlock(c, level, { x: fr.x, w: fr.w, sizes: [FS.body], weight: 500, color: p.ink2, maxLines: 1 }) : none
  const gap = compact ? SP[5] : SP[7]
  const room = bottom - top - kh - gap - (lv.h ? lv.h + SP[7] : 0)
  const b = content(c, s, { x: fr.x, w: fr.w, maxH: room, align: centred ? 'center' : 'left' })
  return {
    b, room,
    draw() {
      chrome(c)
      kicker(c, ask, fr.cx, top, 'center')
      if (b.h > room) place(c, b, top + kh + gap, bottom)
      else stack([b, lv], top + kh + gap, bottom, SP[7])
      pill(c, weld(c.lang, W.swipe), fr.cx, fr.bottom - 92)
    },
  }
}
/** The answer, as the app shows it. */
function solutionSlide(c, s) {
  const { fr, W, p } = c
  const top = c.design === 'fiche' ? chrome(c, { jp: '解', label: W.answer }) : chrome(c)
  let y = top
  if (c.design !== 'fiche') y += kicker(c, s.kind === 'analyser' && c.design === 'clarte' ? W.analyser : W.answer, fr.x, y, 'left', c.design === 'clarte' ? p.ink2 : p.gold) + SP[6]
  const b = content(c, s, { x: fr.x, w: fr.w, maxH: fr.bottom - y })
  place(c, b, y, fr.bottom)
}
/** The content suite: the item in more detail. */
function detailSlide(c, s) {
  const { fr, W, p } = c
  const named = s.yours ? W.yours : W.detail[s.label] || W.detail.more
  const label = weld(c.lang, s.pages > 1 ? `${named} · ${s.page}/${s.pages}` : named)
  const top = c.design === 'fiche' ? chrome(c, { jp: s.yours ? '問' : '詳', label, band: s.yours ? p.gold : p.line.grammar }) : chrome(c)
  let y = top
  if (c.design !== 'fiche') y += kicker(c, label, fr.x, y, 'left') + SP[6]
  // A question left to the reader: asked, never answered here.
  const ask = s.ask ? textBlock(c, weld(c.lang, W.ask[s.ask]), { x: fr.x, w: fr.w, sizes: [FS.title, FS.lead], align: 'left', maxLines: 2 }) : none
  if (ask.h) { ask.draw(y); y += ask.h + SP[6] }
  const bottom = s.yours ? fr.bottom - 92 - SP[7] : fr.bottom
  const b = content(c, s, { x: fr.x, w: fr.w, maxH: bottom - y })
  // Where the question needs the pill's room (to fit, or to be set
  // whole), the way on is said in a line over it instead.
  if (s.yours && (b.h > bottom - y || b.cut)) {
    const hint = textBlock(c, weld(c.lang, W.yoursFoot), { x: fr.x, w: fr.w, sizes: [FS.body, FS.sm], weight: 500, color: p.ink2, align: 'left', maxLines: 1 })
    const b2 = content(c, s, { x: fr.x, w: fr.w, maxH: fr.bottom - y - hint.h - SP[5] })
    if (b.h > bottom - y || !b2.cut) {
      hint.draw(y)
      y += hint.h + SP[5]
      place(c, b2, y, fr.bottom)
      return
    }
  }
  place(c, b, y, bottom)
  if (s.yours) pill(c, weld(c.lang, W.yoursFoot), fr.cx, fr.bottom - 92)
}
/** The suite after the call to action: the funnel's detail, then the
 *  item's further parts (its words, its sentences, its lookalikes) and
 *  further questions (the type's own, then the source's catalogue) in
 *  turn. Nothing twice: no part already dealt, no question already asked. */
function suiteOf(spec, pl) {
  const f = pl.funnel || {}
  const seen = new Set([spec.hook?.q, spec.solution?.q, spec.detail?.q].filter(Boolean))
  const same = (a, b) => a.kind === b.kind && (a.label || '') === (b.label || '')
  const rowsOf = list => list.map(x => ({ t: x.t, reading: x.kanji ? x.reading : x.reading || '', ro: x.ro, main: x.main, sub: x.pos, line: x.line || 'vocab' }))
  // A sentence's suite (spec.lead) is its breakdown and more of it, no question.
  const lead = spec.lead || []
  const parts = [
    f.breakdown?.length && !spec.lead ? { kind: 'rows', items: rowsOf(f.breakdown), label: 'words' } : null,
    f.examples?.length ? { kind: 'examples', items: f.examples, label: 'sentences' } : null,
    f.words?.length ? { kind: 'rows', items: f.words, label: pl.source === 'kanji' || pl.source === 'word' ? 'kanjiWords' : 'words' } : null,
    f.lookalike?.length > 1 ? { kind: 'kanas', items: f.lookalike, here: f.kana?.k, label: 'lookalike' } : null,
  ].filter(d => d && !(spec.detail && same(spec.detail, d)) && !lead.some(x => same(x, d)))
  const asks = spec.lead ? [] : [
    ...(spec.further || []),
    ...withoutGiveaways(pl.quizzes || []).filter(q => !seen.has(q) && !(spec.further || []).some(d => d.q === q)).map(q => ({ kind: 'question', q, yours: true })),
  ]
  // What the slides dealt so far print: a question that one of them has
  // already answered is not asked (the word's reading on the answer slide
  // before "how is it read?").
  let shown = `${shownOf(spec.hook)} ${shownOf(spec.solution)}`
  const given = d => {
    const a = answerOf(d)?.text?.toLowerCase().replace(/\s+/g, ' ').trim()
    return !!a && shown.includes(a)
  }
  const deal = d => {
    out.push(d)
    shown += ` ${shownOf(d)} ${d.yours ? shownOf(revealOf(d)) : ''}`
  }
  const out = []
  // The funnel's own detail leads its kind: first of the parts, or of the questions.
  if (lead.length) parts.unshift(...lead)
  else if (spec.detail) (spec.detail.yours ? asks : parts).unshift(spec.detail)
  // In turn, a question after a part and a part after a question; of the
  // parts, the one that answers the fewest questions still to ask, so that
  // a question comes before the part that would answer it.
  const answers = d => {
    const t = shownOf(d)
    return asks.filter(x => { const a = answerOf(x)?.text?.toLowerCase().replace(/\s+/g, ' ').trim(); return a && t.includes(a) }).length
  }
  for (;;) {
    for (let i = asks.length - 1; i >= 0; i--) if (given(asks[i])) asks.splice(i, 1)
    if (!parts.length && !asks.length) break
    const last = out[out.length - 1]
    if (asks.length && (!last || !last.yours || !parts.length)) deal(asks.shift())
    else {
      let at = 0
      parts.forEach((d, i) => { if (answers(d) < answers(parts[at])) at = i })
      deal(parts.splice(at, 1)[0])
    }
  }
  return out
}
/** All a slide prints, as text: what a later question's answer is looked
 *  for in. A question prints what it asks, its stem and its choices; answered,
 *  its sentence completed and why; anything else, all it carries but its
 *  stroke data (a kanji's record there lists words the slide never shows). */
function shownOf(d) {
  if (!d) return ''
  const rowsText = rows => (rows || []).map(r => `${r.t} ${r.fu ? r.fu.map(x => x[1] || x[0]).join('') : ''}`).join(' ')
  let t
  if (d.kind === 'question') {
    const q = d.q
    const st = d.revealed ? q.stem?.after || q.stem : q.stem
    t = [d.revealed ? '' : q.ask, rowsText(st?.rows), st?.specimen, st?.text, st?.tr,
      ...(d.revealed ? [q.choices[q.right]?.text, rowsText(q.choices[q.right]?.rows), q.explain?.head, q.explain?.sense, q.explain?.why] : q.choices.map(ch => ch.text || rowsText(ch.rows)))].join(' ')
  } else t = JSON.stringify(d, (k, v) => (k === 'strokes' ? undefined : v))
  return t.toLowerCase().replace(/\s+/g, ' ')
}
/** A question left to the reader, answered: as the answer slide draws it. */
function revealOf(d) {
  if (d.kind === 'question') return { kind: 'question', q: d.q, revealed: true }
  if (d.kind === 'pictures') return { kind: 'pictures', words: d.words, odd: d.odd, reveal: true, why: d.why }
  return { kind: 'turn', turn: d.turn, them: d.them, romaji: d.romaji, revealed: true }
}
/** What a question left to the reader answers: the choice, the odd one
 *  out or the reply, and why. */
function answerOf(d) {
  if (!d?.yours) return null
  const rowsText = rows => rows.map(r => r.t).join('')
  if (d.kind === 'question') {
    const ch = d.q.choices[d.q.right]
    return { text: ch.rows ? rowsText(ch.rows) : ch.text, fam: ch.rows || ch.fam === 'jp' ? 'jp' : 'latin', why: whyOf(d.q) }
  }
  if (d.kind === 'pictures') {
    const odd = d.words[d.odd]
    return { text: odd.main ? `${odd.t} · ${odd.main}` : odd.t, fam: 'jp', why: d.why || '', e: odd.e }
  }
  if (d.kind === 'turn') return { text: rowsText(d.turn.choices[d.turn.right]), fam: 'jp', why: d.turn.why || '' }
  return null
}
/** The key points, and a reason to keep the post. */
// A key point is a line or two: a long one gives way to the shorter ones.
const KEY_MAX = 170
function keysSlide(c, all, answer = null) {
  const { p, fr, W } = c
  const short = all.filter(k => k.text.length <= KEY_MAX)
  const notes = short.length ? short : all.slice(0, 1)
  const top = c.design === 'fiche' ? chrome(c, { jp: '要点', label: W.keys, band: p.gold }) : chrome(c)
  const keep = saveBlock(c)
  const x = fr.x - reach(c)
  const w = fr.w + reach(c) * 2
  const roomFor = ans => fr.bottom - top - keep.h - SP[7] - (ans.h ? ans.h + SP[7] : 0)
  // As many points as fit, the most first; under an answer, its why gives
  // way before them, and they before it.
  // Fewer points rather than one cut short.
  const pointsIn = room => {
    let firstFit = null
    for (let k = notes.length; k >= 1; k--) {
      const b = notesBlock(c, notes.slice(0, k), { x, w, maxH: room })
      if (b && !b.cut) return b
      firstFit ||= b
    }
    return firstFit
  }
  const answers = answer ? [answerCard(c, answer, w, true), answerCard(c, answer, w, false)] : [none]
  let ans = answers[0]
  let pts = notes.length ? pointsIn(roomFor(ans)) : null
  if (answer && notes.length && (!pts || pts.cut)) {
    const lean = pointsIn(roomFor(answers[1]))
    if (lean && (!pts || !lean.cut)) { ans = answers[1]; pts = lean }
  }
  const ph = pts ? pts.h : 0
  const total = ans.h + (ans.h && ph ? SP[7] : 0) + ph + SP[7] + keep.h
  let y = top + Math.max(0, (fr.bottom - top - total) / 2)
  if (ans.h) {
    ans.draw(x, y)
    y += ans.h + SP[7]
  }
  if (pts) {
    pts.draw(y)
    y += ph + SP[7]
  }
  keep.draw(y)
}
/** The accent a kind of point is marked in. */
function kindInk(p, kind) {
  return { careful: p.rating[0], contrast: p.line.kanji, use: p.line.grammar, form: p.line.grammar, mean: p.line.vocab, word: p.line.vocab, reading: p.line.vocab, example: p.line.reading, sound: p.line.kana, twin: p.line.kana, parts: p.line.kanji }[kind] || p.gold
}
/** A point's text as its kind's label leaves it: "Form: " is the label already. */
const bare = n => (n.kind === 'form' ? n.text.replace(/^(Form|Forme)\s*:\s*/, '') : n.text)
/** The key points, a card a point: its kind's mark and name in the
 *  kind's ink over what it says, every text at one size. Null where they
 *  do not fit in maxH. */
function notesBlock(c, notes, { x, w, maxH }) {
  const { ctx, p, W } = c
  const pad = SP[5]
  const r = 34
  const tx = x + pad + r * 2 + SP[5]
  const tw = x + w - pad - tx
  let firstFit = null
  for (const z of [FS.lead, FS.body, FS.sm]) {
    const cards = notes.map(n => {
      const [mark, name] = W.kinds[n.kind] || W.kinds.note
      const b = fit(ctx, weld(c.lang, bare(n)), { weight: 500, sizes: [z], maxW: tw, maxLines: 6, balanced: false, lh: 1.22 })
      const kh = FS.caption * 1.2
      const h = pad * 2 + Math.max(r * 2, kh + SP[2] + paragraphH(b, 1.22))
      return { n, mark, name, b, kh, h }
    })
    const h = cards.reduce((a, k) => a + k.h + SP[4], -SP[4])
    if (h > maxH) continue
    const lay = {
      h,
      cut: cards.some(k => k.b.cut),
      draw: y => {
        for (const k of cards) {
          const ink = kindInk(p, k.n.kind)
          card(c, x, y, w, k.h, R.card * 2)
          ctx.fillStyle = mix(ink, cardInk(p), 0.18)
          ctx.beginPath()
          ctx.arc(x + pad + r, y + pad + r, r, 0, Math.PI * 2)
          ctx.fill()
          emojiAt(ctx, k.mark, x + pad + r, y + pad + r, 36)
          kicker(c, weld(c.lang, k.name), tx, y + pad, 'left', ink, tw)
          paragraph(ctx, k.b, tx, y + pad + k.kh + SP[2], p.ink, 'left', 1.22)
          y += k.h + SP[4]
        }
      },
    }
    if (!lay.cut) return lay
    firstFit ||= lay
  }
  return firstFit
}
/** The save button's glyph: a bookmark, as the feed draws it. */
function bookmark(ctx, cx, cy, h, color, { fill = false, lw = h * 0.1 } = {}) {
  const w = h * 0.74
  ctx.save()
  ctx.beginPath()
  ctx.moveTo(cx - w / 2, cy - h / 2)
  ctx.lineTo(cx + w / 2, cy - h / 2)
  ctx.lineTo(cx + w / 2, cy + h / 2)
  ctx.lineTo(cx, cy + h * 0.2)
  ctx.lineTo(cx - w / 2, cy + h / 2)
  ctx.closePath()
  ctx.lineJoin = 'round'
  if (fill) { ctx.fillStyle = color; ctx.fill() }
  else { ctx.strokeStyle = color; ctx.lineWidth = lw; ctx.stroke() }
  ctx.restore()
}
/** The reason to keep the post, under the key points: the call set large
 *  beside the save glyph, a short arrow down from it. */
function saveBlock(c) {
  const { ctx, p, fr, W } = c
  const b = fit(ctx, weld(c.lang, W.saveFor), { sizes: [FS.title, FS.lead, FS.body], maxW: fr.w - 230, maxLines: 2 })
  const bh = paragraphH(b)
  const line = Math.max(bh, 96)
  // Its height counts the arrow's head, under the line.
  const h = line + SP[4]
  return {
    h,
    draw: y => {
      const cy = y + line / 2
      bookmark(ctx, fr.x + 34, cy, 68, p.gold, { lw: 7 })
      paragraph(ctx, b, fr.x + 92, cy - bh / 2, p.ink, 'left')
      const ex = fr.x + 92 + Math.max(...b.lines.map(l => measure(ctx, l, b.f))) + SP[5]
      arrow(ctx, ex, cy - bh / 2 + b.size * 0.5, Math.min(ex + 110, fr.right - 8), y + h, p.gold, -0.35, 7)
    },
  }
}
/** The answer to the question left to the reader: what it is, with a
 *  check, and why. */
function answerCard(c, a, w, withWhy = true) {
  const { ctx, p, W } = c
  const ok = success(p)
  const pad = SP[5]
  const kh = FS.caption * 1.2
  // A long answer or why takes more lines, a rung down, before it is cut;
  // a why that still would be is left off.
  const tw = w - pad * 2 - 64
  const t2 = fit(ctx, a.text, { fam: a.fam, weight: 700, sizes: [FS.title, FS.lead, FS.body], maxW: tw, maxLines: 2, balanced: false })
  const tb = t2.cut ? fit(ctx, a.text, { fam: a.fam, weight: 700, sizes: [FS.body, FS.sm], maxW: tw, maxLines: 3, balanced: false }) : t2
  const whyStr = withWhy && a.why && a.why !== a.text ? weld(c.lang, a.why) : ''
  const w3 = whyStr ? fit(ctx, whyStr, { weight: 500, sizes: [FS.body, FS.sm], maxW: w - pad * 2, maxLines: 3, balanced: false }) : null
  const w5 = w3?.cut ? fit(ctx, whyStr, { weight: 500, sizes: [FS.body, FS.sm], maxW: w - pad * 2, maxLines: 5, balanced: false }) : w3
  const why = w5?.cut ? null : w5
  const th = Math.max(paragraphH(tb), 44)
  const h = pad * 2 + kh + SP[4] + th + (why ? SP[4] + paragraphH(why) : 0)
  return {
    h,
    draw: (x, y) => {
      // Tinted, unruled: it reaches into the margin as the key points' card does.
      ctx.fillStyle = mix(ok, cardInk(p), p.paper ? 0.12 : 0.2)
      rrect(ctx, x, y, w, h, R.card * 2)
      ctx.fill()
      kicker(c, weld(c.lang, W.yoursAnswer), x + pad, y + pad, 'left', ok, w - pad * 2)
      const ty = y + pad + kh + SP[4]
      check(ctx, x + pad + 22, ty + th / 2, 22, ok, cardInk(p))
      paragraph(ctx, tb, x + pad + 64, ty + (th - paragraphH(tb)) / 2, p.ink, 'left')
      if (why) paragraph(ctx, why, x + pad, ty + th + SP[4], p.ink2, 'left')
    },
  }
}

// ── The call to action ────────────────────────────────────────
/** Want more like this: the feature the item comes from, drawn as what it
 *  does, two more beside it, and the way to the app. */
function ctaSlide(c, feature) {
  const { ctx, p, fr, W } = c
  const F = W.features[feature]
  // The call to action is Tsuji's whole: its headline and its button say
  // the name, so the masthead gives its room to the picture.
  const top = chrome(c, { thin: true, band: p.gold })
  const head = textBlock(c, weld(c.lang, W.cta.head), { x: fr.x, w: fr.w, sizes: tall(c) ? [FS.display * 0.8, FS.heading] : [FS.heading, FS.display * 0.6], fam: 'serif', weight: 900, maxLines: 2, lh: 1.06 })
  // The feature in one card: its picture, its name and what it does.
  const pad = SP[6]
  const cx = fr.x - reach(c)
  const cw = fr.w + reach(c) * 2
  // A long name (Écris tes propres phrases) steps down a size, then takes two lines; never cut.
  const name = textBlock(c, weld(c.lang, F.name), { x: cx + pad, w: cw - pad * 2, sizes: [FS.title, FS.lead, FS.body], maxLines: 2, color: p.paper ? mix(featureInk(p, feature), p.ink, 0.7) : p.ink })
  // What costs nothing is said in the sentence, its tag in the picture.
  const line = textBlock(c, weld(c.lang, F.freeLine ? `${F.line} ${F.freeLine}.` : F.line), { x: cx + pad, w: cw - pad * 2, sizes: [FS.body, FS.sm], weight: 500, color: p.ink2, maxLines: 3 })
  const btn = METAL_H
  const alsoH = 72
  const gap = SP[5]
  let y = top
  head.draw(y)
  y += head.h + SP[3]
  swoosh(c, fr.cx, y + 4, Math.min(fr.w * 0.62, 460))
  y += SP[6]
  const words = name.h + SP[2] + line.h
  // The card's margin above and below is lean: the picture keeps the room.
  const edge = SP[4]
  let room = fr.bottom - y - gap - btn - edge * 2 - SP[4] - words
  const showAlso = room - alsoH - gap >= 280
  if (showAlso) room -= alsoH + gap
  const ch = edge * 2 + room + SP[4] + words
  card(c, cx, y, cw, ch, R.card * 2, faceInk(p))
  illustrate(c, feature, { x: fr.x, y: y + edge, w: fr.w, h: room })
  name.draw(y + edge + room + SP[4])
  line.draw(y + edge + room + SP[4] + name.h + SP[2])
  y += ch + gap
  if (showAlso) also(c, ALSO[feature], y)
  metal(ctx, p, fr.cx, fr.bottom - btn, weld(c.lang, W.cta.go), fr.w)
}
/** The two other features, a picture and a name each. */
function also(c, list, y) {
  const { ctx, p, fr, W } = c
  const at = y
  const r = 36
  const head = W.cta.also.toLocaleUpperCase()
  const hf = font(700, FS.caption, 'latin')
  // The row in one line: the heading, then a chip a feature, the body
  // stepping down a rung where the language's names run long.
  const chipsW = z2 => list.reduce((a, k) => a + r * 2 + SP[3] + measure(ctx, W.features[k].short, font(700, z2, 'latin')) + SP[5] + SP[4], -SP[4])
  const z = [FS.body, FS.sm, FS.caption].find(z2 => measure(ctx, head, hf, 0.16) + SP[5] + chipsW(z2) <= fr.w)
  const f = font(700, z || FS.sm, 'latin')
  const chips = list.map(k => ({ k, label: W.features[k].short, w: r * 2 + SP[3] + measure(ctx, W.features[k].short, f) + SP[5] }))
  // Too wide with its heading, the row is the chips alone.
  const hw = z ? measure(ctx, head, hf, 0.16) : -SP[5]
  const total = hw + SP[5] + chips.reduce((a, ch) => a + ch.w, 0) + SP[4] * (chips.length - 1)
  let x = fr.cx - total / 2
  if (z) text(ctx, head, x, at + r + FS.caption * 0.36, { f: hf, color: p.ink2, tr: 0.16 })
  x += hw + SP[5]
  for (const ch of chips) {
    ctx.fillStyle = faceInk(p)
    rrect(ctx, x, at, ch.w, r * 2, r)
    ctx.fill()
    ctx.fillStyle = mix(featureInk(p, ch.k), cardInk(p), 0.25)
    ctx.beginPath()
    ctx.arc(x + r, at + r, r, 0, Math.PI * 2)
    ctx.fill()
    emojiAt(ctx, FEATURE_ICON[ch.k], x + r, at + r, 38)
    text(ctx, ch.label, x + r * 2 + SP[3], at + r + (z || FS.sm) * 0.36, { f, color: p.ink })
    x += ch.w + SP[4]
  }
}

// ── The pictures: what each feature does, drawn as a schema ──────
// Each is drawn on an 800 × 420 board, scaled to the room it is given and
// centred in it: its words keep 30px at least on the board, so they stay
// readable at a post's smallest scale.
const BOARD = { w: 800, h: 420 }
// A run told in three panels is a wider board, so it is drawn larger.
const STORY_H = 340
const STORIES = new Set(['reading', 'comprehension', 'translation', 'composition'])
function illustrate(c, feature, box) {
  const { ctx } = c
  const bh = STORIES.has(feature) ? STORY_H : BOARD.h
  const s = Math.min(box.w / BOARD.w, box.h / bh)
  ctx.save()
  ctx.translate(box.x + (box.w - BOARD.w * s) / 2, box.y + (box.h - bh * s) / 2)
  ctx.scale(s, s)
  const draw = {
    reading: drawReading, comprehension: drawComprehension, translation: drawTranslation, listen: drawListen, composition: drawComposition,
    exam: drawExam, analyser: drawRead, ask: drawAsk, today: drawToday, words: drawWords, kanji: drawKanji, grammar: drawGrammar, kana: drawKana,
  }[feature]
  draw(c)
  ctx.restore()
}
const boardCard = (c, x, y, w, h, r = 26, fill = cardInk(c.p)) => card(c, x, y, w, h, r, fill)
function tilt(ctx, cx, cy, a, fn) {
  ctx.save()
  ctx.translate(cx, cy)
  ctx.rotate(a)
  ctx.translate(-cx, -cy)
  fn()
  ctx.restore()
}
function arrow(ctx, x0, y0, x1, y1, color, bend = 0.3, width = 6) {
  const mx = (x0 + x1) / 2 - (y1 - y0) * bend
  const my = (y0 + y1) / 2 + (x1 - x0) * bend
  ctx.save()
  ctx.strokeStyle = color
  ctx.fillStyle = color
  ctx.lineWidth = width
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(x0, y0)
  ctx.quadraticCurveTo(mx, my, x1, y1)
  ctx.stroke()
  const a = Math.atan2(y1 - my, x1 - mx)
  ctx.beginPath()
  ctx.moveTo(x1 + Math.cos(a) * 4, y1 + Math.sin(a) * 4)
  ctx.lineTo(x1 - Math.cos(a - 0.5) * 22, y1 - Math.sin(a - 0.5) * 22)
  ctx.lineTo(x1 - Math.cos(a + 0.5) * 22, y1 - Math.sin(a + 0.5) * 22)
  ctx.closePath()
  ctx.fill()
  ctx.restore()
}
const label = (c, str, x, y, { size = 30, color = c.p.ink, align = 'center', weight = 700, fam = 'latin', maxW = 400 } = {}) => {
  const b = fit(c.ctx, str, { weight, fam, sizes: [size, size * 0.9], maxW, maxLines: 1 })
  return text(c.ctx, b.lines[0], x, y, { f: b.f, color, align })
}
/** The words the item says, as the analyser would draw them. */
function sampleToks(c) {
  const f = c.pl.funnel || {}
  // The closing stop stays off, as on the answer's analyser.
  if (f.toks?.length) return f.toks.filter((tk, i, all) => !(i === all.length - 1 && tk.k === 'punct'))
  // A word in a sentence of its own, else alone with its reading.
  const rows = f.examples?.[0]?.rows || f.sents?.[0] || (f.word ? [{ t: f.word.t, fu: f.word.fu, k: 'word' }] : null)
  if (rows) return rows.map(r => ({ t: r.t, fu: r.fu && hasKanji(r.t) ? r.fu.map(([a, b]) => b || a).join('') : '', k: r.k, point: 0 }))
  const jp = c.pl.caption?.jp || ''
  return [...jp.replace(/（.*?）/g, '')].slice(0, 8).map(t => ({ t, fu: '', k: 'word', point: 0 }))
}

// 読: three ways in, one analysed sentence out.
function drawRead(c) {
  const { ctx, p, W } = c
  const F = W.features.analyser
  const reading = p.line.reading
  const icons = ['📋', '▶️', '📷']
  F.inputs.forEach((name, i) => {
    const y = 40 + i * 122
    boardCard(c, 10, y, 236, 96, 48, faceInk(p))
    ctx.fillStyle = mix(reading, cardInk(p), 0.18)
    ctx.beginPath()
    ctx.arc(58, y + 48, 36, 0, Math.PI * 2)
    ctx.fill()
    emojiAt(ctx, icons[i], 58, y + 48, 38)
    label(c, name, 106, y + 59, { align: 'left', size: 32, maxW: 132 })
    arrow(ctx, 252, y + 48, 318, 210, p.gold, i === 0 ? 0.2 : i === 2 ? -0.2 : 0, 5)
  })
  tilt(ctx, 560, 210, -0.025, () => {
    boardCard(c, 330, 30, 460, 360, 30)
    const toks = sampleToks(c)
    const inner = 400
    const said = c.pl.funnel?.translation || c.pl.funnel?.examples?.[0]?.tr || ''
    let u = 2.2
    const ghost = v => measured(ctx, m => analyserLine(m, p, 0, 0, inner, v, toks))
    while (u > 1.2 && ghost(u) > (said ? 190 : 300)) u -= 0.1
    const ah = analyserLine(ctx, p, 360, said ? 50 : 210 - ghost(u) / 2, inner, u, toks)
    // A long sentence's analysis takes the card: its sense gives way.
    if (!said || 360 - ah - 60 < 70) return
    ctx.fillStyle = faceInk(p)
    rrect(ctx, 352, 74 + ah, inner + 16, 360 - ah - 60, 16)
    ctx.fill()
    const b = fit(ctx, said, { sizes: [32, 30], maxW: inner - 16, maxLines: Math.max(1, Math.floor((360 - ah - 80) / 40)), balanced: false })
    paragraph(ctx, b, 368, 84 + ah, p.ink, 'left')
  })
  sparks(c, 735, 40, 22, p.line.grammar, 1)
  sparks(c, 330, 380, 22, p.line.grammar, -1)
}
// ── The practice modes, each a storyboard of its run (plan 234b) ──
/** What the item gives the pictures to show: its Japanese, its rōmaji,
 *  its sense, its point; each where the plan has it, else nothing. */
function itemOf(c) {
  const f = c.pl.funnel || {}
  const rows = f.rows?.length ? f.rows : f.examples?.[0]?.rows || f.sents?.[0] || null
  const jp = rows ? rows.map(r => r.t).join('') : f.word?.t || ''
  return {
    jp,
    rows: rows ? rows.map(r => r.t) : jp ? [jp] : [],
    ro: f.romaji || (f.word ? f.word.ro : '') || '',
    tr: f.translation || f.examples?.[0]?.tr || f.word?.main || '',
    pattern: f.point?.pattern || f.points?.[0]?.pattern || c.pl.caption?.point || '',
    breakdown: f.breakdown || [],
  }
}
/** Text on the board: fitted to its box, its height returned. */
function boardText(c, str, x, y, w, { sizes = [32, 30], lines = 3, fam = 'latin', weight = 700, color = c.p.ink, align = 'left', balanced = false } = {}) {
  if (!str) return 0
  const b = fit(c.ctx, str, { weight, fam, sizes, maxW: w, maxLines: lines, balanced })
  const ax = align === 'center' ? x + w / 2 : x
  return paragraph(c.ctx, b, ax, y, color, align)
}
/** A run's three steps, on its line (dictation's picture). */
function stops(c, steps, ink) {
  const { ctx } = c
  ctx.fillStyle = ink
  rrect(ctx, 90, 352, 620, 12, 6)
  ctx.fill()
  steps.forEach((step, i) => {
    const x = 130 + i * 270
    ctx.fillStyle = cardInk(c.p)
    ctx.beginPath()
    ctx.arc(x, 358, 22, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = ink
    ctx.lineWidth = 8
    ctx.stroke()
    label(c, step, x, 412, { size: 32, maxW: 250 })
  })
}
/** Three panels a run goes through, each headed by its step, an arrow
 *  from each to the next. */
function panels(c, draws, steps, ink) {
  const { ctx, p } = c
  const w = 236
  draws.forEach((draw, i) => {
    const x = 6 + i * 270
    tilt(ctx, x + w / 2, 170, [-0.025, 0.015, -0.01][i], () => {
      boardCard(c, x, 8, w, 324, 24)
      ctx.fillStyle = ink
      ctx.beginPath()
      ctx.arc(x + 38, 48, 22, 0, Math.PI * 2)
      ctx.fill()
      text(ctx, String(i + 1), x + 38, 48 + 11, { f: font(700, 30, 'latin'), color: cardInk(p), align: 'center' })
      label(c, steps[i], x + 70, 59, { size: 32, color: ink, align: 'left', maxW: w - 84 })
      draw(x + 18, 84, w - 36, 236)
    })
    if (i < draws.length - 1) arrow(ctx, x + w + 2, 176, x + 270 - 4, 176, p.gold, 0, 5)
  })
}
const caret = (ctx, x, y, size, color) => { ctx.fillStyle = color; ctx.fillRect(x + 4, y - size * 0.8, 4, size) }
/** The tutor's read on an answer: a bubble, its lines, a check. */
function tutor(c, x, y, w, ink) {
  const { ctx, p } = c
  emojiAt(ctx, '🧑‍🏫', x + 28, y + 22, 48)
  ctx.fillStyle = mix(ink, cardInk(p), 0.14)
  rrect(ctx, x, y + 64, w, 156, 20)
  ctx.fill()
  ctx.fillStyle = mix(ink, cardInk(p), 0.14)
  ctx.beginPath()
  ctx.moveTo(x + 18, y + 66)
  ctx.lineTo(x + 30, y + 46)
  ctx.lineTo(x + 46, y + 66)
  ctx.fill()
  ctx.fillStyle = alpha(p.ink2, 0.55)
  for (const [k, lw] of [[0, 0.82], [1, 0.66], [2, 0.74]]) {
    rrect(ctx, x + 20, y + 92 + k * 34, (w - 40) * lw, 10, 5)
    ctx.fill()
  }
  check(ctx, x + w - 8, y + 64, 26, success(p), cardInk(p))
}

// 読書: the run as it goes (components/reading/ReadingPieces.jsx): the
// sentence under its clock, covered when the clock runs out and written
// from memory, then checked and cut word by word.
const EYE_OFF = ['M3 3l18 18', 'M10.6 5.1A10.6 10.6 0 0 1 12 5c5 0 9 3.5 10 7-.4 1.4-1.2 2.7-2.2 3.8', 'M6.2 6.2C4.2 7.5 2.7 9.5 2 12c1 3.5 5 7 10 7 1.4 0 2.7-.25 3.9-.7', 'M9.5 10a3 3 0 0 0 4.2 4.2']
/** The app's eye-off icon (Icons.jsx), stroked as the app strokes it. */
function eyeOff(ctx, cx, cy, size, color) {
  ctx.save()
  ctx.translate(cx - size / 2, cy - size / 2)
  ctx.scale(size / 24, size / 24)
  ctx.strokeStyle = color
  ctx.lineWidth = 2
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  for (const d of EYE_OFF) ctx.stroke(new Path2D(d))
  ctx.restore()
}
/** Words to the width, the last cut short: a line that always fits. */
/** A gloss's senses, split where no bracket is open. */
function sensesOf(str) {
  const out = ['']
  let depth = 0
  for (const ch of String(str || '')) {
    if (/[([（]/.test(ch)) depth++
    if (/[)\]）]/.test(ch)) depth = Math.max(0, depth - 1)
    if (!depth && /[,;、]/.test(ch)) out.push('')
    else out[out.length - 1] += ch
  }
  return out.map(x => x.trim()).filter(Boolean)
}
/** A gloss fitted as `fit` does, its last senses left off before it is
 *  cut: the deck's own words, fewer of them. */
function glossFit(ctx, str, o) {
  const senses = sensesOf(str)
  let b = fit(ctx, str || '', o)
  for (let k = senses.length - 1; b.cut && k >= 1; k--) b = fit(ctx, senses.slice(0, k).join(', '), o)
  return b
}
function clipped(ctx, str, f, maxW) {
  if (measure(ctx, str, f) <= maxW) return str
  let out = str
  while (out.length > 1 && measure(ctx, `${out}…`, f) > maxW) out = out.slice(0, -1)
  return `${out.replace(/[\s,;:.]+$/, '')}…`
}
/** A sentence set by its words: a line breaks between two of them, and
 *  inside one only when the word alone is wider than the line. The
 *  largest of `sizes` that holds it in `maxLines`, else the last cut. */
function wordLines(ctx, words, { sizes, maxW, maxLines, maxH = Infinity, fam = 'jp', weight = 700 }) {
  let last
  for (const size of sizes) {
    const f = font(weight, size, fam)
    const pieces = words.flatMap(w => (measure(ctx, w, f) > maxW ? [...w] : [w]))
    const lines = []
    for (const w of pieces) {
      const cur = lines[lines.length - 1]
      // A closing mark never starts a line: it stays with the word before it.
      if (cur != null && (measure(ctx, cur + w, f) <= maxW || /^[、。！？」』）]/.test(w))) lines[lines.length - 1] = cur + w
      else lines.push(w)
    }
    last = { size, f, lines }
    if (lines.length <= maxLines && paragraphH(last) <= maxH) return last
  }
  const room = Math.max(1, Math.min(maxLines, Math.floor((maxH / last.size - 1.1) / 1.18) + 1))
  if (last.lines.length <= room) return last
  const kept = last.lines.slice(0, room)
  kept[room - 1] = clipped(ctx, kept[room - 1] + '…', last.f, maxW)
  return { ...last, lines: kept }
}
function drawReading(c) {
  const { ctx, p, W } = c
  const F = W.features.reading
  const ink = p.line.reading
  const it = itemOf(c)
  const ro = (it.ro || 'nihongo').toLowerCase()
  // The run's clock (ReadingTimer): a hairline that empties, the seconds under it.
  const clock = (x, y, w, fill, said) => {
    ctx.fillStyle = p.paper ? p.surfaceLine : p.panelLine
    rrect(ctx, x, y, w, 8, 4)
    ctx.fill()
    if (fill > 0) {
      ctx.fillStyle = p.rating[2]
      rrect(ctx, x, y, w * fill, 8, 4)
      ctx.fill()
    }
    if (said) label(c, said, x + w / 2, y + 44, { size: 28, color: p.ink2, maxW: w })
  }
  // The sentence's card, as the run draws it.
  const card = (x, y, w, h) => {
    ctx.fillStyle = faceInk(p)
    rrect(ctx, x, y, w, h, 16)
    ctx.fill()
  }
  panels(c, [
    (x, y, w, h) => {
      // The clock runs; the sentence is there to read.
      clock(x, y + 4, w, 0.62, '2.4s')
      card(x, y + 70, w, h - 70)
      const b = wordLines(ctx, it.rows.length ? it.rows : ['日本語'], { sizes: [40, 36, 32, 30, 28], maxW: w - 28, maxLines: 4, maxH: h - 70 - 24 })
      paragraph(ctx, b, x + w / 2, y + 70 + (h - 70 - paragraphH(b)) / 2, p.ink, 'center')
    },
    (x, y, w, h) => {
      // The clock is out: the sentence covered, its reading written from memory.
      clock(x, y + 4, w, 0, '')
      card(x, y + 28, w, 92)
      eyeOff(ctx, x + w / 2, y + 74, 52, p.ink2)
      // The field, the reading being typed into it.
      const fy = y + 136
      ctx.fillStyle = cardInk(p)
      rrect(ctx, x, fy, w, h - 136, 16)
      ctx.fill()
      ctx.strokeStyle = ink
      ctx.lineWidth = 4
      rrect(ctx, x, fy, w, h - 136, 16)
      ctx.stroke()
      const b = fit(ctx, ro, { weight: 700, sizes: [30], maxW: w - 40, balanced: false })
      const lines = b.lines.slice(0, 2)
      lines.forEach((ln, i) => {
        const yy = fy + 40 + i * b.size * 1.2
        const tw = text(ctx, ln, x + 16, yy, { f: b.f, color: p.ink })
        if (i === lines.length - 1) caret(ctx, x + 16 + tw, yy, b.size, ink)
      })
    },
    (x, y, w, h) => {
      // Checked: what it said, then its words, each with its sense.
      const ok = success(p)
      const mb = fit(ctx, it.tr || '', { weight: 700, sizes: [28, 26], maxW: w - 66, maxLines: 2, balanced: false })
      const wh = Math.max(64, paragraphH(mb) + 28)
      ctx.fillStyle = mix(ok, cardInk(p), 0.16)
      rrect(ctx, x, y + 4, w, wh, 16)
      ctx.fill()
      check(ctx, x + 30, y + 4 + wh / 2, 19, ok, cardInk(p))
      if (it.tr) paragraph(ctx, mb, x + 58, y + 4 + (wh - paragraphH(mb)) / 2, p.ink, 'left')
      // A word's gloss on the board is its first sense, short.
      const short = g => String(g || '').split(/[,;(]/)[0].trim()
      // The words the deck glosses first, then the grammar the sentence
      // uses; a word with no gloss is left bare, and only when none has one.
      const glossed = [...it.breakdown.filter(r => r.t && r.main && r.line === 'vocab'), ...it.breakdown.filter(r => r.t && r.main && r.line !== 'vocab')]
      const bare = it.breakdown.filter(r => r.t && r.line === 'vocab')
      const list = glossed.length ? glossed : bare.length ? bare : [{ t: it.jp.slice(0, 2) || '日本', main: '', line: 'vocab' }]
      const top = y + wh + 20
      const room = Math.max(1, Math.floor((y + h - top + 8) / 66))
      list.slice(0, room).forEach((r, i) => {
        const yy = top + i * 66
        // A row of the breakdown: its line's rule, the word, its sense.
        ctx.fillStyle = p.line[r.line] || p.line.vocab
        rrect(ctx, x, yy, 8, 58, 4)
        ctx.fill()
        const jf = font(700, 28, 'jp')
        text(ctx, clipped(ctx, r.t, jf, w - 22), x + 22, yy + 24, { f: jf, color: p.ink })
        if (r.main) {
          const gf = font(500, 26, 'latin')
          text(ctx, clipped(ctx, short(r.main), gf, w - 22), x + 22, yy + 54, { f: gf, color: p.ink2 })
        }
      })
    },
  ], F.steps, ink)
}
// 理解: a whole text, then its questions.
function drawComprehension(c) {
  const { ctx, p, W } = c
  const F = W.features.comprehension
  const ink = p.line.rikai
  const it = itemOf(c)
  const title = c.pl.funnel?.title || ''
  panels(c, [
    (x, y, w) => {
      let at = y + 6
      if (title) at += boardText(c, title, x, at, w, { sizes: [36, 32, 30], lines: 1, fam: 'serif' }) + 8
      at += boardText(c, it.jp, x, at, w, { sizes: [32, 30], lines: 3, fam: 'jp', weight: 700 }) + 10
      ctx.fillStyle = alpha(p.ink2, 0.45)
      for (let k = 0; k < 5 && at + 18 < y + 250; k++) {
        rrect(ctx, x, at + 4, w * [0.95, 0.82, 0.9, 0.7, 0.86][k], 10, 5)
        ctx.fill()
        at += 30
      }
    },
    (x, y, w) => {
      ctx.fillStyle = alpha(p.ink, 0.7)
      rrect(ctx, x, y + 8, w * 0.8, 12, 6)
      ctx.fill()
      for (let i = 0; i < 3; i++) {
        const yy = y + 50 + i * 64
        const right = i === 1
        ctx.fillStyle = right ? mix(success(p), cardInk(p), 0.2) : faceInk(p)
        rrect(ctx, x, yy, w, 50, 14)
        ctx.fill()
        if (right) check(ctx, x + 26, yy + 25, 17, success(p), cardInk(p))
        else {
          ctx.strokeStyle = alpha(p.ink2, 0.6)
          ctx.lineWidth = 4
          ctx.beginPath()
          ctx.arc(x + 26, yy + 25, 15, 0, Math.PI * 2)
          ctx.stroke()
        }
        ctx.fillStyle = right ? success(p) : alpha(p.ink2, 0.5)
        rrect(ctx, x + 54, yy + 20, w - 80, 10, 5)
        ctx.fill()
      }
    },
    (x, y, w) => {
      // The results: every answer checked, the text's words glossed.
      for (let i = 0; i < 3; i++) {
        const yy = y + 20 + i * 58
        check(ctx, x + 22, yy + 18, 20, i === 2 ? p.stamp : success(p), cardInk(p))
        ctx.fillStyle = alpha(p.ink2, 0.5)
        rrect(ctx, x + 56, yy + 13, w - 70, 10, 5)
        ctx.fill()
      }
      const word = c.pl.funnel?.words?.[0]
      if (word) {
        ctx.fillStyle = p.line.vocab
        rrect(ctx, x, y + 180, w, 52, 26)
        ctx.fill()
        const tb = fit(ctx, `${word.t} ${word.main || ''}`.trim(), { weight: 700, sizes: [32, 30], maxW: w - 24, maxLines: 1 })
        text(ctx, tb.lines[0], x + w / 2, y + 206 + tb.size * 0.36, { f: tb.f, color: p.onLine, align: 'center' })
      }
    },
  ], F.steps, ink)
}
// 翻訳: the sentence in the reader's language, theirs, the tutor's read.
function drawTranslation(c) {
  const { ctx, p, W } = c
  const F = W.features.translation
  const ink = p.line.honyaku
  const it = itemOf(c)
  panels(c, [
    (x, y, w) => boardText(c, `“${it.tr || '…'}”`, x, y + 4, w, { sizes: [38, 36, 34, 32, 30], lines: 5, fam: 'serif', balanced: true }),
    (x, y, w) => {
      const b = fit(ctx, it.jp || '日本語', { fam: 'jp', weight: 700, sizes: [42, 38, 34, 32, 30], maxW: w, maxLines: 4, balanced: false })
      b.lines.forEach((ln, i) => {
        const yy = y + 40 + i * b.size * 1.3
        const tw = text(ctx, ln, x, yy, { f: b.f, color: p.ink })
        if (i === b.lines.length - 1) caret(ctx, x + tw, yy, b.size, p.gold)
      })
    },
    (x, y, w) => tutor(c, x, y, w, ink),
  ], F.steps, ink)
}
// 作文: the point given, a sentence with it, the tutor's read.
function drawComposition(c) {
  const { ctx, p, W } = c
  const F = W.features.composition
  const ink = p.line.sakubun
  const it = itemOf(c)
  panels(c, [
    (x, y, w) => {
      const b = fit(ctx, it.pattern || '〜ている', { fam: 'serif', weight: 700, sizes: [96, 80, 64, 52, 40, 34], maxW: w, maxLines: 2 })
      paragraph(ctx, b, x + w / 2, y + 96 - paragraphH(b) / 2, p.ink, 'center')
      ctx.fillStyle = p.line.grammar
      rrect(ctx, x + w * 0.2, y + 186, w * 0.6, 10, 5)
      ctx.fill()
    },
    (x, y, w) => {
      const said = it.jp
      if (said) {
        const b = fit(ctx, said, { fam: 'jp', weight: 700, sizes: [42, 38, 34, 32, 30], maxW: w, maxLines: 4, balanced: false })
        b.lines.forEach((ln, i) => {
          const yy = y + 40 + i * b.size * 1.3
          const tw = text(ctx, ln, x, yy, { f: b.f, color: p.ink })
          if (i === b.lines.length - 1) caret(ctx, x + tw, yy, b.size, p.gold)
        })
      } else {
        emojiAt(ctx, '✍️', x + w / 2, y + 100, 80)
      }
    },
    (x, y, w) => tutor(c, x, y, w, ink),
  ], F.steps, ink)
}
// 問: after the exercise, a short question and its short answer.
function drawAsk(c) {
  const { ctx, p, W } = c
  const F = W.features.ask
  const it = itemOf(c)
  const keys = c.pl.funnel?.keys || []
  // The answer is the bank's own line on the point (its most particular,
  // where several name it), else a question and answer the bank teaches too.
  const said = it.pattern ? keys.filter(k => k.includes(it.pattern) && k.length <= 140).sort((a, b) => b.length - a.length)[0] : null
  const [q, a] = said ? [F.ask(it.pattern), said] : F.fallback
  const qb = fit(ctx, q, { weight: 700, sizes: [38, 36, 34, 32], maxW: 540, maxLines: 2, balanced: false })
  const ab = fit(ctx, a, { weight: 500, sizes: [36, 34, 32, 30], maxW: 620, maxLines: 4, maxH: 190, balanced: false })
  const qh = paragraphH(qb) + 44
  const ah = paragraphH(ab) + 44
  const total = 84 + 22 + qh + 22 + ah
  const top = Math.max(0, (420 - total) / 2)
  // The exercise, graded.
  boardCard(c, 0, top, 580, 84, 20, faceInk(p))
  check(ctx, 42, top + 42, 26, success(p), cardInk(p))
  boardText(c, it.jp || it.tr, 82, top + 22, 470, { sizes: [36, 32, 30], lines: 1, fam: 'jp', weight: 700 })
  // 問, in the learner's voice.
  const qy = top + 106
  const qx = 800 - 660
  ctx.fillStyle = mix(p.gold, cardInk(p), 0.16)
  rrect(ctx, qx, qy, 660, qh, 26)
  ctx.fill()
  ctx.strokeStyle = p.gold
  ctx.lineWidth = 3
  rrect(ctx, qx + 1.5, qy + 1.5, 657, qh - 3, 26)
  ctx.stroke()
  roundTag(c, '問', qx + 44, qy + qh / 2, p.gold)
  paragraph(ctx, qb, qx + 88, qy + 22, p.ink, 'left')
  // 答, short and precise.
  const ay = qy + qh + 22
  boardCard(c, 0, ay, 740, ah, 26)
  roundTag(c, '答', 44, ay + ah / 2, success(p))
  paragraph(ctx, ab, 88, ay + 22, p.ink, 'left')
}
function roundTag(c, ch, cx, cy, color) {
  c.ctx.fillStyle = color
  c.ctx.beginPath()
  c.ctx.arc(cx, cy, 28, 0, Math.PI * 2)
  c.ctx.fill()
  text(c.ctx, ch, cx, cy + 12, { f: font(700, 32, 'jp'), color: cardInk(c.p), align: 'center' })
}
// 本日: the day's dial, its lines, and Depart.
function drawToday(c) {
  const { ctx, p, W } = c
  const F = W.features.today
  const cx = 200, cy = 200
  // The dial: the lines' arcs round the day's disc.
  const parts = [['kana', 4], ['vocab', 14], ['kanji', 8], ['grammar', 6]]
  const total = parts.reduce((a, [, n]) => a + n, 0)
  let at = -Math.PI / 2
  ctx.lineCap = 'round'
  for (const [line, n] of parts) {
    const span = (n / total) * Math.PI * 2
    ctx.strokeStyle = p.line[line]
    ctx.lineWidth = 16
    ctx.beginPath()
    ctx.arc(cx, cy, 168, at + 0.06, at + span - 0.06)
    ctx.stroke()
    at += span
  }
  const g = ctx.createRadialGradient(cx - 40, cy - 50, 10, cx, cy, 150)
  g.addColorStop(0, p.goldLit)
  g.addColorStop(1, p.goldMid)
  ctx.fillStyle = g
  ctx.beginPath()
  ctx.arc(cx, cy, 140, 0, Math.PI * 2)
  ctx.fill()
  text(ctx, String(total), cx, cy + 30, { f: font(700, 96, 'latin'), color: p.onFill, align: 'center' })
  label(c, F.unit.toLocaleUpperCase(), cx, cy + 76, { size: 30, color: p.onFill, maxW: 200 })
  // The lines it deals from.
  F.lines.forEach((name, i) => {
    const y = 40 + i * 64
    const [line, n] = parts[i]
    ctx.fillStyle = p.line[line]
    ctx.beginPath()
    ctx.arc(440, y + 22, 14, 0, Math.PI * 2)
    ctx.fill()
    text(ctx, name, 470, y + 34, { f: font(700, 32, 'jp'), color: p.ink })
    ctx.fillStyle = alpha(p.line[line], 0.35)
    rrect(ctx, 560, y + 14, 220, 16, 8)
    ctx.fill()
    ctx.fillStyle = p.line[line]
    rrect(ctx, 560, y + 14, 220 * (n / 14), 16, 8)
    ctx.fill()
  })
  // One tap, the button large enough to read at the card's scale.
  departButton(ctx, p, 420, 296, 372, 1.7, F.depart)
}
// 書取: listen twice, write what you heard, checked letter by letter.
function drawListen(c) {
  const { ctx, p, W } = c
  const F = W.features.listen
  const ink = p.line.kakitori
  // The headphones, sounding.
  ctx.fillStyle = mix(ink, cardInk(p), 0.22)
  ctx.beginPath()
  ctx.arc(130, 170, 118, 0, Math.PI * 2)
  ctx.fill()
  emojiAt(ctx, '🎧', 130, 170, 120)
  ctx.save()
  ctx.strokeStyle = ink
  ctx.lineCap = 'round'
  ctx.lineWidth = 8
  for (const r of [150, 180, 210]) {
    ctx.beginPath()
    ctx.arc(130, 170, r, -0.45, 0.45)
    ctx.stroke()
  }
  ctx.restore()
  // What was heard, written in rōmaji, each word checked.
  const said = (c.pl.funnel?.romaji || c.pl.caption?.romaji || c.pl.funnel?.word?.ro || 'ohayou gozaimasu').toLowerCase()
  tilt(ctx, 580, 160, 0.02, () => {
    boardCard(c, 380, 40, 410, 240, 26)
    label(c, 'rōmaji', 410, 92, { size: 30, color: p.ink2, align: 'left', weight: 500 })
    const b = fit(ctx, said, { weight: 500, sizes: [40, 36, 32], maxW: 350, maxLines: 2, balanced: false })
    b.lines.forEach((ln, i) => {
      const y = 152 + i * 56
      const w = text(ctx, ln, 410, y, { f: b.f, color: p.ink })
      ctx.fillStyle = success(p)
      rrect(ctx, 410, y + 12, w, 6, 3)
      ctx.fill()
      if (i === b.lines.length - 1) {
        ctx.fillStyle = p.gold
        ctx.fillRect(416 + w, y - b.size * 0.8, 5, b.size)
      }
    })
    check(ctx, 752, 56, 34, success(p), cardInk(p))
  })
  arrow(ctx, 280, 120, 372, 150, p.gold, -0.15)
  // Listen → write → check, a line with its three stops.
  stops(c, F.steps, ink)
}
// 模試: the paper in its four sections, the clock, the score.
function drawExam(c) {
  const { ctx, p } = c
  const ink = p.line.exam
  tilt(ctx, 250, 210, -0.05, () => {
    boardCard(c, 40, 20, 420, 390, 22, p.paper ? '#fffdf7' : cardInk(p))
    ctx.fillStyle = ink
    rrect(ctx, 40, 20, 420, 74, 22)
    ctx.fill()
    ctx.fillRect(40, 70, 420, 24)
    const lv = /^N\d$/.test(c.pl.level) ? c.pl.level : 'N5'
    text(ctx, `模試  ${lv}`, 70, 72, { f: font(900, 40, 'serif'), color: p.onLine })
    const secs = [['語彙', 'vocab'], ['文法', 'grammar'], ['読解', 'reading'], ['聴解', 'kakitori']]
    secs.forEach(([jp, line], i) => {
      const x = 62 + i * 98
      ctx.fillStyle = mix(p.line[line], cardInk(p), 0.2)
      rrect(ctx, x, 112, 88, 50, 25)
      ctx.fill()
      text(ctx, jp, x + 44, 147, { f: font(700, 30, 'jp'), color: p.ink, align: 'center' })
    })
    for (let r = 0; r < 3; r++) {
      const y = 200 + r * 66
      text(ctx, String(r + 1), 76, y + 12, { f: font(700, 32, 'latin'), color: p.ink2, align: 'center' })
      for (let k = 0; k < 4; k++) {
        const x = 136 + k * 74
        ctx.beginPath()
        ctx.arc(x, y, 22, 0, Math.PI * 2)
        if (k === [1, 3, 0][r]) {
          ctx.fillStyle = p.ink
          ctx.fill()
        } else {
          ctx.strokeStyle = alpha(p.ink2, 0.6)
          ctx.lineWidth = 4
          ctx.stroke()
        }
      }
    }
  })
  // The clock: a section is timed.
  const cx = 630, cy = 150
  ctx.fillStyle = p.ink
  rrect(ctx, cx - 18, cy - 128, 36, 30, 8)
  ctx.fill()
  ctx.beginPath()
  ctx.arc(cx, cy, 104, 0, Math.PI * 2)
  ctx.fillStyle = cardInk(p)
  ctx.fill()
  ctx.lineWidth = 14
  ctx.strokeStyle = p.ink
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(cx, cy)
  ctx.arc(cx, cy, 84, -Math.PI / 2, Math.PI * 0.35)
  ctx.closePath()
  ctx.fillStyle = alpha(ink, 0.35)
  ctx.fill()
  ctx.strokeStyle = p.ink
  ctx.lineWidth = 8
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(cx, cy)
  ctx.lineTo(cx + Math.cos(Math.PI * 0.35) * 70, cy + Math.sin(Math.PI * 0.35) * 70)
  ctx.stroke()
  // The score: a seal of the paper's own scoring.
  const sx = 640, sy = 330
  ctx.fillStyle = p.gold
  ctx.beginPath()
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2
    const r = i % 2 ? 66 : 78
    ctx.lineTo(sx + Math.cos(a) * r, sy + Math.sin(a) * r)
  }
  ctx.closePath()
  ctx.fill()
  check(ctx, sx, sy, 46, cardInk(p), p.gold)
  sparks(c, 740, 60, 18, p.gold, 1)
}
// 単語: the forgetting curve, each review lifting it, slower to fall.
function drawWords(c) {
  const { ctx, p, W } = c
  const F = W.features.words
  const ink = p.line.vocab
  const x0 = 70, y0 = 360, x1 = 780, top = 70
  ctx.strokeStyle = p.ink2
  ctx.lineWidth = 5
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(x0, 40)
  ctx.lineTo(x0, y0)
  ctx.lineTo(x1, y0)
  ctx.stroke()
  // Set to read at the card's scale: the picture is drawn smaller inside it.
  label(c, F.memory, x0 + 16, 46, { size: 34, color: p.ink2, align: 'left', weight: 500 })
  label(c, `${F.time} →`, x1, y0 + 46, { size: 34, color: p.ink2, align: 'right', weight: 500 })
  // Without a review, it falls away.
  ctx.save()
  ctx.setLineDash([12, 14])
  ctx.strokeStyle = alpha(p.ink2, 0.6)
  ctx.lineWidth = 5
  ctx.beginPath()
  ctx.moveTo(250, 250)
  ctx.quadraticCurveTo(330, 330, 470, 342)
  ctx.stroke()
  ctx.restore()
  // With each review, back to the top, and slower to fall.
  const reviews = [[x0, 260], [250, 200], [470, 140], [700, 100]]
  ctx.strokeStyle = ink
  ctx.lineWidth = 9
  ctx.lineJoin = 'round'
  ctx.beginPath()
  ctx.moveTo(x0, top)
  reviews.forEach(([x, drop], i) => {
    const next = reviews[i + 1]?.[0] ?? x1
    if (i) ctx.lineTo(x, top)
    ctx.quadraticCurveTo(x + (next - x) * 0.25, drop + 10, next, drop + (i === reviews.length - 1 ? 0 : 50))
  })
  ctx.stroke()
  reviews.slice(1).forEach(([x]) => {
    ctx.beginPath()
    ctx.arc(x, top, 24, 0, Math.PI * 2)
    ctx.fillStyle = ink
    ctx.fill()
    check(ctx, x, top, 22, ink, cardInk(p))
  })
  // The bubble that names them.
  boardCard(c, 290, 206, 226, 72, 36, faceInk(p))
  emojiAt(ctx, '🔔', 330, 242, 38)
  label(c, F.review, 360, 254, { size: 34, align: 'left', maxW: 146 })
  // The word on its card, coming back.
  const word = c.pl.funnel?.word?.t || c.pl.funnel?.pictures?.[0]?.t || c.pl.funnel?.words?.[0]?.t || '写真'
  tilt(ctx, 640, 260, 0.05, () => {
    boardCard(c, 540, 200, 220, 120, 20)
    const b = fit(ctx, word, { fam: 'jp', weight: 700, sizes: [56, 48, 40, 34], maxW: 190, maxLines: 1 })
    text(ctx, b.lines[0], 650, 260 + b.size * 0.36, { f: b.f, color: p.ink, align: 'center' })
    ctx.fillStyle = ink
    rrect(ctx, 540, 312, 220 * 0.7, 8, 4)
    ctx.fill()
  })
}
// 漢字: a character built stroke by stroke, then the words it writes.
function drawKanji(c) {
  const { ctx, p } = c
  const ink = p.line.kanji
  const f = c.pl.funnel || {}
  const st = f.strokes?.k?.s ? f.strokes : null
  const ch = st?.char || f.kanji?.c || f.chars?.[0]?.c || '字'
  const n = st ? st.k.s.d.length : 4
  const stops = [...new Set([Math.ceil(n / 4), Math.ceil(n / 2), Math.ceil((3 * n) / 4)].map(x => Math.max(1, Math.min(n - 1, x))))].slice(0, 3)
  const frames = [...stops, n]
  const words = (f.words || []).slice(0, 3)
  // Without words to show under it, the character takes the board.
  const size = words.length ? 150 : 170
  const top = words.length ? 10 : 105
  const gap = (800 - 30 - frames.length * size - 40) / (frames.length - 1)
  frames.forEach((upto, i) => {
    const x = 20 + i * (size + gap)
    const big = i === frames.length - 1
    const y = big ? top : top + 20
    const s = big ? size + 40 : size
    boardCard(c, x, y, s, s, 20, big ? mix(ink, cardInk(p), 0.08) : cardInk(p))
    if (st) strokeBox(ctx, st.k, x + 14, y + 14, s - 28, upto - 1, big ? ink : p.gold, p.ink, alpha(p.ink2, 0.25))
    else {
      ctx.save()
      ctx.beginPath()
      ctx.rect(x, y, s * (upto / n), s)
      ctx.clip()
      text(ctx, ch, x + s / 2, y + s * 0.5 + s * 0.7 * 0.36, { f: font(700, s * 0.7, 'serif'), color: big ? ink : p.ink, align: 'center' })
      ctx.restore()
    }
    if (i < frames.length - 1) arrow(ctx, x + size + 10, top + 20 + size / 2, x + size + gap - 10, top + 20 + size / 2, p.gold, 0, 5)
  })
  emojiAt(ctx, '✍️', 768, top + size + 30, 56)
  // The words it writes.
  const cw = (800 - SP[4] * (words.length - 1)) / words.length
  words.forEach((w, i) => {
    const x = i * (cw + SP[4])
    boardCard(c, x, 270, cw, 130, 24, faceInk(p))
    const tb = fit(ctx, w.t, { fam: 'jp', weight: 700, sizes: [52, 44, 36], maxW: cw - 30, maxLines: 1 })
    text(ctx, tb.lines[0], x + cw / 2, 330, { f: tb.f, color: p.ink, align: 'center' })
    if (w.reading) label(c, w.reading, x + cw / 2, 378, { size: 34, color: p.ink2, fam: 'jp', weight: 500, maxW: cw - 24 })
  })
}
// 文法: the rule, a scene, a quiz: three stops on the grammar line.
function drawGrammar(c) {
  const { ctx, p, W } = c
  const F = W.features.grammar
  const ink = p.line.grammar
  const f = c.pl.funnel || {}
  const pattern = f.point?.pattern || c.pl.caption?.point || 'は'
  ctx.fillStyle = ink
  rrect(ctx, 40, 344, 720, 12, 6)
  ctx.fill()
  const xs = [130, 400, 670]
  xs.forEach((x, i) => {
    ctx.fillStyle = cardInk(p)
    ctx.beginPath()
    ctx.arc(x, 350, 22, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = ink
    ctx.lineWidth = 8
    ctx.stroke()
    label(c, F.steps[i], x, 410, { size: 32, maxW: 250 })
  })
  // The rule.
  tilt(ctx, 130, 170, -0.04, () => {
    boardCard(c, 30, 40, 200, 250, 24)
    const b = fit(ctx, pattern, { fam: 'serif', weight: 700, sizes: [96, 80, 64, 52, 40], maxW: 170, maxLines: 2 })
    paragraph(ctx, b, 130, 165 - paragraphH(b) / 2, p.ink, 'center')
    ctx.fillStyle = ink
    rrect(ctx, 70, 250, 120, 10, 5)
    ctx.fill()
  })
  // A scene: two people talking.
  boardCard(c, 300, 30, 200, 270, 24)
  const bubble = (x, y, w, me) => {
    ctx.fillStyle = me ? mix(ink, cardInk(p), 0.2) : faceInk(p)
    rrect(ctx, x, y, w, 56, 22)
    ctx.fill()
    ctx.fillStyle = me ? ink : alpha(p.ink2, 0.6)
    rrect(ctx, x + 18, y + 18, w - 60, 8, 4)
    ctx.fill()
    rrect(ctx, x + 18, y + 32, w - 90, 8, 4)
    ctx.fill()
  }
  emojiAt(ctx, '🙂', 336, 82, 40)
  bubble(362, 56, 124, false)
  emojiAt(ctx, '🙋', 464, 176, 40)
  bubble(314, 150, 124, true)
  bubble(330, 222, 150, false)
  // A quiz: one right answer.
  tilt(ctx, 670, 170, 0.04, () => {
    boardCard(c, 570, 40, 200, 250, 24)
    for (let i = 0; i < 3; i++) {
      const y = 70 + i * 70
      const right = i === 1
      ctx.fillStyle = right ? mix(success(p), cardInk(p), 0.2) : faceInk(p)
      rrect(ctx, 588, y, 164, 54, 16)
      ctx.fill()
      if (right) check(ctx, 616, y + 27, 18, success(p), cardInk(p))
      else {
        ctx.strokeStyle = alpha(p.ink2, 0.6)
        ctx.lineWidth = 4
        ctx.beginPath()
        ctx.arc(616, y + 27, 16, 0, Math.PI * 2)
        ctx.stroke()
      }
      ctx.fillStyle = right ? success(p) : alpha(p.ink2, 0.5)
      rrect(ctx, 646, y + 23, 88, 8, 4)
      ctx.fill()
    }
  })
  sparks(c, 745, 30, 16, p.gold, 1)
}
// かな: the kana's row of the table, the kana heard and traced; free.
const GOJUON = ['あいうえお', 'かきくけこ', 'さしすせそ', 'たちつてと', 'なにぬねの', 'はひふへほ', 'まみむめも', 'やゆよ', 'らりるれろ', 'わをん', 'がぎぐげご', 'ざじずぜぞ', 'だぢづでど', 'ばびぶべぼ', 'ぱぴぷぺぽ']
const toHira = s => [...s].map(ch => (ch >= 'ァ' && ch <= 'ヶ' ? String.fromCharCode(ch.charCodeAt(0) - 0x60) : ch)).join('')
const toKata = s => [...s].map(ch => (ch >= 'ぁ' && ch <= 'ゖ' ? String.fromCharCode(ch.charCodeAt(0) + 0x60) : ch)).join('')
function drawKana(c) {
  const { ctx, p, W } = c
  const F = W.features.kana
  const ink = p.line.kana
  const K = c.pl.funnel?.kana || { k: 'あ', ro: 'a', set: 'hiragana' }
  const kata = K.set === 'katakana'
  const row = GOJUON.find(r => r.includes(toHira(K.k)))
  const tiles = row ? [...(kata ? toKata(row) : row)] : [K.k]
  // One drawing whatever the kana's place in its row: the lit tile larger,
  // its sound in a bubble over it, the pencil at its corner, the tag under
  // the row; nothing that moves with it reaches a neighbour.
  const at = Math.max(0, tiles.indexOf(K.k))
  const size = 112
  const big = 156
  const gap = 22
  const foot = 290
  let x = (800 - ((tiles.length - 1) * (size + gap) + big)) / 2
  const spots = tiles.map((k, i) => {
    const sz = i === at ? big : size
    const spot = { k, x, s: sz, y: foot - sz, lit: i === at }
    x += sz + gap
    return spot
  })
  // Its strokes only where they are this kana's (a kanji's carousel has its own).
  const st = c.pl.funnel?.strokes
  const strokes = st?.char === K.k ? st.k?.s?.d : null
  for (const t of spots) {
    boardCard(c, t.x, t.y, t.s, t.s, 22, t.lit ? ink : cardInk(p))
    if (!(t.lit && strokes?.length)) text(ctx, t.k, t.x + t.s / 2, t.y + t.s / 2 + t.s * 0.6 * 0.36, { f: font(700, t.s * 0.6, 'jp'), color: t.lit ? p.onLine : p.ink, align: 'center' })
  }
  const L = spots[at]
  const mid = L.x + L.s / 2
  // Traced: the lit kana written stroke by stroke, its last stroke under
  // way and the pencil's point where it has got to (chosen below).
  const glyph = { x: L.x + 18, y: L.y + 18, k: (L.s - 36) / 109 }
  // Heard: the speaker and the sound, in a bubble over the lit kana.
  const rf = font(700, 54, 'latin')
  const bh = 90
  const bw = 30 + 50 + SP[3] + measure(ctx, K.ro, rf) + 38
  const bx = Math.max(8, Math.min(792 - bw, mid - bw / 2))
  const by = L.y - bh - 24
  boardCard(c, bx, by, bw, bh, bh / 2)
  ctx.fillStyle = cardInk(p)
  ctx.beginPath()
  ctx.moveTo(mid - 16, by + bh - 2)
  ctx.lineTo(mid, by + bh + 18)
  ctx.lineTo(mid + 16, by + bh - 2)
  ctx.fill()
  speaker(ctx, bx + 30 + 25, by + bh / 2, 50, ink)
  text(ctx, K.ro, bx + 30 + 50 + SP[3], by + bh / 2 + 54 * 0.36, { f: rf, color: ink })
  // The price tag, flat and level, in one place under the row.
  const word = F.free.toLocaleUpperCase()
  const tf = font(700, 44, 'latin')
  const th = 82
  const tw = measure(ctx, word, tf, 0.08) + 90
  const tx = 400 - tw / 2
  const ty = foot + 34
  ctx.fillStyle = ink
  ctx.beginPath()
  ctx.moveTo(tx + 32, ty)
  ctx.lineTo(tx + tw, ty)
  ctx.lineTo(tx + tw, ty + th)
  ctx.lineTo(tx + 32, ty + th)
  ctx.lineTo(tx, ty + th / 2)
  ctx.closePath()
  ctx.fill()
  ctx.fillStyle = cardInk(p)
  ctx.beginPath()
  ctx.arc(tx + 28, ty + th / 2, 8, 0, Math.PI * 2)
  ctx.fill()
  text(ctx, word, tx + 52, ty + th / 2 + 44 * 0.36, { f: tf, color: p.onLine, tr: 0.08 })
  // The pencil over all of it, its point on the stroke being drawn and
  // its body turned where it hides the least: of the kana, the bubble, the
  // other tiles and the tag (laid out below), a writer's slant preferred.
  const keepOff = [...spots.filter(t => !t.lit).map(t => ({ x: t.x, y: t.y, w: t.s, h: t.s })), { x: bx, y: by, w: bw, h: bh + 18 }, { x: tx, y: ty, w: tw, h: th }]
  const pose = strokes?.length ? penPose(ctx, strokes, glyph, keepOff, 84) : null
  if (strokes?.length) writing(ctx, strokes, glyph, p.onLine, pose?.share)
  if (pose) pencil(ctx, pose.x, pose.y, pose.a, 84)
  else pencil(ctx, L.x + L.s - 24, L.y + L.s - 24, -Math.PI / 4, 84)
}
/** A kana being written in its box: the whole of it faint, its strokes
 *  done, its last one `share` of the way (whole where nothing can measure a
 *  path). */
function writing(ctx, strokes, box, color, share) {
  ctx.save()
  ctx.translate(box.x, box.y)
  ctx.scale(box.k, box.k)
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.lineWidth = 9
  ctx.strokeStyle = alpha(color, 0.3)
  for (const d of strokes) ctx.stroke(new Path2D(d))
  ctx.strokeStyle = color
  strokes.slice(0, -1).forEach(d => ctx.stroke(new Path2D(d)))
  const last = strokes[strokes.length - 1]
  const at = share ? pathPoint(last, share) : null
  if (at) ctx.setLineDash([at.done, at.len * 2])
  ctx.stroke(new Path2D(last))
  ctx.restore()
}
let PATHS = null
/** How long a stroke is, and the point a share of the way along it. */
function pathPoint(d, share) {
  if (typeof document === 'undefined' || !document.body) return null
  if (!PATHS) {
    PATHS = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    PATHS.setAttribute('width', '0')
    PATHS.setAttribute('height', '0')
    PATHS.style.position = 'absolute'
    document.body.appendChild(PATHS)
  }
  const el = document.createElementNS('http://www.w3.org/2000/svg', 'path')
  el.setAttribute('d', d)
  PATHS.appendChild(el)
  const len = el.getTotalLength()
  const pt = el.getPointAtLength(len * share)
  el.remove()
  return { x: pt.x, y: pt.y, len, done: len * share }
}
/** Where the pencil writes and how it leans: a point along the last
 *  stroke (near four fifths of it) and an angle a right hand holds a pencil
 *  at (from up and left to level right), the pair whose body covers the
 *  least of the kana's strokes and of the boxes to keep clear, the board's
 *  edge included. Without a document to measure strokes on: none. */
function penPose(ctx, strokes, box, keepOff, len) {
  const last = strokes[strokes.length - 1]
  const tips = [0.8, 0.66, 0.9, 0.52].map(share => ({ share, at: pathPoint(last, share) })).filter(t => t.at)
  if (!tips.length) return null
  const testable = typeof ctx.isPointInStroke === 'function' && typeof DOMPoint !== 'undefined'
  const board = testable ? ctx.getTransform() : null
  const paths = strokes.map(d => new Path2D(d))
  const inside = (r, px, py) => px > r.x - 4 && px < r.x + r.w + 4 && py > r.y - 4 && py < r.y + r.h + 4
  const writer = -Math.PI / 4
  let best = null
  for (const { share, at } of tips) {
    const x = box.x + at.x * box.k
    const y = box.y + at.y * box.k
    for (let deg = -135; deg <= 0; deg += 9) {
      const a = (deg * Math.PI) / 180
      let cost = Math.abs(a - writer) * 1.2 + Math.abs(share - 0.8) * 4
      for (let t = 0.16; t <= 1; t += 0.07) {
        const px = x + Math.cos(a) * len * t
        const py = y + Math.sin(a) * len * t
        if (px < 6 || px > 794 || py < 6 || py > 414) cost += 2
        if (keepOff.some(r => inside(r, px, py))) cost += 2
        if (!testable) continue
        const dev = board.transformPoint(new DOMPoint(px, py))
        ctx.save()
        ctx.translate(box.x, box.y)
        ctx.scale(box.k, box.k)
        ctx.lineWidth = 9 + 14
        if (paths.some(p => ctx.isPointInStroke(p, dev.x, dev.y))) cost += 3
        ctx.restore()
      }
      if (!best || cost < best.cost) best = { cost, share, x, y, a }
    }
  }
  return best
}
/** A pencil, its point at (x, y), its body running off at angle `a`. */
function pencil(ctx, x, y, a, len) {
  const w = len * 0.11
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(a)
  ctx.shadowColor = 'rgba(0,0,0,0.28)'
  ctx.shadowBlur = 8
  ctx.shadowOffsetY = 3
  const body = len * 0.62
  const cone = len * 0.2
  // Body, band, eraser, under one shadow; then the cut wood and the lead.
  ctx.fillStyle = '#f2b53a'
  ctx.fillRect(cone, -w, body, w * 2)
  ctx.shadowColor = 'transparent'
  ctx.fillStyle = '#d9962b'
  ctx.fillRect(cone, w * 0.25, body, w * 0.75)
  ctx.fillStyle = '#f7cf6a'
  ctx.fillRect(cone, -w, body, w * 0.45)
  ctx.fillStyle = '#c7c9cc'
  ctx.fillRect(cone + body, -w, len * 0.07, w * 2)
  ctx.fillStyle = '#ef8fa0'
  rrect(ctx, cone + body + len * 0.07, -w, len * 0.11, w * 2, w * 0.6)
  ctx.fill()
  ctx.fillStyle = '#f1d3a3'
  ctx.beginPath()
  ctx.moveTo(0, 0)
  ctx.lineTo(cone, -w)
  ctx.lineTo(cone, w)
  ctx.closePath()
  ctx.fill()
  ctx.fillStyle = '#2b2622'
  ctx.beginPath()
  ctx.moveTo(0, 0)
  ctx.lineTo(cone * 0.38, -w * 0.38)
  ctx.lineTo(cone * 0.38, w * 0.38)
  ctx.closePath()
  ctx.fill()
  ctx.restore()
}
/** A speaker sounding: its cone filled, two waves beside it. */
function speaker(ctx, cx, cy, s, color) {
  const x = cx - s / 2
  ctx.save()
  ctx.fillStyle = color
  ctx.strokeStyle = color
  ctx.lineWidth = s * 0.11
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.beginPath()
  ctx.moveTo(x, cy - s * 0.15)
  ctx.lineTo(x + s * 0.2, cy - s * 0.15)
  ctx.lineTo(x + s * 0.44, cy - s * 0.38)
  ctx.lineTo(x + s * 0.44, cy + s * 0.38)
  ctx.lineTo(x + s * 0.2, cy + s * 0.15)
  ctx.lineTo(x, cy + s * 0.15)
  ctx.closePath()
  ctx.fill()
  for (const r of [0.2, 0.4]) {
    ctx.beginPath()
    ctx.arc(x + s * 0.5, cy, s * r, -0.85, 0.85)
    ctx.stroke()
  }
  ctx.restore()
}
