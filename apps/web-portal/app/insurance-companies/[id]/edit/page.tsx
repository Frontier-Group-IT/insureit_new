import { notFound } from "next/navigation";
import { updateInsuranceCompanyMaster } from "@/app/insurance-companies/actions";
import { InsuranceCompanyMasterForm } from "@/components/insurance-company-master-form";
import { AppShell, Card, PageHeader } from "@/components/shell";
import { requireMasterDataManager } from "@/lib/master-data-server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

type InsuranceCompany = {
  id: string;
  name: string;
  segment: string | null;
  sibpl_code: string | null;
  portal_url: string | null;
  portal_status: string | null;
  is_active: boolean;
};

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function EditInsuranceCompanyPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string }> }) {
  await requireMasterDataManager();
  const { id } = await params;
  const query = await searchParams;
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("insurance_companies")
    .select("id,name,segment,sibpl_code,portal_url,portal_status,is_active")
    .eq("id", id)
    .maybeSingle<InsuranceCompany>();

  if (error) throw new Error(`Unable to load insurance company: ${error.message}`);
  if (!data) notFound();

  return (
    <AppShell title="Edit Insurance Company" backHref={`/insurance-companies/${id}`}>
      <PageHeader title="Edit Insurance Company" description="Update the canonical insurer master without changing the UUID referenced by policies and claims." />
      <Card className="mx-auto max-w-4xl">
        <div className="mb-5 border-b border-[#E7ECF3] pb-4">
          <p className="text-[9px] font-black uppercase tracking-[.14em] text-[#52749E]">Insurer master</p>
          <h2 className="mt-1 text-[15px] font-bold text-[#17203A]">{data.name}</h2>
          <p className="mt-1 text-[10px] leading-4 text-[#667085]">Editing this record preserves all existing policy, claim and surveyor references.</p>
        </div>
        <InsuranceCompanyMasterForm action={updateInsuranceCompanyMaster.bind(null, id)} values={data} submitLabel="Save Changes" cancelHref={`/insurance-companies/${id}`} error={query.error ?? null} />
      </Card>
    </AppShell>
  );
}
