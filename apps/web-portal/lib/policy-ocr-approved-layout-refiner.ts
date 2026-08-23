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
  const header = (pages[0] ?? "").split(/\r?\n/).slice(0, 55).join(" ");

  // The fresh Magma PCP production family has a distinct Google table failure
  // shape where the make column collapses to the heading `/Model`. Keep older
  // already-trained Magma package layouts on their proven v6 path instead of
  // broadening the new CPA/TP rule across the whole insurer.
  if (/MAGMA\s+GENERAL\s+INSURANCE|MAGMAINSURANCE\.COM/i.test(header)) {
    const make = approved.fields.find((field) => field.key === "vehicle_make")?.value?.trim() ?? "";
    if (!/^\/?MODEL$/i.test(make)) return approved;
  }

  // National has both a genuine Bundled TWP layout and a newer Package family
  // whose current baseline sometimes routes to Oriental or Third Party. Only
  // apply Round #1 when that failure signature is present; a correctly routed
  // National Bundled result must remain on the established v6 path.
  if (/NATIONAL\s+INSURANCE(?:\s+COMPANY)?|CUSTOMER\.SUPPORT@NIC\.CO\.IN|NIC\.CO\.IN/i.test(header)) {
    const product = approved.fields.find((field) => field.key === "policy_product")?.value?.trim() ?? "";
    const model = approved.fields.find((field) => field.key === "vehicle_model")?.value?.trim() ?? "";
    const failedRouting = approved.parserId === "oriental_motor_v1";
    const failedProduct = /THIRD\s+PARTY/i.test(product);
    const failedModel = /^(?:NO\.?|MODEL\s*-?|.*VARIANT.*)$/i.test(model);
    if (!failedRouting && !failedProduct && !failedModel) return approved;
  }

  return refineProductionBenchmarkPolicy(pages, tables, approved);
}
