from __future__ import annotations

from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from backend.app.main import create_app


FICTIONAL_COMPLAINT = (
    "【虚构演示】市民陈某反映，2026年9月17日上午在教学门诊等候时间较长，"
    "希望医院核实分诊流程并给予书面说明。"
)


@pytest.fixture
def database_path(tmp_path: Path) -> Path:
    return tmp_path / "sujie-test.db"


@pytest.fixture
def client(database_path: Path) -> TestClient:
    with TestClient(create_app(database_path)) as test_client:
        yield test_client


def create_case(client: TestClient, confirmed_department: str = "门诊部") -> dict:
    analysis = client.post("/api/ai/analyze", json={"raw_complaint": FICTIONAL_COMPLAINT})
    assert analysis.status_code == 200
    structured = analysis.json()
    structured["confirmed_department"] = confirmed_department
    response = client.post(
        "/api/cases",
        json={"raw_complaint": FICTIONAL_COMPLAINT, **structured},
    )
    assert response.status_code == 201
    return response.json()


def test_mock_analysis_returns_valid_editable_contract(client: TestClient) -> None:
    response = client.post("/api/ai/analyze", json={"raw_complaint": FICTIONAL_COMPLAINT})

    assert response.status_code == 200
    assert response.json() == {
        "summary": "教学门诊等候时间较长",
        "request": "核实分诊流程并给予书面说明",
        "event_time": "2026-09-17 09:00",
        "category": "服务流程",
        "suggested_department": "门诊部",
        "urgency": "medium",
        "key_facts": ["发生地点为教学门诊", "反映等候时间较长"],
        "missing_information": ["实际等候时长", "当日分诊记录"],
    }


def test_create_case_preserves_human_edits_and_updates_dashboard(client: TestClient) -> None:
    case = create_case(client, confirmed_department="医务部（人工确认）")

    assert case["confirmed_department"] == "医务部（人工确认）"
    assert case["suggested_department"] == "门诊部"
    assert case["timeline"][0]["type"] == "case_created"
    dashboard = client.get("/api/dashboard").json()
    assert dashboard["counts"]["pending"] == 1
    assert dashboard["recent_cases"][0]["id"] == case["id"]


def test_case_detail_exposes_deadline_and_deterministic_status(client: TestClient) -> None:
    case = create_case(client)

    response = client.get(f"/api/cases/{case['id']}")

    assert response.status_code == 200
    assert response.json()["deadline"]
    assert response.json()["display_status"] == "pending"
    assert response.json()["timeline"][0]["content"] == "工单已由人工确认创建"


def test_department_reply_generates_unconfirmed_draft_then_human_closes_case(
    client: TestClient,
) -> None:
    case = create_case(client)
    case_id = case["id"]

    saved = client.post(
        f"/api/cases/{case_id}/department-replies",
        json={"content": "【虚构回复】已核查当日分诊记录，并完成流程提醒。"},
    )
    assert saved.status_code == 201
    generated = client.post(f"/api/cases/{case_id}/generate-reply")
    assert generated.status_code == 201
    assert generated.json()["confirmed"] is False
    assert "虚构演示" in generated.json()["draft"]

    before_confirmation = client.get(f"/api/cases/{case_id}").json()
    assert before_confirmation["status"] != "closed"
    confirmed = client.post(
        f"/api/cases/{case_id}/confirm-reply",
        json={"reply_id": generated.json()["id"]},
    )
    assert confirmed.status_code == 200
    assert confirmed.json()["confirmed"] is True
    assert client.get(f"/api/cases/{case_id}").json()["status"] == "closed"


def test_reply_generation_requires_department_reply(client: TestClient) -> None:
    case = create_case(client)

    response = client.post(f"/api/cases/{case['id']}/generate-reply")

    assert response.status_code == 409
    assert response.json()["detail"] == "请先录入科室回复"


def test_additional_submission_links_to_original_case(client: TestClient) -> None:
    case = create_case(client)

    response = client.post(
        f"/api/cases/{case['id']}/additional-submissions",
        json={"content": "【虚构追加件】市民补充说明等候发生在二层分诊台。"},
    )

    assert response.status_code == 201
    assert response.json()["case_id"] == case["id"]
    detail = client.get(f"/api/cases/{case['id']}").json()
    assert detail["timeline"][-1]["type"] == "additional_submission"
    assert client.get("/api/dashboard").json()["counts"]["additional"] == 1


def test_withdrawal_requires_reason_and_stops_overdue_state(client: TestClient) -> None:
    case = create_case(client)

    invalid = client.post(
        f"/api/cases/{case['id']}/withdraw", json={"reason": "  "}
    )
    assert invalid.status_code == 422
    withdrawn = client.post(
        f"/api/cases/{case['id']}/withdraw",
        json={"reason": "【虚构原因】来电人表示问题已解释清楚。"},
    )

    assert withdrawn.status_code == 200
    assert withdrawn.json()["status"] == "withdrawn"
    assert withdrawn.json()["display_status"] == "withdrawn"
    assert withdrawn.json()["withdrawn_at"]
    assert withdrawn.json()["withdrawal_reason"].startswith("【虚构原因】")
    assert client.get("/api/dashboard").json()["counts"]["withdrawn"] == 1


def test_created_case_survives_application_restart(database_path: Path) -> None:
    with TestClient(create_app(database_path)) as first_client:
        case = create_case(first_client)

    with TestClient(create_app(database_path)) as second_client:
        restored = second_client.get(f"/api/cases/{case['id']}")

    assert restored.status_code == 200
    assert restored.json()["raw_complaint"] == FICTIONAL_COMPLAINT

