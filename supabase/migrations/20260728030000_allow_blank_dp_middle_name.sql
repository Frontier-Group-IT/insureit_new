begin;

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
  if nullif(trim(coalesce(new.external_onboarding_id,'')),'') is null then
    raise exception '% ID is required.', upper(new.partner_type);
  end if;

  if nullif(trim(coalesce(new.address,'')),'') is null
     or nullif(trim(coalesce(new.city,'')),'') is null
     or nullif(trim(coalesce(new.state,'')),'') is null then
    raise exception 'Address, City and State are required.';
  end if;

  if coalesce(new.postal_code,'') !~ '^[0-9]{6}$' then
    raise exception 'PIN Code must contain exactly 6 digits.';
  end if;

  if v_pan !~ '^[A-Z]{5}[0-9]{4}[A-Z]$' then
    raise exception '% PAN is invalid.', upper(new.partner_type);
  end if;

  if new.bank_id is null or nullif(trim(coalesce(new.bank_account_number,'')),'') is null then
    raise exception 'Bank Name and Account Number are required.';
  end if;

  if v_ifsc !~ '^[A-Z]{4}0[A-Z0-9]{6}$' then
    raise exception 'IFSC Code is invalid.';
  end if;

  if new.partner_type = 'misp' then
    if nullif(trim(coalesce(new.dp_first_name,'')),'') is null
       or nullif(trim(coalesce(new.dp_last_name,'')),'') is null then
      raise exception 'DP First Name and DP Last Name are required.';
    end if;

    if new.dp_phone is null or new.dp_email is null then
      raise exception 'DP Contact and DP Email are required.';
    end if;

    if v_dp_pan !~ '^[A-Z]{5}[0-9]{4}[A-Z]$' then
      raise exception 'DP PAN No is invalid.';
    end if;

    if new.dp_date_of_birth is null and new.date_of_birth is null then
      raise exception 'DP Date of Birth is required.';
    end if;

    if new.dp_aadhaar_hash is null and new.aadhaar_hash is null then
      raise exception 'DP Aadhaar Number is required.';
    end if;
  end if;

  return new;
end;
$$;

comment on function public.validate_posp_misp_required_fields() is
'Validates required POSP/MISP onboarding fields. DP middle name is optional.';

commit;
