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
import { refineProductionRound10UiicGcvPackage } from "./policy-ocr-production-round10-uiic-gcv-refiner.ts";
// @ts-expect-error -- raw Node OCR regression requires explicit TypeScript extension.
import { refineProductionRound11UiicGcvLiveResiduals } from "./policy-ocr-production-round11-uiic-gcv-live-residual-refiner.ts";
// @ts-expect-error -- raw Node OCR regression requires explicit TypeScript extension.
import { refineProductionRound12UiicGcvMakeModel } from "./policy-ocr-production-round12-uiic-gcv-make-model-refiner.ts";
// @ts-expect-error -- raw Node OCR regression requires explicit TypeScript extension.
import { guardProductionRound5UiicPolicyNumber, guardProductionRound5UiicMakeModel, guardProductionRound5UiicVehicleIds } from "./policy-ocr-production-round5-uiic-policy-guard.ts";
// @ts-expect-error -- raw Node OCR regression requires explicit TypeScript extension.
import { refineTataAigBundledTwoWheelerPolicy } from "./policy-ocr-tata-aig-refiner.ts";
// @ts-expect-error -- raw Node OCR regression requires explicit TypeScript extension.
import { guardTataAigPolicyNumber } from "./policy-ocr-tata-aig-policy-number-guard.ts";
// @ts-expect-error -- raw Node OCR regression requires explicit TypeScript extension.
import { refineTataAigVisibleFields } from "./policy-ocr-tata-aig-visible-field-refiner.ts";
// @ts-expect-error -- raw Node OCR regression requires explicit TypeScript extension.
import { refineTataAigStructuredLayout } from "./policy-ocr-tata-aig-structured-refiner.ts";
// @ts-expect-error -- raw Node OCR regression requires explicit TypeScript extension.
import { refineNewIndiaEnhancedCoversPolicy } from "./policy-ocr-new-india-enhanced-covers-refiner.ts";
// @ts-expect-error -- raw Node OCR regression requires explicit TypeScript extension.
import { refineNewIndiaEnhancedCoversLiveResiduals } from "./policy-ocr-new-india-enhanced-covers-live-residual-refiner.ts";
// @ts-expect-error -- raw Node OCR regression requires explicit TypeScript extension.
import { refineNewIndiaSeparatedVehicleEvidence } from "./policy-ocr-new-india-separated-vehicle-evidence-refiner.ts";
// @ts-expect-error -- raw Node OCR regression requires explicit TypeScript extension.
import { refineIciciLombardMotorPolicy } from "./policy-ocr-icici-lombard-refiner.ts";

export function refineApprovedMotorPolicyLayout(
  pages: string[],
  tables: StructuredPolicyTable[],
  parsed: ParsedPolicyResult,
): ParsedPolicyResult {
  const approved = refineApprovedMotorPolicyLayoutBase(pages, tables, parsed);
  const header = (pages[0] ?? "").split(/\r?\n/).slice(0, 140).join(" ");

  if (/ICICI\s+LOMBARD(?:\s+GENERAL\s+INSURANCE\s+COMPANY\s+LIMITED)?/i.test(header)) {
    return refineIciciLombardMotorPolicy(pages, tables, approved);
  }

  if (/TATA\s+AIG\s+GENERAL\s+INSURANCE/i.test(header)) {
    const tata = guardTataAigPolicyNumber(pages, refineTataAigBundledTwoWheelerPolicy(pages, approved));
    const visible = refineTataAigVisibleFields(pages, tata);
    return refineTataAigStructuredLayout(pages, tables, visible);
  }

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
  const round10Raw = refineProductionRound10UiicGcvPackage(pages, tables, round9);
  const round10 = preserveValidatedUiicFinancials(pages, round9, round10Raw);
  const round11 = refineProductionRound11UiicGcvLiveResiduals(pages, tables, round10);
  const round12 = refineProductionRound12UiicGcvMakeModel(pages, tables, round11);
  const identified = refineProductionPolicyIdentity(pages, round12);
  const enhanced = refineNewIndiaEnhancedCoversPolicy(pages, tables, identified);
  const residual = refineNewIndiaEnhancedCoversLiveResiduals(pages, tables, enhanced);
  const separated = refineNewIndiaSeparatedVehicleEvidence(pages, tables, residual);
  logNewIndiaEnhancedDiagnostic(pages, tables, residual, separated);
  return separated;
}

function logNewIndiaEnhancedDiagnostic(
  pages: string[],
  tables: StructuredPolicyTable[],
  beforeResidual: ParsedPolicyResult,
  afterResidual: ParsedPolicyResult,
) {
  if (afterResidual.parserId !== "new_india_motor_v1") return;

  const firstTwo = pages.slice(0, 2).join("\n");
  const page1 = pages[0] ?? "";
  const vehicle = diagnosticVehicleBlock(page1);
  const page1Tables = tables.filter((table) => table.page === 1);
  const page1Cells = page1Tables.flatMap((table) => table.rows.flat()).map((cell) => cell.replace(/\u00a0/g, " ").trim());
  const ids = diagnosticMixedIds(vehicle);
  const vinShapeCount = ids.filter((value) => diagnosticLooksLikeVin(value)).length;
  const engineShapeCount = ids.filter((value) => !diagnosticLooksLikeVin(value)).length;
  const fieldPresent = (result: ParsedPolicyResult, key: string) => Boolean(result.fields.find((field) => field.key === key)?.value?.trim());
  const traceId = `NI-${Date.now().toString(36).slice(-6)}-${Math.random().toString(36).slice(2, 6)}`;

  console.info(JSON.stringify({
    level: "info",
    message: "policy_ocr_new_india_diagnostic",
    traceId,
    parserId: afterResidual.parserId,
    parserVersion: afterResidual.parserVersion,
    enhancedLayoutMatched: /COMMERCIAL\s+VEHICLE\s+PACKAGE\s+POLICY[\s\S]{0,40}?ENHANCED\s+COVERS/i.test(firstTwo),
    page1: {
      hasVehicleDetails: /VEHICLE\s+DETAILS/i.test(page1),
      hasYearLabel: /Year\s+of\s+manufacture/i.test(vehicle),
      yearCandidateCount: new Set(vehicle.match(/\b(?:19|20)\d{2}\b/g) ?? []).size,
      hasChassisEngineLabel: /Chassis\s*(?:no\.?|number)?\s*\/\s*Engine\s*(?:no\.?|number)?/i.test(vehicle),
      vinShapeCount,
      engineShapeCount,
    },
    layout: {
      tableCount: tables.length,
      page1TableCount: page1Tables.length,
      hasYearLabelCell: page1Cells.some((cell) => /Year\s+of\s+manufacture/i.test(cell)),
      hasChassisEngineLabelCell: page1Cells.some((cell) => /Chassis\s*(?:no\.?|number)?\s*\/\s*Engine\s*(?:no\.?|number)?/i.test(cell)),
    },
    beforeResidual: {
      manufacturingYearPresent: fieldPresent(beforeResidual, "vehicle_manufacturing_year"),
      chassisPresent: fieldPresent(beforeResidual, "vehicle_chassis_number"),
      enginePresent: fieldPresent(beforeResidual, "vehicle_engine_number"),
    },
    afterResidual: {
      manufacturingYearPresent: fieldPresent(afterResidual, "vehicle_manufacturing_year"),
      chassisPresent: fieldPresent(afterResidual, "vehicle_chassis_number"),
      enginePresent: fieldPresent(afterResidual, "vehicle_engine_number"),
    },
  }));
}

function diagnosticVehicleBlock(page: string) {
  const start = page.search(/VEHICLE\s+DETAILS/i);
  const source = start >= 0 ? page.slice(start) : page;
  const end = source.search(/INSURED\s+DECLARED\s+VALUE|SCHEDULE\s+OF\s+PREMIUM/i);
  return end > 0 ? source.slice(0, end) : source.slice(0, 7000);
}

function diagnosticMixedIds(block: string) {
  const candidates = block.match(/[A-Z0-9][A-Z0-9-]{9,23}/gi) ?? [];
  return [...new Set(candidates
    .map((value) => value.toUpperCase().replace(/[^A-Z0-9]/g, ""))
    .filter((value) => value.length >= 10 && value.length <= 24 && /[A-Z]/.test(value) && /\d/.test(value)))];
}

function diagnosticLooksLikeVin(value: string) {
  return value.length === 17 && /^[A-Z0-9]{17}$/.test(value) && /[A-Z]/.test(value) && /\d/.test(value);
}

function preserveValidatedUiicFinancials(
  pages: string[],
  before: ParsedPolicyResult,
  after: ParsedPolicyResult,
): ParsedPolicyResult {
  if (before.parserId !== "united_india_motor_v1" || before === after) return after;

  const beforeOdField = before.fields.find((field) => field.key === "od_premium");
  const beforeTpField = before.fields.find((field) => field.key === "tp_premium");
  if (!beforeOdField || !beforeTpField) return after;
  const beforeOd = numeric(beforeOdField.value);
  if (beforeOd == null) return after;

  const firstTwo = pages.slice(0, 2).join("\n");
  const grossOdMatch = firstTwo.match(/Gross\s+OD\s*\(A\)[\s\S]{0,80}?((?:\d{1,3}(?:,\d{3})+|\d{2,8})(?:\.\d{1,2})?)/i);
  const grossOd = numeric(grossOdMatch?.[1]);
  if (grossOd == null || Math.abs(beforeOd - grossOd) > 1) return after;

  const restored = after.fields.filter((field) => field.key !== "od_premium" && field.key !== "tp_premium");
  restored.push(beforeOdField, beforeTpField);
  return { ...after, fields: restored };
}

function numeric(value: string | undefined): number | null {
  if (!value) return null;
  const parsed = Number(value.replace(/,/g, "").trim());
  return Number.isFinite(parsed) ? parsed : null;
}