"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { CatalogItem } from "@/lib/vehicle-image-catalog";
import {ModelPicker,modelOptionKey as key} from "./model-picker";
type Item={file:File;selection:string;status:string;replace:boolean};
import {uploadVehicleImage} from "./image-upload-client";
export function VehicleImageUpload({models}:{models:CatalogItem[]}){
 const router=useRouter();const [items,setItems]=useState<Item[]>([]);const [busy,setBusy]=useState(false);const [error,setError]=useState("");

 async function upload(){
 setBusy(true);
 try{for(let i=0;i<items.length;i++){
 const item=items[i];if(item.status==="Uploaded")continue;
 try{const m=models.find(m=>key(m)===item.selection);if(!m)throw new Error("Select a model");
 await uploadVehicleImage(item.file,m.manufacturerId,m.model,item.replace);
 setItems(old=>old.map((x,j)=>j===i?{...x,status:"Uploaded"}:x));
 }catch(e){setItems(old=>old.map((x,j)=>j===i?{...x,status:e instanceof Error?e.message:"Upload failed"}:x));}
 }}finally{setBusy(false);router.refresh();}
 }
 return <div className="mt-4 space-y-3"><label className="block text-sm font-semibold">Choose multiple vehicle images<input type="file" multiple accept="image/png,image/jpeg,image/webp,image/avif" disabled={busy} className="block mt-2" onChange={e=>{const selected=Array.from(e.target.files??[]);setError(selected.length>50?"Select at most 50 files per batch.":"");setItems(selected.length>50?[]:selected.map(file=>({file,selection:"",status:"Pending",replace:false})));}}/></label>{error&&<p role="alert">{error}</p>}{items.map((item,i)=><div key={i} className="grid gap-2 border rounded-lg p-3 md:grid-cols-3"><span className="break-all">{item.file.name}</span><ModelPicker models={models} value={item.selection} disabled={busy||item.status==="Uploaded"} onChange={selection=>setItems(old=>old.map((x,j)=>j===i?{...x,selection}:x))}/><div className="flex flex-wrap gap-2"><label><input type="checkbox" disabled={busy||item.status==="Uploaded"} checked={item.replace} onChange={e=>setItems(old=>old.map((x,j)=>j===i?{...x,replace:e.target.checked}:x))}/> Replace existing</label></div><span role="status">{item.status}</span></div>)}<button type="button" disabled={busy||!items.length||items.some(x=>!x.selection)||items.every(x=>x.status==="Uploaded")} onClick={upload} className="rounded-lg bg-[#6759ff] px-4 py-2 text-white disabled:opacity-50">{busy?"Uploading…":"Upload selected images"}</button></div>;
}
