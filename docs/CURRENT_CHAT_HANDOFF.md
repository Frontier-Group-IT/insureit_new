# Current Chat Handoff

> **Consolidated:** 2026-08-09 02:16 IST
>
> Read this file with `docs/INSUREIT_PROJECT_CONTEXT.md` and the relevant dedicated handoff before continuing. This is a curated continuation state, not a transcript. Never store secrets, tokens, cookies, passwords, private keys, full Aadhaar/bank values, raw OCR text, or customer policy documents here.

## 1. Current active work

The immediate active track is **Policy Onboarding OCR hardening and release preparation**. Secondary open tracks remain insurer-master normalization and Intermediatory shared-identity/onboarding work.

Repository:

- `Frontier-Group-IT/insureit_new`
- Application: `apps/web-portal`
- Production portal: `https://portal.insureit.in`
- Ordinary commits do not intentionally deploy production.
- Production deployment is a separate user-approved action through `.deploy/production-trigger.json`.

## 2. Policy OCR architecture and scope

Production design:

```text
Policy upload
 -> Google Document AI OCR
 -> INSUREIT server-side insurer detector/parser
 -> Section 03 review modal
 -> user applies selected fields
```

Google is the reading layer only. INSUREIT owns insurer interpretation and accounting normalization.

OCR may propose only:

- policy product
- IDV
- OD
- TP
- CPA opted/premium
- policy number
- insurer
- valid from/upto

Printed net/GST/gross are comparison-only. Never populate customer/vehicle identity fields from OCR. Review-before-apply remains mandatory.

Dedicated source of truth: `docs/POLICY_OCR_GOOGLE_DOCUMENT_AI_HANDOFF.md`.

## 3. Verified pure-motor parser baseline

**VERIFIED in the user's local environment on 2026-08-09:**

```text
New India regression: 5/5 passed
Digit regression:     5/5 passed
IFFCO regression:    10/10 passed
Typecheck:             passed
Lint:                  0 errors, 74 warnings
Next.js build:         passed
```

This is local parser/build evidence only, not production Google OCR proof.

### IFFCO-TOKIO

- dedicated family: `iffco_tokio_commercial_motor_v2`
- regression: 10/10
- covers real-layout reconstructions, current policy vs invoice/previous policy, same-row Net(A)/Net(B), Section-2 add-ons, CPA 330/0, CPA declaration conflicts, reconciliation
- normalized rule: `OD = Net(A) + Section2`, `TP = Net(B) - CPA`

### Go Digit

- dedicated refiner version: `digit_commercial_motor_v1.8.0`
- regression: 5/5
- includes sanitized actual Google OCR reading-order case
- evidence order: exact labeled OD/TP -> derive missing side from printed net -> numeric reconciliation fallback
- explicit invoice Net/GST/Gross outrank premium-block proximity

### The New India Assurance

- dedicated refiner version: `new_india_commercial_motor_v1.2.1`
- regression: 5/5
- golden schedule: IDV 4,800,000; OD 33,984; Net Liability 44,495; CPA 325; portal TP 44,170; net 78,479; IGST 8,414; gross 86,893
- normalized rule: `TP = Net Liability Premium (B) - CPA`
- durable bug fix: Owner-Driver premium may be on the immediate continuation line; stop before the next PA row so later ₹60 entries and the ₹15 lakh coverage limit cannot become CPA

Recent New India CPA fix commit:

```text
691ba3f86d07ca61ac24ae896db5322392fe2499
```

Policy OCR handoff consolidation commit:

```text
6480bd618dc55fdbd8c30f429be4b60d6c90ff35
```

## 4. OCR release state

**IMPLEMENTED / LOCALLY VERIFIED:** current IFFCO, Digit and New India pure-motor parser baselines.

**NOT YET VERIFIED:** an exact current production deployment containing these latest parser commits and the complete authenticated Google Document AI upload -> review -> apply journey for all three insurer families.

Do not claim live success from local regression, build success, a GitHub commit, a deploy-hook call, or an incidental `.deploy/production-trigger.json` change.

When the user explicitly says **deploy now** or **finish and deploy**, release one controlled batch and then verify:

1. exact Vercel production commit and `Ready` state;
2. real Digit upload;
3. representative IFFCO upload(s), including Section-2/add-on and CPA-conflict behavior;
4. known New India upload;
5. only Section 03 is modified after Apply;
6. printed totals remain comparison-only;
7. no raw OCR/policy text or credentials appear in logs.

If a live Google OCR reading order differs from the regression fixtures, sanitize that exact shape, add it to regression, fix the dedicated parser, and rerun all insurer suites before another release.

## 5. United India scope

User explicitly deferred United India for now, including both:

- Miscellaneous & Special Type Vehicles – Package
- Contractors Plant & Machinery

Do not force either into the current motor parser release. Contractors Plant & Machinery is structurally incompatible with the current OD/TP/CPA schema without an approved schema decision.

## 6. Insurance Company master open requirement

The canonical insurer master should ultimately store verified full registered/legal insurer names, with aliases/search labels separately. Preserve referenced insurer UUIDs; do not truncate/recreate the table casually.

New policy onboarding should eventually select only active canonical insurers, while historical policies retain their referenced insurer even after deactivation. OCR aliases should resolve to canonical insurer records rather than auto-creating arbitrary names.

Do not guess current legal insurer names. Verify from authoritative sources before seeding or renaming.

## 7. Intermediatory state still open

Shared Partner/POSP/MISP identity synchronization migration remains **IMPLEMENTED IN REPOSITORY but UNAPPLIED / UNVERIFIED in Supabase** unless newer evidence exists:

```text
supabase/migrations/20260803182500_sync_linked_intermediary_shared_identity.sql
commit cdc9b4c041305e174d54469f7117587320ca1f95
```

Do not claim that synchronization bug fixed live until the migration is applied and fresh Partner/POSP/MISP workflows are tested bidirectionally.

The Partner signed-registration certificate projection is implemented in repository but requires production/authenticated verification unless newer evidence exists.

## 8. Immediate continuation

For OCR work, the next meaningful step is **production release + authenticated live Google Document AI validation**, but only after explicit deployment approval from the user.

Until that approval, do not modify `.deploy/production-trigger.json` and do not call the OCR baseline deployed/live.
