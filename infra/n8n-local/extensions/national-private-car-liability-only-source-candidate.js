/* INSUREIT National Insurance Private Car Liability Only — isolated parser.
 * Hindi/English source-bound labels; no OD/IDV or CPA charge invented.
 * RTO city/state are independently optional, not booking requirements.
 */
'use strict';
function parseNationalPrivateCarLiability(raw){
 const t=String(raw||'').replace(/\r/g,'').replace(/\u00a0/g,' ');
 const read=(re,s=t)=>{const m=re.exec(s);return m?String(m[1]||'').trim():'';};
 const money=(s)=>{const n=Number(String(s).replace(/[₹,\s]/g,''));return s!==''&&Number.isFinite(n)?n:null;};
 const amount=(re,s=t)=>money(read(re,s));
 const date=(s)=>{const m=/^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s||'');if(!m)return '';const iso=m[3]+'-'+m[2]+'-'+m[1];const d=new Date(iso+'T00:00:00Z');return Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===iso?iso:'';};
 const identified=/Policy Schedule\s*-\s*Motor\s*-\s*Private Car\s*-\s*Liability Only/i.test(t)
   &&/National Insurance Co(?:mpany)?\.?\s*(?:Ltd\.?|Limited)/i.test(t);
 const policy=read(/\/\s*Policy Number:\s*([A-Z0-9/.-]{7,40})\b/i);
 const insured=read(/\/Customer Name:\s*([^\n]{3,100}?)(?:ग्र|\/Customer ID:|$)/im).trim();
 const effective=/\/Policy Effective from\s+\d{2}:\d{2}\s+hours?,\s+on\s+(\d{2}\/\d{2}\/\d{4})[^\n]*?\/to midnight of\s+(\d{2}\/\d{2}\/\d{4})/i.exec(t);
 const start=date(effective?.[1]||''),end=date(effective?.[2]||'');
 const issue=date(read(/\/Date of issue:\s*(\d{2}\/\d{2}\/\d{4})/i));
 const schedule=t.slice(0,t.indexOf('Page no: 2')>0?t.indexOf('Page no: 2'):12000);
 const between=(label,next)=>{const i=schedule.indexOf(label);if(i<0)return '';const after=schedule.slice(i+label.length);const stop=next?after.indexOf(next):-1;return stop>=0?after.slice(0,stop):after.slice(0,150);};
 const labelled=(label,next)=>{const x=between(label,next);const m=x.match(/\n\s*([^\n]+)/);return m?m[1].trim():'';};
 const reg=labelled('/Regn. Number','/IDV').replace(/[\s-]/g,'');
 const engine=labelled('Engine or M/c','/Electrical Accessories')
   .replace(/^No\.\s*\n?/,'').trim()||read(/Engine or M\/c\s*\nNo\.\s*\n([A-Z0-9]{5,40})/i,schedule);
 const chassis=read(/\/Chassis Number\s*\n([A-Z0-9]{10,40})/i,schedule);
 const make=labelled('/Make','/Addl. Towing');
 const model=labelled('/Model','/Anti Theft Device');
 const variant=labelled('/Variant','/CC / KW');
 const fuel=labelled('/ Type of Fuel','/Body Type').toUpperCase();
 const cc=labelled('/CC / KW','/Class of Vehicle');
 const year=labelled('/Year of Mfg.','/ Date of');
 const rto=labelled('/Regn.','/Geographical');
 const insuredClass=labelled('/Class of Vehicle','/ Type of Fuel');
 const printedIdvNa=/\/Vehicle IDV\s*\nNA\s*\n/i.test(schedule);
 const net=amount(/\/Premium\s*\n₹\s*([\d,.]+)/i,schedule);
 const cgst=amount(/\/CGST\s*\n₹\s*([\d,.]+)/i,schedule);
 const sgst=amount(/\/SGST\/UTG[\s\S]{0,30}?₹\s*([\d,.]+)/i,schedule);
 const igst=amount(/\/IGST\s*\n₹\s*([\d,.]+)/i,schedule);
 const stamp=amount(/\/Recoverable Stamp[\s\S]{0,45}?₹\s*([\d,.]+)/i,schedule);
 const gross=amount(/\/ Total Amount\s*\n₹\s*([\d,.]+)/i,schedule);
 const tax=igst!==null&&cgst!==null&&sgst!==null?igst+cgst+sgst:null;
 const checks={
   insurer_product_verified:identified,
   policy_number_verified:!!policy,
   insured_name_verified:!!insured,
   printed_issuance_date_verified:!!issue,
   coverage_dates_verified:!!start&&!!end&&start<=end,
   registration_printed:/^[A-Z]{2}\d{2}[A-Z]{1,3}\d{3,4}$/.test(reg),
   engine_chassis_printed:!!engine&&!!chassis,
   make_model_variant_printed:!!make&&!!model&&!!variant,
   vehicle_class_verified:insuredClass==='Private Car',
   fuel_source_verified:['PETROL','DIESEL','CNG','ELECTRIC'].includes(fuel),
   manufacture_year_verified:/^20\d{2}$/.test(year),
   capacity_cc_printed:/^\d{3,5}$/.test(cc),
   liability_only_no_own_damage:/Liability Only/i.test(t.slice(0,500))&&printedIdvNa,
   printed_tp_premium_verified:typeof net==='number'&&net>0,
   printed_tax_components_verified:typeof tax==='number'&&tax>=0,
   net_tax_gross_reconciled:typeof gross==='number'&&Math.abs((net??0)+tax-gross)<=.55,
   stamp_charge_disclosed:stamp===0,
   separately_charged_cpa_absent:!/PA Owner Driver\s*-\s*SI/i.test(schedule)&&!/CPA Premium/i.test(schedule),
 };
 const missing=Object.entries(checks).filter(([,v])=>!v).map(([k])=>k);
 const values={insurer_name:'National Insurance Company Limited',policy_number:policy,insured_name:insured,
  policy_product:'Private Car Liability Only',policy_issuance_date:issue,
  policy_start_date:start,policy_end_date:end,third_party_start_date:start,third_party_end_date:end,
  vehicle_registration_status:reg?'registered':'',vehicle_registration_number:reg,
  vehicle_make:make,vehicle_model:[model,variant].filter(Boolean).join(' '),
  vehicle_fuel_type:fuel,vehicle_manufacturing_year:year,vehicle_capacity:cc,vehicle_class:'Private Car',
  vehicle_engine_number:engine,vehicle_chassis_number:chassis,
  vehicle_rto_name:rto,od_premium:0,tp_premium:net,cpa_premium:0,idv:0,
 };
 const fields=Object.entries(values).filter(([,v])=>v!==''&&v!==null).map(([key,value])=>({
  key,label:key,value:String(value),confidence:null,page:null,
  evidence:key==='policy_issuance_date'?'NIA certificate printed Date of issue':
  key==='idv'?'NIA liability-only PDF prints Vehicle IDV NA':
  key==='od_premium'?'NIA liability-only policy: OD not covered':
  key==='cpa_premium'?'No separately charged owner-driver CPA in source premium schedule':
  key==='vehicle_rto_name'?'NIA optional printed registration authority':
  'NIA bilingual source-labelled policy and vehicle schedule',
 }));
 return {contract_version:'1',ok:missing.length===0,validation_passed:missing.length===0,
  parser_id:'national_private_car_liability_only_native_pdf',parser_version:'source-candidate-1',
  extraction_method:'native_pdf_text',review_required:true,auto_finalize_allowed:false,
  checks,warnings:missing.map(k=>'Review required: '+k),fields,
  premium_components:{od:0,tp:net,cpa:0,net,gst:tax,gross,cgst,sgst,igst,stampDuty:stamp,taxRegime:'mixed_source_lines'},
  error_code:missing.length?'needs_review_or_unsupported':undefined};
}
module.exports={parseNationalPrivateCarLiability};
