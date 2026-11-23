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

const issuer=/Go Digit General Insurance (?:Ltd\.|Limited)/i.test(text);
const product=/Digit Two-Wheeler Insurance/i.test(text)&&/Digit Two-Wheeler Stand-al/i.test(text);
const policy=grab(/\b(D\d{9}\s*\/\s*\d{8})\s*\nPolicy No\./i);
const issue=iso(grab(/Invoice Number\s*\nInvoice Date[\s\S]{0,120}?\n[A-Z0-9]+\s*\n(\d{4}-\d{2}-\d{2})/i)?.replace(/^(\d{4})-(\d{2})-(\d{2})$/,'$3/$2/$1')||grab(/Policy Issue Date[\s\S]{0,30}?(\d{2}-[A-Za-z]{3}-\d{4})/i));
const insured=grab(/Name\s*\n([A-Z][A-Z .'-]+)\s*\nVehicle Registration No\./i);
const plate=grab(/Vehicle Registration No\.\s*(UK\d{2}[A-Z]{1,3}\d{4})/i);
const start=iso(grab(/Period of Policy for Own Damage Cover and Optional cover\(s\) if\s*\nOpted\s*\n\d+\s*%\s*\n(\d{2}-[A-Za-z]{3}-\d{4})/i));
const end=iso(grab(/Period of Policy for Own Damage Cover and Optional cover\(s\) if\s*\nOpted\s*\n\d+\s*%\s*\n\d{2}-[A-Za-z]{3}-\d{4}\s*\n(\d{2}-[A-Za-z]{3}-\d{4})/i));
const rto=grab(/RTO Location\s+([^,\n]+),UTTARAKHAND/i);
const make=grab(/Make\s+(ROYAL ENFIELD)\b/i);
const variant=grab(/Model\/Vehicle Variant \(Sub-\s*\nType\)\s*\n([^\n]+)/i);
const model=variant?.split('/')[0]?.trim()||null;
const fuel=grab(/Fuel Type\s+(Petrol|Diesel|Electric)/i);
const regYear=grab(/Year of Regn\/Year of Mfg\.\s*(20\d{2})\/--/i);
const idv=money(/Total IDV \([^)]*\)\s*\n\s*([\d,.]+)/i)||money(/Vehicle IDV \([^)]*\)\s*([\d,.]+)/i);
const cc=grab(/Cubic Capacity\s+(\d{2,5})\s+CC/i);
const engine=grab(/Engine No\.\s*([A-Z0-9]{8,25})/i),chassis=grab(/Chassis No\.\s*([A-Z0-9]{10,25})/i);
const invoice=grab(/Invoice Number\s*\nInvoice Date\s*\nNet Premium Igst Cgst Sgst Utgst Cess Gross Premium\s*\n[A-Z0-9]+\s*\n\d{4}-\d{2}-\d{2}\s*\n([\d.\s]+)/i);
const vals=invoice?.trim().split(/\s+/).map(Number)||[];
const net=vals[0],gst=vals[1],gross=vals[6];
const priorTpBlock=grab(/THIRD PARTY LIABILITY DETAILS\s*\n([\s\S]{0,130}?)\n(?:MAHENDRA|Digit Two-Wheeler)/i)||'';
const priorPeriod=priorTpBlock.match(/(\d{2}-[A-Za-z]{3}-\d{4})\s*\n(\d{2}-[A-Za-z]{3}-\d{4})/);
const tpStart=iso(priorPeriod?.[1]),tpEnd=iso(priorPeriod?.[2]);
put('insurer_name','Go Digit General Insurance Limited',source('Go Digit insurer masthead'));
put('policy_product','Stand-alone Own Damage',source('Digit Two-Wheeler Stand-alone'));
put('insured_name',insured,source('Name'));
put('policy_number',policy?.replace(/\s+/g,''),source('Policy No.'));
put('policy_issuance_date',issue,source('Invoice Date and issue date'));
put('policy_start_date',start,source('OD cover From'));
put('policy_end_date',end,source('OD cover To'));
put('third_party_start_date',tpStart,source('Existing TP insurer - reference only'));
put('third_party_end_date',tpEnd,source('Existing TP insurer - reference only'));
put('vehicle_registration_number',plate,source('Vehicle Registration No.'));
put('vehicle_registration_status','registered',source('Complete registration number'));
put('vehicle_class','Two Wheeler',source('Digit Two-Wheeler Insurance'));
put('vehicle_make',make,source('Make'));
put('vehicle_model',model,source('Model/Vehicle Variant'));
put('vehicle_fuel_type',fuel,source('Fuel Type'));
put('vehicle_registration_year',regYear,source('Year of Regn / Year of Mfg 2025/--, manufacturing year not printed'));
put('vehicle_rto_name',rto,source('RTO Location'));
put('vehicle_rto_state','Uttarakhand',source('RTO Location'));
put('vehicle_engine_number',engine,source('Engine No.'));
put('vehicle_chassis_number',chassis,source('Chassis No.'));
put('vehicle_capacity',cc,source('Cubic Capacity CC'));
put('idv',idv,source('Total IDV'));
put('od_premium',net,source('Net premium invoice: standalone OD'));
put('tp_premium',0,source('Standalone OD issues no TP'));
put('cpa_premium',0,source('Standalone OD no owner-driver CPA charged'));
const checks={
 insurer_verified:issuer,standalone_od_product_verified:product,identity_verified:!!policy&&!!insured,
 insured_vehicle_registered:!!plate&&!!rto,od_period_verified:!!start&&!!end&&end>start,
 issuance_date_evidenced:!!issue,make_model_evidenced:!!make&&!!model,
 vehicle_identification_verified:!!engine&&!!chassis,year_evidence_separate:!!regYear,
 fuel_cc_verified:!!fuel&&!!cc,idv_printed:!!idv&&idv>0,
 od_net_invoice_printed:Number.isFinite(net)&&net>0,igst_printed:Number.isFinite(gst),
 gross_invoice_printed:Number.isFinite(gross),
 tax_reconciled:close(gst,Math.round(net*.18*100)/100,.02),
 gross_reconciled:close(gross,net+gst,.02),
 no_new_tp_premium:true,optional_parts_depreciation_named:/Parts Depreciation Protect Cover/i.test(text)
};
return finish('go_digit_two_wheeler_od_native_pdf',checks,net,0,net,gst,gross,{cpa:0,igsts:gst,priorTpPolicyReferenceOnly:true,optionalPartsDepreciation:true});
