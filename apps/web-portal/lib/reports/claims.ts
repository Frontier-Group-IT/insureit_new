import "server-only";
import { getAccessibleCustomerIds, getEmployeeAccessScope } from "@/lib/employee-access-scope";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

type ViewerProfile={id:string;role:string|null};
export type ClaimsQuery={period?:string;from?:string;to?:string;insurer?:string;status?:string;mode?:string;page?:string};
export type ClaimsFilters={period:"90d"|"mtd"|"ytd"|"all"|"custom";fromDate:string|null;toDate:string|null;insurerId:string|null;status:string|null;serviceMode:"broker_managed"|"self_managed"|null;page:number};
export type ClaimsReport={
  summary:{claim_count:number;open_claim_count:number;settled_claim_count:number;rejected_claim_count:number;average_open_age_days:number;estimated_loss:number;approved_amount:number;settlement_amount:number;claims_with_pending_documents:number;claims_with_rejected_documents:number};
  aging:Array<{key:string;label:string;sort_order:number;claim_count:number}>;
  statuses:Array<{status:string;claim_count:number;estimated_loss:number}>;
  insurers:Array<{id:string|null;insurer_name:string;claim_count:number;open_claim_count:number;estimated_loss:number;settlement_amount:number}>;
  documents:{pending_documents:number;rejected_documents:number;claims_with_pending_documents:number;claims_with_rejected_documents:number};
  filters:{insurers:Array<{id:string;name:string}>;statuses:string[];service_modes:string[]};
  register:{rows:ClaimsRow[];total_count:number;page:number;page_size:number};
};
export type ClaimsRow={id:string;claim_no:string;status:string;service_mode:string|null;created_at:string;accident_at:string|null;age_days:number;customer_name:string;customer_code:string;vehicle_no:string;policy_no:string;insurer_name:string;rm_name:string;intermediary_code:string;estimated_loss:number;approved_amount:number;settlement_amount:number;document_count:number;pending_documents:number;rejected_documents:number};

export async function loadClaimsReport(profile:ViewerProfile,query:ClaimsQuery){
  const filters=resolveClaimsFilters(query);
  const [customerIds,scope]=await Promise.all([
    getAccessibleCustomerIds(profile.id,profile.role,"view_reports"),
    getEmployeeAccessScope(profile.id,profile.role,"view_reports")
  ]);
  if(customerIds!==null&&customerIds.length===0)return{report:emptyClaimsReport(filters.page),filters,scopeMode:scope.mode};
  const admin=createSupabaseAdminClient();
  const {data,error}=await admin.rpc("get_claims_report",{
    p_customer_ids:customerIds,p_from_date:filters.fromDate,p_to_date:filters.toDate,p_insurer_id:filters.insurerId,p_status:filters.status,p_service_mode:filters.serviceMode,p_page:filters.page,p_page_size:25
  });
  if(error)throw new Error(`Claims report query failed: ${error.message}`);
  return{report:normalizeClaimsReport(data,filters.page),filters,scopeMode:scope.mode};
}

export function resolveClaimsFilters(query:ClaimsQuery):ClaimsFilters{
  const period=isPeriod(query.period)?query.period:"90d";
  const today=indiaDate(new Date()); const todayDate=new Date(`${today}T00:00:00+05:30`);
  let fromDate:string|null=null; let toDate:string|null=today;
  if(period==="90d")fromDate=indiaDate(addDays(todayDate,-89));
  if(period==="mtd")fromDate=`${today.slice(0,8)}01`;
  if(period==="ytd")fromDate=`${today.slice(0,4)}-01-01`;
  if(period==="all")toDate=null;
  if(period==="custom"){fromDate=validDate(query.from);toDate=validDate(query.to)}
  if(fromDate&&toDate&&fromDate>toDate)[fromDate,toDate]=[toDate,fromDate];
  return{period,fromDate,toDate,insurerId:validUuid(query.insurer),status:cleanText(query.status,80),serviceMode:isMode(query.mode)?query.mode:null,page:positiveInteger(query.page)};
}

function normalizeClaimsReport(value:unknown,page:number):ClaimsReport{
  const raw=objectValue(value),summary=objectValue(raw.summary),documents=objectValue(raw.documents),register=objectValue(raw.register),filters=objectValue(raw.filters);
  return{
    summary:{claim_count:numberValue(summary.claim_count),open_claim_count:numberValue(summary.open_claim_count),settled_claim_count:numberValue(summary.settled_claim_count),rejected_claim_count:numberValue(summary.rejected_claim_count),average_open_age_days:numberValue(summary.average_open_age_days),estimated_loss:numberValue(summary.estimated_loss),approved_amount:numberValue(summary.approved_amount),settlement_amount:numberValue(summary.settlement_amount),claims_with_pending_documents:numberValue(summary.claims_with_pending_documents),claims_with_rejected_documents:numberValue(summary.claims_with_rejected_documents)},
    aging:arrayValue(raw.aging).map(row=>{const x=objectValue(row);return{key:stringValue(x.key),label:stringValue(x.label),sort_order:numberValue(x.sort_order),claim_count:numberValue(x.claim_count)}}),
    statuses:arrayValue(raw.statuses).map(row=>{const x=objectValue(row);return{status:stringValue(x.status),claim_count:numberValue(x.claim_count),estimated_loss:numberValue(x.estimated_loss)}}),
    insurers:arrayValue(raw.insurers).map(row=>{const x=objectValue(row);return{id:nullableString(x.id),insurer_name:stringValue(x.insurer_name),claim_count:numberValue(x.claim_count),open_claim_count:numberValue(x.open_claim_count),estimated_loss:numberValue(x.estimated_loss),settlement_amount:numberValue(x.settlement_amount)}}),
    documents:{pending_documents:numberValue(documents.pending_documents),rejected_documents:numberValue(documents.rejected_documents),claims_with_pending_documents:numberValue(documents.claims_with_pending_documents),claims_with_rejected_documents:numberValue(documents.claims_with_rejected_documents)},
    filters:{insurers:arrayValue(filters.insurers).map(row=>{const x=objectValue(row);return{id:stringValue(x.id),name:stringValue(x.name)}}).filter(x=>x.id&&x.name),statuses:arrayValue(filters.statuses).map(stringValue).filter(Boolean),service_modes:arrayValue(filters.service_modes).map(stringValue).filter(Boolean)},
    register:{rows:arrayValue(register.rows).map(normalizeRow),total_count:numberValue(register.total_count),page:numberValue(register.page)||page,page_size:numberValue(register.page_size)||25}
  };
}
function normalizeRow(row:unknown):ClaimsRow{const x=objectValue(row);return{id:stringValue(x.id),claim_no:stringValue(x.claim_no),status:stringValue(x.status),service_mode:nullableString(x.service_mode),created_at:stringValue(x.created_at),accident_at:nullableString(x.accident_at),age_days:numberValue(x.age_days),customer_name:stringValue(x.customer_name),customer_code:stringValue(x.customer_code),vehicle_no:stringValue(x.vehicle_no),policy_no:stringValue(x.policy_no),insurer_name:stringValue(x.insurer_name),rm_name:stringValue(x.rm_name),intermediary_code:stringValue(x.intermediary_code),estimated_loss:numberValue(x.estimated_loss),approved_amount:numberValue(x.approved_amount),settlement_amount:numberValue(x.settlement_amount),document_count:numberValue(x.document_count),pending_documents:numberValue(x.pending_documents),rejected_documents:numberValue(x.rejected_documents)}}
export function emptyClaimsReport(page=1):ClaimsReport{return{summary:{claim_count:0,open_claim_count:0,settled_claim_count:0,rejected_claim_count:0,average_open_age_days:0,estimated_loss:0,approved_amount:0,settlement_amount:0,claims_with_pending_documents:0,claims_with_rejected_documents:0},aging:[],statuses:[],insurers:[],documents:{pending_documents:0,rejected_documents:0,claims_with_pending_documents:0,claims_with_rejected_documents:0},filters:{insurers:[],statuses:[],service_modes:[]},register:{rows:[],total_count:0,page,page_size:25}}}
function isPeriod(v:string|undefined):v is ClaimsFilters["period"]{return v==="90d"||v==="mtd"||v==="ytd"||v==="all"||v==="custom"}
function isMode(v:string|undefined):v is NonNullable<ClaimsFilters["serviceMode"]>{return v==="broker_managed"||v==="self_managed"}
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
