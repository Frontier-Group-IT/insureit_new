/** Source-gated preflight for three isolated 2026-11-23 insurer/product layout extensions.
 * This is NOT a booking authorization. Current-PDF/fingerprint/dup/identity/
 * vehicle ownership/overlap/OTP and atomic booking guards remain mandatory.
 * No PDF-mobile equality: the intake operator's supplied contact is the
 * canonical contact source; insured name and customer-master conflicts are
 * independently checked at booking.
 */
export const PRODUCT_VARIANT_PARSERS = new Set([
  "zurich_kotak_private_car_tp_native_pdf",
  "go_digit_two_wheeler_od_native_pdf",
  "united_india_tractor_tp_native_pdf",
  "hdfc_ergo_two_wheeler_tp_native_pdf",
  "sbi_general_private_car_package_native_pdf",
]);
type Field={key:string;value:string;evidence?:string};
type Printed={od:number;tp:number;net:number;gst:number;gross:number;cpa?:number;addOn?:number;odBasic?:number};
type Input={parserId:string;checksPassed:number;warnings:readonly string[];
  fields:readonly Field[];commercialPremium:Printed|null|undefined};
export function assessProductVariantDirectConversion(input:Input):{eligible:boolean;reason:string}{
 const no=(reason:string)=>({eligible:false,reason});
 if(!PRODUCT_VARIANT_PARSERS.has(input.parserId))return no("untrained_product_parser");
 const expected=input.parserId==="zurich_kotak_private_car_tp_native_pdf"?16
   :input.parserId==="sbi_general_private_car_package_native_pdf"?20:18;
 if(input.checksPassed!==expected||input.warnings.length)return no("missing_product_layout_checks");
 const map=new Map<string,Field>();
 for(const f of input.fields){if(map.has(f.key))return no("duplicate_field");map.set(f.key,f);}
 const field=(key:string)=>map.get(key)?.value.trim()??"";
 for(const key of ["policy_number","insurer_name","insured_name","policy_product",
   "policy_issuance_date","policy_start_date","policy_end_date",
   "vehicle_registration_number","vehicle_registration_status","vehicle_class",
   "vehicle_make","vehicle_model","vehicle_fuel_type","vehicle_capacity",
   "vehicle_chassis_number","vehicle_engine_number","vehicle_rto_name","vehicle_rto_state",
   "idv","od_premium","tp_premium","cpa_premium"]){
   if(!field(key))return no("missing_"+key);
 }
 if(!/^UK\d{2}[A-Z]{1,3}\d{4}$/.test(field("vehicle_registration_number"))
   ||field("vehicle_registration_status")!=="registered"
   ||field("vehicle_rto_state")!=="Uttarakhand"
   ||!map.get("vehicle_rto_name")?.evidence?.includes("RTO")
     &&!map.get("vehicle_rto_name")?.evidence?.includes("Registration Authority"))
   return no("rto_or_plate_not_verified");
 const day=(v:string)=>/^\d{4}-\d{2}-\d{2}$/.test(v)
    &&!Number.isNaN(Date.parse(v+"T00:00:00Z"))
    &&new Date(v+"T00:00:00Z").toISOString().slice(0,10)===v;
 if(!["policy_issuance_date","policy_start_date","policy_end_date"].every(k=>day(field(k)))
   ||field("policy_end_date")<field("policy_start_date"))
   return no("unverified_dates");
 const printed=input.commercialPremium;
 if(!printed)return no("printed_premium_missing");
 const cents=(v:number)=>Math.round(v*100);
 const money=(v:number)=>Number.isFinite(v)&&v>=0&&v<=1e9
   &&Math.abs(v*100-Math.round(v*100))<0.00001;
 if(![printed.od,printed.tp,printed.net,printed.gst,printed.gross].every(money)
   ||Math.abs(cents(printed.od)+cents(printed.tp)
   +cents(input.parserId==="sbi_general_private_car_package_native_pdf"?(printed.cpa??NaN):0)
   -cents(printed.net))>6
   ||Math.abs(cents(printed.net)+cents(printed.gst)-cents(printed.gross))>50
   ||cents(Number(field("od_premium")))!==cents(printed.od)
   ||cents(Number(field("tp_premium")))!==cents(printed.tp))
   return no("premium_reconciliation_failed");
 const digit=input.parserId==="go_digit_two_wheeler_od_native_pdf";
 if(input.parserId==="sbi_general_private_car_package_native_pdf"){
   const {cpa,addOn,odBasic}=printed;
   if(field("insurer_name")!=="SBI General Insurance Company Limited"
     ||field("policy_product")!=="Package"||field("vehicle_class")!=="Private Car"
     ||field("vehicle_make")!=="TATA"||!/^PUNCH\s+ADVENTURE$/i.test(field("vehicle_model"))
     ||field("vehicle_fuel_type")!=="Petrol"
     ||Number(field("idv"))<=0||printed.od<=0||printed.tp<=0
     ||!money(cpa??NaN)||!money(addOn??NaN)||!money(odBasic??NaN)
     ||(cpa??0)<=0||(addOn??0)<=0||(odBasic??0)<=0
     ||cents(Number(field("cpa_premium")))!==cents(cpa??NaN)
     ||Math.abs(cents((odBasic??0)+(addOn??0))-cents(printed.od))>6
     ||Math.abs(cents(printed.gst)-cents(printed.net*.18))>3
     ||!field("vehicle_manufacturing_year"))
     return no("sbi_package_variant_unverified");
   return {eligible:true,reason:""};
 }
 if(digit){
   if(field("insurer_name")!=="Go Digit General Insurance Limited"
     ||field("policy_product")!=="Stand-alone Own Damage"
     ||field("vehicle_class")!=="Two Wheeler"
     ||field("vehicle_make")!=="ROYAL ENFIELD"
     ||!/^HUNTER 350\b/i.test(field("vehicle_model"))
     ||field("vehicle_fuel_type")!=="Petrol"
     ||!field("vehicle_registration_year")||field("vehicle_manufacturing_year")
     ||field("idv")==="0"
     ||printed.od<=0||printed.tp!==0
     ||Number(field("cpa_premium"))!==0
     ||!day(field("third_party_end_date"))
     ||field("third_party_end_date")<field("policy_end_date"))
     return no("digit_two_wheeler_od_variant_unverified");
   // Prior TP is a reference, not a newly issued TP premium.
   return {eligible:true,reason:""};
 }
 if(field("policy_product")!=="Third-Party Only"
   ||Number(field("idv"))!==0||printed.od!==0||printed.tp<=0
   ||Number(field("cpa_premium"))!==0
   ||!field("vehicle_manufacturing_year")
   ||!field("third_party_end_date")
   ||field("third_party_end_date")!==field("policy_end_date"))
   return no("tp_only_variant_unverified");
 if(input.parserId==="united_india_tractor_tp_native_pdf"){
   if(field("insurer_name")!=="United India Insurance Company Limited"
     ||field("vehicle_class")!=="Agricultural Tractor"
     ||field("vehicle_make")!=="MAHINDRA"
     ||field("vehicle_model")!=="575 DI XP PLUS"
     ||field("vehicle_fuel_type")!=="Diesel"
     ||!map.get("cpa_premium")?.evidence?.includes("removed")
     ||!map.get("vehicle_rto_name")?.evidence?.includes("Registration Authority")
     ||Math.abs(cents(printed.gst)-cents(Math.round(printed.net*.18)))>100)
     return no("united_tractor_tp_variant_unverified");
 }else if(input.parserId==="hdfc_ergo_two_wheeler_tp_native_pdf"){
   if(field("insurer_name")!=="HDFC ERGO General Insurance Company Limited"
     ||field("vehicle_class")!=="Two Wheeler"||field("vehicle_make")!=="HONDA"
     ||field("vehicle_model")!=="ACTIVA-3G"||field("vehicle_capacity")!=="109"
     ||field("vehicle_fuel_type")!=="Petrol"
     ||!map.get("cpa_premium")?.evidence?.includes("waiver")
     ||Math.abs(cents(printed.gst)-cents(Math.round(printed.net*.18)))>1)
     return no("hdfc_tw_tp_variant_unverified");
 }else if(input.parserId==="zurich_kotak_private_car_tp_native_pdf"){
   if(field("insurer_name")!=="Zurich Kotak General Insurance Company (India) Limited"
     ||field("vehicle_class")!=="Private Car"
     ||!["HYUNDAI","MARUTI","TATA"].includes(field("vehicle_make"))
     ||!["Petrol","Diesel"].includes(field("vehicle_fuel_type"))
     ||Math.abs(cents(printed.gst)-cents(printed.net*.18))>2)
     return no("zurich_kotak_tp_variant_unverified");
 }
 return {eligible:true,reason:""};
}

export function mapVerifiedProductVariantPremium(
 p:Printed,parserId:string,
):{od:string;tp:string;addOnPremium:string;cpa:string;cpaOpted:"Yes"|"No"}{
 // This routine ONLY translates already certified totals; the independent
 // assessor must pass before it is invoked. Never reassign TP to OD.
 if(!PRODUCT_VARIANT_PARSERS.has(parserId)||
    ![p.od,p.tp,p.net,p.gst,p.gross].every(v=>Number.isFinite(v)&&v>=0)
    ||Math.abs(Math.round((p.od+p.tp+(parserId==="sbi_general_private_car_package_native_pdf"?(p.cpa??NaN):0)-p.net)*100))>6
    ||Math.abs(Math.round((p.net+p.gst-p.gross)*100))>50)
   throw new Error("product_variant_printed_premium_unreconciled");
 if(parserId==="go_digit_two_wheeler_od_native_pdf"&&!(p.od>0&&p.tp===0)
   ||parserId!=="go_digit_two_wheeler_od_native_pdf"
      &&parserId!=="sbi_general_private_car_package_native_pdf"&&!(p.od===0&&p.tp>0))
   throw new Error("product_variant_premium_components_invalid");
 const cash=(v:number)=>String(Math.round(v*100)/100);
 if(parserId==="sbi_general_private_car_package_native_pdf"){
   if(![p.cpa,p.addOn,p.odBasic].every(v=>v!==undefined&&Number.isFinite(v)&&v>=0)
     ||Math.abs(Math.round(((p.odBasic??0)+(p.addOn??0)-p.od)*100))>6
     ||(p.cpa??0)<=0)
     throw new Error("sbi_package_cpa_addon_split_invalid");
   return {od:cash(p.odBasic!),tp:cash(p.tp),addOnPremium:cash(p.addOn!),
     cpa:cash(p.cpa!),cpaOpted:"Yes" as const};
 }
 return {od:cash(p.od),tp:cash(p.tp),addOnPremium:"0",cpa:"0",cpaOpted:"No"};
}
