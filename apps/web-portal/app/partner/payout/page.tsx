import Link from "next/link";
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  Clock3,
  FileText,
  LockKeyhole,
  ReceiptIndianRupee,
} from "lucide-react";
import { PartnerPortalShell } from "@/components/partner-portal/partner-portal-shell";
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
    <div className="flex min-h-[98px] items-center gap-4 px-5 py-4 sm:px-6 lg:border-r lg:border-[#DCE5F1] lg:last:border-r-0">
      <span className={`grid h-12 w-12 shrink-0 place-items-center rounded-full ${iconClassName}`}>
        <Icon className="h-5 w-5" />
      </span>
      <div className="min-w-0">
        <p className="text-[9px] font-black uppercase tracking-[0.08em] text-[#617596]">{label}</p>
        <p className="mt-1.5 truncate text-[20px] font-black leading-none tracking-[-0.03em] text-[#10254B]">{value}</p>
        <p className="mt-2 text-[10px] font-medium text-[#7586A0]">{meta}</p>
      </div>
    </div>
  );
}

export default async function PartnerPayoutPage() {
  const payout = await getPartnerWebPayoutSummary();

  return (
    <PartnerPortalShell title="Payout">
      {payout.available ? (
        <div className="space-y-4 pb-4">
          <section className="relative isolate min-h-[132px] overflow-hidden rounded-xl border border-[#C9DDF5] bg-[linear-gradient(105deg,#EAF4FF_0%,#DDEEFF_45%,#CFE5FF_100%)] px-5 py-5 shadow-[0_6px_18px_rgba(40,83,145,0.06)] sm:px-6">
            <div className="pointer-events-none absolute inset-0" aria-hidden="true">
              <div className="absolute -right-16 -top-20 h-72 w-[42%] rotate-[23deg] border-l-[28px] border-white/30" />
              <div className="absolute right-[5%] -top-24 h-72 w-[28%] rotate-[23deg] border-l-[24px] border-[#9FC8F7]/35" />
              <div className="absolute right-[18%] -top-24 h-72 w-[18%] rotate-[23deg] border-l-[18px] border-white/25" />
            </div>

            <div className="relative z-10 flex min-h-[90px] items-center gap-4 pr-[36%] sm:gap-5">
              <span className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-white/75 text-[#1771E8] shadow-[0_7px_18px_rgba(40,86,150,0.08)] ring-1 ring-white/70">
                <ReceiptIndianRupee className="h-8 w-8" />
              </span>
              <div className="min-w-0">
                <h1 className="text-[24px] font-black tracking-[-0.035em] text-[#10234D] sm:text-[27px]">Payout Overview</h1>
                <p className="mt-1 text-[11px] font-medium text-[#5E7393]">View your payout records.</p>
              </div>
            </div>

            <div className="pointer-events-none absolute inset-y-0 right-[3%] hidden w-[26%] items-center justify-center md:flex" aria-hidden="true">
              <div className="relative">
                <div className="absolute -left-6 -top-5 h-12 w-28 rounded-xl bg-[#27599E] opacity-85" />
                <div className="relative grid h-20 w-36 place-items-center rounded-[18px] bg-[linear-gradient(145deg,#0D4C9A,#0A2D70)] text-white shadow-[0_14px_26px_rgba(13,55,120,0.22)]">
                  <span className="text-[34px] font-black leading-none">₹</span>
                </div>
                <span className="absolute -bottom-2 -right-4 grid h-10 w-10 place-items-center rounded-full bg-[#2BC879] text-white shadow-[0_7px_16px_rgba(43,200,121,0.30)]">
                  <CheckCircle2 className="h-6 w-6" />
                </span>
              </div>
            </div>
          </section>

          <section className="grid overflow-hidden rounded-xl border border-[#DCE5F1] bg-white shadow-[0_5px_16px_rgba(31,65,115,0.05)] sm:grid-cols-2 lg:grid-cols-4">
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

          {payout.needs_review_count > 0 ? (
            <section className="rounded-xl border border-[#F0D7AE] bg-[#FFF8EC] px-4 py-3 sm:px-5">
              <p className="text-[9px] font-black uppercase tracking-[0.1em] text-[#99600E]">Commercial Review</p>
              <p className="mt-1 text-[10.5px] font-semibold leading-4 text-[#80511A]">{payout.needs_review_count} payout record{payout.needs_review_count === 1 ? "" : "s"} require commercial review before they should be treated as final.</p>
            </section>
          ) : null}

          <section className="overflow-hidden rounded-xl border border-[#DCE5F1] bg-white shadow-[0_5px_16px_rgba(31,65,115,0.05)]">
            <div className="flex items-center gap-3 border-b border-[#E4EAF2] px-5 py-4">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#EAF3FF] text-[#206DDF]">
                <FileText className="h-5 w-5" />
              </span>
              <div>
                <h2 className="text-[16px] font-black tracking-[-0.02em] text-[#132851]">Recent payout records</h2>
                <p className="mt-0.5 text-[10px] font-medium text-[#73849E]">{payout.total_rows} total recorded</p>
              </div>
            </div>

            {payout.recent.length ? (
              <div className="divide-y divide-[#E7ECF3] px-4 sm:px-5">
                {payout.recent.map((row) => {
                  const status = row.status || row.commercial_status;
                  return (
                    <Link
                      key={row.id}
                      href={`/partner/policies/${encodeURIComponent(row.policy_id)}`}
                      className="group grid min-h-[70px] gap-3 py-3 transition hover:bg-[#F8FBFF] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#3156B8]/20 sm:px-1 lg:grid-cols-[46px_minmax(0,1.3fr)_minmax(150px,.65fr)_minmax(120px,.5fr)_28px] lg:items-center"
                    >
                      <span className="hidden h-9 w-9 place-items-center rounded-full bg-[#EAF3FF] text-[#2973E6] lg:grid">
                        <Building2 className="h-4 w-4" />
                      </span>
                      <div className="min-w-0">
                        <p className="break-words text-[11.5px] font-extrabold leading-4 text-[#172D53]">{row.policy_no}</p>
                        <p className="mt-0.5 break-words text-[10px] font-medium leading-4 text-[#61779A]">{row.customer_name}</p>
                      </div>
                      <div>
                        <p className="text-[11.5px] font-extrabold text-[#182E52]">{currency(row.amount)}</p>
                        <p className="mt-0.5 text-[9px] font-medium text-[#7B8BA2]">{dateLabel(row.payout_date)}</p>
                      </div>
                      <span className={`inline-flex w-fit rounded-full px-3 py-1.5 text-[9.5px] font-bold ${statusTone(status)}`}>{humanize(status)}</span>
                      <ArrowRight className="hidden h-4 w-4 text-[#315A91] transition group-hover:translate-x-0.5 lg:block" />
                    </Link>
                  );
                })}
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
