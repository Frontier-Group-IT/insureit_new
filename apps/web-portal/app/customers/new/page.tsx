import { redirect } from "next/navigation";
import { AppShell } from "@/components/shell";
import { createCustomerOnboarding } from "../actions";
import { CustomerOnboardingForm } from "../customer-onboarding-form";

const supportedPartnerTypes = new Set(["individual_proprietor", "dealership", "corporate", "group"]);

export default async function NewCustomerPage({ searchParams }: { searchParams: Promise<{ partner_type?: string }> }) {
  const { partner_type: partnerType } = await searchParams;
  if (!partnerType || !supportedPartnerTypes.has(partnerType)) redirect("/customers?choose_partner=1");

  return (
    <AppShell title="Add New Customer">
      <CustomerOnboardingForm action={createCustomerOnboarding} partnerType={partnerType} />
    </AppShell>
  );
}
