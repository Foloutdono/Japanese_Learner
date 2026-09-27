# ── 帳の上限 — how much of the analyser's history is kept ─────────
# The analyser's shelf (frontend PassageShelf) is one list over two
# tables: the passages typed or photographed (phrase_history) and the
# video sessions (video_sessions). Neither had a bound but the weekly
# prune (scripts/prune_logs.py, 200 and 100 a learner), so the shelf grew
# into a wall of cards, and a session is the heaviest row in the schema
# (a whole transcript, up to study/sentences.MAX_SENTENCES lines).
# Owner-directed (2026-09-27): a limit.
#
# The newest HISTORY_LIMIT entries of the two together stand; each write
# to either trims what falls past them. A KEPT sentence (保存, the
# learner's own pin) is not history and is never counted or touched.
#
# A session past the limit, or one the learner removes, is marked
# (`deleted_at`) rather than deleted, and erased a day later: the mark
# is what lets the shelf's Undo bring it back, and the day is the link
# fetch's budget window (routes/video.py's _fetch_refusal counts the
# sessions a learner fetched today), which a deletion must not refund.
# A passage is deleted outright -- its Undo analyses its text again.

HISTORY_LIMIT = 30


def trim_history(cur, user_id: str, keep: int | None = None) -> None:
    """Trims one learner's shelf to its newest `keep` entries (the
    limit by default), on the caller's cursor and in its transaction,
    and erases the sessions marked more than a day ago."""
    keep = HISTORY_LIMIT if keep is None else keep
    cur.execute(
        """
        WITH shelf AS (
            SELECT 'passage' AS kind, id, created_at
              FROM phrase_history
             WHERE user_id = %(user)s AND NOT kept
            UNION ALL
            SELECT 'session', id, created_at
              FROM video_sessions
             WHERE user_id = %(user)s AND status = 'ready' AND deleted_at IS NULL
        ), past AS (
            SELECT kind, id FROM shelf
             ORDER BY created_at DESC, id DESC
            OFFSET %(keep)s
        ), dropped AS (
            DELETE FROM phrase_history
             WHERE user_id = %(user)s
               AND id IN (SELECT id FROM past WHERE kind = 'passage')
        )
        UPDATE video_sessions SET deleted_at = NOW()
         WHERE user_id = %(user)s
           AND id IN (SELECT id FROM past WHERE kind = 'session')
        """,
        {"user": user_id, "keep": keep},
    )
    cur.execute(
        "DELETE FROM video_sessions WHERE user_id = %s AND deleted_at < NOW() - INTERVAL '1 day'",
        (user_id,),
    )
