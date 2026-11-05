# Self-Managed Claims — Operations Workflow Parity (2026-11-05)

## Requested behavior
Within the Operations portal, self-managed claims must use the same nine-stage journey, detail saving, stage progression, document operations, verification, history, and finance workflows as broker-managed claims. Preserve `claim_service_mode = self_managed` and the policy source; do not convert ownership implicitly.

## Verified root cause
Production claim EXT/1092 (`491da6d7-cf5b-4511-bc6c-2578605f44c7`) is an external self-managed claim. Its stage save failed with PostgreSQL error `Managed claim not found.`. The existing `persist_managed_claim_stage_transition_from_details` trigger filters exclusively on `broker_managed`. Production database was inspected read-only; no live values were changed.

## Code changes (branch only)
- The Operations /claims/[id] page now uses the shared editable nine-stage component for internal and external self-managed claims, rather than routing internal self-managed cases to the assistance viewer.
- Workflow stage actions, Spot Intimation, initial/ongoing verification and signed document uploads allow self-managed claims for already-authorized Operations users; intermediary sessions remain excluded from self-managed mutations.
- The migration extends four scoped PostgreSQL functions: stage transition trigger; initial-document submission trigger; initial-document verification completion; spot-survey completion. The migration dynamically modifies verified prior definitions and aborts on unexpected definitions. It preserves existing user, role, and claim-scope checks, all document requirements, and broker-managed paths.
- Self-managed save-only stage edits do not implicitly advance status. Completed-stage records still use the usual advance path.
- An independent rollback restores prior function definitions.

## Release safety
Do not apply database migrations, merge, deploy, change production claim records, or run destructive live tests without explicit approval. Before deploying application changes, apply the reviewed migration first (otherwise self-managed stage insert will continue failing). Verify claim operations for both self-managed and broker-managed records under an authorized Operations identity, with read-only inspection before any controlled test mutations.

## Outstanding validation
- GitHub Verify web portal and Verify claim effective permission RLS must be green on the final PR head.
- SQL has only been inspected by read-only checks against production function signatures. Database migration execution, rollback execution, and authenticated end-to-end workflow testing have **not** been performed.
- Customer-facing self-tracking features, account handoff, and Partner permission semantics are deliberately not rewritten. Existing private customer-milestone synchronization remains restricted to internal broker-managed claims to avoid mutating customer milestones without explicit scope review.
