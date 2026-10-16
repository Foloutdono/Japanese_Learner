"""One learner's share of the server (core/concurrency.py) and the pool
that waits for a connection (core/pool.py)."""
import asyncio
import base64
import json
import threading
import time
import unittest

from core.concurrency import PerCallerConcurrency, caller_key
from core.pool import PoolBusy, WaitingPool


def _token(sub: str) -> str:
    body = base64.urlsafe_b64encode(json.dumps({"sub": sub}).encode()).rstrip(b"=").decode()
    return f"x.{body}.sig"


def _scope(path="/api/frequency/vocab/tiers", sub="learner-a", ip="1.2.3.4"):
    headers = [(b"x-forwarded-for", ip.encode())]
    if sub:
        headers.append((b"authorization", f"Bearer {_token(sub)}".encode()))
    return {"type": "http", "method": "GET", "path": path, "headers": headers, "client": ("10.0.0.1", 1)}


class _SlowApp:
    """Counts how many requests run at once, each holding for `hold`."""

    def __init__(self, hold=0.05):
        self.hold = hold
        self.now = 0
        self.peak = 0

    async def __call__(self, scope, receive, send):
        self.now += 1
        self.peak = max(self.peak, self.now)
        await asyncio.sleep(self.hold)
        self.now -= 1
        await send({"type": "http.response.start", "status": 200, "headers": []})
        await send({"type": "http.response.body", "body": b"{}"})


async def _call(gate, scope):
    status = []

    async def send(msg):
        if msg["type"] == "http.response.start":
            status.append(msg["status"])

    async def receive():
        return {"type": "http.request", "body": b""}

    await gate(scope, receive, send)
    return status[0]


class GateTests(unittest.TestCase):
    def test_one_learner_runs_no_more_than_the_limit_at_once(self):
        app = _SlowApp()
        gate = PerCallerConcurrency(app, limit=3, queue=50, wait=5)

        async def burst():
            return await asyncio.gather(*(_call(gate, _scope()) for _ in range(20)))

        statuses = asyncio.run(burst())
        self.assertEqual(statuses, [200] * 20)  # waited, never refused
        self.assertEqual(app.peak, 3)
        self.assertEqual(gate._gates, {})  # forgotten once idle

    def test_a_learner_past_the_queue_is_answered_429(self):
        app = _SlowApp(hold=0.2)
        gate = PerCallerConcurrency(app, limit=2, queue=3, wait=5)

        async def burst():
            return await asyncio.gather(*(_call(gate, _scope()) for _ in range(10)))

        statuses = asyncio.run(burst())
        self.assertEqual(statuses.count(200), 5)
        self.assertEqual(statuses.count(429), 5)

    def test_one_learners_burst_does_not_hold_up_another(self):
        app = _SlowApp(hold=0.05)
        gate = PerCallerConcurrency(app, limit=2, queue=100, wait=5)

        async def run():
            flood = [asyncio.create_task(_call(gate, _scope(sub="flooder"))) for _ in range(40)]
            await asyncio.sleep(0.01)
            start = time.monotonic()
            status = await _call(gate, _scope(sub="other"))
            took = time.monotonic() - start
            await asyncio.gather(*flood)
            return status, took

        status, took = asyncio.run(run())
        self.assertEqual(status, 200)
        self.assertLess(took, 0.5)  # the flood takes ~1s in turn

    def test_a_long_wait_is_answered_429(self):
        app = _SlowApp(hold=0.5)
        gate = PerCallerConcurrency(app, limit=1, queue=10, wait=0.05)

        async def burst():
            return await asyncio.gather(*(_call(gate, _scope()) for _ in range(3)))

        self.assertEqual(sorted(asyncio.run(burst())), [200, 429, 429])

    def test_only_the_api_is_gated(self):
        app = _SlowApp()
        gate = PerCallerConcurrency(app, limit=1, queue=0, wait=0.01)

        async def burst():
            return await asyncio.gather(*(_call(gate, _scope(path="/kanjivg/0abcd.svg")) for _ in range(5)))

        self.assertEqual(asyncio.run(burst()), [200] * 5)

    def test_the_caller_is_the_tokens_subject_else_the_address(self):
        self.assertEqual(caller_key(_scope(sub="abc")), "sub:abc")
        self.assertEqual(caller_key(_scope(sub=None, ip="9.9.9.9, 10.0.0.2")), "ip:9.9.9.9")
        junk = _scope(sub=None)
        junk["headers"].append((b"authorization", b"Bearer not-a-jwt"))
        self.assertEqual(caller_key(junk), "ip:1.2.3.4")


class _FakeConn:
    closed = 0

    def close(self):
        self.closed = 1


class _NoDbPool(WaitingPool):
    """WaitingPool's counting over fake connections."""

    def _connect(self, key=None):
        conn = _FakeConn()
        if key is not None:
            self._used[key] = conn
            self._rused[id(conn)] = key
        else:
            self._pool.append(conn)
        return conn


class WaitingPoolTests(unittest.TestCase):
    def test_a_dry_pool_waits_for_a_connection_back(self):
        pool = _NoDbPool(0, 2, wait=2)
        a, b = pool.getconn(), pool.getconn()
        threading.Timer(0.1, lambda: pool.putconn(a)).start()
        c = pool.getconn()  # ThreadedConnectionPool raised PoolError here
        self.assertIsNotNone(c)
        pool.putconn(b)
        pool.putconn(c)

    def test_a_pool_dry_past_the_wait_is_a_503(self):
        pool = _NoDbPool(0, 1, wait=0.05)
        a = pool.getconn()
        with self.assertRaises(PoolBusy) as caught:
            pool.getconn()
        self.assertEqual(caught.exception.status_code, 503)
        pool.putconn(a)
        pool.putconn(pool.getconn())


if __name__ == "__main__":
    unittest.main()
