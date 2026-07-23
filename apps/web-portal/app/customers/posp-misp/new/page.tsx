import { redirect } from "next/navigation";
import { AppShell } from "@/components/shell";
import { requireMasterDataManager } from "@/lib/master-data-server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { createPospMispOnboarding } from "../actions";
import { PospMispOnboardingForm } from "../posp-misp-onboarding-form";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function NewPospMispPage({ searchParams }: { searchParams: Promise<{ partner_type?: string }> }) {
  await requireMasterDataManager();
  const { partner_type: partnerType } = await searchParams;
  if (partnerType !== "posp" && partnerType !== "misp") redirect("/customers/posp-misp");
  const admin = createSupabaseAdminClient();
  const [salesManagers, oems] = await Promise.all([
    loadSalesManagers(admin),
    loadVehicleManufacturers(admin)
  ]);

  return (
    <AppShell title={`Add ${partnerType.toUpperCase()} Application`}>
      <PospMispOnboardingForm action={createPospMispOnboarding} partnerType={partnerType} salesManagers={salesManagers} oems={oems} />
    </AppShell>
  );
}

async function loadSalesManagers(admin: ReturnType<typeof createSupabaseAdminClient>) {
  const { data } = await admin
    .from("profiles")
    .select("id, full_name, employee_code")
    .eq("role", "sales_manager")
    .eq("is_active", true)
    .order("full_name", { ascending: true })
    .returns<Array<{ id: string; full_name: string | null; employee_code: string | null }>>();
  return (data ?? []).map((manager) => ({
    id: manager.id,
    fullName: manager.full_name?.trim() || "Unnamed Sales Manager",
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
  return (data ?? []).map((manufacturer) => ({ value: manufacturer.name, label: manufacturer.name }));
}
