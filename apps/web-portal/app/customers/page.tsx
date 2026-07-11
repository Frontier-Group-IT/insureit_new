import Link from "next/link";
import { DataError, DataTable } from "@/components/record-list";
import { AppShell } from "@/components/shell";
import { SearchFilterBar, StatusBadge } from "@/components/ui";
import { createServerSupabaseClient } from "@/lib/auth-server";
import { requireMasterDataManager } from "@/lib/master-data-server";

type CustomerRow = {
  id: string;
  customer_code: string;
  partner_type: string | null;
  company_name: string | null;
  contact_name: string;
  phone: string;
  city: string | null;
  fleet_size_band: string | null;
  onboarding_status: string;
  vehicles: { count: number }[];
};

const partnerLabels: Record<string, string> = {
  individual_proprietor: "Individual / Proprietor",
  dealership: "Dealership",
  corporate: "Corporate",
  group: "Group"
};

const fleetLabels: Record<string, string> = {
  less_than_5: "< 5",
  "5_to_20": "5–20",
  "20_to_50": "20–50",
  more_than_50: "> 50"
};

export default async function CustomersPage() {
  await requireMasterDataManager();
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("customers")
    .select("id, customer_code, partner_type, company_name, contact_name, phone, city, fleet_size_band, onboarding_status, vehicles(count)")
    .order("created_at", { ascending: false })
    .returns<CustomerRow[]>();

  const rows = data ?? [];
  const activeCount = rows.filter((row) => row.onboarding_status === "active").length;
  const pendingCount = rows.filter((row) => row.onboarding_status !== "active").length;

  return (
    <AppShell title="Customers">
      <div className="space-y-3 pb-5">
        <section className="grid gap-2 sm:grid-cols-2 xl:grid-cols-[1fr_1fr_1fr_auto]">
          <SummaryCard label="Total Customers" value={rows.length} />
          <SummaryCard label="Active" value={activeCount} />
          <SummaryCard label="Onboarding Pending" value={pendingCount} />
          <Link
            href="/customers/new"
            className="inline-flex min-h-[66px] min-w-[210px] items-center justify-center rounded-xl bg-[#0B4C8C] px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#083B6D]"
          >
            + Add New Customer
          </Link>
        </section>

        <section className="rounded-2xl border border-[#DCE7F5] bg-white p-3 shadow-[0_6px_18px_rgba(7,29,73,0.035)]">
          <SearchFilterBar searchPlaceholder="Search by customer, code, mobile or city" filterLabel="Customer status" />
          <div className="mt-2">
            {error ? <DataError message={error.message} /> : <DataTable compact rows={rows} emptyTitle="No customers added yet" emptyDescription="Add your first customer to begin onboarding and fleet management." columns={[
              { header: "Customer", cell: (customer) => <><p className="font-semibold leading-5 text-[#071D49]">{customer.company_name ?? customer.contact_name}</p><p className="text-[11px] leading-4 text-[#7A8797]">{customer.customer_code}</p></> },
              { header: "Partner Type", cell: (customer) => customer.partner_type ? partnerLabels[customer.partner_type] ?? customer.partner_type : "—" },
              { header: "Mobile", cell: (customer) => customer.phone },
              { header: "City", cell: (customer) => customer.city ?? "—" },
              { header: "Fleet", cell: (customer) => customer.fleet_size_band ? fleetLabels[customer.fleet_size_band] ?? customer.fleet_size_band : "—" },
              { header: "Vehicles", cell: (customer) => <span className="font-semibold">{customer.vehicles?.[0]?.count ?? 0}</span> },
              { header: "Status", cell: (customer) => <StatusBadge status={customer.onboarding_status} /> },
              { header: "", cell: (customer) => <Link className="whitespace-nowrap font-semibold text-[#174EA6] hover:text-[#071D49]" href={`/customers/${customer.id}/edit`}>View / Edit</Link> }
            ]} />}
          </div>
        </section>
      </div>
    </AppShell>
  );
}

function SummaryCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex min-h-[66px] items-center justify-between rounded-xl border border-[#DCE7F5] bg-white px-4 py-2.5 shadow-[0_4px_12px_rgba(7,29,73,0.025)]">
      <p className="text-[11.5px] font-medium text-[#68758A]">{label}</p>
      <p className="text-xl font-semibold text-[#071D49]">{value}</p>
    </div>
  );
}
