"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { CatalogItem } from "@/lib/vehicle-image-catalog";
type Item={file:File;selection:string;status:string};
async function optimize(file:File){
 if(file.size>20*1024*1024)throw new Error("Original exceeds 20 MB");
 const image=await createImageBitmap(file);
 try{
 const scale=Math.min(1,1200/image.width,900/image.height);
 const canvas=document.createElement("canvas");canvas.width=Math.max(1,Math.round(image.width*scale));canvas.height=Math.max(1,Math.round(image.height*scale));
 const ctx=canvas.getContext("2d");if(!ctx)throw new Error("Image decoding unavailable");
 ctx.drawImage(image,0,0,canvas.width,canvas.height);
 const blob=await new Promise<Blob|null>(resolve=>canvas.toBlob(resolve,"image/webp",0.82));
 if(!blob||blob.type!=="image/webp"||blob.size>2097152)throw new Error("Unable to optimize image");
 return blob;
 }finally{image.close();}
}
export function VehicleImageUpload({models}:{models:CatalogItem[]}){
 const router=useRouter();const [items,setItems]=useState<Item[]>([]);const [busy,setBusy]=useState(false);const [error,setError]=useState("");
 const key=(m:CatalogItem)=>JSON.stringify([m.manufacturerId,m.model]);
 async function upload(){
 setBusy(true);
 try{for(let i=0;i<items.length;i++){
 const item=items[i];if(item.status==="Uploaded")continue;
 try{const m=models.find(m=>key(m)===item.selection);if(!m)throw new Error("Select a model");
 const blob=await optimize(item.file);const body=new FormData();body.set("image",blob,"vehicle.webp");body.set("manufacturerId",m.manufacturerId);body.set("model",m.model);
 const res=await fetch("/api/master-data/vehicle-images",{method:"POST",body});const result=await res.json();if(!res.ok)throw new Error(result.error||"Upload failed");
 setItems(old=>old.map((x,j)=>j===i?{...x,status:"Uploaded"}:x));
 }catch(e){setItems(old=>old.map((x,j)=>j===i?{...x,status:e instanceof Error?e.message:"Upload failed"}:x));}
 }}finally{setBusy(false);router.refresh();}
 }
 return <div className="mt-4 space-y-3"><label className="block text-sm font-semibold">Choose multiple vehicle images<input type="file" multiple accept="image/png,image/jpeg,image/webp" disabled={busy} className="block mt-2" onChange={e=>{const selected=Array.from(e.target.files??[]);setError(selected.length>50?"Select at most 50 files per batch.":"");setItems(selected.length>50?[]:selected.map(file=>({file,selection:"",status:"Pending"})));}}/></label>{error&&<p role="alert">{error}</p>}{items.map((item,i)=><div key={i} className="grid gap-2 border rounded-lg p-3 md:grid-cols-3"><span className="break-all">{item.file.name}</span><select aria-label={"Model for "+item.file.name} disabled={busy||item.status==="Uploaded"} value={item.selection} onChange={e=>setItems(old=>old.map((x,j)=>j===i?{...x,selection:e.target.value}:x))}><option value="">Select manufacturer and model</option>{models.map(m=><option key={key(m)} value={key(m)}>{m.make} — {m.model}</option>)}</select><span role="status">{item.status}</span></div>)}<button type="button" disabled={busy||!items.length||items.some(x=>!x.selection)||items.every(x=>x.status==="Uploaded")} onClick={upload} className="rounded-lg bg-[#6759ff] px-4 py-2 text-white disabled:opacity-50">{busy?"Uploading…":"Upload selected images"}</button></div>;
}
