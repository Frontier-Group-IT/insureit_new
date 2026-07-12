import { redirect } from "next/navigation";
import { AppShell } from "@/components/shell";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { requireMasterDataManager } from "@/lib/master-data-server";
import { createCustomerOnboarding } from "../actions";
import { CustomerOnboardingForm } from "../customer-onboarding-form";
import { createDealershipOnboarding } from "../dealership-actions";
import { DealershipOnboardingForm } from "../dealership-onboarding-form";

const supportedPartnerTypes = new Set(["individual_proprietor", "dealership", "corporate", "group"]);

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function NewCustomerPage({ searchParams }: { searchParams: Promise<{ partner_type?: string; dealership_type?: string }> }) {
  const { partner_type: partnerType, dealership_type: dealershipType } = await searchParams;
  if (!partnerType || !supportedPartnerTypes.has(partnerType)) redirect("/customers?choose_partner=1");

  if (partnerType === "dealership") {
    await requireMasterDataManager();
    if (dealershipType !== "posp" && dealershipType !== "misp") redirect("/customers/dealership-type");

    const admin = createSupabaseAdminClient();
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

  return (
    <AppShell title="Add New Customer">
      <CustomerOnboardingForm action={createCustomerOnboarding} partnerType={partnerType} />
    </AppShell>
  );
}
