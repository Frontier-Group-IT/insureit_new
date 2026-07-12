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
  const activeCount = rows.filter((row) => row.onboarding_status === "active").length;
  const pendingCount = rows.length - activeCount;

  return (
    <AppShell title="Customers">
      <div className="space-y-2 pb-3">
        <section className="flex flex-wrap items-center gap-1.5 rounded-[var(--radius-panel)] border border-[var(--border)] bg-white px-2.5 py-2 shadow-[var(--shadow-panel)]">
          <Metric label="Total" value={rows.length} />
          <Metric label="Active" value={activeCount} tone="success" />
          <Metric label="Onboarding" value={pendingCount} tone="warning" />
          <Link
            href="/customers/new"
            className="ml-auto inline-flex h-7 items-center justify-center rounded-md bg-[var(--accent)] px-3 text-[10.5px] font-semibold text-white transition hover:bg-[var(--accent-strong)]"
          >
            + Add New Customer
          </Link>
        </section>

        {error ? <DataError message={error.message} /> : <CustomerWorkspace rows={rows} />}
      </div>
    </AppShell>
  );
}

function Metric({ label, value, tone = "neutral" }: { label: string; value: number; tone?: "neutral" | "success" | "warning" }) {
  const toneClass = tone === "success"
    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
    : tone === "warning"
      ? "border-amber-200 bg-amber-50 text-amber-700"
      : "border-[#DDE5EF] bg-[#F7F9FC] text-[var(--text)]";

  return (
    <div className={`inline-flex h-7 items-center gap-2 rounded-md border px-2.5 ${toneClass}`}>
      <span className="text-[9.5px] font-medium">{label}</span>
      <span className="text-[12px] font-semibold tabular-nums">{value}</span>
    </div>
  );
}
