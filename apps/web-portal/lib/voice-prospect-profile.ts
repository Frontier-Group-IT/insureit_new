import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase-admin";

export type ExternalRenewalAiProfile = {
  customerName: string | null;
  mobile: string | null;
  registrationNumber: string | null;
  registrationDate: string | null;
  rto: string | null;
  rcStatus: string | null;
  rcStatusAsOn: string | null;
  rcOwnerName: string | null;
  ownerSerialNumber: string | null;
  fatherHusbandName: string | null;
  permanentAddress: string | null;
  presentAddress: string | null;
  manufacturer: string | null;
  model: string | null;
  manufactureDate: string | null;
  manufacturingYear: string | null;
  vehicleClass: string | null;
  vehicleCategory: string | null;
  bodyType: string | null;
  color: string | null;
  fuelType: string | null;
  normsType: string | null;
  engineNumber: string | null;
  engineCapacityCc: string | null;
  cylinderCount: string | null;
  seatingCapacity: string | null;
  standingCapacity: string | null;
  sleeperCapacity: string | null;
  wheelBaseMm: string | null;
  gvwKg: string | null;
  unladenWeightKg: string | null;
  commercial: string | null;
  chassisNumber: string | null;
  fitnessExpiryDate: string | null;
  roadTaxExpiryDate: string | null;
  vehicleTaxUptoDate: string | null;
  pucNumber: string | null;
  pucExpiryDate: string | null;
  permitNumber: string | null;
  permitType: string | null;
  permitIssueDate: string | null;
  permitValidFrom: string | null;
  localPermitExpiryDate: string | null;
  nationalPermitNumber: string | null;
  nationalPermitIssuedBy: string | null;
  nationalPermitExpiryDate: string | null;
  financed: string | null;
  financerName: string | null;
  insuranceCompany: string | null;
  policyNumber: string | null;
  policyExpiryDate: string | null;
  blacklistStatus: string | null;
  nocDetails: string | null;
  previousIdv: string | null;
  previousPremium: string | null;
};

export type ExternalRenewalSourceProfile = {
  id: string;
  batch_id: string;
  partner_id: string;
  account_name: string | null;
  customer_name: string | null;
  contact_name: string | null;
  mobile: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  chassis_no: string | null;
  registration_no: string | null;
  vehicle_make: string | null;
  vehicle_model: string | null;
  vehicle_lob: string | null;
  invoice_date: string;
  policy_start_date: string;
  policy_end_date: string;
  current_insurer: string | null;
  current_policy_no: string | null;
  opportunity_status: string;
  rc_enrichment_status: string | null;
  rc_enrichment_source: string | null;
  rc_enrichment_details: Record<string, unknown> | null;
  rc_enriched_at: string | null;
  rc_enrichment_error_code: string | null;
  ai_profile_overrides: Record<string, unknown> | null;
  ai_profile_updated_at: string | null;
  ai_profile_updated_by: string | null;
  voice_queue_source: "import" | "it_quick_add" | null;
  quick_added_at: string | null;
};

export type VoiceAttemptDetail = {
  id: string;
  opportunity_id: string;
  provider_attempt_id: string | null;
  provider_interaction_id: string | null;
  provider_campaign_id: string | null;
  provider_cohort_id: string | null;
  submission_status: string;
  connectivity_status: string | null;
  completion_status: string | null;
  retry_attempt: number;
  duration_seconds: number | null;
  started_at: string | null;
  ended_at: string | null;
  call_disposition: string | null;
  customer_interest: string | null;
  follow_up_required: boolean | null;
  follow_up_at: string | null;
  customer_objection: string | null;
  call_summary: string | null;
  cohort_context: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
};

export type VoiceAttemptEventDetail = {
  id: string;
  voice_attempt_id: string;
  provider_attempt_id: string;
  connectivity_status: string | null;
  completion_status: string | null;
  next_action_status: string | null;
  failure_reason: string | null;
  retry_attempt: number;
  duration_seconds: number | null;
  started_at: string | null;
  ended_at: string | null;
  created_at: string;
};

const PROFILE_FIELDS = [
  "customerName","mobile","registrationNumber","registrationDate","rto","rcStatus","rcStatusAsOn","rcOwnerName",
  "ownerSerialNumber","fatherHusbandName","permanentAddress","presentAddress","manufacturer","model","manufactureDate",
  "manufacturingYear","vehicleClass","vehicleCategory","bodyType","color","fuelType","normsType","engineNumber",
  "engineCapacityCc","cylinderCount","seatingCapacity","standingCapacity","sleeperCapacity","wheelBaseMm","gvwKg",
  "unladenWeightKg","commercial","chassisNumber","fitnessExpiryDate","roadTaxExpiryDate","vehicleTaxUptoDate",
  "pucNumber","pucExpiryDate","permitNumber","permitType","permitIssueDate","permitValidFrom","localPermitExpiryDate",
  "nationalPermitNumber","nationalPermitIssuedBy","nationalPermitExpiryDate","financed","financerName",
  "insuranceCompany","policyNumber","policyExpiryDate","blacklistStatus","nocDetails","previousIdv","previousPremium",
] as const;

function text(value: unknown) {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const next = String(value).replace(/\s+/g, " ").trim();
  return next || null;
}

function normalizedDetails(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

export function baselineExternalRenewalAiProfile(row: ExternalRenewalSourceProfile): ExternalRenewalAiProfile {
  const rc = normalizedDetails(row.rc_enrichment_details);
  return {
    customerName: text(row.customer_name) ?? text(row.contact_name) ?? text(row.account_name),
    mobile: text(row.mobile),
    registrationNumber: text(rc.registrationNumber) ?? text(row.registration_no),
    registrationDate: text(rc.registrationDate),
    rto: text(rc.rto),
    rcStatus: text(rc.rcStatus),
    rcStatusAsOn: text(rc.rcStatusAsOn),
    rcOwnerName: text(rc.ownerName),
    ownerSerialNumber: text(rc.ownerSerialNumber),
    fatherHusbandName: text(rc.fatherHusbandName),
    permanentAddress: text(rc.permanentAddress),
    presentAddress: text(rc.presentAddress),
    manufacturer: text(rc.manufacturer) ?? text(row.vehicle_make),
    model: text(rc.model) ?? text(row.vehicle_model),
    manufactureDate: text(rc.manufactureDate),
    manufacturingYear: text(rc.manufacturingYear),
    vehicleClass: text(rc.vehicleClass),
    vehicleCategory: text(rc.vehicleCategory),
    bodyType: text(rc.bodyType),
    color: text(rc.color),
    fuelType: text(rc.fuelType),
    normsType: text(rc.normsType),
    engineNumber: text(rc.engineNumber),
    engineCapacityCc: text(rc.engineCapacityCc),
    cylinderCount: text(rc.cylinderCount),
    seatingCapacity: text(rc.seatingCapacity),
    standingCapacity: text(rc.standingCapacity),
    sleeperCapacity: text(rc.sleeperCapacity),
    wheelBaseMm: text(rc.wheelBaseMm),
    gvwKg: text(rc.gvwKg),
    unladenWeightKg: text(rc.unladenWeightKg),
    commercial: text(rc.commercial),
    chassisNumber: text(rc.chassisNumber) ?? text(row.chassis_no),
    fitnessExpiryDate: text(rc.fitnessExpiryDate),
    roadTaxExpiryDate: text(rc.roadTaxExpiryDate),
    vehicleTaxUptoDate: text(rc.vehicleTaxUptoDate),
    pucNumber: text(rc.pucNumber),
    pucExpiryDate: text(rc.pucExpiryDate),
    permitNumber: text(rc.permitNumber),
    permitType: text(rc.permitType),
    permitIssueDate: text(rc.permitIssueDate),
    permitValidFrom: text(rc.permitValidFrom),
    localPermitExpiryDate: text(rc.localPermitExpiryDate),
    nationalPermitNumber: text(rc.nationalPermitNumber),
    nationalPermitIssuedBy: text(rc.nationalPermitIssuedBy),
    nationalPermitExpiryDate: text(rc.nationalPermitExpiryDate),
    financed: text(rc.financed),
    financerName: text(rc.financerName),
    insuranceCompany: text(rc.insuranceCompany) ?? text(row.current_insurer),
    policyNumber: text(rc.policyNumber) ?? text(row.current_policy_no),
    policyExpiryDate: text(rc.policyExpiryDate) ?? (row.voice_queue_source === "it_quick_add" ? null : text(row.policy_end_date)),
    blacklistStatus: text(rc.blacklistStatus),
    nocDetails: text(rc.nocDetails),
    previousIdv: null,
    previousPremium: null,
  };
}
export function effectiveExternalRenewalAiProfile(row: ExternalRenewalSourceProfile): ExternalRenewalAiProfile {
  const baseline = baselineExternalRenewalAiProfile(row);
  const overrides = normalizedDetails(row.ai_profile_overrides);
  const result = { ...baseline };
  for (const field of PROFILE_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(overrides, field)) {
      result[field] = text(overrides[field]);
    }
  }
  return result;
}

export function compactAiProfileOverrides(
  baseline: ExternalRenewalAiProfile,
  candidate: ExternalRenewalAiProfile,
) {
  const overrides: Record<string, string | null> = {};
  for (const field of PROFILE_FIELDS) {
    const base = baseline[field] ?? null;
    const next = candidate[field] ?? null;
    if (base !== next) overrides[field] = next;
  }
  return overrides;
}

export async function getVoiceProspectDetail(opportunityId: string) {
  const admin = createSupabaseAdminClient();
  const { data: opportunity, error } = await admin
    .from("external_renewal_opportunities")
    .select("id,batch_id,partner_id,account_name,customer_name,contact_name,mobile,address,city,state,postal_code,chassis_no,registration_no,vehicle_make,vehicle_model,vehicle_lob,invoice_date,policy_start_date,policy_end_date,current_insurer,current_policy_no,opportunity_status,rc_enrichment_status,rc_enrichment_source,rc_enrichment_details,rc_enriched_at,rc_enrichment_error_code,ai_profile_overrides,ai_profile_updated_at,ai_profile_updated_by,voice_queue_source,quick_added_at")
    .eq("id", opportunityId)
    .maybeSingle<ExternalRenewalSourceProfile>();
  if (error || !opportunity) throw new Error("Voice prospect not found.");

  const { data: attempts } = await admin
    .from("external_renewal_voice_attempts")
    .select("id,opportunity_id,provider_attempt_id,provider_interaction_id,provider_campaign_id,provider_cohort_id,submission_status,connectivity_status,completion_status,retry_attempt,duration_seconds,started_at,ended_at,call_disposition,customer_interest,follow_up_required,follow_up_at,customer_objection,call_summary,cohort_context,created_at,updated_at")
    .eq("opportunity_id", opportunityId)
    .order("created_at", { ascending: false })
    .returns<VoiceAttemptDetail[]>();

  const attemptIds = (attempts ?? []).map((item) => item.id);
  let events: VoiceAttemptEventDetail[] = [];
  if (attemptIds.length) {
    const { data } = await admin
      .from("external_renewal_voice_attempt_events")
      .select("id,voice_attempt_id,provider_attempt_id,connectivity_status,completion_status,next_action_status,failure_reason,retry_attempt,duration_seconds,started_at,ended_at,created_at")
      .in("voice_attempt_id", attemptIds)
      .order("created_at", { ascending: false })
      .returns<VoiceAttemptEventDetail[]>();
    events = data ?? [];
  }

  return {
    opportunity,
    baseline: baselineExternalRenewalAiProfile(opportunity),
    effective: effectiveExternalRenewalAiProfile(opportunity),
    attempts: attempts ?? [],
    events,
  };
}

export async function saveVoiceProspectAiProfile({
  opportunityId,
  updatedBy,
  candidate,
}: {
  opportunityId: string;
  updatedBy: string;
  candidate: ExternalRenewalAiProfile;
}) {
  const admin = createSupabaseAdminClient();
  const { data: row, error } = await admin
    .from("external_renewal_opportunities")
    .select("id,batch_id,partner_id,account_name,customer_name,contact_name,mobile,address,city,state,postal_code,chassis_no,registration_no,vehicle_make,vehicle_model,vehicle_lob,invoice_date,policy_start_date,policy_end_date,current_insurer,current_policy_no,opportunity_status,rc_enrichment_status,rc_enrichment_source,rc_enrichment_details,rc_enriched_at,rc_enrichment_error_code,ai_profile_overrides,ai_profile_updated_at,ai_profile_updated_by,voice_queue_source,quick_added_at")
    .eq("id", opportunityId)
    .maybeSingle<ExternalRenewalSourceProfile>();
  if (error || !row) throw new Error("Voice prospect not found.");

  const baseline = baselineExternalRenewalAiProfile(row);
  const currentEffective = effectiveExternalRenewalAiProfile(row);
  const overrides = compactAiProfileOverrides(baseline, candidate);
  const registrationChanged = (currentEffective.registrationNumber ?? "") !== (candidate.registrationNumber ?? "");

  const update: Record<string, unknown> = {
    ai_profile_overrides: overrides,
    ai_profile_updated_at: new Date().toISOString(),
    ai_profile_updated_by: updatedBy,
    updated_at: new Date().toISOString(),
  };

  if (registrationChanged) {
    update.rc_enrichment_status = "not_fetched";
    update.rc_enrichment_source = null;
    update.rc_enrichment_details = {};
    update.rc_enriched_at = null;
    update.rc_enrichment_error_code = null;
  }

  const { error: updateError } = await admin.from("external_renewal_opportunities").update(update).eq("id", opportunityId);
  if (updateError) throw new Error("Could not save the AI calling profile.");
}
