/**
 * Direct conversion contract for commercial insurer nodes other than Go Digit
 * and IFFCO, which have existing insurer-specific premium/CPA assessors.
 *
 * An n8n "success" response is extraction success, not permission to book.
 * The canonical engine remains the only policy-registration authority.
 * Unsupported, incomplete or ambiguous insurer evidence stays in review.
 */
type Field={key:string;value:string;evidence?:string|null};
type Premium={od:number;tp:number;net:number;gst:number;gross:number};
type Input={parserId:string;checksPassed:number;warnings:readonly string[];
  fields:readonly Field[];commercialPremium?:Premium|null};
export function assessStandardCommercialDirectConversion(input:Input):{eligible:boolean;reason:string}{
  const requiredChecks:Record<string,number>={
    new_india_cv_native_pdf:16,
    united_india_gcv_native_pdf:18,
    oriental_gccv_native_pdf:17,
  };
  const expected=requiredChecks[input.parserId];
  const fail=(reason:string)=>({eligible:false,reason});
  if(!expected||input.checksPassed!==expected||input.warnings.length)
    return fail("insurer_parser_not_fully_verified");
  const fields=new Map<string,Field>();
  for(const field of input.fields){
    if(fields.has(field.key))return fail("ambiguous_duplicate_pdf_field");
    fields.set(field.key,field);
  }
  const get=(key:string)=>fields.get(key)?.value.trim()??"";
  const required=["insured_name","policy_number","policy_issuance_date","policy_start_date",
    "policy_end_date","third_party_start_date","third_party_end_date","insurer_name",
    "vehicle_class","vehicle_make","vehicle_model","vehicle_fuel_type",
    "vehicle_manufacturing_year","vehicle_capacity","vehicle_rto_state",
    "vehicle_rto_name","vehicle_registration_number","vehicle_registration_status",
    "vehicle_chassis_number","vehicle_engine_number","policy_product","idv","cpa_premium"];
  const missing=required.find(key=>!get(key));
  if(missing)return fail("missing_verified_"+missing);
  if(get("vehicle_registration_status")!=="registered"
    ||!/^[A-Z]{2}[0-9]{1,2}[A-Z]{1,3}[0-9]{3,4}$/i.test(get("vehicle_registration_number").replace(/[ -]/g,"")))
    return fail("registered_rto_evidence_required");
  // These three insurer layouts can proceed only when the location really is
  // the printed registration authority: never substitute an address, branch,
  // issue office, or provisional 'NEW' prefix for a valid registration.
  if(!fields.get("vehicle_rto_name")?.evidence
    ||!/\\b(?:RTO|registration authority|registered vehicle)\\b/i.test(fields.get("vehicle_rto_name")?.evidence??"")
    ||/provisional|address city|issuing office|not registration authority/i.test(fields.get("vehicle_rto_name")?.evidence??"")
    ||!(/^[A-Za-z][A-Za-z .-]{2,65}$/.test(get("vehicle_rto_name"))))
    return fail("rto_authority_not_verified");
  if(!["Goods Carrying Vehicle","Commercial Vehicle - Miscellaneous Class D"].includes(get("vehicle_class"))
    ||!/^(?:19|20)\d{2}$/.test(get("vehicle_manufacturing_year"))
    ||Number(get("vehicle_manufacturing_year"))>new Date().getUTCFullYear()
    ||!/^\d+(?:\.\d+)?$/.test(get("vehicle_capacity"))
    ||!Number.isFinite(Number(get("idv")))||Number(get("idv"))<=0)
    return fail("vehicle_class_or_specifications_unverified");
  if(!/package/i.test(get("policy_product")))
    return fail("not_combined_package_policy");
  // CPA-positive variants are intentionally excluded until the insurer has
  // a certified CPA/TP-splitting map. Generic mapping would double-charge CPA.
  if(get("cpa_premium")!=="0")
    return fail("owner_driver_cpa_requires_insurer_specific_mapping");
  const p=input.commercialPremium;
  if(!p)return fail("premium_breakdown_missing");
  const values=[p.od,p.tp,p.net,p.gst,p.gross];
  if(!values.every(v=>Number.isFinite(v)&&v>=0&&Math.abs(v*100-Math.round(v*100))<0.00001)
    ||p.od<=0||p.tp<=0||p.gross<=0
    ||Math.abs(Math.round((p.od+p.tp-p.net)*100))>6
    ||Math.abs(Math.round((p.net+p.gst-p.gross)*100))>6)
    return fail("premium_totals_do_not_reconcile");
  return{eligible:true,reason:""};
}
