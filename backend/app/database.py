from __future__ import annotations

import sqlite3
import json
from pathlib import Path
from typing import Any


CASE_COLUMNS = (
    "created_at",
    "raw_complaint",
    "summary",
    "request",
    "event_time",
    "category",
    "suggested_department",
    "confirmed_department",
    "urgency",
    "key_facts",
    "missing_information",
    "status",
    "deadline",
    "withdrawal_reason",
    "withdrawn_at",
)


class Database:
    def __init__(self, path: str | Path) -> None:
        self.path = str(path)

    def connect(self) -> sqlite3.Connection:
        connection = sqlite3.connect(self.path)
        connection.row_factory = sqlite3.Row
        connection.execute("PRAGMA foreign_keys = ON")
        return connection

    def initialize(self) -> None:
        with self.connect() as connection:
            connection.executescript(
                """
                CREATE TABLE IF NOT EXISTS cases (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    created_at TEXT NOT NULL,
                    raw_complaint TEXT NOT NULL,
                    summary TEXT NOT NULL,
                    request TEXT NOT NULL,
                    event_time TEXT,
                    category TEXT NOT NULL,
                    suggested_department TEXT NOT NULL,
                    confirmed_department TEXT NOT NULL,
                    urgency TEXT NOT NULL,
                    key_facts TEXT NOT NULL DEFAULT '[]',
                    missing_information TEXT NOT NULL DEFAULT '[]',
                    status TEXT NOT NULL,
                    deadline TEXT NOT NULL,
                    withdrawal_reason TEXT,
                    withdrawn_at TEXT
                );

                CREATE TABLE IF NOT EXISTS timeline_events (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    case_id INTEGER NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
                    type TEXT NOT NULL,
                    content TEXT NOT NULL,
                    created_at TEXT NOT NULL
                );

                CREATE TABLE IF NOT EXISTS department_replies (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    case_id INTEGER NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
                    content TEXT NOT NULL,
                    created_at TEXT NOT NULL
                );

                CREATE TABLE IF NOT EXISTS generated_replies (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    case_id INTEGER NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
                    draft TEXT NOT NULL,
                    confirmed INTEGER NOT NULL DEFAULT 0,
                    created_at TEXT NOT NULL
                );
                """
            )

    def create_case(self, data: dict[str, Any]) -> dict[str, Any]:
        values = {column: data.get(column) for column in CASE_COLUMNS}
        values["key_facts"] = json.dumps(data.get("key_facts", []), ensure_ascii=False)
        values["missing_information"] = json.dumps(
            data.get("missing_information", []), ensure_ascii=False
        )
        values["withdrawal_reason"] = values.get("withdrawal_reason")
        values["withdrawn_at"] = values.get("withdrawn_at")
        placeholders = ", ".join("?" for _ in CASE_COLUMNS)
        columns = ", ".join(CASE_COLUMNS)
        with self.connect() as connection:
            cursor = connection.execute(
                f"INSERT INTO cases ({columns}) VALUES ({placeholders})",
                tuple(values[column] for column in CASE_COLUMNS),
            )
            case_id = int(cursor.lastrowid)
        result = self.get_case(case_id)
        if result is None:
            raise RuntimeError("Created case could not be restored")
        return result

    def get_case(self, case_id: int) -> dict[str, Any] | None:
        with self.connect() as connection:
            row = connection.execute(
                "SELECT * FROM cases WHERE id = ?", (case_id,)
            ).fetchone()
            if row is None:
                return None
            case = dict(row)
            case["key_facts"] = json.loads(case["key_facts"])
            case["missing_information"] = json.loads(case["missing_information"])
            case["timeline"] = [
                dict(item)
                for item in connection.execute(
                    "SELECT * FROM timeline_events WHERE case_id = ? ORDER BY created_at, id",
                    (case_id,),
                ).fetchall()
            ]
            case["department_replies"] = [
                dict(item)
                for item in connection.execute(
                    "SELECT * FROM department_replies WHERE case_id = ? ORDER BY created_at, id",
                    (case_id,),
                ).fetchall()
            ]
            case["generated_replies"] = [
                {**dict(item), "confirmed": bool(item["confirmed"])}
                for item in connection.execute(
                    "SELECT * FROM generated_replies WHERE case_id = ? ORDER BY created_at, id",
                    (case_id,),
                ).fetchall()
            ]
            return case

    def list_cases(self) -> list[dict[str, Any]]:
        with self.connect() as connection:
            ids = [
                int(row["id"])
                for row in connection.execute(
                    "SELECT id FROM cases ORDER BY created_at DESC, id DESC"
                ).fetchall()
            ]
        return [case for case_id in ids if (case := self.get_case(case_id)) is not None]

    def update_case(self, case_id: int, fields: dict[str, Any]) -> dict[str, Any] | None:
        allowed = {"status", "withdrawal_reason", "withdrawn_at"}
        updates = {key: value for key, value in fields.items() if key in allowed}
        if not updates:
            return self.get_case(case_id)
        assignments = ", ".join(f"{key} = ?" for key in updates)
        with self.connect() as connection:
            connection.execute(
                f"UPDATE cases SET {assignments} WHERE id = ?",
                (*updates.values(), case_id),
            )
        return self.get_case(case_id)

    def add_department_reply(
        self, case_id: int, content: str, created_at: str
    ) -> dict[str, Any]:
        with self.connect() as connection:
            cursor = connection.execute(
                """
                INSERT INTO department_replies (case_id, content, created_at)
                VALUES (?, ?, ?)
                """,
                (case_id, content, created_at),
            )
            row = connection.execute(
                "SELECT * FROM department_replies WHERE id = ?",
                (int(cursor.lastrowid),),
            ).fetchone()
        if row is None:
            raise RuntimeError("Created department reply could not be restored")
        return dict(row)

    def add_generated_reply(
        self, case_id: int, draft: str, created_at: str
    ) -> dict[str, Any]:
        with self.connect() as connection:
            cursor = connection.execute(
                """
                INSERT INTO generated_replies (case_id, draft, confirmed, created_at)
                VALUES (?, ?, 0, ?)
                """,
                (case_id, draft, created_at),
            )
            row = connection.execute(
                "SELECT * FROM generated_replies WHERE id = ?",
                (int(cursor.lastrowid),),
            ).fetchone()
        if row is None:
            raise RuntimeError("Created generated reply could not be restored")
        return {**dict(row), "confirmed": bool(row["confirmed"])}

    def confirm_generated_reply(
        self, case_id: int, reply_id: int
    ) -> dict[str, Any] | None:
        with self.connect() as connection:
            cursor = connection.execute(
                """
                UPDATE generated_replies SET confirmed = 1
                WHERE id = ? AND case_id = ?
                """,
                (reply_id, case_id),
            )
            if cursor.rowcount == 0:
                return None
            row = connection.execute(
                "SELECT * FROM generated_replies WHERE id = ?", (reply_id,)
            ).fetchone()
        if row is None:
            return None
        return {**dict(row), "confirmed": bool(row["confirmed"])}

    def add_timeline_event(
        self,
        case_id: int,
        event_type: str,
        content: str,
        created_at: str,
    ) -> dict[str, Any]:
        with self.connect() as connection:
            cursor = connection.execute(
                """
                INSERT INTO timeline_events (case_id, type, content, created_at)
                VALUES (?, ?, ?, ?)
                """,
                (case_id, event_type, content, created_at),
            )
            event_id = int(cursor.lastrowid)
            row = connection.execute(
                "SELECT * FROM timeline_events WHERE id = ?", (event_id,)
            ).fetchone()
        if row is None:
            raise RuntimeError("Created timeline event could not be restored")
        return dict(row)
