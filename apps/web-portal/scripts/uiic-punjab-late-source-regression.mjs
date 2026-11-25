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
console.log("UIIC Punjab: complete-PDF split CGST/SGST source refinement and negative insurer/tax tests passed");
