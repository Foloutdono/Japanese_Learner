-- This file is NOT the source of truth for the schema -- every table
-- here is self-migrated at import time by the module that owns it
-- (CREATE TABLE IF NOT EXISTS, run on every startup; see the
-- comments throughout this file for which module owns which table).
-- It exists as a fast way to stand up a fresh dev/test database in
-- one shot (see CLAUDE.md's Local Postgres section) and as a single
-- place to read the whole schema at a glance. backend/tests/
-- test_schema_declared.py keeps it honest: it fails if a table any
-- module creates isn't declared here.

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
    rating_scale TEXT
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

-- decks, custom_cards, and deck_cards — the whole custom-deck
-- feature's schema — are self-migrated by decks.py at import time
-- (_ensure_deck_schema), same pattern SRSEngine uses for cards/
-- card_modes/review_log. Listed here for reference, not a migration
-- you need to run by hand. (Earlier versions of this file assumed
-- decks/custom_cards already existed elsewhere and only self-migrated
-- deck_cards — they didn't, which crashed every /api/decks request
-- with UndefinedTable. All three are created together now, in
-- dependency order, so decks.py is fully self-contained.)

CREATE TABLE decks (
    id BIGSERIAL PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'mixed',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_decks_user
ON decks(user_id);

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

-- Owned by routes/daruma.py -- the Daruma gamification feature's
-- per-user token balance and per-period goal-claim state.
CREATE TABLE daruma_state (
    user_id TEXT PRIMARY KEY,
    tokens INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE daruma_goals (
    user_id     TEXT NOT NULL,
    goal_id     TEXT NOT NULL,
    period_key  TEXT NOT NULL,
    vowed_at    TIMESTAMPTZ,
    claimed_at  TIMESTAMPTZ,
    reward_xp   INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (user_id, goal_id, period_key)
);

CREATE INDEX idx_daruma_goals_user
ON daruma_goals(user_id, claimed_at);

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
-- for XP awards (source/ref identify what earned it, e.g. a review or
-- a Daruma goal claim); streak_mends records days a broken streak was
-- repaired with a mend, for streak-calculation purposes only.
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

CREATE TABLE streak_mends (
    user_id   TEXT NOT NULL,
    mend_day  DATE NOT NULL,
    mended_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, mend_day)
);

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

-- Owned by routes/cosmetics.py -- unlocked cosmetic items and the
-- currently-equipped item per slot. user_loadout's slot columns are
-- generated from cosmetics.SLOTS in code (one nullable TEXT column
-- per slot); listed here as of the slots that exist today -- adding a
-- slot there requires adding the matching column here too, since this
-- file's own migration is a plain CREATE, not the ALTER loop
-- routes/cosmetics.py runs for existing rows.
CREATE TABLE user_cosmetics (
    user_id      TEXT NOT NULL,
    cosmetic_id  TEXT NOT NULL,
    unlocked_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    seen         BOOLEAN NOT NULL DEFAULT FALSE,
    PRIMARY KEY (user_id, cosmetic_id)
);

CREATE TABLE user_loadout (
    user_id   TEXT PRIMARY KEY,
    paper     TEXT,
    ring      TEXT,
    seal      TEXT,
    title     TEXT,
    backdrop  TEXT,
    flourish  TEXT,
    brush     TEXT,
    mcq       TEXT
);
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
