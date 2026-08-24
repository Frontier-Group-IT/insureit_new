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
// @ts-expect-error -- raw Node OCR regression requires explicit TypeScript extension.
import { refineProductionRound4Uiic } from "./policy-ocr-production-round4-uiic-refiner.ts";
// @ts-expect-error -- raw Node OCR regression requires explicit TypeScript extension.
import { refineProductionRound5Uiic } from "./policy-ocr-production-round5-uiic-refiner.ts";
// @ts-expect-error -- raw Node OCR regression requires explicit TypeScript extension.
import { refineProductionRound6Uiic } from "./policy-ocr-production-round6-uiic-refiner.ts";
// @ts-expect-error -- raw Node OCR regression requires explicit TypeScript extension.
import { refineProductionRound7UiicPrecision } from "./policy-ocr-production-round7-uiic-precision-guard.ts";
// @ts-expect-error -- raw Node OCR regression requires explicit TypeScript extension.
import { refineProductionRound8Fresh20Precision } from "./policy-ocr-production-round8-fresh20-precision-guard.ts";
// @ts-expect-error -- raw Node OCR regression requires explicit TypeScript extension.
import { refineProductionRound9Fresh20Recovery } from "./policy-ocr-production-round9-fresh20-recovery.ts";
// @ts-expect-error -- raw Node OCR regression requires explicit TypeScript extension.
import { guardProductionRound5UiicPolicyNumber, guardProductionRound5UiicMakeModel, guardProductionRound5UiicVehicleIds } from "./policy-ocr-production-round5-uiic-policy-guard.ts";

export function refineApprovedMotorPolicyLayout(
  pages: string[],
  tables: StructuredPolicyTable[],
  parsed: ParsedPolicyResult,
): ParsedPolicyResult {
  const approved = refineApprovedMotorPolicyLayoutBase(pages, tables, parsed);
  const header = (pages[0] ?? "").split(/\r?\n/).slice(0, 140).join(" ");

  if (/MAGMA\s+GENERAL\s+INSURANCE|MAGMAINSURANCE\.COM/i.test(header)) {
    const make = approved.fields.find((field) => field.key === "vehicle_make")?.value?.trim() ?? "";
    if (!/^\/?MODEL$/i.test(make)) {
      return refineProductionPolicyIdentity(pages, refineProductionRound8Fresh20Precision(pages, tables, approved));
    }
    const production = refineProductionBenchmarkPolicy(pages, tables, approved);
    return refineProductionPolicyIdentity(pages, refineProductionRound8Fresh20Precision(pages, tables, production));
  }

  let production = approved;
  if (/NATIONAL\s+INSURANCE(?:\s+COMPANY)?|CUSTOMER\.SUPPORT@NIC\.CO\.IN|NIC\.CO\.IN/i.test(header)) {
    const product = approved.fields.find((field) => field.key === "policy_product")?.value?.trim() ?? "";
    const model = approved.fields.find((field) => field.key === "vehicle_model")?.value?.trim() ?? "";
    const failedRouting = approved.parserId === "oriental_motor_v1";
    const failedProduct = /THIRD\s+PARTY/i.test(product);
    const failedModel = /^(?:NO\.?|MODEL\s*-?|.*VARIANT.*)$/i.test(model);
    if (failedRouting || failedProduct || failedModel) production = refineProductionBenchmarkPolicy(pages, tables, approved);
  } else {
    production = refineProductionBenchmarkPolicy(pages, tables, approved);
  }

  const round2 = refineProductionRound2Policy(pages, tables, production);
  const round3 = refineProductionRound3Precision(round2);
  const round4 = refineProductionRound4Uiic(pages, tables, round3);
  const round5 = refineProductionRound5Uiic(pages, tables, round4);
  const guardedPolicy = guardProductionRound5UiicPolicyNumber(pages, round5);
  const guardedMakeModel = guardProductionRound5UiicMakeModel(pages, guardedPolicy);
  const guardedIds = guardProductionRound5UiicVehicleIds(pages, guardedMakeModel);
  const round6 = refineProductionRound6Uiic(pages, tables, guardedIds);
  const round7 = refineProductionRound7UiicPrecision(round6);
  const round8 = refineProductionRound8Fresh20Precision(pages, tables, round7);
  const round9 = refineProductionRound9Fresh20Recovery(pages, round8);
  return refineProductionPolicyIdentity(pages, round9);
}
