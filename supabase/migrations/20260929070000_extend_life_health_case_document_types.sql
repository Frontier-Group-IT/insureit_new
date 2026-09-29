-- Allow the compact Life Policy Onboarding document set to persist in the
-- existing one-document-per-type Life/Health case document table.

alter table public.life_health_case_documents
  drop constraint if exists life_health_case_documents_document_type_check;

alter table public.life_health_case_documents
  add constraint life_health_case_documents_document_type_check
  check (
    document_type in (
      'proposal_form',
      'benefit_illustration',
      'premium_receipt',
      'policy_copy',
      'kyc',
      'other_document'
    )
  ) not valid;

alter table public.life_health_case_documents
  validate constraint life_health_case_documents_document_type_check;
