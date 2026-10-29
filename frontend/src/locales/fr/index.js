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
  // 改札 — les refus de la connexion, nommés par leur code
  // (lib/authErrors.js) plutôt que par la phrase anglaise de Supabase
  // (plan 215). Les refus partagés avec la carte invité (adresse déjà
  // prise, mot de passe faible, trop de tentatives) disent les claim*.
  authBadCredentials:    'Adresse e-mail ou mot de passe incorrect.',
  authEmailNotConfirmed: 'Confirme d’abord ton adresse : le lien est dans ta boîte mail.',
  authEmailInvalid:      'Cette adresse e-mail n’est pas valide. Vérifie-la, ou essaie-en une autre.',
  authCheckFields:       'Vérifie ton adresse e-mail et ton mot de passe.',
  authSignupDisabled:    'Les inscriptions sont fermées pour le moment.',
  authLinkExpired:       'Ce lien a expiré ou a déjà servi. Essaie de te connecter ; sinon, recommence pour en recevoir un nouveau.',
  // Un lien de connexion (plan 247) : une carte gardée par un lien n’a pas
  // de mot de passe, et un mot de passe oublié trouve ici sa porte.
  authLinkSend:          'Recevoir un lien de connexion',
  authLinkSent:          (email) => `Lien envoyé à ${email}. Ouvre-le sur cet appareil.`,
  authLinkNoAccount:     'Aucune carte n’est gardée à cette adresse.',
  authLinkNeedsEmail:    'Écris ton adresse, puis demande le lien.',
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
  // Les deux refus d’une session qui ont leur propre ligne
  // (components/study/SessionError.jsx) : un passe que le serveur ne
  // reconnaît plus, un deck qui n’est plus là. Le reste dit errorHint.
  sessionExpired:    'Ta session a expiré. Reconnecte-toi pour reprendre — ta progression est en sécurité.',
  deckGone:          'Ce deck n’est plus sur ton étagère.',
  // ── Le chrome (plan 068) : les cinq portillons et le HUD ──
  tabLearn:          'Apprendre',
  tabPractice:       'Pratique',
  tabToday:          'Aujourd’hui',
  tabDictionary:     'Dictionnaire',
  tabProfile:        'Profil',
  tabBarLabel:       'Sections',
  // La seconde liste du rail, sur ordinateur (plan 269) : l’analyseur,
  // la bibliothèque, les statistiques et les réglages.
  deskPlacesLabel:   'Lieux',
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
  balanceStepsFree:  'Une carte en apprentissage se répète gratuitement : tu paies la première vue, puis chaque révision une fois la carte acquise',
  gateShort:         (rides, due) => `Seulement ${rides} sur ${due} ${rides > 1 ? 'peuvent' : 'peut'} embarquer`,
  gateNoCredits:     (at) => (at ? `Plus de crédits — +1 à ${at}` : 'Plus de crédits'),
  runOutTitle:       'Plus de crédits',
  runOutCleared:     (n) => `${n} révisée${n > 1 ? 's' : ''}`,
  runOutWaiting:     (n) => `${n} ${n > 1 ? 'attendent' : 'attend'} la recharge`,
  runOutWaits:       'en attente',
  // 補充 — ce que la recharge a versé, app fermée, dit pendant que la
  // carte se charge (plans 141, 278), à un lecteur d'écran
  refillLanded:      (n, to, cap) => `${n} crédit${n > 1 ? 's' : ''} arrivé${n > 1 ? 's' : ''} pendant ton absence · ${to} sur ${cap}`,
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
  gateMinutesLabel:  n => `environ ${n} minute${n > 1 ? 's' : ''}`,
  gateRides:         'embarquent',
  gateWaits:         (at) => (at ? `attendent · +1 à ${at}` : 'attendent'),
  gateBalance:       'crédits',
  laneWaits:         at => `attend ${at}`,
  weekAhead:         'Les sept prochains jours',
  weekLeft:          'Laissées pour demain',
  gateRidesFree:     'embarquent · gratuit',
  // 一目 — Today at a glance (plan 199)
  gateModesMainName: 'Principales',
  gateModesAllName:  'Tous les modes',
  gateTakeWord:      'Tout',
  gateTakeAllWord:   'tout',
  gateEndsAt:        at => `fini vers ${at}`,
  gateAdjust:        'Ajuster',
  // 浮世絵 (plan 205): the print's title slip, said whole -- the day and
  // the view of the print the hour and the season show (plan 261), as
  // the print's series would name it.
  printTitle:        (day, view) => `${day} — ${view}`,
  printViews: {
    'spring-dawn': 'l’aube de printemps', 'spring-day': 'les cerisiers dans la brume',
    'spring-dusk': 'les oies qui repartent', 'spring-night': 'la lune voilée',
    'summer-dawn': 'le vent du sud', 'summer-day': 'les nuages d’orage',
    'summer-dusk': 'le calme du soir', 'summer-night': 'les lucioles', 'summer-hanabi': 'les feux d’artifice',
    'autumn-dawn': 'l’aube', 'autumn-day': 'les voiles qui rentrent',
    'autumn-dusk': 'les oies qui se posent', 'autumn-night': 'la lune d’automne',
    'winter-dawn': 'l’aube froide', 'winter-day': 'le ciel clair après la neige',
    'winter-dusk': 'la neige du soir', 'winter-night': 'la lune d’hiver',
  },
  gateServicesN:     n => (n === 1 ? '1 service' : `${n} services`),
  gateLineModes:     name => `Les modes : ${name}`,
  gateLineNone:      'Aucun service aujourd’hui',
  // 主 (plan 273) : les modes d'une ligne, ajoutés à Aujourd'hui ou retirés.
  gateLineAdd:       'Aussi dans Aujourd’hui',
  gateModeAdd:       mode => `Ajouter « ${mode} » à Aujourd’hui`,
  gateModeRemove:    mode => `Retirer « ${mode} » d’Aujourd’hui`,
  gateOpensAt:       at => `Ouvre à ${at}`,
  gateOpensIn:       when => `Ouvre ${when}`,
  todayDayLabel:     'Ta journée',
  todayStreakDays:   n => (n > 1 ? 'jours de suite' : 'jour de suite'),
  todayStreakShort:  'de suite',
  todayNewToday:     'nouveautés aujourd’hui',
  todayNewShort:     'nouveautés',
  todayLesson:       'leçon',
  todayReviewed:     n => (n === 1 ? '1 carte aujourd’hui' : `${n} cartes aujourd’hui`),
  // The same, its figure set apart on the print (plan 206).
  todayReviewedUnit: n => (n === 1 ? 'carte aujourd’hui' : 'cartes aujourd’hui'),
  todayCardsUnit:    n => (n === 1 ? 'carte' : 'cartes'),
  todayWeekStamps:   n => `${n} jour${n > 1 ? 's' : ''} de suite, les sept derniers tamponnés`,
  // 基礎 — le cursus de base sur le portillon et dans Réglages › Niveau (plan 186f)
  basicsUnit:        (n, of) => `Leçon ${n} sur ${of}`,
  basicsMet:         (n, of) => `${n} leçon${n > 1 ? 's' : ''} sur ${of} vue${n > 1 ? 's' : ''}`,
  basicsDone:        'Bases acquises — le reste du N5 est ouvert.',
  basicsSkip:        'Passer les bases',
  basicsSkipLabel:   'Bases',
  basicsSkipAct:     'Je les connais',
  basicsSkipped:     n => (n > 1 ? `${n} cartes de base marquées connues.` : `${n} carte de base marquée connue.`),
  // 基礎 — la station du cursus sur le portillon Apprendre (plan 186g)
  basicsTitle:       'Bases',
  basicsDesc:        'Le N5 dès sa première leçon\nUne leçon à la fois\nSes règles, ses mots, ses kanji',
  basicsUnits:       'Leçons',
  basicsPoints:      'Grammaire',
  basicsWords:       'Mots',
  basicsKanji:       'Kanji',
  basicsSentences:   'Phrases',
  basicsMetOf:       (met, total) => `${met} sur ${total} vues`,
  // ── 定期券 — les portes de l'offre et son merci (domain/paywall.js) ──
  paywallName_pro:    'Tsuji Pro',
  paywallThanks:      'C’est noté — on te prévient au lancement.',
  paywallOpen:        'Découvrir Pro',
  paywallRowValue:    'Bientôt',
  // ── 定期券 — the three offers (plan 172, components/offers/) ──
  ofrLabel:           'Les offres Tsuji',
  ofrCardBrand:       'Pass',
  ofrCardPro:         'Pro',
  ofrCardMax:         'Max',
  ofrCardFarePro:     'Pratique · 1 crédit',
  ofrCardFareMax:     'Pratique · sans crédit',
  // ── 定期券 — la carte, face et dos (plan 173) ──
  cardFree:           'Gratuit',
  cardPaid:           'Pass',
  cardFareFree:       'Pratique · verrouillée',
  cardTurn:           'Retourner la carte',
  cardLevelTo:        (a, b) => `Niveau ${a} → ${b}`,
  cardJourney:        'État du trajet',
  cardIssued:         (when) => `Émise en ${when}`,
  cardOnPage:         'Sur la page',
  cardPerExercise:    '1 par exercice',
  cardNoCredit:       'Pratique sans crédit',
  cardNoCreditShort:  'sans crédit',
  cardUnlimited:      'Illimité',
  cardDriftAhead:     (n) => `${n} j d’avance`,
  cardDriftLate:      (n) => `${n} j de retard`,
  cardLines:          (names) => `Lignes : ${names}`,
  ofrPlatforms: { reading: 'Lecture', comprehension: 'Compréhension', translation: 'Traduction', dictation: 'Dictée', composition: 'Rédaction', exam: 'Examen blanc' },
  ofrPerMonth:        '/ mois',
  // The 7-day trial (DISCOVER)
  ofrDiscEyebrow: { trip: 'Pour ton voyage au Japon', studies: 'Pour tes études', fun: 'Pour le plaisir', live: 'Pour vivre au Japon', friends: 'Pour tes amis japonais', other: 'Tsuji Pro' },
  ofrDiscLede: {
    trip: 'Lis les panneaux et les menus, comprends ce qu’on te dit, écris tes premières phrases.',
    studies: 'Entraîne-toi au JLPT : examens blancs chronométrés, lecture, écoute et rédaction.',
    fun: 'Lis tes mangas, comprends tes animes, écris tes propres phrases.',
    live: 'Lis ce que tu croises, comprends à l’oral, rédige tes messages du quotidien.',
    friends: 'Écris-leur tes propres phrases, comprends leurs réponses, traduis sans hésiter.',
    other: 'Lecture, compréhension, traduction, dictée, rédaction et examens blancs : tes cartes deviennent du japonais.',
  },
  ofrDiscTitle:       (days) => `${days} jours de pratique, offerts.`,
  ofrTrialKind:       'Essai gratuit · Pro annuel',
  ofrTrialUnit:       (days) => `pendant ${days} jours`,
  ofrTrialBill:       (year, month) => `puis ${year} par an, soit ${month} par mois`,
  ofrTrialStub:       (days) => `${days} j`,
  ofrTrialStubCap:    'offerts',
  ofrDiscLater:       'Continuer gratuitement',
  ofrDiscCta:         (days) => `Essayer ${days} jours`,
  ofrDiscFine:        (days) => `Annule avant le jour ${days} : tu ne paies rien.`,
  ofrDemoQuestion:    'Où boit-on le café ?',
  ofrDemoHome:        'À la maison',
  ofrDemoStation:     'À la gare',
  ofrDemoSentence:    'Je bois un café à la gare.',
  ofrDemoPrompt:      'Une phrase avec で, le lieu :',
  ofrDemoTutor:       'Le tuteur : naturel et correct.',
  // The week the credits stopped (WEEK)
  ofrWeekCap:         'Tes 7 derniers jours',
  ofrWeekDone:        'révisées',
  ofrWeekWaiting:     'en attente',
  ofrWeekCeiling:     (n) => `limite : ${n} crédits / jour`,
  ofrWeekGain:        (n) => `+${n} carte${n > 1 ? 's' : ''} révisée${n > 1 ? 's' : ''} avec Pro`,
  ofrWeekChart:       (stops, waited) => `Tes 7 derniers jours : ${stops} jour${stops > 1 ? 's' : ''} où des cartes ont attendu, ${waited} carte${waited > 1 ? 's' : ''} en tout.`,
  ofrWeekEyebrow:     'Ta semaine',
  ofrWeekTitle:       (n) => (n === 1 ? 'Tes crédits t’ont arrêté une fois cette semaine.' : `Tes crédits t’ont arrêté ${n} fois cette semaine.`),
  ofrWeekLede:        (n) => `${n === 1 ? '1 carte a' : `${n} cartes ont`} attendu le lendemain. Avec Pro, tu révises tout ce qui est dû, le jour même.`,
  ofrProYearKind:     'Pro · annuel',
  ofrBilledYearly:    (price) => `${price} facturés une fois par an`,
  ofrSave:            (pct) => `−${pct}`,
  ofrSaveCap:         'vs mensuel',
  ofrWeekLater:       (time) => (time ? `Attendre · +1 crédit à ${time}` : 'Attendre la recharge'),
  ofrWeekCta:         'Réviser sans limite',
  ofrWeekFine:        (monthly) => `Annulable à tout moment · ou ${monthly} par mois`,
  // The step up to Max (MAX)
  ofrMaxKind:         'Max · annuel',
  ofrMaxBill:         'La différence avec ton Pro, au prorata',
  ofrMaxCta:          'Passer à Max',
  ofrMaxFine:         'Effet immédiat · Annulable à tout moment',
  ofrStayPro:         (when) => `Rester sur Pro · ${when}`,
  ofrNextCredit:      (time) => `+1 crédit à ${time}`,
  ofrTomorrow:        'de nouveau demain',
  ofrNextMonth:       (n, date) => `${n} de plus le ${date}`,
  ofrInstead:         (n) => `au lieu de ${n}`,
  ofrFareEyebrow:     'Plus de crédits aujourd’hui',
  ofrFareTitle:       'Avec Max, la pratique ne coûte plus de crédits.',
  ofrFareWithPro:     'Avec Pro',
  ofrFareWithMax:     'Avec Max',
  ofrFareCredits:     'Crédits :',
  ofrFareIncluded:    'Pratique incluse',
  ofrFareOne:         '1 crédit',
  ofrFareFree:        'Inclus',
  ofrFareOut:         'Plus de crédits',
  ofrFareStubCap:     'crédit par exercice',
  ofrValPhotos:       'photos par jour',
  ofrValExplains:     'explications par jour',
  ofrValPapers:       'examens neufs par mois',
  ofrPhotosCount:     'Photos aujourd’hui',
  ofrPhotosEyebrow:   (n) => `${n} photos sur ${n} aujourd’hui`,
  ofrPhotosTitle:     'Lis tout ce que tu croises.',
  ofrPhotosLede:      (max, pro) => `Avec Max, ${max} photos par jour au lieu de ${pro}, et la pratique ne coûte plus de crédits.`,
  ofrPhotosShut:      'Limite du jour atteinte',
  ofrPhotosGloss:     'sauce soja',
  ofrPhotosStubCap:   'photos / jour',
  ofrExplCount:       'Explications aujourd’hui',
  ofrExplEyebrow:     (n) => `${n} explications sur ${n} aujourd’hui`,
  ofrExplTitle:       'Comprends chaque phrase.',
  ofrExplLede:        (max, pro) => `Avec Max, ${max} explications par jour au lieu de ${pro}, et la pratique ne coûte plus de crédits.`,
  ofrExplWait:        'Explication en cours',
  ofrExplTranslation: '« Je bois un café à la gare. »',
  ofrExplNotes:       ['« à la gare » : là où l’on agit', '« un café » : ce que l’on boit', 'la forme polie de « boire »'],
  ofrExplStubCap:     'explications / jour',
  ofrExamCount:       'Examens neufs ce mois-ci',
  ofrExamEyebrow:     (n) => `${n} examens neufs sur ${n} ce mois-ci`,
  ofrExamTitle:       'Un examen blanc neuf quand tu veux.',
  ofrExamLede:        (max, pro) => `Avec Max, ${max} examens neufs par mois au lieu de ${pro}, et tous les examens sans crédits.`,
  ofrExamPaper:       (level, n) => `${level} · examen ${n}`,
  ofrExamNext:        'Prochain examen neuf',
  ofrExamOn:          (date) => `le ${date}`,
  ofrExamNew:         'Neuf',
  ofrExamSections:    ['Vocabulaire', 'Grammaire', 'Lecture', 'Écoute'],
  ofrExamStubCap:     'examens / mois',
  ofrUpEyebrow:       'Ton abonnement : Pro annuel',
  ofrUpTitle:         'Passe de Pro à Max.',
  ofrUpChanges:       'Ce qui change',
  ofrUpPractice:      'Pratique et examens blancs',
  ofrUpPhotos:        'Photos analysées par jour',
  ofrUpExplains:      'Explications par jour',
  ofrUpPapers:        'Examens neufs par mois',
  ofrUpDecks:         'Decks · cartes',
  ofrUpCredit:        '1 crédit',
  ofrUpNoCredit:      'Sans crédit',
  ofrUpKeep:          'Garder Pro',
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
  kanjiTitle:        'Kanji',
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

  // Les quatre paliers d'un thème, placés par difficulté (voir
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
  // Le recto d'une carte Kanji → sens dit ce qu'il demande (plan 276).
  askKanjiMeaning:    'Quel est son sens ?',
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
  deskKeysHelp:       'Aide',
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
  // Un pourcentage : le français met une espace insécable avant le %
  // (le statut du HUD, le score d'un examen, le relevé).
  percent:            n => `${n}\u00a0%`,
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
  // 問 — une question sur l'exercice, sur le bureau (plan 131) et, sur
  // téléphone, dans une page à elle (plan 197) : ouverte une fois la réponse
  // notée, courte, précise, sur cet exercice seulement.
  askTitle:           'Une question',
  askOpen:            'Poser une question',
  askPlaceholder:     'Ta question…',
  askSealed:          'Les questions s’ouvrent une fois ta réponse notée.',
  askSealedText:      'Les questions s’ouvrent avec les résultats.',
  askSealedTour:      'Les questions s’ouvrent une fois l’étape répondue.',
  askHint:            'Une réponse courte et précise, sur cet exercice.',
  askSend:            'Demander',
  askThinking:        'Réponse en cours',
  askOffTopic:        'Je ne réponds qu’aux questions sur cet exercice.',
  askUnavailable:     'Les réponses sont indisponibles pour le moment.',
  askFailed:          'La réponse n’est pas arrivée. Réessaie.',
  askSpent:           at => (at ? `Plus de questions aujourd’hui : elles reviennent à ${at}.` : 'Plus de questions aujourd’hui.'),
  askLeft:            n => `${n} question${n > 1 ? 's' : ''} encore aujourd’hui`,
  askFull:            'C’est tout pour cette phrase.',
  askSuggestLabel:    'Questions suggérées',
  askSugContrast:     (a, b) => `Pourquoi ${a} et pas ${b} ?`,
  askSugMarks:        p => `Que marque ${p} ici ?`,
  askSugPoint:        p => `Comment s’emploie ${p} ?`,
  askSugExample:      w => `Un autre exemple avec ${w} ?`,
  askSugPolite:       'Comment le dire plus poliment ?',
  askSugCasual:       'Et entre amis, à l’oral ?',
  askSugWhyRight:     'Pourquoi est-ce la bonne réponse ?',
  askSugWhere:        'Où le texte le dit-il ?',

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
  easy:              'Facile',
  correctHesit:      'Correct',
  difficult:         'Difficile',
  wrongSeen:         'Presque',
  wrongRated:        'Raté',
  forgot:            'Oublié',
  ratingJp: {
    easy:            '簡単',
    correctHesit:    '正解',
    difficult:       '難しい',
    wrongSeen:       '惜しい',
    wrongRated:      '不正解',
    forgot:          '忘れた',
  },

  // Mode labels
  modeQCM:           'QCM',
  modeFlashcard:     'Carte',
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
  field_kana:       'Kana',
  field_romaji:     'Rōmaji',
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
  // Les étiquettes des deux champs sur la face d'une voiture (plan 251).
  readingsOnTag:       'On',
  readingsKunTag:      'Kun',
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
  strokeZoom:        'Agrandir l\'ordre des traits',
  strokeWatch:       'Regarder',
  strokeGuided:      'Guidé',
  strokeFree:        'Libre',
  strokeAgain:       'Calquer à nouveau',
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
  todayNothingDue:    'Rien à réviser pour le moment.',
  todayNextReview:    when => `Prochaine révision ${when}.`,
  backToStation:      'Retour à la gare',
  fareGate:           'Portique',
  dueUnit:            'à réviser',
  newUnit:            'nouvelles',
  learningUnit:       'en cours',
  learnedLabel:       'Apprises',   // le chiffre d'une plateforme, lu à voix haute (plan 184)
  // Les sources sur le bureau (plan 267) : le portique au bout de la
  // ligne du JLPT, et ce qu'il reste à voir du niveau qu'il reprend.
  sourcesResume:      'Reprendre',
  unseenNote:         n => `${n} jamais vue${n > 1 ? 's' : ''}`,
  tierWords:          range => `Mots ${range}`,
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
  reportStrengthSummary: n => (n > 1 ? `${n} cartes selon leur avance` : `${n} carte selon son avance`),
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
  startedNote:     n => `${n} commencée${n > 1 ? 's' : ''}`,
  reportError:        'Le relevé n\'a pas pu être lu',
  daysUnit:           n => (n > 1 ? 'jours' : 'jour'),
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
  soundOn:            'Son activé',
  soundOff:           'Son coupé',
  soundOffHint:       'Rien ne joue, quels que soient les réglages.',
  soundMixer:         'Table de mixage',
  levelName:          { N5: 'Débutant', N4: 'Élémentaire', N3: 'Intermédiaire', N2: 'Avancé', N1: 'Confirmé' },
  settingsPaceCap:    'Nouveaux éléments par jour',
  settingsPaceOwn:    'Sur mesure',
  settingsPaceLess:   'Un de moins par jour',
  settingsPaceMore:   'Un de plus par jour',
  settingsPaceCustom: n => `Ton rythme est réglé sur ${n} par jour.`,
  paceName:           { local: 'Omnibus', rapid: 'Rapide', express: 'Express' },
  levelUpTitle:       l => `Monter à ${l} ?`,
  levelUpBody:        (to, weeks) => `Les arrêts avant ${to} sont marqués **connus** : leurs cartes démarrent maîtrisées, avec un premier contrôle réparti sur les ${weeks} prochaines semaines. Les cartes déjà en cours gardent leur place. **Rien n'est effacé.**`,
  levelDownTitle:     l => `Descendre à ${l} ?`,
  levelDownBody:      (to, returned) => (returned > 0
    ? `Ce que tu as étudié au-delà de ${to} est mis de côté, pas effacé. Les cartes marquées connues à partir de ${to} sur lesquelles tu n’as jamais été interrogé redeviennent **nouvelles**.`
    : `Les cartes au-delà de ${to} sont mises de côté, pas effacées : elles gardent leur historique et reviennent dans le trajet quand tu remontes. Le trajet du jour se réduit aux arrêts ${to}.`),
  levelMarkedKnown:   'Marquées connues',
  levelSpreadOver:    'Réparties sur',
  levelWeeks:         n => `${n} semaine${n > 1 ? 's' : ''}`,
  levelSetAside:      'Mises de côté',
  levelDeleted:       'Effacées',
  levelBackToNew:     'Redevenues nouvelles',
  levelUpGo:          l => `Monter à ${l}`,
  levelDownGo:        l => `Descendre à ${l}`,
  levelStay:          l => `Rester à ${l}`,
  // 主 — le mode de chaque ligne (plan 273), Réglages › Modes
  // principaux et sa feuille de confirmation.
  settingsModes:      'Modes principaux',
  settingsModesValue: 'Un par ligne',
  settingsModesHint:  'Aujourd’hui t’apprend chaque ligne dans son mode principal. Ajoute d’autres modes à côté, ici ou depuis Aujourd’hui.',
  settingsModesAlso:  'Aussi dans Aujourd’hui',
  modeSwitchTitle:    mode => `Apprendre en « ${mode} » ?`,
  modeSwitchBody:     (from, to, weeks) => `Garde ce que tu maîtrises en **${from}** : ces cartes sont marquées connues en **${to}**, avec un premier contrôle réparti sur les ${weeks} prochaines semaines. Ou repars de zéro : toutes les cartes sont nouvelles en **${to}**. Dans les deux cas, **rien n'est effacé.**`,
  modeSwitchBodyNone: to => `Toutes les cartes sont nouvelles en **${to}**, et Aujourd’hui commence par celles que tu n’as pas encore vues. **Rien n'est effacé.**`,
  modeSwitchGo:       mode => `Passer à « ${mode} »`,
  modeSwitchKeep:     'Garder mes acquis',
  modeSwitchFresh:    'Repartir de zéro',
  fitDown: (to, passed, answered) => `${to} · ${passed} contrôle${passed > 1 ? 's' : ''} réussi${passed > 1 ? 's' : ''} sur ${answered}`,
  fitUp: (level, known, met) => `${level} · ${known} mots sur ${met} déjà connus`,
  fitDownGo: to => `Embarquer à ${to}`,
  fitUpGo: to => `Essayer ${to}`,
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
  dueValue:          'Main­tenant', // soft hyphen: a record cell is ~76px wide on the desk
  reviewThisCard:    'Réviser cette carte',
  // Le relevé de la fiche (plan 235) : la case du calendrier, quand la
  // carte est due, est la porte vers sa révision ; et le mot qui remplace
  // l'étoile de JMdict sur un mot courant.
  dictReview:        'Réviser',
  dictCommon:        'courant',
  total:              'Total',
  overview:           'Aperçu',
  streak:             'Série',
  resultNotSaved:  "Cette réponse n’a pas pu être enregistrée dans ton historique. Elle ne comptera pas.",
  runStreak:          (n, best) => `${n} de suite · record ${best}`,
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
  charCount:           n => `${n} caractère${n > 1 ? 's' : ''}`,
  // Doit correspondre à routes/video.py:50 (_MAX_UPLOAD_BYTES = 1 Mo).
  subtitleAccepted:    'SRT, VTT, ASS, LRC et TXT · jusqu\'à 1 Mo',
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
  // Le bureau du texte : la liste des mots repliée en une ligne (plan 235).
  wordsFoldCap:        'Mots de la phrase',
  explanationTitle:    'Explication de la phrase',
  // Le volet du bureau, ses trois faces (plan 242).
  panelFaces:          'Ce que le volet montre',
  faceWord:            'Mot',
  facePoint:           'Point',
  faceGrammar:         'Grammaire',
  faceExplain:         'Construction',
  explainThisSentence: 'Expliquer la phrase',
  explanationOpen:     'Explication ouverte',
  writtenHere:         s => `ici : ${s}`,
  dictAnalyseSentence: 'Analyser cette phrase',
  windowWhole:         'toute la vidéo',
  windowSpan:          m => `Sélection : ${m}`,
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
  // The label and its level as one string, so the French colon is
  // welded to its word (frenchSpacing) rather than joined in JSX.
  sentenceLevel:       level => `Niveau estimé : ${level}`,
  unknownWords:        'mots inconnus',
  offDeckWords:        'non enseignés par l\'application',
  iPlusOne:            'Un cran au-dessus de toi',
  alreadyExplained:    'déjà expliquée',
  // 保存 (plan 039) — épingler une phrase dans la banque.
  keepSentence:        'Garder cette phrase',
  unkeepSentence:      'Ne plus garder cette phrase',
  // 歌 (plan 215) — le deck d'une chanson, depuis le résultat de l'analyseur.
  songDeckOpen:        'Créer un deck à partir de cette chanson',
  songDeckShort:       'Deck',
  dockGrammar:         'Grammaire',
  dockWords:           'Mots',
  dockExplain:         'Expliquer',
  dockKeep:            'Garder',
  dockKept:            'Gardée',
  // 表示 (plan 263) — la feuille Affichage du résultat sur téléphone.
  displayOpen:         'Affichage',
  displayFurigana:     'Furigana',
  displayRomaji:       'Rōmaji',
  displayRomajiOff:    'Masqués',
  displayRomajiOn:     'Affichés',
  displayTranslation:  'Traduction',
  displayTranslationOff: 'Masquée',
  displayTranslationOn:  'Affichée',
  displayTranslationExplain: 'Expliquer une phrase la traduit',
  displayDone:         'OK',
  // 保存 (plan 263) — garder une phrase, c’est la mettre dans un deck.
  keepTitle:           'Garder',
  keepIn:              'Garder dans',
  keepChange:          'Changer',
  keepDeckChange:      name => `Deck ${name}. Changer de deck`,
  keepNewDeck:         'Nouveau deck',
  keepNewSongDeck:     'Nouveau deck · cette chanson',
  keepThisSong:        'Le deck de cette chanson',
  keepNew:             'Nouveau',
  keepTakesBoth:       'Mots et lignes',
  keepTakesWords:      'Mots seulement',
  keepTakesLines:      'Lignes seulement',
  keepLine:            'La ligne',
  keepLines:           n => `Les lignes · ${n}`,
  keepAndOthers:       n => `et ${n} autre${n > 1 ? 's' : ''}`,
  keepMoreLines:       n => `Choisir d’autres lignes · ${n}`,
  keepEditLines:       'Modifier les lignes',
  keepItsWords:        n => `Ses mots · ${n}`,
  keepTheirWords:      n => `Leurs mots · ${n}`,
  keepKnown:           'déjà su',
  keepMoreWords:       n => `Voir ${n} autre${n > 1 ? 's' : ''} mot${n > 1 ? 's' : ''}`,
  keepDeckWordsOnly:   'Ce deck ne prend que des mots.',
  keepDeckLinesOnly:   'Ce deck ne prend que des lignes.',
  keepCards:           n => `Garder · ${n} carte${n > 1 ? 's' : ''}`,
  keepNothing:         'Rien à ajouter',
  keepNoDeck:          'Garder sans deck',
  keepUseDeck:         name => `Garder dans ${name}`,
  keepNameOk:          'OK',
  keepLinesTitle:      'Lignes',
  keepLinesOf:         (n, total) => `${n} sur ${total}`,
  keepAll:             'Tout cocher',
  keepPickKept:        n => `Gardées · ${n}`,
  keepPickUnknown:     'Avec un mot inconnu',
  keepPickNone:        'Aucune',
  keepHeld:            'déjà dans le deck',
  keepValidate:        n => `Valider · ${n} ligne${n > 1 ? 's' : ''}`,
  songDeckTitle:       'Apprends-la par cœur',
  songDeckName:        'Nom du deck',
  songDeckHolds:       'Contenu du deck',
  songDeckWords:       'Mots',
  songDeckLines:       'Paroles',
  wordsSheetTitle:     'Les mots',
  wordsSheetCount:     (n, fresh) => `${n} mot${n > 1 ? 's' : ''}${fresh ? ` · ${fresh} nouveau${fresh > 1 ? 'x' : ''}` : ''}`,
  songDeckWordsDesc:   'Pour comprendre la chanson, mot à mot',
  songDeckLinesDesc:   'Chaque ligne et sa lecture, pour la chanter',
  songDeckCreate:      n => `Créer le deck · ${n} carte${n > 1 ? 's' : ''}`,
  explainCap:          'Explication',
  explainFailedTitle:  'Pas d’explication pour l’instant',
  askHintSentence:     'Une question sur cette phrase ? Une réponse courte et précise.',
  askOffTopicSentence: 'Je ne réponds qu’aux questions sur cette phrase.',
  songDeckMaking:      'Création du deck',
  songDeckFailed:      'Impossible de créer le deck. Réessaie.',
  songDeckLimit:       'Tu as atteint la limite de decks ou de cartes de ton offre : une partie de la chanson n’a pas été ajoutée.',
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
  // Les alertes du favori lui-même, sur youtube.com : figées dans la
  // langue de l’apprenant au moment de la copie (lib/captionGrab.js).
  // tutTrouble1 cite les deux premières phrases de grabAlertNoJapanese
  // et de grabAlertNotReady — un test les tient d’accord.
  grabAlertNotYoutube:  'Ouvre d’abord la vidéo sur YouTube.',
  grabAlertNoVideo:     'Pas de vidéo sur cette page.',
  grabAlertNotReady:    'Page pas prête : recharge-la et réessaie.',
  grabAlertNoSubtitles: 'Cette vidéo n’a pas de sous-titres.',
  grabAlertNoJapanese:  'Pas de sous-titres japonais. Langues disponibles : ',
  grabAlertEmpty:       'Les sous-titres sont revenus vides : réessaie.',
  grabAlertFailed:      'La récupération des sous-titres a échoué : ',
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
  tutTrouble1:         'Le favori explique lui-même : « Pas de sous-titres japonais » veut dire que la vidéo n\'a pas de piste japonaise — il n\'y a rien à récupérer. « Page pas prête » : recharge la page de la vidéo et réessaie.',
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
  transcriptTooLong:   'Cette transcription est trop longue. Colle-en une partie plus courte.',
  videoStillPreparing: 'Une vidéo est encore en préparation. Attends-la, puis ajoute la suivante.',
  // 動画 — pourquoi une vidéo ne s’est pas ouverte (plan 215). Le
  // serveur nomme chaque refus par un code ; ces phrases le disent
  // dans la langue de l’apprenant (components/analysis/videoErrors.js),
  // jamais l’anglais du serveur.
  subtitleNotUtf8:     'Ce fichier n’est pas en UTF-8. Les .srt japonais sont souvent en Shift-JIS : réenregistre-le en UTF-8 (un éditeur de texte suffit), puis réessaie.',
  subtitleParseFailed: 'Ce fichier de sous-titres est mal formé : impossible de le lire.',
  subtitleUnknownFormat: 'Format de sous-titres non reconnu. Choisis un fichier SRT, VTT, ASS, LRC ou TXT.',
  subtitleNoCues:      'Aucune réplique à lire dans ces sous-titres.',
  transcriptNoTimestamps: 'Aucun horodatage trouvé. Copie tout le panneau de transcription de YouTube (chaque ligne doit commencer par une heure, comme 0:18).',
  videoNotYoutube:     'Ce lien n’est pas une vidéo YouTube.',
  videoLinkFetchOff:   'Ce serveur ne sait pas récupérer les sous-titres d’un lien. Utilise le favori 字幕取り, ou ajoute un fichier de sous-titres.',
  videoLinkAllowanceMine: 'Tu as utilisé tes liens du jour. Ajoute un fichier de sous-titres, ou reviens demain.',
  videoLinkAllowanceApp: 'Les liens du jour sont épuisés pour toute l’application. Ajoute un fichier de sous-titres, ou reviens demain.',
  videoNoJapanese:     'Cette vidéo n’a pas de sous-titres japonais. Essaie une autre vidéo, ou ajoute toi-même un fichier de sous-titres.',
  videoSubtitlesOff:   'Les sous-titres de cette vidéo sont désactivés.',
  videoSubtitlesEmpty: 'La piste de sous-titres japonais de cette vidéo est vide.',
  videoUnavailable:    'Cette vidéo est indisponible.',
  videoYoutubeRefused: 'YouTube a refusé de donner les sous-titres de cette vidéo. Le favori 字幕取り ou un fichier de sous-titres passeront.',
  videoYoutubeUnreachable: 'Impossible de joindre YouTube. Réessaie dans un instant.',
  videoTranscriptFailed: 'La lecture de ces sous-titres a échoué. Réessaie.',
  videoStalled:        'La préparation s’est arrêtée en route. Réessaie.',
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


  // Source "mes cartes" : affiché à la place d'une phrase quand
  // l'apprenant n'a pas encore assez de vocabulaire en cours/maîtrisé
  // pour une phrase complète.
  notEnoughMasteryWords: "Pas encore assez de mots en cours ou maîtrisés — continue à étudier et reviens pour ce mode.",

  readingFetchError:    "Impossible de charger une phrase. Réessaie.",
  writeWhatYouSaw:      'Écris ce que tu as vu, en romaji',
  // Le chrono au rythme « Sans limite » (Réglages › Rythme de lecture).
  readingUntimed:       'Sans limite de temps',
  romajiPlaceholder:    'ex. konnichiwa',
  // Le bouton lecture derrière lequel arrive une phrase (PlayButton de ReadingPieces).
  readingPlay:          'Afficher la phrase et lancer le chrono',
  // Le chrono de la lecture (ReadingTimer) : « 4,5 s ».
  timerSeconds:         s => `${s.toLocaleString('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}\u00a0s`,
  correct:              'Correct !',
  incorrect:            'Pas tout à fait',
  correctRomaji:        'Romaji attendu',
  // The practice card (plan 185): the grammar point's tag at the card's
  // top, on the answer and (translation) on the prompt; and, for a screen
  // reader, what the figure in the answer's well counts and the name of
  // the words missed under it.
  pcardPoint:           'Point',
  pcardUse:             'Avec',
  pcardMatched:         'retrouvé',
  pcardMissed:          'Mots manqués',
  nextPhrase:           'Phrase suivante',
  translation:          'Traduction',

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
// translation, yourAnswer, gradeCorrect/
// gradeIncorrect, nextPhrase) — seules les clés vraiment nouvelles
// vivent ici.
const translationMode = {
  translationTitle:      'Traduction',
  translationDesc:       'À toi de le dire en japonais\nUne réponse de référence, et un avis sur la tienne\nDans le sens difficile, exprès',
  translationFetchError: "Impossible de charger une phrase. Réessaie.",
  japanesePlaceholder:   'Écris-la en japonais…',
  // L'avis du tuteur en forme fixe, pas en paragraphe (routes/translation.py).
  reviewCorrect:         'Correct',
  reviewAcceptable:      'Acceptable',
  reviewPartial:         'En partie',
  reviewIncorrect:       'À revoir',
  reviewGood:            'Ce qui marche',
  reviewFix:             'À corriger',
  reviewGrammarUsed:     'utilisé',
  reviewGrammarMissed:   'non utilisé',
  analyzingTranslation:  'Analyse de ta traduction…',
  analysisUnavailable:   'Analyse indisponible — juge par rapport à la référence ci-dessus.',
}

// ── 書取 — la dictée ──────────────────────────────────────────
// DictationRun.jsx réutilise telles quelles les clés partagées
// (selectLevel, leaveLevels, stationJlpt, submit, retry, yourAnswer,
// translation, nextPhrase, examAudioPause/
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
// japanesePlaceholder, analysisUnavailable, nextPhrase,
// pcardPoint, glLesson, les clés review*, celles de la
// décomposition et de l'explication) — seules les clés vraiment
// nouvelles vivent ici.
const compositionMode = {
  compositionTitle:        'Rédaction',
  compositionDesc:         'Écris une phrase avec le point donné\nUn tuteur te la relit\nDe N5 à N1',
  compositionFetchError:   "Impossible de charger un point de grammaire. Réessaie.",
  compositionPrompt:       'Écris une phrase avec',
  analyzingComposition:    'Lecture de ta phrase…',
  // Les avis du jour sont épuisés (routes/composition.py, 429). La
  // session continue : l'indice s'affiche toujours et la note compte.
  compositionLimitReached: "Le tuteur a fini sa journée : ton indice et ta note comptent toujours. Reviens demain.",
}

// ── 会話 — conversation (plan 217) ──────────────────────────────
// Quelqu'un parle à l'apprenant dans un lieu (la caisse d'un konbini,
// les portiques d'une gare, le bureau d'un client) et il répond : en
// choisissant parmi trois répliques, en écrivant ce qu'on lui dit de
// dire, ou librement, l'interlocuteur joué par le modèle.
// ConversationStation liste les scènes, ConversationRun en joue une ;
// l'avis du tuteur, la carte d'exercice et la barre de notes gardent
// leurs clés partagées.
const conversationMode = {
  conversationTitle:   'Conversation',
  conversationDesc:    'On te parle : réponds\nChoisis, traduis ou parle librement\nDe N5 à N1',
  cvsFetchError:       'Impossible de charger la conversation. Réessaie.',
  cvsModeLabel:        'Comment tu réponds',
  cvsLevelLabel:       'Niveau',
  cvsModes:            { choose: 'Choisir', translate: 'Traduire', free: 'Libre' },
  cvsEmpty:            'Pas encore de conversation à ce niveau.',
  // La recherche de la station (plan 246) : le champ, son compte, et ce
  // qu'il dit quand le niveau n'a rien de la requête.
  cvsSearchPlaceholder: 'Chercher une scène…',
  cvsCount:            n => (n === 1 ? '1 scène' : `${n} scènes`),
  cvsNoMatchHere:      level => `Aucune scène ${level} ne correspond.`,
  cvsFoundAt:          levels => {
    const at = levels.map(level => `en ${level}`)
    return `Il y en a ${at.length < 2 ? at.join('') : `${at.slice(0, -1).join(', ')} et ${at.at(-1)}`}.`
  },
  cvsGoTo:             level => `Passer en ${level}`,
  cvsNoMatch:          'Aucune scène ne correspond.',
  cvsNoMatchHint:      'Essaie un lieu, une personne ou un mot de la scène.',
  cvsClearSearch:      'Effacer la recherche',
  cvsRecordAria:       (right, done) => `${right} répliques justes sur ${done}`,
  cvsLeave:            'Scènes',
  cvsRepliesRated:     'Répliques',
  cvsStart:            'Commencer',
  cvsGoal:             'Ta mission',
  cvsRouteAria:        (place, n, total) => `${place}, réplique ${n} sur ${total}`,
  cvsSay:              'Dis',
  cvsTheReply:         'La réponse',
  cvsRightMark:        'Juste',
  cvsWrongMark:        'Faux',
  cvsNext:             'Suivant',
  cvsFinish:           'Terminer',
  cvsReplyLabel:       'Ta réponse',
  cvsReplyPlaceholder: 'Ta réponse, en japonais ou en rōmaji…',
  cvsSend:             'Envoyer',
  cvsAnswering:        who => `${who} répond…`,
  cvsReading:          'Lecture de ta réponse…',
  // Le tuteur a fini sa journée (routes/conversation.py, 429) : la
  // session continue, mesurée et notée.
  cvsReviewLimit:      'Le tuteur a fini sa journée : la mesure et ta note comptent toujours. Il revient demain.',
  cvsTalkLimit:        'C’est tout pour la conversation libre aujourd’hui. Choisir et Traduire marchent toujours : elle revient demain.',
  cvsTalkOff:          'La conversation libre a besoin du tuteur, et il n’est pas disponible pour l’instant. Choisir et Traduire marchent toujours.',
  cvsTalkFailed:       'Aucune réponse n’est venue. Réessaie.',
  cvsTalkOver:         'Huit répliques : la conversation s’arrête ici.',
  cvsOver:             'La conversation est finie',
  cvsAgain:            'Recommencer',
  cvsOther:            'Une autre scène',
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
  // 上下 (plan 174) : le compteur du trajet sous l'en-tête, pour un lecteur d'écran.
  runMeter:          (n, total) => (total == null ? `${n} noté${n > 1 ? 's' : ''}` : `${n} sur ${total}`),
  listen:            'Écouter',
  displayedKanji:    'kanji affichés',
  displayedEntries:  'entrées affichées',
  displayedWords:   'mots affichés',
  displayedPoints:  'points affichés',
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
  // 発見 — le tour d'un point de grammaire (plan 187b)
  tourLookQ:         p => `Que fait ${p} ?`,
  tourLookHint:      n => `${n === 2 ? 'Deux' : 'Trois'} phrases. Regarde où il se place, et ce que disent les traductions.`,
  tourIdea:          'J\'ai une idée',
  tourSkip:          'Passer la leçon',
  tourGuessQ:        p => `Que veut dire ${p} ?`,
  tourCheck:         'Vérifier',
  tourThatIs:        p => `Ça, c'est ${p}.`,
  tourNotThis:       'Ce n\'est pas ce que font ces phrases.',
  tourHint:          'Regarde ce que disent les traductions.',
  tourGiven:         'La voici.',
  tourGivenNote:     'Garde-la en tête : elle revient à la fin.',
  tourFound:         n => (n === 0 ? 'Bien vu, du premier coup.' : n === 1 ? 'Bien vu, au deuxième essai.' : `Bien vu, au ${n + 1}e essai.`),
  tourTerminus:      'Ce que tu as trouvé',
  tourNotLike:       p => `Pas ${p}`,
  tourBoard:         'Embarquer',
  tourReadLesson:    'Lire la leçon complète',
  tourRight:         'Oui.',
  tourNotQuite:      'Pas tout à fait.',
  tourMe:            'Toi',
  tourPlayScene:     'Écouter la scène',
  tourYourTurn:      'À toi de jouer',
  tourYourLine:      'Ta réplique',
  // 書く — the write (plan 187e).
  wrtAsk: 'Dis-le en japonais',
  wrtWith: 'Avec',
  wrtWords: 'Mots utiles',
  wrtField: 'Ta phrase (kana ou rōmaji)',
  wrtHint: 'kana · rōmaji',
  wrtCheck: 'Vérifier',
  wrtFound: 'La structure y est.',
  wrtMissing: 'La structure n\'y est pas.',
  wrtModel: 'Une façon de le dire',
  tourRecord: (date, tries, helped) => `Découvert le ${date} · ${helped ? 'règle donnée' : tries ? `${tries} essai${tries > 1 ? 's' : ''}` : 'du premier coup'}`,
  tourReplay: 'Refaire le tutoriel',
  tourReplayScene: 'Rejouer la scène',
  tourBackToLesson: 'Retour à la leçon',
  // 発見 on the desk (plan 187f): the stops at the left, the plate at the right.
  tourStops: { look: 'Regarde', guess: 'Devine', found: 'Trouvé', scene: 'En situation', twist: 'C\'est pas tout !', quiz: 'Le quiz', terminus: 'Résultats' },
  tourNotionCount: (n, total) => `${n} sur ${total}`,
  tourTries: n => `${n} essai${n > 1 ? 's' : ''}`,
  tourRuleGiven: 'règle donnée',
  tourMissed: 'raté',
  tourToFind: 'À trouver',
  tourLedgerLater: 'Les exemples et les voisins s\'ouvrent au terminus.',
  tourRouteAria: 'Les étapes du tutoriel',
  tourLedgerAria: 'Ce que tu as trouvé',
  tourAria:          p => `Découvrir ${p}`,
  // 194 — the ladder as steps, the plate, Construire typed, the tutorial's quiz
  glLadderBoard: 'Monter l\'échelle',
  lineAria: (group, at, of) => `Ce point : ${group}, marche ${at} sur ${of}`,
  lineMasteredAria: 'Ce point : maîtrisé',
  lineChoose: 'Choisir',
  lineBuild: 'Construire',
  lineMastered: 'Maîtrisé',
  lineAgain: 'à refaire',
  lineRelapse: 'Rechute',
  chooseAsk: 'Laquelle convient ?',
  chooseTrap: p => `${p}, le piège`,
  chooseRight: 'juste',
  bldField: 'Ta réponse',
  bldFieldN: n => `Ta réponse, trou ${n}`,
  bldHint: 'kana ou rōmaji',
  bldCheck: 'Vérifier',
  bldRight: 'Juste.',
  bldClose: 'Presque.',
  bldWrong: 'Pas tout à fait.',
  bldOther: (said, register) => `La phrase dit ${said} : la même chose, en style ${register === 'plain' ? 'neutre' : 'poli'}.`,
  mapAria: 'La ligne du point',
  mapTutorial: 'Tutoriel',
  mapNow: 'maintenant',
  mapDone: 'fait',
  mapAfter: days => `+${days} j`,
  // 198 — what each rating does to the point, on the walk (CardPanel)
  mapOutsAria: 'Ce que donne chaque note',
  mapOutMove: move => ({ stay: 'à refaire', next: 'étape suivante', back: 'rechute', hold: 'reste maîtrisé' })[move],
  mapOutRow: (verdicts, move, when) => `${verdicts} : ${move}, ${when}`,
  mapSealed: 'son nom s\'ouvre à la réponse',
  tourUsageHead: 'C\'est pas tout !',
  tourQuizCount: (n, total) => `Question ${n} sur ${total}`,
  tourQuizGap: 'Laquelle convient ?',
  tourQuizKinds: { gap: 'Le trou', meaning: 'Le sens', form: 'La forme', use: 'La réplique' },
  tourTrap: 'Piège',
  tourResults: 'Résultats',
  tourScore: (r, n) => `${r} sur ${n}`,
  tourSheet: 'La fiche du point',
  tourStart: 'Commencer : Choisir 1',
  // 初見 — un kana ou un kanji vu pour la première fois (plan 216)
  glyphAria:         g => `Découvrir ${g}`,
  glyphNew:          { kana: 'Nouveau kana', kanji: 'Nouveau kanji' },
  glyphTwin:         { hiragana: 'en hiragana', katakana: 'en katakana' },
  glyphStops:        { read: 'Lire', write: 'Écrire', use: 'Dans des mots' },
  glyphTraceQ:       'Trace chaque trait, du point jusqu\'au rond.',
  glyphGiven:        'Ce trait est tracé pour toi.',
  glyphTraced:       misses => (misses ? 'Tracé.' : 'Tracé du premier coup.'),
  glyphShowMe:       'Montre-moi',
  glyphShown:        'Voilà son tracé.',
  glyphBoardAria:    (g, n, total) => `Tracer ${g}, trait ${n} sur ${total}`,
  glyphStart:        'Commencer',
  // 文法 — la leçon (plan 087)
  glLesson:          'Leçon',
  glPoints:          'Les points',
  glRule:            'Règle',
  glUse:             'Emploi',
  glCareful:         'Attention',
  glCompare:         'Comparer',
  // Les titres de la leçon (plan 235) : chaque partie se repère à l'œil.
  glStructure:       'Construction',
  glForms:           'Formes',
  glConfuse:         'À ne pas confondre',
  glBoard:           'Compris — embarquer',
  glBlank:           'trou',
  glRegister: { neutral: 'Neutre', casual: 'Familier', polite: 'Poli', formal: 'Soutenu', written: 'Écrit' },
  composingKanji:    'Composé de ces kanji',
  vocabExamples:     'Utilisé dans ces mots',
  kanaExamples:      'Se lit dans ces mots',
  allReadings:       'Toutes les lectures',
  readingsNoWords:   'Pas encore de mots d\'exemple',
  // 割合 (plan 177) : la part des mots qui emploient chaque lecture.
  readingsScopeLabel:  'Portée du décompte',
  readingsScopeCourse: 'Cursus',
  readingsScopeAll:    'JMdict',
  readingsScopeHintCourse: (n) => `Part des ${n} mots du cursus qui emploient chaque lecture.`,
  readingsScopeHintAll:    (n) => `Part des ${n} mots de JMdict qui emploient chaque lecture.`,
  readingsTier:      { core: 'Courante', usual: 'Usuelle', rare: 'Rare' },
  readingsOfWords:   (n, total) => `${n} mot${n > 1 ? 's' : ''} sur ${total.toLocaleString('fr-FR')}`,
  readingsExamples:  (n) => `${n} exemple${n > 1 ? 's' : ''}`,
  readingsWholeShare: 'Mot lu en entier',
  readingsShareLoading: 'Décompte en cours…',
  readingsShareError:   'Le décompte n\'a pas pu être chargé.',
  readingsCourseEmpty:  (kanji) => `Aucun mot du cursus JLPT n'emploie ${kanji}.`,
  readingsCourseEmptyBody: 'Le décompte du cursus est vide. Le dictionnaire complet a des mots avec ce kanji.',
  readingsCountAll:  'Compter sur tout JMdict',
  // Voir en/index.js : la moitié japonaise est le titre, la moitié en
  // langue claire sa légende.
  readingsOnName:    'Lecture chinoise',
  readingsKunName:   'Lecture japonaise',
  // Voir en/index.js : le 熟 d'un mot qui se lit d'un bloc.
  readingsWhole:     'Se lit d\'un bloc',
  // Plan 276 : la fiche que les deux noms d'une carte kanji ouvrent
  // (components/study/ReadingsHelp, domain/readingsHelp).
  readingsHelpCap:   'Les deux lectures',
  readingsHelpOn:    'Venue de Chine avec le kanji, elle s’écrit en katakana. C’est surtout celle des mots de plusieurs kanji.',
  readingsHelpKun:   'Le mot japonais que le kanji est venu écrire, en hiragana. Souvent le kanji seul, ou suivi de kana.',
  readingsHelpShare: (kanji) => `La part des mots du cours qui lisent ${kanji} ainsi : commence par les plus hautes.`,
  readingsHelpTilde: (kanji, side, word) => `Une lecture que ${kanji} prend ${side === 'after' ? 'derrière' : 'devant'} un autre élément du mot${word ? ` : ${word.kanji}, ${word.kana}` : ''}.`,
  readingsHelpDot:   (written) => `Après le point viennent des kana : ${written}.`,
  dictBackToRadicals:'Retour aux radicaux',
  dictModeSearch:    'Recherche',
  dictModeRadical:   'Radical',
  dictionaryPlaceholderRadical: 'Filtrer ces résultats par radical…',
  dictionaryResults: n => `${n} résultat${n > 1 ? 's' : ''}`,
  dictRadicalNumber: (n) => `radical n°\u00A0${n}`,
  dictStrokesPlural: 'traits',
  dictStrokeSingular: 'trait',
  dictStrokeIndex:   'Index par nombre de traits',
  // La fiche en train de s'ouvrir (DictionaryDetail.jsx).
  loadingDictionary: 'Ouverture de la fiche…',
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
  // Rolling the text up the card instead of showing it whole (plan 258).
  rollText:                 'Défilement',
  rollWhole:                'Texte entier',
  rollLabel:                'Texte qui défile sur la carte',
  rollPause:                'Mettre le défilement en pause',
  rollResume:               'Reprendre le défilement',
  rollSpeedLabel:           'Vitesse de défilement',
  rollSlower:               'Plus lent',
  rollFuriganaOn:           'Masquer les furigana',
  rollFuriganaOff:          'Afficher les furigana',
  rollFaster:               'Plus rapide',
  rollSpeed:                n => `${n} car./s`,
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
  readingsMore: (n) => `${n} lecture${n > 1 ? 's' : ''} de plus — la fiche du dictionnaire les donne toutes`,
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
  // L'interrupteur de la voix à côté (components/study/SpeakToggle.jsx) :
  // le nom reste, le titre dit ce que fait un appui.
  speakOnReveal:      'Lecture à la révélation',
  speakOnRevealOn:    'Lire la réponse à voix haute quand elle est révélée',
  speakOnRevealOff:   'Ne plus lire la réponse quand elle est révélée',

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
  mode_grammar_ladder:             'L\'échelle',
  mode_grammar_ladder_desc:        'Un exercice qui monte avec toi : reconnaître, choisir, construire, puis écrire.',
  mode_grammar_build:              'Construire',
  mode_grammar_build_desc:         'La phrase en morceaux. Remets la structure et son mot à leur place.',
  mode_grammar_write:              'Écrire',
  mode_grammar_write_desc:         'Une situation à dire en japonais avec la structure. Tu te notes toi-même.',

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
  rankColumn:        'Rang',
  // ── 番付 — tout le classement (plan 262) ──
  periodDivision:    'Division',
  // Les trois onglets du classement entier, courts pour un téléphone.
  bzTabWeek:         'Semaine',
  bzTabAll:          'Au total',
  bzWhole:           'Tout le classement',
  bzGapTo:           (xp, who) => `${xp} XP pour dépasser ${who}`,
  bzMoveUp:          (n) => `${n} place${n > 1 ? 's' : ''} gagnée${n > 1 ? 's' : ''} depuis hier`,
  bzMoveDown:        (n) => `${n} place${n > 1 ? 's' : ''} perdue${n > 1 ? 's' : ''} depuis hier`,
  bzRowAria:         (who) => `Ouvrir la carte de ${who}`,
  bzScopeLabel:      'Qui afficher',
  bzScopeAll:        'Tout le monde',
  bzScopeLevel:      (level) => `Mon niveau · ${level}`,
  bzMovedUp:         'Promu lundi dernier',
  bzMovedDown:       'Descendu lundi dernier',
  bzDivisionBelow:   'La division en dessous',
  bzDivisionAbove:   'La division au-dessus',
  bzEarlier:         'Places précédentes',
  bzMore:            'Places suivantes',
  bzJumpToMe:        'Ma place',
  bzEmpty:           'Personne sur ce classement pour l’instant.',
  bzLoadFailed:      'Impossible de charger le classement.',
  bzShownHint:       'Les autres voient ton nom et tes XP.',
  bzHiddenHint:      'Les autres ne te voient plus. Tu vois toujours ta place.',
  bzCardAria:        (who) => `La carte de ${who}`,
  bzCardFailed:      'Impossible de charger cette carte.',
  bzCardLevel:       'Niveau',
  bzCardDecks:       'Decks publiés',
  // Le classement A1 (plan 262, le choix du propriétaire sur le canevas).
  bzEndsIn:          (d, h) => (d > 0 ? `Fin dans ${d} j ${h} h` : `Fin dans ${h} h`),
  bzPodiumCap:       'Sem. dernière',
  bzUpHead:          'Montent lundi',
  bzDownHead:        'Descendent lundi',
  bzInUp:            'Dans la zone de promotion',
  bzLadder:          'Les divisions',
  // Le pied comme F2 (plan 262) : la carte de l'apprenant et le réglage.
  bzToUpRest:        'pour monter lundi',
  bzToStayRest:      'pour rester dans la division',
  bzOrdinal:         (n) => (n === 1 ? 'er' : 'e'),
  bzAppear:          'Apparaître au classement',
  bzLearners:        (n) => `${n} apprenant${n > 1 ? 's' : ''}`,
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
    `**${a} par jour** contre **${p}** promis — ${dest} arrive **${days} jour${days > 1 ? 's' : ''} en avance**, vers le **${date}**.`,
  jourFootBehind:    (a, p, dest, date, days) =>
    `14 derniers jours : **${a} par jour** contre **${p}** promis. À ce rythme, ${dest} arrive le **${date}** — **${days} jour${days > 1 ? 's' : ''}** après la date de ta carte.`,
  jourFootSuspended: (date) =>
    `Aucune étude en 14 jours. Le **${date}** de ta carte ne veut plus rien dire — reprends, ou réimprime-la avec une date qui compte.`,
  jourFootPaceKept:  (a, p) =>
    `14 derniers jours : **${a} par jour** contre **${p}** promis. Pas d'arrivée fixée — le rythme est toute la promesse.`,
  jourFootPaceSuspended: (p) =>
    `Aucune étude en 14 jours contre une promesse de **${p} par jour**. La ligne attend — le portillon s'ouvre avec une seule carte.`,
  // 定期券の裏 (plan 174) : la ligne seule sur le dos de la carte. L'écart
  // en jours, signé, sans mot — la couleur dit le reste ; le train fantôme
  // porte « promis ».
  jourDrift:         (n) => `${n > 0 ? '+' : '−'}${Math.abs(n)} jour${Math.abs(n) > 1 ? 's' : ''}`,
  jourRoute:         (from, to) => `${from} → ${to}`,
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
  deleteCardConfirm: 'Supprimer cette carte ?',
  study:             'Étudier',
  deckEdit:          'Modifier',
  deckAddCards:      'Ajouter des cartes',
  deckWriteCard:     'Écrire une carte',
  deckAllCards:      n => (n === 1 ? 'La carte' : `Les ${n} cartes`),
  deckFigs:          { due: 'À réviser', new: 'Nouvelles', learning: 'En cours', mastered: 'Maîtrisées' },
  deckCardState:     { due: 'À réviser', new: 'Nouvelle', learning: 'En cours', mastered: 'Maîtrisée' },
  deckToday:         'Aujourd’hui',
  deckTodayDesc:     'Les cartes du jour de ce deck, tous modes confondus.',
  deckToStudy:       n => (n === 1 ? 'carte à étudier aujourd’hui' : 'cartes à étudier aujourd’hui'),
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
  mixedDesc:         'Un peu de tout : mots, kanji, grammaire et tes propres cartes',
  lyricsType:        'Paroles',
  lyricsDesc:        'Une chanson, depuis un fichier de sous-titres, ses paroles ou un lien YouTube',
  // 歌 (plan 264) — les paroles d'une chanson en deck, depuis l'étagère.
  lyricsImport:           'Importer les paroles',
  lyricsImportTitle:      'Une chanson en deck',
  lyricsSource:           'D’où viennent les paroles',
  lyricsFromFile:         'Fichier',
  lyricsFromLink:         'YouTube',
  lyricsFromPaste:        'Coller',
  lyricsPastePlaceholder: 'Colle les paroles japonaises de la chanson',
  lyricsLinkOff:          'Ce serveur ne sait pas récupérer les sous-titres d’un lien pour le moment. Ajoute un fichier, ou colle les paroles.',
  lyricsStart:            'Analyser les paroles',
  lyricsReading:          'Lecture des paroles',
  lyricsSorting:          'Tri des lignes chantées',
  lyricsSortSpent:        'Le tri automatique est épuisé pour aujourd’hui : vérifie les lignes toi-même.',
  lyricsSortOff:          'Le tri automatique est indisponible pour le moment : vérifie les lignes toi-même.',
  lyricsNoLines:          'Aucune ligne en japonais à mettre dans un deck.',
  lyricsSung:             'Chanté',
  lyricsNotSung:          'Hors chanson',
  lyricsKindSpoken:       'Parlé',
  lyricsKindCredit:       'Crédit',
  lyricsKindSound:        'Son',

  // Parcourir les cartes existantes (BrowseCardsMenu.jsx)
  browseBtn:              'Parcourir',
  browseTitle:            'Parcourir les cartes existantes',
  browseTabKanji:         'Kanji',
  browseTabVocab:         'Vocabulaire',
  browseTabGrammar:       'Grammaire',
  browseAllLevels:        'Tous',
  browseSearchPlaceholder: 'Rechercher (kanji, kana, sens…)',
  browseResults:          'Résultats',
  browseSelectedCount:    '{n} sélectionnées',
  searching:              'Recherche…',
  browseNoResults:        'Aucun résultat.',
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
  librarySeeCards:       n => (n === 1 ? 'Voir la carte' : `Voir les ${n} cartes`),
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
  libraryPublishHint:    'Les autres pourront le trouver et le suivre.',
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
  examPracticeTarget:  'Objectif',
  // La ligne où se pose la barre du score (plan 254) : l’objectif
  // atteint, ou combien de bonnes réponses il manquait.
  examTargetReached:   'Objectif atteint',
  examTargetShort: n => `À ${n} ${n > 1 ? 'bonnes réponses' : 'bonne réponse'} de l’objectif`,
  // Une correction sert d'abord aux erreurs : c'est donc ce qui est
  // ouvert par défaut — sinon une épreuve de 21 questions affiche 21
  // lignes identiques à dérouler avant de trouver les deux ratées.
  examShowAll:         'Toutes les questions',
  examAllCorrect:      'Aucune erreur — toutes les réponses sont bonnes.',
  // La couleur seule ne peut pas dire quelle ligne a été choisie et
  // laquelle était juste (c'est la même sur une bonne réponse, et ~8 %
  // des gens ne distinguent pas les deux teintes) : les deux sont donc
  // écrites en toutes lettres.
  examYourAnswer:      'Ta réponse',
  examCorrectAnswer:   'Bonne réponse',
  examNotAnswered:     'Laissée vide',
  // Le script d'écoute est déjà dans chaque épreuve (voir
  // exam_listening_gen.py) et c'est exactement ce qui rend une
  // question d'écoute ratée exploitable — caché pendant l'épreuve,
  // proposé à la correction.
  examTranscript:      'Transcription',
  // L'étude sous une question corrigée (exam/ExamStudy.jsx) : sa
  // phrase et ses propositions traduites, et la décomposition.
  examStudyOpen:       'Traduction et décomposition',
  examStudyHide:       'Masquer la traduction',
  examStudyFailed:     'La traduction est indisponible pour le moment. Réessaie dans un instant.',
  examStudyRetry:      'Réessayer',
  examStudySentence:   'La phrase',
  examStudyChoices:    'Les propositions',
  examStudyPassage:    'Le texte',
  examStudyNoWord:     'pas un mot',

  // ── Feuille de réponses ──
  // La grille numérotée sous la question. Nommée d'après ce qu'elle
  // remplace : sur un JLPT papier, c'est la feuille de réponses qui
  // dit d'un coup d'œil ce qu'il reste à faire.
  examSheetTitle:      'Feuille de réponses',
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
  // Le compte d’un invité, gardé depuis Réglages › Compte : la
  // progression existe déjà, on ne fait qu'y mettre une clé
  // (lib/guest.js).
  brdAccountCreate: 'Créer mon compte',
  // La carte (plan 247) : les crédits qu’elle offre, au dos, et le
  // service nommé sur la feuille du rythme.
  brdCreditsOffered: 'crédits offerts',
  brdTermService: 'Service',
  // L’accueil : l’étiquette de chaque démo.
  brdDemoTag: { kanji: 'Kanji', vocab: 'Vocabulaire', grammar: 'Grammaire', dictation: 'Dictée', reading: 'Lecture', kana: 'Kana', translation: 'Traduction', analyzer: 'Analyseur', exam: 'Examen blanc' },
  // Les questions.
  brdKanaQ: 'Tu sais lire ça ?',
  brdKana: { hiragana: 'Hiragana', katakana: 'Katakana', both: 'Les deux', none: 'Pas encore' },
  brdKanaWord: { sushi: 'sushi', hotel: 'hôtel', station: 'gare' },
  brdRevealQ: 'Bientôt, tu liras les deux.',
  // 辻 (plan 163): the desk's kana question and reveal, drawn as the
  // owner's D03 -- each answer says what it reads, then its name.
  brdKanaHint: 'Choisis ce que tu lis déjà.',
  brdKanaOnly: (jp) => `Seulement ${jp}`,
  brdKanaSays: { hiragana: 'Les hiragana', katakana: 'Les katakana', both: 'Hiragana et katakana', none: 'On commence par là' },
  brdRevealLead: 'Deux écritures de 46 signes chacune. Voici comment se lisent ces deux mots.',
  brdRevealKanji: 'Kanji',
  brdRevealLater: 'Plus tard, un mot à la fois.',
  brdRevealMeans: 'veut dire',
  brdRevealWord: (word) => `« ${word} »`,
  brdRevealFirst: (date, min) => `Ton premier arrêt : **les kana**, lus d’ici le **${date}** à ${min} min par jour.`,
  brdLevelQ: 'Super ! Quel est ton niveau ?',
  brdLevelHint: 'Les arrêts derrière toi seront marqués connus.',
  brdTestQ: 'Trouvons ton arrêt',
  brdTestPick: 'Je choisis',
  brdPlacedQ: level => `Tes réponses s’arrêtent à ${level}`,
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
  // Les lignes : quoi apprendre. Les kana ne sont pas une ligne à
  // choisir -- chaque billet les emprunte -- la feuille des lignes le
  // dit (components/boarding/CardSheets.jsx).
  brdLinesNone: 'Choisis au moins une ligne.',
  brdLine: { vocab: 'Vocabulaire', kanji: 'Kanji', grammar: 'Grammaire' },
  // 入門 (plan 170): when the lines start, for a learner short of
  // both scripts.
  brdLinesHintNovice: 'Elles commencent après les kana.',
  // The lines' sheet: the kana's strip and what each line carries on
  // the ride to its goal.
  brdOnEveryTicket: 'Sur chaque billet',
  brdLineCarries: {
    vocab: (stop) => `mots jusqu’au ${stop}`,
    kanji: (stop) => `kanji jusqu’au ${stop}`,
    grammar: (stop) => `points jusqu’au ${stop}`,
  },
  brdLinesArrive: (n, stop, date) => `${n === 1 ? 'Avec cette ligne' : n === 2 ? 'Avec ces deux lignes' : 'Avec ces trois lignes'}, arrivée au ${stop} en **${date}**.`,
  // The rhythm's departure board: a train's minutes and its service,
  // and the days its ride takes; the hour's board.
  brdADay: 'par jour',
  brdRhythmName: { 5: 'Omnibus', 10: 'Rapide', 15: 'Rapide spécial', 20: 'Express' },
  brdRideDays: (n) => (n === 1 ? '1 jour' : `${n} jours`),
  brdNewItems: (n) => `~${n} nouveautés`,
  brdDeparture: 'Départ',
  brdDayAria: 'Heure de départ',
  // La notification telle que l’appli l’envoie. brdAppName est le nom
  // sur les stores ; à garder en phase avec appName dans
  // capacitor.config.json.
  brdAppName: 'Tsuji',
  brdNotifText: 'Tes cartes t’attendent au portillon.',
  // ── 発車案内 — le rappel du jour tiré de la file, le widget et
  // Réglages › Notifications (plan 156). Le titre et le texte du rappel
  // disent ce que le portillon tiendra à l’heure de l’apprenant.
  nudgeTitle: (time, n) => `Ton train de ${time} · ${n} ${n > 1 ? 'cartes' : 'carte'}`,
  nudgeMinutes: (m) => (m <= 1 ? 'Environ une minute' : `Environ ${m} min`),
  nudgeNew: (n) => `${n} ${n > 1 ? 'nouvelles' : 'nouvelle'}`,
  // Le nom du canal des rappels dans les réglages d'Android (lib/native.js).
  nudgeChannel: 'Rappels',
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
  // 時間割 (plan 181) : l’emploi du temps de la semaine.
  settingsAgenda: 'Emploi du temps',
  agdRowEmpty: 'Aucun créneau',
  agdRowValue: (n) => `${n} ${n > 1 ? 'créneaux' : 'créneau'}`,
  agdEveryDay: 'Tous les jours',
  agdWeek: 'Ma semaine',
  agdWeekAria: 'Ta semaine, jour par jour',
  agdEmpty: 'Planifie ta semaine : un créneau par matière, et Tsuji te prévient quand il commence.',
  agdAdd: 'Ajouter un créneau',
  agdNew: 'Nouveau créneau',
  agdEdit: 'Modifier le créneau',
  agdNow: 'En cours',
  agdSubject: 'Matière',
  agdDays: 'Jours',
  agdFrom: 'De',
  agdTo: 'À',
  agdPresets: { weekdays: 'Semaine', weekend: 'Week-end', all: 'Tous' },
  agdRemind: 'Rappel',
  agdLeadLabel: 'Me prévenir',
  agdLead: (m) => (m === 0 ? 'À l’heure' : `${m} min avant`),
  agdBell: (m) => (m === 0 ? 'À l’heure' : `${m} min avant`),
  agdNoBell: 'Sans rappel',
  agdSave: 'Enregistrer',
  agdDelete: 'Supprimer',
  agdProblem: {
    days: 'Choisis au moins un jour.',
    time: 'Choisis une heure de début et de fin.',
    length: 'Un créneau dure 15 minutes au moins.',
  },
  agdClash: (name, days, from, to) => `Ce créneau chevauche ${name} (${days}, ${from}–${to}).`,
  agdSaveFailed: 'Le créneau n’a pas pu être enregistré. Réessaie.',
  agdLoadFailed: 'Ton emploi du temps n’a pas pu être chargé.',
  agdWebNote: 'Les rappels arrivent sur l’application mobile : sur le web, l’emploi du temps reste un repère.',
  agdDenied: 'Les notifications de Tsuji sont coupées dans les réglages de ton téléphone : les créneaux n’annonceront rien.',
  agdBlockAria: (name, day, from, to) => `${name}, ${day} de ${from} à ${to}`,
  agdNotifTitle: (name, lead) => (lead === 0 ? `${name} commence` : `${name} dans ${lead} min`),
  agdNotifBody: (from, to, lead) => (lead === 0 ? `${from}–${to}` : `À ${from}, jusqu’à ${to}`),
  agdSubjectName: {
    review: 'Révisions', kana: 'Kana', vocab: 'Vocabulaire', kanji: 'Kanji', grammar: 'Grammaire',
    reading: 'Lecture', translation: 'Traduction', dictation: 'Dictée', composition: 'Rédaction',
    conversation: 'Conversation', comprehension: 'Compréhension', exam: 'Examen blanc',
  },
  agdGo: 'Commencer',
  agdUntil: (end) => `jusqu’à ${end}`,
  agdDayEmpty: (day) => `Rien de prévu le ${day}.`,
  agdAddOn: (day) => `Ajouter le ${day}`,
  agdDuration: (h, m) => (h && m ? `${h} h ${String(m).padStart(2, '0')}` : h ? `${h} h` : `${m} min`),
  agdLasts: (d) => `Durée : ${d}`,
  agdLeadCaption: 'minutes avant le début',
  agdDayAria: (day, n) => `${day}, ${n} ${n > 1 ? 'créneaux' : 'créneau'}`,
  agdHoursAria: 'Heures de la journée',
  agdProgressAria: (name) => `${name}, temps écoulé`,
  agdThen: 'Ensuite',
  agdStartWith: 'Pour commencer',
  agdWeekTotalLabel: 'Par semaine',
  // 机 (plan 140) : la colonne du bureau, son nom pour un lecteur
  // d’écran et ses arrêts, un par question.
  brdBuildingAria: 'Préparation de ton trajet',
  brdStop: { kana: 'Kana', level: 'Niveau', card: 'Carte' },
  // La fin de la première course (screens/RideReading.jsx).
  brdEnter: 'Entrer en gare',
  // 辻 on a phone (plan 168): the kana over the lines' hub, the board's
  // arrival column and first stop, the hour's arrows and first train.
  brdKanaFirstShort: 'Kana, en premier',
  brdArriveAt: (stop) => `Arrivée au ${stop}`,
  brdFirstStop: (date) => `Premier arrêt : les kana, lus d’ici le **${date}**`,
  brdHourLater: 'Une heure plus tard',
  brdHourEarlier: 'Une heure plus tôt',
  brdHalfLater: 'Une demi-heure plus tard',
  brdHalfEarlier: 'Une demi-heure plus tôt',
  brdTrainAt: (today, time) => `Ton train · ${today ? 'aujourd’hui' : 'demain'}, **${time}**, puis chaque jour`,
  // La carte est le formulaire (plan 247) : la carte remplie, ses champs
  // des portes, une feuille par champ.
  brdCardQ: 'Ta carte, remplie pour toi.',
  brdCardHint: 'Touche un champ pour le changer.',
  brdIssue: 'Émettre ma carte',
  brdLevelTest: 'Pas sûr ? Le test te place',
  brdKeepDevice: 'Sur cet appareil seulement',
  brdKeepGo: 'Garder ma carte',
  brdKeepSent: (email) => `Lien envoyé à ${email}`,
  brdKeepChange: 'Changer',
  brdKeptGoogle: 'Gardée sur ton compte Google',
  brdKeptEmail: (email) => `Gardée · ${email}`,
  brdKeptAccount: 'Gardée sur ton compte',
  brdKeptSwitch: 'Changer de compte',
  brdSheetGoal: 'Objectif',
  brdSheetRhythm: 'Rythme',
  brdSheetHour: 'Départ',
  brdSheetLines: 'Lignes',
  brdSheetName: 'Nom',
  brdSheetAccount: 'Compte',
  brdSheetDone: 'C’est bon',
  // La liste sous la carte (plan 247) : chaque champ en clair, une porte
  // vers la même feuille que le champ de la carte.
  brdRowsAria: 'Modifier ta carte',
  brdRowGoal: (stop, date) => (date ? `${stop} · arrivée le ${date}` : stop),
  brdRowRhythm: (name, min) => `${name} · ${min} min par jour`,
  brdGoalCap: (min) => `à ${min} min par jour`,
  brdNameOptional: 'Facultatif',
  brdNamePlaceholder: 'Ton prénom',
  brdNameNote: 'Il s’imprime sur ta carte. En lettres latines, c’est aussi ton nom public dans le classement.',
  brdNameSave: 'Valider',
  cardNameTooLong: (n) => `${n} caractères au plus.`,
  brdAccountLede: 'Sans compte, ta carte ne vit que sur cet appareil.',
  brdLater: 'Plus tard',
  // Plan 270: the account sheet, raised to ask before the card issues and on
  // Today; an address and a password typed twice, no mail to follow.
  brdStayGuest: 'Continuer en invité',
  brdAccountAsk: 'Crée ton compte pour retrouver ta carte et ta progression sur tous tes appareils.',
  brdPasswordNew: (min) => `Mot de passe (${min} caractères au moins)`,
  brdPasswordAgain: 'Confirme le mot de passe',
  brdPasswordMismatch: 'Les deux mots de passe ne sont pas les mêmes.',
  brdAccountSentNote: (email) => `Presque : confirme ${email} depuis le lien que nous venons de t’envoyer.`,
  brdRemindAt: (time) => `Me rappeler à **${time}**`,
  brdAgendaAdd: 'Ajouter à mon agenda',
  brdAgendaTitle: 'Tsuji · ton train de japonais',
  brdAgendaBody: (min) => `${min} min de japonais, chaque jour.`,
  // Embarquer dans le navigateur d'une autre appli (lib/inAppBrowser.js) :
  // une carte prise là y reste.
  brdSheetOutside: 'Navigateur',
  brdOutsideLede: (app) => `Une carte prise dans ${app} reste dans ${app} : ton navigateur ne la verra pas.`,
  brdOutsideMenu: 'Sinon, le menu ⋯ en haut de l’écran ouvre cette page dans ton navigateur.',
  brdOutsideSafari: 'Ouvrir dans Safari',
  brdOutsideChrome: 'Ouvrir dans Chrome',
  brdOutsideStay: (app) => `Rester dans ${app}`,
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
  // L'aide du rail du bureau : le guide de la porte allumée, rejoué à la demande.
  guideHelp: 'Aide',
  guideHelpTour: gate => `Visite guidée : ${gate}`,
  guideTodayGate: 'Tes révisions du jour et le temps qu’elles prennent. Ajuster choisit les cartes et les lignes, puis embarque.',
  guideTabBar: 'Tes cinq onglets : Apprendre, Pratique, Aujourd’hui, Dictionnaire et ton profil.',
  guideTodayDuels: 'Les duels : deux minutes contre un ami ou un voyageur de ton niveau. Un chiffre d’or dit qu’un défi t’attend.',
  guideLearnPlate: 'Une ligne. Touche-la pour l’ouvrir. La pastille montre ce qui t’attend aujourd’hui.',
  guideLearnStops: 'Où tu en es sur la ligne, et les arrêts autour.',
  guideLearnShelf: 'Tes propres decks, et la bibliothèque des decks partagés par les autres.',
  guidePracticePass: 'Ces exercices font partie de l’abonnement.',
  // Les plaques de Pratique (plan 254) : un quai, son pied (ton niveau,
  // ce que tu y as fait) et l'examen blanc.
  guidePracticePlate: 'Un exercice : lire, comprendre, traduire, écouter, écrire ou converser. Touche-le pour l’ouvrir à ton niveau.',
  guidePracticeStops: 'Ton niveau, avec ce que tu y as fait et ta part de bonnes réponses.',
  guidePracticeExam: 'L’examen blanc : une épreuve type JLPT au niveau de ton choix, corrigée dès que tu la rends.',
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
  guideDictActions: 'Écoute-la, ou utilise ＋ pour la garder en favori ou l’ajouter à l’un de tes decks.',
  guideProfileStats: 'Statistiques : ce qui reste et ce qui t’échappe, ligne par ligne.',
  guideProfileBoard: 'Le classement en XP : cette semaine et depuis toujours.',
  // 机 (plan 115) : les notes qui enseignent les touches et les portes du bureau.
  guideTabBarDesk: 'Tes cinq sections, à gauche. Appuie sur / n’importe où pour chercher dans le dictionnaire.',
  guideTodayGateDesk: 'Tes révisions du jour et le temps qu’elles prennent. Choisis les cartes et les lignes à droite, puis embarque. Entrée le fait de n’importe où ici.',
  guideLearnStopsDesk: 'Toute la ligne. Clique sur un arrêt pour l’étudier.',
  // Pour un pointeur (plan 123) : les notes qui disaient « touchez ».
  guideLearnPlateDesk: 'Une ligne. Clique dessus pour l’ouvrir. La pastille montre ce qui t’attend aujourd’hui.',
  // Les plaques de Pratique au bureau (plans 165, 254) : chacune porte son exercice.
  guidePracticePlateDesk: 'Un exercice, et ce qu’il te demandera à ton niveau. Clique dessus pour l’ouvrir.',
  guideDictEntryDesk: 'Une entrée, ouverte à côté de la liste. ← et → pour parcourir la liste.',
  // 机 (plan 248) : sur le bureau, les chiffres du carnet de tampons ouvrent ceux du profil.
  guideProfileRecordsDesk: 'Tes chiffres : ta série et ton record, les jours tamponnés, tes révisions, ce que tu retiens, ta meilleure série sans faute.',
  // Réglages, les deux retours.
  settingsFirstRide: 'Premier essai',
  settingsRideAgain: 'Refaire l\'essai',
  settingsIntroAgain: 'Revoir l’introduction',
  settingsGuideAgain: 'Revoir le guide',
  settingsGuideAgainDone: 'Il réapparaîtra la prochaine fois que tu ouvriras chaque section.',
}

const onboarding = {
  durDays: (n) => `${n} jours`,
  durMonths: (n) => `${n} mois`,
  durYears: (n) => `${n} ans`,
  onbContinue: 'Continuer',
  onbStepsAria: (n, total) => `Étape ${n} sur ${total}`,
  onbTestKind: {
    reading: 'Comment se lit ce mot ?',
    orthography: 'Quelle est la bonne écriture en kanji ?',
    context: 'Quel mot complète la phrase ?',
    grammar: 'Quelle règle de grammaire est à l’œuvre ?',
  },
  onbTestStop: 'Trop dur ? J’arrête',
  onbClimbLabel: 'Niveaux : franchis, en cours, à venir',
  onbTestError: 'Le test n’a pas pu être chargé. Réessaie dans un instant.',
  onbTestRetake: 'Passer le test',
  onbTestResult: (level, correct, total) => `${correct} bonne${correct > 1 ? 's' : ''} réponse${correct > 1 ? 's' : ''} sur ${total} — on te conseille d’embarquer à ${level}.`,
  onbPaceRecommended: 'Recommandé',
  onbPassError: 'L’enregistrement a échoué — vérifie ta connexion et réessaie.',
  brdPassRefused: 'Le guichet n’a pas pu émettre ce titre — cela vient de nous, pas de ta connexion. Rien n’a été enregistré.',
  brdPassBusy: 'Le guichet ne répond pas pour l’instant. Rien n’a été enregistré : réessaie dans un instant.',
  // Le rythme quotidien, vécu : la jauge 新規 du hall et le terminus
  // de session des écrans d'étude (voir components/study/usePace.js).
  paceDoneTitle: 'Objectif du jour atteint',
  paceDoneOf: target => `sur ${target}`,
  paceDoneLabel: 'nouveautés aujourd’hui',
  paceDoneBody: 'C’est la part de nouveautés du jour. Les révisions continuent comme d’habitude.',
  paceExtraTrain: 'Encore des nouveautés',
  paceGaugeLabel: 'Nouveautés',
  paceGaugeAria: (n, target) => `${n} nouveauté${n > 1 ? 's' : ''} apprise${n > 1 ? 's' : ''} sur ${target} aujourd’hui`,
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
  // Le relevé d'un niveau sur un quai de Pratique (plan 130 ; au pied
  // de ses plaques au téléphone depuis le plan 254) : ce qui a été fait
  // à ce niveau, puis la part juste. L'espace avant le % est insécable,
  // comme partout en français.
  practiceDone: {
    sentences: n => `${n} phrase${n > 1 ? 's' : ''}`,
    texts: n => `${n} texte${n > 1 ? 's' : ''}`,
    papers: n => `${n} épreuve${n > 1 ? 's' : ''}`,
    replies: n => `${n} réponse${n > 1 ? 's' : ''}`,
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
    conversation: 'On te parle dans une scène : choisis ta réponse, écris-la ou réponds librement.',
    // Sur sa plaque, au bureau (plans 165, 254) : la question que son
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
    paper: 'Une question du grade',
    scene: 'Une scène du grade',
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
  // ── 模試 on a phone (plan 171) ──
  examGrade:           'Niveau',
  examNextPaper:       'Prochaine épreuve',
  examThisPaper:       'Cette épreuve',
  examToWrite:         'À rédiger',
  examMinutesShort: n => `${n} min`,
  examStart:           'Commencer',
  examPapers:          'Épreuves',
  examMinutesUnit:     'minutes',
  examPartsUnit: n => (n > 1 ? 'parties' : 'partie'),
  examCoverClock:      'Le chrono part quand tu commences.',
  examCoverBlank:      'Une question laissée vide compte faux : marque celles où tu veux revenir.',
  examSheetShort:      'Feuille',
  examPrevious:        'Précédente',
  examNextQuestion:    'Suivante',
  examFinishPaper:     'Terminer l’épreuve',
  examAnsweredOf: (n, total) => `${n} / ${total} répondues`,
  examBlanks: n => `${n} ${n > 1 ? 'vides' : 'vide'}`,
  examAudioReplayShort: 'Réécouter',
  examUnofficial:      'non officiel',
  examTimeOf: (time, limit) => `${time} sur ${limit}`,
  examScoreAgainst: (pct, target) => `${pct} % contre un objectif de ${target} %`,
  examByPart:          'Partie par partie',
  examSeeAll:          'Tout voir',
  examMissesOnly:      'Erreurs seules',
  examTimeLabel:       'Temps',
  examMisses: n => `${n} ${n > 1 ? 'erreurs' : 'erreur'}`,
  // What each part of a paper asks, in the learner's words, under its
  // JLPT name (the blueprint's name_jp).
  examMondai: {
    '漢字読み': 'Lecture des kanji',
    '表記': 'Écriture en kanji',
    '語形成': 'Formation des mots',
    '文脈規定': 'Le mot en contexte',
    '言い換え類義': 'Paraphrase',
    '用法': 'Emploi du mot',
    '文の文法1': 'Grammaire de la phrase',
    '文の文法2': 'Phrase à remettre en ordre',
    '文章の文法': 'Grammaire du texte',
    '内容理解（短文）': 'Textes courts',
    '内容理解（中文）': 'Textes moyens',
    '内容理解（長文）': 'Texte long',
    '統合理解': 'Textes à comparer',
    '主張理解（長文）': 'Texte d’opinion',
    '情報検索': 'Chercher une information',
    '課題理解': 'Comprendre la tâche',
    'ポイント理解': 'Saisir l’essentiel',
    '概要理解': 'Comprendre le propos',
    '発話表現': 'Que dire ?',
    '即時応答': 'Répondre tout de suite',
  },
  // Ce qu'une partie demande de faire, en clair, à la place de sa consigne japonaise (plan 171).
  examMondaiHow: {
    '漢字読み': 'Choisis comment se lit le mot souligné.',
    '表記': 'Choisis comment s’écrit en kanji le mot souligné.',
    '語形成': 'Choisis ce qui complète le mot.',
    '文脈規定': 'Choisis le mot qui va dans le blanc.',
    '言い換え類義': 'Choisis la phrase de sens le plus proche.',
    '用法': 'Choisis la phrase où le mot est bien employé.',
    '文の文法1': 'Choisis ce qui va dans le blanc.',
    '文の文法2': 'Remets les morceaux dans l’ordre et choisis celui qui va à la place de ★.',
    '文章の文法': 'Lis le texte et choisis ce qui va dans chaque blanc.',
    '内容理解（短文）': 'Lis le texte et réponds à la question.',
    '内容理解（中文）': 'Lis le texte et réponds à la question.',
    '内容理解（長文）': 'Lis le texte et réponds à la question.',
    '統合理解': 'Lis les deux textes et réponds à la question.',
    '主張理解（長文）': 'Lis le texte et réponds à la question.',
    '情報検索': 'Cherche dans le document ce que la question demande.',
    '課題理解': 'Écoute, puis choisis ce que la personne doit faire.',
    'ポイント理解': 'Lis la question, écoute, puis choisis la bonne réponse.',
    '概要理解': 'Écoute, puis choisis ce que la personne veut dire.',
    '発話表現': 'Regarde la situation et choisis ce qu’il faut dire.',
    '即時応答': 'Écoute la phrase et choisis la meilleure réponse.',
  },
  examMinutes: n => `≈\u00a0${n}\u00a0min`,
  // ── L'examen blanc au bureau (plan 200) ──────────────────────
  // Le cahier à gauche, la feuille de réponses à droite ; la page se
  // tourne dans son pied.
  examQuit:            'Quitter',
  examMark:            'Marquer',
  examToAnswer:        'pour répondre',
  examLastQuestion:    'Dernière question',
  examThisText:        'Ce texte',
  examLikeThePaper:    'Comme dans l’épreuve',
  examYourSheet:       'Ta feuille',
  examBlanksLeft: n => `${n} question${n > 1 ? 's' : ''} vide${n > 1 ? 's' : ''}`,
  examBlankCounts:     'Une question vide compte faux.',
  examGoTo: n => `Aller à la ${n}`,
  examHandIn:          'Rendre quand même',
  examMissOf: (i, n) => `erreur ${i} sur ${n}`,
  examPapersSat:       'épreuves',
  examRightCap:        'justes',
  examLastSitting:     'la dernière',
  examSheetRow: (n, answered) => `Question ${n}${answered ? '' : ', vide'}`,
  examOval: (n, choice) => `Question ${n}, réponse ${choice}`,
  examAnsweredCap:     'répondues',
  examSheetResult: (n, state) => `Question ${n}, ${state === 'ok' ? 'juste' : state === 'x' ? 'fausse' : 'laissée vide'}`,
  examPlayPause:       'lecture, pause',
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
  // Nous écrire (plan 222) : un problème, une idée, une faute dans ce
  // qui est enseigné, et la carte signalée depuis son drapeau. Rien n'est
  // envoyé de l'appareil sans être écrit ici en clair.
  settingsWrite: 'Nous écrire',
  settingsWriteValue: 'Un problème, une idée',
  fbKindLabel: 'Ce que c’est',
  fbKind: { problem: 'Problème', idea: 'Idée', fault: 'Faute' },
  fbPlaceholder: {
    problem: 'Ce qui s’est passé, et où.',
    idea: 'Ce que tu aimerais trouver ici.',
    fault: 'Le mot ou la phrase, et ce qui ne va pas.',
  },
  fbTextLabel: 'Ton message',
  fbJoin: 'Joindre l’écran et l’appareil',
  fbJoinFailure: 'Joindre l’erreur, l’écran et l’appareil',
  fbScreen: 'cet écran',
  fbFailure: (status, area) => `erreur ${status} (${area})`,
  fbDevice: { phone: 'téléphone', tablet: 'tablette', desk: 'ordinateur', wide: 'ordinateur' },
  fbPlatform: { web: 'web', native: 'application' },
  fbReply: 'Me répondre par e-mail, depuis',
  fbSend: 'Envoyer',
  fbSent: 'Reçu, merci.',
  fbSentNote: 'Chaque message est lu par une personne.',
  fbSentReply: 'Chaque message est lu par une personne. La réponse arrive par e-mail.',
  fbErrLimit: 'Cinq messages par jour : la suite demain.',
  fbErrSend: 'Le message n’est pas parti. Réessaie.',
  // Accès anticipé (plan 269) : demandé une fois, à partir de 400 XP.
  rateCap: 'Accès anticipé',
  rateQ: 'Quelle note pour Tsuji ?',
  rateLead: 'L’app est en accès anticipé. Y a-t-il quelque chose que tu aimerais voir changer ?',
  rateLabel: 'Ta note',
  rateStar: n => `${n} sur 5`,
  ratePlaceholder: 'Ce que tu changerais, s’il y a quelque chose.',
  rateTextLabel: 'Ce que tu changerais',
  rateLater: 'Plus tard',
  cardReport: 'Signaler cette carte',
  cardReportReasons: 'Ce qui ne va pas',
  cardReason: { reading: 'Lecture', meaning: 'Sens', audio: 'Audio', example: 'Exemple', other: 'Autre' },
  questionReport: 'Signaler cette question',
  questionReason: { answer: 'Mauvaise réponse', ambiguous: 'Ambiguë', audio: 'Audio', other: 'Autre' },
  cardReportNote: 'Un mot de plus, si tu veux.',
  cardReportNoteLabel: 'Un mot de plus',
  reportProblem: 'Signaler ce problème',
  settingsCreditsCount: n => `${n} sources`,
  settingsPaceMinutes: m => `≈ ${m} min`,
  settingsYourPace: 'Ton rythme',
  settingsYourPaceSub: n => `${n} / jour · 14 derniers jours`,
  settingsInsteadOf: d => `au lieu du ${d}`,
  creditsWhat: { dictionary: 'Dictionnaire', kanji: 'Kanji', strokes: 'Ordre des traits', sentences: 'Phrases d’exemple', voice: 'Voix des gares', speech: 'Voix japonaise', kana: 'Voix des kana', type: 'Polices' },
  // La licence d'une source qui a ses propres conditions (domain/attributions.js).
  creditsTerms: name => `conditions de ${name}`,
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
  settingsTrailHint: 'Quels écrans et fonctions tu utilises, et combien de temps, jamais ce que tu écris. Sur notre serveur, jamais partagé, effacé sous 25 mois.',
  settingsTrailExportBtn: 'Télécharger les miennes',
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
  releaseNoticeAt: (time) => `Mise à jour à ${time} : l’app peut se figer quelques minutes.`,
  releaseNoticeNow: 'Mise à jour en cours : l’app peut se figer quelques minutes.',
  releaseNoticeOk: 'Compris',
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
const nyumon = {
  // 入門 — l'introduction (plan 170) : six écrans avant la première
  // carte, pour qui a répondu « Pas encore » à la question des kana.
  // La carte de la langue, pas son savoir : rien ne s'y apprend par cœur.
  nyuDocumentTitle: 'Introduction',
  nyuSkip: 'Passer l’introduction',
  nyuStop: { scripts: 'Écritures', sounds: 'Sons', table: 'Tableau', katakana: 'Katakana', sentence: 'Phrase', route: 'Trajet' },
  nyuStripAria: 'Les 6 écrans de l’introduction',
  nyuQuote: s => `« ${s} »`,
  nyuTranslation: '« Je bois un café à la gare. »',
  // 1 · Écritures
  nyuScriptsQ: 'Le japonais mélange 3\u00a0écritures.',
  nyuScriptsHint: 'Touche-en une pour la voir dans la phrase.',
  nyuScript: {
    hira: { name: 'Hiragana', desc: 'Les petits mots et les terminaisons' },
    kata: { name: 'Katakana', desc: 'Les mots venus d’ailleurs' },
    kanji: { name: 'Kanji', desc: 'Un sens par signe, pour plus tard' },
  },
  nyuScriptsLit: (name, signs) => `${name} : ${signs}`,
  // 2 · Sons
  nyuSoundsQ: 'Tout part de 5\u00a0voyelles.',
  nyuSoundsHint: 'Touche un signe pour l’entendre.',
  // Le son d'une voyelle, là où l'écrire en lettres tromperait.
  nyuSoundsLike: { u: 'ou', e: 'é' },
  nyuSoundsFoot: 'Elles se prononcent toujours pareil.',
  nyuVowelsAria: 'Les 5 voyelles',
  // 3 · Tableau
  nyuTableQ: '46\u00a0signes, 10\u00a0lignes de\u00a05.',
  nyuTableHint: 'Où est « ke » ? Croise la ligne k et la colonne e.',
  nyuTableFound: '**k + e = ke.** Tu viens de lire un signe qu’on ne t’avait pas montré.',
  nyuTableAria: 'Le tableau des 46 signes',
  // 4 · Katakana
  nyuPairsQ: 'Les mêmes sons, 2\u00a0façons de les écrire.',
  nyuPairsLead: 'Le katakana écrit les mots venus d’ailleurs. Tu en connais déjà :',
  nyuHearWord: 'Lire le mot',
  nyuWords: { hotel: 'hôtel', coffee: 'café', tv: 'télé' },
  // 5 · Phrase
  nyuSentenceQ: 'Le verbe vient à la fin.',
  nyuSentenceHint: 'Pas de « je », pas d’article, pas de pluriel.',
  nyuGhost: '(je)',
  nyuMeans: { station: 'gare', coffee: 'café', drink: 'bois' },
  nyuRoles: { where: 'où', what: 'quoi' },
  nyuVerb: 'verbe',
  nyuSwap: 'Inverser gare et café',
  nyuSwapped: '**Même sens :** l’étiquette porte le rôle, pas la place.',
  // 6 · Trajet
  nyuRouteQ: date => `D’ici le ${date}, tu liras ces signes-là.`,
  nyuRouteQSoon: 'Bientôt, tu liras ces signes-là.',
  nyuRouteStops: { start: 'Départ', kana: 'Les kana', n5: 'N5' },
  nyuRouteDay: n => `Chaque jour : **${n}\u00a0nouveautés** et tes révisions.`,
  nyuTryCard: 'Essayer une carte',
}


// ══ 終着 — the day cleared (plan 191) ══════════════════════════════
// The copy of the canvas "Tsuji — the day cleared", verbatim. One group
// per screen (the same region names as index.css's), each written by
// the screen that owns it. The Japanese captions (本日の運行 終了,
// 途中下車, 連続乗車 継続, 記念切符, 記念乗車券, 辻駅 発行) are names, not
// copy: the components print them as they are.

// ── 191:primitives ──
const clrPrimitives = {
  clrXpUnit: 'xp',
  // The week, said for a screen reader: its parts joined (week row).
  clrWeekAria: parts => `Semaine : ${parts.join(', ')}`,
  clrWeekStamped: (from, to) => (from === to ? `${from} tamponné` : `${from} à ${to} tamponnés`),
  clrWeekMissed: day => `${day} manqué`,
  clrWeekRest: day => `${day} couvert par un jour de repos`,
  clrWeekToday: day => `${day} aujourd’hui`,
  clrSealAria: date => `Tampon du jour : gare de Tsuji, ${date}`,
  // A ticket's caption: "7 jours de suite", a month's and a year's by name.
  clrTicketCaption: days => (days === 30 ? 'Un mois de suite' : days === 365 ? 'Un an de suite' : `${days} jours de suite`),
}
// ── 191:primitives end ──




// ── 191:piles ──
// The piles' names and a pile's sheet (PileSheet): the À revoir row of
// the finish opens the run's wrong pile there (plan 250).
const clrDay = {
  clrPiles: ['À revoir', 'Justes', 'Faciles'],
  clrPileCount: n => `${n}\u00a0carte${n === 1 ? '' : 's'}`,
  clrPileEmpty: 'Aucune carte',
  clrPileOpen: term => `Ouvrir ${term} dans le dictionnaire`,
}
// ── 191:piles end ──




// ── 250:finish ──
// The finish played on Today (components/dayclear/useFinish.js and its
// parts): the day's fare under the dial, the board's rows, the month's
// ticket and the rest day it brought, the partial run's line and its
// thread, and what the sky's crossings say to a screen reader.
const clrFinish = {
  // "+252 xp · dont +55 de prime de série": the figures set in gold.
  finFareOf: 'dont',
  finFarePrime: 'de prime de série',
  finMissGo: 'Revoir',
  finTicketName: days => (days === 7 ? 'Billet de la semaine' : days === 30 ? 'Billet du mois' : days === 365 ? 'Billet de l’année' : `Billet des ${days} jours`),
  finTicketAria: (days, jackpot, rest) => `${days === 7 ? 'Billet de la semaine' : `Billet des ${days} jours`} : +${jackpot} xp${rest ? ', +1 jour de repos' : ''}`,
  finShare: 'Partager le billet',
  finShareGo: 'Image',
  finRestLine: held => `+1 jour de repos · ${held} en réserve`,
  finMonthTicketAria: (days, jackpot) => `${days === 30 ? 'Billet du mois' : days === 365 ? 'Billet de l’année' : `Billet des ${days} jours`}, ${days === 30 ? 'un mois de suite' : days === 365 ? 'un an de suite' : `${days} jours de suite`} : +${jackpot} xp`,
  finCranesAria: n => `${n} grue${n === 1 ? '' : 's'} traverse${n === 1 ? '' : 'nt'} le ciel, une par jour de suite`,
  finLanternsAria: n => (n >= 365 ? 'Une rivière de lanternes sur le lac, une année de jours' : `${n} lanternes sur le lac, une par jour`),
  // "≈ 5 min pour le tampon du jour · +55 xp" under the open gate's dial.
  finStake: 'pour le tampon du jour',
  finThreadDone: n => (n === 1 ? 'faite' : 'faites'),
  finThreadLeft: n => (n === 1 ? 'reste' : 'restent'),
  finContinue: 'Continuer',
}
// ── 250:finish end ──




// ── 191:restday ──
const clrRestday = {
  rstTitle: 'Ta série tient',
  rstWeekAria: parts => `La semaine : ${parts.join(', ')}`,
  rstStreakWord: n => (n === 1 ? 'jour de suite' : 'jours de suite'),
  // The days the rest tickets covered, by name: "Jour de repos utilisé mardi".
  rstUsed: days => (days.length === 1
    ? `Jour de repos utilisé ${days[0]}`
    : `Jours de repos utilisés ${days.slice(0, -1).join(', ')} et ${days.at(-1)}`),
  // "0 en réserve · le prochain au 14ᵉ jour": the figures are set apart.
  rstHeld: 'en réserve',
  rstNextPre: 'le prochain au',
  rstNextPost: 'ᵉ jour',
  rstTodayAria: (n, min) => `Aujourd’hui : ${n} carte${n === 1 ? '' : 's'}${min ? `, environ ${min} minute${min > 1 ? 's' : ''}` : ''}`,
  rstCards: n => (n === 1 ? 'carte' : 'cartes'),
  rstMin: 'min',
  rstDepart: 'Départ',
}
// ── 191:restday end ──




// ── 191:tickets ──
const clrTickets = {
  tkbTitle: 'Billets',
  tkbDoor: 'Billets',
  tkbBack: 'Retour au profil',
  tkbChosenAria: 'Billet choisi',
  tkbRecord: 'Record',
  tkbBookAria: (n, total) => `Billets : ${n} gagné${n === 1 ? '' : 's'} sur ${total}`,
  tkbIn: n => `dans ${n} j`,
  tkbDaysShort: n => `${n} j`,
  tkbRange: (from, to) => `du ${from} au ${to}`,
  tkbTicketAria: (days, no, range, record) => `Billet des ${days} jours, numéro ${no}, ${range}${record ? ', record' : ''}`,
  tkbCellAria: (days, record) => `Billet des ${days} jours${record ? ', record' : ''}`,
  tkbLockedAria: (days, inDays) => `Billet des ${days} jours, pas encore gagné${inDays ? `, dans ${inDays} jour${inDays > 1 ? 's' : ''}` : ''}`,
  tkbShareTicket: 'Partager ce billet',
  tkbShareFigures: { reviews: 'cartes revues', words: 'mots appris', level: 'en route' },
  tkbShareAria: (days, no, range, stamped) => `Billet des ${days} jours, numéro ${no}, ${range}, tamponné le ${stamped}`,
  tkbShareRouteAria: 'Le parcours',
  tkbShareText: days => `${days} jours de suite sur Tsuji`,
  tkbShareSaved: 'Image enregistrée.',
  tkbShareFailed: 'Le partage n’a pas abouti.',
  tkbToday: 'aujourd’hui',
  // No ticket yet: the first, named, and the way to it.
  tkbEmpty: 'Ton premier billet',
  tkbEmptyAria: (days, inDays) => `Pas encore de billet. Le premier, ${days} jours de suite, ${inDays ? `dans ${inDays} jour${inDays === 1 ? '' : 's'}` : 'aujourd’hui'}`,
  tkbEmptyGo: 'Départ',
}
// ── 191:tickets end ──


// ── 217:reviews ──
// 回復運転 — the review plan (plan 217): the comeback notice on Today
// and its sheet (plan 254), the catch-up's figure in the day, the run
// past the share, Settings › Reviews and the notification that invites
// back.
const reviewPlan = {
  cbJp: '運転再開',
  cbCap: 'Reprise du service',
  cbLabel: 'Reprendre à ton rythme',
  cbAway: n => `Bon retour ! ${n} jour${n > 1 ? 's' : ''} sans réviser.`,
  cbPiled: 'Tes révisions se sont accumulées.',
  cbOwed: n => `${n} cartes attendent. Inutile de tout faire aujourd’hui : choisis ton rythme.`,
  cbChoices: 'Ton rythme',
  cbSpread: 'Étaler',
  cbGentle: 'En douceur',
  cbAll: 'Tout de suite',
  cbPerDay: n => `${n} par jour`,
  cbOverDays: n => `en ${n} jours`,
  cbNoEnd: 'sans échéance',
  cbCards: n => `${n} carte${n > 1 ? 's' : ''}`,
  cbMinutes: m => `≈ ${m} min`,
  cbDays: 'Sur combien de jours',
  cbDaysN: n => `${n} jours`,
  cbNewPaused: 'Les nouvelles cartes reprennent dès que tu es à jour.',
  cbGo: 'C’est parti',
  cbError: 'Ton choix n’a pas pu être enregistré. Réessaie.',
  cbLinePiled: n => (n === 1 ? 'carte accumulée' : 'cartes accumulées'),
  cbLineGo: 'Étaler',
  cbHide: 'Masquer pour aujourd’hui',
  todayCatchupDay: 'jour de rattrapage',
  todayCatchupGentle: 'par jour, en rattrapage',
  todayCatchupShort: 'rattrapage',
  todayHeld: 'En attente',
  todayHeldGo: 'Réviser',
  settingsReviews: 'Révisions',
  rvRowNone: 'Sans plafond',
  rvRowCap: n => `${n} au plus par jour`,
  rvRowCatchup: 'Rattrapage en cours',
  rvRowAway: from => `Absent à partir du ${from}`,
  rvCapLabel: 'Révisions par jour',
  rvCapHint: 'Au-delà, les cartes attendent le lendemain, et ta journée se boucle sur ta part.',
  rvCapNone: 'Aucun',
  rvCapUnder: load => `Environ ${load} cartes arrivent chaque jour : sous ce plafond, le retard grandira.`,
  rvCatchupLabel: 'Rattrapage',
  rvCatchupSpread: (perDay, day, of) => `${perDay} cartes par jour · jour ${day} sur ${of}`,
  rvCatchupGentle: perDay => `${perDay} cartes par jour, sans échéance`,
  rvCatchupNew: 'Les nouvelles cartes sont en pause jusqu’à la fin.',
  rvCatchupStop: 'Arrêter le rattrapage',
  rvAwayLabel: 'Absence prévue',
  rvAwayHint: n => `Tes jours d’absence gardent ta série, et les nouvelles cartes s’arrêtent deux jours avant ton départ. ${n} jours au plus.`,
  rvAwayFrom: 'Du',
  rvAwayUntil: 'Au',
  rvAwaySave: 'Enregistrer',
  rvAwayCancel: 'Annuler l’absence',
  rvAwaySet: (from, until) => `Du ${from} au ${until}`,
  rvAwayErr: {
    past: 'Le premier jour ne peut pas être passé.',
    order: 'Le dernier jour vient après le premier.',
    long: n => `${n} jours au plus.`,
  },
  rvError: 'Le changement n’a pas pu être enregistré.',
  nudgeComebackTitle: time => `Ton train de ${time} · on reprend doucement ?`,
  nudgeComebackBody: 'Quelques minutes suffisent pour repartir.',
}
// ── 217:reviews end ──

// ── 243b:transfer ──
// 乗換 (plans 243, 243b): Settings › Correspondance, another app's
// progress brought across on a transfer ticket -- the source, the file
// or the key, what the course finds, the stamp, and the way back while
// the imported cards wait for their first answer; and the sheet over
// Today that asks a new learner, once.
const trCount = n => n.toLocaleString('fr-FR')
const transfer = {
  settingsTransfer: 'Correspondance',
  trRowValue: 'Anki, WaniKani, Renshuu',
  trCap: 'Correspondance',
  trTicketLabel: 'Billet de correspondance',
  trFrom: 'De',
  trTo: 'Vers',
  trSource: { anki: 'Anki', wanikani: 'WaniKani', renshuu: 'Renshuu' },
  trFileHint: 'Ton fichier **.apkg** ou **.colpkg**',
  trChooseFile: 'Choisir mon fichier Anki',
  trKeyLabel: { wanikani: 'Ton jeton d’API WaniKani', renshuu: 'Ta clé d’API Renshuu' },
  trKeyPlaceholder: { wanikani: 'Colle-le ici', renshuu: 'Colle-la ici' },
  trReadKey: { wanikani: 'Lire mes cartes WaniKani', renshuu: 'Lire mes cartes Renshuu' },
  trPages: n => `${trCount(n)} page${n > 1 ? 's' : ''} lue${n > 1 ? 's' : ''}`,
  trHowQ: { anki: 'Comment l’exporter depuis Anki ?', wanikani: 'Où trouver mon jeton ?', renshuu: 'Où trouver ma clé ?' },
  trHow: {
    anki: ['**Fichier › Exporter…**', 'Coche **Inclure les informations de planification**', 'Décoche **Inclure les médias** : le fichier reste léger'],
    wanikani: ['Sur WaniKani, **Settings › API Tokens**', 'Crée un jeton **sans aucune permission** : il ne pourra que lire', 'Colle-le ici'],
    renshuu: ['Dans les réglages de Renshuu, trouve ta **clé d’API**', 'Copie-la', 'Colle-la ici'],
  },
  trPrivacyFile: 'Lu sur ton appareil. Seuls les mots partent.',
  trPrivacyKey: name => `Ton appareil lit ${name} lui-même : ta clé ne nous est jamais envoyée, et n’est pas gardée.`,
  trFound: n => `carte${n > 1 ? 's' : ''} reprise${n > 1 ? 's' : ''}`,
  trLine: { vocab: 'Vocabulaire', kanji: 'Kanji', kana: 'Kana' },
  trDecks: 'Paquets',
  trDue: (n, weeks) => `${trCount(n)} ${n > 1 ? 'étaient en retard : elles reviennent' : 'était en retard : elle revient'} sur ${weeks} semaines.`,
  trKept: n => `${trCount(n)} déjà étudiée${n > 1 ? 's' : ''} ici ${n > 1 ? 'restent comme elles sont' : 'reste comme elle est'}.`,
  trAbove: n => `${trCount(n)} ${n > 1 ? 'sont' : 'est'} au-delà de ton niveau et de ta destination : ${n > 1 ? 'elles reviendront' : 'elle reviendra'} dans ta journée quand ton niveau y arrivera.`,
  trCheck: 'Chaque carte est vérifiée à son premier passage.',
  trPunch: 'Composter le billet',
  trAllKept: 'Tu as déjà étudié ici toutes ces cartes : rien à reprendre.',
  trNone: 'Aucune de ces notes n’a de carte dans le cours.',
  trMissing: n => `${trCount(n)} note${n > 1 ? 's' : ''} sans carte dans le cours`,
  trMissingSample: sample => `Par exemple : ${sample}.`,
  trReadFrom: list => `Mots lus dans ${list}.`,
  trRestart: 'Recommencer',
  trImported: n => `carte${n > 1 ? 's' : ''} importée${n > 1 ? 's' : ''}`,
  trImportedHint: 'Elles rejoignent ta journée à leur date. La première fois, chacune est vérifiée.',
  trPunched: 'Composté',
  trGoToday: 'Aller à Aujourd’hui',
  trWaiting: n => `${trCount(n)} carte${n > 1 ? 's' : ''} importée${n > 1 ? 's attendent' : ' attend'} encore ta première réponse.`,
  trUndo: 'Annuler l’import',
  trUndoConfirmQ: 'Retirer les cartes importées que tu n’as pas encore revues ? Celles que tu as revues ici restent.',
  trUndoYes: 'Retirer',
  trUndone: n => `${trCount(n)} carte${n > 1 ? 's' : ''} retirée${n > 1 ? 's' : ''}.`,
  trErr: {
    notAnki: 'Ce fichier n’est pas un paquet Anki (.apkg ou .colpkg).',
    unreadable: 'Ce fichier n’a pas pu être lu.',
    noSchedule: 'Ce paquet a été exporté sans sa planification : exporte-le de nouveau avec « Inclure les informations de planification ».',
    nothing: 'Rien à reprendre : aucune carte que l’appli t’a déjà apprise.',
    tooMany: 'Trop de notes en une fois : choisis moins de paquets.',
    badKey: 'Cette clé n’est pas acceptée. Vérifie-la et colle-la de nouveau.',
    network: 'Impossible de joindre l’appli. Vérifie ta connexion.',
    rate: 'L’appli demande d’attendre un peu. Réessaie dans une minute.',
    unreachable: 'L’appli n’a pas répondu comme prévu. Réessaie plus tard.',
    server: 'L’import n’a pas pu aboutir. Réessaie.',
  },
  trSheetQ: 'Tu as déjà appris ailleurs ?',
  trSheetLead: 'Les mots que tu connais ne repartent pas de zéro : ils gardent leur rythme.',
  trSheetGo: 'Reprendre ma progression',
  trSheetLater: 'Je commence ici',
  trSheetFoot: 'Toujours possible plus tard, dans Réglages.',
}
// ── 243b:transfer end ──

// ── 対戦 — les duels (plan 279) ─────────────────────────────────
// Le sprint : deux minutes, les mêmes questions pour les deux.
const pvp = {
  pvpTitle:        'Duels',
  pvpChallenges:   n => (n === 1 ? '1 défi à jouer' : `${n} défis à jouer`),
  pvpFriendsN:     n => (n === 1 ? '1 ami' : `${n} amis`),
  pvpRequestsN:    n => (n === 1 ? '1 demande' : `${n} demandes`),
  pvpElo:          'Elo',
  pvpRecordLong:   (w, d, l) => `${w} victoires · ${d} nuls · ${l} défaites`,
  pvpRankOf:       (r, n) => `${r === 1 ? '1er' : `${r}ᵉ`} sur ${n}`,
  pvpSprints:      'sprints',
  pvpBeat:         s => `${s} à battre`,
  pvpHoursLeft:    h => `reste ${h} h`,
  pvpDefies:       who => `${who} te défie`,
  pvpLiveDefies:   who => `${who} t’attend en direct`,
  pvpPlay:         'Jouer',
  pvpBeatUnit:     'à battre',
  pvpDefy:         'Défier',
  // 新しい (plan 287) : les duels annoncés une fois, sur Aujourd’hui, à
  // qui l’a connu avant que leur clé n’y soit.
  newsCap:         'Nouveau',
  newsDuelsTitle:  'Les duels arrivent sur Aujourd’hui',
  newsDuelsLead:   depart => `Deux minutes de questions contre un ami ou un voyageur de ton niveau, et la vitesse compte. La clé ⇄, à côté d’« ${depart} », ouvre les duels.`,
  newsDuelsGo:     'Voir les duels',
  newsDuelsLater:  'Plus tard',
  pvpRanked:       'Sprint classé',
  pvpRankedDesc:   'Un inconnu d’Elo proche, ou sa partie enregistrée.',
  pvpFriendDuel:   'Défier un ami',
  pvpFriendDesc:   'En différé ou en direct. Non classé.',
  pvpCredits:      n => (n === 1 ? '1 crédit' : `${n} crédits`),
  pvpFree:         'Gratuit',
  // The pass pays for everything (the hall's and the ticket's price).
  pvpIncluded:     'Inclus',
  pvpTabToPlay:    'À jouer',
  pvpTabRunning:   'En cours',
  pvpTabDone:      'Terminés',
  pvpFriendTag:    'ami',
  pvpWin:          'Gagné',
  pvpLoss:         'Perdu',
  pvpDraw:         'Égalité',
  pvpTraveller:    'Voyageur',
  pvpFriendsTitle: 'Amis',
  pvpSearchCap:    'Son pseudo, exactement',
  pvpAsk:          'Demander en ami',
  pvpAccept:       'Accepter',
  pvpRefuse:       'Refuser',
  pvpRequest:      'demande d’amitié',
  pvpYourDuels:    (w, l) => `vos duels : ${w} V · ${l} D`,
  pvpAddFriend:    'Ajouter un ami par son pseudo',
  pvpWhom:         'Qui défier',
  pvpHow:          'Comment',
  pvpLater:        'En différé · 48 h',
  pvpLive:         'En direct',
  pvpLaterHelp:    who => `Même suite pour vous deux ; ${who} a 48 h pour la courir.`,
  pvpLiveHelp:     who => `Vous partez ensemble, trois secondes après l’arrivée de ${who}.`,
  pvpChallenge:    who => `Défier ${who}`,
  pvpInvite:       who => `Inviter ${who}`,
  pvpSprintOf:     ms => (ms >= 120_000 && ms % 60_000 === 0 ? `Sprint · ${ms / 60_000} minutes` : `Sprint · ${ms / 1000} secondes`),
  pvpDuelLevel:    'Niveau du duel',
  pvpQuestions:    'Questions',
  pvpWordsKanji:   'mots et kanji',
  pvpWordsKana:    'mots et kana',
  pvpWordsKanaKanji: 'mots, kana et kanji',
  pvpEloOf:        n => `Elo ${n}`,
  pvpEloRange:     (a, b) => `Elo ${a} – ${b}`,
  pvpChoicesN:     n => `${n} réponses`,
  pvpLength:       'Durée',
  pvpMinutes:      n => `${n} min`,
  pvpStake:        'Enjeu',
  pvpStakeElo:     n => `± ${n} Elo`,
  pvpNovice:       'Débutant',
  pvpPrice:        'Prix',
  pvpFreeFriends:  'gratuit entre amis',
  pvpGo:           'Partir',
  pvpRankedFoot:   'Si personne de ton Elo n’est libre, tu cours contre la partie enregistrée d’un vrai joueur, son pseudo affiché.',
  pvpGoPaid:       n => `Partir · ${n} crédits`,
  pvpYou:          'Toi',
  pvpKind:         { word: 'Mot', reading: 'Lecture', writing: 'Écriture', kana: 'Kana' },
  pvpQuit:         'Quitter le sprint',
  pvpReady:        'À vos marques',
  pvpOver:         'Fini',
  // The race as a game (plan 285, the owner's C1) and its result (E4).
  pvpGoBand:       'Partez !',
  pvpArrival:      'Arrivée !',
  pvpRush:         'Rush',
  pvpCombo:        'Combo',
  pvpComboLost:    n => `${n} perdu`,
  pvpPassMe:       'Devant !',
  pvpPassThem:     who => `${who} devant`,
  pvpNote:         { flash: 'Éclair', quick: 'Rapide' },
  pvpLines:        { speed: 'Vitesse', combo: 'Combo', rush: 'Rush', accuracy: 'Justesse', flashes: 'Éclairs' },
  pvpInARow:       (a, b) => `${a} / ${b} d’affilée`,
  pvpVerdict:      { win: 'Victoire !', loss: 'Défaite', draw: 'Égalité' },
  pvpAhead:        n => `${n.toLocaleString('fr')} point${n === 1 ? '' : 's'} d’avance`,
  pvpBehind:       n => `à ${n.toLocaleString('fr')} point${n === 1 ? '' : 's'}`,
  pvpGrade:        g => `Note ${g}`,
  pvpBy:           n => `de ${n} point${n === 1 ? '' : 's'}`,
  pvpWaitingFor:   who => `En attente de ${who}`,
  pvpRightsOf:     (r, n) => `${r} justes sur ${n}`,
  pvpCorrections:  'Détail et corrections',
  pvpNewSprint:    'Nouveau sprint',
  pvpRematch:      'Revanche',
  pvpXpLeft:       n => `${n} encore aujourd’hui`,
  pvpEloBoard:     'Classement Elo',
  pvpAll:          n => `Tous · ${n}`,
  pvpFriendsOnly:  n => `Amis · ${n}`,
  pvpGapTo:        (n, r) => `${n} points d’Elo de la ${r === 1 ? '1re' : `${r}ᵉ`} place`,
  pvpBilan:        'bilan',
  pvpOrdinal:      r => (r === 1 ? '1er' : `${r}ᵉ`),
  pvpOutOf:        n => `sur ${n}`,
  pvpDuelWith:     who => `Duel · ${who}`,
  pvpToBeat:       'À battre',
  pvpNoneToPlay:   'Aucun défi à jouer.',
  pvpNoneRunning:  'Rien en cours.',
  pvpNoneDone:     'Aucun duel terminé.',
  pvpLiveWaits:    'En direct · t’attend',
  pvpLiveNow:      'En direct',
  pvpRunning:      'Ton sprint est en cours',
  pvpResume:       'Reprendre',
  pvpNobodyYet:    'en attente d’un adversaire',
  pvpClosedRow:    'fermé',
  pvpEnter:        'Entrer',
  pvpOpen:         'Ouvrir',
  pvpEloFrom:      level => `Il part de ton niveau ${level}, puis bouge à chaque sprint classé.`,
  pvpNotRanked:    'pas encore classé',
  pvpProvisional:  'Provisoire : moins de 15 duels classés',
  pvpCurveLabel:   n => `Ton Elo sur les ${n} derniers duels classés`,
  pvpStartAt:      n => `départ ${n}`,
  pvpPeak:         n => `pic ${n}`,
  pvpRacedLater:   who => `${who} courra contre ton enregistrement.`,
  pvpVerdictLater: who => `Le verdict tombe quand ${who} aura couru.`,
  pvpShut:         { expired: 'Expiré', declined: 'Refusé', cancelled: 'Annulé' },
  pvpRefunded:     'Personne n’est venu : tes crédits sont rendus.',
  pvpNoVerdict:    'Pas de verdict pour ce duel.',
  pvpNoVerdictRefunded: 'Pas de verdict pour ce duel : tes crédits sont rendus.',
  pvpDecline:      'Refuser le défi',
  pvpCancel:       'Annuler le défi',
  pvpNotMet:       'pas vue',
  pvpRightShort:   'juste',
  pvpWrongShort:   'faux',
  pvpBetweenYou:   'entre vous',
  pvpCardStranger: 'Avant d’être amis, on ne voit que le pseudo.',
  pvpReport:       'Signaler',
  pvpReasons:      { name: 'Pseudo inapproprié', cheat: 'Triche', spam: 'Demandes ou défis répétés', other: 'Autre chose' },
  pvpReportSend:   'Envoyer le signalement',
  pvpReported:     'Signalement envoyé. Une personne le lira.',
  pvpRemoved:      'Vous n’êtes plus amis.',
  pvpBlocked:      'Bloqué : vous ne vous trouverez plus.',
  pvpRemoveFriend: 'Retirer des amis',
  pvpBlock:        'Bloquer',
  pvpFind:         'Chercher',
  pvpRelation:     { me: 'C’est toi', friend: 'Ami', sent: 'Demandé', received: 'T’a demandé', none: '' },
  pvpChallengeShort: 'Défier',
  pvpSentN:        n => (n === 1 ? '1 demande envoyée' : `${n} demandes envoyées`),
  pvpWithdraw:     'Retirer',
  pvpBlockedN:     n => (n === 1 ? '1 bloqué' : `${n} bloqués`),
  pvpUnblock:      'Débloquer',
  pvpNoFriends:    'Pas encore d’ami : cherche un pseudo exact.',
  // The server's refusals, by their code (domain/duel.js, errorKey).
  pvpErrNotFound:     'Personne ne porte ce pseudo.',
  pvpErrSelf:         'C’est ton propre pseudo.',
  pvpErrNotFriends:   'Vous n’êtes pas amis.',
  pvpErrCooldown:     'Tu pourras redemander plus tard.',
  pvpErrFriendLimit:  'Le carnet est plein : 200 amis au plus.',
  pvpErrPendingLimit: 'Trop de demandes attendent déjà une réponse.',
  pvpErrRequestLimit: 'Assez de demandes pour aujourd’hui.',
  pvpErrSearchLimit:  'Trop de recherches d’affilée. Réessaie dans quelques minutes.',
  pvpErrNoRequest:    'Cette demande n’attend plus.',
  pvpErrNotBlocked:   'Ce pseudo n’est pas bloqué.',
  pvpErrTooMany:      'Trop de duels en cours. Termine-en un d’abord.',
  pvpErrClosed:       'Ce duel est fermé.',
  pvpErrDuelGone:     'Ce duel n’existe plus.',
  pvpErrRunning:      'Ton ami court ce duel en ce moment : tu pourras refuser une fois son sprint fini.',
  pvpErrPlayed:       'Tu as déjà couru ce duel.',
  pvpErrWaiting:      'Ton ami n’est pas encore entré.',
  pvpErrNotStarted:   'Le sprint n’a pas commencé.',
  pvpErrTooEarly:     'Un instant : la question arrive.',
  pvpErrNotSettled:   'Les corrections s’ouvrent quand le duel est tranché.',
  pvpErrUnpaid:       'Les corrections coûtent 1 crédit.',
  pvpErrCredits:      'Plus assez de crédits.',
  pvpErrFailed:       'Ça n’a pas marché. Réessaie.',
}

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
  ...conversationMode,
  ...profile,
  ...settings,
  ...decks,
  ...exam,
  ...onboarding,
  ...boarding,
  ...ride,
  ...nyumon,
  ...guide,
  ...clrPrimitives,
  ...clrDay,
  ...clrFinish,
  ...clrRestday,
  ...clrTickets,
  ...reviewPlan,
  ...transfer,
  ...pvp,
})
