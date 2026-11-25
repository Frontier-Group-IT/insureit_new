/** Source-gated legal manufacturer to active marque mapping, queue assessment only.
 * This never mutates PDF-extracted fields, insured identity or onboarding master data.
 */
export function verifiedPolicyManufacturerBrand(input:{
 parserId:string;checksPassed:number;warnings:readonly string[];
 make:string;model:string;
}):string|null{
 if(input.checksPassed!==18||input.warnings.length!==0)return null;
 const make=input.make.trim().replace(/\s+/g," ").toUpperCase();
 const model=input.model.trim().replace(/\s+/g," ").toUpperCase();
 if((input.parserId==="united_india_gcv_native_pdf"
     ||input.parserId==="united_india_gcv_punjab_split_gst_native_pdf"
     ||input.parserId==="oriental_private_car_standalone_od_native_pdf")
     &&make==="TATA MOTORS"&&model.length>=3)
   return "TATA";
 if(input.parserId==="united_india_gcv_punjab_split_gst_native_pdf"
   &&make==="DAIMLER INDIA COMMERCIAL VEHICLES PVT. LTD."
   &&model==="BHARATBENZ 2828C 6X4 BSVI")
   return "BHARATBENZ";
 if(input.parserId==="magma_private_car_package_native_pdf"
    &&make==="KIA INDIA PRIVATE LIMITED"
    &&/^(?:KIA INDIA PRIVATE LIMITED\s+)?SELTOS G1\.5 IMT HTK PLUS$/.test(model))
   return "KIA";
 return null;
}
