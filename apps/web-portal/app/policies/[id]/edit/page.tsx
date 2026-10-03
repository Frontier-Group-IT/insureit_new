import { notFound } from "next/navigation";
import { AppShell } from "@/components/shell";
import { LifeHealthIssuedPolicyEditForm, type LifeHealthIssuedEditSource } from "@/components/life-health-issued-policy-edit-form";
import { requirePolicyEditor } from "@/lib/policy-access-server";
import { canAccessPolicyCommercials } from "@/lib/policy-commercial-access";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { getActiveInsuranceCompanyOptions } from "@/lib/reference-data-cache";
import { loadPolicyActivityHistory } from "@/lib/policy-activity";
import StandardPolicyEditPage from "./policy-edit-standard";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type PolicyRouteRow = { id:string; business_line:string|null; customer_id:string; insurance_company_id:string|null; issuance_date:string|null; start_date:string|null; end_date:string|null; premium_amount:number|null; insured_declared_value:number|null; remarks:string|null; policy_no:string|null; rm_name:string|null; rm_employee_id:string|null; created_by:string|null; created_at:string|null; updated_at:string|null };
type CaseEditRow = { id:string; business_line:"Life"|"Health"; sourcing_date:string; intermediary_id:string|null; intermediary_type:string|null; intermediary_code:string|null; lead_source:string|null; rm_employee_id:string|null; rm_name:string|null; rm_code:string|null; customer_id:string; insurance_company_id:string; product_name:string; proposal_number:string; premium_paying_term:string|null; policy_duration:string|null; payment_frequency:string; payment_mode:string; premium_amount:number; remarks:string|null };
type CustomerRow = { contact_name:string; company_name:string|null; phone:string; email:string|null };
type IntermediaryRow = { id:string; intermediary_type:"posp"|"misp"|"partner"; display_name:string; intermediary_code:string|null; mobile:string|null; associate_employee_id:string|null };
type EmployeeRow = { id:string; full_name:string|null; employee_code:string|null };
type DocumentRow = { id:string; document_type:string; file_name:string; storage_bucket:string; storage_path:string };
type PayinRow = { commercial_status:string|null; projected_commission_amount:number|null; insurer_scheme_amount:number|null };
type PayoutRow = { commercial_status:string|null; partner_payout_amount:number|null; gross_payout:number|null; retention_amount:number|null };

export default async function EditPolicyPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  const policyEditor = await requirePolicyEditor();
  const commercialAccess = canAccessPolicyCommercials(policyEditor);
  const admin = createSupabaseAdminClient();
  const { data: policy, error } = await admin.from("policies").select("id,business_line,customer_id,insurance_company_id,issuance_date,start_date,end_date,premium_amount,insured_declared_value,remarks,policy_no,rm_name,rm_employee_id,created_by,created_at,updated_at").eq("id", resolvedParams.id).maybeSingle<PolicyRouteRow>();

  if (!error && policy && (policy.business_line === "Life" || policy.business_line === "Health")) {
    const { data: lifeHealthCase } = await admin.from("life_health_cases").select("id,business_line,sourcing_date,intermediary_id,intermediary_type,intermediary_code,lead_source,rm_employee_id,rm_name,rm_code,customer_id,insurance_company_id,product_name,proposal_number,premium_paying_term,policy_duration,payment_frequency,payment_mode,premium_amount,remarks").eq("final_policy_id", resolvedParams.id).order("converted_at", { ascending:false }).limit(1).maybeSingle<CaseEditRow>();
    if (!lifeHealthCase) notFound();

    const [{ data: customer }, { data: intermediaryRows }, { data: documentRows }, insurerOptions, activityHistory, payinResult, payoutResult] = await Promise.all([
      admin.from("customers").select("contact_name,company_name,phone,email").eq("id", lifeHealthCase.customer_id).maybeSingle<CustomerRow>(),
      admin.from("intermediaries").select("id,intermediary_type,display_name,intermediary_code,mobile,associate_employee_id").in("intermediary_type", ["posp","misp","partner"]).eq("account_status","active").order("display_name", { ascending:true }).returns<IntermediaryRow[]>(),
      admin.from("life_health_case_documents").select("id,document_type,file_name,storage_bucket,storage_path").eq("case_id", lifeHealthCase.id).in("document_type", ["policy_copy","proposal_form","benefit_illustration","premium_receipt","other_document"]).returns<DocumentRow[]>(),
      getActiveInsuranceCompanyOptions(),
      loadPolicyActivityHistory({ policyId:policy.id, createdBy:policy.created_by, createdAt:policy.created_at, updatedAt:policy.updated_at }),
      commercialAccess ? admin.from("policy_payin_details").select("commercial_status,projected_commission_amount,insurer_scheme_amount").eq("policy_id", policy.id).maybeSingle<PayinRow>() : Promise.resolve({ data:null as PayinRow|null, error:null }),
      commercialAccess ? admin.from("policy_intermediary_payouts").select("commercial_status,partner_payout_amount,gross_payout,retention_amount").eq("policy_id", policy.id).order("created_at", { ascending:false }).limit(1).maybeSingle<PayoutRow>() : Promise.resolve({ data:null as PayoutRow|null, error:null }),
    ]);
    if (!customer) notFound();
    if (payinResult.error) throw new Error(`Unable to load Life/Health PayIn summary: ${payinResult.error.message}`);
    if (payoutResult.error) throw new Error(`Unable to load Life/Health payout summary: ${payoutResult.error.message}`);

    const employeeIds = Array.from(new Set([...(intermediaryRows ?? []).map((row)=>row.associate_employee_id), lifeHealthCase.rm_employee_id, policy.rm_employee_id].filter((id): id is string => Boolean(id))));
    const { data: employees } = employeeIds.length ? await admin.from("employees").select("id,full_name,employee_code").in("id", employeeIds).returns<EmployeeRow[]>() : { data:[] as EmployeeRow[] };
    const employeeById = new Map((employees ?? []).map((employee)=>[employee.id, employee]));
    const savedRmEmployee = (lifeHealthCase.rm_employee_id ? employeeById.get(lifeHealthCase.rm_employee_id) : null) ?? (policy.rm_employee_id ? employeeById.get(policy.rm_employee_id) : null);
    const savedRmName = savedRmEmployee?.full_name?.trim() || lifeHealthCase.rm_name?.trim() || policy.rm_name?.trim() || "";
    const savedRmCode = savedRmEmployee?.employee_code?.trim() || lifeHealthCase.rm_code?.trim() || "";

    const sources: LifeHealthIssuedEditSource[] = (intermediaryRows ?? []).map((row) => {
      const employee = row.associate_employee_id ? employeeById.get(row.associate_employee_id) : null;
      const isSavedSource = row.id === lifeHealthCase.intermediary_id;
      return { id:row.id, type:row.intermediary_type === "posp" ? "POSP" : row.intermediary_type === "misp" ? "MISP" : "SIBL / Partner", label:row.display_name, code:row.intermediary_code?.trim() || "", mobile:row.mobile?.replace(/\D/g, "").slice(-10) || "", rmName:employee?.full_name?.trim() || (isSavedSource ? savedRmName : ""), rmCode:employee?.employee_code?.trim() || (isSavedSource ? savedRmCode : "") };
    });
    if (lifeHealthCase.intermediary_id && !sources.some((source)=>source.id === lifeHealthCase.intermediary_id)) sources.unshift({ id:lifeHealthCase.intermediary_id, type:lifeHealthCase.intermediary_type === "POSP" ? "POSP" : lifeHealthCase.intermediary_type === "MISP" ? "MISP" : "SIBL / Partner", label:lifeHealthCase.lead_source || "Saved source", code:lifeHealthCase.intermediary_code || "", mobile:"", rmName:savedRmName, rmCode:savedRmCode });
    const insurers = insurerOptions.filter((option)=>option.segment === "life" || option.segment === "health" || option.value === lifeHealthCase.insurance_company_id).map(({ value,label })=>({ value,label }));

    const documents = await Promise.all((documentRows ?? []).map(async (row) => {
      const { data:signed } = await admin.storage.from(row.storage_bucket).createSignedUrl(row.storage_path, 60 * 60);
      return { id:row.id, type:row.document_type as "policy_copy"|"proposal_form"|"benefit_illustration"|"premium_receipt"|"other_document", fileName:row.file_name, viewUrl:signed?.signedUrl || "" };
    }));
    const activityItems = activityHistory.map((activity)=>({ id:activity.id, title:activity.action, meta:activity.actorName ? `Created By: ${activity.actorName}` : null, at:activity.at }));
    const payin = payinResult.data;
    const payout = payoutResult.data;
    const commercialSummary = {
      payinEntered:Boolean(payin),
      payoutEntered:Boolean(payout),
      insurerPayin:Number(payin?.projected_commission_amount ?? payin?.insurer_scheme_amount ?? 0),
      partnerPayout:Number(payout?.partner_payout_amount ?? payout?.gross_payout ?? 0),
      retention:Number(payout?.retention_amount ?? 0),
    };

    return <AppShell title="Edit Policy"><LifeHealthIssuedPolicyEditForm initial={{
      policyId:policy.id, caseId:lifeHealthCase.id, businessLine:lifeHealthCase.business_line, sourcingDate:policy.issuance_date || lifeHealthCase.sourcing_date || "", sourceId:lifeHealthCase.intermediary_id || sources[0]?.id || "", customerName:customer.company_name?.trim() || customer.contact_name, customerPhone:customer.phone, customerEmail:customer.email || "", insurerId:lifeHealthCase.insurance_company_id || policy.insurance_company_id || "", productName:lifeHealthCase.product_name, policyNumber:policy.policy_no || "", proposalNumber:lifeHealthCase.proposal_number, ppt:lifeHealthCase.premium_paying_term || "", pd:lifeHealthCase.policy_duration || "", paymentFrequency:lifeHealthCase.payment_frequency, premiumAmount:String(lifeHealthCase.premium_amount ?? ""), paymentMode:lifeHealthCase.payment_mode, remarks:policy.remarks || lifeHealthCase.remarks || "", startDate:policy.start_date || "", endDate:policy.end_date || "", finalPremium:String(policy.premium_amount ?? lifeHealthCase.premium_amount ?? ""), sumInsured:policy.insured_declared_value == null ? "" : String(policy.insured_declared_value),
    }} insurers={insurers} sources={sources} activityItems={activityItems} documents={documents} commercialAccess={commercialAccess} commercialSummary={commercialSummary} /></AppShell>;
  }
  return <StandardPolicyEditPage params={Promise.resolve(resolvedParams)} />;
}