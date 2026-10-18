# Practice modes — content audit (plan 247, 2026-10-18)

A one-off audit of everything the seven practice modes serve: 読書 and
翻訳 (the reading bank), 読解 (the comprehension seeds), 書取 (the
dictation bank), 作文, 会話 (the conversation bank) and 模試 (the exam
seed papers, 20 exam ids). Its aim was to try to disprove what each
item teaches. Unlike the scheduled audit (`PLAYBOOK.md`), which only
files issues, this one applied the verified fixes in the same change.
What is left needs the owner's call. Those findings are listed below,
followed by additions worth considering.

## How it was checked

- **Mechanical passes over the shipped text.**
  - Every served reading: the furigana and romaji of 40,844 sentences,
    diffed before and after each rule.
  - Every catalogue label, against what the detector finds.
  - Every reading-bank focus, against the card the breakdown tags.
  - Choice-length tells.
  - Near-duplicates across a level and across papers.
- **The voice, offline.** Every line the app voices went through
  VOICEVOX's own text analyser (engine 0.23.0, its pinned pyopenjtalk
  fork and default user dictionary), and what it would say was compared
  with the line's kana. That covers the conversation lines, the
  dictation bank and the exam listening scripts. The audio is
  synthesized from `jp` exactly as written, so a word the engine
  misreads reaches the learner.
- **A native-judgment pass per content set.** For each slice: is the
  Japanese natural and at level, is the key the only right answer, are
  the English and French faithful, and does the label teach the point
  the catalogue teaches? Every finding was verified before it was
  applied. Tiers follow the playbook: A is wrong, B misleads.

## What was fixed

**Readings** (`study/reading_context.py`, `LOCAL_REV` 17). The analyser
gave wrong readings to words every level uses. Each is now read in
context and pinned in `tests/test_furigana_context.py`:

- 〜日 after a noun: 誕生日 たんじょうび, 休館日.
- 〜会社: 旅行会社 りょこうがいしゃ, 株式会社.
- 今日 is きょう wherever UniDic said こんにち before 中, a comma or a
  noun.
- Dates and times: 一昨日 おととい, 生年月日 がっぴ, 四月一日 ついたち,
  午後四時 よじ, 何時ごろ なんじごろ.
- この前 まえ.
- Standing alone: 箱 はこ, 鉢 はち, 版 はん, 数 かず.
- Compound tails: 腕時計, 通行止め, ビニール傘, 普段着, 洗濯物, 洗面所.

**読書 / 翻訳 (reading bank)**, 63 rows:

- N5#119's focus scheduled 一月 "one month" instead of January.
- N5#65's かんじ was glossed 感じ "feeling" (N3).
- N5#55 used the N1 idiom 耳をすます.
- N5#45 was tagged を for the を of 出る; it is now 〜を（移動）.
- N1#215 and #216 rendered 〜ないとも限らない as "could well", the app's
  wording for 〜かねない.
- N1#35 used 〜が早いか with the non-deliberate clause its own lesson
  rules out.
- Translations and French: N2#199 驚いたことに, N2#165 (a tense), N3#128
  どんなに, N1#178 (an agreement), 部長/課長 made consistent in French,
  N4#12 〜てあげる, N5#53.
- N3#25: 作業…完成 is a miscollocation.
- N2#36's focus, 看板, was used in a sense its card does not teach.
- 44 near-duplicates, rewritten: rows that repeated another row's scene
  and focus card, often across sibling points.

**読解 (comprehension seeds):**

- n1-03 claimed a false historical first (日本で初めての女性医師) and
  had a figure its key did not match.
- n2-03's crow text contradicted itself.
- Mistranslated grammar: もさることながら, すら, ざるを得ない, つつある,
  後を絶たない.
- n4-02 was labelled 〜そうです for a hearsay そう.
- Two N5 notes and an option.

**書取 (dictation)**, 12 lines:

- Three lines the voice misread in the line itself: 何と as なにと,
  絵を描く as えがく, and 日本社会 as にっぽん against the furigana.
- Two wrong words: 写真を写す for 撮る, and 体が悪い for 具合が悪い.
- 〜によると closed by でしょう.
- Five lines repeated another line (N4#24, N4#28, N3#20, N2#1, N1#30).
- N1#26's English dropped 臨時.

**会話 (conversation):**

- Content:
  - A wrong reply that was right (N3 shift-swap) and one that failed for
    no reason (N1 meeting-objection).
  - A fever of 37 °C.
  - いってきます explained as said only at home.
  - Three alternatives that dropped what the reply says.
  - French that gave the learner a gender.
- The voice: 46 lines the engine said wrong, among those it voices
  (what is said to the learner, the right reply, a matched alternative,
  the close). A few are wrong replies, changed with the reply they
  mirror. The misreadings:
  - 何ですか said なにですか.
  - 十分 / 五分 said じゅうぶん / ごぶ where it means minutes.
  - 角 said かく, 暇 いとま.
  - 来月の一日から入れます said いちにち…いれます.
  - A phone number said as two large numbers, against its own note.
  - 九時の間 said ときのま, 開いています ひらいて, 方 ほう for a person,
    三件 さんげん, お忙しい中 ちゅう.

  Each is rewritten so the engine says what the kana says, the Japanese
  natural and the choices still parallel.

**模試 (exam seeds, all 20 exam ids):**

- Second right answers:
  - N5 grammar: 新しく くつを買いました is right too.
  - N2 vocab: この要領で.
  - N3 vocab: 実検 is a word.
  - N2 grammar: とても fits two slots.
  - N3 and N4 listening: an option literally true, and a premise nobody
    stated.
  - 上 offered うわ, 二 offered ふた.
- Lines the voice misread where the answer lies:
  - N5–N4: 店 てん, 一かい いちかい, 何まい なにまい, 何よう日 なによーび,
    白が しらが, は＋いります heard as 入ります.
  - N3: 時の間 ときのま, 一度家 いちどか, 管理人 かんりじん, 祝日 しゅくび.
  - N2: 時間近く まぢかく, 辛い つらい.
  - Plus about 150 more lines away from the key.
- Model texts:
  - Wrong Japanese: アパートで住む, ギターの糸.
  - A diary whose weather line contradicts its first sentence.
  - おじいさん for one's own grandfather beside 父と母.
  - Register mixed in one stem.
  - 食塩 at the dinner table.
  - Eight carrier sentences the course's own example layer had already
    replaced as translationese.
  - N1 orthography a native would not write (然しながら, 成る丈,
    如何にも, 増し).
- Words above the level in N3 reading keys (くき, かめ, 〜もそこそこに),
  an N5 word tested on an N1 paper (始め), and repeats inside one paper
  that had a tested replacement.
- 184 漢字読み items carried an impossible choice: たべるう, だすう,
  だんっかい, しっげ, しゅっぢょう, まっど, or a reading of the very word.
  In 68 the choice was swapped for one the fixed generator makes. The
  other 116 had nothing left to offer (most are verbs whose okurigana
  rules out every near-miss), so they were re-dealt on an unused word of
  the level, as the generator deals them now.
- N1 listening's misread lines, the key line among them: ちゅうりん禁止
  for 駐輪禁止, お米 おこめ, 生の なまの, 十分 as 10分 or じゅうぶん,
  持ち手 もちて, 港町 みなと町, 先生がた, あいてない, and 看護師長 for 師長.
- Stories told twice. The seeds were written on forty subjects, drawn
  part by part with no memory of the paper, so one story came back
  within and across papers: cinema seats in five N5 papers, four
  neighbours' parcels at N3, pet-sitting six times at N1. 171 texts
  that retold another (their content words overlap by 0.25 or more,
  `retold_stories`) are new scenes or passages, on subjects no other
  text of the exam id tells, with new questions at the same answer ids.
  Five more, just under the line, read as one story and were rewritten
  too.
- Keys that copied the passage. Picking the choice that copies the most
  of its passage won 53%, 60%, 55%, 57% and 42% of the reading questions,
  N5 to N1, against 25% for a blind pick. 178 keys are now said in other
  words, and where it helps a wrong choice reuses the text's words in
  something untrue: 23%, 26%, 20%, 23% and 21% (`echo_tells`, 15-35%).
- Words tested twice: 78 vocabulary items tested a word an earlier paper
  of the exam id had tested, 21 of them in another spelling or form
  (水曜日 and すいようび, 言う and 言いました). Each later one is now on a
  word the exam id does not test.
- Grammar points asked again and again while others never were
  (をください six times at N5, か何か four at N3, かたわら five at N1):
  135 items, blanks and passages are on points the exam id had not
  keyed, near-synonyms kept apart within a paper.

**Code:**

- `study/exam_kanji_gen.py` builds 漢字読み distractors under rules that
  make those choices impossible. Each rule is pinned in
  `tests/test_exam_kanji_gen.py`:
  - No change to printed okurigana.
  - No っ after ん, after a long vowel or before okurigana.
  - No voiced consonant after っ.
  - No ぢ/づ voiced out of ち/つ.
  - No う lengthening a u-column mora.
  - No reading the word itself has (deck or JMdict).
  - No okurigana stem, affix reading or loanword reading.
- `study/exam_study.py`: the results screen studied a 用法 question by
  its bare word (間), because stored papers keep that mondai as
  `mcq-text`. The usage item is now told by its blueprint id, and shows
  its right sentence.
- The mock exam's card said "Full-length practice exams". A paper
  carries a share of a section's items, so it now says practice papers
  (en, fr).
- `study/llm_shared.soften_kanji` softens a number with its counter, in
  the reading the pair takes (一階 いっかい, 何階 なんがい, 一冊 いっさつ).
  Word by word it wrote 一かい, which the engine reads いちかい. In a
  listening script it also writes in katakana what the engine misreads in
  hiragana: a noun softened to a lone は or へ (ハブラシ), and さつ after a
  number.
- `study/exam_topics.py`: an exam walks each list it draws from (the
  subjects, the grammar points, the deck words) in one order, and a paper
  takes its share by its place, the revision or a seed's number
  (`TopicDeck`, `dealt_order`). The pools hold 90 reading and 160
  listening subjects, ten papers of the level that asks the most of each.
- The reading prompt asks for the key in other words than the text's,
  and a key that still copies it (`exam_validation.copied_key`) is told to
  the model once (`llm_cost_model` counts the call).
- `study/exam_seed.py` holds the seeds to all of it: `retold_stories`,
  `echo_tells`, and `retested_words`, which tells a word by its deck
  entry, in any form.

## Open findings (the owner's call)

**Voice.**

- Valid but unlike the kana, left as they are:
  - 日本 said にっぽん.
  - 船便 said せんびん.
  - お手数 said おてかず.
  - 数日 said すうにち.
  - その間 said そのかん.
  - 明日 said あした where the kana says あす.
  - 確認不足 said ふそく.

**Exams.**

- The kanji deck places 結 and 基 at N1, where most lists have N3 and
  N2, so N2 papers write けっか and にもとづいて in kana. Moving a
  character is a migration (`kanji_renames`).
- In listening, the choice repeating the most of its script is the key
  in 37-39% of items. No check bounds it, since a script is heard rather
  than read beside the choices.
- Never-right distractors: にかたくない is a wrong choice 14 times on N1
  grammar papers and never the key, を皮切りに 8 times.
- Mondai below their level:
  - Two N2 and two N1 cloze passages whose blanks need only N4 grammar.
  - Seven N2 短文 that measure as N4 text: the generator has a level
    ceiling but no floor.
- Smaller items:
  - 看護婦 shown as the natural word (N4 vocab).
  - 個室 and 電池 as keys of N4/N5 items.
  - The transcript labels speakers A/B rather than 女/男.
- `instructionsJp` for the listening mondai says nothing is printed and
  the choices are spoken. Learners never see it (the app shows its own
  instruction for 課題理解/ポイント理解), but it is false.

**Reading bank.**

- 26 N5 rows are a grammar lesson's own example, verbatim or one word
  apart, against the bank's style guide. Several are pinned by
  `basics.json` and the ride, so whether N5 is exempt is the owner's
  call.
- The lookup tags やめる (quit a company) as 止める and ふね as 舟 (N4#33,
  #111, #186). A fix belongs in the lookup, pinned in
  `test_lookup_precision.py`.
- 塗る's card glosses "paint, plaster", but two rows use it to spread
  jam and apply ointment. That is a deck change.
- The N3 〜ばかり entry is headed "just did" (N4's 〜たばかり), while its
  steps and the rows use noun＋ばかり "nothing but". That is a catalogue
  change; check what reads `structure` first.

**Comprehension.**

- The detector misses three labelled points:
  - n3-01 そのおかげで.
  - n5-02 AのほうがBより.
  - n5-04 〜で…がいちばん.

  The labels are right.
- n1-03's 「今日、」 means "nowadays" (こんにち) but reads きょう. The
  analyser cannot tell the two apart there.

**The audit itself.** `audit_slice` rotates grammar, vocab, sentences,
placement, tours and conversation. The comprehension seeds, the exam
seeds and the dictation bank are never in its slice.

## Additions worth considering

- **読書 / 翻訳**
  - A test that every row's focus resolves to the card the breakdown
    tags (it would have caught 一月).
  - Rows for the points no row covers (`reading_bank_report`).
  - In 翻訳, alternatives per row, as 会話 has them, so a right answer in
    another register scores as one.
- **読解**
  - More seeds below N3 (six per level now).
  - Questions beyond the literal lookup: inference, the writer's intent,
    a referent (これ, その).
- **書取**
  - Numbers, times, dates and prices: the JLPT listens for them, and so
    should the bank.
  - Minimal pairs for long vowels and small っ.
  - A slower replay.
- **作文** — situational prompts (decline an invitation, apologise for
  a delay, ask a favour by message), not only "use this point".
- **会話**
  - More scenes at N2 (12) and N1 (9).
  - A listening-first mode that plays what is said before showing it.
  - A wrong reply heard on tap with its why.
- **模試**
  - The mondai the blueprint lists and no generator makes:
    - 概要理解, 即時応答 and 統合理解 (N3–N1).
    - 発話表現 and 即時応答 (N5–N4).
    - 語形成 (N2–N1).
  - Carrier sentences for 漢字読み/表記. The generator's header plans
    them, and they would end the bare-prompt ambiguity this audit kept
    running into.
  - On the results screen, why the key is right and each distractor
    wrong (today it translates).
  - A full-length mock with the sectional pass marks.
- **Across modes**
  - A script that sends every voiced line to the engine's `/audio_query`
    and compares its moras with the kana: conversation, dictation, exam
    scripts. Run it before a content commit, or in CI with the engine
    container.
  - A user dictionary for the words the engine misreads in any context
    (暇, 角 as a corner). That needs `VOICE_REV` care.

## After deploying

- **Dictation.** Eleven lines changed their `jp`, so their clips have
  new names. Run `python -m scripts.revoice_audio --yes` (or
  `build_dictation_audio`); the old files are garbage.
- **Exam listening.** 105 clips were renamed by `reclip`. They are
  made on first request, or ahead of time by the same `revoice_audio`.
- **Conversation.** The rewritten lines are new clips in the grammar
  store: `python -m scripts.prewarm_all_audio --part conversation --yes`.
- **Seeds.** The comprehension and exam seeds are re-stored on import
  (`seed_key`): a seed paper nobody has sat is rewritten, one already
  sat is retired and stored anew.
