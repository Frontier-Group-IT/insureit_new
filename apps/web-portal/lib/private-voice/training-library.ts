import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { redactTrainingText } from "@/lib/private-voice/training-redaction";

const SOURCE_TYPE = "historical_call";
const DEFAULT_STAGE_LIMIT = 200;
const MAX_STAGE_LIMIT = 500;

const LOW_SIGNAL_PATTERNS = [
  "did not respond",
  "not audible",
  "poor audio",
  "connectivity issues without any response",
  "call ended before",
  "only responded with greetings",
  "non-responsive",
  "no meaningful interaction",
];

type HistoricalAttempt = {
  id: string;
  opportunity_id: string;
  voice_campaign_id: string | null;
  provider: string | null;
  submission_status: string | null;
  connectivity_status: string | null;
  completion_status: string | null;
  duration_seconds: number | string | null;
  call_disposition: string | null;
  customer_interest: string | null;
  follow_up_required: boolean | null;
  follow_up_at: string | null;
  customer_objection: string | null;
  call_summary: string | null;
  cohort_context: Record<string, unknown> | null;
  created_at: string;
};

type OpportunityIdentity = {
  id: string;
  customer_name: string | null;
  mobile: string | null;
  registration_no: string | null;
  rc_enrichment_details: Record<string, unknown> | null;
};

type CuratedExample = {
  id: string;
  split: "training" | "validation" | "test" | "excluded" | null;
  status: "draft" | "reviewed" | "approved" | "excluded";
  target_outcome: Record<string, unknown> | null;
  quality_labels: Record<string, unknown> | null;
  created_at: string;
};

function stableBucket(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash >>> 0) % 100;
}

function splitFor(reference: string): "training" | "validation" | "test" {
  const bucket = stableBucket(reference);
  if (bucket < 70) return "training";
  if (bucket < 85) return "validation";
  return "test";
}

function textLooksLowSignal(summary: string, disposition: string | null, interest: string | null) {
  if (disposition !== "no_decision" || (interest && interest !== "unknown")) return false;
  const normalized = summary.toLowerCase();
  return LOW_SIGNAL_PATTERNS.some((pattern) => normalized.includes(pattern));
}

function durationBucket(value: number | string | null) {
  const seconds = Number(value ?? 0);
  if (!Number.isFinite(seconds) || seconds <= 0) return "unknown";
  if (seconds < 30) return "under_30s";
  if (seconds < 60) return "30_59s";
  if (seconds < 120) return "60_119s";
  return "120s_plus";
}

function safeContext(attempt: HistoricalAttempt, identity?: OpportunityIdentity) {
  const cohort = attempt.cohort_context ?? {};
  const enrichment = identity?.rc_enrichment_details ?? {};
  return {
    source_provider: attempt.provider ?? "unknown",
    source_campaign_id: attempt.voice_campaign_id,
    renewal_bucket: cohort.renewal_bucket ?? null,
    days_to_expiry: cohort.days_to_expiry ?? null,
    repeat_call: cohort.repeat_call ?? false,
    previous_connected_call_count: cohort.previous_connected_call_count ?? 0,
    vehicle_manufacturer: enrichment.manufacturer ?? null,
    vehicle_model: enrichment.model ?? null,
    duration_bucket: durationBucket(attempt.duration_seconds),
  };
}

async function exactCount(
  table: "external_renewal_voice_attempts" | "private_voice_training_examples",
  // Supabase's generated query-builder type differs by table at runtime; keep the small shared filter helper local.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  configure: (query: any) => any,
) {
  const admin = createSupabaseAdminClient();
  const query = configure(admin.from(table).select("id", { count: "exact", head: true }));
  const { count, error } = await query;
  if (error) throw new Error(`Could not count ${table}.`);
  return count ?? 0;
}

export async function getTrainingLibraryOverview() {
  const admin = createSupabaseAdminClient();

  const [sourceTotal, eligibleSource, stagedTotal, training, validation, test, excluded] = await Promise.all([
    exactCount("external_renewal_voice_attempts", (query) => query),
    exactCount("external_renewal_voice_attempts", (query) =>
      query
        .eq("submission_status", "completed")
        .eq("connectivity_status", "connected")
        .eq("completion_status", "completed")
        .not("call_summary", "is", null)
        .not("call_disposition", "is", null)
        .gte("duration_seconds", 20),
    ),
    exactCount("private_voice_training_examples", (query) => query.eq("source_type", SOURCE_TYPE)),
    exactCount("private_voice_training_examples", (query) => query.eq("source_type", SOURCE_TYPE).eq("split", "training")),
    exactCount("private_voice_training_examples", (query) => query.eq("source_type", SOURCE_TYPE).eq("split", "validation")),
    exactCount("private_voice_training_examples", (query) => query.eq("source_type", SOURCE_TYPE).eq("split", "test")),
    exactCount("private_voice_training_examples", (query) => query.eq("source_type", SOURCE_TYPE).eq("split", "excluded")),
  ]);

  const { data: recent, error: recentError } = await admin
    .from("private_voice_training_examples")
    .select("id,split,status,target_outcome,quality_labels,created_at")
    .eq("source_type", SOURCE_TYPE)
    .order("created_at", { ascending: false })
    .limit(8)
    .returns<CuratedExample[]>();

  if (recentError) throw new Error("Could not load the private training library preview.");

  return {
    sourceTotal,
    eligibleSource,
    autoExcludedSource: Math.max(sourceTotal - eligibleSource, 0),
    stagedTotal,
    splits: { training, validation, test, excluded },
    recent: recent ?? [],
    rawTranscriptAvailable: false,
  };
}

export async function stageHistoricalTrainingCandidates(limit = DEFAULT_STAGE_LIMIT) {
  const admin = createSupabaseAdminClient();
  const safeLimit = Math.max(1, Math.min(Number.isFinite(limit) ? Math.trunc(limit) : DEFAULT_STAGE_LIMIT, MAX_STAGE_LIMIT));

  const { data: attempts, error: attemptsError } = await admin
    .from("external_renewal_voice_attempts")
    .select(
      "id,opportunity_id,voice_campaign_id,provider,submission_status,connectivity_status,completion_status,duration_seconds,call_disposition,customer_interest,follow_up_required,follow_up_at,customer_objection,call_summary,cohort_context,created_at",
    )
    .eq("submission_status", "completed")
    .eq("connectivity_status", "connected")
    .eq("completion_status", "completed")
    .not("call_summary", "is", null)
    .not("call_disposition", "is", null)
    .gte("duration_seconds", 20)
    .order("created_at", { ascending: true })
    .limit(safeLimit * 3)
    .returns<HistoricalAttempt[]>();

  if (attemptsError) throw new Error("Could not scan historical Voice AI calls.");
  const candidates = (attempts ?? []).filter(
    (attempt) =>
      attempt.call_summary &&
      !textLooksLowSignal(attempt.call_summary, attempt.call_disposition, attempt.customer_interest),
  );

  const references = candidates.map((attempt) => attempt.id);
  if (references.length === 0) return { staged: 0, skippedExisting: 0, screenedOut: (attempts ?? []).length };

  const { data: existing, error: existingError } = await admin
    .from("private_voice_training_examples")
    .select("source_reference")
    .eq("source_type", SOURCE_TYPE)
    .in("source_reference", references)
    .returns<Array<{ source_reference: string | null }>>();
  if (existingError) throw new Error("Could not check existing training examples.");

  const existingReferences = new Set((existing ?? []).map((row) => row.source_reference).filter(Boolean));
  const selected = candidates.filter((attempt) => !existingReferences.has(attempt.id)).slice(0, safeLimit);

  const opportunityIds = [...new Set(selected.map((attempt) => attempt.opportunity_id).filter(Boolean))];
  const { data: identities, error: identitiesError } = opportunityIds.length
    ? await admin
        .from("external_renewal_opportunities")
        .select("id,customer_name,mobile,registration_no,rc_enrichment_details")
        .in("id", opportunityIds)
        .returns<OpportunityIdentity[]>()
    : { data: [] as OpportunityIdentity[], error: null };
  if (identitiesError) throw new Error("Could not resolve privacy-redaction context.");

  const identityByOpportunity = new Map((identities ?? []).map((row) => [row.id, row]));
  const rows = selected.map((attempt) => {
    const identity = identityByOpportunity.get(attempt.opportunity_id);
    const split = splitFor(attempt.id);
    return {
      source_type: SOURCE_TYPE,
      source_reference: attempt.id,
      split,
      status: "draft",
      context: safeContext(attempt, identity),
      conversation: [],
      target_outcome: {
        disposition: attempt.call_disposition,
        customer_interest: attempt.customer_interest,
        customer_objection: redactTrainingText(attempt.customer_objection, identity),
        follow_up_required: attempt.follow_up_required,
        follow_up_at_present: Boolean(attempt.follow_up_at),
        conversation_summary: redactTrainingText(attempt.call_summary, identity),
      },
      quality_labels: {
        source_quality: "eligible",
        raw_transcript_available: false,
        derived_from_structured_summary: true,
        pii_redaction_applied: true,
        permanent_test_candidate: split === "test",
      },
    };
  });

  if (rows.length > 0) {
    const { error: insertError } = await admin.from("private_voice_training_examples").insert(rows);
    if (insertError) throw new Error("Could not stage private training examples.");
  }

  return {
    staged: rows.length,
    skippedExisting: candidates.length - selected.length,
    screenedOut: (attempts ?? []).length - candidates.length,
  };
}
