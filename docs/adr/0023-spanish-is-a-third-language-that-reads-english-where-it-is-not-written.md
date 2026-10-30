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
  serves a Spanish learner the seeds before any model call. The options'
  length tells no more in Spanish than in English: picking the longest
  wins 23-24% per level, as a blind pick of four would
  (`comprehension_seed_report`).
- **The dictation and conversation banks are whole** (the fifth wave):
  every dictation line's translation (`listening_clips.problems` requires
  it) and every text of the 111 scenarios -- titles, situations, goals and
  mission steps (44 characters at most), roles, every line's translation,
  every note and why -- held by `conversation.LANGS`, so
  `check_conversation` holds the Spanish to every rule it holds the English
  and French to. A `me` line's Spanish is what Translate asks the learner
  to say, so it carries all its Japanese says; the learner has no gender,
  and a role fixes none where Spanish allows.
- **The sentences a deck card shows are whole** (the sixth wave): all
  10,300, wherever they come from. A correction (`example_fixes.json`)
  and a sentence written for a word Tatoeba lacked (`example_added.json`)
  carry their `es` beside `fr`, required by `vocab_examples check` and
  `check-added`; a Tatoeba sentence the course left as it was has its
  line in a Spanish layer over JMdict, `datas/vocab/jmdict_es.sqlite3`,
  the French layer's twin (plan 215: the same tables with `es` for `fr`,
  built by `build_jmdict_fr --lang es`). Each was translated from the
  Japanese with the English and the French beside it, register by the
  scene (usted to a stranger, tú to a friend), and the card's word in the
  sense its gloss gives. The readers take the language
  (`jmdict_fr.examples(jps, lang)`, `example_fixes.translated`), so the
  card, the dictionary and reading practice serve it as they serve the
  French.
- **The basics course is whole** (the seventh wave): its fourteen unit
  titles carry their `es`, required by `test_basics` as the English and
  French are. The rest of the course was already Spanish: its cards'
  glosses are the decks', its sentences the reading bank's.
- **The breakdown's own glosses are whole** (the eighth wave): every line
  the local tier writes for a part no card or point explains -- the 197
  words of speech of `particle_glosses` (ぞ, かしら, the negative ぬ, the
  Kansai へん), the adverbs made with に, the prefixes, suffixes and
  counters, a name's kind, the units, sizes and Latin words -- carries its
  `es`, a tuple table's row its Spanish last; and every gloss it makes on
  the spot (a figure, a time, a score, a fraction, an age, a date, an
  ordinal, a JLPT level) is made in Spanish too. A figure is the RAE's
  (2000, 10 000, 3.5), an ordinal «n.º 3», since 3.º and 3.ª would give
  the counted noun a gender. `test_breakdown_invariants` holds every
  table and every gloss a breakdown prints; `LOCAL_REV` moved (32 → 33).
- **The rest of what the screens print is wired** (the ninth wave, an
  audit of every path that branched on French): dictionary search matches
  the Spanish gloss of a word, a kanji and a point (in any session, as it
  matches French), a dictionary chip has its Spanish label and tooltip,
  each of the 214 radicals its meaning (`RADICAL_ES`), each of the 684
  theme words the deck has no card for its Spanish (a fourth column in
  `content/theme_lists.py`, which the build requires), a duel's word item
  its choices in Spanish, held to the same guards of meaning and length
  (`sprint-6`), and the deck import's sample and headers read Spanish.
  Every route that takes a language answers `lang=es` with no French in
  what it serves.
- **The pages outside the app are whole** (the tenth wave): the privacy
  policy and the account-deletion page have a Spanish section beside the
  French and the English, chosen by the switch or a Spanish browser, and
  the landing page is at `/es` (`frontend/landing/`, its title and
  description in `docs/seo/keywords.md`), each language linking the
  others, its share card `og-es.png`. A Spanish label may not be the one
  that breaks the phone's width: the page is measured at 320 and 360 px
  beside the French.
- **The dictionary is whole** (the eleventh wave): every sense a deck
  word's entry lists (15,091 glossaries) and the one-line gloss of every
  pool word the French layer has (40,141: the commonest ~20k and every
  compound of the deck's nouns), translated from the Japanese with the
  English and the French beside it. The Spanish layer is the French
  one's twin, line for line (`tests/test_spanish.py`); a pool word reads
  its Spanish in the dictionary, a kanji's word list, a deck and the
  breakdown (`meaning_es`, `LOCAL_REV` 33 → 34), and search finds it by
  its Spanish (`vocab_jmdict_data` attaches every layer). What plan 280
  folds is still decided by the French layer, so a compound reads the
  same in every language.
- **Everything else is written a wave at a time** and reads English until
  then: the 21,800 Tatoeba sentences only the pool shows. `python -m
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
  `meaning_es`, so `LOCAL_REV` moved (31 → 32), its own glosses' `es`
  (32 → 33), and a pool word's, a chosen sense's and an idiom's
  `meaning_es` (33 → 34).
- Dictionary search matches the course's Spanish glosses (words, kanji,
  points) and, since the eleventh wave, a pool word's Spanish line.
- The Spanish layer over JMdict is a second small SQLite file beside the
  French one rather than columns inside it, so each language is built,
  exported and corrected on its own; its tables hold what the French
  one's do, and a sense neither has says it is English
  (`glossary_lang`), as it always has.
- The catalogue is held in memory. Loaded, its five files held 19.7 MB
  before Spanish, 20.9 MB with the glosses and the lessons, and 24.6 MB
  with the tours and Choisir questions too (measured with tracemalloc,
  plan 291): 4.9 MB for the whole catalogue in a third language, which
  the 512 MB budget takes without an overlay read on demand.
- Every new learner-facing text now carries three languages in the UI table
  and two, plus Spanish where its area is whole, in content.
