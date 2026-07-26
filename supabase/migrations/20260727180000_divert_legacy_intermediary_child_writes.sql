begin;

create or replace function public.divert_intermediary_contact_write()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
begin
  if exists(select 1 from public.intermediary_onboarding_applications where id=new.application_id) then
    insert into public.intermediary_onboarding_contacts(
      application_id,contact_role,full_name,phone,email,is_designated_person,
      login_required,membership_status,created_at,updated_at
    ) values (
      new.application_id,new.contact_role,new.full_name,new.phone,new.email,
      new.contact_role in('misp_dp','misp_primary_dp'),false,
      coalesce(new.membership_status,'pending'),coalesce(new.created_at,now()),now()
    )
    on conflict(application_id,contact_role) do update set
      full_name=excluded.full_name,phone=excluded.phone,email=excluded.email,
      is_designated_person=excluded.is_designated_person,login_required=false,
      membership_status=excluded.membership_status,updated_at=now();
    return null;
  end if;
  return new;
end;
$$;

drop trigger if exists divert_intermediary_contact_write on public.customer_onboarding_contacts;
create trigger divert_intermediary_contact_write
before insert or update on public.customer_onboarding_contacts
for each row execute function public.divert_intermediary_contact_write();

create or replace function public.divert_intermediary_document_write()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
begin
  if exists(select 1 from public.intermediary_onboarding_applications where id=new.application_id) then
    insert into public.intermediary_onboarding_documents(
      application_id,document_type,file_name,storage_bucket,storage_path,
      mime_type,file_size,verification_status,uploaded_by,verified_by,
      verified_at,created_at,updated_at
    ) values (
      new.application_id,new.document_type,new.file_name,new.storage_bucket,new.storage_path,
      new.mime_type,new.file_size,coalesce(new.verification_status,'pending'),new.uploaded_by,
      new.verified_by,new.verified_at,coalesce(new.created_at,now()),now()
    )
    on conflict(application_id,document_type) do update set
      file_name=excluded.file_name,storage_bucket=excluded.storage_bucket,
      storage_path=excluded.storage_path,mime_type=excluded.mime_type,
      file_size=excluded.file_size,verification_status=excluded.verification_status,
      uploaded_by=excluded.uploaded_by,verified_by=excluded.verified_by,
      verified_at=excluded.verified_at,updated_at=now();
    return null;
  end if;
  return new;
end;
$$;

drop trigger if exists divert_intermediary_document_write on public.customer_onboarding_documents;
create trigger divert_intermediary_document_write
before insert or update on public.customer_onboarding_documents
for each row execute function public.divert_intermediary_document_write();

comment on function public.divert_intermediary_contact_write() is 'Compatibility bridge during cutover. Intermediary child records are stored only in intermediary_onboarding_contacts.';
comment on function public.divert_intermediary_document_write() is 'Compatibility bridge during cutover. Intermediary child records are stored only in intermediary_onboarding_documents.';

commit;
