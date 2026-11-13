import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { StandardActivityStatusCard, type StandardActivityItem } from "@/components/standard-activity-status-card";

type ClaimStatusRow = {id:string;from_status:string|null;to_status:string|null;changed_by:string|null;created_at:string};
type ClaimStageRow = {id:string;stage:string;details:Record<string,unknown>|null;created_by:string|null;created_at:string};
const LABELS: Record<string,string> = {
  estimate_amount:"Estimate amount",bill_amount:"Workshop bill",do_amount:"Delivery order amount",
  payment_received_amount:"Payment received",approval_received_date:"Approval date",
  bill_date:"Billing date",do_date:"Delivery order date",payment_received_date:"Payment received date",
  spot_survey_done_date:"Spot survey date",claim_intimation_date:"Intimation date",
  gate_in_date:"Gate-in date",repair_complete_date:"Repair completion date",
  ri_done_date:"RI completion date",vehicle_received:"Vehicle received",
  cashless:"Cashless",depreciation_slip_submitted:"Depreciation slip submitted",
  satisfaction_voucher_submitted:"Satisfaction voucher submitted",
};
const AMOUNT_FIELDS = new Set(["estimate_amount","bill_amount","do_amount","payment_received_amount"]);
const TRACKED_STAGE_KEYS=new Set(["spot_status","claim_intimation","work_approval","repair_ri","billing","delivery_order","vehicle_delivery","payment_encashment"]);
const format=(key:string,v:unknown)=>{
  if(v===null||v===undefined||v==="")return "Not set";
  if(typeof v==="boolean")return v?"Yes":"No";
  if(AMOUNT_FIELDS.has(key)){
    const n=Number(v);
    return Number.isFinite(n)&&n>=0&&n<=1e10?`₹${n.toLocaleString("en-IN",{minimumFractionDigits:2,maximumFractionDigits:2})}`:"Changed";
  }
  if(typeof v!=="string" && typeof v!=="number")return "Changed";
  const text=String(v).trim();
  return /^(?:\d{4}-\d{2}-\d{2}(?:T[0-9:.Z+-]+)?|Yes|No|true|false)$/.test(text)?text:"Changed";
};
const date=(value:string)=>Number.isNaN(Date.parse(value))?0:Date.parse(value);

/**
 * Read-only, record-scoped Operations Claim activity. Called ONLY after the
 * Claim detail page has checked view_claims + customer/claim read scope.
 * Never expose unrestricted stage JSON or claim-status notes (which can
 * contain phone numbers, email addresses, medical or surveyor details).
 */
export async function ClaimActivityStatus({claimId}:{claimId:string}){
  const admin=createSupabaseAdminClient();
  const [statusResult,stageResult]=await Promise.all([
    admin.from("claim_status_history").select("id,from_status,to_status,changed_by,created_at")
      .eq("claim_id",claimId).order("created_at",{ascending:true}).limit(150).returns<ClaimStatusRow[]>(),
    admin.from("claim_stage_details").select("id,stage,details,created_by,created_at")
      .eq("claim_id",claimId).order("created_at",{ascending:true}).limit(250).returns<ClaimStageRow[]>(),
  ]);
  if(statusResult.error||stageResult.error) return null;
  const statuses=statusResult.data??[];
  const stages=stageResult.data??[];
  const authors=[...new Set([
    ...statuses.map(x=>x.changed_by),...stages.map(x=>x.created_by)
  ].filter((x):x is string=>Boolean(x)))];
  const {data:profiles}=authors.length?await admin.from("profiles").select("id,full_name").in("id",authors):
    {data:[] as {id:string;full_name:string|null}[]};
  const names=new Map((profiles??[]).map(x=>[x.id,x.full_name||"User"]));
  const events:Array<StandardActivityItem & {at:string}> = [];
  for(const status of statuses){
    if(status.from_status===status.to_status)continue;
    events.push({
      id:"status:"+status.id,title:"Claim status updated",at:status.created_at,
      meta:"By: "+(status.changed_by?names.get(status.changed_by)||"User":"Not recorded"),
      changes:[`Status: ${status.from_status||"Not set"} → ${status.to_status||"Not set"}`],
    });
  }
  const lastStage=new Map<string,Record<string,unknown>>();
  for(const row of stages){
    const values=row.details&&typeof row.details==="object"&&!Array.isArray(row.details)?row.details:{};
    const group=typeof values.milestone_key==="string"&&TRACKED_STAGE_KEYS.has(values.milestone_key)
      ?values.milestone_key:"other";
    const before=lastStage.get(group)??{};
    const changes=Object.entries(LABELS)
      .filter(([key])=>key in values && format(key,before[key])!==format(key,values[key]))
      .map(([key,label])=>`${label}: ${format(key,before[key])} → ${format(key,values[key])}`);
    if(changes.length){
      events.push({
        id:"stage:"+row.id,title:group.replaceAll("_"," ").replace(/\b\w/g,v=>v.toUpperCase())+" updated",
        at:row.created_at,meta:"By: "+(row.created_by?names.get(row.created_by)||"User":"Not recorded"),
        changes:changes.slice(0,20),
      });
    }
    lastStage.set(group,{...before,...values});
  }
  events.sort((a,b)=>date(b.at)-date(a.at));
  return <StandardActivityStatusCard items={events.slice(0,100)} emptyText="No recorded Claim activity yet." />;
}
