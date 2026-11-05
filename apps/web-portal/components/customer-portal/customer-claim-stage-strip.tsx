import Link from "next/link";
import { Check, LockKeyhole, FolderKanban, ExternalLink, FileDown } from "lucide-react";
import { INTERNAL_JOURNEY_STAGES } from "@insureit/claim-journey";
import { CustomerClaimLogo } from "@/components/customer-portal/customer-claim-logo";

export function CustomerClaimStageStrip({ claimId, accountId, selectedKey, completedKeys, currentKey, editMode = false, hideStageNav = false, claimSummary }: {
  claimId: string;
  accountId: string;
  selectedKey: string;
  completedKeys: string[];
  currentKey: string;
  editMode?: boolean;
  hideStageNav?: boolean;
  claimSummary?: { controlNo: string | null; policyNo: string | null; makeModel: string | null; vehicleNo: string | null; status: string | null; manufacturer: string | null; insurer: string | null; policySource: string };
}) {
  const activeIndex = INTERNAL_JOURNEY_STAGES.findIndex(stage => stage.key === currentKey);
  const selected = INTERNAL_JOURNEY_STAGES.find(stage => stage.key === selectedKey);
  const allNineCompleted = INTERNAL_JOURNEY_STAGES.every(stage => completedKeys.includes(stage.key));
  const pdfUrl = `/customer/claims/${encodeURIComponent(claimId)}/download?account=${encodeURIComponent(accountId)}`;
  return (
    <div className="customer-workflow customer-claim-ref-journey overflow-hidden rounded-2xl border border-[#DFE8F4] bg-white shadow-[0_8px_22px_rgba(7,29,73,0.035)]">
      <div className="customer-claim-ref-journey-header flex flex-wrap items-center justify-between gap-2 px-4 py-2.5">
        <div className="flex items-center gap-2.5">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-white/20 text-white shadow-sm"><FolderKanban className="h-4 w-4" /></span>
          <div><h2 className="text-[14px] font-bold tracking-tight text-white">Claim Journey</h2></div>
        </div>
        <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
          {allNineCompleted ? <>
            <a href={pdfUrl + "&preview=1"} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-white/60 bg-white px-3 text-[11px] font-semibold text-[#174A87]"><ExternalLink className="h-3.5 w-3.5" />Open PDF</a>
            <a href={pdfUrl} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-white/60 bg-white px-3 text-[11px] font-semibold text-[#174A87]"><FileDown className="h-3.5 w-3.5" />Download PDF</a>
          </> : null}
          <Link href={{ pathname: "/customer/claims", query: { account: accountId } }} aria-label="Back to claims" className="group inline-flex min-h-8 items-center gap-1.5 rounded-lg border border-white/35 bg-white/15 px-3 text-[11px] font-semibold text-white transition-all duration-200 hover:border-white/70 hover:bg-white/25 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-white motion-safe:hover:-translate-y-0.5">Back</Link>
        </div>
      </div>
      {claimSummary ? <div className="customer-claim-review-grid grid grid-cols-2 border-b border-white/20 bg-[linear-gradient(102deg,#173876_0%,#175da8_55%,#2189ad_100%)] text-white sm:grid-cols-3 xl:grid-cols-6">
        {([
          {label:"Control No.",value:claimSummary.controlNo,icon:"/assets/Custom-Icons/optimized-128/tasks-work-queue.png"},
          {label:"Policy No.",value:claimSummary.policyNo,icon:"/assets/Custom-Icons/optimized-128/policy.png"},
          {label:"Make & Model",value:claimSummary.makeModel,icon:"/assets/Custom-Icons/optimized-128/fleet-vehicle.png"},
          {label:"Vehicle No.",value:claimSummary.vehicleNo,icon:"/assets/customer-3d-icons/vehicle_register.png"},
          {label:"Claim Status",value:claimSummary.status,icon:"/assets/Custom-Icons/optimized-128/claim-approval.png"},
          {label:"Policy Source",value:claimSummary.policySource,icon:"/assets/customer-3d-icons/policy_related.png"},
        ]).map(({label,value,icon})=><div key={label} className="group flex min-w-0 items-center gap-2 border-b border-white/10 px-3 py-2.5 transition-colors duration-200 hover:bg-white/10 sm:border-b-0 xl:border-r xl:border-white/15 xl:last:border-r-0"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-white/15 text-white transition-transform duration-200 motion-safe:group-hover:scale-105">{label === "Policy No." && claimSummary.insurer ? <CustomerClaimLogo value={claimSummary.insurer} kind="insurer" size={32} /> : label === "Make & Model" && claimSummary.manufacturer ? <CustomerClaimLogo value={claimSummary.manufacturer} kind="vehicle" size={32} /> : <img src={icon} alt="" aria-hidden="true" width={32} height={32} className="h-8 w-8 object-contain" />}</span><div className="min-w-0 flex-1"><p className="mb-0.5 truncate text-[9px] font-semibold uppercase tracking-[0.05em] text-white/80">{label}</p><p className="truncate whitespace-nowrap text-[12px] font-bold leading-5 text-white" title={value||"—"} aria-label={`${label}: ${value||"—"}`}>{value||"—"}</p></div></div>)} 
      </div> : null}
      {!hideStageNav ? <nav aria-label="Nine-stage claim journey" className="customer-claim-stage-nav w-full overflow-x-auto">
        <ol className="customer-claim-ref-stage-grid grid w-full min-w-0 grid-cols-9 gap-1.5 border-y border-[#D5E3F7] bg-[#EAF2FF] p-2">
          {INTERNAL_JOURNEY_STAGES.map((stage,index) => {
            const completed = completedKeys.includes(stage.key);
            const current = stage.key === currentKey;
            const selectedStage = stage.key === selectedKey;
            const available = completed || current || (activeIndex >= 0 && index <= activeIndex);
            return <li key={stage.key} className={`customer-workflow-step customer-claim-motion-step min-w-0 rounded-lg border border-[#BED2F0] bg-white ${current ? "customer-claim-motion-active" : completed ? "customer-claim-motion-completed" : ""}`}>
              <Link href={{ pathname:`/customer/claims/${claimId}/stage/${stage.key}`, query:{account:accountId,...(editMode?{mode:"edit"}:{})} }}
                aria-current={current?"step":undefined}
                aria-label={stage.label}
                className={`flex min-h-[42px] w-full min-w-0 items-center justify-center rounded-md border-b px-1 py-1 text-center transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#174EA6] ${selectedStage?"border-b-[#071D49]":"border-b-transparent"} ${current?"bg-[#F7FAFF]":available?"bg-white hover:bg-[#FAFCFF]":"bg-white hover:bg-[#FAFCFF]"}`}>
                <span className="flex min-w-0 items-center justify-center gap-1">
                  <span className={`customer-claim-motion-indicator grid h-5 w-5 shrink-0 place-items-center rounded-full ${completed?"bg-[#149568] text-white":current?"bg-[#155EEF] text-white shadow-[0_2px_6px_rgba(21,94,239,0.18)]":"bg-[#EEF2F7] text-[#58708F]"}`}>
                    {completed?<Check className="customer-claim-motion-check h-3.5 w-3.5"/>:current?<span className="text-[9px] font-semibold">{index+1}</span>:<LockKeyhole className="h-3 w-3"/>}
                  </span>
                  <span className={`block whitespace-nowrap text-[clamp(7px,0.62vw,10px)] font-bold leading-none ${current?"text-[#155EEF]":completed?"text-[#3E536F]":"text-[#667A96]"}`}>{stage.label}</span>
                </span>
              </Link>
            </li>;
          })}
        </ol>
      </nav> : null}
    </div>
  );
}
