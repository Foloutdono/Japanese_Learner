# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

**Tsuji** (辻) — a Japanese-learning web app (kana, vocab, kanji, grammar, reading, listening, SRS review, mock exams, and a library of decks learners publish to each other). FastAPI backend + React/Vite frontend, Postgres storage, Supabase for auth.

The name is the glyph: 辻 is the masthead, the icon and the plate at the origin station (辻駅). `Tsuji` is the Latin half — the store name, the PWA `short_name` and the bundle id `app.tsuji`. See `DESIGN.md`, "The idea".

## Visual design

**Before touching any CSS or building any screen, read `DESIGN.md`.** It is the
single source of truth for the app's visual language: the station metaphor, the
pigment rules, the bilingual pairing, and the size/space/radius/tracking scales.

Two rules that cause the most damage when missed:

- **All CSS lives in `frontend/src/index.css`.** One file, on purpose. Do not
  create a per-feature stylesheet — that is how two features ended up inventing
  private spacing token families. Namespace your selectors instead
  (`.exam-*`, `.anl-*`, `.onb-*`).
- **Never invent a size, space, radius or tracking value.** Use the tokens in
  `:root`. If none fits, that is a design decision — raise it rather than
  adding a 95th font size.

See `DESIGN.md` for the full specification: colour families, type, surfaces,
space, motion, structure and the density contract.

## Plans

`plans/` is intentionally untracked — the plan documents are large and have no
runtime purpose. Two consequences worth knowing:

- **Plan numbers are cited in source comments** (e.g. "Plan 034" in
  `PassageLine.browser.test.jsx`), so they must never be reused.
- **`git ls-tree HEAD plans/` under-reports which numbers are taken**, because
  earlier plan files were lost to a working-tree cleanup. Numbers **001–086**
  are used: wave 14 (the mobile release) spends 064–077, the review rollup
  spends **078** — cited in `srs/srs.py`, `srs/data_structure.sql`,
  `routes/account.py`, `routes/stats.py` and `scripts/wipe_srs.py`, and for a
  while missing from the index here — wave 15 (the library) spends
  079–083, and **084** is the level-mix gate and the rows breakdown (cited
  in `routes/reading.py`, `study/level_mix.py` and `components/analysis/`;
  ADR 0015), and **085** is the statistics rework (cited in
  `routes/stats.py`, `srs/srs.py`, `domain/statsModel.js` and
  `components/stats/`), and **086** is study by radical (cited in
  `content/radical_info.py`, `routes/kanji.py`, `components/dictionary/RadicalIndex.jsx`
  and `components/selection/RadicalLesson.jsx`), and **087** is the grammar
  rework (cited in `content/grammar_points_data.py`, `study/grammar_check.py`,
  `study/modes.py`, `scripts/migrate_grammar_ids.py` and
  `components/study/GrammarLesson.jsx`; ADR 0016), and **088** is the words a
  kana is read in (cited in `study/kana_words.py`, `routes/dictionary.py` and
  `components/dictionary/DictionaryDetail.jsx`), and **089** is the entry-panel
  rework (cited in `routes/dictionary.py`, `routes/today.py`,
  `routes/decks.py`, `content/kana_strokes.py`, `study/daily_queue.py`,
  `components/dictionary/DictionaryDetail.jsx`, `components/study/gloss.jsx`
  and `components/study/GrammarLesson.jsx`; DESIGN.md, "The entry plate"),
  and **090** is a door in the entry panel opening the entry over the
  catalogue rather than moving the catalogue to it (cited in
  `screens/DictionaryScreen.jsx` and
  `components/dictionary/DictionaryDetail.jsx`), and **091** is the vocab
  deck's spreadsheet residue — Excel `#NAME?` glosses, and the part-of-speech
  notes that had displaced 34 entries' readings (cited in
  `content/vocab_renames.py`, `scripts/migrate_vocab_ids.py`,
  `tests/test_vocab_deck.py` and `tests/test_dictionary_vocab.py`),
  and **092** is the commercial LLM swap — paid providers, the per-call
  token accounting that replaces the estimates, the comprehension pool
  that stops the most expensive call being paid once per learner, and
  the daily ceilings on what one learner can generate
  (cited in `study/llm_shared.py`, `routes/reading.py`, `routes/ocr.py`,
  `scripts/llm_cost_model.py`, `scripts/llm_usage_report.py`,
  `scripts/prewarm_comprehension_pool.py` and `backend/.env.example`;
  `docs/llm-commercial-plan.md`),
  and **093** is the dictionary's favourites — a shelf of kept entries, a
  reference each rather than a copy (cited in `routes/favorites.py`,
  `hooks/useFavorites.js`, `domain/favorites.js` and
  `components/dictionary/DictionaryDetail.jsx`), and **094** is the gates'
  station plates — the Learn and Practice gates as a column of 駅名標,
  replacing the wall map and the platform grid (cited in
  `components/station/LinePlate.jsx`, `domain/lineProgress.js`'s
  `stopsAround`, `screens/LearnScreen.jsx`, `screens/PracticeScreen.jsx`
  and `index.css`; DESIGN.md, Structure), and **095** is the grammar
  breakdown rework — the grammar on the analyzer stage, the chip that
  says what its rule does, the rule lit where it sits, the detector's
  second pass by dictionary form (〜すぎる, 〜てみる, the passive,
  potential, causative, volitional and imperative, read off the
  tokenizer's conjugation fields rather than letters), and the deep
  tier's line per rule (the model is told which points the local tier
  found and asked what each does in the sentence; `phrase_analysis_cache`
  v4) — and, owner-directed after the first round: a particle or a
  copula is always a row of its own (`rows.js`), a marker survives
  inside a construction (the が of ことができます opens が), the
  constructions are listed under the rows with the words each is made
  of (`GrammarPoints.jsx`, replacing the chips there), and the practice
  modes fetch the local tier only and buy the explanation from an
  Explain button (`lib/explainSentence.js`) (cited in `study/morphology.py`,
  `study/grammar_detect.py`, `study/analysis.py`, `routes/phrase.py`,
  `scripts/prewarm_phrase_cache.py`, `components/analysis/GrammarChips.jsx`,
  `components/analysis/GrammarPoints.jsx`, `components/analysis/rows.js`,
  `components/analysis/grammarGloss.js`, `components/analysis/grammarSpans.js`,
  `components/analysis/StageCard.jsx` (since retired by plan 134),
  `components/analysis/SentenceBreakdown.jsx`,
  `components/analysis/PassageBreakdown.jsx`, `lib/explainSentence.js`,
  `screens/AnalyzerScreen.jsx`, `screens/ReadingRun.jsx`,
  `screens/TranslationRun.jsx` and `screens/DictationRun.jsx`),
  and **096** is the breakdown's doors — a word opens its dictionary
  entry rather than the deck-row sheet that was WordDetail (now
  deleted), the whole ROW is that door rather than the word in it (and
  the whole grammar-point row rather than its pattern), and the rows
  and the Explain button are sized for a thumb (cited in
  `components/analysis/lookup.js`, `components/analysis/SentenceBreakdown.jsx`,
  `components/analysis/GrammarPoints.jsx`, `components/ui/Loading.jsx`,
  `screens/AnalyzerScreen.jsx`, `screens/ReadingRun.jsx`,
  `screens/TranslationRun.jsx`, `screens/DictationRun.jsx`,
  `screens/ComprehensionRun.jsx` and `index.css`).
  **097–101** are wave 21, the first ride — the flashcard and
  reading rides after the boarding, the per-gate guide, and the day's
  ration of new cards on the daily queue (cited in
  `routes/onboarding.py`, `routes/profile.py`, `routes/today.py`,
  `core/events.py`, `core/pace.py`, `scripts/backfill_first_ride.py`,
  `study/daily_queue.py`, `tests/test_pass_platforms.py`,
  `screens/RideRun.jsx`, `screens/RideReading.jsx`,
  `screens/RidePreview.jsx`, `components/guide/`, `hooks/useGuide.js`,
  `stores/guide.js`, `components/reading/ReadingPieces.jsx`,
  `components/settings/HelpPage.jsx` (then `LearningPage.jsx`), `components/study/Readings.jsx`,
  `domain/paywall.js`, `lib/routePattern.js` and `index.css`; ADR 0017;
  DESIGN.md, "The spot and the note"; `docs/design/mobile/README.md`).
  **102–110** are wave 22, the vocab deck review — 102 (done) is 母 and
  父 as N5 cards and the compound fold in the breakdown (cited in
  `study/card_lookup.py`, `study/analysis.py`, `tests/test_analysis.py`
  and `tests/test_dictionary_vocab.py`), 103 (done) the measuring
  script (`scripts/audit_vocab_deck.py`, `tests/test_audit_vocab_deck.py`),
  104 (done) the lookup repairs (`card_lookup.resolve_morpheme`, cited
  in `study/card_lookup.py`, `study/level_mix.py` and
  `tests/test_card_lookup_variants.py`), 105 the demand list, in slices
  (the first, 24 cards, done; `scripts/audit_vocab_deck.py`'s
  `IGNORED_LEMMAS` records what was decided to be grammar instead),
  106 (done) readings and forms — three `MOVES` lines in
  `content/vocab_renames.py`, the deck's spelling filed under UniDic's
  lemma and the auxiliary position closed in `study/card_lookup.py`;
  106b (done) the 26 cross-level duplicates merged onto the lower card
  — the first `MOVES` that change a level, so `scripts/migrate_vocab_ids.py`
  moves `deck_cards.level` with the id — and the served-id snapshot
  `datas/vocab/vocab_served.json` (`audit_vocab_deck --write-snapshot`,
  held by `tests/test_vocab_deck.py`) that catches an id leaving the
  deck without a line, 107 (done) the French
  gloss per card (`translations.fr_gloss`, `tests/test_translations.py`),
  108 gloss hygiene (the mechanical half done: comma spacing, the
  export's capitals, the 対立 mojibake as a `MOVES` line; the rest to
  the content audit's slices), 109 the placement list — the two
  sources under `datas/vocab/sources/` (see the README there for the
  licences), `scripts/placement_report.py` and
  `tests/test_placement_report.py`, and `vocab_frequency.json` rebuilt
  in the ranking's order; its three candidate lists remain for the
  audit's slices, 110 (done) the pool taken out of the deck's way in
  place (`scripts/prune_pool_overlap.py`; a rebuild from another JMdict
  edition would renumber every pool card, so never that) and 110b (done)
  the learner's pool card onto the deck card
  (`datas/vocab/pool_moves.json`, `scripts/migrate_pool_cards.py`,
  `tests/test_migrate_pool_cards.py`).
  **111** is the pre-generated exercise pool, so a new learner's first
  tries cost no model call: the hand-written comprehension seeds under
  `content/comprehension/` (three per level, both languages, upserted
  into `comprehension_pool` at import on `seed_key`), the reading bank
  grown to cover every checkable grammar point, the dictation bank
  grown to thirty lines a level, and `scripts/prewarm_exam_papers.py`
  (cited in `content/comprehension_seed.py`, `routes/reading.py`,
  `content/reading_sentences.py`, `content/listening_clips.py`,
  `scripts/prewarm_comprehension_pool.py`, `scripts/prewarm_exam_papers.py`,
  `srs/data_structure.sql` and `tests/test_comprehension_seed.py`).
  **112** is one word, one card: the 23 kanji the kanji deck taught at
  two levels, and the ~360 vocab cards that were a lower card's word
  again under another spelling (終る/終わる, これ/此れ, いい beside
  いい/よい, the `川/河` packed fields), folded onto the lower card
  (cited in `content/kanji_renames.py`, `content/vocab_renames.py`'s
  `FOLDED_FORMS`, `scripts/migrate_kanji_ids.py`,
  `scripts/migrate_vocab_ids.py`, `scripts/audit_vocab_deck.py`'s
  `spelling_pairs`, `scripts/placement_report.py`, `study/card_lookup.py`,
  `routes/dictionary.py`, `routes/onboarding.py` and
  `tests/test_migrate_kanji_ids.py`; `docs/vocab-deck-review.md`).
  **113** is the desk (机) — numbered 113–115 because 112 went to the deck
  fold above while the desk was open — the computer's design, a second
  chrome at 1100px and up that never reaches the phone: the rail down the left
  edge in place of the HUD and the tab bar, the plates two by two, Today
  and the profile in two columns, Settings' list beside its page, sheets
  as centred dialogs, and the keys printed on a run; every desk rule in
  the last section of `index.css`, held there by `src/desk.css.test.js`
  (cited in `hooks/useDesk.js`, `components/chrome/DeskRail.jsx`,
  `components/chrome/Shell.jsx`, `components/chrome/Hud.jsx`,
  `config/tabs.js`, `components/guide/Guide.jsx`,
  `screens/ProfileScreen.jsx`, `screens/SettingsScreen.jsx`,
  `components/settings/pane.js`, `components/settings/SettingsPage.jsx`,
  `components/study/RatingBar.jsx`, `components/study/QuizComponents.jsx`,
  `vite.config.js` and `index.css`; ADR 0018; DESIGN.md, "The desk";
  `docs/design/desk/README.md`).
  **114** is the desk's second round, the screens laid out for the width —
  the canvas at `--desk-board-w` and a second column at `--desk-side-w`
  (`components/chrome/DeskSide.jsx`); Today's journey beside the gate
  (`components/journey/JourneyPanel.jsx`, `JourneyBody.jsx`); the
  dictionary's dock always open (`DictionaryLookupBody`); a station as two
  panes with each platform's figures (`components/selection/StationSplit.jsx`,
  `ModeFigures.jsx`, `domain/statsModel.js`'s `modeRow`) and the exam's
  grade in its URL; the statistics as one page (`hooks/useBoxWidth.js`,
  `components/stats/`); a run's side — the session panel and the revealed
  card's docked entry (`components/study/SessionPanel.jsx`, `entryDock.js`,
  `stores/runTally.js`, `stores/deskEntry.js`, `hooks/useReviewGates.js`),
  or a graded sentence's breakdown (`components/analysis/BreakdownSide.jsx`);
  the way up and the `/` key (`components/chrome/Bar.jsx`'s `Leave to`,
  `config/tabs.js`'s `onDeskRail`, `components/chrome/DeskRail.jsx`); a deck
  beside its platforms (`components/decks/DeckPlatforms.jsx`,
  `hooks/useDeckModes.js`) — every rule in the 机 section of `index.css`,
  and the phone's side held by `src/deskfree.phone.test.jsx` (DESIGN.md,
  "The desk"; `docs/design/desk/README.md`).
  **115** is the desk's third round (wave 26), the remaining second screens
  and sheets taken into the page: five phone bugs the audit found, each with
  its phone test (`exam/examService.js`'s `blankNumber`, `screens/ExamRunner.jsx`'s
  replace on finish, `lib/dialogOpen.js`, `stores/boarding.js`'s `returnsTo`
  with `hooks/useRunExit.js`, `screens/DictionaryScreen.jsx`'s page sequence);
  a run's side in its pigment and a breakdown's doors opening in it
  (`StudyStage.jsx`'s `RunSide`, `components/analysis/SideLookup.jsx`);
  comprehension beside its text (`screens/ComprehensionRun.jsx`,
  `domain/choiceKeys.js`, `domain/quotedFragments.js`); the stations' second
  screens folded — grammar points beside the lesson, theme bands and tiers
  beside their platforms, the deck's platform screen giving way
  (`GrammarLessonBody`, `ScopeFigures`, `statsModel.bucketRow`,
  `tiers.tierAtSize`); the mock exam's standing answer sheet, flat passage
  and review split (`exam/ExamCard.jsx`, `QuestionRenderer`'s `PassageText`);
  the library's shelf beside a deck and Browse docked
  (`components/decks/PublicDeckPage.jsx`, `hooks/usePublicDeck.js`,
  `BrowseCardsDock`); the analyser's dock, intake beside history and the
  dictionary's handoff (`components/analysis/AnalyzerDock.jsx`, since
  retired by plan 134,
  `lookup.tokenLookup`, `Bar.jsx`'s `DeskCrumb`); a run that fits a laptop and
  its misses at the end (`runTally.tallyMisses`, `SessionPanel`'s `done`); and
  the keys, the gates' last doors and the guide beside its anchor
  (`components/chrome/DeskKeys.jsx`, `hooks/useListWalk.js`, `LineFoot`'s legs,
  `Banzuke`'s `both`, `Guide.jsx`) — every rule in the 机 section of
  `index.css`, one desktop test file a phase and the phone's side in further
  blocks of `src/deskfree.phone.test.jsx` (DESIGN.md, "The desk";
  `docs/design/desk/README.md`; ADR 0018).
  **116** is the fare gate's lanes two across on the desk once the gate
  holds two at a phone's lane width (cited in the 机 section of
  `index.css`, `src/today.wide.test.jsx`, `src/today.desktop.test.jsx` and
  `src/deskfree.phone.test.jsx`; the evaluation is in `plans/README.md`).
  **117** is the desk's split rows as links: a level, a kana set, a theme
  band, a tier, a grammar point, a library deck or an exam question in a
  `StationSplit`'s list is a `<Link replace>` on the desk
  (`components/selection/SplitRow.jsx`), so the middle click, Ctrl/⌘-click
  and "open in new tab" work, while the phone keeps the button it always
  had — the row takes its URL from its caller (`RouteStops`' `linkTo`,
  through `LevelSelector` and `ThemeLevelSelector`; `GrammarIndex`,
  `TierSelector`, `LibraryCard`'s `to`), the exam review's open question
  moves into its URL (`screens/ExamResult.jsx`'s `?question=`), the list
  walk reads links and opens one on Space (`hooks/useListWalk.js`), and
  the link takes the button's face back in the 机 section of `index.css`
  (held by `src/splitRows.desktop.test.jsx`, which measures the two
  against each other, and a block of `src/deskfree.phone.test.jsx`).
  **118** is a radical's page on the desk as two panes, which plan 115
  deferred: the radicals index beside the lesson and its platforms, the
  open radical in gold and each platform figured from the family's own
  stats; another radical swaps the page by replacing the URL, the family's
  door swaps the index for the family in the list and back, and the bare
  index opens on its page's biggest family (cited in
  `screens/KanjiScreen.jsx`, `components/selection/RadicalLesson.jsx`'s
  `RadicalFamily`/`RadicalFamilyList`,
  `components/selection/RadicalSelector.jsx`'s `RadicalRedirect`,
  `components/dictionary/RadicalIndex.jsx`'s `selected`,
  `domain/radicals.js`, `index.css`, `src/radicals.desktop.test.jsx` and
  `src/deskfree.phone.test.jsx`; DESIGN.md, "The desk";
  `docs/design/desk/README.md`).
  **119** is the browse's side on the desk (numbered 119 because 116 went
  to the fare gate's lanes, 117 to the split's rows and 118 to a radical's
  page while it was open): the fast review
  (`components/study/ReviewDeck.jsx`) stands the revealed card's docked
  entry beside the card, with no tally because a browse rates nothing
  (`SessionPanel`'s `records={false}`, passed by `screens/KanaRun.jsx`,
  `screens/VocabRun.jsx` and `screens/KanjiRun.jsx`; held by
  `src/browse.desktop.test.jsx` and a block of `src/deskfree.phone.test.jsx`;
  DESIGN.md, "The desk").
  **120** is the desk's last dialogs (numbered 120 because 116–119 went
  to the gate's lanes, the split's rows, a radical's page and the browse
  while it was open): every sheet and modal the desk still opened, each
  either kept because it interrupts or moved into its page's column — a
  deck's More in its side (its deletion asked in a
  dialog of its own), a gate lesson's rival in a grammar run's side, the
  grab's walkthrough beside the analyser's intake, a kanji's readings in
  the entry's own place, the iOS install steps in the settings page —
  through one dock shell (cited in `components/chrome/DeskDock.jsx`,
  `components/decks/BrowseCardsMenu.jsx`, `screens/DeckDetailScreen.jsx`,
  `screens/GrammarRun.jsx`, `components/analysis/SideLookup.jsx`,
  `components/analysis/GrabTutorial.jsx`, `components/analysis/IntakeVideo.jsx`,
  `components/analysis/useBookmarkletCopy.js`, `screens/AnalyzerScreen.jsx`,
  `components/dictionary/DictionaryDetail.jsx`,
  `components/settings/DisplayPage.jsx`, `components/ui/InstallSheet.jsx`
  and `index.css`; held by `src/grammar.desktop.test.jsx`, blocks of the
  shelf, analyzer, dictionary and settings desktop tests and of
  `src/deskfree.phone.test.jsx`; DESIGN.md, "The desk";
  `docs/design/desk/README.md`, "Dialogs on the desk").
  **121** is 声, a voice the app is allowed to sell (numbered 121 because
  113–120 went to the desk while it was open): edge-tts replaced by a
  self-hosted VOICEVOX Nemo engine (a Render private service), the voice
  epoch that retires every clip an earlier voice made, a lone kana named by
  the engine's kana notation instead of read as text, and the kana deck
  regenerated from it (cited in `study/voice_engine.py`, `study/exam_tts.py`,
  `study/word_tts.py`, `study/exam_listening_gen.py`, `content/kana_data.py`,
  `scripts/build_kana_audio.py`, `scripts/audition_voices.py`,
  `scripts/revoice_audio.py`, `render.yaml`, `lib/audio/speech.js`,
  `lib/audio/playback.js`, `frontend/public/sounds/README.md` and
  `tests/test_voice_engine.py`; ADR 0019).
  **121b** is the owner's voices and a recorded kana voice: 女声6, 男声1 and
  女声1 over four slots (the reader, A, B and the exam narrator), 男声1 at
  0.9 (`VOICE_TEMPO`), and the importer that cuts the kana deck from
  小春音アミ's UTAU bank, with `kanas/sources.json` holding every clip's
  voice to its credit (cited in `study/voice_engine.py`, `study/exam_tts.py`,
  `study/word_tts.py`, `scripts/kana_bank.py`, `scripts/build_kana_audio.py`,
  `scripts/audition_voices.py` and `tests/test_kana_audio.py`; ADR 0020).
  **121c** is 波音リツ instead, for terms that ask for no credit, report or
  permission: the importer reads joined (連続音) banks by their oto.ini
  aliases, cuts each syllable from the start of a string and before the
  next sound, holds a long vowel by repeating its steady end in phase, and
  takes あい/おい from the singer's own glide — and then, on his real
  banks, onsets found by walking back from the vowel (past the room
  noise), an exact `--pitch` folder, long vowels joined into the notes he
  held, and the set imported from 強連続音 A3 (cited in
  `scripts/kana_bank.py`, `scripts/build_kana_audio.py`,
  `tests/test_kana_audio.py`, `domain/attributions.js` and
  `lib/audio/playback.js`; ADR 0020).
  **122–123** are wave 28, the desk's fourth round (numbered 122 because
  121 went to 声 while its audit was open). **122** is 正面口, first contact
  drawn for a computer as a run's frame: the Welcome with the sign-in
  beside Board (`AuthCard`, no second screen on the desk), the boarding
  centred beside the journey it builds (`BuildSteps` over
  `domain/boarding.js`'s `boardingDraft`, Building skipped), the first
  ride's side, and Enter and the digits from the Welcome to the first card
  (`hooks/useBoardKeys.js`, `domain/choiceKeys.js`'s `PICK_KEY_DIGIT`)
  (cited in `App.jsx`, `components/account/AuthCard.jsx`,
  `components/boarding/`, `screens/BoardingFlow.jsx`, `screens/AuthScreen.jsx`,
  `screens/RideRun.jsx`, `screens/RideReading.jsx`, `index.css` and the
  `frontdoor` and `ride` tests). **123** is 作業, the workspace: eleven phone
  bugs, each in its own commit with its own phone test; Esc's owner
  (`stores/escHold.js`, `DeskKeys`' `pressedByPointer`); a run's foot
  under its card and the workspace centred on a wide window
  (`--desk-run-inset`); Enter through practice; the guide on its anchor;
  the kept dialogs drawn for a desk (`Sheet`'s `initialFocus` and
  `dismiss`); one walk for every list (`hooks/useListWalk.js`,
  `useGridWalk.js`); places as links (`SplitRow`'s `push`); radio groups
  (`hooks/useRadioWalk.js`); the column's doors (`DeskDock`'s focus
  contract, the card form docked); and the pointer, copy and printed keys
  (cited across `components/`, `screens/`, `hooks/`, `lib/keyGuards.js` and
  `index.css`, and held by the desktop, wide and phone tests named in
  `docs/design/desk/README.md`; DESIGN.md, "The desk"; ADR 0018).
  **124** is 操作盤, the run's console on the desk (wave 29; numbered 124
  because 122–123 went to wave 28 while it was open): a card run's floor
  as one console of two rows across the stage — the rating tiles' row
  fixed above the level bar, the bar holding this run's three figures
  beside the fare — the card grown to it, the side the entry's place
  with the misses listed during the run (cited in
  `components/chrome/LevelBar.jsx`, `components/study/StudyStage.jsx`'s
  `records`, `components/study/RunRecords.jsx`,
  `components/study/SessionPanel.jsx`, `src/console.desktop.test.jsx`
  and the 机 section of `index.css`; DESIGN.md, "The desk").
  **125** is 作文, composition (wave 30; numbered 125 because 124 went to
  the console in a parallel session): a sixth practice platform, where
  the learner is handed a grammar point and writes a sentence that uses
  it — the detector's word on whether the point is there
  (`study/grammar_detect.py`'s `can_find`, trusted only where it finds
  the point in its own lesson), the tutor's review in the shape
  translation's tutor answers in, moved to `study/tutor_review.py` and
  drawn once by `components/study/TutorReview.jsx`, rationed by the day
  through the first shared daily counter (`core/daily_limit.py`,
  `daily_usage`), and the learner's own rating as the grade (ADR 0013)
  (cited in `routes/composition.py`, `core/daily_limit.py`,
  `study/tutor_review.py`, `study/grammar_detect.py`,
  `scripts/llm_cost_model.py`, `components/study/TutorReview.jsx`,
  `screens/CompositionRun.jsx`, `config/tabs.js`, `domain/paywall.js`,
  `src/composition.desktop.test.jsx` and `index.css`; DESIGN.md, "The
  primary button"; `docs/llm-commercial-plan.md`).
  **126** is 三面, the run on three panels (wave 31; numbered 126 because
  125 went to composition while the console's follow-up was drawn): a
  card run on the desk laid out as the owner drew it — this run and the
  card panel (the card's state, every verdict as a tile with when it
  comes back, the keys, the rhythm; no captions, by the owner's cut) on
  the left, the card with its tiles framed and unlit before the reveal
  in the middle, the card's details sealed then in their band on the
  right — replacing plan 124's console, with the forecast on every
  card's `review_preview` (`due_in` per quality)
  (cited in `srs/srs.py`, the five routes' `_build_review_preview`,
  `tests/test_review_forecast.py`, `components/study/StudyStage.jsx`,
  `components/study/RunPanel.jsx`, `components/study/CardPanel.jsx`,
  `components/study/SessionPanel.jsx`, `components/study/runPanels.js`,
  `components/study/RatingBar.jsx`, `components/dictionary/DictionaryDetail.jsx`,
  `domain/forecast.js`, `stores/runTally.js`, `src/panels.desktop.test.jsx`
  and the 机 section of `index.css`; DESIGN.md, "The desk").
  **127** is 定期券, the pass at the rail's foot (wave 32): the desk
  rail's foot drawn five ways and the owner's pick built — the HUD's
  three instruments as one card, the learner's commuter pass, with the
  HUD's three doors on it (the face with the level's climb, the purse
  with what the balance counts or when it comes back, the stub with the
  journey's word) and its edge the balance's (cited in
  `components/chrome/DeskPass.jsx`, `components/chrome/hudStatus.js`,
  `components/chrome/DeskRail.jsx`, `components/chrome/Hud.jsx`,
  `components/guide/guides.js`, `src/chrome.desktop.test.jsx`,
  `src/today.desktop.test.jsx`, `src/focus.desktop.test.jsx`,
  `src/deskfree.phone.test.jsx` and the 机 section of `index.css`;
  DESIGN.md, "The desk").
  **128** is the dictionary as two columns on the desk (wave 33; numbered
  128 because 127 went to 定期券 while it was open), the layout the
  owner chose from four rendered options: the catalogue (the analyser's
  door, the console, the results) in one column and the entry beside all
  of it from the page's top at `--desk-entry-w` (440px), never past the
  window's foot, so a character's entry reads whole with no scroll — its
  plate laid across, the stroke sheet in one row, the record four across
  — while a word's plate stays stacked and its senses scroll in the
  column; and the grammar collection with the split turned round (the
  owner's second pick), its points a list in the side column and the
  entry across the page, the lesson in two columns; and the kana charts
  whole on one screen (the owner's pick of four more), three columns,
  unmarked, each cell marked with the learner's stage (cited in
  `screens/DictionaryScreen.jsx`'s `DeskColumns`, `SyllabaryGrid` and
  `SyllabaryTable`, the 机 section and `:root` of `index.css`,
  `src/dictionary.desktop.test.jsx`, `src/dictionary.wide.test.jsx`,
  `src/testing/grammarPoints.json`, `src/testing/kanaRows.json` and
  `src/deskfree.phone.test.jsx`; DESIGN.md, "The desk";
  `docs/design/desk/README.md`).
  **129** is 三面・実践, the practice runs on three panels (wave 34; numbered
  129 because 128 went to the dictionary while it was open): reading,
  translation, dictation, composition and comprehension on plan 126's
  columns, the left panel the run's lines -- every sentence so far with
  its grade, each reopening its breakdown -- the breakdown, lesson or
  text sealed at the right until the grade, the floor one framed row, the
  keys in the lines; the mock exam keeps its paper; and the place of a
  desk-only chatbot recorded, built by plan 131 (cited in
  `components/study/RunLines.jsx`, `components/study/sentenceLines.js`,
  `hooks/useRunLines.js`, `components/analysis/BreakdownSide.jsx`,
  `components/chrome/DeskKeys.jsx`'s `KeyCap`, `stores/runTally.js`,
  `hooks/usePracticeXp.js`, the five `screens/*Run.jsx`,
  `src/lines.desktop.test.jsx` and the 机 section of `index.css`;
  DESIGN.md, "The desk").
  **130** is the plated gates taking the window on the desk (wave 35;
  numbered 130 because 129 went to the practice runs while it was open),
  the owner's pick of three options rendered on the real screens: the
  plates fill the window's height, a Learn line is drawn upright with a
  row per level (its rail, its ring, a bar of learned and met, learned /
  total), and a Practice platform's grades are rows carrying the
  learner's record at each grade — sentences, texts or papers done and
  the share right — from `GET /api/practice/record`, read from the six
  practice logs; Practice goes three across once three hold a French
  name; both feet are lists walked with ↑/↓ (cited in
  `routes/practice.py`, `tests/test_practice_record.py`,
  `components/station/LinePlate.jsx`'s `LineFoot`,
  `screens/PracticeScreen.jsx`'s `GradeRows`, `stores/practiceRecord.js`,
  `src/gates.desktop.test.jsx`, `src/gates.wide.test.jsx`,
  `src/deskfree.phone.test.jsx` and the 机 section of `index.css`;
  DESIGN.md, "The desk"; `docs/design/desk/README.md`).
  **131** is 問, the asking (wave 36; numbered 131 because 130 went to
  the gates while plan 129 was in review): the desk-only chat of the
  practice runs, "limited to small questions and only precise answers" —
  one short question about the exercise just graded, answered in three
  sentences from what is on the three panels, in the lower half of the
  run's lines panel, sealed until the grade, a thread per sentence, a
  question off the exercise declined, forty a day through
  `daily_usage` (`ASK_DAILY_LIMIT`), nothing the learner typed kept
  (cited in `routes/ask.py`, `tests/test_ask.py`,
  `tests/test_pass_platforms.py`, `scripts/llm_cost_model.py`,
  `components/study/AskPanel.jsx`, `hooks/useAsk.js`, `domain/ask.js`,
  `components/study/RunLines.jsx`, the five `screens/*Run.jsx`,
  `src/ask.desktop.test.jsx` and the 机 section of `index.css`;
  DESIGN.md, "The desk"; `docs/llm-commercial-plan.md`).
  **132** is 棚, the shelf and the library beside the lines on the desk
  (wave 37; numbered 132 because 131 went to the asking while it was
  open), the owner's pick of three drawn layouts: the Learn gate's
  four lines in one column, each drawn across its plate, beside a column
  holding the learner's decks over the library's most followed or newest
  (Follow on each, a search, a row opening the deck's preview in place);
  the library's three sections beside its list — À la une, Abonnements
  with the cards added since a followed deck was last opened
  (`deck_subscriptions.seen_at`), and Tes publications with followers by
  week — from `GET /api/decks/library/home`; and the library as a rail
  station (cited in `routes/decks.py`, `srs/data_structure.sql`,
  `tests/test_deck_library.py`, `components/decks/GateShelf.jsx`,
  `components/decks/LibraryHome.jsx`, `components/decks/PublicDeckPage.jsx`,
  `components/station/LinePlate.jsx`, `screens/LearnScreen.jsx`,
  `screens/LibraryScreen.jsx`, `screens/DecksScreen.jsx`, `config/tabs.js`,
  `components/chrome/DeskRail.jsx`, `src/learnShelf.desktop.test.jsx`,
  `src/gates.desktop.test.jsx`, `src/shelf.desktop.test.jsx` and the 机
  section of `index.css`; DESIGN.md, "The desk").
  **133** is the first ride redrawn for the runs as they are now
  (numbered 133 because 131 went to 問 and 132 to the Learn gate's shelf
  while it was open): on a
  phone the known card, once turned, is graded only after its entry has
  been opened from the 🔍 and closed (`known-dict`, told through
  `components/study/lookupWatch.js`); on the desk both rides stand on
  the runs' three panels (plans 126, 129) and the gates' guide, handed
  its stops (`components/guide/rideTours.js`), walks every panel -- the
  cards before the first turn and after it, the reading before its
  clock and after the grade, which opens the sentence's breakdown; the
  ride's cards carry a new card's forecast for the verdict tiles (cited
  in `routes/onboarding.py`, `tests/test_ride.py`, `screens/RideRun.jsx`,
  `screens/RideReading.jsx`, `components/guide/Guide.jsx`,
  `components/guide/Callout.jsx`, `components/study/QuizComponents.jsx`,
  `components/study/CardPanel.jsx`, `components/study/RunPanel.jsx`,
  `src/ride.desktop.test.jsx` and `src/ride.phone.test.jsx`).
  **134** is the analyser's video Passage on three columns on the desk
  (wave 38), the owner's pick of the drawn options (B, the sentence as
  the video's subtitle; G2, the grammar numbered; every piece of the
  player) laid out on the owner's own wireframe: the sentences over the
  numbered grammar on the left; the video, the subtitle and the bar as
  one sumi object in the middle, the words list beside the card in
  focus and Explain under them; the card in focus in the runs' band
  (plan 126) on the right, the explanation swapped into its
  description's place -- the desk's rail stepping aside so the three
  have the window. The bar, one row: the sentence before and after,
  replay, loop, a stop at each sentence's end, one plain track, speed,
  mute, follow and fold. Under the desk the result is the owner's second
  drawing: the way back and keep, the video with a trimmed bar (the
  sentence before and after, play, the track, replay, loop), the
  subtitles -- the next sentence over the current one, the previous
  under it -- the numbered grammar and Explain; a word or a point
  tapped opens its dictionary card and Explain the explanation, both
  in the dictionary's sheet (`ExplainSheet`). No colour legend and no
  printed keys at any width. Resets keyed on the Passage's text, so an
  explanation arriving no longer moves the word in focus (cited in
  `screens/AnalyzerScreen.jsx`, `components/analysis/SubtitleLine.jsx`,
  `PlayerBar.jsx`, `WordsList.jsx`, `FocusCard.jsx`, `ExplainPanel.jsx`,
  `GrammarPoints.jsx`, `tokens.js`, `useLight.js`, `grammarSpans.js`,
  `components/video/VideoPlayer.jsx`, `components/ui/Icons.jsx`,
  `src/analyzer.desktop.test.jsx`, `src/analyzer.wide.test.jsx` and the
  机 section of `index.css`; DESIGN.md, "The desk").
  **135** is 区間, the fare gate taking the hall on the desk (numbered
  135 because 134 is the analyser's video passage, open on its branch;
  the owner's pick A·2 of the Today canvas): the gate at the window's
  height, a band per line (its switch beside its lanes as tiles, the
  chips gone), the run's length — 20 / 50 / 100 / all — dealt over the
  lanes the way the queue deals and handed to the run as `quota`, which
  the server cuts each lane to (`daily_queue.parse_quota`/`keep_quota`),
  what the run will take from the learner's pace
  (`srs.get_review_pace`, `seconds_per_review` on `/api/today`), each
  lane's share and whether it boards, the fare beside Depart, and the
  week ahead at the side column's foot (`GET /api/today/forecast`,
  `components/journey/WeekAhead.jsx`, `stores/forecast.js`,
  `stores/gateRun.js`); plan 116's two lanes across retired (cited in `routes/today.py`,
  `srs/srs.py`, `study/daily_queue.py`, `tests/test_today_take.py`,
  `components/station/GateCard.jsx`'s `DeskGate`, `domain/lanes.js`'s
  `splitTake`, `screens/TodayRun.jsx`, `src/today.wide.test.jsx`,
  `src/today.desktop.test.jsx`, `src/domain/lanes.test.js` and the 机
  section of `index.css`; DESIGN.md, "The desk").
  **136** is 帳, the analyser's passages first (the owner's pick C of
  three directions drawn on the canvas "Tsuji analyser — the intake"):
  the history became the page — on the desk the one console (the kinds
  held as chips, Kept, a search) over a card per passage, a video's still
  and first sentence (`firstLine` on `GET /api/video/sessions`), and the
  intake the column beside it, the video's a column with one filled
  action (the fetch, else the bookmark's setup until it has been used,
  else the video on YouTube) and a file dropped anywhere on the page
  taken; under the desk one line over a row per passage, a YouTube link
  pasted there going to the video sheet, the photo intake a sheet too
  (cited in `routes/video.py`, `tests/test_video.py`,
  `screens/AnalyzerScreen.jsx`, `components/analysis/PassageShelf.jsx`,
  `passages.js`, `EntryLine.jsx`, `IntakeVideo.jsx`, `VideoStill.jsx`,
  `lib/youtube.js`, `hooks/useGridWalk.js`, `public/privacy.html`,
  `src/analyzer.desktop.test.jsx` and `index.css`; DESIGN.md, "The desk").
  **137** is the stations filled and Vocabulary's sources as plates
  (numbered 137 because 136 went to the analyser's passages while it was
  open), the owner's picks A and S2 of the station screens canvas: a line's station
  on the desk (a kana set, a JLPT level of vocab, kanji or grammar) takes
  the window — each stop with the first things it teaches and its bar,
  each platform with the card it asks in a well where the page is wide
  enough (`domain/specimen.js`), the fast review and grammar's points at
  the foot, no sub in the bar — and /learn/vocab on the desk is three
  plates, JLPT, frequency and themes, each with its whole list (cited in
  `routes/station.py`, `routes/frequency.py`'s `tiers/started`,
  `tests/test_station_samples.py`, `stores/stationSamples.js`,
  `components/selection/LinePlatforms.jsx`, `VocabSources.jsx`,
  `RouteStops.jsx`, `LevelSelector.jsx`, `ModeSelector.jsx`,
  `ModeFigures.jsx`, the four line screens, `src/lineSplit.wide.test.jsx`,
  `src/lineSplit.desktop.test.jsx`, `src/vocabSources.desktop.test.jsx`,
  `src/deskfree.phone.test.jsx` and the 机 section of `index.css`;
  DESIGN.md, "The desk").
  **138** is 路線別, the statistics as the four lines (numbered 138
  because 136 went to the analyser's passages and 137 to the stations
  while it was open), the owner's pick B of four drawn directions: a
  strip of four figures — retention with its line, drawn in days while
  there are three weeks or fewer (`retentionSeries`), the reviews behind
  the asked stop, the misses, the ladder — over a plate per line with
  its retention, its grid of exercise by deck with the leak in red
  (`lineGrids`) and its most-missed cards, which `/api/stats/report` now
  ranks per line (`srs.get_weakest_by_source`, `WEAKEST_PER_LINE`)
  (cited in `routes/stats.py`, `srs/srs.py`,
  `tests/test_stats_report.py`, `domain/statsModel.js`,
  `components/stats/`, `screens/StatsScreen.jsx`,
  `src/testing/statsRecord.js`, the `stats` desktop, wide and phone
  tests and `index.css`; DESIGN.md, "The desk").
  **139** is 設定, Settings as the pass's contract (the owner's pick of
  B and C on the canvas "Settings rework — options", with the titles off
  on the desk): Settings opens on the pass printed with its contract —
  the level → the destination, the service, the daily ride, the lines,
  the validity — each field a door to its page, the daily pace one field
  where it was two pages' cards; under it a list whose rows draw what they
  are set to; pages that draw what they set (each stop ahead dated, each
  service a line on one time axis with the learner's own pace dashed, the
  themes as screens, the three rating bars as the bar); Learning split
  into Level, Lines, Rating and Help, Data folded into Account (the old
  addresses land where their content went), Sign out once; on the desk
  the column beside a page that takes the width in two columns of cards,
  neither printing a title (cited in `screens/SettingsScreen.jsx`,
  `components/settings/`, `components/study/RatingBar.jsx`'s `specimen`,
  `components/profile/CommuterPass.jsx`'s `PassHead`,
  `src/settings.phone.test.jsx`, `src/settings.desktop.test.jsx` and
  `index.css`; DESIGN.md, "The desk" and Structure).
  **140** is 路線, first contact on the desk as the rail being laid
  (numbered 140 because 139 went to Settings while it was open; the
  owner's pick A of three directions drawn on the canvas "Desktop
  onboarding — options"): a sumi column on the left with the rail's
  masthead, the sign-in in it on the Welcome and, through the boarding,
  the line itself — a named stop per question printing its answer, the
  one asked lit with the pick as it stands, a stop behind a door back to
  its question, the projection at its foot and then the pass; the head's
  track and the right-hand journey retired; Back on the floor beside
  Continue; the answers laid for the width (the reasons three across,
  the kana and the rhythm four, the level and the goal as a line of
  stations with the ride lit to the pick); and the pass's screen folded
  into the plan, which enters the station (cited in
  `components/boarding/DeskLine.jsx`, `boardBack.js`, `BoardFrame.jsx`,
  `LevelStep.jsx`, `KanaStep.jsx`, `PlanStep.jsx`, `AccountStep.jsx`,
  `PassStep.jsx`, `countUp.js`, `Welcome.jsx`, `screens/BoardingFlow.jsx`,
  `src/frontdoor.desktop.test.jsx`, `src/frontdoor.wide.test.jsx` and the
  机 section of `index.css`; DESIGN.md, "The desk").
  **141** is 補充, the refill filling through the day (numbered 141
  because 139 went to Settings and 140 to the desk's first contact while
  it was open): the free pass's thirty credits a day no longer land in
  one go at the learner's midnight but one every 48 minutes (`REFILL_EVERY`), counted from
  `user_profiles.credits_accrued_at`, never past the cap, a full tank
  banking nothing; what has landed is `pending` until claimed (`POST
  /api/credits/claim`, one `refill` row), and a fare claims it first so
  it is never a refusal; the app opens a "while you were away" sheet on
  arrival -- boot, or back in front after `AWAY_MS` out of sight -- with
  the credits, the 回数券 book (the cap as a stub a credit: held, landed,
  room; the owner's pick C of four drawn directions) and a Claim
  button, centred on the desk at a column's width rather than at the
  rail's foot, and claims quietly as each credit lands while it is
  open (cited in `core/credits.py`,
  `routes/credits.py`, `routes/profile.py`, `srs/data_structure.sql`,
  `tests/test_credits.py`, `stores/credits.js`, `hooks/useRefill.js`,
  `components/credits/ClaimSheet.jsx`, `domain/credits.js`, the balance
  sheet, line and run-out sheet, `GateCard.jsx`, `DeskPass.jsx`,
  `PassStep.jsx`, `App.jsx`, `index.css`, `src/claim.desktop.test.jsx`
  and `docs/design/desk/README.md`).
  **142** is 改札鋏, the level-up clipped on the pass (numbered 142
  because 139 went to Settings, 140 to the desk's first contact and 141
  to the refill while it was open; the owner's pick D of four directions
  drawn on the canvas "Tsuji — the level-up": the board retimed, a
  station plate, the in-car route, the pass): the learner's 定期券 comes
  down in its own material, the gate's punch bites its top edge (a mask
  grown through a registered length, the chip falling away), the old
  figure is struck and the new one printed in gold, and the balance
  empties to the new level's start; on a phone it hangs across the top
  and the stage steps down, wider it floats at the right, and on the
  desk StudyStage portals it into the top of a run's column -- the left
  one on three panels -- which steps down under it; the split-flap board
  and `SplitFlap.jsx` retired, the board's clatter replaced by the
  punch's voice (`pass-clip`) (cited in `components/rewards/XpToast.jsx`,
  `components/study/StudyStage.jsx`, `domain/rewardTier.js`,
  `hooks/useReviewGates.js`, `lib/audio/voices.js`, `lib/audio/chimes.js`,
  `lib/audio/settings.js`, `screens/RewardsPreview.jsx`,
  `src/runs.wide.test.jsx`, `src/deskfree.phone.test.jsx`, `index.css`
  and its 机 section; DESIGN.md, "Rewards" and "The desk").
  **143** is 定期入れ, the profile tightened (numbered 143 because 140
  went to the desk's first contact, 141 to the refill and 142 to the
  level-up while it was open; the owner's pick A of three directions
  drawn on the canvas "Tsuji profile — options", for the phone and the
  desk alike): the same inserts in a third less of the phone's
  height — the XP ring gone from the holder's initial (the balance row's
  bar is the climb) and the month the pass was issued under the name
  (`onboardedAt`), the footer the door to the balance sheet and the
  profile's own offer button and paywall source retired, the stamp book
  titled with its month over three figures in one row, the records three
  across with the best perfect run, the lines a row each on one subgrid,
  the doors to Statistics and Settings a lattice of their own straight
  under the pass (the owner's follow-up), five on the ranking; on the
  desk each line drawn with a rail per stop and no door the rail already
  holds, the guide's Settings stop on the rail's station
  (cited in `screens/ProfileScreen.jsx`, `components/profile/PassHolder.jsx`,
  `ProfileBlocks.jsx`, `LineLedger.jsx`, `components/boarding/PassStep.jsx`,
  `config/tabs.js`, `components/chrome/DeskRail.jsx`,
  `components/guide/guides.js`, `domain/paywall.js`, `stores/credits.js`,
  `backend/core/events.py`, `src/profileScreen.phone.test.jsx`,
  `src/profile.phone.test.jsx`, `src/profile.desktop.test.jsx` and
  `index.css`; DESIGN.md, Colour, Surfaces and "The desk").
  **144** is the two cutscenes, from the canvas "Tsuji — gate & door
  cutscenes". 扉, the train door unlocked and parted (the owner's pick A
  of three directions drawn beside the shipped door): the door fades in
  over the menu while the view settles onto it, a lamp over the seam
  blinks in the line's pigment with the chime, the leaves crack apart
  before they slide and finish their travel, and the header and the
  sill step off the screen last, so nothing fades over the run; 920ms
  where it was 1092. 改札, the ticket gate's look (the owner kept its
  motion over six drawn alternatives and asked only for a better look;
  every beat unchanged): the rig with a margin on a phone, the pillars
  as cabinets with their lamps on the lane side, a sumi reader that
  rings, flaps with a lit leading edge, a glow with no visible rim over
  a floor and a horizon, and the pass in its own material with its
  mark and balance (cited in
  `components/station/TrainDoor.jsx`, `components/station/TicketGate.jsx`,
  `src/cutscenes.phone.test.jsx` and the 扉 and 改札 blocks of
  `index.css`).
  **145** is Settings' pages using the width on the desk (numbered 145
  because 144 went to the two cutscenes while it was open): the slips in
  rows of two that end level instead of two free columns (`SlipRow`,
  `.stg-pair`), every card to the page's edge, a card of one action
  across the page with its action in the right half (`Slip`'s `across`),
  the guest's claim as two ways side by side, the presets over a mixer
  on one subgrid, and the level's stops named (cited in
  `components/settings/SettingsPage.jsx`, `AccountPage.jsx`,
  `DataSlips.jsx`, `DisplayPage.jsx`, `SoundPage.jsx`, `LevelPage.jsx`,
  `ServicePage.jsx`, `src/settings.desktop.test.jsx`,
  `src/columns.wide.test.jsx` and the 机 section of `index.css`;
  DESIGN.md, "The desk").
  **146** is the grammar lesson made readable (numbered 146 because 144
  went to the gate and door cutscenes, PR #213, and 145 to Settings'
  pages on the desk, PR #214, while it was open):
  first its two columns on the desk each its own (the dictionary's
  grammar page set the lesson as one flow in CSS columns, balanced
  wherever the heights fell, and now sets it as a grid — the rule, its
  uses and its trap on the left, the sentences over the rivals on the
  right, one column on the narrow desk), then the owner's pick B of three drawn directions, at every
  width: the rule as the lead, a hairline between steps, the Japanese
  in the prose set as Japanese and never cut, a use as its saying over
  its forms and a paradigm as labels beside forms (read by
  `components/study/lessonText.js`), the sentences numbered with a
  register tag where one departs from its point, and furigana over the
  word (cited in `components/study/GrammarLesson.jsx`,
  `components/study/lessonText.js`, `components/dictionary/ExampleSentence.jsx`,
  `index.css` and its 机 section, `src/components/study/lessonText.test.js`,
  `GrammarLesson.browser.test.jsx`, `src/contrast.browser.test.jsx`,
  `src/dictionary.wide.test.jsx` and `src/dictionary.desktop.test.jsx`;
  DESIGN.md, "The entry plate, and a body that names itself" and "The
  desk").
  **147** is the card's progress (the owner's picks D, M2 and P2 of the
  drawn options): every served card carries `progress`, 0 (new) to 1
  (mastered) -- the four learning steps the first half, a graduated
  card's interval the second on a log scale to 21 days
  (`srs._progress`, `get_bulk_progress`, `attach_progress`), and each
  rating's `review_preview` where it leaves the card; a band along the
  card's foot in the stage's pigment (`CardBand` in `StageMark.jsx`,
  moved by the stamp as a rating presses), and the desk card panel's
  line redrawn as a fare strip of three stretches (`CardPanel`'s
  `StateLine`, `domain/cardProgress.js`'s `stripFills`) (cited in
  `srs/srs.py`, the eight card routes, `tests/test_card_progress.py`,
  `components/study/StageMark.jsx`, `CardTransition.jsx`,
  `CardPanel.jsx`, `hooks/useReviewGates.js`, `hooks/useCardSession.js`'s
  v8, `src/cardBand.phone.test.jsx`, `src/panels.desktop.test.jsx` and
  `index.css`).
  When starting a new wave, begin at **148** or higher, and check
  `plans/README.md`. Its wave index is the authority, but it has been behind
  reality before: grep the source for `plan 0NN` before claiming a number.

## Commands

### Backend (`backend/`)
```bash
cp .env.example .env          # then fill in DATABASE_URL / DEV_USER_ID
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
pytest                        # run all tests
pytest tests/test_scheduler.py            # single file
pytest tests/test_scheduler.py::test_name # single test
```

### Speech — the voice engine (plan 121, ADR 0019)

Every voice the server makes (exam listening, dictation, the `/api/tts` card
readings) and the kana deck's clips come from a **self-hosted VOICEVOX Nemo
engine**, reached over HTTP by `study/voice_engine.py`. On Render it is the
`voicevox-nemo` private service in `render.yaml`, in Frankfurt beside the
backend, and the backend's `VOICEVOX_URL` is its internal address
(`host:port`). Locally, run the same image and
set `VOICEVOX_URL=http://localhost:50121` in `backend/.env`:

```bash
docker run -d --name voicevox-nemo -p 127.0.0.1:50121:50121 voicevox/voicevox_nemo_engine:cpu-0.23.0
```

Port **50121**, not VOICEVOX's usual 50021. Without an engine nothing breaks:
listening sections are skipped (before any model call is paid for), dictation
and `/api/tts` answer 503, and the tests never need one.

The licence's one condition is the credit **"VOICEVOX Nemo"** (Credits page
and `THIRD_PARTY_NOTICES.md`). It also **forbids using the audio for machine
learning**: never publish a generated clip as, or feed it into, a dataset.

**Changing the voice is a code change, not an env var**: edit
`voice_engine.DEFAULT_VOICES` (plan 121b, the owner's choice: slot 0, the
reader of words, dictation and lone kana, is 女声6; 1 and 2 are dialogue
speakers A, a woman, 女声6, and B, a man, 男声1; 3 is the exam narrator,
女声1) or a voice's pace in `VOICE_TEMPO` (男声1 speaks at 0.9), and bump
`VOICE_REV` in `voice_engine.py` **and** `lib/audio/speech.js`
(`tests/test_kana_audio.py` holds them equal). A clip made before the current
revision is never served; it is remade in place, under the name
`dictation_log`/`exam_papers` already store. Then run `revoice_audio`
(below) so nobody waits for it.

```bash
python -m scripts.audition_voices                 # every voice, as a sample file each
python -m scripts.audition_voices --roles 女声6,女声6,男声1,女声1  # one exam item: reader,A,B,narrator
python -m scripts.audition_voices --tempo 男声1   # one voice at four speeds, for VOICE_TEMPO
python -m scripts.build_kana_audio --check        # kana clips missing, stray, off-spec or unsourced
python -m scripts.build_kana_audio --force        # remake frontend/public/sounds/kanas/ on the engine
python -m scripts.build_kana_audio --from-bank datas/kana_source/ritsu/strong --pitch A3 --credit namine-ritsu --force
```

The kana clips are committed, and `kanas/sources.json` records which voice
made each one, as its row id in `domain/attributions.js`;
`tests/test_kana_audio.py` fails on a voice without its Credits row and
`THIRD_PARTY_NOTICES.md` section. The deck is cut from a recorded voice,
波音リツ's UTAU bank 強連続音 Ver1.5.1 at A3 (plan 121c, ADR 0020,
`scripts/kana_bank.py`), whose terms ask for no credit, report or
permission (the app credits him anyway). The owner chose it by ear, as
"good for now": a better kana voice is a known follow-up. To remake it,
unzip `https://www.canon-voice.com/voice/r73_strong_ren0151.zip` (names in
Shift_JIS) under `backend/datas/kana_source/ritsu/strong/`, which is
gitignored, and run the `--from-bank … --pitch A3` line above; a trial
set for listening goes to `--out datas/kana_source/trial-…`. A remade set
needs a new `KANA_REV` in `lib/audio/playback.js` (`ritsu1` now), or
returning learners keep the old one for a year.

The one optional warm-up, and it needs no database:

```bash
python -m scripts.build_dictation_audio --check   # what is missing
python -m scripts.build_dictation_audio           # synthesize it
```

書取 (dictation, `/practice/dictation`) plays a clip per line of
`content/listening_clips.py`. Nothing depends on having run this — a missing
clip is synthesized on the request that wants it, and again by
`study/exam_audio_repair.py` if the file is later lost — but the first learner
of the day otherwise waits for five syntheses on the voice engine before the
screen can show anything. Running it twice costs nothing: a clip the current
voice already made is skipped without a call to the engine.

**Changing `study/dictation.RATE` renames every clip in the collection**, and
deliberately: the speaking rate is part of the audio's content key, so a clip
read at a new speed is a new file. The old ones become garbage the next run of
`prune`-nothing will collect — delete `datas/exam_audio/*.mp3` (or the mounted
`EXAM_AUDIO_DIR`) by hand after such a change, then re-run the script.
Local Postgres (schema is `backend/srs/data_structure.sql` — a reference snapshot kept honest by `backend/tests/test_schema_declared.py`; the real source of truth is each module's own `CREATE TABLE IF NOT EXISTS` self-migration, run at import time):
```bash
docker run -d --name jp-db -e POSTGRES_PASSWORD=dev -p 5432:5432 postgres:16
docker exec -i jp-db psql -U postgres -c "CREATE DATABASE jp;"
docker exec -i jp-db psql -U postgres -d jp < backend/srs/data_structure.sql
```

### Database maintenance

Five operator scripts, none of them on the request path (six with
`prune_withdrawn`). **All of them report and change nothing without `--yes`**,
so the first run of any of them is safe:

```bash
cd backend
python -m scripts.purge_orphans        # rows whose Supabase auth user is gone
python -m scripts.compact_review_log   # roll old review rows up, then trim
python -m scripts.compact_events       # same, for the 足跡 trail (event_log)
python -m scripts.prune_logs           # cap the logs nothing reads past a point
python -m scripts.prune_withdrawn      # decks an author deleted, past their grace
python -m scripts.drop_legacy_tables   # tables a removed feature left behind
```

One more is read-only and needs no flag, so it is safe to run at any time:

```bash
python -m scripts.weekly_digest        # the four numbers, as markdown
```

Two others fill a shared cache ahead of demand rather than maintaining
one. Neither is required — both caches fill themselves from real traffic
— and both cost model calls, so both report first:

```bash
python -m scripts.prewarm_phrase_cache --dry-run        # the ~520 curated sentences
python -m scripts.prewarm_comprehension_pool --dry-run  # exercises per (level, lang)
python -m scripts.prewarm_exam_papers --dry-run         # one paper per exam id
```

None of the three is what makes a fresh deploy usable: the comprehension
pool is never empty, because `content/comprehension/*.json` (plan 111,
three hand-written exercises per level in both languages, held to the
same checks as a model answer by `tests/test_comprehension_seed.py`) is
upserted into `comprehension_pool` when `routes/reading.py` is imported,
keyed on `seed_key` so a corrected seed updates its row. The prewarm
scripts grow the pools past that floor; `prewarm_comprehension_pool`
reports the seeded and the generated rows apart. Exam papers have no
seed -- a paper is ~35 model calls -- so `prewarm_exam_papers` is the
only thing that spares the first learner at each exam id the wait.

Three are one-shots, each run once after a deploy that changed the ids a
content set serves — `content/grammar/renames.py` for grammar points,
`content/vocab_renames.py` for vocab entries, `content/kanji_renames.py`
for kanji (plan 112, the 23 characters the deck taught at two levels).
Each renames the learner's card rows to the new ids, merges on collision,
and leaves anything it does not recognise in place and reported. Vocab
alone can also **retire** an id that has no card to move to
(`vocab_renames.RETIRED`, the N5 より、ほう). It drops the schedule
(`cards`, `card_modes`) and the deck rows, pins and favourites that name
the card, and keeps `review_log` and `card_first_review`, so no figure
summed over them moves. Grammar's `RETIRED` only reports.

```bash
python -m scripts.migrate_grammar_ids  # report; --yes to apply, --user to scope
python -m scripts.migrate_vocab_ids    # report; --yes to apply, --user to scope
python -m scripts.migrate_kanji_ids    # report; --yes to apply, --user to scope
python -m scripts.migrate_pool_cards   # same, for a pool card whose word the deck now teaches
```

The fourth reads `datas/vocab/pool_moves.json`, which
`scripts/prune_pool_overlap.py` appends to for every pool row it takes
out (plan 110b): a learner who studied 母 from the pool before it was an
N5 card keeps that history on the N5 card.

One more one-shot, run once after the deploy that carries plan 097's
columns (`user_profiles.tutorial_at`, `guided`) and before the frontend that
reads them: it stamps the first ride as seen on every account that boarded
before the ride existed, so nobody with three thousand reviews is shown
how to flip a card. Same shape as the others — reports first.

```bash
python -m scripts.backfill_first_ride  # report; --yes to apply, --user to scope
```

And one after any deploy that changes the voice (plan 121 did, from edge-tts
to VOICEVOX Nemo). Run it from the backend's Render Shell, since it needs the
database and the disk the clips live on. It remakes every dictation clip and
every clip a stored paper refers to, in place and in the current voice. Then
it deletes the clips that cannot be remade: stale files only, never one the
current voice made. A second run resumes where the first stopped.

```bash
python -m scripts.revoice_audio        # report; --yes to remake and delete
```

A vocab card id is `vocab_{level}_{kanji}_{kana}`, so **correcting either
surface field of a deck entry orphans its SRS rows** — and the deck key
`"{kanji}::{kana}"` that `frequency_overrides.item_key` stores along with
them. Plan 091 corrected 34 entries and `migrate_vocab_ids.py` is what
carries the progress across; a future deck correction needs its own entries
in `vocab_renames.MOVES` for the same reason, or, for residue that was
never a word and has no card to fold into, one in `vocab_renames.RETIRED`
with its reason. **After any deck change, run
`python -m scripts.audit_vocab_deck --write-snapshot`,
`python -m scripts.placement_report --rebuild-order --write-lists` (two
runs; each flag is its own) and, for an added
word, `python -m scripts.prune_pool_overlap --yes`** (the JMdict pool is
"everything not in the deck"; this takes the new word's pool row out,
senses moved to `curated_senses`, ids untouched — never rebuild the pool
from another JMdict edition, a pool card's id is its row's position in
the export) and commit `datas/vocab/vocab_served.json`,
`vocab_frequency.json` and `vocab_jmdict.sqlite3` with it: `tests/test_vocab_deck.py` fails
on an id that left the deck without a `MOVES` line, and on a served id
the snapshot has not seen.

Two things are worth knowing before reaching for any of them:

- **`review_log` is not an audit log.** Lifetime XP, the level, total reviews,
  the streak, the 番付 standing and the daily-new budget are every one of them
  a `SUM`/`COUNT`/`MIN` over that table — there is no other copy. A plain
  `DELETE ... WHERE reviewed_at < ...` is therefore a partial account reset,
  not a retention policy. `compact_review_log.py` is the way to bound it: it
  folds the rows into `review_daily` / `card_first_review` (declared in
  `data_structure.sql`) *before* deleting them, and `srs.py`'s readers add the
  two halves back together, so no figure the learner sees moves. Those tables
  being empty is exactly today's behaviour, so nothing changes until the
  script is run.
- **Deleting a user outside the app does not delete their data.** Nothing can
  foreign-key to `auth.users` here — the card tables scope rows by a
  `"{user_id}:{card_id}"` string prefix rather than a column — so a deletion
  from the Supabase dashboard leaves every app row standing.
  `DELETE /api/account` is the path that erases properly; `purge_orphans.py`
  is the repair for deletions that bypassed it. See
  `docs/adr/0010-learner-rows-are-reconciled-with-auth-not-cascaded-from-it.md`.

- **A withdrawn deck is not a deleted one yet.** Deleting a deck other
  learners follow does not delete it: `routes/decks.delete_deck` sets
  `withdrawn_at` instead, so the deck leaves the author's shelf and their deck
  limit but stays readable for its followers, who are shown a warning and can
  take a copy. `prune_withdrawn.py` is what finally collects it. Without that
  script the grace period is not a grace period — it is content an author asked
  to delete, kept forever because somebody once followed it. See
  `docs/adr/0014-a-published-deck-is-a-link-not-a-copy.md`.

`prune_logs`, `compact_review_log`, `compact_events` and `prune_withdrawn` also
run weekly from `.github/workflows/db-maintenance.yml` (and on demand — the workflow's Run
button defaults to a dry run). It needs a `DATABASE_URL` repo secret, set to
Supabase's **session**-mode pooler URI on port 5432: the transaction pooler
(6543) cannot hold `compact_review_log`'s rollup in one transaction. The other
two scripts are deliberately not scheduled — dropping tables is a one-shot, and
`purge_orphans` needs the Supabase service key, which is too broad a secret to
park in CI for an occasional job.

For a one-time cleanup with nothing to install,
`backend/scripts/sql/cleanup_orphans_and_legacy.sql` does the orphan purge and
the legacy-table drop in the Supabase SQL Editor. It can find orphans by
joining `auth.users` directly, which `purge_orphans.py` cannot — the editor
runs as `postgres`, whereas the app's role is not assumed to see the `auth`
schema. It reports before it deletes, skips tables that do not exist yet, and
is a one-shot, so it cannot drift from the scripts.

### Analytics (足跡)

Behaviour is recorded **first-party or not at all** — there is no third-party
SDK, and `frontend/public/privacy.html`'s "No advertising, no trackers, no sale
of data" is a promise the design keeps rather than a line to amend. See
`docs/adr/0012`.

Two rules matter more than the rest:

- **Never record anything a learner typed.** Not a dictation answer, not an
  analysed sentence, not a deck or theme name. `backend/core/events.py` holds a
  closed set of event names, each with the property keys it may carry, and
  applies it to whatever a browser posts. `frontend/src/lib/track.js` mirrors
  that set, and `backend/tests/test_events.py` fails if the two drift.
- **Never store a pathname.** `/learn/vocab/theme/animaux/…` names a theme the
  learner chose and `/learn/decks/:deck_id` a deck they named.
  `frontend/src/lib/routePattern.js` reduces a path to the route App.jsx
  declared, and a path matching none is not recorded at all. Adding a screen
  means adding its pattern to `ROUTES` there — a node-lane test fails otherwise.

Call `track(name, props)` from `lib/track.js`; never `fetch` an analytics
endpoint from a screen. Reading the data: `scripts/weekly_digest.py` (weekly,
from `.github/workflows/weekly-digest.yml`, into the run's step summary), or
Metabase/the Supabase SQL editor pointed at the same database.

### Content audit

Every gate in this repo asks whether the content is well-formed;
`check_grammar` asks whether a sentence contains its pattern and stays
inside the level's kanji, `test_listening_clips` whether the kana
transcribes the jp. **Nothing in CI asks whether what we teach is true.**
A wrong gloss passes every check and is then memorised by someone who has
no way to know better, which is why it is worth a scheduled job of its own.

A Routine ("Tsuji content audit", Tuesdays and Fridays) wakes a session
that takes one slice of the taught content, tries to disprove it, and files
a single GitHub issue labelled `content-audit`. **The audit never edits
content** — a wrong correction arriving with a citation attached is worse
than the original error. `docs/content-audit/PLAYBOOK.md` is the method,
including the evidence bar and what must never be filed.

```bash
cd backend
python -m scripts.audit_slice                  # what today's run audits
python -m scripts.audit_slice --dump           # ... and the entries, as JSON
python -m scripts.audit_slice --schedule 12    # the next twelve runs
python -m scripts.audit_slice --on 2026-10-06  # reproduce a past run's slice
```

One more read-only report measures the vocab deck itself (plan 103) —
its shape, duplicates, readings, glosses, and every content word in the
taught sentences that resolves to no card, split into the present cards
the lookups miss and the real gaps. `tests/test_audit_vocab_deck.py`
holds its figures as ratchets; lower a bound when a plan lowers the
figure, never raise one. `docs/vocab-deck-review.md` is the review it
measures for.

```bash
cd backend
python -m scripts.audit_vocab_deck                # the report
python -m scripts.audit_vocab_deck --dump         # the figures and lists, as JSON
python -m scripts.audit_vocab_deck --skip-corpus  # without the tokenizer half
```

A second report puts the deck beside two outside lists (plan 109,
`datas/vocab/sources/`): cards placed above the level the community
JLPT lists give the word, list words with no card, and frequent words
(a subtitle corpus, lemmatised through the tokenizer) with no card.
Three candidate lists for the audit's slices — it changes no card. The
one thing it rewrites is `vocab_frequency.json`, the deck's keys in the
ranking's order; **after any deck change run it with
`--rebuild-order`**, since a test holds the file equal to what it would
write.

```bash
cd backend
python -m scripts.placement_report                  # the three lists, forty each
python -m scripts.placement_report --slice 2        # the next forty of each
python -m scripts.placement_report --rebuild-order  # vocab_frequency.json, in ranking order
python -m scripts.placement_report --write-lists    # placement_lists.json, for the audit's rotation
```

The slice is a pure function of the date — grammar, vocab, sentences and,
since plan 109, placement (the three candidate lists, read from
`datas/vocab/placement_lists.json`, which `placement_report --write-lists`
writes) in rotation, each area walking its own list — so there is no
ledger to keep in sync and no state to corrupt. Read-only, no database, no `.env`, no network:
it parses the content modules with `ast` rather than importing them, so it
runs in a fresh clone (`content/listening_clips.py` needs pykakasi; this does
not). `tests/test_audit_slice.py` holds the rotation to the playbook's
promises. Vocab is the one bank too big to walk exhaustively — 8,091 entries
at 40 a run — so its slices are ordered risk-first by the disagreements with
JMdict the script can find on its own, and the `flags` it prints are a reason
to look rather than findings.

### Frontend (`frontend/`)
```bash
npm install
npm run dev       # Vite dev server, proxies /api -> localhost:8000
npm run build
npm run lint
npm test          # vitest: node, browser, phone, tablet, touch, desktop and wide lanes (see vite.config.js)
npm run build:native  # the Capacitor bundle (dist-native/, reads .env.native)
npm run icons     # re-render brand/icon.html and regenerate the icon set in public/
```

`npm run lint` is not the whole lint story: `npm run lint:css` (stylelint,
ratcheted against a checked-in baseline) and `npm run lint:scale` (a
source-level ratchet on font-size/border-radius/gap/padding literals against
`frontend/src/design-scale.json`) both run in CI right after `npm run lint`.
See `frontend/README.md`, "Design conformance guards", for what each one
catches and why violations are baselined/allowlisted rather than fixed
outright.

### Frontend env vars

`frontend/.env.production` is tracked (Vercel reads it), but **Vite does not
load it for `npm run dev`** — dev mode reads `.env.local` /
`.env.development.local`, which are gitignored. Without them the app falls back
to a placeholder Supabase project and every auth call fails with
`ERR_NAME_NOT_RESOLVED`.

One-time setup in a fresh clone or a new git worktree:

```bash
cd frontend && grep -E '^VITE_SUPABASE' .env.production > .env.development.local
```

See `frontend/.env.example` for the full variable list.

## Auth in local dev

Set `DEV_USER_ID` in `backend/.env` and every request is treated as that user with no token check (see `backend/core/auth.py`). This is opt-in only — it must never be set in a deployed environment, and the backend prints a loud warning banner on startup when it's active. Without it, `SUPABASE_URL`/`SUPABASE_SERVICE_KEY` are required and every request does a round trip to Supabase to verify the bearer token.

## Architecture

### Backend layout
- `main.py` — FastAPI app setup: loads `backend/.env`, mounts routers, CORS (deployed frontend origin + `CORS_ORIGINS` env list), static mounts for `kanjivg` (stroke-order diagrams) and `datas/exam_audio` (generated TTS).
- `routes/` — one file per feature area (kana, vocab, kanji, grammar, phrase, reading, translation, dictation, composition, practice, dictionary, decks, exams, today, stats, profile, frequency, theme_vocab, translations, onboarding, journey, tts, station). Thin FastAPI routers; business logic lives in `srs/` and `study/`.
- `core/` — cross-cutting singletons: `auth.py` (identity), `db.py` (raw psycopg2 connections), `srs_instance.py` / `frequency_store_instance.py` (module-level singletons constructed once at import time from `DATABASE_URL`, imported by routes needing SRS/frequency state).
- `srs/` — the spaced-repetition engine (`srs.py` is the large one — scheduling, review submission, card state), `scheduler.py` (interval/difficulty math), `storage.py` (DB access), `models.py` (`CardState`/`ReviewResult` dataclasses), `xp.py` (XP curve), `batch_cache.py`, `frequency_store.py`.
- `study/` — content-generation and evaluation logic that sits above the SRS layer: exam generation (`exam_blueprint.py`, `exam_*_gen.py` per section — vocab/kanji/grammar/reading/listening — `exam_validation.py`, `exam_scoring.py`, `exam_tts.py`), card selection/lookup (`card_index.py`, `card_lookup.py`, `daily_queue.py` for the "Today" queue), difficulty modeling (`difficulty.py`), grammar detection (`grammar_detect.py` — which catalogue points a sentence actually uses, over the tokenizer and the catalogue's own example sentences; `difficulty.points_in` is its name to the rest of the app), Japanese text processing (`furigana.py`, `morphology.py`, `grammar_match.py`, `sound.py`, `romaji.py` — Hepburn conversion and the fold two romanizations are compared under), dictation (`dictation.py` — clip identity and the transcription measure), speech (`voice_engine.py` — the only client of the VOICEVOX Nemo engine; `exam_tts.py` — the clip store, content keys, the voice epoch and dialogue assembly; `word_tts.py` — the `/api/tts` card-reading clips), and study `modes.py`/`structures.py` defining the review-mode taxonomy per content type.
- `content/` — static/generated reference data (grammar points, vocab, kanji readings/meanings, frequency lists, reading sentences, the dictation bank in `listening_clips.py`) as Python modules or JSON, built/refreshed by scripts in `scripts/`. **The grammar catalogue is `content/grammar/N5.json … N1.json`** (plan 087, ADR 0016): one list per level, every text in both languages, the lesson (`steps`, `compare`, four examples) beside the gloss at the levels in `RICH_LEVELS`. It is authored, never generated — no sentence from a published list, no model output — and held to `study/grammar_check.py`: run `python -m scripts.check_grammar --report` before every content commit. A pattern string is a card id, so a rename or a level move goes through `content/grammar/renames.py` and the migration script; `content/grammar/README.md` has the schema and the style guide. `content/grammar_data.py` is a dead scrape kept only as the provenance test's negative corpus. **The two big reference sets are SQLite, not JSON, and deliberately so**: `datas/vocab/vocab_jmdict.sqlite3` (212k JMdict entries, via `vocab_jmdict_data.py`) and `datas/kanji/kanji.sqlite3` (all 13,108 KANJIDIC2 characters, via `kanji_pool_data.py`). A dict held at import costs RSS on every worker for the whole process lifetime; SQLite reads only the pages a query touches. Do not "simplify" either back into a `json.load` at module scope — that is what the 512 MB Render budget cannot take. The JSON they are built from is gitignored (`backend/.gitignore`); restore the upstream export beside them and re-run `scripts/build_jmdict_db.py` / `scripts/build_kanji_db.py` to refresh.
- `scripts/` — one-off data-pipeline scripts (build JMDict/frequency/theme/radical indexes, generate grammar sentences, migrate card IDs, wipe SRS data) and the database-maintenance tools below. Not part of the request path.
- `translations/` — i18n string tables served to the frontend.

Card IDs are namespaced per user as `"{user_id}:{card_id}"` (`core/auth.py:prefixed`/`unprefixed`) so SRS state for the same content differs per learner in the same tables.

### Frontend layout (`frontend/src/`)
- `App.jsx` — top-level router; gates all routes behind Supabase session state (`lib/supabase.js`). Every screen renders under one of two layout routes: the `Shell` (HUD + tab bar below 1100px; the desk's rail at 1100px and up) for the five tab trees (`/today`, `/learn`, `/practice`, `/dictionary`, `/profile`) or the `StageFrame` (no chrome) for runs and sessions; the old top-level paths (`/kana`, `/decks/:id`, `/exam/:id` …) redirect to their place behind a gate. `/dev/rewards`, `/dev/onboarding`, `/dev/sounds` and `/dev/ride` are dev-only routes (tree-shaken out of production builds via `import.meta.env.DEV`).
- `screens/` — one file per route/page (largely 1:1 with `App.jsx` routes).
- `components/` — shared UI grouped by feature area (`chrome`, `decks`, `dictionary`, `profile`, `rewards`, `selection`, `station`, `stats`, `study`, `ui`). `components/chrome/` is the chrome (plan 068; the desk, plan 113): the `Shell` and `StageFrame` layout routes, the `Hud`, the `TabBar`, the `DeskRail` (the computer's chrome, drawn instead of both at 1100px and up), the `Bar` (and `ScreenBar`, the transitional header for screens the redesign has not reached), `Sheet`, `Console`/`Chip`/`Seg`, `StageHead` — the class map from the canvas is `docs/design/mobile/README.md`. `components/station/` holds cross-cutting screen-transition UI (`DepartureGate`, `TrainDoor`) rendered outside `<Routes>` in `App.jsx` so their animations survive the navigation that would otherwise unmount them.
- `domain/` — pure client-side domain logic: card shape helpers, kana sets, level titles, reward tiers, stats modeling, study-mode definitions, XP curve. Mirrors backend concepts but has no network calls.
- `stores/` — small client-side state modules (boarding/departure transition state, profile summary, rating scale) — not Redux, just modules with subscribable state.
- `exam/` — mock-exam UI: question rendering, exam kind definitions, `examService.js` for the exam API calls. Pairs with `screens/Exam*.jsx`.
- `hooks/useCardSession.js` — shared review-session state machine used by the study screens.
- `hooks/useDesk.js` — the one line between the two chromes (`DESK_QUERY`, `(min-width: 1100px)`). Below it every screen renders exactly the phone's DOM; above it the Shell draws the rail and a few screens lay themselves out for the width. **Never write a desk rule outside the last section of `index.css`, and never write the width anywhere else** — `src/desk.css.test.js` fails on both. See ADR 0018 and `docs/design/desk/README.md`.
- `lib/api.js` — fetch wrapper. `apiFetch` returns the raw `Response`; `apiJson`/`apiJsonWithTimeout` add `ApiError` on non-2xx and an owned `AbortController` — prefer these over hand-rolled fetch+timeout in new screens.
- `lib/supabase.js` — Supabase client; falls back to a placeholder project if env vars are unset (keeps builds/tests that don't touch auth from crashing on construction).
- `config/` — static config: `tabs.js` (the five gates and the section registry behind them: paths, line colours, titles), `stations.js` (codes and readings per route), `identity.js` (the two pass routes).
- `locales/` + `i18n.jsx` + `LangContext.jsx` — French/English string tables and language context.

### Data flow
Frontend calls same-origin `/api/*` FastAPI routes in both dev and prod (Vite proxy in dev, Vercel rewrites in prod; there is no backend-origin env var — see Deployment below) with a Supabase bearer token → `core/auth.get_user_id` resolves the user → routes use `core/srs_instance.srs` (the shared `SRSEngine`) and `study/` helpers to read/write per-user card state in Postgres, and static `content/` data for card content itself.

## Deployment

- Backend: Render (`render.yaml`), root `backend/`, persistent disk mounted at `/data` for SRS storage. The running service is the dashboard's `Japanese_Learner`, in Frankfurt, which `render.yaml` did not create (the names differ): a Blueprint made from the file would add a second backend beside it, so the live services are changed in the dashboard and the file is kept saying the same.
- Voice engine: a second service in `render.yaml`, `voicevox-nemo`, a
  **private** service running the stock `voicevox/voicevox_nemo_engine` image
  pinned by digest. It has no auth, so it must never be made public; only the
  backend reaches it, through `VOICEVOX_URL` (its internal `host:port`),
  over the private network, in the same region: Frankfurt, pinned in
  `render.yaml`. It holds no state. Starter's 512 MB
  fits it (343 MB at peak with the three voices) at the cost of slow first
  syntheses; Standard halves them. See ADR 0019.
- Frontend: Vercel (`frontend/vercel.json`), SPA rewrite to `index.html`, plus
  proxy rewrites for `/api`, `/kanjivg` and `/exam-audio` to the Render
  backend. The browser never calls `onrender.com` directly — some mobile
  carriers cannot reach that shared zone at all (diagnosed 2026-09-01: every
  CORS preflight died in transit on 4G), and same-origin also removes the
  preflight round trip. `VITE_API_URL` is retired — the code no longer reads
  it (a leftover copy in the Vercel dashboard once out-prioritised the tracked
  `.env.production` and silently rebaked the direct URL). A new backend static
  mount needs a matching rewrite in `vercel.json` (and in `vite.config.js`'s
  dev proxy).
- The one exception is the native shell (Capacitor): its WebView origin is
  `capacitor://localhost` / `https://localhost`, so `npm run build:native`
  (`vite build --mode native`, output `dist-native/`) reads the tracked
  `frontend/.env.native`, whose `VITE_API_ORIGIN` is the **Vercel** origin —
  never Render — so the proxy stays in the path. `vite.config.js` refuses
  any other mode that carries the variable; `backend/main.py` lists the two
  WebView origins in CORS. See `docs/adr/0008-native-shells-reach-the-api-through-the-web-origin.md`.
