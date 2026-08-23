"use server";

import { canAccessPolicyCommercials } from "@/lib/policy-commercial-access";
import { requireCapability } from "@/lib/master-data-server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

async function requireAccountsUser(){const profile=await requireCapability("view_accounts");if(!canAccessPolicyCommercials(profile))throw new Error("Commercial details restricted");return profile;}
const count=(v:{count:number|null} | null)=>v?.count??0;

async function blockers(start:string,end:string){
 const db=createSupabaseAdminClient();
 const [unmatched,pendingRecon,uninvoiced,outstanding,tdsMismatch,partnerOpen,commercialPayin,commercialPartner]=await Promise.all([
  db.from("reconciliation_lines").select("id,reconciliation_cycles!inner(accounting_period_start,accounting_period_end,period_start,period_end)",{count:"exact",head:true}).eq("match_status","Unmatched").or(`accounting_period_start.lte.${end},period_start.lte.${end}`,{referencedTable:"reconciliation_cycles"}),
  db.from("reconciliation_lines").select("id,reconciliation_cycles!inner(accounting_period_start,accounting_period_end,period_start,period_end)",{count:"exact",head:true}).in("review_status",["Pending","Follow-up"]).or(`accounting_period_start.lte.${end},period_start.lte.${end}`,{referencedTable:"reconciliation_cycles"}),
  db.from("reconciliation_lines").select("id,reconciliation_cycles!inner(accounting_period_start,accounting_period_end,period_start,period_end),accounts_invoice_lines(id)",{count:"exact",head:true}).eq("match_status","Matched").in("review_status",["Accepted","Resolved"]).is("accounts_invoice_lines.id",null).or(`accounting_period_start.lte.${end},period_start.lte.${end}`,{referencedTable:"reconciliation_cycles"}),
  db.from("accounts_invoices").select("id",{count:"exact",head:true}).in("status",["Raised","Partially Received"]).gt("outstanding_amount",0).lte("invoice_date",end).gte("invoice_date",start),
  db.from("accounts_tds_entries").select("id",{count:"exact",head:true}).in("matched_status",["Pending","Mismatch"]).lte("tds_date",end).gte("tds_date",start),
  db.from("partner_payables").select("id",{count:"exact",head:true}).in("status",["Eligible","Payable Approved","Payment Initiated","Held"]).lte("created_at",`${end}T23:59:59Z`).gte("created_at",`${start}T00:00:00Z`),
  db.from("policy_payin_details").select("id,policies!inner(business_date)",{count:"exact",head:true}).in("commercial_status",["needs_review","not_entered"]).lte("policies.business_date",end).gte("policies.business_date",start),
  db.from("policy_intermediary_payouts").select("id,policies!inner(business_date)",{count:"exact",head:true}).in("commercial_status",["needs_review","not_entered"]).lte("policies.business_date",end).gte("policies.business_date",start),
 ]);
 const errors=[unmatched.error,pendingRecon.error,uninvoiced.error,outstanding.error,tdsMismatch.error,partnerOpen.error,commercialPayin.error,commercialPartner.error].filter(Boolean);
 if(errors.length)throw new Error(errors[0]!.message);
 return {unmatched_reconciliation:count(unmatched),pending_reconciliation_review:count(pendingRecon),reconciled_uninvoiced:count(uninvoiced),outstanding_invoices:count(outstanding),tds_pending_or_mismatch:count(tdsMismatch),partner_payables_open:count(partnerOpen),insurer_commercials_incomplete:count(commercialPayin),partner_commercials_incomplete:count(commercialPartner),unallocated_receipts:0};
}

export async function listPeriodCloseWorkbench(){await requireAccountsUser();const db=createSupabaseAdminClient();const{data,error}=await db.from("accounting_periods").select("id,period_start,period_end,status,readiness_snapshot,close_reason,reopen_reason,created_at,closed_at,reopened_at,accounting_period_events(event_type,from_status,to_status,reason,created_at)").order("period_start",{ascending:false}).limit(60);if(error)throw new Error(error.message);return{periods:data??[]};}
export async function previewPeriodBlockers(start:string,end:string){await requireAccountsUser();if(!/^\d{4}-\d{2}-\d{2}$/.test(start)||!/^\d{4}-\d{2}-\d{2}$/.test(end)||end<start)throw new Error("Valid period dates are required.");return blockers(start,end);}
export async function createAccountingPeriod(input:{start:string;end:string}){const profile=await requireAccountsUser();const db=createSupabaseAdminClient();const{data,error}=await db.rpc("create_accounting_period",{p_start:input.start,p_end:input.end,p_actor:profile.id});if(error)throw new Error(error.message);return{periodId:String(data)};}
export async function closeAccountingPeriod(input:{periodId:string;reason:string}){const profile=await requireAccountsUser();const db=createSupabaseAdminClient();const{data:period,error}=await db.from("accounting_periods").select("period_start,period_end,status").eq("id",input.periodId).single();if(error||!period)throw new Error(error?.message??"Period not found.");const snapshot=await blockers(period.period_start,period.period_end);const{error:closeError}=await db.rpc("close_accounting_period",{p_period_id:input.periodId,p_snapshot:snapshot,p_reason:input.reason.trim(),p_actor:profile.id});if(closeError)throw new Error(closeError.message);return{snapshot};}
export async function reopenAccountingPeriod(input:{periodId:string;reason:string}){const profile=await requireAccountsUser();const db=createSupabaseAdminClient();if(!input.reason.trim())throw new Error("Reopen reason is required.");const{error}=await db.rpc("reopen_accounting_period",{p_period_id:input.periodId,p_reason:input.reason.trim(),p_actor:profile.id});if(error)throw new Error(error.message);return{success:true};}
