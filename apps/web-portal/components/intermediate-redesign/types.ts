/**
 * Type definitions shared across the redesigned intermediate register components.
 * Mirrors the shapes used in the original codebase so the redesign can be
 * dropped in as a replacement.
 */

export type IntermediaryType = "posp" | "misp" | "partner";

export interface IntermediaryRow {
  id: string;
  intermediary_code: string | null;
  onboarding_id: string | null;
  intermediary_type: IntermediaryType;
  requested_type: "posp" | "misp";
  display_name: string;
  mobile: string | null;
  email: string | null;
  city: string | null;
  iib_status: string;
  compliance_status: string;
  account_status: string;
  portal_access_status: string;
  visibility_level: string;
  application_id: string | null;
  updated_at: string;
  // Derived fields (populated from application draft_data)
  assigned_rm?: string | null;
}

export interface ApplicationState {
  id: string;
  registration_status: string;
  partner_status: string | null;
  requested_type: "posp" | "misp";
  final_type: string | null;
  draft_data: Record<string, unknown> | null;
  partner_record_id: string | null;
}
