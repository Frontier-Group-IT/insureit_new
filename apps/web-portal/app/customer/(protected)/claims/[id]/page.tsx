import "./stage/[stage]/customer-claim-reference.css";
import Link from "next/link";
import { INTERNAL_JOURNEY_STAGES, projectInternalClaim } from "@insureit/claim-journey";
import { ExternalLink, FileDown, FileText, Pencil } from "lucide-react";
import { resolveCustomerWebScope } from "@/lib/customer-web-data";
import { CustomerClaimStageStrip } from "@/components/customer-portal/customer-claim-stage-strip";
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
  const { claim, milestones } = await loadCustomerClaimDetail(account.id, id);
  // The downloadable claim form is a final document, not a Stage 1 preview.
  // Require completion of every stage, even if a claim-level status was advanced.
  const completedKeys = new Set(milestones.filter(m => m.milestone_status === "completed" || m.milestone_status === "not_applicable").map(m => m.milestone_key));
  const allNineCompleted = INTERNAL_JOURNEY_STAGES.every(stage => completedKeys.has(stage.key));
  const documentUrl = `/customer/claims/${encodeURIComponent(claim.id)}/download?account=${encodeURIComponent(account.id)}`;
  const source = isExternalCustomerClaim(claim) ? "External" : "Internal";
  const externalProjection = isExternalCustomerClaim(claim) ? buildExternalClaimProjection(milestones) : null;
  const internalProjection = externalProjection ? null : projectInternalClaim(claim.current_status);
  const editStage = externalProjection?.current_stage.key
    ?? INTERNAL_JOURNEY_STAGES[internalProjection?.stageIndex ?? 0]?.key
    ?? INTERNAL_JOURNEY_STAGES[INTERNAL_JOURNEY_STAGES.length - 1].key;
  const internalCompletedKeys = INTERNAL_JOURNEY_STAGES.filter((stage,index) => index < (internalProjection?.completedStageCount ?? 0)).map(stage => stage.key);
  const documentSections = [
    { title: "CLAIM AND POLICY DETAILS", rows: [
      ["Control No.", claim.claim_no, "Insurer Claim No.", claim.insurer_claim_no],
      ["Claim Type", source, "Claim Status", claim.current_status],
      ["Insurance Company", claim.insurer_name, "Policy Number", claim.policy_no],
    ] },
    { title: "VEHICLE PARTICULARS", rows: [
      ["Registration No.", claim.vehicle_no, "Vehicle Make", claim.vehicle_make],
      ["Model", claim.vehicle_model, "", ""],
    ] },
    { title: "ACCIDENT AND CLAIM PARTICULARS", rows: [
      ["Accident Date / Time", claim.accident_at, "Spot Intimation", claim.spot_intimation_at],
      ["Accident Location", claim.accident_location, "", ""],
    ] },
  ];
  const showValue = (value: unknown) => value == null || value === "" ? "—" : String(value);


  return (
    <div className="customer-claim-ref-page w-full min-w-0 space-y-4 pb-8">
      {!externalProjection ? <CustomerClaimStageStrip claimId={claim.id} accountId={account.id} selectedKey={editStage} currentKey={editStage} completedKeys={internalCompletedKeys} editMode claimSummary={{controlNo:claim.claim_no,policyNo:claim.policy_no,makeModel:[claim.vehicle_make,claim.vehicle_model].filter(Boolean).join(" - ")||null,vehicleNo:claim.vehicle_no,status:claim.current_status,manufacturer:claim.vehicle_make,insurer:claim.insurer_name,policySource:claim.policy_service_source==="sibl"?"Sankalp Policy":claim.policy_service_source==="external"||claim.external_policy_id?"External Policy":"—"}} /> : null}
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
        </div> : <div className="bg-[#EEF2F8] p-3 sm:p-6">
          <div className="mx-auto w-full max-w-[1100px] border border-[#D7DFEA] bg-white px-4 py-5 shadow-[0_12px_40px_rgba(15,35,65,.09)] sm:px-9 sm:py-9">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-[#B2C3DA] pb-4 text-[#102B54]">
              <div className="text-[26px] font-black tracking-tight">INSUREIT</div>
              <div className="text-right"><h2 className="text-[16px] font-bold">MOTOR INSURANCE CLAIM FORM</h2><p className="text-[11px] text-[#536781]">Claim particulars | Customer copy</p></div>
            </div>
            <div className="space-y-3">
              {documentSections.map(section => <div key={section.title} className="overflow-hidden border border-[#9AAFC8]">
                <h3 className="bg-[#112F5E] px-3 py-2 text-[11px] font-bold tracking-wide text-white">{section.title}</h3>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[540px] border-collapse text-left text-[11px] text-[#112A4E]">
                    <tbody>{section.rows.map((row,index) => <tr key={index} className="border-t border-[#A9B9CF] first:border-t-0">
                      <th scope="row" className="w-[19%] border-r border-[#A9B9CF] bg-[#EAF0F7] px-2 py-2 font-bold">{row[0]}</th>
                      <td className={`${row[2] ? "w-[31%] border-r" : ""} border-[#A9B9CF] px-2 py-2 break-words`} colSpan={row[2] ? 1 : 3}>{showValue(row[1])}</td>
                      {row[2] ? <><th scope="row" className="w-[19%] border-r border-[#A9B9CF] bg-[#EAF0F7] px-2 py-2 font-bold">{row[2]}</th><td className="w-[31%] break-words px-2 py-2">{showValue(row[3])}</td></> : null}
                    </tr>)}</tbody>
                  </table>
                </div>
              </div>)}
            </div>
            <p className="mt-5 border-t border-[#CAD6E6] pt-3 text-[11px] text-[#64748B]">This is a read-only claim summary. The final downloadable PDF will be available once all nine claim stages are complete.</p>
          </div>
        </div>}

      </section>
    </div>
  );
}
