import { redirect } from "next/navigation";
import { AppShell } from "@/components/shell";
import { getEmployeeAccessScope } from "@/lib/employee-access-scope";
import { requirePospMispManager } from "@/lib/master-data-server";
import { loadPospMispAssociates } from "@/lib/posp-misp-associates";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { createScopedManualPospMispOnboarding } from "../scoped-manual-action";
import { PospMispOnboardingForm } from "../posp-misp-onboarding-form";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function NewPospMispPage({ searchParams }: { searchParams: Promise<{ partner_type?: string }> }) {
  const profile = await requirePospMispManager();
  const { partner_type: partnerType } = await searchParams;
  if (partnerType !== "posp" && partnerType !== "misp") redirect("/customers/posp-misp");
  const admin = createSupabaseAdminClient();
  const [salesManagers, oems, banks] = await Promise.all([
    loadSalesManagers(admin, profile!.id, profile!.role),
    loadVehicleManufacturers(admin),
    loadBanks(admin)
  ]);
  const isMisp = partnerType === "misp";
  const backHref = isMisp ? "/intermediaries/misp" : "/intermediaries/partner";
  const title = isMisp ? "Add MISP Application" : "Add Partner Application";

  return (
    <AppShell title={title} backHref={backHref}>
      <PospMispOnboardingForm action={createScopedManualPospMispOnboarding} partnerType={partnerType} salesManagers={salesManagers} oems={oems} banks={banks} />
    </AppShell>
  );
}

async function loadSalesManagers(admin: ReturnType<typeof createSupabaseAdminClient>, profileId: string, role: string) {
  const [managers, scope] = await Promise.all([
    loadPospMispAssociates(admin),
    getEmployeeAccessScope(profileId, role)
  ]);
  const visibleManagers = scope.mode === "organization" ? managers : managers.filter((manager) => scope.employeeIds.includes(manager.id));
  return visibleManagers.map((manager) => ({ id: manager.id, fullName: manager.full_name?.trim() || "Unnamed Sales Employee", employeeCode: manager.employee_code }));
}

async function loadVehicleManufacturers(admin: ReturnType<typeof createSupabaseAdminClient>) {
  const { data } = await admin.from("vehicle_manufacturers").select("name").eq("is_active", true).order("sort_order", { ascending: true }).order("name", { ascending: true }).returns<Array<{ name: string }>>();
  return (data ?? []).map((manufacturer) => ({ value: manufacturer.name, label: manufacturer.name }));
}

async function loadBanks(admin: ReturnType<typeof createSupabaseAdminClient>) {
  const { data } = await admin.from("banks").select("id, name").eq("is_active", true).order("name", { ascending: true }).returns<Array<{ id: string; name: string }>>();
  return (data ?? []).map((bank) => ({ value: bank.id, label: bank.name }));
}
