import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const web=readFileSync(new URL("../lib/policy-nontata-commercial-n8n.ts",import.meta.url),"utf8");
for(const condition of [
  'insurer==="united_india_tractor_tp_native_pdf"',
  'make==="Escorts Kubota"&&model==="POWERTRAC 445"',
  'byKey.get("vehicle_class")!=="Agricultural Tractor"',
  'byKey.get("vehicle_rto_state")==="Haryana"',
  'byKey.get("vehicle_capacity")==="45"',
  'prem.taxRegime!=="CGST_SGST"',
  'isMoney(prem.cgst)',
  'isMoney(prem.sgst)',
  'Math.abs(cents(prem.cgst)+cents(prem.sgst)-cents(prem.gst))>1',
  'Math.abs(cents(prem.cgst)-cents(prem.net*.09))>100',
  'Math.abs(cents(prem.sgst)-cents(prem.net*.09))>100',
  'make!=="MAHINDRA"',
  'n8n_extension_tractor_class_invalid',
]) assert.ok(web.includes(condition),"Missing source variant guard: "+condition);
assert.ok(web.includes(String.raw`/^HR\d{2}[A-Z]{1,3}\d{3,4}$/`),"HR registration must be a true numeric plate regex");
assert.ok(web.includes('n8n_extension_tp_only_contract_invalid'),"OD=0, IDV=0, CPA=0 contract remains strict");
assert.ok(web.includes('n8n_extension_financial_reconciliation_failed'),"Gross premium arithmetic is still required");
assert.ok(!web.includes('const powertrac=make==="Escorts Kubota"||'),"Powertrac must need make AND model");
console.log("United India Escorts Powertrac 445 source-certified admission checks passed");
