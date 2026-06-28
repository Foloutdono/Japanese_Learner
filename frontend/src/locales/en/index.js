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
  switchLang:        'Switch language',
}

// ── Navigation ────────────────────────────────────────────
const nav = {
  menu:              '← Menu',
  back:              '← Back',
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
  selectKanaSet:     'Choose a set',
  selectLevel:       'Choose a level',
  selectPhase:       'Choose a phase',
  selectMode:        'Choose a mode',

  // Phases
  phase1:            'Phase 1',
  phase2:            'Phase 2',
  phase3:            'Phase 3',
  phase1Desc:        'Kanji + Kana → Meaning',
  phase2Desc:        'Kanji → Meaning',
  phase3Desc:        'Meaning → Kanji (writing)',

  // Input
  submit:            'Submit',
  typeAnswer:        'Type your answer...',
  typeRomaji:        'Type the romaji...',
  typeKana:          'Type the kana reading...',
  typeKanji:         'Type the kanji...',

  // Feedback
  correct:           '✅ Correct!',
  wrong:             '❌ Answer:',
  quizComplete:      '✅ All cards are up to date!',
  backToMenu:        '← Back',

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
  modeType:          'Writing',
  modeFlashcard:     'Flashcard',
  modeFill:          'Fill in',

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
  revealAnswer:      'Reveal answer',
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
  status_mastered:     'Mastered',
  status_learning:     'Learning',
  status_new:          'New',
  status_not_started:  'Not in deck',
  status_due:          'Due now',
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
}
// ── Dictionary ────────────────────────────────────────────
const dictionary = {
  dictionaryPlaceholder: 'Search kanji, kana, or meaning...',
  noResults:         'No results for',
  reading:           'Reading',
  meaning:           'Meaning',
  level:             'Level',
  listen:            'Listen',
  strokeOrderLabel:  'STROKE ORDER',
  loadingDictionary: 'Loading...',
  loadingMore:       'Loading more...',
  displayedKanji:    'kanji displayed',
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
  ...dictionary,
  ...decks,
}
