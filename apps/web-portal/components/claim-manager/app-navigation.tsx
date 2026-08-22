"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { BarChart3, CheckSquare2, ChevronRight, ClipboardList, FileCheck2, FlaskConical, Gauge, LayoutGrid, Plus, Settings, ShieldCheck, Sparkles, Upload, UserCog, UserPlus, UsersRound } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { BrandLockup } from "@/components/brand-lockup";
import { internalLaunchHome, isIntermediaryOnlyLaunch } from "@/lib/launch-scope";
import type { Capability } from "@/lib/roles";
import type { PermissionAccess } from "@/lib/permission-management";

type SectionKey="claims"|"distribution"|"master-data"|"customers"|"fleet"|"tasks"|"reports"|"development";
type ActiveNav="dashboard"|SectionKey|"none";
export type NavigationItem={kind?:"item";href:string;label:string;icon:LucideIcon;capability:Capability;minimumAccess?:Exclude<PermissionAccess,"none">};
export type NavigationGroup={kind:"group";key:string;label:string;icon:LucideIcon;capability:Capability;minimumAccess?:Exclude<PermissionAccess,"none">;items:NavigationItem[]};
export type NavigationNode=NavigationItem|NavigationGroup;
export type NavigationSection={key:SectionKey;label:string;icon:LucideIcon;tint:string;capability:Capability;anyCapabilities?:Capability[];minimumAccess?:Exclude<PermissionAccess,"none">;items:NavigationNode[]};
type PermissionAccessMap=Partial<Record<Capability,PermissionAccess>>;
type Props={activeNav:ActiveNav;role:string|null|undefined;permissionAccess:PermissionAccessMap};

export const navigationSections:NavigationSection[]=[
 {key:"tasks",label:"Tasks",icon:CheckSquare2,tint:"from-[#17c7c9] to-[#62ddd3]",capability:"view_tasks",items:[
  {href:"/tasks",label:"All Tasks",icon:CheckSquare2,capability:"view_tasks"}
 ]},
 {key:"customers",label:"Customers",icon:UsersRound,tint:"from-[#6759ff] to-[#8f7cff]",capability:"view_customers",items:[
  {href:"/customers",label:"Customer Register",icon:UsersRound,capability:"view_customers"},
  {href:"/customers?choose_partner=1",label:"Add Customer",icon:Plus,capability:"manage_customers"},
  {href:"/customers/applications",label:"Onboarding Applications",icon:FileCheck2,capability:"review_kyc"}
 ]},
 {key:"fleet",label:"Fleet & Policies",icon:Gauge,tint:"from-[#3156b8] to-[#6759ff]",capability:"view_vehicles",anyCapabilities:["view_vehicles","view_policies","create_vehicles","create_policies","create_external_policies"],items:[
  {kind:"group",key:"vehicles",label:"Vehicles",icon:Gauge,capability:"view_vehicles",items:[
   {href:"/vehicles",label:"Vehicle Register",icon:Gauge,capability:"view_vehicles"},
   {href:"/vehicles/new",label:"Add Vehicle",icon:Plus,capability:"view_vehicles",minimumAccess:"edit"},
   {href:"/vehicles/new",label:"Add Vehicle",icon:Plus,capability:"create_vehicles",minimumAccess:"edit"}
  ]},
  {kind:"group",key:"policies",label:"Policies",icon:ShieldCheck,capability:"view_policies",items:[
   {href:"/policies",label:"Policy Register",icon:ShieldCheck,capability:"view_policies"},
   {href:"/policies/new",label:"Add Policy",icon:Plus,capability:"view_policies",minimumAccess:"edit"},
   {href:"/policies/new",label:"Add Policy",icon:Plus,capability:"create_policies",minimumAccess:"edit"},
   {href:"/policies/external",label:"External Policies",icon:ShieldCheck,capability:"view_policies"},
   {href:"/policies/external/new",label:"Add External Policy",icon:Plus,capability:"view_policies",minimumAccess:"edit"},
   {href:"/policies/external/new",label:"Add External Policy",icon:Plus,capability:"create_external_policies",minimumAccess:"edit"}
  ]}
 ]},
 {key:"claims",label:"Claims",icon:ShieldCheck,tint:"from-[#ff6f61] to-[#ff9f68]",capability:"view_claims",items:[
  {href:"/claims",label:"All Claims",icon:ClipboardList,capability:"view_claims"}
 ]},
 {key:"distribution",label:"Intermediaries",icon:Sparkles,tint:"from-[#17c7c9] to-[#6759ff]",capability:"view_intermediaries",items:[
  {kind:"group",key:"intermediary-onboarding",label:"Onboarding",icon:FileCheck2,capability:"view_intermediaries",items:[
   {href:"/customers/posp-misp",label:"Pending Applications",icon:FileCheck2,capability:"view_intermediaries"}
  ]},
  {kind:"group",key:"partners",label:"Partners",icon:UsersRound,capability:"view_intermediaries",items:[
   {href:"/intermediaries/partner",label:"All Partners",icon:UsersRound,capability:"view_intermediaries"},
   {href:"/intermediaries/portal-users",label:"Portal Users",icon:UserCog,capability:"review_intermediary_application"}
  ]},
  {kind:"group",key:"posp",label:"POSP",icon:UsersRound,capability:"view_intermediaries",items:[
   {href:"/intermediaries/posp",label:"All POSP",icon:UsersRound,capability:"view_intermediaries"},
   {href:"/intermediaries/posp/new",label:"Add POSP",icon:UserPlus,capability:"create_intermediary_application"},
   {href:"/customers/posp-misp/existing/new?partner_type=posp",label:"Add Existing POSP",icon:UserPlus,capability:"create_intermediary_application"}
  ]},
  {kind:"group",key:"misp",label:"MISP",icon:UsersRound,capability:"view_intermediaries",items:[
   {href:"/intermediaries/misp",label:"All MISP",icon:UsersRound,capability:"view_intermediaries"},
   {href:"/intermediaries/misp/new",label:"Add MISP",icon:UserPlus,capability:"create_intermediary_application"},
   {href:"/customers/posp-misp/existing/new?partner_type=misp",label:"Add Existing MISP",icon:UserPlus,capability:"create_intermediary_application"}
  ]}
 ]},
 {key:"reports",label:"Reports",icon:BarChart3,tint:"from-[#3156b8] to-[#17bfc5]",capability:"view_reports",items:[
  {href:"/reports",label:"Reporting Workspace",icon:BarChart3,capability:"view_reports"}
 ]},
 {key:"master-data",label:"Administration",icon:LayoutGrid,tint:"from-[#475569] to-[#6759ff]",capability:"view_employees",anyCapabilities:["view_employees","manage_master_data","manage_users"],items:[
  {kind:"group",key:"employees",label:"Employees",icon:UsersRound,capability:"view_employees",items:[
   {href:"/employees",label:"Employee Directory",icon:UsersRound,capability:"view_employees"},
   {href:"/employees/new",label:"Add Employee",icon:UserPlus,capability:"manage_employees",minimumAccess:"edit"}
  ]},
  {kind:"group",key:"reference-master",label:"Master Data",icon:Settings,capability:"manage_master_data",items:[
   {href:"/master-data/insurance-companies",label:"Insurance Companies",icon:ShieldCheck,capability:"manage_master_data"},
   {href:"/master-data/insurance-companies/new",label:"Add Insurance Company",icon:Plus,capability:"manage_master_data",minimumAccess:"edit"},
   {href:"/master-data/vehicle-manufacturers",label:"Vehicle Manufacturers",icon:Settings,capability:"manage_master_data"},
   {href:"/master-data/vehicle-manufacturers/new",label:"Add Manufacturer",icon:Plus,capability:"manage_master_data",minimumAccess:"edit"}
  ]},
  {kind:"group",key:"governance",label:"Audit & Governance",icon:ShieldCheck,capability:"manage_users",items:[
   {href:"/reports/governance",label:"Governance Audit",icon:ShieldCheck,capability:"manage_users"}
  ]}
 ]}
];

const developmentSection:NavigationSection={key:"development",label:"Development",icon:FlaskConical,tint:"from-[#7C3AED] to-[#2563EB]",capability:"manage_system",items:[
 {href:"/policies/ocr-training",label:"OCR Training",icon:FileCheck2,capability:"manage_system"},
 {href:"/customers/posp-misp/icall-uat",label:"iCall UAT Integration",icon:FlaskConical,capability:"manage_system"},
 {href:"/customers/posp-misp/import",label:"Bulk POSP / MISP Import",icon:Upload,capability:"manage_system"},
 {href:"/customers/posp-misp/import/batches",label:"Import History",icon:ClipboardList,capability:"manage_system"}
]};

const permissionRank:Record<PermissionAccess,number>={none:0,view:1,edit:2,approve:3};
export function permits(permissionAccess:PermissionAccessMap,capability:Capability,minimumAccess:Exclude<PermissionAccess,"none">="view"){return permissionRank[permissionAccess[capability]??"none"]>=permissionRank[minimumAccess]}
function dedupeNavigationItems(items:NavigationItem[]){const seen=new Set<string>();return items.filter(item=>{const key=`${item.href}::${item.label}`;if(seen.has(key))return false;seen.add(key);return true})}
function permitsSection(permissionAccess:PermissionAccessMap,section:NavigationSection){if(section.anyCapabilities?.length)return section.anyCapabilities.some(capability=>permits(permissionAccess,capability,section.minimumAccess));return permits(permissionAccess,section.capability,section.minimumAccess)}
export function visibleNavigationSections(role:string|null|undefined,permissionAccess:PermissionAccessMap){const filterNode=(node:NavigationNode):NavigationNode|null=>{if(!permits(permissionAccess,node.capability,node.minimumAccess))return null;if(node.kind!=="group")return node;const items=dedupeNavigationItems(node.items.filter(item=>permits(permissionAccess,item.capability,item.minimumAccess)));return items.length?{...node,items}:null};const availableSections=isIntermediaryOnlyLaunch?navigationSections.filter(section=>section.key==="distribution"):navigationSections;const sections=availableSections.filter(section=>permitsSection(permissionAccess,section)).map(section=>({...section,items:section.items.map(filterNode).filter((node):node is NavigationNode=>Boolean(node))})).filter(section=>section.items.length);return !isIntermediaryOnlyLaunch&&role==="it_super_user"&&permits(permissionAccess,"manage_system","approve")?[...sections,developmentSection]:sections}

export function AppNavigation({activeNav,role,permissionAccess}:Props){
 const pathname=usePathname();const searchParams=useSearchParams();const sections=useMemo(()=>visibleNavigationSections(role,permissionAccess),[role,permissionAccess]);const routeSection=sectionForPath(pathname);const resolved=routeSection??(activeNav!=="dashboard"&&activeNav!=="none"?activeNav:null);const[openSection,setOpenSection]=useState<SectionKey|null>(resolved);const[openGroups,setOpenGroups]=useState<Record<string,boolean>>({});const currentQuery=searchParams.toString();
 useEffect(()=>{if(resolved&&sections.some(section=>section.key===resolved))setOpenSection(resolved);for(const section of sections){for(const node of section.items){if(node.kind==="group"&&node.items.some(item=>isCurrent(item.href,pathname,currentQuery)))setOpenGroups(current=>({...current,[`${section.key}:${node.key}`]:true}))}}},[pathname,currentQuery,resolved,sections]);
 return <aside className="fixed inset-y-0 left-0 z-50 hidden w-[268px] overflow-hidden border-r border-white/10 bg-[#111a35] text-white shadow-[20px_0_60px_rgba(17,26,53,0.22)] lg:flex lg:flex-col"><div className="pointer-events-none absolute inset-0 overflow-hidden"><div className="absolute -left-20 top-14 h-52 w-52 rounded-full bg-[#6759ff]/25 blur-3xl"/><div className="absolute -right-20 bottom-20 h-56 w-56 rounded-full bg-[#17c7c9]/15 blur-3xl"/><div className="portal-noise absolute inset-0 opacity-20"/></div><Link href={internalLaunchHome} prefetch={false} className="relative flex h-[78px] items-center border-b border-white/10 px-5" aria-label="InsureIt home"><BrandLockup compact inverse/></Link><nav className="relative flex-1 overflow-y-auto px-3.5 py-4">{!isIntermediaryOnlyLaunch&&permits(permissionAccess,"view_dashboard")?<Link href="/dashboard" prefetch={false} className={`group mb-2 flex h-12 items-center gap-3 rounded-2xl px-3.5 text-[12px] font-bold transition-all duration-200 ease-out motion-reduce:transform-none hover:translate-x-0.5 hover:shadow-[0_8px_20px_rgba(4,10,28,.18)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/45 ${activeNav==="dashboard"&&!routeSection?"bg-white text-[#141d3b] shadow-[0_14px_35px_rgba(0,0,0,.18)] hover:bg-white":"text-white/90 hover:bg-white/10 hover:text-white"}`}><span className="grid h-8 w-8 place-items-center rounded-xl bg-gradient-to-br from-[#66B5FF] via-[#2F6BFF] to-[#1746C8] text-white transition-transform duration-200 ease-out motion-reduce:transform-none group-hover:scale-105"><Gauge className="h-4 w-4"/></span><span className="flex-1">Dashboard</span></Link>:null}{sections.length?<p className="mb-2 mt-6 px-3 text-[9px] font-black uppercase tracking-[0.18em] text-white/65">{isIntermediaryOnlyLaunch?"Production workspace":"Workspaces"}</p>:null}<div className="space-y-1.5">{sections.map(section=>{const open=openSection===section.key;const active=resolved===section.key;const SectionIcon=section.icon;return <div key={section.key} className={`overflow-hidden rounded-2xl border ${active?"border-white/15 bg-white/10":"border-transparent"}`}><button type="button" onClick={()=>setOpenSection(current=>current===section.key?null:section.key)} className="group flex h-11 w-full items-center gap-3 rounded-2xl px-3.5 text-left text-[12px] font-bold text-white transition-all duration-200 ease-out motion-reduce:transform-none hover:translate-x-0.5 hover:bg-white/10 hover:shadow-[0_8px_20px_rgba(4,10,28,.18)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/45"><span className={`grid h-8 w-8 place-items-center rounded-xl bg-gradient-to-br transition-transform duration-200 ease-out motion-reduce:transform-none group-hover:scale-105 ${section.tint}`}><SectionIcon className="h-4 w-4"/></span><span className="flex-1">{section.label}</span><ChevronRight className={`h-4 w-4 transition-transform duration-200 ease-out motion-reduce:transform-none group-hover:translate-x-0.5 ${open?"rotate-90":""}`}/></button>{open?<div className="space-y-1 px-2.5 pb-2.5 pl-[42px]">{section.items.map(node=>node.kind==="group"?<NavigationGroupView key={node.key} sectionKey={section.key} group={node} pathname={pathname} currentQuery={currentQuery} open={Boolean(openGroups[`${section.key}:${node.key}`])} onToggle={()=>setOpenGroups(current=>({...current,[`${section.key}:${node.key}`]:!current[`${section.key}:${node.key}`]}))}/>:<NavigationLink key={node.href} item={node} pathname={pathname} currentQuery={currentQuery}/>)}</div>:null}</div>})}</div></nav>{!isIntermediaryOnlyLaunch&&permits(permissionAccess,"manage_system","approve")?<div className="relative border-t border-white/10 p-3.5"><Link href="/settings" prefetch={false} className="group flex h-11 items-center gap-3 rounded-2xl px-3.5 text-[12px] font-bold text-white/88 transition-all duration-200 ease-out motion-reduce:transform-none hover:translate-x-0.5 hover:bg-white/10 hover:text-white hover:shadow-[0_8px_20px_rgba(4,10,28,.18)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/45"><span className="grid h-8 w-8 place-items-center rounded-xl bg-white/10 transition-transform duration-200 ease-out motion-reduce:transform-none group-hover:scale-105"><Settings className="h-4 w-4"/></span><span>Settings</span></Link></div>:null}</aside>
}
function NavigationGroupView({sectionKey,group,pathname,currentQuery,open,onToggle}:{sectionKey:SectionKey;group:NavigationGroup;pathname:string;currentQuery:string;open:boolean;onToggle:()=>void}){const Icon=group.icon;const active=group.items.some(item=>isCurrent(item.href,pathname,currentQuery));return <div className="rounded-xl"><button type="button" onClick={onToggle} className={`group flex min-h-9 w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left text-[10.5px] font-semibold transition-all duration-200 ease-out motion-reduce:transform-none hover:translate-x-0.5 hover:shadow-[0_8px_20px_rgba(4,10,28,.18)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/45 ${active?"bg-white/12 text-white hover:bg-white/[0.16]":"text-white/82 hover:bg-white/10 hover:text-white"}`}><Icon className="h-3.5 w-3.5 transition-transform duration-200 ease-out motion-reduce:transform-none group-hover:scale-105"/><span className="flex-1 truncate">{group.label}</span><ChevronRight className={`h-3.5 w-3.5 transition-transform duration-200 ease-out motion-reduce:transform-none group-hover:translate-x-0.5 ${open?"rotate-90":""}`}/></button>{open?<div className="ml-3 mt-1 space-y-1 border-l border-white/12 pl-2">{group.items.map(item=><NavigationLink key={`${sectionKey}:${item.href}`} item={item} pathname={pathname} currentQuery={currentQuery}/>)}</div>:null}</div>}
function NavigationLink({item,pathname,currentQuery}:{item:NavigationItem;pathname:string;currentQuery:string}){const active=isCurrent(item.href,pathname,currentQuery);const Icon=item.icon;return <Link href={item.href} prefetch={false} title={item.label} className={`group flex min-h-9 items-center gap-2 rounded-xl px-2.5 py-2 text-[10.5px] font-semibold transition-all duration-200 ease-out motion-reduce:transform-none hover:translate-x-0.5 hover:shadow-[0_8px_20px_rgba(4,10,28,.18)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/45 ${active?"bg-white text-[#17213e] hover:bg-white":"text-white/82 hover:bg-white/10 hover:text-white"}`}><Icon className={`h-3.5 w-3.5 transition-transform duration-200 ease-out motion-reduce:transform-none group-hover:scale-105 ${active?"text-[#6759ff]":"text-white/60"}`}/><span className="truncate">{item.label}</span></Link>}
export function sectionForPath(pathname:string):SectionKey|null{if(pathname==="/policies/ocr-training"||pathname.startsWith("/policies/ocr-training/")||pathname==="/customers/posp-misp/icall-uat"||pathname==="/customers/posp-misp/import"||pathname.startsWith("/customers/posp-misp/import/"))return"development";if(pathname==="/tasks"||pathname.startsWith("/tasks/"))return"tasks";if(pathname==="/claims"||pathname.startsWith("/claims/"))return"claims";if(pathname==="/intermediaries"||pathname.startsWith("/intermediaries/")||pathname==="/customers/posp-misp"||pathname.startsWith("/customers/posp-misp/"))return"distribution";if(pathname==="/reports/governance"||pathname.startsWith("/reports/governance/"))return"master-data";if(pathname==="/reports"||pathname.startsWith("/reports/"))return"reports";if(pathname==="/master-data"||pathname.startsWith("/master-data/")||pathname==="/insurance-companies"||pathname.startsWith("/insurance-companies/")||pathname==="/employees"||pathname.startsWith("/employees/"))return"master-data";if(pathname==="/customers"||pathname.startsWith("/customers/")||pathname==="/customer-kyc"||pathname.startsWith("/customer-kyc/"))return"customers";if(pathname==="/vehicles"||pathname.startsWith("/vehicles/")||pathname==="/policies"||pathname.startsWith("/policies/"))return"fleet";return null}
export function isCurrent(href:string,pathname:string,currentQuery:string){const[targetPath,targetQuery=""]=href.split("?");if(pathname!==targetPath)return false;if(!targetQuery)return currentQuery.length===0;const expected=new URLSearchParams(targetQuery);const current=new URLSearchParams(currentQuery);return Array.from(expected.entries()).every(([key,value])=>current.get(key)===value)}
