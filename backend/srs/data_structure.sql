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