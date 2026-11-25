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
  const whitelist=new Set(['policy_number','insurer_name','policy_product','insured_name','vehicle_registration_status','vehicle_registration_number','vehicle_class','vehicle_make','vehicle_model','vehicle_fuel_type','vehicle_manufacturing_year','vehicle_capacity','vehicle_chassis_number','vehicle_engine_number','vehicle_rto_name','vehicle_rto_state','idv','policy_start_date','policy_end_date','policy_issuance_date','third_party_start_date','third_party_end_date','od_premium','tp_premium','cpa_premium']);
  const values={insurer_name:issuer,...base,od_premium:premium.od,tp_premium:premium.tp};
  const fields=Object.entries(values).filter(([k,v])=>whitelist.has(k)&&v!==null&&v!==undefined&&v!=='').map(([key,value])=>({key,label:key,value:String(value),confidence:null,page:null,evidence:'Native PDF policy schedule'}));
  return {contract_version:'1',ok,validation_passed:ok,parser_id:parserId,parser_version:'non-tata-cv-v2',extraction_method:'native_pdf_text',review_required:true,auto_finalize_allowed:false,checks,warnings:[...warnings,...problems.map(k=>'Review required: '+k)],fields,premium_components:premium,error_code:ok?undefined:'needs_review_or_unsupported'};
}
function newIndia(t){
 const p=grab(t,/\bPolicy Number\s*:\s*(\d{20})\b/i);
 const insured=grab(t,/Insured['’]s Name\s*\n\s*([^\n]{3,100})/i)||grab(t,/Insured['’]s Name\s+(.+?)\s+Customer ID/i);
 const cleanInsured=insured?.replace(/\s+\.$/,'').replace(/\s{2,}.+$/,'').trim()||null;
 const [start,end]=period(t);
 const issue=validDate(grab(t,/Date of Issue\s*:\s*(\d{2}\/\d{2}\/\d{4})/i));
 const reg=grab(t,/\bRegistration no\.\s*([A-Z]{2}[- ]?\d{2}(?:[- ][A-Z]{1,3})?(?:[- ]?\d{1,4})?)/i);
 const makeModel=(grab(t,/Make\/Model:\s*\n\s*([^\n]+?\s*\/\s*[^\n]+)/i)||grab(t,/Make\/Model:\s*([^\n]{4,130}?)\s+Registration no\./i)||'').trim();
 const mm=makeModel.match(/^([^\n\/]{2,40})\s*\/\s*([^\n]{2,65})/);
 let model=mm?.[2]?.trim()||null;
 if(model && /\s{3,}/.test(model))model=model.split(/\s{3,}/)[0];
 let chassis=null,engine=null;
 const lines=t.split('\n'); const idx=lines.findIndex(l=>/Chassis no\.\/Engine no\./i.test(l));
 if(idx>=0){
  let tail=lines[idx].split(/Chassis no\.\/Engine no\.\s*:/i)[1]?.trim()||'';
  const candidates=[tail,...lines.slice(idx+1,idx+5).map(l=>l.trim())];
  const firstIdx=candidates.findIndex(l=>/\b[A-Z0-9]{13,20}\s*\/\s*[A-Z0-9.]{2,25}/i.test(l));
  if(firstIdx>=0){const pair=candidates[firstIdx].match(/\b([A-Z0-9]{13,20})\s*\/\s*([A-Z0-9.]{2,25})/i);if(pair){chassis=pair[1];engine=pair[2];for(let i=firstIdx+1;i<candidates.length;i++){const line=candidates[i];if(!/^[A-Z0-9.]{1,23}$/i.test(line)||engine.length>=32)break;engine+=line;}}}
 }
 const idvStart=t.indexOf('INSURED DECLARED VALUE (Rs)'); const idvSection=idvStart>=0?t.slice(idvStart,idvStart+550):'';
 const idv=cashGroup(idvSection, /\bTotal Value\s*\n\s*(\d{5,9})/i) ?? cashGroup(idvSection,/\b(\d{5,9})\s+0\s+0\s+(?:0\s+)?\d{5,9}/i);
 const od=amountAfter(t,/\bTotal OD Premium\s*\(Rs\)\s*([\d,]+(?:\.\d+)?)/i);
 const tp=amountAfter(t,/\bTotal TP Premium\s*\(Rs\)\s*([\d,]+(?:\.\d+)?)/i);
 const net=amountAfter(t,/\bNet Premium\s*\(Rs\)\s*([\d,]+(?:\.\d+)?)/i);
 const gst=amountAfter(t,/\bGST\s*\(Rs\)\s*([\d,]+(?:\.\d+)?)/i);
 const gross=amountAfter(t,/\bTotal Payable\s*\(Rs\)\s*([\d,]+(?:\.\d+)?)/i);
 const isRegistered=plate(reg);
 // Business rule: an RTO-only prefix (e.g. MP-20 or HR-00) on a New India
 // policy indicates a NEW UNREGISTERED vehicle, never a partial registered plate.
 const hasUnregisteredPrefix=!!reg && /^(?:MP|HR)-?\d{2}$/i.test(reg);
 const registrationVerified=isRegistered || hasUnregisteredPrefix;
 const year=grab(t,/Year of manufacture:\s*(20\d{2})/i);
 const fuel=grab(t,/Type of fuel:\s*(Diesel|Petrol|CNG|Electric)/i);
 const rto=grab(t,/Name of registration\s*(?:authority:\s*)?\n\s*([^\n]{3,80})/i)||null;
 const state=reg?.startsWith('MP')?'Madhya Pradesh':reg?.startsWith('HR')?'Haryana':null;
 const base={policy_number:p,insured_name:cleanInsured,policy_product:/Enhanced Covers/i.test(t.slice(0,450))?'Commercial Vehicle Package Policy Enhanced Covers':'Commercial Vehicle Package Policy',policy_start_date:start,policy_end_date:end,policy_issuance_date:issue,third_party_start_date:start,third_party_end_date:end,vehicle_registration_number:reg,vehicle_registration_status:isRegistered?'registered':hasUnregisteredPrefix?'unregistered':'registration_pending',vehicle_make:mm?.[1]?.trim()||null,vehicle_model:model,vehicle_class:'Commercial Vehicle - Goods Carrying',vehicle_fuel_type:fuel,vehicle_manufacturing_year:year,vehicle_rto_state:state,vehicle_rto_name:rto,vehicle_chassis_number:chassis,vehicle_engine_number:engine,idv,vehicle_capacity:grab(t,/Gross Vehicle Weight\s*(?:\(GVW\))?:\s*(\d{3,6})/i)};
 const premium={od,tp,net,gst,gross,tax_basis:'Printed mixed-rate tax, never inferred from OD/TP alone'};
 return output('The New India Assurance Company Limited','new_india_cv_native_pdf',base,premium,{nia_layout:/THE NEW INDIA ASSURANCE CO\. LTD\./i.test(t),registration_complete:registrationVerified},registrationVerified?[]:['Registration evidence is missing or is not a recognized unregistered RTO prefix.']);
}
function cashGroup(t,re){return amount(grab(t,re));}
function iffco(t){
 const insured=grab(t,/\n\s*([A-Z][A-Z &.,()\-]{7,125})\s*\nPolicy\s*#:/m)||grab(t,/\n\s*([A-Z][A-Z &.,()\-]{7,125}?)\s{2,}Policy\s*#:/m);
 const p=grab(t,/P400\s+Policy\s*#\s*(N\d{6,10})/i)||grab(t,/Policy\s*#\s*(N\d{6,10})/i);
 const issue=validDate(grab(t,/Invoice\/Issuance Date:\s*(\d{2}\/\d{2}\/\d{4})/i));
 const start=validDate(grab(t,/Period of Insurance[\s\S]{0,350}?\bFrom:\s*(\d{2}\/\d{2}\/\d{4})/i));
 const end=validDate(grab(t,/To:\s*Midnight On\s*(\d{2}\/\d{2}\/\d{4})/i));
 const reg=grab(t,/\b(MP\d{2}[A-Z]{1,3}\d{4})\b/i);
 const engine=grab(t,/\b(H\d{8})\b/i);
 const chassis=grab(t,/\b(RAJ3DX[A-Z0-9]{10,20})\b/i);
 const modelEvidence=/JCB\s+3\s+DX[\s\S]{0,120}?2WD\s*\/\s*BACKHOE/i.test(t);
 const year=grab(t,/\bMP\d{2}[A-Z]{1,3}\d{4}\s+(20\d{2})\b/i)||null;
 const idv=amount(grab(t,/\bNet Premium Rs\.\s*(\d{6,10})(?:\.00)?\b/i))||amount(grab(t,/\b(\d{6,10})\.00\s+0\.00\s+0\.00\s+0\s+\d{6,10}\.00/i));
 const od=amountAfter(t,/\bNet \(A\)\s*([\d,]+(?:\.\d+)?)/i);
 const tp=amountAfter(t,/\bNet \(B\)\s*([\d,]+(?:\.\d+)?)/i);
 const net=amountAfter(t,/Premium\/Taxable Value RS\.\s*([\d,]+(?:\.\d+)?)/i);
 const gross=amountAfter(t,/Gross Premium Payable Rs\.\s*([\d,]+(?:\.\d+)?)/i);
 const taxMatch=t.match(/GST Details\s*997134\s*([\d,.]+)\s+18(?:\.00)?\s+([\d,.]+)\s+([\d,.]+)/i);
 const gstSection=t.slice(Math.max(0,t.indexOf('GST Details')),Math.max(0,t.indexOf('GST Details'))+1000);
 const taxTotals=gstSection.match(/\bTotal\s+([\d,.]+)\s+([\d,.]+)\s+([\d,.]+)/i);
 const invoiceNet=taxMatch?amount(taxMatch[1]):taxTotals?amount(taxTotals[1]):null;
 const invoiceGross=taxMatch?amount(taxMatch[3]):taxTotals?amount(taxTotals[3]):null;
 const gst=taxMatch?amount(taxMatch[2]):taxTotals?amount(taxTotals[2]):null;
 const base={policy_number:p,insured_name:insured?.trim()||null,policy_product:'Commercial Vehicle Package',policy_issuance_date:issue,policy_start_date:start,policy_end_date:end,third_party_start_date:start,third_party_end_date:end,vehicle_registration_number:reg,vehicle_registration_status:reg?'registered':'registration_pending',vehicle_make:modelEvidence?'JCB':null,vehicle_model:modelEvidence?'3 DX 2WD / BACKHOE LOADER':null,vehicle_class:'Commercial Vehicle - Miscellaneous Class D',vehicle_manufacturing_year:year,vehicle_chassis_number:chassis,vehicle_engine_number:engine,idv};
 return output('IFFCO Tokio General Insurance Company Limited','iffco_tokio_cv_native_pdf',base,{od,tp,net,gst,gross},{iffco_layout:/IFFCO.?TOKIO GENERAL INSURANCE/i.test(t)&&/COMMERCIAL VEHICLE CERTIFICATE/i.test(t),printed_tax_table:!!(taxMatch||taxTotals),invoice_taxable_matches:approx(net,invoiceNet),invoice_gross_matches:approx(gross,invoiceGross)});
}
function digit(t){
 const id=grab(t,/Policy No\.\s*(D\d{8,12})/i)||grab(t,/Policy No:\s*(D\d{8,12})/i);
 // Preserve both previously working, titled-name forms unchanged.
 // Only the new untitled/multiline JCB fallback requires a nearby printed
 // Vehicle Registration No. label; never guess insured from broker/financier.
 const name=grab(t,/\bName\s+((?:MR|MRS|MS)\s+[^\n]{5,80}?)\s+Vehicle Registration No\./i)
   ||grab(t,/\bName\s*\n\s*((?:MR|MRS|MS)\s+[^\n]{5,80})/i)
   ||grab(t,/^Name[ \t]+([A-Z][A-Z0-9 .&'()\/-]{3,90}?)[ \t]+Vehicle Registration No\./im)
   ||grab(t,/^Name[ \t]*\n[ \t]*([A-Z][A-Z0-9 .&'()\/-]{3,90}?)[ \t]*\n[ \t]*Vehicle Registration No\./im);
 const reg=grab(t,/Vehicle Registration No\.\s*([A-Z]{2}\d{2}[A-Z]{1,3}\d{3,4})/i)||grab(t,/Vehicle Registration No\.\s*\n\s*([A-Z]{2}\d{2}[A-Z]{1,3}\d{3,4})/i);
 let issue=validDate(grab(t,/Policy Issue Date\s+(\d{2}-[A-Za-z]{3}-\d{4})/i));
 let start=validDate(grab(t,/\bFrom\s+(\d{2}-[A-Za-z]{3}-\d{4})\s*00:\d{2}:\d{2}/i));
 let end=validDate(grab(t,/\bTo\s+(\d{2}-[A-Za-z]{3}-\d{4})\s*\d{2}:\d{2}/i));
 if(!issue||!start||!end){const window=t.slice(Math.max(0,t.indexOf('YOUR POLICY DETAILS')),Math.max(0,t.indexOf('YOUR VEHICLE DETAILS')));const dates=Array.from(window.matchAll(/\b\d{2}-[A-Za-z]{3}-\d{4}\b/g)).map(m=>validDate(m[0])); if(dates.length>=4&&dates[2]===dates[3]&&dates[0]&&dates[1]){start=start||dates[0];end=end||dates[1];issue=issue||dates[2];}}
 start=start||validDate(grab(t,/(\d{2}-[A-Za-z]{3}-\d{4})\s+00:\d{2}:\d{2}/i));
 end=end||validDate(grab(t,/(\d{2}-[A-Za-z]{3}-\d{4})\s+23:\d{2}:\d{2}/i));
 const section=t.slice(Math.max(0,t.indexOf('YOUR POLICY DETAILS')),Math.max(0,t.indexOf('YOUR VEHICLE IDV')));
 const make=/\bJCB\b/.test(section)?'JCB':null;
 // Preserve existing ECO XPERT; the distinct 2WD/Backhoe Loader is
 // explicitly printed inside the Go Digit JCB vehicle detail block.
 const model=/DX\s*ECO\s*XPERT/i.test(section)&&/BACKHOE\s*LOADER/i.test(section)
   ?'3 DX ECO XPERT / BACKHOE LOADER'
   :/\b3\s*DX\s*2WD\s*\/\s*BACKHOE\s+LOADER\b/i.test(section)
     ?'3 DX 2WD / BACKHOE LOADER':null;
 const engine=grab(t,/Engine No\.\s*(H\d{8})/i)||grab(section,/\b(H\d{8})\b/i);
 // Native PDF reading order places the chassis BEFORE its heading.
 // RAJ and HAR are separate printed JCB 3DX chassis prefix variants.
 // The unlabeled-order fallback must be unambiguous in the vehicle block.
 const chassisCandidates=[...new Set([...section.matchAll(/\b((?:HAR|RAJ)3DX[A-Z0-9]{9,18})\b/gi)].map(m=>m[1].toUpperCase()))];
 const chassis=chassisCandidates.length>1?null:
   (grab(t,/Chassis No\.\s*((?:HAR|RAJ)3DX[A-Z0-9]{9,18})/i)
    ||(chassisCandidates.length===1?chassisCandidates[0]:null));
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
 const ncb=amountAfter(t,/NCB\s*\(45\s*%\)\(\x60?\)\s*([\d,.]+)/i);
 const tpBasic=amountAfter(t,/Basic Third-Party Liability\s*\(\x60?\)\s*([\d,.]+)/i);
 // Company policies may explicitly show '--' for owner-driver PA. Zero is
 // accepted only from that exact printed cell and an independently matching
 // TP sum; a missing/unknown PA cell stays null.
 const ownerCpaPrinted=grab(t,/PA cover for Owner-Driver\s*\(\x60?\)\s*(\d[\d,.]*|--)(?=\s|$)/i);
 const ownerCpa=ownerCpaPrinted==='--'?0:amount(ownerCpaPrinted);
 const paidDriver=amountAfter(t,/Legal Liability to Paid\s*\(\x60?\)\s*Driver\s*\(Persons:1\)\s*([\d,.]+)/i);
 const base={policy_number:id,insured_name:name,policy_product:'Digit Commercial Vehicle Insurance',policy_start_date:start,policy_end_date:end,policy_issuance_date:issue,third_party_start_date:start,third_party_end_date:end,vehicle_registration_number:reg,vehicle_registration_status:plate(reg)?'registered':'registration_pending',vehicle_make:make,vehicle_model:model,vehicle_class:'Commercial Vehicle - Miscellaneous Class D',vehicle_fuel_type:grab(section,/Fuel Type\s*(Diesel|Petrol|CNG|Electric)/i)||(/\bDiesel\b/i.test(section)?'Diesel':null),vehicle_chassis_number:chassis,vehicle_engine_number:engine,idv};
 const extra={digit_layout:/Go Digit General Insurance/i.test(t)&&/Digit Commercial Vehicle Insurance/i.test(t),registered_plate:plate(reg),od_basic_ncb:basicOd==null||ncb==null?true:approx(od,basicOd-ncb),tp_itemization:model==='3 DX 2WD / BACKHOE LOADER'?
   (tpBasic!==null&&ownerCpa!==null&&paidDriver!==null&&approx(tp,tpBasic+ownerCpa+paidDriver)):
   (tpBasic==null||ownerCpa==null||paidDriver==null?true:approx(tp,tpBasic+ownerCpa+paidDriver))};
 return output('Go Digit General Insurance Limited','go_digit_cv_native_pdf',base,{od,tp,net,gst:tax,gross},extra);
}
function parseNonTata(text){const t=asText(text);if(/THE NEW INDIA ASSURANCE CO\. LTD\./i.test(t)&&/Commercial Vehicle Package Policy/i.test(t))return newIndia(t);if(/IFFCO.?TOKIO GENERAL INSURANCE/i.test(t)&&/COMMERCIAL VEHICLE CERTIFICATE/i.test(t))return iffco(t);if(/Go Digit General Insurance/i.test(t)&&/Digit Commercial Vehicle Insurance/i.test(t))return digit(t);return output(null,'non_tata_unrecognized_native_pdf',{}, {},{supported_layout:false},['Unsupported insurer or policy layout; do not book automatically.']);}
if(typeof module!=='undefined')module.exports={parseNonTata};