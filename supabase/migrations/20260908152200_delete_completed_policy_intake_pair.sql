create or replace function public.delete_policy_with_completed_intake_pair(
  p_policy_id uuid,
  p_intake_id uuid,
  p_actor_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_policy_no text;
  v_intake_number text;
  v_intake_status text;
  v_final_policy_id uuid;
  v_block_count integer;
  v_rejected_links_cleared integer := 0;
begin
  if not exists (
    select 1
    from public.profiles
    where id = p_actor_id
      and role::text = 'it_super_user'
      and coalesce(is_active, true)
  ) then
    raise exception 'Only the IT Super User can run coordinated policy cleanup.' using errcode = '42501';
  end if;

  select policy_no
    into v_policy_no
  from public.policies
  where id = p_policy_id
  for update;

  if not found then
    raise exception 'The selected policy no longer exists.' using errcode = 'P0002';
  end if;

  select intake_number, status, final_policy_id
    into v_intake_number, v_intake_status, v_final_policy_id
  from public.policy_intake_requests
  where id = p_intake_id
  for update;

  if not found then
    raise exception 'The linked policy intake no longer exists.' using errcode = 'P0002';
  end if;

  if lower(trim(coalesce(v_intake_status, ''))) <> 'completed'
     or v_final_policy_id is distinct from p_policy_id then
    raise exception 'The selected intake is not the completed intake for this policy.' using errcode = 'P0001';
  end if;

  select count(*) into v_block_count from public.claims where policy_id = p_policy_id;
  if v_block_count > 0 then
    raise exception 'Cannot delete this policy pair because the policy has % linked claim(s).', v_block_count using errcode = '23503';
  end if;

  select count(*) into v_block_count from public.reconciliation_lines where policy_id = p_policy_id;
  if v_block_count > 0 then
    raise exception 'Cannot delete this policy pair because the policy has % reconciliation record(s).', v_block_count using errcode = '23503';
  end if;

  select count(*) into v_block_count from public.accounts_invoice_lines where policy_id = p_policy_id;
  if v_block_count > 0 then
    raise exception 'Cannot delete this policy pair because the policy has % invoice line(s).', v_block_count using errcode = '23503';
  end if;

  select count(*) into v_block_count from public.partner_payables where policy_id = p_policy_id;
  if v_block_count > 0 then
    raise exception 'Cannot delete this policy pair because the policy has % partner payable(s).', v_block_count using errcode = '23503';
  end if;

  select count(*) into v_block_count
  from public.policy_replacement_audit
  where existing_policy_id = p_policy_id or new_policy_id = p_policy_id;
  if v_block_count > 0 then
    raise exception 'Cannot delete this policy pair because the policy has % replacement audit record(s).', v_block_count using errcode = '23503';
  end if;

  if exists (
    select 1
    from public.policy_intake_requests
    where final_policy_id = p_policy_id
      and id <> p_intake_id
      and lower(trim(coalesce(status, ''))) <> 'rejected'
  ) then
    raise exception 'Cannot delete this policy pair because another non-rejected policy intake is linked to the same policy.' using errcode = '23503';
  end if;

  if exists (
    select 1
    from public.policy_documents
    where source_intake_id = p_intake_id
      and policy_id <> p_policy_id
  ) then
    raise exception 'Cannot delete this policy pair because the intake is referenced by an official document on another policy.' using errcode = '23503';
  end if;

  update public.policy_intake_requests
  set final_policy_id = null
  where final_policy_id = p_policy_id
    and id <> p_intake_id
    and lower(trim(coalesce(status, ''))) = 'rejected';
  get diagnostics v_rejected_links_cleared = row_count;

  delete from public.policy_intake_requests
  where id = p_intake_id
    and final_policy_id = p_policy_id
    and lower(trim(coalesce(status, ''))) = 'completed';

  if not found then
    raise exception 'The completed policy intake changed while preparing deletion. Refresh and try again.' using errcode = '40001';
  end if;

  delete from public.policies where id = p_policy_id;
  if not found then
    raise exception 'The policy changed while preparing deletion. Refresh and try again.' using errcode = '40001';
  end if;

  insert into public.audit_logs(actor_id, action, table_name, record_id, old_data)
  values (
    p_actor_id,
    'delete_policy_with_completed_intake',
    'policies',
    p_policy_id,
    jsonb_build_object(
      'policy_id', p_policy_id,
      'policy_no', v_policy_no,
      'policy_intake_id', p_intake_id,
      'policy_intake_number', v_intake_number,
      'policy_intake_status', v_intake_status,
      'rejected_policy_intake_links_cleared', v_rejected_links_cleared,
      'deletion_source', 'it_super_user_coordinated_policy_intake_cleanup'
    )
  );

  return jsonb_build_object(
    'policy_id', p_policy_id,
    'policy_no', v_policy_no,
    'policy_intake_id', p_intake_id,
    'policy_intake_number', v_intake_number,
    'rejected_policy_intake_links_cleared', v_rejected_links_cleared
  );
end;
$$;

revoke all on function public.delete_policy_with_completed_intake_pair(uuid, uuid, uuid) from public;
revoke all on function public.delete_policy_with_completed_intake_pair(uuid, uuid, uuid) from anon;
revoke all on function public.delete_policy_with_completed_intake_pair(uuid, uuid, uuid) from authenticated;
grant execute on function public.delete_policy_with_completed_intake_pair(uuid, uuid, uuid) to service_role;
