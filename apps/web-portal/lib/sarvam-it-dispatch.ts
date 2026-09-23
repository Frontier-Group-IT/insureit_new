import "server-only";

import type { ExternalRenewalVoiceStartContext } from "@/lib/partner-external-renewal-voice";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

const TERMINAL_STATUSES = new Set(["won", "renewed_elsewhere", "invalid_contact", "do_not_contact", "lost", "duplicate"]);
const ACTIVE_ATTEMPT_STATUSES = ["created", "submitted", "queued", "calling"];

type RcEnrichmentDetails = {
  registrationNumber?: string | null;
  manufacturer?: string | null;
  model?: string | null;
  chassisNumber?: string | null;
  insuranceCompany?: string | null;
  policyNumber?: string | null;
  policyExpiryDate?: string | null;
};

type PreviousConnectedAttemptRow = {
  call_disposition: string | null;
  customer_interest: string | null;
  customer_objection: string | null;
  call_summary: string | null;
  follow_up_at: string | null;
  ended_at: string | null;
  created_at: string;
};

type OpportunityRow = {
  id: string;
  batch_id: string;
  partner_id: string;
  is_active: boolean;
  mobile: string | null;
  opportunity_status: string;
  customer_name: string | null;
  contact_name: string | null;
  account_name: string | null;
  vehicle_make: string | null;
  vehicle_model: string | null;
  registration_no: string | null;
  chassis_no: string | null;
  current_insurer: string | null;
  current_policy_no: string | null;
  policy_end_date: string | null;
  rc_enrichment_status: string | null;
  rc_enrichment_details: RcEnrichmentDetails | null;
  ai_profile_overrides: Record<string, unknown> | null;
  voice_queue_source: "import" | "it_quick_add" | "it_campaign" | null;
};

function firstName(value: string | null) {
  const normalized = value?.trim().replace(/\s+/g, " ");
  return normalized ? normalized.split(" ")[0] : null;
}

function dateForSpeech(value: string | null) {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(parsed);
}

function callOpening({
  customerName,
}: {
  customerName: string | null;
}) {
  const shortName = firstName(customerName);
  return shortName
    ? `Namaste ${shortName} ji, main INSUREIT se bol raha hoon.`
    : "Namaste ji, main INSUREIT se bol raha hoon.";
}

function openingFollowUp({
  vehicleMakeModel,
  previous,
}: {
  vehicleMakeModel: string | null;
  previous: PreviousConnectedAttemptRow[];
}) {
  if (!previous.length) {
    return vehicleMakeModel
      ? `Aapki ${vehicleMakeModel} ki renewal aa rahi hai—abhi ek minute hai?`
      : "Policy renewal ke regarding call hai—abhi ek minute hai?";
  }

  const last = previous[0];
  if (last.call_disposition === "follow_up") {
    return "Pichli baar aapne baad mein baat karne ko kaha tha—abhi convenient hai?";
  }
  if (last.call_disposition === "quote_requested") {
    return "Pichli baar quotation options ki baat hui thi—usi ko continue karein?";
  }
  if (last.call_disposition === "interested") {
    return "Pichli baar renewal requirements discuss hui thi—usi ko continue karein?";
  }
  if (last.call_disposition === "human_assistance") {
    return "Pichli baar aapne human assistance prefer ki thi—usi discussion ko continue karein?";
  }
  return "Pichli baar renewal par baat hui thi—usi ko continue karein?";
}
function buildPreviousConversationContext(previous: PreviousConnectedAttemptRow[]) {
  if (!previous.length) return null;

  return previous.slice(0, 3).map((attempt, index) => {
    const parts = [
      attempt.call_summary?.trim() || null,
      attempt.customer_objection?.trim() ? `Objection/concern: ${attempt.customer_objection.trim()}` : null,
      attempt.follow_up_at ? `Follow-up requested: ${dateForSpeech(attempt.follow_up_at) ?? attempt.follow_up_at}` : null,
      attempt.call_disposition ? `Outcome: ${attempt.call_disposition}` : null,
      attempt.customer_interest ? `Interest: ${attempt.customer_interest}` : null,
    ].filter(Boolean);
    return `Previous connected call ${index + 1}: ${parts.join(". ")}`;
  }).join("\n");
}

function overrideText(overrides: Record<string, unknown>, key: string, fallback: string | null | undefined) {
  if (!Object.prototype.hasOwnProperty.call(overrides, key)) return fallback?.trim() || null;
  const value = overrides[key];
  if (typeof value !== "string" && typeof value !== "number") return null;
  const next = String(value).replace(/\s+/g, " ").trim();
  return next || null;
}

export async function startItSuperUserExternalRenewalVoiceAttempt({
  opportunityId,
  requestedByAuthUserId,
  voiceCampaignId = null,
}: {
  opportunityId: string;
  requestedByAuthUserId: string;
  voiceCampaignId?: string | null;
}): Promise<ExternalRenewalVoiceStartContext> {
  const admin = createSupabaseAdminClient();

  const { data: opportunity, error: opportunityError } = await admin
    .from("external_renewal_opportunities")
    .select("id,batch_id,partner_id,is_active,mobile,opportunity_status,customer_name,contact_name,account_name,vehicle_make,vehicle_model,registration_no,chassis_no,current_insurer,current_policy_no,policy_end_date,rc_enrichment_status,rc_enrichment_details,ai_profile_overrides,voice_queue_source")
    .eq("id", opportunityId)
    .maybeSingle<OpportunityRow>();

  if (opportunityError || !opportunity) {
    throw new Error("External renewal opportunity is unavailable.");
  }

  const { data: batch, error: batchError } = await admin
    .from("external_renewal_import_batches")
    .select("status")
    .eq("id", opportunity.batch_id)
    .maybeSingle<{ status: string }>();

  const batchAllowed =
    batch?.status === "published" ||
    ((opportunity.voice_queue_source === "it_quick_add" || opportunity.voice_queue_source === "it_campaign") && batch?.status === "validated");

  if (batchError || !batch || !batchAllowed || !opportunity.is_active) {
    throw new Error("This opportunity is not available for AI calling.");
  }

  if (TERMINAL_STATUSES.has(opportunity.opportunity_status)) {
    throw new Error("This opportunity is already closed or suppressed.");
  }

  if (opportunity.rc_enrichment_status !== "ready") {
    throw new Error("Fetch RC details before starting the AI call.");
  }

  const enrichment = opportunity.rc_enrichment_details ?? {};
  const overrides = opportunity.ai_profile_overrides ?? {};

  const customerName = overrideText(
    overrides,
    "customerName",
    opportunity.customer_name?.trim() || opportunity.contact_name?.trim() || opportunity.account_name?.trim() || null,
  );
  const mobile = overrideText(overrides, "mobile", opportunity.mobile);
  const vehicleMake = overrideText(overrides, "manufacturer", enrichment.manufacturer ?? opportunity.vehicle_make);
  const vehicleModel = overrideText(overrides, "model", enrichment.model ?? opportunity.vehicle_model);
  const registrationNumber = overrideText(overrides, "registrationNumber", enrichment.registrationNumber ?? opportunity.registration_no);
  const chassisNumber = overrideText(overrides, "chassisNumber", enrichment.chassisNumber ?? opportunity.chassis_no);
  const currentInsurer = overrideText(overrides, "insuranceCompany", enrichment.insuranceCompany ?? opportunity.current_insurer);
  const policyNumber = overrideText(overrides, "policyNumber", enrichment.policyNumber ?? opportunity.current_policy_no);
  const sourcePolicyExpiryDate =
    opportunity.voice_queue_source === "it_quick_add" ? null : opportunity.policy_end_date;
  const campaignSafePolicyExpiryDate =
    opportunity.voice_queue_source === "it_campaign" ? null : sourcePolicyExpiryDate;
  const policyExpiryDate = overrideText(
    overrides,
    "policyExpiryDate",
    enrichment.policyExpiryDate ?? campaignSafePolicyExpiryDate,
  );
  const previousIdv = overrideText(overrides, "previousIdv", null);
  const previousPremium = overrideText(overrides, "previousPremium", null);
  const vehicleMakeModel = [vehicleMake, vehicleModel].filter(Boolean).join(" ").trim() || null;
  const vehicleNumber = registrationNumber || chassisNumber || null;

  const digits = mobile?.replace(/\D/g, "") ?? "";
  if (!/^(?:91)?[6-9][0-9]{9}$/.test(digits)) {
    throw new Error("A valid mobile number is required before starting an AI call.");
  }

  const { data: activeAttempt, error: activeAttemptError } = await admin
    .from("external_renewal_voice_attempts")
    .select("id")
    .eq("opportunity_id", opportunity.id)
    .in("submission_status", ACTIVE_ATTEMPT_STATUSES)
    .limit(1)
    .maybeSingle<{ id: string }>();

  if (activeAttemptError) {
    throw new Error("Could not verify the current AI call state.");
  }
  if (activeAttempt) {
    throw new Error("An AI call is already active for this opportunity.");
  }

  const { data: previousConnectedAttempts, error: previousAttemptError } = await admin
    .from("external_renewal_voice_attempts")
    .select("call_disposition,customer_interest,customer_objection,call_summary,follow_up_at,ended_at,created_at")
    .eq("opportunity_id", opportunity.id)
    .eq("connectivity_status", "connected")
    .order("created_at", { ascending: false })
    .limit(5)
    .returns<PreviousConnectedAttemptRow[]>();

  if (previousAttemptError) {
    throw new Error("Could not load the customer's previous AI conversation context.");
  }

  const previous = previousConnectedAttempts ?? [];
  const repeatCall = previous.length > 0 ? "yes" : "no";
  const last = previous[0] ?? null;
  const lastCallDate = dateForSpeech(last?.ended_at ?? last?.created_at ?? null);
  const previousConversationContext = buildPreviousConversationContext(previous);
  const openingLine = callOpening({ customerName });
  const openingFollowUp = openingFollowUp({
    vehicleMakeModel,
    previous,
  });

  const cohortContext = {
    customer_name: customerName,
    mobile,
    vehicle_make_model: vehicleMakeModel,
    vehicle_number: vehicleNumber,
    current_insurer: currentInsurer,
    policy_number: policyNumber,
    policy_expiry_date: policyExpiryDate,
    previous_idv: previousIdv,
    previous_premium: previousPremium,
    repeat_call: repeatCall,
    previous_connected_call_count: previous.length,
    last_call_date: lastCallDate,
    last_call_disposition: last?.call_disposition ?? null,
    last_customer_interest: last?.customer_interest ?? null,
    last_customer_objection: last?.customer_objection ?? null,
    last_follow_up_time: last?.follow_up_at ?? null,
    last_call_summary: last?.call_summary ?? null,
    previous_conversation_context: previousConversationContext,
    opening_line: openingLine,
    opening_follow_up: openingFollowUp,
  };

  const { data: attempt, error: attemptError } = await admin
    .from("external_renewal_voice_attempts")
    .insert({
      opportunity_id: opportunity.id,
      partner_id: opportunity.partner_id,
      requested_by_auth_user_id: requestedByAuthUserId,
      voice_campaign_id: voiceCampaignId,
      cohort_context: cohortContext,
    })
    .select("id")
    .single<{ id: string }>();

  if (attemptError || !attempt) {
    if (/external_renewal_voice_one_active_attempt_uidx|duplicate key/i.test(attemptError?.message ?? "")) {
      throw new Error("An AI call is already active for this opportunity.");
    }
    throw new Error("Could not create the AI call attempt.");
  }

  return {
    attempt_id: attempt.id,
    opportunity_id: opportunity.id,
    mobile: mobile!,
    customer_name: customerName,
    vehicle_make_model: vehicleMakeModel,
    vehicle_number: vehicleNumber,
    current_insurer: currentInsurer,
    policy_expiry_date: policyExpiryDate,
    previous_idv: previousIdv,
    previous_premium: previousPremium,
    repeat_call: repeatCall,
    previous_connected_call_count: previous.length,
    last_call_date: lastCallDate,
    last_call_disposition: last?.call_disposition ?? null,
    last_customer_interest: last?.customer_interest ?? null,
    last_customer_objection: last?.customer_objection ?? null,
    last_follow_up_time: last?.follow_up_at ?? null,
    last_call_summary: last?.call_summary ?? null,
    previous_conversation_context: previousConversationContext,
    opening_line: openingLine,
    opening_follow_up: openingFollowUp,
  };
}
