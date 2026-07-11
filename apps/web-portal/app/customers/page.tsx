import Link from "next/link";
import { DataError, DataTable } from "@/components/record-list";
import { AppShell, PageHeader } from "@/components/shell";
import { SearchFilterBar, StatusBadge } from "@/components/ui";
import { createServerSupabaseClient } from "@/lib/auth-server";
import { requireMasterDataManager } from "@/lib/master-data-server";

type CustomerRow = {
  id: string;
  customer_code: string;
  company_name: string | null;
  contact_name: string;
  phone: string;
  city: string | null;
  onboarding_status: string;
  vehicles: { count: number }[];
};

export default async function CustomersPage() {
  await requireMasterDataManager();
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("customers")
    .select("id, customer_code, company_name, contact_name, phone, city, onboarding_status, vehicles(count)")
    .order("created_at", { ascending: false })
    .returns<CustomerRow[]>();

  return (
    <AppShell title="Customers">
      <PageHeader title="Customers" action={<Link className="rounded-xl bg-navy-700 px-4 py-2 text-sm font-semibold text-white shadow-sm" href="/customers/new">Add customer</Link>} />
      <SearchFilterBar searchPlaceholder="Search customers by name, code, contact, city, or phone" filterLabel="Customer status" />
      {error ? <DataError message={error.message} /> : <DataTable rows={data ?? []} emptyTitle="No customers added yet" emptyDescription="No customers added yet. Add your first customer to begin managing vehicle insurance claim assistance." columns={[
        { header: "Customer", cell: (customer) => <><p className="font-semibold text-navy-900">{customer.company_name ?? customer.contact_name}</p><p className="text-xs text-slate-500">{customer.customer_code}</p></> },
        { header: "Contact", cell: (customer) => customer.contact_name },
        { header: "Phone", cell: (customer) => customer.phone },
        { header: "City", cell: (customer) => customer.city ?? "—" },
        { header: "Vehicles", cell: (customer) => <span className="font-semibold">{customer.vehicles?.[0]?.count ?? 0}</span> },
        { header: "Status", cell: (customer) => <StatusBadge status={customer.onboarding_status} /> },
        { header: "", cell: (customer) => <Link className="font-semibold text-navy-700" href={`/customers/${customer.id}/edit`}>Edit</Link> }
      ]} />}
    </AppShell>
  );
}
