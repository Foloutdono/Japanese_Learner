"""工事 -- the release a learner is warned of (plan 265).

The daily release (.github/workflows/promote.yml) restarts this one
process, and a learner using the app meanwhile meets requests that hang
or fail and, on a fresh load, the boot gate -- with nothing saying why.
So the workflow announces the release before it pushes: it posts the
minute the push will happen (routes/release.py), this process holds it,
and every /api answer carries it in `X-Release-At` (epoch seconds),
which the client's request path reads (frontend/src/stores/releaseNotice.js)
and the docked note says.

The notice lives in memory and nowhere else, on purpose: the API runs
one worker, and the restart the notice warns of is what clears it --
the new build boots with none. A release that never comes (the push
failed and the workflow's clear did not land) stops being announced
GRACE seconds after its minute.
"""
import time

GRACE = 30 * 60      # a deploy's build and restart fit well inside it

_at: float | None = None


def announce(at: float) -> None:
    global _at
    _at = float(at)


def clear() -> None:
    global _at
    _at = None


def current(now: float | None = None) -> int | None:
    """The announced release's epoch second, or None when none is due."""
    if _at is None:
        return None
    if (time.time() if now is None else now) > _at + GRACE:
        return None
    return int(_at)


class ReleaseNoticeHeader:
    """ASGI middleware: stamps `X-Release-At` on /api/ answers while one is due."""

    def __init__(self, app, prefix: str = "/api/"):
        self.app = app
        self.prefix = prefix

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http" or not scope.get("path", "").startswith(self.prefix):
            await self.app(scope, receive, send)
            return
        at = current()
        if at is None:
            await self.app(scope, receive, send)
            return

        async def stamped(message):
            if message["type"] == "http.response.start":
                message = {**message, "headers": [*message.get("headers", ()),
                                                  (b"x-release-at", str(at).encode())]}
            await send(message)

        await self.app(scope, receive, stamped)
