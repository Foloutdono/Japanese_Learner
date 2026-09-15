# 0016 — Grammar is taught, not glossed

- **Status**: accepted
- **Date**: 2026-09-15

## Context

The 文法 line was the weakest section of the app, and the code showed why.
The catalogue held seventy-one points at every level by rule, not by the
language: N5 was padded with conjugations filed as points (〜かったです,
〜でした) while N2 and N1 missed over half of what is examined. A point was a
gloss, not a lesson: `{pattern, structure, meaning}` plus two English
sentences, and nothing anywhere said when to use a pattern, why, or why not
its neighbour. Grammar was English-only while vocab and kanji had a French
map. And there was no lesson surface: `/learn/grammar` went level → mode →
flashcards.

The runtime LLM is free-tier and the project had already ruled that grammar
examples are authored, not generated. So the fix is content written into the
repo and held to gates in code, plus the surfaces to show it.

## Decision

### The catalogue grows with the level

`content/grammar/N5.json … N1.json`, one list per level, replace the single
JSON. `MIN_PER_LEVEL` is a floor per level that rises with the level, and the
test also holds N5 ≤ N4 ≤ N3 ≤ N2 ≤ N1. A point stays unless it is a bare
conjugation of a listed point, a spelling-variant duplicate, or filed at the
wrong level on the modern five-level syllabus; what two or more modern
inventories examine at a level is added. This wave lands 91 / 108 / 110 /
115 / 117.

### The lesson is data beside the id, in both languages

An entry carries `meaning {en, fr}`, an optional `register`, `steps`
(`rule` → `use` → `careful`, each `{en, fr}`), `compare` rows naming the
neighbour a learner would confuse it with, and `examples` with `en`, `fr`,
a register and an optional `contrast` mark. Every text field exists in both
languages at every level; at the levels in `RICH_LEVELS` the French may not
be a copy of the English, a `rule` step, a rival and three or more examples
are required. `study/grammar_check.py` enforces all of it, together with the
existing sentence gate (8–60 characters, kanji within the level, the pattern
visibly present), and `scripts/check_grammar.py` runs it from a shell. Rich
levels arrive by wave: N5 and N4 now, then N3, N2, N1 on the same pipeline.

### Card ids stay stable; moves are explicit

A grammar card id is `grammar_{level}_{pattern}`, so the pattern text and the
level are the learner's progress. A point that survives keeps its `pattern`
verbatim. One that is renamed, merged or moved to another level goes into
`content/grammar/renames.py` (`MOVES` old → new, or `RETIRED`), and
`scripts/migrate_grammar_ids.py` renames the learner's rows once after
deploy, merging on collision and never guessing at an id it does not know.
`tests/test_grammar_points.py` holds every id the catalogue ever served
(`tests/fixtures/grammar_ids_before_087.json`) to one of the three fates, so
no id can vanish silently.

### Contrast is a mode whose choices are the exercise

`grammar.contrast` shows one of the point's `contrast` sentences with the
pattern blanked and offers the rivals as the choices. A `contrast` sentence
may not contain a rival the matcher can detect (the `study/placement.py`
rule: otherwise the drill has two right answers), so a pair whose stems
overlap by substring (ようにする／ようになる, そうです／そうにない) is
compared through a third neighbour and explained in the `careful` step.
The mode lives in `study/modes.py` and `domain/studyModes.js` like any
other; the pool filter is `card_index.contrast_ok`, so a level with no
contrast content simply has no contrast platform.

### The lesson has three surfaces, one component

`components/study/GrammarLesson.jsx` renders the same lesson body as the
level's index (a points door on the station), the gate before a new card in
a run (with a ghost lesson door on every card), and the dictionary's grammar
plate. A language switch is a fresh session key, since the payload is
localised server-side.

## Consequences

- `content/grammar_data.py` (the jlptsensei scrape) stays only as the
  negative corpus of the provenance test: no sentence or gloss in the
  catalogue may appear in it verbatim.
- Points below a rich level degrade gracefully: gloss, two examples, no
  contrast platform. The report (`check_grammar --report`) prints
  `fr_pending`, `with_steps` and `contrast_ok` per level so the debt is
  visible.
- `get_deck_modes` may advertise contrast on a personal deck that has no
  contrast content, exactly as it already did for fill-in; accepted.
- Deploy order matters once: code first, then
  `python -m scripts.migrate_grammar_ids --yes`. In the gap a moved point
  reads "new"; nothing is lost.
