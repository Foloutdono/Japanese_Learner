// ── 番線 — every feature the reel can play (plan 210) ──────────────────
// One module per feature of the app. Each says where in the app it
// stands (route), what must be drawn before it may be filmed (ready),
// what it sets up out of sight before the phone comes up (before), and
// how a learner uses it (play). script.mjs's APPS lists the same names.

import { analyzer } from './analyzer'
import { reading } from './reading'
import { cards } from './cards'
import { grammar } from './grammar'
import { translation, composition, dictation, comprehension } from './practice'
import { exam, dictionary, decks, pass, learn } from './more'

export const APPS = {
  analyzer,
  reading,
  today: cards,
  review: cards,
  kana: cards,
  vocab: cards,
  kanji: cards,
  grammar,
  translation,
  composition,
  dictation,
  comprehension,
  exam,
  dictionary,
  decks,
  pass,
  learn,
}
