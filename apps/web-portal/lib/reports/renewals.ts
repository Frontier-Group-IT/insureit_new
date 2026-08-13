import "server-only";
import { getAccessibleCustomerIds, getEmployeeAccessScope } from "@/lib/employee-access-scope";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

type ViewerProfile = { id: string; role: string | null };
export type RenewalBucket = "expired" | "due_30" | "due_31_60" | "due_61_90" | "due_91_180" | "due_181_365";
export type RenewalQuery = { horizon?: string; insurer?: string; rm?: string; intermediary?: string; bucket?: string; page?: string };
export type RenewalFilters = { horizonDays: 30 | 60 | 90 | 180 | 365; insurerId: string | null; rmEmployeeId: string | null; intermediaryCode: string | null; bucket: RenewalBucket | null; page: number };
export type RenewalRow = { id:string; policy_no:string; policy_type:string; start_date:string; end_date:string; status:string; customer_name:string; customer_code:string; vehicle_no:string; insurer_name:string; rm_name:string; intermediary_type:string|null; intermediary_code:string|null; gross_premium:number; days_to_expiry:number; renewal_bucket:RenewalBucket };
export type RenewalReport = {summary:{upcoming_policy_count:number;expired_policy_count:number;due_30_count:number;due_90_count:number;customer_count:number;premium_at_risk:number;premium_due_30:number;nearest_expiry:string|null};buckets:Array<{key:RenewalBucket;label:string;policy_count:number;gross_premium:number}>;insurers:Array<{id:string|null;insurer_name:string;upcoming_policy_count:number;due_30_count:number;expired_count:number;premium_at_risk:number;nearest_expiry:string|null}>;rms:Array<{rm_name:string;upcoming_policy_count:number;customer_count:number;due_30_count:number;expired_count:number;premium_at_risk:number;nearest_expiry:string|null}>;filters:{insurers:Array<{id:string;name:string}>;rms:Array<{id:string;name:string}>;intermediaries:Array<{code:string;type:string|null;name:string}>};register:{rows:RenewalRow[];total_count:number;page:number;page_size:number}};

export async function loadRenewalReport(profile: ViewerProfile, query: RenewalQuery, pageSize = 25) {
  const filters = resolveRenewalFilters(query);
  const [customerIds, scope] = await Promise.all([getAccessibleCustomerIds(profile.id, profile.role, "view_reports"), getEmployeeAccessScope(profile.id, profile.role, "view_reports")]);
  if (customerIds !== null && customerIds.length === 0) return { report: emptyRenewalReport(filters.page, pageSize), filters, scopeMode: scope.mode };
  const admin = createSupabaseAdminClient();
  const [reportResult, rmResult] = await Promise.all([
    admin.rpc("get_renewal_report_v2", { p_customer_ids: customerIds, p_horizon_days: filters.horizonDays, p_insurer_id: filters.insurerId, p_rm_employee_id: filters.rmEmployeeId, p_intermediary_code: filters.intermediaryCode, p_bucket: filters.bucket, p_page: filters.page, p_page_size: pageSize }),
    admin.rpc("get_reporting_rm_options", { p_customer_ids: customerIds }),
  ]);
  if (reportResult.error) throw new Error(`Renewal report query failed: ${reportResult.error.message}`);
  if (rmResult.error) throw new Error(`Reporting RM options query failed: ${rmResult.error.message}`);
  const report = normalizeReport(reportResult.data, filters.page, pageSize);
  report.filters.rms = normalizeRmOptions(rmResult.data);
  return { report, filters, scopeMode: scope.mode };
}

export async function loadRenewalExport(profile: ViewerProfile, query: RenewalQuery) { const payload = await loadRenewalReport(profile, { ...query, page: "1" }, 10001); return { rows: payload.report.register.rows.slice(0, 10000), truncated: payload.report.register.total_count > 10000 }; }
export function resolveRenewalFilters(query: RenewalQuery): RenewalFilters { return { horizonDays: horizon(query.horizon), insurerId: uuid(query.insurer), rmEmployeeId: uuid(query.rm), intermediaryCode: text(query.intermediary, 120), bucket: bucket(query.bucket), page: positiveInt(query.page) }; }
function normalizeReport(value:unknown,page:number,pageSize:number):RenewalReport { const raw=obj(value),summary=obj(raw.summary),register=obj(raw.register),filters=obj(raw.filters); return {summary:{upcoming_policy_count:num(summary.upcoming_policy_count),expired_policy_count:num(summary.expired_policy_count),due_30_count:num(summary.due_30_count),due_90_count:num(summary.due_90_count),customer_count:num(summary.customer_count),premium_at_risk:num(summary.premium_at_risk),premium_due_30:num(summary.premium_due_30),nearest_expiry:nullable(summary.nearest_expiry)},buckets:arr(raw.buckets).map(v=>{const x=obj(v);return{key:bucket(str(x.key))??"expired",label:str(x.label),policy_count:num(x.policy_count),gross_premium:num(x.gross_premium)}}),insurers:arr(raw.insurers).map(v=>{const x=obj(v);return{id:nullable(x.id),insurer_name:str(x.insurer_name),upcoming_policy_count:num(x.upcoming_policy_count),due_30_count:num(x.due_30_count),expired_count:num(x.expired_count),premium_at_risk:num(x.premium_at_risk),nearest_expiry:nullable(x.nearest_expiry)}}),rms:arr(raw.rms).map(v=>{const x=obj(v);return{rm_name:str(x.rm_name),upcoming_policy_count:num(x.upcoming_policy_count),customer_count:num(x.customer_count),due_30_count:num(x.due_30_count),expired_count:num(x.expired_count),premium_at_risk:num(x.premium_at_risk),nearest_expiry:nullable(x.nearest_expiry)}}),filters:{insurers:arr(filters.insurers).map(v=>{const x=obj(v);return{id:str(x.id),name:str(x.name)}}).filter(x=>x.id&&x.name),rms:[],intermediaries:arr(filters.intermediaries).map(v=>{const x=obj(v);return{code:str(x.code),type:nullable(x.type),name:str(x.name)}}).filter(x=>x.code)},register:{rows:arr(register.rows).map(v=>{const x=obj(v);return{id:str(x.id),policy_no:str(x.policy_no),policy_type:str(x.policy_type),start_date:str(x.start_date),end_date:str(x.end_date),status:str(x.status),customer_name:str(x.customer_name),customer_code:str(x.customer_code),vehicle_no:str(x.vehicle_no),insurer_name:str(x.insurer_name),rm_name:str(x.rm_name),intermediary_type:nullable(x.intermediary_type),intermediary_code:nullable(x.intermediary_code),gross_premium:num(x.gross_premium),days_to_expiry:num(x.days_to_expiry),renewal_bucket:bucket(str(x.renewal_bucket))??"expired"}}),total_count:num(register.total_count),page:num(register.page)||page,page_size:num(register.page_size)||pageSize}}; }
function normalizeRmOptions(value:unknown):Array<{id:string;name:string}>{return arr(value).map(v=>{const x=obj(v);return{id:str(x.id),name:str(x.name)}}).filter((x):x is {id:string;name:string}=>Boolean(x.id&&x.name))}
function emptyRenewalReport(page:number,pageSize:number):RenewalReport{return{summary:{upcoming_policy_count:0,expired_policy_count:0,due_30_count:0,due_90_count:0,customer_count:0,premium_at_risk:0,premium_due_30:0,nearest_expiry:null},buckets:[],insurers:[],rms:[],filters:{insurers:[],rms:[],intermediaries:[]},register:{rows:[],total_count:0,page,page_size:pageSize}}}
function horizon(v:string|undefined):RenewalFilters["horizonDays"]{const n=Number(v);return n===30||n===60||n===90||n===180||n===365?n:365}
function bucket(v:string|undefined):RenewalBucket|null{return v==="expired"||v==="due_30"||v==="due_31_60"||v==="due_61_90"||v==="due_91_180"||v==="due_181_365"?v:null}
function uuid(v:string|undefined){return v&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v)?v:null}
function text(v:string|undefined,max:number){const x=v?.trim();return x?x.slice(0,max):null}
function positiveInt(v:string|undefined){const n=Number.parseInt(v??"1",10);return Number.isFinite(n)&&n>0?n:1}
function arr(v:unknown):unknown[]{return Array.isArray(v)?v:[]}
function obj(v:unknown):Record<string,unknown>{return v&&typeof v==="object"&&!Array.isArray(v)?v as Record<string,unknown>: {}}
function str(v:unknown){return typeof v==="string"?v:v==null?"":String(v)}
function nullable(v:unknown){const x=str(v).trim();return x||null}
function num(v:unknown){const n=typeof v==="number"?v:Number(v??0);return Number.isFinite(n)?n:0}