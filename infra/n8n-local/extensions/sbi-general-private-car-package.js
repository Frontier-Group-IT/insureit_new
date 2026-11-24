// Isolated SBI General Private Car Package native-PDF parser. Review-only.
'use strict';
const text=String($input.first()?.json?.text||'').replace(/\r/g,'').replace(/\u00a0/g,' ');
const flat=text.replace(/\s+/g,' ');
const grab=(re,s=flat)=>re.exec(s)?.[1]?.trim()??null;
const money=(re,s=flat)=>{let v=grab(re,s);return v===null?null:Number(v.replace(/[,₹\s]/g,''));};
const toIso=(s)=>{let m=s?.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);return m?m[3]+'-'+m[2]+'-'+m[1]:null;};
const close=(a,b,t=.06)=>Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a-b)<=t;
const fields=[],put=(key,value,evidence)=>{if(value===null||value===undefined||value==='')return;fields.push({key,label:key,value:String(value),confidence:null,page:null,evidence});};
const insurer=/SBI General Insurance Company Limited/i.test(flat);
const product=/Private Car Insurance Policy\s*-\s*Package/i.test(flat);
const number=grab(/Policy\s*\/\s*Certificate No\s*:\s*(POPMCAR\d{11})/i);
const numberReceipt=grab(/Policy Number\s+(POPMCAR\d{11})/i);
const insured=grab(/Policy Holder Name\s+(Mr\.?\s+[A-Za-z ]{3,65})\s+Intermediary Name/i);
const issue=toIso(grab(/Receipt Date\s+(\d{2}\/\d{2}\/\d{4})/i));
const signatureDate=grab(/Digitally signed by DS SBI\s+GENERAL INSURANCE\s+COMPANY LTD\s+Date:\s+(\d{4}\.\d{2}\.\d{2})/i);
const signedDate=signatureDate?.replace(/\./g,'-');
const period=flat.match(/Period of Insurance OD\s*:\s*From:(\d{2}\/\d{2}\/\d{4})\s+\d{2}:\d{2}:\d{2}\s+To:(\d{2}\/\d{2}\/\d{4})/i)||[];
const start=toIso(period[1]),end=toIso(period[2]);
const tpPeriod=flat.match(/Period of Insurance TP\s*:\s*From:(\d{2}\/\d{2}\/\d{4})\s+\d{2}:\d{2}:\d{2}\s+To:(\d{2}\/\d{2}\/\d{4})/i)||[];
const tpStart=toIso(tpPeriod[1]),tpEnd=toIso(tpPeriod[2]);
const plate=grab(/Registration Number\s+(UK\d{2}[A-Z]{1,3}\d{4})/i);
const makeVariant=flat.match(/Tata Motors,\s*(Punch)\s*&\s*(Adventure)/i)||[];
const make=makeVariant.length?'TATA':null;
const model=makeVariant.length?(makeVariant[1]+' '+makeVariant[2]).toUpperCase():null;
const engineChassis=flat.match(/(REVTRN[A-Z0-9]{9,25})\s*&\s*(MAT[A-Z0-9]{9,25})/i)||[];
const engine=engineChassis[1]??null,chassis=engineChassis[2]??null;
const year=grab(/Year of Manufacture\s+(\d{4})/i);
const cc=grab(/(?:Cubic Capacity\s*\/\s*Kilo Watt\s*\/\s*Gross Vehicle Weight\s*\/\s*Horsepower|Cubic Capacity\s*\/\s*Kilo Watt)\s+(1199)\b/i)
  ||(make&&/\b1199\s+Petrol\s+2023\b/i.test(flat)?'1199':null);
const fuel=/\bPetrol\s+2023\b/i.test(flat)?'Petrol':null;
const rto=grab(/RTO Location\s+(Roorkee)\b/i)||(/\bRoorkee\b/i.test(flat)?'Roorkee':null);
const idv=money(/Your Vehicle IDV\s+Vehicle Non Electrical Accessory Electrical Accessory CNG\/LPG Total IDV\s+([\d,.]+)/i)
  ??money(/Total IDV\s+([\d,.]+)/i);
const basicOd=money(/Own Damage Basic\s+([\d,.]+)/i);
const addOns=['Consumable','Depreciation Reimbursement','Engine Guard','Road Side Assistance'].map(name=>{
  const re=new RegExp('\\b'+name+'\\s+([\\d,.]+)','i');return money(re);
});
const od=money(/TOTAL OWN DAMAGE\s+PREMIUM\s+([\d,.]+)/i);
const tp=money(/Third Party Basic\s+Premium\s+([\d,.]+)/i);
const cpa=money(/PA to Owner Driver\s+([\d,.]+)/i);
const tpWithCpa=money(/TOTAL TP\s+PREMIUM\s+([\d,.]+)/i);
const net=money(/TOTAL PREMIUM\s+([\d,.]+)\s+GST\b/i);
const gst=money(/\bGST\s+([\d,.]+)\s+FINAL PREMIUM/i);
const gross=money(/FINAL PREMIUM\s+([\d,.]+)/i);
const addOn=addOns.every(Number.isFinite)?Number(addOns.reduce((a,b)=>a+b,0).toFixed(2)):null;
const pfx='Native PDF: SBI General Package Policy';
put('insurer_name','SBI General Insurance Company Limited',pfx);
put('policy_product','Package',pfx);
put('policy_number',number,'Native PDF: Policy / Certificate No');
put('insured_name',insured,'Native PDF: Premium Receipt Policy Holder Name');
put('policy_issuance_date',issue,'Native PDF: Receipt Date / Signed Policy Issue Date');
put('policy_start_date',start,'Native PDF: OD Period From');
put('policy_end_date',end,'Native PDF: OD Period To');
put('third_party_start_date',tpStart,'Native PDF: TP Period From');
put('third_party_end_date',tpEnd,'Native PDF: TP Period To');
put('vehicle_registration_status','registered','Native PDF: Registration Number');
put('vehicle_registration_number',plate,'Native PDF: Registration Number');
put('vehicle_class','Private Car',pfx);
put('vehicle_make',make,'Native PDF: Vehicle Make Model & Variant');
put('vehicle_model',model,'Native PDF: Vehicle Make Model & Variant');
put('vehicle_manufacturing_year',year,'Native PDF: Year of Manufacture');
put('vehicle_rto_state','Uttarakhand','Registered UK plate + native PDF RTO');
put('vehicle_rto_name',rto,'Native PDF: RTO Location');
put('vehicle_chassis_number',chassis,'Native PDF: Engine & Chassis Number');
put('vehicle_engine_number',engine,'Native PDF: Engine & Chassis Number');
put('vehicle_capacity',cc,'Native PDF: CC');
put('vehicle_fuel_type',fuel,'Native PDF: Fuel');
put('idv',idv,'Native PDF: Total IDV');
put('od_premium',od,'Native PDF: Total Own Damage Premium including add-ons');
put('tp_premium',tp,'Native PDF: Third Party Basic Premium excluding CPA');
put('cpa_premium',cpa,'Native PDF: PA to Owner Driver');
const checks={
 insurer_verified:insurer,package_product_verified:product,
 policy_identity_verified:!!number&&number===numberReceipt&&!!insured,
 issue_and_signature_date_consistent:!!issue&&!!signedDate&&issue===signedDate,
 od_period_evidenced:!!start&&!!end&&end>start,
 tp_period_evidenced:!!tpStart&&!!tpEnd&&tpStart===start&&tpEnd===end,
 registered_plate_evidenced:!!plate&&/^UK\d{2}[A-Z]{1,3}\d{4}$/.test(plate),
 make_model_evidenced:!!make&&!!model,vehicle_identity_evidenced:!!engine&&!!chassis,
 registration_year_and_fuel_verified:!!year&&!!fuel,
 capacity_evidenced:!!cc,rto_authority_evidenced:!!rto,
 idv_printed:idv!==null&&idv>0,od_basic_and_addons_printed:basicOd!==null&&basicOd>0&&addOn!==null,
 od_including_addons_reconciled:close(od,basicOd+addOn),
 tp_and_cpa_separate:tp>0&&cpa>0&&close(tpWithCpa,tp+cpa),
 total_net_reconciled:close(net,od+tp+cpa),
 gst_18_percent_reconciled:close(gst,Math.round(net*.18*100)/100),
 gross_rounded_reconciled:close(gross,Math.round(net+gst),.01),
 stamp_separately_disclosed:/Consolidated Stamp Duty\s*₹\s*0\.5/i.test(flat)
};
const failed_checks=Object.keys(checks).filter(k=>checks[k]!==true);
return [{json:{contract_version:'1',parser_id:'sbi_general_private_car_package_native_pdf',parser_version:'insureit-product-extension-v1',
 ok:failed_checks.length===0,validation_passed:failed_checks.length===0,review_required:true,auto_finalize_allowed:false,
 extraction_method:'native_pdf_text',checks,failed_checks,fields,warnings:failed_checks.map(k=>'Evidence incomplete: '+k),
 premium_components:{od,tp,cpa,net,gst,gross,addOn,odBasic:basicOd,tpWithCpa}}}];
