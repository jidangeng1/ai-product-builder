import type {
  AnalysisResult,
  CaseRecord,
  DashboardData,
  DepartmentReply,
  GeneratedReply,
  TimelineEvent
} from "./types";


async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers
    }
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { detail?: string } | null;
    throw new Error(body?.detail ?? `请求失败（${response.status}）`);
  }
  return response.json() as Promise<T>;
}


export const api = {
  dashboard: () => request<DashboardData>("/api/dashboard"),
  caseDetail: (caseId: number) => request<CaseRecord>(`/api/cases/${caseId}`),
  analyze: (rawComplaint: string) =>
    request<AnalysisResult>("/api/ai/analyze", {
      method: "POST",
      body: JSON.stringify({ raw_complaint: rawComplaint })
    }),
  createCase: (payload: AnalysisResult & { raw_complaint: string; confirmed_department: string }) =>
    request<CaseRecord>("/api/cases", { method: "POST", body: JSON.stringify(payload) }),
  addDepartmentReply: (caseId: number, content: string) =>
    request<DepartmentReply>(`/api/cases/${caseId}/department-replies`, {
      method: "POST",
      body: JSON.stringify({ content })
    }),
  generateReply: (caseId: number) =>
    request<GeneratedReply>(`/api/cases/${caseId}/generate-reply`, { method: "POST" }),
  confirmReply: (caseId: number, replyId: number) =>
    request<GeneratedReply>(`/api/cases/${caseId}/confirm-reply`, {
      method: "POST",
      body: JSON.stringify({ reply_id: replyId })
    }),
  addAdditionalSubmission: (caseId: number, content: string) =>
    request<TimelineEvent>(`/api/cases/${caseId}/additional-submissions`, {
      method: "POST",
      body: JSON.stringify({ content })
    }),
  withdraw: (caseId: number, reason: string) =>
    request<CaseRecord>(`/api/cases/${caseId}/withdraw`, {
      method: "POST",
      body: JSON.stringify({ reason })
    })
};
