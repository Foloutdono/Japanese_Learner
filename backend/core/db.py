import os
import psycopg2
import psycopg2.extras

from core.pool import WaitingPool

DATABASE_URL = os.environ.get("DATABASE_URL")

# Route handlers are synchronous `def`s, which FastAPI dispatches onto its
# worker threadpool -- ThreadedConnectionPool (not SimpleConnectionPool,
# see srs/storage.py's own history) is what tolerates concurrent
# getconn()/putconn() calls from multiple threads safely.
#
# minconn=1 opens one real connection immediately at import time, same as
# before (db_conn() always paid a fresh connection cost on first use
# anyway). maxconn=20 matches srs/storage.py's own pool size. A WaitingPool
# (core/pool.py): when all twenty are out, the next caller waits for one
# rather than failing.
_pool = WaitingPool(1, 20, DATABASE_URL)


class _PooledConnection:
    """Wraps a pooled psycopg2 connection so every existing db_conn() call
    site's `conn.close()` returns it to the pool instead of tearing down
    the TCP connection -- this is what lets 70 call sites across routes/
    and srs/srs.py keep calling db_conn() and conn.close() exactly as
    before, with zero changes to any of them. Every other attribute
    (cursor(), commit(), rollback(), autocommit, ...) passes straight
    through to the real connection via __getattr__.
    """

    def __init__(self, pool, conn):
        # object.__setattr__ bypasses our own override below -- these two
        # must land on the wrapper itself, and _conn doesn't exist yet on
        # the first assignment (our __setattr__ would try to proxy to it
        # and blow up).
        object.__setattr__(self, "_pool", pool)
        object.__setattr__(self, "_conn", conn)

    def close(self):
        # Once: a second putconn would hand the pool back a slot it
        # never lent (core/pool.py counts them).
        if self.__dict__.get("_closed"):
            return
        object.__setattr__(self, "_closed", True)
        self._pool.putconn(self._conn)

    def __getattr__(self, name):
        return getattr(self._conn, name)

    def __setattr__(self, name, value):
        setattr(self._conn, name, value)


def db_conn():
    conn = _pool.getconn()
    conn.autocommit = False
    return _PooledConnection(_pool, conn)
