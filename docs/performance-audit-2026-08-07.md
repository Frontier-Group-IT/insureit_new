# InsureIT Performance Audit - 2026-08-07

## Scope

Audit target: `apps/web-portal`, the Next.js App Router web portal deployed at `https://insureit-drab.vercel.app`.

This audit inspected route inventory, production build output, middleware/auth flow, root client scripts, high-traffic admin pages, intermediary onboarding/workflow pages, form/button patterns, heavy dependencies, and production response headers for unauthenticated requests.

Official references used:

- Next.js production checklist: https://nextjs.org/docs/app/guides/production-checklist
- Next.js caching guide: https://nextjs.org/docs/app/guides/caching-without-cache-components
- Next.js prefetching guide: https://nextjs.org/docs/app/guides/prefetching
- Next.js lazy loading guide: https://nextjs.org/docs/app/guides/lazy-loading
- Next.js package bundling guide: https://nextjs.org/docs/app/guides/package-bundling
- Vercel CDN cache docs: https://vercel.com/docs/caching/cdn-cache
- Vercel Data Cache docs: https://vercel.com/docs/caching/runtime-cache/data-cache
- Vercel Speed Insights docs: https://vercel.com/docs/speed-insights/using-speed-insights

## Current Baseline

Production build completed successfully.

Important build metrics:

- 62 App Router pages.
- 16 route handlers.
- 92 client TS/TSX files.
- 42 files use `force-dynamic`.
- 39 files use `revalidate = 0`.
- 14 route-level `loading.tsx` boundaries.
- 56 server-action files.
- Middleware bundle: 36.4 kB.
- Shared first-load JS: 103 kB.
- Largest route: `/intermediaries/applications/[id]/workflow`, 187 kB route JS and 386 kB first-load JS.
- Most authenticated admin pages load around 185-212 kB first-load JS.

Unauthenticated production checks:

- `/login`: `200`, `x-vercel-cache: PRERENDER`, `cache-control: public, max-age=0, must-revalidate`, measured about 1.7s from local network.
- `/dashboard`: `307` to `/login?next=%2Fdashboard`, measured about 240 ms.
- `/intermediaries/posp/new`: `307` to login, measured about 355 ms.

Authenticated route timing still needs browser/session-level profiling with production cookies or Vercel Speed Insights.

## Exact Causes Found

### 1. Middleware Adds Remote Network Work Before Most Pages

File: `apps/web-portal/middleware.ts`

The middleware matcher covers almost every protected section. For a request with an access token, `checkSession()` performs:

- Supabase Auth `/auth/v1/user` fetch.
- Supabase REST `profiles` fetch.

If the token is invalid, refresh flow adds `/auth/v1/token`, then calls `checkSession()` again.

Impact: protected navigations pay remote auth/profile latency before the page render starts. Many pages then repeat profile and permission checks inside server components/actions.

Fix direction:

- Stop using middleware for full remote authorization on every request.
- Keep middleware for cheap cookie presence, coarse redirects, and portal separation.
- Move detailed profile/capability checks into cached server helpers per request.
- Use a request-scoped profile loader so a route does not fetch the same user/profile repeatedly.

### 2. Dynamic Rendering Is Applied Broadly, Not Surgically

Examples:

- `apps/web-portal/app/dashboard/page.tsx`
- `apps/web-portal/app/intermediaries/applications/[id]/workflow/page.tsx`
- `apps/web-portal/app/intermediaries/applications/[id]/page.tsx`
- many register/list/edit pages

The app has 42 `force-dynamic` files and 39 `revalidate = 0` files. That disables static generation and normal route cache benefits for a large percentage of the portal.

Impact: most pages become server-rendered on demand even when parts of the page are stable master data, static layout, or low-frequency reference data.

Fix direction:

- Keep truly user-specific pages dynamic, but cache stable data separately.
- Cache master data like banks, vehicle manufacturers, permission definitions, document labels, and template metadata.
- Split pages into static shell + dynamic user data where possible.
- Avoid `revalidate = 0` unless the page truly needs per-request freshness.

### 3. The Dashboard Fallback Can Execute a Large Query Fan-Out

File: `apps/web-portal/lib/operations-dashboard.ts`

If `get_operations_dashboard` RPC is missing or invalid, fallback performs a `Promise.all` with 27 Supabase requests.

Impact: dashboard speed depends heavily on the optimized RPC existing and staying healthy. If the RPC fails, the dashboard can become very slow and noisy.

Fix direction:

- Treat the dashboard RPC as mandatory production infrastructure.
- Add a health check/test for `get_operations_dashboard`.
- Cache dashboard summary output for a short TTL, for example 30-60 seconds per role/scope.
- If fallback remains, make it an admin-only diagnostic path, not the normal user path.

### 4. Intermediary Workflow Route Is Too Heavy

File: `apps/web-portal/app/intermediaries/applications/[id]/workflow/page.tsx`

Build result: `/intermediaries/applications/[id]/workflow` has 386 kB first-load JS, the largest route in the app.

The route imports and renders multiple workflow concerns in one page:

- primary editor
- document upload controller
- migration editor
- registration/PDF stage
- training/exam stage
- agreement/IIB stage
- popup/toast/auto-refresh controllers

Impact: users pay JS and hydration cost for stages they may not use in the current view.

Fix direction:

- Dynamically import heavy stage components by current stage.
- Move PDF generation out of the default client bundle.
- Split workflow into route segments or lazily mounted tabs/stages.
- Keep the stage navigation instant, but fetch/render stage content on demand.

### 5. `pdf-lib` Is In Client Bundles

Files:

- `apps/web-portal/app/customers/applications/intermediary-registration-form.tsx`
- `apps/web-portal/app/intermediaries/applications/compact-registration-form.tsx`

Both are client components importing `pdf-lib` at module top level.

Impact: users download PDF generation code as part of the page bundle even if they never click "Download PDF".

Fix direction:

- Move PDF generation to an API route/server action, or
- lazy-load `pdf-lib` inside the click handler with `await import("pdf-lib")`.

Preferred: server-generated PDF for consistency and smaller client JS.

### 6. Global Root Client Components Run On Every Page

File: `apps/web-portal/app/layout.tsx`

Root layout mounts:

- `AadhaarMaskNormalizer`
- `LegacyIntermediaryImportLink`
- `ProfessionalFormValidation`
- `SuccessPopup`
- `FreshDynamicRouteNavigation`
- `RouteProgressBar`

Impact: every page, including login/static pages, pays for these client components and their effects/listeners. `AadhaarMaskNormalizer` and `LegacyIntermediaryImportLink` use mutation observers/document scanning patterns.

Fix direction:

- Move workflow-specific components into workflow layouts only.
- Replace DOM mutation normalizers with render-time masking.
- Keep global route progress only if needed, but avoid global fresh navigation.

### 7. Fresh Navigation Pattern Defeats Route Reuse

File: `apps/web-portal/components/fresh-dynamic-route-navigation.tsx`

The component intercepts links for important dynamic pages, appends `fresh=Date.now()`, and uses `window.location.assign`.

Impact:

- Bypasses normal Next.js client navigation behavior.
- Creates unique URLs that cannot reuse prior route payloads.
- Makes browser back/forward and prefetch less effective.
- Forces full dynamic route work for many review/edit pages.

Fix direction:

- Remove global fresh navigation.
- Use `router.refresh()` only after mutations that need fresh server data.
- Use targeted `revalidatePath`/`revalidateTag` after writes.
- Preserve normal `<Link>` navigation and Next.js prefetch.

### 8. Signed URL Generation Is N+1 On Some Detail Pages

File: `apps/web-portal/app/intermediaries/applications/[id]/page.tsx`

`DocumentStatus()` creates a Supabase admin client and calls `createSignedUrl()` per document card.

Similar pattern exists in:

- `apps/web-portal/app/customers/[id]/edit/page.tsx`
- `apps/web-portal/app/customers/applications/[id]/page.tsx`

Impact: detail pages add one storage call per document before render completes.

Fix direction:

- Generate signed URLs in one server utility before render.
- Prefer an authenticated `/open` route for documents, generating a signed URL only when the user clicks.
- Use short-lived links only for visible/open actions, not for every card by default.

### 9. Master Data Is Refetched On Many Form Pages

Examples:

- banks
- vehicle manufacturers
- POSP/MISP associates
- customers/vehicles/insurers for policy forms

Impact: pages wait on reference data that changes rarely.

Fix direction:

- Cache master/reference data with tags.
- Revalidate tags when master data changes.
- For large option sets, use search endpoints instead of loading all rows.

### 10. Button Feedback Is Partly Good, But Some Flows Still Feel Blocking

Good pattern:

- `components/form-submit-button.tsx` uses `useFormStatus`, disables while pending, and shows a loader.

Risk patterns:

- Several buttons use `window.location.assign/replace`.
- Some server-action flows redirect with `fresh=Date.now()`.
- Some client buttons perform remote calls and then force full route reloads.

Impact: the user sees a button pending state, but the navigation after the action still feels slow because it reloads a large dynamic route.

Fix direction:

- Keep pending states.
- Replace hard reloads with `router.push`, `router.replace`, `router.refresh`, optimistic UI, and small success dialogs.
- For create/update actions, return structured results where possible and update local UI without reloading the entire page.

## Prioritized Fix Plan

### P0 - Measurement and Guardrails

1. Enable Vercel Speed Insights for production.
2. Add a lightweight performance checklist to PR review:
   - no new root client components without reason
   - no new `force-dynamic`/`revalidate=0` without justification
   - no top-level heavy client imports
   - no `window.location.assign` for internal navigation unless documented
3. Add bundle analyzer support for local audits.

### P1 - Remove Global Slow Path

1. Refactor middleware to avoid remote Supabase profile checks on every request.
2. Add request-scoped/cached profile and permission helpers.
3. Remove global `FreshDynamicRouteNavigation`; replace with targeted refresh after writes.
4. Move `LegacyIntermediaryImportLink` and Aadhaar DOM normalizer out of root layout.

### P2 - Fix Largest Route

1. Split `/intermediaries/applications/[id]/workflow` by active stage.
2. Lazy-load stage-specific components.
3. Move PDF generation server-side or lazy-load it only on click.
4. Do not render hidden stage content when a different stage is active.

### P3 - Cache Stable Data

1. Cache banks, vehicle manufacturers, document definitions, and permission definitions.
2. Use cache tags and invalidate on master-data writes.
3. Convert template route `/api/templates/posp-misp-v2` from `no-store` to a cacheable response unless the content becomes user-specific.

### P4 - Reduce Query Fan-Out

1. Make dashboard RPC mandatory and tested.
2. Replace per-document signed URL generation with click-time open routes.
3. Avoid loading full option lists on large forms; use typeahead/search endpoints.

## Release Criteria Before Production

Targets:

- Authenticated dashboard server response under 800 ms p75 on Vercel.
- Intermediary workflow first-load JS under 250 kB.
- Most admin pages first-load JS under 180 kB.
- No critical workflow button uses hard page reload for internal navigation.
- No route adds `force-dynamic` or `revalidate = 0` without written reason.
- Vercel Speed Insights shows stable INP and LCP before release.

## Bottom Line

The website is not slow because of one bad button. The main performance problem is architectural:

1. too much remote auth/profile work in middleware,
2. too many pages forced fully dynamic,
3. a global client layer mounted everywhere,
4. heavy workflow bundles,
5. hard refresh/fresh URL navigation patterns,
6. repeated server/database/storage work during render.

The fastest production improvement path is to remove global forced freshness, cache stable data, and split the intermediary workflow route first.

## Completed Safe Refinements

Applied after the audit:

- Removed global `FreshDynamicRouteNavigation` from the root layout so normal Next.js client navigation and prefetching are no longer globally bypassed.
- Replaced several POSP/MISP workflow hard reloads with `router.push` / `router.replace`.
- Lazy-loaded `pdf-lib` only when a user clicks "Download PDF".
- Enabled `optimizePackageImports` for `lucide-react`.
- Throttled the global Aadhaar mask normalizer with `requestAnimationFrame` so mutation bursts do not repeatedly scan the page.
- Made `/api/templates/posp-misp-v2` static/cacheable with a 1-day revalidation window because the generated Excel template is not user-specific.
- Moved intermediary document signed URL generation from render-time to click-time through `/intermediaries/applications/documents/[id]/open`.
- Added request-scoped memoization for server profile lookups and effective permission lookups. This de-duplicates identical auth/permission reads during a single request without changing access rules.
- Parallelized `hasAnyEffectiveCapability()` so multi-capability checks no longer waterfall one permission query after another.
- Moved customer and customer-application document signed URL generation from render-time to click-time through `/customers/documents/[id]/open` and `/customers/applications/documents/[id]/open`.
- Trimmed document page SELECTs so initial renders no longer fetch storage bucket/path fields that are only needed when opening a document.
- Replaced remaining intermediary account-review/client back-navigation fresh URL jumps with normal Next.js router/link navigation while keeping the existing component API.
- Added `lib/reference-data-cache.ts` and moved stable POSP/MISP reference reads for banks, OEMs, and sales associates behind short-lived server cache entries. This reduces repeated master-data queries on workflow, onboarding, review, and import pages while keeping mutation validation live.
- Removed `fresh=Date.now()` redirects from the intermediary workflow/action paths that already call `revalidatePath`, allowing stable URLs and better route reuse.
- Removed a duplicate `/api/intermediary-documents/context` request from the document upload controller. The controller now uses the server-provided GST/legacy flags while the document grid remains responsible for fetching current document links.

Verified result:

- Production build passes.
- `/intermediaries/applications/[id]/workflow` improved from 386 kB first-load JS to 210 kB first-load JS.
