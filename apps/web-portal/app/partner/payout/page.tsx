import Link from "next/link";
import {
  ArrowRight,
  Clock3,
  FileText,
  LockKeyhole,
  ReceiptIndianRupee,
} from "lucide-react";
import { PartnerPortalShell } from "@/components/partner-portal/partner-portal-shell";
import { getPartnerWebPayoutSummary } from "@/lib/partner-web";
import { PayoutSearch } from "./payout-search";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type SearchParams = { q?: string };

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

function statusTone(value: string) {
  const normalized = value.toLowerCase();
  if (normalized.includes("paid")) return "bg-[#E8F8EF] text-[#218A59]";
  if (normalized.includes("review")) return "bg-[#FFF2E2] text-[#C36B08]";
  return "bg-[#EAF3FF] text-[#2368D9]";
}

type IconType = typeof ReceiptIndianRupee;

type MetricItemProps = {
  label: string;
  value: string;
  meta: string;
  icon: IconType;
  iconClassName: string;
};

function PayoutMetric({ label, value, meta, icon: Icon, iconClassName }: MetricItemProps) {
  return (
    <div className="flex min-h-[76px] items-center gap-3 px-4 py-3 sm:px-5 lg:border-r lg:border-[#DCE5F1] lg:last:border-r-0">
      <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-full ${iconClassName}`}>
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0">
        <p className="text-[8px] font-black uppercase tracking-[0.08em] text-[#617596]">{label}</p>
        <p className="mt-1 truncate text-[17px] font-black leading-none tracking-[-0.025em] text-[#10254B]">{value}</p>
        <p className="mt-1.5 text-[9px] font-medium text-[#7586A0]">{meta}</p>
      </div>
    </div>
  );
}

export default async function PartnerPayoutPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const query = await searchParams;
  const q = query.q?.trim() ?? "";
  const normalizedQuery = q.toLowerCase();
  const payout = await getPartnerWebPayoutSummary();

  const recent = payout.available && normalizedQuery
    ? payout.recent.filter((row) => {
        const searchableValues = [
          row.policy_no,
          row.customer_name,
          row.status,
          row.commercial_status,
          row.voucher_number,
          row.amount,
        ];
        return searchableValues.some((value) => String(value ?? "").toLowerCase().includes(normalizedQuery));
      })
    : payout.available
      ? payout.recent
      : [];

  return (
    <PartnerPortalShell title="Payout">
      {payout.available ? (
        <div className="space-y-4 pb-4">
          <section className="grid overflow-hidden rounded-xl border border-[#DCE5F1] bg-white shadow-[0_4px_14px_rgba(31,65,115,0.045)] sm:grid-cols-2 lg:grid-cols-4">
            <PayoutMetric
              label="Recorded"
              value={currency(payout.recorded_amount)}
              meta={`${payout.pending_count} pending records`}
              icon={ReceiptIndianRupee}
              iconClassName="bg-[#E5F2FF] text-[#1974E9]"
            />
            <PayoutMetric
              label="Eligible"
              value={currency(payout.eligible_amount)}
              meta="Commercially eligible"
              icon={FileText}
              iconClassName="bg-[#E5F8EF] text-[#1EB56E]"
            />
            <PayoutMetric
              label="Paid"
              value={currency(payout.paid_amount)}
              meta={`${payout.paid_count} paid records`}
              icon={ReceiptIndianRupee}
              iconClassName="bg-[#F2E7FF] text-[#8B42E8]"
            />
            <PayoutMetric
              label="Needs Review"
              value={currency(payout.needs_review_amount)}
              meta={`${payout.needs_review_count} records`}
              icon={Clock3}
              iconClassName="bg-[#FFF0E4] text-[#F07A19]"
            />
          </section>

          <section className="overflow-hidden rounded-xl border border-[#DCE5F1] bg-white shadow-[0_5px_16px_rgba(31,65,115,0.05)]">
            <div className="flex flex-col gap-3 border-b border-[#E4EAF2] px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
              <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:items-center">
                <div className="flex items-center gap-2.5">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[#EAF3FF] text-[#206DDF]">
                    <FileText className="h-4 w-4" />
                  </span>
                  <h2 className="whitespace-nowrap text-[14px] font-black tracking-[-0.02em] text-[#132851]">Recent payout records</h2>
                </div>
                <PayoutSearch initialQuery={q} />
              </div>
              <div className="flex items-center gap-2 border-l border-[#E5EBF2] pl-4">
                <span className="whitespace-nowrap text-[9px] font-medium text-[#617596]">Total recorded</span>
                <span className="text-[16px] font-black leading-none text-[#10254B]">{payout.total_rows}</span>
              </div>
            </div>

            {recent.length ? (
              <div className="overflow-x-auto">
                <div className="min-w-[760px]">
                  <div className="grid grid-cols-[minmax(300px,1.4fr)_minmax(140px,.55fr)_minmax(120px,.45fr)_64px] border-b border-[#E4EAF2] bg-[#F8FAFD] px-4 py-2 text-[8px] font-bold text-[#60728E] sm:px-5">
                    <span>Reference / Customer</span>
                    <span>Amount</span>
                    <span>Status</span>
                    <span className="text-center">Action</span>
                  </div>
                  {recent.map((row) => {
                    const status = row.status || row.commercial_status;
                    return (
                      <Link
                        key={row.id}
                        href={`/partner/policies/${encodeURIComponent(row.policy_id)}`}
                        className="group grid min-h-[54px] grid-cols-[minmax(300px,1.4fr)_minmax(140px,.55fr)_minmax(120px,.45fr)_64px] items-center border-b border-[#E7ECF3] px-4 py-2 transition last:border-b-0 hover:bg-[#F8FBFF] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#3156B8]/20 sm:px-5"
                      >
                        <div className="min-w-0">
                          <p className="break-words text-[10.5px] font-extrabold leading-4 text-[#172D53]">{row.policy_no}</p>
                          <p className="mt-0.5 break-words text-[9px] font-medium leading-4 text-[#61779A]">{row.customer_name}</p>
                        </div>
                        <div>
                          <p className="text-[10.5px] font-extrabold text-[#182E52]">{currency(row.amount)}</p>
                          <p className="mt-0.5 text-[8.5px] font-medium text-[#7B8BA2]">{dateLabel(row.payout_date)}</p>
                        </div>
                        <span className={`inline-flex w-fit rounded-md px-2.5 py-1 text-[8.5px] font-bold ${statusTone(status)}`}>{humanize(status)}</span>
                        <span className="flex items-center justify-center">
                          <ArrowRight className="h-3.5 w-3.5 text-[#315A91] transition group-hover:translate-x-0.5" />
                        </span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            ) : q ? (
              <div className="px-5 py-14 text-center">
                <ReceiptIndianRupee className="mx-auto h-7 w-7 text-[#9AABC0]" />
                <p className="mt-3 text-[12px] font-bold text-[#23395D]">No payout records match your search</p>
                <p className="mt-1 text-[10.5px] text-[#7A899F]">Try another policy number, customer, status, voucher or amount.</p>
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
        <section className="border-y border-[#DCE4ED] px-1 py-12 text-center sm:px-4">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-xl bg-[#EEF4FF] text-[#3156B8]"><LockKeyhole className="h-6 w-6" /></span>
          <p className="mt-5 text-[9px] font-black uppercase tracking-[0.16em] text-[#687A96]">Commercial Visibility</p>
          <h2 className="mt-1 text-[22px] font-extrabold tracking-[-0.02em] text-[#152746]">Payout details are restricted</h2>
          <p className="mx-auto mt-2 max-w-lg text-[11px] font-medium leading-5 text-[#74839A]">{payout.reason}</p>
        </section>
      )}
    </PartnerPortalShell>
  );
}
