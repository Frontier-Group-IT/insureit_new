"use client";
import { useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Check, ChevronDown, FileText, ShieldCheck, X } from "lucide-react";
import { getStaticInsurerLogo } from "@/lib/insurer-logo";

type Quote = {id:string;name:string;plan:string;idv:number;od:number;tp:number;addons:number;inspection:"Not required"|"Self-inspection"|"Required";included:string[];validity:string};
type Tab = "coverage"|"addons"|"exclusions"|"premium";
const examples:Quote[] = [
 {id:"icici",name:"ICICI Lombard",plan:"Package",idv:702370,od:12500,tp:16000,addons:2000,inspection:"Not required",included:["Zero depreciation","Roadside assistance"],validity:"Demo — not issued"},
 {id:"digit",name:"Digit Insurance",plan:"Package",idv:690000,od:13400,tp:16000,addons:1800,inspection:"Self-inspection",included:["Roadside assistance","Consumables"],validity:"Demo — not issued"},
 {id:"united",name:"United India Insurance",plan:"Package",idv:700000,od:13900,tp:16000,addons:2300,inspection:"Not required",included:["Engine protection","Roadside assistance"],validity:"Demo — not issued"},
 {id:"national",name:"National Insurance",plan:"Package",idv:680000,od:14500,tp:16000,addons:2500,inspection:"Required",included:["Zero depreciation","Consumables"],validity:"Demo — not issued"}
];
const money = (n:number)=>"₹"+new Intl.NumberFormat("en-IN",{maximumFractionDigits:0}).format(n);
const subtotal=(q:Quote)=>q.od+q.tp+q.addons;
const tax=(q:Quote)=>Math.round(subtotal(q)*0.18);
const total=(q:Quote)=>subtotal(q)+tax(q);
function Logo({name}:{name:string}) {const src=getStaticInsurerLogo(name);const [failed,setFailed]=useState(false);return <span className="flex h-11 w-28 items-center justify-center rounded-lg border border-slate-100 bg-white p-1">{src&&!failed?<img src={src} alt={name+" logo"} className="max-h-9 max-w-full object-contain" onError={()=>setFailed(true)}/>:<span className="text-center text-[12px] font-bold text-blue-900">{name}</span>}</span>}
export default function QuoteComparisonDemo({values,selectedAddons,onBack}:{values:Record<string,string>;selectedAddons:string[];onBack:()=>void}) {
 const [cover,setCover]=useState("all"),[inspection,setInspection]=useState("all"),[addonFilter,setAddonFilter]=useState("all"),[sort,setSort]=useState("premium"),[detail,setDetail]=useState<string|null>("icici"),[tab,setTab]=useState<Tab>("coverage"),[chosen,setChosen]=useState<string|null>(null),[proposal,setProposal]=useState(false),[remarks,setRemarks]=useState("");
 const quotes=useMemo(()=>examples.filter(q=>(cover==="all"||q.plan===cover)&&(inspection==="all"||q.inspection===inspection)&&(addonFilter==="all"||(addonFilter==="included"?q.included.length>0:q.included.length===0))).sort((a,b)=>sort==="idv"?b.idv-a.idv:sort==="name"?a.name.localeCompare(b.name):total(a)-total(b)),[cover,inspection,addonFilter,sort]);
 const selected=examples.find(q=>q.id===chosen);
 const active=examples.find(q=>q.id===detail);
 const stepLabel=proposal?"Proposal preview":"Quote Comparison";
 return <div className="space-y-3">
  <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3">
   <div><h1 className="text-[17px] font-bold text-slate-900">{stepLabel} <span className="ml-2 rounded bg-amber-50 px-2 py-1 text-[10px] font-bold text-amber-800">DEMO ONLY</span></h1><p className="text-[11px] text-slate-500">Vehicle → Customer → Coverage → Compare → Proposal → Pay & Issue</p></div>
   <button type="button" onClick={()=>{if(proposal)setProposal(false);else onBack()}} className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-2 text-[11px] font-bold text-blue-800"><ArrowLeft className="h-4 w-4"/>Back</button>
  </div>
  <div className="grid gap-3 rounded-xl border border-slate-200 bg-white p-3 sm:grid-cols-2 lg:grid-cols-5">
   {[["Customer",values.ownerName||"Not entered"],["Vehicle",[values.make,values.model].filter(Boolean).join(" ")||"Not entered"],["Registration / chassis",values.registrationNumber||values.chassisNumber||"Not entered"],["Cover",values.coverageType||"Not selected"],["Business type",values.businessType||"Not selected"]].map(([label,value])=><div key={label} className="min-w-0"><p className="text-[10px] font-semibold text-slate-500">{label}</p><p className="truncate text-[12px] font-bold text-slate-900" title={value}>{value}</p></div>)}
  </div>
  {proposal ? <section className="rounded-xl border border-slate-200 bg-white p-4">
   <h2 className="text-[15px] font-bold text-slate-900">Proposal preview — {selected?.name}</h2><p className="mt-1 text-[11px] font-semibold text-amber-700">No real insurer quotation, binding, payment or policy issuance is performed.</p>
   <div className="mt-4 grid gap-3 sm:grid-cols-3"><div className="rounded-lg bg-slate-50 p-3"><p className="text-[11px] text-slate-500">Illustrative IDV</p><p className="text-lg font-bold">{money(selected?.idv||0)}</p></div><div className="rounded-lg bg-slate-50 p-3"><p className="text-[11px] text-slate-500">Illustrative premium incl. sample tax</p><p className="text-lg font-bold">{money(selected?total(selected):0)}</p></div><div className="rounded-lg bg-slate-50 p-3"><p className="text-[11px] text-slate-500">Selected cover</p><p className="text-lg font-bold">{selected?.plan}</p></div></div>
   <label className="mt-4 block text-[12px] font-bold text-blue-800">Internal operator remarks<textarea className="mt-1 block min-h-20 w-full rounded-lg border border-slate-300 p-3 text-[12px] text-slate-900" value={remarks} onChange={e=>setRemarks(e.target.value)} placeholder="Enter quotation selection notes (not submitted)"/></label>
   <p className="mt-3 rounded-lg bg-blue-50 p-3 text-[11px] text-blue-900">Draft retained only while this page is open. Insurer proposals, customer approval, and payment remain disabled until real integrations are implemented.</p>
  </section> :
  <div className={`grid gap-3 ${active?"xl:grid-cols-[minmax(0,1fr)_360px]":""}`}>
   <div className="space-y-3">
    <div className="flex flex-wrap items-end gap-2 rounded-xl border border-slate-200 bg-white p-3">
     {[["Cover","cover",cover,setCover,["all","Package"]],["Inspection","inspection",inspection,setInspection,["all","Not required","Self-inspection","Required"]],["Add-ons","addons",addonFilter,setAddonFilter,["all","included","none"]],["Sort","sort",sort,setSort,["premium","idv","name"]]].map(([label,key,value,handler,options])=><label key={String(key)} className="min-w-[130px] flex-1 text-[10px] font-bold text-slate-700">{String(label)}<select aria-label={String(label)} value={String(value)} onChange={e=>(handler as (s:string)=>void)(e.target.value)} className="mt-1 h-9 w-full rounded-lg border border-slate-300 bg-white px-2 text-[11px] text-slate-800">{(options as string[]).map(o=><option key={o} value={o}>{o==="all"?"All":o==="included"?"With add-ons":o==="none"?"No add-ons":o==="premium"?"Lowest total":o==="idv"?"Highest IDV":o==="name"?"Insurer A–Z":o}</option>)}</select></label>)}
     <span className="pb-2 text-[11px] font-bold text-slate-600">{quotes.length} sample quotes</span>
    </div>
    {quotes.length===0&&<p className="rounded-lg bg-white p-5 text-[12px] text-slate-600">No demo quotes match these filters.</p>}
    {quotes.map(q=><article key={q.id} className={`rounded-xl border bg-white p-3 shadow-sm ${chosen===q.id?"border-blue-500 ring-1 ring-blue-200":"border-slate-200"}`}>
     <div className="flex flex-wrap items-start justify-between gap-2"><div className="flex items-center gap-3"><Logo name={q.name}/><div><h2 className="text-[13px] font-bold text-slate-900">{q.name}</h2><p className="text-[10px] text-slate-500">Sample insurer response · Package</p></div></div><span className="rounded-full bg-amber-50 px-2 py-1 text-[10px] font-semibold text-amber-800">Sample quotation</span></div>
     <div className="mt-3 grid grid-cols-2 gap-2 border-y border-slate-100 py-3 sm:grid-cols-4">{[["IDV",money(q.idv)],["Add-ons",String(q.included.length)],["Inspection",q.inspection],["Total payable",money(total(q))]].map(([label,value])=><div key={label}><p className="text-[10px] text-slate-500">{label}</p><p className="text-[13px] font-bold text-slate-900">{value}</p></div>)}</div>
     <div className="mt-3 flex flex-wrap items-center justify-between gap-2"><span className="text-[10px] text-slate-500">Illustrative values · No actual quote validity</span><div className="flex gap-2"><button type="button" onClick={()=>{setDetail(q.id);setTab("coverage")}} className="rounded-lg border border-blue-200 px-3 py-2 text-[11px] font-bold text-blue-800">View details</button><button type="button" onClick={()=>{setChosen(q.id);setDetail(q.id)}} className={`rounded-lg px-3 py-2 text-[11px] font-bold ${chosen===q.id?"bg-emerald-600 text-white":"bg-[#173965] text-white"}`}>{chosen===q.id?"Selected":"Select quote"}</button></div></div>
    </article>)}
    {selected&&<div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-blue-200 bg-blue-50 p-3"><span className="text-[12px] font-bold text-blue-900">Selected: {selected.name} · {money(total(selected))} (demo)</span><button type="button" onClick={()=>setProposal(true)} className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-4 py-2 text-[12px] font-bold text-white">Proceed to proposal preview <ArrowRight className="h-4 w-4"/></button></div>}
   </div>
   {active&&<aside className="self-start rounded-xl border border-slate-200 bg-white shadow-sm xl:sticky xl:top-4">
    <div className="flex items-center justify-between border-b border-slate-100 p-3"><h2 className="text-[13px] font-bold text-slate-900">{active.name} — Details</h2><button type="button" aria-label="Close quote details" onClick={()=>setDetail(null)}><X className="h-4 w-4 text-slate-500"/></button></div>
    <div className="flex gap-1 overflow-x-auto border-b border-slate-100 p-2">{(["coverage","addons","exclusions","premium"] as Tab[]).map(t=><button key={t} type="button" onClick={()=>setTab(t)} className={`whitespace-nowrap rounded-md px-2 py-2 text-[10px] font-bold capitalize ${tab===t?"bg-blue-50 text-blue-800":"text-slate-500"}`}>{t==="premium"?"Premium breakup":t}</button>)}</div>
    <div className="min-h-[220px] space-y-3 p-3 text-[12px] text-slate-700">
     {tab==="coverage"&&<><p className="font-bold">Typical package cover examples (not insurer-confirmed)</p>{["Own vehicle accidental damage subject to policy terms","Third-party liability subject to policy terms","Theft and fire subject to policy terms"].map(v=><p key={v} className="flex gap-2"><Check className="h-4 w-4 shrink-0 text-emerald-600"/>{v}</p>)}</>}
     {tab==="addons"&&<><p className="font-bold">Illustrative add-ons</p>{active.included.map(a=><p key={a} className="rounded-lg bg-slate-50 p-2">{a}</p>)}<p className="text-[11px] text-slate-500">Requested on intake: {selectedAddons.length?selectedAddons.join(", "):"None"}</p></>}
     {tab==="exclusions"&&<><p className="font-bold">Illustrative exclusions</p><p>Wear and tear, intentional damage and policy-specific exclusions may apply. Actual insurer wording is required.</p><p className="rounded-lg bg-amber-50 p-2 text-amber-800">No exclusions have been verified with an insurer.</p></>}
     {tab==="premium"&&<><p className="font-bold">Sample premium reconciliation</p>{[["OD",active.od],["TP",active.tp],["Add-ons",active.addons],["Subtotal",subtotal(active)],["Sample tax at 18%",tax(active)],["Total",total(active)]].map(([k,v])=><div key={String(k)} className="flex justify-between border-b border-slate-100 pb-2"><span>{k}</span><strong>{money(Number(v))}</strong></div>)}<p className="text-[10px] text-amber-700">Tax rate is a demo assumption, not a statement of current tax treatment.</p></>}
    </div>
    <div className="border-t border-slate-100 p-3"><button type="button" onClick={()=>setChosen(active.id)} className="w-full rounded-lg bg-[#173965] p-2.5 text-[12px] font-bold text-white">{chosen===active.id?"Quote selected":"Select sample quote"}</button></div>
   </aside>}
  </div>}
 </div>;
}
