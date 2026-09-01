// ── App / Auth ────────────────────────────────────────────
const auth = {
  appTitle:          '日本語',
  learnJapanese:     'Apprendre le japonais',
  appDesc:           'Répétition espacée (SM-2) · Hiragana · Katakana · Vocabulaire JLPT',
  login:             'Connexion',
  signup:            "S'inscrire",
  email:             'Email',
  password:          'Mot de passe',
  loginBtn:          'Se connecter',
  signupBtn:         "S'inscrire",
  signupSuccess:     'Vérifiez vos emails pour confirmer votre compte.',
  signOut:           'Déconnexion',
  usernameOptional:  "Nom d'utilisateur (optionnel)",
  usernameInvalid:   "Le nom d'utilisateur doit contenir 3 à 20 caractères (lettres, chiffres, underscore).",
  usernameTaken:     'Ce nom d\'utilisateur est déjà pris.',
}

// ── Landing screen ────────────────────────────────────────
// Shown to signed-out visitors before AuthScreen. landingCta is
// reused for both the hero button and the closing footer button
// rather than duplicated under a second key.
const landing = {
  landingSignIn:         'Se connecter',
  landingTagline:        'Une trousse complète et à votre rythme pour apprendre le japonais — répétition espacée (SM-2), du kana au kanji, la grammaire, et une vraie pratique de lecture, tout en un seul endroit.',
  landingCta:            'Commencer',
  landingFeaturesTitle:  'Tout au même endroit',
  landingFeaturesIntro:  'Kana, vocabulaire, kanji, grammaire, lecture, et plus encore — une seule application au lieu de cinq outils séparés.',
  landingWhyTitle:       'Pourquoi ça marche',
  landingPro1Title:      'Un parcours, pas un tas',
  landingPro1Desc:       'Kana, vocabulaire, kanji, grammaire et lecture sont chacun organisés de N5 à N1, pour toujours savoir ce qui vient ensuite.',
  landingPro2Title:      'Répétition espacée (SM-2)',
  landingPro2Desc:       "Chaque carte est planifiée avec l'algorithme SM-2, pour réviser juste avant de l'oublier, pas selon un calendrier fixe.",
  landingPro3Title:      'Séries et statistiques',
  landingPro3Desc:       'Une série quotidienne et une page de statistiques complète — nouveau, en cours, maîtrisé, à réviser maintenant, et vos points faibles — montrent exactement où vous en êtes.',
  landingPro4Title:      'Une lecture que vous pouvez vraiment faire',
  landingPro4Desc:       "Un dictionnaire et un analyseur de phrases se trouvent juste à côté des exercices de lecture et de compréhension, pour que rien de ce que vous ne comprenez pas ne soit une impasse.",
  landingPro5Title:      'Vos propres decks, aussi',
  landingPro5Desc:       'Créez vos propres decks de flashcards, de vocabulaire ou de kanji, importez des cartes directement depuis une feuille de calcul, et mélangez-les avec le contenu JLPT intégré.',
  landingTechTitle:      'Construit avec',
  landingCreatorTitle:   'Qui a fait ça, et pourquoi',
  landingCreatorBody:    "Cette application a commencé comme un outil personnel pour passer de zéro japonais à la lecture de vrais textes, sans jongler entre cinq applications différentes pour le kana, le vocabulaire, le kanji, la grammaire et la lecture. Elle est développée et maintenue par un développeur solo, et chaque fonctionnalité ici est utilisée quotidiennement en apprenant le japonais.",
  landingCreatorName:    '— Développée et maintenue en solo.',
  landingFooterCta:      'Prêt à commencer ?',
}

// ── Navigation ────────────────────────────────────────────
// Ces valeurs portaient autrefois leur propre glyphe intégré à la
// chaîne (ex : save: '✓ Enregistrer') — le glyphe est maintenant une
// vraie <Icon/> rendue par le bouton qui affiche le texte, pas du
// texte, donc chaque langue obtient la même icône plutôt qu'un
// caractère dépendant de la police.
const nav = {
  menu:              'Menu',
  back:              'Retour',
  skipToContent:     'Aller au contenu',
  cancel:            'Annuler',
  save:              'Enregistrer',
  delete:            'Supprimer',
  edit:              'Modifier',
  close:             'Fermer',
  loading:           'Chargement...',
  import:            'Importer',
  export:            'Exporter',
  exportFailed:      "L'export a échoué",
  select:            'Sélectionner',
}

// ── Home screen ───────────────────────────────────────────
const home = {
  // ── 日本語駅 — la gare ────────────────────────────────────
  // L'accueil est le hall de la gare et chaque section une ligne sur
  // son plan mural (voir config/stations.js et WallMap.jsx). Les noms
  // de stations et de lignes sont des noms propres japonais et vivent
  // dans cette config, pas ici — voici les libellés qui se traduisent
  // vraiment. `routeMap` (la légende du bandeau) existe déjà plus
  // bas, partagée avec le schéma de ligne de l'analyseur.
  platforms:   'Quais',
  // Les deux légendes de groupe du plan mural : les lignes de
  // pratique, et les services qu'on utilise sans les « prendre ».
  mapPractice:   'Pratique',
  mapFacilities: 'Services',
  // L'action pleine du portillon, et son dépliant mobile.
  depart:      'Embarquer',
  breakdown:   'Détail',
  // Texte au survol d'un badge 種別. Volontairement pas
  // « Omnibus »/« Rapide » : c'est le mot ferroviaire pour les pastilles,
  // et le répéter n'explique rien à qui choisit un mode d'étude.
  // Chaque ligne dit ce que le palier demande vraiment.
  serviceLabel: {
    local:   'Toutes gares — la réponse est à l\'écran',
    rapid:   'Un appui en moins',
    express: 'De mémoire, auto-évalué',
    ltd:     'Écrit à la main, sans aide',
    review:  'Parcours libre, sans note',
  },
  tip:               'Des sessions courtes (15-20 min) mais régulières — la SRS gère tout automatiquement.',
  homeFeedDown:      'Les données du jour n’ont pas pu être chargées — appuyez pour réessayer.',
  start:             'Commencer',
  homeTitle:         'Accueil',
  homeDesc:          'Retour au menu principal',
  kanaTitle:         'Kana',
  kanaDesc:          'Hiragana et katakana, son par son\nReconnaître d\'abord, écrire à la main ensuite\nLe sol sur lequel tout le reste repose',
  vocabTitle:        'Vocabulaire JLPT',
  vocabDesc:         'N5 → N1\nKanji + Kana → Sens\nProgression par phases',
  kanjiTitle:        'Kanji',
  kanjiDesc:         'Apprentissage des kanji\nN5 → N1\nExercices d\'écriture',
  dictionaryTitle:   'Dictionnaire',
  dictionaryDesc:    'Un kanji, un kana, n\'importe quel mot\nLectures, radicaux, ordre des traits, exemples\nEt si vous l\'avez déjà croisé',
  grammarTitle:      'Grammaire',
  grammarDesc:       'Tous les points JLPT, de N5 à N1\nCe à quoi il s\'accroche et ce qu\'il fait\nAvec des phrases qui l\'emploient vraiment',
  statsTitle:        'Statistiques',
  statsDesc:         'Tout ce que vous avez fait, compté\nOù vous êtes solide, et où vous ne l\'êtes pas\nEt ce qui tombe ensuite',
  decksTitle:        'Mes Decks',
  decksDesc:         'Vos propres cartes, planifiées comme le reste\nÉcrivez-les ici ou importez un tableur\nMêlées au contenu intégré',
}

// ── Quiz shared ───────────────────────────────────────────
const quiz = {
  // Kana sets
  hiraganaBase:         'Hiragana (de base)',
  hiraganaCombinations: 'Hiragana (combinaisons)',
  katakanaBase:         'Katakana (de base)',
  katakanaCombinations: 'Katakana (combinaisons)',

  // Selection prompts
  selectLevel:       'Choisissez un niveau JLPT',
  selectMode:        "Choisissez un mode d'entraînement",
  selectKanaSet:     'Choisissez un ensemble de kana',
  selectPhase:       "Choisissez votre phase d'entraînement",

  byLevel:           'JLPT',
  byLevelDesc:       'Les cinq grades de l\'examen, de N5 à N1',
  byFrequency:       'Fréquence des mots',
  byFrequencyDesc:   'Classés selon leur fréquence réelle à l\'écrit',
  byMastery:         'Mes cartes',
  byMasteryDesc:     'Bâties uniquement sur des mots déjà rencontrés',
  byJmdict:          'Hors-JLPT',
  byJmdictDesc:      'Tout ce qui dépasse le programme, du plus courant au moins',
  selectStudySource: "Choisissez votre source d'étude",
  selectTier:        'Choisissez un palier de fréquence',
  kanjiUnit:         'kanji',
  loadError:         'Erreur lors du chargement des paliers. Réessayez.',
  tierSizeLabel:     'Taille du palier',

  byTheme:           'Par thème',
  byThemeDesc:       'Regroupés par sujet — nourriture, travail, voyage, le corps',
  selectTheme:       'Choisissez un thème',
  filterThemes:      'Filtrer les thèmes…',
  themeNoResults:    'Aucun thème ne correspond à votre filtre',

  themeFruits:           'Fruits',
  themeVegetables:       'Légumes',
  themeBodyParts:        'Parties du corps',
  themeRooms:            'Pièces',
  themeBuildings:        'Bâtiments',
  themeFurniture:        'Meubles',
  themeSchool:           'École',
  themeTravel:           'Voyage',
  themeJobs:             'Métiers',
  themeDishes:           'Plats',
  themeAnimals:          'Animaux',
  themeColors:           'Couleurs',
  themeClothing:         'Vêtements',
  themeWeather:          'Météo',
  themeFamily:           'Famille',
  themeEmotions:         'Émotions',
  themeNature:           'Nature',
  themeVehicles:         'Véhicules',
  themeTechnology:       'Technologie',
  themeSports:           'Sports',
  themeMusic:            'Musique',
  themeKitchenItems:     'Ustensiles de cuisine',
  themeOfficeSupplies:   'Fournitures de bureau',
  themeShoppingMoney:    'Achats & argent',
  themeGeography:        'Géographie',
  themeInsectsBugs:      'Insectes',
  themeBirds:            'Oiseaux',
  themeSeafood:          'Fruits de mer',
  themeDrinks:           'Boissons',
  themeShapes:           'Formes',
  themeMaterials:        'Matériaux',
  themeTools:            'Outils',
  themeMedical:          'Médical',
  themePlantsTrees:      'Plantes & arbres',
  themeHouseholdItems:   'Objets du foyer',
  themeHolidaysEvents:   'Fêtes & événements',

  levelHintN5:       'Niveau débutant',
  levelHintN4:       'Niveau élémentaire',
  levelHintN3:       'Niveau intermédiaire',
  levelHintN2:       'Niveau avancé',
  levelHintN1:       'Niveau de maîtrise',

  // Input
  submit:            'Valider',
  typeRomaji:        'Tapez le romaji...',
  tapToFlip:          'Touchez pour retourner',
  tapToReveal:        'Touchez pour révéler',

  // Feedback — les glyphes ❌/✅/← qu'elles portaient autrefois en
  // ligne sont maintenant de vraies <Icon/> rendues par ce qui
  // affiche le texte (voir TypeInput/DoneMessage dans
  // QuizComponents.jsx), plus intégrées à la chaîne.
  // (correct: retiré ici — cette clé n'était jamais atteinte, voir
  // reading.correct plus bas qui gagne toujours dans l'ordre du spread)
  wrong:             'Réponse :',
  quizComplete:      'Toutes les cartes sont à jour !',
  backToMenu:        'Retour au menu',

  // Rating bar. The Japanese quality terms that pair with these captions
  // (plan 045's rebuilt bar) are `ratingJp` below -- the term itself,
  // identical in every language, same convention as `cosmeticSlotJp`.
  to:                'à',
  perfect:           'Parfait',
  correctHesit:      'Correct',
  difficult:         'Difficile',
  wrongSeen:         'Presque',
  wrongRated:        'Raté',
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
  modeQCM:           'QCM',
  modeFlashcard:     'Flashcard',
  modeFill:          'Compléter',
  // Extended mode labels used by vocab/kanji screens
  modeWrite:         'Écriture',
  // Axe « format » des stats : saisi au clavier, par opposition à tracé.
  modeType:          'Saisie',
  radicalNumber:       'Clé',
  // grammaire b2f : le sens est affiché, retrouver la règle.
  revealGrammarRule:   "Quelle règle est-ce ?",
  revealGrammarBtn:    'Afficher la règle',
  standardType:        'Standard',
  standardDesc:        'Un recto et un verso, écrits par vous.',
  // ── Champs des cartes personnelles (formulaire généré) ──
  field_front:      'Recto',
  field_back:       'Verso',
  field_kanji:      'Kanji',
  field_meaning:    'Sens',
  field_readings:   'Lectures',
  field_radical:    'Clé',
  field_word:       'Mot',
  field_reading:    'Lecture',
  field_rule:       'Règle de grammaire',
  field_sentences:  'Phrase d’exemple',
  pickRadical:      'Choisir une clé',
  // ── 読み入力 (kanji.readings) ──
  readingsOn:          'On (lecture sino-japonaise)',
  readingsKun:         'Kun (lecture japonaise)',
  readingsAdd:         'ajouter une lecture',
  readingsAll:         'Toutes les lectures :',
  readingsPlaceholder: 'kana ou romaji',
  readingsCap:         "15 lectures, c'est le maximum pour cette carte.",
  modeWriteDesc:     'Le sens seul. Tracez le caractère, trait par trait.',
  // Paramétré sur le nom de l'élément étudié ("kanji" ou "mot" — voir
  // kanjiNoun/wordNoun plus bas et vocabKanjiModes dans quizModes.js).
  // C'étaient des chaînes fixes disant "kanji" quel que soit l'écran,
  // si bien que le sélecteur de mode du vocabulaire annonçait
  // « QCM (kanji → sens) » pour un paquet de mots. Les deux noms sont
  // masculins, donc "Le" convient dans les deux cas.
  modeQcmKjM:        (noun) => `QCM (${noun} → sens)`,
  modeQcmKjMDesc:    (noun) => `Le ${noun} est affiché. Choisissez son sens parmi quatre.`,
  modeQcmMKj:        (noun) => `QCM (sens → ${noun})`,
  modeQcmMKjDesc:    (noun) => `Le sens est affiché. Choisissez le ${noun} parmi quatre.`,
  modeFcKjM:         (noun) => `Carte (${noun} → sens)`,
  modeFcKjMDesc:     (noun) => `Le ${noun} seul. Rappelez le sens, puis vérifiez.`,
  modeFcMKj:         (noun) => `Carte (sens → ${noun})`,
  modeFcMKjDesc:     (noun) => `Le sens seul. Rappelez le ${noun}, puis vérifiez.`,

  // ── Modes de rappel fusionnés (étude d'un deck) ──
  // Un deck propose une entrée par sens plutôt qu'une en QCM et une en
  // flashcard : c'était la même question posée avec deux niveaux
  // d'aide — et l'aide est désormais un bouton sur la carte elle-même.
  // Voir MERGED_MODES dans StudyScreen.
  modeRecallKjM:     'Mot → sens',
  modeRecallMKj:     'Sens → mot',
  modeRecallGrammar: 'Structure → sens',
  modeRecallDesc:    'Rappelez-vous, ou affichez quatre choix — à tout moment.',
  assistOff:         'Afficher les choix',
  assistOn:          'Masquer les choix',
  assistUnavailable: 'Votre carte — rappelez-vous et auto-évaluez',

  modeFcKanaDesc:     'Le kana seul. Dites le son, puis vérifiez.',
  modeQcmKanaDesc:    'Le kana est affiché. Choisissez son son parmi quatre.',
  modeWriteKanaDesc:  'Le son est donné. Tracez le kana.',

  modeFcGrammarDesc:   'Le point seul. Rappelez ce qu\'il fait, puis vérifiez.',
  modeQcmGrammarDesc:  'Le point est affiché. Choisissez ce qu\'il fait parmi quatre.',
  modeFillGrammarDesc: 'Une phrase dont le point a été retiré. Remettez-le.',

  // « Réviser ses cartes » — parcours libre et sans notation des cartes
  // déjà étudiées dans ce paquet (voir ReviewDeck.jsx). Ajouté à chaque
  // sélecteur de mode, à côté de modeQCM/modeFlashcard/etc.
  modeReview:        'Révision',
  modeReviewDesc:    'Parcourez ce que vous savez déjà. Rien n\'est noté ni replanifié.',
  reviewEmpty:       "Vous n'avez encore étudié aucune de ces cartes — revenez après votre première session.",
  reviewPrev:        'Précédent',
  reviewNext:        'Suivant',

  // Writing practice
  writingPractice:   'Entraînez-vous à écrire ce kanji',
  writingOn:         'Écriture ON',
  writingOff:        'Écriture OFF',
  toggleWriting:     'Activer/désactiver l\'écriture',
  yourDrawing:       'Votre dessin',
  strokeOrder:       'Ordre des traits',
  continueBtn:       "C'est bon, continuer",
  eraseBtn:          'Effacer',

  // Misc
  strokes:           'traits',
  notAvailable:      'Non disponible',
  vocabulary:        'Vocabulaire',
  kanji:             'Kanji',

  // Grammar screen
  revealMeaning:     'Quel est le sens de cette règle ?',
  revealSentence:    'Complétez la phrase ci-dessous',
  revealAnswer:      'Révéler la réponse',
  revealMeaningBtn:  'Révéler le sens',
  showExamples:      'Voir les exemples',
  hideExamples:      'Masquer les exemples',

  // XpToast
  claimBtn:         'Récupérer',
  levelUp:          'Niveau supérieur !',
}

// ── Stats ─────────────────────────────────────────────────
const stats = {
  statistics:         'Statistiques',
  // ── 本日の運行 — la file du jour (screens/TodayScreen) ──────
  todayTitle:         'Service du jour',
  todayDesc:          'Toutes les révisions dues, toutes sections confondues, dans une file unique.',
  todayBoard:         "Aujourd'hui",
  todayPickHint:      'Choisissez votre service',
  todaySelectAll:     'Tout sélectionner',
  todaySelectNone:    'Tout désélectionner',
  todayPickSomething: 'Choisissez au moins une ligne',
  todayStart:         n => `Réviser ${n} carte${n === 1 ? '' : 's'}`,
  todayAllTypes:      'Toutes',
  todaySearchPlaceholder: 'Chercher une ligne...',
  todayLaneCount:     n => `${n} service${n === 1 ? '' : 's'}`,
  todayNoMatch:       'Aucune ligne ne correspond.',
  todayNoMatchHint:   'Essayez un autre nom, ou effacez les filtres.',
  todayClearFilters:  'Effacer les filtres',
  todayDue:           n => `${n} à réviser`,
  todayNothingDueShort: 'À jour',
  todayRemaining:     'Restant dans ce service',
  todayClearTitle:    'Service terminé',
  todayClearedCount:  n => `${n} révision${n === 1 ? '' : 's'} faite${n === 1 ? '' : 's'}. Plus rien à réviser.`,
  todayNothingDue:    'Rien à réviser pour le moment.',
  todayNextReview:    when => `Prochaine révision ${when}.`,
  backToStation:      'Retour à la gare',
  resetStats:         'Tout réinitialiser',
  resetConfirm:       'Effacer TOUTE la progression ? Cette action est irréversible.',
  kana:               'Kana',
  jlptVocab:          'Vocabulaire JLPT',
  globalSummary:      'Résumé global',
  new:                'Nouveau',
  learning:           'En cours',
  mastered:           'Maîtrisé',
  dueNow:             'À réviser',
  total:              'Total',
  overview:           'Aperçu',
  streak:             'Série',
  longestStreak:      'Meilleure série',
  accuracy:           'Précision',
  dueToday:           'À réviser aujourd\'hui',
  upcomingReviews:    'Prochaines révisions',
  weakestItems:       'Besoin de pratique',
  lapses:             'Ratés',
  lapsesShort:        'R',
  reviewNow:          'Réviser maintenant',

  // ── Bandeau de tête ─────────────────────────────────────
  longestIs:       n => `Record : ${n} jours`,
  noStreakYet:     'Commencez aujourd\'hui',
  dueNote:         'Elles vous attendent',
  dueClear:        'Rien en attente',
  ofTotalCards:    n => `sur ${n} cartes`,
  acrossReviews:   n => `sur ${n} révisions`,
  startedNote:     n => `${n} commencées`,
  untouchedNote:   'Jamais vues',

  // ── Calendrier de pratique ──────────────────────────────
  practiceCalendar: 'Calendrier de pratique',
  reviewsCount:     n => `${n} révisions`,
  calendarSummary:  (days, of, reviews) => `${days} jours pratiqués sur ${of} · ${reviews} révisions`,
  bestDay:          'Meilleur jour',
  calendarLess:     'moins',
  calendarMore:     'plus',

  // ── L'explorateur ───────────────────────────────────────
  explorer:      'Explorer',
  groupBy:       'Grouper par',
  sortBy:        'Trier par',
  allCategories: 'Tout',
  buckets:       'ensembles',
  sortName:      'Nom',
  dimCategory:   'Matière',
  dimLevel:      'Niveau',
  dimFormat:     'Format',
  dimDirection:  'Sens',
  dimMode:       'Exercice',
  dirRecognition:'Reconnaissance',
  dirRecall:     'Rappel',
  dirProduction: 'Écriture',

  // ── Prévisions ──────────────────────────────────────────
  perDay:     'Par jour',
  cumulative: 'Cumul',

  // ── Rythme ──────────────────────────────────────────────
  rhythm:        'Votre rythme',
  studyClock:    'Quand vous étudiez',
  peakHour:      h => `Pic à ${h}h`,
  ratingMix:     'Comment vous vous notez',
  goodOrBetter:  pct => `${pct}% bien ou mieux`,
  intervalLadder:'Jusqu\'où porte la mémoire',
  settledShare:  pct => `${pct}% à un mois ou plus`,
  intervalLearning: 'Apprentissage',
  intervalDay:      'Demain',
  intervalWeek:     '2–6 jours',
  intervalWeeks:    '1–3 semaines',
  intervalMonth:    '3–8 semaines',
  intervalMonths:   '2–6 mois',
  intervalSeason:   '6–12 mois',
  intervalYear:     'Plus d\'un an',

  troubleLede: 'Vos plus faibles précisions, les pires en premier. Choisissez-en une pour aller droit à l\'exercice.',
}

// ── Phrases analyser ────────────────────────────────────────────
const phraseAnalyzer = {
  // 解析駅 — l'analyseur fusionné (plan 027). Une gare, trois voies :
  // 文字 / 写真 / 動画. Les clés phraseAnalyzer* ci-dessous sont
  // conservées : elles nomment encore la section partout où l'ancien
  // texte n'a pas été retiré.
  analyzerTitle:       'Analyseur',
  analyzerDesc:        "Tout ce que vous croisez en japonais\nTapé, photographié ou sous-titré\nDécortiqué mot à mot",
  sourceText:          'Texte',
  sourcePhoto:         'Photo',
  sourceVideo:         'Vidéo',
  sourceTextHint:      'Tapez ou collez du japonais',
  sourcePhotoHint:     'Photographiez ou importez une image',
  sourceVideoHint:     'Sous-titres ou transcription',
  // 運行履歴 (plan 040) — le tampon et le compte pour une ligne de
  // session dans la liste d'historique fusionnée.
  sourceVideoShort:    'Depuis une vidéo',
  sessionSentenceCount: n => `${n} ${n === 1 ? 'phrase' : 'phrases'}`,
  platformUnit:        'Voie',
  platformNumber:      n => `voie ${n}`,
  // 路線図 (plan 028) — le Passage dessiné comme une ligne dont les
  // arrêts sont ses Phrases, une seule ouverte à la fois.
  routeMap:            'Plan de ligne',
  stopsInPassage:      n => `${n} phrase${n === 1 ? '' : 's'}`,
  stopNumber:          (i, n) => `Phrase ${i} sur ${n}`,
  // 追従 (plan 034) — suivre l'horloge de la vidéo le long de la ligne.
  followPlayback:      'Suivre la vidéo',
  // 改札口 (plan 029) — les trois entrées.
  intakeTextLead:      'Tapez ou collez du japonais.',
  intakePhotoLead:     'Une page, un panneau, une capture — tout ce qui porte du japonais.',
  intakeVideoLead:     'Un fichier de sous-titres, ou une transcription collée.',
  shootPhoto:          'Photographier',
  pickPhoto:           'Choisir',
  charCount:           n => `${n} caractères`,
  dropSubtitles:       'Déposez un fichier .srt, .vtt ou .ass ici, ou choisissez-en un',
  // Doit correspondre à routes/video.py:50 (_MAX_UPLOAD_BYTES = 1 Mo).
  subtitleAccepted:    'SRT, VTT et ASS · jusqu\'à 1 Mo',
  windowLabel:         'Extrait',
  windowFrom:          'De',
  windowTo:            'À',
  windowFormatHint:    'mm:ss ou secondes',
  ingestFile:          'Fichier de sous-titres',
  ingestPaste:         'Coller une transcription',
  // 改札口 / copie du minage (2026-08-27). « Mine » et « cloze » étaient
  // deux jargons sur l'action principale de l'écran ; ces libellés
  // disent ce que font les boutons.
  notJapaneseLine:     "Pas du japonais — affiché tel quel dans les sous-titres, sans décomposition.",
  notJapaneseShort:    'pas du japonais',
  addToDeck:           'Ajouter au deck',
  cardOptions:         'Options',
  clozeExplain:        "Une carte à trou masque ce mot dans la phrase, pour que vous le retrouviez par le contexte plutôt que dans une liste.",
  addCloze:            'Ajouter une carte à trou',
  changeSource:        'Changer ce que vous étudiez',
  windowWhole:         'toute la vidéo',
  windowSpan:          m => `${m} sélectionnées`,
  windowBackwards:     'La fin doit venir après le début.',
  historyTitle:        'Récent',
  phraseAnalyzerTitle: 'Analyseur de phrases',
  phraseAnalyzerDesc:  'Collez une phrase, voyez-la démontée\nChaque mot, sa lecture, votre historique\nPour celle que vous avez presque comprise',
  phraseAnalyzer:      'Analyseur de phrases',
  phrasePlaceholder:   'Ecrivez ou collez une phrase japonaise…',
  analyze:             'Analyser',
  showHistory:         'Historique',
  hideHistory:         'Masquer l\'historique',
  noHistory:           'Aucune phrase analysée pour le moment.',
  phraseAnalyzeError:  "Impossible d'analyser cette phrase. Veuillez réessayer.",
  clickForDetails:     'Cliquez pour voir la définition et les statistiques',
  inThisPhrase:        'Dans cette phrase',
  appDefinition:       'Définition dans l\'application',
  cardStats:           'Statistiques de la carte',
  totalReviews:        'Revues',
  correctReviews:      'Correct',
  interval:            'Intervalle',
  days:                'jours',
  nextReview:          'Prochaine revue',
  status_mastered:     'Maîtrisé',
  status_learning:     'En cours',
  status_new:          'Nouveau',
  status_not_started:  'Pas dans le deck',
  status_due:          'À réviser',
  sentenceLevel:       'Niveau estimé',
  unknownWords:        'mots inconnus',
  offDeckWords:        'non enseignés par l\'application',
  iPlusOne:            'À une étape de votre niveau',
  alreadyExplained:    'déjà expliquée',
  // 保存 (plan 039) — épingler une phrase dans la banque.
  keepSentence:        'Garder cette phrase',
  unkeepSentence:      'Ne plus garder cette phrase',
  keptTitle:           'Gardées',
  grammarSpotted:      'Grammaire repérée',
  explainSentence:     'Expliquer',
  explainAgain:        'Expliquer à nouveau',
  explaining:          'Explication en cours…',
  noExplanationYet:    'Sens des mots et notes de grammaire pour cette phrase',
  explanationBought:   'Expliquée',
  explainFailed:       'L\'explication n\'est pas arrivée. Réessayez.',
  explainUnavailable:  'Les explications sont indisponibles pour le moment. Réessayez sous peu.',
  passageTruncated:    n => `Seules les ${n} premières ${n === 1 ? 'phrase a été analysée' : 'phrases ont été analysées'}.`,
  sentenceAnalysisUnavailable: 'Analyse temporairement indisponible pour cette phrase.',
  mineToDeck:          'Ajouter',
  inDeck:              'Dans le deck',
  alreadyInDeck:       'Déjà présent',
  chooseDeck:          'Choisir un deck',
  noDeckOfType:        'Aucun deck de ce type pour le moment',
  clozeCreated:        'Carte à trous créée',
  mineFailed:          "Impossible d'ajouter cette carte. Veuillez réessayer.",
  cannotMineOffDeck:   "N'est pas dans le deck de l'application",
  takePhoto:           'Prendre une photo',
  chooseImage:         'Choisir une image',
  ocrRecognizing:      "Lecture de l'image…",
  ocrReading:          "Lecture de l'image…",
  cropHint:            'Encadrez le texte voulu. Les flèches déplacent la sélection.',
  useThisArea:         'Lire cette zone',
  useWholeImage:       "Utiliser toute l'image",
  ocrLocalOption:      'Lire sur mon appareil (privé, bien moins précis)',
  ocrTooLarge:         'Cette image est trop volumineuse. Essayez de recadrer plus petit.',
  ocrLimitReached:     "Vous avez atteint la limite d'images du jour. Réessayez demain.",
  ocrUnavailable:      "La lecture d'images est indisponible pour le moment. Réessayez bientôt.",
  ocrCheckText:        "Vérifiez le texte avant d'analyser — l'OCR n'est pas toujours fiable.",
  ocrFailed:           "Impossible de lire cette image. Essayez-en une autre, ou tapez le texte.",
  imageTooLarge:       'Cette image est trop volumineuse.',
  hearThis:            'Écouter',
  hearSentence:        'Écouter cette phrase',
  hearToken:           s => `Écouter ${s}`,
  entryDeleted:        'Retiré de votre historique',
  undo:                'Annuler',
  addToAnotherDeck:    'Ajouter à un autre deck',
  mineAdded:           'Ajouté à votre deck',
  mineAlready:         'Cette carte était déjà dans le deck',
}

// ── Video ─────────────────────────────────────────────────
const video = {
  videoTitle:          'Vidéo',
  videoDesc:           "Étudiez les sous-titres japonais d'une vidéo\nEn direct, colorés selon ce que vous savez déjà\nUne photo du monde avec une bande-son",
  videoUrlOptional:    'Lien de la vidéo (facultatif)',
  videoUrlOptionalHint: "Sert uniquement à afficher la vidéo à côté des sous-titres. Laissez vide pour n'étudier que le texte.",
  uploadSubtitles:     'Téléversez un fichier de sous-titres (.srt, .vtt, .ass)',
  pasteTranscript:     'Ou collez la transcription',
  pasteTranscriptHow:  "Fonctionne pour toute vidéo que vous pouvez regarder — rien n'est récupéré depuis YouTube.",
  pasteTranscriptStep1: 'Ouvrez la vidéo sur YouTube',
  pasteTranscriptStep2: 'Sous la vidéo : … plus → Afficher la transcription',
  pasteTranscriptStep3: 'Sélectionnez le panneau, copiez-le et collez-le ici',
  openOnYoutube:       'Ouvrir sur YouTube',
  useTranscript:       'Utiliser cette transcription',
  transcriptTooShort:  'Collez le texte de la transcription en plus du lien.',
  howToGetSubs:        'Comment obtenir des sous-titres japonais ?',
  howToGetSubsLead:    "yt-dlp est un outil libre et gratuit. Lancez ceci sur votre machine, puis téléversez le .srt obtenu :",
  howToGetSubsList:    'Pour voir quelles langues la vidéo propose réellement :',
  howToGetSubsNote:    "Installation : pip install yt-dlp. C'est l'option --sub-langs ja qui évite de recevoir une traduction anglaise.",
  windowStart:         'Début (secondes)',
  windowEnd:           'Fin (secondes)',
  windowCapped:        'La fenêtre a été limitée à 5 minutes.',
  analyzingText:       'Lecture de votre texte…',
  analyzingPhoto:      'Lecture du texte de la photo…',
  analyzingVideo:      'Analyse des sous-titres…',
  captionsUnavailable: "Impossible de récupérer les sous-titres de cette vidéo.",
  subtitleTooLarge:    'Ce fichier de sous-titres est trop volumineux.',
  breakThisDown:       'Décomposer cette phrase',
  transcript:          'Transcription',
  seekToSentence:      'Aller à cette phrase',
  // 案内表示 — the notices under the intake. An `info` notice is a fact
  // about the Passage, not a failure, and must never wear --danger.
  passageReady:        n => `${n} ${n === 1 ? 'phrase prête' : 'phrases prêtes'}`,
  analysisFailed:      'Cela n\'a pas fonctionné',
  noticeDismiss:       'Fermer',
  analysisResult:      'Analyse',
  clearPassage:        'Effacer',
  clearPassageHint:    'Vider l\'analyseur et recommencer',
}

// ── Reading ───────────────────────────────────────────────
const reading = {
  readingTitle:         'Entraînement à la lecture',
  readingDesc:          'De vraies phrases, à votre niveau\nPar grade, par fréquence, ou depuis vos cartes\nLire d\'abord, vérifier ensuite',

  // Source de fréquence : quelle liste de mots (byLevel/byFrequency/
  // byMastery, selectStudySource, selectTier, loadError vivent dans
  // `quiz` ci-dessus — partagés avec les autres sélecteurs de palier
  // de fréquence de l'application).
  selectDomain:          'Choisissez une liste de mots',
  domainVocabDeck:       'Deck sélectionné',
  domainVocabDecDesc:    'Le deck gradué, de N5 à N1',
  domainVocabJmdict:     'Dictionnaire complet',
  domainVocabJmdictDesc: 'Tout le dictionnaire, du plus courant au moins',
  tierLabel:             'Palier {n}',
  jumpToTier:            'Aller au palier…',

  // Les vraies phrases d'exemple n'ont qu'une traduction anglaise,
  // quelle que soit la langue de l'interface — voir la note
  // translation_lang de reading.py. Affiché en préfixe court pour ne
  // pas laisser croire qu'elle correspond à `lang`.
  translationEnglish:    'EN',

  // Source "mes cartes" : affiché à la place d'une phrase quand
  // l'apprenant n'a pas encore assez de vocabulaire en cours/maîtrisé
  // pour une phrase complète.
  notEnoughMasteryWords: "Pas encore assez de mots en cours ou maîtrisés — continuez à étudier et revenez pour ce mode.",

  readingGrammarPoint: 'Point de grammaire',
  readingFetchError:    "Impossible de charger une phrase. Veuillez réessayer.",
  writeWhatYouSaw:      'Écrivez ce que vous avez vu, en romaji',
  romajiPlaceholder:    'e.g. konnichiwa',
  correct:              'Correct!',
  incorrect:            'Pas tout à fait',
  correctRomaji:        'Correct romaji',
  yourAnswer:           'Votre réponse',
  nextPhrase:           'Phrase suivante',
  translation:          'Traduction',
  didYouGetIt:          'L\'avez-vous eu juste ?',
  gradeCorrect:         'J\'ai eu juste',
  gradeIncorrect:       'Je n\'ai pas eu juste',

  // Décomposition mot par mot + sa navigation (ReadingScreen.jsx) —
  // affichée une fois la phrase corrigée.
  showBreakdown:        'Voir la décomposition',
  hideBreakdown:        'Masquer la décomposition',
  preparingBreakdown:   'Préparation de la décomposition…',
  previousWord:         'Mot précédent',
  nextWord:             'Mot suivant',
  jumpToTokenNamed:      s => `Aller à ${s}`,
  detailsForToken:       s => `Détails de ${s}`,
  detailsForKanji:       k => `Détails du kanji ${k}`,
}

// ── Reading comprehension ────────────────────────────────────────────
const readingComprehension = {
  readingComprehensionTitle: 'Compréhension lecture',
  readingComprehensionDesc:  'Des textes courts, puis des questions\nLa moitié lecture de l\'examen, répétée\nDe N5 à N1',
  question:                   'Question',
  yourAnswer:                 'Votre réponse',
  gradeCorrect:               'J\'ai eu juste',
  gradeIncorrect:             'Je n\'ai pas eu juste',
  questionTypeComprehension: "Compréhension",
  questionTypeVocabulary: "Vocabulaire",
  questionTypeGrammar: "Grammaire",
  questionTypeInference: "Inférence",
}

// ── Translation mode ──────────────────────────────────────────────
// TranslationScreen.jsx réutilise entièrement les clés existantes de
// reading/quiz pour tout ce que les deux écrans partagent (byLevel*,
// byFrequency*, byMastery*, selectStudySource, selectLevel,
// selectDomain, selectTier, domainVocabDeck*/domainVocabJmdict*,
// tierLabel, jumpToTier, submit, loadError, retry, score, streak,
// translation, translationEnglish, yourAnswer, gradeCorrect/
// gradeIncorrect, nextPhrase) — seules les clés vraiment nouvelles
// vivent ici.
const translationMode = {
  translationTitle:      'Traduction',
  translationDesc:       'À vous de le dire en japonais\nUne réponse de référence, et un avis sur la vôtre\nLe sens difficile, volontairement',
  translationFetchError: "Impossible de charger une phrase. Veuillez réessayer.",
  japanesePlaceholder:   'Écrivez-la en japonais…',
  aiAnalysis:            'Analyse IA',
  analyzingTranslation:  'Analyse de votre traduction…',
  analysisUnavailable:   'Analyse indisponible — jugez par rapport à la référence ci-dessus.',
}

// ── Dictionary ────────────────────────────────────────────
const dictionary = {
  dictionaryPlaceholder: 'Rechercher kanji, kana, ou sens...',
  noResults:         'Aucun résultat pour',
  reading:           'Lecture',
  romaji:            'Romaji',
  meaning:           'Sens',
  examples:          'Exemples',
  level:             'Niveau',
  listen:            'Écouter',
  loadingDictionary: 'Chargement...',
  loadingMore:       'Chargement...',
  displayedKanji:    'kanji affichés',
  radical:           'Radical',
  // Additional dictionary keys used by screens
  dictAll:           'Tout',
  dictKanji:         'Kanji',
  dictVocab:         'Vocabulaire',
  dictHiragana:      'Hiragana',
  dictKatakana:      'Katakana',
  composingKanji:    'Composé de ces kanji',
  vocabExamples:     'Utilisé dans ces mots',
  dictBackToRadicals:'Retour aux radicaux',
  dictModeSearch:    'Recherche',
  dictModeRadical:   'Radical',
  dictionaryPlaceholderRadical: 'Filtrer ces résultats par radical...',
  dictionaryResults: n => `${n} résultats`,
  dictRadicalNumber: (n) => `radical #${n}`,
  dictStrokesPlural: 'traits',
  dictStrokeSingular: 'trait',
  dictStrokeIndex:   'Index par nombre de traits',
  syllabaryMain:     'Syllabaire principal',
  syllabaryNSolo:    'ん',
  syllabaryVoiced:   'Sons voisés (dakuten / handakuten)',
  // Titre/aria-label de l'icône d'action "ouvrir le dictionnaire" sur
  // une carte révélée (RevealActions dans QuizComponents.jsx).
  openDictionary:    'Ouvrir la fiche du dictionnaire',
}

// Reading-comprehension / generic reading labels
const comprehension = {
  comprehensionTitle:       'Compréhension lecture',
  comprehensionFetchError:  "Impossible de charger le texte. Veuillez réessayer.",
  comprehensionGenerating:  'Génération du texte…',
  comprehensionSubmitError:  "Impossible d'envoyer les réponses. Veuillez réessayer.",
  doneReading:              'Terminé',
  reReadText:               'Relire le texte',
  showTranslation:          'Afficher la traduction',
  hideTranslation:          'Masquer la traduction',
  timeRemaining:           'Temps restant',
  originalText:            'Texte original',
  tryAgain:                'Réessayer',
  changeLevel:             'Changer de niveau',
  score:                   'Score',
}

const progress = {
  progressNew:       'À apprendre',
  progressLearning:  'En cours',
  progressMastered:  'Maîtrisé',
}

const misc = {
  mute:    'Couper le son',
  unmute:  'Activer le son',
  onyomi:  "Lectures on'yomi (sino-japonaises)",
  kunyomi: "Lectures kun'yomi (japonaises)",
  kanjiNoun: 'kanji',
  wordNoun:  'mot',
  // Affiché par components/study/SessionError quand une session n'a
  // rien à montrer ET que la dernière requête a échoué — cet état
  // n'affichait auparavant qu'un cadre vide, sans explication ni moyen
  // de reprendre.
  // ── Indices (indice_1/2/3) ──
  // Un indice s'active carte par carte et ne scinde jamais le SRS —
  // voir components/study/HintBar.jsx. Ils remplacent les anciens
  // libellés « QCM », le choix multiple étant désormais un niveau
  // d'aide et non un exercice.
  hintChoicesShow:    'Afficher les choix',
  hintChoicesHide:    'Masquer les choix',
  hintSentencesShow:  'Afficher une phrase',
  hintSentencesHide:  'Masquer la phrase',
  hintFuriganaShow:   'Afficher les furigana',
  hintFuriganaHide:   'Masquer les furigana',

  // ── Modes d'étude (domain/studyModes.js) ──
  // Un libellé et une description par clé de mode. Le préfixe par source
  // rend le paramètre `noun` inutile : l'ancienne forme modeQcmKjM(noun)
  // existait parce que `flashcard-kj-m` voulait dire « kanji » sur un
  // écran et « mot » sur un autre, une seule clé devant servir les deux.
  mode_kana_flashcard_f2b:        'Kana → romaji',
  mode_kana_flashcard_f2b_desc:   'Le kana est affiché. Rappelez-vous son son.',
  mode_kana_flashcard_b2f:        'Romaji → kana',
  mode_kana_flashcard_b2f_desc:   'Le son est donné. Rappelez-vous le kana.',
  mode_kana_write_romaji:         'Écrire le romaji',
  mode_kana_write_romaji_desc:    'Le kana est affiché. Tapez son son.',
  mode_kana_write_kana:           'Tracer le kana',
  mode_kana_write_kana_desc:      'Le son est donné. Tracez le kana à la main.',

  mode_kanji_flashcard_f2b:       'Kanji → sens',
  mode_kanji_flashcard_f2b_desc:  'Le kanji est affiché. Rappelez-vous son sens.',
  mode_kanji_flashcard_b2f:       'Sens → kanji',
  mode_kanji_flashcard_b2f_desc:  'Le sens est affiché. Rappelez-vous le kanji.',
  mode_kanji_write_kanji:         'Tracer le kanji',
  mode_kanji_write_kanji_desc:    'Le sens est donné. Tracez le kanji à la main.',
  mode_kanji_readings:            'Lectures',
  mode_kanji_readings_desc:       "Le kanji est affiché. Tapez ses lectures on'yomi et kun'yomi.",
  mode_kanji_radical:             'Radical',
  mode_kanji_radical_desc:        'Le kanji est affiché. Rappelez-vous son radical.',

  mode_vocab_flashcard_f2b:       'Mot → sens',
  mode_vocab_flashcard_f2b_desc:  'Le mot est affiché. Rappelez-vous son sens.',
  mode_vocab_flashcard_b2f:       'Sens → mot',
  mode_vocab_flashcard_b2f_desc:  'Le sens est affiché. Rappelez-vous le mot.',
  mode_vocab_word_reading:        'Lecture',
  mode_vocab_word_reading_desc:   'Le mot est affiché. Rappelez-vous sa lecture en kana.',

  mode_grammar_flashcard_f2b:      'Structure → sens',
  mode_grammar_flashcard_f2b_desc: 'La structure est affichée. Rappelez-vous son emploi.',
  mode_grammar_flashcard_b2f:      'Sens → structure',
  mode_grammar_flashcard_b2f_desc: 'Le sens est affiché. Rappelez-vous la structure.',
  mode_grammar_fill_in:            'Nommer la règle',
  mode_grammar_fill_in_desc:       'Une phrase japonaise, sans traduction. Nommez la structure employée.',

  mode_standard_flashcard_f2b:      'Recto → verso',
  mode_standard_flashcard_f2b_desc: "Votre carte, telle que vous l'avez écrite.",
  mode_standard_flashcard_b2f:      'Verso → recto',
  mode_standard_flashcard_b2f_desc: "Votre carte, dans l'autre sens.",

  mode_fast_review:                'Révision rapide',
  mode_fast_review_desc:           "Parcourez ce que vous avez déjà étudié. Rien n'est noté.",
  retry:     'Réessayer',
  sessionLoadFailed: 'Impossible de charger vos cartes.',
}

// ── Profile ───────────────────────────────────────────────
const profile = {
  // ── Profil ──
  thisWeek:          'Cette semaine',
  records:           'Records',
  currentStreak:     'Série en cours',
  longestStreak:     'Plus longue série',
  perfectRun:        'Meilleure série parfaite',
  perfectRunUnit:    "d'affilée",
  dayUnit:           'jours',
  masteryLadder:     'Maîtrise',
  rankRemaining:     (n, label) => `Encore ${n} avant ${label}`,
  rankTopped:        'Rang le plus haut atteint',
  // Noms des badges, indexés par l'id envoyé par le backend. Ils
  // étaient codés en dur en français dans routes/profile.py et servis
  // à tous les clients — un profil en anglais affichait donc six noms
  // français. L'id circule désormais et le nom vit ici.
  badgeName: {
    first_steps:   'Premiers pas',
    week_streak:   'Série de 7 jours',
    month_streak:  'Série de 30 jours',
    kanji_100:     '100 cartes maîtrisées',
    perfectionist: "10 sans-faute d'affilée",
    dedicated:     '500 révisions',
  },
  chaseNext:         (xp, who) => `${xp} XP derrière ${who}`,
  badgesEarned:      (n, m) => `${n} sur ${m}`,
  passLabel:         "Carte d'abonnement",
  passSince:         'Membre depuis le niveau 1',
  noActivityWeek:    "Rien d'étudié cette semaine pour l'instant",
  profileTitle:      'Profil',
  profileStale:      "Impossible d'atteindre le serveur — affichage de vos dernières données connues.",
  // Les portes du profil vers le Hall des daruma, le Grenier et les
  // statistiques — voir la portée 'profile' de config/navLinks.js.
  halls:             'Salles',
  hallStatsNote:     'Tout ce que vous avez fait, compté',
  badges:            'Badges',
  leaderboard:       'Classement',
  done:              'Terminé',
  genericError:      'Une erreur est survenue. Réessayez.',

  // Contenu de repli hors-ligne, affiché uniquement quand /api/profile
  // est inaccessible (voir ProfileScreen.jsx buildMockProfile) —
  // routé via `t` pour que l'écran de repli respecte la langue de
  // l'interface comme partout ailleurs.
}

// ── Settings ──────────────────────────────────────────────
const settings = {
  settings:          'Réglages',
  preferences:       'Préférences',
  sound:             'Son',
  ambiance:          'Ambiance',
  theme:             'Thème',
  language:          'Langue',
  account:           'Compte',
  signOutDesc:       'Déconnectez votre compte sur cet appareil.',

  // N'apparaît que comme texte title/aria-label (NavControls.jsx) —
  // le bouton visible est déjà une vraie icône SVG IconSun/IconMoon.

  volumeMaster:       'Volume principal',
  volumeKana:         'Volume kana',
  volumeVoice:        'Volume voix',
  volumeEffects:      'Volume effets',
  volumeUi:           'Volume interface',
  volumeAmbiance:     "Volume ambiance",
  volumeJingle:       'Volume jingle',
  volumeAnnouncement: 'Volume annonces',
  volumeAnnouncements: 'Volume annonces',
}

// ── Decks ─────────────────────────────────────────────────
const decks = {
  decks:             'Mes Decks',
  createDeck:        'Créer un deck',
  deckNamePlaceholder: 'Nom du deck...',
  noDecks:           'Aucun deck pour l\'instant.',
  createFirstDeck:   'Créez votre premier deck ci-dessus.',
  // Voir la version anglaise — l'index de l'étagère, calqué sur la
  // console du dictionnaire.
  decksSearchPlaceholder: 'Chercher un deck...',
  decksAllTypes:     'Tous',
  decksCount:        '{n} decks',
  decksCountOne:     '1 deck',
  decksNoMatch:      'Aucun deck ne correspond.',
  decksNoMatchHint:  'Essayez un autre nom, ou effacez les filtres.',
  decksClearFilters: 'Effacer les filtres',
  // Posée directement sur la carte / la barre plutôt que par la
  // boîte confirm() du navigateur — courte, puisqu'elle est en ligne.
  deleteDeckConfirm: 'Supprimer ce deck ?',
  deleteCardsConfirm: 'Supprimer la sélection ?',
  study:             'Étudier',
  addCard:           '+ Ajouter',
  newCard:           'Nouvelle carte',
  editCard:          'Modifier la carte',
  noCards:           'Aucune carte dans ce deck.',
  addFirstCard:      'Ajoutez votre première carte ci-dessus.',
  frontPlaceholder:  'Recto',
  backPlaceholder:   'Verso / Sens',
  hintPlaceholder:   'Indice (optionnel)',
  notesPlaceholder:  'Notes (optionnel)',
  // Placeholder du champ recto propre aux decks personnalisés de type
  // kanji (DeckDetailScreen.jsx).
  kanjiFrontPlaceholder: 'Kanji (ex : 日)',
  // Affiché dans le titre du TopBar si le nom du deck n'est pas encore
  // disponible (ex : cet écran ouvert directement plutôt que depuis
  // DecksScreen, donc l'état du routeur portant le deck est absent).
  deckFallbackTitle: 'Deck',

  // Deck types
  flashcardType:     'Flashcard',
  flashcardDesc:     'Recto / Verso — toute langue',
  vocabType:         'Vocabulaire',
  vocabDesc:         'Le vocabulaire gradué de N5 à N1\nOu par fréquence, par thème, ou hors programme\nDe la forme au sens, et retour',
  deckVocabDesc:     'Vocabulaire uniquement — issu des niveaux JLPT',
  kanjiType:         'Kanji',
  kanjiDesc:         'Les caractères par niveau, avec l\'ordre des traits\nLes lire, puis les écrire de mémoire\nChaque lecture, chaque sens',
  deckKanjiDesc:     'Kanji uniquement — avec ordre des traits',
  grammarType:       'Grammaire',
  deckGrammarDesc:   'Points de grammaire uniquement — issus des niveaux JLPT',
  mixedType:         'Mixte',
  mixedDesc:         'Vos propres cartes plus kanji, vocabulaire et grammaire, tous mélangés',

  // Parcourir les cartes existantes (BrowseCardsMenu.jsx)
  browseBtn:              'Parcourir',
  browseTitle:            'Parcourir les cartes existantes',
  browseSubtitle:         "Ajoutez à ce deck des kanji, mots ou points de grammaire déjà présents dans l'application.",
  browseTabKanji:         '漢字 Kanji',
  browseTabVocab:         '語彙 Vocabulaire',
  browseTabGrammar:       '文法 Grammaire',
  browseAllLevels:        'Tous',
  browseSearchPlaceholder: 'Rechercher (kanji, kana, sens...)',
  browseResults:          'Résultats',
  browseSelectedCount:    '{n} sélectionné(s)',
  searching:              'Recherche...',
  alreadyAdded:           'déjà ajouté',
  adding:                 'Ajout...',
  addSelected:            'Ajouter ({n})',
  // Affiché à la place des onglets de source quand le type d'un deck
  // n'accepte qu'une seule sorte de carte (ex : un deck de type
  // Kanji) — il n'y a alors rien à choisir, donc les onglets sont
  // remplacés par ce message.
  browseOnlyAccepts:      'Ce deck n\'accepte que les cartes de type {type}.',

  // Bulk select
  selectAll:         'Tout sélectionner',
  deselectAll:       'Tout désélectionner',

  // Import modal
  importTitle:       'Importer vos données',
  importSubtitle:    'Copiez-collez vos données ici (depuis Word, Excel, Google Docs, etc.)',
  importPreview:     'Aperçu',
  noPreview:         'Rien à prévisualiser',
  termSep:           'Entre terme et définition',
  cardSep:           'Entre les cartes',
  tab:               'Tabulation',
  comma:             'Virgule',
  custom:            'Personnalisé',
  newRow:            'Nouvelle ligne',
  semicolon:         'Point-virgule',
  importBtn:         'Importer',
  importing:         'Importation...',
  cards:             'cartes',
  andMore:           '... et {n} autres',

  // Study screen
  studyMode:         "Mode d'étude",
  mixWithJLPT:       'Mélanger avec les listes JLPT',
  startSession:      'Commencer',
  writePractice:     'Entraînement à l\'écriture',
  revealAnswer:      'Afficher la réponse',
  typeAnswer:        'Tapez votre réponse...',
  // Labels des phases pour les decks personnalisés vocab/kanji
  // (StudyScreen.jsx) — K+K→S = Kanji+Kana → Sens, même progression à
  // trois phases que les decks vocab/kanji intégrés.
  studyPhase1:       'Phase 1 — K+K→S',
  studyPhase2:       'Phase 2 — K→S',
  studyPhase3:       'Phase 3 — S→K',
}

// ── Examen blanc ──────────────────────────────────────────
// N'était pas du tout traduit — chaque chaîne ci-dessous ne
// s'affichait que via son propre repli `?? 'texte anglais'` (voir
// ExamScreen/ExamRunner/ExamResult/QuestionRenderer), si bien qu'un
// utilisateur francophone voyait ce texte en anglais alors que le
// reste de l'app restait en français.
//
// Cette app n'est affiliée ni à la JEES ni à la Japan Foundation et ne
// prétend reproduire ni corriger sur leur barème officiel — chaque
// examen est généré selon le format public du JLPT (nombre de
// sections, minutage, types d'épreuves), jamais recopié d'une annale.
// Garder cette distinction en tête si ce texte est retouché.
const exam = {
  examTitle:           'Examen blanc',
  examDesc:            "Examens complets, chronométrés et notés\nVocabulaire, grammaire, lecture, écoute\nAu format JLPT officiel — notation non officielle",
  examQuestions:       'questions',
  examNoneAvailable:   'Aucun examen disponible pour le moment.',

  // ── Types d'épreuve ──
  // Les quatre générateurs (backend/study/exam_*_gen.py), nommés dans
  // la langue du lecteur avec le japonais conservé en spécimen — le
  // sélecteur n'affichait que « N5 語彙 », ce qui ne disait rien à un
  // débutant sur le contenu de la carte.
  examKindVocab:       'Vocabulaire',
  examKindGrammar:     'Grammaire',
  examKindReading:     'Lecture',
  examKindListening:   'Écoute',
  examNotGeneratedYet: 'Rédigé à la première ouverture',
  examGenerating:      'Rédaction de votre examen…',
  examGeneratingHint:  "Les questions sont rédigées quand aucune épreuve que vous n'avez pas déjà passée n'existe — comptez une à deux minutes. Une fois écrite, elle se charge instantanément, pour vous comme pour les autres.",
  examLoadFailed:      "Cette épreuve n'a pas pu être générée pour le moment.",
  examLoadFailedHint:  'Le rédacteur de questions est peut-être momentanément indisponible. Réessayez dans un instant.',
  // Affiché à la place de examLoadFailedHint (et du bouton Réessayer)
  // pendant que le serveur refuse de nouvelles tentatives : relancer
  // une génération coûte plusieurs minutes et des dizaines d'appels.
  examLoadFailedCooldown: (minutes) =>
    `Le rédacteur de questions fait une pause après un échec. Réessayez dans environ ${minutes} minute${minutes === 1 ? '' : 's'}.`,
  examRetry:           'Réessayer',

  examSectionEmpty:    'Cette section ne contient encore aucune question.',
  examAnswered:        'répondu',
  examFinishSection:   'Terminer',
  examQuestionAbbrev:  'Q',
  examResultMissing:   "Ce résultat n'est plus disponible — recommencez l'examen.",
  examBackToExams:     'Retour aux examens',
  // L'action secondaire de chaque épreuve dans le sélecteur, et
  // l'action principale de l'écran de résultat. Les deux demandent une
  // AUTRE épreuve, pas la même — voir backend/study/exam_schema.py.
  examFreshPaper:      'Autre épreuve',
  examFreshPaperHint:  "Remplacer cette épreuve par une autre. Si personne n'en a encore écrit, comptez une à deux minutes.",
  examNewPaper:        'Nouvelle épreuve',
  examStarHint:        "Quel élément va à la position marquée d'une étoile ?",
  examFullSentence:    'Phrase complète :',
  examAudioPending:    "Extrait audio pas encore généré pour cette question.",

  // ── Résultat ──
  // Ne jamais appeler cela une note JLPT. La vraie est un 尺度得点
  // calibré par IRT à partir de paramètres d'items officiels dont
  // aucun tiers ne dispose : l'honnête est d'afficher la proportion
  // brute de bonnes réponses et un objectif d'entraînement, en le
  // disant clairement.
  examScoreCorrect:    'correctes',
  examPracticeTarget:  "Objectif d'entraînement",
  examUnofficialNote:  'Score non officiel — proportion brute de bonnes réponses, pas une note JLPT calibrée.',
  examReviewTitle:     'Revoir vos réponses',
  examReviewHint:      'Touchez une question pour la revoir avec la bonne réponse.',
  // Une correction sert d'abord aux erreurs : c'est donc ce qui est
  // ouvert par défaut — sinon une épreuve de 21 questions affiche 21
  // lignes identiques à dérouler avant de trouver les deux ratées.
  examShowWrongOnly:   'Erreurs seules',
  examShowAll:         'Toutes les questions',
  examAllCorrect:      'Aucune erreur — toutes les réponses sont bonnes.',
  // La couleur seule ne peut pas dire quelle ligne a été choisie et
  // laquelle était juste (c'est la même sur une bonne réponse, et ~8 %
  // des gens ne distinguent pas les deux teintes) : les deux sont donc
  // écrites en toutes lettres.
  examYourAnswer:      'Votre réponse',
  examCorrectAnswer:   'Bonne réponse',
  examNotAnswered:     'Laissée vide',
  examTimeTaken:       'Temps passé',
  // Le script d'écoute est déjà dans chaque épreuve (voir
  // exam_listening_gen.py) et c'est exactement ce qui rend une
  // question d'écoute ratée exploitable — caché pendant l'épreuve,
  // proposé à la correction.
  examTranscript:      'Transcription',

  // ── Feuille de réponses ──
  // La grille numérotée sous la question. Nommée d'après ce qu'elle
  // remplace : sur un JLPT papier, c'est la feuille de réponses qui
  // dit d'un coup d'œil ce qu'il reste à faire.
  examSheetTitle:      'Feuille de réponses',
  examSheetBlank:      'vide',
  examSheetFlagged:    'marquée',
  // aria-label d'une case — les états visuels (rempli, contour, coin
  // marqué) ne veulent rien dire pour un lecteur d'écran : chaque case
  // énonce donc le sien.
  examSheetChip: (n, answered, flagged) =>
    `Question ${n}, ${answered ? 'répondue' : 'vide'}${flagged ? ', marquée' : ''}`,
  examFlag:            'Marquer à revoir',
  examUnflag:          'Retirer la marque',

  // ── Terminer ──
  // Rendre une copie avec des vides les compte comme fausses : on
  // prévient donc, avec le nombre — et on propose d'y aller plutôt que
  // seulement de passer outre.
  examConfirmTitle:    'Terminer avec des questions sans réponse ?',
  examConfirmBody: (n) =>
    `${n} question${n === 1 ? ' est encore vide' : 's sont encore vides'}. Une réponse vide est comptée comme fausse.`,
  examReviewBlanks:    'Aller à la première vide',
  examSubmitAnyway:    'Terminer quand même',
  examKeepGoing:       'Continuer',
  // Un envoi échoué laissait une copie terminée sans message ni
  // recours. Le brouillon est conservé jusqu'à la réussite de l'envoi :
  // réessayer est donc un vrai réessai.
  examSubmitFailed:    "Impossible d'envoyer vos réponses — votre progression est conservée.",
  examSubmitRetry:     "Réessayer l'envoi",
  examSubmitting:      'Envoi…',

  // ── Quitter en cours d'épreuve ──
  examLeaveTitle:      'Quitter cette épreuve ?',
  examLeaveBody:       'Vos réponses et le chronomètre sont enregistrés — rouvrir cette épreuve reprend où vous en étiez.',
  examLeaveConfirm:    'Quitter',
  examLeaveStay:       'Rester',

  // ── Habillage de la question ──
  // La consigne du mondai est identique pour toutes ses questions :
  // elle s'ouvre sur la première puis se replie ici, au lieu de
  // relire les quatre mêmes lignes de kana à chaque fois.
  examShowInstructions: 'Afficher la consigne',
  examHideInstructions: 'Masquer la consigne',
  // Annoncé, pas seulement coloré — aujourd'hui, qui ne regarde pas le
  // coin de l'écran n'est prévenu de rien.
  examTimeWarning: (minutes) =>
    `${minutes} minute${minutes === 1 ? '' : 's'} restante${minutes === 1 ? '' : 's'}.`,

  // ── Lecteur audio ──
  examAudioPlay:       'Lire',
  examAudioPause:      'Pause',
  examAudioReplay:     'Relire depuis le début',
  examAudioPlayed: (n) => `Écouté ${n}×`,
  examAudioProgress:   "Position dans l'audio",
}

// ── 達磨堂 — le Hall des Daruma ────────────────────────────
// Le texte des objectifs vit ici, pas côté serveur : routes/daruma.py
// n'envoie que des identifiants, précisément parce que la version
// précédente de cette fonctionnalité envoyait des libellés codés en
// dur en français à des utilisateurs anglophones. Chaque identifiant
// du catalogue de srs/daruma.py doit avoir une entrée dans
// darumaGoalTitle et darumaGoalDesc, dans les deux langues.
const darumaGoals = {
  darumaGoalTitle: {
    daily_reviews_30:  'Trente révisions',
    daily_reviews_60:  'Soixante révisions',
    daily_reviews_120: 'Cent vingt révisions',
    daily_new_5:       'Cinq nouvelles cartes',
    daily_new_15:      'Quinze nouvelles cartes',
    daily_perfect_10:  'Dix sans faute',
    daily_perfect_20:  'Vingt sans faute',
    daily_accuracy_85: 'Main sûre',
    daily_clear_due:   'Vider la file',
    daily_breadth_3:   'Trois disciplines',
    daily_dawn:        'Avant l’aube',
    daily_night:       'À la nuit tombée',
    daily_xp_150:      'Cent cinquante XP',

    weekly_reviews_300: 'Trois cents cette semaine',
    weekly_reviews_700: 'Sept cents cette semaine',
    weekly_new_40:      'Quarante nouvelles cartes',
    weekly_days_5:      'Cinq jours d’étude',
    weekly_days_7:      'Tous les jours cette semaine',
    weekly_perfect_25:  'Vingt-cinq sans faute',
    weekly_xp_1200:     'Mille deux cents XP',
    weekly_breadth_4:   'Quatre disciplines',

    vow_streak_7:      'Sept jours d’affilée',
    vow_streak_30:     'Un mois d’affilée',
    vow_streak_100:    'Cent jours d’affilée',
    vow_reviews_1000:  'Mille révisions',
    vow_reviews_5000:  'Cinq mille révisions',
    vow_mastered_100:  'Cent cartes maîtrisées',
    vow_mastered_500:  'Cinq cents cartes maîtrisées',
    vow_perfect_50:    'Cinquante sans faute d’affilée',
    vow_nanakorobi:    'Tomber sept fois, se relever huit',
    vow_breadth_5:     'Toutes les disciplines en un jour',
  },

  darumaGoalDesc: {
    daily_reviews_30:  'Réviser 30 cartes aujourd’hui.',
    daily_reviews_60:  'Réviser 60 cartes aujourd’hui.',
    daily_reviews_120: 'Réviser 120 cartes aujourd’hui.',
    daily_new_5:       'Découvrir 5 cartes jamais vues.',
    daily_new_15:      'Découvrir 15 cartes jamais vues.',
    daily_perfect_10:  'Enchaîner 10 réponses notées Bien ou mieux.',
    daily_perfect_20:  'Enchaîner 20 réponses notées Bien ou mieux.',
    daily_accuracy_85: 'Finir la journée à 85 % de réussite sur au moins 20 révisions.',
    daily_clear_due:   'Ne rien laisser à réviser en fin de journée.',
    daily_breadth_3:   'Étudier trois domaines parmi kana, vocabulaire, kanji, grammaire et vos paquets.',
    daily_dawn:        'Faire une révision avant 8 h du matin.',
    daily_night:       'Étudier encore à 22 h.',
    daily_xp_150:      'Gagner 150 XP aujourd’hui.',

    weekly_reviews_300: 'Réviser 300 cartes avant lundi.',
    weekly_reviews_700: 'Réviser 700 cartes avant lundi.',
    weekly_new_40:      'Découvrir 40 cartes jamais vues cette semaine.',
    weekly_days_5:      'Étudier cinq jours différents cette semaine.',
    weekly_days_7:      'Étudier chaque jour de la semaine.',
    weekly_perfect_25:  'Enchaîner 25 réponses notées Bien ou mieux cette semaine.',
    weekly_xp_1200:     'Gagner 1 200 XP cette semaine.',
    weekly_breadth_4:   'Étudier quatre disciplines différentes cette semaine.',

    vow_streak_7:      'Atteindre une série de 7 jours.',
    vow_streak_30:     'Atteindre une série de 30 jours.',
    vow_streak_100:    'Atteindre une série de 100 jours.',
    vow_reviews_1000:  'Cumuler 1 000 révisions.',
    vow_reviews_5000:  'Cumuler 5 000 révisions.',
    vow_mastered_100:  'Amener 100 cartes jusqu’à la maîtrise.',
    vow_mastered_500:  'Amener 500 cartes jusqu’à la maîtrise.',
    vow_perfect_50:    'Enchaîner 50 réponses notées Bien ou mieux.',
    vow_nanakorobi:    'Se relever sept fois d’une série brisée.',
    vow_breadth_5:     'Étudier les cinq disciplines dans la même journée.',
  },

  darumaColor: {
    aka:      'Rouge — chance et protection',
    kin:      'Or — fortune',
    shiro:    'Blanc — un objectif net',
    murasaki: 'Violet — santé et longévité',
    ao:       'Bleu — études et carrière',
    midori:   'Vert — vigueur',
    kuro:     'Noir — conjurer le mauvais sort',
    momo:     'Rose — affection',
  },
}

const daruma = {
  darumaTitle:        'Hall des Daruma',
  darumaDesc:         'Vœux, récompenses et une étagère de daruma achevés',
  darumaMotto:        'Tomber sept fois, se relever huit',
  darumaToday:        'Les vœux du jour',
  darumaThisWeek:     'Les vœux de la semaine',
  darumaVows:         'Grands vœux',
  darumaShelf:        'L’étagère',

  darumaTokens:       'Jetons de relève',
  darumaOnShelf:      'Sur l’étagère',
  darumaClaim:        'Peindre l’œil',
  darumaClaimed:      'Vœu exaucé',
  darumaFulfilled:    'Le vœu est exaucé',
  darumaEnshrine:     'Le poser sur l’étagère',

  darumaEmptySlot:    'Emplacement libre',
  darumaTakeVow:      'Faire le vœu',
  darumaRelease:      'Le rendre',
  darumaShowCatalogue: 'Parcourir les grands vœux',
  darumaHideCatalogue: 'Masquer les grands vœux',
  darumaNoSlots:      'Les trois emplacements sont pris',
  darumaAllVowsTaken: 'Tous les vœux sont pris ou déjà exaucés.',
  darumaVowsFulfilled: n => `${n} grand${n === 1 ? '' : 's'} vœu${n === 1 ? '' : 'x'} déjà exaucé${n === 1 ? '' : 's'}.`,

  darumaMendPrompt:   day => `Vous avez manqué le ${day}. Un jeton de relève rachète cette journée.`,
  darumaMendBtn:      'Se relever',
  darumaNoTokens:     'Aucun jeton',

  darumaNoneToday:    'Rien de tiré — revenez demain.',
  darumaShelfEmpty:   'L’étagère est vide. Exaucez un vœu et le daruma viendra s’y poser.',
  darumaOffline:      'Hall injoignable — ces données peuvent être périmées.',

  darumaDoorwayDesc:  'Les trois vœux du jour',
  darumaReadyCount:   n => `${n} daruma attend${n === 1 ? '' : 'ent'} son second œil`,
}

// ── 蔵 — le Grenier ────────────────────────────────────────
// Texte des cosmétiques. Comme pour le hall des daruma,
// routes/cosmetics.py n'envoie que des identifiants et le nom japonais
// de l'objet (un nom propre : 雲龍紙 s'appelle 雲龍紙 dans toutes les
// langues, même convention que appTitle) ; le nom lisible et la
// description vivent ici.
//
// Chaque description dit ce qu'est réellement la matière. C'est là
// toute la récompense : ce qu'on gagne au bout d'un an d'étude n'est
// pas un effet lumineux, c'est une feuille de papier dragon-nuage et
// la raison de son nom.
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
    paper:    'Papier',
    ring:     'Anneau',
    seal:     'Sceau',
    title:    'Titre',
    backdrop: 'Décor',
    flourish: 'Fanfare',
    brush:    'Pinceau',
    mcq:      'Rangées QCM',
  },

  cosmeticReq: {
    level:                n => `Atteindre le niveau ${n}`,
    rank_index:           r => `Atteindre le rang ${r}`,
    mastered_total:       n => `Maîtriser ${n.toLocaleString('fr-FR')} cartes`,
    reviews_total:        n => `Cumuler ${n.toLocaleString('fr-FR')} révisions`,
    streak_longest:       n => `Tenir une série de ${n} jours`,
    perfect_run_lifetime: n => `Enchaîner ${n} réponses notées Bien ou mieux`,
    rises_total:          n => `Se relever ${n} fois d’une série brisée`,
    shelf_count:          n => `Poser ${n} daruma sur l’étagère`,
    shelf_colors:         n => `Poser un daruma de chacune des ${n} couleurs`,
    shelf_kiwami:         n => `Poser ${n} daruma ultimes sur l’étagère`,
    best_day_reviews:     n => `Réviser ${n} cartes en une seule journée`,
    unlocked_count:       n => `Débloquer ${n} objets du grenier`,
    // Les défis : des instants plutôt que des compteurs. La propriété
    // est définitive, donc les remplir une fois suffit pour toujours.
    categories_today:     n => `Étudier ${n} matières différentes en un jour`,
    new_cards_today:      n => `Découvrir ${n} nouvelles cartes en un jour`,
    study_days_week:      n => `Étudier ${n} jours d'affilée`,
    dawn_today:           () => 'Étudier avant 8 h du matin',
    night_today:          () => 'Étudier après 22 h',
  },

  cosmeticName: {
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

    ring_hosomichi: 'Hosomichi',
    ring_kumihimo:  'Kumihimo',
    ring_enso:      'Ensō',
    ring_sakura:    'Sakura',
    ring_seigaiha:  'Seigaiha',
    ring_raijin:    'Raijin',
    ring_kinrin:    'Kinrin',
    ring_hinode:    'Hinode',

    seal_shu:     'Sceau vermillon',
    seal_sumi:    'Sceau d’encre',
    seal_hisui:   'Sceau de jade',
    seal_koban:   'Sceau koban',
    seal_kin:     'Sceau d’or',
    seal_tenkoku: 'Tenkoku',

    title_minarai:    'Apprenti(e)',
    title_kakehashi:  'Bâtisseur de ponts',
    title_idaten:     'Idaten',
    title_fudo:       'L’Inébranlable',
    title_hyakume:    'Cent Yeux',
    title_nanakorobi: 'Huit fois relevé',
    title_tetsujin:   'Homme de fer',
    title_sennichi:   'Marcheur des mille jours',
    title_kuramori:   'Gardien du grenier',
    title_shishou:    'Maître',
    title_shosei:     'Sage du pinceau',
    title_meijin:     'Meijin',
    // 紙 — papiers (suite)
    paper_sugihara:    'Sugihara',
    paper_ganpi:       'Ganpi',
    paper_chiyogami:   'Chiyogami',
    paper_danshi:      'Danshi',
    paper_sumizome:    'Sumizome',
    paper_rakusui:     'Rakusui',
    // 輪 — anneaux (suite)
    ring_asanoha:  'Asanoha',
    ring_shippou:  'Shippou',
    ring_kikko:    'Kikkou',
    ring_tomoe:    'Mitsudomoe',
    ring_gesshin:  'Gesshin',
    // 印 — sceaux (suite)
    seal_rakkan:  'Rakkan',
    seal_yuin:    'Sceau de plaisir',
    seal_hyotan:  'Sceau calebasse',
    seal_hakubun: 'Hakubun',
    seal_gyokuji: 'Sceau de jade',
    // 称号 — titres (suite)
    title_hajime:    'Esprit du débutant',
    title_akatsuki:  'Point du jour',
    title_yonaga:    'La longue nuit',
    title_hayate:    'Bourrasque',
    title_muketsu:   'Sans défaut',
    title_kaigen:    "Ouvreur d'yeux",
    title_tsuwamono: 'Vieux soldat',
    title_musou:     'Sans égal',
    title_daruma:    'Daruma',
    // 背景 — décors
    backdrop_muji:      'Uni',
    backdrop_tatami:    'Tatami',
    backdrop_shoji:     'Shouji',
    backdrop_kanoko:    'Kanoko',
    backdrop_asagiri:   'Brume du matin',
    backdrop_hoshizora: 'Ciel étoilé',
    backdrop_sumie:     'Sumi-e',
    backdrop_sakura:    'Pluie de pétales',
    backdrop_kasumi:    'Brume dorée',
    backdrop_kinbyobu:  "Paravent d'or",
    backdrop_amanogawa: 'Rivière céleste',
    // 祝 — fanfares
    flourish_tsuke:    'Tsuke',
    flourish_hanabi:   "Feu d'artifice",
    flourish_koban:    'Koban',
    flourish_sakura:   'Floraison',
    flourish_kaminari: 'Tonnerre',
    flourish_kitsune:  'Feu de renard',
    flourish_matsuri:  'Fête',
    flourish_ryu:      'Dragon',
    flourish_hoo:      'Phénix',
    // 筆 — pinceaux
    brush_sumi:     'Sumi',
    brush_shuboku:  'Encre vermillon',
    brush_aiboku:   'Encre indigo',
    brush_futofude: 'Gros pinceau',
    brush_chaboku:  'Encre de thé',
    brush_menso:    'Pinceau mensou',
    brush_kinboku:  "Encre d'or",
    brush_nijimi:   'Nijimi',
  },

  cosmeticDesc: {
    paper_washi:       'Papier artisanal ordinaire. Toutes les cartes commencent ici.',
    paper_torinoko:    'Grain lisse couleur coquille d’œuf, « l’enfant de l’oiseau » — le papier des copistes.',
    paper_kozo:        'Écorce de mûrier, fibres longues laissées apparentes. Assez solide pour traverser un siècle.',
    paper_unryu:       'Papier dragon-nuage : des volutes de fibre brute dérivent dans la feuille.',
    paper_aizome:      'Teint à l’indigo. Le bleu s’assombrit à chaque passage dans la cuve.',
    paper_momiji:      'Papier d’automne, moucheté des couleurs de l’érable qui tourne.',
    paper_sabi:        'Papier rouille. La patine que le fer gagne à rester dehors.',
    paper_suminagashi: 'Encre flottée : une goutte de sumi tournée sur l’eau, puis relevée en anneaux.',
    paper_yozora:      'Papier ciel de nuit, poudré d’étoiles d’argent.',
    paper_kinpaku:     'Feuille d’or battue, posée au centième d’épaisseur d’un cheveu.',

    ring_hosomichi: 'Le sentier étroit. Une ligne, rien d’autre.',
    ring_kumihimo:  'Cordon de soie tressée, celui qui referme un rouleau.',
    ring_enso:      'Le cercle zen, tracé d’un seul souffle et jamais repris.',
    ring_sakura:    'Une chaîne de pétales de cerisier, saisie en pleine chute.',
    ring_seigaiha:  'Vagues de l’océan bleu — le plus ancien motif répété du Japon.',
    ring_raijin:    'La grecque du tonnerre. Un orage rendu à angle droit.',
    ring_kinrin:    'Un anneau d’or massif.',
    ring_hinode:    'Le soleil levant, ses rayons encore en mouvement.',

    seal_shu:     'Pâte de cinabre au coin de chaque carte.',
    seal_sumi:    'Frappé à l’encre simple. Plus discret, et plus difficile à contester.',
    seal_hisui:   'Taillé dans le jade, cerclé de vert.',
    seal_koban:   'Ovale, comme l’ancienne pièce d’or dont il porte le nom.',
    seal_kin:     'Un sceau cerclé d’or, réservé à ce qui compte.',
    seal_tenkoku: 'Écriture sigillaire, gravée à la main. La plus ancienne façon de signer.',

    title_minarai:    'Celui qui regarde et apprend.',
    title_kakehashi:  'Un pont jeté entre deux langues.',
    title_idaten:     'Le dieu aux pieds rapides. Personne ne l’a jamais devancé.',
    title_fudo:       'Fudō Myōō, qui ne cille pas. Cinquante d’affilée, sans une faute.',
    title_hyakume:    'Cent yeux peints vous regardent depuis l’étagère.',
    title_nanakorobi: 'Tomber sept fois. Se relever huit.',
    title_tetsujin:   'Cinq mille révisions. Taillé dans le fer.',
    title_sennichi:   'Pour les moines qui parcourent la montagne mille jours sans s’arrêter.',
    title_kuramori:   'Vous avez rempli le grenier.',
    title_shishou:    'Celui qui enseigne. Premier dan.',
    title_shosei:     'Sage du pinceau — mille cartes menées jusqu’à la maîtrise.',
    title_meijin:     'Meijin. Le nom ne se donne qu’une fois par génération.',
    paper_sugihara:    "Fin, souple, à peine chaud. Le papier quotidien de la cour de Muromachi.",
    paper_ganpi:       "Le brillant. Presque translucide, avec un lustre qui court sur la feuille.",
    paper_chiyogami:   "Papier à motifs imprimé à la planche, celui des petites boîtes.",
    paper_danshi:      "Gaufré en fines crêtes. Réservé aux documents qui comptaient.",
    paper_sumizome:    "Teint à l'encre, couleur d'habit de deuil -- et des heures où vous l'avez gagné.",
    paper_rakusui:     "De l'eau versée sur la feuille qui s'égoutte, perçant une dentelle de trous.",
    ring_asanoha:  "Feuille de chanvre : l'étoile à six branches du premier kimono de chaque enfant.",
    ring_shippou:  "Les sept trésors -- des cercles entrelacés, sans fin.",
    ring_kikko:    "Carapace de tortue. Dure, hexagonale, lente.",
    ring_tomoe:    "Trois virgules qui se poursuivent, peintes sur tous les tambours de temple.",
    ring_gesshin:  "Un halo froid. Tourne deux fois plus lentement que le soleil.",
    seal_rakkan:  "Le sceau de signature au bout d'une calligraphie.",
    seal_yuin:    "Un sceau gravé par plaisir, non par autorité. Posé à l'angle où il est tombé.",
    seal_hyotan:  "En forme de calebasse, comme on taille ceux qui portent chance.",
    seal_hakubun: "En creux : les caractères sont évidés, ils s'impriment clairs sur fond plein.",
    seal_gyokuji: "Le sceau de jade de l'État. Carré, immobile, à double cadre.",
    title_hajime:    "Dans l'esprit du débutant les possibilités sont nombreuses ; dans celui de l'expert, rares.",
    title_akatsuki:  "Debout et au travail avant la lumière.",
    title_yonaga:    "La longue nuit appartient à qui veille encore.",
    title_hayate:    "Trois cents cartes avant que la journée s'en aperçoive.",
    title_muketsu:   "Cent d'affilée, aucune fausse.",
    title_kaigen:    "L'instant où l'on peint les yeux et où la figure s'anime.",
    title_tsuwamono: "Dix mille révisions. L'herbe d'été, où rêvaient les soldats.",
    title_musou:     "Deux cents jours sans rupture. Il n'y a pas de second.",
    title_daruma:    "Neuf ans face au mur. Huit de vos daruma ont leurs deux yeux.",
    backdrop_muji:      "Rien derrière vous. Chaque bureau commence ainsi.",
    backdrop_tatami:    "Nattes de jonc tressé, avec la couture tous les demi-tatami.",
    backdrop_shoji:     "Panneaux de papier dans un treillis de bois, éclairés de l'autre côté.",
    backdrop_kanoko:    "Tie-dye « faon ». Chaque point est un grain de riz noué dans l'étoffe.",
    backdrop_asagiri:   "La brume dans la vallée, avant que le jour ait décidé quoi que ce soit.",
    backdrop_hoshizora: "Un ciel fixe. Les mêmes étoiles chaque nuit -- c'est tout l'intérêt d'un ciel.",
    backdrop_sumie:     "Montagnes au lavis, en recul : la chaîne proche sombre, la lointaine à peine là.",
    backdrop_sakura:    "Une tempête de pétales, à l'angle où tombent les vrais.",
    backdrop_kasumi:    "Les bandes de nuages dorés qui barrent un paravent, cachant ce que le peintre a omis.",
    backdrop_kinbyobu:  "Feuille d'or posée carré par carré, joints visibles, comme toujours.",
    backdrop_amanogawa: "La rivière céleste, d'un coin à l'autre. Large de vingt mille révisions.",
    flourish_tsuke:    "Claquoirs de bois frappés sur une planche. Le style de la maison.",
    flourish_hanabi:   "Feux d'artifice sur la rivière, la seule semaine d'été où ils sont permis.",
    flourish_koban:    "Pièces d'or ovales, comme tombe une fortune dans les récits d'Edo.",
    flourish_sakura:   "Des pétales. Brefs, et meilleurs pour cela.",
    flourish_kaminari: "Pas décerné. Frappé.",
    flourish_kitsune:  "Feu de renard -- les lumières froides qui égarent les voyageurs la nuit.",
    flourish_matsuri:  "Toute la rue sort dans la rue.",
    flourish_ryu:      "La pluie, les fleuves et l'empereur. Il arrive en nuage.",
    flourish_hoo:      "Le phénix du toit du Byoudou-in. Il ne paraît que sous un règne qui le mérite.",
    brush_sumi:     "Encre de suie de pin sur la pierre. Ce avec quoi tout le monde apprend.",
    brush_shuboku:  "Le rouge dont un maître corrige.",
    brush_aiboku:   "Encre indigo, froide et un peu transparente.",
    brush_futofude: "Le gros pinceau, pour les grands caractères. Aucun tremblement ne s'y cache.",
    brush_chaboku:  "Encre brun thé, couleur de vieille lettre.",
    brush_menso:    "Le pinceau fin dont un peintre fait les visages. Deux poils de large.",
    brush_kinboku:  "Encre d'or, broyée à la vraie feuille. Pour les sûtras et pour la parade.",
    brush_nijimi:   "L'encre qui diffuse dans le papier humide. Chaque trait s'engage.",
  },
}

const storehouse = {
  // Le tiroir de changement rapide, accessible depuis chaque barre.
  quickChange:     'Changement rapide',
  quickChangeAll:  'Grenier',
  storehouseTitle:   'Grenier',
  storehouseDesc:    'Votre rang, et tout ce qui a été gagné en chemin',
  storehouseNote:    (n, total) => `${n} trésors sur ${total} récoltés`,
  storehouseOffline: 'Grenier injoignable — ces données peuvent être périmées.',

  masteryRank:     'Rang de maîtrise',
  cardsMastered:   'cartes maîtrisées',
  rankNext:        (label, left) => `Encore ${left} avant ${label}`,
  rankMax:         'Le sommet de l’échelle.',
  cosmeticsOwned:  'Collectés',
  cosmeticEquipped: 'Porté',
  cosmeticUnlocked: 'Le grenier s’ouvre',
}

// ── みどりの窓口 — onboarding ──────────────────────────────
const onboarding = {
  onbWelcomeTitle: 'Bienvenue à 日本語駅',
  onbWelcomeBody: 'Avant votre premier départ, le guichet prépare votre passe : votre niveau, votre rythme, et la carte du réseau. Deux minutes, pas plus.',
  onbWelcomeNameHint: 'Le nom sur votre passe — touchez-le pour le changer.',
  onbContinue: 'Continuer',
  onbStepsAria: (n, total) => `Étape ${n} sur ${total}`,
  // Une fonction, pas une chaîne : passer valide le niveau DÉJÀ choisi
  // (voir skip() dans OnboardingFlow), qui n'est N5 que par défaut.
  onbSkip: (level) => `Passer — commencer en ${level}`,
  onbSkipHint: 'Tout se règle plus tard dans les Réglages.',
  onbDocumentTitle: 'Guichet',
  onbLevelTitle: 'De quelle gare partez-vous ?',
  onbLevelNever: 'Je n’ai jamais étudié le japonais',
  onbLevelNeverHint: 'Départ en N5 — les kana d’abord.',
  onbLevelTest: 'Testez-moi',
  onbLevelTestHint: '12 questions, deux minutes, correction immédiate.',
  onbTestTitle: 'Le test de niveau',
  onbTestProgress: (n, total) => `${n} / ${total}`,
  onbTestKind: {
    reading: 'Comment se lit ce mot ?',
    orthography: 'Quelle est la bonne écriture en kanji ?',
    context: 'Quel mot complète la phrase ?',
    grammar: 'Quelle règle de grammaire est à l’œuvre ?',
  },
  onbTestStop: 'M’arrêter ici — placez-moi avec mes réponses',
  onbTestFinish: 'Voir le résultat',
  onbTestError: 'Le test n’a pas pu être chargé. Réessayez dans un instant.',
  onbTestRetake: 'Repasser le test',
  onbTestResultTitle: 'Votre gare de départ',
  onbTestResult: (level, correct, total) => `${correct} bonnes réponses sur ${total} — nous vous recommandons de partir de ${level}.`,
  onbTestOverrideHint: 'C’est une recommandation, pas un verdict — choisissez la gare qui vous ressemble.',
  onbPaceTitle: 'À quel rythme voyagez-vous ?',
  onbPaceRecommended: 'Recommandé',
  onbPaceLocal: 'Omnibus',
  onbPaceRapid: 'Rapide',
  onbPaceExpress: 'Express',
  onbPacePerDay: (n) => `${n} nouveautés / jour`,
  onbPaceHintLocal: 'Tranquille et durable — chaque gare, une à une.',
  onbPaceHintRapid: 'Le rythme régulier recommandé.',
  onbPaceHintExpress: 'Intense — pour un objectif proche.',
  onbMapTitle: 'Votre année à venir',
  onbMapTotal: (horizon) => `≈ ${horizon.toLocaleString('fr-FR')} éléments appris au fil des 12 prochains mois`,
  onbMapDeparting: (level) => `Départ de ${level}`,
  onbMapReached: (month) => `terminé vers ${month}`,
  onbMapKnown: (items) => `${items} éléments connus`,
  onbMapContinues: (items) => `la ligne continue — ≈ ${items} éléments d’ici un an`,
  onbMapNoMilestone: 'À ce rythme, le premier palier dépasse l’horizon d’un an — chaque jour compte quand même.',
  onbMapNow: 'Aujourd’hui',
  onbMapAssumption: 'Projection : nouveaux mots, kanji et points de grammaire uniquement, à rythme constant — les révisions s’y ajoutent.',
  onbMapUnavailable: 'La projection est indisponible pour l’instant — elle vous attend dans l’application.',
  onbTourTitle: 'Les lignes principales du réseau',
  onbTourTryIt: 'Essayez',
  onbTourTryAgain: 'Recommencer',
  onbTourTodayTitle: 'Le service du jour',
  onbTourTodayDesc: 'Vos révisions dues, toutes lignes confondues — voici votre tableau de progression.',
  onbTourVocabTitle: 'Le vocabulaire, carte par carte',
  onbTourVocabDesc: 'Touchez la carte ci-dessous pour la retourner — une vraie révision ressemble exactement à ça.',
  onbTourAnalyzerTitle: 'L’analyseur',
  onbTourAnalyzerDesc: 'Collez une phrase, une photo ou une vidéo : découpage, lectures, niveau. Parcourez celle-ci mot à mot.',
  onbTourExamsTitle: 'Les examens blancs',
  onbTourExamsDesc: 'Des épreuves au format JLPT, chronométrées et corrigées. Répondez à celle-ci.',
  onbPassTitle: 'Votre passe est prêt',
  onbPassBoard: 'Passer le portillon',
  onbPassError: 'L’enregistrement a échoué — vérifiez votre connexion et réessayez.',
  // Le rythme quotidien, vécu : la jauge 新規 du hall et le terminus
  // de session des écrans d'étude (voir components/study/usePace.js).
  paceDoneTitle: 'Objectif du jour atteint',
  paceDoneBody: (n, target) => `${n} nouveautés sur ${target} apprises aujourd’hui — la ligne continue en révision.`,
  paceExtraTrain: 'Continuer les nouveautés',
  paceGaugeLabel: 'Nouveautés',
  paceGaugeAria: (n, target) => `${n} nouveautés apprises sur ${target} aujourd’hui`,
  settingsLearning: 'Apprentissage',
  settingsJlptLevel: 'Niveau JLPT',
  settingsPace: 'Rythme quotidien',
  settingsRedoDesc: 'Recalibrez votre niveau quand vous avez progressé.',
  settingsRedoApply: (level) => `Adopter ${level} ?`,
  levelCurrentMark: 'Vous êtes ici',

  // ── 窓口 — les réglages au guichet ─────────────────────────
  // Les intitulés des guichets, puis la seconde voix de chaque
  // contrôle : ce que le bouton FAIT, en clair, sous son nom — sur un
  // écran de paramètres, rien ne doit se deviner.
  settingsEnvironment: 'Affichage & langue',
  // Le mot court que porte un onglet du rail ; le bordereau imprime
  // le titre complet.
  settingsEnvShort: 'Affichage',
  settingsData: 'Données',
  themeDark: 'Sombre',
  themeLight: 'Clair',
  themeAuto: 'Système',
  themeAutoHint: 'Suit le réglage de votre appareil',
  // Chaque bouton porte sa propre légende — pas de libellé de rangée.
  // Silencieux : ambiance, jingle, annonces ; les sons d'étude ne
  // bougent jamais.
  soundQuietPreset: 'ambiance coupée',
  soundFullPreset: 'gare complète',
  volumeMaster: 'Volume principal',
  settingsPerDay: '/ jour',
  settingsExport: 'Exporter votre progression',
  settingsExportHint: 'Un fichier CSV — chaque carte, son échéance, ses révisions.',
  settingsExportBtn: 'Exporter',
  settingsReset: 'Réinitialiser la progression',
  settingsResetHint: 'Efface toutes les révisions, vos XP et votre série. Vos paquets, votre niveau et vos réglages restent.',
  settingsResetBtn: 'Réinitialiser',
  settingsResetConfirmQ: 'Tout effacer ? Impossible à annuler.',
  settingsResetYes: 'Tout effacer',
  settingsResetDone: 'Progression réinitialisée. La carte repart de zéro.',
  settingsIssuedTo: 'Carte émise à',
}

export default {
  ...auth,
  ...landing,
  ...nav,
  ...home,
  ...quiz,
  ...stats,
  ...dictionary,
  ...comprehension,
  ...progress,
  ...misc,
  ...phraseAnalyzer,
  ...video,
  ...reading,
  ...readingComprehension,
  ...translationMode,
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
