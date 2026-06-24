import { notFound } from "next/navigation";
import { ClaimManagerShell } from "@/components/claim-manager/claim-manager-shell";
import { ClaimSummaryStrip, ProceedPanel } from "@/components/claim-manager/summary-and-proceed";
import { VerificationCard, type VerificationDocument, type VerificationItem } from "@/components/claim-manager/verification-card";
import { createServerSupabaseClient, getAuthenticatedProfile, getServerAccessToken } from "@/lib/auth-server";
import { actionForStatus, managerTransitions, operationsQueueForStatus, requiredDocumentsForStatus, type ClaimStatus } from "@/lib/claim-workflow";
import { canUpdateClaimStage, canVerifyClaimDocuments } from "@/lib/roles";

type ClaimDetail = {
  id: string; claim_no: string; customer_id: string; current_status: ClaimStatus;
  accident_at: string | null; accident_location: string | null; accident_description: string | null;
  estimated_loss: number | null; approved_amount: number | null; settlement_amount: number | null;
  updated_at: string | null; created_at: string | null;
  customers: { company_name: string | null; contact_name: string; phone: string | null; email: string | null } | null;
  vehicles: { vehicle_no: string; vehicle_type: string | null; make: string | null; model: string | null } | null;
  policies: { policy_no: string; policy_type: string | null; start_date: string | null; end_date: string | null } | null;
  insurance_companies: { name: string; contact_email: string | null; contact_phone: string | null } | null;
};

type ClaimDocument = {
  id: string; document_type: string; file_name: string; storage_bucket: string; storage_path: string;
  verification_status: "pending" | "verified" | "rejected"; rejection_reason: string | null; created_at: string | null;
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
    supabase.from("claims").select("id, claim_no, customer_id, current_status, accident_at, accident_location, accident_description, estimated_loss, approved_amount, settlement_amount, updated_at, created_at, customers(company_name, contact_name, phone, email), vehicles(vehicle_no, vehicle_type, make, model), policies(policy_no, policy_type, start_date, end_date), insurance_companies(name, contact_email, contact_phone)").eq("id", id).maybeSingle<ClaimDetail>(),
    supabase.from("claim_documents").select("id, document_type, file_name, storage_bucket, storage_path, verification_status, rejection_reason, created_at").eq("claim_id", id).order("created_at", { ascending: false }).returns<ClaimDocument[]>(),
    supabase.from("claim_status_history").select("id, to_status, from_status, notes, created_at").eq("claim_id", id).order("created_at", { ascending: false }).returns<ClaimHistory[]>(),
    supabase.from("claim_tasks").select("id, title, description, status, created_at").eq("claim_id", id).order("created_at", { ascending: false }).returns<ClaimTask[]>(),
    supabase.from("claim_stage_details").select("id, stage, details, created_at").eq("claim_id", id).order("created_at", { ascending: false }).returns<ClaimStageDetail[]>()
  ]);
  if (error || !claim) notFound();

  const signedDocs: VerificationDocument[] = await Promise.all((documents ?? []).map(async (document) => {
    const { data } = await supabase.storage.from(document.storage_bucket).createSignedUrl(document.storage_path, 600);
    return { ...document, signedUrl: data?.signedUrl ?? null };
  }));

  const queue = operationsQueueForStatus(claim.current_status);
  const title = titleForWorkspace(queue?.key, queue?.label ?? claim.current_status);
  const backHref = queue ? `/claims?queue=${queue.key}` : "/claims";
  const action = actionForStatus(claim.current_status);
  const nextStatus = managerTransitions[claim.current_status];
  const items = buildVerificationItems(claim, signedDocs);
  const verifiedCount = items.filter((item) => item.verified || item.document?.verification_status === "verified").length;

  return (
    <ClaimManagerShell title={title} backHref={backHref}>
      <ClaimSummaryStrip claim={claim} title={title} />
      <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
        <section className="rounded-[28px] border border-[#d9e6f7] bg-white p-5 shadow-[0_18px_45px_rgba(7,29,73,0.08)]">
          <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div><h2 className="text-[26px] font-black text-[#071D49]">Documents & Details Verification</h2><p className="mt-1 text-sm font-semibold text-slate-600">Verify the claim documents exactly like the workflow checklist before proceeding.</p></div>
            <div className="rounded-2xl bg-[#EAF3FF] px-5 py-3 text-center"><p className="text-xs font-black uppercase tracking-wide text-[#174EA6]">Verified</p><p className="text-2xl font-black text-[#071D49]">{verifiedCount}/{items.length}</p></div>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">{items.map((item, index) => <VerificationCard key={item.key} item={item} index={index + 1} claimId={claim.id} canReviewDocuments={canReviewDocuments} />)}</div>
          <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_260px] lg:items-end"><label className="block"><span className="text-sm font-black text-[#071D49]">Remarks (Optional)</span><textarea name="workspace_notes" className="mt-2 min-h-20 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold outline-none focus:border-[#174EA6]" placeholder="Enter remarks here..." /></label><div>{canAdvanceWorkflow ? <ProceedPanel claimId={claim.id} currentStatus={claim.current_status} nextStatus={nextStatus} /> : <button className="w-full rounded-2xl bg-slate-200 px-6 py-4 text-sm font-black text-slate-500" type="button" disabled>No permission</button>}</div></div>
        </section>
        <aside className="space-y-5"><SideCard title={action?.title ?? "No manager action"} body={action?.body ?? "This claim is complete or waiting for another party."} claim={claim} /><MiniTimeline title="Manager Updates" rows={(stageDetails ?? []).map((item) => ({ id: item.id, title: item.stage, body: formatDetails(item.details), date: item.created_at }))} empty="No manager details recorded yet." /><MiniTimeline title="Follow-ups" rows={(tasks ?? []).map((item) => ({ id: item.id, title: item.title, body: item.status, date: item.created_at }))} empty="No follow-up tasks yet." /><MiniTimeline title="Status History" rows={(history ?? []).map((item) => ({ id: item.id, title: item.to_status, body: item.notes ?? "Status changed", date: item.created_at }))} empty="No status history yet." /></aside>
      </div>
    </ClaimManagerShell>
  );
}

function SideCard({ title, body, claim }: { title: string; body: string; claim: ClaimDetail }) {
  return <section className="rounded-[28px] border border-[#d9e6f7] bg-white p-5 shadow-[0_18px_45px_rgba(7,29,73,0.08)]"><p className="text-xs font-black uppercase tracking-[0.2em] text-[#174EA6]">Next Action</p><h3 className="mt-2 text-xl font-black text-[#071D49]">{title}</h3><p className="mt-2 text-sm font-semibold leading-6 text-slate-600">{body}</p><div className="mt-4 grid gap-2 rounded-2xl bg-[#F4F8FF] p-4 text-sm"><Info label="Claim No." value={claim.claim_no} /><Info label="Loss Date" value={claim.accident_at ? new Date(claim.accident_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : null} /><Info label="Estimated Loss" value={money(claim.estimated_loss)} /><Info label="Approved" value={money(claim.approved_amount)} /><Info label="Settlement" value={money(claim.settlement_amount)} /></div></section>;
}
function MiniTimeline({ title, rows, empty }: { title: string; rows: Array<{ id: string; title: string; body: string; date: string | null }>; empty: string }) { return <section className="rounded-[28px] border border-[#d9e6f7] bg-white p-5 shadow-sm"><h2 className="text-lg font-black text-[#071D49]">{title}</h2><div className="mt-4 space-y-3">{rows.length ? rows.map((row) => <div key={row.id} className="rounded-2xl bg-[#F4F8FF] p-3"><p className="font-black text-[#071D49]">{row.title}</p><p className="mt-1 text-sm font-semibold text-slate-600">{row.body}</p><p className="mt-2 text-xs font-bold text-slate-400">{date(row.date)}</p></div>) : <p className="text-sm font-semibold text-slate-500">{empty}</p>}</div></section>; }
function Info({ label, value }: { label: string; value?: string | number | null }) { return <div className="flex justify-between gap-3"><span className="font-bold text-slate-500">{label}</span><span className="text-right font-black text-[#071D49]">{value || "-"}</span></div>; }
function money(value: number | null) { return value == null ? "-" : new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(value); }
function date(value?: string | null) { return value ? new Date(value).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "-"; }
function formatDetails(details: Record<string, unknown> | null) { return details ? Object.entries(details).filter(([, value]) => value !== null && value !== "").map(([key, value]) => `${key.replace(/_/g, " ")}: ${String(value)}`).join(" | ") || "-" : "-"; }
function buildVerificationItems(claim: ClaimDetail, docs: VerificationDocument[]): VerificationItem[] { const docFor = (type: string) => docs.find((doc) => doc.document_type === type && doc.verification_status !== "rejected") ?? docs.find((doc) => doc.document_type === type); const base = requiredDocumentsForStatus(claim.current_status).map((doc) => ({ key: doc.type, title: documentTitle(doc.type), body: doc.body, icon: documentIcon(doc.type), document: docFor(doc.type) })); return [...base, { key: "driver-number", title: "Driver Number", body: "Driver licence number or detail", icon: "👤", detailValue: claim.accident_description?.match(/[A-Z]{2}\d{2}\s?\d{4}\s?\d{7}/i)?.[0] ?? null, verified: Boolean(claim.accident_description) }, { key: "loss-location", title: "Loss Location", body: "Accident or loss location", icon: "📍", detailValue: claim.accident_location, verified: Boolean(claim.accident_location) }]; }
function documentTitle(type: string) { if (type === "Registration certificate") return "RC Copy"; if (type === "Policy copy") return "Insurance Copy"; if (type === "Driving licence") return "Driving Licence Copy"; if (type === "GR Copy / Road Challan") return "GR / Load Challan Copy"; return type; }
function documentIcon(type: string) { if (type === "Registration certificate") return "📄"; if (type === "Policy copy") return "🛡️"; if (type === "Driving licence") return "🪪"; if (type === "GR Copy / Road Challan") return "🚚"; if (type === "Spot Photo") return "📷"; if (type.includes("invoice") || type.includes("estimate") || type.includes("receipt")) return "🧾"; return "📁"; }
function titleForWorkspace(queueKey?: string, fallback?: string) { if (queueKey === "spot-deputation") return "Spot Survey"; if (queueKey === "vehicle-intimation") return "Vehicle Claims Intimated"; if (queueKey === "claim-intimation") return "Claim Intimation"; if (queueKey === "work-approval") return "Work Approval"; if (queueKey === "reinspection") return "Re-Inspection"; if (queueKey === "delivery-order") return "Delivery Order"; if (queueKey === "payment") return "Payment"; if (queueKey === "closed-claims") return "Closed Claim"; return fallback ?? "Claim Workspace"; }
