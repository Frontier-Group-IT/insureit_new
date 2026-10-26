"use client";
import {useEffect,useState} from "react";
import {PDFDocument,StandardFonts,rgb} from "pdf-lib";
import {ArrowLeft,ArrowRight,Download,FileText,MessageCircle,ClipboardCopy} from "lucide-react";
import {getInsurerLogo} from "@/lib/insurer-logo";
export type ShareQuote={id:string;name:string;cover:string;idv:number;od:number;tp:number;addons:number;tax:number;premium:number;inspection:string;extras:string[];excess:number};
type CaseStatus="draft"|"ready"|"sent"|"awaiting"|"revision"|"accepted"|"declined";
type ShareCase={ids:string[];status:CaseStatus;acceptedId:string;contactNote:string;events:string[]};
const key="insureit.quote-share-case.preview.v2";
const fingerprint=(value:string)=>{let hash=2166136261;for(let i=0;i<value.length;i++){hash=Math.imul(hash^value.charCodeAt(i),16777619);}return (hash>>>0).toString(36);};
const format=(v:number)=>"Rs. "+v.toLocaleString("en-IN");
function safe(v:string){return v.replace(/[^\x20-\x7e]/g," ").slice(0,110);}
async function createPDF(quotes:ShareQuote[],values:Record<string,string>){
 const pdf=await PDFDocument.create();const regular=await pdf.embedFont(StandardFonts.Helvetica),bold=await pdf.embedFont(StandardFonts.HelveticaBold);
 for(const q of quotes){
  const page=pdf.addPage([595,842]);let y=795;
  const line=(k:string,v:string,emphasis=false)=>{page.drawText(safe(k),{x:48,y,size:11,font:regular,color:rgb(.28,.36,.48)});page.drawText(safe(v),{x:238,y,size:11,font:emphasis?bold:regular,color:rgb(.07,.17,.32)});y-=27;};
  page.drawRectangle({x:0,y:804,width:595,height:38,color:rgb(.07,.19,.36)});
  page.drawText("INSUREIT  |  INSURANCE QUOTATION",{x:44,y:818,size:15,font:bold,color:rgb(1,1,1)});
  page.drawText("ILLUSTRATIVE QUOTATION - NOT ISSUED BY INSURER",{x:48,y:773,size:10,font:bold,color:rgb(.77,.29,.10)});y=735;
  line("Insurer",q.name,true);line("Coverage",q.cover);line("Customer",values.ownerName||"Not provided");
  line("Vehicle",[values.make,values.model].filter(Boolean).join(" ")||"Not provided");
  line("Reg / Chassis",values.registrationNumber||values.chassisNumber||"Not provided");
  line("Business",values.businessType||"Not provided");
  line("Vehicle IDV",q.cover==="Third Party"?"Not applicable":format(q.idv));
  line("Own damage",format(q.od));line("Third party",format(q.tp));line("Optional covers",format(q.addons));
  line("Illustrative tax",format(q.tax));line("TOTAL PAYABLE",format(q.premium),true);
  line("Inspection",q.inspection);line("Deductible",format(q.excess));
  line("Add-ons",q.extras.length?safe(q.extras.join(", ")):"None");
  y-=20;page.drawText("Terms, exclusions and actual insurer eligibility must be verified.",{x:48,y,size:9,font:regular,color:rgb(.37,.38,.44)});
  page.drawText("This is an internal workflow preview. No payment or policy issuance.",{x:48,y:y-18,size:9,font:regular,color:rgb(.37,.38,.44)});
  page.drawRectangle({x:42,y:25,width:511,height:34,color:rgb(.99,.95,.90)});
  page.drawText("NOT A VALID INSURER QUOTATION OR POLICY",{x:65,y:37,size:11,font:bold,color:rgb(.72,.25,.10)});
 }
 return await pdf.save();
}
export default function QuoteSharingWorkbench({quotes,values,onBack,onAccept}:{quotes:ShareQuote[];values:Record<string,string>;onBack:()=>void;onAccept:(id:string)=>void}){
 const [state,setState]=useState<ShareCase>({ids:quotes.map(q=>q.id),status:"draft",acceptedId:"",contactNote:"",events:[]});
 const [viewer,setViewer]=useState<string|null>(quotes[0]?.id||null);
 const quoteIds=quotes.map(q=>q.id).join(",");
 const contextKey=fingerprint([quoteIds,values.registrationNumber||values.chassisNumber||"",values.ownerName||""].join("|"));
 const [notice,setNotice]=useState("");
 useEffect(()=>{try{const raw=sessionStorage.getItem(key);if(raw){const stored=JSON.parse(raw) as {contextKey:string;data:ShareCase};const saved=stored?.data;if(stored?.contextKey===contextKey&&saved&&Array.isArray(saved.ids)&&saved.ids.join(",")===quoteIds)setState(saved);}}catch{}},[quoteIds,contextKey]);
 const apply=(part:Partial<ShareCase>,event?:string)=>setState(prev=>{const next={...prev,...part,events:event?[event,...prev.events]:prev.events};try{sessionStorage.setItem(key,JSON.stringify({contextKey,data:next}));}catch{}return next});
 const accepted=quotes.find(q=>q.id===state.acceptedId);
 const selected=quotes.find(q=>q.id===viewer);
 const download=async(items:ShareQuote[])=>{try{const bytes=await createPDF(items,values);const blob=new Blob([new Uint8Array(bytes)],{type:"application/pdf"});const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download=items.length===1?"INSUREIT-Quotation-"+items[0].id+".pdf":"INSUREIT-Quote-Comparison.pdf";a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);apply({status:state.status==="draft"?"ready":state.status},"Quotation PDF prepared");setNotice("PDF downloaded. It is clearly watermarked as illustrative.");}catch{setNotice("Unable to generate PDF. Please retry.");}};
 const summary=quotes.map(q=>q.name+" - "+format(q.premium)+" ("+q.cover+")").join("; ");
 const message="INSUREIT quotation comparison (preview only): "+summary+". Please review the attached illustrative quotation PDF(s) and advise your preferred insurer. These are sample figures, not insurer-issued offers.";
 const copy=async()=>{try{await navigator.clipboard.writeText(message);setNotice("Message copied to clipboard. No WhatsApp message was sent.");}catch{setNotice("Copy unavailable. Select the message text to copy.");}};
 const money=(v:number)=>"₹"+v.toLocaleString("en-IN");
 return <div className="space-y-3">
  <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3"><div><h2 className="text-[16px] font-bold text-[#173965]">Prepare & Share Quotations</h2><p className="text-[11px] text-slate-500">{quotes.length} selected insurer quotation{quotes.length===1?"":"s"} · Customer confirmation required before booking</p></div><button type="button" onClick={onBack} className="flex items-center gap-2 rounded-lg border px-3 py-2 text-[11px] font-semibold"><ArrowLeft className="h-4 w-4"/>Edit selection</button></div>
  <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(300px,360px)]">
   <div className="space-y-3"><section className="rounded-xl border border-slate-200 bg-white p-3"><div className="mb-3 flex items-center justify-between"><h3 className="text-[13px] font-bold">Quotation documents</h3><button type="button" onClick={()=>void download(quotes)} className="inline-flex items-center gap-1 rounded-lg bg-[#173965] px-3 py-2 text-[11px] font-bold text-white"><Download className="h-4 w-4"/>Download comparison PDF</button></div>
    {quotes.map(q=><div key={q.id} className={`mb-2 flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 ${viewer===q.id?"border-blue-300 bg-blue-50/40":"border-slate-100"}`}><div className="flex items-center gap-2"><img src={getInsurerLogo(q.name)||""} alt={q.name+" logo"} className="h-9 w-14 object-contain"/><div><p className="text-[12px] font-bold text-slate-900">{q.name}</p><p className="text-[11px] text-slate-500">{q.cover} · {money(q.premium)}</p></div></div><div className="flex gap-2"><button type="button" onClick={()=>setViewer(q.id)} className="rounded-lg border border-blue-200 px-2 py-1.5 text-[11px] font-bold text-blue-800">View</button><button type="button" onClick={()=>void download([q])} className="rounded-lg border border-slate-200 px-2 py-1.5 text-[11px] font-bold">PDF</button></div></div>)}
    </section>
    {selected&&<section className="rounded-xl border border-slate-200 bg-white p-4"><div className="mb-2 flex items-center gap-2 text-blue-800"><FileText className="h-4 w-4"/><h3 className="text-[13px] font-bold">Quotation preview — {selected.name}</h3></div><div className="rounded-lg border-2 border-dashed border-amber-200 bg-amber-50 p-2 text-center text-[10px] font-bold text-amber-800">ILLUSTRATIVE — NOT ISSUED BY INSURER</div><div className="mt-3 grid grid-cols-2 gap-3 text-[12px]">{[["Customer",values.ownerName||"Not provided"],["Vehicle",[values.make,values.model].filter(Boolean).join(" ")||"Not provided"],["Coverage",selected.cover],["IDV",money(selected.idv)],["OD premium",money(selected.od)],["TP premium",money(selected.tp)],["Add-ons",money(selected.addons)],["Tax illustration",money(selected.tax)],["Inspection",selected.inspection],["Deductible",money(selected.excess)]].map(([a,b])=><div key={a}><p className="text-[10px] text-slate-500">{a}</p><p className="font-semibold">{b}</p></div>)}</div><p className="mt-3 border-t pt-3 text-[16px] font-bold text-blue-900">Total payable {money(selected.premium)}</p><p className="mt-2 text-[10px] text-amber-700">Actual insurer wording, premiums, validity and eligibility not verified.</p></section>}
   </div>
   <div className="space-y-3"><section className="rounded-xl border border-slate-200 bg-white p-4"><h3 className="mb-3 text-[13px] font-bold">Customer communication</h3><div className="rounded-lg bg-blue-50 p-3 text-[11px] leading-relaxed text-slate-700">{message}</div><div className="mt-3 flex flex-wrap gap-2"><button type="button" onClick={()=>void copy()} className="inline-flex items-center gap-1 rounded-lg border border-blue-200 px-3 py-2 text-[11px] font-bold text-blue-800"><ClipboardCopy className="h-4 w-4"/>Copy message</button><button type="button" onClick={()=>apply({status:"sent"},"Quotation sharing recorded (preview only)")} className="inline-flex items-center gap-1 rounded-lg bg-[#173965] px-3 py-2 text-[11px] font-bold text-white"><MessageCircle className="h-4 w-4"/>Mark as shared</button></div><p className="mt-2 text-[10px] text-slate-500">No WhatsApp or email is sent automatically. PDFs can be downloaded for internal testing.</p></section>
   <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4"><h3 className="text-[13px] font-bold">Customer decision</h3><p className="text-[11px] text-slate-500">Case status: <strong className="capitalize">{state.status.replaceAll("_"," ")}</strong></p><div className="flex flex-wrap gap-2">{(["awaiting","revision","declined"] as CaseStatus[]).map(v=><button type="button" key={v} onClick={()=>apply({status:v,acceptedId:""},"Customer response: "+v)} className="rounded-lg border border-slate-200 px-3 py-2 text-[11px] font-semibold capitalize">{v==="revision"?"Revision requested":v==="awaiting"?"Awaiting response":"Declined"}</button>)}</div><label className="block text-[11px] font-bold text-slate-700">Accepted insurer<select value={state.acceptedId} onChange={e=>apply({acceptedId:e.target.value,status:e.target.value?"accepted":"awaiting"},e.target.value?"Accepted quotation selected":"Selection cleared")} className="mt-1 h-10 w-full rounded-lg border border-slate-300 px-2 text-[12px]"><option value="">Choose customer-agreed quotation</option>{quotes.map(q=><option key={q.id} value={q.id}>{q.name} — {money(q.premium)}</option>)}</select></label><label className="block text-[11px] font-bold text-slate-700">Confirmation notes<textarea rows={2} value={state.contactNote} onChange={e=>apply({contactNote:e.target.value})} className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-[12px]" placeholder="Customer response or follow-up details"/></label><button type="button" disabled={!accepted} onClick={()=>{if(accepted)onAccept(accepted.id)}} className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-700 p-3 text-[12px] font-bold text-white disabled:opacity-40">Start policy booking <ArrowRight className="h-4 w-4"/></button></section>
   <section className="rounded-xl border border-slate-200 bg-white p-3"><p className="text-[12px] font-bold">Case history</p><div className="mt-2 space-y-1">{state.events.slice(0,6).map((v,i)=><p key={i} className="text-[11px] text-slate-600">{v}</p>)}{!state.events.length&&<p className="text-[11px] text-slate-500">Actions appear as quotations are prepared and shared.</p>}</div></section></div>
  </div>{notice&&<p role="status" className="rounded-lg bg-blue-50 p-3 text-[11px] font-semibold text-blue-800">{notice}</p>}
 </div>;
}
