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
  source_payload: Record<string, unknown> | null;
  voice_queue_source: "import" | "it_quick_add" | "it_campaign" | null;
};

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
    .select("id,batch_id,partner_id,is_active,mobile,opportunity_status,customer_name,contact_name,account_name,vehicle_make,vehicle_model,registration_no,chassis_no,current_insurer,current_policy_no,policy_end_date,rc_enrichment_status,rc_enrichment_details,ai_profile_overrides,source_payload,voice_queue_source")
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
  const sourcePayload = opportunity.source_payload && typeof opportunity.source_payload === "object" ? opportunity.source_payload : {};
  const campaignContexts =
    sourcePayload.voice_campaign_contexts && typeof sourcePayload.voice_campaign_contexts === "object"
      ? (sourcePayload.voice_campaign_contexts as Record<string, unknown>)
      : {};
  const rawCampaignContext = voiceCampaignId ? campaignContexts[voiceCampaignId] : null;
  const campaignContext = rawCampaignContext && typeof rawCampaignContext === "object"
    ? (rawCampaignContext as Record<string, unknown>)
    : {};
  const campaignText = (key: string) => {
    const value = campaignContext[key];
    return typeof value === "string" || typeof value === "number" ? String(value).replace(/\s+/g, " ").trim() || null : null;
  };
  const campaignVehicles = Array.isArray(campaignContext.vehicles) ? campaignContext.vehicles : [];

  const customerName = overrideText(
    overrides,
    "customerName",
    campaignText("customerName") || opportunity.customer_name?.trim() || opportunity.contact_name?.trim() || opportunity.account_name?.trim() || null,
  );
  const mobile = overrideText(overrides, "mobile", opportunity.mobile);
  const vehicleMake = overrideText(overrides, "manufacturer", campaignText("manufacturer") ?? enrichment.manufacturer ?? opportunity.vehicle_make);
  const vehicleModel = overrideText(overrides, "model", campaignText("model") ?? enrichment.model ?? opportunity.vehicle_model);
  const registrationNumber = overrideText(overrides, "registrationNumber", enrichment.registrationNumber ?? opportunity.registration_no);
  const chassisNumber = overrideText(overrides, "chassisNumber", enrichment.chassisNumber ?? opportunity.chassis_no);
  const currentInsurer = overrideText(overrides, "insuranceCompany", campaignText("currentInsurer") ?? enrichment.insuranceCompany ?? opportunity.current_insurer);
  const policyNumber = overrideText(overrides, "policyNumber", campaignText("policyNumber") ?? enrichment.policyNumber ?? opportunity.current_policy_no);
  const sourcePolicyExpiryDate =
    opportunity.voice_queue_source === "it_quick_add" ? null : opportunity.policy_end_date;
  const campaignSafePolicyExpiryDate =
    opportunity.voice_queue_source === "it_campaign" ? null : sourcePolicyExpiryDate;
  const policyExpiryDate = overrideText(
    overrides,
    "policyExpiryDate",
    campaignText("policyExpiryDate") ?? enrichment.policyExpiryDate ?? campaignSafePolicyExpiryDate,
  );
  const previousIdv = overrideText(overrides, "previousIdv", null);
  const previousPremium = overrideText(overrides, "previousPremium", null);
  const vehicleMakeModel = [vehicleMake, vehicleModel].filter(Boolean).join(" ").trim() || null;
  const vehicleNumber = registrationNumber || chassisNumber || null;

  const digits = mobile?.replace(/\D/g, "") ?? "";
  if (!/^(?:91)?[6-9][0-9]{9}$/.test(digits)) {
    throw new Error("A valid mobile number is required before starting an AI call.");
  }

  const { data: previousAttempts } = await admin
    .from("external_renewal_voice_attempts")
    .select("call_disposition,customer_interest,customer_objection,call_summary,follow_up_at,connectivity_status,created_at")
    .eq("opportunity_id", opportunity.id)
    .order("created_at", { ascending: false })
    .limit(20)
    .returns<Array<{
      call_disposition: string | null;
      customer_interest: string | null;
      customer_objection: string | null;
      call_summary: string | null;
      follow_up_at: string | null;
      connectivity_status: string | null;
      created_at: string;
    }>>();
  const connectedPrevious = (previousAttempts ?? []).filter((attempt) => attempt.connectivity_status === "connected");
  const lastConnected = connectedPrevious[0] ?? null;

  const expiryDate = policyExpiryDate ? new Date(policyExpiryDate + "T00:00:00+05:30") : null;
  const now = new Date();
  const todayIndia = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
  todayIndia.setHours(0, 0, 0, 0);
  const daysToExpiry = expiryDate && !Number.isNaN(expiryDate.getTime())
    ? Math.ceil((expiryDate.getTime() - todayIndia.getTime()) / 86_400_000)
    : null;
  const renewalBucket = daysToExpiry == null
    ? null
    : daysToExpiry <= 0
      ? "DUE_TODAY"
      : daysToExpiry <= 7
        ? "DUE_1_7"
        : daysToExpiry <= 15
          ? "DUE_8_15"
          : daysToExpiry <= 30
            ? "DUE_16_30"
            : "DUE_31_PLUS";
  const vehicleCount = Number(campaignText("vehicleCount") ?? campaignVehicles.length || 1);
  const vehicleContextSummary = campaignVehicles
    .slice(0, 10)
    .map((vehicle) => {
      if (!vehicle || typeof vehicle !== "object") return "";
      const v = vehicle as Record<string, unknown>;
      return [v.registrationNumber, v.model, v.policyExpiryDate].filter(Boolean).map(String).join(" | ");
    })
    .filter(Boolean)
    .join("; ");

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
    campaign_type: campaignText("campaignType"),
    calling_brand: campaignText("callingBrand"),
    vehicle_brand_context: campaignText("vehicleBrandContext"),
    primary_sales_pitch: campaignText("primarySalesPitch"),
    cashless_claim_pitch: campaignText("cashlessClaimPitch"),
    renewal_bucket: renewalBucket,
    days_to_expiry: daysToExpiry,
    vehicle_count: Number.isFinite(vehicleCount) ? vehicleCount : 1,
    vehicle_context_summary: vehicleContextSummary || null,
    current_policy_number: policyNumber,
    repeat_call: connectedPrevious.length > 0,
    previous_connected_call_count: connectedPrevious.length,
    last_call_disposition: lastConnected?.call_disposition ?? null,
    last_call_summary: lastConnected?.call_summary ?? null,
    last_customer_interest: lastConnected?.customer_interest ?? null,
    last_customer_objection: lastConnected?.customer_objection ?? null,
    last_follow_up_time: lastConnected?.follow_up_at ?? null,
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
    campaign_type: cohortContext.campaign_type,
    calling_brand: cohortContext.calling_brand,
    vehicle_brand_context: cohortContext.vehicle_brand_context,
    primary_sales_pitch: cohortContext.primary_sales_pitch,
    cashless_claim_pitch: cohortContext.cashless_claim_pitch,
    renewal_bucket: cohortContext.renewal_bucket,
    days_to_expiry: cohortContext.days_to_expiry,
    vehicle_count: cohortContext.vehicle_count,
    vehicle_context_summary: cohortContext.vehicle_context_summary,
    current_policy_number: cohortContext.current_policy_number,
    repeat_call: cohortContext.repeat_call,
    previous_connected_call_count: cohortContext.previous_connected_call_count,
    last_call_disposition: cohortContext.last_call_disposition,
    last_call_summary: cohortContext.last_call_summary,
    last_customer_interest: cohortContext.last_customer_interest,
    last_customer_objection: cohortContext.last_customer_objection,
    last_follow_up_time: cohortContext.last_follow_up_time,
  };
}
