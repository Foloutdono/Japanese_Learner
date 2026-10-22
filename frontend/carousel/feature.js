// ── 実践 — a practice feature's video (plan 270) ──────────────────────
// The owner's pick A of three drawn (the real screen, over play along
// and the pitch): one 9:16 video per feature of the Practice tab, in the
// tab's order, each the app itself doing one exercise. The app is
// recorded as it runs (long/record.mjs: its pages in a phone-sized
// browser, its API answered from bank/promo.json, the backend's own
// answers for the banks' own content); this module plans the recording,
// times it and draws each frame: a short caption over the screen, the
// screen in a rounded frame on the dark ground, a finger's tap where the
// learner taps, the screen moving to what each part shows (scrolling down
// one taller than the frame), and the promo
// stories' gate at the end (promo.gateClip). Scored with the app's own
// sounds and its engine's voices where the app speaks.
//
// What a caption says is what the screen shows and the app's own
// description of the feature says (locales: its title and its three
// lines, held equal by a test): no figure, no price, no promise the
// screen does not make.
import { FS, SP, fit, formatOf, frame, palette, paragraph, rrect, text } from './draw.js'
import { PRINT_HOURS } from './app.js'
import { END, gateClip } from './promo.js'
import { feedPosts } from './feeds.js'
import { weldIf } from './strings.js'

// The Practice tab's platforms, in its order (src/config/tabs.js).
export const FEATURE_IDS = ['reading', 'comprehension', 'translation', 'dictation', 'composition', 'exam', 'conversation']
export const FEATURE_FPS = 30
// A shot: the 400 CSS px phone at 2.7 (record.mjs PHONE).
export const SHOT = { w: 1080, h: 2322 }
// The screen's frame on the video: its width, and how far under the
// feed's safe box it may reach (its foot is the screen's, never a word).
const SCREEN = { w: 880, below: 70, radius: 44 }
// A beat's caption comes in, the screen moves to what it shows, a state
// changes in a cross-fade; a finger shows before its tap and its ring after.
const MOTION = { caption: 0.35, pan: 0.5, fade: 0.22, finger: 0.35, ring: 0.5 }
// Typed as a quick hand types, a few keys a shot (record.mjs `chunk`).
const KEYS_PER_SECOND = 13
// A line heard as its screen comes: a breath after the screen.
const HEAR = 0.35
// How long a line lasts: its voice's length once voiced, else a reading pace's guess.
const lengthOf = (cue, voiceDur) => voiceDur ? voiceDur(cue) : 0.5 + 0.13 * [...cue.text].length
// A tall screen's scroll: a moment on its head first, a moment on its foot after.
const SCROLL = { wait: 0.9, rest: 0.9 }
// The gate's share of the video: its ask, its note, then the gate, waiting.
const END_SECONDS = 5.5

// The app's own names and descriptions (locales/*/index.js, as their source
// spells them: the French is welded on the way out, as the table is), held equal by a test.
export const APP = {
  en: {
    tab: 'Practice',
    title: { reading: 'Reading practice', comprehension: 'Reading comprehension', translation: 'Translation', dictation: 'Dictation', composition: 'Composition', exam: 'Mock Exam', conversation: 'Conversation' },
    desc: {
      reading: 'Real sentences, pitched at your level\nBy grade, by frequency, or from your own cards\nRead first, check after',
      comprehension: 'Short passages, then questions\nThe reading half of the exam, rehearsed\nN5 through N1',
      translation: 'Put it into Japanese yourself\nA reference answer, and a read on yours\nThe hard direction, on purpose',
      dictation: 'Write down what you hear, in romaji\nTwo listens, and no more\nN5 through N1',
      composition: 'Write a sentence with the point you are shown\nA tutor reads it back to you\nN5 through N1',
      exam: 'Full-length practice exams, timed and scored\nVocabulary, grammar, reading, listening\nBuilt to the official JLPT format — unofficial scoring',
      conversation: 'Someone speaks to you: answer them\nChoose, translate or speak freely\nN5 through N1',
    },
  },
  fr: {
    tab: 'Pratique',
    title: { reading: 'Entraînement à la lecture', comprehension: 'Compréhension écrite', translation: 'Traduction', dictation: 'Dictée', composition: 'Rédaction', exam: 'Examen blanc', conversation: 'Conversation' },
    desc: {
      reading: 'De vraies phrases, à ton niveau\nPar grade, par fréquence, ou depuis tes cartes\nLire d\'abord, vérifier ensuite',
      comprehension: 'Des textes courts, puis des questions\nL’épreuve de lecture de l’examen, en répétition\nDe N5 à N1',
      translation: 'À toi de le dire en japonais\nUne réponse de référence, et un avis sur la tienne\nDans le sens difficile, exprès',
      dictation: 'Écris en romaji ce que tu entends\nDeux écoutes, pas une de plus\nDe N5 à N1',
      composition: 'Écris une phrase avec le point donné\nUn tuteur te la relit\nDe N5 à N1',
      exam: 'Examens complets, chronométrés et notés\nVocabulaire, grammaire, lecture, écoute\nAu format JLPT officiel — notation non officielle',
      conversation: 'On te parle : réponds\nChoisis, traduis ou parle librement\nDe N5 à N1',
    },
  },
}
const LOCALE_KEYS = { reading: 'reading', comprehension: 'readingComprehension', translation: 'translation', dictation: 'dictation', composition: 'composition', exam: 'exam', conversation: 'conversation' }
export const localeKeys = id => ({ title: `${LOCALE_KEYS[id]}Title`, desc: `${LOCALE_KEYS[id]}Desc` })

// Where a step taps, by what the app names (record.mjs reads these off the page).
const plate = line => `.plate--platform[style*="--line-${line}"]`
const stop = code => `.route-stop:has(.route-stop__code:text-is("${code}"))`
const FIELD = '.stage__foot .field'
const SUBMIT = '.stage__foot .btn-primary'
// A comprehension run's parts: its passage, a question and its options, the option at i.
const PASSAGE = '.prompt-card--passage'
const ASK = '.prompt-card--ask, .mcq-list'
const option = i => `.mcq-row >> nth=${i}`
// A mock exam's parts: the question and its answers, the answer in slot i, the page's Next.
const SHEET = '.exam-ask__big, .exam-tiles'
const tile = i => `.exam-tile >> nth=${i}`
const NEXT = '.exam-dock__go--next'
// A conversation's parts: the first scene of the station, a line of the other person's, one of the learner's.
const SCENE = '.platform-card >> nth=0'
const THEM = '.tour-line--them'
const ME = '.tour-line--me'
// What a card says, without the room around it.
const BODY = '.prompt-card__body > *'

// ── The features ──────────────────────────────────────────────
// steps: what record.mjs does in the app (its shots named);
// beats: what the video shows, each with its caption, made of parts:
//   { shot, hold, tap }      a shot held `hold` seconds, tapped at `tap`
//   { seq, by: 'at' }        a sequence of shots at the moments recorded (a clip playing)
//   { seq, by: 'chars' }     a sequence typed, KEYS_PER_SECOND, a key's press each
// A part's `voice` is the line said from its tap (the clip the app plays).
// The opening every feature shares: the Practice gate, the feature's
// plate tapped; then its level list, the level tapped.
const gateSteps = (line, levels, level) => [
  { go: '/practice', ready: '.plate--platform' },
  { shot: 'gate', focus: plate(line), tap: `${plate(line)} .plate__head` },
  { go: levels, ready: '.route-stop' },
  { shot: 'levels', focus: stop(level), tap: stop(level) },
]
const gateBeats = (say, levels = { en: 'N5 to N1.', fr: 'Du N5 au N1.' }) => [
  { say, parts: [{ shot: 'gate', hold: 2.0, tap: 1.5 }] },
  { say: levels, parts: [{ shot: 'levels', hold: 1.4, tap: 0.9 }] },
]

export const FEATURES = {
  conversation: {
    jp: '会話', line: 'kaiwa',
    steps: d => [
      { go: '/practice', ready: '.plate--platform' },
      { shot: 'gate', focus: plate('kaiwa'), tap: `${plate('kaiwa')} .plate__head` },
      { go: '/practice/conversation', ready: '.platform-card' },
      { shot: 'scenes', focus: ['.console', SCENE], tap: SCENE },
      { click: SCENE, ready: '.kaiwa-ticket' },
      { shot: 'ticket', focus: '.kaiwa-ticket' },
      // Start taps off camera: the scene's ticket, then its first line.
      { click: SUBMIT, ready: '.kaiwa-reply' },
      ...d.picks.slice(0, 2).flatMap((k, i) => [
        { shot: `t${i}`, focus: [`${THEM} >> nth=-1`, '.kaiwa-replies'], tap: `.kaiwa-reply >> nth=${k}` },
        { click: `.kaiwa-reply >> nth=${k}`, settle: 800 },
        { shot: `t${i}-said`, focus: [`${ME} >> nth=-1`, '.stage__foot'], tap: SUBMIT },
        { click: SUBMIT, ready: '.kaiwa-reply', settle: 800 },
      ]),
    ],
    beats: [
      { say: { en: 'Someone speaks to you.', fr: 'On te parle.' }, parts: [{ shot: 'gate', hold: 2.0, tap: 1.5 }] },
      { say: { en: 'Scenes from daily life.', fr: 'Des scènes de tous les jours.' }, parts: [{ shot: 'scenes', hold: 2.0, tap: 1.5 }] },
      { say: { en: 'Each with an errand to run.', fr: 'Chacune avec une course à faire.' }, parts: [{ shot: 'ticket', hold: 2.4 }] },
      { say: { en: 'Hear them. Answer them.', fr: 'Écoute. Réponds.' }, parts: [{ shot: 't0', hold: 1.0, tap: 0.8, hear: 0, voice: 1 }, { shot: 't0-said', hold: 1.4, tap: 1.0 }] },
      { say: { en: 'Every reply explained.', fr: 'Chaque réponse expliquée.' }, parts: [{ shot: 't1', hold: 1.0, tap: 0.8, hear: 2, voice: 3 }, { shot: 't1-said', hold: 2.6 }] },
    ],
    end: { en: 'Hold a conversation on Tsuji.', fr: 'Tiens une conversation sur Tsuji.' },
    title: { en: 'Could you get through a konbini in Japanese?', fr: 'Saurais-tu t’en sortir au konbini en japonais ?' },
    voice: d => d.said.slice(0, 2).flatMap(t => [{ text: t.them, who: 'them' }, { text: t.me, who: 'me' }]),
  },
  reading: {
    jp: '読書', line: 'reading',
    steps: d => [
      ...gateSteps('reading', '/practice/reading/levels', d.level),
      { go: `/practice/reading/level/${d.level}`, ready: '.clip-player__play' },
      { shot: 'ready', focus: '.prompt-card', tap: '.clip-player__play' },
      { click: '.clip-player__play' },
      { wait: 700 },
      { shot: 'shown', focus: '.prompt-card' },
      { type: FIELD, text: d.answer, shot: 'typing', chunk: 3, focus: '.stage__foot' },
      { shot: 'typed', focus: '.stage__foot', tap: SUBMIT },
      { click: SUBMIT, ready: '.rating-bar' },
      { wait: 1200 },
      { shot: 'checked', focus: '.prompt-card' },
    ],
    beats: [
      ...gateBeats({ en: 'Read real Japanese.', fr: 'Lis du vrai japonais.' }),
      { say: { en: 'A sentence at your level, on the clock.', fr: 'Une phrase à ton niveau, chronométrée.' }, parts: [{ shot: 'ready', hold: 0.8, tap: 0.55 }, { shot: 'shown', hold: 2.4 }] },
      { say: { en: 'Write how it reads, in rōmaji.', fr: 'Écris comment elle se lit, en rōmaji.' }, parts: [{ seq: 'typing', by: 'chars', hold: 0.3 }, { shot: 'typed', hold: 0.9, tap: 0.55 }] },
      { say: { en: 'Read first, check after.', fr: 'Lire d’abord, vérifier ensuite.' }, parts: [{ shot: 'checked', hold: 4.2 }] },
    ],
    end: { en: 'Read real Japanese on Tsuji.', fr: 'Lis du vrai japonais sur Tsuji.' },
    title: { en: 'Can you read this Japanese before the clock runs out?', fr: 'Sauras-tu lire ce japonais avant la fin du chrono ?' },
  },
  comprehension: {
    jp: '理解', line: 'rikai',
    steps: d => [
      ...gateSteps('rikai', '/practice/comprehension', d.level),
      { go: `/practice/comprehension/${d.level}`, ready: PASSAGE },
      { shot: 'passage', focus: '.timer, .prose__jp--passage' },
      { shot: 'read', focus: '.stage__foot', tap: SUBMIT },
      { click: SUBMIT, ready: '.mcq-row' },
      // The first two questions as they are answered (Next taps off camera: the
      // screen stays on the question); the rest answered off camera too.
      ...d.answers.slice(0, 2).flatMap((a, i) => [
        { shot: `q${i}`, focus: ASK, tap: option(a) },
        { click: option(a), settle: 300 },
        { shot: `q${i}-picked`, focus: ASK },
        { click: SUBMIT, settle: 500 },
      ]),
      ...d.answers.slice(2).flatMap(a => [{ click: option(a), settle: 120 }, { click: SUBMIT, settle: 250 }]),
      { wait: 1200 },
      { shot: 'results', focus: '.result-lattice, .qrows', tap: `.qrow >> nth=${d.wrong}` },
      { click: `.qrow >> nth=${d.wrong}`, settle: 700 },
      { shot: 'missed', focus: '.result-lattice, .qrow__detail' },
    ],
    beats: [
      ...gateBeats({ en: 'Read a whole text.', fr: 'Lis un texte entier.' }),
      { say: { en: 'A text at your level, on a clock.', fr: 'Un texte à ton niveau, chronométré.' }, parts: [{ shot: 'passage', hold: 2.6 }, { shot: 'read', hold: 0.9, tap: 0.55 }] },
      { say: { en: 'Then questions on what it says.', fr: 'Puis des questions sur ce qu’il dit.' }, parts: [
        { shot: 'q0', hold: 1.6, tap: 1.2 }, { shot: 'q0-picked', hold: 0.6 },
        { shot: 'q1', hold: 1.5, tap: 1.1 }, { shot: 'q1-picked', hold: 0.9 },
      ] },
      { say: { en: 'Your score, and every miss shown.', fr: 'Ton score, et chaque erreur montrée.' }, parts: [{ shot: 'results', hold: 2.0, tap: 1.6 }, { shot: 'missed', hold: 3.2 }] },
    ],
    end: { en: 'Read a whole text on Tsuji.', fr: 'Lis un texte entier sur Tsuji.' },
    title: { en: 'Can you read this Japanese text and answer?', fr: 'Sauras-tu lire ce texte japonais et répondre ?' },
  },
  exam: {
    jp: '模試', line: 'exam',
    steps: d => [
      { go: '/practice', ready: '.plate--platform' },
      { shot: 'gate', focus: plate('exam'), tap: `${plate('exam')} .plate__head` },
      { go: '/practice/exam', ready: '.exam-st__go' },
      { shot: 'station', focus: '.exam-st__hero', tap: '.exam-st__go' },
      { click: '.exam-st__go', ready: '.exam-cover__go' },
      { shot: 'cover', focus: '.exam-cover__figs, .exam-cover__parts' },
      { click: '.exam-cover__go', ready: '.exam-tile' },
      // Three questions on camera, the rest answered off it; the last Next opens the answer sheet.
      ...d.answers.slice(0, 3).flatMap((a, i) => [
        { shot: `q${i}`, focus: SHEET, tap: tile(a.slot) },
        { click: tile(a.slot), settle: 300 },
        { shot: `q${i}-picked`, focus: SHEET },
        { click: NEXT, settle: 400 },
      ]),
      ...d.answers.slice(3).flatMap(a => [{ click: tile(a.slot), settle: 100 }, { click: NEXT, settle: 200 }]),
      { wait: 700 },
      { shot: 'sheet', focus: '.exam-parts__finish', tap: '.exam-parts__finish' },
      { click: '.exam-parts__finish', ready: '.exam-res' },
      { wait: 1200 },
      { shot: 'result', focus: '.exam-res' },
    ],
    beats: [
      { say: { en: 'Sit a mock JLPT.', fr: 'Passe un JLPT blanc.' }, parts: [{ shot: 'gate', hold: 2.0, tap: 1.5 }] },
      { say: { en: 'Vocabulary, grammar, reading, listening.', fr: 'Vocabulaire, grammaire, lecture, écoute.' }, parts: [{ shot: 'station', hold: 2.0, tap: 1.5 }] },
      { say: { en: 'In the exam’s own format, on a clock.', fr: 'Au format de l’examen, chronométré.' }, parts: [
        { shot: 'cover', hold: 1.6 },
        { shot: 'q0', hold: 1.3, tap: 0.95 }, { shot: 'q0-picked', hold: 0.5 },
        { shot: 'q1', hold: 1.1, tap: 0.75 }, { shot: 'q1-picked', hold: 0.5 },
        { shot: 'q2', hold: 1.1, tap: 0.75 }, { shot: 'q2-picked', hold: 0.6 },
      ] },
      { say: { en: 'Hand it in for your score.', fr: 'Rends-le pour ton score.' }, parts: [{ shot: 'sheet', hold: 1.2, tap: 0.8 }, { shot: 'result', hold: 4.2 }] },
    ],
    end: { en: 'Sit a mock JLPT on Tsuji.', fr: 'Passe un JLPT blanc sur Tsuji.' },
    title: { en: 'Could you pass a JLPT N5 vocabulary mock exam?', fr: 'Réussirais-tu un examen blanc de vocabulaire N5 ?' },
  },
  translation: {
    jp: '翻訳', line: 'honyaku',
    steps: d => [
      ...gateSteps('honyaku', '/practice/translation/levels', d.level),
      { go: `/practice/translation/level/${d.level}`, ready: FIELD },
      { wait: 600 },
      { shot: 'prompt', focus: '.prompt-card' },
      { type: FIELD, text: d.answer, shot: 'typing', chunk: 2, focus: '.stage__foot' },
      { shot: 'typed', focus: '.stage__foot', tap: SUBMIT },
      { click: SUBMIT, ready: '.rvw__verdict' },
      { wait: 1200 },
      { shot: 'reviewed', focus: BODY },
    ],
    beats: [
      ...gateBeats({ en: 'Say it in Japanese.', fr: 'Dis-le en japonais.' }),
      { say: { en: 'The hard direction, on purpose.', fr: 'Dans le sens difficile, exprès.' }, parts: [{ shot: 'prompt', hold: 2.4 }] },
      { say: { en: 'Put it into Japanese yourself.', fr: 'À toi de le dire en japonais.' }, parts: [{ seq: 'typing', by: 'chars', hold: 0.3 }, { shot: 'typed', hold: 0.9, tap: 0.55 }] },
      { say: { en: 'A reference, and a read on yours.', fr: 'Une référence, et un avis sur la tienne.' }, parts: [{ shot: 'reviewed', hold: 5.6 }] },
    ],
    end: { en: 'Say it in Japanese on Tsuji.', fr: 'Dis-le en japonais sur Tsuji.' },
    title: { en: 'How would you say this in Japanese?', fr: 'Comment dirais-tu ça en japonais ?' },
  },
  composition: {
    jp: '作文', line: 'sakubun',
    steps: d => [
      ...gateSteps('sakubun', '/practice/composition', d.level),
      { go: `/practice/composition/${d.level}`, ready: FIELD },
      { wait: 600 },
      { shot: 'point', focus: '.prompt-card' },
      { type: FIELD, text: d.answer, shot: 'typing', chunk: 2, focus: '.stage__foot' },
      { shot: 'typed', focus: '.stage__foot', tap: SUBMIT },
      { click: SUBMIT, ready: '.rvw__verdict' },
      { wait: 1200 },
      { shot: 'reviewed', focus: BODY },
    ],
    beats: [
      ...gateBeats({ en: 'Write your own Japanese.', fr: 'Écris ton propre japonais.' }),
      { say: { en: 'You are shown a grammar point.', fr: 'On te donne un point de grammaire.' }, parts: [{ shot: 'point', hold: 2.4 }] },
      { say: { en: 'Write a sentence that uses it.', fr: 'Écris une phrase qui l’utilise.' }, parts: [{ seq: 'typing', by: 'chars', hold: 0.3 }, { shot: 'typed', hold: 0.9, tap: 0.55 }] },
      { say: { en: 'A tutor reads it back to you.', fr: 'Un tuteur te la relit.' }, parts: [{ shot: 'reviewed', hold: 5.6 }] },
    ],
    end: { en: 'Write your own Japanese on Tsuji.', fr: 'Écris ton propre japonais sur Tsuji.' },
    title: { en: 'Write one Japanese sentence with 〜たい', fr: 'Écris une phrase japonaise avec 〜たい' },
  },
  dictation: {
    jp: '書取', line: 'kakitori',
    steps: d => [
      ...gateSteps('kakitori', '/practice/dictation', d.level),
      { go: `/practice/dictation/${d.level}`, ready: '.clip-player__play' },
      { shot: 'listen', focus: '.clip-player', tap: '.clip-player__play' },
      { play: '.clip-player__play', shot: 'playing', seconds: d.seconds, focus: '.clip-player' },
      { type: FIELD, text: d.answer, shot: 'typing', chunk: 3, focus: '.stage__foot' },
      { shot: 'typed', focus: '.stage__foot', tap: SUBMIT },
      { click: SUBMIT, ready: '.rating-bar' },
      { wait: 900 },
      { shot: 'checked', focus: '.prompt-card' },
    ],
    beats: [
      ...gateBeats({ en: 'Train your ear.', fr: 'Entraîne ton oreille.' }),
      { say: { en: 'Hear a line. Twice, no more.', fr: 'Une phrase, deux écoutes. Pas plus.' }, parts: [{ shot: 'listen', hold: 0.8, tap: 0.6, voice: true }, { seq: 'playing', by: 'at', hold: 0.5 }] },
      { say: { en: 'Write what you hear, in rōmaji.', fr: 'Écris en rōmaji ce que tu entends.' }, parts: [{ seq: 'typing', by: 'chars', hold: 0.3 }, { shot: 'typed', hold: 0.9, tap: 0.55 }] },
      { say: { en: 'Every slip marked.', fr: 'Chaque erreur relevée.' }, parts: [{ shot: 'checked', hold: 4.2 }] },
    ],
    end: { en: 'Train your ear on Tsuji.', fr: 'Entraîne ton oreille sur Tsuji.' },
    title: { en: 'Japanese dictation: can you write what you hear?', fr: 'Dictée en japonais : sauras-tu écrire ce que tu entends ?' },
    voice: d => ({ text: d.line, who: 'reader' }),
  },
}

/** The list a studio or a render picks from. */
export function featureItems(lang = 'en') {
  const A = APP[lang] || APP.en
  return FEATURE_IDS.filter(id => FEATURES[id]).map(id => ({ id, jp: FEATURES[id].jp, sub: A.title[id], tag: A.tab }))
}

/** A feature's video, planned: what to record and what to say over it. */
export function featurePlan(banks, id, { lang = 'en', fit = 'tiktok', music = true, handle = '', hour = 'day' } = {}) {
  const F = FEATURES[id]
  if (!F) throw new Error(`no feature video for ${id}`)
  const L = lang === 'fr' ? 'fr' : 'en'
  const d = banks['promo.json']?.features?.[id]?.[L]
  if (!d) throw new Error(`bank/promo.json has no ${id} (${L}): run python -m scripts.carousel_bank --only promo.json`)
  const A = APP[L]
  return {
    kind: 'feature', id, lang: L, fit: ['instagram', 'normal'].includes(fit) ? fit : 'tiktok', music: music !== false, handle,
    // The print of the hour the gate at the end stands on (plan 271).
    hour: PRINT_HOURS.includes(hour) ? hour : 'day',
    jp: F.jp, line: F.line, name: weldIf(L, A.title[id]), tab: A.tab, data: d,
    // The lines the video says, in the app's voices: the clip a feature plays (its first), the people who speak.
    cues: F.voice ? [].concat(F.voice(d)) : [],
    end: weldIf(L, F.end[L]), title: weldIf(L, F.title[L]),
    beats: F.beats.map(b => ({ say: weldIf(L, b.say[L]), parts: b.parts })),
  }
}

/** The steps record.mjs takes, once the voice is known (its length is the clip's). */
export const featureSteps = (plan, seconds = 2.5) => FEATURES[plan.id].steps({ ...plan.data, seconds })

// ── Where things stand ────────────────────────────────────────
/** The video's frame: the caption's box, the screen's, the screen's scale. */
export function layoutOf(fit = 'tiktok') {
  const fmt = formatOf('story', fit)
  const fr = frame(fmt)
  const labelZ = FS.caption
  const sayZ = FS.display * 0.62
  // Room for a caption of two lines, so the screen never moves under a short one.
  const capH = labelZ * 1.3 + SP[3] + sayZ * 1.08 * 2
  const top = fr.y + capH + SP[6]
  const w = Math.min(SCREEN.w, fmt.w - 2 * 90)
  const bottom = Math.min(fmt.h - 40, fr.bottom + SCREEN.below)
  const s = w / SHOT.w
  return { fmt, fr, labelZ, sayZ, top, bottom, x: (fmt.w - w) / 2, w, h: bottom - top, s, rows: (bottom - top) / s, safeRows: (fr.bottom - top) / s }
}
const union = boxes => {
  const bs = boxes.filter(Boolean)
  if (!bs.length) return null
  const y = Math.min(...bs.map(b => b.y))
  return { y, h: Math.max(...bs.map(b => b.y + b.h)) - y }
}
/** How far down the shot the screen shows: the least that keeps what
 *  the part is about (its focus, what it taps) inside the safe box; the
 *  top of it where it is taller than that, and never so low or so high
 *  that the finger taps off the screen. */
export function cropFor(focus, L, tap = null) {
  const most = SHOT.h - L.rows
  if (!focus) return 0
  let off = Math.max(0, focus.y + focus.h + 48 - L.safeRows)
  if (focus.y - 24 < off) off = Math.max(0, focus.y - 24)
  if (tap && tap.y + tap.h + 48 > off + L.safeRows) off = tap.y + tap.h + 48 - L.safeRows
  if (tap && tap.y - 24 < off) off = Math.max(0, tap.y - 24)
  return Math.min(most, off)
}
/** Where a focus taller than the safe box is read to: its foot in the box. */
export function scrollFor(focus, L) {
  if (!focus) return 0
  return Math.max(0, Math.min(SHOT.h - L.rows, focus.y + focus.h + 48 - L.safeRows))
}
// Where a part leaves the screen: the foot of its scroll, or its crop.
const offAfter = pt => pt.scroll ? pt.scroll.to : pt.crop

// ── The timeline ──────────────────────────────────────────────
/** Each beat timed from the shots recorded: its frames (a shot from a
 *  moment), its taps, and its parts, each where the screen stands while
 *  it shows (a crop, and a scroll down a part taller than the box); then
 *  the gate. `shots` is record.mjs's list; `voiceDur(cue)` how long the
 *  line lasts once voiced. */
export function featureTimeline(plan, shots, voiceDur = null) {
  const L = layoutOf(plan.fit)
  const byName = name => shots.map((s, i) => ({ ...s, idx: i })).filter(s => s.name === name).sort((a, b) => a.i - b.i)
  const segs = []
  const sfx = []
  const cues = []
  let at = 0
  plan.beats.forEach((b, bi) => {
    const start = at
    const frames = []
    const taps = []
    const parts = []
    let tapped = null
    // When the last line voiced in the beat ends: nothing taps or moves on over it.
    let carry = 0
    for (const part of b.parts) {
      const from = at
      let focus = []
      let tap = null
      if (part.shot) {
        const [s] = byName(part.shot)
        if (!s) throw new Error(`no shot named ${part.shot}`)
        frames.push({ t: at, shot: s.idx, change: true })
        focus = [s.focus]
        // A line heard as the screen comes (the other person's), then the tap once it is said.
        let heard = from
        if (part.hear != null) {
          const c = plan.cues[part.hear]
          cues.push({ ...c, at: +(from + HEAR).toFixed(3) })
          heard = from + HEAR + lengthOf(c, voiceDur)
        }
        let end = Math.max(from + part.hold, heard + 0.4, carry + 0.3)
        if (part.tap != null && s.tap) {
          tap = s.tap
          tapped = Math.max(from + part.tap, part.hear != null ? heard + 0.35 : 0, carry + 0.2)
          taps.push({ t: tapped, x: s.tap.x + s.tap.w / 2, y: s.tap.y + s.tap.h / 2 })
          sfx.push({ at: +tapped.toFixed(3), key: 'click', gain: 0.45 })
          end = Math.max(end, tapped + 0.35)
          // A line the tap says (the clip played, the reply picked): voiced from the tap,
          // and the next part holds until it is said.
          if (part.voice != null && plan.cues.length) {
            const c = plan.cues[part.voice === true ? 0 : part.voice]
            cues.push({ ...c, at: +(tapped + 0.15).toFixed(3) })
            carry = tapped + 0.15 + lengthOf(c, voiceDur)
          }
        }
        at = end
      } else if (part.seq) {
        const seq = byName(part.seq)
        if (!seq.length) throw new Error(`no shots named ${part.seq}`)
        if (part.by === 'at') {
          // As the clip played, from the tap that started it: each shot at the moment it was taken.
          const t0 = tapped ?? at
          seq.forEach(s => frames.push({ t: Math.max(at, t0 + s.at), shot: s.idx }))
          at = Math.max(at, t0 + seq.at(-1).at, carry) + (part.hold ?? 0.4)
        } else {
          const t0 = at
          // Typed: a key's press each, a shot every few keys.
          let typed = 0
          for (const s of seq) {
            for (let c = typed; c < s.chars; c++) sfx.push({ at: +(t0 + c / KEYS_PER_SECOND).toFixed(3), key: 'click', gain: 0.16 })
            typed = s.chars
            frames.push({ t: t0 + s.chars / KEYS_PER_SECOND, shot: s.idx })
          }
          at = t0 + typed / KEYS_PER_SECOND + (part.hold ?? 0.3)
        }
        focus = [seq[0].focus, seq.at(-1).focus]
      }
      const box = union([...focus, tap])
      const pt = { start: +from.toFixed(3), crop: cropFor(box, L, tap) }
      // A screen taller than the box is read down to its foot, slowly, as a learner
      // scrolls it, once the finger is done with it.
      const to = scrollFor(box, L)
      const go = from + MOTION.pan + SCROLL.wait
      const until = at - SCROLL.rest
      if (!tap && to - pt.crop > 24 && until - go > 0.8) pt.scroll = { to, at: +go.toFixed(3), until: +until.toFixed(3) }
      parts.push(pt)
    }
    // No line runs on into the next beat.
    at = Math.max(at, carry + 0.3)
    // A new state is laid down as the screen is: the card's own sound.
    if (bi > 0) sfx.push({ at: +start.toFixed(3), key: 'card-transition', gain: 0.5 })
    segs.push({ kind: 'beat', beat: bi, start: +start.toFixed(3), dur: +(at - start).toFixed(3), frames, taps, parts, say: b.say })
  })
  const endAt = at
  segs.push({ kind: 'end', start: +endAt.toFixed(3), dur: END_SECONDS })
  // The gate's own score (promo.js endScoreOf): the ask on the board's flap, the gate on the chime.
  sfx.push({ at: +(endAt + END.head + 0.1).toFixed(3), key: 'board-flap' }, { at: +(endAt + END.gate + 0.1).toFixed(3), key: 'platform-chime' })
  const seconds = +(endAt + END_SECONDS).toFixed(3)
  return { kind: 'feature', seconds, fps: FEATURE_FPS, segs, sfx: sfx.sort((a, b) => a.at - b.at), cues, chapters: [], of: plan.beats.length }
}

/** What the studio can show of a video before it is made: the gate it
 *  ends on (the rest is the app, recorded where the command runs). */
export function featurePreview(plan) {
  return { kind: 'feature', seconds: END_SECONDS, fps: FEATURE_FPS, segs: [{ kind: 'end', start: 0, dur: END_SECONDS }], sfx: [], cues: plan.cues.map(c => ({ ...c, at: 0 })), chapters: [], of: plan.beats.length }
}

// ── A frame ───────────────────────────────────────────────────
const ease = x => 1 - (1 - Math.min(1, Math.max(0, x))) ** 3
const smooth = x => { const c = Math.min(1, Math.max(0, x)); return c * c * (3 - 2 * c) }
const step = (x, n = 15) => Math.round(x * n) / n

/** The gate the video ends on, made once per plan, format and print. */
const gates = new WeakMap()
function gateOf(plan, print) {
  const made = gates.get(plan)
  if (made?.print === print) return made.clip
  const clip = gateClip(formatOf('story', plan.fit), { lang: plan.lang, head: plan.end, handle: plan.handle, print })
  gates.set(plan, { print, clip })
  return clip
}

/** The frame at `t`; `imgs[i]` is shot i, loaded, `print` Today's print
 *  of the plan's hour, which the gate stands on (none: the paper alone).
 *  Returns a key the same for two frames that look the same. */
export function drawFeature(ctx, plan, tl, t, imgs, print = null) {
  const L = layoutOf(plan.fit)
  let si = tl.segs.findIndex(s => t < s.start + s.dur)
  if (si < 0) si = tl.segs.length - 1
  const sg = tl.segs[si]
  if (sg.kind === 'end') {
    const u = t - sg.start
    gateOf(plan, print).draw(ctx, u)
    return `end|${Math.round(u * FEATURE_FPS)}`
  }
  const u = t - sg.start
  const p = palette('sumi')
  const ink = palette('paper').line[plan.line]
  ctx.fillStyle = p.bg
  ctx.fillRect(0, 0, L.fmt.w, L.fmt.h)
  // The caption: where it is in the app, and what the beat shows.
  const kc = step(ease(u / MOTION.caption))
  ctx.save()
  ctx.globalAlpha *= kc
  ctx.translate(0, (1 - kc) * 16)
  const label = `${plan.tab} · ${plan.jp} ${plan.name}`.toLocaleUpperCase()
  const lb = fit(ctx, label, { weight: 700, sizes: [L.labelZ, FS.xs], maxW: L.fr.w, maxLines: 1 })
  text(ctx, lb.lines[0], L.fr.x, L.fr.y + L.labelZ, { f: lb.f, color: lightOf(ink), tr: 0.16 })
  const say = fit(ctx, sg.say, { weight: 900, fam: 'serif', sizes: [L.sayZ, FS.heading, FS.title], maxW: L.fr.w, maxLines: 2, lh: 1.08 })
  paragraph(ctx, say, L.fr.x, L.fr.y + L.labelZ * 1.3 + SP[3], p.ink, 'left', 1.08)
  ctx.restore()
  // The screen moves to what the part shows.
  let pi = 0
  for (let i = 0; i < sg.parts.length; i++) if (sg.parts[i].start <= t + 1e-6) pi = i
  const pt = sg.parts[pi]
  const before = pi > 0 ? sg.parts[pi - 1] : si > 0 && tl.segs[si - 1].kind === 'beat' ? tl.segs[si - 1].parts.at(-1) : pt
  const prev = offAfter(before)
  const kp = step(ease((t - pt.start) / MOTION.pan), 30)
  let off = prev + (pt.crop - prev) * kp
  if (pt.scroll && t > pt.scroll.at) off = pt.crop + (pt.scroll.to - pt.crop) * smooth((t - pt.scroll.at) / (pt.scroll.until - pt.scroll.at))
  // The shot showing, and the one before it while a new state comes in.
  let fi = 0
  for (let i = 0; i < sg.frames.length; i++) if (sg.frames[i].t <= t + 1e-6) fi = i
  const cur = sg.frames[fi]
  const last = fi > 0 ? sg.frames[fi - 1] : si > 0 && tl.segs[si - 1].frames ? tl.segs[si - 1].frames.at(-1) : null
  const kf = cur.change && last ? step(ease((t - cur.t) / MOTION.fade)) : 1
  // Its frame, on the ground.
  ctx.save()
  ctx.shadowColor = 'rgba(0,0,0,0.5)'
  ctx.shadowBlur = 60
  ctx.fillStyle = '#000'
  rrect(ctx, L.x, L.top, L.w, L.h, SCREEN.radius)
  ctx.fill()
  ctx.restore()
  ctx.save()
  rrect(ctx, L.x, L.top, L.w, L.h, SCREEN.radius)
  ctx.clip()
  const shotAt = (img, a) => {
    if (!img || a <= 0) return
    ctx.save()
    ctx.globalAlpha *= a
    ctx.drawImage(img, 0, off, SHOT.w, L.rows, L.x, L.top, L.w, L.h)
    ctx.restore()
  }
  if (kf < 1) shotAt(imgs[last.shot], 1)
  shotAt(imgs[cur.shot], kf)
  // A finger: shown before the tap, pressed on it, its ring after.
  let tapKey = ''
  for (const tp of sg.taps) {
    const d = t - tp.t
    if (d < -MOTION.finger || d > MOTION.ring) continue
    const cx = L.x + tp.x * L.s
    const cy = L.top + (tp.y - off) * L.s
    const show = d < 0 ? step(ease(1 + d / MOTION.finger)) : step(1 - d / MOTION.ring)
    const r = d < 0 ? 38 : 34
    ctx.fillStyle = `rgba(255,255,255,${(0.5 * show).toFixed(3)})`
    ctx.beginPath()
    ctx.arc(cx, cy, r, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = `rgba(23,21,26,${(0.35 * show).toFixed(3)})`
    ctx.lineWidth = 3
    ctx.stroke()
    if (d >= 0) {
      const k = step(d / MOTION.ring)
      ctx.strokeStyle = `rgba(255,255,255,${(0.7 * (1 - k)).toFixed(3)})`
      ctx.lineWidth = 6
      ctx.beginPath()
      ctx.arc(cx, cy, 34 + 46 * k, 0, Math.PI * 2)
      ctx.stroke()
    }
    tapKey += `${show.toFixed(2)}|`
  }
  ctx.restore()
  // Its rim, in the feature's line.
  ctx.strokeStyle = ink
  ctx.lineWidth = 4
  rrect(ctx, L.x + 2, L.top + 2, L.w - 4, L.h - 4, SCREEN.radius - 2)
  ctx.stroke()
  return `${si}|${fi}|${kc}|${Math.round(off)}|${kf}|${tapKey}`
}
// A line's pigment lifted for the dark ground: a caption in it reads.
function lightOf(hex) {
  const n = parseInt(hex.slice(1), 16)
  const c = [n >> 16, (n >> 8) & 255, n & 255].map(v => Math.round(v + (255 - v) * 0.45))
  return `#${c.map(v => v.toString(16).padStart(2, '0')).join('')}`
}

/** Where the video's still is taken: its first beat, its caption in. */
export const featureStillAt = () => 1.2

// ── Its page ──────────────────────────────────────────────────
const PAGE = {
  en: {
    app: 'Keep going on Tsuji', start: 'Start free on Tsuji', more: 'Start free on Tsuji.',
    credits: (voiced, music) => [voiced && 'Voices: VOICEVOX Nemo.', music && 'Music: made for Tsuji.'].filter(Boolean).join(' '),
    tags: ['LearnJapanese', 'Japanese', 'JLPT', '日本語', 'JapaneseApp'],
  },
  fr: {
    app: 'Continue sur Tsuji', start: 'Commence gratuitement sur Tsuji', more: 'Commence gratuitement sur Tsuji.',
    credits: (voiced, music) => [voiced && 'Voix : VOICEVOX Nemo.', music && 'Musique : faite pour Tsuji.'].filter(Boolean).join(' '),
    tags: ['ApprendreLeJaponais', 'Japonais', 'JLPT', '日本語', 'Tsuji'],
  },
}
/** The video's page for YouTube, and its posts for Reels and TikTok. */
export function featurePage(plan, tl, site) {
  const P = PAGE[plan.lang]
  const A = APP[plan.lang]
  const desc = weldIf(plan.lang, A.desc[plan.id] || '').split('\n').filter(Boolean)
  const voiced = tl.cues.length > 0
  const credits = P.credits(voiced, plan.music)
  const tags = P.tags
  const title = `${plan.title} #shorts`
  const lines = [`${plan.jp} ${plan.name}`, ...desc.map(x => `· ${x}`)].join('\n')
  const page = {
    title,
    description: [lines, `${P.start}: ${site}`, voiced || plan.music ? credits : '', [...tags, 'Shorts'].map(x => `#${x}`).join(' ')].filter(Boolean).join('\n\n'),
    tags: [...tags, plan.name, 'Tsuji', 'shorts'].join(', '),
  }
  return { ...page, feeds: feedPosts(page, { hook: plan.title, lines: [lines], app: P.more.replace(/\.$/, ''), credits: voiced || plan.music ? [credits] : [], hashtags: tags }, plan.lang) }
}

/** The command that makes the video, from frontend/. */
export function featureCommand(id, lang = 'en', fit = 'tiktok', music = true, hour = 'day') {
  return ['VOICEVOX_URL=http://localhost:50121 node carousel/long/render.mjs', `--feature ${id}`, `--lang ${lang}`, fit !== 'tiktok' ? `--fit ${fit}` : '', hour !== 'day' ? `--hour ${hour}` : '', music ? '' : '--music none'].filter(Boolean).join(' ')
}
