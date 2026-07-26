"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { BarChart3, CheckSquare2, ChevronRight, ClipboardList, FileChartColumn, FileCheck2, Gauge, LayoutGrid, Settings, ShieldCheck, Sparkles, UsersRound } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { BrandLockup } from "@/components/brand-lockup";

type SectionKey="claims"|"distribution"|"master-data"|"tasks"|"reports";
type ActiveNav="dashboard"|SectionKey|"none";
type Item={href:string;label:string;icon:LucideIcon};
type Props={activeNav:ActiveNav};

const sections:Array<{key:SectionKey;label:string;icon:LucideIcon;tint:string;items:Item[]}>= [
 {key:"claims",label:"Claims",icon:ShieldCheck,tint:"from-[#ff6f61] to-[#ff9f68]",items:[{href:"/claims",label:"All Claims",icon:ClipboardList},{href:"/claims?queue=documents",label:"Documents",icon:FileCheck2},{href:"/claims?journey=spot-intimation",label:"Verification",icon:CheckSquare2},{href:"/claims?journey=spot-surveyor-assigned",label:"Survey",icon:Gauge},{href:"/claims?journey=under-repair",label:"Repair",icon:Settings},{href:"/claims?journey=payment-advice-received",label:"Settlement",icon:BarChart3}]},
 {key:"distribution",label:"Distribution Network",icon:Sparkles,tint:"from-[#17c7c9] to-[#6759ff]",items:[{href:"/intermediaries",label:"Network Overview",icon:UsersRound},{href:"/intermediaries?type=posp",label:"POSP",icon:UsersRound},{href:"/intermediaries?type=misp",label:"MISP",icon:UsersRound},{href:"/intermediaries?type=partner",label:"Business Associates",icon:UsersRound},{href:"/customers/posp-misp",label:"Onboarding Applications",icon:FileCheck2}]},
 {key:"master-data",label:"Master Data",icon:LayoutGrid,tint:"from-[#6759ff] to-[#8f7cff]",items:[{href:"/employees",label:"Employees",icon:UsersRound},{href:"/customers",label:"Customers",icon:UsersRound},{href:"/customers/applications",label:"Customer KYC",icon:FileCheck2},{href:"/vehicles",label:"Vehicles",icon:Gauge},{href:"/policies",label:"Policies",icon:ShieldCheck}]},
 {key:"tasks",label:"Tasks",icon:CheckSquare2,tint:"from-[#17c7c9] to-[#62ddd3]",items:[{href:"/tasks",label:"All Tasks",icon:CheckSquare2},{href:"/tasks?status=open",label:"Open",icon:ClipboardList},{href:"/tasks?status=in_progress",label:"In Progress",icon:Gauge},{href:"/tasks?status=completed",label:"Completed",icon:FileCheck2}]},
 {key:"reports",label:"Reports",icon:FileChartColumn,tint:"from-[#f1b94a] to-[#ffcf6b]",items:[{href:"/reports",label:"Reports Workspace",icon:FileChartColumn}]}
];

export function AppNavigation({activeNav}:Props){
 const pathname=usePathname(); const searchParams=useSearchParams(); const routeSection=sectionForPath(pathname); const resolved=routeSection??(activeNav!=="dashboard"&&activeNav!=="none"?activeNav:null); const [openSection,setOpenSection]=useState<SectionKey|null>(resolved); useEffect(()=>{if(resolved)setOpenSection(resolved)},[pathname,resolved]); const currentQuery=searchParams.toString();
 return <aside className="fixed inset-y-0 left-0 z-50 hidden w-[268px] overflow-hidden border-r border-white/10 bg-[#111a35] text-white shadow-[20px_0_60px_rgba(17,26,53,0.22)] lg:flex lg:flex-col">
  <div className="pointer-events-none absolute inset-0 overflow-hidden"><div className="absolute -left-20 top-14 h-52 w-52 rounded-full bg-[#6759ff]/25 blur-3xl"/><div className="absolute -right-20 bottom-20 h-56 w-56 rounded-full bg-[#17c7c9]/15 blur-3xl"/><div className="portal-noise absolute inset-0 opacity-20"/></div>
  <Link href="/dashboard" className="relative flex h-[78px] items-center border-b border-white/10 px-5" aria-label="InsureIt home"><BrandLockup compact inverse/></Link>
  <nav className="relative flex-1 overflow-y-auto px-3.5 py-4">
   <Link href="/dashboard" className={`group mb-2 flex h-12 items-center gap-3 rounded-2xl px-3.5 text-[12px] font-bold ${activeNav==="dashboard"&&!routeSection?"bg-white text-[#141d3b] shadow-[0_14px_35px_rgba(0,0,0,.18)]":"text-white/72 hover:bg-white/8 hover:text-white"}`}><span className={`grid h-8 w-8 place-items-center rounded-xl ${activeNav==="dashboard"&&!routeSection?"bg-gradient-to-br from-[#6759ff] to-[#17c7c9] text-white":"bg-white/8 text-white/75"}`}><Gauge className="h-4 w-4"/></span><span className="flex-1">Dashboard</span></Link>
   <p className="mb-2 mt-6 px-3 text-[9px] font-black uppercase tracking-[0.18em] text-white/35">Workspaces</p>
   <div className="space-y-1.5">{sections.map(section=>{const open=openSection===section.key;const active=resolved===section.key;const SectionIcon=section.icon;return <div key={section.key} className={`overflow-hidden rounded-2xl border ${active?"border-white/12 bg-white/8":"border-transparent"}`}><button type="button" onClick={()=>setOpenSection(current=>current===section.key&&!active?null:section.key)} className={`group flex h-11 w-full items-center gap-3 px-3.5 text-left text-[12px] font-bold ${active?"text-white":"text-white/68 hover:bg-white/6 hover:text-white"}`} aria-expanded={open}><span className={`grid h-8 w-8 place-items-center rounded-xl bg-gradient-to-br ${section.tint} text-white`}><SectionIcon className="h-4 w-4"/></span><span className="flex-1">{section.label}</span><ChevronRight className={`h-4 w-4 text-white/35 ${open?"rotate-90":""}`}/></button>{open?<div className="space-y-1 px-2.5 pb-2.5 pl-[50px]">{section.items.map(item=>{const itemActive=isCurrent(item.href,pathname,currentQuery);const ItemIcon=item.icon;return <Link key={item.href} href={item.href} className={`group flex min-h-9 items-center gap-2 rounded-xl px-2.5 py-2 text-[10.5px] font-semibold ${itemActive?"bg-white text-[#17213e]":"text-white/55 hover:bg-white/7 hover:text-white"}`}><ItemIcon className={`h-3.5 w-3.5 ${itemActive?"text-[#6759ff]":"text-white/35"}`}/><span className="truncate">{item.label}</span></Link>})}</div>:null}</div>})}</div>
  </nav>
  <div className="relative border-t border-white/10 p-3.5"><Link href="/settings" className="group flex h-11 items-center gap-3 rounded-2xl px-3.5 text-[12px] font-bold text-white/65 hover:bg-white/8 hover:text-white"><span className="grid h-8 w-8 place-items-center rounded-xl bg-white/8"><Settings className="h-4 w-4"/></span><span>Settings</span></Link></div>
 </aside>;
}

function sectionForPath(pathname:string):SectionKey|null{
 if(pathname==="/claims"||pathname.startsWith("/claims/"))return"claims";
 if(pathname==="/intermediaries"||pathname.startsWith("/intermediaries/")||pathname==="/customers/posp-misp"||pathname.startsWith("/customers/posp-misp/"))return"distribution";
 if(pathname==="/tasks"||pathname.startsWith("/tasks/"))return"tasks";
 if(pathname==="/reports"||pathname.startsWith("/reports/"))return"reports";
 if(pathname==="/employees"||pathname.startsWith("/employees/")||pathname==="/customers"||pathname.startsWith("/customers/applications")||pathname==="/vehicles"||pathname.startsWith("/vehicles/")||pathname==="/policies"||pathname.startsWith("/policies/"))return"master-data";
 return null;
}
function isCurrent(href:string,pathname:string,currentQuery:string){const [targetPath,targetQuery=""]=href.split("?");const nested=["/employees","/customers/applications","/customers/posp-misp","/intermediaries"];const nestedMatch=!targetQuery&&nested.includes(targetPath)&&(pathname===targetPath||pathname.startsWith(`${targetPath}/`));if(pathname!==targetPath&&!nestedMatch)return false;if(!targetQuery)return nestedMatch||!currentQuery;const expected=new URLSearchParams(targetQuery);const current=new URLSearchParams(currentQuery);return Array.from(expected.entries()).every(([key,value])=>current.get(key)===value)}
