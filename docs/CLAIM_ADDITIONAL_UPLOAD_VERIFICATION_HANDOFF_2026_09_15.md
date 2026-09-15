# Claim additional-upload verification handoff — 2026-09-15

## State

**IMPLEMENTED ON FEATURE BRANCH / NOT MERGED / NOT DEPLOYED**

Branch: `fix/claim-additional-upload-verification`

## Problem

Legacy claim files that were added as extra files under the same document category can exist with `verification_status = rejected` and `rejection_reason = Replaced by newer upload`. The Document Verification UI treated those rows as true rejected/reupload-required files, disabled their selection checkbox, and the server verification action rejected them.

## Implemented behavior

- Treat only the legacy `Replaced by newer upload` marker as an additional-upload compatibility state, not a true reupload rejection.
- Such files appear as Pending/selectable in Document Verification.
- On verify, the compatibility action revalidates normal claims permissions/access, repairs only the selected legacy rows back to `pending`, clears the obsolete rejection marker, then delegates to the canonical document-verification action.
- Genuine rejected/reupload-requested files remain blocked until replaced.
- Current Add File uploads already insert a new pending `claim_documents` row without changing existing files; true per-file Replace behavior is unchanged.

## Scope

No migration, schema, RPC, storage-policy, or production data sweep is included. Legacy rows are repaired only when an authorized user selects them for verification.
