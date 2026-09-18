from __future__ import annotations

from datetime import datetime, timedelta, timezone

from backend.app.database import Database
from backend.app.domain import get_case_status


def sample_case(now: datetime) -> dict[str, object]:
    return {
        "raw_complaint": "【虚构演示】市民反映教学门诊等候时间较长，希望核实流程。",
        "summary": "教学门诊等候时间问题",
        "request": "核实等候流程并给予说明",
        "event_time": "2026-09-17 09:00",
        "category": "服务流程",
        "suggested_department": "门诊部",
        "confirmed_department": "门诊部",
        "urgency": "medium",
        "status": "pending",
        "deadline": (now + timedelta(days=2)).isoformat(),
        "created_at": now.isoformat(),
    }


def test_open_case_becomes_overdue_after_deadline() -> None:
    now = datetime(2026, 9, 18, 12, 0, tzinfo=timezone.utc)

    result = get_case_status(
        status="pending",
        deadline=(now - timedelta(seconds=1)).isoformat(),
        now=now,
    )

    assert result == "overdue"


def test_terminal_cases_never_become_overdue() -> None:
    now = datetime(2026, 9, 18, 12, 0, tzinfo=timezone.utc)
    past_deadline = (now - timedelta(days=5)).isoformat()

    assert get_case_status("withdrawn", past_deadline, now) == "withdrawn"
    assert get_case_status("closed", past_deadline, now) == "closed"


def test_case_persists_across_database_instances(tmp_path) -> None:
    now = datetime(2026, 9, 18, 12, 0, tzinfo=timezone.utc)
    path = tmp_path / "sujie.db"
    first = Database(path)
    first.initialize()

    created = first.create_case(sample_case(now))

    second = Database(path)
    second.initialize()
    restored = second.get_case(created["id"])
    assert restored is not None
    assert restored["summary"] == "教学门诊等候时间问题"
    assert restored["confirmed_department"] == "门诊部"


def test_timeline_event_retains_case_link(tmp_path) -> None:
    now = datetime(2026, 9, 18, 12, 0, tzinfo=timezone.utc)
    database = Database(tmp_path / "sujie.db")
    database.initialize()
    case = database.create_case(sample_case(now))

    event = database.add_timeline_event(
        case_id=case["id"],
        event_type="additional_submission",
        content="【虚构追加件】补充说明等候发生在教学门诊二层。",
        created_at=(now + timedelta(hours=1)).isoformat(),
    )

    restored = database.get_case(case["id"])
    assert event["case_id"] == case["id"]
    assert restored is not None
    assert restored["timeline"][0]["type"] == "additional_submission"

