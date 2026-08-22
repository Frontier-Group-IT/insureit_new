import type { ParsedPolicyField, ParsedPolicyResult } from "@/lib/policy-ocr-parsers";
import type { StructuredPolicyTable } from "@/lib/policy-ocr-iffco-structured-refiner";

type Fields = Map<string, ParsedPolicyField>;
type Hit = { value: string; page: number; evidence: string };
type Money = { value: number; page: number; evidence: string };
type Layout =
  | "uiic_gcv_package"
  | "uiic_pcv_package"
  | "uiic_gcv_3w_tp"
  | "hdfc_pcp"
  | "hdfc_twp_saod"
  | "hdfc_twp_tp"
  | "national_gcv"
  | "national_pcp_tp"
  | "national_twp_bundled"
  | "new_india_saod"
  | "royal_pcp_tp"
  | "magma_pcp_saod"
  | "magma_pcp_package"
  | "magma_gcv_tp"
  | "digit_pcp_package";

const labels: Record<string, string> = {
  vehicle_registration_status: "Registration status",
  vehicle_registration_number: "Registration number",
  vehicle_class: "Vehicle class",
  vehicle_make: "Vehicle make",
  vehicle_model: "Vehicle model",
  vehicle_fuel_type: "Fuel type",
  vehicle_manufacturing_year: "Manufacturing year",
  vehicle_capacity: "Vehicle capacity",
  vehicle_chassis_number: "Chassis number",
  vehicle_engine_number: "Engine number",
  vehicle_rto_name: "RTO name",
  vehicle_rto_state: "RTO state",
  policy_product: "Policy product",
  policy_number: "Policy number",
  insurer_name: "Insurance company",
  policy_start_date: "Valid from",
  policy_end_date: "Valid upto",
  idv: "IDV / Sum insured",
  od_premium: "OD premium",
  tp_premium: "Third party premium",
  cpa_opted: "CPA opted",
  cpa_premium: "CPA amount",
  total_premium: "Printed net premium",
  tax_amount: "Printed GST",
  gross_premium: "Printed gross premium",
};

const policyKeys = [
  "policy_product",
  "policy_number",
  "insurer_name",
  "policy_start_date",
  "policy_end_date",
  "idv",
  "od_premium",
  "tp_premium",
  "cpa_opted",
  "cpa_premium",
  "total_premium",
  "tax_amount",
  "gross_premium",
];

export function refineApprovedMotorPolicyLayout(
  pages: string[],
  tables: StructuredPolicyTable[],
  parsed: ParsedPolicyResult,
): ParsedPolicyResult {
  const text = norm([...pages, ...tables.flatMap((table) => table.rows.flat())].join(" | "));
  const layout = detect(text, parsed.parserId);
  if (!layout) return parsed;

  const parserId = parserFor(layout);
  const fields: Fields = new Map(parsed.fields.map((field) => [field.key, field]));
  for (const key of policyKeys) fields.delete(key);

  cleanVehicle(fields);
  commonVehicle(pages, tables, fields, layout);

  if (layout.startsWith("uiic_")) refineUiic(pages, tables, fields, text, layout);
  else if (layout.startsWith("hdfc_")) refineHdfc(pages, tables, fields, layout);
  else if (layout.startsWith("national_")) refineNational(pages, tables, fields, text, layout);
  else if (layout === "new_india_saod") refineNewIndia(pages, tables, fields);
  else if (layout === "royal_pcp_tp") refineRoyal(pages, tables, fields);
  else if (layout.startsWith("magma_")) refineMagma(pages, tables, fields, text, layout);
  else refineDigit(pages, tables, fields);

  cleanVehicle(fields);
  repairIds(fields);

  const warnings = parsed.warnings.filter(
    (warning) => !/not fully supported|missing or uncertain|financial fields require manual review|premium fields were withheld/i.test(warning),
  );
  const required = [
    "policy_product",
    "idv",
    "od_premium",
    "tp_premium",
    "policy_number",
    "insurer_name",
    "policy_start_date",
    "policy_end_date",
  ];
  const missing = required.filter((key) => !fields.get(key)?.value?.trim());
  if (missing.length) warnings.push(`Review required. Missing or uncertain fields: ${missing.join(", ")}.`);

  const base = parserId === parsed.parserId ? parsed.parserVersion : `${parserId}.1.0`;
  return {
    ...parsed,
    parserId,
    parserVersion: `${base}+layout-${layout}-v5`,
    fields: [...fields.values()],
    warnings,
  };
}

function detect(text: string, parserId: string): Layout | null {
  if (/UNITED\s+INDIA\s+INSURANCE/i.test(text)) {
    if (/GCV\s+PUBLIC\s+CARRIERS?\s+MOTORIZED\s+3\s+WHEELERS?.*LIABILITY\s+ONLY|MOTORIZED\s+3\s+WHEELERS?.*LIABILITY\s+ONLY/i.test(text)) {
      return "uiic_gcv_3w_tp";
    }
    if (/PCV\s+4\s+WHEELER.*PACKAGE|PASSENGER\s+CARRYING\s+VEHICLE\s+PACKAGE/i.test(text)) {
      return "uiic_pcv_package";
    }
    if (/(?:GCV|GOODS\s+CARRYING|PUBLIC\s+CARRIER).*PACKAGE/i.test(text)) {
      return "uiic_gcv_package";
    }
  }

  if (/HDFC\s+ERGO\s+GENERAL\s+INSURANCE/i.test(text)) {
    if (/STANDALONE\s+MOTOR\s+OWN\s+DAMAGE\s+COVER\s*-?\s*TWO\s+WHEELER/i.test(text)) return "hdfc_twp_saod";
    if (/TWO\s+WHEELER\s+LIABILITY\s+ONLY|MOTOR\s+INSURANCE\s*-?\s*TWO\s+WHEELER\s+LIABILITY/i.test(text)) return "hdfc_twp_tp";
    if (/PRIVATE\s+CAR\s+(?:COMPREHENSIVE|PACKAGE)/i.test(text)) return "hdfc_pcp";
  }

  if (/NATIONAL\s+INSURANCE/i.test(text)) {
    if (/TWO\s+WHEELERS?\s*-?\s*OD\s+WITH\s+LONGTERM\s+ACT|LONG\s+TERM\s+TWO\s+WHEELERS?\s+BUNDLED/i.test(text)) {
      return "national_twp_bundled";
    }
    if (/PRIVATE\s+CAR\s*-?\s*LIABILITY\s+ONLY|MOTOR\s*-?\s*PRIVATE\s+CAR\s*-?\s*LIABILITY\s+ONLY/i.test(text)) {
      return "national_pcp_tp";
    }
    if (/GOODS\s+CARRYING\s+VEHICLE|\bGCV\b/i.test(text)) return "national_gcv";
  }

  if (/MAGMA\s+GENERAL\s+INSURANCE|MAGMAINSURANCE\.COM/i.test(text)) {
    if (/COMMERCIAL\s+VEHICLE\s+LIABILITY\s+ONLY/i.test(text)) return "magma_gcv_tp";
    if (/PRIVATE\s+CAR\s+PACKAGE\s+POLICY/i.test(text)) return "magma_pcp_package";
    if (/STAND[-\s]*ALONE\s+OWN\s+DAMAGE.*PRIVATE\s+CAR|PRIVATE\s+CAR.*STAND[-\s]*ALONE\s+OWN\s+DAMAGE/i.test(text)) {
      return "magma_pcp_saod";
    }
  }

  if (/GO\s+DIGIT\s+GENERAL\s+INSURANCE|DIGIT\s+PRIVATE\s+CAR\s+POLICY/i.test(text)) {
    if (/DIGIT\s+PRIVATE\s+CAR\s+POLICY/i.test(text)) return "digit_pcp_package";
  }

  if (/NEW\s+INDIA\s+ASSURANCE/i.test(text) && /STANDALONE\s+MOTOR\s+OWN\s+DAMAGE|STAND[-\s]*ALONE\s+OWN\s+DAMAGE|\bSAOD\b/i.test(text)) {
    return "new_india_saod";
  }

  if (/ROYAL\s+SUNDARAM/i.test(text) && /LIABILITY\s+ONLY/i.test(text)) return "royal_pcp_tp";
  if (parserId === "royal_sundaram_motor_v1" && /LIABILITY\s+ONLY/i.test(text)) return "royal_pcp_tp";
  return null;
}

function parserFor(layout: Layout) {
  if (layout.startsWith("uiic_")) return "united_india_motor_v1";
  if (layout.startsWith("hdfc_")) return "hdfc_ergo_motor_v1";
  if (layout.startsWith("national_")) return "national_motor_v1";
  if (layout === "new_india_saod") return "new_india_motor_v1";
  if (layout === "royal_pcp_tp") return "royal_sundaram_motor_v1";
  if (layout.startsWith("magma_")) return "magma_motor_v1";
  return "digit_commercial_motor_v1";
}

function refineUiic(
  pages: string[],
  tables: StructuredPolicyTable[],
  fields: Fields,
  text: string,
  layout: Extract<Layout, `uiic_${string}`>,
) {
  set(fields, "insurer_name", "United India Insurance Company Limited", 1, 1, "UIIC header");
  identity(fields, pages, "uiic");

  const liabilityOnly = layout === "uiic_gcv_3w_tp";
  set(fields, "policy_product", liabilityOnly ? "Third Party" : "Package", 1, 1, liabilityOnly ? "UIIC liability-only heading" : "UIIC package heading");

  const idv = liabilityOnly
    ? null
    : amt(tables, /Insured'?s\s+Declared\s+Value|Total\s+IDV|Total\s+Value/i, 1000, 1e9, "largest")
      ?? txt(pages, /Insured'?s\s+Declared\s+Value/i, 1000, 1e9, "first");
  const od = liabilityOnly
    ? null
    : amt(tables, /Gross\s+OD\s*\(?A\)?/i, 0, 1e7, "last")
      ?? txt(pages, /Gross\s+OD\s*\(?A\)?/i, 0, 1e7, "first");
  const basicTp = amt(tables, /(?:^|\b)B\.\s*Basic\s*-?\s*TP\b|^Basic\s*-?\s*TP\b/i, 0, 1e7, "last")
    ?? txt(pages, /B\.\s*Basic\s*-?\s*TP|Basic\s*-?\s*TP/i, 0, 1e7, "first");
  const grossTp = amt(tables, /Gross\s+TP\s*\(?B\)?|Total\s+Liability\s+Premium/i, 0, 1e7, "last")
    ?? txt(pages, /Gross\s+TP\s*\(?B\)?|Total\s+Liability\s+Premium/i, 0, 1e7, "first");
  const ownerCpa = amt(tables, /Compulsory\s+(?:PA|Personal\s+Accident)\s+(?:for\s+)?Owner\s*[- ]?Driver/i, 0, 1e5, "last")
    ?? txt(pages, /Compulsory\s+(?:PA|Personal\s+Accident)\s+(?:for\s+)?Owner\s*[- ]?Driver/i, 0, 1e5, "first");
  const net = amt(tables, /Gross\s+OD\s*&\s*TP|Premium\s*\(?A\s*\+\s*B\)?|Total\s+Liability\s+Premium/i, 0, 1e7, "last")
    ?? txt(pages, /Gross\s+OD\s*&\s*TP|Premium\s*\(?A\s*\+\s*B\)?|Total\s+Liability\s+Premium/i, 0, 1e7, "first")
    ?? txt(pages, /^Premium\s*:/i, 0, 1e7, "first");
  const tax = uiicTax(pages, tables);
  const gross = amt(tables, /Total\s*\(?Rounded\s+Off\)?|Total\s+Payable\s+Premium/i, 0, 1e7, "last")
    ?? txt(pages, /Total\s*\(?Rounded\s+Off\)?|Total\s+Payable\s+Premium/i, 0, 1e7, "first");

  if (liabilityOnly) {
    set(fields, "idv", "0", 1, 1, "liability only");
    set(fields, "od_premium", "0", 1, 1, "liability only");
  } else {
    putMoney(fields, "idv", idv);
    putMoney(fields, "od_premium", od);
  }
  putMoney(fields, "tp_premium", basicTp);

  const additions = grossTp && basicTp
    ? round(grossTp.value - basicTp.value)
    : net && basicTp
      ? round(net.value - (od?.value ?? 0) - basicTp.value)
      : null;
  if (additions !== null && additions >= 0) {
    set(fields, "cpa_premium", money(additions), .99, grossTp?.page ?? net?.page ?? 1, "liability additions outside Basic TP");
  }

  if (ownerCpa) {
    set(fields, "cpa_opted", ownerCpa.value > 0 ? "Yes" : "No", .99, ownerCpa.page, ownerCpa.evidence);
  } else if (/CPA\s+COVER\s+IS\s+REMOVED|COMPULSORY\s+PERSONAL\s+ACCIDENT.*COVER\s+IS\s+REMOVED/i.test(text)) {
    set(fields, "cpa_opted", "No", .99, 1, "explicit owner-driver CPA removal note");
  } else if (additions === 0) {
    set(fields, "cpa_opted", "No", .95, 1, "no owner-driver CPA evidence");
  }

  putMoney(fields, "total_premium", net);
  putMoney(fields, "tax_amount", tax);
  putMoney(fields, "gross_premium", gross);
  if (!gross && net && tax) set(fields, "gross_premium", money(net.value + tax.value), .96, net.page, "net + tax");
}

function uiicTax(pages: string[], tables: StructuredPolicyTable[]): Money | null {
  const other = amt(tables, /IGST[-\s]*Others\s*\(?\s*18\s*%?\s*\)?/i, 0, 1e7, "last")
    ?? txt(pages, /IGST[-\s]*Others\s*\(?\s*18\s*%?\s*\)?/i, 0, 1e7, "last");
  const basic = amt(tables, /IGST[-\s]*Basic\s*TP\s*\(?\s*5\s*%?\s*\)?/i, 0, 1e7, "last")
    ?? txt(pages, /IGST[-\s]*Basic\s*TP\s*\(?\s*5\s*%?\s*\)?/i, 0, 1e7, "last");
  if (other && basic) return { value: round(other.value + basic.value), page: other.page, evidence: `${other.evidence} | ${basic.evidence}` };
  const igst = amt(tables, /IGST\s*\(?\s*18\s*%?\s*\)?/i, 0, 1e7, "last")
    ?? txt(pages, /IGST\s*\(?\s*18\s*%?\s*\)?/i, 0, 1e7, "last");
  if (igst) return igst;
  return sumParts(pages, tables, [/CGST/i, /SGST/i]);
}

function refineHdfc(
  pages: string[],
  tables: StructuredPolicyTable[],
  fields: Fields,
  layout: Extract<Layout, `hdfc_${string}`>,
) {
  set(fields, "insurer_name", "HDFC ERGO General Insurance Company Limited", 1, 1, "HDFC current-policy header");
  identity(fields, pages, "hdfc");

  if (layout === "hdfc_twp_tp") {
    set(fields, "policy_product", "Third Party", 1, 1, "TWP liability-only heading");
    set(fields, "idv", "0", 1, 1, "liability only");
    set(fields, "od_premium", "0", 1, 1, "liability only");
    const liability = amt(tables, /Net\s+Liability\s+Premium|Total\s+Liability\s+Premium/i, 0, 1e7, "last")
      ?? txt(pages, /Net\s+Liability\s+Premium|Total\s+Liability\s+Premium/i, 0, 1e7, "first");
    const cpa = ownerDriverPremium(pages, tables);
    if (liability) set(fields, "tp_premium", money(round(liability.value - (cpa?.value ?? 0))), .99, liability.page, "liability total less owner-driver PA");
    set(fields, "cpa_opted", cpa && cpa.value > 0 ? "Yes" : "No", 1, cpa?.page ?? 1, cpa?.evidence ?? "no owner-driver PA");
    set(fields, "cpa_premium", money(cpa?.value ?? 0), 1, cpa?.page ?? 1, cpa?.evidence ?? "no owner-driver PA");
    putMoney(fields, "total_premium", liability);
    finishHdfc(pages, tables, fields, liability);
    return;
  }

  const idv = amt(tables, /Total\s+IDV|Insured'?s\s+Declared\s+Value/i, 1000, 1e9, "largest")
    ?? txt(pages, /Total\s+IDV/i, 1000, 1e9, "last");
  putMoney(fields, "idv", idv);
  const od = amt(tables, /Net\s+Own\s+Damage\s+Premium/i, 0, 1e7, "last")
    ?? txt(pages, /Net\s+Own\s+Damage\s+Premium/i, 0, 1e7, "first");

  if (layout === "hdfc_twp_saod") {
    set(fields, "policy_product", "SAOD", 1, 1, "TWP standalone own-damage heading");
    putMoney(fields, "od_premium", od);
    putMoney(fields, "total_premium", od);
    set(fields, "tp_premium", "0", 1, 1, "active TP policy is a separate reference");
    set(fields, "cpa_opted", "No", 1, 1, "standalone own damage");
    set(fields, "cpa_premium", "0", 1, 1, "standalone own damage");
    finishHdfc(pages, tables, fields, od);
    return;
  }

  set(fields, "policy_product", "Package", 1, 1, "private-car package/comprehensive heading");
  const liability = amt(tables, /Net\s+Liability\s+Premium/i, 0, 1e7, "last")
    ?? txt(pages, /Net\s+Liability\s+Premium/i, 0, 1e7, "first");
  const cpa = ownerDriverPremium(pages, tables);
  const net = amt(tables, /Total\s+Package\s+Premium/i, 0, 1e7, "last")
    ?? txt(pages, /Total\s+Package\s+Premium/i, 0, 1e7, "first");
  putMoney(fields, "od_premium", od);
  if (liability) {
    const portalTp = round(liability.value - (cpa?.value ?? 0));
    if (portalTp >= 0) set(fields, "tp_premium", money(portalTp), .99, liability.page, "net liability less owner-driver PA");
  }
  set(fields, "cpa_opted", cpa && cpa.value > 0 ? "Yes" : "No", 1, cpa?.page ?? 1, cpa?.evidence ?? "no owner-driver PA");
  set(fields, "cpa_premium", money(cpa?.value ?? 0), 1, cpa?.page ?? 1, cpa?.evidence ?? "no owner-driver PA");
  putMoney(fields, "total_premium", net);
  finishHdfc(pages, tables, fields, net);
}

function finishHdfc(pages: string[], tables: StructuredPolicyTable[], fields: Fields, net: Money | null) {
  const tax = hdfcTax(pages, tables);
  putMoney(fields, "tax_amount", tax);
  const gross = txt(pages, /Total\s+Premium(?!\s*\(a\s*\+\s*b\))/i, 0, 1e7, "last")
    ?? amt(tables, /Total\s+Amount\s+Payable|Total\s+Premium/i, 0, 1e7, "last");
  putMoney(fields, "gross_premium", gross);
  if (!gross && net && tax) set(fields, "gross_premium", money(net.value + tax.value), .98, net.page, "net + GST");
}

function hdfcTax(pages: string[], tables: StructuredPolicyTable[]): Money | null {
  const igst = txt(pages, /Integrated\s+Tax\s+18%|\bIGST\b/i, 0, 1e7, "last")
    ?? amt(tables, /Integrated\s+Tax|\bIGST\b/i, 0, 1e7, "last");
  if (igst && igst.value > 20) return igst;
  const gst = txt(pages, /GST\s+18%/i, 0, 1e7, "last")
    ?? amt(tables, /GST\s+18%|Total\s+GST/i, 0, 1e7, "last");
  if (gst && gst.value > 20) return gst;
  return sumParts(pages, tables, [/CGST|Central\s+Tax/i, /SGST|State\s+Tax/i]);
}

function refineNational(
  pages: string[],
  tables: StructuredPolicyTable[],
  fields: Fields,
  text: string,
  layout: Extract<Layout, `national_${string}`>,
) {
  set(fields, "insurer_name", "National Insurance Company Limited", 1, 1, "National Insurance current-policy header");
  identity(fields, pages, "national");

  if (layout === "national_pcp_tp") {
    set(fields, "policy_product", "Third Party", 1, 1, "private-car liability-only heading");
    set(fields, "idv", "0", 1, 1, "liability only");
    set(fields, "od_premium", "0", 1, 1, "liability only");
    const tp = amt(tables, /Legal\s+Liability\s+Cover/i, 0, 1e7, "last")
      ?? txt(pages, /Legal\s+Liability\s+Cover/i, 0, 1e7, "first");
    const cpa = amt(tables, /Personal\s+Accident(?!\s+Cover\s+Details)/i, 0, 1e5, "last")
      ?? txt(pages, /Personal\s+Accident(?!\s+Cover\s+Details)/i, 0, 1e5, "first");
    const net = txt(pages, /^Premium\s*[₹:]?/i, 0, 1e7, "first")
      ?? (tp ? { value: round(tp.value + (cpa?.value ?? 0)), page: tp.page, evidence: "liability + personal accident" } : null);
    const tax = txt(pages, /\bIGST\b/i, 0, 1e7, "last") ?? amt(tables, /\bIGST\b/i, 0, 1e7, "last");
    const gross = txt(pages, /Total\s+Amount/i, 0, 1e7, "last") ?? amt(tables, /Total\s+Amount/i, 0, 1e7, "last");
    putMoney(fields, "tp_premium", tp);
    set(fields, "cpa_opted", cpa && cpa.value > 0 ? "Yes" : "No", 1, cpa?.page ?? 1, cpa?.evidence ?? "no personal accident premium");
    set(fields, "cpa_premium", money(cpa?.value ?? 0), 1, cpa?.page ?? 1, cpa?.evidence ?? "no personal accident premium");
    putMoney(fields, "total_premium", net);
    putMoney(fields, "tax_amount", tax);
    putMoney(fields, "gross_premium", gross);
    if (!gross && net && tax) set(fields, "gross_premium", money(net.value + tax.value), .98, net.page, "net + tax");
    return;
  }

  if (layout === "national_twp_bundled") {
    set(fields, "policy_product", "Bundled", 1, 1, "long-term two-wheeler bundled heading");
    const idv = amt(tables, /Vehicle\s+IDV/i, 1000, 1e9, "largest") ?? txt(pages, /Vehicle\s+IDV/i, 1000, 1e9, "first");
    const tp = amt(tables, /Legal\s+Liability\s+Cover/i, 0, 1e7, "last") ?? txt(pages, /Legal\s+Liability\s+Cover/i, 0, 1e7, "first");
    const cpa = ownerDriverPremium(pages, tables);
    const net = txt(pages, /^Premium\s*[₹:]?/i, 0, 1e7, "first");
    let od = amt(tables, /Own\s+Damage\s+Cover\s+Premium/i, 0, 1e7, "last") ?? txt(pages, /Own\s+Damage\s+Cover\s+Premium/i, 0, 1e7, "first");
    if (net && tp) {
      const derived = round(net.value - tp.value - (cpa?.value ?? 0));
      if (derived >= 0) od = { value: derived, page: net.page, evidence: "printed premium less liability and owner-driver PA" };
    }
    const tax = txt(pages, /\bIGST\b/i, 0, 1e7, "last") ?? amt(tables, /\bIGST\b/i, 0, 1e7, "last");
    const gross = txt(pages, /Total\s+Amount/i, 0, 1e7, "last") ?? amt(tables, /Total\s+Amount/i, 0, 1e7, "last");
    putMoney(fields, "idv", idv);
    putMoney(fields, "od_premium", od);
    putMoney(fields, "tp_premium", tp);
    set(fields, "cpa_opted", cpa && cpa.value > 0 ? "Yes" : "No", 1, cpa?.page ?? 1, cpa?.evidence ?? "no owner-driver PA premium");
    set(fields, "cpa_premium", money(cpa?.value ?? 0), 1, cpa?.page ?? 1, cpa?.evidence ?? "no owner-driver PA premium");
    putMoney(fields, "total_premium", net);
    putMoney(fields, "tax_amount", tax);
    putMoney(fields, "gross_premium", gross);
    if (!gross && net && tax) set(fields, "gross_premium", money(net.value + tax.value), .98, net.page, "net + tax");
    return;
  }

  set(fields, "policy_product", "Package", 1, 1, "GCV package heading");
  const idv = amt(tables, /Vehicle\s+IDV|Total\s+Value|Total\s+IDV/i, 1000, 1e9, "largest")
    ?? txt(pages, /Vehicle\s+IDV/i, 1000, 1e9, "last");
  let od = amt(tables, /Own\s+Damage\s+Cover|Total\s+Own\s+Damage\s+Premium/i, 0, 1e7, "last")
    ?? txt(pages, /Own\s+Damage\s+Cover|Total\s+Own\s+Damage\s+Premium/i, 0, 1e7, "first");
  if (od) od = { ...od, value: Math.round(od.value) };
  const tp = amt(tables, /Legal\s+Liability\s+Cover|Basic\s+Liability\s+Premium/i, 0, 1e7, "last")
    ?? txt(pages, /Legal\s+Liability\s+Cover/i, 0, 1e7, "first");
  const totalLiability = amt(tables, /Total\s+Liability\s+Premium/i, 0, 1e7, "last");
  const driver = amt(tables, /Legal\s+Liability\s+to\s+Driver|Driver\s*,?\s*Cleaner\s*,?\s*Coolies/i, 0, 1e5, "last")
    ?? txt(pages, /Legal\s+Liability\s+to\s+Driver|Driver\s*,?\s*Cleaner\s*,?\s*Coolies/i, 0, 1e5, "first");
  const owner = ownerDriverPremium(pages, tables);
  const additions = totalLiability && tp ? round(totalLiability.value - tp.value) : (driver?.value ?? 0) + (owner?.value ?? 0);
  const net = txt(pages, /^Premium\s*[₹:]?/i, 1000, 1e7, "first")
    ?? (od && tp ? { value: round(od.value + tp.value + additions), page: od.page, evidence: "reconciled net" } : null);
  const tax = txt(pages, /\bIGST\b/i, 0, 1e7, "last") ?? amt(tables, /\bIGST\b/i, 0, 1e7, "last");
  const gross = txt(pages, /Total\s+Amount/i, 0, 1e7, "last") ?? amt(tables, /Gross\s+Premium|Total\s+Amount/i, 0, 1e7, "last");
  putMoney(fields, "idv", idv);
  putMoney(fields, "od_premium", od);
  putMoney(fields, "tp_premium", tp);
  set(fields, "cpa_opted", owner && owner.value > 0 ? "Yes" : "No", .98, owner?.page ?? 1, owner?.evidence ?? "no explicit owner-driver PA premium");
  set(fields, "cpa_premium", money(additions), .98, totalLiability?.page ?? driver?.page ?? owner?.page ?? 1, "liability additions outside base TP");
  putMoney(fields, "total_premium", net);
  putMoney(fields, "tax_amount", tax);
  putMoney(fields, "gross_premium", gross);
  if (!gross && net && tax) set(fields, "gross_premium", money(net.value + tax.value), .97, net.page, "net + tax");
  if (/PA\s+OF\s+OWNER\s+DRIVER|PERSONAL\s+ACCIDENT\s+COVER/i.test(text) && !owner) {
    fields.delete("cpa_opted");
  }
}

function refineNewIndia(pages: string[], tables: StructuredPolicyTable[], fields: Fields) {
  set(fields, "insurer_name", "The New India Assurance Company Limited", 1, 1, "New India header");
  set(fields, "policy_product", "SAOD", 1, 1, "standalone own-damage heading");
  identity(fields, pages, "new_india");
  const idv = amt(tables, /Total\s+Value|Total\s+IDV/i, 1000, 1e9, "largest") ?? txt(pages, /Total\s+Value/i, 1000, 1e9, "last");
  const od = amt(tables, /Total\s+OD\s+Premium|Calculated\s+OD\s+Premium/i, 0, 1e7, "last")
    ?? txt(pages, /Total\s+OD\s+Premium|Calculated\s+OD\s+Premium/i, 0, 1e7, "first");
  const net = amt(tables, /Net\s+Premium/i, 0, 1e7, "last") ?? txt(pages, /Net\s+Premium/i, 0, 1e7, "first") ?? od;
  const tax = amt(tables, /GST(?:\s+in\s+Rs)?|IGST/i, 0, 1e7, "last") ?? txt(pages, /GST\s+in\s+Rs|IGST\s+18/i, 0, 1e7, "last");
  const gross = amt(tables, /Total\s+Payable/i, 0, 1e7, "last") ?? txt(pages, /Total\s+Payable/i, 0, 1e7, "first");
  putMoney(fields, "idv", idv);
  putMoney(fields, "od_premium", od);
  set(fields, "tp_premium", "0", 1, 1, "standalone own damage");
  set(fields, "cpa_opted", "No", 1, 1, "standalone own damage");
  set(fields, "cpa_premium", "0", 1, 1, "standalone own damage");
  putMoney(fields, "total_premium", net);
  putMoney(fields, "tax_amount", tax);
  putMoney(fields, "gross_premium", gross);
  if (!gross && net && tax) set(fields, "gross_premium", money(net.value + tax.value), .98, net.page, "net + GST");
}

function refineRoyal(pages: string[], tables: StructuredPolicyTable[], fields: Fields) {
  set(fields, "insurer_name", "Royal Sundaram General Insurance Co. Limited", 1, 1, "Royal Sundaram header");
  set(fields, "policy_product", "Third Party", 1, 1, "liability-only heading");
  identity(fields, pages, "royal");
  set(fields, "idv", "0", 1, 1, "liability only");
  set(fields, "od_premium", "0", 1, 1, "liability only");
  const tp = amt(tables, /Basic\s+(?:premium.*TPPD|Liability\s+Premium)/i, 0, 1e7, "last")
    ?? txt(pages, /Basic\s+premium\s+including\s+premium\s+for\s+TPPD/i, 0, 1e7, "first");
  const total = amt(tables, /Total\s+Liability\s+Premium/i, 0, 1e7, "last") ?? txt(pages, /Total\s+Liability\s+Premium/i, 0, 1e7, "first");
  const paid = amt(tables, /Paid\s+Driver/i, 0, 1e5, "last") ?? txt(pages, /Paid\s+Driver/i, 0, 1e5, "first");
  const extra = total && tp ? round(total.value - tp.value) : (paid?.value ?? 0);
  putMoney(fields, "tp_premium", tp);
  set(fields, "cpa_opted", "No", 1, 2, "owner-driver PA zero");
  set(fields, "cpa_premium", money(extra), 1, total?.page ?? paid?.page ?? 2, "paid-driver liability addition, not owner-driver CPA");
  const net = total ?? (tp ? { value: tp.value + extra, page: tp.page, evidence: "liability total" } : null);
  const tax = amt(tables, /IGST/i, 0, 1e7, "last") ?? txt(pages, /ADD\s*:\s*IGST|IGST/i, 0, 1e7, "last");
  const gross = amt(tables, /Total\s+Premium\s+Payable|Total\s+Amount\s+Payable/i, 0, 1e7, "last")
    ?? txt(pages, /TOTAL\s+PREMIUM\s+PAYABLE|Premium\s+Amount/i, 0, 1e7, "first");
  putMoney(fields, "total_premium", net);
  putMoney(fields, "tax_amount", tax);
  putMoney(fields, "gross_premium", gross);
  if (!gross && net && tax) set(fields, "gross_premium", money(net.value + tax.value), .98, net.page, "net + tax");
}

function refineMagma(
  pages: string[],
  tables: StructuredPolicyTable[],
  fields: Fields,
  text: string,
  layout: Extract<Layout, `magma_${string}`>,
) {
  set(fields, "insurer_name", "Magma General Insurance Limited", 1, 1, "Magma current-policy header");
  identity(fields, pages, "magma");

  if (layout === "magma_gcv_tp") {
    set(fields, "policy_product", "Third Party", 1, 1, "commercial-vehicle liability-only heading");
    set(fields, "idv", "0", 1, 1, "liability only");
    set(fields, "od_premium", "0", 1, 1, "liability only");
    const basicTp = amt(tables, /Basic\s*-?\s*TP/i, 0, 1e7, "last") ?? txt(pages, /Basic\s*-?\s*TP/i, 0, 1e7, "first");
    const total = amt(tables, /Total\s+Liability\s+Premium/i, 0, 1e7, "last") ?? txt(pages, /Total\s+Liability\s+Premium/i, 0, 1e7, "first");
    const extra = total && basicTp ? round(total.value - basicTp.value) : 0;
    putMoney(fields, "tp_premium", basicTp);
    set(fields, "cpa_opted", /REASON\s+FOR\s+NOT\s+OPTING\s+PA\s+COVER|DO\s+NOT\s+HOLD\s+A\s+VALID\s+DRIVING\s+LICENSE/i.test(text) ? "No" : "No", 1, 1, "no owner-driver PA in current liability schedule");
    set(fields, "cpa_premium", money(extra), .99, total?.page ?? 1, "non-owner liability additions");
    putMoney(fields, "total_premium", total);
    const tax = magmaTax(pages, tables);
    putMoney(fields, "tax_amount", tax);
    const gross = amt(tables, /^TOTAL$/i, 0, 1e7, "last") ?? txt(pages, /^TOTAL\s+/i, 0, 1e7, "last");
    putMoney(fields, "gross_premium", gross);
    if (!gross && total && tax) set(fields, "gross_premium", money(total.value + tax.value), .98, total.page, "net + tax");
    return;
  }

  const idv = amt(tables, /Total\s+Value|IDV\s+of\s+Vehicle/i, 1000, 1e9, "largest") ?? txt(pages, /Total\s+Value/i, 1000, 1e9, "last");
  const od = amt(tables, /Total\s+Own\s+Damage\s+Premium(?:\(A\))?/i, 0, 1e7, "last")
    ?? txt(pages, /Total\s+Own\s+Damage\s+Premium(?:\(A\))?/i, 0, 1e7, "first");
  putMoney(fields, "idv", idv);
  putMoney(fields, "od_premium", od);

  if (layout === "magma_pcp_saod") {
    set(fields, "policy_product", "SAOD", 1, 1, "private-car standalone own-damage heading");
    putMoney(fields, "total_premium", od);
    set(fields, "tp_premium", "0", 1, 1, "liability policy separate");
    set(fields, "cpa_opted", "No", 1, 1, "standalone own damage");
    set(fields, "cpa_premium", "0", 1, 1, "standalone own damage");
    const tax = magmaTax(pages, tables);
    putMoney(fields, "tax_amount", tax);
    if (od && tax) set(fields, "gross_premium", money(od.value + tax.value), 1, od.page, "net + tax before printed rounding");
    return;
  }

  set(fields, "policy_product", "Package", 1, 1, "private-car package heading");
  const liability = amt(tables, /Total\s+Liability\s+Premium\s*\(?B\)?/i, 0, 1e7, "last")
    ?? txt(pages, /Total\s+Liability\s+Premium\s*\(?B\)?/i, 0, 1e7, "first");
  const cpa = ownerDriverPremium(pages, tables);
  const net = amt(tables, /Total\s+Package\s+Premium\s*\(?A\s*\+\s*B\)?/i, 0, 1e7, "last")
    ?? txt(pages, /Total\s+Package\s+Premium\s*\(?A\s*\+\s*B\)?/i, 0, 1e7, "first");
  if (liability) {
    const tp = round(liability.value - (cpa?.value ?? 0));
    if (tp >= 0) set(fields, "tp_premium", money(tp), .99, liability.page, "total liability less owner-driver PA");
  }
  set(fields, "cpa_opted", cpa && cpa.value > 0 ? "Yes" : "No", 1, cpa?.page ?? 1, cpa?.evidence ?? "no owner-driver PA");
  set(fields, "cpa_premium", money(cpa?.value ?? 0), 1, cpa?.page ?? 1, cpa?.evidence ?? "no owner-driver PA");
  putMoney(fields, "total_premium", net);
  const tax = magmaTax(pages, tables);
  putMoney(fields, "tax_amount", tax);
  const gross = amt(tables, /^TOTAL$/i, 0, 1e7, "last") ?? txt(pages, /^TOTAL\s+/i, 0, 1e7, "last");
  putMoney(fields, "gross_premium", gross);
  if (!gross && net && tax) set(fields, "gross_premium", money(net.value + tax.value), .98, net.page, "net + tax");
}

function magmaTax(pages: string[], tables: StructuredPolicyTable[]): Money | null {
  const cgst = amt(tables, /CGST\s*@?\s*9%?/i, 0, 1e7, "last") ?? txt(pages, /CGST\s*@?\s*9%?/i, 0, 1e7, "last");
  const sgst = amt(tables, /SGST\s*@?\s*9%?/i, 0, 1e7, "last") ?? txt(pages, /SGST\s*@?\s*9%?/i, 0, 1e7, "last");
  if (cgst && sgst) return { value: round(cgst.value + sgst.value), page: cgst.page, evidence: "CGST + SGST" };
  const tp5 = amt(tables, /IGST\s*@?\s*5%/i, 0, 1e7, "last") ?? txt(pages, /IGST\s*@?\s*5%/i, 0, 1e7, "last");
  const other18 = amt(tables, /IGST\s*@?\s*18%/i, 0, 1e7, "last") ?? txt(pages, /IGST\s*@?\s*18%/i, 0, 1e7, "last");
  if (tp5 && other18) return { value: round(tp5.value + other18.value), page: tp5.page, evidence: "5% TP IGST + 18% other-liability IGST" };
  return amt(tables, /TOTAL\s+IGST/i, 0, 1e7, "last") ?? txt(pages, /TOTAL\s+IGST/i, 0, 1e7, "last");
}

function refineDigit(pages: string[], tables: StructuredPolicyTable[], fields: Fields) {
  set(fields, "insurer_name", "Go Digit General Insurance Limited", 1, 1, "Digit current-policy header");
  set(fields, "policy_product", "Package", 1, 1, "Digit Private Car Policy heading");
  identity(fields, pages, "digit");
  const idv = amt(tables, /Total\s+IDV|Vehicle\s+IDV/i, 1000, 1e9, "largest") ?? txt(pages, /Total\s+IDV|Vehicle\s+IDV/i, 1000, 1e9, "largest");
  const od = amt(tables, /Total\s+OD\s+Premium|Own\s+Damage\s+Premium/i, 0, 1e7, "last") ?? txt(pages, /Total\s+OD\s+Premium/i, 0, 1e7, "first");
  const totalAct = amt(tables, /Total\s+Act\s+Premium/i, 0, 1e7, "last") ?? txt(pages, /Total\s+Act\s+Premium/i, 0, 1e7, "first");
  const cpa = ownerDriverPremium(pages, tables);
  const net = amt(tables, /Net\s+Premium/i, 0, 1e7, "last") ?? txt(pages, /Net\s+Premium/i, 0, 1e7, "first");
  putMoney(fields, "idv", idv);
  putMoney(fields, "od_premium", od);
  if (totalAct) set(fields, "tp_premium", money(round(totalAct.value - (cpa?.value ?? 0))), .99, totalAct.page, "total act premium less owner-driver PA");
  set(fields, "cpa_opted", cpa && cpa.value > 0 ? "Yes" : "No", 1, cpa?.page ?? 1, cpa?.evidence ?? "no owner-driver PA");
  set(fields, "cpa_premium", money(cpa?.value ?? 0), 1, cpa?.page ?? 1, cpa?.evidence ?? "no owner-driver PA");
  putMoney(fields, "total_premium", net);
  const tax = sumParts(pages, tables, [/CGST\s*@?\s*9%/i, /SGST|UTGST/i]);
  putMoney(fields, "tax_amount", tax);
  const gross = amt(tables, /Final\s+Premium|Gross\s+Premium/i, 0, 1e7, "last") ?? txt(pages, /Final\s+Premium|Gross\s+Premium/i, 0, 1e7, "last");
  putMoney(fields, "gross_premium", gross);
  if (!gross && net && tax) set(fields, "gross_premium", money(net.value + tax.value), .98, net.page, "net + GST");
}

function ownerDriverPremium(pages: string[], tables: StructuredPolicyTable[]): Money | null {
  return amt(tables, /(?:PA|P\.A\.)\s+(?:Cover\s+)?(?:for\s+)?Owner\s*[- ]?Driver|Owner\s*[- ]?Driver\s+(?:PA|CPA)/i, 0, 1e5, "last")
    ?? txt(pages, /(?:PA|P\.A\.)\s+(?:Cover\s+)?(?:for\s+)?Owner\s*[- ]?Driver|Owner\s*[- ]?Driver\s+(?:PA|CPA)/i, 0, 1e5, "last");
}

function identity(fields: Fields, pages: string[], family: string) {
  const number = policyNo(pages, family);
  if (number) set(fields, "policy_number", number.value, .99, number.page, number.evidence);
  const policyPeriod = period(pages, family);
  if (policyPeriod) {
    set(fields, "policy_start_date", policyPeriod.from, .99, policyPeriod.page, policyPeriod.evidence);
    set(fields, "policy_end_date", policyPeriod.to, .99, policyPeriod.page, policyPeriod.evidence);
  }
}

function policyNo(pages: string[], family: string): Hit | null {
  for (let pageIndex = 0; pageIndex < pages.length; pageIndex += 1) {
    for (const raw of pages[pageIndex].split(/\r?\n/)) {
      const line = norm(raw);
      if (!/Policy\s*(?:No\.?|Number|#)/i.test(line) || /Previous\s+Policy|Active\s+TP\s+Policy|Liability\s+Policy/i.test(line)) continue;
      let value: string | undefined;
      if (family === "hdfc") {
        value = line.match(/Policy\s*No\.?\s*[:#-]?\s*((?:\d[\s-]?){15,25})/i)?.[1]?.replace(/\D/g, "");
      } else if (family === "royal") {
        value = line.match(/Policy\s*No\.?\s*[:#-]?\s*(VPT[A-Z0-9/-]{8,30})/i)?.[1];
      } else if (family === "magma") {
        value = line.match(/Policy\s*(?:No\.?|Number)\s*[:#-]?\s*([A-Z0-9]+(?:\/[A-Z0-9]+){2,5})/i)?.[1];
      } else if (family === "digit") {
        value = line.match(/Policy\s*(?:No\.?|Number)\s*[:#-]?\s*(D\d{6,15})\b/i)?.[1];
      } else {
        value = line.match(/Policy\s*(?:No\.?|Number)\s*[:#-]?\s*([A-Z0-9/-]{6,40})/i)?.[1];
      }
      if (!value) {
        const generic = line.match(/Policy\s*(?:No\.?|Number|#)\s*[:#-]?\s*([A-Z0-9][A-Z0-9/-]{5,40})/i)?.[1];
        if (generic && /\d/.test(generic)) value = generic;
      }
      if (value && /\d/.test(value)) return { value: value.replace(/\s+/g, ""), page: pageIndex + 1, evidence: line };
    }
  }
  if (family === "hdfc") {
    const match = norm(pages[0] ?? "").match(/\b(\d{18,22})\b/);
    if (match) return { value: match[1], page: 1, evidence: "HDFC current-policy header" };
  }
  return null;
}

function period(pages: string[], family: string): { from: string; to: string; page: number; evidence: string } | null {
  const anchor = family === "royal"
    ? /Period\s+of\s+Insurance|Valid\s+From/i
    : family === "new_india"
      ? /Period\s+of\s+cover|Own\s+Damage\s+Period/i
      : family === "digit"
        ? /Period\s+of\s+Policy\s+for\s+Own\s+Damage\s+Cover/i
        : /Period\s+of\s+Insurance|Policy\s+Effective\s+from|Effective\s+date\s+of\s+commencement/i;
  for (let pageIndex = 0; pageIndex < Math.min(pages.length, 4); pageIndex += 1) {
    const lines = pages[pageIndex].split(/\r?\n/);
    for (let index = 0; index < lines.length; index += 1) {
      if (!test(anchor, lines[index])) continue;
      const block = lines.slice(index, index + 9).join(" ");
      const parsedDates = dates(block).map(date).filter((value): value is string => Boolean(value));
      if (parsedDates.length >= 2) return { from: parsedDates[0], to: parsedDates[1], page: pageIndex + 1, evidence: norm(block) };
    }
  }
  return null;
}

function commonVehicle(
  pages: string[],
  tables: StructuredPolicyTable[],
  fields: Fields,
  layout: Layout,
) {
  const registration = val(tables, /(?:Registration|Regn\.?)\s*(?:No\.?|Number)(?!\s+Authority)/i, vehicleId)
    ?? pageVal(pages, /(?:Vehicle\s+)?Registration\s+(?:No\.?|Number)|Regn\.\s*Number/i, vehicleId);
  if (registration) {
    if (/^NEW(?:[-/\s]|$)|^NEW-?0+1$/i.test(registration.value)) {
      set(fields, "vehicle_registration_status", "registration_pending", 1, registration.page, registration.evidence);
      fields.delete("vehicle_registration_number");
    } else {
      set(fields, "vehicle_registration_status", "registered", .99, registration.page, registration.evidence);
      set(fields, "vehicle_registration_number", compact(registration.value), .99, registration.page, registration.evidence);
    }
  }

  const chassis = val(tables, /Chassis\s*(?:No\.?|Number)?/i, chassisId) ?? pageVal(pages, /Chassis\s*(?:No\.?|Number)?/i, chassisId);
  const engine = val(tables, /Engine(?:\s+or\s+M\/C)?\s*(?:No\.?|Number)?/i, engineId) ?? pageVal(pages, /Engine(?:\s+or\s+M\/C)?\s*(?:No\.?|Number)?/i, engineId);
  const make = val(tables, /^(?:Vehicle\s+)?Make$/i, vehicleText) ?? pageVal(pages, /^(?:Vehicle\s+)?Make\s*[:/-]?/i, vehicleText);
  const model = val(tables, /^(?:Vehicle\s+)?Model(?:\s*-\s*Variant)?$/i, vehicleText) ?? pageVal(pages, /^(?:Vehicle\s+)?Model(?:\s*-\s*Variant)?\s*[:/-]?/i, vehicleText);
  const combined = val(tables, /(?:Vehicle\s+)?Make\s*\/\s*Model|Vehicle\s+Make\s*&\s*Model|Make\s*\/\s*Model\s*\/\s*Type\s+of\s+Body/i, vehicleText)
    ?? pageVal(pages, /Vehicle\s+Make\s*\/\s*Model|Vehicle\s+Make\s*&\s*Model|Make\s*\/\s*Model/i, vehicleText);
  const fuel = val(tables, /Fuel(?:\s+Type)?/i, fuelText) ?? pageVal(pages, /(?:Type\s+of\s+)?Fuel(?:\s+Type)?/i, fuelText);
  const manufactureYear = val(tables, /Year\s+of\s+(?:Manufacture|Mfg)|Mfg\.?\s*Year|^Year$/i, /^(?:19|20)\d{2}$/)
    ?? pageVal(pages, /Year\s+of\s+(?:Manufacture|Mfg)|Mfg\.?\s*Year/i, /^(?:19|20)\d{2}$/);

  if (chassis) set(fields, "vehicle_chassis_number", compact(chassis.value), .98, chassis.page, chassis.evidence);
  if (engine) set(fields, "vehicle_engine_number", compact(engine.value), .98, engine.page, engine.evidence);
  if (make) set(fields, "vehicle_make", cleanMake(make.value), .98, make.page, make.evidence);
  if (model) set(fields, "vehicle_model", cleanModel(model.value), .98, model.page, model.evidence);
  if (combined && (!make || !model)) applyCombinedMakeModel(fields, combined);
  if (fuel) set(fields, "vehicle_fuel_type", normalizeFuel(fuel.value), .97, fuel.page, fuel.evidence);
  if (manufactureYear) set(fields, "vehicle_manufacturing_year", manufactureYear.value, .97, manufactureYear.page, manufactureYear.evidence);

  const vehicleClass = classFor(layout);
  set(fields, "vehicle_class", vehicleClass, 1, 1, "insurer/product layout family");
  const capacityLabel = vehicleClass === "GCV"
    ? /GVW|Gross\s+Vehicle\s+Weight/i
    : vehicleClass === "PCV"
      ? /Carrying\s+Capacity|Seating\s+Capacity|Licensed\s+Seating/i
      : /Cubic\s+Capacity|Cubic\s+Capacity\/Watts|\bCC\s*\/\s*KW\b|\bCC\b/i;
  const capacity = val(tables, capacityLabel, /^\d{1,6}(?:\.\d+)?$/)
    ?? pageVal(pages, capacityLabel, /^\d{1,6}(?:\.\d+)?$/);
  if (capacity) set(fields, "vehicle_capacity", capacity.value.replace(/,/g, ""), .97, capacity.page, capacity.evidence);

  const authority = val(tables, /Registration\s+Authority|RTA\s+Name|RTO(?:\s+Name|\s+Location)?/i, vehicleText)
    ?? pageVal(pages, /Registration\s+Authority|RTA\s+Name|RTO(?:\s+Name|\s+Location)?/i, vehicleText);
  const resolvedRto = rto(authority?.value ?? registration?.value ?? "");
  if (resolvedRto.name) set(fields, "vehicle_rto_name", resolvedRto.name, .94, authority?.page ?? registration?.page ?? 1, authority?.evidence ?? registration?.evidence ?? "RTO");
  if (resolvedRto.state) set(fields, "vehicle_rto_state", resolvedRto.state, .94, authority?.page ?? registration?.page ?? 1, authority?.evidence ?? registration?.evidence ?? "RTO");
}

function classFor(layout: Layout): "GCV" | "PCV" | "PCP" | "TWP" {
  if (layout.includes("gcv")) return "GCV";
  if (layout.includes("pcv")) return "PCV";
  if (layout.includes("twp")) return "TWP";
  return "PCP";
}

function applyCombinedMakeModel(fields: Fields, hitValue: Hit) {
  const raw = norm(hitValue.value);
  const pieces = raw.split(/\s*(?:\/|&|\|)\s*/).filter(Boolean);
  if (pieces.length >= 2) {
    if (!fields.get("vehicle_make")) set(fields, "vehicle_make", cleanMake(pieces[0]), .97, hitValue.page, hitValue.evidence);
    if (!fields.get("vehicle_model")) set(fields, "vehicle_model", cleanModel(pieces.slice(1).join(" ")), .97, hitValue.page, hitValue.evidence);
  } else {
    const knownMake = raw.match(/^(MARUTI(?:\s+SUZUKI)?|TATA(?:\s+MOTORS?)?|BMW|KIA|HERO|SKODA(?:\s+AUTO)?|SCOOTERS\s+INDIA|DAIMLER\s+INDIA\s+COMMERCIAL\s+VEHICLES)(?:\s+|$)(.*)$/i);
    if (knownMake) {
      if (!fields.get("vehicle_make")) set(fields, "vehicle_make", cleanMake(knownMake[1]), .96, hitValue.page, hitValue.evidence);
      if (knownMake[2] && !fields.get("vehicle_model")) set(fields, "vehicle_model", cleanModel(knownMake[2]), .96, hitValue.page, hitValue.evidence);
    }
  }
}

function val(
  tables: StructuredPolicyTable[],
  label: RegExp,
  accept: RegExp | ((value: string) => boolean),
): Hit | null {
  for (const table of tables) {
    for (let rowIndex = 0; rowIndex < table.rows.length; rowIndex += 1) {
      const row = table.rows[rowIndex].map(norm);
      for (let cellIndex = 0; cellIndex < row.length; cellIndex += 1) {
        const cell = row[cellIndex];
        if (!test(label, cell)) continue;
        const inline = trim(cell.replace(label, ""));
        label.lastIndex = 0;
        if (inline && ok(accept, inline)) return hit(inline, table.page, row);
        for (const value of row.slice(cellIndex + 1)) {
          const candidate = trim(value);
          if (candidate && ok(accept, candidate)) return hit(candidate, table.page, row);
        }
        for (let next = rowIndex + 1; next <= Math.min(rowIndex + 3, table.rows.length - 1); next += 1) {
          const candidate = trim(table.rows[next][cellIndex] ?? "");
          if (candidate && ok(accept, candidate)) return hit(candidate, table.page, [cell, candidate]);
        }
      }
    }
  }
  return null;
}

function pageVal(
  pages: string[],
  label: RegExp,
  accept: RegExp | ((value: string) => boolean),
): Hit | null {
  for (let pageIndex = 0; pageIndex < pages.length; pageIndex += 1) {
    const lines = pages[pageIndex].split(/\r?\n/).map(norm).filter(Boolean);
    for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
      const line = lines[lineIndex];
      if (!test(label, line)) continue;
      const match = line.match(label);
      label.lastIndex = 0;
      const after = match?.index === undefined ? "" : trim(line.slice((match.index ?? 0) + (match[0]?.length ?? 0)));
      const candidates = [after, ...lines.slice(lineIndex + 1, lineIndex + 4).map((candidate) => trim(candidate))];
      for (const candidate of candidates) {
        if (candidate && ok(accept, candidate)) return hit(candidate, pageIndex + 1, lines.slice(lineIndex, lineIndex + 3));
      }
    }
  }
  return null;
}

function amt(
  tables: StructuredPolicyTable[],
  label: RegExp,
  min: number,
  max: number,
  mode: "first" | "last" | "largest" = "first",
): Money | null {
  const hits: Money[] = [];
  for (const table of tables) {
    for (let rowIndex = 0; rowIndex < table.rows.length; rowIndex += 1) {
      const row = table.rows[rowIndex].map(norm);
      for (let cellIndex = 0; cellIndex < row.length; cellIndex += 1) {
        const cell = row[cellIndex];
        if (!test(label, cell)) continue;
        const match = cell.match(label);
        label.lastIndex = 0;
        const sources = [
          row.slice(cellIndex + 1).join(" "),
          match?.index === undefined ? "" : cell.slice((match.index ?? 0) + (match[0]?.length ?? 0)),
          [1, 2, 3].map((offset) => table.rows[rowIndex + offset]?.[cellIndex] ?? "").join(" "),
        ];
        for (const source of sources) {
          const amounts = nums(source).filter((value) => value >= min && value <= max && !year(value));
          if (!amounts.length) continue;
          const value = mode === "largest" ? Math.max(...amounts) : mode === "last" ? amounts[amounts.length - 1] : amounts[0];
          hits.push({ value, page: table.page, evidence: norm(row.join(" | ")) });
          break;
        }
      }
    }
  }
  if (!hits.length) return null;
  if (mode === "last") return hits[hits.length - 1];
  if (mode === "largest") return hits.reduce((best, current) => current.value > best.value ? current : best);
  return hits[0];
}

function txt(
  pages: string[],
  label: RegExp,
  min: number,
  max: number,
  mode: "first" | "last" | "largest" = "first",
): Money | null {
  const hits: Money[] = [];
  for (let pageIndex = 0; pageIndex < pages.length; pageIndex += 1) {
    const lines = pages[pageIndex].split(/\r?\n/);
    for (let index = 0; index < lines.length; index += 1) {
      if (!test(label, lines[index])) continue;
      const match = lines[index].match(label);
      label.lastIndex = 0;
      const after = match?.index === undefined ? lines[index] : lines[index].slice((match.index ?? 0) + (match[0]?.length ?? 0));
      let amounts = nums(after).filter((value) => value >= min && value <= max && !year(value));
      if (!amounts.length) amounts = nums(lines.slice(index + 1, index + 3).join(" ")).filter((value) => value >= min && value <= max && !year(value));
      if (!amounts.length) continue;
      const value = mode === "largest" ? Math.max(...amounts) : mode === "last" ? amounts[amounts.length - 1] : amounts[0];
      hits.push({ value, page: pageIndex + 1, evidence: norm(lines.slice(index, index + 2).join(" ")) });
    }
  }
  if (!hits.length) return null;
  if (mode === "last") return hits[hits.length - 1];
  if (mode === "largest") return hits.reduce((best, current) => current.value > best.value ? current : best);
  return hits[0];
}

function sumParts(pages: string[], tables: StructuredPolicyTable[], patterns: RegExp[]): Money | null {
  const values = patterns.map((pattern) => amt(tables, pattern, 0, 1e7, "last") ?? txt(pages, pattern, 0, 1e7, "last"));
  if (values.some((value) => !value)) return null;
  const complete = values as Money[];
  return {
    value: round(complete.reduce((sum, value) => sum + value.value, 0)),
    page: complete[0].page,
    evidence: complete.map((value) => value.evidence).join(" | "),
  };
}

function putMoney(fields: Fields, key: string, value: Money | null) {
  if (value) set(fields, key, money(value.value), .99, value.page, value.evidence);
}

function set(fields: Fields, key: string, value: string, confidence: number, page: number | null, evidence: string) {
  const normalized = norm(value);
  if (!normalized) return;
  fields.set(key, {
    key,
    label: labels[key] ?? key,
    value: normalized,
    confidence,
    page,
    evidence: norm(evidence).slice(0, 400),
  });
}

function cleanVehicle(fields: Fields) {
  for (const key of ["vehicle_make", "vehicle_model", "vehicle_registration_number", "vehicle_engine_number", "vehicle_chassis_number", "vehicle_rto_name"]) {
    const value = fields.get(key);
    if (value && garbage(value.value)) fields.delete(key);
  }
}

function repairIds(fields: Fields) {
  const engine = fields.get("vehicle_engine_number");
  const chassis = fields.get("vehicle_chassis_number");
  if (!engine || !chassis) return;
  const engineValue = compact(engine.value);
  const chassisValue = compact(chassis.value);
  if (engineValue.length > chassisValue.length + 5 && engineValue.endsWith(chassisValue)) {
    const repaired = engineValue.slice(0, -chassisValue.length);
    if (repaired.length >= 6) fields.set(engine.key, { ...engine, value: repaired });
  }
}

function garbage(value: string) {
  const normalized = norm(value);
  return /^(?:VEHICLE|DESCRIPTION|MODEL|MAKE|MAKE\s*\/\s*MODEL|FUEL\s+TYPE|TYPE\s+OF\s+BODY|MAKEMODEL|ENGINE(?:\s+(?:NO\.?|NUMBER))?|CHASSIS(?:\s+(?:NO\.?|NUMBER))?|REGISTRATION(?:\s+(?:NO\.?|NUMBER))?|GVW|TOTAL\s+IDV|RTO)$/i.test(normalized)
    || /SECTION\s+(?:I|II|III|IV)\b|GEOGRAPHICAL\s+AREA|TOWING\s+DISABLED/i.test(normalized);
}

function vehicleId(value: string) {
  const normalized = norm(value);
  return /^(?:NEW(?:[-/\s].*)?|[A-Z0-9][A-Z0-9\s/-]{4,35})$/i.test(normalized)
    && (/^NEW(?:[-/\s]|$)/i.test(normalized) || (/[A-Z]/i.test(normalized) && /\d/.test(normalized)))
    && !garbage(normalized);
}

function chassisId(value: string) {
  const normalized = norm(value);
  if (/^\d{4,20}$/.test(normalized)) return true;
  return vehicleId(normalized);
}

function engineId(value: string) {
  const normalized = norm(value);
  return vehicleId(normalized) && compact(normalized).length >= 6;
}

function vehicleText(value: string) {
  const normalized = norm(value);
  return normalized.length >= 2
    && normalized.length <= 140
    && /[A-Z]/i.test(normalized)
    && !/^(?:NA|N\/A|NONE|NULL)$/i.test(normalized)
    && !garbage(normalized);
}

function fuelText(value: string) {
  return /(?:PETROL|DIESEL|CNG|LPG|ELECTRIC|BATTERY|HYBRID)/i.test(norm(value));
}

function normalizeFuel(value: string) {
  const normalized = norm(value).toUpperCase();
  if (/ELECTRIC|BATTERY/.test(normalized)) return "Electric";
  if (/CNG/.test(normalized)) return "CNG";
  if (/LPG/.test(normalized)) return "LPG";
  if (/DIESEL/.test(normalized)) return "Diesel";
  if (/PETROL/.test(normalized)) return "Petrol";
  if (/HYBRID/.test(normalized)) return "Hybrid";
  return title(value);
}

function rto(value: string) {
  const upper = norm(value).toUpperCase();
  const match = upper.match(/\b(MP|DL|HR|UP|RJ)[-\s]?0?(\d{1,2})\b/);
  let name = match ? `${match[1]}${Number(match[2])}` : null;
  if (!name) {
    if (/JABALPUR/.test(upper)) name = "MP20";
    else if (/MANDLA/.test(upper)) name = "MP51";
    else if (/NARSINGHPUR/.test(upper)) name = "MP49";
    else if (/ANUPPUR/.test(upper)) name = "MP65";
    else if (/BALLABGARH|FARIDABAD/.test(upper)) name = "HR29";
    else if (/PALWAL|HODAL/.test(upper)) name = "HR30";
    else if (/JAIPUR/.test(upper)) name = "RJ14";
    else if (/FATEHPUR/.test(upper)) name = "UP71";
    else if (/DELHI/.test(upper)) name = "DL8";
  }
  const state = name?.startsWith("MP") ? "Madhya Pradesh"
    : name?.startsWith("DL") ? "Delhi"
      : name?.startsWith("HR") ? "Haryana"
        : name?.startsWith("RJ") ? "Rajasthan"
          : name?.startsWith("UP") ? "Uttar Pradesh"
            : null;
  return { name, state };
}

function dates(value: string) {
  const numeric = value.match(/\b\d{1,2}\s*[\/-]\s*\d{1,2}\s*[\/-]\s*\d{2,4}\b/g) ?? [];
  const words = value.match(/\b\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*,?\s+\d{4}\b/gi) ?? [];
  return [...numeric, ...words].sort((first, second) => value.indexOf(first) - value.indexOf(second));
}

function date(value: string): string | null {
  const normalized = norm(value).replace(/\s*([/-])\s*/g, "$1");
  const numeric = normalized.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (numeric) {
    let yearValue = Number(numeric[3]);
    if (yearValue < 100) yearValue += yearValue >= 70 ? 1900 : 2000;
    return iso(Number(numeric[1]), Number(numeric[2]), yearValue);
  }
  const word = normalized.match(/^(\d{1,2})\s+([A-Za-z]{3,9}),?\s+(\d{4})$/);
  if (!word) return null;
  const months: Record<string, number> = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
  return iso(Number(word[1]), months[word[2].slice(0, 3).toLowerCase()] ?? 0, Number(word[3]));
}

function iso(day: number, month: number, yearValue: number) {
  if (day < 1 || day > 31 || month < 1 || month > 12) return null;
  return `${String(yearValue).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function nums(value: string) {
  return [...value.matchAll(/\d[\d,]*(?:\.\d{1,2})?/g)]
    .map((match) => Number(match[0].replaceAll(",", "")))
    .filter(Number.isFinite);
}

function hit(value: string, page: number, evidence: string[]): Hit {
  return { value, page, evidence: norm(evidence.join(" | ")) };
}

function test(regex: RegExp, value: string) {
  regex.lastIndex = 0;
  const matched = regex.test(value);
  regex.lastIndex = 0;
  return matched;
}

function ok(accept: RegExp | ((value: string) => boolean), value: string) {
  return accept instanceof RegExp ? test(accept, value) : accept(value);
}

function trim(value: string) {
  return norm(value).replace(/^[:|\-\s]+|[:|\-\s]+$/g, "");
}

function norm(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function compact(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function cleanMake(value: string) {
  const normalized = norm(value);
  if (/DAIMLER\s+INDIA\s+COMMERCIAL\s+VEHICLES/i.test(normalized)) return "BharatBenz";
  if (/MARUTI\s+SUZUKI/i.test(normalized)) return "Maruti Suzuki";
  if (/SKODA\s+AUTO/i.test(normalized)) return "Skoda";
  if (/SCOOTERS\s+INDIA/i.test(normalized)) return "Scooters India";
  if (/TATA(?:\s+MOTORS?)?/i.test(normalized)) return "Tata";
  if (/\bBMW\b/i.test(normalized)) return "BMW";
  if (/\bKIA\b/i.test(normalized)) return "Kia";
  if (/\bHERO\b/i.test(normalized)) return "Hero";
  return normalized
    .replace(/\b(?:INDIA|PVT\.?|PRIVATE|LIMITED|LTD\.?)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanModel(value: string) {
  return norm(value)
    .replace(/\bBS\s*VI\b/gi, "")
    .replace(/\bNULL\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function title(value: string) {
  const normalized = norm(value).toLowerCase();
  return normalized ? normalized[0].toUpperCase() + normalized.slice(1) : normalized;
}

function year(value: number) {
  return value >= 1900 && value <= 2100 && Number.isInteger(value);
}

function round(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function money(value: number) {
  const rounded = round(value);
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
}
