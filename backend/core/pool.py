"""A connection pool that waits for a connection instead of failing.

psycopg2's ThreadedConnectionPool raises PoolError the moment its
maxconn connections are all out. With 40 worker threads and 20
connections that is not an edge case: one learner switching a selector
fast enough to keep twenty requests in flight made every other
learner's next request a 500 until the burst drained. Here getconn()
waits, up to `wait` seconds, for one to come back; only a pool still
dry after that refuses, as a 503 (PoolBusy) rather than a traceback.

core/db.py's pool and srs/storage.py's are both this one.
"""
import threading

from fastapi import HTTPException
from psycopg2.pool import ThreadedConnectionPool

# Long enough to ride out a burst, short enough that a request does
# not hold its worker thread for the proxy's whole timeout.
WAIT_SECONDS = 10.0


class PoolBusy(HTTPException):
    def __init__(self):
        super().__init__(status_code=503, detail="busy", headers={"Retry-After": "2"})


class WaitingPool(ThreadedConnectionPool):
    def __init__(self, minconn, maxconn, *args, wait=WAIT_SECONDS, **kwargs):
        super().__init__(minconn, maxconn, *args, **kwargs)
        self._slots = threading.BoundedSemaphore(maxconn)
        self._wait = wait

    def getconn(self, key=None):
        if not self._slots.acquire(timeout=self._wait):
            raise PoolBusy()
        try:
            return super().getconn(key)
        except BaseException:
            self._slots.release()
            raise

    def putconn(self, conn=None, key=None, close=False):
        try:
            super().putconn(conn, key, close)
        finally:
            self._slots.release()
