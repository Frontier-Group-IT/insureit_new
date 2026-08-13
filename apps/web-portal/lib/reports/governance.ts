import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

export type GovernanceQuery={period?:string;from?:string;to?:string;action?:string;page?:string};
export type GovernanceFilters={period:"30d"|"90d"|"ytd"|"all"|"custom";fromDate:string|null;toDate:string|null;action:string|null;page:number};
export type GovernanceReport={
 summary:{profile_count:number;active_profile_count:number;inactive_profile_count:number;active_employee_override_count:number;role_override_count:number;permission_change_count:number;audit_event_count:number};
 role_distribution:Array<{role:string;profile_count:number}>;
 override_breakdown:Array<{access_level:string;scope_type:string;override_count:number}>;
 active_overrides:Array<{id:string;profile_id:string;profile_name:string;profile_role:string;capability:string;access_level:string;scope_type:string;reason:string|null;expires_at:string|null;updated_at:string}>;
 permission_changes:Array<{id:string;created_at:string;target_profile_id:string|null;target_name:string;target_role:string|null;capability:string|null;previous_access:string|null;new_access:string|null;previous_scope:string|null;new_scope:string|null;change_type:string|null;reason:string|null;changed_by_name:string}>;
 audit_actions:Array<{action:string;event_count:number}>;
 audit_register:{rows:Array<{id:string;created_at:string;action:string;table_name:string|null;record_id:string|null;actor_name:string}>;total_count:number;page:number;page_size:number};
};

export async function loadGovernanceReport(query:GovernanceQuery){
 const filters=resolveGovernanceFilters(query); const admin=createSupabaseAdminClient();
 const {data,error}=await admin.rpc("get_governance_report",{p_from_date:filters.fromDate,p_to_date:filters.toDate,p_action:filters.action,p_page:filters.page,p_page_size:25});
 if(error)throw new Error(`Governance report query failed: ${error.message}`);
 return {report:normalize(data,filters.page),filters};
}

export function resolveGovernanceFilters(query:GovernanceQuery):GovernanceFilters{
 const period=isPeriod(query.period)?query.period:"30d"; const today=indiaDate(new Date()); const base=new Date(`${today}T00:00:00+05:30`);
 let fromDate:string|null=null,toDate:string|null=today;
 if(period==="30d")fromDate=indiaDate(addDays(base,-29));
 if(period==="90d")fromDate=indiaDate(addDays(base,-89));
 if(period==="ytd")fromDate=`${today.slice(0,4)}-01-01`;
 if(period==="all")toDate=null;
 if(period==="custom"){fromDate=validDate(query.from);toDate=validDate(query.to)}
 if(fromDate&&toDate&&fromDate>toDate)[fromDate,toDate]=[toDate,fromDate];
 return {period,fromDate,toDate,action:clean(query.action,120),page:positive(query.page)};
}

function normalize(value:unknown,page:number):GovernanceReport{
 const raw=obj(value),summary=obj(raw.summary),audit=obj(raw.audit_register);
 return {
  summary:{profile_count:num(summary.profile_count),active_profile_count:num(summary.active_profile_count),inactive_profile_count:num(summary.inactive_profile_count),active_employee_override_count:num(summary.active_employee_override_count),role_override_count:num(summary.role_override_count),permission_change_count:num(summary.permission_change_count),audit_event_count:num(summary.audit_event_count)},
  role_distribution:arr(raw.role_distribution).map(x=>{const i=obj(x);return{role:str(i.role),profile_count:num(i.profile_count)}}),
  override_breakdown:arr(raw.override_breakdown).map(x=>{const i=obj(x);return{access_level:str(i.access_level),scope_type:str(i.scope_type),override_count:num(i.override_count)}}),
  active_overrides:arr(raw.active_overrides).map(x=>{const i=obj(x);return{id:str(i.id),profile_id:str(i.profile_id),profile_name:str(i.profile_name),profile_role:str(i.profile_role),capability:str(i.capability),access_level:str(i.access_level),scope_type:str(i.scope_type),reason:nullable(i.reason),expires_at:nullable(i.expires_at),updated_at:str(i.updated_at)}}),
  permission_changes:arr(raw.permission_changes).map(x=>{const i=obj(x);return{id:str(i.id),created_at:str(i.created_at),target_profile_id:nullable(i.target_profile_id),target_name:str(i.target_name),target_role:nullable(i.target_role),capability:nullable(i.capability),previous_access:nullable(i.previous_access),new_access:nullable(i.new_access),previous_scope:nullable(i.previous_scope),new_scope:nullable(i.new_scope),change_type:nullable(i.change_type),reason:nullable(i.reason),changed_by_name:str(i.changed_by_name)}}),
  audit_actions:arr(raw.audit_actions).map(x=>{const i=obj(x);return{action:str(i.action),event_count:num(i.event_count)}}),
  audit_register:{rows:arr(audit.rows).map(x=>{const i=obj(x);return{id:str(i.id),created_at:str(i.created_at),action:str(i.action),table_name:nullable(i.table_name),record_id:nullable(i.record_id),actor_name:str(i.actor_name)}}),total_count:num(audit.total_count),page:num(audit.page)||page,page_size:num(audit.page_size)||25}
 };
}
function isPeriod(v:string|undefined):v is GovernanceFilters["period"]{return v==="30d"||v==="90d"||v==="ytd"||v==="all"||v==="custom"}
function validDate(v:string|undefined){return v&&/^\d{4}-\d{2}-\d{2}$/.test(v)?v:null}
function clean(v:string|undefined,max:number){const x=v?.trim();return x?x.slice(0,max):null}
function positive(v:string|undefined){const n=Number.parseInt(v??"1",10);return Number.isFinite(n)&&n>0?n:1}
function addDays(d:Date,n:number){const x=new Date(d);x.setDate(x.getDate()+n);return x}
function indiaDate(d:Date){return new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Kolkata",year:"numeric",month:"2-digit",day:"2-digit"}).format(d)}
function arr(v:unknown):unknown[]{return Array.isArray(v)?v:[]}
function obj(v:unknown):Record<string,unknown>{return v&&typeof v==="object"&&!Array.isArray(v)?v as Record<string,unknown>: {}}
function str(v:unknown){return typeof v==="string"?v:v==null?"":String(v)}
function nullable(v:unknown){const x=str(v).trim();return x||null}
function num(v:unknown){const n=typeof v==="number"?v:Number(v??0);return Number.isFinite(n)?n:0}
