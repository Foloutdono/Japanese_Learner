# Wave 22 — the vocab deck review (plans 102–110)

Planned 2026-09-21, from the breakdown under one N5 sentence:
「母は日よう日に買いものをします。」 showed 母 with no card and 日曜日 as
two words. Both were symptoms of the deck, not of the screen, and plan 102
(done, this branch) fixed the two. This document is the review those two
symptoms ask for: every existing card, and every word the app puts in
front of a learner without a card behind it.

It lives in `docs/` rather than `plans/` because `plans/*.md` is
gitignored and the session that wrote it had no lasting checkout; the
wave index in `plans/README.md` points here.

## The idea in one paragraph

A vocab card is the unit the whole app turns on — the breakdown row, the
badge, the SRS row, the daily ration, the 番付 — and the deck is a
spreadsheet export that has never been reviewed as a whole. Plan 091
cleaned what Excel had done to it; plan 102 found that a word the N5
syllabus cannot do without (母) was absent while its honorific was
present. This wave measures the deck once, with a script anybody can
re-run, repairs the lookups that make a present card look absent (so the
"missing" list is true before anyone adds a word), adds the words the
app's own sentences demand, corrects readings and duplicates through the
migration path the ids require, and only then asks a frequency source
what else is missing — in audited slices, never as a bulk import.

## What the numbers say (2026-09-21, after plan 102)

Measured with the deck as loaded by `content/vocab_data.py` and the
tokenizer as installed (`fugashi` + `unidic-lite`); 103's script makes
these reproducible.

| | |
|---|---|
| entries | 8,407 — N5 669, N4 634, N3 1,832, N2 1,796, N1 3,476 |
| kana-only entries | 1,129, of which 541 katakana |
| same (written form, reading) at two levels | 25 pairs (どう, でも, はい, この, その, ここ… N5 and N3) |
| same written form, several cards | 266 forms, 552 cards |
| entries with no French gloss | 38 (飛ぶ, 起きる, 毎晩, 八, 自動車…) |
| kana field carrying two readings joined by `/` | 18 — `card_lookup._reading_variants` splits on `;`, so none is ever matched by reading |
| glosses with an unspaced comma (`to fly,to hop`) | 2,600 |
| glosses carrying a parenthesised note | 899 |
| entries whose kanji sit above the entry's own level | 2,241 (379 at N5: 太い, 写真, 曇り, 飲み物…) |

The taught corpus — the 226 curated reading sentences and the grammar
catalogue's example sentences, 2,395 sentences in all — through
`analyze_local`:

| | |
|---|---|
| content words resolving to no card | 244 distinct lemmas, 912 occurrences |
| of which katakana words that ARE in the deck | 51 lemmas, 164 occurrences (パン, コーヒー, テレビ, バス, ドア): the tokenizer's reading is folded to hiragana, the deck stores katakana |
| of which adverbs | 20 lemmas, 144 occurrences (もう, どう, もっと, ゆっくり, そろそろ): もう and どう are in the deck; `resolve_kana` admits no adverb |
| 無い | 210 occurrences; no card, arguably grammar |
| 出来る | 51 occurrences; in the deck as できる, but UniDic tags it 非自立可能, so the auxiliary gate refuses it even as the main verb |
| left after those: N5/N4 sentences, real gaps | ~21: 中国, 駅前, 頑張る, 本屋, 足元, 林檎, 子犬, 書き直す, 三十, 三千, いらっしゃる, ございます… |
| curated focus words with no card | 11: 顔, 百円, 洋食, 大雨, 失礼, 説明書, 館内, 支援, 専門家, お客様, 言い方 (`card_lookup._vocab_index`'s docstring) |

Two more things the numbers do not show but the work will meet:

- **The JMdict `freq_rank` is a newspaper ranking.** Its top five are
  委員会, 移植, 円高, 加盟, 会長; of its top 1,000, 864 are not in the
  deck and should not be. `vocab_frequency.json` is a placeholder in JLPT
  order (`frequency_data.py` says so). Neither can say what an N5 learner
  is missing; 109 chooses a source that can.
- **`vocab_fr.json` is keyed by the written form alone.** 後 has four
  cards (あと, うしろ, ご, のち) and one French gloss, "après, depuis
  lors, à l'avenir", which is wrong for うしろ. 550 cards share a gloss
  this way.

## Decisions this wave embodies

1. **Demand before frequency.** A word the app itself puts in front of a
   learner — a curated sentence, a grammar example, a dictation clip, a
   theme list — has a card, or the sentence is changed. Frequency lists
   come after, and only propose.
2. **A card id is its fields.** `vocab_{level}_{kanji}_{kana}`: every
   correction of a written form or a reading is a migration through
   `content/vocab_renames.MOVES` and `scripts/migrate_vocab_ids.py`,
   which merges on collision. A gloss is not in the id and moves
   freely. Plan 091 is the precedent and `tests/test_vocab_deck.py`
   holds the table honest.
3. **The card's level is the word's, not its kanji's.** 写真 is N5
   although 写 is N4; that is why curated sentences write 日よう日. The
   2,241 figure is not a defect list. What IS a defect is a word at a
   level no learner meets it at, and only a frequency source can say so.
4. **Present-but-unmatched is a lookup bug, never a deck gap.** 103's
   report separates the two, and 104 repairs the lookups before 105
   adds a single word — otherwise the deck grows duplicates of パン.
5. **Additions are audited, not imported.** The content audit's evidence
   bar (`docs/content-audit/PLAYBOOK.md`) applies to a new card as it
   does to an old gloss: a wrong card with a citation is worse than no
   card. Slices of forty, like the vocab audit.
6. **One pool rebuild, at the end.** `vocab_jmdict.sqlite3` is 76 MB and
   tracked; it is built as "everything not in the deck", so each added
   card overlaps it until a rebuild. `tests/test_dictionary_vocab.py`'s
   `KNOWN_POOL_OVERLAP` carries the overlaps meanwhile (母 and 父 are
   there now); 110 rebuilds once and empties the set.

## The plans

### 102 — 母, and one word for 日曜日 (DONE, 2026-09-21)

- 母 (はは) and 父 (ちち) at N5 with English and French glosses, in
  `vocab_frequency.json` beside their honorifics; N5 is 669.
- `card_lookup.resolve_compound` / `compound_reading`: a run of up to
  three noun/prefix/suffix morphemes that the deck teaches as one word
  folds into one token in `study/analysis._tokens`, by surfaces joined
  and by lemmas joined (日よう日 only spells 日曜日 through its
  lemmas), with the entry's own reading (にちようび, not にちよう + ひ;
  ふつか, not ふた + か). Never across a particle. Tests in
  `tests/test_analysis.py`.
- Known and left for 106: 一日中 now folds to the deck's 一日, whose only
  reading is ついたち, so the row reads wrong; the deck lacks いちにち.
- The reading-badge scanner (`_find_segments_morphological`) keeps its
  own two-morpheme surface merge: it feeds `difficulty.report`, which
  gates every curated sentence, and widening it moves that gate.

### 103 — `scripts/audit_vocab_deck.py`, the report (DONE, 2026-09-21)

Read-only, no database, no `.env`; prints the two tables above and
writes them as JSON with `--dump`, so the review is measured the same
way every time (`--skip-corpus` leaves out the tokenizer half). Sections:
shape (counts per level, kana-only, katakana), duplicates (exact pairs
across levels; forms with several cards), readings (`/` fields; `;`
fields), glosses (unspaced commas, parenthesised notes, empty, French
coverage, shared French glosses), the frequency order (keys missing from
it, keys stale in it), kanji above the card's level (a flag, decision 3),
the focus words, and the corpus: every content word in the taught
sentences with no card, partitioned into katakana / adverb /
auxiliary-gated / proper noun / absent. The corpus half needs the
tokenizer and says so when it is missing, like `audit_slice`'s pykakasi
note. It resolves words through `card_lookup` exactly as the breakdown
does, compound fold included, so what it reports unmatched is what the
screen shows without a badge.

Its first run corrected the table above: the corpus is 2,487 sentences
once the dictation lines are counted, 246 lemmas and 925 occurrences
unmatched — 36 katakana (101), 15 adverbs (136), 2 auxiliary-gated
(出来る 53, いらっしゃる 6), 9 proper nouns (54: タナカ, トウキョウ…),
and 184 absent (575), 無い alone 210 of them.

`tests/test_audit_vocab_deck.py` holds the figures: the zeros as zeros
(no `;` field, no empty gloss, no deck key missing from or stale in
`vocab_frequency.json`), the rest as ratchets to lower as each plan
lands (25 exact pairs, 18 `/` fields, 2,600 unspaced commas, 38 without
French, 550 sharing a French gloss, 184 absent lemmas), the eleven
unresolved focus words as an exact set, and the partition itself (パン
is katakana, もう an adverb, 出来る gated, タナカ a name, 無い absent,
母 and 父 no longer anything). The `KNOWN_POOL_OVERLAP` set stays in
`tests/test_dictionary_vocab.py`, where it already was.

### 104 — the lookups: present cards that look absent (DONE, 2026-09-21)

In `study/card_lookup.py`, each with a test in
`tests/test_card_lookup_variants.py`:

- **Katakana.** `_index_vocab_by_kana` keys each reading also by its
  hiragana fold (`morphology.kata_to_hira`), so パン's folded reading
  ぱん finds the deck's パン. The written form stays a key too.
- **Adverbs.** `resolve_kana` admits `adverb`, but only to a kana-only
  entry: the deck's adverbs are kana-only words with nothing to collide
  with, and the kanji homophones a reading also reaches (こう is 請う
  and 溝 too) are nouns and verbs. こと/もの/よう still do not resolve
  (the bare-kana test stays).
- **出来る.** An `auxiliary_use` token is admitted when it does not
  follow a conjunctive て/で (the ている/てくる/てしまう position the
  gate exists for) AND its reading has exactly one candidate at its
  best level. できる has one N5 entry: admitted as the main verb of
  買い物ができます. いる has 居る and 要る both at N5: refused either
  way. `resolve_kana` keeps its old gate for a caller without the
  context; `resolve_morpheme(morphemes, i)` computes it from the
  neighbour and is now the one way every screen resolves a word
  (`analysis`, `level_mix`, the reading-badge scanner, the audit
  script), so "off-deck" means the same thing everywhere.
- **`_reading_variants` splits on `/`** as the deck writes it (and
  still on `;`, which was never in the data).

After it, the corpus section reads: katakana 0, adverb 0, gated 1 lemma
(4 occurrences, its own case), 184 absent lemmas unchanged — 194
unmatched lemmas and 633 occurrences, from 246 and 925. That list is
105's input.

Two things the repair exposed, recorded for 105 and 106 rather than
fixed here, because each is a judgement about the deck:

- **The lemma path is ungated.** `resolve_lemma` runs first and asks
  no question about use, so 食べてしまった badges the N1 仕舞う card
  and お金がいる badges 居る (UniDic's lemma for both readings of
  いる is 居る in that sentence). The reading gate never sees them.
  Either the gate moves in front of both resolvers for a token in
  auxiliary use, or the deck's 仕舞う is accepted as what てしまう
  opens. 106 decides with the duplicates. The same path hands the
  nominaliser こと to the N3 事 card in every 〜ことができる, since
  UniDic's lemma for it is 事 and the deck has both 事 (N3) and a
  kana-only こと (N4); `_index_vocab_by_lemma`'s bare-kana guard only
  protects the reading path.
- **UniDic's lemma is an orthographic base, not the deck's spelling.**
  帰る lemmatises to 返る, so the N5 verb badges as the N1 返る card in
  every sentence that uses it. The fix is a lemma-to-deck spelling
  table beside `vocab_renames`, fed from the pairs the audit script can
  list (a lemma resolving to a level above the sentence's, with a
  homophone at a lower one); 106 owns it.

### 105 — the demand list: words the app teaches without a card

Sources, in the order the learner meets them: the 11 focus words; the
corpus gaps 104 leaves (N5/N4 first); `content/listening_clips.py`'s
lines; `theme_words.json`'s `basic` words not in the deck; the
comprehension pool's prompts are generated and are out of scope. For
each word: the level of the lowest sentence that uses it, an English
gloss in the deck's style ("(humble) mother", not a JMdict sense dump),
a French gloss, its key in `vocab_frequency.json` beside a neighbour of
the same level, and a `KNOWN_POOL_OVERLAP` line if the pool holds it.
Decide 無い: either an N5 card (JMdict has it; every learner meets it in
week one) or an explicit "grammar, not vocabulary" entry in the
script's ignore list — not silence. Same for いらっしゃる / ございます
(keigo verbs the N4 examples use).

The N5 count in `tests/test_onboarding_profile.py` moves with the deck,
by design; `CLAUDE.md`'s "8,407 entries at 40 a run" and
`tests/test_modes.py`'s "1,097 of 8,405" are prose and follow.

### 106 — readings and forms, through the migration

Every change here rewrites an id, so each is a `MOVES` line and the
migration script runs once after deploy (`python -m
scripts.migrate_vocab_ids`, report first):

- 一日 gains いちにち: kana `ついたち/いちにち`, and
  `compound_reading` then picks the tokenizer's reading when it is one
  of the variants (it already does; the variant was missing).
- 掃除 N5 `そうじする` → `そうじ` (the N3 card is already 掃除/そうじ:
  merge, keep N5).
- The 25 exact duplicates across levels: keep the lower level, move the
  higher card onto it; the migration merges on collision.
- たいへん and あの, the two same-level pairs `test_vocab_deck.py`
  names: choose the disambiguator (a written form for one of each —
  大変 / あの…) and release the test's allowance.
- The 266 shared written forms are mostly legitimate (後 is four words)
  and are 107's problem, not this one's; only a pair that is the same
  word twice moves.

### 107 — French glosses per card, not per written form

Re-key `vocab_fr.json` by the deck key `"{kanji}::{kana}"` (the shape
`vocab_frequency.json` and `frequency_overrides.item_key` already use),
with `translations/fr/vocab_fr.py` reading the new key first and the
bare written form as a fallback so nothing goes blank mid-migration.
Fill the 38 missing and split the 552 shared, starting with the forms
whose cards mean different things (後, 店, 門, 二人). The readers are
`routes/dictionary.py` and `routes/vocab.py`. Not part of the id: no
migration.

### 108 — English gloss hygiene

Not truth (the content audit's job) but form: the 2,600 unspaced commas
become ", " by script (gloss is not in the id); the parenthesised notes
keep one convention, which the deck already leans to — a register note
before the gloss, "(humble) mother", "(honorable) father" — and a sense
note after; a gloss that is a JMdict sense dump ("to change,to be of
use,to reach to" for する) is shortened to what the card teaches. Fold
into the content audit's vocab slices rather than one pass: forty a run,
with the audit's evidence bar.

### 109 — placement and the missing-by-frequency list

Choose a learner frequency source that can ship (licence) and speaks
the tokenizer's units: the BCCWJ short-unit word list (NINJAL, the same
corpus `unidic-lite` is trained on) is the natural fit; the community
JLPT lists are a check on level, not a ranking. Then, per level:
deck words outside the top band for their level (candidates to move
up), and top-band words with no card (candidates to add). Output is a
list with the rank beside each word, reviewed forty at a time through
the audit Routine's method — `docs/content-audit/PLAYBOOK.md` gains a
"missing words" slice kind — and never applied in bulk. The same
ranking replaces the placeholder `vocab_frequency.json` (a list of deck
keys; no id changes) so the 頻度 tiers finally mean something.

### 110 — the pool rebuild

Restore the JMdict export beside `vocab_jmdict.sqlite3`, run
`scripts/build_jmdict_db.py` against the grown deck, empty
`KNOWN_POOL_OVERLAP` to its four historic entries (or to nothing, if the
export has moved on), one commit. Last, because the binary is 76 MB and
one rebuild is the budget.

## Order and dependencies

103 → 104 → 105 → (106, 107, 108 in any order) → 109 → 110. 103 and 104
are a day; 105 and 106 are content work with a migration at the end;
107 is a data reshuffle with a small reader change; 108 and 109 run as
audit slices over weeks; 110 closes.

## Traps worth knowing before you touch it

- **Correcting a surface field orphans SRS rows** (CLAUDE.md, "Database
  maintenance"): every 106 change needs its `MOVES` line, and
  `test_vocab_deck.py` refuses a target the deck does not serve, a
  chain, and a level change.
- **`vocab_frequency.json` must hold every deck key** — the 頻度 tier
  code resolves through it; a key left out is a card no tier can reach.
  102 inserted its two beside their honorifics; do the same.
- **`audit_slice`'s vocab rotation is risk-ordered over the deck**, so
  adding entries reshuffles which forty a given date audits.
  `tests/test_audit_slice.py` holds the promises, not the members; check
  it after 105.
- **The pool overlap test is exact**: an added card that JMdict holds
  fails it until listed. List, do not delete rows from the sqlite — a
  hand edit is a 76 MB diff and the next rebuild undoes it anyway.
- **`resolve_lemma` runs ungated before `resolve_kana`.** 104 must not
  add bare-kana keys to `_VOCAB_BY_LEMMA` (the こと/もの hazard its
  docstring explains); the katakana fold belongs in the kana index.
- **The reading-badge scanner is also the difficulty gate.** Widening
  its merge (to lemmas, to three morphemes) changes `difficulty.report`
  and therefore which curated sentences pass `test_reading_sentences`;
  do it deliberately, with the bank rerun, or leave it.

## Verification

- 103's report, before and after each plan, checked into the plan's
  record as the two tables above.
- Backend: `pytest` green with the migrations' tests; the N5 count and
  the overlap set updated with each addition.
- The sentence that started this, on the phone: 母 with an N5 badge that
  opens, 日よう日 one row reading にちようび, and 一日中 reading いちにち
  after 106.
