// ── 場面 — the highlights' recordings of the rest of the app (plan 331) ──
// The Instagram highlights (highlights.js) film the app where it does
// what the Practice tab does not: a new kana and a new rule as they are
// met (Daily), the analyzer fed a YouTube link, a photo and a song
// (Analyzer), and the transfer from another app and the account's data
// (Free?). Each is a script as a feature video's is (feature.js): steps
// the recorder takes in the real app (long/record.mjs), its API answered
// from bank/promo.json's `scenes` (scripts/carousel_bank.py, the
// backend's own functions), and beats, each a caption over the parts it
// shows. feature.js plans, times and draws them as it does its own.
//
// A caption says what the screen shows, in the app's own words where it
// has them (the transfer's "keep their rhythm", the account's export).

// What every step and beat names, by the app's classes.
const CONTINUE = '.tour__foot [data-action="continue"]'
const CHECK = '.tour__foot [data-action="check"]'
const PLAY = '.anl-pbar .anl-player__btn--main'
const RESULT = '.anl-results'
// What a playing session is about, the camera on it rather than on the
// page down to its dock: a video's picture with its line, a song's lyrics.
// Its part asks for the framing (`cam`), or the camera would stay where
// the tap on Play below brought it; a video's picture and its line are
// taller together than the view, so it is read down, picture to line.
const WATCHED = ['.anl-m__video', '.anl-m__subs .anl-subs__line']
const SUNG = ['.anl-m__player--song .anl-now', '.anl-m__lyrics .anl-lyrics__now', '.anl-m__lyrics .anl-lyrics__line']
const LINK_FIELD = '#anl-panel-video input.anl-field'
const LINK_GO = '#anl-panel-video .anl-link > .btn-primary'
const PHOTO_FILE = '#anl-panel-photo input.analysis-image-input__file:not([capture])'
const WHOLE = '.analysis-cropper .phrase-input-actions .phrase-history-toggle >> nth=0'
const SLIP_GO = '#anl-panel-photo .anl-slip .anl-action'
const SONG_FILE = '#anl-panel-song input[type=file]'
const DELETE = '[data-action="delete-account"]'
// Settings › Account's export, by its name in the learner's language (locales: settingsExport).
export const EXPORT_NAME = { en: 'Export your progress', fr: 'Exporter ta progression' }
const exportSlip = lang => `.slip:has-text("${EXPORT_NAME[lang] || EXPORT_NAME.en}")`

export const SCENE_IDS = ['kana', 'tour', 'video', 'photo', 'song', 'transfer', 'account']

export const SCENES = {
  kana: {
    jp: '仮名', line: 'kana', name: { en: 'A new kana', fr: 'Un nouveau kana' },
    title: { en: 'A new kana, heard, traced and used', fr: 'Un nouveau kana, entendu, tracé et employé' },
    end: { en: 'Learn the kana on Tsuji.', fr: 'Apprends les kana sur Tsuji.' },
    steps: d => [
      { go: `/learn/kana/${d.set}/${d.mode}`, ready: '.tour--glyph' },
      { wait: 900 },
      { shot: 'read', focus: '.tour--glyph', tap: CONTINUE },
      { click: CONTINUE, ready: '.gt-board', settle: 800 },
      { shot: 'write', focus: '.gt-board' },
      { trace: '.gt-pen', strokes: d.strokes, shot: 'tracing', focus: '.gt-board' },
      { wait: 700 },
      { shot: 'traced', focus: '.gt-board', tap: CONTINUE },
      { click: CONTINUE, ready: '.gt-words', settle: 800 },
      { shot: 'use', focus: '.gt-words' },
    ],
    beats: [
      { say: { en: 'A new kana, and its sound.', fr: 'Un nouveau kana, et son son.' }, parts: [{ shot: 'read', hold: 2.2, tap: 1.7, clip: true }] },
      { say: { en: 'Trace it, stroke by stroke.', fr: 'Trace-le, trait par trait.' }, parts: [{ shot: 'write', hold: 0.7, enter: 'push' }, { seq: 'tracing', by: 'at', hold: 0.3 }, { shot: 'traced', hold: 1.0, tap: 0.6 }] },
      { say: { en: 'Then words that use it.', fr: 'Puis des mots qui l’emploient.' }, parts: [{ shot: 'use', hold: 2.4, enter: 'push' }] },
    ],
  },
  tour: {
    jp: '文法', line: 'grammar', name: { en: 'A new rule', fr: 'Une nouvelle règle' },
    title: { en: 'A new grammar rule, met on its tour', fr: 'Une nouvelle règle de grammaire, découverte en visite' },
    end: { en: 'Learn Japanese grammar on Tsuji.', fr: 'Apprends la grammaire japonaise sur Tsuji.' },
    steps: d => [
      { go: `/learn/grammar/${d.level}/${d.mode}`, ready: 'section.tour[data-stop="look"]' },
      { wait: 600 },
      { shot: 'look', focus: '.tour', tap: CONTINUE },
      { click: CONTINUE, ready: '.tour[data-stop="guess"]', settle: 700 },
      { shot: 'guess', focus: '.tour', tap: `.tour-guess[data-guess="${d.guess}"]` },
      { click: `.tour-guess[data-guess="${d.guess}"]`, settle: 400 },
      { shot: 'guessed', focus: '.tour', tap: CHECK },
      { click: CHECK, ready: '.tour[data-stop="found"]', settle: 800 },
      { shot: 'found', focus: '.tour' },
    ],
    beats: [
      { say: { en: 'A new rule opens on its tour.', fr: 'Une règle nouvelle s’ouvre sur sa visite.' }, parts: [{ shot: 'look', hold: 2.6, tap: 2.1 }] },
      { say: { en: 'Guess what it says.', fr: 'Devine ce qu’elle dit.' }, parts: [{ shot: 'guess', hold: 1.4, tap: 1.0, enter: 'push' }, { shot: 'guessed', hold: 0.8, tap: 0.5 }] },
      { say: { en: 'Then the rule, found.', fr: 'Puis la règle, trouvée.' }, parts: [{ shot: 'found', hold: 2.6, enter: 'push' }] },
    ],
  },
  video: {
    jp: '動画', line: 'kaiseki', name: { en: 'A YouTube video', fr: 'Une vidéo YouTube' },
    title: { en: 'A YouTube video, read line by line', fr: 'Une vidéo YouTube, lue ligne par ligne' },
    end: { en: 'Read the Japanese you watch on Tsuji.', fr: 'Lis le japonais que tu regardes sur Tsuji.' },
    steps: d => [
      { go: '/dictionary/analyzer?intake=video', ready: LINK_FIELD },
      { wait: 500 },
      { shot: 'link', focus: '#anl-panel-video', tap: LINK_FIELD },
      // Pasted: the whole link at once.
      { type: LINK_FIELD, text: d.link, chunk: 64, shot: 'pasted', focus: '#anl-panel-video' },
      { wait: 500 },
      { shot: 'pasted-go', focus: '#anl-panel-video', tap: LINK_GO },
      { click: LINK_GO, ready: RESULT, settle: 1800 },
      { shot: 'ready', focus: WATCHED, tap: PLAY },
      { play: PLAY, shot: 'playing', seconds: 7.5, fast: true, every: 0.2, focus: WATCHED },
    ],
    beats: [
      { say: { en: 'Paste a YouTube link.', fr: 'Colle un lien YouTube.' }, parts: [{ shot: 'link', hold: 0.9, tap: 0.5 }, { shot: 'pasted-go', hold: 1.1, tap: 0.7 }] },
      { say: { en: 'It plays, line by line, word by word.', fr: 'Elle défile, ligne par ligne, mot à mot.' }, parts: [{ shot: 'ready', hold: 1.0, tap: 0.6, enter: 'push' }, { seq: 'playing', by: 'at', hold: 0.3, cam: 'read' }] },
    ],
  },
  photo: {
    jp: '写真', line: 'kaiseki', name: { en: 'A photo', fr: 'Une photo' },
    title: { en: 'A photo of a page, read for you', fr: 'Une page prise en photo, lue pour toi' },
    end: { en: 'Read any page on Tsuji.', fr: 'Lis n’importe quelle page sur Tsuji.' },
    steps: d => [
      { go: '/dictionary/analyzer?intake=photo', ready: PHOTO_FILE },
      { wait: 500 },
      { shot: 'pick', focus: '#anl-panel-photo', tap: '#anl-panel-photo .intake-pair .intake-btn >> nth=-1' },
      { file: PHOTO_FILE, make: { kind: 'note', name: d.name, lines: d.lines }, ready: '.analysis-cropper', settle: 900 },
      { shot: 'crop', focus: '.analysis-cropper', tap: WHOLE },
      { click: WHOLE, ready: '#anl-panel-photo textarea.anl-slip__field', settle: 1200 },
      { shot: 'read', focus: '#anl-panel-photo .anl-slip', tap: SLIP_GO },
      { click: SLIP_GO, ready: RESULT, settle: 1500 },
      { shot: 'cut', focus: RESULT },
    ],
    beats: [
      { say: { en: 'Or take a photo of a page.', fr: 'Ou prends une page en photo.' }, parts: [{ shot: 'pick', hold: 0.9, tap: 0.5 }, { shot: 'crop', hold: 1.4, tap: 1.0, enter: 'push' }] },
      { say: { en: 'Its text is read for you.', fr: 'Son texte est lu pour toi.' }, parts: [{ shot: 'read', hold: 1.6, tap: 1.2, enter: 'sink' }] },
      { say: { en: 'Then cut word by word.', fr: 'Puis découpé mot à mot.' }, parts: [{ shot: 'cut', hold: 2.4, enter: 'push' }] },
    ],
  },
  song: {
    jp: '歌', line: 'kaiseki', name: { en: 'A song', fr: 'Une chanson' },
    title: { en: 'A song of yours, its lyrics heard and timed', fr: 'Une chanson à toi, ses paroles entendues et calées' },
    end: { en: 'Sing along in Japanese on Tsuji.', fr: 'Chante en japonais sur Tsuji.' },
    steps: d => [
      { go: '/dictionary/analyzer?intake=song', ready: '#anl-panel-song .anl-uta__pick' },
      { wait: 500 },
      { shot: 'pick', focus: '#anl-panel-song', tap: '#anl-panel-song .anl-uta__pick' },
      { file: SONG_FILE, make: { kind: 'wav', name: d.name, seconds: d.length }, ready: '#anl-panel-song .anl-uta__file', settle: 700 },
      { shot: 'picked', focus: '#anl-panel-song', tap: '#anl-panel-song .anl-uta__go' },
      { click: '#anl-panel-song .anl-uta__go', ready: RESULT, settle: 1800 },
      { shot: 'lyrics', focus: SUNG, tap: PLAY },
      { play: PLAY, shot: 'singing', seconds: 8, fast: true, every: 0.2, focus: SUNG },
    ],
    beats: [
      { say: { en: 'Or a song from your phone.', fr: 'Ou une chanson de ton téléphone.' }, parts: [{ shot: 'pick', hold: 0.9, tap: 0.5 }, { shot: 'picked', hold: 1.1, tap: 0.7 }] },
      { say: { en: 'Its lyrics, heard and timed.', fr: 'Ses paroles, entendues et calées.' }, parts: [{ shot: 'lyrics', hold: 1.0, tap: 0.6, enter: 'push' }, { seq: 'singing', by: 'at', hold: 0.3, cam: 'auto' }] },
    ],
  },
  transfer: {
    jp: '乗換', line: null, name: { en: 'Transfer', fr: 'Correspondance' },
    title: { en: 'Your Anki, WaniKani or Renshuu progress, brought across', fr: 'Ta progression Anki, WaniKani ou Renshuu, apportée' },
    end: { en: 'Bring your progress to Tsuji.', fr: 'Apporte ta progression sur Tsuji.' },
    steps: d => [
      { go: '/profile/settings/transfer', ready: '.tr-ticket[data-phase="choose"]' },
      { wait: 500 },
      { shot: 'choose', focus: '.tr-ticket', tap: '[data-action="transfer-choose"]' },
      { file: 'input.tr-file', make: { kind: 'apkg', ...d.anki }, ready: '[data-figure="cards"]', settle: 1000 },
      { shot: 'printed', focus: '.tr-ticket', tap: '[data-action="transfer-punch"]' },
      { click: '[data-action="transfer-punch"]', ready: '[data-figure="written"]', settle: 1000 },
      { shot: 'punched', focus: '.tr-ticket' },
    ],
    beats: [
      { say: { en: 'Studied somewhere else?', fr: 'Tu as appris ailleurs ?' }, parts: [{ shot: 'choose', hold: 1.5, tap: 1.1 }] },
      { say: { en: 'Your Anki file, read on your device.', fr: 'Ton fichier Anki, lu sur ton appareil.' }, parts: [{ shot: 'printed', hold: 2.6, tap: 2.1, cam: 'read', enter: 'push' }] },
      { say: { en: 'Your words keep their rhythm.', fr: 'Tes mots gardent leur rythme.' }, parts: [{ shot: 'punched', hold: 2.2 }] },
    ],
  },
  account: {
    jp: '設定', line: null, name: { en: 'Your data', fr: 'Tes données' },
    title: { en: 'Your data: export it, or delete it, at any time', fr: 'Tes données : exporte-les ou supprime-les, à tout moment' },
    end: { en: 'Start free on Tsuji.', fr: 'Commence gratuitement sur Tsuji.' },
    // The video stops at the deletion's question and never answers it.
    steps: d => [
      { go: '/profile/settings/account', ready: DELETE },
      { scroll: exportSlip(d.lang), block: 'center' },
      { wait: 400 },
      { shot: 'export', focus: exportSlip(d.lang), tap: `${exportSlip(d.lang)} .slip__act` },
      { click: `${exportSlip(d.lang)} .slip__act`, settle: 1000 },
      { scroll: DELETE, block: 'center' },
      { wait: 400 },
      { shot: 'delete', focus: `.slip:has(${DELETE})`, tap: DELETE },
      { click: DELETE, ready: '[data-action="delete-account-confirm"]', settle: 600 },
      // The question opens under the button: brought up into view, as a thumb would.
      { scroll: '[data-action="delete-account-confirm"]', block: 'center' },
      { wait: 400 },
      { shot: 'confirm', focus: '.slip:has([data-action="delete-account-confirm"])' },
    ],
    beats: [
      { say: { en: 'Your progress, in one CSV file.', fr: 'Ta progression, en un fichier CSV.' }, parts: [{ shot: 'export', hold: 1.8, tap: 1.3 }] },
      { say: { en: 'Or delete it all, whenever you like.', fr: 'Ou supprime tout, quand tu veux.' }, parts: [{ shot: 'delete', hold: 1.0, tap: 0.6 }, { shot: 'confirm', hold: 2.2 }] },
    ],
  },
}
