"""
One learner's whole trail, in order: every visit, what they did in it,
where they stopped, and what in the trail may say why (plan 247).

    python -m scripts.learner_trail <user_id>           # the report, as markdown
    python -m scripts.learner_trail <user_id> --all     # every event, none folded
    python -m scripts.learner_trail <user_id> --json    # the same, as JSON

Read-only. There is no --yes because there is nothing to confirm.

-- What it reads ------------------------------------------------
The 足跡 trail (`event_log`, thirty days of raw rows, then
`event_daily`'s counts) beside the app's own tables: the account's
answers in `user_profiles`, the reviews, the practice answers, the
exams, the tours, the cleared days, the credits. It merges them onto
one clock, groups them into the visits `event_log.sid` names, and reads
the result for the patterns that have cost learners before: a boarding
left at a step, a first ride begun again from nothing, a request that
never came back, a page slow to paint, a sheet answered and then a dead
end, an account that never answered one card.

The findings are a reason to look, never a verdict: the trail says what
was pressed and how long a screen stayed up, not what the learner
thought. Each one names the events it was read from, so it can be
checked against the timeline under it.

-- What it never reads -------------------------------------------
Nothing a learner typed. No practice log's text column (an answer, a
phrase, a prompt), no deck name, no username, no feedback body: the
feedback is counted here and read with `scripts.read_feedback`, the one
place its words are read (plan 222). The trail itself never held any
(`core/events.py`).

-- Who it reads ---------------------------------------------------
A learner who objected (`user_profiles.analytics_off`, Réglages ›
Données) is not read at all: the objection is the account's and is
honoured everywhere (ADR 0022), this script included. Run it from the
backend's Render Shell or a terminal holding DATABASE_URL, by a person,
for one account at a time -- never from a workflow, whose run page
anyone with the repository can open.
"""
import argparse
import json
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone

import scripts._env  # noqa: F401  -- must precede core.db, which reads
#                       DATABASE_URL at module scope. See scripts/_env.py.
from core.db import db_conn

# The profile's columns this reads: the boarding's answers and the
# stamps its steps leave. Never `username`, which the learner typed.
PROFILE_COLS = (
    "created_at", "onboarded_at", "tutorial_at", "guided", "jlpt_level", "motive",
    "kana_known", "lines", "daily_new_target", "goal_level", "goal_target_date",
    "daily_departure", "reminder_time", "notifications", "plan", "plan_until",
    "tz_offset_min", "transfer_offered_at", "review_cap", "away_from", "away_until",
    "analytics_off",
)

# The practice logs, and the one column of each that says how it went.
# Their text columns (answer, phrase, sentence, prompt) are never named.
PRACTICE = {
    "reading_log":       ("reading", "correct"),
    "translation_log":   ("translation", "correct"),
    "dictation_log":     ("dictation", "correct"),
    "composition_log":   ("composition", "correct"),
    "conversation_log":  ("conversation", "correct"),
    "comprehension_log": ("comprehension", "score >= total * 0.6"),
}

# A study burst ends after this long without an answer.
BURST_GAP = timedelta(minutes=5)
# Thresholds, each the line the reading crosses. Web vitals are
# Google's "poor" lines (cls arrives x1000, lib/vitals.js); the boot is
# a third of boot_timeout's wait.
SLOW_BOOT_MS = 4000
POOR_LCP_MS = 4000
POOR_INP_MS = 500
POOR_CLS = 250
SLOW_STEP_MS = 90_000
# A failed request this close to a visit's end is the page closing on
# it, not the server failing it.
CLOSING = timedelta(seconds=5)
# The first ride's opening step, per ride: seeing it again after the
# ride began, with no ride_done between, is the ride begun again.
RIDE_FIRST = {"known"}
RIDE_LAST = {"pass", "graded"}


@dataclass
class Item:
    """One thing on the clock: an event, or a row of study."""
    at: datetime
    name: str
    props: dict = field(default_factory=dict)
    sid: str | None = None
    study: bool = False


# ── Gathering ─────────────────────────────────────────────────────


def _rows(cur, sql: str, params) -> list[dict]:
    cur.execute(sql, params)
    cols = [d[0] for d in cur.description]
    return [dict(zip(cols, row)) for row in cur.fetchall()]


def _exists(cur, table: str) -> bool:
    cur.execute("SELECT to_regclass(%s) IS NOT NULL", (f"public.{table}",))
    return bool(cur.fetchone()[0])


def _like_prefix(user_id: str) -> str:
    return user_id.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + ":%"


def gather(cur, user_id: str) -> dict:
    """Everything the report reads, for one account. A table a
    database does not have yet reads as empty."""
    profile = None
    cur.execute(
        "SELECT column_name FROM information_schema.columns "
        "WHERE table_schema = 'public' AND table_name = 'user_profiles'"
    )
    have = {r[0] for r in cur.fetchall()}
    cols = [c for c in PROFILE_COLS if c in have]
    if cols:
        found = _rows(cur, f"SELECT {', '.join(cols)} FROM user_profiles WHERE user_id = %s", (user_id,))
        profile = found[0] if found else None

    out: dict = {"user_id": user_id, "profile": profile}
    if profile and profile.get("analytics_off"):
        out["opted_out"] = True
        return out

    out["events"] = _rows(
        cur,
        "SELECT name, props, at, sid FROM event_log WHERE user_id = %s ORDER BY at, id",
        (user_id,),
    ) if _exists(cur, "event_log") else []
    out["daily"] = _rows(
        cur,
        "SELECT day, name, n FROM event_daily WHERE user_id = %s ORDER BY day, name",
        (user_id,),
    ) if _exists(cur, "event_daily") else []
    out["reviews"] = _rows(
        cur,
        "SELECT split_part(card_id, ':', 2) AS card, mode, quality, reviewed_at AS at, assumed "
        "FROM review_log WHERE card_id LIKE %s ORDER BY reviewed_at",
        (_like_prefix(user_id),),
    )
    cur.execute("SELECT COUNT(*) FROM card_modes WHERE card_id LIKE %s", (_like_prefix(user_id),))
    out["card_rows"] = cur.fetchone()[0]

    practice = []
    for table, (kind, right) in PRACTICE.items():
        if not _exists(cur, table):
            continue
        for row in _rows(
            cur,
            f"SELECT created_at AS at, level, ({right}) AS right FROM {table} WHERE user_id = %s",
            (user_id,),
        ):
            practice.append({**row, "kind": kind})
    out["practice"] = sorted(practice, key=lambda r: r["at"])

    simple = {
        "xp": ("SELECT source, xp, awarded_at AS at FROM xp_ledger WHERE user_id = %s ORDER BY awarded_at", "xp_ledger"),
        "exams": ("SELECT exam_id, section_id, correct, total, started_at, finished_at, created_at AS at "
                  "FROM exam_attempts WHERE user_id = %s ORDER BY created_at", "exam_attempts"),
        "grammar_tours": ("SELECT tries, helped, quiz_right, quiz_total, done_at AS at "
                          "FROM grammar_tours WHERE user_id = %s ORDER BY done_at", "grammar_tours"),
        "glyph_tours": ("SELECT misses, shown, done_at AS at FROM glyph_tours WHERE user_id = %s ORDER BY done_at",
                        "glyph_tours"),
        "day_clears": ("SELECT day, streak, cleared_at AS at FROM day_clears WHERE user_id = %s ORDER BY cleared_at",
                       "day_clears"),
        "credits": ("SELECT delta, reason, at FROM credit_ledger WHERE user_id = %s ORDER BY at", "credit_ledger"),
        "credit_stops": ("SELECT cards, at FROM credit_stops WHERE user_id = %s ORDER BY at", "credit_stops"),
        # Counted, never read: the words are read_feedback's alone.
        "feedback": ("SELECT kind, route, created_at AS at FROM feedback WHERE user_id = %s ORDER BY created_at",
                     "feedback"),
    }
    for key, (sql, table) in simple.items():
        out[key] = _rows(cur, sql, (user_id,)) if _exists(cur, table) else []
    return out


# ── Reading ───────────────────────────────────────────────────────


def _aware(at: datetime) -> datetime:
    return at if at.tzinfo else at.replace(tzinfo=timezone.utc)


def timeline(data: dict) -> list[Item]:
    """The trail and the study rows on one clock, oldest first."""
    items = [Item(_aware(e["at"]), e["name"], e["props"] or {}, e["sid"]) for e in data.get("events", [])]
    for r in data.get("reviews", []):
        items.append(Item(_aware(r["at"]), "review",
                          {"mode": r["mode"], "quality": r["quality"], "assumed": r.get("assumed")}, study=True))
    for p in data.get("practice", []):
        items.append(Item(_aware(p["at"]), "practice",
                          {"kind": p["kind"], "level": p["level"], "right": p["right"]}, study=True))
    for x in data.get("exams", []):
        items.append(Item(_aware(x["at"]), "exam",
                          {"exam": x["exam_id"], "correct": x["correct"], "total": x["total"]}, study=True))
    for g in data.get("grammar_tours", []):
        items.append(Item(_aware(g["at"]), "grammar_tour", {"tries": g["tries"]}, study=True))
    for g in data.get("glyph_tours", []):
        items.append(Item(_aware(g["at"]), "glyph_tour", {"misses": g["misses"]}, study=True))
    for c in data.get("credit_stops", []):
        items.append(Item(_aware(c["at"]), "credit_stop", {"cards": c["cards"]}))
    for f in data.get("feedback", []):
        items.append(Item(_aware(f["at"]), "feedback", {"kind": f["kind"], "route": f["route"]}))
    items.sort(key=lambda i: i.at)
    return items


def visits(items: list[Item]) -> list[dict]:
    """The items grouped by visit. A row with no visit id (the server's
    own events, the study tables) joins the visit it falls in, or the
    one before it; one before any visit opens its own."""
    out: list[dict] = []
    by_sid: dict[str, dict] = {}
    for it in items:
        if it.sid:
            v = by_sid.get(it.sid)
            if v is None:
                v = {"sid": it.sid, "items": []}
                by_sid[it.sid] = v
                out.append(v)
            v["items"].append(it)
    out.sort(key=lambda v: v["items"][0].at)
    loose = [it for it in items if not it.sid]
    for it in loose:
        home = None
        for v in out:
            if v["items"][0].at <= it.at + timedelta(seconds=1):
                home = v
        if home is None or it.at - home["items"][-1].at > timedelta(hours=1):
            home = {"sid": None, "items": []}
            out.append(home)
            out.sort(key=lambda v: v["items"][0].at if v["items"] else it.at)
        home["items"].append(it)
        home["items"].sort(key=lambda i: i.at)
    for v in out:
        its = v["items"]
        v["start"], v["end"] = its[0].at, its[-1].at
        v["engaged_ms"] = sum(int(i.props.get("ms") or 0) for i in its if i.name == "screen_leave")
        ctx = next((i.props for i in its if i.name == "session_start"), {})
        v["device"] = " · ".join(str(ctx[k]) for k in ("vp", "os", "platform", "lang") if ctx.get(k))
        v["standalone"] = ctx.get("standalone")
    return out


def _fmt_ms(ms) -> str:
    s = int(ms or 0) // 1000
    return f"{s // 60}m{s % 60:02d}s" if s >= 60 else f"{s}s"


def _ago(delta: timedelta) -> str:
    h = delta.total_seconds() / 3600
    return f"{h * 60:.0f} min" if h < 1 else f"{h:.1f} h" if h < 48 else f"{h / 24:.0f} days"


def findings(data: dict, items: list[Item], vs: list[dict], now: datetime) -> list[dict]:
    """What in the trail may say what went wrong, worst first. Each is
    {level: block | friction | note, what, evidence}."""
    out: list[dict] = []
    ev = [i for i in items if not i.study]
    names = [i.name for i in ev]
    profile = data.get("profile") or {}
    studied = [i for i in items if i.name in ("review", "practice", "exam") and not i.props.get("assumed")]

    def add(level, what, evidence):
        out.append({"level": level, "what": what, "evidence": evidence})

    # ── The way in ──
    steps = [i for i in ev if i.name == "boarding_step"]
    done = next((i for i in ev if i.name == "boarding_done"), None)
    if steps and not done:
        last = steps[-1]
        add("block", f"Left the boarding at `{last.props.get('to')}` and never finished it.",
            f"last boarding_step {last.props.get('step')} → {last.props.get('to')} at {last.at:%Y-%m-%d %H:%M} UTC; no boarding_done")
    for s in steps:
        if (s.props.get("ms") or 0) > SLOW_STEP_MS:
            add("friction", f"Hesitated on the boarding's `{s.props.get('step')}` step ({_fmt_ms(s.props.get('ms'))}).",
                "boarding_step ms")
    if steps and done:
        reloads = [i for i in ev if i.name == "app_open" and steps[0].at < i.at < done.at]
        if reloads:
            add("note", f"The page reloaded {len(reloads)}× inside the boarding (a sign-in round trip, or a crash).",
                f"app_open between the first boarding_step and boarding_done, at {', '.join(f'{r.at:%H:%M:%S}' for r in reloads)}")

    # ── The first ride ──
    ride = [i for i in ev if i.name in ("ride_step", "ride_done")]
    attempts: list[list[Item]] = []
    for i in ride:
        if i.name == "ride_step" and i.props.get("step") in RIDE_FIRST or not attempts:
            attempts.append([])
        attempts[-1].append(i)
    broken = [a for a in attempts if not any(i.name == "ride_done" for i in a)]
    if len(attempts) > 1 and any(any(i.name == "ride_done" for i in a) for a in attempts):
        for a in broken:
            last = [i for i in a if i.name == "ride_step"][-1]
            reached = last.props.get("to")
            # What took them out: the next screen after the last step.
            nxt = next((i for i in ev if i.at >= last.at and i.name == "screen_view"
                        and not i.props.get("route", "").startswith("/ride/reading")), None)
            how = (f"next screen `{nxt.props.get('route')}` at {nxt.at:%H:%M:%S}" if nxt else "no screen after it")
            add("block",
                f"The first ride was begun again from the first card: the learner reached `{reached}` "
                f"and left it without `ride_done`, so the front door boarded them onto the ride a second time.",
                f"ride_step {last.props.get('step')} → {reached} at {last.at:%H:%M:%S} UTC, then {how}; "
                f"the ride begun {len(attempts)}×, "
                f"{_fmt_ms(sum(i.props.get('ms') or 0 for a2 in broken for i in a2 if i.name == 'ride_step'))} "
                f"of it sat for nothing")
            if reached in RIDE_LAST:
                add("note",
                    "Left the ride's last plate by something other than Enter or Skip -- the phone's back "
                    "gesture past hooks/useBackGuard's entry, a reload, or a stale bundle -- since either "
                    "button sends ride_done first.",
                    "no ride_done, no offer_view in that stretch")
    elif ride and broken:
        last = [i for i in broken[-1] if i.name == "ride_step"][-1]
        add("block", f"Left the first ride at `{last.props.get('to')}` and never finished it.",
            f"last ride_step at {last.at:%Y-%m-%d %H:%M} UTC; no ride_done")
    for i in ev:
        if i.name == "ride_done" and i.props.get("skipped"):
            add("note", f"Skipped the first ride (at `{i.props.get('at')}`).", "ride_done skipped")
        if i.name == "guide_done" and i.props.get("skipped"):
            add("note", f"Skipped the `{i.props.get('gate')}` guide after {i.props.get('stops')} stop(s).",
                "guide_done skipped")

    # ── Never studied ──
    if not studied:
        reached = "Today" if "/today" in {i.props.get("route") for i in ev if i.name == "screen_view"} else "the study"
        add("block", f"Never answered one card or exercise: the account stopped before {reached}'s first question.",
            "review_log, practice logs and exam_attempts hold nothing for this account"
            + (f"; its {data['card_rows']} card rows were seeded from the boarding's answers (the level, the kana known), never answered"
               if data.get("card_rows") else ""))

    # ── Detours that ended a visit ──
    for idx, i in enumerate(ev):
        if i.name == "transfer_offer" and i.props.get("choice") == "go":
            imported = any(e.name == "transfer_import" and e.at > i.at for e in ev)
            later = [e for e in ev[idx + 1:] if e.name == "screen_view"]
            stayed = [e for e in later if e.props.get("route") != "/profile/settings/:page"]
            if not imported:
                tail = ("and the visit ended there" if not stayed else
                        f"then went on to `{stayed[0].props.get('route')}`")
                add("block" if not stayed else "friction",
                    "Answered the Correspondance sheet over Today with its first button "
                    "(\"Reprendre ma progression\"), landed on Settings › Correspondance, imported nothing, "
                    f"{tail}. A new learner who studied nowhere else may read that button as \"continue\".",
                    f"transfer_offer go at {i.at:%H:%M:%S} UTC; no transfer_import; "
                    f"boarded at {profile.get('jlpt_level')}, kana known: {profile.get('kana_known')}")
        if i.name == "offer_view":
            answered = any(e.name in ("offer_intent", "offer_dismiss") and e.at >= i.at for e in ev)
            if not answered:
                add("friction", f"Saw the pass offer at `{i.props.get('where')}` and never answered it.",
                    f"offer_view at {i.at:%H:%M:%S} UTC")
    for i in items:
        if i.name in ("fare_blocked", "limit_reached", "credit_stop"):
            add("friction", f"Hit the free allowance: {i.name} {i.props}.", f"at {i.at:%Y-%m-%d %H:%M} UTC")

    # ── Runs left ──
    for i in ev:
        if i.name == "run_abandon":
            p = i.props
            add("friction", f"Abandoned a {p.get('kind')}/{p.get('mode')} run after {p.get('done')} item(s), "
                f"{p.get('right')} right ({_fmt_ms(p.get('ms'))}).", f"run_abandon at {i.at:%Y-%m-%d %H:%M} UTC")

    # ── Failures and speed ──
    for v in vs:
        for i in v["items"]:
            if i.name == "api_error":
                closing = v["end"] - i.at <= CLOSING and i.props.get("status") == 0
                add("note" if closing else "friction",
                    f"`{i.props.get('path')}` failed ({i.props.get('status') or 'no answer'})"
                    + (" as the page closed on it." if closing else "."),
                    f"api_error at {i.at:%H:%M:%S} UTC" + (", the visit's last second" if closing else ""))
            if i.name == "client_error":
                add("friction", f"A script error ({i.props.get('where')}) on `{i.props.get('route')}`.",
                    f"client_error at {i.at:%H:%M:%S} UTC")
            if i.name == "boot_timeout":
                add("block", f"The app never came up: waited {_fmt_ms(i.props.get('waited_ms'))}.",
                    f"boot_timeout at {i.at:%H:%M:%S} UTC")
            if i.name == "app_open" and (i.props.get("boot_ms") or 0) > SLOW_BOOT_MS:
                add("friction", f"A slow boot: {i.props.get('boot_ms')} ms.", f"app_open at {i.at:%H:%M:%S} UTC")
            if i.name == "vitals":
                p = i.props
                bad = []
                if (p.get("lcp") or 0) > POOR_LCP_MS:
                    bad.append(f"largest paint {p['lcp'] / 1000:.1f}s")
                if (p.get("inp") or 0) > POOR_INP_MS:
                    bad.append(f"a tap answered in {p['inp']} ms")
                if (p.get("cls") or 0) > POOR_CLS:
                    bad.append(f"layout shift {p['cls'] / 1000:.2f}")
                if bad:
                    add("friction", f"A slow or jumpy page ({', '.join(bad)}).",
                        f"vitals on `{p.get('route')}`, sent {i.at:%H:%M:%S} UTC")
        opens = [i for i in v["items"] if i.name == "app_open"]
        if len(opens) > 1:
            add("note", f"The page was loaded {len(opens)}× in one visit (reloads, or a sign-in round trip).",
                f"visit {v['sid'] or '—'}: app_open at {', '.join(f'{o.at:%H:%M:%S}' for o in opens)}")

    # ── Bringing them back ──
    last_at = items[-1].at if items else None
    if last_at and now - last_at > timedelta(hours=1):
        if not profile.get("notifications"):
            add("note", "Notifications are off: no reminder will bring them back.",
                "user_profiles.notifications false")
        if not any(i.name == "nudge_opened" for i in ev) and profile.get("notifications"):
            add("note", "Notifications are on, but none has been opened.", "no nudge_opened")

    order = {"block": 0, "friction": 1, "note": 2}
    seen, deduped = set(), []
    for f in out:
        if f["what"] not in seen:
            seen.add(f["what"])
            deduped.append(f)
    return sorted(deduped, key=lambda f: order[f["level"]])


def where_left(items: list[Item], vs: list[dict], now: datetime) -> dict | None:
    if not vs:
        return None
    last_v = vs[-1]
    views = [i for i in last_v["items"] if i.name == "screen_view"]
    screen = views[-1].props.get("route") if views else None
    dwell = next((i.props.get("ms") for i in reversed(last_v["items"])
                  if i.name == "screen_leave" and i.props.get("route") == screen), None)
    tail = [i for i in last_v["items"] if i.name not in ("screen_leave", "vitals")][-5:]
    last_study = next((i for i in reversed(items) if i.study), None)
    return {
        "at": last_v["end"], "ago": _ago(now - last_v["end"]), "screen": screen, "dwell_ms": dwell,
        "tail": tail, "last_study": last_study,
        "visits": len(vs), "days": len({v["start"].date() for v in vs}),
    }


def analyse(data: dict, now: datetime | None = None) -> dict:
    now = now or datetime.now(timezone.utc)
    items = timeline(data)
    vs = visits(items)
    return {
        "items": items, "visits": vs,
        "findings": findings(data, items, vs, now),
        "left": where_left(items, vs, now),
    }


# ── Writing ───────────────────────────────────────────────────────


def _local(at: datetime, offset) -> str:
    if offset is None:
        return ""
    return f" ({(at + timedelta(minutes=offset)):%H:%M} local)"


def _line(i: Item, dwell: dict) -> str:
    p = i.props
    if i.name == "screen_view":
        ms = dwell.get(id(i))
        return f"→ `{p.get('route')}`" + (f" · {_fmt_ms(ms)}" if ms is not None else "")
    if i.name == "boarding_step":
        return f"boarding {p.get('step')} → {p.get('to')} · {_fmt_ms(p.get('ms'))}"
    if i.name == "ride_step":
        return f"ride {p.get('step')} → {p.get('to')} · {_fmt_ms(p.get('ms'))}"
    if i.name == "session_start":
        return "visit opened"
    if i.name == "app_open":
        return f"app loaded · boot {p.get('boot_ms')} ms" + (" · installed" if p.get("standalone") else "")
    if i.name == "study_burst":
        return p["text"]
    shown = {k: v for k, v in p.items() if v is not None}
    if "ms" in shown:
        shown["ms"] = _fmt_ms(shown["ms"])
    return f"{i.name}" + (f" {json.dumps(shown, ensure_ascii=False, default=str)}" if shown else "")


def _fold(its: list[Item], everything: bool) -> tuple[list[Item], dict]:
    """The visit as it reads: a screen_view carries its own dwell and
    its screen_leave goes; a run of study rows is one line."""
    dwell: dict = {}
    if everything:
        return its, dwell
    open_view: dict = {}
    out: list[Item] = []
    burst: list[Item] = []

    def close_burst():
        if not burst:
            return
        reviews = [b for b in burst if b.name == "review"]
        rest = [b for b in burst if b.name != "review"]
        parts = []
        if reviews:
            right = sum(1 for r in reviews if (r.props.get("quality") or 0) >= 3)
            modes = sorted({(r.props.get("mode") or "").split(".")[0] for r in reviews})
            parts.append(f"{len(reviews)} review(s) ({', '.join(modes)}), {right} right")
        for kind in sorted({b.props.get("kind") or b.name for b in rest}):
            same = [b for b in rest if (b.props.get("kind") or b.name) == kind]
            right = sum(1 for b in same if b.props.get("right"))
            parts.append(f"{len(same)} {kind} answer(s), {right} right")
        out.append(Item(burst[0].at, "study_burst",
                        {"text": f"**studied** {'; '.join(parts)} "
                                 f"({burst[0].at:%H:%M}–{burst[-1].at:%H:%M})"}, study=True))
        burst.clear()

    for i in its:
        if i.study and i.name in ("review", "practice"):
            if burst and i.at - burst[-1].at > BURST_GAP:
                close_burst()
            burst.append(i)
            continue
        close_burst()
        if i.name == "screen_view":
            open_view[i.props.get("route")] = i
        if i.name == "screen_leave":
            v = open_view.pop(i.props.get("route"), None)
            if v is not None:
                dwell[id(v)] = dwell.get(id(v), 0) + int(i.props.get("ms") or 0)
            continue
        out.append(i)
    close_burst()
    return out, dwell


def render(data: dict, report: dict, everything: bool = False) -> str:
    uid = data["user_id"]
    p = data.get("profile")
    lines = [f"## Trail of `{uid}`", ""]
    if p is None and not report["items"]:
        return "\n".join(lines + ["_Nothing is recorded under this id: no profile, no trail, no study._", ""])
    if p is None:
        lines += ["_No profile row: the account never finished the boarding, or the id is wrong._", ""]
    if data.get("opted_out"):
        return "\n".join(lines + ["_This learner objected to being measured (Réglages › Données). "
                                  "Nothing is read._", ""])
    offset = (p or {}).get("tz_offset_min")

    if p:
        lines += ["### The account", ""]
        facts = [
            ("created", p.get("created_at")), ("boarded", p.get("onboarded_at")),
            ("first ride stamped", p.get("tutorial_at")), ("guides seen", ", ".join((p.get("guided") or {}).keys()) or None),
            ("level", p.get("jlpt_level")), ("goal", f"{p.get('goal_level')} by {p.get('goal_target_date')}" if p.get("goal_level") else None),
            ("motive", p.get("motive")), ("kana known", p.get("kana_known")),
            ("lines", ", ".join(p.get("lines") or []) or None), ("new a day", p.get("daily_new_target")),
            ("departure", p.get("daily_departure")), ("notifications", f"{p.get('notifications')} (reminder {p.get('reminder_time')})"),
            ("plan", p.get("plan")), ("UTC offset", f"{offset:+d} min" if offset is not None else None),
            ("transfer offered", p.get("transfer_offered_at")),
        ]
        lines += [f"- {k}: {v:%Y-%m-%d %H:%M} UTC" if isinstance(v, datetime) else f"- {k}: {v}"
                  for k, v in facts if v is not None]
        lines.append("")

    reviews = data.get("reviews", [])
    assumed = sum(1 for r in reviews if r.get("assumed"))
    right = sum(1 for r in reviews if (r.get("quality") or 0) >= 3)
    lines += ["### What they did", "",
              f"- reviews: {len(reviews)} ({right} right{f', {assumed} checks of an assumption' if assumed else ''}), "
              f"{data.get('card_rows', 0)} card rows",
              f"- practice answers: {len(data.get('practice', []))}"
              + (f" ({', '.join(sorted({x['kind'] for x in data['practice']}))})" if data.get("practice") else ""),
              f"- exams: {len(data.get('exams', []))} · grammar tours: {len(data.get('grammar_tours', []))} · "
              f"glyph tours: {len(data.get('glyph_tours', []))} · days cleared: {len(data.get('day_clears', []))}",
              f"- XP rows: {len(data.get('xp', []))} · credit moves: {len(data.get('credits', []))} · "
              f"credit stops: {len(data.get('credit_stops', []))}",
              f"- messages to us: {len(data.get('feedback', []))}"
              + (" (read them with `python -m scripts.read_feedback`)" if data.get("feedback") else ""),
              f"- trail rows: {len(data.get('events', []))} raw"
              + (f", {sum(d['n'] for d in data['daily'])} older ones rolled up" if data.get("daily") else ""),
              ""]

    left = report["left"]
    if left:
        lines += ["### Where they left", ""]
        lines.append(f"- last seen {left['at']:%Y-%m-%d %H:%M} UTC{_local(left['at'], offset)}, {left['ago']} ago, "
                     f"after {left['visits']} visit(s) on {left['days']} day(s)")
        if left["screen"]:
            lines.append(f"- on `{left['screen']}`" + (f" for {_fmt_ms(left['dwell_ms'])}" if left["dwell_ms"] is not None else ""))
        ls = left["last_study"]
        lines.append(f"- last answer: {ls.at:%Y-%m-%d %H:%M} UTC ({ls.name})" if ls else "- last answer: never")
        lines.append("- the last things done: " + " · ".join(_line(i, {}) for i in left["tail"]))
        lines.append("")

    lines += ["### What may have gone wrong", ""]
    if not report["findings"]:
        lines.append("_Nothing the trail can see._")
    for f in report["findings"]:
        lines.append(f"- **{f['level']}** — {f['what']}  \n  _{f['evidence']}_")
    lines.append("")

    if data.get("daily"):
        lines += ["### Before the raw trail (rolled up per day)", ""]
        by_day: dict = {}
        for d in data["daily"]:
            by_day.setdefault(d["day"], []).append(f"{d['name']}×{d['n']}")
        lines += [f"- {day}: {', '.join(v)}" for day, v in by_day.items()]
        lines.append("")

    lines += ["### Visit by visit", ""]
    for n, v in enumerate(report["visits"], 1):
        span = v["end"] - v["start"]
        head = (f"#### Visit {n} · {v['start']:%Y-%m-%d %H:%M} UTC{_local(v['start'], offset)} · "
                f"{_fmt_ms(span.total_seconds() * 1000)} long, {_fmt_ms(v['engaged_ms'])} engaged")
        if v["device"]:
            head += f" · {v['device']}"
        lines += [head, ""]
        shown, dwell = _fold(v["items"], everything)
        lines += [f"    {i.at:%H:%M:%S}  {_line(i, dwell)}" for i in shown]
        lines.append("")
    return "\n".join(lines)


def as_json(data: dict, report: dict) -> str:
    def item(i: Item) -> dict:
        return {"at": i.at.isoformat(), "name": i.name, "props": i.props, "sid": i.sid}
    return json.dumps({
        "user_id": data["user_id"],
        "profile": data.get("profile"),
        "opted_out": bool(data.get("opted_out")),
        "findings": report.get("findings", []),
        "left": report["left"] and {**report["left"], "tail": [item(i) for i in report["left"]["tail"]],
                                    "last_study": report["left"]["last_study"] and item(report["left"]["last_study"])},
        "visits": [{**{k: v[k] for k in ("sid", "start", "end", "engaged_ms", "device")},
                    "items": [item(i) for i in v["items"]]} for v in report.get("visits", [])],
    }, default=str, ensure_ascii=False, indent=2)


def main() -> int:
    ap = argparse.ArgumentParser(description="One learner's whole trail, where it stopped, and what may say why.")
    ap.add_argument("user_id", help="the account's Supabase user id")
    ap.add_argument("--all", action="store_true", help="every event, none folded into its screen")
    ap.add_argument("--json", action="store_true", help="the report as JSON")
    args = ap.parse_args()

    conn = db_conn()
    try:
        with conn.cursor() as cur:
            data = gather(cur, args.user_id.strip())
    finally:
        conn.close()

    if data.get("opted_out"):
        report = {"items": [], "visits": [], "findings": [], "left": None}
    else:
        report = analyse(data)
    print(as_json(data, report) if args.json else render(data, report, everything=args.all))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
