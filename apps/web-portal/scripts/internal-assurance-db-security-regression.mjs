import fs from "node:fs";
import path from "node:path";

const root = path.resolve(process.cwd(), "../..");
const migrationPath = path.join(root, "supabase/migrations/20261007143000_internal_assurance_p0_security_hardening.sql");
const migration = fs.readFileSync(migrationPath, "utf8");
const reportLoader = fs.readFileSync(path.join(process.cwd(), "lib/reports/policy-business.ts"), "utf8");

const required = [
  "revoke execute on function public.get_policy_business_report_v4",
  "revoke execute on function public.issue_partner_identity",
  "revoke execute on function public.issue_legacy_partner_identity",
  "revoke execute on function public.ensure_legacy_partner_record",
  "revoke execute on function public.post_accounts_excel_reconciliation",
  "revoke execute on function public.finalize_policy_intake_motor_v1",
  "when auth.uid() is null",
  "staff_delete_reserved_for_it_super_user",
  "revoke delete on table public.%I from anon",
  'drop policy if exists "Allow anon read posp-documents"',
  'drop policy if exists "Allow anon upload posp-documents"',
  "security_invoker = true",
  "from anon, authenticated",
  "set search_path = public, pg_temp",
];

for (const needle of required) {
  if (!migration.includes(needle)) {
    throw new Error(`Internal assurance hardening regression: missing contract: ${needle}`);
  }
}

const protectedTables = [
  "policies",
  "vehicles",
  "policy_documents",
  "intermediaries",
  "intermediary_onboarding_applications",
  "intermediary_onboarding_documents",
  "intermediary_referrals",
];

for (const table of protectedTables) {
  if (!migration.includes(`'${table}'`)) {
    throw new Error(`Internal assurance hardening regression: protected table missing: ${table}`);
  }
}

const searchPathFunctions = [
  "assign_support_ticket_number",
  "audit_customer_creation_provenance",
  "audit_customer_parent_relationship",
  "classify_direct_customer_onboarding",
  "classify_policy_onboarded_customer",
  "exchange_mask_registration",
  "generate_claim_control_no",
  "generate_sibl_claim_no",
  "is_allowed_customer_hierarchy",
  "is_shared_intermediary_document_type",
  "prevent_intermediary_customer_rows",
  "prevent_private_voice_dataset_member_mutation",
  "protect_customer_creation_provenance",
  "set_claim_document_verifications_updated_at",
  "set_customer_activity_events_updated_at",
  "set_updated_at",
  "sync_pending_vehicle_no_from_chassis",
  "touch_policy_intake_updated_at",
  "validate_intermediary_onboarding_profile",
  "validate_required_intermediary_identity_fields",
];

for (const fn of searchPathFunctions) {
  if (!migration.includes(`alter function public.${fn}`)) {
    throw new Error(`Internal assurance hardening regression: search_path hardening missing for ${fn}`);
  }
}

if (!reportLoader.includes('createSupabaseAdminClient')) {
  throw new Error("Business reporting must remain behind the server-side Supabase admin client before the report RPC is service-role-only.");
}

if (!reportLoader.includes('.rpc("get_policy_business_report_v4"')) {
  throw new Error("Expected get_policy_business_report_v4 server-side report call was not found.");
}

console.log("Internal assurance database security regression passed.");
