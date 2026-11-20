import { NextResponse } from "next/server";
import { createSupabaseWithAccessToken } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { hasEffectiveCapability } from "@/lib/effective-permissions";
import { getEffectivePermission } from "@/lib/permission-management";
import { isAppRole } from "@/lib/roles";
import { canAccessPolicy } from "@/lib/policy-access-scope";
import { recordDailyWorkflowActivity } from "@/lib/daily-workflow-audit";
import { convertLifeHealthCaseForVerifiedActor } from "@/lib/life-health-case-conversion-engine";
import { requestPolicyDateApprovalForVerifiedActor, verifyPolicyDateApprovalForVerifiedActor } from "@/lib/policy-date-approval-engine";
import { policyDateDecision, POLICY_DATE_APPROVERS } from "@/lib/policy-date-rule";
import { getOperationsHeadDownlinePolicyScope, operationsHeadVisiblePolicyFilter, canAccessOperationsHeadCase } from "@/lib/policy-access-scope";

// Read-only counterpart of the Operations Life/Health Case Register.
// Mutations deliberately remain in the canonical Operations workflow until
// their server-action validation can be shared with bearer-token requests.
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store" };
const DOCUMENT_BUCKET="policy-documents";
const DOC_TYPES=new Set(["proposal_form","benefit_illustration","premium_receipt","policy_copy","kyc","other_document"]);
const DOC_MIMES=new Set(["application/pdf","image/jpeg","image/png","image/webp"]);
const validDocPath=(caseId:string,bucket:string,path:string)=>bucket===DOCUMENT_BUCKET&&path.startsWith("life-health-cases/"+caseId+"/")&&!path.includes("..");
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
type Profile = { id: string; role: string; full_name: string | null; employee_id: string | null; is_active: boolean };
type CaseRow = {
 id:string;case_number:string;business_line:string;status:string;sourcing_date:string;
 customer_id:string;insurance_company_id:string;product_name:string;proposal_number:string;
 premium_paying_term:string|null;policy_duration:string|null;payment_frequency:string;
 payment_mode:string;premium_amount:number;intermediary_type:string|null;intermediary_code:string|null;
 lead_source:string|null;intermediary_mobile:string|null;rm_name:string|null;rm_code:string|null;
 remarks:string|null;final_policy_id:string|null;converted_at:string|null;created_at:string;
 created_by:string|null;converted_by:string|null;details:Record<string,unknown>|null;
};
const columns = "updated_at,id,case_number,business_line,status,sourcing_date,customer_id,insurance_company_id,product_name,proposal_number,premium_paying_term,policy_duration,payment_frequency,payment_mode,premium_amount,intermediary_type,intermediary_code,lead_source,intermediary_mobile,rm_name,rm_code,remarks,final_policy_id,converted_at,created_at,created_by,converted_by,details";
const listColumns = "id,case_number,business_line,status,sourcing_date,customer_id,insurance_company_id,product_name,proposal_number,rm_name,lead_source,premium_amount,created_at,final_policy_id";
const respond = (data:Record<string,unknown>,status=200) => NextResponse.json(data,{status,headers});
const caseStatus = (row:CaseRow) => row.final_policy_id ? "issued" : row.status === "rejected" ? "rejected" : "pending";

async function authorizedEmployee(request: Request) {
 const match = /^Bearer\s+([^\s]+)$/i.exec(request.headers.get("authorization") ?? "");
 if (!match) return null;
 const scoped = createSupabaseWithAccessToken(match[1]);
 const {data:auth,error:authError} = await scoped.auth.getUser(match[1]);
 if (authError || !auth.user) return null;
 const {data:identity,error:identityError} = await scoped.rpc("partner_app_current_identity");
 if (identityError || !identity || identity.actor_kind !== "employee" ||
     identity.profile_id !== auth.user.id || identity.auth_user_id !== auth.user.id) return null;
 const admin = createSupabaseAdminClient();
 const {data:profile,error} = await admin.from("profiles").select("id,role,employee_id,is_active,full_name")
   .eq("id",auth.user.id).maybeSingle<Profile>();
 if (error || !profile?.is_active || !profile.employee_id || !isAppRole(profile.role) ||
     profile.role !== identity.role) return null;
 const {data:employee,error:employeeError} = await admin.from("employees").select("employment_status")
   .eq("id",profile.employee_id).maybeSingle<{employment_status:string}>();
 if (employeeError || employee?.employment_status !== "active") return null;
 if (!(await hasEffectiveCapability(profile,"view_policies","view"))) return null;
 if (profile.role !== "operations_head_life") {
   const legacy = await getEffectivePermission(profile.id, profile.role as Parameters<typeof getEffectivePermission>[1], "view_policies");
   const create = await hasEffectiveCapability(profile,"create_policies","edit");
   if (legacy.access !== "edit" && legacy.access !== "approve" && !create) return null;
 }
 return {profile,admin};
}
export async function GET(request:Request) {
 try {
   const actor = await authorizedEmployee(request);
   if (!actor) return respond({ok:false,error:"Case Register is not available for this account."},403);
   const {profile,admin} = actor;
   const url = new URL(request.url);
   const id = url.searchParams.get("id");
   if(url.searchParams.get("catalog")==="insurers"){
     const {data,error}=await admin.from("insurance_companies").select("id,name").order("name").limit(1000);
     return error?respond({ok:false,error:"Insurer list unavailable."},503):respond({ok:true,insurers:data??[]});
   }
   const downline = profile.role === "operations_head_life"
      ? operationsHeadVisiblePolicyFilter(await getOperationsHeadDownlinePolicyScope(profile.id)) : null;
   if (id !== null) {
     if (!uuid.test(id)) return respond({ok:false,error:"Invalid case reference."},400);
     if (profile.role === "operations_head_life" && !(await canAccessOperationsHeadCase(profile.id,id)))
        return respond({ok:false,error:"Case not found."},404);
     let lookup = admin.from("life_health_cases").select(columns).eq("id",id);
     if (downline !== null) {
       if (!downline) return respond({ok:false,error:"Case not found."},404);
       lookup = lookup.or(downline);
     }
     const {data:found,error} = await lookup.maybeSingle<CaseRow>();
     if (error) return respond({ok:false,error:"Unable to load case."},500);
     if (!found) return respond({ok:false,error:"Case not found."},404);
     const documentId=url.searchParams.get("documentId");
     if(documentId!==null){
       if(!uuid.test(documentId))return respond({ok:false,error:"Invalid document reference."},400);
       const {data:doc,error:docError}=await admin.from("life_health_case_documents")
         .select("storage_bucket,storage_path").eq("case_id",id).eq("id",documentId).maybeSingle();
       if(docError||!doc||!validDocPath(id,doc.storage_bucket,doc.storage_path))
         return respond({ok:false,error:"Document not found."},404);
       const {data:signed,error:signError}=await admin.storage.from(DOCUMENT_BUCKET).createSignedUrl(doc.storage_path,60);
       if(signError||!signed?.signedUrl)return respond({ok:false,error:"Unable to open this document."},503);
       return respond({ok:true,url:signed.signedUrl});
     }
     const [customer,insurer,documents,linkedPolicy,activity] = await Promise.all([
       admin.from("customers").select("id,contact_name,company_name,phone,address,address_street").eq("id",found.customer_id).maybeSingle(),
       admin.from("insurance_companies").select("id,name").eq("id",found.insurance_company_id).maybeSingle(),
       admin.from("life_health_case_documents").select("id,document_type,file_name,created_at,uploaded_by").eq("case_id",id).order("created_at",{ascending:false}),
       found.final_policy_id ? admin.from("policies").select("id,policy_no,policy_code").eq("id",found.final_policy_id).maybeSingle() : Promise.resolve({data:null,error:null}),
       admin.from("audit_logs").select("id,created_at,action,actor_id,new_data").eq("table_name","life_health_cases").eq("record_id",id).in("action",["life_health_case_edited","life_health_case_remark_added","life_health_issued_customer_edited"]).order("created_at",{ascending:false}).limit(100),
     ]);
     if ([customer,insurer,documents,linkedPolicy,activity].some(result => result.error))
       return respond({ok:false,error:"Case details are temporarily unavailable."},500);
     const detail = found.details && typeof found.details === "object" && !Array.isArray(found.details) ? found.details : {};
     const rejection = detail.rejection && typeof detail.rejection === "object" && !Array.isArray(detail.rejection) ? detail.rejection as Record<string,unknown> : {};
     const actorIds=[...new Set([
       found.created_by,found.converted_by,
       ...(documents.data??[]).map(doc=>doc.uploaded_by),
       ...(activity.data??[]).map(entry=>entry.actor_id)
     ].filter((value):value is string=>typeof value==="string"&&uuid.test(value)))];
     const actorNames=new Map<string,string>();
     if(actorIds.length){
       const {data:actors,error:actorError}=await admin.from("profiles").select("id,full_name").in("id",actorIds);
       if(!actorError)for(const actor of actors??[])actorNames.set(actor.id,actor.full_name?.trim()||"Authorized user");
     }
     const by=(id:string|null|undefined)=>id?actorNames.get(id)||"Authorized user":"Not recorded";
     // Do not send commercial terms, unrelated internal metadata, or raw audit payloads.
     const {details:ignoredDetails,...safeCase} = found;
     void ignoredDetails;
     return respond({ok:true,case:{
       ...safeCase,status_group:caseStatus(found),
       customer_name:customer.data?.company_name?.trim() || customer.data?.contact_name || "Customer",
       customer_phone:customer.data?.phone || "",
       customer_address:customer.data?.address_street || customer.data?.address || "",
       insurer_name:insurer.data?.name || "Insurer",
       policy_no:linkedPolicy.data?.policy_no || null,
       rejection_reason:typeof rejection.reason === "string" ? rejection.reason.slice(0,2000) : "",
     },documents:documents.data??[],activities:[
       {id:`case-${found.id}`,action:"Case Created",created_at:found.created_at,createdBy:by(found.created_by),changes:[]},
       ...(documents.data??[]).map(doc=>({id:`document-${doc.id}`,action:doc.document_type==="proposal_form"?"Proposal Form Uploaded":doc.document_type==="kyc"?"KYC Uploaded":doc.document_type==="policy_copy"?"Policy Document Uploaded":"Document Uploaded",created_at:doc.created_at,createdBy:by(doc.uploaded_by),changes:[]})),
       ...(activity.data??[]).map(entry=>({id:`audit-${entry.id}`,action:entry.action==="life_health_case_remark_added"?"Remark Added":entry.action==="life_health_issued_customer_edited"?"Customer Details Updated":"Case Details Updated",created_at:entry.created_at,createdBy:by(entry.actor_id),changes:Array.isArray(entry.new_data?.changed_fields)
         ?entry.new_data.changed_fields.filter((value:unknown):value is string=>typeof value==="string").slice(0,12).map((value:string)=>value.slice(0,160)):[]})),
       ...(found.converted_at?[{id:`converted-${found.id}`,action:"Policy Created & Case Closed",created_at:found.converted_at,createdBy:by(found.converted_by),changes:[]}]:[]),
       ...(typeof rejection.rejected_at==="string" && !Number.isNaN(Date.parse(rejection.rejected_at))?[{id:`rejected-${found.id}`,action:"Case Rejected",created_at:rejection.rejected_at,createdBy:by(typeof rejection.rejected_by==="string"?rejection.rejected_by:null),changes:[]}]:[]),
     ].sort((a,b)=>Date.parse(b.created_at)-Date.parse(a.created_at))});
   }
   const status = url.searchParams.get("status") || "pending";
   if (!["pending","rejected","issued","all"].includes(status)) return respond({ok:false,error:"Invalid status."},400);
   const businessLine = (url.searchParams.get("businessLine") || "all").trim().toLowerCase();
   if (!["all","life","health"].includes(businessLine)) return respond({ok:false,error:"Invalid business line."},400);
   const search = (url.searchParams.get("search") || "").trim().toLowerCase().slice(0,120);
   const limit = Math.min(50,Math.max(1,Number(url.searchParams.get("limit") || "10") || 10));
   const offset = Number(url.searchParams.get("offset") || "0");
   if (!Number.isSafeInteger(offset) || offset < 0) return respond({ok:false,error:"Invalid page."},400);
   // Mirror the Operations register's current 500-record window, including
   // cross-status search; paginate only after server-side filtering.
   let query = admin.from("life_health_cases").select(listColumns).order("created_at",{ascending:false}).limit(500);
   if (downline !== null) {
     if (!downline) return respond({ok:true,cases:[],counts:{pending:0,rejected:0,issued:0,all:0},total:0});
     query = query.or(downline);
   }
   const {data:rows,error} = await query.returns<CaseRow[]>();
   if (error) return respond({ok:false,error:"Unable to load Case Register."},500);
   const all = rows ?? [];
   const customerIds = [...new Set(all.map(row=>row.customer_id))];
   const insurerIds = [...new Set(all.map(row=>row.insurance_company_id))];
   const [customers,insurers] = await Promise.all([
     customerIds.length ? admin.from("customers").select("id,contact_name,company_name,phone").in("id",customerIds) : Promise.resolve({data:[],error:null}),
     insurerIds.length ? admin.from("insurance_companies").select("id,name").in("id",insurerIds) : Promise.resolve({data:[],error:null}),
   ]);
   if (customers.error || insurers.error) return respond({ok:false,error:"Unable to load Case Register details."},500);
   const customerMap = new Map((customers.data??[]).map(row=>[row.id,row]));
   const insurerMap = new Map((insurers.data??[]).map(row=>[row.id,row.name]));
   const result = all.map(row=>{
     const customer=customerMap.get(row.customer_id);
     return {
       id:row.id,case_number:row.case_number,business_line:row.business_line,status_group:caseStatus(row),
       customer_name:customer?.company_name?.trim() || customer?.contact_name || "Customer",
       customer_phone:customer?.phone || "", insurer_name:insurerMap.get(row.insurance_company_id)||"Insurer",
       product_name:row.product_name,proposal_number:row.proposal_number,sourcing_date:row.sourcing_date,
       rm_name:row.rm_name||"",lead_source:row.lead_source||"",premium_amount:Number(row.premium_amount||0),
       created_at:row.created_at,final_policy_id:row.final_policy_id,
     };
   });
   const counts={pending:0,rejected:0,issued:0,all:result.length};
   for (const row of result) counts[row.status_group as "pending"|"rejected"|"issued"]++;
   const visible = result.filter(row=>(status==="all" || row.status_group===status) &&
      (businessLine==="all" || row.business_line.trim().toLowerCase()===businessLine) &&
      (!search || [row.case_number,row.customer_name,row.customer_phone,row.insurer_name,row.product_name,
        row.proposal_number,row.rm_name,row.lead_source,row.status_group].some(value=>String(value).toLowerCase().includes(search))));
   return respond({ok:true,cases:visible.slice(offset,offset+limit),counts,total:visible.length});
 } catch {
   return respond({ok:false,error:"Case Register is temporarily unavailable."},500);
 }
}

// Authenticated native Case Register editing. No unchecked service-role writes:
// only approved pending-case fields, or an issued policy's linked customer details.
// Policy number, dates, insurer, premiums and commercial terms of issued policies
// remain under the existing Operations issued-policy editor/OTP workflow.
export async function POST(request: Request) {
 try {
  const actor=await authorizedEmployee(request);
  if(!actor)return respond({ok:false,error:"Case Register editing is unavailable for this account."},403);
  const {profile,admin}=actor;
  if((request.headers.get("content-type")??"").startsWith("multipart/form-data")){
    const form=await request.formData().catch(()=>null);
    const id=String(form?.get("id")??""),type=String(form?.get("documentType")??"");
    const file=form?.get("file");
    if(!uuid.test(id)||!DOC_TYPES.has(type)||!(file instanceof File))return respond({ok:false,error:"Invalid document submission."},400);
    if(file.size<=0||file.size>4*1024*1024||!DOC_MIMES.has(file.type))
      return respond({ok:false,error:"Upload PDF, JPG, PNG or WebP, maximum 4 MB."},400);
    const {data:caseRow,error:caseError}=await admin.from("life_health_cases").select("status,final_policy_id").eq("id",id).maybeSingle();
    if(caseError||!caseRow)return respond({ok:false,error:"Case not found."},404);
    if(caseRow.final_policy_id||caseRow.status==="rejected")return respond({ok:false,error:"Closed cases cannot accept uploads."},409);
    if(profile.role==="operations_head_life"){
      if(!(await canAccessOperationsHeadCase(profile.id,id)))return respond({ok:false,error:"Case outside your scope."},403);
    }else if(!(await hasEffectiveCapability(profile,"create_policies","edit")))
      return respond({ok:false,error:"Upload permission is required."},403);
    const name=(file.name||"document").replace(/[^a-zA-Z0-9._-]/g,"-").slice(0,140)||"document";
    const path="life-health-cases/"+id+"/"+type+"/"+crypto.randomUUID()+"-"+name;
    const {error:storageError}=await admin.storage.from(DOCUMENT_BUCKET).upload(path,Buffer.from(await file.arrayBuffer()),{contentType:file.type,upsert:false});
    if(storageError)return respond({ok:false,error:"Document upload failed."},503);
    const {data:old,error:lookupError}=await admin.from("life_health_case_documents")
      .select("id,storage_bucket,storage_path").eq("case_id",id).eq("document_type",type).maybeSingle();
    if(lookupError){await admin.storage.from(DOCUMENT_BUCKET).remove([path]);return respond({ok:false,error:"Document lookup failed."},503);}
    const values={file_name:file.name,storage_bucket:DOCUMENT_BUCKET,storage_path:path,mime_type:file.type,file_size:file.size,uploaded_by:profile.id,updated_at:new Date().toISOString()};
    const write=old
      ?await admin.from("life_health_case_documents").update(values).eq("case_id",id).eq("id",old.id)
      :await admin.from("life_health_case_documents").insert({case_id:id,document_type:type,...values});
    if(write.error){await admin.storage.from(DOCUMENT_BUCKET).remove([path]);return respond({ok:false,error:"Document record update failed."},503);}
    if(old&&validDocPath(id,old.storage_bucket,old.storage_path)&&old.storage_path!==path){
      const {error:cleanupError}=await admin.storage.from(DOCUMENT_BUCKET).remove([old.storage_path]);
      if(cleanupError)console.error("Prior document cleanup failed",{caseId:id,type});
    }
    await recordDailyWorkflowActivity(admin,{actorId:profile.id,table:"life_health_cases",recordId:id,action:old?"life_health_case_document_replaced":"life_health_case_document_uploaded"});
    return respond({ok:true});
  }
  const input=await request.json().catch(()=>null) as Record<string,unknown>|null;
  const id=typeof input?.id==="string"?input.id:"";
  if(!uuid.test(id))return respond({ok:false,error:"Invalid case reference."},400);
  const {data:row,error:loadError}=await admin.from("life_health_cases")
   .select("id,status,final_policy_id,customer_id,insurance_company_id,sourcing_date,remarks,product_name,proposal_number,premium_paying_term,policy_duration,payment_frequency,payment_mode,premium_amount,updated_at,intermediary_code")
   .eq("id",id).maybeSingle();
  if(loadError||!row)return respond({ok:false,error:"Case not found."},404);
  if(input?.operation==="delete_document"||input?.operation==="reject_case"){
    if(row.final_policy_id||row.status==="rejected")return respond({ok:false,error:"Only pending cases can be modified."},409);
    if(profile.role==="operations_head_life"){
      if(!(await canAccessOperationsHeadCase(profile.id,id)))return respond({ok:false,error:"Case outside your scope."},403);
    }else if(!(await hasEffectiveCapability(profile,"create_policies","edit")))
      return respond({ok:false,error:"Case modification permission is required."},403);
    if(input.operation==="delete_document"){
      const documentId=typeof input.documentId==="string"?input.documentId:"";
      if(!uuid.test(documentId))return respond({ok:false,error:"Invalid document reference."},400);
      const {data:doc,error:docError}=await admin.from("life_health_case_documents")
        .select("id,storage_bucket,storage_path").eq("case_id",id).eq("id",documentId).maybeSingle();
      if(docError||!doc||!validDocPath(id,doc.storage_bucket,doc.storage_path))
        return respond({ok:false,error:"Document not found."},404);
      const {error:storageError}=await admin.storage.from(DOCUMENT_BUCKET).remove([doc.storage_path]);
      if(storageError)return respond({ok:false,error:"Document could not be deleted from storage."},503);
      const {error:deleteError}=await admin.from("life_health_case_documents").delete().eq("case_id",id).eq("id",documentId);
      if(deleteError)return respond({ok:false,error:"File removed but record cleanup failed. Contact support."},503);
      await recordDailyWorkflowActivity(admin,{actorId:profile.id,table:"life_health_cases",recordId:id,action:"life_health_case_document_deleted"});
      return respond({ok:true});
    }
    if(row.status!=="awaiting_policy"&&row.status!=="draft")return respond({ok:false,error:"Only pending cases can be rejected."},409);
    const reason=typeof input.reason==="string"?input.reason.trim().replace(/\s+/g," "):"";
    if(!reason||reason.length>2000)return respond({ok:false,error:"Enter a rejection reason up to 2,000 characters."},400);
    const {data:current,error:currentError}=await admin.from("life_health_cases")
      .select("status,final_policy_id,remarks,details,updated_at").eq("id",id).maybeSingle();
    if(currentError||!current||current.final_policy_id||!["awaiting_policy","draft"].includes(current.status))
      return respond({ok:false,error:"Case changed. Reload and retry."},409);
    const now=new Date().toISOString();
    const stamp=new Intl.DateTimeFormat("en-IN",{timeZone:"Asia/Kolkata",day:"2-digit",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit",hour12:true}).format(new Date());
    const remarks=[current.remarks?.trim(),"["+stamp+"] Case rejected: "+reason].filter(Boolean).join("\n\n");
    if(remarks.length>50000)return respond({ok:false,error:"Remarks history is full."},409);
    const details={...(current.details&&typeof current.details==="object"&&!Array.isArray(current.details)?current.details:{}),rejection:{reason,rejected_at:now,rejected_by:profile.id}};
    let update=admin.from("life_health_cases").update({status:"rejected",remarks,details,updated_at:now})
      .eq("id",id).eq("status",current.status).eq("updated_at",current.updated_at).is("final_policy_id",null);
    update=current.remarks===null?update.is("remarks",null):update.eq("remarks",current.remarks);
    const {data:saved,error:saveError}=await update.select("id").maybeSingle();
    if(saveError||!saved)return respond({ok:false,error:"Case changed. Reload before rejecting."},409);
    await recordDailyWorkflowActivity(admin,{actorId:profile.id,table:"life_health_cases",recordId:id,action:"life_health_case_rejected"});
    return respond({ok:true});
  }
  // Strict actor-and-case-scoped issuance using the canonical Operations engine.
  const issueAction=["issue_case","issue_approval_request","issue_approval_verify"].includes(String(input?.operation??""));
  if(issueAction){
    if(row.status==="rejected"||row.status==="issued"||row.final_policy_id)
      return respond({ok:false,error:"Only pending cases can be issued."},409);
    if(profile.role==="operations_head_life"){
      if(!(await canAccessOperationsHeadCase(profile.id,id)))return respond({ok:false,error:"Case outside your scope."},403);
    }else if(!(await hasEffectiveCapability(profile,"create_policies","edit"))){
      return respond({ok:false,error:"Policy creation permission is required."},403);
    }
    const policyNumber=typeof input?.policyNumber==="string"?input.policyNumber.trim().toUpperCase():"";
    const issuanceDate=typeof input?.issuanceDate==="string"?input.issuanceDate.trim():"";
    if(!policyNumber||policyNumber.length>120||!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(issuanceDate))
      return respond({ok:false,error:"Enter a valid policy number and issuance date."},400);
    const policyDate=policyDateDecision(issuanceDate);
    if(policyDate==="future"||policyDate==="invalid")return respond({ok:false,error:"Choose a valid issuance date in the current or earlier month."},400);
    if(input?.operation==="issue_approval_request"||input?.operation==="issue_approval_verify"){
      if(policyDate!=="otp_required")return respond({ok:false,error:"This date does not require OTP approval."},400);
      const data={issuanceDate,policyNumber,operation:"create" as const,intermediaryCode:row.intermediary_code??""};
      if(input.operation==="issue_approval_request"){
        const approverKey=typeof input.approverKey==="string"?input.approverKey:"";
        if(!POLICY_DATE_APPROVERS.some(item=>item.key===approverKey))return respond({ok:false,error:"Select a valid approver."},400);
        const approval=await requestPolicyDateApprovalForVerifiedActor({...data,approverKey},profile);
        return approval.ok?respond({ok:true,approvalId:approval.approvalId,expiresAt:approval.expiresAt}):respond({ok:false,error:approval.error},400);
      }
      const approval=await verifyPolicyDateApprovalForVerifiedActor(String(input?.approvalId??""),String(input?.otp??""),data,profile);
      return approval.ok?respond({ok:true,verified:true}):respond({ok:false,error:approval.error},400);
    }
    const form=new FormData();
    const fields=["policyNumber","issuanceDate","startDate","endDate","pptEndDate","nextInstallmentDate","finalPremium","sumInsured","dateApprovalId"] as const;
    for(const field of fields){
      const value=input?.[field];
      if(value!=null&&(typeof value!=="string"||value.length>200))return respond({ok:false,error:"Invalid issuance field."},400);
      form.set(field,typeof value==="string"?value.trim():"");
    }
    form.set("caseId",id);
    if(policyDate==="otp_required"&&!form.get("dateApprovalId"))return respond({ok:false,error:"An approved date OTP is required."},403);
    const result=await convertLifeHealthCaseForVerifiedActor(form,profile);
    return result.ok?respond({ok:true,policyId:result.policyId,policyCode:result.policyCode}):respond({ok:false,error:result.error},409);
  }
  // A remark is an audited append-only note, not an edit to the rejected case's policy fields.
  if(input?.operation==="append_remark"){
   if(row.final_policy_id)return respond({ok:false,error:"Issued cases cannot accept remarks here."},409);
   if(profile.role==="operations_head_life"){
    if(!(await canAccessOperationsHeadCase(profile.id,id)))return respond({ok:false,error:"Case is outside your scope."},403);
   }else{
    const permission=await getEffectivePermission(profile.id,profile.role as Parameters<typeof getEffectivePermission>[1],"view_policies");
    const creator=await hasEffectiveCapability(profile,"create_policies","edit");
    if(!["edit","approve"].includes(permission.access)&&!creator)return respond({ok:false,error:"Remarks permission is required."},403);
   }
   const remark=typeof input.remark==="string"?input.remark.trim():"";
   if(!remark||remark.length>2000)return respond({ok:false,error:"Enter a remark of up to 2000 characters."},400);
   const old=typeof row.remarks==="string"?row.remarks.trim():"";
   const stamp=new Intl.DateTimeFormat("en-IN",{timeZone:"Asia/Kolkata",day:"2-digit",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit",hour12:true}).format(new Date());
   const remarks=old?`${old}\n\n[${stamp}] ${remark}`:`[${stamp}] ${remark}`;
   if(remarks.length>50000)return respond({ok:false,error:"Remarks history is full."},409);
   let update=admin.from("life_health_cases").update({remarks,updated_at:new Date().toISOString()})
    .eq("id",id).is("final_policy_id",null).eq("updated_at",row.updated_at);
   update=row.remarks===null?update.is("remarks",null):update.eq("remarks",row.remarks);
   const {data:saved,error:saveError}=await update.select("id").maybeSingle();
   if(saveError||!saved)return respond({ok:false,error:"Remarks changed in another session. Reload and retry."},409);
   await recordDailyWorkflowActivity(admin,{actorId:profile.id,table:"life_health_cases",recordId:id,action:"life_health_case_remark_added"});
   const {error:auditError}=await admin.from("audit_logs").insert({
    actor_id:profile.id,table_name:"life_health_cases",record_id:id,
    action:"life_health_case_remark_added",new_data:{changed_fields:["Remarks changed (values hidden)"]},
   });
   if(auditError)console.error("Case remark audit failed",{id,code:auditError.code});
   return respond({ok:true,remarks});
  }
  if(row.status==="rejected")return respond({ok:false,error:"Rejected cases cannot be edited."},409);
  const issued=Boolean(row.final_policy_id);
  if(profile.role==="operations_head_life"){
   if(issued){
    if(!(await canAccessPolicy(profile.id,profile.role,row.final_policy_id!,"view_policies",true)))
     return respond({ok:false,error:"You cannot edit this issued policy."},403);
   } else if(!(await canAccessOperationsHeadCase(profile.id,id))){
    return respond({ok:false,error:"This case is outside your authorized scope."},403);
   }
  }else{
   const permission=await getEffectivePermission(profile.id,profile.role as Parameters<typeof getEffectivePermission>[1],"view_policies");
   const creator=await hasEffectiveCapability(profile,"create_policies","edit");
   if(issued ? !["edit","approve"].includes(permission.access) : !["edit","approve"].includes(permission.access)&&!creator)
    return respond({ok:false,error:"Editing permission is required."},403);
  }
  if(issued && !(await canAccessPolicy(profile.id,profile.role,row.final_policy_id!,"view_policies",true)))
   return respond({ok:false,error:"This issued policy is outside your authorized edit scope."},403);
  const clean=(key:string,max=180)=>typeof input?.[key]==="string"?(input[key] as string).trim().slice(0,max):"";
  if(issued){
   // Issued case is immutable; only the customer information is editable here.
   // Validate case-to-policy link and avoid touching policy issuance or commercials.
   const customerName=clean("customerName",160);
   const phone=clean("customerPhone",25).replace(/\D/g,"");
   const address=clean("customerAddress",1000);
   if(!customerName||!/^[6-9]\d{9}$/.test(phone))return respond({ok:false,error:"Enter a customer name and valid 10-digit mobile."},400);
   const {data:linked}=await admin.from("life_health_cases").select("customer_id")
    .eq("id",id).eq("final_policy_id",row.final_policy_id!).maybeSingle();
   if(!linked?.customer_id)return respond({ok:false,error:"Issued policy link changed. Reload the case."},409);
   const {error}=await admin.from("customers").update({
     contact_name:customerName,phone,address:address||null,address_street:address||null,updated_at:new Date().toISOString(),
   }).eq("id",linked.customer_id);
   if(error)return respond({ok:false,error:"Customer changes could not be saved."},500);
   await admin.from("audit_logs").insert({actor_id:profile.id,table_name:"life_health_cases",record_id:id,action:"life_health_issued_customer_edited",new_data:{fields:["customer_name","customer_phone","customer_address"],policy_id:row.final_policy_id}});
   return respond({ok:true,scope:"issued_customer"});
  }
  const requestedDate=typeof input?.sourcingDate==="string"?clean("sourcingDate",10):null;
  if(requestedDate){
    const date=new Date(requestedDate+"T00:00:00.000Z");
    if(!/^\d{4}-\d{2}-\d{2}$/.test(requestedDate)||Number.isNaN(date.getTime())||
      date.toISOString().slice(0,10)!==requestedDate)
      return respond({ok:false,error:"Enter a valid proposal date."},400);
  }
  const insurerId=typeof input?.insurerId==="string"?clean("insurerId",60):null;
  if(insurerId){
    if(!uuid.test(insurerId))return respond({ok:false,error:"Invalid insurance company."},400);
    const {data:insurer,error:insurerError}=await admin.from("insurance_companies").select("id").eq("id",insurerId).maybeSingle();
    if(insurerError||!insurer)return respond({ok:false,error:"Select a registered insurer."},400);
  }
  const hasCustomer=["customerName","customerPhone","customerAddress"].some(key=>input?.[key]!==undefined);
  let customerUpdate:{contact_name:string;phone:string;address:string|null;address_street:string|null;updated_at:string}|null=null;
  if(hasCustomer){
    const name=clean("customerName",160),phone=clean("customerPhone",25).replace(/\D/g,""),
      address=clean("customerAddress",1000);
    if(!name||!/^[6-9]\d{9}$/.test(phone))return respond({ok:false,error:"Enter a customer name and valid 10-digit mobile."},400);
    customerUpdate={contact_name:name,phone,address:address||null,address_street:address||null,updated_at:new Date().toISOString()};
  }
  const product=clean("productName",180),proposal=clean("proposalNumber",120).toUpperCase();
  const ppt=clean("premiumPayingTerm",80),pd=clean("policyDuration",80);
  const frequency=clean("paymentFrequency",50),mode=clean("paymentMode",50);
  const premium=Number(input?.premiumAmount);
  if(!product||!proposal||!["Monthly","Quarterly","Half Yearly","Annually","One Time"].includes(frequency)||
    !["Cash","Cheque","NEFT/RTGS","UPI","Credit/Debit Card","Net Banking"].includes(mode)||
    !Number.isFinite(premium)||premium<0||premium>100000000000)
    return respond({ok:false,error:"Complete the required proposal, payment and premium fields."},400);
  // Optimistic concurrency: reject stale native edits, rejected/issued transitions.
  const expected=clean("updatedAt",80);
  if(!expected||expected!==row.updated_at)return respond({ok:false,error:"The case changed. Reload before saving."},409);
  const {data:saved,error:saveError}=await admin.from("life_health_cases").update({
    product_name:product,proposal_number:proposal,premium_paying_term:ppt||null,
    policy_duration:pd||null,payment_frequency:frequency,payment_mode:mode,
    ...(requestedDate?{sourcing_date:requestedDate}:{}),
    ...(insurerId?{insurance_company_id:insurerId}:{}),
    premium_amount:premium,updated_at:new Date().toISOString(),
  }).eq("id",id).eq("updated_at",expected).is("final_policy_id",null).neq("status","rejected")
   .select("id").maybeSingle();
  if(saveError||!saved)return respond({ok:false,error:"Case changed or could not be saved. Reload and retry."},409);
  if(customerUpdate){
    const {error:customerError}=await admin.from("customers").update(customerUpdate).eq("id",row.customer_id);
    if(customerError){
      console.error("Pending Case customer update failed after case save",{caseId:id,code:customerError.code});
      return respond({ok:false,error:"Case details saved, but customer update failed. Reload before retrying."},503);
    }
  }
  await admin.from("audit_logs").insert({actor_id:profile.id,table_name:"life_health_cases",record_id:id,action:"life_health_case_edited",new_data:{fields:["proposal","product","premium",...(requestedDate?["sourcing_date"]:[]),...(insurerId?["insurance_company_id"]:[]),...(customerUpdate?["customer_identity"]:[])]}});
  await recordDailyWorkflowActivity(admin,{actorId:profile.id,table:"life_health_cases",recordId:id,action:"life_health_case_edited"});
  return respond({ok:true,scope:"pending_case"});
 }catch{
  return respond({ok:false,error:"Unable to save changes. Please retry."},500);
 }
}
