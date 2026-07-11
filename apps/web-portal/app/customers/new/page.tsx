import { AppShell } from "@/components/shell";
import { createCustomerOnboarding } from "../actions";
import { CustomerOnboardingForm } from "../customer-onboarding-form";

export default function NewCustomerPage() {
  return (
    <AppShell title="Add New Customer">
      <CustomerOnboardingForm action={createCustomerOnboarding} />
    </AppShell>
  );
}
