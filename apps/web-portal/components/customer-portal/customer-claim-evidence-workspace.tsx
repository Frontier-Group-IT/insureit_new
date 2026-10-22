import { Camera, CheckCircle2, FilePlus2, FileText, IdCard, Mic, ShieldCheck, Truck, Video } from "lucide-react";
import { uploadCustomerClaimDocument } from "@/app/customer/(protected)/claims/[id]/stage/[stage]/upload-action";

type DocumentRow = { id:string; document_type:string; verification_status:string|null; created_at:string; file_name?:string|null };

const definitions = [
  { label:"Accident Photo", type:"Accident Photo", icon:Camera, color:"text-pink-500" },
  { label:"RC Copy", type:"RC Copy", icon:FileText, color:"text-emerald-600" },
  { label:"Insurance Copy", type:"Insurance Copy", icon:ShieldCheck, color:"text-blue-600" },
  { label:"Driver Licence", type:"Driver Licence", icon:IdCard, color:"text-purple-600" },
  { label:"GR / Load Bill", type:"GR / Load Bill", icon:Truck, color:"text-orange-500" },
  { label:"Accident Video", type:"Accident Video", icon:Video, color:"text-rose-500" },
  { label:"Audio", type:"Incident Voice Note", icon:Mic, color:"text-blue-600" },
] as const;

export function CustomerClaimEvidenceWorkspace({documents,claimId,accountId,stage,returnToSpotIntimation=false}:{documents:DocumentRow[];claimId:string;accountId:string;stage:string;returnToSpotIntimation?:boolean}) {
  const normalized = (v:string)=>v.trim().toLowerCase().replace(/[^a-z0-9]/g,"");
  const match = (type:string, expected:string)=>normalized(type)===normalized(expected)
    || (expected==="Incident Voice Note" && ["audio","voicenote","incidentaudio"].includes(normalized(type)))
    || (expected==="Accident Photo" && ["spotphoto","accidentphotos"].includes(normalized(type)));
  const uploadedTypes = definitions.filter(d=>documents.some(x=>match(x.document_type,d.type))).length;
  return <section className="overflow-hidden rounded-2xl border border-[#D9E3F0] bg-white shadow-[0_8px_22px_rgba(7,29,73,0.025)]">
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[#D9E3F0] px-5 py-4">
      <h2 className="text-[17px] font-semibold text-[#071D49]">Claim Documents</h2>
      <span className="rounded-lg bg-[#F1F5FB] px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-[#64748B]">Documents uploaded {uploadedTypes} / 7</span>
    </header>
    <div className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-3">
      {definitions.map(({label,type,icon:Icon,color})=>{
        const items=documents.filter(x=>match(x.document_type,type));

        return <div key={type} className="min-h-[128px] rounded-xl border border-[#DCE5F4] bg-white p-3">
          <div className="flex items-center justify-between gap-2">
            <h3 className="flex items-center gap-2 text-[12px] font-semibold text-[#071D49]"><Icon className={`h-5 w-5 ${color}`}/>{label}</h3>
            <span className="text-[10px] font-semibold text-[#8B97A9]">Customer upload</span>
          </div>
          <div className="mt-3 flex items-center gap-2 text-[11px]">
            {items.length ? <span className="inline-flex items-center gap-1 rounded-xl bg-[#EFF9F3] px-2 py-1.5 font-semibold text-[#2A5360]"><CheckCircle2 className="h-4 w-4 text-[#0CA66D]"/>{items.length} Uploaded</span> : <span className="rounded-xl bg-[#F1F5FB] px-2 py-1.5 font-semibold text-[#64748B]">Not uploaded</span>}
          </div>
          {items.length>0&&<div className="mt-2 space-y-1 border-t border-[#EDF1F6] pt-2">{items.map(item=><div key={item.id} className="flex items-center justify-between gap-2 rounded-lg bg-[#FAFCFF] px-2 py-1.5 text-[10px]"><span className="truncate text-[#435B7D]" title={item.file_name || label}>{item.file_name || label + " · " + new Date(item.created_at).toLocaleDateString("en-IN")}</span><span className="shrink-0 font-semibold text-[#13855B]">Uploaded</span></div>)}</div>}
          <form action={uploadCustomerClaimDocument} className="mt-2 flex items-end gap-2 border-t border-[#EDF1F6] pt-2">
            <input type="hidden" name="account" value={accountId}/><input type="hidden" name="claim" value={claimId}/><input type="hidden" name="stage" value={stage}/><input type="hidden" name="returnToSpotIntimation" value={returnToSpotIntimation ? "1" : "0"}/><input type="hidden" name="type" value={type}/>
            <label className="min-w-0 flex-1"><span className="sr-only">Upload {label}</span><input type="file" name="file" required accept={type==="Accident Video"?"video/mp4,video/quicktime,video/webm":type==="Incident Voice Note"?"audio/mp4,audio/x-m4a,audio/m4a":".pdf,.jpg,.jpeg,.png,.webp,.heic"} className="block w-full text-[10px] text-[#687A95] file:mr-2 file:rounded-md file:border-0 file:bg-[#F0F5FF] file:px-2 file:py-1.5 file:font-semibold file:text-[#24569E]"/></label>
            <button type="submit" aria-label={`Upload ${label}`} className="grid h-8 w-8 shrink-0 place-items-center rounded-md border border-[#BBD0F2] text-[#2460B8] hover:bg-[#EEF4FF]"><FilePlus2 className="h-4 w-4"/></button>
          </form>
        </div>;
      })}
    </div>
    <p className="px-5 pb-4 text-[11px] text-[#64748B]">Documents uploaded here are reviewed separately by the INSUREIT Operations team.</p>
  </section>;
}
