
'use strict';
// INSUREIT Liberty two-wheeler liability, native PDF 18-check, review-only.
const t=String($input.first()?.json?.text??'').replace(/\r/g,'').replace(/\u00a0/g,' ');
const head=t.slice(0,15000),vehicle=head.slice(0,head.indexOf('TWO WHEELER LIABILITY ONLY POLICY'));
const get=(re,src=head)=>re.exec(src)?.[1]?.trim()??null;
const amt=v=>v===null?null:Number(v.replace(/[,\s₹\x60]/g,''));
const day=v=>{const m=/^(\d{2})\/(\d{2})\/(\d{4})$/.exec(v??'');if(!m)return null;const s=m[3]+'-'+m[2]+'-'+m[1],d=new Date(s+'T00:00:00Z');return !Number.isNaN(d.valueOf())&&d.toISOString().slice(0,10)===s?s:null};
const row=/\b([A-Z]{2}\d{2}[A-Z]{1,3}\d{4})\s+((?:19|20)\d{2})\/\d{2}-\d{2}-(?:19|20)\d{2}\/-\s+([A-Z0-9]{8,18})\s+([A-Z0-9]{6,15})\s+([A-Z0-9]{4,15})\s+NA\s+NA/.exec(vehicle);
const plate=row?.[1]??null,year=row?.[2]??null,engine=row?.[3]??null,chassis=row?row[4]+row[5]:null;
const bajaj=/BAJAJ\s*\/\s*PLATIN\s*A\s*\/\s*100\s*ES\b/i.test(vehicle);
const discover=/BAJAJ\s*\/\s*DISCO\s*VER\s*\/\s*125\s*T\s*DRUM/i.test(vehicle);
const jupiter=/TVS\s*MOTORS\s*\/\s*JUPI\s*TER\s*\/\s*ZX\b/i.test(vehicle);
const matches=Number(bajaj)+Number(discover)+Number(jupiter);
const make=matches!==1?null:jupiter?'TVS':'Bajaj';
const model=matches!==1?null:bajaj?'PLATINA 100 ES':discover?'DISCOVER 125 T DRUM':'JUPITER ZX';
const cc=get(/\bSolo with\s+Pillion\s+NA\s+(\d{2,4})\s+2\b/i,vehicle);
const modelCc=!!make&&(bajaj&&cc==='99'||discover&&cc==='125'||jupiter&&cc==='110');
const policyNo=get(/\bPolicyRef No\.\s*([A-Z0-9]{8,40})\b/i);
const insured=get(/\bInsured\s+([A-Z][A-Z .']{2,85}?)\s+Policy Issued on\b/i);
const issue=day(get(/Policy Issued on\s+(\d{2}\/\d{2}\/\d{4})/i));
const issue2=day(get(/Date of Issue\s*:\s*(\d{2}\/\d{2}\/\d{4})/i));
const start=day(get(/Period of Insurance From\s+\d{2}:\d{2}\s+Hrs of\s+(\d{2}\/\d{2}\/\d{4})/i));
const end=day(get(/To Midnight of\s+(\d{2}\/\d{2}\/\d{4})/i));
const basic=amt(get(/Basic TP\s*[\x60₹\s]*([\d,]+\.\d{2})/i));
const cpaPrinted=get(/PA to Owner Driver\s*[\x60₹\s]*([\d,]+\.\d{2})/i);
const cpa=cpaPrinted===null?0:amt(cpaPrinted);
const cpaWaived=cpaPrinted===null&&/P\.A\.\s*cover for owner-\s*Driver under section-\s*III:\s*CSI\s*NA\b/i.test(head)&&!/\bPA BENEFITS\b/i.test(head);
const cpaEvidenced=cpaPrinted===null?cpaWaived:cpa>0&&/P\.A\.\s*cover for owner-\s*Driver under section-\s*III:\s*CSI\s*15,00,000\.00/i.test(head);
const liability=amt(get(/TOTAL LIABILITY PREMIUM\s*[\x60₹\s]*([\d,]+\.\d{2})/i));
const net=amt(get(/Net Premium\s*[\x60₹\s]*([\d,]+\.\d{2})/i));
const gst=amt(get(/GST\(18%\)\s*[\x60₹\s]*([\d,]+\.\d{2})/i));
const gross=amt(get(/TOTAL POLICY PREMIUM\s*[\x60₹\s]*([\d,]+\.\d{2})/i));
const monetary=v=>typeof v==='number'&&Number.isFinite(v)&&v>=0&&v<=10000000&&Math.abs(v*100-Math.round(v*100))<.00001;
const cents=v=>Math.round(v*100);
const checks={
 insurer_source_verified:/\bLIBERTY GENERAL INSURANCE LIMITED\b/i.test(head),
 liability_product_verified:/\bTWO WHEELER LIABILITY ONLY POLICY\s*\(\s*1 YEAR TP ONLY\s*\)/i.test(head)&&/CERTIFICATE OF INSURANCE CUM POLICY SCHEDULE/i.test(head),
 policy_number_verified:!!policyNo,
 insured_name_verified:!!insured,
 printed_issue_dates_agree:!!issue&&issue===issue2,
 coverage_dates_verified:!!start&&!!end&&start<=end&&issue<=end,
 registration_plate_verified:!!plate,
 engine_chassis_verified:!!engine&&!!chassis&&chassis.length>=15,
 source_make_model_verified:!!model&&matches===1,
 printed_vehicle_year_verified:!!year&&Number(year)<=Number(issue?.slice(0,4)||0),
 model_cc_reconciled:!!cc&&modelCc,
 petrol_model_family_certified:modelCc,
 basic_tp_printed:monetary(basic)&&basic>0,
 pa_charge_or_waiver_evidenced:cpaEvidenced,
 tp_plus_cpa_reconciled:monetary(liability)&&monetary(cpa)&&cents(basic+cpa)===cents(liability),
 net_liability_reconciled:monetary(net)&&cents(net)===cents(liability),
 printed_gst_18_reconciled:monetary(gst)&&Math.abs(cents(gst)-cents(net*.18))<=1,
 gross_rupee_rounding_reconciled:monetary(gross)&&cents(gross)===cents(Math.round(net+gst))
};
const f=[];const add=(key,value,evidence)=>{if(value===null||value===undefined||value==='')return;f.push({key,label:key,value:String(value),confidence:null,page:null,evidence})};
const source='Liberty original two-wheeler policy PDF';
add('insurer_name','Liberty General Insurance Limited',source);add('policy_product','Third-Party Only',source);
add('policy_number',policyNo,'Liberty PolicyRef No.');add('insured_name',insured,'Liberty Insured row');
add('policy_issuance_date',issue===issue2?issue:null,'Printed Policy Issued on and Date of Issue agree');
add('policy_start_date',start,'Liberty coverage date');add('policy_end_date',end,'Liberty coverage date');
add('third_party_start_date',start,'Liberty TP coverage');add('third_party_end_date',end,'Liberty TP coverage');
add('vehicle_registration_status',plate?'registered':null,source);add('vehicle_registration_number',plate,source);
add('vehicle_class','Two Wheeler',source);add('vehicle_make',make,'Printed Liberty vehicle schedule');
add('vehicle_model',model,'Printed Liberty model fragments');
add('vehicle_fuel_type',modelCc?'Petrol':null,'Manufacturer model-family petrol specification; not printed in policy');
add('vehicle_manufacturing_year',year,source);add('vehicle_capacity',cc,'Printed CC');
add('vehicle_chassis_number',chassis,'Two-line chassis schedule');add('vehicle_engine_number',engine,source);
add('idv','0','Third-party-only: no OD insurance');add('od_premium','0','Third-party-only: no OD charge');
add('tp_premium',basic,'Printed Liberty Basic TP');
add('cpa_premium',cpaEvidenced?cpa:null,cpaPrinted?'Printed PA owner driver':'Printed CSI NA and no PA charge');
const ok=Object.values(checks).every(Boolean);
return [{json:{contract_version:'1',ok,validation_passed:ok,review_required:true,auto_finalize_allowed:false,
 extraction_method:'native_pdf_text',parser_id:'liberty_two_wheeler_tp_native_pdf',
 parser_version:'insureit-product-extension-v1',checks,fields:f,
 warnings:Object.keys(checks).filter(k=>checks[k]!==true).map(k=>'Review required: '+k),
 premium_components:{od:0,tp:basic,cpa,net,gst,gross},
 ...(!ok?{error_code:'liberty_tw_tp_source_unverified'}:{})}}];
