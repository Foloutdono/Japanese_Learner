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
  balanceRefillEvery: (min) => `every ${min} min`,
  balanceNext:       (at) => `next at ${at}`,
  balanceHolds:      (cap) => `holds up to ${cap}`,
  balanceKanaFree:   'Kana reviews cost nothing',
  balanceStepsFree:  'A card you are still learning repeats for free: you pay when you first meet it, then for each review once it has stuck',
  gateShort:         (rides, due) => `Only ${rides} of the ${due} can board`,
  gateNoCredits:     (at) => (at ? `No credits left — +1 at ${at}` : 'No credits left'),
  runOutTitle:       'Out of credits',
  runOutCleared:     (n) => `${n} cleared`,
  runOutWaiting:     (n) => `${n} wait for the refill`,
  runOutWaits:       'waiting',
  // 補充 — what the refill landed while the app was closed (plan 141)
  claimTitle:        'While you were away',
  claimButton:       'Claim',
  claimBookLabel:    (n, cap) => `${n} credits of ${cap}`,
  // 無料 — a lane that costs nothing (domain/credits.js).
  freeFare:          'free',
  laneNew:           n => `${n} new`,
  // 区間 — the desk gate's run length and fare foot (plan 135)
  gateTake:          'Run length',
  gateTakeAll:       n => `All · ${n}`,
  gateTakeOf:        n => `of ${n}`,
  gateModes:         'Cards to board',
  gateModesAll:      n => `Every mode · ${n}`,
  gateModesMain:     n => `Main cards · ${n}`,
  gateWhich:         'Which cards',
  gateHowMany:       'How many',
  gateServices:      'Choose the services',
  gateServicesOf:    (on, all) => `${on} of ${all}`,
  gateServicesTitle: "Today's services",
  gateMinutes:       'min',
  gateMinutesLabel:  n => `about ${n} minutes`,
  gateRides:         'board',
  gateWaits:         (at) => (at ? `wait · +1 at ${at}` : 'wait'),
  gateBalance:       'credits',
  laneWaits:         at => `waits ${at}`,
  weekAhead:         'The next seven days',
  weekLeft:          'Left for tomorrow',
  gateRidesFree:     'board · free',
  fareReviews:       'reviews',
  fareFare:          'fare',
  fareCreditsLeft:   'credits left',
  // 基礎 — the basics course on the gate and in Settings › Level (plan 186f)
  basicsUnit:        (n, of) => `Unit ${n} of ${of}`,
  basicsMet:         (n, of) => `${n} of ${of} units met`,
  basicsDone:        'Basics done — the rest of N5 is open.',
  basicsSkip:        'Skip the basics',
  basicsSkipLabel:   'Basics',
  basicsSkipAct:     'I know them',
  basicsSkipped:     n => `${n} basic cards marked known.`,
  // 基礎 — the course's station on the Learn gate (plan 186g)
  basicsTitle:       'Basics',
  basicsDesc:        'N5 from its first lesson\nOne unit at a time\nIts rules, its words, its kanji',
  basicsUnits:       'Units',
  basicsPoints:      'Grammar',
  basicsWords:       'Words',
  basicsKanji:       'Kanji',
  basicsSentences:   'Sentences',
  basicsMetOf:       (met, total) => `${met} of ${total} met`,
  // ── 定期券 — the offer's doors and its thanks (domain/paywall.js) ──
  paywallName_pro:    'Tsuji Pro',
  paywallThanks:      'Noted — we’ll tell you when it opens.',
  paywallOpen:        'See Pro',
  paywallRowValue:    'Soon',
  // ── 定期券 — the three offers (plan 172, components/offers/) ──
  ofrLabel:           'Tsuji plans',
  ofrCardBrand:       'Pass',
  ofrCardPro:         'Pro',
  ofrCardMax:         'Max',
  ofrCardFarePro:     'Practice · 1 credit',
  ofrCardFareMax:     'Practice · no credit',
  // ── 定期券 — the card, face and back (plan 173) ──
  cardFree:           'Free',
  cardFareFree:       'Practice · locked',
  cardTurn:           'Turn the card over',
  cardLevelTo:        (a, b) => `Level ${a} → ${b}`,
  cardJourney:        'Journey',
  cardIssued:         (when) => `Issued ${when}`,
  cardOnPage:         'On the page',
  cardPerExercise:    '1 per exercise',
  cardNoCredit:       'Practice free of credits',
  cardNoCreditShort:  'no credit',
  cardUnlimited:      'Unlimited',
  cardDriftAhead:     (n) => `${n} d ahead`,
  cardDriftLate:      (n) => `${n} d late`,
  cardLines:          (names) => `Lines: ${names}`,
  ofrPlatforms: { reading: 'Reading', comprehension: 'Comprehension', translation: 'Translation', dictation: 'Dictation', composition: 'Composition', exam: 'Mock exam' },
  ofrPerMonth:        '/ month',
  // The 7-day trial (DISCOVER)
  ofrDiscEyebrow: { trip: 'For your trip to Japan', studies: 'For your studies', fun: 'For the fun of it', live: 'For living in Japan', friends: 'For your Japanese friends', other: 'Tsuji Pro' },
  ofrDiscLede: {
    trip: 'Read the signs and the menus, understand what you’re told, write your first sentences.',
    studies: 'Train for the JLPT: timed mock exams, reading, listening and writing.',
    fun: 'Read your manga, understand your anime, write your own sentences.',
    live: 'Read what you come across, understand speech, write your everyday messages.',
    friends: 'Write them your own sentences, understand their answers, translate without hesitating.',
    other: 'Reading, comprehension, translation, dictation, composition and mock exams: your cards become Japanese.',
  },
  ofrDiscTitle:       (days) => `${days} days of practice, on us.`,
  ofrTrialKind:       'Free trial · Pro yearly',
  ofrTrialUnit:       (days) => `for ${days} days`,
  ofrTrialBill:       (year, month) => `then ${year} a year, ${month} a month`,
  ofrTrialStub:       (days) => `${days} d`,
  ofrTrialStubCap:    'free',
  ofrDiscLater:       'Keep it free',
  ofrDiscCta:         (days) => `Try ${days} days`,
  ofrDiscFine:        (days) => `Cancel before day ${days}: you pay nothing.`,
  ofrDemoQuestion:    'Where is the coffee drunk?',
  ofrDemoHome:        'At home',
  ofrDemoStation:     'At the station',
  ofrDemoSentence:    'I drink a coffee at the station.',
  ofrDemoPrompt:      'A sentence with で, the place:',
  ofrDemoTutor:       'The tutor: natural and correct.',
  // The week the credits stopped (WEEK)
  ofrWeekCap:         'Your last 7 days',
  ofrWeekDone:        'reviewed',
  ofrWeekWaiting:     'waiting',
  ofrWeekCeiling:     (n) => `limit: ${n} credits / day`,
  ofrWeekGain:        (n) => `+${n} cards reviewed with Pro`,
  ofrWeekChart:       (stops, waited) => `Your last 7 days: ${stops} day${stops > 1 ? 's' : ''} when cards waited, ${waited} card${waited > 1 ? 's' : ''} in all.`,
  ofrWeekEyebrow:     'Your week',
  ofrWeekTitle:       (n) => (n === 1 ? 'Your credits stopped you once this week.' : `Your credits stopped you ${n} times this week.`),
  ofrWeekLede:        (n) => `${n === 1 ? '1 card' : `${n} cards`} waited for the next day. With Pro, you review everything that’s due, the same day.`,
  ofrProYearKind:     'Pro · yearly',
  ofrBilledYearly:    (price) => `${price} billed once a year`,
  ofrSave:            (pct) => `−${pct}`,
  ofrSaveCap:         'vs monthly',
  ofrWeekLater:       (time) => (time ? `Wait · +1 credit at ${time}` : 'Wait for the refill'),
  ofrWeekCta:         'Review without limits',
  ofrWeekFine:        (monthly) => `Cancel anytime · or ${monthly} a month`,
  // The step up to Max (MAX)
  ofrMaxKind:         'Max · yearly',
  ofrMaxBill:         'The difference with your Pro, prorated',
  ofrMaxCta:          'Upgrade to Max',
  ofrMaxFine:         'Takes effect now · Cancel anytime',
  ofrStayPro:         (when) => `Stay on Pro · ${when}`,
  ofrNextCredit:      (time) => `+1 credit at ${time}`,
  ofrTomorrow:        'again tomorrow',
  ofrNextMonth:       (n, date) => `${n} more on ${date}`,
  ofrInstead:         (n) => `instead of ${n}`,
  ofrFareEyebrow:     'No credits left today',
  ofrFareTitle:       'With Max, practice costs no credits.',
  ofrFareWithPro:     'With Pro',
  ofrFareWithMax:     'With Max',
  ofrFareCredits:     'Credits:',
  ofrFareIncluded:    'Practice included',
  ofrFareOne:         '1 credit',
  ofrFareFree:        'Included',
  ofrFareOut:         'No credits left',
  ofrFareStubCap:     'credits per exercise',
  ofrValPhotos:       'photos a day',
  ofrValExplains:     'explanations a day',
  ofrValPapers:       'new mock exams a month',
  ofrPhotosCount:     'Photos today',
  ofrPhotosEyebrow:   (n) => `${n} of ${n} photos today`,
  ofrPhotosTitle:     'Read everything you come across.',
  ofrPhotosLede:      (max, pro) => `With Max, ${max} photos a day instead of ${pro}, and practice costs no credits.`,
  ofrPhotosShut:      'Today’s limit reached',
  ofrPhotosGloss:     'soy sauce',
  ofrPhotosStubCap:   'photos / day',
  ofrExplCount:       'Explanations today',
  ofrExplEyebrow:     (n) => `${n} of ${n} explanations today`,
  ofrExplTitle:       'Understand every sentence.',
  ofrExplLede:        (max, pro) => `With Max, ${max} explanations a day instead of ${pro}, and practice costs no credits.`,
  ofrExplWait:        'Explaining',
  ofrExplTranslation: '“I drink a coffee at the station.”',
  ofrExplNotes:       ['“at the station”: where it happens', '“a coffee”: what is drunk', 'the polite form of “to drink”'],
  ofrExplStubCap:     'explanations / day',
  ofrExamCount:       'New mock exams this month',
  ofrExamEyebrow:     (n) => `${n} of ${n} new mock exams this month`,
  ofrExamTitle:       'A new mock exam whenever you want.',
  ofrExamLede:        (max, pro) => `With Max, ${max} new mock exams a month instead of ${pro}, and every exam without credits.`,
  ofrExamPaper:       (level, n) => `${level} · exam ${n}`,
  ofrExamNext:        'Next new exam',
  ofrExamOn:          (date) => `on ${date}`,
  ofrExamNew:         'New',
  ofrExamSections:    ['Vocabulary', 'Grammar', 'Reading', 'Listening'],
  ofrExamStubCap:     'exams / month',
  ofrUpEyebrow:       'Your plan: Pro yearly',
  ofrUpTitle:         'Go from Pro to Max.',
  ofrUpChanges:       'What changes',
  ofrUpPractice:      'Practice and mock exams',
  ofrUpPhotos:        'Photos analysed a day',
  ofrUpExplains:      'Explanations a day',
  ofrUpPapers:        'New mock exams a month',
  ofrUpDecks:         'Decks · cards',
  ofrUpCredit:        '1 credit',
  ofrUpNoCredit:      'No credit',
  ofrUpKeep:          'Keep Pro',
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

  // The four levels inside a theme, placed by difficulty (see
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
  deskKeysHelp:        'Help',
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
  deskKeyReveal:       'shows the sentence',
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
  field_sentences_group: 'Example sentences',
  field_sentences_jp: 'Japanese sentence',
  field_sentences_tr: 'Translation',
  field_rule_reading: 'Reading of the rule',
  field_structure:  'Formation',
  field_register:   'Register',
  field_explanation: 'Explanation',
  field_usage:      'Uses',
  field_careful:    'Watch out',
  field_compare:    'Similar rule',
  field_compare_group: 'Similar rules',
  field_compare_pattern: 'Similar rule',
  field_compare_text: 'What sets them apart',
  field_notes:      'Notes',
  fieldHint_rule_reading: 'Its reading, in kana — e.g. 〜のなかで (optional)',
  fieldOff_rule_reading: 'This doesn’t spell the rule: write each kanji in kana and the rest as it is.',
  fieldHint_structure:   'Formation — e.g. verb て-form + ください',
  fieldHint_explanation: 'What the rule does. **bold** to stress.',
  fieldHint_usage:       'One use per line, starting with "- "',
  fieldHint_careful:     'What it gets confused with, what to avoid',
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
  // 上下 (plan 174): the run's meter under the head, for a screen reader.
  runMeter:          (n, total) => (total == null ? `${n} rated` : `${n} of ${total}`),

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
  learningUnit:       'in progress',
  learnedLabel:       'Learned',   // a platform's figure, read out (plan 184)
  sourceTiers:        n => `${n} tiers`,
  sourceThemes:       n => `${n} themes`,
  // The vocabulary's sources on the desk (plan 183): the strip of what
  // the learner has started, over the three sources.
  sourcesInProgress:  'In progress',
  sourcesResume:      'Resume',
  unseenNote:         n => `${n} never seen`,
  tierWords:          range => `Words ${range}`,
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
  // ── 統計, the service record (plan 085) ──
  reportRetention:    'Retention',
  reportThisWeek:     'this week',
  reportWeeksAgo:     w => `${w} wk ago`,
  reportDelta:        (n, w) => `${n > 0 ? '+' : n < 0 ? '−' : '±'}${Math.abs(n)} · ${w} wk`,
  reportWeekOf:       (date, n) => `week of ${date} · ${n} ${n === 1 ? 'review' : 'reviews'}`,
  reportRungs:        ['<1 d', '1 w', '1 m', '3 m', '3 m+'],
  reportStrengthSummary: n => `${n} cards by how far ahead they sit`,
  reportMisses:       (n, d) => `${n === 1 ? 'miss' : 'misses'} · ${d} d`,
  // ── 路線別, the record's lines (plan 138) ──
  reportWeekStart:    d => `week of ${d}`,
  reportReviewsCap:   'reviews',
  reportPointOf:      (when, n) => `${when} · ${n} ${n === 1 ? 'review' : 'reviews'}`,
  reportLineReviews:  n => `${n} rev.`,
  reportToReview:     'To review',
  reportNoMiss:       'Nothing missed',
  reportLineEmpty:    'No reviews yet',
  reportCell:         (mode, deck, pct, n) => `${mode} · ${deck} · ${pct}% · ${n} ${n === 1 ? 'review' : 'reviews'}`,
  reportCellNone:     (mode, deck) => `${mode} · ${deck} · not reviewed yet`,
  reportTile:         (head, deck, mode, pct, lapses) => `${head} · ${deck} · ${mode} · ${pct}% · ${lapses} ${lapses === 1 ? 'lapse' : 'lapses'}`,
  reportEmpty:        'No reviews yet',
  reportEmptyHint:    'The first week of reviews draws the line.',
  startedNote:     n => `${n} started`,
  reportError:        'The record could not be read',
  daysUnit:           'days',
  balanceRefillLine:  (at) => `+1 at ${at}`,
  balanceRefillRate:  (min) => `+1 every ${min} min`,
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
  soundOn:            'Sound on',
  soundOff:           'Sound off',
  soundOffHint:       'Nothing plays, whatever the settings.',
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
  resultNotSaved:  "This answer could not be saved to your record and will not appear in it.",
  runStreak:       (n, best) => `${n} in a row · best ${best}`,
  accuracy:        'Accuracy',
  dueToday:        'Due today',






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
  filterHasNew:        'New words',
  stopsShown:          (n, total) => `${n} of ${total} sentences shown`,
  keepAllIPlusOne:     'Keep all i+1',
  // The smart furigana's three settings.
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
  // 机 — the analyser on three columns (plan 134).
  prevSentence:        'Previous sentence',
  nextSentence:        'Next sentence',
  replaySentence:      'Replay the sentence',
  loopSentence:        'Loop the sentence',
  pauseEachSentence:   'Pause at the end of each sentence',
  playbackRate:        r => `${r}×`,
  playbackSpeed:       r => `Speed: ${r}×`,
  showVideo:           'Show the video',
  hideVideo:           'Hide the video',
  furiganaNow:         label => `Furigana: ${label}`,
  wordsInSentence:     'The words in the sentence',
  explanationTitle:    'The sentence explained',
  showExplanation:     'Show the explanation',
  showEntry:           'Back to the entry',
  explainThisSentence: 'Explain the sentence',
  explanationOpen:     'Explanation open',
  writtenHere:         s => `here: ${s}`,
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
  // ── 帳 — the passages first (plan 136) ──
  shelfAll:            'All',
  shelfKept:           'Kept',
  passageKept:         'Kept',
  shelfFilter:         'Show',
  shelfSearch:         'Search your passages…',
  shelfEmpty:          'No passages yet: what you analyze on the right will show here.',
  shelfNoMatch:        'No passage matches.',
  shelfEmptyPhone:     'Your passages will show here: paste Japanese or a YouTube link above, or take a photo.',
  newPassage:          'New passage',
  entryPlaceholder:    'Paste Japanese or a link…',
  dropHere:            'Drop it here: subtitles or a picture',
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
  // Shown only where the server can fetch a link itself. It names the
  // subtitles rather than the mechanism -- the learner does not need to
  // know a proxy is involved, only what they get.
  analyzeThisLink:     'Get the subtitles',
  // ── The video intake as a column (plan 136) ──
  // One filled action: set up the bookmark until it has been used, then
  // open the video on YouTube, where it is tapped.
  grabInstall:         'Set up the 字幕取り bookmark',
  grabInstallSay:      'One minute, once: after that it brings the subtitles of any YouTube video here.',
  grabThenSay:         'Then tap your 字幕取り bookmark: the subtitles arrive here.',
  grabInstallLink:     'Set up the bookmark',
  chooseSubtitles:     'Choose a subtitle file',
  copyBookmarklet:     'Copy the 字幕取り bookmark',
  bookmarkletCopied:   'Copied! Now do step 2',
  downsubHint:         'Downloads a .vtt file to choose here — useful when the bookmark will not work.',
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


  // Mastery source: shown instead of a phrase when the learner doesn't
  // have enough learning/mastered vocabulary yet for a full sentence.
  notEnoughMasteryWords: 'Not enough words in learning or mastered state yet — keep studying and check back for this mode.',

  readingFetchError:    "Couldn't load a phrase. Try again.",
  writeWhatYouSaw:      'Write what you saw, in romaji',
  // The clock at the "No limit" pace (Settings › Reading pace).
  readingUntimed:       'No time limit',
  romajiPlaceholder:    'e.g. konnichiwa',
  // The play button a phrase arrives behind (ReadingPieces' PlayButton).
  readingPlay:          'Show the sentence and start the timer',
  correct:              'Correct!',
  incorrect:            'Not quite',
  correctRomaji:        'Correct romaji',
  yourAnswer:           'Your answer',
  // The practice card (plan 185): the grammar point's tag at the card's
  // top, on the answer and (translation) on the prompt; and, for a screen
  // reader, what the figure in the answer's well counts and the name of
  // the words missed under it.
  pcardPoint:           'Point',
  pcardUse:             'Use',
  pcardMatched:         'matched',
  pcardMissed:          'Words missed',
  nextPhrase:           'Next phrase',
  translation:          'Translation',
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
// loadError, retry, score, streak, translation,
// yourAnswer, gradeCorrect/gradeIncorrect, nextPhrase) — only the
// genuinely new keys live here.
const translationMode = {
  translationTitle:      'Translation',
  translationDesc:       'Put it into Japanese yourself\nA reference answer, and a read on yours\nThe hard direction, on purpose',
  translationFetchError: "Couldn't load a phrase. Try again.",
  japanesePlaceholder:   'Write it in Japanese…',
  // The tutor's review as a shape, not a paragraph (routes/translation.py).
  reviewCorrect:         'Correct',
  reviewAcceptable:      'Acceptable',
  reviewPartial:         'Partly right',
  reviewIncorrect:       'Incorrect',
  reviewGood:            'What worked',
  reviewFix:             'To fix',
  reviewGrammarUsed:     'used',
  reviewGrammarMissed:   'not used',
  analyzingTranslation:  'Analyzing your translation…',
  analysisUnavailable:   'Analysis unavailable — judge against the reference above.',
}
// ── 書取 — dictation ──────────────────────────────────────────
// DictationRun.jsx reuses the shared study/quiz keys wholesale
// (selectLevel, leaveLevels, stationJlpt, submit, retry, yourAnswer,
// translation, nextPhrase, examAudioPause/
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
// japanesePlaceholder, analysisUnavailable, nextPhrase,
// pcardPoint, glLesson, the review* keys, the breakdown and
// explain keys) — only the genuinely new keys live here.
const compositionMode = {
  compositionTitle:        'Composition',
  compositionDesc:         'Write a sentence with the point you are shown\nA tutor reads it back to you\nN5 through N1',
  compositionFetchError:   "Couldn't load a grammar point. Try again.",
  compositionPrompt:       'Write a sentence using',
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
  // How the search reads the query: how strictly, and where.
  dictMatch:         'Match',
  dictMatchOptions:  { word: 'Whole word', start: 'Starts with', any: 'Anywhere' },
  dictSearchOptions: 'Search options',
  dictField:         'Search in',
  dictFieldOptions:  { all: 'All', japanese: 'Japanese', meaning: 'Meaning' },
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
  // 発見 — a grammar point's tour (plan 187b)
  tourLookQ:         p => `What does ${p} do?`,
  tourLookHint:      n => `${n === 2 ? 'Two' : 'Three'} sentences. Look where it sits, and what the translations say.`,
  tourIdea:          'I have an idea',
  tourGuessQ:        p => `What does ${p} mean?`,
  tourCheck:         'Check',
  tourThatIs:        p => `That one is ${p}.`,
  tourNotThis:       'That is not what these sentences do.',
  tourHint:          'Look at what the translations say.',
  tourGiven:         'Here it is.',
  tourGivenNote:     'Keep it in mind: it comes back at the end.',
  tourFound:         n => (n === 0 ? 'Well spotted, first time.' : n === 1 ? 'Well spotted, on the second try.' : `Well spotted, on try ${n + 1}.`),
  tourTerminus:      'What you found',
  tourNotLike:       p => `Not ${p}`,
  tourBoard:         'Board',
  tourReadLesson:    'Read the full lesson',
  tourRight:         'Yes.',
  tourNotQuite:      'Not quite.',
  tourMe:            'You',
  tourPlayScene:     'Play the scene',
  tourYourTurn:      'Your turn',
  tourYourLine:      'Your line',
  // 梯子 — the ladder (plan 187e): its four rungs, the build and the write.
  ladRungs: ['Recognise', 'Choose', 'Build', 'Write'],
  ladAria: 'The card\'s ladder',
  bldAsk: 'Build the sentence',
  bldTray: 'The pieces',
  bldSlot: n => `Gap ${n}`,
  bldRight: 'Well built.',
  bldWrong: 'Not quite. The sentence:',
  wrtAsk: 'Say it in Japanese',
  wrtWith: 'Using',
  wrtWords: 'Words to use',
  wrtField: 'Your sentence (kana or rōmaji)',
  wrtHint: 'kana · rōmaji',
  wrtCheck: 'Check',
  wrtFound: 'The pattern is there.',
  wrtMissing: 'The pattern is not there.',
  wrtModel: 'One way to say it',
  tourRecord: (date, tries, helped) => `Found on ${date} · ${helped ? 'rule given' : tries ? `${tries} miss${tries > 1 ? 'es' : ''}` : 'first time'}`,
  tourReplay: 'Redo the tour',
  tourReplayScene: 'Replay the scene',
  tourBackToLesson: 'Back to the lesson',
  tourAria:          p => `Discover ${p}`,
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
  // 割合 (plan 177): the share of the words that use each reading.
  readingsScopeLabel:  'Scope of the count',
  readingsScopeCourse: 'Course',
  readingsScopeAll:    'JMdict',
  readingsScopeHintCourse: (n) => `Share of the course's ${n} words that use each reading.`,
  readingsScopeHintAll:    (n) => `Share of JMdict's ${n} words that use each reading.`,
  readingsTier:      { core: 'Common', usual: 'Usual', rare: 'Rare' },
  readingsOfWords:   (n, total) => `${n} of ${total.toLocaleString('en-US')} word${total > 1 ? 's' : ''}`,
  readingsExamples:  (n) => `${n} example${n > 1 ? 's' : ''}`,
  readingsWholeShare: 'Word read as a whole',
  readingsShareLoading: 'Counting…',
  readingsShareError:   'The count could not be loaded.',
  readingsCourseEmpty:  (kanji) => `No word in the JLPT course uses ${kanji}.`,
  readingsCourseEmptyBody: 'The course count is empty. The full dictionary has words with this kanji.',
  readingsCountAll:  'Count over all of JMdict',
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
  cardProgress:      'Card progress',
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
  mode_grammar_ladder:             'The ladder',
  mode_grammar_ladder_desc:        'One exercise that climbs with you: recognise, choose, build, then write.',
  mode_grammar_build:              'Build it',
  mode_grammar_build_desc:         'The sentence in pieces. Put the pattern and its word back in place.',
  mode_grammar_write:              'Write it',
  mode_grammar_write_desc:         'Something to say in Japanese with the pattern. You rate yourself.',

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
  longestStreak:     'Longest',
  perfectRun:        'Best run',
  perfectRunUnit:    'in a row',
  dayUnit:           'days',
  chaseNext:         (xp, who) => `${xp} XP behind ${who}`,
  // ── 定期入れ — the pass-holder profile ──
  retention:         'Retention',
  daysStamped:       'Stamped',
  ranking:           'Ranking',
  periodWeek:        'This week',
  periodAll:         'All time',
  east:              'East',
  west:              'West',
  passLabel:         'Commuter pass',
  passSince:         (when) => `Since ${when}`,
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
  // 定期券の裏 (plan 174): the line alone on the card's back. The drift
  // in days, signed and wordless -- the colour says the rest; the ghost
  // train is labelled "promised".
  jourDrift:         (n) => `${n > 0 ? '+' : '−'}${Math.abs(n)} day${Math.abs(n) > 1 ? 's' : ''}`,
  jourRoute:         (from, to) => `${from} → ${to}`,
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
  deckEdit:          'Edit',
  deckAddCards:      'Add cards',
  deckWriteCard:     'Write a card',
  deckAllCards:      n => `All ${n} cards`,
  deckFigs:          { due: 'Due', new: 'New', learning: 'Learning', mastered: 'Mastered' },
  deckCardState:     { due: 'Due', new: 'New', learning: 'Learning', mastered: 'Mastered' },
  deckToday:         'Today',
  deckTodayDesc:     'This deck’s cards for today, across every mode.',
  deckToStudy:       n => (n === 1 ? 'card to study today' : 'cards to study today'),
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
  importColumns:     'Columns:',
  importRepeat:      'then {cols}, as many times as you like',
  importHeaderHint:  'A first row of headers (Rule, Meaning, Example, Translation…) reads the columns in your sheet’s order. Put a cell in quotes "…" to hold a comma or a line break.',
  importExample:     'Insert an example',
  importHeaderFound: 'Headers recognised',
  importIgnoredCols: 'Ignored columns: {cols}',
  importSkipped:     '{n} skipped',
  importMissing:     'missing: {fields}',

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
  libraryPublishHint:    'Other learners can find and follow it.',
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
  examPracticeTarget:  'Target',
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
  // The study under a reviewed question (exam/ExamStudy.jsx): its
  // sentence and choices translated, and the sentence's breakdown.
  examStudyOpen:       'Translation & breakdown',
  examStudyHide:       'Hide translation',
  examStudyFailed:     'The translation is unavailable right now. Try again shortly.',
  examStudyRetry:      'Try again',
  examStudySentence:   'The sentence',
  examStudyChoices:    'The choices',
  examStudyPassage:    'The text',
  examStudyNoWord:     'not a word',

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
  brdTagline: 'A ride built around you.',
  brdBoard: 'Board',
  // 辻 (plan 163): the desk's front door, its corner and the way back to it.
  brdHaveAccountQ: 'Have an account?',
  brdNoAccountYet: 'No account yet?',
  brdBackHome: 'Back to the start',
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
  brdAccountCreate: 'Create my account',
  brdAccountSkip: 'Continue without an account',
  // 辻 (plan 163): the desk's account, beside the ticket it keeps.
  brdTicketKind: 'Ticket · Tsuji',
  brdIssued: (date) => `Issued ${date}`,
  brdCreditsOffered: 'credits, on us',
  brdPunched: 'Punched',
  brdTermService: 'Service',
  brdTermRoute: 'Ride',
  brdTermValid: 'Valid until',
  brdServiceValue: (name, n) => `${name} · ${n} a day`,
  brdTicketNote: 'Without an account, your ticket stays on this device.',
  brdDemoTag: { kanji: 'Kanji', vocab: 'Vocabulary', grammar: 'Grammar', dictation: 'Dictation', reading: 'Reading', kana: 'Kana', translation: 'Translation', analyzer: 'Analyzer', exam: 'Mock exam' },
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
  brdKanaWord: { sushi: 'sushi', hotel: 'hotel', station: 'station' },
  brdRevealQ: 'Soon you’ll read both.',
  // 辻 (plan 163): the desk's kana question and reveal, drawn as the
  // owner's D03 -- each answer says what it reads, then its name.
  brdKanaHint: 'Pick what you can already read.',
  brdKanaOnly: (jp) => `Only ${jp}`,
  brdKanaSays: { hiragana: 'The hiragana', katakana: 'The katakana', both: 'Hiragana and katakana', none: 'That’s where we start' },
  brdRevealLead: 'Two scripts of 46 signs each. Here is how these two words are read.',
  brdRevealKanji: 'Kanji',
  brdRevealLater: 'Later, one word at a time.',
  brdRevealMeans: 'means',
  brdRevealWord: (word) => `“${word}”`,
  brdRevealFirst: (date, min) => `Your first stop: **the kana**, read by **${date}** at ${min} min a day.`,
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
  // 入門 (plan 170): the lines in a beginner's words, for a learner
  // short of both scripts, and when they start.
  brdLineDescNovice: {
    vocab: 'Words',
    kanji: 'One meaning per character',
    grammar: 'How a sentence is built',
  },
  brdLinesHintNovice: 'They start after the kana.',
  brdLineDesc: {
    vocab: 'Words, N5 to N1',
    kanji: 'Readings, meanings, writing',
    grammar: 'Patterns, with examples',
  },
  // 辻 (plan 163): the desk's lines -- the kana's strip and what each
  // line carries on the ride to its goal.
  brdKanaFirst: 'hiragana and katakana, first',
  brdOnEveryTicket: 'On every ticket',
  brdLineCarries: {
    vocab: (stop) => `words to ${stop}`,
    kanji: (stop) => `kanji to ${stop}`,
    grammar: (stop) => `points to ${stop}`,
  },
  brdLinesArrive: (n, stop, date) => `${n === 1 ? 'With this line' : n === 2 ? 'With these two lines' : 'With these three lines'}, you reach ${stop} by **${date}**.`,
  brdRhythmQ: 'What’s your rhythm?',
  // 辻 (plan 163): the desk's four roads -- a rhythm's minutes and its
  // service, and the days its ride takes.
  brdRhythmHint: 'The more you ride each day, the sooner you arrive. You can change it later.',
  brdADay: 'a day',
  brdRhythmName: { 5: 'Local', 10: 'Rapid', 15: 'Special rapid', 20: 'Express' },
  brdRideDays: (n) => (n === 1 ? '1 day' : `${n} days`),
  brdMinADay: 'min a day',
  brdNewItems: (n) => `~${n} new items`,
  brdChangeLater: 'You can change it later.',
  brdTimeQ: 'When do you study?',
  brdDeparture: 'Departure',
  brdDayAria: 'Departure time',
  // 辻 (plan 163): the desk's hour, the day as the sun's arc.
  brdTimeHint: 'Your train leaves at this hour every day.',
  brdYourTrain: 'Your train',
  brdThenDaily: 'then every day',
  brdTimeFine: 'or slide the train along the day, by the half hour',
  // The nudge (native only), and the notification as the app sends it.
  // brdAppName is the store name, the one the notification header
  // shows; keep it in step with capacitor.config.json's appName.
  brdNudgeQ: (time) => `A nudge at **${time}**?`,
  brdAppName: 'Tsuji',
  brdNotifNow: 'now',
  brdNotifTitle: (time) => `Your train leaves at ${time}`,
  brdNotifText: 'Your cards are waiting at the gate.',
  brdNudgeHint: 'One a day, at your time. Never more.',
  brdAllow: 'Remind me',
  brdNotNow: 'Not now',
  // ── 発車案内 — the daily nudge from the day's queue, the widget and
  // Settings › Notifications (plan 156). The nudge's title and body are
  // written from what the gate will hold at the learner's hour.
  nudgeTitle: (time, n) => `Your ${time} train · ${n} ${n === 1 ? 'card' : 'cards'}`,
  nudgeMinutes: (m) => (m <= 1 ? 'About a minute' : `About ${m} min`),
  nudgeNew: (n) => `${n} new`,
  nudgeLine: { kana: 'Kana', vocab: 'Vocabulary', kanji: 'Kanji', grammar: 'Grammar' },
  nudgeWhen: { today: 'Today', tomorrow: 'Tomorrow' },
  widgetTitle: 'Today’s train',
  widgetUnit: (n) => (n === 1 ? 'card' : 'cards'),
  widgetMinutes: (m) => `${m} min`,
  widgetClear: 'Line clear',
  settingsNotif: 'Notifications',
  notifOff: 'Off',
  notifDaily: 'The daily train',
  notifDailyCap: 'One a day',
  notifRemind: 'Remind me',
  notifOnOff: { on: 'On', off: 'Off' },
  notifRule: 'Only on a day with cards due, and never once you’ve ridden.',
  notifNoHour: 'Choose a departure hour to be reminded.',
  notifDenied: 'Notifications are off for Tsuji in your phone’s settings.',
  notifQuiet: 'Nothing due at your hour this week, so no train to announce.',
  notifNextAria: 'The next reminder',
  notifFailed: 'The next reminder could not be worked out.',
  notifWidget: 'The widget',
  notifWidgetCap: { ios: 'Lock screen', android: 'Home screen' },
  notifWidgetHow: {
    ios: 'Touch and hold the lock screen, tap Customize, then add Tsuji.',
    android: 'Touch and hold your home screen, tap Widgets, then drag Tsuji onto it.',
  },
  notifWidgetWhat: 'It shows the day’s cards and a word you know, never one due this week.',
  // 時間割 (plan 181): the week's agenda.
  settingsAgenda: 'Agenda',
  agdRowEmpty: 'No blocks',
  agdRowValue: (n) => `${n} ${n === 1 ? 'block' : 'blocks'}`,
  agdEveryDay: 'Every day',
  agdWeek: 'My week',
  agdWeekAria: 'Your week, day by day',
  agdEmpty: 'Plan your week: a block for each subject, and Tsuji tells you when it starts.',
  agdAdd: 'Add a block',
  agdNew: 'New block',
  agdEdit: 'Edit block',
  agdNow: 'Now',
  agdSubject: 'Subject',
  agdDays: 'Days',
  agdFrom: 'From',
  agdTo: 'To',
  agdPresets: { weekdays: 'Weekdays', weekend: 'Weekend', all: 'Every day' },
  agdRemind: 'Reminder',
  agdLeadLabel: 'Tell me',
  agdLead: (m) => (m === 0 ? 'On time' : `${m} min before`),
  agdBell: (m) => (m === 0 ? 'On time' : `${m} min before`),
  agdNoBell: 'No reminder',
  agdSave: 'Save',
  agdDelete: 'Delete',
  agdProblem: {
    days: 'Choose at least one day.',
    time: 'Choose a start and an end.',
    length: 'A block lasts 15 minutes at least.',
  },
  agdClash: (name, days, from, to) => `This block overlaps ${name} (${days}, ${from}–${to}).`,
  agdSaveFailed: 'The block could not be saved. Try again.',
  agdLoadFailed: 'Your agenda could not be loaded.',
  agdWebNote: 'Reminders come on the mobile app: on the web, the agenda is a guide.',
  agdDenied: 'Notifications are off for Tsuji in your phone’s settings, so blocks won’t announce anything.',
  agdBlockAria: (name, day, from, to) => `${name}, ${day} from ${from} to ${to}`,
  agdNotifTitle: (name, lead) => (lead === 0 ? `${name} starts now` : `${name} in ${lead} min`),
  agdNotifBody: (from, to, lead) => (lead === 0 ? `${from}–${to}` : `At ${from}, until ${to}`),
  agdSubjectName: {
    review: 'Reviews', kana: 'Kana', vocab: 'Vocabulary', kanji: 'Kanji', grammar: 'Grammar',
    reading: 'Reading', translation: 'Translation', dictation: 'Dictation', composition: 'Writing',
    comprehension: 'Comprehension', exam: 'Mock exam',
  },
  agdGo: 'Start',
  agdUntil: (end) => `until ${end}`,
  agdDayEmpty: (day) => `Nothing planned on ${day}.`,
  agdAddOn: (day) => `Add on ${day}`,
  agdDuration: (h, m) => (h && m ? `${h} h ${m} min` : h ? `${h} h` : `${m} min`),
  agdLasts: (d) => `Lasts ${d}`,
  agdLeadCaption: 'minutes before it starts',
  agdDayAria: (day, n) => `${day}, ${n} ${n === 1 ? 'block' : 'blocks'}`,
  agdHoursAria: 'Hours of the day',
  agdProgressAria: (name) => `${name}, time gone`,
  agdThen: 'Then',
  agdStartWith: 'To start with',
  agdWeekTotalLabel: 'Each week',
  // The arrival: the plan, the pass.
  brdBuildingAria: 'Building your journey',
  // 机 (plan 140): the stops on the desk's column, one per question --
  // the part of the boarding each answers, as the line prints it.
  brdStop: { name: 'Name', why: 'Why', kana: 'Kana', level: 'Level', goal: 'Goal', lines: 'Lines', rhythm: 'Rhythm', time: 'Departure', nudge: 'Reminder' },
  brdArrivalTitle: 'Your plan',
  brdPlanQ: (name) => `Your plan is ready, **${name}**.`,
  brdFor: { studies: 'for your studies', fun: 'for the fun of it', trip: 'for your trip', live: 'for your life in Japan', friends: 'for your friends', other: 'for yourself' },
  // One figure per line on the ticket.
  brdFigWords: (n) => `~${n} words`,
  brdFigKanji: (n) => `~${n} kanji`,
  brdFigGrammar: (n) => `~${n} grammar points`,
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
  brdOnTrackKana: 'On track for the kana',
  brdPassQ: (name) => `Your pass is ready, **${name}**.`,
  brdEnjoy: 'Enjoy the ride.',
  brdCreditsGift: (n) => `+${n} credits, on the house`,
  brdEnter: 'Enter the station',
  // 辻 (plan 163): the desk's plan, the ride drawn to scale -- its stops'
  // days and names, what the terminus holds, what the ride is for.
  brdInDays: (n) => (n === 1 ? 'tomorrow' : `in ${n} days`),
  brdEvery: { am: 'every morning', noon: 'every noon', pm: 'every evening' },
  brdAtTime: (every, time) => `${every} at ${time}`,
  brdKanaDone: 'Kana read',
  brdBothScripts: 'hiragana and katakana',
  brdTerminus: (stop) => `Terminus · ${stop}`,
  brdAtTerminus: 'At the terminus, you’ll know',
  brdUnit: { vocab: 'words', kanji: 'kanji', grammar: 'grammar points' },
  brdUnitKana: 'signs',
  // 辻 on a phone (plan 168): the kana over the lines' hub, the board's
  // arrival column and first stop, the hour's arrows and first train, the
  // plan's arrival and what the ride is for.
  brdKanaFirstShort: 'Kana first',
  brdArriveAt: (stop) => `Arrival at ${stop}`,
  brdFirstStop: (date) => `First stop: the kana, read by **${date}**`,
  brdHourLater: 'An hour later',
  brdHourEarlier: 'An hour earlier',
  brdHalfLater: 'Half an hour later',
  brdHalfEarlier: 'Half an hour earlier',
  brdTrainAt: (today, time) => `Your train · ${today ? 'today' : 'tomorrow'}, **${time}**, then every day`,
  brdArriveIn: (days, every, time) => `${days === 1 ? '**tomorrow**' : `in **${days} days**`}, ${every} at ${time}`,
  brdForLine: (purpose, promise) => `${purpose.charAt(0).toUpperCase()}${purpose.slice(1)}: **${promise.charAt(0).toLowerCase()}${promise.slice(1)}**.`,
}

const ride = {
  // 試乗 — the test ride (plan 098): the first two cards, on the real
  // stage. One sentence per step, beside the thing it is about; the
  // pair names the place (the stage head), the notes do not repeat it.
  rideDocumentTitle: 'Test ride',
  rideJp: '試乗',
  rideCap: 'Test ride',
  rideSkip: 'Skip',
  rideKnownFront: 'Here’s your first card. Tap it to flip it over.',
  rideKnownBack: 'Did you know it? Be honest: you grade yourself.',
  rideUnknownFront: 'This one’s new to you. Flip it over.',
  rideUnknownBack: 'Choose Wrong. It’s not a failure: the card just comes back sooner. That’s the whole trick.',
  // 机 (plan 115): the same notes, teaching the desk's keys.
  rideKnownFrontDesk: 'Here’s your first card. Click it or press Space to flip it over.',
  rideKnownBackDesk: 'Did you know it? Be honest: you grade yourself, on the bar or with the number keys.',
  rideUnknownFrontDesk: 'This one’s new to you. Flip it over: click or Space.',
  rideUnknownBackDesk: 'Choose Wrong, on the bar or with its key. It’s not a failure: the card just comes back sooner. That’s the whole trick.',
  rideGuessed: 'Got the new one right? If it was a guess, choose Wrong next time, or it won’t come back for days.',
  rideDoneBody: n => `That’s it! **${n} new words a day**, each one back right before you’d forget it.`,
  rideContinue: 'Continue',
  // The reading ride (plan 099): the sentence, the field, the measure,
  // then the plate that says which platforms ride on the pass.
  rideReadFront: 'Read it quick! It disappears in a moment.',
  rideReadFrontUntimed: 'Read it, then type it out in romaji or kana.',
  rideReadType: 'Type what you read, in romaji or kana.',
  rideReadMeasure: 'The score shows how much you caught. Now grade yourself.',
  rideReadMeasureDesk: 'The score shows how much you caught. Now grade yourself: on the bar, or with the number keys.',
  // Plan 133. On a phone: the known card is not graded until its entry
  // has been opened from the 🔍 and closed again.
  rideKnownDict: 'Every card has a dictionary entry. Tap 🔍 to open this one, then close it.',
  ridePlateCap: 'The pass',
  ridePlateBody: 'These practice modes come with the pass.',
  ridePlateOpen: 'For now, they’re free for everyone.',
}

const guide = {
  // 案内 — the guide over each gate (plan 100): one sentence a stop,
  // beside the thing it is about. The note carried a Japanese eyebrow
  // naming the stop until 2026-09-21; the sentence is the note now.
  guideLabel: 'Guide',
  guideNext: 'Next',
  guideDone: 'Done',
  guideSkip: 'Skip',
  // The desk rail's Help: the lit gate's guide, played again on demand.
  guideHelp: 'Help',
  guideHelpTour: gate => `Guided tour: ${gate}`,
  guideTodayGate: 'Today’s reviews, line by line. Switch one off to save it for later, then hit Depart.',
  guideTabBar: 'Your five tabs: Learn, Practice, Today, Dictionary and your profile.',
  guideLearnPlate: 'A line. Tap it to open it. The badge shows what’s due today.',
  guideLearnStops: 'Where you are on the line, and the stops around you.',
  guideLearnShelf: 'Your own decks, plus a library of decks shared by other learners.',
  guidePracticePlate: 'A practice mode: read, understand, translate, listen to or write real sentences.',
  guidePracticeDests: 'The levels. Yours is marked. Tap another to try it anyway.',
  guidePracticePass: 'These modes come with the pass.',
  guideDictConsole: 'Search by word, reading or meaning.',
  guideDictOptions: 'Fine-tune your search: exact word, starts with or contains. Search the Japanese, the meaning or both.',
  guideDictChips: 'Browse by collection. Your saved entries are at the end.',
  guideDictEntry: 'Tap an entry to open it. Its ＋ saves it or adds it to one of your decks.',
  guideDictAnalyzer: 'The analyzer: paste, snap or film any Japanese and see it broken down.',
  guideProfilePass: 'Your pass: your name, your level and your balance.',
  guideProfileStamps: 'Your stamp card: one stamp for every day you study.',
  guideProfileRecords: 'Your numbers: total reviews, what you remember, your best perfect run.',
  guideProfileLedger: 'Each line, and how far you’ve come.',
  guideProfileSettings: 'Settings: your level, your pace, how you grade, and this guide anytime.',
  guideLearnLibrary: 'The library: decks shared by other learners. Open one to preview it; follow it to study it.',
  guidePracticeExam: 'The mock exam: a JLPT-style test at the level you pick, graded when you hand it in.',
  guideDictActions: 'Listen to it, or use ＋ to save it or add it to one of your decks.',
  guideProfileStats: 'Statistics: what sticks and what slips, line by line.',
  guideProfileBoard: 'The leaderboard, in XP: this week and all time.',
  // 机 (plan 115): the notes that teach the desk's keys and doors.
  guideTabBarDesk: 'Your five sections, down the left. Press / anywhere to search the dictionary.',
  guideTodayGateDesk: 'Today’s reviews, line by line. Switch one off to save it for later, then depart. Enter works from anywhere here.',
  guideLearnStopsDesk: 'The whole line. Click any stop to study it.',
  // Worded for a pointer (plan 123): the notes that said "tap".
  guideLearnPlateDesk: 'A line. Click it to open it. The badge shows what’s due today.',
  // The desk's platforms carry no grades since plan 165: the stop is
  // skipped there, but its note is still worded for a pointer.
  guidePracticeDestsDesk: 'The levels. Yours is marked. Click another to try it anyway.',
  guidePracticePlateDesk: 'A practice mode, and what it asks of you at your level. Click it to open it.',
  guideDictEntryDesk: 'An entry, open beside the list. ← and → move through the list.',
  // Settings, the two ways back.
  settingsFirstRide: 'First ride',
  settingsRideAgain: 'Take the test ride again',
  settingsIntroAgain: 'See the introduction again',
  settingsGuideAgain: 'Show the guide again',
  settingsGuideAgainDone: 'It’ll show again the next time you open each section.',
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
  // ── A practice station, on the desk (plan 159) ────────────────
  // The source as a switch at the list's head (the JLPT grades, word
  // frequency, your own cards), then the open stop's page: what the
  // exercise asks, its shape, four figures, your latest misses and the
  // grade's points.
  practiceSourceFrequency: 'Frequency',
  practiceHow: {
    reading: 'Read the sentence before the clock covers it, then write its reading in rōmaji.',
    translation: 'A sentence to say in Japanese, then a reference answer and the tutor’s view of yours.',
    comprehension: 'A short text, then its questions — the exam’s reading section, rehearsed.',
    dictation: 'Two listens, no more: write in rōmaji what you hear.',
    composition: 'You are given a grammar point: write a sentence that uses it, and a tutor reads it.',
    // On the platform's plate, on the desk (plan 165): the question its
    // well shows.
    exam: 'A question in the JLPT’s format, here 漢字読み: the reading of the underlined word.',
  },
  practiceBank: {
    sentences: n => `${n} sentences written for the grade.`,
    texts: n => `${n} questions a text.`,
    clips: n => `${n} sentences recorded for the grade.`,
    points: n => `${n} points to use.`,
  },
  practiceSpecTag: {
    sentence: 'A sentence of the grade',
    text: 'A text of the grade',
    clip: 'A sentence of the grade, by ear',
    point: 'A point of the grade',
    tier: 'Words of the tier',
    mine: 'Your words',
  },
  practiceFig: {
    sentences: 'Sentences',
    texts: 'Texts',
    right: 'Right',
    questions: 'Questions right',
    words: 'Words of the grade',
    tierWords: 'Words of the tier met',
    met: 'Words met',
    last: 'Last ride',
  },
  practiceMisses: 'Your missed sentences',
  practiceMissedPoints: 'Your missed points',
  practiceTexts: 'Your texts',
  practiceNoMisses: 'No missed sentence yet.',
  practiceNoTexts: 'No text read yet.',
  practicePoints: 'The grade’s points',
  practiceTextPoints: 'The texts’ points',
  practicePointsStudied: (n, of) => `${n} / ${of} studied`,
  practicePointStudied: 'studied',
  practiceTierTitle: (tier, from, to) => `Tier ${tier} · words ${from} to ${to}`,
  practiceTierDesc: list => `Sentences around this tier’s words (${list}), ranked by how often they are written.`,
  practiceTierWords: 'The tier’s words',
  practiceTierSeen: (n, of) => `${n} / ${of} met`,
  practiceMineDesc: 'Sentences in which every word is one you have already met.',
  practiceMineNote: 'Only words you have already seen',
  // The mock exam on the desk: each paper a row (plan 159).
  examGradeDesc: 'Four papers in the JLPT format, timed and scored — unofficial scoring.',
  examNext: label => `Next · ${label}`,
  examLastScore: 'Your last score',
  // ── 模試 on a phone (plan 171) ──
  examGrade:           'Grade',
  examNextPaper:       'Next paper',
  examThisPaper:       'This paper',
  examToWrite:         'To be written',
  examMinutesShort: n => `${n} min`,
  examStart:           'Start',
  examPapers:          'Papers',
  examMinutesUnit:     'minutes',
  examPartsUnit: n => (n > 1 ? 'parts' : 'part'),
  examCoverClock:      'The clock starts when you do.',
  examCoverBlank:      'A question left blank counts as wrong: flag the ones you want to come back to.',
  examSheetShort:      'Sheet',
  examPrevious:        'Previous',
  examNextQuestion:    'Next',
  examFinishPaper:     'Finish the paper',
  examAnsweredOf: (n, total) => `${n} / ${total} answered`,
  examBlanks: n => `${n} blank`,
  examAudioReplayShort: 'Replay',
  examUnofficial:      'unofficial',
  examTimeOf: (time, limit) => `${time} of ${limit}`,
  examScoreAgainst: (pct, target) => `${pct}% against a target of ${target}%`,
  examByPart:          'Part by part',
  examSeeAll:          'See all',
  examMissesOnly:      'Mistakes only',
  examTimeLabel:       'Time',
  examMisses: n => `${n} ${n > 1 ? 'mistakes' : 'mistake'}`,
  examMondai: {
    '漢字読み': 'Reading the kanji',
    '表記': 'Writing in kanji',
    '語形成': 'Word formation',
    '文脈規定': 'The word in context',
    '言い換え類義': 'Paraphrase',
    '用法': 'Using the word',
    '文の文法1': 'Sentence grammar',
    '文の文法2': 'Put the sentence in order',
    '文章の文法': 'Text grammar',
    '内容理解（短文）': 'Short texts',
    '内容理解（中文）': 'Mid-length texts',
    '内容理解（長文）': 'A long text',
    '統合理解': 'Texts to compare',
    '主張理解（長文）': 'An opinion piece',
    '情報検索': 'Finding information',
    '課題理解': 'Understanding the task',
    'ポイント理解': 'Catching the point',
    '概要理解': 'Getting the gist',
    '発話表現': 'What to say',
    '即時応答': 'Quick response',
  },
  // What a part asks you to do, in plain words, in place of its Japanese instruction (plan 171).
  examMondaiHow: {
    '漢字読み': 'Choose how the underlined word is read.',
    '表記': 'Choose how the underlined word is written in kanji.',
    '語形成': 'Choose what completes the word.',
    '文脈規定': 'Choose the word that fits the blank.',
    '言い換え類義': 'Choose the sentence closest in meaning.',
    '用法': 'Choose the sentence that uses the word correctly.',
    '文の文法1': 'Choose what fits the blank.',
    '文の文法2': 'Put the pieces in order and choose the one that goes in ★.',
    '文章の文法': 'Read the text and choose what fits each blank.',
    '内容理解（短文）': 'Read the text and answer the question.',
    '内容理解（中文）': 'Read the text and answer the question.',
    '内容理解（長文）': 'Read the text and answer the question.',
    '統合理解': 'Read both texts and answer the question.',
    '主張理解（長文）': 'Read the text and answer the question.',
    '情報検索': 'Find what the question asks for in the document.',
    '課題理解': 'Listen, then choose what the person has to do.',
    'ポイント理解': 'Read the question, listen, then choose the answer.',
    '概要理解': 'Listen, then choose what the speaker means.',
    '発話表現': 'Look at the situation and choose what to say.',
    '即時応答': 'Listen to the line and choose the best reply.',
  },
  examMinutes: n => `≈\u00a0${n}\u00a0min`,
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
  // The pass's contract and the rows under it (plan 140).
  passFieldHour: 'Daily ride',
  passFieldLines: 'Lines',
  settingsRatingShort: 'Rating',
  // ── The reading pace ────────────────────────────────────────
  // How long Reading leaves a sentence up and Comprehension a text:
  // for a slow reader, a dyslexic one, anyone the clock gets in the
  // way of rather than helps.
  settingsReadingPace: 'Reading pace',
  settingsReadingPaceHint: 'How long a sentence in Reading and a text in Comprehension stay up before they hide. Take more time if you read slowly or have dyslexia.',
  readingPaceOption: { standard: 'Standard', relaxed: 'Relaxed', slow: 'Slow', untimed: 'No limit' },
  // The chip at the clock's end, in Reading and Comprehension: each
  // press moves to the next pace.
  readingPaceShort: { standard: '×1', relaxed: '×1.5', slow: '×2', untimed: '∞' },
  readingPaceChip: name => `Reading pace: ${name}. Press to change`,
  readingPaceDesc: {
    standard: 'The usual time',
    relaxed: 'Half as long again',
    slow: 'Twice as long',
    untimed: 'Nothing hides before you answer',
  },
  settingsHelp: 'Help',
  settingsHelpValue: 'Ride · Guide',
  settingsCreditsCount: n => `${n} sources`,
  settingsPaceMinutes: m => `≈ ${m} min`,
  settingsYourPace: 'Your pace',
  settingsYourPaceSub: n => `${n} / day · last 14 days`,
  settingsInsteadOf: d => `instead of ${d}`,
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

const nyumon = {
  // 入門 — the introduction (plan 170): six screens before the first
  // card, for a learner who answered "Not yet" to the kana question. The
  // map of the language, not its knowledge: nothing here is memorised.
  nyuDocumentTitle: 'Introduction',
  nyuSkip: 'Skip introduction',
  nyuStop: { scripts: 'Scripts', sounds: 'Sounds', table: 'Table', katakana: 'Katakana', sentence: 'Sentence', route: 'Route' },
  nyuStripAria: 'The 6 screens of the introduction',
  nyuQuote: s => `“${s}”`,
  nyuTranslation: '“I drink a coffee at the station.”',
  // 1 · Scripts
  nyuScriptsQ: 'Japanese mixes 3\u00a0scripts.',
  nyuScriptsHint: 'Tap one to see it in the sentence.',
  nyuScript: {
    hira: { name: 'Hiragana', desc: 'The little words and the endings' },
    kata: { name: 'Katakana', desc: 'Words from abroad' },
    kanji: { name: 'Kanji', desc: 'A meaning per sign, for later' },
  },
  nyuScriptsLit: (name, signs) => `${name}: ${signs}`,
  // 2 · Sounds
  nyuSoundsQ: 'It all starts with 5\u00a0vowels.',
  nyuSoundsHint: 'Tap a sign to hear it.',
  // A vowel's sound, where writing it in letters would mislead.
  nyuSoundsLike: { a: 'ah', i: 'ee', u: 'oo', e: 'eh', o: 'oh' },
  nyuSoundsFoot: 'They always sound the same.',
  nyuVowelsAria: 'The 5 vowels',
  // 3 · Table
  nyuTableQ: '46\u00a0signs, 10\u00a0rows of\u00a05.',
  nyuTableHint: 'Where is “ke”? Cross row k and column e.',
  nyuTableFound: '**k + e = ke.** You just read a sign nobody showed you.',
  nyuTableAria: 'The table of the 46 signs',
  // 4 · Katakana
  nyuPairsQ: 'The same sounds, 2\u00a0ways to write them.',
  nyuPairsLead: 'Katakana writes words from abroad. You already know some:',
  nyuHearWord: 'Hear the word',
  nyuWords: { hotel: 'hotel', coffee: 'coffee', tv: 'TV' },
  // 5 · Sentence
  nyuSentenceQ: 'The verb comes last.',
  nyuSentenceHint: 'No “I”, no “a” or “the”, no plural.',
  nyuGhost: '(I)',
  nyuMeans: { station: 'station', coffee: 'coffee', drink: 'drink' },
  nyuRoles: { where: 'where', what: 'what' },
  nyuVerb: 'verb',
  nyuSwap: 'Swap station and coffee',
  nyuSwapped: '**Same meaning:** the tag carries the role, not the place.',
  // 6 · Route
  nyuRouteQ: date => `By ${date}, you’ll read these signs.`,
  nyuRouteQSoon: 'Soon, you’ll read these signs.',
  nyuRouteStops: { start: 'Start', kana: 'The kana', n5: 'N5' },
  nyuRouteDay: n => `Every day: **${n}\u00a0new items** and your reviews.`,
  nyuTryCard: 'Try a card',
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
  ...nyumon,
  ...guide,
}