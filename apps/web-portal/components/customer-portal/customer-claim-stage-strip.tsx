import Link from "next/link";
import { Check, LockKeyhole, FolderKanban } from "lucide-react";
import { INTERNAL_JOURNEY_STAGES } from "@insureit/claim-journey";

export function CustomerClaimStageStrip({ claimId, accountId, selectedKey, completedKeys, currentKey, editMode = false }: {
  claimId: string;
  accountId: string;
  selectedKey: string;
  completedKeys: string[];
  currentKey: string;
  editMode?: boolean;
}) {
  const activeIndex = INTERNAL_JOURNEY_STAGES.findIndex(stage => stage.key === currentKey);
  const selected = INTERNAL_JOURNEY_STAGES.find(stage => stage.key === selectedKey);
  return (
    <div className="customer-workflow customer-claim-ref-journey overflow-hidden rounded-2xl border border-[#DFE8F4] bg-white shadow-[0_8px_22px_rgba(7,29,73,0.035)]">
      <div className="customer-claim-ref-journey-header flex flex-wrap items-center justify-between gap-3 px-5 py-3">
        <div className="flex items-center gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white/20 text-white"><FolderKanban className="h-5 w-5" /></span>
          <div><h2 className="text-[16px] font-bold text-white">Claim Journey</h2></div>
        </div>
        <span className="inline-flex items-center gap-2 rounded-full border border-white/40 bg-white px-3.5 py-2 text-[11px] font-semibold text-[#275CAC]">{selected?.label ?? "Spot Intimation"}</span>
      </div>
      <nav aria-label="Nine-stage claim journey" className="overflow-x-auto">
        <ol className="customer-claim-ref-stage-grid grid min-w-[1080px] grid-cols-9 gap-1.5 border-y border-[#E7EBF6] bg-[#FBFAFF] p-2">
          {INTERNAL_JOURNEY_STAGES.map((stage,index) => {
            const completed = completedKeys.includes(stage.key);
            const current = stage.key === currentKey;
            const selectedStage = stage.key === selectedKey;
            const available = completed || current || (activeIndex >= 0 && index <= activeIndex);
            return <li key={stage.key} className={`customer-workflow-step customer-claim-motion-step rounded-lg border border-[#E8EAF7] bg-white ${current ? "customer-claim-motion-active" : completed ? "customer-claim-motion-completed" : ""}`}>
              <Link href={{ pathname:`/customer/claims/${claimId}/stage/${stage.key}`, query:{account:accountId,...(editMode?{mode:"edit"}:{})} }}
                aria-current={current?"step":undefined}
                aria-label={stage.label}
                className={`flex min-h-[46px] w-full items-center justify-center rounded-lg border-b-2 px-2 py-1.5 text-center transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#174EA6] ${selectedStage?"border-b-[#071D49]":"border-b-transparent"} ${current?"bg-[#F7FAFF]":available?"bg-white hover:bg-[#FAFCFF]":"bg-white hover:bg-[#FAFCFF]"}`}>
                <span className="flex items-center justify-center gap-2">
                  <span className={`customer-claim-motion-indicator grid h-6 w-6 shrink-0 place-items-center rounded-full ${completed?"bg-[#E8F8F0] text-[#0A9B72]":current?"bg-[#155EEF] text-white shadow-[0_2px_6px_rgba(21,94,239,0.18)]":"bg-[#EEF2F7] text-[#58708F]"}`}>
                    {completed?<Check className="customer-claim-motion-check h-3.5 w-3.5"/>:current?<span className="text-[9px] font-semibold">{index+1}</span>:<LockKeyhole className="h-3 w-3"/>}
                  </span>
                  <span className={`block text-[9px] font-semibold leading-none ${current?"text-[#155EEF]":completed?"text-[#3E536F]":"text-[#667A96]"}`}>{stage.label}</span>
                </span>
              </Link>
            </li>;
          })}
        </ol>
      </nav>
    </div>
  );
}
