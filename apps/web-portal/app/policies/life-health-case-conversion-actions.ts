"use server";

import { revalidatePath } from "next/cache";
import { requirePolicyCreator } from "@/lib/policy-access-server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

const clean=(value:unknown)=>String(value??"").trim();
const normalizePolicyNumber=(value:string)=>value.trim().toUpperCase().replace(/\s+/g,"");
const validDate=(value:string)=>/^\d{4}-\d{2}-\d{2}$/.test(value);
const numberOrNull=(value:unknown)=>{const normalized=clean(value).replace(/,/g,"");if(!normalized)return null;const parsed=Number(normalized);return Number.isFinite(parsed)?parsed:null};
const policyCode=()=>`POL-${new Date().toISOString().replace(/[-:TZ.]/g,"").slice(0,17)}`;

type CaseRow={id:string;case_number:string;business_line:"Life"|"Health";status:string;sourcing_date:string;customer_id:string;insurance_company_id:string;product_name:string;proposal_number:string;premium_paying_term:string|null;policy_duration:string|null;payment_frequency:string;payment_mode:string;premium_amount:number;intermediary_type:string|null;intermediary_code:string|null;lead_source:string|null;rm_employee_id:string|null;rm_name:string|null;rm_code:string|null;remarks:string|null;details:Record<string,unknown>|null;final_policy_id:string|null};
type CaseDocumentRow={id:string;document_type:string;file_name:string;storage_bucket:string;storage_path:string;mime_type:string|null;file_size:number|null;uploaded_by:string|null};
export type LifeHealthConversionResult={ok:true;policyId:string;policyCode:string}|{ok:false;error:string};

export async function convertLifeHealthCaseToPolicyOptionalCopy(formData:FormData):Promise<LifeHealthConversionResult>{
  const profile=await requirePolicyCreator();
  const admin=createSupabaseAdminClient();
  const caseId=clean(formData.get("caseId"));
  const enteredPolicyNumber=clean(formData.get("policyNumber")).toUpperCase();
  const normalizedPolicy=normalizePolicyNumber(enteredPolicyNumber);
  const issuanceDate=clean(formData.get("issuanceDate"));
  const startDate=clean(formData.get("startDate"));
  const endDate=clean(formData.get("endDate"));
  const finalPremium=numberOrNull(formData.get("finalPremium"));
  const sumInsured=numberOrNull(formData.get("sumInsured"));
  if(!caseId)return{ok:false,error:"The case reference is missing."};
  if(!enteredPolicyNumber)return{ok:false,error:"Enter the issued policy number."};
  if(!validDate(issuanceDate)||!validDate(startDate)||!validDate(endDate))return{ok:false,error:"Enter valid issuance and policy validity dates."};
  if(endDate<startDate)return{ok:false,error:"Policy end date cannot be before the start date."};
  if(finalPremium===null||finalPremium<0)return{ok:false,error:"Enter a valid final premium."};

  const {data:caseRow,error:caseError}=await admin.from("life_health_cases").select("id,case_number,business_line,status,sourcing_date,customer_id,insurance_company_id,product_name,proposal_number,premium_paying_term,policy_duration,payment_frequency,payment_mode,premium_amount,intermediary_type,intermediary_code,lead_source,rm_employee_id,rm_name,rm_code,remarks,details,final_policy_id").eq("id",caseId).maybeSingle<CaseRow>();
  if(caseError||!caseRow)return{ok:false,error:"This Life/Health case is no longer available."};
  if(caseRow.final_policy_id||caseRow.status==="issued")return{ok:false,error:"This case has already been converted to a policy."};
  const duplicate=await admin.from("policies").select("id").eq("policy_no_normalized",normalizedPolicy).limit(1).maybeSingle<{id:string}>();
  if(duplicate.error)return{ok:false,error:"Policy validation is temporarily unavailable. Please try again."};
  if(duplicate.data)return{ok:false,error:"This policy number already exists in the Policy Register."};

  const generatedPolicyCode=policyCode();
  let createdPolicyId:string|null=null;
  try{
    const {data:policy,error:policyError}=await admin.from("policies").insert({customer_id:caseRow.customer_id,vehicle_id:null,insurance_company_id:caseRow.insurance_company_id,policy_no:enteredPolicyNumber,policy_no_normalized:normalizedPolicy,policy_code:generatedPolicyCode,policy_type:caseRow.business_line,policy_product:caseRow.product_name,business_line:caseRow.business_line,business_type:"New",issuance_date:issuanceDate,start_date:startDate,end_date:endDate,policy_term:caseRow.policy_duration||null,premium_amount:finalPremium,insured_declared_value:sumInsured,status:"active",intermediary_type:caseRow.intermediary_type,intermediary_code:caseRow.intermediary_code,lead_source:caseRow.lead_source,rm_name:caseRow.rm_name,rm_employee_id:caseRow.rm_employee_id,remarks:caseRow.remarks,calculation_version:"life_health_case_v1",created_by:profile.id}).select("id").single<{id:string}>();
    if(policyError||!policy)throw new Error(policyError?.message||"policy_insert_failed");
    createdPolicyId=policy.id;
    const {error:detailsError}=await admin.from("life_health_policy_details").insert({policy_id:policy.id,source_case_id:caseId,proposal_number:caseRow.proposal_number,premium_paying_term:caseRow.premium_paying_term,policy_duration:caseRow.policy_duration,payment_frequency:caseRow.payment_frequency,payment_mode:caseRow.payment_mode,additional_details:caseRow.details??{}});if(detailsError)throw new Error(detailsError.message);
    const {error:premiumError}=await admin.from("policy_premium_details").insert({policy_id:policy.id,od_premium:0,tp_premium:0,cpa_opted:false,cpa_amount:0,net_premium:finalPremium,gst_amount:0,gross_premium:finalPremium,gst_rule:"Life/Health premium captured as payable premium",calculation_version:"life_health_case_v1",calculation_overridden:false});if(premiumError)throw new Error(premiumError.message);
    const {data:documents,error:documentLoadError}=await admin.from("life_health_case_documents").select("id,document_type,file_name,storage_bucket,storage_path,mime_type,file_size,uploaded_by").eq("case_id",caseId).returns<CaseDocumentRow[]>();if(documentLoadError)throw new Error(documentLoadError.message);
    if(documents?.length){const {error:documentInsertError}=await admin.from("policy_documents").insert(documents.map(document=>({policy_id:policy.id,document_type:document.document_type,file_name:document.file_name,storage_bucket:document.storage_bucket,storage_path:document.storage_path,mime_type:document.mime_type,file_size:document.file_size,uploaded_by:document.uploaded_by||profile.id})));if(documentInsertError)throw new Error(documentInsertError.message)}
    const {error:caseUpdateError}=await admin.from("life_health_cases").update({status:"issued",final_policy_id:policy.id,converted_at:new Date().toISOString(),converted_by:profile.id,premium_amount:finalPremium,updated_at:new Date().toISOString()}).eq("id",caseId).is("final_policy_id",null);if(caseUpdateError)throw new Error(caseUpdateError.message);
    revalidatePath("/policies");revalidatePath("/policies/life-health-cases");revalidatePath(`/policies/life-health-cases/${caseId}`);revalidatePath(`/policies/${policy.id}`);
    return{ok:true,policyId:policy.id,policyCode:generatedPolicyCode};
  }catch{if(createdPolicyId)await admin.from("policies").delete().eq("id",createdPolicyId);return{ok:false,error:"We couldn't convert this case into a policy. The case and uploaded documents remain unchanged; please try again."}}
}
