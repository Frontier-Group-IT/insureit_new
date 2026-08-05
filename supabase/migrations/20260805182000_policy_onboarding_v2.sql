begin;

create extension if not exists pgcrypto;

alter table public.customers
  add column if not exists customer_type text not null default 'individual',
  add column if not exists alternate_phone text,
  add column if not exists pan text,
  add column if not exists gstin text,
  add column if not exists district text,
  add column if not exists pincode text,
  add column if not exists country text not null default 'India',
  add column if not exists source text,
  add column if not exists status text not null default 'active',
  add column if not exists updated_at timestamptz not null default now();

create index if not exists customers_phone_idx on public.customers (phone);
create index if not exists customers_name_lower_idx on public.customers (lower(contact_name));
create index if not exists customers_pan_idx on public.customers (pan) where pan is not null;

alter table public.vehicles
  add column if not exists vehicle_no_normalized text,
  add column if not exists vehicle_class_code text,
  add column if not exists vehicle_class_description text,
  add column if not exists vehicle_category text,
  add column if not exists body_type text,
  add column if not exists is_commercial boolean,
  add column if not exists fuel_type text,
  add column if not exists color text,
  add column if not exists manufacture_date text,
  add column if not exists engine_capacity_cc numeric,
  add column if not exists seating_capacity integer,
  add column if not exists standing_capacity integer,
  add column if not exists sleeper_capacity integer,
  add column if not exists unladen_weight_kg numeric,
  add column if not exists wheel_base_mm numeric,
  add column if not exists cylinders integer,
  add column if not exists emission_norm text,
  add column if not exists registration_status text,
  add column if not exists registration_status_as_on date,
  add column if not exists rto_name text,
  add column if not exists rto_state text,
  add column if not exists puc_no text,
  add column if not exists permit_type text,
  add column if not exists permit_valid_from date,
  add column if not exists national_permit_no text,
  add column if not exists financed boolean,
  add column if not exists financer_name text,
  add column if not exists blacklist_status text,
  add column if not exists authbridge_verified boolean not null default false,
  add column if not exists authbridge_last_verified_at timestamptz,
  add column if not exists authbridge_transaction_id text,
  add column if not exists authbridge_provider_transaction_id text,
  add column if not exists updated_at timestamptz not null default now();

update public.vehicles
set vehicle_no_normalized = upper(regexp_replace(coalesce(vehicle_no, ''), '[^A-Za-z0-9]', '', 'g'))
where vehicle_no_normalized is null;

create unique index if not exists vehicles_vehicle_no_normalized_uidx
  on public.vehicles (vehicle_no_normalized)
  where vehicle_no_normalized is not null and vehicle_no_normalized <> '';
create unique index if not exists vehicles_chassis_no_uidx
  on public.vehicles (upper(chassis_no))
  where chassis_no is not null and btrim(chassis_no) <> '';
create index if not exists vehicles_engine_no_idx
  on public.vehicles (upper(engine_no))
  where engine_no is not null and btrim(engine_no) <> '';

alter table public.policies
  add column if not exists policy_code text,
  add column if not exists policy_no_normalized text,
  add column if not exists intermediary_type text,
  add column if not exists intermediary_code text,
  add column if not exists lead_source text,
  add column if not exists rm_name text,
  add column if not exists business_line text not null default 'Motor',
  add column if not exists business_type text,
  add column if not exists issuance_date date,
  add column if not exists policy_term text,
  add column if not exists status text not null default 'active',
  add column if not exists remarks text,
  add column if not exists calculation_version text not null default 'prototype_v1',
  add column if not exists created_by uuid,
  add column if not exists updated_at timestamptz not null default now();

update public.policies
set policy_no_normalized = upper(regexp_replace(coalesce(policy_no, ''), '[^A-Za-z0-9]', '', 'g'))
where policy_no_normalized is null;

create unique index if not exists policies_insurer_policy_no_uidx
  on public.policies (insurance_company_id, policy_no_normalized)
  where policy_no_normalized is not null and policy_no_normalized <> '';

create table if not exists public.vehicle_ownership_history (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references public.vehicles(id) on delete cascade,
  previous_customer_id uuid references public.customers(id) on delete set null,
  customer_id uuid not null references public.customers(id) on delete restrict,
  effective_from date not null default current_date,
  effective_to date,
  change_reason text,
  confirmed_by uuid,
  policy_id uuid,
  created_at timestamptz not null default now()
);

create table if not exists public.policy_party_snapshots (
  id uuid primary key default gen_random_uuid(),
  policy_id uuid not null references public.policies(id) on delete cascade,
  insured_name text not null,
  phone text not null,
  address text,
  city text,
  district text,
  state text,
  pincode text,
  registration_number text not null,
  vehicle_class text,
  vehicle_category text,
  make text,
  model text,
  fuel_type text,
  manufacturing_year integer,
  capacity_value text,
  chassis_no text,
  engine_no text,
  rto_name text,
  rto_state text,
  created_at timestamptz not null default now()
);

create table if not exists public.policy_premium_details (
  id uuid primary key default gen_random_uuid(),
  policy_id uuid not null unique references public.policies(id) on delete cascade,
  od_premium numeric not null default 0,
  tp_premium numeric not null default 0,
  cpa_opted boolean not null default false,
  cpa_amount numeric not null default 0,
  net_premium numeric not null default 0,
  gst_amount numeric not null default 0,
  gross_premium numeric not null default 0,
  gst_rule text,
  calculation_version text not null default 'prototype_v1',
  calculation_overridden boolean not null default false,
  override_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.policy_payin_details (
  id uuid primary key default gen_random_uuid(),
  policy_id uuid not null unique references public.policies(id) on delete cascade,
  payout_basis text,
  projected_od_percent numeric not null default 0,
  projected_od_amount numeric not null default 0,
  projected_tp_percent numeric not null default 0,
  projected_tp_amount numeric not null default 0,
  insurer_scheme_amount numeric not null default 0,
  total_projected_payin numeric not null default 0,
  tds_percent numeric not null default 10,
  tds_amount numeric not null default 0,
  payin_after_tds numeric not null default 0,
  calculation_version text not null default 'prototype_v1',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.policy_payin_bills (
  id uuid primary key default gen_random_uuid(),
  policy_id uuid not null references public.policies(id) on delete cascade,
  bill_number text,
  billed_amount numeric not null default 0,
  bill_date date,
  received_amount numeric not null default 0,
  received_date date,
  status text not null default 'Unbilled',
  short_payout_amount numeric not null default 0,
  remarks text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.policy_intermediary_payouts (
  id uuid primary key default gen_random_uuid(),
  policy_id uuid not null references public.policies(id) on delete cascade,
  intermediary_type text,
  intermediary_code text,
  retention_amount numeric not null default 0,
  od_payout_percent numeric not null default 0,
  od_payout_amount numeric not null default 0,
  tp_payout_percent numeric not null default 0,
  tp_payout_amount numeric not null default 0,
  gross_payout numeric not null default 0,
  status text not null default 'Pending',
  payout_date date,
  voucher_number text,
  remarks text,
  calculation_version text not null default 'prototype_v1',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.vehicle_rc_verifications (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid references public.vehicles(id) on delete set null,
  policy_id uuid references public.policies(id) on delete set null,
  provider text not null default 'authbridge',
  service_code text not null default '372',
  registration_number text not null,
  gateway_transaction_id text,
  provider_transaction_id text,
  lookup_status text not null default 'success',
  looked_up_at timestamptz,
  applied_to_form boolean not null default false,
  applied_at timestamptz,
  requested_by uuid,
  created_at timestamptz not null default now()
);

create or replace function public.onboard_motor_policy(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_customer_id uuid;
  v_vehicle_id uuid;
  v_existing_vehicle public.vehicles%rowtype;
  v_policy_id uuid;
  v_policy_code text;
  v_registration text;
  v_phone text;
  v_name text;
  v_selected_customer uuid;
  v_transfer boolean;
  v_can_transfer boolean;
  v_od numeric := coalesce((p_payload #>> '{premium,od}')::numeric, 0);
  v_tp numeric := coalesce((p_payload #>> '{premium,tp}')::numeric, 0);
  v_cpa numeric := case when coalesce((p_payload #>> '{premium,cpaOpted}')::boolean, false) then coalesce((p_payload #>> '{premium,cpa}')::numeric, 0) else 0 end;
  v_net numeric;
  v_gst numeric;
  v_gross numeric;
  v_od_payin numeric;
  v_tp_payin numeric;
  v_scheme numeric := coalesce((p_payload #>> '{payin,scheme}')::numeric, 0);
  v_total_payin numeric;
  v_tds numeric;
  v_payin_after_tds numeric;
  v_od_payout numeric;
  v_tp_payout numeric;
  v_gross_payout numeric;
  v_capacity numeric;
begin
  v_registration := upper(regexp_replace(coalesce(p_payload #>> '{vehicle,registrationNumber}', ''), '[^A-Za-z0-9]', '', 'g'));
  v_phone := regexp_replace(coalesce(p_payload #>> '{customer,phone}', ''), '[^0-9]', '', 'g');
  v_name := btrim(coalesce(p_payload #>> '{customer,name}', ''));
  v_selected_customer := nullif(p_payload #>> '{resolution,selectedCustomerId}', '')::uuid;
  v_transfer := coalesce((p_payload #>> '{resolution,confirmOwnershipTransfer}')::boolean, false);
  v_can_transfer := coalesce((p_payload #>> '{resolution,canTransferOwnership}')::boolean, false);

  if v_name = '' or length(v_phone) <> 10 or v_registration = '' then
    raise exception 'Insured name, valid 10 digit phone and registration number are required.';
  end if;

  if v_selected_customer is not null then
    select id into v_customer_id from public.customers where id = v_selected_customer;
    if v_customer_id is null then raise exception 'Selected customer does not exist.'; end if;
    update public.customers set
      phone = v_phone,
      contact_name = v_name,
      address = coalesce(nullif(p_payload #>> '{customer,address}', ''), address),
      city = coalesce(nullif(p_payload #>> '{customer,city}', ''), city),
      district = coalesce(nullif(p_payload #>> '{customer,district}', ''), district),
      state = coalesce(nullif(p_payload #>> '{customer,state}', ''), state),
      pincode = coalesce(nullif(p_payload #>> '{customer,pincode}', ''), pincode),
      source = coalesce(nullif(p_payload #>> '{customer,source}', ''), source),
      updated_at = now()
    where id = v_customer_id;
  else
    insert into public.customers (
      customer_code, customer_type, contact_name, phone, email, address, city, district, state, pincode, country, source, status, created_by, updated_at
    ) values (
      'CUST-' || to_char(clock_timestamp(), 'YYYYMMDDHH24MISSMS'),
      coalesce(nullif(p_payload #>> '{customer,type}', ''), 'individual'),
      v_name,
      v_phone,
      nullif(p_payload #>> '{customer,email}', ''),
      nullif(p_payload #>> '{customer,address}', ''),
      nullif(p_payload #>> '{customer,city}', ''),
      nullif(p_payload #>> '{customer,district}', ''),
      nullif(p_payload #>> '{customer,state}', ''),
      nullif(p_payload #>> '{customer,pincode}', ''),
      coalesce(nullif(p_payload #>> '{customer,country}', ''), 'India'),
      nullif(p_payload #>> '{customer,source}', ''),
      'active',
      nullif(p_payload #>> '{meta,requestedBy}', '')::uuid,
      now()
    ) returning id into v_customer_id;
  end if;

  select * into v_existing_vehicle
  from public.vehicles
  where vehicle_no_normalized = v_registration
  for update;

  if found then
    v_vehicle_id := v_existing_vehicle.id;
    if v_existing_vehicle.customer_id <> v_customer_id then
      if not v_transfer then
        raise exception 'OWNERSHIP_CONFLICT:%:%', v_existing_vehicle.customer_id, v_existing_vehicle.id;
      end if;
      if not v_can_transfer then
        raise exception 'Ownership transfer requires manager or administrator approval.';
      end if;
      insert into public.vehicle_ownership_history(vehicle_id, previous_customer_id, customer_id, change_reason, confirmed_by)
      values (v_vehicle_id, v_existing_vehicle.customer_id, v_customer_id, coalesce(nullif(p_payload #>> '{resolution,transferReason}', ''), 'Policy onboarding ownership confirmation'), nullif(p_payload #>> '{meta,requestedBy}', '')::uuid);
      update public.vehicles set customer_id = v_customer_id where id = v_vehicle_id;
    end if;

    update public.vehicles set
      vehicle_class_code = coalesce(nullif(p_payload #>> '{vehicle,classCode}', ''), vehicle_class_code),
      vehicle_class_description = coalesce(nullif(p_payload #>> '{vehicle,classDescription}', ''), vehicle_class_description),
      vehicle_category = coalesce(nullif(p_payload #>> '{vehicle,category}', ''), vehicle_category),
      vehicle_type = coalesce(nullif(p_payload #>> '{vehicle,classCode}', ''), vehicle_type),
      body_type = coalesce(nullif(p_payload #>> '{vehicle,bodyType}', ''), body_type),
      is_commercial = coalesce(nullif(p_payload #>> '{vehicle,isCommercial}', '')::boolean, is_commercial),
      make = coalesce(nullif(p_payload #>> '{vehicle,make}', ''), make),
      model = coalesce(nullif(p_payload #>> '{vehicle,model}', ''), model),
      fuel_type = coalesce(nullif(p_payload #>> '{vehicle,fuelType}', ''), fuel_type),
      color = coalesce(nullif(p_payload #>> '{vehicle,color}', ''), color),
      manufacture_date = coalesce(nullif(p_payload #>> '{vehicle,manufactureDate}', ''), manufacture_date),
      year = coalesce(nullif(p_payload #>> '{vehicle,manufacturingYear}', '')::integer, year),
      engine_capacity_cc = coalesce(nullif(p_payload #>> '{vehicle,engineCapacity}', '')::numeric, engine_capacity_cc),
      seating_capacity = coalesce(nullif(p_payload #>> '{vehicle,seatingCapacity}', '')::integer, seating_capacity),
      standing_capacity = coalesce(nullif(p_payload #>> '{vehicle,standingCapacity}', '')::integer, standing_capacity),
      sleeper_capacity = coalesce(nullif(p_payload #>> '{vehicle,sleeperCapacity}', '')::integer, sleeper_capacity),
      gvw_kg = coalesce(nullif(p_payload #>> '{vehicle,grossWeight}', '')::numeric, gvw_kg),
      unladen_weight_kg = coalesce(nullif(p_payload #>> '{vehicle,unladenWeight}', '')::numeric, unladen_weight_kg),
      wheel_base_mm = coalesce(nullif(p_payload #>> '{vehicle,wheelBase}', '')::numeric, wheel_base_mm),
      cylinders = coalesce(nullif(p_payload #>> '{vehicle,cylinders}', '')::integer, cylinders),
      chassis_no = coalesce(nullif(upper(p_payload #>> '{vehicle,chassisNumber}'), ''), chassis_no),
      engine_no = coalesce(nullif(upper(p_payload #>> '{vehicle,engineNumber}'), ''), engine_no),
      emission_norm = coalesce(nullif(p_payload #>> '{vehicle,normsType}', ''), emission_norm),
      registration_date = coalesce(nullif(p_payload #>> '{vehicle,registrationDate}', '')::date, registration_date),
      registration_status = coalesce(nullif(p_payload #>> '{vehicle,registrationStatus}', ''), registration_status),
      registration_status_as_on = coalesce(nullif(p_payload #>> '{vehicle,statusAsOn}', '')::date, registration_status_as_on),
      rto_name = coalesce(nullif(p_payload #>> '{vehicle,rtoName}', ''), rto_name),
      rto_state = coalesce(nullif(p_payload #>> '{vehicle,rtoState}', ''), rto_state),
      fitness_expiry_date = coalesce(nullif(p_payload #>> '{vehicle,fitnessExpiryDate}', '')::date, fitness_expiry_date),
      road_tax_expiry_date = coalesce(nullif(p_payload #>> '{vehicle,taxUpto}', '')::date, road_tax_expiry_date),
      puc_no = coalesce(nullif(p_payload #>> '{vehicle,pucNumber}', ''), puc_no),
      puc_expiry_date = coalesce(nullif(p_payload #>> '{vehicle,pucUpto}', '')::date, puc_expiry_date),
      permit_no = coalesce(nullif(p_payload #>> '{vehicle,permitNumber}', ''), permit_no),
      permit_type = coalesce(nullif(p_payload #>> '{vehicle,permitType}', ''), permit_type),
      permit_valid_from = coalesce(nullif(p_payload #>> '{vehicle,permitValidFrom}', '')::date, permit_valid_from),
      local_permit_expiry_date = coalesce(nullif(p_payload #>> '{vehicle,permitValidUpto}', '')::date, local_permit_expiry_date),
      national_permit_no = coalesce(nullif(p_payload #>> '{vehicle,nationalPermitNumber}', ''), national_permit_no),
      national_permit_expiry_date = coalesce(nullif(p_payload #>> '{vehicle,nationalPermitUpto}', '')::date, national_permit_expiry_date),
      financed = coalesce(nullif(p_payload #>> '{vehicle,financed}', '')::boolean, financed),
      financer_name = coalesce(nullif(p_payload #>> '{vehicle,financerName}', ''), financer_name),
      blacklist_status = coalesce(nullif(p_payload #>> '{vehicle,blacklistStatus}', ''), blacklist_status),
      authbridge_verified = coalesce((p_payload #>> '{authbridge,applied}')::boolean, authbridge_verified),
      authbridge_last_verified_at = coalesce(nullif(p_payload #>> '{authbridge,lookedUpAt}', '')::timestamptz, authbridge_last_verified_at),
      authbridge_transaction_id = coalesce(nullif(p_payload #>> '{authbridge,transactionId}', ''), authbridge_transaction_id),
      authbridge_provider_transaction_id = coalesce(nullif(p_payload #>> '{authbridge,providerTransactionId}', ''), authbridge_provider_transaction_id),
      updated_at = now()
    where id = v_vehicle_id;
  else
    insert into public.vehicles (
      customer_id, vehicle_no, vehicle_no_normalized, vehicle_type, vehicle_class_code, vehicle_class_description, vehicle_category, body_type, is_commercial,
      make, model, fuel_type, color, manufacture_date, year, engine_capacity_cc, seating_capacity, standing_capacity, sleeper_capacity, gvw_kg,
      unladen_weight_kg, wheel_base_mm, cylinders, chassis_no, engine_no, emission_norm, registration_date, registration_status,
      registration_status_as_on, rto_name, rto_state, fitness_expiry_date, road_tax_expiry_date, puc_no, puc_expiry_date,
      permit_no, permit_type, permit_valid_from, local_permit_expiry_date, national_permit_no, national_permit_expiry_date,
      financed, financer_name, blacklist_status, authbridge_verified, authbridge_last_verified_at, authbridge_transaction_id,
      authbridge_provider_transaction_id, updated_at
    ) values (
      v_customer_id, v_registration, v_registration, p_payload #>> '{vehicle,classCode}', p_payload #>> '{vehicle,classCode}', p_payload #>> '{vehicle,classDescription}', p_payload #>> '{vehicle,category}', nullif(p_payload #>> '{vehicle,bodyType}', ''), nullif(p_payload #>> '{vehicle,isCommercial}', '')::boolean,
      nullif(p_payload #>> '{vehicle,make}', ''), nullif(p_payload #>> '{vehicle,model}', ''), nullif(p_payload #>> '{vehicle,fuelType}', ''), nullif(p_payload #>> '{vehicle,color}', ''), nullif(p_payload #>> '{vehicle,manufactureDate}', ''), nullif(p_payload #>> '{vehicle,manufacturingYear}', '')::integer,
      nullif(p_payload #>> '{vehicle,engineCapacity}', '')::numeric, nullif(p_payload #>> '{vehicle,seatingCapacity}', '')::integer, nullif(p_payload #>> '{vehicle,standingCapacity}', '')::integer, nullif(p_payload #>> '{vehicle,sleeperCapacity}', '')::integer, nullif(p_payload #>> '{vehicle,grossWeight}', '')::numeric,
      nullif(p_payload #>> '{vehicle,unladenWeight}', '')::numeric, nullif(p_payload #>> '{vehicle,wheelBase}', '')::numeric, nullif(p_payload #>> '{vehicle,cylinders}', '')::integer, nullif(upper(p_payload #>> '{vehicle,chassisNumber}'), ''), nullif(upper(p_payload #>> '{vehicle,engineNumber}'), ''), nullif(p_payload #>> '{vehicle,normsType}', ''),
      nullif(p_payload #>> '{vehicle,registrationDate}', '')::date, nullif(p_payload #>> '{vehicle,registrationStatus}', ''), nullif(p_payload #>> '{vehicle,statusAsOn}', '')::date, nullif(p_payload #>> '{vehicle,rtoName}', ''), nullif(p_payload #>> '{vehicle,rtoState}', ''), nullif(p_payload #>> '{vehicle,fitnessExpiryDate}', '')::date, nullif(p_payload #>> '{vehicle,taxUpto}', '')::date, nullif(p_payload #>> '{vehicle,pucNumber}', ''), nullif(p_payload #>> '{vehicle,pucUpto}', '')::date,
      nullif(p_payload #>> '{vehicle,permitNumber}', ''), nullif(p_payload #>> '{vehicle,permitType}', ''), nullif(p_payload #>> '{vehicle,permitValidFrom}', '')::date, nullif(p_payload #>> '{vehicle,permitValidUpto}', '')::date, nullif(p_payload #>> '{vehicle,nationalPermitNumber}', ''), nullif(p_payload #>> '{vehicle,nationalPermitUpto}', '')::date,
      nullif(p_payload #>> '{vehicle,financed}', '')::boolean, nullif(p_payload #>> '{vehicle,financerName}', ''), nullif(p_payload #>> '{vehicle,blacklistStatus}', ''), coalesce((p_payload #>> '{authbridge,applied}')::boolean, false), nullif(p_payload #>> '{authbridge,lookedUpAt}', '')::timestamptz, nullif(p_payload #>> '{authbridge,transactionId}', ''), nullif(p_payload #>> '{authbridge,providerTransactionId}', ''), now()
    ) returning id into v_vehicle_id;
  end if;

  v_policy_code := 'POL-' || to_char(clock_timestamp(), 'YYYYMMDDHH24MISSMS');
  insert into public.policies (
    policy_code, customer_id, vehicle_id, insurance_company_id, policy_no, policy_no_normalized, policy_type,
    insured_declared_value, start_date, end_date, issuance_date, business_line, intermediary_type, intermediary_code,
    lead_source, rm_name, status, remarks, calculation_version, created_by, updated_at
  ) values (
    v_policy_code, v_customer_id, v_vehicle_id, (p_payload #>> '{policy,insuranceCompanyId}')::uuid,
    upper(p_payload #>> '{policy,policyNumber}'), upper(regexp_replace(p_payload #>> '{policy,policyNumber}', '[^A-Za-z0-9]', '', 'g')),
    p_payload #>> '{policy,policyType}', nullif(p_payload #>> '{policy,idv}', '')::numeric,
    (p_payload #>> '{policy,validFrom}')::date, (p_payload #>> '{policy,validUpto}')::date,
    (p_payload #>> '{policy,issuanceDate}')::date, coalesce(nullif(p_payload #>> '{policy,businessLine}', ''), 'Motor'),
    nullif(p_payload #>> '{policy,intermediaryType}', ''), nullif(p_payload #>> '{policy,intermediaryCode}', ''),
    nullif(p_payload #>> '{policy,leadSource}', ''), nullif(p_payload #>> '{policy,rmName}', ''), 'active',
    nullif(p_payload #>> '{policy,remarks}', ''), 'prototype_v1', nullif(p_payload #>> '{meta,requestedBy}', '')::uuid, now()
  ) returning id into v_policy_id;

  update public.vehicle_ownership_history set policy_id = v_policy_id where vehicle_id = v_vehicle_id and policy_id is null and confirmed_by = nullif(p_payload #>> '{meta,requestedBy}', '')::uuid;

  insert into public.policy_party_snapshots (
    policy_id, insured_name, phone, address, city, district, state, pincode, registration_number, vehicle_class,
    vehicle_category, make, model, fuel_type, manufacturing_year, capacity_value, chassis_no, engine_no, rto_name, rto_state
  ) values (
    v_policy_id, v_name, v_phone, nullif(p_payload #>> '{customer,address}', ''), nullif(p_payload #>> '{customer,city}', ''),
    nullif(p_payload #>> '{customer,district}', ''), nullif(p_payload #>> '{customer,state}', ''), nullif(p_payload #>> '{customer,pincode}', ''),
    v_registration, nullif(p_payload #>> '{vehicle,classDescription}', ''), nullif(p_payload #>> '{vehicle,category}', ''),
    nullif(p_payload #>> '{vehicle,make}', ''), nullif(p_payload #>> '{vehicle,model}', ''), nullif(p_payload #>> '{vehicle,fuelType}', ''),
    nullif(p_payload #>> '{vehicle,manufacturingYear}', '')::integer, nullif(p_payload #>> '{vehicle,capacity}', ''),
    nullif(upper(p_payload #>> '{vehicle,chassisNumber}'), ''), nullif(upper(p_payload #>> '{vehicle,engineNumber}'), ''),
    nullif(p_payload #>> '{vehicle,rtoName}', ''), nullif(p_payload #>> '{vehicle,rtoState}', '')
  );

  v_net := v_od + v_tp + v_cpa;
  v_gst := case when p_payload #>> '{vehicle,classCode}' = 'GCV' then ((v_od + v_cpa) * 0.18) + (v_tp * 0.05) else v_net * 0.18 end;
  v_gross := v_net + v_gst;
  insert into public.policy_premium_details(policy_id, od_premium, tp_premium, cpa_opted, cpa_amount, net_premium, gst_amount, gross_premium, gst_rule, calculation_version)
  values (v_policy_id, v_od, v_tp, coalesce((p_payload #>> '{premium,cpaOpted}')::boolean, false), v_cpa, v_net, v_gst, v_gross,
    case when p_payload #>> '{vehicle,classCode}' = 'GCV' then '18% OD+CPA and 5% TP' else '18% Net' end, 'prototype_v1');

  v_od_payin := v_od * coalesce((p_payload #>> '{payin,odPercent}')::numeric, 0) / 100;
  v_tp_payin := v_tp * coalesce((p_payload #>> '{payin,tpPercent}')::numeric, 0) / 100;
  v_total_payin := v_od_payin + v_tp_payin + v_scheme;
  v_tds := v_total_payin * 0.10;
  v_payin_after_tds := v_total_payin - v_tds;
  insert into public.policy_payin_details(policy_id, payout_basis, projected_od_percent, projected_od_amount, projected_tp_percent, projected_tp_amount, insurer_scheme_amount, total_projected_payin, tds_percent, tds_amount, payin_after_tds, calculation_version)
  values (v_policy_id, p_payload #>> '{payin,basis}', coalesce((p_payload #>> '{payin,odPercent}')::numeric, 0), v_od_payin, coalesce((p_payload #>> '{payin,tpPercent}')::numeric, 0), v_tp_payin, v_scheme, v_total_payin, 10, v_tds, v_payin_after_tds, 'prototype_v1');

  insert into public.policy_payin_bills(policy_id, bill_number, billed_amount, bill_date, status, short_payout_amount)
  values (v_policy_id, nullif(p_payload #>> '{billing,billNumber}', ''), coalesce((p_payload #>> '{billing,billedAmount}')::numeric, 0), nullif(p_payload #>> '{billing,billDate}', '')::date, coalesce(nullif(p_payload #>> '{billing,status}', ''), 'Unbilled'), greatest(v_total_payin - coalesce((p_payload #>> '{billing,billedAmount}')::numeric, 0), 0));

  v_od_payout := v_od * coalesce((p_payload #>> '{payout,odPercent}')::numeric, 0) / 100;
  v_tp_payout := case when p_payload #>> '{payin,basis}' = 'OD' then 0 else v_tp * coalesce((p_payload #>> '{payout,tpPercent}')::numeric, 0) / 100 end;
  v_gross_payout := greatest(v_od_payout + v_tp_payout - coalesce((p_payload #>> '{payout,retention}')::numeric, 0), 0);
  insert into public.policy_intermediary_payouts(policy_id, intermediary_type, intermediary_code, retention_amount, od_payout_percent, od_payout_amount, tp_payout_percent, tp_payout_amount, gross_payout, status, payout_date, voucher_number, remarks, calculation_version)
  values (v_policy_id, nullif(p_payload #>> '{policy,intermediaryType}', ''), nullif(p_payload #>> '{policy,intermediaryCode}', ''), coalesce((p_payload #>> '{payout,retention}')::numeric, 0), coalesce((p_payload #>> '{payout,odPercent}')::numeric, 0), v_od_payout, coalesce((p_payload #>> '{payout,tpPercent}')::numeric, 0), v_tp_payout, v_gross_payout, coalesce(nullif(p_payload #>> '{payout,status}', ''), 'Pending'), nullif(p_payload #>> '{payout,date}', '')::date, nullif(p_payload #>> '{payout,voucherNumber}', ''), nullif(p_payload #>> '{policy,remarks}', ''), 'prototype_v1');

  if coalesce((p_payload #>> '{authbridge,applied}')::boolean, false) then
    insert into public.vehicle_rc_verifications(vehicle_id, policy_id, registration_number, gateway_transaction_id, provider_transaction_id, lookup_status, looked_up_at, applied_to_form, applied_at, requested_by)
    values (v_vehicle_id, v_policy_id, v_registration, nullif(p_payload #>> '{authbridge,transactionId}', ''), nullif(p_payload #>> '{authbridge,providerTransactionId}', ''), 'success', nullif(p_payload #>> '{authbridge,lookedUpAt}', '')::timestamptz, true, now(), nullif(p_payload #>> '{meta,requestedBy}', '')::uuid);
  end if;

  return jsonb_build_object('ok', true, 'policyId', v_policy_id, 'policyCode', v_policy_code, 'customerId', v_customer_id, 'vehicleId', v_vehicle_id, 'status', 'active');
end;
$$;

revoke all on function public.onboard_motor_policy(jsonb) from public;
grant execute on function public.onboard_motor_policy(jsonb) to service_role;

commit;
