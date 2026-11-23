// First independent Partner Policy Onboarding service operation.
// Only new_prepare is implemented. Do NOT switch the mobile API until all actions
// have equivalent authorization/booking/approval/document business rules.
import { createClient } from "npm:@supabase/supabase-js@2.57.0";

const allowedFields = ["registrationMode","issuanceDate","rmName","intermediaryType","leadSource","intermediaryCode","businessLine",
"registrationNo","insuredName","phoneNo","vehicleClass","make","model","fuelType","capacity","manufacturingYear",
"chassisNo","engineNo","rtoState","rtoName","policyProduct","idv","od","tp","cpaOpted","cpa","policyNo",
"insurerId","validFrom","validUpto","payoutBasis","projectedOdPercent","projectedTpPercent","insurerScheme",
"payinBillNo","payinBilledAmount","payinBillDate","payinStatus","retention","payoutOdPercent","payoutTpPercent",
"flatPayoutAmount","payoutStatus","payoutDate","payoutVoucherNo","remarks"];
// Keep exactly the web onboarding draft field allowlist. Unknown fields are
// not written, and product-commercial terms are only accepted for financial roles.
const optionalFields = ["addOnPremium","tpValidUpto","cpaValidUpto"];
const commercialFields = ["payoutBasis","projectedOdPercent","projectedTpPercent","insurerScheme","payinBillNo","payinBilledAmount","payinBillDate","payinStatus","retention","payoutOdPercent","payoutTpPercent","flatPayoutAmount","payoutStatus","payoutDate","payoutVoucherNo"];
const commercialProductFields = new Set(["payinBasis","payinValue","payinScheme","partnerPayoutBasis","partnerPayoutValue"]);
const riskFields=["riskTitle","riskLocation","occupancyType","cargoDescription","transitFrom","transitTo","transitMode","projectName","projectValue","natureOfBusiness","liabilityType","employeeCount","annualWages","businessName","annualTurnover"];
const additionalFields=["proposalNumber","previousInsurer","previousPolicyNumber","previousClaims","addOns","warranties","specialConditions","endorsements","remarks"];
const productFields=new Set([...riskFields,...additionalFields,"address","productName","ppt","pd","paymentFrequency","premiumAmount","paymentMode","customerMode","customerId","customerType","insuredName","phone","contactName","email","policyNumber","category","status","sumInsured","deductible","netPremium","gstAmount","grossPremium","startDate","endDate",...commercialProductFields]);
const nonMotorTypes=["Life","Health","Non Motor"];
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const approvers = [
  { key: "jatin", name: "Jatin Kumar Buwaniwala" },
  { key: "vishal", name: "Vishal Kochhar" },
  { key: "varun", name: "Varun Sabharwal" },
  { key: "gagan", name: "Gagan Singh" },
];
// Preserve the existing native-onboarding API's default date exactly.
function initialIssuanceDate() { return new Date().toISOString().slice(0,10); }
const json = (body: Record<string,unknown>, status=200) =>
  new Response(JSON.stringify(body), {status,headers:{"Content-Type":"application/json","Cache-Control":"no-store"}});
Deno.serve(async (request: Request) => {
  if (request.method !== "POST") return json({ok:false,error:"Method not allowed."},405);
  const token = /^Bearer\s+(\S+)$/i.exec(request.headers.get("authorization")??"")?.[1];
  if (!token) return json({ok:false,error:"Authenticated Partner session required."},401);
  let body: Record<string,unknown>;
  try { body = await request.json(); } catch { return json({ok:false,error:"Invalid Policy Onboarding request."},400); }
  if(body.action !== "new_prepare" && body.action !== "customer_search" && body.action !== "save") {
    // No side effects or privileged fallbacks for unmigrated operations.
    return json({ok:false,error:"This Policy Onboarding operation has not yet been migrated."},501);
  }
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_ANON_KEY");
  const secret = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key || !secret) return json({ok:false,error:"Policy masters are temporarily unavailable."},503);
  const scoped = createClient(url,key,{
    global:{headers:{Authorization:`Bearer ${token}`}},
    auth:{persistSession:false,autoRefreshToken:false}
  });
  const { data: user, error: authError } = await scoped.auth.getUser(token);
  if(authError||!user.user) return json({ok:false,error:"Your Partner session has expired."},401);
  const [{data:identity,error:identityError},{data:access,error:accessError}]=await Promise.all([
    scoped.rpc("partner_app_current_identity"),
    scoped.rpc("partner_app_effective_permissions"),
  ]);
  if(identityError||accessError) return json({ok:false,error:"Partner authorization temporarily unavailable."},503);
  if(!identity||identity.actor_kind!=="employee"||identity.auth_user_id!==user.user.id||
    identity.profile_id!==user.user.id||!access||access.actor_kind!=="employee") {
    return json({ok:false,error:"Operations Policy Onboarding access required."},403);
  }
  const admin = createClient(url,secret,{auth:{persistSession:false,autoRefreshToken:false}});
  if (body.action === "save") {
    // A new standalone policy is not a persisted intake draft. Save is only
    // allowed for an existing, currently assigned, active intake reviewer.
    const uid=user.user.id;
    const intakeId=typeof body.intake_id==="string" ? body.intake_id : "";
    const revision=body.revision;
    const input=body.draft;
    if(!uuid.test(intakeId) || !Number.isSafeInteger(revision) ||
       typeof revision!=="number" || revision<1 ||
       !input || typeof input!=="object" || Array.isArray(input)){
      return json({ok:false,error:"Invalid draft revision or values."},400);
    }
    if(identity.role==="operations_head_life"){
      // Existing site requires an additional downline predicate.
      return json({ok:false,error:"Life Operations onboarding scope has not been migrated."},501);
    }
    const level=(key:string)=>access.capabilities?.[key];
    if(!["edit","approve"].includes(level("review_policy_intakes"))||
       level("finalize_policy_intakes")!=="approve"){
      return json({ok:false,error:"Operations finalization permission is required."},403);
    }
    const draft=input as Record<string,unknown>;
    if(allowedFields.some(key=>typeof draft[key]!=="string"||(draft[key] as string).length>4000)||
       optionalFields.some(key=>draft[key]!==undefined&&(typeof draft[key]!=="string"||(draft[key] as string).length>4000))||
       !["registered","unregistered"].includes(String(draft.registrationMode))||
       !["Yes","No"].includes(String(draft.cpaOpted))||
       !["Motor",...nonMotorTypes].includes(String(draft.businessLine))){
      return json({ok:false,error:"Invalid onboarding draft fields."},400);
    }
    const productDrafts=draft.productDrafts;
    if(productDrafts!==undefined){
      if(!productDrafts || typeof productDrafts!=="object" || Array.isArray(productDrafts)){
        return json({ok:false,error:"Invalid product draft."},400);
      }
      const entries=Object.entries(productDrafts as Record<string,unknown>);
      if(entries.length>nonMotorTypes.length||entries.some(([type,values])=>
        !nonMotorTypes.includes(type)||!values||typeof values!=="object"||Array.isArray(values)||
        Object.entries(values as Record<string,unknown>).some(([key,value])=>
          !productFields.has(key)||typeof value!=="string"||value.length>2000))){
        return json({ok:false,error:"Unsupported product draft fields."},400);
      }
    }
    const commercialAccess=identity.role==="operations_head_life"||access.can_view_insurer_commercials===true;
    if(productDrafts!==undefined){
      for(const values of Object.values(productDrafts as Record<string,Record<string,string>>)){
        if(!commercialAccess&&Object.keys(values).some(key=>commercialProductFields.has(key))){
          return json({ok:false,error:"Commercial terms require financial access."},403);
        }
        for(const key of commercialProductFields){
          const value=values[key];
          if(value===undefined||value==="")continue;
          if(key==="payinBasis"||key==="partnerPayoutBasis"){
            if(!["NET","FLAT"].includes(value))return json({ok:false,error:"Invalid commercial basis."},400);
          }else if(!/^\\d+(?:\\.\\d{1,2})?$/.test(value)||
            !Number.isFinite(Number(value))||
            Number(value)>(key.endsWith("Value")&&values[key.replace("Value","Basis")]==="NET"?100:100000000000)){
            return json({ok:false,error:"Invalid projected commercial value."},400);
          }
        }
      }
    }
    // Assignment and duplicate checks are made before reading any draft.
    const {data:intake,error:intakeError}=await admin.from("policy_intake_requests")
      .select("id,status,assigned_to_profile_id,ocr_fields")
      .eq("id",intakeId).eq("status","in_review")
      .eq("assigned_to_profile_id",uid).maybeSingle();
    if(intakeError)return json({ok:false,error:"Policy Intake review is unavailable."},503);
    if(!intake)return json({ok:false,error:"You are no longer the assigned reviewer."},409);
    const number=String((Array.isArray(intake.ocr_fields)?intake.ocr_fields:[])
      .find((field:{key?:string})=>field?.key==="policy_number")?.value??"")
      .trim().toUpperCase().replace(/[^A-Z0-9]/g,"");
    if(number){
      const [policies,earlier]=await Promise.all([
        admin.from("policies").select("id").eq("policy_no_normalized",number).limit(1),
        admin.from("policy_intake_requests").select("id,ocr_fields")
          .order("created_at",{ascending:true}).order("id",{ascending:true}).limit(5000),
      ]);
      if(policies.error||earlier.error)return json({ok:false,error:"Duplicate verification unavailable."},503);
      if(policies.data?.length)return json({ok:false,error:"Duplicate intakes cannot be onboarded."},409);
      const first=(earlier.data??[]).find(item=>
        String((Array.isArray(item.ocr_fields)?item.ocr_fields:[])
          .find((field:{key?:string})=>field?.key==="policy_number")?.value??"")
          .trim().toUpperCase().replace(/[^A-Z0-9]/g,"")===number);
      if(first&&first.id!==intakeId)return json({ok:false,error:"Duplicate intakes cannot be onboarded."},409);
    }
    const {data:stored,error:storedError}=await admin.from("policy_intake_onboarding_drafts")
      .select("draft_payload,revision").eq("intake_id",intakeId).maybeSingle();
    if(storedError)return json({ok:false,error:"Onboarding draft unavailable."},503);
    if(!stored||stored.revision!==revision)return json({ok:false,error:"Draft changed. Reload the latest version."},409);
    const previous=stored.draft_payload as Record<string,unknown>;
    if(!previous||typeof previous!=="object"||Array.isArray(previous)){
      return json({ok:false,error:"Stored draft invalid."},503);
    }
    const next:Record<string,unknown>={...previous};
    for(const key of allowedFields){
      if(!commercialAccess&&commercialFields.includes(key))continue;
      next[key]=draft[key];
    }
    for(const key of optionalFields)if(draft[key]!==undefined)next[key]=draft[key];
    if(productDrafts!==undefined){
      const prior=(previous.productDrafts&&typeof previous.productDrafts==="object"&&!Array.isArray(previous.productDrafts))
        ?previous.productDrafts as Record<string,Record<string,string>>:{};
      next.productDrafts=Object.fromEntries(Object.entries(productDrafts as Record<string,Record<string,string>>)
        .map(([type,values])=>[type,{...(prior[type]??{}),...values}]));
    }
    // Compare-and-set on revision AND reviewer/status; preserve stored-only fields.
    const {data:saved,error:saveError}=await admin.from("policy_intake_onboarding_drafts")
      .update({draft_payload:next,revision:revision+1,
        updated_by_profile_id:uid,updated_at:new Date().toISOString()})
      .eq("intake_id",intakeId).eq("revision",revision)
      .select("revision").maybeSingle();
    if(saveError)return json({ok:false,error:"Policy Onboarding draft could not be saved."},503);
    if(!saved)return json({ok:false,error:"The draft was edited elsewhere. Reload before saving."},409);
    return json({ok:true,revision:saved.revision});
  }
  if (body.action === "customer_search") {
    // Existing route requires the active reviewer, a live finalization grant,
    // and no duplicate intake. Do not broaden scope to other intake IDs.
    const uid = user.user.id;
    const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    const intakeId = typeof body.intake_id === "string" ? body.intake_id : "";
    if (!uuid.test(intakeId)) return json({ok:false,error:"Invalid Policy Intake reference."},400);
    const level = (key:string) => access.capabilities?.[key];
    const hasReview = ["edit","approve"].includes(level("review_policy_intakes"));
    const hasFinalize = level("finalize_policy_intakes") === "approve";
    if (!hasReview || !hasFinalize) {
      // Life Head has a separate downline filter in the website backend.
      // Until that filter has parity, do not permit a scoped search here.
      return json({ok:false,error:"Operations finalization permission is required."},403);
    }
    if (identity.role === "operations_head_life") {
      return json({ok:false,error:"Life Operations customer scope is not migrated."},501);
    }
    const {data:intake,error:intakeError} = await admin.from("policy_intake_requests")
      .select("id,ocr_fields,created_at,status,assigned_to_profile_id")
      .eq("id",intakeId).eq("status","in_review").eq("assigned_to_profile_id",uid)
      .maybeSingle();
    if (intakeError) return json({ok:false,error:"Policy Intake review is unavailable."},503);
    if(!intake) return json({ok:false,error:"You are no longer the assigned reviewer."},409);
    const policyNumber = String((Array.isArray(intake.ocr_fields) ? intake.ocr_fields : [])
      .find((field: {key?:string}) => field?.key === "policy_number")?.value??"")
      .trim().toUpperCase().replace(/[^A-Z0-9]/g,"");
    if(policyNumber) {
      const [registered,history] = await Promise.all([
        admin.from("policies").select("id").eq("policy_no_normalized",policyNumber).limit(1),
        admin.from("policy_intake_requests").select("id,created_at,ocr_fields")
          .order("created_at",{ascending:true}).order("id",{ascending:true}).limit(5000),
      ]);
      if(registered.error || history.error) return json({ok:false,error:"Duplicate verification unavailable."},503);
      if(registered.data?.length) return json({ok:false,error:"Duplicate intakes cannot be onboarded."},409);
      const first=(history.data??[]).find(row=>
        String((Array.isArray(row.ocr_fields)?row.ocr_fields:[])
          .find((field: {key?:string})=>field?.key==="policy_number")?.value??"")
          .trim().toUpperCase().replace(/[^A-Z0-9]/g,"")===policyNumber);
      if(first && first.id!==intakeId) return json({ok:false,error:"Duplicate intakes cannot be onboarded."},409);
    }
    const q = typeof body.search === "string" ? body.search.trim() : "";
    if(q.length<2||q.length>80) return json({ok:true,customers:[]});
    const {data:customers,error:customersError}=await admin.from("customers")
      .select("id,contact_name,company_name,phone,email")
      .order("contact_name",{ascending:true}).limit(750);
    if(customersError) return json({ok:false,error:"Customer search temporarily unavailable."},503);
    const needle=q.toLowerCase();
    return json({ok:true,customers:(customers??[])
      .filter(row=>[row.contact_name,row.company_name??"",row.phone].some(v=>String(v??"").toLowerCase().includes(needle)))
      .slice(0,8).map(row=>({id:row.id,name:row.company_name?.trim()||row.contact_name,
      contactName:row.contact_name,phone:row.phone,email:row.email??""}))});
  }
  const level=access.capabilities?.create_policies;
  if(identity.role!=="operations_head_life"&&level!=="edit"&&level!=="approve") {
    return json({ok:false,error:"Policy creation permission required."},403);
  }
  const [insurers,makes,brands]=await Promise.all([
    admin.from("insurance_companies").select("id,name").eq("is_active",true).order("name"),
    admin.from("vehicle_manufacturers").select("id").eq("is_active",true),
    admin.from("vehicle_manufacturer_brands").select("manufacturer_id,brand_name").eq("is_active",true).order("brand_name"),
  ]);
  if(insurers.error||makes.error||brands.error)return json({ok:false,error:"Policy masters temporarily unavailable."},503);
  const active=new Set((makes.data??[]).map(x=>x.id));
  const draft=Object.fromEntries(allowedFields.map(field=>[field,""]));
  Object.assign(draft,{
    registrationMode:"registered",issuanceDate:initialIssuanceDate(),businessLine:"Motor",
    cpaOpted:"No",payoutBasis:"NET",payinStatus:"Unbilled",payoutStatus:"Pending",
  });
  return json({
    ok:true,draft,revision:0,intake_number:"",
    insurers:(insurers.data??[]).map(x=>({value:x.id,label:x.name})),
    manufacturers:Array.from(new Set((brands.data??[]).filter(x=>active.has(x.manufacturer_id)).map(x=>x.brand_name))).sort(),
    sourceMeta:null,commercialAccess:identity.role==='operations_head_life' || access.can_view_insurer_commercials===true,
    approvers,
  });
});
