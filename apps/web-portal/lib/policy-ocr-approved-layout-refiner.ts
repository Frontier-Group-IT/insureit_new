import type { ParsedPolicyResult } from "@/lib/policy-ocr-parsers";
import type { StructuredPolicyTable } from "@/lib/policy-ocr-iffco-structured-refiner";
import { refineApprovedMotorPolicyLayout as refineApprovedMotorPolicyLayoutBase } from "./policy-ocr-approved-layout-refiner-base.ts";
import { refineProductionBenchmarkPolicy } from "./policy-ocr-production-benchmark-refiner.ts";

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

  // The fresh Magma PCP production family has a distinct Google table failure
  // shape where the make column collapses to the heading `/Model`. Keep older
  // already-trained Magma package layouts on their proven v6 path instead of
  // broadening the new CPA/TP rule across the whole insurer.
  const header = (pages[0] ?? "").split(/\r?\n/).slice(0, 55).join(" ");
  if (/MAGMA\s+GENERAL\s+INSURANCE|MAGMAINSURANCE\.COM/i.test(header)) {
    const make = approved.fields.find((field) => field.key === "vehicle_make")?.value?.trim() ?? "";
    if (!/^\/?MODEL$/i.test(make)) return approved;
  }

  return refineProductionBenchmarkPolicy(pages, tables, approved);
}
