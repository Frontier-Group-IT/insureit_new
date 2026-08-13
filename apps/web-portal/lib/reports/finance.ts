import "server-only";
import { getAccessibleCustomerIds, getEmployeeAccessScope } from "@/lib/employee-access-scope";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

type ViewerProfile={id:string;role:string|null};
export type FinanceQuery={period?:string;from?:string;to?:string;insurer?:string;rm?:string;intermediary?:string;billing?:string;page?:string};
export type FinanceFilters={period:"90d"|"mtd"|"ytd"|"all"|"custom";fromDate:string|null;toDate:string|null;insurerId:string|null;rmName:string|null;intermediaryCode:string|null;billingStatus:string|null;page:number};
export type FinanceReport={
 summary:{policy_count:number;gross_premium:number;projected_payin:number;payin_after_tds:number;billed_amount:number;gross_payout:number;retention_amount:number;unbilled_count:number;billing_incomplete_count:number;billed_count:number;pending_payout_count:number};
 insurers:Array<{id:string|null;insurer_name:string;policy_count:number;gross_premium:number;projected_payin:number;payin_after_tds:number;billed_amount:number;gross_payout:number;retention_amount:number}>;
 rms:Array<{rm_name:string;policy_count:number;projected_payin:number;billed_amount:number;gross_payout:number;retention_amount:number}>;
 billing:Array<{billing_status:string;policy_count:number;projected_payin:number;billed_amount:number;sort_order:number}>;
 filters:{insurers:Array<{id:string;name:string}>;rms:string[];intermediaries:Array<{code:string;name:string}>;billing_statuses:string[]};
 register:{rows:FinanceRow[];total_count:number;page:number;page_size:number};
};
export type FinanceRow={id:string;customer_id:string;vehicle_id:string|null;insurance_company_id:string|null;policy_no:string;policy_type:string;business_date:string;rm_name:string|null;intermediary_code:string|null;customer_name:string;customer_code:string;vehicle_no:string;insurer_name:string;gross_premium:number;projected_payin:number;payin_tds:number;payin_after_tds:number;billed_amount:number;billing_status:string;latest_bill_date:string|null;gross_payout:number;retention_amount:number;payout_status:string;latest_payout_date:string|null};

export async function loadFinanceReport(profile:ViewerProfile,query:FinanceQuery){
 const filters=resolveFinanceFilters(query);
 const [customerIds,scope]=await Promise.all([
  getAccessibleCustomerIds(profile.id,profile.role,"view_reports"),
  getEmployeeAccessScope(profile.id,profile.role,"view_reports")
 ]);
 if(customerIds!==null&&customerIds.length===0)return{report:emptyFinanceReport(filters.page),filters,scopeMode:scope.mode};
 const admin=createSupabaseAdminClient();
 const {data,error}=await admin.rpc("get_finance_report",{
  p_customer_ids:customerIds,p_from_date:filters.fromDate,p_to_date:filters.toDate,p_insurer_id:filters.insurerId,p_rm_name:filters.rmName,p_intermediary_code:filters.intermediaryCode,p_billing_status:filters.billingStatus,p_page:filters.page,p_page_size:25
 });
 if(error)throw new Error(`Finance report query failed: ${error.message}`);
 return{report:normalizeFinanceReport(data,filters.page),filters,scopeMode:scope.mode};
}

export function resolveFinanceFilters(query:FinanceQuery):FinanceFilters{
 const period=isPeriod(query.period)?query.period:"90d";
 const today=indiaDate(new Date()); const todayDate=new Date(`${today}T00:00:00+05:30`);
 let fromDate:string|null=null; let toDate:string|null=today;
 if(period==="90d")fromDate=indiaDate(addDays(todayDate,-89));
 if(period==="mtd")fromDate=`${today.slice(0,8)}01`;
 if(period==="ytd")fromDate=`${today.slice(0,4)}-01-01`;
 if(period==="all")toDate=null;
 if(period==="custom"){fromDate=validDate(query.from);toDate=validDate(query.to)}
 if(fromDate&&toDate&&fromDate>toDate)[fromDate,toDate]=[toDate,fromDate];
 return{period,fromDate,toDate,insurerId:validUuid(query.insurer),rmName:cleanText(query.rm,120),intermediaryCode:cleanText(query.intermediary,80),billingStatus:cleanText(query.billing,80),page:positiveInteger(query.page)};
}

function normalizeFinanceReport(value:unknown,page:number):FinanceReport{
 const raw=objectValue(value),summary=objectValue(raw.summary),register=objectValue(raw.register),filters=objectValue(raw.filters);
 return{
  summary:{policy_count:numberValue(summary.policy_count),gross_premium:numberValue(summary.gross_premium),projected_payin:numberValue(summary.projected_payin),payin_after_tds:numberValue(summary.payin_after_tds),billed_amount:numberValue(summary.billed_amount),gross_payout:numberValue(summary.gross_payout),retention_amount:numberValue(summary.retention_amount),unbilled_count:numberValue(summary.unbilled_count),billing_incomplete_count:numberValue(summary.billing_incomplete_count),billed_count:numberValue(summary.billed_count),pending_payout_count:numberValue(summary.pending_payout_count)},
  insurers:arrayValue(raw.insurers).map(row=>{const x=objectValue(row);return{id:nullableString(x.id),insurer_name:stringValue(x.insurer_name),policy_count:numberValue(x.policy_count),gross_premium:numberValue(x.gross_premium),projected_payin:numberValue(x.projected_payin),payin_after_tds:numberValue(x.payin_after_tds),billed_amount:numberValue(x.billed_amount),gross_payout:numberValue(x.gross_payout),retention_amount:numberValue(x.retention_amount)}}),
  rms:arrayValue(raw.rms).map(row=>{const x=objectValue(row);return{rm_name:stringValue(x.rm_name),policy_count:numberValue(x.policy_count),projected_payin:numberValue(x.projected_payin),billed_amount:numberValue(x.billed_amount),gross_payout:numberValue(x.gross_payout),retention_amount:numberValue(x.retention_amount)}}),
  billing:arrayValue(raw.billing).map(row=>{const x=objectValue(row);return{billing_status:stringValue(x.billing_status),policy_count:numberValue(x.policy_count),projected_payin:numberValue(x.projected_payin),billed_amount:numberValue(x.billed_amount),sort_order:numberValue(x.sort_order)}}),
  filters:{insurers:arrayValue(filters.insurers).map(row=>{const x=objectValue(row);return{id:stringValue(x.id),name:stringValue(x.name)}}).filter(x=>x.id&&x.name),rms:arrayValue(filters.rms).map(stringValue).filter(Boolean),intermediaries:arrayValue(filters.intermediaries).map(row=>{const x=objectValue(row);return{code:stringValue(x.code),name:stringValue(x.name)}}).filter(x=>x.code),billing_statuses:arrayValue(filters.billing_statuses).map(stringValue).filter(Boolean)},
  register:{rows:arrayValue(register.rows).map(normalizeRow),total_count:numberValue(register.total_count),page:numberValue(register.page)||page,page_size:numberValue(register.page_size)||25}
 };
}
function normalizeRow(row:unknown):FinanceRow{const x=objectValue(row);return{id:stringValue(x.id),customer_id:stringValue(x.customer_id),vehicle_id:nullableString(x.vehicle_id),insurance_company_id:nullableString(x.insurance_company_id),policy_no:stringValue(x.policy_no),policy_type:stringValue(x.policy_type),business_date:stringValue(x.business_date),rm_name:nullableString(x.rm_name),intermediary_code:nullableString(x.intermediary_code),customer_name:stringValue(x.customer_name),customer_code:stringValue(x.customer_code),vehicle_no:stringValue(x.vehicle_no),insurer_name:stringValue(x.insurer_name),gross_premium:numberValue(x.gross_premium),projected_payin:numberValue(x.projected_payin),payin_tds:numberValue(x.payin_tds),payin_after_tds:numberValue(x.payin_after_tds),billed_amount:numberValue(x.billed_amount),billing_status:stringValue(x.billing_status),latest_bill_date:nullableString(x.latest_bill_date),gross_payout:numberValue(x.gross_payout),retention_amount:numberValue(x.retention_amount),payout_status:stringValue(x.payout_status),latest_payout_date:nullableString(x.latest_payout_date)}}
export function emptyFinanceReport(page=1):FinanceReport{return{summary:{policy_count:0,gross_premium:0,projected_payin:0,payin_after_tds:0,billed_amount:0,gross_payout:0,retention_amount:0,unbilled_count:0,billing_incomplete_count:0,billed_count:0,pending_payout_count:0},insurers:[],rms:[],billing:[],filters:{insurers:[],rms:[],intermediaries:[],billing_statuses:[]},register:{rows:[],total_count:0,page,page_size:25}}}
function isPeriod(v:string|undefined):v is FinanceFilters["period"]{return v==="90d"||v==="mtd"||v==="ytd"||v==="all"||v==="custom"}
function validDate(v:string|undefined){return v&&/^\d{4}-\d{2}-\d{2}$/.test(v)?v:null}
function validUuid(v:string|undefined){return v&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v)?v:null}
function cleanText(v:string|undefined,max:number){const x=v?.trim();return x?x.slice(0,max):null}
function positiveInteger(v:string|undefined){const x=Number.parseInt(v??"1",10);return Number.isFinite(x)&&x>0?x:1}
function addDays(d:Date,n:number){const x=new Date(d);x.setDate(x.getDate()+n);return x}
function indiaDate(d:Date){return new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Kolkata",year:"numeric",month:"2-digit",day:"2-digit"}).format(d)}
function arrayValue(v:unknown):unknown[]{return Array.isArray(v)?v:[]}
function objectValue(v:unknown):Record<string,unknown>{return v&&typeof v==="object"&&!Array.isArray(v)?v as Record<string,unknown>:{} }
function stringValue(v:unknown){return typeof v==="string"?v:v==null?"":String(v)}
function nullableString(v:unknown){const x=stringValue(v).trim();return x||null}
function numberValue(v:unknown){const x=typeof v==="number"?v:Number(v??0);return Number.isFinite(x)?x:0}
