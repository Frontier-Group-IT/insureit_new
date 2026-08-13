import Link from "next/link";
import { notFound } from "next/navigation";

import { ClaimManagerShell } from "@/components/claim-manager/claim-manager-shell";
import { createServerSupabaseClient } from "@/lib/auth-server";
import { AssistanceReviewActions } from "./assistance-review-actions";

type ClaimRow = {
  id: string;
  claim_no: string;
  insurer_claim_no: string | null;
  claim_service_mode: string | null;
  assistance_status: string | null;
  assistance_requested_at: string | null;
  assistance_notes: string | null;
  customer_id: string;
  vehicle_id: string;
  external_policy_id: string | null;
  insurance_company_id: string | null;
  accident_at: string | null;
  accident_location: string | null;
  accident_description: string | null;
  customers: { company_name: string | null; contact_name: string; phone: string | null; email: string | null } | null;
  vehicles: { vehicle_no: string; make: string | null; model: string | null } | null;
  insurance_companies: { name: string | null } | null;
};

type MilestoneRow = { milestone_key: string; milestone_status: string; completed_at: string | null; details: Record<string, unknown> | null };
type FinancialRow = { estimate_amount:number|null; approved_amount:number|null; bill_amount:number|null; do_amount:number|null; customer_paid_amount:number|null; payment_received_amount:number|null; further_deduction_amount:number|null; cashless:boolean|null };
type DocumentRow = { id:string; document_type:string; file_name:string; milestone_key:string|null; created_at:string; verification_required:boolean };

const milestoneLabels: Record<string, string> = {
  spot_intimation: "Spot Intimation",
  spot_status: "Spot Status",
  claim_intimation: "Claim Intimation",
  work_approval: "Work Approval",
  repair_ri: "Repair & RI",
  billing: "Billing",
  delivery_order: "Delivery Order",
  vehicle_delivery: "Vehicle Delivery",
  payment_encashment: "Payment Encashment",
};

export default async function AssistanceReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();

  const { data: claim, error } = await supabase
    .from("claims")
    .select("id,claim_no,insurer_claim_no,claim_service_mode,assistance_status,assistance_requested_at,assistance_notes,customer_id,vehicle_id,external_policy_id,insurance_company_id,accident_at,accident_location,accident_description,customers(company_name,contact_name,phone,email),vehicles(vehicle_no,make,model),insurance_companies(name)")
    .eq("id", id)
    .maybeSingle<ClaimRow>();

  if (error || !claim || !claim.external_policy_id) notFound();

  const [policyResult, milestoneResult, financialResult, documentResult] = await Promise.all([
    supabase.from("external_policies").select("policy_no,policy_type,start_date,end_date").eq("id", claim.external_policy_id).maybeSingle(),
    supabase.from("claim_milestones").select("milestone_key,milestone_status,completed_at,details").eq("claim_id", id).order("created_at", { ascending: true }).returns<MilestoneRow[]>(),
    supabase.from("claim_financials").select("estimate_amount,approved_amount,bill_amount,do_amount,customer_paid_amount,payment_received_amount,further_deduction_amount,cashless").eq("claim_id", id).maybeSingle<FinancialRow>(),
    supabase.from("claim_documents").select("id,document_type,file_name,milestone_key,created_at,verification_required").eq("claim_id", id).order("created_at", { ascending: false }).returns<DocumentRow[]>(),
  ]);

  const policy = policyResult.data;
  const milestones = milestoneResult.data ?? [];
  const financials = financialResult.data;
  const documents = documentResult.data ?? [];
  const customerName = claim.customers?.company_name ?? claim.customers?.contact_name ?? "Customer";
  const pending = claim.assistance_status === "requested";

  return (
    <ClaimManagerShell title={`External Claim Assistance - ${claim.claim_no}`} backHref="/claims?queue=assistance">
      <div className="space-y-3">
        <div className="rounded-xl border border-[#E0E7F0] bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div><p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#174EA6]">External policy claim</p><h2 className="mt-1 text-xl font-semibold text-[#071D49]">{claim.claim_no}</h2><p className="mt-1 text-[11px] text-[#5C6878]">{customerName} • {claim.vehicles?.vehicle_no ?? "Vehicle"} • {claim.insurance_companies?.name ?? "External insurer"}</p></div>
            <span className={`rounded-full px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide ${pending ? "bg-[#FFF4D6] text-[#8A5B00]" : claim.assistance_status === "accepted" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>{pending ? "Assistance requested" : claim.assistance_status ?? "Not requested"}</span>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 border-t border-[#E7ECF3] pt-3 md:grid-cols-4">
            <Meta label="Customer" value={customerName} />
            <Meta label="Mobile" value={claim.customers?.phone ?? "-"} />
            <Meta label="Policy" value={policy?.policy_no ?? "-"} />
            <Meta label="Policy type" value={policy?.policy_type ?? "-"} />
            <Meta label="Vehicle" value={[claim.vehicles?.make, claim.vehicles?.model].filter(Boolean).join(" ") || "-"} />
            <Meta label="Loss date" value={formatDateTime(claim.accident_at)} />
            <Meta label="Policy expiry" value={formatDate(policy?.end_date)} />
            <Meta label="Requested" value={formatDateTime(claim.assistance_requested_at)} />
          </div>
          {claim.assistance_notes ? <div className="mt-4 rounded-lg bg-[#F6F8FB] px-3 py-2.5"><p className="text-[10px] font-semibold uppercase tracking-wide text-[#697586]">Customer request note</p><p className="mt-1 text-[12px] leading-5 text-[#27364F]">{claim.assistance_notes}</p></div> : null}
        </div>

        <div className="grid gap-3 xl:grid-cols-[1.45fr_0.85fr]">
          <div className="rounded-xl border border-[#E0E7F0] bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3"><div><h3 className="text-[13px] font-semibold text-[#071D49]">Customer-recorded claim journey</h3><p className="mt-1 text-[10.5px] text-[#667085]">Review what has already happened before taking responsibility.</p></div><span className="text-[11px] font-semibold text-[#174EA6]">{milestones.filter((item) => item.milestone_status === "completed").length} / 9 completed</span></div>
            <div className="mt-3 divide-y divide-[#EDF1F5]">
              {Object.entries(milestoneLabels).map(([key, label], index) => {
                const item = milestones.find((row) => row.milestone_key === key);
                const done = item?.milestone_status === "completed";
                return <div key={key} className="flex items-center gap-3 py-2.5"><span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-[10px] font-semibold ${done ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>{done ? "✓" : index + 1}</span><div className="min-w-0 flex-1"><p className="text-[11.5px] font-semibold text-[#172B4D]">{label}</p><p className="text-[10px] text-[#7A8797]">{done ? `Recorded ${formatDateTime(item?.completed_at)}` : "Not yet completed"}</p></div><span className={`rounded-full px-2 py-1 text-[9px] font-semibold ${done ? "bg-emerald-50 text-emerald-700" : "bg-slate-50 text-slate-500"}`}>{done ? "Done" : "Pending"}</span></div>;
              })}
            </div>
          </div>

          <div className="space-y-3">
            <div className="rounded-xl border border-[#E0E7F0] bg-white p-4 shadow-sm"><h3 className="text-[13px] font-semibold text-[#071D49]">Financial snapshot</h3><div className="mt-3 grid grid-cols-2 gap-3"><Money label="Estimate" value={financials?.estimate_amount}/><Money label="Approved" value={financials?.approved_amount}/><Money label="Bill" value={financials?.bill_amount}/><Money label="DO" value={financials?.do_amount}/><Money label="Customer paid" value={financials?.customer_paid_amount}/><Money label="Received" value={financials?.payment_received_amount}/></div></div>
            <div className="rounded-xl border border-[#E0E7F0] bg-white p-4 shadow-sm"><div className="flex items-center justify-between"><h3 className="text-[13px] font-semibold text-[#071D49]">Stage documents</h3><span className="text-[11px] font-semibold text-[#174EA6]">{documents.length}</span></div><div className="mt-2 space-y-1.5">{documents.length ? documents.slice(0, 12).map((doc) => <Link key={doc.id} href={`/claim-documents/${doc.id}/open`} target="_blank" className="flex items-center justify-between rounded-lg border border-[#E7ECF3] px-2.5 py-2 text-[10.5px] text-[#17345F] hover:bg-[#F8FBFF]"><span className="min-w-0 truncate">{doc.file_name}</span><span className="ml-2 shrink-0 text-[9px] font-semibold uppercase text-[#6B778C]">{doc.milestone_key ? milestoneLabels[doc.milestone_key] ?? doc.milestone_key : "Claim"}</span></Link>) : <p className="py-3 text-[10.5px] text-[#7A8797]">No stage documents uploaded yet.</p>}</div></div>
          </div>
        </div>

        {pending ? <AssistanceReviewActions claimId={claim.id} /> : <div className="rounded-xl border border-[#DCE5F1] bg-white p-4 text-[12px] text-[#5C6878]">This assistance request has already been resolved. <Link href="/claims?queue=assistance" className="font-semibold text-[#174EA6]">Return to Assistance Requests</Link>.</div>}
      </div>
    </ClaimManagerShell>
  );
}

function Meta({ label, value }: { label: string; value: string }) { return <div><p className="text-[9px] font-semibold uppercase tracking-wide text-[#8792A2]">{label}</p><p className="mt-1 text-[11px] font-semibold text-[#172B4D]">{value}</p></div>; }
function Money({ label, value }: { label: string; value?: number | null }) { return <div className="rounded-lg bg-[#F7F9FC] px-3 py-2"><p className="text-[9px] font-semibold uppercase text-[#8792A2]">{label}</p><p className="mt-1 text-[12px] font-semibold text-[#071D49]">{value == null ? "—" : `₹${Number(value).toLocaleString("en-IN")}`}</p></div>; }
function formatDate(value?: string | null) { return value ? new Date(value).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "-"; }
function formatDateTime(value?: string | null) { return value ? new Date(value).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "-"; }
