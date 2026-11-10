/** Canonical Policy Intake status bucketing for Operations portal and Partner API.
 * Duplicate is a derived status based on policy-number matches, not necessarily
 * the stored policy_intake_requests.status. Do not update rows to synchronize counts.
 */
export type IntakeStatusBucket = "action_required" | "in_review" | "processing" | "completed" | "duplicate" | "rejected" | "all";
export const INTAKE_STATUS_BUCKETS: IntakeStatusBucket[] = ["action_required", "in_review", "processing", "completed", "duplicate", "rejected", "all"];

export function policyIntakeBucket(
  row: { status: string; ocr_status: string | null },
  duplicate: boolean,
): Exclude<IntakeStatusBucket, "all"> {
  if (duplicate || row.status.toLowerCase() === "duplicate") return "duplicate";
  if (row.status === "ready_for_review" || row.status === "needs_attention" ||
      (row.status === "processing" && row.ocr_status === "failed")) return "action_required";
  if (row.status === "in_review") return "in_review";
  if (row.status === "processing") return "processing";
  if (row.status === "completed") return "completed";
  if (row.status === "rejected") return "rejected";
  // Unknown in-progress state remains visible under Processing.
  return "processing";
}

export function policyIntakeStatusCounts<T extends { status: string; ocr_status: string | null; id: string }>(
  rows: T[], duplicateIds: ReadonlySet<string>,
): Record<IntakeStatusBucket, number> {
  const counts = { action_required: 0, in_review: 0, processing: 0, completed: 0, duplicate: 0, rejected: 0, all: rows.length };
  for (const row of rows) counts[policyIntakeBucket(row, duplicateIds.has(row.id))]++;
  return counts;
}
