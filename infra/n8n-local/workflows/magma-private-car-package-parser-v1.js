/* Magma General Private Car Package native-PDF parser; read-only.
   Do not infer fuel from proposal-form option lists or from vehicle models.
   Successful source extraction is NOT canonical booking authorization. */
'use strict';
const t=String($input.first()?.json?.text||'').replace(/\r/g,'').replace(/\u00a0/g,' ');
const s=t.slice(0,11000),grab=(re,text=s)=>re.exec(text)?.[1]?.trim()??null;
const money=(re,text=s)=>{const v=grab(re,text);return v==null?null:Number(v.replace(/,/g,''));};
const date=x=>{const m=/^(\d{2})\/(\d{2})\/(\d{4})$/.exec(x||'');return m?m[3]+'-'+m[2]+'-'+m[1]:null;};
const near=(a,b,tol=.51)=>a!=null&&b!=null&&Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a-b)<=tol;
const insurer=/Magma General Insurance Limited/i.test(s)&&/www\.magmainsurance\.com/i.test(s.slice(0,2500)),product=/PRIVATE CAR PACKAGE POLICY/i.test(s);
const numbers=[...new Set(s.match(/\bP\d{10}\/\d{4}\/\d{6}\b/g)||[])];
const policy=numbers.length===1?numbers[0]:null;
const insured=grab(/^Name of Insured\s+([^\n]{4,100})$/im);
const dates=/Period of Insurance\s+(\d{2}\/\d{2}\/\d{4})\s+TO\s+(\d{2}\/\d{2}\/\d{4})/i.exec(s)||[];
const start=date(dates[1]),end=date(dates[2]),issue=date(grab(/Date of Issue\s*:\s*(\d{2}\/\d{2}\/\d{4})/i));
const makeModel=grab(/Vehicle Make\/Model\s+([\s\S]{5,180}?)\s*\nRTO\s+/i);
const make=makeModel?.includes('/')?makeModel.split('/')[0].replace(/\s+/g,' ').trim():null;
const model=makeModel?.includes('/')?makeModel.split('/').slice(1).join('/').replace(/\s+/g,' ').trim():null;
const registration=grab(/Vehicle Registration No\.\s*([A-Z]{2}\s*\d{2}\s*[A-Z]{1,3}\s*\d{3,4})/i)?.replace(/\s+/g,'')??null;
const registrationDate=date(grab(/Vehicle Registration Date\s+(\d{2}\/\d{2}\/\d{4})/i));
const engine=grab(/Engine No\.\s*([A-Z0-9]{6,24})\b/i),chassis=grab(/Chassis No\.\s*([A-Z0-9]{12,27})\b/i);
const a=s.indexOf('INSURED MOTOR VEHICLE DETAILS AND PREMIUM COMPUTATION'),b=s.indexOf("IDV (INSURED'S DECLARED VALUE)");
const vehicle=a>=0&&b>a?s.slice(a,b):'';
const cc=grab(/\b(\d{3,4}(?:\.\d{2})?)\s+\d{1,2}\s+0\s*$/m,vehicle);
const idv=money(/IDV \(INSURED'S DECLARED VALUE\)[\s\S]{0,230}?\n([\d,]{5,10})\s+0\s+0\s+0\s*\/\s*0\s+0\s+\1/i);
const oa=s.indexOf('OWN DAMAGE(A)'),ob=s.indexOf('LIABILITY(B)'),odText=oa>=0&&ob>oa?s.slice(oa,ob):'';
const basicOd=money(/Basic\s*-\s*OD\s+([\d,.]+)/i),ncb=money(/No claim bonus\s+\d+(?:\.\d+)?%\s+([\d,.]+)/i)??0;
const addons=[];
for(const [name,re] of [
 ['Basic Roadside Assistance',/Basic Roadside Assistance\s+([\d,.]+)/i],
 ['Depreciation Re-imbursement',/Depreciation Re-imbursement\s+([\d,.]+)/i],
 ['Consumables',/Consumables\s+([\d,.]+)/i],
 ['Key Replacement',/Key Replacement[^\n]*\s+([\d,.]+)/i],
 ['Loss Of Personal Belongings',/Loss Of Personal Belongings\s+([\d,.]+)/i]
]){const v=money(re,odText);if(v!==null)addons.push({name,amount:v});}
const sub=money(/\bSub Total\s+([\d,.]+)/i,odText),od=money(/Total Own Damage Premium\(A\)\s+([\d,.]+)/i);
const basicTp=money(/Basic\s*-\s*TP\s+([\d,.]+)/i),cpa=money(/PA Owner Driver\s*-\s*SI\s+Rs\.?\s*1500000\s+([\d,.]+)/i);
const paid=money(/LL to Paid Driver IMT\s*28\s+([\d,.]+)/i),tp=money(/Total Liability Premium\(B\)\s+([\d,.]+)/i);
const net=money(/Total Package Premium\(A\+B\)\s+([\d,.]+)/i),cgst=money(/CGST\s*@\s*9%\s+([\d,.]+)/i);
const sgst=money(/SGST\s*@\s*9%\s+([\d,.]+)/i),igst=money(/IGST\s*@\s*18%\s+([\d,.]+)/i);
const gst=cgst!==null&&sgst!==null&&igst===null?cgst+sgst:igst!==null&&cgst===null&&sgst===null?igst:null;
const gross=money(/Premium Computation[\s\S]{0,230}?\bTOTAL\s+([\d,.]+)/i);
const checks={
 insurer_verified:insurer,policy_identity_verified:!!policy&&product,insured_name_verified:!!insured,
 policy_start_end_verified:!!start&&!!end&&start<=end,issuance_date_evidenced:!!issue&&issue<=start,
 vehicle_identification_verified:!!engine&&!!chassis,vehicle_make_model_verified:!!make&&!!model,
 vehicle_class_verified:!!registration,vehicle_registration_printed:!!registration&&!!registrationDate,
 vehicle_idv_verified:idv!==null&&idv>0,od_tp_components_printed:od!==null&&tp!==null,
 net_od_tp_reconciled:near(od+tp,net,.06),gst_independently_evidenced:gst!==null&&gst>=0,
 gross_net_tax_reconciled:near(net+gst,gross,.51),magma_layout:product&&a>=0&&b>a,
 od_ncb_addons_printed:basicOd!==null&&sub!==null&&near(basicOd+addons.reduce((sum,x)=>sum+x.amount,0),sub,.06)&&near(sub-ncb,od,.51),
 liability_cpa_itemized:basicTp!==null&&cpa!==null&&paid!==null&&near(basicTp+cpa+paid,tp,.06),
 // The PDF prints CGST/SGST at 9% each or IGST at 18%. Verifying
 // only their sum is insufficient: both amounts must match the taxable net.
 tax_components_reconciled:gst!==null&&gross!==null&&near(net+gst,gross,.51)
   &&(igst!==null?near(igst,net*.18,.02)
     :cgst!==null&&sgst!==null&&near(cgst,net*.09,.02)&&near(sgst,net*.09,.02))
};
const failed=Object.entries(checks).filter(([,v])=>v!==true).map(([k])=>k),ok=failed.length===0;
const values={policy_number:policy,insurer_name:insurer?'Magma General Insurance Limited':null,
 policy_product:product?'Package':null,insured_name:insured,policy_issuance_date:issue,
 policy_start_date:start,policy_end_date:end,third_party_start_date:start,third_party_end_date:end,
 vehicle_registration_number:registration,vehicle_registration_status:registration?'registered':null,
 vehicle_class:'Private Car',vehicle_make:make,vehicle_model:model,vehicle_registration_date:registrationDate,
 vehicle_registration_year:registrationDate?.slice(0,4),vehicle_engine_number:engine,
 vehicle_chassis_number:chassis,vehicle_capacity:cc,idv,od_premium:od,tp_premium:tp,cpa_premium:cpa};
const fields=Object.entries(values).filter(([,v])=>v!==null&&v!==undefined&&v!=='').map(([key,value])=>({
 key,label:key,value:String(value),confidence:null,page:null,
 evidence:key==='policy_issuance_date'?'Magma Private Car Package Date of Issue on current PDF'
  :key==='insured_name'?'Native PDF policy schedule'
  :'Magma current PDF policy schedule'}));
return [{json:{contract_version:'1',parser_id:'magma_private_car_package_native_pdf',
 parser_version:'non-tata-cv-v2',extraction_method:'native_pdf_text',ok,validation_passed:ok,
 review_required:true,auto_finalize_allowed:false,checks,fields,
 warnings:failed.map(key=>'Review required: '+key),
 premium_components:{od,tp,net,gst,gross,cpa,odBasic:basicOd,odAddons:addons,ncb,cgst,sgst,igst,taxRegime:igst!==null?'IGST':'CGST_SGST'},
 // The proposal's Petrol/Diesel choices are unselected in native text.
 // Do not fabricate insurer-verified fuel or declare canonical booking ready.
 fuel_verified_from_current_pdf:false,
 ...(ok?{}:{error_code:'magma_source_verification_failed'})}}];