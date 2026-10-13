// ── カルーセル — the words on the slides (plan 200) ────────────────
// Every label a slide prints, in the two languages the app speaks. A
// label is in the reader's language; Japanese is content, never a
// caption over the word that does the work (DESIGN.md, "Say less").

export const STRINGS = {
  en: {
    prompt: {
      sentence: { plates: 'Read it before the doors close.', board: 'Next departure. Can you read it?', card: 'Say it out loud, then swipe.' },
      translation: 'How do you say it in Japanese?',
      lesson: 'Do you know this pattern?',
      word: 'Can you read this word?',
      kanji: 'How do you read this kanji?',
      kana: 'How do you say it?',
      passage: 'Read it, then answer the question.',
    },
    next: 'Next stop',
    words: 'Stop by stop',
    transfer: 'Transfer',
    terminus: 'Terminus',
    inThisSentence: 'In this sentence',
    stack: 'Two particles, one job',
    watch: 'Watch out',
    notThe: p => `Not to be confused with ${p}`,
    write: 'Write it',
    strokes: n => (n === 1 ? 'stroke' : 'strokes'),
    twist: 'Twist',
    another: 'Another use',
    rate: 'How did you do?',
    rateCta: 'Rate yourself in the comments',
    ratings: ['Wrong', 'Almost', 'Difficult', 'Correct'],
    examAsk: {
      reading: 'How do you read the underlined word?',
      meaning: 'What does the underlined word mean?',
      translation: 'Which sentence says it?',
      kanji: 'Which one is a reading of this kanji?',
      kana: 'How do you read it?',
    },
    examCta: n => `Answer in the comments: ${Array.from({ length: n }, (_, i) => i + 1).slice(0, -1).join(', ')} or ${n}`,
    answer: 'Answer',
    why: 'Why',
    outro: 'Learn Japanese, from your first kana to JLPT N1.',
    columns: ['', 'Word', 'Meaning'],
    departure: 'Departure',
    arrived: 'Arrived',
    rule: 'The rule',
    examples: 'In sentences',
    scene: 'In a conversation',
    sceneAsk: 'What do you say?',
    you: 'You',
    quiz: 'Quick check',
    readings: 'Readings',
    on: 'on',
    kun: 'kun',
    inWords: 'In words',
    parts: 'Its kanji',
    inSentence: 'In a sentence',
    lookalike: 'Don’t confuse',
    otherScript: { hiragana: 'In katakana', katakana: 'In hiragana' },
    read: 'Read',
    question: 'Question',
    yourTurn: 'Your turn',
    turn: {
      point: p => `Write your own sentence with ${p} in the comments.`,
      word: w => `Use ${w} in a sentence of your own, in the comments.`,
      kanji: c => `Write a word with ${c} in the comments.`,
      translation: 'Write it in Japanese in the comments before you swipe.',
    },
    like: 'Like this one:',
    pos: {
      noun: 'noun', verb: 'verb', adjective: 'adjective', adverb: 'adverb', particle: 'particle',
      copula: 'copula', pronoun: 'pronoun', auxiliary: 'ending', adnominal: 'determiner',
      conjunction: 'conjunction', interjection: 'interjection', prefix: 'prefix', suffix: 'suffix',
    },
  },
  fr: {
    prompt: {
      sentence: { plates: 'Lis-la avant la fermeture des portes.', board: 'Prochain départ. Tu sais la lire ?', card: 'Dis-la à voix haute, puis fais glisser.' },
      translation: 'Comment le dire en japonais ?',
      lesson: 'Tu connais cette structure ?',
      word: 'Tu sais lire ce mot ?',
      kanji: 'Comment se lit ce kanji ?',
      kana: 'Comment ça se lit ?',
      passage: 'Lis le texte, puis réponds à la question.',
    },
    next: 'Prochain arrêt',
    words: 'Arrêt par arrêt',
    transfer: 'Correspondance',
    terminus: 'Terminus',
    inThisSentence: 'Dans cette phrase',
    stack: 'Deux particules, un rôle',
    watch: 'Attention',
    notThe: p => `À ne pas confondre avec ${p}`,
    write: 'Écris-le',
    strokes: n => (n === 1 ? 'trait' : 'traits'),
    twist: 'Variante',
    another: 'Un autre emploi',
    rate: 'Alors, tu l’as lue ?',
    rateCta: 'Donne ta note en commentaire',
    ratings: ['Raté', 'Presque', 'Difficile', 'Correct'],
    examAsk: {
      reading: 'Comment se lit le mot souligné ?',
      meaning: 'Que veut dire le mot souligné ?',
      translation: 'Quelle phrase le dit ?',
      kanji: 'Laquelle est une lecture de ce kanji ?',
      kana: 'Comment ça se lit ?',
    },
    examCta: n => `Réponds en commentaire : ${Array.from({ length: n }, (_, i) => i + 1).slice(0, -1).join(', ')} ou ${n}`,
    answer: 'Réponse',
    why: 'Pourquoi',
    outro: 'Apprendre le japonais, du premier kana au JLPT N1.',
    columns: ['', 'Mot', 'Sens'],
    departure: 'Départ',
    arrived: 'Arrivée',
    rule: 'La règle',
    examples: 'En phrases',
    scene: 'En conversation',
    sceneAsk: 'Que réponds-tu ?',
    you: 'Toi',
    quiz: 'Petit test',
    readings: 'Lectures',
    on: 'on',
    kun: 'kun',
    inWords: 'Dans les mots',
    parts: 'Ses kanji',
    inSentence: 'Dans une phrase',
    lookalike: 'Ne confonds pas',
    otherScript: { hiragana: 'En katakana', katakana: 'En hiragana' },
    read: 'Lis',
    question: 'Question',
    yourTurn: 'À toi',
    turn: {
      point: p => `Écris ta propre phrase avec ${p} en commentaire.`,
      word: w => `Utilise ${w} dans une phrase à toi, en commentaire.`,
      kanji: c => `Écris un mot avec ${c} en commentaire.`,
      translation: 'Écris-la en japonais en commentaire avant de faire glisser.',
    },
    like: 'Comme celle-ci :',
    pos: {
      noun: 'nom', verb: 'verbe', adjective: 'adjectif', adverb: 'adverbe', particle: 'particule',
      copula: 'copule', pronoun: 'pronom', auxiliary: 'terminaison', adnominal: 'déterminant',
      conjunction: 'conjonction', interjection: 'interjection', prefix: 'préfixe', suffix: 'suffixe',
    },
  },
}

export const RATINGS_JP = ['不正解', '惜しい', '難しい', '正解']

// The instruction the JLPT paper prints over a question of the kind.
export const EXAM_ASK_JP = {
  reading: '＿＿の ことばは どう よみますか。',
  meaning: '＿＿の ことばの いみは どれですか。',
}

/** French sets a space before : ; ! ? and inside « », and the line may
 *  not break there (DESIGN.md, "French punctuation does not start a line"). */
export function weld(text) {
  return String(text ?? '')
    .replace(/ ([:;!?»])/g, ' $1')
    .replace(/« /g, '« ')
}
export const weldIf = (lang, text) => (lang === 'fr' ? weld(text) : text)

/** A point's form in the reader's language, or none: the catalogue writes
 *  it in English, and carousel_bank.py turns the French over where it can. */
export const formOf = (pt, lang) => (lang === 'fr' ? pt?.form_fr : pt?.form) || ''

/** Text in the reader's language from a {en, fr} pair, welded. */
export const tr = (pair, lang) => weldIf(lang, (pair && (pair[lang] || pair.en)) || '')
