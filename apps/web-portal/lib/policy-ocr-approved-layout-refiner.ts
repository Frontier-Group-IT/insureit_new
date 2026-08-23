import type { ParsedPolicyResult } from "@/lib/policy-ocr-parsers";
import type { StructuredPolicyTable } from "@/lib/policy-ocr-iffco-structured-refiner";
import { refineApprovedMotorPolicyLayout as refineApprovedMotorPolicyLayoutBase } from "@/lib/policy-ocr-approved-layout-refiner-base";
import { refineProductionBenchmarkPolicy } from "@/lib/policy-ocr-production-benchmark-refiner";

/**
 * Stable approved-layout behavior is preserved in the base module. Production
 * benchmark refinements run only after that proven layer and are hard-gated by
 * the current-policy insurer header + supported production family.
 */
export function refineApprovedMotorPolicyLayout(
  pages: string[],
  tables: StructuredPolicyTable[],
  parsed: ParsedPolicyResult,
): ParsedPolicyResult {
  const approved = refineApprovedMotorPolicyLayoutBase(pages, tables, parsed);
  return refineProductionBenchmarkPolicy(pages, tables, approved);
}
