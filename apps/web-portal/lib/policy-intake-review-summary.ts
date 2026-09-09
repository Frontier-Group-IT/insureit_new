import type { PolicyIntakeOcrField } from "@/app/policy-intakes/ocr-actions";
import { loadPolicyIntakeDuplicateMatches } from "@/lib/policy-intake-duplicate";
import type { createSupabaseAdminClient } from "@/lib/supabase-admin";

type AdminClient = ReturnType<typeof createSupabaseAdminClient>;

type PolicyIntakeSummaryRow = {
  id: string;
  intake_number: string;
  status: string;
  created_at: string;
  ocr_status: string;
  ocr_fields: PolicyIntakeOcrField[] | null;
};

export type PolicyIntakeReviewSummary = {
  actionRequired: number | null;
  inReview: number;
};

type PolicyIntakeReviewSummaryOptions = {
  submittedByProfileId?: string;
  includeActionRequired?: boolean;
};

export async function loadPolicyIntakeReviewSummary(
  admin: AdminClient,
  options: PolicyIntakeReviewSummaryOptions = {},
): Promise<PolicyIntakeReviewSummary | null> {
  try {
    let query = admin
      .from("policy_intake_requests")
      .select("id,intake_number,status,created_at,ocr_status,ocr_fields")
      .order("created_at", { ascending: false })
      .limit(500);

    if (options.submittedByProfileId) {
      query = query.eq("submitted_by_profile_id", options.submittedByProfileId);
    }

    const { data, error } = await query.returns<PolicyIntakeSummaryRow[]>();
    if (error) return null;
    const rows = data ?? [];
    const duplicateCheck = await loadPolicyIntakeDuplicateMatches(admin, rows);
    if (!duplicateCheck.ok) return null;

    const queueRows = rows.map((row) => duplicateCheck.matches.has(row.id) ? { ...row, status: "Duplicate" } : row);
    const includeActionRequired = options.includeActionRequired ?? true;
    return {
      actionRequired: includeActionRequired
        ? queueRows.filter((row) => row.status === "ready_for_review" || (row.status === "processing" && row.ocr_status === "failed")).length
        : null,
      inReview: queueRows.filter((row) => row.status === "in_review").length,
    };
  } catch {
    return null;
  }
}
