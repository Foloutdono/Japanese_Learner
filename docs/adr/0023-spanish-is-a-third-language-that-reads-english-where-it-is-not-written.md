# 0023 — Spanish is a third language, and reads English where it is not written yet

- **Status**: accepted (plan 291). Extends the French end to end of plan 215;
  [0016](0016-grammar-is-taught-not-glossed.md) still stands.
- **Date**: 2026-10-30

## Context

The app spoke two languages. French was the owner's and English the default,
and the code said so in pairs everywhere: `lang === 'fr' ? 'fr-FR' : 'en-US'`
at every Intl call, `UI_LANGS = ("fr", "en")`, `get_meaning(entry, lang,
fr_map)` taking the French map alone, the catalogue's texts as `{en, fr}`.
A language outside the pair fell to English on some paths and to French on
others (the basics station and the station samples read anything but `en` as
French).

The owner asked to start translating the app and its primary study resources
into Spanish. What is taught is large: 7,980 deck words, 2,383 kanji, 545
grammar points whose lessons and drills hold some 30,000 texts, and the
reading, dictation, comprehension and conversation banks beside them. It
cannot all be written at once, and a half-written language must never show
a learner a blank.

## Decision

**Spanish (`es`) is a third interface and content language, and every text
not yet written in Spanish reads English**, never French and never blank.

- **The interface is whole.** `frontend/src/locales/es` carries every key of
  the English table, held to it by `locales.test.js` as French is: a new
  screen string is written in all three.
- **The decks and the grammar points' glosses are whole.** Each deck card has
  its own line in `datas/vocab/vocab_es.json`, keyed `"{kanji}::{kana}"` (no
  bare-form lines: those gave homographs one French gloss, plan 107). Each
  deck kanji has a Spanish meaning: KANJIDIC2's for 2,312, the app's own for
  71 (`datas/kanji/kanji_meanings_es.json`, folded into `kanji.sqlite3` by
  `build_kanji_db --spanish-only`). Each grammar point has `meaning.es` and
  `structure_es`, held to the French line's rule (the English line's
  Japanese, in order, no English left). `tests/test_spanish.py` holds all
  three whole: a card, a kanji or a point the course gains is written in
  Spanish in the same change.
- **The grammar lessons are whole** (the second wave): every step, every
  neighbour's `compare` line and every example's translation carries its
  `es`, held by `grammar_check` to the English and French texts' rules
  (caps, bullets, no Japanese in a translation) and by `test_spanish.py` to
  completeness. A reader takes a text's languages with
  `grammar_points_data.texts()`, never a hand-built `{en, fr}` pair, which
  would drop the Spanish.
- **The tours and Choisir's own questions are whole** (the third wave):
  every twist, scene and quiz text and every `choose` question's
  translation and why. A question's translation still rules out every
  wrong filling; a set of readings keeps its right one first and tells by
  its length no more than the English does (the right reading is the
  longest in 1,074 of 2,601 sets in Spanish, 1,338 in English); the learner
  has no gender; staff and strangers say usted, friends and the app tú.
- **The reading bank and the comprehension seeds are whole** (the fourth
  wave): every reading sentence's translation, required by `row_problems`
  as English and French are, and every string of the 180 seeds (each
  sentence's translation, note and word glosses, every question and its
  four options), so `comprehension_seed.LANGS` holds Spanish and the pool
  serves a Spanish learner the seeds before any model call.
- **Everything else is written a wave at a time** and reads English until
  then: the dictation and conversation banks, the deck's example
  sentences, the JMdict pool's words, the breakdown's
  particle and ending glosses, the duels' choices. `python -m
  scripts.spanish_coverage` counts what is written and what is left, per
  part. A Spanish text is optional where it is added (`grammar_check` holds
  one that is there, and accepts its absence); `tests/test_spanish.py`
  holds a part whole once its wave is done.
- **One reader per kind, not a ternary per screen.** A deck gloss is
  `get_meaning(entry, lang, VOCAB_GLOSSES | KANJI_GLOSSES)`, the course's maps
  by language (`translations/course.py`); a catalogue text is
  `localise(pair, lang)`; a number or a date is `intlLocale(lang)`
  (`lib/locale.js`). Each already falls back to English.
- **Neutral Spanish, tú.** No vosotros, no voseo; where Spain and Latin
  America name an everyday thing differently, a gloss gives both («zumo,
  jugo»). Quotes are «…» tight, as the RAE writes them.

## Consequences

- A Spanish learner sees English wherever a wave has not reached. That is
  the honest fallback: the English is the course's source, and the French
  would be a language the learner did not choose.
- Model-backed features (the deep breakdown, comprehension, conversation,
  the tutor) already answered in any language `reading.known_lang` names,
  Spanish among them; a Spanish learner now reaches them with `lang=es` and
  their daily ceilings as they are.
- The breakdown's stored output gained `structure_es` and a deck word's
  `meaning_es`, so `LOCAL_REV` moved (31 → 32).
- Dictionary search still matches English and French glosses only: the pool
  predicate's ASCII gate and the lexicon need their own change.
- The catalogue is held in memory. Loaded, its five files held 19.7 MB
  before Spanish, 20.9 MB with the glosses and the lessons, and 24.6 MB
  with the tours and Choisir questions too (measured with tracemalloc,
  plan 291): 4.9 MB for the whole catalogue in a third language, which
  the 512 MB budget takes without an overlay read on demand.
- Every new learner-facing text now carries three languages in the UI table
  and two, plus Spanish where its area is whole, in content.
