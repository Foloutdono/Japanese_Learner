// ── 宣伝 — the promo stories (plan 231) ─────────────────────────────
// Five stories that show the app itself, 9:16, each a few frames drawn
// with the app's own parts (app.js): the pitch on Today's print, one card
// turned and rated, the analyser at work, one N5 question, and the pass.
// The card, the question and the sentence are the bank's own (a word of
// the N5 deck, a sentence of the N5 reading bank), so a story can be
// posted again with another; every figure is the bank's count
// (index.json), never written here. What a story promises is what the
// app does today: start free, the kana line free for good, no ads and no
// trackers; no frame prices a mode. The plan is pure; the frames draw.
// Since plan 281 a sixth, the duels, is a story in motion end to end:
// one sprint played, its result, the Elo it moved and the board.
import { EDGE, FS, SP, font, fit, frame, ground, hasKanji, mark, masthead, measure, palette, paragraphH, rrect, reading, roundel, text } from './draw.js'
import * as A from './app.js'
import { STRINGS, count, weldIf } from './strings.js'
import { gloss } from './common.js'
import { sentenceQuizzes } from './quizzes.js'
import { LIMIT_MS, clockOf, comboOf, multOf, points, speedNote } from '../src/domain/duel.js'

export const STORIES = ['pitch', 'card', 'analyser', 'exam', 'pass', 'duel']
export const STORY_FILES = { pitch: 'index.json', card: 'words-N5.json', analyser: 'N5.json', exam: 'N5.json', pass: 'index.json', duel: 'duel.json' }

// The words, in the two languages: the app's own where the app says it
// (locales/*: the ratings, the stages, Today's unit, Depart), the landing
// page's where the page says it (landing/strings.mjs).
export const PROMO = {
  en: {
    names: { pitch: 'The pitch', card: 'One card', analyser: 'The analyser', exam: 'Could you pass N5?', pass: 'Your pass', duel: 'Duels' },
    lists: { pitch: 'The pitch', card: 'Word', analyser: 'Sentence', exam: 'Question', pass: 'The pass', duel: 'Duels' },
    blurb: { pitch: 'From your first kana to N1, on Today’s print', pass: 'The pass, and what is free', duel: 'A two-minute sprint against another learner, and the Elo' },
    hours: { dawn: 'Dawn', day: 'Day', dusk: 'Dusk', night: 'Night' },
    hook: 'Learn Japanese, from your first kana to JLPT N1.',
    linesTitle: 'Four lines, five levels',
    lines: { kana: ['Kana', 'kana, heard and traced'], vocab: ['Vocabulary', 'words, N5 to N1'], kanji: ['Kanji', 'kanji and their strokes'], grammar: ['Grammar', 'points, a lesson each'] },
    levels: 'N5 → N1, the five levels of the JLPT',
    paceTitle: 'How long to N5?',
    paceAt: 'At 10 minutes a day, from zero:',
    span: ({ months, years, half }) => (months != null ? `≈ ${months} month${months > 1 ? 's' : ''}` : `≈ ${years}${half ? '½' : ''} year${years > 1 || half ? 's' : ''}`),
    paceNote: 'Tsuji’s estimate: one new word, kanji or point a minute. The app works out your own arrival.',
    ride: 'A ride cut to fit you.',
    start: 'Start free · no ads, no trackers',
    board: 'Board at tsuji.app',
    stillKnow: 'Do you still know this word?',
    how: 'How did it go?',
    ratings: ['Missed', 'Almost', 'Correct', 'Easy'],
    // The scheduler's forecast for a card mastered a month ago
    // (landing/strings.mjs, KNOWN): backend/srs/scheduler.py's own.
    due: ['in 2 min', 'in 10 min', 'in 80 days', 'in 90 days'],
    mastered: 'Mastered',
    mode: 'Word → meaning',
    tap: 'Tap to reveal',
    everyDay: 'Every day, the cards you were about to forget.',
    depart: 'Depart',
    unit: 'due',
    doneBy: at => `done by ${at}`,
    srs: 'Spaced repetition, nothing to set up.',
    decks: (w, k, g) => `${w} words · ${k} kanji · ${g} grammar points, N5 to N1`,
    paste: 'Paste a sentence, a YouTube link or a photo.',
    chars: n => `${n} characters`,
    analyze: 'Analyze',
    cuts: 'Tsuji cuts it word by word and numbers its grammar. A photo is read on your phone; the image never leaves it.',
    watch: 'Read the Japanese you actually watch.',
    anyText: 'A text, a photo or a YouTube link, word by word',
    examKind: 'JLPT N5 · Kanji reading',
    examAsk: 'Could you pass the JLPT N5? Try one question.',
    examMode: 'Kanji reading',
    comment: 'Answer in the comments.',
    reads: (w, r, sense) => `${w} reads ${r}: ${sense}.`,
    examFigs: e => [[String(e.questions), 'questions'], [String(e.minutes), 'minutes'], [`/${e.max}`, 'scored, official pass marks']],
    stand: 'Know where you stand before you sign up.',
    examNote: 'Official format, unofficial scoring. No question copied from a real session.',
    passWaits: 'Your pass is waiting.',
    yourName: 'Your first name',
    passBody: 'A ride cut to fit you: write your first name, board, and Tsuji prints your line.',
    free: 'Free',
    startFree: 'Start free',
    promises: [['The kana line, free for good', 'Every kana heard and traced, never a credit.'], ['No ads, no trackers', 'No sale of data, never what you type.'], ['Your data is yours', 'Export to CSV, delete in two taps.']],
    titles: {
      pitch: () => 'Learn Japanese from your first kana to JLPT N1, a little every day',
      card: c => `Do you still know ${c}? Spaced repetition, nothing to set up`,
      analyser: c => `${c} cut word by word, its grammar numbered`,
      exam: c => `Could you pass the JLPT N5? One question: ${c}`,
      pass: () => 'Your Japanese pass is waiting: start free on tsuji.app',
      duel: () => 'Japanese duels: 2 minutes against another learner, your Elo at stake',
    },
    ask: { pitch: 'Where are you on the line?', card: 'Did you know it?', analyser: 'Which sentence should Tsuji cut next?', exam: 'Your answer?', pass: 'Board today?', duel: 'Who would you challenge first?' },
    tags: ['japaneseapp', 'jlpt'],
    // The duels' story (plans 281, 281b): its own lines, then the app's
    // words on its parts (locales/: the ticket, the run's head, the race
    // and its moments, the result line by line, the Elo).
    duel: {
      hook: s => ['A duel in Japanese.', s >= 120 && s % 60 === 0 ? `${s / 60} minutes.` : `${s} seconds.`],
      versus: 'You against another learner.',
      same: 'The same questions for you both.',
      fast: top => `Answer fast: up to ${top} points.`,
      ahead: 'Get ahead on the line.',
      combo: top => `Chain right answers: up to ${top}.`,
      rush: s => `The last ${s} seconds pay double.`,
      winElo: 'Win, and your Elo goes up.',
      eloIs: 'Your Elo: your level against the others.',
      eloFrom: 'It starts from your JLPT level, then moves with every ranked sprint.',
      climb: 'Beat stronger players, climb faster.',
      ride: 'Learn by playing, against other learners.',
      modes: 'Ranked sprints or duels with friends.',
      you: 'You',
      go: 'Depart',
      kinds: { word: 'Word', reading: 'Reading', writing: 'Writing' },
      duelLevel: 'Duel level',
      lowest: 'the lower of the two',
      questions: 'Questions',
      wordsKanji: 'words and kanji',
      sprint: 'Sprint · 2 minutes',
      duelWith: who => `Duel · ${who}`,
      ready: 'Ready?',
      goBand: 'Go!',
      arrival: 'Finish!',
      rushWord: 'Rush',
      comboCap: 'Combo',
      comboLost: n => `${n} lost`,
      passMe: 'Ahead!',
      passThem: who => `${who} ahead`,
      notes: { flash: 'Flash', quick: 'Quick' },
      lines: { speed: 'Speed', combo: 'Combo', rush: 'Rush', accuracy: 'Accuracy', flashes: 'Flashes' },
      inARow: (a, b) => `${a} / ${b} in a row`,
      verdict: { win: 'Victory!', loss: 'Defeat', draw: 'Draw' },
      aheadBy: n => `ahead by ${n.toLocaleString('en')} point${n === 1 ? '' : 's'}`,
      elo: 'Elo',
      xpLeft: n => `${n} more today`,
      startAt: n => `start ${n}`,
      peak: n => `peak ${n}`,
      gapTo: (n, r) => `${n} Elo points from #${r}`,
    },
  },
  fr: {
    names: { pitch: 'L’app en bref', card: 'Une carte', analyser: 'L’analyseur', exam: 'Tu passerais le N5 ?', pass: 'Ton pass', duel: 'Les duels' },
    lists: { pitch: 'L’app en bref', card: 'Mot', analyser: 'Phrase', exam: 'Question', pass: 'Le pass', duel: 'Duels' },
    blurb: { pitch: 'Du premier kana au N1, sur l’estampe du jour', pass: 'Le pass, et ce qui est gratuit', duel: 'Un sprint de 2 minutes contre un autre apprenant, et l’Elo' },
    hours: { dawn: 'Aube', day: 'Jour', dusk: 'Soir', night: 'Nuit' },
    hook: 'Apprendre le japonais, du premier kana au JLPT N1.',
    linesTitle: 'Quatre lignes, cinq niveaux',
    lines: { kana: ['Kana', 'kana, écoutés et tracés'], vocab: ['Vocabulaire', 'mots, de N5 à N1'], kanji: ['Kanji', 'kanji et leurs traits'], grammar: ['Grammaire', 'points, une leçon chacun'] },
    levels: 'N5 → N1, les cinq niveaux du JLPT',
    paceTitle: 'Combien de temps jusqu’au N5 ?',
    paceAt: 'À 10 minutes par jour, en partant de zéro :',
    span: ({ months, years, half }) => (months != null ? `≈ ${months} mois` : `≈ ${years} an${years > 1 ? 's' : ''}${half ? ' ½' : ''}`),
    paceNote: 'Estimation de Tsuji : un mot, un kanji ou un point nouveau par minute. L’app calcule ta propre arrivée.',
    ride: 'Un trajet taillé pour toi.',
    start: 'Commence gratuitement · sans pub, sans traqueur',
    board: 'Embarquer sur tsuji.app',
    stillKnow: 'Tu connais encore ce mot ?',
    how: 'Comment ça s’est passé ?',
    ratings: ['Raté', 'Presque', 'Correct', 'Facile'],
    due: ['dans 2 min', 'dans 10 min', 'dans 80 jours', 'dans 90 jours'],
    mastered: 'Maîtrisé',
    mode: 'Mot → sens',
    tap: 'Touche pour révéler',
    everyDay: 'Chaque jour, les cartes que tu allais oublier.',
    depart: 'Embarquer',
    unit: 'à réviser',
    doneBy: at => `fini vers ${at}`,
    srs: 'La répétition espacée, sans rien régler.',
    decks: (w, k, g) => `${w} mots · ${k} kanji · ${g} points de grammaire, de N5 à N1`,
    paste: 'Colle une phrase, un lien YouTube ou une photo.',
    chars: n => `${n} caractères`,
    analyze: 'Analyser',
    cuts: 'Tsuji la découpe mot à mot et numérote sa grammaire. La photo est lue sur ton téléphone ; l’image ne le quitte pas.',
    watch: 'Lis le japonais que tu regardes vraiment.',
    anyText: 'Un texte, une photo ou un lien YouTube, mot à mot',
    examKind: 'JLPT N5 · Lecture des kanji',
    examAsk: 'Tu réussirais le JLPT N5 ? Essaie une question.',
    examMode: 'Lecture des kanji',
    comment: 'Réponds en commentaire.',
    reads: (w, r, sense) => `${w} se lit ${r} : ${sense}.`,
    examFigs: e => [[String(e.questions), 'questions'], [String(e.minutes), 'minutes'], [`/${e.max}`, 'notés, seuils officiels']],
    stand: 'Sache où tu en es avant de t’inscrire.',
    examNote: 'Au format officiel, notation non officielle. Aucune question copiée d’une vraie session.',
    passWaits: 'Ton pass t’attend.',
    yourName: 'Ton prénom',
    passBody: 'Un trajet taillé pour toi : écris ton prénom, embarque, et Tsuji imprime ta ligne.',
    free: 'Free',
    startFree: 'Commence gratuitement',
    promises: [['La ligne des kana, gratuite pour de bon', 'Chaque kana écouté et tracé, sans un crédit.'], ['Sans publicité, sans traqueur', 'Aucune revente de données, jamais ce que tu tapes.'], ['Tes données t’appartiennent', 'Exporte en CSV, supprime ton compte en deux gestes.']],
    titles: {
      pitch: () => 'Apprendre le japonais, du premier kana au JLPT N1, un peu chaque jour',
      card: c => `Tu connais encore ${c} ? La répétition espacée, sans rien régler`,
      analyser: c => `${c} découpée mot à mot, sa grammaire numérotée`,
      exam: c => `Tu réussirais le JLPT N5 ? Une question : ${c}`,
      pass: () => 'Ton pass pour le japonais t’attend : commence gratuitement sur tsuji.app',
      duel: () => 'Duels de japonais : 2 minutes contre un autre apprenant, ton Elo en jeu',
    },
    ask: { pitch: 'Tu en es où sur la ligne ?', card: 'Tu le savais ?', analyser: 'Quelle phrase Tsuji doit-il découper ensuite ?', exam: 'Ta réponse ?', pass: 'Tu embarques aujourd’hui ?', duel: 'Qui défierais-tu en premier ?' },
    tags: ['applijaponais', 'jlpt'],
    duel: {
      hook: s => ['Un duel en japonais.', s >= 120 && s % 60 === 0 ? `${s / 60} minutes.` : `${s} secondes.`],
      versus: 'Toi contre un autre apprenant.',
      same: 'Mêmes questions pour vous deux.',
      fast: top => `Réponds vite : jusqu’à ${top} points.`,
      ahead: 'Passe devant sur la ligne.',
      combo: top => `Enchaîne les bonnes réponses : jusqu’à ${top}.`,
      rush: s => `Les ${s} dernières secondes paient double.`,
      winElo: 'Gagne, et ton Elo monte.',
      eloIs: 'Ton Elo, ton niveau face aux autres.',
      eloFrom: 'Il part de ton niveau JLPT, puis bouge à chaque sprint classé.',
      climb: 'Bats plus fort que toi, grimpe plus vite.',
      ride: 'Apprends en jouant, contre d’autres apprenants.',
      modes: 'Sprints classés ou duels entre amis.',
      you: 'Toi',
      go: 'Partir',
      kinds: { word: 'Mot', reading: 'Lecture', writing: 'Écriture' },
      duelLevel: 'Niveau du duel',
      lowest: 'le plus bas des deux',
      questions: 'Questions',
      wordsKanji: 'mots et kanji',
      sprint: 'Sprint · 2 minutes',
      duelWith: who => `Duel · ${who}`,
      ready: 'À vos marques',
      goBand: 'Partez !',
      arrival: 'Arrivée !',
      rushWord: 'Rush',
      comboCap: 'Combo',
      comboLost: n => `${n} perdu`,
      passMe: 'Devant !',
      passThem: who => `${who} devant`,
      notes: { flash: 'Éclair', quick: 'Rapide' },
      lines: { speed: 'Vitesse', combo: 'Combo', rush: 'Rush', accuracy: 'Justesse', flashes: 'Éclairs' },
      inARow: (a, b) => `${a} / ${b} d’affilée`,
      verdict: { win: 'Victoire !', loss: 'Défaite', draw: 'Égalité' },
      aheadBy: n => `${n.toLocaleString('fr')} point${n === 1 ? '' : 's'} d’avance`,
      elo: 'Elo',
      xpLeft: n => `${n} encore aujourd’hui`,
      startAt: n => `départ ${n}`,
      peak: n => `pic ${n}`,
      gapTo: (n, r) => `${n} points d’Elo de la ${r === 1 ? '1re' : `${r}ᵉ`} place`,
    },
  },
}

// ── Plans (pure) ──────────────────────────────────────────────
const LEVELS = ['N5', 'N4', 'N3', 'N2', 'N1']
const DAYS_PER_MONTH = 30.4
/** Days to each level from zero at `perDay` new items a day, the kana
 *  first: landing/content.mjs's arrivals, on the bank's figures. */
export function arrivals(figures, perDay) {
  let items = figures.kanaDeck
  return LEVELS.map(level => {
    const l = figures.levels[level]
    items += l.words + l.kanji + l.grammar
    return { level, days: items / perDay }
  })
}
/** A span as the landing page says it: months up to two years, then years to the half. */
export function spanOf(days) {
  const months = Math.max(1, Math.round(days / DAYS_PER_MONTH))
  if (months < 24) return { months }
  const halves = Math.round((days / 365) * 2)
  return { years: Math.floor(halves / 2), half: halves % 2 === 1 }
}

const firstUp = s => (s ? s[0].toLocaleUpperCase() + s.slice(1) : s)
const wordKey = w => `${w.t}::${w.r}`

/** The sentence whose kanji reading a story may ask: the reading
 *  question the bank's N5 sentence can be asked, if it has one. */
function readingOf(s, data, lang) {
  return sentenceQuizzes(s, data, lang, STRINGS[lang]).find(q => q.kind === 'reading') || null
}

/** The items a story offers the picker: [{ id, jp, sub, tag }]. */
export function promoItems(story, data, lang) {
  const P = PROMO[lang] || PROMO.en
  switch (story) {
    case 'card':
      return data.words.filter(w => gloss(w, lang).length).map(w => ({ id: wordKey(w), jp: w.t, sub: gloss(w, lang)[0], tag: w.r }))
    case 'analyser':
      return data.sentences.filter(s => s.gram.some(g => data.points[g.p])).map(s => ({ id: s.id, jp: s.jp, sub: s[lang] || s.en, tag: s.p }))
    case 'exam':
      return data.sentences.filter(s => readingOf(s, data, lang)).map(s => ({ id: s.id, jp: s.jp, sub: s[lang] || s.en, tag: s.rows[s.fi]?.t || '' }))
    case 'duel':
      return [{ id: story, jp: '対戦', sub: P.blurb.duel, tag: data.level || '' }]
    default:
      return [{ id: story, jp: '辻', sub: P.blurb[story], tag: '' }]
  }
}

/** The analyser's view of a bank sentence: its tokens, each grammar
 *  point it carries numbered in the sentence's order, and the points
 *  with their gloss and the words they are made of. */
export function analysed(s, data, lang) {
  const known = s.gram.map(g => g.p).filter(p => data.points[p])
  const order = []
  const toks = s.rows.map(r => {
    const p = (r.g || []).find(x => known.includes(x))
    if (p && !order.includes(p)) order.push(p)
    const fu = r.fu && hasKanji(r.t) ? reading(r) : ''
    return { t: r.t, fu, k: r.k, point: p ? order.indexOf(p) + 1 : 0 }
  })
  const points = order.map((p, i) => {
    const at = s.rows.findIndex(r => (r.g || []).includes(p))
    const own = s.rows[at]
    // A particle is shown on the word it follows; a pattern, on its word.
    const prev = own.k === 'particle' ? s.rows.slice(0, at).reverse().find(r => r.k !== 'punct') : null
    const pt = data.points[p]
    return { n: i + 1, pattern: p.split('／')[0], level: pt.lv || 'N5', gloss: weldIf(lang, (lang === 'fr' && pt.fr) || pt.en), parts: [...(prev ? [[prev.t, 0]] : []), [own.t, 1]] }
  })
  return { toks, points }
}

// ── 対戦, the duels' story (plans 281, 281b) ─────────────────────────
// One sprint played: a real N5 paper (bank/duel.json, the duels' own
// generator) and two runs over it as the server scored them (since plan
// 281b the bank runs study/duels.py's own scoring: each answer's speed,
// the combo its streak pays and the rush of the last seconds). The
// learner takes the first question slowly, the next two at once and a
// lookalike for the fourth, then is right to the end; Hana, a level up,
// leads on her own streak until her misses break it, and the learner
// passes her just before the rush. The sprint is told in real time at its
// opening and its end, and run fast between (RACE); then the result face
// to face, line by line, and the Elo it moved by the classic expectation
// at the settled K (study/duel_elo.py); the Elo over the last ranked
// duels and the board it climbs. The two learners' names, levels and Elo
// are the story's own, a sample; the paper, the runs' scoring, the holds
// after an answer, the XP and where the Elo starts are the app's.
export const DUEL_RUN = {
  you: { level: 'N5', elo: 1212 },
  them: { name: 'Hana', level: 'N4', elo: 1282 },
  no: 412,
  // The learner's Elo after each of the twenty ranked duels before this
  // one: the last of the provisional ones (K 40), then settled (K 20).
  trend: [1056, 1077, 1059, 1082, 1101, 1084, 1106, 1126, 1107, 1128, 1146, 1157, 1148, 1160, 1170, 1183, 1175, 1187, 1198, 1212],
  // The board above the learner.
  board: [['Sora22', 1341], ['Kenta', 1296], ['aiko', 1251], ['Rin', 1219]],
}

/** The wrong choice a hurried eye takes: the first that shares a
 *  character with the right one (週聞 for 週間), else the first wrong one. */
function wrongPick(q) {
  const right = q.choices[q.answer]
  const wrong = q.choices.map((c, i) => i).filter(i => i !== q.answer)
  return wrong.find(i => [...q.choices[i]].some(ch => right.includes(ch))) ?? wrong[0]
}

/** The duels' story, played (pure): the paper's questions in the
 *  reader's language; the two runs as the server scored them, answer by
 *  answer (when it landed, what it added, the streak it left), the tile
 *  each of the learner's picked; when the lead changed hands, the tiers
 *  the learner's streak reached and the streak it broke; the result line
 *  by line, the Elo before and after, the XP, the board. */
export function duelRun(data, lang) {
  const R = DUEL_RUN
  const items = data.items.map(q => ({
    n: q.n, kind: q.kind, prompt: q.prompt, reading: q.reading || '', jp: q.kind !== 'word', answer: q.answer,
    choices: Array.isArray(q.choices) ? q.choices : (q.choices[lang] || q.choices.en),
  }))
  const answers = data.you.map(a => ({ ...a, served: a.t - a.ms, pick: a.right ? items[a.n].answer : wrongPick(items[a.n]) }))
  const their = data.them.map(a => ({ at: a.t, pts: a.scored, total: a.total }))
  // The lead changing hands, as the run stamps it: never the first lead.
  const moves = [...answers.map(a => [a.t, a.total, null]), ...their.map(x => [x.at, null, x.total])].sort((a, b) => a[0] - b[0])
  const passes = []
  let mine = 0
  let theirs = 0
  let lead = 0
  for (const [at, m, th] of moves) {
    if (m != null) mine = m
    else theirs = th
    const now = Math.sign(mine - theirs)
    if (now && now !== lead) {
      if (lead) passes.push({ at, me: now > 0 })
      lead = now
    }
  }
  // The tiers the learner's streak reached, and a streak of three or more broken.
  const tiers = []
  const broke = []
  answers.forEach((a, i) => {
    const before = answers[i - 1] ?? { streak: 0, mult: 1 }
    if (a.right && a.mult > before.mult) tiers.push({ at: a.t, mult: a.mult })
    if (!a.right && before.streak >= 3) broke.push({ at: a.t, n: before.streak })
  })
  const last = answers[answers.length - 1]
  const lines = data.lines
  const expected = 1 / (1 + 10 ** ((R.them.elo - R.you.elo) / 400))
  const delta = Math.round(data.elo.k * (1 - expected))
  const after = R.you.elo + delta
  const trend = [...R.trend.slice(1), after]
  // What the run pays in XP, the day's cap at most: the story's is the day's first.
  const raw = lines.you.rights * data.xp.right + (lines.you.answered - lines.you.rights) * data.xp.wrong
  const paid = Math.min(raw, data.xp.cap)
  const ranked = elo => [...R.board.map(([name, e]) => ({ name, elo: e, me: false })), { name: null, elo, me: true }]
    .sort((a, b) => b.elo - a.elo).map((r, i) => ({ ...r, rank: i + 1 }))
  const board = { before: ranked(R.you.elo), after: ranked(after) }
  const mineAfter = board.after.find(r => r.me)
  const ahead = board.after[mineAfter.rank - 2]
  return {
    items, answers, their, passes, tiers, broke,
    next: last.t + (last.right ? data.hold.right : data.hold.wrong),
    rules: data.rules, sprint: data.sprint, lines,
    final: { mine: last.total, theirs: their.length ? their[their.length - 1].total : 0 },
    you: R.you, them: R.them, no: R.no, level: data.level,
    top: points(0), seconds: data.sprint / 1000,
    elo: { before: R.you.elo, after, delta, start: data.elo.start[R.you.level], trend, peak: Math.max(...trend) },
    xp: { paid, left: data.xp.cap - paid, share: paid / data.xp.cap },
    board: { ...board, gap: ahead ? { elo: ahead.elo - after, rank: ahead.rank } : null },
  }
}

/** The race's line (DuelRun's reachOf): past the leader by a quarter, in
 *  steps of 250, so the trains ride the middle of it and the gap reads. */
const reachOf = (a, b) => Math.max(500, Math.ceil((Math.max(a, b) * 1.3) / 250) * 250)

/** The sprint as the story tells it, in seconds of story against ms of
 *  sprint: the count; the opening in real time, until the fifth question
 *  has been on the page a moment (`held`); the middle run fast, a
 *  time-lapse eased in from real time and back out to it; its last
 *  `tail` in real time; the arrival held while the verdict is read. */
export const RACE = { count: 1.3, held: 300, warp: 3.4, tail: 3000, arrive: 1.4 }
export function raceClock(pr) {
  const open = pr.answers[4].served + RACE.held
  const tailFrom = pr.sprint - RACE.tail
  const span = tailFrom - open
  // A cubic (Hermite) leaving and reaching the warp at real time.
  const k = (RACE.warp * 1000) / span
  const H = x => k * (x ** 3 - 2 * x ** 2 + x) + (3 * x ** 2 - 2 * x ** 3) + k * (x ** 3 - x ** 2)
  const w0 = RACE.count + open / 1000
  const w1 = w0 + RACE.warp
  const end = w1 + RACE.tail / 1000
  const m = s => {
    if (s < w0) return (s - RACE.count) * 1000
    if (s < w1) return open + span * H((s - w0) / RACE.warp)
    return Math.min(pr.sprint, tailFrom + (s - w1) * 1000)
  }
  const sOf = ms => {
    if (ms <= open) return RACE.count + ms / 1000
    if (ms >= tailFrom) return w1 + (ms - tailFrom) / 1000
    let lo = 0
    let hi = 1
    for (let i = 0; i < 40; i++) {
      const mid = (lo + hi) / 2
      if (open + span * H(mid) < ms) lo = mid
      else hi = mid
    }
    return w0 + (RACE.warp * (lo + hi)) / 2
  }
  return { open, tailFrom, w0, w1, end, length: end + RACE.arrive, m, s: sOf }
}

/** The story's beats, in order, and how long each holds (seconds): the
 *  ticket, the race (as long as raceClock makes it), the result face to
 *  face, the Elo, the Elo board, and the call to action, a story's last
 *  (`board`). */
export const DUEL_BEATS = [['ticket', 2.45], ['race', null], ['result', 5.0], ['elo', 2.5], ['ranking', 2.4], ['board', 3.5]]
const EXIT = 0.12
// When « Partir » is pressed on the ticket.
const DUEL_PRESS = 2.05
// The duel's own sounds (lib/audio/duel.js), named by sound.js's `duel`.
const fx = (at, duel) => ({ at, duel })

/** A story's plan: what its frames say, from the bank. */
export function promoPlan(story, data, id, opts) {
  const lang = opts.lang === 'fr' ? 'fr' : 'en'
  const t = STRINGS[lang]
  const P = PROMO[lang]
  const figures = opts.figures
  const base = { source: 'promo', story, lang, t, P, level: 'N5', script: 'kanji', handle: opts.handle || '', quizzes: [], slides: [], hook: null, figures, hour: opts.hour || 'day', now: opts.now || new Date() }
  const ask = weldIf(lang, P.ask[story])
  const tags = [...P.tags, 'jlptn5']
  switch (story) {
    case 'card': {
      const w = data.words.find(x => wordKey(x) === id) ?? data.words.find(x => gloss(x, lang).length)
      const sense = firstUp(gloss(w, lang)[0])
      return { ...base, id: wordKey(w), promo: { word: w.t, reading: hasKanji(w.t) ? w.r : '', sense }, title: P.titles.card(w.t), caption: { jp: `${w.t}（${w.r}）`, romaji: '', tr: sense, ask, tags, name: w.t } }
    }
    case 'analyser': {
      const s = data.sentences.find(x => x.id === id) ?? data.sentences[0]
      return { ...base, id: s.id, promo: { jp: s.jp, tr: weldIf(lang, s[lang] || s.en), ...analysed(s, data, lang) }, title: P.titles.analyser(s.jp), caption: { jp: s.jp, romaji: '', tr: s[lang] || s.en, ask, tags, name: s.jp } }
    }
    case 'exam': {
      const s = data.sentences.find(x => x.id === id && readingOf(x, data, lang)) ?? data.sentences.find(x => readingOf(x, data, lang))
      const q = readingOf(s, data, lang)
      const row = s.rows[q.stem.target]
      const sense = weldIf(lang, gloss(row, lang)[0] || '')
      // The sentence as the paper prints it: the word under its rule, bare.
      const before = q.stem.rows.slice(0, q.stem.target).map(r => r.t).join('')
      const after = q.stem.rows.slice(q.stem.target + 1).map(r => r.t).join('')
      return {
        ...base, id: s.id,
        promo: { before, word: row.t, after, choices: q.choices.map(c => c.text), right: q.right, explain: P.reads(row.t, reading(row), sense), exam: figures?.examN5 },
        title: P.titles.exam(row.t), caption: { jp: s.jp, romaji: '', tr: s[lang] || s.en, ask, tags, name: row.t },
      }
    }
    case 'duel':
      return { ...base, id: story, level: data.level, promo: duelRun(data, lang), title: P.titles.duel(), caption: { jp: '対戦', romaji: '', tr: P.names.duel, ask, tags, name: P.names.duel } }
    default:
      return { ...base, id: story, promo: {}, title: P.titles[story](), caption: { jp: '辻', romaji: '', tr: P.names[story], ask, tags, name: P.names[story] } }
  }
}

// ── Frames ────────────────────────────────────────────────────
const KANA_NUM = ['', '一', '二', '三', '四', '五', '六', '七', '八', '九']
/** A day or a month in kanji numerals, as the print's title slip sets it
 *  (domain/dayClear.js's kanjiNumber, held equal by carousel.test.js). */
export function kanjiNumber(n) {
  const tens = Math.floor(n / 10)
  return (tens ? `${tens > 1 ? KANA_NUM[tens] : ''}十` : '') + KANA_NUM[n % 10]
}

/** A story's frames: [{ key, draw(ctx) }]. Today's frames need the
 *  print loaded (`opts.print`, app.js's loadPrint); without it they stand
 *  on the print's sky alone. */
export function promoDeck(plan, fmt, opts) {
  const fr = frame(fmt)
  const p = palette(opts.ground)
  const P = plan.P
  const lang = plan.lang
  const U = fr.w / A.PHONE_W
  const DEP = 66 * U
  const FOOT = DEP + 8 * U + SP[8] + SP[6]
  const fig = plan.figures || {}
  const n = x => count(x, lang)
  const say = s => weldIf(lang, s)
  const out = []
  const add = (key, fn) => out.push({ key, draw: ctx => { ctx.save(); fn(ctx); ctx.restore() } })
  // ── The cover in motion (a clip) ──
  // A clip draws the cover again at each moment `clock.t` (seconds): each
  // part comes in as the app brings its own in (tpr-rise: up 16px from
  // nothing, cubic-bezier(0.2, 0.7, 0.2, 1)), on the print the layers
  // move as the print moves. With no clock the cover stands still, whole.
  let clock = null
  let shownPoints = () => 0
  let duelStory = null
  const ease = x => 1 - (1 - x) ** 3
  const k = (start, dur) => (clock ? ease(Math.min(1, Math.max(0, (clock.t - start) / dur))) : 1)
  const part = (c, prog, fn) => {
    if (prog >= 1) return fn()
    c.save()
    c.globalAlpha *= prog
    c.translate(0, (1 - prog) * 16 * U)
    const r = fn()
    c.restore()
    return r
  }
  const LINE = [{ color: p.line.kana, n: 4 }, { color: p.line.vocab, n: 20 }, { color: p.line.kanji, n: 10 }, { color: p.line.grammar, n: 8 }]

  // A block set in the middle of what the masthead and the foot leave:
  // drawn once off the page to measure it, then where it belongs.
  // One too tall for the room is set smaller, whole, never cut.
  const centred = (ctx, body, foot = 0) => {
    const top = fr.y + 64 + SP[7]
    const room = fr.bottom - foot - top
    const h = body(scratch(ctx), top) - top
    if (h <= room) return body(ctx, top + (room - h) / 2)
    const s = room / h
    ctx.save()
    ctx.translate(fr.cx, top)
    ctx.scale(s, s)
    ctx.translate(-fr.cx, -top)
    body(ctx, top)
    ctx.restore()
    return top + room
  }
  const lead = (ctx, str, y, color, sizes, { align = 'left', maxLines = 3, weight = 700 } = {}) => {
    const b = fit(ctx, say(str), { weight, sizes, maxW: fr.w, maxLines })
    b.lines.forEach((l, i) => text(ctx, l, align === 'center' ? fr.cx : fr.x, y + b.size * (0.8 + i * 1.18), { f: b.f, color, align }))
    return y + paragraphH(b)
  }
  const page = (ctx, i, of) => {
    ground(ctx, p, fr)
    masthead(ctx, p, fr)
    if (of > 1) text(ctx, `${i} / ${of}`, fr.right, fr.y + 64 * 0.66, { f: font(700, FS.caption, 'latin'), color: p.ink2, align: 'right' })
  }
  // Its rings reach past the pill: the whole of them inside the frame.
  // In a clip, given the moment it comes in (`at`), it rises in and then
  // waits as the app's gate waits (app.js's departButton).
  const depart = (ctx, label, at = null) => {
    const draw = ready => A.departButton(ctx, p, fr.x, fr.bottom - DEP - 8 * U, fr.w, U, label, ready)
    if (!clock || at == null) return draw(null)
    part(ctx, k(at, GATE_RISE), () => draw(Math.max(0, clock.t - at - GATE_RISE)))
  }
  // The studio's handle, under the words, unless it only names the site.
  const handle = (ctx, y) => {
    const h = (plan.handle || '').trim()
    if (!h || h.replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/$/, '').toLowerCase() === 'tsuji.app') return y
    return lead(ctx, h, y + SP[5], p.gold, [FS.lead, FS.body], { align: 'center', maxLines: 1 })
  }
  // The last frame of every story: the mark, the story's ask, the gate.
  // In a clip the mark, the ask and its note come in one after another,
  // then the gate, which waits (END below).
  const board = (ctx, i, of, head, note) => {
    page(ctx, i, of)
    centred(ctx, (c, y) => {
      part(c, k(END.mark, 0.9), () => mark(c, fr.cx - 130, y, 260, p.ink, p.gold))
      y += 260 + SP[7]
      y = part(c, k(END.head, 0.8), () => lead(c, head, y, p.ink, [FS.display * 0.62, FS.heading], { align: 'center' }))
      y = part(c, k(END.note, 0.8), () => lead(c, note, y + SP[5], p.ink2, [FS.lead, FS.body], { align: 'center', weight: 500 }))
      return part(c, k(END.note + 0.3, 0.8), () => handle(c, y))
    }, FOOT)
    depart(ctx, P.board, END.gate)
  }
  // Today on its print, full-bleed: the hour's sun as the dial, its time
  // under it, the words in the open sky, the print's own ink.
  const today = (ctx, headline, label) => {
    const pr = opts.print
    const PU = fmt.w / (pr?.scene.w || 390)
    if (pr) {
      A.drawPrint(ctx, pr, 0, 0, PU, { W: fmt.w, H: fmt.h, moving: clock?.moving, t: clock?.t })
      const now = plan.now
      part(ctx, k(0.3, 0.8), () => A.printTitle(ctx, fr.right, fr.y, PU * 0.9, { date: `${kanjiNumber(now.getMonth() + 1)}月${kanjiNumber(now.getDate())}日`, view: pr.look.view }))
      // The disc's glow breathes over seven seconds (tpr-breathe).
      const breath = clock ? 0.5 - 0.5 * Math.cos(Math.PI * Math.min(1, clock.t / 7)) : null
      part(ctx, k(0, 1.8), () => A.printDial(ctx, p, pr, fmt.w / 2, pr.frame.cy * PU, PU, { parts: LINE, count: 42, unit: P.unit, time: '≈ 14 min', end: P.doneBy('08:14'), breath }))
      // The brand and the words on a plate of the slip's washi, at the
      // print's foot (over the Depart button where there is one): the
      // sky, the mountain and the birds behind them leave no ground to
      // read on at any hour.
      const pad = SP[5]
      const b = fit(ctx, say(headline), { sizes: [FS.title, FS.lead], maxW: fr.w - 2 * pad, maxLines: 2 })
      const plateH = pad + 64 + SP[3] + paragraphH(b) + pad
      const bottom = label ? fr.bottom - DEP - 8 * U - SP[5] : fr.bottom
      const top = bottom - plateH
      part(ctx, k(1.1, 1.0), () => {
        const { ink } = A.printPlate(ctx, p, fr.x, top, fr.w, plateH, U)
        masthead(ctx, p, { ...fr, x: fr.x + pad, y: top + pad }, ink, ink)
        b.lines.forEach((l, i) => text(ctx, l, fr.x + pad, top + pad + 64 + SP[3] + b.size * (0.8 + i * 1.18), { f: b.f, color: ink }))
      })
    } else {
      ground(ctx, p, fr)
      masthead(ctx, p, fr)
      lead(ctx, headline, fr.y + 400, p.ink, [FS.title], { maxLines: 2 })
    }
    if (label) part(ctx, k(1.6, 0.8), () => depart(ctx, label))
  }
  const F = A.faceOf(p)
  const panel = (ctx, x, y, w, h, r = 6 * U) => {
    ctx.fillStyle = F.bg
    rrect(ctx, x, y, w, h, r)
    ctx.fill()
    ctx.strokeStyle = F.line
    ctx.lineWidth = U
    rrect(ctx, x + U / 2, y + U / 2, w - U, h - U, r)
    ctx.stroke()
  }

  switch (plan.story) {
    case 'pitch': {
      add('today', ctx => today(ctx, P.hook))
      add('lines', ctx => {
        page(ctx, 2, 4)
        const rows = [['kana', '仮', fig.kanaDeck], ['vocab', '語', fig.words], ['kanji', '漢', fig.kanji], ['grammar', '文', fig.points]]
        centred(ctx, (c, y) => {
          y = lead(c, P.linesTitle, y, p.ink, [FS.heading, FS.title], { maxLines: 1 })
          y += SP[7]
          const h = 84 * U
          for (const [key, jp, num] of rows) {
            const col = p.line[key]
            panel(c, fr.x, y, fr.w, h)
            c.save()
            rrect(c, fr.x, y, fr.w, h, 6 * U)
            c.clip()
            c.fillStyle = col
            c.fillRect(fr.x, y, 3 * U, h)
            c.restore()
            const x = fr.x + 20 * U
            roundel(c, x + 22 * U, y + h / 2, 22 * U, col, jp, { ink: F.ink, fam: 'serif', size: 20 * U, weight: 700 })
            const [name, what] = P.lines[key]
            const figure = n(num || 0)
            const room = fr.right - 18 * U - measure(c, figure, font(700, 34 * U, 'latin')) - SP[4] - (x + 58 * U)
            const wb = fit(c, say(what), { weight: 400, sizes: [13.12 * U, 12 * U], maxW: room, maxLines: 1, fam: 'latin' })
            text(c, name, x + 58 * U, y + 35 * U, { f: font(700, 17 * U, 'latin'), color: F.ink })
            text(c, wb.lines[0], x + 58 * U, y + 59 * U, { f: wb.f, color: F.soft })
            text(c, figure, fr.right - 18 * U, y + h / 2 + 12 * U, { f: font(700, 34 * U, 'latin'), color: F.ink, align: 'right' })
            y += h + 8 * U
          }
          return lead(c, P.levels, y + SP[5], p.ink2, [FS.lead, FS.body], { align: 'center', maxLines: 2, weight: 500 })
        })
      })
      if (fig.levels && fig.kanaDeck) {
        add('pace', ctx => {
          page(ctx, 3, 4)
          const stops = arrivals(fig, 10).map(a => [a.level, P.span(spanOf(a.days))])
          centred(ctx, (c, y) => {
            y = lead(c, P.paceTitle, y, p.ink, [FS.heading, FS.title], { maxLines: 2 })
            y = lead(c, P.paceAt, y + SP[3], p.ink2, [FS.lead, FS.body], { maxLines: 2, weight: 500 })
            y += SP[8]
            const rx = fr.x + 60
            const step = 140
            c.fillStyle = p.gold
            c.fillRect(rx - EDGE, y, EDGE * 2, step * (stops.length - 1))
            stops.forEach(([lv, span], i) => {
              const cy = y + i * step
              c.fillStyle = p.bg
              c.beginPath()
              c.arc(rx, cy, 56, 0, Math.PI * 2)
              c.fill()
              roundel(c, rx, cy, 56, i === 0 ? p.gold : p.ink2, lv, { ink: i === 0 ? p.ink : p.ink2, size: 36 })
              const z = i === 0 ? FS.display * 0.62 : FS.title
              text(c, say(span), rx + 110, cy + z * 0.36, { f: font(700, z, 'latin'), color: i === 0 ? p.ink : p.ink2 })
            })
            y += step * (stops.length - 1) + 56 + SP[8]
            return lead(c, P.paceNote, y, p.ink2, [FS.body, FS.sm], { maxLines: 3, weight: 500 })
          })
        })
      }
      add('board', ctx => board(ctx, out.length, out.length, P.ride, P.start))
      break
    }
    case 'card': {
      const pr = plan.promo
      const cardH = 290 * U
      const card = (c, y, body, hint) => A.reviewCard(c, p, fr.x, y, fr.w, cardH, U, { stage: 'mastered', stageLabel: P.mastered, foot: ['N5', P.mode], band: 1, hint, body })
      const back = c => (x, yy, w, h) => {
        const mb = fit(c, pr.sense, { weight: 800, sizes: [27.2 * U, 22 * U, 18 * U], maxW: w, maxLines: 2, fam: 'latin' })
        const mh = paragraphH(mb)
        const rz = 25 * U
        const top = yy + h / 2 - (mh + (pr.reading ? SP[3] + rz : 0)) / 2
        mb.lines.forEach((l, i) => text(c, l, x + w / 2, top + mb.size * (0.8 + i * 1.18), { f: mb.f, color: p.ink, align: 'center' }))
        if (pr.reading) text(c, pr.reading, x + w / 2, top + mh + SP[3] + rz * 0.85, { f: font(400, rz, 'jp'), color: p.ink, align: 'center' })
      }
      // In a clip the card turns at TURN, as a tap turns it: the new face
      // tipped up toward the reader (flashcard-face-turn, 300ms).
      const TURN = 4.2
      add('front', ctx => {
        page(ctx, 1, 4)
        centred(ctx, (c, y) => {
          y = part(c, k(0, 0.8), () => lead(c, P.stillKnow, y, p.ink, [FS.display * 0.66, FS.heading]))
          y += SP[7]
          const turned = clock && clock.t >= TURN
          part(c, k(0.4, 1.0), () => card(c, y, turned
            ? (x, yy, w, h) => {
              const f = Math.min(1, (clock.t - TURN) / 0.3)
              c.save()
              c.globalAlpha *= Math.min(1, f / 0.55)
              c.translate(0, yy + h / 2 + (1 - f) * 10 * U)
              c.scale(1, Math.cos((1 - f) * 0.73))
              c.translate(0, -(yy + h / 2))
              back(c)(x, yy, w, h)
              c.restore()
            }
            : (x, yy, w, h) => A.cardWord(c, p, pr.word, x + w / 2, yy + h / 2 - 10 * U, w, U, 80), turned ? null : P.tap))
          return y + cardH
        })
      })
      add('back', ctx => {
        page(ctx, 2, 4)
        centred(ctx, (c, y) => {
          card(c, y, back(c))
          y += cardH + SP[7]
          y = lead(c, P.how, y, p.ink, [FS.title], { maxLines: 1 })
          y += SP[4]
          const bar = A.ratingBar(c, p, fr.x, y + 34 * U, fr.w, U, P.ratings, { pressed: 2 })
          bar.centres.forEach((cx, i) => {
            const f = fit(c, P.due[i], { weight: 700, sizes: [12 * U, 10.5 * U], maxW: (fr.w / 4.6), maxLines: 1, fam: 'latin' })
            text(c, f.lines[0], cx, y + 20 * U, { f: f.f, color: i === 2 ? p.ink : p.ink2, align: 'center' })
          })
          return y + 34 * U + bar.h
        })
      })
      add('today', ctx => today(ctx, P.everyDay, P.depart))
      add('board', ctx => board(ctx, 4, 4, P.srs, P.decks(n(fig.words || 0), n(fig.kanji || 0), n(fig.points || 0))))
      break
    }
    case 'analyser': {
      const pr = plan.promo
      // In a clip the sentence is typed in, Analyze is pressed, and the
      // sentence comes back cut.
      const PRESS = 3.1
      const CUT = 3.5
      const pasteFrame = ctx => {
        page(ctx, 1, 3)
        centred(ctx, (c, y) => {
          y = part(c, k(0, 0.8), () => lead(c, P.paste, y, p.ink, [FS.display * 0.62, FS.heading]))
          y += SP[8]
          const h = 146 * U
          panel(c, fr.x, y, fr.w, h, 8 * U)
          const room = fr.w - 26 * U - 60 * U
          let z = 15 * U
          while (z > 11 * U && measure(c, pr.jp, font(400, z, 'jp')) > room) z -= 0.5 * U
          const chars = [...pr.jp]
          const typed = clock ? Math.round(chars.length * Math.min(1, Math.max(0, (clock.t - 0.8) / 2.0))) : chars.length
          const shown = chars.slice(0, typed).join('')
          const tw = text(c, shown, fr.x + 13 * U, y + 26 * U, { f: font(400, z, 'jp'), color: F.ink })
          // The caret, while it types.
          if (clock && clock.t < PRESS && Math.floor(clock.t * 2) % 2 === 0) {
            c.fillStyle = F.ink
            c.fillRect(fr.x + 13 * U + tw + 2 * U, y + 26 * U - z * 0.85, 1.5 * U, z * 1.05)
          }
          c.fillStyle = F.line
          c.fillRect(fr.x, y + h - 58 * U, fr.w, U)
          text(c, P.chars(typed).toLocaleUpperCase(), fr.x + 13 * U, y + h - 25 * U, { f: font(700, 9.92 * U, 'latin'), color: F.soft, tr: 0.18 })
          const bw = 92 * U
          const bh = 44 * U
          const bx = fr.right - 8 * U - bw
          const by = y + h - 51 * U
          const g = c.createLinearGradient(0, by, 0, by + bh)
          g.addColorStop(0, p.goldLit)
          g.addColorStop(1, p.goldMid)
          c.fillStyle = g
          rrect(c, bx, by, bw, bh, 6 * U)
          c.fill()
          // Pressed: the metal sinks a shade.
          if (clock && clock.t >= PRESS && clock.t < PRESS + 0.25) {
            c.fillStyle = 'rgba(0, 0, 0, 0.18)'
            rrect(c, bx, by, bw, bh, 6 * U)
            c.fill()
          }
          text(c, P.analyze, bx + bw / 2, by + bh / 2 + 6 * U, { f: font(700, 15 * U, 'latin'), color: '#1c1811', align: 'center' })
          y += h + SP[8]
          return part(c, k(0.5, 0.8), () => lead(c, P.cuts, y, p.ink2, [FS.lead, FS.body], { maxLines: 5, weight: 500 }))
        })
      }
      add('paste', ctx => {
        if (!clock || clock.t < CUT) return pasteFrame(ctx)
        // The cut comes in over the paste, its points one by one.
        const f = k(CUT, 0.4)
        if (f < 1) pasteFrame(ctx)
        ctx.save()
        ctx.globalAlpha = f
        cutFrame(ctx, i => k(CUT + 0.4 + 0.35 * i, 0.6))
        ctx.restore()
      })
      let pointsShown = null
      // The score ticks each point the cut shows: as many as its room held.
      shownPoints = () => {
        if (pointsShown == null && typeof document !== 'undefined') cutFrame(document.createElement('canvas').getContext('2d'))
        return pointsShown ?? Math.min(3, pr.points.length)
      }
      const cutFrame = (ctx, pointIn = () => 1) => {
        page(ctx, 2, 3)
        centred(ctx, (c, y) => {
          const y0 = y
          const inner = fr.w - 26 * U
          const lineH = A.analyserLine(scratch(c), p, 0, 0, inner, U, pr.toks) + 40 * U
          panel(c, fr.x, y, fr.w, lineH, 8 * U)
          A.analyserLine(c, p, fr.x + 13 * U, y + 22 * U, inner, U, pr.toks)
          y += lineH + SP[4]
          y = lead(c, pr.tr, y, p.ink2, [FS.lead, FS.body], { align: 'center', maxLines: 3, weight: 500 })
          y += SP[6]
          // As many of its points as the room holds, in the sentence's order.
          const room = fr.bottom - (fr.y + 64 + SP[7])
          let shown = 0
          pr.points.forEach((pt, i) => {
            if (y - y0 + 102 * U > room) return
            shown += 1
            y = part(c, pointIn(i), () => y + A.pointCard(c, p, fr.x, y, fr.w, U, pt) + 8 * U)
          })
          pointsShown = shown
          return y
        })
      }
      add('cut', ctx => cutFrame(ctx))
      add('board', ctx => board(ctx, 3, 3, P.watch, P.anyText))
      break
    }
    case 'exam': {
      const pr = plan.promo
      const question = (c, y) => {
        const h = 124 * U
        A.reviewCard(c, p, fr.x, y, fr.w, h, U, { stage: 'new', foot: ['N5', P.examMode], band: 0, body: (x, yy, w, hh) => {
          const s = pr.before + pr.word + pr.after
          let z = 24 * U
          while (z > 12 * U && measure(c, s, font(500, z, 'jp')) > w) z -= U
          const f = font(500, z, 'jp')
          const x0 = x + (w - measure(c, s, f)) / 2
          const by = yy + hh / 2
          text(c, s, x0, by, { f, color: p.ink })
          c.fillStyle = p.ink
          c.fillRect(x0 + measure(c, pr.before, f), by + 8 * U, measure(c, pr.word, f), 2 * U)
        } })
        return h
      }
      add('question', ctx => {
        page(ctx, 1, 3)
        centred(ctx, (c, y) => {
          part(c, k(0, 0.8), () => text(c, P.examKind.toLocaleUpperCase(), fr.x, y + FS.caption, { f: font(700, FS.caption, 'latin'), color: p.line.exam, tr: 0.18 }))
          y += FS.caption * 1.6 + SP[3]
          y = part(c, k(0.1, 0.8), () => lead(c, P.examAsk, y, p.ink, [FS.heading, FS.title]))
          y += SP[6]
          y += part(c, k(0.6, 0.9), () => question(c, y)) + SP[4]
          // The four readings in one after another.
          y += A.choiceRows(c, p, fr.x, y, fr.w, U, pr.choices, { line: p.line.exam, rowH: 48, reveal: pr.choices.map((_, i) => k(1.5 + 0.3 * i, 0.7)) })
          return part(c, k(3.2, 0.8), () => lead(c, P.comment, y + SP[5], p.ink2, [FS.body], { maxLines: 2, weight: 500 }))
        })
      })
      add('answer', ctx => {
        page(ctx, 2, 3)
        centred(ctx, (c, y) => {
          y += question(c, y) + SP[5]
          y += A.choiceRows(c, p, fr.x, y, fr.w, U, pr.choices, { line: p.line.exam, right: pr.right, answered: true }) + SP[6]
          y = lead(c, pr.explain, y, p.ink, [FS.title, FS.lead], { maxLines: 3 })
          if (!pr.exam) return y
          y += SP[6]
          const figs = P.examFigs(pr.exam)
          const fz = FS.heading
          const nw = Math.max(...figs.map(([v]) => measure(c, v, font(700, fz, 'latin'))))
          for (const [v, l] of figs) {
            text(c, v, fr.x, y + fz * 0.8, { f: font(700, fz, 'latin'), color: p.line.exam })
            const lb = fit(c, say(l), { weight: 500, sizes: [FS.lead, FS.body], maxW: fr.w - nw - SP[5], maxLines: 1, fam: 'latin' })
            text(c, lb.lines[0], fr.x + nw + SP[5], y + fz * 0.8, { f: lb.f, color: p.ink })
            y += fz * 1.15
          }
          return y
        })
      })
      add('board', ctx => board(ctx, 3, 3, P.stand, P.examNote))
      break
    }
    case 'pass': {
      add('pass', ctx => {
        page(ctx, 1, 2)
        centred(ctx, (c, y) => {
          y = part(c, k(0, 0.8), () => lead(c, P.passWaits, y, p.ink, [FS.display * 0.72, FS.heading], { maxLines: 2 }))
          y += SP[7]
          // In a clip 辶 fills on the level-up's own clock (recipes.js's
          // LEVEL_CLOCK, which its sounds are scored against), then the
          // level turns at the burst and the road starts again.
          const up = clock && clock.t >= LEVEL_UP
          const xp = !clock ? 0.12 : up ? 0.06 : fillShare(clock.t - FILL_START)
          y += part(c, k(0.4, 1.2), () => A.passCard(c, fr.x, y, fr.w, { name: P.yourName, nameInk: 'rgba(34, 36, 40, 0.45)', level: up ? 2 : 1, cls: P.free, xp })) + SP[7]
          return part(c, k(1.0, 0.8), () => lead(c, P.passBody, y, p.ink2, [FS.lead, FS.body], { maxLines: 4, weight: 500 }))
        })
      })
      add('free', ctx => {
        page(ctx, 2, 2)
        centred(ctx, (c, y) => {
          y = part(c, k(0, 0.8), () => lead(c, P.startFree, y, p.ink, [FS.heading, FS.title], { maxLines: 1 }))
          y += SP[6]
          // In a clip the promises come in one at a time (END.promise).
          P.promises.forEach(([h1, b1], i) => {
            const h = 74 * U
            part(c, k(END.promise(i), 0.7), () => {
              panel(c, fr.x, y, fr.w, h)
              const room = fr.w - 36 * U
              const hb = fit(c, say(h1), { weight: 700, sizes: [17 * U, 15 * U], maxW: room, maxLines: 1, fam: 'latin' })
              const bb = fit(c, say(b1), { weight: 400, sizes: [13.12 * U, 12 * U], maxW: room, maxLines: 1, fam: 'latin' })
              text(c, hb.lines[0], fr.x + 18 * U, y + 31 * U, { f: hb.f, color: F.ink })
              text(c, bb.lines[0], fr.x + 18 * U, y + 55 * U, { f: bb.f, color: F.soft })
            })
            y += h + 8 * U
          })
          return part(c, k(END.promise(P.promises.length), 0.8), () => handle(c, y))
        }, FOOT)
        depart(ctx, P.board, END.gate)
      })
      break
    }
    case 'duel': {
      // The story plays end to end (plans 281, 281b): each beat is drawn
      // at its own moment `s`, its parts coming in faster than a cover's,
      // its words landing one by one; a still is its beat at a moment that
      // shows it (STILL).
      const pr = plan.promo
      const D = P.duel
      const RC = raceClock(pr)
      const beats = DUEL_BEATS.map(([key, len]) => [key, len ?? RC.length])
      const clamp = x => Math.min(1, Math.max(0, x))
      const io = x => (x < 0.5 ? 4 * x ** 3 : 1 - (-2 * x + 2) ** 3 / 2)
      const at = (s, start, dur) => (s == null ? 1 : ease(clamp((s - start) / dur)))
      const HEAD = [FS.heading, FS.title]
      // Words that land one after another, 0.05s apart, each rising 14px
      // over 0.22s; `parts` [[text, ink]] each start a line, all at the
      // largest size at which the whole sets in `maxLines`.
      const setOf = (c, parts, sizes, maxLines) => {
        for (const z of sizes) {
          const blocks = parts.map(([str, ink]) => ({ ink, b: fit(c, say(str), { sizes: [z], maxW: fr.w, maxLines: 9 }) }))
          if (blocks.reduce((m, x) => m + x.b.lines.length, 0) <= maxLines || z === sizes[sizes.length - 1]) return { z, blocks }
        }
      }
      const headline = (c, parts, y, s, start = 0, { sizes = HEAD, maxLines = 3 } = {}) => {
        const { z, blocks } = setOf(c, parts, sizes, maxLines)
        let i = 0
        let line = 0
        for (const { ink, b } of blocks) {
          for (const l of b.lines) {
            const by = y + z * (0.8 + line * 1.18)
            let x = fr.x
            for (const word of l.split(' ')) {
              const f = at(s, start + i * 0.05, 0.22)
              if (f > 0) {
                c.save()
                c.globalAlpha *= f
                text(c, word, x, by + (1 - f) * 14, { f: b.f, color: ink })
                c.restore()
              }
              x += measure(c, `${word} `, b.f)
              i += 1
            }
            line += 1
          }
        }
        return y + z * (0.8 + (line - 1) * 1.18 + 0.3)
      }
      // What a block below a headline takes, measured off the page, then
      // set in the middle of the room the headline leaves.
      const below = (c, top, body) => {
        const h = body(scratch(c), 0)
        const room = fr.bottom - top
        if (h <= room) return body(c, top + (room - h) / 2)
        c.save()
        c.translate(fr.cx, top)
        c.scale(room / h, room / h)
        c.translate(-fr.cx, -top)
        body(c, top)
        c.restore()
      }
      // A tap, as a screen recording shows one: a ring that opens and fades,
      // white on the gold button, the ground's ink on an answer.
      const tap = (c, x, y, dt, ink = '#ffffff') => {
        if (!clock || dt < 0 || dt > 0.45) return
        const f = dt / 0.45
        c.save()
        c.globalAlpha *= 0.6 * (1 - f)
        c.strokeStyle = ink
        c.lineWidth = 2.5 * U
        c.beginPath()
        c.arc(x, y, (14 + 22 * ease(f)) * U, 0, Math.PI * 2)
        c.stroke()
        if (dt < 0.18) {
          c.globalAlpha = 0.35 * (1 - dt / 0.18)
          c.fillStyle = ink
          c.beginPath()
          c.arc(x, y, 14 * U, 0, Math.PI * 2)
          c.fill()
        }
        c.restore()
      }
      const lift = (c, f, fn, dy = 16 * U) => {
        if (f <= 0) return
        c.save()
        c.globalAlpha *= f
        c.translate(0, (1 - f) * dy)
        fn()
        c.restore()
      }

      // ── The ticket: the hook, the duel's ticket, « Partir » pressed ──
      const PRESS = DUEL_PRESS
      const ticket = (c, s) => {
        lift(c, at(s, 0, 0.3), () => masthead(c, p, fr), 0)
        const top = fr.y + 64 + SP[7]
        below(c, top, (cc, y) => {
          y = headline(cc, [[D.hook(pr.seconds)[0], p.ink], [D.hook(pr.seconds)[1], p.gold]], y, s, 0.05, { sizes: [FS.display, FS.display * 0.85, FS.display * 0.72], maxLines: 3 })
          y += SP[6]
          const tf = at(s, 0.5, 0.45)
          const th = A.duelTicket(scratch(cc), p, fr.x, y, fr.w, U, ticketOf(0))
          if (tf > 0) {
            cc.save()
            cc.globalAlpha *= tf
            cc.translate(fr.cx, y + th / 2 + (1 - tf) * 40 * U)
            cc.rotate((1 - tf) * -0.05)
            cc.translate(-fr.cx, -(y + th / 2))
            A.duelTicket(cc, p, fr.x, y, fr.w, U, ticketOf(s == null ? 0 : Math.max(0, 1 - Math.abs(s - 1.0) / 0.2)))
            cc.restore()
          }
          y += th + SP[5]
          const vy = y
          lift(cc, at(s, 1.1, 0.35), () => lead(cc, D.versus, vy, p.ink2, [FS.lead, FS.body], { maxLines: 2, weight: 500 }))
          y = lead(scratch(cc), D.versus, vy, p.ink2, [FS.lead, FS.body], { maxLines: 2, weight: 500 }) + SP[7]
          const press = s == null ? 0 : clamp(1 - Math.abs(s - PRESS - 0.07) / 0.09)
          const by = y
          lift(cc, at(s, 1.45, 0.35), () => A.stageButton(cc, p, fr.x, by, fr.w, U, D.go, { press }))
          if (s != null) tap(cc, fr.cx, by + 26 * U, s - PRESS)
          return by + 52 * U
        })
      }
      const ticketOf = pulse => ({
        no: pr.no, pulse,
        you: { name: D.you, level: pr.you.level }, them: { name: pr.them.name, level: pr.them.level },
        facts: [[D.duelLevel, `${pr.level} · ${D.lowest}`], [D.questions, D.wordsKanji]],
        foot: ['辻駅 発行', D.sprint],
      })

      // ── The race: the count, the sprint as played, its end ──
      const tiers = pr.rules?.tiers ?? []
      const rushMs = pr.rules?.rushMs ?? 0
      const sAt = RC.s
      const sRush = sAt(pr.sprint - rushMs)
      // Each total as it moves, and the share of its rail each train is
      // bound for then (DuelRun's Line: points as distance on a line past
      // the leader by a quarter).
      const glides = (() => {
        const moves = [...pr.answers.filter(a => a.scored > 0).map(a => ({ s: sAt(a.t), me: a.total })),
          ...pr.their.filter(x => x.pts > 0).map(x => ({ s: sAt(x.at), them: x.total }))].sort((a, b) => a.s - b.s)
        let mine = 0
        let theirs = 0
        return moves.map(mv => {
          if (mv.me != null) mine = mv.me
          else theirs = mv.them
          const reach = reachOf(mine, theirs)
          return { s: mv.s, me: mv.me != null, to: [theirs / reach, mine / reach] }
        })
      })()
      // A train glides to each new share as the app's does (0.5s,
      // --ease-out), from wherever it was when its share moved.
      const settle = A.cssEase(0.2, 0.8, 0.2, 1)
      const shares = [0, 1].map(row => glides.reduce((out, g) => (g.to[row] === (out.length ? out[out.length - 1].v : 0) ? out : [...out, { s: g.s, v: g.to[row] }]), []))
      const shareAt = (row, s) => {
        let from = 0
        let to = 0
        let start = -Infinity
        for (const g of shares[row]) {
          if (g.s > s) break
          from += (to - from) * settle(clamp((g.s - start) / 0.5))
          to = g.v
          start = g.s
        }
        return from + (to - from) * settle(clamp((s - start) / 0.5))
      }
      // What moves at each answer (a total's bump and its train's speed
      // lines) moves at most every so often while the sprint runs fast, as
      // a time-lapse keeps a moment it can show; what fades in (the
      // streak's pop, a question's page landing) only at real time, or the
      // time-lapse would flicker with it.
      const thin = (list, gap) => list.reduce((out, x) => (out.length && x - out[out.length - 1] < gap ? out : [...out, x]), [])
      const bumps = [false, true].map(me => thin(glides.filter(g => g.me === me).map(g => g.s), 0.3))
      const pops = pr.answers.map(a => sAt(a.t)).filter(x => x <= RC.w0 || x >= RC.w1)
      const tierMoves = pr.tiers.map(x => sAt(x.at))
      // The heat trail comes each time the streak pays ×2 again.
      const heatMoves = pr.answers.filter((a, i) => a.mult >= 2 && (pr.answers[i - 1]?.mult ?? 1) < 2).map(a => sAt(a.t))
      const multMoves = [...tierMoves, ...pr.broke.map(b => sAt(b.at))].sort((a, b) => a - b)
      const sinceIn = (list, s) => {
        let v = null
        for (const x of list) {
          if (x > s) break
          v = s - x
        }
        return v
      }
      const lastOf = (list, m, key) => {
        let v = null
        for (const x of list) {
          if (x[key] > m) break
          v = x
        }
        return v
      }
      const inWarp = s => s > RC.w0 && s < RC.w1
      // The stage at story moment `s` (DuelStage's render): the clock, the
      // head's sub, the combo, both trains, the gap, the bands, a change of
      // hands, the rush, the question on the page and the answer's moment.
      const raceAt = s => {
        const counting = s < RACE.count
        const over = s >= RC.end
        const m = Math.max(0, RC.m(s))
        const lastA = lastOf(pr.answers, m, 't')
        const mine = lastA?.total ?? 0
        const theirs = lastOf(pr.their, m, 'at')?.total ?? 0
        const reach = reachOf(mine, theirs)
        const lead = mine - theirs
        const brk = pr.broke.map(b => ({ s: sAt(b.at), n: b.n })).filter(b => s >= b.s && s - b.s < 1.1).pop()
        const streak = lastA?.streak ?? 0
        const combo = comboOf(streak, tiers)
        const tierS = sinceIn(tierMoves, s)
        const ps = pr.passes.map(x => ({ ...x, s: sAt(x.at) })).filter(x => s >= x.s && s - x.s < 1.5).pop()
        const rush = !counting && !over && m >= pr.sprint - rushMs
        // While the sprint runs fast, the page shows a question a beat.
        const mq = inWarp(s) ? Math.max(0, RC.m(RC.w0 + Math.floor((s - RC.w0) / 0.15) * 0.15)) : m
        const qi = mq >= pr.next ? pr.answers.length : pr.answers.reduce((k, a, i) => (a.served <= mq ? i : k), 0)
        const qa = pr.answers[qi] ?? null
        const served = qa ? qa.served : pr.next
        const flash = qa && mq >= qa.t ? qa : null
        const qMs = Math.max(0, mq - served)
        const fxA = !counting && !inWarp(s) ? pr.answers.filter(a => !inWarp(sAt(a.t)) && s >= sAt(a.t) && s - sAt(a.t) < 0.9).pop() : null
        const count = s < 0.5 ? 3 : s < 0.9 ? 2 : 1
        return {
          counting, over, m, count, countSince: s - (count === 3 ? 0.1 : count === 2 ? 0.5 : 0.9),
          sub: counting ? D.ready : clockOf(Math.ceil((pr.sprint - m) / 1000)),
          clock: 1 - m / pr.sprint,
          ring: {
            streak: brk && !streak ? 0 : streak, mult: combo.mult, share: combo.share, cap: D.comboCap,
            multText: combo.mult > 1 ? multOf(combo.mult, lang) : '', lost: brk && !streak ? D.comboLost(brk.n) : null,
            since: { n: sinceIn(pops, s), mult: sinceIn(multMoves, s), tier: tierS != null && tierS < 0.9 ? tierS : null, broke: brk ? s - brk.s : null },
          },
          rows: [
            { who: pr.them.name, fig: n(theirs), me: false, at: shareAt(0, s), gained: sinceIn(bumps[0], s) },
            { who: D.you, fig: n(mine), me: true, at: shareAt(1, s), gained: sinceIn(bumps[1], s), mult: combo.mult, heat: sinceIn(heatMoves, s) ?? 1 },
          ],
          gap: lead ? { row: lead > 0 ? 0 : 1, from: (lead > 0 ? theirs : mine) / reach, span: Math.abs(lead) / reach, fig: `−${n(Math.abs(lead))}`, mine: lead > 0 } : null,
          band: counting ? null : over ? { word: D.arrival, finish: true, t: s - RC.end } : m < 1000 ? { word: D.goBand, t: m / 1000 } : null,
          pass: ps ? { me: ps.me, jp: '追い越し', word: ps.me ? D.passMe : D.passThem(pr.them.name), t: s - ps.s } : null,
          rush: rush ? { word: D.rushWord, mult: multOf(2, lang), t: s - sRush } : null,
          q: pr.items[qi], flash, landed: inWarp(s) ? 1 : s - sAt(served), flashSince: flash ? s - sAt(flash.t) : 1,
          worth: flash ? flash.pts : points(qMs), share: flash ? 0 : Math.max(0, 1 - qMs / LIMIT_MS),
          fx: fxA ? { a: fxA, t: s - sAt(fxA.t) } : null,
        }
      }
      // The words over the race: the same questions, then speed, the line
      // from the third answer on (where the learner passes), the combo as
      // the sprint runs fast, the rush in its last seconds.
      const RACE_HEAD = [FS.title, FS.lead]
      const topMult = Math.max(1, ...tiers.map(x => x.mult))
      const RACE_WORDS = [D.same, D.fast(pr.top), D.ahead, D.combo(multOf(topMult, lang)), D.rush(rushMs / 1000)]
      const RACE_AT = [0, RACE.count, sAt(pr.answers[2].t), RC.w0, sRush]
      const headH = c => Math.max(...RACE_WORDS.map(str => {
        const { z, blocks } = setOf(c, [[str, p.ink]], RACE_HEAD, 2)
        return z * (0.8 + (blocks.reduce((k, x) => k + x.b.lines.length, 0) - 1) * 1.18 + 0.3)
      }))
      // The screen as the stage lays it out (CSS px): the head, the race
      // (2px more in the rush), the page with what is left, at least 120,
      // and the dock under the thumb; at the size that holds them.
      const NEED = 52 + 12 + 130 + 12 + 120 + 12 + 304
      const race = (c, s) => {
        let say1 = 0
        RACE_AT.forEach((from, i) => { if (s >= from) say1 = i })
        headline(c, [[RACE_WORDS[say1], p.ink]], fr.y, s, RACE_AT[say1], { sizes: RACE_HEAD, maxLines: 2 })
        const y0 = fr.y + headH(c) + SP[4]
        const us = Math.min(U, (fr.bottom - y0) / NEED)
        const sw = A.PHONE_W * us
        const sx = fr.cx - sw / 2
        const st = raceAt(s)
        const dockTop = y0 + (NEED - (st.counting ? 24 : 304)) * us
        lift(c, at(s, 0, 0.25), () => {
          // The answers stand on the ground itself: the story keeps one
          // even background where the app docks them on its sumi panel.
          A.stageHead(c, p, sx, y0, sw, us, { where: D.duelWith(pr.them.name), sub: st.sub, rush: Boolean(st.rush) })
          if (!st.counting) A.comboRing(c, p, sx + sw + 4 * us, y0, us, st.ring)
          const raceY = y0 + 64 * us
          const line = A.raceLine(c, p, sx, raceY, sw, us, { clock: st.clock, rows: st.rows, gap: st.gap, band: st.band, pass: st.pass, rush: st.rush, t: s })
          const py = raceY + line.h + 12 * us
          const ph = dockTop - 12 * us - py
          if (st.counting) {
            A.duelPage(c, p, sx, py, sw, ph, us, { count: st.count, since: st.countSince })
            return
          }
          // The arrival puts the question away (.pvp-run--done, 0.3s).
          const away = st.over ? clamp((s - RC.end) / 0.3) : 0
          const { q, flash } = st
          const verdict = flash ? (flash.right ? 'right' : 'wrong') : null
          A.duelPage(c, p, sx, py, sw, ph, us, {
            kind: D.kinds[q.kind], prompt: q.prompt, reading: q.kind === 'word' ? q.reading : '',
            worth: st.worth, share: st.share, verdict, since: st.landed, dim: 1 - 0.55 * away,
          })
          const dock = A.duelTiles(c, p, sx, dockTop + 12 * us, sw, us, { choices: q.choices, jp: q.jp, picked: flash?.pick ?? null, verdict, since: st.flashSince, dim: 1 - 0.7 * away })
          if (st.fx) {
            // The answer's moment where it was given: its note and the
            // points flying to where the learner's train then was.
            const { a, t } = st.fx
            const tile = dock.tiles[a.pick]
            const spot = A.trainSpot(sx, raceY, sw, us, { rush: a.t >= pr.sprint - rushMs, row: 1, at: shareAt(1, sAt(a.t)) })
            const note = speedNote(a.pts)
            const tags = [...(a.mult > 1 ? [multOf(a.mult, lang)] : []), ...(a.rush > 0 ? [D.rushWord.toLowerCase()] : [])]
            A.answerFx(c, p, tile, us, {
              t, right: a.right,
              note: note ? [note === 'flash' ? '神速' : '快速', D.notes[note], note === 'flash'] : null,
              fly: a.scored > 0 ? { text: `+${n(a.scored)}`, tags, hot: a.mult >= 2 || a.rush > 0 } : null,
              to: { x: spot.x + 72 * us, y: spot.y - 6 * us },
            })
            tap(c, tile.x + tile.w * 0.3, tile.y + tile.h / 2, t, p.ink)
          }
        }, 0)
        // The rush warms the screen's edge.
        if (st.rush) A.warmEdge(c, p, 0, 0, fr.W, fr.H, us, s)
      }

      // ── The result face to face (E4): the two runs line by line, the
      // verdict and its grade, the Elo and the XP it paid ──
      const L = pr.lines
      const pc = v => v.toLocaleString(lang === 'fr' ? 'fr-FR' : 'en-US', { style: 'percent', maximumFractionDigits: 0 })
      const rightShare = l => l.rights / Math.max(1, l.answered)
      const BARS = [
        { k: D.lines.speed, a: L.you.speed, b: L.them.speed, show: n },
        ...(pr.rules ? [
          { k: D.lines.combo, sub: D.inARow(L.you.best, L.them.best), a: L.you.combo, b: L.them.combo, show: n },
          { k: D.lines.rush, a: L.you.rush, b: L.them.rush, show: n },
        ] : []),
        { k: D.lines.accuracy, a: rightShare(L.you), b: rightShare(L.them), show: pc },
        { k: D.lines.flashes, a: L.you.flashes, b: L.them.flashes, show: n },
      ]
      // The ending shows a moment after its headline starts.
      const E4_AT = 0.15
      const margin = pr.final.mine - pr.final.theirs
      const outcome = margin > 0 ? 'win' : margin < 0 ? 'loss' : 'draw'
      const result = (c, s) => {
        const top = headline(c, [[D.winElo, p.ink]], fr.y, s) + SP[6]
        const o = {
          t: s == null ? null : s - E4_AT, mine: pr.final.mine, theirs: pr.final.theirs, you: D.you, them: pr.them.name,
          heat: comboOf(L.you.best, tiers).mult, bars: BARS, outcome, word: D.verdict[outcome], margin: outcome === 'win' ? D.aheadBy(margin) : '',
          grade: L.you.grade, elo: { after: pr.elo.after, delta: pr.elo.delta }, eloKey: D.elo,
          xp: pr.xp.paid, xpLeft: D.xpLeft(pr.xp.left), xpShare: pr.xp.share, fmt: n,
        }
        below(c, top, (cc, y) => y + A.versus(cc, p, fr.x, y, fr.w, U, o))
      }

      // ── The Elo: where it started, the curve it drew ──
      const elo = (c, s) => {
        let y = headline(c, [[D.eloIs, p.ink]], fr.y, s)
        y += SP[4]
        let subB = lead(scratch(c), D.eloFrom, y, p.ink2, [FS.lead, FS.body], { maxLines: 3, weight: 500 })
        lift(c, at(s, 0.35, 0.35), () => { subB = lead(c, D.eloFrom, y, p.ink2, [FS.lead, FS.body], { maxLines: 3, weight: 500 }) })
        below(c, subB + SP[6], (cc, yy) => {
          const drawn = s == null ? 1 : io(clamp((s - 0.55) / 1.0))
          const tr = pr.elo.trend
          const pos = drawn * (tr.length - 1)
          const i = Math.min(tr.length - 2, Math.floor(pos))
          const v = Math.round(tr[i] + (tr[i + 1] - tr[i]) * (pos - i))
          let h = 209.42 * U
          lift(cc, at(s, 0.2, 0.3), () => {
            h = A.eloCard(cc, p, fr.x, yy, fr.w, U, {
              cap: D.elo, fig: n(v), trend: tr, start: pr.elo.start, drawn,
              foot: [D.startAt(n(pr.elo.start)), D.peak(n(pr.elo.peak))], footShow: at(s, 1.5, 0.3),
            })
          })
          return yy + h
        })
      }

      // ── The Elo board, climbed a place ──
      const ranking = (c, s) => {
        const top = headline(c, [[D.climb, p.ink]], fr.y, s) + SP[6]
        const before = pr.board.before
        const after = pr.board.after
        const swap = s == null ? 1 : io(clamp((s - 1.0) / 0.4))
        const value = s == null ? 1 : io(clamp((s - 0.8) / 0.3))
        const rows = before.map(r => {
          const was = r.rank
          const now = after.find(x => x.me === r.me && x.name === r.name).rank
          const dy = (now - was) * 55 * swap
          const elo = r.me ? Math.round(pr.elo.before + pr.elo.delta * value) : r.elo
          return { rank: swap < 0.5 ? was : now, name: r.me ? D.you : r.name, elo: n(elo), me: r.me, dy }
        })
        const gap = pr.board.gap
        const foot = gap ? D.gapTo(n(gap.elo), gap.rank) : ''
        below(c, top, (cc, y) => {
          lift(cc, at(s, 0.1, 0.3), () => A.boardRows(cc, p, fr.x, y, fr.w, U, rows, { foot, footShow: at(s, 1.5, 0.3) }))
          return y + A.boardRows(scratch(cc), p, fr.x, y, fr.w, U, rows, { foot })
        })
      }

      // ── The call to action: the mark, its words, the gate ──
      const gate = ctx => board(ctx, 1, 1, D.ride, D.modes)

      const scenes = { ticket, race, result, elo, ranking }
      // The race's still: the last answer of its last seconds, its note and
      // its points leaving the tile it washed, before the next question
      // comes; the rush on and the combo at its height.
      const late = pr.answers.findLast(a => sAt(a.t) > RC.w1)
      const STILL = { ticket: 1.9, race: late ? sAt(late.t) + 0.28 : RC.w1 + 1, result: beats[2][1], elo: 2.5, ranking: 2.4 }
      for (const [key] of beats) {
        add(key, ctx => {
          if (key === 'board') return gate(ctx)
          ground(ctx, p, fr)
          // The ticket's cover clip holds once « Partir » is let go.
          scenes[key](ctx, clock ? (key === 'ticket' ? Math.min(clock.t, PRESS + 0.25) : clock.t) : STILL[key])
        })
      }
      const total = beats.reduce((t, [, len]) => t + len, 0)
      const gateAt = total - beats[beats.length - 1][1]
      // Its sounds: « Partir » pressed, then the duel's own as the run
      // plays them (lib/audio/duel.js): the count and « Partez ! », each
      // answer heard in real time, a streak broken, each tier, the first
      // change of hands in a while, the rush coming, the arrival; the
      // result's (DuelEnd's clock): VS, each line for the side that won
      // it, the verdict, the grade, the XP; the gate's. No music.
      const r0 = beats[0][1]
      const e0 = r0 + RC.length + E4_AT
      // A change of hands is said once in 2.5s at most (duel.js's PASS_GAP).
      const said = []
      for (const x of pr.passes) {
        const s = sAt(x.at)
        if (!said.length || s - said[said.length - 1].s >= 2.5) said.push({ s, me: x.me })
      }
      const sounds = [
        { at: PRESS, key: 'click' },
        ...[0.1, 0.5, 0.9].map(t => fx(r0 + t, 'count')), fx(r0 + RACE.count, 'go'),
        ...pr.answers.filter(a => !inWarp(sAt(a.t))).map(a => fx(r0 + sAt(a.t), a.right ? (a.pts >= 100 ? 'flash' : 'right') : 'wrong')),
        ...pr.broke.map(b => fx(r0 + sAt(b.at) + 0.1, 'broke')),
        ...pr.tiers.map(x => fx(r0 + sAt(x.at) + 0.1, x.mult >= 3 ? 'tier3' : 'tier')),
        ...said.map(x => fx(r0 + x.s, x.me ? 'pass' : 'passed')),
        ...(pr.rules ? [fx(r0 + sRush - 0.9, 'rush')] : []), fx(r0 + RC.end, 'arrival'),
        fx(e0 + 0.05, 'vs'), ...BARS.map((b, k) => fx(e0 + A.E4.bar + k * A.E4.step, b.a >= b.b ? 'barMe' : 'barThem')),
        ...(outcome === 'draw' ? [] : [fx(e0 + A.E4.verdict, outcome)]), ...(L.you.grade ? [fx(e0 + A.E4.grade, 'stamp')] : []), fx(e0 + A.E4.gains + 0.05, 'xp'),
        ...endScoreOf(plan).map(x => ({ ...x, at: gateAt + x.at })),
      ]
      duelStory = {
        seconds: total,
        fps: CLIP.fps,
        print: false,
        sounds,
        draw: (ctx, t) => {
          let start = 0
          for (const [key, len] of beats) {
            if (t < start + len || key === 'board') {
              const s = t - start
              ctx.save()
              clock = { t: s }
              try {
                if (key === 'board') gate(ctx)
                else {
                  ground(ctx, p, fr)
                  const exit = clamp((s - (len - EXIT)) / EXIT)
                  if (exit > 0) {
                    ctx.globalAlpha *= 1 - exit
                    ctx.translate(0, -28 * exit)
                  }
                  scenes[key](ctx, s)
                }
              } finally {
                clock = null
                ctx.restore()
              }
              return
            }
            start += len
          }
        },
      }
      break
    }
    default:
  }
  // The cover and the call to action in motion: CLIP.seconds of each,
  // drawn at each moment. `clip` is the cover's.
  const inMotion = (slide, print, sounds) => ({
    ...CLIP,
    print,
    get sounds() { return sounds() },
    draw: (ctx, t, moving = null) => {
      clock = { t, moving }
      try { slide.draw(ctx) } finally { clock = null }
    },
  })
  out.clips = {
    cover: inMotion(out[0], plan.story === 'pitch', () => scoreOf(plan, shownPoints())),
    end: inMotion(out[out.length - 1], false, () => endScoreOf(plan)),
    // The duels' story whole (plan 281): every beat, one after another.
    ...(duelStory ? { story: duelStory } : {}),
  }
  out.clip = out.clips.cover
  return out
}

/** A cover clip's length and rate: seven seconds, at thirty frames. */
export const CLIP = { seconds: 7, fps: 30 }

// The call to action's clock: the mark, the ask, its note, then the
// gate at GATE, risen GATE_RISE later and waiting from then on, so its
// idle nudge (four seconds untaken) falls inside the clip. On the pass
// story's last frame the three promises come in where the ask's note would.
const GATE_RISE = 0.6
export const END = { mark: 0, head: 0.5, note: 0.9, gate: 1.6, promise: i => 0.5 + 0.3 * i }

// The level-up's clock (src/lib/audio/recipes.js, LEVEL_CLOCK, held equal
// by carousel.test.js): the road fills for FILL_SPAN along FILL_CURVE,
// and the burst lands BURST_AT - FILL_FROM after the fill starts.
export const LEVEL = { FILL_FROM: 0.55, FILL_SPAN: 1.6, FILL_CURVE: [0.45, 0, 0.85, 0.65], BURST_AT: 2.28 }
const FILL_START = 2.0
const LEVEL_UP = FILL_START + LEVEL.BURST_AT - LEVEL.FILL_FROM
/** The share of the road filled `s` seconds into the fill: the CSS curve. */
const fillShare = s => A.cssEase(...LEVEL.FILL_CURVE)(s / LEVEL.FILL_SPAN)

/** Each story's cover scored with the app's own sounds (sound.js): the
 *  event the app plays for that moment, at the moment the clip shows it. */
function scoreOf(plan, points = 0) {
  switch (plan.story) {
    case 'pitch':
      // The platform's sign lands as the dial rises; the hour board flaps as the plate comes in.
      return [{ at: 0.1, key: 'platform-chime' }, { at: 1.1, key: 'board-flap' }]
    case 'card':
      // The card arriving, then turned.
      return [{ at: 0.4, key: 'card-transition' }, { at: 4.2, key: 'card-flip' }]
    case 'analyser': {
      // Each character a soft press, Analyze pressed, the sentence back cut, a point at a time.
      const chars = [...plan.promo.jp].length
      const keys = Array.from({ length: chars }, (_, i) => ({ at: 0.8 + (2.0 * (i + 0.5)) / chars, key: 'click', gain: 0.35 }))
      const ticks = Array.from({ length: points }, (_, i) => ({ at: 3.9 + 0.35 * i, key: 'toggle', gain: 0.7 }))
      return [...keys, { at: 3.1, key: 'click' }, { at: 3.5, key: 'card-transition' }, ...ticks]
    }
    case 'exam':
      // The question laid down, then each reading in with a press.
      return [{ at: 0.6, key: 'card-transition' }, ...[0, 1, 2, 3].map(i => ({ at: 1.5 + 0.3 * i, key: 'click', gain: 0.6 }))]
    case 'pass':
      // The gate's punch as the pass comes in, then the level-up's build and its burst.
      return [{ at: 0.4, key: 'pass-clip' }, { at: FILL_START, key: 'level-charge' }, { at: LEVEL_UP, key: 'level-burst' }]
    case 'duel':
      // « Partir » pressed: the stage's one sound (DuelRun's playClick).
      return [{ at: DUEL_PRESS, key: 'click' }]
    default:
      return []
  }
}

/** The call to action scored: the ask lands as the board's flap (or each
 *  promise ticks in), and the gate opens on the platform's chime. */
function endScoreOf(plan) {
  const lead = plan.story === 'pass'
    ? plan.P.promises.map((_, i) => ({ at: END.promise(i) + 0.1, key: 'toggle', gain: 0.7 }))
    : [{ at: END.head + 0.1, key: 'board-flap' }]
  return [...lead, { at: END.gate + 0.1, key: 'platform-chime' }]
}

let pad = null
/** A canvas off the page, to measure a block before it is placed (the
 *  slide's own context where there is no page: node's tests). */
function scratch(ctx) {
  if (typeof document === 'undefined') return ctx
  if (!pad) {
    pad = document.createElement('canvas').getContext('2d')
    pad.fillText = () => {}
  }
  return pad
}
