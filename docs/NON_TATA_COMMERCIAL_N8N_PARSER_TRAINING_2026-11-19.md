# INSUREIT non-Tata commercial-motor PDF training — isolated candidate (2026-11-19)

## Parallel-work boundary

**Tata AIG training is running in a separate chat.** This branch and n8n candidate explicitly exclude all Tata AIG documents, parser functions, routes, test data and website changes. Do not alter or republish shared primary workflow `0uGscm0WUegvxa6V`. This training also makes no changes to ICICI, Production Supabase, Vercel environment variables, live policy statuses, intake queues, or GoDaddy/Cloudflare DNS.

GitHub branch: `feat/non-tata-iffco-nia-digit-parser-candidates-20261119`.
Isolated local n8n workflow: `V4F8lzU6wnB4EDyk` — `INSUREIT - Non-Tata Commercial Motor (NIA IFFCO Digit) - INACTIVE CANDIDATE`.
n8n project: personal project `Nishant Mishra <it@insureit.in>`. **UNPUBLISHED/INACTIVE**; protected draft webhook path `insureit-nontata-motor-pdf-candidate-v1` and a separate manual test trigger.

## Why this is isolated / latest releases reviewed

Reviewed the 15 most recent Vercel deployment records (Nov 18–19). The latest READY source was `8114982ede9898fe5d5c206130725e828ffb3ecc` on Nov 19. Also reviewed the latest GitHub commits and Tata PRs #4894, #4907, #4908, #4909 and #4910. These exposed four reusable lessons:

1. PDF.js/native text may reorder tables. Test both sorted/layout and raw extraction, plus actual n8n output — not just the HTTP response.
2. Exact parser IDs and validation-count contracts are insurer-specific: ICICI 13, Tata 18; never modify Tata paths for this work. New candidates have their own check set and require a dedicated website validator later.
3. Issuance date must be explicitly printed and must never be invented from coverage start, invoice, document-generation time or signature ambiguity. Preserve conditional manual-review warnings.
4. Use the insurer's **printed premium buckets and GST lines**. New India Commercial Vehicle documents have mixed 5% and 18% tax bases; the taxable breakdown does not necessarily equal simple OD/TP totals. Never double count a displayed enhancement-cover summary or CPA/LL items.

## Eight real uploaded PDF references — privately validated offline

Use these as training corpus only, never commit unredacted PDF, policyholder details, policy numbers, VIN, or signed storage URLs. Below are printed schedule numeric expectations, keyed by anonymized sample index:

| Layout | Sample | OD ₹ | TP ₹ | Net ₹ | GST ₹ | Gross ₹ | Policy IDV ₹ | Registration |
|---|---|---:|---:|---:|---:|---:|---:|---|
| New India Commercial Vehicle | NIA-1 | 15,184 | 35,738 | 50,922 | 4,576 | 55,498 | 2,978,298 | partial, manual review |
| New India Commercial Vehicle | NIA-2 | 26,102 | 44,375 | 70,477 | 6,973 | 77,450 | 5,188,900 | partial, manual review |
| New India Commercial Vehicle | NIA-3 | 4,672 | 16,149 | 20,821 | 1,661 | 22,482 | 799,511 | partial, manual review |
| New India Commercial Vehicle | NIA-4 | 6,810 | 16,149 | 22,959 | 2,046 | 25,005 | 1,011,714 | partial, manual review |
| New India Commercial Vehicle | NIA-5 | 5,677 | 16,424 | 22,101 | 1,891 | 23,992 | 804,262 | partial, manual review |
| New India Commercial Vehicle | NIA-6 | 430 | 16,149 | 16,579 | 897 | 17,476 | 291,600 | complete |
| IFFCO Tokio Commercial Vehicle | IFFCO-1 | 5,847 | 7,367 | 13,214 | 2,378.52 | 15,592.52 | 2,978,742 | complete |
| Go Digit Commercial Vehicle | DIGIT-1 | 2,415.46 | 7,647 | 10,062.46 | 1,811.24 | 11,873.70 | 2,061,770 | complete |

The printed NIA registration fragments are *not full vehicle plate numbers*. The candidate intentionally emits `ok:false`, a specific review warning and `registration_status:partial_plate_requires_review` for five NIA samples. Only the sixth NIA layout has a complete plate. All samples must remain review-only regardless of checks.

Offline testing against both native text orders for all eight uploaded originals verified the supplied source figures and mandatory extracted identities. n8n **Code node** synthetic tests:
- Execution `956`: NIA complete-plate layout, `ok:true`, printed net/tax/gross reconciled.
- Execution `957`: IFFCO Tokio, `ok:true`.
- Execution `959`: Go Digit, `ok:true`.
- Execution `960`: NIA partial plate, correctly `ok:false` with `registration_complete` failure.
- Execution `961`: unknown insurer, correctly `ok:false`.
- A deliberately incomplete Digit fixture (execution `958`) correctly failed source checks; corrected realistic fixture passed.
These are **synthetic text-node executions**, NOT real PDF binary uploads executed through the draft webhook. Native n8n PDF extraction, private signed-source pipeline, actual precision of all eight samples *inside n8n*, and website contract integration are still separate gates.

## Implementation and release policy

- Parser: `infra/n8n-local/workflows/non-tata-commercial-motor-native-pdf-parser-v1.js`. Pure native-text logic, no external HTTP, no storage or booking.
- Regression: `infra/n8n-local/tests/non-tata-commercial-parser-regression.mjs`. Run `node infra/n8n-local/tests/non-tata-commercial-parser-regression.mjs` from repository root. Eight anonymized layout checks plus unknown-provider and tampered-gross negatives.
- Draft workflow: manual text trigger + code parser, and distinct header-authenticated POST PDF webhook + n8n Extract from File (PDF) feeding that code. Same existing header-auth credential, **no new key created**. The new path is **not on the public 8787 allowlist**, and candidate remains inactive.
- Stable output: `contract_version:"1"`, whitelisted insurer parser ID, `extraction_method:"native_pdf_text"`, `checks`, `fields`, `premium_components`, `review_required:true`, `auto_finalize_allowed:false`. No direct registration, customer assignment, policy update, queue retry, finalization or database writes.
- Before deployment: real PDF binary end-to-end tests for the eight samples in a private/test path, exact field-by-field comparison including manufacturing year/registration/engine/chassis and premium tax classes, negative corrupted PDF and wrong-insurer tests, adjust parser when raw n8n extract differs, independent website validator/admission rules, full CI, explicit user authorization to publish and Vercel manual deploy. **Never switch parser globally or edit any Tata AIG route here.**

No production publishing, workflow activation, shared workflow modification, Vercel deploy or policy data change was performed as part of this candidate.
