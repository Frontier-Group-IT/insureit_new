import "server-only";

import { createServerSupabaseClient } from "@/lib/auth-server";
import { getPartnerWebSession } from "@/lib/partner-web";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

export type ExternalRenewalVoiceStartContext = {
  attempt_id: string;
  opportunity_id: string;
  mobile: string;
  customer_name: string | null;
  vehicle_make_model: string | null;
  vehicle_number: string | null;
  current_insurer: string | null;
  policy_expiry_date: string | null;
  previous_idv: string | null;
  previous_premium: string | null;
  repeat_call: "yes" | "no";
  previous_connected_call_count: number;
  last_call_date: string | null;
  last_call_disposition: string | null;
  last_customer_interest: string | null;
  last_customer_objection: string | null;
  last_follow_up_time: string | null;
  last_call_summary: string | null;
  previous_conversation_context: string | null;
  opening_line: string;
};

export type ExternalRenewalVoiceLatestAttempt = {
  attempt_id: string;
  submission_status: string;
  connectivity_status: string | null;
  completion_status: string | null;
  call_disposition: string | null;
  customer_interest: string | null;
  follow_up_required: boolean | null;
  follow_up_at: string | null;
  customer_objection: string | null;
  call_summary: string | null;
  duration_seconds: number | null;
  created_at: string;
  updated_at: string;
};

export type ExternalRenewalVoiceWorklistState = {
  opportunity_id: string;
  voice_state: "available" | "queued" | "calling" | "connected" | "interested" | "follow_up" | "human_needed" | "no_answer" | "busy" | "failed" | "needs_details" | "closed";
  submission_status: string | null;
  connectivity_status: string | null;
  call_disposition: string | null;
  follow_up_at: string | null;
  updated_at: string | null;
};

export async function startPartnerExternalRenewalVoiceAttempt(opportunityId: string) {
  await getPartnerWebSession();
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("partner_app_start_external_renewal_voice_attempt", {
    p_opportunity_id: opportunityId,
  });
  if (error || !data) throw new Error(error?.message ?? "Could not start the AI call.");
  return data as ExternalRenewalVoiceStartContext;
}

export async function markExternalRenewalVoiceSubmitted({
  attemptId,
  campaignId,
  cohortId,
  appId,
}: {
  attemptId: string;
  campaignId: string;
  cohortId: string;
  appId?: string | null;
}) {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.rpc("apply_external_renewal_voice_submission", {
    p_attempt_id: attemptId,
    p_provider_campaign_id: campaignId,
    p_provider_cohort_id: cohortId,
    p_provider_app_id: appId ?? null,
  });
  if (error || !data) throw new Error(error?.message ?? "Could not record Sarvam submission.");
  return data;
}

export async function markExternalRenewalVoiceSubmissionFailed(attemptId: string, summary: string) {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.rpc("fail_external_renewal_voice_submission", {
    p_attempt_id: attemptId,
    p_summary: summary.slice(0, 2000),
  });
  if (error || !data) throw new Error(error?.message ?? "Could not record call submission failure.");
  return data;
}

export async function getLatestPartnerExternalRenewalVoiceAttempt(opportunityId: string): Promise<ExternalRenewalVoiceLatestAttempt | null> {
  await getPartnerWebSession();
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("partner_app_external_renewal_voice_latest", {
    p_opportunity_id: opportunityId,
  });
  if (error) {
    // A preview can render before the migration is applied. The existing CRM page
    // must remain usable until the protected schema workflow has run.
    if (/function .* does not exist|could not find the function/i.test(error.message ?? "")) return null;
    throw new Error(error.message || "Could not load AI call status.");
  }
  return (data ?? null) as ExternalRenewalVoiceLatestAttempt | null;
}

export async function getPartnerExternalRenewalVoiceStates(opportunityIds: string[]): Promise<ExternalRenewalVoiceWorklistState[]> {
  if (!opportunityIds.length) return [];
  await getPartnerWebSession();
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("partner_app_external_renewal_voice_states", {
    p_opportunity_ids: opportunityIds,
  });
  if (error) {
    if (/function .* does not exist|could not find the function/i.test(error.message ?? "")) return [];
    throw new Error(error.message || "Could not load AI outreach states.");
  }
  return (data ?? []) as ExternalRenewalVoiceWorklistState[];
}

export type ApplyExternalRenewalVoiceResultInput = {
  attemptId: string;
  providerAttemptId: string;
  providerInteractionId?: string | null;
  providerCampaignId?: string | null;
  providerCohortId?: string | null;
  connectivityStatus?: string | null;
  completionStatus?: string | null;
  nextActionStatus?: string | null;
  failureReason?: string | null;
  retryAttempt?: number | null;
  durationSeconds?: number | null;
  startedAt?: string | null;
  endedAt?: string | null;
  callDisposition?: string | null;
  customerInterest?: string | null;
  followUpRequired?: boolean | null;
  followUpAt?: string | null;
  customerObjection?: string | null;
  callSummary?: string | null;
};

export async function applyExternalRenewalVoiceResult(input: ApplyExternalRenewalVoiceResultInput) {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.rpc("apply_external_renewal_voice_result", {
    p_attempt_id: input.attemptId,
    p_provider_attempt_id: input.providerAttemptId,
    p_provider_interaction_id: input.providerInteractionId ?? null,
    p_provider_campaign_id: input.providerCampaignId ?? null,
    p_provider_cohort_id: input.providerCohortId ?? null,
    p_connectivity_status: input.connectivityStatus ?? null,
    p_completion_status: input.completionStatus ?? null,
    p_next_action_status: input.nextActionStatus ?? null,
    p_failure_reason: input.failureReason ?? null,
    p_retry_attempt: input.retryAttempt ?? 0,
    p_duration_seconds: input.durationSeconds ?? null,
    p_started_at: input.startedAt ?? null,
    p_ended_at: input.endedAt ?? null,
    p_call_disposition: input.callDisposition ?? null,
    p_customer_interest: input.customerInterest ?? null,
    p_follow_up_required: input.followUpRequired ?? null,
    p_follow_up_at: input.followUpAt ?? null,
    p_customer_objection: input.customerObjection ?? null,
    p_call_summary: input.callSummary ?? null,
  });
  if (error || !data) throw new Error(error?.message ?? "Could not apply Sarvam call result.");
  return data;
}
