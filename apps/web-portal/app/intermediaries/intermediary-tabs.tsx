import Link from "next/link";

const tabs = [
  {label:"Partner",href:"/intermediaries/partner",key:"partner"},
  {label:"Group",href:"/intermediaries/groups",key:"group"},
  {label:"Portal Users",href:"/intermediaries/portal-users",key:"users"},
] as const;

export function IntermediaryTabs({active,embedded=false}:{active:"partner"|"group"|"users";embedded?:boolean}) {
 return <nav aria-label="Intermediary workspace" className={embedded ? "flex flex-wrap items-center gap-2 border-b border-[#E7ECF3] bg-[#FAFBFD] p-2" : "mx-auto mb-3 flex max-w-[1480px] flex-wrap items-center gap-2 rounded-xl border border-[#DCE4EF] bg-white p-1.5 shadow-[0_4px_14px_rgba(15,23,42,.04)]"}>
  {tabs.map((tab,index)=><div key={tab.key} className="flex items-center gap-2">{index>0?<span aria-hidden="true" className="h-5 w-px shrink-0 bg-[#D5DEEA]" />:null}<Link href={tab.href} aria-current={active===tab.key?"page":undefined} className={`rounded-lg px-4 py-2 text-[11px] font-bold transition ${active===tab.key?"bg-[#17365D] text-white shadow-sm":"text-[#1769DC] hover:bg-[#EEF4FA] hover:text-[#0F4FA8]"}`}>{tab.label}</Link></div>)}
 </nav>;
}
