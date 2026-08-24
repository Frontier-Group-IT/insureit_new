import type { ParsedPolicyResult } from "@/lib/policy-ocr-parsers";
import type { StructuredPolicyTable } from "@/lib/policy-ocr-iffco-structured-refiner";
// @ts-expect-error -- raw Node OCR regression requires explicit TypeScript extension.
import { refineApprovedMotorPolicyLayout as refineApprovedMotorPolicyLayoutBase } from "./policy-ocr-approved-layout-refiner-base.ts";
// @ts-expect-error -- raw Node OCR regression requires explicit TypeScript extension.
import { refineProductionBenchmarkPolicy } from "./policy-ocr-production-benchmark-refiner.ts";
// @ts-expect-error -- raw Node OCR regression requires explicit TypeScript extension.
import { refineProductionPolicyIdentity } from "./policy-ocr-production-identity-refiner.ts";
// @ts-expect-error -- raw Node OCR regression requires explicit TypeScript extension.
import { refineProductionRound2Policy } from "./policy-ocr-production-round2-refiner.ts";
// @ts-expect-error -- raw Node OCR regression requires explicit TypeScript extension.
import { refineProductionRound3Precision } from "./policy-ocr-production-round3-precision-guard.ts";

/**
 * Stable approved-layout behavior remains the base. Round 1 handles the four
 * original production benchmark families; Round 2 applies structural repairs;
 * Round 3 is a precision-first guard that withholds repeatedly ambiguous
 * Digit/IFFCO outputs instead of auto-filling low-confidence values.
 */
export function refineApprovedMotorPolicyLayout(
  pages: string[],
  tables: StructuredPolicyTable[],
  parsed: ParsedPolicyResult,
): ParsedPolicyResult {
  const approved = refineApprovedMotorPolicyLayoutBase(pages, tables, parsed);
  const header = (pages[0] ?? "").split(/\r?\n/).slice(0, 140).join(" ");

  // Keep already-correct Magma package layouts on their proven v6 path unless
  // they have the exact fresh-production `/Model` failure signature.
  if (/MAGMA\s+GENERAL\s+INSURANCE|MAGMAINSURANCE\.COM/i.test(header)) {
    const make = approved.fields.find((field) => field.key === "vehicle_make")?.value?.trim() ?? "";
    if (!/^\/?MODEL$/i.test(make)) return approved;
    const production = refineProductionBenchmarkPolicy(pages, tables, approved);
    return refineProductionPolicyIdentity(pages, production);
  }

  let production = approved;

  // National has both a genuine Bundled TWP layout and newer Package schedules.
  // Round 1 remains failure-gated, while Round 2 can still correct a strongly
  // identified current National Package schedule even when v6 produced a
  // superficially plausible Bundled result.
  if (/NATIONAL\s+INSURANCE(?:\s+COMPANY)?|CUSTOMER\.SUPPORT@NIC\.CO\.IN|NIC\.CO\.IN/i.test(header)) {
    const product = approved.fields.find((field) => field.key === "policy_product")?.value?.trim() ?? "";
    const model = approved.fields.find((field) => field.key === "vehicle_model")?.value?.trim() ?? "";
    const failedRouting = approved.parserId === "oriental_motor_v1";
    const failedProduct = /THIRD\s+PARTY/i.test(product);
    const failedModel = /^(?:NO\.?|MODEL\s*-?|.*VARIANT.*)$/i.test(model);
    if (failedRouting || failedProduct || failedModel) {
      production = refineProductionBenchmarkPolicy(pages, tables, approved);
    }
  } else {
    production = refineProductionBenchmarkPolicy(pages, tables, approved);
  }

  const round2 = refineProductionRound2Policy(pages, tables, production);
  const round3 = refineProductionRound3Precision(round2);
  return refineProductionPolicyIdentity(pages, round3);
}
