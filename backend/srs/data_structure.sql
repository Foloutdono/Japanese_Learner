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
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE phrase_history (
    id BIGSERIAL PRIMARY KEY,
    user_id TEXT NOT NULL,
    phrase TEXT NOT NULL,
    result JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_phrase_history_user
ON phrase_history(user_id, created_at DESC);

CREATE TABLE reading_log (
    id BIGSERIAL PRIMARY KEY,
    user_id TEXT NOT NULL,
    level TEXT NOT NULL,
    phase TEXT NOT NULL,
    phrase TEXT NOT NULL,
    romaji TEXT NOT NULL,
    answer TEXT NOT NULL,
    correct BOOLEAN NOT NULL,
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
--
-- The user's own hand-authored cards remain in custom_cards below,
-- unchanged — this table only ever holds *references* into the
-- read-only deck data, never a copy of it.
--
-- Self-migrated by decks.py at import time (_ensure_deck_schema),
-- same pattern SRSEngine uses for cards/card_modes/review_log —
-- listed here for reference, not a migration you need to run by hand.
-- No FK to decks(id): decks.py may import before that table exists in
-- startup order, so membership rows are cleaned up explicitly in
-- delete_deck instead of relying on ON DELETE CASCADE.
CREATE TABLE deck_cards (
    deck_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    source TEXT NOT NULL,        -- 'kanji' | 'vocab' | 'grammar' (kana/dictionary: future)
    level TEXT NOT NULL,         -- JLPT level the entry lives under, e.g. 'N5'
    raw_id TEXT NOT NULL,        -- kanji_to_id / vocab_to_id / grammar_to_id output
    added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (deck_id, source, raw_id)
);

CREATE INDEX idx_deck_cards_deck
ON deck_cards(deck_id, user_id);

-- Referenced by decks.py but not shown here since I don't yet have
-- their definitions — `decks` (id, user_id, name, type, created_at)
-- and `custom_cards` (id, deck_id, user_id, front, back, kana, hint,
-- notes, created_at). Both are assumed to already exist elsewhere in
-- the schema (decks.py doesn't self-migrate them the way it does
-- deck_cards above) — worth pasting their real CREATE TABLE here too
-- next time this file gets updated, so the whole deck feature's
-- schema lives in one place.