"use client";

import { useRef, useState } from "react";

type Candidate = { source_row: string; registration_number: string; chassis_number: string; engine_number: string; model_year: string; existing_status: string; authbridge_status?:string };
type Enriched = Candidate & { lookup_status:string; lookup_source:string; provider_transaction_id:string; provider_fields:string; fetched_at:string; review_status:string };
const normalize=(value:string)=>value.toUpperCase().replace(/[^A-Z0-9]/g,"");
const wait=(ms:number)=>new Promise<void>(resolve=>setTimeout(resolve,ms));
const escapeCsv=(value:unknown)=>'"'+String(value??"").replaceAll('"','""')+'"';

export default function ShreeFleetAuthbridgePreflight(){
 const [rows,setRows]=useState<Candidate[]>([]);
 const [results,setResults]=useState<Enriched[]>([]);
 const [running,setRunning]=useState(false);
 const [message,setMessage]=useState("Upload the reconciled CSV to start read-only AuthBridge enrichment.");
 const stop=useRef(false);
 const resultsRef=useRef<Enriched[]>([]);
 function record(next:Enriched){resultsRef.current=[...resultsRef.current.filter(r=>r.source_row!==next.source_row),next];setResults([...resultsRef.current]);}
 async function upload(file:File){
   if(running)return;
   const raw=await file.text();
   const [header,...data]=raw.replace(/\r/g,"").trim().split("\n");
   const cols=header.split(",").map(s=>s.trim());
   const fields=["source_row","registration_number","chassis_number","engine_number","model_year","existing_status"];
   if(fields.some(field=>!cols.includes(field))){setMessage("This is not a Shree Transport reconciled vehicle CSV.");return;}
   const parsed=data.filter(Boolean).map(line=>{
     const cells=line.split(",");
     return Object.fromEntries(cols.map((key,i)=>[key,(cells[i]??"").trim()])) as Candidate;
   });
   if(parsed.length!==202){setMessage("Expected 202 source rows. No AuthBridge request made.");return;}
   // Accept the exact statuses emitted by the preliminary and verified reconciliation exports.
   const candidateStatuses=new Set([
     "Potentially new - global check pending",
     "New by chassis — global check clear",
     "New by chassis - global check clear",
   ]);
   const alreadyLinkedStatuses=new Set(["Already on Shree Transport"]);
   if(parsed.some(row=>!candidateStatuses.has(row.existing_status)&&!alreadyLinkedStatuses.has(row.existing_status))){
     setMessage("The reconciliation contains an unrecognized status. No AuthBridge lookup will run.");return;
   }
   const candidates=parsed.filter(row=>candidateStatuses.has(row.existing_status));
   if(candidates.length!==101||candidates.some(r=>!r.registration_number)){setMessage("Candidate set differs from the reviewed 101 registration numbers. Stop and reconcile.");return;}
   const chassis=new Set(candidates.map(r=>normalize(r.chassis_number)));
   const rc=new Set(candidates.map(r=>normalize(r.registration_number)));
   if(chassis.size!==101||rc.size!==101){setMessage("Duplicate identifiers detected. Stop and reconcile.");return;}
   resultsRef.current=[];setResults([]);setRows(candidates);
   setMessage("101 candidates validated. AuthBridge responses will be exported for review; no vehicles will be saved.");
 }
 async function start(){
   if(running||rows.length!==101)return;
   setRunning(true);stop.current=false;
   try{
     for(const row of rows){
       if(stop.current)break;
       if(resultsRef.current.some(r=>r.source_row===row.source_row))continue;
       let result:Enriched={...row,lookup_status:"request_error",lookup_source:"",provider_transaction_id:"",provider_fields:"",fetched_at:"",review_status:"HOLD"};
       try{
         const response=await fetch("/api/internal/authbridge-rc-bulk",{method:"POST",credentials:"include",headers:{"Content-Type":"application/json"},body:JSON.stringify({registrationNumbers:[normalize(row.registration_number)]})});
         if(!response.ok){if(response.status===401||response.status===403){setMessage("Not authorized for IT Super User RC enrichment. Stopped.");break;}throw Error("Request failed");}
         const payload=await response.json();
         const details=payload.results?.[0];
         if(!details)throw Error("No RC response");
         result={...result,lookup_status:details.status??"request_error",lookup_source:details.source??"",provider_transaction_id:details.transactionId??"",provider_fields:JSON.stringify(details.fields??{}),fetched_at:details.lookedUpAt??"",review_status:"HOLD — compare PDF chassis, engine, owner and RC before import"};
       }catch{result.lookup_status="request_error";result.review_status="HOLD — retry provider lookup";}
       record(result);
       await wait(1600);
     }
   }finally{setRunning(false);setMessage(stop.current?"Stopped. Export results to checkpoint.":"Lookup pass complete. Download results for mandatory manual review.");}
 }
 function exportCsv(){
   const keys=["source_row","registration_number","chassis_number","engine_number","model_year","lookup_status","lookup_source","provider_transaction_id","provider_fields","fetched_at","review_status"];
   const csv=[keys.join(","),...resultsRef.current.map(r=>keys.map(k=>escapeCsv((r as unknown as Record<string,string>)[k])).join(","))].join("\r\n");
   const blob=new Blob([csv],{type:"text/csv;charset=utf-8"});
   const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download="shree_authbridge_rc_review_checkpoint.csv";a.click();URL.revokeObjectURL(url);
 }
 return <main className="mx-auto max-w-5xl space-y-4 p-6">
   <div><h1 className="text-xl font-bold">Shree Transport · External fleet preflight</h1><p className="text-sm text-slate-600">Read-only detailed RC enrichment for 101 reviewed candidates. No vehicle import is available on this page.</p></div>
   <section className="rounded-xl border bg-white p-4 space-y-3">
     <label className="block text-sm font-semibold">Upload the 202-row reconciled CSV<input type="file" accept=".csv,text/csv" disabled={running} className="mt-2 block w-full text-sm" onChange={e=>{const f=e.target.files?.[0];if(f)void upload(f);}}/></label>
     <div className="flex flex-wrap gap-3 text-sm"><span>Candidates: {rows.length}/101</span><span>Lookups: {results.length}</span><span>Successful: {results.filter(x=>x.lookup_status==="success").length}</span><span>Review holds: {results.filter(x=>x.lookup_status!=="success").length}</span></div>
     <div className="flex flex-wrap gap-2"><button className="rounded bg-blue-900 px-4 py-2 text-white disabled:opacity-40" disabled={running||rows.length!==101} onClick={()=>void start()}>{running?"Fetching…":"Start / Resume AuthBridge lookup"}</button><button className="rounded border px-4 py-2 disabled:opacity-40" disabled={!running} onClick={()=>{stop.current=true;}}>Stop after current vehicle</button><button className="rounded border px-4 py-2 disabled:opacity-40" disabled={results.length===0} onClick={exportCsv}>Export review checkpoint</button></div>
     <p role="status" className="text-sm text-slate-600">{message}</p>
     <p className="text-xs text-amber-800">Provider success does not automatically approve ownership, chassis or engine identity. Every row remains on HOLD until reviewed. Download checkpoint before navigating away.</p>
   </section>
   {results.length>0&&<section className="overflow-x-auto rounded-xl border bg-white"><table className="w-full text-left text-xs"><thead><tr className="border-b bg-slate-100"><th className="p-3">RC</th><th className="p-3">Source chassis</th><th className="p-3">AuthBridge</th><th className="p-3">Source</th><th className="p-3">Decision</th></tr></thead><tbody>{results.map(r=><tr key={r.source_row} className="border-b"><td className="p-3">{r.registration_number}</td><td className="p-3">{r.chassis_number}</td><td className="p-3">{r.lookup_status}</td><td className="p-3">{r.lookup_source}</td><td className="p-3">Hold for review</td></tr>)}</tbody></table></section>}
 </main>;
}
