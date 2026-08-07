import { createInsuranceCompanyMaster } from "@/app/insurance-companies/actions";
import { InsuranceCompanyMasterForm } from "@/components/insurance-company-master-form";
import { AppShell, Card, PageHeader } from "@/components/shell";
import { requireMasterDataManager } from "@/lib/master-data-server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function NewInsuranceCompanyPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  await requireMasterDataManager();
  const params = await searchParams;

  return (
    <AppShell title="Add Insurance Company" backHref="/insurance-companies">
      <PageHeader title="Add Insurance Company" description="Create one canonical insurer record for policy onboarding, reporting and document matching." />
      <Card className="mx-auto max-w-4xl">
        <div className="mb-5 border-b border-[#E7ECF3] pb-4">
          <p className="text-[9px] font-black uppercase tracking-[.14em] text-[#52749E]">Insurer master</p>
          <h2 className="mt-1 text-[15px] font-bold text-[#17203A]">Registered company details</h2>
          <p className="mt-1 text-[10px] leading-4 text-[#667085]">Store the legal company identity and business portal only. Portal usernames and passwords are intentionally excluded from this master.</p>
        </div>
        <InsuranceCompanyMasterForm action={createInsuranceCompanyMaster} submitLabel="Create Insurance Company" cancelHref="/insurance-companies" error={params.error ?? null} />
      </Card>
    </AppShell>
  );
}
