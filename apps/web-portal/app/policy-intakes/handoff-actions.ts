"use server";

import { claimPolicyIntakeForReview } from "@/app/policy-intakes/actions";
import type { PolicyIntakeOcrField } from "@/app/policy-intakes/ocr-actions";
import { buildPolicyOcrOnboardingUpdate } from "@/lib/policy-ocr-onboarding-apply";
import { loadVehicleManufacturers } from "@/lib/master-data-server";
import { requirePolicyIntakeReviewer } from "@/lib/policy-intake-server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

export type PolicyIntakeDraft = {
  issuanceDate:string; rmName:string; intermediaryType:string; leadSource:string; intermediaryCode:string; businessLine:string;
  registrationNo:string; insuredName:string; phoneNo:string; vehicleClass:string; make:string; model:string; fuelType:string; capacity:string; manufacturingYear:string; chassisNo:string; engineNo:string; rtoState:string; rtoName:string;
  policyProduct:string; idv:string; od:string; tp:string; cpaOpted:"Yes"|"No"; cpa:string; policyNo:string; insurerId:string; validFrom:string; validUpto:string;
  payoutBasis:string; projectedOdPercent:string; projectedTpPercent:string; insurerScheme:string; payinBillNo:string; payinBilledAmount:string; payinBillDate:string; payinStatus:string; retention:string; payoutOdPercent:string; payoutTpPercent:string; payoutStatus:string; payoutDate:string; payoutVoucherNo:string; remarks:string;
};

export async function preparePolicyIntakeHandoff(id:string):Promise<{ok:true;draft:PolicyIntakeDraft}|{ok:false;error:string}> {
  await requirePolicyIntakeReviewer();
  const claimed = await claimPolicyIntakeForReview(id);
  if (!claimed.ok) return claimed;
  const admin = createSupabaseAdminClient();
  const { data:intake } = await admin.from("policy_intake_requests")
    .select("lead_source_type,lead_source_name,lead_source_code,customer_mobile,matched_customer_id,ocr_fields,status")
    .eq("id",id)
    .maybeSingle<{lead_source_type:"posp"|"misp"|"partner";lead_source_name:string;lead_source_code:string|null;customer_mobile:string;matched_customer_id:string|null;ocr_fields:PolicyIntakeOcrField[];status:string}>();
  if (!intake || ["completed","rejected"].includes(intake.status)) return {ok:false,error:"This intake is no longer available for onboarding."};

  const [manufacturerOptions, insurerResult, customerResult] = await Promise.all([
    loadVehicleManufacturers(),
    admin.from("insurance_companies").select("id,name").eq("is_active",true).order("name"),
    intake.matched_customer_id ? admin.from("customers").select("contact_name,company_name").eq("id",intake.matched_customer_id).maybeSingle<{contact_name:string;company_name:string|null}>() : Promise.resolve({data:null}),
  ]);
  const insurers=(insurerResult.data??[]).map(row=>({value:String(row.id),label:String(row.name)}));
  const mapped=buildPolicyOcrOnboardingUpdate({
    mode:"create",
    registrationMode:"registered",
    current:{registrationNo:"",vehicleClass:"",make:"",model:"",fuelType:"",manufacturingYear:"",capacity:"",chassisNo:"",engineNo:"",rtoState:"",rtoName:"",policyProduct:"",idv:"",od:"",tp:"",cpa:"",policyNo:"",insurerId:"",validFrom:"",validUpto:""},
    fields:intake.ocr_fields??[], manufacturers:manufacturerOptions, insurers, rcVerified:false,
  });
  const customerName=customerResult.data?.company_name?.trim()||customerResult.data?.contact_name?.trim()||"";
  const intermediaryType=intake.lead_source_type==="posp"?"POSP":intake.lead_source_type==="misp"?"MISP":"SIBL / Partner";
  const draft:PolicyIntakeDraft={
    issuanceDate:new Date().toISOString().slice(0,10),rmName:"",intermediaryType,leadSource:intake.lead_source_name,intermediaryCode:intake.lead_source_code??"",businessLine:"Motor",
    registrationNo:mapped.next.registrationNo,insuredName:customerName,phoneNo:intake.customer_mobile,vehicleClass:mapped.next.vehicleClass,make:mapped.next.make,model:mapped.next.model,fuelType:mapped.next.fuelType,capacity:mapped.next.capacity,manufacturingYear:mapped.next.manufacturingYear,chassisNo:mapped.next.chassisNo,engineNo:mapped.next.engineNo,rtoState:mapped.next.rtoState,rtoName:mapped.next.rtoName,
    policyProduct:mapped.next.policyProduct,idv:mapped.next.idv,od:mapped.next.od,tp:mapped.next.tp,cpaOpted:"No",cpa:mapped.next.cpa,policyNo:mapped.next.policyNo,insurerId:mapped.next.insurerId,validFrom:mapped.next.validFrom,validUpto:mapped.next.validUpto,
    payoutBasis:"NET",projectedOdPercent:"",projectedTpPercent:"",insurerScheme:"",payinBillNo:"",payinBilledAmount:"",payinBillDate:"",payinStatus:"Unbilled",retention:"",payoutOdPercent:"",payoutTpPercent:"",payoutStatus:"Pending",payoutDate:"",payoutVoucherNo:"",remarks:`Policy Intake ${id}`,
  };
  return {ok:true,draft};
}
