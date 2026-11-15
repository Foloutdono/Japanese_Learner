# ── 動画の図書館 — the public library of analysed videos (plan 322) ──
# Every YouTube video a learner's link fetch has analysed is kept here
# once, for everybody: the whole track, its lines already broken down,
# and nothing about who asked. The next learner who pastes that link, or
# picks the video from the library, opens it at once and spends none of
# the link allowance (the fetch goes through a metered proxy, and this is
# what makes the cheapest tier go further).
#
#   - Only what the server fetched itself joins. An upload or a grab
#     only *names* a video id; its text is the learner's, so it stays
#     private (the owner's pick, plan 322). A song, a paste and a window
#     of a video (a minute or two of it) stay private too: the library
#     holds whole tracks.
#   - It is anonymous. No learner is on a row, an entry says how many
#     have studied it (a count over their own sessions) and never which.
#   - A learner's own copy is still a session (routes/video.py): every
#     per-session route (translations, lyrics, the deep tier) reads it
#     as before. The library copies the lines into it, with the video's
#     own translations and none of what the first learner added after.
#   - It is no longer on the analyser's shelf: these sessions do not
#     count toward core/history.HISTORY_LIMIT and are never trimmed by
#     it. "Mine" here lists the ones a learner opened.
#   - A video is sorted into a kind once, by a model (study/video_category.py),
#     so the library can be browsed by music, podcast, drama...
import logging
import threading

from fastapi import APIRouter, Depends, HTTPException, Path, Query

from core.auth import get_user_id
from core.credits import require_pass
from core.db import db_conn
from core.rls import enable_rls
from study import video_category
from study.llm_shared import LLMUnavailable

router = APIRouter(dependencies=[Depends(require_pass)])
logger = logging.getLogger(__name__)

# A YouTube video id, as study/captions.parse_video_id reads one.
VIDEO_ID_PATTERN = r"^[A-Za-z0-9_-]{11}$"

# Library openings a learner may make a day. Each one copies a whole
# track into a session of their own, so it is bounded as the link fetch
# is (counted from the sessions themselves: no counter to keep true).
OPEN_DAILY_CAP = 40

PAGE_MAX = 48
PAGE_DEFAULT = 24
OFFSET_MAX = 10_000
SORTS = ("new", "popular")

# The shelf's other filters beside the kinds. "mine" is the learner's
# own; "all" is no filter.
_KIND_PATTERN = "^(" + "|".join(video_category.CATEGORIES) + ")$"
_SORT_PATTERN = "^(" + "|".join(SORTS) + ")$"


def _ensure_schema() -> None:
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("""
                CREATE TABLE IF NOT EXISTS video_library (
                    video_id     TEXT PRIMARY KEY,
                    category     TEXT,
                    sentences    JSONB NOT NULL,
                    translations JSONB NOT NULL DEFAULT '{}'::jsonb,
                    truncated    INTEGER NOT NULL DEFAULT 0,
                    line_count   INTEGER NOT NULL DEFAULT 0,
                    first_line   TEXT,
                    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
                )
            """)
            enable_rls(cur, "video_library")
            cur.execute("""
                CREATE INDEX IF NOT EXISTS idx_video_library_category
                ON video_library(category, created_at DESC)
            """)
        conn.commit()
    finally:
        conn.close()


try:
    _ensure_schema()
except Exception:  # pragma: no cover - a missing DB must not stop import
    logger.exception("video library schema could not be initialised")


def _refusal(status: int, code: str, message: str) -> HTTPException:
    return HTTPException(status_code=status, detail={"code": code, "message": message})


# ── Joining the library ───────────────────────────────────────────
def joins(source: str | None, video_id: str | None, window_start, window_end) -> bool:
    """Whether a ready session belongs in the library: a link-fetched
    YouTube video, whole."""
    return source == "youtube" and bool(video_id) and window_start is None and window_end is None


def add(cur, video_id: str, sentences_json: str, truncated: int, translations_json: str,
        line_count: int, first_line: str | None) -> bool:
    """The video's row, on the caller's cursor and in its transaction;
    False when the library already had it (the first track stands: it is
    the same video, and a second learner's copy adds nothing)."""
    cur.execute(
        """
        INSERT INTO video_library
            (video_id, sentences, truncated, translations, line_count, first_line)
        VALUES (%s, %s, %s, %s, %s, %s)
        ON CONFLICT (video_id) DO NOTHING
        """,
        (video_id, sentences_json, truncated, translations_json, line_count, first_line),
    )
    return cur.rowcount == 1


def sort_into_a_kind(video_id: str, user_id: str) -> str | None:
    """Sorts a video that has no kind yet, on `user_id`'s ration. Never
    raises: a library entry with no kind is listed under "all" and asked
    again at its next opening, and the session that brought it here
    is already ready. Returns the kind it was given, if any."""
    try:
        conn = db_conn()
        try:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT sentences FROM video_library WHERE video_id = %s AND category IS NULL",
                    (video_id,),
                )
                row = cur.fetchone()
        finally:
            conn.close()
        if row is None:
            return None
        lines = [s.get("text") or "" for s in (row[0] or []) if not s.get("foreign")]
        try:
            kind = video_category.categorise(user_id, lines)
        except video_category.OverLimit:
            logger.info("Video %s not sorted: %s's allowance is spent", video_id, user_id)
            return None
        except LLMUnavailable:
            logger.warning("Video %s not sorted: no model could be reached", video_id)
            return None
        if kind is None:
            return None
        conn = db_conn()
        try:
            with conn.cursor() as cur:
                cur.execute(
                    "UPDATE video_library SET category = %s WHERE video_id = %s AND category IS NULL",
                    (kind, video_id),
                )
            conn.commit()
        finally:
            conn.close()
        return kind
    except Exception:
        logger.exception("Video %s could not be sorted into a kind", video_id)
        return None


def sort_later(video_id: str, user_id: str) -> None:
    """The same, off the request: the learner who opens an unsorted video
    is not made to wait for a model."""
    threading.Thread(
        target=sort_into_a_kind, args=(video_id, user_id),
        name=f"video-category:{video_id}", daemon=True,
    ).start()


# ── Opening one ───────────────────────────────────────────────────
def open_for(cur, user_id: str, video_id: str) -> int | None:
    """A ready session of the learner's own over the library's copy of
    `video_id`, on the caller's cursor and in its transaction: the one
    they already have of that video, whole, if they have one, else a new
    one made from the library's row. None when the library has no such
    video (a learner's own old session of it is then no answer: the
    fetch makes a new one, and the library keeps that). Raises a 429 past
    OPEN_DAILY_CAP new openings today."""
    # One lock per learner: two openings at once make one session.
    cur.execute("SELECT pg_advisory_xact_lock(%s, hashtext(%s))", (931_322, user_id))
    cur.execute("SELECT 1 FROM video_library WHERE video_id = %s", (video_id,))
    if cur.fetchone() is None:
        return None
    cur.execute(
        """
        SELECT id FROM video_sessions
         WHERE user_id = %s AND source = 'youtube' AND video_id = %s
           AND status = 'ready' AND deleted_at IS NULL
           AND window_start IS NULL AND window_end IS NULL
         ORDER BY created_at DESC, id DESC
         LIMIT 1
        """,
        (user_id, video_id),
    )
    own = cur.fetchone()
    if own is not None:
        return own[0]
    cur.execute(
        """
        SELECT COUNT(*) FROM video_sessions
         WHERE user_id = %s AND from_library AND created_at > NOW() - INTERVAL '1 day'
        """,
        (user_id,),
    )
    if cur.fetchone()[0] >= OPEN_DAILY_CAP:
        raise _refusal(
            429, "library_allowance",
            "You have opened today's allowance of library videos. Come back tomorrow.",
        )
    cur.execute(
        """
        INSERT INTO video_sessions
            (user_id, source, source_ref, window_start, window_end, window_capped, status,
             sentences, truncated, translations, video_id, from_library)
        SELECT %s, 'youtube', video_id, NULL, NULL, FALSE, 'ready',
               sentences, truncated, translations, video_id, TRUE
          FROM video_library WHERE video_id = %s
        RETURNING id
        """,
        (user_id, video_id),
    )
    return cur.fetchone()[0]


def open_video(user_id: str, video_id: str) -> int | None:
    """open_for in a transaction of its own; an unsorted video is sorted
    in the background on the opener's ration."""
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            session_id = open_for(cur, user_id, video_id)
            unsorted = False
            if session_id is not None:
                cur.execute(
                    "SELECT category IS NULL FROM video_library WHERE video_id = %s", (video_id,)
                )
                row = cur.fetchone()
                unsorted = bool(row and row[0])
        conn.commit()
    finally:
        conn.close()
    if session_id is not None and unsorted:
        sort_later(video_id, user_id)
    return session_id


@router.post("/api/video/library/{video_id}/open")
def open_library_video(video_id: str = Path(..., pattern=VIDEO_ID_PATTERN),
                       user_id: str = Depends(get_user_id)):
    """The learner's own session over a library video, ready to read:
    the same shape the intake's 202 answers with, so the analyser opens
    it as it opens any session."""
    session_id = open_video(user_id, video_id)
    if session_id is None:
        raise HTTPException(status_code=404, detail="Video not in the library")
    return {"sessionId": session_id, "status": "ready", "videoId": video_id}


# ── Browsing ──────────────────────────────────────────────────────
_LEARNERS = """
    SELECT video_id, COUNT(DISTINCT user_id) AS n
      FROM video_sessions
     WHERE source = 'youtube' AND status = 'ready' AND deleted_at IS NULL
     GROUP BY video_id
"""
_MINE = """
    EXISTS (SELECT 1 FROM video_sessions s
             WHERE s.user_id = %(user)s AND s.source = 'youtube'
               AND s.video_id = l.video_id AND s.status = 'ready'
               AND s.deleted_at IS NULL)
"""


@router.get("/api/video/library")
def browse_library(user_id: str = Depends(get_user_id),
                   category: str | None = Query(None, pattern=_KIND_PATTERN),
                   mine: bool = Query(False),
                   sort: str = Query("new", pattern=_SORT_PATTERN),
                   limit: int = Query(PAGE_DEFAULT, ge=1, le=PAGE_MAX),
                   offset: int = Query(0, ge=0, le=OFFSET_MAX)):
    """A page of the library, newest first (or the most studied), and
    what the chips show: how many videos each kind holds, and how many
    the learner opened. `sentences` is DELIBERATELY not selected, as the
    shelf's listing leaves it out: a track is hundreds of lines and a
    page of them would be the corpus; the count and the card's line
    are stored beside it."""
    where = ["TRUE"]
    params: dict = {"user": user_id, "limit": limit, "offset": offset}
    if category:
        where.append("l.category = %(category)s")
        params["category"] = category
    if mine:
        where.append(_MINE)
    order = "COALESCE(u.n, 0) DESC, l.created_at DESC, l.video_id" if sort == "popular" \
        else "l.created_at DESC, l.video_id"
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                f"""
                SELECT l.video_id, l.category, l.line_count, l.first_line, l.truncated,
                       l.created_at, COALESCE(u.n, 0), {_MINE}
                  FROM video_library l
                  LEFT JOIN ({_LEARNERS}) u ON u.video_id = l.video_id
                 WHERE {' AND '.join(where)}
                 ORDER BY {order}
                 LIMIT %(limit)s OFFSET %(offset)s
                """,
                params,
            )
            rows = cur.fetchall()
            cur.execute(
                f"SELECT COUNT(*) FROM video_library l WHERE {' AND '.join(where)}", params,
            )
            total = cur.fetchone()[0]
            cur.execute("SELECT category, COUNT(*) FROM video_library GROUP BY category")
            by_kind = dict(cur.fetchall())
            cur.execute(
                f"SELECT COUNT(*) FROM video_library l WHERE {_MINE}", {"user": user_id},
            )
            mine_count = cur.fetchone()[0]
    finally:
        conn.close()

    counts = {kind: by_kind.get(kind, 0) for kind in video_category.CATEGORIES}
    counts["all"] = sum(by_kind.values())
    counts["mine"] = mine_count
    return {
        "videos": [
            {
                "videoId": video_id, "category": kind, "lineCount": line_count,
                "firstLine": first_line, "truncated": truncated,
                "addedAt": created_at.isoformat(), "learners": learners, "mine": bool(is_mine),
            }
            for video_id, kind, line_count, first_line, truncated, created_at, learners, is_mine in rows
        ],
        "total": total,
        "counts": counts,
        "categories": list(video_category.CATEGORIES),
    }
