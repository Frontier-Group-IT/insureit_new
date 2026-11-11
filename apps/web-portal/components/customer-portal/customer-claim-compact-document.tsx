"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FileText, LoaderCircle, Upload, Video } from "lucide-react";
import { uploadCustomerClaimDocument } from "@/app/customer/(protected)/claims/[id]/stage/[stage]/upload-action";
import { reuseCustomerLinkedPolicyCopy } from "@/app/customer/(protected)/claims/[id]/stage/[stage]/reuse-policy-copy-action";
import { ClaimStageErrorDialog } from "@/components/claim-manager/claim-stage-error-dialog";
import { CustomerErrorDialog } from "./customer-error-dialog";
import { CustomerSpotAttachmentDelete } from "./customer-spot-attachment-delete";

// These images are the same artwork used by the Customer mobile app.
const artworkBase = "/assets/customer-claim/document-icons/";
const documentArtwork: Record<string, string> = {
  accidentphoto: "glossy_pink_camera_document_icon.png",
  spotphoto: "glossy_pink_camera_document_icon.png",
  accidentphotos: "glossy_pink_camera_document_icon.png",
  rccopy: "glossy_green_vehicle_document_icon.png",
  insurancecopy: "glossy_blue_secure_policy_document_icon.png",
  driverlicence: "glossy_purple_id_card_icon.png",
  grloadbill: "glossy_orange_delivery_document_icon.png",
  accidentvideo: "glossy_red_video_document_icon.png",
  incidentvoicenote: "glossy_red_video_file_icon.png",
  audio: "glossy_red_video_file_icon.png",
  fitnesscopy: "glossy_green_vehicle_document_icon.png",
  fasttagreportlast15days: "glossy_orange_delivery_document_icon.png",
  spotreport: "glossy_pink_camera_document_icon.png",
  estimatecopy: "glossy_orange_delivery_document_icon.png",
  permitcopy: "glossy_green_vehicle_document_icon.png",
  taxreceipt: "glossy_orange_delivery_document_icon.png",
  puccopy: "glossy_green_vehicle_document_icon.png",
  kycdocument: "glossy_purple_id_card_icon.png",
  otherdocument: "glossy_blue_secure_policy_document_icon.png",
  claimform: "glossy_blue_secure_policy_document_icon.png",
  dischargevoucher: "glossy_orange_delivery_document_icon.png",
  driveraadhaarfront: "glossy_purple_id_card_icon.png",
  driveraadhaarback: "glossy_purple_id_card_icon.png",
  driverstatement: "glossy_purple_id_card_icon.png",
  roadtax: "glossy_orange_delivery_document_icon.png",
  localpermita: "glossy_green_vehicle_document_icon.png",
  localpermitb: "glossy_green_vehicle_document_icon.png",
  nationalpermit: "glossy_green_vehicle_document_icon.png",
  authorizationletter: "glossy_blue_secure_policy_document_icon.png",
  aadhaar: "glossy_purple_id_card_icon.png",
  pan: "glossy_purple_id_card_icon.png",
  gst: "glossy_blue_secure_policy_document_icon.png",
  cancelledcheque: "glossy_blue_secure_policy_document_icon.png",
  kycform: "glossy_purple_id_card_icon.png",
  tpaffidavit: "glossy_blue_secure_policy_document_icon.png",
  towingbill: "glossy_orange_delivery_document_icon.png",
  repairestimate: "glossy_orange_delivery_document_icon.png",
  ncbverification: "glossy_blue_secure_policy_document_icon.png",
};
function documentIcon(type: string): string {
  const name = type.toLowerCase().replace(/[^a-z0-9]/g, "");
  return artworkBase + (documentArtwork[name] || "glossy_blue_secure_policy_document_icon.png");
}

export type CustomerClaimFile = { id:string; document_type:string; created_at:string; file_name?:string|null; verification_status?:string|null };
export function CustomerClaimCompactDocument({label,type,documents,accountId,claimId,stage,allowUpload=true,returnToSpotIntimation=false,canReusePolicyCopy=false,showFilePreview=true,accept=".pdf,.jpg,.jpeg,.png,.webp,.heic"}:{
  label:string;type:string;documents:CustomerClaimFile[];accountId:string;claimId:string;stage:string;allowUpload?:boolean;returnToSpotIntimation?:boolean;canReusePolicyCopy?:boolean;showFilePreview?:boolean;accept?:string;
}) {
  const router=useRouter();
  const [expanded,setExpanded]=useState(false);
  const [reusePending,startReuse]=useTransition();
  const [reuseError,setReuseError]=useState("");
  const [reused,setReused]=useState(false);
  const [uploadState,uploadAction,uploading]=useActionState(uploadCustomerClaimDocument,{error:null});
  const [recentUploads,setRecentUploads]=useState<CustomerClaimFile[]>([]);
  const [deletedIds,setDeletedIds]=useState<string[]>([]);
  const [errorNotice,setErrorNotice]=useState<string|null>(null);
  const shownUploadId=useRef<string|null>(null);
  useEffect(()=>{if(uploadState.error)setErrorNotice(uploadState.error);},[uploadState.error]);
  useEffect(()=>{
    if(uploadState.uploaded && !uploadState.error && shownUploadId.current!==uploadState.uploaded.id){
      shownUploadId.current=uploadState.uploaded.id;
      setRecentUploads(current=>current.some(doc=>doc.id===uploadState.uploaded!.id)?current:[uploadState.uploaded!,...current]);
      if(input.current)input.current.value="";
      router.refresh(); // Sync the consolidated uploaded-document count after a category upload.
    }
  },[uploadState.uploaded]);
  const reuseCopy=()=>startReuse(async()=>{
    setReuseError("");
    try {
      const result=await reuseCustomerLinkedPolicyCopy(accountId,claimId,stage);
      if (!result.ok) { setReuseError(result.message); return; }
      if (result.uploaded) setRecentUploads(current=>current.some(doc=>doc.id===result.uploaded!.id)?current:[result.uploaded!,...current]);
      setReused(true);
      router.refresh();
    } catch { setReuseError("Unable to reuse the existing policy copy. Please try again."); }
  });
  const input=useRef<HTMLInputElement>(null);
  const form=useRef<HTMLFormElement>(null);
  const ordered=[...recentUploads,...documents.filter(doc=>!recentUploads.some(recent=>recent.id===doc.id))].filter(doc=>!deletedIds.includes(doc.id)).sort((a,b)=>Date.parse(b.created_at)-Date.parse(a.created_at));
  const openFile=(file:CustomerClaimFile)=><div key={file.id} className="customer-claim-ref-file flex min-w-0 items-center rounded-md border border-[#CCD4DF] bg-[#F8FAFC] pr-1 transition-colors hover:border-[#AEBBCB] hover:bg-[#F1F5F9]">
    <a href={`/customer/claim-documents/${encodeURIComponent(file.id)}/open?account=${encodeURIComponent(accountId)}&claim=${encodeURIComponent(claimId)}`} target="_blank" rel="noopener noreferrer" className="flex min-w-0 flex-1 items-center gap-2 px-2 py-2 text-[11px] text-[#204D83] focus-visible:outline-2 focus-visible:outline-[#1769DC]" title={file.file_name||label}><FileText className="h-4 w-4 shrink-0"/><span className="truncate">{file.file_name||label}</span></a>
    {allowUpload && file.verification_status === "pending" && (stage === "spot_intimation" || stage === "claim_intimation") ?
      <CustomerSpotAttachmentDelete accountId={accountId} claimId={claimId} documentId={file.id} fileName={file.file_name||label} stage={stage === "spot_intimation" ? "spot_intimation" : "claim_intimation"}
        onDeleted={id=>setDeletedIds(previous=>[...previous,id])}/> : null}
  </div>;;
  return <article className={`customer-claim-ref-card customer-workflow customer-workflow-document min-w-0 rounded-xl border bg-white px-3 py-2.5 ${ordered.length > 0 ? "border-[#CDD5DF]" : "border-[#E2E8F0]"}`}>
    <CustomerErrorDialog title="Document upload failed" message={errorNotice} onClose={()=>setErrorNotice(null)}/>
    <div className="flex items-center justify-between gap-2">
      <div className="flex min-w-0 flex-1 items-center gap-2">{type.toLowerCase().replace(/[^a-z0-9]/g,"")==="accidentvideo"?<span aria-hidden="true" className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-[#F21E38] text-white"><Video className="h-4 w-4 fill-current"/></span>:<img src={documentIcon(type)} alt="" aria-hidden="true" loading="lazy" className="h-7 w-7 shrink-0 object-contain" />}<h3 className="min-w-0 text-[12px] font-semibold text-[#102B54]">{label}</h3></div>
      {showFilePreview && ordered.length>0?<button type="button" aria-expanded={ordered.length>1?expanded:undefined} aria-label={ordered.length>1?`${ordered.length} uploaded, ${expanded?'collapse':'expand'} documents`:`${ordered.length} uploaded`} onClick={ordered.length>1?()=>setExpanded(v=>!v):undefined} className={`inline-flex shrink-0 items-center gap-1 rounded-full bg-[#EDF8F2] px-2 py-0.5 text-[10px] font-semibold text-[#087A57] ${ordered.length>1?'cursor-pointer transition hover:bg-[#DFF3E8] focus-visible:outline-2 focus-visible:outline-[#16835D]':'cursor-default'}`}>{ordered.length} Uploaded</button>:null}
      {allowUpload?<form action={uploadAction} ref={form}>
        <input type="hidden" name="account" value={accountId}/><input type="hidden" name="claim" value={claimId}/><input type="hidden" name="stage" value={stage}/><input type="hidden" name="type" value={type}/><input type="hidden" name="returnToSpotIntimation" value={returnToSpotIntimation?"1":"0"}/>
        <input ref={input} type="file" name="file" required accept={accept} className="sr-only" aria-label={`Choose ${label}`} onChange={e=>{if(e.currentTarget.files?.length)form.current?.requestSubmit();}}/>
        <button type="button" disabled={uploading} onClick={()=>input.current?.click()} aria-label={`Upload ${label}`} title={`Upload ${label}`} className="customer-claim-motion-upload grid h-8 w-8 place-items-center rounded-md border border-[#BCD1F1] text-[#2460B8] hover:bg-[#EDF4FF] disabled:opacity-50" aria-busy={uploading}>{uploading?<LoaderCircle className="customer-claim-motion-spinner h-4 w-4" aria-hidden="true"/>:<Upload className="h-4 w-4" aria-hidden="true"/>}</button>
      </form>:null}
    </div>
    {canReusePolicyCopy && !reused && allowUpload ? <button type="button" disabled={reusePending} onClick={reuseCopy}
      className="mt-2 rounded-lg border border-[#BCD1F1] bg-[#EFF5FF] px-3 py-1.5 text-[11px] font-semibold text-[#205CB2] hover:bg-[#E2EDFF] disabled:opacity-50">
      {reusePending ? "Linking policy copy…" : "Use Existing Policy Copy"}
    </button> : null}
    <ClaimStageErrorDialog message={reuseError} onClose={()=>setReuseError("")}/>
    {showFilePreview && ordered.length>0?<div className="mt-2 space-y-1.5">
      {openFile(ordered[0])}
      {ordered.length>1&&expanded?ordered.slice(1).map(openFile):null}
    </div>:null}
  </article>;
}
