import { FileText, Phone, ShieldCheck, UserRound } from "lucide-react";
import { AppShell } from "@/components/shell";
import { PolicyIntakeDocumentButton } from "@/components/policy-intake-document-button";
import { PolicyIntakeHandoffButton } from "@/components/policy-intake-handoff-button";
import { PolicyIntakeResponseUpload } from "@/components/policy-intake-response-upload";
import { PolicyIntakeReviewActions } from "@/components/policy-intake-review-actions";
import { hasEffectiveCapability } from "@/lib/effective-permissions";
import { requirePolicyIntakeViewer } from "@/lib/policy-intake-server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import type { PolicyIntakeOcrField } from "@/app/policy-intakes/ocr-actions";

export const dynamic = "force-dynamic";

type Intake = {
  id: string;
  intake_number: string;
  status: string;
  lead_source_name: string;
  lead_source_type: string;
  lead_source_code: string | null;
  customer_mobile: string;
  matched_customer_id: string | null;
  file_name: string;
  ocr_status: string;
  ocr_fields: PolicyIntakeOcrField[];
  ocr_warnings: string[];
  attention_reason: string | null;
  created_at: string;
  submitted_by_profile_id: string;
  assigned_to_profile_id: string | null;
  final_policy_id: string | null;
};

type ProfileName = { id: string; full_name: string };

const vehicleKeys = [
  "vehicle_registration_status",
  "vehicle_registration_number",
  "vehicle_class",
  "vehicle_make",
  "vehicle_model",
  "vehicle_fuel_type",
  "vehicle_manufacturing_year",
  "vehicle_capacity",
  "vehicle_chassis_number",
  "vehicle_engine_number",
  "vehicle_rto_name",
  "vehicle_rto_state",
];
const policyKeys = [
  "policy_product",
  "policy_number",
  "insurer_name",
  "idv",
  "od_premium",
  "tp_premium",
  "cpa_premium",
  "cpa_opted",
  "policy_start_date",
  "policy_end_date",
  "total_premium",
  "tax_amount",
  "gross_premium",
];

function statusLabel(row: Intake) {
  if (row.status === "processing" && row.ocr_status === "failed") return "Manual review required";
  return ({ processing: "Fetching policy & vehicle details", ready_for_review: "Ready for review", in_review: "In review", needs_attention: "Needs attention", completed: "Completed", rejected: "Rejected" } as Record<string, string>)[row.status] ?? row.status;
}
function statusClass(row: Intake) {
  if (row.status === "processing" && row.ocr_status === "failed") return "bg-amber-50 text-amber-800";
  return ({ processing: "bg-blue-50 text-blue-700", ready_for_review: "bg-indigo-50 text-indigo-700", in_review: "bg-violet-50 text-violet-700", needs_attention: "bg-amber-50 text-amber-800", completed: "bg-emerald-50 text-emerald-700", rejected: "bg-rose-50 text-rose-700" } as Record<string, string>)[row.status] ?? "bg-slate-50 text-slate-700";
}
function ocrLabel(status: string) { return status === "completed" ? "Details fetched" : status === "failed" ? "Manual review" : status === "processing" ? "Fetching details" : "Queued"; }

export default async function PolicyIntakeDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile = await requirePolicyIntakeViewer();
  const [reviewer, finalizer] = await Promise.all([
    hasEffectiveCapability(profile, "review_policy_intakes", "edit"),
    hasEffectiveCapability(profile, "finalize_policy_intakes", "approve"),
  ]);
  const admin = createSupabaseAdminClient();
  const { data } = await admin.from("policy_intake_requests").select("id,intake_number,status,lead_source_name,lead_source_type,lead_source_code,customer_mobile,matched_customer_id,file_name,ocr_status,ocr_fields,ocr_warnings,attention_reason,created_at,submitted_by_profile_id,assigned_to_profile_id,final_policy_id").eq("id", id).maybeSingle<Intake>();
  if (!data) return <AppShell title="Policy Intake" backHref="/policy-intakes"><div className="rounded-xl bg-white p-5 text-[11px]">Intake not found.</div></AppShell>;
  const owner = data.submitted_by_profile_id === profile.id;
  if (!reviewer && !finalizer && !owner) return <AppShell title="Policy Intake" backHref="/policy-intakes"><div className="rounded-xl bg-white p-5 text-[11px]">You do not have access to this intake.</div></AppShell>;

  const profileIds = Array.from(new Set([data.submitted_by_profile_id, data.assigned_to_profile_id].filter(Boolean) as string[]));
  const { data: profileRows } = profileIds.length ? await admin.from("profiles").select("id,full_name").in("id", profileIds).returns<ProfileName[]>() : { data: [] as ProfileName[] };
  const nameById = new Map((profileRows ?? []).map((item) => [item.id, item.full_name]));
  const submittedBy = nameById.get(data.submitted_by_profile_id) || "Sales user";
  const reviewerName = data.assigned_to_profile_id ? nameById.get(data.assigned_to_profile_id) || "Operations user" : "Not claimed";
  const manualReview = data.status === "processing" && data.ocr_status === "failed";
  const fields = data.ocr_fields ?? [];
  const vehicleFields = orderedFields(fields, vehicleKeys);
  const policyFields = orderedFields(fields, policyKeys);

  return <AppShell title="Policy Intake Review" backHref="/policy-intakes">
    <div className="mx-auto grid max-w-[1360px] gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
      <main className="min-w-0 overflow-hidden rounded-2xl border border-[#DCE5EF] bg-white shadow-[0_14px_40px_rgba(15,23,42,.06)]">
        <header className="border-b border-[#E5ECF5] bg-[#F8FAFC] px-4 py-3.5 sm:px-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div><p className="text-[8px] font-bold uppercase tracking-[.12em] text-[#64748B]">Policy Intake Review</p><h1 className="mt-1 text-[17px] font-semibold text-[#0F172A]">{data.intake_number}</h1><p className="mt-1 text-[9px] text-[#64748B]">Submitted by <span className="font-semibold text-[#334155]">{submittedBy}</span> · {new Date(data.created_at).toLocaleString("en-IN")}</p></div>
            <span className={`inline-flex self-start rounded-full px-2.5 py-1 text-[8.5px] font-bold ${statusClass(data)}`}>{statusLabel(data)}</span>
          </div>
          <div className="mt-3 grid gap-2 border-t border-[#E5ECF5] pt-3 sm:grid-cols-3">
            <HeaderMeta icon={<Phone className="h-3.5 w-3.5" />} label="Customer" value={data.customer_mobile} hint={data.matched_customer_id ? "Existing customer matched" : "Sales supplied"} />
            <HeaderMeta icon={<ShieldCheck className="h-3.5 w-3.5" />} label="Lead source" value={data.lead_source_name} hint={`${data.lead_source_type.toUpperCase()}${data.lead_source_code ? ` · ${data.lead_source_code}` : ""}`} />
            <HeaderMeta icon={<FileText className="h-3.5 w-3.5" />} label="Policy copy" value={data.file_name} hint="Original source document" />
          </div>
          {data.attention_reason ? <div className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-[9px] font-medium text-amber-900">Operations note: {data.attention_reason}</div> : null}
        </header>

        <ReviewSection number="01" title="Source & customer" subtitle="Details supplied by Sales before automatic policy reading.">
          <ReviewField label="Submitted by" value={submittedBy} source="Sales" />
          <ReviewField label="Customer mobile" value={data.customer_mobile} source="Sales" />
          <ReviewField label="Lead source" value={data.lead_source_name} source="Sales" />
          <ReviewField label="Intermediary" value={`${data.lead_source_type.toUpperCase()}${data.lead_source_code ? ` · ${data.lead_source_code}` : ""}`} source="Sales" />
        </ReviewSection>

        <ReviewSection number="02" title="Vehicle details" subtitle={data.ocr_status === "completed" ? "Fetched from the uploaded policy copy for Operations review." : "Vehicle information will appear here when available."}>
          {vehicleFields.length ? vehicleFields.map((item) => <ReviewField key={item.key} label={item.label} value={item.value} source="OCR" confidence={item.confidence} />) : <SectionEmpty text={manualReview ? "Automatic vehicle extraction was unavailable. Use the saved policy copy during onboarding." : "Fetching vehicle details from the saved policy copy…"} />}
        </ReviewSection>

        <ReviewSection number="03" title="Policy & premium" subtitle={data.ocr_status === "completed" ? "Proposal only. Operations confirms these values in Policy Onboarding." : "Policy and premium information will appear here when available."}>
          {policyFields.length ? policyFields.map((item) => <ReviewField key={item.key} label={item.label} value={item.value} source="OCR" confidence={item.confidence} />) : <SectionEmpty text={manualReview ? "Automatic policy extraction was unavailable. Continue with manual review from the policy copy." : "Fetching policy and premium details…"} />}
        </ReviewSection>

        {data.ocr_warnings?.length ? <div className="border-t border-[#E5ECF5] bg-amber-50/60 px-4 py-3 sm:px-5"><p className="text-[8px] font-bold uppercase tracking-[.08em] text-amber-800">Review notes</p>{data.ocr_warnings.map((warning) => <p key={warning} className="mt-1 text-[9px] leading-4 text-amber-900">{warning}</p>)}</div> : null}
      </main>

      <aside className="space-y-3 xl:sticky xl:top-[88px] xl:self-start">
        <section className="rounded-2xl border border-[#DCE5EF] bg-white p-3 shadow-sm">
          <div className="flex items-start gap-2"><FileText className="mt-0.5 h-4 w-4 text-[#315B9A]" /><div className="min-w-0"><p className="text-[8px] font-bold uppercase tracking-[.08em] text-[#64748B]">Policy copy</p><p className="mt-1 truncate text-[9px] font-semibold text-[#334155]">{data.file_name}</p></div></div>
          <div className="mt-2.5"><PolicyIntakeDocumentButton id={data.id} /></div>
        </section>
        <section className="rounded-2xl border border-[#DCE5EF] bg-white p-3 shadow-sm">
          <p className="text-[8px] font-bold uppercase tracking-[.08em] text-[#64748B]">Review status</p>
          <div className="mt-2 space-y-2 text-[9px]"><SideMeta label="Workflow" value={statusLabel(data)} /><SideMeta label="Detail fetch" value={ocrLabel(data.ocr_status)} /><SideMeta label="Reviewer" value={reviewerName} /></div>
        </section>
        {owner && data.status === "needs_attention" ? <PolicyIntakeResponseUpload id={data.id} /> : null}
        {reviewer && !["completed", "rejected"].includes(data.status) ? <PolicyIntakeReviewActions id={data.id} /> : null}
        {finalizer && (!["completed", "rejected", "needs_attention", "processing"].includes(data.status) || manualReview) ? <PolicyIntakeHandoffButton id={data.id} /> : null}
        <div className="rounded-xl bg-[#F3F7FB] px-3 py-2.5 text-[8.5px] leading-4 text-[#64748B]"><UserRound className="mb-1.5 h-3.5 w-3.5 text-[#315B9A]" />This is a pre-onboarding review sheet. The saved policy copy remains the source document; final corrections are made in Policy Onboarding.</div>
      </aside>
    </div>
  </AppShell>;
}

function orderedFields(fields: PolicyIntakeOcrField[], order: string[]) {
  const byKey = new Map(fields.map((field) => [field.key, field]));
  return order.map((key) => byKey.get(key)).filter((field): field is PolicyIntakeOcrField => Boolean(field));
}
function HeaderMeta({ icon, label, value, hint }: { icon: React.ReactNode; label: string; value: string; hint: string }) { return <div className="flex min-w-0 items-start gap-2"><span className="mt-0.5 text-[#315B9A]">{icon}</span><div className="min-w-0"><p className="text-[7.5px] font-bold uppercase tracking-[.06em] text-[#8A96A8]">{label}</p><p className="mt-0.5 truncate text-[9.5px] font-semibold text-[#334155]">{value || "—"}</p><p className="mt-0.5 truncate text-[7.5px] text-[#8A96A8]">{hint}</p></div></div>; }
function ReviewSection({ number, title, subtitle, children }: { number: string; title: string; subtitle: string; children: React.ReactNode }) { return <section className="border-b border-[#E5ECF5] px-4 py-4 last:border-b-0 sm:px-5"><div className="mb-3 flex items-start gap-3"><span className="mt-0.5 text-[9px] font-bold tabular-nums text-[#315B9A]">{number}</span><div><h2 className="text-[12px] font-semibold text-[#17365D]">{title}</h2><p className="mt-0.5 text-[8.5px] text-[#7A8798]">{subtitle}</p></div></div><div className="grid gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{children}</div></section>; }
function ReviewField({ label, value, source, confidence }: { label: string; value: string; source: "Sales" | "OCR"; confidence?: number | null }) { const review = source === "OCR" && typeof confidence === "number" && confidence < .9; return <div className="min-w-0 py-1"><div className="flex items-center gap-1.5"><p className="text-[7.5px] font-bold uppercase tracking-[.055em] text-[#7A8798]">{label}</p><span className="rounded bg-[#EEF3F8] px-1.5 py-0.5 text-[6.5px] font-bold uppercase tracking-[.04em] text-[#60758D]">{source}</span>{review ? <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[6.5px] font-bold uppercase text-amber-800">Review</span> : null}</div><p className="mt-1 break-words text-[10.5px] font-semibold leading-4 text-[#253B59]">{value || "—"}</p>{review && typeof confidence === "number" ? <p className="mt-0.5 text-[7px] text-amber-700">{Math.round(confidence * 100)}% extraction confidence</p> : null}</div>; }
function SectionEmpty({ text }: { text: string }) { return <p className="col-span-full py-2 text-[9px] text-[#7A8798]">{text}</p>; }
function SideMeta({ label, value }: { label: string; value: string }) { return <div className="flex items-start justify-between gap-3"><span className="text-[#7A8798]">{label}</span><span className="text-right font-semibold text-[#334155]">{value}</span></div>; }
