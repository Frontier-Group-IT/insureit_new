import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Database, PhoneCall, Save, ShieldCheck } from "lucide-react";

import { AppShell } from "@/components/shell";
import { PendingButton } from "@/components/voice/pending-button";
import { getAuthenticatedProfile, getServerAccessToken } from "@/lib/auth-server";
import { hasEffectiveCapability } from "@/lib/effective-permissions";
import { getVoiceProspectDetail } from "@/lib/voice-prospect-profile";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function q(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function text(value: unknown) {
  if (value == null || value === "") return "—";
  return String(value);
}

function dateTime(value: string | null) {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "—";
  return parsed.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" });
}

function labelize(value: string | null) {
  if (!value) return "—";
  return value.replaceAll("_", " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export default async function VoiceProspectDetailPage({ params, searchParams }: PageProps) {
  const auth = await getAuthenticatedProfile(await getServerAccessToken());
  const viewer = auth.profile;
  if (!viewer?.id || viewer.role !== "it_super_user" || !(await hasEffectiveCapability(viewer, "manage_system", "approve"))) {
    redirect("/access-denied");
  }

  const { id } = await params;
  const query = await searchParams;
  const detail = await getVoiceProspectDetail(id);
  const { opportunity, baseline, effective, attempts, events } = detail;
  const rc = opportunity.rc_enrichment_details ?? {};
  const profileUpdate = q(query.profile_update);
  const profileError = q(query.profile_error);
  const rcUpdate = q(query.rc_enrichment);
  const rcError = q(query.rc_enrichment_error);
  const dispatch = q(query.dispatch);
  const dispatchError = q(query.dispatch_error);
  const quickAdd = q(query.quick_add);
  const returnTo = `/system/voice-integration/prospects/${id}`;

  const notice =
    quickAdd && rcUpdate === "ready"
      ? {
          ok: true,
          text: quickAdd === "created"
            ? "Quick Add prospect created and AuthBridge details fetched."
            : "Existing prospect added to the calling queue and AuthBridge details refreshed.",
        }
      : profileUpdate
      ? { ok: profileUpdate === "saved", text: profileUpdate === "saved" ? "AI calling profile saved." : profileError || "Could not save profile." }
      : rcUpdate
        ? { ok: rcUpdate === "ready", text: rcUpdate === "ready" ? "RC details refreshed." : rcError || "RC details could not be refreshed." }
        : dispatch
          ? { ok: dispatch === "queued", text: dispatch === "queued" ? "AI call queued." : dispatchError || "AI call could not be queued." }
          : null;

  const fetchedFields = [
    ["Registration number", rc.registrationNumber],
    ["Registration date", rc.registrationDate],
    ["Manufacturer", rc.manufacturer],
    ["Model", rc.model],
    ["Manufacturing year", rc.manufacturingYear],
    ["Vehicle class", rc.vehicleClass],
    ["Fuel type", rc.fuelType],
    ["Engine capacity (cc)", rc.engineCapacityCc],
    ["Seating capacity", rc.seatingCapacity],
    ["GVW (kg)", rc.gvwKg],
    ["Chassis number", rc.chassisNumber],
    ["Fitness expiry", rc.fitnessExpiryDate],
    ["PUC expiry", rc.pucExpiryDate],
    ["Road tax expiry", rc.roadTaxExpiryDate],
    ["National permit expiry", rc.nationalPermitExpiryDate],
    ["Local permit expiry", rc.localPermitExpiryDate],
    ["Insurance company", rc.insuranceCompany],
    ["Policy number", rc.policyNumber],
    ["Policy expiry", rc.policyExpiryDate],
  ] as const;

  return (
    <AppShell title="Voice Prospect">
      <div className="mx-auto max-w-[1380px] space-y-3 pb-8">
        <section className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#DDE6F0] bg-white px-4 py-3 shadow-[0_5px_18px_rgba(31,55,86,0.04)]">
          <div className="flex min-w-0 items-center gap-3">
            <Link href="/system/voice-integration#voice-queue" className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-[#D6E0EC] text-[#3156B8] hover:bg-[#F8FAFC]">
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-[8px] font-black uppercase tracking-[.08em] text-[#7A8DA6]">External renewal prospect</p>
                {opportunity.voice_queue_source === "it_quick_add" ? (
                  <span className="rounded-full bg-[#EEF3FF] px-2 py-0.5 text-[6.5px] font-black uppercase tracking-[.05em] text-[#3156B8]">Quick add</span>
                ) : null}
              </div>
              <h1 className="truncate text-[18px] font-black text-[#173154]">{effective.customerName ?? opportunity.account_name ?? "Prospect"}</h1>
              <p className="mt-0.5 font-mono text-[8px] text-[#8091A7]">{opportunity.id}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <form action="/api/system/voice-integration/rc-enrichment" method="post">
              <input type="hidden" name="opportunity_id" value={opportunity.id} />
              <input type="hidden" name="return_to" value={returnTo} />
              <PendingButton
                pendingLabel="Fetching…"
                className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[#D6E0EC] bg-white px-3 text-[8.5px] font-bold text-[#3156B8] disabled:opacity-50"
              >
                <Database className="h-3.5 w-3.5" /> {opportunity.rc_enrichment_status === "ready" ? "Refresh details" : "Fetch details"}
              </PendingButton>
            </form>
            <form action="/api/system/voice-integration/dispatch" method="post">
              <input type="hidden" name="opportunity_id" value={opportunity.id} />
              <input type="hidden" name="return_to" value={returnTo} />
              <PendingButton
                pendingLabel="Creating cohort…"
                disabled={opportunity.rc_enrichment_status !== "ready"}
                className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-[#102A56] px-3 text-[8.5px] font-bold text-white disabled:cursor-not-allowed disabled:bg-[#C9D4E2]"
              >
                <PhoneCall className="h-3.5 w-3.5" /> Call
              </PendingButton>
            </form>
          </div>
        </section>

        {notice ? (
          <div className={`rounded-xl border px-3.5 py-2.5 text-[9px] font-semibold ${notice.ok ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-amber-200 bg-amber-50 text-amber-800"}`}>
            {notice.text}
          </div>
        ) : null}

        <section className="grid gap-3 xl:grid-cols-[1.2fr_.8fr]">
          <form action="/api/system/voice-integration/prospect-profile" method="post" className="rounded-2xl border border-[#DDE6F0] bg-white p-4 shadow-[0_5px_18px_rgba(31,55,86,0.04)]">
            <input type="hidden" name="opportunity_id" value={opportunity.id} />
            <input type="hidden" name="return_to" value={returnTo} />
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-[11px] font-black text-[#1D3557]">AI calling profile</h2>
                <p className="mt-0.5 text-[8.5px] text-[#71839A]">Editable IT override layer used when the cohort is created. Source and provider evidence remain unchanged.</p>
              </div>
              <PendingButton pendingLabel="Saving…" className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-[#102A56] px-3 text-[8.5px] font-bold text-white">
                <Save className="h-3.5 w-3.5" /> Save changes
              </PendingButton>
            </div>

            <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <Field name="customerName" label="Customer name" value={effective.customerName} />
              <Field name="mobile" label="Mobile number" value={effective.mobile} inputMode="tel" />
              <Field name="registrationNumber" label="Registration number" value={effective.registrationNumber} />
              <Field name="manufacturer" label="Manufacturer" value={effective.manufacturer} />
              <Field name="model" label="Model" value={effective.model} />
              <Field name="chassisNumber" label="Chassis number" value={effective.chassisNumber} />
              <Field name="insuranceCompany" label="Insurance company" value={effective.insuranceCompany} />
              <Field name="policyNumber" label="Policy number" value={effective.policyNumber} />
              <Field name="policyExpiryDate" label="Policy expiry" value={effective.policyExpiryDate} type="date" />
              <Field name="previousIdv" label="Previous IDV" value={effective.previousIdv} inputMode="decimal" />
              <Field name="previousPremium" label="Previous premium" value={effective.previousPremium} inputMode="decimal" />
              <Field name="registrationDate" label="Registration date" value={effective.registrationDate} type="date" />
              <Field name="manufacturingYear" label="Manufacturing year" value={effective.manufacturingYear} />
              <Field name="vehicleClass" label="Vehicle class" value={effective.vehicleClass} />
              <Field name="fuelType" label="Fuel type" value={effective.fuelType} />
              <Field name="engineCapacityCc" label="Engine capacity (cc)" value={effective.engineCapacityCc} inputMode="decimal" />
              <Field name="seatingCapacity" label="Seating capacity" value={effective.seatingCapacity} inputMode="numeric" />
              <Field name="gvwKg" label="GVW (kg)" value={effective.gvwKg} inputMode="decimal" />
              <Field name="fitnessExpiryDate" label="Fitness expiry" value={effective.fitnessExpiryDate} type="date" />
              <Field name="pucExpiryDate" label="PUC expiry" value={effective.pucExpiryDate} type="date" />
              <Field name="roadTaxExpiryDate" label="Road tax expiry" value={effective.roadTaxExpiryDate} type="date" />
              <Field name="nationalPermitExpiryDate" label="National permit expiry" value={effective.nationalPermitExpiryDate} type="date" />
              <Field name="localPermitExpiryDate" label="Local permit expiry" value={effective.localPermitExpiryDate} type="date" />
            </div>

            <div className="mt-3 rounded-xl border border-[#E4EBF3] bg-[#F8FAFC] px-3 py-2 text-[8px] text-[#657A94]">
              Changing the registration number resets RC enrichment to <strong>Not fetched</strong> so the corrected RC must be verified before calling. Other edits remain explicit IT overrides.
            </div>
          </form>

          <div className="space-y-3">
            <section className="rounded-2xl border border-[#DDE6F0] bg-white p-4 shadow-[0_5px_18px_rgba(31,55,86,0.04)]">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-[11px] font-black text-[#1D3557]">AuthBridge normalized details</h2>
                <span className={`rounded-full px-2 py-1 text-[7.5px] font-bold ${opportunity.rc_enrichment_status === "ready" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
                  {labelize(opportunity.rc_enrichment_status)}
                </span>
              </div>
              <p className="mt-1 text-[8px] text-[#7A8DA6]">Source: {labelize(opportunity.rc_enrichment_source)} · fetched {dateTime(opportunity.rc_enriched_at)}</p>
              <div className="mt-3 grid gap-x-3 gap-y-2 sm:grid-cols-2">
                {fetchedFields.map(([label, value]) => <ReadField key={label} label={label} value={text(value)} />)}
              </div>
              <div className="mt-3 flex items-start gap-2 rounded-lg bg-[#F4F7FB] px-3 py-2 text-[8px] text-[#64748B]">
                <ShieldCheck className="mt-0.5 h-3 w-3 shrink-0 text-[#3156B8]" />
                Only approved normalized RC/policy fields are shown here. Raw provider payloads, owner identity and provider-returned addresses remain outside this page.
              </div>
            </section>

            <section className="rounded-2xl border border-[#DDE6F0] bg-white p-4 shadow-[0_5px_18px_rgba(31,55,86,0.04)]">
              <h2 className="text-[11px] font-black text-[#1D3557]">Imported source</h2>
              <div className="mt-3 grid gap-x-3 gap-y-2 sm:grid-cols-2">
                <ReadField label="Account" value={text(opportunity.account_name)} />
                <ReadField label="Customer" value={text(opportunity.customer_name)} />
                <ReadField label="Contact" value={text(opportunity.contact_name)} />
                <ReadField label="Mobile" value={text(opportunity.mobile)} />
                <ReadField label="Registration" value={text(opportunity.registration_no)} />
                <ReadField label="Chassis" value={text(opportunity.chassis_no)} />
                <ReadField label="Vehicle" value={text([opportunity.vehicle_make, opportunity.vehicle_model].filter(Boolean).join(" "))} />
                <ReadField label="LOB" value={text(opportunity.vehicle_lob)} />
                <ReadField label="Current insurer" value={text(opportunity.current_insurer)} />
                <ReadField label="Policy number" value={text(opportunity.current_policy_no)} />
                <ReadField
                  label="Source expiry"
                  value={opportunity.voice_queue_source === "it_quick_add" ? "Quick Add uses AuthBridge expiry" : text(opportunity.policy_end_date)}
                />
                <ReadField label="CRM status" value={labelize(opportunity.opportunity_status)} />
                <ReadField label="Address" value={text([opportunity.address, opportunity.city, opportunity.state, opportunity.postal_code].filter(Boolean).join(", "))} wide />
              </div>
              {opportunity.ai_profile_updated_at ? (
                <p className="mt-3 text-[8px] text-[#7A8DA6]">AI calling profile last edited {dateTime(opportunity.ai_profile_updated_at)}.</p>
              ) : null}
            </section>
          </div>
        </section>

        <section className="rounded-2xl border border-[#DDE6F0] bg-white p-4 shadow-[0_5px_18px_rgba(31,55,86,0.04)]">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-[11px] font-black text-[#1D3557]">Sarvam call history</h2>
              <p className="mt-0.5 text-[8.5px] text-[#71839A]">Full normalized outcomes plus the exact privacy-minimized cohort context captured for each attempt.</p>
            </div>
            <span className="text-[8px] font-bold text-[#8798AC]">{attempts.length} attempt{attempts.length === 1 ? "" : "s"}</span>
          </div>

          <div className="mt-3 space-y-3">
            {attempts.map((attempt) => {
              const attemptEvents = events.filter((event) => event.voice_attempt_id === attempt.id);
              const context = attempt.cohort_context ?? {};
              return (
                <article key={attempt.id} id={`attempt-${attempt.id}`} className="rounded-xl border border-[#E3EAF2] p-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-mono text-[8px] text-[#8191A6]">{attempt.id}</p>
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        <Badge text={labelize(attempt.submission_status)} />
                        <Badge text={labelize(attempt.connectivity_status)} />
                        <Badge text={labelize(attempt.call_disposition)} />
                      </div>
                    </div>
                    <span className="text-[8px] font-semibold text-[#74869E]">{dateTime(attempt.created_at)}</span>
                  </div>

                  <div className="mt-3 grid gap-x-4 gap-y-2 sm:grid-cols-2 xl:grid-cols-4">
                    <ReadField label="Completion" value={labelize(attempt.completion_status)} />
                    <ReadField label="Interest" value={labelize(attempt.customer_interest)} />
                    <ReadField label="Duration" value={attempt.duration_seconds == null ? "—" : `${attempt.duration_seconds}s`} />
                    <ReadField label="Follow-up" value={attempt.follow_up_required ? dateTime(attempt.follow_up_at) : "No"} />
                    <ReadField label="Objection" value={text(attempt.customer_objection)} wide />
                    <ReadField label="Summary" value={text(attempt.call_summary)} wide />
                  </div>

                  <div className="mt-3 rounded-lg bg-[#F8FAFC] p-3">
                    <p className="text-[7.5px] font-black uppercase tracking-[.06em] text-[#8091A7]">Cohort context used</p>
                    <div className="mt-2 grid gap-x-3 gap-y-2 sm:grid-cols-2 xl:grid-cols-4">
                      {Object.entries(context).map(([key, value]) => <ReadField key={key} label={labelize(key)} value={text(value)} />)}
                      {!Object.keys(context).length ? <span className="text-[8px] text-[#94A3B8]">Snapshot unavailable for this older attempt.</span> : null}
                    </div>
                  </div>

                  {attemptEvents.length ? (
                    <div className="mt-3 overflow-x-auto">
                      <table className="w-full min-w-[620px] text-left text-[8px]">
                        <thead>
                          <tr className="border-y border-[#E7EDF4] bg-[#FAFBFD] text-[7px] font-black uppercase tracking-[.05em] text-[#8293A8]">
                            <th className="px-2 py-1.5">Retry</th>
                            <th className="px-2 py-1.5">Connection</th>
                            <th className="px-2 py-1.5">Completion</th>
                            <th className="px-2 py-1.5">Next action</th>
                            <th className="px-2 py-1.5">Failure</th>
                            <th className="px-2 py-1.5">Time</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#EEF2F7]">
                          {attemptEvents.map((event) => (
                            <tr key={event.id}>
                              <td className="px-2 py-1.5">{event.retry_attempt}</td>
                              <td className="px-2 py-1.5">{labelize(event.connectivity_status)}</td>
                              <td className="px-2 py-1.5">{labelize(event.completion_status)}</td>
                              <td className="px-2 py-1.5">{text(event.next_action_status)}</td>
                              <td className="px-2 py-1.5">{text(event.failure_reason)}</td>
                              <td className="px-2 py-1.5">{dateTime(event.created_at)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : null}
                </article>
              );
            })}
            {!attempts.length ? <div className="rounded-xl bg-[#F8FAFC] px-4 py-8 text-center text-[9px] text-[#94A3B8]">No Sarvam attempts for this prospect yet.</div> : null}
          </div>
        </section>
      </div>
    </AppShell>
  );
}

function Field({
  name,
  label,
  value,
  type = "text",
  inputMode,
}: {
  name: string;
  label: string;
  value: string | null;
  type?: string;
  inputMode?: "text" | "tel" | "numeric" | "decimal";
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[7.5px] font-black uppercase tracking-[.05em] text-[#8192A7]">{label}</span>
      <input
        name={name}
        type={type}
        inputMode={inputMode}
        defaultValue={value ?? ""}
        className="h-9 w-full rounded-lg border border-[#D8E1EC] bg-white px-2.5 text-[9px] font-semibold text-[#29415F] outline-none transition focus:border-[#7D98D8] focus:ring-2 focus:ring-[#3156B8]/10"
      />
    </label>
  );
}

function ReadField({ label, value, wide = false }: { label: string; value: string; wide?: boolean }) {
  return (
    <div className={wide ? "sm:col-span-2" : ""}>
      <p className="text-[7px] font-black uppercase tracking-[.05em] text-[#8A9AAF]">{label}</p>
      <p className="mt-0.5 break-words text-[8.5px] font-semibold text-[#334B6B]">{value}</p>
    </div>
  );
}

function Badge({ text }: { text: string }) {
  return <span className="rounded-full bg-[#F1F4F8] px-2 py-0.5 text-[7.5px] font-bold text-[#60748E]">{text}</span>;
}
