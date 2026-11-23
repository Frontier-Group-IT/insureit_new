// Insurer/product specific; accepts only native PDF text. NO policy/DB writes.
'use strict';
const text=String($input.first()?.json?.text||'').replace(/\r/g,'').replace(/\u00a0/g,' ');
const grab=(re,g=1)=>{const m=re.exec(text);return m?.[g]?.trim()??null;};
const amt=s=>s==null?null:Number(String(s).replace(/[₹,\s]/g,''));
const money=re=>amt(grab(re));
const iso=d=>{if(!d)return null;let m=d.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);if(m)return m[3]+'-'+m[2]+'-'+m[1];m=d.match(/^(\d{2})-([A-Za-z]{3})-(\d{4})$/);if(!m)return null;const mon=['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'].indexOf(m[2].toLowerCase());return mon<0?null:m[3]+'-'+String(mon+1).padStart(2,'0')+'-'+m[1];};
const close=(a,b,t=.06)=>Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a-b)<=t;
const fields=[];
const put=(key,value,evidence,allowZero=false)=>{
 if(value===undefined||value===null||value===''||!evidence)return;
 if(typeof value==='number'&&!Number.isFinite(value))return;
 fields.push({key,label:key,value:String(value),confidence:null,page:null,evidence});
};
const source=k=>'Native PDF: '+k;
const finish=(parser_id,checks,od,tp,net,gst,gross,extra={})=>{
 const failed_checks=Object.keys(checks).filter(k=>checks[k]!==true);
 return [{json:{contract_version:'1',parser_id,parser_version:'insureit-product-extension-v1',
  ok:failed_checks.length===0,validation_passed:failed_checks.length===0,
  review_required:true,auto_finalize_allowed:false,extraction_method:'native_pdf_text',
  checks,failed_checks,fields,warnings:failed_checks.map(x=>'Evidence incomplete: '+x),
  premium_components:{od,tp,net,gst,gross,...extra}}}];
};

const insurer=/UNITED INDIA INSURANCE COMPANY LIMITED/i.test(text);
const product=/MISCELLANEOUS AND SPECIAL TYPE OF VEHICLES\s*-\s*LIABILITY ONLY POLICY/i.test(text);
const policy=grab(/Policy No\.\s*([0-9A-Z]{12,24})\s+Certificate Number/i);
const insured=grab(/Name of the Insured\s+([^\n]+)/i);
const issue=iso(grab(/Date of Issue:\s*(\d{2}\/\d{2}\/\d{4})/i));
const start=iso(grab(/Insurance Start Date & Time\s*:\s*(\d{2}\/\d{2}\/\d{4})/i)||grab(/from\s+\d{2}:\d{2}\s+Hrs on (\d{2}\/\d{2}\/\d{4})/i));
const end=iso(grab(/Insurance expiry Date & Time\s*:\s*(\d{2}\/\d{2}\/\d{4})/i)||grab(/Date of Expiry of the Insurance Midnight on (\d{2}\/\d{2}\/\d{4})/i));
const vehicleBlock=grab(/Particulars of Vehicle Insured\s*\n([\s\S]{0,950}?)Registration Authority/i)||'';
const ids=vehicleBlock.match(/UK\s*-\s*(\d{2})\s*-\s*([A-Z])\s*-\s*(\d{4})\s+No\s+([A-Z0-9]{8,22})\s+([A-Z0-9]{10,25})/i);
const plate=ids?'UK'+ids[1]+ids[2]+ids[3]:null;
const engine=ids?.[4],chassis=ids?.[5];
const model=grab(/LIMITED\s*\(TRACTOR\)\s*\/\s*([\d\sA-Z]+?)\s+AGRICULTURAL/i)?.replace(/\s+/g,' ');
const rto=grab(/RTA Name\s+UK\d{2}\s+([A-Z ]+?)\s+Vehicle Make/i)||grab(/Registration Authority\s+Geographical Area[\s\S]{0,100}?\nUK\d{2}\s+([A-Z ]+?)\s+INDIA/i);
const authorityCode=grab(/RTA Name\s+(UK\d{2})/i);
const cc=grab(/Cubic Capacity\/Seating\s*Capacity\s*\n(\d{3,5})\/\d+/i)||grab(/Year of\s*\nMfg[\s\S]{0,250}?\n20\d{2}\s+(\d{3,5})\s+\d{3,5}/i);
const year=grab(/Engine Number\s+[A-Z0-9]+\s+Year Of Manufacture\s+(20\d{2})/i);
const od=money(/Gross OD\(A\)\s*([\d,.]+)/i),basicTp=money(/B\. Basic - TP\s*([\d,.]+)/i);
const ll=money(/LL to Paid Driver IMT 28\s*([\d,.]+)/i);
const tp=money(/Gross TP\(B\)\s*([\d,.]+)/i);
const net=money(/Premium\(A\+B\)\s*\n\s*([\d,.]+)/i);
const gst=money(/IGST\(18%\)\s*\n\s*([\d,.]+)/i);
const gross=money(/TOTAL PAYABLE PREMIUM\s*\n\s*([\d,.]+)/i);
const stamp=money(/Stamp Duty\s*\n\s*([\d,.]+)/i);
const cpaWaiver=/Compulsory Personal Accident \(CPA\) cover is\s*\n?removed/i.test(text);
const authorityEvidence=authorityCode&&rto?'United India PDF Registration Authority '+authorityCode+' '+rto:null;
put('insurer_name','United India Insurance Company Limited',source('insurer masthead'));
put('policy_product','Third-Party Only',source('Miscellaneous and Special Type Vehicles Liability Only'));
put('insured_name',insured,source('Name of the Insured'));
put('policy_number',policy,source('Policy No.'));
put('policy_issuance_date',issue,source('Date of Issue'));
put('policy_start_date',start,source('Insurance Start Date'));
put('policy_end_date',end,source('Insurance Expiry Date'));
put('third_party_start_date',start,source('Liability cover start'));
put('third_party_end_date',end,source('Liability cover expiry'));
put('vehicle_class','Agricultural Tractor',source('Agricultural Tractors'));
put('vehicle_registration_status','registered',source('Complete registration number'));
put('vehicle_registration_number',plate,source('Particulars of Vehicle Insured'));
put('vehicle_make','MAHINDRA',source('MAHINDRA & MAHINDRA LIMITED (TRACTOR)'));
put('vehicle_model',model,source('Make/Model 575 DI XP PLUS'));
put('vehicle_manufacturing_year',year,source('Year Of Manufacture'));
put('vehicle_rto_state','Uttarakhand',authorityEvidence);
put('vehicle_rto_name',rto? rto[0]+rto.slice(1).toLowerCase():null,authorityEvidence);
put('vehicle_chassis_number',chassis,source('Chassis No.'));
put('vehicle_engine_number',engine,source('Engine No.'));
put('vehicle_fuel_type',/Diesel\/Agricultural/i.test(text)?'Diesel':null,source('Fuel Type'));
put('vehicle_capacity',cc,source('Cubic Capacity'));
put('idv',0,source('Insured Declared Value Total 0'));
put('od_premium',od,source('Gross OD A'));
put('tp_premium',tp,source('Gross TP B includes LL to paid driver'));
put('cpa_premium',cpaWaiver?0:null,source('Owner-driver CPA cover removed'));
const checks={
 insurer_verified:insurer,tractor_liability_only_verified:product,insured_verified:!!insured,
 policy_number_verified:!!policy,period_verified:!!start&&!!end&&end>start,
 issuance_evidenced:!!issue,vehicle_identification_verified:!!plate&&!!engine&&!!chassis,
 tractor_make_model_verified:!!model&&/MAHINDRA &\s*\nMAHINDRA/i.test(text),
 registration_authority_verified:!!authorityCode&&!!rto&&plate?.startsWith(authorityCode),
 tractor_class_and_fuel_verified:/AGRICULTURAL\s*\nTRACTOR/i.test(text)&&/Diesel\/Agricultural/i.test(text),
 capacity_and_year_verified:!!cc&&!!year,idv_zero_valid:/INSURED DECLARED VALUE[\s\S]{0,400}?0 0/.test(text),
 od_zero_valid:od===0,paid_driver_ll_reconciled:close(tp,basicTp+ll),
 net_tp_reconciled:close(net,tp),tax_evidenced:close(gst,Math.round(net*.18),1),
 stamp_separately_disclosed:stamp===1&&close(gross,net+gst),
 cpa_waiver_evidenced:cpaWaiver
};
return finish('united_india_tractor_tp_native_pdf',checks,od,tp,net,gst,gross,{basicTp,paidDriverLL:ll,stampDuty:stamp,cpa:0});
