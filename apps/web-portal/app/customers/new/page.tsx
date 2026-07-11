import { AppShell } from "@/components/shell";
import { createCustomerOnboarding } from "../actions";
import { CustomerOnboardingForm } from "../customer-onboarding-form";

export default function NewCustomerPage() {
  return (
    <AppShell title="Add New Customer">
      <div className="mb-4 rounded-2xl border border-[#DCE7F5] bg-white px-5 py-4 shadow-[0_8px_22px_rgba(7,29,73,0.04)]">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#4773A8]">Master Data · Customers</p>
        <h1 className="mt-1 text-[22px] font-semibold tracking-tight text-[#071D49]">Add New Customer</h1>
        <p className="mt-1 text-[12.5px] text-[#68758A]">Onboard a customer partner and prepare their profile for mobile OTP access.</p>
      </div>
      <CustomerOnboardingForm action={createCustomerOnboarding} />
    </AppShell>
  );
}
