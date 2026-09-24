import "server-only";
import { getEmployeeAccessScope } from "@/lib/employee-access-scope";
import { getAccessiblePolicyRmEmployeeIds } from "@/lib/policy-access-scope";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

type ViewerProfile = { id: string; role: string | null };
export type PolicyBusinessQuery = { period?: string; from?: string; to?: string; insurer?: string; rm?: string; intermediary?: string; business?: string; category?: string; page?: string; pageSize?: string };
export type PolicyBusinessFilters = { period: "90d" | "mtd" | "ytd" | "all" | "custom"; fromDate: string | null; toDate: string | null; insurerId: string | null; rmEmployeeId: string | null; intermediaryCode: string | null; businessLine: "Motor" | "Non Motor" | null; category: string | null; page: number };
export type PolicyBusinessReport = {
 summary:{policy_count:number;active_policy_count:number;gross_premium:number;net_premium:number;od_premium:number;tp_premium:number;cpa_amount:number;average_premium:number;insurer_count:number;intermediary_count:number;motor_policy_count:number;non_motor_policy_count:number;motor_gross_premium:number;non_motor_gross_premium:number};
 trend:Array<{month:string;policy_count:number;gross_premium:number}>;
 category_mix:Array<{category:string;policy_count:number;gross_premium:number}>;
 insurers:Array<{id:string;name:string;policy_count:number;gross_premium:number;share_percent:number}>;
 rms:Array<{employee_id?:string|null;name:string;policy_count:number;intermediary_count:number;gross_premium:number;average_premium:number}>;
 filters:PolicyBusinessFilterOptions;
 register:{rows:PolicyBusinessRow[];total_count:number;page:number;page_size:number};
};
export type PolicyBusinessNetReport = {
 summary:{policy_count:number;active_policy_count:number;gross_premium:number;net_premium:number;od_premium:number;tp_premium:number;cpa_amount:number;average_net_premium:number;insurer_count:number;intermediary_count:number;motor_policy_count:number;non_motor_policy_count:number;motor_net_premium:number;non_motor_net_premium:number};
 trend:Array<{month:string;policy_count:number;net_premium:number}>;
 category_mix:Array<{category:string;policy_count:number;net_premium:number}>;
 insurers:Array<{id:string;name:string;policy_count:number;net_premium:number;share_percent:number}>;
 rms:Array<{employee_id?:string|null;name:string;policy_count:number;intermediary_count:number;net_premium:number;average_net_premium:number}>;
 filters:PolicyBusinessFilterOptions;
 register:{rows:PolicyBusinessRow[];total_count:number;page:number;page_size:number};
};
type PolicyBusinessFilterOptions={insurers:Array<{id:string;name:string}>;rms:Array<{id:string;name:string}>;intermediaries:Array<{code:string;type:string|null;name:string}>;categories:string[]};
export type PolicyBusinessRow = {id:string;policy_no:string;business_date:string;policy_type:string;policy_product:string;business_type:string|null;business_line:string;category:string;start_date:string;end_date:string;status:string;customer_name:string;customer_code:string;vehicle_no:string;risk_reference:string;risk_secondary:string|null;insurer_name:string;rm_name:string|null;intermediary_code:string|null;intermediary_type:string|null;gross_premium:number;net_premium:number;od_premium:number;tp_premium:number;cpa_amount:number;insured_declared_value:number|null};

export async function loadPolicyBusinessReport(profile:ViewerProfile,query:PolicyBusinessQuery){
 const {filters,scopeRmEmployeeIds,scope}=await reportContext(profile,query);
 if(scopeRmEmployeeIds!==null&&scopeRmEmployeeIds.length===0)return{report:emptyPolicyBusinessReport(filters.page),filters,scopeMode:scope.mode};
 const admin=createSupabaseAdminClient();
 const reportResult=await admin.rpc("get_policy_business_report_v4",reportRpcArgs(scopeRmEmployeeIds,filters,positiveLimitedInteger(query.pageSize,25,5000)));
 if(reportResult.error)throw new Error(`Policy business report query failed: ${reportResult.error.message}`);
 return{report:normalizePolicyBusinessReport(reportResult.data,filters.page),filters,scopeMode:scope.mode};
}

export async function loadPolicyBusinessNetReport(profile:ViewerProfile,query:PolicyBusinessQuery){
 const {filters,scopeRmEmployeeIds,scope}=await reportContext(profile,query);
 if(scopeRmEmployeeIds!==null&&scopeRmEmployeeIds.length===0)return{report:emptyPolicyBusinessNetReport(filters.page),filters,scopeMode:scope.mode};
 const admin=createSupabaseAdminClient();
 const reportResult=await admin.rpc("get_policy_business_report_v5",reportRpcArgs(scopeRmEmployeeIds,filters,positiveLimitedInteger(query.pageSize,25,5000)));
 if(reportResult.error)throw new Error(`Policy business net report query failed: ${reportResult.error.message}`);
 return{report:normalizePolicyBusinessNetReport(reportResult.data,filters.page),filters,scopeMode:scope.mode};
}


export async function loadPolicyBusinessDailyTrend(profile:ViewerProfile,query:PolicyBusinessQuery){
 const {filters,scopeRmEmployeeIds}=await reportContext(profile,query);
 if(scopeRmEmployeeIds!==null&&scopeRmEmployeeIds.length===0)return[] as Array<{date:string;policy_count:number;net_premium:number}>;
 const admin=createSupabaseAdminClient();
 const pageSize=200;
 const totals=new Map<string,{policy_count:number;net_premium:number}>();
 let page=1;
 let totalPages=1;
 do{
  const pageFilters={...filters,page};
  const result=await admin.rpc("get_policy_business_report_v5",reportRpcArgs(scopeRmEmployeeIds,pageFilters,pageSize));
  if(result.error)throw new Error(`Policy business daily trend query failed: ${result.error.message}`);
  const report=normalizePolicyBusinessNetReport(result.data,page);
  for(const row of report.register.rows){
   if(!row.business_date)continue;
   const current=totals.get(row.business_date)??{policy_count:0,net_premium:0};
   current.policy_count+=1;
   current.net_premium+=row.net_premium||0;
   totals.set(row.business_date,current);
  }
  totalPages=Math.max(1,Math.ceil(report.register.total_count/pageSize));
  page+=1;
 }while(page<=totalPages);
 return[...totals.entries()].sort(([a],[b])=>a.localeCompare(b)).map(([date,total])=>({date,...total}));
}


export async function loadPolicyBusinessSourceMix(profile:ViewerProfile,query:PolicyBusinessQuery){
 const {filters,scopeRmEmployeeIds}=await reportContext(profile,query);
 if(scopeRmEmployeeIds!==null&&scopeRmEmployeeIds.length===0)return[] as Array<{key:string;name:string;policy_count:number;net_premium:number;share_percent:number}>;
 const admin=createSupabaseAdminClient();
 const pageSize=200;
 const totals=new Map<string,{name:string;policy_count:number;net_premium:number}>();
 const sourceNames=new Map<string,string>();
 let page=1;
 let totalPages=1;
 do{
  const pageFilters={...filters,page};
  const result=await admin.rpc("get_policy_business_report_v5",reportRpcArgs(scopeRmEmployeeIds,pageFilters,pageSize));
  if(result.error)throw new Error(`Policy business source mix query failed: ${result.error.message}`);
  const report=normalizePolicyBusinessNetReport(result.data,page);
  for(const source of report.filters.intermediaries){
   sourceNames.set(source.code,source.name||source.code);
  }
  for(const row of report.register.rows){
   const key=row.intermediary_code?.trim()||"unassigned";
   const name=key==="unassigned"?"Unassigned":(sourceNames.get(key)||key);
   const current=totals.get(key)??{name,policy_count:0,net_premium:0};
   current.name=name;
   current.policy_count+=1;
   current.net_premium+=row.net_premium||0;
   totals.set(key,current);
  }
  totalPages=Math.max(1,Math.ceil(report.register.total_count/pageSize));
  page+=1;
 }while(page<=totalPages);
 const totalPremium=[...totals.values()].reduce((sum,row)=>sum+row.net_premium,0);
 return[...totals.entries()]
  .map(([key,row])=>({key,...row,share_percent:totalPremium>0?(row.net_premium/totalPremium)*100:0}))
  .sort((a,b)=>b.net_premium-a.net_premium||b.policy_count-a.policy_count||a.name.localeCompare(b.name))
  .slice(0,12);
}

async function reportContext(profile:ViewerProfile,query:PolicyBusinessQuery){
 const filters=resolvePolicyBusinessFilters(query);
 const [scopeRmEmployeeIds,scope]=await Promise.all([getAccessiblePolicyRmEmployeeIds(profile.id,profile.role,"view_reports"),getEmployeeAccessScope(profile.id,profile.role,"view_reports")]);
 return{filters,scopeRmEmployeeIds,scope};
}
function reportRpcArgs(scopeRmEmployeeIds:string[]|null,filters:PolicyBusinessFilters,pageSize:number){return{p_scope_rm_employee_ids:scopeRmEmployeeIds,p_from_date:filters.fromDate,p_to_date:filters.toDate,p_insurer_id:filters.insurerId,p_rm_employee_id:filters.rmEmployeeId,p_intermediary_code:filters.intermediaryCode,p_business_line:filters.businessLine,p_category:filters.category,p_page:filters.page,p_page_size:pageSize}}

export function resolvePolicyBusinessFilters(query:PolicyBusinessQuery):PolicyBusinessFilters{
 const period=isPeriod(query.period)?query.period:"mtd";const today=indiaDate(new Date());const todayDate=new Date(`${today}T00:00:00+05:30`);let fromDate:string|null=null;let toDate:string|null=today;
 if(period==="90d")fromDate=indiaDate(addDays(todayDate,-89));if(period==="mtd")fromDate=`${today.slice(0,8)}01`;if(period==="ytd")fromDate=`${today.slice(0,4)}-01-01`;if(period==="all")toDate=null;if(period==="custom"){fromDate=validDate(query.from);toDate=validDate(query.to)}if(fromDate&&toDate&&fromDate>toDate)[fromDate,toDate]=[toDate,fromDate];
 return{period,fromDate,toDate,insurerId:validUuid(query.insurer),rmEmployeeId:validUuid(query.rm),intermediaryCode:cleanText(query.intermediary,120),businessLine:businessLine(query.business),category:cleanText(query.category,120),page:positiveInteger(query.page)};
}
export function reportScopeLabel(mode:"organization"|"hierarchy"|"self"|"none"){if(mode==="organization")return"Organization";if(mode==="hierarchy")return"Reporting hierarchy";if(mode==="self")return"My portfolio";return"Assigned records"}

function normalizePolicyBusinessReport(value:unknown,page:number):PolicyBusinessReport{
 const raw=objectValue(value),summary=objectValue(raw.summary),register=objectValue(raw.register),filters=normalizeFilters(raw.filters);
 return{
  summary:{policy_count:numberValue(summary.policy_count),active_policy_count:numberValue(summary.active_policy_count),gross_premium:numberValue(summary.gross_premium),net_premium:numberValue(summary.net_premium),od_premium:numberValue(summary.od_premium),tp_premium:numberValue(summary.tp_premium),cpa_amount:numberValue(summary.cpa_amount),average_premium:numberValue(summary.average_premium),insurer_count:numberValue(summary.insurer_count),intermediary_count:numberValue(summary.intermediary_count),motor_policy_count:numberValue(summary.motor_policy_count),non_motor_policy_count:numberValue(summary.non_motor_policy_count),motor_gross_premium:numberValue(summary.motor_gross_premium),non_motor_gross_premium:numberValue(summary.non_motor_gross_premium)},
  trend:arrayValue(raw.trend).map(row=>{const x=objectValue(row);return{month:stringValue(x.month),policy_count:numberValue(x.policy_count),gross_premium:numberValue(x.gross_premium)}}),
  category_mix:arrayValue(raw.category_mix).map(row=>{const x=objectValue(row);return{category:stringValue(x.category),policy_count:numberValue(x.policy_count),gross_premium:numberValue(x.gross_premium)}}),
  insurers:arrayValue(raw.insurers).map(row=>{const x=objectValue(row);return{id:stringValue(x.id),name:stringValue(x.name),policy_count:numberValue(x.policy_count),gross_premium:numberValue(x.gross_premium),share_percent:numberValue(x.share_percent)}}),
  rms:arrayValue(raw.rms).map(row=>{const x=objectValue(row);return{employee_id:nullableString(x.employee_id),name:stringValue(x.name),policy_count:numberValue(x.policy_count),intermediary_count:numberValue(x.intermediary_count),gross_premium:numberValue(x.gross_premium),average_premium:numberValue(x.average_premium)}}),
  filters,
  register:{rows:arrayValue(register.rows).map(normalizeRow),total_count:numberValue(register.total_count),page:numberValue(register.page)||page,page_size:numberValue(register.page_size)||25}
 };
}
function normalizePolicyBusinessNetReport(value:unknown,page:number):PolicyBusinessNetReport{
 const raw=objectValue(value),summary=objectValue(raw.summary),register=objectValue(raw.register),filters=normalizeFilters(raw.filters);
 return{
  summary:{policy_count:numberValue(summary.policy_count),active_policy_count:numberValue(summary.active_policy_count),gross_premium:numberValue(summary.gross_premium),net_premium:numberValue(summary.net_premium),od_premium:numberValue(summary.od_premium),tp_premium:numberValue(summary.tp_premium),cpa_amount:numberValue(summary.cpa_amount),average_net_premium:numberValue(summary.average_net_premium),insurer_count:numberValue(summary.insurer_count),intermediary_count:numberValue(summary.intermediary_count),motor_policy_count:numberValue(summary.motor_policy_count),non_motor_policy_count:numberValue(summary.non_motor_policy_count),motor_net_premium:numberValue(summary.motor_net_premium),non_motor_net_premium:numberValue(summary.non_motor_net_premium)},
  trend:arrayValue(raw.trend).map(row=>{const x=objectValue(row);return{month:stringValue(x.month),policy_count:numberValue(x.policy_count),net_premium:numberValue(x.net_premium)}}),
  category_mix:arrayValue(raw.category_mix).map(row=>{const x=objectValue(row);return{category:stringValue(x.category),policy_count:numberValue(x.policy_count),net_premium:numberValue(x.net_premium)}}),
  insurers:arrayValue(raw.insurers).map(row=>{const x=objectValue(row);return{id:stringValue(x.id),name:stringValue(x.name),policy_count:numberValue(x.policy_count),net_premium:numberValue(x.net_premium),share_percent:numberValue(x.share_percent)}}),
  rms:arrayValue(raw.rms).map(row=>{const x=objectValue(row);return{employee_id:nullableString(x.employee_id),name:stringValue(x.name),policy_count:numberValue(x.policy_count),intermediary_count:numberValue(x.intermediary_count),net_premium:numberValue(x.net_premium),average_net_premium:numberValue(x.average_net_premium)}}),
  filters,
  register:{rows:arrayValue(register.rows).map(normalizeRow),total_count:numberValue(register.total_count),page:numberValue(register.page)||page,page_size:numberValue(register.page_size)||25}
 };
}
function normalizeFilters(value:unknown):PolicyBusinessFilterOptions{const filters=objectValue(value);return{insurers:arrayValue(filters.insurers).map(row=>{const x=objectValue(row);return{id:stringValue(x.id),name:stringValue(x.name)}}).filter(x=>x.id&&x.name),rms:arrayValue(filters.rms).map(row=>{const x=objectValue(row);return{id:stringValue(x.id),name:stringValue(x.name)}}).filter((x):x is {id:string;name:string}=>Boolean(x.id&&x.name)),intermediaries:arrayValue(filters.intermediaries).map(row=>{const x=objectValue(row);return{code:stringValue(x.code),type:nullableString(x.type),name:stringValue(x.name)}}).filter(x=>x.code),categories:arrayValue(filters.categories).map(stringValue).filter(Boolean)}}
function normalizeRow(row:unknown):PolicyBusinessRow{const x=objectValue(row);return{id:stringValue(x.id),policy_no:stringValue(x.policy_no),business_date:stringValue(x.business_date),policy_type:stringValue(x.policy_type),policy_product:stringValue(x.policy_product),business_type:nullableString(x.business_type),business_line:stringValue(x.business_line)||"Motor",category:stringValue(x.category)||stringValue(x.policy_type),start_date:stringValue(x.start_date),end_date:stringValue(x.end_date),status:stringValue(x.status),customer_name:stringValue(x.customer_name),customer_code:stringValue(x.customer_code),vehicle_no:stringValue(x.vehicle_no),risk_reference:stringValue(x.risk_reference),risk_secondary:nullableString(x.risk_secondary),insurer_name:stringValue(x.insurer_name),rm_name:nullableString(x.rm_name),intermediary_code:nullableString(x.intermediary_code),intermediary_type:nullableString(x.intermediary_type),gross_premium:numberValue(x.gross_premium),net_premium:numberValue(x.net_premium),od_premium:numberValue(x.od_premium),tp_premium:numberValue(x.tp_premium),cpa_amount:numberValue(x.cpa_amount),insured_declared_value:nullableNumber(x.insured_declared_value)}}
function emptyPolicyBusinessReport(page:number):PolicyBusinessReport{return{summary:{policy_count:0,active_policy_count:0,gross_premium:0,net_premium:0,od_premium:0,tp_premium:0,cpa_amount:0,average_premium:0,insurer_count:0,intermediary_count:0,motor_policy_count:0,non_motor_policy_count:0,motor_gross_premium:0,non_motor_gross_premium:0},trend:[],category_mix:[],insurers:[],rms:[],filters:emptyFilters(),register:{rows:[],total_count:0,page,page_size:25}}}
function emptyPolicyBusinessNetReport(page:number):PolicyBusinessNetReport{return{summary:{policy_count:0,active_policy_count:0,gross_premium:0,net_premium:0,od_premium:0,tp_premium:0,cpa_amount:0,average_net_premium:0,insurer_count:0,intermediary_count:0,motor_policy_count:0,non_motor_policy_count:0,motor_net_premium:0,non_motor_net_premium:0},trend:[],category_mix:[],insurers:[],rms:[],filters:emptyFilters(),register:{rows:[],total_count:0,page,page_size:25}}}
function emptyFilters():PolicyBusinessFilterOptions{return{insurers:[],rms:[],intermediaries:[],categories:[]}}
function isPeriod(value:string|undefined):value is PolicyBusinessFilters["period"]{return value==="90d"||value==="mtd"||value==="ytd"||value==="all"||value==="custom"}
function validDate(value:string|undefined){return value&&/^\d{4}-\d{2}-\d{2}$/.test(value)?value:null}
function validUuid(value:string|undefined){return value&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)?value:null}
function cleanText(value:string|undefined,max:number){const cleaned=value?.trim();return cleaned?cleaned.slice(0,max):null}
function businessLine(value:string|undefined):PolicyBusinessFilters["businessLine"]{return value==="Motor"||value==="Non Motor"?value:null}
function positiveInteger(value:string|undefined){const parsed=Number.parseInt(value??"1",10);return Number.isFinite(parsed)&&parsed>0?parsed:1}
function positiveLimitedInteger(value:string|undefined,fallback:number,max:number){const parsed=Number.parseInt(value??String(fallback),10);return Number.isFinite(parsed)&&parsed>0?Math.min(parsed,max):fallback}
function addDays(date:Date,days:number){const copy=new Date(date);copy.setDate(copy.getDate()+days);return copy}
function indiaDate(date:Date){return new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Kolkata",year:"numeric",month:"2-digit",day:"2-digit"}).format(date)}
function arrayValue(value:unknown):unknown[]{return Array.isArray(value)?value:[]}
function objectValue(value:unknown):Record<string,unknown>{return value&&typeof value==="object"&&!Array.isArray(value)?value as Record<string,unknown>: {}}
function stringValue(value:unknown){return typeof value==="string"?value:value==null?"":String(value)}
function nullableString(value:unknown){const valueString=stringValue(value).trim();return valueString||null}
function numberValue(value:unknown){const numeric=typeof value==="number"?value:Number(value??0);return Number.isFinite(numeric)?numeric:0}
function nullableNumber(value:unknown){if(value==null||value==="")return null;return numberValue(value)}