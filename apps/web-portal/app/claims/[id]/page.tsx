import { notFound } from "next/navigation";
import { advanceClaimWorkflow, requestFinalDocuments, reviewClaimDocument } from "@/app/actions";
import { AppShell } from "@/components/shell";
import { StatusBadge } from "@/components/ui";
import { createServerSupabaseClient, getAuthenticatedProfile, getServerAccessToken } from "@/lib/auth-server";
import { actionForStatus, isDocumentVerificationPending, managerTransitions, stageAgeLabel, type ClaimStatus } from "@/lib/claim-workflow";
import { canUpdateClaimStage, canVerifyClaimDocuments } from "@/lib/roles";

type ClaimDetail = {
  id: string;
  claim_no: string;
  customer_id: string;
  current_status: ClaimStatus;
  accident_at: string | null;
  accident_location: string | null;
  accident_description: string | null;
  estimated_loss: number | null;
  approved_amount: number | null;
  settlement_amount: number | null;
  updated_at: string | null;
  created_at: string | null;
  customers: { company_name: string | null; contact_name: string; phone: string | null; email: string | null } | null;
  vehicles: { vehicle_no: string; vehicle_type: string | null; make: string | null; model: string | null } | null;
  policies: { policy_no: string; policy_type: string | null; start_date: string | null; end_date: string | null } | null;
  insurance_companies: { name: string; contact_email: string | null; contact_phone: string | null } | null;
  garages: { name: string } | null;
  surveyors: { name: string } | null;
};

type ClaimDocument = {
  id: string;
  document_type: string;
  file_name: string;
  storage_bucket: string;
  storage_path: string;
  verification_status: "pending" | "verified" | "rejected";
  rejection_reason: string | null;
  created_at: string | null;
};

type ClaimHistory = { id: string; to_status: string; from_status: string | null; notes: string | null; created_at: string | null };
type ClaimTask = { id: string; title: string; description: string | null; status: string; created_at: string | null };
type ClaimStageDetail = { id: string; stage: string; details: Record<string, unknown> | null; created_at: string | null };

export default async function ClaimDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();
  const accessToken = await getServerAccessToken();
  const { profile } = await getAuthenticatedProfile(accessToken);
  const canReviewDocuments = canVerifyClaimDocuments(profile?.role);
  const canAdvanceWorkflow = canUpdateClaimStage(profile?.role);

  const [{ data: claim, error }, { data: documents }, { data: history }, { data: tasks }, { data: stageDetails }] = await Promise.all([
    supabase
      .from("claims")
      .select("id, claim_no, customer_id, current_status, accident_at, accident_location, accident_description, estimated_loss, approved_amount, settlement_amount, updated_at, created_at, customers(company_name, contact_name, phone, email), vehicles(vehicle_no, vehicle_type, make, model), policies(policy_no, policy_type, start_date, end_date), insurance_companies(name, contact_email, contact_phone), garages(name), surveyors(name)")
      .eq("id", id)
      .maybeSingle<ClaimDetail>(),
    supabase.from("claim_documents").select("id, document_type, file_name, storage_bucket, storage_path, verification_status, rejection_reason, created_at").eq("claim_id", id).order("created_at", { ascending: false }).returns<ClaimDocument[]>(),
    supabase.from("claim_status_history").select("id, to_status, from_status, notes, created_at").eq("claim_id", id).order("created_at", { ascending: false }).returns<ClaimHistory[]>(),
    supabase.from("claim_tasks").select("id, title, description, status, created_at").eq("claim_id", id).order("created_at", { ascending: false }).returns<ClaimTask[]>(),
    supabase.from("claim_stage_details").select("id, stage, details, created_at").eq("claim_id", id).order("created_at", { ascending: false }).returns<ClaimStageDetail[]>()
  ]);

  if (error || !claim) notFound();

  const documentRows = await Promise.all((documents ?? []).map(async (document) => {
    const { data } = await supabase.storage.from(document.storage_bucket).createSignedUrl(document.storage_path, 600);
    return { ...document, signedUrl: data?.signedUrl ?? null };
  }));
  const action = actionForStatus(claim.current_status);
  const nextStatus = managerTransitions[claim.current_status];

  return (
    <AppShell title={`Claim ${claim.claim_no}`}>
      <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-bold uppercase tracking-wide text-blue-700">Claim workspace</p>
          <h1 className="mt-2 text-3xl font-black tracking-tight text-navy-900">{claim.claim_no}</h1>
          <p className="mt-2 text-sm text-slate-500">{claim.vehicles?.vehicle_no ?? "Vehicle"} | {stageAgeLabel(claim.updated_at ?? claim.created_at)}</p>
        </div>
        <StatusBadge status={claim.current_status} />
      </div>

      <div className="grid gap-5 xl:grid-cols-[1fr_380px]">
        <div className="space-y-5">
          <section className="overflow-hidden rounded-[2rem] border border-blue-100 bg-gradient-to-br from-blue-50 via-white to-emerald-50 p-5 shadow-soft">
            <div className="flex flex-wrap items-start justify-between gap-4 border-b border-blue-100 pb-4">
              <div>
                <h2 className="text-xl font-black text-navy-900">Commercial vehicle claim</h2>
                <p className="mt-1 text-sm leading-6 text-slate-600">{claim.accident_description ?? "No accident description recorded."}</p>
              </div>
              <StatusBadge status={claim.current_status} />
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              <Info label="Customer" value={claim.customers?.company_name ?? claim.customers?.contact_name} />
              <Info label="Phone" value={claim.customers?.phone} />
              <Info label="Email" value={claim.customers?.email} />
              <Info label="Vehicle" value={claim.vehicles?.vehicle_no} />
              <Info label="Vehicle type" value={claim.vehicles?.vehicle_type} />
              <Info label="Model" value={[claim.vehicles?.make, claim.vehicles?.model].filter(Boolean).join(" ")} />
              <Info label="Policy" value={claim.policies?.policy_no} />
              <Info label="Insurer" value={claim.insurance_companies?.name} />
              <Info label="Accident date" value={claim.accident_at ? new Date(claim.accident_at).toLocaleString("en-IN") : null} />
              <Info label="Location" value={claim.accident_location} />
              <Info label="Estimated loss" value={currency(claim.estimated_loss)} />
              <Info label="Approved / settlement" value={`${currency(claim.approved_amount)} / ${currency(claim.settlement_amount)}`} />
            </div>
          </section>

          <section className="rounded-3xl border border-amber-100 bg-amber-50/40 p-5 shadow-sm">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-black text-navy-900">Document checklist</h2>
                <p className="mt-1 text-sm text-slate-600">Open customer files, verify valid documents, or request corrected reupload.</p>
              </div>
              {isDocumentVerificationPending(claim.current_status) ? <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800">Review needed</span> : null}
            </div>
            <div className="space-y-3">
              {documentRows.length ? documentRows.map((document) => (
                <div key={document.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-black text-navy-900">{document.document_type}</p>
                      <p className="mt-1 text-xs text-slate-500">{document.file_name}</p>
                      {document.rejection_reason ? <p className="mt-2 text-xs font-semibold text-red-600">{document.rejection_reason}</p> : null}
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusBadge status={document.verification_status} />
                      {document.signedUrl ? <a className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700" href={document.signedUrl} target="_blank" rel="noreferrer">Open</a> : null}
                    </div>
                  </div>
                  {canReviewDocuments && document.verification_status !== "verified" ? (
                    <div className="mt-3 grid gap-2 lg:grid-cols-2">
                      <form action={reviewClaimDocument.bind(null, claim.id, document.id, "verified")}>
                        <button className="w-full rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white" type="submit">Verify</button>
                      </form>
                      <form action={reviewClaimDocument.bind(null, claim.id, document.id, "rejected")} className="grid gap-2">
                        <textarea name="reason" className="min-h-20" placeholder="Reason for reupload" />
                        <button className="rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-bold text-red-700" type="submit">Request reupload</button>
                      </form>
                    </div>
                  ) : null}
                </div>
              )) : <EmptyPanel title="No documents uploaded" body="Customer uploaded files will appear here." />}
            </div>
          </section>

          <section className="rounded-3xl border border-violet-100 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-black text-navy-900">Claim journey</h2>
            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {journey.map((step, index) => <JourneyStep key={step.label} step={step.label} state={step.statuses.includes(claim.current_status) ? "current" : index < currentJourneyIndex(claim.current_status) ? "complete" : "pending"} />)}
            </div>
          </section>
        </div>

        <aside className="space-y-5">
          <section className="rounded-3xl border border-blue-100 bg-white p-5 shadow-soft">
            <p className="text-xs font-bold uppercase tracking-wide text-blue-700">Next allowed action</p>
            <h2 className="mt-2 text-xl font-black text-navy-900">{action?.title ?? "No manager action"}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">{action?.body ?? "This claim is complete or waiting for another party."}</p>
            {canAdvanceWorkflow && claim.current_status === "Vehicle Inspected" ? <RequestFinalDocumentsForm claimId={claim.id} /> : null}
            {canAdvanceWorkflow && nextStatus ? <AdvanceForm claimId={claim.id} currentStatus={claim.current_status} nextStatus={nextStatus} /> : null}
          </section>

          <TimelineCard title="Manager updates" rows={(stageDetails ?? []).map((item) => ({ id: item.id, title: item.stage, body: formatDetails(item.details), date: item.created_at }))} empty="No manager details recorded yet." />
          <TimelineCard title="Follow-ups" rows={(tasks ?? []).map((item) => ({ id: item.id, title: item.title, body: item.status, date: item.created_at }))} empty="No follow-up tasks yet." />
          <TimelineCard title="Status history" rows={(history ?? []).map((item) => ({ id: item.id, title: item.to_status, body: item.notes ?? "Status changed", date: item.created_at }))} empty="No status history yet." />
        </aside>
      </div>
    </AppShell>
  );
}

function Info({ label, value }: { label: string; value?: string | number | null }) {
  return <div className="rounded-2xl border border-slate-200 bg-white/80 p-4"><dt className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</dt><dd className="mt-1 text-sm font-black text-navy-900">{value || "-"}</dd></div>;
}

function EmptyPanel({ title, body }: { title: string; body: string }) {
  return <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-center"><p className="font-black text-navy-900">{title}</p><p className="mt-1 text-sm text-slate-500">{body}</p></div>;
}

function RequestFinalDocumentsForm({ claimId }: { claimId: string }) {
  return (
    <form action={requestFinalDocuments.bind(null, claimId)} className="mt-4 grid gap-3">
      <textarea name="notes" placeholder="Request notes for customer" />
      <button className="rounded-xl bg-blue-700 px-4 py-3 text-sm font-bold text-white" type="submit">Request final documents</button>
    </form>
  );
}

function AdvanceForm({ claimId, currentStatus, nextStatus }: { claimId: string; currentStatus: ClaimStatus; nextStatus: ClaimStatus }) {
  const fields = fieldsForStatus(currentStatus);
  return (
    <form action={advanceClaimWorkflow.bind(null, claimId)} className="mt-4 grid gap-3">
      <input type="hidden" name="next_status" value={nextStatus} />
      {fields.map((field) => <input key={field.name} name={field.name} placeholder={field.label} type={field.type ?? "text"} />)}
      <textarea name="notes" placeholder="Manager note" />
      <button className="rounded-xl bg-blue-700 px-4 py-3 text-sm font-bold text-white" type="submit">{buttonLabel(currentStatus, nextStatus)}</button>
    </form>
  );
}

function TimelineCard({ title, rows, empty }: { title: string; rows: Array<{ id: string; title: string; body: string; date: string | null }>; empty: string }) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-black text-navy-900">{title}</h2>
      <div className="mt-4 space-y-3">
        {rows.length ? rows.map((row) => <div key={row.id} className="rounded-2xl bg-slate-50 p-3"><p className="font-bold text-navy-900">{row.title}</p><p className="mt-1 text-sm text-slate-600">{row.body}</p><p className="mt-2 text-xs text-slate-400">{formatDate(row.date)}</p></div>) : <p className="text-sm text-slate-500">{empty}</p>}
      </div>
    </section>
  );
}

function JourneyStep({ step, state }: { step: string; state: "complete" | "current" | "pending" }) {
  const style = state === "complete" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : state === "current" ? "border-blue-200 bg-blue-50 text-blue-700" : "border-slate-200 bg-slate-50 text-slate-500";
  return <div className={`rounded-2xl border p-3 text-sm font-bold ${style}`}>{step}</div>;
}

const journey: { label: string; statuses: ClaimStatus[] }[] = [
  { label: "Accident", statuses: ["Accident Reported"] },
  { label: "Initial documents", statuses: ["Initial Documents Pending", "Initial Documents Verification Pending", "Initial Documents Submitted", "Initial Documents Verified", "Documents Pending", "Documents Submitted"] },
  { label: "Survey", statuses: ["Surveyor Appointed", "Vehicle Inspected"] },
  { label: "Final documents", statuses: ["Final Documents Awaited", "Final Documents Verification Pending", "Final Documents Submitted", "Final Documents Verified"] },
  { label: "Claim intimation", statuses: ["Claim Intimated", "Claim Intimation"] },
  { label: "Final survey", statuses: ["Final Surveyor Details", "Survey Status", "Survey Done"] },
  { label: "Work approval", statuses: ["Work Approval Status", "Work Approval Received", "Estimate Submitted", "Approval Pending"] },
  { label: "Repair", statuses: ["Under Repair", "Repair Started", "Repair Completed"] },
  { label: "RA / DO", statuses: ["RA Intimation", "RA Intimation Done", "DO Status", "DO Submitted", "Final Bill Submitted"] },
  { label: "Payment", statuses: ["Payment Stage", "Settlement Under Process"] },
  { label: "Closed", statuses: ["Claim Complete", "Settled", "Rejected", "Closed"] }
];

function currentJourneyIndex(status: ClaimStatus) {
  return Math.max(0, journey.findIndex((item) => item.statuses.includes(status)));
}

function fieldsForStatus(status: ClaimStatus) {
  if (status === "Initial Documents Verified") return [{ name: "surveyor_name", label: "Surveyor name" }, { name: "surveyor_phone", label: "Surveyor phone" }, { name: "surveyor_email", label: "Surveyor email", type: "email" }];
  if (status === "Claim Intimation") return [{ name: "final_surveyor_name", label: "Final surveyor name" }, { name: "final_surveyor_phone", label: "Final surveyor phone" }, { name: "final_surveyor_email", label: "Final surveyor email", type: "email" }];
  if (status === "RA Intimation") return [{ name: "parts_amount", label: "Parts amount", type: "number" }, { name: "labour_amount", label: "Labour amount", type: "number" }, { name: "gst_amount", label: "GST amount", type: "number" }];
  if (status === "DO Status") return [{ name: "do_amount", label: "DO amount", type: "number" }];
  if (status === "Payment Stage") return [{ name: "do_amount", label: "DO amount", type: "number" }, { name: "bill_amount", label: "Bill amount", type: "number" }, { name: "payment_advice_ref", label: "Payment advice reference" }];
  if (status === "Claim Complete") return [{ name: "received_amount", label: "Received amount", type: "number" }, { name: "tds_amount", label: "TDS", type: "number" }, { name: "gst_tds_amount", label: "GST TDS", type: "number" }, { name: "utr_no", label: "UTR number" }];
  return [];
}

function buttonLabel(currentStatus: ClaimStatus, nextStatus: ClaimStatus) {
  if (currentStatus === "Initial Documents Verified") return "Appoint surveyor";
  if (currentStatus === "Claim Intimation") return "Save final surveyor details";
  if (currentStatus === "RA Intimation") return "RA intimation done";
  if (currentStatus === "DO Status") return "Submit DO status";
  if (currentStatus === "Payment Stage") return "Complete payment stage";
  if (currentStatus === "Claim Complete") return "Close claim";
  return `Move to ${nextStatus}`;
}

function currency(value: number | null) {
  return value == null ? "-" : new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(value);
}

function formatDate(date?: string | null) {
  return date ? new Date(date).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "-";
}

function formatDetails(details: Record<string, unknown> | null) {
  if (!details) return "-";
  return Object.entries(details).filter(([, value]) => value !== null && value !== "").map(([key, value]) => `${humanize(key)}: ${String(value)}`).join(" | ") || "-";
}

function humanize(key: string) {
  return key.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

