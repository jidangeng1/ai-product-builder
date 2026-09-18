from __future__ import annotations

from backend.app.schemas import AnalysisResult


def analyze_complaint(raw_complaint: str) -> AnalysisResult:
    """Validated mock provider used when no model API is configured."""
    return AnalysisResult.model_validate(
        {
            "summary": "教学门诊等候时间较长",
            "request": "核实分诊流程并给予书面说明",
            "event_time": "2026-09-17 09:00",
            "category": "服务流程",
            "suggested_department": "门诊部",
            "urgency": "medium",
            "key_facts": ["发生地点为教学门诊", "反映等候时间较长"],
            "missing_information": ["实际等候时长", "当日分诊记录"],
        }
    )


def generate_reply(case: dict, department_reply: dict) -> str:
    return (
        "【虚构演示回复草稿｜需人工确认】您好，关于您反映的"
        f"“{case['summary']}”问题，医院已转交{case['confirmed_department']}核查。"
        f"经反馈：{department_reply['content']}感谢您的监督与理解。"
    )

