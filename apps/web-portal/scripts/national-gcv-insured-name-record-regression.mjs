import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {normalizeNationalGcvLeadingDot} from "../lib/policy-national-gcv-insured-name.ts";

const extracted=".ALPHA LOGISTICS CORPORATION OF INDIA";
assert.deepEqual(normalizeNationalGcvLeadingDot(extracted),{
  name:"ALPHA LOGISTICS CORPORATION OF INDIA",raw:extracted,
});
const normalized=normalizeNationalGcvLeadingDot(extracted);
const customer={contact_name:"ALPHA LOGISTICS CORPORATION OF INDIA",phone:"9000000000"};
const draft={insuredName:normalized.name,phoneNo:"9000000000"};
const norm=x=>x.normalize("NFKC").trim().replace(/\s+/g," ").toUpperCase();
assert.equal(norm(draft.insuredName),norm(customer.contact_name));
assert.equal(draft.phoneNo,customer.phone);
for(const invalid of [
 "ALPHA LOGISTICS CORPORATION OF INDIA",
 "M/S. ALPHA LOGISTICS CORPORATION OF INDIA",
 "ALPHA. LOGISTICS CORPORATION OF INDIA",
 "..ALPHA LOGISTICS CORPORATION OF INDIA",
 ".",
 ".  ALPHA LOGISTICS CORPORATION OF INDIA",
 ".A",
 ".123 COMPANY",
 ".ALPHA_OTHERS",
])assert.equal(normalizeNationalGcvLeadingDot(invalid),null,
 "Never silently remove meaningful text or punctuation other than one original leading dot");

const reader=readFileSync(new URL("../lib/policy-nontata-commercial-n8n.ts",import.meta.url),"utf8");
assert.ok(reader.includes('if(insurer==="national_gcv_package_native_pdf"){'));
assert.ok(reader.includes('read.checksPassed===18&&read.warnings.length===0'));
assert.ok(reader.includes('normalizeNationalGcvLeadingDot(insured.value)'));
assert.ok(reader.includes('insured.value=normalized.name'));
assert.ok(reader.includes('raw extracted name: "+normalized.raw'));
assert.ok(reader.includes('assessNationalGcvRecordSource('));
const action=readFileSync(new URL("../app/development/ai-policy-onboarding/actions.ts",import.meta.url),"utf8");
assert.ok(action.includes('normalizedIdentity(pdfField("insured_name"))!==normalizedIdentity(forwarded.draft.insuredName)'));
assert.ok(action.includes('const exactMatches=masters.filter('));
assert.ok(action.includes('c.phone.replace(/\\D/g,"").slice(-10)===phone'));
assert.ok(action.includes('&& [c.company_name,c.contact_name].some('));
console.log("National GCV single leading punctuation normalization preserves exact-name + phone booking requirements");
