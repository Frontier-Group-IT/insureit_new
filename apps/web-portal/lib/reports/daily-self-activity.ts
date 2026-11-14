import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase-admin";

export type SelfActivity = {
  id: string; category: string; activity: string; reference: string;
  occurredAt: string; status: string; source: "Audit" | "Record history";
  table?: string; recordId?: string;
};
type Audit = { id:string; actor_id:string|null; action:string; table_name:string|null; record_id:string|null; created_at:string };
type Policy = { id:string; created_at:string; policy_no:string|null };
type Intake = { id:string; created_at:string; intake_number:string|null; finalized_at:string|null };
type IntakeFinal = { id:string; finalized_at:string|null; intake_number:string|null };
type Case = { id:string; created_at:string; case_number:string|null; converted_at:string|null };
type CaseFinal = { id:string; converted_at:string|null; case_number:string|null };
type PageResult<T> = {data:T[]|null;error:{message:string}|null};
type Db = ReturnType<typeof createSupabaseAdminClient>;
const BATCH = 500;
const MAX_ROWS_PER_SOURCE = 12000;
const MAX_PAGE = 400;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function selfDateWindow(day?: string) {
  if (!day || !ISO_DATE.test(day)) return null;
  const start = new Date(`${day}T00:00:00+05:30`);
  if (!Number.isFinite(start.getTime())) return null;
  const p = new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Kolkata",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(start);
  const val = (part:string) => p.find(x => x.type === part)?.value ?? "";
  if (`${val("year")}-${val("month")}-${val("day")}` !== day) return null;
  return {from:start.toISOString(),to:new Date(start.getTime()+86_400_000).toISOString()};
}

async function pageAll<T>(load:(from:number,to:number)=>PromiseLike<PageResult<T>>) {
  const rows:T[] = [];
  // Explicit limit; never silently claim the result is complete if a cap is reached.
  for(let offset=0;offset<MAX_ROWS_PER_SOURCE;offset+=BATCH) {
    const {data,error} = await load(offset, offset+BATCH-1);
    if(error) throw new Error("Could not retrieve employee activity history");
    rows.push(...data??[]);
    if((data??[]).length < BATCH) return {rows,partial:false};
  }
  return {rows,partial:true};
}

function actionCategory(action:string, table:string|null) {
  const name = (table??"").toLowerCase();
  if(name==="policy_intake_requests") return "Policy Intake";
  if(name==="life_health_cases") return "Policy Edit Case Register";
  if(name==="policies" || name.startsWith("policy_")) {
    if(action==="policy_created") return "Policy Add";
    if(/edit|correct|chang|updat/i.test(action)) return "Policy Edit";
    return "Policy Other Activity";
  }
  if(name==="customers") return /creat|add/i.test(action)?"Customer Add":/edit|updat/i.test(action)?"Customer Edit":"Customer Other Activity";
  if(name==="vehicles") return /creat|add/i.test(action)?"Vehicle Add":/edit|updat/i.test(action)?"Vehicle Edit":"Vehicle Other Activity";
  if(name.startsWith("claim")) return "Claims";
  return "Other Activities";
}
const displayAction=(s:string)=>({
  policy_created:"Policy Add",policy_edited:"Policy Edit",vehicle_created:"Vehicle Add",
  vehicle_edited:"Vehicle Edit",customer_created:"Customer Add",customer_edited:"Customer Edit",
  policy_intake_review_started:"Policy Intake Review Started",
  policy_intake_attention_requested:"Policy Intake Attention Requested",
  policy_intake_rejected:"Policy Intake Rejected",
  policy_intake_response_uploaded:"Policy Intake Response Uploaded",
  life_health_case_edited:"Case Edited",life_health_case_remark_added:"Case Remark Added",
  life_health_case_rejected:"Case Rejected",
} as Record<string,string>)[s]??s.replaceAll("_"," ").replace(/\b\w/g,c=>c.toUpperCase());
function status(action:string) {
  if(/reject/i.test(action)) return "Rejected";
  if(/attention/i.test(action)) return "Needs attention";
  if(/upload/i.test(action)) return "Uploaded";
  if(/creat|add/i.test(action)) return "Created";
  if(/edit|updat|chang|correct/i.test(action)) return "Updated";
  if(/delet|remov/i.test(action)) return "Deleted";
  if(/submit/i.test(action)) return "Submitted";
  if(/finaliz|complet|clos/i.test(action)) return "Completed";
  return "Recorded";
}
const sourceLabel = (id:string|null) => id || "—";

export async function loadSelfActivityHistory(
  viewerId:string, options:{day?:string;category?:string;page?:string},
) {
  if(!UUID.test(viewerId)) throw new Error("Invalid authenticated employee");
  const admin = createSupabaseAdminClient();
  const {data: selfProfile,error: selfProfileError} = await admin.from("profiles")
    .select("full_name,employee_code").eq("id",viewerId)
    .maybeSingle<{full_name:string|null;employee_code:string|null}>();
  if(selfProfileError) throw new Error("Could not load employee name");
  const selfName = selfProfile?.full_name || "Current employee";
  const employeeCode = selfProfile?.employee_code || "";
  const window = selfDateWindow(options.day);
  if(options.day && !window) throw new Error("Invalid requested employee activity date");
  const pageRaw = Number(options.page);
  const page = options.page && /^[1-9]\d{0,2}$/.test(options.page) ?
    Math.min(MAX_PAGE,pageRaw):1;
  const loadAudit=(from:number,to:number)=>{
    let q=admin.from("audit_logs").select("id,actor_id,action,table_name,record_id,created_at")
      .eq("actor_id",viewerId).order("created_at",{ascending:false}).range(from,to);
    if(window) q=q.gte("created_at",window.from).lt("created_at",window.to);
    return q.returns<Audit[]>();
  };
  const loadPolicy=(from:number,to:number)=>{
    let q=admin.from("policies").select("id,created_at,policy_no").eq("created_by",viewerId)
      .order("created_at",{ascending:false}).range(from,to);
    if(window) q=q.gte("created_at",window.from).lt("created_at",window.to);
    return q.returns<Policy[]>();
  };
  const loadIntake=(from:number,to:number)=>{
    let q=admin.from("policy_intake_requests").select("id,created_at,intake_number,finalized_at")
      .eq("submitted_by_profile_id",viewerId).order("created_at",{ascending:false}).range(from,to);
    if(window) q=q.gte("created_at",window.from).lt("created_at",window.to);
    return q.returns<Intake[]>();
  };
  const loadIntakeFinal=(from:number,to:number)=>{
    let q=admin.from("policy_intake_requests").select("id,finalized_at,intake_number")
      .eq("finalized_by_profile_id",viewerId).not("finalized_at","is",null)
      .order("finalized_at",{ascending:false}).range(from,to);
    if(window) q=q.gte("finalized_at",window.from).lt("finalized_at",window.to);
    return q.returns<IntakeFinal[]>();
  };
  const loadCase=(from:number,to:number)=>{
    let q=admin.from("life_health_cases").select("id,created_at,case_number,converted_at")
      .eq("created_by",viewerId).order("created_at",{ascending:false}).range(from,to);
    if(window) q=q.gte("created_at",window.from).lt("created_at",window.to);
    return q.returns<Case[]>();
  };
  const loadCaseFinal=(from:number,to:number)=>{
    let q=admin.from("life_health_cases").select("id,converted_at,case_number")
      .eq("converted_by",viewerId).not("converted_at","is",null)
      .order("converted_at",{ascending:false}).range(from,to);
    if(window) q=q.gte("converted_at",window.from).lt("converted_at",window.to);
    return q.returns<CaseFinal[]>();
  };
  const [audits,policies,intakes,intakeFinals,cases,caseFinals] = await Promise.all([
    pageAll(loadAudit),pageAll(loadPolicy),pageAll(loadIntake),
    pageAll(loadIntakeFinal),pageAll(loadCase),pageAll(loadCaseFinal),
  ]);
  const partial = [audits,policies,intakes,intakeFinals,cases,caseFinals].some(x=>x.partial);
  const all:SelfActivity[] = [];
  for(const a of audits.rows) {
    if(!a.actor_id||a.action==="policy_created"||a.action==="life_health_case_created"||a.action==="life_health_case_closed") continue;
    all.push({id:`audit:${a.id}`,category:actionCategory(a.action,a.table_name),
      activity:displayAction(a.action),reference:sourceLabel(a.record_id),
      occurredAt:a.created_at,status:status(a.action),source:"Audit",table:a.table_name??undefined,recordId:a.record_id??undefined});
  }
  for(const a of policies.rows) all.push({id:`policy:${a.id}`,category:"Policy Add",activity:"Policy Add",reference:a.policy_no||a.id,occurredAt:a.created_at,status:"Created",source:"Record history"});
  for(const a of intakes.rows) all.push({id:`intake:${a.id}`,category:"Policy Intake",activity:"Policy Intake Submitted",reference:a.intake_number||a.id,occurredAt:a.created_at,status:"Submitted",source:"Record history"});
  for(const a of intakeFinals.rows) if(a.finalized_at) all.push({id:`intake-final:${a.id}`,category:"Policy Intake",activity:"Policy Intake Finalized",reference:a.intake_number||a.id,occurredAt:a.finalized_at,status:"Completed",source:"Record history"});
  for(const a of cases.rows) all.push({id:`case:${a.id}`,category:"Policy Edit Case Register",activity:"Case Created",reference:a.case_number||a.id,occurredAt:a.created_at,status:"Created",source:"Record history"});
  for(const a of caseFinals.rows) if(a.converted_at) all.push({id:`case-final:${a.id}`,category:"Policy Edit Case Register",activity:"Case Converted",reference:a.case_number||a.id,occurredAt:a.converted_at,status:"Completed",source:"Record history"});
  all.sort((a,b)=>b.occurredAt.localeCompare(a.occurredAt)||a.id.localeCompare(b.id));
  const counts=new Map<string,number>();
  for(const a of all) counts.set(a.category,(counts.get(a.category)??0)+1);
  const priority=["Policy Intake","Policy Add","Policy Edit","Policy Edit Case Register","Customer Add","Customer Edit","Vehicle Add","Vehicle Edit","Claims","Policy Other Activity","Customer Other Activity","Vehicle Other Activity","Other Activities"];
  const categories=[...counts].sort((a,b)=>{
    const ia=priority.indexOf(a[0]),ib=priority.indexOf(b[0]);
    return (ia<0?100:ia)-(ib<0?100:ib)||a[0].localeCompare(b[0]);
  }).map(([name,count])=>({name,count}));
  const category=categories.some(x=>x.name===options.category)?options.category??"": "";
  const filtered=category?all.filter(x=>x.category===category):[];
  const start=(page-1)*30;
  const visible=filtered.slice(start,start+30);
  // Resolve only visible audit references, never fetch unrelated record details.
  const refColumns:{table:string;column:string}[]=[
    {table:"policies",column:"policy_no"},{table:"customers",column:"customer_code"},
    {table:"vehicles",column:"vehicle_no"},{table:"policy_intake_requests",column:"intake_number"},
    {table:"life_health_cases",column:"case_number"},
  ];
  for(const {table,column} of refColumns) {
    const ids=[...new Set(visible.filter(x=>x.table===table&&UUID.test(x.recordId??"")).map(x=>x.recordId as string))];
    if(!ids.length) continue;
    const {data,error}=await admin.from(table).select(`id,${column}`).in("id",ids);
    if(error) continue;
    const lookup = new Map<string,string>();
    for(const item of (data??[]) as unknown as Record<string,unknown>[]) {
      if(typeof item.id==="string" && typeof item[column]==="string") lookup.set(item.id,item[column] as string);
    }
    for(const row of visible) if(row.table===table && row.recordId && lookup.has(row.recordId)) row.reference=lookup.get(row.recordId)!;
  }
  return {selfName,employeeCode,categories,category,rows:visible,page,hasNext:filtered.length>start+30,
    total:all.length,selectedCount:filtered.length,partial,day:window?options.day??"":""};
}
