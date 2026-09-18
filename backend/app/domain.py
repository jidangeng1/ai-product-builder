from __future__ import annotations

from datetime import datetime


TERMINAL_STATUSES = {"closed", "withdrawn"}


def get_case_status(status: str, deadline: str, now: datetime) -> str:
    """Return the display status without mutating the persisted workflow state."""
    if status in TERMINAL_STATUSES:
        return status

    parsed_deadline = datetime.fromisoformat(deadline)
    if parsed_deadline.tzinfo is None and now.tzinfo is not None:
        parsed_deadline = parsed_deadline.replace(tzinfo=now.tzinfo)
    if now > parsed_deadline:
        return "overdue"
    return status

