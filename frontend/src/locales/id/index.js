// Bahasa Indonesia (plan 312): the interface's table, key for key the
// English one's (locales.test.js). The learner is `kamu` (the owner's
// pick), in standard Indonesian, never Malay; the app's words are one
// everywhere: kartu, dek, ulangi / pengulangan, perlu diulang, dikuasai,
// runtunan, stasiun, jalur, peron, tiket, gerbang, perjalanan, tujuan,
// tryout (a mock exam), rincian (the breakdown), Jelaskan (Explain).
// Figures are Indonesia's (lib/locale.js, intlLocale('id')).
import { intlLocale } from '../../lib/locale.js'

// ── App / Auth ────────────────────────────────────────────
const auth = {
  appTitle:          '辻',
  learnJapanese:     'Belajar bahasa Jepang',
  appDesc:           'Pengulangan berjarak (SM-2) · Hiragana · Katakana · Kosakata JLPT',
  login:             'Masuk',
  signup:            'Daftar',
  email:             'Email',
  password:          'Kata sandi',
  loginBtn:          'Masuk',
  signupBtn:         'Daftar',
  signupSuccess:     'Periksa emailmu untuk mengonfirmasi akunmu.',
  signOut:           'Keluar',
  usernameInvalid:   'Nama pengguna harus 3–20 karakter (huruf, angka, garis bawah).',
  usernameTaken:     'Nama pengguna ini sudah dipakai.',
  usernameRefused:   'Nama pengguna ini tidak diizinkan.',
  // 改札 — sign-in refusals, named by their code (lib/authErrors.js)
  // rather than by Supabase's English sentence (plan 215). The ones the
  // guest claim shares (address taken, weak password, too many tries)
  // say the claim* lines.
  authBadCredentials:    'Alamat email atau kata sandi salah.',
  authEmailNotConfirmed: 'Konfirmasikan alamatmu dulu: tautannya ada di kotak masukmu.',
  authEmailInvalid:      'Alamat email itu tidak valid. Periksa lagi, atau coba alamat lain.',
  authCheckFields:       'Periksa alamat email dan kata sandimu.',
  authSignupDisabled:    'Pendaftaran ditutup untuk sementara.',
  authLinkExpired:       'Tautan ini sudah kedaluwarsa atau pernah dipakai. Coba masuk; jika gagal, ulangi dari awal untuk mendapatkan tautan baru.',
  // A sign-in link (plan 247): a card kept by a link has no password, and
  // a forgotten password finds its door here.
  authLinkSend:          'Kirim tautan masuk lewat email',
  authLinkSent:          (email) => `Tautan terkirim ke ${email}. Buka di perangkat ini.`,
  authLinkNoAccount:     'Tidak ada kartu yang tersimpan di alamat itu.',
  authLinkNeedsEmail:    'Ketik alamatmu, lalu minta tautannya.',
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
  back:              'Kembali',
  skipToContent:     'Langsung ke konten',
  cancel:            'Batal',
  save:              'Simpan',
  delete:            'Hapus',
  edit:              'Ubah',
  close:             'Tutup',
  loading:           'Memuat…',
  waitingServer:     'Membangunkan server…',
  errorTitle:        'Tidak berhasil',
  errorHint:         'Periksa koneksimu — kemajuanmu aman.',
  // The two refusals a session has a line of its own for
  // (components/study/SessionError.jsx): a pass the server no longer
  // recognises, a deck that is no longer there. Everything else says
  // errorHint.
  sessionExpired:    'Sesimu sudah berakhir. Masuk lagi untuk melanjutkan — kemajuanmu aman.',
  deckGone:          'Dek ini sudah tidak ada di rakmu.',
  // ── The chrome (plan 068): the five gates and the HUD ──
  tabLearn:          'Belajar',
  tabPractice:       'Latihan',
  tabToday:          'Hari Ini',
  tabDictionary:     'Kamus',
  tabProfile:        'Profil',
  tabBarLabel:       'Bagian',
  // The desk rail's second list (plan 269): the analyser, the library,
  // the statistics and the settings, as places beside the gates.
  deskPlacesLabel:   'Tempat',
  hudStatusLabel:    'Status target',
  hudOffline:        'Luring',
  hudDays:           (n) => `${n} hr`,
  // The station panel's word. Late twice on purpose: the days beside
  // it and the ink tell running behind from delayed.
  hudStatus: {
    ahead:          'Lebih awal',
    onTime:         'Tepat waktu',
    slightlyBehind: 'Terlambat',
    delayed:        'Terlambat',
    suspended:      'Terhenti',
  },
  // ── 回数券 — the credits (plan 069) ──
  creditsUnit:       'kredit',
  balanceLabel:      'Saldo',
  balanceTitle:      'Saldo',
  balanceOf:         (cap) => `dari ${cap}`,
  balanceRefillEvery: (min) => `setiap ${min} mnt`,
  balanceNext:       (at) => `berikutnya pukul ${at}`,
  balanceHolds:      (cap) => `menampung hingga ${cap}`,
  balanceKanaFree:   'Pengulangan kana gratis',
  balanceStepsFree:  'Kartu yang masih kamu pelajari diulang gratis: kamu membayar saat pertama kali menemuinya, lalu setiap pengulangan setelah kartu itu melekat di ingatan',
  gateShort:         (rides, due) => `Hanya ${rides} dari ${due} yang bisa naik`,
  gateNoCredits:     (at) => (at ? `Kredit habis — +1 pukul ${at}` : 'Kredit habis'),
  runOutTitle:       'Kredit habis',
  runOutCleared:     (n) => `${n} selesai`,
  runOutWaiting:     (n) => `${n} menunggu isi ulang`,
  runOutWaits:       'menunggu',
  // 補充 — what the refill landed while the app was closed, told as the
  // card is charged with it (plans 141, 278), to a screen reader
  refillLanded:      (n, to, cap) => `${n} kredit masuk selama kamu pergi · ${to} dari ${cap}`,
  // 無料 — a lane that costs nothing (domain/credits.js).
  freeFare:          'gratis',
  laneNew:           n => `${n} baru`,
  // 区間 — the desk gate's run length and fare foot (plan 135)
  gateTake:          'Panjang perjalanan',
  gateTakeAll:       n => `Semua · ${n}`,
  gateTakeOf:        n => `dari ${n}`,
  gateModes:         'Kartu yang naik',
  gateModesAll:      n => `Semua mode · ${n}`,
  gateModesMain:     n => `Kartu utama · ${n}`,
  gateWhich:         'Kartu mana',
  gateHowMany:       'Berapa banyak',
  gateServices:      'Pilih layanan',
  gateServicesOf:    (on, all) => `${on} dari ${all}`,
  gateServicesTitle: 'Layanan hari ini',
  gateMinutes:       'mnt',
  gateMinutesLabel:  n => `sekitar ${n} menit`,
  gateRides:         'naik',
  gateWaits:         (at) => (at ? `menunggu · +1 pukul ${at}` : 'menunggu'),
  gateBalance:       'kredit',
  laneWaits:         at => `menunggu hingga ${at}`,
  weekAhead:         'Tujuh hari ke depan',
  weekLeft:          'Sisa untuk besok',
  gateRidesFree:     'naik · gratis',
  // 一目 — Today at a glance (plan 199)
  gateModesMainName: 'Kartu utama',
  gateModesAllName:  'Semua mode',
  gateTakeWord:      'Semua',
  gateTakeAllWord:   'semua',
  gateEndsAt:        at => `selesai pukul ${at}`,
  gateAdjust:        'Atur',
  // 浮世絵 (plan 205): the print's title slip, said whole -- the day and
  // the view of the print the hour and the season show (plan 261), as
  // the print's series would name it.
  printTitle:        (day, view) => `${day} — ${view}`,
  printViews: {
    'spring-dawn': 'fajar musim semi', 'spring-day': 'sakura dalam kabut',
    'spring-dusk': 'angsa-angsa pulang', 'spring-night': 'bulan berkabut',
    'summer-dawn': 'angin selatan', 'summer-day': 'puncak-puncak awan',
    'summer-dusk': 'senja yang teduh', 'summer-night': 'kunang-kunang', 'summer-hanabi': 'kembang api',
    'autumn-dawn': 'fajar', 'autumn-day': 'layar-layar pulang',
    'autumn-dusk': 'angsa-angsa turun', 'autumn-night': 'bulan musim gugur',
    'winter-dawn': 'fajar dingin', 'winter-day': 'cerah setelah salju',
    'winter-dusk': 'salju senja', 'winter-night': 'bulan musim dingin',
  },
  gateServicesN:     n => `${n} layanan`,
  gateLineModes:     name => `Mode: ${name}`,
  gateLineNone:      'Tidak ada layanan hari ini',
  // 主 (plan 273): the modes of a line, added to Today or taken off.
  gateLineAdd:       'Juga di Hari Ini',
  gateModeAdd:       mode => `Tambahkan “${mode}” ke Hari Ini`,
  gateModeRemove:    mode => `Keluarkan “${mode}” dari Hari Ini`,
  gateOpensAt:       at => `Buka pukul ${at}`,
  gateOpensIn:       when => `Buka ${when}`,
  todayDayLabel:     'Harimu',
  todayStreakDays:   n => (n === 1 ? 'hari' : 'hari beruntun'),
  todayStreakShort:  'beruntun',
  todayNewToday:     'baru hari ini',
  todayNewShort:     'baru',
  todayLesson:       'bab',
  todayReviewed:     n => `${n} kartu hari ini`,
  // The same, its figure set apart on the print (plan 206).
  todayReviewedUnit: () => 'kartu hari ini',
  todayCardsUnit:    () => 'kartu',
  todayWeekStamps:   n => `${n} hari beruntun, tujuh hari terakhir dicap`,
  // 基礎 — the basics course on the gate and in Settings › Level (plan 186f)
  basicsUnit:        (n, of) => `Bab ${n} dari ${of}`,
  basicsMet:         (n, of) => `${n} dari ${of} bab sudah dibuka`,
  basicsDone:        'Dasar-dasar selesai — sisa N5 sudah terbuka.',
  basicsSkip:        'Lewati dasar-dasar',
  basicsSkipLabel:   'Dasar-dasar',
  basicsSkipAct:     'Sudah tahu',
  basicsSkipped:     n => `${n} kartu dasar ditandai sudah dikenal.`,
  // 基礎 — the course's station on the Learn gate (plan 186g)
  basicsTitle:       'Dasar-dasar',
  basicsDesc:        'N5 dari pelajaran pertama\nBab demi bab\nAturan, kata, dan kanjinya',
  basicsUnits:       'Bab',
  basicsPoints:      'Tata bahasa',
  basicsWords:       'Kata',
  basicsKanji:       'Kanji',
  basicsSentences:   'Kalimat',
  basicsMetOf:       (met, total) => `${met} dari ${total} sudah ditemui`,
  // ── 定期券 — the offer's doors and its thanks (domain/paywall.js) ──
  paywallName_pro:    'Tsuji Pro',
  paywallThanks:      'Tercatat — kami akan mengabarimu saat dibuka.',
  paywallOpen:        'Lihat Pro',
  paywallRowValue:    'Segera hadir',
  // ── 定期券 — the three offers (plan 172, components/offers/) ──
  ofrLabel:           'Paket Tsuji',
  ofrCardBrand:       'Pass',
  ofrCardPro:         'Pro',
  ofrCardMax:         'Max',
  ofrCardFarePro:     'Latihan · 1 kredit',
  ofrCardFareMax:     'Latihan · tanpa kredit',
  // ── 定期券 — the card, face and back (plan 173) ──
  cardFree:           'Gratis',
  cardPaid:           'Pass',
  cardFareFree:       'Latihan · terkunci',
  cardTurn:           'Balik kartunya',
  cardLevelTo:        (a, b) => `Level ${a} → ${b}`,
  cardJourney:        'Perjalanan',
  cardIssued:         (when) => `Terbit ${when}`,
  cardOnPage:         'Di halaman',
  cardPerExercise:    '1 per latihan',
  cardNoCredit:       'Latihan tanpa kredit',
  cardNoCreditShort:  'tanpa kredit',
  cardUnlimited:      'Tanpa batas',
  cardDriftAhead:     (n) => `${n} hari lebih awal`,
  cardDriftLate:      (n) => `terlambat ${n} hari`,
  cardLines:          (names) => `Jalur: ${names}`,
  ofrPlatforms: { reading: 'Membaca', comprehension: 'Pemahaman bacaan', translation: 'Terjemahan', dictation: 'Dikte', composition: 'Karangan', exam: 'Tryout' },
  ofrPerMonth:        '/ bulan',
  // The 7-day trial (DISCOVER)
  ofrDiscEyebrow: { trip: 'Untuk perjalananmu ke Jepang', studies: 'Untuk studimu', fun: 'Untuk bersenang-senang', live: 'Untuk tinggal di Jepang', friends: 'Untuk teman-teman Jepangmu', other: 'Tsuji Pro' },
  ofrDiscLede: {
    trip: 'Baca papan petunjuk dan menu, pahami apa yang dikatakan kepadamu, tulis kalimat pertamamu.',
    studies: 'Berlatih untuk JLPT: tryout berbatas waktu, membaca, menyimak, dan menulis.',
    fun: 'Baca manga, pahami anime, tulis kalimatmu sendiri.',
    live: 'Baca apa pun yang kamu temui, pahami bahasa lisan, tulis pesan sehari-harimu.',
    friends: 'Tulis kalimatmu sendiri untuk mereka, pahami balasan mereka, terjemahkan tanpa ragu.',
    other: 'Membaca, pemahaman bacaan, terjemahan, dikte, karangan, dan tryout: kartumu menjadi bahasa Jepang.',
  },
  ofrDiscTitle:       (days) => `${days} hari latihan, gratis dari kami.`,
  ofrTrialKind:       'Uji coba gratis · Pro tahunan',
  ofrTrialUnit:       (days) => `selama ${days} hari`,
  ofrTrialBill:       (year, month) => `lalu ${year} per tahun, ${month} per bulan`,
  ofrTrialStub:       (days) => `${days} hari`,
  ofrTrialStubCap:    'gratis',
  ofrDiscLater:       'Tetap gratis',
  ofrDiscCta:         (days) => `Coba ${days} hari`,
  ofrDiscFine:        (days) => `Batalkan sebelum hari ke-${days}: kamu tidak membayar apa pun.`,
  ofrDemoQuestion:    'Di mana kopinya diminum?',
  ofrDemoHome:        'Di rumah',
  ofrDemoStation:     'Di stasiun',
  ofrDemoSentence:    'Saya minum kopi di stasiun.',
  ofrDemoPrompt:      'Kalimat dengan で untuk tempat:',
  ofrDemoTutor:       'Kata tutor: alami dan benar.',
  // The week the credits stopped (WEEK)
  ofrWeekCap:         '7 hari terakhirmu',
  ofrWeekDone:        'diulang',
  ofrWeekWaiting:     'menunggu',
  ofrWeekCeiling:     (n) => `batas: ${n} kredit / hari`,
  ofrWeekGain:        (n) => `+${n} kartu diulang dengan Pro`,
  ofrWeekChart:       (stops, waited) => `7 hari terakhirmu: ${stops} hari dengan kartu yang menunggu, total ${waited} kartu.`,
  ofrWeekEyebrow:     'Minggumu',
  ofrWeekTitle:       (n) => (n === 1 ? 'Kreditmu menghentikanmu sekali minggu ini.' : `Kreditmu menghentikanmu ${n} kali minggu ini.`),
  ofrWeekLede:        (n) => `${n} kartu menunggu hingga keesokan harinya. Dengan Pro, kamu mengulang semua yang perlu diulang, di hari yang sama.`,
  ofrProYearKind:     'Pro · tahunan',
  ofrBilledYearly:    (price) => `${price} ditagih setahun sekali`,
  ofrSave:            (pct) => `−${pct}`,
  ofrSaveCap:         'dibanding bulanan',
  ofrWeekLater:       (time) => (time ? `Tunggu · +1 kredit pukul ${time}` : 'Tunggu isi ulang'),
  ofrWeekCta:         'Ulangi tanpa batas',
  ofrWeekFine:        (monthly) => `Batalkan kapan saja · atau ${monthly} per bulan`,
  // The step up to Max (MAX)
  ofrMaxKind:         'Max · tahunan',
  ofrMaxBill:         'Selisih dengan Pro-mu, secara prorata',
  ofrMaxCta:          'Tingkatkan ke Max',
  ofrMaxFine:         'Langsung berlaku · Batalkan kapan saja',
  ofrStayPro:         (when) => `Tetap di Pro · ${when}`,
  ofrNextCredit:      (time) => `+1 kredit pukul ${time}`,
  ofrTomorrow:        'besok lagi',
  ofrNextMonth:       (n, date) => `${n} lagi pada ${date}`,
  ofrInstead:         (n) => `bukan ${n}`,
  ofrFareEyebrow:     'Kredit hari ini habis',
  ofrFareTitle:       'Dengan Max, latihan tidak memakai kredit.',
  ofrFareWithPro:     'Dengan Pro',
  ofrFareWithMax:     'Dengan Max',
  ofrFareCredits:     'Kredit:',
  ofrFareIncluded:    'Latihan termasuk',
  ofrFareOne:         '1 kredit',
  ofrFareFree:        'Termasuk',
  ofrFareOut:         'Kredit habis',
  ofrFareStubCap:     'kredit per latihan',
  ofrValPhotos:       'foto per hari',
  ofrValExplains:     'penjelasan per hari',
  ofrValPapers:       'tryout baru per bulan',
  ofrPhotosCount:     'Foto hari ini',
  ofrPhotosEyebrow:   (n) => `${n} dari ${n} foto hari ini`,
  ofrPhotosTitle:     'Baca semua yang kamu temui.',
  ofrPhotosLede:      (max, pro) => `Dengan Max, ${max} foto per hari, bukan ${pro}, dan latihan tidak memakai kredit.`,
  ofrPhotosShut:      'Batas hari ini tercapai',
  ofrPhotosGloss:     'kecap asin',
  ofrPhotosStubCap:   'foto / hari',
  ofrExplCount:       'Penjelasan hari ini',
  ofrExplEyebrow:     (n) => `${n} dari ${n} penjelasan hari ini`,
  ofrExplTitle:       'Pahami setiap kalimat.',
  ofrExplLede:        (max, pro) => `Dengan Max, ${max} penjelasan per hari, bukan ${pro}, dan latihan tidak memakai kredit.`,
  ofrExplWait:        'Menjelaskan',
  ofrExplTranslation: '“Saya minum kopi di stasiun.”',
  ofrExplNotes:       ['“di stasiun”: tempat terjadinya', '“kopi”: yang diminum', 'bentuk sopan dari “minum”'],
  ofrExplStubCap:     'penjelasan / hari',
  ofrExamCount:       'Tryout baru bulan ini',
  ofrExamEyebrow:     (n) => `${n} dari ${n} tryout baru bulan ini`,
  ofrExamTitle:       'Tryout baru kapan pun kamu mau.',
  ofrExamLede:        (max, pro) => `Dengan Max, ${max} tryout baru per bulan, bukan ${pro}, dan semua tryout tanpa kredit.`,
  ofrExamPaper:       (level, n) => `${level} · tryout ${n}`,
  ofrExamNext:        'Tryout baru berikutnya',
  ofrExamOn:          (date) => `pada ${date}`,
  ofrExamNew:         'Baru',
  ofrExamSections:    ['Kosakata', 'Tata bahasa', 'Membaca', 'Menyimak'],
  ofrExamStubCap:     'tryout / bulan',
  ofrUpEyebrow:       'Paketmu: Pro tahunan',
  ofrUpTitle:         'Tingkatkan dari Pro ke Max.',
  ofrUpChanges:       'Yang berubah',
  ofrUpPractice:      'Latihan dan tryout',
  ofrUpPhotos:        'Foto dianalisis per hari',
  ofrUpExplains:      'Penjelasan per hari',
  ofrUpPapers:        'Tryout baru per bulan',
  ofrUpDecks:         'Dek · kartu',
  ofrUpCredit:        '1 kredit',
  ofrUpNoCredit:      'Tanpa kredit',
  ofrUpKeep:          'Tetap di Pro',
  import:            'Impor',
  export:            'Ekspor',
  exportFailed:      'Ekspor gagal',
  select:            'Pilih',
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
  platforms:   'Peron',
  // The wall map's two group captions: the sentence-practice lines,
  // and the halls you use rather than ride.
  mapPractice:   'Latihan',
  mapFacilities: 'Fasilitas',
  // The fare gate's filled action, and its phone-only disclosure.
  depart:      'Berangkat',
  breakdown:   'Rincian',
  // Hover text on a 種別 badge. Deliberately not "Local"/"Rapid" —
  // that is the railway word for the pips, and repeating it explains
  // nothing to somebody choosing a study mode. Each one says what the
  // rung actually asks of you.
  serviceLabel: {
    local:   'Semua perhentian — jawabannya ada di layar',
    rapid:   'Satu bantuan dilepas',
    express: 'Dari ingatan, dinilai sendiri',
    ltd:     'Ditulis tangan, tanpa petunjuk',
    review:  'Telusuri tanpa nilai, sesuai kecepatanmu',
  },
  tip:               'Sesi singkat dan rutin (15–20 menit) — penjadwal mengurus sisanya.',
  homeFeedDown:      'Data hari ini gagal dimuat — ketuk untuk mencoba lagi.',
  start:             'Mulai',
  homeTitle:         'Beranda',
  homeDesc:          'Kembali ke menu utama',
  kanaTitle:         'Kana',
  kanaDesc:          'Hiragana dan katakana, bunyi demi bunyi\nMengenali dulu, lalu menulis dengan tangan\nLandasan tempat semua yang lain berpijak',
  vocabTitle:        'Kosakata JLPT',
  kanjiTitle:        'Kanji',
  dictionaryTitle:   'Kamus',
  dictionaryDesc:    'Kanji, kana, atau kata apa pun\nCara baca, radikal, urutan goresan, contoh\nDan apakah kamu pernah menemuinya',
  grammarTitle:      'Tata bahasa',
  grammarDesc:       'Semua pola JLPT, dari N5 hingga N1\nMenempel pada apa, dan apa fungsinya\nBeserta kalimat yang memakainya dengan tepat',
  statsTitle:        'Statistik',
  statsDesc:         'Apakah bertahan, minggu demi minggu\nSeberapa jauh ke depan jadwal tiap kartu\nDan di mana bocornya',
  decksTitle:        'Dekmu',
  decksDesc:         'Kartumu sendiri, dijadwalkan seperti yang lain\nTulis di sini atau impor tabel\nBercampur dengan materi bawaan',
}

// ── Quiz shared ───────────────────────────────────────────
const quiz = {
  // Kana sets
  hiraganaBase:         'Hiragana (dasar)',
  hiraganaCombinations: 'Hiragana (kombinasi)',
  katakanaBase:         'Katakana (dasar)',
  katakanaCombinations: 'Katakana (kombinasi)',

  // Selection prompts
  selectLevel:       'Pilih level JLPT-mu',
  selectMode:        'Pilih cara belajar',
  selectKanaSet:     'Pilih set kana',
  selectPhase:       'Pilih fase latihanmu',

  byLevel:           'JLPT',
  byLevelDesc:       'Lima level resmi ujian ini, dari N5 sampai N1',
  byFrequency:       'Frekuensi kata',
  byFrequencyDesc:   'Diurutkan menurut frekuensi sebenarnya dalam tulisan',
  // The same axis one line over, where what is ranked is the
  // characters rather than the words (see KanjiScreen.jsx).
  byFrequencyKanji:     'Frekuensi kanji',
  byFrequencyKanjiDesc: 'Diurutkan menurut frekuensinya dalam tulisan',
  // Kanji's third study source (plan 086): the 214 Kangxi radicals as
  // a way in — a lesson on the radical, then its family of kanji. See
  // KanjiScreen.jsx / RadicalLesson.jsx.
  byRadical:            'Radikal',
  byRadicalDesc:        'Unsur pembentuk kanji — satu radikal, lalu setiap kanji yang memakainya',
  byMastery:         'Kartuku',
  byMasteryDesc:     'Hanya dari kata yang sudah pernah kamu temui',
  // Vocabulary's third study-source option — every JMdict word outside
  // the JLPT curriculum, ranked by frequency (see VocabScreen.jsx).
  byJmdict:          'Di luar JLPT',
  byJmdictDesc:      'Semua di luar silabus, yang paling umum lebih dulu',
  selectStudySource: 'Pilih sumber belajarmu',
  selectTier:        'Pilih tingkat frekuensi',
  kanjiUnit:         'kanji',
  loadError:         'Tingkat frekuensi gagal dimuat. Coba lagi.',
  // Label for the Top 100/200/500/1000 size toggle above a tier list
  // (see TierSelector.jsx) — aria-label only, not visible text.
  tierSizeLabel:     'Ukuran tingkat',

  // Vocabulary's third study-source option, alongside byLevel/
  // byFrequency — thematic decks (Fruits, Jobs, Body parts, ...), see
  // ThemeSelector.jsx / theme_data.py.
  byTheme:           'Menurut tema',
  byThemeDesc:       'Dikelompokkan per topik — makanan, pekerjaan, perjalanan, tubuh',
  selectTheme:       'Pilih tema',
  // Placeholder/aria-label for ThemeSelector's filter box (only shown
  // once there are more than a handful of themes to scroll through).
  filterThemes:      'Saring tema…',
  // Shown when a theme filter query matches nothing — distinct from
  // dictionary's `noResults` above, which is followed by the query
  // term ("No results for {query}") rather than standing alone.
  themeNoResults:    'Tidak ada tema yang cocok dengan filtermu',

  // The four levels inside a theme, placed by difficulty (see
  // backend/content/theme_data.py). The Japanese half of each name lives
  // in domain/themes.js — it is the same in every language.
  themeLevelBasic:    'Dasar',
  themeLevelMedium:   'Menengah',
  themeLevelAdvanced: 'Lanjutan',
  themeLevelExpert:   'Ahli',
  selectThemeLevel:   'Pilih level',
  leaveThemeLevels:   'Level',

  // Theme display labels — key is `theme_data.list_themes()`'s `key`
  // camelCased and prefixed with `theme` (see ThemeSelector.jsx's
  // _translationKey), so a theme added to build_theme_db.py only
  // needs its matching line added here (and in every other language
  // file) to get a real label instead of ThemeSelector's raw-key
  // fallback.
  themeFruits:           'Buah-buahan',
  themeVegetables:       'Sayuran',
  themeBodyParts:        'Bagian tubuh',
  themeRooms:            'Ruangan',
  themeBuildings:        'Bangunan',
  themeFurniture:        'Perabot',
  themeSchool:           'Sekolah',
  themeTravel:           'Perjalanan',
  themeJobs:             'Profesi',
  themeDishes:           'Hidangan',
  themeAnimals:          'Hewan',
  themeColors:           'Warna',
  themeClothing:         'Pakaian',
  themeWeather:          'Cuaca',
  themeFamily:           'Keluarga',
  themeEmotions:         'Perasaan',
  themeNature:           'Alam',
  themeVehicles:         'Kendaraan',
  themeTechnology:       'Teknologi',
  themeSports:           'Olahraga',
  themeMusic:            'Musik',
  themeKitchenItems:     'Peralatan dapur',
  themeOfficeSupplies:   'Alat tulis kantor',
  themeShoppingMoney:    'Belanja & uang',
  themeGeography:        'Geografi',
  themeInsectsBugs:      'Serangga',
  themeBirds:            'Burung',
  themeSeafood:          'Makanan laut',
  themeDrinks:           'Minuman',
  themeShapes:           'Bentuk',
  themeMaterials:        'Bahan',
  themeTools:            'Perkakas',
  themeMedical:          'Medis',
  themePlantsTrees:      'Tumbuhan & pohon',
  themeHouseholdItems:   'Barang rumah tangga',
  themeHolidaysEvents:   'Hari raya & acara',

  levelHintN5:       'Level pemula',
  levelHintN4:       'Level dasar',
  levelHintN3:       'Level menengah',
  levelHintN2:       'Level lanjutan',
  levelHintN1:       'Level mahir',

  // Input
  submit:            'Kirim',
  typeRomaji:        'Ketik romaji…',
  tapToFlip:          'Ketuk untuk membalik',
  tapToReveal:         'Ketuk untuk membuka',
  // A Kanji → meaning card's front says what it asks (plan 276).
  askKanjiMeaning:     'Apa artinya?',
  // The desk's hint (plan 113): a key cap, then the words after it.
  keySpace:            'Spasi',
  revealByKey:         'untuk membuka',
  // The run's panel, beside a card on the desk (plan 114).
  deskRunLabel:        'Perjalanan ini',
  deskEarned:          'Diperoleh',
  deskEntryWait:       'Entri kamus muncul di sini setelah kartu dibuka.',
  deskMissesTitle:     'Perlu dilihat lagi',
  deskBreakdownLabel:  'Rincian',
  deskPassageLabel:    'Teks',
  // The run on three panels (plan 126): the session panel, the card panel
  // (what each verdict decides, the rhythm, the keys), and the details
  // sealed before the reveal.
  deskRemaining:       'Sisa',
  deskCardPanel:       'Kartu ini',
  forecastIn:          span => `dalam ${span}`,
  forecastTomorrow:    'besok',
  forecastMinutes:     n => `${n} menit`,
  forecastHours:       n => `${n} jam`,
  forecastDays:        n => `${n} hari`,
  forecastWeeks:       n => `${n} minggu`,
  forecastMonths:      n => `${n} bulan`,
  forecastYears:       n => `${n} tahun`,
  // The wait as a figure, on the tile: the unit beside the number.
  forecastUnit:        unit => ({ minute: 'menit', hour: 'jam', day: 'hari', week: 'minggu', month: 'bulan', year: 'tahun' })[unit],   // one form for any n
  deskKeysTitle:       'Tombol',
  deskKeysHelp:        'Bantuan',
  deskKeyTurn:         'membalik kartu',
  deskKeyChoices:      'menampilkan pilihan',
  deskKeyLeave:        'keluar dari perjalanan',
  deskKeyAddReading:   'menambah cara baca',
  deskKeyCheck:        'memeriksa',
  deskRhythm:          'Ritme',
  deskElapsed:         'Durasi',
  deskPerMinute:       'Kartu / menit',
  deskToFinish:        'Sampai selesai',
  deskSealed:          'Entri muncul saat kartu dibuka.',
  keyEnter:            'Enter',
  keyEscape:           'Esc',
  // A percentage (the HUD's status, an exam's score, the report): French
  // sets a no-break space before the sign, English none.
  percent:             n => `${n}%`,
  deskWayUp:           'Naik satu tingkat',
  deskBreakdownWait:   'Rincian kalimat muncul di sini setelah kamu menilai jawabanmu.',
  // An exercise on three panels (plan 129): the run's sentences, each with
  // the grade it got, and an exercise's keys.
  deskLinesLabel:      'Kalimat dalam perjalanan ini',
  deskLinesNow:        'sekarang',
  deskLinesRated:      'Kalimat',
  deskQuestionsRated:  'Soal',
  deskPerMinuteLines:  'Kalimat / menit',
  deskAnswered:        'Dijawab',
  deskKeyCheckNext:    'memeriksa, lalu lanjut',
  deskKeyRate:         'menilai jawabanmu',
  deskKeyListen:       'memutar kalimat',
  deskKeyReveal:       'menampilkan kalimat',
  deskKeyPick:         'memilih jawaban',
  deskKeyNext:         'soal berikutnya',
  deskKeyWalk:         'menelusuri soal',
  // 問 — a question about the exercise, on the desk (plan 131) and, on a
  // phone, on a page of its own (plan 197): open once the answer is graded,
  // short, precise, about this exercise only.
  askTitle:            'Pertanyaan',
  askOpen:             'Ajukan pertanyaan',
  askPlaceholder:      'Pertanyaanmu…',
  askSealed:           'Pertanyaan dibuka setelah jawabanmu dinilai.',
  askSealedText:       'Pertanyaan dibuka bersama hasilnya.',
  askSealedTour:       'Pertanyaan dibuka setelah perhentian ini dijawab.',
  askHint:             'Jawaban singkat dan tepat, tentang latihan ini.',
  askSend:             'Tanya',
  askThinking:         'Menjawab',
  askOffTopic:         'Aku hanya menjawab pertanyaan tentang latihan ini.',
  askUnavailable:      'Jawaban sedang tidak tersedia.',
  askFailed:           'Jawaban tidak sampai. Coba lagi.',
  askSpent:            at => (at ? `Pertanyaan hari ini sudah habis: tersedia lagi pukul ${at}.` : 'Pertanyaan hari ini sudah habis.'),
  askLeft:             n => `Sisa ${n} pertanyaan hari ini`,
  askFull:             'Itu saja untuk kalimat ini.',
  askSuggestLabel:     'Saran pertanyaan',
  askSugContrast:      (a, b) => `Mengapa ${a}, bukan ${b}?`,
  askSugMarks:         p => `Apa yang ditandai ${p} di sini?`,
  askSugPoint:         p => `Bagaimana ${p} digunakan?`,
  askSugExample:       w => `Contoh lain dengan ${w}?`,
  askSugPolite:        'Bagaimana mengatakannya dengan lebih sopan?',
  askSugCasual:        'Dan kalau santai, antarteman?',
  askSugWhyRight:      'Mengapa ini jawaban yang benar?',
  askSugWhere:         'Di bagian mana teks menyebutkannya?',

  // Feedback — the ❌/✅/← glyphs these used to carry inline are now
  // real <Icon/>s rendered by whatever shows the text (see
  // QuizComponents.jsx's TypeInput/DoneMessage), not baked into the
  // string.
  wrong:             'Jawaban:',
  quizComplete:      'Semua kartu sudah beres!',
  backToMenu:        'Kembali ke menu',

  // Rating bar. The plain-language captions; the Japanese quality terms
  // that pair with them (plan 045's rebuilt bar) are `ratingJp` below —
  // the term itself, identical in every language. Plan 045's
  // mockup restates wrongSeen as ALMOST (clearer against 惜しい than the
  // original "Wrong (seen)"). Easy (5), Missed (1) and Forgot (0) replaced
  // Perfect, Wrong and Blackout when the four-button bar became
  // Missed / Difficult / Correct / Easy.
  to:                'sampai',
  easy:              'Mudah',
  correctHesit:      'Benar',
  difficult:         'Sulit',
  wrongSeen:         'Hampir',
  wrongRated:        'Salah',
  forgot:            'Lupa',
  ratingJp: {
    easy:            '簡単',
    correctHesit:    '正解',
    difficult:       '難しい',
    wrongSeen:       '惜しい',
    wrongRated:      '不正解',
    forgot:          '忘れた',
  },

  // Mode labels
  modeQCM:           'Pilihan ganda',
  modeFlashcard:     'Kartu hafalan',
  modeFill:          'Isian',
  // Extended mode labels used by vocab/kanji screens
  modeWrite:         'Menulis',
  // Stats format axis: typed on a keyboard, as against drawn by hand.
  modeType:          'Mengetik',
  radicalNumber:       'Radikal',
  // grammar b2f: the meaning is shown, recall the rule.
  revealGrammarRule:   'Aturan apa ini?',
  revealGrammarBtn:    'Tampilkan aturan',
  standardType:        'Standar',
  standardDesc:        'Sisi depan dan belakang, kamu tulis sendiri.',
  // ── Personal card fields (generated form, see study/structures.py) ──
  field_front:      'Depan',
  field_back:       'Belakang',
  field_kanji:      'Kanji',
  field_meaning:    'Arti',
  field_readings:   'Cara baca',
  field_radical:    'Radikal',
  field_word:       'Kata',
  field_reading:    'Cara baca',
  field_kana:       'Kana',
  field_romaji:     'Rōmaji',
  field_rule:       'Aturan tata bahasa',
  field_sentences:  'Kalimat contoh',
  field_sentences_group: 'Kalimat contoh',
  field_sentences_jp: 'Kalimat bahasa Jepang',
  field_sentences_tr: 'Terjemahan',
  field_rule_reading: 'Cara baca aturan',
  field_structure:  'Pembentukan',
  field_register:   'Ragam bahasa',
  field_explanation: 'Penjelasan',
  field_usage:      'Penggunaan',
  field_careful:    'Hati-hati',
  field_compare:    'Aturan serupa',
  field_compare_group: 'Aturan serupa',
  field_compare_pattern: 'Aturan serupa',
  field_compare_text: 'Perbedaannya',
  field_notes:      'Catatan',
  fieldHint_rule_reading: 'Cara bacanya, dalam kana — mis. 〜のなかで (opsional)',
  fieldOff_rule_reading: 'Cara baca ini tidak cocok dengan aturannya: tulis setiap kanji dalam kana, sisanya apa adanya.',
  fieldHint_structure:   'Pembentukan — mis. kata kerja bentuk て + ください',
  fieldHint_explanation: 'Fungsi aturan ini. **tebal** untuk menegaskan.',
  fieldHint_usage:       'Satu penggunaan per baris, diawali "- "',
  fieldHint_careful:     'Sering tertukar dengan apa, apa yang harus dihindari',
  pickRadical:      'Pilih radikal',
  // ── 読み入力 (kanji.readings) ──
  readingsOn:          'On (asal Tionghoa)',
  readingsKun:         'Kun (asli Jepang)',
  // The two fields' labels on a car's face (plan 251, LinePlatforms).
  readingsOnTag:       'On',
  readingsKunTag:      'Kun',
  readingsAdd:         'tambah cara baca',
  readingsRemove:      (r) => `Hapus ${r}`,
  readingsFound:       'ditemukan',
  readingsWrong:       'salah',
  readingsMissed:      'terlewat',
  readingsPlaceholder: 'kana atau romaji',
  readingsCap:         'Kartu ini menampung paling banyak 15 cara baca.',
  modeWriteDesc:     'Hanya artinya yang tampil. Gambar karakternya goresan demi goresan.',
  // Parameterised on what the studied item is called ("kanji" or
  // "word" — see kanjiNoun/wordNoun below and vocabKanjiModes in
  // quizModes.js). These were fixed strings saying "kanji" no matter
  // which screen showed them, so the vocabulary mode picker announced
  // "MCQ (kanji → meaning)" for a deck of words.
  modeQcmKjM:        (noun) => `Pilihan ganda (${noun} → arti)`,
  modeQcmKjMDesc:    (noun) => `Sebuah ${noun} ditampilkan. Pilih artinya dari empat pilihan.`,
  modeQcmMKj:        (noun) => `Pilihan ganda (arti → ${noun})`,
  modeQcmMKjDesc:    (noun) => `Artinya ditampilkan. Pilih ${noun} yang tepat dari empat pilihan.`,
  modeFcKjM:         (noun) => `Kartu hafalan (${noun} → arti)`,
  modeFcKjMDesc:     (noun) => `Hanya ${noun} yang tampil. Ingat artinya, lalu periksa.`,
  modeFcMKj:         (noun) => `Kartu hafalan (arti → ${noun})`,
  modeFcMKjDesc:     (noun) => `Hanya artinya yang tampil. Ingat ${noun} yang tepat, lalu periksa.`,

  // ── Merged recall modes (deck study) ──
  // A deck offers one entry per direction instead of an MCQ one and a
  // flashcard one, because those were the same question asked with two
  // different amounts of help — and the help is now a switch on the
  // card itself. See StudyScreen's MERGED_MODES.
  modeRecallKjM:     'Kata → arti',
  modeRecallMKj:     'Arti → kata',
  modeRecallGrammar: 'Pola → arti',
  modeRecallDesc:    'Ingat sendiri, atau tampilkan empat pilihan — ganti kapan saja.',
  assistOff:         'Tampilkan pilihan',
  assistOn:          'Sembunyikan pilihan',
  assistUnavailable: 'Kartu buatanmu — ingat dan nilai sendiri',

  modeFcKanaDesc:     'Hanya kana yang tampil. Ucapkan bunyinya, lalu periksa.',
  modeQcmKanaDesc:    'Kana ditampilkan. Pilih bunyinya dari empat pilihan.',
  modeWriteKanaDesc:   'Bunyinya diberikan. Gambar kana yang tepat.',

  modeFcGrammarDesc:   'Hanya polanya yang tampil. Ingat fungsinya, lalu periksa.',
  modeQcmGrammarDesc:  'Pola ditampilkan. Pilih fungsinya dari empat pilihan.',
  modeFillGrammarDesc: 'Kalimat yang polanya dihapus. Pasang kembali.',

  // "Review your cards" — a self-paced, ungraded browse over cards
  // already studied in this deck (see ReviewDeck.jsx). Appended to
  // every mode picker alongside modeQCM/modeFlashcard/etc.
  modeReview:        'Pengulangan',
  modeReviewDesc:    'Telusuri yang sudah kamu tahu. Tanpa penilaian, tanpa penjadwalan ulang.',
  reviewEmpty:       'Kamu belum mempelajari satu pun kartu ini — kembalilah setelah sesi pertamamu.',
  reviewPrev:        'Sebelumnya',
  reviewNext:        'Berikutnya',

  // Writing practice
  writingPractice:   'Latih menulis kanji ini',
  toggleWriting:     'Aktifkan/nonaktifkan latihan menulis',
  yourDrawing:       'Gambarmu',
  strokeOrder:       'Urutan goresan',
  strokeZoom:        'Perbesar urutan goresan',
  strokeWatch:       'Tonton',
  strokeGuided:      'Dipandu',
  strokeFree:        'Bebas',
  strokeAgain:       'Jiplak lagi',
  continueBtn:       'Paham, lanjut',
  eraseBtn:          'Hapus',

  // Misc
  strokes:           'goresan',
  notAvailable:      'Tidak tersedia',
  noMeaningRecorded: 'Tidak ada arti yang tercatat',
  vocabulary:        'Kosakata',
  kanji:             'Kanji',

  // Grammar screen
  revealMeaning:     'Apa arti aturan ini?',
  revealSentence:    'Lengkapi kalimat di bawah ini',
  revealMeaningBtn:  'Lihat arti',
  showExamples:      'Tampilkan contoh',
  hideExamples:      'Sembunyikan contoh',

  // XpToast
  levelUp:          'Naik level!',
  levelShort:       'Lv',
  // 上下 (plan 174): the run's meter under the head, for a screen reader.
  runMeter:          (n, total) => (total == null ? `${n} dinilai` : `${n} dari ${total}`),

}

// ── Stats ─────────────────────────────────────────────────
const stats = {
  statistics:        'Statistik',
  // ── 本日の運行 — the daily queue (screens/TodayScreen) ──────
  todayTitle:         'Perjalanan hari ini',
  todayDesc:          'Semua yang perlu diulang, dari setiap bagian, dalam satu antrean.',
  todayBoard:         'Hari Ini',
  todayPickHint:      'Pilih yang akan diulang',
  todayLines:         'Jalur hari ini',
  todayPickSomething: 'Pilih setidaknya satu',
  todayStart:         n => `Ulangi ${n} kartu`,
  todayAllTypes:      'Semua',
  todaySearchPlaceholder: 'Cari jalur…',
  todayLaneCount:     n => `${n} layanan`,
  todayNoMatch:       'Tidak ada jalur yang cocok.',
  todayNoMatchHint:   'Coba nama lain, atau hapus filter.',
  todayClearFilters:  'Hapus filter',
  todayDue:           n => `${n} perlu diulang`,
  todayNothingDueShort: 'Semua beres',
  todayRemaining:     'Sisa di perjalanan ini',
  todayNothingDue:    'Tidak ada yang perlu diulang saat ini.',
  todayNextReview:    when => `Pengulangan berikutnya ${when}.`,
  backToStation:      'Kembali ke stasiun',
  fareGate:           'Gerbang tiket',
  dueUnit:            'perlu diulang',
  newUnit:            'baru',
  learningUnit:       'sedang dipelajari',
  learnedLabel:       'Sudah dipelajari',   // a platform's figure, read out (plan 184)
  // The sources on the desk (plan 267): the gate at the end of JLPT's
  // line, and what is left to see of the level it resumes.
  sourcesResume:      'Lanjutkan',
  unseenNote:         n => `${n} belum dilihat`,
  tierWords:          range => `Kata ${range}`,
  // The origin of every Learn line: where you stand before a level is
  // finished (domain/lineProgress.js's ORIGIN_STOP).
  originStop:         'Pemula',
  stageGate:          'Gerbang',
  nothingGraded:      'Tanpa penilaian',
  stationJlpt:        'JLPT',
  // The sub over vocabulary's and kanji's source page. Terse, like
  // every other sub on a station: it names the page you are on, and
  // the cards under it do the asking. (The practice sections put the
  // whole question up there instead -- selectStudySource -- because
  // their bar carries no other sub to be consistent with.)
  stationSources:     'Sumber',
  // The same, over かな's set list: the sets are the line's stops, so
  // the sub names them and the bar's other end is the way out.
  stationSets:        'Set',
  byFrequencyShort:   'Menurut frekuensi',
  byThemeShort:       'Menurut tema',
  byRadicalShort:     'Menurut radikal',
  leaveLevels:        'Level',
  leaveRadicals:      'Radikal',
  // ── The radical lesson (plan 086) ──
  radLesson:          'Radikal',
  radFamily:          'Kanji dengan radikal ini',
  radForms:           'Bentuk',
  // Where the component usually sits in a character, by the seven
  // traditional positions (backend/content/radical_info.py).
  radPosition: {
    hen:     'di sisi kiri',
    tsukuri: 'di sisi kanan',
    kanmuri: 'melintang di atas',
    ashi:    'di sepanjang bawah',
    kamae:   'di sekeliling sisi luar',
    tare:    'di atas lalu turun di sisi kiri',
    nyou:    'di sisi kiri lalu sepanjang bawah',
  },
  radPositionJp: { hen: '偏', tsukuri: '旁', kanmuri: '冠', ashi: '脚', kamae: '構', tare: '垂', nyou: '繞' },
  radPositionNote:    where => `Sebagai komponen, radikal ini biasanya berada ${where} kanji`,
  radNoPositionNote:  'Sebagai komponen, radikal ini tidak memiliki tempat tetap dalam kanji.',
  radFamilyShort:     'Kanji yang memakainya',
  radNoKanji:         'Kursus ini belum mengajarkan kanji yang memakainya.',
  leaveSets:          'Set',
  leaveTiers:         'Tingkat',
  leaveThemes:        'Tema',
  leaveDecks:         'Dek',
  leaveDeck:          'Dek',
  // ── Practice (plan 072) ──
  leaveSources:       'Sumber',
  leaveExam:          'Tryout',
  compBackToQuestions: 'Kembali ke soal',
  practiceResult:     'Hasil',
  reference:          'Referensi',
  // ── Dictionary and the analyzer (plan 073) ──
  dictCollections:    'Koleksi',
  analyzerDoorSub:    'Teks, foto, video',
  passagesCount: (n) => `${n} bacaan`,
  sentencesCount: (n) => `${n} kalimat`,
  leaveAnalyzer:      'Penganalisis',
  furiganaCap:        'Furigana',
  newDeck:            'Dek baru',
  cardsUnit: (n) => `${n} kartu`,
  // ── Profile, statistics and settings (plan 074) ──
  // ── 統計, the service record (plan 085) ──
  reportRetention:    'Retensi',
  reportThisWeek:     'minggu ini',
  reportWeeksAgo:     w => `${w} minggu lalu`,
  reportDelta:        (n, w) => `${n > 0 ? '+' : n < 0 ? '−' : '±'}${Math.abs(n)} · ${w} minggu`,
  reportWeekOf:       (date, n) => `minggu mulai ${date} · ${n} pengulangan`,
  reportRungs:        ['<1 hr', '1 mgg', '1 bln', '3 bln', '3 bln+'],
  reportStrengthSummary: n => `${n} kartu menurut seberapa jauh jadwalnya ke depan`,
  reportMisses:       (n, d) => `kesalahan · ${d} hari`,   // one form for any n
  // ── 路線別, the record's lines (plan 138) ──
  reportWeekStart:    d => `minggu mulai ${d}`,
  reportReviewsCap:   'pengulangan',
  reportPointOf:      (when, n) => `${when} · ${n} pengulangan`,
  reportLineReviews:  n => `${n} pengulangan`,
  reportToReview:     'Perlu diulang',
  reportNoMiss:       'Tidak ada kesalahan',
  reportLineEmpty:    'Belum ada pengulangan',
  reportCell:         (mode, deck, pct, n) => `${mode} · ${deck} · ${pct}% · ${n} pengulangan`,
  reportCellNone:     (mode, deck) => `${mode} · ${deck} · belum diulang`,
  reportTile:         (head, deck, mode, pct, lapses) => `${head} · ${deck} · ${mode} · ${pct}% · ${lapses} kesalahan`,
  reportEmpty:        'Belum ada pengulangan',
  reportEmptyHint:    'Garisnya muncul setelah minggu pertama pengulangan.',
  startedNote:     n => `${n} dimulai`,
  reportError:        'Catatan tidak dapat dibaca',
  daysUnit:           () => 'hari',   // one form for any n
  balanceRefillLine:  (at) => `+1 pukul ${at}`,
  balanceRefillRate:  (min) => `+1 setiap ${min} menit`,
  perDayUnit:         '/ hari',
  // ── The status sheet's head and its two comparison rows ──
  // The four-figure lattice (Last 14 days / Promised / At this pace /
  // On the pass) retired with the 進捗が主役 round: two of its cells
  // were one comparison and two were another, and it left both
  // subtractions to the reader. These say the same four numbers as
  // two rows that carry their own difference.
  statusPace:         'Tempo',
  statusArrival:      'Kedatangan',
  statusPromisedPace: (p) => `dijanjikan ${p} / hari · 14 hari terakhir`,
  statusOnPassDate:   (d) => `di Pass, ${d}`,
  statusDaysDelta:    (n) => `${n > 0 ? '+' : '−'}${Math.abs(n)} hari`,
  statusNextStop:     (stop) => `Perhentian berikutnya ${stop}`,
  statusArrived:      'Jalur selesai',
  statusBehindPlan:   (n) => `kurang ${n} dari rencana`,
  statusAheadPlan:    (n) => `lebih ${n} dari rencana`,
  settingsGoalNoneShort: 'Tanpa tujuan',
  soundPresets:       'Setelan cepat',
  soundValueQuiet:    'Stasiun senyap',
  soundValueFull:     'Stasiun ramai',
  soundValueMixed:    'Kustom',
  soundQuietHint:     'tanpa suara latar, tanpa jingle',
  soundFullHint:      'suara latar dan pengumuman',
  soundOn:            'Suara aktif',
  soundOff:           'Suara nonaktif',
  soundOffHint:       'Tidak ada yang berbunyi, apa pun pengaturannya.',
  soundMixer:         'Pencampur suara',
  levelName:          { N5: 'Pemula', N4: 'Dasar', N3: 'Menengah', N2: 'Lanjutan', N1: 'Mahir' },
  settingsPaceCap:    'Item baru per hari',
  settingsPaceOwn: 'Kustom',
  settingsPaceLess: 'Kurangi satu per hari',
  settingsPaceMore: 'Tambah satu per hari',
  settingsPaceCustom: n => `Lajumu diatur ke ${n} per hari.`,
  paceName:           { local: 'Lokal', rapid: 'Cepat', express: 'Ekspres' },
  levelUpTitle:       l => `Naik ke ${l}?`,
  levelUpBody:        (to, weeks) => `Perhentian sebelum ${to} ditandai **sudah dikenal**: kartunya langsung dianggap dikuasai, dengan pemeriksaan pertama yang disebar dalam ${weeks} minggu ke depan. Kartu yang sedang kamu pelajari tetap di tempatnya. **Tidak ada yang dihapus.**`,
  levelDownTitle:     l => `Turun ke ${l}?`,
  levelDownBody:      (to, returned) => (returned > 0
    ? `Yang kamu pelajari di atas ${to} disisihkan, tidak dihapus. Kartu yang ditandai sudah dikenal dari ${to} ke atas dan belum pernah ditanyakan kepadamu kembali menjadi **baru**.`
    : `Kartu di atas ${to} disisihkan, tidak dihapus: riwayatnya tetap ada dan kartu itu kembali ke perjalanan saat kamu naik lagi. Perjalanan hari ini kini hanya mencakup perhentian ${to}.`),
  levelMarkedKnown:   'Ditandai dikenal',
  levelSpreadOver:    'Disebar selama',
  levelWeeks:         n => `${n} minggu`,
  levelSetAside:      'Disisihkan',
  levelDeleted:       'Dihapus',
  levelBackToNew:     'Kembali menjadi baru',
  levelUpGo:          l => `Naik ke ${l}`,
  levelDownGo:        l => `Turun ke ${l}`,
  levelStay:          l => `Tetap di ${l}`,
  // 主 — the mode each line is ridden in (plan 273), Settings › Main
  // modes and its confirm sheet.
  settingsModes:      'Mode utama',
  settingsModesValue: 'Satu per jalur',
  settingsModesHint:  'Hari Ini mengajarkan setiap jalur dalam mode utamanya. Tambahkan mode lainnya di sampingnya, di sini atau dari Hari Ini.',
  settingsModesAlso:  'Juga di Hari Ini',
  modeSwitchTitle:    mode => `Belajar dengan “${mode}”?`,
  modeSwitchBody:     (from, to, weeks) => `Pertahankan yang sudah kamu kuasai di **${from}**: kartu-kartu itu ditandai sudah dikenal di **${to}**, dengan pemeriksaan pertama yang disebar dalam ${weeks} minggu ke depan. Atau mulai dari nol: semua kartu menjadi baru di **${to}**. Apa pun pilihannya, **tidak ada yang dihapus.**`,
  modeSwitchBodyNone: to => `Semua kartu menjadi baru di **${to}**, dan Hari Ini dimulai dari kartu yang belum pernah kamu temui. **Tidak ada yang dihapus.**`,
  modeSwitchGo:       mode => `Beralih ke “${mode}”`,
  modeSwitchKeep:     'Pertahankan yang sudah kutahu',
  modeSwitchFresh:    'Mulai dari nol',
  fitDown: (to, passed, answered) => `${to} · ${passed} dari ${answered} pemeriksaan lulus`,
  fitUp: (level, known, met) => `${level} · ${known} dari ${met} kata baru sudah dikenal`,
  fitDownGo: to => `Berangkat dari ${to}`,
  fitUpGo: to => `Coba ${to}`,
  destOnPass:         'Di Pass',
  destService:        'Layanan',
  destDailyRide:      'Perjalanan harian',
  destOptional:       'Opsional',
  destHour:           { am: 'Pagi', noon: 'Siang', pm: 'Malam' },
  destFlexible:       'Fleksibel',
  destAnyTime:        'kapan saja',
  destValidUntil:     'Berlaku sampai',
  destMovesTo:        date => `bergeser ke ${date} dengan tempo hari ini`,
  destReprint:        'Cetak ulang',
  compNote: (you, right) => `Kamu · ${you} — benar · ${right}`,
  // A text handed back past the day's ceiling on new ones (plan 301).
  compReadBefore: 'Sudah dibaca',
  examPart: (n) => `Bagian ${n}`,
  serviceName: {
    local:   'Lokal',
    rapid:   'Cepat',
    express: 'Ekspres',
    ltd:     'Kilat',
    review:  'Pengulangan',
  },
  decksRowMeta:       (decks, cards) => `${decks} dek · ${cards} kartu`,
  deckMore:           'Lainnya',
  deleteDeck:         'Hapus dek',
  cardsCount:         n => `${n} kartu`,
  freqDomainDeck:     'Kata JLPT',
  freqDomainJmdict:   'Di luar JLPT',
  resetStats:        'Atur ulang semua',
  resetConfirm:      'Hapus semua kemajuan? Ini tidak bisa dibatalkan.',
  kana:              'Kana',
  jlptVocab:         'Kosakata JLPT',
  globalSummary:     'Ringkasan keseluruhan',
  new:               'Baru',
  learning:          'Sedang dipelajari',
  mastered:          'Dikuasai',
  dueNow:            'Perlu diulang',
  // The same state as dueNow, in the record cell that owns the
  // schedule: a figure, so one word rather than a phrase (plan 089).
  dueValue:          'Sekarang',
  reviewThisCard:    'Ulangi kartu ini',
  // The entry's record (plan 235): the schedule's cell, when the card is
  // due, is the door to its review; and the word that replaces JMdict's
  // star on a common word.
  dictReview:        'Ulangi',
  dictCommon:        'umum',
  total:             'Jumlah',
  overview:        'Ikhtisar',
  streak:          'Runtunan',
  resultNotSaved:  'Jawaban ini tidak dapat disimpan ke catatanmu dan tidak akan muncul di sana.',
  runStreak:       (n, best) => `${n} beruntun · terbaik ${best}`,
  accuracy:        'Akurasi',
  dueToday:        'Perlu diulang hari ini',






}

// ── Phrases analyser ────────────────────────────────────────────
const phraseAnalyzer = {
  // 解析駅 — the merged analyser (plan 027). One station, three
  // platforms: 文字 / 写真 / 動画. The phraseAnalyzer* keys below are
  // kept for now; they still name the section wherever the old copy
  // has not been retired yet.
  analyzerTitle:       'Penganalisis',
  analyzerDesc:        'Bahasa Jepang apa pun yang kamu temui\nDiketik, difoto, atau dari subtitle\nDiuraikan kata demi kata',
  sourceText:          'Teks',
  sourcePhoto:         'Foto',
  sourceVideo:         'Video',
  sourceTextHint:      'Ketik atau tempel teks Jepang',
  sourcePhotoHint:     'Ambil foto atau unggah gambar',
  sourceVideoHint:     'Tautan YouTube dan subtitle-nya',
  // 運行履歴 (plan 040) — the stamp and count for a session row in the
  // merged history list.
  sourceVideoShort:    'Dari video',
  sessionSentenceCount: n => `${n} kalimat`,
  platformUnit:        'Peron',
  platformNumber:      n => `peron ${n}`,
  // 路線図 (plan 028) — the Passage drawn as a line whose stops are its
  // Sentences, one of them open at a time.
  routeMap:            'Peta jalur',
  stopsInPassage:      n => `${n} kalimat`,
  stopNumber:          (i, n) => `Kalimat ${i} dari ${n}`,
  // 追従 (plan 034) — following the video's clock along the line.
  followPlayback:      'Ikuti video',
  // 改札口 (plan 029) — the three intakes.
  intakeTextLead:      'Ketik atau tempel teks Jepang apa pun.',
  intakePhotoLead:     'Halaman, papan petunjuk, tangkapan layar — apa pun yang bertuliskan bahasa Jepang.',
  intakeVideoLead:     'Tempel tautannya, biarkan bookmark 字幕取り mengambil subtitle-nya — atau seret file ke sini.',
  shootPhoto:          'Ambil foto',
  pickPhoto:           'Pilih',
  charCount:           n => `${n} karakter`,
  // Must agree with routes/video.py:50 (_MAX_UPLOAD_BYTES = 1 MB).
  subtitleAccepted:    'SRT, VTT, ASS, LRC, dan TXT · hingga 1 MB',
  windowLabel:         'Bagian',
  windowFrom:          'Dari',
  windowTo:            'Sampai',
  windowFormatHint:    'mm:ss atau detik',
  // 改札口 / mining copy (2026-08-27). "Mine" and "cloze" were both
  // jargon on the primary action of the screen; these say what the
  // buttons do instead.
  notJapaneseLine:     'Bukan bahasa Jepang — ditampilkan seperti di subtitle, tanpa rincian.',
  notJapaneseShort:    'bukan bahasa Jepang',
  addToDeck:           'Tambahkan ke dek',
  cardOptions:         'Opsi',
  clozeExplain:        'Kartu isian menyembunyikan kata ini di dalam kalimat, jadi kamu mengingatnya dari konteks, bukan dari daftar.',
  addCloze:            'Tambah kartu isian',
  changeSource:        'Ganti apa yang sedang kamu pelajari',
  // The stub strip and the working rail (the control-room redesign).
  // Navigation is plain-language-first on this screen: Japanese stays
  // on the content and the small accents, the controls speak the
  // learner's own language.
  reopenIntake:        'Tambah teks lain',
  searchPassage:       'Cari di teks…',
  filterStops:         'Saring kalimat',
  filterAll:           'Semua',
  filterKept:          'Disimpan',
  filterHasNew:        'Kata baru',
  stopsShown:          (n, total) => `${n} dari ${total} kalimat ditampilkan`,
  keepAllIPlusOne:     'Simpan semua i+1',
  // The smart furigana's three settings.
  furiganaAll:         'Semua',
  // "only" is what makes the three exclusive, and being one of three
  // segments already says that. The word cost 60px of a 271px control
  // on a phone -- enough to break the dial onto two lines.
  furiganaUnknown:     'Tak dikenal',
  furiganaNone:        'Tidak ada',
  tokensCount:         n => `${n} kata`,
  // The concourse cards' record column, and the player's transport.
  passagesCap:         'Teks',
  lastUsedCap:         'Terakhir dipakai',
  playVideo:           'Putar',
  pauseVideo:          'Jeda',
  muteVideo:           'Bisukan video',
  unmuteVideo:         'Bunyikan video',
  videoVolume:         'Volume',
  videoVolumePct:      pct => `${pct}%`,
  // The keyboard map under the stage.
  kbdToken:            'kata',
  kbdSentence:         'kalimat',
  kbdPlay:             'putar',
  dockNoEntry:         'Tidak ada entri kamus untuk kata ini.',
  // 机 — the analyser on three columns (plan 134).
  prevSentence:        'Kalimat sebelumnya',
  nextSentence:        'Kalimat berikutnya',
  replaySentence:      'Putar ulang kalimat',
  loopSentence:        'Putar kalimat berulang',
  pauseEachSentence:   'Jeda di akhir setiap kalimat',
  playbackRate:        r => `${r.toLocaleString(intlLocale('id'))}×`,
  playbackSpeed:       r => `Kecepatan: ${r.toLocaleString(intlLocale('id'))}×`,
  showVideo:           'Tampilkan video',
  hideVideo:           'Sembunyikan video',
  furiganaNow:         label => `Furigana: ${label}`,
  wordsInSentence:     'Kata-kata dalam kalimat',
  // The text desk: the words list folded to one line (plan 235).
  wordsFoldCap:        'Kata dalam kalimat',
  explanationTitle:    'Penjelasan kalimat',
  // The desk's panel, its three faces (plan 242).
  panelFaces:          'Tampilan panel',
  faceWord:            'Kata',
  facePoint:           'Poin',
  faceGrammar:         'Tata bahasa',
  faceExplain:         'Susunan',
  explainThisSentence: 'Jelaskan kalimat ini',
  explanationOpen:     'Penjelasan terbuka',
  writtenHere:         s => `di sini: ${s}`,
  dictAnalyseSentence: 'Analisis kalimat ini',
  windowWhole:         'seluruh video',
  windowSpan:          m => `${m} dipilih`,
  windowBackwards:     'Waktu akhir harus setelah waktu mulai.',
  historyTitle:        'Riwayat',
  dateToday:           'hari ini',
  dateYesterday:       'kemarin',
  dateDaysAgo:         n => `${n} hari lalu`,
  phraseAnalyzerTitle: 'Penganalisis kalimat',
  phraseAnalyzerDesc:  'Tempel kalimat, lihat rinciannya\nSetiap kata, cara bacanya, riwayatmu dengannya\nUntuk kalimat yang hampir kamu pahami',
  phraseAnalyzer:      'Penganalisis kalimat',
  phrasePlaceholder:   'Ketik atau tempel kalimat bahasa Jepang…',
  analyze:             'Analisis',
  showHistory:         'Riwayat',
  hideHistory:         'Sembunyikan riwayat',
  // ── 帳 — the passages first (plan 136) ──
  shelfAll:            'Semua',
  shelfKept:           'Disimpan',
  passageKept:         'Disimpan',
  shelfFilter:         'Tampilkan',
  shelfSearch:         'Cari di teksmu…',
  shelfEmpty:          'Belum ada teks: apa yang kamu analisis di sebelah kanan akan muncul di sini.',
  shelfNoMatch:        'Tidak ada teks yang cocok.',
  shelfEmptyPhone:     'Teksmu akan muncul di sini: tempel teks Jepang atau tautan YouTube di atas, atau ambil foto.',
  newPassage:          'Teks baru',
  entryPlaceholder:    'Tempel teks Jepang atau tautan…',
  dropHere:            'Lepaskan di sini: subtitle atau gambar',
  phraseAnalyzeError:  'Kalimat ini gagal dianalisis. Coba lagi.',
  clickForDetails:     'Klik untuk melihat definisi dan statistik',
  inThisPhrase:        'Dalam kalimat ini',
  appDefinition:       'Definisi di aplikasi',
  cardStats:           'Statistik kartu',
  totalReviews:        'Pengulangan',
  correctReviews:      'Benar',
  interval:            'Interval',
  days:                'hari',
  nextReview:          'Pengulangan berikutnya',
  status_mastered:     'Dikuasai',
  status_learning:     'Sedang dipelajari',
  status_new:          'Baru',
  status_not_started:  'Belum masuk dek',
  status_due:          'Perlu diulang',
  sentenceLevel:       level => `Perkiraan level: ${level}`,
  unknownWords:        'kata belum dikenal',
  offDeckWords:        'tidak diajarkan di aplikasi',
  iPlusOne:            'Selangkah di atas levelmu',
  alreadyExplained:    'sudah dijelaskan',
  // 保存 (plan 039) — pinning a Sentence into the bank.
  keepSentence:        'Simpan kalimat ini',
  unkeepSentence:      'Berhenti menyimpan kalimat ini',
  // 歌 (plan 215) — a song's own deck, from the analyser's result.
  songDeckOpen:        'Buat dek dari lagu ini',
  songDeckShort:       'Dek',
  dockGrammar:         'Tata bahasa',
  dockWords:           'Kata',
  dockExplain:         'Jelaskan',
  dockKeep:            'Simpan',
  dockKept:            'Disimpan',
  // 表示 (plan 263) — the phone result's Display sheet.
  displayOpen:         'Tampilan',
  displayFurigana:     'Furigana',
  displayRomaji:       'Rōmaji',
  displayRomajiOff:    'Tersembunyi',
  displayRomajiOn:     'Terlihat',
  displayTranslation:  'Terjemahan',
  displayTranslationOff: 'Tersembunyi',
  displayTranslationOn:  'Terlihat',
  displayTranslationExplain: '“Jelaskan” menerjemahkan satu baris',
  displayDone:         'OK',
  // 保存 (plan 263) — keeping a line puts it in a deck.
  keepTitle:           'Simpan',
  keepIn:              'Simpan di',
  keepChange:          'Ganti',
  keepDeckChange:      name => `Dek ${name}. Ganti dek`,
  keepNewDeck:         'Dek baru',
  keepNewSongDeck:     'Dek baru · lagu ini',
  keepThisSong:        'Dek lagu ini',
  keepNew:             'Baru',
  keepTakesBoth:       'Kata dan baris',
  keepTakesWords:      'Hanya kata',
  keepTakesLines:      'Hanya baris',
  keepLine:            'Baris ini',
  keepLines:           n => `Baris terpilih · ${n}`,
  keepAndOthers:       n => `dan ${n} lainnya`,
  keepMoreLines:       n => `Pilih baris lain · ${n}`,
  keepEditLines:       'Ubah pilihan baris',
  keepItsWords:        n => `Kata-katanya · ${n}`,
  keepTheirWords:      n => `Kata-katanya · ${n}`,
  keepKnown:           'sudah dikenal',
  keepMoreWords:       n => `Tampilkan ${n} kata lagi`,
  keepDeckWordsOnly:   'Dek ini hanya menerima kata.',
  keepDeckLinesOnly:   'Dek ini hanya menerima baris.',
  keepCards:           n => `Simpan · ${n} kartu`,
  keepNothing:         'Tidak ada yang ditambahkan',
  keepNoDeck:          'Simpan tanpa dek',
  keepUseDeck:         name => `Simpan di ${name}`,
  keepNameOk:          'OK',
  keepLinesTitle:      'Baris',
  keepLinesOf:         (n, total) => `${n} dari ${total}`,
  keepAll:             'Centang semua',
  keepPickKept:        n => `Disimpan · ${n}`,
  keepPickUnknown:     'Dengan kata yang belum dikenal',
  keepPickNone:        'Tidak ada',
  keepHeld:            'sudah ada di dek',
  keepValidate:        n => `Selesai · ${n} baris`,
  songDeckTitle:       'Jadikan milikmu',
  songDeckName:        'Nama dek',
  songDeckHolds:       'Isi dek',
  songDeckWords:       'Kata',
  songDeckLines:       'Lirik',
  wordsSheetTitle:     'Daftar kata',
  wordsSheetCount:     (n, fresh) => `${n} kata${fresh ? ` · ${fresh} baru` : ''}`,
  songDeckWordsDesc:   'Untuk memahami lagu, kata demi kata',
  songDeckLinesDesc:   'Setiap baris dan cara bacanya, untuk menyanyikannya',
  songDeckCreate:      n => `Buat dek · ${n} kartu`,
  explainCap:          'Penjelasan',
  explainFailedTitle:  'Penjelasan belum tersedia',
  askHintSentence:     'Ada pertanyaan tentang baris ini? Jawabannya singkat dan tepat.',
  askOffTopicSentence: 'Aku hanya menjawab pertanyaan tentang kalimat ini.',
  songDeckMaking:      'Membuat dek',
  songDeckFailed:      'Dek gagal dibuat. Coba lagi.',
  songDeckLimit:       'Batas dek atau kartu di paketmu sudah tercapai: sebagian lagu tidak dimasukkan.',
  grammarSpotted:      'Tata bahasa yang terdeteksi',
  explainSentence:     'Jelaskan',
  explainAgain:        'Jelaskan lagi',
  // 骨組み (plan 311): the line's frame -- what each part does, the
  // roles of study/frame.ROLES, and what the line leaves unsaid.
  frameLabel:          'Susunan baris ini',
  frameRoles: {
    topic: 'Topik', subject: 'Subjek', object: 'Objek', target: 'Sasaran',
    time: 'Waktu', place: 'Tempat', means: 'Sarana', reason: 'Alasan',
    condition: 'Syarat', contrast: 'Kontras', purpose: 'Tujuan', quote: 'Kutipan',
    modifier: 'Penjelas', predicate: 'Predikat',
  },
  frameFrom:           { before: 'dari baris sebelumnya', after: 'dari baris berikutnya' },
  frameLeftOut:        word => `${word}, dihilangkan`,
  explaining:          'Menjelaskan…',
  explainFailed:       'Penjelasan gagal dimuat. Coba lagi.',
  explainUnavailable:  'Penjelasan sedang tidak tersedia. Coba sebentar lagi.',
  passageTruncated:    n => `Hanya ${n} kalimat pertama yang dianalisis.`,
  sentenceAnalysisUnavailable: 'Analisis kalimat ini untuk sementara tidak tersedia.',
  mineToDeck:          'Tambah',
  inDeck:              'Di dek',
  alreadyInDeck:       'Sudah ada',
  chooseDeck:          'Pilih dek',
  noDeckOfType:        'Belum ada dek jenis ini',
  clozeCreated:        'Kartu isian dibuat',
  mineFailed:          'Kartu ini gagal ditambahkan. Coba lagi.',
  cannotMineOffDeck:   'Tidak ada di dek aplikasi',
  // The same fact at legend length. The key sits beside MASTERED,
  // LEARNING and NEW and has to read as one of them; the sentence
  // above stays where it explains a dead control (MineButton's
  // title), which is the one place it earns its words.
  offDeckKey:          'Di luar dek',
  takePhoto:           'Ambil foto',
  chooseImage:         'Pilih gambar',
  ocrRecognizing:      'Membaca gambar…',
  ocrReading:          'Membaca gambar…',
  cropHint:            'Seret untuk membuat kotak di sekeliling teks yang kamu mau. Geser sedikit dengan tombol panah.',
  useThisArea:         'Baca area ini',
  useWholeImage:       'Gunakan seluruh gambar',
  ocrLocalOption:      'Baca di perangkatku saja (privat, jauh kurang akurat)',
  ocrTooLarge:         'Gambar itu terlalu besar. Coba pangkas ke area yang lebih kecil.',
  ocrLimitReached:     'Kamu sudah mencapai batas gambar hari ini. Coba lagi besok.',
  ocrUnavailable:      'Pembacaan gambar sedang tidak tersedia. Coba sebentar lagi.',
  ocrCheckText:        'Periksa teksnya sebelum menganalisis — OCR tidak selalu benar.',
  ocrFailed:           'Gambar ini gagal dibaca. Coba gambar lain, atau ketik teksnya.',
  imageTooLarge:       'Gambar ini terlalu besar.',
  hearThis:            'Dengarkan',
  hearSentence:        'Dengarkan kalimat ini',
  hearToken:           s => `Dengarkan ${s}`,
  entryDeleted:        'Dihapus dari riwayatmu',
  undo:                'Urungkan',
  addToAnotherDeck:    'Tambahkan ke dek lain',
  mineAdded:           'Ditambahkan ke dekmu',
  mineAlready:         'Kartu itu sudah ada di dek',
}

// ── Video ─────────────────────────────────────────────────
const video = {
  videoTitle:          'Video',
  videoDesc:           'Pelajari subtitle Jepang dari video\nLangsung, berwarna sesuai apa yang sudah kamu tahu\nPotret dunia, lengkap dengan suaranya',
  videoUrlOptional:    'Tautan video',
  // Shown only where the server can fetch a link itself. It names the
  // subtitles rather than the mechanism -- the learner does not need to
  // know a proxy is involved, only what they get.
  analyzeThisLink:     'Ambil subtitle',
  // ── The video intake as a column (plan 136) ──
  // One filled action: set up the bookmark until it has been used, then
  // open the video on YouTube, where it is tapped.
  grabInstall:         'Pasang bookmark 字幕取り',
  grabInstallSay:      'Satu menit, sekali saja: setelah itu, bookmark ini membawa subtitle video YouTube mana pun ke sini.',
  grabThenSay:         'Lalu ketuk bookmark 字幕取り: subtitle-nya masuk ke sini.',
  grabInstallLink:     'Pasang bookmark',
  chooseSubtitles:     'Pilih file subtitle',
  copyBookmarklet:     'Salin bookmark 字幕取り',
  bookmarkletCopied:   'Disalin! Sekarang lanjut ke langkah 2',
  downsubHint:         'Mengunduh file .vtt untuk dipilih di sini — berguna jika bookmark tidak berfungsi.',
  grabEmpty:           'Subtitle yang diambil kosong — coba lagi dari halaman video.',
  // The bookmark's own alerts, on youtube.com: baked in the learner's
  // language at the moment of copying (lib/captionGrab.js). tutTrouble1
  // quotes the first sentences of grabAlertNoJapanese and
  // grabAlertNotReady -- a test holds them in step.
  grabAlertNotYoutube:  'Buka dulu videonya di YouTube.',
  grabAlertNoVideo:     'Tidak ada video di halaman ini.',
  grabAlertNotReady:    'Halaman belum siap: muat ulang lalu coba lagi.',
  grabAlertNoSubtitles: 'Video ini tidak punya subtitle.',
  grabAlertNoJapanese:  'Tidak ada subtitle bahasa Jepang. Yang tersedia: ',
  grabAlertEmpty:       'Subtitle yang didapat kosong: coba lagi.',
  grabAlertFailed:      'Gagal mengambil subtitle: ',
  // ── The bookmark tutorial ──
  tutTitle:            'Pasang bookmark 字幕取り',
  tutWhat:             'Idenya: kita menyimpan sebuah “alamat ajaib” kecil sebagai bookmark di browser-mu. Buka bookmark itu saat kamu berada di video YouTube: subtitle Jepangnya diambil, lalu kamu dibawa kembali ke sini dengan analisis yang sudah dimulai. Tanpa instalasi, tanpa ekstensi, tanpa akun.',
  tutStep1Title:       'Salin alamat bookmark',
  tutStep1Body:        'Tombol ini menyalin alamatnya ke papan klip. Alamat itu diawali “javascript:” — itu wajar; bagian itulah yang bekerja.',
  tutStep2Title:       'Buat bookmark di browser-mu',
  tutStep2Body:        'Caranya tergantung perangkat — pilih perangkatmu:',
  tutDeviceLabel:      'Perangkat',
  tutDeviceDesktop:    'Komputer',
  tutDesktop1:         'Tampilkan bilah bookmark: Ctrl+Shift+B (⌘+Shift+B di Mac).',
  tutDesktop2:         'Klik kanan bilah itu → “Tambahkan halaman…” (Chrome/Edge) atau “Markah Baru…” (Firefox).',
  tutDesktop3:         'Nama: 字幕取り. Di kolom URL, tempel alamat yang disalin, lalu simpan.',
  tutAndroid1:         'Di Chrome, di halaman mana pun, ketuk ⋮ lalu bintang ☆: bookmark langsung dibuat.',
  tutAndroid2:         'Buka lagi ⋮ → Bookmark, tekan lama bookmark baru itu → Edit.',
  tutAndroid3:         'Nama: 字幕取り. Hapus URL-nya, tempel alamat yang disalin, simpan.',
  tutIphone1:          'Di Safari, di halaman mana pun, ketuk Bagikan (kotak dengan panah) → “Tambah Penanda” → Simpan.',
  tutIphone2:          'Buka Penanda (ikon buku) → Edit, lalu ketuk penanda itu.',
  tutIphone3:          'Nama: 字幕取り. Ganti alamatnya dengan yang disalin, ketuk Selesai.',
  tutStep3Title:       'Gunakan di video',
  tutStep3a:           'Buka video di situs youtube.com, di browser — bukan di aplikasi YouTube, yang tidak bisa melihat bookmark-mu',
  tutStep3b:           'Komputer: klik 字幕取り di bilah bookmark. Ponsel: ketik 字幕取り di bilah alamat lalu ketuk bookmark yang disarankan.',
  tutStep3c:           'Halaman kembali ke sini dengan sendirinya dan analisis dimulai dengan subtitle Jepang — videonya bisa diputar di sebelahnya.',
  tutTroubleTitle:     'Jika tidak berhasil',
  tutTrouble1:         'Bookmark-nya sendiri yang memberi tahu: “Tidak ada subtitle bahasa Jepang” berarti video itu tidak punya trek bahasa Jepang — tidak ada yang bisa diambil. “Halaman belum siap”: muat ulang halaman video lalu coba lagi.',
  tutTrouble2:         'Sebagai jalan terakhir, tautan DownSub di halaman ini mengunduh file .vtt: seret file itu ke area 字幕 di bawah, hasilnya sama.',
  uploadSubtitles:     'Unggah file subtitle (.srt, .vtt, .ass)',
  openOnYoutube:       'Buka di YouTube',
  windowStart:         'Mulai (detik)',
  windowEnd:           'Akhir (detik)',
  windowCapped:        'Rentang waktu dibatasi hingga 5 menit.',
  // The busy line is per-source: the same string said "Analyzing the
  // subtitles…" over a typed Sentence, because a 動画 string was being
  // rendered for all three platforms.
  analyzingText:       'Membaca tulisanmu…',
  analyzingPhoto:      'Membaca teks dari fotomu…',
  analyzingVideo:      'Menganalisis subtitle…',
  captionsUnavailable: 'Subtitle video ini gagal diambil.',
  subtitleTooLarge:    'File subtitle ini terlalu besar.',
  transcriptTooLong:   'Transkrip ini terlalu panjang. Tempel bagian yang lebih pendek.',
  videoStillPreparing: 'Masih ada video yang sedang disiapkan. Tunggu sampai selesai, lalu tambahkan video berikutnya.',
  // 動画 — why a video did not open (plan 215). The server names each
  // refusal with a code; these say it in the learner's language
  // (components/analysis/videoErrors.js), never the server's English.
  subtitleNotUtf8:     'File ini bukan UTF-8. File .srt Jepang sering memakai Shift-JIS: simpan ulang sebagai UTF-8 (editor teks apa pun bisa), lalu coba lagi.',
  subtitleParseFailed: 'File subtitle ini rusak dan tidak bisa dibaca.',
  subtitleUnknownFormat: 'Format subtitle tidak dikenali. Pilih file SRT, VTT, ASS, LRC, atau TXT.',
  subtitleNoCues:      'Tidak ada baris untuk dibaca di subtitle ini.',
  transcriptNoTimestamps: 'Stempel waktu tidak ditemukan. Salin seluruh panel transkrip dari YouTube (setiap baris harus diawali waktu, seperti 0:18).',
  videoNotYoutube:     'Tautan itu bukan video YouTube.',
  videoLinkFetchOff:   'Server ini tidak bisa mengambil subtitle dari tautan. Gunakan bookmark 字幕取り, atau tambahkan file subtitle.',
  videoLinkAllowanceMine: 'Jatah tautanmu hari ini sudah habis. Tambahkan file subtitle, atau kembali besok.',
  videoLinkAllowanceApp: 'Jatah tautan hari ini untuk seluruh aplikasi sudah habis. Tambahkan file subtitle, atau kembali besok.',
  videoNoJapanese:     'Video ini tidak punya subtitle bahasa Jepang. Coba video lain, atau tambahkan sendiri file subtitle.',
  videoSubtitlesOff:   'Subtitle video ini dinonaktifkan.',
  videoSubtitlesEmpty: 'Trek subtitle bahasa Jepang video ini kosong.',
  videoUnavailable:    'Video ini tidak tersedia.',
  videoYoutubeRefused: 'YouTube menolak memberikan subtitle video ini. Bookmark 字幕取り atau file subtitle akan berhasil.',
  videoYoutubeUnreachable: 'Tidak bisa terhubung ke YouTube. Coba sebentar lagi.',
  videoTranscriptFailed: 'Terjadi masalah saat membaca subtitle ini. Coba lagi.',
  videoStalled:        'Persiapan subtitle terhenti di tengah jalan. Coba lagi.',
  breakThisDown:       'Uraikan kalimat ini',
  seekToSentence:      'Lompat ke kalimat ini',
  // 案内表示 — the notices under the intake. An `info` notice is a fact
  // about the Passage, not a failure, and must never wear --danger.
  passageReady:        n => `${n} kalimat siap`,
  analysisFailed:      'Tidak berhasil',
  noticeDismiss:       'Tutup',
  analysisResult:      'Analisis',
  clearPassage:        'Kosongkan',
  clearPassageHint:    'Kosongkan penganalisis dan mulai lagi',
}

// ── Reading ───────────────────────────────────────────────
const reading = {
  readingTitle:         'Latihan membaca',
  readingDesc:          'Kalimat nyata, sesuai levelmu\nPer level, per frekuensi, atau dari kartumu sendiri\nBaca dulu, baru periksa',

  // Frequency source: which word list (byLevel/byFrequency/byMastery,
  // selectStudySource, selectTier, loadError live in `quiz` above —
  // shared with the other frequency-tier pickers in the app).
  selectDomain:          'Pilih daftar kata',
  domainVocabDeck:       'Dek kursus',
  domainVocabDecDesc:    'Dek berjenjang, dari N5 sampai N1',
  domainVocabJmdict:     'Kamus lengkap',
  domainVocabJmdictDesc: 'Seluruh kamus, yang paling umum lebih dulu',
  tierLabel:             'Tingkat {n}',
  jumpToTier:            'Lompat ke tingkat…',


  // Mastery source: shown instead of a phrase when the learner doesn't
  // have enough learning/mastered vocabulary yet for a full sentence.
  notEnoughMasteryWords: 'Belum cukup kata yang sedang dipelajari atau sudah dikuasai — terus belajar, lalu kembali ke mode ini.',

  readingFetchError:    'Kalimat gagal dimuat. Coba lagi.',
  writeWhatYouSaw:      'Tulis apa yang kamu lihat, dalam romaji',
  // The clock at the "No limit" pace (Settings › Reading pace).
  readingUntimed:       'Tanpa batas waktu',
  romajiPlaceholder:    'mis. konnichiwa',
  // The play button a phrase arrives behind (ReadingPieces' PlayButton).
  readingPlay:          'Tampilkan kalimat dan mulai hitung waktu',
  // The reading's clock (ReadingTimer): "4.5s".
  timerSeconds:         s => `${s.toLocaleString(intlLocale('id'), { minimumFractionDigits: 1, maximumFractionDigits: 1 })}\u00a0dtk`,
  correct:              'Benar!',
  incorrect:            'Belum tepat',
  correctRomaji:        'Romaji yang benar',
  // The practice card (plan 185): the grammar point's tag at the card's
  // top, on the answer and (translation) on the prompt; and, for a screen
  // reader, what the figure in the answer's well counts and the name of
  // the words missed under it.
  pcardPoint:           'Poin',
  pcardUse:             'Pakai',
  pcardMatched:         'cocok',
  pcardMissed:          'Kata yang terlewat',
  nextPhrase:           'Kalimat berikutnya',
  translation:          'Terjemahan',

  // Word-by-word breakdown toggle + its per-word navigation
  // (ReadingRun.jsx, DictationRun.jsx) — shown once a phrase has been
  // graded.
  showBreakdown:        'Tampilkan rincian',
  hideBreakdown:        'Sembunyikan rincian',
  preparingBreakdown:   'Menyiapkan rincian…',
  // The settled failure, which 書取 can actually reach: its breakdown
  // is only asked for at the reveal (the sentence does not exist on
  // the client before that), so a dead model is visible here in a way
  // reading practice's own long prefetch window hides. 読解 shows it
  // too, for the slow or retrying call its prefetch does not outrun.
  breakdownUnavailable: 'Rincian tidak tersedia',
  // The comprehension passage, sentence by sentence (PassageBreakdown):
  // the chevron's name, and the caption over the points the text was
  // written around.
  openSentence:         'Buka kalimat ini',
  closeSentence:        'Tutup kalimat ini',
  grammarInText:        'Tata bahasa dalam teks ini',
  jumpToTokenNamed:      s => `Lompat ke ${s}`,
  detailsForToken:       s => `Detail ${s}`,
  detailsForKanji:       k => `Detail kanji ${k}`,
}

// ── Reading comprehension ────────────────────────────────────────────
const readingComprehension = {
  readingComprehensionTitle: 'Pemahaman bacaan',
  readingComprehensionDesc:  'Teks pendek, lalu soal\nLatihan bagian membaca ujian\nN5 sampai N1',

  question:                   'Soal',
  yourAnswer:                 'Jawabanmu',
  gradeCorrect:               'Jawabanku benar',
  gradeIncorrect:             'Jawabanku salah',
  questionTypeComprehension: "Pemahaman",
  questionTypeVocabulary: "Kosakata",
  questionTypeGrammar: "Tata bahasa",
  questionTypeInference: "Penyimpulan",
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
  translationTitle:      'Terjemahan',
  translationDesc:       'Terjemahkan sendiri ke bahasa Jepang\nJawaban acuan, dan tanggapan untuk jawabanmu\nSengaja ke arah yang sulit',
  translationFetchError: 'Kalimat gagal dimuat. Coba lagi.',
  japanesePlaceholder:   'Tulis dalam bahasa Jepang…',
  // The tutor's review as a shape, not a paragraph (routes/translation.py).
  reviewCorrect:         'Benar',
  reviewAcceptable:      'Bisa diterima',
  reviewPartial:         'Sebagian benar',
  reviewIncorrect:       'Salah',
  reviewGood:            'Yang sudah bagus',
  reviewFix:             'Perlu diperbaiki',
  reviewGrammarUsed:     'dipakai',
  reviewGrammarMissed:   'tidak dipakai',
  analyzingTranslation:  'Menganalisis terjemahanmu…',
  analysisUnavailable:   'Analisis tidak tersedia — bandingkan sendiri dengan acuan di atas.',
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
  dictationTitle:        'Dikte',
  dictationDesc:         'Tulis apa yang kamu dengar, dalam romaji\nDua kali dengar, tidak lebih\nN5 sampai N1',
  dictationFetchError:   'Klip gagal dimuat. Coba lagi.',
  dictationCheckError:   'Jawabanmu gagal dinilai. Coba lagi.',
  dictationPlaceholder:  'Tulis apa yang kamu dengar, dalam romaji…',
  dictationPrompt:       'Tulis apa yang kamu dengar, dalam romaji',
  dictationListen:       'Dengarkan',
  dictationListensLeft:  n => `Sisa ${n} kali dengar`,
}

// ── 作文 — composition (plan 125) ───────────────────────────────
// CompositionRun.jsx reuses the shared keys wholesale (selectLevel,
// leaveLevels, stationJlpt, submit, retry, yourAnswer,
// japanesePlaceholder, analysisUnavailable, nextPhrase,
// pcardPoint, glLesson, the review* keys, the breakdown and
// explain keys) — only the genuinely new keys live here.
const compositionMode = {
  compositionTitle:        'Karangan',
  compositionDesc:         'Tulis kalimat dengan poin yang ditunjukkan\nTutor memeriksanya untukmu\nN5 sampai N1',
  compositionFetchError:   'Poin tata bahasa gagal dimuat. Coba lagi.',
  compositionPrompt:       'Tulis kalimat menggunakan',
  analyzingComposition:    'Membaca kalimatmu…',
  // The day's reviews are spent (routes/composition.py, 429). The run
  // goes on: the check still prints and the rating still counts.
  compositionLimitReached: 'Jatah ulasan tutor hari ini sudah habis — hasil pemeriksaan dan nilaimu tetap dihitung. Tutor kembali besok.',
}

// ── 会話 — conversation (plan 217) ──────────────────────────────
// Someone speaks to the learner in a place (a konbini's till, a
// station's gate, a client's office) and they answer: by choosing among
// three replies, by writing what they are told to say, or freely, the
// other person played by the model. ConversationStation lists the
// scenes, ConversationRun rides one; the tutor's review, the practice
// card and the rating bar keep their own shared keys.
const conversationMode = {
  conversationTitle:   'Percakapan',
  conversationDesc:    'Seseorang berbicara kepadamu: jawablah\nPilih, terjemahkan, atau bicara bebas\nN5 sampai N1',
  cvsFetchError:       'Percakapan gagal dimuat. Coba lagi.',
  cvsModeLabel:        'Cara menjawab',
  cvsLevelLabel:       'Level',
  cvsModes:            { choose: 'Pilih', translate: 'Terjemahkan', free: 'Bebas' },
  cvsEmpty:            'Belum ada percakapan di level ini.',
  // The station's search (plan 246): the well, its count, and what it
  // says when the grade holds nothing of the query.
  cvsSearchPlaceholder: 'Cari adegan…',
  cvsCount:            n => `${n} adegan`,
  cvsNoMatchHere:      level => `Tidak ada adegan ${level} yang cocok.`,
  cvsFoundAt:          levels => `Ditemukan di ${levels.length < 2 ? levels.join('') : levels.length === 2 ? levels.join(' dan ') : `${levels.slice(0, -1).join(', ')}, dan ${levels.at(-1)}`}.`,
  cvsGoTo:             level => `Pindah ke ${level}`,
  cvsNoMatch:          'Tidak ada adegan yang cocok.',
  cvsNoMatchHint:      'Coba tempat, orang, atau kata dari adegan itu.',
  cvsClearSearch:      'Hapus pencarian',
  cvsRecordAria:       (right, done) => `${right} dari ${done} jawaban benar`,
  cvsLeave:            'Adegan',
  cvsRepliesRated:     'Jawaban',
  cvsStart:            'Mulai',
  cvsGoal:             'Misimu',
  cvsRouteAria:        (place, n, total) => `${place}, jawaban ${n} dari ${total}`,
  cvsSay:              'Katakan',
  cvsTheReply:         'Jawabannya',
  cvsRightMark:        'Benar',
  cvsWrongMark:        'Salah',
  cvsNext:             'Lanjut',
  cvsFinish:           'Selesai',
  cvsReplyLabel:       'Jawabanmu',
  cvsReplyPlaceholder: 'Jawabanmu, dalam bahasa Jepang atau rōmaji…',
  cvsSend:             'Kirim',
  cvsAnswering:        who => `${who} sedang menjawab…`,
  cvsReading:          'Membaca jawabanmu…',
  // The day's tutor is spent (routes/conversation.py, 429): the run
  // goes on, measured and graded.
  cvsReviewLimit:      'Jatah ulasan tutor hari ini sudah habis — skor kecocokan dan nilaimu tetap dihitung. Tutor kembali besok.',
  cvsTalkLimit:        'Jatah bicara bebas hari ini sudah habis. Mode Pilih dan Terjemahkan masih bisa dipakai — bicara bebas kembali besok.',
  cvsTalkOff:          'Bicara bebas memerlukan tutor, dan tutor sedang tidak tersedia. Mode Pilih dan Terjemahkan masih bisa dipakai.',
  cvsTalkFailed:       'Tidak ada jawaban. Coba lagi.',
  cvsTalkOver:         'Delapan jawaban: percakapan berakhir di sini.',
  cvsOver:             'Percakapan selesai',
  cvsAgain:            'Ulangi',
  cvsOther:            'Adegan lain',
}

// ── Dictionary ────────────────────────────────────────────
const dictionary = {
  dictionaryPlaceholder: 'Cari kanji, kana, atau arti…',
  noResults:         'Tidak ada hasil untuk',
  reading:           'Cara baca',
  romaji:            'Romaji',
  meaning:           'Arti',
  examples:          'Contoh',
  level:             'Level',
  listen:            'Dengarkan',
  displayedKanji:    'kanji ditampilkan',
  displayedEntries:  'entri ditampilkan',
  displayedWords:   'kata ditampilkan',
  displayedPoints:  'poin ditampilkan',
  radical:           'Radikal',
  // Additional dictionary keys used by screens
  dictAll:           'Semua',
  dictKanji:         'Kanji',
  dictVocab:         'Kosakata',
  dictHiragana:      'Hiragana',
  dictKatakana:      'Katakana',
  // 文法 — the grammar collection: the 355 points of the JLPT line as
  // entries, narrowed by level in a second row of chips.
  dictGrammar:       'Tata bahasa',
  dictLevels:        'Level',
  dictLevelAll:      'Semua',
  // How the search reads the query: how strictly, and where.
  dictMatch:         'Pencocokan',
  dictMatchOptions:  { word: 'Kata utuh', start: 'Awal kata', any: 'Di mana saja' },
  dictSearchOptions: 'Opsi pencarian',
  dictField:         'Cari di',
  dictFieldOptions:  { all: 'Semua', japanese: 'Jepang', meaning: 'Arti' },
  // The search was retried against a word the catalogue holds, because
  // what was typed found nothing. A statement, not a question.
  dictCorrectedFor:  'Hasil untuk',
  dictionaryPlaceholderGrammar: 'Cari poin, struktur, atau arti…',
  // お気に入り — the shelf of kept entries (plan 093): the sixth chip,
  // the star on the plate in both states, and the shelf with nothing
  // on it yet.
  dictAdd:             'Tambah',
  dictAddToDeck:       'Tambah ke dek',
  dictFavorites:       'Favorit',
  dictFavorite:        'Favorit',
  dictFavoriteAdd:     'Simpan ke favorit',
  dictFavoriteRemove:  'Hapus dari favorit',
  dictFavoriteFailed:  'Gagal menyimpan.',
  dictFavoriteFull:    'Favorit sudah penuh — hapus satu dulu.',
  dictFavoritesEmpty:  'Belum ada favorit',
  dictFavoritesHint:   'Bintang pada entri menyimpannya di sini.',
  // 発見 — a grammar point's tour (plan 187b)
  tourLookQ:         p => `Apa fungsi ${p}?`,
  tourLookHint:      n => `${n === 2 ? 'Dua' : 'Tiga'} kalimat. Lihat letaknya dan apa kata terjemahannya.`,
  tourIdea:          'Aku punya ide',
  tourSkip:          'Lewati pelajaran',
  tourGuessQ:        p => `Apa arti ${p}?`,
  tourCheck:         'Periksa',
  tourThatIs:        p => `Itu arti ${p}.`,
  tourNotThis:       'Bukan itu yang dinyatakan kalimat-kalimat ini.',
  tourHint:          'Perhatikan apa kata terjemahannya.',
  tourGiven:         'Ini dia.',
  tourGivenNote:     'Ingat baik-baik: nanti muncul lagi di akhir.',
  tourFound:         n => (n === 0 ? 'Tepat, di percobaan pertama.' : n === 1 ? 'Tepat, di percobaan kedua.' : `Tepat, di percobaan ke-${n + 1}.`),
  tourTerminus:      'Yang kamu temukan',
  tourNotLike:       p => `Bukan ${p}`,
  tourBoard:         'Naik',
  tourReadLesson:    'Baca pelajaran lengkap',
  tourRight:         'Betul.',
  tourNotQuite:      'Kurang tepat.',
  tourMe:            'Kamu',
  tourPlayScene:     'Putar adegan',
  tourYourTurn:      'Giliranmu',
  tourYourLine:      'Ucapanmu',
  // 書く — the write (plan 187e).
  wrtAsk: 'Katakan dalam bahasa Jepang',
  wrtWith: 'Dengan',
  wrtWords: 'Kosakata',
  wrtField: 'Kalimatmu (kana atau rōmaji)',
  wrtHint: 'kana · rōmaji',
  wrtCheck: 'Periksa',
  wrtFound: 'Polanya ada.',
  wrtMissing: 'Polanya tidak ada.',
  wrtModel: 'Salah satu cara mengatakannya',
  tourRecord: (date, tries, helped) => `Ditemukan pada ${date} · ${helped ? 'aturan diberikan' : tries ? `${tries} kali salah` : 'percobaan pertama'}`,
  tourReplay: 'Ulangi pengenalan',
  tourReplayScene: 'Putar ulang adegan',
  tourBackToLesson: 'Kembali ke pelajaran',
  // 発見 on the desk (plan 187f): the stops at the left, the plate at the right.
  tourStops: { look: 'Amati', guess: 'Tebak', found: 'Ditemukan', scene: 'Dalam adegan', twist: 'Masih ada lagi!', quiz: 'Kuis', terminus: 'Hasil' },
  tourNotionCount: (n, total) => `${n} dari ${total}`,
  tourTries: n => `${n} kali salah`,
  tourRuleGiven: 'aturan diberikan',
  tourMissed: 'salah',
  tourToFind: 'Belum ditemukan',
  tourLedgerLater: 'Contoh dan poin yang mirip terbuka di perhentian terakhir.',
  tourRouteAria: 'Perhentian pengenalan',
  tourLedgerAria: 'Yang sudah kamu temukan',
  tourAria:          p => `Temukan ${p}`,
  // 194 — the ladder as steps, the plate, Construire typed, the tutorial's quiz
  glLadderBoard: 'Naiki tangga',
  lineAria: (group, at, of) => `Poin ini: ${group}, anak tangga ${at} dari ${of}`,
  lineMasteredAria: 'Poin ini: dikuasai',
  lineChoose: 'Pilih',
  lineBuild: 'Susun',
  lineMastered: 'Dikuasai',
  lineAgain: 'diulang',
  lineRelapse: 'Kambuh',
  chooseAsk: 'Mana yang cocok?',
  chooseTrap: p => `${p}, si jebakan`,
  chooseRight: 'benar',
  bldField: 'Jawabanmu',
  bldFieldN: n => `Jawabanmu, bagian kosong ${n}`,
  bldHint: 'kana atau rōmaji',
  bldCheck: 'Periksa',
  bldRight: 'Benar.',
  bldClose: 'Hampir.',
  bldWrong: 'Kurang tepat.',
  // How the sentence says the hole when another form was taken as right:
  // its register (plan 241), or では in full or contracted (plan 295).
  bldOther: (said, register) => `Kalimatnya memakai ${said}: sama saja, ${({
    plain: 'dalam bentuk biasa',
    polite: 'dalam bentuk sopan',
    full: 'dengan では utuh',
    contracted: 'dengan では disingkat, seperti dalam bahasa lisan',
  })[register] ?? 'dalam bentuk sopan'}.`,
  mapAria: 'Jalur poin ini',
  mapTutorial: 'Pengenalan',
  mapNow: 'sekarang',
  mapDone: 'selesai',
  mapAfter: days => `+${days} hr`,
  // 198 — what each rating does to the point, on the walk (CardPanel)
  mapOutsAria: 'Efek tiap penilaian',
  mapOutMove: move => ({ stay: 'coba lagi', next: 'anak tangga berikutnya', back: 'kambuh', hold: 'tetap dikuasai' })[move],
  mapOutRow: (verdicts, move, when) => `${verdicts}: ${move}, ${when}`,
  mapSealed: 'namanya terungkap bersama jawaban',
  tourUsageHead: 'Masih ada lagi!',
  tourQuizCount: (n, total) => `Soal ${n} dari ${total}`,
  tourQuizGap: 'Mana yang cocok?',
  tourQuizKinds: { gap: 'Isian', meaning: 'Arti', form: 'Bentuk', use: 'Tanggapan' },
  tourTrap: 'Jebakan',
  tourResults: 'Hasil',
  tourScore: (r, n) => `${r} dari ${n}`,
  tourSheet: 'Halaman poin',
  tourStart: 'Mulai: Pilih 1',
  // 初見 — a kana or a kanji met for the first time (plan 216)
  glyphAria:         g => `Kenali ${g}`,
  glyphNew:          { kana: 'Kana baru', kanji: 'Kanji baru' },
  glyphTwin:         { hiragana: 'dalam hiragana', katakana: 'dalam katakana' },
  glyphStops:        { read: 'Baca', write: 'Tulis', use: 'Dalam kata' },
  glyphTraceQ:       'Tarik setiap goresan dari titik ke lingkaran.',
  glyphGiven:        'Goresan ini digambar untukmu.',
  glyphTraced:       misses => (misses ? 'Selesai.' : 'Selesai, tanpa salah.'),
  glyphShowMe:       'Tunjukkan caranya',
  glyphShown:        'Begitulah cara menulisnya.',
  glyphBoardAria:    (g, n, total) => `Tulis ${g}, goresan ${n} dari ${total}`,
  glyphStart:        'Mulai',
  // 文法 — the lesson (plan 087): the pair marks over the steps, the
  // door on every card and the station's index, the gate's one button.
  glLesson:          'Pelajaran',
  glPoints:          'Daftar poin',
  glRule:            'Aturan',
  glUse:             'Penggunaan',
  glCareful:         'Hati-hati',
  glCompare:         'Bandingkan',
  // The lesson's section heads (plan 235): each part found at a glance.
  glStructure:       'Struktur',
  glForms:           'Bentuk',
  glConfuse:         'Jangan tertukar dengan',
  glBoard:           'Paham — naik',
  glBlank:           'bagian kosong',
  glRegister: { neutral: 'Netral', casual: 'Santai', polite: 'Sopan', formal: 'Resmi', written: 'Tulisan' },
  dictBackToRadicals:'Kembali ke radikal',
  dictModeSearch:    'Pencarian',
  dictModeRadical:   'Radikal',
  dictionaryPlaceholderRadical: 'Saring hasil ini menurut radikal…',
  dictionaryResults: n => `${n} hasil`,
  dictRadicalNumber: (n) => `radikal no. ${n}`,
  dictStrokesPlural: 'goresan',
  dictStrokeSingular: 'goresan',
  dictStrokeIndex:   'Indeks jumlah goresan',
  // The entry while it opens (DictionaryDetail.jsx).
  loadingDictionary: 'Membuka entri…',
  dictStrokePrev:    'Lebih sedikit goresan',
  dictStrokeNext:    'Lebih banyak goresan',
  syllabaryMain:     'Aksara dasar',
  syllabaryNSolo:    'ん',
  syllabaryVoiced:   'Bunyi bersuara',
  syllabaryYoon:     'Bunyi gabungan',
  syllabaryForeign:  'Bunyi asing',
  syllabaryLong:     'Vokal panjang',
  composingKanji:    'Tersusun dari kanji ini',
  vocabExamples:     'Dipakai dalam kata-kata ini',
  kanaExamples:      'Dibaca dalam kata-kata ini',
  allReadings:       'Semua cara baca',
  readingsNoWords:   'Belum ada contoh kata',
  // 割合 (plan 177): the share of the words that use each reading.
  readingsScopeLabel:  'Cakupan hitungan',
  readingsScopeCourse: 'Kursus',
  readingsScopeAll:    'JMdict',
  readingsScopeHintCourse: (n) => `Proporsi tiap cara baca di antara ${n} kata kursus.`,
  readingsScopeHintAll:    (n) => `Proporsi tiap cara baca di antara ${n} kata JMdict.`,
  readingsTier:      { core: 'Umum', usual: 'Lazim', rare: 'Jarang' },
  readingsOfWords:   (n, total) => `${n} dari ${total.toLocaleString(intlLocale('id'))} kata`,
  readingsExamples:  (n) => `${n} contoh`,
  readingsWholeShare: 'Kata yang dibaca utuh',
  readingsShareLoading: 'Menghitung…',
  readingsShareError:   'Hitungan gagal dimuat.',
  readingsCourseEmpty:  (kanji) => `Tidak ada kata di kursus JLPT yang memakai ${kanji}.`,
  readingsCourseEmptyBody: 'Hitungan kursus kosong. Kamus lengkap memuat kata dengan kanji ini.',
  readingsCountAll:  'Hitung di seluruh JMdict',
  // The two gates on the readings sheet. The Japanese half is the
  // heading and the plain-language half its caption (DESIGN.md, "Every
  // name is a pair") — never "ON'YOMI", which is the Japanese written
  // twice. The sheet's old 音 / 訓 squares said this to nobody who
  // could not already read them.
  readingsOnName:    'Cara baca Tionghoa',
  readingsKunName:   'Cara baca Jepang',
  // The 熟 on a word row whose reading belongs to the whole word
  // (今朝 けさ, 時計 とけい), not to the kanji the row is about.
  readingsWhole:     'Dibaca sebagai satu kata',
  // Plan 276: the sheet a kanji card's two register names open
  // (components/study/ReadingsHelp, domain/readingsHelp).
  readingsHelpCap:   'Dua cara baca',
  readingsHelpOn:    'Datang dari Tiongkok bersama kanjinya dan ditulis dalam katakana. Umumnya dipakai untuk kata yang terdiri atas beberapa kanji.',
  readingsHelpKun:   'Kata asli Jepang yang kemudian ditulis dengan kanji ini, dalam hiragana. Sering untuk kanji yang berdiri sendiri atau diikuti kana.',
  readingsHelpShare: (kanji) => `Proporsi kata kursus yang membaca ${kanji} dengan cara ini: mulai dari yang tertinggi.`,
  readingsHelpTilde: (kanji, side, word) => `Cara baca ${kanji} saat berada ${side === 'after' ? 'sesudah' : 'sebelum'} bagian lain kata${word ? `: ${word.kanji}, ${word.kana}` : ''}.`,
  readingsHelpDot:   (written) => `Setelah titik ada kana: ${written}.`,
  // Icon-button title/aria-label on the dictionary-lookup action that
  // sits on a revealed card (RevealActions in QuizComponents.jsx).
  openDictionary:    'Buka entri kamus',
}

// Reading-comprehension / generic reading labels
const comprehension = {
  comprehensionTitle:       'Pemahaman bacaan',
  comprehensionFetchError:  'Teks gagal dimuat. Coba lagi.',
  comprehensionLimitReached: 'Semua teks baru hari ini sudah kamu baca. Kembali lagi besok.',
  comprehensionGenerating:  'Menulis teks untukmu…',
  comprehensionSubmitError:  'Jawaban gagal dikirim. Coba lagi.',
  doneReading:              'Selesai membaca',
  reReadText:               'Baca ulang teks',
  showTranslation:          'Tampilkan terjemahan',
  hideTranslation:          'Sembunyikan terjemahan',
  timeRemaining:           'Sisa waktu',
  // Rolling the text up the card instead of showing it whole (plan 258).
  rollText:                 'Gulirkan teks',
  rollWhole:                'Teks utuh',
  rollLabel:                'Teks bergulir naik di kartu',
  rollPause:                'Jeda guliran',
  rollResume:               'Lanjutkan guliran',
  rollSpeedLabel:           'Kecepatan gulir',
  rollSlower:               'Lebih lambat',
  rollFuriganaOn:           'Sembunyikan furigana',
  rollFuriganaOff:          'Tampilkan furigana',
  rollFaster:               'Lebih cepat',
  rollSpeed:                n => `${n} karakter/dtk`,
  tryAgain:                'Coba lagi',
  changeLevel:             'Ganti level',
  score:                   'Skor',
}

const progress = {
  progressNew:       'Belum dipelajari',
  progressLearning:  'Sedang dipelajari',
  progressMastered:  'Dikuasai',
  cardProgress:      'Kemajuan kartu',
}

const misc = {
  mute:    'Bisukan',
  unmute:  'Nyalakan suara',
  readingsMore: (n) => `${n} cara baca lagi — semuanya ada di entri kamus`,
  kanjiNoun: 'kanji',
  wordNoun:  'kata',
  // Shown by components/study/SessionError when a study session has
  // nothing to show AND the last fetch failed — previously this state
  // rendered an empty box with no explanation and no way to recover.
  // ── Hints (indice_1/2/3) ──
  // A hint is opt-in per card and never forks the SRS — see
  // components/study/HintBar.jsx. These replace the old "MCQ mode"
  // labels, because multiple choice is a help level now, not an
  // exercise.
  hintChoicesShow:    'Tampilkan pilihan',
  hintChoicesHide:    'Sembunyikan pilihan',
  hintSentencesShow:  'Tampilkan kalimat',
  hintSentencesHide:  'Sembunyikan kalimat',
  hintFuriganaShow:   'Tampilkan furigana',
  hintFuriganaHide:   'Sembunyikan furigana',
  // The speak-on-reveal switch beside them (components/study/SpeakToggle.jsx):
  // the name stays, the title says what a tap does.
  speakOnReveal:      'Bacakan saat dibuka',
  speakOnRevealOn:    'Bacakan jawaban saat dibuka',
  speakOnRevealOff:   'Berhenti membacakan jawaban saat dibuka',

  // ── Study modes (domain/studyModes.js) ──
  // One label + description per mode key. Namespacing means these need no
  // `noun` parameter: the old modeQcmKjM(noun) shape existed because
  // `flashcard-kj-m` meant "kanji" on one screen and "word" on another,
  // and a single translation key had to serve both — which it could only
  // ever get right for one of them.
  mode_kana_flashcard_f2b:        'Kana → romaji',
  mode_kana_flashcard_f2b_desc:   'Kana ditampilkan. Ingat bunyinya.',
  mode_kana_flashcard_b2f:        'Romaji → kana',
  mode_kana_flashcard_b2f_desc:   'Bunyinya diberikan. Ingat kananya.',
  mode_kana_write_romaji:         'Ketik romaji',
  mode_kana_write_romaji_desc:    'Kana ditampilkan. Ketik bunyinya.',
  mode_kana_write_kana:           'Tulis kana',
  mode_kana_write_kana_desc:      'Bunyinya diberikan. Tulis kananya dengan tangan.',

  mode_kanji_flashcard_f2b:       'Kanji → arti',
  mode_kanji_flashcard_f2b_desc:  'Kanji ditampilkan. Ingat artinya.',
  mode_kanji_flashcard_b2f:       'Arti → kanji',
  mode_kanji_flashcard_b2f_desc:  'Arti ditampilkan. Ingat kanjinya.',
  mode_kanji_write_kanji:         'Tulis kanji',
  mode_kanji_write_kanji_desc:    'Arti diberikan. Tulis kanjinya dengan tangan.',
  mode_kanji_readings:            'Cara baca',
  mode_kanji_readings_desc:       "Kanji ditampilkan. Ketik on'yomi dan kun'yomi-nya.",
  mode_kanji_radical:             'Radikal',
  mode_kanji_radical_desc:        'Kanji ditampilkan. Ingat radikal dasarnya.',

  mode_vocab_flashcard_f2b:       'Kata → arti',
  mode_vocab_flashcard_f2b_desc:  'Kata ditampilkan. Ingat artinya.',
  mode_vocab_flashcard_b2f:       'Arti → kata',
  mode_vocab_flashcard_b2f_desc:  'Arti ditampilkan. Ingat katanya.',
  mode_vocab_word_reading:        'Cara baca',
  mode_vocab_word_reading_desc:   'Kata ditampilkan. Ingat cara bacanya dalam kana.',

  mode_grammar_flashcard_f2b:      'Aturan → arti',
  mode_grammar_flashcard_f2b_desc: 'Pola ditampilkan. Ingat fungsinya.',
  mode_grammar_flashcard_b2f:      'Arti → aturan',
  mode_grammar_flashcard_b2f_desc: 'Arti ditampilkan. Ingat polanya.',
  mode_grammar_fill_in:            'Sebutkan aturannya',
  mode_grammar_fill_in_desc:       'Kalimat bahasa Jepang tanpa terjemahan. Sebutkan pola yang dipakai di dalamnya.',
  mode_grammar_contrast:           'Mana yang cocok',
  mode_grammar_contrast_desc:      'Kalimat rumpang. Pilih polanya di antara pola yang sering tertukar dengannya.',
  mode_grammar_ladder:             'Tangga',
  mode_grammar_ladder_desc:        'Satu latihan yang naik bersamamu: kenali, pilih, susun, lalu tulis.',
  mode_grammar_build:              'Susun',
  mode_grammar_build_desc:         'Kalimatnya terpotong-potong. Kembalikan pola dan katanya ke tempatnya.',
  mode_grammar_write:              'Tulis',
  mode_grammar_write_desc:         'Sesuatu untuk dikatakan dalam bahasa Jepang dengan pola ini. Kamu menilai sendiri.',

  mode_standard_flashcard_f2b:      'Depan → belakang',
  mode_standard_flashcard_f2b_desc: 'Kartumu, seperti yang kamu tulis.',
  mode_standard_flashcard_b2f:      'Belakang → depan',
  mode_standard_flashcard_b2f_desc: 'Kartumu, dari sisi sebaliknya.',

  mode_fast_review:                'Pengulangan cepat',
  mode_fast_review_desc:           'Lihat sekilas apa yang sudah kamu pelajari. Tidak ada yang dinilai.',
  retry:              'Coba lagi',
}

// ── Profile ───────────────────────────────────────────────
const profile = {
  // ── Profile ──
  thisWeek:          'Minggu ini',
  records:           'Rekor',
  currentStreak:     'Runtunan saat ini',
  longestStreak:     'Terpanjang',
  perfectRun:        'Benar beruntun',
  perfectRunUnit:    'berturut-turut',
  dayUnit:           'hari',
  chaseNext:         (xp, who) => `${xp} XP di belakang ${who}`,
  // ── 定期入れ — the pass-holder profile ──
  retention:         'Retensi',
  daysStamped:       'Dicap',
  ranking:           'Peringkat',
  periodWeek:        'Minggu ini',
  periodAll:         'Sepanjang masa',
  rankColumn:        'Peringkat',
  // ── 番付 — the whole board (plan 262) ──
  periodDivision:    'Divisi',
  // The whole board's three tabs, short enough for a phone's width.
  bzTabWeek:         'Mingguan',
  bzTabAll:          'Total',
  bzWhole:           'Seluruh papan peringkat',
  bzGapTo:           (xp, who) => `${xp} XP untuk menyalip ${who}`,
  bzMoveUp:          (n) => `Naik ${n} sejak kemarin`,
  bzMoveDown:        (n) => `Turun ${n} sejak kemarin`,
  bzRowAria:         (who) => `Buka kartu ${who}`,
  bzScopeLabel:      'Siapa yang ditampilkan',
  bzScopeAll:        'Semua orang',
  bzScopeLevel:      (level) => `Levelku · ${level}`,
  bzMovedUp:         'Naik Senin lalu',
  bzMovedDown:       'Turun Senin lalu',
  bzDivisionBelow:   'Divisi di bawah',
  bzDivisionAbove:   'Divisi di atas',
  bzEarlier:         'Posisi sebelumnya',
  bzMore:            'Posisi berikutnya',
  bzJumpToMe:        'Posisiku',
  bzEmpty:           'Belum ada siapa pun di papan peringkat ini.',
  bzLoadFailed:      'Papan peringkat gagal dimuat.',
  bzShownHint:       'Pelajar lain melihat namamu dan XP-mu.',
  bzHiddenHint:      'Pelajar lain tidak lagi melihatmu. Kamu tetap melihat posisimu.',
  bzCardAria:        (who) => `Kartu ${who}`,
  bzCardFailed:      'Kartu ini gagal dimuat.',
  bzCardLevel:       'Level',
  bzCardDecks:       'Dek yang diterbitkan',
  // The A1 board (plan 262, the owner's pick of the canvas).
  bzEndsIn:          (d, h) => (d > 0 ? `Berakhir dalam ${d} hari ${h} jam` : `Berakhir dalam ${h} jam`),
  bzPodiumCap:       'Minggu lalu',
  bzUpHead:          'Naik hari Senin',
  bzDownHead:        'Turun hari Senin',
  bzInUp:            'Di zona promosi',
  bzLadder:          'Semua divisi',
  // The foot as F2 (plan 262): the learner's card and the switch row.
  bzToUpRest:        'untuk naik hari Senin',
  bzToStayRest:      'untuk bertahan di divisi ini',
  // Indonesian says an ordinal before its number (ke-12), so a rank
  // has no suffix: the screen prints the figure alone.
  bzOrdinal:         () => '',
  bzAppear:          'Tampil di papan peringkat',
  bzLearners:        (n) => `${n} pelajar`,
  east:              'Timur',
  west:              'Barat',
  passLabel:         'Pass komuter',
  passSince:         (when) => `Sejak ${when}`,
  noActivityWeek:    'Belum ada yang dipelajari minggu ini',
  profileTitle:      'Profil',
  profileStale:      'Server tidak dapat dihubungi — menampilkan data terakhirmu.',
  leaderboard:       'Papan peringkat',
  done:              'Selesai',
  genericError:      'Terjadi kesalahan. Coba lagi.',

  // ── 定期券の裏 — the journey on the pass back (plan 063) ──
  // The Japanese status words (定刻, 遅延…) are signage and live in
  // the component; these are their plain-language captions and the
  // honest sentences beside the track.
  jourStatus: {
    suspended:      'Terhenti',
    ahead:          'Lebih awal',
    onTime:         'Sesuai jadwal',
    slightlyBehind: 'Agak terlambat',
    delayed:        'Terlambat',
  },
  // The track's YOU / PLAN caption tags and its day-bracket label
  // retired with the two-lane drawing (see GhostTrack.jsx): the marks
  // now say which is which by their own form, and the day count is a
  // delta on the arrival row.
  jourYourLine:      'Jalurmu',
  jourTurnOver:      'Balikkan',
  jourFootOnTime:    (a, p, dest, date) =>
    `**${a} per hari**, tepat sesuai **${p}** yang dijanjikan. Kedatangan di ${dest} tetap pada **${date}**.`,
  jourFootAhead:     (a, p, dest, days, date) =>
    `**${a} per hari** dibanding **${p}** yang dijanjikan — ${dest} tiba **${days} hari lebih awal**, sekitar **${date}**.`,
  jourFootBehind:    (a, p, dest, date, days) =>
    `14 hari terakhir: **${a} per hari** dibanding **${p}** yang dijanjikan. Dengan ritme saat ini, ${dest} tiba pada **${date}** — **${days} hari** setelah tanggal yang tertera di pass.`,
  jourFootSuspended: (date) =>
    `14 hari tanpa belajar. Tanggal **${date}** yang tertera di pass tidak berarti lagi — lanjutkan belajar atau cetak ulang dengan tanggal yang berarti.`,
  jourFootPaceKept:  (a, p) =>
    `14 hari terakhir: **${a} per hari** dibanding **${p}** yang kamu janjikan. Tanpa tanggal tiba yang pasti — janjinya hanyalah ritme.`,
  jourFootPaceSuspended: (p) =>
    `14 hari tanpa belajar, padahal janjinya **${p} per hari**. Jalurnya menunggu — gerbang terbuka dengan satu kartu.`,
  // 定期券の裏 (plan 174): the line alone on the card's back. The drift
  // in days, signed and wordless -- the colour says the rest; the ghost
  // train is labelled "promised".
  jourDrift:         (n) => `${n > 0 ? '+' : '−'}${Math.abs(n)} hari`,
  jourRoute:         (from, to) => `${from} → ${to}`,
  jourNoDest:        'Belum ada tujuan di pass ini.',
  jourNoDestLink:    'Pilih satu di loket',
  // The two moves are ONE choice, so they are written as one: the
  // first line is what you change, the second is the same sentence on
  // both — the date you then arrive. A reader compares two dates and
  // two paces, with no prose in between to hold the difference in.
  // The pace carries perDayUnit's own "/ day", which is what the PACE
  // row above these buttons already prints: the button and the figure
  // it is offering to change say the unit the same way, and it is two
  // characters rather than six on a 165px button.
  jourActRecover:    (pace) => `Melaju ${pace} / hari`,
  jourActRecoverSub: (date) => `tiba ${date}`,
  jourActReprint:    'Cetak ulang pass',
  jourActReprintSub: (date) => `tiba ${date}`,
  jourActResume:     'Kembali ke jalur',
  jourActResumeSub:  'pass tidak berubah',
  jourActSlow:       (pace) => `Cetak ulang dengan ${pace} / hari`,
  jourActSlowSub:    (date) => `tiba ${date}`,
  jourReprintError:  'Gagal mencetak ulang — coba lagi.',

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
  settings:          'Pengaturan',
  preferences:       'Preferensi',
  sound:             'Suara',
  ambiance:          'Suara latar',
  theme:             'Tema',
  language:          'Bahasa',
  // Each language's row in the picker shows a sample in that language, the
  // words that tell it from its neighbours: the two Spanishes say add
  // differently, so theirs is that word (plan 303).
  languageSample:    'Hari Ini · Kamus',
  account:           'Akun',
  signOutDesc:       'Keluar dari akunmu di perangkat ini.',
  // A guest holds no key: signing out ends the journey for good. The
  // row says so rather than letting it be discovered.
  signOutGuestDesc:  'Tanpa akun, progresmu hanya tersimpan di perangkat ini: jika keluar, progres itu terhapus selamanya.',
  guestLabel:        'Pass tamu',
  guestCap:          'Tanpa email',
  guestClaimDesc:    'Progresmu sudah ada di sini. Tambahkan alamat email dan kata sandi untuk menyimpannya — tidak ada yang dipindahkan, akunnya tetap sama.',
  guestClaimConfirm: 'Sedikit lagi: konfirmasi alamat email lewat tautan yang baru saja kami kirim.',
  guestClaimDone:    'Akun dibuat. Progresmu tetap tersimpan.',
  // 相互乗り入れ — Google on a pass that already has a key. Named
  // plainly, because the row has to answer the question the learner
  // arrives with: "why did signing in with Google not open my
  // account?" See components/settings/AccountPage.jsx.
  linkGoogleLabel:   'Google',
  linkGoogleCap:     'Belum terhubung',
  linkGoogleDesc:    'Tambahkan Google ke akun ini, dan “Lanjutkan dengan Google” akan membuka akun ini, bukan akun baru yang kosong.',

  // Only ever surfaces as title/aria-label text (NavControls.jsx) —
  // the visible toggle is already a real IconSun/IconMoon SVG.

  volumeKana:         'Volume kana',
  volumeVoice:        'Volume suara',
  volumeEffects:      'Volume efek',
  volumeUi:           'Volume antarmuka',
  volumeAmbiance:     'Volume suara latar',
  volumeJingle:       'Volume jingle',
  // The station announcements (playAnnouncement). This key was the one
  // channel in SLIDER_LABELS with nothing behind it in either locale,
  // so its row in the mixer drew a slider with no label at all.
  volumeAnnouncement: 'Volume pengumuman',
  volumeAnnouncements: 'Volume pengumuman',
}

// ── Decks ─────────────────────────────────────────────────
const decks = {
  decks:             'Dekku',
  createDeck:        'Buat dek',
  deckNamePlaceholder: 'Nama dek…',
  noDecks:           'Belum ada dek.',
  createFirstDeck:   'Buat dek pertamamu di atas.',
  // The shelf's own index — a search field and a row of type filters
  // (DecksScreen.jsx), modelled on the dictionary's console. `{n}` is
  // the count that survived both filters, following the same
  // placeholder convention browseSelectedCount uses.
  decksSearchPlaceholder: 'Cari dek…',
  decksAllTypes:     'Semua',
  decksCount:        '{n} dek',
  decksCountOne:     '1 dek',
  decksNoMatch:      'Tidak ada dek yang cocok.',
  decksNoMatchHint:  'Coba nama lain atau hapus filter.',
  decksClearFilters: 'Hapus filter',
  // Asked in place on the card/toolbar rather than through the
  // browser's own confirm() dialog — short, because it sits inline.
  deleteDeckConfirm: 'Hapus dek ini?',
  deleteCardsConfirm: 'Hapus yang dipilih?',
  deleteCardConfirm: 'Hapus kartu ini?',
  study:             'Belajar',
  deckEdit:          'Ubah',
  deckAddCards:      'Tambah kartu',
  deckWriteCard:     'Tulis kartu',
  deckAllCards:      n => (n === 1 ? 'Kartunya' : `Semua ${n} kartu`),
  deckFigs:          { due: 'Perlu diulang', new: 'Baru', learning: 'Sedang dipelajari', mastered: 'Dikuasai' },
  deckCardState:     { due: 'Perlu diulang', new: 'Baru', learning: 'Sedang dipelajari', mastered: 'Dikuasai' },
  deckToday:         'Hari ini',
  deckTodayDesc:     'Kartu dek ini untuk hari ini, di semua mode.',
  deckToStudy:       () => 'kartu untuk dipelajari hari ini',
  addCard:           '+ Tambah kartu',
  newCard:           'Kartu baru',
  editCard:          'Ubah kartu',
  noCards:           'Tidak ada kartu di dek ini.',
  addFirstCard:      'Tambahkan kartu pertamamu di atas.',
  frontPlaceholder:  'Depan',
  backPlaceholder:   'Belakang / Arti',
  hintPlaceholder:   'Petunjuk (opsional)',
  notesPlaceholder:  'Catatan (opsional)',
  // Front-field placeholder specific to kanji-type custom decks
  // (DeckDetailScreen.jsx) — used to be a hardcoded, untranslated
  // "Kanji (ex: 日)" string.
  kanjiFrontPlaceholder: 'Kanji (mis. 日)',
  // Shown in the TopBar title if a deck's own name isn't available
  // yet (e.g. this screen opened directly instead of via DecksScreen,
  // so router state carrying the deck is missing) — used to be a
  // hardcoded "Deck" string.
  deckFallbackTitle: 'Dek',

  // Deck types — each one (besides "Mixed") now restricts what can be
  // added to it (see DeckDetailScreen/BrowseCardsMenu and decks.py's
  // SOURCE_FOR_TYPE), so the description is the actual rule, not just
  // a feature note.
  flashcardType:     'Kartu hafalan',
  flashcardDesc:     'Hanya kartumu sendiri — bahasa apa pun',
  kanaType:          'Kana',
  vocabType:         'Kosakata',
  vocabDesc:         'Kata berjenjang dari N5 sampai N1\nAtau menurut frekuensi, tema, atau di luar silabus\nDari bentuk ke arti, dan sebaliknya',
  deckKanaDesc:      'Hanya kana — dengan urutan goresan',
  deckVocabDesc:     'Hanya kosakata — dari level JLPT',
  kanjiType:         'Kanji',
  kanjiDesc:         'Karakter per level, dengan urutan goresan\nBaca, lalu tulis dari ingatan\nSetiap cara baca, setiap arti',
  deckKanjiDesc:     'Hanya kanji — dengan urutan goresan',
  grammarType:       'Tata bahasa',
  deckGrammarDesc:   'Hanya poin tata bahasa — dari level JLPT',
  mixedType:         'Campuran',
  mixedDesc:         'Kata, kanji, tata bahasa, dan kartumu sendiri, dalam satu dek',
  lyricsType:        'Lirik',
  lyricsDesc:        'Lagu, dari file subtitle, liriknya, atau tautan YouTube',
  // 歌 (plan 264) — a song's lyrics into a deck, from the shelf.
  lyricsImport:           'Impor lirik',
  lyricsImportTitle:      'Dari lagu ke dek',
  lyricsSource:           'Sumber lirik',
  lyricsFromFile:         'File',
  lyricsFromLink:         'YouTube',
  lyricsFromPaste:        'Tempel',
  lyricsPastePlaceholder: 'Tempel lirik lagu dalam bahasa Jepang',
  lyricsLinkOff:          'Server ini sedang tidak bisa mengambil subtitle dari tautan. Tambahkan file atau tempel liriknya.',
  lyricsStart:            'Baca lirik',
  lyricsReading:          'Membaca lirik',
  lyricsSorting:          'Memilah baris yang dinyanyikan',
  lyricsSortSpent:        'Kuota pemilahan otomatis hari ini sudah habis: periksa sendiri baris-barisnya.',
  lyricsSortOff:          'Pemilahan otomatis sedang tidak tersedia: periksa sendiri baris-barisnya.',
  lyricsNoLines:          'Tidak ada baris bahasa Jepang untuk dimasukkan ke dek.',
  lyricsSung:             'Dinyanyikan',
  lyricsNotSung:          'Bukan bagian lagu',
  lyricsKindSpoken:       'Diucapkan',
  lyricsKindCredit:       'Kredit',
  lyricsKindSound:        'Bunyi',

  // Browse existing cards (BrowseCardsMenu.jsx)
  browseBtn:              'Jelajahi',
  browseTitle:            'Jelajahi kartu yang ada',
  browseTabKanji:         'Kanji',
  browseTabVocab:         'Kosakata',
  browseTabGrammar:       'Tata bahasa',
  browseAllLevels:        'Semua',
  browseSearchPlaceholder: 'Cari (kanji, kana, arti…)',
  browseResults:          'Hasil',
  // {n} follows the same placeholder convention as andMore above.
  browseSelectedCount:    '{n} dipilih',
  searching:              'Mencari…',
  browseNoResults:        'Tidak ada hasil.',
  alreadyAdded:           'sudah ditambahkan',
  adding:                 'Menambahkan…',
  addSelected:            'Tambah ({n})',
  browseAddFailed:        'Kartu-kartu ini gagal ditambahkan. Coba lagi.',
  // Bulk select
  selectAll:         'Pilih semua',
  deselectAll:       'Batalkan semua pilihan',

  // Import modal
  importTitle:       'Impor datamu',
  importSubtitle:    'Tempel datamu di sini — dari Word, Excel, Google Docs, dari mana saja.',
  importPreview:     'Pratinjau',
  noPreview:         'Belum ada pratinjau',
  termSep:           'Antara istilah dan definisi',
  cardSep:           'Antarkartu',
  tab:               'Tab',
  comma:             'Koma',
  custom:            'Kustom',
  newRow:            'Baris baru',
  semicolon:         'Titik koma',
  importBtn:         'Impor',
  importing:         'Mengimpor…',
  cards:             'kartu',
  andMore:           '… dan {n} lainnya',
  importColumns:     'Kolom:',
  importRepeat:      'lalu {cols}, sebanyak yang kamu mau',
  importHeaderHint:  'Dengan baris judul di awal (Aturan, Arti, Contoh, Terjemahan…), kolom dibaca sesuai urutan di lembar kerjamu. Apit sel dengan tanda kutip "…" agar bisa memuat koma atau baris baru.',
  importExample:     'Sisipkan contoh',
  importHeaderFound: 'Judul kolom dikenali',
  importIgnoredCols: 'Kolom diabaikan: {cols}',
  importSkipped:     '{n} dilewati',
  importMissing:     'kurang: {fields}',

  // Study screen
  studyMode:         'Mode belajar',
  mixWithJLPT:       'Campurkan konten JLPT (opsional)',
  startSession:      'Mulai',
  writePractice:     'Latihan menulis',
  revealAnswer:      'Tampilkan jawaban',
  typeAnswer:        'Ketik jawabanmu…',
  // Custom vocab/kanji deck phase labels (StudyScreen.jsx) — K+K→S is
  // Kanji+Kana → Sens (meaning), same three-phase progression as the
  // built-in vocab/kanji decks.
  studyPhase1:       'Fase 1 — K+K→A',
  studyPhase2:       'Fase 2 — K→A',
  studyPhase3:       'Fase 3 — A→K',

  // ── The library ───────────────────────────────────────────
  // "Library" alone, with no Japanese pair: owner's call, and the one
  // section in the app that reads Latin-only by design. See DESIGN.md.
  library:               'Pustaka',
  // The door beside Create deck on the shelf: the verb, because it
  // sits next to one and the roundel beside it already says books.
  libraryBrowse:         'Jelajahi',
  librarySeeAll:         'Lihat semua',
  libraryMore:           'Tampilkan lebih banyak',
  librarySort:           'Urutan',
  librarySortNew:        'Terbaru',
  librarySortFollowed:   'Paling diikuti',
  // The console's chip row, named for a screen reader. Its FIELD says
  // what 教材's own console says (decksSearchPlaceholder): one console
  // everywhere means the same words in it, and the longer sentence
  // ("Search the library…") was cut by the tally on a phone before
  // anything had been typed into it.
  libraryTypes:          'Jenis dek',
  libraryBy:             name => `oleh ${name}`,
  // The shelf and the library beside the lines on the desk, and the
  // library's three sections (plan 132).
  gateShelfEmpty:        'Tidak ada dek di rakmu.',
  gateShelfEmptyHint:    'Buat dekmu sendiri atau ikuti satu dari pustaka: kartunya diulang bersama yang lain.',
  gateDeckPublished:     'diterbitkan',
  librarySeeCards:       n => (n === 1 ? 'Lihat kartunya' : `Lihat ${n} kartu`),
  libraryFeatured:       'Unggulan',
  libraryFeaturedWhen:   'minggu ini',
  libraryFollowing:      'Diikuti',
  libraryFollowingCount: n => `${n} dek diikuti`,
  libraryFollowingNone:  'Kamu belum mengikuti dek apa pun. Ikuti satu: kartu yang ditambahkan pembuatnya akan sampai kepadamu.',
  libraryNewCards:       n => `+${n} kartu`,
  libraryUpToDate:       'Sudah terkini',
  libraryMine:           'Terbitanmu',
  libraryMineCount:      n => `${n} dek diterbitkan`,
  libraryMineNone:       'Belum ada dek yang diterbitkan. Terbitkan satu dari halamannya: dek itu akan muncul di sini bersama pengikutnya.',
  libraryWeeksLabel:     list => `Pengikut baru per minggu, selama delapan minggu: ${list}`,
  libraryFollowers:      n => `${n} pengikut`,
  libraryAndMore:        n => `dan ${n} kartu lainnya`,
  libraryEmpty:          'Belum ada yang diterbitkan',
  libraryEmptyHint:      'Saat pelajar lain menerbitkan dek, dek itu muncul di sini.',
  libraryFailed:         'Gagal terhubung ke pustaka',
  libraryFailedHint:     'Periksa koneksimu, lalu coba lagi.',
  libraryGone:           'Dek ini sudah tidak tersedia',
  libraryGoneHint:       'Mungkin pembuatnya telah menariknya.',
  libraryOpen:           'Buka',
  libraryFollow:         'Ikuti',
  libraryPublish:        'Terbitkan ke pustaka',
  libraryPublishHint:    'Pelajar lain bisa menemukan dan mengikutinya.',
  libraryPublished:      'Dek ini ada di pustaka.',
  // Plan 310: the library reads a deck before it takes it in. The
  // refusal names the field, never the word.
  libraryRefusedName:        'Nama dek memuat kata yang tidak diterima pustaka.',
  libraryRefusedDescription: 'Deskripsi dek memuat kata yang tidak diterima pustaka.',
  libraryRefusedCard:        front => (front ? `Sebuah kartu memuat kata yang tidak diterima pustaka: ${front}.` : 'Sebuah kartu memuat kata yang tidak diterima pustaka.'),
  libraryOpenCard:           'Buka kartunya',
  libraryRename:             'Ganti nama dan terbitkan',
  cardRefused:               'Kartu ini memuat kata yang tidak diterima pustaka.',
  libraryUnpublish:      'Keluarkan dari pustaka',
  libraryMakeMine:       'Jadikan milikku',
  libraryMakeMineConfirm: 'Ini membuat salinan dek yang bisa kamu ubah sendiri, tanpa kehilangan progres yang sudah kamu capai. Kamu berhenti mengikuti dek aslinya.',
  libraryUnfollow:       'Berhenti mengikuti',
  libraryUnfollowConfirm: 'Dek ini keluar dari rakmu. Progresmu tetap tersimpan, jadi jika mengikutinya lagi, kamu lanjut dari tempat terakhir.',
  libraryRemove:         'Keluarkan',
  libraryRemoveConfirm:  'Dek ini keluar dari rakmu selamanya. Buat salinanmu sendiri dulu jika ingin menyimpannya.',
  libraryWithdrawn:      'Ditarik.',
  libraryWithdrawnHint:  ' Pembuatnya telah menghapus dek ini. Untuk sementara, kamu masih bisa mempelajarinya dan membuat salinanmu sendiri.',
  libraryDeleteFollowed: n => (n === 1
    ? '1 pelajar mengikuti dek ini. Jika dihapus, dek ini juga hilang dari raknya — dia akan diberi tahu dan diberi waktu untuk menyalinnya.'
    : `${n} pelajar mengikuti dek ini. Jika dihapus, dek ini juga hilang dari rak mereka — mereka akan diberi tahu dan diberi waktu untuk menyalinnya.`),
  libraryReport:         'Laporkan',
  // Plan 310: blocking a deck's author, from its page (the pick C).
  libraryReportDeck:     'Laporkan dek',
  libraryBlockAuthor:    name => `Blokir ${name}`,
  libraryBlockHint:      name => `Kamu tidak akan melihat deknya dan ${name} tidak akan melihat dekmu.`,
  libraryBlockConfirm:   name => `Blokir ${name}? Kamu tidak akan melihat deknya, ${name} tidak akan melihat dekmu, dan kalian berhenti mengikuti dek satu sama lain.`,
  libraryUnfollowBlock:  name => `Berhenti mengikuti dan blokir ${name}`,
  libraryReported:       'Dilaporkan',
  libraryReportNote:     'Ini menandai dek untuk ditinjau. Tidak ada yang disembunyikan secara otomatis.',
  libraryReasonSpam:      'Spam atau iklan',
  libraryReasonOffensive: 'Konten yang menyinggung',
  libraryReasonWrong:     'Bahasa Jepang yang salah',
  libraryReasonCopyright: 'Disalin tanpa izin',
  libraryReasonOther:     'Alasan lain',
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
  examTitle:           'Tryout',
  examDesc:            'Ujian latihan lengkap, dengan batas waktu dan nilai\nKosakata, tata bahasa, membaca, menyimak\nMengikuti format resmi JLPT — penilaian tidak resmi',
  examQuestions:       'soal',
  examNoneAvailable:   'Belum ada tryout yang tersedia.',

  // ── Paper kinds ──
  // The four generators (backend/study/exam_*_gen.py), named in the
  // reader's own language with the Japanese kept alongside as the
  // specimen line — the picker used to show only "N5 語彙", which told
  // a beginner nothing about what was behind the card.
  examKindVocab:       'Kosakata',
  examKindGrammar:     'Tata bahasa',
  examKindReading:     'Membaca',
  examKindListening:   'Menyimak',
  examNotGeneratedYet: 'Disusun saat pertama dibuka',
  examGenerating:      'Menyusun paket soalmu…',
  examGeneratingHint:  'Paket soal baru hanya disusun jika semua yang ada sudah pernah kamu kerjakan — prosesnya butuh satu atau dua menit. Setelah jadi, paket itu langsung dimuat, untukmu dan untuk semua orang lain.',
  examLoadFailed:      'Paket soal ini tidak bisa dibuat saat ini.',
  examLoadFailedHint:  'Penyusun soal mungkin sedang tidak tersedia. Tunggu sebentar, lalu coba lagi.',
  // Shown instead of examLoadFailedHint (and instead of the retry
  // button) while the server is refusing new attempts: a paper that
  // just failed costs minutes and dozens of model calls to retry, so
  // the wait is deliberate rather than something to click through.
  examLoadFailedCooldown: (minutes) =>
    `Penyusun soal sedang beristirahat setelah percobaan yang gagal. Coba lagi sekitar ${minutes} menit lagi.`,
  examRetry:           'Coba lagi',

  examSectionEmpty:    'Bagian ini belum berisi soal.',
  examFinishSection:   'Selesai',
  examQuestionAbbrev:  'No.',
  examResultMissing:   'Hasil ini tidak tersedia — mulai ujiannya lagi.',
  examBackToExams:     'Kembali ke daftar tryout',
  // The picker's per-paper secondary action, and the primary action on
  // the result screen. Both ask for a DIFFERENT paper rather than the
  // same one again — see backend/study/exam_schema.py on revisions.
  examFreshPaper:      'Paket soal lain',
  examFreshPaperHint:  'Tukar paket soal ini dengan yang lain. Jika belum ada yang tersusun, prosesnya butuh satu atau dua menit.',
  examNewPaper:        'Paket soal baru',
  examStarHint:        'Bagian mana yang mengisi posisi bertanda bintang?',
  examFullSentence:    'Kalimat lengkap:',
  examAudioPending:    'Audio untuk soal ini belum dibuat.',
  examAudioUnavailable: 'Audio untuk soal ini tidak bisa dimuat.',

  // ── Result ──
  // Never call this a JLPT score. The real one is an IRT-scaled 尺度得点
  // computed from official item parameters no third party has, so the
  // honest thing to show is raw proportion correct plus a practice
  // target — and to say plainly that that is what it is.
  examPracticeTarget:  'Target nilai',
  // The line the score's bar lands on (plan 254): the target met, or how
  // many more right answers it wanted.
  examTargetReached:   'Target tercapai',
  examTargetShort: n => `Kurang ${n} jawaban benar dari target`,
  // Wrong answers are what a review is for, so that's what opens by
  // default — a 21-question paper otherwise lists 21 identical rows to
  // click through before finding the two that went wrong.
  examShowAll:         'Semua soal',
  examAllCorrect:      'Tidak ada yang salah — semua soal benar.',
  // Colour alone can't carry which row was picked and which was right
  // (they're the same row on a correct answer, and ~8% of learners
  // can't separate the two hues), so both are said in words.
  examYourAnswer:      'Jawabanmu',
  examCorrectAnswer:   'Jawaban benar',
  examNotAnswered:     'Tidak dijawab',
  // The listening script ships inside every paper already (see
  // exam_listening_gen.py) and is exactly what makes a missed
  // listening question learnable — withheld during the exam, offered
  // in review.
  examTranscript:      'Transkrip',
  // The study under a reviewed question (exam/ExamStudy.jsx): its
  // sentence and choices translated, and the sentence's breakdown.
  examStudyOpen:       'Terjemahan & rincian',
  examStudyHide:       'Sembunyikan terjemahan',
  examStudyFailed:     'Terjemahan sedang tidak tersedia. Tunggu sebentar, lalu coba lagi.',
  examStudyRetry:      'Coba lagi',
  examStudySentence:   'Kalimat',
  examStudyChoices:    'Pilihan jawaban',
  examStudyPassage:    'Teks bacaan',
  examStudyNoWord:     'bukan kata',

  // ── Answer sheet ──
  // The numbered grid under the question. Named for the real thing it
  // stands in for: on a paper JLPT the answer sheet is what tells you
  // at a glance what you still owe.
  examSheetTitle:      'Lembar jawaban',
  // aria-label for one chip — the visual states (fill, outline, corner
  // mark) are meaningless to a screen reader, so each chip spells out
  // its own.
  examSheetChip: (n, answered, flagged) =>
    `Soal ${n}, ${answered ? 'sudah dijawab' : 'kosong'}${flagged ? ', ditandai' : ''}`,
  examFlag:            'Tandai untuk diperiksa lagi',
  examUnflag:          'Hapus tanda',

  // ── Finishing ──
  // Submitting with blanks scores them wrong, so it asks first and
  // says how many — and offers to go to them rather than only offering
  // to go through with it.
  examConfirmTitle:    'Selesai meski ada soal yang belum dijawab?',
  examConfirmBody: (n) =>
    `${n} soal masih kosong. Jawaban kosong dihitung salah.`,
  examReviewBlanks:    'Ke soal kosong pertama',
  examSubmitAnyway:    'Tetap selesaikan',
  examKeepGoing:       'Lanjut mengerjakan',
  // A failed submit used to strand a finished exam with no message and
  // no way out. The draft is kept until the POST succeeds, so a retry
  // is genuinely a retry.
  examSubmitFailed:    'Jawabanmu gagal dikirim — progresmu aman.',
  examSubmitRetry:     'Coba kirim lagi',
  examSubmitting:      'Mengirim…',

  // ── Leaving mid-exam ──
  examLeaveTitle:      'Tinggalkan ujian ini?',
  examLeaveBody:       'Jawaban dan sisa waktumu tersimpan — buka lagi paket soal ini untuk melanjutkan dari tempat terakhir.',
  examLeaveConfirm:    'Tinggalkan',
  examLeaveStay:       'Tetap di sini',

  // ── Per-question chrome ──
  // The mondai instructions are identical for every question inside a
  // mondai, so they open on the first one and collapse behind this
  // afterwards rather than re-reading the same four lines of kana each
  // time.
  examShowInstructions: 'Tampilkan petunjuk',
  examHideInstructions: 'Sembunyikan petunjuk',
  // Announced, not just coloured — a learner who isn't watching the
  // corner gets no warning at all today.
  examTimeWarning: (minutes) =>
    `Sisa waktu ${minutes} menit.`,

  // ── Audio player ──
  examAudioPlay:       'Putar',
  examAudioPause:      'Jeda',
  examAudioReplay:     'Putar dari awal',
  examAudioPlayed: (n) => `Diputar ${n}×`,
  examAudioProgress:   'Posisi audio',
}

// ── みどりの窓口 — onboarding ──────────────────────────────
// ── 乗車 — the boarding (plan 075) ──────────────────────────
// The canvas's boarding: Welcome → name → why → the kana check → (the
// reveal | the level) → goal → rhythm → the hour → the nudge →
// building → the plan → the pass. The interface speaks the learner's
// language; the kana, the cards and the seal are content and stay
// Japanese (components/boarding/*, screens/BoardingFlow.jsx).
const boarding = {
  authFoot: 'Semuanya bisa diubah nanti di Pengaturan.',
  authModeAria: 'Masuk atau daftar',
  brdDocumentTitle: 'Naik kereta',
  // Welcome: the sign, the rolling stock, the promise.
  brdTagline: 'Perjalanan yang dirancang untukmu.',
  brdBoard: 'Naik',
  // 辻 (plan 163): the desk's front door, its corner and the way back to it.
  brdHaveAccountQ: 'Sudah punya akun?',
  brdNoAccountYet: 'Belum punya akun?',
  brdBackHome: 'Kembali ke awal',
  // Google: "continue", never "sign up" or "sign in" — a provider does
  // not tell the two apart. You simply arrive.
  continueWithGoogle: 'Lanjutkan dengan Google',
  orWithEmail: 'atau dengan alamat email',
  // 改札 — a round trip that came back refused (lib/authRedirect.js).
  // Both name what happened rather than "something went wrong": on the
  // web these are read off the URL after the page has already been to
  // Google and back, and a learner who has just done that is owed the
  // reason, not a shrug.
  oauthAlreadyLinked: 'Akun Google itu sudah terhubung ke Pass lain.',
  oauthSignInInstead: 'Masuk dengan akun Google itu',
  nativeReturnNote:  'Berhasil masuk. Kembali ke aplikasi…',
  nativeReturnOpen:  'Buka Tsuji',
  oauthLinkingOff: 'Google belum bisa ditambahkan ke Pass ini sekarang. Alamat email bisa.',
  // 本乗車券 — putting an address on the pass (lib/guest.js). Same
  // rule as the two above: name what happened, and name the road that
  // is still open. Supabase's own sentences are developers' English,
  // and on the claim one of them quotes an empty address instead of
  // the one in the field — see lib/authErrors.js.
  claimEmailTaken: 'Alamat itu sudah punya Pass. Masuklah dengan alamat itu.',
  claimEmailUnreachable: 'Konfirmasi tidak bisa dikirim ke alamat itu. Coba alamat lain, atau simpan progresmu dengan Google.',
  claimWeakPassword: 'Kata sandi itu terlalu mudah ditebak. Coba yang lebih panjang.',
  claimTooSoon: 'Terlalu banyak percobaan barusan. Tunggu semenit, lalu coba lagi.',
  // A guest's account, kept from Settings › Account: the progress
  // already exists, this only puts a key on it (lib/guest.js).
  brdAccountCreate: 'Buat akunku',
  // The card (plan 247): the credits it is issued with, on its back,
  // and the service named on the rhythm's sheet.
  brdCreditsOffered: 'kredit gratis',
  brdTermService: 'Jenis',
  // The Welcome: each demo's tag.
  brdDemoTag: { kanji: 'Kanji', vocab: 'Kosakata', grammar: 'Tata bahasa', dictation: 'Dikte', reading: 'Membaca', kana: 'Kana', translation: 'Terjemahan', analyzer: 'Penganalisis', exam: 'Tryout' },
  // The questions.
  brdKanaQ: 'Kamu bisa membaca ini?',
  brdKana: { hiragana: 'Hiragana', katakana: 'Katakana', both: 'Keduanya', none: 'Belum' },
  brdKanaWord: { sushi: 'sushi', hotel: 'hotel', station: 'stasiun' },
  brdRevealQ: 'Sebentar lagi kamu bisa membaca keduanya.',
  // 辻 (plan 163): the desk's kana question and reveal, drawn as the
  // owner's D03 -- each answer says what it reads, then its name.
  brdKanaHint: 'Pilih yang sudah bisa kamu baca.',
  brdKanaOnly: (jp) => `Hanya ${jp}`,
  brdKanaSays: { hiragana: 'Hiragana', katakana: 'Katakana', both: 'Hiragana dan katakana', none: 'Kita mulai dari situ' },
  brdRevealLead: 'Dua aksara, masing-masing 46 huruf. Begini cara membaca dua kata ini.',
  brdRevealKanji: 'Kanji',
  brdRevealLater: 'Nanti, kata demi kata.',
  brdRevealMeans: 'berarti',
  brdRevealWord: (word) => `“${word}”`,
  brdRevealFirst: (date, min) => `Perhentian pertamamu: **kana**, bisa kamu baca pada **${date}** dengan ${min} menit sehari.`,
  brdLevelQ: 'Bagus! Kamu di level mana?',
  brdLevelHint: 'Perhentian di belakangmu akan ditandai sudah dikenal.',
  brdTestQ: 'Ayo cari perhentianmu',
  brdTestPick: 'Aku pilih sendiri',
  brdPlacedQ: level => `Jawabanmu berhenti di ${level}`,
  brdNovice: 'Pemula',
  // The kanji figure is the app's own count through that stop (~, rounded).
  brdLevelDesc: {
    novice: 'Kana dan beberapa kata',
    N5: (k) => `Frasa sederhana · ~${k} kanji`,
    N4: (k) => `Percakapan sehari-hari · ~${k} kanji`,
    N3: (k) => `Hidup sehari-hari dengan lancar · ~${k} kanji`,
    N2: (k) => `Berita dan pekerjaan · ~${k} kanji`,
    N1: (k) => `Hampir semuanya · ~${k} kanji`,
  },
  // The lines: what to learn. The kana are not a row -- every ticket
  // rides them -- so the lines' sheet says so (components/boarding/CardSheets.jsx).
  brdLinesNone: 'Pilih minimal satu jalur.',
  brdLine: { vocab: 'Kosakata', kanji: 'Kanji', grammar: 'Tata bahasa' },
  // 入門 (plan 170): when the lines start, for a learner short of
  // both scripts.
  brdLinesHintNovice: 'Jalurnya dimulai setelah kana.',
  // The lines' sheet: the kana's strip and what each line carries on
  // the ride to its goal.
  brdOnEveryTicket: 'Di setiap tiket',
  brdLineCarries: {
    vocab: (stop) => `kata hingga ${stop}`,
    kanji: (stop) => `kanji hingga ${stop}`,
    grammar: (stop) => `poin hingga ${stop}`,
  },
  brdLinesArrive: (n, stop, date) => `${n === 1 ? 'Dengan jalur ini' : n === 2 ? 'Dengan dua jalur ini' : 'Dengan tiga jalur ini'}, kamu tiba di ${stop} pada **${date}**.`,
  // The rhythm's departure board: a train's minutes and its service,
  // and the days its ride takes; the hour's board.
  brdADay: 'per hari',
  brdRhythmName: { 5: 'Lokal', 10: 'Cepat', 15: 'Cepat khusus', 20: 'Ekspres' },
  brdRideDays: (n) => `${n} hari`,
  brdNewItems: (n) => `~${n} item baru`,
  brdDeparture: 'Keberangkatan',
  brdDayAria: 'Waktu keberangkatan',
  // The notification as the app sends it. brdAppName is the store
  // name, the one the notification header shows; keep it in step with
  // capacitor.config.json's appName.
  brdAppName: 'Tsuji',
  brdNotifText: 'Kartumu sudah menunggu di gerbang.',
  // ── 発車案内 — the daily nudge from the day's queue, the widget and
  // Settings › Notifications (plan 156). The nudge's title and body are
  // written from what the gate will hold at the learner's hour; the
  // title leads with the hour, as a departure board's row (plan 293).
  nudgeTitle: (time, n) => `${time} · ${n} kartu`,
  nudgeMinutes: (m) => (m <= 1 ? 'Sekitar semenit' : `Sekitar ${m} menit`),
  nudgeNew: (n) => `${n} baru`,
  // The reminders' channel, as Android's settings name it (lib/native.js).
  nudgeChannel: 'Pengingat',
  nudgeLine: { kana: 'Kana', vocab: 'Kosakata', kanji: 'Kanji', grammar: 'Tata bahasa' },
  nudgeWhen: { today: 'Hari ini', tomorrow: 'Besok' },
  widgetTitle: 'Kereta hari ini',
  widgetUnit: () => 'kartu',
  widgetMinutes: (m) => `${m} menit`,
  widgetClear: 'Jalur lengang',
  settingsNotif: 'Notifikasi',
  notifOff: 'Nonaktif',
  notifDaily: 'Kereta harian',
  notifDailyCap: 'Sekali sehari',
  notifRemind: 'Ingatkan aku',
  notifOnOff: { on: 'Aktif', off: 'Nonaktif' },
  notifRule: 'Hanya pada hari dengan kartu yang perlu diulang, dan tidak pernah setelah kamu berangkat.',
  notifNoHour: 'Pilih jam keberangkatan agar diingatkan.',
  notifDenied: 'Notifikasi Tsuji dinonaktifkan di pengaturan ponselmu.',
  notifQuiet: 'Minggu ini tidak ada yang perlu diulang pada jam pilihanmu, jadi tidak ada kereta untuk diumumkan.',
  notifNextAria: 'Pengingat berikutnya',
  notifFailed: 'Pengingat berikutnya tidak bisa dihitung.',
  notifWidget: 'Widget',
  notifWidgetCap: { ios: 'Layar terkunci', android: 'Layar utama' },
  notifWidgetHow: {
    ios: 'Sentuh dan tahan layar terkunci, ketuk Sesuaikan, lalu tambahkan Tsuji.',
    android: 'Sentuh lama layar utama, ketuk Widget, lalu seret Tsuji ke sana.',
  },
  notifWidgetWhat: 'Widget ini menampilkan kartu hari ini dan satu kata yang sudah kamu kenal, bukan kata yang perlu diulang minggu ini.',
  // 時間割 (plan 181): the week's agenda.
  settingsAgenda: 'Jadwal',
  agdRowEmpty: 'Tidak ada sesi',
  agdRowValue: (n) => `${n} sesi`,
  agdEveryDay: 'Setiap hari',
  agdWeek: 'Mingguku',
  agdWeekAria: 'Minggumu, hari demi hari',
  agdEmpty: 'Rencanakan minggumu: satu sesi untuk tiap materi, dan Tsuji memberi tahu saat sesi dimulai.',
  agdAdd: 'Tambah sesi',
  agdNew: 'Sesi baru',
  agdEdit: 'Ubah sesi',
  agdNow: 'Sekarang',
  agdSubject: 'Materi',
  agdDays: 'Hari',
  agdFrom: 'Dari',
  agdTo: 'Sampai',
  agdPresets: { weekdays: 'Hari kerja', weekend: 'Akhir pekan', all: 'Setiap hari' },
  agdRemind: 'Pengingat',
  agdLeadLabel: 'Beri tahu aku',
  agdLead: (m) => (m === 0 ? 'Tepat waktu' : `${m} menit sebelumnya`),
  agdBell: (m) => (m === 0 ? 'Tepat waktu' : `${m} menit sebelumnya`),
  agdNoBell: 'Tanpa pengingat',
  agdSave: 'Simpan',
  agdDelete: 'Hapus',
  agdProblem: {
    days: 'Pilih minimal satu hari.',
    time: 'Pilih jam mulai dan jam selesai.',
    length: 'Satu sesi minimal 15 menit.',
  },
  agdClash: (name, days, from, to) => `Sesi ini tumpang tindih dengan ${name} (${days}, ${from}–${to}).`,
  agdSaveFailed: 'Sesi tidak bisa disimpan. Coba lagi.',
  agdLoadFailed: 'Jadwalmu tidak bisa dimuat.',
  agdWebNote: 'Pengingat muncul di aplikasi seluler: di web, jadwal ini hanya panduan.',
  agdDenied: 'Notifikasi Tsuji dinonaktifkan di pengaturan ponselmu, jadi sesi tidak akan mengumumkan apa pun.',
  agdBlockAria: (name, day, from, to) => `${name}, ${day} pukul ${from} sampai ${to}`,
  agdNotifTitle: (name, lead) => (lead === 0 ? `${name} dimulai sekarang` : `${name} ${lead} menit lagi`),
  agdNotifBody: (from, to, lead) => (lead === 0 ? `${from}–${to}` : `Pukul ${from}, sampai ${to}`),
  agdSubjectName: {
    review: 'Pengulangan', kana: 'Kana', vocab: 'Kosakata', kanji: 'Kanji', grammar: 'Tata bahasa',
    reading: 'Membaca', translation: 'Terjemahan', dictation: 'Dikte', composition: 'Menulis',
    conversation: 'Percakapan', comprehension: 'Pemahaman bacaan', exam: 'Tryout',
  },
  agdGo: 'Mulai',
  agdUntil: (end) => `sampai ${end}`,
  agdDayEmpty: (day) => `Tidak ada rencana hari ${day}.`,
  agdAddOn: (day) => `Tambah di hari ${day}`,
  agdDuration: (h, m) => (h && m ? `${h} jam ${m} menit` : h ? `${h} jam` : `${m} menit`),
  agdLasts: (d) => `Durasi ${d}`,
  agdLeadCaption: 'menit sebelum dimulai',
  agdDayAria: (day, n) => `${day}, ${n} sesi`,
  agdHoursAria: 'Jam dalam sehari',
  agdProgressAria: (name) => `${name}, waktu yang sudah berlalu`,
  agdThen: 'Selanjutnya',
  agdStartWith: 'Untuk memulai',
  agdWeekTotalLabel: 'Setiap minggu',
  // 机 (plan 140): the desk's column, its name for a screen reader and
  // its stops, one per question -- the part of the boarding each
  // answers, as the line prints it.
  brdBuildingAria: 'Menyusun perjalananmu',
  brdStop: { kana: 'Kana', level: 'Level', card: 'Kartu' },
  // The first ride's end (screens/RideReading.jsx).
  brdEnter: 'Masuk ke stasiun',
  // 辻 on a phone (plan 168): the kana over the lines' hub, the board's
  // arrival column and first stop, the hour's arrows and first train.
  brdKanaFirstShort: 'Kana dulu',
  brdArriveAt: (stop) => `Tiba di ${stop}`,
  brdFirstStop: (date) => `Perhentian pertama: kana, bisa kamu baca pada **${date}**`,
  brdHourLater: 'Satu jam lebih lambat',
  brdHourEarlier: 'Satu jam lebih awal',
  brdHalfLater: 'Setengah jam lebih lambat',
  brdHalfEarlier: 'Setengah jam lebih awal',
  brdTrainAt: (today, time) => `Keretamu · ${today ? 'hari ini' : 'besok'}, pukul **${time}**, lalu setiap hari`,
  // The card is the form (plan 247): the card filled in, its fields
  // doors, a sheet a field.
  brdCardQ: 'Kartumu, sudah diisi untukmu.',
  brdCardHint: 'Ketuk kolom untuk mengubahnya.',
  brdIssue: 'Terbitkan kartuku',
  brdLevelTest: 'Ragu? Tes akan menentukan levelmu',
  brdKeepDevice: 'Hanya di perangkat ini',
  brdKeepGo: 'Simpan kartuku',
  brdKeepSent: (email) => `Tautan terkirim ke ${email}`,
  brdKeepChange: 'Ubah',
  brdKeptGoogle: 'Tersimpan di akun Google-mu',
  brdKeptEmail: (email) => `Tersimpan · ${email}`,
  brdKeptAccount: 'Tersimpan di akunmu',
  brdKeptSwitch: 'Ganti akun',
  brdSheetGoal: 'Tujuan',
  brdSheetRhythm: 'Ritme',
  brdSheetHour: 'Keberangkatan',
  brdSheetLines: 'Jalur',
  brdSheetName: 'Nama',
  brdSheetAccount: 'Akun',
  brdSheetDone: 'Selesai',
  // The list under the card (plan 247): each field in words, a door to
  // the same sheet as the card's own.
  brdRowsAria: 'Ubah kartumu',
  brdRowGoal: (stop, date) => (date ? `${stop} · tiba ${date}` : stop),
  brdRowRhythm: (name, min) => `${name} · ${min} menit sehari`,
  brdGoalCap: (min) => `dengan ${min} menit sehari`,
  brdNameOptional: 'Opsional',
  brdNamePlaceholder: 'Nama depanmu',
  brdNameNote: 'Nama ini tercetak di kartumu. Dalam huruf Latin, nama ini juga menjadi nama publikmu di papan peringkat.',
  brdNameSave: 'Simpan',
  cardNameTooLong: (n) => `Maksimal ${n} karakter.`,
  brdAccountLede: 'Tanpa akun, kartumu hanya ada di perangkat ini.',
  brdLater: 'Nanti',
  // Plan 270: the account sheet, raised to ask before the card issues and on
  // Today; an address and a password typed twice, no mail to follow.
  brdStayGuest: 'Lanjut sebagai tamu',
  brdAccountAsk: 'Buat akunmu agar kartu dan progresmu bisa kamu buka di perangkat mana pun.',
  brdPasswordNew: (min) => `Kata sandi (minimal ${min} karakter)`,
  brdPasswordAgain: 'Konfirmasi kata sandi',
  brdPasswordMismatch: 'Kedua kata sandi tidak sama.',
  brdAccountSentNote: (email) => `Hampir selesai: konfirmasi ${email} lewat tautan yang baru saja kami kirim.`,
  brdRemindAt: (time) => `Ingatkan aku pukul **${time}**`,
  // Plan 294: the reminder, a step after the card (in the app alone).
  brdRemindQ: 'Mau kami umumkan keretamu?',
  brdRemindHint: 'Setiap hari, pada jam yang tertera di kartumu.',
  brdRemindYes: (time) => `Ya, pukul ${time}`,
  brdRemindLater: 'Nanti saja',
  brdRemindNow: 'sekarang',
  brdAgendaAdd: 'Tambahkan ke kalenderku',
  brdAgendaTitle: 'Tsuji · kereta bahasa Jepangmu',
  brdAgendaBody: (min) => `${min} menit bahasa Jepang, setiap hari.`,
  // Boarding inside another app's browser (lib/inAppBrowser.js): a card
  // made there stays there.
  brdSheetOutside: 'Peramban',
  brdOutsideLede: (app) => `Kartu yang dibuat di dalam ${app} tetap tinggal di ${app}: perambanmu tidak akan melihatnya.`,
  brdOutsideMenu: 'Atau gunakan menu ⋯ di bagian atas layar untuk membuka halaman ini di perambanmu.',
  brdOutsideSafari: 'Buka di Safari',
  brdOutsideChrome: 'Buka di Chrome',
  brdOutsideStay: (app) => `Tetap di ${app}`,
}

const ride = {
  // 試乗 — the test ride (plan 098): the first two cards, on the real
  // stage. One sentence per step, beside the thing it is about; the
  // pair names the place (the stage head), the notes do not repeat it.
  rideDocumentTitle: 'Perjalanan uji coba',
  rideJp: '試乗',
  rideCap: 'Perjalanan uji coba',
  rideSkip: 'Lewati',
  rideKnownFront: 'Ini kartu pertamamu. Ketuk untuk membaliknya.',
  rideKnownBack: 'Sudah tahu kartu ini? Jujur saja: kamu yang menilai dirimu sendiri.',
  rideUnknownFront: 'Yang ini baru untukmu. Balik kartunya.',
  rideUnknownBack: 'Pilih “Salah”. Itu bukan kegagalan: kartunya hanya kembali lebih cepat. Itulah rahasianya.',
  // 机 (plan 115): the same notes, teaching the desk's keys.
  rideKnownFrontDesk: 'Ini kartu pertamamu. Klik atau tekan Spasi untuk membaliknya.',
  rideKnownBackDesk: 'Sudah tahu kartu ini? Jujur saja: kamu yang menilai dirimu sendiri, di bilah atau dengan tombol angka.',
  rideUnknownFrontDesk: 'Yang ini baru untukmu. Balik kartunya: klik atau Spasi.',
  rideUnknownBackDesk: 'Pilih “Salah”, di bilah atau dengan tombolnya. Itu bukan kegagalan: kartunya hanya kembali lebih cepat. Itulah rahasianya.',
  rideGuessed: 'Kartu baru tadi kamu jawab benar? Kalau hanya menebak, lain kali pilih “Salah”, atau kartunya baru kembali beberapa hari lagi.',
  rideDoneBody: n => `Itu saja! **${n} kata baru sehari**, masing-masing kembali tepat sebelum kamu lupa.`,
  rideContinue: 'Lanjut',
  // The reading ride (plan 099): the sentence, the field, the measure;
  // the grade enters the station (its plate went in plan 292).
  rideReadFront: 'Cepat baca! Sebentar lagi kalimatnya hilang.',
  rideReadFrontUntimed: 'Baca, lalu ketik ulang dalam romaji atau kana.',
  rideReadType: 'Ketik yang kamu baca, dalam romaji atau kana.',
  rideReadMeasure: 'Skor menunjukkan seberapa banyak yang kamu tangkap. Sekarang nilai dirimu.',
  rideReadMeasureDesk: 'Skor menunjukkan seberapa banyak yang kamu tangkap. Sekarang nilai dirimu: di bilah, atau dengan tombol angka.',
  // Plan 133. On a phone: the known card is not graded until its entry
  // has been opened from the 🔍 and closed again.
  rideKnownDict: 'Setiap kartu punya entri kamus. Ketuk 🔍 untuk membuka yang ini, lalu tutup lagi.',
}

const guide = {
  // 案内 — the guide over each gate (plan 100): one sentence a stop,
  // beside the thing it is about. The note carried a Japanese eyebrow
  // naming the stop until 2026-09-21; the sentence is the note now.
  guideLabel: 'Panduan',
  guideNext: 'Berikutnya',
  guideDone: 'Selesai',
  guideSkip: 'Lewati',
  // The desk rail's Help: the lit gate's guide, played again on demand.
  guideHelp: 'Bantuan',
  guideHelpTour: gate => `Tur berpemandu: ${gate}`,
  guideTodayGate: 'Pengulangan hari ini dan waktu yang dibutuhkan. Lewat “Atur”, pilih kartu dan jalur, lalu tekan “Berangkat”.',
  guideTabBar: 'Lima tabmu: Belajar, Latihan, Hari Ini, Kamus, dan profilmu.',
  guideTodayDuels: 'Duel: dua menit melawan teman atau penumpang lain di levelmu. Angka emas berarti ada tantangan yang menunggumu.',
  guideLearnPlate: 'Sebuah jalur. Ketuk untuk membukanya. Lencananya menunjukkan yang perlu diulang hari ini.',
  guideLearnStops: 'Perhentianmu di jalur ini, dan seberapa banyak yang sudah kamu ketahui.',
  guideLearnShelf: 'Dek milikmu, ditambah pustaka dek yang dibagikan pelajar lain.',
  guidePracticePass: 'Mode ini termasuk dalam Pass.',
  // Practice's plates (plan 254): a platform, its foot (your level,
  // what you did there) and the mock exam.
  guidePracticePlate: 'Mode latihan: membaca, memahami, menerjemahkan, menyimak, menulis, atau bercakap. Ketuk untuk membukanya di levelmu.',
  guidePracticeStops: 'Levelmu, apa yang sudah kamu kerjakan di level itu, dan berapa banyak yang benar.',
  guidePracticeExam: 'Tryout: ujian ala JLPT di level pilihanmu, dinilai begitu kamu kumpulkan.',
  guideDictConsole: 'Cari berdasarkan kata, cara baca, atau arti.',
  guideDictOptions: 'Perhalus pencarianmu: kata persis, diawali dengan, atau memuat. Cari di teks Jepang, arti, atau keduanya.',
  guideDictChips: 'Jelajahi per koleksi. Entri yang kamu simpan ada di bagian akhir.',
  guideDictEntry: 'Ketuk entri untuk membukanya. Tanda ＋ di entri menyimpannya atau menambahkannya ke salah satu dekmu.',
  guideDictAnalyzer: 'Penganalisis: tempel, foto, atau rekam teks Jepang apa pun, lalu lihat rinciannya.',
  guideProfilePass: 'Pass-mu: namamu, levelmu, dan saldomu.',
  guideProfileStamps: 'Kartu stempelmu: satu stempel untuk setiap hari kamu belajar.',
  guideProfileRecords: 'Angka-angkamu: total pengulangan, yang kamu ingat, rekor jawaban benar beruntun.',
  guideProfileLedger: 'Setiap jalur, dan seberapa jauh kamu sudah melaju.',
  guideProfileSettings: 'Pengaturan: levelmu, ritmemu, cara kamu menilai, dan panduan ini kapan saja.',
  guideLearnLibrary: 'Pustaka: dek yang dibagikan pelajar lain. Buka untuk melihat isinya; ikuti untuk mempelajarinya.',
  guideDictActions: 'Dengarkan, atau gunakan ＋ untuk menyimpannya atau menambahkannya ke salah satu dekmu.',
  guideProfileStats: 'Statistik: yang melekat dan yang terlupa, jalur demi jalur.',
  guideProfileBoard: 'Papan peringkat, dalam XP: minggu ini dan sepanjang masa.',
  // 机 (plan 115): the notes that teach the desk's keys and doors.
  guideTabBarDesk: 'Lima bagianmu, di sisi kiri. Tekan / di mana saja untuk mencari di kamus.',
  guideTodayGateDesk: 'Pengulangan hari ini dan waktu yang dibutuhkan. Pilih kartu dan jalur di sebelah kanan, lalu berangkat. Enter bisa ditekan dari mana saja di sini.',
  guideLearnStopsDesk: 'Seluruh jalur. Klik perhentian mana pun untuk mempelajarinya.',
  // Worded for a pointer (plan 123): the notes that said "tap".
  guideLearnPlateDesk: 'Sebuah jalur. Klik untuk membukanya. Lencananya menunjukkan yang perlu diulang hari ini.',
  // Practice's plates on the desk (plans 165, 254): each carries its exercise.
  guidePracticePlateDesk: 'Mode latihan, dan apa yang dimintanya darimu di levelmu. Klik untuk membukanya.',
  guideDictEntryDesk: 'Entri, terbuka di samping daftar. ← dan → untuk menelusuri daftar.',
  // 机 (plan 248): on the desk the stamp book's figures open the profile's record.
  guideProfileRecordsDesk: 'Angka-angkamu: runtunanmu dan yang terpanjang, hari yang berstempel, total pengulangan, yang kamu ingat, rekor jawaban benar beruntun.',
  // Settings, the two ways back.
  settingsFirstRide: 'Perjalanan pertama',
  settingsRideAgain: 'Ulangi perjalanan uji coba',
  settingsIntroAgain: 'Lihat lagi pengantarnya',
  settingsGuideAgain: 'Tampilkan panduan lagi',
  settingsGuideAgainDone: 'Panduan akan muncul lagi saat berikutnya kamu membuka tiap bagian.',
}

const onboarding = {
  durDays: (n) => `${n} hari`,
  durMonths: (n) => `${n} bulan`,
  durYears: (n) => `${n} tahun`,
  onbContinue: 'Lanjut',
  onbStepsAria: (n, total) => `Langkah ${n} dari ${total}`,
  onbTestKind: {
    reading: 'Bagaimana kata ini dibaca?',
    orthography: 'Mana penulisan kanji yang benar?',
    context: 'Kata mana yang melengkapi kalimat ini?',
    grammar: 'Aturan tata bahasa mana yang dipakai di sini?',
  },
  onbTestStop: 'Terlalu sulit? Berhenti di sini',
  onbClimbLabel: 'Level: lulus, sedang diuji, berikutnya',
  onbTestError: 'Tes tidak bisa dimuat. Tunggu sebentar, lalu coba lagi.',
  onbTestRetake: 'Ikuti tes',
  onbTestResult: (level, correct, total) => `${correct} dari ${total} benar — kami sarankan kamu naik di ${level}.`,
  onbPaceRecommended: 'Disarankan',
  onbPassError: 'Gagal menyimpan — periksa koneksimu dan coba lagi.',
  // The other half of a failed save: the office ANSWERED and refused
  // it. Sending the learner to check a connection that is plainly
  // working is a wrong turn they cannot take -- and "try again" is a
  // false promise, since the same contract earns the same refusal.
  brdPassRefused: 'Loket tidak bisa menerbitkan Pass ini — masalahnya ada di pihak kami, bukan di koneksimu. Tidak ada yang tersimpan.',
  brdPassBusy: 'Loket sedang tidak menjawab. Tidak ada yang tersimpan: tunggu sebentar, lalu coba lagi.',
  // The daily pace, lived: the concourse 新規 gauge and the study
  // screens' session terminus (see components/study/usePace.js).
  paceDoneTitle: 'Target hari ini tercapai',
  paceDoneOf: target => `dari ${target}`,
  paceDoneLabel: 'kartu baru hari ini',
  paceDoneBody: 'Itu jatah kartu baru hari ini. Pengulangan tetap berjalan seperti biasa.',
  paceExtraTrain: 'Lanjut dengan kartu baru',
  paceGaugeLabel: 'Item baru',
  paceGaugeAria: (n, target) => `${n} dari ${target} item baru dipelajari hari ini`,
  settingsLearning: 'Pembelajaran',
  settingsJlptLevel: 'Level JLPT',
  settingsPace: 'Tempo harian',
  // The lines to ride (backend core/lines.py): the Learn gate hangs
  // these first and the plan is priced at them. The kana are not a
  // toggle -- every ticket rides them.
  settingsLines: 'Jalurmu',
  settingsLinesCap: 'Yang sedang kamu pelajari',
  settingsLinesHint: 'Kana ikut di setiap tiket. Setidaknya satu jalur tetap aktif.',
  settingsLineOn: 'Di rutemu',
  settingsLineOff: 'Di luar rutemu',
  plateOffRoute: 'Di luar rutemu',
  // A grade's record on a Practice platform (plan 130; at the foot of
  // its plate on the phone since plan 254): what was done at that grade,
  // then the share of it that went right.
  practiceDone: {
    sentences: n => `${n} kalimat`,
    texts: n => `${n} teks`,
    papers: n => `${n} paket soal`,
    replies: n => `${n} balasan`,
  },
  practiceRight: pct => `${pct}% benar`,
  practiceNotYet: 'Belum',
  // The phone's Practice gate (plan 290): the modes in three groups,
  // the last ride to resume, and the sheet a plate raises, a page a mode.
  practiceGroups: { understand: 'Memahami', express: 'Berekspresi', test: 'Menguji diri' },
  practiceResume: 'Lanjutkan',
  practiceSheet: 'Mode latihan',
  practicePct: pct => `${pct}%`,
  practiceAllPapers: 'Semua paket soal',
  practiceAllScenes: 'Semua adegan',
  // The phone's Learn gate (plan 291): the sheet a line raises, a page
  // a line -- the stop and the mode chosen before departing -- and the
  // shelf of decks under the lines.
  learnSheet: 'Jalur',
  learnStop: 'Perhentian',
  learnMode: 'Mode',
  learnAllDecks: n => `Semua dekku (${n})`,
  // ── A practice station, on the desk (plan 159) ────────────────
  // The source as a switch at the list's head (the JLPT grades, word
  // frequency, your own cards), then the open stop's page: what the
  // exercise asks, its shape, four figures, your latest misses and the
  // grade's points.
  practiceSourceFrequency: 'Frekuensi',
  practiceHow: {
    reading: 'Baca kalimatnya sebelum jam menutupinya, lalu tulis cara bacanya dalam rōmaji.',
    translation: 'Kalimat untuk diungkapkan dalam bahasa Jepang, lalu jawaban acuan dan pendapat tutor tentang jawabanmu.',
    comprehension: 'Teks pendek, lalu pertanyaannya — latihan bagian membaca pada ujian.',
    dictation: 'Dua kali dengar, tidak lebih: tulis dalam rōmaji apa yang kamu dengar.',
    composition: 'Kamu diberi satu poin tata bahasa: tulis kalimat yang memakainya, lalu tutor membacanya.',
    conversation: 'Seseorang berbicara kepadamu dalam sebuah adegan: pilih balasanmu, tuliskan, atau jawab dengan bebas.',
    // On its plate, on the desk (plans 165, 254): the question its well
    // shows.
    exam: 'Soal berformat JLPT, di sini 漢字読み: cara baca kata yang digarisbawahi.',
  },
  practiceBank: {
    sentences: n => `${n} kalimat yang ditulis untuk level ini.`,
    texts: n => `${n} pertanyaan per teks.`,
    clips: n => `${n} kalimat yang direkam untuk level ini.`,
    points: n => `${n} poin untuk dipakai.`,
  },
  practiceSpecTag: {
    sentence: 'Kalimat dari level ini',
    text: 'Teks dari level ini',
    clip: 'Kalimat dari level ini, untuk didengar',
    point: 'Poin dari level ini',
    paper: 'Soal dari level ini',
    scene: 'Adegan dari level ini',
    tier: 'Kata dari tingkat ini',
    mine: 'Kata-katamu',
  },
  practiceFig: {
    sentences: 'Kalimat',
    texts: 'Teks',
    right: 'Benar',
    questions: 'Jawaban benar',
    words: 'Kata level ini',
    tierWords: 'Kata tingkat ini yang ditemui',
    met: 'Kata yang ditemui',
    last: 'Perjalanan terakhir',
  },
  practiceMisses: 'Kalimat yang salah kamu jawab',
  practiceMissedPoints: 'Poin yang salah kamu jawab',
  practiceTexts: 'Teksmu',
  practiceNoMisses: 'Belum ada kalimat yang salah kamu jawab.',
  practiceNoTexts: 'Belum ada teks yang dibaca.',
  practicePoints: 'Poin level ini',
  practiceTextPoints: 'Poin dalam teks',
  practicePointsStudied: (n, of) => `${n} / ${of} dipelajari`,
  practicePointStudied: 'sudah dipelajari',
  practiceTierTitle: (tier, from, to) => `Tingkat ${tier} · kata ${from} sampai ${to}`,
  practiceTierDesc: list => `Kalimat seputar kata-kata tingkat ini (${list}), diurutkan menurut seberapa sering ditulis.`,
  practiceTierWords: 'Kata-kata tingkat ini',
  practiceTierSeen: (n, of) => `${n} / ${of} ditemui`,
  practiceMineDesc: 'Kalimat yang setiap katanya sudah pernah kamu temui.',
  practiceMineNote: 'Hanya kata yang sudah pernah kamu lihat',
  // The mock exam on the desk: each paper a row (plan 159).
  examGradeDesc: 'Empat paket soal berformat JLPT, dengan batas waktu dan skor — skornya tidak resmi.',
  examNext: label => `Berikutnya · ${label}`,
  examLastScore: 'Skor terakhirmu',
  // ── 模試 on a phone (plan 171) ──
  examGrade:           'Level',
  examNextPaper:       'Paket soal berikutnya',
  examThisPaper:       'Paket soal ini',
  examToWrite:         'Belum disusun',
  examMinutesShort: n => `${n} menit`,
  examStart:           'Mulai',
  examPapers:          'Paket soal',
  examMinutesUnit:     'menit',
  examPartsUnit: () => 'bagian',
  examCoverClock:      'Waktu mulai berjalan saat kamu mulai.',
  examCoverBlank:      'Soal yang dibiarkan kosong dihitung salah: tandai soal yang ingin kamu lihat lagi.',
  examSheetShort:      'Lembar',
  examPrevious:        'Sebelumnya',
  examNextQuestion:    'Berikutnya',
  examFinishPaper:     'Selesaikan paket soal',
  examAnsweredOf: (n, total) => `${n} / ${total} terjawab`,
  examBlanks: n => `${n} kosong`,
  examAudioReplayShort: 'Putar ulang',
  examUnofficial:      'tidak resmi',
  examTimeOf: (time, limit) => `${time} dari ${limit}`,
  examScoreAgainst: (pct, target) => `${pct}%, targetnya ${target}%`,
  examByPart:          'Per bagian',
  examSeeAll:          'Lihat semua',
  examMissesOnly:      'Hanya yang salah',
  examTimeLabel:       'Waktu',
  examMisses: n => `${n} kesalahan`,
  examMondai: {
    '漢字読み': 'Membaca kanji',
    '表記': 'Menulis dengan kanji',
    '語形成': 'Pembentukan kata',
    '文脈規定': 'Kata dalam konteks',
    '言い換え類義': 'Parafrase',
    '用法': 'Penggunaan kata',
    '文の文法1': 'Tata bahasa kalimat',
    '文の文法2': 'Menyusun kalimat',
    '文章の文法': 'Tata bahasa teks',
    '内容理解（短文）': 'Teks pendek',
    '内容理解（中文）': 'Teks sedang',
    '内容理解（長文）': 'Teks panjang',
    '統合理解': 'Teks untuk dibandingkan',
    '主張理解（長文）': 'Teks opini',
    '情報検索': 'Mencari informasi',
    '課題理解': 'Memahami tugas',
    'ポイント理解': 'Menangkap poin penting',
    '概要理解': 'Menangkap garis besar',
    '発話表現': 'Apa yang harus diucapkan',
    '即時応答': 'Tanggapan cepat',
  },
  // What a part asks you to do, in plain words, in place of its Japanese instruction (plan 171).
  examMondaiHow: {
    '漢字読み': 'Pilih cara baca kata yang digarisbawahi.',
    '表記': 'Pilih tulisan kanji untuk kata yang digarisbawahi.',
    '語形成': 'Pilih yang melengkapi kata itu.',
    '文脈規定': 'Pilih kata yang tepat untuk bagian yang kosong.',
    '言い換え類義': 'Pilih kalimat yang artinya paling dekat.',
    '用法': 'Pilih kalimat yang memakai kata itu dengan benar.',
    '文の文法1': 'Pilih yang tepat untuk bagian yang kosong.',
    '文の文法2': 'Susun potongan-potongannya, lalu pilih yang masuk di ★.',
    '文章の文法': 'Baca teksnya dan pilih yang tepat untuk setiap bagian yang kosong.',
    '内容理解（短文）': 'Baca teksnya dan jawab pertanyaannya.',
    '内容理解（中文）': 'Baca teksnya dan jawab pertanyaannya.',
    '内容理解（長文）': 'Baca teksnya dan jawab pertanyaannya.',
    '統合理解': 'Baca kedua teks dan jawab pertanyaannya.',
    '主張理解（長文）': 'Baca teksnya dan jawab pertanyaannya.',
    '情報検索': 'Cari di dokumen apa yang ditanyakan.',
    '課題理解': 'Dengarkan, lalu pilih apa yang harus dilakukan orang itu.',
    'ポイント理解': 'Baca pertanyaannya, dengarkan, lalu pilih jawabannya.',
    '概要理解': 'Dengarkan, lalu pilih maksud pembicara.',
    '発話表現': 'Lihat situasinya dan pilih apa yang harus diucapkan.',
    '即時応答': 'Dengarkan ucapannya dan pilih tanggapan terbaik.',
  },
  examMinutes: n => `≈\u00a0${n}\u00a0menit`,
  // ── The mock exam at a desk (plan 200) ───────────────────────
  // The booklet on the left, the answer sheet on the right; the page
  // turns in its foot.
  examQuit:            'Keluar',
  examMark:            'Tandai',
  examToAnswer:        'untuk menjawab',
  examLastQuestion:    'Soal terakhir',
  examThisText:        'Teks ini',
  examLikeThePaper:    'Seperti di kertas ujian',
  examYourSheet:       'Lembar jawabanmu',
  examBlanksLeft: n => `${n} soal masih kosong`,
  examBlankCounts:     'Soal kosong dihitung salah.',
  examGoTo: n => `Ke soal ${n}`,
  examHandIn:          'Tetap kumpulkan',
  examMissOf: (i, n) => `kesalahan ${i} dari ${n}`,
  examPapersSat:       'paket dikerjakan',
  examRightCap:        'benar',
  examLastSitting:     'terakhir',
  examSheetRow: (n, answered) => `Soal ${n}${answered ? '' : ', kosong'}`,
  examOval: (n, choice) => `Soal ${n}, jawaban ${choice}`,
  examAnsweredCap:     'terjawab',
  examSheetResult: (n, state) => `Soal ${n}, ${state === 'ok' ? 'benar' : state === 'x' ? 'salah' : 'dibiarkan kosong'}`,
  examPlayPause:       'putar, jeda',
  settingsRedoDesc: 'Ikuti lagi setelah kamu berkembang — levelmu ikut menyesuaikan.',
  // ── Which rating bar to grade with ──────────────────────────
  // Two buttons, four or six. All three send the same rating to the
  // scheduler — each shorter bar is a longer one with buttons left off
  // — so this changes what you are offered, never what your answers
  // mean.
  settingsRatingScale: 'Tombol penilaian',
  settingsRatingScaleOption: { binary: '2 tingkat', simple: '4 tingkat', full: '6 tingkat' },
  settingsRedoApply: (level) => `Pindah ke ${level}?`,
  levelCurrentMark: 'Kamu di sini',

  // ── 窓口 — settings as the service counter ─────────────────
  // The counter names, then each control's second voice: what the
  // button DOES, in plain words under its name — on a settings screen
  // nothing may need guessing.
  settingsEnvironment: 'Tampilan & bahasa',
  // The short word a rail chip carries; the slip prints the full title.
  settingsEnvShort: 'Tampilan',
  settingsData: 'Data',
  settingsRedo: 'Tes penempatan',
  settingsCredits: 'Atribusi',
  // The pass's contract and the rows under it (plan 140).
  passFieldHour: 'Perjalanan harian',
  passFieldLines: 'Jalur',
  settingsRatingShort: 'Penilaian',
  // ── The reading pace ────────────────────────────────────────
  // How long Reading leaves a sentence up and Comprehension a text:
  // for a slow reader, a dyslexic one, anyone the clock gets in the
  // way of rather than helps.
  settingsReadingPace: 'Tempo membaca',
  settingsReadingPaceHint: 'Berapa lama kalimat di Membaca dan teks di Pemahaman Bacaan tetap tampil sebelum disembunyikan. Pilih waktu lebih lama jika kamu membaca dengan lambat atau mengalami disleksia.',
  readingPaceOption: { standard: 'Standar', relaxed: 'Santai', slow: 'Lambat', untimed: 'Tanpa batas' },
  // The chip at the clock's end, in Reading and Comprehension: each
  // press moves to the next pace.
  readingPaceShort: { standard: '×1', relaxed: '×1,5', slow: '×2', untimed: '∞' },
  readingPaceChip: name => `Tempo membaca: ${name}. Tekan untuk mengubah`,
  readingPaceDesc: {
    standard: 'Waktu biasa',
    relaxed: 'Satu setengah kali waktu biasa',
    slow: 'Dua kali waktu biasa',
    untimed: 'Tidak ada yang disembunyikan sebelum kamu menjawab',
  },
  settingsHelp: 'Bantuan',
  settingsHelpValue: 'Perjalanan · Panduan',
  // Write to us (plan 222): a problem, an idea, a mistake in what is
  // taught, and a card reported from its flag. Nothing leaves the
  // device without being written out here first.
  settingsWrite: 'Kirim pesan ke kami',
  settingsWriteValue: 'Masalah, ide',
  fbKindLabel: 'Jenis pesan',
  fbKind: { problem: 'Masalah', idea: 'Ide', fault: 'Kesalahan' },
  fbPlaceholder: {
    problem: 'Apa yang terjadi, dan di mana.',
    idea: 'Apa yang ingin kamu temukan di sini.',
    fault: 'Kata atau kalimatnya, dan apa yang salah.',
  },
  fbTextLabel: 'Pesanmu',
  fbJoin: 'Sertakan layar dan perangkat',
  fbJoinFailure: 'Sertakan galat, layar, dan perangkat',
  fbScreen: 'layar ini',
  fbFailure: (status, area) => `galat ${status} (${area})`,
  fbDevice: { phone: 'ponsel', tablet: 'tablet', desk: 'komputer', wide: 'komputer' },
  fbPlatform: { web: 'web', native: 'aplikasi' },
  fbReply: 'Balas aku lewat email, dari',
  fbSend: 'Kirim',
  fbSent: 'Diterima, terima kasih.',
  fbSentNote: 'Setiap pesan dibaca oleh manusia.',
  fbSentReply: 'Setiap pesan dibaca oleh manusia. Balasannya akan dikirim lewat email.',
  fbErrLimit: 'Lima pesan sehari: kirim lagi besok.',
  fbErrSend: 'Pesan tidak terkirim. Coba lagi.',
  // Early access (plan 269): asked once, from 400 XP.
  rateCap: 'Akses awal',
  rateQ: 'Berapa nilaimu untuk Tsuji?',
  rateLead: 'Aplikasi ini masih dalam akses awal. Ada yang menurutmu perlu kami ubah?',
  rateLabel: 'Nilaimu',
  rateStar: n => `${n} dari 5`,
  ratePlaceholder: 'Apa yang ingin kamu ubah, kalau ada.',
  rateTextLabel: 'Apa yang ingin kamu ubah',
  rateLater: 'Nanti saja',
  // Google Play (plan 307): the rating sheet, on Android.
  storeQ: 'Beri nilai di Google Play?',
  storeLead: 'Nilaimu membantu pelajar lain menemukan Tsuji.',
  storeGo: 'Beri nilai di Google Play',
  storeWrite: 'Beri tahu kami saja apa yang ingin kamu ubah',
  cardReport: 'Laporkan kartu ini',
  cardReportReasons: 'Apa yang salah',
  cardReason: { reading: 'Cara baca', meaning: 'Arti', audio: 'Suara', example: 'Contoh', other: 'Lainnya' },
  questionReport: 'Laporkan soal ini',
  questionReason: { answer: 'Kunci jawaban salah', ambiguous: 'Ambigu', audio: 'Suara', other: 'Lainnya' },
  cardReportNote: 'Keterangan tambahan, kalau mau.',
  cardReportNoteLabel: 'Keterangan tambahan',
  reportProblem: 'Laporkan masalah ini',
  settingsCreditsCount: n => `${n} sumber`,
  settingsPaceMinutes: m => `≈ ${m} menit`,
  settingsYourPace: 'Tempomu',
  settingsYourPaceSub: n => `${n} / hari · 14 hari terakhir`,
  settingsInsteadOf: d => `sebelumnya ${d}`,
  creditsWhat: { dictionary: 'Kamus', kanji: 'Kanji', strokes: 'Urutan goresan', sentences: 'Contoh kalimat', voice: 'Suara stasiun', speech: 'Ucapan bahasa Jepang', kana: 'Suara kana', type: 'Jenis huruf' },
  // The licence of a source with terms of its own (domain/attributions.js).
  creditsTerms: name => `Ketentuan ${name}`,
  themeDark: 'Gelap',
  themeLight: 'Terang',
  themeAuto: 'Sistem',
  themeAutoHint: 'Mengikuti pengaturan perangkatmu',
  // Each button carries its own caption — no row label. Quiet means
  // ambiance, jingle and announcements; study sounds never move.
  soundQuietPreset: 'stasiun senyap',
  soundFullPreset: 'stasiun ramai',
  volumeMaster: 'Volume utama',
  settingsPerDay: '/ hari',
  settingsTrail: 'Statistik penggunaan',
  settingsTrailHint: 'Layar dan fitur yang kamu pakai serta berapa lama, tidak pernah apa yang kamu tulis. Di server kami sendiri, tidak pernah dibagikan, dihapus dalam 25 bulan.',
  settingsTrailExportBtn: 'Unduh dataku',
  settingsTrailOn: 'Dihitung',
  settingsTrailOff: 'Tidak dihitung',
  settingsExport: 'Ekspor kemajuanmu',
  settingsExportHint: 'Satu file CSV — setiap kartu, jadwalnya, jumlah pengulangannya.',
  settingsExportBtn: 'Ekspor',
  settingsReset: 'Atur ulang kemajuanmu',
  settingsResetHint: 'Semua pengulangan, XP-mu, dan runtunanmu. Dek, level, dan pengaturan tetap ada.',
  settingsResetBtn: 'Atur ulang',
  settingsResetConfirmQ: 'Hapus semuanya? Ini tidak bisa dibatalkan.',
  settingsResetYes: 'Hapus semuanya',
  settingsResetDone: 'Kemajuan diatur ulang. Peta mulai dari awal.',
  settingsDeleteAccount: 'Hapus akunmu',
  settingsDeleteAccountHint: 'Semua pengulangan, dek, kartu, pengaturan, dan info masuk akunmu. Ekspor dulu untuk menyimpan salinan.',
  settingsDeleteAccountBtn: 'Hapus',
  settingsDeleteAccountConfirmQ: 'Hapus akunmu beserta seluruh isinya? Ini tidak bisa dibatalkan.',
  settingsDeleteAccountYes: 'Hapus akunku',
  settingsDeleteAccountFailed: 'Akunmu gagal dihapus. Coba lagi.',
  privacyPolicy: 'Kebijakan privasi',
  // ── The installed app (plan 065) ──
  pwaUpdateReady: 'Jadwal baru sudah berlaku.',
  pwaUpdateBtn: 'Muat ulang',
  pwaUpdateLater: 'Nanti',
  offlineLine: 'Tidak ada koneksi — stasiun tutup untuk sementara.',
  releaseNoticeAt: (time) => `Pembaruan pukul ${time}: aplikasi mungkin tersendat beberapa menit.`,
  releaseNoticeNow: 'Pembaruan sedang berjalan: aplikasi mungkin tersendat beberapa menit.',
  releaseNoticeOk: 'Mengerti',
  installApp: 'Instal aplikasi',
  installAppHint: 'Di layar utamamu, layar penuh, dengan suara kana tersimpan untuk dipakai tanpa koneksi.',
  installAppBtn: 'Instal',
  installIosTitle: 'Tambahkan ke layar utamamu',
  installIosStep1: 'Ketuk Bagikan di bilah alat Safari.',
  installIosStep2: 'Pilih “Tambah ke Layar Utama”, lalu Tambah.',
  installIosBody: 'iPhone dan iPad memasang aplikasi web dari menu Bagikan di Safari — tidak ada tombol untuk itu.',
  settingsIssuedTo: 'Kartu atas nama',

  // ── 行先 — the destination counter ────────────────────────
  // The office's own words, reused where the office is not: the
  // counter borrows the departure board whole, so it only needs the
  // sentences the board cannot draw — what a button will do, and what
  // it costs.
  settingsGoal: 'Tujuan',
  settingsGoalNoneDesc: 'Pass ini tanpa tujuan. Kamu melaju di jalur terbuka — Pass tetap mencatat skor, hanya berdasarkan ritme.',
  settingsGoalChangeDesc: 'Cetak ulang Pass dengan tujuan, tanggal, atau layanan lain.',
  settingsGoalSet: 'Pilih tujuan',
  settingsGoalChange: 'Ubah',
  settingsGoalTerminus: 'Kamu naik di N1 — ujung jalur. Tidak ada stasiun lebih jauh yang bisa dijanjikan.',
  settingsGoalIssue: 'Terbitkan',
  settingsGoalIssueHint: (dest, date, perDay) =>
    `Mencetak ${dest} untuk ${date}, dan mengatur tempo harianmu menjadi ${perDay}. Tanggal dihitung dari hari ini, jadi janjinya dimulai hari ini.`,
  settingsGoalPickHint: 'Pilih tujuan dan papan akan menghitung harganya — atau terus melaju di jalur terbuka.',
  settingsGoalDrop: 'Kembalikan',
  settingsGoalDropHint: 'Mengembalikan tujuan. Tempo dan jam perjalananmu tetap, dan Pass hanya melaporkan ritme — kamu bisa membeli tujuan lain kapan saja.',
  settingsGoalIssued: 'Pass diterbitkan. Jalurmu ada di baliknya.',
  settingsGoalDropped: 'Tujuan dikembalikan. Jalur tetap berjalan tanpa tujuan.',
  settingsGoalDepartHint: 'Jam yang kamu rencanakan untuk naik — opsional, dan tidak pernah menjadi pengingat. Jam ini dicetak di Pass karena janji yang disertai jam lebih mungkin bertahan melewati minggu hujan pertamanya.',
}

const nyumon = {
  // 入門 — the introduction (plan 170): six screens before the first
  // card, for a learner who answered "Not yet" to the kana question. The
  // map of the language, not its knowledge: nothing here is memorised.
  nyuDocumentTitle: 'Pengenalan',
  nyuSkip: 'Lewati pengenalan',
  nyuStop: { scripts: 'Aksara', sounds: 'Bunyi', table: 'Tabel', katakana: 'Katakana', sentence: 'Kalimat', route: 'Rute' },
  nyuStripAria: '6 layar pengenalan',
  nyuQuote: s => `“${s}”`,
  nyuTranslation: '“Saya minum kopi di stasiun.”',
  // 1 · Scripts
  nyuScriptsQ: 'Bahasa Jepang memadukan 3\u00a0aksara.',
  nyuScriptsHint: 'Ketuk salah satu untuk melihatnya di kalimat.',
  nyuScript: {
    hira: { name: 'Hiragana', desc: 'Kata-kata kecil dan akhiran' },
    kata: { name: 'Katakana', desc: 'Kata-kata dari luar negeri' },
    kanji: { name: 'Kanji', desc: 'Satu arti per huruf, untuk nanti' },
  },
  nyuScriptsLit: (name, signs) => `${name}: ${signs}`,
  // 2 · Sounds
  nyuSoundsQ: 'Semuanya dimulai dari 5\u00a0vokal.',
  nyuSoundsHint: 'Ketuk satu huruf untuk mendengarnya.',
  // A vowel's sound, where writing it in letters would mislead.
  nyuSoundsLike: { a: '', i: '', u: '', e: '', o: '' },
  nyuSoundsFoot: 'Bunyinya selalu sama.',
  nyuVowelsAria: '5 vokal',
  // 3 · Table
  nyuTableQ: '46\u00a0huruf, 10\u00a0baris berisi\u00a05.',
  nyuTableHint: 'Di mana “ke”? Cari titik temu baris k dan kolom e.',
  nyuTableFound: '**k + e = ke.** Kamu baru saja membaca huruf yang belum pernah ditunjukkan kepadamu.',
  nyuTableAria: 'Tabel 46 huruf',
  // 4 · Katakana
  nyuPairsQ: 'Bunyi yang sama, 2\u00a0cara menulisnya.',
  nyuPairsLead: 'Katakana dipakai untuk menulis kata-kata dari luar negeri. Kamu sudah tahu beberapa:',
  nyuHearWord: 'Dengarkan kata',
  nyuWords: { hotel: 'hotel', coffee: 'kopi', tv: 'televisi' },
  // 5 · Sentence
  nyuSentenceQ: 'Kata kerja ada di akhir.',
  nyuSentenceHint: 'Tanpa “saya”, tanpa kata sandang, tanpa bentuk jamak.',
  nyuGhost: '(saya)',
  nyuMeans: { station: 'stasiun', coffee: 'kopi', drink: 'minum' },
  nyuRoles: { where: 'di mana', what: 'apa' },
  nyuVerb: 'kata kerja',
  nyuSwap: 'Tukar stasiun dan kopi',
  nyuSwapped: '**Artinya sama:** penandalah yang menentukan peran, bukan letaknya.',
  // 6 · Route
  nyuRouteQ: date => `Pada ${date}, kamu sudah bisa membaca huruf-huruf ini.`,
  nyuRouteQSoon: 'Sebentar lagi, kamu bisa membaca huruf-huruf ini.',
  nyuRouteStops: { start: 'Awal', kana: 'Kana', n5: 'N5' },
  nyuRouteDay: n => `Setiap hari: **${n}\u00a0materi baru** dan pengulanganmu.`,
  nyuTryCard: 'Coba satu kartu',
}

// ── 191:primitives ──
const clrPrimitives = {
  clrXpUnit: 'xp',
  clrWeekAria: parts => `Pekan: ${parts.join(', ')}`,
  clrWeekStamped: (from, to) => (from === to ? `${from} distempel` : `${from} sampai ${to} distempel`),
  clrWeekMissed: day => `${day} terlewat`,
  clrWeekRest: day => `${day} diisi hari istirahat`,
  clrWeekToday: day => `${day} hari ini`,
  clrSealAria: date => `Stempel hari ini: stasiun Tsuji, ${date}`,
  clrTicketCaption: days => (days === 30 ? 'Sebulan berturut-turut' : days === 365 ? 'Setahun berturut-turut' : `${days} hari berturut-turut`),
}

// ── 191:piles ──
// See the French table.
const clrDay = {
  clrPiles: ['Perlu diulang', 'Benar', 'Mudah'],
  clrPileCount: n => `${n} kartu`,
  clrPileEmpty: 'Tidak ada kartu',
  clrPileOpen: term => `Buka ${term} di kamus`,
}

// ── 250:finish ──
// See the French table.
const clrFinish = {
  finFareOf: 'termasuk',
  finFarePrime: 'bonus runtunan',
  finMissGo: 'Lihat',
  finTicketName: days => (days === 7 ? 'Tiket seminggu' : days === 30 ? 'Tiket sebulan' : days === 365 ? 'Tiket setahun' : `Tiket ${days} hari`),
  finTicketAria: (days, jackpot, rest) => `${days === 7 ? 'Tiket seminggu' : `Tiket ${days} hari`}: +${jackpot} xp${rest ? ', +1 hari istirahat' : ''}`,
  finShare: 'Bagikan tiket',
  finShareGo: 'Gambar',
  finRestLine: held => `+1 hari istirahat · ${held} tersimpan`,
  finMonthTicketAria: (days, jackpot) => `${days === 30 ? 'Tiket sebulan' : days === 365 ? 'Tiket setahun' : `Tiket ${days} hari`}, ${days === 30 ? 'sebulan berturut-turut' : days === 365 ? 'setahun berturut-turut' : `${days} hari berturut-turut`}: +${jackpot} xp`,
  finCranesAria: n => `${n} bangau melintasi langit, satu untuk setiap hari berturut-turut`,
  finLanternsAria: n => (n >= 365 ? 'Sungai lentera di danau, setahun penuh' : `${n} lentera di danau, satu untuk setiap hari`),
  finStake: 'untuk stempel hari ini',
  finThreadDone: () => 'selesai',
  finThreadLeft: () => 'tersisa',
  finContinue: 'Lanjut',
}

// ── 191:restday ──
const clrRestday = {
  rstTitle: 'Runtunanmu aman',
  rstWeekAria: parts => `Pekan ini: ${parts.join(', ')}`,
  rstStreakWord: n => (n === 1 ? 'hari' : 'hari berturut-turut'),
  rstUsed: days => (days.length === 1
    ? `Hari istirahat dipakai pada ${days[0]}`
    : `Hari istirahat dipakai pada ${days.slice(0, -1).join(', ')} dan ${days.at(-1)}`),
  rstHeld: 'tersimpan',
  rstNextPre: 'berikutnya saat runtunan',
  rstNextPost: '\u00a0hari',
  rstTodayAria: (n, min) => `Hari ini: ${n} kartu${min ? `, sekitar ${min} menit` : ''}`,
  rstCards: () => 'kartu',
  rstMin: 'mnt',
  rstDepart: 'Berangkat',
}

// ── 191:tickets ──
const clrTickets = {
  tkbTitle: 'Tiket',
  tkbDoor: 'Tiket',
  tkbBack: 'Kembali ke profil',
  tkbChosenAria: 'Tiket terpilih',
  tkbRecord: 'Rekor',
  tkbBookAria: (n, total) => `Tiket: ${n} dari ${total} didapat`,
  tkbIn: n => `${n} hr lagi`,
  tkbDaysShort: n => `${n} hr`,
  tkbRange: (from, to) => `${from} sampai ${to}`,
  tkbTicketAria: (days, no, range, record) => `Tiket ${days} hari, nomor ${no}, ${range}${record ? ', rekor' : ''}`,
  tkbCellAria: (days, record) => `Tiket ${days} hari${record ? ', rekor' : ''}`,
  tkbLockedAria: (days, inDays) => `Tiket ${days} hari, belum didapat${inDays ? `, ${inDays} hari lagi` : ''}`,
  tkbShareTicket: 'Bagikan tiket ini',
  tkbShareFigures: { reviews: 'kartu diulang', words: 'kata dipelajari', level: 'dalam perjalanan' },
  tkbShareAria: (days, no, range, stamped) => `Tiket ${days} hari, nomor ${no}, ${range}, distempel pada ${stamped}`,
  tkbShareRouteAria: 'Rute perjalanan',
  tkbShareText: days => `${days} hari berturut-turut di Tsuji`,
  tkbShareSaved: 'Gambar tersimpan.',
  tkbShareFailed: 'Gagal membagikan.',
  tkbToday: 'hari ini',
  tkbEmpty: 'Tiket pertamamu',
  tkbEmptyAria: (days, inDays) => `Belum ada tiket. Yang pertama, ${days} hari berturut-turut, ${inDays ? `${inDays} hari lagi` : 'hari ini'}`,
  tkbEmptyGo: 'Berangkat',
}

// ── 217:reviews ──
// 回復運転 — the review plan (plan 217): the comeback notice on Today
// and its sheet (plan 254), the catch-up's figure in the day, the run
// past the share, Settings › Reviews and the notification that invites
// back.
const reviewPlan = {
  cbJp: '運転再開',
  cbCap: 'Layanan kembali berjalan',
  cbLabel: 'Lanjut sesuai ritmemu',
  cbAway: n => `Selamat datang kembali — ${n} hari tak berjumpa.`,
  cbPiled: 'Pengulanganmu menumpuk.',
  cbOwed: n => `${n} kartu menunggu. Tidak perlu menyelesaikan semuanya hari ini — pilih ritmemu.`,
  cbChoices: 'Ritmemu',
  cbSpread: 'Dicicil',
  cbGentle: 'Santai',
  cbAll: 'Sekaligus',
  cbPerDay: n => `${n} per hari`,
  cbOverDays: n => `selama ${n} hari`,
  cbNoEnd: 'tanpa batas waktu',
  cbCards: n => `${n} kartu`,
  cbMinutes: m => `≈ ${m} mnt`,
  cbDays: 'Selama berapa hari',
  cbDaysN: n => `${n} hari`,
  cbNewPaused: 'Kartu baru kembali begitu kamu tidak tertinggal lagi.',
  cbGo: 'Ayo mulai',
  cbError: 'Pilihanmu gagal disimpan. Coba lagi.',
  cbLinePiled: n => (n === 1 ? 'kartu menunggu' : 'kartu menumpuk'),
  cbLineGo: 'Cicil',
  cbHide: 'Sembunyikan untuk hari ini',
  todayCatchupDay: 'hari pemulihan',
  todayCatchupGentle: 'per hari untuk pemulihan',
  todayCatchupShort: 'pemulihan',
  todayHeld: 'Menunggu',
  todayHeldGo: 'Ulangi',
  settingsReviews: 'Pengulangan',
  rvRowNone: 'Tanpa batas',
  rvRowCap: n => `Maksimal ${n} per hari`,
  rvRowCatchup: 'Dalam pemulihan',
  rvRowAway: from => `Cuti mulai ${from}`,
  rvCapLabel: 'Pengulangan per hari',
  rvCapHint: 'Di atas batas itu, kartu menunggu hari berikutnya, dan harimu selesai begitu jatahmu tuntas.',
  rvCapNone: 'Tidak ada',
  rvCapUnder: load => `Sekitar ${load} kartu perlu diulang setiap hari: dengan batas ini, tumpukannya akan terus bertambah.`,
  rvCatchupLabel: 'Pemulihan',
  rvCatchupSpread: (perDay, day, of) => `${perDay} kartu per hari · hari ke-${day} dari ${of}`,
  rvCatchupGentle: perDay => `${perDay} kartu per hari, tanpa batas waktu`,
  rvCatchupNew: 'Kartu baru dijeda sampai pemulihan selesai.',
  rvCatchupStop: 'Hentikan pemulihan',
  rvAwayLabel: 'Cuti',
  rvAwayHint: n => `Hari-hari cutimu tetap menjaga runtunanmu, dan kartu baru berhenti dua hari sebelum kamu pergi. Paling lama ${n} hari.`,
  rvAwayFrom: 'Dari',
  rvAwayUntil: 'Sampai',
  rvAwaySave: 'Simpan',
  rvAwayCancel: 'Batalkan cuti',
  rvAwaySet: (from, until) => `${from} sampai ${until}`,
  rvAwayErr: {
    past: 'Hari pertama tidak boleh di masa lalu.',
    order: 'Hari terakhir harus setelah hari pertama.',
    long: n => `Paling lama ${n} hari.`,
  },
  rvError: 'Perubahan gagal disimpan.',
  nudgeComebackTitle: time => `Keretamu pukul ${time} · mulai lagi pelan-pelan?`,
  nudgeComebackBody: 'Beberapa menit sudah cukup untuk mulai lagi.',
}

// ── 243b:transfer ──
// 乗換 (plans 243, 243b): Settings › Transfer, another app's progress
// brought across on a transfer ticket -- the source, the file or the
// key, what the course finds, the stamp, and the way back while the
// imported cards wait for their first answer; and the sheet over Today
// that asks a new learner, once.
const trCount = n => n.toLocaleString(intlLocale('id'))

const transfer = {
  settingsTransfer: 'Transit',
  trRowValue: 'Anki, WaniKani, Renshuu',
  trCap: 'Transit',
  trTicketLabel: 'Tiket transit',
  trFrom: 'Dari',
  trTo: 'Ke',
  trSource: { anki: 'Anki', wanikani: 'WaniKani', renshuu: 'Renshuu' },
  trFileHint: 'File **.apkg** atau **.colpkg** milikmu',
  trChooseFile: 'Pilih file Anki',
  trKeyLabel: { wanikani: 'Token API WaniKani-mu', renshuu: 'Kunci API Renshuu-mu' },
  trKeyPlaceholder: { wanikani: 'Tempel di sini', renshuu: 'Tempel di sini' },
  trReadKey: { wanikani: 'Baca kartu WaniKani', renshuu: 'Baca kartu Renshuu' },
  trPages: n => `${trCount(n)} halaman dibaca`,
  trHowQ: { anki: 'Bagaimana cara mengekspornya dari Anki?', wanikani: 'Di mana menemukan tokenku?', renshuu: 'Di mana menemukan kunciku?' },
  trHow: {
    anki: ['**File › Ekspor…**', 'Centang **Sertakan informasi penjadwalan**', 'Hapus centang **Sertakan media**: file tetap ringan'],
    wanikani: ['Di WaniKani, **Settings › API Tokens**', 'Buat token **tanpa izin apa pun**: token itu hanya bisa membaca', 'Tempel di sini'],
    renshuu: ['Di pengaturan Renshuu, cari **kunci API**', 'Salin kuncinya', 'Tempel di sini'],
  },
  trPrivacyFile: 'Dibaca di perangkatmu. Hanya kata-katanya yang dikirim.',
  trPrivacyKey: name => `Perangkatmu membaca ${name} sendiri: kuncimu tidak pernah dikirim ke kami, dan tidak disimpan.`,
  trFound: () => 'kartu dipindahkan',
  trLine: { vocab: 'Kosakata', kanji: 'Kanji', kana: 'Kana' },
  trDecks: 'Dek',
  trDue: (n, weeks) => `${trCount(n)} di antaranya sudah lewat jadwal: muncul lagi bertahap selama ${weeks} minggu.`,
  trKept: n => `${trCount(n)} yang sudah dipelajari di sini tetap seperti semula.`,
  trAbove: n => `${trCount(n)} melampaui level dan tujuanmu: akan masuk ke jadwal harianmu begitu levelmu sampai ke sana.`,
  trCheck: 'Setiap kartu diperiksa saat pertama kali muncul lagi.',
  trPunch: 'Stempel tiket',
  trAllKept: 'Kamu sudah mempelajari semua kartu ini di sini: tidak ada yang perlu dipindahkan.',
  trNone: 'Tak satu pun catatan ini punya kartu di kursus.',
  trMissing: n => `${trCount(n)} catatan tanpa kartu di kursus`,
  trMissingSample: sample => `Contohnya: ${sample}.`,
  trReadFrom: list => `Kata dibaca dari ${list}.`,
  trRestart: 'Mulai ulang',
  trImported: () => 'kartu diimpor',
  trImportedHint: 'Kartu masuk ke jadwal harianmu sesuai tanggalnya. Saat pertama kali muncul, setiap kartu diperiksa.',
  trPunched: 'Distempel',
  trGoToday: 'Buka Hari Ini',
  trWaiting: n => `${trCount(n)} kartu yang diimpor masih menunggu jawaban pertamamu.`,
  trUndo: 'Batalkan impor',
  trUndoConfirmQ: 'Hapus kartu yang diimpor tapi belum kamu ulang? Yang sudah kamu ulang di sini tetap ada.',
  trUndoYes: 'Hapus',
  trUndone: n => `${trCount(n)} kartu dihapus.`,
  trErr: {
    notAnki: 'File ini bukan dek Anki (.apkg atau .colpkg).',
    unreadable: 'File ini tidak bisa dibaca.',
    noSchedule: 'Dek ini diekspor tanpa jadwalnya: ekspor lagi dengan “Sertakan informasi penjadwalan”.',
    nothing: 'Tidak ada yang bisa dipindahkan: aplikasi itu belum mengajarkan kartu apa pun kepadamu.',
    tooMany: 'Terlalu banyak catatan sekaligus: pilih lebih sedikit dek.',
    badKey: 'Kunci ini tidak diterima. Periksa, lalu tempel lagi.',
    network: 'Aplikasi itu tidak bisa dihubungi. Periksa koneksimu.',
    rate: 'Aplikasi itu meminta kita menunggu sebentar. Coba lagi dalam semenit.',
    unreachable: 'Aplikasi itu tidak merespons seperti seharusnya. Coba lagi nanti.',
    server: 'Impor tidak berhasil. Coba lagi.',
  },
  trSheetQ: 'Pernah belajar di tempat lain?',
  trSheetLead: 'Kata-kata yang kamu tahu tidak mulai dari nol: ritmenya tetap terjaga.',
  trSheetGo: 'Bawa progresku ke sini',
  trSheetLater: 'Aku mulai di sini',
  trSheetFoot: 'Bisa kapan saja, di Pengaturan.',
}

// ── 対戦 — duels (plan 279) ─────────────────────────────────────
// The sprint: two minutes, the same questions for both players.
const pvp = {
  pvpTitle:        'Duel',
  pvpChallenges:   n => `${n} tantangan menunggu`,
  pvpFriendsN:     n => `${n} teman`,
  pvpRequestsN:    n => `${n} permintaan`,
  pvpElo:          'Elo',
  pvpRecordLong:   (w, d, l) => `${w} menang · ${d} seri · ${l} kalah`,
  pvpRankOf:       (r, n) => `#${r} dari ${n}`,
  pvpSprints:      'sprint',
  pvpBeat:         s => `${s} untuk dikalahkan`,
  pvpHoursLeft:    h => `sisa ${h} jam`,
  pvpDefies:       who => `${who} menantangmu`,
  pvpLiveDefies:   who => `${who} menunggumu di duel langsung`,
  pvpPlay:         'Main',
  pvpBeatUnit:     'untuk dikalahkan',
  pvpDefy:         'Tantang',
  // 新しい (plan 287): the duels announced once, on Today, to whoever
  // knew it before their key stood there.
  newsCap:         'Baru',
  newsDuelsTitle:  'Duel kini ada di Hari Ini',
  newsDuelsLead:   depart => `Dua menit menjawab soal melawan teman atau penumpang selevelmu, dan kecepatan ikut dihitung. Tombol ⇄ di samping “${depart}” membuka duel.`,
  newsDuelsGo:     'Lihat duel',
  newsDuelsLater:  'Nanti',
  pvpRanked:       'Sprint peringkat',
  pvpRankedDesc:   'Seseorang dengan Elo dekat denganmu, atau rekaman perjalanannya.',
  pvpFriendDuel:   'Tantang teman',
  pvpFriendDesc:   'Nanti atau langsung. Tanpa peringkat.',
  pvpCredits:      n => `${n} kredit`,
  pvpFree:         'Gratis',
  // The pass pays for everything (the hall's and the ticket's price).
  pvpIncluded:     'Sudah termasuk',
  pvpTabToPlay:    'Giliranmu',
  pvpTabRunning:   'Berjalan',
  pvpTabDone:      'Selesai',
  pvpFriendTag:    'teman',
  pvpWin:          'Menang',
  pvpLoss:         'Kalah',
  pvpDraw:         'Seri',
  pvpTraveller:    'Penumpang',
  pvpFriendsTitle: 'Teman',
  pvpSearchCap:    'Nama pengguna yang persis',
  pvpAsk:          'Tambah teman',
  pvpAccept:       'Terima',
  pvpRefuse:       'Tolak',
  pvpRequest:      'permintaan pertemanan',
  pvpYourDuels:    (w, l) => `duelmu: ${w} M · ${l} K`,
  pvpAddFriend:    'Tambah teman lewat nama pengguna',
  pvpWhom:         'Tantang siapa',
  pvpHow:          'Cara main',
  pvpLater:        'Nanti · 48 jam',
  pvpLive:         'Langsung',
  pvpLaterHelp:    who => `Perjalanan yang sama untuk kalian berdua; ${who} punya waktu 48 jam untuk menempuhnya.`,
  pvpLiveHelp:     who => `Kalian berangkat bersama, tiga detik setelah ${who} tiba.`,
  pvpChallenge:    who => `Tantang ${who}`,
  pvpInvite:       who => `Undang ${who}`,
  pvpSprintOf:     ms => (ms >= 120_000 && ms % 60_000 === 0 ? `Sprint · ${ms / 60_000} menit` : `Sprint · ${ms / 1000} detik`),
  pvpDuelLevel:    'Level duel',
  pvpQuestions:    'Soal',
  pvpWordsKanji:   'kata dan kanji',
  pvpWordsKana:    'kata dan kana',
  pvpWordsKanaKanji: 'kata, kana, dan kanji',
  pvpEloOf:        n => `Elo ${n}`,
  pvpEloRange:     (a, b) => `Elo ${a} – ${b}`,
  pvpChoicesN:     n => `${n} pilihan`,
  pvpLength:       'Durasi',
  pvpMinutes:      n => `${n} mnt`,
  pvpStake:        'Dipertaruhkan',
  pvpStakeElo:     n => `± ${n} Elo`,
  pvpNovice:       'Pemula',
  pvpPrice:        'Harga',
  pvpFreeFriends:  'gratis antarteman',
  pvpGo:           'Berangkat',
  pvpRankedFoot:   'Jika tak ada pemain dengan Elo dekat denganmu yang sedang luang, kamu melawan rekaman perjalanan pemain sungguhan, lengkap dengan nama penggunanya.',
  pvpGoPaid:       n => `Berangkat · ${n} kredit`,
  pvpYou:          'Kamu',
  pvpKind:         { word: 'Kata', reading: 'Cara baca', writing: 'Penulisan', kana: 'Kana' },
  pvpQuit:         'Keluar dari sprint',
  pvpReady:        'Siap?',
  pvpOver:         'Selesai',
  // The race as a game (plan 285, the owner's C1) and its result (E4).
  pvpGoBand:       'Mulai!',
  pvpArrival:      'Finis!',
  pvpRush:         'Detik akhir',
  pvpCombo:        'Kombo',
  pvpComboLost:    n => `${n} terputus`,
  pvpPassMe:       'Unggul!',
  pvpPassThem:     who => `${who} unggul`,
  pvpNote:         { flash: 'Kilat', quick: 'Cepat' },
  pvpLines:        { speed: 'Kecepatan', combo: 'Kombo', rush: 'Detik akhir', accuracy: 'Ketepatan', flashes: 'Kilat' },
  pvpInARow:       (a, b) => `${a} / ${b} beruntun`,
  pvpVerdict:      { win: 'Menang!', loss: 'Kalah', draw: 'Seri' },
  pvpAhead:        n => `unggul ${n.toLocaleString(intlLocale('id'))} poin`,
  pvpBehind:       n => `tertinggal ${n.toLocaleString(intlLocale('id'))} poin`,
  pvpGrade:        g => `Nilai ${g}`,
  pvpBy:           n => `selisih ${n} poin`,
  pvpWaitingFor:   who => `Menunggu ${who}`,
  pvpRightsOf:     (r, n) => `${r} benar dari ${n}`,
  pvpCorrections:  'Rincian dan koreksi',
  pvpNewSprint:    'Sprint baru',
  pvpRematch:      'Tanding ulang',
  pvpXpLeft:       n => `${n} lagi hari ini`,
  pvpEloBoard:     'Peringkat Elo',
  pvpAll:          n => `Semua · ${n}`,
  pvpFriendsOnly:  n => `Teman · ${n}`,
  pvpGapTo:        (n, r) => `${n} poin Elo lagi ke #${r}`,
  pvpBilan:        'menang–kalah',
  pvpOrdinal:      r => `#${r}`,
  pvpOutOf:        n => `dari ${n}`,
  pvpDuelWith:     who => `Duel · ${who}`,
  pvpToBeat:       'Target',
  pvpNoneToPlay:   'Tidak ada tantangan untuk dimainkan.',
  pvpNoneRunning:  'Tidak ada yang sedang berjalan.',
  pvpNoneDone:     'Belum ada duel yang dimainkan.',
  pvpLiveWaits:    'Langsung · menunggumu',
  pvpLiveNow:      'Langsung',
  pvpRunning:      'Sprintmu masih berjalan',
  pvpResume:       'Lanjutkan',
  pvpNobodyYet:    'menunggu lawan',
  pvpClosedRow:    'ditutup',
  pvpEnter:        'Masuk',
  pvpOpen:         'Buka',
  pvpEloFrom:      level => `Dimulai dari levelmu, ${level}, lalu berubah di setiap sprint peringkat.`,
  pvpNotRanked:    'belum ada peringkat',
  pvpProvisional:  'Sementara: kurang dari 15 duel peringkat',
  pvpCurveLabel:   n => `Elo-mu dalam ${n} duel peringkat terakhir`,
  pvpStartAt:      n => `awal ${n}`,
  pvpPeak:         n => `puncak ${n}`,
  pvpRacedLater:   who => `${who} akan berlomba melawan rekamanmu.`,
  pvpVerdictLater: who => `Hasilnya keluar setelah ${who} bermain.`,
  pvpShut:         { expired: 'Kedaluwarsa', declined: 'Ditolak', cancelled: 'Dibatalkan' },
  pvpRefunded:     'Tidak ada yang datang: kreditmu dikembalikan.',
  pvpNoVerdict:    'Tidak ada hasil untuk duel ini.',
  pvpNoVerdictRefunded: 'Tidak ada hasil untuk duel ini: kreditmu dikembalikan.',
  pvpDecline:      'Tolak tantangan',
  pvpCancel:       'Batalkan tantangan',
  pvpNotMet:       'tidak sampai',
  pvpRightShort:   'benar',
  pvpWrongShort:   'salah',
  pvpBetweenYou:   'antara kalian',
  pvpCardStranger: 'Sebelum berteman, hanya nama pengguna yang terlihat.',
  pvpReport:       'Laporkan',
  pvpReasons:      { name: 'Nama pengguna tidak pantas', cheat: 'Curang', spam: 'Permintaan atau tantangan berulang', other: 'Hal lain' },
  pvpReportSend:   'Kirim laporan',
  pvpReported:     'Laporan terkirim. Seseorang akan membacanya.',
  pvpRemoved:      'Kalian tidak lagi berteman.',
  pvpBlocked:      'Diblokir: kalian tidak akan saling menemukan lagi.',
  pvpRemoveFriend: 'Hapus pertemanan',
  pvpBlock:        'Blokir',
  pvpFind:         'Cari',
  pvpRelation:     { me: 'Itu kamu', friend: 'Teman', sent: 'Permintaan terkirim', received: 'Ingin berteman', none: '' },
  pvpChallengeShort: 'Tantang',
  pvpSentN:        n => `${n} permintaan terkirim`,
  pvpWithdraw:     'Batalkan',
  pvpBlockedN:     n => `${n} diblokir`,
  pvpUnblock:      'Buka blokir',
  pvpNoFriends:    'Belum ada teman: cari nama pengguna yang persis.',
  // The server's refusals, by their code (domain/duel.js, errorKey).
  pvpErrNotFound:     'Tidak ada yang memakai nama pengguna itu.',
  pvpErrSelf:         'Itu nama penggunamu sendiri.',
  pvpErrNotFriends:   'Kalian belum berteman.',
  pvpErrCooldown:     'Kamu bisa meminta lagi nanti.',
  pvpErrFriendLimit:  'Daftar teman penuh: maksimal 200 teman.',
  pvpErrPendingLimit: 'Terlalu banyak permintaan yang masih menunggu jawaban.',
  pvpErrRequestLimit: 'Sudah cukup permintaan untuk hari ini.',
  pvpErrSearchLimit:  'Terlalu banyak pencarian berturut-turut. Coba lagi dalam beberapa menit.',
  pvpErrNoRequest:    'Permintaan itu sudah tidak berlaku.',
  pvpErrNotBlocked:   'Nama pengguna itu tidak diblokir.',
  pvpErrTooMany:      'Terlalu banyak duel yang sedang berjalan. Selesaikan satu dulu.',
  pvpErrClosed:       'Duel ini sudah ditutup.',
  pvpErrDuelGone:     'Duel ini sudah tidak ada.',
  pvpErrRunning:      'Temanmu sedang menjalani duel ini: kamu bisa menolak setelah sprintnya selesai.',
  pvpErrPlayed:       'Kamu sudah menjalani duel ini.',
  pvpErrWaiting:      'Temanmu belum masuk.',
  pvpErrNotStarted:   'Sprint belum dimulai.',
  pvpErrTooEarly:     'Sebentar: soalnya segera muncul.',
  pvpErrNotSettled:   'Koreksi dibuka setelah hasil duel ditentukan.',
  pvpErrUnpaid:       'Koreksi seharga 1 kredit.',
  pvpErrCredits:      'Kreditmu tidak cukup.',
  pvpErrFailed:       'Tidak berhasil. Coba lagi.',
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
