const ROUTINE_SUCCESS_DIAGNOSTIC = /^Production\b.*\b(?:refinement|guard|recovery)\b.*\bapplied\.?$/i;

/**
 * Parser refiners emit success markers so training/debugging can identify which
 * passes ran. Those markers are useful internally, but they are not actionable
 * warnings for Policy Onboarding users. Keep genuine warning/review messages
 * visible and suppress only clearly successful production diagnostics.
 */
export function filterPolicyOcrUserWarnings(warnings: string[]) {
  return warnings.filter((warning) => !ROUTINE_SUCCESS_DIAGNOSTIC.test(warning.trim()));
}
