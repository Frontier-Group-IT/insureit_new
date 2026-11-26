/** Strict current-PDF verified extraction for one Go Digit NEW JCB layout.
 * This is NOT a policy registration or a registration-number assignment.
 * A printed literal NEW is preserved as source text and requires review.
 */
export type DigitNewJcbField={
 key:string;label:string;value:string;confidence:null;page:null;evidence:string
};
export type DigitNewJcbAdmission={
 parserId:"go_digit_jcb_new_unregistered_native_pdf";
 fields:DigitNewJcbField[];
 premium:{od:number;tp:number;net:number;gst:number;gross:number};
 checksPassed:18;
};
const object=(x:unknown):x is Record<string,unknown> =>
 x!==null&&typeof x==="object"&&!Array.isArray(x);
const money=(x:unknown):x is number =>
 typeof x==="number"&&Number.isFinite(x)&&x>=0&&x<=1e9
 &&Math.abs(x*100-Math.round(x*100))<.00001;
const day=(v:string)=>/^\d{4}-\d{2}-\d{2}$/.test(v)
 &&Number.isFinite(Date.parse(v+"T00:00:00Z"))
 &&new Date(v+"T00:00:00Z").toISOString().slice(0,10)===v;
const keys=[
 "insurer_verified","policy_identity_verified","insured_name_verified",
 "policy_start_end_verified","issuance_date_evidenced",
 "vehicle_identification_verified","vehicle_make_model_verified",
 "vehicle_class_verified","vehicle_registration_printed","vehicle_idv_verified",
 "od_tp_components_printed","net_od_tp_reconciled",
 "gst_independently_evidenced","gross_net_tax_reconciled",
 "digit_layout","unregistered_new_printed","od_basic_ncb","tp_itemization"
];
const allowed=new Set([
 "insurer_name","policy_number","insured_name","policy_product",
 "policy_issuance_date","policy_start_date","policy_end_date",
 "third_party_start_date","third_party_end_date",
 "vehicle_registration_number","vehicle_registration_status",
 "vehicle_make","vehicle_model","vehicle_class","vehicle_fuel_type",
 "vehicle_chassis_number","vehicle_engine_number",
 "vehicle_manufacturing_year","vehicle_capacity","vehicle_rto_name",
 "vehicle_rto_state","vehicle_registration_year","idv","od_premium","tp_premium"
]);
/** Fail closed with stage codes. No policy or queue mutation. */
export function acceptGoDigitNewJcbExtraction(
 payload:unknown,ids:{intake_id:string;document_id:string;request_id:string},
):DigitNewJcbAdmission{
 const fail=(code:string):never=>{throw new Error(code)};
 if(!object(payload)||payload.contract_version!=="1"
  ||payload.parser_id!=="go_digit_jcb_new_unregistered_native_pdf"
  ||payload.parser_version!=="non-tata-cv-v2"
  ||payload.extraction_method!=="native_pdf_text"
  ||payload.review_required!==true||payload.auto_finalize_allowed!==false
  ||payload.ok!==true||payload.validation_passed!==true
  ||payload.intake_id!==ids.intake_id||payload.document_id!==ids.document_id
  ||payload.request_id!==ids.request_id
  ||!object(payload.checks)||!Array.isArray(payload.fields)
  ||!Array.isArray(payload.warnings)||payload.warnings.length!==0
  ||!object(payload.premium_components))
  fail("digit_jcb_source_contract_invalid");
 const checks=payload.checks as Record<string,unknown>;
 if(Object.keys(checks).length!==18||keys.some(k=>checks[k]!==true))
  fail("digit_jcb_source_checks_invalid");
 const fields:DigitNewJcbField[]=[];
 for(const x of payload.fields){
  if(!object(x)||typeof x.key!=="string"||!allowed.has(x.key)
   ||typeof x.label!=="string"||x.label.length>100
   ||typeof x.value!=="string"||!x.value.trim()||x.value.length>300
   ||typeof x.evidence!=="string"||x.evidence.length>180
   ||x.confidence!==null||x.page!==null)
    fail("digit_jcb_field_invalid");
  fields.push({key:x.key,label:x.label,value:x.value,confidence:null,
   page:null,evidence:x.evidence});
 }
 if(fields.length<16||fields.length>28
   ||new Set(fields.map(f=>f.key)).size!==fields.length)
  fail("digit_jcb_fields_ambiguous");
 const by=new Map(fields.map(f=>[f.key,f]));
 const v=(k:string)=>by.get(k)?.value.trim()??"";
 const required=["insurer_name","policy_number","insured_name","policy_product",
 "policy_start_date","policy_end_date","policy_issuance_date",
 "vehicle_registration_number","vehicle_registration_status",
 "vehicle_make","vehicle_model","vehicle_class",
 "vehicle_chassis_number","vehicle_engine_number","idv",
 "od_premium","tp_premium"];
 if(required.some(k=>!v(k)))fail("digit_jcb_required_field_missing");
 if(v("insurer_name")!=="Go Digit General Insurance Limited"
   ||v("policy_product")!=="Digit Commercial Vehicle Insurance"
   ||v("vehicle_make")!=="JCB"
   ||v("vehicle_model")!=="3 DX PLUS CEV V / BACKHOE LOADER"
   ||v("vehicle_registration_number")!=="NEW"
   ||v("vehicle_registration_status")!=="registration_pending"
   ||v("vehicle_class")!=="Commercial Vehicle - Miscellaneous Class D"
   ||by.get("vehicle_registration_number")?.evidence
     !=="Digit PDF vehicle schedule: printed NEW registration"
   ||by.get("vehicle_registration_status")?.evidence
     !=="Digit PDF vehicle schedule: printed NEW registration")
   fail("digit_jcb_unregistered_identity_invalid");
 const registrationTokens=fields.filter(f=>f.key==="vehicle_registration_number");
 if(registrationTokens.length!==1)fail("digit_jcb_registration_ambiguous");
 if(!day(v("policy_issuance_date"))||!day(v("policy_start_date"))
  ||!day(v("policy_end_date"))||v("policy_start_date")>v("policy_end_date")
  ||v("policy_issuance_date")>v("policy_end_date"))
  fail("digit_jcb_dates_unverified");
 const p=payload.premium_components as Record<string,unknown>;
 if(!["od","tp","net","gst","gross"].every(k=>money(p[k])))
  fail("digit_jcb_premiums_missing");
 const od=p.od as number,tp=p.tp as number,net=p.net as number,
  gst=p.gst as number,gross=p.gross as number;
 if(od<=0||tp<=0||net<=0||gross<=0
  ||Math.abs(od+tp-net)>.06||Math.abs(net+gst-gross)>.06
  ||Math.abs(Number(v("od_premium"))-od)>.01
  ||Math.abs(Number(v("tp_premium"))-tp)>.01
  ||!Number.isFinite(Number(v("idv")))||Number(v("idv"))<=0)
  fail("digit_jcb_printed_premium_mismatch");
 // Keep NEW in the source, never synthesize a registered plate, CPA or
 // canonical booking premium. The downstream status stays in RTO review.
 return{parserId:"go_digit_jcb_new_unregistered_native_pdf",fields,
  checksPassed:18,premium:{od,tp,net,gst,gross}};
}
