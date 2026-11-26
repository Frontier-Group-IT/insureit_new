import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";
import ts from "typescript";
const here=path.dirname(fileURLToPath(import.meta.url));
const source=fs.readFileSync(path.resolve(here,"../lib/policy-nontata-commercial-n8n.ts"),"utf8");
const start=source.indexOf("export function refineUiicPunjabSplitFromSource(");
const end=source.indexOf("/** Recognize only printed",start);
assert(start>0&&end>start);
const module={exports:{}};
const js=ts.transpileModule(source.slice(start,end),{
 compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}
}).outputText;
new Function("exports",js)(module.exports);
const refine=module.exports.refineUiicPunjabSplitFromSource;
const base="UNITED INDIA INSURANCE COMPANY LIMITED\nGCV PUBLIC CARRIER OTHER THAN 3 WHEELER - PACKAGE POLICY\n";
const marker="DAIMLER INDIA COMMERCIAL VEHICLES PVT. LTD / BHARATBENZ 2828C 6X4 BSVI";
const tax="CGST-Others(9%) 1893.00\nSGST-Basic TP(2.50%) 1099.00";
const late=base+("Vehicle schedule\n".repeat(180))+marker+"\n"+tax;
assert.equal(refine("united_india_gcv_native_pdf",late),"united_india_gcv_punjab_split_gst_native_pdf");
assert.equal(refine("united_india_gcv_native_pdf",base+tax),"united_india_gcv_native_pdf",
 "Another maker cannot be upgraded on tax alone");
assert.equal(refine("united_india_gcv_native_pdf",base+marker),"united_india_gcv_native_pdf",
 "Split tax evidence must be independently present");
assert.equal(refine("united_india_gcv_native_pdf",late.replace("SGST-Basic TP(2.50%)","IGST-Basic TP(2.50%)")),
 "united_india_gcv_native_pdf","Different printed tax regime cannot be mislabeled");
assert.equal(refine("oriental_gccv_package_native_pdf",late),"oriental_gccv_package_native_pdf",
 "Other insurer routes must not be mutated");
assert.equal(refine(null,late),null);

// Real-world PDF extraction engines may separate tax punctuation and OEM labels.
const brokenSpacing=late.replace("PVT. LTD / BHARATBENZ","PVT LTD / BHARATBENZ")
 .replace("CGST-Others(9%)","CGST - Others ( 9 % )")
 .replace("SGST-Basic TP(2.50%)","SGST - Basic TP ( 2.50 % )");
assert.equal(refine("united_india_gcv_native_pdf",brokenSpacing),
 "united_india_gcv_punjab_split_gst_native_pdf");
assert.equal(refine("united_india_gcv_native_pdf",brokenSpacing.replace("DAIMLER","UNKNOWN")),
 "united_india_gcv_native_pdf","No maker identity means no promotion");
assert.equal(refine("united_india_gcv_native_pdf",brokenSpacing.replace("SGST - Basic TP","IGST - Basic TP")),
 "united_india_gcv_native_pdf","No split tax means no promotion");

// A row-based native PDF reader must not silently drop valid no-transform
// fragments; its late-page source-only fallback must stay document-bound.
const readerSource=fs.readFileSync(path.resolve(here,"../lib/policy-ocr-native-pdf.ts"),"utf8");
assert.match(readerSource,/const fragments=\(content\.items as unknown\[\]\)/);
assert.match(readerSource,/const text=positioned\|\|fragments\.join\(" "\)/);
assert.match(readerSource,/extractText\(document,\{mergePages:false\}\)/);
assert.match(readerSource,/pages\.every\(page=>!page\.text\.trim\(\)\)/);
const nativeReader=fs.readFileSync(path.resolve(here,"../lib/policy-ocr-native-pdf.ts"),"utf8");
const nativeClassifier=fs.readFileSync(path.resolve(here,"../lib/policy-nontata-commercial-n8n.ts"),"utf8");
assert.match(nativeReader,/maxTextPages\?: number/, "Reader must offer a bounded late-page request");
assert.match(nativeReader,/Math\.min\(MAX_NATIVE_PDF_PAGES, maxRequested!\)/,
  "Extended scan must not exceed the existing PDF page safety cap");
assert.match(nativeClassifier,/maxTextPages:16,extendedTimeout:true/,
  "UIIC classifier must actually request later pages, not slice two pages");
assert.match(nativeClassifier,/if\(initial==="united_india_gcv_native_pdf"\)/,
  "Expanded PDF decoding must remain isolated to generic UIIC GCV");

const punctuationVariant=late.replace("PVT. LTD / BHARATBENZ","PVT LTD    BHARATBENZ")
 .replace("CGST-Others(9%)","CGST Others (9%)")
 .replace("SGST-Basic TP(2.50%)","SGST Basic TP (2.50%)");
assert.equal(refine("united_india_gcv_native_pdf",punctuationVariant),
 "united_india_gcv_punjab_split_gst_native_pdf",
 "Source text may drop punctuation while retaining exact maker and split tax evidence");
assert.equal(refine("united_india_gcv_native_pdf",punctuationVariant.replace("9%","18%")),
 "united_india_gcv_native_pdf","Wrong tax rate cannot pass");
// The first native pages can independently recognize UIIC GCV even when
// the late-page reader returns zero text. Accept the specialized Punjab
// product ONLY if the exact original source is fully 18-check certified by
// the n8n PDF parser, never from the parser name alone.
const handoffStart=source.indexOf("export function resolveUiicPunjabCertifiedN8nVariant(");
const handoffEnd=source.indexOf("/** Recognize only printed",handoffStart);
assert(handoffStart>0 && handoffEnd>handoffStart);
const handoffModule={exports:{}};
new Function("exports",ts.transpileModule(source.slice(handoffStart,handoffEnd),{
  compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}
}).outputText)(handoffModule.exports);
const admit=handoffModule.exports.resolveUiicPunjabCertifiedN8nVariant;
const all=[
 "insurer_verified","policy_identity_verified","insured_name_verified",
 "policy_start_end_verified","issuance_date_evidenced","vehicle_identification_verified",
 "vehicle_make_model_verified","vehicle_class_verified","vehicle_registration_printed",
 "vehicle_idv_verified","od_tp_components_printed","net_od_tp_reconciled",
 "gst_independently_evidenced","gross_net_tax_reconciled","uiic_layout",
 "split_cgst_sgst_components_printed","stamp_accounting_disclosed","stamp_charge_reconciled",
];
const props={contract_version:"1",parser_id:"united_india_gcv_punjab_split_gst_native_pdf",
 parser_version:"non-tata-cv-v2",extraction_method:"native_pdf_text",
 review_required:true,auto_finalize_allowed:false,ok:true,validation_passed:true,
 checks:Object.fromEntries(all.map(k=>[k,true])),
 fields:[
  ["insurer_name","United India Insurance Company Limited"],
  ["policy_product","Goods Carrying Vehicle Package"],
  ["vehicle_make","Daimler India Commercial Vehicles Pvt. Ltd."],
  ["vehicle_model","BHARATBENZ 2828C 6X4 BSVI"],
 ].map(([key,value])=>({key,value,page:null,evidence:"Native PDF policy schedule"})),
 premium_components:{taxRegime:"CGST_SGST",cgstOthers:1893,sgstOthers:1893,
   cgstBasicTp:1099,sgstBasicTp:1099},
};
const standard="united_india_gcv_native_pdf",punjab=props.parser_id;
assert.equal(admit(standard,props),punjab);
assert.equal(admit(null,props),null);
assert.equal(admit("new_india_cv_native_pdf",props),"new_india_cv_native_pdf");
assert.equal(admit(standard,{...props,checks:{...props.checks,split_cgst_sgst_components_printed:false}}),standard);
assert.equal(admit(standard,{...props,checks:{...props.checks,unknown:true}}),standard);
assert.equal(admit(standard,{...props,premium_components:{...props.premium_components,cgstOthers:0}}),standard);
assert.equal(admit(standard,{...props,premium_components:{...props.premium_components,sgstOthers:1800}}),standard);
assert.equal(admit(standard,{...props,fields:props.fields.map(f=>f.key==="vehicle_make"?{...f,value:"Another Maker"}:f)}),standard);
assert.equal(admit(standard,{...props,fields:props.fields.map(f=>({...f,evidence:"Unverified OCR"}))}),standard);
assert.equal(admit(standard,{...props,parser_id:"united_india_gcv_native_pdf"}),standard);
assert.equal(admit(standard,{...props,auto_finalize_allowed:true}),standard);
assert.match(source,/insurer=resolveUiicPunjabCertifiedN8nVariant\(insurer,payload\)/);
const bridge=fs.readFileSync(path.resolve(here,"../lib/policy-intake-semi-auto-n8n.ts"),"utf8");
assert.match(bridge,/"held_source_or_identity_unverified"/,
 "Genuine Oriental issuance hold must be reported as source verification, not n8n outage");
assert.match(bridge,/"held_required_source_field_missing"/,
 "Missing Magma source fields must not be misreported as network outage");
assert.match(bridge,/"n8n_nontata_identity_or_contract_invalid"/,
 "UIIC parser response mismatch is validation failure, not connectivity issue");
console.log("UIIC Punjab: complete-PDF split CGST/SGST source refinement and negative insurer/tax tests passed");
