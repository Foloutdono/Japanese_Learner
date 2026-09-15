# The grammar catalogue

One JSON file per JLPT level, `N5.json` … `N1.json`, each a list of grammar
points in the order the level teaches them. This is the whole of what the
文法 line, the dictionary's grammar collection, the exam generators and the
reading gate know about grammar (plan 087). Nothing here is generated: every
line is written by hand, in both of the app's languages, and checked in code
before it can ship.

```
cd backend
python -m scripts.check_grammar --level N5 --report   # while writing
python -m pytest tests/test_grammar_points.py tests/test_grammar_sentences.py
```

## An entry

```jsonc
{
  "pattern":   "〜てください",                 // the point's name. It IS the card id: never edit it casually (see "Ids")
  "structure": "verb て-form + ください",     // what it attaches to, one line
  "meaning":   {"en": "please do", "fr": "faites…, s'il vous plaît"},
  "register":  "polite",                       // optional: neutral | casual | polite | formal | written
  "steps": [                                   // the lesson, read top to bottom
    {"kind": "rule",    "en": "…", "fr": "…"}, // what it does. Two short sentences at most.
    {"kind": "use",     "en": "…", "fr": "…"}, // when and why you reach for it. Up to three "- " bullets.
    {"kind": "careful", "en": "…", "fr": "…"}  // optional: the trap, the register, what it does NOT mean
  ],
  "compare": [                                 // the neighbours it is confused with
    {"pattern": "〜ないでください", "en": "…", "fr": "…"}   // one line: use this one when…, the other when…
  ],
  "examples": [
    {"jp": "ここに名前を書いてください。", "en": "…", "fr": "…", "register": "polite", "contrast": true}
  ]
}
```

| field | rule |
|---|---|
| `pattern` | unique across all five levels; no `:`. The structure names it (`tests/test_grammar_points.py`). |
| `meaning` | one line, both languages, no Japanese in it. |
| `steps` | kinds `rule`, `use`, `careful`, each at most once, `rule` first. `**bold**` allowed; a bullet is a line starting `- `. |
| `compare` | every `pattern` is a real point (any level), never the entry itself. |
| `examples` | each passes `study/grammar_sentence_gen.check_sentence`: 8–60 characters, ends in 。！？, kanji within the level (the pattern's own kanji excepted), and visibly contains the pattern. Distinct sentences. |
| `contrast` | marks a sentence in which the rivals in `compare` are **wrong**; the contrast drill blanks the pattern in it and offers the rivals as choices. So the sentence must not also contain a rival, and the point must compare something. |

## Rich levels

`RICH_LEVELS` in `content/grammar_points_data.py` names the levels whose
points carry the full lesson. There the gate requires: a `rule` step, at
least one `compare` rival, at least one `contrast` example (when the pattern
can be blanked at all: a bare particle is exempt), three or more
examples (write four or five), and French that is not a copy of the English.
The other levels are held to today's bar — a bilingual gloss and two
examples — until their own content wave; `check_grammar --report` prints
`fr_pending` so the debt is visible. Adding a level to `RICH_LEVELS` and
writing its lessons is one commit.

## Counts

`MIN_PER_LEVEL` is a floor per level, rising with the level (a level with
more to know lists more), and the test also holds N5 ≤ N4 ≤ N3 ≤ N2 ≤ N1.
Raise a floor in the same commit as the points that meet it.

## Ids

A grammar card id is `grammar_{level}_{pattern}`, so the pattern text and the
level are the learner's progress. A point that stays keeps its `pattern`
verbatim. A point that is renamed, merged or moved to another level gets an
entry in `renames.py` (`MOVES` old → new, or `RETIRED`), and
`scripts/migrate_grammar_ids.py` renames the rows once after deploy.
`tests/test_grammar_points.py` holds every id the catalogue ever served to one
of the three fates.

## Writing a lesson

The reader is someone who has just met the pattern. They should leave knowing
three things: what it does, when they would reach for it, and which neighbour
they would have confused it with. That is the order of the steps and the
reason `compare` exists.

- One idea per sentence. Plain words. Name the situation before the rule.
- `rule` says what the pattern does and what it attaches to. No exceptions
  yet — those are `careful`.
- `use` is the *when* and the *why*: two or three situations a learner will
  actually be in. Bullets are fine.
- `careful` is only for a real trap: a register it cannot take, a meaning it
  does not have, a form it is often confused with. Skip it when there is none.
- `compare` is one line per neighbour and says which one to use when. Write
  both sides of a pair in the same batch so they agree.
- French is written in French, not translated word for word: *on* where the
  English says *you*, the app's own grammatical terms (forme en て, adjectif
  en い), French punctuation spacing left to the app (`locales/frenchSpacing.js`).
- Examples are everyday sentences, spread across registers (a casual one, a
  polite one, a written one), each demonstrating the pattern doing its job.
  Never a sentence from a published list; never a sentence a learner of the
  level could not read.

Keep it short. A basic rule stays basic; the depth is in the later steps and
in the neighbours, never in a longer first step.

## What the matcher can and cannot see

`study/grammar_match.stems` reduces a pattern to the substrings a sentence
must contain (〜てください → てください, でください, てくださ, …), and the
contrast rule reads those stems. Two consequences while writing `compare`:

- A rival whose stem is inside the point itself can never be a `compare`
  rival of a point that marks contrast examples: ようにする is inside
  ようになる (via ように), ことにする inside ことになる (via ことに), そうです
  inside そうにない, 〜てください inside 〜させてください. Compare such a pair
  through a third neighbour and explain the pair in the `careful` step.
- A `contrast` sentence must carry the pattern literally, in the spelling the
  stems expect: a godan volitional (帰ろう) does not match 〜ようと思う, a
  short form (食べちゃった) does not match 〜てしまう, 見えません after 字がよく
  does not match 〜が見える. The gate names the sentence; reword it.

A pattern the matcher cannot check at all (a bare particle, a class label
such as い形容詞／な形容詞) is exempt from the contrast requirement: its lesson
names the neighbours, and the drill never draws it.
