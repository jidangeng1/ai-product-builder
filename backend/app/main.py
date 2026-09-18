from __future__ import annotations

import os
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone
from pathlib import Path

from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware

from backend.app.ai import analyze_complaint, generate_reply
from backend.app.database import Database
from backend.app.domain import get_case_status
from backend.app.schemas import (
    AnalysisResult,
    CaseCreate,
    ComplaintInput,
    ConfirmReplyInput,
    TextInput,
    WithdrawalInput,
)


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def create_app(database_path: str | Path | None = None) -> FastAPI:
    resolved_path = database_path or os.getenv("SUJIE_DATABASE_PATH", "sujie.db")
    database = Database(resolved_path)

    @asynccontextmanager
    async def lifespan(_: FastAPI):
        database.initialize()
        yield

    app = FastAPI(title="诉捷 AI V0.1", version="0.1.0", lifespan=lifespan)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.state.database = database

    def require_case(case_id: int) -> dict:
        case = database.get_case(case_id)
        if case is None:
            raise HTTPException(status_code=404, detail="工单不存在")
        case["display_status"] = get_case_status(
            case["status"], case["deadline"], utc_now()
        )
        return case

    @app.get("/api/health")
    def health() -> dict[str, str]:
        return {"status": "ok", "ai_mode": "mock"}

    @app.post("/api/ai/analyze", response_model=AnalysisResult)
    def analyze(payload: ComplaintInput) -> AnalysisResult:
        return analyze_complaint(payload.raw_complaint)

    @app.post("/api/cases", status_code=status.HTTP_201_CREATED)
    def create_case(payload: CaseCreate) -> dict:
        now = utc_now()
        case = database.create_case(
            {
                **payload.model_dump(),
                "created_at": now.isoformat(),
                "status": "pending",
                "deadline": (now + timedelta(days=3)).isoformat(),
            }
        )
        database.add_timeline_event(
            case["id"], "case_created", "工单已由人工确认创建", now.isoformat()
        )
        return require_case(case["id"])

    @app.get("/api/cases")
    def list_cases() -> list[dict]:
        return [require_case(case["id"]) for case in database.list_cases()]

    @app.get("/api/cases/{case_id}")
    def get_case(case_id: int) -> dict:
        return require_case(case_id)

    @app.get("/api/dashboard")
    def dashboard() -> dict:
        cases = [require_case(case["id"]) for case in database.list_cases()]
        today = utc_now().date()
        counts = {
            "pending": sum(
                case["status"] not in {"closed", "withdrawn"}
                and case["display_status"] != "overdue"
                for case in cases
            ),
            "today_due": sum(
                case["status"] not in {"closed", "withdrawn"}
                and datetime.fromisoformat(case["deadline"]).date() == today
                for case in cases
            ),
            "overdue": sum(case["display_status"] == "overdue" for case in cases),
            "additional": sum(
                any(item["type"] == "additional_submission" for item in case["timeline"])
                for case in cases
            ),
            "withdrawn": sum(case["status"] == "withdrawn" for case in cases),
        }
        return {"counts": counts, "recent_cases": cases[:8]}

    @app.post(
        "/api/cases/{case_id}/department-replies",
        status_code=status.HTTP_201_CREATED,
    )
    def add_department_reply(case_id: int, payload: TextInput) -> dict:
        case = require_case(case_id)
        if case["status"] in {"closed", "withdrawn"}:
            raise HTTPException(status_code=409, detail="终态工单不能录入科室回复")
        now = utc_now().isoformat()
        reply = database.add_department_reply(case_id, payload.content, now)
        database.update_case(case_id, {"status": "reply_received"})
        database.add_timeline_event(case_id, "department_reply", "已录入科室回复", now)
        return reply

    @app.post(
        "/api/cases/{case_id}/generate-reply",
        status_code=status.HTTP_201_CREATED,
    )
    def create_generated_reply(case_id: int) -> dict:
        case = require_case(case_id)
        if not case["department_replies"]:
            raise HTTPException(status_code=409, detail="请先录入科室回复")
        if case["status"] in {"closed", "withdrawn"}:
            raise HTTPException(status_code=409, detail="终态工单不能生成回复")
        now = utc_now().isoformat()
        reply = database.add_generated_reply(
            case_id, generate_reply(case, case["department_replies"][-1]), now
        )
        database.update_case(case_id, {"status": "draft_ready"})
        database.add_timeline_event(case_id, "reply_generated", "AI 回复草稿已生成", now)
        return reply

    @app.post("/api/cases/{case_id}/confirm-reply")
    def confirm_reply(case_id: int, payload: ConfirmReplyInput) -> dict:
        require_case(case_id)
        reply = database.confirm_generated_reply(case_id, payload.reply_id)
        if reply is None:
            raise HTTPException(status_code=404, detail="回复草稿不存在")
        now = utc_now().isoformat()
        database.update_case(case_id, {"status": "closed"})
        database.add_timeline_event(
            case_id, "reply_confirmed", "回复已由人工确认，工单关闭", now
        )
        return reply

    @app.post(
        "/api/cases/{case_id}/additional-submissions",
        status_code=status.HTTP_201_CREATED,
    )
    def add_submission(case_id: int, payload: TextInput) -> dict:
        require_case(case_id)
        return database.add_timeline_event(
            case_id,
            "additional_submission",
            payload.content,
            utc_now().isoformat(),
        )

    @app.post("/api/cases/{case_id}/withdraw")
    def withdraw(case_id: int, payload: WithdrawalInput) -> dict:
        case = require_case(case_id)
        if case["status"] in {"closed", "withdrawn"}:
            raise HTTPException(status_code=409, detail="终态工单不能再次撤件")
        now = utc_now().isoformat()
        database.update_case(
            case_id,
            {
                "status": "withdrawn",
                "withdrawal_reason": payload.reason,
                "withdrawn_at": now,
            },
        )
        database.add_timeline_event(case_id, "withdrawn", payload.reason, now)
        return require_case(case_id)

    return app


app = create_app()
