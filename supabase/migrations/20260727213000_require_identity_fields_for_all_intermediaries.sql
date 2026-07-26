begin;

create or replace function public.validate_required_intermediary_identity_fields()
returns trigger
language plpgsql
as $$
begin
  if nullif(trim(coalesce(new.applicant_email, '')), '') is null then
    raise exception 'Email is required for POSP and MISP onboarding.' using errcode = '23514';
  end if;

  if new.date_of_birth is null then
    raise exception 'Date of Birth is required for POSP and MISP onboarding.' using errcode = '23514';
  end if;

  if nullif(trim(coalesce(new.aadhaar_hash, '')), '') is null
     or nullif(trim(coalesce(new.aadhaar_last_four, '')), '') is null then
    raise exception 'A valid 12-digit Aadhaar Number is required for POSP and MISP onboarding.' using errcode = '23514';
  end if;

  if new.partner_type = 'misp' then
    if nullif(trim(coalesce(new.dp_email, '')), '') is null then
      raise exception 'DP Email is required for MISP onboarding.' using errcode = '23514';
    end if;
    if nullif(trim(coalesce(new.dp_pan_number, '')), '') is null then
      raise exception 'DP PAN No is required for MISP onboarding.' using errcode = '23514';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists validate_required_intermediary_identity_fields on public.posp_misp_onboarding_profiles;
create trigger validate_required_intermediary_identity_fields
before insert or update of applicant_email, date_of_birth, aadhaar_hash, aadhaar_last_four, dp_email, dp_pan_number
on public.posp_misp_onboarding_profiles
for each row execute function public.validate_required_intermediary_identity_fields();

comment on function public.validate_required_intermediary_identity_fields() is
'Applies the same mandatory Email, Date of Birth and Aadhaar requirements to manual and Excel intermediary onboarding.';

commit;
