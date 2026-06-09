import { createCustomer } from "@/app/actions";
import { CustomerForm } from "@/components/forms";
import { AppShell, PageHeader } from "@/components/shell";

export default function NewCustomerPage() {
  return <AppShell title="Add customer"><PageHeader title="Add customer" /><CustomerForm action={createCustomer} submitLabel="Add record" /></AppShell>;
}
