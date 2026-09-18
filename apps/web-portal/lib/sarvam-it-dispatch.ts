import "server-only";

import type { ExternalRenewalVoiceStartContext } from "@/lib/partner-external-renewal-voice";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

const TERMINAL_STATUSES = new Set(["won", "renewed_elsewhere", "invalid_contact", "do_not_contact", "lost", "duplicate"]);
const ACTIVE_ATTEMPT_STATUSES = ["created", "submitted", "queued", "calling"];

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
  policy_end_date: string | null;
};

export async function startItSuperUserExternalRenewalVoiceAttempt({
  opportunityId,
  requestedByAuthUserId,
}: {
  opportunityId: string;
  requestedByAuthUserId: string;
}): Promise<ExternalRenewalVoiceStartContext> {
  const admin = createSupabaseAdminClient();

  const { data: opportunity, error: opportunityError } = await admin
    .from("external_renewal_opportunities")
    .select("id,batch_id,partner_id,is_active,mobile,opportunity_status,customer_name,contact_name,account_name,vehicle_make,vehicle_model,registration_no,chassis_no,current_insurer,policy_end_date")
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

  if (batchError || !batch || batch.status !== "published" || !opportunity.is_active) {
    throw new Error("This opportunity is not available for AI calling.");
  }

  if (TERMINAL_STATUSES.has(opportunity.opportunity_status)) {
    throw new Error("This opportunity is already closed or suppressed.");
  }

  if (!opportunity.mobile?.replace(/\D/g, "")) {
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

  const { data: attempt, error: attemptError } = await admin
    .from("external_renewal_voice_attempts")
    .insert({
      opportunity_id: opportunity.id,
      partner_id: opportunity.partner_id,
      requested_by_auth_user_id: requestedByAuthUserId,
    })
    .select("id")
    .single<{ id: string }>();

  if (attemptError || !attempt) {
    if (/external_renewal_voice_one_active_attempt_uidx|duplicate key/i.test(attemptError?.message ?? "")) {
      throw new Error("An AI call is already active for this opportunity.");
    }
    throw new Error("Could not create the AI call attempt.");
  }

  const customerName =
    opportunity.customer_name?.trim() ||
    opportunity.contact_name?.trim() ||
    opportunity.account_name?.trim() ||
    null;
  const vehicleMakeModel = [opportunity.vehicle_make, opportunity.vehicle_model].filter(Boolean).join(" ").trim() || null;
  const vehicleNumber = opportunity.registration_no?.trim() || opportunity.chassis_no?.trim() || null;

  return {
    attempt_id: attempt.id,
    opportunity_id: opportunity.id,
    mobile: opportunity.mobile,
    customer_name: customerName,
    vehicle_make_model: vehicleMakeModel,
    vehicle_number: vehicleNumber,
    current_insurer: opportunity.current_insurer,
    policy_expiry_date: opportunity.policy_end_date,
    previous_idv: null,
    previous_premium: null,
  };
}
