from psycopg2.pool import SimpleConnectionPool
from psycopg2.extras import RealDictCursor
from contextlib import contextmanager


class Storage:

    def __init__(self, database_url: str):

        self.pool = SimpleConnectionPool(
            1,
            20,
            database_url
        )

    @contextmanager
    def connection(self):

        conn = self.pool.getconn()

        try:
            yield conn
            conn.commit()

        except Exception:
            conn.rollback()
            raise

        finally:
            self.pool.putconn(conn)

    @contextmanager
    def cursor(self):
        with self.connection() as conn:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                yield cur

    def close(self):
        self.pool.closeall()