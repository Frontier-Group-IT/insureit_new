-- Stage 1: additive enum extension only. Apply prior to any profile role migration.
-- This does not change existing user roles or permission policies.
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'it_user';
