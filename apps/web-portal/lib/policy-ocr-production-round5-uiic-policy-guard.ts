import type { ParsedPolicyResult } from "@/lib/policy-ocr-parsers";

/**
 * Final Round 5 guards repair only strongly labelled UIIC identity fields after
 * the precision refiner. They never guess from free-floating identifiers.
 */
export function guardProductionRound5UiicPolicyNumber(
  pages: string[],
  parsed: ParsedPolicyResult,
): ParsedPolicyResult {
  if (!parsed.parserVersion.includes("+prod-r5-uiic_precision")) return parsed;

  const current = parsed.fields.find((field) => field.key === "policy_number")?.value?.trim() ?? "";
  if (plausiblePolicyNumber(current)) return parsed;

  const recovered = findStrictPolicyNumber(pages.slice(0, 2));
  const fields = parsed.fields.filter((field) => field.key !== "policy_number");
  if (recovered) {
    fields.push({
      key: "policy_number",
      label: "Policy number",
      value: recovered.value,
      confidence: .999,
      page: recovered.page,
      evidence: "Round 5 strict current UIIC policy-number label",
    });
  }
  return { ...parsed, fields };
}

export function guardProductionRound5UiicVehicleIds(
  pages: string[],
  parsed: ParsedPolicyResult,
): ParsedPolicyResult {
  if (!parsed.parserVersion.includes("+prod-r5-uiic_precision")) return parsed;
  const fields = [...parsed.fields];
  const currentChassis = fields.find((field) => field.key === "vehicle_chassis_number")?.value?.trim() ?? "";
  const currentEngine = fields.find((field) => field.key === "vehicle_engine_number")?.value?.trim() ?? "";

  const boundedPages = pages.slice(0, 2);
  if (!plausibleVehicleId(currentChassis)) {
    replaceField(fields, "vehicle_chassis_number", findStrictVehicleId(boundedPages, /(?:Chassis\s+Number|Chassis\s+No\.?)\b/i), "Chassis number");
  }
  if (!plausibleVehicleId(currentEngine)) {
    replaceField(fields, "vehicle_engine_number", findStrictVehicleId(boundedPages, /(?:Engine\s+Number|Engine\s+No\.?)\b/i), "Engine number");
  }
  return { ...parsed, fields };
}

function replaceField(
  fields: ParsedPolicyResult["fields"],
  key: string,
  recovered: { value: string; page: number } | null,
  label: string,
) {
  const index = fields.findIndex((field) => field.key === key);
  if (index >= 0) fields.splice(index, 1);
  if (!recovered) return;
  fields.push({
    key,
    label,
    value: recovered.value,
    confidence: .999,
    page: recovered.page,
    evidence: `Round 5 strict current UIIC ${label.toLowerCase()} label`,
  });
}

function findStrictPolicyNumber(pages: string[]) {
  for (let pageIndex = 0; pageIndex < pages.length; pageIndex += 1) {
    const lines = pages[pageIndex].split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    for (let i = 0; i < lines.length; i += 1) {
      if (!/^\s*Policy\s+(?:Number|No\.?)\b/i.test(lines[i])) continue;
      if (/Previous|Prev\.?/i.test(lines[i])) continue;
      const sameLine = lines[i].replace(/^\s*Policy\s+(?:Number|No\.?)\s*[:#-]?\s*/i, "").trim();
      const candidates = [sameLine, lines[i + 1] ?? ""];
      for (const candidate of candidates) {
        const tokens = candidate.match(/[A-Z0-9][A-Z0-9\/-]{7,34}/gi) ?? [];
        for (const token of tokens) {
          const value = token.replace(/[.,;:]+$/, "");
          if (plausiblePolicyNumber(value)) return { value, page: pageIndex + 1 };
        }
      }
    }
  }
  return null;
}

function findStrictVehicleId(pages: string[], label: RegExp) {
  for (let pageIndex = 0; pageIndex < pages.length; pageIndex += 1) {
    const lines = pages[pageIndex].split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    for (let i = 0; i < lines.length; i += 1) {
      if (!label.test(lines[i])) continue;
      const after = lines[i].replace(label, " ");
      const candidates = [after, lines[i + 1] ?? ""].join(" ").match(/[A-Z0-9][A-Z0-9\/-]{11,34}/gi) ?? [];
      for (const raw of candidates) {
        const value = raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
        if (plausibleVehicleId(value)) return { value, page: pageIndex + 1 };
      }
    }
  }
  return null;
}

function plausiblePolicyNumber(value: string) {
  const compact = value.replace(/[^A-Z0-9]/gi, "");
  return compact.length >= 8 && compact.length <= 32 && /\d/.test(compact) && /[A-Z]/i.test(compact);
}

function plausibleVehicleId(value: string) {
  const compact = value.replace(/[^A-Z0-9]/gi, "");
  return compact.length >= 12 && compact.length <= 34 && /\d/.test(compact) && /[A-Z]/i.test(compact)
    && !/^(?:OBSOLETEVEHICLE|HPCUBICCAPACITY|CUBICCAPACITY)$/i.test(compact);
}
