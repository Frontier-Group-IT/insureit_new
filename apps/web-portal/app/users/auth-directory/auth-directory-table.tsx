"use client";

import { useMemo, useState } from "react";
import { AdminPasswordReset } from "../admin-password-reset";
import { IdentityRemoval } from "./identity-removal";

export type DirectoryRow = {
  id:string; name:string; role:string; accountType:string; organization:string;
  authEmail:string; profileEmail:string; loginMethod:string; status:string;
  confirmed:boolean; lastSignIn:string|null; createdAt:string; identityStatus:string;
  warning:string[];
};
const compact = "rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs outline-none focus:border-blue-500";
function date(v:string|null) { return v ? new Date(v).toLocaleString("en-IN", {day:"2-digit",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"}) : "Never"; }
export function AuthDirectoryTable({rows,requestedUserId=null}:{rows:DirectoryRow[];requestedUserId?:string|null}) {
  const [query,setQuery]=useState("");
  const [type,setType]=useState("");
  const [role,setRole]=useState("");
  const [state,setState]=useState("");
  const [selected,setSelected]=useState<DirectoryRow|null>(()=>rows.find(row=>row.id===requestedUserId)??null);
  const types=useMemo(()=>Array.from(new Set(rows.map(r=>r.accountType))).sort(),[rows]);
  const roles=useMemo(()=>Array.from(new Set(rows.map(r=>r.role))).sort(),[rows]);
  const filtered=useMemo(()=>rows.filter(r=>{
    const searchable=[r.name,r.role,r.accountType,r.organization,r.loginMethod,r.id,...r.warning, ...(r.loginMethod==="Phone"?[]:[r.authEmail,r.profileEmail])].join(" ").toLowerCase();
    return searchable.includes(query.trim().toLowerCase())&&(!type||r.accountType===type)&&(!role||r.role===role)&&(!state||(state==="confirmed"?r.confirmed:state==="unconfirmed"?!r.confirmed:state==="active"?r.status==="Active":state==="inactive"?r.status==="Inactive":r.warning.length>0));
  }),[rows,query,type,role,state]);
  const cards=[["All Users",rows.length,""],["Confirmed",rows.filter(r=>r.confirmed).length,"confirmed"],["Unconfirmed",rows.filter(r=>!r.confirmed).length,"unconfirmed"],["Active",rows.filter(r=>r.status==="Active").length,"active"],["Inactive",rows.filter(r=>r.status==="Inactive").length,"inactive"],["Customers",rows.filter(r=>r.accountType==="Customer").length,"customer"],["Issues",rows.filter(r=>r.warning.length).length,"issues"]];
  return <div className="space-y-3">
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-7">
      {cards.map(([label,count,filter])=><button type="button" key={label} onClick={()=>{if(filter==="customer"){setType("Customer");setState("");}else{setType("");setState(filter===state?"":String(filter));}}} className="rounded-xl border border-slate-200 bg-white p-3 text-left shadow-sm hover:bg-blue-50"><div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{label}</div><div className="mt-1 text-xl font-bold text-slate-900">{count}</div></button>)}
    </div>
    <div className="flex flex-wrap gap-2 rounded-xl border border-slate-200 bg-white p-3">
      <input className={compact+" min-w-[230px] flex-1"} aria-label="Search users" placeholder="Search name, email, organization, role or ID" value={query} onChange={e=>setQuery(e.target.value)}/>
      <select className={compact} aria-label="Account type" value={type} onChange={e=>setType(e.target.value)}><option value="">All account types</option>{types.map(x=><option key={x}>{x}</option>)}</select>
      <select className={compact} aria-label="Role" value={role} onChange={e=>setRole(e.target.value)}><option value="">All roles</option>{roles.map(x=><option key={x}>{x}</option>)}</select>
      <select className={compact} aria-label="Status" value={state} onChange={e=>setState(e.target.value)}><option value="">All statuses</option><option value="confirmed">Confirmed</option><option value="unconfirmed">Unconfirmed</option><option value="active">Active</option><option value="inactive">Inactive</option><option value="issues">Needs review</option></select>
      <button type="button" onClick={()=>{setQuery("");setType("");setRole("");setState("");}} className={compact}>Clear</button>
    </div>
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
      <table className="w-full min-w-[1250px] text-left text-[11px]">
        <thead className="bg-slate-100 text-[10px] uppercase tracking-wide text-slate-600"><tr>{["Name / User ID","Role","Account Type","Company / Branch","Login Method","Login ID","Auth","Profile","Last Sign In","Created","Actions"].map(x=><th key={x} className="whitespace-nowrap px-3 py-3 font-bold">{x}</th>)}</tr></thead>
        <tbody>{filtered.map(r=><tr key={r.id} className="border-t border-slate-100 hover:bg-slate-50">
          <td className="px-3 py-3"><div className="max-w-[180px] truncate font-bold text-slate-900">{r.name}</div><div className="mt-1 max-w-[170px] truncate text-[9px] text-slate-400" title={r.id}>{r.id}</div>{r.warning.length>0&&<span title={r.warning.join("; ")} className="mt-1 inline-flex rounded bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold text-amber-900">Needs review · {r.warning.length}</span>}</td>
          <td className="px-3 py-3">{r.role}</td><td className="px-3 py-3">{r.accountType}</td><td className="max-w-[170px] px-3 py-3">{r.organization||"—"}</td>
          <td className="px-3 py-3">{r.loginMethod}</td><td className="max-w-[210px] break-all px-3 py-3">{r.loginMethod==="Phone"?"Hidden · phone login":r.authEmail||"—"}</td>
          <td className="px-3 py-3"><span className={r.confirmed?"font-semibold text-emerald-700":"font-semibold text-amber-700"}>{r.confirmed?"Confirmed":"Unconfirmed"}</span></td>
          <td className="px-3 py-3">{r.status}</td><td className="whitespace-nowrap px-3 py-3">{date(r.lastSignIn)}</td><td className="whitespace-nowrap px-3 py-3">{date(r.createdAt)}</td>
          <td className="px-3 py-3"><button type="button" onClick={()=>setSelected(r)} className="rounded-lg bg-[#17365D] px-3 py-2 font-semibold text-white">View / Reset</button></td>
        </tr>)}</tbody>
      </table>
      {!filtered.length&&<div className="p-8 text-center text-sm text-slate-500">No matching users found.</div>}
    </div>
    <div className="text-xs text-slate-500">Showing {filtered.length} of {rows.length} Auth accounts. Customer phone numbers are not displayed.</div>
    {selected&&<div className="fixed inset-0 z-[1100] flex items-center justify-center bg-slate-950/65 p-3" onMouseDown={e=>{if(e.target===e.currentTarget)setSelected(null);}}>
      <section role="dialog" aria-modal="true" aria-label="User identity and password reset" className="max-h-[90dvh] w-full max-w-[720px] overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-3"><div><h2 className="text-lg font-bold">{selected.name}</h2><p className="text-xs text-slate-500">{selected.accountType} · {selected.role}</p></div><button type="button" className={compact} onClick={()=>setSelected(null)}>Close ✕</button></div>
        <dl className="mt-4 grid grid-cols-1 gap-3 rounded-xl bg-slate-50 p-4 text-xs sm:grid-cols-2">{[["User ID",selected.id],["Organization / Branch",selected.organization||"—"],["Login Method",selected.loginMethod],["Auth Login",selected.loginMethod==="Phone"?"Hidden · phone login":selected.authEmail||"—"],["Profile Email",selected.loginMethod==="Phone"?"Hidden":selected.profileEmail||"—"],["Auth Status",selected.confirmed?"Confirmed":"Unconfirmed"],["Profile",selected.status],["Identity",selected.identityStatus],["Last Sign In",date(selected.lastSignIn)],["Created",date(selected.createdAt)]].map(([key,value])=><div key={key}><dt className="mb-1 font-semibold text-slate-500">{key}</dt><dd className="break-all font-medium text-slate-900">{value}</dd></div>)}</dl>
        {selected.warning.length>0&&<div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900"><strong>Identity warnings</strong>{selected.warning.map(x=><div key={x}>• {x}</div>)}</div>}
        {selected.loginMethod==="Phone"&&selected.accountType==="Customer"?<p className="mt-4 rounded-lg border p-3 text-xs">Customer phone login is managed through the customer authentication flow. Confirm account identity before modifying email/password credentials.</p>:<div className="mt-4"><AdminPasswordReset key={selected.id} userId={selected.id}/></div>}
        <IdentityRemoval key={selected.id} id={selected.id} name={selected.name} email={selected.loginMethod==="Email"?selected.authEmail:""} role={selected.role}/>
      </section>
    </div>}
  </div>;
}
