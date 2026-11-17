/**
 * n8n's verified PDF response contains insured identity for extraction checks,
 * but policy-document identity must NEVER enter a new onboarding draft.
 * Permit only the approved vehicle and policy fields. Customer identity is
 * entered/reviewed separately or sourced from a confirmed customer master.
 */
const ALLOWED_N8N_ONBOARDING_KEYS = new Set([
  "vehicle_registration_status",
  "vehicle_registration_number",
  "vehicle_make",
  "vehicle_model",
  "vehicle_manufacturing_year",
  "vehicle_engine_number",
  "vehicle_chassis_number",
  "vehicle_rto_name",
  "policy_number",
  "insurer_name",
  "policy_product",
  "policy_start_date",
  "policy_end_date",
  "idv",
  "od_premium",
  "tp_premium",
  "cpa_premium",
]);

export function filterVerifiedN8nOnboardingFields<T extends { key: string }>(fields: readonly T[]): T[] {
  return fields.filter(({ key }) => ALLOWED_N8N_ONBOARDING_KEYS.has(key));
}
