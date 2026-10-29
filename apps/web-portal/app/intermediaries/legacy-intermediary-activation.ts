/** Recognize explicitly reconciled historical activation without falsely certifying compliance steps. */
export function isActivatedIntermediaryRegistration(app: {
  registration_status?: string | null;
  status?: string | null;
  registration_record_id?: string | null;
  draft_data?: Record<string, unknown> | null;
} | null | undefined): boolean {
  if (!app) return false;
  if (app.registration_status === "iib_registered") return true;
  return app.registration_status === "partner_active"
    && app.status === "approved"
    && Boolean(app.registration_record_id)
    && app.draft_data?.onboarding_mode === "legacy_existing_partner"
    && app.draft_data?.legacy_reconciliation === "pre_existing_posp_activation";
}
