import assert from "node:assert/strict";
import {assessNiaNamedAuthorityUnregisteredConversion} from "../lib/policy-commercial-direct-eligibility.ts";
const field=(key,value,evidence="Native PDF policy schedule")=>({key,value:String(value),evidence});
const fields=[
 field("insured_name","TEST INSURED"),field("policy_number","TESTPOLICY123"),
 field("insurer_name","The New India Assurance Company Limited"),
 field("policy_issuance_date","2026-11-26"),
 field("policy_start_date","2026-11-26"),field("policy_end_date","2027-11-25"),
 field("third_party_start_date","2026-11-26"),field("third_party_end_date","2027-11-25"),
 field("policy_product","Commercial Vehicle Package Policy"),
 field("vehicle_registration_status","unregistered","NIA PDF partial registration prefix MP-20; no full plate"),
 field("vehicle_class","Commercial Vehicle - Goods Carrying"),
 field("vehicle_make","TATA MOTOR"),field("vehicle_model","TATA INTRA V30 TRUCK"),
 field("vehicle_fuel_type","Diesel"),field("vehicle_manufacturing_year","2026"),
 field("vehicle_capacity","2760"),field("vehicle_chassis_number","TESTCHASSIS123456"),
 field("vehicle_engine_number","TESTENGINE123"),field("idv","1000000"),
 field("cpa_premium","275","NIA PDF page 2 Owner Driver PA; TP and 18%/5% IGST bases independently reconciled"),
 field("od_premium","4818"),field("tp_premium","16424"),
 field("vehicle_rto_name","Jabalpur","Native PDF policy schedule"),
];
const base={parserId:"new_india_cv_native_pdf",checksPassed:16,warnings:[],
 fields,commercialPremium:{od:4818,tp:16424,net:21242,gst:3850,gross:25092}};
assert.equal(assessNiaNamedAuthorityUnregisteredConversion(base).reason,
 "nia_untrained_vehicle_or_product_variant",
 "Untrained Tata Intra must be diagnosed first, not as optional RTO city error");
const withoutCpa={...base,fields:fields.filter(x=>x.key!=="cpa_premium")};
assert.equal(assessNiaNamedAuthorityUnregisteredConversion(withoutCpa).reason,
 "nia_missing_verified_cpa_premium");
const changed={...base,fields:fields.map(x=>x.key==="vehicle_model"?{...x,value:"1918 AZURA"}:x)};
assert.equal(assessNiaNamedAuthorityUnregisteredConversion(changed).reason,
 "nia_named_rto_authority_not_verified",
 "Known model still requires independent source verification of supplied RTO evidence");
console.log("New India untrained-model and missing CPA diagnostics preserve source holds");
