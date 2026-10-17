"use client";
import { useEffect, useRef, useState } from "react";
import { createPortal, useFormStatus } from "react-dom";
import { Ban, CheckCircle2, MoreVertical, Pencil, Send, Trash2, X } from "lucide-react";
import { manageGroupAssociate, updateGroupAssociate } from "./actions";

type Associate = {id:string;name:string;phone_number:string;email:string;designation:string;address:string|null;city:string|null;state:string|null;postal_code:string|null;status:string;role?:string};
type Operation = "disable" | "enable" | "delete";
function SubmitAction({label,destructive=false}:{label:string;destructive?:boolean}) {
 const {pending}=useFormStatus();
 return <button type="submit" disabled={pending} className={`rounded-lg px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50 ${destructive?"bg-rose-600":"bg-[#17365D]"}`}>{pending?"Processing…":label}</button>;
}
export function AssociateControls({groupId,associate,surface}:{groupId:string;associate:Associate;surface?:"partner"|"operations"}){
 const [open,setOpen]=useState(false);
 const [editing,setEditing]=useState(false);
 const [confirm,setConfirm]=useState<Operation|null>(null);
 const rootRef=useRef<HTMLDivElement>(null);
 const menuRef=useRef<HTMLDivElement>(null);
 const buttonRef=useRef<HTMLButtonElement>(null);
 const [position,setPosition]=useState<{top:number;left:number}|null>(null);
 const statusOperation:Operation=associate.status==="disabled"?"enable":"disable";
 useEffect(()=>{
  const close=(event:PointerEvent)=>{const path=event.composedPath();if(!path.includes(rootRef.current as EventTarget)&&!path.includes(menuRef.current as EventTarget))setOpen(false)};
  const escape=(event:KeyboardEvent)=>{if(event.key==="Escape"){setOpen(false);setConfirm(null);setEditing(false)}};
  document.addEventListener("pointerdown",close);
  document.addEventListener("keydown",escape);
  return ()=>{document.removeEventListener("pointerdown",close);document.removeEventListener("keydown",escape)};
 },[]);
 useEffect(()=>{
  if(!open){setPosition(null);return;}
  const update=()=>{
   const rect=buttonRef.current?.getBoundingClientRect();if(!rect)return;
   const width=180,height=164,gap=6,pad=10;
   setPosition({left:Math.max(pad,Math.min(rect.right-width,window.innerWidth-width-pad)),top:rect.bottom+height+gap<=window.innerHeight-pad?rect.bottom+gap:Math.max(pad,rect.top-height-gap)});
  };
  update();window.addEventListener("resize",update);window.addEventListener("scroll",update,true);
  return ()=>{window.removeEventListener("resize",update);window.removeEventListener("scroll",update,true)};
 },[open]);
 const hidden=<><input type="hidden" name="group_id" value={groupId}/><input type="hidden" name="portal_surface" value={surface==="partner"?"partner":"operations"}/><input type="hidden" name="associate_id" value={associate.id}/></>;
 const show=(operation:Operation|"edit")=>{setOpen(false);if(operation==="edit")setEditing(true);else setConfirm(operation)};
 const menuItem="flex w-full items-center gap-2.5 px-3 py-2 text-left text-[11px] font-medium hover:bg-[#F4F7FC]";
 return <>
  <div ref={rootRef} className="relative inline-flex">
   <button ref={buttonRef} aria-label={`Actions for ${associate.name}`} aria-haspopup="menu" aria-expanded={open} type="button" onClick={()=>setOpen(v=>!v)} className="grid h-8 w-8 place-items-center rounded-lg border border-[#E1E7F0] text-[#354B68] hover:bg-[#F1F5FA] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#6478FF]"><MoreVertical className="h-4 w-4"/></button>
   {open&&position?createPortal(<div role="menu" ref={menuRef} style={position} className="fixed z-[250] w-[180px] rounded-xl border border-[#E1E7F0] bg-white py-1.5 shadow-[0_12px_35px_rgba(15,23,42,.18)]">
    <button role="menuitem" type="button" onClick={()=>show("edit")} className={menuItem+" text-[#334155]"}><Pencil className="h-4 w-4"/> Edit</button>
    <button role="menuitem" type="button" onClick={()=>show(statusOperation)} className={menuItem+" text-[#334155]"}>{statusOperation==="enable"?<CheckCircle2 className="h-4 w-4"/>:<Ban className="h-4 w-4"/>}{statusOperation==="enable"?"Enable":"Disable"}</button>
    <button role="menuitem" type="button" onClick={()=>show("delete")} className={menuItem+" text-rose-600 hover:bg-rose-50"}><Trash2 className="h-4 w-4"/> Delete</button>
    <form action={manageGroupAssociate}>{hidden}<input type="hidden" name="operation" value="resend"/><button role="menuitem" type="submit" disabled={associate.status==="disabled"} className={menuItem+" text-[#334155] disabled:cursor-not-allowed disabled:opacity-40"}><Send className="h-4 w-4"/> Resend Link</button></form>
   </div>,document.body):null}
  </div>
  {confirm? <div role="presentation" className="fixed inset-0 z-[300] flex items-center justify-center bg-slate-950/35 p-4" onMouseDown={e=>{if(e.target===e.currentTarget)setConfirm(null)}}>
   <div role="alertdialog" aria-modal="true" aria-labelledby="group-associate-confirm-title" aria-describedby="group-associate-confirm-description" className="w-full max-w-[350px] rounded-2xl border border-[#E1E7F0] bg-white p-4 shadow-2xl">
    <div className="flex items-center justify-between"><h3 id="group-associate-confirm-title" className="text-sm font-bold text-[#183557]">{confirm==="delete"?"Permanently delete account?":confirm==="disable"?"Disable account?":"Enable account?"}</h3><button aria-label="Close" type="button" onClick={()=>setConfirm(null)}><X className="h-4 w-4 text-slate-500"/></button></div>
    <p id="group-associate-confirm-description" className="mt-2 text-xs leading-5 text-slate-600">{confirm==="delete"?`Delete ${associate.name}'s login permanently? This cannot be undone.`:confirm==="disable"?`Disable ${associate.name}'s Group Associate login?`:`Enable ${associate.name}'s Group Associate login?`}</p>
    <form action={manageGroupAssociate} className="mt-4 flex justify-end gap-2">{hidden}<input type="hidden" name="operation" value={confirm}/><button type="button" onClick={()=>setConfirm(null)} className="rounded-lg border border-[#DCE4EF] px-3 py-1.5 text-xs font-medium">Cancel</button><SubmitAction label={confirm==="delete"?"Delete Permanently":confirm==="disable"?"Disable":"Enable"} destructive={confirm==="delete"}/></form>
   </div>
  </div>:null}
  {editing?<div role="presentation" className="fixed inset-0 z-[300] grid place-items-center bg-slate-950/35 p-4"><div role="dialog" aria-modal="true" aria-label="Edit Group Associate" className="w-full max-w-xl rounded-2xl bg-white p-5 shadow-xl">
   <form action={updateGroupAssociate} className="space-y-3">
    <div className="flex justify-between gap-3"><div><h3 className="text-sm font-bold text-[#183557]">Edit Group Associate</h3><p className="mt-1 text-xs text-slate-600">{associate.email}</p></div><button aria-label="Close" type="button" onClick={()=>setEditing(false)}><X className="h-4 w-4"/></button></div>
    {hidden}
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">{([["name","Name",associate.name],["phone","Phone",associate.phone_number],["designation","Designation",associate.designation],["address","Address",associate.address??""],["city","City",associate.city??""],["state","State",associate.state??""],["postal_code","PIN",associate.postal_code??""]] as const).map(([name,label,value])=><label key={name} className="block text-[11px] font-medium">{label}<input className="mt-1 h-9 w-full rounded-lg border border-[#DFE7F1] p-2 text-xs" name={name} defaultValue={value} required={["name","phone","designation"].includes(name)}/></label>)}</div>
    <div className="flex justify-end gap-2"><button type="button" className="rounded-lg border px-3 py-2 text-xs" onClick={()=>setEditing(false)}>Cancel</button><SubmitAction label="Save Changes"/></div>
   </form>
  </div></div>:null}
 </>;
}
