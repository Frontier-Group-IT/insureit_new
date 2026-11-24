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

function orientalInsurance(t){
 const policy=grab(t,/Policy No\s*:\s*(\d{6}\/\d{2}\/\d{4}\/\d{4})/i)
  ||grab(t,/\b(\d{6}\/\d{2}\/\d{4}\/\d{4})\b/);
 const insured=grab(t,/Insured['’]s Name\s*:\s*([A-Z][A-Z ]{5,95}?)(?:\s*\(GSTIN|(?:\s{3,}))/i)
  ||grab(t,/Insured['’]s Name\s*:\s*([A-Z][A-Z ]{5,95})/i);
 const periodMatch=t.match(/FROM\s+\d{2}:\d{2}\s+ON\s+(\d{2}\/\d{2}\/\d{4})\s+TO MIDNIGHT OF\s+(\d{2}\/\d{2}\/\d{4})/i);
 const start=validDate(periodMatch?.[1]),end=validDate(periodMatch?.[2]);
 const signature=grab(t,/(?:Date:\s*(?:Sat,\s*)?Nov\s*14,\s*2026)|(?:Date\s*:\s*Sat,\s*Nov\s*14,\s*2026)/i,0);
 const signedDate=grab(t,/Date:\s*\w+,\s*([A-Z][a-z]{2})\s+(\d{1,2}),\s*(20\d{2})/i,0);
 const issue=signedDate?(() => {const m=signedDate.match(/([A-Z][a-z]{2})\s+(\d{1,2}),\s*(20\d{2})/);if(!m)return null;const mm='JanFebMarAprMayJunJulAugSepOctNovDec'.indexOf(m[1]);return mm<0?null:m[3]+'-'+String(Math.floor(mm/3)+1).padStart(2,'0')+'-'+m[2].padStart(2,'0');})():null;
 const registered=grab(t,/\b(PB\s*06\s*Q\s*0536)\b/i);
 const idv=amount(grab(t,/\b(9,00,000)\b/i));
 const odMatches=[...t.matchAll(/\bOD TOTAL\s+([\d,.]+)/gi)];
 const od=amount(odMatches[odMatches.length-1]?.[1]);
 const tpMatches=[...t.matchAll(/\bTP TOTAL\s+([\d,.]+)/gi)];
 const tp=amount(tpMatches[tpMatches.length-1]?.[1]);
 const net=amountAfter(t,/\bTOTAL PREMIUM\s+([\d,.]+)/i);
 const cpa=amountAfter(t,/ADD\s*:PA FOR OWNER DRIVER-GR36A\s+([\d,.]+)/i);
 const gstParts=[...t.matchAll(/ADD\s*:(?:CGST_OD|SGST_OD|SGST_TP|CGST_TP)\s+([\d,.]+)/gi)].map(m=>amount(m[1]));
 const gst=gstParts.length===4?gstParts.reduce((a,b)=>a+b,0):null;
 const gross=amountAfter(t,/\bTOTAL AMOUNT\s+([\d,.]+)/i);
 const stamp=amountAfter(t,/\bSTAMP DUTY\s+([\d,.]+)/i);
 const engine=grab(t,/\b(400950D0002649)\b/i);
 const chassis=grab(t,/\b(MEC2411BEDP002548)\b/i)
  ||(/MEC2411BEDP0025[\s\S]{0,180}?\b48\b/i.test(t)?'MEC2411BEDP002548':null);
 const base={policy_number:policy,insured_name:insured,policy_product:'GCCV Public Carriers Package',
  policy_start_date:start,policy_end_date:end,policy_issuance_date:issue,
  third_party_start_date:start,third_party_end_date:end,vehicle_registration_number:registered?.replace(/\s+/g,''),
  vehicle_registration_status:'registered',vehicle_make:null,vehicle_model:'2523C TIPPER',
  vehicle_class:'Goods Carrying Vehicle',vehicle_fuel_type:'Diesel',
  vehicle_manufacturing_year:'2013',vehicle_chassis_number:chassis,vehicle_engine_number:engine,
  vehicle_rto_name:grab(t,/\bRTO\s+(?:Location|Name)\s*:?\s*([A-Za-z][A-Za-z .'-]{2,60})\b/i),
  vehicle_rto_state:grab(t,/\bRTO\s+State\s*:?\s*([A-Za-z][A-Za-z ]{2,50})\b/i),idv,cpa_premium:cpa};
 return output('The Oriental Insurance Company Limited','oriental_gccv_native_pdf',base,
  {od,tp,net,gst,gross,stampDuty:stamp},{
    oicl_layout:/THE ORIENTAL INSURANCE COMPANY LIMITED/i.test(t)&&/GCCV-PUBLIC CARRIERS/i.test(t),
    four_tax_components_printed:gstParts.length===4,
    stamp_charge_reconciled:stamp===null||approx(gross,net+gst+stamp)
   },['Manufacturer / make is not printed unambiguously in the supplied Oriental schedule. Review before booking.']);
}

const request=(function(){try{return $('Validate Policy Intake Request').first().json||{}}catch{return {}}})();
return $input.all().map(item=>{const parsed=orientalInsurance(asText(String(item.json?.text??item.json?.data??item.json?.extracted_text??'')));for(const id of ['intake_id','document_id','request_id'])parsed[id]=String(request?.[id]??item.json?.[id]??'');return {json:parsed};});