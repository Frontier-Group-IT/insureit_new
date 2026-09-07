-- Present surveyor assignment as a customer-facing event instead of exposing
-- the underlying claim-status transition in notification subjects.

create or replace function public.create_claim_status_notifications()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  claim_record record;
  recipient_id uuid;
  notification_message text;
  notification_title text;
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

  notification_message := coalesce(
    nullif(btrim(new.notes), ''),
    'Status changed to ' || new.to_status::text
  );

  notification_title := case
    when new.from_status is null then
      'New claim: ' || claim_record.claim_no

    -- Surveyor assignment is a customer-facing event. Keep the existing
    -- detailed message/body, but do not expose the internal stage transition
    -- in the notification subject.
    when notification_message ~* '^Surveyor details[[:space:]]*[—-]' then
      claim_record.claim_no || ': Surveyor Appointed'

    -- Same-status document verification is an event, not a status transition.
    -- Use the actual verification event as the title while keeping the full
    -- message unchanged.
    when new.from_status = new.to_status
      and notification_message ~* '\s+during spot survey\.\s*$'
      and notification_message ~* '\s+verified during spot survey\.\s*$'
    then
      claim_record.claim_no || ': ' ||
      regexp_replace(
        notification_message,
        '\s+during spot survey\.\s*$',
        '',
        'i'
      )

    -- Preserve the existing title behavior for other same-status history rows.
    when new.from_status = new.to_status then
      claim_record.claim_no || ': ' || new.to_status::text

    else
      claim_record.claim_no || ': ' ||
      new.from_status::text || ' to ' || new.to_status::text
  end;

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
      notification_title,
      notification_message
    );
  end loop;

  return new;
end;
$function$;

-- Bring already-created surveyor assignment notifications into parity so the
-- existing inbox entry also shows the corrected customer-facing subject.
update public.notifications as notification
set title = claim.claim_no || ': Surveyor Appointed'
from public.claims as claim
where notification.claim_id = claim.id
  and notification.message ~* '^Surveyor details[[:space:]]*[—-]'
  and notification.title ~* 'Initial Documents Submitted[[:space:]]+to[[:space:]]+Final Documents Awaited$';
