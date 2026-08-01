import { redirect } from "next/navigation";
import { AppShell } from "@/components/shell";
import { getEmployeeAccessScope } from "@/lib/employee-access-scope";
import { requirePospMispManager } from "@/lib/master-data-server";
import { loadPospMispAssociates } from "@/lib/posp-misp-associates";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { createManualPospMispOnboardingV2 } from "../manual-actions-v2";
import { createLegacyPartnerOnboarding } from "../legacy-manual-actions";
import { LegacyOnboardingFields } from "../legacy-onboarding-fields";
import { OnboardingFieldPresentation } from "../onboarding-field-presentation";
import { PospMispOnboardingForm } from "../posp-misp-onboarding-form";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Query = Record<string, string | undefined> & { partner_type?: string; form_error?: string; form_field?: string; legacy_mode?: string };

export default async function NewPospMispPage({ searchParams }: { searchParams: Promise<Query> }) {
  const profile = await requirePospMispManager();
  const query = await searchParams;
  const partnerType = query.partner_type;
  if (partnerType !== "posp" && partnerType !== "misp") redirect("/customers/posp-misp");
  const admin = createSupabaseAdminClient();
  const [salesManagers, oems, banks] = await Promise.all([
    loadSalesManagers(admin, profile!.id, profile!.role),
    loadVehicleManufacturers(admin),
    loadBanks(admin)
  ]);
  const isMisp = partnerType === "misp";
  const legacyMode = query.legacy_mode === "existing";
  const backHref = isMisp ? "/intermediaries/misp" : "/intermediaries/posp";
  const title = legacyMode ? `Add Existing ${isMisp ? "MISP" : "POSP"} & Partner` : isMisp ? "Add MISP Application" : "Add POSP Application";
  const initialValues = extractInitialValues(query);

  return (
    <AppShell title={title} backHref={backHref}>
      <OnboardingFieldPresentation>
        <PospMispOnboardingForm
          action={legacyMode ? createLegacyPartnerOnboarding : createManualPospMispOnboardingV2}
          submitPath={legacyMode ? undefined : "/customers/posp-misp/new/submit"}
          partnerType={partnerType}
          initialError={query.form_error ?? null}
          initialField={query.form_field ?? null}
          initialValues={initialValues}
          salesManagers={salesManagers}
          oems={oems}
          banks={banks}
          legacyFields={legacyMode ? <LegacyOnboardingFields partnerType={partnerType} initialValues={initialValues} /> : null}
        />
      </OnboardingFieldPresentation>
    </AppShell>
  );
}

function extractInitialValues(query: Query) {
  return Object.fromEntries(
    Object.entries(query)
      .filter(([key, value]) => key.startsWith("v_") && typeof value === "string")
      .map(([key, value]) => [key.slice(2), value ?? ""])
  );
}

async function loadSalesManagers(admin: ReturnType<typeof createSupabaseAdminClient>, profileId: string, role: string) {
  const [managers, scope] = await Promise.all([
    loadPospMispAssociates(admin),
    getEmployeeAccessScope(profileId, role)
  ]);
  const visibleManagers = scope.mode === "organization" ? managers : managers.filter((manager) => scope.employeeIds.includes(manager.id));
  return visibleManagers.map((manager) => ({ value: manager.id, label: `${manager.full_name?.trim() || "Unnamed Sales Employee"}${manager.employee_code ? ` - ${manager.employee_code}` : ""}` }));
}

async function loadVehicleManufacturers(admin: ReturnType<typeof createSupabaseAdminClient>) {
  const { data } = await admin.from("vehicle_manufacturers").select("name").eq("is_active", true).order("sort_order", { ascending: true }).order("name", { ascending: true }).returns<Array<{ name: string }>>();
  return (data ?? []).map((manufacturer) => ({ value: manufacturer.name, label: manufacturer.name }));
}

async function loadBanks(admin: ReturnType<typeof createSupabaseAdminClient>) {
  const { data } = await admin.from("banks").select("id, name").eq("is_active", true).order("name", { ascending: true }).returns<Array<{ id: string; name: string }>>();
  return (data ?? []).map((bank) => ({ value: bank.id, label: bank.name }));
}
