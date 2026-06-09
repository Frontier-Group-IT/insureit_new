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
};

export default async function EditCustomerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: customer, error } = await supabase
    .from("customers")
    .select("contact_name, company_name, phone, email, city, state, address")
    .eq("id", id)
    .maybeSingle<CustomerValues>();

  if (error || !customer) {
    notFound();
  }

  return <AppShell title="Edit customer"><PageHeader title="Edit customer" /><CustomerForm action={updateCustomer.bind(null, id)} values={customer} submitLabel="Save changes" /></AppShell>;
}
