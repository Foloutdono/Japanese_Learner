// ── The landing page's words, in both languages (plan 167) ──
// French first, as the app is: the English page is a translation of
// this one, never a page of its own. The titles and descriptions are
// docs/seo/keywords.md's, character for character; change them there
// first. French typography (the space before : ; ? !) is set by the
// renderer, so the strings below are written with plain spaces.
//
// Every figure comes in through `facts` (content.mjs), counted from
// the decks; nothing here states a number the content does not.
import { arrivals, spanOf } from './content.mjs'

const FR_NUM = new Intl.NumberFormat('fr-FR')
const EN_NUM = new Intl.NumberFormat('en-GB')

// The demo cards (the method's trial). Each carries the forecast the
// app's scheduler gives it, in seconds, for Wrong, Almost, Difficult and
// Correct, and its progress band: backend/srs/scheduler.py and
// srs.py's _progress, run on the state each card stands in (new; the
// third and fourth learning steps; graduated at 30 days).
const NEW = [180, 180, 390, 600]
const STEP_3 = [180, 600, 45000, 86400]
const STEP_4 = [180, 3600, 86400, 172800]
const KNOWN = [180, 600, 74 * 86400, 80 * 86400]

export const CARDS = [
  { glyph: '駅', serif: true, reading: 'えき', example: '駅はどこですか。', stage: 'new', progress: 0, due: NEW, kind: 'kanji' },
  { glyph: '電車', reading: 'でんしゃ', example: '電車で行きます。', stage: 'learning', progress: 0.375, due: STEP_4, kind: 'vocab' },
  // `sound` is the kana deck's clip (public/sounds/kanas/), heard as the card turns, as the app plays it.
  { glyph: 'ぬ', reading: '', example: 'いぬ', stage: 'learning', progress: 0.25, due: STEP_3, kind: 'kana', sound: 'nu' },
  { glyph: '〜ている', reading: '', example: '雨が降っている。', stage: 'new', progress: 0, due: NEW, kind: 'grammar' },
  { glyph: '友達', reading: 'ともだち', example: '友達を待っています。', stage: 'mastered', progress: 1, due: KNOWN, kind: 'vocab' },
]

// The analyser's sentence, a token each: 駅で友達を待っています。
// `point` is the numbered grammar point the word carries (the tools'
// `points`, from 1), 0 for none: the sentence is numbered as the app's
// analyser numbers it.
export const TOKENS = [
  { surface: '駅', reading: 'えき', dict: '駅', dictReading: 'えき', gram: false, point: 0 },
  { surface: 'で', reading: '', dict: '〜で', dictReading: '', gram: true, point: 1 },
  { surface: '友達', reading: 'ともだち', dict: '友達', dictReading: 'ともだち', gram: false, point: 0 },
  { surface: 'を', reading: '', dict: '〜を', dictReading: '', gram: true, point: 2 },
  { surface: '待っています', reading: 'まっています', dict: '待つ', dictReading: 'まつ', gram: false, point: 3 },
]

// The mock exam's item: この駅はとても大きいです, 駅 underlined.
export const EXAM_OPTIONS = ['えき', 'えい', 'いき', 'えっき']

/** "dans 10 min", "demain", "dans 2 mois": domain/forecast.js's dueText. */
function dueWith(t) {
  return seconds => {
    const s = Math.max(0, seconds)
    if (s < 3600) return t.minutes(Math.max(1, Math.round(s / 60)))
    if (s < 86400) return t.hours(Math.max(1, Math.round(s / 3600)))
    const days = Math.round(s / 86400)
    if (days <= 1) return t.tomorrow
    if (days < 14) return t.days(days)
    if (days < 60) return t.weeks(Math.round(days / 7))
    return t.months(Math.round(days / 30))
  }
}

const fr = facts => {
  const n = x => FR_NUM.format(x)
  const span = ({ months, years, half }) => months != null
    ? `≈ ${months} mois`
    : `≈ ${years} an${years > 1 ? 's' : ''}${half ? ' ½' : ''}`
  const n5At10 = spanOf(arrivals(facts, 10)[0].days)
  return {
    lang: 'fr',
    num: n,
    title: 'Apprendre le japonais : kana, kanji, JLPT N5 à N1 | Tsuji',
    description: "L'application pour apprendre le japonais un peu chaque jour : kana, vocabulaire, kanji et grammaire revus au bon moment, dictées et examens blancs du JLPT.",
    ogTitle: 'Tsuji — apprendre le japonais, du premier kana au JLPT N1',
    ogAlt: 'Tsuji, le carrefour : quatre lignes de kana au JLPT N1.',
    skip: 'Aller au contenu',
    home: 'Tsuji, accueil',
    ids: { lines: 'lignes', line: 'ligne', method: 'methode', features: 'fonctionnalites', jlpt: 'jlpt', tools: 'outils', fare: 'tarif', faq: 'faq', presentation: 'presentation', way: 'depart' },
    // Every section is a stop on the gold line: its sign names the next.
    next: 'Suivant',
    nextTo: name => `Suivant : ${name}`,
    terminus: 'Terminus',
    nav: [['lines', 'Apprendre'], ['line', 'Ta ligne'], ['method', 'La méthode'], ['features', 'Fonctionnalités'], ['jlpt', 'Examen JLPT'], ['fare', 'Tarif'], ['faq', 'FAQ']],
    navLabel: 'Sections',
    langLabel: 'Langue',
    signIn: 'Se connecter',
    // The switch for the demos' sounds, which is the app's own mute.
    sound: 'Sons',

    hero: {
      kicker: "L'application pour apprendre le japonais",
      h1: 'Apprendre le japonais, du premier kana au JLPT N1.',
      lead: 'Chaque jour, Tsuji te rend les cartes que tu allais oublier, puis de vraies phrases à lire, écouter et écrire. Kana, vocabulaire, kanji et grammaire, de N5 à N1.',
      stations: { kana: 'Kana', vocab: 'Vocabulaire', kanji: 'Kanji', grammar: 'Grammaire', reading: 'Lecture', honyaku: 'Traduction', kakitori: 'Dictée' },
      rolls: [['あ', 'Kana'], ['電車', 'Vocabulaire'], ['駅', 'Kanji'], ['〜ている', 'Grammaire'], ['ア', 'Kana'],
        ['読む', 'Lecture'], ['訳す', 'Traduction'], ['書く', 'Dictée'], ['解析', 'Analyseur'], ['模試', 'Examen blanc']],
      tagline: 'Un trajet taillé pour toi.',
      cue: 'Découvrir',
      watch: 'Voir la présentation',
      note: stores => stores
        ? "Gratuit pendant l'accès anticipé · sans compte · iPhone, Android et navigateur"
        : "Gratuit pendant l'accès anticipé · sans compte · dans ton navigateur, bientôt sur iPhone et Android",
    },
    board: 'Embarquer',
    boardAria: 'Embarquer : commencer gratuitement dans le navigateur',
    badges: {
      appStore: ['Télécharger dans', "l'App Store"],
      googlePlay: ['Disponible sur', 'Google Play'],
      soon: { appStore: 'Bientôt sur', googlePlay: 'Bientôt sur' },
    },

    figuresLabel: 'Tsuji en chiffres',
    figures: [
      [n(facts.words), 'mots, de N5 à N1'],
      [n(facts.kanji), 'kanji et leurs traits'],
      [n(facts.grammar), 'points de grammaire'],
      ['N5 → N1', 'les cinq niveaux du JLPT'],
      ['6', 'façons de pratiquer'],
    ],

    presentation: {
      kicker: 'Présentation',
      h2: 'Tout Tsuji en 90 secondes',
      body: "Du premier kana à l'examen blanc, la présentation de l'app, sous-titrée en français et en anglais.",
      play: 'Lire la présentation de Tsuji',
      chapters: ["Aujourd'hui", 'Kana et kanji', 'Grammaire', 'Pratique', 'Analyseur', 'Examen blanc'],
      chaptersLabel: 'Chapitres',
      captions: 'Sous-titres',
      videoName: 'Tsuji, la présentation',
      videoDescription: "Tsuji en une minute et demie : le trajet du jour, les kana et les kanji, la grammaire, la pratique, l'analyseur et l'examen blanc du JLPT.",
    },

    lines: {
      kicker: 'Apprendre',
      h2: 'Hiragana, vocabulaire, kanji et grammaire japonaise : quatre lignes, de N5 à N1',
      body: "Chaque ligne s'arrête à chaque niveau du JLPT. Tu montes à la bonne station, Tsuji dose les nouvelles cartes et te dit quand tu arrives à la suivante.",
      plates: {
        kana: { reading: 'かな', h3: 'Hiragana et katakana', body: "Son par son, chaque kana lu par une voix enregistrée. Les reconnaître d'abord, les écrire à la main ensuite : le sol sur lequel tout le reste repose.", chips: ['Hiragana', 'Katakana'], stage: 'En cours', gloss: 'a' },
        vocab: { reading: 'ごい', h3: 'Vocabulaire du JLPT', body: `Les ${n(facts.words)} mots du programme, par niveau, par fréquence ou par thème, tous glosés en français. De la forme au sens, puis du sens à la forme.`, stops: 'De N5 à N1', stage: 'Nouveau', gloss: 'train' },
        kanji: { reading: 'かんじ', h3: 'Kanji', body: `${n(facts.kanji)} caractères par niveau, avec l'ordre des traits animé. Chaque lecture, chaque sens ; les lire, puis les tracer de mémoire.`, chips: ['Ordre des traits', `${n(facts.radicals)} radicaux`], stage: 'Maîtrisé', strokes: 'エキ · 14 traits', gloss: 'gare' },
        grammar: { reading: 'ぶんぽう', h3: 'Grammaire japonaise', body: `${n(facts.grammar)} points, de N5 à N1, chacun avec sa leçon : ce à quoi le point s'accroche, ce qu'il fait, ses rivaux, et des phrases qui l'emploient vraiment.`, chips: ['Leçons en français', `${n(facts.examples)} exemples`], gloss: 'Il pleut (en ce moment).' },
      },
    },

    line: {
      kicker: 'Ta ligne',
      h2: 'Combien de temps pour apprendre le japonais ? Du premier kana au JLPT N1, à ton rythme',
      body: "Tsuji te demande d'où tu pars et combien de minutes tu as chaque jour, place ton départ et calcule ton arrivée à chaque station. Choisis un rythme :",
      rhythmsLabel: 'Minutes par jour',
      rhythm: m => `${m} min`,
      note: 'Estimation de Tsuji : un mot, un kanji ou un point nouveau par minute, en partant de zéro. Les révisions s’ajoutent au trajet.',
      plate: 'Ta ligne',
      at: m => `À ${m} min par jour`,
      kana: `${n(facts.kana)} kana`,
      here: 'tu es ici',
      start: 'départ',
      counts: l => `${n(l.words)} mots · ${n(l.kanji)} kanji · ${n(l.grammar)} points`,
      countsShort: l => `${n(l.words)} mots · ${n(l.kanji)} kanji`,
      span,
    },

    method: {
      kicker: 'La méthode',
      h2: 'La répétition espacée, sans rien régler : essaie',
      body: "Retourne la carte, puis dis comment ça s'est passé : Tsuji décide quand elle reviendra. Chaque jour, tout ce qui est dû sur toutes tes lignes t'attend dans une seule file, avec le temps qu'elle prendra.",
      day: { count: '42', unit: 'cartes · ≈ 14 min', lengthLabel: 'Longueur du trajet', lengths: ['20', '50', '100', 'Tout'], sharesLabel: 'La part de chaque ligne' },
      stamps: '月火水木金土日',
      stampsLabel: 'Six jours de trajet sur sept',
      stampsNote: 'Un tampon par jour de trajet',
      reminder: "Dans l'app mobile, un rappel à ton heure, jamais plus d'un par jour, et un widget avec le compte du jour.",
      trial: 'Essai : une révision',
      trialPos: (i, total) => `Essai · carte ${i} / ${total}`,
      flip: 'Touche pour retourner',
      flipAria: 'Retourner la carte',
      rateLabel: "Comment ça s'est passé ?",
      ratings: ['Raté', 'Presque', 'Difficile', 'Correct'],
      level: 'Niv. 3',
      xp: x => `+${x} XP`,
      kinds: { kanji: 'Kanji', vocab: 'Vocabulaire', kana: 'Kana', grammar: 'Grammaire' },
      stages: { new: 'Nouveau', learning: 'En cours', mastered: 'Maîtrisé' },
      cards: [
        { meaning: 'gare', translation: 'Où est la gare ?' },
        { meaning: 'train', translation: "J'y vais en train." },
        { meaning: 'nu', translation: 'chien' },
        { meaning: 'une action en cours', translation: 'Il pleut en ce moment.' },
        { meaning: 'ami', translation: "J'attends un ami." },
      ],
      due: dueWith({ minutes: x => `${x} min`, hours: x => `${x} h`, tomorrow: 'demain', days: x => `${x} j`, weeks: x => `${x} sem.`, months: x => `${x} mois` }),
    },

    features: {
      kicker: 'Fonctionnalités',
      h2: 'Kana, kanji, grammaire, analyseur : chaque fonctionnalité en action',
      body: "Choisis une fonctionnalité : l'extrait montre l'app telle qu'elle est, sans montage.",
      tabsLabel: 'Fonctionnalités',
      devicesLabel: 'Appareil',
      devices: { phone: 'Téléphone', desk: 'Ordinateur' },
      play: name => `Lire l'extrait : ${name}`,
      items: {
        aujourdhui: { name: "Aujourd'hui", line: "Toutes tes révisions dans une seule file, avec le temps qu'elle prendra.", what: 'Le guichet du jour : les cartes dues sur toutes les lignes, puis le départ.' },
        kana: { name: 'Kana', line: 'Hiragana et katakana, son par son, puis tracés du doigt.', what: "Reconnaître un kana, l'entendre, puis le tracer." },
        vocabulaire: { name: 'Vocabulaire', line: `${n(facts.words)} mots du JLPT, glosés en français, dans les deux sens.`, what: 'Une carte retournée, notée, et la suivante qui arrive.' },
        kanji: { name: 'Kanji', line: "L'ordre des traits animé, puis le kanji tracé de mémoire.", what: 'Le tracé animé, puis le kanji écrit de mémoire.' },
        grammaire: { name: 'Grammaire', line: 'Une leçon par point, puis la phrase à compléter.', what: "La leçon d'un point, puis la phrase qui l'emploie." },
        pratique: { name: 'Lecture et dictée', line: 'De vraies phrases à lire, à écouter et à écrire, à ton niveau.', what: 'Une phrase lue, une phrase entendue, chacune vérifiée.' },
        analyseur: { name: 'Analyseur', line: 'Une vidéo YouTube, une photo ou un texte, décortiqués mot à mot.', what: 'Un sous-titre YouTube découpé, sa grammaire numérotée.' },
        examen: { name: 'Examen blanc', line: 'Une épreuve au format du JLPT, chronométrée et notée sur 180.', what: 'Une épreuve chronométrée, puis la note et la correction.' },
      },
    },

    jlpt: {
      kicker: 'Examen JLPT',
      h2: 'Des examens blancs du JLPT, de N5 à N1',
      body: `Vocabulaire, grammaire, lecture et écoute, chronométrés et notés sur 180 avec les seuils de réussite officiels. Au N5, ${facts.exam.questions} questions en ${facts.exam.minutes} minutes : tu sais où tu en es avant de t'inscrire.`,
      note: "Au format officiel, notation non officielle. Aucune question copiée d'une vraie session.",
      head: 'N5 · Lecture des kanji · Question 1',
      timer: `${facts.exam.minutes - 1}:12`,
      optionsLabel: 'Choisis la lecture',
      ask: 'Choisis une lecture.',
      right: 'Juste : 駅 se lit えき.',
      wrong: 'Pas tout à fait : 駅 se lit えき.',
    },

    tools: {
      kicker: 'Les outils',
      h2: 'Un dictionnaire japonais-français et un analyseur de phrases',
      body: "Tape, photographie ou colle un lien YouTube : Tsuji découpe la phrase mot à mot et numérote sa grammaire. La photo est lue sur ton appareil ; l'image ne le quitte pas.",
      stage: 'En cours',
      sense: '1. gare, station',
      compounds: [['駅', '員', 'えきいん', 'employé de gare'], ['駅', '前', 'えきまえ', 'devant la gare'], ['東京', '駅', 'とうきょうえき', 'gare de Tokyo']],
      intakes: ['Texte', 'Photo', 'YouTube'],
      tap: 'Touche un mot',
      translation: "J'attends un ami à la gare.",
      tokens: [
        { meaning: 'gare, station', kind: 'Nom · N5', note: 'Le lieu : il porte la particule で.' },
        { meaning: "le lieu de l'action", kind: 'Particule · point 1', note: 'Là où se passe ce que fait le verbe.' },
        { meaning: 'ami', kind: 'Nom · N5', note: "Ce qu'on attend : il porte を." },
        { meaning: "l'objet de l'action", kind: 'Particule · point 2', note: 'Ce sur quoi porte le verbe.' },
        { meaning: 'attendre', kind: 'Verbe · N5 · point 3', note: '待つ à la forme 〜ています : une action en cours.' },
      ],
      points: [['〜で', 'le lieu'], ['〜を', "l'objet"], ['〜ている', 'en cours']],
      pointsLabel: 'La grammaire de la phrase',
    },

    fare: {
      kicker: 'Tarif',
      h2: "Gratuit pendant l'accès anticipé",
      body: "Toutes les lignes, tous les exercices, l'analyseur et le dictionnaire, ouverts à tous. Un abonnement viendra plus tard pour réviser sans compter ; les kana resteront toujours gratuits.",
      promises: [
        ['Sans publicité, sans traqueur', 'Aucune revente de données. Nos statistiques ne contiennent jamais ce que tu tapes.'],
        ['Une grammaire passée au crible', "Rédigée avec l'IA, puis relue en continu par des agents IA qui y traquent les erreurs. Chaque exemple est vérifié."],
        ['Tout se lit à voix haute', 'Les kana par une voix humaine enregistrée, le reste par une voix japonaise de synthèse.'],
        ["Tes données t'appartiennent", 'Exporte ta progression en CSV, supprime ton compte en deux gestes.'],
      ],
    },

    faq: {
      kicker: 'Questions',
      h2: 'Apprendre le japonais avec Tsuji',
      items: [
        ['Combien de temps faut-il pour apprendre le japonais ?', `Jusqu'au N5, ${span(n5At10).replace('≈ ', 'environ ')} à dix minutes par jour en partant de zéro, kana compris, selon l'estimation de Tsuji. Il te montre ta propre date d'arrivée et la recalcule quand ton rythme change.`],
        ['Par où commencer : hiragana, katakana ou kanji ?', 'Par les hiragana puis les katakana : ils écrivent tout le reste. Tsuji te demande ce que tu sais déjà et te fait monter à la bonne station.'],
        ["Qu'est-ce que la répétition espacée ?", "Chaque carte revient à l'intervalle où tu étais sur le point de l'oublier : quelques minutes après une erreur, des jours puis des semaines quand tu la sais. C'est ce que fait la carte d'essai plus haut."],
        ['Tsuji est-il gratuit ?', "Oui, pendant l'accès anticipé, sans compte pour commencer. Un abonnement viendra plus tard pour réviser sans compter ; les kana resteront gratuits."],
        ['Tsuji remplace-t-il Anki ?', "La même répétition espacée, sans rien à configurer, avec le programme du JLPT déjà écrit. Tes propres cartes s'y ajoutent, ou s'importent d'un tableur."],
        ['Mes données sont-elles revendues ?', 'Non. Aucune publicité, aucun traqueur, aucune revente ; ta progression s’exporte et ton compte se supprime en deux gestes.'],
      ],
    },

    pass: {
      h2: 'Ton pass t’attend.',
      body: 'Un trajet taillé pour toi : écris ton prénom, embarque, et Tsuji imprime ta ligne.',
      nameLabel: 'Ton prénom',
      name: 'Ton prénom',
      aria: 'Aperçu de ton pass',
      route: 'Trajet',
      per: m => `${m} min / jour`,
      lines: 'Lignes',
      linesAria: 'Kana, vocabulaire, kanji, grammaire',
      arrival: 'Arrivée prévue',
      level: 'Niv. 1',
    },

    // The feature screens drawn where a clip is not yet filmed: each is
    // the app's own screen, in its words (the Today button, Check,
    // Explain), at phone size.
    mock: {
      depart: 'Embarquer',
      check: 'Vérifier',
      explain: 'Expliquer',
      question: (i, n) => `Question ${i} / ${n}`,
      lanes: 'Lignes du jour',
      typed: 'eki de tomodachi o matte imasu',
      field: 'En rōmaji',
      fill: 'Complète la phrase',
      subtitle: 'Sous-titre',
      strokes: n => `${n} traits`,
      readings: 'Lectures',
      traced: 'Ordre des traits',
    },

    footer: {
      privacy: 'Confidentialité',
      contact: 'Contact',
      other: 'English',
      credits: 'Voix : VOICEVOX Nemo · 波音リツ. Tracés des kanji : KanjiVG (CC BY-SA 3.0). JLPT est une marque de la Japan Foundation et de JEES, sans lien avec Tsuji.',
    },
    appCategory: 'EducationalApplication',
  }
}

const en = facts => {
  const n = x => EN_NUM.format(x)
  const span = ({ months, years, half }) => months != null
    ? `≈ ${months} month${months > 1 ? 's' : ''}`
    : `≈ ${years}${half ? '½' : ''} year${years > 1 || half ? 's' : ''}`
  const n5At10 = spanOf(arrivals(facts, 10)[0].days)
  return {
    lang: 'en',
    num: n,
    title: 'Learn Japanese: kana, kanji and JLPT N5 to N1 | Tsuji',
    description: 'The app to learn Japanese a little every day: kana, vocabulary, kanji and grammar reviewed at the right moment, with dictation and JLPT mock exams.',
    ogTitle: 'Tsuji — learn Japanese, from your first kana to JLPT N1',
    ogAlt: 'Tsuji, the crossroads: four lines from kana to JLPT N1.',
    skip: 'Skip to content',
    home: 'Tsuji, home',
    ids: { lines: 'lines', line: 'your-line', method: 'method', features: 'features', jlpt: 'jlpt', tools: 'tools', fare: 'pricing', faq: 'faq', presentation: 'presentation', way: 'board' },
    next: 'Next',
    nextTo: name => `Next: ${name}`,
    terminus: 'Last stop',
    nav: [['lines', 'Learn'], ['line', 'Your line'], ['method', 'The method'], ['features', 'Features'], ['jlpt', 'JLPT exam'], ['fare', 'Pricing'], ['faq', 'FAQ']],
    navLabel: 'Sections',
    langLabel: 'Language',
    signIn: 'Sign in',
    sound: 'Sound',

    hero: {
      kicker: 'The app to learn Japanese',
      h1: 'Learn Japanese, from your first kana to JLPT N1.',
      lead: 'Every day, Tsuji brings back the cards you were about to forget, then real sentences to read, hear and write. Kana, vocabulary, kanji and grammar, from N5 to N1.',
      stations: { kana: 'Kana', vocab: 'Vocabulary', kanji: 'Kanji', grammar: 'Grammar', reading: 'Reading', honyaku: 'Translation', kakitori: 'Dictation' },
      rolls: [['あ', 'Kana'], ['電車', 'Vocabulary'], ['駅', 'Kanji'], ['〜ている', 'Grammar'], ['ア', 'Kana'],
        ['読む', 'Reading'], ['訳す', 'Translation'], ['書く', 'Dictation'], ['解析', 'Analyser'], ['模試', 'Mock exam']],
      tagline: 'A ride cut to fit you.',
      cue: 'Explore',
      watch: 'Watch the overview',
      note: stores => stores
        ? 'Free during early access · no account needed · iPhone, Android and the web'
        : 'Free during early access · no account needed · in your browser, soon on iPhone and Android',
    },
    board: 'Board',
    boardAria: 'Board: start for free in your browser',
    badges: {
      appStore: ['Download on the', 'App Store'],
      googlePlay: ['Get it on', 'Google Play'],
      soon: { appStore: 'Coming to the', googlePlay: 'Coming to' },
    },

    figuresLabel: 'Tsuji in figures',
    figures: [
      [n(facts.words), 'words, N5 to N1'],
      [n(facts.kanji), 'kanji and their strokes'],
      [n(facts.grammar), 'grammar points'],
      ['N5 → N1', 'all five JLPT levels'],
      ['6', 'ways to practise'],
    ],

    presentation: {
      kicker: 'Overview',
      h2: 'All of Tsuji in 90 seconds',
      body: 'From your first kana to the mock exam: the app in one film, with French and English subtitles.',
      play: 'Play the Tsuji overview',
      chapters: ['Today', 'Kana and kanji', 'Grammar', 'Practice', 'Analyser', 'Mock exam'],
      chaptersLabel: 'Chapters',
      captions: 'Subtitles',
      videoName: 'Tsuji, the overview',
      videoDescription: "Tsuji in a minute and a half: the day's ride, kana and kanji, grammar, practice, the analyser and the JLPT mock exam.",
    },

    lines: {
      kicker: 'Learn',
      h2: 'Hiragana, vocabulary, kanji and Japanese grammar: four lines, N5 to N1',
      body: 'Each line stops at every JLPT level. You board at the right station; Tsuji paces the new cards and tells you when you reach the next.',
      plates: {
        kana: { reading: 'かな', h3: 'Hiragana and katakana', body: 'Sound by sound, every kana read by a recorded voice. Recognise them first, then write them by hand: the ground everything else stands on.', chips: ['Hiragana', 'Katakana'], stage: 'Learning', gloss: 'a' },
        vocab: { reading: 'ごい', h3: 'JLPT vocabulary', body: `All ${n(facts.words)} words of the syllabus, by level, by frequency or by theme, each glossed in English and French. From the form to the meaning, then back.`, stops: 'N5 to N1', stage: 'New', gloss: 'train' },
        kanji: { reading: 'かんじ', h3: 'Kanji', body: `${n(facts.kanji)} characters by level, with animated stroke order. Every reading, every meaning; read them, then write them from memory.`, chips: ['Stroke order', `${n(facts.radicals)} radicals`], stage: 'Mastered', strokes: 'エキ · 14 strokes', gloss: 'station' },
        grammar: { reading: 'ぶんぽう', h3: 'Japanese grammar', body: `${n(facts.grammar)} points, N5 to N1, each with its lesson: what the point attaches to, what it does, its rivals, and sentences that really use it.`, chips: ['Lessons in English', `${n(facts.examples)} examples`], gloss: "It's raining (right now)." },
      },
    },

    line: {
      kicker: 'Your line',
      h2: 'How long does it take to learn Japanese? From your first kana to JLPT N1, at your pace',
      body: 'Tsuji asks where you start and how many minutes you have each day, then places your departure and works out your arrival at every station. Pick a pace:',
      rhythmsLabel: 'Minutes a day',
      rhythm: m => `${m} min`,
      note: "Tsuji's estimate: one new word, kanji or point a minute, from zero. Reviews ride along.",
      plate: 'Your line',
      at: m => `At ${m} min a day`,
      kana: `${n(facts.kana)} kana`,
      here: 'you are here',
      start: 'start',
      counts: l => `${n(l.words)} words · ${n(l.kanji)} kanji · ${n(l.grammar)} points`,
      countsShort: l => `${n(l.words)} words · ${n(l.kanji)} kanji`,
      span,
    },

    method: {
      kicker: 'The method',
      h2: 'Spaced repetition, nothing to set up: try it',
      body: 'Flip the card, then say how it went: Tsuji decides when it comes back. Every day, everything due on all your lines waits in a single queue, with the time it will take.',
      day: { count: '42', unit: 'cards · ≈ 14 min', lengthLabel: 'Length of the ride', lengths: ['20', '50', '100', 'All'], sharesLabel: "Each line's share" },
      stamps: '月火水木金土日',
      stampsLabel: 'Six days of riding out of seven',
      stampsNote: 'A stamp for every day you ride',
      reminder: 'In the mobile app, a reminder at your hour, never more than one a day, and a widget with the day’s count.',
      trial: 'Try it: one review',
      trialPos: (i, total) => `Try it · card ${i} / ${total}`,
      flip: 'Tap to flip',
      flipAria: 'Flip the card',
      rateLabel: 'How did it go?',
      ratings: ['Wrong', 'Almost', 'Difficult', 'Correct'],
      level: 'Lv. 3',
      xp: x => `+${x} XP`,
      kinds: { kanji: 'Kanji', vocab: 'Vocabulary', kana: 'Kana', grammar: 'Grammar' },
      stages: { new: 'New', learning: 'Learning', mastered: 'Mastered' },
      cards: [
        { meaning: 'station', translation: 'Where is the station?' },
        { meaning: 'train', translation: "I'm going by train." },
        { meaning: 'nu', translation: 'dog' },
        { meaning: 'an action in progress', translation: "It's raining right now." },
        { meaning: 'friend', translation: "I'm waiting for a friend." },
      ],
      due: dueWith({ minutes: x => `${x} min`, hours: x => `${x} h`, tomorrow: 'tomorrow', days: x => `${x} d`, weeks: x => `${x} wk`, months: x => `${x} mo` }),
    },

    features: {
      kicker: 'Features',
      h2: 'Kana, kanji, grammar, the analyser: every feature in action',
      body: 'Pick a feature: the clip shows the app as it is, unedited.',
      tabsLabel: 'Features',
      devicesLabel: 'Device',
      devices: { phone: 'Phone', desk: 'Computer' },
      play: name => `Play the clip: ${name}`,
      items: {
        aujourdhui: { name: 'Today', line: 'All your reviews in a single queue, with the time it will take.', what: "The day's gate: the cards due on every line, then departure." },
        kana: { name: 'Kana', line: 'Hiragana and katakana, sound by sound, then traced with a finger.', what: 'Recognise a kana, hear it, then trace it.' },
        vocabulaire: { name: 'Vocabulary', line: `${n(facts.words)} JLPT words, glossed, in both directions.`, what: 'A card flipped, rated, and the next one arriving.' },
        kanji: { name: 'Kanji', line: 'Animated stroke order, then the kanji written from memory.', what: 'The strokes animated, then the kanji written from memory.' },
        grammaire: { name: 'Grammar', line: 'A lesson per point, then the sentence to complete.', what: 'The lesson for a point, then the sentence that uses it.' },
        pratique: { name: 'Reading and dictation', line: 'Real sentences to read, hear and write, at your level.', what: 'A sentence read, a sentence heard, each one checked.' },
        analyseur: { name: 'Analyser', line: 'A YouTube video, a photo or a text, taken apart word by word.', what: 'A YouTube subtitle taken apart, its grammar numbered.' },
        examen: { name: 'Mock exam', line: 'A paper in the JLPT format, timed and scored out of 180.', what: 'A timed paper, then the score and the answers.' },
      },
    },

    jlpt: {
      kicker: 'JLPT exam',
      h2: 'JLPT mock exams, N5 to N1',
      body: `Vocabulary, grammar, reading and listening, timed and scored out of 180 against the official pass marks. At N5, ${facts.exam.questions} questions in ${facts.exam.minutes} minutes: you know where you stand before you register.`,
      note: 'Official format, unofficial scoring. No question copied from a real session.',
      head: 'N5 · Kanji reading · Question 1',
      timer: `${facts.exam.minutes - 1}:12`,
      optionsLabel: 'Pick the reading',
      ask: 'Pick a reading.',
      right: 'Right: 駅 reads えき.',
      wrong: 'Not quite: 駅 reads えき.',
    },

    tools: {
      kicker: 'The tools',
      h2: 'A Japanese dictionary and a sentence analyser',
      body: 'Type, photograph or paste a YouTube link: Tsuji takes the sentence apart word by word and numbers its grammar. The photo is read on your device; the image never leaves it.',
      stage: 'Learning',
      sense: '1. station',
      compounds: [['駅', '員', 'えきいん', 'station attendant'], ['駅', '前', 'えきまえ', 'in front of the station'], ['東京', '駅', 'とうきょうえき', 'Tokyo Station']],
      intakes: ['Text', 'Photo', 'YouTube'],
      tap: 'Tap a word',
      translation: "I'm waiting for a friend at the station.",
      tokens: [
        { meaning: 'station', kind: 'Noun · N5', note: 'The place: it carries the particle で.' },
        { meaning: 'the place of the action', kind: 'Particle · point 1', note: 'Where what the verb does happens.' },
        { meaning: 'friend', kind: 'Noun · N5', note: 'Who is waited for: it carries を.' },
        { meaning: 'the object of the action', kind: 'Particle · point 2', note: 'What the verb acts on.' },
        { meaning: 'to wait', kind: 'Verb · N5 · point 3', note: '待つ in the 〜ています form: an action in progress.' },
      ],
      points: [['〜で', 'the place'], ['〜を', 'the object'], ['〜ている', 'in progress']],
      pointsLabel: "The sentence's grammar",
    },

    fare: {
      kicker: 'Pricing',
      h2: 'Free during early access',
      body: 'Every line, every exercise, the analyser and the dictionary, open to all. A subscription will come later for unlimited reviews; the kana will always stay free.',
      promises: [
        ['No ads, no trackers', 'No sale of data. Our statistics never contain what you type.'],
        ['Grammar under constant review', 'Drafted with AI, then reviewed continually by AI agents that hunt for its errors. Every example is checked.'],
        ['Everything read aloud', 'The kana by a recorded human voice, the rest by a synthesised Japanese voice.'],
        ['Your data is yours', 'Export your progress as CSV, delete your account in two taps.'],
      ],
    },

    faq: {
      kicker: 'Questions',
      h2: 'Learning Japanese with Tsuji',
      items: [
        ['How long does it take to learn Japanese?', `To N5, ${span(n5At10).replace('≈ ', 'about ')} at ten minutes a day from zero, kana included, by Tsuji's estimate. It shows you your own arrival date and works it out again when your pace changes.`],
        ['Where to start: hiragana, katakana or kanji?', 'With hiragana, then katakana: they write everything else. Tsuji asks what you already know and boards you at the right station.'],
        ['What is spaced repetition?', "Each card comes back at the interval where you were about to forget it: minutes after a miss, days then weeks once you know it. It is what the trial card above does."],
        ['Is Tsuji free?', 'Yes, during early access, with no account needed to start. A subscription will come later for unlimited reviews; the kana will stay free.'],
        ['Does Tsuji replace Anki?', 'The same spaced repetition, with nothing to configure and the JLPT syllabus already written. Your own cards join in, or import from a spreadsheet.'],
        ['Is my data sold?', 'No. No ads, no trackers, no sale of data; your progress exports and your account deletes in two taps.'],
      ],
    },

    pass: {
      h2: 'Your pass is waiting.',
      body: 'A ride cut to fit you: write your first name, board, and Tsuji prints your line.',
      nameLabel: 'Your first name',
      name: 'Your name',
      aria: 'Preview of your pass',
      route: 'Ride',
      per: m => `${m} min a day`,
      lines: 'Lines',
      linesAria: 'Kana, vocabulary, kanji, grammar',
      arrival: 'Arriving',
      level: 'Lv. 1',
    },

    mock: {
      depart: 'Depart',
      check: 'Check',
      explain: 'Explain',
      question: (i, n) => `Question ${i} / ${n}`,
      lanes: "Today's lines",
      typed: 'eki de tomodachi o matte imasu',
      field: 'In rōmaji',
      fill: 'Complete the sentence',
      subtitle: 'Subtitle',
      strokes: n => `${n} strokes`,
      readings: 'Readings',
      traced: 'Stroke order',
    },

    footer: {
      privacy: 'Privacy',
      contact: 'Contact',
      other: 'Français',
      credits: 'Voices: VOICEVOX Nemo · 波音リツ. Kanji strokes: KanjiVG (CC BY-SA 3.0). JLPT is a trademark of the Japan Foundation and JEES, not affiliated with Tsuji.',
    },
    appCategory: 'EducationalApplication',
  }
}

export const STRINGS = { fr, en }
