// Review-only commercial-motor response. No policy/customer/vehicle writes.
const result = $input.first()?.json ?? {};
const request = $('Validate Policy Intake Request').first().json;
const recognized = new Set(['new_india_cv_native_pdf','iffco_tokio_cv_native_pdf','go_digit_cv_native_pdf','united_india_gcv_native_pdf','united_india_gcv_punjab_split_gst_native_pdf','united_india_private_car_package_native_pdf','oriental_gccv_native_pdf']);
const checks = result.checks && typeof result.checks === 'object' && !Array.isArray(result.checks) ? result.checks : {};
const failedChecks = Object.entries(checks).filter(([key, passed]) => /^[a-z][a-z0-9_]{0,64}$/.test(key) && passed !== true).map(([key]) => key).slice(0,25);
const ok = recognized.has(result.parser_id) && result.ok === true && result.validation_passed === true
  && result.review_required === true && result.auto_finalize_allowed === false
  && Object.keys(checks).length > 0 && failedChecks.length === 0;
const fields = Array.isArray(result.fields) ? result.fields : [];
const warnings = Array.isArray(result.warnings) ? result.warnings.filter(x => typeof x === 'string').slice(0,30) : [];
return [{json:{
 contract_version:'1', intake_id:request.intake_id, document_id:request.document_id, request_id:request.request_id,
 ok, validation_passed:ok, review_required:true, auto_finalize_allowed:false, extraction_method:'native_pdf_text',
 parser_id:recognized.has(result.parser_id) ? result.parser_id : 'non_tata_unrecognized_native_pdf',
 parser_version:result.parser_version, checks, failed_checks:failedChecks,
 fields, warnings, premium_components:result.premium_components ?? {},
 ...(!ok ? {error_code:'commercial_verification_failed'} : {}),
}}];