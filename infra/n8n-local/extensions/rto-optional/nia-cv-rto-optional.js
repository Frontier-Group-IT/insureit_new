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
function newIndia(t){
 const p=grab(t,/\bPolicy Number\s*:\s*(\d{20})\b/i);
 const insured=grab(t,/Insured['’]s Name\s*\n\s*([^\n]{3,100})/i)||grab(t,/Insured['’]s Name\s+(.+?)\s+Customer ID/i);
 const cleanInsured=insured?.replace(/\s+\.$/,'').replace(/\s{2,}.+$/,'').trim()||null;
 const [start,end]=period(t);
 const issue=validDate(grab(t,/Date of Issue\s*:\s*(\d{2}\/\d{2}\/\d{4})/i));
 const reg=grab(t,/\bRegistration no\.\s*([A-Z]{2}[- ]?\d{2}(?:[- ][A-Z]{1,3})?(?:[- ]?\d{1,4})?)/i);
 const makeModel=(grab(t,/Make\/Model:\s*\n\s*([^\n]+?\s*\/\s*[^\n]+)/i)||grab(t,/Make\/Model:\s*([^\n]{4,80}?)\s+Registration no\./i)||'').trim();
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
 // The NIA commercial schedule prints Basic TP, owner-driver PA and
 // paid-driver LL as one liability column. Certify the printed amounts before
 // offering a CPA split to canonical Policy Onboarding.
 const liabilityBlock=grab(t,/Basic TP Premium\s*\n([\s\S]{0,650}?)\nCalculated OD Premium/i);
 const liabilityValues=liabilityBlock?.match(/\boprn\s*\n\s*([\d,.]+)\s*\n\s*([\d,.]+)\s*\n\s*([\d,.]+)/i);
 const basicTp=amount(liabilityValues?.[1]);
 const ownerCpa=amount(liabilityValues?.[2]);
 const paidDriverLl=amount(liabilityValues?.[3]);
 const liabilityLabels=!!liabilityBlock
   && /\(\+\)Compulsory PA Premium for Owner Driver/i.test(liabilityBlock)
   && /\(\+\)LL to paid driver conductor cleaner employed for/i.test(liabilityBlock);
 const liabilityReconciles=liabilityLabels && ownerCpa!==null && ownerCpa>0
   && basicTp!==null && paidDriverLl!==null && paidDriverLl>=0
   && approx(basicTp+ownerCpa+paidDriverLl,tp);
 // NIA's mixed-rate IGST is independently itemized: the 18% base includes
 // OD + owner-driver CPA + paid-driver LL, while the 5% base is Basic TP.
 // Never infer a tax percentage from a printed GST total.
 const taxBlock=grab(t,/Premium and GST Details\s*\n([\s\S]{0,600}?)(?:\nPÃ¡gina|\nPage \d+ of \d+|\nPolicy No\.)/i)||'';
 const taxLines=[...taxBlock.matchAll(/Premium\s+Rs\s*([\d,]+)\s+SGST\s+0\s+0\s+CGST\s+0\s+0\s+IGST\s+(18|5)\s+([\d,]+)/gi)]
   .map(m=>({base:amount(m[1]),rate:Number(m[2]),tax:amount(m[3])}));
 const eighteen=taxLines.filter(x=>x.rate===18),five=taxLines.filter(x=>x.rate===5);
 const mixedTaxVerified=taxLines.length===2 && eighteen.length===1 && five.length===1
   && liabilityReconciles
   && approx(eighteen[0].base,od+ownerCpa+paidDriverLl)
   && approx(five[0].base,basicTp)
   && approx(eighteen[0].base+five[0].base,net)
   && approx(eighteen[0].tax+five[0].tax,gst)
   && approx(Math.round(eighteen[0].base*.18),eighteen[0].tax,1)
   && approx(Math.round(five[0].base*.05),five[0].tax,1);
 const certifiedCpa=mixedTaxVerified?String(ownerCpa):null;
 const isRegistered=plate(reg);
 const hasUnregisteredPrefix=!!reg && /^(?:MP|HR)-?\d{2}$/i.test(reg);
 const registrationVerified=isRegistered || hasUnregisteredPrefix;
 const year=grab(t,/Year of manufacture:\s*(20\d{2})/i);
 const fuel=grab(t,/Type of fuel:\s*(Diesel|Petrol|CNG|Electric)/i);
 // The registration-authority cell may be empty. In NIA's column-major PDF
 // the next label is FASTag ID; never silently import a label as an RTO.
 // A valid authority must be printed on its own labelled cell/line.
 const rtoSameLine=grab(t,/Name of registration[ \t]*(?:\n[ \t]*)?authority:[ \t]*([^\n]*)/i);
 const rtoNextLine=grab(t,/Name of registration[ \t]*(?:\n[ \t]*)?authority:[ \t]*\n[ \t]*([^\n]{3,80})/i);
 // NIA's column-major schedule may interleave the right-hand value between
 // "Name of registration" and "authority:" on the following line.
 const rtoColumn=grab(t,/Name of registration[ \t]{2,}([A-Za-z][A-Za-z .,'-]{2,60}?[ \t]*-[ \t]*[A-Z]{2}[ \t-]*\d{2})[ \t]*\n[ \t]*authority:/i);
 const rtoRaw=(rtoColumn||rtoSameLine||rtoNextLine||'').trim();
 const authorityMatch=rtoRaw.match(/^([A-Za-z][A-Za-z .'-]{1,60}?)\s*[-–]\s*([A-Z]{2})\s*-?\s*(\d{2})$/i);
 const authorityCode=authorityMatch?authorityMatch[2].toUpperCase()+'-'+authorityMatch[3]:null;
 const registrationCode=reg?.replace(/\s+/g,'').toUpperCase().match(/^([A-Z]{2})-?(\d{2})/)?.slice(1).join('-')||null;
 const rtoCandidate=authorityMatch?authorityMatch[1].trim():rtoRaw;
 const rto=(!authorityCode||authorityCode===registrationCode)
   && /^[A-Za-z][A-Za-z .'-]{2,79}$/.test(rtoCandidate)
   && !/^(?:FASTag|Cover Note|Chassis|Engine|Vehicle|Registration|Year of manufacture|Type of|Goods Type|Name of|POLICY ISSUING OFFICE)/i.test(rtoCandidate)
   ?rtoCandidate:null;
 const state=reg?.startsWith('MP')?'Madhya Pradesh':reg?.startsWith('HR')?'Haryana':null;
 // Booking convenience ONLY, not an official registration authority.
 // Apply when NIA's authority cell is empty, the plate is prefix-only, and
 // the printed issuing-office state matches the prefix's state.
 const issuingOffices=[...t.matchAll(/POLICY ISSUING OFFICE:\s*\n\s*([A-Z][A-Z -]{2,49}?)\s+DO\s*\(\d{4,7}\)/gi)];
 const issuingOffice=issuingOffices.length===1?issuingOffices[0]:null;
 const officeCity=issuingOffice?issuingOffice[1].trim().replace(/\s+/g,' '):null;
 const officeContext=issuingOffice?t.slice(issuingOffice.index,Math.min(t.length,issuingOffice.index+390)):'';
 const officeState=officeContext.match(/\b(?:HARYANA|MADHYA PRADESH)\b/i)?.[0]?.toUpperCase()||'';
 const provisionalOfficeCity=(!rto&&hasUnregisteredPrefix&&state?.toUpperCase()===officeState
   &&officeCity&&/^[A-Z][A-Z -]{2,45}$/.test(officeCity))
   ?officeCity.toLowerCase().replace(/\b[a-z]/g,c=>c.toUpperCase()):null;
 const finalCity=rto; // Issuing office is not evidence of the registered RTO city.
 const base={policy_number:p,insured_name:cleanInsured,policy_product:/Enhanced Covers/i.test(t.slice(0,450))?'Commercial Vehicle Package Policy Enhanced Covers':'Commercial Vehicle Package Policy',policy_start_date:start,policy_end_date:end,policy_issuance_date:issue,third_party_start_date:start,third_party_end_date:end,vehicle_registration_number:reg,vehicle_registration_status:isRegistered?'registered':hasUnregisteredPrefix?'unregistered':'registration_pending',vehicle_make:mm?.[1]?.trim()||null,vehicle_model:model,vehicle_class:'Commercial Vehicle - Goods Carrying',vehicle_fuel_type:fuel,vehicle_manufacturing_year:year,vehicle_rto_state:state,vehicle_rto_name:finalCity,cpa_premium:certifiedCpa,vehicle_chassis_number:chassis,vehicle_engine_number:engine,idv,vehicle_capacity:grab(t,/Gross Vehicle Weight\s*(?:\(GVW\))?:\s*(\d{3,6})/i)};
 const premium={od,tp,net,gst,gross,tax_basis:'Printed mixed-rate tax, never inferred from OD/TP alone'};
 const parsed=output('The New India Assurance Company Limited','new_india_cv_native_pdf',base,premium,{nia_layout:/THE NEW INDIA ASSURANCE CO\. LTD\./i.test(t),registration_complete:registrationVerified},registrationVerified?[]:['Registration evidence is missing or is not a recognized unregistered RTO prefix.']);
 const registrationField=parsed.fields.find(x=>x.key==='vehicle_registration_status');
 if(registrationField && hasUnregisteredPrefix)registrationField.evidence='NIA PDF partial registration prefix '+registrationCode+'; no full plate';
 if(rto && authorityMatch && authorityCode===registrationCode){
   const authority=parsed.fields.find(x=>x.key==='vehicle_rto_name');
   if(authority)authority.evidence='NIA PDF Name of registration authority: '+rto+' - '+authorityMatch[2].toUpperCase()+' '+authorityMatch[3]+'; matches '+registrationCode;
 }
 if(certifiedCpa){
   const cpaField=parsed.fields.find(x=>x.key==='cpa_premium');
   if(cpaField)cpaField.evidence='NIA PDF page 2 Owner Driver PA; TP and 18%/5% IGST bases independently reconciled';
 }
 if(provisionalOfficeCity){
   const f=parsed.fields.find(x=>x.key==='vehicle_rto_name');
   if(f){f.label='RTO city (provisional issuer-office fallback)';
     f.evidence='NIA issuing office city; provisional, NOT registration authority';}
 }
 return parsed;
}
function cashGroup(t,re){return amount(grab(t,re));}

const request=(function(){try{return $('Validate Policy Intake Request').first().json||{}}catch{return {}}})();
return $input.all().map(item=>{const parsed=newIndia(asText(String(item.json?.text??item.json?.data??item.json?.extracted_text??'')));for(const id of ['intake_id','document_id','request_id'])parsed[id]=String(request?.[id]??item.json?.[id]??'');return {json:parsed};});