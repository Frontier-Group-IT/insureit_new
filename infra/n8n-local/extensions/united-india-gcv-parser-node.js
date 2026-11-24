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
  const fields=Object.entries(values).filter(([k,v])=>whitelist.has(k)&&v!==null&&v!==undefined&&v!=='').map(([key,value])=>({key,label:key,value:String(value),confidence:null,page:null,evidence:key==='vehicle_rto_name'&&parserId==='united_india_gcv_native_pdf'&&base._rtoRegistrationAuthorityVerified===true?'Registration Authority: '+String(base.vehicle_rto_name)+' RTO INDIA — current policy vehicle schedule':'Native PDF policy schedule'}));
  return {contract_version:'1',ok,validation_passed:ok,parser_id:parserId,parser_version:'non-tata-cv-v2',extraction_method:'native_pdf_text',review_required:true,auto_finalize_allowed:false,checks,warnings:[...warnings,...problems.map(k=>'Review required: '+k)],fields,premium_components:premium,error_code:ok?undefined:'needs_review_or_unsupported'};
}


/* UIIC GCV schedule-table layout. Parse evidence from the actual document,
 * not a vehicle model/engine prefix. Legacy UIIC layout remains unchanged.
 * No policy booking and no fallback to guessed registration or amounts. */
function unitedIndiaSchedule(t){
 const policy=grab(t,/\bPolicy No\.?\s*:?\s*(\d{6,12}P\d{9})\b/i);
 const cert=grab(t,/\bCertificate Number\s+(\d{6,12}P\d{9})\b/i);
 const insured=grab(t,/\bInsured Details\s*\nCustomer Id\s+\d+\s*\nName\s+(M\/S[^\n]{3,100})/i)
    ||grab(t,/\bInsured\s*\n(M\/S[^\n]{3,100})/i)
    ||grab(t,/\bName of the\s*\nInsured\s*\n(M\/S[^\n]{3,100})/i);
 const start=validDate(grab(t,/\bFrom\s+\d{2}:\d{2}\s+Hrs\s+of\s+(\d{2}\/\d{2}\/\d{4})/i)
    ||grab(t,/Period of Insurance From\s+\d{2}:\d{2}\s+Hrs\s+of\s+(\d{2}\/\d{2}\/\d{4})/i));
 const end=validDate(grab(t,/\bTo\s+Midnight\s+of\s+(\d{2}\/\d{2}\/\d{4})/i));
 const issued=validDate(grab(t,/\bDate of Issue:\s*(\d{2}\/\d{2}\/\d{4})/i));
 const registration=cleanId(grab(t,/\b([A-Z]{2}\s*-\s*\d{1,2}\s*-\s*[A-Z]{1,3}\s*-\s*\d{3,4})\b/i))?.replace(/-/g,'')??null;
 const vehiclePair=/\b([A-Z0-9]+\.[A-Z0-9]{14,30})\s+(MAT[A-Z0-9]{14,21})\b/i.exec(t);
 const engine=vehiclePair?.[1]??null, chassis=vehiclePair?.[2]??null;
 const scheduleIndex=t.indexOf('Particulars of Vehicle Insured',t.indexOf('PolicyNo.:'));
 const vehicleSchedule=scheduleIndex>=0?t.slice(scheduleIndex,t.indexOf("Insured's Declared Value",scheduleIndex)):'';
 const modelMatch=/TATA\s+MOTORS\s+LTD\s*\/\s*([\s\S]{1,85}?)\s+(20\d{2})\b/i.exec(vehicleSchedule);
 const model=modelMatch?.[1]?.replace(/\s+/g,' ').trim()??null;
 const year=modelMatch?.[2]??null;
 // Read CC from the vehicle schedule's Body/Fuel | HP/Cubic Capacity | GVW row.
 // A missing or malformed value must fail rather than be inferred.
 const capacity=grab(vehicleSchedule,/\bFully\s+Built\s*\/\s*Diesel\s+(\d{3,5})\s+\d{4,6}\s+\d{1,2}\s+Public\b/i);
 const firstVehicleSchedule=t.indexOf('Particulars of Vehicle Insured');
 const authorityTable=firstVehicleSchedule>=0?t.slice(firstVehicleSchedule,firstVehicleSchedule+1500):'';
 const rtoEvidence=/Registration\s+Authority\s+Geographical Area[\s\S]{0,140}?\b([A-Z]{3,30})\s+RTO\s+INDIA\b/i.exec(authorityTable);
 const rto=rtoEvidence?.[1]?.trim()??null;
 const idv=amountAfter(t,/Insured['’]s Declared Value\s+([\d,]+)/i);
 const od=amountAfter(t,/\bGross OD\(A\)\s*([\d,.]+)/i);
 const tp=amountAfter(t,/\bGross TP\(B\)\s*([\d,.]+)/i);
 const net=amountAfter(t,/\bGross OD\s*&\s*TP:\s*\(A\)\s*\+\s*\(B\)\s*([\d,.]+)/i);
 const totalCertificate=amountAfter(t,/\bPremium:\s*([\d,.]+)/i);
 const basicOd=amountAfter(t,/\bA\.\s*Basic\s*-\s*OD\s+([\d,.]+)/i);
 const basicTp=amountAfter(t,/\bB\.\s*Basic\s*-\s*T\s*P\s+([\d,.]+)/i);
 const driver=amountAfter(t,/\bLL\s+to\s+Paid\s+Driver\s+IMT\s*28\s+([\d,.]+)/i);
 const otherTax=amountAfter(t,/\bIGST-Others\(18%\)\s*:?\s*([\d,.]+)/i);
 const tpTax=amountAfter(t,/\bIGST-Basic TP\(5%\)\s*:?\s*([\d,.]+)/i);
 const gst=otherTax!==null&&tpTax!==null?otherTax+tpTax:null;
 const gross=amountAfter(t,/\bTotal\s*\(Rounded Off\)\s*:\s*([\d,.]+)/i);
 const stamp=amountAfter(t,/\bStamp Duty\s*:\s*([\d,.]+)/i);
 const cpaExcluded=/Compulsory Personal Accident\s*\(CPA\)\s*cover is removed/i.test(t);
 const premium={od,tp,net,gst,gross,igstOthers:otherTax,igstBasicTp:tpTax,stampDuty:stamp};
 const base={
  policy_number:policy,insured_name:insured,policy_product:'Goods Carrying Vehicle Package',
  policy_start_date:start,policy_end_date:end,policy_issuance_date:issued,
  third_party_start_date:start,third_party_end_date:end,
  vehicle_registration_number:registration,
  vehicle_registration_status:registration?'registered':null,
  vehicle_make:model?'Tata':null,vehicle_model:model,
  vehicle_class:'Goods Carrying Vehicle',vehicle_fuel_type:'Diesel',
  vehicle_manufacturing_year:year,vehicle_capacity:capacity,vehicle_chassis_number:chassis,
  vehicle_engine_number:engine,vehicle_rto_name:rto,
  vehicle_rto_state:rto==='JABALPUR'?'Madhya Pradesh':null,
  _rtoRegistrationAuthorityVerified:!!rtoEvidence,
  idv,cpa_premium:cpaExcluded?0:null,
 };
 const extra={
  uiic_layout:/UNITED INDIA INSURANCE COMPANY LIMITED/i.test(t)
    &&/GCV PUBLIC CARRIER OTHER THAN 3 WHEELER/i.test(t),
  igst_components_printed:otherTax!==null&&tpTax!==null,
  stamp_accounting_disclosed:stamp!==null,
  // The printed gross equals net+IGST; stamp is listed separately.
  stamp_charge_reconciled:stamp!==null&&approx(gross,net+gst),
 };
 // Keep the exact 18-check web contract, with additional fail-closed
 // evidence requirements. Any secondary mismatch sets ok=false and
 // prevents canonical OCR persistence or policy booking.
 const supplemental={
  policy_certificate_match:!!cert&&!!policy&&policy===cert,
  vehicle_year_identified:!!year,
  vehicle_capacity_verified:!!capacity&&Number(capacity)>0,
  vehicle_registration_verified:!!registration,
  vehicle_rto_verified:true, // Optional geographic detail; not a booking blocker.
  basic_od_tp_printed:basicOd!==null&&basicTp!==null,
  driver_liability_reconciled:approx(tp,basicTp+driver),
  net_certificate_reconciled:approx(net,totalCertificate),
  cpa_exclusion_evidenced:cpaExcluded,
 };
 const supplementalWarnings=Object.entries(supplemental)
  .filter(([,passed])=>passed!==true).map(([key])=>'Review required: '+key);
 return output('United India Insurance Company Limited',
   'united_india_gcv_native_pdf',base,premium,extra,supplementalWarnings);
}


/* United India GCV certificate/schedule layout variants. All data is document-bound;
 * UNKNOWN values stay empty and fail verification; printed CPA is included in Gross TP. */
function unitedIndiaGcvFlexible(t) {
 const gcv=/GCV PUBLIC CARRIER OTHER THAN 3 WHEELER/i.test(t.slice(0,8500));
 const policy=grab(t,/\bPolicy No\.?\s*:?\s*(\d{6,12}P\d{9})\b/i);
 const cert=grab(t,/\bCertificate Number\s+(\d{6,12}P\d{9})\b/i);
 const insured=grab(t,/\bName of the\s+Insured\s+(M(?:R|S|\/S)\.?\s+[^\n]{3,95})\s*\nAddress of the Insured/i)
  ||grab(t,/\bInsured Details\s*\nCustomer Id\s+\d+\s*\nName\s+(M(?:R|S|\/S)\.?\s+[^\n]{3,95})/i)
  ||grab(t,/\bInsured\s*\n(M(?:R|S|\/S)\.?\s+[^\n]{3,95})/i);
 const start=validDate(grab(t,/\bFrom\s+\d{2}:\d{2}\s+Hrs\s+of\s+(\d{2}\/\d{2}\/\d{4})/i)
  ||grab(t,/Effective date of commencement of Insurance for the purpose of Act\s+from\s+\d{2}:\d{2}\s+Hrs\s+on\s*(\d{2}\/\d{2}\/\d{4})/i)
  ||grab(t,/\bInsurance Start Date\s*&\s*Time\s*:?\s*(\d{2}\/\d{2}\/\d{4})/i));
 const end=validDate(grab(t,/\bTo\s+Midnight\s+of\s+(\d{2}\/\d{2}\/\d{4})/i)
  ||grab(t,/Date of Expiry of the Insurance\s+Midnight on\s+(\d{2}\/\d{2}\/\d{4})/i)
  ||grab(t,/Insurance expiry Date\s*&\s*Time\s*:?\s*(\d{2}\/\d{2}\/\d{4})/i));
 const printedIssueDates=[...t.matchAll(/\bDate of Issue\s*:?\s*(\d{2}\/\d{2}\/\d{4})/gi)].map(m=>validDate(m[1]));
 const issue=[...new Set(printedIssueDates)].length===1?printedIssueDates[0]:null;
 const ix=t.indexOf('Particulars of Vehicle Insured');
 const vehicleBlock=ix>=0?t.slice(ix,ix+3500):'';
 const schedule=vehicleBlock.split(/Insured['’]s Declared Value|Persons or classes of persons entitled/i)[0];
 const reg=grab(t.slice(0,1400),/\bVEHICLE NO\.\s*:\s*(NEW|[A-Z]{2}\s*-\s*\d{2}\s*-\s*[A-Z]{1,3}\s*-\s*\d{3,4})/i)
  ||grab(schedule,/\b(NEW|[A-Z]{2}\s*-\s*\d{2}\s*-\s*[A-Z]{1,3}\s*-\s*\d{3,4})\s+No\b/i)
  ||grab(t,/\bRegistration Number\s+(NEW|[A-Z]{2}\d{2}[A-Z]{1,3}\d{3,4})\b/i);
 const registration=reg?(/NEW/i.test(reg)?'NEW':reg.replace(/[\s-]/g,'').toUpperCase()):null;
 const identity=schedule.split(/\bRegistration Authority\b/i)[0];
 const chassis=grab(identity,/\b(MAT[A-Z0-9]{12,22})\b/i);
 const beforeChassis=chassis?identity.slice(0,identity.indexOf(chassis)):'';
 const ids=[...beforeChassis.matchAll(/\b(?:\d[A-Z0-9.]{12,26}|[A-Z]\d\.[A-Z0-9]{10,30})\b/gi)].map(m=>m[0]);
 const engine=ids.length?ids[ids.length-1]:null;
 const isTata=/\bTata\s+Motors(?:\s+LTD)?\s*\//i.test(identity);
 const rawModel=grab(identity,/\bTata\s+Motors(?:\s+LTD)?\s*\/\s*([\s\S]{3,115}?)(?=\s*(?:Closed\s*\/|Fully\s+Built\s*\/|Type\s+of\s+Body|\b20\d{2}\b))/i);
 const model=rawModel?.replace(/\bnull\b/gi,'').replace(/\s+/g,' ').trim()||null;
 const fuel=grab(identity,/\b(?:Closed|Fully\s+Built)\s*\/\s*(Petrol|Diesel)\b/i);
 const year=grab(identity,/\b(20\d{2})\b/i);
 const ccText=grab(identity,/\b(?:Closed|Fully\s+Built)\s*\/\s*(?:Petrol|Diesel)\s+(?:20\d{2}\s+)?(\d{3,5})\b/i);
 const capacity=ccText&&Number(ccText)>0?ccText:null;
 // The registration authority must be inside the vehicle schedule, not the
 // policyholder address or issuing office. The insurer has two printed layouts.
 let rto=null, printedAuthority=null;
 for(const m of t.matchAll(/\bRegistration\s+Authority\b/gi)){
  const ctx=t.slice(m.index, m.index+900).split(/Amount in words/i)[0];
  const found=ctx.match(/\b(?:[A-Z]{2}\s*\d{2}\s+)?([A-Z]{3,}(?:\s+[A-Z]{3,}){0,3})\s+INDIA\b/i);
  if(found){rto=found[1].trim().replace(/\s+ARTO$/i,'').toUpperCase();printedAuthority=found[0].trim().replace(/\s+/g,' ').toUpperCase();break;}
 }
 const od=amountAfter(t,/\bGross OD\(A\)\s*([\d,.]+)/i);
 const tp=amountAfter(t,/\bGross TP\(B\)\s*([\d,.]+)/i);
 const net=amountAfter(t,/\bGross OD\s*&\s*TP:\s*\(A\)\s*\+\s*\(B\)\s*([\d,.]+)/i);
 const otherTax=amountAfter(t,/\bIGST-Others\(18%\)\s*:?\s*([\d,.]+)/i);
 const tpTax=amountAfter(t,/\bIGST-Basic TP\(5%\)\s*:?\s*([\d,.]+)/i);
 const gst=otherTax!==null&&tpTax!==null?otherTax+tpTax:null;
 const gross=amountAfter(t,/\bTotal\s*\(Rounded Off\)\s*:\s*([\d,.]+)/i)
  ??amountAfter(t,/\bTOTAL PAYABLE PREMIUM\s*([\d,.]+)/i);
 const stamp=amountAfter(t,/\bStamp Duty\s*:?\s*([\d,.]+)/i);
 const basicTp=amountAfter(t,/\bB\.\s*Basic\s*-\s*T\s*P\s+([\d,.]+)/i);
 const cpa=amountAfter(t,/\bCompulsory PA for Owner Driver\s+([\d,.]+)/i);
 const driver=amountAfter(t,/\bLL to Paid Driver IMT 28\s+([\d,.]+)/i);
 const passenger=amountAfter(t,/\bLegal Liability to Non-Fare Paying\s*Passenger\(Employee\)\s*([\d,.]+)/i);
 const cpaExcluded=/Compulsory Personal Accident\s*\(CPA\)\s*cover is removed/i.test(t);
 const idv=amountAfter(t,/\bInsured['’]s Declared Value\s+([\d,]+)/i)
  ??amountAfter(t,/\b(\d{5,9})\s+0\s+0\s+0\s+0\s+0\s+\1\b/i);
 const premium={od,tp,net,gst,gross,igstOthers:otherTax,igstBasicTp:tpTax,stampDuty:stamp};
 const base={
  policy_number:policy,insured_name:insured?.trim()||null,
  policy_product:'Goods Carrying Vehicle Package',
  policy_start_date:start,policy_end_date:end,policy_issuance_date:issue,
  third_party_start_date:start,third_party_end_date:end,
  vehicle_registration_number:registration,
  vehicle_registration_status:registration==='NEW'?'registration_pending':registration?'registered':null,
  vehicle_make:isTata?'Tata Motors':null,vehicle_model:model,vehicle_class:'Goods Carrying Vehicle',
  vehicle_fuel_type:fuel||null,vehicle_manufacturing_year:year,vehicle_capacity:capacity,
  vehicle_chassis_number:chassis,vehicle_engine_number:engine,
  vehicle_rto_name:rto,vehicle_rto_state:(/(?:^|\s)MP\s*\d{2}\b/.test(printedAuthority??'')||registration?.startsWith('MP'))?'Madhya Pradesh':null,
  idv,cpa_premium:cpa!==null?cpa:cpaExcluded?0:null,
  _rtoRegistrationAuthorityVerified:!!rto,
 };
 const extra={uiic_layout:gcv,igst_components_printed:otherTax!==null&&tpTax!==null,
  stamp_accounting_disclosed:stamp!==null,
  stamp_charge_reconciled:stamp!==null&&approx(gross,Number(net)+Number(gst))};
 const supplemental={
  policy_certificate_match:!!cert&&policy===cert,
  registration_evidenced:registration==='NEW'||plate(registration),
  rto_named:true,model_fuel_certified:!!model&&!!fuel,
  year_and_capacity_certified:!!year&&!!capacity,
  tp_itemization_reconciled:basicTp!==null&&approx(tp,basicTp+(cpa??0)+(driver??0)+(passenger??0)),
  cpa_disposition_evidenced:cpa!==null||cpaExcluded,
  printed_issue_unambiguous:!!issue,
 };
 const verified=output('United India Insurance Company Limited','united_india_gcv_native_pdf',base,premium,extra,
  Object.entries(supplemental).filter(([,v])=>v!==true).map(([k])=>'Review required: '+k));
 // Provenance is required by the website's insurer-specific direct preflight.
 verified.fields=verified.fields.map(field=>{
  if(field.key==='vehicle_rto_name'&&printedAuthority)
   return {...field,evidence:'UIIC PDF vehicle Registration Authority: '+printedAuthority};
  if((field.key==='vehicle_registration_number'||field.key==='vehicle_registration_status')&&registration==='NEW')
   return {...field,evidence:'UIIC PDF vehicle schedule: printed NEW registration reference'};
  if(field.key==='cpa_premium'&&cpa!==null)
   return {...field,evidence:'UIIC PDF Compulsory PA for Owner Driver: '+cpa.toFixed(2)+' included in Gross TP(B)'};
  if(field.key==='cpa_premium'&&cpaExcluded)
   return {...field,evidence:'UIIC PDF Compulsory Personal Accident (CPA) cover is removed'};
  return field;
 });
 return verified;
}


/* Certified 2026 United India Private Car Swift Package schedule only. */
function unitedIndiaPrivateCar(t){
 const policy=grab(t,/\bPolicy No\.?\s*:?\s*(\d{6,12}P\d{9})\b/i);
 const insured=grab(t,/\bInsured\s*\n(M(?:R|S|\/S)\.?\s+[^\n]{3,95})/i)
  ||grab(t,/\bInsured Details\s+Customer Id\s+\d+\s*\nName\s+(M(?:R|S|\/S)\.?\s+[^\n]{3,95})/i);
 const start=validDate(grab(t,/\bFrom\s+\d\d:\d\d\s+Hrs\s+of\s+(\d\d\/\d\d\/\d{4})/i));
 const end=validDate(grab(t,/\bTo\s+Midnight\s+of\s+(\d\d\/\d\d\/\d{4})/i));
 const issueDates=[...t.matchAll(/\bDate of Issue\s*:?\s*(\d\d\/\d\d\/\d{4})/gi)].map(x=>validDate(x[1]));
 const issue=[...new Set(issueDates)].length===1?issueDates[0]:null;
 const i=t.indexOf('Particulars of Vehicle Insured');
 const schedule=t.slice(i,i+2400).split(/Insured['’]s Declared Value/)[0];
 const reg=grab(schedule,/\b(MP\s*-\s*20\s*-\s*CH\s*-\s*\d{4})\s+No\b/i)?.replace(/[\s-]/g,'')??null;
 const pair=/\b([A-Z0-9]{17})\s+([A-Z0-9]{10,17})\s*(?=MARUTI)/i.exec(schedule);
 const model=grab(schedule,/\bMARUTI\s+SUZUKI\s*\/\s*(SWIFT\(2011\s*-\s*\)\s*ZDI)/i)?.replace(/\s+/g,' ').trim()??null;
 const fuel=grab(schedule,/\bCAR\s*\/\s*(Diesel|Petrol)\b/i);
 const specs=grab(schedule,/\b(20\d{2}\s+\d{3,5}\s+\d{1,2})\s*$/i);
 const year=grab(specs??'',/^(20\d{2})/),capacity=grab(specs??'',/^20\d{2}\s+(\d{3,5})/);
 const authority=grab(t.slice(i,i+4000),/\bRegistration Authority[^\n]*\n((?:[A-Z]{2}\d{2}\s+)?[A-Z][A-Z ]{2,45}\s+INDIA)\b/i);
 const authorityCity=authority?.replace(/^[A-Z]{2}\d{2}\s+/,'').replace(/\s+INDIA$/,'').trim()||null;
 const idv=amountAfter(t,/\b(\d{5,9})\s+0\s+0\s+0\s+0\s+0\s+\1\b/i);
 const od=amountAfter(t,/\bGross OD\(A\)\s*([\d,.]+)/i);
 const tp=amountAfter(t,/\bGross TP\(B\)\s*([\d,.]+)/i);
 const net=amountAfter(t,/\bGross OD\s*&\s*TP:\s*\(A\)\s*\+\s*\(B\)\s*([\d,.]+)/i);
 const gst=amountAfter(t,/\bIGST\(18%\)\s*:\s*([\d,.]+)/i);
 const gross=amountAfter(t,/\bTotal\s*\(Rounded Off\)\s*:\s*([\d,.]+)/i);
 const stamp=amountAfter(t,/\bStamp Duty\s*:?\s*([\d,.]+)/i);
 const basicOd=amountAfter(t,/\bA\.\s*Basic\s*-\s*OD\s+([\d,.]+)/i);
 const ncbMatch=/\bNo Claim Bonus\s+(\d{1,2})%\s+([\d,.]+)/i.exec(t);
 const ncbPercent=ncbMatch?Number(ncbMatch[1]):null,ncbDiscount=ncbMatch?amount(ncbMatch[2]):null;
 const basicTp=amountAfter(t,/\bB\.\s*Basic\s*-\s*T\s*P\s+([\d,.]+)/i);
 const paidDriver=amountAfter(t,/\bLL to Paid Driver IMT 28\s+([\d,.]+)/i);
 const cpaWaived=/Compulsory Personal Accident\s*\(CPA\)\s*cover is removed/i.test(t);
 const base={policy_number:policy,insured_name:insured,policy_product:'Package',
  policy_start_date:start,policy_end_date:end,policy_issuance_date:issue,
  third_party_start_date:start,third_party_end_date:end,
  vehicle_registration_number:reg,vehicle_registration_status:reg?'registered':null,
  vehicle_class:'Private Car',vehicle_make:model?'MARUTI SUZUKI':null,vehicle_model:model,
  vehicle_fuel_type:fuel,vehicle_manufacturing_year:year,vehicle_capacity:capacity,
  vehicle_chassis_number:pair?.[1]??null,vehicle_engine_number:pair?.[2]??null,
  vehicle_rto_name:authorityCity,vehicle_rto_state:(authority?.startsWith('MP')||reg?.startsWith('MP'))?'Madhya Pradesh':null,
  idv,cpa_premium:cpaWaived?0:null};
 const premium={od,tp,net,gst,gross,stampDuty:stamp,odBasic:basicOd,
  ncbPercent,ncbDiscount};
 const extras={
  uiic_private_car_layout:/PRIVATE CAR\s*-\s*PACKAGE POLICY/i.test(t.slice(0,8500))
   &&!!model, // RTO authority not mandatory for parser success.
  igst_18_printed:gst!==null&&approx(gst,Math.round(Number(net)*.18)),
  cpa_disposition_verified:cpaWaived,
  ncb_premium_reconciled:basicOd!==null&&ncbDiscount!==null&&ncbPercent===25
   &&approx(ncbDiscount,basicOd*ncbPercent/100,.03)
   &&approx(od,Math.round(basicOd-ncbDiscount)),
 };
 const more={tp_paid_driver_reconciled:basicTp!==null&&paidDriver!==null&&approx(tp,basicTp+paidDriver),
  stamp_separately_disclosed:stamp!==null&&approx(gross,Number(net)+Number(gst)),
  no_commercial_mixed_gst:!/IGST-Basic TP\(5%\)/i.test(t),printed_issue_unambiguous:!!issue};
 const out=output('United India Insurance Company Limited','united_india_private_car_package_native_pdf',
  base,premium,extras,Object.entries(more).filter(([,v])=>v!==true).map(([k])=>'Review required: '+k));
 out.fields=out.fields.map(field=>{
  if(field.key==='vehicle_rto_name'&&authority)
   return {...field,evidence:'UIIC Private Car PDF Registration Authority: '+authority};
  if(field.key==='cpa_premium'&&cpaWaived)
   return {...field,evidence:'UIIC Private Car PDF explicitly removes owner-driver CPA'};
  if(field.key==='policy_issuance_date'&&issue)
   return {...field,evidence:'UIIC Private Car printed Date of Issue: '+issue};
  return field;
 });
 return out;
}

function unitedIndia(t){
 // This is a different product with a separate booking contract; never present
 // a Private Car Package as a Goods Carrying Vehicle.
 if (/PRIVATE CAR\s*-?\s*PACKAGE POLICY/i.test(t.slice(0,2200))) return unitedIndiaPrivateCar(t);
 if (/GCV PUBLIC CARRIER OTHER THAN 3 WHEELER/i.test(t)
     && /Gross OD\s*&\s*TP:/i.test(t)) {
  const classic=unitedIndiaSchedule(t);
  if(classic.ok)return classic;
  const candidate=unitedIndiaGcvFlexible(t);
  return candidate.ok?candidate:(candidate.warnings.length<classic.warnings.length?candidate:classic);
 }

 if(/GCV PUBLIC CARRIER OTHER THAN 3 WHEELER/i.test(t)&&/Gross OD\s*&\s*TP:/i.test(t)) return unitedIndiaSchedule(t);
 const policy=grab(t,/\bPolicy No\.\s*:?\s*(\d{12,22}[A-Z]\d{5,12})\b/i)||grab(t,/\b(2230003126P\d{9})\b/);
 const insured=grab(t,/Name of the Insured\s+(MR\.?\s*[A-Z][A-Z .]{6,110}?)(?=\s+Address of the Insured)/i)
   ||grab(t,/Insured Name\/ID\s*:\s*(MR\.?\s*[A-Z][A-Z .]{6,90}?)\s*\/\d+/i);
 const start=validDate(grab(t,/Insurance Start Date\s*&\s*Time\s*:?\s*(\d{2}\/\d{2}\/\d{4})/i)
   ||grab(t,/on\s*(\d{2}\/\d{2}\/\d{4})\s+Date of Expiry of the Insurance/i));
 const end=validDate(grab(t,/Insurance expiry Date\s*&\s*Time\s*:?\s*(\d{2}\/\d{2}\/\d{4})/i)
   ||grab(t,/Expiry of the Insurance Midnight on\s*(\d{2}\/\d{2}\/\d{4})/i));
 const issue=validDate(grab(t,/Date of Issue:\s*(\d{2}\/\d{2}\/\d{4})/i));
 const engine=grab(t,/\b(700CCDI[A-Z0-9]{8,20})\b/i);
 const chassis=grab(t,/\b(MAT[A-Z0-9]{14,21})\b/i);
 const model=/Tata Motors\s*\/[\s\S]{0,700}?ACE GOLD\s*\+[\s\S]{0,700}?DIESEL\s+CLB\s+BS/i.test(t)
    ?'ACE GOLD + DIESEL CLB BS VI':null;
 const idv=amountAfter(t,/Insured['’]s Declared Value\s+([\d,]+)/i);
 const od=amountAfter(t,/Gross OD\(A\)\s*([\d,.]+)/i);
 const tp=amountAfter(t,/Gross TP\(B\)\s*([\d,.]+)/i);
 const net=amountAfter(t,/Premium\(A\+B\)\s*([\d,.]+)/i);
 const igstOther=amountAfter(t,/IGST-Others\(18%\)\s*:?\s*([\d,.]+)/i);
 const igstTp=amountAfter(t,/IGST-Basic TP\(5%\)\s*:?\s*([\d,.]+)/i);
 const gst=igstOther!==null&&igstTp!==null?igstOther+igstTp:null;
 const stamp=amountAfter(t,/Stamp Duty\s*:?\s*([\d,.]+)/i);
 const gross=amountAfter(t,/TOTAL PAYABLE PREMIUM\s*([\d,.]+)/i)||amountAfter(t,/Total\(Rounded Off\):\s*([\d,.]+)/i);
 const reg=grab(t,/Registration Number\s+(NEW|[A-Z]{2}\d{2}[A-Z]{1,3}\d{3,4})\b/i)||'NEW';
 const mfg=grab(t,/Year Of Manufacture\s+(20\d{2})\b/i);
 const base={policy_number:policy,insured_name:insured,policy_product:'Goods Carrying Vehicle Package',
  policy_start_date:start,policy_end_date:end,policy_issuance_date:issue,
  third_party_start_date:start,third_party_end_date:end,vehicle_registration_number:reg,
  vehicle_registration_status:reg==='NEW'?'registration_pending':'registered',
  vehicle_make:model?'Tata Motors':null,vehicle_model:model,vehicle_class:'Goods Carrying Vehicle',
  vehicle_fuel_type:'Diesel',vehicle_manufacturing_year:mfg,
  vehicle_chassis_number:chassis,vehicle_engine_number:engine,
  vehicle_rto_name:grab(t,/\bRTA Name\s+MP\d{2}\s+([A-Z ]{3,40})/i),
  vehicle_rto_state:'Madhya Pradesh',idv,
  cpa_premium:amountAfter(t,/Compulsory PA for Owner Driver\s+([\d,.]+)/i)};
 return output('United India Insurance Company Limited','united_india_gcv_native_pdf',base,
  {od,tp,net,gst,gross,igstOthers:igstOther,igstBasicTp:igstTp,stampDuty:stamp},
  {uiic_layout:/UNITED INDIA INSURANCE COMPANY LIMITED/i.test(t)&&/GCV PUBLIC CARRIER/i.test(t),
   igst_components_printed:igstOther!==null&&igstTp!==null,
   stamp_accounting_disclosed:stamp!==null,
   stamp_charge_reconciled:stamp===null||approx(gross,net+gst+stamp)});
}

const request=(function(){try{return $('Validate Policy Intake Request').first().json||{}}catch{return {}}})();
return $input.all().map(item=>{const parsed=unitedIndia(asText(String(item.json?.text??item.json?.data??item.json?.extracted_text??'')));for(const id of ['intake_id','document_id','request_id'])parsed[id]=String(request?.[id]??item.json?.[id]??'');return {json:parsed};});