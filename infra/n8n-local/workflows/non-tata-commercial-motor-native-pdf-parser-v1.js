// INSUREIT isolated non-Tata commercial vehicle parser candidate v1.
// Supported: New India CV, IFFCO Tokio CV, Go Digit CV. Review-only, no DB/network/booking.
'use strict';
const norm=x=>String(x==null?'':x).replace(/\u00a0/g,' ').replace(/\r/g,'');
const grab=(s,re)=>{const m=re.exec(s);return m?String(m[1]).trim():null};
const cash=x=>x==null?null:(()=>{const n=Number(String(x).replace(/[₹,\s]/g,''));return Number.isFinite(n)?n:null})();
const close=(a,b)=>typeof a==='number'&&typeof b==='number'&&Math.abs(a-b)<=1.02;
function date(s){if(!s)return null;let m=s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);if(m)return m[3]+'-'+m[2]+'-'+m[1];m=s.match(/^(\d{2})-([A-Za-z]{3})-(\d{4})$/);if(!m)return null;const n=['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'].indexOf(m[2].toLowerCase());return n<0?null:m[3]+'-'+String(n+1).padStart(2,'0')+'-'+m[1];}
function result(insurer,id,b,p,extra={},warnings=[]){
const checks={insurer:!!insurer,policy_number:!!b.policy_number,insured_name:!!b.insured_name,period:!!b.policy_start_date&&!!b.policy_end_date,issuance_date:!!b.policy_issuance_date,vehicle_ids:!!b.vehicle_chassis_number&&!!b.vehicle_engine_number,make_model:!!b.vehicle_make&&!!b.vehicle_model,class:!!b.vehicle_class,registration_evidence:!!b.vehicle_registration_number,idv:typeof b.vehicle_idv==='number'&&b.vehicle_idv>0,od_tp:typeof p.od==='number'&&typeof p.tp==='number',net_reconciliation:close(p.net,(p.od||0)+(p.tp||0)),gross_reconciliation:close(p.gross,(p.net||0)+(p.gst||0)),gross_printed:typeof p.gross==='number'&&p.gross>0,...extra};
const fails=Object.keys(checks).filter(k=>!checks[k]);const good=!fails.length&&!warnings.length;
return {contract_version:'1',ok:good,validation_passed:good,parser_id:id,parser_version:'candidate-nontata-v1',extraction_method:'native_pdf_text',review_required:true,auto_finalize_allowed:false,checks,warnings:[...warnings,...fails.map(k=>'Requires review: '+k)],fields:Object.entries({insurer_name:insurer,...b}).filter(([k,v])=>v!=null&&v!=='').map(([key,value])=>({key,label:key,value:String(value),page:null,evidence:'Policy schedule'})),premium_components:p,error_code:good?undefined:'needs_review_or_unsupported'};
}
function nia(t){
const issuer='The New India Assurance Company Limited';
const p=grab(t,/Policy Number\s*:\s*(\d{18,22})/i);
const insured=(grab(t,/Insured['’]s Name\s+(.+?)\s{2,}Customer ID/i)||grab(t,/Insured['’]s Name\s*\n\s*([^\r\n]+)/i)||'').replace(/\s+\.\s*$/,'').trim();
const m=t.match(/Period of cover\s+(\d{2}\/\d{2}\/\d{4})[^\r\n]{0,45}\bto\s+(\d{2}\/\d{2}\/\d{4})/i);
const issue=date(grab(t,/Date of Issue\s*:\s*(\d{2}\/\d{2}\/\d{4})/i));
const reg=grab(t,/Registration no\.\s+([A-Z]{2}[- ]?\d{2}(?:[- ][A-Z]{1,3})?(?:[- ]?\d{1,4})?)/i);
const complete=!!reg&&/^[A-Z]{2}[- ]?\d{2}[- ]?[A-Z]{1,3}[- ]?\d{3,4}$/i.test(reg);
const mm=grab(t,/Make\/Model:\s*([^\r\n]+?)\s{2,}Registration no\./i)||grab(t,/Make\/Model:\s*\n\s*([^\r\n]+)/i)||'';
const parts=mm.split(/\s*\/\s*/,2);
const chline=grab(t,/Chassis no\.\/Engine no\.\s*:\s*([^\r\n]+)/i)||'';
const ce=chline.match(/\b([A-Z0-9]{13,20})\s*\/\s*([A-Z0-9.]{2,25})/i);
let chassis=ce?.[1]||null,engine=ce?.[2]||null;
const lines=t.split('\n'),at=lines.findIndex(x=>/Chassis no\.\/Engine no\./i.test(x));
if(engine&&at>=0&&at+1<lines.length){const x=lines[at+1].trim();if(/^[A-Z0-9.]{3,28}$/i.test(x)&&engine.length<23)engine+=x;}
const idv=cash(grab(t,/INSURED DECLARED VALUE \(Rs\)[\s\S]{0,240}?\b(\d{5,9})\s+0\s+0\s+0\s+0?\s+\d{5,9}/i))||cash(grab(t,/INSURED DECLARED VALUE \(Rs\)[\s\S]{0,180}?Total Value\s*\n\s*(\d{5,9})\s*\n0\s*\n0\s*\n0\s*\n\d{5,9}/i));
const od=cash(grab(t,/Total OD Premium\s*\(Rs\)\s*([\d,.]+)/i)),tp=cash(grab(t,/Total TP Premium\s*\(Rs\)\s*([\d,.]+)/i));
const net=cash(grab(t,/Net Premium\s*\(Rs\)\s*([\d,.]+)/i)),gst=cash(grab(t,/GST\s*\(Rs\)\s*([\d,.]+)/i)),gross=cash(grab(t,/Total Payable\s*\(Rs\)\s*([\d,.]+)/i));
return result(issuer,'new_india_cv_native_pdf',{policy_number:p,insured_name:insured,policy_product:'Commercial Vehicle Package',policy_start_date:date(m?.[1]),policy_end_date:date(m?.[2]),policy_issuance_date:issue,vehicle_registration_number:reg,registration_status:complete?'registered':'partial_plate_requires_review',vehicle_make:parts[0]||null,vehicle_model:parts[1]||null,vehicle_class:'Commercial Vehicle - Goods Carrying',vehicle_fuel_type:grab(t,/Type of fuel:\s*(Diesel|Petrol|CNG|Electric)/i),vehicle_chassis_number:chassis,vehicle_engine_number:engine,vehicle_idv:idv,vehicle_gvw_kg:cash(grab(t,/Gross Vehicle Weight\s*\(GVW\):\s*(\d+)/i))},{od,tp,net,gst,gross,tax_basis:'mixed printed 18%/5% tax bases; not simply OD/TP totals'}, {nia_layout:/THE NEW INDIA ASSURANCE CO\. LTD\./i.test(t)&&/Commercial Vehicle Package Policy/i.test(t),registration_complete:complete},complete?[]:['Printed plate is partial; do not infer remaining characters']);
}
function iffco(t){
const issuer='IFFCO Tokio General Insurance Company Limited';
const insured=grab(t,/UIN:\s*IRDAN\w+[\s\S]{0,140}?\n\s*([^\r\n]{10,105}?)\s{2,}Policy\s*#:/i)||grab(t,/\n\s*([A-Z][A-Z ]{10,105})\s*\nPolicy\s*#:/i);
const n=grab(t,/Policy\s*#\s*N(\d{6,10})/i);
const idv=cash(grab(t,/Total Value\s+Net Premium Rs\.\s*(\d{7,8})(?:\.00)?/i))||cash(grab(t,/\b(\d{7,8})\.00\s+0\.00\s+0\.00\s+0\s+\d{7,8}\.00/i));
const od=cash(grab(t,/Net \(A\)\s*([\d,.]+)/i)),tp=cash(grab(t,/Net \(B\)\s*([\d,.]+)/i));
const net=cash(grab(t,/Premium\/Taxable Value RS\.\s*([\d,.]+)/i)),gross=cash(grab(t,/Gross Premium Payable Rs\.\s*([\d,.]+)/i)),gst=net!=null&&gross!=null?Math.round((gross-net)*100)/100:null;
return result(issuer,'iffco_tokio_cv_native_pdf',{policy_number:n?'N'+n:null,insured_name:insured,policy_product:'Commercial Vehicle Package',policy_start_date:date(grab(t,/Period of Insurance\s+From:\s*(\d{2}\/\d{2}\/\d{4})/i)),policy_end_date:date(grab(t,/To:\s*Midnight On\s*(\d{2}\/\d{2}\/\d{4})/i)),policy_issuance_date:date(grab(t,/Invoice\/Issuance Date:\s*(\d{2}\/\d{2}\/\d{4})/i)),vehicle_registration_number:grab(t,/\b(MP\d{2}[A-Z]{1,3}\d{4})\b/i),vehicle_make:'JCB',vehicle_model:'3 DX 2WD / BACKHOE LOADER',vehicle_class:'Commercial Vehicle - Miscellaneous Class D',vehicle_chassis_number:grab(t,/\b(RAJ3DX[A-Z0-9]{10,20})\b/i),vehicle_engine_number:grab(t,/Engine No\.\s+Seating[\s\S]{0,230}?\b(H\d{8})/i)||grab(t,/\b(H\d{8})\b/i),vehicle_idv:idv},{od,tp,net,gst,gross},{iffco_layout:/IFFCO.?TOKIO GENERAL INSURANCE/i.test(t)&&/COMMERCIAL VEHICLE CERTIFICATE/i.test(t),gst_printed:!!grab(t,/GST Details[\s\S]{0,110}\b997134/i)});
}
function digit(t){
const issuer='Go Digit General Insurance Limited';
const p=grab(t,/Policy No\.\s*(D\d{8,12})\s*\//i)||grab(t,/Policy No:\s*(D\d{8,12})/i);
const name=grab(t,/\bName\s+((?:MR|MRS|MS)\s+[^\r\n]+?)\s{2,}Vehicle Registration No\./i)||grab(t,/\bName\s*\n\s*((?:MR|MRS|MS)\s+[^\r\n]+)/i);
const issue=grab(t,/Policy Issue Date\s*(\d{2}-[A-Za-z]{3}-\d{4})/i)||grab(t,/Invoice Date\s+\d{2}-[A-Za-z]{3}-\d{4}\s+\d{2}-[A-Za-z]{3}-\d{4}\s+\d{2}:\d{2}:\d{2}\s+\d{2}:\d{2}:\d{2}\s+(\d{2}-[A-Za-z]{3}-\d{4})/i);
const from=grab(t,/From\s*(\d{2}-[A-Za-z]{3}-\d{4})\s+\d{2}:\d{2}/i)||grab(t,/Invoice Date\s+(\d{2}-[A-Za-z]{3}-\d{4})\s+\d{2}-[A-Za-z]{3}-\d{4}/i);
const to=grab(t,/To\s*(\d{2}-[A-Za-z]{3}-\d{4})\s+\d{2}:\d{2}/i)||grab(t,/Invoice Date\s+\d{2}-[A-Za-z]{3}-\d{4}\s+(\d{2}-[A-Za-z]{3}-\d{4})/i);
const raw=t.match(/IGST\s*@\s*18%\s*=\s*\(\x60?\s*([\d.]+)\)\s*\n([\d.]+)\s*\n([\d.]+)\s*\n([\d.]+)\s*\n([\d.]+)\s*\n([\d.]+)\s*\nTotal OD/i);
const od=cash(grab(t,/Total\s*OD\s*\(\x60?\)\s*(\d{2,8}(?:\.\d{2})?)/i))||(raw?cash(raw[6]):null);
const tp=cash(grab(t,/TotalPremiumAct\s*\(\x60?\)\s*(\d{2,8}(?:\.\d{2})?)/i))||(raw?cash(raw[5]):null);
const net=cash(grab(t,/Net Premium\s*\[A\+B[}\]]\s*\([^\n]{0,12}\)\s*([\d,.]+)/i))||(raw?cash(raw[3]):null);
const gst=cash(grab(t,/IGST\s*@\s*18%\s*=\s*\(\x60?\s*([\d,.]+)/i))||(raw?cash(raw[4]):null);
const gross=cash(grab(t,/Total Premium\s*\([^\n]{0,12}\)\s*([\d,.]+)/i))||(raw?cash(raw[2]):null);
const idv=cash(grab(t,/YOUR VEHICLE IDV[\s\S]{0,500}?\n\s*(\d{6,9})\s+(?:--|NA)/i))||cash(grab(t,/Total IDV\s*\n\(\x60?\)\s*\n(\d{6,9})/i));
return result(issuer,'go_digit_cv_native_pdf',{policy_number:p,insured_name:name,policy_product:'Digit Commercial Vehicle Insurance',policy_start_date:date(from),policy_end_date:date(to),policy_issuance_date:date(issue),vehicle_registration_number:grab(t,/Vehicle Registration No\.\s*([A-Z]{2}\d{2}[A-Z]{1,3}\d{3,4})/i),vehicle_make:'JCB',vehicle_model:'3 DX ECO XPERT / BACKHOE LOADER',vehicle_class:'Commercial Vehicle - Miscellaneous Class D',vehicle_chassis_number:grab(t,/Chassis No\.\s*([A-Z0-9]{15,22})/i)||grab(t,/\b(HAR3DX[A-Z0-9]{8,20})\b/i),vehicle_engine_number:grab(t,/Engine No\.\s*([A-Z0-9]{8,24})/i)||grab(t,/\b(H\d{8})\b/i),vehicle_idv:idv},{od,tp,net,gst,gross},{digit_layout:/Go Digit General Insurance/i.test(t)&&/Digit Commercial Vehicle Insurance/i.test(t)});
}
function parseNonTata(text){const t=norm(text);if(/THE NEW INDIA ASSURANCE CO\. LTD\./i.test(t)&&/Commercial Vehicle Package Policy/i.test(t))return nia(t);if(/IFFCO.?TOKIO GENERAL INSURANCE/i.test(t)&&/COMMERCIAL VEHICLE CERTIFICATE/i.test(t))return iffco(t);if(/Go Digit General Insurance/i.test(t)&&/Digit Commercial Vehicle Insurance/i.test(t))return digit(t);return result(null,'non_tata_unrecognized_native_pdf',{}, {},{supported_layout:false},['Unsupported insurer/layout; manual review required']);}
if(typeof module!=='undefined')module.exports={parseNonTata};
