import Link from "next/link";
import { ArrowRight, LockKeyhole, ReceiptIndianRupee } from "lucide-react";
import { PartnerPortalShell } from "@/components/partner-portal/partner-portal-shell";
import { PartnerMetricStrip, PartnerPageHeader, PartnerSectionHeading } from "@/components/partner-portal/partner-page-primitives";
import { getPartnerWebPayoutSummary } from "@/lib/partner-web";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function currency(value: number | string | null | undefined) {
  const amount = Number(value ?? 0);
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(Number.isFinite(amount) ? amount : 0);
}

function dateLabel(value: string | null) {
  if (!value) return "Not recorded";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric" }).format(d);
}

function humanize(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default async function PartnerPayoutPage() {
  const payout = await getPartnerWebPayoutSummary();

  return (
    <PartnerPortalShell title="Payout">
      {payout.available ? (
        <div className="space-y-7">
          <PartnerPageHeader
            eyebrow="Commercial"
            title="Payout overview"
            description="Only payout information explicitly available to this Partner account is shown."
          />

          <PartnerMetricStrip
            items={[
              { label: "Recorded", value: currency(payout.recorded_amount), meta: payout.pending_count + " pending records" },
              { label: "Eligible", value: currency(payout.eligible_amount), meta: "Commercially eligible" },
              { label: "Paid", value: currency(payout.paid_amount), meta: payout.paid_count + " paid records" },
              { label: "Needs Review", value: currency(payout.needs_review_amount), meta: payout.needs_review_count + " records" },
            ]}
          />

          {payout.needs_review_count > 0 ? (
            <section className="rounded-[22px] border border-[#F0D7AE] bg-[#FFF8EC] px-5 py-4">
              <p className="text-[10px] font-black uppercase tracking-[0.1em] text-[#99600E]">Commercial Review</p>
              <p className="mt-1 text-[10.5px] font-semibold leading-4 text-[#80511A]">{payout.needs_review_count} payout record{payout.needs_review_count === 1 ? "" : "s"} require commercial review before they should be treated as final.</p>
            </section>
          ) : null}

          <section className="overflow-hidden border-y border-[#DCE4ED]">
            <div className="py-4"><PartnerSectionHeading title="Recent payout records" description={payout.total_rows + " total recorded"} action={<span className="text-[9px] font-bold text-[#667892]">{payout.intermediary_code}</span>} /></div>

            {payout.recent.length ? (
              <div className="divide-y divide-[#E8EDF4]">
                {payout.recent.map((row) => (
                  <Link key={row.id} href={"/partner/policies/" + encodeURIComponent(row.policy_id)} className="group grid gap-3 px-5 py-4 transition hover:bg-[#F8FAFD] sm:px-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(130px,.6fr)_minmax(120px,.55fr)_auto] lg:items-center">
                    <div>
                      <p className="text-[11.5px] font-extrabold text-[#1B2F4E]">{row.policy_no}</p>
                      <p className="mt-0.5 text-[10px] font-medium text-[#74839A]">{row.customer_name}</p>
                    </div>
                    <div>
                      <p className="text-[11px] font-extrabold text-[#203653]">{currency(row.amount)}</p>
                      <p className="mt-0.5 text-[9px] text-[#8190A5]">{dateLabel(row.payout_date)}</p>
                    </div>
                    <span className="inline-flex w-fit rounded-lg bg-[#EEF3F8] px-2 py-1 text-[9px] font-bold text-[#425672]">{humanize(row.status || row.commercial_status)}</span>
                    <ArrowRight className="hidden h-4 w-4 text-[#8090A8] transition group-hover:translate-x-0.5 lg:block" />
                  </Link>
                ))}
              </div>
            ) : (
              <div className="px-5 py-14 text-center">
                <ReceiptIndianRupee className="mx-auto h-7 w-7 text-[#9AABC0]" />
                <p className="mt-3 text-[12px] font-bold text-[#23395D]">No payout records yet</p>
                <p className="mt-1 text-[10.5px] text-[#7A899F]">Commercial payout records will appear here when available.</p>
              </div>
            )}
          </section>
        </div>
      ) : (
        <section className="rounded-[26px] border border-[#D7E0EC] bg-white px-5 py-12 text-center shadow-[0_16px_45px_rgba(34,56,89,.07)] sm:px-8">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-[#EEF4FF] text-[#3156B8]"><LockKeyhole className="h-6 w-6" /></span>
          <p className="mt-5 text-[9px] font-black uppercase tracking-[0.16em] text-[#687A96]">Commercial Visibility</p>
          <h2 className="mt-1 text-[22px] font-extrabold tracking-[-0.02em] text-[#152746]">Payout details are restricted</h2>
          <p className="mx-auto mt-2 max-w-lg text-[11px] font-medium leading-5 text-[#74839A]">{payout.reason}</p>
        </section>
      )}
    </PartnerPortalShell>
  );
}

