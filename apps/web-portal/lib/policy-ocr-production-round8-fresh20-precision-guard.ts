import type { ParsedPolicyField, ParsedPolicyResult } from "@/lib/policy-ocr-parsers";
import type { StructuredPolicyTable } from "@/lib/policy-ocr-iffco-structured-refiner";

type Fields = Map<string, ParsedPolicyField>;

const LABELS: Record<string, string> = {
  policy_product: "Policy Product",
  cpa_opted: "Owner-driver CPA opted",
  cpa_premium: "Owner-driver CPA premium",
  total_premium: "Net Premium",
  tax_amount: "GST / Tax",
  gross_premium: "Gross / Total Payable",
};

export function refineProductionRound8Fresh20Precision(
  pages: string[],
  _tables: StructuredPolicyTable[],
  parsed: ParsedPolicyResult,
): ParsedPolicyResult {
  const fields: Fields = new Map(parsed.fields.map((field) => [field.key, field]));
  const header = (pages[0] ?? "").split(/\r?\n/).slice(0, 180).join(" ");
  let changed = false;

  changed = deleteIf(fields, "vehicle_make", looksLikeVehicleLabelNoise) || changed;
  changed = deleteIf(fields, "vehicle_model", looksLikeVehicleLabelNoise) || changed;
  changed = deleteIf(fields, "vehicle_class", (value) => value.length > 24 || /category of the vehicle|class of vehicle/i.test(value)) || changed;
  changed = deleteIf(fields, "vehicle_registration_number", (value) => {
    const normalized = compact(value);
    return /REGISTRATION(?:DATE|NO|NUMBER)/.test(normalized) || normalized.length > 15;
  }) || changed;
  changed = deleteIf(fields, "vehicle_engine_number", looksLikeIdentifierLabelNoise) || changed;
  // Chassis formats vary across insurers and legacy/approved layouts. Round 8 is
  // precision-first, so only withhold values that are clearly label contamination;
  // do not reject a value solely because it is shorter than a VIN-like 17 chars.
  changed = deleteIf(fields, "vehicle_chassis_number", looksLikeIdentifierLabelNoise) || changed;

  const engine = compact(fields.get("vehicle_engine_number")?.value ?? "");
  const chassis = compact(fields.get("vehicle_chassis_number")?.value ?? "");
  if (engine && chassis && engine === chassis) {
    fields.delete("vehicle_engine_number");
    changed = true;
  }

  const capacity = numberField(fields, "vehicle_capacity");
  // Reject obvious year contamination. PCP/TWP capacity is commonly engine CC,
  // so values such as 853/1493/1498 are legitimate and must not be blanket-rejected.
  if (capacity != null && capacity >= 1900 && capacity <= 2100) {
    fields.delete("vehicle_capacity");
    changed = true;
  }
  changed = deleteIf(fields, "vehicle_rto_name", (value) => /^(?:LOCATION|RTO|REGN\.?\s*AUTHORITY)$/i.test(value.trim())) || changed;

  const net = numberField(fields, "total_premium");
  const tax = numberField(fields, "tax_amount");
  const gross = numberField(fields, "gross_premium");
  if (net != null && gross != null && gross <= net) {
    fields.delete("gross_premium");
    changed = true;
  }
  if (net != null && net >= 1000 && tax != null && tax > 0 && tax < 100) {
    fields.delete("tax_amount");
    changed = true;
  }

  const cpaOpted = fields.get("cpa_opted")?.value?.trim() ?? "";
  const cpa = numberField(fields, "cpa_premium");
  // Some approved layouts retain a small non-owner-driver PA component while
  // cpa_opted is No. Preserve the established ₹50 compatibility case; only
  // withhold larger contradictory values that match the fresh20 contamination.
  if (/^No$/i.test(cpaOpted) && cpa != null && cpa > 50) {
    fields.delete("cpa_premium");
    changed = true;
  }
  if (/^Yes$/i.test(cpaOpted) && cpa != null && (cpa < 50 || cpa > 1000)) {
    fields.delete("cpa_premium");
    changed = true;
  }

  if (parsed.parserId === "national_motor_v1" && /NATIONAL\s+INSURANCE/i.test(header)) {
    const page1 = pages[0] ?? "";
    if (/Long\s+Term\s+Two\s+Wheelers\s+Bundled\s+Policy/i.test(page1)) {
      set(fields, "policy_product", "Bundled", .999, 1, "Round 8 National printed product heading");
      changed = true;
    }
    const premium = firstMoney(page1, /(?:प्रीमियम\s*\/\s*)?Premium\s*[₹:]?\s*([\d,]+(?:\.\d+)?)/i);
    const igst = firstMoney(page1, /(?:आईजीएसटी\s*\/\s*)?IGST\s*[₹:]?\s*([\d,]+(?:\.\d+)?)/i);
    const total = firstMoney(page1, /Total\s+Amount\s*[₹:]?\s*([\d,]+(?:\.\d+)?)/i);
    if (premium != null) { setMoney(fields, "total_premium", premium, 1, "Round 8 National printed Premium"); changed = true; }
    if (igst != null) { setMoney(fields, "tax_amount", igst, 1, "Round 8 National printed IGST"); changed = true; }
    if (total != null) { setMoney(fields, "gross_premium", total, 1, "Round 8 National printed Total Amount"); changed = true; }
  }

  if (parsed.parserId === "united_india_motor_v1" && /UNITED\s+INDIA\s+INSURANCE/i.test(header)) {
    const text = pages.join("\n");
    const cpaPrinted = firstMoney(text, /Compulsory\s+PA\s+for\s+Owner\s+Driver\s+([\d,]+(?:\.\d+)?)/i);
    if (cpaPrinted != null && cpaPrinted > 0) {
      const page = findPage(pages, /Compulsory\s+PA\s+for\s+Owner\s+Driver/i);
      set(fields, "cpa_opted", "Yes", .999, page, "Round 8 UIIC printed compulsory PA");
      setMoney(fields, "cpa_premium", cpaPrinted, page, "Round 8 UIIC printed compulsory PA");
      changed = true;
    }

    const taxParts = [...text.matchAll(/(?:CGST|SGST|IGST)(?:-[^(\n:]*)?(?:\([^)]*\))?\s*:\s*([\d,]+(?:\.\d+)?)/gi)]
      .map((match) => parseMoney(match[1]))
      .filter((value): value is number => value != null && value >= 0);
    if (taxParts.length >= 1) {
      const taxTotal = taxParts.reduce((sum, value) => sum + value, 0);
      setMoney(fields, "tax_amount", taxTotal, 1, "Round 8 UIIC sum of printed GST components");
      changed = true;
    }
    const payable = firstMoney(text, /TOTAL\s+PAYABLE\s+PREMIUM\s+([\d,]+(?:\.\d+)?)/i);
    if (payable != null) {
      setMoney(fields, "gross_premium", payable, findPage(pages, /TOTAL\s+PAYABLE\s+PREMIUM/i), "Round 8 UIIC printed total payable premium");
      changed = true;
    } else {
      const uiicNet = numberField(fields, "total_premium");
      const uiicTax = numberField(fields, "tax_amount");
      if (uiicNet != null && uiicTax != null && uiicTax > 0) {
        setMoney(fields, "gross_premium", uiicNet + uiicTax, 1, "Round 8 UIIC printed net plus split GST");
        changed = true;
      }
    }
  }

  if (!changed) return parsed;
  return {
    ...parsed,
    parserVersion: `${parsed.parserVersion}+prod-r8-fresh20_precision`,
    fields: [...fields.values()],
    warnings: [
      ...parsed.warnings.filter((warning) => !/round 8 fresh20/i.test(warning)),
      "Production benchmark round 8 fresh20 precision guard applied.",
    ],
  };
}

function looksLikeVehicleLabelNoise(value: string) {
  const text = value.trim();
  return /^(?:\/?Model(?:\s*-|\s*:)?|Model\s+Type|Type\s+of\s+Body|Cubic|&\s*Place|of\s+the\s+Vehicle|\(Indigenous\s+or)/i.test(text)
    || /your insurance experience|MODEL TYPE OF BODY|HP\/Cubic/i.test(text);
}

function looksLikeIdentifierLabelNoise(value: string) {
  const text = compact(value);
  return !text || /(?:CHASSISNO|CHASSISNUMBER|ENGINENO|ENGINENUMBER|REGISTRATION)/.test(text)
    || /^(?:CHASSIS|ENGINE|ENGINENO)$/.test(text);
}

function deleteIf(fields: Fields, key: string, predicate: (value: string) => boolean) {
  const value = fields.get(key)?.value?.trim();
  if (!value || !predicate(value)) return false;
  fields.delete(key);
  return true;
}

function compact(value: string) { return value.toUpperCase().replace(/[^A-Z0-9]/g, ""); }

function numberField(fields: Fields, key: string): number | null {
  const raw = fields.get(key)?.value;
  return raw ? parseMoney(raw) : null;
}

function parseMoney(value: string | undefined): number | null {
  if (!value) return null;
  const parsed = Number(value.replace(/[₹,\s]/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function firstMoney(text: string, pattern: RegExp): number | null {
  const match = text.match(pattern);
  return parseMoney(match?.[1]);
}

function findPage(pages: string[], pattern: RegExp) {
  const index = pages.findIndex((page) => pattern.test(page));
  return index >= 0 ? index + 1 : 1;
}

function setMoney(fields: Fields, key: string, value: number, page: number, evidence: string) {
  set(fields, key, Number.isInteger(value) ? String(value) : String(Number(value.toFixed(2))), .999, page, evidence);
}

function set(fields: Fields, key: string, value: string, confidence: number, page: number, evidence: string) {
  fields.set(key, { key, label: LABELS[key] ?? key, value, confidence, page, evidence });
}
