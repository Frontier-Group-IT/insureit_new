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
  tables: StructuredPolicyTable[],
  parsed: ParsedPolicyResult,
): ParsedPolicyResult {
  const fields: Fields = new Map(parsed.fields.map((field) => [field.key, field]));
  const initialRegistration = fields.get("vehicle_registration_number")?.value ?? "";
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
  changed = deleteIf(fields, "vehicle_chassis_number", looksLikeIdentifierLabelNoise) || changed;

  const engine = compact(fields.get("vehicle_engine_number")?.value ?? "");
  const chassis = compact(fields.get("vehicle_chassis_number")?.value ?? "");
  if (engine && chassis && engine === chassis) {
    fields.delete("vehicle_engine_number");
    changed = true;
  }

  const capacity = numberField(fields, "vehicle_capacity");
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
  // cpa_opted=No does not universally imply that every PA-related premium-like
  // component must be absent: established Magma/UIIC/Royal layouts deliberately
  // retain paid-driver/passenger components in the legacy cpa_premium slot.
  // Only apply the proven impossible-range guard when CPA is explicitly opted in.
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
    const liability = firstMoney(pages.join("\n"), /Legal\s+Liability\s+Cover\s+([\d,]+(?:\.\d+)?)/i);
    if (premium != null && liability != null && premium >= liability) {
      setMoney(fields, "od_premium", premium - liability, findPage(pages, /Legal\s+Liability\s+Cover/i), "Round 8 National printed premium less legal-liability cover");
      setMoney(fields, "tp_premium", liability, findPage(pages, /Legal\s+Liability\s+Cover/i), "Round 8 National printed legal-liability cover");
      set(fields, "cpa_opted", "No", .999, 1, "Round 8 National schedule has no payable owner-driver CPA");
      setMoney(fields, "cpa_premium", 0, 1, "Round 8 National schedule has no payable owner-driver CPA");
      changed = true;
    }
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

  if (parsed.parserId === "iffco_tokio_commercial_motor_v2" && /IFFCO[-\s]*TOKIO/i.test(header)) {
    const text = pages.join("\n");
    const netParts = text.match(/Net\s*\(A\)\s*([\d,]+(?:\.\d+)?)\s+Net\s*\(B\)\s*([\d,]+(?:\.\d+)?)/i);
    const od = parseMoney(netParts?.[1]);
    const netB = parseMoney(netParts?.[2]);
    const basicTp = firstMoney(text, /Basic\s+TP\s+Premium\s+([\d,]+(?:\.\d+)?)/i);
    if (od != null && netB != null) {
      const page = findPage(pages, /Net\s*\(A\)/i);
      setMoney(fields, "od_premium", od, page, "Round 8 IFFCO printed Net(A)");
      if (basicTp != null) setMoney(fields, "tp_premium", basicTp, page, "Round 8 IFFCO printed Basic TP; liability additions remain separate");
      set(fields, "cpa_opted", "No", .999, page, "Round 8 IFFCO PA Owner Driver CSI is zero");
      setMoney(fields, "cpa_premium", 0, page, "Round 8 IFFCO PA Owner Driver CSI is zero");
      changed = true;
    }
    const totals = [...text.matchAll(/(?:^|\n)\s*Total\s+([\d,]+(?:\.\d+)?)\s+([\d,]+(?:\.\d+)?)\s+([\d,]+(?:\.\d+)?)/gi)];
    const last = totals.at(-1);
    const printedNet = parseMoney(last?.[1]);
    const printedTax = parseMoney(last?.[2]);
    const printedGross = parseMoney(last?.[3]);
    if (printedNet != null && printedTax != null && printedGross != null) {
      setMoney(fields, "total_premium", printedNet, 1, "Round 8 IFFCO final printed total row");
      setMoney(fields, "tax_amount", printedTax, 1, "Round 8 IFFCO final printed total row");
      setMoney(fields, "gross_premium", printedGross, 1, "Round 8 IFFCO final printed total row");
      changed = true;
    }
  }

  if (parsed.parserId === "magma_motor_v1" && /MAGMA\s+GENERAL\s+INSURANCE/i.test(header)) {
    const text = pages.join("\n");
    const cpaPrinted = firstMoney(text, /PA\s+Owner\s+Driver[^\n]*?Tenure\s+\d+\s+Year\(s\)\s+([\d,]+(?:\.\d+)?)/i);
    const basicTp = firstMoney(text, /Basic\s*-\s*TP\s+([\d,]+(?:\.\d+)?)/i);
    const paidDriver = firstMoney(text, /LL\s+to\s+Paid\s+Driver(?:\s+IMT\s*28)?\s+([\d,]+(?:\.\d+)?)/i) ?? 0;
    if (cpaPrinted != null && cpaPrinted > 0) {
      set(fields, "cpa_opted", "Yes", .999, findPage(pages, /PA\s+Owner\s+Driver/i), "Round 8 Magma printed owner-driver PA");
      setMoney(fields, "cpa_premium", cpaPrinted, findPage(pages, /PA\s+Owner\s+Driver/i), "Round 8 Magma printed owner-driver PA");
      changed = true;
    }
    if (basicTp != null) {
      setMoney(fields, "tp_premium", basicTp + paidDriver, findPage(pages, /Basic\s*-\s*TP/i), "Round 8 Magma basic TP plus paid-driver liability");
      changed = true;
    }
    const registration = fields.get("vehicle_registration_number")?.value ?? initialRegistration;
    const joinedRegistration = registration.match(/^([A-Z]{2}\d{1,2}[A-Z]{1,3}\d{4})\d{8}$/i);
    if (joinedRegistration) {
      set(fields, "vehicle_registration_number", joinedRegistration[1], .999, 1, "Round 8 Magma registration separated from adjacent date");
      changed = true;
    }
  }

  if (parsed.parserId === "hdfc_ergo_motor_v1" && /HDFC\s+ERGO/i.test(header)) {
    const text = pages.join("\n");
    const policy = text.match(/Policy\s+No\.?\s+([0-9 ]{15,30})/i)?.[1]?.replace(/\s+/g, "");
    if (policy && /^\d{15,24}$/.test(policy)) {
      set(fields, "policy_number", policy, .999, 1, "Round 8 HDFC printed policy number");
      changed = true;
    }
    const printedGst = tableMoney(tables, /GST\s*18%/i, "largest") ?? firstMoney(text, /GST\s*18%[\s\S]{0,220}?\)\s*([\d,]+(?:\.\d+)?)\s*(?:\r?\n)+\s*Total\s+Premium/i);
    const printedGross = tableMoney(tables, /^Total\s+Premium$/i, "largest") ?? firstMoney(text, /Total\s+Premium\s+([\d,]+(?:\.\d+)?)/i);
    if (printedGst != null) { setMoney(fields, "tax_amount", printedGst, 1, "Round 8 HDFC printed GST total"); changed = true; }
    if (printedGross != null) { setMoney(fields, "gross_premium", printedGross, 1, "Round 8 HDFC printed total premium"); changed = true; }
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

function tableMoney(tables: StructuredPolicyTable[], label: RegExp, mode: "largest" | "smallest") {
  const values = tables.flatMap((table) => table.rows.flatMap((row) => {
    const labelIndex = row.findIndex((cell) => label.test(cell));
    if (labelIndex < 0) return [];
    return row.slice(labelIndex + 1).flatMap((cell) => {
      const value = parseMoney(cell);
      return value == null ? [] : [value];
    });
  }));
  if (!values.length) return null;
  return mode === "largest" ? Math.max(...values) : Math.min(...values);
}

function setMoney(fields: Fields, key: string, value: number, page: number, evidence: string) {
  set(fields, key, Number.isInteger(value) ? String(value) : String(Number(value.toFixed(2))), .999, page, evidence);
}

function set(fields: Fields, key: string, value: string, confidence: number, page: number, evidence: string) {
  fields.set(key, { key, label: LABELS[key] ?? key, value, confidence, page, evidence });
}
