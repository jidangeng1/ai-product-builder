export type Urgency = "low" | "medium" | "high";

export interface AnalysisResult {
  summary: string;
  request: string;
  event_time: string | null;
  category: string;
  suggested_department: string;
  urgency: Urgency;
  key_facts: string[];
  missing_information: string[];
}

export interface TimelineEvent {
  id: number;
  case_id: number;
  type: string;
  content: string;
  created_at: string;
}

export interface DepartmentReply {
  id: number;
  case_id: number;
  content: string;
  created_at: string;
}

export interface GeneratedReply {
  id: number;
  case_id: number;
  draft: string;
  confirmed: boolean;
  created_at: string;
}

export interface CaseRecord extends AnalysisResult {
  id: number;
  created_at: string;
  raw_complaint: string;
  confirmed_department: string;
  status: string;
  display_status: string;
  deadline: string;
  withdrawal_reason: string | null;
  withdrawn_at: string | null;
  timeline: TimelineEvent[];
  department_replies: DepartmentReply[];
  generated_replies: GeneratedReply[];
}

export interface DashboardData {
  counts: {
    pending: number;
    today_due: number;
    overdue: number;
    additional: number;
    withdrawn: number;
  };
  recent_cases: CaseRecord[];
}

