import Link from "next/link";
import { Check, LockKeyhole } from "lucide-react";
import { INTERNAL_JOURNEY_STAGES } from "@insureit/claim-journey";

export function CustomerClaimStageStrip({ claimId, accountId, selectedKey, completedKeys, currentKey }: {
  claimId: string;
  accountId: string;
  selectedKey: string;
  completedKeys: string[];
  currentKey: string;
}) {
  return <nav aria-label="Nine-stage claim journey" className="overflow-x-auto rounded-xl border border-[#D5E0EF] bg-white">
    <div className="grid min-w-[1050px] grid-cols-9 divide-x divide-[#DCE5F0]">
      {INTERNAL_JOURNEY_STAGES.map((stage,index)=>{
        const completed=completedKeys.includes(stage.key);
        const active=selectedKey===stage.key;
        const current=currentKey===stage.key;
        return <Link key={stage.key} href={{pathname:`/customer/claims/${claimId}/stage/${stage.key}`,query:{account:accountId}}} aria-current={active?"step":undefined}
          className={`flex min-h-[53px] items-center justify-center gap-2 border-b-2 px-2 py-2 text-[10px] font-semibold transition hover:bg-[#EDF4FF] ${active?"border-[#174EA6] bg-[#F0F5FF] text-[#1754B5]":"border-transparent text-[#586C85]"}`}>
          <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-[10px] font-bold ${completed?"bg-[#E4F7EC] text-[#13805B]":current?"bg-[#205FF0] text-white":"bg-[#EDF1F6] text-[#8391A7]"}`}>
            {completed?<Check className="h-3.5 w-3.5"/>:current?index+1:<LockKeyhole className="h-3 w-3"/>}
          </span>
          <span className="leading-3">{stage.label}</span>
        </Link>;
      })}
    </div>
  </nav>;
}
