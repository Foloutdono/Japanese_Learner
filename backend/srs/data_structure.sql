-- This file is NOT the source of truth for the schema -- every table
-- here is self-migrated at import time by the module that owns it
-- (CREATE TABLE IF NOT EXISTS, run on every startup; see the
-- comments throughout this file for which module owns which table).
-- It exists as a fast way to stand up a fresh dev/test database in
-- one shot (see CLAUDE.md's Local Postgres section) and as a single
-- place to read the whole schema at a glance. backend/tests/
-- test_schema_declared.py keeps it honest: it fails if a table any
-- module creates isn't declared here.
--
-- Every table declared here is also classified in routes/account.py —
-- the learner's own rows (PLAN, erased by DELETE /api/account) or
-- shared content (SHARED, never touched). tests/test_account.py fails
-- when a table is declared here and classified in neither list.

CREATE TABLE cards (
    id TEXT PRIMARY KEY
);

CREATE TABLE card_modes (

    card_id TEXT NOT NULL,
    mode TEXT NOT NULL,

    difficulty REAL NOT NULL DEFAULT 2.5,
    stability REAL NOT NULL DEFAULT 0,

    interval_days INTEGER NOT NULL DEFAULT 0,

    repetitions INTEGER NOT NULL DEFAULT 0,
    lapses INTEGER NOT NULL DEFAULT 0,

    learning_step INTEGER NOT NULL DEFAULT 0,
    is_learning BOOLEAN NOT NULL DEFAULT TRUE,

    next_review TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    total_reviews INTEGER NOT NULL DEFAULT 0,
    correct_reviews INTEGER NOT NULL DEFAULT 0,

    last_quality SMALLINT NOT NULL DEFAULT -1,

    PRIMARY KEY(card_id, mode),

    FOREIGN KEY(card_id)
    REFERENCES cards(id)
    ON DELETE CASCADE
);

CREATE INDEX idx_due_reviews
ON card_modes(mode, next_review);

-- Created at runtime by srs/srs.py alongside idx_due_reviews; declared
-- here late, so this file shows the same shape a running install has.
-- (total_reviews in the middle: the new-card queue asks for a mode's
-- never-reviewed rows, which is a range on next_review under an
-- equality on the first two columns.)
CREATE INDEX idx_due_lookup
ON card_modes(mode, total_reviews, next_review);

CREATE TABLE review_log (
    id BIGSERIAL PRIMARY KEY,
    card_id TEXT NOT NULL,
    mode TEXT NOT NULL,
    quality SMALLINT NOT NULL,
    -- XP awarded for this specific review, computed once at write time
    -- (base_xp(quality) * that day's diminishing multiplier + streak
    -- bonus — see srs/xp.py) and stored rather than recomputed, so
    -- lifetime/leaderboard totals are just SUM(xp_earned) and never
    -- drift if the formula's constants change later.
    xp_earned INTEGER NOT NULL DEFAULT 0,
    reviewed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_review_log_card_id
ON review_log(card_id, reviewed_at);

-- Every per-user read of review_log and card_modes is
-- `card_id LIKE 'uuid:%'` — the id namespacing in core/auth.py is the
-- only thing scoping a row to a learner. Under any collation but C a
-- plain btree cannot serve a LIKE prefix, so idx_review_log_card_id
-- above is SKIPPED and "what is this learner's XP" reads the whole
-- table (measured on 200k rows: 27ms, 196k rows discarded, growing
-- with every other learner's history). text_pattern_ops is the
-- operator class that does index a prefix. Both are kept: the plain
-- index still serves the equality lookups in scripts/.
CREATE INDEX idx_review_log_card_prefix
ON review_log(card_id text_pattern_ops, reviewed_at);

CREATE INDEX idx_card_modes_card_prefix
ON card_modes(card_id text_pattern_ops);

-- ── The review rollup (plan 078) ─────────────────────────────
-- review_log is NOT an audit log that can be trimmed by date:
-- lifetime XP, level, total reviews, the streak, the 番付 standing
-- and the daily-new budget are all SUM/COUNT/MIN over it. These
-- three tables are what makes trimming it safe — old rows are folded
-- in here before they are deleted, and srs.py's readers add the two
-- halves back together. Empty (the state until an operator runs
-- scripts/compact_review_log.py --yes) they contribute nothing and
-- every figure is exactly what it was.
--
-- Owned by srs/srs.py's _init_db, same self-migrating pattern as
-- cards/card_modes/review_log above.

-- One row per (learner, UTC day, UTC hour). The hour is in the key
-- because get_review_hours buckets by it; that still bounds this at
-- 24 rows per learner per day against the hundreds a real day holds.
CREATE TABLE review_daily (
    user_id TEXT NOT NULL,
    day DATE NOT NULL,
    hour SMALLINT NOT NULL,
    reviews INTEGER NOT NULL DEFAULT 0,
    xp INTEGER NOT NULL DEFAULT 0,
    -- The six ratings kept as six counters rather than six rows;
    -- get_quality_mix turns them back into rows with LATERAL VALUES.
    q0 INTEGER NOT NULL DEFAULT 0,
    q1 INTEGER NOT NULL DEFAULT 0,
    q2 INTEGER NOT NULL DEFAULT 0,
    q3 INTEGER NOT NULL DEFAULT 0,
    q4 INTEGER NOT NULL DEFAULT 0,
    q5 INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (user_id, day, hour)
);

-- The first time each (card, mode) was ever answered. get_new_items_today
-- and get_journey_item_counts are MIN(reviewed_at) queries: without this,
-- compacting a card's only review would make a card met two years ago
-- count as NEW again — spending the learner's daily new-card allowance on
-- cards they already know, and moving the journey's promised total. Per
-- (card, mode) because both queries filter to servable modes BEFORE
-- taking the minimum.
CREATE TABLE card_first_review (
    card_id TEXT NOT NULL,
    mode TEXT NOT NULL,
    first_at TIMESTAMPTZ NOT NULL,
    PRIMARY KEY (card_id, mode)
);

CREATE INDEX idx_card_first_review_prefix
ON card_first_review(card_id text_pattern_ops);

-- How far compaction has run per learner, plus the one figure a daily
-- rollup cannot rebuild: get_best_quality_streak counts consecutive
-- ROWS, so a run is only visible while the rows are. best_run is the
-- longest run wholly inside compacted history and best_run_min the
-- threshold it was measured at (the stored figure is ignored for any
-- other threshold rather than quietly answering a different question).
-- A run STRADDLING the cut is counted as its two halves — the one
-- documented loss, and only ever downward.
CREATE TABLE review_compaction (
    user_id TEXT PRIMARY KEY,
    compacted_through TIMESTAMPTZ NOT NULL,
    best_run INTEGER NOT NULL DEFAULT 0,
    best_run_min SMALLINT NOT NULL DEFAULT 4,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Display identity for the Profile screen / leaderboard. Deliberately
-- separate from Supabase's own auth.users table rather than reading/
-- writing it directly: keeps this app's schema self-contained and not
-- dependent on the DB role having access to the auth schema. Seeded
-- lazily (random username) the first time a user hits /api/profile if
-- no row exists yet — see profile.py.
CREATE TABLE user_profiles (
    user_id TEXT PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    -- Onboarding (routes/onboarding.py): the learner's own JLPT level
    -- ('N5'..'N1' — validated in code, read through core/user_level.py's
    -- resolver per docs/adr/0005), their chosen daily new-item pace, and
    -- when they completed the flow. All NULL until onboarding runs;
    -- NULL onboarded_at is the signal that shows the flow.
    jlpt_level TEXT,
    daily_new_target INTEGER,
    onboarded_at TIMESTAMPTZ,
    -- The journey contract (plan 063, routes/onboarding.py +
    -- routes/journey.py): destination + validity date printed on the
    -- pass (both NULL = "just ride"). goal_start_level remembers where
    -- the line began — jlpt_level moves as the learner levels up, and
    -- the promised item total must not drift with it. goal_set_at
    -- anchors the itemsDone window. daily_departure is the optional
    -- habit hour ('am'|'noon'|'pm', NULL = flexible), validated in
    -- code like jlpt_level.
    goal_start_level TEXT,
    goal_level TEXT,
    goal_target_date DATE,
    goal_set_at TIMESTAMPTZ,
    daily_departure TEXT,
    -- Which rating bar the learner grades with: 'simple' (wrong /
    -- almost / difficult / correct — the default), 'binary' (just wrong
    -- and correct) or 'full' (the four plus blackout and perfect).
    -- NULL = never chosen, which reads as the default.
    -- Not a change of scale — both bars send the same canonical 0..5
    -- quality, so switching leaves the learner's own history meaning
    -- exactly what it meant. See routes/profile.py's RATING_SCALES and
    -- frontend/src/domain/ratingScales.js.
    rating_scale TEXT,
    -- The credits (plan 069, core/credits.py): the local day the last
    -- refill or the seed was taken (the idempotence lock), the
    -- entitlement ('free' | 'pass', with an optional expiry -- set by
    -- hand until a purchase flow exists) and the device's UTC offset in
    -- minutes east, so the refill day is the learner's.
    credits_refilled_on DATE,
    plan TEXT DEFAULT 'free',
    plan_until TIMESTAMPTZ,
    tz_offset_min INTEGER,
    -- The boarding's own answers (plan 075, routes/onboarding.py): why
    -- the learner is here ('studies' | 'fun' | 'trip' | 'live' |
    -- 'friends' | 'other'), which kana they already read ('hiragana' |
    -- 'katakana' | 'both' | 'none' -- the sets marked known at the
    -- boarding, study/level_rule.py), the daily nudge's hour ('HH:MM',
    -- NULL = none; routes/journey.py's reprint moves it with the ride's
    -- hour) and whether they said yes to the nudge. All validated in
    -- code; NULL/false until the boarding runs.
    motive TEXT,
    kana_known TEXT,
    reminder_time TEXT,
    notifications BOOLEAN NOT NULL DEFAULT FALSE
);

-- The Sentence bank: what the learner submitted, plus where it came
-- from. Does NOT store the analysis itself -- badges would go stale the
-- moment SRS state changes underneath a stored snapshot. Re-derived on
-- read instead; see routes/phrase.py's get_phrase_history_entry and
-- docs/adr/0002-sentence-bank-stores-text-not-results.md.
--
-- `result` is nullable and unused by any code path (routes/phrase.py's
-- _migrate_history_schema drops its NOT NULL at import time) -- kept
-- rather than dropped so pre-2026-08 rows are left alone.
-- `kept` marks a Sentence the learner deliberately pinned (保存), as
-- opposed to a Passage/Sentence that merely passed through as history.
CREATE TABLE phrase_history (
    id BIGSERIAL PRIMARY KEY,
    user_id TEXT NOT NULL,
    phrase TEXT NOT NULL,
    result JSONB,
    source TEXT NOT NULL DEFAULT 'typed',
    source_ref TEXT NOT NULL DEFAULT '',
    kept BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_phrase_history_user
ON phrase_history(user_id, created_at DESC);

-- Makes a pin idempotent: only one kept row per (user_id, phrase); an
-- ordinary (non-kept) history row for the same text may still repeat.
CREATE UNIQUE INDEX idx_phrase_history_kept_unique
ON phrase_history(user_id, phrase) WHERE kept;

CREATE TABLE reading_log (
    id BIGSERIAL PRIMARY KEY,
    user_id TEXT NOT NULL,
    level TEXT NOT NULL,
    phase TEXT NOT NULL,
    phrase TEXT NOT NULL,
    romaji TEXT NOT NULL,
    answer TEXT NOT NULL,
    correct BOOLEAN NOT NULL,
    -- The rating the learner gave on the six-segment bar, 0..5 worst to
    -- best, as RatingBar emits it. NULL on every row written before the
    -- screen graded that way -- which means "graded, resolution
    -- unknown", not a score of zero. `correct` is derived from it
    -- (q > 2 is a pass) and kept so existing readers still work.
    quality     SMALLINT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_reading_log_user
ON reading_log(user_id, created_at DESC);

CREATE TABLE comprehension_log (
    id BIGSERIAL PRIMARY KEY,
    user_id TEXT NOT NULL,
    level TEXT NOT NULL,
    text TEXT NOT NULL,
    translation TEXT NOT NULL,
    questions JSONB NOT NULL,
    answers JSONB NOT NULL,
    score INTEGER NOT NULL,
    total INTEGER NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_comprehension_log_user
ON comprehension_log(user_id, created_at DESC);
-- Frequency-tier study mode (frequency_data.py / frequency.py): lets a
-- user pin a specific kanji/vocab to a different tier than its standard
-- frequency-rank tier. item_key is the kanji character itself for
-- domain='kanji', or "kanji::kana" for domain='vocab' — see
-- frequency_data.py's resolve()/tier_keys() for how that key gets
-- resolved back to a deck entry. tier is always relative to
-- frequency_data.DEFAULT_TIER_SIZE regardless of what tier_size a given
-- /tiers request asks for — see that module's docstring.
--
-- Created at runtime by FrequencyOverrideStore._init_db()
-- (srs/frequency_store.py), same self-migrating pattern SRSEngine uses
-- for cards/card_modes/review_log — listed here for reference, not as a
-- migration you need to run by hand.
CREATE TABLE frequency_overrides (
    user_id TEXT NOT NULL,
    domain TEXT NOT NULL,
    item_key TEXT NOT NULL,
    tier INTEGER NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, domain, item_key)
);

CREATE INDEX idx_frequency_overrides_user_domain
ON frequency_overrides(user_id, domain);

-- decks, custom_cards, deck_cards, deck_subscriptions and
-- deck_reports — the whole custom-deck and library schema — are
-- self-migrated by decks.py at import time
-- (_ensure_deck_schema), same pattern SRSEngine uses for cards/
-- card_modes/review_log. Listed here for reference, not a migration
-- you need to run by hand. (Earlier versions of this file assumed
-- decks/custom_cards already existed elsewhere and only self-migrated
-- deck_cards — they didn't, which crashed every /api/decks request
-- with UndefinedTable. All three are created together now, in
-- dependency order, so decks.py is fully self-contained.)

-- `visibility` and `description` are the library (publish a deck,
-- follow someone else's). Publication lives here rather than in a side
-- table because it is 1:1 with a deck and every deck query already
-- selects from this one.
--
-- `withdrawn_at` is a different question and deliberately a different
-- column: it is set when an author DELETES a deck other learners
-- follow. The deck then leaves the author's shelf and their deck limit
-- (core/credits.check_deck_limit) and survives only so its followers
-- can still copy it, until scripts/prune_withdrawn.py collects it.
-- Unpublishing, by contrast, only delists — it changes nothing for the
-- people already following.
CREATE TABLE decks (
    id BIGSERIAL PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'standard',
    description TEXT NOT NULL DEFAULT '',
    visibility TEXT NOT NULL DEFAULT 'private',   -- 'private' | 'public'
    published_at TIMESTAMPTZ,
    withdrawn_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_decks_user
ON decks(user_id);

-- Partial: published decks are a small minority of the table, and the
-- library's only ordering is by publication date.
CREATE INDEX idx_decks_public
ON decks(published_at DESC) WHERE visibility = 'public';

-- The user's own hand-authored cards. deck_cards below only ever
-- holds *references* into the read-only app decks — never a copy of
-- them — so this table is the one place actual card content the user
-- typed lives.
-- front/back/kana are legacy (pre-structure) columns, kept nullable
-- for old rows; a card's real content lives in `fields`, keyed by
-- `structure`'s own field names -- see study/structures.py and
-- routes/decks.py:302's migration comment for why.
CREATE TABLE custom_cards (
    id BIGSERIAL PRIMARY KEY,
    deck_id BIGINT NOT NULL REFERENCES decks(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL,
    front TEXT,
    back TEXT,
    kana TEXT,
    notes TEXT NOT NULL DEFAULT '',
    structure TEXT NOT NULL DEFAULT 'standard',
    fields JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_custom_cards_deck
ON custom_cards(deck_id, user_id);

-- Membership links between a user's custom deck and cards sourced
-- from the app's own built-in decks (kanji/vocab/grammar today — see
-- decks.py's SOURCES registry for where kana or a fuller dictionary
-- source would plug in next). raw_id is whatever that source's own id
-- function produces (kanji_to_id / vocab_to_id / grammar_to_id) and
-- is deliberately NOT scoped to this deck: a card added to several
-- decks, or studied directly from the Kanji/Vocab/Grammar screens,
-- shares one SRS progress everywhere — same behaviour the deck
-- feature's old mix_levels parameter gave, just persisted now instead
-- of recomputed from whole JLPT levels on every request.
CREATE TABLE deck_cards (
    deck_id BIGINT NOT NULL REFERENCES decks(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL,
    source TEXT NOT NULL,        -- 'kanji' | 'vocab' | 'grammar' (kana/dictionary: future)
    level TEXT NOT NULL,         -- JLPT level the entry lives under, e.g. 'N5'
    raw_id TEXT NOT NULL,        -- kanji_to_id / vocab_to_id / grammar_to_id output
    added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (deck_id, source, raw_id)
);

CREATE INDEX idx_deck_cards_deck
ON deck_cards(deck_id, user_id);

-- Who follows whose deck. A subscription is a LINK, never a copy: the
-- deck, its custom_cards and its deck_cards all stay the author's, and
-- a follower's own SRS state is keyed on the same deck-scoped raw id
-- ("custom_{deck_id}_{card_id}") under their own user prefix — so two
-- followers of one deck never share progress, and neither shares the
-- author's. POST /api/decks/{id}/detach is what turns a link into a
-- real copy, carrying the follower's progress across the new ids.
CREATE TABLE deck_subscriptions (
    deck_id BIGINT NOT NULL REFERENCES decks(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL,
    subscribed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (deck_id, user_id)
);

-- The PK already indexes (deck_id, ...); this is the other direction --
-- "which decks does this learner follow" -- asked by GET /api/decks and
-- by routes/today.py on every queue build.
CREATE INDEX idx_deck_subscriptions_user
ON deck_subscriptions(user_id);

-- Moderation is a queue, not a mechanism: a report records that someone
-- objected and nothing is hidden automatically. UNIQUE(deck_id,
-- user_id) makes reporting idempotent. `reason` is a closed enum
-- (routes/decks.REPORT_REASONS), never free text -- a free-text field
-- here would be learner-typed content on a path with no way to refuse
-- it.
CREATE TABLE deck_reports (
    id BIGSERIAL PRIMARY KEY,
    deck_id BIGINT NOT NULL REFERENCES decks(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL,
    reason TEXT NOT NULL,
    reported_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (deck_id, user_id)
);

-- One row per video/subtitle analysis request. `sentences` holds the
-- LOCAL tier only (study/analysis.py's analyze_local, no per-user
-- stats) -- routes/video.py's GET attaches live SRS state at read
-- time, same principle as docs/adr/0002. created and updated by
-- routes/video.py; see that module's _migrate_video_schema.
CREATE TABLE video_sessions (
    id            BIGSERIAL PRIMARY KEY,
    user_id       TEXT NOT NULL,
    source        TEXT NOT NULL,               -- 'upload' | 'paste'
    source_ref    TEXT NOT NULL,                -- video id, or the uploaded filename
    -- Both nullable: NULL means "no bound that side", and both NULL
    -- (the default) is the whole Track. The Window used to be required
    -- and capped at 5 minutes; MAX_SENTENCES already bounds the work,
    -- so it was a second cap on the same thing. See docs/adr/0003's
    -- 2026-08-27 amendment.
    window_start  DOUBLE PRECISION,
    window_end    DOUBLE PRECISION,
    -- Retained so existing rows read back; nothing sets it any more.
    window_capped BOOLEAN NOT NULL DEFAULT FALSE,
    status        TEXT NOT NULL DEFAULT 'generating',  -- 'generating' | 'ready' | 'failed'
    error         TEXT,
    sentences     JSONB,
    truncated     INTEGER NOT NULL DEFAULT 0,
    -- Optional YouTube id to embed alongside the transcript. Independent
    -- of `source`: an uploaded .srt can name a video to play too. NULL
    -- means transcript-only, with no player.
    video_id      TEXT,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_video_sessions_user
ON video_sessions(user_id, created_at DESC);

-- The claim lock -- same pattern as exam_generation_jobs
-- (study/exam_schema.py), one row per session while work is running or
-- has recently failed, deleted on success. See routes/exams.py's
-- comment on why the primary key IS the lock.
CREATE TABLE video_session_jobs (
    session_id  BIGINT PRIMARY KEY REFERENCES video_sessions(id) ON DELETE CASCADE,
    status      TEXT NOT NULL,
    error       TEXT,
    retry_after TIMESTAMPTZ,
    started_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Owned by study/exam_schema.py -- generated mock exams (one row per
-- exam_id/revision, papers regenerated wholesale rather than patched),
-- learner attempts against a specific revision, and the claim-lock job
-- table for exam generation (same pattern as video_session_jobs above).
CREATE TABLE exam_papers (
    exam_id           TEXT NOT NULL,
    revision          INT NOT NULL DEFAULT 1,
    level             TEXT NOT NULL,
    seed              BIGINT NOT NULL,
    generator_version TEXT NOT NULL,
    paper             JSONB NOT NULL,
    section_count     INTEGER NOT NULL,
    question_count    INTEGER NOT NULL,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (exam_id, revision)
);

CREATE TABLE exam_attempts (
    id          BIGSERIAL PRIMARY KEY,
    user_id     TEXT NOT NULL,
    exam_id     TEXT NOT NULL,
    revision    INT NOT NULL DEFAULT 1,
    section_id  TEXT NOT NULL,
    answers     JSONB NOT NULL,
    review      JSONB NOT NULL,
    per_section JSONB NOT NULL,
    correct     INTEGER NOT NULL,
    total       INTEGER NOT NULL,
    started_at  TIMESTAMPTZ NOT NULL,
    finished_at TIMESTAMPTZ NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT exam_attempts_paper_fkey
        FOREIGN KEY (exam_id, revision)
        REFERENCES exam_papers(exam_id, revision)
);

CREATE INDEX idx_exam_attempts_user
ON exam_attempts(user_id, created_at DESC);

-- Likewise created at runtime, by study/exam_schema.py: the result
-- screen re-fetches one learner's attempt at a specific paper revision.
CREATE INDEX idx_exam_attempts_paper
ON exam_attempts(exam_id, revision, user_id);

CREATE TABLE exam_generation_jobs (
    exam_id     TEXT PRIMARY KEY,
    revision    INT NOT NULL DEFAULT 1,
    status      TEXT NOT NULL,
    error       TEXT,
    retry_after TIMESTAMPTZ,
    started_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Owned by study/grammar_sentence_store.py -- generated example
-- sentences for one grammar point, cached wholesale per (level,
-- pattern) and regenerated in full rather than patched.
CREATE TABLE grammar_sentences (
    level             TEXT NOT NULL,
    pattern           TEXT NOT NULL,
    sentences         JSONB NOT NULL,
    generator_version TEXT NOT NULL,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (level, pattern)
);

-- Owned by routes/phrase.py -- the deep-tier (LLM) analysis cache for
-- the phrase analyzer, keyed by phrase+lang (see _phrase_key /
-- CACHE_VERSION). No expiry: permanent and shared across all callers
-- of the same (phrase, lang) pair.
CREATE TABLE phrase_analysis_cache (
    phrase_key TEXT PRIMARY KEY,
    phrase     TEXT NOT NULL,
    result     JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Owned by srs/srs.py -- xp_ledger is the append-only source of truth
-- for XP awarded outside a review (source/ref identify what earned it).
CREATE TABLE xp_ledger (
    id          BIGSERIAL PRIMARY KEY,
    user_id     TEXT NOT NULL,
    source      TEXT NOT NULL,
    ref         TEXT,
    xp          INTEGER NOT NULL,
    awarded_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_xp_ledger_user
ON xp_ledger(user_id);

-- Owned by core/credits.py (plan 069) -- the credit ledger, append-only
-- like xp_ledger: a signed row per refill ('refill', the daily +30 at
-- the learner's midnight), fare ('review', -1 a review), grant ('grant':
-- the seed a new account starts with, or a hand-out) or correction
-- ('adjust'). The balance is SUM(delta) and never a column of its own.
-- ref names what the row is about (a card id, a day). Shadow mode by
-- default: nothing is blocked until CREDITS_ENFORCE=1.
CREATE TABLE credit_ledger (
    id       BIGSERIAL PRIMARY KEY,
    user_id  TEXT NOT NULL,
    delta    INTEGER NOT NULL,
    reason   TEXT NOT NULL,
    ref      TEXT,
    at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_credit_ledger_user
ON credit_ledger(user_id);

-- Owned by routes/translation.py -- translation-mode study log,
-- mirrors reading_log/comprehension_log's shape for the same feature
-- family.
CREATE TABLE translation_log (
    id                  BIGSERIAL PRIMARY KEY,
    user_id             TEXT NOT NULL,
    level               TEXT NOT NULL DEFAULT '',
    phase               TEXT NOT NULL,
    translation_prompt  TEXT NOT NULL,
    phrase              TEXT NOT NULL,
    romaji              TEXT NOT NULL,
    answer              TEXT NOT NULL,
    correct             BOOLEAN NOT NULL,
    -- The rating the learner gave on the six-segment bar, 0..5 worst to
    -- best, as RatingBar emits it. NULL on every row written before the
    -- screen graded that way -- which means "graded, resolution
    -- unknown", not a score of zero. `correct` is derived from it
    -- (q > 2 is a pass) and kept so existing readers still work.
    quality             SMALLINT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Created at runtime by routes/translation.py alongside the table --
-- declared here late, so this file shows the same shape a running
-- install actually has. (created_at ascending: a btree scans either
-- way, so it serves /api/translation/history's ORDER BY ... DESC.)
CREATE INDEX idx_translation_log_user
ON translation_log(user_id, created_at);

-- 書取 (dictation): one row per clip transcribed. Owned by
-- routes/dictation.py, created there at import time.
--
-- Two columns the other practice logs do not have. `accuracy` is the
-- SERVER's measurement of the transcription, 0..100 (difflib's ratio
-- over the folded text -- see study/dictation.measure), and it sits
-- beside `quality`, the learner's own rating, rather than instead of
-- it: one is measured and one is an opinion, they are different facts,
-- and the interesting question over a month is where they disagree.
-- `correct` is derived from `quality` (q > 2 is a pass), the way every
-- other practice log derives it. `plays` is how many times the clip was
-- heard, as the player reports it; the mode allows two.
--
-- clip_id is the audio's content key (study/dictation.clip_id), which
-- is derived from the line's own text -- so a row survives the bank
-- being reordered, and stops resolving rather than silently resolving
-- to a DIFFERENT line if that line is ever reworded. `phrase` is stored
-- beside it so the history reads without a lookup either way.
CREATE TABLE dictation_log (
    id          BIGSERIAL PRIMARY KEY,
    user_id     TEXT NOT NULL,
    level       TEXT NOT NULL DEFAULT '',
    clip_id     TEXT NOT NULL,
    phrase      TEXT NOT NULL,
    answer      TEXT NOT NULL,
    correct     BOOLEAN NOT NULL,
    accuracy    SMALLINT NOT NULL,
    -- The rating the learner gave on the bar, 0..5 worst to best.
    -- NULL on a row written while the server was the grader, which
    -- means "graded by the machine alone", not a score of zero.
    quality     SMALLINT,
    plays       SMALLINT NOT NULL DEFAULT 0,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- created_at ascending: a btree scans either way, so it serves
-- /api/dictation/history's ORDER BY ... DESC.
CREATE INDEX idx_dictation_log_user
ON dictation_log(user_id, created_at);

-- Owned by routes/ocr.py -- per-user daily counter for the vision OCR
-- endpoint. Nothing here costs money (NVIDIA's vision models are on the
-- free tier), so this bounds draw on the SHARED free quota that the
-- analyzer's deep tier and exam generation also depend on: one client
-- in a retry loop would otherwise degrade those too.
CREATE TABLE ocr_usage (
    user_id  TEXT NOT NULL,
    day      DATE NOT NULL,
    count    INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (user_id, day)
);

-- ── 足跡 — the trail of screens a learner walked ─────────────────────
-- Owned by core/events.py, written by routes/events.py (a batch the
-- client queues and flushes) and by core/credits.py (the fare gate's
-- shadow-mode refusals, which used to reach stdout and nothing else).
--
-- Nothing a learner TYPED is ever in here. `props` carries enums,
-- numbers and route PATTERNS -- never a path with a theme or deck name
-- in it, never a dictation answer, never an analysed sentence. That is
-- enforced by a closed name set and a per-name key allowlist in
-- core/events.py, applied to whatever a browser posts rather than
-- trusted to it. See docs/adr/0012.
CREATE TABLE event_log (
    id      BIGSERIAL PRIMARY KEY,
    user_id TEXT NOT NULL,
    name    TEXT NOT NULL,
    props   JSONB NOT NULL DEFAULT '{}'::jsonb,
    at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- (user_id, at) reads one learner's trail in order; (name, at) is what
-- the weekly digest counts across everyone.
CREATE INDEX idx_event_log_user_at ON event_log(user_id, at);
CREATE INDEX idx_event_log_name_at ON event_log(name, at);

-- The rolled-up half, on review_daily's model and for the same reason:
-- screen_view is the volume driver and this database is shared with the
-- review history. scripts/compact_events.py folds raw rows in here and
-- then deletes them past thirty days, except the once-per-learner
-- families (boarding, the fare gate) which a rollup cannot answer --
-- "did the people who stopped at the level step ever come back" needs
-- the rows, not the counts. Empty until that script is run, which is
-- exactly today's behaviour.
CREATE TABLE event_daily (
    user_id TEXT NOT NULL,
    day     DATE NOT NULL,
    name    TEXT NOT NULL,
    n       INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (user_id, day, name)
);
