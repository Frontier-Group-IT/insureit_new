import "server-only";

import { extractNativePdfTextPages } from "@/lib/policy-ocr-native-pdf";
import { enrichIffcoCertifiedMachineFamily } from "@/lib/policy-iffco-machine-family";

type ExistingInsurer = "new_india_cv_native_pdf" | "iffco_tokio_cv_native_pdf" | "go_digit_cv_native_pdf" | "united_india_gcv_native_pdf" | "united_india_private_car_package_native_pdf" | "oriental_gccv_native_pdf";
type NewProductVariant = "zurich_kotak_private_car_tp_native_pdf" | "go_digit_two_wheeler_od_native_pdf" | "united_india_tractor_tp_native_pdf" | "hdfc_ergo_two_wheeler_tp_native_pdf" | "sbi_general_private_car_package_native_pdf";
type Insurer = ExistingInsurer | NewProductVariant;
const NEW_VARIANTS = new Set<Insurer>(["zurich_kotak_private_car_tp_native_pdf","go_digit_two_wheeler_od_native_pdf","united_india_tractor_tp_native_pdf","hdfc_ergo_two_wheeler_tp_native_pdf","sbi_general_private_car_package_native_pdf"]);
type OcrField = { key: string; label: string; value: string; confidence: null; page: number | null; evidence: string };
export type NonTataCommercialRead = {
  parserId: Insurer;
  parserVersion: "non-tata-cv-v2" | "insureit-product-extension-v1";
  fields: OcrField[];
  warnings: string[];
  checksPassed: number;
  premium: { od: number; tp: number; net: number; gst: number; gross: number; cpa?: number; addOn?: number; odBasic?: number; ncbPercent?: number; ncbDiscount?: number; odBasicAfterNcb?: number };
};
// Use the SAME approved self-hosted webhook as the production ICICI/Tata bridge.
// Commercial policy verification stays isolated by the insurer classifier and its
// strict response contract; no changes to ICICI or Tata parser logic are needed.
const PRIMARY_WEBHOOK_ORIGIN = "https://n8n.nishant.uk";
const PRIMARY_WEBHOOK_PATH = "/webhook/insureit-policy-intake-icici-v1";
function sharedN8nWebhookUrl(): string {
  if (process.env.INSUREIT_N8N_OCR_ENDPOINT_MODE !== "self_hosted")
    throw new Error("n8n_self_hosted_required");
  const configured = process.env.INSUREIT_N8N_OCR_WEBHOOK_URL;
  if (!configured) throw new Error("n8n_nontata_not_configured");
  let parsed: URL;
  try { parsed = new URL(configured); }
  catch { throw new Error("n8n_nontata_webhook_url_invalid"); }
  if (parsed.protocol !== "https:" || parsed.origin !== PRIMARY_WEBHOOK_ORIGIN
      || parsed.pathname !== PRIMARY_WEBHOOK_PATH || parsed.search || parsed.hash
      || parsed.username || parsed.password)
    throw new Error("n8n_nontata_webhook_url_invalid");
  return parsed.toString();
}
const MAX_BYTES = 4 * 1024 * 1024; // Vercel request-size limit, independent of proxy's 16 MB limit.
const PDF = "%PDF-";
const REQUIRED_BASE = [
  "insurer_verified", "policy_identity_verified", "insured_name_verified",
  "policy_start_end_verified", "issuance_date_evidenced", "vehicle_identification_verified",
  "vehicle_make_model_verified", "vehicle_class_verified", "vehicle_registration_printed",
  "vehicle_idv_verified", "od_tp_components_printed", "net_od_tp_reconciled",
  "gst_independently_evidenced", "gross_net_tax_reconciled",
] as const;
const REQUIRED_EXTRA: Record<ExistingInsurer, string[]> = {
  new_india_cv_native_pdf: ["nia_layout", "registration_complete"],
  iffco_tokio_cv_native_pdf: ["iffco_layout", "printed_tax_table", "invoice_taxable_matches", "invoice_gross_matches"],
  go_digit_cv_native_pdf: ["digit_layout", "registered_plate", "od_basic_ncb", "tp_itemization"],
  united_india_gcv_native_pdf: ["uiic_layout", "igst_components_printed", "stamp_accounting_disclosed", "stamp_charge_reconciled"],
  united_india_private_car_package_native_pdf: ["uiic_private_car_layout", "igst_18_printed", "cpa_disposition_verified", "ncb_premium_reconciled"],
  oriental_gccv_native_pdf: ["oicl_layout", "four_tax_components_printed", "stamp_charge_reconciled"],
};
const ALLOWED_FIELDS = new Set([
  "policy_number", "insurer_name", "policy_product", "insured_name",
  "policy_issuance_date", "policy_start_date", "policy_end_date", "third_party_start_date",
  "third_party_end_date", "vehicle_registration_number", "vehicle_registration_status",
  "vehicle_class", "vehicle_make", "vehicle_model", "vehicle_fuel_type",
  "vehicle_manufacturing_year",
  "vehicle_registration_year",
  "vehicle_registration_date", "vehicle_capacity", "vehicle_chassis_number",
  "vehicle_engine_number", "vehicle_rto_name", "vehicle_rto_state",
  "idv", "od_premium", "tp_premium", "cpa_premium",
]);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const completePlate = (v: string) => /^[A-Z]{2}[- ]?\d{2}[- ]?[A-Z]{1,3}[- ]?\d{3,4}$/i.test(v);
const rtoPrefix = (v: string) => /^(?:MP|HR)-?\d{2}$/i.test(v);
const object = (x: unknown): x is Record<string, unknown> =>
  x !== null && typeof x === "object" && !Array.isArray(x);
const cents = (v: number) => Math.round(v * 100);
const isMoney = (x: unknown): x is number =>
  typeof x === "number" && Number.isFinite(x) && x >= 0 && x <= 1_000_000_000
    && Math.abs(x * 100 - Math.round(x * 100)) < 0.00001;

function insurerForText(head: string): Insurer | null {
  // PDF text extraction can split an insurer/product heading across lines.
  // Normalize whitespace without trusting a caller-supplied insurer label.
  const normalized = head.replace(/\s+/g, " ");
  const issuer = normalized.slice(0, 5000);
  const product = normalized.slice(0, 8500);
  const matches: Insurer[] = [];
  if (/THE NEW INDIA ASSURANCE CO\. LTD\./i.test(issuer) && /Commercial Vehicle Package Policy/i.test(product))
    matches.push("new_india_cv_native_pdf");
  if (/IFFCO.?TOKIO GENERAL INSURANCE/i.test(issuer) && /COMMERCIAL VEHICLE CERTIFICATE/i.test(product))
    matches.push("iffco_tokio_cv_native_pdf");
  if (/Go Digit General Insurance/i.test(issuer) && /Digit Commercial Vehicle Insurance/i.test(product))
    matches.push("go_digit_cv_native_pdf");
  if (/UNITED INDIA INSURANCE COMPANY LIMITED/i.test(issuer) && /GCV PUBLIC CARRIER/i.test(product))
    matches.push("united_india_gcv_native_pdf");
  if (/UNITED INDIA INSURANCE COMPANY LIMITED/i.test(issuer)
      && /PRIVATE CAR\s*-\s*PACKAGE POLICY/i.test(product))
    matches.push("united_india_private_car_package_native_pdf");
  if (/THE ORIENTAL INSURANCE COMPANY LIMITED/i.test(issuer) && /GCCV-PUBLIC CARRIERS/i.test(product))
    matches.push("oriental_gccv_native_pdf");
  // Specific product extensions precede the old CV classifiers. They never
  // route an existing Digit Commercial Vehicle or United GCV layout here.
  if (/Zurich Kotak General Insurance Company \(India\) Limited/i.test(issuer)
      && /Liability only \(Private Car\)/i.test(product))
    matches.push("zurich_kotak_private_car_tp_native_pdf");
  if (/Go Digit General Insurance (?:Ltd\.|Limited)/i.test(issuer)
      && /Digit Two-Wheeler Insurance/i.test(product)
      && /Digit Two-Wheeler Stand-al/i.test(product))
    matches.push("go_digit_two_wheeler_od_native_pdf");
  if (/UNITED INDIA INSURANCE COMPANY LIMITED/i.test(issuer)
      && /MISCELLANEOUS AND SPECIAL TYPE OF VEHICLES\s*-\s*LIABILITY ONLY POLICY/i.test(product))
    matches.push("united_india_tractor_tp_native_pdf");
  if (/HDFC ERGO General Insurance Company Limited/i.test(product)
      && /Motor Insurance\s*-\s*Two Wheeler Liability only/i.test(product))
    matches.push("hdfc_ergo_two_wheeler_tp_native_pdf");
  if (/SBI General Insurance Company Limited/i.test(issuer)
      && /Private Car Insurance Policy\s*-\s*Package/i.test(product))
    matches.push("sbi_general_private_car_package_native_pdf");
  return matches.length === 1 ? matches[0] : null;
}

/** Recognize only printed, trained native-PDF layouts. Never accept insurer names from caller input. */
export async function recognizeNonTataCommercialPdf(file: File): Promise<Insurer | null> {
  if (file.type !== "application/pdf" || file.size < 128) return null;
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (new TextDecoder("ascii").decode(bytes.subarray(0, 5)) !== PDF) return null;
  const pages = await extractNativePdfTextPages(bytes);
  const text = pages.slice(0, 3).map((page) => page.text).join("\n");
  return insurerForText(text);
}


const NEW_VARIANT_CHECKS: Record<NewProductVariant, string[]> = {
  zurich_kotak_private_car_tp_native_pdf:[
    "insurer_verified","product_verified","policy_identity_verified","policy_period_verified",
    "issuance_date_evidenced","registration_authority_verified","vehicle_identification_verified",
    "vehicle_make_model_verified","manufacturing_year_evidenced","capacity_and_fuel_verified",
    "third_party_only_zero_od","third_party_only_zero_cpa","tp_premium_printed",
    "net_components_reconciled","tax_components_verified","gross_rounded_reconciled"],
  united_india_tractor_tp_native_pdf:[
    "insurer_verified","tractor_liability_only_verified","insured_verified",
    "policy_number_verified","period_verified","issuance_evidenced",
    "vehicle_identification_verified","tractor_make_model_verified",
    "registration_authority_verified","tractor_class_and_fuel_verified",
    "capacity_and_year_verified","idv_zero_valid","od_zero_valid",
    "paid_driver_ll_reconciled","net_tp_reconciled","tax_evidenced",
    "stamp_separately_disclosed","cpa_waiver_evidenced"],
  hdfc_ergo_two_wheeler_tp_native_pdf:[
    "issuer_verified","product_verified","policy_number_verified","insured_name_verified",
    "period_verified","issuance_date_verified","registration_printed","vehicle_identity_verified",
    "make_model_verified","manufacturing_year_and_cc_verified","rto_named","model_fuel_certified",
    "tp_only_zero_od","cpa_waiver_evidenced","liability_premium_printed",
    "igst_rounding_verified","gross_reconciled","stamp_separately_disclosed"],
  sbi_general_private_car_package_native_pdf:[
    "insurer_verified","package_product_verified","policy_identity_verified","issue_and_signature_date_consistent",
    "od_period_evidenced","tp_period_evidenced","registered_plate_evidenced","make_model_evidenced",
    "vehicle_identity_evidenced","registration_year_and_fuel_verified","capacity_evidenced","rto_authority_evidenced",
    "idv_printed","od_basic_and_addons_printed","od_including_addons_reconciled",
    "tp_and_cpa_separate","total_net_reconciled","gst_18_percent_reconciled",
    "gross_rounded_reconciled","stamp_separately_disclosed"],
  go_digit_two_wheeler_od_native_pdf:[
    "insurer_verified","standalone_od_product_verified","identity_verified",
    "insured_vehicle_registered","od_period_verified","issuance_date_evidenced",
    "make_model_evidenced","vehicle_identification_verified",
    "year_evidence_separate","fuel_cc_verified","idv_printed",
    "od_net_invoice_printed","igst_printed","gross_invoice_printed",
    "tax_reconciled","gross_reconciled","no_new_tp_premium",
    "optional_parts_depreciation_named"],
};
function validateNewVariant(
 payload:unknown,insurer:NewProductVariant,
 ids:Record<"intake_id"|"document_id"|"request_id",string>,
):NonTataCommercialRead{
 if(!object(payload)||payload.contract_version!=="1"||payload.parser_id!==insurer
   ||payload.parser_version!=="insureit-product-extension-v1"
   ||payload.extraction_method!=="native_pdf_text"||payload.review_required!==true
   ||payload.auto_finalize_allowed!==false||payload.intake_id!==ids.intake_id
   ||payload.document_id!==ids.document_id||payload.request_id!==ids.request_id
   ||payload.validation_passed!==true||payload.ok!==true
   ||!object(payload.checks)||!Array.isArray(payload.fields)
   ||!Array.isArray(payload.warnings)||payload.warnings.length)
   throw new Error("n8n_extension_contract_invalid");
 const expected=NEW_VARIANT_CHECKS[insurer],checks=payload.checks;
 if(Object.keys(checks).length!==expected.length||expected.some(k=>checks[k]!==true))
   throw new Error("n8n_extension_check_set_invalid");
 const fields:OcrField[]=payload.fields.map((raw:unknown)=>{
   if(!object(raw)||typeof raw.key!=="string"||!ALLOWED_FIELDS.has(raw.key)
     ||typeof raw.label!=="string"||raw.label.length>100
     ||typeof raw.value!=="string"||!raw.value.trim()||raw.value.length>300
     ||raw.confidence!==null||(raw.page!==null&&(!Number.isInteger(raw.page)||(raw.page as number)<1||(raw.page as number)>10))
     ||typeof raw.evidence!=="string"||raw.evidence.length>120)
       throw new Error("n8n_extension_field_shape_invalid");
   return {key:raw.key,label:raw.label,value:raw.value,confidence:null,page:raw.page as number|null,evidence:raw.evidence};
 });
 const byKey=new Map(fields.map(f=>[f.key,f.value]));
 if(byKey.size!==fields.length)throw new Error("n8n_extension_duplicate_field");
 const required=["insurer_name","policy_product","insured_name","policy_number","policy_start_date",
 "policy_end_date","policy_issuance_date","vehicle_class","vehicle_make","vehicle_model",
 "vehicle_registration_status","vehicle_registration_number","vehicle_rto_name","vehicle_rto_state",
 "vehicle_chassis_number","vehicle_engine_number","vehicle_capacity","vehicle_fuel_type",
 "idv","od_premium","tp_premium","cpa_premium"];
 if(required.some(k=>!byKey.get(k))
   ||byKey.get("vehicle_registration_status")!=="registered"
   ||!completePlate(byKey.get("vehicle_registration_number")||""))
   throw new Error("n8n_extension_identity_or_vehicle_invalid");
 for(const key of ["policy_issuance_date","policy_start_date","policy_end_date"]){
   const value=byKey.get(key)||"";
   if(!/^\d{4}-\d{2}-\d{2}$/.test(value)
     ||!Number.isFinite(Date.parse(value+"T00:00:00Z"))
     ||new Date(value+"T00:00:00Z").toISOString().slice(0,10)!==value)
      throw new Error("n8n_extension_invalid_date");
 }
 if((byKey.get("policy_end_date")||"")<(byKey.get("policy_start_date")||""))
   throw new Error("n8n_extension_invalid_coverage");
 if(insurer==="sbi_general_private_car_package_native_pdf"){
   if(byKey.get("policy_product")!=="Package"
     ||byKey.get("vehicle_class")!=="Private Car"
     ||!byKey.get("vehicle_manufacturing_year")
     ||!(Number(byKey.get("idv"))>0)
     ||!(Number(byKey.get("cpa_premium"))>0))
     throw new Error("n8n_extension_sbi_package_product_invalid");
 }else if(insurer==="go_digit_two_wheeler_od_native_pdf"){
   if(byKey.get("policy_product")!=="Stand-alone Own Damage"
     ||byKey.get("vehicle_class")!=="Two Wheeler"||!byKey.get("vehicle_registration_year")
     ||byKey.has("vehicle_manufacturing_year"))
     throw new Error("n8n_extension_unverified_manufacture_year");
 }else{
   if(byKey.get("policy_product")!=="Third-Party Only"
     ||!byKey.get("vehicle_manufacturing_year")
     ||byKey.get("idv")!=="0"||byKey.get("od_premium")!=="0"
     ||byKey.get("cpa_premium")!=="0")
     throw new Error("n8n_extension_tp_only_contract_invalid");
 }
 if(insurer==="united_india_tractor_tp_native_pdf"
    &&(byKey.get("vehicle_class")!=="Agricultural Tractor"
       ||byKey.get("vehicle_make")!=="MAHINDRA"))
    throw new Error("n8n_extension_tractor_class_invalid");
 const p=payload.premium_components;
 if(!object(p)||![p.od,p.tp,p.net,p.gst,p.gross].every(isMoney))
   throw new Error("n8n_extension_premium_shape_invalid");
 const {od,tp,net,gst,gross}=p as {od:number,tp:number,net:number,gst:number,gross:number};
 const sbi=insurer==="sbi_general_private_car_package_native_pdf";
 const cpa=sbi?p.cpa:0,addOn=sbi?p.addOn:0,odBasic=sbi?p.odBasic:0;
 const ncbPercent=sbi?p.ncbPercent:0,ncbDiscount=sbi?p.ncbDiscount:0;
 const effectiveOd=sbi?p.odBasicAfterNcb:0;
 if(sbi&&(!isMoney(cpa)||!isMoney(addOn)||!isMoney(odBasic)
    ||cents(Number(byKey.get("cpa_premium")))!==cents(cpa)
    ||!isMoney(ncbPercent)||!isMoney(ncbDiscount)||!isMoney(effectiveOd)
    ||(ncbPercent as number)>65
    ||Math.abs(cents((odBasic as number)*(ncbPercent as number)/100)-cents(ncbDiscount as number))>2
    ||Math.abs(cents((odBasic as number)-(ncbDiscount as number))-cents(effectiveOd as number))>1
    ||Math.abs(cents((effectiveOd as number)+(addOn as number))-cents(od))>1))
   throw new Error("n8n_extension_sbi_financial_split_invalid");
 if(Math.abs(cents(od+tp+(sbi?(cpa as number):0))-cents(net))>6
    ||Math.abs(cents(net+gst)-cents(gross))>50
    ||cents(Number(byKey.get("od_premium")))!==cents(od)
    ||cents(Number(byKey.get("tp_premium")))!==cents(tp)
    ||!isMoney(Number(byKey.get("idv"))))
   throw new Error("n8n_extension_financial_reconciliation_failed");
 // The PDF mobile is masked; never use it as customer contact. The intake
 // supplied phone is handled by canonical booking identity/duplicate checks.
 return {parserId:insurer,parserVersion:"insureit-product-extension-v1",
   fields,warnings:[],checksPassed:expected.length,
   premium:{od,tp,net,gst,gross,...(sbi?{cpa:cpa as number,addOn:addOn as number,odBasic:odBasic as number,ncbPercent:ncbPercent as number,
      ncbDiscount:ncbDiscount as number,odBasicAfterNcb:effectiveOd as number}:{})}};
}

function validate(payload: unknown, insurer: Insurer, ids: Record<"intake_id" | "document_id" | "request_id", string>): NonTataCommercialRead {
  if(NEW_VARIANTS.has(insurer))return validateNewVariant(payload,insurer as NewProductVariant,ids);
  if (!object(payload) || payload.contract_version !== "1"
      || payload.parser_id !== insurer || payload.parser_version !== "non-tata-cv-v2"
      || payload.extraction_method !== "native_pdf_text"
      || payload.review_required !== true || payload.auto_finalize_allowed !== false
      || payload.intake_id !== ids.intake_id || payload.document_id !== ids.document_id
      || payload.request_id !== ids.request_id)
    throw new Error("n8n_nontata_identity_or_contract_invalid");
  if (!object(payload.checks) || !Array.isArray(payload.fields)
      || !Array.isArray(payload.warnings) || typeof payload.ok !== "boolean"
      || payload.validation_passed !== payload.ok)
    throw new Error("n8n_nontata_validation_shape_invalid");

  const expected = [...REQUIRED_BASE, ...REQUIRED_EXTRA[insurer as ExistingInsurer]];
  const checks = payload.checks;
  if (Object.keys(checks).length !== expected.length
      || expected.some((name) => typeof checks[name] !== "boolean"))
    throw new Error("n8n_nontata_check_set_invalid");
  const failed = expected.filter((name) => checks[name] !== true);
  // An RTO-only prefix on a New India schedule is a NEW unregistered
  // vehicle. Its classification is verified by the parser, but the prefix
  // must never be used as a registered vehicle number.
  if (failed.length > 0 || payload.ok !== true) {
    // Only expose names from this server-controlled check list, never raw
    // extracted values, policyholder text, signed links or n8n warnings.
    const diagnostic=failed.slice(0,6).join("__");
    throw new Error(diagnostic
      ? "n8n_failed_checks__"+diagnostic
      : "n8n_nontata_verification_failed");
  }

  if (payload.fields.length < 14 || payload.fields.length > 35
      || payload.warnings.length > 30)
    throw new Error("n8n_nontata_fields_invalid");
  const fields: OcrField[] = payload.fields.map((raw: unknown) => {
    if (!object(raw) || typeof raw.key !== "string" || !ALLOWED_FIELDS.has(raw.key)
        || typeof raw.label !== "string" || raw.label.length > 100
        || typeof raw.value !== "string" || !raw.value.trim() || raw.value.length > 300
        || raw.confidence !== null
        || (raw.page !== null && (!Number.isInteger(raw.page) || (raw.page as number) < 1 || (raw.page as number) > 10))
        || typeof raw.evidence !== "string" || raw.evidence.length > 120)
      throw new Error("n8n_nontata_field_shape_invalid");
    return { key: raw.key, label: raw.label, value: raw.value, confidence: null, page: raw.page as number | null, evidence: raw.evidence };
  });
  const byKey = new Map(fields.map((x) => [x.key, x.value]));
  if (byKey.size !== fields.length) throw new Error("n8n_nontata_duplicate_field");
  for (const key of ["policy_number","insurer_name","insured_name","policy_start_date","policy_end_date",
    "vehicle_registration_status","vehicle_chassis_number","vehicle_engine_number","idv","od_premium","tp_premium"]) {
    if (!byKey.get(key)) throw new Error("n8n_nontata_required_field_missing");
  }
  const printedPlate = byKey.get("vehicle_registration_number") || "";
  const isNewIndiaUnregistered = insurer === "new_india_cv_native_pdf"
    && rtoPrefix(printedPlate) && byKey.get("vehicle_registration_status") === "unregistered";
  // IFFCO and United India explicitly issue new-vehicle reference numbers.
  // These are NOT RTO registration plates and must never be booked as such.
  const isIffcoNewVehicle = insurer === "iffco_tokio_cv_native_pdf"
    && /^MP\/NEW\/\d{3,6}$/i.test(printedPlate)
    && byKey.get("vehicle_registration_status") === "registration_pending";
  const isUnitedNewVehicle = insurer === "united_india_gcv_native_pdf"
    && printedPlate === "NEW"
    && byKey.get("vehicle_registration_status") === "registration_pending";
  if (isNewIndiaUnregistered || isIffcoNewVehicle || isUnitedNewVehicle) {
    if (!/^20\d{2}$/.test(byKey.get("vehicle_manufacturing_year") || "")
        || (isNewIndiaUnregistered && checks.registration_complete !== true))
      throw new Error("n8n_nontata_unregistered_evidence_invalid");
  } else if (checks.vehicle_registration_printed === true) {
    if (!completePlate(printedPlate) || byKey.get("vehicle_registration_status") !== "registered")
      throw new Error("n8n_nontata_registered_plate_invalid");
  }
  const dates = ["policy_start_date","policy_end_date","policy_issuance_date"];
  for (const key of dates) {
    const date = byKey.get(key) || "";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)
        || !Number.isFinite(Date.parse(date + "T00:00:00Z"))
        || new Date(date + "T00:00:00Z").toISOString().slice(0, 10) !== date)
      throw new Error("n8n_nontata_date_invalid");
  }
  if ((byKey.get("policy_end_date") || "") < (byKey.get("policy_start_date") || ""))
    throw new Error("n8n_nontata_coverage_invalid");
  const premium = payload.premium_components;
  if (!object(premium) || ![premium.od, premium.tp, premium.net, premium.gst, premium.gross].every(isMoney))
    throw new Error("n8n_nontata_premium_components_invalid");
  const od = premium.od as number, tp = premium.tp as number;
  const net = premium.net as number, gst = premium.gst as number, gross = premium.gross as number;
  if (Math.abs(cents(od + tp) - cents(net)) > 6 || Math.abs(cents(net + gst) - cents(gross)) > 6
      || cents(Number(byKey.get("od_premium"))) !== cents(od)
      || cents(Number(byKey.get("tp_premium"))) !== cents(tp)
      || !isMoney(Number(byKey.get("idv"))))
    throw new Error("n8n_nontata_financial_reconciliation_failed");
  const warnings = payload.warnings.map((w: unknown) => {
    if (typeof w !== "string" || w.length > 240) throw new Error("n8n_nontata_warning_invalid");
    return w;
  });

  return {
    parserId: insurer, parserVersion: "non-tata-cv-v2",
    // IFFCO MP/NEW is a PDF-printed *internal reference*, not an RTO plate.
    // Retain it in verified extraction for the insurer-specific eligibility
    // evidence check. The canonical onboarding mapper independently clears
    // registrationNo for registration_pending, so it is never booked as a plate.
    // NIA partial RTO prefixes are filtered. UIIC `NEW` must be retained
    // as source evidence for its strict assessor, never as a registered plate;
    // the canonical intake mapper clears registrationNo for pending vehicles.
    fields: enrichIffcoCertifiedMachineFamily(
      isNewIndiaUnregistered
        ? fields.filter((f) => f.key !== "vehicle_registration_number") : fields,
      insurer),
    warnings,
    checksPassed: expected.filter((key) => checks[key] === true).length,
    premium: { od, tp, net, gst, gross },
  };
}

/**
 * Normal Policy Read/Intake adapter. Null means unrelated insurer/layout;
 * a recognized trained insurer that fails never falls back silently to Google.
 * No policy, customer, vehicle or queue writes occur here.
 */
export async function tryReadNonTataCommercialPolicy(
  file: File,
  ids?: Record<"intake_id" | "document_id" | "request_id", string>,
): Promise<NonTataCommercialRead | null> {
  const insurer = await recognizeNonTataCommercialPdf(file);
  if (!insurer) return null;
  if (file.size > MAX_BYTES) throw new Error("n8n_nontata_pdf_exceeds_4mb");
  const secret = process.env.INSUREIT_N8N_OCR_HEADER_SECRET;
  if (!secret || secret.length < 32) throw new Error("n8n_nontata_not_configured");
  const requestIds = ids ?? { intake_id: crypto.randomUUID(), document_id: crypto.randomUUID(), request_id: crypto.randomUUID() };
  if (Object.values(requestIds).some((id) => !UUID.test(id)))
    throw new Error("n8n_nontata_invalid_request_ids");
  const body = new FormData();
  for (const [key, value] of Object.entries(requestIds)) body.set(key, value);
  body.set("data", file, "policy.pdf");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60_000);
  try {
    const response = await fetch(sharedN8nWebhookUrl(), {
      method: "POST", headers: { "x-insureit-policy-intake-secret": secret },
      body, signal: controller.signal, cache: "no-store", redirect: "error",
    });
    if (!response.ok) throw new Error("n8n_nontata_http_" + response.status);
    const payload: unknown = await response.json();
    return validate(payload, insurer, requestIds);
  } finally { clearTimeout(timeout); }
}

// The AI Policy Automation queue has a current, server-authorized Supabase signed
// source, not a browser-uploaded File. Reuse the same strict non-Tata validator,
// with a bounded private download and exact-storage-origin protection.
export async function tryReadNonTataCommercialSignedPolicy(
  source: { signedUrl: string; intakeId: string; documentId: string; requestId: string },
): Promise<NonTataCommercialRead | null> {
  const ids = { intake_id: source.intakeId, document_id: source.documentId, request_id: source.requestId };
  if (Object.values(ids).some((id) => !UUID.test(id)))
    throw new Error("n8n_nontata_invalid_request_ids");
  let url: URL;
  try { url = new URL(source.signedUrl); }
  catch { throw new Error("n8n_nontata_signed_source_invalid"); }
  if (url.origin !== "https://ilzhsfqqjyppzzvfscmh.supabase.co"
      || !url.pathname.startsWith("/storage/v1/object/sign/policy-documents/intakes/" + ids.intake_id + "/")
      || url.pathname.includes("..") || !url.searchParams.has("token")
      || url.username || url.password || url.hash)
    throw new Error("n8n_nontata_signed_source_invalid");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20_000);
  try {
    const response = await fetch(url, { signal: controller.signal, cache: "no-store", redirect: "error" });
    if (!response.ok) throw new Error("n8n_nontata_pdf_download_failed");
    const declaredSize = Number(response.headers.get("content-length") ?? "0");
    if (declaredSize > MAX_BYTES) throw new Error("n8n_nontata_pdf_exceeds_4mb");
    const reader = response.body?.getReader();
    if (!reader) throw new Error("n8n_nontata_pdf_download_failed");
    const chunks: Uint8Array[] = [];
    let length = 0;
    for (;;) {
      const part = await reader.read();
      if (part.done) break;
      length += part.value.byteLength;
      if (length > MAX_BYTES) {
        await reader.cancel();
        throw new Error("n8n_nontata_pdf_exceeds_4mb");
      }
      chunks.push(part.value);
    }
    const bytes = new Uint8Array(length);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
    if (new TextDecoder("ascii").decode(bytes.subarray(0, 5)) !== PDF)
      throw new Error("n8n_nontata_pdf_not_pdf");
    const file = new File([bytes], "current-policy.pdf", { type: "application/pdf" });
    return await tryReadNonTataCommercialPolicy(file, ids);
  } finally { clearTimeout(timer); }
}
