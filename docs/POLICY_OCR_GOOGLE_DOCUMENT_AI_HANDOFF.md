# Policy OCR and Google Document AI Handoff

> **Consolidated:** 2026-08-09 02:15 IST
>
> This file is the source of truth for Policy Onboarding OCR. Do not store credentials, tokens, private keys, policyholder PII, vehicle identifiers, raw OCR text, or complete policy documents here.

## 1. Approved scope

Policy OCR may propose only Section 03, **Policy product, premium & validity**:

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

Comparison-only values:

- Printed net premium
- Printed GST / tax
- Printed gross premium

OCR must never populate customer, insured, owner, registration, chassis, engine, address, phone, PAN, GST identity data, or similar customer/vehicle identity fields. Review-before-apply is mandatory; OCR must never silently overwrite saved or manually entered values.

## 2. Architecture

**APPROVED / IMPLEMENTED**

```text
Policy PDF/image
  -> Next.js server action
  -> Vercel OIDC
  -> Google Workload Identity Federation
  -> short-lived service-account impersonation
  -> Google Document AI Enterprise OCR
  -> normalized page text
  -> INSUREIT insurer detector
  -> insurer-specific parser/refiner
  -> review modal
  -> selected Section 03 fields applied
```

Google is the OCR/text-reading layer only. Insurer detection, interpretation, accounting normalization, confidence, warnings, and regression logic stay in INSUREIT.

Primary files:

- `apps/web-portal/app/policies/policy-ocr-actions.ts`
- `apps/web-portal/lib/policy-ocr-parsers.ts`
- `apps/web-portal/lib/policy-ocr-digit-refiner-v2.ts`
- `apps/web-portal/lib/policy-ocr-iffco-refiner-v2.ts`
- `apps/web-portal/lib/policy-ocr-new-india-refiner.ts`
- `apps/web-portal/components/policy-ocr-import-panel.tsx`

## 3. Production Google identity design

No service-account JSON key is used. Production uses Vercel OIDC Workload Identity Federation and short-lived Google credentials.

Configured identities:

```text
Google project ID: insureit-policy-ocr-production
Google project number: 560319705586
Document AI location: us
Processor ID: 84d0facf88efc0d7
WIF pool: vercel-insureit
Provider: vercel
Service account: insureit-ocr-web@insureit-policy-ocr-production.iam.gserviceaccount.com
Allowed audience: https://vercel.com/antnish1s-projects
Allowed production subject: owner:antnish1s-projects:project:insureit:environment:production
```

Never expose Google/Vercel tokens to browser code. Do not create a long-lived Google key unless the architecture is explicitly changed and security-approved.

Legacy `POLICY_OCR_SERVICE_URL` / `POLICY_OCR_SERVICE_SECRET` variables must remain until the Google production journey is directly verified with all supported insurer families.

## 4. Current supported pure-motor parser baseline

The current training scope intentionally excludes United India for now. United India Miscellaneous/Special Type Vehicle and Contractors Plant & Machinery are deferred until a separate approved mapping/schema decision.

### 4.1 IFFCO-TOKIO commercial motor

Dedicated refiner:

- parser ID: `iffco_tokio_commercial_motor_v1`
- current dedicated refiner family: `iffco_tokio_commercial_motor_v2`
- regression command: `npm run policy-ocr:iffco-regression`
- **VERIFIED locally: 10/10 cases passed**

Coverage includes:

- real IFFCO document-layout reconstructions
- current `P400 Policy #` vs invoice/reference numbers
- previous-policy avoidance
- `Net(A)` and `Net(B)` on the same OCR row
- Section 2/add-on OD premium
- CPA ₹330 and CPA ₹0
- CPA declaration conflicts
- printed Net/GST/Gross reconciliation

Normalized accounting rule:

```text
OD = Net(A) + Section 2 OD/add-on premium
CPA = payable Owner-Driver PA row
TP = Net(B) - CPA
OD + TP + CPA must reconcile to printed net
```

If the financial row charges CPA but declaration wording says not applicable/deleted, retain the financial value for reconciliation but raise review/confidence warning.

### 4.2 Go Digit commercial motor

Dedicated refiner version:

```text
digit_commercial_motor_v1.8.0
```

Regression command:

```text
npm run policy-ocr:digit-regression
```

**VERIFIED locally: 5/5 cases passed.**

The pack includes a sanitized reconstruction of the actual Google Document AI reading order plus targeted failures for:

- manufacturing year becoming IDV
- premium numbers reordered
- missing direct OD recovered from printed net and TP
- invoice/reference IDs overriding current policy
- incorrect OD/TP role assignment

Digit v1.8 evidence priority:

```text
1. Exact labeled OD / TP rows
2. Derive missing side from printed Net
3. Numeric-pair reconciliation only as fallback
```

The dedicated refiner clears weaker base financial guesses before rebuilding IDV/OD/TP/CPA/totals. Explicit invoice Net/GST/Gross columns are stronger evidence than proximity within the premium block.

Known golden sample:

```text
Policy: D221859721
Product: Package
IDV: 3292441
OD: 27820.86
TP: 7267
CPA: No / 0
Printed net: 35087.86
GST: 6315.81
Gross: 41403.67
Valid from: 2025-08-27
Valid upto: 2026-08-26
```

### 4.3 The New India Assurance commercial motor

Dedicated refiner version:

```text
new_india_commercial_motor_v1.2.1
```

Regression command:

```text
npm run policy-ocr:new-india-regression
```

**VERIFIED locally: 5/5 cases passed.**

Coverage includes:

- real schedule layout
- NCB/subtotal values not becoming OD
- current policy vs previous policy
- ₹15 lakh Owner-Driver coverage limit not becoming CPA premium
- multiline Owner-Driver row where CPA premium is on the immediate continuation line
- liability normalization and full premium reconciliation

New India normalized accounting rule:

```text
OD = Net Own Damage Premium (A)
CPA = Owner-Driver PA premium row
TP = Net Liability Premium (B) - CPA
OD + TP + CPA must reconcile to Total Premium (A+B)
```

Known golden schedule:

```text
IDV: 4800000
OD: 33984
Net Liability (B): 44495
CPA: 325
Portal TP: 44170
Printed net: 78479
IGST: 8414
Gross: 86893
Policy: 80000031250350127994
Valid from: 2025-12-05
Valid upto: 2026-12-04
```

Durable New India lesson: do not scan into the next PA row when Owner-Driver premium appears on a continuation line. The semantic row must stop before the next PA label.

## 5. Cross-insurer verification state

**VERIFIED in the user's local environment on 2026-08-09:**

```text
New India regression: 5/5 passed
Digit regression:     5/5 passed
IFFCO regression:    10/10 passed
Typecheck:             passed
Lint:                  0 errors, 74 warnings
Next.js build:         passed
```

The `MODULE_TYPELESS_PACKAGE_JSON` warning from Node's `--experimental-strip-types` regression runners is non-fatal. Do not change the whole Next.js package to `"type": "module"` merely to remove this warning without a separate compatibility review.

These results prove parser/regression/build correctness for the committed baseline. They do **not** prove a production Google OCR user journey.

## 6. Relevant recent parser commits

```text
IFFCO regression/build compatibility baseline:
94445181378eee93376e482c87fc867de79c9b73

IFFCO real-layout routing regression:
7fb5914451a3e71f0d7b4a356de961b3e2c78c56

Digit v1.8 labeled-premium priority:
d95b1332c17b546bda9d057781ef48e1a50a91cd

New India v1.2 baseline/refiner + regression:
4c140352cd0f6fabc8ef63ebcf0a9f09d9f1fd62
43109b08e51fcf29de08ab8fd2859c9fd08b6181
76ea8bcd41cdfb0b1c9bb6961e0f3360640f0ac0

New India v1.2.1 CPA row fix:
691ba3f86d07ca61ac24ae896db5322392fe2499
```

## 7. Release and production state

**IMPLEMENTED / LOCALLY VERIFIED:** all three current pure-motor parser families above.

**NOT YET VERIFIED:** exact current production deployment of these latest parser commits and authenticated end-to-end Google OCR upload/review/apply behavior for all three insurers.

Ordinary commits do not intentionally deploy production. `.deploy/production-trigger.json` must only be updated when the user explicitly says **deploy now** or **finish and deploy**. A GitHub Actions deploy-hook success is not enough; verify the exact Vercel production commit reaches `Ready`, then test the live authenticated journey.

Do not infer production status from incidental or concurrent changes to `.deploy/production-trigger.json`; inspect exact deployment evidence.

## 8. Final live verification gate

When the user explicitly approves deployment, use one controlled production release containing the frozen IFFCO, Digit, and New India baseline. Then verify from `https://portal.insureit.in`:

1. Exact production deployment commit is identified and Vercel reports `Ready`.
2. Sign in with a policy-editor account and open `/policies/new`.
3. Upload a real Digit policy and verify all expected Section 03 fields.
4. Upload representative IFFCO policies, including an add-on/Section-2 case and a CPA-conflict case.
5. Upload the known New India commercial-motor policy.
6. Confirm only Section 03 changes after Apply.
7. Confirm printed Net/GST/Gross remain comparison-only.
8. Inspect server/function logs only for controlled operational errors; never log raw policy/OCR text or credentials.
9. If live Google OCR reading order differs from regression fixtures, sanitize that exact OCR shape, add a regression case, fix the parser, and rerun all insurer suites before another release.
10. Only after the complete authenticated journey passes should the OCR release be labeled **DEPLOYED / VERIFIED**.

## 9. Development rule for future insurer training

For every new insurer/policy family:

1. Obtain representative legally permitted samples.
2. Define the approved Section 03 mapping first.
3. Capture sanitized actual Google OCR reading order where possible.
4. Add insurer/family-specific interpretation rather than broad global regexes.
5. Add golden regression fixtures before release.
6. Run all existing insurer regressions, typecheck, lint, and build.
7. Fail uncertain extraction into Review Required; never silently guess.
8. Keep incompatible non-motor products out of motor OD/TP/CPA until the schema explicitly supports them.
