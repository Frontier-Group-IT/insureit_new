import Link from "next/link";
import { ArrowLeft, CalendarClock, CheckCircle2, Clock3, MessageSquareText, Phone, Send, UserRound } from "lucide-react";
import { PartnerPortalShell } from "@/components/partner-portal/partner-portal-shell";
import { PartnerPageHeader, PartnerSectionHeading } from "@/components/partner-portal/partner-page-primitives";
import { getPartnerExternalRenewalDetail } from "@/lib/partner-external-renewals";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function dateLabel(value: string | null | undefined, withTime = false) {
  if (!value) return "—";
  const date = new Date(value.length === 10 ? value + "T00:00:00+05:30" : value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    ...(withTime ? { hour: "2-digit", minute: "2-digit", hour12: true, timeZone: "Asia/Kolkata" } : {}),
  }).format(date);
}

function titleCase(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default async function PartnerExternalRenewalDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const detail = await getPartnerExternalRenewalDetail(id);
  const opportunity = detail.opportunity;

  return (
    <PartnerPortalShell title="External Renewal Opportunity">
      <div className="space-y-7">
        <PartnerPageHeader
          eyebrow="External Renewal Opportunity"
          title={opportunity.account_name || opportunity.customer_name || opportunity.contact_name || "Customer"}
          description="Track contact attempts and follow-ups without changing verified INSUREIT customer, vehicle or policy records."
          action={
            <Link href="/partner/renewals/external" prefetch={false} className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-[#D2DCE9] px-3.5 text-[10px] font-bold text-[#203653] transition hover:bg-white/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3156B8]/20">
              <ArrowLeft className="h-3.5 w-3.5" /> Back to Opportunities
            </Link>
          }
        />

        {query.saved === "1" ? (
          <div className="flex items-center gap-2 rounded-lg border border-[#CFE6D5] bg-[#F3FAF5] px-3 py-2.5 text-[10.5px] font-semibold text-[#2F6B43]">
            <CheckCircle2 className="h-4 w-4" /> Interaction saved.
          </div>
        ) : null}
        {query.error ? (
          <div className="rounded-lg border border-[#F1D2D2] bg-[#FFF7F7] px-3 py-2.5 text-[10.5px] font-semibold text-[#9A3A3A]">{query.error}</div>
        ) : null}

        <section className="grid gap-7 xl:grid-cols-[1.05fr_.95fr]">
          <div>
            <PartnerSectionHeading eyebrow="Opportunity" title="Customer and policy snapshot" />
            <div className="mt-3 border-y border-[#DCE4ED]">
              <InfoRow label="Contact" value={[opportunity.contact_name, opportunity.mobile].filter(Boolean).join(" · ") || "Not recorded"} icon={UserRound} />
              <InfoRow label="Vehicle" value={[opportunity.registration_no || opportunity.chassis_no, opportunity.vehicle_make, opportunity.vehicle_model, opportunity.vehicle_lob].filter(Boolean).join(" · ") || "Not recorded"} icon={CalendarClock} />
              <InfoRow label="Policy" value={[opportunity.current_policy_no, opportunity.current_insurer].filter(Boolean).join(" · ") || "Not recorded"} icon={CalendarClock} />
              <InfoRow label="Coverage" value={dateLabel(opportunity.policy_start_date) + " → " + dateLabel(opportunity.policy_end_date)} icon={Clock3} />
              <InfoRow label="Status" value={titleCase(opportunity.opportunity_status)} icon={CheckCircle2} />
              <InfoRow label="Next follow-up" value={dateLabel(opportunity.next_follow_up_at, true)} icon={Clock3} last />
            </div>
          </div>

          <div>
            <PartnerSectionHeading eyebrow="CRM Update" title="Record an interaction" />
            <form method="post" action={"/api/partner/external-renewals/" + encodeURIComponent(id) + "/interactions"} className="mt-3 space-y-3 border-y border-[#DCE4ED] py-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="text-[9px] font-black uppercase tracking-[0.08em] text-[#6D7D94]">
                  Interaction
                  <select name="interaction_type" defaultValue="call" className="mt-1.5 h-10 w-full rounded-lg border border-[#CBD6E3] bg-white px-3 text-[10.5px] font-semibold text-[#213653] outline-none focus:border-[#3156B8] focus:ring-2 focus:ring-[#3156B8]/10">
                    <option value="call">Call</option>
                    <option value="whatsapp">WhatsApp</option>
                    <option value="note">Note</option>
                    <option value="follow_up">Follow-up</option>
                  </select>
                </label>
                <label className="text-[9px] font-black uppercase tracking-[0.08em] text-[#6D7D94]">
                  Outcome
                  <select name="outcome" defaultValue="contact_attempted" className="mt-1.5 h-10 w-full rounded-lg border border-[#CBD6E3] bg-white px-3 text-[10.5px] font-semibold text-[#213653] outline-none focus:border-[#3156B8] focus:ring-2 focus:ring-[#3156B8]/10">
                    <option value="contact_attempted">Contact Attempted</option>
                    <option value="connected">Connected</option>
                    <option value="interested">Interested</option>
                    <option value="quote_requested">Quote Requested</option>
                    <option value="quote_shared">Quote Shared</option>
                    <option value="follow_up">Follow-up</option>
                    <option value="renewed_elsewhere">Renewed Elsewhere</option>
                    <option value="invalid_contact">Invalid Contact</option>
                    <option value="do_not_contact">Do Not Contact</option>
                    <option value="lost">Lost</option>
                  </select>
                </label>
              </div>

              <label className="block text-[9px] font-black uppercase tracking-[0.08em] text-[#6D7D94]">
                Next follow-up
                <input type="datetime-local" name="follow_up_at" className="mt-1.5 h-10 w-full rounded-lg border border-[#CBD6E3] bg-white px-3 text-[10.5px] font-semibold text-[#213653] outline-none focus:border-[#3156B8] focus:ring-2 focus:ring-[#3156B8]/10" />
              </label>

              <label className="block text-[9px] font-black uppercase tracking-[0.08em] text-[#6D7D94]">
                Notes
                <textarea name="note" maxLength={4000} rows={4} placeholder="Add a short interaction note" className="mt-1.5 w-full resize-y rounded-lg border border-[#CBD6E3] bg-white px-3 py-2.5 text-[10.5px] font-medium leading-5 text-[#213653] outline-none focus:border-[#3156B8] focus:ring-2 focus:ring-[#3156B8]/10" />
              </label>

              <button type="submit" className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-[#111A35] px-4 text-[10.5px] font-bold text-white transition hover:bg-[#1B2A50] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3156B8]/25">
                <Send className="h-3.5 w-3.5" /> Save Interaction
              </button>
            </form>
          </div>
        </section>

        <section>
          <PartnerSectionHeading eyebrow="History" title="Interaction timeline" description={detail.interactions.length + " recorded"} />
          <div className="mt-3 border-y border-[#DCE4ED]">
            {detail.interactions.length ? (
              <div className="divide-y divide-[#E7EDF4]">
                {detail.interactions.map((interaction) => (
                  <div key={interaction.interaction_id} className="grid gap-2 px-1 py-3.5 sm:px-4 lg:grid-cols-[160px_180px_minmax(0,1fr)_180px] lg:items-start">
                    <div className="flex items-center gap-2 text-[10px] font-bold text-[#263D5E]">
                      {interaction.interaction_type === "call" ? <Phone className="h-3.5 w-3.5 text-[#3156B8]" /> : <MessageSquareText className="h-3.5 w-3.5 text-[#3156B8]" />}
                      {titleCase(interaction.interaction_type)}
                    </div>
                    <p className="text-[10px] font-semibold text-[#536680]">{titleCase(interaction.outcome)}</p>
                    <div>
                      <p className="break-words text-[10px] leading-5 text-[#60718A]">{interaction.note || "No note"}</p>
                      {interaction.follow_up_at ? <p className="mt-1 text-[9px] font-semibold text-[#3156B8]">Follow up: {dateLabel(interaction.follow_up_at, true)}</p> : null}
                    </div>
                    <p className="text-[9.5px] font-medium text-[#8190A5]">{dateLabel(interaction.created_at, true)}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-12 text-center">
                <MessageSquareText className="mx-auto h-6 w-6 text-[#9AABC0]" />
                <p className="mt-2 text-[11px] font-bold text-[#263D5E]">No interactions recorded yet</p>
                <p className="mt-1 text-[10px] text-[#7B899C]">Record the first call, WhatsApp contact or follow-up above.</p>
              </div>
            )}
          </div>
        </section>
      </div>
    </PartnerPortalShell>
  );
}

function InfoRow({ label, value, icon: Icon, last = false }: { label: string; value: string; icon: typeof CalendarClock; last?: boolean }) {
  return (
    <div className={"grid gap-2 py-3 sm:grid-cols-[145px_minmax(0,1fr)] sm:px-4 " + (last ? "" : "border-b border-[#E7EDF4]")}>
      <p className="flex items-center gap-2 text-[9px] font-black uppercase tracking-[0.08em] text-[#728198]"><Icon className="h-3.5 w-3.5" /> {label}</p>
      <p className="break-words text-[10.5px] font-semibold leading-5 text-[#263D5E]">{value}</p>
    </div>
  );
}
