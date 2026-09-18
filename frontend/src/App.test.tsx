import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import App from "./App";
import type { CaseRecord } from "./types";


const caseRecord: CaseRecord = {
  id: 7,
  created_at: "2026-09-18T08:00:00+00:00",
  raw_complaint: "【虚构演示】市民陈某反映教学门诊等候时间较长。",
  summary: "教学门诊等候时间较长",
  request: "核实流程并说明",
  event_time: "2026-09-17 09:00",
  category: "服务流程",
  suggested_department: "门诊部",
  confirmed_department: "门诊部",
  urgency: "medium",
  key_facts: ["发生地点为教学门诊"],
  missing_information: ["实际等候时长"],
  status: "pending",
  display_status: "pending",
  deadline: "2026-09-21T08:00:00+00:00",
  withdrawal_reason: null,
  withdrawn_at: null,
  timeline: [
    {
      id: 1,
      case_id: 7,
      type: "case_created",
      content: "工单已由人工确认创建",
      created_at: "2026-09-18T08:00:00+00:00"
    }
  ],
  department_replies: [],
  generated_replies: []
};


function jsonResponse(data: unknown, status = 200): Promise<Response> {
  return Promise.resolve(
    new Response(JSON.stringify(data), {
      status,
      headers: { "Content-Type": "application/json" }
    })
  );
}


describe("诉捷工作台", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn((input: string | URL | Request) => {
        const url = String(input);
        if (url.endsWith("/api/dashboard")) {
          return jsonResponse({
            counts: { pending: 1, today_due: 0, overdue: 0, additional: 0, withdrawn: 0 },
            recent_cases: [caseRecord]
          });
        }
        if (url.endsWith("/api/cases/7")) return jsonResponse(caseRecord);
        return jsonResponse({ detail: "not found" }, 404);
      })
    );
  });

  afterEach(() => vi.unstubAllGlobals());

  it("shows every required queue and opens a recent case", async () => {
    const user = userEvent.setup();
    render(<App />);

    expect(await screen.findByRole("heading", { name: "工作台" })).toBeInTheDocument();
    expect(screen.getByText("待办")).toBeInTheDocument();
    expect(screen.getByText("今日待回复")).toBeInTheDocument();
    expect(screen.getByText("已超期")).toBeInTheDocument();
    expect(screen.getByText("追加件")).toBeInTheDocument();
    expect(screen.getByText("撤件")).toBeInTheDocument();
    expect(screen.getByText("仅使用虚构演示数据")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /教学门诊等候时间较长/ }));
    expect(await screen.findByRole("heading", { name: "工单详情" })).toBeInTheDocument();
    expect(screen.getByText("工单已由人工确认创建")).toBeInTheDocument();
  });
});


describe("诉捷端到端人工审核流程", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("analyzes an editable fictional complaint and creates the confirmed case", async () => {
    const user = userEvent.setup();
    const analysis = {
      summary: "教学门诊等候时间较长",
      request: "核实分诊流程并给予书面说明",
      event_time: "2026-09-17 09:00",
      category: "服务流程",
      suggested_department: "门诊部",
      urgency: "medium",
      key_facts: ["发生地点为教学门诊"],
      missing_information: ["实际等候时长"]
    };
    vi.stubGlobal(
      "fetch",
      vi.fn((input: string | URL | Request, init?: RequestInit) => {
        const url = String(input);
        if (url.endsWith("/api/dashboard")) {
          return jsonResponse({
            counts: { pending: 0, today_due: 0, overdue: 0, additional: 0, withdrawn: 0 },
            recent_cases: []
          });
        }
        if (url.endsWith("/api/ai/analyze")) return jsonResponse(analysis);
        if (url.endsWith("/api/cases") && init?.method === "POST") {
          const submitted = JSON.parse(String(init.body));
          return jsonResponse(
            { ...caseRecord, id: 8, ...submitted, confirmed_department: "医务部（人工确认）" },
            201
          );
        }
        return jsonResponse({ detail: "not found" }, 404);
      })
    );
    render(<App />);
    await screen.findByRole("heading", { name: "工作台" });

    await user.click(screen.getByRole("button", { name: "新建投诉" }));
    expect(screen.getByRole("heading", { name: "新建投诉" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "使用虚构示例" }));
    await user.click(screen.getByRole("button", { name: "AI 智能分析" }));

    const department = await screen.findByLabelText("确认责任科室");
    expect(screen.getByText("AI 建议，需人工确认")).toBeInTheDocument();
    await user.clear(department);
    await user.type(department, "医务部（人工确认）");
    await user.click(screen.getByRole("button", { name: "确认并创建工单" }));

    expect(await screen.findByRole("heading", { name: "工单详情" })).toBeInTheDocument();
    expect(screen.getByText("医务部（人工确认）")).toBeInTheDocument();
  });

  it("saves a department reply and keeps the generated reply as a draft until confirmation", async () => {
    const user = userEvent.setup();
    let current = structuredClone(caseRecord);
    const generated = {
      id: 4,
      case_id: 7,
      draft: "【虚构演示回复草稿｜需人工确认】您好，医院已完成核查。",
      confirmed: false,
      created_at: "2026-09-18T09:00:00+00:00"
    };
    vi.stubGlobal(
      "fetch",
      vi.fn((input: string | URL | Request, init?: RequestInit) => {
        const url = String(input);
        if (url.endsWith("/api/dashboard")) {
          return jsonResponse({
            counts: { pending: 1, today_due: 0, overdue: 0, additional: 0, withdrawn: 0 },
            recent_cases: [current]
          });
        }
        if (url.endsWith("/api/cases/7") && !init?.method) return jsonResponse(current);
        if (url.endsWith("/department-replies")) {
          current = {
            ...current,
            status: "reply_received",
            display_status: "reply_received",
            department_replies: [
              {
                id: 2,
                case_id: 7,
                content: "【虚构回复】已核查当日分诊记录。",
                created_at: "2026-09-18T08:30:00+00:00"
              }
            ]
          };
          return jsonResponse(current.department_replies[0], 201);
        }
        if (url.endsWith("/generate-reply")) {
          current = {
            ...current,
            status: "draft_ready",
            display_status: "draft_ready",
            generated_replies: [generated]
          };
          return jsonResponse(generated, 201);
        }
        if (url.endsWith("/confirm-reply")) {
          current = {
            ...current,
            status: "closed",
            display_status: "closed",
            generated_replies: [{ ...generated, confirmed: true }]
          };
          return jsonResponse({ ...generated, confirmed: true });
        }
        return jsonResponse({ detail: "not found" }, 404);
      })
    );
    render(<App />);
    await user.click(await screen.findByRole("button", { name: /教学门诊等候时间较长/ }));

    await user.type(screen.getByLabelText("科室回复"), "【虚构回复】已核查当日分诊记录。");
    await user.click(screen.getByRole("button", { name: "保存科室回复" }));
    await user.click(await screen.findByRole("button", { name: "生成 12345 回复草稿" }));

    expect(await screen.findByText(/虚构演示回复草稿/)).toBeInTheDocument();
    expect(screen.getByText("尚未对外确认")).toBeInTheDocument();
    expect(screen.getByText("待处理", { exact: false })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "人工确认并关闭工单" }));
    expect(await screen.findByText("已关闭")).toBeInTheDocument();
  });

  it("links an additional submission and requires a reason before withdrawal", async () => {
    const user = userEvent.setup();
    let current = structuredClone(caseRecord);
    vi.stubGlobal(
      "fetch",
      vi.fn((input: string | URL | Request, init?: RequestInit) => {
        const url = String(input);
        if (url.endsWith("/api/dashboard")) {
          return jsonResponse({
            counts: { pending: 1, today_due: 0, overdue: 0, additional: 0, withdrawn: 0 },
            recent_cases: [current]
          });
        }
        if (url.endsWith("/api/cases/7") && !init?.method) return jsonResponse(current);
        if (url.endsWith("/additional-submissions")) {
          const event = {
            id: 3,
            case_id: 7,
            type: "additional_submission",
            content: "【虚构追加件】补充分诊台位置。",
            created_at: "2026-09-18T09:00:00+00:00"
          };
          current = { ...current, timeline: [...current.timeline, event] };
          return jsonResponse(event, 201);
        }
        if (url.endsWith("/withdraw")) {
          current = {
            ...current,
            status: "withdrawn",
            display_status: "withdrawn",
            withdrawal_reason: "【虚构原因】来电人表示问题已解决。",
            withdrawn_at: "2026-09-18T09:10:00+00:00"
          };
          return jsonResponse(current);
        }
        return jsonResponse({ detail: "not found" }, 404);
      })
    );
    render(<App />);
    await user.click(await screen.findByRole("button", { name: /教学门诊等候时间较长/ }));

    await user.type(screen.getByLabelText("追加件内容"), "【虚构追加件】补充分诊台位置。");
    await user.click(screen.getByRole("button", { name: "关联追加件" }));
    expect(await screen.findByText("【虚构追加件】补充分诊台位置。")).toBeInTheDocument();

    expect(screen.getByRole("button", { name: "确认撤件" })).toBeDisabled();
    await user.type(screen.getByLabelText("撤件原因"), "【虚构原因】来电人表示问题已解决。");
    await user.click(screen.getByRole("button", { name: "确认撤件" }));
    expect(await screen.findByText("已撤件")).toBeInTheDocument();
    expect(screen.getByText("撤件后停止超期计时")).toBeInTheDocument();
  });
});
