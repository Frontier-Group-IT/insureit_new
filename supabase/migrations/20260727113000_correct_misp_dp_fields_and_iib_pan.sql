begin;

alter table public.posp_misp_onboarding_profiles
  add column if not exists dp_first_name text,
  add column if not exists dp_middle_name text,
  add column if not exists dp_last_name text,
  add column if not exists dp_date_of_birth date,
  add column if not exists dp_aadhaar_last_four text,
  add column if not exists dp_aadhaar_hash text,
  add column if not exists dp_aadhaar_number_encrypted text;

update public.posp_misp_onboarding_profiles
set dp_first_name = coalesce(dp_first_name, nullif(split_part(trim(coalesce(dp_name, '')), ' ', 1), '')),
    dp_last_name = coalesce(dp_last_name,
      case when array_length(regexp_split_to_array(trim(coalesce(dp_name, '')), '\s+'), 1) > 1
        then (regexp_split_to_array(trim(dp_name), '\s+'))[array_length(regexp_split_to_array(trim(dp_name), '\s+'), 1)]
        else null end),
    dp_middle_name = coalesce(dp_middle_name,
      case when array_length(regexp_split_to_array(trim(coalesce(dp_name, '')), '\s+'), 1) > 2
        then array_to_string((regexp_split_to_array(trim(dp_name), '\s+'))[2:array_length(regexp_split_to_array(trim(dp_name), '\s+'), 1)-1], ' ')
        else null end),
    dp_date_of_birth = coalesce(dp_date_of_birth, date_of_birth),
    dp_aadhaar_last_four = coalesce(dp_aadhaar_last_four, aadhaar_last_four),
    dp_aadhaar_hash = coalesce(dp_aadhaar_hash, aadhaar_hash),
    dp_aadhaar_number_encrypted = coalesce(dp_aadhaar_number_encrypted, aadhaar_number_encrypted)
where partner_type = 'misp';

create or replace function public.sync_misp_dp_identity_fields()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.partner_type = 'misp' then
    new.dp_name := trim(concat_ws(' ', nullif(new.dp_first_name,''), nullif(new.dp_middle_name,''), nullif(new.dp_last_name,'')));
    if nullif(new.dp_name,'') is null and old.dp_name is not null then new.dp_name := old.dp_name; end if;
    new.dp_date_of_birth := coalesce(new.dp_date_of_birth, new.date_of_birth);
    new.dp_aadhaar_last_four := coalesce(new.dp_aadhaar_last_four, new.aadhaar_last_four);
    new.dp_aadhaar_hash := coalesce(new.dp_aadhaar_hash, new.aadhaar_hash);
    new.dp_aadhaar_number_encrypted := coalesce(new.dp_aadhaar_number_encrypted, new.aadhaar_number_encrypted);
    new.date_of_birth := coalesce(new.dp_date_of_birth, new.date_of_birth);
    new.aadhaar_last_four := coalesce(new.dp_aadhaar_last_four, new.aadhaar_last_four);
    new.aadhaar_hash := coalesce(new.dp_aadhaar_hash, new.aadhaar_hash);
    new.aadhaar_number_encrypted := coalesce(new.dp_aadhaar_number_encrypted, new.aadhaar_number_encrypted);
    new.applicant_phone := coalesce(new.dp_phone, new.applicant_phone);
    new.applicant_email := coalesce(new.dp_email, new.applicant_email);
  end if;
  return new;
end;
$$;

drop trigger if exists sync_misp_dp_identity_fields on public.posp_misp_onboarding_profiles;
create trigger sync_misp_dp_identity_fields
before insert or update on public.posp_misp_onboarding_profiles
for each row execute function public.sync_misp_dp_identity_fields();

create or replace function public.validate_posp_misp_required_fields()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_ifsc text := upper(regexp_replace(coalesce(new.bank_ifsc_code,''), '\s', '', 'g'));
  v_pan text := upper(regexp_replace(coalesce(new.pan_number,''), '\s', '', 'g'));
  v_dp_pan text := upper(regexp_replace(coalesce(new.dp_pan_number,''), '\s', '', 'g'));
begin
  if nullif(trim(coalesce(new.external_onboarding_id,'')),'') is null then raise exception '% ID is required.', upper(new.partner_type); end if;
  if nullif(trim(coalesce(new.address,'')),'') is null or nullif(trim(coalesce(new.city,'')),'') is null or nullif(trim(coalesce(new.state,'')),'') is null then raise exception 'Address, City and State are required.'; end if;
  if coalesce(new.postal_code,'') !~ '^[0-9]{6}$' then raise exception 'PIN Code must contain exactly 6 digits.'; end if;
  if v_pan !~ '^[A-Z]{5}[0-9]{4}[A-Z]$' then raise exception '% PAN is invalid.', upper(new.partner_type); end if;
  if new.bank_id is null or nullif(trim(coalesce(new.bank_account_number,'')),'') is null then raise exception 'Bank Name and Account Number are required.'; end if;
  if v_ifsc !~ '^[A-Z]{4}0[A-Z0-9]{6}$' then raise exception 'IFSC Code is invalid.'; end if;

  if new.partner_type = 'misp' then
    if nullif(trim(coalesce(new.dp_first_name,'')),'') is null or nullif(trim(coalesce(new.dp_middle_name,'')),'') is null or nullif(trim(coalesce(new.dp_last_name,'')),'') is null then raise exception 'DP First Name, DP Middle Name and DP Last Name are required.'; end if;
    if new.dp_phone is null or new.dp_email is null then raise exception 'DP Contact and DP Email are required.'; end if;
    if v_dp_pan !~ '^[A-Z]{5}[0-9]{4}[A-Z]$' then raise exception 'DP PAN No is invalid.'; end if;
    if new.dp_date_of_birth is null and new.date_of_birth is null then raise exception 'DP Date of Birth is required.'; end if;
    if new.dp_aadhaar_hash is null and new.aadhaar_hash is null then raise exception 'DP Aadhaar Number is required.'; end if;
  end if;
  return new;
end;
$$;

drop trigger if exists validate_posp_misp_required_fields on public.posp_misp_onboarding_profiles;
create trigger validate_posp_misp_required_fields
before insert or update of external_onboarding_id, address, city, state, postal_code, pan_number, bank_id, bank_account_number, bank_ifsc_code, dp_first_name, dp_middle_name, dp_last_name, dp_phone, dp_email, dp_pan_number, dp_date_of_birth, dp_aadhaar_hash
on public.posp_misp_onboarding_profiles
for each row execute function public.validate_posp_misp_required_fields();

create or replace function public.queue_posp_misp_pan_on_profile_ready()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pan text := case when new.partner_type = 'misp' then new.dp_pan_number else new.pan_number end;
  v_old_pan text := case when old.partner_type = 'misp' then old.dp_pan_number else old.pan_number end;
begin
  v_pan := upper(regexp_replace(coalesce(v_pan,''), '\s', '', 'g'));
  v_old_pan := upper(regexp_replace(coalesce(v_old_pan,''), '\s', '', 'g'));

  if tg_op = 'UPDATE' and v_old_pan is distinct from v_pan then
    update public.posp_misp_onboarding_profiles
    set iib_remarks = null, final_account_type = null, partner_decision = 'not_applicable', partner_decision_at = null, partner_decision_by = null, partner_decision_remark = null, updated_at = now()
    where id = new.id;
  end if;

  if new.workflow_stage = 'pre_iib' and new.bank_id is not null and v_pan ~ '^[A-Z]{5}[0-9]{4}[A-Z]$'
     and exists (select 1 from public.customer_onboarding_applications app where app.id = new.application_id and app.status in ('submitted','under_review','changes_requested')) then
    insert into public.pan_verification_jobs(application_id,onboarding_profile_id,partner_type,pan_number,status,result_code,result_message,last_error,checked_by_device,requested_at,started_at,completed_at,attempt_count,updated_at)
    values(new.application_id,new.id,new.partner_type,v_pan,'pending',null,null,null,null,now(),null,null,0,now())
    on conflict(application_id) do update set onboarding_profile_id=excluded.onboarding_profile_id,partner_type=excluded.partner_type,pan_number=excluded.pan_number,status='pending',result_code=null,result_message=null,last_error=null,checked_by_device=null,requested_at=now(),started_at=null,completed_at=null,attempt_count=0,updated_at=now()
    where public.pan_verification_jobs.pan_number is distinct from excluded.pan_number;
  end if;
  return new;
end;
$$;

drop trigger if exists queue_posp_misp_pan_when_ready on public.posp_misp_onboarding_profiles;
create trigger queue_posp_misp_pan_when_ready
after insert or update of pan_number, dp_pan_number, bank_id, workflow_stage
on public.posp_misp_onboarding_profiles
for each row execute function public.queue_posp_misp_pan_on_profile_ready();

update public.pan_verification_jobs job
set pan_number = case when profile.partner_type='misp' then profile.dp_pan_number else profile.pan_number end,
    status='pending', result_code=null, result_message=null, last_error=null, checked_by_device=null, requested_at=now(), started_at=null, completed_at=null, attempt_count=0, updated_at=now()
from public.posp_misp_onboarding_profiles profile
where job.application_id=profile.application_id
  and case when profile.partner_type='misp' then profile.dp_pan_number else profile.pan_number end ~ '^[A-Z]{5}[0-9]{4}[A-Z]$'
  and job.pan_number is distinct from case when profile.partner_type='misp' then profile.dp_pan_number else profile.pan_number end;

commit;
