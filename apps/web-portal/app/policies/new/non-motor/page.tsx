import { NonMotorPolicyForm, type NonMotorFormState, type NonMotorCustomerOption, type NonMotorInsurerOption } from "@/components/non-motor-policy-form";
import { type PolicyRmOption, type PolicySourceOption } from "@/components/policy-unified-form";
import { AppShell } from "@/components/shell";
import { loadPospMispAssociates } from "@/lib/posp-misp-associates";
import { requirePolicyCreator } from "@/lib/policy-access-server";
import { getAuthenticatedProfile, getServerAccessToken } from "@/lib/auth-server";
import { requireCapability } from "@/lib/master-data-server";
import { getOperationsHeadDownlinePolicyScope, operationsHeadPolicyFilter } from "@/lib/policy-access-scope";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type InsurerRow = { id: string; name: string };
type CustomerRow = { id: string; contact_name: string; company_name: string | null; phone: string; email: string | null };
type IntermediaryRow = {
  id: string;
  intermediary_type: "posp" | "misp" | "partner";
  display_name: string;
  intermediary_code: string | null;
  associate_employee_id: string | null;
  mobile: string | null;
};

export default async function NewNonMotorPolicyPage({ searchParams }: { searchParams: Promise<{intake_id?:string}> }) {
  const { profile: requester } = await getAuthenticatedProfile(await getServerAccessToken());
  const profile = requester?.role === "operations_head_life" ? await requireCapability("view_policies") : await requirePolicyCreator();
  const admin = createSupabaseAdminClient();
  const scoped = profile.role === "operations_head_life" ? await getOperationsHeadDownlinePolicyScope(profile.id) : null;
  if (scoped && !scoped.intermediaryCodes.length) return <SetupError />;
  const scopedFilter = scoped ? operationsHeadPolicyFilter(scoped) : "";
  const [scopedPolicies, scopedCases] = scopedFilter ? await Promise.all([
    admin.from("policies").select("customer_id").or(scopedFilter).returns<Array<{ customer_id: string }>>(),
    admin.from("life_health_cases").select("customer_id").or(scopedFilter).returns<Array<{ customer_id: string }>>(),
  ]) : [{ data: [] as Array<{ customer_id: string }>, error: null }, { data: [] as Array<{ customer_id: string }>, error: null }];
  if (scoped && (scopedPolicies.error || scopedCases.error)) return <SetupError />;
  const allowedCustomers = new Set([...(scopedPolicies.data ?? []), ...(scopedCases.data ?? [])].map(row => row.customer_id));

  let salesEmployees: Awaited<ReturnType<typeof loadPospMispAssociates>> = [];
  try {
    salesEmployees = await loadPospMispAssociates(admin);
  } catch {
    return <SetupError />;
  }

  const [insurersResult, customersResult, intermediariesResult] = await Promise.all([
    admin.from("insurance_companies").select("id,name").eq("is_active", true).order("name", { ascending: true }).returns<InsurerRow[]>(),
    admin.from("customers").select("id,contact_name,company_name,phone,email").order("contact_name", { ascending: true }).limit(750).returns<CustomerRow[]>(),
    admin.from("intermediaries").select("id,intermediary_type,display_name,intermediary_code,associate_employee_id,mobile").in("intermediary_type", ["posp", "misp", "partner"]).eq("account_status", "active").order("display_name", { ascending: true }).returns<IntermediaryRow[]>(),
  ]);

  if (insurersResult.error || customersResult.error || intermediariesResult.error) return <SetupError />;

  const insurers: NonMotorInsurerOption[] = (insurersResult.data ?? []).map((row) => ({ value: row.id, label: row.name }));
  const customers: NonMotorCustomerOption[] = (customersResult.data ?? []).filter(row => !scoped || allowedCustomers.has(row.id)).map((row) => ({ id: row.id, name: row.company_name?.trim() || row.contact_name, contactName: row.contact_name, phone: row.phone, email: row.email ?? "" }));
  const employeeById = new Map(salesEmployees.map((employee) => [employee.id, employee]));
  const rms: PolicyRmOption[] = salesEmployees.filter(employee => !scoped || scoped.employeeIds.includes(employee.id)).map((employee) => {
    const name = employee.full_name?.trim() || "Unnamed Sales Employee";
    return { value: name, label: employee.employee_code ? `${name} - ${employee.employee_code}` : name };
  });
  const sources: PolicySourceOption[] = (intermediariesResult.data ?? [])
    .filter((item) => item.intermediary_code?.trim() && item.display_name?.trim() && (!scoped || scoped.intermediaryCodes.includes(item.intermediary_code!.trim())))
    .map((item) => {
      const associate = item.associate_employee_id ? employeeById.get(item.associate_employee_id) : null;
      return {
        type: item.intermediary_type === "posp" ? "POSP" as const : item.intermediary_type === "misp" ? "MISP" as const : "SIBL / Partner" as const,
        value: item.id,
        label: item.display_name.trim(),
        code: item.intermediary_code!.trim(),
        rmName: associate?.full_name?.trim() || "",
        rmCode: associate?.employee_code?.trim() || "",
        mobile: item.mobile?.replace(/\D/g, "").slice(-10) || "",
      };
    });

  const params=await searchParams;
  let sourceIntakeId:string|null=null;
  let initialValues:Partial<NonMotorFormState>={};
  if(params.intake_id){
    if(!/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(params.intake_id))return <SetupError />;
    // Only the authorized assigned reviewer can restore the intake draft here.
    const {data:intake}=await admin.from("policy_intake_requests")
      .select("id,status,assigned_to_profile_id").eq("id",params.intake_id)
      .eq("assigned_to_profile_id",profile.id).eq("status","in_review")
      .maybeSingle<{id:string;status:string;assigned_to_profile_id:string}>();
    if(!intake)return <SetupError />;
    const {data:saved}=await admin.from("policy_intake_onboarding_drafts")
      .select("draft_payload").eq("intake_id",intake.id)
      .maybeSingle<{draft_payload:{businessLine:string;issuanceDate:string;intermediaryType:string;intermediaryCode:string;leadSource:string;rmName:string;productDrafts?:Record<string,Record<string,string>>}}>();
    const draft=saved?.draft_payload;
    if(!draft||draft.businessLine!=="Non Motor")return <SetupError />;
    const v=draft.productDrafts?.["Non Motor"]??{};
    const source=sources.find(item=>item.code===draft.intermediaryCode&&item.label.toLowerCase()===draft.leadSource.toLowerCase());
    if(!source)return <SetupError />;
    sourceIntakeId=intake.id;
    initialValues={
      issuanceDate:draft.issuanceDate,intermediaryType:draft.intermediaryType as NonMotorFormState["intermediaryType"],
      intermediaryCode:draft.intermediaryCode,leadSource:draft.leadSource,sourceId:source.value,rmName:draft.rmName,
      customerMode:v.customerMode==="new"?"new":"existing",customerId:v.customerId??"",
      customerType:v.customerType==="Individual"?"Individual":"Organisation",
      insuredName:v.insuredName??"",contactName:v.contactName??"",phone:v.phone??"",email:v.email??"",address:v.address??"",
      policyNumber:v.policyNumber??"",insurerId:v.insurerId??"",productName:v.productName??"",
      category:v.category??"",status:v.status??"Active",riskTitle:v.riskTitle??"",riskLocation:v.riskLocation??"",
      occupancyType:v.occupancyType??"",cargoDescription:v.cargoDescription??"",transitFrom:v.transitFrom??"",
      transitTo:v.transitTo??"",transitMode:v.transitMode??"",projectName:v.projectName??"",
      projectValue:v.projectValue??"",natureOfBusiness:v.natureOfBusiness??"",liabilityType:v.liabilityType??"",
      employeeCount:v.employeeCount??"",annualWages:v.annualWages??"",businessName:v.businessName??"",
      annualTurnover:v.annualTurnover??"",sumInsured:v.sumInsured??"",deductible:v.deductible??"",
      netPremium:v.netPremium??"",gstAmount:v.gstAmount??"",grossPremium:v.grossPremium??"",
      startDate:v.startDate??"",endDate:v.endDate??"",proposalNumber:v.proposalNumber??"",
      previousInsurer:v.previousInsurer??"",previousPolicyNumber:v.previousPolicyNumber??"",
      previousClaims:v.previousClaims??"",addOns:v.addOns??"",warranties:v.warranties??"",
      specialConditions:v.specialConditions??"",endorsements:v.endorsements??"",remarks:v.remarks??"",
    };
  }
  return (
    <AppShell title="Add Policy">
      <NonMotorPolicyForm insurers={insurers} customers={customers} rms={rms} sources={sources}
        sourceIntakeId={sourceIntakeId} initialValues={initialValues}/>
    </AppShell>
  );
}

function SetupError() {
  return (
    <AppShell title="Add Policy">
      <div className="mx-auto max-w-[900px] rounded-2xl border border-amber-200 bg-amber-50 px-5 py-5 shadow-sm">
        <h2 className="text-[13px] font-semibold text-amber-900">Policy setup information is temporarily unavailable.</h2>
        <p className="mt-1 text-[10.5px] leading-5 text-amber-800">Insurer, customer or intermediary master data could not be loaded. Refresh the page or try again shortly; no policy information has been changed.</p>
      </div>
    </AppShell>
  );
}
