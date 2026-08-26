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

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from core.db import db_conn
from core.auth import get_user_id
from core.srs_instance import srs
from study.analysis import analyze_local, attach_user_state
from study.captions import (
    parse_track, parse_pasted_transcript, parse_video_id, fetch_youtube_track,
    CaptionParseError, CaptionsUnavailable,
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
_MAX_WINDOW_SECONDS = 300.0
# Subtitle files are plain text; 1 MB is already generous (a feature-
# length film's SRT is a few hundred KB).
_MAX_UPLOAD_BYTES = 1 * 1024 * 1024

# Same reasoning and same values as routes/exams.py's own constants --
# see that module's comment. Not shared as an import: a generic
# "job retry policy" abstraction across two payloads this different
# would cost more than the duplication (see plan 019's own scope notes).
_FAILED_COOLDOWN_SECONDS = 300
_STALE_RUNNING_SECONDS = 900


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
                    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
                )
            """)
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
                   filename: str | None, window_start: float, window_end: float) -> None:
    """Runs off-request. Parses/fetches the Track, reconstructs
    Sentences, analyzes each with the LOCAL tier only (never a model --
    see docs/adr/0001), and materializes the result. Owns the job row
    from 'running' through to either deleted (success) or 'failed'."""
    try:
        if source == "upload":
            cues = parse_track(content, filename or "upload.srt")
        elif source == "paste":
            # No network call at all -- see the route's comment on why
            # this never falls back to the fetch.
            cues = parse_pasted_transcript(content or "")
        else:
            cues = fetch_youtube_track(source_ref)
    except CaptionParseError as e:
        logger.warning("Subtitle parse failed for session %s: %s", session_id, e)
        _fail_session(session_id, str(e))
        return
    except CaptionsUnavailable as e:
        # Expected in production (see the module docstring) -- warning,
        # not error, so this does not train anyone to ignore the log.
        logger.warning("YouTube caption fetch failed for session %s: %s", session_id, e)
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
        analysis = analyze_local(s["text"])
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
                   filename: str | None, window_start: float, window_end: float) -> None:
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
        try:
            window_start = float(form.get("start", 0))
            window_end = float(form.get("end", 0))
        except (TypeError, ValueError):
            raise HTTPException(status_code=400, detail="start/end must be numbers")
        filename = upload.filename
    else:
        try:
            body = await request.json()
        except Exception:
            raise HTTPException(status_code=400, detail="Expected a JSON body or a multipart upload")
        url = body.get("url")
        if not url:
            raise HTTPException(status_code=400, detail="url is required")
        video_id = parse_video_id(url)
        if video_id is None:
            raise HTTPException(status_code=400, detail="Not a recognized YouTube URL")
        # A pasted transcript takes over completely -- no request leaves
        # this server on that path, which is the entire point (YouTube
        # blocks datacenter IPs, see docs/adr/0003 and plans/025). It is
        # deliberately NOT "try the fetch, fall back to the paste": the
        # fetch's failure is the expected case in production, and paying
        # for it on every request would be latency for nothing.
        #
        # `url` stays required even here: it carries the video id the
        # player embeds, and the IFrame API runs in the learner's browser
        # on their own IP, so playback works where the fetch does not.
        pasted = (body.get("transcript") or "").strip()
        source = "paste" if pasted else "youtube"
        content = pasted or None
        source_ref = video_id
        filename = None
        try:
            window_start = float(body.get("start", 0))
            window_end = float(body.get("end", 0))
        except (TypeError, ValueError):
            raise HTTPException(status_code=400, detail="start/end must be numbers")

    if window_end <= window_start:
        raise HTTPException(status_code=400, detail="end must be after start")

    window_capped = (window_end - window_start) > _MAX_WINDOW_SECONDS
    if window_capped:
        window_end = window_start + _MAX_WINDOW_SECONDS

    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO video_sessions
                    (user_id, source, source_ref, window_start, window_end, window_capped)
                VALUES (%s, %s, %s, %s, %s, %s)
                RETURNING id
                """,
                (user_id, source, source_ref, window_start, window_end, window_capped),
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
                       status, error, sentences, truncated, created_at
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
     status, error, sentences, truncated, created_at) = row
    return {
        "source": source, "source_ref": source_ref,
        "window_start": window_start, "window_end": window_end, "window_capped": window_capped,
        "status": status, "error": error, "sentences": sentences, "truncated": truncated,
        "created_at": created_at,
    }


@router.get("/api/video/session/{session_id}")
def get_video_session(session_id: int, user_id: str = Depends(get_user_id)):
    session = _load_session(session_id, user_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Session not found")

    if session["status"] == "generating":
        age = None
        conn = db_conn()
        try:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT updated_at < NOW() - make_interval(secs => %s) FROM video_session_jobs WHERE session_id = %s",
                    (_STALE_RUNNING_SECONDS, session_id),
                )
                row = cur.fetchone()
                age = row[0] if row else True  # no job row left -> treat as stale/lost
        finally:
            conn.close()
        if age:
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
        "windowStart": session["window_start"],
        "windowEnd": session["window_end"],
        "windowCapped": session["window_capped"],
        "truncated": session["truncated"],
        "sentences": sentences,
    }


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

    return explained
