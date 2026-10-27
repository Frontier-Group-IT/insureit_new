"use server";

import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { getCustomerWebSession } from "@/lib/customer-web";
import { resolveCustomerWebScope } from "@/lib/customer-web-data";
import { loadCustomerClaimDetail } from "@/lib/customer-web-phase2-data";

const documentTypes=[
  "RC Copy","Insurance Copy","Driver Licence","GR / Load Bill",
  "Accident Photo","Accident Video","Spot Intimation Attachment","Incident Voice Note",
  "Estimate Copy","Fitness Copy","Spot Report",
  "Fasttag report last 15 days","Permit Copy","Tax Receipt","PUC Copy",
  "KYC Document","Other Document","Claim Form","Discharge Voucher",
  "Driver Aadhaar Front","Driver Aadhaar Back","Driver Statement",
  "Road Tax","Local Permit A","Local Permit B","National Permit","Authorization Letter",
  "Aadhaar","PAN","GST","Cancelled Cheque","KYC Form",
  "TP Affidavit","Towing Bill","Repair Estimate","NCB Verification",
];

export type CustomerClaimUploadState = { error: string | null; uploaded?: { id: string; document_type: string; created_at: string; file_name: string; verification_status: string | null } | null; uploadedCount?: number };

export async function uploadCustomerClaimDocument(_previous:CustomerClaimUploadState, form:FormData):Promise<CustomerClaimUploadState> {
  const accountId=String(form.get("account")||"");
  const claimId=String(form.get("claim")||"");
  const type=String(form.get("type")||"");
  if(!documentTypes.includes(type))return {error:"Unsupported claim document category."};
  const files=form.getAll("file").filter((value):value is File=>value instanceof File&&value.size>0);
  if(!files.length)return {error:"Select at least one file to upload."};
  if(files.length>10)return {error:"Select up to 10 files at a time."};
  const supported=["application/pdf","image/jpeg","image/png","image/webp","image/heic","video/mp4","video/quicktime","video/webm","audio/mp4","audio/m4a","audio/x-m4a","audio/webm","audio/ogg"];
  for(const file of files){
    if(!supported.includes(file.type))return {error:"Unsupported claim document format: "+file.name};
    if(file.size>(file.type.startsWith("video/")?50:5)*1024*1024)return {error:"Claim document exceeds allowed file size: "+file.name};
  }
  const {account}=await resolveCustomerWebScope(accountId);
  const {claim}=await loadCustomerClaimDetail(account.id,claimId);
  if(claim.claim_service_mode==="broker_managed" && ["Settled","Closed","Claim Complete"].includes(claim.current_status))
    return {error:"Completed managed claims cannot accept new customer documents."};
  const session=await getCustomerWebSession();
  // Customer account and claim ownership have been checked by the server above.
  const db=createSupabaseAdminClient();
  let lastUploaded: CustomerClaimUploadState["uploaded"]=null;
  let uploadedCount=0;
  for(const file of files){
    const ext=file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g,"")||"pdf";
    const path=account.id+"/"+claim.id+"/"+crypto.randomUUID()+"."+ext;
    const uploaded=await db.storage.from("claim-documents").upload(path,file,{contentType:file.type,upsert:false});
    if(uploaded.error){
      console.error("Customer claim storage upload failed",{claimId:claim.id,message:uploaded.error.message});
      return {error:"Unable to upload "+file.name+"; "+uploadedCount+" previous file(s) saved.",uploadedCount};
    }
    const saved=await db.from("claim_documents").insert({
      claim_id:claim.id,customer_id:account.id,document_type:type,
      file_name:file.name.slice(0,180),storage_bucket:"claim-documents",storage_path:path,
      mime_type:file.type,file_size:file.size,uploaded_by:session.user.id,
    }).select("id, document_type, created_at, file_name, verification_status").single();
    if(saved.error){
      await db.storage.from("claim-documents").remove([path]);
      return {error:"Unable to register "+file.name+"; "+uploadedCount+" previous file(s) saved.",uploadedCount};
    }
    uploadedCount++;
    if(files.length===1) return { error: null, uploaded: saved.data };
    lastUploaded=saved.data;
  }
  // Preserve the current-main no-redirect contract: unsaved stage fields must not reset.
  return {error:null,uploaded:lastUploaded,uploadedCount};

}
