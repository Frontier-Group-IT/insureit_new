import { notFound } from "next/navigation";
import { AppShell } from "@/components/shell";
import { LifeHealthCaseDetail } from "@/components/life-health-case-detail";
import { requirePolicyCreator } from "@/lib/policy-access-server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type CaseRow = {
  id: string; case_number: string; business_line: "Life" | "Health"; status: string; sourcing_date: string;
  customer_id: string; insurance_company_id: string; product_name: string; proposal_number: string;
  premium_paying_term: string | null; policy_duration: string | null; payment_frequency: string; payment_mode: string;
  premium_amount: number; intermediary_type: string | null; intermediary_code: string | null; lead_source: string | null;
  intermediary_mobile: string | null; rm_name: string | null; rm_code: string | null; remarks: string | null;
  final_policy_id: string | null; converted_at: string | null;
};
type CustomerRow = { id: string; contact_name: string; company_name: string | null; phone: string; email: string | null };
type InsurerRow = { id: string; name: string };
type DocumentRow = { id: string; document_type: string; file_name: string; created_at: string };
type PolicyRow = { id: string; policy_no: string; policy_code: string | null };

export default async function LifeHealthCasePage({ params }: { params: Promise<{ id: string }> }) {
  await requirePolicyCreator();
  const admin = createSupabaseAdminClient();
  const { id } = await params;
  const { data: caseRow, error } = await admin.from("life_health_cases")
    .select("id,case_number,business_line,status,sourcing_date,customer_id,insurance_company_id,product_name,proposal_number,premium_paying_term,policy_duration,payment_frequency,payment_mode,premium_amount,intermediary_type,intermediary_code,lead_source,intermediary_mobile,rm_name,rm_code,remarks,final_policy_id,converted_at")
    .eq("id", id).maybeSingle<CaseRow>();
  if (error || !caseRow) notFound();

  const [customerResult, insurerResult, documentsResult, policyResult] = await Promise.all([
    admin.from("customers").select("id,contact_name,company_name,phone,email").eq("id", caseRow.customer_id).maybeSingle<CustomerRow>(),
    admin.from("insurance_companies").select("id,name").eq("id", caseRow.insurance_company_id).maybeSingle<InsurerRow>(),
    admin.from("life_health_case_documents").select("id,document_type,file_name,created_at").eq("case_id", id).order("created_at", { ascending: true }).returns<DocumentRow[]>(),
    caseRow.final_policy_id ? admin.from("policies").select("id,policy_no,policy_code").eq("id", caseRow.final_policy_id).maybeSingle<PolicyRow>() : Promise.resolve({ data: null, error: null }),
  ]);

  const customer = customerResult.data;
  const insurer = insurerResult.data;
  return (
    <AppShell title="Life / Health Case">
      <LifeHealthCaseDetail
        caseData={{
          id: caseRow.id,
          caseNumber: caseRow.case_number,
          businessLine: caseRow.business_line,
          status: caseRow.status,
          sourcingDate: caseRow.sourcing_date,
          customerName: customer?.company_name?.trim() || customer?.contact_name || "Customer",
          customerPhone: customer?.phone || "",
          customerEmail: customer?.email || "",
          insurerName: insurer?.name || "Insurer",
          productName: caseRow.product_name,
          proposalNumber: caseRow.proposal_number,
          ppt: caseRow.premium_paying_term || "",
          pd: caseRow.policy_duration || "",
          paymentFrequency: caseRow.payment_frequency,
          paymentMode: caseRow.payment_mode,
          premiumAmount: Number(caseRow.premium_amount || 0),
          intermediaryType: caseRow.intermediary_type || "",
          intermediaryCode: caseRow.intermediary_code || "",
          leadSource: caseRow.lead_source || "",
          intermediaryMobile: caseRow.intermediary_mobile || "",
          rmName: caseRow.rm_name || "",
          rmCode: caseRow.rm_code || "",
          remarks: caseRow.remarks || "",
          finalPolicyId: caseRow.final_policy_id,
          finalPolicyNo: policyResult.data?.policy_no || null,
          finalPolicyCode: policyResult.data?.policy_code || null,
          convertedAt: caseRow.converted_at,
        }}
        documents={documentsResult.data ?? []}
      />
    </AppShell>
  );
}
