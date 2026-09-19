import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase-admin";

const TERMINAL_STATUSES = new Set(["won", "renewed_elsewhere", "invalid_contact", "do_not_contact", "lost"]);
const ACTIVE_ATTEMPT_STATUSES = new Set(["created", "submitted", "queued", "calling"]);
const INITIAL_OUTREACH_STATUSES = new Set(["new", "contact_attempted"]);

export type SarvamQueueReason =
  | "eligible"
  | "missing_mobile"
  | "missing_registration"
  | "needs_rc_enrichment"
  | "rc_enrichment_failed"
  | "terminal"
  | "future_follow_up"
  | "active_attempt"
  | "crm_stage";

export type SarvamQueuePreviewRow = {
  opportunityId: string;
  opportunityStatus: string;
  policyEndDate: string | null;
  nextFollowUpAt: string | null;
  rcEnrichmentStatus: string;
  rcEnrichmentSource: string | null;
  canFetchDetails: boolean;
  reason: SarvamQueueReason;
};

export type SarvamQueuePreview = {
  totalDueWindow: number;
  eligibleCount: number;
  heldCount: number;
  rows: SarvamQueuePreviewRow[];
};

type OpportunityRow = {
  id: string;
  mobile: string | null;
  registration_no: string | null;
  policy_end_date: string | null;
  opportunity_status: string;
  next_follow_up_at: string | null;
  rc_enrichment_status: string | null;
  rc_enrichment_source: string | null;
  ai_profile_overrides: Record<string, unknown> | null;
};

type AttemptRow = {
  opportunity_id: string;
  submission_status: string;
};

function dateOnly(value: Date) {
  return value.toISOString().slice(0, 10);
}

export async function getSarvamProductionQueuePreview(now = new Date()): Promise<SarvamQueuePreview> {
  const admin = createSupabaseAdminClient();
  const start = dateOnly(now);
  const end = new Date(now);
  end.setUTCDate(end.getUTCDate() + 30);

  const { data: opportunities, error: opportunityError } = await admin
    .from("external_renewal_opportunities")
    .select("id,mobile,registration_no,policy_end_date,opportunity_status,next_follow_up_at,rc_enrichment_status,rc_enrichment_source,ai_profile_overrides")
    .eq("is_active", true)
    .gte("policy_end_date", start)
    .lte("policy_end_date", dateOnly(end))
    .order("policy_end_date", { ascending: true })
    .limit(200)
    .returns<OpportunityRow[]>();

  if (opportunityError) {
    throw new Error("Production voice queue preview is unavailable.");
  }

  const opportunityIds = (opportunities ?? []).map((row) => row.id);
  const activeAttemptIds = new Set<string>();

  if (opportunityIds.length) {
    const { data: attempts, error: attemptError } = await admin
      .from("external_renewal_voice_attempts")
      .select("opportunity_id,submission_status")
      .in("opportunity_id", opportunityIds)
      .in("submission_status", [...ACTIVE_ATTEMPT_STATUSES])
      .returns<AttemptRow[]>();

    if (attemptError) {
      throw new Error("Production voice queue attempt state is unavailable.");
    }

    for (const attempt of attempts ?? []) activeAttemptIds.add(attempt.opportunity_id);
  }

  const rows = (opportunities ?? []).map<SarvamQueuePreviewRow>((row) => {
    const enrichmentStatus = row.rc_enrichment_status ?? "not_fetched";
    const overrides = row.ai_profile_overrides && typeof row.ai_profile_overrides === "object" ? row.ai_profile_overrides : {};
    const effectiveMobile = Object.prototype.hasOwnProperty.call(overrides, "mobile")
      ? (typeof overrides.mobile === "string" ? overrides.mobile : null)
      : row.mobile;
    const effectiveRegistration = Object.prototype.hasOwnProperty.call(overrides, "registrationNumber")
      ? (typeof overrides.registrationNumber === "string" ? overrides.registrationNumber : null)
      : row.registration_no;
    const effectivePolicyExpiry = Object.prototype.hasOwnProperty.call(overrides, "policyExpiryDate")
      ? (typeof overrides.policyExpiryDate === "string" ? overrides.policyExpiryDate : null)
      : row.policy_end_date;
    const hasRegistration = Boolean(effectiveRegistration?.trim());
    const otherwiseFetchable =
      Boolean(effectiveMobile?.trim()) &&
      !TERMINAL_STATUSES.has(row.opportunity_status) &&
      !activeAttemptIds.has(row.id) &&
      !(row.next_follow_up_at && new Date(row.next_follow_up_at).getTime() > now.getTime()) &&
      INITIAL_OUTREACH_STATUSES.has(row.opportunity_status);

    let reason: SarvamQueueReason = "eligible";

    if (!effectiveMobile?.trim()) reason = "missing_mobile";
    else if (TERMINAL_STATUSES.has(row.opportunity_status)) reason = "terminal";
    else if (activeAttemptIds.has(row.id)) reason = "active_attempt";
    else if (row.next_follow_up_at && new Date(row.next_follow_up_at).getTime() > now.getTime()) reason = "future_follow_up";
    else if (!INITIAL_OUTREACH_STATUSES.has(row.opportunity_status)) reason = "crm_stage";
    else if (!hasRegistration) reason = "missing_registration";
    else if (enrichmentStatus === "failed" || enrichmentStatus === "no_data") reason = "rc_enrichment_failed";
    else if (enrichmentStatus !== "ready") reason = "needs_rc_enrichment";

    return {
      opportunityId: row.id,
      opportunityStatus: row.opportunity_status,
      policyEndDate: effectivePolicyExpiry,
      nextFollowUpAt: row.next_follow_up_at,
      rcEnrichmentStatus: enrichmentStatus,
      rcEnrichmentSource: row.rc_enrichment_source,
      canFetchDetails: hasRegistration && otherwiseFetchable,
      reason,
    };
  });

  const eligibleCount = rows.filter((row) => row.reason === "eligible").length;

  return {
    totalDueWindow: rows.length,
    eligibleCount,
    heldCount: rows.length - eligibleCount,
    rows,
  };
}
