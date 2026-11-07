"use server";

import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { getCustomerWebSession } from "@/lib/customer-web";
import { resolveCustomerWebScope } from "@/lib/customer-web-data";
import { loadCustomerClaimDetail, isExternalCustomerClaim, buildExternalClaimProjection } from "@/lib/customer-web-phase2-data";

const documentTypes=[
  "RC Copy","Insurance Copy","Driver Licence","GR / Load Bill",
  "Accident Photo","Accident Video","Spot Intimation Attachment","Incident Voice Note",
  "Estimate Copy","Fitness Copy","Spot Report",
  "Fasttag report last 15 days","Permit Copy","Tax Receipt","PUC Copy",
  "KYC Document","Other Document","Claim Form","Discharge Voucher",
  "Driver Aadhaar Front","Driver Aadhaar Back","Driver Statement",
  "Road Tax","Local Permit A","Local Permit B","National Permit","Authorization Letter",
  "Aadhaar","PAN","GST","Cancelled Cheque","KYC Form",
  "TP Affidavit","Towing Bill","Repair Estimate","NCB Verification","Final Workshop Bill",
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
    if(type==="Final Workshop Bill" && (!["application/pdf","image/jpeg","image/png"].includes(file.type) || !/\.(pdf|jpe?g|png)$/i.test(file.name) || file.size>5*1024*1024))return {error:"Final workshop bill must be PDF, JPG or PNG and no larger than 5 MB."};
    if(!supported.includes(file.type))return {error:"Unsupported claim document format: "+file.name};
    if(file.size>(file.type.startsWith("video/")?50:5)*1024*1024)return {error:"Claim document exceeds allowed file size: "+file.name};
  }
  const {account}=await resolveCustomerWebScope(accountId);
  const {claim,milestones,internal_projection}=await loadCustomerClaimDetail(account.id,claimId);
  if (type==="Final Workshop Bill") {
    if (String(form.get("stage") || "") !== "billing" || !isExternalCustomerClaim(claim)) {
      return {error:"Final workshop bills can only be uploaded in External Claim Billing."};
    }
    const projection=buildExternalClaimProjection(milestones);
    const current=projection.current_stage.key;
    const billing=projection.stages.find(stage=>stage.key==="billing");
    if (current!=="billing" && !billing?.completed) {
      return {error:"Billing is not available for this claim yet."};
    }
    if (["Settled","Closed","Claim Complete"].includes(claim.current_status)) {
      return {error:"Completed claims cannot accept new workshop bills."};
    }
  }
  // Customers cannot bypass the Stage 2 lock by submitting an old upload form.
  if (String(form.get("stage") || "") === "spot_intimation" &&
    claim.claim_service_mode === "broker_managed" && !claim.external_policy_id &&
    ((internal_projection?.completedStageCount ?? 0) >= 2 ||
      milestones.some(item => item.milestone_key === "claim_intimation" &&
        ["completed", "not_applicable"].includes(item.milestone_status)))) {
    return {error:"Claim Intimation (Stage 2) is complete. Stage 1 documents are locked."};
  }
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
    if(files.length===1) return { error: null, uploaded: saved.data, uploadedCount: 1 };
    lastUploaded=saved.data;
  }
  // Preserve the current-main no-redirect contract: unsaved stage fields must not reset.
  return {error:null,uploaded:lastUploaded,uploadedCount};

}

/**
 * Video files may be up to 50 MB, above the 25 MB server-action request limit.
 * Only signed uploads for the authenticated customer's current Stage 1 claim
 * are permitted. No document is registered until uploaded bytes are verified.
 */
export async function prepareCustomerClaimBulkVideo(accountId:string,claimId:string,stage:string,file:{name:string;size:number;type:string}) {
  try {
    if(stage!=="spot_intimation")throw new Error("This video uploader is only available in Spot Intimation.");
    if(!/\.(mp4|mov|webm)$/i.test(file.name)||!["video/mp4","video/quicktime","video/webm"].includes(file.type)||file.size<=0||file.size>50*1024*1024)
      throw new Error("Select a supported video file no larger than 50 MB.");
    const {account}=await resolveCustomerWebScope(accountId);
    const {claim,milestones,internal_projection}=await loadCustomerClaimDetail(account.id,claimId);
    if(claim.claim_service_mode==="broker_managed"&&!claim.external_policy_id &&
      ((internal_projection?.completedStageCount??0)>=2||milestones.some(item=>item.milestone_key==="claim_intimation"&&["completed","not_applicable"].includes(item.milestone_status))))
      throw new Error("Claim Intimation (Stage 2) is complete. Stage 1 documents are locked.");
    if(claim.claim_service_mode==="broker_managed"&&["Settled","Closed","Claim Complete"].includes(claim.current_status))
      throw new Error("Completed managed claims cannot accept new customer documents.");
    await getCustomerWebSession();
    const ext=file.name.split(".").pop()!.toLowerCase();
    const path=account.id+"/"+claim.id+"/bulk-video/"+crypto.randomUUID()+"."+ext;
    const db=createSupabaseAdminClient();
    const signed=await db.storage.from("claim-documents").createSignedUploadUrl(path,{upsert:false});
    if(signed.error||!signed.data?.token)throw new Error("Unable to prepare video upload.");
    return {ok:true,path,token:signed.data.token};
  } catch(error) {return {ok:false,error:error instanceof Error?error.message:"Unable to prepare video upload."};}
}

export async function finalizeCustomerClaimBulkVideo(accountId:string,claimId:string,stage:string,path:string,file:{name:string;size:number;type:string}) {
  try {
    if(stage!=="spot_intimation")throw new Error("Invalid upload stage.");
    const {account}=await resolveCustomerWebScope(accountId);
    const {claim,milestones,internal_projection}=await loadCustomerClaimDetail(account.id,claimId);
    if(claim.claim_service_mode==="broker_managed"&&!claim.external_policy_id &&
      ((internal_projection?.completedStageCount??0)>=2||milestones.some(item=>item.milestone_key==="claim_intimation"&&["completed","not_applicable"].includes(item.milestone_status))))
      throw new Error("Claim Intimation (Stage 2) is complete. Stage 1 documents are locked.");
    if(claim.claim_service_mode==="broker_managed"&&["Settled","Closed","Claim Complete"].includes(claim.current_status))
      throw new Error("Completed managed claims cannot accept new customer documents.");
    const session=await getCustomerWebSession();
    const folder=account.id+"/"+claim.id+"/bulk-video";
    const basename=path.slice(folder.length+1);
    if(!path.startsWith(folder+"/")||!(/^[a-f0-9-]{36}\.(mp4|mov|webm)$/i.test(basename))||
       !/\.(mp4|mov|webm)$/i.test(file.name)||!["video/mp4","video/quicktime","video/webm"].includes(file.type)||
       file.size<=0||file.size>50*1024*1024)throw new Error("Invalid video upload.");
    const db=createSupabaseAdminClient();
    const objects=await db.storage.from("claim-documents").list(folder,{search:basename,limit:10});
    const object=objects.data?.find(item=>item.name===basename);
    if(objects.error||!object)throw new Error("Uploaded video could not be verified.");
    const actualSize=Number(object.metadata?.size);
    if(!Number.isFinite(actualSize)||actualSize!==file.size)throw new Error("Uploaded video size does not match the selected file.");
    const exists=await db.from("claim_documents").select("id").eq("claim_id",claim.id).eq("customer_id",account.id).eq("storage_path",path).maybeSingle();
    if(exists.error||exists.data)throw new Error("Video already registered or cannot be checked.");
    const saved=await db.from("claim_documents").insert({
      claim_id:claim.id,customer_id:account.id,document_type:"Other Document",
      file_name:file.name.slice(0,180),storage_bucket:"claim-documents",storage_path:path,
      mime_type:file.type,file_size:actualSize,uploaded_by:session.user.id,
    }).select("id, document_type, created_at, file_name, verification_status").single();
    if(saved.error||!saved.data)throw new Error("Unable to register uploaded video.");
    return {ok:true,uploaded:saved.data};
  } catch(error) {return {ok:false,error:error instanceof Error?error.message:"Video upload failed."};}
}
