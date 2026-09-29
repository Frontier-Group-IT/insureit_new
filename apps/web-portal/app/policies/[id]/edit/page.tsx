import { notFound } from "next/navigation";
import { AppShell } from "@/components/shell";
import { LifeHealthIssuedPolicyEditForm, type LifeHealthIssuedEditSource } from "@/components/life-health-issued-policy-edit-form";
import { requirePolicyEditor } from "@/lib/policy-access-server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { getActiveInsuranceCompanyOptions } from "@/lib/reference-data-cache";
import StandardPolicyEditPage from "./policy-edit-standard";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type PolicyRouteRow = { id: string; business_line: string | null; customer_id: string; insurance_company_id: string | null; issuance_date: string | null; premium_amount: number | null; remarks: string | null };
type CaseEditRow = { id: string; business_line: "Life" | "Health"; sourcing_date: string; intermediary_id: string | null; intermediary_type: string | null; intermediary_code: string | null; lead_source: string | null; rm_name: string | null; rm_code: string | null; customer_id: string; insurance_company_id: string; product_name: string; proposal_number: string; premium_paying_term: string | null; policy_duration: string | null; payment_frequency: string; payment_mode: string; premium_amount: number; remarks: string | null };
type CustomerRow = { contact_name: string; company_name: string | null; phone: string; email: string | null };
type IntermediaryRow = { id: string; intermediary_type: "posp" | "misp" | "partner"; display_name: string; intermediary_code: string | null; mobile: string | null; associate_employee_id: string | null };
type EmployeeRow = { id: string; full_name: string | null; employee_code: string | null };

export default async function EditPolicyPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  // Issued-policy edit routes must require edit access before any service-role read.
  await requirePolicyEditor();
  const admin = createSupabaseAdminClient();
  const { data: policy, error } = await admin.from("policies").select("id,business_line,customer_id,insurance_company_id,issuance_date,premium_amount,remarks").eq("id", resolvedParams.id).maybeSingle<PolicyRouteRow>();

  if (!error && policy && (policy.business_line === "Life" || policy.business_line === "Health")) {
    const { data: lifeHealthCase } = await admin.from("life_health_cases")
      .select("id,business_line,sourcing_date,intermediary_id,intermediary_type,intermediary_code,lead_source,rm_name,rm_code,customer_id,insurance_company_id,product_name,proposal_number,premium_paying_term,policy_duration,payment_frequency,payment_mode,premium_amount,remarks")
      .eq("final_policy_id", resolvedParams.id).order("converted_at", { ascending: false }).limit(1).maybeSingle<CaseEditRow>();
    if (!lifeHealthCase) notFound();

    const [{ data: customer }, { data: intermediaryRows }, insurerOptions] = await Promise.all([
      admin.from("customers").select("contact_name,company_name,phone,email").eq("id", lifeHealthCase.customer_id).maybeSingle<CustomerRow>(),
      admin.from("intermediaries").select("id,intermediary_type,display_name,intermediary_code,mobile,associate_employee_id").in("intermediary_type", ["posp", "misp", "partner"]).eq("account_status", "active").order("display_name", { ascending: true }).returns<IntermediaryRow[]>(),
      getActiveInsuranceCompanyOptions(),
    ]);
    if (!customer) notFound();

    const employeeIds = Array.from(new Set((intermediaryRows ?? []).map((row) => row.associate_employee_id).filter((id): id is string => Boolean(id))));
    const { data: employees } = employeeIds.length ? await admin.from("employees").select("id,full_name,employee_code").in("id", employeeIds).returns<EmployeeRow[]>() : { data: [] as EmployeeRow[] };
    const employeeById = new Map((employees ?? []).map((employee) => [employee.id, employee]));
    const sources: LifeHealthIssuedEditSource[] = (intermediaryRows ?? []).map((row) => {
      const employee = row.associate_employee_id ? employeeById.get(row.associate_employee_id) : null;
      const isSavedSource = row.id === lifeHealthCase.intermediary_id;
      return {
        id: row.id,
        type: row.intermediary_type === "posp" ? "POSP" : row.intermediary_type === "misp" ? "MISP" : "SIBL / Partner",
        label: row.display_name,
        code: row.intermediary_code?.trim() || "",
        mobile: row.mobile?.replace(/\D/g, "").slice(-10) || "",
        // Preserve the saved RM for Partner/fallback assignments when the direct intermediary link is empty.
        rmName: employee?.full_name?.trim() || (isSavedSource ? lifeHealthCase.rm_name?.trim() || "" : ""),
        rmCode: employee?.employee_code?.trim() || (isSavedSource ? lifeHealthCase.rm_code?.trim() || "" : ""),
      };
    });
    if (lifeHealthCase.intermediary_id && !sources.some((source) => source.id === lifeHealthCase.intermediary_id)) {
      sources.unshift({ id: lifeHealthCase.intermediary_id, type: lifeHealthCase.intermediary_type === "POSP" ? "POSP" : lifeHealthCase.intermediary_type === "MISP" ? "MISP" : "SIBL / Partner", label: lifeHealthCase.lead_source || "Saved source", code: lifeHealthCase.intermediary_code || "", mobile: "", rmName: lifeHealthCase.rm_name || "", rmCode: lifeHealthCase.rm_code || "" });
    }
    const insurers = insurerOptions.filter((option) => option.segment === "life" || option.segment === "health" || option.value === lifeHealthCase.insurance_company_id).map(({ value, label }) => ({ value, label }));

    return <AppShell title="Edit Policy"><LifeHealthIssuedPolicyEditForm initial={{
      policyId: policy.id, caseId: lifeHealthCase.id, businessLine: lifeHealthCase.business_line, sourcingDate: policy.issuance_date || lifeHealthCase.sourcing_date || "", sourceId: lifeHealthCase.intermediary_id || sources[0]?.id || "", customerName: customer.company_name?.trim() || customer.contact_name, customerPhone: customer.phone, customerEmail: customer.email || "", insurerId: lifeHealthCase.insurance_company_id || policy.insurance_company_id || "", productName: lifeHealthCase.product_name, proposalNumber: lifeHealthCase.proposal_number, ppt: lifeHealthCase.premium_paying_term || "", pd: lifeHealthCase.policy_duration || "", paymentFrequency: lifeHealthCase.payment_frequency, premiumAmount: String(policy.premium_amount ?? lifeHealthCase.premium_amount ?? ""), paymentMode: lifeHealthCase.payment_mode, remarks: policy.remarks || lifeHealthCase.remarks || "",
    }} insurers={insurers} sources={sources} /></AppShell>;
  }

  return <StandardPolicyEditPage params={Promise.resolve(resolvedParams)} />;
}
