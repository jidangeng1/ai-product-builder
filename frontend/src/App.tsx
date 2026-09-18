import { type FormEvent, useEffect, useState } from "react";

import { api } from "./api";
import type { AnalysisResult, CaseRecord, DashboardData, Urgency } from "./types";
import "./styles.css";


const STATUS_LABELS: Record<string, string> = {
  pending: "待处理",
  reply_received: "科室已回复",
  draft_ready: "草稿待确认",
  overdue: "已超期",
  closed: "已关闭",
  withdrawn: "已撤件"
};

const QUEUES = [
  { key: "pending", label: "待办", tone: "blue" },
  { key: "today_due", label: "今日待回复", tone: "amber" },
  { key: "overdue", label: "已超期", tone: "red" },
  { key: "additional", label: "追加件", tone: "violet" },
  { key: "withdrawn", label: "撤件", tone: "slate" }
] as const;


function formatDate(value: string): string {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}


function App() {
  const [page, setPage] = useState<"dashboard" | "new" | "case">("dashboard");
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [selectedCase, setSelectedCase] = useState<CaseRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadDashboard = async () => {
    setLoading(true);
    setError("");
    try {
      setDashboard(await api.dashboard());
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "工作台加载失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadDashboard();
  }, []);

  const openCase = async (caseId: number) => {
    setLoading(true);
    setError("");
    try {
      setSelectedCase(await api.caseDetail(caseId));
      setPage("case");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "工单加载失败");
    } finally {
      setLoading(false);
    }
  };

  const refreshCase = async () => {
    if (selectedCase) setSelectedCase(await api.caseDetail(selectedCase.id));
  };

  const showDashboard = () => {
    setSelectedCase(null);
    setPage("dashboard");
    void loadDashboard();
  };

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-mark">诉</div>
        <div>
          <strong>诉捷 AI</strong>
          <span>12345 投诉协同</span>
        </div>
        <nav aria-label="主导航">
          <button className={`nav-item ${page === "dashboard" ? "active" : ""}`} onClick={showDashboard}>
            工作台
          </button>
          <button className={`nav-item ${page === "new" ? "active" : ""}`} onClick={() => setPage("new")}>
            新建投诉
          </button>
        </nav>
        <div className="demo-badge">仅使用虚构演示数据</div>
      </aside>

      <main className="main-panel">
        {error && (
          <div className="error-banner" role="alert">
            <span>{error}</span>
            <button onClick={() => void loadDashboard()}>重新加载</button>
          </div>
        )}
        {loading ? (
          <div className="loading-state" role="status">正在读取工单…</div>
        ) : page === "new" ? (
          <NewComplaint onCreated={(record) => { setSelectedCase(record); setPage("case"); }} />
        ) : page === "case" && selectedCase ? (
          <CaseDetail caseRecord={selectedCase} onBack={showDashboard} onRefresh={refreshCase} />
        ) : (
          <Dashboard
            data={dashboard}
            onNew={() => setPage("new")}
            onOpenCase={(id) => void openCase(id)}
          />
        )}
      </main>
    </div>
  );
}


function Dashboard({
  data,
  onNew,
  onOpenCase
}: {
  data: DashboardData | null;
  onNew: () => void;
  onOpenCase: (id: number) => void;
}) {
  return (
    <section>
      <header className="page-header">
        <div>
          <p className="eyebrow">今日工作概览</p>
          <h1>工作台</h1>
          <p>优先处理临近时限和需要人工确认的工单。</p>
        </div>
        <button className="primary-button" onClick={onNew}>＋ 新建投诉</button>
      </header>

      <div className="queue-grid">
        {QUEUES.map((queue) => (
          <article className={`queue-card ${queue.tone}`} key={queue.key}>
            <span>{queue.label}</span>
            <strong>{data?.counts[queue.key] ?? 0}</strong>
          </article>
        ))}
      </div>

      <section className="content-card">
        <div className="section-heading">
          <div>
            <p className="eyebrow">按最近更新时间排序</p>
            <h2>最近工单</h2>
          </div>
          <span>{data?.recent_cases.length ?? 0} 条</span>
        </div>
        {!data?.recent_cases.length ? (
          <div className="empty-state">
            <strong>还没有演示工单</strong>
            <p>从“新建投诉”开始创建第一条虚构案例。</p>
          </div>
        ) : (
          <div className="case-list">
            {data.recent_cases.map((item) => (
              <button className="case-row" key={item.id} onClick={() => onOpenCase(item.id)}>
                <span className={`status-dot ${item.display_status}`} />
                <span className="case-number">SJ-{String(item.id).padStart(4, "0")}</span>
                <span className="case-title">{item.summary}</span>
                <span>{item.confirmed_department}</span>
                <span className={`status-chip ${item.display_status}`}>
                  {STATUS_LABELS[item.display_status] ?? item.display_status}
                </span>
                <span>{formatDate(item.deadline)}</span>
              </button>
            ))}
          </div>
        )}
      </section>
    </section>
  );
}


const FICTIONAL_EXAMPLE = "【虚构演示】市民陈某反映，2026年9月17日上午在教学门诊等候时间较长，希望医院核实分诊流程并给予书面说明。";


function NewComplaint({ onCreated }: { onCreated: (record: CaseRecord) => void }) {
  const [rawComplaint, setRawComplaint] = useState("");
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [confirmedDepartment, setConfirmedDepartment] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const analyze = async () => {
    setBusy(true);
    setMessage("");
    try {
      const result = await api.analyze(rawComplaint);
      setAnalysis(result);
      setConfirmedDepartment(result.suggested_department);
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : "智能分析失败");
    } finally {
      setBusy(false);
    }
  };

  const createCase = async (event: FormEvent) => {
    event.preventDefault();
    if (!analysis) return;
    setBusy(true);
    setMessage("");
    try {
      onCreated(await api.createCase({
        ...analysis,
        raw_complaint: rawComplaint,
        confirmed_department: confirmedDepartment
      }));
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : "工单创建失败");
    } finally {
      setBusy(false);
    }
  };

  const updateAnalysis = <K extends keyof AnalysisResult>(key: K, value: AnalysisResult[K]) => {
    setAnalysis((current) => current ? { ...current, [key]: value } : current);
  };

  return (
    <section>
      <header className="page-header">
        <div>
          <p className="eyebrow">新工单</p>
          <h1>新建投诉</h1>
          <p>AI 只负责提取建议，创建前必须由工作人员核对。</p>
        </div>
      </header>
      {message && <div className="error-banner" role="alert">{message}</div>}
      <div className="composer-grid">
        <section className="content-card form-card">
          <div className="section-heading">
            <h2>12345 原始内容</h2>
            <button className="text-button" type="button" onClick={() => setRawComplaint(FICTIONAL_EXAMPLE)}>使用虚构示例</button>
          </div>
          <label htmlFor="raw-complaint">原始投诉内容</label>
          <textarea
            id="raw-complaint"
            rows={14}
            value={rawComplaint}
            onChange={(event) => setRawComplaint(event.target.value)}
            placeholder="粘贴已脱敏且明确标注为虚构的演示投诉…"
          />
          <button className="primary-button full" onClick={() => void analyze()} disabled={busy || rawComplaint.trim().length < 10}>
            {busy ? "分析中…" : "AI 智能分析"}
          </button>
        </section>

        <form className="content-card form-card" onSubmit={(event) => void createCase(event)}>
          <div className="section-heading">
            <h2>结构化结果</h2>
            <span className="review-label">AI 建议，需人工确认</span>
          </div>
          {!analysis ? (
            <div className="empty-state compact"><p>完成左侧分析后，可在这里修改结果。</p></div>
          ) : (
            <>
              <label htmlFor="summary">投诉摘要</label>
              <input id="summary" value={analysis.summary} onChange={(event) => updateAnalysis("summary", event.target.value)} required />
              <label htmlFor="request">核心诉求</label>
              <textarea id="request" rows={3} value={analysis.request} onChange={(event) => updateAnalysis("request", event.target.value)} required />
              <div className="field-pair">
                <div><label htmlFor="event-time">事件时间</label><input id="event-time" value={analysis.event_time ?? ""} onChange={(event) => updateAnalysis("event_time", event.target.value || null)} /></div>
                <div><label htmlFor="category">投诉分类</label><input id="category" value={analysis.category} onChange={(event) => updateAnalysis("category", event.target.value)} required /></div>
              </div>
              <div className="field-pair">
                <div><label htmlFor="suggested-department">AI 建议科室</label><input id="suggested-department" value={analysis.suggested_department} onChange={(event) => updateAnalysis("suggested_department", event.target.value)} required /></div>
                <div><label htmlFor="urgency">紧急程度</label><select id="urgency" value={analysis.urgency} onChange={(event) => updateAnalysis("urgency", event.target.value as Urgency)}><option value="low">低</option><option value="medium">中</option><option value="high">高</option></select></div>
              </div>
              <label htmlFor="confirmed-department">确认责任科室</label>
              <input id="confirmed-department" value={confirmedDepartment} onChange={(event) => setConfirmedDepartment(event.target.value)} required />
              <label htmlFor="key-facts">关键事实（每行一项）</label>
              <textarea id="key-facts" rows={3} value={analysis.key_facts.join("\n")} onChange={(event) => updateAnalysis("key_facts", event.target.value.split("\n").filter(Boolean))} />
              <label htmlFor="missing-information">缺失信息（每行一项）</label>
              <textarea id="missing-information" rows={3} value={analysis.missing_information.join("\n")} onChange={(event) => updateAnalysis("missing_information", event.target.value.split("\n").filter(Boolean))} />
              <button className="primary-button full" type="submit" disabled={busy || !confirmedDepartment.trim()}>确认并创建工单</button>
            </>
          )}
        </form>
      </div>
    </section>
  );
}


function CaseDetail({
  caseRecord,
  onBack,
  onRefresh
}: {
  caseRecord: CaseRecord;
  onBack: () => void;
  onRefresh: () => Promise<void>;
}) {
  const [departmentReply, setDepartmentReply] = useState("");
  const [additional, setAdditional] = useState("");
  const [withdrawalReason, setWithdrawalReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const terminal = ["closed", "withdrawn"].includes(caseRecord.status);
  const latestDraft = caseRecord.generated_replies.at(-1);

  const runAction = async (action: () => Promise<unknown>, success: string) => {
    setBusy(true);
    setMessage("");
    try {
      await action();
      await onRefresh();
      setMessage(success);
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : "操作失败");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section>
      <button className="back-button" onClick={onBack}>← 返回工作台</button>
      <header className="page-header detail-header">
        <div>
          <p className="eyebrow">SJ-{String(caseRecord.id).padStart(4, "0")}</p>
          <h1>工单详情</h1>
          <p>{caseRecord.summary}</p>
        </div>
        <span className={`status-chip large ${caseRecord.display_status}`}>
          {STATUS_LABELS[caseRecord.display_status] ?? caseRecord.display_status}
        </span>
      </header>

      <div className="detail-grid">
        <div className="detail-main">
          <section className="content-card info-grid">
            <div><span>责任科室</span><strong>{caseRecord.confirmed_department}</strong></div>
            <div><span>办理时限</span><strong>{formatDate(caseRecord.deadline)}</strong></div>
            <div><span>诉求分类</span><strong>{caseRecord.category}</strong></div>
            <div><span>紧急程度</span><strong>{caseRecord.urgency}</strong></div>
          </section>
          <section className="content-card">
            <h2>结构化投诉</h2>
            <dl className="structured-list">
              <div><dt>核心诉求</dt><dd>{caseRecord.request}</dd></div>
              <div><dt>原始内容</dt><dd>{caseRecord.raw_complaint}</dd></div>
              <div><dt>待补信息</dt><dd>{caseRecord.missing_information.join("、") || "无"}</dd></div>
            </dl>
          </section>
          {!terminal && (
            <section className="content-card action-stack">
              <h2>办理与回复</h2>
              <label htmlFor="department-reply">科室回复</label>
              <textarea id="department-reply" rows={4} value={departmentReply} onChange={(event) => setDepartmentReply(event.target.value)} placeholder="录入科室核查结果（演示内容须为虚构）" />
              <div className="button-row">
                <button className="secondary-button" disabled={busy || !departmentReply.trim()} onClick={() => void runAction(() => api.addDepartmentReply(caseRecord.id, departmentReply), "科室回复已保存")}>保存科室回复</button>
                <button className="primary-button" disabled={busy || caseRecord.department_replies.length === 0} onClick={() => void runAction(() => api.generateReply(caseRecord.id), "回复草稿已生成")}>生成 12345 回复草稿</button>
              </div>
              {latestDraft && (
                <div className="draft-box">
                  <div className="section-heading"><strong>AI 回复草稿</strong><span className={latestDraft.confirmed ? "confirmed-label" : "review-label"}>{latestDraft.confirmed ? "已人工确认" : "尚未对外确认"}</span></div>
                  <p>{latestDraft.draft}</p>
                  {!latestDraft.confirmed && <><small>外部状态：待处理（尚未确认）</small><button className="primary-button full" disabled={busy} onClick={() => void runAction(() => api.confirmReply(caseRecord.id, latestDraft.id), "回复已确认，工单已关闭")}>人工确认并关闭工单</button></>}
                </div>
              )}
            </section>
          )}
          {!terminal && (
            <section className="content-card split-actions">
              <div>
                <h2>关联追加件</h2>
                <label htmlFor="additional-submission">追加件内容</label>
                <textarea id="additional-submission" rows={3} value={additional} onChange={(event) => setAdditional(event.target.value)} />
                <button className="secondary-button full" disabled={busy || !additional.trim()} onClick={() => void runAction(async () => { await api.addAdditionalSubmission(caseRecord.id, additional); setAdditional(""); }, "追加件已关联")}>关联追加件</button>
              </div>
              <div className="withdraw-panel">
                <h2>撤件</h2>
                <p>撤件是终态，记录原因后停止超期计时。</p>
                <label htmlFor="withdrawal-reason">撤件原因</label>
                <textarea id="withdrawal-reason" rows={3} value={withdrawalReason} onChange={(event) => setWithdrawalReason(event.target.value)} />
                <button className="danger-button full" disabled={busy || !withdrawalReason.trim()} onClick={() => void runAction(() => api.withdraw(caseRecord.id, withdrawalReason), "工单已撤件")}>确认撤件</button>
              </div>
            </section>
          )}
          {caseRecord.status === "withdrawn" && (
            <section className="content-card withdrawn-notice">
              <strong>撤件后停止超期计时</strong>
              <p>{caseRecord.withdrawal_reason}</p>
            </section>
          )}
          {message && <div className={message.includes("失败") ? "error-banner" : "success-banner"} role="status">{message}</div>}
        </div>
        <section className="content-card timeline-card">
          <h2>工单时间线</h2>
          <ol className="timeline">
            {caseRecord.timeline.map((event) => (
              <li key={event.id}>
                <time>{formatDate(event.created_at)}</time>
                <p>{event.content}</p>
              </li>
            ))}
          </ol>
        </section>
      </div>
    </section>
  );
}


export default App;
