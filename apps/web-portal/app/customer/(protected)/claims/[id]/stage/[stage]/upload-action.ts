"use server";

import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/auth-server";
import { getCustomerWebSession } from "@/lib/customer-web";
import { resolveCustomerWebScope } from "@/lib/customer-web-data";
import { loadCustomerClaimDetail } from "@/lib/customer-web-phase2-data";

const documentTypes=[
  "RC Copy","Insurance Copy","Driver Licence","GR / Load Bill",
  "Accident Photo","Accident Video","Spot Intimation Attachment","Incident Voice Note",
  "Estimate Copy","Fitness Copy","Spot Report",
];

export async function uploadCustomerClaimDocument(form:FormData) {
  const accountId=String(form.get("account")||"");
  const claimId=String(form.get("claim")||"");
  const stage=String(form.get("stage")||"");
  const type=String(form.get("type")||"");
  if(!documentTypes.includes(type))throw new Error("Unsupported claim document category");
  const file=form.get("file");
  if(!(file instanceof File)||file.size===0)throw new Error("Select a file to upload");
  const video=file.type.startsWith("video/");
  const supported=["application/pdf","image/jpeg","image/png","image/webp","image/heic","video/mp4","video/quicktime","video/webm","audio/mp4","audio/m4a","audio/x-m4a"];
  if(!supported.includes(file.type))throw new Error("Unsupported claim document format");
  const limit=video?50*1024*1024:5*1024*1024;
  if(file.size>limit)throw new Error("Claim document exceeds allowed file size");
  const {account}=await resolveCustomerWebScope(accountId);
  const {claim}=await loadCustomerClaimDetail(account.id,claimId);
  if(claim.claim_service_mode==="broker_managed" && ["Settled","Closed","Claim Complete"].includes(claim.current_status))
    throw new Error("Completed managed claims cannot accept new customer documents");
  const session=await getCustomerWebSession();
  const db=await createServerSupabaseClient();
  const ext=file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g,"")||"pdf";
  const path=account.id+"/"+claim.id+"/"+crypto.randomUUID()+"."+ext;
  const uploaded=await db.storage.from("claim-documents").upload(path,file,{contentType:file.type,upsert:false});
  if(uploaded.error)throw new Error("Unable to upload claim document");
  const saved=await db.from("claim_documents").insert({
    claim_id:claim.id,customer_id:account.id,document_type:type,
    file_name:file.name.slice(0,180),storage_bucket:"claim-documents",storage_path:path,
    mime_type:file.type,file_size:file.size,uploaded_by:session.user.id,
  });
  if(saved.error){
    await db.storage.from("claim-documents").remove([path]);
    throw new Error("Document uploaded but could not be registered; please retry");
  }
  redirect("/customer/claims/"+encodeURIComponent(claim.id)+"/stage/"+encodeURIComponent(stage)+"?account="+encodeURIComponent(account.id));
}
