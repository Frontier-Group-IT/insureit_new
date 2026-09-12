export const POLICY_INTAKE_OCR_STALE_MS = 10 * 60 * 1000;

export function isPolicyIntakeOcrRetryable(
  input: { status: string; ocrStatus: string; createdAt: string },
  now = Date.now(),
) {
  if (input.status !== "processing" && input.status !== "in_review") return false;
  if (input.ocrStatus === "failed") return true;
  if (input.ocrStatus !== "pending" && input.ocrStatus !== "processing") return false;
  const created = new Date(input.createdAt).getTime();
  return Number.isFinite(created) && now - created >= POLICY_INTAKE_OCR_STALE_MS;
}
