# INSUREIT Performance Optimization Handoff

> **Created:** 2026-08-09 (IST)
>
> This is the mandatory performance operating guide for future agents working on the INSUREIT web portal. Read it before changing navigation, layouts, server components, client components, middleware, data loading, list filters, forms, document views, workflow pages, policy onboarding, intermediary onboarding, or any shared UI component.
>
> Never store secrets, cookies, private data, full PAN/Aadhaar/bank values, raw provider responses, or customer documents in this file.

## 1. Why this file exists

The portal was repeatedly slowed by architectural patterns that looked harmless in isolation:

- remote auth/profile work before page render;
- forced dynamic rendering on pages that also loaded stable reference data;
- global client components and DOM observers mounted on every page;
- hard reloads and `fresh=Date.now()` URL churn;
- server/database calls for simple client-side filters;
- render-time signed URL generation for documents;
- heavy libraries imported into client bundles before the user needed them;
- large workflow routes loading many stages at once.

Future agents must treat performance as a workflow requirement, not a late polish pass. A feature is not production-ready if it makes normal navigation, filtering, opening menus, or validation feel slow.

## 2. Verified optimization release state

**IMPLEMENTED / DEPLOYED / SMOKE-VERIFIED on 2026-08-09:**

- Performance release commit included in production lineage: `bd84fc4`.
- Later deployed production commit smoke-tested: `36736fcd578610e63dcad1a282ca206603e48e0c`.
- Vercel reported deployment success for `36736fcd578610e63dcad1a282ca206603e48e0c`.
- `bd84fc4` is an ancestor of the deployed commit, so the performance release is included in that production deployment.
- Authenticated browser smoke test from `https://portal.insureit.in` showed no login loops, runtime errors, or access-denied loops on the tested routes.

Authenticated smoke-tested routes:

- `/dashboard`
- `/intermediaries`
- `/intermediaries/posp`
- `/intermediaries/misp`
- `/intermediaries/posp/new`
- `/intermediaries/misp/new`
- `/customers/posp-misp`
- `/customers/posp-misp/existing/new?partner_type=posp`
- `/customers/posp-misp/existing/new?partner_type=misp`
- `/policies/new`
- `/claims`
- `/customers`
- `/tasks`
- `/settings`

Historical freeze checks that passed after deployment:

- Empty `Save & Exit` on New POSP onboarding stayed responsive.
- Empty `Save & Exit` on New MISP onboarding stayed responsive.
- Empty `Save & Exit` on Existing POSP onboarding stayed responsive.
- Empty `Save & Exit` on Existing MISP onboarding stayed responsive.

Observed authenticated route timings during smoke test were mostly around `0.8s` to `3.5s` in browser automation. These are smoke timings, not formal p75/p95 production metrics.

## 3. Main performance lessons

### 3.1 Do not make internal navigation artificially fresh

**LEARNING:** Global `fresh=Date.now()` navigation and `window.location.assign()` made the app feel slow because every click created a unique URL and bypassed normal Next.js route reuse.

Correct rule:

- Use normal `<Link>`, `router.push()` and `router.replace()` for internal navigation.
- Use `router.refresh()` only after a mutation that genuinely needs fresh server data.
- Use `revalidatePath()` or `revalidateTag()` after writes.
- Do not append timestamp query params to ordinary review/list/workflow URLs.
- Do not add a global link interceptor for protected routes.

### 3.2 Client filters must not refetch when data is already loaded

**LEARNING:** Register filters such as `All`, `Active`, and `Onboarding` were too slow when each click changed URL/search params and forced another server/database round trip for a list already present on the client.

Correct rule:

- If the full list is already loaded and the filter is status/search/sort over visible rows, filter client-side.
- Preserve URL search params only when deep-linking is worth the server/navigation cost.
- For large datasets, use pagination/search endpoints deliberately; do not use a full-page navigation for every small filter change.
- Keep counters and selected states derived from the same in-memory list where possible.

### 3.3 Keep stable reference data cached

Stable values such as banks, OEMs, sales associates, document labels, permission definitions, template metadata and other master data should not be repeatedly fetched from Supabase on every render.

Correct rule:

- Use server-side cache helpers for stable reference reads.
- Give cache entries a short and explicit TTL when business freshness matters.
- Use cache tags or targeted invalidation when a master-data mutation changes the source.
- Keep mutation/server validation authoritative; caching option lists must not bypass permission checks or save-time validation.

### 3.4 Middleware must stay cheap

**LEARNING:** Remote Supabase auth/profile checks in middleware add latency before the page can start rendering and can be repeated again in server components.

Correct rule:

- Middleware should do coarse, cheap routing checks where possible.
- Detailed profile, role and capability checks belong in request-scoped server helpers.
- Use request-scoped memoization so a single render does not fetch the same profile or effective permission repeatedly.
- Never weaken authorization for speed. Reduce duplicate work; do not remove required checks.

### 3.5 Avoid broad `force-dynamic` and `revalidate = 0`

Dynamic rendering is sometimes required for authenticated, user-specific pages. It should not be the default response to uncertainty.

Correct rule:

- Add `force-dynamic` only when the route truly needs per-request rendering.
- Do not add `revalidate = 0` to pages that mainly show stable shell/reference data.
- Split static shell/reference data from dynamic user-specific data where possible.
- Document the reason when a route must remain fully dynamic.

### 3.6 Do not mount workflow-specific client code globally

**LEARNING:** Root-level client components, mutation observers and document scanners made every page pay for logic needed only by a few workflows.

Correct rule:

- Keep root layout lightweight.
- Mount workflow-specific validation, normalization, import links and observers only in the workflow layout/page that needs them.
- Prefer render-time formatting/masking over global DOM mutation scanners.
- If a global observer is unavoidable, throttle it and keep the scanned scope small.

### 3.7 Heavy libraries must load on demand

**LEARNING:** `pdf-lib` was imported at the top of client components, adding PDF code to the initial bundle even when the user did not download anything.

Correct rule:

- Do not top-level import heavy libraries in client components unless needed for the initial view.
- Lazy-load heavy libraries inside the click/action path with `await import(...)`.
- Prefer server-side document/PDF generation when it keeps the client bundle smaller and behavior more consistent.
- Check bundle impact after adding charting, PDF, OCR, spreadsheet, rich editor, map, date-range or animation libraries.

### 3.8 Generate signed document URLs only when needed

**LEARNING:** Some detail pages generated Supabase signed URLs for every document during render. That created N+1 storage calls before the page could display.

Correct rule:

- Render document metadata first.
- Use authenticated open/download routes that generate the signed URL only when the user clicks.
- Do not fetch bucket/path/sensitive storage fields in initial page SELECTs unless the page truly needs them.
- Keep authorization checks inside the open/download route.

### 3.9 Large workflow pages must not hydrate every stage

The intermediary application workflow was the heaviest route. It improved materially after stage-specific work was lazy-loaded and unnecessary default client code was removed.

Correct rule:

- Load only the current stage content.
- Dynamically import heavy stage components.
- Do not render hidden stage panels that the user may never open.
- Keep stage navigation instant, then fetch/render stage content deliberately.
- Treat any workflow page over roughly `250 kB` first-load JS as a performance risk requiring inspection.

### 3.10 Avoid duplicate context/API requests

**LEARNING:** Document upload/controller logic made duplicate context requests even though the server already provided enough state for the initial render.

Correct rule:

- Prefer server-provided initial props for state needed at page load.
- Let one owner fetch mutable document grids or status details.
- Before adding a client fetch, check whether the same data is already in route props, layout props, or a parent component.

## 4. Completed safe refinements from the speed cleanup

These were applied as part of the cleanup and should not be casually reverted:

- Removed global fresh dynamic route navigation from the root layout.
- Replaced several internal hard reloads with normal Next.js navigation.
- Lazy-loaded `pdf-lib` only on download action.
- Enabled `optimizePackageImports` for `lucide-react`.
- Throttled Aadhaar mask normalization to avoid repeated page-wide scans during mutation bursts.
- Made `/api/templates/posp-misp-v2` static/cacheable with a one-day revalidation window because the template is not user-specific.
- Moved intermediary document signed URL generation from render-time to click-time.
- Added request-scoped memoization for profile and effective permission lookups.
- Parallelized multi-capability checks instead of waterfalling permission reads.
- Moved customer and customer-application document signed URL generation to click-time open routes.
- Trimmed document-page SELECTs so initial renders no longer fetch storage bucket/path fields needed only for open/download.
- Removed additional fresh URL jumps in intermediary account review/workflow navigation.
- Added `lib/reference-data-cache.ts` for stable POSP/MISP reference reads such as banks, OEMs and sales associates.
- Removed `fresh=Date.now()` redirects from intermediary workflow/action paths that already call `revalidatePath`.
- Removed a duplicate `/api/intermediary-documents/context` request from the document upload controller.
- Kept POSP/MISP/existing onboarding route-post validation on the native browser path to avoid the historical freeze.

## 5. Guardrails for future feature work

Before adding a new page, component or workflow:

1. Identify whether the page is public, authenticated static shell, dynamic user-specific data, or mutation-heavy workflow.
2. Keep the root layout unchanged unless the behavior is genuinely global.
3. Avoid new `force-dynamic`, `revalidate = 0`, hard reloads, timestamp URLs, or top-level heavy client imports unless justified.
4. Check whether the data can be loaded once, cached, or filtered client-side.
5. Keep authorization server-side and authoritative.
6. For simple menus, tabs, filters and status chips, prefer instant client state over database refetches.
7. For large option sets, use typeahead/search endpoints instead of loading all rows or navigating on every filter click.
8. For documents, generate signed URLs only on click.
9. For forms, show immediate feedback without blocking native validation or locking the UI.
10. After implementation, run build/typecheck where relevant and do browser-level smoke tests on the affected route.

## 6. Performance review checklist

Use this checklist when reviewing any future change:

- Does this add a root-level client component or global event listener?
- Does this add a DOM observer, polling loop, interval, resize listener, or scroll listener?
- Does this add `force-dynamic`, `revalidate = 0`, `no-store`, or per-request cache bypass?
- Does this call Supabase or a route handler for a filter/sort/search that could run over already-loaded client data?
- Does this perform serial server/database calls that can be parallelized?
- Does this fetch the same profile, permission, master data, or document context more than once per request?
- Does this add a heavy client dependency to initial load?
- Does this force `window.location.assign`, `window.location.replace`, `router.refresh`, or a full page reload for an internal UI action?
- Does this create unique URLs with timestamps or random query params?
- Does this generate signed URLs or provider URLs during render instead of on click?
- Does this render hidden tabs/stages/modals with heavy logic before they are opened?
- Does this preserve security and server-side validation while improving speed?

If the answer to any risk item is yes, either redesign the change or record the reason and verification evidence.

## 7. Measurement expectations

Do not rely on feel alone. Use a mix of:

- `npm run build` route bundle output;
- browser automation smoke timings;
- Vercel deployment status and Speed Insights when available;
- focused route checks before and after a change;
- network inspection for duplicate requests;
- bundle inspection when adding dependencies.

Current practical targets:

- Normal route/menu navigation should feel immediate and should not take `5-20s`.
- Authenticated common pages should generally render in a few seconds or less under normal production conditions.
- Heavy workflow pages should keep first-load JS below roughly `250 kB` unless a specific exception is justified.
- List filters and status chips should update instantly when operating on already-loaded rows.

## 8. Context update rule for performance learnings

When an agent discovers a reusable performance lesson, record it in the correct compulsory context file:

- Use this file for speed, caching, navigation, bundle, hydration, data-loading, document-open, and route-rendering lessons.
- Use `docs/INSUREIT_PROJECT_CONTEXT.md` for durable business/schema/workflow rules.
- Use `docs/CURRENT_CHAT_HANDOFF.md` only for active continuation state.
- Use a dedicated integration handoff for integration-specific performance constraints.

Do not record every chat or temporary debugging detail. Record only verified root causes, implemented decisions, failed approaches that prevent repetition, and remaining risks that future agents must know.

Use evidence labels such as **VERIFIED**, **IMPLEMENTED**, **DEPLOYED**, **LEARNING**, **BLOCKED**, and **UNVERIFIED**. Never turn a guess into a rule.

## 9. Things still not fully proven

- Formal production p75/p95 performance metrics were not captured in this handoff.
- Vercel Speed Insights should still be used for release-grade performance monitoring.
- Some integration journeys such as real Policy OCR upload/apply, AuthBridge lookup, and iCall iframe remain governed by their own handoff files and require direct workflow verification.
- The production readiness audit remains broader than performance; do not treat this document as full launch approval.
