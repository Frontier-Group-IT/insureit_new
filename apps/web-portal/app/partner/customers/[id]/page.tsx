import Link from "next/link";
import {
  BadgeCheck,
  CalendarDays,
  CarFront,
  Phone,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import { PartnerPortalShell } from "@/components/partner-portal/partner-portal-shell";
import { StandardActivityStatusCard } from "@/components/standard-activity-status-card";
import { getPartnerWebCustomerActivity, getPartnerWebCustomerDetail } from "@/lib/partner-web";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function dateLabel(value: string | null) {
  if (!value) return "—";
  const parsed = new Date(value.length === 10 ? value + "T00:00:00" : value);
  return Number.isNaN(parsed.getTime())
    ? value
    : new Intl.DateTimeFormat("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }).format(parsed);
}

function statusLabel(value: string | null) {
  return (value || "active")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function display(...values: Array<string | number | null | undefined>) {
  return values
    .map((value) => (value == null ? "" : String(value).trim()))
    .filter(Boolean)
    .join(" · ");
}

function customerTypeLabel(value: string | null) {
  if (!value) return "Individual / Proprietor";
  return statusLabel(value);
}

export default async function PartnerCustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [data, activity] = await Promise.all([
    getPartnerWebCustomerDetail(id),
    getPartnerWebCustomerActivity(id, 10),
  ]);
  const customer = data.customer;
  const relationship = display(customer.intermediary_type, customer.intermediary_code) || "Not recorded";
  const location = [customer.city, customer.state].filter(Boolean).join(", ") || "Not recorded";
  const customerActivity = activity.items.slice(0, 2);

  return (
    <PartnerPortalShell title="Customer Detail">
      <div className="space-y-2 pb-5">
        <section className="overflow-hidden rounded-2xl border border-[#173E7B] bg-gradient-to-br from-[#071D49] via-[#0A2B65] to-[#0C4A9A] text-white shadow-[0_18px_45px_rgba(7,29,73,.18)]">
          <div className="px-4 py-3.5">
            <div className="flex min-w-0 items-center gap-3">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white text-[#315FEA] shadow-md">
                <UserRound className="h-5 w-5" strokeWidth={1.9} />
              </span>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="truncate text-[18px] font-semibold tracking-[-0.01em] text-white">
                    {customer.customer_name}
                  </h1>
                  <span className="grid h-5 w-5 place-items-center rounded-full bg-[#1FC77A] text-[10px] font-black text-white">
                    ✓
                  </span>
                </div>
                {customer.company_name ? (
                  <p className="mt-0.5 text-[10.5px] font-medium text-blue-100">{customer.company_name}</p>
                ) : null}
              </div>
            </div>
          </div>

          <div className="grid border-t border-white/15 sm:grid-cols-2 xl:grid-cols-6" aria-label="Customer summary">
            <HeaderMetric icon={UserRound} label="Customer Type" value={customerTypeLabel(customer.customer_type)} />
            <HeaderMetric icon={BadgeCheck} label="Relationship" value={relationship} />
            <HeaderMetric icon={CarFront} label="Fleet Size" value={String(data.summary.vehicles)} />
            <HeaderMetric icon={Phone} label="Mobile" value={customer.phone || "Not set"} />
            <HeaderMetric icon={BadgeCheck} label="Customer Code" value={customer.customer_code || "Not set"} />
            <HeaderMetric icon={CalendarDays} label="Active Since" value={dateLabel(customer.created_at)} />
          </div>
        </section>

        <section className="overflow-hidden rounded-2xl border border-[#DDE4EE] bg-white shadow-[0_8px_24px_rgba(15,23,42,0.05)]">
          <div className="border-b border-[#E3E8EF] px-4 py-3">
            <h2 className="text-[12px] font-semibold text-[#172033]">Personal Information</h2>
            <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              <ReadOnlyField label="Customer name" value={customer.customer_name} />
              <ReadOnlyField label="Login mobile" value={customer.phone || "Not recorded"} hint="Partner customer contact" />
              <ReadOnlyField label="Email" value={customer.email || "Not recorded"} />
            </div>
          </div>

          <div className="border-b border-[#E3E8EF] px-4 py-3">
            <h2 className="text-[12px] font-semibold text-[#172033]">Address Details</h2>
            <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
              <ReadOnlyField label="Street" value="Not recorded" />
              <ReadOnlyField label="Locality" value="Not recorded" />
              <ReadOnlyField label="City" value={customer.city || "Not recorded"} />
              <ReadOnlyField label="State" value={customer.state || "Not recorded"} />
              <ReadOnlyField label="PIN code" value="Not recorded" />
            </div>
          </div>

          <div className="border-b border-[#E3E8EF] px-4 py-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="text-[12px] font-semibold text-[#172033]">KYC and GST Details</h2>
              <span className="inline-flex items-center gap-2 text-[10.5px] font-semibold text-[#64748B]">
                <span className="h-3.5 w-3.5 rounded border border-[#CBD5E1] bg-white" />
                GST Registered
              </span>
            </div>
            <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <ReadOnlyField label="PAN number" value="Not available in Partner view" />
              <ReadOnlyField label="Aadhaar" value="Not available in Partner view" />
              <ReadOnlyField label="Legal trade name" value={customer.company_name || "Not recorded"} />
              <ReadOnlyField label="Location" value={location} />
            </div>
          </div>

          <div className="border-b border-[#E3E8EF] bg-[#F7F8FF] px-4 py-3">
            <h2 className="text-[12px] font-semibold text-[#172033]">Documents</h2>
            <div className="mt-3 grid gap-2.5 md:grid-cols-3">
              <DocumentPlaceholder label="PAN Copy" />
              <DocumentPlaceholder label="Aadhaar Front" />
              <DocumentPlaceholder label="Aadhaar Back" />
            </div>
          </div>
        </section>

        <StandardActivityStatusCard
          items={customerActivity.map((item) => ({
            id: item.kind + "-" + item.entity_id + "-" + item.event_at,
            title: item.title,
            meta: item.meta,
            at: item.event_at,
          }))}
          emptyText="No customer activity recorded yet."
        />

        <section className="overflow-hidden rounded-2xl border border-[#DDE4EE] bg-white shadow-[0_6px_18px_rgba(15,23,42,0.035)]">
          <div className="flex items-center justify-end gap-2 px-4 py-3">
            <Link
              href="/partner/customers"
              className="inline-flex h-9 items-center justify-center rounded-md border border-[#CBD5E1] bg-white px-4 text-[10.5px] font-semibold text-[#334155] transition hover:bg-[#F8FAFC]"
            >
              Back
            </Link>
            <Link
              href={`/partner/customers/${encodeURIComponent(id)}/fleet`}
              className="inline-flex h-9 items-center justify-center rounded-md border border-[#B8C7DC] bg-[#F7F9FC] px-4 text-[10.5px] font-semibold text-[#173E7B] transition hover:border-[#8EA5C3] hover:bg-[#EEF3F9]"
            >
              View Fleet
            </Link>
          </div>
        </section>
      </div>
    </PartnerPortalShell>
  );
}

function HeaderMetric({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return (
    <div className="flex min-w-0 items-center gap-2.5 border-b border-white/15 px-3 py-2.5 sm:border-r xl:border-b-0 xl:last:border-r-0">
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-white/20 bg-white/5 text-white">
        <Icon className="h-3.5 w-3.5" />
      </span>
      <div className="min-w-0">
        <p className="text-[7px] font-black uppercase tracking-[0.07em] text-white/65">{label}</p>
        <p className="mt-0.5 truncate text-[9px] font-bold text-white">{value}</p>
      </div>
    </div>
  );
}

function ReadOnlyField({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="min-w-0">
      <p className="mb-1 block text-[9.5px] font-semibold uppercase tracking-[0.04em] text-[#68758A]">{label}</p>
      <div className="relative flex h-8 items-center rounded-md border border-[#D8E0EA] bg-white px-2.5 text-[11.5px] text-[#334155]">
        <span className="truncate">{value}</span>
        {hint ? <span className="ml-auto pl-2 text-[8px] text-[#9AA6B5]">{hint}</span> : null}
      </div>
    </div>
  );
}

function DocumentPlaceholder({ label }: { label: string }) {
  return (
    <div className="rounded-xl border border-[#E0E5EE] bg-white p-2.5 shadow-[0_3px_10px_rgba(15,23,42,0.04)]">
      <div className="flex items-center gap-2">
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-[#EEF1FF] text-[#315FEA]">↥</span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[10.5px] font-semibold text-[#172033]">{label}</p>
          <p className="truncate text-[9px] text-[#8A96A8]">Not available in Partner view</p>
        </div>
        <span className="rounded-full border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[8px] font-semibold text-amber-700">Unavailable</span>
      </div>
      <div className="mt-2 flex h-7 items-center justify-center rounded-md border border-dashed border-[#C8D2E0] bg-white text-[9.5px] font-semibold text-[#94A0AF]">Document access not exposed</div>
    </div>
  );
}
