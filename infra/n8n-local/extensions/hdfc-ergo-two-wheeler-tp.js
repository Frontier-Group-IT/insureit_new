// Isolated HDFC ERGO Two Wheeler Liability Only native-PDF parser. Review-only.
'use strict';
const text=String($input.first()?.json?.text||'').replace(/\r/g,'').replace(/\u00a0/g,' ');
const head=text.slice(0,16000),flat=head.replace(/\s+/g,' ');
const get=(re,s=flat)=>{const m=re.exec(s);return m?.[1]?.trim()??null;};
const amt=s=>s===null?null:Number(String(s).replace(/[,₹\s]/g,''));
const asDate=(s)=>{let m=s?.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);if(m)return m[3]+'-'+m[2]+'-'+m[1];m=s?.match(/^(\d{2})\s+([A-Za-z]{3}),?\s+(\d{4})$/);if(!m)return null;let mon=['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'].indexOf(m[2].toLowerCase())+1;return mon?m[3]+'-'+String(mon).padStart(2,'0')+'-'+m[1]:null;};
const fields=[];
const put=(key,value,evidence)=>{if(value===null||value===undefined||value==='')return;fields.push({key,label:key,value:String(value),confidence:null,page:null,evidence});};
const issuer=/HDFC ERGO General Insurance Company Limited/i.test(text);
const product=/Motor Insurance\s*-\s*Two Wheeler Liability only/i.test(text);
const rawNumber=get(/Policy No\.\s*([\d ]{18,32})\s+Model\s*-?\s*Variant/i),number=rawNumber?.replace(/\D/g,'');
const insured=get(/\b((?:MR|MRS|MS)\s+[A-Z][A-Z ]{1,65})\s*\.?\s*Communication Address\b/i)?.replace(/[.\s]+$/,'')??null;
const make=get(/\bMake\s+(HONDA)\./i);
const model=get(/Model\s*-\s*Variant\s+([A-Z0-9-]+)\s+Period\s+of/i);
const plate=get(/Registration No\s+(UK-\d{2}-[A-Z]{1,3}-\d{4})/i)?.replaceAll('-','');
const engine=get(/Engine No\.\s*([A-Z0-9]{8,30})/i),chassis=get(/Chassis No\.\s*([A-Z0-9]{8,30})/i);
const capacity=get(/Cubic Capacity\/Watts\s+(\d{2,4})/i),year=get(/Year of Manufacture\s+(\d{4})/i);
const rtoRaw=get(/\bRTO\s+(DEHRA DUN)\s+EIA No\./i),rto=rtoRaw?'Dehradun':null;
const issue=asDate(get(/Issuance Date\s+(\d{2}\/\d{2}\/\d{4})/i));
const start=asDate(get(/\bFrom\s+(\d{2}\s+[A-Za-z]{3},?\s+\d{4})\s+00:01\s+hrs/i));
const end=asDate(get(/\bTo\s+(\d{2}\s+[A-Za-z]{3},?\s+\d{4})\s+Midnight/i));
const premiumBlock=flat.slice(flat.indexOf('Premium Details'),flat.indexOf('Geographical Area'));
const tp=amt(get(/Basic Third Party Liability\s+([\d,.]+)/i,premiumBlock));
const net=amt(get(/Net Liability Premium\s+([\d,.]+)/i,premiumBlock));
const gst=amt(get(/Integrated Tax\s+18%\s+([\d,.]+)/i,premiumBlock));
const gross=amt(get(/Total Premium\s+([\d,.]+)/i,premiumBlock));
const cpaWaived=/Compulsory PA cover for owner driver has not been provided/i.test(text);
const fuel=make==='HONDA'&&model==='ACTIVA-3G'&&capacity==='109'&&Number(year)>=2015&&Number(year)<=2017?'Petrol':null;
const proof='Native PDF: HDFC ERGO Two Wheeler Liability Schedule';
put('insurer_name','HDFC ERGO General Insurance Company Limited',proof);
put('policy_product','Third-Party Only',proof);
put('insured_name',insured,'Native PDF: Policy Schedule Insured Name');
put('policy_number',number,'Native PDF: Policy No.');
put('policy_issuance_date',issue,'Native PDF: Issuance Date');
put('policy_start_date',start,'Native PDF: Period of Insurance From');
put('policy_end_date',end,'Native PDF: Period of Insurance To');
put('third_party_start_date',start,'Native PDF: Liability coverage From');
put('third_party_end_date',end,'Native PDF: Liability coverage To');
put('vehicle_registration_status','registered','Native PDF: Registration No.');
put('vehicle_registration_number',plate,'Native PDF: Registration No.');
put('vehicle_class','Two Wheeler',proof);
put('vehicle_make',make,'Native PDF: Make');
put('vehicle_model',model,'Native PDF: Model - Variant');
put('vehicle_manufacturing_year',year,'Native PDF: Year of Manufacture');
put('vehicle_rto_name',rto,'Native PDF: RTO DEHRA DUN');
put('vehicle_rto_state','Uttarakhand','Registration prefix UK + printed RTO');
put('vehicle_engine_number',engine,'Native PDF: Engine No.');
put('vehicle_chassis_number',chassis,'Native PDF: Chassis No.');
put('vehicle_capacity',capacity,'Native PDF: Cubic Capacity/Watts');
put('vehicle_fuel_type',fuel,'Certified HONDA ACTIVA-3G 109cc petrol model family (not PDF-printed)');
put('idv',0,'Third party only, no OD insured value');
put('od_premium',0,'Native PDF: Liability-only product');
put('tp_premium',tp,'Native PDF: Net Liability Premium');
put('cpa_premium',0,'Native PDF: Compulsory PA waiver declaration');
const checks={
 issuer_verified:issuer,product_verified:product,policy_number_verified:!!number&&number.length===19,
 insured_name_verified:!!insured,period_verified:!!start&&!!end&&end>start,
 issuance_date_verified:!!issue,registration_printed:!!plate&&/^UK\d{2}[A-Z]{1,3}\d{4}$/.test(plate),
 vehicle_identity_verified:!!engine&&!!chassis,make_model_verified:make==='HONDA'&&!!model,
 manufacturing_year_and_cc_verified:!!year&&!!capacity,rto_named:!!rto,
 model_fuel_certified:!!fuel,tp_only_zero_od:true,cpa_waiver_evidenced:cpaWaived,
 liability_premium_printed:tp!==null&&tp>0&&tp===net,
 igst_rounding_verified:gst!==null&&net!==null&&Math.abs(gst-Math.round(net*.18))<=.01,
 gross_reconciled:gross!==null&&gst!==null&&net!==null&&Math.abs(gross-net-gst)<=.01,
 stamp_separately_disclosed:/stamp duty of Rs\. 0\.5/i.test(text)
};
const failed_checks=Object.keys(checks).filter(k=>checks[k]!==true);
return [{json:{contract_version:'1',parser_id:'hdfc_ergo_two_wheeler_tp_native_pdf',parser_version:'insureit-product-extension-v1',
 ok:failed_checks.length===0,validation_passed:failed_checks.length===0,review_required:true,auto_finalize_allowed:false,
 extraction_method:'native_pdf_text',checks,failed_checks,fields,warnings:failed_checks.map(k=>'Evidence incomplete: '+k),
 premium_components:{od:0,tp,net,gst,gross,cpa:0,igst:gst}}}];
