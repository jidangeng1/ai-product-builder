from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator


class ComplaintInput(BaseModel):
    raw_complaint: str = Field(min_length=10)

    @field_validator("raw_complaint")
    @classmethod
    def complaint_must_be_fictional_demo(cls, value: str) -> str:
        value = value.strip()
        if "虚构" not in value:
            raise ValueError("演示投诉必须明确标注为虚构数据")
        return value


class AnalysisResult(BaseModel):
    summary: str
    request: str
    event_time: str | None
    category: str
    suggested_department: str
    urgency: Literal["low", "medium", "high"]
    key_facts: list[str]
    missing_information: list[str]


class CaseCreate(ComplaintInput, AnalysisResult):
    confirmed_department: str = Field(min_length=1)


class TextInput(BaseModel):
    content: str = Field(min_length=1)

    @field_validator("content")
    @classmethod
    def strip_content(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("内容不能为空")
        return value


class WithdrawalInput(BaseModel):
    reason: str = Field(min_length=1)

    @field_validator("reason")
    @classmethod
    def strip_reason(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("撤件原因不能为空")
        return value


class ConfirmReplyInput(BaseModel):
    reply_id: int = Field(gt=0)


class ApiModel(BaseModel):
    model_config = ConfigDict(extra="allow")

