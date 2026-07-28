import { FormSubmitButton } from "@/components/form-submit-button";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { syncIcallUatStatus } from "./icall-training-actions";

export type IcallTrainingAssignment = {
  training_title: string | null;
  training_url: string | null;
  training_assigned_at: string | null;
  training_started_at: string | null;
  training_completed_at: string | null;
  training_deadline: string | null;
  training_status: string;
  exam_completed_at: string | null;
  exam_status: string;
  exam_score: number | null;
  icall_login_id?: string | null;
  icall_candidate_name?: string | null;
  icall_mobile_number?: string | null;
  icall_internal_pos_code?: string | null;
  icall_issue_date?: string | null;
  icall_expiry_date?: string | null;
  icall_hours_allotted?: string | null;
  icall_hours_completed?: string | null;
  icall_hours_remaining?: string | null;
  icall_last_synced_at?: string | null;
};

type IcallDetails = Required<Pick<IcallTrainingAssignment,
  "icall_login_id" | "icall_candidate_name" | "icall_mobile_number" | "icall_internal_pos_code" |
  "icall_issue_date" | "icall_expiry_date" | "icall_hours_allotted" | "icall_hours_completed" |
  "icall_hours_remaining" | "icall_last_synced_at"
>>;

export async function IcallTrainingDashboard({ applicationId, assignment }: { applicationId: string; assignment: IcallTrainingAssignment }) {
  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .from("intermediary_training_exam_assignments")
    .select("icall_login_id,icall_candidate_name,icall_mobile_number,icall_internal_pos_code,icall_issue_date,icall_expiry_date,icall_hours_allotted,icall_hours_completed,icall_hours_remaining,icall_last_synced_at")
    .eq("application_id", applicationId)
    .maybeSingle<IcallDetails>();
  const details = { ...assignment, ...(data || {}) };
  const completed = durationSeconds(details.icall_hours_completed);
  const total = durationSeconds(details.icall_hours_allotted);
  const percentage = total > 0 ? Math.min(100, Math.max(0, Math.round((completed / total) * 100))) : details.training_status === "completed" ? 100 : 0;
  const examResult = details.exam_status === "passed" ? "Passed" : details.exam_status === "failed" ? "Failed" : "Not attempted";

  return <div className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <p className="text-[9px] font-semibold uppercase tracking-[.08em] text-blue-700">Live iCall API status</p>
        <h4 className="mt-1 text-[13px] font-semibold text-[#0F172A]">{details.icall_candidate_name || "POSP training account"}</h4>
        <p className="mt-1 text-[9.5px] text-[#64748B]">Login ID {details.icall_login_id || "-"}{details.icall_internal_pos_code ? ` · Internal code ${details.icall_internal_pos_code}` : ""}</p>
      </div>
      <span className={`rounded-full px-3 py-1.5 text-[9px] font-semibold ${details.training_status === "completed" ? "bg-emerald-100 text-emerald-700" : details.training_status === "expired" ? "bg-red-100 text-red-700" : "bg-blue-100 text-blue-700"}`}>{friendly(details.training_status)}</span>
    </div>

    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Metric label="Total training" value={details.icall_hours_allotted || "-"} hint="Hours allotted" />
      <Metric label="Completed" value={details.icall_hours_completed || "-"} hint={`${percentage}% complete`} />
      <Metric label="Remaining" value={details.icall_hours_remaining || "-"} hint="Time remaining" />
      <Metric label="Exam" value={examResult} hint={details.exam_score != null ? `Score ${details.exam_score}` : "No score yet"} />
    </div>

    <div className="overflow-hidden rounded-2xl border border-[#DCE5EF] bg-[#F8FAFC]">
      <div className="h-2 bg-[#E2E8F0]"><div className="h-full rounded-r-full bg-[#2563EB] transition-all" style={{ width: `${percentage}%` }} /></div>
      <div className="grid gap-px bg-[#E2E8F0] sm:grid-cols-2 xl:grid-cols-4">
        <Detail label="Issue date" value={formatDate(details.icall_issue_date || details.training_assigned_at)} />
        <Detail label="Expiry date" value={formatDate(details.icall_expiry_date || details.training_deadline)} />
        <Detail label="Training started" value={formatDateTime(details.training_started_at)} />
        <Detail label="Training completed" value={formatDateTime(details.training_completed_at)} />
        <Detail label="Registered mobile" value={details.icall_mobile_number || "-"} />
        <Detail label="Exam completion" value={formatDateTime(details.exam_completed_at)} />
        <Detail label="Exam score" value={details.exam_score != null ? String(details.exam_score) : "-"} />
        <Detail label="Last synced" value={formatDateTime(details.icall_last_synced_at)} />
      </div>
    </div>

    <div className="flex flex-wrap gap-2">
      <a href={details.training_url || "https://www.icallinsurance.com/"} target="_blank" rel="noreferrer" className="inline-flex h-10 items-center justify-center rounded-xl bg-[#071D49] px-4 text-[10px] font-semibold text-white">Open training</a>
      <form action={syncIcallUatStatus}>
        <input type="hidden" name="application_id" value={applicationId} />
        <FormSubmitButton label="Sync latest status" pendingLabel="Syncing" className="h-10 rounded-xl border border-blue-200 bg-white px-4 text-[10px] font-semibold text-blue-800" />
      </form>
    </div>
  </div>;
}

function Metric({ label, value, hint }: { label: string; value: string; hint: string }) {
  return <div className="rounded-2xl border border-[#DCE5EF] bg-white p-4"><p className="text-[8.5px] font-semibold uppercase tracking-[.06em] text-[#7A8798]">{label}</p><p className="mt-2 text-[18px] font-semibold text-[#0F172A]">{value}</p><p className="mt-1 text-[8.5px] text-[#64748B]">{hint}</p></div>;
}

function Detail({ label, value }: { label: string; value: string }) {
  return <div className="bg-white px-4 py-3"><p className="text-[8px] font-semibold uppercase tracking-[.06em] text-[#7A8798]">{label}</p><p className="mt-1.5 break-words text-[10px] font-medium text-[#0F172A]">{value}</p></div>;
}

function durationSeconds(value: string | null | undefined) {
  if (!value) return 0;
  const parts = value.split(":").map(Number);
  if (parts.some((part) => !Number.isFinite(part))) return 0;
  if (parts.length === 2) return parts[0] * 3600 + parts[1] * 60;
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  return 0;
}

function friendly(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatDate(value: string | null | undefined) {
  if (!value) return "-";
  const date = new Date(value.length === 10 ? `${value}T00:00:00` : value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" }).format(date);
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(date);
}
