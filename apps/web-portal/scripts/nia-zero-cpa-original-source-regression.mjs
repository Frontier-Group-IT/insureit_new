import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {certifyNiaZeroChargedCpa,NIA_ZERO_CHARGE_SOURCE} from "../lib/policy-nia-zero-charge-source.ts";
const premium={od:6365,tp:16149,net:22514,gst:1966,gross:24480};
const pdf=[
 "THE NEW INDIA ASSURANCE CO. LTD.",
 "Commercial Vehicle Package Policy Enhanced Covers",
 "SCHEDULE OF PREMIUM",
 "Own Damage Liability",
 "Basic OD Premium 3977 Basic TP Premium 16049",
 "(+)LL to paid driver conductor cleaner employed for",
 "oprn 100",
 "Total OD Premium (Rs) 6365 Total TP Premium (Rs) 16149",
 "Net Premium (Rs) 22,514",
 "GST (Rs) 1,966",
 "Total Payable (Rs) 24,480",
 "Total Payable in Rs(in words): RUPEES TWENTY FOUR THOUSAND FOUR HUNDRED EIGHTY",
 "PA cover for Owner Driver",
 "Name of Nominee Age of Nominee Relationship with the Insured",
 "none 0 none none none",
 "PA cover for named persons",
 "Premium and GST Details",
 "Rate of Tax Amount in INR",
 "Premium Rs6465",
 "SGST 0 0",
 "CGST 0 0",
 "IGST 18 1164",
 "Premium Rs16049",
 "SGST 0 0",
 "CGST 0 0",
 "IGST 5 802",
].join("\n");
assert.equal(certifyNiaZeroChargedCpa(pdf,premium),true);
const wide=pdf.replace("Total Payable (Rs) 24,480","Total Payable (Rs) "+" ".repeat(300)+"24,480")
 .replace("Basic OD Premium 3977 Basic TP Premium 16049","Basic OD Premium                 3977      Basic TP Premium                  16049");
assert.equal(certifyNiaZeroChargedCpa(wide,premium),true,
 "The original wide-column premium table must certify without a new insurer document");
for(const changed of [
 pdf.replace("none 0 none none none","Customer Name 45 spouse none none"),
 pdf.replace("IGST 18 1164","IGST 18 1163"),
 pdf.replace("IGST 5 802","IGST 5 803"),
 pdf.replace("Premium Rs16049","Premium Rs16048"),
 pdf.replace("Basic TP Premium 16049","Basic TP Premium 16048"),
 pdf.replace("oprn 100","oprn 200"),
 pdf.replace("Total Payable (Rs) 24,480","Total Payable (Rs) 24,481"),
 pdf.replace("THE NEW INDIA ASSURANCE CO. LTD.","ANY OTHER INSURER"),
 pdf.replace("PA cover for Owner Driver","Compulsory PA Premium for Owner Driver"),
 pdf+" \n(+)Compulsory PA Premium for Owner Driver 375",
])assert.equal(certifyNiaZeroChargedCpa(changed,premium),false,
 "Altered source evidence must never permit a fabricated zero CPA charge");
assert.equal(certifyNiaZeroChargedCpa(pdf,{...premium,gross:24481}),false);
assert.equal(certifyNiaZeroChargedCpa(pdf,{...premium,tp:16148}),false);
assert.match(NIA_ZERO_CHARGE_SOURCE,/no CPA charged/);
const adapter=readFileSync(new URL("../lib/policy-nontata-commercial-n8n.ts",import.meta.url),"utf8");
assert.ok(adapter.includes("certifyNiaZeroChargedCpa(original,read.premium)"));
assert.ok(adapter.includes('if((!cpa||cpa.value==="0")'));
assert.ok(adapter.includes("confidence:null,page:2,evidence:NIA_ZERO_CHARGE_SOURCE"));
console.log("NIA source-only charged CPA zero supported with strict original-premium and negative evidence fixtures");
