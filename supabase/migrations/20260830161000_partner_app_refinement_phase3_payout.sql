begin;

create or replace function public.partner_app_payout_summary()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, auth
as $$
declare
  v_identity jsonb;
  v_actor_kind text;
  v_intermediary_code text;
  v_result jsonb;
begin
  v_identity := public.partner_app_current_identity();

  if v_identity is null then
    raise exception 'INSUREIT Partner access is unavailable' using errcode='28000';
  end if;

  v_actor_kind := v_identity->>'actor_kind';

  -- Detailed policy commercials are intentionally restricted for employee users
  -- in the web portal. Until an explicit server-side commercial capability is
  -- introduced for employees, fail closed in the Partner app rather than
  -- exposing scoped Partner payout data to RM/management identities.
  if v_actor_kind <> 'intermediary' then
    return jsonb_build_object(
      'available', false,
      'visibility', 'restricted',
      'generated_at', now(),
      'reason', 'Payout visibility is restricted for this account.'
    );
  end if;

  v_intermediary_code := nullif(btrim(v_identity->>'intermediary_code'), '');

  if v_intermediary_code is null then
    return jsonb_build_object(
      'available', false,
      'visibility', 'restricted',
      'generated_at', now(),
      'reason', 'No intermediary payout identity is available for this account.'
    );
  end if;

  with payout_rows as (
    select
      pip.id,
      pip.policy_id,
      coalesce(p.policy_no,p.policy_code,'Policy') as policy_no,
      coalesce(nullif(c.company_name,''),nullif(c.contact_name,''),c.customer_code,'Customer') as customer_name,
      case
        when pip.payout_basis is not null then coalesce(pip.partner_payout_amount,0)
        else coalesce(pip.gross_payout,0)
      end as payout_amount,
      pip.status,
      pip.commercial_status,
      pip.payout_date,
      pip.voucher_number,
      pip.updated_at
    from public.policy_intermediary_payouts pip
    join public.policies p on p.id=pip.policy_id
    left join public.customers c on c.id=p.customer_id
    where upper(coalesce(pip.intermediary_code,''))=upper(v_intermediary_code)
  ),
  totals as (
    select
      count(*)::int as total_rows,
      coalesce(sum(payout_amount),0) as recorded_amount,
      coalesce(sum(payout_amount) filter(where lower(coalesce(status,''))='pending'),0) as pending_amount,
      coalesce(sum(payout_amount) filter(
        where lower(coalesce(status,''))='pending'
          and lower(coalesce(commercial_status,''))='entered'
      ),0) as eligible_amount,
      coalesce(sum(payout_amount) filter(
        where lower(coalesce(commercial_status,''))='needs_review'
      ),0) as needs_review_amount,
      coalesce(sum(payout_amount) filter(where lower(coalesce(status,''))='paid'),0) as paid_amount,
      count(*) filter(where lower(coalesce(status,''))='pending')::int as pending_count,
      count(*) filter(where lower(coalesce(status,''))='paid')::int as paid_count,
      count(*) filter(where lower(coalesce(commercial_status,''))='needs_review')::int as needs_review_count
    from payout_rows
  ),
  recent as (
    select coalesce(jsonb_agg(
      jsonb_build_object(
        'id',x.id,
        'policy_id',x.policy_id,
        'policy_no',x.policy_no,
        'customer_name',x.customer_name,
        'amount',x.payout_amount,
        'status',x.status,
        'commercial_status',x.commercial_status,
        'payout_date',x.payout_date,
        'voucher_number',x.voucher_number,
        'updated_at',x.updated_at
      )
      order by x.updated_at desc
    ),'[]'::jsonb) as items
    from (
      select *
      from payout_rows
      order by updated_at desc
      limit 10
    ) x
  )
  select jsonb_build_object(
    'available', true,
    'visibility', 'self',
    'generated_at', now(),
    'intermediary_code', v_intermediary_code,
    'recorded_amount', t.recorded_amount,
    'pending_amount', t.pending_amount,
    'eligible_amount', t.eligible_amount,
    'needs_review_amount', t.needs_review_amount,
    'paid_amount', t.paid_amount,
    'total_rows', t.total_rows,
    'pending_count', t.pending_count,
    'paid_count', t.paid_count,
    'needs_review_count', t.needs_review_count,
    'recent', r.items
  )
  into v_result
  from totals t
  cross join recent r;

  return v_result;
end;
$$;

revoke all on function public.partner_app_payout_summary() from public, anon;
grant execute on function public.partner_app_payout_summary() to authenticated, service_role;

commit;
