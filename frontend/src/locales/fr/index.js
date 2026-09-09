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
  usernameInvalid:   "Le nom d'utilisateur doit contenir 3 à 20 caractères (lettres, chiffres, underscore).",
  usernameTaken:     'Ce nom d\'utilisateur est déjà pris.',
}

// ── Landing screen ────────────────────────────────────────
// Shown to signed-out visitors before AuthScreen. landingCta is
// reused for both the hero button and the closing footer button
// rather than duplicated under a second key.
const landing = {
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
  waitingServer:     'Réveil du serveur…',
  errorTitle:        'Ça n’a pas fonctionné',
  errorHint:         'Vérifiez votre connexion — votre progression est en sécurité.',
  // ── Le chrome (plan 068) : les cinq portillons et le HUD ──
  tabLearn:          'Apprendre',
  tabPractice:       'Pratique',
  tabToday:          'Aujourd’hui',
  tabDictionary:     'Dictionnaire',
  tabProfile:        'Profil',
  tabBarLabel:       'Sections',
  practiceSub:       'Quatre quais',
  hudStatusLabel:    'État de l’objectif',
  hudOffline:        'Hors ligne',
  hudDays:           (n) => `${n}j`,
  hudStatus: {
    ahead:          'En avance',
    onTime:         'À l’heure',
    slightlyBehind: 'En retard',
    delayed:        'En retard',
    suspended:      'Suspendu',
  },
  // ── 回数券 — les crédits (plan 069) ──
  creditsUnit:       'crédits',
  balanceLabel:      'Solde',
  balanceTitle:      'Solde',
  balanceOf:         (cap) => `sur ${cap}`,
  balanceRefillAt:   (at) => `par jour, à ${at}`,
  balanceHolds:      (cap) => `jusqu’à ${cap}`,
  gateShort:         (rides, due) => `Seulement ${rides} sur les ${due} requis`,
  gateNoCredits:     (refill, at) => `Plus de crédits — +${refill} à ${at}`,
  runOutTitle:       'Plus de crédits',
  runOutCleared:     (n) => `${n} révisées`,
  runOutWaiting:     (n) => `${n} attendent demain`,
  runOutRefill:      'à minuit',
  runOutTomorrow:    'demain',
  fareReviews:       'révisions',
  fareFare:          'tarif',
  fareCreditsLeft:   'crédits restants',
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
  // identical in every language.
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
  todayLines:         'Lignes du jour',
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
  fareGate:           'Portique',
  dueUnit:            'à réviser',
  stageGate:          'Portique',
  nothingGraded:      'Rien n’est noté',
  learnFourLines:     'Quatre lignes',
  stationJlpt:        'JLPT',
  byFrequencyShort:   'Par fréquence',
  byThemeShort:       'Par thème',
  jlptInstead:        'Plutôt JLPT',
  leaveLevels:        'Niveaux',
  leaveSets:          'Séries',
  leaveTiers:         'Paliers',
  leaveThemes:        'Thèmes',
  leaveDecks:         'Decks',
  leaveDeck:          'Deck',
  // ── Pratique (plan 072) ──
  leaveSources:       'Sources',
  leaveExam:          'Examen',
  compBackToQuestions: 'Retour aux questions',
  practiceResult:     'Résultat',
  reference:          'Référence',
  // ── Dictionnaire et analyseur (plan 073) ──
  allReadings:        'Toutes les lectures',
  dictJMdict:         'JMdict',
  dictCollections:    'Collections',
  analyzerDoorSub:    'Texte, photo, vidéo',
  passagesCount: (n) => `${n} passage${n === 1 ? '' : 's'}`,
  sentencesCount: (n) => `${n} phrase${n === 1 ? '' : 's'}`,
  leaveAnalyzer:      'Analyseur',
  furiganaCap:        'Furigana',
  newDeck:            'Nouveau deck',
  cardsUnit: (n) => `${n} carte${n === 1 ? '' : 's'}`,
  // ── Profil, statistiques et réglages (plan 074) ──
  stampBook:          'Carnet de tampons',
  daysUnit:           'jours',
  balanceRefillLine:  (n, at) => `+${n} à ${at}`,
  perDayUnit:         '/ jour',
  statusLast14:       '14 derniers jours',
  statusPromised:     'Promis',
  statusAtThisPace:   'À ce rythme',
  statusOnThePass:    'Sur la carte',
  longestNote:        n => `record ${n}`,
  dueWeekNote:        n => `${n} cette semaine`,
  masteredNote:       (m, total) => `${m.toLocaleString('fr')} cartes sur ${total.toLocaleString('fr')}`,
  calWeeksCap:        w => `${w} semaines · record`,
  calFoot:            'Un carré par jour, plus foncé avec plus de révisions',
  forecastCap:        d => `${d} jours ·`,
  settingsGoalNoneShort: 'Aucune destination',
  soundPresets:       'Réglages rapides',
  soundValueQuiet:    'Gare silencieuse',
  soundValueFull:     'Gare animée',
  soundValueMixed:    'Personnalisé',
  soundQuietHint:     'ni ambiance ni jingles',
  soundFullHint:      'ambiance et annonces',
  soundMuteHint:      'tous les canaux',
  soundMixer:         'Table de mixage',
  levelName:          { N5: 'Débutant', N4: 'Élémentaire', N3: 'Intermédiaire', N2: 'Avancé', N1: 'Confirmé' },
  settingsLevelNote:  'Monter marque les arrêts derrière vous comme **connus**, répartis sur les semaines à venir. Descendre **n\'efface rien** — chaque révision est conservée.',
  settingsPaceCap:    'Nouveaux éléments par jour',
  settingsPaceCustom: n => `Votre rythme est réglé sur ${n} par jour.`,
  paceName:           { local: 'Omnibus', rapid: 'Rapide', express: 'Express' },
  settingsRedoHint:   'Un doute ? Repassez le test de placement. Dans tous les cas, rien n\'est perdu.',
  levelUpTitle:       l => `Monter à ${l} ?`,
  levelUpBody:        (to, weeks) => `Les arrêts avant ${to} sont marqués **connus** : leurs cartes démarrent maîtrisées, avec un premier contrôle réparti sur les ${weeks} prochaines semaines. Les cartes déjà en cours gardent leur place. **Rien n'est effacé.**`,
  levelDownTitle:     l => `Descendre à ${l} ?`,
  levelDownBody:      to => `Les cartes au-delà de ${to} sont mises de côté, pas effacées : elles gardent leur historique et reviennent dans le trajet quand vous remontez. Le trajet du jour se réduit aux arrêts ${to}.`,
  levelMarkedKnown:   'Marquées connues',
  levelSpreadOver:    'Réparties sur',
  levelWeeks:         n => `${n} semaines`,
  levelSetAside:      'Mises de côté',
  levelDeleted:       'Effacées',
  levelUpGo:          l => `Monter à ${l}`,
  levelDownGo:        l => `Descendre à ${l}`,
  levelStay:          l => `Rester à ${l}`,
  destOnPass:         'Sur la carte',
  destService:        'Service',
  destDailyRide:      'Trajet quotidien',
  destOptional:       'Facultatif',
  destHour:           { am: 'Matin', noon: 'Midi', pm: 'Soir' },
  destFlexible:       'Libre',
  destAnyTime:        'à tout moment',
  destValidUntil:     'Valable jusqu\'au',
  destMovesTo:        date => `glisse au ${date} au rythme actuel`,
  destReprint:        'Réimprimer',
  compNote: (you, right) => `Vous · ${you} — correct · ${right}`,
  examPart: (n) => `Partie ${n}`,
  kanaSetsSub:        (n) => `${n} séries`,
  serviceName: {
    local:   'Omnibus',
    rapid:   'Rapide',
    express: 'Express',
    ltd:     'Spécial',
    review:  'Révision',
  },
  decksRowMeta:       (decks, cards) => `${decks} deck${decks === 1 ? '' : 's'} · ${cards} carte${cards === 1 ? '' : 's'}`,
  deckMore:           'Plus',
  deleteDeck:         'Supprimer le deck',
  cardsCount:         n => `${n} carte${n === 1 ? '' : 's'}`,
  freqDomainDeck:     'Mots du JLPT',
  freqDomainJmdict:   'Hors-JLPT',
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
  sourceVideoHint:     'Un lien YouTube et ses sous-titres',
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
  intakeVideoLead:     'Collez le lien, puis le favori 字幕取り rapporte les sous-titres — ou déposez un fichier.',
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
  // Le talon et le rail de travail (la refonte « salle de contrôle »).
  // La navigation de cet écran parle la langue de l'apprenant ; le
  // japonais reste sur le contenu et les petits accents.
  reopenIntake:        'Ajouter un autre passage',
  searchPassage:       'Chercher dans le passage…',
  filterStops:         'Filtrer les phrases',
  filterAll:           'Toutes',
  filterKept:          'Gardées',
  filterHasNew:        'Avec mots nouveaux',
  stopsShown:          (n, total) => `${n} phrase${n > 1 ? 's' : ''} sur ${total} affichée${n > 1 ? 's' : ''}`,
  keepAllIPlusOne:     'Garder tous les i+1',
  // Les deux réglages de la scène : la vue des mots et les furigana.
  viewLabel:           'Vue',
  viewStepper:         'Un par un',
  viewTable:           'Tableau',
  tableWord:           'Mot',
  tableState:          'État',
  furiganaLabel:       'Furigana',
  furiganaAll:         'Tous',
  furiganaUnknown:     'Inconnus seulement',
  furiganaNone:        'Aucun',
  tokensCount:         n => `${n} mot${n > 1 ? 's' : ''}`,
  // La colonne « votre historique » des cartes du hall, et le lecteur.
  passagesCap:         'Passages',
  lastUsedCap:         'Dernière fois',
  playVideo:           'Lecture',
  pauseVideo:          'Pause',
  muteVideo:           'Couper le son de la vidéo',
  unmuteVideo:         'Rétablir le son de la vidéo',
  videoVolume:         'Volume',
  videoVolumePct:      pct => `${pct}%`,
  // Le plan du clavier sous la scène.
  kbdToken:            'mot',
  kbdSentence:         'phrase',
  kbdPlay:             'lecture',
  windowWhole:         'toute la vidéo',
  windowSpan:          m => `${m} sélectionnées`,
  windowBackwards:     'La fin doit venir après le début.',
  historyTitle:        'Historique',
  dateToday:           'aujourd’hui',
  dateYesterday:       'hier',
  dateDaysAgo:         n => `il y a ${n} jours`,
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
  videoUrlOptional:    'Lien de la vidéo',
  videoUrlOptionalHint: 'Affiche la vidéo à côté des sous-titres, ouvre la bonne page pour le favori et préremplit DownSub.',
  grabTitle:           'Les sous-titres en un geste',
  grabLead:            'Un favori spécial à installer une seule fois (une minute) : ensuite, sur n\'importe quelle vidéo YouTube, vous l\'ouvrez et les sous-titres japonais arrivent ici tout seuls — téléphone compris.',
  grabTutorialBtn:     'Tutoriel pas à pas',
  copyBookmarklet:     'Copier le favori 字幕取り',
  bookmarkletCopied:   'Copié ! Passez à l\'étape 2',
  downsubAlt:          'ou via DownSub',
  downsubHint:         'Télécharge un fichier .vtt à déposer ci-dessous — utile hors YouTube.',
  grabEmpty:           'Les sous-titres rapportés étaient vides — réessayez depuis la page de la vidéo.',
  // ── Le tutoriel du favori ──
  tutTitle:            'Installer le favori 字幕取り',
  tutWhat:             'Le principe : on va enregistrer une petite « adresse magique » comme favori dans votre navigateur. Ouvrir ce favori pendant que vous êtes sur une vidéo YouTube récupère ses sous-titres japonais et vous ramène ici, analyse lancée. Rien à installer, aucune extension, aucun compte.',
  tutStep1Title:       'Copiez l\'adresse du favori',
  tutStep1Body:        'Ce bouton met l\'adresse dans votre presse-papiers. Elle commence par « javascript: » — c\'est normal, c\'est elle qui fait tout le travail.',
  tutStep2Title:       'Créez le favori dans votre navigateur',
  tutStep2Body:        'Le geste dépend de l\'appareil — choisissez le vôtre :',
  tutDeviceLabel:      'Appareil',
  tutDeviceDesktop:    'Ordinateur',
  tutDesktop1:         'Affichez la barre de favoris : Ctrl+Maj+B (⌘+Maj+B sur Mac).',
  tutDesktop2:         'Clic droit sur la barre → « Ajouter une page… » (Chrome/Edge) ou « Nouveau marque-page… » (Firefox).',
  tutDesktop3:         'Nom : 字幕取り. Dans le champ URL, collez l\'adresse copiée, puis enregistrez.',
  tutAndroid1:         'Dans Chrome, sur n\'importe quelle page, touchez ⋮ puis l\'étoile ☆ : un favori se crée.',
  tutAndroid2:         'Rouvrez ⋮ → Favoris, faites un appui long sur ce nouveau favori → Modifier.',
  tutAndroid3:         'Nom : 字幕取り. Effacez l\'URL, collez l\'adresse copiée, enregistrez.',
  tutIphone1:          'Dans Safari, sur n\'importe quelle page, touchez Partager (le carré avec une flèche) → « Ajouter un signet » → Enregistrer.',
  tutIphone2:          'Ouvrez les Signets (l\'icône livre) → Modifier, puis touchez ce signet.',
  tutIphone3:          'Nom : 字幕取り. Remplacez l\'adresse par celle copiée, touchez OK.',
  tutStep3Title:       'Utilisez-le sur une vidéo',
  tutStep3a:           'Ouvrez la vidéo sur le site youtube.com, dans le navigateur — pas dans l\'application YouTube, qui ne connaît pas vos favoris',
  tutStep3b:           'Ordinateur : cliquez 字幕取り dans la barre de favoris. Téléphone : tapez 字幕取り dans la barre d\'adresse et touchez le favori proposé.',
  tutStep3c:           'La page revient ici toute seule et l\'analyse démarre avec les sous-titres japonais — la vidéo lisible à côté.',
  tutTroubleTitle:     'Si ça ne marche pas',
  tutTrouble1:         'Le favori explique lui-même : « No Japanese subtitles » veut dire que la vidéo n\'a pas de piste japonaise — il n\'y a rien à récupérer. « Page not ready » : rechargez la page de la vidéo et réessayez.',
  tutTrouble2:         'En dernier recours, le lien DownSub de cette page télécharge un fichier .vtt : déposez-le dans la zone 字幕 ci-dessous, le résultat est le même.',
  uploadSubtitles:     'Téléversez un fichier de sous-titres (.srt, .vtt, .ass)',
  openOnYoutube:       'Ouvrir sur YouTube',
  windowStart:         'Début (secondes)',
  windowEnd:           'Fin (secondes)',
  windowCapped:        'La fenêtre a été limitée à 5 minutes.',
  analyzingText:       'Lecture de votre texte…',
  analyzingPhoto:      'Lecture du texte de la photo…',
  analyzingVideo:      'Analyse des sous-titres…',
  captionsUnavailable: "Impossible de récupérer les sous-titres de cette vidéo.",
  subtitleTooLarge:    'Ce fichier de sous-titres est trop volumineux.',
  breakThisDown:       'Décomposer cette phrase',
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

  // Décomposition mot par mot + sa navigation (ReadingRun.jsx) —
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
// TranslationRun.jsx réutilise entièrement les clés existantes de
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
  allReadings:       'Toutes les lectures',
  readingsNoWords:   'Pas encore de mots d\'exemple',
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
  syllabaryVoiced:   'Sons voisés',
  syllabaryYoon:     'Sons contractés',
  syllabaryForeign:  'Sons étrangers',
  syllabaryLong:     'Voyelles longues',
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
  onyomi:  "音読み · on'yomi",
  readingsMore: (n) => `${n} lecture${n > 1 ? 's' : ''} de plus — la fiche du dictionnaire les donne toutes`,
  kunyomi: "訓読み · kun'yomi",
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
  chaseNext:         (xp, who) => `${xp} XP derrière ${who}`,
  // ── 定期入れ — le profil porte-carte ──
  retention:         'Rétention',
  daysStamped:       'Jours tamponnés',
  ranking:           'Classement',
  periodWeek:        'Cette semaine',
  periodAll:         'Cumul',
  east:              'Est',
  west:              'Ouest',
  passLabel:         "Carte d'abonnement",
  passSince:         'Membre depuis le niveau 1',
  noActivityWeek:    "Rien d'étudié cette semaine pour l'instant",
  profileTitle:      'Profil',
  profileStale:      "Impossible d'atteindre le serveur — affichage de vos dernières données connues.",
  leaderboard:       'Classement',
  done:              'Terminé',
  genericError:      'Une erreur est survenue. Réessayez.',

  // ── 定期券の裏 — le voyage au dos de la carte (plan 063) ──
  // Les mots de statut japonais (定刻, 遅延…) sont de la signalétique
  // et vivent dans le composant ; voici leurs légendes en clair et
  // les phrases honnêtes à côté du tracé.
  jourStatus: {
    suspended:      'Interrompu',
    ahead:          'En avance',
    onTime:         "À l'heure",
    slightlyBehind: 'Léger retard',
    delayed:        'En retard',
  },
  jourYou:           'VOUS',
  jourPlan:          'PLAN',
  jourYourLine:      'Votre ligne',
  jourTurnOver:      'Retourner',
  jourDays:          (n) => `${n} jours`,
  jourFootOnTime:    (a, p, dest, date) =>
    `**${a} par jour**, pile sur les **${p}** promis. L'arrivée à ${dest} tient au **${date}**.`,
  jourFootAhead:     (a, p, dest, days, date) =>
    `**${a} par jour** contre **${p}** promis — ${dest} arrive **${days} jours en avance**, vers le **${date}**.`,
  jourFootBehind:    (a, p, dest, date, days) =>
    `14 derniers jours : **${a} par jour** contre **${p}** promis. À ce rythme, ${dest} arrive le **${date}** — **${days} jours** après la date de votre carte.`,
  jourFootSuspended: (date) =>
    `Aucune étude en 14 jours. Le **${date}** de votre carte ne veut plus rien dire — reprenez, ou réimprimez-la avec une date qui compte.`,
  jourFootPaceKept:  (a, p) =>
    `14 derniers jours : **${a} par jour** contre **${p}** promis. Pas d'arrivée fixée — le rythme est toute la promesse.`,
  jourFootPaceSuspended: (p) =>
    `Aucune étude en 14 jours contre une promesse de **${p} par jour**. La ligne attend — le portillon s'ouvre avec une seule carte.`,
  jourNoDest:        'Aucune destination sur cette carte.',
  jourNoDestLink:    'En choisir une au guichet',
  jourActRecover:    (pace) => `Rouler à ${pace} par jour`,
  jourActRecoverSub: (date) => `garde le ${date}`,
  jourActReprint:    (date) => `Réimprimer — arriver le ${date}`,
  jourActReprintSub: (a) => `à ${a} par jour ; la date bouge, à l'encre`,
  jourActResume:     'Reprendre la ligne',
  jourActResumeSub:  "le portillon s'ouvre avec une seule carte",
  jourActSlow:       (pace) => `Réimprimer à ${pace} par jour`,
  jourActSlowSub:    (date) => `une promesse plus lente vaut mieux qu'une promesse rompue — arriver le ${date}`,
  jourReprintError:  'Réimpression impossible — réessayez.',

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
  // Un invité n'a pas de clé : se déconnecter efface le trajet pour
  // de bon. La ligne le dit, plutôt que de le laisser découvrir.
  signOutGuestDesc:  'Sans compte, votre progression ne vit que sur cet appareil : vous déconnecter l\u2019effacera définitivement.',
  guestLabel:        'Compte invité',
  guestCap:          'Aucune adresse',
  guestClaimDesc:    'Votre progression est déjà là. Ajoutez une adresse et un mot de passe pour la garder — rien n\u2019est déplacé, c\u2019est le même compte.',
  guestClaimConfirm: 'Presque : confirmez l\u2019adresse depuis le lien que nous venons de vous envoyer.',
  guestClaimDone:    'Compte créé. Votre progression est gardée.',

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
  examAudioUnavailable: "Extrait audio impossible à charger pour cette question.",

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

// ── みどりの窓口 — onboarding ──────────────────────────────
// ── 乗車 — l’embarquement (plan 075) ────────────────────────
// L’embarquement de la maquette : Bienvenue → le nom → le pourquoi →
// les kana → (la révélation | le niveau) → l’objectif → le rythme →
// l’heure → le rappel → la préparation → le plan → la carte.
// L’interface parle la langue de l’apprenant ; les kana, les cartes et
// le sceau sont du contenu et restent en japonais
// (components/boarding/*, screens/BoardingFlow.jsx).
const boarding = {
  authFoot: 'Tout peut être modifié plus tard dans les réglages.',
  authModeAria: 'Connexion ou inscription',
  brdDocumentTitle: 'Embarquement',
  // Bienvenue : l’enseigne, le matériel roulant, la promesse.
  // Pas « Prenez le train vers la maîtrise » : c’est le calque de
  // l’anglais et il sonne faux — on prend le train POUR une gare, pas
  // « vers » une qualité abstraite. « En route vers… » est la tournure
  // que le français a déjà pour ça, et elle enchaîne sur Embarquer.
  brdTagline: 'En route vers la maîtrise.',
  brdBoard: 'Embarquer',
  brdHaveAccount: 'Déjà un compte ? Se connecter',
  // Google : « continuer », jamais « s'inscrire » ni « se connecter »
  // — un fournisseur ne distingue pas les deux, on arrive, c'est tout.
  continueWithGoogle: 'Continuer avec Google',
  orWithEmail: 'ou avec une adresse e-mail',
  // 改札 — un aller-retour revenu refusé (lib/authRedirect.js). Les
  // deux nomment ce qui s'est passé plutôt qu'« une erreur est
  // survenue » : sur le web, on les lit dans l'URL une fois la page
  // revenue de Google, et qui vient de faire ce trajet mérite la
  // raison, pas un haussement d'épaules.
  oauthAlreadyLinked: 'Ce compte Google appartient déjà à une autre carte.',
  oauthSignInInstead: 'Se connecter avec ce compte Google',
  oauthLinkingOff: 'Google ne peut pas être ajouté à cette carte pour le moment. Une adresse e-mail, si.',
  // Dernier arrêt : le compte, proposé une fois tout vu — et
  // refusable. « Garder » plutôt que « créer » : la progression
  // existe déjà, on ne fait qu'y mettre une clé (lib/guest.js).
  brdAccountQ: 'Gardez votre progression.',
  brdAccountHint: 'Votre parcours est déjà enregistré. Un compte vous permet de le retrouver sur un autre appareil — et de ne pas le perdre en changeant de téléphone.',
  brdAccountCreate: 'Créer mon compte',
  brdAccountSkip: 'Continuer sans compte',
  brdDemoTag: { kanji: 'Kanji', vocab: 'Vocabulaire', grammar: 'Grammaire', listening: 'Écoute', reading: 'Lecture', kana: 'Kana', exam: 'Examen blanc' },
  brdDemoMeaning: { station: 'gare', toEat: 'manger', fillIn: 'À compléter', craft: 'métier', listen: 'Écoutez', readIt: 'Lisez', ticket: 'billet', mountain: 'montagne', kippu: 'ki · p · pu', timer: '24:18' },
  brdDemoFoot: { kanjiMeaning: 'Kanji → sens', wordMeaning: 'Mot → sens', ruleSentence: 'Règle → phrase', meaningKanji: 'Sens → kanji', soundMeaning: 'Son → sens', sentenceMeaning: 'Phrase → sens', kanjiReading: 'Kanji → lecture', kanaSound: 'Kana → son', timedPaper: 'Épreuve chronométrée' },
  // Les questions.
  brdNameQ: 'Comment vous appelez-vous ?',
  brdNameAria: 'Votre nom',
  brdWhyQ: (name) => `Pourquoi apprenez-vous le japonais, **${name}** ?`,
  brdMotive: { studies: 'Pour mes études', fun: 'Pour le plaisir', trip: 'Pour un voyage au Japon', live: 'Pour vivre au Japon', friends: 'Pour me faire des amis', other: 'Autre chose' },
  brdKanaQ: 'Pouvez-vous lire ceci ?',
  brdKana: { hiragana: 'Hiragana', katakana: 'Katakana', both: 'Les deux', none: 'Pas encore' },
  brdKanaWord: { sushi: 'sushi', hotel: 'hôtel' },
  brdRevealQ: 'Bientôt, vous lirez les deux.',
  brdRevealHint: 'Deux écritures, 46 signes chacune. Votre premier arrêt.',
  brdLevelQ: 'Bien ! Quel est votre niveau ?',
  brdLevelHint: 'Les arrêts derrière vous seront marqués connus.',
  brdNovice: 'Novice',
  // Le nombre de kanji est celui de l’appli jusqu’à cet arrêt (~, arrondi).
  brdLevelDesc: {
    novice: 'Les kana et quelques mots',
    N5: (k) => `Phrases simples · ~${k} kanji`,
    N4: (k) => `Conversation courante · ~${k} kanji`,
    N3: (k) => `Le quotidien sans effort · ~${k} kanji`,
    N2: (k) => `Presse et travail · ~${k} kanji`,
    N1: (k) => `Presque tout · ~${k} kanji`,
  },
  brdGoalQ: 'Quel est votre objectif ?',
  brdGoalHint: (level) => `Les arrêts après ${level}.`,
  brdNextStop: 'Prochain arrêt',
  brdRhythmQ: 'Quel est votre rythme ?',
  brdMinADay: 'min par jour',
  brdNewItems: (n) => `~${n} nouveautés`,
  brdChangeLater: 'Modifiable plus tard.',
  brdTimeQ: 'Quand étudiez-vous ?',
  brdDeparture: 'Départ',
  brdDayAria: 'Heure de départ',
  // Le rappel (natif seulement), et la notification telle que l’appli
  // l’envoie. brdAppName est le nom sur les stores : au propriétaire
  // de le fixer (plan 077).
  brdNudgeQ: (time) => `Un rappel à **${time}** ?`,
  brdAppName: 'Japanese Learner',
  brdNotifNow: 'maintenant',
  brdNotifTitle: (time) => `Votre train part à ${time}`,
  brdNotifText: 'Vos cartes vous attendent au portillon.',
  brdNudgeHint: 'Un par jour, à votre heure. Jamais plus.',
  brdAllow: 'Autoriser les notifications',
  brdNotNow: 'Pas maintenant',
  // L’arrivée : la préparation, le plan, la carte.
  brdBuildingQ: (name) => `Préparation de votre trajet, **${name}**`,
  brdBuildingAria: 'Préparation de votre trajet',
  brdBuildGoal: 'Votre objectif',
  brdBuildLines: 'Vos lignes',
  brdBuildRide: 'Votre trajet quotidien',
  brdBuildProjection: 'Votre projection',
  brdFourLines: 'Quatre lignes',
  brdArrivalTitle: 'Votre plan',
  brdPlanQ: (name) => `Votre plan est prêt, **${name}**.`,
  brdChartTitle: 'Votre projection',
  brdChartAria: (words) => `Mots retenus au fil du trajet : les révisions quotidiennes montent à environ ${words} ; le bachotage plafonne tôt.`,
  brdChartLabel: (words) => `~${words} mots · révisions quotidiennes`,
  brdChartCram: 'bachotage',
  brdLegendUs: (min) => `Révisions quotidiennes, ${min} min`,
  brdLegendThem: 'Bachotage',
  brdChartCap: 'Révisions espacées contre bachotage — une illustration, pas une mesure.',
  brdLead: (min, date, purpose) => `À **${min} min par jour**, d’ici **${date}**, ${purpose} :`,
  brdFor: { studies: 'pour vos études', fun: 'pour le plaisir', trip: 'pour votre voyage', live: 'pour votre vie au Japon', friends: 'pour vos amis', other: 'pour vous' },
  brdBulletFigures: (words, kanji) => `~${words} mots et ~${kanji} kanji`,
  // Deux promesses par motif (la note « boarding » de la maquette).
  brdPromise: {
    studies: ['Vos supports de cours', 'Les termes clés d’un cours'],
    fun: ['Des cases de manga, des paroles', 'Un drama sans pause'],
    trip: ['Lire les panneaux, les menus, les billets', 'Demander son chemin, commander, réserver une chambre'],
    live: ['La mairie, la banque, le médecin', 'Votre courrier et vos contrats'],
    friends: ['Discuter par message', 'Une conversation au dîner'],
    other: ['Lire ce que vous croisez chaque jour', 'Dire ce que vous voulez dire'],
  },
  brdOnTrack: (level) => `En route vers le JLPT ${level}`,
  brdOnTrackLine: 'En route sur toute la ligne',
  brdPassQ: (name) => `Votre carte est prête, **${name}**.`,
  brdEnjoy: 'Bon voyage.',
  brdCreditsGift: (n) => `+${n} crédits offerts`,
  brdEnter: 'Entrer en gare',
}

const onboarding = {
  durDays: (n) => `${n} jours`,
  durMonths: (n) => `${n} mois`,
  durYears: (n) => `${n} ans`,
  onbContinue: 'Continuer',
  onbStepsAria: (n, total) => `Étape ${n} sur ${total}`,
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
  onbTestResult: (level, correct, total) => `${correct} bonnes réponses sur ${total} — nous vous recommandons de partir de ${level}.`,
  onbPaceRecommended: 'Recommandé',
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
  // ── Quelle barre de notation ────────────────────────────────
  // Deux boutons, quatre ou six. Les trois envoient la même note au
  // planificateur — chaque barre plus courte est une plus longue sans
  // certains boutons — donc ceci change ce qui vous est proposé,
  // jamais le sens de vos réponses.
  settingsRatingScale: 'Boutons de notation',
  settingsRatingScaleHint: 'Toutes notent de la même façon. Une barre plus courte retire simplement les boutons que vous n’utilisez jamais.',
  settingsRatingScaleOption: { binary: '2 niveaux', simple: '4 niveaux', full: '6 niveaux' },
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
  settingsDeleteAccount: 'Supprimer votre compte',
  settingsDeleteAccountHint: 'Efface tout — chaque révision, paquet, carte, réglage et votre identifiant de connexion. Exportez d\'abord si vous voulez garder une copie.',
  settingsDeleteAccountBtn: 'Supprimer',
  settingsDeleteAccountConfirmQ: 'Supprimer votre compte et tout ce qu\'il contient ? Impossible à annuler.',
  settingsDeleteAccountYes: 'Supprimer mon compte',
  settingsDeleteAccountFailed: 'La suppression n\'a pas pu aboutir. Réessayez.',
  privacyPolicy: 'Politique de confidentialité',
  // ── L'application installée (plan 065) ──
  pwaUpdateReady: 'Un nouvel horaire est en vigueur.',
  pwaUpdateBtn: 'Recharger',
  pwaUpdateLater: 'Plus tard',
  offlineLine: 'Pas de connexion — la gare est fermée pour le moment.',
  installApp: 'Installer l\'application',
  installAppHint: 'Sur votre écran d\'accueil, en plein écran, avec l\'audio des kanas gardé hors ligne.',
  installAppBtn: 'Installer',
  installIosTitle: 'Ajouter à l\'écran d\'accueil',
  installIosStep1: 'Touchez Partager dans la barre de Safari.',
  installIosStep2: 'Choisissez « Sur l\'écran d\'accueil », puis Ajouter.',
  installIosBody: 'Sur iPhone et iPad, une application web s\'installe depuis la feuille de partage de Safari — il n\'y a pas de bouton pour ça.',
  settingsIssuedTo: 'Carte émise à',

  // ── 行先 — le guichet des destinations ─────────────────────
  // Les mots du guichet, réemployés là où le guichet n'est pas : le
  // comptoir reprend le tableau des départs tel quel, il ne lui reste
  // donc que les phrases que le tableau ne sait pas dessiner — ce que
  // fait un bouton, et ce qu'il coûte.
  settingsGoal: 'Destination',
  settingsGoalNoneDesc: "Aucune destination sur cette carte. Vous roulez sur la ligne ouverte — la carte compte quand même les points, au seul rythme.",
  settingsGoalChangeDesc: 'Réimprimer la carte avec une autre destination, une autre date ou un autre service.',
  settingsGoalSet: 'Choisir une destination',
  settingsGoalChange: 'Modifier',
  settingsGoalTerminus: "Vous montez à N1 — le terminus. Aucune gare plus loin à promettre.",
  settingsGoalIssue: 'Émettre',
  settingsGoalIssueHint: (dest, date, perDay) =>
    `Imprime ${dest} pour le ${date}, et fixe votre rythme à ${perDay} par jour. La date part d'aujourd'hui : la promesse commence aujourd'hui.`,
  settingsGoalPickHint: 'Choisissez une destination, le tableau en donne le prix — ou continuez sur la ligne ouverte.',
  settingsGoalDrop: 'Rendre le billet',
  settingsGoalDropHint: "Rend la destination. Votre rythme et votre horaire restent, et la carte ne juge plus que le rythme — vous pourrez reprendre une destination quand vous voudrez.",
  settingsGoalIssued: 'Carte émise. Votre ligne est au dos.',
  settingsGoalDropped: 'Destination rendue. La ligne continue sans elle.',
  settingsGoalDepartHint: "L'heure à laquelle vous comptez rouler — facultative, et jamais un rappel. Elle est imprimée sur la carte parce qu'une promesse avec une heure survit mieux à sa première semaine de pluie.",
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
  ...onboarding,
  ...boarding,
}
