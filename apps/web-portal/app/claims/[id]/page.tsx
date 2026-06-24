import Link from "next/link";
import { notFound } from "next/navigation";
import { advanceClaimWorkflow, requestFinalDocuments, reviewClaimDocument } from "@/app/actions";
import { AppShell } from "@/components/shell";
import { StatusBadge } from "@/components/ui";
import { createServerSupabaseClient, getAuthenticatedProfile, getServerAccessToken } from "@/lib/auth-server";
import { actionForStatus, managerTransitions, operationsQueueForStatus, requiredDocumentsForStatus, stageAgeLabel, type ClaimStatus } from "@/lib/claim-workflow";
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

type SignedClaimDocument = ClaimDocument & { signedUrl: string | null };
type ClaimHistory = { id: string; to_status: string; from_status: string | null; notes: string | null; created_at: string | null };
type ClaimTask = { id: string; title: string; description: string | null; status: string; created_at: string | null };
type ClaimStageDetail = { id: string; stage: string; details: Record<string, unknown> | null; created_at: string | null };

type VerificationItem = {
  key: string;
  title: string;
  body: string;
  icon: string;
  document?: SignedClaimDocument;
  detailValue?: string | null;
  verified?: boolean;
};

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
  const queue = operationsQueueForStatus(claim.current_status);
  const workspaceTitle = titleForWorkspace(queue?.key, queue?.label ?? claim.current_status);
  const verificationItems = buildVerificationItems(claim, documentRows);
  const verifiedCount = verificationItems.filter((item) => item.verified || item.document?.verification_status === "verified").length;

  return (
    <AppShell title={workspaceTitle}>
      <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3">
          <Link href={queue ? `/claims?queue=${queue.key}` : "/claims"} className="grid h-11 w-11 place-items-center rounded-2xl border border-slate-200 bg-white text-xl font-black text-navy-900 shadow-sm" aria-label="Back to claim queue">←</Link>
          <div>
            <p className="text-sm font-bold uppercase tracking-wide text-blue-700">Claim manager workspace</p>
            <h1 className="mt-1 text-3xl font-black tracking-tight text-navy-900">{workspaceTitle}</h1>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <StatusBadge status={claim.current_status} />
          <span className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-600 shadow-sm">{stageAgeLabel(claim.updated_at ?? claim.created_at)}</span>
        </div>
      </div>

      <section className="mb-5 rounded-[1.75rem] border border-blue-100 bg-gradient-to-r from-blue-50 via-white to-slate-50 p-4 shadow-soft">
        <div className="grid gap-3 lg:grid-cols-4">
          <SummaryTile icon="👤" label="Customer Name" value={claim.customers?.company_name ?? claim.customers?.contact_name} subValue={claim.customers?.phone} />
          <SummaryTile icon="🚙" label="Vehicle Number" value={claim.vehicles?.vehicle_no} subValue={claim.vehicles?.vehicle_type} />
          <SummaryTile icon="🚘" label="Make / Model" value={[claim.vehicles?.make, claim.vehicles?.model].filter(Boolean).join(" ")} subValue={claim.policies?.policy_type} />
          <SummaryTile icon="🛡️" label="Insurance Company" value={claim.insurance_companies?.name ?? "InsureIT"} subValue={claim.policies?.policy_no} />
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-[1fr_390px]">
        <div className="space-y-5">
          <section className="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-soft">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-2xl font-black text-navy-900">Documents & Details Verification</h2>
                <p className="mt-2 text-sm font-medium leading-6 text-slate-600">Verify all documents and details collected during this claim stage before submitting the next workflow action.</p>
              </div>
              <div className="rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-right">
                <p className="text-xs font-bold uppercase tracking-wide text-blue-700">Verified</p>
                <p className="text-xl font-black text-navy-900">{verifiedCount}/{verificationItems.length}</p>
              </div>
            </div>

            <div className="mt-5 grid gap-4 lg:grid-cols-2">
              {verificationItems.map((item, index) => (
                <VerificationCard key={item.key} item={item} index={index + 1} claimId={claim.id} canReviewDocuments={canReviewDocuments} />
              ))}
            </div>

            <div className="mt-5 grid gap-3 lg:grid-cols-[1fr_auto] lg:items-end">
              <label className="block">
                <span className="text-sm font-bold text-navy-900">Remarks (Optional)</span>
                <textarea name="workspace_notes" className="mt-2 min-h-16" placeholder="Enter remarks here..." />
              </label>
              <div className="min-w-64">
                {canAdvanceWorkflow && claim.current_status === "Vehicle Inspected" ? <RequestFinalDocumentsForm claimId={claim.id} compact /> : null}
                {canAdvanceWorkflow && nextStatus ? <AdvanceForm claimId={claim.id} currentStatus={claim.current_status} nextStatus={nextStatus} compact /> : null}
                {!nextStatus && claim.current_status !== "Vehicle Inspected" ? <button className="w-full rounded-xl bg-slate-200 px-5 py-3 text-sm font-bold text-slate-500" type="button" disabled>No proceed action</button> : null}
              </div>
            </div>
          </section>

          <section className="rounded-[1.75rem] border border-blue-100 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-black text-navy-900">Claim journey</h2>
            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {journey.map((step, index) => <JourneyStep key={step.label} step={step.label} state={step.statuses.includes(claim.current_status) ? "current" : index < currentJourneyIndex(claim.current_status) ? "complete" : "pending"} />)}
            </div>
          </section>
        </div>

        <aside className="space-y-5">
          <section className="rounded-[1.75rem] border border-blue-100 bg-white p-5 shadow-soft">
            <p className="text-xs font-bold uppercase tracking-wide text-blue-700">Next allowed action</p>
            <h2 className="mt-2 text-xl font-black text-navy-900">{action?.title ?? "No manager action"}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">{action?.body ?? "This claim is complete or waiting for another party."}</p>
            <div className="mt-4 grid gap-2 rounded-2xl bg-slate-50 p-4 text-sm text-slate-700">
              <InfoLine label="Claim No." value={claim.claim_no} />
              <InfoLine label="Loss Date" value={claim.accident_at ? new Date(claim.accident_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : null} />
              <InfoLine label="Estimated Loss" value={currency(claim.estimated_loss)} />
              <InfoLine label="Approved" value={currency(claim.approved_amount)} />
              <InfoLine label="Settlement" value={currency(claim.settlement_amount)} />
            </div>
          </section>

          <TimelineCard title="Manager updates" rows={(stageDetails ?? []).map((item) => ({ id: item.id, title: item.stage, body: formatDetails(item.details), date: item.created_at }))} empty="No manager details recorded yet." />
          <TimelineCard title="Follow-ups" rows={(tasks ?? []).map((item) => ({ id: item.id, title: item.title, body: item.status, date: item.created_at }))} empty="No follow-up tasks yet." />
          <TimelineCard title="Status history" rows={(history ?? []).map((item) => ({ id: item.id, title: item.to_status, body: item.notes ?? "Status changed", date: item.created_at }))} empty="No status history yet." />
        </aside>
      </div>
    </AppShell>
  );
}

function SummaryTile({ icon, label, value, subValue }: { icon: string; label: string; value?: string | null; subValue?: string | null }) {
  return (
    <div className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white/80 p-4">
      <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-blue-50 text-2xl text-navy-900">{icon}</div>
      <div className="min-w-0">
        <p className="text-xs font-bold text-blue-700">{label}</p>
        <p className="mt-1 truncate text-base font-black text-navy-900">{value || "-"}</p>
        {subValue ? <p className="mt-0.5 truncate text-sm font-semibold text-slate-600">{subValue}</p> : null}
      </div>
    </div>
  );
}

function VerificationCard({ item, index, claimId, canReviewDocuments }: { item: VerificationItem; index: number; claimId: string; canReviewDocuments: boolean }) {
  const document = item.document;
  const isVerified = item.verified || document?.verification_status === "verified";
  const isRejected = document?.verification_status === "rejected";

  return (
    <div className="rounded-[1.5rem] border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start gap-4">
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-violet-50 text-lg font-black text-blue-700">{index}</div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <h3 className="text-lg font-black text-navy-900">{item.title}</h3>
            <span className={`rounded-full px-3 py-1 text-xs font-black ${isVerified ? "bg-emerald-50 text-emerald-700" : isRejected ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-700"}`}>{isVerified ? "Verified" : isRejected ? "Replace needed" : document ? "Pending" : "Missing"}</span>
          </div>
          <div className="mt-4 flex gap-4">
            <div className="grid h-24 w-28 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-blue-50 to-violet-50 text-4xl">{item.icon}</div>
            <div className="min-w-0 flex-1 text-sm">
              <p className="truncate font-bold text-navy-900">{document?.file_name ?? item.detailValue ?? "No file uploaded"}</p>
              <p className={`mt-1 font-bold ${document?.signedUrl || isVerified ? "text-emerald-700" : "text-slate-500"}`}>{document?.signedUrl ? "Preview available" : isVerified ? "Verified" : item.body}</p>
              <p className="mt-3 text-slate-600">{document?.created_at ? `Uploaded on ${formatDate(document.created_at)}` : item.detailValue ? "Claim detail available" : "Awaiting customer upload"}</p>
              {document?.rejection_reason ? <p className="mt-2 text-xs font-semibold text-red-600">{document.rejection_reason}</p> : null}
            </div>
          </div>

          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            {canReviewDocuments && document && document.verification_status !== "verified" ? (
              <form action={reviewClaimDocument.bind(null, claimId, document.id, "verified")}> 
                <button className="w-full rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm font-black text-emerald-700" type="submit">Verify</button>
              </form>
            ) : <button className="rounded-xl border border-emerald-100 bg-emerald-50/60 px-3 py-2.5 text-sm font-black text-emerald-700" type="button" disabled>{isVerified ? "Verified" : "Verify"}</button>}
            {document?.signedUrl ? <a className="rounded-xl border border-blue-200 bg-white px-3 py-2.5 text-center text-sm font-black text-blue-700" href={document.signedUrl} target="_blank" rel="noreferrer">Reload</a> : <button className="rounded-xl border border-blue-100 bg-slate-50 px-3 py-2.5 text-sm font-black text-slate-400" type="button" disabled>Reload</button>}
            {canReviewDocuments && document && document.verification_status !== "verified" ? (
              <form action={reviewClaimDocument.bind(null, claimId, document.id, "rejected")}> 
                <input type="hidden" name="reason" value={`Replacement requested for ${document.document_type}.`} />
                <button className="w-full rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm font-black text-red-700" type="submit">Replace</button>
              </form>
            ) : <button className="rounded-xl border border-red-100 bg-red-50/60 px-3 py-2.5 text-sm font-black text-red-400" type="button" disabled>Replace</button>}
          </div>
        </div>
      </div>
    </div>
  );
}

function InfoLine({ label, value }: { label: string; value?: string | number | null }) {
  return <div className="flex justify-between gap-3"><span className="font-semibold text-slate-500">{label}</span><span className="text-right font-black text-navy-900">{value || "-"}</span></div>;
}

function RequestFinalDocumentsForm({ claimId, compact = false }: { claimId: string; compact?: boolean }) {
  return (
    <form action={requestFinalDocuments.bind(null, claimId)} className={compact ? "grid gap-2" : "mt-4 grid gap-3"}>
      {!compact ? <textarea name="notes" placeholder="Request notes for customer" /> : <input type="hidden" name="notes" value="Final documents requested from customer." />}
      <button className="w-full rounded-xl bg-blue-700 px-5 py-3 text-sm font-black text-white hover:bg-navy-900" type="submit">Submit & Proceed →</button>
    </form>
  );
}

function AdvanceForm({ claimId, currentStatus, nextStatus, compact = false }: { claimId: string; currentStatus: ClaimStatus; nextStatus: ClaimStatus; compact?: boolean }) {
  const fields = fieldsForStatus(currentStatus);
  return (
    <form action={advanceClaimWorkflow.bind(null, claimId)} className={compact ? "grid gap-2" : "mt-4 grid gap-3"}>
      <input type="hidden" name="next_status" value={nextStatus} />
      {!compact ? fields.map((field) => <input key={field.name} name={field.name} placeholder={field.label} type={field.type ?? "text"} />) : null}
      {!compact ? <textarea name="notes" placeholder="Manager note" /> : <input type="hidden" name="notes" value={`Claim moved to ${nextStatus}.`} />}
      <button className="w-full rounded-xl bg-blue-700 px-5 py-3 text-sm font-black text-white hover:bg-navy-900" type="submit">{compact ? "Submit & Proceed →" : buttonLabel(currentStatus, nextStatus)}</button>
    </form>
  );
}

function TimelineCard({ title, rows, empty }: { title: string; rows: Array<{ id: string; title: string; body: string; date: string | null }>; empty: string }) {
  return (
    <section className="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm">
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
  { label: "Spot survey", statuses: ["Claim Intimated", "Surveyor Appointed", "Vehicle Inspected"] },
  { label: "Final documents", statuses: ["Final Documents Awaited", "Final Documents Verification Pending", "Final Documents Submitted", "Final Documents Verified"] },
  { label: "Claim intimation", statuses: ["Claim Intimation"] },
  { label: "Re-inspection", statuses: ["Final Surveyor Details", "Survey Status", "Survey Done"] },
  { label: "Work approval", statuses: ["Work Approval Status", "Work Approval Received", "Estimate Submitted", "Approval Pending"] },
  { label: "Repair", statuses: ["Under Repair", "Repair Started", "Repair Done", "Repair Completed"] },
  { label: "RA / DO", statuses: ["RA Intimation", "RA Intimation Done", "DO Status", "DO Submitted", "Final Bill Submitted"] },
  { label: "Payment", statuses: ["Payment Stage", "Claim Completion In Progress", "Claim Complete", "Settlement Under Process"] },
  { label: "Closed", statuses: ["Settled", "Rejected", "Closed"] }
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
  if (status === "Claim Completion In Progress") return [{ name: "received_amount", label: "Received amount", type: "number" }, { name: "tds_amount", label: "TDS", type: "number" }, { name: "gst_tds_amount", label: "GST TDS", type: "number" }, { name: "utr_no", label: "UTR number" }];
  if (status === "Claim Complete") return [{ name: "closure_note", label: "Closure note" }];
  return [];
}

function buttonLabel(currentStatus: ClaimStatus, nextStatus: ClaimStatus) {
  if (currentStatus === "Initial Documents Verified") return "Appoint surveyor";
  if (currentStatus === "Claim Intimation") return "Save final surveyor details";
  if (currentStatus === "RA Intimation") return "RA intimation done";
  if (currentStatus === "DO Status") return "Submit DO status";
  if (currentStatus === "Payment Stage") return "Complete payment stage";
  if (currentStatus === "Claim Completion In Progress") return "Record payment receipt";
  if (currentStatus === "Claim Complete") return "Close claim";
  return `Move to ${nextStatus}`;
}

function buildVerificationItems(claim: ClaimDetail, documents: SignedClaimDocument[]): VerificationItem[] {
  const documentForType = (type: string) => documents.find((document) => document.document_type === type && document.verification_status !== "rejected") ?? documents.find((document) => document.document_type === type);
  const requiredDocumentItems: VerificationItem[] = requiredDocumentsForStatus(claim.current_status).map((document) => ({
    key: document.type,
    title: documentTitleForMockup(document.type),
    body: document.body,
    icon: iconForDocument(document.type),
    document: documentForType(document.type)
  }));

  const detailItems: VerificationItem[] = [
    { key: "driver-number", title: "Driver Number", body: "Driver licence number or detail", icon: "👤", detailValue: claim.accident_description?.match(/[A-Z]{2}\d{2}\s?\d{4}\s?\d{7}/i)?.[0] ?? null, verified: Boolean(claim.accident_description) },
    { key: "loss-location", title: "Loss Location", body: "Accident or loss location", icon: "📍", detailValue: claim.accident_location, verified: Boolean(claim.accident_location) }
  ];

  return [...requiredDocumentItems, ...detailItems];
}

function documentTitleForMockup(type: string) {
  if (type === "Registration certificate") return "RC Copy";
  if (type === "Policy copy") return "Insurance Copy";
  if (type === "Driving licence") return "Driving Licence Copy";
  if (type === "GR Copy / Road Challan") return "GR / Load Challan Copy";
  return type;
}

function iconForDocument(type: string) {
  if (type === "Registration certificate") return "📄";
  if (type === "Policy copy") return "🛡️";
  if (type === "Driving licence") return "🪪";
  if (type === "GR Copy / Road Challan") return "🚚";
  if (type === "Spot Photo") return "📷";
  if (type.includes("invoice") || type.includes("estimate") || type.includes("receipt")) return "🧾";
  return "📁";
}

function titleForWorkspace(queueKey?: string, fallback?: string) {
  if (queueKey === "spot-deputation") return "Spot Survey";
  if (queueKey === "vehicle-intimation") return "Vehicle Claims Intimated";
  if (queueKey === "claim-intimation") return "Claim Intimation";
  if (queueKey === "work-approval") return "Work Approval";
  if (queueKey === "reinspection") return "Re-Inspection";
  if (queueKey === "delivery-order") return "Delivery Order";
  if (queueKey === "payment") return "Payment";
  if (queueKey === "closed-claims") return "Closed Claim";
  return fallback ?? "Claim Workspace";
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
