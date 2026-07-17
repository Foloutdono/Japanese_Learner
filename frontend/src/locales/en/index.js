// ── App / Auth ────────────────────────────────────────────
const auth = {
  appTitle:          '日本語',
  learnJapanese:     'Learn Japanese',
  appDesc:           'Spaced repetition (SM-2) · Hiragana · Katakana · JLPT Vocabulary',
  login:             'Login',
  signup:            'Sign up',
  email:             'Email',
  password:          'Password',
  loginBtn:          'Log in',
  signupBtn:         'Sign up',
  signupSuccess:     'Check your email to confirm your account.',
  signOut:           'Sign Out',
}

// ── Navigation ────────────────────────────────────────────
const nav = {
  menu:              'Menu',
  cancel:            'Cancel',
  save:              '✓ Save',
  delete:            '🗑 Delete',
  edit:              '✏️ Edit',
  close:             'Close',
  loading:           'Loading...',
  import:            '📥 Import',
  select:            '☑ Select',
}

// ── Home screen ───────────────────────────────────────────
const home = {
  tip:               '💡 Short sessions (15-20 min) but regular — SRS schedules everything automatically.',
  start:             'Start →',
  homeTitle:         'Home',
  homeDesc:          'Back to the main menu',
  kanaTitle:         'Kana',
  kanaDesc:          'Hiragana & Katakana\nbasic + combinations\nMCQ then free writing',
  vocabTitle:        'Vocabulary JLPT',
  vocabDesc:         'N5 → N1\nKanji + Kana → Meaning\nPhase progression',
  kanjiTitle:        'Kanji',
  kanjiDesc:         'Kanji learning\nN5 → N1\nWriting exercises',
  dictionaryTitle:   'Dictionary',
  dictionaryDesc:    'All kanji\nPronunciation & meaning\nStroke order',
  grammarTitle:      'Grammar',
  grammarDesc:       'JLPT N5 → N1 rules\nFlashcard, MCQ\nExample sentences',
  statsTitle:        'Statistics',
  statsDesc:         'SRS progress\nMastered cards\nDue reviews',
  decksTitle:        'My Decks',
  decksDesc:         'Custom cards\nFlashcards & Kanji\nMix with JLPT content',
}

// ── Quiz shared ───────────────────────────────────────────
const quiz = {
  // Kana sets
  hiraganaBase:         'Hiragana (basic)',
  hiraganaCombinations: 'Hiragana (combinations)',
  katakanaBase:         'Katakana (basic)',
  katakanaCombinations: 'Katakana (combinations)',

  // Selection prompts
  selectLevel:       'Choose your JLPT level',
  selectMode:        'Choose your training mode',

  // Input
  submit:            'Submit',
  typeRomaji:        'Type the romaji...',

  // Feedback
  wrong:             '❌ Answer:',
  quizComplete:      '✅ All cards are up to date!',

  // Rating bar
  rateAnswer:        'Rate your answer — keys',
  to:                'to',
  perfect:           'Perfect',
  correctHesit:      'Correct',
  difficult:         'Difficult',
  wrongSeen:         'Wrong (seen)',
  wrongRated:        'Wrong',
  blackout:          'Blackout',

  // Mode labels
  modeQCM:           'MCQ',
  modeFlashcard:     'Flashcard',
  modeFill:          'Fill in',
  // Extended mode labels used by vocab/kanji screens
  modeWrite:         'Writing',
  modeWriteDesc:     'See meaning, write the kanji',
  modeQcmKjM:        'MCQ (kanji → meaning)',
  modeQcmKjMDesc:    'The kanji is shown, choose the meaning',
  modeQcmMKj:        'MCQ (meaning → kanji)',
  modeQcmMKjDesc:    'The meaning is shown, choose the kanji',
  modeFcKjM:         'Card (kanji → meaning)',
  modeFcKjMDesc:     'The kanji is shown, reveal the meaning',
  modeFcMKj:         'Card (meaning → kanji)',
  modeFcMKjDesc:     'The meaning is shown, reveal the kanji',

  // Writing practice
  writingPractice:   '✏️ Practice writing this kanji',
  writingOn:         'Writing ON',
  writingOff:        'Writing OFF',
  toggleWriting:     'Toggle writing practice',
  yourDrawing:       'Your drawing',
  strokeOrder:       'Stroke order',
  continueBtn:       '✓ Got it, continue',
  eraseBtn:          '↺ Erase',

  // Misc
  strokes:           'strokes',
  notAvailable:      'Not available',
  vocabulary:        'Vocabulary',
  kanji:             'Kanji',

  // Grammar screen
  revealMeaning:     'What is the meaning of this rule?',
  revealSentence:    'Complete the sentence below',
  revealMeaningBtn:  'Reveal meaning',
  showExamples:      '▼ Show examples',
  hideExamples:      '▲ Hide examples',
}

// ── Stats ─────────────────────────────────────────────────
const stats = {
  statistics:        'Statistics',
  resetStats:        '🗑 Reset all',
  resetConfirm:      'Erase ALL progress? This action is irreversible.',
  kana:              'Kana',
  jlptVocab:         'JLPT Vocabulary',
  globalSummary:     'Global summary',
  new:               'New',
  learning:          'In progress',
  mastered:          'Mastered',
  dueNow:            '⚡ Due now',
  total:             'Total',
  overview:        'Overview',
  streak:          'Streak',
  longestStreak:   'Best streak',
  accuracy:        'Accuracy',
  dueToday:        'Due today',
  upcomingReviews: 'Upcoming reviews',
  weakestItems:    'Needs practice',
  lapses:          'lapses',
  reviewNow:       'Review now',
}

// ── Phrases analyser ────────────────────────────────────────────
const phraseAnalyzer = {
  phraseAnalyzerTitle: 'Phrase analyzer',
  phraseAnalyzerDesc:  'Analyze a Japanese phrase\nGet definitions & stats',
  phraseAnalyzer:      'Phrase analyzer',
  phrasePlaceholder:   'Type or paste a Japanese phrase…',
  analyze:             'Analyze',
  showHistory:         'History',
  hideHistory:         'Hide history',
  noHistory:           'No phrases analyzed yet.',
  phraseAnalyzeError:  "Couldn't analyze this phrase. Try again.",
  clickForDetails:     'Click for definition & stats',
  inThisPhrase:        'In this phrase',
  appDefinition:       'Definition in the app',
  cardStats:           'Card stats',
  totalReviews:        'Reviews',
  correctReviews:      'Correct',
  interval:            'Interval',
  days:                'days',
  nextReview:          'Next review',
  
}

// ── Reading ───────────────────────────────────────────────
const reading = {
  readingTitle:         'Reading practice',
  readingDesc:          'Short phrases\nJLPT N5 → N1\nHiragana, Katakana, Kanji',
  readingHiragana:      'Hiragana only',
  readingHiraganaDesc:  'Phrases written only in hiragana',
  readingKatakana:      'Katakana only',
  readingKatakanaDesc:  'Phrases written only in katakana',
  readingMixed:         'Everything',
  readingMixedDesc:     'Natural Japanese with kanji and kana',
  readingFetchError:    "Couldn't load a phrase. Try again.",
  writeWhatYouSaw:      'Write what you saw, in romaji',
  romajiPlaceholder:    'e.g. konnichiwa',
  correct:              'Correct!',
  incorrect:            'Not quite',
  correctRomaji:        'Correct romaji',
  yourAnswer:           'Your answer',
  nextPhrase:           'Next phrase',
  translation:          'Translation',
  didYouGetIt:          'Did you get it right?',
  gradeCorrect:         'I got it right',
  gradeIncorrect:       'I got it wrong',
}
// ── Reading comprehension ────────────────────────────────────────────
const readingComprehension = {
  readingComprehensionTitle: 'Reading comprehension',
  readingComprehensionDesc:  'Short passages\nJLPT N5 → N1\nMultiple choice questions',
  
  question:                   'Question',
  yourAnswer:                 'Your answer',
  gradeCorrect:               'I got it right',
  gradeIncorrect:             'I got it wrong',
  questionTypeComprehension: "Comprehension",
  questionTypeVocabulary: "Vocabulary",
  questionTypeGrammar: "Grammar",
  questionTypeInference: "Inference",
}
// ── Dictionary ────────────────────────────────────────────
const dictionary = {
  dictionaryPlaceholder: 'Search kanji, kana, or meaning...',
  noResults:         'No results for',
  reading:           'Reading',
  meaning:           'Meaning',
  level:             'Level',
  listen:            'Listen',
  loadingDictionary: 'Loading...',
  loadingMore:       'Loading more...',
  displayedKanji:    'kanji displayed',
    radical:           'Radical',
  // Additional dictionary keys used by screens
  dictAll:           'All',
  dictKanji:         'Kanji',
  dictVocab:         'Vocabulary',
  dictBackToRadicals:'← Back to radicals',
  dictModeSearch:    'Search',
  dictModeRadical:   'Radical',
  dictionaryPlaceholderRadical: 'Filter these results by radical...',
  dictionaryResults: '{n} results',
  dictRadicalNumber: (n) => `radical #${n}`,
  dictStrokesPlural: 'strokes',
  dictStrokeSingular: 'stroke',
}

// Reading-comprehension / generic reading labels
const comprehension = {
  comprehensionTitle:       'Reading comprehension',
  comprehensionFetchError:  "Couldn't load a text. Try again.",
  comprehensionGenerating:  'Generating a text for you…',
  comprehensionSubmitError:  "Couldn't submit answers. Try again.",
  doneReading:              'Done reading',
  reReadText:               'Re-read the text',
  showTranslation:          'Show translation',
  hideTranslation:          'Hide translation',
  timeRemaining:           'Time remaining',
  originalText:            'Original text',
  tryAgain:                'Try again',
  changeLevel:             'Change level',
  score:                   'Score',
}

const progress = {
  progressNew:       'To learn',
  progressLearning:  'In progress',
  progressMastered:  'Mastered',
}

const misc = {
  mute:    'Mute',
  unmute:  'Unmute',
  onyomi:  "On'yomi",
  kunyomi: "Kun'yomi",
  kanjiNoun: 'kanji',
  wordNoun:  'word',
    retry:     'Retry',
}

// ── Decks ─────────────────────────────────────────────────
const decks = {
  decks:             'My Decks',
  createDeck:        'Create deck',
  deckNamePlaceholder: 'Deck name...',
  noDecks:           'No decks yet.',
  createFirstDeck:   'Create your first deck above.',
  study:             '▶ Study',
  addCard:           '+ Add card',
  newCard:           'New card',
  editCard:          'Edit card',
  noCards:           'No cards in this deck.',
  addFirstCard:      'Add your first card above.',
  frontPlaceholder:  'Front',
  backPlaceholder:   'Back / Meaning',
  hintPlaceholder:   'Hint (optional)',
  notesPlaceholder:  'Notes (optional)',

  // Deck types
  flashcardType:     'Flashcard',
  flashcardDesc:     'Front / Back — any language',
  vocabType:         'Vocabulary',
  vocabDesc:         'Compatible with JLPT mode',
  kanjiType:         'Kanji',
  kanjiDesc:         'With stroke order',

  // Bulk select
  selectAll:         'Select all',
  deselectAll:       'Deselect all',

  // Import modal
  importTitle:       'Import your data',
  importSubtitle:    'Copy and paste your data here (from Word, Excel, Google Docs, etc.)',
  importPreview:     'Preview',
  noPreview:         'Nothing to preview yet',
  termSep:           'Between term and definition',
  cardSep:           'Between cards',
  tab:               'Tab',
  comma:             'Comma',
  custom:            'Custom',
  newRow:            'New row',
  semicolon:         'Semicolon',
  importBtn:         'Import',
  importing:         '⏳ Importing...',
  cards:             'cards',
  andMore:           '... and {n} more',

  // Study screen
  studyMode:         'Study mode',
  mixWithJLPT:       'Mix with JLPT content (optional)',
  startSession:      '▶ Start',
  writePractice:     'Writing practice',
  revealAnswer:      'Reveal answer',
  typeAnswer:        'Type your answer...',
}

export default {
  ...auth,
  ...nav,
  ...home,
  ...quiz,
  ...stats,
  ...phraseAnalyzer,
  ...reading,
  ...readingComprehension,
  ...dictionary,
  ...comprehension,
  ...progress,
  ...misc,
  ...decks,
}
