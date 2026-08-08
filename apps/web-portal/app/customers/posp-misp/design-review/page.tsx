import { AppShell } from "@/components/shell";
import { requirePospMispManager } from "@/lib/master-data-server";
import { loadPospMispAssociates } from "@/lib/posp-misp-associates";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { PospMispOnboardingDesignReview } from "../posp-misp-onboarding-design-review";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type PartnerType = "posp" | "misp";

export default async function PospMispDesignReviewPage({
  searchParams
}: {
  searchParams: Promise<{ partner_type?: string }>;
}) {
  await requirePospMispManager();
  const params = await searchParams;
  const partnerType: PartnerType = params.partner_type === "misp" ? "misp" : "posp";
  const masterDataAvailable = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() &&
      process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  );
  const [salesManagers, oems, banks] = masterDataAvailable
    ? await loadMasterData()
    : [[], [], []];

  return (
    <AppShell title="POSP / MISP Onboarding Review" backHref="/customers/posp-misp">
      <PospMispOnboardingDesignReview
        partnerType={partnerType}
        salesManagers={salesManagers}
        oems={oems}
        banks={banks}
        masterDataAvailable={masterDataAvailable}
      />
    </AppShell>
  );
}

async function loadMasterData() {
  const admin = createSupabaseAdminClient();
  return Promise.all([
    loadSalesManagers(admin),
    loadVehicleManufacturers(admin),
    loadBanks(admin)
  ]);
}

async function loadSalesManagers(admin: ReturnType<typeof createSupabaseAdminClient>) {
  const managers = await loadPospMispAssociates(admin);
  return managers.map((manager) => ({
    id: manager.id,
    fullName: manager.full_name?.trim() || "Unnamed Sales Employee",
    employeeCode: manager.employee_code
  }));
}

async function loadVehicleManufacturers(admin: ReturnType<typeof createSupabaseAdminClient>) {
  const { data } = await admin
    .from("vehicle_manufacturers")
    .select("name")
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true })
    .returns<Array<{ name: string }>>();

  return (data ?? []).map((manufacturer) => ({
    value: manufacturer.name,
    label: manufacturer.name
  }));
}

async function loadBanks(admin: ReturnType<typeof createSupabaseAdminClient>) {
  const { data } = await admin
    .from("banks")
    .select("id, name")
    .eq("is_active", true)
    .order("name", { ascending: true })
    .returns<Array<{ id: string; name: string }>>();

  return (data ?? []).map((bank) => ({
    value: bank.id,
    label: bank.name
  }));
}
