// INSUREIT n8n: output only after 18 independent real-PDF checks pass.
// Keep the authenticated signed-object webhook, ICICI branch and review guards unchanged.
const r = $input.first().json;
const ids = $('Validate Policy Intake Request').first().json;
const reject = code => [{json:{
  contract_version:'1', intake_id:ids.intake_id, document_id:ids.document_id,
  request_id:ids.request_id, ok:false, review_required:true,
  auto_finalize_allowed:false, error_code:code,
}}];
const formats = {
 tata_aig_private_car_saod_n8n_native_pdf: 'Stand-Alone Own Damage',
 tata_aig_private_car_package_n8n_native_pdf: 'Package',
 tata_aig_private_car_bundled_n8n_native_pdf: 'Bundled',
 tata_aig_two_wheeler_bundled_n8n_native_pdf: 'Bundled',
};
if (!r || r.ok !== true || r.checks_passed !== 18 || r.failed_checks?.length ||
  r.parser_version !== 'tata-aig-layout-v1' ||
  r.fields?.policy_product !== formats[r.parser_id] ||
  !r.premium_components || !r.form_premium_reconciled || r.printed_issue_date_ambiguous) {
 return reject('tata_aig_not_fully_verified');
}
const f = r.fields, p=r.premium_components;
const money = n => String(Math.round(Number(n)*100)/100);
const fields=[];
const add=(key,value,label,page=null)=>{
 if(value===null||value===undefined||String(value).trim()==='')return;
 fields.push({key,label,value:String(value),confidence:null,page:key==='insured_name'?1:page,
 evidence:key==='insured_name'?'Name of Insured':'Tata AIG current-policy schedule'});
};
add('policy_number',f.policy_number,'Current policy number');
if(f.policy_issuance_date){
 const explicit=f.issue_date_source==='printed_policy_issue_date';
 const fromReceipt=f.issue_date_source==='printed_receipt_business_rule';
 if(!explicit&&!fromReceipt)return reject('tata_aig_issue_date_source_invalid');
 add('policy_issuance_date',f.policy_issuance_date,
   explicit?'Policy Issue Date (printed)':'Issue Date (from printed receipt)',null);
 const printed=fields.find(item=>item.key==='policy_issuance_date');
 printed.evidence=explicit
   ?'Printed Policy Issue Date / Date of Issue on current policy'
   :'Tata AIG printed Receipt Date (approved issuance rule)';
}
add('insurer_name',f.insurer_name,'Current insurer');
add('policy_product',f.policy_product,'Policy product');
add('insured_name',f.insured_name,'Name of insured');
add('vehicle_registration_status',f.vehicle_registration_status,'Registration status');
add('vehicle_registration_number',f.vehicle_registration_number,'Registration number');
add('vehicle_class',f.vehicle_class,'Vehicle class');
add('vehicle_make',f.vehicle_make,'Vehicle make');
add('vehicle_model',f.vehicle_model,'Vehicle model and variant');
add('vehicle_fuel_type',f.vehicle_fuel_type,'Fuel type');
add('vehicle_manufacturing_year',f.vehicle_manufacturing_year,'Manufacturing year');
add('vehicle_capacity',f.vehicle_capacity_cc,'Engine capacity or kW');
add('vehicle_motor_power_kw',f.vehicle_motor_power_kw,'Electric power kW');
add('vehicle_chassis_number',f.vehicle_chassis_number,'Chassis number');
add('vehicle_engine_number',f.vehicle_engine_number,'Engine number');
add('vehicle_rto_name',f.vehicle_rto_city,'RTO city');
add('vehicle_rto_state',f.vehicle_rto_state,'RTO state');
add('idv',f.idv,'Total insured declared value');
add('policy_start_date',f.policy_start_date,'Own damage start');
add('policy_end_date',f.policy_end_date,'Own damage end');
add('third_party_start_date',f.third_party_start_date,'TP start');
add('third_party_end_date',f.third_party_end_date,'TP end');
add('cpa_start_date',f.cpa_start_date,'Owner driver PA start');
add('cpa_end_date',f.cpa_end_date,'Owner driver PA end');
add('od_premium',money(f.od_premium),'Own damage after NCB');
const saod = r.parser_id === 'tata_aig_private_car_saod_n8n_native_pdf';
add('add_on_premium',money(Number(f.addon_premium||0)+(saod?Number(p.roadside_assistance||0):0)),'OD add-ons and SAOD extras');
const legal=Number(p.paid_driver_liability||0), passenger=Number(p.unnamed_passenger_pa||0),rsa=Number(p.roadside_assistance||0);
add('tp_premium',money(Number(p.basic_tp||0)+legal+passenger+(saod?0:rsa)),'TP and non-owner liability');
add('cpa_premium',money(p.owner_driver_cpa||0),'Owner-driver CPA only');
add('cpa_opted',Number(p.owner_driver_cpa||0)>0?'Yes':'No','Owner-driver CPA opted');
const premium_components = {
 basic_od_premium:p.basic_od, ncb_deduction:p.ncb_discount,
 post_ncb_od_premium:p.od_after_ncb,
 od_addons:p.addons.map(a=>({name:a.name,amount:a.amount,code:a.code})),
 addon_subtotal:p.addon_total, basic_tp_premium:p.basic_tp,
 owner_driver_cpa:p.owner_driver_cpa, paid_driver_liability:legal,
 passenger_pa:passenger,roadside_assistance:rsa,
 total_liability_premium:p.total_liability,
 printed_net_premium:p.printed_net,component_net_premium:p.component_net,
 printed_total_tax:p.tax,gross_premium:p.printed_gross,
 // Printed receipt day is independently checked by the 18-check parser.
 receipt_date:p.receipt_date,
};
return [{json:{
 contract_version:'1', intake_id:ids.intake_id,
 document_id:ids.document_id, request_id:ids.request_id,
 ok:true, review_required:true,auto_finalize_allowed:false,
 extraction_method:'native_pdf_text',
 parser_id:r.parser_id,parser_version:r.parser_version,
 fields,checks:r.checks,premium_components,
 warnings:[
  ...(!f.policy_issuance_date?['tata_aig_issuance_date_unverified']:[]),
  'tata_aig_human_review_required',
  ...(f.issue_date_source==='printed_receipt_business_rule'?['tata_aig_receipt_date_as_issuance']:[]),
  ...(!f.policy_issuance_date&&!p.digital_signature_date?['tata_aig_signature_date_not_in_native_text']:[]),
  ...(Math.abs(p.component_net-p.printed_net)>0.005?['tata_aig_printed_net_rounding']:[]),
 ],
}}];
