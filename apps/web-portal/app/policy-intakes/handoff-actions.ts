"use server";

import type { PolicyIntakeOcrField } from "@/app/policy-intakes/ocr-actions";
import { buildPolicyOcrOnboardingUpdate } from "@/lib/policy-ocr-onboarding-apply";
import { requirePolicyIntakeFinalizer, requirePolicyIntakeReviewer } from "@/lib/policy-intake-server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

export type PolicyIntakeDraft = {
  registrationMode:"registered"|"unregistered";
  issuanceDate:string; rmName:string; intermediaryType:string; leadSource:string; intermediaryCode:string; businessLine:string;
  registrationNo:string; insuredName:string; phoneNo:string; vehicleClass:string; make:string; model:string; fuelType:string; capacity:string; manufacturingYear:string; chassisNo:string; engineNo:string; rtoState:string; rtoName:string;
  policyProduct:string; idv:string; od:string; tp:string; cpaOpted:"Yes"|"No"; cpa:string; policyNo:string; insurerId:string; validFrom:string; validUpto:string;
  payoutBasis:string; projectedOdPercent:string; projectedTpPercent:string; insurerScheme:string; payinBillNo:string; payinBilledAmount:string; payinBillDate:string; payinStatus:string; retention:string; payoutOdPercent:string; payoutTpPercent:string; payoutStatus:string; payoutDate:string; payoutVoucherNo:string; remarks:string;
};

export type PolicyIntakeHandoffResult =
  | { ok:true; draft:PolicyIntakeDraft; draftRevision:number; matchedCustomerId:string|null }
  | { ok:false; error:string; conflict?:false }
  | { ok:false; error:string; conflict:true; reviewerName:string };

export type PolicyIntakeDraftSaveResult =
  | { ok:true; revision:number }
  | { ok:false; error:string; conflict?:boolean };

type ManufacturerId={id:string};
type BrandOption={manufacturer_id:string;brand_name:string};
type InsurerOption={id:string;name:string};
type CustomerOption={contact_name:string;company_name:string|null};
type IntakeForHandoff={
  lead_source_type:"posp"|"misp"|"partner";
  lead_source_name:string;
  lead_source_code:string|null;
  customer_mobile:string;
  matched_customer_id:string|null;
  ocr_fields:PolicyIntakeOcrField[];
  status:string;
  assigned_to_profile_id:string|null;
};

export async function preparePolicyIntakeHandoff(id:string,takeOver=false):Promise<PolicyIntakeHandoffResult> {
  await requirePolicyIntakeFinalizer();
  const reviewer=await requirePolicyIntakeReviewer();
  const admin=createSupabaseAdminClient();
  const {data:intake}=await admin.from("policy_intake_requests")
    .select("lead_source_type,lead_source_name,lead_source_code,customer_mobile,matched_customer_id,ocr_fields,status,assigned_to_profile_id")
    .eq("id",id)
    .maybeSingle<IntakeForHandoff>();
  if(!intake||["completed","rejected"].includes(intake.status))return{ok:false,error:"This intake is no longer available for onboarding."};

  const assignedToAnother=Boolean(intake.assigned_to_profile_id&&intake.assigned_to_profile_id!==reviewer.id);
  if(assignedToAnother&&!takeOver){
    const{data:assignedProfile}=await admin.from("profiles").select("full_name").eq("id",intake.assigned_to_profile_id as string).maybeSingle<{full_name:string}>();
    const reviewerName=assignedProfile?.full_name?.trim()||"another Operations user";
    return{ok:false,conflict:true,reviewerName,error:`This intake is currently assigned to ${reviewerName}.`};
  }

  let assignmentQuery=admin.from("policy_intake_requests")
    .update({status:"in_review",assigned_to_profile_id:reviewer.id,attention_reason:null})
    .eq("id",id)
    .in("status",["ready_for_review","in_review","processing"]);
  if(assignedToAnother){
    assignmentQuery=assignmentQuery.eq("assigned_to_profile_id",intake.assigned_to_profile_id as string);
  }else{
    assignmentQuery=assignmentQuery.or(`assigned_to_profile_id.is.null,assigned_to_profile_id.eq.${reviewer.id}`);
  }
  const{data:claimed,error:claimError}=await assignmentQuery.select("id").maybeSingle<{id:string}>();
  if(claimError||!claimed){
    return{ok:false,error:"The reviewer assignment changed while you were opening this intake. Refresh and try again."};
  }

  const {data:existingDraft}=await admin.from("policy_intake_onboarding_drafts").select("draft_payload,revision").eq("intake_id",id).maybeSingle<{draft_payload:PolicyIntakeDraft;revision:number}>();
  if(existingDraft?.draft_payload)return{ok:true,draft:existingDraft.draft_payload,draftRevision:existingDraft.revision,matchedCustomerId:intake.matched_customer_id};

  const [manufacturerResult,brandResult,insurerResult,customerResult]=await Promise.all([
    admin.from("vehicle_manufacturers").select("id").eq("is_active",true).returns<ManufacturerId[]>(),
    admin.from("vehicle_manufacturer_brands").select("manufacturer_id,brand_name").eq("is_active",true).order("brand_name").returns<BrandOption[]>(),
    admin.from("insurance_companies").select("id,name").eq("is_active",true).order("name").returns<InsurerOption[]>(),
    intake.matched_customer_id
      ?admin.from("customers").select("contact_name,company_name").eq("id",intake.matched_customer_id).maybeSingle<CustomerOption>()
      :Promise.resolve({data:null,error:null}),
  ]);
  if(manufacturerResult.error||brandResult.error||insurerResult.error)return{ok:false,error:"Policy onboarding master data is temporarily unavailable."};

  const activeManufacturerIds=new Set((manufacturerResult.data??[]).map(row=>row.id));
  const manufacturerOptions=Array.from(new Set((brandResult.data??[]).filter(row=>activeManufacturerIds.has(row.manufacturer_id)).map(row=>row.brand_name))).sort((a,b)=>a.localeCompare(b));
  const insurers=(insurerResult.data??[]).map((row:InsurerOption)=>({value:row.id,label:row.name}));
  const mapped=buildPolicyOcrOnboardingUpdate({
    mode:"create",
    registrationMode:"registered",
    current:{registrationNo:"",vehicleClass:"",make:"",model:"",fuelType:"",manufacturingYear:"",capacity:"",chassisNo:"",engineNo:"",rtoState:"",rtoName:"",policyProduct:"",idv:"",od:"",tp:"",cpa:"",policyNo:"",insurerId:"",validFrom:"",validUpto:""},
    fields:intake.ocr_fields??[],manufacturers:manufacturerOptions,insurers,rcVerified:false,
  });
  const customerName=customerResult.data?.company_name?.trim()||customerResult.data?.contact_name?.trim()||"";
  const intermediaryType=intake.lead_source_type==="posp"?"POSP":intake.lead_source_type==="misp"?"MISP":"SIBL / Partner";
  const draft:PolicyIntakeDraft={
    registrationMode:mapped.registrationMode,
    issuanceDate:new Date().toISOString().slice(0,10),rmName:"",intermediaryType,leadSource:intake.lead_source_name,intermediaryCode:intake.lead_source_code??"",businessLine:"Motor",
    registrationNo:mapped.next.registrationNo,insuredName:customerName,phoneNo:intake.customer_mobile,vehicleClass:mapped.next.vehicleClass,make:mapped.next.make,model:mapped.next.model,fuelType:mapped.next.fuelType,capacity:mapped.next.capacity,manufacturingYear:mapped.next.manufacturingYear,chassisNo:mapped.next.chassisNo,engineNo:mapped.next.engineNo,rtoState:mapped.next.rtoState,rtoName:mapped.next.rtoName,
    policyProduct:mapped.next.policyProduct,idv:mapped.next.idv,od:mapped.next.od,tp:mapped.next.tp,cpaOpted:"No",cpa:mapped.next.cpa,policyNo:mapped.next.policyNo,insurerId:mapped.next.insurerId,validFrom:mapped.next.validFrom,validUpto:mapped.next.validUpto,
    payoutBasis:"NET",projectedOdPercent:"",projectedTpPercent:"",insurerScheme:"",payinBillNo:"",payinBilledAmount:"",payinBillDate:"",payinStatus:"Unbilled",retention:"",payoutOdPercent:"",payoutTpPercent:"",payoutStatus:"Pending",payoutDate:"",payoutVoucherNo:"",remarks:`Policy Intake ${id}`,
  };
  const {data:storedDraft,error:draftError}=await admin.from("policy_intake_onboarding_drafts").insert({intake_id:id,draft_payload:draft,revision:1,updated_by_profile_id:reviewer.id}).select("revision").single<{revision:number}>();
  if(draftError||!storedDraft)return{ok:false,error:"Policy Onboarding draft could not be prepared. Refresh and try again."};
  return{ok:true,draft,draftRevision:storedDraft.revision,matchedCustomerId:intake.matched_customer_id};
}

export async function loadPolicyIntakeOnboardingDraft(id:string):Promise<PolicyIntakeHandoffResult>{
  await requirePolicyIntakeFinalizer(); const reviewer=await requirePolicyIntakeReviewer(); const admin=createSupabaseAdminClient();
  const {data:intake}=await admin.from("policy_intake_requests").select("status,assigned_to_profile_id,matched_customer_id").eq("id",id).maybeSingle<{status:string;assigned_to_profile_id:string|null;matched_customer_id:string|null}>();
  if(!intake||intake.status!=="in_review"||intake.assigned_to_profile_id!==reviewer.id)return{ok:false,error:"This intake is not assigned to you for Policy Onboarding."};
  const {data,error}=await admin.from("policy_intake_onboarding_drafts").select("draft_payload,revision").eq("intake_id",id).maybeSingle<{draft_payload:PolicyIntakeDraft;revision:number}>();
  if(error||!data?.draft_payload)return{ok:false,error:"The saved Policy Onboarding draft is unavailable. Return to the intake and start review again."};
  return{ok:true,draft:data.draft_payload,draftRevision:data.revision,matchedCustomerId:intake.matched_customer_id};
}

export async function savePolicyIntakeOnboardingDraft(id:string,expectedRevision:number,draft:PolicyIntakeDraft):Promise<PolicyIntakeDraftSaveResult>{
  await requirePolicyIntakeFinalizer(); const reviewer=await requirePolicyIntakeReviewer(); const admin=createSupabaseAdminClient();
  const {data:intake}=await admin.from("policy_intake_requests").select("status,assigned_to_profile_id").eq("id",id).maybeSingle<{status:string;assigned_to_profile_id:string|null}>();
  if(!intake||intake.status!=="in_review"||intake.assigned_to_profile_id!==reviewer.id)return{ok:false,error:"This intake is no longer assigned to you.",conflict:true};
  const {data,error}=await admin.from("policy_intake_onboarding_drafts")
    .update({draft_payload:draft,revision:expectedRevision+1,updated_by_profile_id:reviewer.id,updated_at:new Date().toISOString()})
    .eq("intake_id",id).eq("revision",expectedRevision).select("revision").maybeSingle<{revision:number}>();
  if(error)return{ok:false,error:"The Policy Onboarding draft could not be saved."};
  if(!data)return{ok:false,error:"This draft was updated elsewhere. Reload the latest version before continuing.",conflict:true};
  return{ok:true,revision:data.revision};
}
