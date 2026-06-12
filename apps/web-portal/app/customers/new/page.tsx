import { createCustomer } from "@/app/actions";
import { CustomerForm } from "@/components/forms";
import { AppShell, PageHeader } from "@/components/shell";
import { createServerSupabaseClient } from "@/lib/auth-server";

export default async function NewCustomerPage() {
  const supabase = await createServerSupabaseClient();
  const { data: agents } = await supabase.from("profiles").select("id, full_name").eq("role", "agent").eq("is_active", true).order("full_name");
  return (
    <AppShell title="Add customer">
      <PageHeader title="Add customer" />
      <CustomerForm action={createCustomer} agents={(agents ?? []).map((agent) => ({ label: agent.full_name, value: agent.id }))} submitLabel="Add record" />
    </AppShell>
  );
}
