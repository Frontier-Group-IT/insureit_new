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

export function guardProductionRound5UiicMakeModel(
  pages: string[],
  parsed: ParsedPolicyResult,
): ParsedPolicyResult {
  if (!parsed.parserVersion.includes("+prod-r5-uiic_precision")) return parsed;
  const recovered = findExplicitMakeModel(pages.slice(0, 2));
  if (!recovered) return parsed;

  const fields = parsed.fields.filter((field) => !["vehicle_make", "vehicle_model", "vehicle_fuel_type"].includes(field.key));
  fields.push({ key: "vehicle_make", label: "Vehicle make", value: recovered.make, confidence: .999, page: recovered.page, evidence: "Round 5 explicit UIIC Vehicle Make & Model block" });
  fields.push({ key: "vehicle_model", label: "Vehicle model", value: recovered.model, confidence: .999, page: recovered.page, evidence: "Round 5 explicit UIIC Vehicle Make & Model block" });
  if (/\bEV\b|ELECTRIC/i.test(`${recovered.make} ${recovered.model}`)) {
    fields.push({ key: "vehicle_fuel_type", label: "Fuel type", value: "Electric", confidence: .999, page: recovered.page, evidence: "Round 5 explicit EV marker in UIIC make/model" });
  }
  return { ...parsed, fields };
}

export function guardProductionRound5UiicVehicleIds(
  pages: string[],
  parsed: ParsedPolicyResult,
): ParsedPolicyResult {
  if (!parsed.parserVersion.includes("+prod-r5-uiic_precision")) return parsed;
  const fields = [...parsed.fields];
  const boundedPages = pages.slice(0, 2);

  const currentChassis = fields.find((field) => field.key === "vehicle_chassis_number")?.value?.trim() ?? "";
  const recoveredChassis = findStrictVehicleId(boundedPages, /(?:Chassis\s+Number|Chassis\s+No\.?)\b/i);
  if (recoveredChassis) replaceField(fields, "vehicle_chassis_number", recoveredChassis, "Chassis number");
  else if (!plausibleVehicleId(currentChassis)) replaceField(fields, "vehicle_chassis_number", null, "Chassis number");

  const currentEngine = fields.find((field) => field.key === "vehicle_engine_number")?.value?.trim() ?? "";
  const recoveredEngine = findStrictVehicleId(boundedPages, /(?:Engine\s+Number|Engine\s+No\.?)\b/i);
  if (recoveredEngine) replaceField(fields, "vehicle_engine_number", recoveredEngine, "Engine number");
  else if (!plausibleVehicleId(currentEngine)) replaceField(fields, "vehicle_engine_number", null, "Engine number");

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
    const pageLines = pages[pageIndex].split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    for (let i = 0; i < pageLines.length; i += 1) {
      if (!/^\s*Policy\s+(?:Number|No\.?)\b/i.test(pageLines[i])) continue;
      if (/Previous|Prev\.?/i.test(pageLines[i])) continue;
      const sameLine = pageLines[i].replace(/^\s*Policy\s+(?:Number|No\.?)\s*[:#-]?\s*/i, "").trim();
      const candidates = [sameLine, pageLines[i + 1] ?? ""];
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

function findExplicitMakeModel(pages: string[]) {
  for (let pageIndex = 0; pageIndex < pages.length; pageIndex += 1) {
    const pageLines = pages[pageIndex].split(/\r?\n/).map((line) => line.replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim()).filter(Boolean);
    for (let i = 0; i < pageLines.length; i += 1) {
      const line = pageLines[i];
      const label = /Vehicle\s+Make\s*&\s*Model/i;
      if (!label.test(line)) continue;

      const pieces: string[] = [];
      const afterLabel = line.replace(/^.*?Vehicle\s+Make\s*&\s*Model\s*/i, "").trim();
      if (afterLabel) pieces.push(afterLabel);
      for (let j = i + 1; j < Math.min(pageLines.length, i + 6); j += 1) {
        if (/Type\s+Of\s+Body|Registration\s+Date|Engine\s+Number|INSURED\s+DECLARED\s+VALUE/i.test(pageLines[j])) break;
        pieces.push(pageLines[j]);
        if (/\//.test(pageLines[j]) && j + 1 < pageLines.length && /Type\s+Of\s+Body/i.test(pageLines[j + 1])) {
          // same-line make/model case has already included both sides of slash.
          break;
        }
      }
      const block = pieces.join(" ").replace(/\bnull\b/gi, " ").replace(/\s+/g, " ").trim();
      const slash = block.indexOf("/");
      if (slash < 1) continue;
      const make = block.slice(0, slash).trim();
      let model = block.slice(slash + 1).trim();
      model = model.replace(/\s+Type\s+Of\s+Body.*$/i, "").trim();
      if (!goodVehicleText(make) || !goodVehicleText(model)) continue;
      return { make, model, page: pageIndex + 1 };
    }
  }
  return null;
}

function findStrictVehicleId(pages: string[], label: RegExp) {
  for (let pageIndex = 0; pageIndex < pages.length; pageIndex += 1) {
    const pageLines = pages[pageIndex].split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    for (let i = 0; i < pageLines.length; i += 1) {
      const line = pageLines[i];
      if (!label.test(line)) continue;

      const sameLine = line.replace(label, " ").trim();
      const same = firstPlausibleVehicleId(sameLine);
      if (same) return { value: same, page: pageIndex + 1 };

      const remainder = line.replace(label, " ").replace(/[:#&|.,;()\s/-]+/g, "").trim();
      const hasSiblingLabel = /Engine|Chassis|Make|Model|Body|Year|Capacity|GVW|Weight|Registration/i.test(remainder);
      if (remainder || hasSiblingLabel) continue;

      const next = firstPlausibleVehicleId(pageLines[i + 1] ?? "");
      if (next) return { value: next, page: pageIndex + 1 };
    }
  }
  return null;
}

function firstPlausibleVehicleId(text: string): string | null {
  const candidates = text.match(/[A-Z0-9][A-Z0-9\/-]{11,34}/gi) ?? [];
  for (const raw of candidates) {
    const value = raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (plausibleVehicleId(value)) return value;
  }
  return null;
}

function goodVehicleText(value: string) {
  return value.length >= 3 && value.length <= 80 && !/^(?:MODEL|YEAR|TYPE OF BODY|CUBIC CAPACITY|WEIGHT)$/i.test(value)
    && !/SEATING CAPACITY|YEAR OF MANUFACTURE|GROSS VEHICLE WEIGHT/i.test(value);
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
