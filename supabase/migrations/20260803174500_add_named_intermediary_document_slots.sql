begin;

alter table public.intermediary_onboarding_documents
  add column if not exists document_label text;

alter table public.intermediary_onboarding_documents
  drop constraint if exists intermediary_onboarding_documents_document_label_length_check;

alter table public.intermediary_onboarding_documents
  add constraint intermediary_onboarding_documents_document_label_length_check
  check (document_label is null or char_length(btrim(document_label)) between 1 and 60);

comment on column public.intermediary_onboarding_documents.document_label is
  'User-facing label for named custom or historical intermediary documents. Standard document types may leave this null.';

commit;
