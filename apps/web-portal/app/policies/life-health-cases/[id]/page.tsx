import { notFound } from "next/navigation";
import { AppShell } from "@/components/shell";
import { LifeHealthCaseDetail } from "@/components/life-health-case-detail";
import { LifeHealthCaseErrorPopupGuard } from "@/components/life-health-case-error-popup-guard";
import { requirePolicyCreator } from "@/lib/policy-access-server";
import { requireCapability } from "@/lib/master-data-server";
import { getOperationsHeadDownlinePolicyScope, operationsHeadVisiblePolicyFilter } from "@/lib/policy-access-scope";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type CaseRow = { id:string; case_number:string; business_line:"Life"|"Health"; status:string; sourcing_date:string; customer_id:string; insurance_company_id:string; product_name:string; proposal_number:string; premium_paying_term:string|null; policy_duration:string|null; payment_frequency:string; payment_mode:string; premium_amount:number; intermediary_type:string|null; intermediary_code:string|null; lead_source:string|null; intermediary_mobile:string|null; rm_name:string|null; rm_code:string|null; remarks:string|null; final_policy_id:string|null; converted_at:string|null; created_at:string; created_by:string|null; converted_by:string|null };
type CustomerRow = { id:string; contact_name:string; company_name:string|null; phone:string; email:string|null; address:string|null; address_street:string|null };
type InsurerRow = { id:string; name:string };
type DocumentRow = { id:string; document_type:string; file_name:string; created_at:string; uploaded_by:string|null };
type PolicyRow = { id:string; policy_no:string; policy_code:string|null };
type ProfileRow = { id:string; full_name:string|null };
type CaseAuditRow = {id:string;actor_id:string|null;created_at:string;new_data:{changed_fields?:unknown}|null};
type ActivityRow = { id:string; action:string; createdAt:string; createdBy:string;changes?:string[] };

const documentAction=(type:string)=>type==="policy_copy"?"Policy Doc. Uploaded":type==="proposal_form"?"Proposal Form Uploaded":type==="kyc"?"KYC Uploaded":"Document Uploaded";

export default async function LifeHealthCasePage({ params }: { params: Promise<{ id: string }> }) {
  const profile = await requireCapability("view_policies");
  if (profile.role !== "operations_head_life") await requirePolicyCreator();
  const admin = createSupabaseAdminClient();
  const { id } = await params;
  let request = admin.from("life_health_cases")
    .select("id,case_number,business_line,status,sourcing_date,customer_id,insurance_company_id,product_name,proposal_number,premium_paying_term,policy_duration,payment_frequency,payment_mode,premium_amount,intermediary_type,intermediary_code,lead_source,intermediary_mobile,rm_name,rm_code,remarks,final_policy_id,converted_at,created_at,created_by,converted_by")
    .eq("id", id);
  if (profile.role === "operations_head_life") {
    const downlineFilter = operationsHeadVisiblePolicyFilter(await getOperationsHeadDownlinePolicyScope(profile.id));
    if (!downlineFilter) notFound();
    request = request.or(downlineFilter);
  }
  const { data: caseRow, error } = await request.maybeSingle<CaseRow>();
  if (error || !caseRow) notFound();
  const [customerResult, insurerResult, insurersResult, documentsResult, policyResult] = await Promise.all([
    admin.from("customers").select("id,contact_name,company_name,phone,email,address,address_street").eq("id", caseRow.customer_id).maybeSingle<CustomerRow>(),
    admin.from("insurance_companies").select("id,name").eq("id", caseRow.insurance_company_id).maybeSingle<InsurerRow>(),
    admin.from("insurance_companies").select("id,name").eq("is_active", true).order("name").returns<InsurerRow[]>(),
    admin.from("life_health_case_documents").select("id,document_type,file_name,created_at,uploaded_by").eq("case_id", id).order("created_at", { ascending: true }).returns<DocumentRow[]>(),
    caseRow.final_policy_id ? admin.from("policies").select("id,policy_no,policy_code").eq("id", caseRow.final_policy_id).maybeSingle<PolicyRow>() : Promise.resolve({ data: null, error: null }),
  ]);

  const {data:caseEditAudits}=await admin.from("audit_logs")
    .select("id,actor_id,created_at,new_data")
    .eq("table_name","life_health_cases").eq("record_id",id)
    .eq("action","life_health_case_edited").order("created_at",{ascending:false})
    .limit(100).returns<CaseAuditRow[]>();
  const documents=documentsResult.data??[];
  const actorIds=Array.from(new Set([caseRow.created_by,caseRow.converted_by,...documents.map(document=>document.uploaded_by),...(caseEditAudits??[]).map(audit=>audit.actor_id)].filter((value):value is string=>Boolean(value))));
  const profilesResult=actorIds.length?await admin.from("profiles").select("id,full_name").in("id",actorIds).returns<ProfileRow[]>():{data:[] as ProfileRow[],error:null};
  const actorNames=new Map((profilesResult.data??[]).map(profile=>[profile.id,profile.full_name?.trim()||"User"]));
  const activities:ActivityRow[]=[
    {id:`case-${caseRow.id}`,action:"Case Created",createdAt:caseRow.created_at,createdBy:caseRow.created_by?actorNames.get(caseRow.created_by)||"User":"User"},
    ...documents.map(document=>({id:`document-${document.id}`,action:documentAction(document.document_type),createdAt:document.created_at,createdBy:document.uploaded_by?actorNames.get(document.uploaded_by)||"User":"User"})),
    ...(caseEditAudits??[]).map(audit=>{
      const raw=audit.new_data?.changed_fields;
      // Only accept the labelled changes written by our trusted case editor.
      const safeText=(value:string)=>/^(?:[a-zA-Z0-9 ._\/-]{1,70}|Not set|Changed)$/.test(value);
      const safeChange=(change:unknown):change is string=>{
        if(typeof change!=="string"||change.length>180)return false;
        if(/^(Insurer|Proposal number|Customer name|Address) changed \(values hidden\)$/.test(change))return true;
        const mobile=change.match(/^Mobile number: (••••••[0-9]{4}|Not set) → (••••••[0-9]{4}|Not set)$/);
        if(mobile)return true;
        const match=change.match(/^(Product|Premium|Premium paying term|Policy duration|Payment frequency|Payment mode|Sourcing date): (.*?) → (.*?)$/);
        if(!match)return false;
        if(match[1]==="Premium")return /^(?:₹[0-9,]+[.][0-9]{2}|Not set)$/.test(match[2])
          &&/^(?:₹[0-9,]+[.][0-9]{2}|Not set)$/.test(match[3]);
        return safeText(match[2])&&safeText(match[3]);
      };
      const changes=Array.isArray(raw)?raw.filter(safeChange).slice(0,20):[];
      return {id:`case-audit-${audit.id}`,action:changes.length===1?changes[0].split(":")[0]+" Updated":"Case Details Updated",
        createdAt:audit.created_at,createdBy:audit.actor_id?actorNames.get(audit.actor_id)||"User":"User",changes};
    }),
    ...(caseRow.converted_at?[{id:`converted-${caseRow.id}`,action:"Policy Created & Case Closed",createdAt:caseRow.converted_at,createdBy:caseRow.converted_by?actorNames.get(caseRow.converted_by)||"User":"User"}]:[]),
  ].sort((a,b)=>new Date(b.createdAt).getTime()-new Date(a.createdAt).getTime());

  const customer = customerResult.data;
  const insurer = insurerResult.data;
  return <AppShell title="Life / Health Case">
    <LifeHealthCaseErrorPopupGuard />
    <LifeHealthCaseDetail
      caseData={{
        id:caseRow.id, caseNumber:caseRow.case_number, businessLine:caseRow.business_line, status:caseRow.status, sourcingDate:caseRow.sourcing_date,
        customerId:caseRow.customer_id, customerName:customer?.company_name?.trim()||customer?.contact_name||"Customer", customerPhone:customer?.phone||"", customerAddress:customer?.address_street?.trim()||customer?.address?.trim()||"",
        insurerId:caseRow.insurance_company_id, insurerName:insurer?.name||"Insurer", productName:caseRow.product_name, proposalNumber:caseRow.proposal_number,
        ppt:caseRow.premium_paying_term||"", pd:caseRow.policy_duration||"", paymentFrequency:caseRow.payment_frequency, paymentMode:caseRow.payment_mode, premiumAmount:Number(caseRow.premium_amount||0),
        intermediaryType:caseRow.intermediary_type||"", intermediaryCode:caseRow.intermediary_code||"", leadSource:caseRow.lead_source||"", intermediaryMobile:caseRow.intermediary_mobile||"", rmName:caseRow.rm_name||"", rmCode:caseRow.rm_code||"", remarks:caseRow.remarks||"",
        finalPolicyId:caseRow.final_policy_id, finalPolicyNo:policyResult.data?.policy_no||null, finalPolicyCode:policyResult.data?.policy_code||null, convertedAt:caseRow.converted_at,
      }}
      insurers={insurersResult.data ?? []}
      documents={documents}
      activities={activities}
    />
  </AppShell>;
}
