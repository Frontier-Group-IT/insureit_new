import { AppShell } from "@/components/shell";
import { fetchAllPages } from "@/lib/fetch-all-pages";
import { requireMasterDataManager } from "@/lib/master-data-server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { InsuranceCompanyRegister, type InsuranceCompanyRegisterRow } from "./insurance-company-register";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function InsuranceCompaniesPage() {
  await requireMasterDataManager();
  const admin = createSupabaseAdminClient();
  const { data, error } = await fetchAllPages<InsuranceCompanyRegisterRow, unknown>((from, to) => admin
    .from("insurance_companies")
    .select("id,name,segment,sibpl_code,portal_url,portal_status,is_active,updated_at")
    .order("is_active", { ascending: false })
    .order("name", { ascending: true })
    .range(from, to)
    .returns<InsuranceCompanyRegisterRow[]>());

  return (
    <AppShell title="Insurance Companies">
      {error ? <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[11px] font-medium text-red-700">Unable to load insurance company master.</div> : <InsuranceCompanyRegister rows={data ?? []} />}
    </AppShell>
  );
}
