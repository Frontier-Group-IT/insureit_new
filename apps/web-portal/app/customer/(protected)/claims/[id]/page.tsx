import Link from "next/link";
import { INTERNAL_JOURNEY_STAGES, projectInternalClaim } from "@insureit/claim-journey";
import { ExternalLink, FileDown, FileText, Pencil } from "lucide-react";
import { resolveCustomerWebScope } from "@/lib/customer-web-data";
import { loadCustomerClaimDetail, isExternalCustomerClaim, buildExternalClaimProjection } from "@/lib/customer-web-phase2-data";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/** A customer-facing, read-only claim document preview. Editing remains in the stage workflow. */
export default async function CustomerClaimDetailPage({
  params, searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ account?: string }>;
}) {
  const { id } = await params;
  const q = searchParams ? await searchParams : {};
  const { account } = await resolveCustomerWebScope(q.account);
  const { claim, milestones, documents } = await loadCustomerClaimDetail(account.id, id);
  // The downloadable claim form is a final document, not a Stage 1 preview.
  // Require completion of every stage, even if a claim-level status was advanced.
  const completedKeys = new Set(milestones.filter(m => m.milestone_status === "completed" || m.milestone_status === "not_applicable").map(m => m.milestone_key));
  const allNineCompleted = INTERNAL_JOURNEY_STAGES.every(stage => completedKeys.has(stage.key));
  const documentUrl = `/customer/claims/${encodeURIComponent(claim.id)}/download?account=${encodeURIComponent(account.id)}`;
  const source = isExternalCustomerClaim(claim) ? "External" : "Internal";
  const currentStage = INTERNAL_JOURNEY_STAGES.find(stage => !completedKeys.has(stage.key));
  const externalProjection = isExternalCustomerClaim(claim) ? buildExternalClaimProjection(milestones) : null;
  const internalProjection = externalProjection ? null : projectInternalClaim(claim.current_status);
  const editStage = externalProjection?.current_stage.key
    ?? INTERNAL_JOURNEY_STAGES[internalProjection?.stageIndex ?? 0]?.key
    ?? INTERNAL_JOURNEY_STAGES[INTERNAL_JOURNEY_STAGES.length - 1].key;
  const detailRows: Array<[string, unknown]> = [
    ["Control Number",claim.claim_no],["Claim Number",claim.insurer_claim_no],
    ["Claim Type",source],["Claim Status",claim.current_status],
    ["Vehicle",claim.vehicle_no],["Make / Model",[claim.vehicle_make,claim.vehicle_model].filter(Boolean).join(" ")],
    ["Insurer",claim.insurer_name],["Policy Number",claim.policy_no],
    ["Accident Date",claim.accident_at],["Spot Intimation",claim.spot_intimation_at],
    ["Location",claim.accident_location],
  ];

  return (
    <div className="w-full min-w-0 space-y-4 pb-8">
      <section className="overflow-hidden rounded-2xl border border-[#D9E3F0] bg-white shadow-[0_8px_35px_rgba(22,49,83,.05)]">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E0E8F3] px-5 py-4">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#EAF2FF] text-[#225AA3]"><FileText className="h-5 w-5" /></span>
            <div>
              <h1 className="text-[17px] font-bold text-[#102B54]">Claim Details</h1>
              <p className="text-[11px] text-[#61748F]">{claim.claim_no || "Claim"} · {source} claim · Read-only document</p>
            </div>
          </div>
        <div className="flex flex-wrap items-center gap-2">
          {allNineCompleted ? <a href={documentUrl + "&preview=1"} target="_blank" rel="noopener noreferrer"
            className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-[#B9CBE2] bg-white px-4 text-[12px] font-semibold text-[#174A87]">
            <ExternalLink className="h-4 w-4" /> Open PDF
          </a> : null}
          {allNineCompleted ? <a href={documentUrl}
            className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-[#B9CBE2] bg-white px-4 text-[12px] font-semibold text-[#174A87]">
            <FileDown className="h-4 w-4" /> Download Claim Form
          </a> : null}
          <Link href={{ pathname: `/customer/claims/${claim.id}/stage/${editStage}`, query: { account: account.id, mode:"edit" } }}
            className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-[#0B3884] px-4 text-[12px] font-semibold text-white">
            <Pencil className="h-4 w-4" /> Edit Claim
          </Link>
        </div>
        </header>
        {allNineCompleted ? <div className="bg-[#EEF2F8] p-3 sm:p-6">
          <div className="w-full min-w-0 overflow-hidden rounded-lg border border-[#D7DFEA] bg-white shadow-[0_12px_40px_rgba(15,35,65,.11)]">
            <iframe title="Claim Form PDF Preview" src={documentUrl + "&preview=1#toolbar=0&navpanes=0"}
              className="block h-[76vh] min-h-[570px] w-full border-0" />
          </div>
          <p className="mt-3 text-center text-[11px] text-[#64748B]">
            If the document preview is not supported in your browser, use Open PDF or Download Claim Form in the header.
          </p>
        </div> : <div className="space-y-4 p-4">
          <p className="text-xs text-[#64748B]">Read-only claim details. The final PDF is available once all nine stages are complete.</p>
          <div className="grid grid-cols-1 overflow-hidden rounded-lg border border-[#D9E3F0] sm:grid-cols-2">
            {detailRows.map(([label,value]) => <div key={label} className="flex min-w-0 border-b border-r border-[#D9E3F0] text-xs">
              <span className="w-[42%] shrink-0 bg-[#F2F5FA] px-3 py-2 font-semibold text-[#405778]">{label}</span>
              <span className="min-w-0 break-words px-3 py-2 text-[#17345D]">{value == null || value === "" ? "—" : String(value)}</span>
            </div>)}
          </div>
          <h2 className="text-sm font-bold text-[#102B54]">Claim Journey</h2>
          <div className="grid gap-2 sm:grid-cols-3">
            {INTERNAL_JOURNEY_STAGES.map((stage,index) => <div key={stage.key} className="flex justify-between gap-2 rounded-lg border border-[#D9E3F0] p-2 text-xs">
              <span>{index+1}. {stage.label}</span>
              <span className={completedKeys.has(stage.key) ? "font-semibold text-emerald-700" : "text-[#64748B]"}>{completedKeys.has(stage.key) ? "Completed" : currentStage?.key===stage.key ? "Current" : "Pending"}</span>
            </div>)}
          </div>
          <h2 className="text-sm font-bold text-[#102B54]">Uploaded Documents ({documents.length})</h2>
          <div className="grid gap-2 sm:grid-cols-2">
            {documents.length ? documents.map(doc => <div key={doc.id} className="min-w-0 rounded-lg border border-[#D9E3F0] p-2 text-xs">
              <span className="font-semibold text-[#17345D]">{doc.document_type}</span>
              <span className="ml-2 break-all text-[#64748B]">{doc.file_name || "Uploaded"}</span>
            </div>) : <p className="text-xs text-[#64748B]">No documents uploaded yet.</p>}
          </div>
        </div>}
      </section>
    </div>
  );
}
