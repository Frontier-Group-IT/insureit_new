"use server";

import { redirect } from "next/navigation";
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

export type CustomerClaimUploadState = { error: string | null };

export async function uploadCustomerClaimDocument(_previous:CustomerClaimUploadState, form:FormData):Promise<CustomerClaimUploadState> {
  const accountId=String(form.get("account")||"");
  const claimId=String(form.get("claim")||"");
  const stage=String(form.get("stage")||"");
  const type=String(form.get("type")||"");
  const returnToSpotIntimation=form.get("returnToSpotIntimation")==="1";
  if(!documentTypes.includes(type))return {error:"Unsupported claim document category."};
  const file=form.get("file");
  if(!(file instanceof File)||file.size===0)return {error:"Select a file to upload."};
  const video=file.type.startsWith("video/");
  const supported=["application/pdf","image/jpeg","image/png","image/webp","image/heic","video/mp4","video/quicktime","video/webm","audio/mp4","audio/m4a","audio/x-m4a","audio/webm","audio/ogg"];
  if(!supported.includes(file.type))return {error:"Unsupported claim document format."};
  const limit=video?50*1024*1024:5*1024*1024;
  if(file.size>limit)return {error:"Claim document exceeds allowed file size."};
  const {account}=await resolveCustomerWebScope(accountId);
  const {claim}=await loadCustomerClaimDetail(account.id,claimId);
  if(claim.claim_service_mode==="broker_managed" && ["Settled","Closed","Claim Complete"].includes(claim.current_status))
    return {error:"Completed managed claims cannot accept new customer documents."};
  const session=await getCustomerWebSession();
  // Customer account and claim ownership have been checked by the server above.
  const db=createSupabaseAdminClient();
  const ext=file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g,"")||"pdf";
  const path=account.id+"/"+claim.id+"/"+crypto.randomUUID()+"."+ext;
  const uploaded=await db.storage.from("claim-documents").upload(path,file,{contentType:file.type,upsert:false});
  if(uploaded.error){
    console.error("Customer claim storage upload failed", { claimId:claim.id, message:uploaded.error.message });
    return {error:"Unable to upload this document. Please try again."};
  }
  const saved=await db.from("claim_documents").insert({
    claim_id:claim.id,customer_id:account.id,document_type:type,
    file_name:file.name.slice(0,180),storage_bucket:"claim-documents",storage_path:path,
    mime_type:file.type,file_size:file.size,uploaded_by:session.user.id,
  });
  if(saved.error){
    await db.storage.from("claim-documents").remove([path]);
    return {error:"Document uploaded but could not be registered; please retry."};
  }
  if (returnToSpotIntimation && stage==="spot_intimation" && claim.current_status==="Draft") {
    redirect("/customer/spot-intimation?account="+encodeURIComponent(account.id)+"&id="+encodeURIComponent(claim.id));
  }
  redirect("/customer/claims/"+encodeURIComponent(claim.id)+"/stage/"+encodeURIComponent(stage)+"?account="+encodeURIComponent(account.id));
}
