import { NextResponse } from "next/server";
import { createLifeHealthCaseForVerifiedActor } from "@/lib/life-health-case-creation-engine";
import { onboardPolicyForVerifiedActor, type PolicyOnboardingPayload } from "@/lib/policy-onboarding-engine";
import { requestPolicyDateApprovalForVerifiedActor, verifyPolicyDateApprovalForVerifiedActor } from "@/lib/policy-date-approval-engine";
import { POLICY_DATE_APPROVERS } from "@/lib/policy-date-rule";
import { lookupPolicyRegistrationRcForVerifiedActor } from "@/lib/policy-rc-lookup-engine";
import { getEffectivePermission } from "@/lib/permission-management";
import { isAppRole } from "@/lib/roles";
import { getOperationsHeadDownlinePolicyScope, operationsHeadPolicyFilter } from "@/lib/policy-access-scope";
import { createSupabaseWithAccessToken } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { hasEffectiveCapability } from "@/lib/effective-permissions";
import { getPartnerEmployeeIntakeReadScope } from "@/lib/partner-policy-intake-read-access";
import { loadPolicyIntakeDuplicateMatches } from "@/lib/policy-intake-duplicate";
import { canAccessPolicyCommercials } from "@/lib/policy-commercial-access";
import { buildPolicyOcrOnboardingUpdate } from "@/lib/policy-ocr-onboarding-apply";
import { loadPospMispAssociates } from "@/lib/posp-misp-associates";
import type { PolicyIntakeDraft } from "@/app/policy-intakes/handoff-actions";
import type { PolicyIntakeOcrField } from "@/app/policy-intakes/ocr-actions";

export const dynamic = "force-dynamic";
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const fields = ["registrationMode","issuanceDate","rmName","intermediaryType","leadSource","intermediaryCode","businessLine","registrationNo","insuredName","phoneNo","vehicleClass","make","model","fuelType","capacity","manufacturingYear","chassisNo","engineNo","rtoState","rtoName","policyProduct","idv","od","tp","cpaOpted","cpa","policyNo","insurerId","validFrom","validUpto","payoutBasis","projectedOdPercent","projectedTpPercent","insurerScheme","payinBillNo","payinBilledAmount","payinBillDate","payinStatus","retention","payoutOdPercent","payoutTpPercent","flatPayoutAmount","payoutStatus","payoutDate","payoutVoucherNo","remarks"] as const;
const nativeOptionalFields = ["addOnPremium","tpValidUpto","cpaValidUpto"] as const;
// Only known product-specific draft keys can be saved from the mobile client.
// Booking remains Motor-only; these fields are not passed into Motor booking payloads.
const productDraftKeys = new Set([
  "address","productName","proposalNumber","ppt","pd","paymentFrequency","premiumAmount","paymentMode",
  "customerMode","customerId","customerType","insuredName","phone","contactName","email","policyNumber","category","status","riskTitle","riskLocation",
  "occupancyType","cargoDescription","transitFrom","transitTo","transitMode","projectName",
  "projectValue","natureOfBusiness","liabilityType","employeeCount","annualWages","businessName",
  "annualTurnover","sumInsured","deductible","netPremium","gstAmount","grossPremium",
  "startDate","endDate","previousInsurer","previousPolicyNumber","previousClaims",
  "addOns","warranties","specialConditions","endorsements","remarks",
  "payinBasis","payinValue","payinScheme","partnerPayoutBasis","partnerPayoutValue"
]);
// Product-specific projected commercial terms are draft-only and never mapped into Motor booking.
const productCommercialKeys = new Set(["payinBasis","payinValue","payinScheme","partnerPayoutBasis","partnerPayoutValue"]);
const nonMotorTypes = ["Life","Health","Non Motor"] as const;
const commercialFields = ["payoutBasis","projectedOdPercent","projectedTpPercent","insurerScheme","payinBillNo","payinBilledAmount","payinBillDate","payinStatus","retention","payoutOdPercent","payoutTpPercent","flatPayoutAmount","payoutStatus","payoutDate","payoutVoucherNo"] as const;
type Input = { action?: "prepare" | "save" | "book" | "create_life_health" | "approval_request" | "approval_verify" | "rc_lookup" | "customer_search"; search?: string; intake_id?: string; take_over?: boolean; expected_reviewer_id?: string | null; revision?: number; draft?: PolicyIntakeDraft; resolution?: PolicyOnboardingPayload["resolution"]; date_approval_id?: string | null; approver_key?: string; approval_id?: string; otp?: string; registration_no?: string };
type Intake = { id:string; intake_number:string; lead_source_type:"posp"|"misp"|"partner"; lead_source_name:string; lead_source_code:string|null; customer_mobile:string; ocr_fields:PolicyIntakeOcrField[]; status:string; assigned_to_profile_id:string|null; created_at:string; matched_customer_id:string|null };
function reply(error:string,status:number){return NextResponse.json({ok:false,error},{status,headers:{"Cache-Control":"no-store"}});}
function good(data:Record<string,unknown>){return NextResponse.json({ok:true,...data},{headers:{"Cache-Control":"no-store"}});}

export async function POST(request:Request){
  const token=/^Bearer (\S+)$/i.exec(request.headers.get("authorization")??"")?.[1];
  if(!token)return reply("Partner authentication required.",401);
  let body:Input;
  try{body=await request.json() as Input;}catch{return reply("Invalid onboarding request.",400);}
  if(!uuid.test(body.intake_id??"")||!["prepare","save","book","create_life_health","approval_request","approval_verify","rc_lookup","customer_search"].includes(body.action??""))return reply("Invalid onboarding request.",400);
  const scoped=createSupabaseWithAccessToken(token);
  const {data:{user},error:authError}=await scoped.auth.getUser(token);
  if(authError||!user)return reply("Your session has expired. Sign in again.",401);
  const admin=createSupabaseAdminClient();
  const {data:profile}=await admin.from("profiles").select("id,role,is_active,full_name").eq("id",user.id).maybeSingle<{id:string;role:string;is_active:boolean;full_name:string|null}>();
  if(!profile?.is_active||!isAppRole(profile.role))return reply("Operations access is unavailable.",403);
  const head=profile.role==="operations_head_life";
  const [review,finalize]=await Promise.all([
    head?Promise.resolve(true):hasEffectiveCapability(profile,"review_policy_intakes","edit"),
    head?Promise.resolve(true):hasEffectiveCapability(profile,"finalize_policy_intakes","approve")
  ]);
  if(!review||!finalize)return reply("Operations finalization permission is required.",403);
  const commercialAccess=canAccessPolicyCommercials(profile,head);
  const scope=await getPartnerEmployeeIntakeReadScope({actor_kind:"employee",profile_id:user.id});
  if(scope.mode==="none")return reply("This intake is outside your permitted scope.",403);
  let query=admin.from("policy_intake_requests").select("id,intake_number,lead_source_type,lead_source_name,lead_source_code,customer_mobile,ocr_fields,status,created_at,assigned_to_profile_id,matched_customer_id").eq("id",body.intake_id as string);
  if(scope.mode==="or")query=query.or(scope.predicates);
  else if(scope.mode==="submitter")query=query.eq("submitted_by_profile_id",scope.profileId);
  const {data:intake,error:intakeError}=await query.maybeSingle<Intake>();
  if(intakeError||!intake)return reply("Policy Intake is unavailable to this account.",403);
  const dup=await loadPolicyIntakeDuplicateMatches(admin,[intake]);
  if(!dup.ok)return reply("Duplicate verification is unavailable.",503);
  if(dup.matches.has(intake.id))return reply("Duplicate intakes cannot be onboarded.",409);
  if(body.action==="customer_search"){
    // Only the currently assigned authorised reviewer can search customer records
    // for the selected intake. Mirror the Operations Portal customer scope.
    if(intake.status!=="in_review"||intake.assigned_to_profile_id!==user.id)
      return reply("You are no longer the assigned reviewer.",409);
    const queryText=typeof body.search==="string"?body.search.trim():"";
    if(queryText.length<2||queryText.length>80)return good({customers:[]});
    const {data:allCustomers,error:customersError}=await admin.from("customers")
      .select("id,contact_name,company_name,phone,email")
      .order("contact_name",{ascending:true}).limit(750)
      .returns<Array<{id:string;contact_name:string;company_name:string|null;phone:string;email:string|null}>>();
    if(customersError)return reply("Customer search is unavailable.",503);
    let allowedCustomerIds:Set<string>|null=null;
    if(head){
      const downline=await getOperationsHeadDownlinePolicyScope(profile.id);
      if(!downline.intermediaryCodes.length)return good({customers:[]});
      const filter=operationsHeadPolicyFilter(downline);
      const [policies,cases]=await Promise.all([
        admin.from("policies").select("customer_id").or(filter).returns<Array<{customer_id:string}>>(),
        admin.from("life_health_cases").select("customer_id").or(filter).returns<Array<{customer_id:string}>>(),
      ]);
      if(policies.error||cases.error)return reply("Customer scope is unavailable.",503);
      allowedCustomerIds=new Set([...(policies.data??[]),...(cases.data??[])].map(row=>row.customer_id));
    }
    const needle=queryText.toLowerCase();
    const customers=(allCustomers??[])
      .filter(row=>(!allowedCustomerIds||allowedCustomerIds.has(row.id))&&
        [row.contact_name,row.company_name??"",row.phone].some(value=>value.toLowerCase().includes(needle)))
      .slice(0,8)
      .map(row=>({id:row.id,name:row.company_name?.trim()||row.contact_name,
        contactName:row.contact_name,phone:row.phone,email:row.email??""}));
    return good({customers});
  }
  if(body.action==="rc_lookup"){
    if(intake.status!=="in_review"||intake.assigned_to_profile_id!==user.id)return reply("You are no longer the assigned reviewer.",409);
    const creator=await hasEffectiveCapability(profile,"create_policies","edit");
    const allowedPolicy=await getEffectivePermission(profile.id,profile.role,"view_policies");
    if(!head&&!creator&&!["edit","approve"].includes(allowedPolicy.access))return reply("Policy creation permission is required for RC lookup.",403);
    const result=await lookupPolicyRegistrationRcForVerifiedActor(body.registration_no??"");
    if(!result.ok)return reply(result.error,400);
    return good({review:result.review});
  }
  if(body.action==="approval_request"||body.action==="approval_verify"){
    if(intake.status!=="in_review"||intake.assigned_to_profile_id!==user.id)return reply("You are no longer the assigned reviewer.",409);
    const createAllowed=await hasEffectiveCapability(profile,"create_policies","edit");
    const editPermission=await getEffectivePermission(profile.id,profile.role,"view_policies");
    if(!head&&!createAllowed&&!["edit","approve"].includes(editPermission.access))return reply("Policy booking permission is required.",403);
    if(head){
      const downline=await getOperationsHeadDownlinePolicyScope(profile.id);
      if(!intake.lead_source_code||!downline.intermediaryCodes.includes(intake.lead_source_code))return reply("Lead source is outside your downline.",403);
    }
    const {data:stored,error:storedError}=await admin.from("policy_intake_onboarding_drafts")
      .select("draft_payload,revision").eq("intake_id",intake.id).maybeSingle<{draft_payload:PolicyIntakeDraft;revision:number}>();
    if(storedError||!stored||stored.revision!==body.revision)return reply("Save the current draft before requesting approval.",409);
    const approvalInput={issuanceDate:stored.draft_payload.issuanceDate,policyNumber:stored.draft_payload.policyNo,operation:"create" as const,intermediaryCode:stored.draft_payload.intermediaryCode};
    if(body.action==="approval_request"){
      if(!POLICY_DATE_APPROVERS.some(a=>a.key===body.approver_key))return reply("Choose a valid approver.",400);
      const result=await requestPolicyDateApprovalForVerifiedActor({...approvalInput,approverKey:body.approver_key as string},profile);
      if(!result.ok)return reply(result.error,400);
      return good({approval_id:result.approvalId,expires_at:result.expiresAt});
    }
    if(!body.approval_id||!body.otp)return reply("Approval code is missing.",400);
    const result=await verifyPolicyDateApprovalForVerifiedActor(body.approval_id,body.otp,approvalInput,profile);
    if(!result.ok)return reply(result.error,400);
    return good({verified:true});
  }
  if(body.action==="create_life_health"){
    // The verified intake owns the submission. Never accept case/source fields
    // directly from an untrusted mobile body.
    if(intake.status!=="in_review"||intake.assigned_to_profile_id!==user.id)
      return reply("You are no longer the assigned reviewer.",409);
    if(!Number.isSafeInteger(body.revision)||(body.revision??0)<1)
      return reply("Save your latest draft before creating a case.",400);
    const canCreate=await hasEffectiveCapability(profile,"create_policies","edit");
    const legacy=await getEffectivePermission(profile.id,profile.role,"view_policies");
    if(!head&&!canCreate&&!["edit","approve"].includes(legacy.access))
      return reply("Policy creation permission is required.",403);
    const {data:stored,error:storedError}=await admin.from("policy_intake_onboarding_drafts")
      .select("draft_payload,revision").eq("intake_id",intake.id)
      .maybeSingle<{draft_payload:PolicyIntakeDraft & {productDrafts?:Record<string,Record<string,string>>};revision:number}>();
    if(storedError||!stored||stored.revision!==body.revision)
      return reply("Your draft changed. Reload and save before creating a case.",409);
    const d=stored.draft_payload;
    if(d.businessLine!=="Life"&&d.businessLine!=="Health")
      return reply("Create Policy is available only for Life and Health here.",400);
    if(head){
      const downline=await getOperationsHeadDownlinePolicyScope(profile.id);
      if(!d.intermediaryCode||!downline.intermediaryCodes.includes(d.intermediaryCode))
        return reply("This source is outside your approved downline.",403);
    }
    const values=d.productDrafts?.[d.businessLine]??{};
    const required:[string,string][]=[
      ["Proposal date",d.issuanceDate],["Lead source",d.leadSource],
      ["Client / proposer name",d.insuredName],["Client mobile number",d.phoneNo],
      ["Insurance company",values.insurerId],["Product name",values.productName],
      ["Case / proposal number",values.proposalNumber],["Payment frequency",values.paymentFrequency],
      ["Premium amount",values.premiumAmount],["Payment mode",values.paymentMode],
    ];
    const missing=required.find(([,value])=>!String(value??"").trim());
    if(missing)return reply(`${missing[0]} is required.`,400);
    if(!/^\d{4}-\d{2}-\d{2}$/.test(d.issuanceDate))
      return reply("Proposal date must be YYYY-MM-DD.",400);
    if(!/^[6-9]\d{9}$/.test(d.phoneNo))
      return reply("Enter a valid 10 digit Indian mobile number.",400);
    if(!d.intermediaryCode)return reply("Lead source ID is required.",400);
    const {data:sourceCandidates,error:sourceError}=await admin.from("intermediaries")
      .select("id,display_name,intermediary_code")
      .eq("intermediary_code",d.intermediaryCode).limit(10)
      .returns<Array<{id:string;display_name:string;intermediary_code:string|null}>>();
    if(sourceError)return reply("Lead source lookup is temporarily unavailable.",503);
    const matching=(sourceCandidates??[]).filter(row=>
      row.display_name.trim().toLowerCase()===d.leadSource.trim().toLowerCase());
    if(matching.length!==1)return reply("Lead source identity could not be uniquely verified. Refresh and select the source again.",409);
    const form=new FormData();
    const fields:Record<string,string>={
      businessLine:d.businessLine,sourcingDate:d.issuanceDate,intermediaryType:d.intermediaryType,
      intermediaryCode:d.intermediaryCode,sourceId:matching[0].id,leadSource:d.leadSource,rmName:d.rmName,
      insuredName:d.insuredName,phone:d.phoneNo,address:values.address??"",
      insurerId:values.insurerId,productName:values.productName??"",proposalNumber:values.proposalNumber??"",
      ppt:values.ppt??"",pd:values.pd??"",paymentFrequency:values.paymentFrequency??"",
      paymentMode:values.paymentMode??"",premiumAmount:values.premiumAmount??"",
      remarks:values.remarks??d.remarks??"",
    };
    if(commercialAccess){
      const payinFlat=values.payinBasis==="FLAT",payoutFlat=values.partnerPayoutBasis==="FLAT";
      fields.payinBasis=payinFlat?"FIXED_AMOUNT":"NET_PREMIUM_PERCENT";
      fields.payoutBasis=payoutFlat?"FIXED_AMOUNT":"NET_PREMIUM_PERCENT";
      fields[payinFlat?"payinFixedAmount":"payinPercent"]=values.payinValue??"";
      fields.insurerSchemeAmount=values.payinScheme??"";
      fields[payoutFlat?"payoutFixedAmount":"payoutPercent"]=values.partnerPayoutValue??"";
    }
    for(const [key,value] of Object.entries(fields))form.set(key,value);
    // Reuse the authorized Operations case creation engine: staged files are
    // forwarded into its existing validated document attachment pipeline.
    const {data:staged,error:stagedError}=await admin.from("policy_intake_onboarding_documents")
      .select("document_type,storage_bucket,storage_path,file_name,mime_type,file_size")
      .eq("intake_id",intake.id).eq("business_line",d.businessLine)
      .returns<Array<{document_type:string;storage_bucket:string;storage_path:string;file_name:string;mime_type:string;file_size:number}>>();
    if(stagedError)return reply("Onboarding documents are unavailable. Retry before creating the case.",503);
    const docFields:Record<string,string>={
      policy_copy:"policyCopy",proposal_form:"proposalForm",kyc:"kyc",other_document:"otherDocument",
    };
    for(const row of staged??[]){
      const field=docFields[row.document_type];
      if(!field||row.file_size<=0||row.file_size>4*1024*1024)
        return reply("An onboarding document has an invalid type or size.",400);
      const {data:blob,error:downloadError}=await admin.storage.from(row.storage_bucket).download(row.storage_path);
      if(downloadError||!blob)return reply("Could not load an onboarding document. Retry before creating the case.",503);
      const bytes=await blob.arrayBuffer();
      if(bytes.byteLength!==row.file_size)return reply("Onboarding document changed during preparation.",409);
      form.set(field,new File([bytes],row.file_name,{type:row.mime_type}));
    }
    // Claim the intake atomically before any customer/case write: simultaneous
    // taps cannot create multiple Life/Health cases from the same intake.
    const {data:claimed,error:claimError}=await admin.from("policy_intake_requests")
      .update({status:"processing"})
      .eq("id",intake.id).eq("status","in_review").eq("assigned_to_profile_id",user.id)
      .select("id").maybeSingle<{id:string}>();
    if(claimError||!claimed)return reply("This intake is already being processed. Refresh before retrying.",409);
    let created=false;
    try{
      const result=await createLifeHealthCaseForVerifiedActor(form,profile,intake.id);
      if(!result.ok)return reply(result.error,400);
      created=true;
      const {error:completeError}=await admin.from("policy_intake_requests")
        .update({status:"completed",attention_reason:null})
        .eq("id",intake.id).eq("status","processing").eq("assigned_to_profile_id",user.id);
      if(completeError){
        console.error("Life/Health case was created but intake could not be finalized",{intakeId:intake.id,caseId:result.caseId,message:completeError.message});
        return reply(`Case ${result.caseNumber} was created, but Intake finalization needs review. Do not retry Create Policy.`,503);
      }
      return good({case:{id:result.caseId,number:result.caseNumber,status:"awaiting_policy"}});
    }catch(error){
      console.error("Life/Health case creation encountered an error",{intakeId:intake.id,message:error instanceof Error?error.message:"unknown"});
      return reply("Could not confirm the case creation. Check the Case Register before retrying.",503);
    }finally{
      if(!created){
        await admin.from("policy_intake_requests").update({status:"in_review"})
          .eq("id",intake.id).eq("status","processing").eq("assigned_to_profile_id",user.id);
      }
    }
  }
  if(body.action==="book"){
    if(intake.status!=="in_review"||intake.assigned_to_profile_id!==user.id)return reply("You are no longer the assigned reviewer.",409);
    if(!Number.isSafeInteger(body.revision)||(body.revision??0)<1)return reply("Save your latest draft before booking.",400);
    const canCreate=await hasEffectiveCapability(profile,"create_policies","edit");
    const legacy=await getEffectivePermission(profile.id,profile.role,"view_policies");
    if(!head&&!canCreate&&!["edit","approve"].includes(legacy.access))return reply("Policy booking permission is required.",403);
    if(head){
      const downline=await getOperationsHeadDownlinePolicyScope(profile.id);
      if(!intake.lead_source_code||!downline.intermediaryCodes.includes(intake.lead_source_code))return reply("This lead source is outside your approved downline.",403);
    }
    const {data:stored,error:storedError}=await admin.from("policy_intake_onboarding_drafts")
      .select("draft_payload,revision").eq("intake_id",intake.id).maybeSingle<{draft_payload:PolicyIntakeDraft & Record<string,unknown>;revision:number}>();
    if(storedError||!stored||stored.revision!==body.revision)return reply("Your draft changed. Reload and save before booking.",409);
    const d=stored.draft_payload;
    if(d.businessLine!=="Motor")return reply("This native booking flow currently supports Motor policies only.",400);
    const resolution=body.resolution;
    if(resolution && (typeof resolution!=="object"||Array.isArray(resolution)))return reply("Invalid booking resolution.",400);
    const isCpm=d.vehicleClass==="CPM";
    const isThirdParty=d.policyProduct==="Third Party";
    const payload:PolicyOnboardingPayload={
      sourceIntakeId:intake.id,draftRevision:stored.revision,dateApprovalId:body.date_approval_id??null,
      customer:{name:d.insuredName,phone:d.phoneNo,type:"individual",source:d.leadSource},
      vehicle:{
        registrationMode:d.registrationMode,registrationNumber:d.registrationMode==="registered"?d.registrationNo:"",
        classCode:d.vehicleClass,make:d.make,model:d.model,fuelType:d.fuelType,manufacturingYear:d.manufacturingYear,
        capacity:d.capacity,chassisNumber:d.chassisNo,engineNumber:d.engineNo,rtoName:d.rtoName,rtoState:d.rtoState,
        registrationStatus:d.registrationMode==="unregistered"?"registration_pending":"",
      },
      policy:{
        issuanceDate:d.issuanceDate,rmName:d.rmName,intermediaryType:d.intermediaryType,leadSource:d.leadSource,intermediaryCode:d.intermediaryCode,
        businessLine:d.businessLine,policyType:d.policyProduct,idv:isThirdParty?"0":d.idv,policyNumber:d.policyNo,
        insuranceCompanyId:d.insurerId,validFrom:d.validFrom,validUpto:d.validUpto,
        odValidUpto:d.validUpto,tpValidUpto:String(d.tpValidUpto??""),cpaValidUpto:String(d.cpaValidUpto??""),remarks:d.remarks,
      },
      premium:{
        od:isThirdParty?"0":d.od,tp:isCpm?"0":d.tp,addOnPremium:String(d.addOnPremium??"0"),
        cpaOpted:!isCpm&&d.cpaOpted==="Yes",cpa:isCpm?"0":d.cpa,
      },
      payin:{basis:d.payoutBasis||"NET",odPercent:commercialAccess?d.projectedOdPercent:"",tpPercent:commercialAccess?d.projectedTpPercent:"",scheme:commercialAccess?d.insurerScheme:"",provided:commercialAccess&&Boolean(d.projectedOdPercent.trim()||d.projectedTpPercent.trim()||d.insurerScheme.trim())},
      billing:{billNumber:"",billedAmount:"0",billDate:"",status:"Unbilled"},
      payout:{retention:commercialAccess?d.retention:"",odPercent:commercialAccess?d.payoutOdPercent:"",tpPercent:commercialAccess?d.payoutTpPercent:"",flatAmount:commercialAccess?d.flatPayoutAmount:"",status:"Pending",date:"",voucherNumber:"",provided:commercialAccess&&Boolean(d.payoutOdPercent.trim()||d.payoutTpPercent.trim()||d.flatPayoutAmount.trim())},
      authbridge:{applied:false,transactionId:"",providerTransactionId:"",lookedUpAt:""},
      resolution,
    };
    // The same server-only engine and transactional RPC used by the website handles
    // validation, customer/vehicle matching, coverage conflicts, date approval and booking.
    const result=await onboardPolicyForVerifiedActor(payload,profile,true);
    return good({booking:result});
  }
  if(body.action==="save"){
    if(intake.status!=="in_review"||intake.assigned_to_profile_id!==user.id)return reply("You are no longer the assigned reviewer.",409);
    if(!Number.isSafeInteger(body.revision)||!body.revision||!body.draft||typeof body.draft!=="object"||Array.isArray(body.draft))return reply("Invalid draft revision or values.",400);
    // The website draft can contain extra form fields (e.g. add-ons and bundled validity).
    // Allow editing only the approved shared subset while preserving the rest exactly.
    if(fields.some(key=>typeof body.draft?.[key]!=="string"||body.draft[key].length>4000))return reply("Invalid onboarding draft fields.",400);
    const extraValues=body.draft as unknown as Record<string,unknown>;
    if(nativeOptionalFields.some(key=>extraValues[key]!=null&&(typeof extraValues[key]!=="string"||(extraValues[key] as string).length>4000)))return reply("Invalid premium or bundled validity values.",400);
    if(!["registered","unregistered"].includes(body.draft.registrationMode)||!["Yes","No"].includes(body.draft.cpaOpted))return reply("Invalid onboarding draft options.",400);
    if(!["Motor",...nonMotorTypes].includes(body.draft.businessLine))return reply("Unsupported policy type.",400);
    const proposedProductDrafts = (body.draft as unknown as Record<string,unknown>).productDrafts;
    if(proposedProductDrafts!==undefined){
      if(!proposedProductDrafts||typeof proposedProductDrafts!=="object"||Array.isArray(proposedProductDrafts))return reply("Invalid product draft.",400);
      const entries=Object.entries(proposedProductDrafts);
      if(entries.length>nonMotorTypes.length||entries.some(([type,values])=>
        !(nonMotorTypes as readonly string[]).includes(type)||
        !values||typeof values!=="object"||Array.isArray(values)||
        Object.entries(values).some(([key,value])=>!productDraftKeys.has(key)||typeof value!=="string"||value.length>2000)
      ))return reply("Unsupported product draft fields.",400);
    }
    if(proposedProductDrafts!==undefined){
      for(const [,values] of Object.entries(proposedProductDrafts as Record<string,Record<string,string>>)){
        if(!commercialAccess && Object.keys(values).some(key=>productCommercialKeys.has(key)))
          return reply("Commercial terms require financial access.",403);
        for(const key of productCommercialKeys){
          const value=values[key];
          if(value===undefined||value==="")continue;
          if(key==="payinBasis"||key==="partnerPayoutBasis"){
            if(!["NET","FLAT"].includes(value))return reply("Invalid commercial basis.",400);
          }else if(!/^\d+(?:\.\d{1,2})?$/.test(value)||!Number.isFinite(Number(value))||Number(value)>(key.endsWith("Value")&&values[key.replace("Value","Basis")]==="NET"?100:100000000000)){
            return reply("Invalid projected commercial value.",400);
          }
        }
      }
    }
    const {data:stored,error:storedError}=await admin.from("policy_intake_onboarding_drafts")
      .select("draft_payload,revision").eq("intake_id",intake.id).maybeSingle<{draft_payload:PolicyIntakeDraft;revision:number}>();
    if(storedError||!stored||stored.revision!==body.revision)return reply("Draft changed. Reload the latest version.",409);
    const saveDraft:Record<string,unknown>={...stored.draft_payload};
    for(const key of fields){
      if(!commercialAccess && (commercialFields as readonly string[]).includes(key))continue;
      saveDraft[key]=body.draft[key];
    }
    for(const key of nativeOptionalFields)if(extraValues[key]!=null)saveDraft[key]=extraValues[key];
    if(proposedProductDrafts!==undefined){
      // Keep each product's form separate from Motor and from restricted commercials.
      const previous=(stored.draft_payload as PolicyIntakeDraft & {productDrafts?:Record<string,Record<string,string>>}).productDrafts??{};
      saveDraft.productDrafts=Object.fromEntries(
        Object.entries(proposedProductDrafts as Record<string,Record<string,string>>).map(([type,values])=>[
          type,{...previous[type],...values}
        ])
      );
    }
    const {data,error}=await admin.from("policy_intake_onboarding_drafts")
      .update({draft_payload:saveDraft,revision:(body.revision as number)+1,updated_by_profile_id:user.id,updated_at:new Date().toISOString()})
      .eq("intake_id",intake.id).eq("revision",body.revision as number).select("revision").maybeSingle<{revision:number}>();
    if(error)return reply("Policy Onboarding draft could not be saved.",503);
    if(!data)return reply("The draft was edited elsewhere. Reload before saving.",409);
    return good({revision:data.revision});
  }
  if(!["ready_for_review","in_review","processing"].includes(intake.status))return reply("This intake is no longer available for onboarding.",409);
  const conflict=Boolean(intake.assigned_to_profile_id&&intake.assigned_to_profile_id!==user.id);
  if(conflict&&(body.take_over!==true||body.expected_reviewer_id!==intake.assigned_to_profile_id))return reply("Reviewer changed. Return to Intake and confirm again.",409);
  if(!conflict&&body.take_over===true)return reply("Reviewer changed. Refresh Intake and try again.",409);
  let assignment=admin.from("policy_intake_requests").update({status:"in_review",assigned_to_profile_id:user.id,attention_reason:null})
    .eq("id",intake.id).in("status",["ready_for_review","in_review","processing"]);
  assignment=conflict?assignment.eq("assigned_to_profile_id",intake.assigned_to_profile_id as string)
    :assignment.or(`assigned_to_profile_id.is.null,assigned_to_profile_id.eq.${user.id}`);
  const {data:claimed,error:claimError}=await assignment.select("id").maybeSingle<{id:string}>();
  if(claimError||!claimed)return reply("Reviewer changed while opening the intake. Please retry.",409);
  const {data:existing,error:existingError}=await admin.from("policy_intake_onboarding_drafts")
    .select("draft_payload,revision").eq("intake_id",intake.id).maybeSingle<{draft_payload:PolicyIntakeDraft;revision:number}>();
  if(existingError)return reply("Onboarding draft could not be loaded.",503);
  const [insurerResult,manufacturerResult,brandResult]=await Promise.all([
    admin.from("insurance_companies").select("id,name").eq("is_active",true).order("name"),
    admin.from("vehicle_manufacturers").select("id").eq("is_active",true),
    admin.from("vehicle_manufacturer_brands").select("manufacturer_id,brand_name").eq("is_active",true).order("brand_name"),
  ]);
  if(insurerResult.error||manufacturerResult.error||brandResult.error)return reply("Policy master data is unavailable.",503);
  const insurers=(insurerResult.data??[]).map(x=>({value:x.id,label:x.name}));
  const allowed=new Set((manufacturerResult.data??[]).map(x=>x.id));
  const manufacturers=Array.from(new Set((brandResult.data??[]).filter(x=>allowed.has(x.manufacturer_id)).map(x=>x.brand_name))).sort();
  let draft=existing?.draft_payload??null;
  let revision=existing?.revision??0;
  if(!draft){
    const mapped=buildPolicyOcrOnboardingUpdate({
      mode:"create",registrationMode:"registered",current:{registrationNo:"",vehicleClass:"",make:"",model:"",fuelType:"",manufacturingYear:"",capacity:"",chassisNo:"",engineNo:"",rtoState:"",rtoName:"",policyProduct:"",idv:"",od:"",tp:"",cpa:"",policyNo:"",insurerId:"",validFrom:"",validUpto:""},
      fields:intake.ocr_fields??[],manufacturers,insurers,rcVerified:false
    });
    const x=mapped.next;
    draft={
      registrationMode:mapped.registrationMode,issuanceDate:new Date().toISOString().slice(0,10),rmName:"",intermediaryType:intake.lead_source_type==="posp"?"POSP":intake.lead_source_type==="misp"?"MISP":"SIBL / Partner",
      leadSource:intake.lead_source_name,intermediaryCode:intake.lead_source_code??"",businessLine:"Motor",
      registrationNo:x.registrationNo,insuredName:x.insuredName??"",phoneNo:intake.customer_mobile,vehicleClass:x.vehicleClass,make:x.make,model:x.model,fuelType:x.fuelType,capacity:x.capacity,manufacturingYear:x.manufacturingYear,chassisNo:x.chassisNo,engineNo:x.engineNo,rtoState:x.rtoState,rtoName:x.rtoName,
      policyProduct:x.policyProduct,idv:x.idv,od:x.od,tp:x.tp,cpaOpted:"No",cpa:x.cpa,policyNo:x.policyNo,insurerId:x.insurerId,validFrom:x.validFrom,validUpto:x.validUpto,
      payoutBasis:"NET",projectedOdPercent:"",projectedTpPercent:"",insurerScheme:"",payinBillNo:"",payinBilledAmount:"",payinBillDate:"",payinStatus:"Unbilled",retention:"",payoutOdPercent:"",payoutTpPercent:"",flatPayoutAmount:"",payoutStatus:"Pending",payoutDate:"",payoutVoucherNo:"",remarks:`Policy Intake ${intake.id}`
    };
    const {data:inserted,error:insertError}=await admin.from("policy_intake_onboarding_drafts")
      .insert({intake_id:intake.id,draft_payload:draft,revision:1,updated_by_profile_id:user.id})
      .select("revision").single<{revision:number}>();
    if(insertError||!inserted)return reply("Policy Onboarding draft could not be prepared.",503);
    revision=inserted.revision;
  }
  // Never return restricted insurance pay-in, retention or partner payout values to non-commercial reviewers.
  const visibleDraft={...draft};
  if(!commercialAccess){
    for(const key of commercialFields)visibleDraft[key]="";
    // Never disclose isolated Life/Health/Non Motor commercial terms to non-financial reviewers.
    const isolated=(draft as PolicyIntakeDraft & {productDrafts?:Record<string,Record<string,string>>}).productDrafts;
    if(isolated){
      (visibleDraft as typeof visibleDraft & {productDrafts?:Record<string,Record<string,string>>}).productDrafts=
        Object.fromEntries(Object.entries(isolated).map(([type,values])=>[
          type,Object.fromEntries(Object.entries(values).filter(([key])=>!productCommercialKeys.has(key)))
        ]));
    }
  }
  // Mirror the Operations Portal's authoritative source-owner resolution.
  // Return only metadata for this already-authorized intake and selected source,
  // never a complete source directory or another employee's downline.
  let sourceMeta: {name:string;code:string;mobile:string;rmName:string;rmCode:string;rmMobile:string}|null=null;
  if(intake.lead_source_code && draft.intermediaryCode===intake.lead_source_code &&
     String(draft.leadSource).trim().toLowerCase()===intake.lead_source_name.trim().toLowerCase()){
    const {data:source,error:sourceError}=await admin.from("intermediaries")
      .select("id,intermediary_type,display_name,intermediary_code,mobile,associate_employee_id,application_id")
      .eq("intermediary_code",intake.lead_source_code).eq("account_status","active")
      .limit(10).returns<Array<{id:string;intermediary_type:string;display_name:string;intermediary_code:string|null;mobile:string|null;associate_employee_id:string|null;application_id:string|null}>>();
    if(!sourceError){
      const selected=(source??[]).find(item=>item.display_name.trim().toLowerCase()===intake.lead_source_name.trim().toLowerCase()&&item.intermediary_type===intake.lead_source_type);
      if(selected){
        let ownerId=selected.associate_employee_id;
        if(selected.application_id){
          const {data:owner}=await admin.from("posp_misp_onboarding_profiles")
            .select("associate_employee_id").eq("application_id",selected.application_id)
            .maybeSingle<{associate_employee_id:string|null}>();
          if(owner)ownerId=owner.associate_employee_id;
          else if(selected.intermediary_type==="partner"&&!ownerId){
            const {data:application}=await admin.from("intermediary_onboarding_applications")
              .select("partner_record_id").eq("id",selected.application_id)
              .maybeSingle<{partner_record_id:string|null}>();
            if(application?.partner_record_id){
              const {data:partnerOwner}=await admin.from("posp_misp_onboarding_profiles")
                .select("associate_employee_id").eq("partner_record_id",application.partner_record_id)
                .not("associate_employee_id","is",null).order("created_at",{ascending:false}).limit(1)
                .maybeSingle<{associate_employee_id:string|null}>();
              ownerId=partnerOwner?.associate_employee_id??null;
            }
          }
        }
        let rmName="",rmCode="",rmMobile="";
        if(ownerId){
          try{
            const associates=await loadPospMispAssociates(admin);
            const owner=associates.find(item=>item.id===ownerId);
            rmName=owner?.full_name?.trim()??"";
            rmCode=owner?.employee_code?.trim()??"";
            if(owner){
              // Resolve only this intake's verified assigned RM; never expose the employee directory.
              const {data:rm}=await admin.from("employees")
                .select("phone").eq("id",owner.id).eq("employment_status","active")
                .ilike("department","sales").maybeSingle<{phone:string|null}>();
              rmMobile=rm?.phone?.replace(/\D/g,"").slice(-10)??"";
            }
          }catch{
            // Do not substitute guessed codes if the master is unavailable.
          }
        }
        sourceMeta={name:selected.display_name.trim(),code:selected.intermediary_code??"",
          mobile:selected.mobile?.replace(/\D/g,"").slice(-10)??"",rmName,rmCode,rmMobile};
      }
    }
  }
  return good({draft:visibleDraft,revision,intake_number:intake.intake_number,insurers,manufacturers,sourceMeta,commercialAccess,approvers:POLICY_DATE_APPROVERS.map(a=>({key:a.key,name:a.name}))});
}
