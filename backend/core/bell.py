"""
The owner's bell (plan 278): a post in a private Discord forum for each
message a learner writes (routes/feedback.py) and each deck reported
in the library (routes/decks.report_deck), so a person knows there is
something to read without having to go and look.

It rings; it never carries the message. A post holds what the row
holds in closed classes alone -- the kind, the row's number, a card's
or a question's id and what is wrong with it, a rating, the screen, a
failure's area and status, how many characters were written and
whether an answer was asked for -- and never the words, the reply's
address or the learner's id. privacy.html says so: a message's words
are passed to nobody, and Discord is somebody. The words are read
where they are kept, with scripts/read_feedback.py, which every post
names; the message's status (new, seen, done, dropped) is set there
too, so the forum is a bell and the table the one queue.

The forum sorts its posts by tags: one per kind, and two that say a
message came from under a failure or asks for an answer (TAGS). A
webhook applies a tag by its id, which only Discord's API gives, so the
ids are read once by `python -m scripts.discord_bell` and kept in
DISCORD_FEEDBACK_TAGS. Unset, the webhook is silent; a tag without an
id is left off; a post Discord refuses with its tags is sent again
without them, and any other refusal is logged and dropped.

Never on the request's path: the post is sent from a thread of its
own, after the row is committed, with a short timeout -- a Discord that
is down or slow costs a learner nothing (plan 211).
"""
import logging
import os
import threading

import httpx

logger = logging.getLogger(__name__)

WEBHOOK_ENV = "DISCORD_FEEDBACK_WEBHOOK"
TAGS_ENV = "DISCORD_FEEDBACK_TAGS"
# Discord asks every client to name itself so.
USER_AGENT = "DiscordBot (https://github.com/Foloutdono/Japanese_Learner, 278)"
TIMEOUT = httpx.Timeout(5.0, connect=2.0)

# The forum's tags, by key: a message's kind, a reported deck, and the
# two a message can carry beside its kind. The names are the ones
# scripts/discord_bell.py finds or creates in the forum.
TAGS = {
    "problem": "Problème",
    "idea": "Idée",
    "fault": "Faute",
    "card": "Carte",
    "question": "Examen",
    "rating": "Note",
    "deck": "Paquet",
    "failure": "Panne",
    "reply": "À répondre",
}

# What a report says is wrong, in the owner's words. Every closed reason
# of routes/feedback.py and routes/decks.py has one (tests/test_bell.py).
REASONS = {
    "reading": "lecture",
    "meaning": "sens",
    "audio": "audio",
    "example": "exemple",
    "answer": "réponse",
    "ambiguous": "ambiguë",
    "spam": "spam",
    "offensive": "offensant",
    "wrong": "faux",
    "copyright": "droits d'auteur",
    "other": "autre",
}

# Discord's own bounds on a forum post.
THREAD_NAME_MAX = 100


def tag_ids() -> dict[str, str]:
    """DISCORD_FEEDBACK_TAGS, `card=123,problem=456`, as {key: id}. A pair
    that is not a known key and a snowflake is ignored."""
    out = {}
    for pair in os.environ.get(TAGS_ENV, "").split(","):
        key, _, value = (part.strip() for part in pair.partition("="))
        if key in TAGS and value.isdigit():
            out[key] = value
    return out


def _code(value) -> str:
    """An id as inline code: shown as typed, never read as markdown."""
    text = str(value).replace("`", "'").replace("\n", " ")
    return f"`{text}`"


def _reasons(reasons) -> str:
    return ", ".join(REASONS.get(r, r) for r in reasons) or "—"


def _stars(rating: int) -> str:
    return "★" * rating + "☆" * (5 - rating)


def post(name: str, lines: list[str], tags: list[str]) -> dict:
    """A forum post: its thread's name, its lines, the tags it carries
    (keys of TAGS; one without an id is left off)."""
    ids = tag_ids()
    payload = {
        "thread_name": name[:THREAD_NAME_MAX],
        "content": "\n".join(lines),
        # Nothing in a post may ping anyone, whatever an id spells.
        "allowed_mentions": {"parse": []},
    }
    applied = [ids[t] for t in tags if t in ids]
    if applied:
        payload["applied_tags"] = applied
    return payload


def message_post(*, number: int, kind: str, chars: int, reasons=(), card_id=None,
                 exam_id=None, revision=None, question_id=None, rating=None,
                 route=None, area=None, status=None, reply=False) -> dict:
    """The post for one row of `feedback`. It is handed how many
    characters were written, never the words, so no change here can
    send them."""
    label = TAGS.get(kind, kind)
    lines = [f"**#{number}** · {label}"]
    if kind == "card" and card_id:
        name = f"{label} · {card_id}"
        lines.append(f"Carte {_code(card_id)} · {_reasons(reasons)}")
    elif kind == "question" and exam_id:
        name = f"{label} · {exam_id} · {question_id}"
        lines.append(f"Question {_code(question_id)} de {_code(exam_id)} r{revision} · {_reasons(reasons)}")
    elif kind == "rating" and rating:
        name = f"{label} · {_stars(rating)}"
        lines.append(f"{_stars(rating)} {rating}/5")
    elif area:
        name = f"{label} · {area} {status}"
    else:
        name = label
    name = f"{name} · #{number}"
    if area:
        lines.append(f"Échec {_code(area)} · {status}")
    if route:
        lines.append(f"Écran {_code(route)}")
    words = f"{chars} caractère{'s' if chars > 1 else ''}" if chars else "sans mot"
    lines.append(f"{words} · réponse demandée" if reply else words)
    lines.append(_code(f"python -m scripts.read_feedback --id {number}"))
    tags = [kind] + (["failure"] if area else []) + (["reply"] if reply else [])
    return post(name, lines, tags)


def deck_post(*, deck_id: int, reason: str, reports: int) -> dict:
    """The post for a deck reported in the library: which deck, what it
    was reported for, and how many learners have reported it."""
    label = TAGS["deck"]
    lines = [
        f"**{label} n°{deck_id}** · {_reasons([reason])}",
        f"{reports} signalement{'s' if reports > 1 else ''} en tout",
        f"Bibliothèque {_code(f'/learn/decks/library/{deck_id}')}",
    ]
    return post(f"{label} · n°{deck_id} · {_reasons([reason])}", lines, ["deck"])


def send(payload: dict, url: str | None = None) -> int | None:
    """Post now, on this thread; the HTTP status, or None when unset or
    unreachable. A post refused with its tags (a tag deleted since its
    id was read) is sent again without them, so the bell still rings."""
    url = url or os.environ.get(WEBHOOK_ENV, "").strip()
    if not url:
        return None
    try:
        r = httpx.post(url, json=payload, timeout=TIMEOUT, headers={"User-Agent": USER_AGENT})
        if r.status_code == 400 and "applied_tags" in payload:
            logger.warning("bell: Discord refused the tags; sent without them (run scripts.discord_bell)")
            bare = {k: v for k, v in payload.items() if k != "applied_tags"}
            r = httpx.post(url, json=bare, timeout=TIMEOUT, headers={"User-Agent": USER_AGENT})
    except httpx.HTTPError:
        logger.warning("bell: Discord could not be reached", exc_info=True)
        return None
    if r.status_code >= 300:
        logger.warning("bell: Discord answered %s", r.status_code)
    return r.status_code


def ring(payload: dict) -> None:
    """Post in the background, or not at all when no webhook is set."""
    if not os.environ.get(WEBHOOK_ENV, "").strip():
        return
    threading.Thread(target=send, args=(payload,), name="bell", daemon=True).start()
