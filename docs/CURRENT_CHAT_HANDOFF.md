# Current Chat Handoff

> **Consolidated:** 2026-08-12 (IST)
>
> Read with `docs/INSUREIT_PROJECT_CONTEXT.md` and `docs/POLICY_OCR_GOOGLE_DOCUMENT_AI_HANDOFF.md`. Never store secrets, raw OCR text, policyholder PII, or complete policy documents here.

## Active track

Policy Onboarding OCR hardening remains an active production-sensitive track. Production portal is `https://portal.insureit.in`. Ordinary commits do not intentionally deploy production; `.deploy/production-trigger.json` is changed only after the user explicitly says `deploy now` or `finish and deploy`.

A separate UI preview track is also open for the portal navigation redesign. It is intentionally isolated from `main` until the user tests and approves the preview.

## Navigation redesign preview — 2026-08-12

**IMPLEMENTED / PREVIEW ONLY / NOT MERGED**

Branch:

```text
feature/insureit-shield-rail-navigation
```

Draft PR:

```text
#275 Redesign portal navigation with INSUREIT Shield Rail
```

Scope:

- Replaces the deep nested desktop sidebar with a two-part Shield Rail + contextual destination panel.
- Keeps permission-aware workspace visibility and existing routes.
- Flattens workspace navigation and moves create/import links into a compact Quick actions area.
- Adds permission-aware navigation search with Ctrl/Cmd+K.
- Adds a remembered collapsed desktop rail whose width is reflected by the portal shell.
- Rebuilds mobile drawer navigation as workspace -> destination drill-in instead of nested accordions.
- Changes mobile `More` into a real full-navigation launcher rather than a Settings link.
- Preserves mobile focus trap, Escape handling, scroll lock and focus return.
- Adds clearer `aria-current`, dialog and expanded-state semantics.
- Renames the visible workspace label from `Intermediatory` to `Intermediary`.

Primary files:

```text
apps/web-portal/components/claim-manager/app-navigation.tsx
apps/web-portal/components/claim-manager/mobile-navigation.tsx
apps/web-portal/components/claim-manager/mobile-bottom-navigation.tsx
apps/web-portal/components/claim-manager/claim-manager-shell.tsx
```

Boundary:

- No claim, Partner/POSP/MISP workflow, Supabase schema, AuthBridge, iCall, OCR or production deployment-trigger behavior is intentionally changed.
- Do not merge PR #275 until the user has tested the preview and explicitly approves the navigation direction.
- If the user rejects the visual/interaction direction, revise or close the preview branch rather than changing production `main`.

## Verified pre-change parser baseline

User-local baseline before the latest structured-table architecture work:

```text
IFFCO regression:    10/10 passed
Digit regression:     5/5 passed
New India regression: 5/5 passed
Typecheck:             passed
Lint:                  0 errors
Build:                 passed
```

Do not reuse this as proof that the new structured-table commits pass.

## Live production findings

Repeated live tests with IFFCO policy `N8109328` established:

- insurer detection fixed: IFFCO-TOKIO
- product fixed: Package
- policy number fixed
- IDV fixed
- valid from/upto fixed and apply correctly
- CPA later read correctly as 330
- flattened OCR premium interpretation remained unsafe, producing OD `1` and TP values such as `997134`/`22409`

Durable learning: flattened table reading order must not be used as the sole financial evidence.

Known correct accounting target:

```text
Basic TP 7267 + Legal Liability 100 = TP 7367
CPA = 330
Printed net = 22739
OD = 22739 - 7367 - 330 = 15042
```

## Current OCR implementation

**IMPLEMENTED / NOT YET DEPLOYED OR VERIFIED:** a second IFFCO financial pass now consumes Google Document AI table cell anchors (`pages[].tables[]`) instead of relying only on flattened page text.

New file:

```text
apps/web-portal/lib/policy-ocr-iffco-structured-refiner.ts
```

Server action now extracts structured table rows and runs the structured IFFCO refiner after the existing text refiner. The structured pass rebuilds OD/TP/CPA from labeled premium rows and only returns them when the complete financial equation reconciles to printed net. If evidence is incomplete, financial fields are withheld rather than guessed.

Regression added:

```text
npm run policy-ocr:iffco-structured-regression
```

It covers the exact production-shaped bad state and the fail-safe missing-CPA case.

Relevant commits:

```text
a63604a773f5c2cdd5eaba08ada83cb0f125daec
6e3b37af37b254de367707f5d99cad96816c997b
f16058c0c159ec90f46d4b28a718d3205ab82a7b
1b5a19e8a31e7a2c7acf62510e3dcb7de94fbbf2
22d62f0387368ff8d0f1725321e0a286b2b9f5df
```

## Immediate OCR next step

Before any deployment, use the repository verification workflow for:

```text
npm run policy-ocr:iffco-structured-regression
npm run policy-ocr:iffco-regression
npm run policy-ocr:digit-regression
npm run policy-ocr:new-india-regression
npm run typecheck
npm run lint
npm run build
```

If these pass, wait for explicit deployment approval. After deployment, upload the same IFFCO file and verify OD `15042`, TP `7367`, CPA `330`. If Google returns no usable structured table rows, preserve Review Required and inspect sanitized structural evidence; do not add another proximity-based numeric guess.

United India remains deferred.
