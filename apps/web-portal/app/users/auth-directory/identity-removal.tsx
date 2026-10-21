"use client";
import { useState } from "react";
import { ResolveDependencies } from "./resolve-dependencies";
import { archiveUserIdentity } from "./archive-identity-actions";
import { useRouter } from "next/navigation";
import { removeAuthDirectoryIdentity, type IdentityRemovalMode } from "./identity-removal-actions";

export function IdentityRemoval({id,name}:{id:string;name:string}) {
 const router=useRouter();
 const [mode,setMode]=useState<IdentityRemovalMode>("login_only");
 const [confirmation,setConfirmation]=useState("");
 const [pending,setPending]=useState(false);
 const [message,setMessage]=useState("");
 const [archiveOpen,setArchiveOpen]=useState(false);
 const [archiveConfirmation,setArchiveConfirmation]=useState("");
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
  <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-slate-900">
   <strong className="text-blue-900">Archive user / Retire identity (recommended)</strong>
   <p className="mt-1">Disable the login, mark the profile inactive and retire a linked employee record. Keep all completed intakes, policies, documents and audit history. No historical attribution is reassigned.</p>
   <button type="button" onClick={()=>setArchiveOpen(!archiveOpen)} className="mt-2 rounded border border-blue-400 bg-white px-3 py-2 font-semibold">{archiveOpen?"Cancel archiving":"Archive user"}</button>
   {archiveOpen&&<div className="mt-3 space-y-2"><p>Confirm archiving <strong>{name}</strong> ({id}). Existing sessions may continue until expiry. Pending work needs separate review.</p><label className="block">Type ARCHIVE USER to confirm<input className="mt-1 w-full rounded border p-2" value={archiveConfirmation} onChange={e=>setArchiveConfirmation(e.target.value)}/></label><button type="button" disabled={pending||archiveConfirmation!=="ARCHIVE USER"} className="rounded bg-blue-900 px-3 py-2 font-semibold text-white disabled:opacity-40" onClick={async()=>{setPending(true);try{const result=await archiveUserIdentity(id,archiveConfirmation);setMessage(result.message);if(result.status==="success"){setArchiveOpen(false);setArchiveConfirmation("");router.refresh();}}catch{setMessage("Could not archive the account.");}finally{setPending(false);}}}>{pending?"Archiving…":"Confirm archive"}</button></div>}
  </div>
  <strong className="text-red-900">Account removal</strong>
  <p>Choose whether to revoke login only or request full deletion for {name}.</p>
  <label className="block"><input type="radio" checked={mode==="login_only"} onChange={()=>{setMode("login_only");setConfirmation("");}}/> Login access only — prevent sign-in, preserve profile and business history</label>
  <label className="block"><input type="radio" checked={mode==="complete"} onChange={()=>{setMode("complete");setConfirmation("");}}/> Complete identity — permanently delete only if protected-record checks pass</label>
  <p className="text-red-800">Removing login access preserves the Auth row because deleting that row cascades to the portal profile.</p>
  <p className="break-all">Selected: {name} ({id})</p>
  <label className="block">Type {expected} to confirm<input className="mt-1 block w-full rounded border p-2" value={confirmation} onChange={e=>setConfirmation(e.target.value)} /></label>
  <button type="button" onClick={submit} disabled={pending||confirmation!==expected} className="rounded bg-red-700 px-3 py-2 font-semibold text-white disabled:opacity-40">{pending?"Working…":mode==="complete"?"Permanently delete identity":"Disable login"}</button>
  {message&&<p role="status">{message}</p>}
  <ResolveDependencies userId={id}/>
 </section>;
}
