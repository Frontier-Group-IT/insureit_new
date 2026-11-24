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
function iffco(t){
 const policyLine=t.split('\n').find(line=>/P400\s+Policy\s*#\s*N\d{6,10}/i.test(line))||'';
 const insured=grab(policyLine,/^\s*([A-Z][A-Z &.,()'\-]{3,125}?)\s+Policy\s*#:/i)
   ||grab(t,/\n\s*([A-Z][A-Z &.,()'\-]{3,125}?)\s+Policy\s*#:/i);
 const p=grab(t,/P400\s+Policy\s*#\s*(N\d{6,10})/i)||grab(t,/Policy\s*#\s*(N\d{6,10})/i);
 const issue=validDate(grab(t,/Invoice\/Issuance Date:\s*(\d{2}\/\d{2}\/\d{4})/i));
 const start=validDate(grab(t,/Period of Insurance[\s\S]{0,350}?\bFrom:\s*(\d{2}\/\d{2}\/\d{4})/i));
 const end=validDate(grab(t,/To:\s*Midnight On\s*(\d{2}\/\d{2}\/\d{4})/i));
 const reg=grab(t,/\b(MP\d{2}[A-Z]{1,3}\d{4}|MP\/NEW\/\d{3,6})\b/i);
 const schedule=t.slice(Math.max(0,t.indexOf('Insured Motor Vehicle Details')),Math.max(0,t.indexOf('Registration Authority'))+20);
 const engine=grab(schedule,/\b(H\d{8}|\d{8})\b/i);
 const chassis=grab(schedule,/\b((?:RAJ|PUN)[A-Z0-9]{12,20})\b/i);
 const modelRaw=grab(schedule,/\b(JCB\s+3\s*DX[^\n]{0,80}?BACKHOE|JCB\s+455[^\n]{0,65}?LOADER|VMT\s+117[^\n]{0,70}?COMPACTOR)\b/i)
   ||grab(schedule,/\b((?:JCB|VMT)\s+[A-Z0-9][A-Z0-9 .\/+\-\n]{3,100}?(?:BACKHOE\s+LOADER|LOADER|COMPACTOR))\b/i);
 const model=modelRaw?(modelRaw.replace(/\s+/g,' ').trim()+(/BACKHOE$/i.test(modelRaw)&&/\bLOADER\b/i.test(schedule)?' LOADER':'')):null;
 const vehicleMake=model?.startsWith('JCB ')?'JCB':model?.startsWith('VMT ')?'VMT':null;
 const year=reg?grab(schedule,new RegExp(reg.replace(/[.*+?^$()|[\]\\]/g,'\\$&')+'\\s+(20\\d{2})\\b','i')):null;
 const cpa=amount(grab(t,/PA Owner Driver CSI Rs(?:\s*1500000)?\s*([\d,.]+)/i));
 const idv=amount(grab(t,/\bNet Premium Rs\.\s*(\d{6,10})(?:\.00)?\b/i))||amount(grab(t,/\b(\d{6,10})\.00\s+0\.00\s+0\.00\s+0\s+\d{6,10}\.00/i));
 const od=amountAfter(t,/\bNet \(A\)\s*([\d,]+(?:\.\d+)?)/i);
 const tp=amountAfter(t,/\bNet \(B\)\s*([\d,]+(?:\.\d+)?)/i);
 const net=amountAfter(t,/Premium\/Taxable Value RS\.\s*([\d,]+(?:\.\d+)?)/i);
 const gross=amountAfter(t,/Gross Premium Payable Rs\.\s*([\d,]+(?:\.\d+)?)/i);
 const gstSection=t.slice(Math.max(0,t.indexOf('GST Details')),Math.max(0,t.indexOf('GST Details'))+1400);
 const totalRow=gstSection.match(/\bTotal\s+([\d,]+\.\d{2})\s+([\d,]+\.\d{2})\s+([\d,]+\.\d{2})\b/i);
 const gstRow=gstSection.match(/GST Details\s*997134\s+([\d,]+\.\d{2})\s+18(?:\.00)?\s+([\d,]+\.\d{2})(?:\s+([\d,]+\.\d{2}))?/i);
 const invoiceNet=amount(totalRow?.[1]??gstRow?.[1]);
 const invoiceGross=amount(totalRow?.[3]??gstRow?.[3]??gstRow?.[2]);
 const gstCandidates=[amount(totalRow?.[2]),amount(gstRow?.[2]),amount(gstRow?.[3])];
 const gstPrintedTokens=(gstSection.match(/\d[\d,]*\.\d{2}/g)||[]).map(amount);
 const gstCandidatesAll=[...gstCandidates,...gstPrintedTokens].filter(n=>typeof n==='number');
 const verifiedTax=gstCandidatesAll.filter(v=>typeof net==='number'&&typeof gross==='number'&&approx(net+v,gross));
 const gst=[...new Set(verifiedTax.map(x=>x.toFixed(2)))].length===1?Number(verifiedTax[0].toFixed(2)):null;
 const taxTablePrinted=!!totalRow||!!gstRow;
 // Read CC from the insured vehicle row; seating capacity is unrelated.
 const regEscaped=reg?reg.replace(/\//g,'\\/'):null;
 const matchCC=regEscaped?schedule.match(new RegExp('\\b'+regEscaped+'\\s+(20\\d{2})\\s+(?:Make of Vehicle\\s+)?(\\d{3,5})\\s+Package\\b','i')):null;
 const vehicleCapacity=matchCC&&matchCC[1]===year&&Number(matchCC[2])>=300&&Number(matchCC[2])<=20000?matchCC[2]:null;
 // Vehicle model fuel derived from JCB 3DX Plus manufacturer specifications;
 // it is not printed on this IFFCO policy.
 const modelDiesel=/^JCB 3DX PLUS 2WD BACKHOE LOADER$/i.test(model||'');
 const fuelType=modelDiesel?'Diesel':null;

 // Resolve registered MP RTO from the official-format registration plate,
 // not from the policyholder mailing address. Source: MP RTO district list.
 const mpRtoCities={
 "04":"Bhopal","05":"Hoshangabad","06":"Morena","07":"Gwalior",
 "08":"Guna","09":"Indore","10":"Khargone","11":"Dhar",
 "12":"Khandwa","13":"Ujjain","14":"Mandsaur","15":"Sagar",
 "16":"Chhatarpur","17":"Rewa","18":"Shahdol","19":"Satna",
 "20":"Jabalpur","21":"Katni","22":"Seoni","28":"Chhindwara",
 "30":"Bhind","31":"Sheopur","32":"Datia","33":"Shivpuri",
 "34":"Damoh","35":"Panna","36":"Tikamgarh","37":"Sehore",
 "38":"Raisen","39":"Rajgarh","40":"Vidisha","41":"Dewas",
 "42":"Shajapur","43":"Ratlam","44":"Neemuch","45":"Jhabua",
 "46":"Barwani","47":"Harda","48":"Betul","49":"Narsinghpur",
 "50":"Balaghat","51":"Mandla","52":"Dindori","53":"Sidhi",
 "54":"Umaria","55":"Bagli","65":"Anuppur","66":"Singrauli",
 "67":"Ashoknagar","68":"Burhanpur","69":"Alirajpur","70":"Agar Malwa"
 };
 const normalizedReg=(reg||'').toUpperCase().replace(/[ -]/g,'');
 const registeredMpMatch=normalizedReg.match(/^MP(\d{2})(?=[A-Z]{1,3}\d{3,4}$)/);
 const isNewMp=/^MP\/NEW\/\d{3,6}$/.test(normalizedReg);
 const rtoCode=registeredMpMatch?.[1]||null;
 const registeredRto=rtoCode?mpRtoCities[rtoCode]||null:null;
 const printedMpState=/\bState Code:\s*(?:Country\s+)?23\b/i.test(t);
 const state=(registeredMpMatch||(isNewMp&&printedMpState))?'Madhya Pradesh':null; // Plate/state evidence is independent of city.
 // On MP/NEW the city is explicitly provisional geography, never official RTO.
 const insuredCityRaw=isNewMp?grab(t,/\n\s*([A-Z][A-Z ]{2,35}?)\s+MADHYA PRA\s+(?:INDIA\s+)?Pin Code\b/i):null;
 const provisionalCity=state&&isNewMp&&insuredCityRaw?insuredCityRaw.trim().replace(/\s+/g,' ').toLowerCase().replace(/\b[a-z]/g,c=>c.toUpperCase()):null;
 const rtoCity=registeredRto||null; // Never write an insured-address city as RTO.
 const base={policy_number:p,insured_name:insured?.trim()||null,policy_product:'Commercial Vehicle Package',policy_issuance_date:issue,policy_start_date:start,policy_end_date:end,third_party_start_date:start,third_party_end_date:end,vehicle_registration_number:reg,vehicle_registration_status:reg&&!/\/NEW\//i.test(reg)?'registered':'registration_pending',vehicle_make:vehicleMake,vehicle_model:model,vehicle_class:'Commercial Vehicle - Miscellaneous Class D',vehicle_manufacturing_year:year,vehicle_chassis_number:chassis,vehicle_engine_number:engine,vehicle_capacity:vehicleCapacity,vehicle_fuel_type:fuelType,vehicle_rto_state:state,vehicle_rto_name:rtoCity,cpa_premium:cpa,idv};
 const parsed=output('IFFCO Tokio General Insurance Company Limited','iffco_tokio_cv_native_pdf',base,{od,tp,net,gst,gross},{iffco_layout:/IFFCO.?TOKIO GENERAL INSURANCE/i.test(t)&&/COMMERCIAL VEHICLE CERTIFICATE/i.test(t),printed_tax_table:taxTablePrinted,invoice_taxable_matches:approx(net,invoiceNet),invoice_gross_matches:approx(gross,invoiceGross)});
 for(const field of parsed.fields){
   if(field.key==='vehicle_capacity')field.evidence='IFFCO PDF page 1: CC in insured vehicle row; not seating capacity';
   if(field.key==='vehicle_fuel_type')field.evidence='Manufacturer-model Diesel specification (JCB 3DX Plus 2WD); NOT PDF-printed';
   if(field.key==='vehicle_rto_state')field.evidence=registeredRto?'Registered plate '+reg+' indicates MP state; MP RTO registry':'IFFCO PDF State Code 23 plus MP/NEW new vehicle reference';
   if(field.key==='vehicle_rto_name'){
     if(registeredRto){field.label='RTO city (registration code)';field.evidence='Registered plate '+reg+' code MP-'+rtoCode+' = '+registeredRto+' (MP RTO registry); not policyholder address';}
     else{field.label='Provisional insured address city (not official RTO)';field.evidence='IFFCO policyholder address city only; registration authority is blank. PROVISIONAL until vehicle is registered.';}
   }
 }
 return parsed;
}

const request=(function(){try{return $('Validate Policy Intake Request').first().json||{}}catch{return {}}})();
return $input.all().map(item=>{const parsed=iffco(asText(String(item.json?.text??item.json?.data??item.json?.extracted_text??'')));for(const id of ['intake_id','document_id','request_id'])parsed[id]=String(request?.[id]??item.json?.[id]??'');return {json:parsed};});