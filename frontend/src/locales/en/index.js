import { resetVolumes } from "../../components/sound"

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
  usernameOptional:  'Username (optional)',
  usernameInvalid:   'Username must be 3-20 characters (letters, numbers, underscore).',
  usernameTaken:     'This username is already taken.',
}

// ── Landing screen ────────────────────────────────────────
// Shown to signed-out visitors before AuthScreen. landingCta is
// reused for both the hero button and the closing footer button
// rather than duplicated under a second key.
const landing = {
  landingSignIn:         'Sign in',
  landingTagline:        'A complete, self-paced toolkit for learning Japanese — spaced repetition (SM-2), kana to kanji, grammar, and real reading practice, all in one place.',
  landingCta:            'Get started',
  landingFeaturesTitle:  'Everything in one place',
  landingFeaturesIntro:  'Kana, vocabulary, kanji, grammar, reading, and more — one app instead of five separate tools.',
  landingWhyTitle:       'Why it works',
  landingPro1Title:      'A path, not a pile',
  landingPro1Desc:       'Kana, vocabulary, kanji, grammar, and reading are each organized from N5 to N1, so you always know what comes next.',
  landingPro2Title:      'Spaced repetition (SM-2)',
  landingPro2Desc:       "Every card is scheduled with the SM-2 algorithm, so you review things right before you'd forget them, not on a fixed calendar.",
  landingPro3Title:      'Streaks and stats',
  landingPro3Desc:       'A daily streak and a full stats page — new, in progress, mastered, due now, and your weakest items — show exactly where you stand.',
  landingPro4Title:      'Reading you can actually do',
  landingPro4Desc:       "A dictionary and a phrase analyzer sit right next to the reading and reading-comprehension exercises, so nothing you don't understand is a dead end.",
  landingPro5Title:      'Your own decks, too',
  landingPro5Desc:       'Build custom flashcard, vocabulary, or kanji decks, import cards straight from a spreadsheet, and mix them with the built-in JLPT content.',
  landingTechTitle:      'Built with',
  landingCreatorTitle:   'Who made this, and why',
  landingCreatorBody:    "This app started as a personal tool for going from zero Japanese to reading real text, without juggling five different apps for kana, vocabulary, kanji, grammar, and reading practice. It's built and maintained by a solo developer, and every feature here is something used daily while learning Japanese.",
  landingCreatorName:    '— Built and maintained solo.',
  landingFooterCta:      'Ready to start?',
}

// ── Navigation ────────────────────────────────────────────
const nav = {
  menu:              'Menu',
  back:              '←',
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
  selectKanaSet:     'Choose a kana set',
  selectPhase:       'Choose your training phase',

  byLevel:           'JLPT',
  byLevelDesc:       'The standard JLPT levels from N5 to N1, with the most common words and kanji in each level',
  byFrequency:       'Word frequency',
  byFrequencyDesc:   'The frequency of words in real Japanese text, from most common to least common',
  byMastery:         'My cards',
  byMasteryDesc:     "Sentences made entirely of words you're currently learning or have mastered",
  // Vocabulary's third study-source option — every JMdict word outside
  // the JLPT curriculum, ranked by frequency (see VocabScreen.jsx).
  byJmdict:          'Beyond JLPT',
  byJmdictDesc:      'Every dictionary word outside the JLPT curriculum, ranked by frequency',
  selectStudySource: 'Choose your study source',
  selectTier:        'Choose a frequency tier',
  kanjiUnit:         'kanji',
  loadError:         'Error loading tiers. Try again.',
  // Label for the Top 100/200/500/1000 size toggle above a tier list
  // (see TierSelector.jsx) — aria-label only, not visible text.
  tierSizeLabel:     'Tier size',

  // Vocabulary's third study-source option, alongside byLevel/
  // byFrequency — thematic decks (Fruits, Jobs, Body parts, ...), see
  // ThemeSelector.jsx / theme_data.py.
  byTheme:           'By theme',
  byThemeDesc:       'Everyday vocabulary grouped by topic — food, places, people, and more',
  selectTheme:       'Choose a theme',
  // Placeholder/aria-label for ThemeSelector's filter box (only shown
  // once there are more than a handful of themes to scroll through).
  filterThemes:      'Filter themes…',
  // Shown when a theme filter query matches nothing — distinct from
  // dictionary's `noResults` above, which is followed by the query
  // term ("No results for {query}") rather than standing alone.
  themeNoResults:    'No themes match your filter',

  // Theme display labels — key is `theme_data.list_themes()`'s `key`
  // camelCased and prefixed with `theme` (see ThemeSelector.jsx's
  // _translationKey), so a theme added to build_theme_db.py only
  // needs its matching line added here (and in every other language
  // file) to get a real label instead of ThemeSelector's raw-key
  // fallback.
  themeFruits:           'Fruits',
  themeVegetables:       'Vegetables',
  themeBodyParts:        'Body parts',
  themeRooms:            'Rooms',
  themeBuildings:        'Buildings',
  themeFurniture:        'Furniture',
  themeSchool:           'School',
  themeTravel:           'Travel',
  themeJobs:             'Jobs',
  themeDishes:           'Dishes',
  themeAnimals:          'Animals',
  themeColors:           'Colors',
  themeClothing:         'Clothing',
  themeWeather:          'Weather',
  themeFamily:           'Family',
  themeEmotions:         'Emotions',
  themeNature:           'Nature',
  themeVehicles:         'Vehicles',
  themeTechnology:       'Technology',
  themeSports:           'Sports',
  themeMusic:            'Music',
  themeKitchenItems:     'Kitchen items',
  themeOfficeSupplies:   'Office supplies',
  themeShoppingMoney:    'Shopping & money',
  themeGeography:        'Geography',
  themeInsectsBugs:      'Insects & bugs',
  themeBirds:            'Birds',
  themeSeafood:          'Seafood',
  themeDrinks:           'Drinks',
  themeShapes:           'Shapes',
  themeMaterials:        'Materials',
  themeTools:            'Tools',
  themeMedical:          'Medical',
  themePlantsTrees:      'Plants & trees',
  themeHouseholdItems:   'Household items',
  themeHolidaysEvents:   'Holidays & events',

  levelHintN5:       'Beginner level',
  levelHintN4:       'Elementary level',
  levelHintN3:       'Intermediate level',
  levelHintN2:       'Advanced level',
  levelHintN1:       'Proficiency level',

  // Input
  submit:            'Submit',
  typeRomaji:        'Type the romaji...',
  tapToFlip:          'Tap to flip',
  tapToReveal:         'Tap to reveal',

  // Feedback
  wrong:             '❌ Answer:',
  quizComplete:      '✅ All cards are up to date!',
  backToMenu:        '← Back to menu',

  // Rating bar
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
  modeFcKjM:         'Flashcard (kanji → meaning)',
  modeFcKjMDesc:     'The kanji is shown, reveal the meaning',
  modeFcMKj:         'Flashcard (meaning → kanji)',
  modeFcMKjDesc:     'The meaning is shown, reveal the kanji',

  modeFcKanaDesc:     'The kana is shown, reveal the meaning',
  modeQcmKanaDesc:    'The kana is shown, choose the meaning',
  modeWriteKanaDesc:   'The romaji is shown, draw the kana',

  modeFcGrammarDesc:   'The grammar rule is shown, reveal the meaning',
  modeQcmGrammarDesc:  'The grammar rule is shown, choose the meaning',
  modeFillGrammarDesc: 'The grammar rule is shown, fill in the missing word(s)',

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

  // XpToast
  claimBtn:         'Claim',
  levelUp:          'Level up!',
  level:            'Level',

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
  readingDesc:          'Real example sentences\nJLPT level, frequency, or your own cards\nNatural Japanese with kanji and kana',

  // Frequency source: which word list (byLevel/byFrequency/byMastery,
  // selectStudySource, selectTier, loadError live in `quiz` above —
  // shared with the other frequency-tier pickers in the app).
  selectDomain:          'Choose a word list',
  domainVocabDeck:       'Curated deck',
  domainVocabDecDesc:    "The app's own JLPT-leveled vocabulary",
  domainVocabJmdict:     'Full dictionary',
  domainVocabJmdictDesc: 'Every word in the dictionary, ranked by frequency',
  tierLabel:             'Tier {n}',
  jumpToTier:            'Jump to tier…',

  // Real example sentences only carry an English translation, whatever
  // the UI language — see reading.py's translation_lang note. Shown as
  // a short prefix so it doesn't read as if it matched `lang`.
  translationEnglish:    'EN',

  // Mastery source: shown instead of a phrase when the learner doesn't
  // have enough learning/mastered vocabulary yet for a full sentence.
  notEnoughMasteryWords: 'Not enough words in learning or mastered state yet — keep studying and check back for this mode.',

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

  // Word-by-word breakdown toggle + its per-word navigation
  // (ReadingScreen.jsx) — shown once a phrase has been graded.
  showBreakdown:        'Show breakdown',
  hideBreakdown:        'Hide breakdown',
  preparingBreakdown:   'Preparing breakdown…',
  jumpToWord:           'Jump to this word',
  previousWord:         'Previous word',
  nextWord:             'Next word',
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
// ── Translation mode ──────────────────────────────────────────────
// TranslationScreen.jsx reuses reading/quiz's existing keys wholesale
// for everything the two screens share (byLevel*, byFrequency*,
// byMastery*, selectStudySource, selectLevel, selectDomain, selectTier,
// domainVocabDeck*/domainVocabJmdict*, tierLabel, jumpToTier, submit,
// loadError, retry, score, streak, translation, translationEnglish,
// yourAnswer, gradeCorrect/gradeIncorrect, nextPhrase) — only the
// genuinely new keys live here.
const translationMode = {
  translationTitle:      'Translation',
  translationDesc:       'Translate a sentence into Japanese\nJLPT level, frequency, or your own cards\nAI analysis to help you self-assess',
  translationFetchError: "Couldn't load a phrase. Try again.",
  japanesePlaceholder:   'Write it in Japanese…',
  aiAnalysis:            'AI analysis',
  analyzingTranslation:  'Analyzing your translation…',
  analysisUnavailable:   'Analysis unavailable — judge against the reference above.',
}
// ── Dictionary ────────────────────────────────────────────
const dictionary = {
  dictionaryPlaceholder: 'Search kanji, kana, or meaning...',
  noResults:         'No results for',
  reading:           'Reading',
  romaji:            'Romaji',
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
  dictHiragana:      'Hiragana',
  dictKatakana:      'Katakana',
  dictBackToRadicals:'← Back to radicals',
  dictModeSearch:    'Search',
  dictModeRadical:   'Radical',
  dictionaryPlaceholderRadical: 'Filter these results by radical...',
  dictionaryResults: '{n} results',
  dictRadicalNumber: (n) => `radical #${n}`,
  dictStrokesPlural: 'strokes',
  dictStrokeSingular: 'stroke',
  dictionarySubtitle: 'Look up any kanji, kana, or vocabulary entry.',
  dictStrokeIndex:   'Stroke count index',
  syllabaryMain:     'Main syllabary',
  syllabaryNSolo:    'ん',
  syllabaryVoiced:   'Voiced sounds (dakuten / handakuten)',
  composingKanji:    'Made of these kanji',
  // Icon-button title/aria-label on the dictionary-lookup action that
  // sits on a revealed card (RevealActions in QuizComponents.jsx).
  openDictionary:    'Open dictionary entry',
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

// ── Profile ───────────────────────────────────────────────
const profile = {
  profileTitle:      'Profile',
  profileStale:      "Couldn't reach the server — showing your last known data.",
  level:             'Level',
  nextLevel:         'Next level',
  goals:             'Goals',
  badges:            'Badges',
  leaderboard:       'Leaderboard',
  done:              'Done',
  genericError:      'Something went wrong. Try again.',

  // Offline fallback content shown only when /api/profile is
  // unreachable (see ProfileScreen.jsx's MOCK_PROFILE) — these used to
  // be hardcoded French strings baked into the mock object itself, so
  // an English-language user hitting a backend outage would see
  // French goal/badge names. Routed through `t` instead so the
  // fallback screen still respects the UI language like everything
  // else does.
  mockGoalDaily:          "Today's reviews",
  mockGoalWeekly:         "This week's reviews",
  mockGoalStreak:         'Keep the streak alive',
  mockBadgeFirstSteps:    'First steps',
  mockBadgeWeekStreak:    '7-day streak',
  mockBadgeMonthStreak:   '30-day streak',
  mockBadgeKanji100:      '100 cards mastered',
  mockBadgePerfectionist: '10 perfect reviews in a row',
  mockBadgeDedicated:     '500 reviews',
}

// ── Settings ──────────────────────────────────────────────
const settings = {
  settings:          'Settings',
  preferences:       'Preferences',
  sound:             'Sound',
  ambiance:          'Ambiance',
  theme:             'Theme',
  language:          'Language',
  account:           'Account',
  signOutDesc:       'Sign out of your account on this device.',

  lightMode:         '☀ Light mode',
  darkMode:          '☾ Dark mode',

  volumeMaster:       'Master volume',
  volumeKana:         'Volume kana',
  volumeVoice:        'Volume voice',
  volumeEffects:      'Volume effects',
  volumeUi:           'Volume UI',
  resetVolumes:       'Reset volumes',
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
  // Front-field placeholder specific to kanji-type custom decks
  // (DeckDetailScreen.jsx) — used to be a hardcoded, untranslated
  // "Kanji (ex: 日)" string.
  kanjiFrontPlaceholder: 'Kanji (e.g. 日)',
  // Shown in the TopBar title if a deck's own name isn't available
  // yet (e.g. this screen opened directly instead of via DecksScreen,
  // so router state carrying the deck is missing) — used to be a
  // hardcoded "Deck" string.
  deckFallbackTitle: 'Deck',

  // Deck types — each one (besides "Mixed") now restricts what can be
  // added to it (see DeckDetailScreen/BrowseCardsMenu and decks.py's
  // SOURCE_FOR_TYPE), so the description is the actual rule, not just
  // a feature note.
  flashcardType:     'Flashcard',
  flashcardDesc:     'Your own cards only — any language',
  vocabType:         'Vocabulary',
  vocabDesc:         'Vocabulary only — from JLPT levels',
  deckVocabDesc:     'Vocabulary only — from JLPT levels',
  kanjiType:         'Kanji',
  kanjiDesc:         'Kanji only — with stroke order',
  deckKanjiDesc:     'Kanji only — with stroke order',
  grammarType:       'Grammar',
  deckGrammarDesc:   'Grammar points only — from JLPT levels',
  mixedType:         'Mixed',
  mixedDesc:         'Your own cards plus kanji, vocab and grammar, all mixed',

  // Browse existing cards (BrowseCardsMenu.jsx)
  browseBtn:              '📚 Browse',
  browseTitle:            'Browse existing cards',
  browseSubtitle:         'Add kanji, words, or grammar points already in the app to this deck.',
  browseTabKanji:         '漢字 Kanji',
  browseTabVocab:         '語彙 Vocabulary',
  browseTabGrammar:       '文法 Grammar',
  browseAllLevels:        'All',
  browseSearchPlaceholder: 'Search (kanji, kana, meaning...)',
  browseResults:          'Results',
  // {n} follows the same placeholder convention as andMore above.
  browseSelectedCount:    '{n} selected',
  searching:              'Searching...',
  noResults:              'No results.',
  alreadyAdded:           'already added',
  close:                  'Close',
  adding:                 'Adding...',
  addSelected:            'Add ({n})',
  // Shown instead of the source tabs when a deck's type only accepts
  // one kind of card (e.g. a Kanji-type deck) — there's nothing left
  // to choose between, so the tabs are replaced by this instead.
  browseOnlyAccepts:      'This deck only accepts {type} cards.',

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
  // Custom vocab/kanji deck phase labels (StudyScreen.jsx) — K+K→S is
  // Kanji+Kana → Sens (meaning), same three-phase progression as the
  // built-in vocab/kanji decks.
  studyPhase1:       'Phase 1 — K+K→S',
  studyPhase2:       'Phase 2 — K→S',
  studyPhase3:       'Phase 3 — S→K',
}

export default {
  ...auth,
  ...landing,
  ...nav,
  ...home,
  ...quiz,
  ...stats,
  ...phraseAnalyzer,
  ...reading,
  ...readingComprehension,
  ...translationMode,
  ...dictionary,
  ...comprehension,
  ...progress,
  ...misc,
  ...profile,
  ...settings,
  ...decks,
}