import { NextResponse } from "next/server";
import { createSupabaseWithAccessToken } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { hasEffectiveCapability } from "@/lib/effective-permissions";
import { getEffectivePermission } from "@/lib/permission-management";
import { isAppRole } from "@/lib/roles";
import { getOperationsHeadDownlinePolicyScope } from "@/lib/policy-access-scope";
import { canAccessPolicyCommercials } from "@/lib/policy-commercial-access";
import { createLifeHealthCaseForVerifiedActor } from "@/lib/life-health-case-creation-engine";

export const dynamic="force-dynamic";
const allowedDocuments=["policyCopy","proposalForm","kyc","otherDocument"] as const;
const allowedExtras=new Set([
  "address","insurerId","productName","proposalNumber","ppt","pd","paymentFrequency",
  "premiumAmount","paymentMode","remarks","payinBasis","payinValue",
  "payinScheme","partnerPayoutBasis","partnerPayoutValue",
]);
const fail=(error:string,status:number)=>NextResponse.json({ok:false,error},{status,headers:{"Cache-Control":"no-store"}});

export async function POST(request:Request){
  const token=/^Bearer (\S+)$/i.exec(request.headers.get("authorization")??"")?.[1];
  if(!token)return fail("Partner authentication required.",401);
  // Do not parse arbitrary oversized request bodies.
  const length=Number(request.headers.get("content-length")??0);
  if(Number.isFinite(length)&&length>17*1024*1024)return fail("Documents must total 16 MB or less.",413);
  const scoped=createSupabaseWithAccessToken(token);
  const {data:{user},error:authError}=await scoped.auth.getUser(token);
  if(authError||!user)return fail("Your session has expired. Sign in again.",401);
  const admin=createSupabaseAdminClient();
  const {data:profile}=await admin.from("profiles").select("id,role,is_active,full_name").eq("id",user.id).maybeSingle<{id:string;role:string;is_active:boolean;full_name:string|null}>();
  if(!profile?.is_active||!isAppRole(profile.role))return fail("Operations access is unavailable.",403);
  const head=profile.role==="operations_head_life";
  const [creator,legacy]=await Promise.all([
    hasEffectiveCapability(profile,"create_policies","edit"),
    getEffectivePermission(profile.id,profile.role,"view_policies"),
  ]);
  if(!head&&!creator&&!["edit","approve"].includes(legacy.access))return fail("Policy creation permission is required.",403);
  if(!request.headers.get("content-type")?.startsWith("multipart/form-data"))
    return fail("Invalid Life policy submission.",400);
  let form:FormData;
  try{form=await request.formData();}catch{return fail("Could not read the Life policy submission.",400);}
  const raw=form.get("draft");
  if(typeof raw!=="string"||raw.length>80000)return fail("Invalid Life policy draft.",400);
  let draft:Record<string,unknown>;
  try{draft=JSON.parse(raw) as Record<string,unknown>;}catch{return fail("Invalid Life policy draft.",400);}
  if(!draft||typeof draft!=="object"||Array.isArray(draft)||!["Life","Health"].includes(String(draft.businessLine)))
    return fail("Standalone creation is available for Life and Health only.",400);
  const get=(key:string)=>typeof draft[key]==="string"?(draft[key] as string).trim():"";
  const product=draft.productDrafts;
  const values=product&&typeof product==="object"&&!Array.isArray(product)
    ?(product as Record<string,unknown>)[String(draft.businessLine)]:null;
  if(!values||typeof values!=="object"||Array.isArray(values))return fail("Life/Health policy details are missing.",400);
  const details=values as Record<string,unknown>;
  if(Object.entries(details).some(([key,value])=>!allowedExtras.has(key)||typeof value!=="string"||value.length>4000))
    return fail("Invalid Life policy details.",400);
  const v=(key:string)=>typeof details[key]==="string"?(details[key] as string).trim():"";
  const required:[string,string][]=[
    ["Proposal date",get("issuanceDate")],["Intermediary type",get("intermediaryType")],
    ["Lead source",get("leadSource")],["Lead source ID",get("intermediaryCode")],
    ["Client / proposer name",get("insuredName")],["Client mobile number",get("phoneNo")],
    ["Insurance company",v("insurerId")],["Product name",v("productName")],
    ["Case / proposal number",v("proposalNumber")],["Payment frequency",v("paymentFrequency")],
    ["Premium amount",v("premiumAmount")],["Payment mode",v("paymentMode")],
  ];
  const missing=required.find(([,value])=>!value);
  if(missing)return fail(`${missing[0]} is required.`,400);
  if(!/^\d{4}-\d{2}-\d{2}$/.test(get("issuanceDate"))||!Number.isFinite(Date.parse(get("issuanceDate"))))
    return fail("Proposal date must be a valid YYYY-MM-DD date.",400);
  if(!/^[6-9]\d{9}$/.test(get("phoneNo")))return fail("Enter a valid 10 digit Indian mobile number.",400);
  if(Object.values(draft).some(value=>typeof value==="string"&&value.length>4000))
    return fail("Life policy field is too long.",400);
  if(head){
    const downline=await getOperationsHeadDownlinePolicyScope(profile.id);
    if(!downline.intermediaryCodes.includes(get("intermediaryCode")))return fail("This source is outside your approved downline.",403);
  }
  // Source identity must come from the active master, never from a mobile-selected arbitrary UUID.
  const {data:sources,error:sourceError}=await admin.from("intermediaries")
    .select("id,display_name,intermediary_code")
    .eq("intermediary_code",get("intermediaryCode")).limit(10)
    .returns<Array<{id:string;display_name:string;intermediary_code:string|null}>>();
  if(sourceError)return fail("Lead source lookup is unavailable.",503);
  const matches=(sources??[]).filter(row=>row.display_name.trim().toLowerCase()===get("leadSource").toLowerCase());
  if(matches.length!==1)return fail("Lead source identity could not be uniquely verified. Recheck the source and ID.",409);
  // Reuse the same Operations Life engine and validation used by Intake finalization.
  // The case remains awaiting_policy; it does not directly issue a policy.
  const payload=new FormData();
  const fields:Record<string,string>={
    businessLine:String(draft.businessLine),sourcingDate:get("issuanceDate"),
    intermediaryType:get("intermediaryType"),intermediaryCode:get("intermediaryCode"),
    sourceId:matches[0].id,leadSource:get("leadSource"),rmName:get("rmName"),
    insuredName:get("insuredName"),phone:get("phoneNo"),address:v("address"),
    insurerId:v("insurerId"),productName:v("productName"),proposalNumber:v("proposalNumber"),
    ppt:v("ppt"),pd:v("pd"),paymentFrequency:v("paymentFrequency"),
    paymentMode:v("paymentMode"),premiumAmount:v("premiumAmount"),
    remarks:v("remarks")||get("remarks"),
  };
  if(canAccessPolicyCommercials(profile,head)){
    const payinFlat=v("payinBasis")==="FLAT",payoutFlat=v("partnerPayoutBasis")==="FLAT";
    fields.payinBasis=payinFlat?"FIXED_AMOUNT":"NET_PREMIUM_PERCENT";
    fields.payoutBasis=payoutFlat?"FIXED_AMOUNT":"NET_PREMIUM_PERCENT";
    fields[payinFlat?"payinFixedAmount":"payinPercent"]=v("payinValue");
    fields.insurerSchemeAmount=v("payinScheme");
    fields[payoutFlat?"payoutFixedAmount":"payoutPercent"]=v("partnerPayoutValue");
  }
  for(const [key,value] of Object.entries(fields))payload.set(key,value);
  let totalBytes=0;
  const validMimes=new Set(["application/pdf","image/jpeg","image/png","image/webp"]);
  for(const key of allowedDocuments){
    const value=form.get(key);
    if(value===null)continue;
    if(!(value instanceof File)||value.size<1||value.size>4*1024*1024||!validMimes.has(value.type))
      return fail("Upload a PDF or image up to 4 MB per document.",400);
    totalBytes+=value.size;
    payload.set(key,value);
  }
  if(totalBytes>16*1024*1024)return fail("Documents must total 16 MB or less.",413);
  if(Array.from(form.keys()).some(key=>key!=="draft"&&!allowedDocuments.includes(key as typeof allowedDocuments[number])))
    return fail("Unexpected Life policy attachment.",400);
  // A duplicate proposal number should not be submitted twice on a retry.
  const {data:existing,error:duplicateError}=await admin.from("life_health_cases")
    .select("id").eq("business_line",String(draft.businessLine)).eq("proposal_number",v("proposalNumber").toUpperCase()).limit(1);
  if(duplicateError)return fail("Could not verify existing Life cases.",503);
  if((existing??[]).length)return fail("This Life/Health proposal number already exists. Check the Case Register before retrying.",409);
  try{
    const result=await createLifeHealthCaseForVerifiedActor(payload,profile);
    if(!result.ok)return fail(result.error,400);
    return NextResponse.json({ok:true,case:{id:result.caseId,number:result.caseNumber,status:"awaiting_policy"}},{headers:{"Cache-Control":"no-store"}});
  }catch(error){
    console.error("Standalone Life creation outcome uncertain",{profileId:profile.id,message:error instanceof Error?error.message:"unknown"});
    return fail("Could not confirm Life case creation. Check Case Register before retrying.",503);
  }
}
