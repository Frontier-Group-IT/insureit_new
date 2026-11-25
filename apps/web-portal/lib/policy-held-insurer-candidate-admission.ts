/** Isolated admission contract for November 2026 held insurer layouts.
 * NOT wired into production route/admission; deliberate fail-closed review boundary.
 * Existing ICICI, Tata, UIIC, IFFCO, NIA CV and other trained contracts are untouched.
 */
type Field={key:string;value:string;evidence?:string};
type SourceResponse={
 contract_version:string;parser_id:string;parser_version:string;extraction_method:string;
 ok:boolean;validation_passed:boolean;review_required:boolean;auto_finalize_allowed:boolean;
 intake_id?:string;document_id?:string;request_id?:string;
 checks:Record<string,boolean>;warnings:string[];fields:Field[];
 premium_components:Record<string,unknown>;
};
type Case="magma_private_car_package_native_pdf"|"national_private_car_liability_only_native_pdf"
 |"oriental_private_car_standalone_od_native_pdf"|"oriental_gccv_package_native_pdf";
/** Product-specific text classifier. Caller label is never trusted. */
export function recognizeHeldInsurerLayout(text:string):Case|null{
 const head=String(text||"").slice(0,10000).replace(/\s+/g," ");
 const found:Case[]=[];
 if(/Magma General Insurance Limited/i.test(head)
   &&/PRIVATE CAR PACKAGE POLICY/i.test(head))
   found.push("magma_private_car_package_native_pdf");
 if(/National Insurance Co(?:mpany)?\.?\s*(?:Ltd\.?|Limited)/i.test(head)
   &&/Policy Schedule\s*-\s*Motor\s*-\s*Private Car\s*-\s*Liability Only/i.test(head))
   found.push("national_private_car_liability_only_native_pdf");
 if(/THE ORIENTAL INSURANCE COMPANY LIMITED/i.test(head)
   &&/STANDALONE OWN DAMAGE\(OD\)-PRIVATE CAR POLICY/i.test(head))
   found.push("oriental_private_car_standalone_od_native_pdf");
 if(/THE ORIENTAL INSURANCE COMPANY LIMITED/i.test(head)
   &&/GCCV-PUBLIC CARRIERS OTHER THAN THREE WHEELERS PACKAGE/i.test(head))
   found.push("oriental_gccv_package_native_pdf");
 return found.length===1?found[0]:null;
}
const CHECKS:Record<Case,readonly string[]>={
 magma_private_car_package_native_pdf:[
 "insurer_product_verified","policy_number_verified","insured_name_verified","issuance_date_printed",
 "policy_dates_verified","vehicle_registration_verified","vehicle_engine_chassis_verified",
 "manufacturer_model_printed","vehicle_year_printed","vehicle_capacity_printed",
 "vehicle_idv_printed","vehicle_fuel_source_verified","od_premium_reconciled",
 "tp_cpa_paid_driver_reconciled","net_premium_reconciled","tax_components_printed",
 "gross_premium_reconciled","package_not_tp_only"],
 national_private_car_liability_only_native_pdf:[
 "insurer_product_verified","policy_number_verified","insured_name_verified",
 "printed_issuance_date_verified","coverage_dates_verified","registration_printed",
 "engine_chassis_printed","make_model_variant_printed","vehicle_class_verified",
 "fuel_source_verified","manufacture_year_verified","capacity_cc_printed",
 "liability_only_no_own_damage","printed_tp_premium_verified",
 "printed_tax_components_verified","net_tax_gross_reconciled",
 "stamp_charge_disclosed","separately_charged_cpa_absent"],
 oriental_private_car_standalone_od_native_pdf:[
 "insurer_product_verified","policy_identity_verified","insured_name_verified",
 "coverage_period_verified","printed_issuance_or_verified_image_date",
 "registered_vehicle_plate_verified","engine_chassis_verified","vehicle_make_model_verified",
 "vehicle_class_verified","vehicle_fuel_source_verified","manufacture_year_printed",
 "vehicle_capacity_printed","idv_printed","separate_od_tp_components_printed",
 "cpa_is_product_specific_and_evidenced","net_premium_reconciled",
 "gst_and_gross_printed","tax_and_premium_reconciled"],
 oriental_gccv_package_native_pdf:[
 "insurer_product_verified","policy_identity_verified","insured_name_verified",
 "coverage_period_verified","printed_issuance_or_verified_image_date",
 "registered_vehicle_plate_verified","engine_chassis_verified","vehicle_make_model_verified",
 "vehicle_class_verified","vehicle_fuel_source_verified","manufacture_year_printed",
 "vehicle_capacity_printed","idv_printed","separate_od_tp_components_printed",
 "cpa_is_product_specific_and_evidenced","net_premium_reconciled",
 "gst_and_gross_printed","tax_and_premium_reconciled"],
};
const money=(x:unknown):x is number=>typeof x==="number"&&Number.isFinite(x)&&x>=0&&x<=1e9
 &&Math.abs(x*100-Math.round(x*100))<0.00001;
const cent=(v:number)=>Math.round(v*100);
const day=(s:string)=>/^\d{4}-\d{2}-\d{2}$/.test(s)
 &&Number.isFinite(Date.parse(s+"T00:00:00Z"))
 &&new Date(s+"T00:00:00Z").toISOString().slice(0,10)===s;
const plate=(s:string)=>/^[A-Z]{2}\d{2}[A-Z]{1,3}\d{3,4}$/.test(s.replace(/[\s-]/g,""));
const object=(x:unknown):x is Record<string,unknown>=>!!x&&typeof x==="object"&&!Array.isArray(x);
export type CandidateAdmission={accepted:boolean;reason:string;parserId?:Case;
 canonicalPremium?:{od:string;tp:string;addOnPremium:string;cpa:string;cpaOpted:"Yes"|"No"};
 fields?:Field[]};
const reject=(reason:string):CandidateAdmission=>({accepted:false,reason});
/** Parser-only evidence admission, not permission to book.
 * All normal current-PDF, document fingerprint, identity/ownership, duplicate,
 * OTP and atomic policy transaction protections remain downstream.
 */
export function assessHeldInsurerCandidate(raw:unknown,
 ids:{intake_id:string;document_id:string;request_id:string}):CandidateAdmission{
 if(!object(raw))return reject("held_response_shape_invalid");
 const parserId=raw.parser_id as Case;
 if(!Object.prototype.hasOwnProperty.call(CHECKS,parserId))
   return reject("held_parser_not_trained");
 const x=raw as unknown as SourceResponse;
 if(x.contract_version!=="1"||x.parser_version!=="source-candidate-1"
   ||x.extraction_method!=="native_pdf_text"
   ||x.review_required!==true||x.auto_finalize_allowed!==false
   ||x.ok!==true||x.validation_passed!==true||!Array.isArray(x.warnings)
   ||x.warnings.length>0||!Array.isArray(x.fields)
   ||x.intake_id!==ids.intake_id||x.document_id!==ids.document_id
   ||x.request_id!==ids.request_id||!object(x.checks)||!object(x.premium_components))
   return reject("held_source_or_identity_unverified");
 const checks=CHECKS[parserId];
 if(Object.keys(x.checks).length!==checks.length
   ||checks.some(key=>x.checks[key]!==true))
   return reject("held_exact_check_set_invalid");
 if(x.fields.length<15||x.fields.length>35)return reject("held_fields_shape_invalid");
 const fields=new Map<string,Field>();
 for(const f of x.fields){
   if(!object(f)||typeof f.key!=="string"||typeof f.value!=="string"
     ||!f.value.trim()||f.value.length>300||typeof f.evidence!=="string"
     ||f.evidence.length>180||fields.has(f.key))
     return reject("held_duplicate_or_unproven_field");
   fields.set(f.key,f as Field);
 }
 const get=(key:string)=>fields.get(key)?.value.trim()||"";
 const required=["insurer_name","policy_number","insured_name","policy_product",
   "policy_start_date","policy_end_date","policy_issuance_date",
   "vehicle_registration_status","vehicle_registration_number","vehicle_make",
   "vehicle_model","vehicle_fuel_type","vehicle_manufacturing_year",
   "vehicle_capacity","vehicle_chassis_number","vehicle_engine_number",
   "vehicle_class","idv","od_premium","tp_premium","cpa_premium"];
 if(required.some(key=>!get(key)))return reject("held_required_source_field_missing");
 // No RTO city or state in required keys; partial or fully absent RTO is valid.
 if(get("vehicle_registration_status")!=="registered"
   ||!plate(get("vehicle_registration_number"))
   ||!day(get("policy_issuance_date"))||!day(get("policy_start_date"))
   ||!day(get("policy_end_date"))||get("policy_end_date")<get("policy_start_date"))
   return reject("held_vehicle_registration_or_date_invalid");
 if(!/^20\d{2}$/.test(get("vehicle_manufacturing_year"))
   ||Number(get("vehicle_manufacturing_year"))>new Date().getUTCFullYear()
   ||!Number.isFinite(Number(get("vehicle_capacity")))
   ||Number(get("vehicle_capacity"))<=0)
   return reject("held_vehicle_specification_invalid");
 if(fields.has("vehicle_rto_name")&&!/RTO|registration authority/i.test(fields.get("vehicle_rto_name")?.evidence||""))
   return reject("held_supplied_rto_city_unverified");
 if(fields.has("vehicle_rto_state")&&!/RTO|registration authority/i.test(fields.get("vehicle_rto_state")?.evidence||""))
   return reject("held_supplied_rto_state_unverified");
 const p=x.premium_components;
 if(![p.od,p.tp,p.net,p.gst,p.gross,p.cpa].every(money))
   return reject("held_money_shape_invalid");
 const od=p.od as number,tp=p.tp as number,net=p.net as number,gst=p.gst as number,
   gross=p.gross as number,cpa=p.cpa as number;
 if(Math.abs(cent(od)+cent(tp)-cent(net))>6
   ||Math.abs(cent(net)+cent(gst)-cent(gross))>55
   ||Math.abs(cent(Number(get("od_premium")))-cent(od))>0
   ||Math.abs(cent(Number(get("tp_premium")))-cent(tp))>0
   ||Math.abs(cent(Number(get("cpa_premium")))-cent(cpa))>0
   ||!money(Number(get("idv")))||cpa>tp)
   return reject("held_printed_premium_mismatch");
 const isNational=parserId==="national_private_car_liability_only_native_pdf";
 const isMagma=parserId==="magma_private_car_package_native_pdf";
 const isSaod=parserId==="oriental_private_car_standalone_od_native_pdf";
 const isGcv=parserId==="oriental_gccv_package_native_pdf";
 if(isNational){
   if(get("insurer_name")!=="National Insurance Company Limited"
     ||get("policy_product")!=="Private Car Liability Only"
     ||get("vehicle_class")!=="Private Car"
     ||od!==0||cpa!==0||Number(get("idv"))!==0||tp<=0
     ||p.igst!==gst||p.cgst!==0||p.sgst!==0
     ||fields.get("policy_issuance_date")?.evidence!=="NIA certificate printed Date of issue"
     ||fields.get("idv")?.evidence!=="NIA liability-only PDF prints Vehicle IDV NA")
     return reject("held_national_liability_product_conflict");
 } else if(isMagma){
   if(get("insurer_name")!=="Magma General Insurance Limited"
     ||get("policy_product")!=="Private Car Package"||get("vehicle_class")!=="Private Car"
     ||od<=0||tp<=0||cpa<=0||Number(get("idv"))<=0
     ||fields.get("policy_issuance_date")?.evidence!=="Magma PDF printed Date of Issue"
     ||!fields.get("vehicle_fuel_type")?.evidence?.startsWith("Manufacturer model-family: ")
     ||get("vehicle_fuel_type")!=="Petrol"
     ||!money(p.basicTp)||!money(p.paidDriver)
     ||Math.abs(cent((p.basicTp as number)+(p.paidDriver as number)+cpa)-cent(tp))>6)
     return reject("held_magma_package_or_cpa_conflict");
   // Canonical Motor expects OD after NCB and *separate* insured OD add-ons.
   // The insurer PDF's total OD ALREADY includes add-ons. Split once in
   // paisa, don't drop purchased covers or charge them a second time.
   if(!money(p.basicOd)||!money(p.odAddons)||!money(p.ncb)
     ||(p.odAddons as number)>od
     ||Math.abs(cent((p.basicOd as number)+(p.odAddons as number)-(p.ncb as number))-cent(od))>55)
     return reject("held_magma_od_addons_ncb_unreconciled");
   if(p.taxRegime==="IGST"&&p.igst!==gst
     ||p.taxRegime==="CGST_SGST"&&(!money(p.cgst)||!money(p.sgst)||Math.abs(cent((p.cgst as number)+(p.sgst as number))-cent(gst))>1)
     ||!["IGST","CGST_SGST"].includes(String(p.taxRegime)))
     return reject("held_magma_printed_gst_invalid");
 } else {
   if(get("insurer_name")!=="The Oriental Insurance Company Limited"
     ||fields.get("policy_issuance_date")?.evidence!=="Oriental explicitly printed Policy Issue Date")
     return reject("held_oriental_issuance_not_verified");
   if(isSaod&&(get("policy_product")!=="Standalone Own Damage - Private Car"
      ||get("vehicle_class")!=="Private Car"||od<=0||tp!==0||cpa!==0
      ||get("third_party_start_date")||get("third_party_end_date")))
      return reject("held_oriental_saod_not_new_tp");
   if(isGcv&&(get("policy_product")!=="GCCV Public Carriers Package"
      ||get("vehicle_class")!=="Goods Carrying Vehicle"||od<=0||tp<=0
      ||cpa<=0||p.taxRegime!=="CGST_SGST_FOUR_COMPONENT"
      ||p.printedComponents!==12))
      return reject("held_oriental_gccv_component_invalid");
 }
 const canonicalTp=tp-cpa;
 if(canonicalTp<0)return reject("held_cpa_double_count");
 const addons=isMagma?(p.odAddons as number):0;
 const canonicalOd=od-addons;
 if(canonicalOd<0)return reject("held_od_addon_split_invalid");
 const cash=(v:number)=>String(cent(v)/100);
 return {accepted:true,reason:"",parserId,fields:x.fields,
   canonicalPremium:{od:cash(canonicalOd),tp:cash(canonicalTp),
     addOnPremium:cash(addons),cpa:cash(cpa),
     cpaOpted:cpa>0?"Yes":"No"}};
}
