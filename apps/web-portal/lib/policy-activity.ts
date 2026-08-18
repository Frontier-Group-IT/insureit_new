import { createSupabaseAdminClient } from "@/lib/supabase-admin";

export const POLICY_ACTIVITY_ACTIONS = {
  POLICY_CREATED: "policy_created",
  POLICY_EDITED: "policy_edited",
  POLICY_DOC_UPLOADED: "policy_doc_uploaded",
  POLICY_DOC_REPLACED: "policy_doc_replaced",
  PAYIN_BILLING_ADDED: "payin_billing_added",
  PAYIN_BILLING_UPDATED: "payin_billing_updated",
} as const;

export type PolicyActivityAction = (typeof POLICY_ACTIVITY_ACTIONS)[keyof typeof POLICY_ACTIVITY_ACTIONS];

const ACTION_LABELS: Record<PolicyActivityAction, string> = {
  policy_created: "Policy Created",
  policy_edited: "Policy Edited",
  policy_doc_uploaded: "Policy Doc. Uploaded",
  policy_doc_replaced: "Policy Doc. Replaced",
  payin_billing_added: "Pay-in Billing Added",
  payin_billing_updated: "Pay-in Billing Updated",
};

const TRACKED_ACTIONS = Object.values(POLICY_ACTIVITY_ACTIONS);
const ACTIVITY_TABLE_NAME = "policies";

type AdminClient = ReturnType<typeof createSupabaseAdminClient>;
type AuditRow = { actor_id: string | null; action: string; created_at: string };
type DocumentRow = { uploaded_by: string | null; created_at: string; updated_at: string };
type PayinBillRow = { created_at: string; updated_at: string };
type ProfileRow = { full_name: string | null };

type ActivityCandidate = {
  action: PolicyActivityAction;
  actorId: string | null;
  actorName?: string | null;
  at: string;
};

export type PolicyActivityDisplay = {
  action: string;
  actorName: string;
  at: string;
};

function asTrackedAction(value: string): PolicyActivityAction | null {
  return TRACKED_ACTIONS.includes(value as PolicyActivityAction) ? value as PolicyActivityAction : null;
}

function timestamp(value: string | null | undefined) {
  if (!value) return 0;
  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
}

function materiallyLater(updatedAt: string | null | undefined, createdAt: string | null | undefined) {
  return timestamp(updatedAt) - timestamp(createdAt) > 1000;
}

export async function recordPolicyActivity(
  admin: AdminClient,
  policyId: string,
  actorId: string | null,
  action: PolicyActivityAction,
) {
  const { error } = await admin.from("audit_logs").insert({
    actor_id: actorId,
    action,
    table_name: ACTIVITY_TABLE_NAME,
    record_id: policyId,
  });
  return !error;
}

async function actorName(admin: AdminClient, actorId: string | null) {
  if (!actorId) return null;
  const { data, error } = await admin
    .from("profiles")
    .select("full_name")
    .eq("id", actorId)
    .maybeSingle<ProfileRow>();
  if (error) return null;
  return data?.full_name?.trim() || null;
}

export async function loadLatestPolicyActivity({
  policyId,
  createdBy,
  createdAt,
  updatedAt,
}: {
  policyId: string;
  createdBy: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}): Promise<PolicyActivityDisplay> {
  const admin = createSupabaseAdminClient();
  const candidates: ActivityCandidate[] = [];

  if (createdAt) {
    candidates.push({ action: POLICY_ACTIVITY_ACTIONS.POLICY_CREATED, actorId: null, actorName: createdBy, at: createdAt });
  }
  if (updatedAt && materiallyLater(updatedAt, createdAt)) {
    candidates.push({ action: POLICY_ACTIVITY_ACTIONS.POLICY_EDITED, actorId: null, at: updatedAt });
  }

  const [auditResult, documentResult, payinResult] = await Promise.all([
    admin
      .from("audit_logs")
      .select("actor_id,action,created_at")
      .eq("table_name", ACTIVITY_TABLE_NAME)
      .eq("record_id", policyId)
      .in("action", TRACKED_ACTIONS)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle<AuditRow>(),
    admin
      .from("policy_documents")
      .select("uploaded_by,created_at,updated_at")
      .eq("policy_id", policyId)
      .eq("document_type", "policy_copy")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle<DocumentRow>(),
    admin
      .from("policy_payin_bills")
      .select("created_at,updated_at")
      .eq("policy_id", policyId)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle<PayinBillRow>(),
  ]);

  const auditAction = auditResult.data ? asTrackedAction(auditResult.data.action) : null;
  if (auditResult.data && auditAction) {
    candidates.push({
      action: auditAction,
      actorId: auditResult.data.actor_id,
      at: auditResult.data.created_at,
    });
  }

  const document = documentResult.data;
  if (document?.updated_at || document?.created_at) {
    const replaced = materiallyLater(document.updated_at, document.created_at);
    candidates.push({
      action: replaced ? POLICY_ACTIVITY_ACTIONS.POLICY_DOC_REPLACED : POLICY_ACTIVITY_ACTIONS.POLICY_DOC_UPLOADED,
      actorId: document.uploaded_by,
      at: replaced ? document.updated_at : document.created_at,
    });
  }

  const payin = payinResult.data;
  if (payin?.updated_at || payin?.created_at) {
    const updated = materiallyLater(payin.updated_at, payin.created_at);
    candidates.push({
      action: updated ? POLICY_ACTIVITY_ACTIONS.PAYIN_BILLING_UPDATED : POLICY_ACTIVITY_ACTIONS.PAYIN_BILLING_ADDED,
      actorId: null,
      at: updated ? payin.updated_at : payin.created_at,
    });
  }

  const latest = candidates
    .filter((candidate) => timestamp(candidate.at) > 0)
    .sort((a, b) => timestamp(b.at) - timestamp(a.at))[0];

  if (!latest) {
    return { action: "Activity not recorded", actorName: "Not recorded", at: createdAt || updatedAt || "" };
  }

  const resolvedActor = latest.actorName?.trim() || await actorName(admin, latest.actorId);
  return {
    action: ACTION_LABELS[latest.action],
    actorName: resolvedActor || "Not recorded",
    at: latest.at,
  };
}
