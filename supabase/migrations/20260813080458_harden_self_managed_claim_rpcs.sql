revoke all on function public.create_customer_external_policy(uuid,uuid,uuid,text,text,date,date,numeric,numeric) from public, anon;
grant execute on function public.create_customer_external_policy(uuid,uuid,uuid,text,text,date,date,numeric,numeric) to authenticated;

revoke all on function public.create_self_managed_external_claim(uuid,uuid,uuid,timestamptz,text,text,text) from public, anon;
grant execute on function public.create_self_managed_external_claim(uuid,uuid,uuid,timestamptz,text,text,text) to authenticated;

revoke all on function public.save_self_managed_milestone(uuid,text,jsonb,timestamptz) from public, anon;
grant execute on function public.save_self_managed_milestone(uuid,text,jsonb,timestamptz) to authenticated;

create or replace function public.set_claim_financials_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
