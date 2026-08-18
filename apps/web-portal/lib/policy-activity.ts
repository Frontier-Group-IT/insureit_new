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
type AuditRow = { id: string; actor_id: string | null; action: string; created_at: string };
type DocumentRow = { uploaded_by: string | null; created_at: string; updated_at: string };
type ProfileRow = { id: string; full_name: string | null };

type ActivityCandidate = {
  id: string;
  action: PolicyActivityAction;
  actorId: string | null;
  actorName?: string | null;
  at: string;
};

export type PolicyActivityDisplay = {
  id: string;
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

export async function loadPolicyActivityHistory({
  policyId,
  createdBy,
  createdAt,
  updatedAt,
}: {
  policyId: string;
  createdBy: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}): Promise<PolicyActivityDisplay[]> {
  const admin = createSupabaseAdminClient();

  const [auditResult, documentResult] = await Promise.all([
    admin
      .from("audit_logs")
      .select("id,actor_id,action,created_at")
      .eq("table_name", ACTIVITY_TABLE_NAME)
      .eq("record_id", policyId)
      .in("action", TRACKED_ACTIONS)
      .order("created_at", { ascending: false })
      .returns<AuditRow[]>(),
    admin
      .from("policy_documents")
      .select("uploaded_by,created_at,updated_at")
      .eq("policy_id", policyId)
      .eq("document_type", "policy_copy")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle<DocumentRow>(),
  ]);

  const auditRows = auditResult.data ?? [];
  const candidates: ActivityCandidate[] = [];
  const auditActions = new Set<PolicyActivityAction>();

  for (const row of auditRows) {
    const action = asTrackedAction(row.action);
    if (!action) continue;
    auditActions.add(action);
    candidates.push({
      id: `audit:${row.id}`,
      action,
      actorId: row.actor_id,
      at: row.created_at,
    });
  }

  if (createdAt && !auditActions.has(POLICY_ACTIVITY_ACTIONS.POLICY_CREATED)) {
    candidates.push({
      id: "derived:policy-created",
      action: POLICY_ACTIVITY_ACTIONS.POLICY_CREATED,
      actorId: null,
      actorName: createdBy,
      at: createdAt,
    });
  }

  if (
    updatedAt
    && materiallyLater(updatedAt, createdAt)
    && !auditActions.has(POLICY_ACTIVITY_ACTIONS.POLICY_EDITED)
  ) {
    candidates.push({
      id: "derived:legacy-policy-edited",
      action: POLICY_ACTIVITY_ACTIONS.POLICY_EDITED,
      actorId: null,
      at: updatedAt,
    });
  }

  const hasDocumentAudit = auditActions.has(POLICY_ACTIVITY_ACTIONS.POLICY_DOC_UPLOADED)
    || auditActions.has(POLICY_ACTIVITY_ACTIONS.POLICY_DOC_REPLACED);
  const document = documentResult.data;
  if (!hasDocumentAudit && (document?.updated_at || document?.created_at)) {
    const replaced = materiallyLater(document.updated_at, document.created_at);
    candidates.push({
      id: "derived:legacy-policy-document",
      action: replaced ? POLICY_ACTIVITY_ACTIONS.POLICY_DOC_REPLACED : POLICY_ACTIVITY_ACTIONS.POLICY_DOC_UPLOADED,
      actorId: document.uploaded_by,
      at: replaced ? document.updated_at : document.created_at,
    });
  }

  const actorIds = Array.from(new Set(candidates.map((candidate) => candidate.actorId).filter((id): id is string => Boolean(id))));
  const actorNames = new Map<string, string>();

  if (actorIds.length) {
    const { data: profiles } = await admin
      .from("profiles")
      .select("id,full_name")
      .in("id", actorIds)
      .returns<ProfileRow[]>();

    for (const profile of profiles ?? []) {
      const name = profile.full_name?.trim();
      if (name) actorNames.set(profile.id, name);
    }
  }

  return candidates
    .filter((candidate) => timestamp(candidate.at) > 0)
    .sort((a, b) => timestamp(b.at) - timestamp(a.at))
    .map((candidate) => ({
      id: candidate.id,
      action: ACTION_LABELS[candidate.action],
      actorName: candidate.actorName?.trim() || (candidate.actorId ? actorNames.get(candidate.actorId) : null) || "Not recorded",
      at: candidate.at,
    }));
}
