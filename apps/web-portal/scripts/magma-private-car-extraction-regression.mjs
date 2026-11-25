import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const code=fs.readFileSync(path.resolve(root,"../../infra/n8n-local/workflows/magma-private-car-package-parser-v1.js"),"utf8");
const parse=new Function("$input",code);
const text=[
"Magma General Insurance Limited","PRIVATE CAR PACKAGE POLICY",
"Policy No P0027100023/4101/108063",
"Name of Insured Mr SAMPLE POLICYHOLDER",
"Period of Insurance 27/11/2026 TO 26/11/2027",
"Vehicle Make/Model RENAULT / TRIBER RXE MT","RTO PALWAL",
"Vehicle Registration No. HR 30 Z 0885",
"Vehicle Registration Date 28/02/2023",
"Engine No. SAMPLE1234","Chassis No. SAMPLECHASSIS00001",
"INSURED MOTOR VEHICLE DETAILS AND PREMIUM COMPUTATION",
"999 7 0",
"IDV (INSURED'S DECLARED VALUE)",
"IDV of Vehicle Non Electrical Accessories",
"Electrical/electronic","Accessories",
"Bi-Fuel kit(LPG/CNG) Other accessories Total Value",
"420000 0 0 0 / 0 0 420000",
"OWN DAMAGE(A)","Basic - OD 2,680.40",
"Basic Roadside Assistance 51.00",
"Depreciation Re-imbursement 2,100.00",
"Consumables 756.00",
"Sub Total 5,587.40","Less:","No claim bonus 35% 938.14",
"Total Own Damage Premium(A) 4,649.00",
"LIABILITY(B)","Basic - TP 2,094.00",
"PA Owner Driver -SI Rs.1500000 450.00",
"LL to Paid Driver IMT 28 50.00",
"Total Liability Premium(B) 2,594.00",
"Premium Computation","Total Package Premium(A+B) 7,243.00",
"CGST @ 9% 651.87","SGST @ 9% 651.87","TOTAL 8,547.00",
"Date of Issue : 20/11/2026",
"*Fuel Used: Petrol Diesel Bi Fuel LPG/CNG Electric Hybrid"
].join("\n");
const run=x=>parse({first:()=>({json:{text:x}})})[0].json;
const v=run(text);
assert.equal(v.ok,true,JSON.stringify(v.warnings));
assert.equal(Object.values(v.checks).filter(Boolean).length,18);
assert.equal(v.parser_id,"magma_private_car_package_native_pdf");
assert.equal(v.premium_components.gross,8547);
assert.equal(v.premium_components.gst,1303.74);
assert.equal(v.fields.find(f=>f.key==="policy_issuance_date")?.value,"2026-11-20");
assert.equal(v.fields.find(f=>f.key==="cpa_premium")?.value,"450");
assert.equal(v.fields.some(f=>f.key==="vehicle_fuel_type"),false,
 "The proposal option list is NOT evidence of selected policy fuel");
assert.equal(v.fuel_verified_from_current_pdf,false);
assert.equal(v.auto_finalize_allowed,false);
for(const invalid of [
 text.replace("CGST @ 9% 651.87","CGST @ 9% 600.00"),
 text.replace("Total Package Premium(A+B) 7,243.00","Total Package Premium(A+B) 7,000.00"),
 text.replace("No claim bonus 35% 938.14","No claim bonus 35% 800.00"),
 text.replace("PA Owner Driver -SI Rs.1500000 450.00",""),
 text.replace("Name of Insured Mr SAMPLE POLICYHOLDER",""),
 text.replace("Chassis No. SAMPLECHASSIS00001",""),
 text.replace("Magma General Insurance Limited","Untrained Insurer")
]) assert.notEqual(run(invalid).ok,true,"Tampered insurer/identity/amount must fail");
const bridge=fs.readFileSync(path.join(root,"lib/policy-nontata-commercial-n8n.ts"),"utf8");
const handoff=fs.readFileSync(path.join(root,"app/policy-intakes/handoff-actions.ts"),"utf8");
const identity=fs.readFileSync(path.join(root,"lib/policy-n8n-onboarding-insured.ts"),"utf8");
const profile=fs.readFileSync(path.join(root,"lib/ai-policy-onboarding-eligibility.ts"),"utf8");
for(const s of [bridge,handoff,identity,profile])
 assert(s.includes('"magma_private_car_package_native_pdf"'),"No partial integration for new insurer");
assert(bridge.includes("roundingToleranceCents"),"Magma printed gross rounding must not relax other insurers");
console.log("Magma two sample layout family and strict source verification passed");
