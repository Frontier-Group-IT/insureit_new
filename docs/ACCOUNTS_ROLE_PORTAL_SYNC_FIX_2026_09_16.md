# Accounts role portal synchronization fix — 2026-09-16

## Verified production root cause

The application-level `accounts` role was merged before the production PostgreSQL `public.app_role` enum was extended. Employee onboarding could therefore send a Supabase Auth invitation successfully, while the subsequent `public.profiles` synchronization failed when it attempted to store `role = 'accounts'`.

The Auth trigger also intentionally derives authorization role only from server-controlled `raw_app_meta_data`. `inviteUserByEmail(..., { data })` writes normal user metadata, so a newly invited staff identity initially receives the trigger fallback `customer` profile until the application performs its governed profile synchronization.

A failed Accounts onboarding attempt was observed to leave an unlinked Auth/profile shell, so a simple enum-only change would not make retry safe.

## Implemented fix

- Forward migration `20260916122000_add_accounts_app_role_and_quarantine_stranded_invites.sql` adds `accounts` to `public.app_role`.
- The same migration narrowly marks pre-existing, unlinked Customer profile shells inactive when the matching Auth user carries the previous server-generated Accounts invite marker in user metadata. This prevents a partial invite shell from being treated as an active customer before administrator recovery.
- Employee portal governance now synchronizes the selected staff role into server-controlled Auth `app_metadata` before the final `profiles` upsert.
- New invitations use compensating Auth-user cleanup when synchronization fails, preventing another stranded identity from blocking retry.
- Accounts retry recovery is intentionally narrow: same normalized email, unlinked profile, Customer/Accounts shell, and Accounts marker in Auth metadata. It does not generically adopt arbitrary existing portal users.
- A recovered invite is linked to the newly created employee and the existing invitation remains usable.
- Accounts still has zero default application capabilities. Explicit Accounts permissions remain deferred.

## Verification coverage

`apps/web-portal/scripts/employee-portal-governance-regression.mjs` now checks:

- an authorized portal manager may invite the Accounts role;
- recovery remains Accounts-only and employee-unlinked;
- Auth app metadata is synchronized before profile upsert;
- compensating cleanup remains present for newly created partial invitations;
- the forward enum migration exists;
- stranded-invite quarantine remains narrowly bounded.

## Evidence state

**IMPLEMENTED / UNAPPLIED / UNDEPLOYED** on feature branch `fix/accounts-portal-role-sync` pending canonical GitHub verification, merge approval, protected migration application and production deployment.
