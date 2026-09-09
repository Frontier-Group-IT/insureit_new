import type { ParsedPolicyResult } from "@/lib/policy-ocr-parsers";

/**
 * Round 3 is intentionally precision-first. It never invents replacement
 * values. It only withholds fields that Round 2 repeatedly populated from
 * ambiguous table associations in the fresh production benchmark families.
 * Coverage is measured separately, so uncertain values are safer left blank.
 */
export function refineProductionRound3Precision(
  parsed: ParsedPolicyResult,
): ParsedPolicyResult {
  const version = parsed.parserVersion ?? "";
  const fields = new Map(parsed.fields.map((field) => [field.key, field]));
  let family: "digit" | "iffco" | null = null;

  if (version.includes("+prod-r2-digit")) {
    family = "digit";
    // Round 2 repeatedly confused liability/OD rows and then propagated those
    // mistakes through CPA, net, GST and gross reconciliation. Vehicle header
    // columns for make/model/fuel/capacity were also not stable enough across
    // the verified siblings. Withhold rather than guess until stronger layout
    // evidence is available.
    for (const key of [
      "cpa_opted",
      "cpa_premium",
      "od_premium",
      "tp_premium",
      "total_premium",
      "tax_amount",
      "gross_premium",
      "vehicle_make",
      "vehicle_model",
      "vehicle_fuel_type",
      "vehicle_capacity",
    ]) fields.delete(key);
  } else if (version.includes("+prod-r2-iffco")) {
    family = "iffco";
    // IFFCO Round 2 still derives OD/TP/CPA from ambiguous premium rows and
    // has unstable make/capacity column association. Preserve only fields that
    // carry the explicit structured evidence now covered by the MISD layout
    // regressions; ambiguous Round 2 fallbacks remain withheld.
    for (const key of [
      "od_premium",
      "tp_premium",
      "cpa_premium",
      "vehicle_make",
      "vehicle_capacity",
    ]) {
      const field = fields.get(key);
      if (!field || !isTrustedIffcoStructuredEvidence(field.evidence, key)) fields.delete(key);
    }
  }

  function isTrustedIffcoStructuredEvidence(evidence: string, key: string) {
    if (key === "vehicle_make" || key === "vehicle_capacity") {
      return /Round 2 header-column association/i.test(evidence);
    }
    if (key === "cpa_premium") {
      return /Explicit owner-driver CPA row/i.test(evidence);
    }
    return /Round 2 exact premium row|Printed net - Basic TP - explicit owner-driver CPA/i.test(evidence);
  }

  if (!family) return parsed;
  return {
    ...parsed,
    parserVersion: `${version}+prod-r3-precision-${family}`,
    fields: [...fields.values()],
    warnings: [
      ...parsed.warnings.filter((warning) => !/production benchmark round 3/i.test(warning)),
      `Production benchmark round 3 precision guard applied: ${family}; ambiguous fields withheld.`,
    ],
  };
}
