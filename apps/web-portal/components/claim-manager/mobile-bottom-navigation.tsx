"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CheckSquare2, Gauge, Menu, ShieldCheck, UsersRound } from "lucide-react";
import { hasCapability, type Capability } from "@/lib/roles";

const items:Array<{href:string;label:string;icon:typeof Gauge;capability:Capability|null}>=[
  {href:"/dashboard",label:"Home",icon:Gauge,capability:"view_dashboard"},
  {href:"/claims",label:"Claims",icon:ShieldCheck,capability:"view_claims"},
  {href:"/customers",label:"Customers",icon:UsersRound,capability:"view_customers"},
  {href:"/tasks",label:"Tasks",icon:CheckSquare2,capability:"view_tasks"},
  {href:"/settings",label:"More",icon:Menu,capability:null},
];

export function MobileBottomNavigation({role}:{role:string|null|undefined}) {
  const pathname=usePathname();const visible=items.filter(item=>!item.capability||hasCapability(role,item.capability));
  return <nav className="fixed inset-x-2 bottom-[max(.5rem,env(safe-area-inset-bottom))] z-[80] grid rounded-[22px] border border-[#273454] bg-[#111A35] p-1.5 shadow-[0_22px_60px_rgba(15,24,52,.42)] md:hidden" style={{gridTemplateColumns:`repeat(${visible.length},minmax(0,1fr))`}} aria-label="Mobile quick navigation">{visible.map(item=>{const active=item.href==="/dashboard"?pathname===item.href:pathname===item.href||pathname.startsWith(`${item.href}/`);const Icon=item.icon;return <Link key={item.href} href={item.href} aria-current={active?"page":undefined} className={`flex min-h-[54px] flex-col items-center justify-center gap-1 rounded-[16px] px-1 text-[10px] font-bold ${active?"bg-white text-[#17213e]":"text-[#D7DDF0]"}`}><Icon className={`h-[19px] w-[19px] ${active?"text-[#6759ff]":"text-[#F4F7FF]"}`}/><span className="truncate">{item.label}</span></Link>})}</nav>;
}
