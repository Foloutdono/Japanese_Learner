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
6. **The pool is pruned in place, never rebuilt from another edition.**
   `vocab_jmdict.sqlite3` is 76 MB and tracked; it is built as
   "everything not in the deck", so each added card overlaps it. A pool
   card's id is its row's position in the export, so a rebuild from
   another JMdict edition renumbers every pool card a learner holds;
   `scripts/prune_pool_overlap.py` takes the deck's words out row by
   row instead, senses moved with them (110). The overlap set in
   `tests/test_dictionary_vocab.py` is held empty.

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

### 105 — the demand list: words the app teaches without a card (first slice DONE, 2026-09-21)

Sources, in the order the learner meets them: the 11 focus words; the
corpus gaps 104 leaves (N5/N4 first); `content/listening_clips.py`'s
lines; `theme_words.json`'s `basic` words not in the deck; the
comprehension pool's prompts are generated and are out of scope. For
each word: the level of the lowest sentence that uses it, an English
gloss in the deck's style ("(humble) mother", not a JMdict sense dump),
a French gloss, its key in `vocab_frequency.json` beside a neighbour of
the same level, and a `KNOWN_POOL_OVERLAP` line if the pool holds it.

**The first slice** (24 words; the deck is 8,431): the eleven focus
words, every gap first met in an N5 or N4 sentence, and 無い, which got
the N5 card — kana-only ない, "the negative of ある" — because every
learner meets it in week one and the deck already teaches ある the same
way. The auxiliary ない of 食べない is a different part of speech and
never matches it. After the slice: no focus word unresolved, 154 absent
lemmas from 184, 275 occurrences from 575.

| level | added |
|---|---|
| N5 | 百円, 中国, フランス, りんご, コンビニ, ない, 顔 |
| N4 | 洋食, 駅前, やり直す, 頑張る, スマホ, 本屋, 足元, メール, 子犬 |
| N3 | 大雨, 失礼, 説明書, 言い方 |
| N1 | 館内, 支援, 専門家, お客様 |

Decided as grammar, not vocabulary, and named as such in
`audit_vocab_deck.IGNORED_LEMMAS` with the reason beside each: ございます
(the polite copula), かもしれない's 知れる, おいで's 出でる, the
causative 遊ばす, and 書き直す / 考え直す as instances of 〜直す (やり直す
is a word of its own). A compound numeral (三十, 三千) is its own kind
in the report: it composes from the digit cards through the compound
fold. いらっしゃる was already an N4 card; the gate refuses it only
behind て, which is right.

Two placements the rule did not settle, flagged for 109: 顔 went to N5
on `theme_words`' `basic` demand rather than to N2, the lowest sentence
that uses it; 支援 and 専門家 sit at N1 because only N1 sentences use
them, and any frequency source will say N2.

**Left for the next slices:** the 154 absent lemmas first met at N3 and
above (限り, 挙げ句, 多く, 抜き, 通ずる… — the 〜限り and 〜抜き points'
own words among them, to decide like 知れる); the 31 `theme_words`
`basic` words with no card (鹿, 亀, 顔 was one, 朝食, 麺, 桃, 洗濯機,
弁護士, 海老, 野球, 画面…), which need 109's placement since no
sentence gives them a level; and two N5 grammar examples the tokenizer
cannot cut because they are written entirely in kana (せが高い reads as
がせ, しゅくだい as しゅ + くだい) — a finding for the content audit,
not a card.

The N5 count in `tests/test_onboarding_profile.py` moves with the deck,
by design; `CLAUDE.md`'s "8,431 entries at 40 a run" and
`tests/test_modes.py`'s "1,097 of 8,405" are prose and follow.

### 106 — readings and forms, through the migration (DONE, 2026-09-21; the cross-level duplicates deferred)

Three ids moved, each a `MOVES` line in `content/vocab_renames.py`, so
`python -m scripts.migrate_vocab_ids` (report first, `--yes` to apply)
runs once after the deploy that carries them. (The three lines reached
the table with 108's commit, not 106's: the edit that wrote them sat
behind a data write that aborted, and nothing in the tests noticed an
id leaving the deck without a line — a served id has no memory of its
old self. The migration was never run in between, so nothing is lost;
but a future rename should be checked against `git diff` of the deck
before its commit, and 106b should add the guard: every id the last
tagged deck served is either still served or a `MOVES` key.)

- 掃除 N5 `そうじする` → `そうじ`, the する out of the reading field. The
  N3 掃除/そうじ stays: the two are now one of the exact pairs below.
- 見る 観る → 見る. Two spellings in one written-form field, with a
  space, meant its lemma key was neither and every 見る badged as the
  N3 card.
- 十 `じゅう とお` → `じゅう/とお`, the two readings joined the way the
  deck joins them (and the splitter, since 104, splits).

Settled without an id moving:

- 一日 already had both cards (ついたち and いちにち — the second glossed
  "first of the month", now "one day; all day"); what was missing was
  the fold choosing between them. `resolve_compound` now hands the
  joined tokenizer reading to `resolve_lemma`, so 一日中 folds to
  いちにち and reads so.
- たいへん's second N5 entry ("difficult situation") was the N3 大変
  card's sense and went; あの's second ("um...") is the filler, its own
  word, あのう. Neither touched the shared id, so nothing was orphaned,
  and `test_vocab_deck.py`'s allowance for the two pairs is released.
- **UniDic's lemma is not the deck's spelling** (104's finding): 213
  deck words lemmatise to another form, 55 of them to a form that is a
  higher-level card (帰る → 返る N1, 降りる → 下りる N4, 登る → 上る N2,
  感じる → 感ずる N2). `_index_vocab_by_lemma` now files each entry
  under UniDic's lemma for its written form as well (0.08 s at import),
  and `resolve_lemma` takes the token's surface: where a lemma names two
  deck words with one reading, the one sharing the surface's first
  kanji wins, so 帰り is 帰る and 返っ is 返る.
- **The auxiliary position is closed on both paths** (104's other
  finding): a verb in auxiliary use behind a conjunctive て/で resolves
  to nothing, because ている, てくる, てみる, ておく and てしまう are
  catalogue points and the row opens the point. 食べてしまった no longer
  badges the N1 仕舞う card. The audit script does not measure that
  position at all.

**106b — the 26 exact duplicates across levels (DONE, 2026-09-21).**
どう, でも, はい, この, その, ここ, いつも, できる… at N5 and N3, 掃除
after 106 and 対立 after 108: the same word twice, so a learner at the
higher level met it again as "new". One card each now, at the lower
level, its gloss the union of both (できる is "to be able to, to be
ready, to occur"); the higher card's id is a `MOVES` line onto it, and
the migration merges the rows. These are the first moves that change a
level, so `migrate_vocab_ids.rename_deck_cards` now rewrites
`deck_cards.level` from the target id — `routes/decks` resolves a linked
card by (source, level, raw_id), and a row left at N3 would resolve to
nothing. `test_no_rename_changes_the_level` became "never up": a move
that sent a card up a level would take it out of an N5 learner's deck.
Nineteen of plan 091's lines (the "word in both fields" family, この
and その among them) used to land on ids merged here and now point
straight at the lower card, since a move is one hop. The deck is 8,404.

The guard 106 lacked is in: `datas/vocab/vocab_served.json` is every id
served at the last `python -m scripts.audit_vocab_deck
--write-snapshot`, and `test_vocab_deck` holds that an id in it is
still served or a `MOVES` key, and that every served id is in it — so
a deck change carries its snapshot, and the snapshot's diff is where
a departed id is seen. The 266 shared written forms were 107's.

After 106: 166 unmatched lemmas and 330 occurrences in the corpus (from
194 and 633), 153 of them absent.

### 107 — French glosses per card, not per written form (DONE, 2026-09-21)

`vocab_fr.json` keeps its written-form keys and gains per-card keys,
`"{kanji}::{kana}"` (the deck key `vocab_frequency.json` and
`frequency_overrides.item_key` already use). `translations.fr_gloss`
reads the card's own line first and the form second, so nothing goes
blank; `get_meaning` — every reader but two search-index lines in
`routes/dictionary.py`, now routed through it too — takes it from
there. Not part of the id: no migration.

Measured properly, the 552 "shared" cards were two things: 220 cards
that share a form AND a meaning (the しいんと pair), for which one gloss
is right, and 334 cards across 160 forms that share a form with a card
of a different meaning and read whichever card's gloss the form
carried — the N5 私 as "je (fem.)", the N5 戸 as "unité de mesure pour
les maisons", the N5 辛い as "douloureux", the N5 僕 as "serviteur". Each
of the 334 now has a line of its own, translated from its own English
gloss, and the 38 cards with no French at all have theirs. The audit
script measures the two figures per card now, and both are zero.

Found on the way and left for 108: the N2 entry for たいりつ is
written "Ͼ立" — a mojibake where 対 should be — which is a written-form
correction and therefore a `MOVES` line.

### 108 — English gloss hygiene (the mechanical half DONE, 2026-09-21)

Not truth (the content audit's job) but form. Done by script, since a
gloss is not in the id: the 2,629 unspaced commas ("to fly,to hop") are
", "; 234 glosses began with a capital — the export's own, on N5 nouns
and adjectives ("Trousers", "Ten", "Below", "Body") — and 114 of them
are lowercase now, the ones that begin a proper noun (Japan, Shinto,
the weekdays, North Pole) or a phrase ("Take care of yourself", "How do
you do?") kept by an explicit list. The N2 たいりつ written "Ͼ立" is
対立, a `MOVES` line, and now the 26th exact cross-level pair (106b).
The audit pins the commas at zero.

Left to the content audit's vocab slices, forty a run with the evidence
bar, because each is a judgement: the parenthesised notes' convention
(a register note before the gloss, "(humble) mother"; a sense note
after) and the glosses that are a JMdict sense dump ("to change, to be
of use, to reach to" for する) to be shortened to what the card
teaches; and the two numbering styles, "(1) … (2)" (96 glosses) and
"1. … 2." (35).

### 109 — placement and the missing-by-frequency list (the source and the report DONE, 2026-09-21; the slices remain)

The two sources the review named first — NINJAL's BCCWJ short-unit
list and the Leeds internet corpus — are outside the build
environment's network allowlist. Two that are not, both licensed to
ship, are under `datas/vocab/sources/` with their provenance and
attribution in the README there:

- **A ranking**: the OpenSubtitles 2016 Japanese list from
  hermitdave/FrequencyWords (CC BY-SA 4.0), 50,000 subtitle surfaces
  with counts. A spoken register, closer to N5–N3 than a newspaper. Its
  tokens are surfaces (言, 知, 出 are verb stems; ジョン is a cast
  list), so `scripts/placement_report.py` runs each through the
  tokenizer and sums the counts per (lemma, reading): ~34,800 words.
- **A level check**: the community JLPT lists from elzup/jlpt-word-list
  (MIT), which are Jonathan Waller's tanos.co.uk lists (CC BY). The
  deck is in all likelihood a descendant of the same lists — the sizes
  per level match to within a few dozen — so this measures drift from
  the source, not an independent judgement.

`python -m scripts.placement_report` prints three candidate lists, forty
at a time with `--slice N`, for the content audit to work through (the
playbook's "missing words" slice kind is this): deck cards placed above
the level the JLPT lists give the word (546, most of them the lists'
N3 the deck holds at N2 — the old level-2 split); JLPT-list words with
no card (378 once affix patterns and variant rows are left out); and
words in the ranking's first 6,000 with no card (916), gated through JMdict
so fillers, names and stems never reach the list. The rule for a match
is the same everywhere: a kanji card by its form (and UniDic's lemma
for it) paired with its reading, never by reading alone — 琴 is not
事's rank 1 and 来る read きたる is not the N5 来る — and a kana-only
card by its reading. The script never changes a card.

The one thing it rewrites, with `--rebuild-order`, is
`vocab_frequency.json`: the deck's own keys in the ranking's order,
the 20% the subtitles never say after them in their old order. Rebuilt
here, so the 頻度 tiers mean something for the first time; the file is
a derivative of a CC BY-SA list and carries that attribution.
`tests/test_placement_report.py` holds the file equal to what the
script would write, the ranking to words rather than surfaces, and a
homophone to never inheriting a rank.

Coverage: N5 485 of 675 cards ranked, N4 463 of 643, N3 1,501 of 1,816,
N2 1,255 of 1,794, N1 2,341 of 3,476; medians 1,545 / 2,354 / 2,672 /
8,872 / 8,334. One limit to know: UniDic normalises spelling variants
under one lemma (診る, 観る and 看る under 見る; 帰る under 返る), so a
variant card carries its group's rank — 診る sits in the first tier
beside 見る. A card is matched by its own form first, so this only
reaches a spelling the subtitles never write. If BCCWJ is ever fetched,
the ranking half is re-based on it with the same script.

**Left:** working the three lists, forty a run, through the audit
Routine — nothing moves or is added without the evidence bar. The
105-slice placements flagged earlier (顔 at N5, 支援 and 専門家 at N1)
are on the first list.

### 110 — the pool, in place rather than rebuilt (DONE, 2026-09-21)

The plan was one rebuild of `vocab_jmdict.sqlite3` against the grown
deck. It cannot be done here and should not be done lightly anywhere:
a pool row's SRS card id is its `id`, the row's position in the export
it was built from (`vocab_jmdict_data.py`, CARD-ID SCHEME), so a rebuild
from any other JMdict edition renumbers every pool card a learner
holds, and the export this pool came from (JMdict 2026-07-15) is
gitignored and not on this machine. A rebuild is only ever safe from
the same export, or with a `migrate_jmdict_card_ids`-shaped migration
beside it.

`scripts/prune_pool_overlap.py` does the same job in place: it finds
every pool row whose (kanji, kana) the deck serves — 28 today, the four
kana-only words that sat on both sides since the first build (しまう,
ね, とん, ふと) plus 102's and 105's cards — moves each row's senses
blob to `curated_senses` under the deck's key first (a word added after
the build had no curated row and read its glossary and examples from
the pool row through `vocab_extras._find_senses`'s fallback; delete the
row alone and 母 loses its example sentences), then deletes the
entries and senses rows. Every other id stays where it is; `freq_rank`
keeps its gaps, which every reader tolerates (BETWEEN, COUNT). Reports
first, `--yes` applies, idempotent. `KNOWN_POOL_OVERLAP` in
`tests/test_dictionary_vocab.py` is the empty set now and stays so: a
deck addition that skips the script fails there, and a test holds that
母 still has its examples. The theme lists follow in the same run: four
rows (子犬, 顔, コンビニ, スマホ) named their word through the pool's
domain and are the deck's now, which is what a rebuild of the theme
index would do too.

Not done, recorded as **110b**: a learner who studied a word from the
pool before the deck taught it holds a `vocab_jmdict_{id}` card that
now resolves to nothing (the app treats it as content that went away).
Carrying that history onto the deck card is a migration of the
`migrate_jmdict_card_ids.py` shape, keyed by the ids this script
deletes; worth doing before the next deck slice lands in production.

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
