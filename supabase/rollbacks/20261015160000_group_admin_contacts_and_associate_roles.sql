begin;
-- Roll back schema extension only when no non-admin roles exist.
do $$ begin
 if exists(select 1 from public.group_portal_associate_accounts where role <> 'group_admin') then
  raise exception 'Cannot remove additional Group roles while assigned accounts exist';
 end if;
 if exists(select 1 from public.group_administrator_contacts) then
  raise exception 'Cannot remove Group administrator contacts while saved records exist';
 end if;
end $$;
alter table public.group_portal_associate_accounts drop constraint group_portal_associate_accounts_role_check;
alter table public.group_portal_associate_accounts add constraint group_portal_associate_accounts_role_check check (role='group_admin');
drop table public.group_administrator_contacts;
commit;