"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { archiveAndReleaseLoginEmail } from "./release-email-actions";

export function ReleaseEmailControl({userId,name,email,role}:{userId:string;name:string;email:string;role:string}){
 const [open,setOpen]=useState(false);
 const [confirm,setConfirm]=useState("");
 const [pending,setPending]=useState(false);
 const [result,setResult]=useState<{ok:boolean;message:string}|null>(null);
 const router=useRouter();
 if(!email||role==="it_super_user"||role==="it_user"||role==="customer"||email.endsWith(".invalid"))return null;
 const expected=`RELEASE ${email.trim().toLowerCase()}`;
 async function submit(){
  if(pending||confirm!==expected)return;
  setPending(true);setResult(null);
  try{
   const res=await archiveAndReleaseLoginEmail(userId,email,confirm);
   setResult({ok:res.status==="success",message:res.message});
   if(res.status==="success"){setConfirm("");router.refresh();}
  }catch{setResult({ok:false,message:"The email release could not be completed. Review the account before retrying."});}
  finally{setPending(false);}
 }
 return <div className="mt-3 rounded-xl border border-blue-200 bg-blue-50 p-3 text-xs">
   <strong className="text-blue-950">Archive account & release login email</strong>
   <p className="mt-1">For reusing <strong>{email}</strong> on a completely new user. The original Auth identity, completed intakes, policy documents, and historical attribution stay intact. The old account is disabled.</p>
   <button type="button" onClick={()=>setOpen(!open)} className="mt-2 rounded-lg border border-blue-400 bg-white px-3 py-2 font-semibold">{open?"Cancel":"Release email for a new user"}</button>
   {open&&<div className="mt-3 space-y-2 rounded-lg border border-blue-200 bg-white p-3">
     <p>Selected: <strong>{name}</strong>. Confirm you are archiving the correct account; the replacement will receive a different Auth user ID and its own role and permissions.</p>
     <label className="block">Type <strong>{expected}</strong> to confirm
       <input autoComplete="off" className="mt-1 block w-full rounded border border-slate-300 p-2" value={confirm} onChange={e=>setConfirm(e.target.value)}/>
     </label>
     <button type="button" disabled={pending||confirm!==expected} className="rounded-lg bg-blue-900 px-3 py-2 font-semibold text-white disabled:opacity-40" onClick={()=>void submit()}>{pending?"Releasing…":"Confirm archive and release"}</button>
   </div>}
   {result&&<div role="status" className={"mt-2 rounded-lg p-2 "+(result.ok?"bg-emerald-50 text-emerald-900":"bg-rose-50 text-rose-900")}>{result.message}{result.ok&&<p className="mt-2"><Link className="font-bold underline" href="/users">Go to User Management to create the new account</Link></p>}</div>}
 </div>;
}
