"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireScopedPospMispManager } from "@/lib/master-data-server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

const applicationPath = (id: string) => `/intermediaries/applications/${id}`;
const NAME = /^[A-Za-z ]+$/;
const PAN = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

type ApplicationRow = {
  id: string;
  final_type: "posp" | "misp" | "partner" | null;
  registration_status: string;
  draft_data: Record<string, unknown> | null;
};
type ProfileRow = {
  partner_type: "posp" | "misp";
  external_onboarding_id: string | null;
  pos_name: string | null;
  pos_first_name: string | null;
  pos_middle_name: string | null;
  pos_last_name: string | null;
  misp_name: string | null;
  applicant_phone: string | null;
  applicant_email: string | null;
  date_of_birth: string | null;
  pan_number: string | null;
  city: string | null;
  postal_code: string | null;
  dp_first_name: string | null;
  dp_middle_name: string | null;
  dp_last_name: string | null;
  dp_phone: string | null;
  dp_email: string | null;
  dp_pan_number: string | null;
  dp_date_of_birth: string | null;
};
type AssignmentRow = {
  training_status: string;
  exam_status: string;
  agreement_status: string;
  iib_registration_status: string;
};
type DocumentRow = { document_type: string; file_name: string; storage_bucket: string; storage_path: string; verification_status: string };
type PortalPayload = {
  PAN: string;
  PoSPFName: string;
  PoSPMName: string;
  PoSPLName: string;
  DoB: string;
  City: string;
  Pin: string;
  AppointmentDate: string;
  EMail: string;
  Mobile: string;
  Status: "Y";
  InternalPOSCode: string;
};
type StoredPacket = {
  status: string;
  missing_fields: string[];
  payload: Record<string, unknown>;
  prepared_at: string | null;
  handoff_started_at: string | null;
};

export async function prepareIntermediaryIibPayload(formData: FormData) {
  const applicationId = text(formData, "application_id");
  if (!applicationId) redirect("/customers/posp-misp");
  const reviewer = await requireScopedPospMispManager(applicationId);
  if (!reviewer?.id) redirect("/customers/posp-misp");

  const admin = createSupabaseAdminClient();
  const [{ data: application }, { data: profile }, { data: assignment }, { data: intermediary }, { data: documents }] = await Promise.all([
    admin.from("intermediary_onboarding_applications").select("id,final_type,registration_status,draft_data").eq("id", applicationId).maybeSingle<ApplicationRow>(),
    admin.from("posp_misp_onboarding_profiles").select("partner_type,external_onboarding_id,pos_name,pos_first_name,pos_middle_name,pos_last_name,misp_name,applicant_phone,applicant_email,date_of_birth,pan_number,city,postal_code,dp_first_name,dp_middle_name,dp_last_name,dp_phone,dp_email,dp_pan_number,dp_date_of_birth").eq("application_id", applicationId).maybeSingle<ProfileRow>(),
    admin.from("intermediary_training_exam_assignments").select("training_status,exam_status,agreement_status,iib_registration_status").eq("application_id", applicationId).maybeSingle<AssignmentRow>(),
    admin.from("intermediaries").select("id").eq("application_id", applicationId).maybeSingle<{ id: string }>(),
    admin.from("intermediary_onboarding_documents").select("document_type,file_name,storage_bucket,storage_path,verification_status").eq("application_id", applicationId).returns<DocumentRow[]>(),
  ]);

  if (!application || !profile || application.final_type === "partner") {
    redirectFresh(`${applicationPath(applicationId)}?stage=review&error=iib_not_available`);
  }

  const alreadyRegistered = application.registration_status === "iib_registered" || assignment?.iib_registration_status === "registered";
  if (alreadyRegistered) {
    redirectFresh(`${applicationPath(applicationId)}?stage=review&success=iib_already_registered#iib-submission`);
  }

  if (assignment?.agreement_status !== "signed") {
    redirectFresh(`${applicationPath(applicationId)}?stage=review&error=iib_agreement_required`);
  }

  const type = (application.final_type ?? profile.partner_type) as "posp" | "misp";
  const fallbackPosName = splitName(profile.pos_name);
  const firstName = cleanName(type === "misp" ? profile.dp_first_name : profile.pos_first_name ?? fallbackPosName.first);
  const middleName = cleanName(type === "misp" ? profile.dp_middle_name : profile.pos_middle_name ?? fallbackPosName.middle);
  const lastName = cleanName(type === "misp" ? profile.dp_last_name : profile.pos_last_name ?? fallbackPosName.last);
  const pan = compactPan(type === "misp" ? profile.dp_pan_number : profile.pan_number);
  const dob = formatPortalDate(type === "misp" ? profile.dp_date_of_birth : profile.date_of_birth);
  const email = (type === "misp" ? profile.dp_email : profile.applicant_email)?.trim().toLowerCase() ?? "";
  const mobile = tenDigitMobile(type === "misp" ? profile.dp_phone : profile.applicant_phone);
  const city = profile.city?.trim() ?? "";
  const pin = profile.postal_code?.replace(/\D/g, "") ?? "";
  const internalPosCode = profile.external_onboarding_id?.trim() ?? "";

  const portalPayload: PortalPayload = {
    PAN: pan,
    PoSPFName: firstName,
    PoSPMName: middleName,
    PoSPLName: lastName,
    DoB: dob,
    City: city,
    Pin: pin,
    AppointmentDate: formatPortalDate(new Date().toISOString()),
    EMail: email,
    Mobile: mobile,
    Status: "Y",
    InternalPOSCode: internalPosCode,
  };

  const required: Array<[string, string, boolean]> = [
    ["PAN", portalPayload.PAN, PAN.test(portalPayload.PAN)],
    ["First name", portalPayload.PoSPFName, Boolean(portalPayload.PoSPFName && NAME.test(portalPayload.PoSPFName))],
    ["Date of birth", portalPayload.DoB, Boolean(portalPayload.DoB)],
    ["City", portalPayload.City, Boolean(portalPayload.City)],
    ["PIN", portalPayload.Pin, /^[0-9]{6}$/.test(portalPayload.Pin)],
    ["Email", portalPayload.EMail, /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(portalPayload.EMail)],
    ["Mobile", portalPayload.Mobile, /^[6-9][0-9]{9}$/.test(portalPayload.Mobile)],
    ["Internal POS code", portalPayload.InternalPOSCode, Boolean(portalPayload.InternalPOSCode)],
  ];
  const missingFields = required.filter(([, , valid]) => !valid).map(([label]) => label);
  if (portalPayload.PoSPMName && !NAME.test(portalPayload.PoSPMName)) missingFields.push("Middle name");
  if (portalPayload.PoSPLName && !NAME.test(portalPayload.PoSPLName)) missingFields.push("Last name");
  if (assignment?.training_status !== "completed") missingFields.push("Training completion");
  if (assignment?.exam_status !== "passed") missingFields.push("Passed examination");
  if (!(documents ?? []).length) missingFields.push("Documents");

  const payload = {
    portal_fields: portalPayload,
    intermediary_type: type,
    documents: (documents ?? []).map((document) => ({
      type: document.document_type,
      file_name: document.file_name,
      bucket: document.storage_bucket,
      path: document.storage_path,
      verification_status: document.verification_status,
    })),
  };

  const now = new Date().toISOString();
  const status = missingFields.length ? "draft" : "ready";
  const storedPacket: StoredPacket = {
    status,
    missing_fields: missingFields,
    payload,
    prepared_at: now,
    handoff_started_at: null,
  };

  const [{ error: packetError }, { error: applicationError }] = await Promise.all([
    admin.from("intermediary_iib_submission_packets").upsert({
      application_id: applicationId,
      intermediary_id: intermediary?.id ?? null,
      intermediary_type: type,
      status,
      payload,
      missing_fields: missingFields,
      prepared_at: now,
      prepared_by: reviewer.id,
      updated_at: now,
    }, { onConflict: "application_id" }),
    admin.from("intermediary_onboarding_applications").update({
      draft_data: { ...asObject(application.draft_data), iib_submission_packet: storedPacket },
      registration_status: status === "ready" ? "iib_submission_pending" : application.registration_status,
      updated_at: now,
    }).eq("id", applicationId),
  ]);

  if (applicationError || packetError) {
    redirectFresh(`${applicationPath(applicationId)}?stage=review&error=iib_prepare_failed`);
  }

  revalidatePath(applicationPath(applicationId));
  redirectFresh(`${applicationPath(applicationId)}?stage=review&success=${status === "ready" ? "iib_payload_ready" : "iib_payload_incomplete"}#iib-submission`);
}

export async function startIntermediaryIibHandoff(formData: FormData) {
  const applicationId = text(formData, "application_id");
  if (!applicationId) redirect("/customers/posp-misp");
  const reviewer = await requireScopedPospMispManager(applicationId);
  if (!reviewer?.id) redirect("/customers/posp-misp");

  const admin = createSupabaseAdminClient();
  const [{ data: packet }, { data: application }, { data: assignment }, { data: profile }] = await Promise.all([
    admin.from("intermediary_iib_submission_packets").select("status,missing_fields,payload,prepared_at,handoff_started_at").eq("application_id", applicationId).maybeSingle<StoredPacket>(),
    admin.from("intermediary_onboarding_applications").select("registration_status,draft_data").eq("id", applicationId).maybeSingle<{ registration_status: string; draft_data: Record<string, unknown> | null }>(),
    admin.from("intermediary_training_exam_assignments").select("iib_registration_status").eq("application_id", applicationId).maybeSingle<{ iib_registration_status: string }>(),
    admin.from("posp_misp_onboarding_profiles").select("partner_type,pos_name,pos_first_name,pos_middle_name,pos_last_name,dp_first_name,dp_middle_name,dp_last_name").eq("application_id", applicationId).maybeSingle<Pick<ProfileRow, "partner_type" | "pos_name" | "pos_first_name" | "pos_middle_name" | "pos_last_name" | "dp_first_name" | "dp_middle_name" | "dp_last_name">>(),
  ]);

  const alreadyRegistered = application?.registration_status === "iib_registered" || assignment?.iib_registration_status === "registered";
  if (alreadyRegistered) {
    redirectFresh(`${applicationPath(applicationId)}?stage=review&success=iib_already_registered#iib-submission`);
  }

  const effectivePacket = packet ?? packetFromDraft(application?.draft_data);
  const remainingMissingFields = effectivePacket?.missing_fields.filter((field) => field !== "Last name") ?? [];
  if (!effectivePacket || !["ready", "handoff_started", "draft"].includes(effectivePacket.status) || remainingMissingFields.length || !profile) {
    redirectFresh(`${applicationPath(applicationId)}?stage=review&error=iib_payload_not_ready#iib-submission`);
  }

  const payload = asObject(effectivePacket.payload);
  const portalFields = asObject(payload.portal_fields);
  const liveNames = liveIibNames(profile);
  const refreshedPayload = {
    ...payload,
    portal_fields: {
      ...portalFields,
      PoSPFName: liveNames.first || portalFields.PoSPFName || "",
      PoSPMName: liveNames.middle,
      PoSPLName: liveNames.last,
    },
  };

  const now = new Date().toISOString();
  const updatedPacket: StoredPacket = {
    ...effectivePacket,
    status: "handoff_started",
    missing_fields: remainingMissingFields,
    payload: refreshedPayload,
    handoff_started_at: now,
  };
  const draftData = asObject(application?.draft_data);
  const [{ error: packetError }, { error: applicationError }] = await Promise.all([
    admin.from("intermediary_iib_submission_packets").upsert({
      application_id: applicationId,
      intermediary_type: profile.partner_type,
      status: "handoff_started",
      payload: refreshedPayload,
      missing_fields: remainingMissingFields,
      prepared_at: effectivePacket.prepared_at ?? now,
      prepared_by: reviewer.id,
      handoff_started_at: now,
      handoff_started_by: reviewer.id,
      updated_at: now,
    }, { onConflict: "application_id" }),
    admin.from("intermediary_onboarding_applications").update({
      draft_data: { ...draftData, iib_submission_packet: updatedPacket },
      updated_at: now,
    }).eq("id", applicationId),
  ]);

  if (applicationError || packetError) {
    redirectFresh(`${applicationPath(applicationId)}?stage=review&error=iib_handoff_failed#iib-submission`);
  }

  revalidatePath(applicationPath(applicationId));
  redirectFresh(`${applicationPath(applicationId)}?stage=review&success=iib_handoff_started#iib-submission`);
}

export async function completeIntermediaryIibRegistration(formData: FormData) {
  const applicationId = text(formData, "application_id");
  if (!applicationId) redirect("/customers/posp-misp");
  const reviewer = await requireScopedPospMispManager(applicationId);
  if (!reviewer?.id) redirect("/customers/posp-misp");

  if (text(formData, "confirm_iib_registration") !== "yes") {
    redirectFresh(`${applicationPath(applicationId)}?stage=review&error=iib_registration_confirmation_required#iib-submission`);
  }

  const registeredOn = text(formData, "registered_on");
  if (!registeredOn || !ISO_DATE.test(registeredOn) || !isValidIsoDate(registeredOn) || registeredOn > indiaToday()) {
    redirectFresh(`${applicationPath(applicationId)}?stage=review&error=iib_registration_date_invalid#iib-submission`);
  }

  const reference = text(formData, "iib_reference");
  if (reference && reference.length > 120) {
    redirectFresh(`${applicationPath(applicationId)}?stage=review&error=iib_registration_reference_invalid#iib-submission`);
  }

  const admin = createSupabaseAdminClient();
  const { error } = await admin.rpc("complete_intermediary_iib_registration", {
    p_application_id: applicationId,
    p_actor_id: reviewer.id,
    p_iib_reference: reference,
    p_registered_on: registeredOn,
  });

  if (error) {
    console.error("IIB registration finalization failed", { applicationId, code: error.code });
    redirectFresh(`${applicationPath(applicationId)}?stage=review&error=iib_registration_failed#iib-submission`);
  }

  revalidatePath(applicationPath(applicationId));
  revalidatePath(`${applicationPath(applicationId)}/workflow`);
  revalidatePath("/intermediaries/posp");
  revalidatePath("/intermediaries/misp");
  redirectFresh(`${applicationPath(applicationId)}?stage=review&success=iib_registration_completed#iib-submission`);
}

function packetFromDraft(draftData: Record<string, unknown> | null | undefined): StoredPacket | null {
  const value = asObject(draftData).iib_submission_packet;
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const packet = value as Record<string, unknown>;
  if (typeof packet.status !== "string") return null;
  return {
    status: packet.status,
    missing_fields: Array.isArray(packet.missing_fields) ? packet.missing_fields.filter((item): item is string => typeof item === "string") : [],
    payload: asObject(packet.payload),
    prepared_at: typeof packet.prepared_at === "string" ? packet.prepared_at : null,
    handoff_started_at: typeof packet.handoff_started_at === "string" ? packet.handoff_started_at : null,
  };
}

function liveIibNames(profile: Pick<ProfileRow, "partner_type" | "pos_name" | "pos_first_name" | "pos_middle_name" | "pos_last_name" | "dp_first_name" | "dp_middle_name" | "dp_last_name"> | null) {
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

function redirectFresh(href: string): never {
  redirect(href);
}

function text(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" && value.trim() ? value.trim() : null;
}
function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
function compactPan(value: string | null) { return value?.replace(/\s/g, "").toUpperCase() ?? ""; }
function tenDigitMobile(value: string | null) { const digits = value?.replace(/\D/g, "") ?? ""; return digits.length > 10 ? digits.slice(-10) : digits; }
function cleanName(value: string | null | undefined) { return (value ?? "").trim().replace(/\s+/g, " "); }
function splitName(value: string | null) {
  const parts = (value ?? "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return { first: "", middle: "", last: "" };
  if (parts.length === 1) return { first: parts[0], middle: "", last: "" };
  return { first: parts[0], middle: parts.slice(1, -1).join(" "), last: parts.at(-1) ?? "" };
}
function formatPortalDate(value: string | null | undefined) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Asia/Kolkata" }).format(date);
}
function indiaToday() {
  const parts = new Intl.DateTimeFormat("en-GB", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: "Asia/Kolkata" }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}
function isValidIsoDate(value: string) {
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
