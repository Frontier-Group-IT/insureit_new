/* INSUREIT Magma Private Car Package candidate.
 * Isolated, source-only PDF parser. No booking, DB writes or side effects.
 * Accepts CGST+SGST and IGST as separate printed tax regimes.
 * Do not infer fuel from the unselected proposal checkbox list.
 */
'use strict';
function parseMagmaPrivateCar(t){
 const text=String(t||'').replace(/\r/g,'').replace(/\u00a0/g,' ');
 const read=(re,group=1,s=text)=>{const m=re.exec(s);return m?String(m[group]||'').trim():'';};
 const money=v=>{if(!v)return null;const n=Number(String(v).replace(/,/g,''));return Number.isFinite(n)?n:null;};
 const amt=(re,s=text)=>money(read(re,1,s));
 const date=v=>{const m=/^(\d{2})\/(\d{2})\/(\d{4})$/.exec(v||'');if(!m)return '';const iso=m[3]+'-'+m[2]+'-'+m[1];const d=new Date(iso+'T00:00:00Z');return Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===iso?iso:'';};
 const approx=(a,b,t=.55)=>typeof a==='number'&&typeof b==='number'&&Math.abs(a-b)<=t;
 const identified=/Magma General Insurance Limited/i.test(text.slice(0,10000))&&/PRIVATE CAR PACKAGE POLICY/i.test(text.slice(0,10000));
 const policy=read(/\bPolicy No\.?\s*(P\d{10}\/\d{4}\/\d{6})\b/i);
 const insured=read(/\bName of Insured\s+([^\n]{3,90})/i)||read(/\bInsured\s+([^\n]{3,90})/i);
 const issue=date(read(/\bDate of Issue\s*:\s*(\d{2}\/\d{2}\/\d{4})/i));
 const dates=/\bPeriod of Insurance\s+(\d{2}\/\d{2}\/\d{4})\s+TO\s+(\d{2}\/\d{2}\/\d{4})/i.exec(text);
 const start=date(dates?.[1]||''),end=date(dates?.[2]||'');
 const makeModel=read(/\bVehicle Make\/Model\s*([\s\S]{3,240}?)\nRTO\b/i).replace(/\s+/g,' ').trim();
 const parts=makeModel.split(/\s+\/\s+/);
 const make=parts.length===2?parts[0]:'';
 const model=parts.length===2?parts[1]:'';
 const registration=read(/\bVehicle Registration No\.\s*([A-Z0-9 -]{7,20})/i).replace(/[\s-]/g,'');
 const engine=read(/\bEngine No\.\s*([A-Z0-9]{6,40})\b/i);
 const chassis=read(/\bChassis No\.\s*([A-Z0-9]{10,40})\b/i);
 const rtoLine=read(/^RTO\s+([^\n]{3,100})/im);
 const rtoParts=rtoLine.split(/\s*,\s*/);
 const rtoCity=rtoParts[0]||'';
 const rtoState=rtoParts.length===2?rtoParts[1]:'';
 const schedule=read(/INSURED MOTOR VEHICLE DETAILS AND PREMIUM COMPUTATION([\s\S]{80,2200}?)\bIDV \(INSURED'S DECLARED VALUE\)/i);
 const rawYear=read(/\n(20\d{2}|\d{1,2}\/20\d{2})\s+[A-Z0-9]{6,}/,1,schedule);
 const year=rawYear?rawYear.slice(-4):'';
 const capacity=read(/\n(\d{3,4})(?:\.00)?\s+[1-9]\s+0\s*(?:\n|$)/,1,schedule);
 const idvSection=read(/\bIDV \(INSURED'S DECLARED VALUE\)([\s\S]{0,500}?)\bOWN DAMAGE\(A\)/i);
 const idvRow=read(/\b(\d{5,9})\s+0\s+0\s+0\s*\/\s*0\s+0\s+\1\b/i,1,idvSection);
 const idv=money(idvRow);
 const od=amt(/\bTotal Own Damage Premium\(A\)\s+([\d,.]+)/i);
 const tp=amt(/\bTotal Liability Premium\(B\)\s+([\d,.]+)/i);
 const net=amt(/\bTotal Package Premium\(A\+B\)\s+([\d,.]+)/i);
 const cgst=amt(/^CGST @ 9%\s+([\d,.]+)/im);
 const sgst=amt(/^SGST @ 9%\s+([\d,.]+)/im);
 const igst=amt(/^IGST @ 18%\s+([\d,.]+)/im);
 const taxSplit=cgst!==null&&sgst!==null&&igst===null;
 const taxIntegrated=igst!==null&&cgst===null&&sgst===null;
 const gst=taxSplit?cgst+sgst:taxIntegrated?igst:null;
 const gross=amt(/^TOTAL\s+([\d,.]+)\s*$/im);
 const cpa=amt(/\bPA Owner Driver\s*-\s*SI\s*Rs\.?\s*1500000\s+([\d,.]+)/i);
 const basicTp=amt(/\bBasic\s*-\s*TP\s+([\d,.]+)/i);
 const paidDriver=amt(/\bLL to Paid Driver IMT 28\s+([\d,.]+)/i);
 const basicOd=amt(/\bBasic\s*-\s*OD\s+([\d,.]+)/i);
 const addSection=read(/\bOWN DAMAGE\(A\)([\s\S]*?)\bLIABILITY\(B\)/i);
 const lines=addSection.split(/\n/).map(s=>s.trim()).filter(Boolean);
 let addons=0,ncb=0,unknownOd=false;
 for(const line of lines){
  if(/^(?:Basic - OD|Sub Total|Sub-Total Deductions|Total Own Damage Premium|OWN DAMAGE|Less:)/i.test(line))continue;
  const n=amt(/([\d,.]+)\s*$/,line);
  if(/^No claim bonus/i.test(line)){if(n===null)unknownOd=true;else ncb+=n;continue;}
  if(/^([A-Za-z].*)/.test(line)&&n!==null){addons+=n;continue;}
  if(/(?:discount|deduct)/i.test(line)&&n===null)unknownOd=true;
 }
 // Two separately documented manufacturer/model/capacity families.
 // Renault Triber RXE MT 999 cc: Renault India Triber official brochure.
 // Kia Seltos G1.5 iMT HTK Plus 1497 cc: Kia India 2021 Seltos brochure.
 // NO make-wide/default fuel inference and no guessing from unselected forms.
 const renaultPetrol=make==='RENAULT'&&/^TRIBER RXE MT$/i.test(model)&&capacity==='999';
 const kiaPetrol=make==='KIA INDIA PRIVATE LIMITED'
   &&/^(?:KIA INDIA PRIVATE LIMITED\s+)?SELTOS G1\.5 IMT HTK PLUS$/i.test(model)
   &&capacity==='1497';
 const modelCertifiedFuel=renaultPetrol||kiaPetrol?'Petrol':'';
 const fuelEvidence=renaultPetrol
   ?'Manufacturer model-family: Renault Triber RXE MT 999 cc Petrol (Renault India official Triber brochure)'
   :kiaPetrol
   ?'Manufacturer model-family: Kia Seltos G1.5 iMT HTK Plus 1497 cc Petrol (Kia India 2021 Seltos brochure)'
   :'';
 const checks={
  insurer_product_verified:identified,
  policy_number_verified:!!policy,
  insured_name_verified:!!insured,
  issuance_date_printed:!!issue,
  policy_dates_verified:!!start&&!!end&&start<=end,
  vehicle_registration_verified:/^[A-Z]{2}\d{2}[A-Z]{1,3}\d{3,4}$/.test(registration),
  vehicle_engine_chassis_verified:!!engine&&!!chassis,
  manufacturer_model_printed:!!make&&!!model,
  vehicle_year_printed:!!year,
  vehicle_capacity_printed:!!capacity,
  vehicle_idv_printed:idv!==null&&idv>0,
  vehicle_fuel_source_verified:!!modelCertifiedFuel,
  od_premium_reconciled:od!==null&&basicOd!==null&&!unknownOd&&approx(od,basicOd+addons-ncb),
  tp_cpa_paid_driver_reconciled:tp!==null&&basicTp!==null&&cpa!==null&&paidDriver!==null&&approx(tp,basicTp+cpa+paidDriver),
  net_premium_reconciled:approx(net,(od??NaN)+(tp??NaN)),
  tax_components_printed:taxSplit||taxIntegrated,
  gross_premium_reconciled:approx(gross,(net??NaN)+(gst??NaN)),
  package_not_tp_only:/PRIVATE CAR PACKAGE POLICY/i.test(text.slice(0,10000)),
 };
 const missing=Object.keys(checks).filter(k=>checks[k]!==true);
 const values={
  insurer_name:'Magma General Insurance Limited',policy_number:policy,insured_name:insured,
  policy_product:'Private Car Package',policy_issuance_date:issue,policy_start_date:start,
  policy_end_date:end,third_party_start_date:start,third_party_end_date:end,
  vehicle_registration_status:registration?'registered':'',vehicle_registration_number:registration,
  vehicle_make:make,vehicle_model:model,vehicle_manufacturing_year:year,vehicle_capacity:capacity,
  vehicle_chassis_number:chassis,vehicle_engine_number:engine,vehicle_class:'Private Car',
  vehicle_fuel_type:modelCertifiedFuel,
  vehicle_rto_name:rtoCity,vehicle_rto_state:rtoState,idv,cpa_premium:cpa,
 };
 const fields=Object.entries(values).filter(([,v])=>v!==null&&v!=='').map(([key,value])=>({
  key,label:key,value:String(value),confidence:null,page:null,
  evidence:key==='vehicle_fuel_type'?fuelEvidence:
   key==='policy_issuance_date'?'Magma PDF printed Date of Issue':
   key.startsWith('vehicle_rto_')?'Magma PDF optional RTO line':'Magma PDF labelled policy schedule',
 }));
 return {contract_version:'1',ok:missing.length===0,validation_passed:missing.length===0,
   parser_id:'magma_private_car_package_native_pdf',parser_version:'source-candidate-1',
   extraction_method:'native_pdf_text',review_required:true,auto_finalize_allowed:false,
   checks,warnings:missing.map(k=>'Review required: '+k),fields,
   premium_components:{od,tp,net,gst,gross,cpa,basicOd,odAddons:addons,ncb,basicTp,paidDriver,
     taxRegime:taxSplit?'CGST_SGST':taxIntegrated?'IGST':'unverified',cgst,sgst,igst},
   error_code:missing.length?'needs_review_or_unsupported':undefined};
}
module.exports={parseMagmaPrivateCar};
