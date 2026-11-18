const x=$input.first().json;
const odOnly=x.parser_id==='icici_3005_od_n8n_native_pdf'&&x.parser_version==='bridge-od-v1';
const valid=x.validation_passed===true&&(x.checks?.is_icici_3005===true||odOnly&&x.checks?.is_icici_3005_od===true);
const known=new Set(['policy_number','insurer_name','policy_product','policy_issuance_date','policy_start_date','policy_end_date','third_party_start_date','third_party_end_date','third_party_policy_number','third_party_insurer_name','insured_name','vehicle_make','vehicle_model','vehicle_class','vehicle_fuel_type','vehicle_motor_power_kw','vehicle_rto_state','vehicle_registration_status','vehicle_registration_number','vehicle_engine_number','vehicle_chassis_number','vehicle_manufacturing_year','vehicle_rto_name','idv','od_premium','tp_premium','cpa_premium']);
const proposals=Array.isArray(x.insureit_proposal)?x.insureit_proposal:[];
const fields=valid?proposals.filter(f=>known.has(f.key)&&typeof f.value==='string'&&f.value.length<300).map(f=>({key:f.key,label:f.label,value:f.value,confidence:null,page:Number.isInteger(f.page)?f.page:null,evidence:String(f.evidence||'').slice(0,120)})):[];
const warnings=Array.isArray(x.warnings)?x.warnings.map(s=>String(s).slice(0,240)).slice(0,30):[];
if(!valid) warnings.unshift('Unsupported or unverified PDF: retain current OCR/manual review');
let context;
try { context=$('Validate Policy Intake Request').first().json; }
catch { context=$('Synthetic ICICI PDF Text').first().json; }
const p=x.premium_components||{};
const cleanMoney=(v)=>typeof v==='number'&&Number.isFinite(v)&&v>=0?v:null;
const premium_components={
 basic_od_premium:cleanMoney(p.basic_od_premium),
 od_addons:Array.isArray(p.od_addons)?p.od_addons.slice(0,12).map(a=>({name:String(a.name||'').slice(0,90),amount:cleanMoney(a.amount)})):[],
 total_od_premium:cleanMoney(p.total_od_premium),
 basic_tp_premium:cleanMoney(p.basic_tp_premium),
 owner_driver_cpa:cleanMoney(p.owner_driver_cpa),
 total_liability_premium:cleanMoney(p.total_liability_premium),
 net_premium:cleanMoney(p.net_premium),
 igst_exact:cleanMoney(p.igst_exact),
 printed_total_tax:cleanMoney(p.printed_total_tax),
 gross_premium:cleanMoney(p.gross_premium),
 printed_od_subtotal:cleanMoney(p.printed_od_subtotal), od_deductions:cleanMoney(p.od_deductions)
};
return [{json:{contract_version:'1',intake_id:context.intake_id,document_id:context.document_id,request_id:context.request_id,ok:valid,parser_id:odOnly?'icici_3005_od_n8n_native_pdf':'icici_3005_n8n_native_pdf',parser_version:odOnly?'bridge-od-v1':'bridge-v1',extraction_method:'native_pdf_text',fields,warnings,checks:x.checks||{},premium_components,review_required:true,auto_finalize_allowed:false,...(valid?{}:{error_code:'needs_review_or_unsupported'})}}];