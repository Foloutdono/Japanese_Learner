# ── /api/tts — the spoken form of a card ─────────────────────────
# Study audio's fallback path, for the phones the browser's own
# SpeechSynthesis does not reach. study/word_tts.py carries the whole
# argument for why this endpoint exists at all and what keeps it from
# being the open TTS proxy docs/adr/0006 refused.
#
# No auth dependency, deliberately, and it is the only route here
# without one. The clip is a reading out of a deck this app ships --
# the same public content /kanjivg and /exam-audio already serve
# unauthenticated -- and the <audio> path that plays it (lib/audio's
# buffer cache, and the service worker in front of it) sends no bearer
# token. Nothing per-learner is reachable through it: the text is
# either in the catalog or the answer is 404.
import logging

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import FileResponse

from study.exam_tts import TTSFailed
from study.word_tts import clip_for

router = APIRouter()
logger = logging.getLogger(__name__)

# A year, immutable: the bytes for one reading never change (the same
# text always resolves to the same clip), so a phone that has heard a
# word once should never fetch it again -- the round trip is the whole
# cost of this path over speaking on the device.
_CACHE_FOREVER = "public, max-age=31536000, immutable"


@router.get("/api/tts")
def study_audio(text: str = Query(min_length=1, max_length=64)):
    try:
        path = clip_for(text)
    except ValueError:
        # Not a reading this app teaches. 404 rather than 400: the
        # caller asked for a clip that does not exist, and the client
        # treats it the same either way (silence, see speech.js).
        raise HTTPException(status_code=404, detail="no clip for this text")
    except TTSFailed as e:
        logger.warning("Study audio synthesis failed for %r: %s", text, e)
        raise HTTPException(status_code=503, detail="speech synthesis unavailable")
    return FileResponse(path, media_type="audio/mpeg", headers={"Cache-Control": _CACHE_FOREVER})
