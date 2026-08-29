# INSUREIT Partner — Phase 7 UAT Readiness

Date: 2026-08-29

## Release rule

Do not publish the Partner OTA during Phase 7. Phase 7 proves integration and role safety. The final OTA is released only after the release-candidate phase and approved device UAT.

## Automated app gate

`apps/partner-app/scripts/verify-routes.mjs` scans the Partner app and fails CI when a static navigation target points to a missing Expo Router screen. The Partner CI now runs this check before TypeScript, lint and the Expo web review export.

Required product routes covered by the guard include login, tabs, Pulse, Impact, Journey, Network, Learn, Stories, Weekly Story, Recognition, Support, Renewals, Customers, Activity, Profile, Policy Intake and Customer/Policy/Claim details.

## Production contract matrix tested

The Phase 7 audit called the live scoped Partner contracts using production data but did not persist test data.

### Relationship Manager

- actor: employee
- scope mode observed: `self`
- Home: pass
- Policies: pass
- Claims: pass
- Customers: pass
- Renewals: pass
- Impact: pass
- Journey: pass
- Business: pass
- Network: pass
- Learn: pass
- Stories: pass
- Weekly Story: pass
- Recognition: pass
- Support: pass
- Activity: pass

### ASM

- actor: employee
- scope mode observed: `hierarchy`
- all contracts above: pass

### Sales Head

- actor: employee
- scope mode observed: `organization`
- all contracts above: pass

### POSP/MISP-style intermediary identity

A temporary portal account was created only inside a transaction and rolled back.

- actor: intermediary
- scope mode observed: `partner_family`
- exactly one permanent Partner family was returned
- Home: pass
- Policies: pass
- Claims: pass
- Customers: pass
- Renewals: pass
- Impact: pass
- Journey: pass
- Business: pass
- Network: pass
- Learn: pass
- Stories: pass
- Weekly Story: pass
- Recognition: pass
- Support: pass
- Activity: pass

After rollback, production `intermediary_portal_accounts` remained at zero rows.

## Phase 6 ACL verification

The following Phase 6 functions are not executable by `anon` and are executable by `authenticated` and `service_role` only:

- `partner_app_weekly_story()`
- `partner_app_recognition()`
- `partner_app_support()`
- `partner_app_activity(integer)`

## Product-data rules confirmed

- Policy premium surfaces use authoritative `policy_premium_details.gross_premium` with controlled fallback where applicable.
- Partner-family scoping remains server-authoritative.
- Claim progress uses recorded claim events/status history; internal notes are not surfaced by Partner activity.
- Recognition does not use fake XP or public ranking.
- Intermediary Support exposes only the canonical relationship contact, not an employee directory.
- Standalone Partners remain valid first-class business units.

## Remaining release-candidate checks

1. Exact-main Partner CI and web regression gate.
2. Preview APK built from exact current `main`.
3. One explicitly approved real Partner/POSP/MISP UAT account for device testing. No production Partner portal account currently exists, so this must not be fabricated silently.
4. Real-device verification of login/session restore, responsive layouts, upload picker and Policy Intake upload/attention flow.
5. Verify Call/Mail deep links where a relationship contact exists.
6. Verify empty/loading/error states on low-data Partner-family scope.
7. Verify a Partner family with linked POSP/MISP and a standalone Partner on device.
8. Final release decision, then publish the Partner OTA once.
