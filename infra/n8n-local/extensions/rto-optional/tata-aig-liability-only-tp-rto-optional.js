const t=String($input.first().json.text||'');
const ids=$('Validate Policy Intake Request').first().json;
const g=(r,s=t)=>{const m=r.exec(s);return m?m[1].trim():null};
const amt=(r,s=t)=>{const v=g(r,s);return v===null?null:Number(v.replace(/[,₹\s]/g,''))};
const date=v=>{const m=/^(\d{2})\/(\d{2})\/(\d{4})$/.exec(v||'');return m?m[3]+'-'+m[2]+'-'+m[1]:null};
const row=label=>{const m=new RegExp(label+'\\s+(\\d{2}/\\d{2}/\\d{4})\\s*\\([^)]*\\)\\s+(\\d{2}/\\d{2}/\\d{4})','i').exec(t.slice(0,5500));return m?{from:date(m[1]),to:date(m[2])}:null};
const policy=g(/Policy No\.\s*(\d{10}\s+\d{2}\s+\d{2})/i),thanks=g(/Your Policy Number is\s*(\d{10}\s+\d{2}\s+\d{2})/i);
const insured=g(/\bName\s+((?:Mr|Ms|Mrs)\.?\s+[A-Z][A-Z .'-]{2,80})/i,t.slice(0,3000));
const vehiclePart=t.slice(t.indexOf('Vehicle Details - Accurate Vehicle Details'),t.indexOf('Agent/Intermediary Details'));
const plate=g(/Registration No\.\s+([A-Z]{2}\s*\d{1,2}\s*[A-Z]{1,3}\s*\d{3,4})/i,vehiclePart);
const chassis=g(/Chassis No\.\s*([A-Z0-9]{12,25})/i,vehiclePart);
const engine=g(/Engine Number\s*\/\s*Motor No\.\s*\(for EV\)\s*([A-Z0-9]{8,24})/i,vehiclePart);
const make=g(/Make\s*\/\s*Model\s*\/\s*(?:\nVariant\s*)?([A-Z]+)\s*\/\s*([A-Z]+)\s*\/\s*([A-Z0-9 ]+)/i,vehiclePart);
const fuel=g(/Fuel Type\s+(PETROL|DIESEL|CNG|ELECTRIC)/i,vehiclePart);
const cc=g(/CC\/KW\s+(\d{2,5})/i,vehiclePart);
const year=g(/Mfg\.\s*Year\s+(\d{4})/i,vehiclePart);
const rto=g(/RTO Location\s+([A-Z ]{3,35})/i,vehiclePart);
const p=t.slice(t.indexOf('Schedule of Premium'),t.indexOf('Nomination Details'));
const basic=amt(/Basic TP premium\s*₹\s*([\d,.]+)/i,p);
const cpa=amt(/1Year\(s\) Compulsory PA cover for Owner Driver[\s\S]{0,110}?₹\s*([\d,.]+)/i,p);
const legal=amt(/Add:\s*Legal liability to paid driver\s*\(IMT\s*28\)(?:\s*Number of persons:\s*\d+)?\s*₹\s*([\d,.]+)/i,p);
const liability=amt(/Total Liability Premium\s*\(A\)\s*₹\s*([\d,.]+)/i,p);
const net=amt(/Net Premium\s*\(B\)\s*₹\s*([\d,.]+)/i,p);
const tax=amt(/\bIGST\s*@?\s*18%\s*₹\s*([\d,.]+)/i,p);
const gross=amt(/Total Policy Premium\s*₹\s*([\d,.]+)/i,p);
const headerGross=amt(/Premium Amount\s*\(Including GST\)\s*₹\s*([\d,.]+)/i,t.slice(0,5500));
const tp=row('Third-Party Cover'),pa=row('Compulsory PA Cover for Owner-Driver');
const near=(a,b)=>Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a-b)<=0.02;
const checks={
 insurer:/For TATA AIG General Insurance Company Limited/i.test(t)&&/tataaig\.com/i.test(t),
 product:/Auto Secure\s*-\s*Liability Only Policy/i.test(t.slice(0,1200)),
 policy:!!policy&&policy===thanks,insured:!!insured,registration:!!plate,vehicle:!!chassis&&!!engine,
 specs:!!make&&!!fuel&&!!cc&&!!year,rto:true, // RTO city/state optional.
 tp_period:!!tp?.from&&!!tp?.to,pa_period:!!pa?.from&&pa.from===tp?.from&&pa.to===tp?.to,
 liability:near(basic+cpa+legal,liability),net:near(net,liability),
 tax:near(net+tax,gross),header_total:near(headerGross,gross),
 receipt_date:!!g(/Receipt Date\s+(\d{2}\/\d{2}\/\d{4})/i,t),
 no_od_cover:!/Own Damage Cover\s+\d{2}\/\d{2}\/\d{4}/i.test(t.slice(0,5500))
};
const failed=Object.keys(checks).filter(k=>!checks[k]),ok=failed.length===0;
const fields=[];
function put(key,value,label,page){if(value!==null&&value!==undefined&&value!=='')fields.push({key,value:String(value),label,page,confidence:null,evidence:'Tata AIG Liability Only Policy Schedule'});}
if(ok){
 put('policy_number',policy,'Policy number',1);put('insurer_name','TATA AIG GENERAL INSURANCE COMPANY LIMITED','Insurer',1);
 put('policy_product','Third-Party Only','Policy product',1);put('insured_name',insured,'Insured name',1);
 put('vehicle_registration_status','Registered','Registration status',4);put('vehicle_registration_number',plate.replace(/\s/g,''),'Registration number',4);
 put('vehicle_class','PCP','Vehicle class',4);put('vehicle_make',make,'Make',4);
 put('vehicle_model',g(/Make\s*\/\s*Model\s*\/\s*(?:\nVariant\s*)?[A-Z]+\s*\/\s*([A-Z]+(?:\s*\/\s*[A-Z0-9 ]+)?)/i,vehiclePart),'Model',4);
 put('vehicle_fuel_type',fuel,'Fuel',4);put('vehicle_manufacturing_year',year,'Manufacture year',4);
 put('vehicle_capacity',cc,'Engine cc',4);put('vehicle_chassis_number',chassis,'Chassis',4);put('vehicle_engine_number',engine,'Engine',4);
 put('vehicle_rto_name',rto,'RTO city',4);
 if(rto==='MUMBAI')put('vehicle_rto_state','MAHARASHTRA','RTO state',4);
 put('policy_start_date',tp.from,'Policy coverage start',1);put('policy_end_date',tp.to,'Policy coverage end',1);put('third_party_start_date',tp.from,'TP from',1);put('third_party_end_date',tp.to,'TP to',1);
 put('cpa_start_date',pa.from,'CPA from',1);put('cpa_end_date',pa.to,'CPA to',1);
 put('od_premium','0','OD not applicable',5);put('add_on_premium','0','OD addons not applicable',5);
 put('tp_premium',basic+legal,'TP and paid-driver liability',5);put('cpa_premium',cpa,'CPA',5);put('cpa_opted','Yes','CPA opted',5);
}
return [{json:{contract_version:'1',intake_id:ids.intake_id,document_id:ids.document_id,request_id:ids.request_id,
 ok,review_required:true,auto_finalize_allowed:false,parser_id:'tata_aig_private_car_liability_only_n8n_native_pdf',
 parser_version:'tata-aig-tp-v1',extraction_method:'native_pdf_text',
 fields,checks,checks_passed:Object.keys(checks).length-failed.length,failed_checks:failed,
 premium_components:{basic_od_premium:0,od_addons:[],addon_subtotal:0,basic_tp_premium:basic,owner_driver_cpa:cpa,
 paid_driver_liability:legal,total_liability_premium:liability,printed_net_premium:net,
 printed_total_tax:tax,gross_premium:gross,receipt_date:date(g(/Receipt Date\s+(\d{2}\/\d{2}\/\d{4})/i,t))},
 warnings:ok?['tata_aig_issuance_date_requires_verified_pdf_signature','tata_aig_human_review_required']:failed.map(x=>'tp_check_failed:'+x),
 ...(ok?{}:{error_code:'tata_aig_tp_validation_failed'})}}];