"use client";

import { useMemo, useState, useTransition } from "react";
import { AlertTriangle, ChevronDown, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { deleteUnlinkedGroup, getGroupDeletePartners, removePartnersBeforeGroupDelete } from "./it-group-delete-action";

export function ItGroupDeletePanel({groups}:{groups:{id:string;name:string;code:string}[]}) {
  const router=useRouter();
  const [expanded,setExpanded]=useState(false);
  const [selectedId,setSelectedId]=useState("");
  const [confirmText,setConfirmText]=useState("");
  const [message,setMessage]=useState("");
  const [partners,setPartners]=useState<{id:string;name:string;code:string}[]>([]);
  const [checked,setChecked]=useState(false);
  const [pending,startTransition]=useTransition();
  const selected=useMemo(()=>groups.find(g=>g.id===selectedId),[groups,selectedId]);
  const selectGroup=(id:string)=>{
    setSelectedId(id);setConfirmText("");setMessage("");setPartners([]);setChecked(false);
    if(!id)return;
    startTransition(async()=>{
      const result=await getGroupDeletePartners(id);
      if(!result.ok){setMessage(result.message);return;}
      setPartners(result.partners);setChecked(true);
    });
  };
  const removePartners=()=>{
    if(!selected||pending||!partners.length||confirmText!==selected.name)return;
    startTransition(async()=>{
      const result=await removePartnersBeforeGroupDelete(selected.id,partners.map(p=>p.id));
      setMessage(result.message);
      const next=await getGroupDeletePartners(selected.id);
      if(next.ok){setPartners(next.partners);setChecked(true);}
    });
  };
  const confirm=()=>{
    if(!selected || confirmText!==selected.name || pending || !checked || partners.length) return;
    startTransition(async ()=>{
      const result=await deleteUnlinkedGroup(selected.id);
      setMessage(result.message);
      if(result.ok) {
        setSelectedId("");
        setConfirmText("");
        router.refresh();
      }
    });
  };
  return <section className="rounded-2xl border border-red-200 bg-gradient-to-r from-red-50 via-white to-amber-50 p-3">
    <button type="button" className="flex w-full items-center justify-between gap-3 text-left" aria-expanded={expanded} onClick={()=>setExpanded(!expanded)}>
      <span className="flex items-center gap-3"><span className="rounded-xl bg-red-100 p-2 text-red-600"><AlertTriangle className="h-4 w-4"/></span>
        <span><span className="block text-[11px] font-bold uppercase text-red-700">IT SUPER USER ONLY</span>
        <span className="text-[12px] font-semibold text-slate-800">Delete Intermediary Group</span></span></span>
      <span className="inline-flex items-center gap-2 text-[10px] font-semibold text-red-700">{expanded?"Collapse":"Expand"}<ChevronDown className={`h-4 w-4 ${expanded?"rotate-180":""}`}/></span>
    </button>
    {expanded?<div className="mt-3 space-y-3 border-t border-red-100 pt-3">
      <p className="text-xs text-slate-600">If this Group has partners, first remove their memberships below. Other linked accounts or protected history may still block permanent deletion. Partner, policy and claim records are never deleted.</p>
      <label className="block text-xs font-semibold text-slate-700">Select group
        <select value={selectedId} onChange={e=>selectGroup(e.target.value)} className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs">
          <option value="">Select group to delete</option>
          {groups.map(g=><option key={g.id} value={g.id}>{g.name} ({g.code})</option>)}
        </select>
      </label>
      {selected?<label className="block text-xs font-semibold text-red-700">Type the exact group name to confirm: {selected.name}
        <input value={confirmText} onChange={e=>setConfirmText(e.target.value)} className="mt-1 h-10 w-full rounded-lg border border-red-200 bg-white px-3 text-xs" autoComplete="off"/>
      </label>:null}
      {selected&&checked&&partners.length>0?<div className="space-y-2 rounded-xl border border-amber-200 bg-amber-50 p-3">
        <p className="text-xs font-bold text-amber-900">Remove {partners.length} partner(s) from this Group first</p>
        <div className="max-h-36 space-y-1 overflow-auto">{partners.map(p=><p key={p.id} className="text-xs text-slate-700">{p.name}{p.code?` (${p.code})`:""}</p>)}</div>
        <p className="text-[11px] text-amber-800">This unassigns partners; it does not delete the partner records. Membership history remains preserved.</p>
        <button type="button" disabled={pending||confirmText!==selected.name} onClick={removePartners} className="rounded-lg bg-amber-700 px-3 py-2 text-xs font-bold text-white disabled:opacity-40">{pending?"Removing…":"Remove Partners from Group"}</button>
      </div>:null}
      {message?<p role="status" className="text-xs text-slate-700">{message}</p>:null}
      <button type="button" disabled={!selected||confirmText!==selected.name||pending||!checked||partners.length>0} onClick={confirm} className="inline-flex h-9 items-center gap-2 rounded-lg bg-red-600 px-4 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-40"><Trash2 className="h-4 w-4"/>{pending?"Checking…":"Permanently Delete Group"}</button>
    </div>:null}
  </section>;
}
