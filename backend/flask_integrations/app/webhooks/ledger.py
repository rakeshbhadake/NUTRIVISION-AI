"""Durable integration receipts, never a competing application database."""
import json
import sqlite3
import time
from contextlib import contextmanager
from pathlib import Path

from flask import current_app


@contextmanager
def connect():
    path = Path(current_app.config["WEBHOOK_DATABASE_PATH"]).resolve()
    path.parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(str(path), timeout=10)
    connection.execute("PRAGMA journal_mode=WAL")
    connection.execute("""CREATE TABLE IF NOT EXISTS integration_events (
        provider TEXT NOT NULL, event_id TEXT NOT NULL, event_type TEXT NOT NULL,
        payload TEXT NOT NULL, received_at INTEGER NOT NULL,
        PRIMARY KEY (provider, event_id)
    )""")
    try:
        yield connection
        connection.commit()
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()


def record_event(event):
    with connect() as connection:
        try:
            connection.execute(
                "INSERT INTO integration_events VALUES (?, ?, ?, ?, ?)",
                (event["provider"], event["event_id"], event["event_type"], json.dumps(event["data"]), int(time.time())),
            )
            return True
        except sqlite3.IntegrityError:
            return False
