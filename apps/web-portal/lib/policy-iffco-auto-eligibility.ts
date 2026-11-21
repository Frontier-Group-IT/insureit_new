type Field={key:string;value:string;evidence?:string|null};
type PrintedPremium={od:number;tp:number;net:number;gst:number;gross:number};
type Input={parserId:string;checksPassed:number;warnings:readonly string[];fields:readonly Field[];commercialPremium?:PrintedPremium|null};

/** Review-ready, NOT permission to silently register a policy.
 * Certified IFFCO JCB 3DX Plus 2WD family: either the original provisional
 * MP/NEW layout or a registered MP plate with independently mapped MP RTO.
 * Full PDF provenance, exact financials and canonical booking still required. */
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
    "cpa_premium","idv","policy_product","vehicle_registration_status","vehicle_registration_number"]){
    if(!get(key))return fail("iffco_missing_"+key);
  }
  if(get("policy_product")!=="Commercial Vehicle Package"
    ||!/^Commercial Vehicle - Miscellaneous Class D$/i.test(get("vehicle_class"))
    ||!["registration_pending","registered"].includes(get("vehicle_registration_status"))
    ||get("vehicle_make")!=="JCB"
    ||!(/^(?:JCB 3DX PLUS 2WD BACKHOE LOADER|VMT?\s*117\s+LC\s+NDD\s+COMPACTOR)$/i.test(get("vehicle_model"))))
    return fail("iffco_layout_needs_separate_certification");
  if(!/^(?:19|20)\d{2}$/.test(get("vehicle_manufacturing_year"))
    ||Number(get("vehicle_manufacturing_year"))>new Date().getUTCFullYear()
    ||!/^\d{3,5}$/.test(get("vehicle_capacity"))
    ||!fields.get("vehicle_capacity")?.evidence?.startsWith("IFFCO PDF page 1: CC")
    ||get("vehicle_fuel_type")!=="Diesel"
    ||!fields.get("vehicle_fuel_type")?.evidence?.startsWith("Manufacturer-model Diesel specification")
    ||(/VMT?\s*117\s+LC\s+NDD/i.test(get("vehicle_model"))
      &&!fields.get("vehicle_make")?.evidence?.startsWith("Manufacturer-model JCB VM117 NDD specification")))
    return fail("iffco_vehicle_evidence_incomplete");
  const registration=get("vehicle_registration_number").toUpperCase().replace(/[ -]/g,"");
  const isPending=get("vehicle_registration_status")==="registration_pending";
  const rtoCity=get("vehicle_rto_name");
  const rtoStateEvidence=fields.get("vehicle_rto_state")?.evidence??"";
  const rtoCityEvidence=fields.get("vehicle_rto_name")?.evidence??"";
  if(get("vehicle_rto_state")!=="Madhya Pradesh"||!(/^[a-z ]{3,45}$/i.test(rtoCity)))
    return fail("iffco_location_evidence_incomplete");
  if(isPending){
    if(!/^MP\/NEW\/\d{3,6}$/.test(registration)
      ||!rtoStateEvidence.startsWith("IFFCO PDF State Code 23")
      ||!rtoCityEvidence.startsWith("IFFCO policyholder address city only;"))
      return fail("iffco_provisional_location_source_missing");
  }else{
    // The PDF's empty Registration Authority box must never be replaced
    // with the insured's mailing city. Trust only an identified MP RTO code
    // attached to the *same* printed vehicle registration number.
    const match=registration.match(/^MP(\d{2})[A-Z]{1,3}\d{3,4}$/);
    if(!match
      ||!rtoStateEvidence.startsWith("Registered plate "+get("vehicle_registration_number")+" indicates MP state;")
      ||!rtoCityEvidence.startsWith("Registered plate "+get("vehicle_registration_number")+" code MP-"+match[1]+" = "+rtoCity+" (MP RTO registry);")
      ||!get("vehicle_chassis_number")||!get("vehicle_engine_number"))
      return fail("iffco_registered_rto_evidence_missing");
  }
  const cpa=Number(get("cpa_premium"));
  if(!Number.isFinite(cpa)||cpa<0||!input.commercialPremium)
    return fail("iffco_financial_evidence_incomplete");
  // Independent, currency-cent checks parallel the canonical IFFCO
  // mapper. Do not import the server-only TS module into Node regressions.
  const premium=input.commercialPremium;
  const values=[premium.od,premium.tp,premium.net,premium.gst,premium.gross,cpa];
  const valid=(n:number)=>Number.isFinite(n)&&n>=0&&n<=1_000_000_000
    &&Math.abs(n*100-Math.round(n*100))<0.00001;
  const cents=(n:number)=>Math.round(n*100);
  if(!values.every(valid)||premium.od<=0||premium.tp<=0
    ||cents(cpa)>cents(premium.tp)
    ||Math.abs(cents(premium.od)+cents(premium.tp)-cents(premium.net))>6
    ||Math.abs(cents(premium.net)+cents(premium.gst)-cents(premium.gross))>6)
    return fail("iffco_printed_financials_unreconciled");
  return {eligible:true,reason:""};
}
