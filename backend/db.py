import os
import psycopg2
import psycopg2.extras

DATABASE_URL = os.environ.get("DATABASE_URL")

def db_conn():
    conn = psycopg2.connect(DATABASE_URL)
    conn.autocommit = False
    return conn