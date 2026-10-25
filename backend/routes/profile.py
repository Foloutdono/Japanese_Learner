import csv
import io
import json
import logging
import random
import re
import unicodedata
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import PlainTextResponse
from psycopg2 import errors as pg_errors
from pydantic import BaseModel, field_validator

from core.db import db_conn
from core.rls import enable_rls
from core.auth import get_user_id, prefixed
from core.srs_instance import srs
from core.user_level import LEVELS, note_stored_level
from core import credits, events, learner_modes, review_plan
from core.lines import clean_lines
from srs.xp import level_progress, next_milestone
from study import banzuke, level_fit, level_rule, main_modes
from routes import feedback as feedback_routes
from routes import transfer as transfer_routes

router = APIRouter()
logger = logging.getLogger(__name__)

# ── user_profiles bootstrap ──────────────────────────────────
# Lightweight and separate from the SRS engine's own _init_db (this
# table isn't SRS data) — created once, here, using the same db_conn()
# stats.py already reaches for outside the SRS engine's connection pool.
def _init_db() -> None:
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("""
                CREATE TABLE IF NOT EXISTS user_profiles (
                    user_id TEXT PRIMARY KEY,
                    username TEXT NOT NULL UNIQUE,
                    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    jlpt_level TEXT,
                    daily_new_target INTEGER,
                    onboarded_at TIMESTAMPTZ,
                    goal_start_level TEXT,
                    goal_level TEXT,
                    goal_target_date DATE,
                    goal_set_at TIMESTAMPTZ,
                    daily_departure TEXT,
                    rating_scale TEXT
                )
            """)
            enable_rls(cur, "user_profiles")
            # And the same columns again as ALTERs, because the table
            # already exists for every current user: CREATE TABLE IF
            # NOT EXISTS is a no-op on them, so onboarding's fields
            # would otherwise only exist for brand-new installs.
            # jlpt_level is the learner's own JLPT level (N5..N1) — a
            # different concept from the XP level this module also
            # serves; see core/user_level.py and docs/adr/0005. All
            # three stay NULL until the onboarding flow completes;
            # NULL onboarded_at is what makes the frontend show it.
            #
            # The goal_* columns are the journey contract (plan 063):
            # goal_level + goal_target_date are the destination printed
            # on the pass (both NULL = "just ride"), goal_start_level
            # remembers where the line began — jlpt_level moves as the
            # learner levels up, and itemsTotal must not drift with it —
            # and goal_set_at anchors the itemsDone window. All written
            # only by routes/onboarding.py and routes/journey.py.
            # daily_departure is the optional habit hour ('am'|'noon'|
            # 'pm', NULL = flexible), validated in code like jlpt_level.
            #
            # rating_scale is which rating bar the learner grades with —
            # 'simple' (the four buttons they actually use), 'binary'
            # (just wrong and correct) or 'full' (all six). NULL means
            # "not chosen", which reads as the default; see
            # RATING_SCALES below and
            # frontend/src/domain/ratingScales.js, which owns the
            # buttons themselves. Deliberately NOT a change of scale:
            # both bars send the same 0..5 quality, so a learner can
            # switch without their own history changing meaning.
            #
            # The credits columns (plan 069, core/credits.py):
            # credits_accrued_at is the refill's clock (plan 141) — the
            # instant the next credit is counted from, moved on by each
            # claim and doubling as the lock that keeps two workers from
            # paying the same credits out twice; credits_refilled_on is
            # the local day the last lump refill (or the seed) was taken
            # under the midnight rule it replaced, written no more and
            # read once, to start a clock that has never run where the
            # old rule left off; plan/plan_until are the entitlement
            # ('free' | 'pass', with an optional expiry — set by hand
            # until a purchase flow exists); tz_offset_min is the
            # device's offset east of UTC, PATCHed on boot, so the
            # learner's day is theirs rather than the server's.
            #
            # The boarding's own answers (plan 075, routes/onboarding.py):
            # motive is why the learner is here (the plan screen's two
            # promise lines come from it), kana_known which scripts they
            # already read ('hiragana' | 'katakana' | 'both' | 'none' --
            # the sets marked known at the boarding), reminder_time the
            # daily nudge's hour ('HH:MM', NULL = none) and notifications
            # whether they said yes to it. The native shell (plan 076)
            # reads the last two on boot to schedule the local reminder.
            # lines is which of vocab / kanji / grammar the learner
            # chose to ride (core/lines.py); NULL reads as all three.
            for col, typ in (
                ("jlpt_level", "TEXT"),
                ("daily_new_target", "INTEGER"),
                ("onboarded_at", "TIMESTAMPTZ"),
                ("goal_start_level", "TEXT"),
                ("goal_level", "TEXT"),
                ("goal_target_date", "DATE"),
                ("goal_set_at", "TIMESTAMPTZ"),
                ("daily_departure", "TEXT"),
                ("rating_scale", "TEXT"),
                ("credits_refilled_on", "DATE"),
                ("credits_accrued_at", "TIMESTAMPTZ"),
                ("plan", "TEXT DEFAULT 'free'"),
                ("plan_until", "TIMESTAMPTZ"),
                ("tz_offset_min", "INTEGER"),
                ("motive", "TEXT"),
                ("kana_known", "TEXT"),
                ("reminder_time", "TEXT"),
                ("notifications", "BOOLEAN NOT NULL DEFAULT FALSE"),
                ("lines", "TEXT[]"),
                # 試乗 — the first ride (plan 097). tutorial_at is when
                # the two rides after the boarding ended, finished or
                # skipped (a learner who skipped is not asked again;
                # Settings is the way back). guided maps a gate id
                # ('today' | 'learn' | 'practice' | 'dictionary' |
                # 'profile') to the ISO time its guide ended -- a map
                # rather than five columns because the set of gates is
                # the frontend's (config/tabs.js) to change, and a
                # sixth gate must not be a migration. Both written only
                # by routes/onboarding.py. NULL / {} until the ride runs;
                # scripts/backfill_first_ride.py stamps the accounts
                # that boarded before it existed.
                ("tutorial_at", "TIMESTAMPTZ"),
                ("guided", "JSONB NOT NULL DEFAULT '{}'::jsonb"),
                # How long a sentence stays up in 読解 and the first
                # ride, and how long a comprehension text is read before
                # its questions: 'standard', 'relaxed' (x1.5), 'slow'
                # (x2) or 'untimed' -- for a slow reader, a dyslexic
                # one, anyone the clock is the obstacle for rather than
                # the exercise. NULL reads as standard; see READING_PACES
                # below and frontend/src/domain/readingPace.js, which
                # owns the factors. The server's own figures
                # (display_seconds, read_seconds) stay the standard
                # pace's: the client scales them.
                ("reading_pace", "TEXT"),
                # 回復運転 — the review plan (plan 217): the learner's
                # own ceiling on the day's reviews, a catch-up chosen
                # on the comeback sheet, "all of them now" said on a
                # day, and an absence declared ahead. All NULL is the
                # gate as it always was. See core/review_plan.py.
                *review_plan.COLUMNS,
                # 足跡を残さない — the account asked not to be counted
                # (plan 218). Réglages › Données writes it beside the
                # browser's own flag; core/events.opted_out reads it on
                # both write paths, so the server's events and every
                # other device stop too.
                ("analytics_off", "BOOLEAN NOT NULL DEFAULT FALSE"),
                # 乗換 — when Today's sheet asked whether the learner
                # studied elsewhere (plan 243b), answered either way, or
                # an import made the question moot. NULL is not asked
                # yet; routes/transfer.py writes and reads it.
                ("transfer_offered_at", "TIMESTAMPTZ"),
                # When Today asked how the learner finds the app, once
                # the XP was earned (plan 269): answered with a rating
                # or shut. NULL is not asked yet; routes/feedback.py
                # writes and reads it.
                ("feedback_asked_at", "TIMESTAMPTZ"),
                # 主 — the mode each line is ridden in, {line: mode},
                # and the modes added to Today beside it, {line: [mode]}
                # (plan 273, study/main_modes.py). NULL is never chosen:
                # every line in its default, nothing added.
                ("main_modes", "JSONB"),
                ("extra_modes", "JSONB"),
                # 署名 — the first name the card prints (plan 247), in
                # any script: not the username, which stays the public
                # handle. NULL = never asked (an account boarded before
                # the card was the form, whose card prints its
                # username); '' = asked and left empty, printed as no
                # name. See clean_card_name below.
                ("card_name", "TEXT"),
                # 番付に載らない — the learner keeps off the board (plan
                # 262): left out of every list another learner reads,
                # still shown their own place. study/banzuke.py reads it.
                ("board_hidden", "BOOLEAN NOT NULL DEFAULT FALSE"),
                # The interface language the learner chose in Réglages ›
                # Affichage ('fr' | 'en'); NULL = never chosen, so the
                # device's language applies. Kept here as well as in the
                # browser, which forgets (cleared storage, a second
                # device): the app copies it back on boot, and nothing
                # but the learner's own choice writes it. See
                # frontend/src/lib/langChoice.js.
                ("ui_lang", "TEXT"),
            ):
                cur.execute(
                    f"ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS {col} {typ}"
                )
            # 回数券 — the credit ledger (plan 069). Append-only, like
            # xp_ledger: the balance is SUM(delta), never a column. See
            # core/credits.py for the economy and the shadow mode.
            cur.execute("""
                CREATE TABLE IF NOT EXISTS credit_ledger (
                    id      BIGSERIAL PRIMARY KEY,
                    user_id TEXT NOT NULL,
                    delta   INTEGER NOT NULL,
                    reason  TEXT NOT NULL,
                    ref     TEXT,
                    at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
                )
            """)
            enable_rls(cur, "credit_ledger")
            cur.execute("CREATE INDEX IF NOT EXISTS idx_credit_ledger_user ON credit_ledger(user_id)")
            # 止 — where the credits stopped a learner (plan 172): a
            # row a stop, `cards` the reviews it kept waiting. Shadow
            # mode writes one for each review it would have refused;
            # under enforcement the app writes what was left of the run
            # the balance stopped. The offer's week reads it
            # (core/credits.week).
            cur.execute("""
                CREATE TABLE IF NOT EXISTS credit_stops (
                    id      BIGSERIAL PRIMARY KEY,
                    user_id TEXT NOT NULL,
                    cards   INTEGER NOT NULL,
                    at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
                )
            """)
            enable_rls(cur, "credit_stops")
            cur.execute("CREATE INDEX IF NOT EXISTS idx_credit_stops_user ON credit_stops(user_id, at)")
        conn.commit()
    finally:
        conn.close()


try:
    _init_db()
except Exception:  # pragma: no cover - a missing DB must not stop import
    logger.exception("user_profiles could not be initialised")

# ── Username generation ──────────────────────────────────────
_ADJECTIVES = ["Swift", "Silent", "Lucky", "Bold", "Calm", "Bright", "Quiet", "Keen"]
_NOUNS = ["Ronin", "Kitsune", "Sensei", "Samurai", "Ninja", "Sakura", "Tsuki", "Hikari"]

USERNAME_RE = re.compile(r"^[a-zA-Z0-9_]{3,20}$")


def _random_username() -> str:
    return f"{random.choice(_ADJECTIVES)}{random.choice(_NOUNS)}{random.randint(100, 9999)}"


# ── 署名 — the name on the card (plan 247) ────────────────────
# The boarding's card asks for a first name rather than a handle: any
# script, spaces and hyphens and all, up to CARD_NAME_MAX characters,
# and nothing at all is an answer. It is printed on the learner's own
# card, so it needs no uniqueness -- two Camilles are two Camilles --
# which is what made the old name step refuse a common name as "taken"
# (the username is UNIQUE, and stays the public handle, which a first
# boarding takes from the name when it can: plan 247b, below).
CARD_NAME_MAX = 24
# The two joiners some scripts spell names with (Persian's ZWNJ, an
# Indic conjunct's ZWJ); every other control or format character is
# dropped rather than stored on a card.
_JOINERS = {"\u200c", "\u200d"}


def clean_card_name(value: str) -> str:
    """The name as the card prints it: NFC, its runs of spaces one
    space, its ends trimmed, no control or format character but the two
    joiners. Longer than CARD_NAME_MAX once cleaned is a ValueError (a
    422 to the client, whose field stops at the same length)."""
    # Whitespace first, so a tab or a line break between two names
    # stays the space it stood for; then what no card prints.
    text = " ".join(unicodedata.normalize("NFC", value).split())
    text = "".join(
        ch for ch in text
        if ch in _JOINERS or unicodedata.category(ch) not in ("Cc", "Cf")
    )
    text = " ".join(text.split())
    if len(text) > CARD_NAME_MAX:
        raise ValueError(f"at most {CARD_NAME_MAX} characters")
    return text


# ── The handle a first name spells (plan 247b) ────────────────
# The boarding's first name is also the learner's public handle when its
# Latin letters make one: the username is the name if nobody holds it,
# the name and the first number free (Tifa, Tifa2, Tifa3) if somebody
# does. Only the first boarding does
# it, and only over the handle the app drew (a learner's own pick is
# never replaced), so a replay or a later rename leaves the handle
# where it is: it is on the 番付 and under every published deck.
_GENERATED_RE = re.compile(rf"^(?:{'|'.join(_ADJECTIVES)})(?:{'|'.join(_NOUNS)})\d{{3,4}}$")
USERNAME_MAX = 20
# Letters NFKD does not take apart (é and ñ become e and n by themselves).
_LETTERS = str.maketrans({
    "ß": "ss", "æ": "ae", "Æ": "AE", "œ": "oe", "Œ": "OE",
    "ø": "o", "Ø": "O", "ł": "l", "Ł": "L", "đ": "d", "Đ": "D",
})


def handle_from_name(card_name: str) -> str:
    """The Latin letters and digits of a card name, accents folded and
    spaces and hyphens closed up ("José-María" -> "JoseMaria"), cut to
    the username's length. '' when none survive (さくら, مریم): such a
    learner keeps the handle the app drew."""
    folded = unicodedata.normalize("NFKD", card_name.translate(_LETTERS))
    return "".join(ch for ch in folded if ch.isascii() and ch.isalnum())[:USERNAME_MAX]


def _handle_candidates(base: str):
    """The name as it is, when it is long enough to be a username, then
    the name numbered 2, 3, ... 999 (a long name gives up letters to its
    number, within USERNAME_MAX). In order and without chance, so the
    migration's report is what its run does."""
    if len(base) >= 3:
        yield base
    for n in range(2, 1000):
        digits = str(n)
        yield f"{base[:USERNAME_MAX - len(digits)]}{digits}"


def claim_handle_with(cur, user_id: str, card_name: str) -> str | None:
    """Make the username the one the card name spells, on `cur`'s
    transaction (the caller commits), and return it; None when the
    learner keeps the handle they have (the name has no Latin letters,
    the handle is not the one the app drew, or every candidate was
    taken). A name is taken whatever its case: "tifa" is not offered
    beside "Tifa"."""
    base = handle_from_name(card_name)
    if not base:
        return None
    cur.execute("SELECT username FROM user_profiles WHERE user_id = %s", (user_id,))
    row = cur.fetchone()
    if not row or not _GENERATED_RE.match(row[0]):
        return None
    for candidate in _handle_candidates(base):
        cur.execute(
            "SELECT 1 FROM user_profiles WHERE lower(username) = lower(%s) AND user_id <> %s",
            (candidate, user_id),
        )
        if cur.fetchone():
            continue
        # A savepoint, so a refusal leaves the caller's transaction (the
        # migration's, with every handle it has moved) standing.
        cur.execute("SAVEPOINT claim_handle")
        try:
            cur.execute(
                "UPDATE user_profiles SET username = %s WHERE user_id = %s",
                (candidate, user_id),
            )
        except pg_errors.UniqueViolation:
            # Somebody took the same name between the check and the
            # write: the next candidate.
            cur.execute("ROLLBACK TO SAVEPOINT claim_handle")
            continue
        cur.execute("RELEASE SAVEPOINT claim_handle")
        return candidate
    return None


def claim_handle(user_id: str, card_name: str) -> str | None:
    """claim_handle_with, in a transaction of its own."""
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            handle = claim_handle_with(cur, user_id, card_name)
        conn.commit()
        return handle
    finally:
        conn.close()


def _get_or_create_username(user_id: str) -> str:
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT username FROM user_profiles WHERE user_id = %s", (user_id,))
            row = cur.fetchone()
            if row:
                return row[0]

            # Lazily seed a profile the first time this user is seen —
            # retry on the (very unlikely) random-name collision rather
            # than failing the request.
            #
            # A new account's boot asks twice at once (App.jsx's PATCH
            # /api/profile/learning beside its GET /api/profile), and
            # both find no row. The second INSERT then collides on
            # user_id, not on the name: without ON CONFLICT it read as
            # five name collisions and answered 500, the first request
            # of every new learner. The row the other request wrote is
            # the one to return.
            for _ in range(5):
                candidate = _random_username()
                try:
                    cur.execute(
                        """
                        INSERT INTO user_profiles(user_id, username) VALUES (%s, %s)
                        ON CONFLICT (user_id) DO NOTHING
                        RETURNING username
                        """,
                        (user_id, candidate),
                    )
                    created = cur.fetchone()
                    conn.commit()
                    if created:
                        return created[0]
                    cur.execute("SELECT username FROM user_profiles WHERE user_id = %s", (user_id,))
                    return cur.fetchone()[0]
                except pg_errors.UniqueViolation:
                    conn.rollback()
            raise HTTPException(status_code=500, detail="Could not allocate a username")
    finally:
        conn.close()


def ensure_profile_row(user_id: str) -> str:
    """Public seam for other route modules (routes/onboarding.py): make
    sure a user_profiles row exists before UPDATEing it, and get the
    username back. Same lazy-seeding as GET /api/profile itself."""
    return _get_or_create_username(user_id)


def _profile_row(user_id: str) -> tuple:
    """(username, jlpt_level, daily_new_target, onboarded_at,
    rating_scale, motive, kana_known, reminder_time, notifications,
    lines, tutorial_at, guided, reading_pace, analytics_off, card_name) —
    seeding the row lazily like _get_or_create_username, whose creation
    path it reuses. The onboarding fields are NULL until the flow runs,
    and rating_scale and reading_pace until the learner changes them."""
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT username, jlpt_level, daily_new_target, onboarded_at,
                       rating_scale, motive, kana_known, reminder_time,
                       notifications, lines, tutorial_at, guided,
                       reading_pace, analytics_off, card_name
                FROM user_profiles WHERE user_id = %s
                """,
                (user_id,),
            )
            row = cur.fetchone()
            if row:
                return row
    finally:
        conn.close()
    return (_get_or_create_username(user_id), None, None, None, None, None, None, None, False, None, None, {}, None, False, None)


def _ui_lang(user_id: str) -> str | None:
    """The interface language the learner chose, or None if never. Read
    apart from _profile_row, whose tuple half the server unpacks."""
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT ui_lang FROM user_profiles WHERE user_id = %s", (user_id,))
            row = cur.fetchone()
    finally:
        conn.close()
    value = (row["ui_lang"] if isinstance(row, dict) else row[0]) if row else None
    return value if value in UI_LANGS else None


def usernames_for(user_ids: list[str]) -> dict[str, str]:
    """
    The display name for each of these user ids, in one round trip.

    Public, and deliberately so: it is the seam any surface that names
    OTHER learners goes through — the leaderboard below, and the deck
    library's attribution (routes/decks.py). Every user has a username
    from first sight (ensure_profile_row), so a missing key here means a
    row that is genuinely gone, not one that was never written.
    """
    if not user_ids:
        return {}
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT user_id, username FROM user_profiles WHERE user_id = ANY(%s)",
                (user_ids,),
            )
            return dict(cur.fetchall())
    finally:
        conn.close()


class ProfilePayload(BaseModel):
    """The two names, each optional, at least one sent: the username is
    the public handle (番付, the library), unique and in Latin letters;
    cardName the first name the card prints (plan 247), any script, ''
    for none."""
    username: str | None = None
    cardName: str | None = None

    @field_validator("username")
    @classmethod
    def valid_username(cls, v: str | None) -> str | None:
        if v is not None and not USERNAME_RE.match(v):
            raise ValueError("3-20 characters: letters, numbers, underscore only")
        return v

    @field_validator("cardName")
    @classmethod
    def valid_card_name(cls, v: str | None) -> str | None:
        return None if v is None else clean_card_name(v)


# Which rating bar the learner grades with. The buttons live in
# frontend/src/domain/ratingScales.js; the backend only stores the
# choice, because both bars send the same canonical 0..5 quality (see
# srs/scheduler.py's PASS/FAIL tables) and nothing downstream needs to
# know which one was on screen.
RATING_SCALES = ("binary", "simple", "full")
DEFAULT_RATING_SCALE = "simple"

# How long the reading exercises leave the text up. The factors live in
# frontend/src/domain/readingPace.js; the backend only stores the
# choice, because the clock runs in the browser and every figure the
# server hands out (display_seconds, read_seconds) is the standard
# pace's, scaled there.
READING_PACES = ("standard", "relaxed", "slow", "untimed")
DEFAULT_READING_PACE = "standard"


# The interface languages (frontend/src/lib/locale.js SUPPORTED_LANGS).
UI_LANGS = ("fr", "en")


class LearningPayload(BaseModel):
    """Settings' partial update of the onboarding fields. All optional;
    a PATCH sending none of them is a caller bug and 422s. Deliberately
    never touches onboarded_at — changing your level later is not
    re-onboarding."""
    jlptLevel: str | None = None
    dailyNewTarget: int | None = None
    ratingScale: str | None = None
    # How long the reading exercises leave the text up (READING_PACES).
    readingPace: str | None = None
    # The device's UTC offset in minutes, east positive (the app sends
    # -Date.getTimezoneOffset()), so the daily allowances reset at the
    # learner's midnight (core/credits.resets_at). Sent on every boot.
    tzOffsetMin: int | None = None
    # The lines to ride from now on (core/lines.py): a non-empty subset
    # of vocab / kanji / grammar. Settings › Learning's toggles.
    lines: list[str] | None = None
    # The daily nudge on or off, from Settings › Notifications (plan
    # 156). The boarding asked once; this is where the answer changes.
    notifications: bool | None = None
    # The trail's switch (plan 218), from Réglages › Données: True asks
    # not to be counted, on every device and by the server too
    # (core/events.opted_out).
    analyticsOff: bool | None = None
    # 番付に載らない (plan 262), from the board's own page: True keeps
    # the learner off every board another learner reads.
    boardHidden: bool | None = None
    # The interface language the learner picked (UI_LANGS), from Réglages
    # › Affichage; sent on a change and again at boot when the account
    # has not heard it.
    uiLang: str | None = None
    # 主 (plan 273): the mode a line is ridden in, {line: mode}, from
    # Réglages › Modes principaux, and the modes added to Today beside
    # it, {line: [mode]}, from Today's services. Each line sent replaces
    # that line alone; the lines not sent keep theirs.
    mainModes: dict[str, str] | None = None
    extraModes: dict[str, list[str]] | None = None
    # With a main mode changed: False starts the new mode from zero
    # rather than marking what the old one mastered known in it.
    # Unsent is True, the carry the confirm sheet leads with.
    carryKnown: bool | None = None

    @field_validator("mainModes")
    @classmethod
    def valid_main_modes(cls, v):
        return main_modes.clean_main(v)

    @field_validator("extraModes")
    @classmethod
    def valid_extra_modes(cls, v):
        return main_modes.clean_extra(v)

    @field_validator("uiLang")
    @classmethod
    def valid_ui_lang(cls, v: str | None) -> str | None:
        if v is not None and v not in UI_LANGS:
            raise ValueError(f"must be one of {', '.join(UI_LANGS)}")
        return v

    @field_validator("lines")
    @classmethod
    def valid_lines(cls, v: list[str] | None) -> list[str] | None:
        return clean_lines(v)

    @field_validator("tzOffsetMin")
    @classmethod
    def valid_tz(cls, v: int | None) -> int | None:
        # -14:00 .. +14:00 is the whole planet.
        if v is not None and not (-840 <= v <= 840):
            raise ValueError("must be between -840 and 840")
        return v

    @field_validator("ratingScale")
    @classmethod
    def valid_rating_scale(cls, v: str | None) -> str | None:
        if v is not None and v not in RATING_SCALES:
            raise ValueError(f"ratingScale must be one of {RATING_SCALES}")
        return v

    @field_validator("readingPace")
    @classmethod
    def valid_reading_pace(cls, v: str | None) -> str | None:
        if v is not None and v not in READING_PACES:
            raise ValueError(f"readingPace must be one of {READING_PACES}")
        return v

    @field_validator("jlptLevel")
    @classmethod
    def valid_level(cls, v: str | None) -> str | None:
        if v is not None and v not in LEVELS:
            raise ValueError(f"must be one of {', '.join(LEVELS)}")
        return v

    @field_validator("dailyNewTarget")
    @classmethod
    def valid_target(cls, v: int | None) -> int | None:
        # The UI offers 5/10/20, but the column is a free integer knob;
        # the bound only keeps out nonsense, not future paces.
        if v is not None and not (1 <= v <= 100):
            raise ValueError("must be between 1 and 100")
        return v


# ── The level rule (plan 074) ─────────────────────────────────
# Choosing a level marks the stops behind it known; see
# study/level_rule.py for the rule and SRSEngine.seed_known for the
# rows. Both halves answer in the same shape the settings sheets
# print: "up" carries what would be (or was) marked known and the
# spread, "down" what is set aside, what goes back to new (the
# assumptions never checked, plan 224) and the zero that is deleted.
def _level_direction(current: str | None, target: str) -> str:
    if current == target:
        return "same"
    if current is None or LEVELS.index(target) > LEVELS.index(current):
        return "up"
    return "down"


def level_rule_preview(user_id: str, current: str | None, target: str) -> dict:
    direction = _level_direction(current, target)
    if direction == "same":
        return {"direction": "same"}
    if direction == "up":
        marked = 0
        for _source, mode, ids in level_rule.known_batches(level_rule.stops_behind(target), learner_modes.read(user_id)):
            full = prefixed(ids, user_id)
            marked += len(full) - srs.count_rows(full, mode)
        return {"direction": "up", "markedKnown": marked, "spreadWeeks": level_rule.SPREAD_WEEKS}
    return _level_down(user_id, current, target, dry_run=True)


def _level_down(user_id: str, current: str, target: str, dry_run: bool) -> dict:
    """A move down: the assumptions from `target` up go back to new
    (SRSEngine.forget_assumed -- counted under `dry_run`), and what has
    history beyond `target` is set aside. "returned" is in rows, one per
    card in its line's primary mode, the unit seed_known wrote them in."""
    returned = sum(
        srs.forget_assumed(prefixed(ids, user_id), mode, dry_run=dry_run)
        for _source, mode, ids in level_rule.known_batches(level_rule.stops_from(target), learner_modes.read(user_id))
    )
    set_aside = sum(
        srs.count_cards_with_history(prefixed(ids, user_id))
        for ids in level_rule.item_batches(level_rule.stops_between(target, current))
    )
    if not dry_run:
        logger.info("level rule user_id=%s %s -> %s returned=%d", user_id, current, target, returned)
    return {"direction": "down", "setAside": set_aside, "returned": returned, "deleted": 0}


def apply_level_rule(user_id: str, current: str | None, target: str) -> dict:
    """Write the rule for a level just stored: seed every stop behind
    `target` (rows that exist are left alone, so the stops behind the
    previous level cost nothing a second time). A move down gives back
    the assumptions it no longer stands behind (plan 224) and deletes
    no history."""
    direction = _level_direction(current, target)
    if direction == "same":
        return {"direction": "same"}
    if direction == "down":
        return _level_down(user_id, current, target, dry_run=False)
    marked = 0
    for _source, mode, ids in level_rule.known_batches(level_rule.stops_behind(target), learner_modes.read(user_id)):
        marked += srs.seed_known(prefixed(ids, user_id), mode, spread_days=level_rule.SPREAD_DAYS)
    logger.info("level rule user_id=%s %s -> %s marked_known=%d", user_id, current, target, marked)
    return {"direction": "up", "markedKnown": marked, "spreadWeeks": level_rule.SPREAD_WEEKS}


def apply_kana_rule(user_id: str, known: str | None) -> dict:
    """The kana door (plan 075): mark the scripts the learner already
    reads known -- one row per sign in the kana line's primary mode,
    spread like the level rule's. Idempotent for the same reason; a
    replay that names MORE scripts adds only the new ones."""
    mode, ids = level_rule.kana_batch(known, learner_modes.read(user_id))
    marked = srs.seed_known(prefixed(ids, user_id), mode, spread_days=level_rule.SPREAD_DAYS) if ids else 0
    logger.info("kana rule user_id=%s known=%s marked_known=%d", user_id, known, marked)
    return {"kanaKnown": known, "markedKnown": marked, "spreadWeeks": level_rule.SPREAD_WEEKS}


# ── 主 — a line's main mode changed (plan 273) ──────────────────
# The learner chooses what the new mode starts from. By default, what
# they have mastered in the old mode is marked known in the new one,
# the level rule's way (SRSEngine.seed_known): an assumption whose first
# check is spread over the coming six weeks, a miss starting the card
# fresh (plan 224). Or nothing is carried (`carry` False) and every card
# is new in the new mode. Either way rows that exist are left alone and
# nothing is deleted: going back finds the old mode as it was, and Today
# deals a chosen mode's new cards from the lowest stop that has any
# (routes/today._new_pools), so the stops behind the level are learnt
# too.
def main_switch(user_id: str, source: str, old: str, new: str, dry_run: bool, carry: bool = True) -> dict:
    out = {"line": source, "from": old, "to": new, "carried": carry, "spreadWeeks": level_rule.SPREAD_WEEKS}
    if not carry:
        if not dry_run:
            logger.info("main mode user_id=%s %s: %s -> %s from zero", user_id, source, old, new)
        return {**out, "markedKnown": 0}
    ids = prefixed(level_rule.line_ids(source, new), user_id)
    known = srs.mastered_among(ids, old)
    if dry_run:
        marked = len(known) - srs.count_rows(known, new)
    else:
        marked = srs.seed_known(known, new, spread_days=level_rule.SPREAD_DAYS)
        logger.info("main mode user_id=%s %s: %s -> %s marked_known=%d", user_id, source, old, new, marked)
    return {**out, "markedKnown": marked}


# ── Records ───────────────────────────────────────────────────
# The three figures the pass holder prints beside the stamp book:
# reviews, retention and the best perfect run. Computed once, here,
# because they are the whole of what the profile counts.
def _records(user_id: str) -> dict:
    return {
        "total_reviews": srs.get_total_reviews(user_id),
        # Longest unbroken run of "good or better" answers — a personal
        # best, shown as such.
        "best_quality_streak": srs.get_best_quality_streak(user_id, min_quality=4),
        # Correct over all answers, 0..1 — None before the first review.
        "retention": srs.get_retention(user_id),
    }


# The stamp book on the profile draws five whole Monday-to-Sunday weeks
# ending on the current one: at most 28 days back to that week's Monday
# plus the six days before it, so 35 covers the sheet on any weekday.
CALENDAR_DAYS = 35


def _with_practice(reviews: list[dict], practice: list[dict]) -> list[dict]:
    """The stamp book's days: {date, count, practice}, oldest first.

    `count` stays the card reviews of the day, as it always was; `practice`
    is the graded sentences, texts and papers of the practice modes (plan
    178), which schedule no card and so never reached `count`. A day is
    stamped when either is above zero -- the streak counts it the same way
    (srs._studied_days) -- so the book and the number cannot disagree."""
    days: dict[str, dict] = {d["date"]: {"date": d["date"], "count": d["count"], "practice": 0} for d in reviews}
    for d in practice:
        day = days.setdefault(d["date"], {"date": d["date"], "count": 0, "practice": 0})
        day["practice"] = d["count"]
    return [days[k] for k in sorted(days)]


def _with_rest(days: list[dict], rested: list[str]) -> list[dict]:
    """The stamp book's days with the rest days marked (plan 191): a
    missed day a rest ticket bridged is `rest: True`, an entry of its
    own with nothing counted (it was not studied), so the week's stamp
    rally and the book draw the 運休 stub where they drew a miss -- the
    streak walked through that day, and the row has to say why."""
    by_date: dict[str, dict] = {d["date"]: d for d in days}
    for day in rested:
        entry = by_date.setdefault(day, {"date": day, "count": 0, "practice": 0})
        entry["rest"] = True
    return [by_date[k] for k in sorted(by_date)]


# ── 運休 and 終着 — rest days and the day cleared (plan 191) ──────
def bridge_rest_days(user_id: str) -> list:
    """srs.bridge_rest_days, with its event: the missed days a rest
    ticket covers, spent lazily on the learner's next visit: GET
    /api/profile, GET /api/today and POST /api/today/clear. A comfort,
    never a reason to fail the screen that asked.

    A declared absence is bridged first (plan 217,
    review_plan.bridge_away): its days are the learner's to keep, and a
    ticket must not be spent on one of them."""
    review_plan.bridge_away(user_id)
    try:
        days = srs.bridge_rest_days(user_id)
    except Exception:
        logger.exception("rest-day bridge failed user_id=%s", user_id)
        return []
    if days:
        events.record(user_id, "rest_day_used", {"days": len(days)})
        logger.info("rest days used user_id=%s days=%s", user_id, [d.isoformat() for d in days])
    return days


def counted_from(figures: dict, cleared: bool) -> int:
    """The streak day the next ticket is counted after (srs.streak_figures'
    `today` and whether today is cleared): today's once it is cleared,
    the day before while it is not -- a milestone today is still ahead."""
    return figures["today"] if cleared else figures["today"] - 1


# ── Routes ────────────────────────────────────────────────────
@router.get("/api/profile")
def get_profile(user_id: str = Depends(get_user_id)):
    (username, jlpt_level, daily_new_target, onboarded_at, rating_scale,
     motive, kana_known, reminder_time, notifications, lines,
     tutorial_at, guided, reading_pace, analytics_off, card_name) = _profile_row(user_id)
    xp = srs.get_lifetime_xp(user_id)
    progress = level_progress(xp)
    bridge_rest_days(user_id)
    streak = srs.streak_figures(user_id)
    cleared = srs.get_day_clear(user_id, datetime.now(timezone.utc).date()) is not None
    records = _records(user_id)

    # One query for the sheet; the week the home hall's stamp rally and
    # every other consumer of `week` still read is sliced off it rather
    # than asked for again. Same helper the stats calendar uses.
    calendar = _with_rest(
        _with_practice(
            srs.get_daily_review_counts(user_id, days=CALENDAR_DAYS),
            srs.get_daily_practice_counts(user_id, days=CALENDAR_DAYS),
        ),
        srs.get_rest_days(user_id, days=CALENDAR_DAYS),
    )
    week_from = (datetime.now(timezone.utc).date() - timedelta(days=6)).isoformat()

    return {
        "username": username,
        # 署名 (plan 247): the name the card prints. null is an account
        # that was never asked, whose card prints `username` as it always
        # has; '' was asked and printed as no name (domain/passCard.js
        # holderName is the one reading of the two).
        "cardName": card_name,
        **progress,
        # The learner's own JLPT level — deliberately NOT "level", which
        # is the XP level spread in from `progress` above. NULL until
        # onboarding completes; null onboardedAt is what tells App.jsx
        # to show the flow. See core/user_level.py and docs/adr/0005.
        "jlptLevel": jlpt_level,
        "dailyNewTarget": daily_new_target,
        "onboardedAt": onboarded_at.isoformat() if onboarded_at else None,
        # Which rating bar to draw. Resolved here rather than in the
        # client so a learner who has never opened settings still gets a
        # named scale instead of a null the bar has to guess at.
        "ratingScale": rating_scale or DEFAULT_RATING_SCALE,
        # How long the reading exercises leave the text up, resolved
        # the same way: never chosen reads as the standard pace.
        "readingPace": reading_pace or DEFAULT_READING_PACE,
        # The boarding's answers (plan 075): what the plan screen and the
        # native shell's daily reminder read back. All NULL/false until
        # the boarding runs; an account boarded before plan 075 simply
        # never answered.
        "motive": motive,
        "kanaKnown": kana_known,
        "reminderTime": reminder_time,
        "notifications": bool(notifications),
        # The lines the learner chose to ride (core/lines.py): null for
        # an account boarded before the question, which every reader
        # takes as all three.
        "lines": list(lines) if lines else None,
        # 試乗 — the first ride (plan 097). App.jsx's index route sends
        # a learner with no tutorialAt to the ride instead of /today;
        # each gate opens its guide while its id is not in `guided`.
        # Read off the same request the onboarding gate already makes,
        # so the first screen after the 改札 is decided with no second
        # round trip.
        "tutorialAt": tutorial_at.isoformat() if tutorial_at else None,
        "guided": dict(guided or {}),
        # 乗換 (plan 243b): whether Today asks, once, if the learner
        # studied elsewhere (routes/transfer.offer_open).
        "transferOffer": transfer_routes.offer_open(user_id, tutorial_at),
        # Early access (plan 269): whether Today asks, once, how the
        # learner finds the app (routes/feedback.offer_open).
        "feedbackOffer": feedback_routes.offer_open(user_id, xp),
        # 足跡を残さない (plan 218): the account's answer, which App.jsx
        # copies onto this device's flag on boot so an opt-out made on
        # the phone also stops the desk.
        "analyticsOff": bool(analytics_off),
        # 番付に載らない (plan 262): whether the learner keeps off the
        # board. Read through the board's own roster, a minute old at
        # most and dropped whenever the switch moves.
        "boardHidden": banzuke.roster().get(user_id, ("", None, False))[2],
        # The interface language the learner chose, null if never: the
        # app copies it onto the device on boot (lib/langChoice.js).
        "uiLang": _ui_lang(user_id),
        "streak": streak["current"],
        "streakLongest": streak["longest"],
        "totalReviews": records["total_reviews"],
        "bestQualityStreak": records["best_quality_streak"],
        "retention": records["retention"],
        # The last seven days of activity (the hall's stamp rally), and
        # the five weeks behind them (the profile's stamp book). Days
        # without a review are simply absent from both, but for a day a
        # rest ticket bridged (plan 191): `rest: true`, nothing counted.
        "week": [d for d in calendar if d["date"] >= week_from],
        "calendar": calendar,
        # 終着 (plan 191): the ticket book -- a ticket per milestone day
        # cleared, oldest first -- the rest days held, and the milestone
        # the next ticket is printed at.
        "tickets": srs.get_day_tickets(user_id),
        "restHeld": srs.rest_held(user_id),
        "nextMilestone": next_milestone(counted_from(streak, cleared)),
    }


@router.get("/api/profile/export")
def export_progress(user_id: str = Depends(get_user_id)):
    """
    The learner's whole SRS state as one CSV — the settings screen's
    データ counter serves it as a download.

    Raw card_modes columns rather than the stats screen's buckets: an
    export exists so the data can leave the app (a spreadsheet, Anki,
    a backup before a reset), and aggregates cannot be un-aggregated.
    One row per (card, mode), same granularity the scheduler itself
    keeps. The user prefix is stripped from card_id — it is an
    implementation detail of shared tables (see core/auth.prefixed),
    not part of the learner's data.
    """
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            # Same LIKE-prefix pattern reset_stats uses for the same rows.
            cur.execute(
                """
                SELECT card_id, mode, interval_days, next_review,
                       total_reviews, correct_reviews
                FROM card_modes
                WHERE card_id LIKE %s
                ORDER BY card_id, mode
                """,
                (f"{user_id}:%",),
            )
            rows = cur.fetchall()
    finally:
        conn.close()

    prefix_len = len(user_id) + 1
    buf = io.StringIO()
    writer = csv.writer(buf, lineterminator="\n")
    writer.writerow([
        "card_id", "mode", "interval_days", "next_review",
        "total_reviews", "correct_reviews",
    ])
    for card_id, mode, interval_days, next_review, total, correct in rows:
        writer.writerow([
            card_id[prefix_len:],
            mode,
            interval_days,
            next_review.isoformat() if next_review else "",
            total,
            correct,
        ])

    logger.info("progress export user_id=%s rows=%d", user_id, len(rows))
    return PlainTextResponse(
        buf.getvalue(),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": 'attachment; filename="nihongo-progress.csv"'},
    )


@router.get("/api/profile/export/trail")
def export_trail(user_id: str = Depends(get_user_id)):
    """
    The learner's own 足跡 as one CSV (plan 218) -- the right of access
    (GDPR art. 15) for the usage statistics, beside the progress export
    in Réglages › Données. Both halves: the raw rows still inside their
    thirty days (and the once-per-account ones kept a year), then the
    per-day counts they were folded into. `props` is the JSON the row
    holds -- enums and numbers only, which is what core/events.clean
    lets in -- and the session id is left out: it is a random token that
    means nothing outside the table.
    """
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT at, name, props FROM event_log WHERE user_id = %s ORDER BY at, id",
                (user_id,),
            )
            raw = cur.fetchall()
            cur.execute(
                "SELECT day, name, n FROM event_daily WHERE user_id = %s ORDER BY day, name",
                (user_id,),
            )
            daily = cur.fetchall()
    finally:
        conn.close()

    buf = io.StringIO()
    writer = csv.writer(buf, lineterminator="\n")
    writer.writerow(["at", "name", "count", "props"])
    for at, name, props in raw:
        writer.writerow([at.isoformat(), name, 1,
                         json.dumps(props or {}, ensure_ascii=False, sort_keys=True)])
    for day, name, n in daily:
        writer.writerow([day.isoformat(), name, n, ""])

    logger.info("trail export user_id=%s rows=%d days=%d", user_id, len(raw), len(daily))
    return PlainTextResponse(
        buf.getvalue(),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": 'attachment; filename="tsuji-usage.csv"'},
    )


@router.patch("/api/profile")
def update_profile(payload: ProfilePayload, user_id: str = Depends(get_user_id)):
    if payload.username is None and payload.cardName is None:
        raise HTTPException(status_code=422, detail="Nothing to update")
    username = _get_or_create_username(user_id)  # ensure a row exists to update
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            try:
                if payload.username is not None:
                    cur.execute(
                        "UPDATE user_profiles SET username = %s WHERE user_id = %s",
                        (payload.username, user_id),
                    )
                    username = payload.username
                if payload.cardName is not None:
                    cur.execute(
                        "UPDATE user_profiles SET card_name = %s WHERE user_id = %s",
                        (payload.cardName, user_id),
                    )
                conn.commit()
            except pg_errors.UniqueViolation:
                conn.rollback()
                raise HTTPException(status_code=409, detail="Username already taken")
    finally:
        conn.close()
    return {
        "username": username,
        **({"cardName": payload.cardName} if payload.cardName is not None else {}),
    }


@router.patch("/api/profile/learning")
def update_learning(payload: LearningPayload, user_id: str = Depends(get_user_id)):
    if not payload.model_fields_set:
        raise HTTPException(status_code=422, detail="Nothing to update")
    _get_or_create_username(user_id)  # ensure a row exists to update
    # The level the rule moves FROM, read before the write: a move up
    # seeds the stops crossed, a move down seeds nothing.
    previous_level = _profile_row(user_id)[1] if payload.jlptLevel is not None else None
    # The modes a main-mode change moves FROM, read before the write too.
    modes_before = learner_modes.read(user_id) if payload.mainModes else None
    sets, args = [], []
    if payload.jlptLevel is not None:
        sets.append("jlpt_level = %s")
        args.append(payload.jlptLevel)
    if payload.dailyNewTarget is not None:
        sets.append("daily_new_target = %s")
        args.append(payload.dailyNewTarget)
    if payload.ratingScale is not None:
        sets.append("rating_scale = %s")
        args.append(payload.ratingScale)
    if payload.readingPace is not None:
        sets.append("reading_pace = %s")
        args.append(payload.readingPace)
    if payload.tzOffsetMin is not None:
        sets.append("tz_offset_min = %s")
        args.append(payload.tzOffsetMin)
    if payload.lines is not None:
        sets.append("lines = %s")
        args.append(payload.lines)
    if payload.notifications is not None:
        sets.append("notifications = %s")
        args.append(payload.notifications)
    if payload.analyticsOff is not None:
        sets.append("analytics_off = %s")
        args.append(payload.analyticsOff)
    if payload.boardHidden is not None:
        sets.append("board_hidden = %s")
        args.append(payload.boardHidden)
    if payload.uiLang is not None:
        sets.append("ui_lang = %s")
        args.append(payload.uiLang)
    # Merged line by line: the lines sent replace theirs, the rest stay.
    if payload.mainModes is not None:
        sets.append("main_modes = COALESCE(main_modes, '{}'::jsonb) || %s::jsonb")
        args.append(json.dumps(payload.mainModes))
    if payload.extraModes is not None:
        sets.append("extra_modes = COALESCE(extra_modes, '{}'::jsonb) || %s::jsonb")
        args.append(json.dumps(payload.extraModes))
    if not sets:
        raise HTTPException(status_code=422, detail="Nothing to update")
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                f"UPDATE user_profiles SET {', '.join(sets)} WHERE user_id = %s",
                (*args, user_id),
            )
        conn.commit()
    finally:
        conn.close()
    if payload.jlptLevel is not None:
        # Write-through so this worker's resolver answers with the new
        # level immediately rather than after its TTL.
        note_stored_level(user_id, payload.jlptLevel)
    if payload.boardHidden is not None:
        # Every board kept was ranked with the learner in or out.
        banzuke.forget()
    if payload.tzOffsetMin is not None:
        # The learner's day moved with the clock; the cached state must
        # not outlive it.
        credits.forget(user_id)
    level_rule_result = (
        apply_level_rule(user_id, previous_level, payload.jlptLevel)
        if payload.jlptLevel is not None else None
    )
    switched = [
        main_switch(user_id, source, modes_before.main_of(source), mode, dry_run=False,
                    carry=payload.carryKnown is not False)
        for source, mode in (payload.mainModes or {}).items()
        if mode != modes_before.main_of(source)
    ] if modes_before is not None else []
    modes_after = (
        learner_modes.read(user_id).payload()
        if payload.mainModes is not None or payload.extraModes is not None else None
    )
    return {
        "jlptLevel": payload.jlptLevel,
        "dailyNewTarget": payload.dailyNewTarget,
        "ratingScale": payload.ratingScale,
        "readingPace": payload.readingPace,
        "tzOffsetMin": payload.tzOffsetMin,
        "lines": payload.lines,
        "notifications": payload.notifications,
        "analyticsOff": payload.analyticsOff,
        "boardHidden": payload.boardHidden,
        "uiLang": payload.uiLang,
        "levelRule": level_rule_result,
        # 主 (plan 273): the learner's modes as they now stand, and what
        # each main-mode change marked known.
        "modes": modes_after,
        "mainSwitch": switched,
    }


@router.get("/api/profile/learning/preview")
def preview_learning(jlptLevel: str = Query(...), user_id: str = Depends(get_user_id)):
    """What choosing `jlptLevel` would do, for the confirm sheet -- how
    many cards a move up marks known and over how many weeks, or how
    many a move down sets aside (and the zero it deletes)."""
    if jlptLevel not in LEVELS:
        raise HTTPException(status_code=422, detail=f"jlptLevel must be one of {', '.join(LEVELS)}")
    current = _profile_row(user_id)[1]
    return level_rule_preview(user_id, current, jlptLevel)


@router.get("/api/profile/modes")
def get_modes(user_id: str = Depends(get_user_id)):
    """主 (plan 273): the learner's modes, every line answered, and what
    each line offers -- as the main mode, and beside it in Today."""
    return {
        **learner_modes.read(user_id).payload(),
        "choices": {
            "main": {s: list(m) for s, m in main_modes.MAIN_CHOICES.items()},
            "extra": {s: list(m) for s, m in main_modes.EXTRA_CHOICES.items()},
        },
    }


@router.get("/api/profile/modes/preview")
def preview_modes(line: str = Query(..., max_length=8), mode: str = Query(..., max_length=40),
                  user_id: str = Depends(get_user_id)):
    """What riding `line` in `mode` would do, for the confirm sheet: how
    many cards mastered in the line's current mode are marked known in
    the new one, and over how many weeks. Nothing is written."""
    if mode not in main_modes.MAIN_CHOICES.get(line, ()):
        raise HTTPException(status_code=422, detail="not a main mode of that line")
    current = learner_modes.read(user_id).main_of(line)
    if current == mode:
        return {"line": line, "from": current, "to": mode, "carried": True, "markedKnown": 0,
                "spreadWeeks": level_rule.SPREAD_WEEKS}
    return main_switch(user_id, line, current, mode, dry_run=True)


@router.get("/api/profile/level-fit")
def get_level_fit(user_id: str = Depends(get_user_id)):
    """Whether the stored level fits what the learner answers (plan 224,
    study/level_fit.py): a stop to move down to when the checks behind
    the level mostly fail, the next one when the level's new words are
    known the first time they are asked, or nothing -- with the figures
    it read. A suggestion only: nothing is written."""
    return level_fit.level_fit(srs, user_id, _profile_row(user_id)[1], learner_modes.read(user_id))


# The 番付 is routes/banzuke.py since plan 262.
