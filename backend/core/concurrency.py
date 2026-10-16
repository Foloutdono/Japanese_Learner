"""One learner's share of the server: a few requests at a time.

The API is one uvicorn worker: sync handlers on a threadpool of 40, and
20 database connections per pool. Nothing stopped one learner from
holding all of them -- a selector switched fast enough (the frequency
plate's sizes, 2-4 requests a click, none cancelled) kept dozens of
requests in flight, and every other learner waited behind them, or got
a 500 when the pool ran dry.

This gate lets each caller run LIMIT requests at once. The rest wait
here, on the event loop, holding no thread and no connection, and run
in turn; a caller with QUEUE requests already waiting, or one that has
waited WAIT seconds, is answered 429 at once. A learner's ordinary
burst (a screen's first paint asks for several things together) waits
a few milliseconds and never sees it.

The caller is the token's `sub`, read without verifying it: the gate
only shares out capacity, it grants nothing, and the token is still
verified by core/auth.get_user_id behind it. Keying on the subject
rather than the token keeps one learner one caller across a token
refresh. A request with no token is keyed on its address.
"""
import asyncio
import base64
import json

LIMIT = 6
QUEUE = 24
WAIT = 15.0


def _subject(token: str) -> str | None:
    try:
        payload = token.split(".")[1]
        payload += "=" * (-len(payload) % 4)
        sub = json.loads(base64.urlsafe_b64decode(payload)).get("sub")
    except (IndexError, ValueError, AttributeError):
        return None
    return sub if isinstance(sub, str) and sub else None


def caller_key(scope) -> str:
    for name, value in scope.get("headers") or ():
        if name == b"authorization":
            scheme, _, token = value.decode("latin-1").partition(" ")
            if scheme.lower() == "bearer" and token:
                sub = _subject(token.strip())
                if sub:
                    return f"sub:{sub}"
            break
    for name, value in scope.get("headers") or ():
        if name == b"x-forwarded-for":
            return "ip:" + value.decode("latin-1").split(",")[0].strip()
    client = scope.get("client")
    return f"ip:{client[0]}" if client else "ip:?"


class _Gate:
    __slots__ = ("sem", "waiting", "holders")

    def __init__(self, limit: int):
        self.sem = asyncio.Semaphore(limit)
        self.waiting = 0
        self.holders = 0


class PerCallerConcurrency:
    """ASGI middleware over the /api/ paths; everything else passes."""

    def __init__(self, app, limit: int = LIMIT, queue: int = QUEUE, wait: float = WAIT, prefix: str = "/api/"):
        self.app = app
        self.limit = limit
        self.queue = queue
        self.wait = wait
        self.prefix = prefix
        self._gates: dict[str, _Gate] = {}

    async def __call__(self, scope, receive, send):
        if (scope["type"] != "http" or scope.get("method") == "OPTIONS"
                or not scope.get("path", "").startswith(self.prefix)):
            await self.app(scope, receive, send)
            return

        key = caller_key(scope)
        gate = self._gates.get(key)
        if gate is None:
            gate = self._gates[key] = _Gate(self.limit)

        if gate.waiting >= self.queue:
            self._forget_if_idle(key, gate)
            await _too_many(send)
            return
        gate.waiting += 1
        try:
            await asyncio.wait_for(gate.sem.acquire(), self.wait)
        except TimeoutError:
            gate.waiting -= 1
            self._forget_if_idle(key, gate)
            await _too_many(send)
            return
        except BaseException:
            gate.waiting -= 1
            self._forget_if_idle(key, gate)
            raise
        gate.waiting -= 1
        gate.holders += 1
        try:
            await self.app(scope, receive, send)
        finally:
            gate.holders -= 1
            gate.sem.release()
            self._forget_if_idle(key, gate)

    def _forget_if_idle(self, key: str, gate: _Gate) -> None:
        # A gate lives while its caller has a request here, so the map
        # holds the callers of the moment, never everyone ever seen.
        if gate.waiting == 0 and gate.holders == 0 and self._gates.get(key) is gate:
            del self._gates[key]


async def _too_many(send) -> None:
    body = b'{"detail":"too_many_requests"}'
    await send({
        "type": "http.response.start",
        "status": 429,
        "headers": [
            (b"content-type", b"application/json"),
            (b"content-length", str(len(body)).encode()),
            (b"retry-after", b"1"),
        ],
    })
    await send({"type": "http.response.body", "body": body})
