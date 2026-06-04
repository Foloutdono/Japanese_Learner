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
  selectKanaSet:     'Choisissez un ensemble',
  selectLevel:       'Choisissez un niveau',
  selectPhase:       'Choisissez une phase',
  selectMode:        'Choisissez un mode',

  // Phases
  phase1:            'Phase 1',
  phase2:            'Phase 2',
  phase3:            'Phase 3',
  phase1Desc:        'Kanji + Kana → Sens',
  phase2Desc:        'Kanji → Sens',
  phase3Desc:        'Sens → Kanji (écriture)',

  // Input
  submit:            'Valider',
  typeAnswer:        'Tapez votre réponse...',
  typeRomaji:        'Tapez le romaji...',
  typeKana:          'Tapez la lecture en kana...',
  typeKanji:         'Tapez le kanji...',

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
  modeType:          'Écriture',
  modeFlashcard:     'Flashcard',
  modeFill:          'Compléter',

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
  statistics:        'Statistiques',
  resetStats:        '🗑 Tout réinitialiser',
  resetConfirm:      'Effacer TOUTE la progression ? Cette action est irréversible.',
  kana:              'Kana',
  jlptVocab:         'Vocabulaire JLPT',
  globalSummary:     'Résumé global',
  new:               'Nouveau',
  learning:          'En cours',
  mastered:          'Maîtrisé',
  dueNow:            '⚡ À réviser',
  total:             'Total',
}

// ── Dictionary ────────────────────────────────────────────
const dictionary = {
  dictionaryPlaceholder: 'Rechercher kanji, kana, ou sens...',
  noResults:         'Aucun résultat pour',
  reading:           'Lecture',
  meaning:           'Sens',
  level:             'Niveau',
  listen:            'Écouter',
  strokeOrderLabel:  'ORDRE DES TRAITS',
  loadingDictionary: 'Chargement...',
  loadingMore:       'Chargement...',
  displayedKanji:    'kanji affichés',
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
  ...decks,
}
