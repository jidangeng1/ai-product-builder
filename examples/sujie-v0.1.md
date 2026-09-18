# 诉捷 AI V0.1 — Execution Brief

## Product
**Name:** 诉捷 AI  
**Positioning:** Hospital 12345 complaint-handling assistant / workflow demo.  
**Goal:** Demonstrate how an AI-assisted workflow can turn an incoming complaint into a structured, trackable work order and a human-reviewed reply draft.

All people, complaints, departments, dates, and records in the demo must be fictional. This is a portfolio prototype, not a deployed hospital system.

## Target user
Hospital education/administrative staff responsible for receiving, routing, tracking, and replying to 12345 complaint cases.

## V0.1 primary journey
New complaint → AI-assisted structuring → human confirmation → create work order → deadline/status tracking → department reply entered → AI-assisted 12345 reply draft → human confirmation → close case.

## Screens
### 1. 工作台
Show:
- 待办
- 今日待回复
- 已超期
- 追加件
- 撤件
- 最近工单

Status semantics should be visually easy to scan. Avoid decorative dashboard clutter.

### 2. 新建投诉
Left: raw fictional 12345 complaint text.
Action: “AI 智能分析”.
Right: editable structured result:
- complaint summary
- core request
- event time
- complaint category
- suggested responsible department
- urgency
- key facts / missing information

The user must confirm/edit before creating a work order.

### 3. 工单详情
Show:
- case metadata
- status
- deadline
- structured complaint
- timeline
- responsible department
- department reply input
- generated 12345 reply draft
- human confirmation / close action

### 4. 追加件 / 撤件 behavior
An additional submission can link back to the original case and appear in its timeline.
A withdrawn case must be clearly marked, record withdrawal time/reason, and stop overdue countdown.

## Business rules
- Deadline/status calculation is deterministic, not delegated to the LLM.
- “撤件” is a distinct terminal state for V0.1 and must stop overdue calculation.
- AI department routing is a suggestion until human confirmation.
- AI-generated external reply is always a draft until human confirmation.
- Additional submissions preserve linkage to the original case.
- Use fictional data only.

## AI contract for V0.1
The UI must support a mock mode first so the product is demoable without an API key.

Input:
- raw complaint text

Structured output:
```json
{
  "summary": "string",
  "request": "string",
  "event_time": "string | null",
  "category": "string",
  "suggested_department": "string",
  "urgency": "low | medium | high",
  "key_facts": ["string"],
  "missing_information": ["string"]
}
```

Reply generation input:
- original complaint
- confirmed structured data
- department reply

Output:
- a concise, formal 12345 reply draft

## Recommended V0.1 stack
- React + Vite
- FastAPI
- SQLite
- OpenAI-compatible API adapter
- Mock AI provider enabled by default

Do not add RAG merely for resume keywords in V0.1. Add it later only if there is a real knowledge source and retrieval need.

## Minimum data entities
**Case**
- id
- created_at
- raw_complaint
- summary
- request
- event_time
- category
- suggested_department
- confirmed_department
- urgency
- status
- deadline
- withdrawal_reason
- withdrawn_at

**TimelineEvent**
- id
- case_id
- type
- content
- created_at

**DepartmentReply**
- id
- case_id
- content
- created_at

**GeneratedReply**
- id
- case_id
- draft
- confirmed
- created_at

## Acceptance criteria
1. A user can paste/select a fictional complaint and trigger mock AI analysis.
2. Structured fields appear and can be edited before case creation.
3. Creating the case makes it visible on the dashboard.
4. Opening the case shows its timeline and deadline/status.
5. A department reply can be entered and saved.
6. A reply draft can be generated from the case + department reply.
7. The draft cannot be treated as externally confirmed until the user explicitly confirms it.
8. An additional submission can be linked to an existing case.
9. A case can be withdrawn with a reason; withdrawn cases no longer become overdue.
10. Refreshing the app preserves created demo cases through SQLite.
11. The app can be run locally using README instructions.
12. No real patient or complainant information is present.

## Out of scope for V0.1
- real hospital OA integration
- real 12345 platform integration
- authentication/permissions
- production deployment
- real patient data
- automatic sending of replies
- RAG/knowledge base
- analytics beyond the demo dashboard
