# The grammar catalogue

One JSON file per JLPT level, `N5.json` … `N1.json`, each a list of grammar
points in the order the level teaches them. This is the whole of what the
文法 line, the dictionary's grammar collection, the exam generators and the
reading gate know about grammar (plan 087). Nothing here is generated at
request time: every line was drafted with an AI model, in both of the app's
languages, is checked in code before it can ship, and is audited since by AI
agents looking for its errors (`docs/content-audit/PLAYBOOK.md`).

```
cd backend
python -m scripts.check_grammar --level N5 --report   # while writing
python -m pytest tests/test_grammar_points.py tests/test_grammar_sentences.py
```

## An entry

```jsonc
{
  "pattern":   "〜てください",                 // the point's name. It IS the card id: never edit it casually (see "Ids")
  // "reading": "〜のなかで",                  // only where the pattern has a kanji (this is 〜の中で's; 〜てください has none)
  "structure": "verb て-form + ください",     // what it attaches to, one line
  // "structure_reading": "group + のなかで",  // only where the structure has a kanji (〜の中で's "group + の中で")
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
| `reading` | on every pattern with a kanji and on no other: the pattern spelled with each kanji run in kana, everything else (〜, kana, brackets, spaces) exactly as written — 〜が（逆接） is 〜が（ぎゃくせつ）. It is the furigana every card, lesson and dictionary plate prints over the pattern (`study/grammar_examples.pattern_furigana`), so it is the reading the lesson teaches: 〜気味 is 〜ぎみ, 〜方 is 〜かた, 〜得る is 〜うる. Two readings of one kanji are joined by ・ (〜中 is 〜ちゅう・じゅう). Written by hand, never taken from the tokenizer, which guesses on a fragment. |
| `structure_reading` | the same rule for the formation line: on every `structure` with a kanji and on no other, spelled exactly as the structure is (its English too) with each kanji run in kana — "group + の中で" is "group + のなかで". The card, the lesson and the dictionary print it over the formation. |
| `meaning` | one line, both languages, no Japanese in it. |
| `steps` | kinds `rule`, `use`, `careful`, each at most once, `rule` first. `**bold**` allowed; a bullet is a line starting `- `. |
| `compare` | every `pattern` is a real point (any level), never the entry itself. |
| `examples` | each passes `study/grammar_sentence_gen.check_sentence`: 8–60 characters, ends in 。！？, kanji within the level (the pattern's own kanji excepted), and visibly contains the pattern. Distinct sentences. |
| `contrast` | marks a sentence in which the rivals in `compare` are **wrong**; the contrast drill blanks the pattern in it and offers the rivals as choices. So the sentence must not also contain a rival, and the point must compare something. A bare particle may mark one too (plan 190): see "What the matcher can and cannot see". |
| `choose` | optional, at least three questions: a point's own Choisir questions, for a point the contrast drill cannot be drawn on (plan 200). See "Choisir's own questions". |

## The tour block (plan 187)

A point a learner has never met is toured before it is drilled
(`study/grammar_tour.py`): its examples, a guess at what it does, the
rule. That much is derived from the entry above. The rest is written
by hand, in an optional `tour` key, and where it is written all three
parts are -- a twist per notion the point has beyond the meaning the guess
asks (plan 189), the scene, and the closing quiz (plan 196):

```jsonc
"tour": {
  "twists": [{                                // 1–6, one per notion, in teaching order
    "notion": {"en": "Or, between nouns", "fr": "Ou, entre deux noms"},  // the stop's name, ≤ 40 chars
    "jp": "おちゃかコーヒーを飲みますか。",
    "tr": {"en": "…", "fr": "…"},            // the sentence translated, shown once the question is answered (plan 196)
    "ask": {"en": "…", "fr": "…"},            // the question over it
    "choices": [{"en": "…", "fr": "…"}, …],   // three readings of it, the RIGHT ONE FIRST, then the confusion
                                              // the stop asks against: only the first two are shown (plan 194)
    "why": {"en": "…", "fr": "…"},            // one line said once it is answered
    "pair": ["すってください", "すわないでください"],  // optional: two forms drawn side by side
    "kind": "usage"                           // "usage": another use of the point; "trap": a rival set against it
  }, …],
  "scene": {                                  // the point at work, at a station
    "place": "売店",                          // one of grammar_tour.SCENE_PLACES
    "them": {"en": "Vendor", "fr": "Vendeur"}, // who the learner talks to
    "lines": [{"who": "them" | "me", "jp": "…", "en": "…", "fr": "…"}, …],  // two to five
    "note": {"en": "…", "fr": "…"},           // the point against its rivals, in this scene
    "ask": {
      "cue": {"who": "them", "jp": "…", "en": "…", "fr": "…"},  // what the learner answers
      "task": {"en": "…", "fr": "…"},         // what to say, in the learner's language
      "choices": ["…", "…", "…"],             // three Japanese lines, the RIGHT ONE FIRST
      "why": {"en": "…", "fr": "…"}
    }
  },
  "quiz": [                                   // 4–6 questions (plan 196), each of one kind, none the tour has asked
    {"kind": "meaning",                       // read a sentence the tour has not shown
     "ask": {"en": "…", "fr": "…"},           // the question over it
     "jp": "…。",                             // shown with NO translation
     "tr": {"en": "…", "fr": "…"},            // its translation, shown once the question is answered
     "choices": [{"en": "…", "fr": "…"}, …],  // three readings, the RIGHT ONE FIRST
     "why": {"en": "…", "fr": "…"}},
    {"kind": "form",                          // build the form
     "ask": {"en": "…", "fr": "…"},           // what is asked: "Which form completes it?", or more exactly
     "jp": "きのうは学校に＿＿＿。",             // ONE blank, ＿＿＿ (study/grammar_examples.BLANK), over the form
     "tr": {"en": "…", "fr": "…"},            // what the whole sentence says: it is what is to be said, so it is shown
     "choices": ["行かなかった", "行かない", "行きなかった"],  // three fillings, the RIGHT ONE FIRST
     "why": {"en": "…", "fr": "…"}},
    {"kind": "use",                           // say the right thing in a situation
     "ask": {"en": "…", "fr": "…"},           // the situation, in the learner's language
     "choices": ["…。", "…。", "…。"],         // three Japanese lines, the RIGHT ONE FIRST
     "why": {"en": "…", "fr": "…"}}
  ]
}
```

`study/grammar_check.py` holds it: every Japanese line a whole sentence
(ending in 。！？, at most 60 characters) in the level's kanji (the
pattern's own exempt), every translation in both languages with no
Japanese in it, and the scene ABOUT its point -- the point written in one
of its lines or the cue, in the right answer, and in no wrong answer
(read by the detector where `grammar_detect.can_find` trusts it, else by
the stems). A point that names its own alternatives (`〜つ／〜人／〜枚`,
`〜があります／います`) may be answered wrong with another of them.

### The quiz (plan 196)

The quiz is the first time the learner is asked for the point without
being told what it is. The first one, built from sentences the app already
taught (plans 194, 195), asked "which of these uses it?" up to eight times:
a question the eye answers by finding the point's own characters, and the
twists printed the translation of the sentence over the question "what
does it say?". Neither tests anything, and a learner said so. So:

- **A question is one only someone who has understood the point can
  answer.** Never "find the sentence that contains it". A `use` is held to
  that in code: where the detector reads the point, a wrong line writes it
  too (the same verb in the wrong tense, the wrong register, beside the
  rival that carries it), so finding the point answers nothing.
- **Never a translation shown over the question it answers.** A twist's and
  a meaning's `tr` is held back until the question is answered. A form
  shows its `tr` because it is what is to be said, and its three fillings
  are forms, not translations of it.
- **Every sentence is new, and no question is asked twice.** No sentence of
  the quiz is one of the point's examples (the fourth of them too), a twist's, a line or answer of the
  scene, or another question's; no question is worded twice across the
  twists and the quiz (`study/grammar_check._repeat_problems`, which also
  fails a sentence standing twice among the examples, twists and scene).
- **A wrong answer is one a learner could really give.** A `form`'s wrong
  fillings are real forms the cue rules out (the wrong tense, the wrong
  register, the rival) and, once at most in a question, the slip learners
  make (買あない); a `meaning`'s wrong readings are the misreadings the
  point invites; a `use`'s wrong lines are sentences someone could say, wrong for the
  reason the `why` gives. The right answer is the only right one: a
  rival the lesson calls a same-meaning form is never a wrong choice.
- **Which kind asks what.** `form` for what is built (a conjugation, an
  attachment, a particle's slot); `meaning` for a sense or a second use
  read in a sentence the learner has not seen; `use` for choosing between
  the point and its neighbours or registers in a situation. At least two
  kinds in a quiz, at most three of one, and the questions of one kind
  are not side by side.
- The `ask` of a `meaning` is a real question about the sentence, not
  "what does it say?" alone where the choices are only its translations
  (see the point's twists for the notions it already asks); an `ask` is
  never the question the twists or another question put.

Where a rival's lesson has contrast sentences, up to two more questions
are derived for the point (the rival's own contrast sentence with the
rival blanked and the point offered as the wrong answer, `study/
grammar_tour._gap_questions`), so a served quiz is at most eight.

Writing one: a twist is a surprise the guess did not prepare for -- a
second use (か between two nouns), a sense, a form the lesson teaches as
part of the point (ではありません for です), a constraint (は never on a
question word), or the rival the lesson warns about (ないでください).
**The twists are exhaustive** (plan 189): every notion the point covers
at its level gets one, named by its `notion`, and none repeats the
meaning the guess already asks; a sense the catalogue gives to another
point is that point's to tour, not this one's. Where the lesson's `use`
step does not name a notion its tour walks, the step says it too. Its wrong readings are the confusions a learner would
really make. The scene is a few lines a learner will live through at a
ticket window, a kiosk, on a platform; the point does its job in it, the
note says what the scene just showed, and the learner's own line is
chosen against the rivals of the lesson's `compare`. Keep the Japanese at
the level: a word above it is written in kana (とうきょう, おおさか).

Every point carries one (plan 187g) except the six no tour can be drawn
on, which keep the lesson: 〜て（理由）, 〜を（移動）, 〜で（理由）,
自動詞／他動詞, 使役受身形 and 〜み. A new point is written with its
tour. What the gate cannot see, and what the reviews of the first 535
found most often:

- **A second right answer.** A rival the lesson calls a same-meaning
  form (はずがない beside わけがない, 〜とはいえ beside 〜といえども) or
  a plain form a native speaker would accept (のに, ので, たら, だけ)
  is never a wrong choice. A wrong choice is wrong for the reason its
  `why` gives, and is a sentence someone could say, not broken Japanese.
- **Who says it.** A formal or written form sits in a mouth that would
  use it: a notice read aloud, an announcement, staff at the window, a
  stiff older speaker. A literary form is never put in a friend's mouth.
- **The learner has no gender.** "me", and the tu/vous a cue, a task or
  a why addresses, never agree in the French (« Pardon » for « Désolé »,
  « j'ai pris le mauvais train » for « je me suis trompé de train »), and
  the English never calls them "sir"; in the Japanese they say わたし or
  nothing, never ぼく or あたし.
- **The scene holds together.** The place fits what happens (a ticket
  bought at the gates or the window, not on the train), and the figures
  add up.

## Choisir's own questions (plan 200)

**Every point is asked in Choisir** (the ladder's first three steps and its
relapse). The contrast drill draws its question from the point's marked
`contrast` sentences, which needs the matcher (or the detector, once, on one
piece) to find the point and a sentence in which every rival is wrong. A
particle its rivals share every sentence with (は, も, と), a form whose
letters are every verb's (ない形, 〜ば), a class label (い形容詞／な形容詞) or a
cause the detector cannot tell from a sequence (〜て（理由）) has neither, and
its Choisir steps used to fall back to the flashcard. Such a point carries a
`choose` list instead, written like the tour's quiz it is modelled on:

```jsonc
"choose": [                                   // at least 3: one for each step of Choisir
  {
    "jp": "あれは学校＿＿＿。",                 // ONE hole, ＿＿＿ (study/grammar_examples.BLANK); no space in the sentence
    "tr": {"en": "That is a school.", "fr": "C'est une école."},  // printed UNDER the sentence: it fixes the meaning
    "choices": ["です", "あります", "ます"],     // three or four fillings, the RIGHT ONE FIRST (the run shuffles them)
    "why": {"en": "…", "fr": "…"},             // said to whoever takes a wrong one: why the right one is right
    "slips": ["ます"]                          // optional: see below
  }
]
```

The choices are the forms that stand in the hole, not catalogue points, so a
question is not limited to the rivals the lesson names. Writing one:

- **The right filling is the only right one.** Write every wrong filling out
  in the sentence before keeping it: a wrong filling is wrong only because the
  sentence is ungrammatical with it, or because it says what `tr` rules out.
  Where は and が (or も, と, や) both fit the grammar, `tr` must carry the
  difference ("too", "isn't it?", "but"), and a rival that is as good an
  answer is left out of the choices. What a reviewer finds most often is a
  second right answer: で marking a group (友だちで食べる) beside と, な before a
  する-noun (かんたんな説明) beside に, や as a free choice (ペンやえんぴつ)
  beside か.
- **The wrong fillings are slips a learner could make**: the rival, the wrong
  tense or polarity, the form that mixes two stems (まちた for まった).
- **The hole turns on the point, not on a word.** いつも is “always”
  whatever the lesson says of も after a question word; a question that is
  answered only by knowing the word is not a question about the point.
- **The hole holds the point, and the stem stays outside it.** The sentence
  as filled must be spelled right: 悲し＿＿＿ + み (悲しみ), never 悲＿＿＿ + み. A
  hole that starts or ends inside a word's reading (今日 held to 今) is refused.
- **`slips` names the wrong fillings the detector may read as the point
  although the sentence rules them out**: a form nobody says (the detector
  reads a た after any stem as た形), or the point in the wrong tense (だったし
  where the sentence says あした). It is the author's word and the reviewer's to
  check: a clipped or colloquial form that is just as good an answer (走ろ for
  走ろう, 食べれる) is a second answer, never a slip. A wrong filling the
  detector reads as the point and that is not declared is refused. A point that
  names its own alternatives (〜つ／〜人／〜枚, です／だ) is exempt, as in the
  scene.
- **Where the detector can read the point** (`grammar_detect.can_find`), it is
  asked of the right filling *at the hole*: the point must be written there. A
  sentence it cannot read is reworded, as a scene's line is.
- Both languages, no Japanese in a translation, the level's kanji (the point's
  own excepted), and a French that does not agree with the learner (no *je suis
  allé*, no *m'a forcé*): the learner has no gender.
- Never a sentence the lesson or the tutorial already shows (the examples, the
  twists, the scene, the quiz), and no sentence twice.

`study/grammar_choose.py` serves them through the contrast drill's own
payload (`contrast_payload`), adding the parts of the right filling as it
stands in the sentence (`fill`, what the card turns to), the ruby of a filling
with kanji, and `answer`, which the run compares a tile to. The gate is
`study/grammar_check._choose_problems`, run by `python -m scripts.check_grammar`,
and `tests/test_grammar_choose.py` holds that every point of the catalogue is
asked a real contrast on every turn. What the gate cannot see is the audit's
(`docs/content-audit/PLAYBOOK.md`): the questions are in the grammar and the
tours slices.

## The ladder's snapshot (plan 187e)

`ladder.json`, beside the five levels, is not an entry file: it writes
down which points Construire and write can be asked on -- `build` (since
plan 194 typed: a sentence of the point, an example, a twist with its
`tr` or a scene's line, where the point is lit in one stretch or two)
and `write` (a point the detector is trusted on,
`grammar_detect.can_find`) -- and
`blank`, the points the matcher cannot check whose marked sentences the
detector can blank for the contrast drill (plan 190). Asking takes
the detector over every example, some twelve seconds, which is the only
reason it is written down. After any change here run
`python -m scripts.build_ladder_flags` (`--check` reports first);
`tests/test_grammar_ladder.py` fails while the file disagrees. A point it
leaves out is still asked: its card falls back a rung. (`choose` is not in the
snapshot: a point's questions are read from the entry, which is cheap.)

## Rich levels

`RICH_LEVELS` in `content/grammar_points_data.py` names the levels whose
points carry the full lesson. There the gate requires: a `rule` step, at
least one `compare` rival, at least one `contrast` example (a point the
matcher cannot read carries three `choose` questions instead), three or more
examples (write four or five), and French that is not a copy of the English.
Every level is rich today. A level taken out of the set (or a new one)
is held to the lower bar — a bilingual gloss and two examples — until its
lessons are written; `check_grammar --report` prints `fr_pending` so the
debt is visible. Adding a level to `RICH_LEVELS` and writing its lessons is
one commit.

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
such as い形容詞／な形容詞) is not held to a contrast example: its lesson
names the neighbours either way, and the point is asked from questions of its
own instead (`choose`, above); since plan 200 a point with neither a marked
sentence the detector can blank nor `choose` fails the gate. It **may** still
mark a contrast sentence (plan 190), and then the drill and the ladder's build
blank it where the grammar detector finds it — exactly once, on one piece; the
gate names a marked sentence where it does not. Two rules for marking one (a
marked sentence is asked as it stands, with its rivals as the only wrong
choices):

- Mark only a sentence in which every rival is **ungrammatical** in the gap,
  not merely a different meaning. を in 毎あさパン＿食べます (が and に cannot
  stand there), が after a question word (だれ＿来ますか: は cannot), に with
  a clock time (七時＿おきます: で and へ cannot). は against が and も, と
  against や, ね against よ and へ against に share too many sentences to
  mark one: write them `choose` questions, where the translation printed under
  the sentence says which is meant.
- Such a point is offered its named rivals alone, never fillers from the
  level: a particle's gap takes だけ, まで, から and more, so no filler is
  certainly wrong there.

`card_index.contrast_ok` reads which of these points can be drawn from the
ladder's snapshot (its `blank` list), so run `build_ladder_flags` after
marking one. A point with `choose` needs no snapshot.
