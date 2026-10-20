"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { removeAuthDirectoryIdentity, type IdentityRemovalMode } from "./identity-removal-actions";

export function IdentityRemoval({id,name}:{id:string;name:string}) {
 const router=useRouter();
 const [mode,setMode]=useState<IdentityRemovalMode>("login_only");
 const [confirmation,setConfirmation]=useState("");
 const [pending,setPending]=useState(false);
 const [message,setMessage]=useState("");
 const expected=mode==="complete"?"DELETE IDENTITY":"DISABLE LOGIN";
 async function submit(){
  if(confirmation!==expected)return;
  setPending(true);
  try{
   const result=await removeAuthDirectoryIdentity(id,mode,confirmation);
   setMessage(result.message);
   if(result.status==="success")router.refresh();
  }catch{setMessage("Operation failed.");}
  finally{setPending(false);}
 }
 return <section className="mt-4 space-y-3 rounded-xl border border-red-200 bg-red-50 p-3 text-xs">
  <strong className="text-red-900">Account removal</strong>
  <p>Choose whether to revoke login only or request full deletion for {name}.</p>
  <label className="block"><input type="radio" checked={mode==="login_only"} onChange={()=>{setMode("login_only");setConfirmation("");}}/> Login access only — prevent sign-in, preserve profile and business history</label>
  <label className="block"><input type="radio" checked={mode==="complete"} onChange={()=>{setMode("complete");setConfirmation("");}}/> Complete identity — permanently delete only if protected-record checks pass</label>
  <p className="text-red-800">Removing login access preserves the Auth row because deleting that row cascades to the portal profile.</p>
  <p className="break-all">Selected: {name} ({id})</p>
  <label className="block">Type {expected} to confirm<input className="mt-1 block w-full rounded border p-2" value={confirmation} onChange={e=>setConfirmation(e.target.value)} /></label>
  <button type="button" onClick={submit} disabled={pending||confirmation!==expected} className="rounded bg-red-700 px-3 py-2 font-semibold text-white disabled:opacity-40">{pending?"Working…":mode==="complete"?"Permanently delete identity":"Disable login"}</button>
  {message&&<p role="status">{message}</p>}
 </section>;
}
