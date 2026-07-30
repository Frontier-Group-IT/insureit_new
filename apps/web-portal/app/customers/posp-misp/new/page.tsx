import { redirect } from "next/navigation";
import { AppShell } from "@/components/shell";
import { getEmployeeAccessScope } from "@/lib/employee-access-scope";
import { requirePospMispManager } from "@/lib/master-data-server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { createManualPospMispOnboardingV2 } from "../manual-actions-v2";
import { OnboardingFieldPresentation } from "../onboarding-field-presentation";
import { PospMispOnboardingForm } from "../posp-misp-onboarding-form";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Query = { partner_type?: string; rm_q?: string };

export default async function NewPospMispPage({ searchParams }: { searchParams: Promise<Query> }) {
  const profile = await requirePospMispManager();
  const query = await searchParams;
  const partnerType = query.partner_type;
  if (partnerType !== "posp" && partnerType !== "misp") redirect("/customers/posp-misp");
  const rmSearch = query.rm_q?.trim().slice(0, 80) ?? "";
  const admin = createSupabaseAdminClient();
  const [salesManagers, oems, banks] = await Promise.all([
    loadSalesManagers(admin, profile!.id, profile!.role, rmSearch),
    loadVehicleManufacturers(admin),
    loadBanks(admin)
  ]);
  const isMisp = partnerType === "misp";
  const backHref = isMisp ? "/intermediaries/misp" : "/intermediaries/posp";
  const title = isMisp ? "Add MISP Application" : "Add POSP Application";

  return (
    <AppShell title={title} backHref={backHref}>
      <OnboardingFieldPresentation>
        <PospMispOnboardingForm
          action={createManualPospMispOnboardingV2}
          partnerType={partnerType}
          searchAction="/customers/posp-misp/new"
          rmSearch={rmSearch}
          salesManagers={salesManagers}
          oems={oems}
          banks={banks}
        />
      </OnboardingFieldPresentation>
    </AppShell>
  );
}

async function loadSalesManagers(admin: ReturnType<typeof createSupabaseAdminClient>, profileId: string, role: string, search: string) {
  if (search.length < 2) return [];
  const scope = await getEmployeeAccessScope(profileId, role);
  if (scope.mode !== "organization" && scope.employeeIds.length === 0) return [];
  const needle = search.replace(/[%,]/g, " ").trim();
  let request = admin
    .from("employees")
    .select("id, full_name, employee_code")
    .eq("employment_status", "active")
    .ilike("department", "sales")
    .or(`full_name.ilike.%${needle}%,employee_code.ilike.%${needle}%`)
    .order("full_name", { ascending: true })
    .limit(20);
  if (scope.mode !== "organization") request = request.in("id", scope.employeeIds);
  const { data } = await request.returns<Array<{ id: string; full_name: string | null; employee_code: string | null }>>();
  return (data ?? []).map((manager) => ({ value: manager.id, label: `${manager.full_name?.trim() || "Unnamed Sales Employee"}${manager.employee_code ? ` - ${manager.employee_code}` : ""}` }));
}

async function loadVehicleManufacturers(admin: ReturnType<typeof createSupabaseAdminClient>) {
  const { data } = await admin.from("vehicle_manufacturers").select("name").eq("is_active", true).order("sort_order", { ascending: true }).order("name", { ascending: true }).returns<Array<{ name: string }>>();
  return (data ?? []).map((manufacturer) => ({ value: manufacturer.name, label: manufacturer.name }));
}

async function loadBanks(admin: ReturnType<typeof createSupabaseAdminClient>) {
  const { data } = await admin.from("banks").select("id, name").eq("is_active", true).order("name", { ascending: true }).returns<Array<{ id: string; name: string }>>();
  return (data ?? []).map((bank) => ({ value: bank.id, label: bank.name }));
}
