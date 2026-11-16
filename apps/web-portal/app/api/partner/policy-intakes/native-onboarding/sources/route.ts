import {NextResponse} from "next/server";
import {createSupabaseWithAccessToken} from "@/lib/auth";
import {createSupabaseAdminClient} from "@/lib/supabase-admin";
import {hasEffectiveCapability} from "@/lib/effective-permissions";
import {getEffectivePermission} from "@/lib/permission-management";
import {getOperationsHeadDownlinePolicyScope} from "@/lib/policy-access-scope";
import {isAppRole} from "@/lib/roles";
import {loadPospMispAssociates} from "@/lib/posp-misp-associates";

export const dynamic="force-dynamic";
const fail=(error:string,status:number)=>NextResponse.json({ok:false,error},{status,headers:{"Cache-Control":"no-store"}});
const types:Record<string,"posp"|"misp"|"partner">={"POSP":"posp","MISP":"misp","SIBL / Partner":"partner"};
type Source={id:string;intermediary_type:string;display_name:string;intermediary_code:string|null;mobile:string|null;associate_employee_id:string|null;application_id:string|null};
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{12}$/i;

export async function POST(request:Request){
  const token=/^Bearer (\S+)$/i.exec(request.headers.get("authorization")??"")?.[1];
  if(!token)return fail("Partner authentication required.",401);
  let input:{intermediary_type?:string;search?:string;intake_id?:string};
  try{input=await request.json();}catch{return fail("Invalid source search.",400);}
  const type=types[input.intermediary_type??""];
  if(!type)return fail("Choose an intermediary type first.",400);
  const search=String(input.search??"").trim();
  if(search.length>80)return fail("Search is too long.",400);
  const scoped=createSupabaseWithAccessToken(token);
  const {data:{user},error:authError}=await scoped.auth.getUser(token);
  if(authError||!user)return fail("Partner session expired.",401);
  const admin=createSupabaseAdminClient();
  const {data:profile}=await admin.from("profiles").select("id,role,is_active").eq("id",user.id)
    .maybeSingle<{id:string;role:string;is_active:boolean}>();
  if(!profile?.is_active||!isAppRole(profile.role))return fail("Operations access is unavailable.",403);
  const head=profile.role==="operations_head_life";
  const [creator,legacy]=await Promise.all([
    hasEffectiveCapability(profile,"create_policies","edit"),
    getEffectivePermission(profile.id,profile.role,"view_policies"),
  ]);
  if(!head&&!creator&&!["edit","approve"].includes(legacy.access))return fail("Policy creation permission is required.",403);

  let fixedCode:string|null=null;
  if(input.intake_id){
    if(!uuid.test(input.intake_id))return fail("Invalid Intake reference.",400);
    const {data:intake,error}=await admin.from("policy_intake_requests")
      .select("id,lead_source_type,lead_source_code,status,assigned_to_profile_id")
      .eq("id",input.intake_id).eq("assigned_to_profile_id",profile.id).eq("status","in_review")
      .maybeSingle<{id:string;lead_source_type:string;lead_source_code:string|null;status:string;assigned_to_profile_id:string}>();
    if(error||!intake)return fail("Intake is not assigned to your account.",403);
    if(intake.lead_source_type!==type)return fail("This Intake has a different source type.",403);
    fixedCode=intake.lead_source_code;
    if(!fixedCode)return fail("This Intake has no verified lead-source code.",409);
  }
  let allowedCodes:string[]|null=null;
  if(head){
    const scope=await getOperationsHeadDownlinePolicyScope(profile.id);
    allowedCodes=scope.intermediaryCodes;
    if(!allowedCodes.length)return NextResponse.json({ok:true,sources:[]},{headers:{"Cache-Control":"no-store"}});
    if(fixedCode&&!allowedCodes.includes(fixedCode))return fail("Lead source is outside your approved downline.",403);
  }
  let query=admin.from("intermediaries").select("id,intermediary_type,display_name,intermediary_code,mobile,associate_employee_id,application_id")
    .eq("account_status","active").eq("intermediary_type",type)
    .not("intermediary_code","is",null).order("display_name").limit(30);
  if(fixedCode)query=query.eq("intermediary_code",fixedCode);
  else if(allowedCodes)query=query.in("intermediary_code",allowedCodes);
  // Match only text characters; no user-supplied query syntax.
  const term=search.replace(/[%_,()]/g,"").trim();
  if(term)query=query.ilike("display_name",`%${term}%`);
  const {data,error}=await query.returns<Source[]>();
  if(error)return fail("Source directory is temporarily unavailable.",503);
  const found=data??[];
  let associates:Awaited<ReturnType<typeof loadPospMispAssociates>>=[];
  try{associates=await loadPospMispAssociates(admin);}catch{return fail("RM assignment lookup is unavailable.",503);}
  const sources=[];
  for(const row of found){
    let employeeId=row.associate_employee_id;
    if(row.application_id){
      const {data:owner}=await admin.from("posp_misp_onboarding_profiles")
        .select("associate_employee_id").eq("application_id",row.application_id)
        .maybeSingle<{associate_employee_id:string|null}>();
      if(owner)employeeId=owner.associate_employee_id;
    }
    const owner=associates.find(item=>item.id===employeeId);
    sources.push({id:row.id,name:row.display_name,code:row.intermediary_code??"",
      mobile:row.mobile?.replace(/\D/g,"").slice(-10)??"",
      rmName:owner?.full_name?.trim()??"",rmCode:owner?.employee_code?.trim()??""});
  }
  return NextResponse.json({ok:true,sources},{headers:{"Cache-Control":"no-store"}});
}
