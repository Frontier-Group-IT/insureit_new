/** Source-gated legal manufacturer to active marque mapping, queue assessment only.
 * This never mutates PDF-extracted fields, insured identity or onboarding master data.
 */
export function verifiedPolicyManufacturerBrand(input:{
 parserId:string;checksPassed:number;warnings:readonly string[];
 make:string;model:string;
}):string|null{
 if(input.checksPassed!==18)return null;
 const make=input.make.trim().replace(/\s+/g," ").toUpperCase();
 const model=input.model.trim().replace(/\s+/g," ").toUpperCase();
 if(input.warnings.length!==0)return null;
 if((input.parserId==="united_india_gcv_native_pdf"
     ||input.parserId==="united_india_gcv_punjab_split_gst_native_pdf"
     ||input.parserId==="oriental_private_car_standalone_od_native_pdf")
     &&make==="TATA MOTORS"&&model.length>=3)
   return "TATA";
 if(input.parserId==="united_india_gcv_punjab_split_gst_native_pdf"
   &&make==="DAIMLER INDIA COMMERCIAL VEHICLES PVT. LTD."
   &&model==="BHARATBENZ 2828C 6X4 BSVI")
   return "BHARATBENZ";
 // Source-verified National commercial vehicle legal manufacturer name.
 // The active commercial OEM brand is EICHER (VE Commercial Vehicles),
 // not the separate Royal Enfield motorcycle brand in the legacy OEM master.
 if(input.parserId==="national_gcv_package_native_pdf"
   &&make==="EICHER MOTORS LIMITED"
   &&model==="EICHER PRO 1110 EICHER PRO 1110")
   return "EICHER";
 // Tata AIG SAOD original vehicle schedule prints MORRIS GARAGES and
 // ASTOR / SELECT CVT; the active canonical marque is MG.
 // Tata informational warnings are accepted ONLY for this strict 18-check
 // source profile. Untrusted/unknown warning codes still fail closed.
 if(input.parserId==="tata_aig_private_car_saod_n8n_native_pdf"
   &&make==="MORRIS GARAGES"
   &&(model==="AS TOR / SELECT CVT"||model==="ASTOR / SELECT CVT")
   &&input.warnings.every(w=>[
     "tata_aig_human_review_required",
     "tata_aig_receipt_date_as_issuance",
     "tata_aig_printed_net_rounding",
   ].includes(w))) return "MG";
 if(input.parserId==="magma_private_car_package_native_pdf"
    &&make==="KIA INDIA PRIVATE LIMITED"
    &&/^(?:KIA INDIA PRIVATE LIMITED\s+)?SELTOS G1\.5 IMT HTK PLUS$/.test(model))
   return "KIA";
 return null;
}
