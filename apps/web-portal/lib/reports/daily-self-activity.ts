import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { readDailyHistoryPages } from "@/lib/reports/daily-history-source-pages";
import { isValidDailyProfileId, isValidDailyRecordId, selfDateWindow } from "@/lib/reports/daily-history-validation";
import { dailyReportRangeWindow } from "@/lib/reports/daily-report-period";
import { DAILY_ACTIVITY_RECORD_ROUTES, dailyActivityRecordHref } from "@/lib/reports/daily-activity-record-routes";

export type SelfActivity = {
  id: string; category: string; activity: string; reference: string;
  occurredAt: string; status: string; source: "Audit" | "Record history"; detail?: string;
  table?: string; recordId?: string; href?: string|null;
  customerVehicle?: string; insurer?: string;
  vehicleNumber?: string; vehicleCustomer?: string; vehicleMakeModel?: string; vehicleRegistration?: string;
  customerName?: string; customerType?: string; customerMobile?: string;
  customerFleetSize?: string; customerPolicyCount?: number;
  claimControlNo?: string; claimInsurerNo?: string; claimCustomerName?: string; claimVehicleNo?: string;
  subjectEmployeeName?: string;
};
type Audit = { id:string; actor_id:string|null; action:string; table_name:string|null; record_id:string|null; created_at:string };
type Policy = { id:string; created_at:string; policy_no:string|null };
type Intake = { id:string; created_at:string; intake_number:string|null; finalized_at:string|null };
type IntakeFinal = { id:string; finalized_at:string|null; intake_number:string|null };
type Case = { id:string; created_at:string; case_number:string|null; converted_at:string|null };
type CaseFinal = { id:string; converted_at:string|null; case_number:string|null };
type ClaimCreation = { id:string; created_at:string; claim_no:string|null };
type ClaimStageEdit = { id:string; claim_id:string; created_at:string; details:Record<string,unknown>|null };
type ClaimVerification = { id:string; claim_id:string; document_type:string; is_valid:boolean; created_at:string };
type ClaimStatusEvent = { id:string; claim_id:string; created_at:string; from_status:string|null; to_status:string|null };
const MAX_PAGE = 400;
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
  policy_created:"Policy Created",policy_edited:"Policy Updated",vehicle_created:"Vehicle Created",
  vehicle_edited:"Vehicle Updated",customer_created:"Customer Created",customer_edited:"Customer Updated",
  policy_intake_review_started:"Policy Intake Review Started",
  policy_intake_attention_requested:"Policy Intake Attention Requested",
  policy_intake_rejected:"Policy Intake Rejected",
  policy_intake_response_uploaded:"Policy Intake Response Uploaded",
  life_health_case_edited:"Case Edited",life_health_case_remark_added:"Case Remark Added",
  life_health_case_rejected:"Case Rejected",delete_claim:"Claim Deleted",
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
// Display only recognized business-field changes, never an entire audit JSON snapshot.
const CHANGE_FIELDS:Record<string,{label:string;money?:boolean}>={
  addon_premium:{label:"Add-on premium",money:true},
  add_on_premium:{label:"Add-on premium",money:true},
  addon_premium_amount:{label:"Add-on premium",money:true},
  od_premium:{label:"OD premium",money:true},
  tp_premium:{label:"TP premium",money:true},
  net_premium:{label:"Net premium",money:true},
  gross_premium:{label:"Gross premium",money:true},
  premium_amount:{label:"Premium",money:true},
  idv:{label:"IDV",money:true},
  policy_no:{label:"Policy number"},
  policy_number:{label:"Policy number"},
  insurer_name:{label:"Insurer"},
  status:{label:"Status"},
  policy_status:{label:"Policy status"},
};
function auditChangeDetail(oldValue:unknown,newValue:unknown):string|undefined {
  if(!oldValue || !newValue || typeof oldValue!=="object" || typeof newValue!=="object" ||
    Array.isArray(oldValue) || Array.isArray(newValue)) return undefined;
  const before=oldValue as Record<string,unknown>,after=newValue as Record<string,unknown>;
  const changes:string[]=[];
  for(const [key,field] of Object.entries(CHANGE_FIELDS)) {
    if(!(key in before) || !(key in after) || before[key]===after[key]) continue;
    const valid=(v:unknown)=>typeof v==="string" || typeof v==="number" || v===null;
    if(!valid(before[key]) || !valid(after[key])) continue;
    const display=(v:unknown)=>{
      if(v===null || v==="") return "—";
      if(field.money) {
        const n=typeof v==="number"?v:Number(v);
        if(Number.isFinite(n)) return `₹${n.toLocaleString("en-IN",{minimumFractionDigits:2,maximumFractionDigits:2})}`;
      }
      return String(v).slice(0,80);
    };
    changes.push(`${field.label}: ${display(before[key])} → ${display(after[key])}`);
    if(changes.length===3) break;
  }
  return changes.length?changes.join(" · "):undefined;
}


export async function loadSelfActivityHistory(
  viewerId:string, options:{day?:string;from?:string;to?:string;category?:string;page?:string},
) {
  if(!isValidDailyProfileId(viewerId)) throw new Error("Invalid authenticated employee");
  const admin = createSupabaseAdminClient();
  // A temporary name lookup failure must not suppress attributable history.
  const {data:selfProfile,error:selfProfileError} = await admin.from("profiles")
    .select("full_name,employee_code").eq("id",viewerId)
    .maybeSingle<{full_name:string|null;employee_code:string|null}>();
  if(selfProfileError) console.error("[daily-report] employee label unavailable", {code:selfProfileError.code || "request_error"});
  const selfName = selfProfile?.full_name || "Current employee";
  const employeeCode = selfProfile?.employee_code || "";
  const window = options.from || options.to
    ? dailyReportRangeWindow(options.from,options.to)
    : selfDateWindow(options.day);
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
  // Claim operations use actor-attributed history outside the general audit log.
  const loadClaimCreation=(from:number,to:number)=>{
    let q=admin.from("claims").select("id,created_at,claim_no").eq("created_by",viewerId).order("created_at",{ascending:false}).range(from,to);
    if(window) q=q.gte("created_at",window.from).lt("created_at",window.to);
    return q.returns<ClaimCreation[]>();
  };
  const loadClaimStage=(from:number,to:number)=>{
    let q=admin.from("claim_stage_details").select("id,claim_id,created_at,details").eq("created_by",viewerId).order("created_at",{ascending:false}).range(from,to);
    if(window) q=q.gte("created_at",window.from).lt("created_at",window.to);
    return q.returns<ClaimStageEdit[]>();
  };
  const loadClaimVerification=(from:number,to:number)=>{
    let q=admin.from("claim_document_verifications").select("id,claim_id,document_type,is_valid,created_at")
      .eq("verified_by",viewerId).order("created_at",{ascending:false}).range(from,to);
    if(window) q=q.gte("created_at",window.from).lt("created_at",window.to);
    return q.returns<ClaimVerification[]>();
  };
  const loadClaimStatus=(from:number,to:number)=>{
    let q=admin.from("claim_status_history").select("id,claim_id,created_at,from_status,to_status")
      .eq("changed_by",viewerId).order("created_at",{ascending:false}).range(from,to);
    if(window) q=q.gte("created_at",window.from).lt("created_at",window.to);
    return q.returns<ClaimStatusEvent[]>();
  };
  const [audits,policies,intakes,intakeFinals,cases,caseFinals,claimCreations,claimStages,claimVerifications,claimStatuses] = await Promise.all([
    readDailyHistoryPages("Audit logs",loadAudit),readDailyHistoryPages("Policies",loadPolicy),readDailyHistoryPages("Intake submissions",loadIntake),
    readDailyHistoryPages("Intake finalizations",loadIntakeFinal),readDailyHistoryPages("Case creation",loadCase),readDailyHistoryPages("Case conversions",loadCaseFinal),
    readDailyHistoryPages("Claim creation",loadClaimCreation),
    readDailyHistoryPages("Claim stage edits",loadClaimStage),
    readDailyHistoryPages("Claim verification",loadClaimVerification),
    readDailyHistoryPages("Claim status history",loadClaimStatus),
  ]);
  const sources = [
    {name:"Audit logs",result:audits},
    {name:"Policies",result:policies},
    {name:"Intake submissions",result:intakes},
    {name:"Intake finalizations",result:intakeFinals},
    {name:"Case creation",result:cases},
    {name:"Case conversions",result:caseFinals},
    {name:"Claim creation",result:claimCreations},
    {name:"Claim stage edits",result:claimStages},
    {name:"Claim verification",result:claimVerifications},
    {name:"Claim status history",result:claimStatuses},
  ];
  const unavailableSources = sources.filter(s=>s.result.failed).map(s=>s.name);
  const allSourcesUnavailable = unavailableSources.length === sources.length;
  const partial = sources.some(s=>s.result.partial) || Boolean(selfProfileError);
  const all:SelfActivity[] = [];
  for(const a of audits.rows) {
    if(!a.actor_id||a.action==="policy_created"||a.action==="life_health_case_created"||a.action==="life_health_case_closed") continue;
    all.push({id:`audit:${a.id}`,category:actionCategory(a.action,a.table_name),
      activity:displayAction(a.action),reference:sourceLabel(a.record_id),
      occurredAt:a.created_at,status:status(a.action),source:"Audit",table:a.table_name??undefined,recordId:a.record_id??undefined});
  }
  for(const a of policies.rows) all.push({id:`policy:${a.id}`,category:"Policy Add",activity:"Policy Created",reference:a.policy_no||a.id,occurredAt:a.created_at,status:"Created",source:"Record history",table:"policies",recordId:a.id});
  for(const a of intakes.rows) all.push({id:`intake:${a.id}`,category:"Policy Intake",activity:"Policy Intake Submitted",reference:a.intake_number||a.id,occurredAt:a.created_at,status:"Submitted",source:"Record history",table:"policy_intake_requests",recordId:a.id});
  for(const a of intakeFinals.rows) if(a.finalized_at) all.push({id:`intake-final:${a.id}`,category:"Policy Intake",activity:"Policy Intake Finalized",reference:a.intake_number||a.id,occurredAt:a.finalized_at,status:"Completed",source:"Record history",table:"policy_intake_requests",recordId:a.id});
  for(const a of cases.rows) all.push({id:`case:${a.id}`,category:"Policy Edit Case Register",activity:"Case Created",reference:a.case_number||a.id,occurredAt:a.created_at,status:"Created",source:"Record history",table:"life_health_cases",recordId:a.id});
  for(const a of caseFinals.rows) if(a.converted_at) all.push({id:`case-final:${a.id}`,category:"Policy Edit Case Register",activity:"Case Converted",reference:a.case_number||a.id,occurredAt:a.converted_at,status:"Completed",source:"Record history",table:"life_health_cases",recordId:a.id});
  // The unique source record ID keeps the report stable across reloads.
  for(const claim of claimCreations.rows) all.push({
    id:`claim-created:${claim.id}`,category:"Claims",activity:"Claim Created",
    reference:claim.claim_no||claim.id,occurredAt:claim.created_at,status:"Created",
    source:"Record history",table:"claims",recordId:claim.id,
  });
  const previousDriverByClaim=new Map<string,string>();
  for(const edit of [...claimStages.rows].reverse()) {
    const driver=typeof edit.details?.driver_name==="string"?edit.details.driver_name.trim().slice(0,80):"";
    const previous=previousDriverByClaim.get(edit.claim_id);
    if(driver) previousDriverByClaim.set(edit.claim_id,driver);
    all.push({
      id:`claim-stage:${edit.id}`,category:"Claims",
      activity:driver?(previous&&previous!==driver?"Driver Name Updated":previous===driver?"Claim Details Updated":"Driver Name Recorded"):"Claim Details Updated",
      reference:edit.claim_id,occurredAt:edit.created_at,status:"Updated",source:"Record history",
      table:"claims",recordId:edit.claim_id,
      detail:driver&&previous&&previous!==driver?`Driver name: ${previous} → ${driver}`:
        driver&&!previous?"Driver name recorded":undefined,
    });
  }
  for(const verification of claimVerifications.rows) {
    const documentType=verification.document_type.trim().slice(0,70)||"Claim document";
    all.push({
      id:`claim-verify:${verification.id}`,category:"Claims",
      activity:verification.is_valid?`${documentType} Verified`:`${documentType} Verification Failed`,
      reference:verification.claim_id,occurredAt:verification.created_at,
      status:verification.is_valid?"Verified":"Rejected",source:"Record history",
      table:"claims",recordId:verification.claim_id,
    });
  }
  // Same-status history often describes the same verification/stage save.
  for(const event of claimStatuses.rows) {
    if(!event.from_status||!event.to_status||event.from_status===event.to_status) continue;
    all.push({
      id:`claim-status:${event.id}`,category:"Claims",activity:"Claim Status Updated",
      reference:event.claim_id,occurredAt:event.created_at,status:"Updated",source:"Record history",
      table:"claims",recordId:event.claim_id,
      detail:`Status: ${event.from_status.slice(0,80)} → ${event.to_status.slice(0,80)}`,
    });
  }
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
    const ids=[...new Set(visible.filter(x=>x.table===table&&isValidDailyRecordId(x.recordId??"")).map(x=>x.recordId as string))];
    if(!ids.length) continue;
    const {data,error}=await admin.from(table).select(`id,${column}`).in("id",ids);
    if(error) continue;
    const lookup = new Map<string,string>();
    for(const item of (data??[]) as unknown as Record<string,unknown>[]) {
      if(typeof item.id==="string" && typeof item[column]==="string") lookup.set(item.id,item[column] as string);
    }
    for(const row of visible) if(row.table===table && row.recordId && lookup.has(row.recordId)) row.reference=lookup.get(row.recordId)!;
  }
  // Resolve the affected employee rather than the person performing the action.
  // These are only the already-authorized, visible audit rows.
  if(category==="Other Activities") {
    const employeeIds=[...new Set(visible.filter(row=>row.table==="employees"&&isValidDailyRecordId(row.recordId??"")).map(row=>row.recordId as string))];
    const profileIds=[...new Set(visible.filter(row=>["profiles","auth.users"].includes(row.table??"")&&isValidDailyRecordId(row.recordId??"")).map(row=>row.recordId as string))];
    const [employeeResult,profileResult]=await Promise.all([
      employeeIds.length?admin.from("employees").select("id,full_name").in("id",employeeIds):Promise.resolve({data:[],error:null}),
      profileIds.length?admin.from("profiles").select("id,full_name,employee_id").in("id",profileIds):Promise.resolve({data:[],error:null}),
    ]);
    if(employeeResult.error||profileResult.error)
      console.error("[daily-report] Other Activities employee lookup unavailable");
    const employeeNames=new Map((employeeResult.data??[]).map(employee=>[employee.id,employee.full_name?.trim()||""]));
    const profileNames=new Map((profileResult.data??[]).map(profile=>[profile.id,profile.full_name?.trim()||""]));
    const linkedEmployeeIds=[...new Set((profileResult.data??[]).map(profile=>profile.employee_id).filter((id):id is string=>typeof id==="string"&&isValidDailyRecordId(id)))];
    if(linkedEmployeeIds.length) {
      const {data:linkedEmployees,error}=await admin.from("employees").select("id,full_name").in("id",linkedEmployeeIds);
      if(error) console.error("[daily-report] linked employee names unavailable");
      else {
        const linkedNames=new Map((linkedEmployees??[]).map(employee=>[employee.id,employee.full_name?.trim()||""]));
        for(const profile of profileResult.data??[])
          if(profile.employee_id&&linkedNames.get(profile.employee_id))
            profileNames.set(profile.id,linkedNames.get(profile.employee_id)!);
      }
    }
    for(const row of visible) {
      if(!row.recordId) continue;
      if(row.table==="employees")row.subjectEmployeeName=employeeNames.get(row.recordId)||undefined;
      else if(row.table==="profiles"||row.table==="auth.users")
        row.subjectEmployeeName=profileNames.get(row.recordId)||undefined;
    }
  }
  // Claims drilldowns display only claim-specific register columns.
  // Lookups remain restricted to already authorized, visible audit records.
  if(category==="Claims"||category.startsWith("Claim ")) {
    const ids=[...new Set(visible.filter(row=>row.table==="claims"&&isValidDailyRecordId(row.recordId??"")).map(row=>row.recordId as string))];
    if(ids.length) {
      const {data,error}=await admin.from("claims")
        .select("id,claim_no,insurer_claim_no,customers(company_name,contact_name),vehicles(vehicle_no)")
        .in("id",ids);
      if(error) console.error("[daily-report] claim detail labels unavailable",{code:error.code||"request_error"});
      else {
        const claimsById=new Map((data??[]).map(claim=>[claim.id,claim]));
        for(const row of visible) {
          if(row.table!=="claims"||!row.recordId) continue;
          const claim=claimsById.get(row.recordId);
          if(!claim) continue;
          row.reference=claim.claim_no||row.reference;
          row.claimControlNo=claim.claim_no||undefined;
          row.claimInsurerNo=claim.insurer_claim_no||undefined;
          row.claimCustomerName=claim.customers?.[0]?.contact_name||claim.customers?.[0]?.company_name||undefined;
          row.claimVehicleNo=claim.vehicles?.[0]?.vehicle_no||undefined;
        }
      }
    }
  }
  // Customer drilldowns use the Customer Register's fields instead of policy context.
  // Resolve only the visible actor-scoped customer records, without changing
  // report counts, filters, or access scope. Mask mobile numbers in the report.
  if(category.startsWith("Customer ")) {
    const ids=[...new Set(visible.filter(row=>row.table==="customers"&&isValidDailyRecordId(row.recordId??"")).map(row=>row.recordId as string))];
    if(ids.length) {
      const {data,error}=await admin.from("customers")
        .select("id,contact_name,phone,fleet_size_band,policies(count),external_policies:external_policies!external_policies_customer_id_fkey(count)")
        .in("id",ids);
      if(error) console.error("[daily-report] customer detail labels unavailable",{code:error.code||"request_error"});
      else {
        const customerMap=new Map((data??[]).map(row=>[row.id,row]));
        const fleetLabels:Record<string,string>={less_than_5:"< 5", "5_to_20":"5-20", "20_to_50":"20-50", more_than_50:"> 50"};
        for(const row of visible) {
          if(row.table!=="customers"||!row.recordId) continue;
          const customer=customerMap.get(row.recordId);
          if(!customer) continue;
          const internalCount=customer.policies?.[0]?.count??0;
          const externalCount=customer.external_policies?.[0]?.count??0;
          row.customerName=customer.contact_name||undefined;
          row.customerType=externalCount>0&&internalCount===0?"External":"Internal";
          row.customerMobile=customer.phone?.replace(/\d(?=\d{4,})/g,"•")||undefined;
          row.customerFleetSize=customer.fleet_size_band?(fleetLabels[customer.fleet_size_band]||customer.fleet_size_band):undefined;
          row.customerPolicyCount=row.customerType==="External"?externalCount:internalCount;
        }
      }
      // Historical creation rows must survive customer hard-deletion. The
      // original audit remains "customer_created"; label later deletion
      // explicitly rather than silently treating the record as still active.
      const missingIds=error?[]:ids.filter(id=>!(data??[]).some(customer=>customer.id===id));
      if(missingIds.length) {
        const {data:deletions,error:deletionError}=await admin.from("audit_logs")
          .select("record_id,old_data,created_at")
          .eq("table_name","customers").eq("action","delete_customer")
          .in("record_id",missingIds)
          .order("created_at",{ascending:false})
          .limit(300);
        if(deletionError) console.error("[daily-report] deleted customer history unavailable",{code:deletionError.code||"request_error"});
        else {
          const deletionById=new Map<string,{name:string;profileId?:string;phone?:string}>();
          const value=(v:unknown)=>typeof v==="string"&&v.trim()?v.trim():undefined;
          for(const deletion of deletions??[]) {
            if(!deletion.record_id||deletionById.has(deletion.record_id))continue;
            const historical=deletion.old_data;
            if(!historical||typeof historical!=="object"||Array.isArray(historical))continue;
            const old=historical as Record<string,unknown>;
            const name=value(old.contact_name);
            if(!name)continue;
            deletionById.set(deletion.record_id,{name,profileId:value(old.profile_id),phone:value(old.phone)});
          }
          // A retained profile is usable only when its name exactly matches
          // the deletion audit's affected customer. Never use the actor profile.
          const profileIds=[...new Set([...deletionById.values()].map(item=>item.profileId).filter((id):id is string=>typeof id==="string"&&isValidDailyRecordId(id)))];
          const {data:profiles,error:profileError}=profileIds.length
            ? await admin.from("profiles").select("id,full_name,phone").in("id",profileIds)
            : {data:[],error:null};
          if(profileError)console.error("[daily-report] deleted customer profile contact unavailable",{code:profileError.code||"request_error"});
          const profilesById=new Map((profiles??[]).map(item=>[item.id,item]));
          // Some historic edit audits retained a customer phone, but only use
          // it if the audited snapshot identifies the same deleted customer.
          const remainingIds=[...deletionById.entries()].filter(([,item])=>{
            const profile=item.profileId?profilesById.get(item.profileId):undefined;
            return !item.phone&&!(profile?.phone&&profile.full_name?.trim().toLocaleLowerCase()===item.name.toLocaleLowerCase());
          }).map(([id])=>id);
          const {data:edits,error:editError}=remainingIds.length
            ? await admin.from("audit_logs").select("record_id,old_data,new_data,created_at")
              .eq("table_name","customers").eq("action","customer_edited")
              .in("record_id",remainingIds).order("created_at",{ascending:false}).limit(300)
            : {data:[],error:null};
          if(editError)console.error("[daily-report] deleted customer historical edits unavailable",{code:editError.code||"request_error"});
          const editedPhone=new Map<string,string>();
          for(const edit of edits??[]) {
            if(!edit.record_id||editedPhone.has(edit.record_id))continue;
            const snapshot=edit.new_data&&typeof edit.new_data==="object"&&!Array.isArray(edit.new_data)?edit.new_data as Record<string,unknown>:null;
            const previous=edit.old_data&&typeof edit.old_data==="object"&&!Array.isArray(edit.old_data)?edit.old_data as Record<string,unknown>:null;
            const deletion=deletionById.get(edit.record_id);
            if(!deletion)continue;
            for(const obj of [snapshot,previous]) {
              if(!obj)continue;
              const auditName=value(obj.contact_name);
              const phone=value(obj.phone);
              if(auditName?.toLocaleLowerCase()===deletion.name.toLocaleLowerCase()&&phone){
                editedPhone.set(edit.record_id,phone);break;
              }
            }
          }
          // The Customer Register defaults records with no external policy
          // relationship to Internal. For hard-deleted rows, only apply the
          // classification when the original audited creation channel proves
          // direct customer onboarding. Otherwise leave Type unavailable.
          const {data:creations,error:creationError}=await admin.from("audit_logs")
            .select("record_id,new_data,created_at")
            .eq("table_name","customers").eq("action","customer_created")
            .in("record_id",[...deletionById.keys()])
            .order("created_at",{ascending:true}).limit(300);
          if(creationError)console.error("[daily-report] deleted customer origin unavailable",{code:creationError.code||"request_error"});
          const directOnboardingIds=new Set<string>();
          for(const creation of creations??[]) {
            if(!creation.record_id)continue;
            const snapshot=creation.new_data;
            if(snapshot&&typeof snapshot==="object"&&!Array.isArray(snapshot)
              &&(snapshot as Record<string,unknown>).creation_channel==="direct_customer_onboarding")
              directOnboardingIds.add(creation.record_id);
          }
          const maskPhone=(phone:string)=>phone.replace(/\d(?=\d{4,})/g,"•");
          for(const row of visible) {
            if(row.table!=="customers"||!row.recordId)continue;
            const deletion=deletionById.get(row.recordId);
            if(!deletion)continue;
            const profile=deletion.profileId?profilesById.get(deletion.profileId):undefined;
            const profilePhone=profile?.full_name?.trim().toLocaleLowerCase()===deletion.name.toLocaleLowerCase()?value(profile.phone):undefined;
            row.customerName=deletion.name;
            if(directOnboardingIds.has(row.recordId))row.customerType="Internal";
            const phone=deletion.phone||profilePhone||editedPhone.get(row.recordId);
            row.customerMobile=phone?maskPhone(phone):undefined;
            // All other historical category values remain unavailable unless
            // a reliable record-origin classification has been verified.
            if(row.activity==="Customer Created")row.activity="Customer Deleted";
            row.status="Deleted";
          }
        }
      }
    }
  }
  // Enrich only the currently visible employee-scoped activities. Do not expose
  // entire customer, policy or audit records, and never widen history access.
  const policyIds=[...new Set(visible.filter(row=>row.table==="policies"&&isValidDailyRecordId(row.recordId??"")).map(row=>row.recordId as string))];
  const caseIds=[...new Set(visible.filter(row=>row.table==="life_health_cases"&&isValidDailyRecordId(row.recordId??"")).map(row=>row.recordId as string))];
  const intakeIds=[...new Set(visible.filter(row=>row.table==="policy_intake_requests"&&isValidDailyRecordId(row.recordId??"")).map(row=>row.recordId as string))];
  type Context={customerId?:string|null;vehicleId?:string|null;insurerId?:string|null;product?:string|null;linkedPolicyId?:string|null};
  const contextByRecord=new Map<string,Context>();
  const [policyContext,caseContext,intakeContext]=await Promise.all([
    policyIds.length?admin.from("policies").select("id,customer_id,vehicle_id,insurance_company_id,policy_product,policy_type").in("id",policyIds):Promise.resolve({data:[],error:null}),
    caseIds.length?admin.from("life_health_cases").select("id,customer_id,insurance_company_id,product_name,final_policy_id").in("id",caseIds):Promise.resolve({data:[],error:null}),
    intakeIds.length?admin.from("policy_intake_requests").select("id,matched_customer_id,final_policy_id,policy_type").in("id",intakeIds):Promise.resolve({data:[],error:null}),
  ]);
  if(policyContext.error||caseContext.error||intakeContext.error)
    console.error("[daily-report] activity context partially unavailable");
  for(const item of policyContext.data??[]) contextByRecord.set(`policies:${item.id}`,{customerId:item.customer_id,vehicleId:item.vehicle_id,insurerId:item.insurance_company_id,product:item.policy_product||item.policy_type});
  for(const item of caseContext.data??[]) contextByRecord.set(`life_health_cases:${item.id}`,{customerId:item.customer_id,insurerId:item.insurance_company_id,product:item.product_name,linkedPolicyId:item.final_policy_id});
  for(const item of intakeContext.data??[]) contextByRecord.set(`policy_intake_requests:${item.id}`,{customerId:item.matched_customer_id,product:item.policy_type,linkedPolicyId:item.final_policy_id});
  // Finalized intakes/cases can resolve their insurer and vehicle from their linked policy.
  const linkedIds=[...new Set([...contextByRecord.values()].map(x=>x.linkedPolicyId).filter((x):x is string=>typeof x==="string"&&isValidDailyRecordId(x)))];
  if(linkedIds.length) {
    const {data,error}=await admin.from("policies").select("id,customer_id,vehicle_id,insurance_company_id,policy_product").in("id",linkedIds);
    if(!error) {
      const links=new Map((data??[]).map(x=>[x.id,x]));
      for(const ctx of contextByRecord.values()) {
        const policy=ctx.linkedPolicyId?links.get(ctx.linkedPolicyId):undefined;
        if(policy) {ctx.customerId ||=policy.customer_id;ctx.vehicleId ||=policy.vehicle_id;ctx.insurerId ||=policy.insurance_company_id;ctx.product ||=policy.policy_product;}
      }
    }
  }
  const contextValues=[...contextByRecord.values()];
  const customerIds=[...new Set(contextValues.map(x=>x.customerId).filter((x):x is string=>typeof x==="string"&&isValidDailyRecordId(x)))];
  const vehicleIds=[...new Set(contextValues.map(x=>x.vehicleId).filter((x):x is string=>typeof x==="string"&&isValidDailyRecordId(x)))];
  const insurerIds=[...new Set(contextValues.map(x=>x.insurerId).filter((x):x is string=>typeof x==="string"&&isValidDailyRecordId(x)))];
  const [customers,vehicles,insurers]=await Promise.all([
    customerIds.length?admin.from("customers").select("id,contact_name,company_name,legal_trade_name").in("id",customerIds):Promise.resolve({data:[],error:null}),
    vehicleIds.length?admin.from("vehicles").select("id,vehicle_no").in("id",vehicleIds):Promise.resolve({data:[],error:null}),
    insurerIds.length?admin.from("insurance_companies").select("id,name").in("id",insurerIds):Promise.resolve({data:[],error:null}),
  ]);
  if(customers.error||vehicles.error||insurers.error)
    console.error("[daily-report] linked activity labels partially unavailable");
  const customerNames=new Map((customers.data??[]).map(x=>[x.id,x.company_name||x.contact_name||x.legal_trade_name||""]));
  const vehicleNumbers=new Map((vehicles.data??[]).map(x=>[x.id,x.vehicle_no||""]));
  const insurerNames=new Map((insurers.data??[]).map(x=>[x.id,x.name||""]));
  for(const row of visible) {
    const ctx=row.table&&row.recordId?contextByRecord.get(`${row.table}:${row.recordId}`):undefined;
    if(!ctx) continue;
    row.insurer=(ctx.insurerId&&insurerNames.get(ctx.insurerId))||undefined;
    row.customerVehicle=[
      (ctx.customerId&&customerNames.get(ctx.customerId))||"",
      (ctx.vehicleId&&vehicleNumbers.get(ctx.vehicleId))||ctx.product||"",
    ].filter(Boolean).join(" · ")||undefined;
  }
  // Vehicle activity columns mirror the Vehicle Register, but are read-only.
  // Enrich only visible actor-scoped history rows, never a general vehicle list.
  const activityVehicleIds=[...new Set(visible
    .filter(row=>row.category.startsWith("Vehicle ") && row.table==="vehicles" && isValidDailyRecordId(row.recordId??""))
    .map(row=>row.recordId as string))];
  if(activityVehicleIds.length) {
    const {data:vehicleDetails,error:vehicleError}=await admin.from("vehicles")
      .select("id,vehicle_no,vehicle_type,make,model,registration_status,customer_id")
      .in("id",activityVehicleIds);
    if(vehicleError) console.error("[daily-report] vehicle activity labels unavailable",{code:vehicleError.code||"request_error"});
    else {
      const linkedVehicleCustomers=[...new Set((vehicleDetails??[])
        .map(vehicle=>vehicle.customer_id)
        .filter((id):id is string=>typeof id==="string"&&isValidDailyRecordId(id)))];
      const {data:vehicleCustomers,error:customerError}=linkedVehicleCustomers.length
        ? await admin.from("customers").select("id,contact_name").in("id",linkedVehicleCustomers)
        : {data:[],error:null};
      if(customerError) console.error("[daily-report] vehicle customer labels unavailable",{code:customerError.code||"request_error"});
      const names=new Map((vehicleCustomers??[]).map(customer=>[customer.id,customer.contact_name||""]));
      const vehiclesById=new Map((vehicleDetails??[]).map(vehicle=>[vehicle.id,vehicle]));
      for(const row of visible) {
        if(!row.category.startsWith("Vehicle ") || row.table!=="vehicles" || !row.recordId) continue;
        const vehicle=vehiclesById.get(row.recordId);
        if(!vehicle) continue; // Deleted vehicle: do not substitute the UUID.
        row.vehicleNumber=vehicle.vehicle_no||undefined;
        row.vehicleCustomer=names.get(vehicle.customer_id)||undefined;
        row.vehicleMakeModel=[vehicle.make,vehicle.model].filter(Boolean).join(" ")||undefined;
        const number=(vehicle.vehicle_no||"").toUpperCase();
        row.vehicleRegistration=(vehicle.registration_status==="registration_pending"
          ||number.startsWith("NEW-")||number.startsWith("PENDING-"))?"RC pending":"Registered";
      }
    }
  }
  // Only the already-visible, scoped audit rows may receive field-level details.
  // No audit payload is serialized to the client.
  const visibleAuditIds=visible.filter(row=>row.id.startsWith("audit:"))
    .map(row=>row.id.slice("audit:".length)).filter(isValidDailyRecordId);
  if(visibleAuditIds.length) {
    const {data:changes,error:changesError}=await admin.from("audit_logs")
      .select("id,old_data,new_data").eq("actor_id",viewerId).in("id",visibleAuditIds)
      .returns<{id:string;old_data:unknown;new_data:unknown}[]>();
    if(changesError) console.error("[daily-report] audit change details unavailable",{code:changesError.code || "request_error"});
    else {
      const changeMap=new Map((changes??[]).map(item=>[item.id,item]));
      for(const row of visible) {
        if(!row.id.startsWith("audit:")) continue;
        const change=changeMap.get(row.id.slice("audit:".length));
        if(!change) continue;
        row.detail=auditChangeDetail(change.old_data,change.new_data);
        if(row.table==="claims" && row.status==="Deleted") {
          // Name belongs to the ORIGINAL claim creator, not the deleting actor.
          // Historic audits without captured creator metadata cannot be attributed.
          const snapshot=change.old_data;
          const owner=(snapshot && typeof snapshot==="object" && !Array.isArray(snapshot))
            ? (snapshot as Record<string,unknown>).claim_created_by_name : undefined;
          const ownerName=typeof owner==="string"?owner.trim().slice(0,100):"";
          row.activity=ownerName?`${ownerName} Claim Deleted`:"Claim Deleted — Name Unavailable";
          // Deleted claims no longer exist in the master table. Only reuse
          // explicitly saved, non-empty claim identifiers from this actor's audit.
          const old=change.old_data;
          if(old && typeof old==="object" && !Array.isArray(old)) {
            const previous=old as Record<string,unknown>;
            const label=(value:unknown)=>typeof value==="string"&&value.trim()?value.trim().slice(0,100):undefined;
            row.claimControlNo ||=label(previous.claim_no);
            row.claimInsurerNo ||=label(previous.insurer_claim_no);
          }
        }
      }
    }
  }
  // Validate the currently visible records before creating any detail-page links.
  // Displayed references and audit table names must never become URL paths.
  await Promise.all(Object.keys(DAILY_ACTIVITY_RECORD_ROUTES).map(async table=>{
    const ids=[...new Set(visible
      .filter(row=>row.table===table && isValidDailyRecordId(row.recordId??""))
      .map(row=>row.recordId as string))];
    if(!ids.length) return;
    const {data,error}=await admin.from(table).select("id").in("id",ids);
    if(error) return;
    const existing=new Set((data??[]).map(record=>record.id));
    for(const row of visible) {
      if(row.table===table && row.recordId && existing.has(row.recordId))
        row.href=dailyActivityRecordHref(table,row.recordId);
    }
  }));
  return {selfName,employeeCode,categories,category,rows:visible,page,hasNext:filtered.length>start+30,
    total:all.length,selectedCount:filtered.length,partial,unavailableSources,allSourcesUnavailable,
    day:window?options.day??"":""};
}
