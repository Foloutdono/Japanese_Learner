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
  switchLang:        'Changer la langue',
}

// ── Navigation ────────────────────────────────────────────
const nav = {
  menu:              '← Menu',
  back:              '← Retour',
  cancel:            'Annuler',
  save:              '✓ Enregistrer',
  delete:            '🗑 Supprimer',
  edit:              '✏️ Modifier',
  close:             'Fermer',
  loading:           'Chargement...',
  import:            '📥 Importer',
  select:            '☑ Sélectionner',
}

// ── Home screen ───────────────────────────────────────────
const home = {
  tip:               '💡 Des sessions courtes (15-20 min) mais régulières — la SRS gère tout automatiquement.',
  start:             'Commencer →',
  kanaTitle:         'Kana',
  kanaDesc:          'Hiragana & Katakana\nde base + combinaisons\nQCM puis écriture libre',
  vocabTitle:        'Vocabulaire JLPT',
  vocabDesc:         'N5 → N1\nKanji + Kana → Sens\nProgression par phases',
  kanjiTitle:        'Kanji',
  kanjiDesc:         'Apprentissage des kanji\nN5 → N1\nExercices d\'écriture',
  dictionaryTitle:   'Dictionnaire',
  dictionaryDesc:    'Tous les kanji\nPrononciation & sens\nOrdre des traits',
  grammarTitle:      'Grammaire',
  grammarDesc:       'Règles JLPT N5 → N1\nFlashcard, QCM\nExemples de phrases',
  statsTitle:        'Statistiques',
  statsDesc:         'Progression SRS\nCartes maîtrisées\nRévisions dues',
  decksTitle:        'Mes Decks',
  decksDesc:         'Cartes personnalisées\nFlashcards & Kanji\nMélange avec JLPT',
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

  // Input
  submit:            'Valider',
  typeRomaji:        'Tapez le romaji...',

  // Feedback
  correct:           '✅ Correct !',
  wrong:             '❌ Réponse :',
  quizComplete:      '✅ Toutes les cartes sont à jour !',
  backToMenu:        '← Retour',

  // Rating bar
  rateAnswer:        'Évaluez votre réponse — touches',
  to:                'à',
  perfect:           'Parfait',
  correctHesit:      'Correct',
  difficult:         'Difficile',
  wrongSeen:         'Raté (vu)',
  wrongRated:        'Raté',
  blackout:          'Blackout',

  // Mode labels
  modeQCM:           'QCM',
  modeFlashcard:     'Flashcard',
  modeFill:          'Compléter',
  // Extended mode labels used by vocab/kanji screens
  modeWrite:         'Écriture',
  modeWriteDesc:     'Voir le sens, écrire le kanji',
  modeQcmKjM:        'QCM (kanji → sens)',
  modeQcmKjMDesc:    'Le kanji est affiché, choisissez le sens',
  modeQcmMKj:        'QCM (sens → kanji)',
  modeQcmMKjDesc:    'Le sens est affiché, choisissez le kanji',
  modeFcKjM:         'Carte (kanji → sens)',
  modeFcKjMDesc:     'Le kanji est affiché, révélez le sens',
  modeFcMKj:         'Carte (sens → kanji)',
  modeFcMKjDesc:     'Le sens est affiché, révélez le kanji',

  // Writing practice
  writingPractice:   '✏️ Entraînez-vous à écrire ce kanji',
  writingOn:         'Écriture ON',
  writingOff:        'Écriture OFF',
  toggleWriting:     'Activer/désactiver l\'écriture',
  yourDrawing:       'Votre dessin',
  strokeOrder:       'Ordre des traits',
  continueBtn:       "✓ C'est bon, continuer",
  eraseBtn:          '↺ Effacer',

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
  showExamples:      '▼ Voir les exemples',
  hideExamples:      '▲ Masquer les exemples',
}

// ── Stats ─────────────────────────────────────────────────
const stats = {
  statistics:         'Statistiques',
  resetStats:         '🗑 Tout réinitialiser',
  resetConfirm:       'Effacer TOUTE la progression ? Cette action est irréversible.',
  kana:               'Kana',
  jlptVocab:          'Vocabulaire JLPT',
  globalSummary:      'Résumé global',
  new:                'Nouveau',
  learning:           'En cours',
  mastered:           'Maîtrisé',
  dueNow:             '⚡ À réviser',
  total:              'Total',
  overview:           'Aperçu',
  streak:             'Série',
  longestStreak:      'Meilleure série',
  accuracy:           'Précision',
  dueToday:           'À réviser aujourd\'hui',
  upcomingReviews:    'Prochaines révisions',
  weakestItems:       'Besoin de pratique',
  lapses:             'Ratés',
  reviewNow:          'Réviser maintenant',
}

// ── Phrases analyser ────────────────────────────────────────────
const phraseAnalyzer = {
  phraseAnalyzerTitle: 'Analyseur de phrases',
  phraseAnalyzerDesc:  'Analysez une phrase japonaise\nObtenez définitions & statistiques',
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
  
}

// ── Reading ───────────────────────────────────────────────
const reading = {
  readingTitle:         'Entraînement à la lecture',
  readingDesc:          'Phrases courtes\nJLPT N5 → N1\nHiragana, Katakana, Kanji',
  readingHiragana:      'Hiragana uniquement',
  readingHiraganaDesc:  'Phrases écrites uniquement en hiragana',
  readingKatakana:      'Katakana uniquement',
  readingKatakanaDesc:  'Phrases écrites uniquement en katakana',
  readingMixed:         'Tout',
  readingMixedDesc:     'Japonais naturel avec kanji et kana',
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
}

// ── Reading comprehension ────────────────────────────────────────────
const readingComprehension = {
  readingComprehensionTitle: 'Compréhension lecture',
  readingComprehensionDesc:  'Court passages\nJLPT N5 → N1\nQuestions à choix multiples',
  readingComprehensionFetchError: "Impossible de charger un passage. Veuillez réessayer.",
  question:                   'Question',
  yourAnswer:                 'Votre réponse',
  gradeCorrect:               'J\'ai eu juste',
  gradeIncorrect:             'Je n\'ai pas eu juste',
  questionTypeComprehension: "Compréhension",
  questionTypeVocabulary: "Vocabulaire",
  questionTypeGrammar: "Grammaire",
  questionTypeInference: "Inférence",
}

// ── Dictionary ────────────────────────────────────────────
const dictionary = {
  dictionaryPlaceholder: 'Rechercher kanji, kana, ou sens...',
  noResults:         'Aucun résultat pour',
  reading:           'Lecture',
  meaning:           'Sens',
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
  dictBackToRadicals:'← Retour aux radicaux',
  dictModeSearch:    'Recherche',
  dictModeRadical:   'Radical',
  dictionaryPlaceholderRadical: 'Filtrer ces résultats par radical...',
  dictionaryResults: '{n} résultats',
  dictRadicalNumber: (n) => `radical #${n}`,
  dictStrokesPlural: 'traits',
  dictStrokeSingular: 'trait',
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
  retry:     'Réessayer',
}

// ── Decks ─────────────────────────────────────────────────
const decks = {
  decks:             'Mes Decks',
  createDeck:        'Créer un deck',
  deckNamePlaceholder: 'Nom du deck...',
  noDecks:           'Aucun deck pour l\'instant.',
  createFirstDeck:   'Créez votre premier deck ci-dessus.',
  study:             '▶ Étudier',
  addCard:           '+ Ajouter',
  newCard:           'Nouvelle carte',
  editCard:          'Modifier la carte',
  noCards:           'Aucune carte dans ce deck.',
  addFirstCard:      'Ajoutez votre première carte ci-dessus.',
  frontPlaceholder:  'Recto',
  backPlaceholder:   'Verso / Sens',
  hintPlaceholder:   'Indice (optionnel)',
  notesPlaceholder:  'Notes (optionnel)',

  // Deck types
  flashcardType:     'Flashcard',
  flashcardDesc:     'Recto / Verso — toute langue',
  vocabType:         'Vocabulaire',
  vocabDesc:         'Compatible avec le mode JLPT',
  kanjiType:         'Kanji',
  kanjiDesc:         'Avec ordre des traits',

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
  importing:         '⏳ Importation...',
  cards:             'cartes',
  andMore:           '... et {n} autres',

  // Study screen
  studyMode:         "Mode d'étude",
  mixWithJLPT:       'Mélanger avec les listes JLPT',
  startSession:      '▶ Commencer',
  writePractice:     'Entraînement à l\'écriture',
  revealAnswer:      'Afficher la réponse',
  typeAnswer:        'Tapez votre réponse...',
}

export default {
  ...auth,
  ...nav,
  ...home,
  ...quiz,
  ...stats,
  ...dictionary,
  ...comprehension,
  ...progress,
  ...misc,
  ...phraseAnalyzer,
  ...reading,
  ...readingComprehension,
  ...decks,
}
