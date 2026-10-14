// ── 宣伝 — the promo stories (plan 212) ─────────────────────────────
// Five stories that show the app itself, 9:16, each a few frames drawn
// with the app's own parts (app.js): the pitch on Today's print, one card
// turned and rated, the analyser at work, one N5 question, and the pass.
// The card, the question and the sentence are the bank's own (a word of
// the N5 deck, a sentence of the N5 reading bank), so a story can be
// posted again with another; every figure is the bank's count
// (index.json), never written here. What a story promises is what the
// app does today: start free, the kana line free for good, no ads and no
// trackers; no frame prices a mode. The plan is pure; the frames draw.
import { EDGE, FS, SP, font, fit, frame, ground, hasKanji, mark, masthead, measure, palette, paragraphH, rrect, reading, roundel, text } from './draw.js'
import * as A from './app.js'
import { STRINGS, count, weldIf } from './strings.js'
import { gloss } from './common.js'
import { sentenceQuizzes } from './quizzes.js'

export const STORIES = ['pitch', 'card', 'analyser', 'exam', 'pass']
export const STORY_FILES = { pitch: 'index.json', card: 'words-N5.json', analyser: 'N5.json', exam: 'N5.json', pass: 'index.json' }

// The words, in the two languages: the app's own where the app says it
// (locales/*: the ratings, the stages, Today's unit, Depart), the landing
// page's where the page says it (landing/strings.mjs).
export const PROMO = {
  en: {
    names: { pitch: 'The pitch', card: 'One card', analyser: 'The analyser', exam: 'Could you pass N5?', pass: 'Your pass' },
    lists: { pitch: 'The pitch', card: 'Word', analyser: 'Sentence', exam: 'Question', pass: 'The pass' },
    blurb: { pitch: 'From your first kana to N1, on Today’s print', pass: 'The pass, and what is free' },
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
    ratings: ['Wrong', 'Almost', 'Difficult', 'Correct'],
    // The scheduler's forecast for a card mastered a month ago
    // (landing/strings.mjs, KNOWN): backend/srs/scheduler.py's own.
    due: ['in 3 min', 'in 10 min', 'in 2 months', 'in 3 months'],
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
    },
    ask: { pitch: 'Where are you on the line?', card: 'Did you know it?', analyser: 'Which sentence should Tsuji cut next?', exam: 'Your answer?', pass: 'Board today?' },
    tags: ['japaneseapp', 'jlpt'],
  },
  fr: {
    names: { pitch: 'L’app en bref', card: 'Une carte', analyser: 'L’analyseur', exam: 'Tu passerais le N5 ?', pass: 'Ton pass' },
    lists: { pitch: 'L’app en bref', card: 'Mot', analyser: 'Phrase', exam: 'Question', pass: 'Le pass' },
    blurb: { pitch: 'Du premier kana au N1, sur l’estampe du jour', pass: 'Le pass, et ce qui est gratuit' },
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
    ratings: ['Raté', 'Presque', 'Difficile', 'Correct'],
    due: ['dans 3 min', 'dans 10 min', 'dans 2 mois', 'dans 3 mois'],
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
    },
    ask: { pitch: 'Tu en es où sur la ligne ?', card: 'Tu le savais ?', analyser: 'Quelle phrase Tsuji doit-il découper ensuite ?', exam: 'Ta réponse ?', pass: 'Tu embarques aujourd’hui ?' },
    tags: ['applijaponais', 'jlpt'],
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
  const depart = (ctx, label) => A.departButton(ctx, p, fr.x, fr.bottom - DEP - 8 * U, fr.w, U, label)
  // The studio's handle, under the words, unless it only names the site.
  const handle = (ctx, y) => {
    const h = (plan.handle || '').trim()
    if (!h || h.replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/$/, '').toLowerCase() === 'tsuji.app') return y
    return lead(ctx, h, y + SP[5], p.gold, [FS.lead, FS.body], { align: 'center', maxLines: 1 })
  }
  // The last frame of every story: the mark, the story's ask, the gate.
  const board = (ctx, i, of, head, note) => {
    page(ctx, i, of)
    centred(ctx, (c, y) => {
      mark(c, fr.cx - 130, y, 260, p.ink, p.gold)
      y += 260 + SP[7]
      y = lead(c, head, y, p.ink, [FS.display * 0.62, FS.heading], { align: 'center' })
      y = lead(c, note, y + SP[5], p.ink2, [FS.lead, FS.body], { align: 'center', weight: 500 })
      return handle(c, y)
    }, FOOT)
    depart(ctx, P.board)
  }
  // Today on its print, full-bleed: the hour's sun as the dial, its time
  // under it, the words in the open sky, the print's own ink.
  const today = (ctx, headline, label) => {
    const pr = opts.print
    const PU = fmt.w / (pr?.scene.w || 390)
    if (pr) {
      A.drawPrint(ctx, pr, 0, 0, PU, { W: fmt.w, H: fmt.h })
      const now = plan.now
      A.printTitle(ctx, fr.right, fr.y, PU * 0.9, { date: `${kanjiNumber(now.getMonth() + 1)}月${kanjiNumber(now.getDate())}日`, view: pr.look.view })
      A.printDial(ctx, p, pr, fmt.w / 2, pr.frame.cy * PU, PU, { parts: LINE, count: 42, unit: P.unit, time: '≈ 14 min', end: P.doneBy('08:14') })
      // The brand and the words on a plate of the slip's washi, at the
      // print's foot (over the Depart button where there is one): the
      // sky, the mountain and the birds behind them leave no ground to
      // read on at any hour.
      const pad = SP[5]
      const b = fit(ctx, say(headline), { sizes: [FS.title, FS.lead], maxW: fr.w - 2 * pad, maxLines: 2 })
      const plateH = pad + 64 + SP[3] + paragraphH(b) + pad
      const bottom = label ? fr.bottom - DEP - 8 * U - SP[5] : fr.bottom
      const top = bottom - plateH
      const { ink } = A.printPlate(ctx, p, fr.x, top, fr.w, plateH, U)
      masthead(ctx, p, { ...fr, x: fr.x + pad, y: top + pad }, ink, ink)
      b.lines.forEach((l, i) => text(ctx, l, fr.x + pad, top + pad + 64 + SP[3] + b.size * (0.8 + i * 1.18), { f: b.f, color: ink }))
    } else {
      ground(ctx, p, fr)
      masthead(ctx, p, fr)
      lead(ctx, headline, fr.y + 400, p.ink, [FS.title], { maxLines: 2 })
    }
    if (label) depart(ctx, label)
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
      add('front', ctx => {
        page(ctx, 1, 4)
        centred(ctx, (c, y) => {
          y = lead(c, P.stillKnow, y, p.ink, [FS.display * 0.66, FS.heading])
          y += SP[7]
          card(c, y, (x, yy, w, h) => A.cardWord(c, p, pr.word, x + w / 2, yy + h / 2 - 10 * U, w, U, 80), P.tap)
          return y + cardH
        })
      })
      add('back', ctx => {
        page(ctx, 2, 4)
        centred(ctx, (c, y) => {
          card(c, y, (x, yy, w, h) => {
            const mb = fit(c, pr.sense, { weight: 800, sizes: [27.2 * U, 22 * U, 18 * U], maxW: w, maxLines: 2, fam: 'latin' })
            const mh = paragraphH(mb)
            const rz = 25 * U
            const top = yy + h / 2 - (mh + (pr.reading ? SP[3] + rz : 0)) / 2
            mb.lines.forEach((l, i) => text(c, l, x + w / 2, top + mb.size * (0.8 + i * 1.18), { f: mb.f, color: p.ink, align: 'center' }))
            if (pr.reading) text(c, pr.reading, x + w / 2, top + mh + SP[3] + rz * 0.85, { f: font(400, rz, 'jp'), color: p.ink, align: 'center' })
          })
          y += cardH + SP[7]
          y = lead(c, P.how, y, p.ink, [FS.title], { maxLines: 1 })
          y += SP[4]
          const bar = A.ratingBar(c, p, fr.x, y + 34 * U, fr.w, U, P.ratings, { pressed: 3 })
          bar.centres.forEach((cx, i) => {
            const f = fit(c, P.due[i], { weight: 700, sizes: [12 * U, 10.5 * U], maxW: (fr.w / 4.6), maxLines: 1, fam: 'latin' })
            text(c, f.lines[0], cx, y + 20 * U, { f: f.f, color: i === 3 ? p.ink : p.ink2, align: 'center' })
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
      add('paste', ctx => {
        page(ctx, 1, 3)
        centred(ctx, (c, y) => {
          y = lead(c, P.paste, y, p.ink, [FS.display * 0.62, FS.heading])
          y += SP[8]
          const h = 146 * U
          panel(c, fr.x, y, fr.w, h, 8 * U)
          const room = fr.w - 26 * U - 60 * U
          let z = 15 * U
          while (z > 11 * U && measure(c, pr.jp, font(400, z, 'jp')) > room) z -= 0.5 * U
          text(c, pr.jp, fr.x + 13 * U, y + 26 * U, { f: font(400, z, 'jp'), color: F.ink })
          c.fillStyle = F.line
          c.fillRect(fr.x, y + h - 58 * U, fr.w, U)
          text(c, P.chars(pr.jp.length).toLocaleUpperCase(), fr.x + 13 * U, y + h - 25 * U, { f: font(700, 9.92 * U, 'latin'), color: F.soft, tr: 0.18 })
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
          text(c, P.analyze, bx + bw / 2, by + bh / 2 + 6 * U, { f: font(700, 15 * U, 'latin'), color: '#1c1811', align: 'center' })
          y += h + SP[8]
          return lead(c, P.cuts, y, p.ink2, [FS.lead, FS.body], { maxLines: 5, weight: 500 })
        })
      })
      add('cut', ctx => {
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
          for (const pt of pr.points) {
            if (y - y0 + 102 * U > room) break
            y += A.pointCard(c, p, fr.x, y, fr.w, U, pt) + 8 * U
          }
          return y
        })
      })
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
          text(c, P.examKind.toLocaleUpperCase(), fr.x, y + FS.caption, { f: font(700, FS.caption, 'latin'), color: p.line.exam, tr: 0.18 })
          y += FS.caption * 1.6 + SP[3]
          y = lead(c, P.examAsk, y, p.ink, [FS.heading, FS.title])
          y += SP[6]
          y += question(c, y) + SP[4]
          y += A.choiceRows(c, p, fr.x, y, fr.w, U, pr.choices, { line: p.line.exam, rowH: 48 })
          return lead(c, P.comment, y + SP[5], p.ink2, [FS.body], { maxLines: 2, weight: 500 })
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
          y = lead(c, P.passWaits, y, p.ink, [FS.display * 0.72, FS.heading], { maxLines: 2 })
          y += SP[7]
          y += A.passCard(c, fr.x, y, fr.w, { name: P.yourName, nameInk: 'rgba(34, 36, 40, 0.45)', level: 1, cls: P.free, xp: 0.12 }) + SP[7]
          return lead(c, P.passBody, y, p.ink2, [FS.lead, FS.body], { maxLines: 4, weight: 500 })
        })
      })
      add('free', ctx => {
        page(ctx, 2, 2)
        centred(ctx, (c, y) => {
          y = lead(c, P.startFree, y, p.ink, [FS.heading, FS.title], { maxLines: 1 })
          y += SP[6]
          for (const [h1, b1] of P.promises) {
            const h = 74 * U
            panel(c, fr.x, y, fr.w, h)
            const room = fr.w - 36 * U
            const hb = fit(c, say(h1), { weight: 700, sizes: [17 * U, 15 * U], maxW: room, maxLines: 1, fam: 'latin' })
            const bb = fit(c, say(b1), { weight: 400, sizes: [13.12 * U, 12 * U], maxW: room, maxLines: 1, fam: 'latin' })
            text(c, hb.lines[0], fr.x + 18 * U, y + 31 * U, { f: hb.f, color: F.ink })
            text(c, bb.lines[0], fr.x + 18 * U, y + 55 * U, { f: bb.f, color: F.soft })
            y += h + 8 * U
          }
          return handle(c, y)
        }, FOOT)
        depart(ctx, P.board)
      })
      break
    }
    default:
  }
  return out
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
