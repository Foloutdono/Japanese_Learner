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
// These used to carry their own glyph baked into the string (e.g.
// save: '✓ Save') — the glyph is now a real <Icon/> rendered by
// whatever button shows the label, not text, so every language gets
// the same icon instead of a font-dependent character.
const nav = {
  menu:              'Menu',
  back:              'Back',
  skipToContent:     'Skip to content',
  cancel:            'Cancel',
  save:              'Save',
  delete:            'Delete',
  edit:              'Edit',
  close:             'Close',
  loading:           'Loading...',
  import:            'Import',
  export:            'Export',
  exportFailed:      'Export failed',
  select:            'Select',
}

// ── Home screen ───────────────────────────────────────────
const home = {
  // ── 日本語駅 — the station ────────────────────────────────
  // The home screen is the gate hall and every section is a line on
  // its wall map (see config/stations.js and WallMap.jsx). Station
  // and line names themselves are Japanese proper nouns and live in
  // that config, not here — these are the labels that genuinely
  // translate. `routeMap` (the masthead's caption) already exists
  // further down, shared with the analyzer's route diagram.
  platforms:   'Platforms',
  // The wall map's two group captions: the sentence-practice lines,
  // and the halls you use rather than ride.
  mapPractice:   'Practice',
  mapFacilities: 'Facilities',
  // The fare gate's filled action, and its phone-only disclosure.
  depart:      'Depart',
  breakdown:   'Breakdown',
  // Hover text on a 種別 badge. Deliberately not "Local"/"Rapid" —
  // that is the railway word for the pips, and repeating it explains
  // nothing to somebody choosing a study mode. Each one says what the
  // rung actually asks of you.
  serviceLabel: {
    local:   'Every stop — the answer is on screen',
    rapid:   'One support removed',
    express: 'From memory, self-graded',
    ltd:     'Written by hand, nothing given',
    review:  'Ungraded browse, at your own pace',
  },
  tip:               'Short sessions (15-20 min) but regular — SRS schedules everything automatically.',
  homeFeedDown:      'Today’s data could not be loaded — tap to retry.',
  start:             'Start',
  homeTitle:         'Home',
  homeDesc:          'Back to the main menu',
  kanaTitle:         'Kana',
  kanaDesc:          'Hiragana and katakana, sound by sound\nRecognition first, then written by hand\nThe ground everything else stands on',
  vocabTitle:        'Vocabulary JLPT',
  vocabDesc:         'N5 → N1\nKanji + Kana → Meaning\nPhase progression',
  kanjiTitle:        'Kanji',
  kanjiDesc:         'Kanji learning\nN5 → N1\nWriting exercises',
  dictionaryTitle:   'Dictionary',
  dictionaryDesc:    'Kanji, kana, or any word\nReadings, radicals, stroke order, examples\nAnd whether you have met it before',
  grammarTitle:      'Grammar',
  grammarDesc:       'Every JLPT pattern, N5 through N1\nWhat it attaches to and what it does\nWith sentences that use it properly',
  statsTitle:        'Statistics',
  statsDesc:         'Everything you have done, counted\nWhere you are strong, and where you are not\nAnd what falls due next',
  decksTitle:        'My Decks',
  decksDesc:         'Your own cards, scheduled like the rest\nWrite them here or import a spreadsheet\nMixed in with the built-in material',
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
  byLevelDesc:       'The exam\'s own five grades, N5 up to N1',
  byFrequency:       'Word frequency',
  byFrequencyDesc:   'Ranked by how often they actually appear in print',
  byMastery:         'My cards',
  byMasteryDesc:     'Built only from words you have already met',
  // Vocabulary's third study-source option — every JMdict word outside
  // the JLPT curriculum, ranked by frequency (see VocabScreen.jsx).
  byJmdict:          'Beyond JLPT',
  byJmdictDesc:      'Everything past the syllabus, commonest first',
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
  byThemeDesc:       'Grouped by subject — food, work, travel, the body',
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

  // Feedback — the ❌/✅/← glyphs these used to carry inline are now
  // real <Icon/>s rendered by whatever shows the text (see
  // QuizComponents.jsx's TypeInput/DoneMessage), not baked into the
  // string.
  wrong:             'Answer:',
  quizComplete:      'All cards are up to date!',
  backToMenu:        'Back to menu',

  // Rating bar. The plain-language captions; the Japanese quality terms
  // that pair with them (plan 045's rebuilt bar) are `ratingJp` below —
  // same object shape as `cosmeticSlotJp`/`cosmeticSlot`. Plan 045's
  // mockup restates wrongSeen as ALMOST (clearer against 惜しい than the
  // original "Wrong (seen)"); wrongRated's WRONG already matched "Wrong".
  to:                'to',
  perfect:           'Perfect',
  correctHesit:      'Correct',
  difficult:         'Difficult',
  wrongSeen:         'Almost',
  wrongRated:        'Wrong',
  blackout:          'Blackout',
  ratingJp: {
    perfect:         '完璧',
    correctHesit:    '正解',
    difficult:       '難しい',
    wrongSeen:       '惜しい',
    wrongRated:      '不正解',
    blackout:        '白紙',
  },

  // Mode labels
  modeQCM:           'MCQ',
  modeFlashcard:     'Flashcard',
  modeFill:          'Fill in',
  // Extended mode labels used by vocab/kanji screens
  modeWrite:         'Writing',
  // Stats format axis: typed on a keyboard, as against drawn by hand.
  modeType:          'Typing',
  radicalNumber:       'Radical',
  // grammar b2f: the meaning is shown, recall the rule.
  revealGrammarRule:   'Which rule is this?',
  revealGrammarBtn:    'Show the rule',
  standardType:        'Standard',
  standardDesc:        'A front and a back, written by you.',
  // ── Personal card fields (generated form, see study/structures.py) ──
  field_front:      'Front',
  field_back:       'Back',
  field_kanji:      'Kanji',
  field_meaning:    'Meaning',
  field_readings:   'Readings',
  field_radical:    'Radical',
  field_word:       'Word',
  field_reading:    'Reading',
  field_rule:       'Grammar rule',
  field_sentences:  'Example sentence',
  pickRadical:      'Choose a radical',
  // ── 読み入力 (kanji.readings) ──
  readingsOn:          'On (Chinese-derived)',
  readingsKun:         'Kun (native Japanese)',
  readingsAdd:         'add a reading',
  readingsAll:         'All readings:',
  readingsPlaceholder: 'kana or romaji',
  readingsCap:         '15 readings is the most this card will take.',
  modeWriteDesc:     'Meaning only. Draw the character stroke by stroke.',
  // Parameterised on what the studied item is called ("kanji" or
  // "word" — see kanjiNoun/wordNoun below and vocabKanjiModes in
  // quizModes.js). These were fixed strings saying "kanji" no matter
  // which screen showed them, so the vocabulary mode picker announced
  // "MCQ (kanji → meaning)" for a deck of words.
  modeQcmKjM:        (noun) => `MCQ (${noun} → meaning)`,
  modeQcmKjMDesc:    (noun) => `The ${noun} is shown. Pick its meaning from four.`,
  modeQcmMKj:        (noun) => `MCQ (meaning → ${noun})`,
  modeQcmMKjDesc:    (noun) => `The meaning is shown. Pick the ${noun} from four.`,
  modeFcKjM:         (noun) => `Flashcard (${noun} → meaning)`,
  modeFcKjMDesc:     (noun) => `The ${noun} alone. Recall the meaning, then check.`,
  modeFcMKj:         (noun) => `Flashcard (meaning → ${noun})`,
  modeFcMKjDesc:     (noun) => `The meaning alone. Recall the ${noun}, then check.`,

  // ── Merged recall modes (deck study) ──
  // A deck offers one entry per direction instead of an MCQ one and a
  // flashcard one, because those were the same question asked with two
  // different amounts of help — and the help is now a switch on the
  // card itself. See StudyScreen's MERGED_MODES.
  modeRecallKjM:     'Word → meaning',
  modeRecallMKj:     'Meaning → word',
  modeRecallGrammar: 'Pattern → meaning',
  modeRecallDesc:    'Recall it, or show four choices — switch at any time.',
  assistOff:         'Show choices',
  assistOn:          'Hide choices',
  assistUnavailable: 'Your own card — recall and grade yourself',

  modeFcKanaDesc:     'The kana alone. Say the sound, then check.',
  modeQcmKanaDesc:    'The kana is shown. Pick its sound from four.',
  modeWriteKanaDesc:   'The sound is given. Draw the kana.',

  modeFcGrammarDesc:   'The pattern alone. Recall what it does, then check.',
  modeQcmGrammarDesc:  'The pattern is shown. Pick what it does from four.',
  modeFillGrammarDesc: 'A sentence with the pattern taken out. Put it back.',

  // "Review your cards" — a self-paced, ungraded browse over cards
  // already studied in this deck (see ReviewDeck.jsx). Appended to
  // every mode picker alongside modeQCM/modeFlashcard/etc.
  modeReview:        'Review',
  modeReviewDesc:    'Browse what you already know. Nothing graded, nothing rescheduled.',
  reviewEmpty:       "You haven't studied any of these cards yet — come back after your first session.",
  reviewPrev:        'Previous',
  reviewNext:        'Next',

  // Writing practice
  writingPractice:   'Practice writing this kanji',
  writingOn:         'Writing ON',
  writingOff:        'Writing OFF',
  toggleWriting:     'Toggle writing practice',
  yourDrawing:       'Your drawing',
  strokeOrder:       'Stroke order',
  continueBtn:       'Got it, continue',
  eraseBtn:          'Erase',

  // Misc
  strokes:           'strokes',
  notAvailable:      'Not available',
  vocabulary:        'Vocabulary',
  kanji:             'Kanji',

  // Grammar screen
  revealMeaning:     'What is the meaning of this rule?',
  revealSentence:    'Complete the sentence below',
  revealMeaningBtn:  'Reveal meaning',
  showExamples:      'Show examples',
  hideExamples:      'Hide examples',

  // XpToast
  claimBtn:         'Claim',
  levelUp:          'Level up!',
  level:            'Level',

}

// ── Stats ─────────────────────────────────────────────────
const stats = {
  statistics:        'Statistics',
  // ── 本日の運行 — the daily queue (screens/TodayScreen) ──────
  todayTitle:         "Today's run",
  todayDesc:          'Every review due, across every section, in one queue.',
  todayBoard:         'Today',
  todayPickHint:      'Choose what to run',
  todaySelectAll:     'Select all',
  todaySelectNone:    'Select none',
  todayPickSomething: 'Pick at least one',
  todayStart:         n => `Run ${n} ${n === 1 ? 'card' : 'cards'}`,
  todayAllTypes:      'All',
  todaySearchPlaceholder: 'Find a lane...',
  todayLaneCount:     n => `${n} ${n === 1 ? 'service' : 'services'}`,
  todayNoMatch:       'No lane matches that.',
  todayNoMatchHint:   'Try another name, or clear the filters.',
  todayClearFilters:  'Clear filters',
  todayDue:           n => `${n} due`,
  todayNothingDueShort: 'All clear',
  todayRemaining:     'Left in this run',
  todayClearTitle:    'Run complete',
  todayClearedCount:  n => `${n} ${n === 1 ? 'review' : 'reviews'} cleared. Nothing else is due.`,
  todayNothingDue:    'Nothing is due right now.',
  todayNextReview:    when => `Next review ${when}.`,
  backToStation:      'Back to the station',
  resetStats:        'Reset all',
  resetConfirm:      'Erase ALL progress? This action is irreversible.',
  kana:              'Kana',
  jlptVocab:         'JLPT Vocabulary',
  globalSummary:     'Global summary',
  new:               'New',
  learning:          'In progress',
  mastered:          'Mastered',
  dueNow:            'Due now',
  total:             'Total',
  overview:        'Overview',
  streak:          'Streak',
  longestStreak:   'Best streak',
  accuracy:        'Accuracy',
  dueToday:        'Due today',
  upcomingReviews: 'Upcoming reviews',
  weakestItems:    'Needs practice',
  lapses:          'lapses',
  lapsesShort:     'L',
  reviewNow:       'Review now',

  // ── Headline band ───────────────────────────────────────
  longestIs:       n => `Best: ${n} days`,
  noStreakYet:     'Start one today',
  dueNote:         'Waiting for you',
  dueClear:        'Nothing waiting',
  ofTotalCards:    n => `of ${n} cards`,
  acrossReviews:   n => `across ${n} reviews`,
  startedNote:     n => `${n} started`,
  untouchedNote:   'Never seen',

  // ── The practice calendar ───────────────────────────────
  practiceCalendar: 'Practice calendar',
  reviewsCount:     n => `${n} reviews`,
  calendarSummary:  (days, of, reviews) => `${days} days practised out of ${of} · ${reviews} reviews`,
  bestDay:          'Best day',
  calendarLess:     'less',
  calendarMore:     'more',

  // ── The Explorer ────────────────────────────────────────
  explorer:      'Explore',
  groupBy:       'Group by',
  sortBy:        'Sort by',
  allCategories: 'Everything',
  buckets:       'buckets',
  sortName:      'Name',
  dimCategory:   'Subject',
  dimLevel:      'Level',
  dimFormat:     'Format',
  dimDirection:  'Direction',
  dimMode:       'Drill',
  dirRecognition:'Recognition',
  dirRecall:     'Recall',
  dirProduction: 'Writing',

  // ── Forecast ────────────────────────────────────────────
  perDay:     'Per day',
  cumulative: 'Running total',

  // ── Rhythm ──────────────────────────────────────────────
  rhythm:        'Your rhythm',
  studyClock:    'When you study',
  peakHour:      h => `Busiest at ${h}:00`,
  ratingMix:     'How you rate yourself',
  goodOrBetter:  pct => `${pct}% good or better`,
  intervalLadder:'How far ahead',
  settledShare:  pct => `${pct}% a month out or more`,
  intervalLearning: 'Learning',
  intervalDay:      'Tomorrow',
  intervalWeek:     '2–6 days',
  intervalWeeks:    '1–3 weeks',
  intervalMonth:    '3–8 weeks',
  intervalMonths:   '2–6 months',
  intervalSeason:   '6–12 months',
  intervalYear:     'Over a year',

  troubleLede: 'Your worst accuracy, worst first. Pick one to go straight to that drill.',
}

// ── Phrases analyser ────────────────────────────────────────────
const phraseAnalyzer = {
  // 解析駅 — the merged analyser (plan 027). One station, three
  // platforms: 文字 / 写真 / 動画. The phraseAnalyzer* keys below are
  // kept for now; they still name the section wherever the old copy
  // has not been retired yet.
  analyzerTitle:       'Analyzer',
  analyzerDesc:        'Anything Japanese you ran into\nTyped, photographed, or captioned\nTaken apart word by word',
  sourceText:          'Text',
  sourcePhoto:         'Photo',
  sourceVideo:         'Video',
  sourceTextHint:      'Type or paste Japanese',
  sourcePhotoHint:     'Shoot or upload a picture',
  sourceVideoHint:     'Subtitles or a transcript',
  // 運行履歴 (plan 040) — the stamp and count for a session row in the
  // merged history list.
  sourceVideoShort:    'From a video',
  sessionSentenceCount: n => `${n} ${n === 1 ? 'sentence' : 'sentences'}`,
  platformUnit:        'Platform',
  platformNumber:      n => `platform ${n}`,
  // 路線図 (plan 028) — the Passage drawn as a line whose stops are its
  // Sentences, one of them open at a time.
  routeMap:            'Route map',
  stopsInPassage:      n => `${n} ${n === 1 ? 'sentence' : 'sentences'}`,
  stopNumber:          (i, n) => `Sentence ${i} of ${n}`,
  // 追従 (plan 034) — following the video's clock along the line.
  followPlayback:      'Follow the video',
  // 改札口 (plan 029) — the three intakes.
  intakeTextLead:      'Type or paste anything Japanese.',
  intakePhotoLead:     'A page, a sign, a screenshot — anything with Japanese on it.',
  intakeVideoLead:     'A subtitle file, or a transcript you pasted.',
  shootPhoto:          'Shoot',
  pickPhoto:           'Choose',
  charCount:           n => `${n} characters`,
  dropSubtitles:       'Drop a .srt, .vtt or .ass file here, or choose one',
  // Must agree with routes/video.py:50 (_MAX_UPLOAD_BYTES = 1 MB).
  subtitleAccepted:    'SRT, VTT and ASS · up to 1 MB',
  windowLabel:         'Section',
  windowFrom:          'From',
  windowTo:            'To',
  windowFormatHint:    'mm:ss or seconds',
  ingestFile:          'Subtitle file',
  ingestPaste:         'Paste a transcript',
  // 改札口 / mining copy (2026-08-27). "Mine" and "cloze" were both
  // jargon on the primary action of the screen; these say what the
  // buttons do instead.
  notJapaneseLine:     'Not Japanese — shown as it appears in the subtitles, with no breakdown.',
  notJapaneseShort:    'not Japanese',
  addToDeck:           'Add to deck',
  cardOptions:         'Options',
  clozeExplain:        'A fill-in-the-blank card hides this word in the sentence, so you recall it from context rather than from a list.',
  addCloze:            'Add fill-in-the-blank',
  changeSource:        'Change what you are studying',
  // The stub strip and the working rail (the control-room redesign).
  // Navigation is plain-language-first on this screen: Japanese stays
  // on the content and the small accents, the controls speak the
  // learner's own language.
  reopenIntake:        'Add another passage',
  searchPassage:       'Search the passage…',
  filterStops:         'Filter the sentences',
  filterAll:           'All',
  filterKept:          'Kept',
  filterHasNew:        'Has new words',
  stopsShown:          (n, total) => `${n} of ${total} sentences shown`,
  keepAllIPlusOne:     'Keep all i+1',
  // The stage's two dials: the token view and the smart furigana.
  viewLabel:           'View',
  viewStepper:         'One by one',
  viewTable:           'Table',
  tableWord:           'Word',
  tableState:          'State',
  furiganaLabel:       'Furigana',
  furiganaAll:         'All',
  furiganaUnknown:     'Unknown only',
  furiganaNone:        'None',
  tokensCount:         n => `${n} ${n === 1 ? 'token' : 'tokens'}`,
  // The concourse cards' record column, and the player's transport.
  passagesCap:         'Passages',
  lastUsedCap:         'Last used',
  playVideo:           'Play',
  pauseVideo:          'Pause',
  // The keyboard map under the stage.
  kbdToken:            'token',
  kbdSentence:         'sentence',
  kbdPlay:             'play',
  windowWhole:         'whole video',
  windowSpan:          m => `${m} selected`,
  windowBackwards:     'The end must come after the start.',
  historyTitle:        'History',
  dateToday:           'today',
  dateYesterday:       'yesterday',
  dateDaysAgo:         n => `${n} days ago`,
  phraseAnalyzerTitle: 'Phrase analyzer',
  phraseAnalyzerDesc:  'Paste a sentence, see it taken apart\nEvery word, its reading, your history with it\nFor the one you almost understood',
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
  sentenceLevel:       'Estimated level',
  unknownWords:        'unknown words',
  offDeckWords:        'not taught by the app',
  iPlusOne:            'One step beyond you',
  alreadyExplained:    'already explained',
  // 保存 (plan 039) — pinning a Sentence into the bank.
  keepSentence:        'Keep this sentence',
  unkeepSentence:      'Stop keeping this sentence',
  keptTitle:           'Kept',
  grammarSpotted:      'Grammar spotted',
  explainSentence:     'Explain',
  explainAgain:        'Explain again',
  explaining:          'Explaining…',
  noExplanationYet:    'Word meanings and grammar notes for this sentence',
  explanationBought:   'Explained',
  explainFailed:       'The explanation did not come through. Try again.',
  explainUnavailable:  'Explanations are unavailable right now. Try again shortly.',
  passageTruncated:    n => `Only the first ${n} ${n === 1 ? 'sentence was' : 'sentences were'} analyzed.`,
  sentenceAnalysisUnavailable: 'Analysis is temporarily unavailable for this sentence.',
  mineToDeck:          'Mine',
  inDeck:              'In deck',
  alreadyInDeck:       'Already there',
  chooseDeck:          'Choose a deck',
  noDeckOfType:        'No deck of this type yet',
  clozeCreated:        'Cloze card created',
  mineFailed:          "Couldn't add this card. Try again.",
  cannotMineOffDeck:   'Not in the app deck',
  takePhoto:           'Take a photo',
  chooseImage:         'Choose an image',
  ocrRecognizing:      'Reading the image…',
  ocrReading:          'Reading the image…',
  cropHint:            'Drag a box around the text you want. Arrow keys nudge it.',
  useThisArea:         'Read this area',
  useWholeImage:       'Use the whole image',
  ocrLocalOption:      'Read on my device instead (private, much less accurate)',
  ocrTooLarge:         'That image is too large. Try cropping to a smaller area.',
  ocrLimitReached:     "You've hit today's image limit. Try again tomorrow.",
  ocrUnavailable:      "Image reading isn't available right now. Try again shortly.",
  ocrCheckText:        'Check the text before analyzing — OCR is not always right.',
  ocrFailed:           "Couldn't read this image. Try another, or type it in.",
  imageTooLarge:       'This image is too large.',
  hearThis:            'Hear this',
  hearSentence:        'Hear this sentence',
  hearToken:           s => `Hear ${s}`,
  entryDeleted:        'Removed from your history',
  undo:                'Undo',
  addToAnotherDeck:    'Add to another deck',
  mineAdded:           'Added to your deck',
  mineAlready:         'That card was already in the deck',
}

// ── Video ─────────────────────────────────────────────────
const video = {
  videoTitle:          'Video',
  videoDesc:           "Study a video's Japanese subtitles\nLive, colour-coded by what you already know\nA photo of the world with a soundtrack",
  videoUrlOptional:    'Video link (optional)',
  videoUrlOptionalHint: 'Only used to show the video next to the subtitles. Leave it blank to study the text on its own.',
  uploadSubtitles:     'Upload a subtitle file (.srt, .vtt, .ass)',
  pasteTranscript:     'Or paste the transcript',
  pasteTranscriptHow:  "Works for any video you can watch — nothing is fetched from YouTube.",
  pasteTranscriptStep1: 'Open the video on YouTube',
  pasteTranscriptStep2: 'Under the video: … more → Show transcript',
  pasteTranscriptStep3: 'Select the panel, copy it, and paste it here',
  openOnYoutube:       'Open on YouTube',
  useTranscript:       'Use this transcript',
  transcriptTooShort:  'Paste the transcript text as well as the link.',
  howToGetSubs:        'How do I get Japanese subtitles?',
  howToGetSubsLead:    'yt-dlp is a free, open-source tool. Run this on your own machine, then upload the .srt it writes:',
  howToGetSubsList:    'To check which languages a video actually has first:',
  howToGetSubsNote:    'Install with: pip install yt-dlp. The --sub-langs ja flag is what keeps you from getting an English translation.',
  windowStart:         'Start (seconds)',
  windowEnd:           'End (seconds)',
  windowCapped:        'The window was capped at 5 minutes.',
  // The busy line is per-source: the same string said "Analyzing the
  // subtitles…" over a typed Sentence, because a 動画 string was being
  // rendered for all three platforms.
  analyzingText:       'Reading what you wrote…',
  analyzingPhoto:      'Reading the text from your photo…',
  analyzingVideo:      'Analyzing the subtitles…',
  captionsUnavailable: "Couldn't get this video's captions.",
  subtitleTooLarge:    'This subtitle file is too large.',
  breakThisDown:       'Break this down',
  transcript:          'Transcript',
  seekToSentence:      'Jump to this sentence',
  // 案内表示 — the notices under the intake. An `info` notice is a fact
  // about the Passage, not a failure, and must never wear --danger.
  passageReady:        n => `${n} ${n === 1 ? 'sentence' : 'sentences'} ready`,
  analysisFailed:      'That did not work',
  noticeDismiss:       'Dismiss',
  analysisResult:      'Analysis',
  clearPassage:        'Clear',
  clearPassageHint:    'Empty the analyser and start again',
}

// ── Reading ───────────────────────────────────────────────
const reading = {
  readingTitle:         'Reading practice',
  readingDesc:          'Real sentences, pitched at your level\nBy grade, by frequency, or from your own cards\nRead first, check after',

  // Frequency source: which word list (byLevel/byFrequency/byMastery,
  // selectStudySource, selectTier, loadError live in `quiz` above —
  // shared with the other frequency-tier pickers in the app).
  selectDomain:          'Choose a word list',
  domainVocabDeck:       'Curated deck',
  domainVocabDecDesc:    'The graded deck, N5 through N1',
  domainVocabJmdict:     'Full dictionary',
  domainVocabJmdictDesc: 'The whole dictionary, commonest first',
  tierLabel:             'Tier {n}',
  jumpToTier:            'Jump to tier…',

  // Real example sentences only carry an English translation, whatever
  // the UI language — see reading.py's translation_lang note. Shown as
  // a short prefix so it doesn't read as if it matched `lang`.
  translationEnglish:    'EN',

  // Mastery source: shown instead of a phrase when the learner doesn't
  // have enough learning/mastered vocabulary yet for a full sentence.
  notEnoughMasteryWords: 'Not enough words in learning or mastered state yet — keep studying and check back for this mode.',

  readingGrammarPoint: 'Grammar point',
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
  previousWord:         'Previous word',
  nextWord:             'Next word',
  jumpToTokenNamed:      s => `Go to ${s}`,
  detailsForToken:       s => `Details for ${s}`,
  detailsForKanji:       k => `Details for the kanji ${k}`,
}
// ── Reading comprehension ────────────────────────────────────────────
const readingComprehension = {
  readingComprehensionTitle: 'Reading comprehension',
  readingComprehensionDesc:  'Short passages, then questions\nThe reading half of the exam, rehearsed\nN5 through N1',
  
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
  translationDesc:       'Put it into Japanese yourself\nA reference answer, and a read on yours\nThe hard direction, on purpose',
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
  examples:          'Examples',
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
  dictBackToRadicals:'Back to radicals',
  dictModeSearch:    'Search',
  dictModeRadical:   'Radical',
  dictionaryPlaceholderRadical: 'Filter these results by radical...',
  dictionaryResults: n => `${n} results`,
  dictRadicalNumber: (n) => `radical #${n}`,
  dictStrokesPlural: 'strokes',
  dictStrokeSingular: 'stroke',
  dictStrokeIndex:   'Stroke count index',
  syllabaryMain:     'Main syllabary',
  syllabaryNSolo:    'ん',
  syllabaryVoiced:   'Voiced sounds (dakuten / handakuten)',
  composingKanji:    'Made of these kanji',
  vocabExamples:     'Used in these words',
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
  // Shown by components/study/SessionError when a study session has
  // nothing to show AND the last fetch failed — previously this state
  // rendered an empty box with no explanation and no way to recover.
  // ── Hints (indice_1/2/3) ──
  // A hint is opt-in per card and never forks the SRS — see
  // components/study/HintBar.jsx. These replace the old "MCQ mode"
  // labels, because multiple choice is a help level now, not an
  // exercise.
  hintChoicesShow:    'Show choices',
  hintChoicesHide:    'Hide choices',
  hintSentencesShow:  'Show a sentence',
  hintSentencesHide:  'Hide the sentence',
  hintFuriganaShow:   'Show furigana',
  hintFuriganaHide:   'Hide furigana',

  // ── Study modes (domain/studyModes.js) ──
  // One label + description per mode key. Namespacing means these need no
  // `noun` parameter: the old modeQcmKjM(noun) shape existed because
  // `flashcard-kj-m` meant "kanji" on one screen and "word" on another,
  // and a single translation key had to serve both — which it could only
  // ever get right for one of them.
  mode_kana_flashcard_f2b:        'Kana → romaji',
  mode_kana_flashcard_f2b_desc:   'The kana is shown. Recall how it sounds.',
  mode_kana_flashcard_b2f:        'Romaji → kana',
  mode_kana_flashcard_b2f_desc:   'The sound is given. Recall the kana.',
  mode_kana_write_romaji:         'Write the romaji',
  mode_kana_write_romaji_desc:    'The kana is shown. Type how it sounds.',
  mode_kana_write_kana:           'Draw the kana',
  mode_kana_write_kana_desc:      'The sound is given. Draw the kana by hand.',

  mode_kanji_flashcard_f2b:       'Kanji → meaning',
  mode_kanji_flashcard_f2b_desc:  'The kanji is shown. Recall what it means.',
  mode_kanji_flashcard_b2f:       'Meaning → kanji',
  mode_kanji_flashcard_b2f_desc:  'The meaning is shown. Recall the kanji.',
  mode_kanji_write_kanji:         'Draw the kanji',
  mode_kanji_write_kanji_desc:    'The meaning is given. Draw the kanji by hand.',
  mode_kanji_readings:            'Readings',
  mode_kanji_readings_desc:       "The kanji is shown. Type its on'yomi and kun'yomi.",
  mode_kanji_radical:             'Radical',
  mode_kanji_radical_desc:        'The kanji is shown. Recall which radical it is built on.',

  mode_vocab_flashcard_f2b:       'Word → meaning',
  mode_vocab_flashcard_f2b_desc:  'The word is shown. Recall what it means.',
  mode_vocab_flashcard_b2f:       'Meaning → word',
  mode_vocab_flashcard_b2f_desc:  'The meaning is shown. Recall the word.',
  mode_vocab_word_reading:        'Reading',
  mode_vocab_word_reading_desc:   'The word is shown. Recall how it reads in kana.',

  mode_grammar_flashcard_f2b:      'Rule → meaning',
  mode_grammar_flashcard_f2b_desc: 'The pattern is shown. Recall what it does.',
  mode_grammar_flashcard_b2f:      'Meaning → rule',
  mode_grammar_flashcard_b2f_desc: 'The meaning is shown. Recall the pattern.',
  mode_grammar_fill_in:            'Name the rule',
  mode_grammar_fill_in_desc:       'A Japanese sentence, no translation. Name the pattern at work in it.',

  mode_standard_flashcard_f2b:      'Front → back',
  mode_standard_flashcard_f2b_desc: 'Your card, the way you wrote it.',
  mode_standard_flashcard_b2f:      'Back → front',
  mode_standard_flashcard_b2f_desc: 'Your card, the other way round.',

  mode_fast_review:                'Fast review',
  mode_fast_review_desc:           'Flip through what you have already studied. Nothing is graded.',
  retry:              'Try again',
  sessionLoadFailed:  "Couldn't load your cards.",
}

// ── Profile ───────────────────────────────────────────────
const profile = {
  // ── Profile ──
  thisWeek:          'This week',
  records:           'Records',
  currentStreak:     'Current streak',
  longestStreak:     'Longest streak',
  perfectRun:        'Best perfect run',
  perfectRunUnit:    'in a row',
  dayUnit:           'days',
  masteryLadder:     'Mastery',
  rankRemaining:     (n, label) => `${n} more to ${label}`,
  rankTopped:        'Highest rank reached',
  // Badge names, keyed by the id the backend sends. They used to be
  // hardcoded French strings baked into routes/profile.py and shipped
  // to every client, so an English profile has always shown six French
  // badge names. The id travels now and the name lives here.
  badgeName: {
    first_steps:   'First steps',
    week_streak:   '7-day streak',
    month_streak:  '30-day streak',
    kanji_100:     '100 cards mastered',
    perfectionist: '10 perfect in a row',
    dedicated:     '500 reviews',
  },
  chaseNext:         (xp, who) => `${xp} XP behind ${who}`,
  badgesEarned:      (n, m) => `${n} of ${m}`,
  passLabel:         'Commuter pass',
  passSince:         'Member since level 1',
  noActivityWeek:    'Nothing studied this week yet',
  profileTitle:      'Profile',
  profileStale:      "Couldn't reach the server — showing your last known data.",
  level:             'Level',
  // The profile's doorways into the Daruma Hall, the Storehouse and
  // the statistics — see config/navLinks.js's 'profile' scope.
  halls:             'Halls',
  hallStatsNote:     'Everything you have done, counted',
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

  // Only ever surfaces as title/aria-label text (NavControls.jsx) —
  // the visible toggle is already a real IconSun/IconMoon SVG.

  volumeMaster:       'Master volume',
  volumeKana:         'Volume kana',
  volumeVoice:        'Volume voice',
  volumeEffects:      'Volume effects',
  volumeUi:           'Volume UI',
  volumeAmbiance:     'Volume ambiance',
  volumeJingle:       'Volume jingle',
  // The station announcements (playAnnouncement). This key was the one
  // channel in SLIDER_LABELS with nothing behind it in either locale,
  // so its row in the mixer drew a slider with no label at all.
  volumeAnnouncement: 'Volume announcements',
  volumeAnnouncements: 'Volume announcements',
}

// ── Decks ─────────────────────────────────────────────────
const decks = {
  decks:             'My Decks',
  createDeck:        'Create deck',
  deckNamePlaceholder: 'Deck name...',
  noDecks:           'No decks yet.',
  createFirstDeck:   'Create your first deck above.',
  // The shelf's own index — a search field and a row of type filters
  // (DecksScreen.jsx), modelled on the dictionary's console. `{n}` is
  // the count that survived both filters, following the same
  // placeholder convention browseSelectedCount uses.
  decksSearchPlaceholder: 'Find a deck...',
  decksAllTypes:     'All',
  decksCount:        '{n} decks',
  decksCountOne:     '1 deck',
  decksNoMatch:      'No deck matches that.',
  decksNoMatchHint:  'Try another name, or clear the filters.',
  decksClearFilters: 'Clear filters',
  // Asked in place on the card/toolbar rather than through the
  // browser's own confirm() dialog — short, because it sits inline.
  deleteDeckConfirm: 'Delete this deck?',
  deleteCardsConfirm: 'Delete selected?',
  study:             'Study',
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
  vocabDesc:         'Words graded N5 to N1\nOr by frequency, by theme, or past the syllabus\nForm to meaning, and back again',
  deckVocabDesc:     'Vocabulary only — from JLPT levels',
  kanjiType:         'Kanji',
  kanjiDesc:         'Characters by level, with stroke order\nRead them, then write them from memory\nEvery reading, every meaning',
  deckKanjiDesc:     'Kanji only — with stroke order',
  grammarType:       'Grammar',
  deckGrammarDesc:   'Grammar points only — from JLPT levels',
  mixedType:         'Mixed',
  mixedDesc:         'Your own cards plus kanji, vocab and grammar, all mixed',

  // Browse existing cards (BrowseCardsMenu.jsx)
  browseBtn:              'Browse',
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
  importing:         'Importing...',
  cards:             'cards',
  andMore:           '... and {n} more',

  // Study screen
  studyMode:         'Study mode',
  mixWithJLPT:       'Mix with JLPT content (optional)',
  startSession:      'Start',
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

// ── Mock exam ─────────────────────────────────────────────
// Was entirely untranslated until now — every string below only ever
// rendered through its own inline `?? 'English default'` fallback
// (see ExamScreen/ExamRunner/ExamResult/QuestionRenderer), so a
// French-language user saw English exam text while the rest of the app
// stayed in French.
//
// This app has no affiliation with JEES or the Japan Foundation and
// makes no claim to reproduce or score against their official
// material — every exam is generated to the public JLPT format
// (section counts, timing, task types), never copied from a past
// paper. Keep that distinction in mind if you touch this copy again.
const exam = {
  examTitle:           'Mock Exam',
  examDesc:            'Full-length practice exams, timed and scored\nVocabulary, grammar, reading, listening\nBuilt to the official JLPT format — unofficial scoring',
  examQuestions:       'questions',
  examNoneAvailable:   'No exams available yet.',

  // ── Paper kinds ──
  // The four generators (backend/study/exam_*_gen.py), named in the
  // reader's own language with the Japanese kept alongside as the
  // specimen line — the picker used to show only "N5 語彙", which told
  // a beginner nothing about what was behind the card.
  examKindVocab:       'Vocabulary',
  examKindGrammar:     'Grammar',
  examKindReading:     'Reading',
  examKindListening:   'Listening',
  examNotGeneratedYet: 'Written on first open',
  examGenerating:      'Writing your exam…',
  examGeneratingHint:  'Questions are written fresh when nobody has a paper you haven’t already sat — this takes a minute or two. Once it exists it loads instantly, for you and for everyone else.',
  examLoadFailed:      "This paper couldn't be generated right now.",
  examLoadFailedHint:  'The question writer may be temporarily unavailable. Try again in a moment.',
  // Shown instead of examLoadFailedHint (and instead of the retry
  // button) while the server is refusing new attempts: a paper that
  // just failed costs minutes and dozens of model calls to retry, so
  // the wait is deliberate rather than something to click through.
  examLoadFailedCooldown: (minutes) =>
    `The question writer is taking a break after a failed attempt. Try again in about ${minutes} minute${minutes === 1 ? '' : 's'}.`,
  examRetry:           'Try again',

  examSectionEmpty:    'This section has no questions yet.',
  examAnswered:        'answered',
  examFinishSection:   'Finish',
  examQuestionAbbrev:  'Q',
  examResultMissing:   "This result isn't available — start the exam again.",
  examBackToExams:     'Back to exams',
  // The picker's per-paper secondary action, and the primary action on
  // the result screen. Both ask for a DIFFERENT paper rather than the
  // same one again — see backend/study/exam_schema.py on revisions.
  examFreshPaper:      'Different paper',
  examFreshPaperHint:  'Swap this paper for another one. If nobody has written one yet, it takes a minute or two.',
  examNewPaper:        'New paper',
  examStarHint:        'Which piece belongs in the starred position?',
  examFullSentence:    'Full sentence:',
  examAudioPending:    'Audio clip not generated yet for this question.',

  // ── Result ──
  // Never call this a JLPT score. The real one is an IRT-scaled 尺度得点
  // computed from official item parameters no third party has, so the
  // honest thing to show is raw proportion correct plus a practice
  // target — and to say plainly that that is what it is.
  examScoreCorrect:    'correct',
  examPracticeTarget:  'Practice target',
  examUnofficialNote:  'Unofficial practice score — raw proportion correct, not a JLPT scaled score.',
  examReviewTitle:     'Review your answers',
  examReviewHint:      'Tap a question to see it again with the correct answer.',
  // Wrong answers are what a review is for, so that's what opens by
  // default — a 21-question paper otherwise lists 21 identical rows to
  // click through before finding the two that went wrong.
  examShowWrongOnly:   'Missed only',
  examShowAll:         'All questions',
  examAllCorrect:      'Nothing missed — every question correct.',
  // Colour alone can't carry which row was picked and which was right
  // (they're the same row on a correct answer, and ~8% of learners
  // can't separate the two hues), so both are said in words.
  examYourAnswer:      'Your answer',
  examCorrectAnswer:   'Correct answer',
  examNotAnswered:     'Left blank',
  examTimeTaken:       'Time taken',
  // The listening script ships inside every paper already (see
  // exam_listening_gen.py) and is exactly what makes a missed
  // listening question learnable — withheld during the exam, offered
  // in review.
  examTranscript:      'Transcript',

  // ── Answer sheet ──
  // The numbered grid under the question. Named for the real thing it
  // stands in for: on a paper JLPT the answer sheet is what tells you
  // at a glance what you still owe.
  examSheetTitle:      'Answer sheet',
  examSheetBlank:      'blank',
  examSheetFlagged:    'flagged',
  // aria-label for one chip — the visual states (fill, outline, corner
  // mark) are meaningless to a screen reader, so each chip spells out
  // its own.
  examSheetChip: (n, answered, flagged) =>
    `Question ${n}, ${answered ? 'answered' : 'blank'}${flagged ? ', flagged' : ''}`,
  examFlag:            'Flag for review',
  examUnflag:          'Remove flag',

  // ── Finishing ──
  // Submitting with blanks scores them wrong, so it asks first and
  // says how many — and offers to go to them rather than only offering
  // to go through with it.
  examConfirmTitle:    'Finish with unanswered questions?',
  examConfirmBody: (n) =>
    `${n} question${n === 1 ? ' is' : 's are'} still blank. Blank answers are scored as wrong.`,
  examReviewBlanks:    'Go to first blank',
  examSubmitAnyway:    'Finish anyway',
  examKeepGoing:       'Keep working',
  // A failed submit used to strand a finished exam with no message and
  // no way out. The draft is kept until the POST succeeds, so a retry
  // is genuinely a retry.
  examSubmitFailed:    "Couldn't submit your answers — your progress is safe.",
  examSubmitRetry:     'Try submitting again',
  examSubmitting:      'Submitting…',

  // ── Leaving mid-exam ──
  examLeaveTitle:      'Leave this exam?',
  examLeaveBody:       'Your answers and the clock are saved — reopening this paper picks up where you left off.',
  examLeaveConfirm:    'Leave',
  examLeaveStay:       'Stay',

  // ── Per-question chrome ──
  // The mondai instructions are identical for every question inside a
  // mondai, so they open on the first one and collapse behind this
  // afterwards rather than re-reading the same four lines of kana each
  // time.
  examShowInstructions: 'Show instructions',
  examHideInstructions: 'Hide instructions',
  // Announced, not just coloured — a learner who isn't watching the
  // corner gets no warning at all today.
  examTimeWarning: (minutes) =>
    `${minutes} minute${minutes === 1 ? '' : 's'} remaining.`,

  // ── Audio player ──
  examAudioPlay:       'Play',
  examAudioPause:      'Pause',
  examAudioReplay:     'Play from the start',
  examAudioPlayed: (n) => `Played ${n}×`,
  examAudioProgress:   'Audio position',
}

// ── 達磨堂 — the Daruma Hall ───────────────────────────────
// Goal copy lives here, not in the backend: routes/daruma.py sends
// nothing but goal ids, precisely because the version of this feature
// it replaced shipped hardcoded French labels to English users. Every
// id in srs/daruma.py's catalogue needs an entry in both
// darumaGoalTitle and darumaGoalDesc, in both locales.
const darumaGoals = {
  // The two nested maps are keyed by backend goal id. Titles are the
  // wish as you'd write it on the doll's belly — short, imperative;
  // descriptions say exactly what's being counted, because a goal you
  // can't verify is a goal you don't trust.
  darumaGoalTitle: {
    daily_reviews_30:  'Thirty reviews',
    daily_reviews_60:  'Sixty reviews',
    daily_reviews_120: 'A hundred and twenty',
    daily_new_5:       'Five new cards',
    daily_new_15:      'Fifteen new cards',
    daily_perfect_10:  'Ten flawless',
    daily_perfect_20:  'Twenty flawless',
    daily_accuracy_85: 'Steady hand',
    daily_clear_due:   'Empty the queue',
    daily_breadth_3:   'Three disciplines',
    daily_dawn:        'Before dawn',
    daily_night:       'After dark',
    daily_xp_150:      'A hundred and fifty XP',

    weekly_reviews_300: 'Three hundred this week',
    weekly_reviews_700: 'Seven hundred this week',
    weekly_new_40:      'Forty new cards',
    weekly_days_5:      'Five days of study',
    weekly_days_7:      'Every day this week',
    weekly_perfect_25:  'Twenty-five flawless',
    weekly_xp_1200:     'Twelve hundred XP',
    weekly_breadth_4:   'Four disciplines',

    vow_streak_7:      'Seven days unbroken',
    vow_streak_30:     'A month unbroken',
    vow_streak_100:    'A hundred days unbroken',
    vow_reviews_1000:  'A thousand reviews',
    vow_reviews_5000:  'Five thousand reviews',
    vow_mastered_100:  'A hundred mastered',
    vow_mastered_500:  'Five hundred mastered',
    vow_perfect_50:    'Fifty flawless in a row',
    vow_nanakorobi:    'Fall seven, rise eight',
    vow_breadth_5:     'Every discipline in a day',
  },

  darumaGoalDesc: {
    daily_reviews_30:  'Review 30 cards today.',
    daily_reviews_60:  'Review 60 cards today.',
    daily_reviews_120: 'Review 120 cards today.',
    daily_new_5:       'Meet 5 cards you have never seen before.',
    daily_new_15:      'Meet 15 cards you have never seen before.',
    daily_perfect_10:  'Answer 10 in a row rated Good or better.',
    daily_perfect_20:  'Answer 20 in a row rated Good or better.',
    daily_accuracy_85: 'Finish the day at 85% accuracy over at least 20 reviews.',
    daily_clear_due:   'Leave nothing due at the end of the day.',
    daily_breadth_3:   'Study three of kana, vocab, kanji, grammar or your own decks.',
    daily_dawn:        'Get a review in before 8 in the morning.',
    daily_night:       'Still studying at 10 at night.',
    daily_xp_150:      'Earn 150 XP today.',

    weekly_reviews_300: 'Review 300 cards before Monday.',
    weekly_reviews_700: 'Review 700 cards before Monday.',
    weekly_new_40:      'Meet 40 cards you have never seen before this week.',
    weekly_days_5:      'Study on five separate days this week.',
    weekly_days_7:      'Study every single day this week.',
    weekly_perfect_25:  'Answer 25 in a row rated Good or better this week.',
    weekly_xp_1200:     'Earn 1,200 XP this week.',
    weekly_breadth_4:   'Study four different disciplines this week.',

    vow_streak_7:      'Reach a 7-day streak.',
    vow_streak_30:     'Reach a 30-day streak.',
    vow_streak_100:    'Reach a 100-day streak.',
    vow_reviews_1000:  'Log 1,000 reviews in total.',
    vow_reviews_5000:  'Log 5,000 reviews in total.',
    vow_mastered_100:  'Carry 100 cards to mastered.',
    vow_mastered_500:  'Carry 500 cards to mastered.',
    vow_perfect_50:    'Answer 50 in a row rated Good or better.',
    vow_nanakorobi:    'Rise from a broken streak seven times.',
    vow_breadth_5:     'Study all five disciplines in a single day.',
  },

  // Traditional daruma colours, with the wish each one is sold for.
  darumaColor: {
    aka:      'Red — luck and protection',
    kin:      'Gold — fortune',
    shiro:    'White — a clean goal',
    murasaki: 'Purple — health and long life',
    ao:       'Blue — study and career',
    midori:   'Green — vigour',
    kuro:     'Black — warding off misfortune',
    momo:     'Pink — affection',
  },
}

const daruma = {
  darumaTitle:        'Daruma Hall',
  darumaDesc:         'Vows, rewards, and a shelf of finished dolls',
  darumaMotto:        'Fall seven times, rise eight',
  darumaToday:        "Today's wishes",
  darumaThisWeek:     "This week's wishes",
  darumaVows:         'Great vows',
  darumaShelf:        'The shelf',

  darumaTokens:       'Rise tokens',
  darumaOnShelf:      'On the shelf',
  darumaClaim:        'Paint the eye',
  darumaClaimed:      'Fulfilled',
  darumaFulfilled:    'The wish is fulfilled',
  darumaEnshrine:     'Place it on the shelf',

  darumaEmptySlot:    'Empty slot',
  darumaTakeVow:      'Take the vow',
  darumaRelease:      'Give it back',
  darumaShowCatalogue: 'Browse the great vows',
  darumaHideCatalogue: 'Hide the great vows',
  darumaNoSlots:      'All three slots are taken',
  darumaAllVowsTaken: 'Every vow is either taken or fulfilled.',
  darumaVowsFulfilled: n => `${n} great ${n === 1 ? 'vow' : 'vows'} already fulfilled.`,

  darumaMendPrompt:   day => `You missed ${day}. One rise token buys that day back.`,
  darumaMendBtn:      'Rise again',
  darumaNoTokens:     'No rise tokens',

  darumaNoneToday:    'Nothing drawn — check back tomorrow.',
  darumaShelfEmpty:   'The shelf is bare. Finish a wish and the doll ends up here.',
  darumaOffline:      "Couldn't reach the hall — this may be out of date.",

  darumaDoorwayDesc:  "Today's three wishes",
  darumaReadyCount:   n => `${n} ${n === 1 ? 'daruma is' : 'darumas are'} waiting for the second eye`,
}

// ── 蔵 — the Storehouse ────────────────────────────────────
// Cosmetic copy. As with the daruma hall, routes/cosmetics.py sends
// ids and the item's own Japanese name (which is a proper noun — 雲龍紙
// is called 雲龍紙 in every language, same convention as appTitle) and
// nothing else; the reading name and the description live here.
//
// Every description says what the material actually is. That's the
// whole reward: the point of studying for a year is not a glow effect,
// it's owning a sheet of cloud-dragon paper and knowing why it's
// called that.
const storehouseCatalogue = {
  // The seven slots in Japanese — proper names of the objects, the
  // same in every language, used as the section headings in the
  // storehouse the way every other heading in the app is paired.
  cosmeticSlotJp: {
    paper:    '紙',
    ring:     '輪',
    seal:     '印',
    title:    '称号',
    backdrop: '背景',
    flourish: '彩',
    brush:    '筆',
    mcq:      '番線',
  },
  cosmeticSlot: {
    paper:    'Paper',
    ring:     'Ring',
    seal:     'Seal',
    title:    'Title',
    backdrop: 'Backdrop',
    flourish: 'Flourish',
    brush:    'Brush',
    mcq:      'MCQ rows',
  },

  // One formatter per unlock metric. `requirementText` (see
  // components/cosmetics.js) picks by `req.metric` and passes the
  // target — already resolved to a rank label for rank_index.
  cosmeticReq: {
    level:                n => `Reach level ${n}`,
    rank_index:           r => `Reach ${r}`,
    mastered_total:       n => `Master ${n.toLocaleString()} cards`,
    reviews_total:        n => `Log ${n.toLocaleString()} reviews`,
    streak_longest:       n => `Hold a ${n}-day streak`,
    perfect_run_lifetime: n => `Answer ${n} in a row rated Good or better`,
    rises_total:          n => `Rise from a broken streak ${n} times`,
    shelf_count:          n => `Shelve ${n} darumas`,
    shelf_colors:         n => `Shelve a daruma of all ${n} colours`,
    shelf_kiwami:         n => `Shelve ${n} ultimate darumas`,
    best_day_reviews:     n => `Review ${n} cards in a single day`,
    unlocked_count:       n => `Unlock ${n} items in the storehouse`,
    // The dares: one-off moments rather than counters. Ownership is
    // permanent, so satisfying one of these once is enough forever.
    categories_today:     n => `Study ${n} different subjects in one day`,
    new_cards_today:      n => `Meet ${n} new cards in one day`,
    study_days_week:      n => `Study ${n} days running`,
    dawn_today:           () => 'Study before 8 in the morning',
    night_today:          () => 'Study after 10 at night',
  },

  cosmeticName: {
    // 紙 — papers
    paper_washi:       'Washi',
    paper_torinoko:    'Torinoko',
    paper_kozo:        'Kōzo',
    paper_unryu:       'Unryū',
    paper_aizome:      'Aizome',
    paper_momiji:      'Momiji',
    paper_sabi:        'Sabi',
    paper_suminagashi: 'Suminagashi',
    paper_yozora:      'Yozora',
    paper_kinpaku:     'Kinpaku',
    // 輪 — rings
    ring_hosomichi: 'Hosomichi',
    ring_kumihimo:  'Kumihimo',
    ring_enso:      'Ensō',
    ring_sakura:    'Sakura',
    ring_seigaiha:  'Seigaiha',
    ring_raijin:    'Raijin',
    ring_kinrin:    'Kinrin',
    ring_hinode:    'Hinode',
    // 印 — seals
    seal_shu:     'Vermillion seal',
    seal_sumi:    'Ink seal',
    seal_hisui:   'Jade seal',
    seal_koban:   'Koban seal',
    seal_kin:     'Gold seal',
    seal_tenkoku: 'Tenkoku',
    // 称号 — titles
    title_minarai:    'Apprentice',
    title_kakehashi:  'Bridge-Builder',
    title_idaten:     'Idaten',
    title_fudo:       'The Immovable',
    title_hyakume:    'Hundred Eyes',
    title_nanakorobi: 'Eight-Times-Risen',
    title_tetsujin:   'Iron One',
    title_sennichi:   'Thousand-Day Walker',
    title_kuramori:   'Keeper of the Storehouse',
    title_shishou:    'Master',
    title_shosei:     'Sage of the Brush',
    title_meijin:     'Meijin',
    // 紙 — papers (continued)
    paper_sugihara:    'Sugihara',
    paper_ganpi:       'Ganpi',
    paper_chiyogami:   'Chiyogami',
    paper_danshi:      'Danshi',
    paper_sumizome:    'Sumizome',
    paper_rakusui:     'Rakusui',
    // 輪 — rings (continued)
    ring_asanoha:  'Asanoha',
    ring_shippou:  'Shippou',
    ring_kikko:    'Kikkou',
    ring_tomoe:    'Mitsudomoe',
    ring_gesshin:  'Gesshin',
    // 印 — seals (continued)
    seal_rakkan:  'Rakkan',
    seal_yuin:    'Play seal',
    seal_hyotan:  'Gourd seal',
    seal_hakubun: 'Hakubun',
    seal_gyokuji: 'Jade seal of state',
    // 称号 — titles (continued)
    title_hajime:    "Beginner's Mind",
    title_akatsuki:  'Daybreak',
    title_yonaga:    'The Long Night',
    title_hayate:    'Gale',
    title_muketsu:   'Without Flaw',
    title_kaigen:    'Eye-Opener',
    title_tsuwamono: 'Old Soldier',
    title_musou:     'Peerless',
    title_daruma:    'Daruma',
    // 背景 — backdrops
    backdrop_muji:      'Plain',
    backdrop_tatami:    'Tatami',
    backdrop_shoji:     'Shouji',
    backdrop_kanoko:    'Kanoko',
    backdrop_asagiri:   'Morning Mist',
    backdrop_hoshizora: 'Starfield',
    backdrop_sumie:     'Sumi-e',
    backdrop_sakura:    'Petal Storm',
    backdrop_kasumi:    'Gold Haze',
    backdrop_kinbyobu:  'Gold Screen',
    backdrop_amanogawa: 'River of Heaven',
    // 祝 — flourishes
    flourish_tsuke:    'Tsuke',
    flourish_hanabi:   'Fireworks',
    flourish_koban:    'Koban',
    flourish_sakura:   'Blossom',
    flourish_kaminari: 'Thunder',
    flourish_kitsune:  'Foxfire',
    flourish_matsuri:  'Festival',
    flourish_ryu:      'Dragon',
    flourish_hoo:      'Phoenix',
    // 筆 — brushes
    brush_sumi:     'Sumi',
    brush_shuboku:  'Vermillion ink',
    brush_aiboku:   'Indigo ink',
    brush_futofude: 'Broad brush',
    brush_chaboku:  'Tea ink',
    brush_menso:    'Mensou brush',
    brush_kinboku:  'Gold ink',
    brush_nijimi:   'Nijimi',
  },

  cosmeticDesc: {
    paper_washi:       'Plain handmade paper. Every card starts here.',
    paper_torinoko:    'Smooth eggshell stock, "the child of the bird" — the surface scribes reach for.',
    paper_kozo:        'Mulberry bark, long fibres left visible. Tough enough to survive a century.',
    paper_unryu:       'Cloud-dragon paper: wisps of raw fibre drifting through the sheet.',
    paper_aizome:      'Indigo-dyed. The blue deepens with every dip in the vat.',
    paper_momiji:      'Autumn paper, flecked with the colours of turning maple.',
    paper_sabi:        'Rust paper. The patina iron earns by being left out in the weather.',
    paper_suminagashi: 'Floating ink: a drop of sumi spun on water and lifted off in rings.',
    paper_yozora:      'Night-sky paper, dusted with stars in silver.',
    paper_kinpaku:     'Beaten gold leaf, laid a hundredth of a hair thick.',

    ring_hosomichi: 'The narrow road. One line, nothing else.',
    ring_kumihimo:  'Braided silk cord, the kind that ties a scroll shut.',
    ring_enso:      'The zen circle, drawn in a single breath and never corrected.',
    ring_sakura:    'A chain of cherry petals, caught mid-fall.',
    ring_seigaiha:  'Blue ocean waves — the oldest repeating pattern in Japan.',
    ring_raijin:    'The thunder fret. A storm, rendered as a right angle.',
    ring_kinrin:    'A ring of solid gold.',
    ring_hinode:    'The rising sun, with its rays still turning.',

    seal_shu:     'Cinnabar paste on the corner of every card.',
    seal_sumi:    'Struck in plain ink. Quieter, and harder to argue with.',
    seal_hisui:   'Carved from jade, framed in green.',
    seal_koban:   'Oval, like the old gold coin it is named for.',
    seal_kin:     'A gold-framed seal, reserved for what matters.',
    seal_tenkoku: 'Seal script, carved by hand. The oldest way to sign anything.',

    title_minarai:    'One who watches and learns.',
    title_kakehashi:  'A bridge laid between two languages.',
    title_idaten:     'The swift-footed god. Nobody has ever outrun him.',
    title_fudo:       'Fudō Myōō, who does not flinch. Fifty in a row, no mistakes.',
    title_hyakume:    'A hundred painted eyes looking back at you from the shelf.',
    title_nanakorobi: 'Fall seven times. Get up eight.',
    title_tetsujin:   'Five thousand reviews. Made of iron.',
    title_sennichi:   'For the monks who walk the mountain a thousand days without stopping.',
    title_kuramori:   'You have filled the storehouse.',
    title_shishou:    'The one who teaches. First dan.',
    title_shosei:     'Sage of the brush — a thousand cards carried to mastery.',
    title_meijin:     'Meijin. The name is only given out once in a generation.',
    paper_sugihara:    'Thin, soft, faintly warm. The everyday sheet of the Muromachi court.',
    paper_ganpi:       'The glossy one. Nearly translucent, with a sheen that runs across the sheet.',
    paper_chiyogami:   'Block-printed pattern paper, the kind small boxes are wrapped in.',
    paper_danshi:      'Crimped into fine ridges. Reserved for documents that mattered.',
    paper_sumizome:    'Dyed in ink, the colour of a mourning robe -- and of the hours you earned it in.',
    paper_rakusui:     'Water dripped onto the draining sheet, punching a lace of holes clean through it.',
    ring_asanoha:  "Hemp leaf: the six-point star printed on every child's first kimono.",
    ring_shippou:  'Seven treasures -- interlocking circles, endlessly.',
    ring_kikko:    'Tortoise shell. Hard, hexagonal, and slow.',
    ring_tomoe:    'Three commas chasing each other, as painted on every temple drum.',
    ring_gesshin:  'A cold halo. Turns twice as slowly as the sun.',
    seal_rakkan:  'The signature seal at the end of a piece of calligraphy.',
    seal_yuin:    'A seal carved for pleasure rather than authority. Set at whatever angle it fell.',
    seal_hyotan:  'Gourd-shaped, the way the lucky ones are cut.',
    seal_hakubun: 'Intaglio: the characters are cut away, so they print pale and the ground prints solid.',
    seal_gyokuji: 'The jade seal of state. Square, immovable, double-framed.',
    title_hajime:    "In the beginner's mind there are many possibilities; in the expert's there are few.",
    title_akatsuki:  'Awake and working before the light was.',
    title_yonaga:    'The long night belongs to whoever is still up.',
    title_hayate:    'Through three hundred cards before the day noticed.',
    title_muketsu:   'A hundred in a row, none of them wrong.',
    title_kaigen:    'The moment the eyes are painted in and the figure comes alive.',
    title_tsuwamono: 'Ten thousand reviews. The summer grass, where soldiers dreamed.',
    title_musou:     'Two hundred days without a break. There is no second.',
    title_daruma:    'Nine years facing a wall. Eight of your dolls have both eyes.',
    backdrop_muji:      'Nothing behind you. Every desk starts here.',
    backdrop_tatami:    'Woven rush matting, with the seam every half-mat where two panels meet.',
    backdrop_shoji:     'Paper panes in a wooden lattice, lit from the other side.',
    backdrop_kanoko:    'Fawn-spot tie-dye. Each dot is one grain of rice bound into the cloth.',
    backdrop_asagiri:   'Mist lying in the valley, before the day has decided anything.',
    backdrop_hoshizora: 'A fixed sky. The same stars every night, which is the point of a sky.',
    backdrop_sumie:     'Ink-wash mountains receding: the near range dark, the far range barely there.',
    backdrop_sakura:    'A blizzard of petals, drifting at the angle a real one falls.',
    backdrop_kasumi:    'The gold cloud-bands across a folding screen, hiding what the painter left out.',
    backdrop_kinbyobu:  'Gold leaf laid square by square, with the joins showing, as they always do.',
    backdrop_amanogawa: 'The river of heaven, corner to corner. Twenty thousand reviews wide.',
    flourish_tsuke:    'Wooden clappers struck against a board. The house style.',
    flourish_hanabi:   'Fireworks over the river, in the one week of summer they are allowed.',
    flourish_koban:    'Gold oval coins, the way a fortune lands in every Edo-period story.',
    flourish_sakura:   'Petals. Brief, and better for it.',
    flourish_kaminari: 'Not awarded. Struck.',
    flourish_kitsune:  'Foxfire -- the cold lights that lead travellers off the road at night.',
    flourish_matsuri:  'The whole street turns out.',
    flourish_ryu:      'Rain, rivers, and the emperor. It arrives in cloud.',
    flourish_hoo:      'The phoenix on the Byoudou-in roof. It appears only in a reign worth appearing in.',
    brush_sumi:     'Pine-soot ink on the stone. What everyone learns to write with.',
    brush_shuboku:  'The red a teacher corrects in.',
    brush_aiboku:   'Indigo ink, cool and slightly transparent.',
    brush_futofude: 'The big brush, for big characters. No room to hide a wobble.',
    brush_chaboku:  'Tea-brown ink, the colour of an old letter.',
    brush_menso:    'The fine brush a painter does faces with. Two hairs wide.',
    brush_kinboku:  'Gold ink, ground with real leaf. For sutras and for showing off.',
    brush_nijimi:   'Ink bleeding into wet paper. Every stroke commits itself.',
  },
}

const storehouse = {
  // The quick-change drawer, reachable from every top bar.
  quickChange:     'Quick change',
  quickChangeAll:  'Storehouse',
  storehouseTitle:   'Storehouse',
  storehouseDesc:    'Your rank, and everything earned along the way',
  storehouseNote:    (n, total) => `${n} of ${total} treasures collected`,
  storehouseOffline: "Couldn't reach the storehouse — this may be out of date.",

  masteryRank:     'Mastery rank',
  cardsMastered:   'cards mastered',
  rankNext:        (label, left) => `${left} more to ${label}`,
  rankMax:         'The top of the ladder.',
  cosmeticsOwned:  'Collected',
  cosmeticEquipped: 'Worn',
  cosmeticUnlocked: 'The storehouse opens',
}

// ── みどりの窓口 — onboarding ──────────────────────────────
const onboarding = {
  onbWelcomeTitle: 'Welcome to 日本語駅',
  onbWelcomeBody: 'Before your first departure, the ticket office sets up your pass: your level, your pace, and a map of the network. Two minutes, no more.',
  onbWelcomeNameHint: 'The name on your pass — tap it to change it.',
  onbContinue: 'Continue',
  onbStepsAria: (n, total) => `Step ${n} of ${total}`,
  // A function, not a string: skipping completes at the level ALREADY
  // chosen (see skip() in OnboardingFlow), which is N5 only by default.
  onbSkip: (level) => `Skip — start at ${level}`,
  onbSkipHint: 'Everything can be changed later in Settings.',
  onbDocumentTitle: 'Ticket Office',
  onbLevelTitle: 'Which station are you boarding from?',
  onbLevelNever: 'I’ve never studied Japanese',
  onbLevelNeverHint: 'Board at N5 — kana come first.',
  onbLevelTest: 'Test me',
  onbLevelTestHint: '12 questions, two minutes, scored instantly.',
  onbTestTitle: 'The placement test',
  onbTestProgress: (n, total) => `${n} / ${total}`,
  onbTestKind: {
    reading: 'How is this word read?',
    orthography: 'Which is the correct kanji spelling?',
    context: 'Which word completes the sentence?',
    grammar: 'Which grammar rule is at work?',
  },
  onbTestStop: 'Stop here — place me on what I’ve answered',
  onbTestFinish: 'See my result',
  onbTestError: 'The test could not be loaded. Try again in a moment.',
  onbTestRetake: 'Retake the test',
  onbTestResultTitle: 'Your boarding station',
  onbTestResult: (level, correct, total) => `${correct} of ${total} correct — we recommend boarding at ${level}.`,
  onbTestOverrideHint: 'It’s a recommendation, not a verdict — pick the station that feels right.',
  onbPaceTitle: 'How fast do you travel?',
  onbPaceRecommended: 'Recommended',
  onbPaceLocal: 'Local',
  onbPaceRapid: 'Rapid',
  onbPaceExpress: 'Limited express',
  onbPacePerDay: (n) => `${n} new items / day`,
  onbPaceHintLocal: 'Calm and sustainable — every station, one by one.',
  onbPaceHintRapid: 'The steady, recommended rhythm.',
  onbPaceHintExpress: 'Intense — for a deadline on the horizon.',
  onbMapTitle: 'Your year ahead',
  onbMapTotal: (horizon) => `≈ ${horizon.toLocaleString('en')} items learned over the next 12 months`,
  onbMapDeparting: (level) => `Departing from ${level}`,
  onbMapReached: (month) => `complete around ${month}`,
  onbMapKnown: (items) => `${items} items known`,
  onbMapContinues: (items) => `the line continues — ≈ ${items} items within a year`,
  onbMapNoMilestone: 'At this pace the first landmark sits beyond the one-year horizon — every day still counts.',
  onbMapNow: 'Today',
  onbMapAssumption: 'Projection: new words, kanji and grammar points only, at a constant pace — reviews come on top.',
  onbMapUnavailable: 'The projection is unavailable right now — it will be waiting inside the app.',
  onbTourTitle: 'The network’s main lines',
  onbTourTryIt: 'Try it',
  onbTourTryAgain: 'Try again',
  onbTourTodayTitle: 'Today’s service',
  onbTourTodayDesc: 'Everything due for review, across every line — this is your progress board.',
  onbTourVocabTitle: 'Vocabulary, one card at a time',
  onbTourVocabDesc: 'Tap the card below to flip it — a real review looks exactly like this.',
  onbTourAnalyzerTitle: 'The analyzer',
  onbTourAnalyzerDesc: 'Paste a sentence, a photo or a video: segmentation, readings, level. Step through this one word by word.',
  onbTourExamsTitle: 'Mock exams',
  onbTourExamsDesc: 'Papers built to the JLPT format, timed and scored. Answer this one.',
  onbPassTitle: 'Your pass is ready',
  onbPassBoard: 'Through the gate',
  onbPassError: 'Saving failed — check your connection and try again.',
  // The daily pace, lived: the concourse 新規 gauge and the study
  // screens' session terminus (see components/study/usePace.js).
  paceDoneTitle: 'Today’s target reached',
  paceDoneBody: (n, target) => `${n} of ${target} new items learned today — the line continues in review.`,
  paceExtraTrain: 'Keep the new cards coming',
  paceGaugeLabel: 'New items',
  paceGaugeAria: (n, target) => `${n} of ${target} new items learned today`,
  settingsLearning: 'Learning',
  settingsJlptLevel: 'JLPT level',
  settingsPace: 'Daily pace',
  settingsRedoDesc: 'Recalibrate your level once you have progressed.',
  settingsRedoApply: (level) => `Switch to ${level}?`,
  levelCurrentMark: 'You are here',

  // ── 窓口 — settings as the service counter ─────────────────
  // The counter names, then each control's second voice: what the
  // button DOES, in plain words under its name — on a settings screen
  // nothing may need guessing.
  settingsEnvironment: 'Display & language',
  // The short word a rail chip carries; the slip prints the full title.
  settingsEnvShort: 'Display',
  settingsData: 'Data',
  themeDark: 'Dark',
  themeLight: 'Light',
  themeAuto: 'System',
  themeAutoHint: 'Follows your device setting',
  // Each button carries its own caption — no row label. Quiet means
  // ambiance, jingle and announcements; study sounds never move.
  soundQuietPreset: 'station muted',
  soundFullPreset: 'full station',
  volumeMaster: 'Master volume',
  settingsPerDay: '/ day',
  settingsExport: 'Export your progress',
  settingsExportHint: 'One CSV file — every card, its schedule, its review counts.',
  settingsExportBtn: 'Export',
  settingsReset: 'Reset your progress',
  settingsResetHint: 'Erases every review, your XP and your streak. Your decks, level and preferences stay.',
  settingsResetBtn: 'Reset',
  settingsResetConfirmQ: 'Erase everything? This cannot be undone.',
  settingsResetYes: 'Erase everything',
  settingsResetDone: 'Progress reset. The map starts fresh.',
  settingsIssuedTo: 'Card issued to',
}

export default {
  ...auth,
  ...landing,
  ...nav,
  ...home,
  ...quiz,
  ...stats,
  ...phraseAnalyzer,
  ...video,
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
  ...exam,
  ...darumaGoals,
  ...daruma,
  ...storehouseCatalogue,
  ...storehouse,
  ...onboarding,
}