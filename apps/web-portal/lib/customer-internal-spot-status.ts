/**
 * Operations stage details are internal records. Export only the four Stage 2
 * survey fields approved for the customer-facing completed journey.
 */
type StageTwoSource = {
  id: string;
  claim_id: string;
  details: Record<string, unknown> | null;
  created_at: string;
};

export function customerSpotStatusMilestone(row: StageTwoSource) {
  if (row.details?.milestone_key !== "spot_status") return null;
  const fields = ["spot_survey_done_date", "surveyor_name", "surveyor_email", "surveyor_phone"] as const;
  const details: Record<string, string> = {};
  for (const field of fields) {
    const value = row.details[field];
    if (typeof value === "string" && value.trim()) details[field] = value.trim();
  }
  const completedAt = row.details.completed_at;
  return {
    id: row.id,
    claim_id: row.claim_id,
    milestone_key: "spot_status",
    milestone_status: "completed",
    details,
    completed_at: typeof completedAt === "string" ? completedAt : row.created_at,
    updated_at: row.created_at,
  };
}
