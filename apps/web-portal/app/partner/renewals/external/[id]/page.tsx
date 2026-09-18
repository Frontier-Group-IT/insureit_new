import Link from "next/link";
import {
  Bot,
  CalendarDays,
  CheckCircle2,
  Clock3,
  FileText,
  FileUp,
  Lightbulb,
  MessageSquareText,
  MoreHorizontal,
  Phone,
  PhoneCall,
  Send,
  ShieldCheck,
  UserRound,
  Car,
} from "lucide-react";
import { PartnerPortalShell } from "@/components/partner-portal/partner-portal-shell";
import { getPartnerExternalRenewalDetail, getPartnerExternalRenewalIntakeLink } from "@/lib/partner-external-renewals";
import { getLatestPartnerExternalRenewalVoiceAttempt } from "@/lib/partner-external-renewal-voice";
import { getSarvamPartnerDispatchReadiness } from "@/lib/sarvam-partner-dispatch-readiness";
import { InteractionNotesField } from "./interaction-notes-field";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const INTAKE_READY_STATUSES = new Set(["connected", "interested", "quote_requested", "quote_shared", "follow_up"]);
const TERMINAL_STATUSES = new Set(["won", "renewed_elsewhere", "invalid_contact", "do_not_contact", "lost"]);
const ACTIVE_VOICE_STATUSES = new Set(["created", "submitted", "queued", "calling"]);

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

function voiceStatusLabel(status: string, connectivity?: string | null) {
  if (status === "queued" || status === "submitted" || status === "created") return "Queued";
  if (status === "calling") return "Calling";
  if (connectivity === "no_answer") return "No Answer";
  if (connectivity === "busy") return "Busy";
  if (status === "failed") return "Failed";
  if (connectivity === "connected") return "Connected";
  if (status === "completed") return "Completed";
  return titleCase(status);
}

export default async function PartnerExternalRenewalDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string; error?: string; voice_queued?: string; voice_error?: string }>;
}) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const [detail, intakeLink, latestVoiceAttempt, dispatchReadiness] = await Promise.all([
    getPartnerExternalRenewalDetail(id),
    getPartnerExternalRenewalIntakeLink(id),
    getLatestPartnerExternalRenewalVoiceAttempt(id),
    getSarvamPartnerDispatchReadiness(),
  ]);
  const opportunity = detail.opportunity;
  const isClosed = TERMINAL_STATUSES.has(opportunity.opportunity_status);
  const canStartIntake = !isClosed && !intakeLink?.linked && INTAKE_READY_STATUSES.has(opportunity.opportunity_status);
  const voiceEnabled = dispatchReadiness.ready;
  const voiceActive = latestVoiceAttempt ? ACTIVE_VOICE_STATUSES.has(latestVoiceAttempt.submission_status) : false;
  const canVoiceCall = voiceEnabled && !isClosed && !voiceActive && Boolean(opportunity.mobile?.trim());
  const customerName = opportunity.account_name || opportunity.customer_name || opportunity.contact_name || "Customer";
  const vehicleNumber = opportunity.registration_no || opportunity.chassis_no || "Not recorded";
  const vehicleDescription = [opportunity.vehicle_make, opportunity.vehicle_model, opportunity.vehicle_lob].filter(Boolean).join(" · ");
  const policyValue = [opportunity.current_policy_no, opportunity.current_insurer].filter(Boolean).join(" · ") || "Not recorded";
  const coverageValue = dateLabel(opportunity.policy_start_date) + " – " + dateLabel(opportunity.policy_end_date);
  const recentInteractions = detail.interactions.slice(0, 3);

  return (
    <PartnerPortalShell title="External Renewal Opportunity">
      <div className="space-y-3 pb-5">
        <header className="border-b border-[#D9E2EC] pb-2">
          <h1 className="text-[24px] font-black leading-none tracking-[-0.03em] text-[#172A49]">{customerName}</h1>
        </header>

        {query.saved === "1" ? (
          <div className="flex items-center gap-2 rounded-lg border border-[#CFE6D5] bg-[#F3FAF5] px-3 py-2.5 text-[10.5px] font-semibold text-[#2F6B43]">
            <CheckCircle2 className="h-4 w-4" /> Interaction saved.
          </div>
        ) : null}
        {query.voice_queued === "1" ? (
          <div className="flex items-center gap-2 rounded-lg border border-[#CFE0F3] bg-[#F4F8FD] px-3 py-2.5 text-[10.5px] font-semibold text-[#31568B]">
            <PhoneCall className="h-4 w-4" /> AI call queued. The result will return to this opportunity automatically after Sarvam completes the attempt.
          </div>
        ) : null}
        {query.error ? (
          <div className="rounded-lg border border-[#F1D2D2] bg-[#FFF7F7] px-3 py-2.5 text-[10.5px] font-semibold text-[#9A3A3A]">{query.error}</div>
        ) : null}
        {query.voice_error ? (
          <div className="rounded-lg border border-[#F1D2D2] bg-[#FFF7F7] px-3 py-2.5 text-[10.5px] font-semibold text-[#9A3A3A]">{query.voice_error}</div>
        ) : null}

        <section className="grid overflow-hidden rounded-xl border border-[#D9E2EC] bg-white shadow-[0_8px_24px_rgba(29,53,87,0.04)] sm:grid-cols-2 xl:grid-cols-[1.05fr_1.15fr_.9fr_1.2fr_.9fr]">
          <SummaryItem icon={UserRound} title={customerName} detail={opportunity.mobile || "Not recorded"} />
          <SummaryItem icon={Car} title={vehicleDescription || vehicleNumber} detail={vehicleNumber} />
          <SummaryItem icon={FileText} title="Policy" detail={policyValue} />
          <SummaryItem icon={CalendarDays} title="Coverage" detail={coverageValue} />
          <div className="flex min-h-[62px] items-center gap-2.5 border-t border-[#E8EEF5] px-3 py-2 sm:border-l sm:border-t-0">
            <div className="h-3 w-3 shrink-0 rounded-full bg-[#24B36B]" />
            <div className="min-w-0 rounded-lg bg-[#ECFAF2] px-2.5 py-1.5">
              <p className="text-[11px] font-black text-[#169653]">{titleCase(opportunity.opportunity_status)}</p>
              <p className="mt-0.5 text-[9px] font-semibold text-[#45A06C]">Opportunity Status</p>
            </div>
          </div>
        </section>

        <section className="grid gap-3 xl:grid-cols-[.92fr_1.08fr]">
          <div className="space-y-3">
            <CardShell icon={ShieldCheck} title="Opportunity Snapshot">
              <div className="grid gap-x-5 gap-y-3 sm:grid-cols-2">
                <SnapshotItem icon={UserRound} label="Contact" value={opportunity.contact_name || customerName} detail={opportunity.mobile || "Not recorded"} />
                <SnapshotItem icon={Car} label="Vehicle" value={vehicleNumber} detail={vehicleDescription || "Not recorded"} />
                <SnapshotItem icon={FileText} label="Policy" value={opportunity.current_policy_no || "Not recorded"} detail={opportunity.current_insurer || undefined} />
                <SnapshotItem icon={CalendarDays} label="Coverage" value={coverageValue} />
                <SnapshotItem
                  icon={Clock3}
                  label="Status"
                  value={titleCase(opportunity.opportunity_status)}
                  badge={opportunity.opportunity_status === "new"}
                />
                <SnapshotItem icon={CalendarDays} label="Next Follow-up" value={dateLabel(opportunity.next_follow_up_at, true)} />
              </div>
            </CardShell>

            <CardShell icon={Clock3} title="Recent Activity & Next Steps">
              {recentInteractions.length ? (
                <div className="space-y-2">
                  {recentInteractions.map((interaction) => (
                    <div key={interaction.interaction_id} className="rounded-lg bg-[#F5F8FC] px-3 py-2.5">
                      <div className="flex items-center justify-between gap-3">
                        <p className="flex items-center gap-2 text-[10px] font-bold text-[#263D5E]">
                          {interaction.interaction_type === "call" ? <Phone className="h-3.5 w-3.5 text-[#3156B8]" /> : <MessageSquareText className="h-3.5 w-3.5 text-[#3156B8]" />}
                          {titleCase(interaction.interaction_type)} · {titleCase(interaction.outcome)}
                        </p>
                        <span className="shrink-0 text-[8.5px] font-semibold text-[#8898AD]">{dateLabel(interaction.created_at, true)}</span>
                      </div>
                      <p className="mt-1 text-[9.5px] leading-5 text-[#667993]">{interaction.note || "No note recorded."}</p>
                      {interaction.follow_up_at ? (
                        <p className="mt-1 text-[9px] font-semibold text-[#3156B8]">Follow up: {dateLabel(interaction.follow_up_at, true)}</p>
                      ) : null}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-lg bg-[#F4F7FB] px-3 py-2.5">
                  <div className="flex items-start gap-3">
                    <FileText className="mt-0.5 h-4 w-4 shrink-0 text-[#607AA3]" />
                    <div>
                      <p className="text-[10.5px] font-bold text-[#263D5E]">No interactions recorded yet</p>
                      <p className="mt-1 text-[9.5px] leading-5 text-[#728198]">Record a call, note or follow-up to start tracking this opportunity.</p>
                    </div>
                  </div>
                </div>
              )}

              <div className="mt-2 rounded-lg bg-[#EEF4FF] px-3 py-2.5">
                <div className="flex items-start gap-3">
                  <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-[#3156B8]" />
                  <div>
                    <p className="text-[10.5px] font-bold text-[#3156B8]">Recommended next step</p>
                    <p className="mt-1 text-[9.5px] leading-5 text-[#60718A]">
                      {opportunity.next_follow_up_at
                        ? "Follow up with the customer at the scheduled time and record the outcome here."
                        : "Make an initial call to introduce INSUREIT’s renewal options and understand the customer’s current insurance needs."}
                    </p>
                  </div>
                </div>
              </div>
            </CardShell>
          </div>

          <div className="space-y-3">
            <section className="overflow-hidden rounded-xl border border-[#D9E2EC] bg-white shadow-[0_8px_24px_rgba(29,53,87,0.04)]">
              <div className="flex items-center gap-3 border-b border-[#E5EBF2] px-3.5 py-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#EEF4FF] text-[#3156B8]">
                  <Phone className="h-4 w-4" />
                </div>
                <div>
                  <h2 className="text-[13px] font-black text-[#1E3454]">{isClosed ? "Opportunity closed" : "Record an Interaction"}</h2>
                  <p className="mt-0.5 text-[9px] text-[#7A8AA0]">
                    {isClosed ? "This opportunity is closed and cannot receive further CRM updates." : "Log your customer interaction and set a follow-up."}
                  </p>
                </div>
              </div>

              {isClosed ? (
                <div className="p-3.5">
                  <div className="flex items-start gap-3 rounded-lg bg-[#F6F8FB] px-3.5 py-3">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#65758B]" />
                    <div>
                      <p className="text-[10.5px] font-bold text-[#263D5E]">No further CRM updates are allowed.</p>
                      <p className="mt-1 text-[9.5px] leading-5 text-[#728198]">
                        This opportunity is closed as {titleCase(opportunity.opportunity_status)}.
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <form method="post" action={"/api/partner/external-renewals/" + encodeURIComponent(id) + "/interactions"} className="space-y-2.5 p-3.5">
                  <div className="grid gap-2.5 sm:grid-cols-2">
                    <label className="text-[9px] font-black text-[#6D7D94]">
                      Interaction <span className="text-[#E15555]">*</span>
                      <select
                        name="interaction_type"
                        defaultValue="call"
                        className="mt-1.5 h-10 w-full rounded-lg border border-[#CBD6E3] bg-white px-3 text-[10.5px] font-semibold text-[#213653] outline-none focus:border-[#3156B8] focus:ring-2 focus:ring-[#3156B8]/10"
                      >
                        <option value="call">Call</option>
                        <option value="whatsapp">WhatsApp</option>
                        <option value="note">Note</option>
                        <option value="follow_up">Follow-up</option>
                      </select>
                    </label>
                    <label className="text-[9px] font-black text-[#6D7D94]">
                      Outcome <span className="text-[#E15555]">*</span>
                      <select
                        name="outcome"
                        defaultValue="contact_attempted"
                        className="mt-1.5 h-10 w-full rounded-lg border border-[#CBD6E3] bg-white px-3 text-[10.5px] font-semibold text-[#213653] outline-none focus:border-[#3156B8] focus:ring-2 focus:ring-[#3156B8]/10"
                      >
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

                  <label className="block text-[9px] font-black text-[#6D7D94]">
                    Next Follow-up
                    <input
                      type="datetime-local"
                      name="follow_up_at"
                      className="mt-1.5 h-10 w-full rounded-lg border border-[#CBD6E3] bg-white px-3 text-[10.5px] font-semibold text-[#213653] outline-none focus:border-[#3156B8] focus:ring-2 focus:ring-[#3156B8]/10"
                    />
                  </label>

                  <InteractionNotesField />

                  <div className="flex justify-end pt-1">
                    <button
                      type="submit"
                      className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-[#0F2550] px-4 text-[10.5px] font-bold text-white transition hover:bg-[#183663] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3156B8]/25"
                    >
                      <Send className="h-3.5 w-3.5" /> Save Interaction
                    </button>
                  </div>
                </form>
              )}
            </section>

            <section className="overflow-hidden rounded-xl border border-[#D9E2EC] bg-white shadow-[0_8px_24px_rgba(29,53,87,0.04)]">
              <div className="flex items-center justify-between gap-2.5 border-b border-[#E5EBF2] px-3.5 py-2.5">
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#EEF4FF] text-[#3156B8]">
                    <Bot className="h-4 w-4" />
                  </div>
                  <div>
                    <h2 className="text-[13px] font-black text-[#1E3454]">AI Outreach</h2>
                  </div>
                </div>
                <span className="rounded-full bg-[#EEF4FF] px-2.5 py-1 text-[8px] font-black text-[#3156B8]">INSUREIT AI</span>
              </div>

              <div className="p-3.5">
                <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0 flex-1">
                    {latestVoiceAttempt?.call_summary ? (
                      <p className="text-[9.5px] leading-5 text-[#60718A]">{latestVoiceAttempt.call_summary}</p>
                    ) : latestVoiceAttempt ? (
                      <p className="text-[9.5px] leading-5 text-[#60718A]">
                        Latest AI call status is {voiceStatusLabel(latestVoiceAttempt.submission_status, latestVoiceAttempt.connectivity_status).toLowerCase()}.
                      </p>
                    ) : (
                      <p className="text-[9.5px] leading-5 text-[#60718A]">
                        Use INSUREIT AI outreach for this external renewal when calling is available. Provider configuration remains controlled by INSUREIT administration.
                      </p>
                    )}
                    {latestVoiceAttempt?.follow_up_at ? (
                      <p className="mt-1 text-[9px] font-semibold text-[#3156B8]">AI follow-up: {dateLabel(latestVoiceAttempt.follow_up_at, true)}</p>
                    ) : null}
                  </div>

                  {canVoiceCall ? (
                    <form method="post" action={"/api/partner/external-renewals/" + encodeURIComponent(id) + "/voice-call"}>
                      <button
                        type="submit"
                        className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-[#0F2550] px-4 text-[10.5px] font-bold text-white transition hover:bg-[#183663] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3156B8]/25"
                      >
                        <PhoneCall className="h-3.5 w-3.5" /> Call with AI
                      </button>
                    </form>
                  ) : (
                    <span className="inline-flex min-h-9 items-center rounded-lg bg-[#F3F5F8] px-3 text-[9.5px] font-semibold text-[#728198]">
                      {isClosed ? "Opportunity closed" : voiceActive ? "AI call in progress" : !opportunity.mobile?.trim() ? "Mobile required" : dispatchReadiness.message}
                    </span>
                  )}
                </div>

                <div className="mt-2.5 rounded-lg bg-[#F1F5FA] px-3 py-2 text-[9px] leading-5 text-[#708198]">
                  {intakeLink?.linked && intakeLink.owned && intakeLink.intake_id ? (
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <span>Policy Intake already started: {intakeLink.intake_number || "Policy Intake"}{intakeLink.status ? " · " + titleCase(intakeLink.status) : ""}</span>
                      <Link
                        href={"/partner/policy-intakes/" + encodeURIComponent(intakeLink.intake_id)}
                        prefetch={false}
                        className="inline-flex min-h-8 items-center gap-2 rounded-lg border border-[#C7D4E5] bg-white px-3 text-[9px] font-bold text-[#203653]"
                      >
                        <FileUp className="h-3.5 w-3.5" /> Open Policy Intake
                      </Link>
                    </div>
                  ) : intakeLink?.linked ? (
                    <span>Policy Intake has already been started for this opportunity. Its details remain with the Partner user who started it.</span>
                  ) : isClosed ? (
                    <span>This renewal opportunity is closed. No new Policy Intake can be started from it.</span>
                  ) : canStartIntake ? (
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <span>Customer interest is recorded. This opportunity is ready for Policy Intake.</span>
                      <Link
                        href={"/partner/policy-intakes/new?external_opportunity=" + encodeURIComponent(id)}
                        prefetch={false}
                        className="inline-flex min-h-8 items-center gap-2 rounded-lg bg-[#0F2550] px-3 text-[9px] font-bold text-white"
                      >
                        <FileUp className="h-3.5 w-3.5" /> Start Policy Intake
                      </Link>
                    </div>
                  ) : (
                    <span>Record a connected, interested, quote or follow-up outcome before starting Policy Intake.</span>
                  )}
                </div>
              </div>
            </section>
          </div>
        </section>
      </div>
    </PartnerPortalShell>
  );
}

function SummaryItem({
  icon: Icon,
  title,
  detail,
}: {
  icon: typeof UserRound;
  title: string;
  detail: string;
}) {
  return (
    <div className="flex min-h-[62px] items-center gap-2.5 border-b border-[#E8EEF5] px-3 py-2 sm:border-b-0 sm:border-r">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#EEF4FF] text-[#3156B8]">
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <p className="truncate text-[10.5px] font-black text-[#203653]">{title}</p>
        <p className="mt-0.5 truncate text-[9px] font-medium text-[#71839C]">{detail}</p>
      </div>
    </div>
  );
}

function CardShell({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof ShieldCheck;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-xl border border-[#D9E2EC] bg-white shadow-[0_8px_24px_rgba(29,53,87,0.04)]">
      <div className="flex items-center justify-between gap-3 border-b border-[#E5EBF2] px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#EEF4FF] text-[#3156B8]">
            <Icon className="h-4 w-4" />
          </div>
          <h2 className="text-[13px] font-black text-[#1E3454]">{title}</h2>
        </div>
        <MoreHorizontal className="h-4 w-4 text-[#3156B8]" aria-hidden="true" />
      </div>
      <div className="p-3.5">{children}</div>
    </section>
  );
}

function SnapshotItem({
  icon: Icon,
  label,
  value,
  detail,
  badge = false,
}: {
  icon: typeof UserRound;
  label: string;
  value: string;
  detail?: string;
  badge?: boolean;
}) {
  return (
    <div className="flex min-w-0 items-start gap-2.5">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#EEF4FF] text-[#3156B8]">
        <Icon className="h-3.5 w-3.5" />
      </div>
      <div className="min-w-0">
        <p className="text-[8.5px] font-black uppercase tracking-[0.06em] text-[#74869E]">{label}</p>
        {badge ? (
          <span className="mt-1 inline-flex rounded-full bg-[#DDF7E8] px-2.5 py-1 text-[9px] font-bold text-[#159456]">{value}</span>
        ) : (
          <p className="mt-1 break-words text-[10px] font-bold leading-4 text-[#263D5E]">{value}</p>
        )}
        {detail ? <p className="mt-0.5 break-words text-[8.5px] leading-4 text-[#728198]">{detail}</p> : null}
      </div>
    </div>
  );
}
