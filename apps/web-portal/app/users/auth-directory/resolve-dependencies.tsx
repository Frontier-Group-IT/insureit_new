"use client";
import { useState } from "react";
import { inspectIdentityDependencies,resolveGroupAdminContact } from "./dependency-actions";
type Info=Awaited<ReturnType<typeof inspectIdentityDependencies>>;
export function ResolveDependencies({userId}:{userId:string}){
 const [open,setOpen]=useState(false);
 const [data,setData]=useState<Info|null>(null);
 const [loading,setLoading]=useState(false);
 const [error,setError]=useState("");
 const [replacement,setReplacement]=useState("");
 const [confirmation,setConfirmation]=useState("");
 const [mode,setMode]=useState<"remove_test"|"reassign">("remove_test");
 const [groupId,setGroupId]=useState("");
 async function refresh(){
  setLoading(true);setError("");
  try{setData(await inspectIdentityDependencies(userId));}catch(e){setError(e instanceof Error?e.message:"Cannot load dependencies.");}
  finally{setLoading(false);}
 }
 async function submit(){
  const target=data?.groups.find(g=>g.group_id===groupId);
  if(!target)return;
  setLoading(true);setError("");
  try{
   const result=await resolveGroupAdminContact(userId,groupId,mode,confirmation,replacement||undefined);
   setData(result);setConfirmation("");setReplacement("");setGroupId("");
  }catch(e){setError(e instanceof Error?e.message:"Resolution failed.");}
  finally{setLoading(false);}
 }
 const selected=data?.groups.find(g=>g.group_id===groupId);
 const expected=selected?(mode==="remove_test"?"REMOVE CONTACT ":"REASSIGN ")+selected.group_name:"";
 return <section className="mt-3 rounded-xl border border-slate-300 bg-white p-3 text-xs">
  <button type="button" className="font-semibold text-[#17365D] underline" onClick={()=>{setOpen(!open);if(!open)void refresh();}}>Resolve Dependencies</button>
  {open&&<div className="mt-3 space-y-3">
   <p className="text-slate-600">Review all deletion blockers. Only supported relationships offer resolution actions; all others remain protected.</p>
   <button type="button" disabled={loading} onClick={()=>void refresh()} className="rounded border px-3 py-1.5">{loading?"Checking…":"Recheck dependencies"}</button>
   {data&&<div className="space-y-2">
    {data.blockers.length===0?<p className="font-semibold text-green-700">No protected profile dependencies found. Reattempt deletion through the separate confirmation above.</p>:data.blockers.map((b,i)=><div key={i} className="rounded border bg-slate-50 p-2"><strong>{b.table}</strong> · {b.column} · {b.count} linked record(s) · {b.delete_rule}{b.table!=="group_administrator_contacts"&&<span className="ml-2 text-amber-700">Manual review required; no automatic reassignment</span>}</div>)}
    {data.groups.map(g=><div key={g.group_id} className="rounded-lg border border-amber-200 p-3">
      <div className="font-bold">{g.group_name} <span className="font-normal text-slate-500">({g.group_status})</span></div>
      <div className="mt-1 text-slate-600">Current administrator: {g.admin_name} · {g.admin_email}</div>
      <button type="button" className="mt-2 rounded border px-3 py-1.5" onClick={()=>{setGroupId(g.group_id);setMode("remove_test");setConfirmation("");}}>Resolve this relationship</button>
     </div>)}
   </div>}
   {selected&&<div className="space-y-2 rounded-lg border border-red-200 bg-red-50 p-3">
    <strong>Resolve group: {selected.group_name}</strong>
    <label className="block"><input type="radio" checked={mode==="remove_test"} onChange={()=>{setMode("remove_test");setConfirmation("");}}/> Remove test administrator association (group and business records remain)</label>
    <label className="block"><input type="radio" checked={mode==="reassign"} onChange={()=>{setMode("reassign");setConfirmation("");}}/> Reassign to another active intermediary</label>
    {mode==="reassign"&&<label className="block">Replacement profile UUID<input value={replacement} onChange={e=>setReplacement(e.target.value)} placeholder="Active intermediary profile UUID" className="mt-1 w-full rounded border p-2"/></label>}
    <label className="block">Type <strong>{expected}</strong> to confirm<input value={confirmation} onChange={e=>setConfirmation(e.target.value)} className="mt-1 w-full rounded border p-2"/></label>
    <button type="button" disabled={loading||confirmation!==expected||(mode==="reassign"&&!replacement.trim())} onClick={()=>void submit()} className="rounded bg-red-700 px-3 py-2 font-bold text-white disabled:opacity-40">Confirm relationship change</button>
    <button type="button" onClick={()=>{setGroupId("");setConfirmation("");}} className="ml-2 rounded border px-3 py-2">Cancel</button>
   </div>}
   {error&&<p role="alert" className="text-red-700">{error}</p>}
  </div>}
 </section>;
}
