do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'claim_status_history'
    ) then
      alter publication supabase_realtime add table public.claim_status_history;
    end if;

    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'notifications'
    ) then
      alter publication supabase_realtime add table public.notifications;
    end if;
  end if;
end $$;

create or replace function public.create_claim_status_notifications()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  claim_record record;
  recipient_id uuid;
  notification_message text;
begin
  select
    claims.id,
    claims.claim_no,
    claims.customer_id,
    claims.assigned_to,
    claims.created_by,
    customers.profile_id as customer_profile_id
  into claim_record
  from public.claims
  join public.customers on customers.id = claims.customer_id
  where claims.id = new.claim_id;

  if not found then
    return new;
  end if;

  notification_message := coalesce(nullif(btrim(new.notes), ''), 'Status changed to ' || new.to_status::text);

  for recipient_id in
    select distinct recipient
    from (
      select claim_record.customer_profile_id as recipient
      union
      select claim_record.assigned_to
      union
      select claim_record.created_by
      union
      select profiles.id
      from public.profiles
      where profiles.is_active = true
        and profiles.role in (
          'manager',
          'claim_processor',
          'field_executive',
          'admin',
          'super_admin'
        )
    ) as recipients
    where recipient is not null
      and (new.changed_by is null or recipient <> new.changed_by)
  loop
    insert into public.notifications (
      profile_id,
      customer_id,
      claim_id,
      title,
      message
    )
    values (
      recipient_id,
      claim_record.customer_id,
      new.claim_id,
      'Claim ' || claim_record.claim_no || ' updated',
      notification_message
    );
  end loop;

  return new;
end;
$$;

drop trigger if exists claim_status_history_notify on public.claim_status_history;
create trigger claim_status_history_notify
after insert on public.claim_status_history
for each row execute function public.create_claim_status_notifications();
