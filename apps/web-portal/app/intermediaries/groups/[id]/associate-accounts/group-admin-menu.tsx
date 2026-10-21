"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal, useFormStatus } from "react-dom";
import { Ban, CheckCircle2, MoreVertical, Pencil, Send, Trash2, X } from "lucide-react";
import { changeGroupAdministratorAccess, resendGroupAdministratorInvite, updateGroupAdministratorContact } from "./group-admin-actions";

type Contact = { admin_name: string; admin_mobile: string; address: string|null; city: string|null; state: string|null; postal_code: string|null };
function Submit({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return <button disabled={pending} type="submit" className="rounded-lg bg-[#17365D] px-4 py-2 text-xs font-semibold text-white disabled:opacity-50">{pending ? "Processing…" : children}</button>;
}

export function GroupAdminMenu({ groupId, contact, loginStatus }: { groupId: string; contact: Contact; loginStatus: "active"|"disabled"|null }) {
  const [open,setOpen]=useState(false);
  const [dialog,setDialog]=useState<"edit"|"access"|"delete"|null>(null);
  const [position,setPosition]=useState<{top:number;left:number}|null>(null);
  const buttonRef=useRef<HTMLButtonElement>(null);
  const menuRef=useRef<HTMLDivElement>(null);
  useEffect(()=>{
    if(!open) return;
    const close=(e:PointerEvent)=>{if(!buttonRef.current?.contains(e.target as Node)&&!menuRef.current?.contains(e.target as Node))setOpen(false);};
    const key=(e:KeyboardEvent)=>{if(e.key==="Escape")setOpen(false);};
    const place=()=>{const r=buttonRef.current?.getBoundingClientRect();if(!r)return;setPosition({left:Math.max(10,Math.min(r.right-180,window.innerWidth-190)),top:r.bottom+180<window.innerHeight?r.bottom+6:Math.max(10,r.top-180)});};
    place();document.addEventListener("pointerdown",close);document.addEventListener("keydown",key);window.addEventListener("resize",place);window.addEventListener("scroll",place,true);
    return ()=>{document.removeEventListener("pointerdown",close);document.removeEventListener("keydown",key);window.removeEventListener("resize",place);window.removeEventListener("scroll",place,true)};
  },[open]);
  const choose=(d:"edit"|"access"|"delete")=>{setOpen(false);setDialog(d);};
  const hidden=<input type="hidden" name="group_id" value={groupId}/>;
  const row="flex w-full items-center gap-2.5 px-3 py-2 text-left text-[11px] hover:bg-slate-50";
  return <>
    <button ref={buttonRef} type="button" aria-label="Group Administrator actions" aria-haspopup="menu" aria-expanded={open} onClick={()=>setOpen(v=>!v)} className="inline-grid h-8 w-8 place-items-center rounded-lg border border-slate-200 hover:bg-slate-50"><MoreVertical className="h-4 w-4"/></button>
    {open&&position?createPortal(<div ref={menuRef} role="menu" style={position} onClick={e=>e.stopPropagation()} className="fixed z-[9999] w-[180px] rounded-xl border bg-white py-1.5 shadow-xl">
      <button type="button" role="menuitem" className={row} onClick={()=>choose("edit")}><Pencil className="h-4 w-4"/>Edit</button>
      <button type="button" role="menuitem" className={row} disabled={!loginStatus} onClick={()=>choose("access")}>{loginStatus==="disabled"?<CheckCircle2 className="h-4 w-4"/>:<Ban className="h-4 w-4"/>}{loginStatus==="disabled"?"Enable":"Disable"}</button>
      <button type="button" role="menuitem" className={row+" text-rose-600"} onClick={()=>choose("delete")}><Trash2 className="h-4 w-4"/>Delete</button>
      <form action={resendGroupAdministratorInvite}>{hidden}<button type="submit" role="menuitem" disabled={loginStatus!=="active"} className={row+" disabled:opacity-40"}><Send className="h-4 w-4"/>Resend Link</button></form>
    </div>,document.body):null}
    {dialog?createPortal(<div role="presentation" className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-950/40 p-4"><div role="dialog" aria-modal="true" aria-label={dialog==="edit"?"Edit Group Administrator":dialog==="delete"?"Delete Group Administrator":"Manage Group Administrator access"} className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-2xl">
      <div className="mb-4 flex items-center justify-between"><h3 className="font-bold text-[#17365D]">{dialog==="edit"?"Edit Group Administrator":dialog==="delete"?"Delete Group Administrator":loginStatus==="disabled"?"Enable Group Administrator":"Disable Group Administrator"}</h3><button type="button" aria-label="Close" onClick={()=>setDialog(null)}><X className="h-4 w-4"/></button></div>
      {dialog==="edit"?<form action={updateGroupAdministratorContact} className="space-y-3">{hidden}{([["admin_name","Name",contact.admin_name],["admin_mobile","Phone",contact.admin_mobile],["address","Address",contact.address||""],["city","City",contact.city||""],["state","State",contact.state||""],["postal_code","PIN Code",contact.postal_code||""]] as const).map(([name,label,value])=><label key={name} className="block text-xs">{label}<input name={name} defaultValue={value} required={name==="admin_name"||name==="admin_mobile"} className="mt-1 h-9 w-full rounded-lg border border-slate-200 px-3"/></label>)}<div className="flex justify-end gap-2"><button type="button" onClick={()=>setDialog(null)}>Cancel</button><Submit>Save changes</Submit></div></form>:null}
      {dialog==="access"?<form action={changeGroupAdministratorAccess} className="space-y-4">{hidden}<input name="next_status" type="hidden" value={loginStatus==="disabled"?"active":"disabled"}/><p className="text-sm text-slate-600">Confirm changing access for the Group Administrator. The Group and other associates remain unchanged.</p><div className="flex justify-end gap-3"><button type="button" onClick={()=>setDialog(null)}>Cancel</button><Submit>Confirm</Submit></div></form>:null}
      {dialog==="delete"?<div className="space-y-4"><p className="text-sm text-slate-600">This is the Group's primary administrator, not an ordinary associate. Deleting this login can orphan the Group. Deletion is blocked here to protect the Group and its records. You can disable access instead.</p><div className="flex justify-end"><button type="button" onClick={()=>setDialog(null)} className="rounded-lg bg-[#17365D] px-4 py-2 text-xs font-semibold text-white">Close</button></div></div>:null}
    </div></div>,document.body):null}
  </>;
}
