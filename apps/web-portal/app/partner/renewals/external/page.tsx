import Link from "next/link";
import { ArrowLeft, ArrowRight, CalendarClock, Search } from "lucide-react";
import { PartnerPortalShell } from "@/components/partner-portal/partner-portal-shell";
import { PartnerMetricStrip, PartnerPageHeader, PartnerSectionHeading } from "@/components/partner-portal/partner-page-primitives";
import {
  getPartnerExternalRenewalSummary,
  listPartnerExternalRenewals,
  type PartnerExternalRenewalFollowUpFilter,
  type PartnerExternalRenewalMode,
  type PartnerExternalRenewalStatusFilter,
  type PartnerExternalRenewalWindow,
} from "@/lib/partner-external-renewals";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const PAGE_SIZE = 25;

function validMode(value?: string): PartnerExternalRenewalMode {
  return value === "expired" || value === "future" || value === "follow_up" ? value : "due";
}

function validWindow(value?: string): PartnerExternalRenewalWindow {
  return value === "0_7" || value === "8_15" || value === "16_30" ? value : "all";
}

function validStatus(value?: string): PartnerExternalRenewalStatusFilter {
  return value === "new" || value === "contacted" || value === "interested" || value === "quote" || value === "follow_up" || value === "closed" ? value : "all";
}

function validFollowUp(value?: string): PartnerExternalRenewalFollowUpFilter {
  return value === "due" || value === "scheduled" ? value : "all";
}

function pageNumber(value?: string) {
  const parsed = Number(value ?? "1");
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 1;
}

function dateLabel(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value + (value.includes("T") ? "" : "T00:00:00"));
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric" }).format(date);
}

function dateTimeLabel(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: true }).format(date);
}

function expiryLabel(days: number) {
  if (days < 0) return Math.abs(days) + "d overdue";
  if (days === 0) return "Due today";
  return days + "d left";
}

function statusLabel(value: string) {
  const labels: Record<string, string> = {
    new: "New",
    contact_attempted: "Contact Attempted",
    connected: "Connected",
    interested: "Interested",
    quote_requested: "Quote Requested",
    quote_shared: "Quote Shared",
    follow_up: "Follow-up",
    renewed_elsewhere: "Renewed Elsewhere",
    invalid_contact: "Invalid Contact",
    do_not_contact: "Do Not Contact",
    won: "Won",
    lost: "Lost",
  };
  return labels[value] ?? value.replaceAll("_", " ");
}

export default async function PartnerExternalRenewalsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; mode?: string; window?: string; status?: string; follow_up?: string; page?: string }>;
}) {
  const query = await searchParams;
  const q = query.q?.trim() ?? "";
  const mode = validMode(query.mode);
  const window = validWindow(query.window);
  const status = validStatus(query.status);
  const followUp = validFollowUp(query.follow_up);
  const page = pageNumber(query.page);
  const offset = (page - 1) * PAGE_SIZE;

  const [summary, rows] = await Promise.all([
    getPartnerExternalRenewalSummary(),
    listPartnerExternalRenewals({ limit: PAGE_SIZE, offset, search: q, mode, window, status, followUp }),
  ]);

  const total = rows[0]?.total_count ?? 0;
  const hasPrevious = page > 1;
  const hasNext = offset + rows.length < total;

  const hrefFor = (next: {
    mode?: PartnerExternalRenewalMode;
    window?: PartnerExternalRenewalWindow;
    status?: PartnerExternalRenewalStatusFilter;
    followUp?: PartnerExternalRenewalFollowUpFilter;
    page?: number;
  }) => {
    const params = new URLSearchParams();
    const nextMode = next.mode ?? mode;
    const nextWindow = next.window ?? window;
    const nextStatus = next.status ?? status;
    const nextFollowUp = next.followUp ?? followUp;
    const nextPage = next.page ?? 1;
    if (q) params.set("q", q);
    if (nextMode !== "due") params.set("mode", nextMode);
    if (nextMode === "due" && nextWindow !== "all") params.set("window", nextWindow);
    if (nextStatus !== "all") params.set("status", nextStatus);
    if (nextMode === "follow_up" && nextFollowUp !== "all") params.set("follow_up", nextFollowUp);
    if (nextPage > 1) params.set("page", String(nextPage));
    const search = params.toString();
    return search ? "/partner/renewals/external?" + search : "/partner/renewals/external";
  };

  const modeTitle = mode === "expired"
    ? "Recently expired opportunities"
    : mode === "future"
      ? "Future opportunities"
      : mode === "follow_up"
        ? "Follow-up worklist"
        : "30-day opportunity worklist";

  return (
    <PartnerPortalShell title="External Renewal Opportunities">
      <div className="space-y-7">
        <PartnerPageHeader
          eyebrow="External Renewal Opportunities"
          title="Customers to retarget"
          description="External opportunities stay separate from verified INSUREIT business."
          action={
            <Link href="/partner/renewals" prefetch={false} className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-[#D2DCE9] px-3.5 text-[10px] font-bold text-[#203653] transition hover:bg-white/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3156B8]/20">
              <ArrowLeft className="h-3.5 w-3.5" /> Back to Renewals
            </Link>
          }
        />

        <PartnerMetricStrip
          items={[
            { label: "Due in 30 Days", value: summary.due_30_count, meta: "External opportunities" },
            { label: "Not Contacted", value: summary.uncontacted_count, meta: "Start outreach" },
            { label: "Follow-ups Due", value: summary.follow_up_due_count, meta: "Needs attention" },
            { label: "Scheduled", value: summary.follow_up_scheduled_count, meta: "Upcoming follow-ups" },
          ]}
        />

        <section>
          <div className="border-y border-[#DCE4ED] py-3">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <div className="flex flex-wrap gap-2">
                <Link href={hrefFor({ mode: "due", window: "all", followUp: "all", page: 1 })} className={"rounded-lg px-3 py-2 text-[10px] font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3156B8]/20 " + (mode === "due" ? "bg-[#3156B8] text-white" : "border border-[#D8E0EA] bg-white text-[#4D617D]")}>Due</Link>
                <Link href={hrefFor({ mode: "follow_up", window: "all", followUp: "all", page: 1 })} className={"rounded-lg px-3 py-2 text-[10px] font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3156B8]/20 " + (mode === "follow_up" ? "bg-[#3156B8] text-white" : "border border-[#D8E0EA] bg-white text-[#4D617D]")}>Follow-ups</Link>
                <Link href={hrefFor({ mode: "expired", window: "all", followUp: "all", page: 1 })} className={"rounded-lg px-3 py-2 text-[10px] font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3156B8]/20 " + (mode === "expired" ? "bg-[#3156B8] text-white" : "border border-[#D8E0EA] bg-white text-[#4D617D]")}>Recently Expired</Link>
                <Link href={hrefFor({ mode: "future", window: "all", followUp: "all", page: 1 })} className={"rounded-lg px-3 py-2 text-[10px] font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3156B8]/20 " + (mode === "future" ? "bg-[#3156B8] text-white" : "border border-[#D8E0EA] bg-white text-[#4D617D]")}>Future</Link>
              </div>

              <form action="/partner/renewals/external" className="flex w-full gap-2 xl:max-w-[520px]">
                {mode !== "due" ? <input type="hidden" name="mode" value={mode} /> : null}
                {window !== "all" && mode === "due" ? <input type="hidden" name="window" value={window} /> : null}
                {status !== "all" ? <input type="hidden" name="status" value={status} /> : null}
                {followUp !== "all" && mode === "follow_up" ? <input type="hidden" name="follow_up" value={followUp} /> : null}
                <div className="relative min-w-0 flex-1">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#7D8DA4]" />
                  <input name="q" defaultValue={q} placeholder="Search customer, mobile, vehicle or chassis" className="h-9 w-full rounded-lg border border-[#CCD7E4] bg-white pl-9 pr-3 text-[10px] font-semibold text-[#213653] outline-none transition focus:border-[#3156B8] focus:ring-2 focus:ring-[#3156B8]/10" />
                </div>
                <button className="h-9 rounded-lg bg-[#111A35] px-3.5 text-[10px] font-bold text-white transition hover:bg-[#1B2A50] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3156B8]/25" type="submit">Search</button>
              </form>
            </div>

            {mode === "due" ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {(["all", "0_7", "8_15", "16_30"] as PartnerExternalRenewalWindow[]).map((value) => (
                  <Link key={value} href={hrefFor({ window: value, page: 1 })} className={"rounded-lg px-2.5 py-1.5 text-[9px] font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3156B8]/20 " + (window === value ? "bg-[#E9F0FF] text-[#3156B8]" : "bg-[#F4F6F9] text-[#657792]")}>
                    {value === "all" ? "All 30 Days" : value.replace("_", "–") + " Days"}
                  </Link>
                ))}
              </div>
            ) : null}

            {mode === "follow_up" ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {(["all", "due", "scheduled"] as PartnerExternalRenewalFollowUpFilter[]).map((value) => (
                  <Link key={value} href={hrefFor({ followUp: value, page: 1 })} className={"rounded-lg px-2.5 py-1.5 text-[9px] font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3156B8]/20 " + (followUp === value ? "bg-[#E9F0FF] text-[#3156B8]" : "bg-[#F4F6F9] text-[#657792]")}>
                    {value === "all" ? "All Follow-ups" : value === "due" ? "Due Now" : "Scheduled"}
                  </Link>
                ))}
              </div>
            ) : null}

            <div className="mt-3 flex flex-wrap gap-2 border-t border-[#E7ECF2] pt-3">
              {(["all", "new", "contacted", "interested", "quote", "follow_up", "closed"] as PartnerExternalRenewalStatusFilter[]).map((value) => (
                <Link key={value} href={hrefFor({ status: value, page: 1 })} className={"rounded-lg px-2.5 py-1.5 text-[9px] font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3156B8]/20 " + (status === value ? "bg-[#111A35] text-white" : "bg-[#F4F6F9] text-[#657792]")}>
                  {value === "all" ? "Active" : value === "follow_up" ? "Follow-up" : value.charAt(0).toUpperCase() + value.slice(1)}
                </Link>
              ))}
            </div>
          </div>

          <div className="mt-5">
            <PartnerSectionHeading title={modeTitle} description={rows.length + " shown · " + total + " matched"} />
          </div>

          <div className="mt-3 border-y border-[#DCE4ED]">
            {rows.length ? (
              <div className="divide-y divide-[#E8EDF4]">
                {rows.map((row) => (
                  <Link key={row.opportunity_id} href={"/partner/renewals/external/" + encodeURIComponent(row.opportunity_id)} prefetch={false} className="group grid gap-3 px-1 py-3.5 transition hover:bg-white/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#3156B8]/20 sm:px-4 sm:py-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_minmax(170px,.8fr)_minmax(145px,.7fr)_auto] xl:items-center">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#EEF4FF] text-[#3156B8]"><CalendarClock className="h-4 w-4" /></span>
                      <div className="min-w-0">
                        <p className="break-words text-[11.5px] font-extrabold leading-4 text-[#1B2F4E]">{row.account_name || row.customer_name || row.contact_name || "Customer"}</p>
                        <p className="mt-0.5 break-words text-[9.5px] font-medium leading-4 text-[#74839A]">{row.contact_name || "Contact not recorded"}{row.mobile ? " · " + row.mobile : ""}</p>
                      </div>
                    </div>
                    <div>
                      <p className="break-words text-[10px] font-semibold leading-4 text-[#536680]">{row.registration_no || row.chassis_no || "Vehicle"}</p>
                      <p className="mt-0.5 break-words text-[9.5px] leading-4 text-[#7F8EA4]">{[row.vehicle_make, row.vehicle_model, row.vehicle_lob].filter(Boolean).join(" · ") || "Vehicle details not recorded"}</p>
                    </div>
                    <div>
                      <p className="text-[10.5px] font-extrabold text-[#203653]">Ends {dateLabel(row.policy_end_date)}</p>
                      <p className="mt-0.5 text-[9px] text-[#8190A5]">{expiryLabel(row.days_to_expiry)}</p>
                    </div>
                    <div>
                      <span className="inline-flex w-fit rounded-lg bg-[#EEF3F8] px-2 py-1 text-[9px] font-bold text-[#425672]">{statusLabel(row.opportunity_status)}</span>
                      <p className="mt-1 text-[9px] leading-4 text-[#7D8CA2]">{row.next_follow_up_at ? "Follow-up " + dateTimeLabel(row.next_follow_up_at) : row.last_interaction_at ? "Last contact " + dateTimeLabel(row.last_interaction_at) : "No interaction yet"}</p>
                    </div>
                    <ArrowRight className="hidden h-4 w-4 text-[#8090A8] transition group-hover:translate-x-0.5 xl:block" />
                  </Link>
                ))}
              </div>
            ) : (
              <div className="py-14 text-center">
                <CalendarClock className="mx-auto h-7 w-7 text-[#9AABC0]" />
                <p className="mt-3 text-[12px] font-bold text-[#23395D]">No external renewal opportunities found</p>
                <p className="mt-1 text-[10.5px] text-[#7A899F]">Published opportunity data matching this filter will appear here.</p>
              </div>
            )}

            {(hasPrevious || hasNext) ? (
              <div className="flex items-center justify-between border-t border-[#E6ECF3] py-4">
                <Link href={hasPrevious ? hrefFor({ page: page - 1 }) : "#"} aria-disabled={!hasPrevious} className={"inline-flex min-h-9 items-center gap-2 rounded-lg border px-3 text-[10px] font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3156B8]/20 " + (hasPrevious ? "border-[#D2DCE9] text-[#203653]" : "pointer-events-none border-[#E5EAF0] text-[#AAB4C2]")}>Previous</Link>
                <p className="text-[10px] font-semibold text-[#74839A]">Page {page}</p>
                <Link href={hasNext ? hrefFor({ page: page + 1 }) : "#"} aria-disabled={!hasNext} className={"inline-flex min-h-9 items-center gap-2 rounded-lg border px-3 text-[10px] font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3156B8]/20 " + (hasNext ? "border-[#D2DCE9] text-[#203653]" : "pointer-events-none border-[#E5EAF0] text-[#AAB4C2]")}>Next <ArrowRight className="h-3.5 w-3.5" /></Link>
              </div>
            ) : null}
          </div>
        </section>
      </div>
    </PartnerPortalShell>
  );
}
