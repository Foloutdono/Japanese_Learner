// ── 実践 — a practice feature's video (plan 270) ──────────────────────
// The owner's pick A of three drawn (the real screen, over play along
// and the pitch): one 9:16 video per feature of the Practice tab, in the
// tab's order, each the app itself doing one exercise. The app is
// recorded as it runs (long/record.mjs: its pages in a phone-sized
// browser, its API answered from bank/promo.json, the backend's own
// answers for the banks' own content); this module plans the recording,
// times it and draws each frame: since plan 272 (the owner's pick B of
// three drawn) the screen fills the video as a phone shows it, the
// caption on a slip of the print's washi at the foot of the feed's safe
// box, a finger's tap where the learner taps, the screen moving to what
// each part shows (scrolling down one taller than the box), and the promo
// stories' gate at the end (promo.gateClip). Scored with the app's own
// sounds and its engine's voices where the app speaks.
//
// What a caption says is what the screen shows and the app's own
// description of the feature says (locales: its title and its three
// lines, held equal by a test): no figure, no price, no promise the
// screen does not make.
import { EDGE, FS, R, SP, fit, formatOf, frame, palette, rrect, shadow, text } from './draw.js'
import { APP_INKS, PRINT_HOURS } from './app.js'
import { END, gateClip } from './promo.js'
import { feedPosts } from './feeds.js'
import { weldIf } from './strings.js'

// The Practice tab's platforms, in its order (src/config/tabs.js).
export const FEATURE_IDS = ['reading', 'comprehension', 'translation', 'dictation', 'composition', 'exam', 'conversation']
export const FEATURE_FPS = 30
// A shot: the 400 CSS px phone at 4 (record.mjs PHONE), so the camera
// can come in on a part of it and still draw it sharp (plan 273).
export const SHOT = { w: 1600, h: 3440 }
// The caption's slip: its padding, and the caption's sizes, two lines at most.
const SLIP = { pad: SP[4], sizes: [FS.title, FS.lead], lh: 1.12 }
// A beat's caption comes in; a state changes in a cross-fade, a new
// screen slides in from the right as the app's pages do, and the app
// dissolves into the gate at the end; a finger shows before its tap and
// its ring after.
const MOTION = { caption: 0.35, fade: 0.22, slide: 0.5, out: 0.5, finger: 0.35, ring: 0.5 }
// Typed as a quick hand types, a few keys a shot (record.mjs `chunk`).
const KEYS_PER_SECOND = 13
// A line heard as its screen comes: a breath after the screen.
const HEAR = 0.35
// How long a line lasts: its voice's length once voiced, else a reading pace's guess.
const lengthOf = (cue, voiceDur) => voiceDur ? voiceDur(cue) : 0.5 + 0.13 * [...cue.text].length
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
// Its roll: the chip that turns the text into lines going by, and the roll's faster.
const ROLL = '.timer .roll-chip'
const FASTER = '.roll-ctl__speed .roll-ctl__btn >> nth=1'
// Its results: Ask's second offer (where the text says it), and the whole text's breakdown.
const WHERE = '.ask__offer >> nth=1'
const BREAKDOWN = '.qrows + .btn-secondary'
// A mock exam's parts: the question and its answers, the answer in slot i, the page's Next.
const QUESTION = '.exam-ask__big'
const TILES = '.exam-tiles'
const tile = i => `.exam-tile >> nth=${i}`
const NEXT = '.exam-dock__go--next'
const FLAG = '.exam-flag'
// A conversation's parts: the first scene of the station, a line of the other person's, one of the learner's.
const SCENE = '.platform-card >> nth=0'
const THEM = '.tour-line--them'
const ME = '.tour-line--me'
const reply = i => `.kaiwa-reply >> nth=${i}`
// What a card says, without the room around it.
const BODY = '.prompt-card__body > *'
// Once graded: the learner's rating, then the sentence's breakdown and Ask
// (a question offered, picked by what it says), the answer it gets.
const RATE = q => `.rating-bar__btn--q${q}`
const BREAKDOWN_OPEN = '.prose__breakdown > .btn-secondary:not(.ask-launch)'
const ASK_OPEN = '.prose__breakdown .ask-launch'
const OFFER = has => `.ask__offer:has-text("${has}")`
const ANSWER = '.ask__a:not(.ask__a--note)'
// Composition's door to the point's lesson, on the card it is written from.
const LESSON = '.prompt-card .prose__breakdown > .btn-secondary'

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
  { say: levels, parts: [{ shot: 'levels', hold: 1.4, tap: 0.9, enter: 'push' }] },
]
// The ending reading, translation and dictation share (plan 273): the
// rating, which opens the sentence's breakdown, read down, then Ask: one
// of the questions it offers tapped (`offer`, what it says), or the
// learner's own typed (`typed`), and its answer.
const lookSteps = (q, { offer, typed }) => [
  { shot: 'rate', focus: '.rating-bar', tap: RATE(q) },
  { click: RATE(q), settle: 800 },
  { shot: 'rated', focus: '.prose__breakdown', tap: BREAKDOWN_OPEN },
  { click: BREAKDOWN_OPEN, settle: 900 },
  { scroll: '.prose__breakdown', block: 'start' },
  { shot: 'breakdown', focus: '.prose__breakdown' },
  { scroll: ASK_OPEN, block: 'center' },
  { shot: 'bd-ask', focus: ASK_OPEN, tap: ASK_OPEN },
  { click: ASK_OPEN, ready: '.ask-page', settle: 500 },
  ...(typed ? [
    { shot: 'ask', focus: ['.ask__offers', '.ask__form'] },
    { type: '.ask__field', text: typed, shot: 'asking', chunk: 2, focus: ['.ask__offers', '.ask__form'] },
    { shot: 'asking-typed', focus: ['.ask__offers', '.ask__form'], tap: '.ask__send' },
    { click: '.ask__send', ready: ANSWER, settle: 700 },
  ] : [
    { shot: 'ask', focus: '.ask__offers', tap: OFFER(offer) },
    { click: OFFER(offer), ready: ANSWER, settle: 700 },
  ]),
  { shot: 'asked', focus: ANSWER },
]
const lookBeats = (breakdown, { typed = false, ask = { en: 'Ask about anything in it.', fr: 'Pose une question sur la phrase.' } } = {}) => [
  { say: breakdown, parts: [{ shot: 'rated', hold: 0.9, tap: 0.5 }, { shot: 'breakdown', hold: 2.0, cam: 'read' }] },
  { say: ask, parts: [
    { shot: 'bd-ask', hold: 0.8, tap: 0.45 },
    ...(typed
      ? [{ shot: 'ask', hold: 1.1, enter: 'push' }, { seq: 'asking', by: 'chars', hold: 0.2 }, { shot: 'asking-typed', hold: 0.7, tap: 0.4 }]
      : [{ shot: 'ask', hold: 1.4, tap: 1.0, enter: 'push' }]),
    { shot: 'asked', hold: 3.4 },
  ] },
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
      // The first line's translation shown, the right reply picked.
      { shot: 't0', focus: [`${THEM} >> nth=-1`, '.kaiwa-replies'], tap: '.kaiwa-tr' },
      { click: '.kaiwa-tr', settle: 500 },
      { shot: 't0-tr', focus: [`${THEM} >> nth=-1`, '.kaiwa-replies'], tap: reply(d.picks[0]) },
      { click: reply(d.picks[0]), settle: 800 },
      { shot: 't0-said', focus: [`${ME} >> nth=-1`, '.stage__foot'], tap: SUBMIT },
      { click: SUBMIT, ready: '.kaiwa-reply', settle: 800 },
      // The second, a wrong reply: struck, why under it, the right one after.
      { shot: 't1', focus: [`${THEM} >> nth=-1`, '.kaiwa-replies'], tap: reply(d.slips[1]) },
      { click: reply(d.slips[1]), settle: 900 },
      { shot: 't1-wrong', focus: ['.kaiwa-line--taken', '.kaiwa-line--right'] },
      { click: SUBMIT, ready: '.kaiwa-reply', settle: 600 },
      // The rest answered off camera, to the scene's end.
      ...d.picks.slice(2).flatMap((k, i, rest) => [
        { click: reply(k), settle: 600 },
        { click: SUBMIT, ...(i < rest.length - 1 ? { ready: '.kaiwa-reply' } : {}), settle: 700 },
      ]),
      { wait: 900 },
      { shot: 'over', focus: '.kaiwa-over' },
    ],
    beats: [
      { say: { en: 'Someone speaks to you.', fr: 'On te parle.' }, parts: [{ shot: 'gate', hold: 2.0, tap: 1.5 }] },
      { say: { en: 'Scenes from daily life.', fr: 'Des scènes de tous les jours.' }, parts: [{ shot: 'scenes', hold: 2.0, tap: 1.5, enter: 'push' }] },
      { say: { en: 'Each with an errand to run.', fr: 'Chacune avec une course à faire.' }, parts: [{ shot: 'ticket', hold: 2.4, enter: 'push' }] },
      { say: { en: 'Hear them. Answer them.', fr: 'Écoute. Réponds.' }, parts: [
        { shot: 't0', hold: 1.0, tap: 0.8, hear: 0 }, { shot: 't0-tr', hold: 1.0, tap: 0.7, voice: 1 }, { shot: 't0-said', hold: 1.2, tap: 0.9 },
      ] },
      { say: { en: 'A wrong reply, and why.', fr: 'Une mauvaise réponse, et pourquoi.' }, parts: [{ shot: 't1', hold: 1.0, tap: 0.8, hear: 2, voice: 3 }, { shot: 't1-wrong', hold: 3.0, cam: 'read' }] },
      { say: { en: 'Then your score for the scene.', fr: 'Puis ton score pour la scène.' }, parts: [{ shot: 'over', hold: 2.6, cam: 'auto' }] },
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
      ...lookSteps(4, { offer: 'に' }),
    ],
    beats: [
      ...gateBeats({ en: 'Read real Japanese.', fr: 'Lis du vrai japonais.' }),
      { say: { en: 'A sentence at your level, on the clock.', fr: 'Une phrase à ton niveau, chronométrée.' }, parts: [{ shot: 'ready', hold: 0.8, tap: 0.55, enter: 'push' }, { shot: 'shown', hold: 2.4 }] },
      { say: { en: 'Write how it reads, in rōmaji.', fr: 'Écris comment elle se lit, en rōmaji.' }, parts: [{ seq: 'typing', by: 'chars', hold: 0.3 }, { shot: 'typed', hold: 0.9, tap: 0.55 }] },
      { say: { en: 'Read first, check after.', fr: 'Lire d’abord, vérifier ensuite.' }, parts: [{ shot: 'checked', hold: 2.4 }, { shot: 'rate', hold: 0.9, tap: 0.5 }] },
      ...lookBeats({ en: 'Then every word, broken down.', fr: 'Puis chaque mot, décomposé.' }),
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
      // The clock, and the roll: the text one line at a time, faster, then whole again.
      { shot: 'clock', focus: '.timer', tap: ROLL },
      { play: ROLL, shot: 'rolling', seconds: 2.6, skip: 1.3, focus: '.roll__line--now', step: true },
      { shot: 'roll-ctl', focus: '.roll-ctl', tap: FASTER },
      { click: FASTER, settle: 60 },
      { click: FASTER, settle: 60 },
      { play: FASTER, shot: 'rolling-fast', seconds: 2.0, focus: '.roll__line--now', step: true },
      { shot: 'roll-off', focus: '.timer', tap: ROLL },
      { click: ROLL, ready: PASSAGE, settle: 400 },
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
      // The miss asked about: where the text says it.
      { shot: 'missed', focus: '.qrow__detail', tap: '.qrow__detail .ask-launch' },
      { click: '.qrow__detail .ask-launch', ready: '.ask-page', settle: 500 },
      { shot: 'ask', focus: '.ask__offers', tap: WHERE },
      { click: WHERE, ready: '.ask__a:not(.ask__a--note)', settle: 700 },
      { shot: 'asked', focus: '.ask__a:not(.ask__a--note)' },
      { click: '.ask-page .stage__leave', settle: 600 },
      // The whole text broken down, on the sentence the miss was about.
      { scroll: BREAKDOWN, block: 'center' },
      { shot: 'bd-ask', focus: BREAKDOWN, tap: BREAKDOWN },
      { click: BREAKDOWN, settle: 900 },
      { scroll: '.qrows ~ .prompt-card', block: 'start' },
      { shot: 'breakdown', focus: '.qrows ~ .prompt-card .analysis-grammar-chips, .bkd-passage__item--open' },
      { scroll: `.bkd-passage__head >> nth=${d.sentence}`, block: 'center' },
      { shot: 'bd-pick', focus: `.bkd-passage__head >> nth=${d.sentence}`, tap: `.bkd-passage__head >> nth=${d.sentence}` },
      { click: `.bkd-passage__head >> nth=${d.sentence}`, settle: 900, keep: true },
      { shot: 'bd-open', focus: '.bkd-passage__item--open' },
    ],
    beats: [
      ...gateBeats({ en: 'Read a whole text.', fr: 'Lis un texte entier.' }),
      { say: { en: 'A text at your level, on a clock.', fr: 'Un texte à ton niveau, chronométré.' }, parts: [{ shot: 'passage', hold: 2.0, enter: 'push', cam: 'read' }, { shot: 'clock', hold: 1.2, tap: 0.8 }] },
      { say: { en: 'Or let it roll, line by line.', fr: 'Ou laisse-le défiler, ligne par ligne.' }, parts: [
        { seq: 'rolling', by: 'at', hold: 0.2 }, { shot: 'roll-ctl', hold: 0.9, tap: 0.55 }, { seq: 'rolling-fast', by: 'at', hold: 0.2 },
        { shot: 'roll-off', hold: 0.8, tap: 0.5 },
      ] },
      { say: { en: 'Then questions on what it says.', fr: 'Puis des questions sur ce qu’il dit.' }, parts: [
        { shot: 'read', hold: 0.8, tap: 0.5 },
        { shot: 'q0', hold: 1.4, tap: 1.0, enter: 'push' }, { shot: 'q0-picked', hold: 0.5 },
        { shot: 'q1', hold: 1.4, tap: 1.0 }, { shot: 'q1-picked', hold: 0.7 },
      ] },
      { say: { en: 'Your score, and every miss shown.', fr: 'Ton score, et chaque erreur montrée.' }, parts: [{ shot: 'results', hold: 1.8, tap: 1.4, enter: 'push' }, { shot: 'missed', hold: 1.4, tap: 1.0 }] },
      { say: { en: 'Ask where the text says it.', fr: 'Demande où le texte le dit.' }, parts: [{ shot: 'ask', hold: 1.4, tap: 1.0, enter: 'push' }, { shot: 'asked', hold: 3.6 }] },
      { say: { en: 'Every sentence, broken down.', fr: 'Chaque phrase, décomposée.' }, parts: [
        { shot: 'bd-ask', hold: 1.0, tap: 0.6, enter: 'back' }, { shot: 'breakdown', hold: 2.2, cam: 'read' },
        { shot: 'bd-pick', hold: 0.9, tap: 0.5 }, { shot: 'bd-open', hold: 2.4, cam: 'read' },
      ] },
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
      // The grade's papers, one of each kind, then the next one started.
      { shot: 'station', focus: ['.exam-st__hero', '.exam-st__list'] },
      { shot: 'station-go', focus: '.exam-st__hero', tap: '.exam-st__go' },
      { click: '.exam-st__go', ready: '.exam-cover__go' },
      { shot: 'cover', focus: '.exam-cover__figs, .exam-cover__parts' },
      { click: '.exam-cover__go', ready: '.exam-tile' },
      // Two questions on camera, the first read and then answered, the
      // second answered and flagged; the rest answered off it; the last Next
      // opens the answer sheet.
      ...d.answers.slice(0, 2).flatMap((a, i) => [
        ...(i === 0 ? [{ shot: 'q0-ask', focus: QUESTION }] : []),
        { shot: `q${i}`, focus: TILES, tap: tile(a.slot) },
        { click: tile(a.slot), settle: 300 },
        ...(i === 1
          ? [{ shot: 'q1-flag', focus: '.exam-run__head', tap: FLAG }, { click: FLAG, settle: 400 }, { shot: 'q1-flagged', focus: '.exam-run__head' }]
          : [{ shot: 'q0-picked', focus: TILES }]),
        { click: NEXT, settle: 400 },
      ]),
      ...d.answers.slice(2).flatMap(a => [{ click: tile(a.slot), settle: 100 }, { click: NEXT, settle: 200 }]),
      { wait: 700 },
      { shot: 'sheet', focus: ['.exam-parts', '.exam-parts__finish'], tap: '.exam-parts__finish' },
      { click: '.exam-parts__finish', ready: '.exam-res' },
      { wait: 1200 },
      { shot: 'result', focus: '.exam-res__parts, .exam-res' },
      // A miss opened again, revealed: what was picked, what was right.
      { scroll: '.exam-res__mhead', block: 'start' },
      { shot: 'misses', focus: ['.exam-res__mhead', '.exam-res__misses'], tap: '.exam-miss >> nth=0' },
      { click: '.exam-miss >> nth=0', settle: 800 },
      { scroll: '.exam-review-row__detail', block: 'center' },
      { shot: 'miss-open', focus: '.exam-review-row__detail' },
    ],
    beats: [
      { say: { en: 'Sit a mock JLPT.', fr: 'Passe un JLPT blanc.' }, parts: [{ shot: 'gate', hold: 2.0, tap: 1.5 }] },
      { say: { en: 'Vocabulary, grammar, reading, listening.', fr: 'Vocabulaire, grammaire, lecture, écoute.' }, parts: [{ shot: 'station', hold: 2.0, cam: 'read', enter: 'push' }, { shot: 'station-go', hold: 1.0, tap: 0.6 }] },
      { say: { en: 'In the exam’s own format, on a clock.', fr: 'Au format de l’examen, chronométré.' }, parts: [
        { shot: 'cover', hold: 1.6, enter: 'push' },
        { shot: 'q0-ask', hold: 1.0, enter: 'push' }, { shot: 'q0', hold: 0.9, tap: 0.6 }, { shot: 'q0-picked', hold: 0.5 },
      ] },
      { say: { en: 'Flag one to come back to.', fr: 'Marque-en une pour y revenir.' }, parts: [
        { shot: 'q1', hold: 1.0, tap: 0.7 }, { shot: 'q1-flag', hold: 0.9, tap: 0.5 }, { shot: 'q1-flagged', hold: 0.9 },
      ] },
      { say: { en: 'Hand it in for your score.', fr: 'Rends-le pour ton score.' }, parts: [{ shot: 'sheet', hold: 1.4, tap: 1.0, enter: 'rise' }, { shot: 'result', hold: 2.8, cam: 'read', enter: 'push' }] },
      { say: { en: 'Then go back over every miss.', fr: 'Puis reviens sur chaque erreur.' }, parts: [{ shot: 'misses', hold: 1.2, tap: 0.8 }, { shot: 'miss-open', hold: 2.6, cam: 'read' }] },
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
      ...lookSteps(3, { offer: 'てください' }),
    ],
    beats: [
      ...gateBeats({ en: 'Say it in Japanese.', fr: 'Dis-le en japonais.' }),
      { say: { en: 'The hard direction, on purpose.', fr: 'Dans le sens difficile, exprès.' }, parts: [{ shot: 'prompt', hold: 2.4, enter: 'push' }] },
      { say: { en: 'Put it into Japanese yourself.', fr: 'À toi de le dire en japonais.' }, parts: [{ seq: 'typing', by: 'chars', hold: 0.3 }, { shot: 'typed', hold: 0.9, tap: 0.55 }] },
      { say: { en: 'A reference, and a read on yours.', fr: 'Une référence, et un avis sur la tienne.' }, parts: [{ shot: 'reviewed', hold: 3.0, cam: 'read' }, { shot: 'rate', hold: 0.9, tap: 0.5 }] },
      ...lookBeats({ en: 'Then the reference, word by word.', fr: 'Puis la référence, mot à mot.' }),
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
      // The point's lesson, opened from its card, then closed to write.
      { shot: 'point', focus: '.prompt-card', tap: LESSON },
      { click: LESSON, ready: '.gl-sheet .gl-body', settle: 900 },
      { shot: 'lesson', focus: '.gl-sheet' },
      { click: '.gl-sheet .dict-plate__actions .dict-plate__btn', settle: 700 },
      { type: FIELD, text: d.answer, shot: 'typing', chunk: 2, focus: '.stage__foot' },
      { shot: 'typed', focus: '.stage__foot', tap: SUBMIT },
      { click: SUBMIT, ready: '.rvw__verdict' },
      { wait: 1200 },
      { shot: 'reviewed', focus: BODY },
    ],
    beats: [
      ...gateBeats({ en: 'Write your own Japanese.', fr: 'Écris ton propre japonais.' }),
      { say: { en: 'You are shown a grammar point.', fr: 'On te donne un point de grammaire.' }, parts: [{ shot: 'point', hold: 1.8, tap: 1.3, enter: 'push' }] },
      { say: { en: 'Its lesson, one tap away.', fr: 'Sa leçon, à portée de main.' }, parts: [{ shot: 'lesson', hold: 2.6, cam: 'read', enter: 'rise' }] },
      { say: { en: 'Write a sentence that uses it.', fr: 'Écris une phrase qui l’utilise.' }, parts: [{ seq: 'typing', by: 'chars', hold: 0.3, enter: 'sink' }, { shot: 'typed', hold: 0.9, tap: 0.55 }] },
      { say: { en: 'A tutor reads it back to you.', fr: 'Un tuteur te la relit.' }, parts: [{ shot: 'reviewed', hold: 4.0, cam: 'read' }] },
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
      ...lookSteps(3, { typed: d.asked }),
    ],
    beats: [
      ...gateBeats({ en: 'Train your ear.', fr: 'Entraîne ton oreille.' }),
      { say: { en: 'Hear a line. Twice, no more.', fr: 'Une phrase, deux écoutes. Pas plus.' }, parts: [{ shot: 'listen', hold: 0.8, tap: 0.6, voice: true, enter: 'push' }, { seq: 'playing', by: 'at', hold: 0.5 }] },
      { say: { en: 'Write what you hear, in rōmaji.', fr: 'Écris en rōmaji ce que tu entends.' }, parts: [{ seq: 'typing', by: 'chars', hold: 0.3 }, { shot: 'typed', hold: 0.9, tap: 0.55 }] },
      { say: { en: 'Every slip marked.', fr: 'Chaque erreur relevée.' }, parts: [{ shot: 'checked', hold: 2.8 }, { shot: 'rate', hold: 0.9, tap: 0.5 }] },
      ...lookBeats({ en: 'Then the line, word by word.', fr: 'Puis la phrase, mot à mot.' }, { typed: true, ask: { en: 'Ask what you missed.', fr: 'Demande ce qui t’a échappé.' } }),
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
export function featurePlan(banks, id, { lang = 'en', fit = 'tiktok', handle = '', hour = 'day' } = {}) {
  const F = FEATURES[id]
  if (!F) throw new Error(`no feature video for ${id}`)
  const L = lang === 'fr' ? 'fr' : 'en'
  const d = banks['promo.json']?.features?.[id]?.[L]
  if (!d) throw new Error(`bank/promo.json has no ${id} (${L}): run python -m scripts.carousel_bank --only promo.json`)
  const A = APP[L]
  return {
    kind: 'feature', id, lang: L, fit: ['instagram', 'normal'].includes(fit) ? fit : 'tiktok', handle,
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
/** The video's frame: the screen full-bleed at its scale, the slip at
 *  the foot of the safe box at its tallest (two lines of its caption),
 *  and the view: where what a part is about stands, between the feed's
 *  head (the safe box's top) and the slip, `yc` its middle. */
export function layoutOf(fit = 'tiktok') {
  const fmt = formatOf('story', fit)
  const fr = frame(fmt)
  const s = fmt.w / SHOT.w
  const slipH = 2 * SLIP.pad + SLIP.sizes[0] * (0.82 + SLIP.lh + 0.3)
  const view = { top: fr.y, bottom: fr.bottom - slipH - SP[4] }
  return { fmt, fr, w: fmt.w, h: fmt.h, s, slipH, view, yc: (view.top + view.bottom) / 2 }
}
const union = boxes => {
  const bs = boxes.filter(Boolean)
  if (!bs.length) return null
  const x = Math.min(...bs.map(b => b.x ?? 0))
  const y = Math.min(...bs.map(b => b.y))
  return { x, y, w: Math.max(...bs.map(b => (b.x ?? 0) + (b.w ?? SHOT.w))) - x, h: Math.max(...bs.map(b => b.y + b.h)) - y }
}

// ── The camera (plan 273) ─────────────────────────────────────
// The app is filmed as a camera films a phone held still: it stays where
// it is until a part gives it something else to look at, then goes there
// in one eased move, and every move has a point: to frame what the part
// is about (coming in on it where it is small, the whole screen where it
// is not), to bring the finger's target in before the finger comes, to
// read a text down to its last line at a reader's pace, or to step back
// and show what a tap changed. A camera is the point of the shot at the
// middle of the view (`cx`, `cy`, in the shot's pixels down the page: a
// shot stands at its own scroll on it, so the app scrolling between two
// shots is the camera going down the page) and its zoom (`z`, 1 the
// screen's width across the video's).
const CAM = { zMax: 1.6, side: 36, edge: 28, read: 520, readMax: 3.2, wait: 0.35, linger: 0.6 }
const clamp = (x, a, b) => Math.min(b, Math.max(a, x))
/** Where the camera stands to show `box` (on the page, a shot scrolled
 *  `sy` down it): `kind` 'auto' frames it whole, as close as it fits
 *  (never past zMax, never under the screen's width), 'wide' at the
 *  screen's width, 'read' as wide as it is and from its top, a number at
 *  that zoom; `tap`, the finger's target, is always in view. */
export function camFor(box, L, { kind = 'auto', tap = null, sy = 0 } = {}) {
  const viewW = L.w - 2 * CAM.side
  const viewH = L.view.bottom - L.view.top - 2 * CAM.edge
  if (!box) return settleCam({ cx: SHOT.w / 2, cy: sy + L.yc / L.s, z: 1 }, L, sy)
  // Across, the box and its finger's target both in view; down, the box (the target brought in after).
  const across = tap ? union([box, tap]) : box
  const fitZ = Math.min(viewW / (across.w * L.s), kind === 'read' ? Infinity : viewH / (box.h * L.s))
  const z = clamp(typeof kind === 'number' ? kind : kind === 'wide' ? 1 : fitZ, 1, CAM.zMax)
  const half = viewH / 2 / (L.s * z)
  let cy = box.h <= 2 * half ? box.y + box.h / 2 : box.y + half
  if (tap) {
    if (tap.y + tap.h > cy + half) cy = tap.y + tap.h - half
    if (tap.y < cy - half) cy = tap.y + half
  }
  return settleCam({ cx: across.x + across.w / 2, cy, z }, L, sy)
}
/** A camera kept on the shot (scrolled `sy` down the page): the screen
 *  across the video's width, its head and foot never inside the view (its
 *  own colour goes on beyond them, above the view and under it). */
function settleCam(c, L, sy = 0) {
  const k = L.s * c.z
  const halfW = L.w / 2 / k
  const cx = clamp(c.cx, halfW, SHOT.w - halfW)
  const cy = clamp(c.cy, sy + (L.yc - L.view.top) / k, sy + SHOT.h - (L.view.bottom - L.yc) / k)
  return { cx: +cx.toFixed(2), cy: +cy.toFixed(2), z: +c.z.toFixed(4) }
}
/** Where reading `box` from its top ends: its last line above the slip. */
function readTo(box, cam, L, sy = 0) {
  const half = (L.view.bottom - L.view.top - 2 * CAM.edge) / 2 / (L.s * cam.z)
  return settleCam({ ...cam, cy: Math.max(cam.cy, box.y + box.h - half) }, L, sy).cy
}
// A box of a shot, on the page: down by the shot's scroll.
const onPage = (b, sy) => b && { ...b, y: b.y + sy }
// The same box: a new state of what the part before showed, where it showed it.
const same = (a, b) => Boolean(a && b) && ['x', 'y', 'w', 'h'].every(k => Math.abs(a[k] - b[k]) < 12)
/** Whether `box` (on the page) is in the view, whole, through camera `c`. */
function inView(box, c, L) {
  const k = L.s * c.z
  const x = L.w / 2 + (box.x - c.cx) * k
  const y = L.yc + (box.y - c.cy) * k
  return x >= CAM.side / 2 && x + box.w * k <= L.w - CAM.side / 2 && y >= L.view.top + CAM.edge / 2 && y + box.h * k <= L.view.bottom - CAM.edge / 2
}
/** How long the eye takes to go from one camera to the next: the way the
 *  view travels on the video, in pixels, and the zoom's change. */
function moveTime(a, b, L) {
  const k = L.s * Math.max(a.z, b.z)
  const d = Math.hypot((a.cx - b.cx) * k, (a.cy - b.cy) * k) + Math.abs(Math.log(a.z / b.z)) * 1600
  return d < 2 ? 0 : clamp(0.42 + d / 2400, 0.5, 1.1)
}
const lerpCam = (a, b, k) => ({ cx: a.cx + (b.cx - a.cx) * k, cy: a.cy + (b.cy - a.cy) * k, z: a.z * (b.z / a.z) ** k })
// The ways a screen comes in over another, each on its own camera: a page
// across, from the right (push) or away to it (back); a sheet up from
// below (rise) or down again (sink). [across, coming in]
const SLIDES = { push: [true, true], back: [true, false], rise: [false, true], sink: [false, false] }

// ── The timeline ──────────────────────────────────────────────
/** Each beat timed from the shots recorded: its frames (a shot from a
 *  moment), its taps, and its parts, each with where the camera goes for
 *  it, how long it takes to get there, and the text it reads down where
 *  there is one taller than the view; then the gate. `shots` is
 *  record.mjs's list; `voiceDur(cue)` how long the line lasts once voiced.
 *  A part's `cam` asks for a framing (camFor's kinds), its `enter`
 *  'push' for a new screen sliding in as the app's pages do, 'back' for
 *  one left sliding away to show the screen under it, 'rise' for a sheet
 *  coming up over the screen and 'sink' for it going. */
export function featureTimeline(plan, shots, voiceDur = null) {
  const L = layoutOf(plan.fit)
  const byName = name => shots.map((s, i) => ({ ...s, idx: i })).filter(s => s.name === name).sort((a, b) => a.i - b.i)
  const viewH = L.view.bottom - L.view.top - 2 * CAM.edge
  const segs = []
  const sfx = []
  const cues = []
  let at = 0
  // Where the camera stands as the next part begins, and what it was on.
  let cam = null
  let was = null
  plan.beats.forEach((b, bi) => {
    const start = at
    const frames = []
    const taps = []
    const parts = []
    let tapped = null
    // When the last line voiced in the beat ends: nothing taps or moves on over it.
    let carry = 0
    b.parts.forEach(part => {
      const from = at
      const shot = part.shot ? byName(part.shot)[0] : null
      const seq = part.seq ? byName(part.seq) : null
      if (part.shot && !shot) throw new Error(`no shot named ${part.shot}`)
      if (part.seq && !seq.length) throw new Error(`no shots named ${part.seq}`)
      const sy = (shot || seq.at(-1)).scrollY || 0
      const focus = onPage(shot ? shot.focus : union([seq[0].focus, seq.at(-1).focus]), sy)
      const tapBox = shot && part.tap != null ? onPage(shot.tap, sy) : null
      // The first part is cut to; a new screen slides in on its own camera;
      // anything else is the camera moving from where it stands, and only
      // where it has something new to show: what is in view stays put.
      const enter = !cam ? 'cut' : part.enter || 'fade'
      const keep = enter === 'fade' && !part.cam && focus && (inView(tapBox ? union([focus, tapBox]) : focus, cam, L) || (!tapBox && same(focus, was)))
      const target = keep ? settleCam(cam, L, sy) : camFor(focus, L, { kind: part.cam || 'auto', tap: tapBox, sy })
      const move = SLIDES[enter] ? MOTION.slide : enter === 'fade' ? moveTime(cam, target, L) : 0
      const arrive = from + move
      const pt = { start: +from.toFixed(3), enter, cam: target, move: +move.toFixed(3) }
      if (shot) {
        frames.push({ t: from, shot: shot.idx, sy, change: true })
        // A line heard as the screen comes (the other person's), then the tap once it is said.
        let heard = from
        if (part.hear != null) {
          const c = plan.cues[part.hear]
          cues.push({ ...c, at: +(from + HEAR).toFixed(3) })
          heard = from + HEAR + lengthOf(c, voiceDur)
        }
        let end = Math.max(from + part.hold, arrive + CAM.linger, heard + 0.4, carry + 0.3)
        if (tapBox) {
          // The finger comes once the camera has brought its target in.
          tapped = Math.max(from + part.tap, arrive + 0.25, part.hear != null ? heard + 0.35 : 0, carry + 0.2)
          taps.push({ t: tapped, x: tapBox.x + tapBox.w / 2, y: tapBox.y + tapBox.h / 2 })
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
      } else if (part.by === 'at') {
        // As the clip played, from the tap that started it: each shot at the moment it was taken.
        const t0 = tapped ?? at
        seq.forEach(s => frames.push({ t: Math.max(at, t0 + s.at), shot: s.idx, sy: s.scrollY || 0 }))
        at = Math.max(at, arrive, t0 + seq.at(-1).at, carry) + (part.hold ?? 0.4)
      } else {
        // Typed once the camera is on the field: a key's press each, a shot every few keys.
        const t0 = arrive
        frames.push({ t: from, shot: seq[0].idx, sy: seq[0].scrollY || 0, change: true })
        let typed = 0
        for (const s of seq) {
          for (let c = typed; c < s.chars; c++) sfx.push({ at: +(t0 + c / KEYS_PER_SECOND).toFixed(3), key: 'click', gain: 0.16 })
          typed = s.chars
          frames.push({ t: t0 + s.chars / KEYS_PER_SECOND, shot: s.idx, sy: s.scrollY || 0 })
        }
        at = t0 + typed / KEYS_PER_SECOND + (part.hold ?? 0.3)
      }
      // A text taller than the view is read down to its last line, at a
      // skimming pace (the eye shown it goes on, not made to read it all),
      // once the camera is on it and no finger waits; a clip playing (the
      // roll) moves by itself and is not read over.
      if (!tapBox && focus && (part.cam === 'read' || (shot && !keep && focus.h * L.s * target.z > viewH))) {
        const to = readTo(focus, target, L, sy)
        const dist = (to - target.cy) * L.s * target.z
        if (dist > 12) {
          const go = arrive + CAM.wait
          const dur = clamp(dist / CAM.read, 0.8, CAM.readMax)
          pt.read = { to: +to.toFixed(2), at: +go.toFixed(3), dur: +dur.toFixed(3) }
          at = Math.max(at, go + dur + CAM.linger)
        }
      }
      parts.push(pt)
      cam = pt.read ? { ...target, cy: pt.read.to } : target
      was = focus
    })
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
// A camera's move eases in and out; a text is read at a pace that comes and goes as gently.
const inOut = x => { const c = Math.min(1, Math.max(0, x)); return c < 0.5 ? 4 * c * c * c : 1 - (-2 * c + 2) ** 3 / 2 }
const glide = x => 0.5 - 0.5 * Math.cos(Math.PI * Math.min(1, Math.max(0, x)))
// Where a part leaves the camera: at the foot of the text it read, or where it framed.
const endCam = q => (q.read ? { ...q.cam, cy: q.read.to } : q.cam)
/** The camera at `t` in part `pt`: its move from where the part before it
 *  left the camera, then down the text it reads. */
function camOf(pt, before, t) {
  let cam = pt.cam
  if (pt.enter === 'fade' && pt.move > 0 && before) cam = lerpCam(endCam(before), pt.cam, inOut((t - pt.start) / pt.move))
  if (pt.read && t > pt.read.at) cam = { ...cam, cy: pt.cam.cy + (pt.read.to - pt.cam.cy) * glide((t - pt.read.at) / pt.read.dur) }
  return cam
}

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
    // The app dissolves into the gate: the last beat's last moment, inside
    // it whatever the rounding of the two segments' edges.
    const k = inOut(u / MOTION.out)
    const prev = tl.segs[si - 1]
    if (k < 1 && prev) {
      ctx.save()
      ctx.globalAlpha = 1 - k
      drawFeature(ctx, plan, tl, Math.min(prev.start + prev.dur, sg.start) - 2e-3, imgs, print)
      ctx.restore()
    }
    return `end|${Math.round(u * FEATURE_FPS)}`
  }
  const u = t - sg.start
  const paper = palette('paper')
  // Where the camera is.
  let pi = 0
  for (let i = 0; i < sg.parts.length; i++) if (sg.parts[i].start <= t + 1e-6) pi = i
  const pt = sg.parts[pi]
  const before = pi > 0 ? sg.parts[pi - 1] : si > 0 && tl.segs[si - 1].kind === 'beat' ? tl.segs[si - 1].parts.at(-1) : null
  const cam = camOf(pt, before, t)
  const k = L.s * cam.z
  // The shot showing, and the one before it while a new state comes in.
  let fi = 0
  for (let i = 0; i < sg.frames.length; i++) if (sg.frames[i].t <= t + 1e-6) fi = i
  const cur = sg.frames[fi]
  const last = fi > 0 ? sg.frames[fi - 1] : si > 0 && tl.segs[si - 1].frames ? tl.segs[si - 1].frames.at(-1) : null
  ctx.fillStyle = paper.bg
  ctx.fillRect(0, 0, L.w, L.h)
  // A shot through a camera, standing at its own scroll on the page; its
  // head goes on up in its own colour, its foot on down.
  const view = (f, c, a = 1, dx = 0, dy = 0) => {
    const img = imgs[f.shot]
    if (!img || a <= 0) return
    const kk = L.s * c.z
    const ox = L.w / 2 - c.cx * kk + dx
    const oy = L.yc - (c.cy - (f.sy || 0)) * kk + dy
    ctx.save()
    ctx.globalAlpha *= a
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'
    if (oy > 0) ctx.drawImage(img, 0, 0, SHOT.w, 1, ox, 0, SHOT.w * kk, oy)
    ctx.drawImage(img, ox, oy, SHOT.w * kk, SHOT.h * kk)
    const foot = oy + SHOT.h * kk
    if (foot < L.h) ctx.drawImage(img, 0, SHOT.h - 1, SHOT.w, 1, ox, foot, SHOT.w * kk, L.h - foot)
    ctx.restore()
  }
  const into = t - pt.start
  let kf = 1
  let slid = 1
  if (SLIDES[pt.enter] && last && into < MOTION.slide && cur.t <= pt.start + 1e-6) {
    slid = inOut(into / MOTION.slide)
    const was = before ? endCam(before) : cam
    const [across, coming] = SLIDES[pt.enter]
    const [under, underCam, over, overCam, k0] = coming ? [last, was, cur, cam, slid] : [cur, cam, last, was, 1 - slid]
    if (across) {
      // A new screen slides in from the right as the app's pages do, over
      // the one it leaves, which goes a third of the way left and darkens;
      // one left slides away to the right, the screen under it coming back.
      view(under, underCam, 1, -0.3 * L.w * k0)
      ctx.fillStyle = `rgba(20, 16, 12, ${(0.25 * k0).toFixed(3)})`
      ctx.fillRect(0, 0, L.w, L.h)
      ctx.save()
      ctx.shadowColor = 'rgba(0, 0, 0, 0.35)'
      ctx.shadowBlur = 48
      ctx.shadowOffsetX = -10
      view(over, overCam, 1, L.w * (1 - k0))
      ctx.restore()
    } else {
      // A sheet comes up over the screen it stands on, its own shade with
      // it (the shot draws it), and goes down again.
      view(under, underCam, 1)
      view(over, overCam, k0, 0, 0.12 * L.h * (1 - k0))
    }
  } else {
    // A state changes in a cross-fade, through the same camera.
    kf = cur.change && last ? ease((t - cur.t) / MOTION.fade) : 1
    if (kf < 1) view(last, cam, 1)
    view(cur, cam, kf)
  }
  // A finger: shown before the tap, pressed on it, its ring after.
  let tapKey = ''
  for (const tp of sg.taps) {
    const d = t - tp.t
    if (d < -MOTION.finger || d > MOTION.ring) continue
    const cx = L.w / 2 + (tp.x - cam.cx) * k
    const cy = L.yc + (tp.y - cam.cy) * k
    const show = d < 0 ? ease(1 + d / MOTION.finger) : 1 - d / MOTION.ring
    const r = d < 0 ? 38 : 34
    ctx.fillStyle = `rgba(255,255,255,${(0.5 * show).toFixed(3)})`
    ctx.beginPath()
    ctx.arc(cx, cy, r, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = `rgba(23,21,26,${(0.35 * show).toFixed(3)})`
    ctx.lineWidth = 3
    ctx.stroke()
    if (d >= 0) {
      const kr = ease(d / MOTION.ring)
      ctx.strokeStyle = `rgba(255,255,255,${(0.7 * (1 - kr)).toFixed(3)})`
      ctx.lineWidth = 6
      ctx.beginPath()
      ctx.arc(cx, cy, 34 + 46 * kr, 0, Math.PI * 2)
      ctx.stroke()
    }
    tapKey += `${show.toFixed(3)}|`
  }
  // The caption, on its slip: in with the first beat, its words new at each.
  const ks = si === 0 ? ease(u / MOTION.caption) : 1
  const kc = ease(u / MOTION.caption)
  drawSlip(ctx, plan, L, sg.say, ks, kc)
  return `${si}|${fi}|${kc.toFixed(3)}|${cam.cx.toFixed(1)}|${cam.cy.toFixed(1)}|${cam.z.toFixed(4)}|${kf.toFixed(3)}|${slid.toFixed(3)}|${tapKey}`
}

/** Each caption set as its slip sets it, and the slip's height: as tall
 *  as the plan's tallest caption, so it never moves between two beats. */
const slips = new WeakMap()
function slipOf(ctx, plan, L) {
  const key = `${plan.fit}|${plan.lang}`
  const made = slips.get(plan)
  if (made?.key === key) return made
  const w = L.fr.w
  const room = w - 2 * SLIP.pad - EDGE
  const says = new Map(plan.beats.map(b => [b.say, fit(ctx, b.say, { weight: 900, fam: 'serif', sizes: SLIP.sizes, maxW: room, maxLines: 2, lh: SLIP.lh })]))
  const tallest = Math.max(...[...says.values()].map(b => b.size * (0.82 + (b.lines.length - 1) * SLIP.lh + 0.3)))
  const h = 2 * SLIP.pad + tallest
  const out = { key, says, x: L.fr.x, y: L.fr.bottom - h, w, h }
  slips.set(plan, out)
  return out
}
// The slip, of the print's washi, the feature's line its edge, lifted off the
// screen; `ks` brings it in, `kc` its caption.
function drawSlip(ctx, plan, L, say, ks, kc) {
  const S = slipOf(ctx, plan, L)
  const paper = palette('paper')
  ctx.save()
  ctx.globalAlpha *= ks
  ctx.translate(0, (1 - ks) * 16)
  ctx.save()
  shadow(ctx, '0px 10px 30px rgba(20, 14, 8, 0.4)')
  ctx.fillStyle = APP_INKS['--tpr-washi']
  rrect(ctx, S.x, S.y, S.w, S.h, R.card)
  ctx.fill()
  ctx.restore()
  ctx.save()
  rrect(ctx, S.x, S.y, S.w, S.h, R.card)
  ctx.clip()
  ctx.fillStyle = paper.line[plan.line]
  ctx.fillRect(S.x, S.y, EDGE, S.h)
  ctx.restore()
  const x = S.x + EDGE + SLIP.pad
  const b = S.says.get(say) || fit(ctx, say, { weight: 900, fam: 'serif', sizes: SLIP.sizes, maxW: S.w - 2 * SLIP.pad - EDGE, maxLines: 2, lh: SLIP.lh })
  ctx.globalAlpha *= kc
  ctx.translate(0, (1 - kc) * 12)
  // A caption shorter than the slip's tallest stands in its middle.
  const y0 = S.y + (S.h - b.size * (0.82 + (b.lines.length - 1) * SLIP.lh + 0.3)) / 2
  b.lines.forEach((l, i) => text(ctx, l, x, y0 + b.size * (0.82 + i * SLIP.lh), { f: b.f, color: APP_INKS['--tpr-sumi'] }))
  ctx.restore()
}

/** Where the video's still is taken: its first beat, its caption in. */
export const featureStillAt = () => 1.2

// ── Its page ──────────────────────────────────────────────────
const PAGE = {
  en: {
    app: 'Keep going on Tsuji', start: 'Start free on Tsuji', more: 'Start free on Tsuji.',
    credits: 'Voices: VOICEVOX Nemo.',
    tags: ['LearnJapanese', 'Japanese', 'JLPT', '日本語', 'JapaneseApp'],
  },
  fr: {
    app: 'Continue sur Tsuji', start: 'Commence gratuitement sur Tsuji', more: 'Commence gratuitement sur Tsuji.',
    credits: 'Voix : VOICEVOX Nemo.',
    tags: ['ApprendreLeJaponais', 'Japonais', 'JLPT', '日本語', 'Tsuji'],
  },
}
/** The video's page for YouTube, and its posts for Reels and TikTok. */
export function featurePage(plan, tl, site) {
  const P = PAGE[plan.lang]
  const A = APP[plan.lang]
  const desc = weldIf(plan.lang, A.desc[plan.id] || '').split('\n').filter(Boolean)
  const voiced = tl.cues.length > 0
  const credits = voiced ? P.credits : ''
  const tags = P.tags
  const title = `${plan.title} #shorts`
  const lines = [`${plan.jp} ${plan.name}`, ...desc.map(x => `· ${x}`)].join('\n')
  const page = {
    title,
    description: [lines, `${P.start}: ${site}`, credits, [...tags, 'Shorts'].map(x => `#${x}`).join(' ')].filter(Boolean).join('\n\n'),
    tags: [...tags, plan.name, 'Tsuji', 'shorts'].join(', '),
  }
  return { ...page, feeds: feedPosts(page, { hook: plan.title, lines: [lines], app: P.more.replace(/\.$/, ''), credits: credits ? [credits] : [], hashtags: tags }, plan.lang) }
}

/** The command that makes the video, from frontend/. */
export function featureCommand(id, lang = 'en', fit = 'tiktok', hour = 'day') {
  return ['VOICEVOX_URL=http://localhost:50121 node carousel/long/render.mjs', `--feature ${id}`, `--lang ${lang}`, fit !== 'tiktok' ? `--fit ${fit}` : '', hour !== 'day' ? `--hour ${hour}` : ''].filter(Boolean).join(' ')
}
