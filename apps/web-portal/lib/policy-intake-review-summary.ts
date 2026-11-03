import type { PolicyIntakeOcrField } from "@/app/policy-intakes/ocr-actions";
import { fetchAllPages } from "@/lib/fetch-all-pages";
import { loadLifeHealthCaseSummary } from "@/lib/life-health-case-summary";
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
  proposalPending: number | null;
};

type PolicyIntakeReviewSummaryOptions = {
  submittedByProfileId?: string;
  includeActionRequired?: boolean;
  intakeOrFilter?: string;
  denyAll?: boolean;
  includeNeedsAttention?: boolean;
};

export async function loadPolicyIntakeReviewSummary(
  admin: AdminClient,
  options: PolicyIntakeReviewSummaryOptions = {},
): Promise<PolicyIntakeReviewSummary | null> {
  try {
    if (options.denyAll) return null;
    const [{ data, error }, proposalSummary] = await Promise.all([
      fetchAllPages<PolicyIntakeSummaryRow, unknown>((from, to) => {
        let query = admin
          .from("policy_intake_requests")
          .select("id,intake_number,status,created_at,ocr_status,ocr_fields")
          .order("created_at", { ascending: false })
          .order("id", { ascending: false })
          .range(from, to);
        if (options.intakeOrFilter) query = query.or(options.intakeOrFilter);
        else if (options.submittedByProfileId) query = query.eq("submitted_by_profile_id", options.submittedByProfileId);
        return query.returns<PolicyIntakeSummaryRow[]>();
      }),
      loadLifeHealthCaseSummary(admin),
    ]);
    if (error) return null;
    const rows = data ?? [];
    const duplicateCheck = await loadPolicyIntakeDuplicateMatches(admin, rows);
    if (!duplicateCheck.ok) return null;

    const queueRows = rows.map((row) => duplicateCheck.matches.has(row.id) ? { ...row, status: "Duplicate" } : row);
    const includeActionRequired = options.includeActionRequired ?? true;
    return {
      actionRequired: includeActionRequired
        ? queueRows.filter((row) => row.status === "ready_for_review" || (options.includeNeedsAttention && row.status === "needs_attention") || (row.status === "processing" && row.ocr_status === "failed")).length
        : null,
      inReview: queueRows.filter((row) => row.status === "in_review").length,
      proposalPending: proposalSummary?.pending ?? null,
    };
  } catch {
    return null;
  }
}
