-- Approval requests are server-only; no Data API access for customer/partner roles.
create table if not exists public.policy_date_otp_approvals (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles(id),
  approver_key text not null check (approver_key in ('jatin','vishal','varun','gagan')),
  approver_name text not null,
  approver_email text not null,
  issuance_date date not null,
  policy_number text not null,
  operation text not null check (operation in ('create','edit')),
  existing_policy_id uuid references public.policies(id),
  code_hash text not null,
  attempts integer not null default 0 check (attempts between 0 and 5),
  created_at timestamptz not null default now(),
  delivered_at timestamptz,
  expires_at timestamptz not null,
  verified_at timestamptz,
  consumed_at timestamptz,
  resulting_policy_id uuid references public.policies(id) on delete set null,
  constraint policy_date_edit_reference check (
    (operation = 'edit' and existing_policy_id is not null)
    or (operation = 'create' and existing_policy_id is null)
  )
);
create index if not exists policy_date_otp_user_time_idx on public.policy_date_otp_approvals(requester_id,created_at desc);
create index if not exists policy_date_otp_policy_idx on public.policy_date_otp_approvals(resulting_policy_id) where resulting_policy_id is not null;
alter table public.policy_date_otp_approvals enable row level security;
revoke all on public.policy_date_otp_approvals from public, anon, authenticated;
grant select, insert, update, delete on public.policy_date_otp_approvals to service_role;

-- This wrapper consumes the approval inside the same transaction that writes the policy.
-- Its execute privilege is granted only to the server's service role.
create or replace function public.save_motor_policy_with_date_approval_v1(
  p_operation text,
  p_payload jsonb,
  p_requester uuid,
  p_approval_id uuid default null,
  p_policy_id uuid default null,
  p_intake_id uuid default null,
  p_expected_revision integer default null,
  p_existing_policy_id uuid default null,
  p_reason text default null,
  p_effective_date date default null
) returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  v_date date;
  v_today date := (now() at time zone 'Asia/Kolkata')::date;
  v_current_month date := date_trunc('month', (now() at time zone 'Asia/Kolkata'))::date;
  v_original_date date;
  v_requires boolean := false;
  v_record public.policy_date_otp_approvals%rowtype;
  v_result jsonb;
  v_policy_id uuid;
  v_number text := trim(coalesce(p_payload #>> '{policy,policyNumber}',''));
  v_action text := case when p_operation = 'edit' then 'edit' else 'create' end;
begin
  if p_requester is null or v_number = '' then raise exception 'POLICY_DATE_INPUT_REQUIRED'; end if;
  if coalesce(p_payload #>> '{policy,issuanceDate}', '') !~ '^\d{4}-\d{2}-\d{2}$'
  then raise exception 'POLICY_DATE_INVALID'; end if;
  begin
    v_date := (p_payload #>> '{policy,issuanceDate}')::date;
  exception when others then
    raise exception 'POLICY_DATE_INVALID';
  end;
  if date_trunc('month', v_date)::date > v_current_month then
    raise exception 'POLICY_DATE_FUTURE_NOT_ALLOWED';
  end if;

  if p_operation = 'edit' then
    select issuance_date into v_original_date from public.policies where id = p_policy_id;
    if not found then raise exception 'POLICY_NOT_FOUND'; end if;
  end if;

  if v_original_date is distinct from v_date then
    v_requires := date_trunc('month',v_date)::date < v_current_month
      and not (date_trunc('month',v_date)::date = (v_current_month - interval '1 month')::date
               and extract(day from v_today) <= 15);
  end if;

  if v_requires then
    if p_approval_id is null then raise exception 'POLICY_DATE_OTP_REQUIRED'; end if;
    select * into v_record
    from public.policy_date_otp_approvals
    where id = p_approval_id for update;
    if not found
       or v_record.requester_id is distinct from p_requester
       or v_record.issuance_date is distinct from v_date
       or v_record.policy_number is distinct from v_number
       or v_record.operation is distinct from v_action
       or v_record.existing_policy_id is distinct from (case when v_action = 'edit' then p_policy_id else null end)
       or v_record.verified_at is null
       or v_record.verified_at < now() - interval '15 minutes'
       or v_record.consumed_at is not null
    then raise exception 'POLICY_DATE_OTP_REQUIRED'; end if;
    update public.policy_date_otp_approvals set consumed_at = now()
    where id = p_approval_id;
  end if;

  v_result := public.save_motor_policy_with_addon_v1(
    p_operation => p_operation,
    p_payload => p_payload,
    p_policy_id => p_policy_id,
    p_intake_id => p_intake_id,
    p_expected_revision => p_expected_revision,
    p_existing_policy_id => p_existing_policy_id,
    p_reason => p_reason,
    p_effective_date => p_effective_date
  );

  if coalesce((v_result ->> 'ok')::boolean, false) is not true then
    -- Raise to roll back any consumed approval and partial write as one transaction.
    raise exception 'POLICY_SAVE_NOT_CONFIRMED';
  end if;
  v_policy_id := (v_result ->> 'policyId')::uuid;
  if v_policy_id is null then raise exception 'POLICY_SAVE_NOT_CONFIRMED'; end if;

  if v_requires then
    update public.policy_date_otp_approvals
       set resulting_policy_id = v_policy_id
     where id = p_approval_id;
  end if;
  if v_original_date is distinct from v_date and date_trunc('month',v_date)::date < v_current_month then
    insert into public.audit_logs(actor_id,action,table_name,record_id,new_data)
    values (
      p_requester,
      'previous_month_policy_uploaded',
      'policies',
      v_policy_id,
      jsonb_build_object('issuance_date',v_date,'approved_by',
        case when v_requires then v_record.approver_name else null end,
        'approval_id', case when v_requires then p_approval_id else null end)
    );
  end if;
  return v_result;
end;
$$;
revoke execute on function public.save_motor_policy_with_date_approval_v1(text,jsonb,uuid,uuid,uuid,uuid,integer,uuid,text,date)
  from public, anon, authenticated;
grant execute on function public.save_motor_policy_with_date_approval_v1(text,jsonb,uuid,uuid,uuid,uuid,integer,uuid,text,date)
  to service_role;


-- Verifies OTP and increments incorrect-attempt counters under row lock.
-- This prevents concurrent guesses from exceeding the five-attempt limit.
create or replace function public.verify_policy_date_otp_v1(
  p_approval_id uuid,
  p_requester uuid,
  p_supplied_hash text,
  p_date date,
  p_policy_number text,
  p_operation text,
  p_existing_policy_id uuid default null
) returns boolean language plpgsql security definer set search_path = ''
as $$
declare
  v_record public.policy_date_otp_approvals%rowtype;
begin
  select * into v_record from public.policy_date_otp_approvals
    where id = p_approval_id and requester_id = p_requester
    for update;
  if not found
     or v_record.issuance_date is distinct from p_date
     or v_record.policy_number is distinct from upper(trim(p_policy_number))
     or v_record.operation is distinct from p_operation
     or v_record.existing_policy_id is distinct from p_existing_policy_id
     or v_record.delivered_at is null
     or v_record.expires_at <= now()
     or v_record.verified_at is not null
     or v_record.consumed_at is not null
     or v_record.attempts >= 5
  then return false; end if;

  if v_record.code_hash = p_supplied_hash then
    update public.policy_date_otp_approvals set verified_at = now()
    where id = p_approval_id;
    return true;
  end if;
  update public.policy_date_otp_approvals set attempts = attempts + 1
  where id = p_approval_id;
  return false;
end;
$$;
revoke execute on function public.verify_policy_date_otp_v1(uuid,uuid,text,date,text,text,uuid)
  from public, anon, authenticated;
grant execute on function public.verify_policy_date_otp_v1(uuid,uuid,text,date,text,text,uuid)
  to service_role;
