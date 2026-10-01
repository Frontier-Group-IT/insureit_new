## 2026-10-01 — Life/Health document-set refinement

- Branch: `feature/life-health-document-actions-2026-10-01`; PR #2634.
- Add Policy: Proposal Form, Illustration Form, Payment Receipt, Other Form.
- Case detail + issued-policy edit: Policy Copy, Proposal Form, Illustration Form, Payment Receipt, Other Form.
- `Mark Policy Issued` highlighted light purple/lavender.
- No database/schema/RLS/mobile/native change.
- Scoped source changes are applied; canonical web verification is being rerun on the final PR head before merge.
- **IMPLEMENTED; CI/merge/deployment pending.**

---

## 2026-09-25 — Large voice campaign XLSX export fix

- Branch: `fix/voice-campaign-large-export`.
- Production evidence: campaign export route returned HTTP 500 with runtime error `Could not load campaign call failures for export.`; affected campaign had 612 members, 1,298 call attempts and 1,294 attempt-event rows.
- Root cause: report loader still used `.limit(100)` for members and sent the full attempt-ID list in one event `.in(...)` query; call-attempt reads also relied on the default Supabase row cap.
- Fix: page campaign members and attempts at 500 rows, chunk opportunity/event UUID filters at 100 IDs, page event rows inside each chunk, and retain deterministic ordering.
- Privacy/access boundary unchanged: IT Super User + `manage_system:approve`, masked mobile numbers, no transcript/raw provider payload export.
- Added `voice-campaign-export:regression` to canonical web verification.
- **IMPLEMENTED; PR/CI/merge/deployment/runtime re-test pending.**