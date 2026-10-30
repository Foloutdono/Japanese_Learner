// ── App / Auth ────────────────────────────────────────────
const auth = {
  appTitle:          '辻',
  learnJapanese:     'Aprender japonés',
  appDesc:           'Repetición espaciada (SM-2) · Hiragana · Katakana · Vocabulario JLPT',
  login:             'Iniciar sesión',
  signup:            'Registrarse',
  email:             'Correo electrónico',
  password:          'Contraseña',
  loginBtn:          'Iniciar sesión',
  signupBtn:         'Registrarse',
  signupSuccess:     'Revisa tu correo para confirmar tu cuenta.',
  signOut:           'Cerrar sesión',
  usernameInvalid:   'El nombre de usuario debe tener de 3 a 20 caracteres (letras, números, guion bajo).',
  usernameTaken:     'Este nombre de usuario ya está en uso.',
  // 改札 — sign-in refusals, named by their code (lib/authErrors.js)
  // rather than by Supabase's English sentence (plan 215). The ones the
  // guest claim shares (address taken, weak password, too many tries)
  // say the claim* lines.
  authBadCredentials:    'Correo electrónico o contraseña incorrectos.',
  authEmailNotConfirmed: 'Primero confirma tu dirección: el enlace está en tu bandeja de entrada.',
  authEmailInvalid:      'Esa dirección de correo no es válida. Revísala o prueba con otra.',
  authCheckFields:       'Revisa tu dirección de correo y tu contraseña.',
  authSignupDisabled:    'Los registros están cerrados por ahora.',
  authLinkExpired:       'Este enlace ha caducado o ya se usó. Intenta iniciar sesión; si no funciona, vuelve a empezar para recibir uno nuevo.',
  // A sign-in link (plan 247): a card kept by a link has no password, and
  // a forgotten password finds its door here.
  authLinkSend:          'Envíame un enlace de acceso',
  authLinkSent:          (email) => `Enlace enviado a ${email}. Ábrelo en este dispositivo.`,
  authLinkNoAccount:     'No hay ningún pase guardado con esa dirección.',
  authLinkNeedsEmail:    'Escribe tu dirección y luego pide el enlace.',
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
  menu:              'Menú',
  back:              'Volver',
  skipToContent:     'Saltar al contenido',
  cancel:            'Cancelar',
  save:              'Guardar',
  delete:            'Eliminar',
  edit:              'Editar',
  close:             'Cerrar',
  loading:           'Cargando…',
  waitingServer:     'Despertando el servidor…',
  errorTitle:        'Algo salió mal',
  errorHint:         'Revisa tu conexión — tu progreso está a salvo.',
  // The two refusals a session has a line of its own for
  // (components/study/SessionError.jsx): a pass the server no longer
  // recognises, a deck that is no longer there. Everything else says
  // errorHint.
  sessionExpired:    'Tu sesión ha caducado. Vuelve a iniciar sesión para continuar — tu progreso está a salvo.',
  deckGone:          'Este mazo ya no está en tu estante.',
  // ── The chrome (plan 068): the five gates and the HUD ──
  tabLearn:          'Aprender',
  tabPractice:       'Práctica',
  tabToday:          'Hoy',
  tabDictionary:     'Diccionario',
  tabProfile:        'Perfil',
  tabBarLabel:       'Secciones',
  // The desk rail's second list (plan 269): the analyser, the library,
  // the statistics and the settings, as places beside the gates.
  deskPlacesLabel:   'Lugares',
  hudStatusLabel:    'Estado del objetivo',
  hudOffline:        'Sin conexión',
  hudDays:           (n) => `${n}d`,
  // The station panel's word. Late twice on purpose: the days beside
  // it and the ink tell running behind from delayed.
  hudStatus: {
    ahead:          'Con adelanto',
    onTime:         'A tiempo',
    slightlyBehind: 'Con retraso',
    delayed:        'Con retraso',
    suspended:      'Suspendido',
  },
  // ── 回数券 — the credits (plan 069) ──
  creditsUnit:       'créditos',
  balanceLabel:      'Saldo',
  balanceTitle:      'Saldo',
  balanceOf:         (cap) => `de ${cap}`,
  balanceRefillEvery: (min) => `cada ${min} min`,
  balanceNext:       (at) => `próximo a las ${at}`,
  balanceHolds:      (cap) => `acumula hasta ${cap}`,
  balanceKanaFree:   'Los repasos de kana no cuestan nada',
  balanceStepsFree:  'Una tarjeta que aún estás aprendiendo se repite gratis: pagas al verla por primera vez y luego cada repaso, una vez aprendida',
  gateShort:         (rides, due) => `Solo ${rides} de las ${due} ${rides === 1 ? 'puede' : 'pueden'} embarcar`,
  gateNoCredits:     (at) => (at ? `Sin créditos — +1 a las ${at}` : 'Sin créditos'),
  runOutTitle:       'Sin créditos',
  runOutCleared:     (n) => `${n} repasada${n === 1 ? '' : 's'}`,
  runOutWaiting:     (n) => `${n} ${n === 1 ? 'espera' : 'esperan'} la recarga`,
  runOutWaits:       'en espera',
  // 補充 — what the refill landed while the app was closed, told as the
  // card is charged with it (plans 141, 278), to a screen reader
  refillLanded:      (n, to, cap) => `${n} crédito${n === 1 ? '' : 's'} ${n === 1 ? 'llegó' : 'llegaron'} mientras no estabas · ${to} de ${cap}`,
  // 無料 — a lane that costs nothing (domain/credits.js).
  freeFare:          'gratis',
  laneNew:           n => `${n} nueva${n === 1 ? '' : 's'}`,
  // 区間 — the desk gate's run length and fare foot (plan 135)
  gateTake:          'Longitud del trayecto',
  gateTakeAll:       n => `Todas · ${n}`,
  gateTakeOf:        n => `de ${n}`,
  gateModes:         'Tarjetas a embarcar',
  gateModesAll:      n => `Todos los modos · ${n}`,
  gateModesMain:     n => `Tarjetas principales · ${n}`,
  gateWhich:         'Qué tarjetas',
  gateHowMany:       'Cuántas',
  gateServices:      'Elegir los servicios',
  gateServicesOf:    (on, all) => `${on} de ${all}`,
  gateServicesTitle: 'Servicios de hoy',
  gateMinutes:       'min',
  gateMinutesLabel:  n => `alrededor de ${n} minuto${n === 1 ? '' : 's'}`,
  gateRides:         'embarcan',
  gateWaits:         (at) => (at ? `esperan · +1 a las ${at}` : 'esperan'),
  gateBalance:       'créditos',
  laneWaits:         at => `espera hasta ${at}`,
  weekAhead:         'Los próximos siete días',
  weekLeft:          'Quedan para mañana',
  gateRidesFree:     'embarcan · gratis',
  // 一目 — Today at a glance (plan 199)
  gateModesMainName: 'Tarjetas principales',
  gateModesAllName:  'Todos los modos',
  gateTakeWord:      'Todas',
  gateTakeAllWord:   'todas',
  gateEndsAt:        at => `fin hacia las ${at}`,
  gateAdjust:        'Ajustar',
  // 浮世絵 (plan 205): the print's title slip, said whole -- the day and
  // the view of the print the hour and the season show (plan 261), as
  // the print's series would name it.
  printTitle:        (day, view) => `${day} — ${view}`,
  printViews: {
    'spring-dawn': 'el alba de primavera', 'spring-day': 'los cerezos en la bruma',
    'spring-dusk': 'los gansos que regresan', 'spring-night': 'la luna velada',
    'summer-dawn': 'el viento del sur', 'summer-day': 'las torres de nubes',
    'summer-dusk': 'la calma de la tarde', 'summer-night': 'las luciérnagas', 'summer-hanabi': 'los fuegos artificiales',
    'autumn-dawn': 'el alba', 'autumn-day': 'las velas que regresan',
    'autumn-dusk': 'los gansos que se posan', 'autumn-night': 'la luna de otoño',
    'winter-dawn': 'el alba fría', 'winter-day': 'el cielo despejado tras la nieve',
    'winter-dusk': 'la nieve del anochecer', 'winter-night': 'la luna de invierno',
  },
  gateServicesN:     n => (n === 1 ? '1 servicio' : `${n} servicios`),
  gateLineModes:     name => `Modos: ${name}`,
  gateLineNone:      'Sin servicio hoy',
  // 主 (plan 273): the modes of a line, added to Today or taken off.
  gateLineAdd:       'También en Hoy',
  gateModeAdd:       mode => `Añadir «${mode}» a Hoy`,
  gateModeRemove:    mode => `Quitar «${mode}» de Hoy`,
  gateOpensAt:       at => `Abre a las ${at}`,
  gateOpensIn:       when => `Abre ${when}`,
  todayDayLabel:     'Tu día',
  todayStreakDays:   n => (n === 1 ? 'día seguido' : 'días seguidos'),
  todayStreakShort:  'seguidos',
  todayNewToday:     'nuevas hoy',
  todayNewShort:     'nuevas',
  todayLesson:       'unidad',
  todayReviewed:     n => (n === 1 ? '1 tarjeta hoy' : `${n} tarjetas hoy`),
  // The same, its figure set apart on the print (plan 206).
  todayReviewedUnit: n => (n === 1 ? 'tarjeta hoy' : 'tarjetas hoy'),
  todayCardsUnit:    n => (n === 1 ? 'tarjeta' : 'tarjetas'),
  todayWeekStamps:   n => `${n} día${n === 1 ? '' : 's'} seguido${n === 1 ? '' : 's'}, los últimos siete sellados`,
  // 基礎 — the basics course on the gate and in Settings › Level (plan 186f)
  basicsUnit:        (n, of) => `Unidad ${n} de ${of}`,
  basicsMet:         (n, of) => `${n} de ${of} unidades vistas`,
  basicsDone:        'Bases completadas — el resto del N5 está abierto.',
  basicsSkip:        'Saltar las bases',
  basicsSkipLabel:   'Bases',
  basicsSkipAct:     'Ya las conozco',
  basicsSkipped:     n => (n === 1 ? `${n} tarjeta básica marcada como conocida.` : `${n} tarjetas básicas marcadas como conocidas.`),
  // 基礎 — the course's station on the Learn gate (plan 186g)
  basicsTitle:       'Bases',
  basicsDesc:        'El N5 desde su primera lección\nUna unidad a la vez\nSus reglas, sus palabras, sus kanji',
  basicsUnits:       'Unidades',
  basicsPoints:      'Gramática',
  basicsWords:       'Palabras',
  basicsKanji:       'Kanji',
  basicsSentences:   'Frases',
  basicsMetOf:       (met, total) => `${met} de ${total} vistas`,
  // ── 定期券 — the offer's doors and its thanks (domain/paywall.js) ──
  paywallName_pro:    'Tsuji Pro',
  paywallThanks:      'Anotado — te avisaremos cuando abra.',
  paywallOpen:        'Ver Pro',
  paywallRowValue:    'Pronto',
  // ── 定期券 — the three offers (plan 172, components/offers/) ──
  ofrLabel:           'Planes de Tsuji',
  ofrCardBrand:       'Pase',
  ofrCardPro:         'Pro',
  ofrCardMax:         'Max',
  ofrCardFarePro:     'Práctica · 1 crédito',
  ofrCardFareMax:     'Práctica · sin créditos',
  // ── 定期券 — the card, face and back (plan 173) ──
  cardFree:           'Gratis',
  cardPaid:           'Pase',
  cardFareFree:       'Práctica · bloqueada',
  cardTurn:           'Dar la vuelta al pase',
  cardLevelTo:        (a, b) => `Nivel ${a} → ${b}`,
  cardJourney:        'Trayecto',
  cardIssued:         (when) => `Emitido en ${when}`,
  cardOnPage:         'En la página',
  cardPerExercise:    '1 por ejercicio',
  cardNoCredit:       'Práctica sin créditos',
  cardNoCreditShort:  'sin créditos',
  cardUnlimited:      'Ilimitado',
  cardDriftAhead:     (n) => `${n} d de adelanto`,
  cardDriftLate:      (n) => `${n} d de retraso`,
  cardLines:          (names) => `Líneas: ${names}`,
  ofrPlatforms: { reading: 'Lectura', comprehension: 'Comprensión', translation: 'Traducción', dictation: 'Dictado', composition: 'Redacción', exam: 'Examen de prueba' },
  ofrPerMonth:        '/ mes',
  // The 7-day trial (DISCOVER)
  ofrDiscEyebrow: { trip: 'Para tu viaje a Japón', studies: 'Para tus estudios', fun: 'Por diversión', live: 'Para vivir en Japón', friends: 'Para tus amigos japoneses', other: 'Tsuji Pro' },
  ofrDiscLede: {
    trip: 'Lee los carteles y los menús, entiende lo que te dicen, escribe tus primeras frases.',
    studies: 'Prepárate para el JLPT: exámenes de prueba cronometrados, lectura, comprensión auditiva y redacción.',
    fun: 'Lee tus mangas, entiende tus animes, escribe tus propias frases.',
    live: 'Lee lo que encuentres, entiende lo que oyes, escribe tus mensajes del día a día.',
    friends: 'Escríbeles tus propias frases, entiende sus respuestas, traduce sin dudar.',
    other: 'Lectura, comprensión, traducción, dictado, redacción y exámenes de prueba: tus tarjetas se vuelven japonés.',
  },
  ofrDiscTitle:       (days) => `${days} días de práctica, de regalo.`,
  ofrTrialKind:       'Prueba gratuita · Pro anual',
  ofrTrialUnit:       (days) => `durante ${days} días`,
  ofrTrialBill:       (year, month) => `luego ${year} al año, ${month} al mes`,
  ofrTrialStub:       (days) => `${days} d`,
  ofrTrialStubCap:    'gratis',
  ofrDiscLater:       'Seguir gratis',
  ofrDiscCta:         (days) => `Probar ${days} días`,
  ofrDiscFine:        (days) => `Cancela antes del día ${days}: no pagas nada.`,
  ofrDemoQuestion:    '¿Dónde se toma el café?',
  ofrDemoHome:        'En casa',
  ofrDemoStation:     'En la estación',
  ofrDemoSentence:    'Tomo un café en la estación.',
  ofrDemoPrompt:      'Una frase con で, el lugar:',
  ofrDemoTutor:       'El tutor: frase natural y correcta.',
  // The week the credits stopped (WEEK)
  ofrWeekCap:         'Tus últimos 7 días',
  ofrWeekDone:        'repasadas',
  ofrWeekWaiting:     'en espera',
  ofrWeekCeiling:     (n) => `límite: ${n} créditos / día`,
  ofrWeekGain:        (n) => `+${n} tarjeta${n === 1 ? '' : 's'} repasada${n === 1 ? '' : 's'} con Pro`,
  ofrWeekChart:       (stops, waited) => `Tus últimos 7 días: ${stops} día${stops === 1 ? '' : 's'} con tarjetas en espera, ${waited} tarjeta${waited === 1 ? '' : 's'} en total.`,
  ofrWeekEyebrow:     'Tu semana',
  ofrWeekTitle:       (n) => (n === 1 ? 'Tus créditos te frenaron una vez esta semana.' : `Tus créditos te frenaron ${n} veces esta semana.`),
  ofrWeekLede:        (n) => `${n === 1 ? '1 tarjeta esperó' : `${n} tarjetas esperaron`} al día siguiente. Con Pro, repasas todo lo pendiente el mismo día.`,
  ofrProYearKind:     'Pro · anual',
  ofrBilledYearly:    (price) => `${price} facturados una vez al año`,
  ofrSave:            (pct) => `−${pct}`,
  ofrSaveCap:         'vs. mensual',
  ofrWeekLater:       (time) => (time ? `Esperar · +1 crédito a las ${time}` : 'Esperar la recarga'),
  ofrWeekCta:         'Repasar sin límites',
  ofrWeekFine:        (monthly) => `Cancela cuando quieras · o ${monthly} al mes`,
  // The step up to Max (MAX)
  ofrMaxKind:         'Max · anual',
  ofrMaxBill:         'La diferencia con tu Pro, prorrateada',
  ofrMaxCta:          'Pasar a Max',
  ofrMaxFine:         'Efecto inmediato · Cancela cuando quieras',
  ofrStayPro:         (when) => `Seguir en Pro · ${when}`,
  ofrNextCredit:      (time) => `+1 crédito a las ${time}`,
  ofrTomorrow:        'de nuevo mañana',
  ofrNextMonth:       (n, date) => `${n} más el ${date}`,
  ofrInstead:         (n) => `en lugar de ${n}`,
  ofrFareEyebrow:     'Sin créditos por hoy',
  ofrFareTitle:       'Con Max, la práctica no cuesta créditos.',
  ofrFareWithPro:     'Con Pro',
  ofrFareWithMax:     'Con Max',
  ofrFareCredits:     'Créditos:',
  ofrFareIncluded:    'Práctica incluida',
  ofrFareOne:         '1 crédito',
  ofrFareFree:        'Incluido',
  ofrFareOut:         'Sin créditos',
  ofrFareStubCap:     'créditos por ejercicio',
  ofrValPhotos:       'fotos al día',
  ofrValExplains:     'explicaciones al día',
  ofrValPapers:       'exámenes nuevos al mes',
  ofrPhotosCount:     'Fotos hoy',
  ofrPhotosEyebrow:   (n) => `${n} de ${n} fotos hoy`,
  ofrPhotosTitle:     'Lee todo lo que encuentres.',
  ofrPhotosLede:      (max, pro) => `Con Max, ${max} fotos al día en lugar de ${pro}, y la práctica no cuesta créditos.`,
  ofrPhotosShut:      'Límite de hoy alcanzado',
  ofrPhotosGloss:     'salsa de soja',
  ofrPhotosStubCap:   'fotos / día',
  ofrExplCount:       'Explicaciones hoy',
  ofrExplEyebrow:     (n) => `${n} de ${n} explicaciones hoy`,
  ofrExplTitle:       'Entiende cada frase.',
  ofrExplLede:        (max, pro) => `Con Max, ${max} explicaciones al día en lugar de ${pro}, y la práctica no cuesta créditos.`,
  ofrExplWait:        'Explicando',
  ofrExplTranslation: '«Tomo un café en la estación».',
  ofrExplNotes:       ['«en la estación»: dónde ocurre', '«un café»: lo que se toma', 'la forma cortés de «beber»'],
  ofrExplStubCap:     'explicaciones / día',
  ofrExamCount:       'Exámenes nuevos este mes',
  ofrExamEyebrow:     (n) => `${n} de ${n} exámenes nuevos este mes`,
  ofrExamTitle:       'Un examen de prueba nuevo cuando quieras.',
  ofrExamLede:        (max, pro) => `Con Max, ${max} exámenes nuevos al mes en lugar de ${pro}, y todos los exámenes sin créditos.`,
  ofrExamPaper:       (level, n) => `${level} · examen ${n}`,
  ofrExamNext:        'Próximo examen nuevo',
  ofrExamOn:          (date) => `el ${date}`,
  ofrExamNew:         'Nuevo',
  ofrExamSections:    ['Vocabulario', 'Gramática', 'Lectura', 'Comprensión auditiva'],
  ofrExamStubCap:     'exámenes / mes',
  ofrUpEyebrow:       'Tu plan: Pro anual',
  ofrUpTitle:         'Pasa de Pro a Max.',
  ofrUpChanges:       'Qué cambia',
  ofrUpPractice:      'Práctica y exámenes de prueba',
  ofrUpPhotos:        'Fotos analizadas al día',
  ofrUpExplains:      'Explicaciones al día',
  ofrUpPapers:        'Exámenes nuevos al mes',
  ofrUpDecks:         'Mazos · tarjetas',
  ofrUpCredit:        '1 crédito',
  ofrUpNoCredit:      'Sin créditos',
  ofrUpKeep:          'Mantener Pro',
  import:            'Importar',
  export:            'Exportar',
  exportFailed:      'Error al exportar',
  select:            'Seleccionar',
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
  platforms:   'Andenes',
  // The wall map's two group captions: the sentence-practice lines,
  // and the halls you use rather than ride.
  mapPractice:   'Práctica',
  mapFacilities: 'Servicios',
  // The fare gate's filled action, and its phone-only disclosure.
  depart:      'Embarcar',
  breakdown:   'Desglose',
  // Hover text on a 種別 badge. Deliberately not "Local"/"Rapid" —
  // that is the railway word for the pips, and repeating it explains
  // nothing to somebody choosing a study mode. Each one says what the
  // rung actually asks of you.
  serviceLabel: {
    local:   'Todas las paradas — la respuesta está en pantalla',
    rapid:   'Un apoyo menos',
    express: 'De memoria, autoevaluado',
    ltd:     'Escrito a mano, sin ayuda',
    review:  'Recorrido libre, sin nota, a tu ritmo',
  },
  tip:               'Sesiones cortas y regulares (15–20 min) — el planificador hace el resto.',
  homeFeedDown:      'No se pudieron cargar los datos de hoy — toca para reintentar.',
  start:             'Empezar',
  homeTitle:         'Inicio',
  homeDesc:          'Volver al menú principal',
  kanaTitle:         'Kana',
  kanaDesc:          'Hiragana y katakana, sonido por sonido\nPrimero reconocer, luego escribir a mano\nLa base sobre la que se apoya todo lo demás',
  vocabTitle:        'Vocabulario JLPT',
  kanjiTitle:        'Kanji',
  dictionaryTitle:   'Diccionario',
  dictionaryDesc:    'Un kanji, un kana o cualquier palabra\nLecturas, radicales, orden de trazos, ejemplos\nY si ya lo has visto antes',
  grammarTitle:      'Gramática',
  grammarDesc:       'Todos los puntos del JLPT, de N5 a N1\nA qué se une y qué hace\nCon frases que lo usan bien',
  statsTitle:        'Estadísticas',
  statsDesc:         'Si se mantiene, semana a semana\nCuánto margen tiene cada tarjeta\nY por dónde se escapa',
  decksTitle:        'Mis mazos',
  decksDesc:         'Tus propias tarjetas, programadas como el resto\nEscríbelas aquí o importa una hoja de cálculo\nMezcladas con el contenido integrado',
}

// ── Quiz shared ───────────────────────────────────────────
const quiz = {
  // Kana sets
  hiraganaBase:         'Hiragana (básico)',
  hiraganaCombinations: 'Hiragana (combinaciones)',
  katakanaBase:         'Katakana (básico)',
  katakanaCombinations: 'Katakana (combinaciones)',

  // Selection prompts
  selectLevel:       'Elige tu nivel JLPT',
  selectMode:        'Elige cómo estudiar',
  selectKanaSet:     'Elige un conjunto de kana',
  selectPhase:       'Elige tu fase de entrenamiento',

  byLevel:           'JLPT',
  byLevelDesc:       'Los cinco grados del propio examen, de N5 a N1',
  byFrequency:       'Frecuencia de palabras',
  byFrequencyDesc:   'Ordenadas por su frecuencia real en textos escritos',
  // The same axis one line over, where what is ranked is the
  // characters rather than the words (see KanjiScreen.jsx).
  byFrequencyKanji:     'Frecuencia de kanji',
  byFrequencyKanjiDesc: 'Ordenados por su frecuencia en textos escritos',
  // Kanji's third study source (plan 086): the 214 Kangxi radicals as
  // a way in — a lesson on the radical, then its family of kanji. See
  // KanjiScreen.jsx / RadicalLesson.jsx.
  byRadical:            'Radicales',
  byRadicalDesc:        'Las piezas básicas — un radical y luego cada kanji construido sobre él',
  byMastery:         'Mis tarjetas',
  byMasteryDesc:     'Solo con palabras que ya has visto',
  // Vocabulary's third study-source option — every JMdict word outside
  // the JLPT curriculum, ranked by frequency (see VocabScreen.jsx).
  byJmdict:          'Más allá del JLPT',
  byJmdictDesc:      'Todo lo que va más allá del temario, lo más común primero',
  selectStudySource: 'Elige tu fuente de estudio',
  selectTier:        'Elige un tramo de frecuencia',
  kanjiUnit:         'kanji',
  loadError:         'No se pudieron cargar los tramos. Inténtalo de nuevo.',
  // Label for the Top 100/200/500/1000 size toggle above a tier list
  // (see TierSelector.jsx) — aria-label only, not visible text.
  tierSizeLabel:     'Tamaño del tramo',

  // Vocabulary's third study-source option, alongside byLevel/
  // byFrequency — thematic decks (Fruits, Jobs, Body parts, ...), see
  // ThemeSelector.jsx / theme_data.py.
  byTheme:           'Por tema',
  byThemeDesc:       'Agrupadas por tema — comida, trabajo, viajes, el cuerpo',
  selectTheme:       'Elige un tema',
  // Placeholder/aria-label for ThemeSelector's filter box (only shown
  // once there are more than a handful of themes to scroll through).
  filterThemes:      'Filtrar temas…',
  // Shown when a theme filter query matches nothing — distinct from
  // dictionary's `noResults` above, which is followed by the query
  // term ("No results for {query}") rather than standing alone.
  themeNoResults:    'Ningún tema coincide con tu filtro',

  // The four levels inside a theme, placed by difficulty (see
  // backend/content/theme_data.py). The Japanese half of each name lives
  // in domain/themes.js — it is the same in every language.
  themeLevelBasic:    'Básico',
  themeLevelMedium:   'Medio',
  themeLevelAdvanced: 'Avanzado',
  themeLevelExpert:   'Experto',
  selectThemeLevel:   'Elige un nivel',
  leaveThemeLevels:   'Niveles',

  // Theme display labels — key is `theme_data.list_themes()`'s `key`
  // camelCased and prefixed with `theme` (see ThemeSelector.jsx's
  // _translationKey), so a theme added to build_theme_db.py only
  // needs its matching line added here (and in every other language
  // file) to get a real label instead of ThemeSelector's raw-key
  // fallback.
  themeFruits:           'Frutas',
  themeVegetables:       'Verduras',
  themeBodyParts:        'Partes del cuerpo',
  themeRooms:            'Habitaciones',
  themeBuildings:        'Edificios',
  themeFurniture:        'Muebles',
  themeSchool:           'Escuela',
  themeTravel:           'Viajes',
  themeJobs:             'Profesiones',
  themeDishes:           'Platos',
  themeAnimals:          'Animales',
  themeColors:           'Colores',
  themeClothing:         'Ropa',
  themeWeather:          'Clima',
  themeFamily:           'Familia',
  themeEmotions:         'Emociones',
  themeNature:           'Naturaleza',
  themeVehicles:         'Vehículos',
  themeTechnology:       'Tecnología',
  themeSports:           'Deportes',
  themeMusic:            'Música',
  themeKitchenItems:     'Utensilios de cocina',
  themeOfficeSupplies:   'Material de oficina',
  themeShoppingMoney:    'Compras y dinero',
  themeGeography:        'Geografía',
  themeInsectsBugs:      'Insectos',
  themeBirds:            'Aves',
  themeSeafood:          'Mariscos',
  themeDrinks:           'Bebidas',
  themeShapes:           'Formas',
  themeMaterials:        'Materiales',
  themeTools:            'Herramientas',
  themeMedical:          'Medicina',
  themePlantsTrees:      'Plantas y árboles',
  themeHouseholdItems:   'Objetos del hogar',
  themeHolidaysEvents:   'Fiestas y eventos',

  levelHintN5:       'Nivel principiante',
  levelHintN4:       'Nivel elemental',
  levelHintN3:       'Nivel intermedio',
  levelHintN2:       'Nivel avanzado',
  levelHintN1:       'Nivel de dominio',

  // Input
  submit:            'Enviar',
  typeRomaji:        'Escribe el romaji…',
  tapToFlip:          'Toca para dar la vuelta',
  tapToReveal:         'Toca para revelar',
  // A Kanji → meaning card's front says what it asks (plan 276).
  askKanjiMeaning:     '¿Qué significa?',
  // The desk's hint (plan 113): a key cap, then the words after it.
  keySpace:            'Espacio',
  revealByKey:         'para revelar',
  // The run's panel, beside a card on the desk (plan 114).
  deskRunLabel:        'Este trayecto',
  deskEarned:          'Obtenido',
  deskEntryWait:       'La entrada del diccionario se abre aquí cuando se revela la tarjeta.',
  deskMissesTitle:     'Para volver a ver',
  deskBreakdownLabel:  'Desglose',
  deskPassageLabel:    'El texto',
  // The run on three panels (plan 126): the session panel, the card panel
  // (what each verdict decides, the rhythm, the keys), and the details
  // sealed before the reveal.
  deskRemaining:       'Restantes',
  deskCardPanel:       'Esta tarjeta',
  forecastIn:          span => `en ${span}`,
  forecastTomorrow:    'mañana',
  forecastMinutes:     n => `${n} min`,
  forecastHours:       n => `${n} h`,
  forecastDays:        n => `${n} d`,
  forecastWeeks:       n => `${n} sem.`,
  forecastMonths:      n => `${n} mes${n === 1 ? '' : 'es'}`,
  forecastYears:       n => `${n} año${n === 1 ? '' : 's'}`,
  // The wait as a figure, on the tile: the unit beside the number.
  forecastUnit:        (unit, n) => ({ minute: 'min', hour: 'h', day: n > 1 ? 'días' : 'día', week: 'sem.', month: n > 1 ? 'meses' : 'mes', year: n > 1 ? 'años' : 'año' })[unit],
  deskKeysTitle:       'Las teclas',
  deskKeysHelp:        'Ayuda',
  deskKeyTurn:         'da la vuelta a la tarjeta',
  deskKeyChoices:      'muestra las opciones',
  deskKeyLeave:        'sale del trayecto',
  deskKeyAddReading:   'añade una lectura',
  deskKeyCheck:        'comprueba',
  deskRhythm:          'El ritmo',
  deskElapsed:         'Transcurrido',
  deskPerMinute:       'Tarjetas / min',
  deskToFinish:        'Para terminar',
  deskSealed:          'La entrada se abre al revelar.',
  keyEnter:            'Enter',
  keyEscape:           'Esc',
  // A percentage (the HUD's status, an exam's score, the report): French
  // sets a no-break space before the sign, English none.
  percent:             n => `${n}\u00a0%`,
  deskWayUp:           'Volver arriba',
  deskBreakdownWait:   'El desglose de la frase aparece aquí cuando hayas calificado tu respuesta.',
  // An exercise on three panels (plan 129): the run's sentences, each with
  // the grade it got, and an exercise's keys.
  deskLinesLabel:      'Las frases del trayecto',
  deskLinesNow:        'ahora',
  deskLinesRated:      'Frases',
  deskQuestionsRated:  'Preguntas',
  deskPerMinuteLines:  'Frases / min',
  deskAnswered:        'Respondidas',
  deskKeyCheckNext:    'comprueba y sigue',
  deskKeyRate:         'califica tu respuesta',
  deskKeyListen:       'reproduce la frase',
  deskKeyReveal:       'muestra la frase',
  deskKeyPick:         'elige una respuesta',
  deskKeyNext:         'siguiente pregunta',
  deskKeyWalk:         'recorre las preguntas',
  // 問 — a question about the exercise, on the desk (plan 131) and, on a
  // phone, on a page of its own (plan 197): open once the answer is graded,
  // short, precise, about this exercise only.
  askTitle:            'Una pregunta',
  askOpen:             'Hacer una pregunta',
  askPlaceholder:      'Tu pregunta…',
  askSealed:           'Las preguntas se abren al calificar tu respuesta.',
  askSealedText:       'Las preguntas se abren con los resultados.',
  askSealedTour:       'Las preguntas se abren al responder esta etapa.',
  askHint:             'Una respuesta breve y precisa, sobre este ejercicio.',
  askSend:             'Preguntar',
  askThinking:         'Respondiendo',
  askOffTopic:         'Solo respondo preguntas sobre este ejercicio.',
  askUnavailable:      'Las respuestas no están disponibles ahora mismo.',
  askFailed:           'La respuesta no llegó. Inténtalo de nuevo.',
  askSpent:            at => (at ? `No quedan preguntas por hoy: vuelven a las ${at}.` : 'No quedan preguntas por hoy.'),
  askLeft:             n => `${n === 1 ? 'Queda' : 'Quedan'} ${n} pregunta${n === 1 ? '' : 's'} hoy`,
  askFull:             'Eso es todo para esta frase.',
  askSuggestLabel:     'Preguntas sugeridas',
  askSugContrast:      (a, b) => `¿Por qué ${a} y no ${b}?`,
  askSugMarks:         p => `¿Qué marca ${p} aquí?`,
  askSugPoint:         p => `¿Cómo se usa ${p}?`,
  askSugExample:       w => `¿Otro ejemplo con ${w}?`,
  askSugPolite:        '¿Cómo lo diría de forma más cortés?',
  askSugCasual:        '¿Y de manera informal, entre amigos?',
  askSugWhyRight:      '¿Por qué es esta la respuesta correcta?',
  askSugWhere:         '¿Dónde lo dice el texto?',

  // Feedback — the ❌/✅/← glyphs these used to carry inline are now
  // real <Icon/>s rendered by whatever shows the text (see
  // QuizComponents.jsx's TypeInput/DoneMessage), not baked into the
  // string.
  wrong:             'Respuesta:',
  quizComplete:      '¡Todas las tarjetas están al día!',
  backToMenu:        'Volver al menú',

  // Rating bar. The plain-language captions; the Japanese quality terms
  // that pair with them (plan 045's rebuilt bar) are `ratingJp` below —
  // the term itself, identical in every language. Plan 045's
  // mockup restates wrongSeen as ALMOST (clearer against 惜しい than the
  // original "Wrong (seen)"). Easy (5), Missed (1) and Forgot (0) replaced
  // Perfect, Wrong and Blackout when the four-button bar became
  // Missed / Difficult / Correct / Easy.
  to:                'a',
  easy:              'Fácil',
  correctHesit:      'Correcto',
  difficult:         'Difícil',
  wrongSeen:         'Casi',
  wrongRated:        'Fallado',
  forgot:            'Olvidado',
  ratingJp: {
    easy:            '簡単',
    correctHesit:    '正解',
    difficult:       '難しい',
    wrongSeen:       '惜しい',
    wrongRated:      '不正解',
    forgot:          '忘れた',
  },

  // Mode labels
  modeQCM:           'Opción múltiple',
  modeFlashcard:     'Tarjeta',
  modeFill:          'Completar',
  // Extended mode labels used by vocab/kanji screens
  modeWrite:         'Escritura',
  // Stats format axis: typed on a keyboard, as against drawn by hand.
  modeType:          'Tecleo',
  radicalNumber:       'Radical',
  // grammar b2f: the meaning is shown, recall the rule.
  revealGrammarRule:   '¿Qué regla es esta?',
  revealGrammarBtn:    'Mostrar la regla',
  standardType:        'Estándar',
  standardDesc:        'Un anverso y un reverso, escritos por ti.',
  // ── Personal card fields (generated form, see study/structures.py) ──
  field_front:      'Anverso',
  field_back:       'Reverso',
  field_kanji:      'Kanji',
  field_meaning:    'Significado',
  field_readings:   'Lecturas',
  field_radical:    'Radical',
  field_word:       'Palabra',
  field_reading:    'Lectura',
  field_kana:       'Kana',
  field_romaji:     'Rōmaji',
  field_rule:       'Regla gramatical',
  field_sentences:  'Frase de ejemplo',
  field_sentences_group: 'Frases de ejemplo',
  field_sentences_jp: 'Frase en japonés',
  field_sentences_tr: 'Traducción',
  field_rule_reading: 'Lectura de la regla',
  field_structure:  'Formación',
  field_register:   'Registro',
  field_explanation: 'Explicación',
  field_usage:      'Usos',
  field_careful:    'Cuidado',
  field_compare:    'Regla parecida',
  field_compare_group: 'Reglas parecidas',
  field_compare_pattern: 'Regla parecida',
  field_compare_text: 'Qué las diferencia',
  field_notes:      'Notas',
  fieldHint_rule_reading: 'Su lectura, en kana — p. ej. 〜のなかで (opcional)',
  fieldOff_rule_reading: 'Esto no corresponde a la regla: escribe cada kanji en kana y el resto tal cual.',
  fieldHint_structure:   'Formación — p. ej. verbo en forma て + ください',
  fieldHint_explanation: 'Qué hace la regla. **negrita** para resaltar.',
  fieldHint_usage:       'Un uso por línea, empezando por «-\u00a0»',
  fieldHint_careful:     'Con qué se confunde, qué evitar',
  pickRadical:      'Elige un radical',
  // ── 読み入力 (kanji.readings) ──
  readingsOn:          'On (lectura sino-japonesa)',
  readingsKun:         'Kun (lectura japonesa)',
  // The two fields' labels on a car's face (plan 251, LinePlatforms).
  readingsOnTag:       'On',
  readingsKunTag:      'Kun',
  readingsAdd:         'añadir una lectura',
  readingsRemove:      (r) => `Quitar ${r}`,
  readingsFound:       'encontrada',
  readingsWrong:       'incorrecta',
  readingsMissed:      'omitida',
  readingsPlaceholder: 'kana o romaji',
  readingsCap:         'Esta tarjeta admite 15 lecturas como máximo.',
  modeWriteDesc:     'Solo el significado. Dibuja el carácter trazo a trazo.',
  // Parameterised on what the studied item is called ("kanji" or
  // "word" — see kanjiNoun/wordNoun below and vocabKanjiModes in
  // quizModes.js). These were fixed strings saying "kanji" no matter
  // which screen showed them, so the vocabulary mode picker announced
  // "MCQ (kanji → meaning)" for a deck of words.
  modeQcmKjM:        (noun) => `Opción múltiple (${noun} → significado)`,
  modeQcmKjMDesc:    (noun) => `Se muestra ${String(noun).endsWith('a') ? 'la' : 'el'} ${noun}. Elige su significado entre cuatro.`,
  modeQcmMKj:        (noun) => `Opción múltiple (significado → ${noun})`,
  modeQcmMKjDesc:    (noun) => `Se muestra el significado. Elige ${String(noun).endsWith('a') ? 'la' : 'el'} ${noun} entre cuatro.`,
  modeFcKjM:         (noun) => `Tarjeta (${noun} → significado)`,
  modeFcKjMDesc:     (noun) => `Solo ${String(noun).endsWith('a') ? 'la' : 'el'} ${noun}. Recuerda el significado y luego comprueba.`,
  modeFcMKj:         (noun) => `Tarjeta (significado → ${noun})`,
  modeFcMKjDesc:     (noun) => `Solo el significado. Recuerda ${String(noun).endsWith('a') ? 'la' : 'el'} ${noun} y luego comprueba.`,

  // ── Merged recall modes (deck study) ──
  // A deck offers one entry per direction instead of an MCQ one and a
  // flashcard one, because those were the same question asked with two
  // different amounts of help — and the help is now a switch on the
  // card itself. See StudyScreen's MERGED_MODES.
  modeRecallKjM:     'Palabra → significado',
  modeRecallMKj:     'Significado → palabra',
  modeRecallGrammar: 'Estructura → significado',
  modeRecallDesc:    'De memoria o con cuatro opciones — cambia cuando quieras.',
  assistOff:         'Mostrar opciones',
  assistOn:          'Ocultar opciones',
  assistUnavailable: 'Tu propia tarjeta — de memoria, y la calificas tú',

  modeFcKanaDesc:     'Solo el kana. Di el sonido y luego comprueba.',
  modeQcmKanaDesc:    'Se muestra el kana. Elige su sonido entre cuatro.',
  modeWriteKanaDesc:   'Se da el sonido. Dibuja el kana.',

  modeFcGrammarDesc:   'Solo la estructura. Recuerda qué hace y luego comprueba.',
  modeQcmGrammarDesc:  'Se muestra la estructura. Elige qué hace entre cuatro.',
  modeFillGrammarDesc: 'Una frase sin la estructura. Vuelve a ponerla.',

  // "Review your cards" — a self-paced, ungraded browse over cards
  // already studied in this deck (see ReviewDeck.jsx). Appended to
  // every mode picker alongside modeQCM/modeFlashcard/etc.
  modeReview:        'Repaso',
  modeReviewDesc:    'Recorre lo que ya sabes. Nada se califica ni se reprograma.',
  reviewEmpty:       'Aún no has estudiado ninguna de estas tarjetas — vuelve después de tu primera sesión.',
  reviewPrev:        'Anterior',
  reviewNext:        'Siguiente',

  // Writing practice
  writingPractice:   'Practica la escritura de este kanji',
  toggleWriting:     'Activar/desactivar la escritura',
  yourDrawing:       'Tu dibujo',
  strokeOrder:       'Orden de trazos',
  strokeZoom:        'Ampliar el orden de trazos',
  strokeWatch:       'Ver',
  strokeGuided:      'Guiado',
  strokeFree:        'Libre',
  strokeAgain:       'Volver a trazar',
  continueBtn:       'Entendido, continuar',
  eraseBtn:          'Borrar',

  // Misc
  strokes:           'trazos',
  notAvailable:      'No disponible',
  noMeaningRecorded: 'Sin significado registrado',
  vocabulary:        'Vocabulario',
  kanji:             'Kanji',

  // Grammar screen
  revealMeaning:     '¿Qué significa esta regla?',
  revealSentence:    'Completa la frase de abajo',
  revealMeaningBtn:  'Revelar el significado',
  showExamples:      'Ver ejemplos',
  hideExamples:      'Ocultar ejemplos',

  // XpToast
  levelUp:          '¡Nuevo nivel!',
  levelShort:       'Nv',
  // 上下 (plan 174): the run's meter under the head, for a screen reader.
  runMeter:          (n, total) => (total == null ? `${n} calificada${n === 1 ? '' : 's'}` : `${n} de ${total}`),

}

// ── Stats ─────────────────────────────────────────────────
const stats = {
  statistics:        'Estadísticas',
  // ── 本日の運行 — the daily queue (screens/TodayScreen) ──────
  todayTitle:         'Trayecto de hoy',
  todayDesc:          'Todos los repasos pendientes, de todas las secciones, en una sola cola.',
  todayBoard:         'Hoy',
  todayPickHint:      'Elige qué repasar',
  todayLines:         'Líneas de hoy',
  todayPickSomething: 'Elige al menos una',
  todayStart:         n => `Repasar ${n} ${n === 1 ? 'tarjeta' : 'tarjetas'}`,
  todayAllTypes:      'Todas',
  todaySearchPlaceholder: 'Buscar una línea…',
  todayLaneCount:     n => `${n} ${n === 1 ? 'servicio' : 'servicios'}`,
  todayNoMatch:       'Ninguna línea coincide.',
  todayNoMatchHint:   'Prueba otro nombre o borra los filtros.',
  todayClearFilters:  'Borrar filtros',
  todayDue:           n => `${n} ${n === 1 ? 'pendiente' : 'pendientes'}`,
  todayNothingDueShort: 'Al día',
  todayRemaining:     'Quedan en este trayecto',
  todayNothingDue:    'No hay nada pendiente por ahora.',
  todayNextReview:    when => `Próximo repaso ${when}.`,
  backToStation:      'Volver a la estación',
  fareGate:           'Torniquete',
  dueUnit:            'pendientes',
  newUnit:            'nuevas',
  learningUnit:       'en curso',
  learnedLabel:       'Aprendidas',   // a platform's figure, read out (plan 184)
  // The sources on the desk (plan 267): the gate at the end of JLPT's
  // line, and what is left to see of the level it resumes.
  sourcesResume:      'Reanudar',
  unseenNote:         n => `${n} sin ver`,
  tierWords:          range => `Palabras ${range}`,
  // The origin of every Learn line: where you stand before a level is
  // finished (domain/lineProgress.js's ORIGIN_STOP).
  originStop:         'Principiante',
  stageGate:          'Torniquete',
  nothingGraded:      'Nada está calificado',
  stationJlpt:        'JLPT',
  // The sub over vocabulary's and kanji's source page. Terse, like
  // every other sub on a station: it names the page you are on, and
  // the cards under it do the asking. (The practice sections put the
  // whole question up there instead -- selectStudySource -- because
  // their bar carries no other sub to be consistent with.)
  stationSources:     'Fuentes',
  // The same, over かな's set list: the sets are the line's stops, so
  // the sub names them and the bar's other end is the way out.
  stationSets:        'Series',
  byFrequencyShort:   'Por frecuencia',
  byThemeShort:       'Por tema',
  byRadicalShort:     'Por radical',
  leaveLevels:        'Niveles',
  leaveRadicals:      'Radicales',
  // ── The radical lesson (plan 086) ──
  radLesson:          'El radical',
  radFamily:          'Kanji formados con este radical',
  radForms:           'Formas',
  // Where the component usually sits in a character, by the seven
  // traditional positions (backend/content/radical_info.py).
  radPosition: {
    hen:     'a la izquierda',
    tsukuri: 'a la derecha',
    kanmuri: 'en la parte superior',
    ashi:    'en la parte inferior',
    kamae:   'alrededor',
    tare:    'en la parte superior y el lado izquierdo',
    nyou:    'en el lado izquierdo y la parte inferior',
  },
  radPositionJp: { hen: '偏', tsukuri: '旁', kanmuri: '冠', ashi: '脚', kamae: '構', tare: '垂', nyou: '繞' },
  radPositionNote:    where => `Como componente, suele situarse ${where} de un kanji`,
  radNoPositionNote:  'Como componente, no tiene un lugar fijo en un kanji.',
  radFamilyShort:     'Kanji formados con él',
  radNoKanji:         'El curso aún no enseña ningún kanji formado con él.',
  leaveSets:          'Series',
  leaveTiers:         'Tramos',
  leaveThemes:        'Temas',
  leaveDecks:         'Mazos',
  leaveDeck:          'Mazo',
  // ── Practice (plan 072) ──
  leaveSources:       'Fuentes',
  leaveExam:          'Examen',
  compBackToQuestions: 'Volver a las preguntas',
  practiceResult:     'Resultado',
  reference:          'Referencia',
  // ── Dictionary and the analyzer (plan 073) ──
  dictCollections:    'Colecciones',
  analyzerDoorSub:    'Texto, una foto, un video',
  passagesCount: (n) => `${n} ${n === 1 ? 'texto' : 'textos'}`,
  sentencesCount: (n) => `${n} ${n === 1 ? 'frase' : 'frases'}`,
  leaveAnalyzer:      'Analizador',
  furiganaCap:        'Furigana',
  newDeck:            'Nuevo mazo',
  cardsUnit: (n) => `${n} ${n === 1 ? 'tarjeta' : 'tarjetas'}`,
  // ── Profile, statistics and settings (plan 074) ──
  // ── 統計, the service record (plan 085) ──
  reportRetention:    'Retención',
  reportThisWeek:     'esta semana',
  reportWeeksAgo:     w => `hace ${w} sem.`,
  reportDelta:        (n, w) => `${n > 0 ? '+' : n < 0 ? '−' : '±'}${Math.abs(n)} · ${w} sem.`,
  reportWeekOf:       (date, n) => `semana del ${date} · ${n} ${n === 1 ? 'repaso' : 'repasos'}`,
  reportRungs:        ['<1 d', '1 sem', '1 mes', '3 meses', '3 meses+'],
  reportStrengthSummary: n => (n === 1 ? `${n} tarjeta según su intervalo` : `${n} tarjetas según su intervalo`),
  reportMisses:       (n, d) => `${n === 1 ? 'fallo' : 'fallos'} · ${d} d`,
  // ── 路線別, the record's lines (plan 138) ──
  reportWeekStart:    d => `semana del ${d}`,
  reportReviewsCap:   'repasos',
  reportPointOf:      (when, n) => `${when} · ${n} ${n === 1 ? 'repaso' : 'repasos'}`,
  reportLineReviews:  n => `${n} rep.`,
  reportToReview:     'Por repasar',
  reportNoMiss:       'Ningún fallo',
  reportLineEmpty:    'Aún no hay repasos',
  reportCell:         (mode, deck, pct, n) => `${mode} · ${deck} · ${pct}\u00a0% · ${n} ${n === 1 ? 'repaso' : 'repasos'}`,
  reportCellNone:     (mode, deck) => `${mode} · ${deck} · aún sin repasar`,
  reportTile:         (head, deck, mode, pct, lapses) => `${head} · ${deck} · ${mode} · ${pct}\u00a0% · ${lapses} ${lapses === 1 ? 'fallo' : 'fallos'}`,
  reportEmpty:        'Aún no hay repasos',
  reportEmptyHint:    'La primera semana de repasos traza la línea.',
  startedNote:     n => `${n} ${n === 1 ? 'empezada' : 'empezadas'}`,
  reportError:        'No se pudo leer el registro',
  daysUnit:           n => (n === 1 ? 'día' : 'días'),
  balanceRefillLine:  (at) => `+1 a las ${at}`,
  balanceRefillRate:  (min) => `+1 cada ${min} min`,
  perDayUnit:         '/ día',
  // ── The status sheet's head and its two comparison rows ──
  // The four-figure lattice (Last 14 days / Promised / At this pace /
  // On the pass) retired with the 進捗が主役 round: two of its cells
  // were one comparison and two were another, and it left both
  // subtractions to the reader. These say the same four numbers as
  // two rows that carry their own difference.
  statusPace:         'Ritmo',
  statusArrival:      'Llegada',
  statusPromisedPace: (p) => `prometido ${p} / día · últimos 14 días`,
  statusOnPassDate:   (d) => `en el pase, ${d}`,
  statusDaysDelta:    (n) => `${n > 0 ? '+' : '−'}${Math.abs(n)} d`,
  statusNextStop:     (stop) => `Próxima parada ${stop}`,
  statusArrived:      'Línea completada',
  statusBehindPlan:   (n) => `${n} de retraso`,
  statusAheadPlan:    (n) => `${n} de adelanto`,
  settingsGoalNoneShort: 'Sin destino',
  soundPresets:       'Preajustes',
  soundValueQuiet:    'Estación en silencio',
  soundValueFull:     'Estación animada',
  soundValueMixed:    'Personalizado',
  soundQuietHint:     'sin ambiente ni jingles',
  soundFullHint:      'ambiente y anuncios',
  soundOn:            'Sonido activado',
  soundOff:           'Sonido desactivado',
  soundOffHint:       'No suena nada, sean cuales sean los ajustes.',
  soundMixer:         'Mezclador',
  levelName:          { N5: 'Principiante', N4: 'Elemental', N3: 'Intermedio', N2: 'Avanzado', N1: 'Competente' },
  settingsPaceCap:    'Elementos nuevos al día',
  settingsPaceOwn: 'Personalizado',
  settingsPaceLess: 'Uno menos al día',
  settingsPaceMore: 'Uno más al día',
  settingsPaceCustom: n => `Tu ritmo está fijado en ${n} al día.`,
  paceName:           { local: 'Local', rapid: 'Rápido', express: 'Expreso' },
  levelUpTitle:       l => `¿Subir a ${l}?`,
  levelUpBody:        (to, weeks) => `Las paradas anteriores a ${to} se marcan como **conocidas**: sus tarjetas empiezan dominadas, con una primera comprobación repartida en las próximas ${weeks} semanas. Las tarjetas que ya estás aprendiendo conservan su lugar. **No se borra nada.**`,
  levelDownTitle:     l => `¿Bajar a ${l}?`,
  levelDownBody:      (to, returned) => (returned > 0
    ? `Lo que estudiaste más allá de ${to} queda apartado, no se borra. Las tarjetas marcadas como conocidas de ${to} en adelante sobre las que nunca se te preguntó vuelven a ser **nuevas**.`
    : `Las tarjetas más allá de ${to} quedan apartadas, no se borran: conservan su historial y vuelven al trayecto cuando subas de nuevo. El trayecto de hoy se reduce a las paradas de ${to}.`),
  levelMarkedKnown:   'Marcadas como conocidas',
  levelSpreadOver:    'Repartidas en',
  levelWeeks:         n => `${n} ${n === 1 ? 'semana' : 'semanas'}`,
  levelSetAside:      'Apartadas',
  levelDeleted:       'Borradas',
  levelBackToNew:     'Otra vez nuevas',
  levelUpGo:          l => `Subir a ${l}`,
  levelDownGo:        l => `Bajar a ${l}`,
  levelStay:          l => `Seguir en ${l}`,
  // 主 — the mode each line is ridden in (plan 273), Settings › Main
  // modes and its confirm sheet.
  settingsModes:      'Modos principales',
  settingsModesValue: 'Uno por línea',
  settingsModesHint:  'Hoy enseña cada línea en su modo principal. Añade otros de sus modos al lado, aquí o desde Hoy.',
  settingsModesAlso:  'También en Hoy',
  modeSwitchTitle:    mode => `¿Aprender en «${mode}»?`,
  modeSwitchBody:     (from, to, weeks) => `Conserva lo que dominas en **${from}**: esas tarjetas se marcan como conocidas en **${to}**, con una primera comprobación repartida en las próximas ${weeks} semanas. O empieza de cero: todas las tarjetas son nuevas en **${to}**. En ambos casos, **no se borra nada.**`,
  modeSwitchBodyNone: to => `Todas las tarjetas son nuevas en **${to}**, y Hoy empieza por las que aún no has visto. **No se borra nada.**`,
  modeSwitchGo:       mode => `Cambiar a «${mode}»`,
  modeSwitchKeep:     'Conservar lo que sé',
  modeSwitchFresh:    'Empezar de cero',
  fitDown: (to, passed, answered) => `${to} · ${passed} de ${answered} comprobaciones acertadas`,
  fitUp: (level, known, met) => `${level} · ${known} de ${met} palabras nuevas ya conocidas`,
  fitDownGo: to => `Embarcar en ${to}`,
  fitUpGo: to => `Probar ${to}`,
  destOnPass:         'En el pase',
  destService:        'Servicio',
  destDailyRide:      'Trayecto diario',
  destOptional:       'Opcional',
  destHour:           { am: 'Mañana', noon: 'Mediodía', pm: 'Noche' },
  destFlexible:       'Flexible',
  destAnyTime:        'a cualquier hora',
  destValidUntil:     'Válido hasta',
  destMovesTo:        date => `pasa al ${date} al ritmo de hoy`,
  destReprint:        'Reimprimir',
  compNote: (you, right) => `Tú · ${you} — correcto · ${right}`,
  examPart: (n) => `Parte ${n}`,
  serviceName: {
    local:   'Local',
    rapid:   'Rápido',
    express: 'Expreso',
    ltd:     'Especial',
    review:  'Repaso',
  },
  decksRowMeta:       (decks, cards) => `${decks} ${decks === 1 ? 'mazo' : 'mazos'} · ${cards} ${cards === 1 ? 'tarjeta' : 'tarjetas'}`,
  deckMore:           'Más',
  deleteDeck:         'Eliminar mazo',
  cardsCount:         n => `${n} ${n === 1 ? 'tarjeta' : 'tarjetas'}`,
  freqDomainDeck:     'Palabras del JLPT',
  freqDomainJmdict:   'Más allá del JLPT',
  resetStats:        'Restablecer todo',
  resetConfirm:      '¿Borrar todo el progreso? No se puede deshacer.',
  kana:              'Kana',
  jlptVocab:         'Vocabulario JLPT',
  globalSummary:     'Resumen global',
  new:               'Nuevo',
  learning:          'En curso',
  mastered:          'Dominado',
  dueNow:            'Pendiente',
  // The same state as dueNow, in the record cell that owns the
  // schedule: a figure, so one word rather than a phrase (plan 089).
  dueValue:          'Ahora',
  reviewThisCard:    'Repasar esta tarjeta',
  // The entry's record (plan 235): the schedule's cell, when the card is
  // due, is the door to its review; and the word that replaces JMdict's
  // star on a common word.
  dictReview:        'Repasar',
  dictCommon:        'común',
  total:             'Total',
  overview:        'Vista general',
  streak:          'Racha',
  resultNotSaved:  'No se pudo guardar esta respuesta en tu historial y no aparecerá en él.',
  runStreak:       (n, best) => `${n} ${n === 1 ? 'seguida' : 'seguidas'} · récord ${best}`,
  accuracy:        'Precisión',
  dueToday:        'Pendientes hoy',






}

// ── Phrases analyser ────────────────────────────────────────────
const phraseAnalyzer = {
  // 解析駅 — the merged analyser (plan 027). One station, three
  // platforms: 文字 / 写真 / 動画. The phraseAnalyzer* keys below are
  // kept for now; they still name the section wherever the old copy
  // has not been retired yet.
  analyzerTitle:       'Analizador',
  analyzerDesc:        'Todo el japonés con el que te cruzas\nEscrito, fotografiado o subtitulado\nDesglosado palabra por palabra',
  sourceText:          'Texto',
  sourcePhoto:         'Foto',
  sourceVideo:         'Video',
  sourceTextHint:      'Escribe o pega japonés',
  sourcePhotoHint:     'Toma o sube una foto',
  sourceVideoHint:     'Un enlace de YouTube y sus subtítulos',
  // 運行履歴 (plan 040) — the stamp and count for a session row in the
  // merged history list.
  sourceVideoShort:    'De un video',
  sessionSentenceCount: n => `${n} ${n === 1 ? 'frase' : 'frases'}`,
  platformUnit:        'Andén',
  platformNumber:      n => `andén ${n}`,
  // 路線図 (plan 028) — the Passage drawn as a line whose stops are its
  // Sentences, one of them open at a time.
  routeMap:            'Plano de la línea',
  stopsInPassage:      n => `${n} ${n === 1 ? 'frase' : 'frases'}`,
  stopNumber:          (i, n) => `Frase ${i} de ${n}`,
  // 追従 (plan 034) — following the video's clock along the line.
  followPlayback:      'Seguir el video',
  // 改札口 (plan 029) — the three intakes.
  intakeTextLead:      'Escribe o pega cualquier texto en japonés.',
  intakePhotoLead:     'Una página, un cartel, una captura: cualquier cosa con japonés.',
  intakeVideoLead:     'Pega el enlace y deja que el marcador 字幕取り traiga los subtítulos, o suelta un archivo.',
  shootPhoto:          'Fotografiar',
  pickPhoto:           'Elegir',
  charCount:           n => `${n} ${n === 1 ? 'carácter' : 'caracteres'}`,
  // Must agree with routes/video.py:50 (_MAX_UPLOAD_BYTES = 1 MB).
  subtitleAccepted:    'SRT, VTT, ASS, LRC y TXT · hasta 1 MB',
  windowLabel:         'Fragmento',
  windowFrom:          'Desde',
  windowTo:            'Hasta',
  windowFormatHint:    'mm:ss o segundos',
  // 改札口 / mining copy (2026-08-27). "Mine" and "cloze" were both
  // jargon on the primary action of the screen; these say what the
  // buttons do instead.
  notJapaneseLine:     'No es japonés: se muestra tal como aparece en los subtítulos, sin desglose.',
  notJapaneseShort:    'no es japonés',
  addToDeck:           'Añadir al mazo',
  cardOptions:         'Opciones',
  clozeExplain:        'Una tarjeta con hueco oculta esta palabra en la frase, para que la recuerdes por el contexto y no de una lista.',
  addCloze:            'Añadir tarjeta con hueco',
  changeSource:        'Cambiar lo que estudias',
  // The stub strip and the working rail (the control-room redesign).
  // Navigation is plain-language-first on this screen: Japanese stays
  // on the content and the small accents, the controls speak the
  // learner's own language.
  reopenIntake:        'Añadir otro texto',
  searchPassage:       'Buscar en el texto…',
  filterStops:         'Filtrar las frases',
  filterAll:           'Todas',
  filterKept:          'Guardadas',
  filterHasNew:        'Palabras nuevas',
  stopsShown:          (n, total) => `${n} de ${total} frases mostradas`,
  keepAllIPlusOne:     'Guardar todas las i+1',
  // The smart furigana's three settings.
  furiganaAll:         'Todos',
  // "only" is what makes the three exclusive, and being one of three
  // segments already says that. The word cost 60px of a 271px control
  // on a phone -- enough to break the dial onto two lines.
  furiganaUnknown:     'Desconocidos',
  furiganaNone:        'Ninguno',
  tokensCount:         n => `${n} ${n === 1 ? 'palabra' : 'palabras'}`,
  // The concourse cards' record column, and the player's transport.
  passagesCap:         'Textos',
  lastUsedCap:         'Último uso',
  playVideo:           'Reproducir',
  pauseVideo:          'Pausa',
  muteVideo:           'Silenciar el video',
  unmuteVideo:         'Activar el sonido del video',
  videoVolume:         'Volumen',
  videoVolumePct:      pct => `${pct}\u00a0%`,
  // The keyboard map under the stage.
  kbdToken:            'palabra',
  kbdSentence:         'frase',
  kbdPlay:             'reproducir',
  dockNoEntry:         'No hay entrada de diccionario para esta palabra.',
  // 机 — the analyser on three columns (plan 134).
  prevSentence:        'Frase anterior',
  nextSentence:        'Frase siguiente',
  replaySentence:      'Repetir la frase',
  loopSentence:        'Reproducir la frase en bucle',
  pauseEachSentence:   'Pausa al final de cada frase',
  playbackRate:        r => `${String(r).replace('.', ',')}×`,
  playbackSpeed:       r => `Velocidad: ${String(r).replace('.', ',')}×`,
  showVideo:           'Mostrar el video',
  hideVideo:           'Ocultar el video',
  furiganaNow:         label => `Furigana: ${label}`,
  wordsInSentence:     'Las palabras de la frase',
  // The text desk: the words list folded to one line (plan 235).
  wordsFoldCap:        'Palabras de la frase',
  explanationTitle:    'La frase explicada',
  // The desk's panel, its three faces (plan 242).
  panelFaces:          'Qué muestra el panel',
  faceWord:            'Palabra',
  facePoint:           'Punto',
  faceGrammar:         'Gramática',
  faceExplain:         'Construcción',
  explainThisSentence: 'Explicar la frase',
  explanationOpen:     'Explicación abierta',
  writtenHere:         s => `aquí: ${s}`,
  dictAnalyseSentence: 'Analizar esta frase',
  windowWhole:         'todo el video',
  windowSpan:          m => `Selección: ${m}`,
  windowBackwards:     'El final debe ir después del inicio.',
  historyTitle:        'Historial',
  dateToday:           'hoy',
  dateYesterday:       'ayer',
  dateDaysAgo:         n => `hace ${n} días`,
  phraseAnalyzerTitle: 'Analizador de frases',
  phraseAnalyzerDesc:  'Pega una frase y mírala desglosada\nCada palabra, su lectura, tu historial con ella\nPara la que casi entendiste',
  phraseAnalyzer:      'Analizador de frases',
  phrasePlaceholder:   'Escribe o pega una frase en japonés…',
  analyze:             'Analizar',
  showHistory:         'Historial',
  hideHistory:         'Ocultar historial',
  // ── 帳 — the passages first (plan 136) ──
  shelfAll:            'Todos',
  shelfKept:           'Guardados',
  passageKept:         'Guardado',
  shelfFilter:         'Mostrar',
  shelfSearch:         'Buscar en tus textos…',
  shelfEmpty:          'Aún no hay textos: lo que analices a la derecha aparecerá aquí.',
  shelfNoMatch:        'Ningún texto coincide.',
  shelfEmptyPhone:     'Tus textos aparecerán aquí: pega japonés o un enlace de YouTube arriba, o toma una foto.',
  newPassage:          'Nuevo texto',
  entryPlaceholder:    'Pega japonés o un enlace…',
  dropHere:            'Suéltalo aquí: subtítulos o una imagen',
  phraseAnalyzeError:  'No se pudo analizar esta frase. Inténtalo de nuevo.',
  clickForDetails:     'Haz clic para ver la definición y las estadísticas',
  inThisPhrase:        'En esta frase',
  appDefinition:       'Definición en la app',
  cardStats:           'Estadísticas de la tarjeta',
  totalReviews:        'Repasos',
  correctReviews:      'Aciertos',
  interval:            'Intervalo',
  days:                'días',
  nextReview:          'Próximo repaso',
  status_mastered:     'Dominado',
  status_learning:     'En curso',
  status_new:          'Nuevo',
  status_not_started:  'Fuera del mazo',
  status_due:          'Pendiente',
  sentenceLevel:       level => `Nivel estimado: ${level}`,
  unknownWords:        'palabras desconocidas',
  offDeckWords:        'no enseñadas por la app',
  iPlusOne:            'Un paso por encima de tu nivel',
  alreadyExplained:    'ya explicada',
  // 保存 (plan 039) — pinning a Sentence into the bank.
  keepSentence:        'Guardar esta frase',
  unkeepSentence:      'Dejar de guardar esta frase',
  // 歌 (plan 215) — a song's own deck, from the analyser's result.
  songDeckOpen:        'Crear un mazo con esta canción',
  songDeckShort:       'Mazo',
  dockGrammar:         'Gramática',
  dockWords:           'Palabras',
  dockExplain:         'Explicar',
  dockKeep:            'Guardar',
  dockKept:            'Guardada',
  // 表示 (plan 263) — the phone result's Display sheet.
  displayOpen:         'Pantalla',
  displayFurigana:     'Furigana',
  displayRomaji:       'Rōmaji',
  displayRomajiOff:    'Ocultos',
  displayRomajiOn:     'Visibles',
  displayTranslation:  'Traducción',
  displayTranslationOff: 'Oculta',
  displayTranslationOn:  'Visible',
  displayTranslationExplain: 'Explicar traduce la frase',
  displayDone:         'Listo',
  // 保存 (plan 263) — keeping a line puts it in a deck.
  keepTitle:           'Guardar',
  keepIn:              'Guardar en',
  keepChange:          'Cambiar',
  keepDeckChange:      name => `Mazo ${name}. Cambiar de mazo`,
  keepNewDeck:         'Nuevo mazo',
  keepNewSongDeck:     'Nuevo mazo · esta canción',
  keepThisSong:        'El mazo de esta canción',
  keepNew:             'Nuevo',
  keepTakesBoth:       'Palabras y frases',
  keepTakesWords:      'Solo palabras',
  keepTakesLines:      'Solo frases',
  keepLine:            'La frase',
  keepLines:           n => `Las frases · ${n}`,
  keepAndOthers:       n => `y ${n} más`,
  keepMoreLines:       n => `Elegir más frases · ${n}`,
  keepEditLines:       'Cambiar las frases',
  keepItsWords:        n => `Sus palabras · ${n}`,
  keepTheirWords:      n => `Sus palabras · ${n}`,
  keepKnown:           'conocida',
  keepMoreWords:       n => `Ver ${n} ${n === 1 ? 'palabra' : 'palabras'} más`,
  keepDeckWordsOnly:   'Este mazo solo admite palabras.',
  keepDeckLinesOnly:   'Este mazo solo admite frases.',
  keepCards:           n => `Guardar · ${n} ${n === 1 ? 'tarjeta' : 'tarjetas'}`,
  keepNothing:         'Nada que añadir',
  keepNoDeck:          'Guardar sin mazo',
  keepUseDeck:         name => `Guardar en ${name}`,
  keepNameOk:          'OK',
  keepLinesTitle:      'Frases',
  keepLinesOf:         (n, total) => `${n} de ${total}`,
  keepAll:             'Marcar todas',
  keepPickKept:        n => `Guardadas · ${n}`,
  keepPickUnknown:     'Con una palabra desconocida',
  keepPickNone:        'Ninguna',
  keepHeld:            'ya en el mazo',
  keepValidate:        n => `Hecho · ${n} ${n === 1 ? 'frase' : 'frases'}`,
  songDeckTitle:       'Hazla tuya',
  songDeckName:        'Nombre del mazo',
  songDeckHolds:       'Qué contiene el mazo',
  songDeckWords:       'Palabras',
  songDeckLines:       'Letra',
  wordsSheetTitle:     'Las palabras',
  wordsSheetCount:     (n, fresh) => `${n} ${n === 1 ? 'palabra' : 'palabras'}${fresh ? ` · ${fresh} ${fresh === 1 ? 'nueva' : 'nuevas'}` : ''}`,
  songDeckWordsDesc:   'Para entender la canción, palabra por palabra',
  songDeckLinesDesc:   'Cada verso y su lectura, para cantarla',
  songDeckCreate:      n => `Crear el mazo · ${n} ${n === 1 ? 'tarjeta' : 'tarjetas'}`,
  explainCap:          'Explicación',
  explainFailedTitle:  'Sin explicación por ahora',
  askHintSentence:     '¿Una pregunta sobre esta frase? Una respuesta breve y precisa.',
  askOffTopicSentence: 'Solo respondo preguntas sobre esta frase.',
  songDeckMaking:      'Creando el mazo',
  songDeckFailed:      'No se pudo crear el mazo. Inténtalo de nuevo.',
  songDeckLimit:       'Has alcanzado el límite de mazos o tarjetas de tu plan: parte de la canción queda fuera.',
  grammarSpotted:      'Gramática detectada',
  explainSentence:     'Explicar',
  explainAgain:        'Explicar de nuevo',
  explaining:          'Explicando…',
  explainFailed:       'La explicación no llegó. Inténtalo de nuevo.',
  explainUnavailable:  'Las explicaciones no están disponibles ahora. Inténtalo en un momento.',
  passageTruncated:    n => (n === 1 ? 'Solo se analizó la primera frase.' : `Solo se analizaron las primeras ${n} frases.`),
  sentenceAnalysisUnavailable: 'El análisis de esta frase no está disponible por ahora.',
  mineToDeck:          'Añadir',
  inDeck:              'En el mazo',
  alreadyInDeck:       'Ya está',
  chooseDeck:          'Elegir un mazo',
  noDeckOfType:        'Aún no hay mazos de este tipo',
  clozeCreated:        'Tarjeta con hueco creada',
  mineFailed:          'No se pudo añadir esta tarjeta. Inténtalo de nuevo.',
  cannotMineOffDeck:   'No está en el mazo de la app',
  // The same fact at legend length. The key sits beside MASTERED,
  // LEARNING and NEW and has to read as one of them; the sentence
  // above stays where it explains a dead control (MineButton's
  // title), which is the one place it earns its words.
  offDeckKey:          'Fuera del mazo',
  takePhoto:           'Tomar una foto',
  chooseImage:         'Elegir una imagen',
  ocrRecognizing:      'Leyendo la imagen…',
  ocrReading:          'Leyendo la imagen…',
  cropHint:            'Dibuja un recuadro alrededor del texto que quieras. Las flechas del teclado lo ajustan.',
  useThisArea:         'Leer esta zona',
  useWholeImage:       'Usar toda la imagen',
  ocrLocalOption:      'Leer en mi dispositivo (privado, mucho menos preciso)',
  ocrTooLarge:         'Esa imagen es demasiado grande. Intenta recortar una zona más pequeña.',
  ocrLimitReached:     'Has alcanzado el límite de imágenes de hoy. Vuelve a intentarlo mañana.',
  ocrUnavailable:      'La lectura de imágenes no está disponible ahora. Inténtalo en un momento.',
  ocrCheckText:        'Revisa el texto antes de analizar: el OCR no siempre acierta.',
  ocrFailed:           'No se pudo leer esta imagen. Prueba con otra o escribe el texto.',
  imageTooLarge:       'Esta imagen es demasiado grande.',
  hearThis:            'Escuchar',
  hearSentence:        'Escuchar esta frase',
  hearToken:           s => `Escuchar ${s}`,
  entryDeleted:        'Eliminado de tu historial',
  undo:                'Deshacer',
  addToAnotherDeck:    'Añadir a otro mazo',
  mineAdded:           'Añadido a tu mazo',
  mineAlready:         'Esa tarjeta ya estaba en el mazo',
}

// ── Video ─────────────────────────────────────────────────
const video = {
  videoTitle:          'Video',
  videoDesc:           'Estudia los subtítulos en japonés de un video\nEn vivo, con colores según lo que ya sabes\nUna foto del mundo con banda sonora',
  videoUrlOptional:    'Enlace del video',
  // Shown only where the server can fetch a link itself. It names the
  // subtitles rather than the mechanism -- the learner does not need to
  // know a proxy is involved, only what they get.
  analyzeThisLink:     'Obtener los subtítulos',
  // ── The video intake as a column (plan 136) ──
  // One filled action: set up the bookmark until it has been used, then
  // open the video on YouTube, where it is tapped.
  grabInstall:         'Configurar el marcador 字幕取り',
  grabInstallSay:      'Un minuto, una sola vez: después trae aquí los subtítulos de cualquier video de YouTube.',
  grabThenSay:         'Luego toca tu marcador 字幕取り: los subtítulos llegan aquí.',
  grabInstallLink:     'Configurar el marcador',
  chooseSubtitles:     'Elegir un archivo de subtítulos',
  copyBookmarklet:     'Copiar el marcador 字幕取り',
  bookmarkletCopied:   '¡Copiado! Ahora haz el paso 2',
  downsubHint:         'Descarga un archivo .vtt para elegirlo aquí — útil cuando el marcador no funciona.',
  grabEmpty:           'Los subtítulos obtenidos estaban vacíos — vuelve a intentarlo desde la página del video.',
  // The bookmark's own alerts, on youtube.com: baked in the learner's
  // language at the moment of copying (lib/captionGrab.js). tutTrouble1
  // quotes the first sentences of grabAlertNoJapanese and
  // grabAlertNotReady -- a test holds them in step.
  grabAlertNotYoutube:  'Primero abre el video en YouTube.',
  grabAlertNoVideo:     'No hay ningún video en esta página.',
  grabAlertNotReady:    'La página no está lista: recárgala y vuelve a intentarlo.',
  grabAlertNoSubtitles: 'Este video no tiene subtítulos.',
  grabAlertNoJapanese:  'No hay subtítulos en japonés. Disponibles: ',
  grabAlertEmpty:       'Los subtítulos llegaron vacíos: vuelve a intentarlo.',
  grabAlertFailed:      'No se pudieron obtener los subtítulos: ',
  // ── The bookmark tutorial ──
  tutTitle:            'Configurar el marcador 字幕取り',
  tutWhat:             'La idea: guardamos una pequeña «dirección mágica» como marcador en tu navegador. Si abres ese marcador mientras estás en un video de YouTube, obtiene sus subtítulos en japonés y te trae de vuelta aquí con el análisis ya en marcha. Nada que instalar, sin extensiones, sin cuentas.',
  tutStep1Title:       'Copia la dirección del marcador',
  tutStep1Body:        'Este botón pone la dirección en tu portapapeles. Empieza por «javascript:» — es normal; es la parte que hace el trabajo.',
  tutStep2Title:       'Crea el marcador en tu navegador',
  tutStep2Body:        'El gesto depende del dispositivo — elige el tuyo:',
  tutDeviceLabel:      'Dispositivo',
  tutDeviceDesktop:    'Computadora',
  tutDesktop1:         'Muestra la barra de marcadores: Ctrl+Mayús+B (⌘+Mayús+B en Mac).',
  tutDesktop2:         'Haz clic derecho en la barra → «Añadir página…» (Chrome/Edge) o «Nuevo marcador…» (Firefox).',
  tutDesktop3:         'Nombre: 字幕取り. En el campo URL, pega la dirección copiada y guarda.',
  tutAndroid1:         'En Chrome, en cualquier página, toca ⋮ y luego la estrella ☆: se crea un marcador.',
  tutAndroid2:         'Vuelve a abrir ⋮ → Marcadores, mantén presionado ese nuevo marcador → Editar.',
  tutAndroid3:         'Nombre: 字幕取り. Borra la URL, pega la dirección copiada y guarda.',
  tutIphone1:          'En Safari, en cualquier página, toca Compartir (el cuadrado con una flecha) → «Añadir marcador» → Guardar.',
  tutIphone2:          'Abre Marcadores (el icono del libro) → Editar y toca ese marcador.',
  tutIphone3:          'Nombre: 字幕取り. Sustituye la dirección por la copiada y toca OK.',
  tutStep3Title:       'Úsalo en un video',
  tutStep3a:           'Abre el video en el sitio youtube.com, en el navegador — no en la app de YouTube, que no ve tus marcadores',
  tutStep3b:           'Computadora: haz clic en 字幕取り en la barra de marcadores. Teléfono: escribe 字幕取り en la barra de direcciones y toca el marcador que te propone.',
  tutStep3c:           'La página vuelve aquí sola y el análisis empieza con los subtítulos en japonés — con el video al lado, listo para reproducir.',
  tutTroubleTitle:     'Si no funciona',
  tutTrouble1:         'El propio marcador te lo dice: «No hay subtítulos en japonés» significa que el video no tiene pista en japonés — no hay nada que obtener. «La página no está lista»: recarga la página del video y vuelve a intentarlo.',
  tutTrouble2:         'Como último recurso, el enlace de DownSub de esta página descarga un archivo .vtt: suéltalo en la zona 字幕 de abajo, el resultado es el mismo.',
  uploadSubtitles:     'Subir un archivo de subtítulos (.srt, .vtt, .ass)',
  openOnYoutube:       'Abrir en YouTube',
  windowStart:         'Inicio (segundos)',
  windowEnd:           'Fin (segundos)',
  windowCapped:        'La ventana se limitó a 5 minutos.',
  // The busy line is per-source: the same string said "Analyzing the
  // subtitles…" over a typed Sentence, because a 動画 string was being
  // rendered for all three platforms.
  analyzingText:       'Leyendo lo que escribiste…',
  analyzingPhoto:      'Leyendo el texto de tu foto…',
  analyzingVideo:      'Analizando los subtítulos…',
  captionsUnavailable: 'No se pudieron obtener los subtítulos de este video.',
  subtitleTooLarge:    'Este archivo de subtítulos es demasiado grande.',
  transcriptTooLong:   'Esta transcripción es demasiado larga. Pega una parte más corta.',
  videoStillPreparing: 'Todavía se está preparando un video. Espera a que termine y luego añade el siguiente.',
  // 動画 — why a video did not open (plan 215). The server names each
  // refusal with a code; these say it in the learner's language
  // (components/analysis/videoErrors.js), never the server's English.
  subtitleNotUtf8:     'Este archivo no está en UTF-8. Los .srt japoneses suelen estar en Shift-JIS: guárdalo de nuevo en UTF-8 (cualquier editor de texto sirve) y vuelve a intentarlo.',
  subtitleParseFailed: 'Este archivo de subtítulos está mal formado y no se pudo leer.',
  subtitleUnknownFormat: 'Formato de subtítulos no reconocido. Elige un archivo SRT, VTT, ASS, LRC o TXT.',
  subtitleNoCues:      'No hay líneas que leer en estos subtítulos.',
  transcriptNoTimestamps: 'No se encontraron marcas de tiempo. Copia todo el panel de transcripción de YouTube (cada línea debe empezar con un tiempo, como 0:18).',
  videoNotYoutube:     'Ese enlace no es un video de YouTube.',
  videoLinkFetchOff:   'Este servidor no puede obtener subtítulos desde un enlace. Usa el marcador 字幕取り o añade un archivo de subtítulos.',
  videoLinkAllowanceMine: 'Has agotado tus enlaces de hoy. Añade un archivo de subtítulos o vuelve mañana.',
  videoLinkAllowanceApp: 'Se agotaron los enlaces de hoy de toda la app. Añade un archivo de subtítulos o vuelve mañana.',
  videoNoJapanese:     'Este video no tiene subtítulos en japonés. Prueba con otro video o añade tú un archivo de subtítulos.',
  videoSubtitlesOff:   'Este video tiene los subtítulos desactivados.',
  videoSubtitlesEmpty: 'La pista de subtítulos en japonés de este video está vacía.',
  videoUnavailable:    'Este video no está disponible.',
  videoYoutubeRefused: 'YouTube se negó a dar los subtítulos de este video. El marcador 字幕取り o un archivo de subtítulos sí funcionarán.',
  videoYoutubeUnreachable: 'No se pudo conectar con YouTube. Vuelve a intentarlo en un momento.',
  videoTranscriptFailed: 'Algo falló al leer estos subtítulos. Vuelve a intentarlo.',
  videoStalled:        'La preparación de los subtítulos se detuvo por el camino. Vuelve a intentarlo.',
  breakThisDown:       'Desglosar esta frase',
  seekToSentence:      'Ir a esta frase',
  // 案内表示 — the notices under the intake. An `info` notice is a fact
  // about the Passage, not a failure, and must never wear --danger.
  passageReady:        n => `${n} ${n === 1 ? 'frase lista' : 'frases listas'}`,
  analysisFailed:      'No funcionó',
  noticeDismiss:       'Cerrar',
  analysisResult:      'Análisis',
  clearPassage:        'Borrar',
  clearPassageHint:    'Vaciar el analizador y empezar de nuevo',
}

// ── Reading ───────────────────────────────────────────────
const reading = {
  readingTitle:         'Práctica de lectura',
  readingDesc:          'Frases reales, a tu nivel\nPor nivel, por frecuencia o desde tus propias tarjetas\nPrimero lee, después comprueba',

  // Frequency source: which word list (byLevel/byFrequency/byMastery,
  // selectStudySource, selectTier, loadError live in `quiz` above —
  // shared with the other frequency-tier pickers in the app).
  selectDomain:          'Elige una lista de palabras',
  domainVocabDeck:       'Mazo del curso',
  domainVocabDecDesc:    'El mazo por niveles, de N5 a N1',
  domainVocabJmdict:     'Diccionario completo',
  domainVocabJmdictDesc: 'Todo el diccionario, lo más común primero',
  tierLabel:             'Tramo {n}',
  jumpToTier:            'Ir al tramo…',


  // Mastery source: shown instead of a phrase when the learner doesn't
  // have enough learning/mastered vocabulary yet for a full sentence.
  notEnoughMasteryWords: 'Aún no hay suficientes palabras en aprendizaje o dominadas — sigue estudiando y vuelve más tarde a este modo.',

  readingFetchError:    'No se pudo cargar una frase. Vuelve a intentarlo.',
  writeWhatYouSaw:      'Escribe lo que viste, en romaji',
  // The clock at the "No limit" pace (Settings › Reading pace).
  readingUntimed:       'Sin límite de tiempo',
  romajiPlaceholder:    'p. ej. konnichiwa',
  // The play button a phrase arrives behind (ReadingPieces' PlayButton).
  readingPlay:          'Mostrar la frase e iniciar el cronómetro',
  // The reading's clock (ReadingTimer): "4.5s".
  timerSeconds:         s => `${s.toLocaleString('es-ES', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}\u00a0s`,
  correct:              '¡Correcto!',
  incorrect:            'No del todo',
  correctRomaji:        'Romaji correcto',
  // The practice card (plan 185): the grammar point's tag at the card's
  // top, on the answer and (translation) on the prompt; and, for a screen
  // reader, what the figure in the answer's well counts and the name of
  // the words missed under it.
  pcardPoint:           'Punto',
  pcardUse:             'Usa',
  pcardMatched:         'de acierto',
  pcardMissed:          'Palabras que faltaron',
  nextPhrase:           'Siguiente frase',
  translation:          'Traducción',

  // Word-by-word breakdown toggle + its per-word navigation
  // (ReadingRun.jsx, DictationRun.jsx) — shown once a phrase has been
  // graded.
  showBreakdown:        'Ver el desglose',
  hideBreakdown:        'Ocultar el desglose',
  preparingBreakdown:   'Preparando el desglose…',
  // The settled failure, which 書取 can actually reach: its breakdown
  // is only asked for at the reveal (the sentence does not exist on
  // the client before that), so a dead model is visible here in a way
  // reading practice's own long prefetch window hides. 読解 shows it
  // too, for the slow or retrying call its prefetch does not outrun.
  breakdownUnavailable: 'Desglose no disponible',
  // The comprehension passage, sentence by sentence (PassageBreakdown):
  // the chevron's name, and the caption over the points the text was
  // written around.
  openSentence:         'Abrir esta frase',
  closeSentence:        'Cerrar esta frase',
  grammarInText:        'Gramática del texto',
  jumpToTokenNamed:      s => `Ir a ${s}`,
  detailsForToken:       s => `Detalles de ${s}`,
  detailsForKanji:       k => `Detalles del kanji ${k}`,
}
// ── Reading comprehension ────────────────────────────────────────────
const readingComprehension = {
  readingComprehensionTitle: 'Comprensión lectora',
  readingComprehensionDesc:  'Textos breves y luego preguntas\nLa parte de lectura del examen, ensayada\nDe N5 a N1',

  question:                   'Pregunta',
  yourAnswer:                 'Tu respuesta',
  gradeCorrect:               'Acerté',
  gradeIncorrect:             'Fallé',
  questionTypeComprehension: "Comprensión",
  questionTypeVocabulary: "Vocabulario",
  questionTypeGrammar: "Gramática",
  questionTypeInference: "Inferencia",
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
  translationTitle:      'Traducción',
  translationDesc:       'Pásalo tú al japonés\nUna respuesta de referencia y una valoración de la tuya\nEn el sentido difícil, a propósito',
  translationFetchError: 'No se pudo cargar una frase. Vuelve a intentarlo.',
  japanesePlaceholder:   'Escríbela en japonés…',
  // The tutor's review as a shape, not a paragraph (routes/translation.py).
  reviewCorrect:         'Correcto',
  reviewAcceptable:      'Aceptable',
  reviewPartial:         'En parte',
  reviewIncorrect:       'Incorrecto',
  reviewGood:            'Lo que funcionó',
  reviewFix:             'Por corregir',
  reviewGrammarUsed:     'usado',
  reviewGrammarMissed:   'no usado',
  analyzingTranslation:  'Analizando tu traducción…',
  analysisUnavailable:   'Análisis no disponible — compara con la referencia de arriba.',
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
  dictationTitle:        'Dictado',
  dictationDesc:         'Escribe en romaji lo que oyes\nDos escuchas, ni una más\nDe N5 a N1',
  dictationFetchError:   'No se pudo cargar un audio. Vuelve a intentarlo.',
  dictationCheckError:   'No se pudo corregir tu respuesta. Vuelve a intentarlo.',
  dictationPlaceholder:  'Escribe en romaji lo que oíste…',
  dictationPrompt:       'Escribe en romaji lo que oíste',
  dictationListen:       'Escuchar',
  dictationListensLeft:  n => (n === 1 ? '1 escucha restante' : `${n} escuchas restantes`),
}

// ── 作文 — composition (plan 125) ───────────────────────────────
// CompositionRun.jsx reuses the shared keys wholesale (selectLevel,
// leaveLevels, stationJlpt, submit, retry, yourAnswer,
// japanesePlaceholder, analysisUnavailable, nextPhrase,
// pcardPoint, glLesson, the review* keys, the breakdown and
// explain keys) — only the genuinely new keys live here.
const compositionMode = {
  compositionTitle:        'Redacción',
  compositionDesc:         'Escribe una frase con el punto indicado\nUn tutor te la revisa\nDe N5 a N1',
  compositionFetchError:   'No se pudo cargar un punto de gramática. Vuelve a intentarlo.',
  compositionPrompt:       'Escribe una frase con',
  analyzingComposition:    'Leyendo tu frase…',
  // The day's reviews are spent (routes/composition.py, 429). The run
  // goes on: the check still prints and the rating still counts.
  compositionLimitReached: 'Se acabaron las revisiones de hoy — tu comprobación y tu nota siguen contando. El tutor vuelve mañana.',
}

// ── 会話 — conversation (plan 217) ──────────────────────────────
// Someone speaks to the learner in a place (a konbini's till, a
// station's gate, a client's office) and they answer: by choosing among
// three replies, by writing what they are told to say, or freely, the
// other person played by the model. ConversationStation lists the
// scenes, ConversationRun rides one; the tutor's review, the practice
// card and the rating bar keep their own shared keys.
const conversationMode = {
  conversationTitle:   'Conversación',
  conversationDesc:    'Alguien te habla: respóndele\nElige, traduce o habla libremente\nDe N5 a N1',
  cvsFetchError:       'No se pudo cargar la conversación. Vuelve a intentarlo.',
  cvsModeLabel:        'Cómo respondes',
  cvsLevelLabel:       'Nivel',
  cvsModes:            { choose: 'Elegir', translate: 'Traducir', free: 'Libre' },
  cvsEmpty:            'Aún no hay conversaciones en este nivel.',
  // The station's search (plan 246): the well, its count, and what it
  // says when the grade holds nothing of the query.
  cvsSearchPlaceholder: 'Buscar una escena…',
  cvsCount:            n => (n === 1 ? '1 escena' : `${n} escenas`),
  cvsNoMatchHere:      level => `Ninguna escena de ${level} coincide.`,
  cvsFoundAt:          levels => `Hay coincidencias en ${levels.length < 2 ? levels.join('') : `${levels.slice(0, -1).join(', ')} y ${levels.at(-1)}`}.`,
  cvsGoTo:             level => `Ir a ${level}`,
  cvsNoMatch:          'Ninguna escena coincide.',
  cvsNoMatchHint:      'Prueba con un lugar, una persona o una palabra de la escena.',
  cvsClearSearch:      'Borrar la búsqueda',
  cvsRecordAria:       (right, done) => `${right} de ${done} respuestas correctas`,
  cvsLeave:            'Escenas',
  cvsRepliesRated:     'Respuestas',
  cvsStart:            'Empezar',
  cvsGoal:             'Tu misión',
  cvsRouteAria:        (place, n, total) => `${place}, respuesta ${n} de ${total}`,
  cvsSay:              'Di',
  cvsTheReply:         'La respuesta',
  cvsRightMark:        'Bien',
  cvsWrongMark:        'Mal',
  cvsNext:             'Siguiente',
  cvsFinish:           'Terminar',
  cvsReplyLabel:       'Tu respuesta',
  cvsReplyPlaceholder: 'Tu respuesta, en japonés o en rōmaji…',
  cvsSend:             'Enviar',
  cvsAnswering:        who => `${who} está respondiendo…`,
  cvsReading:          'Leyendo tu respuesta…',
  // The day's tutor is spent (routes/conversation.py, 429): the run
  // goes on, measured and graded.
  cvsReviewLimit:      'Se acabaron las revisiones de hoy — la medición y tu nota siguen contando. El tutor vuelve mañana.',
  cvsTalkLimit:        'Se acabó la conversación libre por hoy. Elegir y Traducir siguen funcionando — la conversación libre vuelve mañana.',
  cvsTalkOff:          'La conversación libre necesita al tutor, y ahora mismo no está disponible. Elegir y Traducir siguen funcionando.',
  cvsTalkFailed:       'No llegó ninguna respuesta. Vuelve a intentarlo.',
  cvsTalkOver:         'Ocho respuestas: la conversación termina aquí.',
  cvsOver:             'La conversación ha terminado',
  cvsAgain:            'Otra vez',
  cvsOther:            'Otra escena',
}

// ── Dictionary ────────────────────────────────────────────
const dictionary = {
  dictionaryPlaceholder: 'Busca un kanji, un kana o un significado…',
  noResults:         'Sin resultados para',
  reading:           'Lectura',
  romaji:            'Romaji',
  meaning:           'Significado',
  examples:          'Ejemplos',
  level:             'Nivel',
  listen:            'Escuchar',
  displayedKanji:    'kanji mostrados',
  displayedEntries:  'entradas mostradas',
  displayedWords:   'palabras mostradas',
  displayedPoints:  'puntos mostrados',
  radical:           'Radical',
  // Additional dictionary keys used by screens
  dictAll:           'Todo',
  dictKanji:         'Kanji',
  dictVocab:         'Vocabulario',
  dictHiragana:      'Hiragana',
  dictKatakana:      'Katakana',
  // 文法 — the grammar collection: the 355 points of the JLPT line as
  // entries, narrowed by level in a second row of chips.
  dictGrammar:       'Gramática',
  dictLevels:        'Niveles',
  dictLevelAll:      'Todos',
  // How the search reads the query: how strictly, and where.
  dictMatch:         'Coincidencia',
  dictMatchOptions:  { word: 'Palabra completa', start: 'Empieza por', any: 'En cualquier parte' },
  dictSearchOptions: 'Opciones de búsqueda',
  dictField:         'Buscar en',
  dictFieldOptions:  { all: 'Todo', japanese: 'Japonés', meaning: 'Significado' },
  // The search was retried against a word the catalogue holds, because
  // what was typed found nothing. A statement, not a question.
  dictCorrectedFor:  'Resultados para',
  dictionaryPlaceholderGrammar: 'Busca un punto, una estructura o un significado…',
  // お気に入り — the shelf of kept entries (plan 093): the sixth chip,
  // the star on the plate in both states, and the shelf with nothing
  // on it yet.
  dictAdd:             'Añadir',
  dictAddToDeck:       'Añadir a un mazo',
  dictFavorites:       'Favoritos',
  dictFavorite:        'Favorito',
  dictFavoriteAdd:     'Guardar en favoritos',
  dictFavoriteRemove:  'Quitar de favoritos',
  dictFavoriteFailed:  'No se pudo guardar.',
  dictFavoriteFull:    'No caben más favoritos: quita uno primero.',
  dictFavoritesEmpty:  'Aún no hay favoritos',
  dictFavoritesHint:   'La estrella de una entrada la guarda aquí.',
  // 発見 — a grammar point's tour (plan 187b)
  tourLookQ:         p => `¿Qué hace ${p}?`,
  tourLookHint:      n => `${n === 2 ? 'Dos' : 'Tres'} frases. Mira dónde se coloca y qué dicen las traducciones.`,
  tourIdea:          'Tengo una idea',
  tourSkip:          'Saltar la lección',
  tourGuessQ:        p => `¿Qué significa ${p}?`,
  tourCheck:         'Comprobar',
  tourThatIs:        p => `Eso es ${p}.`,
  tourNotThis:       'Eso no es lo que hacen estas frases.',
  tourHint:          'Fíjate en lo que dicen las traducciones.',
  tourGiven:         'Aquí está.',
  tourGivenNote:     'Tenlo presente: vuelve al final.',
  tourFound:         n => (n === 0 ? 'Bien visto, a la primera.' : n === 1 ? 'Bien visto, al segundo intento.' : `Bien visto, en el intento ${n + 1}.`),
  tourTerminus:      'Lo que has encontrado',
  tourNotLike:       p => `No ${p}`,
  tourBoard:         'Embarcar',
  tourReadLesson:    'Leer la lección completa',
  tourRight:         'Sí.',
  tourNotQuite:      'No del todo.',
  tourMe:            'Tú',
  tourPlayScene:     'Escuchar la escena',
  tourYourTurn:      'Tu turno',
  tourYourLine:      'Tu réplica',
  // 書く — the write (plan 187e).
  wrtAsk: 'Dilo en japonés',
  wrtWith: 'Con',
  wrtWords: 'Palabras útiles',
  wrtField: 'Tu frase (kana o rōmaji)',
  wrtHint: 'kana · rōmaji',
  wrtCheck: 'Comprobar',
  wrtFound: 'La estructura está presente.',
  wrtMissing: 'Falta la estructura.',
  wrtModel: 'Una forma de decirlo',
  tourRecord: (date, tries, helped) => `Descubierto el ${date} · ${helped ? 'regla dada' : tries ? `${tries} fallo${tries > 1 ? 's' : ''}` : 'a la primera'}`,
  tourReplay: 'Rehacer el tutorial',
  tourReplayScene: 'Repetir la escena',
  tourBackToLesson: 'Volver a la lección',
  // 発見 on the desk (plan 187f): the stops at the left, the plate at the right.
  tourStops: { look: 'Mira', guess: 'Adivina', found: 'Encontrado', scene: 'En escena', twist: '¡Y hay más!', quiz: 'El test', terminus: 'Resultados' },
  tourNotionCount: (n, total) => `${n} de ${total}`,
  tourTries: n => `${n} fallo${n > 1 ? 's' : ''}`,
  tourRuleGiven: 'regla dada',
  tourMissed: 'fallado',
  tourToFind: 'Por encontrar',
  tourLedgerLater: 'Los ejemplos y los puntos vecinos se abren en la terminal.',
  tourRouteAria: 'Las etapas del tutorial',
  tourLedgerAria: 'Lo que has encontrado',
  tourAria:          p => `Descubre ${p}`,
  // 194 — the ladder as steps, the plate, Construire typed, the tutorial's quiz
  glLadderBoard: 'Subir la escalera',
  lineAria: (group, at, of) => `Este punto: ${group}, peldaño ${at} de ${of}`,
  lineMasteredAria: 'Este punto: dominado',
  lineChoose: 'Elegir',
  lineBuild: 'Construir',
  lineMastered: 'Dominado',
  lineAgain: 'a repetir',
  lineRelapse: 'Recaída',
  chooseAsk: '¿Cuál encaja?',
  chooseTrap: p => `${p}, la trampa`,
  chooseRight: 'correcta',
  bldField: 'Tu respuesta',
  bldFieldN: n => `Tu respuesta, hueco ${n}`,
  bldHint: 'kana o rōmaji',
  bldCheck: 'Comprobar',
  bldRight: 'Correcto.',
  bldClose: 'Casi.',
  bldWrong: 'No del todo.',
  bldOther: (said, register) => `La frase dice ${said}: lo mismo, en estilo ${register === 'plain' ? 'llano' : 'cortés'}.`,
  mapAria: 'La línea del punto',
  mapTutorial: 'Tutorial',
  mapNow: 'ahora',
  mapDone: 'hecho',
  mapAfter: days => `+${days} d`,
  // 198 — what each rating does to the point, on the walk (CardPanel)
  mapOutsAria: 'Lo que hace cada nota',
  mapOutMove: move => ({ stay: 'a repetir', next: 'siguiente etapa', back: 'recaída', hold: 'sigue dominado' })[move],
  mapOutRow: (verdicts, move, when) => `${verdicts}: ${move}, ${when}`,
  mapSealed: 'su nombre se revela con la respuesta',
  tourUsageHead: '¡Y hay más!',
  tourQuizCount: (n, total) => `Pregunta ${n} de ${total}`,
  tourQuizGap: '¿Cuál encaja?',
  tourQuizKinds: { gap: 'El hueco', meaning: 'El significado', form: 'La forma', use: 'La réplica' },
  tourTrap: 'Trampa',
  tourResults: 'Resultados',
  tourScore: (r, n) => `${r} de ${n}`,
  tourSheet: 'La ficha del punto',
  tourStart: 'Empezar: Elegir 1',
  // 初見 — a kana or a kanji met for the first time (plan 216)
  glyphAria:         g => `Conoce ${g}`,
  glyphNew:          { kana: 'Kana nuevo', kanji: 'Kanji nuevo' },
  glyphTwin:         { hiragana: 'en hiragana', katakana: 'en katakana' },
  glyphStops:        { read: 'Leer', write: 'Escribir', use: 'En palabras' },
  glyphTraceQ:       'Dibuja cada trazo desde el punto hasta el círculo.',
  glyphGiven:        'Este trazo te lo dibujamos.',
  glyphTraced:       misses => (misses ? 'Trazado.' : 'Trazado a la primera.'),
  glyphShowMe:       'Muéstramelo',
  glyphShown:        'Así se escribe.',
  glyphBoardAria:    (g, n, total) => `Traza ${g}, trazo ${n} de ${total}`,
  glyphStart:        'Empezar',
  // 文法 — the lesson (plan 087): the pair marks over the steps, the
  // door on every card and the station's index, the gate's one button.
  glLesson:          'Lección',
  glPoints:          'Los puntos',
  glRule:            'Regla',
  glUse:             'Uso',
  glCareful:         'Cuidado',
  glCompare:         'Comparar',
  // The lesson's section heads (plan 235): each part found at a glance.
  glStructure:       'Estructura',
  glForms:           'Formas',
  glConfuse:         'No confundir con',
  glBoard:           'Entendido — embarcar',
  glBlank:           'hueco',
  glRegister: { neutral: 'Neutro', casual: 'Coloquial', polite: 'Cortés', formal: 'Formal', written: 'Escrito' },
  dictBackToRadicals:'Volver a los radicales',
  dictModeSearch:    'Búsqueda',
  dictModeRadical:   'Radical',
  dictionaryPlaceholderRadical: 'Filtra estos resultados por radical…',
  dictionaryResults: n => `${n} resultado${n === 1 ? '' : 's'}`,
  dictRadicalNumber: (n) => `radical n.º ${n}`,
  dictStrokesPlural: 'trazos',
  dictStrokeSingular: 'trazo',
  dictStrokeIndex:   'Índice por número de trazos',
  // The entry while it opens (DictionaryDetail.jsx).
  loadingDictionary: 'Abriendo la entrada…',
  dictStrokePrev:    'Menos trazos',
  dictStrokeNext:    'Más trazos',
  syllabaryMain:     'Silabario principal',
  syllabaryNSolo:    'ん',
  syllabaryVoiced:   'Sonidos sonoros',
  syllabaryYoon:     'Sonidos contraídos',
  syllabaryForeign:  'Sonidos extranjeros',
  syllabaryLong:     'Vocales largas',
  composingKanji:    'Formado por estos kanji',
  vocabExamples:     'Se usa en estas palabras',
  kanaExamples:      'Se lee en estas palabras',
  allReadings:       'Todas las lecturas',
  readingsNoWords:   'Aún no hay palabras de ejemplo',
  // 割合 (plan 177): the share of the words that use each reading.
  readingsScopeLabel:  'Alcance del recuento',
  readingsScopeCourse: 'Curso',
  readingsScopeAll:    'JMdict',
  readingsScopeHintCourse: (n) => `Proporción de las ${n} palabras del curso que usan cada lectura.`,
  readingsScopeHintAll:    (n) => `Proporción de las ${n} palabras de JMdict que usan cada lectura.`,
  readingsTier:      { core: 'Común', usual: 'Habitual', rare: 'Rara' },
  readingsOfWords:   (n, total) => `${n} de ${total.toLocaleString('es-ES')} palabra${total > 1 ? 's' : ''}`,
  readingsExamples:  (n) => `${n} ejemplo${n > 1 ? 's' : ''}`,
  readingsWholeShare: 'Palabra leída en bloque',
  readingsShareLoading: 'Contando…',
  readingsShareError:   'No se pudo cargar el recuento.',
  readingsCourseEmpty:  (kanji) => `Ninguna palabra del curso JLPT usa ${kanji}.`,
  readingsCourseEmptyBody: 'El recuento del curso está vacío. El diccionario completo tiene palabras con este kanji.',
  readingsCountAll:  'Contar en todo JMdict',
  // The two gates on the readings sheet. The Japanese half is the
  // heading and the plain-language half its caption (DESIGN.md, "Every
  // name is a pair") — never "ON'YOMI", which is the Japanese written
  // twice. The sheet's old 音 / 訓 squares said this to nobody who
  // could not already read them.
  readingsOnName:    'Lectura china',
  readingsKunName:   'Lectura japonesa',
  // The 熟 on a word row whose reading belongs to the whole word
  // (今朝 けさ, 時計 とけい), not to the kanji the row is about.
  readingsWhole:     'Se lee como una sola palabra',
  // Plan 276: the sheet a kanji card's two register names open
  // (components/study/ReadingsHelp, domain/readingsHelp).
  readingsHelpCap:   'Las dos lecturas',
  readingsHelpOn:    'Llegó de China con el kanji y se escribe en katakana. Es sobre todo la lectura de las palabras de varios kanji.',
  readingsHelpKun:   'La palabra japonesa que el kanji pasó a escribir, en hiragana. A menudo el kanji solo, o seguido de kana.',
  readingsHelpShare: (kanji) => `La proporción de palabras del curso que leen ${kanji} así: empieza por la más alta.`,
  readingsHelpTilde: (kanji, side, word) => `Una lectura que ${kanji} toma ${side === 'after' ? 'después de' : 'antes de'} otra parte de la palabra${word ? `: ${word.kanji}, ${word.kana}` : ''}.`,
  readingsHelpDot:   (written) => `Después del punto van kana: ${written}.`,
  // Icon-button title/aria-label on the dictionary-lookup action that
  // sits on a revealed card (RevealActions in QuizComponents.jsx).
  openDictionary:    'Abrir la entrada del diccionario',
}

// Reading-comprehension / generic reading labels
const comprehension = {
  comprehensionTitle:       'Comprensión lectora',
  comprehensionFetchError:  'No se pudo cargar un texto. Inténtalo de nuevo.',
  comprehensionLimitReached: 'No hay más textos nuevos por hoy. Vuelve mañana.',
  comprehensionGenerating:  'Escribiendo un texto para ti…',
  comprehensionSubmitError:  'No se pudieron enviar las respuestas. Inténtalo de nuevo.',
  doneReading:              'Lectura terminada',
  reReadText:               'Releer el texto',
  showTranslation:          'Mostrar traducción',
  hideTranslation:          'Ocultar traducción',
  timeRemaining:           'Tiempo restante',
  // Rolling the text up the card instead of showing it whole (plan 258).
  rollText:                 'Desplazar texto',
  rollWhole:                'Texto entero',
  rollLabel:                'Texto que se desplaza por la tarjeta',
  rollPause:                'Pausar el desplazamiento',
  rollResume:               'Reanudar el desplazamiento',
  rollSpeedLabel:           'Velocidad de desplazamiento',
  rollSlower:               'Más lento',
  rollFuriganaOn:           'Ocultar furigana',
  rollFuriganaOff:          'Mostrar furigana',
  rollFaster:               'Más rápido',
  rollSpeed:                n => `${n} car./s`,
  tryAgain:                'Reintentar',
  changeLevel:             'Cambiar de nivel',
  score:                   'Puntuación',
}

const progress = {
  progressNew:       'Por aprender',
  progressLearning:  'En curso',
  progressMastered:  'Dominado',
  cardProgress:      'Progreso de la tarjeta',
}

const misc = {
  mute:    'Silenciar',
  unmute:  'Activar sonido',
  readingsMore: (n) => `${n} lectura${n > 1 ? 's' : ''} más — la ficha del diccionario las tiene todas`,
  kanjiNoun: 'kanji',
  wordNoun:  'palabra',
  // Shown by components/study/SessionError when a study session has
  // nothing to show AND the last fetch failed — previously this state
  // rendered an empty box with no explanation and no way to recover.
  // ── Hints (indice_1/2/3) ──
  // A hint is opt-in per card and never forks the SRS — see
  // components/study/HintBar.jsx. These replace the old "MCQ mode"
  // labels, because multiple choice is a help level now, not an
  // exercise.
  hintChoicesShow:    'Mostrar opciones',
  hintChoicesHide:    'Ocultar opciones',
  hintSentencesShow:  'Mostrar una frase',
  hintSentencesHide:  'Ocultar la frase',
  hintFuriganaShow:   'Mostrar furigana',
  hintFuriganaHide:   'Ocultar furigana',
  // The speak-on-reveal switch beside them (components/study/SpeakToggle.jsx):
  // the name stays, the title says what a tap does.
  speakOnReveal:      'Leer al revelar',
  speakOnRevealOn:    'Leer la respuesta en voz alta al revelarla',
  speakOnRevealOff:   'Dejar de leer la respuesta al revelarla',

  // ── Study modes (domain/studyModes.js) ──
  // One label + description per mode key. Namespacing means these need no
  // `noun` parameter: the old modeQcmKjM(noun) shape existed because
  // `flashcard-kj-m` meant "kanji" on one screen and "word" on another,
  // and a single translation key had to serve both — which it could only
  // ever get right for one of them.
  mode_kana_flashcard_f2b:        'Kana → romaji',
  mode_kana_flashcard_f2b_desc:   'Se muestra el kana. Recuerda cómo suena.',
  mode_kana_flashcard_b2f:        'Romaji → kana',
  mode_kana_flashcard_b2f_desc:   'Se da el sonido. Recuerda el kana.',
  mode_kana_write_romaji:         'Escribir el romaji',
  mode_kana_write_romaji_desc:    'Se muestra el kana. Escribe cómo suena.',
  mode_kana_write_kana:           'Trazar el kana',
  mode_kana_write_kana_desc:      'Se da el sonido. Traza el kana a mano.',

  mode_kanji_flashcard_f2b:       'Kanji → significado',
  mode_kanji_flashcard_f2b_desc:  'Se muestra el kanji. Recuerda qué significa.',
  mode_kanji_flashcard_b2f:       'Significado → kanji',
  mode_kanji_flashcard_b2f_desc:  'Se muestra el significado. Recuerda el kanji.',
  mode_kanji_write_kanji:         'Trazar el kanji',
  mode_kanji_write_kanji_desc:    'Se da el significado. Traza el kanji a mano.',
  mode_kanji_readings:            'Lecturas',
  mode_kanji_readings_desc:       "Se muestra el kanji. Escribe su on'yomi y su kun'yomi.",
  mode_kanji_radical:             'Radical',
  mode_kanji_radical_desc:        'Se muestra el kanji. Recuerda en qué radical se basa.',

  mode_vocab_flashcard_f2b:       'Palabra → significado',
  mode_vocab_flashcard_f2b_desc:  'Se muestra la palabra. Recuerda qué significa.',
  mode_vocab_flashcard_b2f:       'Significado → palabra',
  mode_vocab_flashcard_b2f_desc:  'Se muestra el significado. Recuerda la palabra.',
  mode_vocab_word_reading:        'Lectura',
  mode_vocab_word_reading_desc:   'Se muestra la palabra. Recuerda cómo se lee en kana.',

  mode_grammar_flashcard_f2b:      'Regla → significado',
  mode_grammar_flashcard_f2b_desc: 'Se muestra la estructura. Recuerda qué hace.',
  mode_grammar_flashcard_b2f:      'Significado → regla',
  mode_grammar_flashcard_b2f_desc: 'Se muestra el significado. Recuerda la estructura.',
  mode_grammar_fill_in:            'Nombrar la regla',
  mode_grammar_fill_in_desc:       'Una frase en japonés, sin traducción. Nombra la estructura que usa.',
  mode_grammar_contrast:           'Cuál encaja',
  mode_grammar_contrast_desc:      'Una frase con un hueco. Elige la estructura entre las que se confunden con ella.',
  mode_grammar_ladder:             'La escalera',
  mode_grammar_ladder_desc:        'Un ejercicio que sube contigo: reconocer, elegir, construir y luego escribir.',
  mode_grammar_build:              'Construir',
  mode_grammar_build_desc:         'La frase en piezas. Vuelve a poner la estructura y su palabra en su sitio.',
  mode_grammar_write:              'Escribir',
  mode_grammar_write_desc:         'Algo que decir en japonés con la estructura. La nota la pones tú.',

  mode_standard_flashcard_f2b:      'Anverso → reverso',
  mode_standard_flashcard_f2b_desc: 'Tu tarjeta, tal como la escribiste.',
  mode_standard_flashcard_b2f:      'Reverso → anverso',
  mode_standard_flashcard_b2f_desc: 'Tu tarjeta, al revés.',

  mode_fast_review:                'Repaso rápido',
  mode_fast_review_desc:           'Hojea lo que ya has estudiado. No se califica nada.',
  retry:              'Reintentar',
}

// ── Profile ───────────────────────────────────────────────
const profile = {
  // ── Profile ──
  thisWeek:          'Esta semana',
  records:           'Récords',
  currentStreak:     'Racha actual',
  longestStreak:     'Más larga',
  perfectRun:        'Mejor serie',
  perfectRunUnit:    'seguidos',
  dayUnit:           'días',
  chaseNext:         (xp, who) => `${xp} XP por detrás de ${who}`,
  // ── 定期入れ — the pass-holder profile ──
  retention:         'Retención',
  daysStamped:       'Sellados',
  ranking:           'Clasificación',
  periodWeek:        'Esta semana',
  periodAll:         'Desde el inicio',
  rankColumn:        'Puesto',
  // ── 番付 — the whole board (plan 262) ──
  periodDivision:    'División',
  // The whole board's three tabs, short enough for a phone's width.
  bzTabWeek:         'Semana',
  bzTabAll:          'Total',
  bzWhole:           'Toda la clasificación',
  bzGapTo:           (xp, who) => `${xp} XP para superar a ${who}`,
  bzMoveUp:          (n) => `Sube ${n} desde ayer`,
  bzMoveDown:        (n) => `Baja ${n} desde ayer`,
  bzRowAria:         (who) => `Abrir el pase de ${who}`,
  bzScopeLabel:      'A quién mostrar',
  bzScopeAll:        'Todos',
  bzScopeLevel:      (level) => `Mi nivel · ${level}`,
  bzMovedUp:         'Ascenso el lunes pasado',
  bzMovedDown:       'Descenso el lunes pasado',
  bzDivisionBelow:   'La división inferior',
  bzDivisionAbove:   'La división superior',
  bzEarlier:         'Puestos anteriores',
  bzMore:            'Más puestos',
  bzJumpToMe:        'Mi puesto',
  bzEmpty:           'Aún no hay nadie en esta clasificación.',
  bzLoadFailed:      'No se pudo cargar la clasificación.',
  bzShownHint:       'Los demás estudiantes ven tu nombre y tu XP.',
  bzHiddenHint:      'Los demás estudiantes ya no te ven. Tú sigues viendo tu puesto.',
  bzCardAria:        (who) => `El pase de ${who}`,
  bzCardFailed:      'No se pudo cargar este pase.',
  bzCardLevel:       'Nivel',
  bzCardDecks:       'Mazos publicados',
  // The A1 board (plan 262, the owner's pick of the canvas).
  bzEndsIn:          (d, h) => (d > 0 ? `Termina en ${d} d ${h} h` : `Termina en ${h} h`),
  bzPodiumCap:       'Semana pasada',
  bzUpHead:          'Suben el lunes',
  bzDownHead:        'Bajan el lunes',
  bzInUp:            'En la zona de ascenso',
  bzLadder:          'Las divisiones',
  // The foot as F2 (plan 262): the learner's card and the switch row.
  bzToUpRest:        'para subir el lunes',
  bzToStayRest:      'para seguir en esta división',
  bzOrdinal:         (n) => (Number.isFinite(n) ? '.º' : ''),
  bzAppear:          'Aparecer en la clasificación',
  bzLearners:        (n) => `${n} estudiante${String(n) === '1' ? '' : 's'}`,
  east:              'Este',
  west:              'Oeste',
  passLabel:         'Pase de transporte',
  passSince:         (when) => `Desde ${when}`,
  noActivityWeek:    'Aún no has estudiado nada esta semana',
  profileTitle:      'Perfil',
  profileStale:      'No se pudo conectar con el servidor — se muestran tus últimos datos conocidos.',
  leaderboard:       'Clasificación',
  done:              'Hecho',
  genericError:      'Algo salió mal. Inténtalo de nuevo.',

  // ── 定期券の裏 — the journey on the pass back (plan 063) ──
  // The Japanese status words (定刻, 遅延…) are signage and live in
  // the component; these are their plain-language captions and the
  // honest sentences beside the track.
  jourStatus: {
    suspended:      'Suspendido',
    ahead:          'Adelantado',
    onTime:         'Puntual',
    slightlyBehind: 'Leve retraso',
    delayed:        'Con retraso',
  },
  // The track's YOU / PLAN caption tags and its day-bracket label
  // retired with the two-lane drawing (see GhostTrack.jsx): the marks
  // now say which is which by their own form, and the day count is a
  // delta on the arrival row.
  jourYourLine:      'Tu línea',
  jourTurnOver:      'Dar la vuelta',
  jourFootOnTime:    (a, p, dest, date) =>
    `**${a} al día**, justo los **${p}** prometidos. La llegada a ${dest} se mantiene el **${date}**.`,
  jourFootAhead:     (a, p, dest, days, date) =>
    `**${a} al día** frente a los **${p}** prometidos — ${dest} llega **${days} día${days === 1 ? '' : 's'} antes**, hacia el **${date}**.`,
  jourFootBehind:    (a, p, dest, date, days) =>
    `Últimos 14 días: **${a} al día** frente a los **${p}** prometidos. Al ritmo de hoy, ${dest} llega el **${date}** — **${days} día${days === 1 ? '' : 's'}** después de la fecha de tu pase.`,
  jourFootSuspended: (date) =>
    `Sin estudio en 14 días. El **${date}** de tu pase ya no significa nada — retoma, o reimprímelo con una fecha que cuente.`,
  jourFootPaceKept:  (a, p) =>
    `Últimos 14 días: **${a} al día** frente a los **${p}** prometidos. Sin llegada fija — el ritmo es toda la promesa.`,
  jourFootPaceSuspended: (p) =>
    `Sin estudio en 14 días frente a una promesa de **${p} al día**. La línea espera — el torniquete se abre con una sola tarjeta.`,
  // 定期券の裏 (plan 174): the line alone on the card's back. The drift
  // in days, signed and wordless -- the colour says the rest; the ghost
  // train is labelled "promised".
  jourDrift:         (n) => `${n > 0 ? '+' : '−'}${Math.abs(n)} día${Math.abs(n) === 1 ? '' : 's'}`,
  jourRoute:         (from, to) => `${from} → ${to}`,
  jourNoDest:        'Este pase no tiene destino.',
  jourNoDestLink:    'Elige uno en la taquilla',
  // The two moves are ONE choice, so they are written as one: the
  // first line is what you change, the second is the same sentence on
  // both — the date you then arrive. A reader compares two dates and
  // two paces, with no prose in between to hold the difference in.
  // The pace carries perDayUnit's own "/ day", which is what the PACE
  // row above these buttons already prints: the button and the figure
  // it is offering to change say the unit the same way, and it is two
  // characters rather than six on a 165px button.
  jourActRecover:    (pace) => `Ir a ${pace} / día`,
  jourActRecoverSub: (date) => `llegar el ${date}`,
  jourActReprint:    'Reimprimir el pase',
  jourActReprintSub: (date) => `llegar el ${date}`,
  jourActResume:     'Retomar la línea',
  jourActResumeSub:  'el pase no cambia',
  jourActSlow:       (pace) => `Reimprimir a ${pace} / día`,
  jourActSlowSub:    (date) => `llegar el ${date}`,
  jourReprintError:  'No se pudo reimprimir — inténtalo de nuevo.',

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
  settings:          'Ajustes',
  preferences:       'Preferencias',
  sound:             'Sonido',
  ambiance:          'Ambiente',
  theme:             'Tema',
  language:          'Idioma',
  account:           'Cuenta',
  signOutDesc:       'Cierra la sesión de tu cuenta en este dispositivo.',
  // A guest holds no key: signing out ends the journey for good. The
  // row says so rather than letting it be discovered.
  signOutGuestDesc:  'Sin cuenta, tu progreso solo vive en este dispositivo: cerrar sesión lo borrará para siempre.',
  guestLabel:        'Pase de invitado',
  guestCap:          'Sin correo',
  guestClaimDesc:    'Tu progreso ya está aquí. Añade un correo y una contraseña para conservarlo — nada se mueve, es la misma cuenta.',
  guestClaimConfirm: 'Casi: confirma el correo con el enlace que te acabamos de enviar.',
  guestClaimDone:    'Cuenta creada. Tu progreso se conserva.',
  // 相互乗り入れ — Google on a pass that already has a key. Named
  // plainly, because the row has to answer the question the learner
  // arrives with: "why did signing in with Google not open my
  // account?" See components/settings/AccountPage.jsx.
  linkGoogleLabel:   'Google',
  linkGoogleCap:     'No conectado',
  linkGoogleDesc:    'Añade Google a esta cuenta, y «Continuar con Google» la abrirá en lugar de una nueva y vacía.',

  // Only ever surfaces as title/aria-label text (NavControls.jsx) —
  // the visible toggle is already a real IconSun/IconMoon SVG.

  volumeKana:         'Volumen de kana',
  volumeVoice:        'Volumen de voz',
  volumeEffects:      'Volumen de efectos',
  volumeUi:           'Volumen de interfaz',
  volumeAmbiance:     'Volumen del ambiente',
  volumeJingle:       'Volumen del jingle',
  // The station announcements (playAnnouncement). This key was the one
  // channel in SLIDER_LABELS with nothing behind it in either locale,
  // so its row in the mixer drew a slider with no label at all.
  volumeAnnouncement: 'Volumen de anuncios',
  volumeAnnouncements: 'Volumen de anuncios',
}

// ── Decks ─────────────────────────────────────────────────
const decks = {
  decks:             'Mis mazos',
  createDeck:        'Crear mazo',
  deckNamePlaceholder: 'Nombre del mazo…',
  noDecks:           'Aún no hay mazos.',
  createFirstDeck:   'Crea tu primer mazo arriba.',
  // The shelf's own index — a search field and a row of type filters
  // (DecksScreen.jsx), modelled on the dictionary's console. `{n}` is
  // the count that survived both filters, following the same
  // placeholder convention browseSelectedCount uses.
  decksSearchPlaceholder: 'Buscar un mazo…',
  decksAllTypes:     'Todos',
  decksCount:        '{n} mazos',
  decksCountOne:     '1 mazo',
  decksNoMatch:      'Ningún mazo coincide.',
  decksNoMatchHint:  'Prueba otro nombre o borra los filtros.',
  decksClearFilters: 'Borrar filtros',
  // Asked in place on the card/toolbar rather than through the
  // browser's own confirm() dialog — short, because it sits inline.
  deleteDeckConfirm: '¿Eliminar este mazo?',
  deleteCardsConfirm: '¿Eliminar la selección?',
  deleteCardConfirm: '¿Eliminar esta tarjeta?',
  study:             'Estudiar',
  deckEdit:          'Editar',
  deckAddCards:      'Añadir tarjetas',
  deckWriteCard:     'Escribir una tarjeta',
  deckAllCards:      n => (n === 1 ? 'La tarjeta' : `Las ${n} tarjetas`),
  deckFigs:          { due: 'Pendientes', new: 'Nuevas', learning: 'En curso', mastered: 'Dominadas' },
  deckCardState:     { due: 'Pendiente', new: 'Nueva', learning: 'En curso', mastered: 'Dominada' },
  deckToday:         'Hoy',
  deckTodayDesc:     'Las tarjetas de hoy de este mazo, en todos los modos.',
  deckToStudy:       n => (n === 1 ? 'tarjeta por estudiar hoy' : 'tarjetas por estudiar hoy'),
  addCard:           '+ Añadir tarjeta',
  newCard:           'Tarjeta nueva',
  editCard:          'Editar tarjeta',
  noCards:           'No hay tarjetas en este mazo.',
  addFirstCard:      'Añade tu primera tarjeta arriba.',
  frontPlaceholder:  'Anverso',
  backPlaceholder:   'Reverso / Significado',
  hintPlaceholder:   'Pista (opcional)',
  notesPlaceholder:  'Notas (opcional)',
  // Front-field placeholder specific to kanji-type custom decks
  // (DeckDetailScreen.jsx) — used to be a hardcoded, untranslated
  // "Kanji (ex: 日)" string.
  kanjiFrontPlaceholder: 'Kanji (p. ej. 日)',
  // Shown in the TopBar title if a deck's own name isn't available
  // yet (e.g. this screen opened directly instead of via DecksScreen,
  // so router state carrying the deck is missing) — used to be a
  // hardcoded "Deck" string.
  deckFallbackTitle: 'Mazo',

  // Deck types — each one (besides "Mixed") now restricts what can be
  // added to it (see DeckDetailScreen/BrowseCardsMenu and decks.py's
  // SOURCE_FOR_TYPE), so the description is the actual rule, not just
  // a feature note.
  flashcardType:     'Tarjetas',
  flashcardDesc:     'Solo tus propias tarjetas — en cualquier idioma',
  kanaType:          'Kana',
  vocabType:         'Vocabulario',
  vocabDesc:         'Palabras graduadas de N5 a N1\nO por frecuencia, por tema o fuera del temario\nDe la forma al significado, y de vuelta',
  deckKanaDesc:      'Solo kana — con orden de trazos',
  deckVocabDesc:     'Solo vocabulario — de los niveles JLPT',
  kanjiType:         'Kanji',
  kanjiDesc:         'Caracteres por nivel, con orden de trazos\nLéelos y luego escríbelos de memoria\nCada lectura, cada significado',
  deckKanjiDesc:     'Solo kanji — con orden de trazos',
  grammarType:       'Gramática',
  deckGrammarDesc:   'Solo puntos de gramática — de los niveles JLPT',
  mixedType:         'Mixto',
  mixedDesc:         'Palabras, kanji, gramática y tus propias tarjetas, en un solo mazo',
  lyricsType:        'Letras',
  lyricsDesc:        'Una canción, desde un archivo de subtítulos, su letra o un enlace de YouTube',
  // 歌 (plan 264) — a song's lyrics into a deck, from the shelf.
  lyricsImport:           'Importar la letra',
  lyricsImportTitle:      'Una canción en un mazo',
  lyricsSource:           'De dónde viene la letra',
  lyricsFromFile:         'Archivo',
  lyricsFromLink:         'YouTube',
  lyricsFromPaste:        'Pegar',
  lyricsPastePlaceholder: 'Pega la letra en japonés de la canción',
  lyricsLinkOff:          'Este servidor no puede obtener subtítulos de un enlace ahora mismo. Añade un archivo o pega la letra.',
  lyricsStart:            'Leer la letra',
  lyricsReading:          'Leyendo la letra',
  lyricsSorting:          'Separando las líneas cantadas',
  lyricsSortSpent:        'La separación automática se ha agotado por hoy: revisa tú las líneas.',
  lyricsSortOff:          'La separación automática no está disponible ahora mismo: revisa tú las líneas.',
  lyricsNoLines:          'No hay ninguna línea en japonés que poner en un mazo.',
  lyricsSung:             'Cantada',
  lyricsNotSung:          'Fuera de la canción',
  lyricsKindSpoken:       'Hablada',
  lyricsKindCredit:       'Créditos',
  lyricsKindSound:        'Sonido',

  // Browse existing cards (BrowseCardsMenu.jsx)
  browseBtn:              'Explorar',
  browseTitle:            'Explorar tarjetas existentes',
  browseTabKanji:         'Kanji',
  browseTabVocab:         'Vocabulario',
  browseTabGrammar:       'Gramática',
  browseAllLevels:        'Todos',
  browseSearchPlaceholder: 'Buscar (kanji, kana, significado…)',
  browseResults:          'Resultados',
  // {n} follows the same placeholder convention as andMore above.
  browseSelectedCount:    '{n} seleccionadas',
  searching:              'Buscando…',
  browseNoResults:        'Sin resultados.',
  alreadyAdded:           'ya añadida',
  adding:                 'Añadiendo…',
  addSelected:            'Añadir ({n})',
  browseAddFailed:        'No se añadieron estas tarjetas. Inténtalo de nuevo.',
  // Bulk select
  selectAll:         'Seleccionar todo',
  deselectAll:       'Deseleccionar todo',

  // Import modal
  importTitle:       'Importar tus datos',
  importSubtitle:    'Pega aquí tus datos — desde Word, Excel, Google Docs o donde sea.',
  importPreview:     'Vista previa',
  noPreview:         'Aún no hay nada que previsualizar',
  termSep:           'Entre término y definición',
  cardSep:           'Entre tarjetas',
  tab:               'Tabulador',
  comma:             'Coma',
  custom:            'Personalizado',
  newRow:            'Salto de línea',
  semicolon:         'Punto y coma',
  importBtn:         'Importar',
  importing:         'Importando…',
  cards:             'tarjetas',
  andMore:           '… y {n} más',
  importColumns:     'Columnas:',
  importRepeat:      'luego {cols}, tantas veces como quieras',
  importHeaderHint:  'Una primera fila de encabezados (Regla, Significado, Ejemplo, Traducción…) lee las columnas en el orden de tu hoja. Pon una celda entre comillas "…" para que lleve una coma o un salto de línea.',
  importExample:     'Insertar un ejemplo',
  importHeaderFound: 'Encabezados reconocidos',
  importIgnoredCols: 'Columnas ignoradas: {cols}',
  importSkipped:     '{n} omitidas',
  importMissing:     'falta: {fields}',

  // Study screen
  studyMode:         'Modo de estudio',
  mixWithJLPT:       'Mezclar contenido JLPT (opcional)',
  startSession:      'Empezar',
  writePractice:     'Práctica de escritura',
  revealAnswer:      'Mostrar respuesta',
  typeAnswer:        'Escribe tu respuesta…',
  // Custom vocab/kanji deck phase labels (StudyScreen.jsx) — K+K→S is
  // Kanji+Kana → Sens (meaning), same three-phase progression as the
  // built-in vocab/kanji decks.
  studyPhase1:       'Fase 1 — K+K→S',
  studyPhase2:       'Fase 2 — K→S',
  studyPhase3:       'Fase 3 — S→K',

  // ── The library ───────────────────────────────────────────
  // "Library" alone, with no Japanese pair: owner's call, and the one
  // section in the app that reads Latin-only by design. See DESIGN.md.
  library:               'Biblioteca',
  // The door beside Create deck on the shelf: the verb, because it
  // sits next to one and the roundel beside it already says books.
  libraryBrowse:         'Explorar',
  librarySeeAll:         'Ver todo',
  libraryMore:           'Ver más',
  librarySort:           'Orden',
  librarySortNew:        'Más recientes',
  librarySortFollowed:   'Más seguidos',
  // The console's chip row, named for a screen reader. Its FIELD says
  // what 教材's own console says (decksSearchPlaceholder): one console
  // everywhere means the same words in it, and the longer sentence
  // ("Search the library…") was cut by the tally on a phone before
  // anything had been typed into it.
  libraryTypes:          'Tipos de mazo',
  libraryBy:             name => `de ${name}`,
  // The shelf and the library beside the lines on the desk, and the
  // library's three sections (plan 132).
  gateShelfEmpty:        'No hay mazos en tu estante.',
  gateShelfEmptyHint:    'Crea el tuyo o sigue uno de la biblioteca: se repasa con el resto.',
  gateDeckPublished:     'publicado',
  librarySeeCards:       n => (n === 1 ? 'Ver la tarjeta' : `Ver las ${n} tarjetas`),
  libraryFeatured:       'Destacados',
  libraryFeaturedWhen:   'esta semana',
  libraryFollowing:      'Siguiendo',
  libraryFollowingCount: n => `${n} mazo${n === 1 ? '' : 's'} seguido${n === 1 ? '' : 's'}`,
  libraryFollowingNone:  'No sigues ningún mazo. Sigue uno: recibirás las tarjetas que se le añadan.',
  libraryNewCards:       n => `+${n} tarjeta${n === 1 ? '' : 's'}`,
  libraryUpToDate:       'Al día',
  libraryMine:           'Tus publicaciones',
  libraryMineCount:      n => `${n} mazo${n === 1 ? '' : 's'} publicado${n === 1 ? '' : 's'}`,
  libraryMineNone:       'No hay mazos publicados. Publica uno desde su página: aparecerá aquí con sus seguidores.',
  libraryWeeksLabel:     list => `Nuevos seguidores por semana, en ocho semanas: ${list}`,
  libraryFollowers:      n => (n === 1 ? '1 seguidor' : `${n} seguidores`),
  libraryAndMore:        n => (n === 1 ? 'y 1 tarjeta más' : `y ${n} tarjetas más`),
  libraryEmpty:          'Aún no hay nada publicado',
  libraryEmptyHint:      'Cuando otros estudiantes publiquen un mazo, aparecerá aquí.',
  libraryFailed:         'No se pudo acceder a la biblioteca',
  libraryFailedHint:     'Comprueba tu conexión e inténtalo de nuevo.',
  libraryGone:           'Este mazo ya no está disponible',
  libraryGoneHint:       'Quizá lo retiró quien lo publicó.',
  libraryOpen:           'Abrir',
  libraryFollow:         'Seguir',
  libraryPublish:        'Publicar en la biblioteca',
  libraryPublishHint:    'Otros estudiantes podrán encontrarlo y seguirlo.',
  libraryPublished:      'Este mazo está en la biblioteca.',
  libraryUnpublish:      'Quitar de la biblioteca',
  libraryMakeMine:       'Hacerlo mío',
  libraryMakeMineConfirm: 'Esto crea tu propia copia editable del mazo, con el progreso que ya llevas. Dejas de seguir el original.',
  libraryUnfollow:       'Dejar de seguir',
  libraryUnfollowConfirm: 'El mazo sale de tu estante. Tu progreso se conserva: si vuelves a seguirlo, continúas donde lo dejaste.',
  libraryRemove:         'Quitar',
  libraryRemoveConfirm:  'El mazo sale de tu estante para siempre. Haz antes tu propia copia si quieres conservarlo.',
  libraryWithdrawn:      'Retirado.',
  libraryWithdrawnHint:  ' Quien lo publicó ha eliminado este mazo. Durante un tiempo, aún puedes estudiarlo y hacer tu propia copia.',
  libraryDeleteFollowed: n => (n === 1
    ? '1 estudiante sigue este mazo. Eliminarlo también lo quita de su estante — se le avisará y tendrá un tiempo para copiarlo.'
    : `${n} estudiantes siguen este mazo. Eliminarlo también lo quita de sus estantes — se les avisará y tendrán un tiempo para copiarlo.`),
  libraryReport:         'Reportar',
  libraryReported:       'Reportado',
  libraryReportNote:     'Esto marca el mazo para su revisión. No se oculta nada automáticamente.',
  libraryReasonSpam:      'Spam o publicidad',
  libraryReasonOffensive: 'Contenido ofensivo',
  libraryReasonWrong:     'Japonés incorrecto',
  libraryReasonCopyright: 'Copiado sin permiso',
  libraryReasonOther:     'Otra cosa',
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
  examTitle: 'Examen de prueba',
  examDesc: 'Exámenes completos, cronometrados y puntuados\nVocabulario, gramática, lectura, comprensión auditiva\nCon el formato oficial del JLPT — puntuación no oficial',
  examQuestions: 'preguntas',
  examNoneAvailable: 'Aún no hay exámenes disponibles.',

  // ── Paper kinds ──
  // The four generators (backend/study/exam_*_gen.py), named in the
  // reader's own language with the Japanese kept alongside as the
  // specimen line — the picker used to show only "N5 語彙", which told
  // a beginner nothing about what was behind the card.
  examKindVocab: 'Vocabulario',
  examKindGrammar: 'Gramática',
  examKindReading: 'Lectura',
  examKindListening: 'Comprensión auditiva',
  examNotGeneratedYet: 'Se redacta la primera vez que lo abres',
  examGenerating: 'Redactando tu examen…',
  examGeneratingHint: 'Solo se redacta un examen nuevo cuando no queda ninguno que no hayas hecho ya — tarda uno o dos minutos. Una vez escrito, carga al instante, para ti y para todos.',
  examLoadFailed: 'Este examen no se pudo generar por ahora.',
  examLoadFailedHint: 'Puede que el redactor de preguntas no esté disponible ahora. Vuelve a intentarlo en un momento.',
  // Shown instead of examLoadFailedHint (and instead of the retry
  // button) while the server is refusing new attempts: a paper that
  // just failed costs minutes and dozens of model calls to retry, so
  // the wait is deliberate rather than something to click through.
  examLoadFailedCooldown: (minutes) =>
    `El redactor de preguntas se toma un descanso tras un intento fallido. Vuelve a intentarlo dentro de ${minutes} minuto${minutes === 1 ? '' : 's'}, más o menos.`,
  examRetry: 'Reintentar',

  examSectionEmpty: 'Esta sección aún no tiene preguntas.',
  examFinishSection: 'Terminar',
  examQuestionAbbrev: 'P',
  examResultMissing: 'Este resultado no está disponible — vuelve a empezar el examen.',
  examBackToExams: 'Volver a los exámenes',
  // The picker's per-paper secondary action, and the primary action on
  // the result screen. Both ask for a DIFFERENT paper rather than the
  // same one again — see backend/study/exam_schema.py on revisions.
  examFreshPaper: 'Otro examen',
  examFreshPaperHint: 'Cambia este examen por otro. Si nadie ha escrito uno todavía, tarda uno o dos minutos.',
  examNewPaper: 'Nuevo examen',
  examStarHint: '¿Qué pieza va en la posición marcada con la estrella?',
  examFullSentence: 'Frase completa:',
  examAudioPending: 'El audio de esta pregunta aún no se ha generado.',
  examAudioUnavailable: 'No se pudo cargar el audio de esta pregunta.',

  // ── Result ──
  // Never call this a JLPT score. The real one is an IRT-scaled 尺度得点
  // computed from official item parameters no third party has, so the
  // honest thing to show is raw proportion correct plus a practice
  // target — and to say plainly that that is what it is.
  examPracticeTarget: 'Objetivo',
  // The line the score's bar lands on (plan 254): the target met, or how
  // many more right answers it wanted.
  examTargetReached: 'Objetivo alcanzado',
  examTargetShort: n => `A ${n} ${n > 1 ? 'respuestas' : 'respuesta'} del objetivo`,
  // Wrong answers are what a review is for, so that's what opens by
  // default — a 21-question paper otherwise lists 21 identical rows to
  // click through before finding the two that went wrong.
  examShowAll: 'Todas las preguntas',
  examAllCorrect: 'Ningún fallo — todas las preguntas correctas.',
  // Colour alone can't carry which row was picked and which was right
  // (they're the same row on a correct answer, and ~8% of learners
  // can't separate the two hues), so both are said in words.
  examYourAnswer: 'Tu respuesta',
  examCorrectAnswer: 'Respuesta correcta',
  examNotAnswered: 'En blanco',
  // The listening script ships inside every paper already (see
  // exam_listening_gen.py) and is exactly what makes a missed
  // listening question learnable — withheld during the exam, offered
  // in review.
  examTranscript: 'Transcripción',
  // The study under a reviewed question (exam/ExamStudy.jsx): its
  // sentence and choices translated, and the sentence's breakdown.
  examStudyOpen: 'Traducción y desglose',
  examStudyHide: 'Ocultar traducción',
  examStudyFailed: 'La traducción no está disponible ahora. Inténtalo de nuevo en breve.',
  examStudyRetry: 'Reintentar',
  examStudySentence: 'La frase',
  examStudyChoices: 'Las opciones',
  examStudyPassage: 'El texto',
  examStudyNoWord: 'no es una palabra',

  // ── Answer sheet ──
  // The numbered grid under the question. Named for the real thing it
  // stands in for: on a paper JLPT the answer sheet is what tells you
  // at a glance what you still owe.
  examSheetTitle: 'Hoja de respuestas',
  // aria-label for one chip — the visual states (fill, outline, corner
  // mark) are meaningless to a screen reader, so each chip spells out
  // its own.
  examSheetChip: (n, answered, flagged) =>
    `Pregunta ${n}, ${answered ? 'respondida' : 'en blanco'}${flagged ? ', marcada' : ''}`,
  examFlag: 'Marcar para revisar',
  examUnflag: 'Quitar la marca',

  // ── Finishing ──
  // Submitting with blanks scores them wrong, so it asks first and
  // says how many — and offers to go to them rather than only offering
  // to go through with it.
  examConfirmTitle: '¿Terminar con preguntas sin responder?',
  examConfirmBody: (n) =>
    `${n} pregunta${n === 1 ? ' sigue' : 's siguen'} en blanco. Las respuestas en blanco cuentan como incorrectas.`,
  examReviewBlanks: 'Ir a la primera en blanco',
  examSubmitAnyway: 'Terminar de todos modos',
  examKeepGoing: 'Seguir respondiendo',
  // A failed submit used to strand a finished exam with no message and
  // no way out. The draft is kept until the POST succeeds, so a retry
  // is genuinely a retry.
  examSubmitFailed: 'No se pudieron enviar tus respuestas — tu progreso está a salvo.',
  examSubmitRetry: 'Reintentar el envío',
  examSubmitting: 'Enviando…',

  // ── Leaving mid-exam ──
  examLeaveTitle: '¿Salir de este examen?',
  examLeaveBody: 'Tus respuestas y el reloj quedan guardados — al volver a abrir este examen, sigues donde lo dejaste.',
  examLeaveConfirm: 'Salir',
  examLeaveStay: 'Quedarme',

  // ── Per-question chrome ──
  // The mondai instructions are identical for every question inside a
  // mondai, so they open on the first one and collapse behind this
  // afterwards rather than re-reading the same four lines of kana each
  // time.
  examShowInstructions: 'Mostrar instrucciones',
  examHideInstructions: 'Ocultar instrucciones',
  // Announced, not just coloured — a learner who isn't watching the
  // corner gets no warning at all today.
  examTimeWarning: (minutes) =>
    `${minutes === 1 ? 'Queda' : 'Quedan'} ${minutes} minuto${minutes === 1 ? '' : 's'}.`,

  // ── Audio player ──
  examAudioPlay: 'Reproducir',
  examAudioPause: 'Pausa',
  examAudioReplay: 'Reproducir desde el principio',
  examAudioPlayed: (n) => `Escuchado ${n}×`,
  examAudioProgress: 'Posición del audio',
}

// ── みどりの窓口 — onboarding ──────────────────────────────
// ── 乗車 — the boarding (plan 075) ──────────────────────────
// The canvas's boarding: Welcome → name → why → the kana check → (the
// reveal | the level) → goal → rhythm → the hour → the nudge →
// building → the plan → the pass. The interface speaks the learner's
// language; the kana, the cards and the seal are content and stay
// Japanese (components/boarding/*, screens/BoardingFlow.jsx).
const boarding = {
  authFoot: 'Todo se puede cambiar más tarde en Ajustes.',
  authModeAria: 'Iniciar sesión o registrarse',
  brdDocumentTitle: 'Embarque',
  // Welcome: the sign, the rolling stock, the promise.
  brdTagline: 'Un trayecto hecho a tu medida.',
  brdBoard: 'Embarcar',
  // 辻 (plan 163): the desk's front door, its corner and the way back to it.
  brdHaveAccountQ: '¿Ya tienes cuenta?',
  brdNoAccountYet: '¿Aún no tienes cuenta?',
  brdBackHome: 'Volver al inicio',
  // Google: "continue", never "sign up" or "sign in" — a provider does
  // not tell the two apart. You simply arrive.
  continueWithGoogle: 'Continuar con Google',
  orWithEmail: 'o con un correo electrónico',
  // 改札 — a round trip that came back refused (lib/authRedirect.js).
  // Both name what happened rather than "something went wrong": on the
  // web these are read off the URL after the page has already been to
  // Google and back, and a learner who has just done that is owed the
  // reason, not a shrug.
  oauthAlreadyLinked: 'Esa cuenta de Google ya pertenece a otro pase.',
  oauthSignInInstead: 'Iniciar sesión con esa cuenta de Google',
  nativeReturnNote: 'Sesión iniciada. Volviendo a la app…',
  nativeReturnOpen: 'Abrir Tsuji',
  oauthLinkingOff: 'Ahora mismo no se puede añadir Google a este pase. Un correo electrónico, sí.',
  // 本乗車券 — putting an address on the pass (lib/guest.js). Same
  // rule as the two above: name what happened, and name the road that
  // is still open. Supabase's own sentences are developers' English,
  // and on the claim one of them quotes an empty address instead of
  // the one in the field — see lib/authErrors.js.
  claimEmailTaken: 'Esa dirección ya tiene un pase. Inicia sesión con ella.',
  claimEmailUnreachable: 'No se pudo enviar la confirmación a esa dirección. Prueba con otra o guarda tu progreso con Google.',
  claimWeakPassword: 'Esa contraseña es demasiado fácil de adivinar. Prueba con una más larga.',
  claimTooSoon: 'Demasiados intentos ahora mismo. Espera un minuto y vuelve a intentarlo.',
  // A guest's account, kept from Settings › Account: the progress
  // already exists, this only puts a key on it (lib/guest.js).
  brdAccountCreate: 'Crear mi cuenta',
  // The card (plan 247): the credits it is issued with, on its back,
  // and the service named on the rhythm's sheet.
  brdCreditsOffered: 'créditos de regalo',
  brdTermService: 'Servicio',
  // The Welcome: each demo's tag.
  brdDemoTag: { kanji: 'Kanji', vocab: 'Vocabulario', grammar: 'Gramática', dictation: 'Dictado', reading: 'Lectura', kana: 'Kana', translation: 'Traducción', analyzer: 'Analizador', exam: 'Examen de prueba' },
  // The questions.
  brdKanaQ: '¿Sabes leer esto?',
  brdKana: { hiragana: 'Hiragana', katakana: 'Katakana', both: 'Ambos', none: 'Todavía no' },
  brdKanaWord: { sushi: 'sushi', hotel: 'hotel', station: 'estación' },
  brdRevealQ: 'Pronto leerás los dos.',
  // 辻 (plan 163): the desk's kana question and reveal, drawn as the
  // owner's D03 -- each answer says what it reads, then its name.
  brdKanaHint: 'Elige lo que ya sabes leer.',
  brdKanaOnly: (jp) => `Solo ${jp}`,
  brdKanaSays: { hiragana: 'Los hiragana', katakana: 'Los katakana', both: 'Hiragana y katakana', none: 'Empezamos por ahí' },
  brdRevealLead: 'Dos escrituras de 46 signos cada una. Así se leen estas dos palabras.',
  brdRevealKanji: 'Kanji',
  brdRevealLater: 'Más adelante, palabra a palabra.',
  brdRevealMeans: 'significa',
  brdRevealWord: (word) => `«${word}»`,
  brdRevealFirst: (date, min) => `Tu primera parada: **los kana**, leídos para el **${date}** a ${min} min al día.`,
  brdLevelQ: '¡Genial! ¿Cuál es tu nivel?',
  brdLevelHint: 'Las paradas anteriores se marcarán como conocidas.',
  brdTestQ: 'Busquemos tu parada',
  brdTestPick: 'La elijo yo',
  brdPlacedQ: level => `Tus respuestas se detienen en ${level}`,
  brdNovice: 'Principiante',
  // The kanji figure is the app's own count through that stop (~, rounded).
  brdLevelDesc: {
    novice: 'Kana y algunas palabras',
    N5: (k) => `Frases sencillas · ~${k} kanji`,
    N4: (k) => `Conversación cotidiana · ~${k} kanji`,
    N3: (k) => `La vida diaria con soltura · ~${k} kanji`,
    N2: (k) => `Noticias y trabajo · ~${k} kanji`,
    N1: (k) => `Casi todo · ~${k} kanji`,
  },
  // The lines: what to learn. The kana are not a row -- every ticket
  // rides them -- so the lines' sheet says so (components/boarding/CardSheets.jsx).
  brdLinesNone: 'Elige al menos una línea.',
  brdLine: { vocab: 'Vocabulario', kanji: 'Kanji', grammar: 'Gramática' },
  // 入門 (plan 170): when the lines start, for a learner short of
  // both scripts.
  brdLinesHintNovice: 'Empiezan después de los kana.',
  // The lines' sheet: the kana's strip and what each line carries on
  // the ride to its goal.
  brdOnEveryTicket: 'En cada billete',
  brdLineCarries: {
    vocab: (stop) => `palabras hasta ${stop}`,
    kanji: (stop) => `kanji hasta ${stop}`,
    grammar: (stop) => `puntos hasta ${stop}`,
  },
  brdLinesArrive: (n, stop, date) => `${n === 1 ? 'Con esta línea' : n === 2 ? 'Con estas dos líneas' : 'Con estas tres líneas'}, llegas a ${stop} en **${date}**.`,
  // The rhythm's departure board: a train's minutes and its service,
  // and the days its ride takes; the hour's board.
  brdADay: 'al día',
  brdRhythmName: { 5: 'Local', 10: 'Rápido', 15: 'Rápido especial', 20: 'Expreso' },
  brdRideDays: (n) => (n === 1 ? '1 día' : `${n} días`),
  brdNewItems: (n) => `~${n} novedades`,
  brdDeparture: 'Salida',
  brdDayAria: 'Hora de salida',
  // The notification as the app sends it. brdAppName is the store
  // name, the one the notification header shows; keep it in step with
  // capacitor.config.json's appName.
  brdAppName: 'Tsuji',
  brdNotifText: 'Tus tarjetas te esperan en el torniquete.',
  // ── 発車案内 — the daily nudge from the day's queue, the widget and
  // Settings › Notifications (plan 156). The nudge's title and body are
  // written from what the gate will hold at the learner's hour.
  nudgeTitle: (time, n) => `Tu tren de las ${time} · ${n} ${n === 1 ? 'tarjeta' : 'tarjetas'}`,
  nudgeMinutes: (m) => (m <= 1 ? 'Cerca de un minuto' : `Unos ${m} min`),
  nudgeNew: (n) => `${n} ${n === 1 ? 'nueva' : 'nuevas'}`,
  // The reminders' channel, as Android's settings name it (lib/native.js).
  nudgeChannel: 'Recordatorios',
  nudgeLine: { kana: 'Kana', vocab: 'Vocabulario', kanji: 'Kanji', grammar: 'Gramática' },
  nudgeWhen: { today: 'Hoy', tomorrow: 'Mañana' },
  widgetTitle: 'Tu tren de hoy',
  widgetUnit: (n) => (n === 1 ? 'tarjeta' : 'tarjetas'),
  widgetMinutes: (m) => `${m} min`,
  widgetClear: 'Vía libre',
  settingsNotif: 'Notificaciones',
  notifOff: 'Desactivadas',
  notifDaily: 'El tren del día',
  notifDailyCap: 'Uno al día',
  notifRemind: 'Recuérdamelo',
  notifOnOff: { on: 'Sí', off: 'No' },
  notifRule: 'Solo los días con tarjetas pendientes, y nunca una vez hecho tu trayecto.',
  notifNoHour: 'Elige una hora de salida para recibir el recordatorio.',
  notifDenied: 'Las notificaciones de Tsuji están desactivadas en los ajustes de tu teléfono.',
  notifQuiet: 'Nada pendiente a tu hora esta semana: ningún tren que anunciar.',
  notifNextAria: 'El próximo recordatorio',
  notifFailed: 'No se pudo calcular el próximo recordatorio.',
  notifWidget: 'El widget',
  notifWidgetCap: { ios: 'Pantalla de bloqueo', android: 'Pantalla de inicio' },
  notifWidgetHow: {
    ios: 'Mantén presionada la pantalla de bloqueo, toca Personalizar y añade Tsuji.',
    android: 'Mantén presionada la pantalla de inicio, toca Widgets y arrastra Tsuji hasta ella.',
  },
  notifWidgetWhat: 'Muestra las tarjetas del día y una palabra que conoces, nunca una pendiente esta semana.',
  // 時間割 (plan 181): the week's agenda.
  settingsAgenda: 'Horario',
  agdRowEmpty: 'Sin bloques',
  agdRowValue: (n) => `${n} ${n === 1 ? 'bloque' : 'bloques'}`,
  agdEveryDay: 'Todos los días',
  agdWeek: 'Mi semana',
  agdWeekAria: 'Tu semana, día a día',
  agdEmpty: 'Planifica tu semana: un bloque por materia, y Tsuji te avisa cuando empieza.',
  agdAdd: 'Añadir un bloque',
  agdNew: 'Nuevo bloque',
  agdEdit: 'Editar bloque',
  agdNow: 'Ahora',
  agdSubject: 'Materia',
  agdDays: 'Días',
  agdFrom: 'De',
  agdTo: 'A',
  agdPresets: { weekdays: 'Entre semana', weekend: 'Fin de semana', all: 'Todos los días' },
  agdRemind: 'Recordatorio',
  agdLeadLabel: 'Avisarme',
  agdLead: (m) => (m === 0 ? 'A la hora' : `${m} min antes`),
  agdBell: (m) => (m === 0 ? 'A la hora' : `${m} min antes`),
  agdNoBell: 'Sin recordatorio',
  agdSave: 'Guardar',
  agdDelete: 'Eliminar',
  agdProblem: {
    days: 'Elige al menos un día.',
    time: 'Elige una hora de inicio y una de fin.',
    length: 'Un bloque dura al menos 15 minutos.',
  },
  agdClash: (name, days, from, to) => `Este bloque se superpone con ${name} (${days}, ${from}–${to}).`,
  agdSaveFailed: 'No se pudo guardar el bloque. Inténtalo de nuevo.',
  agdLoadFailed: 'No se pudo cargar tu horario.',
  agdWebNote: 'Los recordatorios llegan en la app móvil: en la web, el horario es solo una guía.',
  agdDenied: 'Las notificaciones de Tsuji están desactivadas en los ajustes de tu teléfono, así que los bloques no anunciarán nada.',
  agdBlockAria: (name, day, from, to) => `${name}, ${day} de ${from} a ${to}`,
  agdNotifTitle: (name, lead) => (lead === 0 ? `${name} empieza ahora` : `${name} en ${lead} min`),
  agdNotifBody: (from, to, lead) => (lead === 0 ? `${from}–${to}` : `A las ${from}, hasta las ${to}`),
  agdSubjectName: {
    review: 'Repasos', kana: 'Kana', vocab: 'Vocabulario', kanji: 'Kanji', grammar: 'Gramática',
    reading: 'Lectura', translation: 'Traducción', dictation: 'Dictado', composition: 'Redacción',
    conversation: 'Conversación', comprehension: 'Comprensión', exam: 'Examen de prueba',
  },
  agdGo: 'Empezar',
  agdUntil: (end) => `hasta las ${end}`,
  agdDayEmpty: (day) => `Nada previsto el ${day}.`,
  agdAddOn: (day) => `Añadir el ${day}`,
  agdDuration: (h, m) => (h && m ? `${h} h ${m} min` : h ? `${h} h` : `${m} min`),
  agdLasts: (d) => `Dura ${d}`,
  agdLeadCaption: 'minutos antes del inicio',
  agdDayAria: (day, n) => `${day}, ${n} ${n === 1 ? 'bloque' : 'bloques'}`,
  agdHoursAria: 'Horas del día',
  agdProgressAria: (name) => `${name}, tiempo transcurrido`,
  agdThen: 'Después',
  agdStartWith: 'Para empezar',
  agdWeekTotalLabel: 'Por semana',
  // 机 (plan 140): the desk's column, its name for a screen reader and
  // its stops, one per question -- the part of the boarding each
  // answers, as the line prints it.
  brdBuildingAria: 'Preparando tu trayecto',
  brdStop: { kana: 'Kana', level: 'Nivel', card: 'Pase' },
  // The first ride's end (screens/RideReading.jsx).
  brdEnter: 'Entrar en la estación',
  // 辻 on a phone (plan 168): the kana over the lines' hub, the board's
  // arrival column and first stop, the hour's arrows and first train.
  brdKanaFirstShort: 'Los kana, primero',
  brdArriveAt: (stop) => `Llegada a ${stop}`,
  brdFirstStop: (date) => `Primera parada: los kana, leídos para el **${date}**`,
  brdHourLater: 'Una hora más tarde',
  brdHourEarlier: 'Una hora antes',
  brdHalfLater: 'Media hora más tarde',
  brdHalfEarlier: 'Media hora antes',
  brdTrainAt: (today, time) => `Tu tren · ${today ? 'hoy' : 'mañana'}, **${time}**, y luego cada día`,
  // The card is the form (plan 247): the card filled in, its fields
  // doors, a sheet a field.
  brdCardQ: 'Tu pase, ya completado.',
  brdCardHint: 'Toca un campo para cambiarlo.',
  brdIssue: 'Emitir mi pase',
  brdLevelTest: '¿Dudas? La prueba te ubica',
  brdKeepDevice: 'Solo en este dispositivo',
  brdKeepGo: 'Guardar mi pase',
  brdKeepSent: (email) => `Enlace enviado a ${email}`,
  brdKeepChange: 'Cambiar',
  brdKeptGoogle: 'Guardado en tu cuenta de Google',
  brdKeptEmail: (email) => `Guardado · ${email}`,
  brdKeptAccount: 'Guardado en tu cuenta',
  brdKeptSwitch: 'Cambiar de cuenta',
  brdSheetGoal: 'Destino',
  brdSheetRhythm: 'Ritmo',
  brdSheetHour: 'Salida',
  brdSheetLines: 'Líneas',
  brdSheetName: 'Nombre',
  brdSheetAccount: 'Cuenta',
  brdSheetDone: 'Hecho',
  // The list under the card (plan 247): each field in words, a door to
  // the same sheet as the card's own.
  brdRowsAria: 'Cambiar tu pase',
  brdRowGoal: (stop, date) => (date ? `${stop} · llegada el ${date}` : stop),
  brdRowRhythm: (name, min) => `${name} · ${min} min al día`,
  brdGoalCap: (min) => `a ${min} min al día`,
  brdNameOptional: 'Opcional',
  brdNamePlaceholder: 'Tu nombre',
  brdNameNote: 'Se imprime en tu pase. En letras latinas, también es tu nombre público en la clasificación.',
  brdNameSave: 'Guardar',
  cardNameTooLong: (n) => `${n} caracteres como máximo.`,
  brdAccountLede: 'Sin cuenta, tu pase solo vive en este dispositivo.',
  brdLater: 'Más tarde',
  // Plan 270: the account sheet, raised to ask before the card issues and on
  // Today; an address and a password typed twice, no mail to follow.
  brdStayGuest: 'Seguir sin cuenta',
  brdAccountAsk: 'Crea tu cuenta para encontrar tu pase y tu progreso en cualquier dispositivo.',
  brdPasswordNew: (min) => `Contraseña (al menos ${min} caracteres)`,
  brdPasswordAgain: 'Confirma la contraseña',
  brdPasswordMismatch: 'Las dos contraseñas no coinciden.',
  brdAccountSentNote: (email) => `Casi: confirma ${email} desde el enlace que acabamos de enviarte.`,
  brdRemindAt: (time) => `Recuérdamelo a las **${time}**`,
  brdAgendaAdd: 'Añadir a mi calendario',
  brdAgendaTitle: 'Tsuji · tu tren de japonés',
  brdAgendaBody: (min) => `${min} min de japonés, cada día.`,
  // Boarding inside another app's browser (lib/inAppBrowser.js): a card
  // made there stays there.
  brdSheetOutside: 'Navegador',
  brdOutsideLede: (app) => `Un pase creado dentro de ${app} se queda en ${app}: tu navegador no lo verá.`,
  brdOutsideMenu: 'O usa el menú ⋯ de arriba para abrir esta página en tu navegador.',
  brdOutsideSafari: 'Abrir en Safari',
  brdOutsideChrome: 'Abrir en Chrome',
  brdOutsideStay: (app) => `Quedarme en ${app}`,
}

const ride = {
  // 試乗 — the test ride (plan 098): the first two cards, on the real
  // stage. One sentence per step, beside the thing it is about; the
  // pair names the place (the stage head), the notes do not repeat it.
  rideDocumentTitle: 'Trayecto de prueba',
  rideJp: '試乗',
  rideCap: 'Trayecto de prueba',
  rideSkip: 'Saltar',
  rideKnownFront: 'Aquí tienes tu primera tarjeta. Tócala para darle la vuelta.',
  rideKnownBack: '¿La sabías? Con sinceridad: te calificas tú.',
  rideUnknownFront: 'Esta es nueva para ti. Dale la vuelta.',
  rideUnknownBack: 'Elige «Fallado». No es un fracaso: la tarjeta solo vuelve antes. Ese es todo el truco.',
  // 机 (plan 115): the same notes, teaching the desk's keys.
  rideKnownFrontDesk: 'Aquí tienes tu primera tarjeta. Haz clic en ella o presiona Espacio para darle la vuelta.',
  rideKnownBackDesk: '¿La sabías? Con sinceridad: te calificas tú, en la barra o con las teclas numéricas.',
  rideUnknownFrontDesk: 'Esta es nueva para ti. Dale la vuelta: clic o Espacio.',
  rideUnknownBackDesk: 'Elige «Fallado», en la barra o con su tecla. No es un fracaso: la tarjeta solo vuelve antes. Ese es todo el truco.',
  rideGuessed: '¿Acertaste la nueva? Si fue por suerte, elige «Fallado» la próxima vez, o no volverá en días.',
  rideDoneBody: n => `¡Eso es todo! **${n} palabras nuevas al día**, cada una de vuelta justo antes de que la olvides.`,
  rideContinue: 'Continuar',
  // The reading ride (plan 099): the sentence, the field, the measure,
  // then the plate that says which platforms ride on the pass.
  rideReadFront: '¡Léela rápido! Desaparece en un momento.',
  rideReadFrontUntimed: 'Léela y luego escríbela en romaji o kana.',
  rideReadType: 'Escribe lo que has leído, en romaji o kana.',
  rideReadMeasure: 'La puntuación muestra cuánto has captado. Ahora califícate.',
  rideReadMeasureDesk: 'La puntuación muestra cuánto has captado. Ahora califícate: en la barra o con las teclas numéricas.',
  // Plan 133. On a phone: the known card is not graded until its entry
  // has been opened from the 🔍 and closed again.
  rideKnownDict: 'Cada tarjeta tiene su entrada de diccionario. Toca 🔍 para abrir esta y luego ciérrala.',
  ridePlateCap: 'El pase',
  ridePlateBody: 'Estos modos de práctica vienen con el pase.',
  ridePlateOpen: 'Por ahora son gratis para todos.',
}

const guide = {
  // 案内 — the guide over each gate (plan 100): one sentence a stop,
  // beside the thing it is about. The note carried a Japanese eyebrow
  // naming the stop until 2026-09-21; the sentence is the note now.
  guideLabel: 'Guía',
  guideNext: 'Siguiente',
  guideDone: 'Hecho',
  guideSkip: 'Saltar',
  // The desk rail's Help: the lit gate's guide, played again on demand.
  guideHelp: 'Ayuda',
  guideHelpTour: gate => `Visita guiada: ${gate}`,
  guideTodayGate: 'Tus repasos de hoy y el tiempo que llevan. Ajustar elige las tarjetas y las líneas; luego, embarca.',
  guideTabBar: 'Tus cinco pestañas: Aprender, Práctica, Hoy, Diccionario y tu perfil.',
  guideTodayDuels: 'Duelos: dos minutos contra un amigo o un viajero de tu nivel. Un número dorado indica que te espera un reto.',
  guideLearnPlate: 'Una línea. Tócala para abrirla. El indicador muestra lo pendiente de hoy.',
  guideLearnStops: 'Dónde estás en la línea, y las paradas a tu alrededor.',
  guideLearnShelf: 'Tus propios mazos, y una biblioteca de mazos compartidos por otros estudiantes.',
  guidePracticePass: 'Estos modos vienen con el pase.',
  // Practice's plates (plan 254): a platform, its foot (your level,
  // what you did there) and the mock exam.
  guidePracticePlate: 'Un modo de práctica: leer, entender, traducir, escuchar, escribir o conversar. Tócalo para abrirlo a tu nivel.',
  guidePracticeStops: 'Tu nivel, con lo que has hecho en él y cuánto has acertado.',
  guidePracticeExam: 'El examen de prueba: un test al estilo del JLPT en el nivel que elijas, corregido al entregarlo.',
  guideDictConsole: 'Busca por palabra, lectura o significado.',
  guideDictOptions: 'Afina tu búsqueda: palabra exacta, empieza por o contiene. Busca en el japonés, el significado o ambos.',
  guideDictChips: 'Explora por colección. Tus entradas guardadas están al final.',
  guideDictEntry: 'Toca una entrada para abrirla. Su ＋ la guarda o la añade a uno de tus mazos.',
  guideDictAnalyzer: 'El analizador: pega, fotografía o graba cualquier texto en japonés y velo desglosado.',
  guideProfilePass: 'Tu pase: tu nombre, tu nivel y tu saldo.',
  guideProfileStamps: 'Tu tarjeta de sellos: un sello por cada día que estudias.',
  guideProfileRecords: 'Tus cifras: repasos totales, lo que recuerdas, tu mejor serie sin fallos.',
  guideProfileLedger: 'Cada línea, y cuánto has avanzado.',
  guideProfileSettings: 'Ajustes: tu nivel, tu ritmo, cómo te calificas, y esta guía cuando quieras.',
  guideLearnLibrary: 'La biblioteca: mazos compartidos por otros estudiantes. Abre uno para verlo; síguelo para estudiarlo.',
  guideDictActions: 'Escúchala, o usa ＋ para guardarla o añadirla a uno de tus mazos.',
  guideProfileStats: 'Estadísticas: lo que se queda y lo que se escapa, línea por línea.',
  guideProfileBoard: 'La clasificación en XP: esta semana y desde siempre.',
  // 机 (plan 115): the notes that teach the desk's keys and doors.
  guideTabBarDesk: 'Tus cinco secciones, a la izquierda. Presiona / en cualquier lugar para buscar en el diccionario.',
  guideTodayGateDesk: 'Tus repasos de hoy y el tiempo que llevan. Elige a la derecha las tarjetas y las líneas, y luego embarca. Enter funciona desde cualquier punto de esta pantalla.',
  guideLearnStopsDesk: 'Toda la línea. Haz clic en una parada para estudiarla.',
  // Worded for a pointer (plan 123): the notes that said "tap".
  guideLearnPlateDesk: 'Una línea. Haz clic en ella para abrirla. El indicador muestra lo pendiente de hoy.',
  // Practice's plates on the desk (plans 165, 254): each carries its exercise.
  guidePracticePlateDesk: 'Un modo de práctica, y lo que te pide a tu nivel. Haz clic en él para abrirlo.',
  guideDictEntryDesk: 'Una entrada, abierta junto a la lista. ← y → recorren la lista.',
  // 机 (plan 248): on the desk the stamp book's figures open the profile's record.
  guideProfileRecordsDesk: 'Tus cifras: tu racha y la más larga, los días sellados, los repasos totales, lo que recuerdas, tu mejor serie sin fallos.',
  // Settings, the two ways back.
  settingsFirstRide: 'Primer trayecto',
  settingsRideAgain: 'Repetir el trayecto de prueba',
  settingsIntroAgain: 'Ver de nuevo la introducción',
  settingsGuideAgain: 'Mostrar de nuevo la guía',
  settingsGuideAgainDone: 'Volverá a aparecer la próxima vez que abras cada sección.',
}

const onboarding = {
  durDays: (n) => `${n} ${n === 1 ? 'día' : 'días'}`,
  durMonths: (n) => `${n} ${n === 1 ? 'mes' : 'meses'}`,
  durYears: (n) => `${n} ${n === 1 ? 'año' : 'años'}`,
  onbContinue: 'Continuar',
  onbStepsAria: (n, total) => `Paso ${n} de ${total}`,
  onbTestKind: {
    reading: '¿Cómo se lee esta palabra?',
    orthography: '¿Cuál es la escritura correcta en kanji?',
    context: '¿Qué palabra completa la frase?',
    grammar: '¿Qué regla gramatical está en juego?',
  },
  onbTestStop: '¿Muy difícil? Lo dejo aquí',
  onbClimbLabel: 'Niveles: superados, en curso, por venir',
  onbTestError: 'No se pudo cargar la prueba. Inténtalo de nuevo en un momento.',
  onbTestRetake: 'Hacer la prueba',
  onbTestResult: (level, correct, total) => `${correct} de ${total} correctas — te recomendamos embarcar en ${level}.`,
  onbPaceRecommended: 'Recomendado',
  onbPassError: 'No se pudo guardar — revisa tu conexión e inténtalo de nuevo.',
  // The other half of a failed save: the office ANSWERED and refused
  // it. Sending the learner to check a connection that is plainly
  // working is a wrong turn they cannot take -- and "try again" is a
  // false promise, since the same contract earns the same refusal.
  brdPassRefused: 'La taquilla no pudo emitir este pase — el fallo es nuestro, no de tu conexión. No se guardó nada.',
  brdPassBusy: 'La taquilla no responde ahora mismo. No se guardó nada: inténtalo de nuevo en un momento.',
  // The daily pace, lived: the concourse 新規 gauge and the study
  // screens' session terminus (see components/study/usePace.js).
  paceDoneTitle: 'Objetivo de hoy alcanzado',
  paceDoneOf: target => `de ${target}`,
  paceDoneLabel: 'tarjetas nuevas hoy',
  paceDoneBody: 'Esa es tu ración de tarjetas nuevas de hoy. Los repasos siguen como siempre.',
  paceExtraTrain: 'Más tarjetas nuevas',
  paceGaugeLabel: 'Elementos nuevos',
  paceGaugeAria: (n, target) => `${n} de ${target} elementos nuevos aprendidos hoy`,
  settingsLearning: 'Aprendizaje',
  settingsJlptLevel: 'Nivel JLPT',
  settingsPace: 'Ritmo diario',
  // The lines to ride (backend core/lines.py): the Learn gate hangs
  // these first and the plan is priced at them. The kana are not a
  // toggle -- every ticket rides them.
  settingsLines: 'Tus líneas',
  settingsLinesCap: 'Lo que aprendes',
  settingsLinesHint: 'Los kana van en todos los billetes. Al menos una línea sigue activa.',
  settingsLineOn: 'En tu ruta',
  settingsLineOff: 'Fuera de tu ruta',
  plateOffRoute: 'Fuera de tu ruta',
  // A grade's record on a Practice platform (plan 130; at the foot of
  // its plate on the phone since plan 254): what was done at that grade,
  // then the share of it that went right.
  practiceDone: {
    sentences: n => `${n} frase${n === 1 ? '' : 's'}`,
    texts: n => `${n} texto${n === 1 ? '' : 's'}`,
    papers: n => `${n} prueba${n === 1 ? '' : 's'}`,
    replies: n => `${n} respuesta${n === 1 ? '' : 's'}`,
  },
  practiceRight: pct => `${pct}% de aciertos`,
  practiceNotYet: 'Aún no',
  // The phone's Practice gate (plan 290): the modes in three groups,
  // the last ride to resume, and the sheet a plate raises, a page a mode.
  practiceGroups: { understand: 'Comprender', express: 'Expresarse', test: 'Ponerse a prueba' },
  practiceResume: 'Retomar',
  practiceSheet: 'Modos de práctica',
  practicePct: pct => `${pct}%`,
  practiceAllPapers: 'Todas las pruebas',
  practiceAllScenes: 'Todas las escenas',
  // ── A practice station, on the desk (plan 159) ────────────────
  // The source as a switch at the list's head (the JLPT grades, word
  // frequency, your own cards), then the open stop's page: what the
  // exercise asks, its shape, four figures, your latest misses and the
  // grade's points.
  practiceSourceFrequency: 'Frecuencia',
  practiceHow: {
    reading: 'Lee la frase antes de que el reloj la tape y escribe su lectura en rōmaji.',
    translation: 'Una frase para decir en japonés, luego una respuesta de referencia y la opinión del tutor sobre la tuya.',
    comprehension: 'Un texto breve y luego sus preguntas — la sección de lectura del examen, ensayada.',
    dictation: 'Dos escuchas, ni una más: escribe en rōmaji lo que oyes.',
    composition: 'Te dan un punto gramatical: escribe una frase que lo use y un tutor la revisa.',
    conversation: 'Alguien te habla en una escena: elige tu respuesta, escríbela o contesta libremente.',
    // On its plate, on the desk (plans 165, 254): the question its well
    // shows.
    exam: 'Una pregunta en formato JLPT, aquí 漢字読み: la lectura de la palabra subrayada.',
  },
  practiceBank: {
    sentences: n => `${n} frases escritas para el nivel.`,
    texts: n => `${n} preguntas por texto.`,
    clips: n => `${n} frases grabadas para el nivel.`,
    points: n => `${n} puntos para usar.`,
  },
  practiceSpecTag: {
    sentence: 'Una frase del nivel',
    text: 'Un texto del nivel',
    clip: 'Una frase del nivel, de oído',
    point: 'Un punto del nivel',
    paper: 'Una pregunta del nivel',
    scene: 'Una escena del nivel',
    tier: 'Palabras del tramo',
    mine: 'Tus palabras',
  },
  practiceFig: {
    sentences: 'Frases',
    texts: 'Textos',
    right: 'Aciertos',
    questions: 'Preguntas acertadas',
    words: 'Palabras del nivel',
    tierWords: 'Palabras del tramo vistas',
    met: 'Palabras vistas',
    last: 'Último trayecto',
  },
  practiceMisses: 'Tus frases falladas',
  practiceMissedPoints: 'Tus puntos fallados',
  practiceTexts: 'Tus textos',
  practiceNoMisses: 'Aún no has fallado ninguna frase.',
  practiceNoTexts: 'Aún no has leído ningún texto.',
  practicePoints: 'Los puntos del nivel',
  practiceTextPoints: 'Los puntos de los textos',
  practicePointsStudied: (n, of) => `${n} / ${of} estudiados`,
  practicePointStudied: 'estudiado',
  practiceTierTitle: (tier, from, to) => `Tramo ${tier} · palabras ${from} a ${to}`,
  practiceTierDesc: list => `Frases en torno a las palabras de este tramo (${list}), ordenadas por su frecuencia escrita.`,
  practiceTierWords: 'Las palabras del tramo',
  practiceTierSeen: (n, of) => `${n} / ${of} vistas`,
  practiceMineDesc: 'Frases en las que cada palabra es una que ya has visto.',
  practiceMineNote: 'Solo palabras que ya has visto',
  // The mock exam on the desk: each paper a row (plan 159).
  examGradeDesc: 'Cuatro pruebas en formato JLPT, cronometradas y puntuadas — puntuación no oficial.',
  examNext: label => `Siguiente · ${label}`,
  examLastScore: 'Tu última puntuación',
  // ── 模試 on a phone (plan 171) ──
  examGrade:           'Nivel',
  examNextPaper:       'Siguiente prueba',
  examThisPaper:       'Esta prueba',
  examToWrite:         'Por redactar',
  examMinutesShort: n => `${n} min`,
  examStart:           'Empezar',
  examPapers:          'Pruebas',
  examMinutesUnit:     'minutos',
  examPartsUnit: n => (n > 1 ? 'partes' : 'parte'),
  examCoverClock:      'El cronómetro arranca cuando empiezas.',
  examCoverBlank:      'Una pregunta en blanco cuenta como fallo: marca las que quieras volver a ver.',
  examSheetShort:      'Hoja',
  examPrevious:        'Anterior',
  examNextQuestion:    'Siguiente',
  examFinishPaper:     'Terminar la prueba',
  examAnsweredOf: (n, total) => `${n} / ${total} respondidas`,
  examBlanks: n => `${n} en blanco`,
  examAudioReplayShort: 'Repetir',
  examUnofficial:      'no oficial',
  examTimeOf: (time, limit) => `${time} de ${limit}`,
  examScoreAgainst: (pct, target) => `${pct}% frente a un objetivo del ${target}%`,
  examByPart:          'Parte por parte',
  examSeeAll:          'Ver todo',
  examMissesOnly:      'Solo errores',
  examTimeLabel:       'Tiempo',
  examMisses: n => `${n} ${n > 1 ? 'errores' : 'error'}`,
  examMondai: {
    '漢字読み': 'Lectura de kanji',
    '表記': 'Escritura en kanji',
    '語形成': 'Formación de palabras',
    '文脈規定': 'La palabra en contexto',
    '言い換え類義': 'Paráfrasis',
    '用法': 'Uso de la palabra',
    '文の文法1': 'Gramática de la frase',
    '文の文法2': 'Ordenar la frase',
    '文章の文法': 'Gramática del texto',
    '内容理解（短文）': 'Textos cortos',
    '内容理解（中文）': 'Textos medianos',
    '内容理解（長文）': 'Un texto largo',
    '統合理解': 'Textos para comparar',
    '主張理解（長文）': 'Un texto de opinión',
    '情報検索': 'Buscar información',
    '課題理解': 'Entender la tarea',
    'ポイント理解': 'Captar lo esencial',
    '概要理解': 'Captar la idea general',
    '発話表現': 'Qué decir',
    '即時応答': 'Respuesta rápida',
  },
  // What a part asks you to do, in plain words, in place of its Japanese instruction (plan 171).
  examMondaiHow: {
    '漢字読み': 'Elige cómo se lee la palabra subrayada.',
    '表記': 'Elige cómo se escribe en kanji la palabra subrayada.',
    '語形成': 'Elige lo que completa la palabra.',
    '文脈規定': 'Elige la palabra que va en el hueco.',
    '言い換え類義': 'Elige la frase de significado más cercano.',
    '用法': 'Elige la frase que usa bien la palabra.',
    '文の文法1': 'Elige lo que va en el hueco.',
    '文の文法2': 'Ordena las piezas y elige la que va en ★.',
    '文章の文法': 'Lee el texto y elige lo que va en cada hueco.',
    '内容理解（短文）': 'Lee el texto y responde a la pregunta.',
    '内容理解（中文）': 'Lee el texto y responde a la pregunta.',
    '内容理解（長文）': 'Lee el texto y responde a la pregunta.',
    '統合理解': 'Lee los dos textos y responde a la pregunta.',
    '主張理解（長文）': 'Lee el texto y responde a la pregunta.',
    '情報検索': 'Busca en el documento lo que pide la pregunta.',
    '課題理解': 'Escucha y elige lo que la persona tiene que hacer.',
    'ポイント理解': 'Lee la pregunta, escucha y elige la respuesta.',
    '概要理解': 'Escucha y elige lo que quiere decir quien habla.',
    '発話表現': 'Mira la situación y elige qué decir.',
    '即時応答': 'Escucha la frase y elige la mejor respuesta.',
  },
  examMinutes: n => `≈\u00a0${n}\u00a0min`,
  // ── The mock exam at a desk (plan 200) ───────────────────────
  // The booklet on the left, the answer sheet on the right; the page
  // turns in its foot.
  examQuit:            'Salir',
  examMark:            'Marcar',
  examToAnswer:        'por responder',
  examLastQuestion:    'Última pregunta',
  examThisText:        'Este texto',
  examLikeThePaper:    'Como en el examen',
  examYourSheet:       'Tu hoja',
  examBlanksLeft: n => `${n} pregunta${n > 1 ? 's' : ''} en blanco`,
  examBlankCounts:     'Una pregunta en blanco cuenta como fallo.',
  examGoTo: n => `Ir a la ${n}`,
  examHandIn:          'Entregar de todos modos',
  examMissOf: (i, n) => `error ${i} de ${n}`,
  examPapersSat:       'pruebas',
  examRightCap:        'aciertos',
  examLastSitting:     'la última',
  examSheetRow: (n, answered) => `Pregunta ${n}${answered ? '' : ', en blanco'}`,
  examOval: (n, choice) => `Pregunta ${n}, respuesta ${choice}`,
  examAnsweredCap:     'respondidas',
  examSheetResult: (n, state) => `Pregunta ${n}, ${state === 'ok' ? 'correcta' : state === 'x' ? 'incorrecta' : 'en blanco'}`,
  examPlayPause:       'reproducir, pausar',
  settingsRedoDesc: 'Repítela cuando hayas progresado — tu nivel avanza contigo.',
  // ── Which rating bar to grade with ──────────────────────────
  // Two buttons, four or six. All three send the same rating to the
  // scheduler — each shorter bar is a longer one with buttons left off
  // — so this changes what you are offered, never what your answers
  // mean.
  settingsRatingScale: 'Botones de calificación',
  settingsRatingScaleOption: { binary: '2 niveles', simple: '4 niveles', full: '6 niveles' },
  settingsRedoApply: (level) => `¿Pasar a ${level}?`,
  levelCurrentMark: 'Estás aquí',

  // ── 窓口 — settings as the service counter ─────────────────
  // The counter names, then each control's second voice: what the
  // button DOES, in plain words under its name — on a settings screen
  // nothing may need guessing.
  settingsEnvironment: 'Pantalla e idioma',
  // The short word a rail chip carries; the slip prints the full title.
  settingsEnvShort: 'Pantalla',
  settingsData: 'Datos',
  settingsRedo: 'Prueba de nivel',
  settingsCredits: 'Créditos',
  // The pass's contract and the rows under it (plan 140).
  passFieldHour: 'Trayecto diario',
  passFieldLines: 'Líneas',
  settingsRatingShort: 'Calificación',
  // ── The reading pace ────────────────────────────────────────
  // How long Reading leaves a sentence up and Comprehension a text:
  // for a slow reader, a dyslexic one, anyone the clock gets in the
  // way of rather than helps.
  settingsReadingPace: 'Ritmo de lectura',
  settingsReadingPaceHint: 'Cuánto tiempo siguen a la vista una frase en Lectura y un texto en Comprensión antes de ocultarse. Date más tiempo si lees despacio o tienes dislexia.',
  readingPaceOption: { standard: 'Estándar', relaxed: 'Pausado', slow: 'Lento', untimed: 'Sin límite' },
  // The chip at the clock's end, in Reading and Comprehension: each
  // press moves to the next pace.
  readingPaceShort: { standard: '×1', relaxed: '×1,5', slow: '×2', untimed: '∞' },
  readingPaceChip: name => `Ritmo de lectura: ${name}. Pulsa para cambiar`,
  readingPaceDesc: {
    standard: 'El tiempo habitual',
    relaxed: 'La mitad más de tiempo',
    slow: 'El doble de tiempo',
    untimed: 'Nada se oculta antes de que respondas',
  },
  settingsHelp: 'Ayuda',
  settingsHelpValue: 'Trayecto · Guía',
  // Write to us (plan 222): a problem, an idea, a mistake in what is
  // taught, and a card reported from its flag. Nothing leaves the
  // device without being written out here first.
  settingsWrite: 'Escríbenos',
  settingsWriteValue: 'Un problema, una idea',
  fbKindLabel: 'Qué es',
  fbKind: { problem: 'Problema', idea: 'Idea', fault: 'Error' },
  fbPlaceholder: {
    problem: 'Qué pasó y dónde.',
    idea: 'Lo que te gustaría encontrar aquí.',
    fault: 'La palabra o la frase, y qué está mal.',
  },
  fbTextLabel: 'Tu mensaje',
  fbJoin: 'Adjuntar la pantalla y el dispositivo',
  fbJoinFailure: 'Adjuntar el error, la pantalla y el dispositivo',
  fbScreen: 'esta pantalla',
  fbFailure: (status, area) => `error ${status} (${area})`,
  fbDevice: { phone: 'teléfono', tablet: 'tableta', desk: 'computadora', wide: 'computadora' },
  fbPlatform: { web: 'web', native: 'app' },
  fbReply: 'Respóndeme por correo, desde',
  fbSend: 'Enviar',
  fbSent: 'Recibido, gracias.',
  fbSentNote: 'Cada mensaje lo lee una persona.',
  fbSentReply: 'Cada mensaje lo lee una persona. La respuesta llegará por correo.',
  fbErrLimit: 'Cinco mensajes al día: el resto, mañana.',
  fbErrSend: 'El mensaje no se envió. Inténtalo de nuevo.',
  // Early access (plan 269): asked once, from 400 XP.
  rateCap: 'Acceso anticipado',
  rateQ: '¿Qué nota le das a Tsuji?',
  rateLead: 'La app está en acceso anticipado. ¿Hay algo que te gustaría que cambiáramos?',
  rateLabel: 'Tu valoración',
  rateStar: n => `${n} de 5`,
  ratePlaceholder: 'Lo que cambiarías, si hay algo.',
  rateTextLabel: 'Lo que cambiarías',
  rateLater: 'Ahora no',
  cardReport: 'Reportar esta tarjeta',
  cardReportReasons: 'Qué está mal',
  cardReason: { reading: 'Lectura', meaning: 'Significado', audio: 'Audio', example: 'Ejemplo', other: 'Otro' },
  questionReport: 'Reportar esta pregunta',
  questionReason: { answer: 'Respuesta incorrecta', ambiguous: 'Ambigua', audio: 'Audio', other: 'Otro' },
  cardReportNote: 'Unas palabras más, si quieres.',
  cardReportNoteLabel: 'Unas palabras más',
  reportProblem: 'Reportar este problema',
  settingsCreditsCount: n => `${n} fuentes`,
  settingsPaceMinutes: m => `≈ ${m} min`,
  settingsYourPace: 'Tu ritmo',
  settingsYourPaceSub: n => `${n} / día · últimos 14 días`,
  settingsInsteadOf: d => `en lugar del ${d}`,
  creditsWhat: { dictionary: 'Diccionario', kanji: 'Kanji', strokes: 'Orden de trazos', sentences: 'Frases de ejemplo', voice: 'Voz de las estaciones', speech: 'Voz japonesa', kana: 'Voz de los kana', type: 'Tipografías' },
  // The licence of a source with terms of its own (domain/attributions.js).
  creditsTerms: name => `condiciones de ${name}`,
  themeDark: 'Oscuro',
  themeLight: 'Claro',
  themeAuto: 'Sistema',
  themeAutoHint: 'Sigue el ajuste de tu dispositivo',
  // Each button carries its own caption — no row label. Quiet means
  // ambiance, jingle and announcements; study sounds never move.
  soundQuietPreset: 'estación en silencio',
  soundFullPreset: 'estación animada',
  volumeMaster: 'Volumen general',
  settingsPerDay: '/ día',
  settingsTrail: 'Estadísticas de uso',
  settingsTrailHint: 'Qué pantallas y funciones usas y durante cuánto tiempo, nunca lo que escribes. En nuestro propio servidor, nunca compartidas, borradas en un plazo de 25 meses.',
  settingsTrailExportBtn: 'Descargar las mías',
  settingsTrailOn: 'Contadas',
  settingsTrailOff: 'No contadas',
  settingsExport: 'Exportar tu progreso',
  settingsExportHint: 'Un archivo CSV — cada tarjeta, su programación y sus repasos.',
  settingsExportBtn: 'Exportar',
  settingsReset: 'Restablecer tu progreso',
  settingsResetHint: 'Cada repaso, tus XP y tu racha. Los mazos, el nivel y los ajustes se quedan.',
  settingsResetBtn: 'Restablecer',
  settingsResetConfirmQ: '¿Borrarlo todo? No se puede deshacer.',
  settingsResetYes: 'Borrarlo todo',
  settingsResetDone: 'Progreso restablecido. El mapa empieza de cero.',
  settingsDeleteAccount: 'Eliminar tu cuenta',
  settingsDeleteAccountHint: 'Cada repaso, mazo, tarjeta y ajuste, y tu acceso. Exporta antes para guardar una copia.',
  settingsDeleteAccountBtn: 'Eliminar',
  settingsDeleteAccountConfirmQ: '¿Eliminar tu cuenta y todo lo que contiene? No se puede deshacer.',
  settingsDeleteAccountYes: 'Eliminar mi cuenta',
  settingsDeleteAccountFailed: 'No se pudo eliminar tu cuenta. Inténtalo de nuevo.',
  privacyPolicy: 'Política de privacidad',
  // ── The installed app (plan 065) ──
  pwaUpdateReady: 'Hay un nuevo horario en vigor.',
  pwaUpdateBtn: 'Recargar',
  pwaUpdateLater: 'Más tarde',
  offlineLine: 'Sin conexión — la estación está cerrada por ahora.',
  releaseNoticeAt: (time) => `Actualización a las ${time}: la app puede quedarse parada unos minutos.`,
  releaseNoticeNow: 'Actualización en curso: la app puede quedarse parada unos minutos.',
  releaseNoticeOk: 'Entendido',
  installApp: 'Instalar la app',
  installAppHint: 'En tu pantalla de inicio, a pantalla completa, con el audio de los kana guardado para usar sin conexión.',
  installAppBtn: 'Instalar',
  installIosTitle: 'Añadir a la pantalla de inicio',
  installIosStep1: 'Toca Compartir en la barra de Safari.',
  installIosStep2: 'Elige «Añadir a pantalla de inicio» y luego Añadir.',
  installIosBody: 'El iPhone y el iPad instalan las apps web desde el menú Compartir de Safari — no hay un botón para ello.',
  settingsIssuedTo: 'Pase emitido a',

  // ── 行先 — the destination counter ────────────────────────
  // The office's own words, reused where the office is not: the
  // counter borrows the departure board whole, so it only needs the
  // sentences the board cannot draw — what a button will do, and what
  // it costs.
  settingsGoal: 'Destino',
  settingsGoalNoneDesc: 'Este pase no tiene destino. Viajas por la línea abierta — el pase sigue llevando la cuenta, solo por el ritmo.',
  settingsGoalChangeDesc: 'Reimprimir el pase con otro destino, otra fecha u otro servicio.',
  settingsGoalSet: 'Elegir un destino',
  settingsGoalChange: 'Cambiar',
  settingsGoalTerminus: 'Embarcas en N1 — el final de la línea. No hay ninguna estación más allá que prometer.',
  settingsGoalIssue: 'Emitir',
  settingsGoalIssueHint: (dest, date, perDay) =>
    `Imprime ${dest} para el ${date} y fija tu ritmo diario en ${perDay}. La fecha se cuenta desde hoy, así que la promesa empieza hoy.`,
  settingsGoalPickHint: 'Elige un destino y el tablero le pone precio — o sigue por la línea abierta.',
  settingsGoalDrop: 'Devolverlo',
  settingsGoalDropHint: 'Devuelve el destino. Tu ritmo y tu hora se quedan, y el pase informa solo del ritmo — puedes comprar otro destino cuando quieras.',
  settingsGoalIssued: 'Pase emitido. Tu línea está al dorso.',
  settingsGoalDropped: 'Destino devuelto. La línea sigue sin él.',
  settingsGoalDepartHint: 'La hora a la que piensas viajar — opcional, y nunca un recordatorio. Va impresa en el pase porque una promesa con hora tiene más posibilidades de sobrevivir a su primera semana de lluvia.',
}

const nyumon = {
  // 入門 — the introduction (plan 170): six screens before the first
  // card, for a learner who answered "Not yet" to the kana question. The
  // map of the language, not its knowledge: nothing here is memorised.
  nyuDocumentTitle: 'Introducción',
  nyuSkip: 'Saltar la introducción',
  nyuStop: { scripts: 'Escrituras', sounds: 'Sonidos', table: 'Tabla', katakana: 'Katakana', sentence: 'Frase', route: 'Ruta' },
  nyuStripAria: 'Las 6 pantallas de la introducción',
  nyuQuote: s => `«${s}»`,
  nyuTranslation: '«Tomo un café en la estación».',
  // 1 · Scripts
  nyuScriptsQ: 'El japonés mezcla 3\u00a0escrituras.',
  nyuScriptsHint: 'Toca una para verla en la frase.',
  nyuScript: {
    hira: { name: 'Hiragana', desc: 'Las palabras pequeñas y las terminaciones' },
    kata: { name: 'Katakana', desc: 'Palabras de otros idiomas' },
    kanji: { name: 'Kanji', desc: 'Un significado por signo, para más adelante' },
  },
  nyuScriptsLit: (name, signs) => `${name}: ${signs}`,
  // 2 · Sounds
  nyuSoundsQ: 'Todo empieza con 5\u00a0vocales.',
  nyuSoundsHint: 'Toca un signo para oírlo.',
  // A vowel's sound, where writing it in letters would mislead.
  nyuSoundsLike: { a: '', i: '', u: '', e: '', o: '' },
  nyuSoundsFoot: 'Siempre suenan igual.',
  nyuVowelsAria: 'Las 5 vocales',
  // 3 · Table
  nyuTableQ: '46\u00a0signos, 10\u00a0filas de\u00a05.',
  nyuTableHint: '¿Dónde está «ke»? Cruza la fila k y la columna e.',
  nyuTableFound: '**k + e = ke.** Acabas de leer un signo que nadie te había enseñado.',
  nyuTableAria: 'La tabla de los 46 signos',
  // 4 · Katakana
  nyuPairsQ: 'Los mismos sonidos, 2\u00a0formas de escribirlos.',
  nyuPairsLead: 'El katakana escribe las palabras de otros idiomas. Ya conoces algunas:',
  nyuHearWord: 'Escuchar la palabra',
  nyuWords: { hotel: 'hotel', coffee: 'café', tv: 'tele' },
  // 5 · Sentence
  nyuSentenceQ: 'El verbo va al final.',
  nyuSentenceHint: 'Sin «yo», sin artículos, sin plural.',
  nyuGhost: '(yo)',
  nyuMeans: { station: 'estación', coffee: 'café', drink: 'tomo' },
  nyuRoles: { where: 'dónde', what: 'qué' },
  nyuVerb: 'verbo',
  nyuSwap: 'Intercambiar estación y café',
  nyuSwapped: '**Mismo significado:** la etiqueta marca el papel, no la posición.',
  // 6 · Route
  nyuRouteQ: date => `Para el ${date}, leerás estos signos.`,
  nyuRouteQSoon: 'Pronto leerás estos signos.',
  nyuRouteStops: { start: 'Salida', kana: 'Los kana', n5: 'N5' },
  nyuRouteDay: n => `Cada día: **${n}\u00a0elementos nuevos** y tus repasos.`,
  nyuTryCard: 'Probar una tarjeta',
}


// ══ 終着 — the day cleared (plan 191) ══════════════════════════════
// The copy of the canvas "Tsuji — the day cleared" (drawn in French),
// in English. One group per screen (the same region names as
// index.css's), each written by the screen that owns it. The Japanese
// captions are names, not copy: the components print them as they are.

// ── 191:primitives ──
const clrPrimitives = {
  clrXpUnit: 'xp',
  clrWeekAria: parts => `Semana: ${parts.join(', ')}`,
  clrWeekStamped: (from, to) => (from === to ? `${from} sellado` : `${from} a ${to} sellados`),
  clrWeekMissed: day => `${day} perdido`,
  clrWeekRest: day => `${day} cubierto por un día de descanso`,
  clrWeekToday: day => `${day}, hoy`,
  clrSealAria: date => `Sello de hoy: estación de Tsuji, ${date}`,
  clrTicketCaption: days => (days === 30 ? 'Un mes seguido' : days === 365 ? 'Un año seguido' : `${days} días seguidos`),
}
// ── 191:primitives end ──




// ── 191:piles ──
// See the French table.
const clrDay = {
  clrPiles: ['Por repasar', 'Correctas', 'Fáciles'],
  clrPileCount: n => `${n} tarjeta${n === 1 ? '' : 's'}`,
  clrPileEmpty: 'Sin tarjetas',
  clrPileOpen: term => `Abrir ${term} en el diccionario`,
}
// ── 191:piles end ──




// ── 250:finish ──
// See the French table.
const clrFinish = {
  finFareOf: 'incluye',
  finFarePrime: 'por la racha',
  finMissGo: 'Verlas',
  finTicketName: days => (days === 7 ? 'Billete de la semana' : days === 30 ? 'Billete del mes' : days === 365 ? 'Billete del año' : `Billete de ${days} días`),
  finTicketAria: (days, jackpot, rest) => `${days === 7 ? 'Billete de la semana' : `Billete de ${days} días`}: +${jackpot} xp${rest ? ', +1 día de descanso' : ''}`,
  finShare: 'Compartir el billete',
  finShareGo: 'Imagen',
  finRestLine: held => `+1 día de descanso · ${held} en reserva`,
  finMonthTicketAria: (days, jackpot) => `${days === 30 ? 'Billete del mes' : days === 365 ? 'Billete del año' : `Billete de ${days} días`}, ${days === 30 ? 'un mes seguido' : days === 365 ? 'un año seguido' : `${days} días seguidos`}: +${jackpot} xp`,
  finCranesAria: n => `${n} grulla${n === 1 ? '' : 's'} cruza${n === 1 ? '' : 'n'} el cielo, una por cada día seguido`,
  finLanternsAria: n => (n >= 365 ? 'Un río de faroles en el lago, un año de días' : `${n} faroles en el lago, uno por cada día`),
  finStake: 'para el sello de hoy',
  finThreadDone: (n = 0) => (n === 1 ? 'hecha' : 'hechas'),
  finThreadLeft: () => 'por hacer',
  finContinue: 'Continuar',
}
// ── 250:finish end ──




// ── 191:restday ──
const clrRestday = {
  rstTitle: 'Tu racha se mantiene',
  rstWeekAria: parts => `La semana: ${parts.join(', ')}`,
  rstStreakWord: n => (n === 1 ? 'día seguido' : 'días seguidos'),
  rstUsed: days => (days.length === 1
    ? `Día de descanso usado el ${days[0]}`
    : `Días de descanso usados el ${days.slice(0, -1).join(', ')} y ${days.at(-1)}`),
  rstHeld: 'en reserva',
  rstNextPre: 'el próximo, el día',
  rstNextPost: '',
  rstTodayAria: (n, min) => `Hoy: ${n} tarjeta${n === 1 ? '' : 's'}${min ? `, unos ${min} minuto${min === 1 ? '' : 's'}` : ''}`,
  rstCards: n => (n === 1 ? 'tarjeta' : 'tarjetas'),
  rstMin: 'min',
  rstDepart: 'Salida',
}
// ── 191:restday end ──




// ── 191:tickets ──
const clrTickets = {
  tkbTitle: 'Billetes',
  tkbDoor: 'Billetes',
  tkbBack: 'Volver al perfil',
  tkbChosenAria: 'Billete elegido',
  tkbRecord: 'Récord',
  tkbBookAria: (n, total) => `Billetes: ${n} conseguido${n === 1 ? '' : 's'} de ${total}`,
  tkbIn: n => `en ${n} d`,
  tkbDaysShort: n => `${n} d`,
  tkbRange: (from, to) => `del ${from} al ${to}`,
  tkbTicketAria: (days, no, range, record) => `Billete de ${days} días, número ${no}, ${range}${record ? ', récord' : ''}`,
  tkbCellAria: (days, record) => `Billete de ${days} días${record ? ', récord' : ''}`,
  tkbLockedAria: (days, inDays) => `Billete de ${days} días, aún no conseguido${inDays ? `, en ${inDays} día${inDays === 1 ? '' : 's'}` : ''}`,
  tkbShareTicket: 'Compartir este billete',
  tkbShareFigures: { reviews: 'tarjetas repasadas', words: 'palabras aprendidas', level: 'en camino' },
  tkbShareAria: (days, no, range, stamped) => `Billete de ${days} días, número ${no}, ${range}, sellado el ${stamped}`,
  tkbShareRouteAria: 'El recorrido',
  tkbShareText: days => `${days} días seguidos en Tsuji`,
  tkbShareSaved: 'Imagen guardada.',
  tkbShareFailed: 'No se pudo compartir.',
  tkbToday: 'hoy',
  tkbEmpty: 'Tu primer billete',
  tkbEmptyAria: (days, inDays) => `Aún no hay billetes. El primero, ${days} días seguidos, ${inDays ? `en ${inDays} día${inDays === 1 ? '' : 's'}` : 'hoy'}`,
  tkbEmptyGo: 'Salida',
}
// ── 191:tickets end ──


// ── 217:reviews ──
// 回復運転 — the review plan (plan 217): the comeback notice on Today
// and its sheet (plan 254), the catch-up's figure in the day, the run
// past the share, Settings › Reviews and the notification that invites
// back.
const reviewPlan = {
  cbJp: '運転再開',
  cbCap: 'Se reanuda el servicio',
  cbLabel: 'Retoma a tu ritmo',
  cbAway: n => `¡Hola de nuevo! ${n} día${n === 1 ? '' : 's'} sin repasar.`,
  cbPiled: 'Tus repasos se han acumulado.',
  cbOwed: n => `${n} tarjetas esperan. No hace falta hacerlas todas hoy: elige tu ritmo.`,
  cbChoices: 'Tu ritmo',
  cbSpread: 'Repartir',
  cbGentle: 'Con calma',
  cbAll: 'Todo ya',
  cbPerDay: n => `${n} al día`,
  cbOverDays: n => `en ${n} días`,
  cbNoEnd: 'sin fecha de fin',
  cbCards: n => `${n} tarjeta${n === 1 ? '' : 's'}`,
  cbMinutes: m => `≈ ${m} min`,
  cbDays: 'En cuántos días',
  cbDaysN: n => `${n} días`,
  cbNewPaused: 'Las tarjetas nuevas vuelven en cuanto te pongas al día.',
  cbGo: '¡Vamos!',
  cbError: 'No se pudo guardar tu elección. Inténtalo de nuevo.',
  cbLinePiled: n => (n === 1 ? 'tarjeta acumulada' : 'tarjetas acumuladas'),
  cbLineGo: 'Repartir',
  cbHide: 'Ocultar por hoy',
  todayCatchupDay: 'día de recuperación',
  todayCatchupGentle: 'al día, recuperando',
  todayCatchupShort: 'recuperación',
  todayHeld: 'En espera',
  todayHeldGo: 'Repasar',
  settingsReviews: 'Repasos',
  rvRowNone: 'Sin límite',
  rvRowCap: n => `${n} como máximo al día`,
  rvRowCatchup: 'Recuperando',
  rvRowAway: from => `Fuera desde el ${from}`,
  rvCapLabel: 'Repasos al día',
  rvCapHint: 'Pasado el límite, las tarjetas esperan al día siguiente, y tu día se completa con tu parte.',
  rvCapNone: 'Ninguno',
  rvCapUnder: load => `Unas ${load} tarjetas quedan pendientes cada día: con este límite, el atraso crecerá.`,
  rvCatchupLabel: 'Recuperación',
  rvCatchupSpread: (perDay, day, of) => `${perDay} tarjetas al día · día ${day} de ${of}`,
  rvCatchupGentle: perDay => `${perDay} tarjetas al día, sin fecha de fin`,
  rvCatchupNew: 'Las tarjetas nuevas quedan en pausa hasta que termine.',
  rvCatchupStop: 'Dejar la recuperación',
  rvAwayLabel: 'Ausencia',
  rvAwayHint: n => `Tus días fuera mantienen tu racha, y las tarjetas nuevas se detienen dos días antes de que te vayas. ${n} días como máximo.`,
  rvAwayFrom: 'Desde',
  rvAwayUntil: 'Hasta',
  rvAwaySave: 'Guardar',
  rvAwayCancel: 'Cancelar la ausencia',
  rvAwaySet: (from, until) => `Del ${from} al ${until}`,
  rvAwayErr: {
    past: 'El primer día no puede estar en el pasado.',
    order: 'El último día va después del primero.',
    long: n => `${n} días como máximo.`,
  },
  rvError: 'No se pudo guardar el cambio.',
  nudgeComebackTitle: time => `Tu tren de las ${time} · ¿retomamos poco a poco?`,
  nudgeComebackBody: 'Unos minutos bastan para volver a arrancar.',
}
// ── 217:reviews end ──

// ── 243b:transfer ──
// 乗換 (plans 243, 243b): Settings › Transfer, another app's progress
// brought across on a transfer ticket -- the source, the file or the
// key, what the course finds, the stamp, and the way back while the
// imported cards wait for their first answer; and the sheet over Today
// that asks a new learner, once.
const trCount = n => n.toLocaleString('es-ES')
const transfer = {
  settingsTransfer: 'Transbordo',
  trRowValue: 'Anki, WaniKani, Renshuu',
  trCap: 'Transbordo',
  trTicketLabel: 'Billete de transbordo',
  trFrom: 'De',
  trTo: 'A',
  trSource: { anki: 'Anki', wanikani: 'WaniKani', renshuu: 'Renshuu' },
  trFileHint: 'Tu archivo **.apkg** o **.colpkg**',
  trChooseFile: 'Elegir mi archivo de Anki',
  trKeyLabel: { wanikani: 'Tu token de API de WaniKani', renshuu: 'Tu clave de API de Renshuu' },
  trKeyPlaceholder: { wanikani: 'Pégalo aquí', renshuu: 'Pégala aquí' },
  trReadKey: { wanikani: 'Leer mis tarjetas de WaniKani', renshuu: 'Leer mis tarjetas de Renshuu' },
  trPages: n => `${trCount(n)} página${n === 1 ? '' : 's'} leída${n === 1 ? '' : 's'}`,
  trHowQ: { anki: '¿Cómo lo exporto desde Anki?', wanikani: '¿Dónde encuentro mi token?', renshuu: '¿Dónde encuentro mi clave?' },
  trHow: {
    anki: ['**Archivo › Exportar…**', 'Marca **Incluir información de programación**', 'Desmarca **Incluir multimedia**: el archivo queda ligero'],
    wanikani: ['En WaniKani, **Settings › API Tokens**', 'Crea un token **sin ningún permiso**: solo podrá leer', 'Pégalo aquí'],
    renshuu: ['En los ajustes de Renshuu, busca tu **clave de API**', 'Cópiala', 'Pégala aquí'],
  },
  trPrivacyFile: 'Se lee en tu dispositivo. Solo salen las palabras.',
  trPrivacyKey: name => `Tu dispositivo lee ${name} por sí mismo: tu clave nunca se nos envía ni se guarda.`,
  trFound: n => `tarjeta${n === 1 ? '' : 's'} traspasada${n === 1 ? '' : 's'}`,
  trLine: { vocab: 'Vocabulario', kanji: 'Kanji', kana: 'Kana' },
  trDecks: 'Mazos',
  trDue: (n, weeks) => `${trCount(n)} ${n === 1 ? 'estaba atrasada: vuelve' : 'estaban atrasadas: vuelven'} a lo largo de ${weeks} semanas.`,
  trKept: n => `${trCount(n)} ya estudiada${n === 1 ? '' : 's'} aquí ${n === 1 ? 'se queda como está' : 'se quedan como están'}.`,
  trAbove: n => `${trCount(n)} ${n === 1 ? 'está' : 'están'} por encima de tu nivel y tu destino: ${n === 1 ? 'volverá' : 'volverán'} a tu día cuando tu nivel llegue ahí.`,
  trCheck: 'Cada tarjeta se comprueba la primera vez que vuelve.',
  trPunch: 'Validar el billete',
  trAllKept: 'Ya has estudiado aquí todas estas tarjetas: nada que traspasar.',
  trNone: 'Ninguna de estas notas tiene tarjeta en el curso.',
  trMissing: n => `${trCount(n)} nota${n === 1 ? '' : 's'} sin tarjeta en el curso`,
  trMissingSample: sample => `Por ejemplo: ${sample}.`,
  trReadFrom: list => `Palabras leídas de ${list}.`,
  trRestart: 'Empezar de nuevo',
  trImported: n => `tarjeta${n === 1 ? '' : 's'} importada${n === 1 ? '' : 's'}`,
  trImportedHint: 'Se suman a tu día en su fecha. La primera vez, cada una se comprueba.',
  trPunched: 'Validado',
  trGoToday: 'Ir a Hoy',
  trWaiting: n => `${trCount(n)} tarjeta${n === 1 ? ' importada sigue' : 's importadas siguen'} esperando tu primera respuesta.`,
  trUndo: 'Deshacer la importación',
  trUndoConfirmQ: '¿Quitar las tarjetas importadas que aún no has repasado? Las que ya repasaste aquí se quedan.',
  trUndoYes: 'Quitar',
  trUndone: n => `${trCount(n)} tarjeta${n === 1 ? '' : 's'} quitada${n === 1 ? '' : 's'}.`,
  trErr: {
    notAnki: 'Este archivo no es un mazo de Anki (.apkg o .colpkg).',
    unreadable: 'No se pudo leer este archivo.',
    noSchedule: 'Este mazo se exportó sin su programación: vuelve a exportarlo con «Incluir información de programación».',
    nothing: 'Nada que traspasar: ninguna tarjeta que la app te haya enseñado ya.',
    tooMany: 'Demasiadas notas a la vez: elige menos mazos.',
    badKey: 'Esta clave no fue aceptada. Compruébala y vuelve a pegarla.',
    network: 'No se pudo contactar con la app. Revisa tu conexión.',
    rate: 'La app pide esperar un poco. Inténtalo de nuevo en un minuto.',
    unreachable: 'La app no respondió como se esperaba. Inténtalo más tarde.',
    server: 'No se pudo completar la importación. Inténtalo de nuevo.',
  },
  trSheetQ: '¿Has estudiado en otra parte?',
  trSheetLead: 'Las palabras que conoces no empiezan de cero: mantienen su ritmo.',
  trSheetGo: 'Traer mi progreso',
  trSheetLater: 'Empiezo aquí',
  trSheetFoot: 'Siempre puedes hacerlo luego, en Ajustes.',
}
// ── 243b:transfer end ──

// ── 対戦 — duels (plan 279) ─────────────────────────────────────
// The sprint: two minutes, the same questions for both players.
const pvp = {
  pvpTitle:        'Duelos',
  pvpChallenges:   n => (n === 1 ? '1 desafío por jugar' : `${n} desafíos por jugar`),
  pvpFriendsN:     n => (n === 1 ? '1 amigo' : `${n} amigos`),
  pvpRequestsN:    n => (n === 1 ? '1 solicitud' : `${n} solicitudes`),
  pvpElo:          'Elo',
  pvpRecordLong:   (w, d, l) => `${w} victorias · ${d} empates · ${l} derrotas`,
  pvpRankOf:       (r, n) => `#${r} de ${n}`,
  pvpSprints:      'sprints',
  pvpBeat:         s => `${s} a batir`,
  pvpHoursLeft:    h => `quedan ${h} h`,
  pvpDefies:       who => `${who} te desafía`,
  pvpLiveDefies:   who => `${who} te espera, en vivo`,
  pvpPlay:         'Jugar',
  pvpBeatUnit:     'a batir',
  pvpDefy:         'Desafiar',
  // 新しい (plan 287): the duels announced once, on Today, to whoever
  // knew it before their key stood there.
  newsCap:         'Nuevo',
  newsDuelsTitle:  'Los duelos llegan a Hoy',
  newsDuelsLead:   depart => `Dos minutos de preguntas contra un amigo o alguien de tu nivel, y la velocidad cuenta. El botón ⇄ junto a «${depart}» abre los duelos.`,
  newsDuelsGo:     'Ver los duelos',
  newsDuelsLater:  'Más tarde',
  pvpRanked:       'Sprint clasificatorio',
  pvpRankedDesc:   'Alguien con un Elo cercano, o su partida grabada.',
  pvpFriendDuel:   'Desafiar a un amigo',
  pvpFriendDesc:   'Más tarde o en vivo. Sin clasificar.',
  pvpCredits:      n => (n === 1 ? '1 crédito' : `${n} créditos`),
  pvpFree:         'Gratis',
  // The pass pays for everything (the hall's and the ticket's price).
  pvpIncluded:     'Incluido',
  pvpTabToPlay:    'Por jugar',
  pvpTabRunning:   'En curso',
  pvpTabDone:      'Terminados',
  pvpFriendTag:    'amigo',
  pvpWin:          'Ganado',
  pvpLoss:         'Perdido',
  pvpDraw:         'Empate',
  pvpTraveller:    'Viajero',
  pvpFriendsTitle: 'Amigos',
  pvpSearchCap:    'Su nombre de usuario, exacto',
  pvpAsk:          'Añadir como amigo',
  pvpAccept:       'Aceptar',
  pvpRefuse:       'Rechazar',
  pvpRequest:      'solicitud de amistad',
  pvpYourDuels:    (w, l) => `tus duelos: ${w} V · ${l} D`,
  pvpAddFriend:    'Añadir un amigo por su nombre de usuario',
  pvpWhom:         'A quién desafiar',
  pvpHow:          'Cómo',
  pvpLater:        'Más tarde · 48 h',
  pvpLive:         'En vivo',
  pvpLaterHelp:    who => `El mismo trayecto para los dos; ${who} tiene 48 h para hacerlo.`,
  pvpLiveHelp:     who => `Salen a la vez, tres segundos después de que llegue ${who}.`,
  pvpChallenge:    who => `Desafiar a ${who}`,
  pvpInvite:       who => `Invitar a ${who}`,
  pvpSprintOf:     ms => (ms >= 120_000 && ms % 60_000 === 0 ? `Sprint · ${ms / 60_000} minutos` : `Sprint · ${ms / 1000} segundos`),
  pvpDuelLevel:    'Nivel del duelo',
  pvpQuestions:    'Preguntas',
  pvpWordsKanji:   'palabras y kanji',
  pvpWordsKana:    'palabras y kana',
  pvpWordsKanaKanji: 'palabras, kana y kanji',
  pvpEloOf:        n => `Elo ${n}`,
  pvpEloRange:     (a, b) => `Elo ${a} – ${b}`,
  pvpChoicesN:     n => `${n} opciones`,
  pvpLength:       'Duración',
  pvpMinutes:      n => `${n} min`,
  pvpStake:        'En juego',
  pvpStakeElo:     n => `± ${n} Elo`,
  pvpNovice:       'Principiante',
  pvpPrice:        'Precio',
  pvpFreeFriends:  'gratis entre amigos',
  pvpGo:           'Partir',
  pvpRankedFoot:   'Si no hay nadie libre con un Elo cercano, compites contra la partida grabada de alguien real, con su nombre de usuario visible.',
  pvpGoPaid:       n => `Partir · ${n} créditos`,
  pvpYou:          'Tú',
  pvpKind:         { word: 'Palabra', reading: 'Lectura', writing: 'Escritura', kana: 'Kana' },
  pvpQuit:         'Salir del sprint',
  pvpReady:        '¿Todo listo?',
  pvpOver:         'Fin',
  // The race as a game (plan 285, the owner's C1) and its result (E4).
  pvpGoBand:       '¡Ya!',
  pvpArrival:      '¡Meta!',
  pvpRush:         'Recta final',
  pvpCombo:        'Combo',
  pvpComboLost:    n => `${n} perdido`,
  pvpPassMe:       '¡Por delante!',
  pvpPassThem:     who => `${who} por delante`,
  pvpNote:         { flash: 'Relámpago', quick: 'Rápida' },
  pvpLines:        { speed: 'Velocidad', combo: 'Combo', rush: 'Recta final', accuracy: 'Precisión', flashes: 'Relámpagos' },
  pvpInARow:       (a, b) => `${a} / ${b} seguidas`,
  pvpVerdict:      { win: '¡Victoria!', loss: 'Derrota', draw: 'Empate' },
  pvpAhead:        n => `${n.toLocaleString('es')} punto${n === 1 ? '' : 's'} de ventaja`,
  pvpBehind:       n => `a ${n.toLocaleString('es')} punto${n === 1 ? '' : 's'}`,
  pvpGrade:        g => `Nota ${g}`,
  pvpBy:           n => `por ${n} punto${n === 1 ? '' : 's'}`,
  pvpWaitingFor:   who => `Esperando a ${who}`,
  pvpRightsOf:     (r, n) => `${r} correctas de ${n}`,
  pvpCorrections:  'Detalles y correcciones',
  pvpNewSprint:    'Nuevo sprint',
  pvpRematch:      'Revancha',
  pvpXpLeft:       n => `${n} más hoy`,
  pvpEloBoard:     'Clasificación Elo',
  pvpAll:          n => `Todos · ${n}`,
  pvpFriendsOnly:  n => `Amigos · ${n}`,
  pvpGapTo:        (n, r) => `${n} puntos de Elo hasta el #${r}`,
  pvpBilan:        'balance',
  pvpOrdinal:      r => `#${r}`,
  pvpOutOf:        n => `de ${n}`,
  pvpDuelWith:     who => `Duelo · ${who}`,
  pvpToBeat:       'A batir',
  pvpNoneToPlay:   'Ningún desafío por jugar.',
  pvpNoneRunning:  'Nada en curso.',
  pvpNoneDone:     'Aún no has jugado ningún duelo.',
  pvpLiveWaits:    'En vivo · te espera',
  pvpLiveNow:      'En vivo',
  pvpRunning:      'Tu sprint sigue en curso',
  pvpResume:       'Reanudar',
  pvpNobodyYet:    'esperando rival',
  pvpClosedRow:    'cerrado',
  pvpEnter:        'Entrar',
  pvpOpen:         'Abrir',
  pvpEloFrom:      level => `Parte de tu nivel ${level} y luego cambia con cada sprint clasificatorio.`,
  pvpNotRanked:    'sin clasificar aún',
  pvpProvisional:  'Provisional: menos de 15 duelos clasificatorios',
  pvpCurveLabel:   n => `Tu Elo en los últimos ${n} duelos clasificatorios`,
  pvpStartAt:      n => `inicio ${n}`,
  pvpPeak:         n => `máximo ${n}`,
  pvpRacedLater:   who => `${who} competirá contra tu grabación.`,
  pvpVerdictLater: who => `El veredicto llegará cuando ${who} haya jugado.`,
  pvpShut:         { expired: 'Expirado', declined: 'Rechazado', cancelled: 'Cancelado' },
  pvpRefunded:     'No vino nadie: te devolvemos los créditos.',
  pvpNoVerdict:    'Este duelo no tiene veredicto.',
  pvpNoVerdictRefunded: 'Este duelo no tiene veredicto: te devolvemos los créditos.',
  pvpDecline:      'Rechazar el desafío',
  pvpCancel:       'Cancelar el desafío',
  pvpNotMet:       'no alcanzada',
  pvpRightShort:   'correcta',
  pvpWrongShort:   'incorrecta',
  pvpBetweenYou:   'entre los dos',
  pvpCardStranger: 'Antes de la amistad, solo se ve el nombre de usuario.',
  pvpReport:       'Reportar',
  pvpReasons:      { name: 'Nombre de usuario inapropiado', cheat: 'Trampas', spam: 'Solicitudes o desafíos repetidos', other: 'Otra cosa' },
  pvpReportSend:   'Enviar el reporte',
  pvpReported:     'Reporte enviado. Lo leerá una persona.',
  pvpRemoved:      'Amistad eliminada.',
  pvpBlocked:      'Bloqueado: ya no podrán encontrarse.',
  pvpRemoveFriend: 'Quitar de amigos',
  pvpBlock:        'Bloquear',
  pvpFind:         'Buscar',
  pvpRelation:     { me: 'Eres tú', friend: 'Amigo', sent: 'Solicitud enviada', received: 'Solicitud recibida', none: '' },
  pvpChallengeShort: 'Desafiar',
  pvpSentN:        n => (n === 1 ? '1 solicitud enviada' : `${n} solicitudes enviadas`),
  pvpWithdraw:     'Retirar',
  pvpBlockedN:     n => (n === 1 ? '1 bloqueado' : `${n} bloqueados`),
  pvpUnblock:      'Desbloquear',
  pvpNoFriends:    'Aún no tienes amigos: busca un nombre de usuario exacto.',
  // The server's refusals, by their code (domain/duel.js, errorKey).
  pvpErrNotFound:     'Nadie tiene ese nombre de usuario.',
  pvpErrSelf:         'Es tu propio nombre de usuario.',
  pvpErrNotFriends:   'No figura entre tus amigos.',
  pvpErrCooldown:     'Podrás volver a pedirlo más tarde.',
  pvpErrFriendLimit:  'La agenda está llena: 200 amigos como máximo.',
  pvpErrPendingLimit: 'Demasiadas solicitudes esperan ya una respuesta.',
  pvpErrRequestLimit: 'Suficientes solicitudes por hoy.',
  pvpErrSearchLimit:  'Demasiadas búsquedas seguidas. Inténtalo de nuevo en unos minutos.',
  pvpErrNoRequest:    'Esa solicitud ya no está pendiente.',
  pvpErrNotBlocked:   'Ese nombre de usuario no está bloqueado.',
  pvpErrTooMany:      'Demasiados duelos en curso. Termina uno primero.',
  pvpErrClosed:       'Este duelo está cerrado.',
  pvpErrDuelGone:     'Este duelo ya no existe.',
  pvpErrRunning:      'Tu rival está jugando este duelo ahora mismo: podrás rechazarlo cuando termine su sprint.',
  pvpErrPlayed:       'Ya has jugado este duelo.',
  pvpErrWaiting:      'Tu rival aún no ha entrado.',
  pvpErrNotStarted:   'El sprint no ha empezado.',
  pvpErrTooEarly:     'Un momento: llega la pregunta.',
  pvpErrNotSettled:   'Las correcciones se abren cuando el duelo se resuelve.',
  pvpErrUnpaid:       'Las correcciones cuestan 1 crédito.',
  pvpErrCredits:      'No te quedan suficientes créditos.',
  pvpErrFailed:       'No ha funcionado. Inténtalo de nuevo.',
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
  ...conversationMode,
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
  ...clrPrimitives,
  ...clrDay,
  ...clrFinish,
  ...clrRestday,
  ...clrTickets,
  ...reviewPlan,
  ...transfer,
  ...pvp,
}
