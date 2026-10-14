# Customer document upload hardening — 2026-10-14

## Scope and evidence
Branch `fix/customer-document-upload-diagnostics-20261014`. No production deployment, OTA, APK/AAB build, SQL changes, RLS relaxation, or live mobile-device verification.

Read-only repository audit found `external-claim-document-tabs.tsx` mapped both Storage API errors and thrown client/network errors to the same generic `This document could not be uploaded.` message. It directly calls the private `claim-documents` bucket, then writes `claim_documents` metadata. The same pattern also existed in customer vault and self-managed document uploads.

## Implemented
- `lib/claim-document-upload.ts`: classify known backend status/MIME/size/auth/transient failures to customer-safe messages; log only area, stage, category and status, never file or customer identifiers, token, path, or raw server error.
- `components/external-claim-document-tabs.tsx`: MIME normalization (avoid generic octet-stream when extension indicates valid format), local read error categorization, Storage and metadata distinction, and zero-length/read HTTP guards for single-document Claim Intimation.
- `app/customer/self-managed-documents.tsx`: same validation and error handling.
- `app/customer/upload-documents.tsx`: same validation, structured errors from single upload and first actionable failure in bulk result.
- `lib/supabase.ts`: native XHR status 0 now rejects as network failure rather than invoking Response with an invalid status.
- `scripts/customer-document-upload-regression.mjs`: static contracts for affected paths; run `node apps/mobile-app/scripts/customer-document-upload-regression.mjs`.

## Still outstanding
- Storage policies must be checked against the actual INSUREIT Supabase production project. Available connector accounts do not establish the project identity. Existing policies use `customers.profile_id` while customer membership access may be broader; do NOT loosen policies without demonstrating the current authorization mismatch.
- Need real-device test with Android/iOS file picker, and real error status for a reproducible failure. Test Claim Intimation single/bulk, Spot Intimation, self-managed, customer document vault, onboarding/KYC, and policy copy.
- Existing Claim Intimation multi-upload and other document screens still contain catch-all paths; further consolidation should be reviewed after gathering device/API evidence.
- Run TypeScript typecheck, regression and mobile CI; review results before merge.
- Confirm OTA runtime compatibility before any authorized OTA publish. No APK/AAB by default.

## Safety/rollback
Only application code and a regression script changed. Revert PR changes if regression is observed; no database migration to roll back. Preserve private storage, access controls, verified-claim document protections and existing customer data.
