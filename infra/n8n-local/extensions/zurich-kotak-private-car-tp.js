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

const insurer=/Zurich Kotak General Insurance Company \(India\) Limited/i.test(text);
const product=/Liability only \(Private Car\)/i.test(text);
const number=grab(/Policy number:\s*(\d{12})/i);
const insured=grab(/INSURED DETAILS POLICY DETAILS\s*\nName:\s*([^\n]+)/i)?.replace(/\s*\.+$/,'').trim();
const period=text.match(/Period of Insurance:\s*\nFrom:\s*(\d{2}\/\d{2}\/\d{4})\s+\d{2}:\d{2}\s+to:\s*(\d{2}\/\d{2}\/\d{4})/i)||[];
const start=iso(period[1]),end=iso(period[2]),issue=iso(grab(/Policy issued on:\s*(\d{2}\/\d{2}\/\d{4})/i));
const block=grab(/VEHICLE DETAILS\s*\n([\s\S]{0,900}?)PREMIUM COMPUTATION TABLE/i)||'';
const veh=block.match(/\bUK\s+(\d{2})\s+([A-Z]{1,3})\s*\n\s*(\d{4})\s*\n\s*([\s\S]{1,180}?)\s+(20\d{2})\s+(Dehradun|Haridwar)\s+([A-Z0-9]+\s*\n\s*\d+)\s+([A-Z0-9]+\s*\n\s*[A-Z0-9]+)\s+(\d{3,4})\s+(DIESEL|PETROL)\s+(\d)\b/i);
const plate=veh?'UK'+veh[1]+veh[2]+veh[3]:null;
const description=veh?.[4]?.replace(/\s+/g,' ').trim()||'';
const make=/^HYUNDAI MOTORS\b/i.test(description)?'HYUNDAI':/^MARUTI\b/i.test(description)?'MARUTI':null;
const model=make?(make==='HYUNDAI'?description.replace(/^HYUNDAI MOTORS\s*/i,''):description.replace(/^MARUTI\s*/i,'')):null;
const rto=veh?.[6],registrationYear=veh?.[5];
const engine=veh?.[7]?.replace(/\s+/g,''),chassis=veh?.[8]?.replace(/\s+/g,'');
const od=money(/Total Own Damage Premium \(A\)\s*([\d,.]+)/i);
const tp=money(/Total Liability Premium \(B\)\s*([\d,.]+)/i);
const cpa=money(/Total Personal Accident Premium \(C\)\s*([\d,.]+)/i);
const net=money(/Taxable value of Services \(A\+B\+C\)\s*([\d,.]+)/i);
const cgst=money(/CGST\s*@\s*9%\s*([\d,.]+)/i),sgst=money(/SGST\s*@\s*9%\s*([\d,.]+)/i);
const gross=money(/Total Premium \(in ₹\s*\)\s*([\d,.]+)/i);
const gst=cgst!==null&&sgst!==null?Number((cgst+sgst).toFixed(2)):null;
const evidence='Kotak PDF vehicle details: registered plate '+plate+' RTO '+rto;
put('insurer_name','Zurich Kotak General Insurance Company (India) Limited',source('insurer masthead'));
put('policy_product','Third-Party Only',source('Liability only (Private Car)'));
put('policy_number',number,source('Policy number'));
put('insured_name',insured,source('INSURED DETAILS Name'));
put('policy_start_date',start,source('Period of Insurance From'));
put('policy_end_date',end,source('Period of Insurance To'));
put('policy_issuance_date',issue,source('Policy issued on'));
put('third_party_start_date',start,source('TP liability cover begins with period'));
put('third_party_end_date',end,source('TP liability cover ends with period'));
put('vehicle_registration_status','registered',evidence);
put('vehicle_registration_number',plate,evidence);
put('vehicle_class','Private Car',source('Type Of Vehicle'));
put('vehicle_make',make,source('VEHICLE DETAILS Manufacturer'));
put('vehicle_model',model,source('VEHICLE DETAILS Model Variant'));
put('vehicle_manufacturing_year',registrationYear,source('Year of Manufacture'));
put('vehicle_rto_state','Uttarakhand',evidence);
put('vehicle_rto_name',rto,evidence);
put('vehicle_engine_number',engine,source('VEHICLE DETAILS Engine Number'));
put('vehicle_chassis_number',chassis,source('VEHICLE DETAILS Chassis No.'));
put('vehicle_capacity',veh?.[9],source('VEHICLE DETAILS Cubic Capacity'));
put('vehicle_fuel_type',veh?.[10]?.toUpperCase()==='PETROL'?'Petrol':veh?.[10]==='DIESEL'?'Diesel':null,source('VEHICLE DETAILS Fuel Type'));
put('idv',0,source('Liability only no own-damage IDV'));
put('od_premium',od,source('Total Own Damage Premium A'));
put('tp_premium',tp,source('Total Liability Premium B'));
put('cpa_premium',cpa,source('Total Personal Accident Premium C'));
const checks={
 insurer_verified:insurer,product_verified:product,policy_identity_verified:!!number&&!!insured,
 policy_period_verified:!!start&&!!end&&end>start,issuance_date_evidenced:!!issue,
 registration_authority_verified:!!rto&&!!plate,vehicle_identification_verified:!!engine&&!!chassis,
 vehicle_make_model_verified:!!make&&!!model,manufacturing_year_evidenced:!!registrationYear,
 capacity_and_fuel_verified:!!veh?.[9]&&!!veh?.[10],
 third_party_only_zero_od:od===0,third_party_only_zero_cpa:cpa===0,
 tp_premium_printed:tp!==null&&tp>0,net_components_reconciled:close(net,od+tp+cpa),
 tax_components_verified:close(gst,cgst+sgst)&&close(cgst,tp*.09,.02)&&close(sgst,tp*.09,.02),
 gross_rounded_reconciled:close(gross,Math.round(net+gst),.01)
};
return finish('zurich_kotak_private_car_tp_native_pdf',checks,od,tp,net,gst,gross,{cgst,sgst,cpa,rounding: gross===null||net===null||gst===null?null:Number((gross-net-gst).toFixed(2))});
