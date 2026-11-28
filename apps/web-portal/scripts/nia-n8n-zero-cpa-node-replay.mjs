import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const code=readFileSync(new URL("../../../infra/n8n-local/parser/new-india-cv-zero-cpa-source-v3.js",import.meta.url),"utf8");
const run=new Function("$input","$",code);
const fixture=[
"THE NEW INDIA ASSURANCE CO. LTD.",
"Commercial Vehicle Package Policy Enhanced Covers",
"Policy Number : 12345678901234567890",
"Insured's Name",
"SYNTHETIC TRADER",
"Customer ID: SYNTH",
"Period of cover 26/11/2026 04:21:59 PM to 25/11/2027 11:59:59 PM",
"Year of manufacture: 2026",
"Type of fuel: Diesel",
"Make/Model:",
"TATA MOTOR/TATA INTRA V30 TRUCK",
"Registration no. MP-21",
"Chassis no./Engine no.:",
"MAT12345678901234/REVTRN18JTXS12361",
"Gross Vehicle Weight (GVW): 2910",
"INSURED DECLARED VALUE (Rs)",
"Vehicle Trailer Non-Elec Acc Electrical Acc Total Value",
"844998 0 0 0 844998",
"Total Value",
"844998",
"SCHEDULE OF PREMIUM",
"Own Damage Liability",
"Basic OD Premium 3977 Basic TP Premium 16049",
"(+)Loading for Inclusion of IMT 23 596.5 (+)LL to paid driver conductor cleaner employed for",
"(+)Nil Depreciation Cover Premium 2387.89 oprn 100",
"(+)Premium for enhancement cover 2387.89",
"Calculated OD Premium 6365 Calculated TP Premium 16149",
"Total OD Premium (Rs) 6365 Total TP Premium (Rs) 16149",
"Net Premium (Rs) 22,514",
"GST (Rs) 1,966",
"Total Payable (Rs) 24,480",
"PA cover for Owner Driver",
"Name of Nominee Age of Nominee Relationship with the Insured",
"none 0 none none none",
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
"Policy No.: 12345678901234567890",
"Date of Issue: 26/11/2026",
].join("\n");
const exec=text=>{
 const result=run({all:()=>[{json:{text}}]},()=>({first:()=>({json:{intake_id:"TEST",document_id:"DOC",request_id:"REQ"}})}));
 return result[0].json;
};
const field=(result,key)=>result.fields.find(f=>f.key===key);
const valid=exec(fixture);
assert.equal(field(valid,"cpa_premium")?.value,"0","Printed nominee-none and full tax split certify zero CPA charge");
assert.match(field(valid,"cpa_premium")?.evidence??"",/no CPA charged/);
for(const modified of [
 fixture.replace("none 0 none none none","NAME 45 spouse none none"),
 fixture.replace("IGST 18 1164","IGST 18 1163"),
 fixture.replace("IGST 5 802","IGST 5 801"),
 fixture.replace("Basic TP Premium 16049","Basic TP Premium 16048"),
 fixture.replace("oprn 100","oprn 200"),
 fixture.replace("Total Payable (Rs) 24,480","Total Payable (Rs) 24,481"),
 fixture.replace("IGST 5 802","IGST 18 802"),
 fixture.replace("PA cover for Owner Driver","(+)Compulsory PA Premium for Owner Driver 375\nPA cover for Owner Driver"),
]){
 const result=exec(modified);
 assert.notEqual(field(result,"cpa_premium")?.value,"0",
   "A zero CPA charge must never survive altered source nominee, tax or liability evidence");
}
console.log("Versioned n8n NIA parser: full synthetic 0 CPA charge pass; nominee, TP, GST, net and gross alterations rejected");
