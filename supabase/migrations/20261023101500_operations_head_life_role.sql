-- Registers new role without assigning it to any profile.
-- Production rollout must wait for end-to-end vertical and hierarchy enforcement.
alter type public.app_role add value if not exists 'operations_head_life';
