"use server";

import { canAccessPolicyCommercials } from "@/lib/policy-commercial-access";
import { requireCapability } from "@/lib/master-data-server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

async function requireAccountsUser() {
  const profile = await requireCapability("view_accounts");
  if (!canAccessPolicyCommercials(profile)) throw new Error("Commercial details restricted");
  return profile;
}
const money=(v:unknown)=>Math.round(Number(v??0)*100)/100;
function one<T>(v:T|T[]|null|undefined):T|null{return Array.isArray(v)?(v[0]??null):(v??null)}

export async function listPartnerPayablesWorkbench() {
  await requireAccountsUser();
  const db=createSupabaseAdminClient();
  const [{data:sources,error:sourceError},{data:payables,error:payableError},{data:payments,error:paymentError}]=await Promise.all([
    db.from("policy_intermediary_payouts").select("id,policy_id,intermediary_type,intermediary_code,gross_payout,status,commercial_status,policies(policy_no,customers(contact_name),vehicles(vehicle_no))").in("commercial_status",["entered","reviewed"]).eq("status","Pending").gt("gross_payout",0).order("updated_at",{ascending:false}).limit(1000),
    db.from("partner_payables").select("id,policy_payout_id,policy_id,intermediary_type,intermediary_code,agreed_amount,outstanding_amount,status,eligibility_reason,hold_reason,created_at,approved_at,policies(policy_no,customers(contact_name),vehicles(vehicle_no))").order("created_at",{ascending:false}).limit(1000),
    db.from("partner_payments").select("id,intermediary_type,intermediary_code,payment_date,payment_reference,payment_amount,created_at,partner_payment_allocations(payable_id,allocated_amount)").order("payment_date",{ascending:false}).limit(500)
  ]);
  if(sourceError)throw new Error(sourceError.message); if(payableError)throw new Error(payableError.message); if(paymentError)throw new Error(paymentError.message);
  const existing=new Set((payables??[]).map(p=>p.policy_payout_id));
  return {
    eligibleCommercials:(sources??[]).filter(s=>!existing.has(s.id)).map(s=>{const policy=one(s.policies);return{...s,policyNo:policy?.policy_no??"",customerName:one(policy?.customers)?.contact_name??"",vehicleNo:one(policy?.vehicles)?.vehicle_no??"",agreedAmount:money(s.gross_payout)}}),
    payables:(payables??[]).map(p=>{const policy=one(p.policies);return{...p,policyNo:policy?.policy_no??"",customerName:one(policy?.customers)?.contact_name??"",vehicleNo:one(policy?.vehicles)?.vehicle_no??""}}),
    payments:payments??[]
  };
}

export async function markPartnerPayableEligible(input:{policyPayoutId:string;reason:string}){
  const profile=await requireAccountsUser(); const db=createSupabaseAdminClient();
  if(!input.policyPayoutId||!input.reason.trim())throw new Error("Eligibility reason is required.");
  const {data,error}=await db.rpc("create_partner_payable",{p_policy_payout_id:input.policyPayoutId,p_reason:input.reason.trim(),p_actor:profile.id});
  if(error)throw new Error(error.message); return{payableId:String(data)};
}
export async function approvePartnerPayable(payableId:string){const profile=await requireAccountsUser();const db=createSupabaseAdminClient();const{error}=await db.rpc("approve_partner_payable",{p_payable_id:payableId,p_actor:profile.id});if(error)throw new Error(error.message);return{success:true};}
export async function setPartnerPayableHold(input:{payableId:string;hold:boolean;reason?:string}){const profile=await requireAccountsUser();const db=createSupabaseAdminClient();const{error}=await db.rpc("set_partner_payable_hold",{p_payable_id:input.payableId,p_hold:input.hold,p_reason:input.reason?.trim()||null,p_actor:profile.id});if(error)throw new Error(error.message);return{success:true};}
export async function recordPartnerPayment(input:{intermediaryCode:string;intermediaryType?:string;paymentDate:string;paymentReference:string;paymentAmount:number;notes?:string;allocations:Array<{payableId:string;amount:number}>}){
  const profile=await requireAccountsUser();const db=createSupabaseAdminClient();const amount=money(input.paymentAmount);const allocations=input.allocations.map(a=>({payableId:a.payableId,amount:money(a.amount)})).filter(a=>a.payableId&&a.amount>0);
  if(!input.intermediaryCode.trim()||!/^\d{4}-\d{2}-\d{2}$/.test(input.paymentDate)||!input.paymentReference.trim()||amount<=0)throw new Error("Partner, payment date, reference and positive amount are required.");
  if(money(allocations.reduce((s,a)=>s+a.amount,0))!==amount)throw new Error("Allocations must equal payment amount.");
  const{data,error}=await db.rpc("post_partner_payment",{p_intermediary_code:input.intermediaryCode.trim(),p_intermediary_type:input.intermediaryType?.trim()||null,p_payment_date:input.paymentDate,p_payment_reference:input.paymentReference.trim(),p_payment_amount:amount,p_notes:input.notes?.trim()||null,p_actor:profile.id,p_allocations:allocations});
  if(error)throw new Error(error.message);return{paymentId:String(data)};
}
export async function closePartnerPayable(payableId:string){const profile=await requireAccountsUser();const db=createSupabaseAdminClient();const{error}=await db.rpc("close_partner_payable",{p_payable_id:payableId,p_actor:profile.id});if(error)throw new Error(error.message);return{success:true};}
