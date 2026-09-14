// ── The credits ───────────────────────────────────────────
// What the app is built on, and under which terms. The list the
// settings' Credits page prints (plan 085's third look); the long form
// with the required citation wording is THIRD_PARTY_NOTICES.md at the
// repo root — keep the two in step. `what` is a key into the locale's
// `creditsWhat`, because the role is the interface's word; the name,
// the author and the licence are proper nouns and stay as they are.
export const ATTRIBUTIONS = [
  { id: 'jmdict',   name: 'JMdict / JMnedict',       by: 'EDRDG',            what: 'dictionary', license: 'CC BY-SA 4.0', url: 'https://www.edrdg.org/' },
  { id: 'kanjidic', name: 'KANJIDIC2 / RADKFILE',    by: 'EDRDG',            what: 'kanji',      license: 'CC BY-SA 4.0', url: 'https://www.edrdg.org/' },
  { id: 'kanjivg',  name: 'KanjiVG',                 by: 'Ulrich Apel',      what: 'strokes',    license: 'CC BY-SA 3.0', url: 'https://kanjivg.tagaini.net/' },
  { id: 'tatoeba',  name: 'Tatoeba',                 by: null,               what: 'sentences',  license: 'CC BY 2.0 FR', url: 'https://tatoeba.org/' },
  { id: 'voicevox', name: 'VOICEVOX · 春日部つむぎ', by: null,               what: 'voice',      license: 'VOICEVOX terms', url: 'https://voicevox.hiroshiba.jp/' },
  { id: 'noto',     name: 'Noto Sans JP · Noto Serif JP', by: 'Google',      what: 'type',       license: 'SIL OFL 1.1', url: 'https://fonts.google.com/noto' },
  { id: 'grotesk',  name: 'Space Grotesk',           by: 'Florian Karsten',  what: 'type',       license: 'SIL OFL 1.1', url: 'https://github.com/floriankarsten/space-grotesk' },
]
