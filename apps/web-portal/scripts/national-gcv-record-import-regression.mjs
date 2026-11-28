import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {assessNationalGcvRecordSource} from "../lib/policy-national-gcv-record-source.ts";

const policy=[
 "Policy Schedule-Motor - Goods Carrying Vehicle - Package",
 "National Insurance Co. Ltd.",
 "Commercial Vehicle Package Policy",
 "स्व-क्षति /Own",
 "Damage Cover(inclusive of add ons wherever ₹ 1,723.04",
 "Legal Liability Cover 27,186.00",
 "Legal Liability to Driver,Cleaner,Coolies 100.00",
 "CNG/LPG Kit 0.00",
 "Premium ₹ 29,009.00",
 "IGST ₹ 1,687.00",
 "Total Amount ₹ 30,696.00",
 "TAX INVOICE",
 "SAC CODE DESCRIPTION",
 "997134 Motor 1,823.04 1,823.04 0% 0.00 0% 0.00 18% 328.00",
 "vehicle insurance services",
 "997134 Motor 27,186.00 27,186.00 0% 0.00 0% 0.00 5% 1,359.00",
 "vehicle insurance services",
 "TOTAL 29,009.00 29,009.00 0.00 0.00 1,687.00",
].join("\n");
const premium={od:1723.04,tp:27286,net:29009,gst:1687,gross:30696};
const full=assessNationalGcvRecordSource(policy,premium);
assert.ok(full,"Two printed IGST rows and payable should reconcile");
assert.deepEqual(full.canonical,{od:"1723",tp:"27286",addOnPremium:"0",cpa:"0",cpaOpted:"No"});
assert.equal(full.roundingAdjustment,-.04);
// Exact native-PDF bilingual heading shape: Hindi glyphs may be inserted
// between the printed goods-carrying title and final Package token.
const mixedHeading=policy.replace(
 "Policy Schedule-Motor - Goods Carrying Vehicle - Package",
 "पॉलिसी अनुसूची /Policy Schedule-Motor - Goods Carrying Vehicle -\n          ु च\n Package"
);
assert.ok(assessNationalGcvRecordSource(mixedHeading,premium),
 "Original Hindi/English line-fragmented National title must import as a record");
assert.equal(assessNationalGcvRecordSource(
 mixedHeading.replace("Package\n", "Liability Only\n").replace(/\bPackage\b/g,"Liability Only"),premium),null,
 "Not a valid National GCV package product");
assert.equal(assessNationalGcvRecordSource(
 mixedHeading.replace("          ु च", "X".repeat(150)),premium),null,
 "Unbounded headings must not accidentally match unrelated sections");

assert.match(full.rationale,/not asserted/,"No assertion of CPA cover or waiver");

for(const altered of [
 policy.replace("18% 328.00","18% 329.00"),
 policy.replace("5% 1,359.00","5% 1,358.00"),
 policy.replace("27,186.00 27,186.00","27,185.00 27,185.00"),
 policy.replace("Legal Liability to Driver,Cleaner,Coolies 100.00",
   "Legal Liability to Driver,Cleaner,Coolies 200.00"),
 policy.replace("₹ 1,723.04","₹ 1,723.00"),
 policy.replace("TAX INVOICE","CIS Annexure"),
 policy.replace("National Insurance Co. Ltd.","Another Insurer"),
])assert.equal(assessNationalGcvRecordSource(altered,premium),null,
  "Changing printed evidence must not yield unattended record mapping");
for(const altered of [
 {...premium,gross:30695},{...premium,net:29008},
 {...premium,od:1724.04},{...premium,tp:27285},
])assert.equal(assessNationalGcvRecordSource(policy,altered),null,
 "Changed inferred premium must not reconcile");
const reader=readFileSync(new URL("../lib/policy-nontata-commercial-n8n.ts",import.meta.url),"utf8");
assert.ok(reader.includes("assessNationalGcvRecordSource("));
assert.ok(reader.includes("maxTextPages:10,extendedTimeout:true"));
assert.ok(reader.includes("read.candidateCanonicalPremium=certified.canonical"));
const book=readFileSync(new URL("../app/development/ai-policy-onboarding/actions.ts",import.meta.url),"utf8");
assert.ok(book.includes('&&extracted.preview.candidateCanonicalPremium'));
const queue=readFileSync(new URL("../lib/ai-policy-onboarding-queue-server.ts",import.meta.url),"utf8");
assert.ok(queue.includes('&&!extraction.preview.candidateCanonicalPremium'));
console.log("National GCV record-only original-invoice source mapping and anti-tamper tests passed");
