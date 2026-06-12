import { notFound } from "next/navigation";
import { updateCustomer } from "@/app/actions";
import { CustomerForm } from "@/components/forms";
import { AppShell, PageHeader } from "@/components/shell";
import { createServerSupabaseClient } from "@/lib/auth-server";

type CustomerValues = {
  contact_name: string;
  company_name: string | null;
  phone: string;
  email: string | null;
  city: string | null;
  state: string | null;
  address: string | null;
  assigned_agent_id: string | null;
};

export default async function EditCustomerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: customer, error } = await supabase
    .from("customers")
    .select("contact_name, company_name, phone, email, city, state, address, assigned_agent_id")
    .eq("id", id)
    .maybeSingle<CustomerValues>();

  if (error || !customer) {
    notFound();
  }

  const { data: agents } = await supabase.from("profiles").select("id, full_name").eq("role", "agent").eq("is_active", true).order("full_name");

  return (
    <AppShell title="Edit customer">
      <PageHeader title="Edit customer" />
      <CustomerForm action={updateCustomer.bind(null, id)} values={customer} agents={(agents ?? []).map((agent) => ({ label: agent.full_name, value: agent.id }))} submitLabel="Save changes" />
    </AppShell>
  );
}
