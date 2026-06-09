import { CustomerForm } from "@/components/forms";
import { AppShell, PageHeader } from "@/components/shell";

export default function EditCustomerPage() {
  return <AppShell><PageHeader title="Edit customer" description="Update customer profile information and onboarding status." /><CustomerForm /></AppShell>;
}
