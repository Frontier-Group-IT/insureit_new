import { AppShell } from "@/components/shell";
import { NonMotorPolicyForm, type NonMotorCustomerOption, type NonMotorInsurerOption } from "@/components/non-motor-policy-form";
import { requirePolicyCreator } from "@/lib/policy-access-server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type InsurerRow = { id: string; name: string };
type CustomerRow = { id: string; contact_name: string; company_name: string | null; phone: string; email: string | null };

export default async function NewNonMotorPolicyPage() {
  await requirePolicyCreator();
  const admin = createSupabaseAdminClient();

  const [insurersResult, customersResult] = await Promise.all([
    admin.from("insurance_companies").select("id,name").eq("is_active", true).order("name", { ascending: true }).returns<InsurerRow[]>(),
    admin.from("customers").select("id,contact_name,company_name,phone,email").order("contact_name", { ascending: true }).limit(750).returns<CustomerRow[]>(),
  ]);

  if (insurersResult.error || customersResult.error) return <SetupError />;

  const insurers: NonMotorInsurerOption[] = (insurersResult.data ?? []).map((row) => ({ value: row.id, label: row.name }));
  const customers: NonMotorCustomerOption[] = (customersResult.data ?? []).map((row) => ({
    id: row.id,
    name: row.company_name?.trim() || row.contact_name,
    contactName: row.contact_name,
    phone: row.phone,
    email: row.email ?? "",
  }));

  return (
    <AppShell title="Add Policy">
      <NonMotorPolicyForm insurers={insurers} customers={customers} />
    </AppShell>
  );
}

function SetupError() {
  return (
    <AppShell title="Add Policy">
      <div className="mx-auto max-w-[900px] rounded-2xl border border-amber-200 bg-amber-50 px-5 py-5 shadow-sm">
        <h2 className="text-[13px] font-semibold text-amber-900">Policy setup information is temporarily unavailable.</h2>
        <p className="mt-1 text-[10.5px] leading-5 text-amber-800">Insurer or customer master data could not be loaded. Refresh the page or try again shortly; no policy information has been changed.</p>
      </div>
    </AppShell>
  );
}
