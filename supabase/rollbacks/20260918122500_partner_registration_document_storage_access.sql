begin;

drop policy if exists "Partner portal users can read own intermediary onboarding files" on storage.objects;

drop function if exists public.partner_app_can_read_registration_document_object(text, text);

commit;
