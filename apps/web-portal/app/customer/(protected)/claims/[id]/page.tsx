import Link from "next/link";
import { FileDown, Pencil, FileText } from "lucide-react";
import { INTERNAL_JOURNEY_STAGES } from "@insureit/claim-journey";
import { resolveCustomerWebScope } from "@/lib/customer-web-data";
import { loadCustomerClaimDetail, isExternalCustomerClaim } from "@/lib/customer-web-phase2-data";
import { CustomerClaimEvidenceWorkspace } from "@/components/customer-portal/customer-claim-evidence-workspace";
import { CustomerClaimDocumentGroups } from "@/components/customer-portal/customer-claim-document-groups";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/** Claims Register always enters this read-only view; editing is a separate stage journey. */
export default async function CustomerClaimDetailPage({
  params, searchParams,
}:{
  params:Promise<{id:string}>;searchParams?:Promise<{account?:string}>;
}) {
  const {id}=await params;
  const q=searchParams?await searchParams:{};
  const {account}=await resolveCustomerWebScope(q.account);
  const {claim,milestones,documents}=await loadCustomerClaimDetail(account.id,id);
  const source=isExternalCustomerClaim(claim)?"External":"Internal";
  const summary=[
    ["Vehicle No.",claim.vehicle_no],["Make & Model",[claim.vehicle_make,claim.vehicle_model].filter(Boolean).join(" ")],
    ["Insurer",claim.insurer_name],["Policy No.",claim.policy_no],["Control No.",claim.claim_no],
    ["Claim No.",claim.insurer_claim_no],["Claim Status",claim.current_status],
    ["Accident Date",claim.accident_at?new Date(claim.accident_at).toLocaleString("en-IN"):null],
    ["Spot Intimation",claim.spot_intimation_at?new Date(claim.spot_intimation_at).toLocaleString("en-IN"):null],
    ["Location",claim.accident_location],
  ];
  return <div className="space-y-3">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <Link href={{pathname:"/customer/claims",query:{account:account.id}}} className="text-[13px] font-semibold text-[#245DAB]">← Claims Register</Link>
      <div className="flex flex-wrap items-center gap-2">
        <a href={`/customer/claims/${encodeURIComponent(claim.id)}/download?account=${encodeURIComponent(account.id)}`} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-[#B9CBE2] bg-white px-4 text-[12px] font-semibold text-[#174A87]"><FileDown className="h-4 w-4"/>Download Details PDF</a>
        <Link href={{pathname:`/customer/claims/${claim.id}/stage/spot_intimation`,query:{account:account.id,mode:"edit"}}} className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-[#0B3884] px-4 text-[12px] font-semibold text-white"><Pencil className="h-4 w-4"/>Edit Claim</Link>
      </div>
    </div>
    <section className="overflow-hidden rounded-2xl border border-[#D9E3F0] bg-white">
      <header className="flex items-center justify-between border-b border-[#D9E3F0] px-5 py-4"><h1 className="text-[18px] font-bold text-[#071D49]">Claim Details</h1><span className="text-[11px] text-[#64748B]">{source} Claim · View only</span></header>
      <div className="grid grid-cols-2 lg:grid-cols-5">{summary.map(([label,value])=><div key={label} className="min-h-[74px] border-b border-r border-[#D9E3F0] p-3"><p className="text-[10px] uppercase text-[#7386A2]">{label}</p><p className="mt-1 break-words text-[12px] font-semibold text-[#17345D]">{value||"—"}</p></div>)}</div>
    </section>
    <section className="overflow-hidden rounded-2xl border border-[#D9E3F0] bg-white">
      <h2 className="border-b border-[#D9E3F0] px-5 py-4 text-[17px] font-semibold text-[#071D49]">Operations claim journey — All Stage Details</h2>
      <div className="space-y-3 p-4">{INTERNAL_JOURNEY_STAGES.map((stage,index)=>{
        const milestone=milestones.find(item=>item.milestone_key===stage.key);
        const fields=stage.key==="spot_intimation"?[
          ["Accident Date & Time",claim.accident_at],["Spot Intimation Date & Time",claim.spot_intimation_at],["Location",claim.accident_location],
          ["Driver Name",milestone?.details?.driver_name],["Driver Number",milestone?.details?.driver_phone],
        ]:Object.entries(milestone?.details||{}).filter(([,value])=>["string","number","boolean"].includes(typeof value)).map(([key,value])=>[key.replace(/_/g," "),value]);
        return <section key={stage.key} className="overflow-hidden rounded-xl border border-[#DCE5F4] bg-white">
          <div className="flex items-center justify-between gap-2 border-b border-[#EDF1F6] px-4 py-3"><h3 className="text-[13px] font-semibold text-[#102B54]">{index+1}. {stage.label}</h3><span className="text-[11px] text-[#64748B]">{milestone?.milestone_status||"No stage update"}</span></div>
          <div className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-5">{fields.length?fields.map(([label,value],i)=><div key={i}><p className="mb-1 text-[10px] uppercase text-[#174EA6]">{String(label)}</p><div className="min-h-9 rounded-md border border-[#D9E3F0] px-3 py-2 text-[12px] text-[#071D49]">{value==null||value===""?"—":String(value)}</div></div>):<p className="text-[12px] text-[#64748B]">No details recorded yet.</p>}</div>
          {stage.key==="spot_intimation"?<CustomerClaimEvidenceWorkspace documents={documents} claimId={claim.id} accountId={account.id} stage={stage.key} allowUpload={false}/>:null}
          {stage.key==="claim_intimation"?<CustomerClaimDocumentGroups documents={documents} claimId={claim.id} accountId={account.id} stage={stage.key} allowUpload={false}/>:null}
        </section>;
      })}</div>
    </section>
    <p className="flex items-center gap-2 text-[11px] text-[#64748B]"><FileText className="h-4 w-4"/>Read-only claim information. Use Edit Claim to open the stage workflow.</p>
  </div>;
}
