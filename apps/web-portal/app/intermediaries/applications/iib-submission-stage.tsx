import { FormSubmitButton } from "@/components/form-submit-button";
import { darkActionClassName, primaryActionClassName, secondaryActionClassName } from "@/components/action-styles";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { prepareIntermediaryIibPayload, startIntermediaryIibHandoff } from "./iib-submission-actions";

type Props = { applicationId: string; agreementSigned: boolean; finalType: string | null };
type PortalFields = {
  PAN?: string;
  PoSPFName?: string;
  PoSPMName?: string;
  PoSPLName?: string;
  DoB?: string;
  City?: string;
  Pin?: string;
  AppointmentDate?: string;
  EMail?: string;
  Mobile?: string;
  Status?: string;
  InternalPOSCode?: string;
};
type PacketPayload = { portal_fields?: PortalFields; documents?: Array<{ type: string; file_name: string }> };
type Packet = { status: string; missing_fields: string[]; payload: PacketPayload; prepared_at: string | null; handoff_started_at: string | null };
type ApplicationRow = { registration_status: string; draft_data: Record<string, unknown> | null };
type AssignmentRow = { iib_registration_status: string; iib_registered_at: string | null };
type NameProfileRow = {
  partner_type: "posp" | "misp";
  pos_name: string | null;
  pos_first_name: string | null;
  pos_middle_name: string | null;
  pos_last_name: string | null;
  dp_first_name: string | null;
  dp_middle_name: string | null;
  dp_last_name: string | null;
};

export async function IibSubmissionStage({ applicationId, agreementSigned, finalType }: Props) {
  if (finalType === "partner" || !agreementSigned) return null;

  const admin = createSupabaseAdminClient();
  const [{ data: databasePacket }, { data: application }, { data: assignment }, { data: profile }] = await Promise.all([
    admin.from("intermediary_iib_submission_packets").select("status,missing_fields,payload,prepared_at,handoff_started_at").eq("application_id", applicationId).maybeSingle<Packet>(),
    admin.from("intermediary_onboarding_applications").select("registration_status,draft_data").eq("id", applicationId).maybeSingle<ApplicationRow>(),
    admin.from("intermediary_training_exam_assignments").select("iib_registration_status,iib_registered_at").eq("application_id", applicationId).maybeSingle<AssignmentRow>(),
    admin.from("posp_misp_onboarding_profiles").select("partner_type,pos_name,pos_first_name,pos_middle_name,pos_last_name,dp_first_name,dp_middle_name,dp_last_name").eq("application_id", applicationId).maybeSingle<NameProfileRow>(),
  ]);
  const packet = databasePacket ?? packetFromDraft(application?.draft_data);
  const registered = application?.registration_status === "iib_registered" || assignment?.iib_registration_status === "registered" || packet?.status === "registered";
  const storedFields = packet?.payload?.portal_fields ?? {};
  const liveNames = liveIibNames(profile);
  const fields: PortalFields = {
    ...storedFields,
    PoSPFName: liveNames.first || storedFields.PoSPFName,
    PoSPMName: liveNames.middle,
    PoSPLName: liveNames.last,
  };
  const documents = packet?.payload?.documents ?? [];
  const missingFields = (packet?.missing_fields ?? []).filter((field) => field !== "Last name");
  if (liveNames.last && !/^[A-Za-z ]+$/.test(liveNames.last)) missingFields.push("Last name");
  const ready = Boolean(packet) && missingFields.length === 0 && ["ready", "handoff_started", "draft"].includes(packet?.status ?? "");
  const portalUrl = process.env.NEXT_PUBLIC_IIB_POS_PORTAL_URL;

  if (registered) {
    return <section id="iib-submission" className="scroll-mt-24 overflow-hidden rounded-2xl border border-emerald-200 bg-white shadow-sm">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[#DCE5EF] bg-[#F4F7FB] px-5 py-4">
        <div>
          <p className="text-[9px] font-semibold uppercase tracking-[.1em] text-emerald-700">Step 6</p>
          <h2 className="mt-1 text-[14px] font-semibold text-[#0F172A]">IIB Registration</h2>
          <p className="mt-1 text-[9px] text-[#64748B]">The IIB process for this account is already complete.</p>
        </div>
        <span className="rounded-full bg-emerald-100 px-3 py-1.5 text-[8.5px] font-semibold text-emerald-800">Registered</span>
      </header>
      <div className="flex flex-wrap items-center justify-between gap-4 p-5">
        <div>
          <p className="text-[10px] font-semibold text-emerald-900">No new IIB preparation is required.</p>
          <p className="mt-1 text-[9.5px] text-[#64748B]">Preparing another payload could incorrectly move this account back to submission pending, so the preparation and handoff controls are disabled.</p>
        </div>
        <p className="text-[9px] font-medium text-emerald-800">Registered {formatDateTime(assignment?.iib_registered_at)}</p>
      </div>
    </section>;
  }

  return <section id="iib-submission" className="scroll-mt-24 overflow-hidden rounded-2xl border border-[#BFD0E2] bg-white shadow-sm">
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[#DCE5EF] bg-[#F4F7FB] px-5 py-4">
      <div>
        <p className="text-[9px] font-semibold uppercase tracking-[.1em] text-[#64748B]">Step 6</p>
        <h2 className="mt-1 text-[14px] font-semibold text-[#0F172A]">IIB Upload</h2>
        <p className="mt-1 text-[9px] text-[#64748B]">Check the portal values before submission.</p>
      </div>
      <span className={`rounded-full px-3 py-1.5 text-[8.5px] font-semibold ${ready ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>
        {ready ? "Data ready" : packet ? "Details incomplete" : "Not prepared"}
      </span>
    </header>
    <div className="p-5">
      {!packet ? <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="text-[10px] text-[#475569]">Prepare the values required by the IIB POS portal.</p>
        <form action={prepareIntermediaryIibPayload}>
          <input type="hidden" name="application_id" value={applicationId} />
          <FormSubmitButton label="Prepare IIB data" pendingLabel="Preparing" className={primaryActionClassName} />
        </form>
      </div> : <div className="space-y-5">
        {missingFields.length ? <div className="border-l-2 border-amber-400 pl-3">
          <p className="text-[10px] font-semibold text-amber-900">Complete these details</p>
          <p className="mt-1 text-[9.5px] text-amber-800">{missingFields.join(" · ")}</p>
        </div> : null}
        <DataGroup title="IIB portal values" rows={[
          ["PAN", fields.PAN],
          ["PoSPFName", fields.PoSPFName],
          ["PoSPMName", fields.PoSPMName],
          ["PoSPLName", fields.PoSPLName],
          ["DoB", fields.DoB],
          ["City", fields.City],
          ["Pin", fields.Pin],
          ["AppointmentDate", fields.AppointmentDate],
          ["EMail", fields.EMail],
          ["Mobile", fields.Mobile],
          ["Status", fields.Status],
          ["InternalPOSCode", fields.InternalPOSCode],
        ]} />
        <p className="text-[8.5px] text-[#64748B]">{documents.length} supporting document(s) linked.</p>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#E2E8F0] pt-4">
          <div className="text-[8.5px] text-[#64748B]">Prepared {formatDateTime(packet.prepared_at)}{packet.handoff_started_at ? ` · Portal handoff ${formatDateTime(packet.handoff_started_at)}` : ""}</div>
          <div className="flex flex-wrap gap-2">
            <form action={prepareIntermediaryIibPayload}>
              <input type="hidden" name="application_id" value={applicationId} />
              <FormSubmitButton label="Refresh data" pendingLabel="Refreshing" className={secondaryActionClassName} />
            </form>
            {ready ? <form action={startIntermediaryIibHandoff}>
              <input type="hidden" name="application_id" value={applicationId} />
              <FormSubmitButton label="Prepare portal handoff" pendingLabel="Preparing" className={darkActionClassName} />
            </form> : null}
            {ready && portalUrl ? <a href={portalUrl} target="_blank" rel="noreferrer" className={primaryActionClassName}>Open IIB portal</a> : null}
          </div>
        </div>
        {!portalUrl && ready ? <p className="text-[8.5px] text-[#64748B]">Set NEXT_PUBLIC_IIB_POS_PORTAL_URL to enable the portal button.</p> : null}
      </div>}
    </div>
  </section>;
}

function packetFromDraft(draftData: Record<string, unknown> | null | undefined): Packet | null {
  const value = asObject(draftData).iib_submission_packet;
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const packet = value as Record<string, unknown>;
  if (typeof packet.status !== "string") return null;
  return {
    status: packet.status,
    missing_fields: Array.isArray(packet.missing_fields) ? packet.missing_fields.filter((item): item is string => typeof item === "string") : [],
    payload: asObject(packet.payload) as PacketPayload,
    prepared_at: typeof packet.prepared_at === "string" ? packet.prepared_at : null,
    handoff_started_at: typeof packet.handoff_started_at === "string" ? packet.handoff_started_at : null,
  };
}

function liveIibNames(profile: NameProfileRow | null) {
  if (!profile) return { first: "", middle: "", last: "" };
  if (profile.partner_type === "misp") {
    return {
      first: cleanName(profile.dp_first_name),
      middle: cleanName(profile.dp_middle_name),
      last: cleanName(profile.dp_last_name),
    };
  }
  const fallback = splitName(profile.pos_name);
  return {
    first: cleanName(profile.pos_first_name ?? fallback.first),
    middle: cleanName(profile.pos_middle_name ?? fallback.middle),
    last: cleanName(profile.pos_last_name ?? fallback.last),
  };
}

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
function cleanName(value: string | null | undefined) { return (value ?? "").trim().replace(/\s+/g, " "); }
function splitName(value: string | null) {
  const parts = (value ?? "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return { first: "", middle: "", last: "" };
  if (parts.length === 1) return { first: parts[0], middle: "", last: "" };
  return { first: parts[0], middle: parts.slice(1, -1).join(" "), last: parts.at(-1) ?? "" };
}
function DataGroup({ title, rows }: { title: string; rows: Array<[string, unknown]> }) {
  return <div>
    <h3 className="text-[9px] font-semibold uppercase tracking-[.08em] text-[#64748B]">{title}</h3>
    <dl className="mt-2 divide-y divide-[#E8EDF3] border-y border-[#E8EDF3]">
      {rows.map(([label, value]) => <div key={label} className="grid grid-cols-[150px_1fr] gap-4 py-2.5 text-[9.5px]">
        <dt className="text-[#64748B]">{label}</dt>
        <dd className="break-words font-medium text-[#0F172A]">{display(value)}</dd>
      </div>)}
    </dl>
  </div>;
}
function display(value: unknown) { if (value === null || value === undefined || value === "") return "-"; return String(value); }
function formatDateTime(value: string | null | undefined) {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(date);
}
