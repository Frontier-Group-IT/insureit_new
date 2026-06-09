import { createCustomer } from "@/app/actions";
import { CustomerForm } from "@/components/forms";
import { AppShell, PageHeader } from "@/components/shell";

export default function NewCustomerPage() {
  return <AppShell><PageHeader title="Add customer" description="Capture customer identity, company, contact, and operating address details." /><CustomerForm action={createCustomer} submitLabel="Add record" /></AppShell>;
}
