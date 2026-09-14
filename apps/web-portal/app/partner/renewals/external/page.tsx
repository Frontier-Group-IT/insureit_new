import Link from "next/link";
import {
  Bell,
  Bot,
  CalendarClock,
  CalendarDays,
  ChevronDown,
  FileText,
  MoreHorizontal,
  Search,
  UsersRound,
} from "lucide-react";
import { PartnerPagination } from "@/components/partner-portal/partner-pagination";
import { PartnerPortalShell } from "@/components/partner-portal/partner-portal-shell";
import {
  getPartnerExternalRenewalSummary,
  listPartnerExternalRenewals,
  type PartnerExternalRenewalFollowUpFilter,
  type PartnerExternalRenewalIntakeFilter,
  type PartnerExternalRenewalMode,
  type PartnerExternalRenewalStatusFilter,
  type PartnerExternalRenewalWindow,
} from "@/lib/partner-external-renewals";
import { getPartnerExternalRenewalVoiceStates } from "@/lib/partner-external-renewal-voice";
import { isSarvamRenewalCallingEnabled } from "@/lib/sarvam-renewal-call";

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

function validIntake(value?: string): PartnerExternalRenewalIntakeFilter {
  return value === "not_started" || value === "in_progress" ? value : "all";
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
  return "In " + days + " days";
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

function voiceStateLabel(value: string) {
  const labels: Record<string, string> = {
    available: "Available",
    queued: "Queued",
    calling: "Calling",
    connected: "Connected",
    interested: "Interested",
    follow_up: "Follow-up",
    human_needed: "Human Needed",
    no_answer: "No Answer",
    busy: "Busy",
    failed: "Failed",
    needs_details: "Needs Details",
    closed: "Closed",
  };
  return labels[value] ?? "Available";
}

function voiceStateClass(value: string) {
  if (value === "interested" || value === "connected") return "bg-[#EAF9F1] text-[#1C8C59]";
  if (value === "human_needed" || value === "failed") return "bg-[#FFF0F0] text-[#C04444]";
  if (value === "queued" || value === "calling" || value === "follow_up") return "bg-[#EAF1FF] text-[#2769CE]";
  if (value === "no_answer" || value === "busy" || value === "needs_details") return "bg-[#FFF5E5] text-[#A36A13]";
  return "bg-[#EEF3F8] text-[#5C708D]";
}

function statusClass(value: string) {
  if (value === "closed" || value === "won") return "bg-[#E9F8EF] text-[#178557]";
  if (value === "follow_up" || value === "quote_requested" || value === "quote_shared") return "bg-[#FFF3DF] text-[#B36D0B]";
  return "bg-[#E9F8EF] text-[#178557]";
}

export default async function PartnerExternalRenewalsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; mode?: string; window?: string; status?: string; follow_up?: string; intake?: string; page?: string }>;
}) {
  const query = await searchParams;
  const q = query.q?.trim() ?? "";
  const mode = validMode(query.mode);
  const window = validWindow(query.window);
  const status = validStatus(query.status);
  const followUp = validFollowUp(query.follow_up);
  const intake = validIntake(query.intake);
  const page = pageNumber(query.page);
  const offset = (page - 1) * PAGE_SIZE;

  const [summary, rows] = await Promise.all([
    getPartnerExternalRenewalSummary(),
    listPartnerExternalRenewals({ limit: PAGE_SIZE, offset, search: q, mode, window, status, followUp, intake }),
  ]);

  const voiceStates = await getPartnerExternalRenewalVoiceStates(rows.map((row) => row.opportunity_id));
  const voiceStateByOpportunity = new Map(voiceStates.map((state) => [state.opportunity_id, state]));
  const voiceEnabled = isSarvamRenewalCallingEnabled();

  const total = rows[0]?.total_count ?? 0;
  const hasPrevious = page > 1;
  const hasNext = offset + rows.length < total;

  const hrefFor = (next: {
    mode?: PartnerExternalRenewalMode;
    window?: PartnerExternalRenewalWindow;
    status?: PartnerExternalRenewalStatusFilter;
    followUp?: PartnerExternalRenewalFollowUpFilter;
    intake?: PartnerExternalRenewalIntakeFilter;
    page?: number;
  }) => {
    const params = new URLSearchParams();
    const nextMode = next.mode ?? mode;
    const nextWindow = next.window ?? window;
    const nextStatus = next.status ?? status;
    const nextFollowUp = next.followUp ?? followUp;
    const nextIntake = next.intake ?? intake;
    const nextPage = next.page ?? 1;
    if (q) params.set("q", q);
    if (nextMode !== "due") params.set("mode", nextMode);
    if (nextMode === "due" && nextWindow !== "all") params.set("window", nextWindow);
    if (nextStatus !== "all") params.set("status", nextStatus);
    if (nextMode === "follow_up" && nextFollowUp !== "all") params.set("follow_up", nextFollowUp);
    if (nextIntake !== "all") params.set("intake", nextIntake);
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

  const metrics = [
    { label: "Due in 30 Days", value: summary.due_30_count, meta: "External opportunities", icon: CalendarDays, wrap: "bg-[#EAF3FF] text-[#2170E8]" },
    { label: "Not Contacted", value: summary.uncontacted_count, meta: "Start outreach", icon: UsersRound, wrap: "bg-[#F1E9FF] text-[#744FE0]" },
    { label: "Follow-ups Due", value: summary.follow_up_due_count, meta: "Needs attention", icon: Bell, wrap: "bg-[#FFF0E8] text-[#F06B23]" },
    { label: "In Policy Intake", value: summary.in_policy_intake_count, meta: "Conversion in progress", icon: FileText, wrap: "bg-[#E6F8EF] text-[#1BB36C]" },
  ];

  return (
    <PartnerPortalShell title="External Opportunities">
      <div className="space-y-3 pb-4">
        <section className="grid overflow-hidden rounded-xl border border-[#DDE6F0] bg-white shadow-[0_4px_14px_rgba(31,55,86,0.04)] sm:grid-cols-2 xl:grid-cols-4">
          {metrics.map((item, index) => {
            const Icon = item.icon;
            return (
              <div key={item.label} className={"flex min-h-[78px] items-center gap-3 px-4 py-3 " + (index ? "border-t border-[#E6ECF3] sm:border-t-0 sm:border-l" : "") + (index === 2 ? " sm:border-t xl:border-t-0" : "")}>
                <span className={"grid h-10 w-10 shrink-0 place-items-center rounded-xl " + item.wrap}><Icon className="h-5 w-5" /></span>
                <div className="min-w-0">
                  <p className="text-[8px] font-black uppercase tracking-[0.06em] text-[#657A98]">{item.label}</p>
                  <p className="mt-0.5 text-[19px] font-black leading-none text-[#142B50]">{item.value}</p>
                  <p className="mt-1.5 text-[9px] font-medium text-[#6E82A1]">{item.meta}</p>
                </div>
              </div>
            );
          })}
        </section>

        <section className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#DDE6F0] bg-white px-4 py-3 shadow-[0_3px_12px_rgba(31,55,86,0.035)]">
          <div className="flex items-center gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[#EAF3FF] text-[#2A6FD8]"><Bot className="h-4 w-4" /></span>
            <div>
              <p className="text-[11px] font-extrabold text-[#1B3152]">AI renewal outreach</p>
              <p className="mt-0.5 text-[9px] text-[#7184A0]">Single-customer AI calls are controlled from each opportunity. Provider administration is not exposed here.</p>
            </div>
          </div>
          <span className={"rounded-full px-3 py-1.5 text-[8.5px] font-bold " + (voiceEnabled ? "bg-[#EAF8F0] text-[#25875A]" : "bg-[#F1F4F8] text-[#6B7E98]")}>{voiceEnabled ? "AI calling available" : "AI calling not enabled"}</span>
        </section>

        <section className="overflow-hidden rounded-xl border border-[#DDE6F0] bg-white shadow-[0_4px_14px_rgba(31,55,86,0.04)]">
          <div className="flex flex-col gap-3 border-b border-[#E5EBF2] px-4 py-3 xl:flex-row xl:items-center">
            <div className="min-w-0 shrink-0">
              <h2 className="text-[16px] font-black tracking-[-0.02em] text-[#142B50]">{modeTitle}</h2>
            </div>

            <div className="flex w-full flex-col gap-2 xl:ml-auto xl:flex-row xl:items-center xl:justify-end">
              <form action="/partner/renewals/external" className="w-full xl:max-w-[370px]">
                {mode !== "due" ? <input type="hidden" name="mode" value={mode} /> : null}
                {window !== "all" && mode === "due" ? <input type="hidden" name="window" value={window} /> : null}
                {status !== "all" ? <input type="hidden" name="status" value={status} /> : null}
                {followUp !== "all" && mode === "follow_up" ? <input type="hidden" name="follow_up" value={followUp} /> : null}
                {intake !== "all" ? <input type="hidden" name="intake" value={intake} /> : null}
                <div className="relative min-w-0">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#7D8DA4]" />
                  <input name="q" defaultValue={q} placeholder="Search customer, mobile, vehicle or channel..." className="h-9 w-full rounded-lg border border-[#CCD7E4] bg-white pl-9 pr-3 text-[10px] font-semibold text-[#213653] outline-none transition focus:border-[#3156B8] focus:ring-2 focus:ring-[#3156B8]/10" />
                </div>
              </form>

              <div className="flex flex-wrap items-center gap-2 xl:flex-nowrap">
                <details className="group relative">
                  <summary className="flex h-9 min-w-[118px] cursor-pointer list-none items-center justify-between gap-3 rounded-lg border border-[#D5DFEA] bg-white px-3 text-[9.5px] font-bold text-[#304866] [&::-webkit-details-marker]:hidden">
                    <span>Time line</span><ChevronDown className="h-3.5 w-3.5 text-[#58708F] transition group-open:rotate-180" />
                  </summary>
                  <div className="absolute right-0 z-30 mt-1.5 w-48 overflow-hidden rounded-lg border border-[#D8E1EB] bg-white p-1.5 shadow-[0_10px_30px_rgba(26,49,83,0.16)]">
                    <Link href={hrefFor({ mode: "due", window: "all", followUp: "all", page: 1 })} className="block rounded-md px-3 py-2 text-[9.5px] font-semibold text-[#405673] hover:bg-[#F2F6FB]">Due</Link>
                    <Link href={hrefFor({ mode: "follow_up", window: "all", followUp: "all", page: 1 })} className="block rounded-md px-3 py-2 text-[9.5px] font-semibold text-[#405673] hover:bg-[#F2F6FB]">Follow-ups</Link>
                    <Link href={hrefFor({ mode: "expired", window: "all", followUp: "all", page: 1 })} className="block rounded-md px-3 py-2 text-[9.5px] font-semibold text-[#405673] hover:bg-[#F2F6FB]">Recently Expired</Link>
                    <Link href={hrefFor({ mode: "future", window: "all", followUp: "all", page: 1 })} className="block rounded-md px-3 py-2 text-[9.5px] font-semibold text-[#405673] hover:bg-[#F2F6FB]">Future</Link>
                    <div className="my-1 border-t border-[#E7ECF2]" />
                    {(["all", "0_7", "8_15", "16_30"] as PartnerExternalRenewalWindow[]).map((value) => (
                      <Link key={value} href={hrefFor({ mode: "due", window: value, followUp: "all", page: 1 })} className="block rounded-md px-3 py-2 text-[9.5px] font-semibold text-[#405673] hover:bg-[#F2F6FB]">
                        {value === "all" ? "All 30 Days" : value.replace("_", "–") + " Days"}
                      </Link>
                    ))}
                    <div className="my-1 border-t border-[#E7ECF2]" />
                    {(["all", "due", "scheduled"] as PartnerExternalRenewalFollowUpFilter[]).map((value) => (
                      <Link key={value} href={hrefFor({ mode: "follow_up", followUp: value, window: "all", page: 1 })} className="block rounded-md px-3 py-2 text-[9.5px] font-semibold text-[#405673] hover:bg-[#F2F6FB]">
                        {value === "all" ? "All Follow-ups" : value === "due" ? "Due Now" : "Scheduled"}
                      </Link>
                    ))}
                  </div>
                </details>

                <details className="group relative">
                  <summary className="flex h-9 min-w-[126px] cursor-pointer list-none items-center justify-between gap-3 rounded-lg border border-[#D5DFEA] bg-white px-3 text-[9.5px] font-bold text-[#304866] [&::-webkit-details-marker]:hidden">
                    <span>Policy Status</span><ChevronDown className="h-3.5 w-3.5 text-[#58708F] transition group-open:rotate-180" />
                  </summary>
                  <div className="absolute right-0 z-30 mt-1.5 w-44 overflow-hidden rounded-lg border border-[#D8E1EB] bg-white p-1.5 shadow-[0_10px_30px_rgba(26,49,83,0.16)]">
                    {(["all", "not_started", "in_progress"] as PartnerExternalRenewalIntakeFilter[]).map((value) => (
                      <Link key={value} href={hrefFor({ intake: value, page: 1 })} className="block rounded-md px-3 py-2 text-[9.5px] font-semibold text-[#405673] hover:bg-[#F2F6FB]">
                        {value === "all" ? "All Policy Intake" : value === "not_started" ? "Not Started" : "In Policy Intake"}
                      </Link>
                    ))}
                  </div>
                </details>

                <details className="group relative">
                  <summary className="flex h-9 min-w-[126px] cursor-pointer list-none items-center justify-between gap-3 rounded-lg border border-[#D5DFEA] bg-white px-3 text-[9.5px] font-bold text-[#304866] [&::-webkit-details-marker]:hidden">
                    <span>Other Filters</span><ChevronDown className="h-3.5 w-3.5 text-[#58708F] transition group-open:rotate-180" />
                  </summary>
                  <div className="absolute right-0 z-30 mt-1.5 w-44 overflow-hidden rounded-lg border border-[#D8E1EB] bg-white p-1.5 shadow-[0_10px_30px_rgba(26,49,83,0.16)]">
                    {(["all", "new", "contacted", "interested", "quote", "follow_up", "closed"] as PartnerExternalRenewalStatusFilter[]).map((value) => (
                      <Link key={value} href={hrefFor({ status: value, page: 1 })} className="block rounded-md px-3 py-2 text-[9.5px] font-semibold text-[#405673] hover:bg-[#F2F6FB]">
                        {value === "all" ? "Active" : value === "follow_up" ? "Follow-up" : value.charAt(0).toUpperCase() + value.slice(1)}
                      </Link>
                    ))}
                  </div>
                </details>

                <div className="flex h-9 shrink-0 items-center gap-2 border-l border-[#E2E8F0] pl-3 text-[9px] font-medium text-[#6B7F9C]">
                  <span>Total records</span><strong className="text-[15px] font-black text-[#173154]">{total}</strong>
                </div>
              </div>
            </div>
          </div>

          <div className="hidden grid-cols-[42px_minmax(0,1.25fr)_minmax(0,.9fr)_minmax(125px,.55fr)_minmax(100px,.45fr)_minmax(125px,.55fr)_44px] items-center gap-4 bg-[#F5F8FC] px-4 py-2.5 text-[8px] font-extrabold uppercase tracking-[0.04em] text-[#6484AB] xl:grid">
            <span />
            <span>Customer / Business</span>
            <span>Policy / Reference</span>
            <span>Expiry Date</span>
            <span>Status</span>
            <span>AI Outreach</span>
            <span className="text-center">Actions</span>
          </div>

          {rows.length ? (
            <div className="divide-y divide-[#E8EDF4]">
              {rows.map((row) => {
                const voiceState = voiceStateByOpportunity.get(row.opportunity_id)?.voice_state ?? (row.mobile ? "available" : "needs_details");
                return (
                  <Link key={row.opportunity_id} href={"/partner/renewals/external/" + encodeURIComponent(row.opportunity_id)} prefetch={false} className="group grid gap-3 px-4 py-3 transition hover:bg-[#FBFDFF] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#3156B8]/20 xl:grid-cols-[42px_minmax(0,1.25fr)_minmax(0,.9fr)_minmax(125px,.55fr)_minmax(100px,.45fr)_minmax(125px,.55fr)_44px] xl:items-center xl:gap-4">
                    <span className="hidden h-5 w-5 rounded border border-[#C8D4E2] bg-white xl:block" aria-hidden="true" />
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#EEF4FF] text-[#2F72DE]"><CalendarClock className="h-3.5 w-3.5" /></span>
                      <div className="min-w-0">
                        <p className="break-words text-[10.5px] font-extrabold leading-4 text-[#1A3154]">{row.account_name || row.customer_name || row.contact_name || "Customer"}</p>
                        <p className="mt-0.5 break-words text-[9px] leading-4 text-[#7184A0]">{row.contact_name || "Contact not recorded"}{row.mobile ? " · " + row.mobile : ""}</p>
                      </div>
                    </div>
                    <div className="min-w-0">
                      <p className="break-words text-[10px] font-semibold leading-4 text-[#1E3B66]">{row.registration_no || row.chassis_no || "Vehicle"}</p>
                      <p className="mt-0.5 break-words text-[9px] leading-4 text-[#7489A5]">{[row.vehicle_make, row.vehicle_model, row.vehicle_lob].filter(Boolean).join(" · ") || "Vehicle details not recorded"}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-extrabold text-[#1D385B]">Ends {dateLabel(row.policy_end_date)}</p>
                      <p className="mt-0.5 text-[9px] text-[#7489A5]">{expiryLabel(row.days_to_expiry)}</p>
                    </div>
                    <div className="min-w-0">
                      <span className={"inline-flex w-fit items-center gap-1.5 rounded-lg px-2.5 py-1 text-[9px] font-bold " + statusClass(row.opportunity_status)}><span className="h-1.5 w-1.5 rounded-full bg-current" />{statusLabel(row.opportunity_status)}</span>
                      <p className="mt-1.5 truncate text-[8px] font-medium text-[#7B8CA4]">
                        {row.next_follow_up_at
                          ? "Follow-up " + dateTimeLabel(row.next_follow_up_at)
                          : row.last_interaction_at
                            ? "Last contact " + dateTimeLabel(row.last_interaction_at)
                            : "No interaction yet"}
                      </p>
                    </div>
                    <span className={"inline-flex w-fit items-center gap-1.5 rounded-lg px-2.5 py-1 text-[9px] font-bold " + (voiceEnabled ? voiceStateClass(voiceState) : "bg-[#EEF3F8] text-[#687D99]")}><Bot className="h-3 w-3" />{voiceEnabled ? voiceStateLabel(voiceState) : "AI Not Enabled"}</span>
                    <span className="hidden h-8 w-8 place-items-center justify-self-end rounded-full text-[#176AF0] transition group-hover:bg-[#EEF4FF] xl:grid"><MoreHorizontal className="h-4 w-4" /></span>
                  </Link>
                );
              })}
            </div>
          ) : (
            <div className="py-14 text-center">
              <CalendarClock className="mx-auto h-7 w-7 text-[#9AABC0]" />
              <p className="mt-3 text-[12px] font-bold text-[#23395D]">No external renewal opportunities found</p>
              <p className="mt-1 text-[10.5px] text-[#7A899F]">Published opportunity data matching this filter will appear here.</p>
            </div>
          )}

          <PartnerPagination
            page={page}
            pageSize={PAGE_SIZE}
            total={total}
            previousHref={hasPrevious ? hrefFor({ page: page - 1 }) : null}
            nextHref={hasNext ? hrefFor({ page: page + 1 }) : null}
          />
        </section>
      </div>
    </PartnerPortalShell>
  );
}
