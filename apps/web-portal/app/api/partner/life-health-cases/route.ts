import { NextResponse } from "next/server";
import { createSupabaseWithAccessToken } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { hasEffectiveCapability } from "@/lib/effective-permissions";
import { getEffectivePermission } from "@/lib/permission-management";
import { isAppRole } from "@/lib/roles";
import { canAccessPolicy } from "@/lib/policy-access-scope";
import { recordDailyWorkflowActivity } from "@/lib/daily-workflow-audit";
import { getOperationsHeadDownlinePolicyScope, operationsHeadVisiblePolicyFilter, canAccessOperationsHeadCase } from "@/lib/policy-access-scope";

// Read-only counterpart of the Operations Life/Health Case Register.
// Mutations deliberately remain in the canonical Operations workflow until
// their server-action validation can be shared with bearer-token requests.
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store" };
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
type Profile = { id: string; role: string; employee_id: string | null; is_active: boolean };
type CaseRow = {
 id:string;case_number:string;business_line:string;status:string;sourcing_date:string;
 customer_id:string;insurance_company_id:string;product_name:string;proposal_number:string;
 premium_paying_term:string|null;policy_duration:string|null;payment_frequency:string;
 payment_mode:string;premium_amount:number;intermediary_type:string|null;intermediary_code:string|null;
 lead_source:string|null;intermediary_mobile:string|null;rm_name:string|null;rm_code:string|null;
 remarks:string|null;final_policy_id:string|null;converted_at:string|null;created_at:string;
 created_by:string|null;converted_by:string|null;details:Record<string,unknown>|null;
};
const columns = "updated_at,id,case_number,business_line,status,sourcing_date,customer_id,insurance_company_id,product_name,proposal_number,premium_paying_term,policy_duration,payment_frequency,payment_mode,premium_amount,intermediary_type,intermediary_code,lead_source,intermediary_mobile,rm_name,rm_code,remarks,final_policy_id,converted_at,created_at,created_by,converted_by,details";
const listColumns = "id,case_number,business_line,status,sourcing_date,customer_id,insurance_company_id,product_name,proposal_number,rm_name,lead_source,premium_amount,created_at,final_policy_id";
const respond = (data:Record<string,unknown>,status=200) => NextResponse.json(data,{status,headers});
const caseStatus = (row:CaseRow) => row.final_policy_id ? "issued" : row.status === "rejected" ? "rejected" : "pending";

async function authorizedEmployee(request: Request) {
 const match = /^Bearer\s+([^\s]+)$/i.exec(request.headers.get("authorization") ?? "");
 if (!match) return null;
 const scoped = createSupabaseWithAccessToken(match[1]);
 const {data:auth,error:authError} = await scoped.auth.getUser(match[1]);
 if (authError || !auth.user) return null;
 const {data:identity,error:identityError} = await scoped.rpc("partner_app_current_identity");
 if (identityError || !identity || identity.actor_kind !== "employee" ||
     identity.profile_id !== auth.user.id || identity.auth_user_id !== auth.user.id) return null;
 const admin = createSupabaseAdminClient();
 const {data:profile,error} = await admin.from("profiles").select("id,role,employee_id,is_active")
   .eq("id",auth.user.id).maybeSingle<Profile>();
 if (error || !profile?.is_active || !profile.employee_id || !isAppRole(profile.role) ||
     profile.role !== identity.role) return null;
 const {data:employee,error:employeeError} = await admin.from("employees").select("employment_status")
   .eq("id",profile.employee_id).maybeSingle<{employment_status:string}>();
 if (employeeError || employee?.employment_status !== "active") return null;
 if (!(await hasEffectiveCapability(profile,"view_policies","view"))) return null;
 if (profile.role !== "operations_head_life") {
   const legacy = await getEffectivePermission(profile.id, profile.role as Parameters<typeof getEffectivePermission>[1], "view_policies");
   const create = await hasEffectiveCapability(profile,"create_policies","edit");
   if (legacy.access !== "edit" && legacy.access !== "approve" && !create) return null;
 }
 return {profile,admin};
}
export async function GET(request:Request) {
 try {
   const actor = await authorizedEmployee(request);
   if (!actor) return respond({ok:false,error:"Case Register is not available for this account."},403);
   const {profile,admin} = actor;
   const url = new URL(request.url);
   const id = url.searchParams.get("id");
   const downline = profile.role === "operations_head_life"
      ? operationsHeadVisiblePolicyFilter(await getOperationsHeadDownlinePolicyScope(profile.id)) : null;
   if (id !== null) {
     if (!uuid.test(id)) return respond({ok:false,error:"Invalid case reference."},400);
     if (profile.role === "operations_head_life" && !(await canAccessOperationsHeadCase(profile.id,id)))
        return respond({ok:false,error:"Case not found."},404);
     let lookup = admin.from("life_health_cases").select(columns).eq("id",id);
     if (downline !== null) {
       if (!downline) return respond({ok:false,error:"Case not found."},404);
       lookup = lookup.or(downline);
     }
     const {data:found,error} = await lookup.maybeSingle<CaseRow>();
     if (error) return respond({ok:false,error:"Unable to load case."},500);
     if (!found) return respond({ok:false,error:"Case not found."},404);
     const [customer,insurer,documents,linkedPolicy,activity] = await Promise.all([
       admin.from("customers").select("id,contact_name,company_name,phone,address,address_street").eq("id",found.customer_id).maybeSingle(),
       admin.from("insurance_companies").select("id,name").eq("id",found.insurance_company_id).maybeSingle(),
       admin.from("life_health_case_documents").select("id,document_type,file_name,created_at,uploaded_by").eq("case_id",id).order("created_at",{ascending:false}),
       found.final_policy_id ? admin.from("policies").select("id,policy_no,policy_code").eq("id",found.final_policy_id).maybeSingle() : Promise.resolve({data:null,error:null}),
       admin.from("audit_logs").select("id,created_at,action").eq("table_name","life_health_cases").eq("record_id",id).in("action",["life_health_case_edited","life_health_case_remark_added"]).order("created_at",{ascending:false}).limit(100),
     ]);
     if ([customer,insurer,documents,linkedPolicy,activity].some(result => result.error))
       return respond({ok:false,error:"Case details are temporarily unavailable."},500);
     const detail = found.details && typeof found.details === "object" && !Array.isArray(found.details) ? found.details : {};
     const rejection = detail.rejection && typeof detail.rejection === "object" && !Array.isArray(detail.rejection) ? detail.rejection as Record<string,unknown> : {};
     // Do not send commercial terms, unrelated internal metadata, or raw audit payloads.
     const {details:ignoredDetails,...safeCase} = found;
     void ignoredDetails;
     return respond({ok:true,case:{
       ...safeCase,status_group:caseStatus(found),
       customer_name:customer.data?.company_name?.trim() || customer.data?.contact_name || "Customer",
       customer_phone:customer.data?.phone || "",
       customer_address:customer.data?.address_street || customer.data?.address || "",
       insurer_name:insurer.data?.name || "Insurer",
       policy_no:linkedPolicy.data?.policy_no || null,
       rejection_reason:typeof rejection.reason === "string" ? rejection.reason.slice(0,2000) : "",
     },documents:documents.data??[],activities:activity.data??[]});
   }
   const status = url.searchParams.get("status") || "pending";
   if (!["pending","rejected","issued","all"].includes(status)) return respond({ok:false,error:"Invalid status."},400);
   const search = (url.searchParams.get("search") || "").trim().toLowerCase().slice(0,120);
   const limit = Math.min(50,Math.max(1,Number(url.searchParams.get("limit") || "10") || 10));
   const offset = Number(url.searchParams.get("offset") || "0");
   if (!Number.isSafeInteger(offset) || offset < 0) return respond({ok:false,error:"Invalid page."},400);
   // Mirror the Operations register's current 500-record window, including
   // cross-status search; paginate only after server-side filtering.
   let query = admin.from("life_health_cases").select(listColumns).order("created_at",{ascending:false}).limit(500);
   if (downline !== null) {
     if (!downline) return respond({ok:true,cases:[],counts:{pending:0,rejected:0,issued:0,all:0},total:0});
     query = query.or(downline);
   }
   const {data:rows,error} = await query.returns<CaseRow[]>();
   if (error) return respond({ok:false,error:"Unable to load Case Register."},500);
   const all = rows ?? [];
   const customerIds = [...new Set(all.map(row=>row.customer_id))];
   const insurerIds = [...new Set(all.map(row=>row.insurance_company_id))];
   const [customers,insurers] = await Promise.all([
     customerIds.length ? admin.from("customers").select("id,contact_name,company_name,phone").in("id",customerIds) : Promise.resolve({data:[],error:null}),
     insurerIds.length ? admin.from("insurance_companies").select("id,name").in("id",insurerIds) : Promise.resolve({data:[],error:null}),
   ]);
   if (customers.error || insurers.error) return respond({ok:false,error:"Unable to load Case Register details."},500);
   const customerMap = new Map((customers.data??[]).map(row=>[row.id,row]));
   const insurerMap = new Map((insurers.data??[]).map(row=>[row.id,row.name]));
   const result = all.map(row=>{
     const customer=customerMap.get(row.customer_id);
     return {
       id:row.id,case_number:row.case_number,business_line:row.business_line,status_group:caseStatus(row),
       customer_name:customer?.company_name?.trim() || customer?.contact_name || "Customer",
       customer_phone:customer?.phone || "", insurer_name:insurerMap.get(row.insurance_company_id)||"Insurer",
       product_name:row.product_name,proposal_number:row.proposal_number,sourcing_date:row.sourcing_date,
       rm_name:row.rm_name||"",lead_source:row.lead_source||"",premium_amount:Number(row.premium_amount||0),
       created_at:row.created_at,final_policy_id:row.final_policy_id,
     };
   });
   const counts={pending:0,rejected:0,issued:0,all:result.length};
   for (const row of result) counts[row.status_group as "pending"|"rejected"|"issued"]++;
   const visible = result.filter(row=>(status==="all" || row.status_group===status) &&
      (!search || [row.case_number,row.customer_name,row.customer_phone,row.insurer_name,row.product_name,
        row.proposal_number,row.rm_name,row.lead_source,row.status_group].some(value=>String(value).toLowerCase().includes(search))));
   return respond({ok:true,cases:visible.slice(offset,offset+limit),counts,total:visible.length});
 } catch {
   return respond({ok:false,error:"Case Register is temporarily unavailable."},500);
 }
}

// Authenticated native Case Register editing. No unchecked service-role writes:
// only approved pending-case fields, or an issued policy's linked customer details.
// Policy number, dates, insurer, premiums and commercial terms of issued policies
// remain under the existing Operations issued-policy editor/OTP workflow.
export async function POST(request: Request) {
 try {
  const actor=await authorizedEmployee(request);
  if(!actor)return respond({ok:false,error:"Case Register editing is unavailable for this account."},403);
  const {profile,admin}=actor;
  const input=await request.json().catch(()=>null) as Record<string,unknown>|null;
  const id=typeof input?.id==="string"?input.id:"";
  if(!uuid.test(id))return respond({ok:false,error:"Invalid case reference."},400);
  const {data:row,error:loadError}=await admin.from("life_health_cases")
   .select("id,status,final_policy_id,customer_id,product_name,proposal_number,premium_paying_term,policy_duration,payment_frequency,payment_mode,premium_amount,sourcing_date,insurance_company_id,remarks,updated_at")
   .eq("id",id).maybeSingle();
  if(loadError||!row)return respond({ok:false,error:"Case not found."},404);
  if(row.status==="rejected")return respond({ok:false,error:"Rejected cases cannot be edited."},409);
  const issued=Boolean(row.final_policy_id);
  const remarkMode=input?.action==="append_remark";
  if(remarkMode&&issued)return respond({ok:false,error:"Issued cases cannot be edited."},409);
  if(profile.role==="operations_head_life"){
   if(issued){
    if(!(await canAccessPolicy(profile.id,profile.role,row.final_policy_id!,"view_policies",true)))
     return respond({ok:false,error:"You cannot edit this issued policy."},403);
   } else if(!(await canAccessOperationsHeadCase(profile.id,id))){
    return respond({ok:false,error:"This case is outside your authorized scope."},403);
   }
  }else{
   const permission=await getEffectivePermission(profile.id,profile.role as Parameters<typeof getEffectivePermission>[1],"view_policies");
   const creator=await hasEffectiveCapability(profile,"create_policies","edit");
   if(issued ? !["edit","approve"].includes(permission.access) : !["edit","approve"].includes(permission.access)&&!creator)
    return respond({ok:false,error:"Editing permission is required."},403);
  }
  if(issued && !(await canAccessPolicy(profile.id,profile.role,row.final_policy_id!,"view_policies",true)))
   return respond({ok:false,error:"This issued policy is outside your authorized edit scope."},403);
  const clean=(key:string,max=180)=>typeof input?.[key]==="string"?(input[key] as string).trim().slice(0,max):"";
  if(remarkMode){
    const newRemark=clean("newRemark",2001);
    if(!newRemark||newRemark.length>2000)return respond({ok:false,error:"Enter a remark of up to 2000 characters."},400);
    const previous=row.remarks?.trim()??"";
    const timestamp=new Intl.DateTimeFormat("en-IN",{
      timeZone:"Asia/Kolkata",day:"2-digit",month:"short",year:"numeric",
      hour:"2-digit",minute:"2-digit",hour12:true,
    }).format(new Date());
    const updated=previous?`${previous}\n\n[${timestamp}] ${newRemark}`:`[${timestamp}] ${newRemark}`;
    if(updated.length>50000)return respond({ok:false,error:"The remarks history is full."},400);
    let mutation=admin.from("life_health_cases").update({remarks:updated,updated_at:new Date().toISOString()})
      .eq("id",id).is("final_policy_id",null).neq("status","rejected");
    mutation=row.remarks===null?mutation.is("remarks",null):mutation.eq("remarks",row.remarks);
    const {data:saved,error:saveError}=await mutation.select("id").maybeSingle();
    if(saveError||!saved)return respond({ok:false,error:"Remarks changed in another session. Reload and retry."},409);
    await recordDailyWorkflowActivity(admin,{actorId:profile.id,table:"life_health_cases",recordId:id,action:"life_health_case_remark_added"});
    await admin.from("audit_logs").insert({actor_id:profile.id,action:"life_health_case_remark_added",
      table_name:"life_health_cases",record_id:id,new_data:{changed_fields:["Remarks changed (values hidden)"]}});
    return respond({ok:true,remarks:updated});
  }
  if(issued){
   // Issued case is immutable; only the customer information is editable here.
   // Validate case-to-policy link and avoid touching policy issuance or commercials.
   const customerName=clean("customerName",160);
   const phone=clean("customerPhone",25).replace(/\D/g,"");
   const address=clean("customerAddress",1000);
   if(!customerName||!/^[6-9]\d{9}$/.test(phone))return respond({ok:false,error:"Enter a customer name and valid 10-digit mobile."},400);
   const {data:linked}=await admin.from("life_health_cases").select("customer_id")
    .eq("id",id).eq("final_policy_id",row.final_policy_id!).maybeSingle();
   if(!linked?.customer_id)return respond({ok:false,error:"Issued policy link changed. Reload the case."},409);
   const {error}=await admin.from("customers").update({
     contact_name:customerName,phone,address:address||null,address_street:address||null,updated_at:new Date().toISOString(),
   }).eq("id",linked.customer_id);
   if(error)return respond({ok:false,error:"Customer changes could not be saved."},500);
   await admin.from("audit_logs").insert({actor_id:profile.id,table_name:"life_health_cases",record_id:id,action:"life_health_issued_customer_edited",new_data:{fields:["customer_name","customer_phone","customer_address"],policy_id:row.final_policy_id}});
   return respond({ok:true,scope:"issued_customer"});
  }
  const product=clean("productName",180),proposal=clean("proposalNumber",120).toUpperCase();
  const ppt=clean("premiumPayingTerm",80),pd=clean("policyDuration",80);
  const frequency=clean("paymentFrequency",50),mode=clean("paymentMode",50);
  const premium=Number(input?.premiumAmount);
  const sourcingDate=clean("sourcingDate",10);
  const insurerId=clean("insurerId",40);
  if(!/^\\d{4}-\\d{2}-\\d{2}$/.test(sourcingDate)||!Number.isFinite(Date.parse(sourcingDate)))
    return respond({ok:false,error:"Choose a valid proposal date."},400);
  if(!uuid.test(insurerId))return respond({ok:false,error:"Choose a valid insurer."},400);
  const {data:insurer,error:insurerError}=await admin.from("insurance_companies").select("id").eq("id",insurerId).maybeSingle();
  if(insurerError||!insurer)return respond({ok:false,error:"Insurer was not found."},400);
  if(!product||!proposal||!["Monthly","Quarterly","Half Yearly","Annually","One Time"].includes(frequency)||
    !["Cash","Cheque","NEFT/RTGS","UPI","Credit/Debit Card","Net Banking"].includes(mode)||
    !Number.isFinite(premium)||premium<0||premium>100000000000)
    return respond({ok:false,error:"Complete the required proposal, payment and premium fields."},400);
  // Optimistic concurrency: reject stale native edits, rejected/issued transitions.
  const expected=clean("updatedAt",80);
  if(!expected||expected!==row.updated_at)return respond({ok:false,error:"The case changed. Reload before saving."},409);
  const {data:saved,error:saveError}=await admin.from("life_health_cases").update({
    product_name:product,proposal_number:proposal,premium_paying_term:ppt||null,
    policy_duration:pd||null,payment_frequency:frequency,payment_mode:mode,
    premium_amount:premium,sourcing_date:sourcingDate,insurance_company_id:insurerId,updated_at:new Date().toISOString(),
  }).eq("id",id).eq("updated_at",expected).is("final_policy_id",null).neq("status","rejected")
   .select("id").maybeSingle();
  if(saveError||!saved)return respond({ok:false,error:"Case changed or could not be saved. Reload and retry."},409);
  await recordDailyWorkflowActivity(admin,{actorId:profile.id,table:"life_health_cases",recordId:id,action:"life_health_case_edited"});
  return respond({ok:true,scope:"pending_case"});
 }catch{
  return respond({ok:false,error:"Unable to save changes. Please retry."},500);
 }
}
