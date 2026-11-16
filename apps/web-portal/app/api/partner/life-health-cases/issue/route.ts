import {NextResponse} from "next/server";
import {createSupabaseWithAccessToken} from "@/lib/auth";
import {createSupabaseAdminClient} from "@/lib/supabase-admin";
import {hasEffectiveCapability} from "@/lib/effective-permissions";
import {getEffectivePermission} from "@/lib/permission-management";
import {isAppRole} from "@/lib/roles";
import {canAccessOperationsHeadCase} from "@/lib/policy-access-scope";
import {policyDateDecision,POLICY_DATE_APPROVERS} from "@/lib/policy-date-rule";
import {requestPolicyDateApprovalForVerifiedActor,verifyPolicyDateApprovalForVerifiedActor} from "@/lib/policy-date-approval-engine";
import {convertLifeHealthCaseForVerifiedActor} from "@/lib/life-health-case-issuance-engine";

export const dynamic="force-dynamic";
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const fail=(error:string,status:number)=>NextResponse.json({ok:false,error},{status,headers:{"Cache-Control":"private, no-store"}});
const str=(v:unknown,max=160)=>typeof v==="string"?v.trim().slice(0,max):"";

export async function POST(request:Request){
  const bearer=/^Bearer\s+([^\s]+)$/i.exec(request.headers.get("authorization")??"")?.[1];
  if(!bearer)return fail("Partner authentication required.",401);
  const scoped=createSupabaseWithAccessToken(bearer);
  const {data:auth,error:authError}=await scoped.auth.getUser(bearer);
  if(authError||!auth.user)return fail("Partner session expired.",401);
  const {data:identity,error:identityError}=await scoped.rpc("partner_app_current_identity");
  if(identityError||identity?.actor_kind!=="employee"||identity.profile_id!==auth.user.id||
    identity.auth_user_id!==auth.user.id)return fail("Partner employee identity required.",403);
  const admin=createSupabaseAdminClient();
  const {data:profile,error:profileError}=await admin.from("profiles")
    .select("id,role,employee_id,is_active,full_name").eq("id",auth.user.id)
    .maybeSingle<{id:string;role:string;employee_id:string|null;is_active:boolean;full_name:string|null}>();
  if(profileError||!profile?.is_active||!profile.employee_id||!isAppRole(profile.role)||
     identity.role!==profile.role)return fail("Active Partner employee required.",403);
  const {data:employee,error:empError}=await admin.from("employees").select("employment_status")
    .eq("id",profile.employee_id).maybeSingle<{employment_status:string}>();
  if(empError||employee?.employment_status!=="active")return fail("Inactive employee account.",403);
  const head=profile.role==="operations_head_life";
  if(!head){
    const [create,legacy]=await Promise.all([
      hasEffectiveCapability(profile,"create_policies","edit"),
      getEffectivePermission(profile.id,profile.role,"view_policies"),
    ]);
    if(!create&&!["edit","approve"].includes(legacy.access))return fail("Policy creation permission is required.",403);
  }
  if(!request.headers.get("content-type")?.startsWith("application/json"))return fail("Invalid submission.",400);
  const len=Number(request.headers.get("content-length")||0);
  if(len>12000)return fail("Request is too large.",413);
  const input=await request.json().catch(()=>null) as Record<string,unknown>|null;
  const caseId=str(input?.caseId,50),action=str(input?.action,30);
  if(!uuid.test(caseId))return fail("Invalid case reference.",400);
  if(head&&!(await canAccessOperationsHeadCase(profile.id,caseId)))
    return fail("This case is outside your approved Operations scope.",403);
  const {data:caseRow,error:caseError}=await admin.from("life_health_cases")
    .select("id,status,final_policy_id,intermediary_code")
    .eq("id",caseId).maybeSingle<{id:string;status:string;final_policy_id:string|null;intermediary_code:string|null}>();
  if(caseError||!caseRow)return fail("Case not found.",404);
  if(caseRow.final_policy_id||caseRow.status==="rejected"||caseRow.status==="issued")
    return fail("Issued and rejected cases cannot be issued again.",409);
  const policyNumber=str(input?.policyNumber,120).toUpperCase(),issuanceDate=str(input?.issuanceDate,10);
  if(!policyNumber||!/^\d{4}-\d{2}-\d{2}$/.test(issuanceDate))
    return fail("Policy number and valid issuance date are required.",400);
  const decision=policyDateDecision(issuanceDate);
  if(decision==="invalid"||decision==="future")return fail("Issuance date cannot be invalid or in the future.",400);
  const approvalInput={issuanceDate,policyNumber,operation:"create" as const,
    intermediaryCode:caseRow.intermediary_code??undefined};
  if(action==="approvers"){
    return NextResponse.json({ok:true,approvalRequired:decision==="otp_required",
      approvers:POLICY_DATE_APPROVERS.map(({key,name})=>({key,name}))});
  }
  if(action==="request_approval"){
    if(decision!=="otp_required")return fail("No earlier-month approval is required.",400);
    const approverKey=str(input?.approverKey,80);
    const result=await requestPolicyDateApprovalForVerifiedActor({...approvalInput,approverKey},profile);
    return NextResponse.json(result,{status:result.ok?200:400});
  }
  if(action==="verify_approval"){
    if(decision!=="otp_required")return fail("No earlier-month approval is required.",400);
    const result=await verifyPolicyDateApprovalForVerifiedActor(str(input?.approvalId,50),
      str(input?.otp,6),approvalInput,profile);
    return NextResponse.json(result,{status:result.ok?200:400});
  }
  if(action!=="issue")return fail("Unsupported issuance operation.",400);
  const keys=["startDate","endDate","pptEndDate","nextInstallmentDate","finalPremium","sumInsured","approvalId"] as const;
  const values:Record<string,string>={};
  for(const key of keys)values[key]=str(input?.[key],100);
  if(!values.startDate||!values.finalPremium)return fail("Policy start date and final premium are required.",400);
  if(decision==="otp_required"&&!uuid.test(values.approvalId))
    return fail("Verify the earlier-month approver OTP before issuing.",400);
  const form=new FormData();
  for(const [key,value] of Object.entries({caseId,policyNumber,issuanceDate,...values}))form.set(key,value);
  const outcome=await convertLifeHealthCaseForVerifiedActor(form,profile);
  if(!outcome.ok)return fail(outcome.error,409);
  return NextResponse.json({ok:true,policyId:outcome.policyId,policyCode:outcome.policyCode},
    {headers:{"Cache-Control":"private, no-store"}});
}
