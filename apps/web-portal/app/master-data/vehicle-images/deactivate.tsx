"use client";
import {useState} from "react";
import {useRouter} from "next/navigation";
export function DeactivateImage({id,version}:{id:string;version:string}){
 const router=useRouter();const [busy,setBusy]=useState(false);const [error,setError]=useState("");
 return <div><button type="button" disabled={busy} className="rounded border px-2 py-1 text-red-700" onClick={async()=>{if(!window.confirm("Deactivate this image? Customers will see the next matching image or fallback."))return;setBusy(true);setError("");try{const res=await fetch("/api/master-data/vehicle-images",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({id,version})});if(!res.ok)throw new Error("Unable to deactivate. Refresh and retry.");router.refresh();}catch(e){setError(e instanceof Error?e.message:"Unable to deactivate");}finally{setBusy(false);}}}>Deactivate</button>{error&&<p role="alert">{error}</p>}</div>;
}
