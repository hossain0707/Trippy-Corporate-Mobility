"""Private PostgreSQL connection pool; transactions are committed only after success."""
from contextlib import contextmanager
from psycopg.rows import dict_row
from psycopg_pool import ConnectionPool
from .config import settings

_pool = None

def open_pool():
    global _pool
    config = settings()
    _pool = ConnectionPool(conninfo=config.database_url, min_size=1, max_size=config.database_pool_max_size,
                           kwargs={'row_factory': dict_row}, timeout=8, open=True)
    _pool.wait(timeout=20)

def close_pool():
    global _pool
    if _pool is not None:
        _pool.close()
    _pool = None

@contextmanager
def connection():
    if _pool is None:
        raise RuntimeError('PostgreSQL pool not initialized')
    with _pool.connection() as conn:
        yield conn

def rows(conn, sql: str, args=()):
    with conn.cursor() as cur:
        cur.execute(sql,args)
        return cur.fetchall()

def one(conn, sql: str, args=()):
    with conn.cursor() as cur:
        cur.execute(sql,args)
        return cur.fetchone()

def execute(conn, sql: str, args=()):
    with conn.cursor() as cur:
        cur.execute(sql,args)
        return cur.rowcount
