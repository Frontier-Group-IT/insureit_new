import Link from "next/link";

const tabs = [
  {label:"Partner",href:"/intermediaries/partner",key:"partner"},
  {label:"Group",href:"/intermediaries/groups",key:"group"},
  {label:"Portal Users",href:"/intermediaries/portal-users",key:"users"},
] as const;

export function IntermediaryTabs({active,embedded=false}:{active:"partner"|"group"|"users";embedded?:boolean}) {
 return <nav aria-label="Intermediary workspace" className={embedded ? "flex flex-wrap items-center gap-1 border-b border-[#E7ECF3] bg-[#FAFBFD] p-2" : "mx-auto mb-3 flex max-w-[1480px] flex-wrap items-center gap-1 rounded-xl border border-[#DCE4EF] bg-white p-1.5 shadow-[0_4px_14px_rgba(15,23,42,.04)]"}>
  {tabs.map(tab=><Link key={tab.key} href={tab.href} aria-current={active===tab.key?"page":undefined} className={`rounded-lg px-4 py-2 text-[11px] font-bold transition ${active===tab.key?"bg-[#17365D] text-white shadow-sm":"text-[#526178] hover:bg-[#EEF4FA]"}`}>{tab.label}</Link>)}
 </nav>;
}
