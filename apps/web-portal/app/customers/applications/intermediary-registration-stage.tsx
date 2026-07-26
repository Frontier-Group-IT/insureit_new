"use client";

import { IntermediaryRegistrationForm } from "./intermediary-registration-form";

type Profile = {
  partner_type: "posp" | "misp";
  external_onboarding_id: string | null;
  document_received_at: string | null;
  pos_name: string | null;
  misp_name: string | null;
  applicant_phone: string | null;
  applicant_email: string | null;
  pan_number: string | null;
  gst_number: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  bank_name?: string | null;
  bank_account_number: string | null;
  bank_ifsc_code: string | null;
  dp_name: string | null;
  dp_phone: string | null;
  dp_email: string | null;
  dp_pan_number: string | null;
  aadhaar_last_four: string | null;
};

export function IntermediaryRegistrationStage({ applicationId, profile, iibVerified, documents }: { applicationId: string; profile: Profile; iibVerified: boolean; documents: Array<{ document_type: string; file_name: string }> }) {
  return <IntermediaryRegistrationForm
    profile={profile}
    iibVerified={iibVerified}
    documents={documents}
    onBackToPrimary={() => { window.location.href = `/intermediaries/applications/${applicationId}?stage=primary`; }}
    onBackToDocuments={() => { window.location.href = `/intermediaries/applications/${applicationId}?stage=documents`; }}
  />;
}
