import {NextResponse} from "next/server";
import {createSupabaseWithAccessToken} from "@/lib/auth";
import {createSupabaseAdminClient} from "@/lib/supabase-admin";
import {hasEffectiveCapability} from "@/lib/effective-permissions";
import {getEffectivePermission} from "@/lib/permission-management";
import {getOperationsHeadDownlinePolicyScope,operationsHeadPolicyFilter} from "@/lib/policy-access-scope";
import {isAppRole} from "@/lib/roles";
import {createNonMotorPolicyForVerifiedActor,type NonMotorPolicyPayload,type StandaloneNonMotorDocument} from "@/lib/non-motor-policy-creation-engine";
import {canAccessPolicyCommercials} from "@/lib/policy-commercial-access";

export const dynamic="force-dynamic";
const fail=(error:string,status:number)=>NextResponse.json({ok:false,error},{status,headers:{"Cache-Control":"no-store"}});
const clean=(v:unknown)=>typeof v==="string"?v.trim():"";
const docFields={policyCopy:"policy_copy",proposalForm:"proposal_form",kyc:"kyc",otherDocument:"other_document"} as const;
const riskKeys=new Set(["riskTitle","riskLocation","occupancyType","cargoDescription","transitFrom","transitTo","transitMode","projectName","projectValue","natureOfBusiness","liabilityType","employeeCount","annualWages","businessName","annualTurnover"]);
const additionalKeys=new Set(["proposalNumber","previousInsurer","previousPolicyNumber","previousClaims","addOns","warranties","specialConditions","endorsements","remarks"]);
const productKeys=new Set([...riskKeys,...additionalKeys,"customerMode","customerId","customerType","insuredName","contactName","phone","email","address","policyNumber","insurerId","productName","category","status","sumInsured","deductible","netPremium","gstAmount","grossPremium","startDate","endDate","payinBasis","payinValue","payinScheme","partnerPayoutBasis","partnerPayoutValue"]);

async function authenticate(request:Request){
  const token=/^Bearer (\S+)$/i.exec(request.headers.get("authorization")??"")?.[1];
  if(!token)return null;
  const scoped=createSupabaseWithAccessToken(token);
  const {data:{user},error}=await scoped.auth.getUser(token);
  if(error||!user)return null;
  const admin=createSupabaseAdminClient();
  const {data:profile}=await admin.from("profiles").select("id,role,is_active").eq("id",user.id).maybeSingle<{id:string;role:string;is_active:boolean}>();
  if(!profile?.is_active||!isAppRole(profile.role))return null;
  const head=profile.role==="operations_head_life";
  const [creator,legacy]=await Promise.all([
    hasEffectiveCapability(profile,"create_policies","edit"),
    getEffectivePermission(profile.id,profile.role,"view_policies"),
  ]);
  if(!head&&!creator&&!["edit","approve"].includes(legacy.access))return null;
  return {profile,admin,head};
}
async function allowedCustomerIds(admin:ReturnType<typeof createSupabaseAdminClient>,profileId:string){
  const scope=await getOperationsHeadDownlinePolicyScope(profileId);
  if(!scope.intermediaryCodes.length)return new Set<string>();
  const filter=operationsHeadPolicyFilter(scope);
  const [p,c]=await Promise.all([
    admin.from("policies").select("customer_id").or(filter).returns<Array<{customer_id:string}>>(),
    admin.from("life_health_cases").select("customer_id").or(filter).returns<Array<{customer_id:string}>>(),
  ]);
  if(p.error||c.error)return null;
  return new Set([...(p.data??[]),...(c.data??[])].map(r=>r.customer_id));
}
export async function GET(request:Request){
  const auth=await authenticate(request);
  if(!auth)return fail("Policy creation access is unavailable.",403);
  const needle=new URL(request.url).searchParams.get("search")?.trim().toLowerCase()??"";
  if(needle.length<2||needle.length>80)return NextResponse.json({ok:true,customers:[]});
  const {admin,head,profile}=auth;
  const allowed=head?await allowedCustomerIds(admin,profile.id):null;
  if(head&&!allowed)return fail("Customer scope is unavailable.",503);
  if(head&&allowed?.size===0)return NextResponse.json({ok:true,customers:[]});
  const {data,error}=await admin.from("customers").select("id,contact_name,company_name,phone,email")
    .order("contact_name",{ascending:true}).limit(750)
    .returns<Array<{id:string;contact_name:string;company_name:string|null;phone:string;email:string|null}>>();
  if(error)return fail("Customer lookup is unavailable.",503);
  const customers=(data??[]).filter(r=>(!allowed||allowed.has(r.id))&&
    [r.contact_name,r.company_name??"",r.phone].some(v=>v.toLowerCase().includes(needle)))
    .slice(0,8).map(r=>({id:r.id,name:r.company_name?.trim()||r.contact_name,
      contactName:r.contact_name,phone:r.phone,email:r.email??""}));
  return NextResponse.json({ok:true,customers},{headers:{"Cache-Control":"no-store"}});
}
export async function POST(request:Request){
  const auth=await authenticate(request);
  if(!auth)return fail("Policy creation access is unavailable.",403);
  const len=Number(request.headers.get("content-length")??0);
  if(Number.isFinite(len)&&len>17*1024*1024)return fail("Document total exceeds 16MB.",413);
  if(!request.headers.get("content-type")?.startsWith("multipart/form-data"))return fail("Invalid Non-Motor form.",400);
  let data:FormData;
  try{data=await request.formData();}catch{return fail("Cannot read policy form.",400);}
  const raw=data.get("draft");
  if(typeof raw!=="string"||raw.length>80000)return fail("Invalid policy form.",400);
  let draft:Record<string,unknown>;
  try{draft=JSON.parse(raw) as Record<string,unknown>;}catch{return fail("Invalid policy form.",400);}
  if(!draft||typeof draft!=="object"||Array.isArray(draft)||draft.businessLine!=="Non Motor")
    return fail("Only standalone Non-Motor policies are supported by this route.",400);
  if(Object.values(draft).some(v=>typeof v==="string"&&v.length>4000))return fail("Invalid policy input.",400);
  const products=draft.productDrafts;
  const values=products&&typeof products==="object"&&!Array.isArray(products)?(products as Record<string,unknown>)["Non Motor"]:null;
  if(!values||typeof values!=="object"||Array.isArray(values))return fail("Non-Motor policy details are missing.",400);
  const fields=values as Record<string,unknown>;
  if(Object.entries(fields).some(([k,v])=>!productKeys.has(k)||typeof v!=="string"||v.length>4000))
    return fail("Invalid Non-Motor policy details.",400);
  const v=(k:string)=>clean(fields[k]),g=(k:string)=>clean(draft[k]);
  if(!["registered","unregistered"].includes(g("registrationMode")))return fail("Invalid form.",400);
  if(!/^\d{4}-\d{2}-\d{2}$/.test(g("issuanceDate")))return fail("Enter a valid proposal date.",400);
  if(!g("intermediaryType")||!g("leadSource")||!g("intermediaryCode"))
    return fail("Complete intermediary type and lead source.",400);
  const required=[["Policy number",v("policyNumber")],["Insurance company",v("insurerId")],["Product name",v("productName")],
    ["Sum insured",v("sumInsured")],["Gross premium",v("grossPremium")],["Policy start date",v("startDate")],["Policy expiry date",v("endDate")]];
  const missing=required.find(([,value])=>!value);
  if(missing)return fail(`${missing[0]} is required.`,400);
  if(v("customerMode")!=="new"&&v("customerMode")!=="existing")return fail("Select New or Existing customer.",400);
  if(v("customerMode")==="existing"&&!v("customerId"))return fail("Select an existing customer.",400);
  if(v("customerMode")==="new"&&(!v("insuredName")||!v("phone")))return fail("Enter new customer name and mobile.",400);
  if(!["Individual","Organisation"].includes(v("customerType")||"Organisation"))
    return fail("Invalid customer type.",400);
  if(!["Active","Pending","Expired","Cancelled"].includes(v("status")||"Active"))return fail("Invalid policy status.",400);
  const {profile,admin,head}=auth;
  if(head){
    const scope=await getOperationsHeadDownlinePolicyScope(profile.id);
    if(!scope.intermediaryCodes.includes(g("intermediaryCode")))return fail("Source is outside your approved downline.",403);
    if(v("customerMode")==="existing"){
      const ids=await allowedCustomerIds(admin,profile.id);
      if(!ids)return fail("Customer scope is unavailable.",503);
      if(!ids.has(v("customerId")))return fail("Customer is outside your approved downline.",403);
    }
  }
  const risk:Record<string,string>={},additional:Record<string,string>={};
  for(const [key,value] of Object.entries(fields)){
    if(riskKeys.has(key))risk[key]=clean(value);
    if(additionalKeys.has(key))additional[key]=clean(value);
  }
  const source:NonMotorPolicyPayload["source"]={
    issuanceDate:g("issuanceDate"),intermediaryType:g("intermediaryType"),
    intermediaryCode:g("intermediaryCode"),leadSource:g("leadSource"),rmName:g("rmName"),
  };
  const payload:NonMotorPolicyPayload={
    source,customerId:v("customerMode")==="existing"?v("customerId"):undefined,
    customer:{customerType:(v("customerType")==="Individual"?"Individual":"Organisation"),
      insuredName:v("insuredName"),contactName:v("contactName"),phone:v("phone"),email:v("email"),address:v("address")},
    policy:{policyNumber:v("policyNumber"),insurerId:v("insurerId"),productName:v("productName"),
      category:v("category")||"Other",status:v("status")||"Active",startDate:v("startDate"),endDate:v("endDate"),
      sumInsured:v("sumInsured"),odPremium:"0",tpPremium:"0",netPremium:v("netPremium"),
      gstAmount:v("gstAmount"),grossPremium:v("grossPremium"),deductible:v("deductible")},
    risk,additional,
  };
  if(canAccessPolicyCommercials(profile,head)){
    const payinFixed=v("payinBasis")==="FLAT",payoutFixed=v("partnerPayoutBasis")==="FLAT";
    payload.commercial={
      payinBasis:payinFixed?"FIXED_AMOUNT":"NET_PREMIUM_PERCENT",
      payinPercent:payinFixed?"":v("payinValue"),payinFixedAmount:payinFixed?v("payinValue"):"",
      insurerSchemeAmount:v("payinScheme"),
      payoutBasis:payoutFixed?"FIXED_AMOUNT":"NET_PREMIUM_PERCENT",
      payoutPercent:payoutFixed?"":v("partnerPayoutValue"),
      payoutFixedAmount:payoutFixed?v("partnerPayoutValue"):"",
    };
  }
  const documents:StandaloneNonMotorDocument[]=[];
  const allowedMimes=new Set(["application/pdf","image/jpeg","image/png","image/webp"]);
  for(const [field,type] of Object.entries(docFields)){
    const file=data.get(field);
    if(file===null)continue;
    if(!(file instanceof File)||file.size<1||file.size>4*1024*1024||!allowedMimes.has(file.type))
      return fail("Upload PDFs or images no larger than 4MB.",400);
    documents.push({type,file});
  }
  if(documents.reduce((a,b)=>a+b.file.size,0)>16*1024*1024)return fail("Documents exceed 16MB.",413);
  if(Array.from(data.keys()).some(k=>k!=="draft"&&!(k in docFields)))return fail("Unexpected attachment.",400);
  // A verified profile and bounded form are passed into the same Non-Motor Operations creation engine.
  const result=await createNonMotorPolicyForVerifiedActor(payload,profile,documents);
  if(!result.ok)return fail(result.error,400);
  return NextResponse.json({ok:true,policy:{id:result.policyId,number:result.policyCode}},{headers:{"Cache-Control":"no-store"}});
}
