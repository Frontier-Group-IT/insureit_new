import { redirect } from "next/navigation";
import { AppShell } from "@/components/shell";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { requireMasterDataManager } from "@/lib/master-data-server";
import { createCustomerOnboarding } from "../actions";
import { CustomerOnboardingForm } from "../customer-onboarding-form";
import { createCorporateOnboarding } from "../corporate-actions";
import { CorporateOnboardingForm } from "../corporate-onboarding-form";
import { createDealershipOnboarding } from "../dealership-actions";
import { DealershipOnboardingForm } from "../dealership-onboarding-form";
import { createGroupOnboarding } from "../group-actions";
import { GroupOnboardingForm } from "../group-onboarding-form";
import { createPospMispOnboarding } from "../posp-misp/actions";
import { PospMispOnboardingForm } from "../posp-misp/posp-misp-onboarding-form";

const supportedPartnerTypes = new Set(["individual_proprietor", "dealership", "corporate", "group", "posp", "misp"]);

type GroupOption = { value: string; label: string };

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function NewCustomerPage({ searchParams }: { searchParams: Promise<{ partner_type?: string; dealership_type?: string }> }) {
  const { partner_type: partnerType, dealership_type: dealershipType } = await searchParams;
  if (!partnerType || !supportedPartnerTypes.has(partnerType)) redirect("/customers?choose_partner=1");

  await requireMasterDataManager();
  const admin = createSupabaseAdminClient();
  const groupOptions = partnerType === "group" ? [] : await loadActiveGroups(admin);

  if (partnerType === "dealership") {
    if (dealershipType !== "posp" && dealershipType !== "misp") redirect("/customers/dealership-type");

    const { data: manufacturers } = await admin
      .from("vehicle_manufacturers")
      .select("name")
      .eq("is_active", true)
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true })
      .returns<Array<{ name: string }>>();

    const oems = (manufacturers ?? []).map((manufacturer) => ({ value: manufacturer.name, label: manufacturer.name }));

    return (
      <AppShell title={`Add ${dealershipType.toUpperCase()} Dealership`}>
        <DealershipOnboardingForm action={createDealershipOnboarding} dealershipType={dealershipType} oems={oems} />
      </AppShell>
    );
  }

  if (partnerType === "corporate") {
    return (
      <AppShell title="Add Corporate Customer">
        <CorporateOnboardingForm action={createCorporateOnboarding} groups={groupOptions} />
      </AppShell>
    );
  }

  if (partnerType === "group") {
    return (
      <AppShell title="Add Group">
        <GroupOnboardingForm action={createGroupOnboarding} />
      </AppShell>
    );
  }

  if (partnerType === "posp" || partnerType === "misp") {
    const [salesManagers, oems, banks] = await Promise.all([
      loadSalesManagers(admin),
      loadVehicleManufacturers(admin),
      loadBanks(admin)
    ]);

    return (
      <AppShell title={`Add ${partnerType.toUpperCase()} Application`}>
        <PospMispOnboardingForm
          action={createPospMispOnboarding}
          partnerType={partnerType}
          salesManagers={salesManagers}
          oems={oems}
          banks={banks}
        />
      </AppShell>
    );
  }

  return (
    <AppShell title="Add New Customer">
      <CustomerOnboardingForm action={createCustomerOnboarding} partnerType={partnerType} />
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

async function loadBanks(admin: ReturnType<typeof createSupabaseAdminClient>) {
  const { data } = await admin
    .from("banks")
    .select("id, name")
    .eq("is_active", true)
    .order("name", { ascending: true })
    .returns<Array<{ id: string; name: string }>>();
  return (data ?? []).map((bank) => ({ value: bank.id, label: bank.name }));
}

async function loadActiveGroups(admin: ReturnType<typeof createSupabaseAdminClient>): Promise<GroupOption[]> {
  const { data } = await admin
    .from("customers")
    .select("id,customer_code,company_name,contact_name")
    .eq("partner_type", "group")
    .eq("onboarding_status", "active")
    .order("company_name", { ascending: true })
    .returns<Array<{ id: string; customer_code: string; company_name: string | null; contact_name: string }>>();

  return (data ?? []).map((group) => ({
    value: group.id,
    label: `${group.company_name?.trim() || group.contact_name} · ${group.customer_code}`,
  }));
}
