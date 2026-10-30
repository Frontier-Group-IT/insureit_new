import Link from "next/link";
import { Check, LockKeyhole, FolderKanban, ExternalLink, FileDown } from "lucide-react";
import { INTERNAL_JOURNEY_STAGES } from "@insureit/claim-journey";

export function CustomerClaimStageStrip({ claimId, accountId, selectedKey, completedKeys, currentKey, editMode = false, claimSummary }: {
  claimId: string;
  accountId: string;
  selectedKey: string;
  completedKeys: string[];
  currentKey: string;
  editMode?: boolean;
  claimSummary?: { controlNo: string | null; policyNo: string | null; makeModel: string | null; vehicleNo: string | null; status: string | null };
}) {
  const activeIndex = INTERNAL_JOURNEY_STAGES.findIndex(stage => stage.key === currentKey);
  const selected = INTERNAL_JOURNEY_STAGES.find(stage => stage.key === selectedKey);
  const allNineCompleted = INTERNAL_JOURNEY_STAGES.every(stage => completedKeys.includes(stage.key));
  const pdfUrl = `/customer/claims/${encodeURIComponent(claimId)}/download?account=${encodeURIComponent(accountId)}`;
  return (
    <div className="customer-workflow customer-claim-ref-journey overflow-hidden rounded-2xl border border-[#DFE8F4] bg-white shadow-[0_8px_22px_rgba(7,29,73,0.035)]">
      <div className="customer-claim-ref-journey-header flex flex-wrap items-center justify-between gap-3 px-5 py-3">
        <div className="flex items-center gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white/20 text-white"><FolderKanban className="h-5 w-5" /></span>
          <div><h2 className="text-[16px] font-bold text-white">Claim Journey</h2></div>
        </div>
        <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
          {allNineCompleted ? <>
            <a href={pdfUrl + "&preview=1"} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-white/60 bg-white px-3 text-[11px] font-semibold text-[#174A87]"><ExternalLink className="h-3.5 w-3.5" />Open PDF</a>
            <a href={pdfUrl} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-white/60 bg-white px-3 text-[11px] font-semibold text-[#174A87]"><FileDown className="h-3.5 w-3.5" />Download PDF</a>
          </> : null}
        </div>
      </div>
      {claimSummary ? <div className="customer-claim-review-grid grid grid-cols-2 border-b border-white/15 bg-gradient-to-r from-[#102E63] to-[#174D9A] text-white md:grid-cols-3 xl:grid-cols-5">
        {([["Control No.",claimSummary.controlNo],["Policy No.",claimSummary.policyNo],["Make & Model",claimSummary.makeModel],["Vehicle No.",claimSummary.vehicleNo],["Claim Status",claimSummary.status]] as const).map(([label,value])=><div key={label} className="min-w-0 border-b border-white/10 px-4 py-3 last:border-b-0 md:border-b-0 xl:border-r xl:border-white/15 xl:last:border-r-0"><p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.07em] text-[#A8C7EE]">{label}</p><p className="break-words text-[13px] font-bold leading-snug text-white" title={value||"—"}>{value||"—"}</p></div>)}
      </div> : null}
      <nav aria-label="Nine-stage claim journey" className="customer-claim-stage-nav overflow-x-auto">
        <ol className="customer-claim-ref-stage-grid grid min-w-[1080px] grid-cols-9 gap-2 border-y border-[#D5E3F7] bg-[#EAF2FF] p-3">
          {INTERNAL_JOURNEY_STAGES.map((stage,index) => {
            const completed = completedKeys.includes(stage.key);
            const current = stage.key === currentKey;
            const selectedStage = stage.key === selectedKey;
            const available = completed || current || (activeIndex >= 0 && index <= activeIndex);
            return <li key={stage.key} className={`customer-workflow-step customer-claim-motion-step rounded-xl border-2 border-[#BED2F0] bg-white ${current ? "customer-claim-motion-active" : completed ? "customer-claim-motion-completed" : ""}`}>
              <Link href={{ pathname:`/customer/claims/${claimId}/stage/${stage.key}`, query:{account:accountId,...(editMode?{mode:"edit"}:{})} }}
                aria-current={current?"step":undefined}
                aria-label={stage.label}
                className={`flex min-h-[65px] w-full items-center justify-center rounded-lg border-b-2 px-2 py-1.5 text-center transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#174EA6] ${selectedStage?"border-b-[#071D49]":"border-b-transparent"} ${current?"bg-[#F7FAFF]":available?"bg-white hover:bg-[#FAFCFF]":"bg-white hover:bg-[#FAFCFF]"}`}>
                <span className="flex items-center justify-center gap-2">
                  <span className={`customer-claim-motion-indicator grid h-7 w-7 shrink-0 place-items-center rounded-full ${completed?"bg-[#E8F8F0] text-[#0A9B72]":current?"bg-[#155EEF] text-white shadow-[0_2px_6px_rgba(21,94,239,0.18)]":"bg-[#EEF2F7] text-[#58708F]"}`}>
                    {completed?<Check className="customer-claim-motion-check h-3.5 w-3.5"/>:current?<span className="text-[9px] font-semibold">{index+1}</span>:<LockKeyhole className="h-3 w-3"/>}
                  </span>
                  <span className={`block text-[11px] font-bold leading-tight ${current?"text-[#155EEF]":completed?"text-[#3E536F]":"text-[#667A96]"}`}>{stage.label}</span>
                </span>
              </Link>
            </li>;
          })}
        </ol>
      </nav>
    </div>
  );
}
