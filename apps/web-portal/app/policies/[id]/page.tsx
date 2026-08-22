import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Eye, ShieldCheck } from "lucide-react";
import { AppShell } from "@/components/shell";
import { getAccessibleCustomerIds } from "@/lib/employee-access-scope";
import { requireCapability } from "@/lib/master-data-server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

type PolicyDetail = {
  id: string;
  customer_id: string;
  policy_no: string;
  policy_type: string;
  business_line: string | null;
  start_date: string;
  end_date: string;
  issuance_date: string | null;
  insured_declared_value: number | null;
  premium_amount: number | null;
  intermediary_type: string | null;
  intermediary_code: string | null;
  customers: { customer_code: string; contact_name: string } | null;
  vehicles: { vehicle_no: string } | null;
  insurance_companies: { name: string } | null;
};

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function PolicyReadOnlyPage({ params }: { params: Promise<{ id: string }> }) {
  const profile = await requireCapability("view_policies");
  if (!profile?.id) redirect("/access-denied");
  const { id } = await params;
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("policies")
    .select("id,customer_id,policy_no,policy_type,business_line,start_date,end_date,issuance_date,insured_declared_value,premium_amount,intermediary_type,intermediary_code,customers(customer_code,contact_name),vehicles(vehicle_no),insurance_companies(name)")
    .eq("id", id)
    .maybeSingle<PolicyDetail>();
  if (error || !data) notFound();
  const accessibleIds = await getAccessibleCustomerIds(profile.id, profile.role, "view_policies");
  if (accessibleIds !== null && !accessibleIds.includes(data.customer_id)) redirect("/access-denied");

  return (
    <AppShell title="Policy details" backHref="/policies">
      <section className="mx-auto max-w-[1100px] overflow-hidden rounded-2xl border border-[#DCE5EF] bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-[#E5ECF5] bg-[#F8FAFC] px-5 py-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-xl bg-[#17365D] text-white"><ShieldCheck className="h-5 w-5" /></span><div><p className="text-[9px] font-bold uppercase tracking-[.1em] text-[#64748B]">Read-only policy record</p><h1 className="mt-1 text-[18px] font-semibold text-[#0F172A]">{data.policy_no}</h1><p className="mt-1 text-[10px] text-[#64748B]">{data.insurance_companies?.name ?? "Insurance company"}</p></div></div>
          <span className="inline-flex items-center gap-1.5 self-start rounded-full border border-[#CFE0F2] bg-[#EFF6FF] px-3 py-1.5 text-[9px] font-bold text-[#315B9A]"><Eye className="h-3.5 w-3.5" />View only</span>
        </div>
        <div className="grid gap-4 p-5 md:grid-cols-2">
          <Info label="Policy number" value={data.policy_no} />
          <Info label="Insurer" value={data.insurance_companies?.name} />
          <Info label="Policy type" value={pretty(data.policy_type)} />
          <Info label="Business line" value={pretty(data.business_line)} />
          <Info label="Customer" value={data.customers?.contact_name} />
          <Info label="Customer code" value={data.customers?.customer_code} />
          <Info label="Vehicle" value={data.vehicles?.vehicle_no} />
          <Info label="Issuance date" value={formatDate(data.issuance_date)} />
          <Info label="Valid from" value={formatDate(data.start_date)} />
          <Info label="Valid upto" value={formatDate(data.end_date)} />
          <Info label="IDV" value={money(data.insured_declared_value)} />
          <Info label="Premium" value={money(data.premium_amount)} />
          <Info label="Intermediary type" value={pretty(data.intermediary_type)} />
          <Info label="Intermediary code" value={data.intermediary_code} />
        </div>
        <div className="border-t border-[#E5ECF5] bg-[#FBFCFE] px-5 py-4 text-[9.5px] text-[#64748B]">Insurer pay-in, billing, partner payout, retention, margin and settlement controls are intentionally excluded from this read-only view.<Link href="/policies" className="ml-2 font-bold text-[#315B9A] hover:underline">Back to Policy Register</Link></div>
      </section>
    </AppShell>
  );
}

function Info({ label, value }: { label: string; value: string | null | undefined }) { return <div className="rounded-xl border border-[#E2E8F0] bg-[#FAFCFF] px-4 py-3"><p className="text-[8.5px] font-bold uppercase tracking-[.07em] text-[#64748B]">{label}</p><p className="mt-1.5 text-[11px] font-semibold text-[#24324A]">{value?.trim() || "—"}</p></div>; }
function pretty(value: string | null) { return value ? value.replaceAll("_", " ").replace(/\b\w/g, (m) => m.toUpperCase()) : "—"; }
function formatDate(value: string | null) { if (!value) return "—"; const date = new Date(value); return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("en-IN"); }
function money(value: number | null) { return value == null ? "—" : new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(value); }
