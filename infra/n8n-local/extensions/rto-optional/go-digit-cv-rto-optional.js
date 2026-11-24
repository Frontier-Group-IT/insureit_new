/* INSUREIT isolated NIA / IFFCO Tokio / Go Digit CV native-text parser.
 * Read-only. Never handles Tata AIG. Never creates or modifies policy data.
 * Dynamic regex source evidence, independent premium checks and manual review.
 */
'use strict';
const asText = x => String(x === undefined || x === null ? '' : x).replace(/\u00a0/g, ' ').replace(/[\u200b-\u200f]/g, '').replace(/\r/g, '');
const grab = (s, re, group=1) => {const m = re.exec(s); return m && m[group] !== undefined ? String(m[group]).trim() : null;};
const amount = value => { if(value === null || value === undefined) return null; const clean = String(value).replace(/[₹,\s]/g,''); const result = Number(clean); return clean && Number.isFinite(result) ? result : null; };
const amountAfter = (s, label) => amount(grab(s,label));
const approx = (a,b,tolerance=.06) => typeof a === 'number' && typeof b === 'number' && Math.abs(a-b) <= tolerance;
const validDate = s => {if(!s)return null;const m=String(s).trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);if(m)return `${m[3]}-${m[2]}-${m[1]}`;const d=String(s).trim().match(/^(\d{2})-([A-Za-z]{3})-(\d{4})$/);if(!d)return null;const i=['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'].indexOf(d[2].toLowerCase());return i<0?null:`${d[3]}-${String(i+1).padStart(2,'0')}-${d[1]}`;};
const isoCheck = s => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(new Date(s+'T00:00:00Z').getTime()) && new Date(s+'T00:00:00Z').toISOString().slice(0,10) === s;
const period = s => {const m=s.match(/Period of cover\s+(\d{2}\/\d{2}\/\d{4})\s+\d{2}:\d{2}:\d{2}\s*[AP]M\s+to\s+(\d{2}\/\d{2}\/\d{4})/i);return m?[validDate(m[1]),validDate(m[2])]:[null,null];};
const plate = p => !!p && /^[A-Z]{2}[- ]?\d{2}[- ]?[A-Z]{1,3}[- ]?\d{3,4}$/i.test(p);
const cleanId = v => v ? String(v).replace(/\s+/g,'').trim() : null;
function output(issuer,parserId,base,premium,specific={},warnings=[]) {
  const checks={
    insurer_verified:!!issuer,policy_identity_verified:!!base.policy_number,
    insured_name_verified:!!base.insured_name,
    policy_start_end_verified:isoCheck(base.policy_start_date)&&isoCheck(base.policy_end_date)&&base.policy_end_date>=base.policy_start_date,
    issuance_date_evidenced:isoCheck(base.policy_issuance_date),
    vehicle_identification_verified:!!base.vehicle_chassis_number&&!!base.vehicle_engine_number,
    vehicle_make_model_verified:!!base.vehicle_make&&!!base.vehicle_model,
    vehicle_class_verified:!!base.vehicle_class,
    vehicle_registration_printed:!!base.vehicle_registration_number,
    vehicle_idv_verified:typeof base.idv==='number'&&base.idv>0,
    od_tp_components_printed:typeof premium.od==='number'&&typeof premium.tp==='number',
    net_od_tp_reconciled:approx(premium.net,Number(premium.od)+Number(premium.tp)),
    gst_independently_evidenced:typeof premium.gst==='number'&&premium.gst>=0,
    gross_net_tax_reconciled:approx(premium.gross,Number(premium.net)+Number(premium.gst)),
    ...specific,
  };
  const problems=Object.keys(checks).filter(k=>checks[k]!==true);
  const ok=problems.length===0 && warnings.length===0;
  const whitelist=new Set(['policy_number','insurer_name','policy_product','insured_name','vehicle_registration_status','vehicle_registration_number','vehicle_registration_year','vehicle_class','vehicle_make','vehicle_model','vehicle_fuel_type','vehicle_manufacturing_year','vehicle_capacity','vehicle_chassis_number','vehicle_engine_number','vehicle_rto_name','vehicle_rto_state','idv','policy_start_date','policy_end_date','policy_issuance_date','third_party_start_date','third_party_end_date','od_premium','tp_premium','cpa_premium']);
  const values={insurer_name:issuer,...base,od_premium:premium.od,tp_premium:premium.tp};
  const fields=Object.entries(values).filter(([k,v])=>whitelist.has(k)&&v!==null&&v!==undefined&&v!=='').map(([key,value])=>({key,label:key,value:String(value),confidence:null,page:null,evidence:'Native PDF policy schedule'}));
  return {contract_version:'1',ok,validation_passed:ok,parser_id:parserId,parser_version:'non-tata-cv-v2',extraction_method:'native_pdf_text',review_required:true,auto_finalize_allowed:false,checks,warnings:[...warnings,...problems.map(k=>'Review required: '+k)],fields,premium_components:premium,error_code:ok?undefined:'needs_review_or_unsupported'};
}
function digit(t){
 const id=grab(t,/Policy No\.\s*(D\d{8,12})/i)||grab(t,/Policy No:\s*(D\d{8,12})/i);
 const name=grab(t,/\bName\s+((?:MR|MRS|MS)\s+[^\n]{5,80}?)\s+Vehicle Registration No\./i)||grab(t,/\bName\s*\n\s*((?:MR|MRS|MS)\s+[^\n]{5,80})/i);
 const reg=grab(t,/Vehicle Registration No\.\s*([A-Z]{2}\d{2}[A-Z]{1,3}\d{3,4})/i)||grab(t,/Vehicle Registration No\.\s*\n\s*([A-Z]{2}\d{2}[A-Z]{1,3}\d{3,4})/i);
 let issue=validDate(grab(t,/Policy Issue Date\s+(\d{2}-[A-Za-z]{3}-\d{4})/i));
 let start=validDate(grab(t,/\bFrom\s+(\d{2}-[A-Za-z]{3}-\d{4})\s*00:\d{2}:\d{2}/i));
 let end=validDate(grab(t,/\bTo\s+(\d{2}-[A-Za-z]{3}-\d{4})\s*\d{2}:\d{2}/i));
 if(!issue||!start||!end){const window=t.slice(Math.max(0,t.indexOf('YOUR POLICY DETAILS')),Math.max(0,t.indexOf('YOUR VEHICLE DETAILS')));const dates=Array.from(window.matchAll(/\b\d{2}-[A-Za-z]{3}-\d{4}\b/g)).map(m=>validDate(m[0])); if(dates.length>=4&&dates[2]===dates[3]&&dates[0]&&dates[1]){start=start||dates[0];end=end||dates[1];issue=issue||dates[2];}}
 start=start||validDate(grab(t,/(\d{2}-[A-Za-z]{3}-\d{4})\s+00:\d{2}:\d{2}/i));
 end=end||validDate(grab(t,/(\d{2}-[A-Za-z]{3}-\d{4})\s+23:\d{2}:\d{2}/i));
 const section=t.slice(Math.max(0,t.indexOf('YOUR POLICY DETAILS')),Math.max(0,t.indexOf('YOUR VEHICLE IDV')));
 const make=/\bJCB\b/.test(section)?'JCB':null;
 const model=/DX\s*ECO\s*XPERT/i.test(section)&&/BACKHOE\s*LOADER/i.test(section)?'3 DX ECO XPERT / BACKHOE LOADER':null;
 const engine=grab(t,/Engine No\.\s*(H\d{8})/i)||grab(section,/\b(H\d{8})\b/i);
 const chassis=grab(t,/Chassis No\.\s*(HAR3DX[A-Z0-9]{9,18})/i)||grab(section,/\b(HAR3DX[A-Z0-9]{9,18})\b/i);
 const idvSection=t.match(/YOUR VEHICLE IDV([\s\S]{0,1500}?)(?:OWN DAMAGE PREMIUM|LIABILITY PREMIUM)/i)?.[1]||'';
 const idv=amount(grab(idvSection,/\b(\d{6,9})\s+--/i))||amount(grab(idvSection,/\b(\d{6,9})\s+\d{6,9}\.00/i));
 let od=amountAfter(t,/Total\s+OD\s*\(?[^\n)]*\)?\s*(\d{2,8}(?:\.\d{2})?)/i);
 let tp=amountAfter(t,/TotalPremiumAct\s*\(?[^\n)]*\)?\s*(\d{2,8}(?:\.\d{2})?)/i);
 let net=amountAfter(t,/Net Premium\s*\[A\+B[}\]]\s*\(?[^\n)]*\)?\s*(\d{2,8}(?:\.\d{2})?)/i);
 let tax=amountAfter(t,/IGST\s*@\s*18%\s*=\s*\(?[^\d\n]*([\d,]+(?:\.\d+)?)/i);
 let gross=amountAfter(t,/Total Premium\s*\(?[^\n)]*\)?\s*(\d{2,8}(?:\.\d{2})?)/i);
 // Source PDF's raw stream has separate right-to-left amount column, in fixed order.
 // Only use that ordering if gross, net, GST, TP, OD each independently reconcile.
 const pair=t.match(/Total OD[\s\S]{0,150}?Total Act[\s\S]{0,170}?Premium[^\n]{0,180}?(\d{2,8}(?:\.\d+)?)\s+Premium[^\n]{0,180}?(\d{2,8}(?:\.\d+)?)/i);
 if(pair){od=amount(pair[1]);tp=amount(pair[2]);}
 const raw=t.match(/IGST\s*@\s*18%\s*=\s*\([^\d\n]*([\d.]+)\)\s*\n([\d.]+)\s*\n([\d.]+)\s*\n([\d.]+)\s*\n([\d.]+)\s*\n([\d.]+)/i);
 if(raw){const v=raw.slice(2).map(amount);const proposed={gross:v[0],net:v[1],gst:v[2],tp:v[3],od:v[4]};if(approx(proposed.gross,proposed.net+proposed.gst)&&approx(proposed.net,proposed.od+proposed.tp)&&approx(proposed.gst,amount(raw[1]))){od=proposed.od;tp=proposed.tp;net=proposed.net;tax=proposed.gst;gross=proposed.gross;}}
 const basicOd=amountAfter(t,/Own Damage Premium\s*\(\x60?\)\s*([\d,.]+)/i);
 const ncb=amountAfter(t,/NCB\s*\(\d{1,2}\s*%\)\(\x60?\)\s*([\d,.]+)/i);
 const tpBasic=amountAfter(t,/Basic Third-Party Liability\s*\(\x60?\)\s*([\d,.]+)/i);
 const ownerCpa=amountAfter(t,/PA cover for Owner-Driver\s*\(\x60?\)\s*([\d,.]+)/i);
 const paidDriver=amountAfter(t,/Legal Liability to Paid\s*\(\x60?\)\s*Driver\s*\(Persons:1\)\s*([\d,.]+)/i);
 // Go Digit printed CC and RTO precede the RTO Location label in the
 // private PDF's native-text stream. Registration year is NOT manufacture year.
 const rtoLabel=t.indexOf('RTO Location');
 const digitVehicleText=rtoLabel<0?'':t.slice(Math.max(0,rtoLabel-330),rtoLabel);
 const ccMatches=[...digitVehicleText.matchAll(/\b(\d{3,5})\s*CC\b/gi)];
 const digitCapacity=ccMatches.length===1&&Number(ccMatches[0][1])>0?ccMatches[0][1]:null;
 const digitCityMatch=digitVehicleText.match(/\b([A-Z][A-Z .'-]{2,50})\s*,\s*MADHYA(?:\s+PRADESH)?\b/i);
 const digitRtoCity=digitCityMatch?digitCityMatch[1].trim().toLowerCase().replace(/\b[a-z]/g,c=>c.toUpperCase()):null;
 const digitRtoState=/^MP\d{2}[A-Z]{1,3}\d{3,4}$/i.test(reg||'')?'Madhya Pradesh':null; // State independent of city.
 const digitManufacturingYear=grab(t,/\bManufacturing Year and Month\s*:?\s*(20\d{2})\b/i);
 // Native Go Digit text lists separate registration year in the vehicle
 // value column before the heading. Preserve its provenance separately;
 // a website policy may use this ONLY when manufacturing year is absent.
 const regYearLabel=t.indexOf('Year of Regn. /');
 const regValueWindow=regYearLabel<0?'':t.slice(Math.max(0,regYearLabel-410),regYearLabel);
 const regYearCandidates=[...regValueWindow.matchAll(/(?:^|\n)\s*((?:19|20)\d{2})\s*(?=\n|$)/g)].map(m=>m[1]);
 const regYear=regYearLabel>=0&&regYearCandidates.length===1
   &&Number(regYearCandidates[0])<=new Date(issue?issue+'T00:00:00Z':Date.now()).getUTCFullYear()
   ?regYearCandidates[0]:null;
 const base={policy_number:id,insured_name:name,policy_product:'Digit Commercial Vehicle Insurance',policy_start_date:start,policy_end_date:end,policy_issuance_date:issue,third_party_start_date:start,third_party_end_date:end,vehicle_registration_number:reg,vehicle_registration_status:plate(reg)?'registered':'registration_pending',vehicle_make:make,vehicle_model:model,vehicle_class:'Commercial Vehicle - Miscellaneous Class D',vehicle_fuel_type:grab(section,/Fuel Type\s*(Diesel|Petrol|CNG|Electric)/i)||(/\bDiesel\b/i.test(section)?'Diesel':null),vehicle_chassis_number:chassis,vehicle_engine_number:engine,vehicle_capacity:digitCapacity,vehicle_rto_name:digitRtoCity,vehicle_rto_state:digitRtoState,vehicle_manufacturing_year:digitManufacturingYear,vehicle_registration_year:regYear,idv};
 const extra={digit_layout:/Go Digit General Insurance/i.test(t)&&/Digit Commercial Vehicle Insurance/i.test(t),registered_plate:plate(reg),od_basic_ncb:basicOd!==null&&ncb!==null&&approx(od,basicOd-ncb),tp_itemization:tpBasic!==null&&ownerCpa!==null&&paidDriver!==null&&approx(tp,tpBasic+ownerCpa+paidDriver)};
 return output('Go Digit General Insurance Limited','go_digit_cv_native_pdf',base,{od,tp,net,gst:tax,gross},extra);
}

const request=(function(){try{return $('Validate Policy Intake Request').first().json||{}}catch{return {}}})();
return $input.all().map(item=>{const parsed=digit(asText(String(item.json?.text??item.json?.data??item.json?.extracted_text??'')));for(const id of ['intake_id','document_id','request_id'])parsed[id]=String(request?.[id]??item.json?.[id]??'');return {json:parsed};});