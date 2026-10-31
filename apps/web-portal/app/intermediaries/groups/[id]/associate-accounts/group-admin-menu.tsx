"use client";

import { useState } from "react";
import { createPortal, useFormStatus } from "react-dom";
import { Ban, CheckCircle2, Pencil, Send, Trash2, X, ShieldAlert } from "lucide-react";
import { changeGroupAdministratorAccess, resendGroupAdministratorInvite, updateGroupAdministratorContact } from "./group-admin-actions";

type Contact = { admin_name: string; admin_mobile: string; address: string|null; city: string|null; state: string|null; postal_code: string|null };
function Submit({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return <button disabled={pending} type="submit" className="rounded-lg bg-[#17365D] px-4 py-2 text-xs font-semibold text-white disabled:opacity-50">{pending ? "Processing…" : children}</button>;
}

export function GroupAdminMenu({ groupId, contact, loginStatus }: { groupId: string; contact: Contact; loginStatus: "active"|"disabled"|null }) {
  const [dialog,setDialog]=useState<"edit"|"access"|"delete"|null>(null);
  const choose=(value:"edit"|"access"|"delete")=>setDialog(value);
  const hidden=<input type="hidden" name="group_id" value={groupId}/>;
  const iconClass="grid h-8 w-8 place-items-center rounded-lg border border-transparent text-[#334155] hover:border-[#DCE5EF] hover:bg-[#F1F5F9] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#315FEA] disabled:cursor-not-allowed disabled:opacity-40";
  return <>
    <div role="group" aria-label="Group Administrator actions" className="inline-flex items-center justify-center gap-1 whitespace-nowrap">
      <button type="button" aria-label="Edit Group Administrator" title="Edit" onClick={()=>choose("edit")} className={iconClass}><Pencil className="h-4 w-4" aria-hidden="true"/></button>
      <button type="button" aria-label={loginStatus==="disabled"?"Enable Group Administrator":"Disable Group Administrator"} title={loginStatus==="disabled"?"Enable":"Disable"} disabled={!loginStatus} onClick={()=>choose("access")} className={iconClass}>{loginStatus==="disabled"?<CheckCircle2 className="h-4 w-4" aria-hidden="true"/>:<Ban className="h-4 w-4" aria-hidden="true"/>}</button>
      <form action={resendGroupAdministratorInvite} className="inline-flex">{hidden}<button type="submit" aria-label="Resend Group Administrator link" title="Resend Link" disabled={loginStatus!=="active"} className={iconClass}><Send className="h-4 w-4" aria-hidden="true"/></button></form>
      <button type="button" aria-label="Delete Group Administrator" title="Delete (protected)" onClick={()=>choose("delete")} className={iconClass+" text-rose-600 hover:bg-rose-50"}><Trash2 className="h-4 w-4" aria-hidden="true"/></button>
    </div>
    {dialog?createPortal(<div role="presentation" className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-950/40 p-4"><div role="dialog" aria-modal="true" aria-label={dialog==="edit"?"Edit Group Administrator":dialog==="delete"?"Delete Group Administrator":"Manage Group Administrator access"} className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-2xl">
      <div className="mb-4 flex items-center justify-between"><h3 className="font-bold text-[#17365D]">{dialog==="edit"?"Edit Group Administrator":dialog==="delete"?"Delete Group Administrator":loginStatus==="disabled"?"Enable Group Administrator":"Disable Group Administrator"}</h3><button type="button" aria-label="Close" onClick={()=>setDialog(null)}><X className="h-4 w-4"/></button></div>
      {dialog==="edit"?<form action={updateGroupAdministratorContact} className="space-y-3">{hidden}{([["admin_name","Name",contact.admin_name],["admin_mobile","Phone",contact.admin_mobile],["address","Address",contact.address||""],["city","City",contact.city||""],["state","State",contact.state||""],["postal_code","PIN Code",contact.postal_code||""]] as const).map(([name,label,value])=><label key={name} className="block text-xs">{label}<input name={name} defaultValue={value} required={name==="admin_name"||name==="admin_mobile"} className="mt-1 h-9 w-full rounded-lg border border-slate-200 px-3"/></label>)}<div className="flex justify-end gap-2"><button type="button" onClick={()=>setDialog(null)}>Cancel</button><Submit>Save changes</Submit></div></form>:null}
      {dialog==="access"?<form action={changeGroupAdministratorAccess} className="space-y-4">{hidden}<input name="next_status" type="hidden" value={loginStatus==="disabled"?"active":"disabled"}/><div className="space-y-2 text-center"><span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-amber-50 text-amber-600"><ShieldAlert className="h-6 w-6"/></span><p className="text-sm text-slate-600">{loginStatus==="disabled"?"Enable administrator login access?":"Disable administrator login access?"} Group records and associates remain unchanged.</p></div><div className="flex gap-2 border-t border-slate-200 pt-3"><button type="button" onClick={()=>setDialog(null)} className="h-10 flex-1 rounded-lg border border-slate-200 text-xs font-semibold">Cancel</button><Submit>Confirm</Submit></div></form>:null}
      {dialog==="delete"?<div className="space-y-4"><p className="text-sm text-slate-600">This is the Group&apos;s primary administrator, not an ordinary associate. Deleting this login can orphan the Group. Deletion is blocked here to protect the Group and its records. You can disable access instead.</p><div className="flex justify-end"><button type="button" onClick={()=>setDialog(null)} className="rounded-lg bg-[#17365D] px-4 py-2 text-xs font-semibold text-white">Close</button></div></div>:null}
    </div></div>,document.body):null}
  </>;
}
