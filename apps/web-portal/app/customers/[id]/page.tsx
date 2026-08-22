import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Eye, UserRound } from "lucide-react";
import { AppShell } from "@/components/shell";
import { getAccessibleCustomerIds } from "@/lib/employee-access-scope";
import { requireCapability } from "@/lib/master-data-server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

type CustomerDetail = {
  id: string;
  customer_code: string;
  partner_type: string | null;
  company_name: string | null;
  contact_name: string;
  phone: string;
  email: string | null;
  city: string | null;
  state: string | null;
  address: string | null;
  onboarding_status: string;
  created_at: string;
};

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function CustomerReadOnlyPage({ params }: { params: Promise<{ id: string }> }) {
  const profile = await requireCapability("view_customers");
  if (!profile?.id) redirect("/access-denied");
  const { id } = await params;
  const accessibleIds = await getAccessibleCustomerIds(profile.id, profile.role, "view_customers");
  if (accessibleIds !== null && !accessibleIds.includes(id)) redirect("/access-denied");

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("customers")
    .select("id,customer_code,partner_type,company_name,contact_name,phone,email,city,state,address,onboarding_status,created_at")
    .eq("id", id)
    .maybeSingle<CustomerDetail>();
  if (error || !data) notFound();

  return (
    <AppShell title="Customer details" backHref="/customers">
      <section className="mx-auto max-w-[1100px] overflow-hidden rounded-2xl border border-[#DCE5EF] bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-[#E5ECF5] bg-[#F8FAFC] px-5 py-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-[#17365D] text-white"><UserRound className="h-5 w-5" /></span>
            <div><p className="text-[9px] font-bold uppercase tracking-[.1em] text-[#64748B]">Read-only customer record</p><h1 className="mt-1 text-[18px] font-semibold text-[#0F172A]">{data.contact_name}</h1><p className="mt-1 text-[10px] text-[#64748B]">{data.customer_code}</p></div>
          </div>
          <span className="inline-flex items-center gap-1.5 self-start rounded-full border border-[#CFE0F2] bg-[#EFF6FF] px-3 py-1.5 text-[9px] font-bold text-[#315B9A]"><Eye className="h-3.5 w-3.5" />View only</span>
        </div>
        <div className="grid gap-4 p-5 md:grid-cols-2">
          <Info label="Customer name" value={data.contact_name} />
          <Info label="Company / business" value={data.company_name} />
          <Info label="Customer type" value={formatValue(data.partner_type)} />
          <Info label="Mobile" value={data.phone} />
          <Info label="Email" value={data.email} />
          <Info label="City" value={data.city} />
          <Info label="State" value={data.state} />
          <Info label="Address" value={data.address} wide />
          <Info label="Onboarding status" value={formatValue(data.onboarding_status)} />
          <Info label="Created" value={formatDate(data.created_at)} />
        </div>
        <div className="border-t border-[#E5ECF5] bg-[#FBFCFE] px-5 py-4 text-[9.5px] text-[#64748B]">
          KYC documents, identity verification, portal access and protected profile actions are intentionally excluded from this view.
          <Link href="/customers" className="ml-2 font-bold text-[#315B9A] hover:underline">Back to Customer Register</Link>
        </div>
      </section>
    </AppShell>
  );
}

function Info({ label, value, wide = false }: { label: string; value: string | null | undefined; wide?: boolean }) {
  return <div className={`rounded-xl border border-[#E2E8F0] bg-[#FAFCFF] px-4 py-3 ${wide ? "md:col-span-2" : ""}`}><p className="text-[8.5px] font-bold uppercase tracking-[.07em] text-[#64748B]">{label}</p><p className="mt-1.5 text-[11px] font-semibold text-[#24324A]">{value?.trim() || "—"}</p></div>;
}
function formatValue(value: string | null) { return value ? value.replaceAll("_", " ").replace(/\b\w/g, (match) => match.toUpperCase()) : "—"; }
function formatDate(value: string) { const date = new Date(value); return Number.isNaN(date.getTime()) ? "—" : date.toLocaleDateString("en-IN"); }
