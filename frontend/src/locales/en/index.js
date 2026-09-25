// ── App / Auth ────────────────────────────────────────────
const auth = {
  appTitle:          '辻',
  learnJapanese:     'Learn Japanese',
  appDesc:           'Spaced repetition (SM-2) · Hiragana · Katakana · JLPT Vocabulary',
  login:             'Login',
  signup:            'Sign up',
  email:             'Email',
  password:          'Password',
  loginBtn:          'Log in',
  signupBtn:         'Sign up',
  signupSuccess:     'Check your email to confirm your account.',
  signOut:           'Sign out',
  usernameInvalid:   'Username must be 3-20 characters (letters, numbers, underscore).',
  usernameTaken:     'This username is already taken.',
}

// ── Landing screen ────────────────────────────────────────
// Shown to signed-out visitors before AuthScreen. landingCta is
// reused for both the hero button and the closing footer button
// rather than duplicated under a second key.
const landing = {
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
  loading:           'Loading…',
  waitingServer:     'Waking the server…',
  errorTitle:        'That didn’t work',
  errorHint:         'Check your connection — your progress is safe.',
  // ── The chrome (plan 068): the five gates and the HUD ──
  tabLearn:          'Learn',
  tabPractice:       'Practice',
  tabToday:          'Today',
  tabDictionary:     'Dictionary',
  tabProfile:        'Profile',
  tabBarLabel:       'Sections',
  hudStatusLabel:    'Goal status',
  hudOffline:        'Offline',
  hudDays:           (n) => `${n}d`,
  // The station panel's word. Late twice on purpose: the days beside
  // it and the ink tell running behind from delayed.
  hudStatus: {
    ahead:          'Ahead',
    onTime:         'On time',
    slightlyBehind: 'Late',
    delayed:        'Late',
    suspended:      'Suspended',
  },
  // ── 回数券 — the credits (plan 069) ──
  creditsUnit:       'credits',
  balanceLabel:      'Balance',
  balanceTitle:      'Balance',
  balanceOf:         (cap) => `of ${cap}`,
  balanceRefillAt:   (at) => `a day, at ${at}`,
  balanceHolds:      (cap) => `holds up to ${cap}`,
  balanceKanaFree:   'Kana reviews cost nothing',
  gateShort:         (rides, due) => `Only ${rides} of the ${due} can board`,
  gateNoCredits:     (refill, at) => `No credits left — +${refill} at ${at}`,
  runOutTitle:       'Out of credits',
  runOutCleared:     (n) => `${n} cleared`,
  runOutWaiting:     (n) => `${n} wait until tomorrow`,
  runOutRefill:      'at midnight',
  runOutTomorrow:    'tomorrow',
  // 無料 — a lane that costs nothing (domain/credits.js).
  freeFare:          'free',
  laneNew:           n => `${n} new`,
  fareReviews:       'reviews',
  fareFare:          'fare',
  fareCreditsLeft:   'credits left',
  // ── 定期券 — the pass, shown before it is sold (domain/paywall.js) ──
  paywallTitle:       '定期券',
  paywallLede:        'Review without counting, and room to keep it all.',
  paywallBenefit_reviews: 'Reviews',
  paywallBenefit_decks:   'Decks',
  paywallBenefit_cards:   'Cards',
  paywallPerDay:      (n) => `${n} / day`,
  paywallCta:         'Notify me',
  paywallThanks:      'Noted — we’ll tell you when it opens.',
  paywallSoon:        'The pass is not on sale yet.',
  paywallNotNow:      'Not now',
  paywallOpen:        'See the pass',
  paywallRowValue:    'Soon',
  import:            'Import',
  export:            'Export',
  exportFailed:      'Export failed',
  select:            'Select',
}

// ── Home screen ───────────────────────────────────────────
const home = {
  // ── 辻駅 — the station ───────────────────────────────────
  // The home screen is the gate hall and every section is a line with
  // a plate behind a gate (see config/stations.js and
  // components/station/LinePlate.jsx). Station
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
  tip:               'Short, regular sessions (15–20 min) — the scheduler does the rest.',
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
  statsDesc:         'Is it holding, week by week\nHow far ahead each card sits\nAnd where it leaks',
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
  selectMode:        'Choose how to study',
  selectKanaSet:     'Choose a kana set',
  selectPhase:       'Choose your training phase',

  byLevel:           'JLPT',
  byLevelDesc:       'The exam\'s own five grades, N5 up to N1',
  byFrequency:       'Word frequency',
  byFrequencyDesc:   'Ranked by how often they actually appear in print',
  // The same axis one line over, where what is ranked is the
  // characters rather than the words (see KanjiScreen.jsx).
  byFrequencyKanji:     'Kanji frequency',
  byFrequencyKanjiDesc: 'Ranked by how often they appear in print',
  // Kanji's third study source (plan 086): the 214 Kangxi radicals as
  // a way in — a lesson on the radical, then its family of kanji. See
  // KanjiScreen.jsx / RadicalLesson.jsx.
  byRadical:            'Radicals',
  byRadicalDesc:        'The building blocks — a radical, then every kanji built on it',
  byMastery:         'My cards',
  byMasteryDesc:     'Built only from words you have already met',
  // Vocabulary's third study-source option — every JMdict word outside
  // the JLPT curriculum, ranked by frequency (see VocabScreen.jsx).
  byJmdict:          'Beyond JLPT',
  byJmdictDesc:      'Everything past the syllabus, commonest first',
  selectStudySource: 'Choose your study source',
  selectTier:        'Choose a frequency tier',
  kanjiUnit:         'kanji',
  loadError:         'The tiers couldn’t be loaded. Try again.',
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

  // The four bands inside a theme, cut by frequency (see
  // backend/content/theme_data.py). The Japanese half of each name lives
  // in domain/themes.js — it is the same in every language.
  themeLevelBasic:    'Basic',
  themeLevelMedium:   'Medium',
  themeLevelAdvanced: 'Advanced',
  themeLevelExpert:   'Expert',
  selectThemeLevel:   'Choose a level',
  leaveThemeLevels:   'Levels',

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
  typeRomaji:        'Type the romaji…',
  tapToFlip:          'Tap to flip',
  tapToReveal:         'Tap to reveal',
  // The desk's hint (plan 113): a key cap, then the words after it.
  keySpace:            'Space',
  revealByKey:         'to reveal',
  // The run's panel, beside a card on the desk (plan 114).
  deskRunLabel:        'This run',
  deskEarned:          'Earned',
  deskEntryWait:       'The dictionary entry opens here once the card is revealed.',
  deskMissesTitle:     'To look at again',
  deskBreakdownLabel:  'Breakdown',
  deskPassageLabel:    'The text',
  // The run on three panels (plan 126): the session panel, the card panel
  // (what each verdict decides, the rhythm, the keys), and the details
  // sealed before the reveal.
  deskRemaining:       'Left',
  deskCardPanel:       'This card',
  forecastIn:          span => `in ${span}`,
  forecastTomorrow:    'tomorrow',
  forecastMinutes:     n => `${n} min`,
  forecastHours:       n => `${n} h`,
  forecastDays:        n => `${n} d`,
  forecastWeeks:       n => `${n} wk`,
  forecastMonths:      n => `${n} mo`,
  forecastYears:       n => `${n} yr`,
  // The wait as a figure, on the tile: the unit beside the number.
  forecastUnit:        (unit, n) => ({ minute: 'min', hour: 'h', day: n > 1 ? 'days' : 'day', week: 'wk', month: 'mo', year: 'yr' })[unit],
  deskKeysTitle:       'The keys',
  deskKeyTurn:         'turns the card',
  deskKeyChoices:      'shows the choices',
  deskKeyLeave:        'leaves the run',
  deskKeyAddReading:   'adds a reading',
  deskKeyCheck:        'checks',
  deskRhythm:          'The rhythm',
  deskElapsed:         'Elapsed',
  deskPerMinute:       'Cards / min',
  deskToFinish:        'To finish',
  deskSealed:          'The entry opens on the reveal.',
  keyEnter:            'Enter',
  keyEscape:           'Esc',
  deskWayUp:           'Way up',
  deskBreakdownWait:   'The sentence’s breakdown appears here once you have graded your answer.',
  // An exercise on three panels (plan 129): the run's sentences, each with
  // the grade it got, and an exercise's keys.
  deskLinesLabel:      'This run’s sentences',
  deskLinesNow:        'now',
  deskLinesRated:      'Sentences',
  deskQuestionsRated:  'Questions',
  deskPerMinuteLines:  'Sentences / min',
  deskAnswered:        'Answered',
  deskKeyCheckNext:    'checks, then next',
  deskKeyRate:         'grades your answer',
  deskKeyListen:       'plays the line',
  deskKeyPick:         'picks an answer',
  deskKeyNext:         'next question',
  deskKeyWalk:         'walks the questions',
  // 問 — a question about the exercise, on the desk (plan 131): open once
  // the answer is graded, short, precise, about this exercise only.
  askTitle:            'A question',
  askPlaceholder:      'Your question…',
  askSealed:           'Questions open once your answer is graded.',
  askSealedText:       'Questions open with the results.',
  askHint:             'A short, precise answer, about this exercise.',
  askSend:             'Ask',
  askThinking:         'Answering',
  askOffTopic:         'I only answer questions about this exercise.',
  askUnavailable:      'Answers are unavailable right now.',
  askFailed:           'The answer didn’t arrive. Try again.',
  askSpent:            at => (at ? `No more questions today: they come back at ${at}.` : 'No more questions today.'),
  askLeft:             n => `${n} question${n > 1 ? 's' : ''} left today`,
  askFull:             'That’s all for this sentence.',

  // Feedback — the ❌/✅/← glyphs these used to carry inline are now
  // real <Icon/>s rendered by whatever shows the text (see
  // QuizComponents.jsx's TypeInput/DoneMessage), not baked into the
  // string.
  wrong:             'Answer:',
  quizComplete:      'All cards are up to date!',
  backToMenu:        'Back to menu',

  // Rating bar. The plain-language captions; the Japanese quality terms
  // that pair with them (plan 045's rebuilt bar) are `ratingJp` below —
  // the term itself, identical in every language. Plan 045's
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
  readingsRemove:      (r) => `Remove ${r}`,
  readingsFound:       'found',
  readingsWrong:       'wrong',
  readingsMissed:      'missed',
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
  toggleWriting:     'Toggle writing practice',
  yourDrawing:       'Your drawing',
  strokeOrder:       'Stroke order',
  continueBtn:       'Got it, continue',
  eraseBtn:          'Erase',

  // Misc
  strokes:           'strokes',
  notAvailable:      'Not available',
  noMeaningRecorded: 'No meaning recorded',
  vocabulary:        'Vocabulary',
  kanji:             'Kanji',

  // Grammar screen
  revealMeaning:     'What does this rule mean?',
  revealSentence:    'Complete the sentence below',
  revealMeaningBtn:  'Reveal meaning',
  showExamples:      'Show examples',
  hideExamples:      'Hide examples',

  // XpToast
  levelUp:          'Level up!',
  level:            'Level',
  levelShort:       'Lv',

}

// ── Stats ─────────────────────────────────────────────────
const stats = {
  statistics:        'Statistics',
  // ── 本日の運行 — the daily queue (screens/TodayScreen) ──────
  todayTitle:         "Today's run",
  todayDesc:          'Every review due, across every section, in one queue.',
  todayBoard:         'Today',
  todayPickHint:      'Choose what to run',
  todayLines:         'Today’s lines',
  todayPickSomething: 'Pick at least one',
  todayStart:         n => `Run ${n} ${n === 1 ? 'card' : 'cards'}`,
  todayAllTypes:      'All',
  todaySearchPlaceholder: 'Find a lane…',
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
  fareGate:           'Fare gate',
  dueUnit:            'due',
  newUnit:            'new',
  // The origin of every Learn line: where you stand before a level is
  // finished (domain/lineProgress.js's ORIGIN_STOP).
  originStop:         'Novice',
  stageGate:          'Gate',
  nothingGraded:      'Nothing is graded',
  stationJlpt:        'JLPT',
  // The sub over vocabulary's and kanji's source page. Terse, like
  // every other sub on a station: it names the page you are on, and
  // the cards under it do the asking. (The practice sections put the
  // whole question up there instead -- selectStudySource -- because
  // their bar carries no other sub to be consistent with.)
  stationSources:     'Sources',
  // The same, over かな's set list: the sets are the line's stops, so
  // the sub names them and the bar's other end is the way out.
  stationSets:        'Sets',
  byFrequencyShort:   'By frequency',
  byThemeShort:       'By theme',
  byRadicalShort:     'By radical',
  leaveLevels:        'Levels',
  leaveRadicals:      'Radicals',
  // ── The radical lesson (plan 086) ──
  radLesson:          'The radical',
  radFamily:          'Kanji built on this radical',
  radForms:           'Forms',
  // Where the component usually sits in a character, by the seven
  // traditional positions (backend/content/radical_info.py).
  radPosition: {
    hen:     'on the left',
    tsukuri: 'on the right',
    kanmuri: 'across the top',
    ashi:    'along the bottom',
    kamae:   'around the outside',
    tare:    'over the top and down the left',
    nyou:    'down the left and along the bottom',
  },
  radPositionJp: { hen: '偏', tsukuri: '旁', kanmuri: '冠', ashi: '脚', kamae: '構', tare: '垂', nyou: '繞' },
  radPositionNote:    where => `As a component it usually sits ${where} of a kanji`,
  radNoPositionNote:  'As a component it has no fixed place in a kanji.',
  radFamilyShort:     'Kanji built on it',
  radNoKanji:         'The course teaches no kanji built on it yet.',
  leaveSets:          'Sets',
  leaveTiers:         'Tiers',
  leaveThemes:        'Themes',
  leaveDecks:         'Decks',
  leaveDeck:          'Deck',
  // ── Practice (plan 072) ──
  leaveSources:       'Sources',
  leaveExam:          'Exam',
  compBackToQuestions: 'Back to the questions',
  practiceResult:     'Result',
  reference:          'Reference',
  // ── Dictionary and the analyzer (plan 073) ──
  allReadings:        'All readings',
  dictCollections:    'Collections',
  analyzerDoorSub:    'Text, a photo, a video',
  passagesCount: (n) => `${n} ${n === 1 ? 'passage' : 'passages'}`,
  sentencesCount: (n) => `${n} ${n === 1 ? 'sentence' : 'sentences'}`,
  leaveAnalyzer:      'Analyzer',
  furiganaCap:        'Furigana',
  newDeck:            'New deck',
  cardsUnit: (n) => `${n} ${n === 1 ? 'card' : 'cards'}`,
  // ── Profile, statistics and settings (plan 074) ──
  stampBook:          'Stamp book',
  // ── 統計, the service record (plan 085) ──
  reportRetention:    'Retention',
  reportThisWeek:     'this week',
  reportWeeksAgo:     w => `${w} wk ago`,
  reportDelta:        (n, w) => `${n > 0 ? '+' : n < 0 ? '−' : '±'}${Math.abs(n)} · ${w} wk`,
  reportWeekOf:       (date, n) => `week of ${date} · ${n} ${n === 1 ? 'review' : 'reviews'}`,
  reportRungs:        ['<1 d', '1 w', '1 m', '3 m', '3 m+'],
  reportStrengthSummary: n => `${n} cards by how far ahead they sit`,
  reportMisses:       (n, d) => `${n === 1 ? 'miss' : 'misses'} · ${d} d`,
  reportMore:         n => `More · ${n}`,
  reportEmpty:        'No reviews yet',
  reportEmptyHint:    'The first week of reviews draws the line.',
  startedNote:     n => `${n} started`,
  reportError:        'The record could not be read',
  daysUnit:           'days',
  balanceRefillLine:  (n, at) => `+${n} at ${at}`,
  perDayUnit:         '/ day',
  // ── The status sheet's head and its two comparison rows ──
  // The four-figure lattice (Last 14 days / Promised / At this pace /
  // On the pass) retired with the 進捗が主役 round: two of its cells
  // were one comparison and two were another, and it left both
  // subtractions to the reader. These say the same four numbers as
  // two rows that carry their own difference.
  statusPace:         'Pace',
  statusArrival:      'Arrival',
  statusPromisedPace: (p) => `promised ${p} / day · last 14 days`,
  statusOnPassDate:   (d) => `on the pass, ${d}`,
  statusDaysDelta:    (n) => `${n > 0 ? '+' : '−'}${Math.abs(n)} d`,
  statusNextStop:     (stop) => `Next stop ${stop}`,
  statusArrived:      'Line complete',
  statusBehindPlan:   (n) => `${n} behind plan`,
  statusAheadPlan:    (n) => `${n} ahead of plan`,
  settingsGoalNoneShort: 'No destination',
  soundPresets:       'Presets',
  soundValueQuiet:    'Station muted',
  soundValueFull:     'Full station',
  soundValueMixed:    'Custom',
  soundQuietHint:     'no ambiance, no jingles',
  soundFullHint:      'ambiance and announcements',
  soundMuteHint:      'every channel',
  soundMixer:         'Mixer',
  levelName:          { N5: 'Beginner', N4: 'Elementary', N3: 'Intermediate', N2: 'Advanced', N1: 'Proficient' },
  settingsPaceCap:    'New items a day',
  settingsPaceCustom: n => `Your pace is set to ${n} a day.`,
  paceName:           { local: 'Local', rapid: 'Rapid', express: 'Express' },
  levelUpTitle:       l => `Move up to ${l}?`,
  levelUpBody:        (to, weeks) => `The stops behind ${to} are marked **known**: their cards start mastered, with a first check spread over the next ${weeks} weeks. Cards you are already learning keep their place. **Nothing is deleted.**`,
  levelDownTitle:     l => `Move down to ${l}?`,
  levelDownBody:      to => `The cards beyond ${to} are set aside, not deleted: they keep their history and rejoin the run when you move up again. Today's run shrinks to the ${to} stops.`,
  levelMarkedKnown:   'Marked known',
  levelSpreadOver:    'Spread over',
  levelWeeks:         n => `${n} weeks`,
  levelSetAside:      'Set aside',
  levelDeleted:       'Deleted',
  levelUpGo:          l => `Move up to ${l}`,
  levelDownGo:        l => `Move down to ${l}`,
  levelStay:          l => `Stay at ${l}`,
  destOnPass:         'On the pass',
  destService:        'Service',
  destDailyRide:      'Daily ride',
  destOptional:       'Optional',
  destHour:           { am: 'Morning', noon: 'Noon', pm: 'Evening' },
  destFlexible:       'Flexible',
  destAnyTime:        'any time',
  destValidUntil:     'Valid until',
  destMovesTo:        date => `moves to ${date} at today's pace`,
  destReprint:        'Reprint',
  compNote: (you, right) => `You · ${you} — correct · ${right}`,
  examPart: (n) => `Part ${n}`,
  serviceName: {
    local:   'Local',
    rapid:   'Rapid',
    express: 'Express',
    ltd:     'Ltd. exp.',
    review:  'Review',
  },
  decksRowMeta:       (decks, cards) => `${decks} ${decks === 1 ? 'deck' : 'decks'} · ${cards} ${cards === 1 ? 'card' : 'cards'}`,
  deckMore:           'More',
  deleteDeck:         'Delete deck',
  cardsCount:         n => `${n} ${n === 1 ? 'card' : 'cards'}`,
  freqDomainDeck:     'JLPT words',
  freqDomainJmdict:   'Beyond JLPT',
  resetStats:        'Reset all',
  resetConfirm:      'Erase all progress? This cannot be undone.',
  kana:              'Kana',
  jlptVocab:         'JLPT Vocabulary',
  globalSummary:     'Global summary',
  new:               'New',
  learning:          'In progress',
  mastered:          'Mastered',
  dueNow:            'Due now',
  // The same state as dueNow, in the record cell that owns the
  // schedule: a figure, so one word rather than a phrase (plan 089).
  dueValue:          'Now',
  reviewThisCard:    'Review this card',
  total:             'Total',
  overview:        'Overview',
  streak:          'Streak',
  longestStreak:   'Best streak',
  accuracy:        'Accuracy',
  dueToday:        'Due today',
  weakestItems:    'Needs practice',
  lapses:          'lapses',
  lapsesShort:     'L',






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
  sourceVideoHint:     'A YouTube link and its subtitles',
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
  intakeVideoLead:     'Paste the link, let the 字幕取り bookmark fetch the subtitles — or drop a file.',
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
  // "only" is what makes the three exclusive, and being one of three
  // segments already says that. The word cost 60px of a 271px control
  // on a phone -- enough to break the dial onto two lines.
  furiganaUnknown:     'Unknown',
  furiganaNone:        'None',
  tokensCount:         n => `${n} ${n === 1 ? 'token' : 'tokens'}`,
  // The concourse cards' record column, and the player's transport.
  passagesCap:         'Passages',
  lastUsedCap:         'Last used',
  playVideo:           'Play',
  pauseVideo:          'Pause',
  muteVideo:           'Mute the video',
  unmuteVideo:         'Unmute the video',
  videoVolume:         'Volume',
  videoVolumePct:      pct => `${pct}%`,
  // The keyboard map under the stage.
  kbdToken:            'token',
  kbdSentence:         'sentence',
  kbdPlay:             'play',
  dockNoEntry:         'No dictionary entry for this word.',
  dictAnalyseSentence: 'Analyze this sentence',
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
  clickForDetails:     'Click for the definition and stats',
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
  // The same fact at legend length. The key sits beside MASTERED,
  // LEARNING and NEW and has to read as one of them; the sentence
  // above stays where it explains a dead control (MineButton's
  // title), which is the one place it earns its words.
  offDeckKey:          'Not in a deck',
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
  videoUrlOptional:    'Video link',
  videoUrlOptionalHint: 'Shows the video next to the subtitles, opens the right page for the bookmark, and pre-fills DownSub.',
  // Shown only where the server can fetch a link itself. It names the
  // subtitles rather than the mechanism -- the learner does not need to
  // know a proxy is involved, only what they get.
  analyzeThisLink:     'Get the subtitles',
  grabTitle:           'Subtitles in one tap',
  grabLead:            'A special bookmark you set up once (about a minute): after that, open it on any YouTube video and the Japanese subtitles arrive here on their own — phones included.',
  grabTutorialBtn:     'Step-by-step tutorial',
  copyBookmarklet:     'Copy the 字幕取り bookmark',
  bookmarkletCopied:   'Copied! Now do step 2',
  downsubAlt:          'or via DownSub',
  downsubHint:         'Downloads a .vtt file to drop below — useful outside YouTube.',
  grabEmpty:           'The grabbed subtitles were empty — try again from the video page.',
  // ── The bookmark tutorial ──
  tutTitle:            'Set up the 字幕取り bookmark',
  tutWhat:             'The idea: we save a small "magic address" as a bookmark in your browser. Opening that bookmark while you are on a YouTube video grabs its Japanese subtitles and brings you back here with the analysis started. Nothing to install, no extension, no account.',
  tutStep1Title:       'Copy the bookmark address',
  tutStep1Body:        'This button puts the address in your clipboard. It starts with "javascript:" — that is normal; it is the part that does the work.',
  tutStep2Title:       'Create the bookmark in your browser',
  tutStep2Body:        'The gesture depends on the device — pick yours:',
  tutDeviceLabel:      'Device',
  tutDeviceDesktop:    'Computer',
  tutDesktop1:         'Show the bookmarks bar: Ctrl+Shift+B (⌘+Shift+B on Mac).',
  tutDesktop2:         'Right-click the bar → "Add page…" (Chrome/Edge) or "New bookmark…" (Firefox).',
  tutDesktop3:         'Name: 字幕取り. In the URL field, paste the copied address, then save.',
  tutAndroid1:         'In Chrome, on any page, tap ⋮ then the star ☆: a bookmark is created.',
  tutAndroid2:         'Reopen ⋮ → Bookmarks, long-press that new bookmark → Edit.',
  tutAndroid3:         'Name: 字幕取り. Clear the URL, paste the copied address, save.',
  tutIphone1:          'In Safari, on any page, tap Share (the square with an arrow) → "Add Bookmark" → Save.',
  tutIphone2:          'Open Bookmarks (the book icon) → Edit, then tap that bookmark.',
  tutIphone3:          'Name: 字幕取り. Replace the address with the copied one, tap Done.',
  tutStep3Title:       'Use it on a video',
  tutStep3a:           'Open the video on the youtube.com site, in the browser — not in the YouTube app, which cannot see your bookmarks',
  tutStep3b:           'Computer: click 字幕取り in the bookmarks bar. Phone: type 字幕取り in the address bar and tap the bookmark it offers.',
  tutStep3c:           'The page comes back here on its own and the analysis starts with the Japanese subtitles — the video playable beside it.',
  tutTroubleTitle:     'If it does not work',
  tutTrouble1:         'The bookmark tells you itself: "No Japanese subtitles" means the video has no Japanese track — there is nothing to grab. "Page not ready": reload the video page and try again.',
  tutTrouble2:         'As a last resort, this page\'s DownSub link downloads a .vtt file: drop it in the 字幕 zone below, the result is the same.',
  uploadSubtitles:     'Upload a subtitle file (.srt, .vtt, .ass)',
  openOnYoutube:       'Open on YouTube',
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
  // How much of the line the server matched, printed beside the
  // learner's own answer on both stages that ask for one (ReadingRun,
  // DictationRun). A measurement, not a verdict — the verdict is the
  // rating bar under the card, and it is theirs.
  answerMatched:        n => `${n}% matched`,
  nextPhrase:           'Next phrase',
  translation:          'Translation',
  didYouGetIt:          'Did you get it right?',
  gradeCorrect:         'I got it right',
  gradeIncorrect:       'I got it wrong',

  // Word-by-word breakdown toggle + its per-word navigation
  // (ReadingRun.jsx, DictationRun.jsx) — shown once a phrase has been
  // graded.
  showBreakdown:        'Show breakdown',
  hideBreakdown:        'Hide breakdown',
  preparingBreakdown:   'Preparing breakdown…',
  // The settled failure, which 書取 can actually reach: its breakdown
  // is only asked for at the reveal (the sentence does not exist on
  // the client before that), so a dead model is visible here in a way
  // reading practice's own long prefetch window hides. 読解 shows it
  // too, for the slow or retrying call its prefetch does not outrun.
  breakdownUnavailable: 'Breakdown unavailable',
  // The comprehension passage, sentence by sentence (PassageBreakdown):
  // the chevron's name, and the caption over the points the text was
  // written around.
  openSentence:         'Open this sentence',
  closeSentence:        'Close this sentence',
  grammarInText:        'Grammar in this text',
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
// TranslationRun.jsx reuses reading/quiz's existing keys wholesale
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
  // The tutor's review as a shape, not a paragraph (routes/translation.py).
  reviewCorrect:         'Correct',
  reviewAcceptable:      'Acceptable',
  reviewPartial:         'Partly right',
  reviewIncorrect:       'Incorrect',
  reviewGood:            'What worked',
  reviewFix:             'To fix',
  reviewBetter:          'Corrected',
  // What the learner's own sentence says, in their language: asked for
  // by 作文 alone, drawn by components/study/TutorReview.jsx wherever a
  // review carries it.
  reviewMeaning:         'What it says',
  reviewGrammarUsed:     'used',
  reviewGrammarMissed:   'not used',
  analyzingTranslation:  'Analyzing your translation…',
  analysisUnavailable:   'Analysis unavailable — judge against the reference above.',
}
// ── 書取 — dictation ──────────────────────────────────────────
// DictationRun.jsx reuses the shared study/quiz keys wholesale
// (selectLevel, leaveLevels, stationJlpt, submit, retry, yourAnswer,
// translation/translationEnglish, nextPhrase, examAudioPause/
// examAudioPending/examAudioUnavailable) — only the genuinely new
// keys live here.
//
// The answer is written in romaji, and the copy says so everywhere it
// asks for one: a Japanese keyboard is a separate install on a laptop
// and a separate keyboard on a phone, so "in Japanese" was asking most
// learners for something they cannot type. Kana and kanji answers still
// measure full — the backend tries all three forms — the field just
// names the one they have.
const dictationMode = {
  dictationTitle:        'Dictation',
  dictationDesc:         'Write down what you hear, in romaji\nTwo listens, and no more\nN5 through N1',
  dictationFetchError:   "Couldn't load a clip. Try again.",
  dictationCheckError:   "Couldn't mark your answer. Try again.",
  dictationPlaceholder:  'Write what you heard, in romaji…',
  dictationPrompt:       'Write what you heard, in romaji',
  dictationListen:       'Listen',
  dictationListensLeft:  n => (n === 1 ? '1 listen left' : `${n} listens left`),
}

// ── 作文 — composition (plan 125) ───────────────────────────────
// CompositionRun.jsx reuses the shared keys wholesale (selectLevel,
// leaveLevels, stationJlpt, submit, retry, yourAnswer,
// japanesePlaceholder, aiAnalysis, analysisUnavailable, nextPhrase,
// readingGrammarPoint, glLesson, the review* keys, the breakdown and
// explain keys) — only the genuinely new keys live here.
const compositionMode = {
  compositionTitle:        'Composition',
  compositionDesc:         'Write a sentence with the point you are shown\nA tutor reads it back to you\nN5 through N1',
  compositionFetchError:   "Couldn't load a grammar point. Try again.",
  compositionPrompt:       'Write a sentence using',
  // The detector's word, on the answer's own label beside "Your answer":
  // a hint for the learner grading below, never the grade — and nothing
  // at all on a point the detector is not trusted on.
  compositionFound:        'point found',
  compositionNotFound:     'point not found',
  analyzingComposition:    'Reading your sentence…',
  // The day's reviews are spent (routes/composition.py, 429). The run
  // goes on: the check still prints and the rating still counts.
  compositionLimitReached: "That's every review for today — your check and your grade still count. The tutor is back tomorrow.",
}

// ── Dictionary ────────────────────────────────────────────
const dictionary = {
  dictionaryPlaceholder: 'Search a kanji, a kana or a meaning…',
  noResults:         'No results for',
  reading:           'Reading',
  romaji:            'Romaji',
  meaning:           'Meaning',
  examples:          'Examples',
  level:             'Level',
  listen:            'Listen',
  displayedKanji:    'kanji displayed',
    radical:           'Radical',
  // Additional dictionary keys used by screens
  dictAll:           'All',
  dictKanji:         'Kanji',
  dictVocab:         'Vocabulary',
  dictHiragana:      'Hiragana',
  dictKatakana:      'Katakana',
  // 文法 — the grammar collection: the 355 points of the JLPT line as
  // entries, narrowed by level in a second row of chips.
  dictGrammar:       'Grammar',
  dictLevels:        'Levels',
  dictLevelAll:      'All',
  // The search was retried against a word the catalogue holds, because
  // what was typed found nothing. A statement, not a question.
  dictCorrectedFor:  'Results for',
  dictionaryPlaceholderGrammar: 'Search a point, a structure or a meaning…',
  // お気に入り — the shelf of kept entries (plan 093): the sixth chip,
  // the star on the plate in both states, and the shelf with nothing
  // on it yet.
  dictAdd:             'Add',
  dictAddToDeck:       'Add to a deck',
  dictFavorites:       'Favourites',
  dictFavorite:        'Favourite',
  dictFavoriteAdd:     'Keep in favourites',
  dictFavoriteRemove:  'Remove from favourites',
  dictFavoriteFailed:  "Couldn't save that.",
  dictFavoriteFull:    'Favourites are full — remove one first.',
  dictFavoritesEmpty:  'No favourites yet',
  dictFavoritesHint:   'The star on an entry keeps it here.',
  // 文法 — the lesson (plan 087): the pair marks over the steps, the
  // door on every card and the station's index, the gate's one button.
  glLesson:          'Lesson',
  glPoints:          'The points',
  glRule:            'Rule',
  glUse:             'Use',
  glCareful:         'Careful',
  glCompare:         'Compare',
  glBoard:           'Understood — board',
  glBlank:           'gap',
  glRegister: { neutral: 'Neutral', casual: 'Casual', polite: 'Polite', formal: 'Formal', written: 'Written' },
  dictBackToRadicals:'Back to radicals',
  dictModeSearch:    'Search',
  dictModeRadical:   'Radical',
  dictionaryPlaceholderRadical: 'Filter these results by radical…',
  dictionaryResults: n => `${n} results`,
  dictRadicalNumber: (n) => `radical #${n}`,
  dictStrokesPlural: 'strokes',
  dictStrokeSingular: 'stroke',
  dictStrokeIndex:   'Stroke count index',
  dictStrokePrev:    'Fewer strokes',
  dictStrokeNext:    'More strokes',
  syllabaryMain:     'Main syllabary',
  syllabaryNSolo:    'ん',
  syllabaryVoiced:   'Voiced sounds',
  syllabaryYoon:     'Contracted sounds',
  syllabaryForeign:  'Foreign sounds',
  syllabaryLong:     'Long vowels',
  composingKanji:    'Made of these kanji',
  vocabExamples:     'Used in these words',
  kanaExamples:      'Read in these words',
  allReadings:       'All readings',
  readingsNoWords:   'No example words yet',
  // The two gates on the readings sheet. The Japanese half is the
  // heading and the plain-language half its caption (DESIGN.md, "Every
  // name is a pair") — never "ON'YOMI", which is the Japanese written
  // twice. The sheet's old 音 / 訓 squares said this to nobody who
  // could not already read them.
  readingsOnName:    'Chinese reading',
  readingsKunName:   'Japanese reading',
  // The 熟 on a word row whose reading belongs to the whole word
  // (今朝 けさ, 時計 とけい), not to the kanji the row is about.
  readingsWhole:     'Read as a whole word',
  // Icon-button title/aria-label on the dictionary-lookup action that
  // sits on a revealed card (RevealActions in QuizComponents.jsx).
  openDictionary:    'Open dictionary entry',
}

// Reading-comprehension / generic reading labels
const comprehension = {
  comprehensionTitle:       'Reading comprehension',
  comprehensionFetchError:  "Couldn't load a text. Try again.",
  comprehensionLimitReached: "That's every new text for today. Come back tomorrow.",
  comprehensionGenerating:  'Writing a text for you…',
  comprehensionSubmitError:  "Couldn't submit answers. Try again.",
  doneReading:              'Done reading',
  reReadText:               'Re-read the text',
  showTranslation:          'Show translation',
  hideTranslation:          'Hide translation',
  timeRemaining:           'Time remaining',
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
  onyomi:  "音読み · on'yomi",
  readingsMore: (n) => `${n} more reading${n > 1 ? 's' : ''} — the dictionary card has them all`,
  kunyomi: "訓読み · kun'yomi",
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
  mode_grammar_contrast:           'Which one fits',
  mode_grammar_contrast_desc:      'A sentence with a gap. Pick the pattern from the ones it is confused with.',

  mode_standard_flashcard_f2b:      'Front → back',
  mode_standard_flashcard_f2b_desc: 'Your card, the way you wrote it.',
  mode_standard_flashcard_b2f:      'Back → front',
  mode_standard_flashcard_b2f_desc: 'Your card, the other way round.',

  mode_fast_review:                'Fast review',
  mode_fast_review_desc:           'Flip through what you have already studied. Nothing is graded.',
  retry:              'Try again',
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
  chaseNext:         (xp, who) => `${xp} XP behind ${who}`,
  // ── 定期入れ — the pass-holder profile ──
  retention:         'Retention',
  daysStamped:       'Days stamped',
  ranking:           'Ranking',
  periodWeek:        'This week',
  periodAll:         'All time',
  east:              'East',
  west:              'West',
  passLabel:         'Commuter pass',
  passSince:         'Member since level 1',
  noActivityWeek:    'Nothing studied this week yet',
  profileTitle:      'Profile',
  profileStale:      "Couldn't reach the server — showing your last known data.",
  level:             'Level',
  leaderboard:       'Leaderboard',
  done:              'Done',
  genericError:      'Something went wrong. Try again.',

  // ── 定期券の裏 — the journey on the pass back (plan 063) ──
  // The Japanese status words (定刻, 遅延…) are signage and live in
  // the component; these are their plain-language captions and the
  // honest sentences beside the track.
  jourStatus: {
    suspended:      'Suspended',
    ahead:          'Running ahead',
    onTime:         'On schedule',
    slightlyBehind: 'Running behind',
    delayed:        'Delayed',
  },
  // The track's YOU / PLAN caption tags and its day-bracket label
  // retired with the two-lane drawing (see GhostTrack.jsx): the marks
  // now say which is which by their own form, and the day count is a
  // delta on the arrival row.
  jourYourLine:      'Your line',
  jourTurnOver:      'Turn over',
  jourFootOnTime:    (a, p, dest, date) =>
    `**${a} a day**, right on the promised **${p}**. ${dest} arrival holds at **${date}**.`,
  jourFootAhead:     (a, p, dest, days, date) =>
    `**${a} a day** against the promised **${p}** — ${dest} comes **${days} days early**, around **${date}**.`,
  jourFootBehind:    (a, p, dest, date, days) =>
    `Last 14 days: **${a} a day** against the promised **${p}**. At today's rhythm ${dest} arrives **${date}** — **${days} days** behind the date on your pass.`,
  jourFootSuspended: (date) =>
    `No study in 14 days. The **${date}** on your pass no longer means anything — resume, or reprint it with a date that does.`,
  jourFootPaceKept:  (a, p) =>
    `Last 14 days: **${a} a day** against your promised **${p}**. No fixed arrival — the pace is the whole promise.`,
  jourFootPaceSuspended: (p) =>
    `No study in 14 days against a promise of **${p} a day**. The line waits — the gate opens with one card.`,
  jourNoDest:        'No destination on this pass.',
  jourNoDestLink:    'Set one at the office',
  // The two moves are ONE choice, so they are written as one: the
  // first line is what you change, the second is the same sentence on
  // both — the date you then arrive. A reader compares two dates and
  // two paces, with no prose in between to hold the difference in.
  // The pace carries perDayUnit's own "/ day", which is what the PACE
  // row above these buttons already prints: the button and the figure
  // it is offering to change say the unit the same way, and it is two
  // characters rather than six on a 165px button.
  jourActRecover:    (pace) => `Run ${pace} / day`,
  jourActRecoverSub: (date) => `arrive ${date}`,
  jourActReprint:    'Reprint the pass',
  jourActReprintSub: (date) => `arrive ${date}`,
  jourActResume:     'Resume the line',
  jourActResumeSub:  'the pass is unchanged',
  jourActSlow:       (pace) => `Reprint at ${pace} / day`,
  jourActSlowSub:    (date) => `arrive ${date}`,
  jourReprintError:  "Couldn't reprint — try again.",

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
  // A guest holds no key: signing out ends the journey for good. The
  // row says so rather than letting it be discovered.
  signOutGuestDesc:  'Without an account your progress lives only on this device: signing out will erase it for good.',
  guestLabel:        'Guest pass',
  guestCap:          'No address',
  guestClaimDesc:    'Your progress is already here. Add an address and a password to keep it — nothing moves, it is the same account.',
  guestClaimConfirm: 'Almost: confirm the address from the link we just sent you.',
  guestClaimDone:    'Account created. Your progress is kept.',
  // 相互乗り入れ — Google on a pass that already has a key. Named
  // plainly, because the row has to answer the question the learner
  // arrives with: "why did signing in with Google not open my
  // account?" See components/settings/AccountPage.jsx.
  linkGoogleLabel:   'Google',
  linkGoogleCap:     'Not connected',
  linkGoogleDesc:    'Add Google to this account, and “Continue with Google” will open it rather than a new, empty one.',

  // Only ever surfaces as title/aria-label text (NavControls.jsx) —
  // the visible toggle is already a real IconSun/IconMoon SVG.

  volumeMaster:       'Master volume',
  volumeKana:         'Kana volume',
  volumeVoice:        'Voice volume',
  volumeEffects:      'Effects volume',
  volumeUi:           'Interface volume',
  volumeAmbiance:     'Ambiance volume',
  volumeJingle:       'Jingle volume',
  // The station announcements (playAnnouncement). This key was the one
  // channel in SLIDER_LABELS with nothing behind it in either locale,
  // so its row in the mixer drew a slider with no label at all.
  volumeAnnouncement: 'Announcements volume',
  volumeAnnouncements: 'Announcements volume',
}

// ── Decks ─────────────────────────────────────────────────
const decks = {
  decks:             'My Decks',
  createDeck:        'Create deck',
  deckNamePlaceholder: 'Deck name…',
  noDecks:           'No decks yet.',
  createFirstDeck:   'Create your first deck above.',
  // The shelf's own index — a search field and a row of type filters
  // (DecksScreen.jsx), modelled on the dictionary's console. `{n}` is
  // the count that survived both filters, following the same
  // placeholder convention browseSelectedCount uses.
  decksSearchPlaceholder: 'Find a deck…',
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
  kanaType:          'Kana',
  vocabType:         'Vocabulary',
  vocabDesc:         'Words graded N5 to N1\nOr by frequency, by theme, or past the syllabus\nForm to meaning, and back again',
  deckKanaDesc:      'Kana only — with stroke order',
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
  browseTabKanji:         '漢字 Kanji',
  browseTabVocab:         '語彙 Vocabulary',
  browseTabGrammar:       '文法 Grammar',
  browseAllLevels:        'All',
  browseSearchPlaceholder: 'Search (kanji, kana, meaning…)',
  browseResults:          'Results',
  // {n} follows the same placeholder convention as andMore above.
  browseSelectedCount:    '{n} selected',
  searching:              'Searching…',
  noResults:              'No results.',
  alreadyAdded:           'already added',
  close:                  'Close',
  adding:                 'Adding…',
  addSelected:            'Add ({n})',
  browseAddFailed:        "These cards weren't added. Try again.",
  // Bulk select
  selectAll:         'Select all',
  deselectAll:       'Deselect all',

  // Import modal
  importTitle:       'Import your data',
  importSubtitle:    'Paste your data here — from Word, Excel, Google Docs, anywhere.',
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
  importing:         'Importing…',
  cards:             'cards',
  andMore:           '… and {n} more',

  // Study screen
  studyMode:         'Study mode',
  mixWithJLPT:       'Mix in JLPT content (optional)',
  startSession:      'Start',
  writePractice:     'Writing practice',
  revealAnswer:      'Reveal answer',
  typeAnswer:        'Type your answer…',
  // Custom vocab/kanji deck phase labels (StudyScreen.jsx) — K+K→S is
  // Kanji+Kana → Sens (meaning), same three-phase progression as the
  // built-in vocab/kanji decks.
  studyPhase1:       'Phase 1 — K+K→S',
  studyPhase2:       'Phase 2 — K→S',
  studyPhase3:       'Phase 3 — S→K',

  // ── The library ───────────────────────────────────────────
  // "Library" alone, with no Japanese pair: owner's call, and the one
  // section in the app that reads Latin-only by design. See DESIGN.md.
  library:               'Library',
  // The door beside Create deck on the shelf: the verb, because it
  // sits next to one and the roundel beside it already says books.
  libraryBrowse:         'Browse',
  librarySeeAll:         'See all',
  libraryMore:           'Show more',
  librarySort:           'Order',
  librarySortNew:        'Newest',
  librarySortFollowed:   'Most followed',
  // The console's chip row, named for a screen reader. Its FIELD says
  // what 教材's own console says (decksSearchPlaceholder): one console
  // everywhere means the same words in it, and the longer sentence
  // ("Search the library…") was cut by the tally on a phone before
  // anything had been typed into it.
  libraryTypes:          'Deck types',
  libraryBy:             name => `by ${name}`,
  // The shelf and the library beside the lines on the desk, and the
  // library's three sections (plan 132).
  gateShelfEmpty:        'No decks on your shelf.',
  gateShelfEmptyHint:    'Make your own, or follow one from the library: it is reviewed with the rest.',
  gateDeckPublished:     'published',
  librarySeeCards:       n => `See the ${n} card${n === 1 ? '' : 's'}`,
  libraryFeatured:       'Featured',
  libraryFeaturedWhen:   'this week',
  libraryFollowing:      'Following',
  libraryFollowingCount: n => `${n} deck${n === 1 ? '' : 's'} followed`,
  libraryFollowingNone:  'You follow no decks. Follow one: the cards its author adds reach you.',
  libraryNewCards:       n => `+${n} card${n === 1 ? '' : 's'}`,
  libraryUpToDate:       'Up to date',
  libraryMine:           'Your publications',
  libraryMineCount:      n => `${n} deck${n === 1 ? '' : 's'} published`,
  libraryMineNone:       'No published decks. Publish one from its page: it appears here with its followers.',
  libraryWeeksLabel:     list => `New followers a week, over eight weeks: ${list}`,
  libraryFollowers:      n => (n === 1 ? '1 follower' : `${n} followers`),
  libraryAndMore:        n => (n === 1 ? 'and 1 more card' : `and ${n} more cards`),
  libraryEmpty:          'Nothing published yet',
  libraryEmptyHint:      'When other learners publish a deck, it appears here.',
  libraryFailed:         'The library could not be reached',
  libraryFailedHint:     'Check your connection and try again.',
  libraryGone:           'This deck is no longer available',
  libraryGoneHint:       'Its author may have taken it down.',
  libraryOpen:           'Open',
  libraryFollow:         'Follow',
  libraryPublish:        'Publish to the library',
  libraryPublished:      'This deck is in the library.',
  libraryUnpublish:      'Remove from the library',
  libraryMakeMine:       'Make it mine',
  libraryMakeMineConfirm: 'This makes your own editable copy of the deck, keeping the progress you have already made. You stop following the original.',
  libraryUnfollow:       'Unfollow',
  libraryUnfollowConfirm: 'The deck leaves your shelf. Your progress on it is kept, so following again picks up where you left off.',
  libraryRemove:         'Remove',
  libraryRemoveConfirm:  'The deck leaves your shelf for good. Make your own copy first if you want to keep it.',
  libraryWithdrawn:      'Withdrawn.',
  libraryWithdrawnHint:  ' Its author has deleted this deck. For a while yet, you can still study it and make your own copy.',
  libraryDeleteFollowed: n => (n === 1
    ? '1 learner follows this deck. Deleting it takes it off their shelf too — they will be told, and given a while to copy it.'
    : `${n} learners follow this deck. Deleting it takes it off their shelves too — they will be told, and given a while to copy it.`),
  libraryReport:         'Report',
  libraryReported:       'Reported',
  libraryReportNote:     'This flags the deck for review. Nothing is hidden automatically.',
  libraryReasonSpam:      'Spam or advertising',
  libraryReasonOffensive: 'Offensive content',
  libraryReasonWrong:     'Incorrect Japanese',
  libraryReasonCopyright: 'Copied without permission',
  libraryReasonOther:     'Something else',
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
  examGeneratingHint:  'A paper is written fresh only when there is none you haven’t already sat — that takes a minute or two. Once written, it loads instantly, for you and for everyone else.',
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
  examAudioPending:    'The audio for this question hasn’t been generated yet.',
  examAudioUnavailable: 'The audio for this question couldn’t be loaded.',

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

// ── みどりの窓口 — onboarding ──────────────────────────────
// ── 乗車 — the boarding (plan 075) ──────────────────────────
// The canvas's boarding: Welcome → name → why → the kana check → (the
// reveal | the level) → goal → rhythm → the hour → the nudge →
// building → the plan → the pass. The interface speaks the learner's
// language; the kana, the cards and the seal are content and stay
// Japanese (components/boarding/*, screens/BoardingFlow.jsx).
const boarding = {
  authFoot: 'Everything can be changed later in Settings.',
  authModeAria: 'Login or sign up',
  brdDocumentTitle: 'Boarding',
  // Welcome: the sign, the rolling stock, the promise.
  brdTagline: 'Reach your goals.',
  brdBoard: 'Board',
  brdHaveAccount: 'Already have an account? Sign in',
  // Google: "continue", never "sign up" or "sign in" — a provider does
  // not tell the two apart. You simply arrive.
  continueWithGoogle: 'Continue with Google',
  orWithEmail: 'or with an email address',
  // 改札 — a round trip that came back refused (lib/authRedirect.js).
  // Both name what happened rather than "something went wrong": on the
  // web these are read off the URL after the page has already been to
  // Google and back, and a learner who has just done that is owed the
  // reason, not a shrug.
  oauthAlreadyLinked: 'That Google account already belongs to another pass.',
  oauthSignInInstead: 'Sign in with that Google account',
  nativeReturnNote:  'Signed in. Returning to the app…',
  nativeReturnOpen:  'Open Tsuji',
  oauthLinkingOff: 'Google cannot be added to this pass right now. An email address can.',
  // 本乗車券 — putting an address on the pass (lib/guest.js). Same
  // rule as the two above: name what happened, and name the road that
  // is still open. Supabase's own sentences are developers' English,
  // and on the claim one of them quotes an empty address instead of
  // the one in the field — see lib/authErrors.js.
  claimEmailTaken: 'That address already has a pass. Sign in with it instead.',
  claimEmailUnreachable: 'The confirmation could not be sent to that address. Try another one, or keep your progress with Google.',
  claimWeakPassword: 'That password is too easy to guess. Try a longer one.',
  claimTooSoon: 'Too many attempts just now. Wait a minute and try again.',
  // Last stop: the account, asked once everything has been seen — and
  // refusable. "Keep" rather than "create": the progress already
  // exists, this only puts a key on it (lib/guest.js).
  brdAccountQ: 'Keep your progress.',
  brdAccountHint: 'Your journey is already saved. An account is how you reach it from another device — and how you keep it when you change phones.',
  brdAccountCreate: 'Create my account',
  brdAccountSkip: 'Continue without an account',
  brdDemoTag: { kanji: 'Kanji', vocab: 'Vocabulary', grammar: 'Grammar', dictation: 'Dictation', reading: 'Reading', kana: 'Kana', translation: 'Translation', analyzer: 'Analyzer', exam: 'Mock exam' },
  brdDemoMeaning: { station: 'station', toEat: 'to eat', whichRule: 'Which rule?', craft: 'craft', writeIt: 'Write it', readIt: 'Read it', kippu: 'kippu', ki: 'ki', sayIt: 'Translate it', yama: 'yama · san', breakItDown: 'Break it down', timer: '24:18' },
  brdDemoFoot: { kanjiMeaning: 'Kanji → meaning', wordMeaning: 'Word → meaning', sentenceRule: 'Sentence → rule', meaningKanji: 'Meaning → kanji', soundText: 'Sound → text', sentenceMeaning: 'Sentence → meaning', wordReading: 'Word → reading', kanaRomaji: 'Kana → romaji', meaningSentence: 'Meaning → sentence', kanjiReadings: 'Kanji → readings', sentenceGrammar: 'Sentence → grammar', timedPaper: 'Timed paper' },
  // The 翻訳 card's prompt is in the learner's language, so it is a
  // string of the interface's rather than content.
  brdDemoPrompt: { waiting: 'I’m waiting for a friend at the station.' },
  // The questions.
  brdNameQ: 'What’s your name?',
  brdNameAria: 'Your name',
  // The address the pass is being issued to, said on question one.
  // The boarding only runs on an account with nothing on it, so an
  // address here always means a NEW pass for that address — which is
  // the one thing a learner who meant to reach an OLD one needs to be
  // told before answering seven questions. A guest has no address and
  // never sees this line. "Below" is the sign-in link in the foot.
  brdNameNewPass: email => `A new pass, for ${email}. If your journey is on another account, sign in below instead.`,
  brdWhyQ: (name) => `Why are you learning Japanese, **${name}**?`,
  brdMotive: { studies: 'For my studies', fun: 'For fun', trip: 'For a trip to Japan', live: 'To live in Japan', friends: 'To make friends', other: 'Something else' },
  brdKanaQ: 'Can you read this?',
  brdKana: { hiragana: 'Hiragana', katakana: 'Katakana', both: 'Both', none: 'Not yet' },
  brdKanaWord: { sushi: 'sushi', hotel: 'hotel' },
  brdRevealQ: 'Soon you’ll read both.',
  brdRevealHint: 'Two scripts, 46 signs each. Your first stop.',
  brdLevelQ: 'Nice! What’s your level?',
  brdLevelHint: 'The stops behind you will be marked known.',
  brdNovice: 'Novice',
  // The kanji figure is the app's own count through that stop (~, rounded).
  brdLevelDesc: {
    novice: 'Kana and a few words',
    N5: (k) => `Simple phrases · ~${k} kanji`,
    N4: (k) => `Everyday talk · ~${k} kanji`,
    N3: (k) => `Daily life with ease · ~${k} kanji`,
    N2: (k) => `News and work · ~${k} kanji`,
    N1: (k) => `Almost anything · ~${k} kanji`,
  },
  brdGoalQ: 'What’s your goal?',
  brdGoalHint: (level) => `The stops ahead of ${level}.`,
  // Nobody has a stop behind them before the kana: the list opens with
  // the novice's own, so it names no level (domain/boarding.js goalStops).
  brdGoalHintStart: 'Every stop is ahead of you.',
  brdNextStop: 'Next stop',
  // The lines: what to learn. The kana are not a row -- every ticket
  // rides them -- so the hint says so (components/boarding/LinesStep.jsx).
  brdLinesQ: 'What do you want to learn?',
  brdLinesHint: 'The kana ride on every ticket. Pick any of the rest.',
  brdLinesNone: 'Pick at least one line.',
  brdLine: { vocab: 'Vocabulary', kanji: 'Kanji', grammar: 'Grammar' },
  brdLineDesc: {
    vocab: 'Words, N5 to N1',
    kanji: 'Readings, meanings, writing',
    grammar: 'Patterns, with examples',
  },
  brdRhythmQ: 'What’s your rhythm?',
  brdMinADay: 'min a day',
  brdNewItems: (n) => `~${n} new items`,
  brdChangeLater: 'You can change it later.',
  brdTimeQ: 'When do you study?',
  brdDeparture: 'Departure',
  brdDayAria: 'Departure time',
  // The nudge (native only), and the notification as the app sends it.
  // brdAppName is the store name, the one the notification header
  // shows; keep it in step with capacitor.config.json's appName.
  brdNudgeQ: (time) => `A nudge at **${time}**?`,
  brdAppName: 'Tsuji',
  brdNotifNow: 'now',
  brdNotifTitle: (time) => `Your train leaves at ${time}`,
  brdNotifText: 'Your cards are waiting at the gate.',
  brdNudgeHint: 'One a day, at your time. Never more.',
  brdAllow: 'Allow notifications',
  brdNotNow: 'Not now',
  // The arrival: building, the plan, the pass.
  brdBuildingQ: (name) => `Building your journey, **${name}**`,
  brdBuildingAria: 'Building your journey',
  brdBuildGoal: 'Your goal',
  brdBuildLines: 'Your lines',
  brdBuildRide: 'Your daily ride',
  brdBuildProjection: 'Your projection',
  brdArrivalTitle: 'Your plan',
  brdPlanQ: (name) => `Your plan is ready, **${name}**.`,
  brdChartTitle: 'Your projection',
  brdChartAria: (words) => `Words remembered over the ride: daily reviews climb to about ${words}; cramming levels off early.`,
  brdChartLabel: (words) => `~${words} words · daily reviews`,
  // The same chart for a ticket without the words on it: it climbs to
  // everything the chosen lines hold.
  brdChartAriaItems: (n) => `Items remembered over the ride: daily reviews climb to about ${n}; cramming levels off early.`,
  brdChartLabelItems: (n) => `~${n} items · daily reviews`,
  // The same chart for a ride to the novice's stop, which promises
  // signs rather than words.
  brdChartAriaKana: (kana) => `Kana remembered over the ride: daily reviews climb to about ${kana}; cramming levels off early.`,
  brdChartLabelKana: (kana) => `~${kana} kana · daily reviews`,
  brdChartCram: 'cramming',
  brdLegendUs: (min) => `Daily reviews, ${min} min`,
  brdLegendThem: 'Cramming',
  brdChartCap: 'Spaced reviews against cramming — an illustration, not a measurement.',
  brdLead: (min, date, purpose) => `At **${min} min a day**, by **${date}**, ${purpose}:`,
  brdFor: { studies: 'for your studies', fun: 'for the fun of it', trip: 'for your trip', live: 'for your life in Japan', friends: 'for your friends', other: 'for yourself' },
  // The first promise: one figure per line on the ticket, joined.
  brdFigWords: (n) => `~${n} words`,
  brdFigKanji: (n) => `~${n} kanji`,
  brdFigGrammar: (n) => `~${n} grammar points`,
  brdBulletFigures: (parts) => (parts.length > 1 ? `${parts.slice(0, -1).join(', ')} and ${parts.at(-1)}` : parts[0] ?? ''),
  // The novice's stop, taken as a goal: the kana, and the line that
  // waits beyond them. No word count, and no motive line — three weeks
  // of signs cannot promise a drama without pausing.
  brdBulletKana: 'Both kana scripts, read on sight',
  brdBulletThenLine: 'Then the whole line, stop by stop',
  // Two promise lines per motive (the canvas's boarding note).
  brdPromise: {
    studies: ['Your course material', 'A lecture’s key terms'],
    fun: ['Manga panels, lyrics', 'A drama without pausing'],
    trip: ['Read signs, menus and tickets', 'Ask your way, order, book a room'],
    live: ['The town hall, the bank, the doctor', 'Your mail and contracts'],
    friends: ['Chat by message', 'A dinner conversation'],
    other: ['Read what you meet every day', 'Say what you mean'],
  },
  brdOnTrack: (level) => `On track for JLPT ${level}`,
  brdOnTrackLine: 'On track for the whole line',
  brdOnTrackKana: 'On track for the kana',
  brdPassQ: (name) => `Your pass is ready, **${name}**.`,
  brdEnjoy: 'Enjoy the ride.',
  brdCreditsGift: (n) => `+${n} credits, on the house`,
  brdEnter: 'Enter the station',
}

const ride = {
  // 試乗 — the test ride (plan 098): the first two cards, on the real
  // stage. One sentence per step, beside the thing it is about; the
  // pair names the place (the stage head), the notes do not repeat it.
  rideDocumentTitle: 'Test ride',
  rideJp: '試乗',
  rideCap: 'Test ride',
  rideSkip: 'Skip',
  rideKnownFront: 'A card. The word is on the front. Tap it to turn it over.',
  rideKnownBack: 'Did you know it? Say so. You are the one who grades.',
  rideUnknownFront: 'This one you have not met. Turn it over.',
  rideUnknownBack: 'Say wrong. Wrong is not a fault: the card comes back sooner, and that is the whole method.',
  // 机 (plan 115): the same notes, teaching the desk's keys.
  rideKnownFrontDesk: 'A card. The word is on the front. Click it or press Space to turn it over.',
  rideKnownBackDesk: 'Did you know it? Say so, on the bar or with its number keys. You are the one who grades.',
  rideUnknownFrontDesk: 'This one you have not met. Turn it over, with a click or Space.',
  rideUnknownBackDesk: 'Say wrong, on the bar or with its key. Wrong is not a fault: the card comes back sooner, and that is the whole method.',
  rideGuessed: 'Guessed it? Then it comes back in a few days. Say wrong when you guessed.',
  rideDoneBody: n => `That is the game. **${n} new words a day**, each one back just before you forget it.`,
  rideContinue: 'Continue',
  // The reading ride (plan 099): the sentence, the field, the measure,
  // then the plate that says which platforms ride on the pass.
  rideReadFront: 'Read it. It hides in a moment.',
  rideReadType: 'Write what you read, in romaji or kana.',
  rideReadMeasure: 'The figure is how much you caught. The grade is yours.',
  rideReadMeasureDesk: 'The figure is how much you caught. The grade is yours: on the bar, or with its number keys.',
  // Plan 133. On a phone: the known card is not graded until its entry
  // has been opened from the 🔍 and closed again.
  rideKnownDict: 'Every card opens its dictionary entry. Tap 🔍 to read this one, then close it.',
  // On the desk: the walk round a run's three panels, stop by stop
  // (screens/RideRun.jsx's TOUR_FRONT and TOUR_BACK), read by the guide
  // as guide<Key>.
  guideRideRecords: 'This run in figures: the cards you have graded, the share you knew, the XP they earned, what is left. Your level bar is under them.',
  guideRideState: 'Where the card on the stage stands: new, learning or learned.',
  guideRideVerdicts: 'Every grade you can give, and when it would bring the card back. The number in the corner is its key.',
  guideRideKeys: 'The keys: Space turns the card, Esc leaves the run.',
  guideRideRhythm: 'Your pace: minutes on this run, cards a minute, and about how long the rest will take.',
  guideRideCard: 'The card, in the middle. The word is on its front.',
  guideRideRate: 'The grades, under the card. They light once the card is turned.',
  guideRideSealed: 'The card’s details. Sealed until you turn it: here, they would give the answer away.',
  guideRideEntry: 'Turned: the details open. The word, your record on it, and its dictionary entry. A word or a kanji in it opens here too.',
  guideRideForecast: 'Now the grades say when each brings this card back. Wrong is the soonest.',
  // The reading ride's walk (screens/RideReading.jsx's TOUR_READ and
  // TOUR_GRADED): the same three panels on a practice run.
  guideRideReadRecords: 'This run in figures: the sentences you have graded, the share right, the XP they earned.',
  guideRideReadLines: 'Every sentence of the run, the one on the stage last. Each keeps its grade as a dot, and a click opens its breakdown again.',
  guideRideReadKeys: 'The keys: Enter checks your answer and takes the next sentence, the numbers grade, Esc leaves.',
  guideRideReadRhythm: 'Your pace: minutes on this run, and sentences a minute.',
  guideRideReadSentence: 'The sentence shows here with its clock, and hides when the clock runs out. It starts when you close this.',
  guideRideReadAnswer: 'Write what you read here, in romaji or kana, and press Enter.',
  guideRideReadSealed: 'The sentence’s breakdown. Sealed until you grade it: word by word, it is the answer key.',
  guideRideReadBreakdown: 'Graded: the breakdown opens. Every word and the grammar that holds them. Click a row to open its entry here.',
  guideRideReadLine: 'The sentence is a line of the run now, with its grade. In a real run, any line opens its breakdown again.',
  ridePlateCap: 'The pass',
  ridePlateBody: 'These platforms ride on the pass.',
  ridePlateOpen: 'They are open to everyone for now.',
}

const guide = {
  // 案内 — the guide over each gate (plan 100): one sentence a stop,
  // beside the thing it is about. The note carried a Japanese eyebrow
  // naming the stop until 2026-09-21; the sentence is the note now.
  guideLabel: 'Guide',
  guideNext: 'Next',
  guideDone: 'Done',
  guideSkip: 'Skip',
  guideHudLevel: 'Your level. Every card you rate pays into it.',
  guideHudStatus: 'On time or behind your own plan. Tap it for the ghost train.',
  guideHudPass: 'Your balance. Reviews cost one each; it refills at midnight.',
  guideTodayStrip: 'The week, the streak, and today\'s new items against your pace.',
  guideTodayGate: 'What is due today, line by line. Switch a line off to leave it for later, then depart.',
  guideTabBar: 'The five gates: Learn, Practice, Today, Dictionary, your pass.',
  guideLearnPlate: 'A line. Tap the plate to open it; the chip is what it owes you today.',
  guideLearnStops: 'Where you stand on the line, and the stops either side.',
  guideLearnShelf: 'Your own decks, and the library other learners publish to.',
  guidePracticePlate: 'A platform: sentences to read, understand, translate, take down or write — and the mock exam.',
  guidePracticeDests: 'The levels. Yours is marked; tap another to ride it anyway.',
  guidePracticePass: 'These platforms ride on the pass.',
  guideDictConsole: 'Search by word, reading or meaning.',
  guideDictChips: 'The collections, and your shelf of kept entries at the end.',
  guideDictEntry: 'An entry. Tap it to open; the star keeps it on your shelf.',
  guideDictAnalyzer: 'The analyzer: paste, photograph or film a sentence and take it apart.',
  guideProfilePass: 'Your pass: the level, the balance, your name.',
  guideProfileStamps: 'The stamp rally: one a day you study.',
  guideProfileRecords: 'Your figures, and the door to the statistics.',
  guideProfileLedger: 'Each line, and how far along it you are.',
  guideProfileSettings: 'Settings: the level, the pace, the bar you rate with, and this guide again.',
  // 机 (plan 115): the notes that teach the desk's keys and doors.
  guideTabBarDesk: 'The five gates, down the left. Press / from anywhere to search the dictionary.',
  guideTodayGateDesk: 'What is due today, line by line. Switch a line off to leave it for later, then depart: Enter does it from anywhere here.',
  guideLearnStopsDesk: 'The whole line. Every stop on it is a door to its platforms.',
  // Worded for a pointer (plan 123): the notes that said "tap".
  guideHudStatusDesk: 'On time or behind your own plan. Its ghost train stands beside the gate.',
  guideLearnPlateDesk: 'A line. Click the plate to open it; the chip is what it owes you today.',
  guidePracticeDestsDesk: 'The levels, and what you have done at each. Yours is marked; click another to ride it anyway.',
  guideDictEntryDesk: 'An entry, open beside the catalogue. ← and → walk the catalogue; the star keeps it on your shelf.',
  // Settings, the two ways back.
  settingsFirstRide: 'First ride',
  settingsRideAgain: 'Take the test ride again',
  settingsGuideAgain: 'Show the guide again',
  settingsGuideAgainDone: 'It will play on each gate\'s next opening.',
}

const onboarding = {
  durDays: (n) => `${n} days`,
  durMonths: (n) => `${n} mo`,
  durYears: (n) => `${n} yr`,
  onbContinue: 'Continue',
  onbStepsAria: (n, total) => `Step ${n} of ${total}`,
  onbTestProgress: (n, total) => `${n} / ${total}`,
  onbTestKind: {
    reading: 'How is this word read?',
    orthography: 'Which is the correct kanji spelling?',
    context: 'Which word completes the sentence?',
    grammar: 'Which grammar rule is at work?',
  },
  onbTestStop: 'Stop here — place me from my answers so far',
  onbTestFinish: 'See my result',
  onbTestError: 'The test could not be loaded. Try again in a moment.',
  onbTestRetake: 'Retake the test',
  onbTestResult: (level, correct, total) => `${correct} of ${total} correct — we recommend boarding at ${level}.`,
  onbPaceRecommended: 'Recommended',
  onbPassError: 'Saving failed — check your connection and try again.',
  // The other half of a failed save: the office ANSWERED and refused
  // it. Sending the learner to check a connection that is plainly
  // working is a wrong turn they cannot take -- and "try again" is a
  // false promise, since the same contract earns the same refusal.
  brdPassRefused: 'The office could not issue this pass — that is on our side, not your connection. Nothing was saved.',
  // The daily pace, lived: the concourse 新規 gauge and the study
  // screens' session terminus (see components/study/usePace.js).
  paceDoneTitle: 'Today’s target reached',
  paceDoneOf: target => `of ${target}`,
  paceDoneLabel: 'new cards today',
  paceDoneBody: 'That is today’s share of new cards. Reviews keep running as usual.',
  paceExtraTrain: 'Keep the new cards coming',
  paceGaugeLabel: 'New items',
  paceGaugeAria: (n, target) => `${n} of ${target} new items learned today`,
  settingsLearning: 'Learning',
  settingsJlptLevel: 'JLPT level',
  settingsPace: 'Daily pace',
  // The lines to ride (backend core/lines.py): the Learn gate hangs
  // these first and the plan is priced at them. The kana are not a
  // toggle -- every ticket rides them.
  settingsLines: 'Your lines',
  settingsLinesCap: 'What you are learning',
  settingsLinesHint: 'The kana ride on every ticket. At least one line stays on.',
  settingsLineOn: 'On your route',
  settingsLineOff: 'Off your route',
  plateOffRoute: 'Off your route',
  // A grade's record on a Practice platform, on the desk (plan 130):
  // what was done at that grade, then the share of it that went right.
  practiceDone: {
    sentences: n => `${n} sentence${n === 1 ? '' : 's'}`,
    texts: n => `${n} text${n === 1 ? '' : 's'}`,
    papers: n => `${n} paper${n === 1 ? '' : 's'}`,
  },
  practiceRight: pct => `${pct}% right`,
  practiceNotYet: 'Not yet',
  settingsRedoDesc: 'Take it again once you’ve progressed — your level moves with you.',
  // ── Which rating bar to grade with ──────────────────────────
  // Two buttons, four or six. All three send the same rating to the
  // scheduler — each shorter bar is a longer one with buttons left off
  // — so this changes what you are offered, never what your answers
  // mean.
  settingsRatingScale: 'Rating buttons',
  settingsRatingScaleOption: { binary: '2 grades', simple: '4 grades', full: '6 grades' },
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
  settingsRedo: 'Placement test',
  settingsCredits: 'Credits',
  creditsWhat: { dictionary: 'Dictionary', kanji: 'Kanji', strokes: 'Stroke order', sentences: 'Example sentences', voice: 'Station voice', speech: 'Japanese speech', kana: 'Kana voice', type: 'Typefaces' },
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
  settingsTrail: 'Usage statistics',
  settingsTrailHint: 'Which screens are opened, never what you write. Kept on our own server, never shared.',
  settingsTrailOn: 'Counted',
  settingsTrailOff: 'Not counted',
  settingsExport: 'Export your progress',
  settingsExportHint: 'One CSV file — every card, its schedule, its review counts.',
  settingsExportBtn: 'Export',
  settingsReset: 'Reset your progress',
  settingsResetHint: 'Every review, your XP and your streak. Decks, level and settings stay.',
  settingsResetBtn: 'Reset',
  settingsResetConfirmQ: 'Erase everything? This cannot be undone.',
  settingsResetYes: 'Erase everything',
  settingsResetDone: 'Progress reset. The map starts fresh.',
  settingsDeleteAccount: 'Delete your account',
  settingsDeleteAccountHint: 'Every review, deck, card, setting and your sign-in. Export first to keep a copy.',
  settingsDeleteAccountBtn: 'Delete',
  settingsDeleteAccountConfirmQ: 'Delete your account and everything in it? This cannot be undone.',
  settingsDeleteAccountYes: 'Delete my account',
  settingsDeleteAccountFailed: 'Your account couldn’t be deleted. Try again.',
  privacyPolicy: 'Privacy policy',
  // ── The installed app (plan 065) ──
  pwaUpdateReady: 'A new timetable is in effect.',
  pwaUpdateBtn: 'Reload',
  pwaUpdateLater: 'Later',
  offlineLine: 'No connection — the station is closed for now.',
  installApp: 'Install the app',
  installAppHint: 'On your home screen, full screen, with the kana audio kept for offline use.',
  installAppBtn: 'Install',
  installIosTitle: 'Add to your home screen',
  installIosStep1: 'Tap Share in Safari\'s toolbar.',
  installIosStep2: 'Choose "Add to Home Screen", then Add.',
  installIosBody: 'iPhone and iPad install web apps from Safari\'s share sheet — there is no button for it.',
  settingsIssuedTo: 'Card issued to',

  // ── 行先 — the destination counter ────────────────────────
  // The office's own words, reused where the office is not: the
  // counter borrows the departure board whole, so it only needs the
  // sentences the board cannot draw — what a button will do, and what
  // it costs.
  settingsGoal: 'Destination',
  settingsGoalNoneDesc: 'No destination on this pass. You ride the open line — the pass still keeps score, on rhythm alone.',
  settingsGoalChangeDesc: 'Reprint the pass with a different destination, date or service.',
  settingsGoalSet: 'Choose a destination',
  settingsGoalChange: 'Change',
  settingsGoalTerminus: 'You board at N1 — the end of the line. There is no station further on to promise.',
  settingsGoalIssue: 'Issue',
  settingsGoalIssueHint: (dest, date, perDay) =>
    `Prints ${dest} for ${date}, and sets your daily pace to ${perDay}. The date is measured from today, so today is when the promise starts.`,
  settingsGoalPickHint: 'Pick a destination and the board prices it — or keep riding the open line.',
  settingsGoalDrop: 'Hand it back',
  settingsGoalDropHint: 'Hands the destination back. Your pace and your hour stay, and the pass reports on rhythm alone — you can buy another destination whenever you like.',
  settingsGoalIssued: 'Pass issued. Your line is on the back of it.',
  settingsGoalDropped: 'Destination handed back. The line runs on without one.',
  settingsGoalDepartHint: 'The hour you plan to ride — optional, and never a reminder. It is printed on the pass because a promise with a time of day is likelier to survive its first rainy week.',
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
  ...dictationMode,
  ...compositionMode,
  ...dictionary,
  ...comprehension,
  ...progress,
  ...misc,
  ...profile,
  ...settings,
  ...decks,
  ...exam,
  ...onboarding,
  ...boarding,
  ...ride,
  ...guide,
}