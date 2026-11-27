import assert from "node:assert/strict";
import {assessProductVariantDirectConversion,mapVerifiedProductVariantPremium} from "../lib/policy-product-variant-direct-eligibility.ts";

const inputs=[
 {id:"sbi_general_private_car_package_native_pdf",count:20,values:{
   policy_number:"POPMCAR00109999999",insurer_name:"SBI General Insurance Company Limited",
   insured_name:"TEST SOURCE CUSTOMER",policy_product:"Package",
   policy_issuance_date:"2026-11-05",policy_start_date:"2026-11-16",policy_end_date:"2027-11-15",
   vehicle_registration_number:"UK07FA7164",vehicle_registration_status:"registered",
   vehicle_class:"Private Car",vehicle_make:"MARUTI",vehicle_model:"VITARA BREZZA LXI",
   vehicle_capacity:"1462",vehicle_manufacturing_year:"2021",vehicle_fuel_type:"Petrol",
   vehicle_chassis_number:"MA3NYFJ1SML854230",vehicle_engine_number:"K15BN1243102",
   idv:"450000",od_premium:"5422.97",tp_premium:"3416",cpa_premium:"325",
 },premium:{od:5422.97,tp:3416,cpa:325,net:9163.97,gst:1649.52,gross:10813,
  addOn:4705,odBasic:1435.95,odBasicAfterNcb:717.97,ncbPercent:50,ncbDiscount:717.98},
  booking:{od:"717.97",tp:"3416",addOnPremium:"4705",cpa:"325",cpaOpted:"Yes"},
 },
 {id:"liberty_two_wheeler_tp_native_pdf",count:18,values:{
   policy_number:"LIBERTYTEST00001",insurer_name:"Liberty General Insurance Limited",
   insured_name:"TEST SOURCE CUSTOMER",policy_product:"Third-Party Only",
   policy_issuance_date:"2026-11-27",policy_start_date:"2026-11-29",policy_end_date:"2027-11-28",
   third_party_end_date:"2027-11-28",
   vehicle_registration_number:"UK07DU9720",vehicle_registration_status:"registered",
   vehicle_class:"Two Wheeler",vehicle_make:"ROYAL ENFIELD",vehicle_model:"CLASSIC STD 350 EFI",
   vehicle_capacity:"346",vehicle_manufacturing_year:"2019",vehicle_fuel_type:"Petrol",
   vehicle_chassis_number:"ME3U3S5F2LL975331",vehicle_engine_number:"U3S5F1LH339987",
   idv:"0",od_premium:"0",tp_premium:"1366",cpa_premium:"0",
 },premium:{od:0,tp:1366,cpa:0,net:1366,gst:245.88,gross:1612},
  booking:{od:"0",tp:"1366",addOnPremium:"0",cpa:"0",cpaOpted:"No"},
 }
];
const makeFields=(item)=>Object.entries(item.values).map(([key,value])=>({
 key,value,evidence:key==="cpa_premium"&&item.id.startsWith("liberty")?"Printed CSI NA and no PA charge":
 key==="vehicle_fuel_type"&&item.id.startsWith("liberty")?"Manufacturer model-family petrol specification; not printed in policy":
 "Native source PDF with verified original policy schedule",
}));
for(const item of inputs){
 const base={parserId:item.id,checksPassed:item.count,warnings:[],fields:makeFields(item),commercialPremium:item.premium};
 const result=assessProductVariantDirectConversion(base);
 assert.deepEqual(result,{eligible:true,reason:""},item.id+":"+result.reason);
 assert.deepEqual(mapVerifiedProductVariantPremium(item.premium,item.id),item.booking);
 assert.equal(assessProductVariantDirectConversion({...base,checksPassed:item.count-1}).eligible,false);
 assert.equal(assessProductVariantDirectConversion({...base,warnings:["unverified"]}).eligible,false);
 for(const [field,value] of [
   ["vehicle_model","WRONG MODEL"],["vehicle_capacity","999"],["vehicle_make","UNKNOWN"],
   ["vehicle_fuel_type","Diesel"],["vehicle_registration_number","MP20AB1234"],
 ]){
  assert.equal(assessProductVariantDirectConversion({...base,fields:base.fields.map(f=>f.key===field?{...f,value}:f)}).eligible,false,
   item.id+" accepted wrong "+field);
 }
 assert.equal(assessProductVariantDirectConversion({...base,commercialPremium:{...base.commercialPremium,gross:16000}}).eligible,false);
}
console.log("SBI Maruti and Liberty Royal source-certified variants: positives, strict identity, premium and prior family protections passed");
