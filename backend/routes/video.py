# ── Study a video's Japanese subtitles ────────────────────────────
# The pipeline is source-agnostic (docs/adr/0003): a Track is a Track,
# whether it came from an upload or a best-effort YouTube fetch, and
# everything from sentences_from_cues onward never knows which. Upload
# is a first-class ingest, not a fallback -- YouTube blocks datacenter
# IPs (this backend deploys on Render), so the YouTube path is EXPECTED
# to fail in production.
#
# The job pattern (claim lock + daemon-thread worker + polling GET) is
# copied deliberately from routes/exams.py rather than shared with it --
# see that module's own comment on why a plain thread outlives a
# request's own lifecycle when FastAPI's async-task helper would not.
# Video sessions are simpler in one respect: each POST
# always creates a brand-new row (no revision/reuse economy to protect,
# unlike a shared exam paper), so the lock's job here is narrower --
# making a session's own worker-start idempotent -- but the shape is
# the same on purpose, for the next reader who already knows it.
import json
import logging
import threading

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from core.db import db_conn
from core.auth import get_user_id
from core.srs_instance import srs
from study.analysis import analyze_local, attach_user_state
from study.captions import (
    parse_track, parse_pasted_transcript, parse_video_id, CaptionParseError,
)
from study.cue_sentences import sentences_from_cues
from study.sentences import MAX_SENTENCES
# _analyze_sentence already bundles local + optional-deep + per-user
# SRS state, and buying its deep tier shares phrase_analysis_cache --
# reused wholesale rather than reimplemented, the same pattern
# routes/translation.py uses for routes/reading.py's _chat.
from routes.phrase import _analyze_sentence

router = APIRouter()
logger = logging.getLogger(__name__)

# 5 minutes. Analysis cost scales with the Window, so it is bounded
# rather than the Sentence count alone -- a capped MAX_SENTENCES over an
# unbounded Window would still let a caller ask for hours of captions.
# The Window used to be capped at 5 minutes. It was protecting against
# unbounded analysis work, and MAX_SENTENCES already does that -- it was
# a second, blunter cap on the same thing, and one the learner had to
# think about. Removed 2026-08-27; see docs/adr/0003's amendment.
# Subtitle files are plain text; 1 MB is already generous (a feature-
# length film's SRT is a few hundred KB).
_MAX_UPLOAD_BYTES = 1 * 1024 * 1024

# Same reasoning and same values as routes/exams.py's own constants --
# see that module's comment. Not shared as an import: a generic
# "job retry policy" abstraction across two payloads this different
# would cost more than the duplication (see plan 019's own scope notes).
_FAILED_COOLDOWN_SECONDS = 300
_STALE_RUNNING_SECONDS = 900



def _optional_seconds(raw, field: str) -> float | None:
    """A Window bound the learner may simply not have given. Absent or
    blank is None ("no bound"), which is the common case -- not 0.0,
    which would silently mean "from the very start" for `end`."""
    if raw is None:
        return None
    if isinstance(raw, str) and not raw.strip():
        return None
    try:
        return float(raw)
    except (TypeError, ValueError):
        raise HTTPException(status_code=400, detail=f"{field} must be a number")


def _ensure_video_schema() -> None:
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("""
                CREATE TABLE IF NOT EXISTS video_sessions (
                    id            BIGSERIAL PRIMARY KEY,
                    user_id       TEXT NOT NULL,
                    source        TEXT NOT NULL,
                    source_ref    TEXT NOT NULL,
                    window_start  DOUBLE PRECISION NOT NULL,
                    window_end    DOUBLE PRECISION NOT NULL,
                    window_capped BOOLEAN NOT NULL DEFAULT FALSE,
                    status        TEXT NOT NULL DEFAULT 'generating',
                    error         TEXT,
                    sentences     JSONB,
                    truncated     INTEGER NOT NULL DEFAULT 0,
                    video_id      TEXT,
                    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
                )
            """)
            # Additive, for databases created before video_id existed.
            # A session's video is independent of where its captions came
            # from now: you can upload an .srt AND name a video to play
            # alongside it. NULL means "transcript only, no player".
            cur.execute("ALTER TABLE video_sessions ADD COLUMN IF NOT EXISTS video_id TEXT")
            # The Window is optional now (NULL = unbounded), so the two
            # bounds can no longer be NOT NULL. Additive and idempotent,
            # like video_id above.
            cur.execute("ALTER TABLE video_sessions ALTER COLUMN window_start DROP NOT NULL")
            cur.execute("ALTER TABLE video_sessions ALTER COLUMN window_end DROP NOT NULL")
            cur.execute("""
                CREATE INDEX IF NOT EXISTS idx_video_sessions_user
                ON video_sessions(user_id, created_at DESC)
            """)
            cur.execute("""
                CREATE TABLE IF NOT EXISTS video_session_jobs (
                    session_id  BIGINT PRIMARY KEY REFERENCES video_sessions(id) ON DELETE CASCADE,
                    status      TEXT NOT NULL,
                    error       TEXT,
                    retry_after TIMESTAMPTZ,
                    started_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
                )
            """)
        conn.commit()
    finally:
        conn.close()


try:
    _ensure_video_schema()
except Exception:  # pragma: no cover - a missing DB must not stop import
    logger.exception("video schema could not be initialised")


# ── The worker ─────────────────────────────────────────────────
def _fail_session(session_id: int, message: str) -> None:
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "UPDATE video_sessions SET status = 'failed', error = %s WHERE id = %s",
                (message[:2000], session_id),
            )
            cur.execute(
                """
                UPDATE video_session_jobs
                   SET status = 'failed', error = %s,
                       retry_after = NOW() + make_interval(secs => %s),
                       updated_at = NOW()
                 WHERE session_id = %s
                """,
                (message[:2000], _FAILED_COOLDOWN_SECONDS, session_id),
            )
        conn.commit()
    finally:
        conn.close()


def _video_worker(session_id: int, source: str, source_ref: str, content: str | None,
                   filename: str | None, window_start: float | None, window_end: float | None) -> None:
    """Runs off-request. Parses/fetches the Track, reconstructs
    Sentences, analyzes each with the LOCAL tier only (never a model --
    see docs/adr/0001), and materializes the result. Owns the job row
    from 'running' through to either deleted (success) or 'failed'."""
    try:
        # Both ingests are purely local -- no request leaves this server
        # while building a Track. The YouTube fetch that used to be the
        # third branch was removed 2026-08-26; see study/captions.py's
        # module docstring for the measurements behind that.
        if source == "paste":
            cues = parse_pasted_transcript(content or "")
        else:
            cues = parse_track(content, filename or "upload.srt")
    except CaptionParseError as e:
        logger.warning("Subtitle parse failed for session %s: %s", session_id, e)
        _fail_session(session_id, str(e))
        return
    except Exception as e:  # pragma: no cover - defensive
        logger.exception("Unexpected error building track for session %s", session_id)
        _fail_session(session_id, f"unexpected error: {e}")
        return

    all_sentences = sentences_from_cues(cues, window_start, window_end)
    truncated = max(0, len(all_sentences) - MAX_SENTENCES)
    kept = all_sentences[:MAX_SENTENCES]

    analyzed = []
    for s in kept:
        if s["japanese"]:
            analysis = analyze_local(s["text"])
        else:
            # Kept, not dropped. A Korean verse or an English ad-lib is
            # part of the track the learner is reading along with, so it
            # stays in the list and simply says what it is. Shaped like
            # an analyze_local result so nothing downstream needs a
            # second branch; `foreign` is what the UI keys off.
            analysis = {
                "text": s["text"], "tokens": [], "grammar": [],
                "level": None, "grade": None, "available": True,
                "foreign": True,
            }
        analysis["cue_start"] = s["cue_start"]
        analysis["cue_end"] = s["cue_end"]
        analyzed.append(analysis)

    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                UPDATE video_sessions
                   SET status = 'ready', sentences = %s, truncated = %s
                 WHERE id = %s
                """,
                (json.dumps(analyzed, ensure_ascii=False), truncated, session_id),
            )
            cur.execute("DELETE FROM video_session_jobs WHERE session_id = %s", (session_id,))
        conn.commit()
        logger.info("Video session %s ready: %d sentences (%d truncated)",
                    session_id, len(analyzed), truncated)
    finally:
        conn.close()


def _start_worker(session_id: int, source: str, source_ref: str, content: str | None,
                   filename: str | None, window_start: float | None, window_end: float | None) -> None:
    threading.Thread(
        target=_video_worker,
        args=(session_id, source, source_ref, content, filename, window_start, window_end),
        name=f"video-session:{session_id}", daemon=True,
    ).start()


# ── Session creation ───────────────────────────────────────────
@router.post("/api/video/session")
async def create_video_session(request: Request, user_id: str = Depends(get_user_id)):
    """Accepts EITHER a JSON body {url, start, end} (YouTube) or a
    multipart upload {file, start, end} (a subtitle file) -- the one
    request shape the plan calls for, so this reads the raw Request
    rather than declaring a single Pydantic body (FastAPI cannot mix a
    JSON model and File/Form fields on one route)."""
    content_type = request.headers.get("content-type", "")

    if content_type.startswith("multipart/form-data"):
        form = await request.form()
        upload = form.get("file")
        if upload is None:
            raise HTTPException(status_code=400, detail="file is required for an upload")
        raw = await upload.read()
        if len(raw) > _MAX_UPLOAD_BYTES:
            raise HTTPException(status_code=413, detail="Subtitle file is too large")
        try:
            content = raw.decode("utf-8")
        except UnicodeDecodeError:
            raise HTTPException(status_code=400, detail="Subtitle file must be UTF-8 text")
        source = "upload"
        source_ref = upload.filename or "upload"
        # Optional, and NEVER fetched from -- it only names a video to
        # embed alongside the transcript. See the JSON branch below.
        video_id = parse_video_id(form.get("url") or "")
        try:
            window_start = _optional_seconds(form.get("start"), "start")
            window_end = _optional_seconds(form.get("end"), "end")
        except (TypeError, ValueError):
            raise HTTPException(status_code=400, detail="start/end must be numbers")
        filename = upload.filename
    else:
        try:
            body = await request.json()
        except Exception:
            raise HTTPException(status_code=400, detail="Expected a JSON body or a multipart upload")
        # JSON means "a pasted transcript". The transcript is the
        # REQUIRED part; `url` is optional and is used for exactly one
        # thing -- naming a video to embed alongside it. Nothing is ever
        # fetched from it. (Until 2026-08-26 a bare URL meant "fetch the
        # captions yourself"; that path is gone, because a server cannot
        # get them -- see study/captions.py's module docstring.)
        pasted = (body.get("transcript") or "").strip()
        if not pasted:
            raise HTTPException(
                status_code=400,
                detail="A pasted transcript is required. Upload a subtitle file instead if you have one.",
            )
        url = body.get("url") or ""
        video_id = parse_video_id(url)
        if url and video_id is None:
            raise HTTPException(status_code=400, detail="Not a recognized YouTube URL")
        source = "paste"
        content = pasted
        source_ref = video_id or "paste"
        filename = None
        try:
            window_start = _optional_seconds(body.get("start"), "start")
            window_end = _optional_seconds(body.get("end"), "end")
        except (TypeError, ValueError):
            raise HTTPException(status_code=400, detail="start/end must be numbers")

    # Only a Window with BOTH bounds can be back-to-front. One bound on
    # its own ("from 2:30 on", "up to 4:00") is a perfectly good Window,
    # and no bounds at all is the default.
    if window_start is not None and window_end is not None and window_end <= window_start:
        raise HTTPException(status_code=400, detail="end must be after start")

    # Kept in the row and the response so old sessions still read back,
    # but nothing sets it any more -- the Window is uncapped.
    window_capped = False

    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO video_sessions
                    (user_id, source, source_ref, window_start, window_end, window_capped, video_id)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
                RETURNING id
                """,
                (user_id, source, source_ref, window_start, window_end, window_capped, video_id),
            )
            (session_id,) = cur.fetchone()
            cur.execute(
                "INSERT INTO video_session_jobs (session_id, status) VALUES (%s, 'running')",
                (session_id,),
            )
        conn.commit()
    finally:
        conn.close()

    _start_worker(session_id, source, source_ref, content, filename, window_start, window_end)
    return JSONResponse(
        status_code=202,
        content={"sessionId": session_id, "status": "generating", "windowCapped": window_capped},
    )


def _load_session(session_id: int, user_id: str) -> dict | None:
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT source, source_ref, window_start, window_end, window_capped,
                       status, error, sentences, truncated, created_at, video_id
                  FROM video_sessions WHERE id = %s AND user_id = %s
                """,
                (session_id, user_id),
            )
            row = cur.fetchone()
    finally:
        conn.close()
    if row is None:
        return None
    (source, source_ref, window_start, window_end, window_capped,
     status, error, sentences, truncated, created_at, video_id) = row
    return {
        "source": source, "source_ref": source_ref,
        "window_start": window_start, "window_end": window_end, "window_capped": window_capped,
        "status": status, "error": error, "sentences": sentences, "truncated": truncated,
        "created_at": created_at, "video_id": video_id,
    }


def _job_state(session_id: int) -> str:
    """'running' | 'stale' | 'missing' for a session's claim-lock row.

    Three states, not a boolean: 'missing' and 'stale' both used to
    collapse into "treat as lost", and they are not the same thing --
    see get_video_session's comment on the race that distinction fixes.
    """
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT updated_at < NOW() - make_interval(secs => %s) FROM video_session_jobs WHERE session_id = %s",
                (_STALE_RUNNING_SECONDS, session_id),
            )
            row = cur.fetchone()
    finally:
        conn.close()
    if row is None:
        return "missing"
    return "stale" if row[0] else "running"


@router.get("/api/video/session/{session_id}")
def get_video_session(session_id: int, user_id: str = Depends(get_user_id)):
    session = _load_session(session_id, user_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Session not found")

    if session["status"] == "generating":
        job = _job_state(session_id)
        if job == "missing":
            # AMBIGUOUS, and this was a real bug: a missing job row means
            # EITHER the worker died, OR it just succeeded. _video_worker
            # deletes this row in the SAME transaction that sets
            # status='ready', while the session read above happened on a
            # DIFFERENT connection a moment earlier -- so a session that
            # had already finished could be reported as
            # "Generation stalled", losing it for the learner. Caught
            # 2026-08-26 as a flaky test on a slow run; a loaded server
            # widens the window rather than narrowing it.
            #
            # Observing the row GONE proves that transaction committed,
            # so re-reading now is guaranteed to see the final status.
            session = _load_session(session_id, user_id) or session
            if session["status"] == "generating":
                # Still generating with no job row: the worker really is
                # lost (it never wrote one, or it was cleaned up under
                # us). That is the case this branch was written for.
                job = "stale"
        if session["status"] == "generating":
            if job == "stale":
                return JSONResponse(
                    status_code=503,
                    content={"status": "failed", "error": "Generation stalled -- please try again."},
                )
            return JSONResponse(status_code=202, content={"status": "generating"})

    if session["status"] == "failed":
        return JSONResponse(
            status_code=503,
            content={
                "status": "failed",
                "error": session["error"],
                "isYoutube": session["source"] == "youtube",
            },
        )

    states = srs.get_user_states(user_id)
    sentences = [attach_user_state(s, states, user_id) for s in (session["sentences"] or [])]
    return {
        "status": "ready",
        "source": session["source"],
        "sourceRef": session["source_ref"],
        # None when there is no video to play -- a subtitle file studied
        # on its own is a perfectly normal session.
        "videoId": session["video_id"],
        "windowStart": session["window_start"],
        "windowEnd": session["window_end"],
        "windowCapped": session["window_capped"],
        "truncated": session["truncated"],
        "sentences": sentences,
    }


@router.get("/api/video/sessions")
def list_video_sessions(user_id: str = Depends(get_user_id),
                         limit: int = Query(20, ge=1, le=100)):
    """運行履歴 for 動画. The one thing missing that kept video out of the
    analyser's history panel entirely -- a session was reachable by id
    and by nothing else, so closing the tab lost it.

    `sentences` is DELIBERATELY not selected. It is a JSONB array that
    can run to hundreds of entries, and a listing that pulled it would
    ship the whole corpus of every session the learner has ever made to
    render twenty rows. The count comes from jsonb_array_length instead,
    computed server-side over the stored value.

    Only `ready` sessions are listed. A 'generating' one has nothing to
    reopen yet and a 'failed' one has nothing to reopen at all; both are
    transient states the poll already surfaces where they happen.
    """
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT id, source, source_ref, video_id, truncated, created_at,
                       COALESCE(jsonb_array_length(sentences), 0) AS sentence_count
                  FROM video_sessions
                 WHERE user_id = %s AND status = 'ready'
                 ORDER BY created_at DESC
                 LIMIT %s
                """,
                (user_id, limit),
            )
            rows = cur.fetchall()
    finally:
        conn.close()

    return [
        {
            "id": row_id,
            "source": source,
            "sourceRef": source_ref,
            "videoId": video_id,
            "sentenceCount": sentence_count,
            "truncated": truncated,
            "createdAt": created_at.isoformat(),
        }
        for row_id, source, source_ref, video_id, truncated, created_at, sentence_count in rows
    ]


class ExplainPayload(BaseModel):
    lang: str = "en"


@router.post("/api/video/session/{session_id}/sentence/{index}/explain")
def explain_video_sentence(session_id: int, index: int, payload: ExplainPayload,
                           user_id: str = Depends(get_user_id)):
    """Buys the deep tier for ONE Sentence -- never the whole session
    (see study/analysis and docs/adr/0001). Shares phrase_analysis_cache
    with /api/phrase/analyze via _analyze_sentence. Also keeps the
    Sentence in the bank with video provenance (plan 016's
    phrase_history.source/source_ref), the same way /api/phrase/analyze
    does for typed/image Passages."""
    session = _load_session(session_id, user_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Session not found")
    if session["status"] != "ready":
        raise HTTPException(status_code=409, detail="Session is not ready yet")

    sentences = session["sentences"] or []
    if index < 0 or index >= len(sentences):
        raise HTTPException(status_code=404, detail="No such sentence in this session")

    text = sentences[index]["text"]
    states = srs.get_user_states(user_id)
    explained = _analyze_sentence(text, deep=True, lang=payload.lang, states=states, user_id=user_id)

    cue_start = sentences[index].get("cue_start")
    source_ref = f"{session['source_ref']}@{cue_start}" if cue_start is not None else session["source_ref"]
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "INSERT INTO phrase_history(user_id, phrase, source, source_ref) VALUES (%s, %s, %s, %s)",
                (user_id, text, "video", source_ref),
            )
        conn.commit()
    finally:
        conn.close()

    # A Cue is a Sentence, and a Sentence's cue times are part of it.
    # _analyze_sentence builds from TEXT alone -- analyze_local is pure
    # by design and knows nothing about cues -- so returning it bare
    # dropped cue_start/cue_end and `foreign`. The frontend swaps the
    # returned object in wholesale, so buying the deep tier for subtitle
    # line 12 deleted that line's timestamp AND its playback window:
    # `seconds >= None` never matches again, so the video could never
    # highlight it a second time.
    merged = {**sentences[index], **explained}
    for key in ("cue_start", "cue_end", "foreign"):
        if key in sentences[index]:
            merged[key] = sentences[index][key]

    return merged
