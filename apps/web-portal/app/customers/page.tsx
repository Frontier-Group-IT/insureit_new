import Link from "next/link";
import { AppShell } from "@/components/shell";
import { DataError } from "@/components/record-list";
import { createServerSupabaseClient } from "@/lib/auth-server";
import { requireMasterDataManager } from "@/lib/master-data-server";
import { CustomerWorkspace } from "./customer-workspace";

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

export default async function CustomersPage() {
  await requireMasterDataManager();
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("customers")
    .select("id, customer_code, partner_type, company_name, contact_name, phone, city, fleet_size_band, onboarding_status, vehicles(count)")
    .order("created_at", { ascending: false })
    .returns<CustomerRow[]>();

  const rows = data ?? [];

  return (
    <AppShell title="Customers">
      <div className="mb-2 flex justify-end">
        <Link href="/customers/dealership-type" className="inline-flex h-9 items-center justify-center rounded-md border border-[#C7D2FE] bg-[#EEF2FF] px-4 text-[11px] font-semibold text-[#4338CA] hover:bg-[#E0E7FF]">+ Add Dealership</Link>
      </div>
      <div className="pb-3">
        {error ? <DataError message={error.message} /> : <CustomerWorkspace rows={rows} />}
      </div>
    </AppShell>
  );
}
