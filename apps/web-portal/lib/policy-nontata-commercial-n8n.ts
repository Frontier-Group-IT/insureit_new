import "server-only";

import { extractNativePdfTextPages } from "@/lib/policy-ocr-native-pdf";
import { enrichIffcoCertifiedMachineFamily } from "@/lib/policy-iffco-machine-family";
import { assessHeldInsurerCandidate, recognizeHeldInsurerLayout } from "@/lib/policy-held-insurer-candidate-admission";
import { verifyOrientalCmsSigningDate, type OrientalSignedIssuanceEvidence } from "@/lib/policy-oriental-cms-issuance";
import { acceptGoDigitNewJcbExtraction } from "@/lib/policy-digit-new-jcb-extraction";

type ExistingInsurer = "new_india_cv_native_pdf" | "iffco_tokio_cv_native_pdf" | "go_digit_cv_native_pdf" | "united_india_gcv_native_pdf" | "united_india_gcv_punjab_split_gst_native_pdf" | "united_india_private_car_package_native_pdf" | "oriental_gccv_native_pdf";
type NewProductVariant = "zurich_kotak_private_car_tp_native_pdf" | "go_digit_two_wheeler_od_native_pdf" | "united_india_tractor_tp_native_pdf" | "hdfc_ergo_two_wheeler_tp_native_pdf" | "sbi_general_private_car_package_native_pdf";
type HeldInsurer = "magma_private_car_package_native_pdf" | "national_private_car_liability_only_native_pdf"
  | "oriental_private_car_standalone_od_native_pdf" | "oriental_gccv_package_native_pdf";
type Insurer = ExistingInsurer | NewProductVariant | HeldInsurer | "national_gcv_package_native_pdf" | "go_digit_jcb_new_unregistered_native_pdf";
const HELD_INSURERS = new Set<string>([
  "magma_private_car_package_native_pdf","national_private_car_liability_only_native_pdf",
  "oriental_private_car_standalone_od_native_pdf","oriental_gccv_package_native_pdf",
]);
const NEW_VARIANTS = new Set<Insurer>(["zurich_kotak_private_car_tp_native_pdf","go_digit_two_wheeler_od_native_pdf","united_india_tractor_tp_native_pdf","hdfc_ergo_two_wheeler_tp_native_pdf","sbi_general_private_car_package_native_pdf"]);
type OcrField = { key: string; label: string; value: string; confidence: null; page: number | null; evidence: string };
export type NonTataCommercialRead = {
  parserId: Insurer;
  parserVersion: "non-tata-cv-v2" | "insureit-product-extension-v1" | "source-candidate-1";
  fields: OcrField[];
  warnings: string[];
  checksPassed: number;
  premium: { od: number; tp: number; net: number; gst: number; gross: number; cpa?: number; addOn?: number; odBasic?: number; ncbPercent?: number; ncbDiscount?: number; odBasicAfterNcb?: number };
  candidateCanonicalPremium?: {od:string;tp:string;addOnPremium:string;cpa:string;cpaOpted:"Yes"|"No"};
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
  united_india_gcv_punjab_split_gst_native_pdf: ["uiic_layout", "split_cgst_sgst_components_printed", "stamp_accounting_disclosed", "stamp_charge_reconciled"],
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
  // National GCV Package is different from the established National private
  // car liability-only product. Require BOTH independently read native-PDF
  // issuer and bilingual Goods Carrying Vehicle Package heading.
  if (/National Insurance Co(?:mpany)?\.?\s*(?:Ltd\.?|Limited)/i.test(normalized)
      && /Policy Schedule-Motor\s*-\s*Goods Carrying Vehicle\s*-\s*Package/i.test(normalized))
    matches.push("national_gcv_package_native_pdf");
  if (/UNITED INDIA INSURANCE COMPANY LIMITED/i.test(issuer) && /GCV PUBLIC CARRIER/i.test(product)){
    // Exact source-certified Punjab/BharatBenz four-component split tax.
    // Keep existing IGST-based UIIC classifications untouched.
    const split=/DAIMLER\s+INDIA\s+COMMERCIAL\s+VEHICLES\s+PVT\.\s*LTD\s*\/\s*BHARATBENZ/i.test(product)
      &&/CGST-Others\(9%\)/i.test(product)&&/SGST-Basic TP\(2\.50%\)/i.test(product);
    matches.push(split?"united_india_gcv_punjab_split_gst_native_pdf":"united_india_gcv_native_pdf");
  }
  if (/UNITED INDIA INSURANCE COMPANY LIMITED/i.test(issuer)
      && /PRIVATE CAR\s*-\s*PACKAGE POLICY/i.test(product))
    matches.push("united_india_private_car_package_native_pdf");
  // When the exact new GCCV product is enabled, it must not compete
  // with the legacy Oriental GCCV classifier and fall through to ICICI.
  // Preserve the legacy route for every other Oriental policy layout.
  const heldOriental=process.env.INSUREIT_ENABLE_HELD_INSURER_CANDIDATES==="1"
    ?recognizeHeldInsurerLayout(head):null;
  if (/THE ORIENTAL INSURANCE COMPANY LIMITED/i.test(issuer) && /GCCV-PUBLIC CARRIERS/i.test(product)
      &&heldOriental!=="oriental_gccv_package_native_pdf")
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
  // An explicit disabled-by-default switch keeps old insurer routes intact
  // until isolated n8n branches and downstream handoff pass original-PDF tests.
  if (process.env.INSUREIT_ENABLE_HELD_INSURER_CANDIDATES === "1") {
    if(heldOriental)matches.push(heldOriental);
  }
  return matches.length === 1 ? matches[0] : null;
}

/** Strict insurer/product refinement when the required split-tax rows are
 * printed AFTER the website's bounded first-three-page header scan.
 * Other insurer routes and ordinary UIIC IGST cases remain unchanged.
 */
export function refineUiicPunjabSplitFromSource(
  initial:string|null,fullNativeText:string,
):string|null {
  // Never infer an insurer from a webhook label. The only supported
  // promotion is from the already recognized UIIC GCV source layout.
  if(initial!=="united_india_gcv_native_pdf")return initial;
  const normalized=fullNativeText.replace(/\s+/g," ").slice(0,120000);
  // PDF text engines may insert whitespace around punctuation inside the
  // split-GST rows. Require BOTH printed tax lines and the exact OEM marker.
  const sourceIssuer=/UNITED\s+INDIA\s+INSURANCE\s+COMPANY\s+LIMITED/i.test(normalized.slice(0,10000));
  const sourceProduct=/GCV\s+PUBLIC\s+CARRIER/i.test(normalized.slice(0,15000));
  const makerIndex=normalized.search(/DAIMLER\s+INDIA\s+COMMERCIAL\s+VEHICLES/i);
  const makerRow=makerIndex>=0?normalized.slice(makerIndex,makerIndex+200):"";
  const sourceMaker=makerIndex>=0 && /PVT\.?\s*LTD/i.test(makerRow)
    && /BHARATBENZ/i.test(makerRow);
  const cgst=/CGST\s*[-–—:]?\s*Others\s*\(\s*9\s*%\s*\)/i.test(normalized);
  const sgst=/SGST\s*[-–—:]?\s*Basic\s*TP\s*\(\s*2\.50\s*%\s*\)/i.test(normalized);
  const accepted=sourceIssuer&&sourceProduct&&sourceMaker&&cgst&&sgst;
  if(!accepted)console.warn("[uiic-punjab] source evidence gap",{
    issuer:sourceIssuer,product:sourceProduct,maker:sourceMaker,
    cgst,sgst,sourceLengthBounded:normalized.length,
  });
  return accepted?"united_india_gcv_punjab_split_gst_native_pdf":initial;
}

/**
 * Narrow recovery for United India Punjab GCV originals when the website's
 * second, late-page native text scan returns empty. First two native pages
 * MUST already classify the exact PDF as United India GCV. The SAME current
 * PDF bytes are sent to the authorized n8n webhook; require its entire
 * source-certified split-GST contract and exact labelled identities before
 * refining the variant. The subsequent validate() repeats the immutable
 * request/document IDs, exact 18 checks, field schema and all premium math.
 * A parser ID alone, a webhook boolean alone or generic GCV never qualifies.
 */
export function resolveUiicPunjabCertifiedN8nVariant(
  initial: string | null,
  payload: unknown,
): string | null {
  const record=(value:unknown): value is Record<string,unknown> =>
    !!value && typeof value==="object" && !Array.isArray(value);
  if(initial!=="united_india_gcv_native_pdf" || !record(payload)
    ||payload.parser_id!=="united_india_gcv_punjab_split_gst_native_pdf"
    ||payload.parser_version!=="non-tata-cv-v2"
    ||payload.contract_version!=="1"
    ||payload.extraction_method!=="native_pdf_text"
    ||payload.review_required!==true||payload.auto_finalize_allowed!==false
    ||payload.ok!==true||payload.validation_passed!==true
    ||!record(payload.checks)||!Array.isArray(payload.fields)
    ||!record(payload.premium_components))return initial;
  const required=[
    "insurer_verified","policy_identity_verified","insured_name_verified",
    "policy_start_end_verified","issuance_date_evidenced","vehicle_identification_verified",
    "vehicle_make_model_verified","vehicle_class_verified","vehicle_registration_printed",
    "vehicle_idv_verified","od_tp_components_printed","net_od_tp_reconciled",
    "gst_independently_evidenced","gross_net_tax_reconciled",
    "uiic_layout","split_cgst_sgst_components_printed",
    "stamp_accounting_disclosed","stamp_charge_reconciled",
  ];
  const checks=payload.checks;
  if(Object.keys(checks).length!==required.length
    ||required.some(key=>checks[key]!==true))return initial;
  const fields=payload.fields;
  const read=(key:string)=>{
    const found=fields.filter((f:unknown)=>record(f)
      &&f.key===key&&f.page===null
      &&f.evidence==="Native PDF policy schedule"
      &&typeof f.value==="string");
    return found.length===1?String(found[0].value).trim():"";
  };
  const insurer=read("insurer_name");
  const product=read("policy_product");
  const maker=read("vehicle_make");
  const model=read("vehicle_model");
  if(!/^United India Insurance Company Limited$/i.test(insurer)
    || !/^Goods Carrying Vehicle Package$/i.test(product)
    || !/^Daimler India Commercial Vehicles Pvt\.?\s*Ltd\.?$/i.test(maker)
    || !/^BHARATBENZ\b/i.test(model))return initial;
  const taxes=payload.premium_components;
  const validAmount=(name:string)=>{
    const v=taxes[name];
    return typeof v==="number"&&Number.isFinite(v)&&v>0
      &&v<=1_000_000&&Math.round(v*100)===v*100;
  };
  if(taxes.taxRegime!=="CGST_SGST"
    ||!["cgstOthers","sgstOthers","cgstBasicTp","sgstBasicTp"].every(validAmount)
    ||taxes.cgstOthers!==taxes.sgstOthers
    ||taxes.cgstBasicTp!==taxes.sgstBasicTp)return initial;
  return "united_india_gcv_punjab_split_gst_native_pdf";
}

/** Recognize only printed, trained native-PDF layouts. Never accept insurer names from caller input. */
export async function recognizeNonTataCommercialPdf(file: File): Promise<Insurer | null> {
  if (file.type !== "application/pdf" || file.size < 128) return null;
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (new TextDecoder("ascii").decode(bytes.subarray(0, 5)) !== PDF) return null;
  const pages = await extractNativePdfTextPages(bytes);
  const text = pages.slice(0, 3).map((page) => page.text).join("\n");
  const initial=insurerForText(text);
  // Only UIIC GCV needs late-page financial labels for the split-GST
  // sub-profile. Never broaden other insurer classification.
  if(initial==="united_india_gcv_native_pdf"){
    // ExtractNativePdfTextPages normally returns two pages, irrespective of
    // pages.slice(0,24). The original Punjab PDFs print the split GST later.
    // Only generic UIIC GCV gets a bounded full-document source-evidence scan.
    const extended=await extractNativePdfTextPages(bytes,{
      maxTextPages:16,extendedTimeout:true,
    });
    return refineUiicPunjabSplitFromSource(initial,
      extended.map(page=>page.text).join("\n")) as Insurer;
  }
  return initial;
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
 "vehicle_registration_status","vehicle_registration_number",
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

/** National Insurance GCV Package: certified extraction ONLY.
 * No CPA (owner-driver personal accident) is invented from an uncharged
 * PDF. Canonical premium projection/booking for this new product is NOT
 * enabled; the output only supports reviewed source-field extraction.
 */
export function validateNationalGcvExtractionOnly(
 payload:unknown,ids:Record<"intake_id"|"document_id"|"request_id",string>,
):NonTataCommercialRead{
 if(!object(payload)||payload.contract_version!=="1"
  ||payload.parser_id!=="national_gcv_package_native_pdf"
  ||payload.parser_version!=="source-candidate-1"
  ||payload.extraction_method!=="native_pdf_text"
  ||payload.review_required!==true||payload.auto_finalize_allowed!==false
  ||payload.ok!==true||payload.validation_passed!==true
  ||payload.intake_id!==ids.intake_id||payload.document_id!==ids.document_id
  ||payload.request_id!==ids.request_id
  ||!object(payload.checks)||!Array.isArray(payload.fields)
  ||!Array.isArray(payload.warnings)||payload.warnings.length!==0
  ||!object(payload.premium_components))
  throw new Error("n8n_national_gcv_extraction_contract_invalid");
 const checkMap=payload.checks as Record<string,unknown>;
 const names=[
  "insurer_product_verified","policy_number_verified","insured_name_verified",
  "printed_issuance_date_verified","coverage_dates_verified",
  "registration_printed","engine_chassis_printed","make_model_variant_printed",
  "vehicle_class_verified","fuel_source_verified","manufacture_year_verified",
  "capacity_cc_printed","idv_printed","od_tp_components_reconciled",
  "printed_tax_components_verified","net_tax_gross_reconciled",
  "tp_itemization_reconciled","stamp_charge_disclosed",
 ];
 if(Object.keys(checkMap).length!==18||names.some(k=>checkMap[k]!==true))
  throw new Error("n8n_national_gcv_extraction_checks_invalid");
 const fields:OcrField[]=payload.fields.map((raw:unknown)=>{
  if(!object(raw)||typeof raw.key!=="string"||!ALLOWED_FIELDS.has(raw.key)
   ||typeof raw.value!=="string"||!raw.value.trim()||raw.value.length>300
   ||typeof raw.label!=="string"||raw.label.length>100
   ||typeof raw.evidence!=="string"||raw.evidence.length>180
   ||raw.confidence!==null||raw.page!==null)
    throw new Error("n8n_national_gcv_field_invalid");
  return {key:raw.key,label:raw.label,value:raw.value,confidence:null,page:null,evidence:raw.evidence};
 });
 if(fields.length<19||fields.length>32||new Set(fields.map(x=>x.key)).size!==fields.length)
  throw new Error("n8n_national_gcv_field_set_invalid");
 const by=new Map(fields.map(f=>[f.key,f]));
 const val=(key:string)=>by.get(key)?.value.trim()??"";
 const exact="NIA bilingual goods carrying vehicle package schedule";
 const required=["policy_number","insured_name","policy_product","policy_start_date",
  "policy_end_date","policy_issuance_date","vehicle_registration_number",
  "vehicle_registration_status","vehicle_make","vehicle_model","vehicle_class",
  "vehicle_chassis_number","vehicle_engine_number","vehicle_manufacturing_year",
  "vehicle_fuel_type","vehicle_capacity","idv","od_premium","tp_premium"];
 if(required.some(k=>!val(k)||by.get(k)?.evidence!==exact&&k!=="policy_issuance_date"))
  throw new Error("n8n_national_gcv_source_evidence_missing");
 if(val("insurer_name")!=="National Insurance Company Limited"
  ||by.get("insurer_name")?.evidence!==exact
  ||val("policy_product")!=="Goods Carrying Vehicle Package"
  ||val("vehicle_class")!=="Goods Carrying Vehicle"
  ||val("vehicle_make")!=="Eicher Motors Limited"
  ||val("vehicle_fuel_type")!=="DIESEL"
  ||val("vehicle_registration_status")!=="registered"
  ||!/^[A-Z]{2}\d{2}[A-Z]{1,3}\d{3,4}$/.test(val("vehicle_registration_number"))
  ||!/^20\d\d$/.test(val("vehicle_manufacturing_year"))
  ||!Number.isFinite(Number(val("vehicle_capacity")))||Number(val("vehicle_capacity"))<=0)
  throw new Error("n8n_national_gcv_vehicle_provenance_invalid");
 const date=(v:string)=>/^\d{4}-\d{2}-\d{2}$/.test(v)
  &&Number.isFinite(Date.parse(v+"T00:00:00Z"))
  &&new Date(v+"T00:00:00Z").toISOString().slice(0,10)===v;
 if(by.get("policy_issuance_date")?.evidence!=="NIA printed Date of issue"
  ||!date(val("policy_issuance_date"))||!date(val("policy_start_date"))
  ||!date(val("policy_end_date"))||val("policy_start_date")>val("policy_end_date")
  ||val("policy_issuance_date")>val("policy_end_date"))
  throw new Error("n8n_national_gcv_issue_or_coverage_invalid");
 const p=payload.premium_components;
 const money=(key:string)=>typeof p[key]==="number"&&Number.isFinite(p[key])
   &&p[key]>=0&&Math.abs(p[key]*100-Math.round(p[key]*100))<.00001;
 const amounts=["od","tp","net","gst","gross","cgst","sgst","igst","stampDuty","separatelyPaidStamp"];
 const od=p.od as number,tp=p.tp as number,net=p.net as number,
   gst=p.gst as number,gross=p.gross as number;
 if(amounts.some(key=>!money(key))||p.cpa!==null||p.taxRegime!=="IGST"
  ||p.cgst!==0||p.sgst!==0||p.igst!==p.gst||p.stampDuty!==0
  ||p.separatelyPaidStamp!==0.5
  ||od<=0||tp<=0||net<=0||gross<=0
  ||Math.abs(od+tp-net)>.06
  ||Math.abs(net+gst-gross)>.06
  ||Math.abs(Number(val("od_premium"))-od)>.001
  ||Math.abs(Number(val("tp_premium"))-tp)>.001
  ||Math.abs(Number(val("idv")))===0||!Number.isFinite(Number(val("idv"))))
  throw new Error("n8n_national_gcv_financial_evidence_invalid");
 // Do NOT supply candidateCanonicalPremium or CPA. Extraction verified,
 // registration is restricted to a separate product-specific human preflight.
 return{parserId:"national_gcv_package_native_pdf",parserVersion:"source-candidate-1",
  fields,warnings:[],checksPassed:18,premium:{od,tp,net,gst,gross}};
}

function validate(payload: unknown, insurer: Insurer,
  ids: Record<"intake_id" | "document_id" | "request_id", string>,
  orientalSignature?:OrientalSignedIssuanceEvidence|null,
): NonTataCommercialRead {
  if(insurer==="national_gcv_package_native_pdf")
    return validateNationalGcvExtractionOnly(payload,ids);
  if(insurer==="go_digit_jcb_new_unregistered_native_pdf"){
    const approved=acceptGoDigitNewJcbExtraction(payload,ids);
    return {parserId:approved.parserId,parserVersion:"non-tata-cv-v2",
      fields:approved.fields,warnings:[],checksPassed:18,
      premium:approved.premium,candidateCanonicalPremium:approved.candidateCanonicalPremium};
  }
  if(HELD_INSURERS.has(insurer)){
    // Oriental's PDF-native text can expose an issue date only through an
    // actual, integrity-verified, full-document detached CMS signature.
    // A 'Policy Printed On' timestamp or /M without valid CMS is never enough.
    const oriental=insurer==="oriental_private_car_standalone_od_native_pdf"
      ||insurer==="oriental_gccv_package_native_pdf";
    let verifiedPayload=payload;
    if(oriental&&orientalSignature&&object(payload)
      &&payload.parser_id===insurer
      &&payload.ok===false&&payload.validation_passed===false
      &&object(payload.checks)&&Object.keys(payload.checks).length===18
      &&payload.checks.printed_issuance_or_verified_image_date===false
      &&Object.entries(payload.checks).every(([key,value])=>
        key==="printed_issuance_or_verified_image_date"?value===false:value===true)
      &&Array.isArray(payload.warnings)&&payload.warnings.length===1
      &&payload.warnings[0]==="Review required: printed_issuance_or_verified_image_date"
      &&Array.isArray(payload.fields)
      &&!payload.fields.some((field:unknown)=>object(field)&&field.key==="policy_issuance_date")){
      verifiedPayload={...payload,ok:true,validation_passed:true,
        checks:{...payload.checks,printed_issuance_or_verified_image_date:true},
        warnings:[],
        fields:[...payload.fields,{key:"policy_issuance_date",label:"policy_issuance_date",
          value:orientalSignature.date,confidence:null,page:null,
          evidence:"Oriental cryptographically verified embedded PDF signature date"}]};
    }
    // No new response may cross the established source, identity and
    // premium barrier merely because its n8n parser returned ok:true.
    const decision=assessHeldInsurerCandidate(verifiedPayload,ids);
    if(!decision.accepted||decision.parserId!==insurer||!decision.canonicalPremium)
      throw new Error(decision.reason||"n8n_held_candidate_unverified");
    if(!object(verifiedPayload)||!Array.isArray(verifiedPayload.fields)
      ||!object(verifiedPayload.premium_components))
      throw new Error("n8n_held_candidate_response_invalid");
    const fields:OcrField[]=verifiedPayload.fields.map((raw:unknown)=>{
      if(!object(raw)||typeof raw.key!=="string"||!ALLOWED_FIELDS.has(raw.key)
        ||typeof raw.label!=="string"||raw.label.length>100
        ||typeof raw.value!=="string"||raw.value.length>300
        ||raw.confidence!==null||(raw.page!==null&&(!Number.isInteger(raw.page)||(raw.page as number)<1||(raw.page as number)>10))
        ||typeof raw.evidence!=="string"||raw.evidence.length>180)
        throw new Error("n8n_held_candidate_field_shape_invalid");
      return {key:raw.key,label:raw.label,value:raw.value,confidence:null,
        page:raw.page as number|null,evidence:raw.evidence};
    });
    const p=verifiedPayload.premium_components;
    return {parserId:insurer as HeldInsurer,parserVersion:"source-candidate-1",
      fields,warnings:[],checksPassed:18,
      premium:{od:p.od as number,tp:p.tp as number,net:p.net as number,
        gst:p.gst as number,gross:p.gross as number,cpa:p.cpa as number},
      candidateCanonicalPremium:decision.canonicalPremium};
  }
  if(NEW_VARIANTS.has(insurer))return validateNewVariant(payload,insurer as NewProductVariant,ids);
  if (!object(payload) || payload.contract_version !== "1"
      || payload.parser_id !== insurer || payload.parser_version !== "non-tata-cv-v2"
      || payload.extraction_method !== "native_pdf_text"
      || payload.review_required !== true || payload.auto_finalize_allowed !== false
      || payload.intake_id !== ids.intake_id || payload.document_id !== ids.document_id
      || payload.request_id !== ids.request_id)
  {
    const safe=object(payload)?payload:null;
    const rawParser=safe?.parser_id;
    console.warn("[nontata-contract] validation hold",{
      classifiedAs:insurer,
      returnedParser:typeof rawParser==="string"&&/^[a-z0-9_]{1,80}$/.test(rawParser)?rawParser:"invalid",
      versionMatches:safe?.contract_version==="1"&&safe?.parser_version==="non-tata-cv-v2",
      sourceMatches:safe?.extraction_method==="native_pdf_text",
      flagsMatch:safe?.review_required===true&&safe?.auto_finalize_allowed===false,
      identityMatches:safe?.intake_id===ids.intake_id&&safe?.document_id===ids.document_id
        &&safe?.request_id===ids.request_id,
    });
    throw new Error("n8n_nontata_identity_or_contract_invalid");
  }
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
  if(insurer==="united_india_gcv_punjab_split_gst_native_pdf"){
    // Never represent split CGST/SGST as IGST or trust a remote total.
    if(premium.taxRegime!=="CGST_SGST"
      ||![premium.cgstOthers,premium.sgstOthers,premium.cgstBasicTp,premium.sgstBasicTp].every(isMoney)
      ||Math.round((Number(premium.cgstOthers)+Number(premium.sgstOthers)
        +Number(premium.cgstBasicTp)+Number(premium.sgstBasicTp))*100)!==Math.round(Number(premium.gst)*100)
      ||!isMoney(premium.stampDuty)||premium.stampDuty!==1)
      throw new Error("n8n_uiic_split_cgst_sgst_evidence_invalid");
  }
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
  let insurer = await recognizeNonTataCommercialPdf(file);
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
    if(insurer==="united_india_gcv_native_pdf"){
      insurer=resolveUiicPunjabCertifiedN8nVariant(insurer,payload) as Insurer;
    }
    // The original PDF must ALREADY be independently classified Go Digit
    // Commercial Vehicle. Promotion never relies on a parser ID alone:
    // acceptGoDigitNewJcbExtraction checks the exact 18-check source proof,
    // unique current document/request IDs and literal printed NEW evidence.
    if(insurer==="go_digit_cv_native_pdf"&&object(payload)
      &&payload.parser_id==="go_digit_jcb_new_unregistered_native_pdf")
      insurer="go_digit_jcb_new_unregistered_native_pdf";
    // Signature must be verified against the EXACT File bytes sent to n8n.
    // No decoded text, PDF print date, receipt, or caller-supplied date can
    // authorize this fallback. Unverifiable originals remain in review.
    const signature=(insurer==="oriental_private_car_standalone_od_native_pdf"
      ||insurer==="oriental_gccv_package_native_pdf")
      ?await verifyOrientalCmsSigningDate(new Uint8Array(await file.arrayBuffer()))
      :null;
    return validate(payload, insurer, requestIds, signature);
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
