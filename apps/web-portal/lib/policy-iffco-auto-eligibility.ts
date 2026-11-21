import { mapVerifiedIffcoCommercialPremium } from "./policy-n8n-onboarding-premium";

type Field={key:string;value:string;evidence?:string|null};
type PrintedPremium={od:number;tp:number;net:number;gst:number;gross:number};
type Input={parserId:string;checksPassed:number;warnings:readonly string[];fields:readonly Field[];commercialPremium?:PrintedPremium|null};

/** Review-ready, NOT permission to silently register a policy.
 * This narrowly certified IFFCO new JCB 3DX Plus 2WD family has a source
 * verified 18-check PDF, CC, model fuel reference, provisional city with
 * explicit provenance and a fully reconciled OD/TP/CPA/GST/gross breakdown.
 * All other IFFCO layouts remain human review until separately validated. */
export function assessIffcoAutoOnboarding(input:Input):{eligible:boolean;reason:string} {
  const fail=(reason:string)=>({eligible:false,reason});
  if(input.parserId!=="iffco_tokio_cv_native_pdf"||input.checksPassed!==18||input.warnings.length)
    return fail("iffco_parser_unverified");
  const fields=new Map<string,Field>();
  for(const field of input.fields){
    if(fields.has(field.key))return fail("iffco_duplicate_extracted_field");
    fields.set(field.key,field);
  }
  const get=(key:string)=>fields.get(key)?.value.trim()??"";
  for(const key of ["insured_name","policy_number","policy_issuance_date","policy_start_date",
    "policy_end_date","third_party_start_date","third_party_end_date","vehicle_class","vehicle_make",
    "vehicle_model","vehicle_manufacturing_year","vehicle_capacity","vehicle_fuel_type",
    "vehicle_rto_state","vehicle_rto_name","vehicle_chassis_number","vehicle_engine_number",
    "cpa_premium","idv","policy_product","vehicle_registration_status"]){
    if(!get(key))return fail("iffco_missing_"+key);
  }
  if(get("policy_product")!=="Commercial Vehicle Package"
    ||!/^Commercial Vehicle - Miscellaneous Class D$/i.test(get("vehicle_class"))
    ||get("vehicle_registration_status")!=="registration_pending"
    ||get("vehicle_make")!=="JCB"
    ||!/^JCB 3DX PLUS 2WD BACKHOE LOADER$/i.test(get("vehicle_model")))
    return fail("iffco_layout_needs_separate_certification");
  if(!/^(?:19|20)\d{2}$/.test(get("vehicle_manufacturing_year"))
    ||Number(get("vehicle_manufacturing_year"))>new Date().getUTCFullYear()
    ||!/^\d{3,5}$/.test(get("vehicle_capacity"))
    ||!fields.get("vehicle_capacity")?.evidence?.startsWith("IFFCO PDF page 1: CC")
    ||get("vehicle_fuel_type")!=="Diesel"
    ||!fields.get("vehicle_fuel_type")?.evidence?.startsWith("Manufacturer-model Diesel specification"))
    return fail("iffco_vehicle_evidence_incomplete");
  if(get("vehicle_rto_state")!=="Madhya Pradesh"
    ||!fields.get("vehicle_rto_state")?.evidence?.startsWith("IFFCO PDF State Code 23")
    ||!fields.get("vehicle_rto_name")?.evidence?.startsWith("IFFCO policyholder address city only;")
    ||!(/^[a-z ]{3,45}$/i.test(get("vehicle_rto_name"))))
    return fail("iffco_provisional_location_source_missing");
  const cpa=Number(get("cpa_premium"));
  if(!Number.isFinite(cpa)||cpa<0||!input.commercialPremium)
    return fail("iffco_financial_evidence_incomplete");
  try {mapVerifiedIffcoCommercialPremium(input.commercialPremium,cpa);}
  catch{return fail("iffco_printed_financials_unreconciled");}
  return {eligible:true,reason:""};
}
