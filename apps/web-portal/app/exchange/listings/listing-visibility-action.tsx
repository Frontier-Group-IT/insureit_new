"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Ban, CheckCircle2, MoreVertical, Pencil, Trash2, X } from "lucide-react";
import { setExchangeListingVisibility, updateExchangeListingDetails, permanentlyDeleteExchangeListing } from "./actions";

type Listing = { id: string; listingNo: string; enabled: boolean; title: string; askingPrice: number; odometerKm: number | null; city: string | null; state: string | null };
type Decision = "enable" | "disable" | "delete";
export function ExchangeListingVisibilityAction({ listing }: { listing: Listing }) {
 const router=useRouter();
 const [open,setOpen]=useState(false);
 const [confirm,setConfirm]=useState<Decision|null>(null);
 const [editing,setEditing]=useState(false);
 const [pending,startTransition]=useTransition();
 const [error,setError]=useState<string|null>(null);
 const [enabled,setEnabled]=useState(listing.enabled);
 const [pos,setPos]=useState<{top:number;left:number}|null>(null);
 const buttonRef=useRef<HTMLButtonElement>(null);
 const menuRef=useRef<HTMLDivElement>(null);
 const rootRef=useRef<HTMLDivElement>(null);
 useEffect(()=>{
   function close(e:PointerEvent){const path=e.composedPath();if(!path.includes(rootRef.current as EventTarget)&&!path.includes(menuRef.current as EventTarget))setOpen(false)}
   function esc(e:KeyboardEvent){if(e.key==="Escape"){setOpen(false);setConfirm(null);setEditing(false)}}
   document.addEventListener("pointerdown",close);document.addEventListener("keydown",esc);
   return ()=>{document.removeEventListener("pointerdown",close);document.removeEventListener("keydown",esc)}
 },[]);
 useEffect(()=>{
   if(!open){setPos(null);return}
   const reposition=()=>{
     const rect=buttonRef.current?.getBoundingClientRect();if(!rect)return;
     const width=176,height=122,pad=10;
     setPos({left:Math.max(pad,Math.min(rect.right-width,window.innerWidth-width-pad)),top:rect.bottom+height+7<window.innerHeight-pad?rect.bottom+7:Math.max(pad,rect.top-height-7)});
   };
   reposition();window.addEventListener("scroll",reposition,true);window.addEventListener("resize",reposition);
   return ()=>{window.removeEventListener("scroll",reposition,true);window.removeEventListener("resize",reposition)}
 },[open]);
 function action(decision:Decision) {
   setError(null);
   startTransition(async()=>{
     try {
       if(decision==="delete") await permanentlyDeleteExchangeListing(listing.id);
       else {await setExchangeListingVisibility(listing.id,decision==="enable");setEnabled(decision==="enable")}
       setConfirm(null);router.refresh();
     } catch(e){setError(e instanceof Error?e.message:"Unable to complete listing action.")}
   });
 }
 function save(form:FormData) {
   setError(null);
   const odometer=String(form.get("odometerKm")??"").trim();
   startTransition(async()=>{
     try {
       await updateExchangeListingDetails(listing.id,{
         title:String(form.get("title")??""),askingPrice:Number(form.get("askingPrice")),odometerKm:odometer===""?null:Number(odometer),
         city:String(form.get("city")??""),state:String(form.get("state")??"")
       });
       setEditing(false);router.refresh();
     } catch(e){setError(e instanceof Error?e.message:"Unable to save listing.")}
   });
 }
 const close=()=>{if(!pending){setConfirm(null);setEditing(false);setError(null)}};
 return <>
  <div ref={rootRef} className="inline-flex">
   <button ref={buttonRef} type="button" onClick={()=>setOpen(v=>!v)} aria-label={`Actions for ${listing.listingNo}`} aria-haspopup="menu" aria-expanded={open} className="grid h-8 w-8 place-items-center rounded-lg border border-[#E0E7F0] bg-white text-[#334155] hover:bg-[#F1F5FA] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#6675F5]"><MoreVertical className="h-4 w-4"/></button>
   {open&&pos?createPortal(<div ref={menuRef} role="menu" style={pos} className="fixed z-[240] w-44 rounded-xl border border-[#E0E7F0] bg-white py-1.5 shadow-[0_16px_40px_rgba(15,23,42,.2)]">
    <button type="button" role="menuitem" onClick={()=>{setOpen(false);setEditing(true)}} className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-[11px] text-[#334155] hover:bg-slate-50"><Pencil className="h-4 w-4"/>Edit</button>
    <button type="button" role="menuitem" onClick={()=>{setOpen(false);setConfirm(enabled?"disable":"enable")}} className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-[11px] text-[#334155] hover:bg-slate-50">{enabled?<Ban className="h-4 w-4"/>:<CheckCircle2 className="h-4 w-4"/>}{enabled?"Disable":"Enable"}</button>
    <button type="button" role="menuitem" onClick={()=>{setOpen(false);setConfirm("delete")}} className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-[11px] font-medium text-rose-600 hover:bg-rose-50"><Trash2 className="h-4 w-4"/>Delete</button>
   </div>,document.body):null}
  </div>
  {confirm?<div className="fixed inset-0 z-[300] flex items-center justify-center bg-slate-950/40 p-4" onMouseDown={e=>{if(e.target===e.currentTarget)close()}}>
    <div role="alertdialog" aria-modal="true" aria-labelledby="listing-action-title" aria-describedby="listing-action-description" className="w-full max-w-[355px] rounded-2xl border bg-white p-4 shadow-2xl">
     <div className="flex items-center justify-between gap-3"><h3 id="listing-action-title" className="text-sm font-bold text-[#17365D]">{confirm==="delete"?"Delete listing permanently?":confirm==="disable"?"Disable listing?":"Enable listing?"}</h3><button type="button" aria-label="Close" disabled={pending} onClick={close}><X className="h-4 w-4 text-slate-500"/></button></div>
     <p id="listing-action-description" className="mt-2 text-xs leading-5 text-slate-600">{confirm==="delete"?`Permanently delete ${listing.listingNo} and its listing photos? This cannot be undone. Listings with bids, contact requests or deals are protected.`:confirm==="disable"?`Hide ${listing.listingNo} from the marketplace?`:`Enable ${listing.listingNo} in the marketplace?`}</p>
     {error?<p role="alert" className="mt-2 text-xs text-rose-700">{error}</p>:null}
     <div className="mt-4 flex justify-end gap-2"><button disabled={pending} onClick={close} className="rounded-lg border px-3 py-2 text-xs">Cancel</button><button disabled={pending} onClick={()=>action(confirm)} className={`rounded-lg px-3 py-2 text-xs font-semibold text-white disabled:opacity-50 ${confirm==="delete"?"bg-rose-600":"bg-[#17365D]"}`}>{pending?"Processing…":confirm==="delete"?"Delete Permanently":confirm==="enable"?"Enable":"Disable"}</button></div>
    </div>
   </div>:null}
  {editing?<div className="fixed inset-0 z-[300] grid place-items-center bg-slate-950/40 p-4">
   <div role="dialog" aria-modal="true" aria-label="Edit listing" className="w-full max-w-[440px] rounded-2xl bg-white p-4 shadow-2xl">
    <div className="flex justify-between"><div><h3 className="text-sm font-bold text-[#17365D]">Edit listing</h3><p className="text-xs text-slate-500">{listing.listingNo}</p></div><button aria-label="Close" type="button" onClick={close}><X className="h-4 w-4"/></button></div>
    <form action={save} className="mt-3 grid grid-cols-2 gap-3">
     <label className="col-span-2 text-xs">Title *<input name="title" required maxLength={180} defaultValue={listing.title} className="mt-1 w-full rounded-lg border p-2 text-xs"/></label>
     <label className="text-xs">Asking Price *<input name="askingPrice" type="number" min="1" step="0.01" required defaultValue={listing.askingPrice} className="mt-1 w-full rounded-lg border p-2 text-xs"/></label>
     <label className="text-xs">Odometer KM<input name="odometerKm" type="number" min="0" defaultValue={listing.odometerKm??""} className="mt-1 w-full rounded-lg border p-2 text-xs"/></label>
     <label className="text-xs">City<input name="city" defaultValue={listing.city??""} className="mt-1 w-full rounded-lg border p-2 text-xs"/></label>
     <label className="text-xs">State<input name="state" defaultValue={listing.state??""} className="mt-1 w-full rounded-lg border p-2 text-xs"/></label>
     {error?<p role="alert" className="col-span-2 text-xs text-rose-700">{error}</p>:null}
     <div className="col-span-2 flex justify-end gap-2"><button type="button" disabled={pending} onClick={close} className="rounded-lg border px-3 py-2 text-xs">Cancel</button><button disabled={pending} className="rounded-lg bg-[#17365D] px-3 py-2 text-xs font-semibold text-white">{pending?"Saving…":"Save Details"}</button></div>
    </form>
   </div>
  </div>:null}
 </>;
}
