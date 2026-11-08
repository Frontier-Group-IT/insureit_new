/**
 * Temporary OCR-only experiment. Layout Parser is disabled by default.
 *
 * Set POLICY_OCR_LAYOUT_PARSER_ENABLED=true to restore the prior PDF path
 * without changing the insurer-specific parsers or training worker.
 */
export function shouldRunPolicyOcrLayoutParser(mimeType: string): boolean {
  return mimeType === "application/pdf" && process.env.POLICY_OCR_LAYOUT_PARSER_ENABLED === "true";
}
