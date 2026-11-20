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

## Subsequent n8n candidate validation checkpoint

- After requiring model names to be **present in source** rather than hardcoding JCB, fresh n8n draft Code-node runs returned `ok:true` with correct printed premium totals for **IFFCO (execution 962)** and **Go Digit (963)**, with PDF-like synthetic model evidence.
- Six separate fresh New India synthetic source-layout executions: **964–969**. Each returned the exact expected printed OD, TP, net, GST and gross. Five partial registrations correctly returned `ok:false` / `registration_complete` failed. The one completed plate returned `ok:true`.
- Earlier baseline: 956 full NIA, 957 IFFCO, 959 Digit passed; 958 intentionally incomplete Digit failed; 960 partial-plate NIA and 961 unknown-provider correctly failed.
- The GitHub regression fixtures were updated to include **visible source evidence** for IFFCO JCB 3 DX and Digit JCB 3 DX ECO XPERT, because the parser now refuses to fabricate make/model from insurer identity alone.
- **Limit:** These execution IDs are *manual text fixture* tests only, even though they were executed by the real local n8n runtime. The original 8 PDFs have **not** yet gone through the draft n8n `Extract Native PDF Text` binary node as real file inputs. No production-ready declaration or publication is justified by these fixture passes.

### Follow-up items before live enablement
1. Run original PDFs privately through actual draft binary node and compare identities, policy start/end, insured, registration (including partials), chassis and engine, manufacturing year, seating/GVW, IDV, section premiums, mixed GST and gross independently.
2. In particular, rule out PDF.js raw ordering conflation of New India `Date of Issue` (printed on page 3) vs `Document generated by` (footer), and Digit invoice date vs policy coverage start; do not infer dates.
3. Run wrong-insurer, misprinted totals, scanned/no-native-text, signed-source expiry and missing PDF failures; ensure all result in review rather than false passes.
4. Design/verify separate website allowlist + validator contract **without changing Tata-specific 18-check acceptance**. Only after actual PDF and website checks, CI and user approval may the isolated candidate be published and routed from an isolated production path.

### Independent IFFCO GST negative-test correction

The dedicated PR CI identified that the initial IFFCO check was circular: it computed `gst=gross-net` and then compared `gross=net+gst`, which could never detect tampered gross. **Fixed before publication.** The parser now independently reads `GST Details / 997134` printed taxable value, 18% tax amount and invoice gross; checks both sources and arithmetic without inferring GST from total. Fresh local n8n synthetic executions: **972** correct invoice `ok:true`; **973** changed gross `ok:false` (`gross_reconciliation`, `invoice_gross_matches`); **974** changed GST `ok:false` (`gross_reconciliation`). The isolated GitHub test suite passed on the subsequent PR head. These remain review-only synthetic tests, not original binary-PDF passes.

## 2026-11-19 continuation: isolated IT production-site test page and real source-text validation

- Isolated local n8n workflow `V4F8lzU6wnB4EDyk` is the only workflow this branch changes. It uses an exact separate `/webhook/insureit-nontata-motor-pdf-candidate-v1` protected by the existing Header Auth credential; **never touch** the published Tata/ICICI workflow `0uGscm0WUegvxa6V`.
- The real-layout parser v2.1 was compared offline against all 8 original user-provided PDF documents using two native text orders; all **16/16 policy number, issuance-date, IDV and OD/TP/net/GST/gross comparisons** matched. Documents were not committed.
- The **actual original uploaded PDF text** (not synthetic fixtures) was then replayed through the local n8n Code node. Successful evidence: IFFCO execution `992` `ok:true`, Go Digit `993` `ok:true`, fully registered NIA `994` `ok:true`. NIA executions `995`–`999` matched exact printed financial figures but `ok:false` only for `registration_complete` because the policy prints a **partial**, not fully registered plate. This is an intentional review stop, not a lost or guessed registration number.
- **Still outstanding:** the original PDF bytes themselves have not been sent through n8n's binary `Extract Native PDF Text` node. The website upload test is meant to prove that last end-to-end gate. Do not call a text-replay a full PDF binary smoke test.
- New staff-only site at `/policies/non-tata-parser-test` uses `requirePolicyOcrTrainingOperator()`, a separate `/api/policies/non-tata-parser-test` PDF POST, strict three-insurer pre-classification and response checks. It returns fields, individual verification checks and printed premium totals **without updating policies, customers, Intakes, onboarding drafts or queues**. Tata AIG is excluded by insurer evidence gate.
- Nginx has an additional exact POST-only allowlist location for the isolated webhook, and retains the existing ICICI/Tata exact location/default 404. The Windows Docker host binds the config from its **local** repo, so a GitHub merge does not automatically install the new Nginx rule. After this PR merges, run `infra/n8n-local/refresh-isolated-nontata-proxy.ps1` on the Windows Docker host. The script fetches origin/main without checkout (safe during separate Tata training), verifies both allowlist paths, backs up local config, validates Nginx, reloads, and restores backup on failure. Do not expose n8n editor/admin.
- Production Vercel deployment remains a separate release operation. Test page is IT-only and **review only**; no auto finalization or bulk reprocessing. Full PDF binary path and the running Windows proxy must both be verified before claiming fully working production upload.

## 2026-11-20: registered vs unregistered correction and general Read rollout

- Re-examined all six original New India PDFs: five print only `MP-51`, `MP-23`, `MP-20`, `MP-18`, or `HR-00` (RTO prefixes, not full plates); all five have a 2026 manufacturing year plus chassis and engine. This is consistent with new vehicles pending registration but **not conclusive proof** of legal registration status. The remaining `MP-20-GB-2902` document has a complete plate.
- Existing website `buildPolicyOcrOnboardingUpdate()` already maps `registration_pending` to `Unregistered`, clears `registrationNo`, and preserves verified chassis/engine fields. The earlier parser's `registration_complete` check incorrectly stopped otherwise validated New India policies. **No weakening of financial, identity, insured, document or date checks is allowed**.
- PR #4914 integrates the three trained insurer layouts into the standard operations Policy Read, normal Intake OCR and reviewer-driven application. Its independent website adapter requires every insurer-specific check and printed financial reconciliation; it accepts a New India `ok:false` **only when registration_complete is the sole failed check** and the PDF contains an RTO prefix, valid manufacturing year and chassis/engine identity. It **omits** that prefix from the vehicle registration-number field to prevent a fictitious registered plate.
- Existing ICICI/Tata n8n webhook, native PDF parser, booking preflight and already registered customer/vehicle records are not modified. No auto booking, automatic queue lane conversion or Google fallback is enabled. The separate parser test page is widened to authorized policy editors, not unauthenticated users. The original uploaded PDF binary-through-n8n webhook test remains an on-site smoke test, not a completed validation claim.
