"use server";

import { redirect } from "next/navigation";
import { INTERNAL_JOURNEY_STAGES } from "@insureit/claim-journey";
import { createServerSupabaseClient } from "@/lib/auth-server";
import { getCustomerWebSession } from "@/lib/customer-web";
import { resolveCustomerWebScope } from "@/lib/customer-web-data";
import { loadCustomerClaimDetail, isExternalCustomerClaim } from "@/lib/customer-web-phase2-data";
import { CUSTOMER_EXTERNAL_STAGE_FIELDS } from "@/lib/customer-claim-stage-fields";

const stageDates:Record<string,string>={
  spot_status:"spot_survey_done_date",claim_intimation:"claim_intimation_date",
  work_approval:"approval_received_date",repair_ri:"ri_done_date",
  billing:"bill_date",delivery_order:"do_date",vehicle_delivery:"vehicle_received_date",
  payment_encashment:"payment_received_date",
};

export async function saveCustomerExternalStage(form:FormData) {
  const accountId=String(form.get("account")||"");
  const claimId=String(form.get("claim")||"");
  const key=String(form.get("stage")||"");
  const config=CUSTOMER_EXTERNAL_STAGE_FIELDS[key];
  if(!config)throw new Error("Invalid claim stage");
  const {account}=await resolveCustomerWebScope(accountId);
  const {claim,milestones}=await loadCustomerClaimDetail(account.id,claimId);
  if(!isExternalCustomerClaim(claim)||claim.claim_service_mode!=="self_managed"||claim.assistance_status==="accepted")
    throw new Error("Claim stage editing is not available");
  const index=INTERNAL_JOURNEY_STAGES.findIndex(stage=>stage.key===key);
  if(index<1)throw new Error("Invalid stage");
  const previous=milestones.find(m=>m.milestone_key===INTERNAL_JOURNEY_STAGES[index-1].key);
  if(!previous||!["completed","not_applicable"].includes(previous.milestone_status))
    throw new Error("Complete the preceding claim stage first");
  const values:Record<string,string|number|boolean>={};
  for(const field of config){
    const value=String(form.get(field.key)||"").trim();
    if(!value){if(field.optional)continue;throw new Error("Complete all mandatory stage fields");}
    if(field.type==="number"){
      const amount=Number(value);
      if(!Number.isFinite(amount)||amount<0)throw new Error("Invalid monetary amount");
      values[field.key]=amount;
    }else if(field.type==="boolean"){
      if(!["true","false"].includes(value))throw new Error("Invalid choice");
      values[field.key]=value==="true";
    }else if(field.type==="yesno"){
      if(!["yes","no"].includes(value))throw new Error("Invalid choice");
      values[field.key]=value;
    }else{
      if(value.length>500)throw new Error("Value too long");
      if(field.type==="date"&&(!/^\d{4}-\d{2}-\d{2}$/.test(value)||value>new Date().toISOString().slice(0,10)))throw new Error("Invalid stage date");
      values[field.key]=value;
    }
  }
  if(key==="vehicle_delivery"&&values.vehicle_received==="yes"&&!values.vehicle_received_date)
    throw new Error("Enter the vehicle received date");
  if(key==="repair_ri"&&values.ri_requested_date&&String(values.ri_requested_date)<String(values.repair_complete_date))
    throw new Error("RI requested date must not precede repair complete date");
  if(key==="repair_ri"&&values.ri_done_date&&String(values.ri_done_date)<String(values.repair_complete_date))
    throw new Error("RI done date must not precede repair complete date");
  if(key==="payment_encashment"&&values.payment_received_date&&values.documents_submit_date&&String(values.payment_received_date)<String(values.documents_submit_date))
    throw new Error("Payment date must not precede document submission");
  const dateKey=stageDates[key];
  const date=dateKey?values[dateKey]:null;
  if(typeof date==="string"&&previous.details){
    const prevKey=stageDates[previous.milestone_key]||"spot_intimation_at";
    const previousDate=previous.details[prevKey];
    if(typeof previousDate==="string"&&date<previousDate.slice(0,10))throw new Error("Stage date precedes the previous stage");
  }
  const db=await createServerSupabaseClient();
  const session=await getCustomerWebSession();
  const current=milestones.find(m=>m.milestone_key===key);
  if(key==="vehicle_delivery"||key==="spot_status"){
    const done=key!=="vehicle_delivery"||(values.vehicle_received==="yes"&&Boolean(values.vehicle_received_date));
    const {error}=await db.from("claim_milestones").upsert({
      claim_id:claim.id,milestone_key:key,milestone_status:done?"completed":"in_progress",
      details:values,completed_at:done?(current?.completed_at||new Date().toISOString()):null,
      recorded_by:session.user.id,recorded_by_actor:"customer",
    },{onConflict:"claim_id,milestone_key"});
    if(error)throw new Error("Could not save claim stage");
  }else{
    if(key==="repair_ri")values.ri_required="yes";
    const {error}=await (db.rpc as unknown as (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>)("save_self_managed_milestone",{
      p_claim_id:claim.id,p_milestone_key:key,p_details:values,
      p_completed_at:current?.completed_at||new Date().toISOString(),
    });
    if(error)throw new Error("Could not save claim stage");
  }
  redirect("/customer/claims/"+encodeURIComponent(claim.id)+"?account="+encodeURIComponent(account.id));
}
