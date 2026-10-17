# INSUREIT Firebase migration — production Auth restore boundary

## Mandatory architectural distinction
The Admin Auth `getUserById` API does not export existing password hashes or all GoTrue identities. A JSON copy of its response is **NOT a recoverable Auth snapshot**. Never assert that an Admin API user export can restore original password-based access. A true recovery capability must use an independently controlled, encrypted Postgres/Auth backup with an approved supported restore procedure, tested outside production.

## One-user preflight required before any write
1. Identify Customer solely through an independent, consented canonical identity check (not solely by a shared phone). Use the signed/revocation-checked Firebase Admin token and compare project, recent `auth_time`, UID and phone with the existing canonical Auth+profile UUID. Require no staff or duplicate identity collisions.
2. Verify *outside GitHub* a recoverable, access-restricted, encrypted Auth backup including the relevant Auth user, identity records and relevant metadata, as permitted by the database administrator; rehearse a recovery that preserves the exact UUID and original login identity. Record only evidence hashes, not original data.
3. Prove email-password and recovery for reserved `.invalid` aliases cannot permit alternate access. Rotating to a random unknown password is necessary but not sufficient; verify that login, email OTP, recovery, magic-link issuance, enumeration and unauthorised session creation are appropriately guarded at the Auth perimeter. **If this cannot be proven, do not use the email-alias approach at all.** Explore a supported Supabase phone-only session mechanism instead.
4. Reverify customer record, auth UUID, phone confirmed state, all approved UID links, memberships, policies and document access before/after synthetic tests.
5. Use the separate per-UUID approved manual alias script only after recovery proof and gated risk review, never from OTP login.
6. Recovery must be managed by a database administrator with verified backup/restore procedure. Do not attempt ad hoc raw `auth.users` or `auth.identities` writes or log an Auth password hash.

## Migration release conditions
- Current PR #3199 remains draft; code is preparation only and includes no callable production enrollment approval endpoint.
- Server enrollment preflight verifies Firebase Admin token; it **only returns an enrollment decision**. It does not insert links, approve them, rotate passwords, or issue sessions.
- Full migration still requires a server-side auditable write transaction with actor authorization and concurrency locking, tested restore method, and full Android-device + RLS integration tests.
- Rollback for candidate audit SQL is in `supabase/rollback/20261016150000_customer_firebase_migration_audit_down.sql`; rollback of an Auth alias is not equivalent to schema rollback.
- No production Auth identity, link or schema changes under this PR.
