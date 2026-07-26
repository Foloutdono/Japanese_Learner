// ── App / Auth ────────────────────────────────────────────
// NOTE: values intentionally equal their own key name (t.foo === 'foo').
// Useful as a debug/reference locale to spot which key renders where.
const auth = {
  appTitle:          'appTitle',
  learnJapanese:     'learnJapanese',
  appDesc:           'appDesc',
  login:             'login',
  signup:            'signup',
  email:             'email',
  password:          'password',
  loginBtn:          'loginBtn',
  signupBtn:         'signupBtn',
  signupSuccess:     'signupSuccess',
  signOut:           'signOut',
  switchLang:        'switchLang',
}

// ── Navigation ────────────────────────────────────────────
const nav = {
  menu:              'menu',
  back:              'back',
  cancel:            'cancel',
  save:              'save',
  delete:            'delete',
  edit:              'edit',
  close:             'close',
  loading:           'loading',
  import:            'import',
  select:            'select',
}

// ── Home screen ───────────────────────────────────────────
const home = {
  tip:               'tip',
  start:             'start',
  homeTitle:         'homeTitle',
  homeDesc:          'homeDesc',
  kanaTitle:         'kanaTitle',
  kanaDesc:          'kanaDesc',
  vocabTitle:        'vocabTitle',
  vocabDesc:         'vocabDesc',
  kanjiTitle:        'kanjiTitle',
  kanjiDesc:         'kanjiDesc',
  dictionaryTitle:   'dictionaryTitle',
  dictionaryDesc:    'dictionaryDesc',
  grammarTitle:      'grammarTitle',
  grammarDesc:       'grammarDesc',
  statsTitle:        'statsTitle',
  statsDesc:         'statsDesc',
  decksTitle:        'decksTitle',
  decksDesc:         'decksDesc',
}

// ── Quiz shared ───────────────────────────────────────────
const quiz = {
  // Kana sets
  hiraganaBase:         'hiraganaBase',
  hiraganaCombinations: 'hiraganaCombinations',
  katakanaBase:         'katakanaBase',
  katakanaCombinations: 'katakanaCombinations',

  // Selection prompts
  selectLevel:       'selectLevel',
  selectMode:        'selectMode',

  // Input
  submit:            'submit',
  typeRomaji:        'typeRomaji',

  // Feedback
  wrong:             'wrong',
  quizComplete:      'quizComplete',

  // Rating bar
  to:                'to',
  perfect:           'perfect',
  correctHesit:      'correctHesit',
  difficult:         'difficult',
  wrongSeen:         'wrongSeen',
  wrongRated:        'wrongRated',
  blackout:          'blackout',

  // Mode labels
  modeQCM:           'modeQCM',
  modeFlashcard:     'modeFlashcard',
  modeFill:          'modeFill',
  // Extended mode labels used by vocab/kanji screens
  modeWrite:         'modeWrite',
  modeWriteDesc:     'modeWriteDesc',
  modeQcmKjM:        'modeQcmKjM',
  modeQcmKjMDesc:    'modeQcmKjMDesc',
  modeQcmMKj:        'modeQcmMKj',
  modeQcmMKjDesc:    'modeQcmMKjDesc',
  modeFcKjM:         'modeFcKjM',
  modeFcKjMDesc:     'modeFcKjMDesc',
  modeFcMKj:         'modeFcMKj',
  modeFcMKjDesc:     'modeFcMKjDesc',

  // Writing practice
  writingPractice:   'writingPractice',
  writingOn:         'writingOn',
  writingOff:        'writingOff',
  toggleWriting:     'toggleWriting',
  yourDrawing:       'yourDrawing',
  strokeOrder:       'strokeOrder',
  continueBtn:       'continueBtn',
  eraseBtn:          'eraseBtn',

  // Misc
  strokes:           'strokes',
  notAvailable:      'notAvailable',
  vocabulary:        'vocabulary',
  kanji:             'kanji',

  // Grammar screen
  revealMeaning:     'revealMeaning',
  revealSentence:    'revealSentence',
  revealMeaningBtn:  'revealMeaningBtn',
  showExamples:      'showExamples',
  hideExamples:      'hideExamples',
}

// ── Stats ─────────────────────────────────────────────────
const stats = {
  statistics:        'statistics',
  resetStats:        'resetStats',
  resetConfirm:      'resetConfirm',
  kana:              'kana',
  jlptVocab:         'jlptVocab',
  globalSummary:     'globalSummary',
  new:               'new',
  learning:          'learning',
  mastered:          'mastered',
  dueNow:            'dueNow',
  total:             'total',
  overview:          'overview',
  streak:            'streak',
  longestStreak:     'longestStreak',
  accuracy:          'accuracy',
  dueToday:          'dueToday',
  upcomingReviews:   'upcomingReviews',
  weakestItems:      'weakestItems',
  lapses:            'lapses',
  reviewNow:         'reviewNow',
}

// ── Phrases analyser ────────────────────────────────────────────
const phraseAnalyzer = {
  phraseAnalyzerTitle: 'phraseAnalyzerTitle',
  phraseAnalyzerDesc:  'phraseAnalyzerDesc',
  phraseAnalyzer:      'phraseAnalyzer',
  phrasePlaceholder:   'phrasePlaceholder',
  analyze:             'analyze',
  showHistory:         'showHistory',
  hideHistory:         'hideHistory',
  noHistory:           'noHistory',
  phraseAnalyzeError:  'phraseAnalyzeError',
  clickForDetails:     'clickForDetails',
  inThisPhrase:        'inThisPhrase',
  appDefinition:       'appDefinition',
  cardStats:           'cardStats',
  totalReviews:        'totalReviews',
  correctReviews:      'correctReviews',
  interval:            'interval',
  days:                'days',
  nextReview:          'nextReview',
}

// ── Reading ───────────────────────────────────────────────
const reading = {
  readingTitle:         'readingTitle',
  readingDesc:          'readingDesc',
  readingHiragana:      'readingHiragana',
  readingHiraganaDesc:  'readingHiraganaDesc',
  readingKatakana:      'readingKatakana',
  readingKatakanaDesc:  'readingKatakanaDesc',
  readingMixed:         'readingMixed',
  readingMixedDesc:     'readingMixedDesc',
  readingFetchError:    'readingFetchError',
  writeWhatYouSaw:      'writeWhatYouSaw',
  romajiPlaceholder:    'romajiPlaceholder',
  correct:              'correct',
  incorrect:            'incorrect',
  correctRomaji:        'correctRomaji',
  yourAnswer:           'yourAnswer',
  nextPhrase:           'nextPhrase',
  translation:          'translation',
  didYouGetIt:          'didYouGetIt',
  gradeCorrect:         'gradeCorrect',
  gradeIncorrect:       'gradeIncorrect',
}

// ── Reading comprehension ────────────────────────────────────────────
// (yourAnswer / gradeCorrect / gradeIncorrect intentionally not
// redefined here — they're shared with `reading` above and the app
// reads them off the same merged key.)
const readingComprehension = {
  readingComprehensionTitle:      'readingComprehensionTitle',
  readingComprehensionDesc:       'readingComprehensionDesc',
  readingComprehensionFetchError: 'readingComprehensionFetchError',
  question:                       'question',
  questionTypeComprehension:      'questionTypeComprehension',
  questionTypeVocabulary:         'questionTypeVocabulary',
  questionTypeGrammar:            'questionTypeGrammar',
  questionTypeInference:          'questionTypeInference',
}

// ── Dictionary ────────────────────────────────────────────
const dictionary = {
  dictionaryPlaceholder: 'dictionaryPlaceholder',
  noResults:         'noResults',
  reading:           'reading',
  meaning:           'meaning',
  level:             'level',
  listen:            'listen',
  loadingDictionary: 'loadingDictionary',
  loadingMore:       'loadingMore',
  displayedKanji:    'displayedKanji',
  radical:           'radical',
  // Additional dictionary keys used by screens
  dictAll:           'dictAll',
  dictKanji:         'dictKanji',
  dictVocab:         'dictVocab',
  dictBackToRadicals:'dictBackToRadicals',
  dictModeSearch:    'dictModeSearch',
  dictModeRadical:   'dictModeRadical',
  dictionaryPlaceholderRadical: 'dictionaryPlaceholderRadical',
  dictionaryResults: 'dictionaryResults',
  dictRadicalNumber: (n) => `dictRadicalNumber(${n})`,
  dictStrokesPlural: 'dictStrokesPlural',
  dictStrokeSingular: 'dictStrokeSingular',
}

// Reading-comprehension / generic reading labels
const comprehension = {
  comprehensionTitle:       'comprehensionTitle',
  comprehensionFetchError:  'comprehensionFetchError',
  comprehensionGenerating:  'comprehensionGenerating',
  comprehensionSubmitError: 'comprehensionSubmitError',
  doneReading:              'doneReading',
  reReadText:               'reReadText',
  showTranslation:          'showTranslation',
  hideTranslation:          'hideTranslation',
  timeRemaining:            'timeRemaining',
  originalText:             'originalText',
  tryAgain:                 'tryAgain',
  changeLevel:              'changeLevel',
  score:                    'score',
}

const progress = {
  progressNew:       'progressNew',
  progressLearning:  'progressLearning',
  progressMastered:  'progressMastered',
}

const misc = {
  mute:      'mute',
  unmute:    'unmute',
  onyomi:    'onyomi',
  kunyomi:   'kunyomi',
  kanjiNoun: 'kanjiNoun',
  wordNoun:  'wordNoun',
  retry:     'retry',
}

// ── Extra keys used (with hardcoded fallbacks) by screens but
// previously missing from this file — fallbacks have been stripped
// from the screens now that every key below always resolves.
const extra = {
  // Auth
  usernameOptional:  'usernameOptional',
  usernameInvalid:   'usernameInvalid',
  usernameTaken:     'usernameTaken',

  // Nav / chrome
  settings:          'settings',

  // Home / Profile
  profileTitle:      'profileTitle',
  profileStale:      'profileStale',
  goals:             'goals',
  badges:            'badges',
  leaderboard:       'leaderboard',
  nextLevel:         'nextLevel',
  done:              'done',
  genericError:      'genericError',

  // Settings
  preferences:       'preferences',
  sound:             'sound',
  theme:             'theme',
  language:          'language',
  account:           'account',
  signOutDesc:       'signOutDesc',

  // Kana
  selectKanaSet:     'selectKanaSet',

  // Dictionary
  dictionarySubtitle: 'dictionarySubtitle',
  dictHiragana:      'dictHiragana',
  dictKatakana:      'dictKatakana',
  dictStrokeIndex:   'dictStrokeIndex',
  syllabaryMain:     'syllabaryMain',
  syllabaryNSolo:    'syllabaryNSolo',
  syllabaryVoiced:   'syllabaryVoiced',
  romaji:            'romaji',
  composingKanji:    'composingKanji',

  // Nav controls (theme toggle)
  darkMode:          'darkMode',
  lightMode:         'lightMode',

  // Quiz components
  backToMenu:        'backToMenu',
  tapToFlip:         'tapToFlip',
  tapToReveal:       'tapToReveal',

  // Mode descriptions (kana / grammar pickers)
  modeQcmKanaDesc:      'modeQcmKanaDesc',
  modeFcKanaDesc:       'modeFcKanaDesc',
  modeWriteKanaDesc:    'modeWriteKanaDesc',
  modeFcGrammarDesc:    'modeFcGrammarDesc',
  modeQcmGrammarDesc:   'modeQcmGrammarDesc',
  modeFillGrammarDesc:  'modeFillGrammarDesc',

  // Level selector hints
  levelHintN5:       'levelHintN5',
  levelHintN4:       'levelHintN4',
  levelHintN3:       'levelHintN3',
  levelHintN2:       'levelHintN2',
  levelHintN1:       'levelHintN1',

  // XP toast / level-up banner
  levelUp:           'levelUp',
  claimBtn:          'claimBtn',
}

// ── Decks ─────────────────────────────────────────────────
// (vocabDesc/kanjiDesc were previously duplicated with `home`'s keys
// of the same name — the deck-type description shown here is
// different text from the Home screen card description, so these
// are namespaced as deckVocabDesc/deckKanjiDesc to stop one from
// silently overwriting the other. DecksScreen.jsx has been updated
// to match.)
const decks = {
  decks:             'decks',
  createDeck:        'createDeck',
  deckNamePlaceholder: 'deckNamePlaceholder',
  noDecks:           'noDecks',
  createFirstDeck:   'createFirstDeck',
  study:             'study',
  addCard:           'addCard',
  newCard:           'newCard',
  editCard:          'editCard',
  noCards:           'noCards',
  addFirstCard:      'addFirstCard',
  frontPlaceholder:  'frontPlaceholder',
  backPlaceholder:   'backPlaceholder',
  hintPlaceholder:   'hintPlaceholder',
  notesPlaceholder:  'notesPlaceholder',

  // Deck types
  flashcardType:     'flashcardType',
  flashcardDesc:     'flashcardDesc',
  vocabType:         'vocabType',
  deckVocabDesc:     'deckVocabDesc',
  kanjiType:         'kanjiType',
  deckKanjiDesc:     'deckKanjiDesc',

  // Bulk select
  selectAll:         'selectAll',
  deselectAll:       'deselectAll',

  // Import modal
  importTitle:       'importTitle',
  importSubtitle:    'importSubtitle',
  importPreview:     'importPreview',
  noPreview:         'noPreview',
  termSep:           'termSep',
  cardSep:           'cardSep',
  tab:               'tab',
  comma:             'comma',
  custom:            'custom',
  newRow:            'newRow',
  semicolon:         'semicolon',
  importBtn:         'importBtn',
  importing:         'importing',
  cards:             'cards',
  andMore:           'andMore',

  // Study screen
  studyMode:         'studyMode',
  mixWithJLPT:       'mixWithJLPT',
  startSession:      'startSession',
  writePractice:     'writePractice',
  revealAnswer:      'revealAnswer',
  typeAnswer:        'typeAnswer',
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
  ...extra,
  ...decks,
}