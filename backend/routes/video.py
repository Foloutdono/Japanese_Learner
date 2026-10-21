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
import os
import threading

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from core.credits import require_pass
from fastapi.responses import JSONResponse
from starlette.concurrency import run_in_threadpool
from pydantic import BaseModel, Field

from core.db import db_conn
from core.rls import enable_rls
from core.auth import get_user_id
from core.history import HISTORY_LIMIT, trim_history
from core.srs_instance import srs
from study import line_translate, lyrics_sort, morphology
from study.llm_shared import LLMUnavailable
from study.analysis import LOCAL_REV, analyze_local, attach_user_state
from study.captions import (
    parse_track, parse_pasted_transcript, parse_video_id, fetch_youtube_track,
    proxy_configured, CaptionParseError, CaptionFetchError,
)
from study.cue_sentences import sentences_from_cues
from study.line_cut import CUT_REV, TARGET_LINE_WIDTH, cut_line, line_width
from study.word_timing import align_cues
from study.sentences import MAX_SENTENCES
# _analyze_sentence already bundles local + optional-deep + per-user
# SRS state, and buying its deep tier shares phrase_analysis_cache --
# reused wholesale rather than reimplemented, the same pattern
# routes/translation.py uses for routes/reading.py's _chat.
from routes.phrase import TranslationsPayload, _analyze_sentence, deep_context, translated_block

# A pass feature (plan 069): every route here refuses a free learner
# with 402 pass_required once CREDITS_ENFORCE=1; a no-op until then.
router = APIRouter(dependencies=[Depends(require_pass)])
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
# Room in a multipart body for its boundaries and the small form fields
# (start, end, url) beside the file.
_MULTIPART_OVERHEAD_BYTES = 64 * 1024
# Files an upload may carry: the track, the recognised one it is timed
# by, and the video's own translation in each of
# study/line_translate.TRACK_LANGS (plan 242).
_MAX_UPLOAD_FILES = 4

# Same reasoning and same values as routes/exams.py's own constants --
# see that module's comment. Not shared as an import: a generic
# "job retry policy" abstraction across two payloads this different
# would cost more than the duplication (see plan 019's own scope notes).
_FAILED_COOLDOWN_SECONDS = 300
_STALE_RUNNING_SECONDS = 900
# Sessions one learner may have in preparation at once (plan 211). Each
# is a thread analysing up to MAX_SENTENCES lines; the link fetch has a
# daily budget, but a paste or an upload had none, so a learner could
# start as many threads as they could post.
_MAX_PREPARING_PER_USER = 2
# Namespace half of the advisory lock _open_session takes (cf. agenda).
VIDEO_SESSION_LOCK = 931_211

# ── The fetch budget ───────────────────────────────────────────
# The link ingest is the one path here that spends METERED money: a
# rotating residential proxy bills by the gigabyte, and the tier this
# is sized for is 1 GB/month. A fetch pulls the watch page plus the
# cue track -- call it 0.4 MB -- so 60 a day is ~24 MB/day, ~720 MB a
# month, inside that tier with room left. Since plan 221 it pulls the
# recognised track beside a hand-written one, for its word times: a
# dozen kilobytes for twelve minutes of speech, lost in the watch page.
#
# This is not only thrift. Credits stop when they run out; gigabytes
# just keep billing, so a retry storm or a loop is a bill rather than
# an outage. The cap is what makes the cheapest tier the correct one
# to buy, and it is why the ceiling exists in code rather than in the
# provider dashboard, where hitting it would take the feature down
# without explaining itself.
#
# Both are per DAY and counted from the sessions themselves, so there
# is no counter to keep in sync with reality. Overriding them upward
# is a spending decision, which is why they read from the environment
# rather than being constants someone edits in a hurry.
_FETCH_DAILY_CAP = int(os.environ.get("YOUTUBE_FETCH_DAILY_CAP", "60"))
_FETCH_DAILY_CAP_PER_USER = int(os.environ.get("YOUTUBE_FETCH_DAILY_CAP_PER_USER", "10"))



def _refusal(status: int, code: str, message: str) -> HTTPException:
    """A refusal the learner reads, as `detail: {code, message}` (plan
    210). The client words the `code` in the learner's own language
    (lib/api.js's ApiError reads it); the English `message` is for the
    logs, the tests and anyone reading the API by hand, and never
    reaches a screen -- it was English on a French-first app."""
    return HTTPException(status_code=status, detail={"code": code, "message": message})


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
        raise _refusal(400, "bad_window", f"{field} must be a number")


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
            enable_rls(cur, "video_sessions")
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
            # Removed from the shelf -- by the learner's ✕ or past the
            # history's limit -- and erased a day later (core/history.py).
            # NULL is a session on the shelf. Additive and idempotent.
            cur.execute("ALTER TABLE video_sessions ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ")
            # Why a session failed, as a stable snake_case code the
            # client words in the learner's language (plan 215). `error`
            # keeps the English sentence for the logs and for the rows
            # written before this column; NULL is such a row, and the
            # client falls back to its own line for it. Additive.
            cur.execute("ALTER TABLE video_sessions ADD COLUMN IF NOT EXISTS error_code TEXT")
            # Each line's translation (plan 235), as {lang: {line text:
            # translation}}: by the text, so a chorus is translated once
            # and a line cut again keeps what it had. Additive.
            cur.execute(
                "ALTER TABLE video_sessions ADD COLUMN IF NOT EXISTS translations JSONB NOT NULL DEFAULT '{}'::jsonb"
            )
            # Which lines are the song (plan 264, study/lyrics_sort.py),
            # as {"rev": SORT_REV, "kinds": {line text: kind}}: by the
            # text, as the translations are. NULL is a session nobody
            # has made a lyrics deck of. Additive.
            cur.execute("ALTER TABLE video_sessions ADD COLUMN IF NOT EXISTS lyrics_sort JSONB")
            cur.execute("""
                CREATE INDEX IF NOT EXISTS idx_video_sessions_user
                ON video_sessions(user_id, created_at DESC)
            """)
        conn.commit()
        # One table's self-migration per transaction (CLAUDE.md): a
        # failing ALTER above must not roll back the jobs table, nor
        # the jobs table's the sessions'.
        with conn.cursor() as cur:
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
            enable_rls(cur, "video_session_jobs")
        conn.commit()
    finally:
        conn.close()


try:
    _ensure_video_schema()
except Exception:  # pragma: no cover - a missing DB must not stop import
    logger.exception("video schema could not be initialised")


# ── The fetch budget, enforced ─────────────────────────────────
def _fetch_refusal(user_id: str) -> tuple[str, str] | None:
    """None when a link fetch is within budget, else the (code, sentence)
    to refuse with -- the code is what the client words. Refusing is not the same as failing: every caller of
    this points the learner back at the two ingests that are always
    free and always work, so a spent budget costs a convenience rather
    than the feature."""
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT COUNT(*) FILTER (WHERE user_id = %s), COUNT(*)
                  FROM video_sessions
                 WHERE source = 'youtube'
                   AND created_at > NOW() - INTERVAL '1 day'
                """,
                (user_id,),
            )
            mine, everyone = cur.fetchone()
    finally:
        conn.close()

    if mine >= _FETCH_DAILY_CAP_PER_USER:
        return (
            "link_allowance_mine",
            "You have used today's link allowance. Add a subtitle file, "
            "or come back tomorrow.",
        )
    if everyone >= _FETCH_DAILY_CAP:
        return (
            "link_allowance_app",
            "Today's link allowance for the whole app is used up. Add a "
            "subtitle file, or come back tomorrow.",
        )
    return None


# ── The worker ─────────────────────────────────────────────────
def _fail_session(session_id: int, message: str, code: str) -> None:
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "UPDATE video_sessions SET status = 'failed', error = %s, error_code = %s WHERE id = %s",
                (message[:2000], code, session_id),
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
                   filename: str | None, window_start: float | None, window_end: float | None,
                   timing: str | None = None, tracks: dict | None = None) -> None:
    """Runs off-request. Parses/fetches the Track, reconstructs
    Sentences, analyzes each with the LOCAL tier only (never a model --
    see docs/adr/0001), and materializes the result. Owns the job row
    from 'running' through to either deleted (success) or 'failed'."""
    # The video's own translation, {lang: Track} (plan 242): the link
    # fetch fills it beside the Japanese, the grab sends it as files.
    translated = {}
    try:
        # Two of these are purely local -- no request leaves this
        # server while building a Track, so they behave identically on
        # a laptop and on Render. The third does leave, and is the only
        # thing in this file that can be blocked by someone else: it
        # goes out through a paid residential proxy and refuses
        # outright when none is configured. See study/captions.py.
        if source == "youtube":
            cues = fetch_youtube_track(source_ref, translated)
        elif source == "paste":
            cues = parse_pasted_transcript(content or "")
        else:
            cues = parse_track(content, filename or "upload.srt")
    except CaptionFetchError as e:
        # Not a parse failure and not phrased as one: nothing the
        # learner supplied was wrong. The message already names what to
        # do instead, because every one of these is recoverable by
        # adding a file.
        logger.warning("Caption fetch failed for session %s: %s", session_id, e)
        _fail_session(session_id, str(e), e.code)
        return
    except CaptionParseError as e:
        logger.warning("Subtitle parse failed for session %s: %s", session_id, e)
        _fail_session(session_id, str(e), e.code)
        return
    except Exception:  # pragma: no cover - defensive
        # The exception text is deliberately NOT stored: get_video_session
        # hands `error` back to the client, and the two branches above
        # put a sentence there that was written to be read. An arbitrary
        # exception's str() is not that -- it can carry a driver repr or
        # a path. The traceback is logged instead, which is where a
        # diagnosis actually comes from.
        logger.exception("Unexpected error building track for session %s", session_id)
        _fail_session(
            session_id, "Something went wrong reading this transcript. Please try again.",
            "transcript_failed",
        )
        return

    # Everything after the track is read runs under one guard: an
    # exception past this point used to leave the session 'generating'
    # and its job 'running' until the stale cutoff, holding one of the
    # learner's _MAX_PREPARING_PER_USER slots the whole time.
    try:
        _materialize(session_id, cues, translated, timing, tracks, window_start, window_end)
    except Exception:
        logger.exception("Unexpected error preparing session %s", session_id)
        try:
            _fail_session(
                session_id, "Something went wrong reading this transcript. Please try again.",
                "transcript_failed",
            )
        except Exception:
            logger.exception("Could not mark session %s failed", session_id)


def _materialize(session_id: int, cues: list[dict], translated: dict, timing: str | None,
                 tracks: dict | None, window_start: float | None, window_end: float | None) -> None:
    """The session's lines, from its read track: timed, translated where
    a track carries them, analysed by the local tier and stored."""
    # The recognised track beside a hand-written one (the grab sends
    # both; the link fetch reads both itself and returns its lines
    # timed, plan 221): its word times lent to the lines it agrees with.
    # Best effort -- a timing track that will not read costs the words
    # their times, never the session.
    if timing:
        try:
            cues = align_cues(cues, parse_track(timing, "timing.vtt"))
        except Exception:
            logger.warning("Word timing skipped for session %s", session_id, exc_info=True)

    # The grab's translated tracks, each read as the lines are. Best
    # effort, like the timing: a track that will not read or line up
    # leaves its lines to the model, never the session without them.
    for lang, track in (tracks or {}).items():
        try:
            translated[lang] = parse_track(track, f"{lang}.vtt")
        except Exception:
            logger.warning("The %s track of session %s did not read", lang, session_id, exc_info=True)
    try:
        cues = _with_translations(cues, translated)
    except Exception:
        logger.warning("The translations of session %s were skipped", session_id, exc_info=True)

    all_sentences = sentences_from_cues(cues, window_start, window_end)
    truncated = max(0, len(all_sentences) - MAX_SENTENCES)
    kept = all_sentences[:MAX_SENTENCES]
    # Kept as the model's are, by the line's text (study/line_translate),
    # so the block a learner reaches asks only for what the track left.
    translations = {}
    for s in kept:
        for lang, text in (s.get("tr") or {}).items():
            translations.setdefault(lang, {}).setdefault(s["text"], text)

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
        if s.get("word_times"):
            analysis["word_times"] = s["word_times"]
        analysis["local_rev"] = LOCAL_REV
        analysis["cut_rev"] = CUT_REV
        analyzed.append(analysis)

    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                UPDATE video_sessions
                   SET status = 'ready', sentences = %s, truncated = %s, translations = %s
                 WHERE id = %s
             RETURNING user_id
                """,
                (json.dumps(analyzed, ensure_ascii=False), truncated,
                 json.dumps(translations, ensure_ascii=False), session_id),
            )
            row = cur.fetchone()
            cur.execute("DELETE FROM video_session_jobs WHERE session_id = %s", (session_id,))
            # On the shelf now: the oldest past the history's limit leaves it.
            if row:
                trim_history(cur, row[0])
        conn.commit()
        logger.info("Video session %s ready: %d sentences (%d truncated)",
                    session_id, len(analyzed), truncated)
    finally:
        conn.close()


def _with_translations(cues: list[dict], translated: dict) -> list[dict]:
    """`cues`, each the video's own translation of it carries as its
    `tr`, {lang: text} (study/line_translate.from_track); a cue the
    tracks do not line up with carries none."""
    if not translated:
        return cues
    read = {lang: line_translate.from_track(cues, track) for lang, track in translated.items()}
    out = []
    for i, cue in enumerate(cues):
        tr = {lang: lines[i] for lang, lines in read.items() if lines[i]}
        out.append({**cue, "tr": tr} if tr else cue)
    return out


def _start_worker(session_id: int, source: str, source_ref: str, content: str | None,
                   filename: str | None, window_start: float | None, window_end: float | None,
                   timing: str | None = None, tracks: dict | None = None) -> None:
    threading.Thread(
        target=_video_worker,
        args=(session_id, source, source_ref, content, filename, window_start, window_end, timing, tracks),
        name=f"video-session:{session_id}", daemon=True,
    ).start()


# ── What this server can actually do ───────────────────────────
@router.get("/api/video/capabilities")
def video_capabilities(user_id: str = Depends(get_user_id)):
    """Whether the link ingest is available here.

    Exists so the intake screen can hide a button this deployment
    cannot honour. That is not cosmetic: the fetch removed in
    docs/adr/0003 spent a release cycle looking like the primary route
    while never once working in production, and the learner's report
    was "every link i try doesnt work". A UI that asks the server
    first cannot repeat it -- and the answer flips the moment the
    proxy credentials are set, with no deploy.
    """
    return {"linkFetch": proxy_configured()}


# ── Session creation ───────────────────────────────────────────
def _open_session(user_id, source, source_ref, window_start, window_end, window_capped, video_id) -> int:
    """The session's row and its job's, or a 429 while the learner
    already has _MAX_PREPARING_PER_USER sessions in preparation."""
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            # Count and insert under one lock per learner, or two posts at
            # once both pass the count (cf. routes/agenda.py).
            cur.execute(
                "SELECT pg_advisory_xact_lock(%s, hashtext(%s))", (VIDEO_SESSION_LOCK, user_id)
            )
            cur.execute(
                """
                SELECT COUNT(*)
                  FROM video_session_jobs j
                  JOIN video_sessions s ON s.id = j.session_id
                 WHERE s.user_id = %s
                   AND j.status = 'running'
                   AND j.updated_at >= NOW() - make_interval(secs => %s)
                """,
                (user_id, _STALE_RUNNING_SECONDS),
            )
            if cur.fetchone()[0] >= _MAX_PREPARING_PER_USER:
                raise _refusal(
                    429, "session_preparing",
                    "A session is still being prepared. Wait for it, then add the next one.",
                )
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
    return session_id


@router.post("/api/video/session")
async def create_video_session(request: Request, user_id: str = Depends(get_user_id)):
    """Accepts EITHER a JSON body ({url} to fetch, or {transcript, url}
    to paste) or a multipart upload {file, start, end} (a subtitle
    file) -- one route for all three ingests, so this reads the raw
    Request rather than declaring a single Pydantic body (FastAPI
    cannot mix a JSON model and File/Form fields on one route)."""
    content_type = request.headers.get("content-type", "")

    if content_type.startswith("multipart/form-data"):
        # Refused on the declared length before the body is parsed, so an
        # oversized upload is never spooled; the bounded read below covers
        # a body that declares no length or understates it.
        try:
            declared = int(request.headers.get("content-length", ""))
        except ValueError:
            declared = None
        # Four files at most: the track, its timing and the video's own
        # translation in the two languages the app is read in.
        if declared is not None and declared > _MAX_UPLOAD_FILES * _MAX_UPLOAD_BYTES + _MULTIPART_OVERHEAD_BYTES:
            raise _refusal(413, "file_too_large", "Subtitle file is too large")
        form = await request.form()
        upload = form.get("file")
        # A plain text field named `file` is not a file: refused, not a 500.
        if upload is None or not hasattr(upload, "read"):
            raise _refusal(400, "file_required", "file is required for an upload")
        raw = await upload.read(_MAX_UPLOAD_BYTES + 1)
        if len(raw) > _MAX_UPLOAD_BYTES:
            raise _refusal(413, "file_too_large", "Subtitle file is too large")
        try:
            content = raw.decode("utf-8")
        except UnicodeDecodeError:
            # Shift-JIS is the usual culprit: Japanese .srt files made on
            # Windows are often saved in it, and the client says so.
            raise _refusal(400, "not_utf8", "Subtitle file must be UTF-8 text")
        # Optional: the recognised track of the same video, with a time
        # on every word (the grab's srv3, as VTT). Never the lines
        # studied -- only the clock they are read out on.
        timing = None
        timing_upload = form.get("timing")
        if timing_upload is not None and hasattr(timing_upload, "read"):
            raw_timing = await timing_upload.read(_MAX_UPLOAD_BYTES + 1)
            if len(raw_timing) > _MAX_UPLOAD_BYTES:
                raise _refusal(413, "file_too_large", "Subtitle file is too large")
            timing = raw_timing.decode("utf-8", errors="replace")
        # Optional: the video's own translation, the grab's hand-written
        # French or English track as VTT (plan 242). Never the lines
        # studied -- only what is printed under them.
        tracks = {}
        for lang in line_translate.TRACK_LANGS:
            track_upload = form.get(f"translation_{lang}")
            if track_upload is None or not hasattr(track_upload, "read"):
                continue
            raw_track = await track_upload.read(_MAX_UPLOAD_BYTES + 1)
            if len(raw_track) > _MAX_UPLOAD_BYTES:
                raise _refusal(413, "file_too_large", "Subtitle file is too large")
            tracks[lang] = raw_track.decode("utf-8", errors="replace")
        source = "upload"
        source_ref = upload.filename or "upload"
        # Optional, and NEVER fetched from -- it only names a video to
        # embed alongside the transcript. See the JSON branch below.
        video_id = parse_video_id(form.get("url") or "")
        window_start = _optional_seconds(form.get("start"), "start")
        window_end = _optional_seconds(form.get("end"), "end")
        filename = upload.filename
    else:
        # A pasted transcript is held to _MAX_UPLOAD_BYTES characters
        # below; refused on the declared length first (plan 211), so a
        # body far past it is never read whole. Japanese is three bytes
        # a character in UTF-8.
        try:
            declared = int(request.headers.get("content-length", ""))
        except ValueError:
            declared = None
        if declared is not None and declared > 3 * _MAX_UPLOAD_BYTES + _MULTIPART_OVERHEAD_BYTES:
            raise _refusal(413, "transcript_too_long", "Transcript is too long")
        try:
            body = await request.json()
        except Exception:
            raise _refusal(400, "bad_body", "Expected a JSON body or a multipart upload")
        # JSON means one of two things, and which one depends on what
        # is in the body rather than on a mode flag:
        #
        #   transcript present  -> a pasted transcript; `url` merely
        #                          names a video to embed beside it.
        #   url alone           -> FETCH it (restored 2026-09-10).
        #
        # A bare URL was a 400 between 2026-08-26 and 2026-09-10,
        # because no server could get captions at any price. One can
        # now, for a price, and only through a residential proxy -- so
        # unconfigured this is still a 400, and still says so up front
        # rather than opening a session that dies minutes later.
        pasted = (body.get("transcript") or "").strip()
        url = body.get("url") or ""
        video_id = parse_video_id(url)
        if url and video_id is None:
            raise _refusal(400, "not_youtube_url", "Not a recognized YouTube URL")

        if len(pasted) > _MAX_UPLOAD_BYTES:
            raise _refusal(413, "transcript_too_long", "Transcript is too long")
        if pasted:
            source = "paste"
            content = pasted
            source_ref = video_id or "paste"
        elif video_id:
            if not proxy_configured():
                raise _refusal(
                    400, "link_fetch_disabled",
                    "This server cannot fetch subtitles from a link. Use the "
                    "grab bookmarklet, or add a subtitle file.",
                )
            # Budget checked HERE rather than in the worker: a refusal
            # the learner can act on immediately beats a session that
            # spends thirty seconds to tell them the same thing.
            refusal = await run_in_threadpool(_fetch_refusal, user_id)
            if refusal:
                raise _refusal(429, *refusal)
            source = "youtube"
            content = None
            source_ref = video_id
        else:
            raise _refusal(
                400, "link_or_file_required",
                "A YouTube link or a subtitle file is required.",
            )
        filename = None
        timing = None
        tracks = None
        window_start = _optional_seconds(body.get("start"), "start")
        window_end = _optional_seconds(body.get("end"), "end")

    # Only a Window with BOTH bounds can be back-to-front. One bound on
    # its own ("from 2:30 on", "up to 4:00") is a perfectly good Window,
    # and no bounds at all is the default.
    if window_start is not None and window_end is not None and window_end <= window_start:
        raise _refusal(400, "end_before_start", "end must be after start")

    # Kept in the row and the response so old sessions still read back,
    # but nothing sets it any more -- the Window is uncapped.
    window_capped = False

    # The database on the threadpool: this handler is async (it reads the
    # raw request), and a blocking call here held the event loop -- the
    # whole API, on one worker -- for its duration.
    session_id = await run_in_threadpool(
        _open_session, user_id, source, source_ref, window_start, window_end, window_capped, video_id,
    )

    _start_worker(session_id, source, source_ref, content, filename, window_start, window_end, timing, tracks)
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
                       status, error, sentences, truncated, created_at, video_id,
                       error_code, translations
                  FROM video_sessions
                 WHERE id = %s AND user_id = %s AND deleted_at IS NULL
                """,
                (session_id, user_id),
            )
            row = cur.fetchone()
    finally:
        conn.close()
    if row is None:
        return None
    (source, source_ref, window_start, window_end, window_capped,
     status, error, sentences, truncated, created_at, video_id, error_code, translations) = row
    return {
        "source": source, "source_ref": source_ref,
        "window_start": window_start, "window_end": window_end, "window_capped": window_capped,
        "status": status, "error": error, "error_code": error_code,
        "sentences": sentences, "truncated": truncated,
        "created_at": created_at, "video_id": video_id,
        "translations": translations or {},
    }


def _current(session_id: int, sentences: list[dict]) -> list[dict]:
    """The session's lines, each analysed by the local tier as it reads
    today -- a line stored under another LOCAL_REV is analysed again,
    and the session saved with it so that is paid once.

    The local tier is pure and cheap (milliseconds a line), but a
    session keeps what it was built with: before the tokenizer counted
    the spaces between a subtitle's phrases, every particle after the
    first space went unfound, and a session built then went on showing
    those lines without them however the detector improved. Only the
    analysis is remade: the cue times are the session's own and ride
    across, and a line kept as not Japanese stays as it is. Without a
    tokenizer nothing is remade -- "analysis unavailable" is no
    improvement on an older analysis.

    A line wider than study/line_cut.TARGET_LINE_WIDTH, stored before
    the lines were held to today's rule (plan 235, then two rows on a
    phone, 2026-10-20), is cut as a new session's would be, each piece
    analysed and timed on its own, and carries the rule's CUT_REV after,
    cut or not, so a line with nowhere clean to cut is tried once. The
    session's indices move with it, which is why every route that reads
    a line by its index reads it through here."""
    if not morphology.MORPHOLOGY_AVAILABLE:
        return sentences

    def wide(s):
        return (not s.get("foreign") and s.get("cut_rev") != CUT_REV
                and line_width(s.get("text") or "") > TARGET_LINE_WIDTH)

    if all(s.get("local_rev") == LOCAL_REV and not wide(s) for s in sentences):
        return sentences
    fresh = []
    changed = False
    for s in sentences:
        if s.get("foreign"):
            changed |= s.get("local_rev") != LOCAL_REV
            fresh.append({**s, "local_rev": LOCAL_REV})
            continue
        pieces = cut_line(s["text"], s.get("cue_start"), s.get("cue_end"), s.get("word_times")) if wide(s) else None
        if s.get("local_rev") == LOCAL_REV and (pieces is None or len(pieces) == 1):
            # Current, and nowhere to cut it: kept, and marked tried.
            if pieces is not None:
                changed = True
                s = {**s, "cut_rev": CUT_REV}
            fresh.append(s)
            continue
        changed = True
        for piece in pieces or [{"text": s["text"], "start": s.get("cue_start"), "end": s.get("cue_end"),
                                  **({"words": s["word_times"]} if s.get("word_times") else {})}]:
            fresh.append({
                **analyze_local(piece["text"]), "cue_start": piece["start"], "cue_end": piece["end"],
                **({"word_times": piece["words"]} if piece.get("words") else {}),
                "local_rev": LOCAL_REV, "cut_rev": CUT_REV,
            })
    if not changed:
        return sentences
    # Best effort: a failed save costs the next opening the same few
    # milliseconds a line, never the answer.
    try:
        conn = db_conn()
        try:
            with conn.cursor() as cur:
                cur.execute(
                    "UPDATE video_sessions SET sentences = %s WHERE id = %s AND status = 'ready'",
                    (json.dumps(fresh, ensure_ascii=False), session_id),
                )
            conn.commit()
        finally:
            conn.close()
    except Exception:
        logger.exception("Could not store the re-analysed lines of video session %s", session_id)
    return fresh


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
                    content={
                        "status": "failed", "code": "stalled",
                        "error": "Generation stalled -- please try again.",
                    },
                )
            return JSONResponse(status_code=202, content={"status": "generating"})

    if session["status"] == "failed":
        return JSONResponse(
            status_code=503,
            content={
                "status": "failed",
                # What the client words (plan 215); None on a row that
                # failed before the code was stored, which the client
                # answers with its own line. `error` is the English
                # sentence, kept for the logs and for an older client.
                "code": session.get("error_code"),
                "error": session["error"],
                "isYoutube": session["source"] == "youtube",
            },
        )

    states = srs.get_user_states(user_id)
    sentences = [attach_user_state(s, states, user_id) for s in _current(session_id, session["sentences"] or [])]
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
                         limit: int = Query(HISTORY_LIMIT, ge=1, le=100)):
    """運行履歴 for 動画. The one thing missing that kept video out of the
    analyser's history panel entirely -- a session was reachable by id
    and by nothing else, so closing the tab lost it.

    `sentences` is DELIBERATELY not selected. It is a JSONB array that
    can run to hundreds of entries, and a listing that pulled it would
    ship the whole corpus of every session the learner has ever made to
    render twenty rows. The count comes from jsonb_array_length instead,
    computed server-side over the stored value, and the card's line
    (plan 136) from the first element's text the same way: a session
    the grab made is named `<video id>.ja.vtt`, which says nothing, and
    its first sentence says what the video is.

    Only `ready` sessions are listed. A 'generating' one has nothing to
    reopen yet and a 'failed' one has nothing to reopen at all; both are
    transient states the poll already surfaces where they happen. Nor
    is a removed one (`deleted_at`, core/history.py).
    """
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT id, source, source_ref, video_id, truncated, created_at,
                       COALESCE(jsonb_array_length(sentences), 0) AS sentence_count,
                       sentences->0->>'text' AS first_line
                  FROM video_sessions
                 WHERE user_id = %s AND status = 'ready' AND deleted_at IS NULL
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
            "firstLine": first_line,
            "truncated": truncated,
            "createdAt": created_at.isoformat(),
        }
        for row_id, source, source_ref, video_id, truncated, created_at, sentence_count, first_line in rows
    ]


@router.delete("/api/video/session/{session_id}")
def delete_video_session(session_id: int, user_id: str = Depends(get_user_id)):
    """The shelf's ✕ on a video. Marked, not deleted (core/history.py):
    the shelf's Undo brings it back through /restore until it is erased
    a day later. Idempotent, like the passage's DELETE."""
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "UPDATE video_sessions SET deleted_at = NOW() "
                "WHERE id = %s AND user_id = %s AND deleted_at IS NULL",
                (session_id, user_id),
            )
            trim_history(cur, user_id)
        conn.commit()
    finally:
        conn.close()
    return {"ok": True}


@router.post("/api/video/session/{session_id}/restore")
def restore_video_session(session_id: int, user_id: str = Depends(get_user_id)):
    """The shelf's Undo after a video's ✕: back on the shelf where it
    stood, at its own date. Not trimmed here -- an Undo that the limit
    took straight back would be no Undo; the next write trims."""
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "UPDATE video_sessions SET deleted_at = NULL "
                "WHERE id = %s AND user_id = %s AND deleted_at IS NOT NULL RETURNING id",
                (session_id, user_id),
            )
            restored = cur.fetchone()
        conn.commit()
    finally:
        conn.close()
    if restored is None:
        raise HTTPException(status_code=404, detail="Session not found")
    return {"ok": True}


class ExplainPayload(BaseModel):
    lang: str = "en"
    # What the player says the video is (plan 235), where it knows:
    # YouTube's own title and channel, read off the embed. The server
    # never fetches them -- the watch page goes through a metered proxy.
    title: str = Field("", max_length=200)
    channel: str = Field("", max_length=120)


# How many lines either side of a line its explanation is shown.
_CONTEXT_LINES = 2
_SOURCE_NAMES = {
    "youtube": "the Japanese subtitles of a YouTube video",
    "upload": "a video's Japanese subtitle file",
    "paste": "a video's Japanese transcript",
}


def _clock_time(seconds) -> str:
    seconds = max(0, int(seconds or 0))
    return f"{seconds // 3600}:{seconds % 3600 // 60:02d}:{seconds % 60:02d}" if seconds >= 3600 \
        else f"{seconds // 60}:{seconds % 60:02d}"


def _line_context(session: dict, sentences: list[dict], index: int, title: str, channel: str) -> str:
    """Where line `index` stands (routes/phrase.deep_context): what the
    video is, where in it the line is said, and the lines around it --
    the lines the track has, never anything the learner typed."""
    line = sentences[index]
    source = _SOURCE_NAMES.get(session.get("source"), "a video's Japanese subtitles")
    about = [f"From {source}" + (f": \"{title.strip()}\"" if title.strip() else "")
             + (f", by {channel.strip()}" if channel.strip() else "") + "."]
    where = f"Line {index + 1} of {len(sentences)}"
    if line.get("cue_start") is not None:
        where += f", said at {_clock_time(line['cue_start'])}"
    about.append(where + ".")

    def text(s):
        return s.get("text") or ""

    before = [text(s) for s in sentences[max(0, index - _CONTEXT_LINES):index] if text(s)]
    after = [text(s) for s in sentences[index + 1:index + 1 + _CONTEXT_LINES] if text(s)]
    return deep_context(about, before, after)


@router.post("/api/video/session/{session_id}/sentence/{index}/explain")
def explain_video_sentence(session_id: int, index: int, payload: ExplainPayload,
                           user_id: str = Depends(get_user_id)):
    """Buys the deep tier for ONE Sentence -- never the whole session
    (see study/analysis and docs/adr/0001). Shares phrase_analysis_cache
    with /api/phrase/analyze via _analyze_sentence.

    Asked where the line stands (plan 235): the video's title and
    channel the client read off the player, the line's place and time,
    and the two lines either side -- cached with that context, so the
    same words in another video are explained again.

    It used to write the Sentence to phrase_history as well (source
    'video'), and the analyser's shelf, which lists that table, drew
    every line explained as a text card of its own beside the video it
    came from (removed 2026-09-27, owner-directed). The session is the
    shelf's entry; a line the learner wants to keep is kept through
    /api/phrase/keep, with its cue as provenance."""
    session = _load_session(session_id, user_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Session not found")
    if session["status"] != "ready":
        raise HTTPException(status_code=409, detail="Session is not ready yet")

    # Through _current, as GET read them: the indices the client holds.
    sentences = _current(session_id, session["sentences"] or [])
    if index < 0 or index >= len(sentences):
        raise HTTPException(status_code=404, detail="No such sentence in this session")

    text = sentences[index]["text"]
    states = srs.get_user_states(user_id)
    context = _line_context(session, sentences, index, payload.title, payload.channel)
    explained = _analyze_sentence(text, deep=True, lang=payload.lang, states=states, user_id=user_id,
                                  context=context)

    # A Cue is a Sentence, and a Sentence's cue times are part of it.
    # _analyze_sentence builds from TEXT alone -- analyze_local is pure
    # by design and knows nothing about cues -- so returning it bare
    # dropped cue_start/cue_end and `foreign`. The frontend swaps the
    # returned object in wholesale, so buying the deep tier for subtitle
    # line 12 deleted that line's timestamp AND its playback window:
    # `seconds >= None` never matches again, so the video could never
    # highlight it a second time.
    merged = {**sentences[index], **explained}
    for key in ("cue_start", "cue_end", "word_times", "foreign"):
        if key in sentences[index]:
            merged[key] = sentences[index][key]

    return merged


# ── 訳 — a translation under every line (plan 235) ──────────────
# Asked a block at a time as the learner reaches it (study/line_translate
# .py has why not one line, and why not the deep tier), kept on the
# session by the line's text, and rationed there: a block the session
# already holds costs nothing, a block it lacks claims one of the
# learner's LINE_TRANSLATION_DAILY_LIMIT calls a day first. The answer
# is routes/phrase.py's translated_block, which a typed Passage's lines
# go through too.
@router.post("/api/video/session/{session_id}/translations")
def translate_video_lines(session_id: int, payload: TranslationsPayload,
                          user_id: str = Depends(get_user_id)):
    """The translations of the block of lines `index` falls in, in the
    learner's language: {"start", "lines"}, `lines` one entry per line
    of the block from `start`, None for a line not Japanese or one the
    model left out. Lines the session already holds are not asked for
    again; a line repeated in the block is asked once."""
    session = _load_session(session_id, user_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Session not found")
    if session["status"] != "ready":
        raise HTTPException(status_code=409, detail="Session is not ready yet")
    sentences = _current(session_id, session["sentences"] or [])
    return translated_block(user_id, "video_sessions", session_id, sentences,
                            session["translations"], payload, "video")


# ── 歌 — which lines are the song (plan 264) ─────────────────────
# The lyrics import's second step (components/decks/LyricsImportSheet.jsx):
# the session's lines sorted into the song and the rest -- a spoken
# intro, the credits, a sound cue -- by study/lyrics_sort.py, which the
# learner then corrects before the deck is made. Kept on the session by
# the line's text under SORT_REV, so asking again costs nothing.
#
# Never a refusal the learner cannot go on from: a spent ration or a
# model that will not answer still returns every line, sorted by the
# patterns alone, with `sorted` false and the `reason` the sheet words.
# Such a sort is not kept, so the next look asks the model again.
def _stored_kinds(raw) -> dict:
    if isinstance(raw, dict) and raw.get("rev") == lyrics_sort.SORT_REV and isinstance(raw.get("kinds"), dict):
        return raw["kinds"]
    return {}


@router.post("/api/video/session/{session_id}/lyrics")
def sort_video_lyrics(session_id: int, user_id: str = Depends(get_user_id)):
    """{"sorted", "reason", "kinds"}: one of lyrics_sort.KINDS per line
    of the session, in order (the indices GET /api/video/session/{id}
    reads its sentences by); `sorted` says whether the model sorted
    them, and `reason` ("over_limit" | "ai_unavailable") why not."""
    session = _load_session(session_id, user_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Session not found")
    if session["status"] != "ready":
        raise HTTPException(status_code=409, detail="Session is not ready yet")
    sentences = _current(session_id, session["sentences"] or [])
    known = _stored_kinds(_load_lyrics_sort(session_id))
    # The file's name says which song it is more often than not
    # ("YOASOBI - 夜に駆ける.srt"); a link's video id says nothing.
    about = session["source_ref"] if session["source"] == "upload" else ""
    try:
        kinds, fresh = lyrics_sort.sort_lines(user_id, sentences, known, about)
    except lyrics_sort.OverLimit:
        return {"sorted": False, "reason": "over_limit",
                "kinds": lyrics_sort.sort_by_patterns(sentences, known)}
    except LLMUnavailable:
        logger.warning("Lyrics sort unavailable for session %s", session_id)
        return {"sorted": False, "reason": "ai_unavailable",
                "kinds": lyrics_sort.sort_by_patterns(sentences, known)}
    if fresh:
        # Best effort: a failed save costs the next look a call, never
        # this answer.
        try:
            conn = db_conn()
            try:
                with conn.cursor() as cur:
                    cur.execute(
                        "UPDATE video_sessions SET lyrics_sort = %s WHERE id = %s AND user_id = %s",
                        (json.dumps({"rev": lyrics_sort.SORT_REV, "kinds": {**known, **fresh}},
                                    ensure_ascii=False), session_id, user_id),
                    )
                conn.commit()
            finally:
                conn.close()
        except Exception:
            logger.exception("Could not store the lyrics sort of video session %s", session_id)
    return {"sorted": True, "reason": None, "kinds": kinds}


def _load_lyrics_sort(session_id: int):
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT lyrics_sort FROM video_sessions WHERE id = %s", (session_id,))
            row = cur.fetchone()
    finally:
        conn.close()
    return row[0] if row else None
