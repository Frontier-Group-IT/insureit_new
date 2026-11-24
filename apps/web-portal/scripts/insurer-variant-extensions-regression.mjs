import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {
 assessProductVariantDirectConversion,mapVerifiedProductVariantPremium,PRODUCT_VARIANT_PARSERS,
} from "../lib/policy-product-variant-direct-eligibility.ts";

const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const evidence=(key,parser)=>{
 if(key==="vehicle_rto_name")return parser.includes("united")?
   "United India PDF Registration Authority UK17 ROORKEE":"Native PDF: RTO Location registered";
 if(key==="cpa_premium")return "Native PDF: Owner-driver CPA cover removed";
 return "Native PDF: "+key;
};
const common={
 policy_number:"123456789",insured_name:"SANITIZED CUSTOMER",
 policy_issuance_date:"2026-11-16",policy_start_date:"2026-11-17",
 policy_end_date:"2027-11-16",third_party_end_date:"2027-11-16",
 vehicle_registration_number:"UK07AA1234",vehicle_registration_status:"registered",
 vehicle_fuel_type:"Petrol",vehicle_rto_name:"Dehradun",vehicle_rto_state:"Uttarakhand",
 vehicle_chassis_number:"FAKECHASSIS00000001",vehicle_engine_number:"FAKEENGINE00001",
 vehicle_capacity:"1197",idv:"0",od_premium:"0",tp_premium:"3416",cpa_premium:"0",
 vehicle_manufacturing_year:"2010",
};
function fixture(parser,overrides={},premium={od:0,tp:3416,net:3416,gst:614.88,gross:4031}){
 let extra=parser==="zurich_kotak_private_car_tp_native_pdf"?
  {insurer_name:"Zurich Kotak General Insurance Company (India) Limited",
   policy_product:"Third-Party Only",vehicle_class:"Private Car",
   vehicle_make:"MARUTI",vehicle_model:"SWIFT DZIRE LXI"}:
  parser==="united_india_tractor_tp_native_pdf"?
  {insurer_name:"United India Insurance Company Limited",policy_product:"Third-Party Only",
   vehicle_class:"Agricultural Tractor",vehicle_make:"MAHINDRA",vehicle_model:"575 DI XP PLUS",
   vehicle_fuel_type:"Diesel",vehicle_rto_name:"Roorkee",idv:"0",od_premium:"0",
   tp_premium:"7317",vehicle_capacity:"2979"}:
  {insurer_name:"Go Digit General Insurance Limited",policy_product:"Stand-alone Own Damage",
   vehicle_class:"Two Wheeler",vehicle_make:"ROYAL ENFIELD",vehicle_model:"HUNTER 350",
   vehicle_registration_year:"2025",vehicle_manufacturing_year:null,
   vehicle_fuel_type:"Petrol",vehicle_capacity:"349",idv:"145000",
   od_premium:"2312.46",tp_premium:"0",third_party_end_date:"2030-11-17"};
 const merged={...common,...extra,...overrides};
 const fields=Object.entries(merged).filter(([,v])=>v!==null).map(([key,value])=>
  ({key,value,evidence:evidence(key,parser)}));
 if(parser==="go_digit_two_wheeler_od_native_pdf")
    fields.find(f=>f.key==="vehicle_rto_name").evidence="Native PDF: RTO Location";
 return {parserId:parser,checksPassed:parser.includes("kotak")?16:18,warnings:[],
   fields,commercialPremium:premium};
}
const kotak="zurich_kotak_private_car_tp_native_pdf";
const united="united_india_tractor_tp_native_pdf";
const digit="go_digit_two_wheeler_od_native_pdf";
assert.equal(PRODUCT_VARIANT_PARSERS.size,5);
assert.equal(assessProductVariantDirectConversion(fixture(kotak)).eligible,true);
assert.equal(assessProductVariantDirectConversion(fixture(united,
 {policy_start_date:"2026-11-19",policy_end_date:"2027-11-18",
  third_party_end_date:"2027-11-18"}, {od:0,tp:7317,net:7317,gst:1317,gross:8634})).eligible,true);
assert.equal(assessProductVariantDirectConversion(fixture(digit,{policy_start_date:"2026-11-18",
 policy_end_date:"2027-11-17"},
 {od:2312.46,tp:0,net:2312.46,gst:416.24,gross:2728.70})).eligible,true);
assert.deepEqual(mapVerifiedProductVariantPremium({od:0,tp:3416,net:3416,gst:614.88,gross:4031},kotak),
 {od:"0",tp:"3416",addOnPremium:"0",cpa:"0",cpaOpted:"No"});
assert.deepEqual(mapVerifiedProductVariantPremium({od:2312.46,tp:0,net:2312.46,gst:416.24,gross:2728.70},digit),
 {od:"2312.46",tp:"0",addOnPremium:"0",cpa:"0",cpaOpted:"No"});
const hdfc=fixture("hdfc_ergo_two_wheeler_tp_native_pdf",{
 insurer_name:"HDFC ERGO General Insurance Company Limited",policy_product:"Third-Party Only",
 vehicle_class:"Two Wheeler",vehicle_make:"HONDA",vehicle_model:"ACTIVA-3G",
 vehicle_fuel_type:"Petrol",vehicle_capacity:"109",idv:"0",od_premium:"0",
 tp_premium:"714",cpa_premium:"0",third_party_end_date:"2027-11-16",
}, {od:0,tp:714,net:714,gst:129,gross:843});
hdfc.fields.find(f=>f.key==="cpa_premium").evidence="Native PDF: Compulsory PA waiver declaration";
assert.deepEqual(assessProductVariantDirectConversion(hdfc),{eligible:true,reason:""});
const sbi=fixture("sbi_general_private_car_package_native_pdf",{
 insurer_name:"SBI General Insurance Company Limited",policy_product:"Package",
 vehicle_class:"Private Car",vehicle_make:"TATA",vehicle_model:"PUNCH ADVENTURE",
 vehicle_fuel_type:"Petrol",vehicle_capacity:"1199",vehicle_manufacturing_year:"2023",
 idv:"480000",od_premium:"7751.2",tp_premium:"3416",cpa_premium:"325",
}, {od:7751.2,tp:3416,net:11492.2,gst:2068.6,gross:13561,cpa:325,addOn:3922,odBasic:3829.2});
sbi.checksPassed=20;
assert.deepEqual(assessProductVariantDirectConversion(sbi),{eligible:true,reason:""});
assert.deepEqual(mapVerifiedProductVariantPremium(sbi.commercialPremium,sbi.parserId),
 {od:"3829.2",tp:"3416",addOnPremium:"3922",cpa:"325",cpaOpted:"Yes"});
assert.deepEqual(mapVerifiedProductVariantPremium(hdfc.commercialPremium,hdfc.parserId),
 {od:"0",tp:"714",addOnPremium:"0",cpa:"0",cpaOpted:"No"});
const altered=(fixture,fn)=>{const f=structuredClone(fixture);fn(f);return f;};
const kw=fixture(kotak);
assert.equal(assessProductVariantDirectConversion(altered(hdfc,x=>{x.commercialPremium.gst=99})).eligible,false);
assert.equal(assessProductVariantDirectConversion(altered(sbi,x=>{x.commercialPremium.cpa=0})).eligible,false);
assert.equal(assessProductVariantDirectConversion(altered(sbi,x=>{x.commercialPremium.addOn=1000})).eligible,false);
assert.equal(assessProductVariantDirectConversion(altered(kw,x=>{x.warnings=["uncertified"]})).eligible,false);
assert.equal(assessProductVariantDirectConversion(altered(kw,x=>{x.checksPassed=15})).eligible,false);
assert.equal(assessProductVariantDirectConversion(altered(kw,x=>{x.fields.find(f=>f.key==="policy_product").value="Package"})).eligible,false);
assert.equal(assessProductVariantDirectConversion(altered(kw,x=>{x.fields.find(f=>f.key==="vehicle_registration_number").value="NEW"})).eligible,false);
assert.equal(assessProductVariantDirectConversion(altered(kw,x=>{x.fields.find(f=>f.key==="idv").value="1000"})).eligible,false);
assert.equal(assessProductVariantDirectConversion(altered(kw,x=>{x.commercialPremium.gross=9999})).eligible,false);
assert.equal(assessProductVariantDirectConversion(altered(kw,x=>{x.fields.push({...x.fields[0]})})).eligible,false);
const df=fixture(digit,{policy_start_date:"2026-11-18",policy_end_date:"2027-11-17"},
 {od:2312.46,tp:0,net:2312.46,gst:416.24,gross:2728.70});
assert.equal(assessProductVariantDirectConversion(altered(df,x=>{x.fields.push({key:"vehicle_manufacturing_year",value:"2025",evidence:"guessed"});})).eligible,false);
assert.equal(assessProductVariantDirectConversion(altered(df,x=>{x.commercialPremium.tp=100})).eligible,false);
const ui=fixture(united,{policy_start_date:"2026-11-19",policy_end_date:"2027-11-18",
third_party_end_date:"2027-11-18"}, {od:0,tp:7317,net:7317,gst:1317,gross:8634});
assert.equal(assessProductVariantDirectConversion(altered(ui,x=>{x.fields.find(f=>f.key==="cpa_premium").value="275"})).eligible,false);
for(const p of ["infra/n8n-local/extensions/zurich-kotak-private-car-tp.js",
"infra/n8n-local/extensions/united-india-tractor-tp.js",
"infra/n8n-local/extensions/go-digit-two-wheeler-od.js",
"infra/n8n-local/extensions/hdfc-ergo-two-wheeler-tp.js",
"infra/n8n-local/extensions/sbi-general-private-car-package.js"]){
 const code=read("../../"+p);
 assert.match(code,/review_required:true,auto_finalize_allowed:false/);
 assert.doesNotMatch(code,/\bfetch\s*\(|\bcreateSupabaseAdminClient\b/);
}
const bridge=read("lib/policy-nontata-commercial-n8n.ts");
const handoff=read("app/policy-intakes/handoff-actions.ts");
const convert=read("app/development/ai-policy-onboarding/actions.ts");
const eligibility=read("lib/ai-policy-onboarding-eligibility.ts");
assert.match(bridge,/validateNewVariant\(payload/);
assert.match(bridge,/Digit Two-Wheeler Insurance/);
assert.match(bridge,/MISCELLANEOUS AND SPECIAL TYPE OF VEHICLES/);
assert.match(handoff,/assessProductVariantDirectConversion/);
assert.match(handoff,/mapVerifiedProductVariantPremium/);
assert.match(convert,/const productVariant=PRODUCT_VARIANT_PARSERS/);
assert.match(convert,/expectedCommercialProduct=productVariant/);
assert.match(eligibility,/zurich_kotak_private_car_tp_native_pdf/);
console.log("Isolated product-variant extraction, financial and direct-convert regression passed");
