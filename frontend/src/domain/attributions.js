// ── The credits ───────────────────────────────────────────
// What the app is built on, and under which terms. The list the
// settings' Credits page prints (plan 085's third look); the long form
// with the required citation wording is THIRD_PARTY_NOTICES.md at the
// repo root — keep the two in step. `what` is a key into the locale's
// `creditsWhat`, because the role is the interface's word; the name,
// the author and a licence's own name are proper nouns and stay as they
// are. A source under terms of its own, which have no name, is
// `{ terms: <whose> }`, said in the interface's words (licenseLabel).
export const ATTRIBUTIONS = [
  { id: 'jmdict',   name: 'JMdict / JMnedict',       by: 'EDRDG',            what: 'dictionary', license: 'CC BY-SA 4.0', url: 'https://www.edrdg.org/' },
  { id: 'kanjidic', name: 'KANJIDIC2 / RADKFILE',    by: 'EDRDG',            what: 'kanji',      license: 'CC BY-SA 4.0', url: 'https://www.edrdg.org/' },
  { id: 'kanjivg',  name: 'KanjiVG',                 by: 'Ulrich Apel',      what: 'strokes',    license: 'CC BY-SA 3.0', url: 'https://kanjivg.tagaini.net/' },
  { id: 'tatoeba',  name: 'Tatoeba',                 by: null,               what: 'sentences',  license: 'CC BY 2.0 FR', url: 'https://tatoeba.org/' },
  { id: 'voicevox', name: 'VOICEVOX · 春日部つむぎ', by: null,               what: 'voice',      license: { terms: 'VOICEVOX' }, url: 'https://voicevox.hiroshiba.jp/' },
  // Every other synthesized voice the app plays -- listening, dictation,
  // card readings (plan 121). The credit is the licence's one condition,
  // so its wording is the licence's: "VOICEVOX Nemo".
  { id: 'voicevox-nemo', name: 'VOICEVOX Nemo',      by: null,               what: 'speech',     license: { terms: 'VOICEVOX Nemo' }, url: 'https://voicevox.hiroshiba.jp/nemo/' },
  // The kana deck's syllables, cut from his 強連続音 UTAU bank (plan 121c,
  // ADR 0020). His terms ask for no credit: this one is provenance, and
  // backend/tests/test_kana_audio.py holds every voice kanas/sources.json
  // names to a row here.
  { id: 'namine-ritsu', name: '波音リツ',            by: 'カノン',           what: 'kana',       license: { terms: '波音リツ' }, url: 'https://www.canon-voice.com/' },
  { id: 'noto',     name: 'Noto Sans JP · Noto Serif JP', by: 'Google',      what: 'type',       license: 'SIL OFL 1.1', url: 'https://fonts.google.com/noto' },
  { id: 'grotesk',  name: 'Space Grotesk',           by: 'Florian Karsten',  what: 'type',       license: 'SIL OFL 1.1', url: 'https://github.com/floriankarsten/space-grotesk' },
]

/** A source's licence as the Credits page prints it: a named licence as
 *  it is ("CC BY-SA 4.0"), terms of its own in the learner's language
 *  ("conditions de VOICEVOX"). */
export function licenseLabel(attribution, t) {
  const { license } = attribution
  return typeof license === 'string' ? license : t.creditsTerms(license.terms)
}
