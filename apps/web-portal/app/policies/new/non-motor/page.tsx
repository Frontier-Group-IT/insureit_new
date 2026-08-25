import { NonMotorPolicyForm, type NonMotorCustomerOption, type NonMotorInsurerOption } from "@/components/non-motor-policy-form";
import { type PolicyRmOption, type PolicySourceOption } from "@/components/policy-unified-form";
import { AppShell } from "@/components/shell";
import { loadPospMispAssociates } from "@/lib/posp-misp-associates";
import { requirePolicyCreator } from "@/lib/policy-access-server";
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
};

export default async function NewNonMotorPolicyPage() {
  await requirePolicyCreator();
  const admin = createSupabaseAdminClient();

  let salesEmployees: Awaited<ReturnType<typeof loadPospMispAssociates>> = [];
  try {
    salesEmployees = await loadPospMispAssociates(admin);
  } catch {
    return <SetupError />;
  }

  const [insurersResult, customersResult, intermediariesResult] = await Promise.all([
    admin.from("insurance_companies").select("id,name").eq("is_active", true).order("name", { ascending: true }).returns<InsurerRow[]>(),
    admin.from("customers").select("id,contact_name,company_name,phone,email").order("contact_name", { ascending: true }).limit(750).returns<CustomerRow[]>(),
    admin.from("intermediaries").select("id,intermediary_type,display_name,intermediary_code,associate_employee_id").in("intermediary_type", ["posp", "misp", "partner"]).eq("account_status", "active").order("display_name", { ascending: true }).returns<IntermediaryRow[]>(),
  ]);

  if (insurersResult.error || customersResult.error || intermediariesResult.error) return <SetupError />;

  const insurers: NonMotorInsurerOption[] = (insurersResult.data ?? []).map((row) => ({ value: row.id, label: row.name }));
  const customers: NonMotorCustomerOption[] = (customersResult.data ?? []).map((row) => ({ id: row.id, name: row.company_name?.trim() || row.contact_name, contactName: row.contact_name, phone: row.phone, email: row.email ?? "" }));
  const employeeById = new Map(salesEmployees.map((employee) => [employee.id, employee]));
  const rms: PolicyRmOption[] = salesEmployees.map((employee) => {
    const name = employee.full_name?.trim() || "Unnamed Sales Employee";
    return { value: name, label: employee.employee_code ? `${name} - ${employee.employee_code}` : name };
  });
  const sources: PolicySourceOption[] = (intermediariesResult.data ?? [])
    .filter((item) => item.intermediary_code?.trim() && item.display_name?.trim())
    .map((item) => {
      const associate = item.associate_employee_id ? employeeById.get(item.associate_employee_id) : null;
      return {
        type: item.intermediary_type === "posp" ? "POSP" as const : item.intermediary_type === "misp" ? "MISP" as const : "SIBL / Partner" as const,
        value: item.id,
        label: item.display_name.trim(),
        code: item.intermediary_code!.trim(),
        rmName: associate?.full_name?.trim() || "",
        rmCode: associate?.employee_code?.trim() || "",
      };
    });

  return (
    <AppShell title="Add Policy">
      <NonMotorPolicyForm insurers={insurers} customers={customers} rms={rms} sources={sources} />
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
