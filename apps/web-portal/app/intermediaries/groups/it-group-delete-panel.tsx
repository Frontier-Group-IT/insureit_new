"use client";

import { useMemo, useState, useTransition } from "react";
import { AlertTriangle, ChevronDown, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { deleteUnlinkedGroup } from "./it-group-delete-action";

export function ItGroupDeletePanel({groups}:{groups:{id:string;name:string;code:string}[]}) {
  const router=useRouter();
  const [expanded,setExpanded]=useState(false);
  const [selectedId,setSelectedId]=useState("");
  const [confirmText,setConfirmText]=useState("");
  const [message,setMessage]=useState("");
  const [pending,startTransition]=useTransition();
  const selected=useMemo(()=>groups.find(g=>g.id===selectedId),[groups,selectedId]);
  const confirm=()=>{
    if(!selected || confirmText!==selected.name || pending) return;
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
      <p className="text-xs text-slate-600">Permanent deletion is allowed only for a group without linked members, associate accounts, audit history, policies, schemes or portal login identities. Existing business records are never deleted automatically.</p>
      <label className="block text-xs font-semibold text-slate-700">Select group
        <select value={selectedId} onChange={e=>{setSelectedId(e.target.value);setConfirmText("");setMessage("");}} className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs">
          <option value="">Select group to delete</option>
          {groups.map(g=><option key={g.id} value={g.id}>{g.name} ({g.code})</option>)}
        </select>
      </label>
      {selected?<label className="block text-xs font-semibold text-red-700">Type the exact group name to confirm: {selected.name}
        <input value={confirmText} onChange={e=>setConfirmText(e.target.value)} className="mt-1 h-10 w-full rounded-lg border border-red-200 bg-white px-3 text-xs" autoComplete="off"/>
      </label>:null}
      {message?<p role="status" className="text-xs text-slate-700">{message}</p>:null}
      <button type="button" disabled={!selected||confirmText!==selected.name||pending} onClick={confirm} className="inline-flex h-9 items-center gap-2 rounded-lg bg-red-600 px-4 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-40"><Trash2 className="h-4 w-4"/>{pending?"Checking…":"Permanently Delete Group"}</button>
    </div>:null}
  </section>;
}
