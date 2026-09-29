import { welded } from '../frenchSpacing.js'

// ── App / Auth ────────────────────────────────────────────
const auth = {
  appTitle:          '辻',
  learnJapanese:     'Apprendre le japonais',
  appDesc:           'Répétition espacée (SM-2) · Hiragana · Katakana · Vocabulaire JLPT',
  login:             'Connexion',
  signup:            "S'inscrire",
  email:             'E-mail',
  password:          'Mot de passe',
  loginBtn:          'Se connecter',
  signupBtn:         "S'inscrire",
  signupSuccess:     'Vérifie ta boîte mail pour confirmer ton compte.',
  signOut:           'Déconnexion',
  usernameInvalid:   "Le nom d'utilisateur doit contenir 3 à 20 caractères (lettres, chiffres, tiret bas).",
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
  loading:           'Chargement…',
  waitingServer:     'Réveil du serveur…',
  errorTitle:        'Ça n’a pas fonctionné',
  errorHint:         'Vérifie ta connexion — ta progression est en sécurité.',
  // ── Le chrome (plan 068) : les cinq portillons et le HUD ──
  tabLearn:          'Apprendre',
  tabPractice:       'Pratique',
  tabToday:          'Aujourd’hui',
  tabDictionary:     'Dictionnaire',
  tabProfile:        'Profil',
  tabBarLabel:       'Sections',
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
  balanceRefillEvery: (min) => `toutes les ${min} min`,
  balanceNext:       (at) => `prochain à ${at}`,
  balanceHolds:      (cap) => `jusqu’à ${cap}`,
  balanceKanaFree:   'Les révisions de kana ne coûtent rien',
  gateShort:         (rides, due) => `Seulement ${rides} sur ${due} peuvent embarquer`,
  gateNoCredits:     (at) => (at ? `Plus de crédits — +1 à ${at}` : 'Plus de crédits'),
  runOutTitle:       'Plus de crédits',
  runOutCleared:     (n) => `${n} révisées`,
  runOutWaiting:     (n) => `${n} attendent la recharge`,
  runOutWaits:       'en attente',
  // 補充 — ce que la recharge a versé, app fermée (plan 141)
  claimTitle:        'Pendant ton absence',
  claimButton:       'Récupérer',
  claimBookLabel:    (n, cap) => `${n} crédits sur ${cap}`,
  // 無料 — a lane that costs nothing (domain/credits.js).
  freeFare:          'gratuit',
  laneNew:           n => `${n} nouv.`,
  // 区間 — the desk gate's run length and fare foot (plan 135)
  gateTake:          'Longueur du trajet',
  gateTakeAll:       n => `Tout · ${n}`,
  gateTakeOf:        n => `sur ${n}`,
  gateModes:         'Cartes à embarquer',
  gateModesAll:      n => `Tous les modes · ${n}`,
  gateModesMain:     n => `Principales · ${n}`,
  gateWhich:         'Quelles cartes',
  gateHowMany:       'Combien',
  gateServices:      'Choisir les services',
  gateServicesOf:    (on, all) => `${on} sur ${all}`,
  gateServicesTitle: 'Services du jour',
  gateMinutes:       'min',
  gateMinutesLabel:  n => `environ ${n} minutes`,
  gateRides:         'embarquent',
  gateWaits:         (at) => (at ? `attendent · +1 à ${at}` : 'attendent'),
  gateBalance:       'crédits',
  laneWaits:         at => `attend ${at}`,
  weekAhead:         'Les sept prochains jours',
  weekLeft:          'Laissées pour demain',
  gateRidesFree:     'embarquent · gratuit',
  fareReviews:       'révisions',
  fareFare:          'tarif',
  fareCreditsLeft:   'crédits restants',
  // ── 定期券 — le pass, montré avant d'être vendu (domain/paywall.js) ──
  paywallTitle:       '定期券',
  paywallLede:        'Réviser sans compter, et de la place pour tout garder.',
  paywallBenefit_reviews: 'Révisions',
  paywallBenefit_decks:   'Decks',
  paywallBenefit_cards:   'Cartes',
  paywallPerDay:      (n) => `${n} / jour`,
  paywallCta:         'Préviens-moi',
  paywallThanks:      'C’est noté — on te prévient au lancement.',
  paywallSoon:        'Le pass n’est pas encore en vente.',
  paywallNotNow:      'Plus tard',
  paywallOpen:        'Découvrir le pass',
  paywallRowValue:    'Bientôt',
  import:            'Importer',
  export:            'Exporter',
  exportFailed:      'L’export a échoué',
  select:            'Sélectionner',
}

// ── Home screen ───────────────────────────────────────────
const home = {
  // ── 辻駅 — la gare ───────────────────────────────────────
  // L'accueil est le hall de la gare et chaque section une ligne avec
  // sa plaque derrière un portillon (voir config/stations.js et
  // components/station/LinePlate.jsx). Les noms
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
  tip:               'Des sessions courtes (15–20 min) mais régulières — le planificateur fait le reste.',
  homeFeedDown:      'Les données du jour n’ont pas pu être chargées — appuie pour réessayer.',
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
  dictionaryDesc:    'Un kanji, un kana, n\'importe quel mot\nLectures, radicaux, ordre des traits, exemples\nEt si tu l\'as déjà croisé',
  grammarTitle:      'Grammaire',
  grammarDesc:       'Tous les points JLPT, de N5 à N1\nCe à quoi il s\'accroche et ce qu\'il fait\nAvec des phrases qui l\'emploient vraiment',
  statsTitle:        'Statistiques',
  statsDesc:         'Est-ce que ça tient, semaine après semaine\nL\'avance de chaque carte\nEt où ça fuit',
  decksTitle:        'Mes decks',
  decksDesc:         'Tes propres cartes, planifiées comme le reste\nÉcris-les ici ou importe un tableur\nMêlées au contenu intégré',
}

// ── Quiz shared ───────────────────────────────────────────
const quiz = {
  // Kana sets
  hiraganaBase:         'Hiragana (de base)',
  hiraganaCombinations: 'Hiragana (combinaisons)',
  katakanaBase:         'Katakana (de base)',
  katakanaCombinations: 'Katakana (combinaisons)',

  // Selection prompts
  selectLevel:       'Choisis un niveau JLPT',
  selectMode:        "Choisis un mode d'entraînement",
  selectKanaSet:     'Choisis un ensemble de kana',
  selectPhase:       "Choisis ta phase d'entraînement",

  byLevel:           'JLPT',
  byLevelDesc:       'Les cinq grades de l\'examen, de N5 à N1',
  byFrequency:       'Fréquence des mots',
  byFrequencyDesc:   'Classés selon leur fréquence réelle à l\'écrit',
  // Le même axe une ligne plus loin, où ce sont les caractères qui
  // sont classés et non les mots (voir KanjiScreen.jsx).
  byFrequencyKanji:     'Fréquence des kanji',
  byFrequencyKanjiDesc: 'Classés selon leur fréquence réelle à l\'écrit',
  // Troisième source des kanji (plan 086) : les 214 clés comme porte
  // d'entrée — une leçon sur la clé, puis sa famille de kanji.
  byRadical:            'Radicaux',
  byRadicalDesc:        'Les briques des kanji — un radical, puis tous les kanji bâtis dessus',
  byMastery:         'Mes cartes',
  byMasteryDesc:     'Bâties uniquement sur des mots déjà rencontrés',
  byJmdict:          'Hors-JLPT',
  byJmdictDesc:      'Tout ce qui dépasse le programme, du plus courant au plus rare',
  selectStudySource: "Choisis ta source d'étude",
  selectTier:        'Choisis un palier de fréquence',
  kanjiUnit:         'kanji',
  loadError:         'Les paliers n’ont pas pu être chargés. Réessaie.',
  tierSizeLabel:     'Taille du palier',

  byTheme:           'Par thème',
  byThemeDesc:       'Regroupés par sujet — nourriture, travail, voyage, le corps',
  selectTheme:       'Choisis un thème',
  filterThemes:      'Filtrer les thèmes…',
  themeNoResults:    'Aucun thème ne correspond à ton filtre',

  // Les quatre paliers d'un thème, découpés par fréquence (voir
  // backend/content/theme_data.py). La moitié japonaise de chaque nom est
  // dans domain/themes.js — elle est identique dans toutes les langues.
  themeLevelBasic:    'Base',
  themeLevelMedium:   'Moyen',
  themeLevelAdvanced: 'Avancé',
  themeLevelExpert:   'Expert',
  selectThemeLevel:   'Choisis un palier',
  leaveThemeLevels:   'Paliers',

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
  typeRomaji:        'Tape le romaji…',
  tapToFlip:          'Touche pour retourner',
  tapToReveal:        'Touche pour révéler',
  // L'indice du bureau (plan 113) : une touche, puis les mots qui suivent.
  keySpace:           'Espace',
  revealByKey:        'pour révéler',
  // Le panneau du trajet, à côté d'une carte sur le bureau (plan 114).
  deskRunLabel:       'Ce trajet',
  deskEarned:         'Gagnés',
  deskEntryWait:      'La fiche du dictionnaire s’ouvre ici quand la carte est révélée.',
  deskMissesTitle:    'À revoir',
  deskBreakdownLabel: 'Décomposition',
  deskPassageLabel:   'Le texte',
  // Le trajet sur trois panneaux (plan 126) : le panneau du trajet, celui
  // de la carte (ce que chaque verdict décide, le rythme, les touches),
  // et la fiche scellée avant la révélation.
  deskRemaining:      'Restantes',
  deskCardPanel:      'Cette carte',
  forecastIn:         span => `dans ${span}`,
  forecastTomorrow:   'demain',
  forecastMinutes:    n => `${n} min`,
  forecastHours:      n => `${n} h`,
  forecastDays:       n => `${n} j`,
  forecastWeeks:      n => `${n} sem.`,
  forecastMonths:     n => `${n} mois`,
  forecastYears:      n => `${n} ans`,
  // L'attente en chiffre, sur la tuile : l'unité à côté du nombre.
  forecastUnit:       (unit, n) => ({ minute: 'min', hour: 'h', day: n > 1 ? 'jours' : 'jour', week: 'sem.', month: 'mois', year: n > 1 ? 'ans' : 'an' })[unit],
  deskKeysTitle:      'Les touches',
  deskKeyTurn:        'retourne la carte',
  deskKeyChoices:     'affiche les choix',
  deskKeyLeave:       'quitte le trajet',
  deskKeyAddReading:  'ajoute une lecture',
  deskKeyCheck:       'valide',
  deskRhythm:         'Le rythme',
  deskElapsed:        'Écoulées',
  deskPerMinute:      'Cartes / min',
  deskToFinish:       'Pour finir',
  deskSealed:         'La fiche s’ouvre à la révélation.',
  keyEnter:           'Entrée',
  keyEscape:          'Échap',
  deskWayUp:          'Remonter',
  deskBreakdownWait:  'La décomposition de la phrase s’affiche ici une fois ta réponse notée.',
  // Un exercice sur trois panneaux (plan 129) : les phrases du trajet, chacune
  // avec la note qu'elle a reçue, et les touches d'un exercice.
  deskLinesLabel:     'Les phrases du trajet',
  deskLinesNow:       'en cours',
  deskLinesRated:     'Phrases',
  deskQuestionsRated: 'Questions',
  deskPerMinuteLines: 'Phrases / min',
  deskAnswered:       'Répondues',
  deskKeyCheckNext:   'valide, puis suivante',
  deskKeyRate:        'note ta réponse',
  deskKeyListen:      'écoute la phrase',
  deskKeyReveal:      'affiche la phrase',
  deskKeyPick:        'choisit une réponse',
  deskKeyNext:        'question suivante',
  deskKeyWalk:        'parcourt les questions',
  // 問 — une question sur l'exercice, sur le bureau (plan 131) : ouverte une
  // fois la réponse notée, courte, précise, sur cet exercice seulement.
  askTitle:           'Une question',
  askPlaceholder:     'Ta question…',
  askSealed:          'Les questions s’ouvrent une fois ta réponse notée.',
  askSealedText:      'Les questions s’ouvrent avec les résultats.',
  askHint:            'Une réponse courte et précise, sur cet exercice.',
  askSend:            'Demander',
  askThinking:        'Réponse en cours',
  askOffTopic:        'Je ne réponds qu’aux questions sur cet exercice.',
  askUnavailable:     'Les réponses sont indisponibles pour le moment.',
  askFailed:          'La réponse n’est pas arrivée. Réessaie.',
  askSpent:           at => (at ? `Plus de questions aujourd’hui : elles reviennent à ${at}.` : 'Plus de questions aujourd’hui.'),
  askLeft:            n => `${n} question${n > 1 ? 's' : ''} encore aujourd’hui`,
  askFull:            'C’est tout pour cette phrase.',

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
  blackout:          'Trou noir',
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
  radicalNumber:       'Radical',
  // grammaire b2f : le sens est affiché, retrouver la règle.
  revealGrammarRule:   "Quelle règle est-ce ?",
  revealGrammarBtn:    'Afficher la règle',
  standardType:        'Standard',
  standardDesc:        'Un recto et un verso, écrits par toi.',
  // ── Champs des cartes personnelles (formulaire généré) ──
  field_front:      'Recto',
  field_back:       'Verso',
  field_kanji:      'Kanji',
  field_meaning:    'Sens',
  field_readings:   'Lectures',
  field_radical:    'Radical',
  field_word:       'Mot',
  field_reading:    'Lecture',
  field_rule:       'Règle de grammaire',
  field_sentences:  'Phrase d’exemple',
  field_sentences_group: 'Phrases d’exemple',
  field_sentences_jp: 'Phrase en japonais',
  field_sentences_tr: 'Traduction',
  field_rule_reading: 'Lecture de la règle',
  field_structure:  'Formation',
  field_register:   'Registre',
  field_explanation: 'Explication',
  field_usage:      'Emplois',
  field_careful:    'Pièges',
  field_compare:    'Règle voisine',
  field_compare_group: 'Règles voisines',
  field_compare_pattern: 'Règle voisine',
  field_compare_text: 'Ce qui les distingue',
  field_notes:      'Notes',
  fieldHint_rule_reading: 'Sa lecture, en kana — ex. 〜のなかで (facultatif)',
  fieldOff_rule_reading: 'Cette lecture ne correspond pas à la règle : chaque kanji en kana, le reste tel quel.',
  fieldHint_structure:   'Formation — ex. verbe forme て + ください',
  fieldHint_explanation: 'Ce que fait la règle. **gras** pour souligner.',
  fieldHint_usage:       'Un emploi par ligne, commençant par « - »',
  fieldHint_careful:     'Ce qu’on confond, ce qu’il faut éviter',
  pickRadical:      'Choisir un radical',
  // ── 読み入力 (kanji.readings) ──
  readingsOn:          'On (lecture sino-japonaise)',
  readingsKun:         'Kun (lecture japonaise)',
  readingsAdd:         'ajouter une lecture',
  readingsRemove:      (r) => `Retirer ${r}`,
  readingsFound:       'trouvée',
  readingsWrong:       'fausse',
  readingsMissed:      'manquée',
  readingsPlaceholder: 'kana ou romaji',
  readingsCap:         "15 lectures, c'est le maximum pour cette carte.",
  modeWriteDesc:     'Le sens seul. Trace le caractère, trait par trait.',
  // Paramétré sur le nom de l'élément étudié ("kanji" ou "mot" — voir
  // kanjiNoun/wordNoun plus bas et vocabKanjiModes dans quizModes.js).
  // C'étaient des chaînes fixes disant "kanji" quel que soit l'écran,
  // si bien que le sélecteur de mode du vocabulaire annonçait
  // « QCM (kanji → sens) » pour un deck de mots. Les deux noms sont
  // masculins, donc "Le" convient dans les deux cas.
  modeQcmKjM:        (noun) => `QCM (${noun} → sens)`,
  modeQcmKjMDesc:    (noun) => `Le ${noun} est affiché. Choisis son sens parmi quatre.`,
  modeQcmMKj:        (noun) => `QCM (sens → ${noun})`,
  modeQcmMKjDesc:    (noun) => `Le sens est affiché. Choisis le ${noun} parmi quatre.`,
  modeFcKjM:         (noun) => `Carte (${noun} → sens)`,
  modeFcKjMDesc:     (noun) => `Le ${noun} seul. Retrouve le sens, puis vérifie.`,
  modeFcMKj:         (noun) => `Carte (sens → ${noun})`,
  modeFcMKjDesc:     (noun) => `Le sens seul. Retrouve le ${noun}, puis vérifie.`,

  // ── Modes de rappel fusionnés (étude d'un deck) ──
  // Un deck propose une entrée par sens plutôt qu'une en QCM et une en
  // flashcard : c'était la même question posée avec deux niveaux
  // d'aide — et l'aide est désormais un bouton sur la carte elle-même.
  // Voir MERGED_MODES dans StudyScreen.
  modeRecallKjM:     'Mot → sens',
  modeRecallMKj:     'Sens → mot',
  modeRecallGrammar: 'Structure → sens',
  modeRecallDesc:    'De mémoire, ou avec quatre choix — change à tout moment.',
  assistOff:         'Afficher les choix',
  assistOn:          'Masquer les choix',
  assistUnavailable: 'Ta propre carte — de mémoire, et à toi de juger',

  modeFcKanaDesc:     'Le kana seul. Dis le son, puis vérifie.',
  modeQcmKanaDesc:    'Le kana est affiché. Choisis sa prononciation parmi quatre.',
  modeWriteKanaDesc:  'Le son est donné. Trace le kana.',

  modeFcGrammarDesc:   'Le point seul. Retrouve ce qu\'il fait, puis vérifie.',
  modeQcmGrammarDesc:  'Le point est affiché. Choisis ce qu\'il fait parmi quatre.',
  modeFillGrammarDesc: 'Une phrase dont le point a été retiré. Remets-le.',

  // « Réviser ses cartes » — parcours libre et sans notation des cartes
  // déjà étudiées dans ce deck (voir ReviewDeck.jsx). Ajouté à chaque
  // sélecteur de mode, à côté de modeQCM/modeFlashcard/etc.
  modeReview:        'Révision',
  modeReviewDesc:    'Parcours ce que tu sais déjà. Rien n\'est noté ni replanifié.',
  reviewEmpty:       "Tu n'as encore étudié aucune de ces cartes — reviens après ta première session.",
  reviewPrev:        'Précédent',
  reviewNext:        'Suivant',

  // Writing practice
  writingPractice:   'Entraîne-toi à écrire ce kanji',
  toggleWriting:     'Activer/désactiver l\'écriture',
  yourDrawing:       'Ton dessin',
  strokeOrder:       'Ordre des traits',
  continueBtn:       "C'est bon, continuer",
  eraseBtn:          'Effacer',

  // Misc
  strokes:           'traits',
  notAvailable:      'Non disponible',
  noMeaningRecorded: 'Aucun sens répertorié',
  vocabulary:        'Vocabulaire',
  kanji:             'Kanji',

  // Grammar screen
  revealMeaning:     'Que signifie cette règle ?',
  revealSentence:    'Complète la phrase ci-dessous',
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
  todayPickHint:      'Choisis ton service',
  todayLines:         'Lignes du jour',
  todayPickSomething: 'Choisis au moins une ligne',
  todayStart:         n => `Réviser ${n} carte${n === 1 ? '' : 's'}`,
  todayAllTypes:      'Toutes',
  todaySearchPlaceholder: 'Chercher une ligne…',
  todayLaneCount:     n => `${n} service${n === 1 ? '' : 's'}`,
  todayNoMatch:       'Aucune ligne ne correspond.',
  todayNoMatchHint:   'Essaie un autre nom, ou efface les filtres.',
  todayClearFilters:  'Effacer les filtres',
  todayDue:           n => `${n} à réviser`,
  todayNothingDueShort: 'À jour',
  todayRemaining:     'Reste dans ce service',
  todayClearTitle:    'Service terminé',
  todayClearedCount:  n => `${n} révision${n === 1 ? '' : 's'} faite${n === 1 ? '' : 's'}. Plus rien à réviser.`,
  todayNothingDue:    'Rien à réviser pour le moment.',
  todayNextReview:    when => `Prochaine révision ${when}.`,
  backToStation:      'Retour à la gare',
  fareGate:           'Portique',
  dueUnit:            'à réviser',
  newUnit:            'nouveaux',
  learningUnit:       'en cours',
  sourceTiers:        n => `${n} paliers`,
  sourceThemes:       n => `${n} thèmes`,
  originStop:         'Débutant',
  stageGate:          'Portique',
  nothingGraded:      'Rien n’est noté',
  stationJlpt:        'JLPT',
  stationSources:     'Sources',
  stationSets:        'Séries',
  byFrequencyShort:   'Par fréquence',
  byThemeShort:       'Par thème',
  byRadicalShort:     'Par radical',
  leaveLevels:        'Niveaux',
  leaveRadicals:      'Radicaux',
  // ── La leçon sur une clé (plan 086) ──
  radLesson:          'Le radical',
  radFamily:          'Kanji bâtis sur ce radical',
  radForms:           'Formes',
  radPosition: {
    hen:     'à gauche',
    tsukuri: 'à droite',
    kanmuri: 'en haut',
    ashi:    'en bas',
    kamae:   'tout autour',
    tare:    'en haut et le long du bord gauche',
    nyou:    'le long du bord gauche et en bas',
  },
  radPositionJp: { hen: '偏', tsukuri: '旁', kanmuri: '冠', ashi: '脚', kamae: '構', tare: '垂', nyou: '繞' },
  radPositionNote:    where => `Comme composant, il se place le plus souvent ${where} d'un kanji`,
  radNoPositionNote:  'Comme composant, il n\'a pas de place fixe dans un kanji.',
  radFamilyShort:     'Kanji bâtis dessus',
  radNoKanji:         'Le cours n\'enseigne encore aucun kanji bâti dessus.',
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
  dictCollections:    'Collections',
  analyzerDoorSub:    'Texte, photo, vidéo',
  passagesCount: (n) => `${n} passage${n === 1 ? '' : 's'}`,
  sentencesCount: (n) => `${n} phrase${n === 1 ? '' : 's'}`,
  leaveAnalyzer:      'Analyseur',
  furiganaCap:        'Furigana',
  newDeck:            'Nouveau deck',
  cardsUnit: (n) => `${n} carte${n === 1 ? '' : 's'}`,
  // ── Profil, statistiques et réglages (plan 074) ──
  // ── 統計, le relevé de service (plan 085) ──
  reportRetention:    'Rétention',
  reportThisWeek:     'cette semaine',
  reportWeeksAgo:     w => `il y a ${w} sem`,
  reportDelta:        (n, w) => `${n > 0 ? '+' : n < 0 ? '−' : '±'}${Math.abs(n)} · ${w} sem`,
  reportWeekOf:       (date, n) => `sem. du ${date} · ${n} ${n === 1 ? 'révision' : 'révisions'}`,
  reportRungs:        ['<1 j', '1 sem', '1 mois', '3 mois', '3 mois+'],
  reportStrengthSummary: n => `${n} cartes selon leur avance`,
  reportMisses:       (n, d) => `${n === 1 ? 'raté' : 'ratés'} · ${d} j`,
  // ── 路線別, les lignes du relevé (plan 138) ──
  reportWeekStart:    d => `sem. du ${d}`,
  reportReviewsCap:   'révisions',
  reportPointOf:      (when, n) => `${when} · ${n} ${n === 1 ? 'révision' : 'révisions'}`,
  reportLineReviews:  n => `${n} rév.`,
  reportToReview:     'À revoir',
  reportNoMiss:       'Aucun raté',
  reportLineEmpty:    'Pas encore de révision',
  reportCell:         (mode, deck, pct, n) => `${mode} · ${deck} · ${pct} % · ${n} ${n === 1 ? 'révision' : 'révisions'}`,
  reportCellNone:     (mode, deck) => `${mode} · ${deck} · pas encore révisé`,
  reportTile:         (head, deck, mode, pct, lapses) => `${head} · ${deck} · ${mode} · ${pct} % · ${lapses} ${lapses === 1 ? 'raté' : 'ratés'}`,
  reportEmpty:        'Aucune révision encore',
  reportEmptyHint:    'La première semaine de révisions trace la ligne.',
  startedNote:     n => `${n} commencées`,
  reportError:        'Le relevé n\'a pas pu être lu',
  daysUnit:           'jours',
  balanceRefillLine:  (at) => `+1 à ${at}`,
  balanceRefillRate:  (min) => `+1 toutes les ${min} min`,
  perDayUnit:         '/ jour',
  // Voir en/index.js : le pavé de quatre chiffres a laissé la place à
  // deux lignes qui portent leur propre écart.
  statusPace:         'Rythme',
  statusArrival:      'Arrivée',
  statusPromisedPace: (p) => `promis ${p} / jour · 14 derniers jours`,
  statusOnPassDate:   (d) => `sur la carte, le ${d}`,
  statusDaysDelta:    (n) => `${n > 0 ? '+' : '−'}${Math.abs(n)} j`,
  statusNextStop:     (stop) => `Prochain arrêt ${stop}`,
  statusArrived:      'Ligne terminée',
  statusBehindPlan:   (n) => `${n} de retard`,
  statusAheadPlan:    (n) => `${n} d'avance`,
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
  settingsPaceCap:    'Nouveaux éléments par jour',
  settingsPaceCustom: n => `Ton rythme est réglé sur ${n} par jour.`,
  paceName:           { local: 'Omnibus', rapid: 'Rapide', express: 'Express' },
  levelUpTitle:       l => `Monter à ${l} ?`,
  levelUpBody:        (to, weeks) => `Les arrêts avant ${to} sont marqués **connus** : leurs cartes démarrent maîtrisées, avec un premier contrôle réparti sur les ${weeks} prochaines semaines. Les cartes déjà en cours gardent leur place. **Rien n'est effacé.**`,
  levelDownTitle:     l => `Descendre à ${l} ?`,
  levelDownBody:      to => `Les cartes au-delà de ${to} sont mises de côté, pas effacées : elles gardent leur historique et reviennent dans le trajet quand tu remontes. Le trajet du jour se réduit aux arrêts ${to}.`,
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
  compNote: (you, right) => `Toi · ${you} — correct · ${right}`,
  examPart: (n) => `Partie ${n}`,
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
  resetConfirm:       'Effacer toute la progression ? Impossible à annuler.',
  kana:               'Kana',
  jlptVocab:          'Vocabulaire JLPT',
  globalSummary:      'Résumé global',
  new:                'Nouveau',
  learning:           'En cours',
  mastered:           'Maîtrisé',
  dueNow:             'À réviser',
  // The same state as dueNow, in the record cell that owns the
  // schedule: a figure, so one word rather than a phrase (plan 089).
  dueValue:          'Maintenant',
  reviewThisCard:    'Réviser cette carte',
  total:              'Total',
  overview:           'Aperçu',
  streak:             'Série',
  longestStreak:      'Meilleure série',
  accuracy:           'Précision',
  dueToday:           'À réviser aujourd\'hui',

  // ── Bandeau de tête ─────────────────────────────────────

  // ── Calendrier de pratique ──────────────────────────────

  // ── L'explorateur ───────────────────────────────────────

  // ── Prévisions ──────────────────────────────────────────

  // ── Rythme ──────────────────────────────────────────────

}

// ── Phrases analyser ────────────────────────────────────────────
const phraseAnalyzer = {
  // 解析駅 — l'analyseur fusionné (plan 027). Une gare, trois voies :
  // 文字 / 写真 / 動画. Les clés phraseAnalyzer* ci-dessous sont
  // conservées : elles nomment encore la section partout où l'ancien
  // texte n'a pas été retiré.
  analyzerTitle:       'Analyseur',
  analyzerDesc:        "Tout ce que tu croises en japonais\nTapé, photographié ou sous-titré\nDécortiqué mot à mot",
  sourceText:          'Texte',
  sourcePhoto:         'Photo',
  sourceVideo:         'Vidéo',
  sourceTextHint:      'Tape ou colle du japonais',
  sourcePhotoHint:     'Photographie ou importe une image',
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
  intakeTextLead:      'Tape ou colle du japonais.',
  intakePhotoLead:     'Une page, un panneau, une capture — tout ce qui porte du japonais.',
  intakeVideoLead:     'Colle le lien, puis le favori 字幕取り rapporte les sous-titres — ou dépose un fichier.',
  shootPhoto:          'Photographier',
  pickPhoto:           'Choisir',
  charCount:           n => `${n} caractères`,
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
  clozeExplain:        "Une carte à trou masque ce mot dans la phrase, pour que tu le retrouves par le contexte plutôt que dans une liste.",
  addCloze:            'Ajouter une carte à trou',
  changeSource:        'Changer ce que tu étudies',
  // Le talon et le rail de travail (la refonte « salle de contrôle »).
  // La navigation de cet écran parle la langue de l'apprenant ; le
  // japonais reste sur le contenu et les petits accents.
  reopenIntake:        'Ajouter un autre passage',
  searchPassage:       'Chercher dans le passage…',
  filterStops:         'Filtrer les phrases',
  filterAll:           'Toutes',
  filterKept:          'Gardées',
  filterHasNew:        'Mots nouveaux',
  stopsShown:          (n, total) => `${n} phrase${n > 1 ? 's' : ''} sur ${total} affichée${n > 1 ? 's' : ''}`,
  keepAllIPlusOne:     'Garder tous les i+1',
  // Les trois réglages des furigana.
  furiganaAll:         'Tous',
  furiganaUnknown:     'Inconnus',
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
  videoVolumePct:      pct => `${pct}\u00A0%`,
  // Le plan du clavier sous la scène.
  kbdToken:            'mot',
  kbdSentence:         'phrase',
  kbdPlay:             'lecture',
  dockNoEntry:         'Pas de fiche de dictionnaire pour ce mot.',
  // 机 — the analyser on three columns (plan 134).
  prevSentence:        'Phrase précédente',
  nextSentence:        'Phrase suivante',
  replaySentence:      'Rejouer la phrase',
  loopSentence:        'Répéter la phrase en boucle',
  pauseEachSentence:   'Pause à la fin de chaque phrase',
  playbackRate:        r => `${String(r).replace('.', ',')}×`,
  playbackSpeed:       r => `Vitesse : ${String(r).replace('.', ',')}×`,
  showVideo:           'Afficher la vidéo',
  hideVideo:           'Masquer la vidéo',
  furiganaNow:         label => `Furigana : ${label}`,
  wordsInSentence:     'Les mots de la phrase',
  explanationTitle:    'Explication de la phrase',
  showExplanation:     'Voir l’explication',
  showEntry:           'Revenir à la fiche',
  explainThisSentence: 'Expliquer la phrase',
  explanationOpen:     'Explication ouverte',
  writtenHere:         s => `ici : ${s}`,
  dictAnalyseSentence: 'Analyser cette phrase',
  windowWhole:         'toute la vidéo',
  windowSpan:          m => `${m} sélectionnées`,
  windowBackwards:     'La fin doit venir après le début.',
  historyTitle:        'Historique',
  dateToday:           'aujourd’hui',
  dateYesterday:       'hier',
  dateDaysAgo:         n => `il y a ${n} jours`,
  phraseAnalyzerTitle: 'Analyseur de phrases',
  phraseAnalyzerDesc:  'Colle une phrase, vois-la décortiquée\nChaque mot, sa lecture, ton historique\nPour celle que tu as presque comprise',
  phraseAnalyzer:      'Analyseur de phrases',
  phrasePlaceholder:   'Écris ou colle une phrase japonaise…',
  analyze:             'Analyser',
  showHistory:         'Historique',
  hideHistory:         'Masquer l\'historique',
  // ── 帳 — les passages d'abord (plan 136) ──
  shelfAll:            'Tous',
  shelfKept:           'Gardés',
  // Le tampon d'une carte : un passage gardé.
  passageKept:         'Gardé',
  shelfFilter:         'Montrer',
  shelfSearch:         'Chercher dans tes passages…',
  shelfEmpty:          'Aucun passage pour le moment : ce que tu analyses à droite s’affichera ici.',
  shelfNoMatch:        'Aucun passage ne correspond.',
  shelfEmptyPhone:     'Tes passages s’afficheront ici : colle du japonais ou un lien YouTube au-dessus, ou prends une photo.',
  newPassage:          'Nouveau passage',
  entryPlaceholder:    'Colle du japonais ou un lien…',
  dropHere:            'Dépose-le ici : des sous-titres ou une image',
  phraseAnalyzeError:  "Impossible d'analyser cette phrase. Réessaie.",
  clickForDetails:     'Clique pour voir la définition et les statistiques',
  inThisPhrase:        'Dans cette phrase',
  appDefinition:       'Définition dans l\'application',
  cardStats:           'Statistiques de la carte',
  totalReviews:        'Révisions',
  correctReviews:      'Réussies',
  interval:            'Intervalle',
  days:                'jours',
  nextReview:          'Prochaine révision',
  status_mastered:     'Maîtrisé',
  status_learning:     'En cours',
  status_new:          'Nouveau',
  status_not_started:  'Pas dans le deck',
  status_due:          'À réviser',
  sentenceLevel:       'Niveau estimé',
  unknownWords:        'mots inconnus',
  offDeckWords:        'non enseignés par l\'application',
  iPlusOne:            'Un cran au-dessus de toi',
  alreadyExplained:    'déjà expliquée',
  // 保存 (plan 039) — épingler une phrase dans la banque.
  keepSentence:        'Garder cette phrase',
  unkeepSentence:      'Ne plus garder cette phrase',
  grammarSpotted:      'Grammaire repérée',
  explainSentence:     'Expliquer',
  explainAgain:        'Expliquer à nouveau',
  explaining:          'Explication en cours…',
  explainFailed:       'L\'explication n\'est pas arrivée. Réessaie.',
  explainUnavailable:  'Les explications sont indisponibles pour le moment. Réessaie dans un instant.',
  passageTruncated:    n => (n === 1 ? 'Seule la première phrase a été analysée.' : `Seules les ${n} premières phrases ont été analysées.`),
  sentenceAnalysisUnavailable: 'Analyse temporairement indisponible pour cette phrase.',
  mineToDeck:          'Ajouter',
  inDeck:              'Dans le deck',
  alreadyInDeck:       'Déjà présent',
  chooseDeck:          'Choisir un deck',
  noDeckOfType:        'Aucun deck de ce type pour le moment',
  clozeCreated:        'Carte à trou créée',
  mineFailed:          "Impossible d'ajouter cette carte. Réessaie.",
  cannotMineOffDeck:   'Hors du deck de l’application',
  offDeckKey:          'Hors deck',
  takePhoto:           'Prendre une photo',
  chooseImage:         'Choisir une image',
  ocrRecognizing:      "Lecture de l'image…",
  ocrReading:          "Lecture de l'image…",
  cropHint:            'Encadre le texte voulu. Les flèches déplacent la sélection.',
  useThisArea:         'Lire cette zone',
  useWholeImage:       "Utiliser toute l'image",
  ocrLocalOption:      'Lire sur mon appareil (privé, bien moins précis)',
  ocrTooLarge:         'Cette image est trop volumineuse. Recadre sur une zone plus petite.',
  ocrLimitReached:     "Tu as atteint la limite d'images du jour. Réessaie demain.",
  ocrUnavailable:      'La lecture d’images est indisponible pour le moment. Réessaie dans un instant.',
  ocrCheckText:        "Vérifie le texte avant d'analyser — l'OCR n'est pas toujours fiable.",
  ocrFailed:           "Impossible de lire cette image. Essaie-en une autre, ou tape le texte.",
  imageTooLarge:       'Cette image est trop volumineuse.',
  hearThis:            'Écouter',
  hearSentence:        'Écouter cette phrase',
  hearToken:           s => `Écouter ${s}`,
  entryDeleted:        'Retiré de ton historique',
  undo:                'Annuler',
  addToAnotherDeck:    'Ajouter à un autre deck',
  mineAdded:           'Ajouté à ton deck',
  mineAlready:         'Cette carte était déjà dans le deck',
}

// ── Video ─────────────────────────────────────────────────
const video = {
  videoTitle:          'Vidéo',
  videoDesc:           "Étudie les sous-titres japonais d'une vidéo\nEn direct, colorés selon ce que tu sais déjà\nUne photo du monde avec une bande-son",
  videoUrlOptional:    'Lien de la vidéo',
  // Affiché seulement là où le serveur sait récupérer un lien seul.
  analyzeThisLink:     'Récupérer les sous-titres',
  // ── L'entrée vidéo en colonne (plan 136) ──
  // Une seule action remplie : installer le favori tant qu'il n'a jamais
  // servi, puis ouvrir la vidéo sur YouTube, où on le touche.
  grabInstall:         'Installer le favori 字幕取り',
  grabInstallSay:      'Une minute, une seule fois : ensuite, sur n’importe quelle vidéo YouTube, il rapporte les sous-titres ici.',
  grabThenSay:         'Puis touche ton favori 字幕取り : les sous-titres arrivent ici.',
  grabInstallLink:     'Installer le favori',
  chooseSubtitles:     'Choisir un fichier de sous-titres',
  copyBookmarklet:     'Copier le favori 字幕取り',
  bookmarkletCopied:   'Copié ! Passe à l\'étape 2',
  downsubHint:         'Télécharge un fichier .vtt à choisir ici — utile quand le favori ne passe pas.',
  grabEmpty:           'Les sous-titres rapportés étaient vides — réessaie depuis la page de la vidéo.',
  // ── Le tutoriel du favori ──
  tutTitle:            'Installer le favori 字幕取り',
  tutWhat:             'Le principe : on va enregistrer une petite « adresse magique » comme favori dans ton navigateur. Ouvrir ce favori pendant que tu es sur une vidéo YouTube récupère ses sous-titres japonais et te ramène ici, analyse lancée. Rien à installer, aucune extension, aucun compte.',
  tutStep1Title:       'Copie l\'adresse du favori',
  tutStep1Body:        'Ce bouton met l\'adresse dans ton presse-papiers. Elle commence par « javascript: » — c\'est normal, c\'est elle qui fait tout le travail.',
  tutStep2Title:       'Crée le favori dans ton navigateur',
  tutStep2Body:        'Le geste dépend de l\'appareil — choisis le tien :',
  tutDeviceLabel:      'Appareil',
  tutDeviceDesktop:    'Ordinateur',
  tutDesktop1:         'Affiche la barre de favoris : Ctrl+Maj+B (⌘+Maj+B sur Mac).',
  tutDesktop2:         'Clic droit sur la barre → « Ajouter une page… » (Chrome/Edge) ou « Nouveau marque-page… » (Firefox).',
  tutDesktop3:         'Nom : 字幕取り. Dans le champ URL, colle l\'adresse copiée, puis enregistre.',
  tutAndroid1:         'Dans Chrome, sur n\'importe quelle page, touche ⋮ puis l\'étoile ☆ : un favori se crée.',
  tutAndroid2:         'Rouvre ⋮ → Favoris, fais un appui long sur ce nouveau favori → Modifier.',
  tutAndroid3:         'Nom : 字幕取り. Efface l\'URL, colle l\'adresse copiée, enregistre.',
  tutIphone1:          'Dans Safari, sur n\'importe quelle page, touche Partager (le carré avec une flèche) → « Ajouter un signet » → Enregistrer.',
  tutIphone2:          'Ouvre les Signets (l\'icône livre) → Modifier, puis touche ce signet.',
  tutIphone3:          'Nom : 字幕取り. Remplace l\'adresse par celle copiée, touche OK.',
  tutStep3Title:       'Utilise-le sur une vidéo',
  tutStep3a:           'Ouvre la vidéo sur le site youtube.com, dans le navigateur — pas dans l\'application YouTube, qui ne connaît pas tes favoris',
  tutStep3b:           'Ordinateur : clique 字幕取り dans la barre de favoris. Téléphone : tape 字幕取り dans la barre d\'adresse et touche le favori proposé.',
  tutStep3c:           'La page revient ici toute seule et l\'analyse démarre avec les sous-titres japonais — la vidéo lisible à côté.',
  tutTroubleTitle:     'Si ça ne marche pas',
  tutTrouble1:         'Le favori explique lui-même : « No Japanese subtitles » veut dire que la vidéo n\'a pas de piste japonaise — il n\'y a rien à récupérer. « Page not ready » : recharge la page de la vidéo et réessaie.',
  tutTrouble2:         'En dernier recours, le lien DownSub de cette page télécharge un fichier .vtt : dépose-le dans la zone 字幕 ci-dessous, le résultat est le même.',
  uploadSubtitles:     'Importe un fichier de sous-titres (.srt, .vtt, .ass)',
  openOnYoutube:       'Ouvrir sur YouTube',
  windowStart:         'Début (secondes)',
  windowEnd:           'Fin (secondes)',
  windowCapped:        'La fenêtre a été limitée à 5 minutes.',
  analyzingText:       'Lecture de ton texte…',
  analyzingPhoto:      'Lecture du texte de la photo…',
  analyzingVideo:      'Analyse des sous-titres…',
  captionsUnavailable: "Impossible de récupérer les sous-titres de cette vidéo.",
  subtitleTooLarge:    'Ce fichier de sous-titres est trop volumineux.',
  breakThisDown:       'Décomposer cette phrase',
  seekToSentence:      'Aller à cette phrase',
  // 案内表示 — the notices under the intake. An `info` notice is a fact
  // about the Passage, not a failure, and must never wear --danger.
  passageReady:        n => `${n} ${n === 1 ? 'phrase prête' : 'phrases prêtes'}`,
  analysisFailed:      'Ça n’a pas fonctionné',
  noticeDismiss:       'Fermer',
  analysisResult:      'Analyse',
  clearPassage:        'Effacer',
  clearPassageHint:    'Vider l\'analyseur et recommencer',
}

// ── Reading ───────────────────────────────────────────────
const reading = {
  readingTitle:         'Entraînement à la lecture',
  readingDesc:          'De vraies phrases, à ton niveau\nPar grade, par fréquence, ou depuis tes cartes\nLire d\'abord, vérifier ensuite',

  // Source de fréquence : quelle liste de mots (byLevel/byFrequency/
  // byMastery, selectStudySource, selectTier, loadError vivent dans
  // `quiz` ci-dessus — partagés avec les autres sélecteurs de palier
  // de fréquence de l'application).
  selectDomain:          'Choisis une liste de mots',
  domainVocabDeck:       'Deck du cours',
  domainVocabDecDesc:    'Le deck gradué, de N5 à N1',
  domainVocabJmdict:     'Dictionnaire complet',
  domainVocabJmdictDesc: 'Tout le dictionnaire, du plus courant au plus rare',
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
  notEnoughMasteryWords: "Pas encore assez de mots en cours ou maîtrisés — continue à étudier et reviens pour ce mode.",

  readingGrammarPoint: 'Point de grammaire',
  readingFetchError:    "Impossible de charger une phrase. Réessaie.",
  writeWhatYouSaw:      'Écris ce que tu as vu, en romaji',
  // Le chrono au rythme « Sans limite » (Réglages › Rythme de lecture).
  readingUntimed:       'Sans limite de temps',
  romajiPlaceholder:    'ex. konnichiwa',
  // Le bouton lecture derrière lequel arrive une phrase (PlayButton de ReadingPieces).
  readingPlay:          'Afficher la phrase et lancer le chrono',
  correct:              'Correct !',
  incorrect:            'Pas tout à fait',
  correctRomaji:        'Romaji attendu',
  yourAnswer:           'Ta réponse',
  // La part de la phrase retrouvée par le serveur, imprimée à côté de
  // la réponse de l'apprenant, sur les deux scènes qui en demandent une
  // (ReadingRun, DictationRun). Une mesure, pas un verdict — le
  // verdict, c'est la barre de notation sous la carte, et elle lui
  // appartient.
  answerMatched:        n => `${n}\u00A0% retrouvé`,
  nextPhrase:           'Phrase suivante',
  translation:          'Traduction',
  didYouGetIt:          'Alors, c’était juste ?',
  gradeCorrect:         'C’était juste',
  gradeIncorrect:       'C’était faux',

  // Décomposition mot par mot + sa navigation (ReadingRun.jsx,
  // DictationRun.jsx) — affichée une fois la phrase corrigée.
  showBreakdown:        'Voir la décomposition',
  hideBreakdown:        'Masquer la décomposition',
  preparingBreakdown:   'Préparation de la décomposition…',
  // L'échec, une fois établi — 書取 peut vraiment l'atteindre : sa
  // décomposition n'est demandée qu'à la révélation (la phrase n'existe
  // pas côté client avant), donc un modèle en panne se voit ici alors
  // que la longue fenêtre de préchargement de la lecture le masque. La
  // lecture l'affiche aussi, pour l'appel lent ou réessayé que son
  // préchargement ne devance pas.
  breakdownUnavailable: 'Décomposition indisponible',
  // Le texte phrase par phrase (PassageBreakdown) : le nom du chevron,
  // et la légende au-dessus des points autour desquels le texte a été
  // écrit.
  openSentence:         'Ouvrir cette phrase',
  closeSentence:        'Fermer cette phrase',
  grammarInText:        'Grammaire du texte',
  jumpToTokenNamed:      s => `Aller à ${s}`,
  detailsForToken:       s => `Détails de ${s}`,
  detailsForKanji:       k => `Détails du kanji ${k}`,
}

// ── Reading comprehension ────────────────────────────────────────────
const readingComprehension = {
  readingComprehensionTitle: 'Compréhension écrite',
  readingComprehensionDesc:  'Des textes courts, puis des questions\nL’épreuve de lecture de l’examen, en répétition\nDe N5 à N1',
  question:                   'Question',
  yourAnswer:                 'Ta réponse',
  gradeCorrect:               'C’était juste',
  gradeIncorrect:             'C’était faux',
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
  translationDesc:       'À toi de le dire en japonais\nUne réponse de référence, et un avis sur la tienne\nDans le sens difficile, exprès',
  translationFetchError: "Impossible de charger une phrase. Réessaie.",
  japanesePlaceholder:   'Écris-la en japonais…',
  aiAnalysis:            'Analyse IA',
  // L'avis du tuteur en forme fixe, pas en paragraphe (routes/translation.py).
  reviewCorrect:         'Correct',
  reviewAcceptable:      'Acceptable',
  reviewPartial:         'En partie',
  reviewIncorrect:       'À revoir',
  reviewGood:            'Ce qui marche',
  reviewFix:             'À corriger',
  reviewBetter:          'Version corrigée',
  // Ce que dit la phrase de l'apprenant, dans sa langue : demandé par
  // 作文 seul, dessiné par components/study/TutorReview.jsx dès qu'un
  // avis le porte.
  reviewMeaning:         'Ce que ça dit',
  reviewGrammarUsed:     'utilisé',
  reviewGrammarMissed:   'non utilisé',
  analyzingTranslation:  'Analyse de ta traduction…',
  analysisUnavailable:   'Analyse indisponible — juge par rapport à la référence ci-dessus.',
}

// ── 書取 — la dictée ──────────────────────────────────────────
// DictationRun.jsx réutilise telles quelles les clés partagées
// (selectLevel, leaveLevels, stationJlpt, submit, retry, yourAnswer,
// translation/translationEnglish, nextPhrase, examAudioPause/
// examAudioPending/examAudioUnavailable) — seules les clés vraiment
// nouvelles vivent ici.
//
// La réponse s'écrit en romaji, et la copie le dit partout où elle en
// demande une : un clavier japonais est une installation à part sur un
// ordinateur et un clavier à part sur un téléphone, donc « en japonais »
// demandait à la plupart des apprenants ce qu'ils ne peuvent pas taper.
// Le kana et les kanji comptent toujours autant — le serveur essaie les
// trois formes — le champ nomme simplement celle qu'ils ont.
const dictationMode = {
  dictationTitle:        'Dictée',
  dictationDesc:         'Écris en romaji ce que tu entends\nDeux écoutes, pas une de plus\nDe N5 à N1',
  dictationFetchError:   "Impossible de charger un extrait. Réessaie.",
  dictationCheckError:   "Impossible de corriger ta réponse. Réessaie.",
  dictationPlaceholder:  'Écris en romaji ce que tu as entendu…',
  dictationPrompt:       'Écris en romaji ce que tu as entendu',
  dictationListen:       'Écouter',
  dictationListensLeft:  n => (n === 1 ? '1 écoute restante' : `${n} écoutes restantes`),
}

// ── 作文 — la rédaction (plan 125) ──────────────────────────────
// CompositionRun.jsx réutilise telles quelles les clés partagées
// (selectLevel, leaveLevels, stationJlpt, submit, retry, yourAnswer,
// japanesePlaceholder, aiAnalysis, analysisUnavailable, nextPhrase,
// readingGrammarPoint, glLesson, les clés review*, celles de la
// décomposition et de l'explication) — seules les clés vraiment
// nouvelles vivent ici.
const compositionMode = {
  compositionTitle:        'Rédaction',
  compositionDesc:         'Écris une phrase avec le point donné\nUn tuteur te la relit\nDe N5 à N1',
  compositionFetchError:   "Impossible de charger un point de grammaire. Réessaie.",
  compositionPrompt:       'Écris une phrase avec',
  // Le mot du détecteur, sur l'étiquette de la réponse à côté de « Ta
  // réponse » : un indice pour la note que l'apprenant donne en
  // dessous, jamais la note — et rien du tout sur un point que le
  // détecteur ne sait pas voir.
  compositionFound:        'point repéré',
  compositionNotFound:     'point non repéré',
  analyzingComposition:    'Lecture de ta phrase…',
  // Les avis du jour sont épuisés (routes/composition.py, 429). La
  // session continue : l'indice s'affiche toujours et la note compte.
  compositionLimitReached: "Le tuteur a fini sa journée : ton indice et ta note comptent toujours. Reviens demain.",
}

// ── Dictionary ────────────────────────────────────────────
const dictionary = {
  dictionaryPlaceholder: 'Rechercher un kanji, un kana ou un sens…',
  noResults:         'Aucun résultat pour',
  reading:           'Lecture',
  romaji:            'Romaji',
  meaning:           'Sens',
  examples:          'Exemples',
  level:             'Niveau',
  levelShort:        'Niv',
  listen:            'Écouter',
  displayedKanji:    'kanji affichés',
  radical:           'Radical',
  // Additional dictionary keys used by screens
  dictAll:           'Tout',
  dictKanji:         'Kanji',
  dictVocab:         'Vocabulaire',
  dictHiragana:      'Hiragana',
  dictKatakana:      'Katakana',
  // 文法 — the grammar collection: the 355 points of the JLPT line as
  // entries, narrowed by level in a second row of chips.
  dictGrammar:       'Grammaire',
  dictLevels:        'Niveaux',
  dictLevelAll:      'Tous',
  // Comment la recherche lit la requête : à quel point, et où.
  dictMatch:         'Correspondance',
  dictMatchOptions:  { word: 'Mot entier', start: 'Début', any: 'Partout' },
  dictSearchOptions: 'Options de recherche',
  dictField:         'Chercher dans',
  dictFieldOptions:  { all: 'Tout', japanese: 'Japonais', meaning: 'Sens' },
  // Voir en/index.js : une constatation, pas une question.
  dictCorrectedFor:  'Résultats pour',
  dictionaryPlaceholderGrammar: 'Rechercher un point, une structure ou un sens…',
  dictAdd:             'Ajouter',
  dictAddToDeck:       'Ajouter à un deck',
  dictFavorites:       'Favoris',
  dictFavorite:        'Favori',
  dictFavoriteAdd:     'Garder en favoris',
  dictFavoriteRemove:  'Retirer des favoris',
  dictFavoriteFailed:  'Impossible d\'enregistrer.',
  dictFavoriteFull:    'Les favoris sont pleins : retire-en un d\'abord.',
  dictFavoritesEmpty:  'Aucun favori pour l\'instant',
  dictFavoritesHint:   'L\'étoile d\'une entrée la garde ici.',
  // 文法 — la leçon (plan 087)
  glLesson:          'Leçon',
  glPoints:          'Les points',
  glRule:            'Règle',
  glUse:             'Emploi',
  glCareful:         'Attention',
  glCompare:         'Comparer',
  glBoard:           'Compris — embarquer',
  glBlank:           'trou',
  glRegister: { neutral: 'Neutre', casual: 'Familier', polite: 'Poli', formal: 'Soutenu', written: 'Écrit' },
  composingKanji:    'Composé de ces kanji',
  vocabExamples:     'Utilisé dans ces mots',
  kanaExamples:      'Se lit dans ces mots',
  allReadings:       'Toutes les lectures',
  readingsNoWords:   'Pas encore de mots d\'exemple',
  // Voir en/index.js : la moitié japonaise est le titre, la moitié en
  // langue claire sa légende.
  readingsOnName:    'Lecture chinoise',
  readingsKunName:   'Lecture japonaise',
  // Voir en/index.js : le 熟 d'un mot qui se lit d'un bloc.
  readingsWhole:     'Se lit d\'un bloc',
  dictBackToRadicals:'Retour aux radicaux',
  dictModeSearch:    'Recherche',
  dictModeRadical:   'Radical',
  dictionaryPlaceholderRadical: 'Filtrer ces résultats par radical…',
  dictionaryResults: n => `${n} résultats`,
  dictRadicalNumber: (n) => `radical n°\u00A0${n}`,
  dictStrokesPlural: 'traits',
  dictStrokeSingular: 'trait',
  dictStrokeIndex:   'Index par nombre de traits',
  dictStrokePrev:    'Moins de traits',
  dictStrokeNext:    'Plus de traits',
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
  comprehensionTitle:       'Compréhension écrite',
  comprehensionFetchError:  "Impossible de charger le texte. Réessaie.",
  comprehensionLimitReached: "Tu as lu tous les nouveaux textes du jour. Reviens demain.",
  comprehensionGenerating:  'Rédaction d’un texte pour toi…',
  comprehensionSubmitError:  "Impossible d'envoyer les réponses. Réessaie.",
  doneReading:              'Lecture terminée',
  reReadText:               'Relire le texte',
  showTranslation:          'Afficher la traduction',
  hideTranslation:          'Masquer la traduction',
  timeRemaining:           'Temps restant',
  tryAgain:                'Réessayer',
  changeLevel:             'Changer de niveau',
  score:                   'Score',
}

const progress = {
  progressNew:       'À apprendre',
  progressLearning:  'En cours',
  progressMastered:  'Maîtrisé',
  cardProgress:      'Progression de la carte',
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
  mode_kana_flashcard_f2b_desc:   'Le kana est affiché. Retrouve sa prononciation.',
  mode_kana_flashcard_b2f:        'Romaji → kana',
  mode_kana_flashcard_b2f_desc:   'Le son est donné. Retrouve le kana.',
  mode_kana_write_romaji:         'Écrire le romaji',
  mode_kana_write_romaji_desc:    'Le kana est affiché. Tape sa prononciation.',
  mode_kana_write_kana:           'Tracer le kana',
  mode_kana_write_kana_desc:      'Le son est donné. Trace le kana à la main.',

  mode_kanji_flashcard_f2b:       'Kanji → sens',
  mode_kanji_flashcard_f2b_desc:  'Le kanji est affiché. Retrouve son sens.',
  mode_kanji_flashcard_b2f:       'Sens → kanji',
  mode_kanji_flashcard_b2f_desc:  'Le sens est affiché. Retrouve le kanji.',
  mode_kanji_write_kanji:         'Tracer le kanji',
  mode_kanji_write_kanji_desc:    'Le sens est donné. Trace le kanji à la main.',
  mode_kanji_readings:            'Lectures',
  mode_kanji_readings_desc:       "Le kanji est affiché. Tape ses lectures on'yomi et kun'yomi.",
  mode_kanji_radical:             'Radical',
  mode_kanji_radical_desc:        'Le kanji est affiché. Retrouve son radical.',

  mode_vocab_flashcard_f2b:       'Mot → sens',
  mode_vocab_flashcard_f2b_desc:  'Le mot est affiché. Retrouve son sens.',
  mode_vocab_flashcard_b2f:       'Sens → mot',
  mode_vocab_flashcard_b2f_desc:  'Le sens est affiché. Retrouve le mot.',
  mode_vocab_word_reading:        'Lecture',
  mode_vocab_word_reading_desc:   'Le mot est affiché. Retrouve sa lecture en kana.',

  mode_grammar_flashcard_f2b:      'Structure → sens',
  mode_grammar_flashcard_f2b_desc: 'La structure est affichée. Retrouve son emploi.',
  mode_grammar_flashcard_b2f:      'Sens → structure',
  mode_grammar_flashcard_b2f_desc: 'Le sens est affiché. Retrouve la structure.',
  mode_grammar_fill_in:            'Nommer la règle',
  mode_grammar_fill_in_desc:       'Une phrase japonaise, sans traduction. Nomme la structure employée.',
  mode_grammar_contrast:           'Laquelle convient',
  mode_grammar_contrast_desc:      'Une phrase à trou. Choisis la structure parmi celles qu\'on confond avec elle.',

  mode_standard_flashcard_f2b:      'Recto → verso',
  mode_standard_flashcard_f2b_desc: "Ta carte, telle que tu l'as écrite.",
  mode_standard_flashcard_b2f:      'Verso → recto',
  mode_standard_flashcard_b2f_desc: "Ta carte, dans l'autre sens.",

  mode_fast_review:                'Révision rapide',
  mode_fast_review_desc:           "Parcours ce que tu as déjà étudié. Rien n'est noté.",
  retry:     'Réessayer',
}

// ── Profile ───────────────────────────────────────────────
const profile = {
  // ── Profil ──
  thisWeek:          'Cette semaine',
  records:           'Records',
  currentStreak:     'Série en cours',
  longestStreak:     'Record',
  perfectRun:        'Sans faute',
  perfectRunUnit:    "d'affilée",
  dayUnit:           'jours',
  chaseNext:         (xp, who) => `${xp} XP derrière ${who}`,
  // ── 定期入れ — le profil porte-carte ──
  retention:         'Rétention',
  daysStamped:       'Tamponnés',
  ranking:           'Classement',
  periodWeek:        'Cette semaine',
  periodAll:         'Depuis le début',
  east:              'Est',
  west:              'Ouest',
  passLabel:         "Carte d'abonnement",
  passSince:         (when) => `Depuis ${when}`,
  noActivityWeek:    "Rien d'étudié cette semaine pour l'instant",
  profileTitle:      'Profil',
  profileStale:      "Impossible d'atteindre le serveur — affichage de tes dernières données connues.",
  leaderboard:       'Classement',
  done:              'Terminé',
  genericError:      'Une erreur est survenue. Réessaie.',

  // ── 定期券の裏 — le voyage au dos de la carte (plan 063) ──
  // Les mots de statut japonais (定刻, 遅延…) sont de la signalétique
  // et vivent dans le composant ; voici leurs légendes en clair et
  // les phrases honnêtes à côté du tracé.
  jourStatus: {
    suspended:      'Suspendu',
    ahead:          'En avance',
    onTime:         "À l'heure",
    slightlyBehind: 'Léger retard',
    delayed:        'En retard',
  },
  // Voir en/index.js : les étiquettes VOUS / PLAN et le crochet des
  // jours sont partis avec le dessin à deux voies.
  jourYourLine:      'Ta ligne',
  jourTurnOver:      'Retourner',
  jourFootOnTime:    (a, p, dest, date) =>
    `**${a} par jour**, pile sur les **${p}** promis. L'arrivée à ${dest} tient au **${date}**.`,
  jourFootAhead:     (a, p, dest, days, date) =>
    `**${a} par jour** contre **${p}** promis — ${dest} arrive **${days} jours en avance**, vers le **${date}**.`,
  jourFootBehind:    (a, p, dest, date, days) =>
    `14 derniers jours : **${a} par jour** contre **${p}** promis. À ce rythme, ${dest} arrive le **${date}** — **${days} jours** après la date de ta carte.`,
  jourFootSuspended: (date) =>
    `Aucune étude en 14 jours. Le **${date}** de ta carte ne veut plus rien dire — reprends, ou réimprime-la avec une date qui compte.`,
  jourFootPaceKept:  (a, p) =>
    `14 derniers jours : **${a} par jour** contre **${p}** promis. Pas d'arrivée fixée — le rythme est toute la promesse.`,
  jourFootPaceSuspended: (p) =>
    `Aucune étude en 14 jours contre une promesse de **${p} par jour**. La ligne attend — le portillon s'ouvre avec une seule carte.`,
  jourNoDest:        'Aucune destination sur cette carte.',
  jourNoDestLink:    'En choisir une au guichet',
  // Voir en/index.js : les deux gestes sont un seul choix, donc la
  // seconde ligne est la même phrase des deux côtés — la date
  // d'arrivée. Le lecteur compare deux dates et deux rythmes.
  jourActRecover:    (pace) => `Rouler à ${pace} / jour`,
  jourActRecoverSub: (date) => `arriver le ${date}`,
  jourActReprint:    'Réimprimer la carte',
  jourActReprintSub: (date) => `arriver le ${date}`,
  jourActResume:     'Reprendre la ligne',
  jourActResumeSub:  'la carte ne change pas',
  jourActSlow:       (pace) => `Réimprimer à ${pace} / jour`,
  jourActSlowSub:    (date) => `arriver le ${date}`,
  jourReprintError:  'Réimpression impossible — réessaie.',

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
  signOutDesc:       'Te déconnecter de ton compte sur cet appareil.',
  // Un invité n'a pas de clé : se déconnecter efface le trajet pour
  // de bon. La ligne le dit, plutôt que de le laisser découvrir.
  signOutGuestDesc:  'Sans compte, ta progression ne vit que sur cet appareil : te déconnecter l\u2019effacera définitivement.',
  guestLabel:        'Compte invité',
  guestCap:          'Aucune adresse',
  guestClaimDesc:    'Ta progression est déjà là. Ajoute une adresse et un mot de passe pour la garder — rien n\u2019est déplacé, c\u2019est le même compte.',
  guestClaimConfirm: 'Presque : confirme l\u2019adresse depuis le lien que nous venons de t\u2019envoyer.',
  guestClaimDone:    'Compte créé. Ta progression est gardée.',
  // 相互乗り入れ — Google sur une carte qui a déjà une clé. Nommé
  // simplement : la ligne doit répondre à la question avec laquelle
  // on arrive — « pourquoi me connecter avec Google n’a pas ouvert
  // mon compte ? ». Voir components/settings/AccountPage.jsx.
  linkGoogleLabel:   'Google',
  linkGoogleCap:     'Non connecté',
  linkGoogleDesc:    'Ajoute Google à ce compte, et « Continuer avec Google » ouvrira celui-ci plutôt qu\'une nouvelle carte vide.',

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
  decks:             'Mes decks',
  createDeck:        'Créer un deck',
  deckNamePlaceholder: 'Nom du deck…',
  noDecks:           'Aucun deck pour l\'instant.',
  createFirstDeck:   'Crée ton premier deck ci-dessus.',
  // Voir la version anglaise — l'index de l'étagère, calqué sur la
  // console du dictionnaire.
  decksSearchPlaceholder: 'Chercher un deck…',
  decksAllTypes:     'Tous',
  decksCount:        '{n} decks',
  decksCountOne:     '1 deck',
  decksNoMatch:      'Aucun deck ne correspond.',
  decksNoMatchHint:  'Essaie un autre nom, ou efface les filtres.',
  decksClearFilters: 'Effacer les filtres',
  // Posée directement sur la carte / la barre plutôt que par la
  // boîte confirm() du navigateur — courte, puisqu'elle est en ligne.
  deleteDeckConfirm: 'Supprimer ce deck ?',
  deleteCardsConfirm: 'Supprimer la sélection ?',
  study:             'Étudier',
  deckEdit:          'Modifier',
  deckAddCards:      'Ajouter des cartes',
  deckWriteCard:     'Écrire une carte',
  deckAllCards:      n => `Les ${n} cartes`,
  deckFigs:          { due: 'À réviser', new: 'Nouvelles', learning: 'En cours', mastered: 'Maîtrisées' },
  deckCardState:     { due: 'À réviser', new: 'Nouvelle', learning: 'En cours', mastered: 'Maîtrisée' },
  deckRide:          n => `Réviser ${n} carte${n === 1 ? '' : 's'}`,
  addCard:           '+ Ajouter',
  newCard:           'Nouvelle carte',
  editCard:          'Modifier la carte',
  noCards:           'Aucune carte dans ce deck.',
  addFirstCard:      'Ajoute ta première carte ci-dessus.',
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
  flashcardDesc:     'Tes propres cartes — dans la langue que tu veux',
  kanaType:          'Kana',
  vocabType:         'Vocabulaire',
  vocabDesc:         'Le vocabulaire gradué de N5 à N1\nOu par fréquence, par thème, ou hors programme\nDe la forme au sens, et retour',
  deckKanaDesc:      'Kana uniquement — avec ordre des traits',
  deckVocabDesc:     'Vocabulaire uniquement — issu des niveaux JLPT',
  kanjiType:         'Kanji',
  kanjiDesc:         'Les caractères par niveau, avec l\'ordre des traits\nLes lire, puis les écrire de mémoire\nChaque lecture, chaque sens',
  deckKanjiDesc:     'Kanji uniquement — avec ordre des traits',
  grammarType:       'Grammaire',
  deckGrammarDesc:   'Points de grammaire uniquement — issus des niveaux JLPT',
  mixedType:         'Mixte',
  mixedDesc:         'Tes propres cartes, plus des kanji, du vocabulaire et de la grammaire, le tout mélangé',

  // Parcourir les cartes existantes (BrowseCardsMenu.jsx)
  browseBtn:              'Parcourir',
  browseTitle:            'Parcourir les cartes existantes',
  browseTabKanji:         '漢字 Kanji',
  browseTabVocab:         '語彙 Vocabulaire',
  browseTabGrammar:       '文法 Grammaire',
  browseAllLevels:        'Tous',
  browseSearchPlaceholder: 'Rechercher (kanji, kana, sens…)',
  browseResults:          'Résultats',
  browseSelectedCount:    '{n} sélectionnées',
  searching:              'Recherche…',
  alreadyAdded:           'déjà ajouté',
  adding:                 'Ajout…',
  addSelected:            'Ajouter ({n})',
  browseAddFailed:        "Ces cartes n'ont pas été ajoutées. Réessaie.",
  // Bulk select
  selectAll:         'Tout sélectionner',
  deselectAll:       'Tout désélectionner',

  // Import modal
  importTitle:       'Importer tes données',
  importSubtitle:    'Colle tes données ici — depuis Word, Excel, Google Docs, n’importe où.',
  importPreview:     'Aperçu',
  noPreview:         'Rien à afficher pour l’instant',
  termSep:           'Entre terme et définition',
  cardSep:           'Entre les cartes',
  tab:               'Tabulation',
  comma:             'Virgule',
  custom:            'Personnalisé',
  newRow:            'Nouvelle ligne',
  semicolon:         'Point-virgule',
  importBtn:         'Importer',
  importing:         'Importation…',
  cards:             'cartes',
  andMore:           '… et {n} autres',
  importColumns:     'Colonnes :',
  importRepeat:      'puis {cols}, autant de fois que tu veux',
  importHeaderHint:  'Une première ligne d’en-têtes (Règle, Sens, Exemple, Traduction…) lit les colonnes dans l’ordre de ta feuille. Entoure une cellule de guillemets "…" pour y mettre une virgule ou un retour à la ligne.',
  importExample:     'Insérer un exemple',
  importHeaderFound: 'En-têtes reconnus',
  importIgnoredCols: 'Colonnes ignorées : {cols}',
  importSkipped:     '{n} ignorées',
  importMissing:     'manque : {fields}',

  // Study screen
  studyMode:         "Mode d'étude",
  mixWithJLPT:       'Mêler du contenu JLPT (facultatif)',
  startSession:      'Commencer',
  writePractice:     'Entraînement à l\'écriture',
  revealAnswer:      'Afficher la réponse',
  typeAnswer:        'Tape ta réponse…',
  // Labels des phases pour les decks personnalisés vocab/kanji
  // (StudyScreen.jsx) — K+K→S = Kanji+Kana → Sens, même progression à
  // trois phases que les decks vocab/kanji intégrés.
  studyPhase1:       'Phase 1 — K+K→S',
  studyPhase2:       'Phase 2 — K→S',
  studyPhase3:       'Phase 3 — S→K',

  // ── La bibliothèque ───────────────────────────────────────
  library:               'Bibliothèque',
  libraryBrowse:         'Parcourir',
  librarySeeAll:         'Tout voir',
  libraryMore:           'Afficher plus',
  librarySort:           'Ordre',
  librarySortNew:        'Plus récents',
  librarySortFollowed:   'Plus suivis',
  libraryTypes:          'Types de decks',
  libraryBy:             name => `par ${name}`,
  // The shelf and the library beside the lines on the desk, and the
  // library's three sections (plan 132).
  gateShelfEmpty:        'Aucun deck sur ton étagère.',
  gateShelfEmptyHint:    'Crée le tien, ou suis un deck de la bibliothèque : il se révise avec le reste.',
  gateDeckPublished:     'publié',
  librarySeeCards:       n => `Voir les ${n} carte${n === 1 ? '' : 's'}`,
  libraryFeatured:       'À la une',
  libraryFeaturedWhen:   'cette semaine',
  libraryFollowing:      'Abonnements',
  libraryFollowingCount: n => `${n} deck${n === 1 ? '' : 's'} suivi${n === 1 ? '' : 's'}`,
  libraryFollowingNone:  'Tu ne suis aucun deck. Suis-en un : les cartes que son auteur ajoute arrivent chez toi.',
  libraryNewCards:       n => `+${n} carte${n === 1 ? '' : 's'}`,
  libraryUpToDate:       'À jour',
  libraryMine:           'Tes publications',
  libraryMineCount:      n => `${n} deck${n === 1 ? '' : 's'} publié${n === 1 ? '' : 's'}`,
  libraryMineNone:       'Aucun deck publié. Publie-en un depuis sa page : il apparaît ici avec ses abonnés.',
  libraryWeeksLabel:     list => `Nouveaux abonnés par semaine, sur huit semaines : ${list}`,
  libraryFollowers:      n => (n === 1 ? '1 abonné' : `${n} abonnés`),
  libraryAndMore:        n => (n === 1 ? 'et 1 carte de plus' : `et ${n} cartes de plus`),
  libraryEmpty:          'Rien de publié pour l’instant',
  libraryEmptyHint:      'Dès qu’un autre apprenant publie un deck, il apparaît ici.',
  libraryFailed:         'La bibliothèque est injoignable',
  libraryFailedHint:     'Vérifie ta connexion, puis réessaie.',
  libraryGone:           'Ce deck n’est plus disponible',
  libraryGoneHint:       'Son auteur l’a peut-être retiré.',
  libraryOpen:           'Ouvrir',
  libraryFollow:         'Suivre',
  libraryPublish:        'Publier dans la bibliothèque',
  libraryPublished:      'Ce deck est dans la bibliothèque.',
  libraryUnpublish:      'Retirer de la bibliothèque',
  libraryMakeMine:       'En faire ma copie',
  libraryMakeMineConfirm: 'Cela crée ta propre copie modifiable du deck, en gardant la progression déjà faite. Tu cesses de suivre l’original.',
  libraryUnfollow:       'Ne plus suivre',
  libraryUnfollowConfirm: 'Le deck quitte ton étagère. Ta progression est conservée : le suivre à nouveau la retrouve.',
  libraryRemove:         'Retirer',
  libraryRemoveConfirm:  'Le deck quitte définitivement ton étagère. Fais-en une copie d’abord si tu veux le garder.',
  libraryWithdrawn:      'Retiré.',
  libraryWithdrawnHint:  ' Son auteur a supprimé ce deck. Pendant quelque temps encore, tu peux l’étudier et en faire ta copie.',
  libraryDeleteFollowed: n => (n === 1
    ? '1 apprenant suit ce deck. Le supprimer le retire aussi de son étagère — il sera prévenu et disposera d’un délai pour le copier.'
    : `${n} apprenants suivent ce deck. Le supprimer le retire aussi de leurs étagères — ils seront prévenus et disposeront d’un délai pour le copier.`),
  libraryReport:         'Signaler',
  libraryReported:       'Signalé',
  libraryReportNote:     'Cela signale le deck pour examen. Rien n’est masqué automatiquement.',
  libraryReasonSpam:      'Spam ou publicité',
  libraryReasonOffensive: 'Contenu offensant',
  libraryReasonWrong:     'Japonais incorrect',
  libraryReasonCopyright: 'Copié sans autorisation',
  libraryReasonOther:     'Autre chose',

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
  examGenerating:      'Rédaction de ton examen…',
  examGeneratingHint:  'Une épreuve n’est rédigée que s’il n’en existe aucune que tu n’aies déjà passée — compte une à deux minutes. Une fois écrite, elle se charge instantanément, pour toi comme pour les autres.',
  examLoadFailed:      "Cette épreuve n'a pas pu être générée pour le moment.",
  examLoadFailedHint:  'Le rédacteur de questions est peut-être momentanément indisponible. Réessaie dans un instant.',
  // Affiché à la place de examLoadFailedHint (et du bouton Réessayer)
  // pendant que le serveur refuse de nouvelles tentatives : relancer
  // une génération coûte plusieurs minutes et des dizaines d'appels.
  examLoadFailedCooldown: (minutes) =>
    `Le rédacteur de questions fait une pause après un échec. Réessaie dans environ ${minutes} minute${minutes === 1 ? '' : 's'}.`,
  examRetry:           'Réessayer',

  examSectionEmpty:    'Cette section ne contient encore aucune question.',
  examAnswered:        'répondue',
  examFinishSection:   'Terminer',
  examQuestionAbbrev:  'Q',
  examResultMissing:   "Ce résultat n'est plus disponible — recommence l'examen.",
  examBackToExams:     'Retour aux examens',
  // L'action secondaire de chaque épreuve dans le sélecteur, et
  // l'action principale de l'écran de résultat. Les deux demandent une
  // AUTRE épreuve, pas la même — voir backend/study/exam_schema.py.
  examFreshPaper:      'Autre épreuve',
  examFreshPaperHint:  "Remplacer cette épreuve par une autre. Si personne n'en a encore écrit, compte une à deux minutes.",
  examNewPaper:        'Nouvelle épreuve',
  examStarHint:        "Quel élément va à la position marquée d'une étoile ?",
  examFullSentence:    'Phrase complète :',
  examAudioPending:    'L’audio de cette question n’a pas encore été généré.',
  examAudioUnavailable: 'L’audio de cette question n’a pas pu être chargé.',

  // ── Résultat ──
  // Ne jamais appeler cela une note JLPT. La vraie est un 尺度得点
  // calibré par IRT à partir de paramètres d'items officiels dont
  // aucun tiers ne dispose : l'honnête est d'afficher la proportion
  // brute de bonnes réponses et un objectif d'entraînement, en le
  // disant clairement.
  examScoreCorrect:    'correctes',
  examPracticeTarget:  "Objectif d'entraînement",
  examUnofficialNote:  'Score non officiel — proportion brute de bonnes réponses, pas une note JLPT calibrée.',
  examReviewTitle:     'Revoir tes réponses',
  examReviewHint:      'Touche une question pour la revoir avec la bonne réponse.',
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
  examYourAnswer:      'Ta réponse',
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
  examSubmitFailed:    "Impossible d'envoyer tes réponses — ta progression est conservée.",
  examSubmitRetry:     "Réessayer l'envoi",
  examSubmitting:      'Envoi…',

  // ── Quitter en cours d'épreuve ──
  examLeaveTitle:      'Quitter cette épreuve ?',
  examLeaveBody:       'Tes réponses et le chronomètre sont enregistrés — rouvrir cette épreuve reprend où tu en étais.',
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
  // Bienvenue : l’enseigne, le matériel roulant, la promesse. Pas un
  // calque de l’anglais : la ligne française est la sienne. Toute la
  // table tutoie, comme elle — le choix du propriétaire, pour l’élan.
  brdTagline: 'Un trajet taillé pour toi.',
  brdBoard: 'Embarquer',
  // 辻 (plan 163): the desk's front door, its corner and the way back to it.
  brdHaveAccountQ: 'Déjà un compte ?',
  brdNoAccountYet: 'Pas encore de compte ?',
  brdBackHome: 'Retour à l’accueil',
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
  nativeReturnNote:  'Connecté. Retour vers l’application…',
  nativeReturnOpen:  'Ouvrir Tsuji',
  oauthLinkingOff: 'Google ne peut pas être ajouté à cette carte pour le moment. Une adresse e-mail, si.',
  // 本乗車券 — mettre une adresse sur la carte (lib/guest.js). Même
  // règle que les deux au-dessus : nommer ce qui s'est passé, et
  // nommer la voie qui reste ouverte. Les phrases de Supabase sont
  // celles d'un développeur, et sur cette demande l'une d'elles cite
  // une adresse vide au lieu de celle du champ — voir
  // lib/authErrors.js.
  claimEmailTaken: 'Cette adresse a déjà une carte. Connecte-toi avec elle.',
  claimEmailUnreachable: 'La confirmation n\u2019a pas pu être envoyée à cette adresse. Essaie-en une autre, ou garde ta progression avec Google.',
  claimWeakPassword: 'Ce mot de passe est trop facile à deviner. Essaie-en un plus long.',
  claimTooSoon: 'Trop de tentatives pour le moment. Attends une minute et réessaie.',
  // Dernier arrêt : le compte, proposé une fois tout vu — et
  // refusable. « Garder » plutôt que « créer » : la progression
  // existe déjà, on ne fait qu'y mettre une clé (lib/guest.js).
  brdAccountQ: 'Garde ta progression.',
  brdAccountCreate: 'Créer mon compte',
  brdAccountSkip: 'Continuer sans compte',
  // 辻 (plan 163): the desk's account, beside the ticket it keeps.
  brdTicketKind: 'Billet · Tsuji',
  brdIssued: (date) => `Émis le ${date}`,
  brdCreditsOffered: 'crédits offerts',
  brdPunched: 'Composté',
  brdTermService: 'Service',
  brdTermRoute: 'Trajet',
  brdTermValid: 'Valable jusqu’au',
  brdServiceValue: (name, n) => `${name} · ${n} / jour`,
  brdTicketNote: 'Sans compte, ton billet reste sur cet appareil.',
  brdDemoTag: { kanji: 'Kanji', vocab: 'Vocabulaire', grammar: 'Grammaire', dictation: 'Dictée', reading: 'Lecture', kana: 'Kana', translation: 'Traduction', analyzer: 'Analyseur', exam: 'Examen blanc' },
  // Les questions.
  brdNameQ: 'Comment tu t’appelles ?',
  brdNameAria: 'Ton nom',
  // L’adresse à laquelle la carte est émise, dite dès la première
  // question. L’embarquement ne tourne que sur un compte vierge :
  // une adresse ici veut donc toujours dire une NOUVELLE carte pour
  // cette adresse — la seule chose à dire à qui voulait retrouver
  // l’ancienne, avant sept questions. Un invité n’a pas d’adresse et
  // ne voit rien. « Ci-dessous » : le lien de connexion, en pied.
  brdNameNewPass: email => `Une nouvelle carte, pour ${email}. Si ton trajet est sur un autre compte, connecte-toi ci-dessous.`,
  brdWhyQ: (name) => `Pourquoi tu apprends le japonais, **${name}** ?`,
  brdMotive: { studies: 'Pour mes études', fun: 'Pour le plaisir', trip: 'Pour un voyage au Japon', live: 'Pour vivre au Japon', friends: 'Pour me faire des amis', other: 'Autre chose' },
  brdKanaQ: 'Tu sais lire ça ?',
  brdKana: { hiragana: 'Hiragana', katakana: 'Katakana', both: 'Les deux', none: 'Pas encore' },
  brdKanaWord: { sushi: 'sushi', hotel: 'hôtel' },
  brdRevealQ: 'Bientôt, tu liras les deux.',
  // 辻 (plan 163): the desk's kana question and reveal, drawn as the
  // owner's D03 -- each answer says what it reads, then its name.
  brdKanaHint: 'Choisis ce que tu lis déjà.',
  brdKanaOnly: (jp) => `Seulement ${jp}`,
  brdKanaSays: { hiragana: 'Les hiragana', katakana: 'Les katakana', both: 'Hiragana et katakana', none: 'On commence par là' },
  brdRevealLead: 'Deux écritures de 46 signes chacune. Voici comment se lisent ces deux mots.',
  brdRevealMeans: 'veut dire',
  brdRevealWord: (word) => `« ${word} »`,
  brdRevealFirst: (date, min) => `Ton premier arrêt : **les kana**, lus d’ici le **${date}** à ${min} min par jour.`,
  brdLevelQ: 'Super ! Quel est ton niveau ?',
  brdLevelHint: 'Les arrêts derrière toi seront marqués connus.',
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
  brdGoalQ: 'Quel est ton objectif ?',
  brdGoalHint: (level) => `Les arrêts après ${level}.`,
  // Personne n’a d’arrêt derrière soi avant les kana : la liste s’ouvre
  // sur celui du novice et ne nomme donc aucun niveau (goalStops).
  brdGoalHintStart: 'Tous les arrêts sont devant toi.',
  brdNextStop: 'Prochain arrêt',
  // Les lignes : quoi apprendre. Les kana ne sont pas une ligne à
  // choisir -- chaque billet les emprunte -- l’indication le dit
  // (components/boarding/LinesStep.jsx).
  brdLinesQ: 'Que veux-tu apprendre ?',
  brdLinesHint: 'Les kana sont sur chaque billet. Choisis le reste.',
  brdLinesNone: 'Choisis au moins une ligne.',
  brdLine: { vocab: 'Vocabulaire', kanji: 'Kanji', grammar: 'Grammaire' },
  brdLineDesc: {
    vocab: 'Les mots, de N5 à N1',
    kanji: 'Lectures, sens, écriture',
    grammar: 'Les structures, avec des exemples',
  },
  // 辻 (plan 163): the desk's lines -- the kana's strip and what each
  // line carries on the ride to its goal.
  brdKanaFirst: 'hiragana et katakana, en premier',
  brdOnEveryTicket: 'Sur chaque billet',
  brdLineCarries: {
    vocab: (stop) => `mots jusqu’au ${stop}`,
    kanji: (stop) => `kanji jusqu’au ${stop}`,
    grammar: (stop) => `points jusqu’au ${stop}`,
  },
  brdLinesArrive: (n, stop, date) => `${n === 1 ? 'Avec cette ligne' : n === 2 ? 'Avec ces deux lignes' : 'Avec ces trois lignes'}, arrivée au ${stop} en **${date}**.`,
  brdRhythmQ: 'Quel est ton rythme ?',
  // 辻 (plan 163): the desk's four roads -- a rhythm's minutes and its
  // service, and the days its ride takes.
  brdRhythmHint: 'Plus tu roules chaque jour, plus tôt tu arrives. Modifiable plus tard.',
  brdADay: 'par jour',
  brdRhythmName: { 5: 'Omnibus', 10: 'Rapide', 15: 'Rapide spécial', 20: 'Express' },
  brdRideDays: (n) => (n === 1 ? '1 jour' : `${n} jours`),
  brdMinADay: 'min par jour',
  brdNewItems: (n) => `~${n} nouveautés`,
  brdChangeLater: 'Modifiable plus tard.',
  brdTimeQ: 'Quand étudies-tu ?',
  brdDeparture: 'Départ',
  brdDayAria: 'Heure de départ',
  // 辻 (plan 163): the desk's hour, the day as the sun's arc.
  brdTimeHint: 'Ton train part chaque jour à cette heure.',
  brdYourTrain: 'Ton train',
  brdThenDaily: 'puis chaque jour',
  brdTimeFine: 'ou glisse le train le long du jour, par demi-heure',
  // Le rappel (natif seulement), et la notification telle que l’appli
  // l’envoie. brdAppName est le nom sur les stores ; à garder en
  // phase avec appName dans capacitor.config.json.
  brdNudgeQ: (time) => `Un rappel à **${time}** ?`,
  brdAppName: 'Tsuji',
  brdNotifNow: 'maintenant',
  brdNotifTitle: (time) => `Ton train part à ${time}`,
  brdNotifText: 'Tes cartes t’attendent au portillon.',
  brdNudgeHint: 'Un par jour, à ton heure. Jamais plus.',
  brdAllow: 'Activer le rappel',
  brdNotNow: 'Pas maintenant',
  // ── 発車案内 — le rappel du jour tiré de la file, le widget et
  // Réglages › Notifications (plan 156). Le titre et le texte du rappel
  // disent ce que le portillon tiendra à l’heure de l’apprenant.
  nudgeTitle: (time, n) => `Ton train de ${time} · ${n} ${n > 1 ? 'cartes' : 'carte'}`,
  nudgeMinutes: (m) => (m <= 1 ? 'Environ une minute' : `Environ ${m} min`),
  nudgeNew: (n) => `${n} ${n > 1 ? 'nouvelles' : 'nouvelle'}`,
  nudgeLine: { kana: 'Kana', vocab: 'Vocabulaire', kanji: 'Kanji', grammar: 'Grammaire' },
  nudgeWhen: { today: 'Aujourd’hui', tomorrow: 'Demain' },
  widgetTitle: 'Ton train du jour',
  widgetUnit: (n) => (n > 1 ? 'cartes' : 'carte'),
  widgetMinutes: (m) => `${m} min`,
  widgetClear: 'Voie libre',
  settingsNotif: 'Notifications',
  notifOff: 'Désactivées',
  notifDaily: 'Le train du jour',
  notifDailyCap: 'Un par jour',
  notifRemind: 'Me le rappeler',
  notifOnOff: { on: 'Oui', off: 'Non' },
  notifRule: 'Seulement un jour où des cartes t’attendent, et jamais une fois ton trajet fait.',
  notifNoHour: 'Choisis une heure de départ pour recevoir le rappel.',
  notifDenied: 'Les notifications de Tsuji sont coupées dans les réglages de ton téléphone.',
  notifQuiet: 'Rien à revoir à ton heure cette semaine : aucun train à annoncer.',
  notifNextAria: 'Le prochain rappel',
  notifFailed: 'Le prochain rappel n’a pas pu être calculé.',
  notifWidget: 'Le widget',
  notifWidgetCap: { ios: 'Écran verrouillé', android: 'Écran d’accueil' },
  notifWidgetHow: {
    ios: 'Maintiens ton doigt sur l’écran verrouillé, touche Personnaliser, puis ajoute Tsuji.',
    android: 'Maintiens ton doigt sur l’écran d’accueil, touche Widgets, puis fais glisser Tsuji.',
  },
  notifWidgetWhat: 'Il affiche les cartes du jour et un mot que tu connais, jamais un mot à revoir cette semaine.',
  // L’arrivée : le plan, la carte.
  brdBuildingAria: 'Préparation de ton trajet',
  // 机 (plan 140) : les arrêts de la colonne du bureau, un par question.
  brdStop: { name: 'Nom', why: 'Pourquoi', kana: 'Kana', level: 'Niveau', goal: 'Objectif', lines: 'Lignes', rhythm: 'Rythme', time: 'Départ', nudge: 'Rappel' },
  brdArrivalTitle: 'Ton plan',
  brdPlanQ: (name) => `Ton plan est prêt, **${name}**.`,
  brdFor: { studies: 'pour tes études', fun: 'pour le plaisir', trip: 'pour ton voyage', live: 'pour ta vie au Japon', friends: 'pour tes amis', other: 'pour toi' },
  // Un chiffre par ligne du billet.
  brdFigWords: (n) => `~${n} mots`,
  brdFigKanji: (n) => `~${n} kanji`,
  brdFigGrammar: (n) => `~${n} points de grammaire`,
  // L’arrêt du novice pris comme objectif : les kana, puis la ligne qui
  // attend derrière. Pas de compte de mots, et aucune promesse de
  // motif — trois semaines de signes ne font pas un drama sans pause.
  brdBulletKana: 'Les deux écritures kana, lues à vue',
  brdBulletThenLine: 'Puis toute la ligne, arrêt par arrêt',
  // Deux promesses par motif (la note « boarding » de la maquette).
  brdPromise: {
    studies: ['Tes supports de cours', 'Les termes clés d’un cours'],
    fun: ['Des cases de manga, des paroles', 'Un drama sans pause'],
    trip: ['Lire les panneaux, les menus, les billets', 'Demander son chemin, commander, réserver une chambre'],
    live: ['La mairie, la banque, le médecin', 'Ton courrier et tes contrats'],
    friends: ['Discuter par message', 'Une conversation au dîner'],
    other: ['Lire ce que tu croises chaque jour', 'Dire ce que tu veux dire'],
  },
  brdOnTrackKana: 'En route vers les kana',
  brdPassQ: (name) => `Ta carte est prête, **${name}**.`,
  brdEnjoy: 'Bon voyage.',
  brdCreditsGift: (n) => `+${n} crédits offerts`,
  brdEnter: 'Entrer en gare',
  // 辻 (plan 163): the desk's plan, the ride drawn to scale -- its stops'
  // days and names, what the terminus holds, what the ride is for.
  brdInDays: (n) => (n === 1 ? 'demain' : `dans ${n} jours`),
  brdEvery: { am: 'chaque matin', noon: 'chaque midi', pm: 'chaque soir' },
  brdAtTime: (every, time) => `${every} à ${time}`,
  brdKanaDone: 'Kana lus',
  brdBothScripts: 'hiragana et katakana',
  brdTerminus: (stop) => `Terminus · ${stop}`,
  brdAtTerminus: 'Au terminus, tu connaîtras',
  brdUnit: { vocab: 'mots', kanji: 'kanji', grammar: 'points de grammaire' },
  brdUnitKana: 'signes',
  // 辻 on a phone (plan 167): the kana over the lines' hub, the board's
  // arrival column and first stop, the hour's arrows and first train, the
  // plan's arrival and what the ride is for.
  brdKanaFirstShort: 'Kana, en premier',
  brdArriveAt: (stop) => `Arrivée au ${stop}`,
  brdFirstStop: (date) => `Premier arrêt : les kana, lus d’ici le **${date}**`,
  brdHourLater: 'Une heure plus tard',
  brdHourEarlier: 'Une heure plus tôt',
  brdHalfLater: 'Une demi-heure plus tard',
  brdHalfEarlier: 'Une demi-heure plus tôt',
  brdTrainAt: (today, time) => `Ton train · ${today ? 'aujourd’hui' : 'demain'}, **${time}**, puis chaque jour`,
  brdArriveIn: (days, every, time) => `${days === 1 ? '**demain**' : `dans **${days} jours**`}, ${every} à ${time}`,
  brdForLine: (purpose, promise) => `${purpose.charAt(0).toUpperCase()}${purpose.slice(1)} : **${promise.charAt(0).toLowerCase()}${promise.slice(1)}**.`,
}

const ride = {
  // 試乗 — l'essai (plan 098) : les deux premières cartes, sur la vraie
  // scène. Une phrase par étape, à côté de ce dont elle parle ; la
  // paire nomme le lieu (la tête de scène), les notes ne le répètent pas.
  rideDocumentTitle: 'Essai',
  rideJp: '試乗',
  rideCap: 'Essai',
  rideSkip: 'Passer',
  rideKnownFront: 'Voici ta première carte. Touche-la pour la retourner.',
  rideKnownBack: 'Tu la connaissais ? Sois honnête : c’est toi qui te notes.',
  rideUnknownFront: 'Celle-ci, tu ne la connais pas. Retourne-la.',
  rideUnknownBack: 'Choisis « Raté ». Ce n’est pas un échec : la carte revient juste plus tôt. Tout le secret est là.',
  // 机 (plan 115) : les mêmes notes, avec les touches du bureau.
  rideKnownFrontDesk: 'Voici ta première carte. Clique dessus ou appuie sur Espace pour la retourner.',
  rideKnownBackDesk: 'Tu la connaissais ? Sois honnête : c’est toi qui te notes, sur la barre ou avec les touches chiffrées.',
  rideUnknownFrontDesk: 'Celle-ci, tu ne la connais pas. Retourne-la : un clic ou Espace.',
  rideUnknownBackDesk: 'Choisis « Raté », sur la barre ou avec sa touche. Ce n’est pas un échec : la carte revient juste plus tôt. Tout le secret est là.',
  rideGuessed: 'Tu as trouvé la nouvelle ? Si c’était au hasard, choisis « Raté » la prochaine fois. Sinon, elle ne reviendra pas avant plusieurs jours.',
  rideDoneBody: n => `C’est tout ! **${n} nouveaux mots par jour**, chacun de retour juste avant que tu l’oublies.`,
  rideContinue: 'Continuer',
  // L'essai de lecture (plan 099) : la phrase, le champ, la mesure,
  // puis la plaque qui dit quels quais sont sur l'abonnement.
  rideReadFront: 'Lis vite, elle disparaît dans un instant !',
  rideReadFrontUntimed: 'Lis-la, puis écris-la en rōmaji ou en kana.',
  rideReadType: 'Écris ce que tu as lu, en rōmaji ou en kana.',
  rideReadMeasure: 'Le score montre ce que tu as saisi. À toi de te noter.',
  rideReadMeasureDesk: 'Le score montre ce que tu as saisi. À toi de te noter : sur la barre, ou avec les touches chiffrées.',
  // Plan 133. Sur un téléphone : la carte connue ne se note qu'une fois
  // sa fiche ouverte depuis la 🔍, puis refermée.
  rideKnownDict: 'Chaque carte a sa fiche de dictionnaire. Touche 🔍 pour ouvrir celle-ci, puis referme-la.',
  ridePlateCap: 'L\'abonnement',
  ridePlateBody: 'Ces exercices font partie de l’abonnement.',
  ridePlateOpen: 'Pour l’instant, ils sont ouverts à tous.',
}

const guide = {
  // 案内 — le guide sur chaque porte (plan 100) : une phrase par arrêt,
  // à côté de ce dont elle parle. La note portait un mot japonais qui
  // nommait l'arrêt jusqu'au 21/09/2026 ; la phrase est la note.
  guideLabel: 'Guide',
  guideNext: 'Suivant',
  guideDone: 'Terminé',
  guideSkip: 'Passer',
  guideTodayGate: 'Tes révisions du jour, ligne par ligne. Désactive-en une pour plus tard, puis embarque.',
  guideTabBar: 'Tes cinq onglets : Apprendre, Pratique, Aujourd’hui, Dictionnaire et ton profil.',
  guideLearnPlate: 'Une ligne. Touche-la pour l’ouvrir. La pastille montre ce qui t’attend aujourd’hui.',
  guideLearnStops: 'Où tu en es sur la ligne, et les arrêts autour.',
  guideLearnShelf: 'Tes propres decks, et la bibliothèque des decks partagés par les autres.',
  guidePracticePlate: 'Un exercice : lire, comprendre, traduire, écouter ou écrire de vraies phrases.',
  guidePracticeDests: 'Les niveaux. Le tien est marqué : touche-en un autre pour l’essayer quand même.',
  guidePracticePass: 'Ces exercices font partie de l’abonnement.',
  guideDictConsole: 'Cherche par mot, lecture ou sens.',
  guideDictOptions: 'Affine ta recherche : mot exact, début ou n’importe où. Dans le japonais, le sens ou les deux.',
  guideDictChips: 'Parcours par collection. Tes favoris sont au bout.',
  guideDictEntry: 'Touche une entrée pour l’ouvrir. Son ＋ la garde en favori ou l’ajoute à l’un de tes decks.',
  guideDictAnalyzer: 'L’analyseur : colle, photographie ou filme du japonais, et il le décortique pour toi.',
  guideProfilePass: 'Ta carte : ton nom, ton niveau et ton solde.',
  guideProfileStamps: 'Ta carte de tampons : un tampon par jour d’étude.',
  guideProfileRecords: 'Tes chiffres : tes révisions, ce que tu retiens, ta meilleure série sans faute.',
  guideProfileLedger: 'Chaque ligne, et le chemin parcouru.',
  guideProfileSettings: 'Réglages : ton niveau, ton rythme, ta façon de noter, et ce guide quand tu veux.',
  guideLearnLibrary: 'La bibliothèque : des decks partagés par d’autres. Ouvre-en un pour le découvrir ; suis-le pour l’étudier.',
  guidePracticeExam: 'L’examen blanc : une épreuve type JLPT au niveau de ton choix, corrigée dès que tu la rends.',
  guideDictActions: 'Écoute-la, ou utilise ＋ pour la garder en favori ou l’ajouter à l’un de tes decks.',
  guideProfileStats: 'Statistiques : ce qui reste et ce qui t’échappe, ligne par ligne.',
  guideProfileBoard: 'Le classement en XP : cette semaine et depuis toujours.',
  // 机 (plan 115) : les notes qui enseignent les touches et les portes du bureau.
  guideTabBarDesk: 'Tes cinq sections, à gauche. Appuie sur / n’importe où pour chercher dans le dictionnaire.',
  guideTodayGateDesk: 'Tes révisions du jour, ligne par ligne. Désactive-en une pour plus tard, puis embarque. Entrée le fait de n’importe où ici.',
  guideLearnStopsDesk: 'Toute la ligne. Clique sur un arrêt pour l’étudier.',
  // Pour un pointeur (plan 123) : les notes qui disaient « touchez ».
  guideLearnPlateDesk: 'Une ligne. Clique dessus pour l’ouvrir. La pastille montre ce qui t’attend aujourd’hui.',
  // Au bureau, les quais ne portent plus leurs niveaux (plan 165) : l'arrêt
  // y est sauté, mais sa note reste dite pour un pointeur.
  guidePracticeDestsDesk: 'Les niveaux. Le tien est marqué : clique sur un autre pour l’essayer quand même.',
  guidePracticePlateDesk: 'Un exercice, et ce qu’il te demandera à ton niveau. Clique dessus pour l’ouvrir.',
  guideDictEntryDesk: 'Une entrée, ouverte à côté de la liste. ← et → pour parcourir la liste.',
  // Réglages, les deux retours.
  settingsFirstRide: 'Premier essai',
  settingsRideAgain: 'Refaire l\'essai',
  settingsGuideAgain: 'Revoir le guide',
  settingsGuideAgainDone: 'Il réapparaîtra la prochaine fois que tu ouvriras chaque section.',
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
  onbTestStop: 'M’arrêter ici — place-moi d’après mes réponses',
  onbTestFinish: 'Voir le résultat',
  onbTestError: 'Le test n’a pas pu être chargé. Réessaie dans un instant.',
  onbTestRetake: 'Repasser le test',
  onbTestResult: (level, correct, total) => `${correct} bonnes réponses sur ${total} — on te conseille d’embarquer à ${level}.`,
  onbPaceRecommended: 'Recommandé',
  onbPassError: 'L’enregistrement a échoué — vérifie ta connexion et réessaie.',
  brdPassRefused: 'Le guichet n’a pas pu émettre ce titre — cela vient de nous, pas de ta connexion. Rien n’a été enregistré.',
  // Le rythme quotidien, vécu : la jauge 新規 du hall et le terminus
  // de session des écrans d'étude (voir components/study/usePace.js).
  paceDoneTitle: 'Objectif du jour atteint',
  paceDoneOf: target => `sur ${target}`,
  paceDoneLabel: 'nouveautés aujourd’hui',
  paceDoneBody: 'C’est la part de nouveautés du jour. Les révisions continuent comme d’habitude.',
  paceExtraTrain: 'Encore des nouveautés',
  paceGaugeLabel: 'Nouveautés',
  paceGaugeAria: (n, target) => `${n} nouveautés apprises sur ${target} aujourd’hui`,
  settingsLearning: 'Apprentissage',
  settingsJlptLevel: 'Niveau JLPT',
  settingsPace: 'Rythme quotidien',
  // Les lignes empruntées (backend core/lines.py) : le portillon
  // Apprendre les accroche en premier et le plan est chiffré sur
  // elles. Les kana ne se décochent pas -- chaque billet les emprunte.
  settingsLines: 'Tes lignes',
  settingsLinesCap: 'Ce que tu apprends',
  settingsLinesHint: 'Les kana sont sur chaque billet. Une ligne au moins reste allumée.',
  settingsLineOn: 'Sur ton trajet',
  settingsLineOff: 'Hors de ton trajet',
  plateOffRoute: 'Hors de ton trajet',
  // Le relevé d'un niveau sur un quai de Pratique, au bureau (plan 130) :
  // ce qui a été fait à ce niveau, puis la part juste. L'espace avant le
  // % est insécable, comme partout en français.
  practiceDone: {
    sentences: n => `${n} phrase${n > 1 ? 's' : ''}`,
    texts: n => `${n} texte${n > 1 ? 's' : ''}`,
    papers: n => `${n} épreuve${n > 1 ? 's' : ''}`,
  },
  practiceRight: pct => `${pct}\u00a0% justes`,
  practiceNotYet: 'Pas encore',
  // ── La station de pratique, au bureau (plan 159) ─────────────
  // La source en interrupteur en tête de la liste (les grades JLPT, la
  // fréquence, tes cartes), puis la page de l'arrêt ouvert : ce que
  // l'exercice demande, sa forme, quatre chiffres, tes derniers ratés
  // et les points du grade.
  practiceSourceFrequency: 'Fréquence',
  practiceHow: {
    reading: 'Lis la phrase avant que le chrono ne la couvre, puis écris sa lecture en rōmaji.',
    translation: 'Une phrase à dire en japonais, puis une réponse de référence et l’avis du tuteur.',
    comprehension: 'Un texte court, puis ses questions — l’épreuve de lecture de l’examen, en répétition.',
    dictation: 'Deux écoutes, pas une de plus : écris en rōmaji ce que tu entends.',
    composition: 'Un point de grammaire est donné : écris une phrase qui l’emploie, un tuteur la relit.',
    // Sur la plaque du quai, au bureau (plan 165) : la question que son
    // puits montre.
    exam: 'Une question au format JLPT, ici 漢字読み : la lecture du mot souligné.',
  },
  practiceBank: {
    sentences: n => `${n} phrases écrites pour le grade.`,
    texts: n => `${n} questions par texte.`,
    clips: n => `${n} phrases enregistrées pour le grade.`,
    points: n => `${n} points à employer.`,
  },
  practiceSpecTag: {
    sentence: 'Une phrase du grade',
    text: 'Un texte du grade',
    clip: 'Une phrase du grade, à l’oreille',
    point: 'Un point du grade',
    tier: 'Des mots du palier',
    mine: 'Tes mots',
  },
  practiceFig: {
    sentences: 'Phrases',
    texts: 'Textes',
    right: 'Justes',
    questions: 'Questions justes',
    words: 'Mots du grade',
    tierWords: 'Mots vus du palier',
    met: 'Mots rencontrés',
    last: 'Dernier trajet',
  },
  practiceMisses: 'Tes phrases manquées',
  practiceMissedPoints: 'Tes points manqués',
  practiceTexts: 'Tes textes',
  practiceNoMisses: 'Aucune phrase manquée pour l’instant.',
  practiceNoTexts: 'Aucun texte lu pour l’instant.',
  practicePoints: 'Les points du grade',
  practiceTextPoints: 'Les points des textes',
  practicePointsStudied: (n, of) => `${n} / ${of} étudiés`,
  practicePointStudied: 'étudié',
  practiceTierTitle: (tier, from, to) => `Palier ${tier} · mots ${from} à ${to}`,
  practiceTierDesc: list => `Des phrases autour des mots de ce palier (${list}), classés par fréquence réelle à l’écrit.`,
  practiceTierWords: 'Les mots du palier',
  practiceTierSeen: (n, of) => `${n} / ${of} vus`,
  practiceMineDesc: 'Des phrases dont chaque mot est l’un de ceux que tu as déjà rencontrés.',
  practiceMineNote: 'Rien que des mots que tu as déjà vus',
  // L'examen blanc au bureau : chaque épreuve en rangée (plan 159).
  examGradeDesc: 'Quatre épreuves au format JLPT, chronométrées et notées — notation non officielle.',
  examNext: label => `Suivante · ${label}`,
  examLastScore: 'Ton dernier score',
  examMinutes: n => `≈\u00a0${n}\u00a0min`,
  settingsRedoDesc: 'Repasse-le une fois que tu as progressé — ton niveau suit.',
  // ── Quelle barre de notation ────────────────────────────────
  // Deux boutons, quatre ou six. Les trois envoient la même note au
  // planificateur — chaque barre plus courte est une plus longue sans
  // certains boutons — donc ceci change ce qui vous est proposé,
  // jamais le sens de vos réponses.
  settingsRatingScale: 'Boutons de notation',
  settingsRatingScaleOption: { binary: '2 niveaux', simple: '4 niveaux', full: '6 niveaux' },
  settingsRedoApply: (level) => `Passer à ${level} ?`,
  levelCurrentMark: 'Tu es ici',

  // ── 窓口 — les réglages au guichet ─────────────────────────
  // Les intitulés des guichets, puis la seconde voix de chaque
  // contrôle : ce que le bouton FAIT, en clair, sous son nom — sur un
  // écran de paramètres, rien ne doit se deviner.
  settingsEnvironment: 'Affichage & langue',
  // Le mot court que porte un onglet du rail ; le bordereau imprime
  // le titre complet.
  settingsEnvShort: 'Affichage',
  settingsData: 'Données',
  settingsRedo: 'Test de placement',
  settingsCredits: 'Crédits',
  // The pass's contract and the rows under it (plan 140).
  passFieldHour: 'Trajet',
  passFieldLines: 'Lignes',
  settingsRatingShort: 'Notation',
  // ── Le rythme de lecture ────────────────────────────────────
  // Combien de temps Lecture laisse une phrase affichée et
  // Compréhension un texte : pour qui lit lentement, pour les
  // lecteurs dyslexiques, pour qui le chrono gêne plus qu'il n'aide.
  settingsReadingPace: 'Rythme de lecture',
  settingsReadingPaceHint: 'Le temps pour lire une phrase en Lecture et un texte en Compréhension avant qu’ils ne se cachent. Prends-en plus si tu lis lentement ou si tu es dyslexique.',
  readingPaceOption: { standard: 'Standard', relaxed: 'Posé', slow: 'Lent', untimed: 'Sans limite' },
  // La puce au bout du chrono, en Lecture et en Compréhension : chaque
  // appui passe au rythme suivant.
  readingPaceShort: { standard: '×1', relaxed: '×1,5', slow: '×2', untimed: '∞' },
  readingPaceChip: name => `Rythme de lecture : ${name}. Appuie pour changer`,
  readingPaceDesc: {
    standard: 'Le temps prévu',
    relaxed: 'Moitié plus de temps',
    slow: 'Deux fois plus de temps',
    untimed: 'Rien ne se cache avant ta réponse',
  },
  settingsHelp: 'Aide',
  settingsHelpValue: 'Essai · Guide',
  settingsCreditsCount: n => `${n} sources`,
  settingsPaceMinutes: m => `≈ ${m} min`,
  settingsYourPace: 'Ton rythme',
  settingsYourPaceSub: n => `${n} / jour · 14 derniers jours`,
  settingsInsteadOf: d => `au lieu du ${d}`,
  creditsWhat: { dictionary: 'Dictionnaire', kanji: 'Kanji', strokes: 'Ordre des traits', sentences: 'Phrases d’exemple', voice: 'Voix des gares', speech: 'Voix japonaise', kana: 'Voix des kana', type: 'Polices' },
  themeDark: 'Sombre',
  themeLight: 'Clair',
  themeAuto: 'Système',
  themeAutoHint: 'Suit le réglage de ton appareil',
  // Chaque bouton porte sa propre légende — pas de libellé de rangée.
  // Silencieux : ambiance, jingle, annonces ; les sons d'étude ne
  // bougent jamais.
  soundQuietPreset: 'gare silencieuse',
  soundFullPreset: 'gare animée',
  volumeMaster: 'Volume principal',
  settingsPerDay: '/ jour',
  settingsTrail: 'Statistiques d’usage',
  settingsTrailHint: 'Quels écrans sont ouverts, jamais ce que tu écris. Gardé sur notre serveur, jamais partagé.',
  settingsTrailOn: 'Compté',
  settingsTrailOff: 'Non compté',
  settingsExport: 'Exporter ta progression',
  settingsExportHint: 'Un fichier CSV — chaque carte, son échéance, ses révisions.',
  settingsExportBtn: 'Exporter',
  settingsReset: 'Réinitialiser la progression',
  settingsResetHint: 'Chaque révision, tes XP et ta série. Decks, niveau et réglages restent.',
  settingsResetBtn: 'Réinitialiser',
  settingsResetConfirmQ: 'Tout effacer ? Impossible à annuler.',
  settingsResetYes: 'Tout effacer',
  settingsResetDone: 'Progression réinitialisée. La carte repart de zéro.',
  settingsDeleteAccount: 'Supprimer ton compte',
  settingsDeleteAccountHint: 'Chaque révision, deck, carte, réglage et ton identifiant. Exporte d\'abord pour garder une copie.',
  settingsDeleteAccountBtn: 'Supprimer',
  settingsDeleteAccountConfirmQ: 'Supprimer ton compte et tout ce qu\'il contient ? Impossible à annuler.',
  settingsDeleteAccountYes: 'Supprimer mon compte',
  settingsDeleteAccountFailed: 'La suppression n\'a pas pu aboutir. Réessaie.',
  privacyPolicy: 'Politique de confidentialité',
  // ── L'application installée (plan 065) ──
  pwaUpdateReady: 'Un nouvel horaire est en vigueur.',
  pwaUpdateBtn: 'Recharger',
  pwaUpdateLater: 'Plus tard',
  offlineLine: 'Pas de connexion — la gare est fermée pour le moment.',
  installApp: 'Installer l\'application',
  installAppHint: 'Sur ton écran d’accueil, en plein écran, avec l’audio des kana disponible hors ligne.',
  installAppBtn: 'Installer',
  installIosTitle: 'Ajouter à l\'écran d\'accueil',
  installIosStep1: 'Touche Partager dans la barre de Safari.',
  installIosStep2: 'Choisis « Sur l\'écran d\'accueil », puis Ajouter.',
  installIosBody: 'Sur iPhone et iPad, une application web s\'installe depuis la feuille de partage de Safari — il n\'y a pas de bouton pour ça.',
  settingsIssuedTo: 'Carte émise à',

  // ── 行先 — le guichet des destinations ─────────────────────
  // Les mots du guichet, réemployés là où le guichet n'est pas : le
  // comptoir reprend le tableau des départs tel quel, il ne lui reste
  // donc que les phrases que le tableau ne sait pas dessiner — ce que
  // fait un bouton, et ce qu'il coûte.
  settingsGoal: 'Destination',
  settingsGoalNoneDesc: 'Aucune destination sur cette carte. Tu roules sur la ligne ouverte — la carte tient quand même le score, sur le rythme seul.',
  settingsGoalChangeDesc: 'Réimprimer la carte avec une autre destination, une autre date ou un autre service.',
  settingsGoalSet: 'Choisir une destination',
  settingsGoalChange: 'Modifier',
  settingsGoalTerminus: "Tu montes à N1 — le terminus. Aucune gare plus loin à promettre.",
  settingsGoalIssue: 'Émettre',
  settingsGoalIssueHint: (dest, date, perDay) =>
    `Imprime ${dest} pour le ${date}, et fixe ton rythme à ${perDay} par jour. La date part d'aujourd'hui : la promesse commence aujourd'hui.`,
  settingsGoalPickHint: 'Choisis une destination, le tableau en donne le prix — ou continue sur la ligne ouverte.',
  settingsGoalDrop: 'Rendre le billet',
  settingsGoalDropHint: "Rend la destination. Ton rythme et ton horaire restent, et la carte ne juge plus que le rythme — tu pourras reprendre une destination quand tu voudras.",
  settingsGoalIssued: 'Carte émise. Ta ligne est au dos.',
  settingsGoalDropped: 'Destination rendue. La ligne continue sans elle.',
  settingsGoalDepartHint: "L'heure à laquelle tu comptes rouler — facultative, et jamais un rappel. Elle est imprimée sur la carte parce qu'une promesse avec une heure survit mieux à sa première semaine de pluie.",
}

// La table, soudée : chaque espace devant : ; ! ? » (et derrière «)
// devient insécable en sortant d'ici, y compris dans les phrases
// assemblées à l'appel. Voir locales/frenchSpacing.js — c'est ce qui
// empêche un deux-points de tomber seul en bout de ligne.
export default welded({
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
  ...dictationMode,
  ...compositionMode,
  ...profile,
  ...settings,
  ...decks,
  ...exam,
  ...onboarding,
  ...boarding,
  ...ride,
  ...guide,
})
