# INSUREIT R6 — protected private-only Storage sample restoration

**Status on 17 Nov 2026: PR preparation only. NO Storage files uploaded. NO live production writes.**

## Inputs and evidence

- R4 actual managed SQL restore [run #44044851869](https://github.com/Frontier-Group-IT/insureit_new/actions/runs/44044851869) passed atomic import and post-commit audit: 183 public tables, 87 Auth users, 91 identities, 211 reconciled COPY targets, 75,733 rows, 0 row-count mismatches, API table grants intentionally revoked.
- R5 authenticated Storage v1 manifest [plan run #44056796940](https://github.com/Frontier-Group-IT/insureit_new/actions/runs/44056796940) and [full sample byte verification run #44060040375](https://github.com/Frontier-Group-IT/insureit_new/actions/runs/44060040375) both passed. Storage snapshot **`20261116T225734Z`** (NOT SQL snapshot); **304 verified files**, **499,999,884 total plaintext bytes**, **8 populated backup buckets**, **4 content classes**, **3 size bands**, **0 oversize**, **1 empty bucket** (not included).
- Isolated SQL-restored target: **0 Storage buckets, 0 objects**, with source production isolated from all R4-R6 actions.

## Proposed R6 workflow, not yet merged or run

Manual-only `.github/workflows/insureit-isolated-storage-r6-restore.yml` is protected by GitHub environment `insureit-recovery-isolated`, restricted to `main`, read-only GitHub token, exact target ref `klnodxnmlqbofolxxrsr`, isolated project CA read-only target SQL check, mandatory exact authenticated latest Storage manifest timestamp, dedicated R2 **GET-only** identity, source-backup Storage encryption key (not the DB key).

**Default:** `execute_storage_upload=false`, `confirm_nonatomic_upload=false`, `confirm_isolated_target=false`. First R6 dry-run uses only private R2 GET and **does not even receive** the isolated Storage service-role secret. The R6 upload step is reachable only if BOTH `execute_storage_upload=true` AND `confirm_nonatomic_upload=true` on an authorized manual workflow. No SQL DML, Storage metadata rows, role policy changes, production Supabase key, R2 write/delete or app deployment.

### Upload behavior — only after separate operator approval

- **Target-only** API base is an immutable constant `https://klnodxnmlqbofolxxrsr.supabase.co`; never accepts an arbitrary destination URL.
- Requires private GitHub environment secret **`RECOVERY_TARGET_SUPABASE_SERVICE_ROLE_KEY`** for this **isolated project only**. NEVER enter the production service-role key. Never expose its value in chat, repo files, Actions logs or issues. A wrong project key must fail the target API authorization. It is not needed for the plan-only run.
- Before any Storage write, validates 304 exact selected objects, 499,999,884 plaintext bytes and 8 bucket memberships from the same authenticated Storage v1 snapshot. Rejects stale pointer, incorrect count/bytes, unsafe paths, malformed manifests and file sizes above 50,000,000 bytes.
- First checks target Storage API for **zero buckets**. Then creates **only the 8 sampled bucket IDs, always with `public=false` and 50MB maximum file size**, using native Storage API. Existing source bucket public/private and allowed-MIME policy settings are **NOT** copied because the encrypted Storage manifest contains bucket IDs rather than full settings. This intentionally **tightens** access instead of exposing private insurance documents, but is not original policy parity.
- Decrypts each selected R2 object **only in process memory**, confirms its authenticated length/SHA256 and uploads through native target `/storage/v1/object` API with `x-upsert=false`; immediately GETs via the isolated authenticated object API and compares length/hash. No plaintext archive or object names are uploaded as GitHub artifacts or logged.
- Final bucket list must be exactly those 8 and **all must remain private**. Final counters must equal 304 and 499,999,884 bytes. This cannot establish *all* 3,767 manifest objects or metadata parity.
- **Not atomic:** Storage bucket creation and each file upload persist independently. If any upload fails, **STOP, inspect target Storage, never automatically rerun** against partially populated target. R6's first preflight additionally fails once buckets/objects exist, preventing accidental overwrites.

## Review gates

1. Wait for both R2 Backup and Web portal PR CI to pass. Explicitly approve merge; PR creation alone does not deploy or write anything.
2. After merge, confirm independent environment protection and app/notification isolation. Manually run R6 **plan-only** with `expected_storage_snapshot=20261116T225734Z`, `confirm_target_ref=klnodxnmlqbofolxxrsr`, checked isolation, both upload-related checkboxes **unchecked**. This checks that R6 still selects exactly the previously authenticated and verified sample.
3. Before any real upload: independently check available isolated Free-plan Storage quota, bucket path/MIME handling and the dedicated isolated-target service key. **Add only** `RECOVERY_TARGET_SUPABASE_SERVICE_ROLE_KEY` to the protected isolated GitHub environment. It must not be the production key.
4. Obtain distinct explicit operator authorization **APPROVE R6 PRIVATE STORAGE SAMPLE UPLOAD**, then manually run with two affirmative booleans only after all preflight checks. Review target API/hash outputs and independently query target Storage bucket/object metadata.
5. Further phases: source-vs-target bucket configuration mapping (including 2 source buckets currently public, which R6 deliberately restores as private), original Storage RLS policy grants (35), custom Auth trigger, roles/ACL, Vault/Realtime, end-to-end representative access checks, and service-level DR certification.

**Important:** R6 is a bounded representative restore exercise, not full Storage or full INSUREIT disaster-recovery certification. Never point a live app at the isolated target without separate authorization and complete security and data validation.
