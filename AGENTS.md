# Repository Agent Instructions

## Mandatory startup context

Before doing any work in this repository, read all of the following:

- `docs/INSUREIT_PROJECT_CONTEXT.md`
- `docs/CURRENT_CHAT_HANDOFF.md`
- `docs/PRODUCTION_DOMAIN_HANDOFF.md`
- `docs/ICALL_AWS_GATEWAY_HANDOFF.md`
- `docs/AUTHBRIDGE_RC_HANDOFF.md`
- `docs/POLICY_OCR_GOOGLE_DOCUMENT_AI_HANDOFF.md`
- `docs/PERFORMANCE_OPTIMIZATION_HANDOFF.md`
- `docs/MOBILE_EXPO_PREVIEW_HANDOFF.md`

Do this at the beginning of every new ChatGPT/Codex session connected to the repository. Do not ask the user to repeat information already recorded in those files.

Treat `docs/INSUREIT_PROJECT_CONTEXT.md` as the durable technical and business-rule source of truth. Treat `docs/CURRENT_CHAT_HANDOFF.md` as the current conversation continuation state, including active audit findings, selected work, implementation boundaries, and unresolved risks. Treat `docs/PRODUCTION_DOMAIN_HANDOFF.md` as the source of truth for the canonical production portal domain, GoDaddy DNS, Vercel custom-domain binding, Supabase Auth URL configuration, public portal environment settings, domain-sensitive integration verification, and launch-time DNS safeguards. Treat `docs/ICALL_AWS_GATEWAY_HANDOFF.md` as the source of truth for the iCall APIs, AWS Lightsail fixed-IP gateway, Vercel environment, SSO/iframe integration, CSP history, cookie issue, verified state, and immediate continuation steps. Treat `docs/AUTHBRIDGE_RC_HANDOFF.md` as the source of truth for AuthBridge Detailed RC service 372, its three-step encryption/lookup/decryption contract, AWS gateway route, verified UAT state, security incident, and Policy Onboarding vehicle-registration continuation work. Treat `docs/POLICY_OCR_GOOGLE_DOCUMENT_AI_HANDOFF.md` as the source of truth for policy OCR scope, Google Document AI, Vercel OIDC federation, insurer parsers, test evidence, deployment state, and continuation steps. Treat `docs/PERFORMANCE_OPTIMIZATION_HANDOFF.md` as the source of truth for speed, caching, navigation, bundle, hydration, data-loading, document-open, route-rendering, and performance regression-prevention rules. Treat `docs/MOBILE_EXPO_PREVIEW_HANDOFF.md` as the source of truth for mobile app changes, Expo preview OTA publishing, runtime/channel compatibility, clean source-state requirements, mobile environment handling, and mandatory installed-device verification.

Update the durable project context after material workflow, schema, constraint, migration or architecture changes. Update or consolidate the current chat handoff after active work is materially implemented, blocked or verified. Update the production-domain handoff after material production-domain, GoDaddy DNS, Vercel domain, Supabase Auth URL, public-origin, callback/redirect, iframe-origin, or launch-time DNS changes. Update the iCall gateway handoff after material iCall API, gateway, domain, IP allowlist, CSP, cookie, SSO, iframe, UAT or production changes. Update the AuthBridge handoff after material provider-contract, gateway, field-mapping, Policy Onboarding, UAT, credential, security, or production changes. Update the policy OCR handoff after material changes to Google authentication, OCR providers, insurer detection/parsers, Section 03 mapping, testing, deployment, privacy controls, or production verification. Update the performance handoff after material speed, caching, navigation, bundle, hydration, server-rendering, data-loading, route-filtering, signed-document URL, middleware, or route-regression findings. Update the mobile Expo preview handoff after material mobile runtime, channel, branch, build profile, OTA publishing, installed-app verification, or Expo failure-mode findings.

Never store secrets, API keys, passwords, tokens, cookies, private keys, full sensitive identity values or MCP credentials in repository context files.

## Smart context retention and learning policy

Repository context is a curated operational memory, not a transcript archive. **Do not update `AGENTS.md` or a context/handoff file after every chat.** Save information only when it materially improves the correctness, safety or continuity of future work.

### What belongs in durable context

Record only:

- A verified business rule, invariant, schema constraint, API contract or architecture decision.
- A user-approved decision that was actually implemented or is an explicit current requirement.
- A confirmed production/staging state supported by direct evidence.
- An unresolved blocker, dependency or risk that the next session must know to continue safely.
- A concise learning from a failed approach when its root cause and corrected rule will prevent repetition.

Do not record:

- Raw chat transcripts, every prompt, brainstorming, abandoned options or repetitive status updates.
- Speculation, assumptions or a proposed fix presented as current fact.
- Temporary debugging noise, copied logs, stack traces or raw provider/database errors.
- Claims that a build, deployment, migration, integration or workflow succeeded without direct evidence.
- Secrets or unnecessary personal/sensitive data.

### Evidence labels

When state could be misunderstood, identify it accurately:

- **VERIFIED** — directly observed in current code, schema, environment, logs or a repeatable test.
- **IMPLEMENTED** — committed in code; this does not automatically mean deployed or live.
- **APPLIED** — migration/configuration was confirmed in the target environment.
- **DEPLOYED** — the target platform reported a successful final deployment for the exact commit.
- **BLOCKED** — a named dependency prevents completion.
- **LEARNING** — a failed attempt produced a reusable root-cause rule.
- **UNVERIFIED** — expected or documented, but not directly confirmed.

Do not collapse these states. In particular, committed is not applied, a deploy-hook request is not deployed, and an API success response is not proof of a complete user journey.

### How to record successful work

Record the durable outcome, not the conversation that produced it. Include only the minimum useful evidence, such as:

- Business or technical rule established
- Files/schema/integration affected
- Commit or migration identifier
- Checks actually run and their result
- Deployment/application state if directly verified
- Remaining risk or follow-up

### How to record mistakes and failed approaches

Preserve a failed approach only when it teaches a durable lesson. Summarize:

1. What assumption or approach failed
2. The verified root cause
3. The corrected rule or safer approach
4. Whether cleanup, repair or verification remains

Do not preserve a long failure chronology. Do not state “no changes were made” when compensating cleanup was best-effort or unverified. Never turn a speculative workaround into a repository rule.

### Context file boundaries

- `AGENTS.md` — stable operating rules for agents and repository work. Do not use it as project history.
- `docs/INSUREIT_PROJECT_CONTEXT.md` — durable current business rules, architecture, schema constraints and verified system lessons.
- `docs/CURRENT_CHAT_HANDOFF.md` — only the active continuation state needed by the next session. Rewrite/consolidate stale sections instead of continuously appending.
- `docs/PRODUCTION_DOMAIN_HANDOFF.md` — canonical production-domain, DNS, Vercel, Supabase Auth URL, public-origin, iframe-origin and go-live domain state.
- `docs/ICALL_AWS_GATEWAY_HANDOFF.md` — iCall/gateway-specific verified state, blockers and continuation actions.
- `docs/AUTHBRIDGE_RC_HANDOFF.md` — AuthBridge Detailed RC provider contract, gateway state, Policy Onboarding integration boundaries, security requirements and verification evidence.
- `docs/POLICY_OCR_GOOGLE_DOCUMENT_AI_HANDOFF.md` — Policy OCR scope, Google/Vercel identity configuration, insurer parser architecture, test evidence, deployment state, durable lessons and continuation actions.
- `docs/PERFORMANCE_OPTIMIZATION_HANDOFF.md` — speed, caching, navigation, bundle, hydration, data-loading, document-open, route-rendering and performance regression-prevention rules.
- `docs/MOBILE_EXPO_PREVIEW_HANDOFF.md` — mobile app source-state, Expo preview OTA, runtime/channel, environment, clean publish, installed-device verification and mobile preview failure-mode rules.
- `docs/PRODUCTION_READINESS_AUDIT.md` — current source-backed production risks and remediation order.
- `docs/PRODUCTION_RELEASE_CHECKLIST.md` — reusable evidence-based release gates.

When information becomes obsolete, replace or remove it. Avoid duplicating the same fact across files unless a short cross-reference is necessary for safety.

### Context update test

Before writing context, ask:

1. Is this fact verified, approved, blocked or a durable learning?
2. Will a future session make a safer or more correct decision because it is recorded?
3. Is this the correct context file?
4. Can the same value be expressed more briefly without losing the evidence or warning?

If the answer to either of the first two questions is no, do not save it.

### Current working agreement

### Compulsory GitHub CI verification protocol

**MANDATORY FOR ALL AGENTS:** do not ask the user to run routine repository verification commands on their local PC/WSL when the same checks can run in GitHub Actions.

- `.github/workflows/verify-web-portal.yml` is the canonical automated verification gate for the web portal.
- It must run the Policy OCR regressions (IFFCO structured, IFFCO, Digit, New India), TypeScript typecheck, lint, and the Next.js production build.
- Agents must inspect the GitHub Actions run and job logs themselves, fix CI/workflow/code failures themselves where repository access permits, and rerun through normal commits. Do not shift routine CI execution back to the user.
- User-local terminal execution is reserved only for a genuinely local-only dependency that GitHub Actions cannot access or reproduce. If that rare case occurs, state the concrete reason before asking the user to run anything.
- Run the full canonical gate exactly once for a release, normally on the feature pull request. Do not rerun the same regressions/typecheck/lint/build after merge or inside the production deployment workflow.
- `.github/workflows/deploy-production.yml` must validate the successful `Verify web portal` pull-request run ID, its exact verified commit, merged-PR status and current `main` ancestry before calling the Vercel production deploy hook. This fast provenance check reuses the green gate; it does not rebuild the application.
- A green CI gate proves only the automated checks for that exact commit. It does not prove Vercel Ready, migrations applied, external integrations working, or the authenticated live user journey; verify those separately before claiming them.
- Do not weaken, bypass, skip, or remove the CI gate merely to make a deployment proceed. Fix the underlying failure or record a real blocker.

- Approved implementation changes use a feature branch and one pull request so the canonical verification gate runs once before merge.
- Before modifying an existing file, fetch the current `main` version and use its current blob SHA.
- Vercel deploys from `main`.
- Automatic Vercel deployment from ordinary Git commits is intentionally disabled.
- `.deploy/production-trigger.json` is retained only as historical release metadata and no longer triggers deployment. Ordinary development commits must not modify it.
- Trigger one batched production deployment only after the user explicitly says **deploy now** or **finish and deploy**. Dispatch `.github/workflows/deploy-production.yml` directly with the successful feature-PR verification run ID and its verified head commit. Do not create a deployment-trigger commit or deployment-trigger pull request.
- A successful GitHub Actions hook request proves only that Vercel accepted the request. Check the Vercel build/deployment result before claiming production success.
- A committed migration is not proof that it has been applied in Supabase.
- Do not claim build, deployment, migration or live workflow success without direct evidence.

## Production domain and DNS protocol

When changing production domains, DNS, Vercel custom domains, Supabase Auth URLs, public portal URLs, callback/redirect origins, iframe allow-lists, or launch-time domain configuration, read and follow:

- `docs/PRODUCTION_DOMAIN_HANDOFF.md`
- `docs/ICALL_AWS_GATEWAY_HANDOFF.md` when iCall/iframe behavior is involved
- `docs/AUTHBRIDGE_RC_HANDOFF.md` when gateway/AuthBridge behavior is involved

Current canonical production application origin is:

```text
https://portal.insureit.in
```

The former `https://insureit-drab.vercel.app` hostname is a temporary fallback during stabilization and must not be treated as the canonical production origin. The dedicated production-domain handoff supersedes stale historical URL references elsewhere in repository snapshots.

Mandatory safeguards:

- Do not change unrelated GoDaddy `@`, `www`, MX, TXT, SPF, DKIM, DMARC, email, Microsoft 365, verification or public-site records as part of portal work.
- Do not create speculative subdomains. Add a hostname only for a concrete implemented service with a defined routing/TLS plan.
- Before major DNS changes, capture/export the existing DNS state so rollback is possible.
- Keep `portal.insureit.in` as the canonical web-app origin unless the user explicitly approves another migration.
- Keep the old Vercel hostname and its Supabase redirect entries until stabilization is complete and remaining domain-sensitive integrations are verified.
- Do not change AWS gateway, AuthBridge, iCall credentials, Supabase keys or Google Document AI identity settings solely because the public web hostname changes. First prove that the affected server-to-server path actually depends on the browser origin.
- iCall `Open in new tab` has been verified working from `portal.insureit.in`; the remaining iframe failure is blocked on iCall allowing the new origin in its frame/CSP policy and confirming cross-site session-cookie compatibility. Do not bypass vendor controls with an insecure proxy.
- A future official gateway hostname such as `api.insureit.in` is optional infrastructure cleanup, not a launch requirement. It would require DNS, TLS, Nginx/server-name, Vercel environment and integration regression work.
- Verify login/logout, invite/reset links, AuthBridge RC lookup, Policy OCR, document flows and iCall behavior from the official domain before final launch sign-off.

## Policy OCR and Google Document AI protocol

When modifying Policy Onboarding OCR, insurer-specific extraction, Google Document AI, Vercel OIDC federation, the policy review modal, or Section 03 field application, read and follow:

- `docs/POLICY_OCR_GOOGLE_DOCUMENT_AI_HANDOFF.md`
- `apps/web-portal/app/policies/policy-ocr-actions.ts`
- `apps/web-portal/lib/policy-ocr-parsers.ts`
- `apps/web-portal/components/policy-ocr-import-panel.tsx`

Mandatory safeguards:

- Google Document AI is the OCR/text-reading layer only. Insurer detection and field interpretation remain in the INSUREIT backend.
- Keep all Google token exchange, service-account impersonation and Document AI calls server-side. Never expose OIDC tokens, Google access tokens or credentials to the browser.
- Do not create a service-account JSON key unless an explicit security-approved architecture change requires it. Production uses Vercel OIDC Workload Identity Federation and short-lived credentials.
- OCR may propose only the approved Policy Onboarding Section 03 fields. Never populate customer, insured, owner, vehicle identification, registration, chassis, engine, address, phone, PAN, GST or similar identity fields from the policy document.
- Maintain review-before-apply behavior. Never silently overwrite manual or saved form data.
- Printed net premium, GST and gross premium are comparison-only values unless the product schema is explicitly changed.
- Before claiming support for a new insurer/policy type, obtain representative samples, define an approved mapping, add parser evidence/confidence behavior, and create regression tests.
- Do not force incompatible products such as United India CPM into motor OD/TP/CPA fields without an approved schema decision.
- When a parser misses a field, inspect sanitized OCR output from the actual format first. Do not make broad regex changes based on guesses.
- Do not log or commit raw OCR text, complete policy documents, policyholder PII, vehicle identifiers, credentials or tokens.
- Keep the 15 MB application file limit and supported MIME checks unless a reviewed capacity/security decision changes them.
- Preserve local PaddleOCR only as a development/comparison tool unless production fallback is explicitly reintroduced.
- Run typecheck, lint, build and parser regression tests before merge. Warnings must be reviewed; a successful build is not proof of a successful live OCR journey.
- Do not remove legacy OCR environment variables until Google OCR has been directly verified in production with the supported Digit, IFFCO-Tokio and New India samples.
- A queued workflow, deploy-hook acceptance or `Ready` build alone is not full verification. Confirm the exact deployed commit and complete the authenticated live upload/review/apply journey.

## AuthBridge Detailed RC integration protocol

When modifying Policy Onboarding, vehicle registration inputs, vehicle master data, motor-policy forms, RC lookup, or AuthBridge integration code, read and follow:

- `docs/AUTHBRIDGE_RC_HANDOFF.md`
- `apps/web-portal/lib/authbridge-rc-api.ts`
- `infrastructure/icall-gateway/server.js`

Mandatory safeguards:

- Keep AuthBridge calls server-side. Browser/client components must never call TruthScreen directly or receive the gateway relay secret.
- Use the protected gateway route `POST /uat/authbridge/rc-verification` through the server-only client.
- Never invent provider field names. Map only from a real sanitized decrypted response and the current canonical policy/vehicle schema.
- Do not perform a lookup on every keystroke. Use an explicit fetch action or another controlled trigger to protect provider credits and avoid duplicate calls.
- Show a loading state suitable for 5–8 second responses and a controlled timeout path up to 20 seconds.
- Present returned details for review before applying them. Never silently overwrite manually entered or already-saved vehicle data.
- Import only fields needed by the Policy Onboarding workflow. Avoid unnecessary owner personal data.
- Do not log or commit decrypted responses, full addresses, phone numbers, chassis numbers, engine numbers, credentials, tokens or encrypted provider payloads.
- Prefer normalized field-level storage. Do not store raw provider responses without an approved retention, access-control and masking design.
- Treat successful gateway UAT as proof of the provider path only, not proof that the Policy Onboarding user journey is implemented, deployed or live.
- The relay secret and iCall token exposed in a setup screenshot must be rotated before production use; never repeat or store the replacement values.

## Production readiness protocol

For full website audits, pre-production checks, release planning, production deployment or post-release review, read and follow:

- `docs/PRODUCTION_READINESS_AUDIT.md`
- `docs/PRODUCTION_RELEASE_CHECKLIST.md`

A production release is **NO-GO** while any severity-4 finding remains open. A checklist item is not complete without an owner and direct evidence tied to the exact release commit and target environment.

Do not replace the full release checklist with a visual UI review. Production readiness includes authorization, sensitive data, database integrity, migrations, storage, business workflows, integrations, accessibility, performance, observability, backup/restore, deployment verification and rollback.

## Performance optimization protocol

When modifying navigation, page layouts, shared components, middleware, data loading, list/register filters, document views, forms, workflow pages, policy onboarding, intermediary onboarding, or any high-traffic route, read and follow:

- `docs/PERFORMANCE_OPTIMIZATION_HANDOFF.md`
- `docs/performance-audit-2026-08-07.md` when doing a larger speed audit or regression review

Mandatory safeguards:

- Do not add global `fresh=Date.now()` navigation, timestamp URLs, or link interceptors for ordinary internal routing.
- Do not use `window.location.assign()` or `window.location.replace()` for normal internal navigation when `Link`, `router.push`, `router.replace`, `router.refresh`, `revalidatePath`, or `revalidateTag` is appropriate.
- Do not call the server/database for simple status filters, counters, sorting, or search over rows that are already loaded on the client. Use client-side state unless the dataset is intentionally paginated/search-backed.
- Do not add broad `force-dynamic`, `revalidate = 0`, `no-store`, or cache bypass behavior without a written reason tied to freshness, authorization, or correctness.
- Do not mount workflow-specific client components, DOM scanners, mutation observers, polling loops, or global listeners in the root layout unless the behavior is truly global and measured.
- Do not top-level import heavy client libraries such as PDF, spreadsheet, OCR, charting, rich-editor, map, or animation packages unless needed for the initial view. Lazy-load them at the action point or move the work server-side.
- Do not generate Supabase signed document URLs during page render for every document card. Render metadata first and generate signed URLs only through authorized open/download actions.
- Do not render or hydrate hidden workflow stages, tabs, or modal-heavy content before the user needs them.
- Do not duplicate profile, permission, master-data, document-context, or reference-data fetches in the same request/render path. Use request-scoped memoization and stable reference-data caches where appropriate.
- Keep authorization, mutation validation, provider calls, signed-document access and sensitive data checks server-side and authoritative. Performance fixes must reduce duplicate work, not weaken security.
- After material performance-sensitive changes, run build/typecheck where relevant and perform browser-level smoke checks on affected routes. Do not claim production speed success without live or repeatable evidence.

Context retention rule for performance:

- If a future agent discovers a reusable performance root cause, failed approach, cache invalidation rule, route-rendering hazard, or navigation/data-loading pattern that should prevent repetition, record it concisely in `docs/PERFORMANCE_OPTIMIZATION_HANDOFF.md`.
- If the learning is a stable cross-repository operating rule, update `AGENTS.md` as well. If it is workflow/business/schema-specific, update the relevant durable handoff instead.
- Do not record temporary timing noise, guesses, raw logs, secrets, private data, or every small chat update.

## Mobile Expo preview protocol

When modifying `apps/mobile-app`, publishing to Expo, building mobile previews, changing mobile runtime/native config, or verifying the installed mobile app, read and follow:

- `docs/MOBILE_EXPO_PREVIEW_HANDOFF.md`

Mandatory safeguards:

- Publish ordinary JS/layout mobile changes to Expo `preview` only when the installed runtime can consume them. Current preview runtime is `0.2.0`.
- Do not treat Expo publish success, update IDs, dashboard download counts, or `eas update:list` as proof that the installed app reflects the change.
- After publishing, verify the latest update group, force-stop and relaunch `com.insureit.mobile` twice over ADB, inspect logs, and visually verify the affected screen.
- Prefer clean committed source publishes. Do not publish dirty worktrees unless explicitly unavoidable; if a dirty publish occurs, record the exact dirty files and verify the installed app directly.
- When publishing from a temporary/clean worktree, load mobile public environment variables into the process without printing or recording their values. A missing mobile environment can create a startup-crashing OTA.
- If a change touches native dependencies, Expo SDK/runtime, app config, package identifiers, permissions, plugins, native assets, or anything the current preview binary cannot consume, OTA is insufficient and a new preview build requires user approval.

## Hermes collaboration protocol

When the user mentions Hermes, the free agent, `Hermes/observations.md`, or any file inside the `Hermes/` folder, use `Hermes/AGENT_BRIDGE.md` as the working contract before acting.

**HERMES IS AN EVIDENCE INPUT, NOT AN AUTHORITY.** Treat Hermes findings as independent investigation notes that must be checked against the current code before implementation. Do not blindly apply a Hermes recommendation unless the files, route, workflow and failure mode still match.

**CODEX MUST RESPOND WITH ENGINEERING OWNERSHIP.** After reading Hermes notes, Codex must either accept the finding with code evidence, reject it with code evidence, or narrow it into a testable hypothesis. Do not loop through broad guesses after Hermes has provided a specific root cause; inspect the named handlers, route, action, component state and validation path first.

Use the bridge file for agent-to-agent handoff:

- Hermes writes concise observations, evidence, suspected or verified cause, recommended fix, failed approaches to avoid and verification steps.
- Codex writes implementation status, files changed, checks run, commits, deployment status and any questions Hermes should investigate next.
- Neither agent may store secrets, credentials, cookies, full PAN, full Aadhaar, full bank account numbers or private customer data in Hermes files.
- If Hermes and Codex disagree, preserve both positions briefly in `Hermes/AGENT_BRIDGE.md` and decide using reproducible evidence from source, logs, browser traces or tests.

## Frontend design audit protocol

When a user asks to review, audit, improve, simplify, polish, or check the accessibility/usability of an existing interface, or describes symptoms such as users getting confused, abandoning a form, missing actions, or struggling with a workflow, read and follow:

- `docs/frontend-design-audit/CHATGPT_SKILL.md`
- `docs/frontend-design-audit/INSUREIT_CHECKLIST.md`
- `docs/frontend-design-audit/REPORT_TEMPLATE.md`
- `docs/frontend-design-audit/FIX_PROTOCOL.md`

Use the protocol for existing interfaces, screenshots, live pages, or source code. Do not use it as a substitute for feature planning, backend debugging, security review, performance profiling or the production readiness protocol.

### Mode mapping

- **“Audit/review this UI”** → full audit: evaluate, report, discuss, implement approved changes, verify.
- **“Evaluate only”** → report only; do not modify code.
- **“Improve from the audit”** → implement previously approved findings, then verify.
- **“Quick audit/fix”** → automatically fix safe severity 3–4 findings and straightforward severity 2 findings; report ambiguous items without guessing.

### Repository safeguards

- Preserve Supabase schemas, APIs, business rules, role permissions and workflow transitions unless the user explicitly approves a logic change.
- Never expose full Aadhaar, PAN, bank account or other sensitive identity data in the interface or client payload.
- Treat POSP, MISP and Partner as distinct account contexts and do not apply qualification stages to Partner accounts.
- Verify desktop and mobile behavior, loading/error/empty states, keyboard interaction and permission-gated actions.
- Run available lint, typecheck, build and tests before claiming success.
- Do not merge a pull request unless the user explicitly asks.

### Form submission and validation freeze prevention

**LEARNING: POSP/MISP ONBOARDING FREEZE ROOT CAUSE.**

**DO NOT PUT CUSTOM REACT VALIDATION HANDLERS ON ROUTE-POST ONBOARDING FORMS THAT USE `submitPath`.**

**VERIFIED FIX:** the production freeze on `/intermediaries/posp/new` was resolved by keeping `submitPath` forms on a plain browser POST path: no React `onClick`, no `onSubmitCapture`, no `onInvalidCapture`, no blur/input validation handlers that mutate validation state. Use native `required`, `pattern`, `minLength` and `maxLength` attributes for immediate browser validation, then let the route handler/server action remain the authority. Commit `6d2a40f5edce52a611efc120c7aff6f8843c19f2` implemented the working fix.

**FAILED APPROACH TO AVOID:** adding more client validation, pending state guards, `form.submit()`, tiny hydrated validation guards, or server-render wrapper workarounds can still leave the route-post page in a locked/unresponsive state. The safe rule for this workflow is to remove React from the submit/invalid validation path, not to add another validation layer.

For all validated forms, especially onboarding, document, account, payment, KYC and workflow-transition forms:

- Do not use `form.submit()` from click handlers.
- Use a real `type="submit"` button or `form.requestSubmit()` only when a programmatic submit is truly required.
- For route-post onboarding forms with a `submitPath`, do not attach React `onClick`, `onSubmitCapture`, or `onInvalidCapture` validation handlers. Use a real `type="submit"` button with required/pattern/minLength/maxLength attributes and let the route handler/server action remain the authority.
- Run the same validation path for button clicks, Enter-key submission and programmatic submission.
- Set `pending`, `posting`, disabled or loading state only after validation passes.
- If validation fails, prevent submission, keep entered data intact, show the field-level or banner error, and focus/scroll to the first invalid field.
- On large forms, validate and render only the first blocking invalid field per submit. Do not rewrite every required field/error node at once on an empty submit, because this has repeatedly caused perceived hangs in the intermediary onboarding workflow.
- For fragile large onboarding forms that stay on React server actions, use lightweight value-based client validation that checks `FormData` and renders only targeted errors. For route-post forms with `submitPath`, avoid custom React validation handlers entirely.
- Preserve server-side validation as the authority; client validation is only an early recovery path.
- When resolving conflicts in validated forms, preserve existing shared validators such as `validateInlineForm` and apply freeze prevention on top instead of replacing the current form workflow.

## Policy Onboarding current operating context (2026-08-07)

Use this section as the compact, current operating contract for Policy Onboarding. It supplements the dedicated AuthBridge/OCR handoffs and the durable project context; it is not a transcript. Domain references in this historical operating snapshot are superseded by `docs/PRODUCTION_DOMAIN_HANDOFF.md`; the canonical production portal is now `https://portal.insureit.in`.

### Current verified implementation and production state

- **DEPLOYED:** canonical production application URL is now `https://portal.insureit.in`; the former `https://insureit-drab.vercel.app` hostname is retained temporarily as a fallback during stabilization.
- **DEPLOYED:** production trigger commit `4350d888fe2d2799f9f94465744b25c8cbd14bed` completed successfully in Vercel on 2026-08-07. It includes the compact Section 02 redesign, the create-mode header cleanup, the compact Section 01 source/ownership redesign, the Policy Intelligence sidebar work, the AuthBridge RC review workflow, Policy OCR header-modal workflow, and the transactional policy onboarding path available on `main` at trigger time.
- Do not assume later ordinary commits are live. Automatic Vercel deployment from ordinary commits is disabled; use the explicit production-trigger protocol above.
- The create-mode Policy Onboarding header intentionally does **not** show `Database enabled`, `AuthBridge UAT · prototype_v1 calculations`, or the explanatory sentence about creating/linking customer and vehicle records. Keep create mode visually clean unless the user explicitly changes this.

### Canonical current files

Before modifying this workflow, inspect the current `main` versions of:

- `apps/web-portal/app/policies/new/page.tsx`
- `apps/web-portal/components/policy-unified-form.tsx`
- `apps/web-portal/app/policies/policy-onboarding-actions.ts`
- `apps/web-portal/app/policies/authbridge-rc-actions.ts`
- `apps/web-portal/lib/authbridge-rc-api.ts`
- `apps/web-portal/components/policy-ocr-import-panel.tsx`
- `apps/web-portal/app/policies/policy-ocr-actions.ts`
- the current Supabase migration that defines `onboard_motor_policy(p_payload jsonb)` and the policy child tables

The visible current form uses the newer `onboardPolicy(...)`/`onboard_motor_policy(...)` path. Do not mistake the legacy basic `addPolicy`/simple `policies` insert path for the active create workflow merely because old functions still exist in the repository.

### Policy Onboarding data-source contract

The page currently combines four source categories:

1. **Supabase master data**
   - Insurance Company options come from `insurance_companies`.
   - Lead Source options come from active `intermediaries` records.
   - POSP and MISP must remain distinct intermediary types.
   - `SIBL / Partner` uses Partner-master records only.
   - The RM relationship is derived from the selected intermediary/account relationship, using the same Sales-department employee source/assignment used by POSP/MISP onboarding. Do not reintroduce a separate user-selected RM unless the user explicitly changes the rule.

2. **AuthBridge Detailed RC**
   - Explicit Fetch RC action only; never lookup on keystroke.
   - Provider response is reviewed in a modal before values are applied.
   - Full chassis and engine values may be displayed and saved after review; never log or commit them.
   - Existing insurance returned by RC is reference-only for the new policy and must not silently populate the new policy.
   - Applied RC data can populate customer/vehicle master fields and is referenced in `vehicle_rc_verifications`.

3. **Policy OCR**
   - The page has a single `Read Policy Copy` action in the Policy Onboarding header, not a full-width upload panel.
   - OCR opens a modal for file selection, processing, review, confidence/warnings, field selection and apply.
   - OCR only proposes the approved policy/premium Section 03 fields. It does not create/save records directly and must not populate customer/vehicle identity fields.

4. **Manual user entry plus derived calculations**
   - Browser calculations are previews only.
   - The database transaction is authoritative and recalculates financial values before saving.

### Section 01 — Policy source & ownership: current approved layout and behavior

The current compact Section 01 pattern is deliberate and should be reused conceptually when refining later sections.

Primary row has exactly four main controls:

1. Policy Issuance Date
2. Policy Type
3. Intermediary Type
4. Lead Source

Derived metadata appears directly below its parent control in a small secondary line with **no input box, no card, and no second-row visual container**:

- Under Policy Issuance Date: Month, auto-derived (for example `Aug 26`).
- Under Intermediary Type: assigned RM, derived from the selected Lead Source/account relationship.
- Under Lead Source: Intermediary Code, derived from the selected Lead Source.

The metadata line is important information, so it must remain readable: muted label, distinct small source indicator (`AUTO`, `ASSIGNED`, `MASTER` where relevant), and a stronger navy value. It should remain substantially shorter than a normal input row.

Lead Source behavior:

- Intermediary Type is chosen first.
- `POSP` → search active POSP records only.
- `MISP` → search active MISP records only.
- `SIBL / Partner` → search active Partner records only.
- Lead Source is editable/searchable autocomplete. Partial typing must show matching names; users must not need to type the full name.
- On exact/select match, derive and persist the assigned RM and code.
- POSP/MISP code = the respective POSP/MISP business code.
- SIBL/Partner code = the Partner ID/business-facing partner code, **not** the Supabase UUID.
- Intermediary Code is fully read-only.
- Changing Intermediary Type clears incompatible Lead Source, Intermediary Code and derived RM.
- The policy payload still carries `rmName`, `intermediaryType`, `leadSource`, and `intermediaryCode` even though RM/code are rendered as metadata rather than ordinary editable inputs.

### Section 02 — Insured & vehicle identification: current approved layout and behavior

The compact current layout uses three logical rows and preserves AuthBridge/manual edit behavior.

**Row 1 — Identity**

- Registration Number with compact attached `Fetch RC` action.
- Insured Name.
- Phone Number.
- Class of Vehicle.
- Small metadata under Registration shows RC state such as `Not checked`, `Checking registration`, `Verified & applied`, or linked-master state in edit mode.
- Small metadata under Class of Vehicle shows the derived vehicle classification. Do not render Vehicle Classification as a disabled input box.
- The old helper sentence `Provider response opens in a review popup. One lookup is made per click.` is intentionally removed from the normal layout.

**Row 2 — Basic vehicle details**

- Make.
- Model.
- Fuel Type.
- Year of Manufacturing.

These remain normal editable/confirmable fields in create mode even when AuthBridge pre-fills them. Auto-filled does not automatically mean read-only.

**Row 3 — Technical/registration**

- Capacity, with small derived Basis metadata (`CC`, seating/GVW/category-style basis depending on class).
- Chassis Number.
- Engine Number.
- RTO as one logical grouped control containing State and Name/Code side-by-side.

Edit mode continues to protect linked customer/vehicle master identity data from policy-level edits.

### UI refinement rule for remaining Policy Onboarding sections

The user is intentionally refining this page section-by-section to reduce vertical space and make it professional. Preserve this hierarchy unless explicitly changed:

- **User-editable or user-correctable values** → normal inputs/selects.
- **System/master/API-derived but important metadata** → compact text directly beneath or adjacent to the parent field; no disabled-input appearance.
- **Calculated financial outcomes** → grouped summary/band/row presentation, not disabled text boxes.
- Group related values together instead of creating extra cards/rows.
- Avoid duplicate display of ordinary form fields in the right sidebar.
- Compactness must not make important metadata unreadably small.

Current Section 03/04/05 presentation already began this direction:

- Net Premium, GST and Gross Premium are grouped in a premium calculation band rather than disabled-looking inputs.
- Projected OD/TP pay-in calculated amounts are outcomes beside their editable percentages.
- Total projected pay-in, TDS and Pay-in after TDS are grouped as calculated results.
- Gross Partner Payout is a calculated outcome rather than an editable-looking field.

Future refinement should continue from current `main`; do not reconstruct an older all-input-box layout.

### Policy Intelligence / right-sidebar contract

The right sidebar is meant to be a compact **Policy Intelligence / Booking control centre**, not a duplicate form summary.

Durable requirements from the current redesign:

- Do not repeat ordinary form fields merely to fill space.
- Prefer derived/operational information, completion signals, concise attention items and dense financial information.
- Use compact signals/icons/rows rather than one card per item.
- Financial figures should be row-based, not separate boxes for every number.
- Indicative margin belongs in the same financial ledger and should use status color (healthy/low/negative) rather than a separate descriptive Margin Health card.
- The separate `Verification & Resolution`, `Margin Health`, and `Booking Readiness` cards were intentionally removed during compaction; do not reintroduce them without user approval.
- Workflow progress is compact/horizontal.
- Attention items are condensed rather than card-per-error.
- The sidebar should not have its own avoidable vertical scrollbar in the standard desktop view.
- Sidebar positioning must respect both top and bottom boundaries: never overlap the app/Policy Onboarding header and never extend beneath the fixed bottom action buttons.
- Because positioning has been sensitive to viewport/header heights, inspect current positioning code and actual browser behavior before changing offsets. Do not return to a naive hard-coded section-relative `top` that causes drift or overlap.

### Policy create/save transaction and table mapping

Current create flow:

1. Build a structured payload containing `customer`, `vehicle`, `policy`, `premium`, `payin`, `billing`, `payout`, `authbridge`, and optional resolution decisions.
2. Server validates required policy/customer/vehicle identity fields.
3. Customer matching checks existing records; possible matches require explicit user choice. Never auto-link/merge by name alone.
4. Vehicle matching uses normalized registration (and the current conflict logic). If the vehicle belongs to a different customer, show an ownership conflict.
5. Ownership transfer is restricted to Manager/Admin-equivalent privileged roles and must be audited.
6. Final save uses the transactional Postgres RPC `onboard_motor_policy(p_payload jsonb)` so the booking either completes together or rolls back together.
7. Successful new policy is booked Active immediately under the current requirement.

Current target tables/records created or updated by the transaction include:

- `customers`
- `vehicles`
- `vehicle_ownership_history` when an authorized transfer occurs
- `policies`
- `policy_party_snapshots`
- `policy_premium_details`
- `policy_payin_details`
- `policy_payin_bills`
- `policy_intermediary_payouts`
- `vehicle_rc_verifications` when AuthBridge data was applied

Important persistence choices:

- Policy history uses an immutable customer/vehicle snapshot so later master changes do not rewrite historical policy facts.
- Policy number uniqueness is scoped by insurer + normalized policy number in the designed canonical model.
- Current policy financial rows retain `calculation_version = 'prototype_v1'` until the client approves replacement rules.
- RM is currently persisted as `rm_name` text in the policy payload/schema rather than as a guaranteed employee UUID relation; do not silently change this persistence contract without a reviewed schema migration.
- Lead Source/intermediary identity is currently persisted using display/business values including intermediary code; the intermediary UUID fetched for UI use is not automatically equivalent to the persisted business code.

### `prototype_v1` calculation contract

Until replaced by an explicitly approved client rule set, preserve the current server-authoritative prototype calculations:

- `Net = OD + TP + CPA`.
- Normal GST = `Net * 18%`.
- GCV GST = `(OD + CPA) * 18% + TP * 5%`.
- Gross = Net + GST.
- Projected OD pay-in = OD * OD pay-in %.
- Projected TP pay-in = TP * TP pay-in %.
- Total projected pay-in = projected OD + projected TP + insurer scheme.
- TDS = total projected pay-in * 10%.
- Pay-in after TDS = total projected pay-in - TDS.
- OD payout = OD * partner OD %.
- TP payout = TP * partner TP %, except TP payout is zero when payout basis is `OD`.
- Gross partner payout = OD payout + TP payout - retention (current UI clamps negative displayed gross payout to zero; inspect current DB behavior before changing financial semantics).

Do not treat browser-computed values as authoritative. Server/database calculation remains the source of truth.

### Durable numeric-save learning

**LEARNING:** A previous policy-save failure persisted after an initial sanitizer because optional blank financial values were being normalized to `""`, while the RPC contains casts of the form `coalesce((value)::numeric, 0)`. PostgreSQL attempts `''::numeric` before `coalesce`, so the transaction still failed.

Correct rule:

- Optional financial values that are cast directly to numeric by the RPC must be normalized server-side to numeric-safe strings such as `"0"`, not empty strings.
- Provider-formatted vehicle values such as `1497 CC`, `4 Seats`, `2,850 KG`, `NA`, or `Not Available` must be normalized before numeric/integer database casts.
- Vehicle fields whose SQL path explicitly uses `NULLIF(value, '')` may safely use blank/null-compatible handling; do not assume the same is true for financial fields.
- When this error recurs, inspect the exact RPC cast expressions and payload after server normalization rather than adding another browser-only sanitizer.

### Customer/vehicle resolution rules

Preserve the user-approved safety behavior:

- Customer phone is mandatory for policy onboarding.
- Possible customer matches are shown to the user and require explicit selection; never auto-link by name alone.
- Existing vehicle linked to a different customer triggers a conflict workflow.
- Normal users must not silently transfer ownership.
- Manager/Admin-equivalent privileged roles may confirm ownership transfer; record the change in `vehicle_ownership_history`.
- AuthBridge owner address is reviewable and applies only after user confirmation.
- Existing insurance in RC remains reference-only for the new policy.

### AuthBridge review-modal requirements specific to Policy Onboarding

- Use a professional modal/portal above the entire app; do not expand the RC response inline inside the form.
- Desktop: large centered modal. Mobile: full-height sheet/fullscreen behavior as appropriate.
- Fixed header/footer and scrollable modal body.
- Background scroll locked while open; Escape closes when safe; preserve keyboard/focus accessibility.
- Hide empty/NA details where possible.
- Show full chassis/engine values in the review when returned and approved for use, but never log/commit them.
- Existing Insurance section must be clearly reference-only.
- `Use These Details` is the main action with per-group checkboxes selected by default; preserve manual values/conflict awareness rather than silently overwriting.
- Applied verification carries transaction IDs/timestamps to the server for verification metadata storage.

### Policy OCR current UI requirements

- Keep a single compact header action `Read Policy Copy` beside the main booking action.
- The old standalone full-width OCR upload section must remain removed.
- Modal flow contains file selection, OCR progress, warnings/errors, extracted field review, confidence, individual selection, Cancel, and Apply Selected Details.
- OCR values are proposals; saving happens only when the user ultimately books/updates the policy.

### Validation and verification discipline for this workflow

- Policy Onboarding is a React-controlled client form with server actions/RPC, not the fragile POSP/MISP `submitPath` route-post form. Do not incorrectly apply the route-post “no React handlers” rule to this component; instead preserve controlled state and server-authoritative validation.
- When programmatically changing controlled inputs, update React state directly wherever possible. A previous Lead Source bug occurred because a native listener changed the dependent Intermediary Code before React accepted the controlled Lead Source value, causing a re-render that restored the old empty source. Do not reintroduce DOM-level synthetic synchronization when the component can own the state.
- After material UI logic changes, run `npm ci`, `npm run typecheck:web`, `git diff --check`, and focused assertions/tests where available before claiming implementation success.
- Typecheck success is not production-deployment evidence.
- After explicit deployment, verify the exact production trigger commit reaches final Vercel success before claiming the page is live.

### Current refinement direction / next-session expectation

The user is actively redesigning Policy Onboarding one section at a time. Sections 01 and 02 have been compacted and production-deployed as described above. Future agents should:

- Start from the current deployed/current-main implementation, not screenshots of older layouts.
- Ask before changing business logic when the request is about layout only.
- Keep reducing vertical space without sacrificing readability.
- Keep derived/calculated values visually distinct from editable controls.
- Reuse the compact metadata pattern from Section 01/02 where it genuinely clarifies a parent field.
- Avoid gratuitous cards, repeated descriptions, duplicated sidebar information, and disabled-input styling for non-editable calculated values.
- Preserve existing AuthBridge/OCR/database behavior while refining layout unless the user explicitly requests a workflow or schema change.

### Additional approved Policy Onboarding decisions from AuthBridge integration work

- **VERIFIED CURRENT ROUTE:** `/policies/new` now renders `PolicyUnifiedForm` from `apps/web-portal/components/policy-unified-form.tsx`. Older iterations used `policy-form-authbridge.tsx`; future agents must always trace the current route import before editing because similarly named legacy components remain in the repository.
- **LEARNING:** a previous production deployment showed no visible Add Policy changes because edits were made to `policy-form.tsx` while the route rendered another component. Never assume a component is live from its name alone; verify route → import → rendered component before editing and before debugging a deployment.
- Section 01 uses the user-facing label **Policy Type**, not Business Line.
- Intermediary Type is limited to `POSP`, `MISP`, and `SIBL / Partner`; `Direct` was intentionally removed and must not be restored without explicit approval.
- The main Policy Onboarding page intentionally excludes billing/reconciliation controls. Do not restore Pay-in Bill Number, Pay-in Billed Amount, Pay-in Bill Date, Pay-in Status, or Short Payout there; billing is reserved for a separate workflow/page to be designed later.
- `Retention` belongs with **Projected insurer pay-in**, not the Partner/Intermediary payout section.
- `OD / NET basis` was intentionally removed from the visible Projected insurer pay-in section. Internal legacy state may still exist for compatibility/calculation logic; do not re-expose the field without approval.
- The right-side **Live Summary / Policy Intelligence** area must stay visible while the user scrolls on desktop. Preserve sticky/fixed-with-boundary behavior without allowing it to overlap the page header or fixed bottom actions. Other sidebar/supporting cards should not be made sticky merely because the financial summary is sticky.
- AuthBridge RC review may show and apply full chassis and engine numbers in this authenticated internal portal. Do not mask them in the approved Policy Onboarding review/application flow solely because they are chassis/engine identifiers. This does not relax the rule against logging or committing real provider/customer values.
- The verified Detailed RC provider structure groups data under `data.msg` sections `Registration Details`, `Vehicle Details`, `Owners Details`, `Insurance Details`, `Hypothecation Details`, and `RC Status`. Prefer these exact section/key mappings over guessed aliases.
- Important RC fields used by the policy workflow include manufacturer, model, fuel, manufacture date/year, engine capacity/CC, seating capacity, GVW/gross weight, unladen weight, vehicle category/class, chassis, engine, RTO/state, registration/fitness/tax status, insurance reference data, hypothecation, PUC and permit details when returned.
- Capacity mapping remains class-dependent: PCP/TWP → Engine Capacity/CC; PCV → Seating Capacity; GCV → GVW/Gross Weight; MISD → Category then CC/GVW fallback; CPM → equipment/GVW fallback unless a more specific approved mapping is introduced.
- AuthBridge lookup must remain explicit and review-before-apply. Existing manual values are preserved unless the user resolves a conflict/replacement; existing RC insurance remains reference-only for the new policy.

## Current INSUREIT implementation context — 2026-08-07

This section is a curated snapshot of current implementation decisions that materially affect future repository work. Treat items marked **IMPLEMENTED** as committed code, not proof of production deployment. Before changing these areas, inspect current `main` and the linked durable handoff files because `main` may have advanced. Production-domain references in this snapshot are superseded by `docs/PRODUCTION_DOMAIN_HANDOFF.md`.

### Repository, runtime and deployment

- Repository: `Frontier-Group-IT/insureit_new`.
- Web portal: Next.js 15 + Supabase monorepo; Vercel project root is `apps/web-portal`.
- Canonical production application URL: `https://portal.insureit.in`.
- Temporary fallback during stabilization: `https://insureit-drab.vercel.app`.
- **DEPLOYMENT RULE:** automatic Vercel deployment from ordinary Git commits is intentionally disabled. Do not say a merge is live merely because it reached `main`.
- Production deployment is intentionally triggered only when the user explicitly requests deployment. Dispatch `.github/workflows/deploy-production.yml` with the already-successful feature-PR verification run ID and verified head commit; do not create a second deployment PR or rerun the full gate.
- A successful deploy-hook request means Vercel accepted the request; it is not proof that the final Vercel deployment completed. Verify the exact deployment before claiming **DEPLOYED**.
- A committed Supabase migration is not proof that it was applied. Never claim **APPLIED** without target-environment evidence.

### Effective permission model and enforcement

- **IMPLEMENTED:** central employee/role permission overrides use additive tables introduced by migration `supabase/migrations/20260804194500_add_permission_management_foundation.sql`:
  - `role_permission_overrides`
  - `employee_permission_overrides`
  - `permission_change_logs`
- Permission resolution order is employee override → role override/default capability → no access. Access levels are ordered `none < view < edit < approve/critical`. Data scope supports `self`, `hierarchy`, and `organization` where applicable.
- The permission-management UI lives under `/system/access-control` and is intended for IT Super User / Super Admin administration. It requires reasons for changes, supports expiration, audit logging, and protects against self-lockout of critical system/user-management access.
- **IMPLEMENTED:** workflow enforcement was audited so business routes should use their own effective capability rather than unrelated `manage_master_data` or literal-role shortcuts. Examples:
  - Claims: view claims vs edit/process claims.
  - Customers: view customers vs edit customers; KYC review uses the KYC review capability.
  - POSP/MISP/Partner: view register, create onboarding, review onboarding, approval/activation and portal-user actions use their own capabilities.
  - Employees: view employees vs edit employees; portal-user administration uses critical user-management access.
  - Vehicles: view vehicles; add/edit requires editable vehicle access.
  - Policies: view policies; add/edit/OCR requires editable policy access.
  - Settings/system tools require critical system access.
- **CRITICAL INVARIANT:** do not reintroduce unrelated role/master-data guards for workflow authorization. Page visibility, navigation/action visibility and server-side mutation guards should all use the same effective capability and minimum level.
- **IMPLEMENTED:** `it_super_user` is a protected developer role. It must resolve every capability at **approve/critical** level with **organization-wide** scope. Employee or role overrides must not downgrade this role. This was fixed centrally after edit-level workflows incorrectly denied IT Super User even though the role contained every capability.

### POSP / MISP / Partner application-review UI

- The current Application Review page is the visual reference for the POSP/MISP workflow: dark navy header, white header text/actions, compact spacing and clean white content surfaces.
- **IMPLEMENTED:** the full POSP/MISP workflow route (`/intermediaries/applications/[id]/workflow`) uses a consistent navy header language on Edit Details, Documents, Final Review / Qualification, Registration, Training & Examination, Agreement and IIB stages.
- Stage navigation is intentionally background-free/minimal. Do not restore large filled stage cards or heavy dashboard styling.
- The POSP/MISP Application Review page intentionally does **not** show an `Edit details` button. The account-management action remains the intended entry point where applicable. Partner Review may still expose its distinct editing workflow.
- Partner Edit Details places `Save & Exit` and `Save & return to documents` at the bottom of the page container, after Existing Intermediary Migration, matching onboarding-page layout.
- Existing POSP/MISP onboarding and Existing Intermediary Migration edit forms intentionally do **not** show a verification/migration remarks input. Historical stored remarks were not deleted solely by that UI change.
- Success feedback after an edit redirects back to Partner/POSP/MISP review as a transient toast/banner and should auto-hide after about **4 seconds** rather than remain permanently rendered.

### Partner/POSP/MISP form submission behavior

- **LEARNING / IMPLEMENTED:** portalled bottom submit buttons must not disable themselves during the initial click before the browser dispatches the native form submit. That caused `Save & Exit` / `Save & return to documents` to show a loading label indefinitely without navigation.
- Loading state should begin only after a real validated submit event is detected. Preserve the selected submit intent (`exit` vs `documents`) without blocking the native submit.
- Current action labels during pending navigation are `Saving & exiting…` and `Saving & opening documents…` (or equivalent current copy). If client validation blocks submission, clear pending state. A recovery timeout may be used to prevent permanent UI lock if navigation is interrupted.
- Also preserve the broader onboarding freeze rule above: route-post `submitPath` onboarding forms should remain on native browser validation/POST and should not gain React validation handlers that mutate state on click/submit/invalid.

### IIB PAN status and linked-account consistency

- **IMPLEMENTED:** IIB PAN status is presented as a compact persistent status card in Partner/POSP/MISP review headers. The refresh/recheck action belongs **inside the status card**, not as a separate square button beside it.
- The refresh/check icon should remain visible across review stages. While checking it may spin/disable; with invalid or missing PAN it can remain visible but disabled.
- Partner, POSP and MISP child records can represent the same PAN with different application IDs. Status lookup therefore must not rely only on current application ID.
- **AUTHORITATIVE LOOKUP RULE:** resolve IIB status by current application and normalized PAN. When multiple jobs exist for the same PAN, a completed outcome is authoritative over an older/stuck `queued`, `pending` or `checking` duplicate. Show an active checking state only when no completed result exists for that PAN (subject to any newer, explicitly supported recheck semantics in current code).
- Do not regress to a state where Partner Review shows `IIB cleared` while the linked POSP/MISP child shows `Not checked` or remains stuck on `Checking…` for the same PAN after a completed provider result exists.

### Policy permission lesson

- **LEARNING:** Add Policy previously called an unrelated master-data guard, so employee policy overrides were saved but the user was denied at `/access-denied` when opening Add Policy.
- Policy pages/actions must use the effective Policies capability. View-only is read-only; edit or critical allows policy creation/editing. Do not gate policy creation on `manage_master_data`.

### Current Partner / POSP / MISP register design

The three intermediary registers are being treated as a shared operational UI family. Preserve a compact, professional insurance-operations style rather than a large AI/dashboard aesthetic.

General design rules:

- One account record per compact desktop table row.
- No city/location text appended beneath the name.
- No `Updated` date column in POSP/MISP register tables.
- Avoid oversized KPI cards, descriptive subtitles such as “Operational directory…”, decorative refresh timestamps, excessive gradients, and other nonessential dashboard copy.
- Keep the main register surface white/light, with restrained navy/blue accents, thin borders, minimal shadow and compact badges.
- Mobile can adapt responsively, but desktop/laptop should stay table-first and information-dense.

Current POSP/MISP table direction:

- Columns include `{POSP|MISP} Name`, `Mobile Number`, `{POSP|MISP} ID`, `Parent Partner`, `Assigned RM`, `Account Status`, `Action` (inspect current `main` before changing exact order).
- Mobile number is displayed as a plain 10-digit number; missing values display a neutral placeholder.
- The former `Current Stage` column was intentionally removed.
- POSP/MISP register pages intentionally do **not** show `Onboard POSP` / `Onboard MISP` buttons in the register header.
- The register header is a single compact row containing register title, a moderate-width search field, and account counters. Search should be somewhat taller than the earlier ultra-compact version but not stretch across the full available width.
- `All`, `Active`, and `Onboarding` counters are full clickable filter controls—the whole label/count is clickable, not only the number. The active filter has a visible selected state, and switching counters should preserve the current search query.
- The Action column/header should be right-aligned but padded inward from the outer table border rather than touching the right edge.

Current Partner register direction:

- Uses the same overall header/search/counter/table visual system as POSP/MISP.
- Columns currently include `Partner Name`, `Mobile Number`, `Partner ID`, `Type`, `Assigned RM`, `Linked account`, `Portal access`, `Status`, `Action` (confirm current `main` before edits).
- `All`, `Active`, and `Onboarding` are clickable filters and preserve search text.
- Partner status categories are based on Partner workflow state (`active_partner` vs onboarding), not blindly on a generic intermediary `account_status` database filter.
- Badge categories intentionally use distinct light tones for scanability: linked-account state, portal-access state and overall account status should not all use the same grey pill. Keep colors light/restrained and accessible.
- Action controls are padded inward from the right border.

### Recent implementation references

The following merged PRs/commits are useful landmarks when tracing why the current behavior exists. They are implementation references, not deployment evidence:

- PR #173 / merge `69bc23e05156121674e99facad20a701df28a673` — permission-management foundation.
- PR #175 / merge `5ad3758d326460bf965f027280f6b3405f86a56c` — permission override persistence/redirect verification.
- PR #176 / merge `9150fcff60299e3f6293fc5d74a1dffd0249d365` — policy permission enforcement for Add Policy.
- PR #177 / merge `fcce8796649d4529bf82f1d9fe7ef38204649e07` — broad effective-permission workflow audit.
- PR #178 / merge `0935ae59c3b0c552fe75c10721ff00fb73e3eab0` — POSP/MISP workflow navy theme.
- PR #180 / merge `903bb5715b6c55c25b5918e488739307c24f118b` — guaranteed full IT Super User access.
- PR #181 / merge `14889721463d0d74b4ec02ff18cec5347eda723f` — removed POSP/MISP review `Edit details` button.
- PR #183 / merge `a5b84893f420c9cfccdbf9d6e452947dba5b22e6` — IIB refresh kept inside shared status card.
- PR #184 / merge `9d38eb88985b13341321bfce4a9ea5daf220e6af` — Partner bottom edit actions.
- PR #186 / merge `1f60a5a9a4db43789f960d3d9b769d3cedf5bf0c` — linked-PAN IIB fallback and icon visibility.
- PR #187 / merge `a12b54917e7a18ac99a78d7cb072c6c7aa11f0e1` — completed IIB outcome wins over stale checking job.
- PR #188 / merge `71c6ba9e719527d830f0f0e77fcb27745e2c2e8b` — removed legacy remarks, pending labels and 4-second success toast.
- PR #189 / merge `1c3fe015d49fd16a639a8994aa81cbe3c761ddf1` — fixed portalled Partner edit submit hang.
- PR #190 / merge `116927b463ea0e0050e454f21b38ca4de6a41f5a` — compact Partner/POSP/MISP register redesign.
- PR #191 / merge `1845f6434c0786be093bd02eb198bb2d6f3b1736` — POSP/MISP count/header cleanup and stage-column removal.
- PR #194 / merge `16c44de86b1d36f2a1eb9fdcf9fbd3446575c3d7` — unified register headers and 10-digit mobile columns.
- PR #196 / merge `f866e3ab6bff1ae79d01add4b91c00ebe760e334` — clickable register filters, refined spacing and Partner badge colors.

### Safe continuation rule

When a new request touches any area above, first fetch the current `main` implementation and reconcile it with this snapshot. Prefer the current code when it intentionally supersedes an older detail. Keep future context updates concise: replace stale rules rather than appending contradictory history, and never convert a proposed or unverified behavior into current fact.
