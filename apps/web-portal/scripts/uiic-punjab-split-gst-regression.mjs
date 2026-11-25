import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";
import ts from "typescript";
const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,"..");
const source=fs.readFileSync(path.resolve(root,"../../infra/n8n-local/workflows/united-india-gcv-live-source-20261125.js"),"utf8");
const parse=new Function("$input","$",source);
const policy="123456789P123456789";
const fake=[
 "UNITED INDIA INSURANCE COMPANY LIMITED",
 "GCV PUBLIC CARRIER OTHER THAN 3 WHEELER - PACKAGE POLICY",
 "Policy No. "+policy+" Certificate Number "+policy,
 "Name of the Insured M/S SAMPLE TRANSPORT",
 "Address of the Insured",
 "Period of Insurance From 00:00 Hrs of 24/11/2026 To Midnight of 23/11/2027",
 "Date of Issue:23/11/2026",
 "Particulars of Vehicle Insured",
 "Registration No.",
 "Obsolete Vehicle Engine No. Chassis No. Make/Model Year of Mfg",
 "PB - 35 - AQ - 9134 No 123456A1234567 MEC123456789012345",
 "DAIMLER INDIA COMMERCIAL VEHICLES PVT. LTD / BHARATBENZ 2828C 6X4 BSVI 52 2025",
 "Type of Body / Fuel Type HP/Cubic Capacity GVW Seating Capacity Public/Private",
 "Fully Built / Diesel 7200 28000 3 Public",
 "Insured's Declared Value",
 "For Vehicle For Trailer Non Electrical Accessories Electrical/Electronic Accessories CNG Unit LPG Unit Total Value",
 "4120000 0 0 0 0 0 4120000",
 "Registration Authority Auto Association Membership No. Geographical Area Extension",
 "RTO PATHANKOT INDIA",
 "Premium: 64,979.00",
 "CGST-Others(9%): 1,893.00",
 "SGST-Others(9%): 1,893.00",
 "CGST-Basic TP(2.50%): 1,099.00",
 "SGST-Basic TP(2.50%): 1,099.00",
 "Stamp Duty: 1.00",
 "Total(Rounded Off): 70,963.00",
 "SCHEDULE OF PREMIUM",
 "A. Basic - OD 7,543.12",
 "Geographical Extension - OD 400.00",
 "Cover for lamps, tyres, tubes etc 1,131.47",
 "Nil Depreciation Without Excess 15,086.24",
 "No Claim Bonus 20% 4,832.17",
 "Additional Towing Charge",
 "(SI: 20000/-)",
 "1,500.00",
 "Gross OD(A) 20,829.00",
 "B. Basic - TP 43,950.00",
 "LL to Paid Driver IMT 28 100.00",
 "Geographical Extension - TP 100.00",
 "Gross TP(B) 44,150.00",
 "Gross OD & TP:",
 "(A) + (B)",
 "64,979.00",
 "Compulsory Personal Accident (CPA) cover is removed"
].join("\n");
const parseOne=(text)=>parse({all:()=>[{json:{text}}]},
 ()=>({first:()=>({json:{intake_id:"a",document_id:"b",request_id:"c"}})}))[0].json;
const valid=parseOne(fake);
assert.equal(valid.ok,true,JSON.stringify(valid.warnings));
assert.equal(Object.values(valid.checks).filter(Boolean).length,18);
assert.equal(valid.parser_id,"united_india_gcv_punjab_split_gst_native_pdf");
assert.deepEqual({od:valid.premium_components.od,tp:valid.premium_components.tp,
  net:valid.premium_components.net,gst:valid.premium_components.gst,
  gross:valid.premium_components.gross},
  {od:20829,tp:44150,net:64979,gst:5984,gross:70963});
assert.equal(valid.premium_components.taxRegime,"CGST_SGST");
assert(!("igstOthers" in valid.premium_components));
for(const altered of [
  fake.replace("SGST-Basic TP(2.50%): 1,099.00","SGST-Basic TP(2.50%): 1,098.00"),
  fake.replace("B. Basic - TP 43,950.00","B. Basic - TP 43,000.00"),
  fake.replace("RTO PATHANKOT INDIA","DELHI INDIA"),
  fake.replace("RTO PATHANKOT INDIA","DELHI INDIA\nPrevious vehicle Registration Authority\nRTO PATHANKOT INDIA"),
  fake.replace("MEC123456789012345","UNKNOWNCHASSIS"),
  fake.replace("DAIMLER INDIA COMMERCIAL VEHICLES PVT. LTD / BHARATBENZ","UNLISTED COMPANY / UNKNOWN"),
]) assert.notEqual(parseOne(altered).ok,true,"Forged or missing PDF evidence must fail");
const eligibility=fs.readFileSync(path.join(root,"lib/policy-commercial-direct-eligibility.ts"),"utf8");
const js=ts.transpileModule(eligibility,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
const ex={};new Function("exports",js)(ex);
const eligible=ex.assessUiicGcvDirectConversion;
const input={parserId:valid.parser_id,checksPassed:18,warnings:[],fields:valid.fields,
 commercialPremium:valid.premium_components};
assert.equal(eligible(input).eligible,true,JSON.stringify(eligible(input)));
const wrong=valid.fields.map(f=>f.key==="vehicle_rto_name"?{...f,evidence:"Native PDF policy schedule"}:f);
assert.equal(eligible({...input,fields:wrong}).eligible,false);
assert.equal(eligible({...input,fields:valid.fields.map(f=>f.key==="vehicle_make"?{...f,value:"Tata Motors"}:f)}).eligible,false);
const bridge=fs.readFileSync(path.join(root,"lib/policy-nontata-commercial-n8n.ts"),"utf8");
assert(bridge.includes("split_cgst_sgst_components_printed")&&bridge.includes("n8n_uiic_split_cgst_sgst_evidence_invalid"));
console.log("UIIC Punjab BharatBenz 18-check CGST/SGST, source and preflight regressions passed");
