# Policy OCR and Google Document AI Handoff

> **Consolidated:** 2026-08-07 03:05 IST
>
> This file is the source of truth for the Policy Onboarding OCR workflow. Read it before modifying policy OCR, insurer parsers, Google Document AI authentication, the review/apply modal, or the production deployment path. Do not store credentials, tokens, private keys, policyholder PII, or raw policy documents in this file.

## 1. Current objective

The Policy Onboarding page already exists at `/policies/new`. The user wants uploaded insurer policy schedules to populate only Section 03, **Policy product, premium & validity**, after a visible review step.

The OCR workflow must never automatically populate customer, insured, owner, registration, chassis, engine, address, phone, PAN, GST, or other vehicle/person identification fields.

Approved fields that may be proposed for Section 03:

- Policy product
- IDV / sum insured
- OD premium
- Third-party premium
- CPA opted
- CPA amount
- Policy number
- Insurance company
- Valid from
- Valid upto

Verification-only values shown in the modal, not directly copied:

- Printed net premium
- Printed GST
- Printed gross premium

## 2. Architecture decision

**APPROVED AND IMPLEMENTED ARCHITECTURE**

Production uses Google Document AI Enterprise Document OCR only as the document-reading layer. INSUREIT remains responsible for insurer detection, field extraction, validation, confidence, and review-before-apply behavior.

```text
Policy PDF/image
  -> Next.js server action
  -> Vercel OIDC token
  -> Google Workload Identity Federation
  -> short-lived service-account impersonation
  -> Google Document AI OCR
  -> normalized page text
  -> INSUREIT insurer detector
  -> Digit / IFFCO-Tokio / New India parser
  -> review modal
  -> selected Section 03 fields applied to the form
```

Google does not contain the insurer-specific rules. Adding another insurer later means adding or improving a parser in the INSUREIT backend and its regression fixtures/tests. This allows local development and prevents lock-in to Google field extraction.

## 3. Production authentication design

No service-account JSON key is used.

Production authentication uses:

- Vercel OIDC, Global issuer mode
- Google Workload Identity Federation
- Short-lived Google access tokens
- Service-account impersonation

Google/Vercel identifiers currently configured:

```text
Google Cloud project ID: insureit-policy-ocr-production
Google Cloud project number: 560319705586
Document AI location: us
Document AI processor ID: 84d0facf88efc0d7
Workload Identity Pool ID: vercel-insureit
Provider ID: vercel
Service account: insureit-ocr-web@insureit-policy-ocr-production.iam.gserviceaccount.com
Vercel issuer: https://oidc.vercel.com
Allowed audience: https://vercel.com/antnish1s-projects
Allowed production subject: owner:antnish1s-projects:project:insureit:environment:production
```

The connected service account is visible in Google Cloud under the `vercel-insureit` pool. The provider is enabled and restricted to the exact INSUREIT production subject.

Never create or commit a JSON key unless the architecture is deliberately changed and security approval is explicit. Never expose any Google credential through `NEXT_PUBLIC_*` variables.

## 4. Required Vercel production environment variables

These were reported by the user as added to Vercel Production:

```text
GOOGLE_CLOUD_PROJECT_ID=insureit-policy-ocr-production
GOOGLE_CLOUD_PROJECT_NUMBER=560319705586
GOOGLE_WORKLOAD_IDENTITY_POOL_ID=vercel-insureit
GOOGLE_WORKLOAD_IDENTITY_PROVIDER_ID=vercel
GOOGLE_SERVICE_ACCOUNT_EMAIL=insureit-ocr-web@insureit-policy-ocr-production.iam.gserviceaccount.com
GOOGLE_DOCUMENT_AI_LOCATION=us
GOOGLE_DOCUMENT_AI_PROCESSOR_ID=84d0facf88efc0d7
```

Do not create `VERCEL_OIDC_TOKEN` manually. Vercel supplies it dynamically to the production function.

Legacy variables may still exist and must not be removed until the Google production workflow has been directly verified:

```text
POLICY_OCR_SERVICE_URL
POLICY_OCR_SERVICE_SECRET
```

## 5. Implemented repository files

### Google request and authentication

`apps/web-portal/app/policies/policy-ocr-actions.ts`

Responsibilities:

- Require a user with policy-edit permission.
- Validate file type and 15 MB size limit.
- Read Vercel OIDC token server-side.
- Exchange the OIDC token through Google STS.
- Impersonate the dedicated service account.
- Call the configured Document AI processor.
- Convert Google output into normalized page text.
- Pass the pages to the INSUREIT parser layer.
- Return only reviewable field-level output to the client.

### Insurer detection and extraction

`apps/web-portal/lib/policy-ocr-parsers.ts`

Responsibilities:

- Normalize Google OCR text.
- Detect supported insurers.
- Route to dedicated parsers.
- Extract only Section 03 fields.
- Build evidence, confidence, parser ID/version, and warnings.

Supported parser IDs:

```text
digit_commercial_motor_v1
iffco_tokio_commercial_motor_v1
new_india_motor_v1
generic_motor_v1
```

### Review and apply interface

`apps/web-portal/components/policy-ocr-import-panel.tsx`

Responsibilities:

- Professional modal workflow.
- Upload PDF/JPG/PNG/WebP.
- Display parser and extraction information.
- Select fields individually or all at once.
- Show confidence/review status.
- Keep printed totals as comparison-only values.
- Apply only approved Section 03 fields.
- Close after successful application and scroll to the section.

## 6. Supported and known policy samples

### Digit commercial vehicle policy

Known sample: `A GROUP ENTERPRISES INSURANCE.pdf`

Expected values from prior local tests:

```text
Insurer: Digit General Insurance Limited
Product: Package
IDV: 3292441
OD premium: 27820.86
Third-party premium: 7267
CPA opted: No
CPA amount: 0
Policy number: D221859721
Valid from: 2025-08-27
Valid upto: 2026-08-26
Printed net premium: 35087.86
Printed GST: 6315.81
Printed gross premium: 41403.67
```

Google Document AI console testing successfully read the policy number, policy period, IDV, OD, TP, net, GST, and gross values.

The previous local parser date issue was fixed with a one-year date-pair fallback. A repeatable local Docker test returned:

```text
policy_start_date = 2025-08-27
policy_end_date = 2026-08-26
```

### IFFCO-Tokio commercial vehicle policy

Known expected values:

```text
Insurer: IFFCO-Tokio General Insurance Co. Ltd.
Policy number: N8174870
Product: Package
IDV: 3391729
OD premium: 4641
Third-party premium: 7697
CPA opted: Yes
CPA amount: 330
Valid from: 2026-07-29
Valid upto: 2027-07-28
Printed net premium: 12338
Printed GST: 2220.84
Printed gross premium: 14558.84
```

The parser must not confuse invoice/reference `1-8N1JSC69` with the actual policy number.

### New India Assurance motor policy

Known sample involved Charu Mishra. A dedicated `new_india_motor_v1` path exists through the generic motor extractor with New India-specific insurer detection and confidence.

### United India CPM

Not yet fully supported. The known United India Contractors Plant and Machinery format does not map cleanly to the motor form's OD/TP/CPA structure. Do not claim support or force values into incompatible fields. Implement it only after an approved schema/mapping decision.

## 7. Local development model

The old Python/PaddleOCR service remains useful for local comparison and parser research:

```text
infrastructure/policy-ocr-service/app.py
infrastructure/policy-ocr-service/app_runtime.py
infrastructure/policy-ocr-service/app_runtime_v2.py
```

The local Docker service was rebuilt and verified. It is no longer intended to be the production OCR dependency after Google integration is confirmed.

Future insurer development should follow this pattern:

1. Collect representative, legally permitted sample policies.
2. Run a sample through Google OCR once.
3. Save sanitized OCR text/layout as a local test fixture, not the raw sensitive policy.
4. Add or improve a dedicated parser.
5. Add regression tests for exact expected fields.
6. Test locally without repeated Google calls where possible.
7. Release as beta-supported first.
8. Improve using verified user corrections.

Later machine-learning experiments may be trained locally, but Google remains the OCR reader unless the architecture changes. A locally trained model is a separate interpretation component and cannot simply replace/upload into Google's OCR processor.

## 8. Relevant commits and pull request

Important historical OCR commits include:

```text
848e36e native PDF text first
679e197 / de2f600 restrict OCR to Section 03
875bab1 / c93a584 initial Digit and IFFCO parsers/tests
0671d6d / 71f4b7b Digit runtime fixes and package tests
cc73b95 / 6ff8a6f / 12a4b63 IFFCO dates/GST, production tests, modal redesign
14384e4 / 33377a7 / 9a0cd73 / b77ff08 Digit period fixes/runtime
acb7a897e447adb55e91c35b158a8a9ced95bc5c robust Digit policy date-pair fallback
```

Google integration:

```text
PR #199: Use Google Document AI for policy OCR
Branch: work/google-document-ai-ocr
Merged commit: 8b08adb79f818d81bab2fccbdfd59baa2c46bd85
Production trigger commit: 1bfde759edfcda6de4ba7bffa2c04ac6f7dd83b8
```

PR #199 changed:

- `apps/web-portal/app/policies/policy-ocr-actions.ts`
- `apps/web-portal/lib/policy-ocr-parsers.ts`
- `apps/web-portal/.env.example`

## 9. Verification evidence

The user ran these checks on `work/google-document-ai-ocr`:

```text
npm install
npm run typecheck
npm run lint
npm run build
```

Observed results:

- Typecheck passed with no errors.
- Lint completed with 68 warnings and 0 errors.
- The warnings were existing unused-variable warnings plus one existing hook dependency warning in `policy-ocr-import-panel.tsx`.
- Next.js production build completed successfully.
- `/policies/new` was included in the generated route output.
- `npm install` reported 6 high-severity dependency vulnerabilities; no `npm audit fix --force` was run. Do not run a force upgrade as part of OCR work without a separate dependency review.

This is build evidence only. It is not proof of a successful production OCR journey.

## 10. Deployment state at handoff

**IMPLEMENTED:** Google Document AI integration is merged into `main`.

**CONFIGURED BY USER:** Vercel production variables and Vercel OIDC Global mode were reported as set. Google Workload Identity provider and connected service account were visibly configured.

**DEPLOYMENT TRIGGERED BUT NOT VERIFIED:**

- `.deploy/production-trigger.json` was updated in commit `1bfde759edfcda6de4ba7bffa2c04ac6f7dd83b8`.
- The normal push-triggered workflow did not appear for that API-created commit.
- An existing protected deployment workflow job was re-run to call the same Vercel deploy hook.
- At the last observed state, GitHub Actions run `31006080897` was queued.
- The re-run is based on an older workflow run/head SHA, although the deploy hook itself is expected to deploy current `main`. This expectation must not be treated as proof.
- No Vercel build result for the Google OCR release was directly observed.
- No live policy upload through Google Document AI was directly verified.

Therefore the correct current status is **UNVERIFIED PRODUCTION DEPLOYMENT**. Do not state that Google OCR is live until exact Vercel deployment evidence and a live test exist.

## 11. Immediate continuation steps

1. Check GitHub Actions run `31006080897` and confirm whether the re-run completed successfully.
2. Open Vercel Deployments and identify the newest Production deployment.
3. Confirm the deployed source branch is `main` and inspect the source commit. Prefer evidence that includes or follows trigger commit `1bfde759...` and therefore contains merged OCR commit `8b08adb...`.
4. Confirm the Vercel deployment reaches `Ready`; inspect build/function logs for OIDC or environment-variable errors.
5. Sign in to the real production portal with a policy-editor account.
6. Open `/policies/new`.
7. Upload the known Digit policy first.
8. Confirm the modal shows the expected Digit values, including both dates.
9. Apply the fields and confirm only Section 03 changes.
10. Repeat with IFFCO-Tokio and New India.
11. Inspect Vercel function logs for Google STS, IAM Credentials, or Document AI errors without logging policy text or credentials.
12. Only after all three live tests pass, mark the integration DEPLOYED/VERIFIED and remove obsolete self-hosted OCR variables if no fallback is required.

## 12. Common failure points and durable lessons

### OIDC audience mismatch

Vercel Global mode emits audience:

```text
https://vercel.com/antnish1s-projects
```

Google's provider must list that exact value under allowed audiences. An empty list would normally expect the provider resource name and token exchange would fail.

### Subject restriction

The provider condition and service-account principal filter must match exactly:

```text
owner:antnish1s-projects:project:insureit:environment:production
```

Changing Vercel team slug, project name, environment name, or issuer mode requires updating Google configuration.

### Issuer mode

Google is configured for Vercel Global issuer:

```text
https://oidc.vercel.com
```

Do not switch Vercel to Team mode without updating the Google issuer.

### Do not guess parser fixes

When a parser misses a value, first inspect sanitized Google OCR page text/evidence from the actual policy format. Avoid broad regex changes based on assumptions. Add a regression fixture before releasing the fix.

### Review remains mandatory

OCR is assistive. It must never silently overwrite saved or manually entered fields. High confidence may preselect a field, but the user must review and apply.

### Privacy and logging

Do not log raw OCR text, complete policies, personal identity fields, vehicle identifiers, credentials, OIDC tokens, or Google access tokens. Keep only minimal operational metadata and field-level audit information approved by the product design.

## 13. Future expansion

The architecture is intentionally extensible. Future parser IDs may include:

```text
united_india_cpm_v1
icici_lombard_motor_v1
hdfc_ergo_motor_v1
bajaj_allianz_motor_v1
tata_aig_motor_v1
```

Do not create a parser name merely because an insurer is detected. A supported parser requires representative samples, exact field mapping, tests, confidence/evidence behavior, and a beta-to-supported release decision.
