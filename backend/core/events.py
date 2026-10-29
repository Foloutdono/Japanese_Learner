"""足跡 — the trail of screens a learner walked, and nothing more.

Owns `event_log` (raw, thirty days) and `event_daily` (the rolled-up
half, kept). The split is `review_log` / `review_daily`'s, for the same
reason: `screen_view` is the volume driver and the database it lands in
is shared with the review history. Order questions ("which boarding step
came before the drop-off") need the raw rows; rate questions ("did they
come back on day 7") only need the counts, so only the counts are kept.

THE RULE THIS MODULE EXISTS TO ENFORCE: no text a learner typed ever
becomes an event. Not a dictation answer, not an analysed sentence, not
a custom card, not a deck or theme name. That is a promise the published
privacy policy makes on the app's behalf, so it is not left to the call
sites to remember -- EVENTS below is a closed set of names, each with a
closed set of property keys, and `clean` drops everything else on the
way in. The client is not trusted with this: `routes/events.py` runs the
same `clean` over whatever a browser posts.

Route paths are the sharp edge. `/learn/vocab/theme/animaux/level/N4`
carries a theme name; the frontend normalises paths to patterns
(`lib/routePattern.js`) before they are tracked, and a path that arrives
here with a segment that is not a pattern is dropped rather than stored.
"""

import logging
import re
from datetime import datetime, timedelta, timezone

from core.db import db_conn
from core.rls import enable_rls

logger = logging.getLogger(__name__)

# The closed set: name -> the property keys that name may carry.
#
# Adding a name here is the whole of adding an event, on both sides --
# the frontend's EVENTS map (lib/track.js) is checked against this one
# by tests/test_events.py, so the two cannot drift into a state where
# the client sends something the server silently discards.
EVENTS: dict[str, frozenset[str]] = {
    # ── Boot, and what it costs ──────────────────────────────────
    # boot_ms is why render.yaml carries `plan: starter`; it is the
    # before/after of that line.
    "app_open":       frozenset({"boot_ms", "cold", "platform", "standalone"}),
    "boot_timeout":   frozenset({"waited_ms"}),

    # ── Where people go ──────────────────────────────────────────
    "screen_view":    frozenset({"route", "tab"}),
    # 滞在 — how long the screen was in front of someone (plan 218).
    # Sent when the route changes and when the page is hidden, `ms`
    # ENGAGED time from lib/dwell.js (a hidden tab does not count), so
    # the sum over a visit is the visit's real length. Returning to a
    # hidden tab starts a new stretch on the same route, which sends no
    # second screen_view: views count arrivals, leaves count time.
    "screen_leave":   frozenset({"route", "tab", "ms"}),
    # 訪問 — a visit began. The session id rides beside the event
    # (event_log.sid), not inside it. One row per session, so
    # event_daily's count of this name is "sessions per learner per
    # day" for the life of the account, after the raw rows are gone.
    #
    # Since plan 218 it carries the visit's context, each a COARSE
    # class read once (lib/visitContext.js), never a raw value: no user
    # agent, no resolution, no time zone, nothing that narrows a device
    # down -- the CNIL exemption this design relies on forbids
    # fingerprinting, and a dashboard needs no more than these. `vp` is
    # the viewport's class (phone / tablet / desk / wide; desk is
    # hooks/useDesk's 1100px line), `os` the family, `input` whether
    # the primary pointer is coarse, `reduced` prefers-reduced-motion.
    "session_start":  frozenset({"platform", "vp", "os", "lang", "theme", "input",
                                 "standalone", "reduced"}),

    # ── みどりの窓口 — the boarding flow ─────────────────────────
    # Emitted from go()/back() in BoardingFlow.jsx, which is every
    # transition there is. Abandonment is the absence of boarding_done
    # after a boarding_step, so neither needs an "abandoned" event.
    # `ms` is ENGAGED time on the step being left, not wall-clock: the
    # client stops counting while the tab is hidden
    # (frontend/src/lib/dwell.js), so a boarding left open over lunch
    # does not report an hour spent choosing a study rhythm. On
    # boarding_done it is the same measure across the whole line.
    "boarding_step":  frozenset({"step", "to", "index", "dir", "ms"}),
    # `lines` is the chosen subset of vocab/kanji/grammar as one
    # comma-joined string of those three names -- enum values, never
    # text the learner typed (core/lines.py).
    # `level_how` and `placed` (plan 224): whether the learner chose
    # their level or took the test, and where the test placed them --
    # beside `level`, what they boarded at, so an override shows.
    # The card (plan 247): which of its fields a sheet changed (the
    # defaults are what most keep, or they are not), whether it carries
    # a name -- never the name -- and where it was left: kept with
    # Google, by a password (plan 270) or a link, boarded on an account
    # already, or a guest's.
    # `motive` stays for a client from before the card, which asked why.
    "boarding_done":  frozenset({"motive", "kana_known", "level", "pace", "notifications", "lines", "ms",
                                 "level_how", "placed",
                                 "edited_goal", "edited_rhythm", "edited_hour", "edited_lines",
                                 "named", "kept"}),
    # "Embarquer" mints an anonymous Supabase guest (lib/guest.js), so an
    # abandoned boarding leaves an auth user with no profile row. `from`
    # tells the two apart.
    "account_claimed": frozenset({"from"}),

    # ── 試乗 — the first ride (plan 097) ────────────────────────────
    # The two lessons after the boarding, measured the way the boarding
    # is: every transition is a ride_step through the same go()/mark()
    # pair, and abandonment is a ride_step with no ride_done after it.
    # `at` on ride_done is which ride it ended on ('cards' | 'reading')
    # and `skipped` whether the learner left through the head's Skip --
    # the one question this feature has to answer is whether anyone
    # sits through it. `step` and `to` are step names, `ms` is engaged
    # time (lib/dwell.js), never wall-clock.
    "ride_step":      frozenset({"step", "to", "dir", "ms"}),
    "ride_done":      frozenset({"skipped", "at", "ms"}),
    # 案内 — the guide over each gate. `gate` is one of the five ids,
    # `stop` the anchor's name from the registry (a string the app
    # wrote, never one the learner did), `index` its place in the tour,
    # `stops` how many were seen before Done or Skip.
    "guide_step":     frozenset({"gate", "stop", "index"}),
    "guide_done":     frozenset({"gate", "skipped", "stops", "ms"}),

    # ── Study runs ───────────────────────────────────────────────
    # Since plan 218 the sentence runs (reading, translation,
    # comprehension, dictation, composition) report here too, through
    # hooks/useRunTrail.js, and every run carries how it went: `ms` is
    # engaged time (lib/dwell.js; `secs` stays the wall-clock it always
    # was, so older rows still compare), `card_p50` / `card_p90` the
    # median and slow tail of the time per item, `right` how many were
    # answered right, `where` the door the run was entered by. A count
    # and a duration, never an item.
    "run_start":      frozenset({"kind", "mode", "level", "where"}),
    "run_complete":   frozenset({"kind", "mode", "level", "items", "secs",
                                 "ms", "card_p50", "card_p90", "right", "where"}),
    "run_abandon":    frozenset({"kind", "mode", "level", "done",
                                 "ms", "card_p50", "card_p90", "right", "where"}),

    # ── The fare gate ────────────────────────────────────────────
    # fare_blocked is written server-side by core/credits.py, from the
    # shadow-mode branch that until now only reached stdout. It is the
    # willingness-to-pay signal: a learner who would have been stopped
    # is a learner who wanted more than the free allowance gives.
    "fare_blocked":   frozenset({"balance", "fare", "kind"}),
    "limit_reached":  frozenset({"kind", "at"}),
    # ── 定期券 — the offer ───────────────────────────────────────
    # No longer dormant: the pass is SHOWN from five doors and sold from
    # none (frontend/src/domain/paywall.js's HAS_PAYWALL, which is
    # deliberately not HAS_STORE). `where` is which of the five doors
    # (frontend/src/domain/paywall.js's SOURCES -- the reading ride's
    # pass plate among them since plan 097; the profile, a door until
    # plan 143, reaches the offer through the balance sheet now, and
    # older rows still say `profile`).
    #
    # The three verbs are the whole point: a paywall nobody opens and a
    # paywall opened and refused are indistinguishable from
    # credit_ledger, and until a store exists offer_intent is the only
    # willingness-to-pay signal there is. `ms` is the gap between seeing
    # the pass and deciding — a door with a high intent rate and a
    # one-second median is a mis-tap, not demand.
    #
    # The offer is three screens since plan 172, each with its one pick:
    # Pro yearly's 7-day trial (the boarding, the balance, the ride, the
    # settings), Pro yearly against the week the credits stopped (a run
    # at zero, `where` 'runout'), and the step up to Max ('limit', a Pro
    # learner at one of the plan's ceilings; 'upgrade', from Settings).
    # `plan` and `billing` are the app's own two enums, the pick the
    # gate was pressed on -- what the pricing sheet's annual share will
    # be checked against. `all` is no longer sent: it was whether "See
    # all offers" was opened before the answer (plan 172 retired that
    # list); older rows carry it.
    "offer_view":     frozenset({"where"}),
    "offer_intent":   frozenset({"where", "ms", "plan", "billing", "all"}),
    "offer_dismiss":  frozenset({"where", "ms", "all"}),

    # ── The library ──────────────────────────────────────────────
    # Whether learners give each other decks at all, and whether a
    # follow survives contact with the deck.
    #
    # NOT A DECK NAME, and not a description: both are learner-typed,
    # which is the rule this whole module exists to keep. `structure` is
    # the deck's type (one of routes/decks.py's STRUCTURES), `cards` is
    # a count, `where` is which surface the follow came from (the shelf
    # block or the library screen), and `sort` is which ordering was
    # showing. A deck id is
    # not carried either -- it would make the trail say who follows
    # whom, which is more than "is the library used" needs to know.
    "deck_publish":   frozenset({"structure", "cards"}),
    "deck_unpublish": frozenset({"structure", "followers"}),
    "deck_subscribe": frozenset({"structure", "cards", "where"}),
    "deck_detach":    frozenset({"structure", "cards", "withdrawn"}),
    # `filtered` is a BOOLEAN and deliberately so: it says whether the
    # library's console was narrowing the shelf, never what was typed
    # into it — a deck name or a search term is a learner's own words,
    # which is the rule this module exists to keep.
    "library_view":   frozenset({"sort", "results", "filtered"}),
    # ── お気に入り — the dictionary's shelf (plan 093) ────────────
    # The kind of entry and the direction, never the key: a key names
    # the word a learner looked up, which is theirs.
    "favorite_toggle": frozenset({"kind", "on"}),
    # ── 歌 — a song's decks, from the video result (plan 215) ────
    # How many words and lines went in (0 for the half not taken),
    # never the song's name: the learner typed it, or the video's title
    # said it, and either is theirs.
    "song_deck":       frozenset({"words", "lines"}),
    # ── 発車案内 — the app opened from outside it (plan 156) ──────
    # `via` is `notification` (the daily nudge or an agenda block's
    # reminder, plan 181) or `widget` (a home or
    # lock screen widget). Whether either brings anyone back is the one
    # question they have to answer.
    "nudge_opened":   frozenset({"via"}),
    # ── 基礎 — the basics course (plan 186f) ─────────────────────
    # `unit` is the course's own number, 1 to 14, never a card: whether
    # novices get through the course, and where they stop or skip it.
    "basics_unit_done": frozenset({"unit"}),
    "basics_skipped":   frozenset({"unit"}),
    # ── 乗換 — another app's progress brought across (plans 243, 243b)
    # All three written server-side (routes/transfer.py). An import:
    # where from (`source`, VALUES below), the notes sent, the course
    # cards they matched, the rows written and the cards left alone
    # because they were already studied here; an undo, the rows it took
    # back; the sheet over Today answered (`choice` go | later). Never a
    # word, a field, a deck's name or a key: those are the learner's,
    # and the name and the key never leave the device.
    "transfer_import":  frozenset({"source", "notes", "cards", "written", "kept"}),
    "transfer_undo":    frozenset({"removed"}),
    "transfer_offer":   frozenset({"choice"}),

    # ── 発見 — a grammar point's tour (plan 187b) ────────────────
    # `level` is N5…N1, never the pattern: the funnel is read by level.
    # `stop` is look / guess / found / terminus; `outcome` first, retry
    # (a wrong guess) or helped (the rule given after two), or skipped
    # (plan 222: the learner left the tour for its card at that stop,
    # and no done event follows). The done event carries the wrong
    # guesses and whether the twist and scene were the point's own
    # (`authored`, plan 187c).
    "grammar_tour_step": frozenset({"level", "stop", "outcome"}),
    "grammar_tour_done": frozenset({"level", "tries", "helped", "authored"}),
    # ── 初見 — a kana or a kanji's first tour (plan 216) ─────────
    # `source` is kana or kanji, never the character: whether the trace
    # is finished, and how often it misses or is drawn for the learner.
    "glyph_tour_done": frozenset({"source", "misses", "shown"}),

    # ── 終着 — the day cleared (plan 191) ────────────────────────
    # Both written server-side: day_clear by POST /api/today/clear on
    # the day's first clear (`streak` the day of the streak it was,
    # `milestone` the milestone reached or null, `tier` day | ticket |
    # month, the ceremony it played), rest_day_used by the lazy bridge
    # (`days`, how many missed days a rest ticket covered). ticket_share
    # is the client's: a milestone ticket shared as an image, `days`
    # the ticket's milestone -- never the image, which is the learner's.
    "day_clear":      frozenset({"streak", "milestone", "tier"}),
    "rest_day_used":  frozenset({"days"}),
    "ticket_share":   frozenset({"days"}),

    # ── 回復運転 — the review plan (plan 217) ─────────────────────
    # catchup_offer is the client's, once a visit: the comeback offer
    # put before the learner -- the sheet the gate opened on, the notice
    # on the gate since plan 254 (`owed` the reviews it would have
    # printed, `away` the days since the learner last studied). The
    # rest are written server-side: catchup_choice the answer (`choice`
    # spread | gentle | all, `days` a spread's, `per_day` its share);
    # catchup_done the day its share stopped holding anything back
    # (`days` it took). review_cap_set is the
    # ceiling chosen in Settings (`cap`, null for none); away_set an
    # absence declared or withdrawn (`days` long, 0 withdrawn), and
    # away_day_used the lazy bridge writing its days (`days`). Every
    # value a figure or an enum -- never a date the learner typed.
    "catchup_offer":  frozenset({"owed", "away"}),
    "catchup_choice": frozenset({"choice", "days", "per_day"}),
    "catchup_done":   frozenset({"days"}),
    "review_cap_set": frozenset({"cap"}),
    "away_set":       frozenset({"days"}),
    "away_day_used":  frozenset({"days"}),
    # ── 利用 — the small features, counted per screen (plan 218) ──
    # Whether anyone plays the audio, scans a photo, asks the tutor,
    # searches the dictionary. Not one row per press: lib/screenTrail.js
    # counts presses while a screen is up and sends one row per
    # (feature, action) when it is left, `n` the count and `route` the
    # screen's pattern. `feature` and `action` are closed enums (VALUES
    # below). The dictionary's search is a count of searches, never
    # the query.
    "feature_use":    frozenset({"feature", "action", "route", "n"}),
    # A setting changed, to which of the app's own values. Never the
    # trail's own switch: an objection is not recorded by the thing it
    # objects to.
    "setting_change": frozenset({"setting", "value"}),
    # ── AI — a rationed model call claimed (plan 218) ─────────────
    # Written server-side by core/daily_limit.claim, so the use of the
    # ceilinged features outlives daily_usage's thirty days (prune_logs)
    # in event_daily. `count` is the day's slots taken, this one
    # included; `over` whether it is past `limit`.
    "ai_use":         frozenset({"feature", "count", "limit", "over"}),

    # ── Friction ─────────────────────────────────────────────────
    # An uncaught error or rejected promise, by screen. NO MESSAGE AND
    # NO STACK: either can quote what was on the screen or typed into
    # it. `where` says which of the two it was, and `step` which step of
    # the boarding or the first ride was on screen, when one was: the
    # name their boarding_step / ride_step give it.
    "client_error":   frozenset({"route", "step", "where"}),
    # The page's own speed, once per page load, from the browser's
    # PerformanceObserver (lib/vitals.js, no library): largest paint,
    # the slowest interaction, layout shift (x1000, an integer) and
    # time to first byte, on the route the page was loaded on.
    "vitals":         frozenset({"route", "lcp", "inp", "cls", "ttfb"}),
    # `path` is a route pattern, never a URL with ids in it, and no
    # response body is ever carried.
    "api_error":      frozenset({"path", "status"}),
    "install_prompt": frozenset({"outcome"}),

    # ── 対戦 — the duels (plan 279) ──────────────────────────────
    # Written server-side by routes/pvp.py. Never a username, never who
    # played whom: what was done, at which level, and how it ended.
    # `against` is how the opponent was found (a friend; a ranked run
    # someone left waiting, `seek`; a recorded run, `ghost`; or none
    # yet, `open`), `wait_h` the hours an asynchronous duel waited.
    # `pvp_placed` is the level a learner's Elo started from, written
    # at their first ranked sprint, no test asked (plan 282); `novice`
    # is the beginner's stop under N5 (plan 289), a duel's level too.
    "pvp_friend":     frozenset({"action"}),
    "pvp_report":     frozenset({"reason"}),
    "pvp_duel_start": frozenset({"kind", "mode", "level", "against"}),
    "pvp_duel_done":  frozenset({"kind", "mode", "level", "outcome", "rights", "wait_h"}),
    "pvp_review":     frozenset({"kind"}),
    "pvp_placed":     frozenset({"level"}),
    "pvp_smurf":      frozenset({"games"}),
}

# 選択肢 — the values a string property may take, where it is an enum
# (plan 218). `clean` keeps a key only if the name allows it; for the
# keys listed here it also keeps the VALUE only if it is one of these,
# and drops the key otherwise. That is what makes "nothing a learner
# typed" structural rather than a call site's good manners: a string
# that is not on this list cannot reach the table under these keys,
# however it was sent. lib/track.js mirrors this map and
# tests/test_events.py holds the two equal.
#
# Keys not listed are numbers, booleans, or the older events' own
# enums, which their call sites own (a run's `kind` comes from the
# run keys, a boarding step from BoardingFlow). Two keys are held to a
# SHAPE instead, on every name, below: `route` and `path`.
_RUN_DOORS = frozenset({"today", "learn", "practice", "deck", "ride", "exam", "other"})
VALUES: dict[str, dict[str, frozenset[str]]] = {
    "session_start": {
        "platform": frozenset({"web", "native"}),
        "vp":       frozenset({"phone", "tablet", "desk", "wide"}),
        "os":       frozenset({"ios", "android", "windows", "mac", "linux", "chromeos", "other"}),
        "lang":     frozenset({"fr", "en"}),
        "theme":    frozenset({"light", "dark", "auto"}),
        "input":    frozenset({"touch", "mouse"}),
    },
    "boarding_done": {
        "level_how": frozenset({"pick", "test"}),
        "placed":    frozenset({"N5", "N4", "N3", "N2", "N1"}),
        "kept":      frozenset({"google", "password", "link", "already", "none"}),
    },
    "run_start":    {"where": _RUN_DOORS},
    "run_complete": {"where": _RUN_DOORS},
    "run_abandon":  {"where": _RUN_DOORS},
    "feature_use": {
        # speech: a Japanese reading spoken (a card's, a sentence's).
        # analyzer: a text, photo or video sent to the breakdown. ocr:
        # a photo read. ask: a question to the tutor. explain: a
        # sentence's explanation opened. dictionary: a search run.
        # export: the progress downloaded. level_fit: Today's line that
        # says the level does not fit (plan 224) -- opened, the move
        # taken, or the level kept. conversation: the 会話 station's
        # search started (plan 246). comeback: Today's notice that the
        # reviews piled up (plan 254) -- its paces opened, or the notice
        # hidden for the day. readings: the sheet a kanji card's
        # reading names open, on'yomi and kun'yomi said (plan 276).
        # duels_key: the duels' key beside Today's gate opened, and
        # duels_board their row on a day done's board (plan 287);
        # duels_news: the sheet announcing them, the hall opened from it
        # or the sheet put away.
        "feature": frozenset({"speech", "analyzer", "ocr", "ask", "explain",
                              "dictionary", "export", "level_fit", "conversation",
                              "comeback", "readings", "duels_key", "duels_board",
                              "duels_news"}),
        "action":  frozenset({"play", "text", "photo", "video", "scan", "send",
                              "open", "search", "progress", "move", "stay", "hide"}),
    },
    "transfer_import": {"source": frozenset({"anki", "wanikani", "renshuu"})},
    "transfer_offer":  {"choice": frozenset({"go", "later"})},
    "setting_change": {
        "setting": frozenset({"theme", "lang", "rating_scale", "reading_pace", "sound",
                              "notifications", "level", "lines", "daily_target",
                              "main_mode", "today_mode"}),
        "value":   frozenset({"light", "dark", "auto", "fr", "en",
                              "binary", "simple", "full",
                              "standard", "relaxed", "slow", "untimed",
                              "on", "off", "N5", "N4", "N3", "N2", "N1", "changed"}),
    },
    "ai_use":       {"feature": frozenset({"ask", "composition", "translation_review",
                                         "deep_analysis", "exam_paper", "line_translation"})},
    # What a refused fare was for (core/credits.FARES): a review, or
    # since plan 279 a ranked duel's departure or a duel's corrections.
    "fare_blocked": {"kind": frozenset({"review", "duel", "duel_review"})},
    "pvp_friend": {"action": frozenset({"request", "accept", "refuse", "withdraw", "remove",
                                        "block", "unblock"})},
    "pvp_report": {"reason": frozenset({"name", "cheat", "spam", "other"})},
    "pvp_duel_start": {
        "kind":    frozenset({"friend", "ranked"}),
        "mode":    frozenset({"async", "live"}),
        "level":   frozenset({"novice", "N5", "N4", "N3", "N2", "N1"}),
        "against": frozenset({"friend", "seek", "ghost", "open"}),
    },
    "pvp_duel_done": {
        "kind":    frozenset({"friend", "ranked"}),
        "mode":    frozenset({"async", "live"}),
        "level":   frozenset({"novice", "N5", "N4", "N3", "N2", "N1"}),
        "outcome": frozenset({"win", "loss", "draw", "expired", "declined"}),
    },
    "pvp_review": {"kind": frozenset({"friend", "ranked"})},
    "pvp_placed": {"level": frozenset({"novice", "N5", "N4", "N3", "N2", "N1"})},
    "client_error": {
        "where": frozenset({"error", "rejection"}),
        # The boarding's and the rides' steps, frontend/src/domain/
        # flowSteps.js; its test holds the flows to this list.
        "step":  frozenset({"kana", "reveal", "level", "test", "card",
                            "intro-scripts", "intro-sounds", "intro-table",
                            "intro-katakana", "intro-sentence", "intro-route",
                            "known", "known-dict", "known-back", "unknown",
                            "unknown-back", "done",
                            "read", "type", "measure", "graded", "pass"}),
    },
}

# The two keys held to a shape on every name. A route is a pattern
# App.jsx declared (lib/routePattern.js) and an API path an area
# (`/api/decks`); neither has room for a space, an accent, a dot or
# anything else a learner's words are made of, so a value that does
# not fit is dropped rather than stored.
SHAPES = {
    "route": re.compile(r"^/[A-Za-z0-9/:_-]{0,63}$"),
    "path":  re.compile(r"^/api/[a-z][a-z0-9_-]{0,30}$"),
}

# Names that survive the thirty-day cut in scripts/compact_events.py.
# Each is at most a handful of rows per learner for the life of the
# account, and each answers a question that is about a person's whole
# history rather than this month's -- "did the people who abandoned at
# the level step ever come back" cannot be asked of a rollup.
KEEP_LONG = frozenset({
    "boarding_step", "boarding_done", "account_claimed",
    # The ride and the guides are once per account, and "did the people
    # who skipped the ride come back" is a question about a whole
    # history. ride_step is not here: per-transition, like a run.
    "ride_done", "guide_done",
    "fare_blocked", "limit_reached", "offer_view", "offer_intent", "offer_dismiss",
    # Publishing is a once-or-twice-ever act, and "did the people who
    # published a deck keep doing it" is a question about a whole
    # account. deck_subscribe and library_view are not here: those are
    # per-visit and belong in the rollup.
    "deck_publish", "deck_detach",
    # Fourteen units at most, once each: "did the learners who finished
    # the basics stay" is a question about a whole account.
    "basics_unit_done", "basics_skipped",
    # Once or twice an account: "did the learners who came from another
    # app stay" is one too, and the sheet over Today is asked once.
    "transfer_import", "transfer_undo", "transfer_offer",
})

# A session id is the client's random token for one visit
# (lib/track.js). It is not a property: it is shaped, not free, so it is
# held to a shape rather than to the allowlist -- a UUID or the fallback
# the client mints without crypto.randomUUID, letters, digits and dashes
# only. Anything else is not stored, so a client cannot smuggle text into
# the one column the allowlist does not cover.
SID_RE = re.compile(r"^[A-Za-z0-9-]{8,64}$")

# A property value is a scalar or it is dropped. Strings are cut at 64
# characters: every legitimate value here is an enum, a route pattern or
# a number, and 64 is comfortably past the longest route pattern the app
# has while being far short of anything a learner could have typed.
MAX_STR = 64
# A second bound behind the allowlist: no event keeps more keys than the
# largest set EVENTS allows. Derived, never a literal -- a 12 sat here
# while boarding_done allowed 15, and as clean() keeps keys in the order
# they were sent, a learner who took the placement test lost `named` and
# `kept`, the last two, without a word.
MAX_PROPS = max(len(keys) for keys in EVENTS.values())
# A batch bound, so one client cannot post a megabyte. The frontend
# flushes at 20 (lib/track.js); 50 leaves room for a backlog that built
# up offline without letting it arrive all at once.
MAX_BATCH = 50
# How far back a client-supplied timestamp may reach. The queue is
# persisted across reloads, so an event really can be days old and its
# own time is the true one -- but a wrong or hostile clock must not be
# able to write into the far past or the future.
MAX_BACKDATE = timedelta(days=7)


def clean(name, props) -> dict | None:
    """The name and its properties, or None if the name is not ours.

    Never raises: a bad event is dropped, never a reason to fail the
    request that carried it. Analytics that can break a study session is
    worse than no analytics.
    """
    allowed = EVENTS.get(name) if isinstance(name, str) else None
    if allowed is None:
        return None
    if not isinstance(props, dict):
        return {}
    out: dict = {}
    enums = VALUES.get(name, {})
    for key, value in props.items():
        if key not in allowed:
            continue
        if isinstance(value, str):
            if key in enums and value not in enums[key]:
                continue
            if key in SHAPES and not SHAPES[key].fullmatch(value):
                continue
        if isinstance(value, bool) or value is None:
            out[key] = value
        elif isinstance(value, (int, float)):
            # NaN/inf survive json.loads and then break psycopg2's JSONB
            # adaptation, taking the whole batch with them.
            out[key] = value if -1e12 < value < 1e12 else None
        elif isinstance(value, str):
            out[key] = value[:MAX_STR]
        else:
            # A dict or a list is the shape free text would arrive in.
            continue
        if len(out) >= MAX_PROPS:
            break
    return out


def clean_sid(raw) -> str | None:
    """The session id if it has the shape of one, else None."""
    return raw if isinstance(raw, str) and SID_RE.fullmatch(raw) else None


def clean_at(raw, now: datetime) -> datetime:
    """A client timestamp, clamped to a window it cannot lie its way out of."""
    if not isinstance(raw, str):
        return now
    try:
        # Javascript's toISOString() ends in Z, which fromisoformat only
        # learned to read in 3.11; this backend runs 3.12, but the
        # replace costs nothing and says so.
        parsed = datetime.fromisoformat(raw.replace("Z", "+00:00"))
    except ValueError:
        return now
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    if parsed > now:
        return now
    floor = now - MAX_BACKDATE
    return parsed if parsed > floor else floor


def _ensure_events_schema() -> None:
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("""
                CREATE TABLE IF NOT EXISTS event_log (
                    id      BIGSERIAL PRIMARY KEY,
                    user_id TEXT NOT NULL,
                    name    TEXT NOT NULL,
                    props   JSONB NOT NULL DEFAULT '{}'::jsonb,
                    at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
                )
            """)
            enable_rls(cur, "event_log")
            # (user_id, at) for one learner's trail in order; (name, at)
            # for the digest's per-name counts across everyone.
            # The client's own id per event (routes/events.py), so a
            # batch sent twice is kept once. Partial: the server's own
            # rows and an older client's carry none, and NULLs must not
            # collide.
            cur.execute("ALTER TABLE event_log ADD COLUMN IF NOT EXISTS cid TEXT")
            # The client's random id for one visit (lib/track.js), so the
            # trail can say how long a session lasted and how many a day
            # a learner has. Raw rows only: event_daily keeps the count
            # of `session_start`, which is the same figure without ids.
            cur.execute("ALTER TABLE event_log ADD COLUMN IF NOT EXISTS sid TEXT")
            cur.execute("""
                CREATE UNIQUE INDEX IF NOT EXISTS idx_event_log_user_cid
                ON event_log(user_id, cid) WHERE cid IS NOT NULL
            """)
            cur.execute("""
                CREATE INDEX IF NOT EXISTS idx_event_log_user_at
                ON event_log(user_id, at)
            """)
            cur.execute("""
                CREATE INDEX IF NOT EXISTS idx_event_log_name_at
                ON event_log(name, at)
            """)
            cur.execute("""
                CREATE TABLE IF NOT EXISTS event_daily (
                    user_id TEXT NOT NULL,
                    day     DATE NOT NULL,
                    name    TEXT NOT NULL,
                    n       INTEGER NOT NULL DEFAULT 0,
                    PRIMARY KEY (user_id, day, name)
                )
            """)
            enable_rls(cur, "event_daily")
        conn.commit()
    finally:
        conn.close()


try:
    _ensure_events_schema()
except Exception:  # pragma: no cover - a missing DB must not stop import
    logger.exception("events schema could not be initialised")


def write(cur, user_id: str, rows: list[tuple]) -> int:
    """Insert cleaned rows on a cursor the caller owns. Returns how many
    were KEPT: a row whose client id this learner already has is a batch
    sent twice (a flush the page never heard back about) and is dropped
    on the unique (user_id, cid). A row with no id -- the server's own,
    or an older client's -- is never deduplicated.

    rows: (name, props, at), (name, props, at, cid) or
    (name, props, at, cid, sid)."""
    if not rows:
        return 0
    kept = 0
    for row in rows:
        name, props, at = row[0], row[1], row[2]
        cid = row[3] if len(row) > 3 else None
        sid = clean_sid(row[4]) if len(row) > 4 else None
        cur.execute(
            "INSERT INTO event_log (user_id, name, props, at, cid, sid) "
            "VALUES (%s, %s, %s::jsonb, %s, %s, %s) "
            "ON CONFLICT (user_id, cid) WHERE cid IS NOT NULL DO NOTHING",
            (user_id, name, _json(props), at, cid, sid),
        )
        kept += cur.rowcount
    return kept


def opted_out(cur, user_id: str) -> bool:
    """Whether this account asked not to be counted (plan 218).

    The switch in Réglages › Données was a localStorage flag until plan
    218, which stopped the browser it was flipped in and nothing else:
    the server's own events (a blocked fare, a cleared day, a basics
    unit) kept being written, and so did every other device's. It is
    the account's now, `user_profiles.analytics_off`, and both write
    paths ask it first.

    Inside a SAVEPOINT, because `cur` may be a caller's transaction
    (core/credits.py records inside its own) and a failing read --
    the column not there yet on a database mid-deploy -- must not
    abort it. A failed read counts as NOT opted out only because the
    column is then absent, which means nobody can have opted out yet.
    """
    try:
        cur.execute("SAVEPOINT trail_optout")
        cur.execute("SELECT analytics_off FROM user_profiles WHERE user_id = %s", (user_id,))
        row = cur.fetchone()
        cur.execute("RELEASE SAVEPOINT trail_optout")
    except Exception:
        try:
            cur.execute("ROLLBACK TO SAVEPOINT trail_optout")
        except Exception:
            pass
        return False
    if not row:
        return False
    value = row["analytics_off"] if isinstance(row, dict) else row[0]
    return bool(value)


def _json(props: dict) -> str:
    import json
    return json.dumps(props, separators=(",", ":"))


def record(user_id: str, name: str, props: dict | None = None, cur=None) -> None:
    """One event, from the server.

    Pass `cur` to join a transaction the caller already has open -- that
    is how core/credits.py records a blocked fare without opening a
    second connection inside its own. Without it this opens and commits
    its own.

    Swallows everything. A route must never fail because its bookkeeping
    did; the caller's own work is the thing that matters.
    """
    cleaned = clean(name, props or {})
    if cleaned is None:
        logger.warning("events: unknown name %r dropped", name)
        return
    row = [(name, cleaned, datetime.now(timezone.utc))]
    try:
        if cur is not None:
            if not opted_out(cur, user_id):
                write(cur, user_id, row)
            return
        conn = db_conn()
        try:
            with conn.cursor() as c:
                if not opted_out(c, user_id):
                    write(c, user_id, row)
            conn.commit()
        except Exception:
            conn.rollback()
            raise
        finally:
            conn.close()
    except Exception:
        logger.exception("events: %s could not be recorded", name)
