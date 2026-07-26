begin;

create table if not exists public.intermediaries (
  id uuid primary key default gen_random_uuid(),
  application_id uuid unique references public.customer_onboarding_applications(id) on delete set null,
  onboarding_profile_id uuid unique references public.posp_misp_onboarding_profiles(id) on delete set null,
  intermediary_code text unique,
  requested_type text not null check (requested_type in ('posp','misp')),
  intermediary_type text not null check (intermediary_type in ('posp','misp','partner')),
  display_name text not null,
  legal_name text,
  onboarding_id text,
  mobile text,
  email text,
  pan_number text,
  gst_number text,
  address text,
  city text,
  state text,
  postal_code text,
  bank_id uuid,
  bank_name text,
  bank_account_last_four text,
  bank_ifsc_code text,
  associate_employee_id uuid,
  associate_profile_id uuid,
  iib_status text not null default 'pending' check (iib_status in ('pending','checking','cleared','existing_record','invalid','failed')),
  compliance_status text not null default 'pending' check (compliance_status in ('pending','eligible','existing_iib_record','restricted_partner','documents_pending','approved','blocked')),
  account_status text not null default 'under_onboarding' check (account_status in ('draft','under_onboarding','active','inactive','suspended','terminated','rejected')),
  portal_access_status text not null default 'not_created' check (portal_access_status in ('not_created','invited','active','disabled')),
  visibility_level text not null default 'standard' check (visibility_level in ('standard','internal','restricted')),
  source text not null default 'onboarding',
  activated_at timestamptz,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists intermediaries_type_status_idx on public.intermediaries(intermediary_type, account_status);
create index if not exists intermediaries_pan_idx on public.intermediaries(pan_number);
create index if not exists intermediaries_mobile_idx on public.intermediaries(mobile);
create index if not exists intermediaries_onboarding_id_idx on public.intermediaries(onboarding_id);
create index if not exists intermediaries_visibility_idx on public.intermediaries(visibility_level);

create table if not exists public.intermediary_documents (
  id uuid primary key default gen_random_uuid(),
  intermediary_id uuid not null references public.intermediaries(id) on delete cascade,
  application_document_id uuid unique references public.customer_onboarding_documents(id) on delete set null,
  document_type text not null,
  file_name text not null,
  storage_bucket text not null,
  storage_path text not null,
  mime_type text,
  file_size bigint,
  verification_status text not null default 'pending',
  uploaded_by uuid,
  verified_by uuid,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(intermediary_id, document_type)
);

comment on table public.intermediary_documents is 'One common document set for POSP, MISP and Partner intermediaries.';

create table if not exists public.intermediary_referrals (
  id uuid primary key default gen_random_uuid(),
  intermediary_id uuid not null references public.intermediaries(id) on delete restrict,
  customer_id uuid references public.customers(id) on delete set null,
  policy_id uuid,
  source_label text not null default 'referral',
  commission_eligible boolean not null default true,
  referred_at timestamptz not null default now(),
  assigned_employee_id uuid,
  created_by uuid,
  created_at timestamptz not null default now()
);

create index if not exists intermediary_referrals_intermediary_idx on public.intermediary_referrals(intermediary_id, referred_at desc);
create index if not exists intermediary_referrals_customer_idx on public.intermediary_referrals(customer_id);

create table if not exists public.intermediary_commission_ledger (
  id uuid primary key default gen_random_uuid(),
  intermediary_id uuid not null references public.intermediaries(id) on delete restrict,
  customer_id uuid references public.customers(id) on delete set null,
  policy_id uuid,
  premium_amount numeric(14,2),
  commission_basis text,
  commission_rate numeric(8,4),
  gross_commission numeric(14,2) not null default 0,
  tds_amount numeric(14,2) not null default 0,
  adjustment_amount numeric(14,2) not null default 0,
  net_payable numeric(14,2) generated always as (gross_commission - tds_amount + adjustment_amount) stored,
  status text not null default 'pending' check (status in ('pending','calculated','under_review','approved','on_hold','paid','reversed')),
  approved_by uuid,
  approved_at timestamptz,
  paid_at timestamptz,
  payment_reference text,
  internal_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists intermediary_commission_status_idx on public.intermediary_commission_ledger(status, created_at desc);
create index if not exists intermediary_commission_intermediary_idx on public.intermediary_commission_ledger(intermediary_id, created_at desc);

alter table public.customer_onboarding_applications
  add column if not exists intermediary_id uuid references public.intermediaries(id) on delete set null;

create table if not exists public.intermediary_customer_links (
  intermediary_id uuid not null references public.intermediaries(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  relationship_type text not null default 'same_party' check (relationship_type in ('same_party','referred_customer','business_contact')),
  created_at timestamptz not null default now(),
  primary key(intermediary_id, customer_id, relationship_type)
);

create or replace function public.sync_posp_misp_profile_to_intermediary()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_type text;
  v_name text;
  v_iib_status text;
  v_compliance text;
  v_account text;
  v_visibility text;
  v_code text;
  v_intermediary_id uuid;
begin
  v_type := case when new.final_account_type = 'partner' then 'partner' else new.partner_type end;
  v_name := coalesce(nullif(new.pos_name,''), nullif(new.misp_name,''), nullif(new.associate_name,''), 'Unnamed intermediary');
  v_iib_status := case
    when new.iib_remarks = 'No Data Found In POS System' then 'cleared'
    when new.iib_remarks = 'Matching Record Found In DataBase' then 'existing_record'
    else 'pending'
  end;
  v_compliance := case
    when v_type = 'partner' then 'restricted_partner'
    when new.iib_remarks = 'No Data Found In POS System' then case when new.workflow_stage = 'completed' then 'approved' else 'eligible' end
    when new.iib_remarks = 'Matching Record Found In DataBase' then 'existing_iib_record'
    else 'pending'
  end;
  v_account := case
    when new.partner_decision = 'do_not_proceed' then 'rejected'
    when new.workflow_stage = 'completed' then 'active'
    else 'under_onboarding'
  end;
  v_visibility := case when v_type = 'partner' then 'restricted' else 'standard' end;
  v_code := coalesce(nullif(new.external_onboarding_id,''), 'INT-' || upper(substr(replace(new.id::text,'-',''),1,10)));

  insert into public.intermediaries (
    application_id, onboarding_profile_id, intermediary_code, requested_type, intermediary_type,
    display_name, legal_name, onboarding_id, mobile, email, pan_number, gst_number,
    address, city, state, postal_code, bank_id, bank_name, bank_account_last_four,
    bank_ifsc_code, associate_employee_id, associate_profile_id, iib_status,
    compliance_status, account_status, portal_access_status, visibility_level,
    source, activated_at, created_by, updated_by, updated_at
  ) values (
    new.application_id, new.id, v_code, coalesce(new.requested_account_type,new.partner_type), v_type,
    v_name, case when new.partner_type = 'misp' then new.misp_name else new.pos_name end,
    new.external_onboarding_id, new.applicant_phone, new.applicant_email, new.pan_number,
    new.gst_number, new.address, new.city, new.state, new.postal_code, new.bank_id,
    new.bank_name, new.bank_account_last_four, new.bank_ifsc_code,
    new.associate_employee_id, new.associate_profile_id, v_iib_status, v_compliance,
    v_account, 'not_created', v_visibility, new.source,
    case when new.workflow_stage = 'completed' then coalesce(new.training_completed_at, now()) else null end,
    new.created_by, new.updated_by, now()
  )
  on conflict (onboarding_profile_id) do update set
    application_id = excluded.application_id,
    intermediary_code = excluded.intermediary_code,
    requested_type = excluded.requested_type,
    intermediary_type = excluded.intermediary_type,
    display_name = excluded.display_name,
    legal_name = excluded.legal_name,
    onboarding_id = excluded.onboarding_id,
    mobile = excluded.mobile,
    email = excluded.email,
    pan_number = excluded.pan_number,
    gst_number = excluded.gst_number,
    address = excluded.address,
    city = excluded.city,
    state = excluded.state,
    postal_code = excluded.postal_code,
    bank_id = excluded.bank_id,
    bank_name = excluded.bank_name,
    bank_account_last_four = excluded.bank_account_last_four,
    bank_ifsc_code = excluded.bank_ifsc_code,
    associate_employee_id = excluded.associate_employee_id,
    associate_profile_id = excluded.associate_profile_id,
    iib_status = excluded.iib_status,
    compliance_status = excluded.compliance_status,
    account_status = excluded.account_status,
    visibility_level = excluded.visibility_level,
    activated_at = coalesce(public.intermediaries.activated_at, excluded.activated_at),
    updated_by = excluded.updated_by,
    updated_at = now()
  returning id into v_intermediary_id;

  update public.customer_onboarding_applications
  set intermediary_id = v_intermediary_id
  where id = new.application_id and intermediary_id is distinct from v_intermediary_id;

  return new;
end;
$$;

drop trigger if exists trg_sync_posp_misp_profile_to_intermediary on public.posp_misp_onboarding_profiles;
create trigger trg_sync_posp_misp_profile_to_intermediary
after insert or update on public.posp_misp_onboarding_profiles
for each row execute function public.sync_posp_misp_profile_to_intermediary();

create or replace function public.sync_intermediary_document()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_intermediary_id uuid;
begin
  select intermediary_id into v_intermediary_id
  from public.customer_onboarding_applications
  where id = new.application_id;

  if v_intermediary_id is null then return new; end if;

  insert into public.intermediary_documents (
    intermediary_id, application_document_id, document_type, file_name,
    storage_bucket, storage_path, mime_type, file_size, verification_status,
    uploaded_by, verified_by, verified_at, updated_at
  ) values (
    v_intermediary_id, new.id, new.document_type, new.file_name,
    new.storage_bucket, new.storage_path, new.mime_type, new.file_size,
    new.verification_status, new.uploaded_by, new.verified_by, new.verified_at, now()
  )
  on conflict (intermediary_id, document_type) do update set
    application_document_id = excluded.application_document_id,
    file_name = excluded.file_name,
    storage_bucket = excluded.storage_bucket,
    storage_path = excluded.storage_path,
    mime_type = excluded.mime_type,
    file_size = excluded.file_size,
    verification_status = excluded.verification_status,
    uploaded_by = excluded.uploaded_by,
    verified_by = excluded.verified_by,
    verified_at = excluded.verified_at,
    updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_sync_intermediary_document on public.customer_onboarding_documents;
create trigger trg_sync_intermediary_document
after insert or update on public.customer_onboarding_documents
for each row execute function public.sync_intermediary_document();

-- Backfill every existing POSP/MISP onboarding profile into the intermediary master.
update public.posp_misp_onboarding_profiles set updated_at = updated_at;

insert into public.intermediary_documents (
  intermediary_id, application_document_id, document_type, file_name,
  storage_bucket, storage_path, mime_type, file_size, verification_status,
  uploaded_by, verified_by, verified_at
)
select i.id, d.id, d.document_type, d.file_name, d.storage_bucket, d.storage_path,
       d.mime_type, d.file_size, d.verification_status, d.uploaded_by, d.verified_by, d.verified_at
from public.customer_onboarding_documents d
join public.customer_onboarding_applications a on a.id = d.application_id
join public.intermediaries i on i.id = a.intermediary_id
on conflict (intermediary_id, document_type) do update set
  application_document_id = excluded.application_document_id,
  file_name = excluded.file_name,
  storage_bucket = excluded.storage_bucket,
  storage_path = excluded.storage_path,
  mime_type = excluded.mime_type,
  file_size = excluded.file_size,
  verification_status = excluded.verification_status,
  uploaded_by = excluded.uploaded_by,
  verified_by = excluded.verified_by,
  verified_at = excluded.verified_at,
  updated_at = now();

-- Prevent new intermediary records from being inserted into the customer master.
create or replace function public.prevent_intermediary_customer_rows()
returns trigger
language plpgsql
as $$
begin
  if new.partner_type in ('posp','misp','partner') then
    raise exception 'POSP, MISP and Partner records belong in public.intermediaries, not public.customers.' using errcode = '23514';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_prevent_intermediary_customer_rows on public.customers;
create trigger trg_prevent_intermediary_customer_rows
before insert or update of partner_type on public.customers
for each row execute function public.prevent_intermediary_customer_rows();

create or replace view public.intermediary_customer_cleanup_candidates as
select c.id as customer_id,
       c.contact_name,
       c.company_name,
       c.phone,
       c.pan_number,
       c.partner_type,
       i.id as intermediary_id,
       i.intermediary_type,
       i.onboarding_id,
       case when i.id is null then 'No matching intermediary record' else 'Review and link; do not delete if also a policyholder' end as cleanup_action
from public.customers c
left join public.intermediaries i
  on (i.pan_number is not null and i.pan_number = c.pan_number)
  or (i.mobile is not null and i.mobile = c.phone)
where c.partner_type in ('posp','misp','partner');

comment on view public.intermediary_customer_cleanup_candidates is 'Audit-only list. Existing customer rows are not deleted automatically because an intermediary may also be a genuine policyholder.';

commit;
