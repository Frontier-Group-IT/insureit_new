type Field={key:string;value:string;evidence?:string|null};
type Money={od:number;tp:number;net:number;gst:number;gross:number;cpa?:number};
type Canonical={od:string;tp:string;cpa:string;addOnPremium:string;cpaOpted:"Yes"|"No"};
type Input={parserId:string;checksPassed:number;warnings:readonly string[];
 fields:readonly Field[];commercialPremium?:Money|null;
 candidateCanonicalPremium?:Canonical|null};
/** Eligibility to ATTEMPT canonical preflight, never permission to write a policy.
 * Only the exact source-certified Go Digit 3DX PLUS CEV V NEW PDF is admitted.
 * RTO city/state are optional; no real plate or CPA can be fabricated.
 */
export function assessGoDigitNewJcbDirectConversion(input:Input):{eligible:boolean;reason:string}{
 const fail=(reason:string)=>({eligible:false,reason});
 if(input.parserId!=="go_digit_jcb_new_unregistered_native_pdf"||input.checksPassed!==18
   ||input.warnings.length)return fail("digit_new_source_not_certified");
 const map=new Map<string,Field>();
 for(const f of input.fields){if(map.has(f.key))return fail("digit_new_duplicate_field");map.set(f.key,f);}
 const get=(k:string)=>map.get(k)?.value?.trim()??"";
 for(const key of ["policy_number","insured_name","policy_issuance_date","policy_start_date",
   "policy_end_date","vehicle_registration_status","vehicle_registration_number",
   "vehicle_make","vehicle_model","vehicle_class","vehicle_fuel_type",
   "vehicle_manufacturing_year","vehicle_capacity","vehicle_chassis_number",
   "vehicle_engine_number","idv","od_premium","tp_premium","cpa_premium"])
   if(!get(key))return fail("digit_new_missing_"+key);
 if(get("vehicle_registration_status")!=="registration_pending"
   ||get("vehicle_registration_number")!=="NEW"
   ||map.get("vehicle_registration_number")?.evidence!=="Digit PDF vehicle schedule: printed NEW registration"
   ||map.get("vehicle_registration_status")?.evidence!=="Digit PDF vehicle schedule: printed NEW registration"
   ||get("vehicle_make")!=="JCB"
   ||get("vehicle_model")!=="3 DX PLUS CEV V / BACKHOE LOADER"
   ||get("vehicle_class")!=="Commercial Vehicle - Miscellaneous Class D"
   ||get("vehicle_fuel_type")!=="Diesel"
   ||!/^20\\d{2}$/.test(get("vehicle_manufacturing_year"))
   ||!/^\\d{3,5}$/.test(get("vehicle_capacity"))
   ||map.get("cpa_premium")?.evidence!=="Digit PDF PA cover for Owner-Driver (printed)")
   return fail("digit_new_vehicle_or_cpa_source_invalid");
 const date=(v:string)=>/^\\d{4}-\\d{2}-\\d{2}$/.test(v)&&!Number.isNaN(Date.parse(v+"T00:00:00Z"))
   &&new Date(v+"T00:00:00Z").toISOString().slice(0,10)===v;
 if(!date(get("policy_issuance_date"))||!date(get("policy_start_date"))
   ||!date(get("policy_end_date"))||get("policy_start_date")>get("policy_end_date")
   ||get("policy_issuance_date")>get("policy_end_date"))
   return fail("digit_new_issue_or_cover_dates_invalid");
 const p=input.commercialPremium,c=input.candidateCanonicalPremium;
 if(!p||!c)return fail("digit_new_missing_certified_premium");
 const cents=(v:number)=>Math.round(v*100);
 const exact=(n:number)=>Number.isFinite(n)&&n>=0&&n<=1_000_000_000
   &&Math.abs(n*100-cents(n))<.00001;
 const money=[p.od,p.tp,p.net,p.gst,p.gross,p.cpa??NaN,
   Number(get("idv")),Number(get("od_premium")),Number(get("tp_premium")),
   Number(get("cpa_premium")),Number(c.od),Number(c.tp),Number(c.cpa),Number(c.addOnPremium)];
 if(!money.every(exact)||!p.od||!p.tp||!p.net||!p.gross||!p.cpa
   ||c.cpaOpted!=="Yes"||c.addOnPremium!=="0"
   ||cents(p.od+p.tp)!==cents(p.net)
   ||cents(p.net+p.gst)!==cents(p.gross)
   ||cents(p.cpa)!==cents(Number(get("cpa_premium")))
   ||cents(p.od)!==cents(Number(get("od_premium")))
   ||cents(p.tp)!==cents(Number(get("tp_premium")))
   ||cents(Number(c.od))!==cents(p.od)
   ||cents(Number(c.cpa))!==cents(p.cpa)
   ||cents(Number(c.tp)+Number(c.cpa))!==cents(p.tp))
   return fail("digit_new_printed_cpa_tp_net_gross_unreconciled");
 return {eligible:true,reason:""};
}
