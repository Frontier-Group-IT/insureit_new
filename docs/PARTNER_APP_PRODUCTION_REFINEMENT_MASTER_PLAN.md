# INSUREIT Partner — Production Refinement Master Plan

> **Status:** USER-APPROVED MASTER PLAN / SCOPE FROZEN  
> **Created:** 2026-08-30 (IST)  
> **Applies to:** `apps/partner-app` and its Partner-specific release workflows  
> **Primary objective:** refine the existing INSUREIT Partner app into a stable, polished, production-ready mobile application without repeatedly changing direction or consuming unnecessary Expo native-build quota.
>
> This document is the controlling refinement plan for INSUREIT Partner. New refinement work outside this plan must be treated as a change request and evaluated against scope, release risk, security, performance and build impact before implementation.

---

## 1. Product intent

INSUREIT Partner is a dedicated mobile application for authorized insurance distribution and servicing users such as:

- Partner
- POSP
- MISP
- RM
- Sales Head / authorized hierarchy roles

It is not a mobile copy of the Operations portal.

The app should optimize for:

1. immediate understanding of today's work;
2. quick access to business, customers, policies, renewals and claims;
3. simple Policy Intake submission and tracking;
4. role-appropriate commercial/payout visibility;
5. low-friction field usage on normal Android phones and weak networks;
6. high trust in data freshness, status and actions;
7. a visibly distinct Partner identity from the Customer app;
8. controlled OTA delivery for normal JS/TS/UI changes;
9. minimal native rebuilds.

---

## 2. Current verified baseline

### Application identity

Current Partner app configuration on `main`:

- App name: `INSUREIT Partner`
- Android package: `com.insureit.partner`
- Expo owner: `insureitapp`
- Expo project slug: `insureit`
- EAS project ID: `8ade82c1-4c96-4f09-b90b-802270fb406d`
- Preview channel: `preview`
- Production channel: `production`
- Runtime policy: `appVersion`
- Current application version: `0.1.0`

### Current primary navigation

Bottom tabs:

- Home
- Business
- Policies
- Claims
- More

Current secondary routes include:

- Renewals
- Customers
- Policy Intake
- Activity
- Profile
- Support
- Pulse
- Impact
- Journey
- Learn
- Stories
- Weekly Story
- Recognition

### Current technical baseline

The app currently uses:

- Expo 54
- React Native 0.81
- Expo Router
- Supabase
- SecureStore-backed native auth persistence
- Expo Document Picker
- Expo Updates
- Partner-specific RPC-backed data access
- Partner-specific EAS project / token separation from the Customer app

### Current code-audit findings that this plan must address

The current implementation is functionally broad but still requires production hardening:

- many large screens render with one `ScrollView` plus mapped rows rather than virtualized lists;
- no standardized pull-to-refresh behavior;
- no shared offline/network-state layer;
- no shared app query/cache layer;
- request/error/loading behavior is implemented independently per screen;
- no app-level error boundary;
- no production push-notification center;
- current bell interaction is closer to Activity than a true notification inbox;
- no explicit OTA update user experience;
- current update startup configuration can wait up to 10 seconds before falling back to cache;
- session lifecycle does not yet have a dedicated React Native AppState refresh policy;
- explicit accessibility labels are not broadly implemented;
- several touch controls are visually smaller than recommended mobile touch targets;
- much supporting text is too small for reliable production use;
- More currently exposes many destinations in a single flat list;
- list pagination is limited or absent in several high-volume flows;
- search/filter/scroll state is not consistently preserved when returning from details;
- Policy Intake upload has no shared progress/cancel/retry/resume abstraction;
- no persisted Policy Intake draft;
- no formal app crash/exception telemetry layer;
- no server-driven feature-flag / maintenance / minimum-version control;
- Support and some other screens do not fully model Loading / Success / Empty / Offline / Error / Unauthorized as distinct states;
- automated verification is stronger for source correctness than for real Android end-to-end workflows.

These findings are the starting point for refinement. They are not authorization to make unrelated backend, accounting, RLS, migration or web-portal changes.

---

## 3. Immutable refinement principles

All Partner refinement work must follow these principles.

### 3.1 Action first

The first screen and first viewport must prioritize:

- work requiring attention;
- renewals;
- claims;
- Policy Intake;
- business/commercial signals;
- clear next actions.

Engagement modules such as Stories, Impact, Journey, Recognition and Learn remain valuable, but must not outrank operational work.

### 3.2 Mobile-native, not compressed desktop UI

Avoid:

- desktop-style dense tables;
- tiny metadata text;
- raw database terminology;
- portal-style administrative layouts;
- excessive nested navigation.

Prefer:

- cards;
- progressive disclosure;
- bottom sheets/dialogs;
- searchable lists;
- compact but readable information hierarchy;
- one obvious primary action.

### 3.3 One shared design system

Do not independently invent button, card, form, modal, empty-state or loading styles per screen.

### 3.4 Role and scope are server-authorized

UI hiding is not authorization.

Every data/write path must continue to enforce the user's resolved Partner scope and server-side permissions.

### 3.5 Data freshness must be visible

Users should be able to distinguish:

- fresh data;
- cached/stale data;
- offline data;
- failed refresh.

### 3.6 Weak-network behavior is a first-class requirement

The app should remain understandable and recoverable when mobile connectivity is poor.

### 3.7 OTA first, native rebuild only when genuinely necessary

Normal JavaScript/TypeScript/UI/business-logic changes should use OTA.

A new Partner APK/AAB must never be triggered without explicit user authorization for that build, as already required by `AGENTS.md`.

### 3.8 No silent scope growth

New ideas discovered during implementation are not automatically added to the active phase.

They must follow the change-request process in Section 11.

---

## 4. Final information architecture target

The initial target bottom navigation remains:

- Home
- Business
- Policies
- Claims
- More

The More experience should no longer be a flat list.

### Work

- Policy Intake
- Renewals
- Customers

### Insights

- Your Week
- My Impact
- My Journey
- Activity

### Grow & Learn

- 60-Second Learn
- Recognition
- INSUREIT Stories

### Account

- Profile
- Support
- Settings / app information where introduced by an approved phase

Bottom-tab composition may be reconsidered only after UAT or usage evidence shows a high-frequency destination should move into or out of the tab bar.

---

## 5. Phase execution model

No phase is considered complete merely because code exists.

Every phase uses:

1. scoped implementation branch;
2. Partner CI / relevant source checks;
3. visual/device verification where applicable;
4. explicit acceptance criteria;
5. merge only after the phase is green and safe;
6. OTA publication only when explicitly intended;
7. no new native APK build unless the user specifically authorizes that build.

Later phases should not be mixed into an earlier phase unless the dependency is unavoidable and documented.

---

# PHASE 0 — Shared mobile foundation

## Objective

Build the reusable system that every later screen will use.

## Scope

### Design tokens

Create/standardize:

- color roles;
- typography scale;
- spacing;
- radii;
- elevation/shadow;
- semantic success/warning/danger/info tones;
- disabled/loading states.

### Typography

Replace overly small supporting text with a production mobile scale.

Target categories:

- display;
- page title;
- section title;
- card title;
- body;
- secondary body;
- label;
- caption/metadata.

Do not use tiny text simply to fit more content.

### Core UI primitives

Create reusable Partner components for:

- page/header shell;
- back/close action;
- primary/secondary/destructive buttons;
- icon buttons;
- cards;
- metric cards;
- status badges;
- search field;
- filter chips;
- text inputs;
- selectors;
- form labels/errors;
- skeletons;
- empty states;
- error states;
- offline/stale banners;
- confirmation dialogs;
- modal/bottom-sheet patterns where appropriate.

### Touch targets

Ensure interactive controls have production-appropriate tappable areas even when the visible icon is smaller.

### Shared page states

Every data screen must ultimately support:

- Loading
- Success
- Empty
- Offline/Stale
- Error
- Unauthorized

## Acceptance gate

- reusable components exist and are documented by usage;
- no business logic is changed;
- core visual primitives are consistent;
- existing Partner routes still resolve;
- no native dependency/build is introduced;
- CI/typecheck/lint/web review remain green;
- representative screen(s) verify that the foundation works without broad visual regression.

---

# PHASE 1 — Navigation, Home and global interaction states

## Objective

Make the app immediately understandable and action-first.

## Scope

### Navigation

- refine bottom-tab spacing and touch behavior;
- preserve predictable Android back behavior;
- reorganize More into the four groups defined above;
- standardize full-screen back/close treatment;
- retain user context when navigating back from detail screens.

### Home

Reorder hierarchy:

1. greeting / identity;
2. needs-attention queue;
3. renewals / claims / intake actions;
4. quick actions;
5. current business;
6. commercial/payout snapshot when authorized;
7. engagement/impact content.

### Notification semantics

- stop treating a bell icon as generic Activity if it is not a true notification center;
- until Phase 6 push notifications exist, label/navigate actions accurately.

### Global feedback

Introduce standard:

- retry;
- success;
- inline error;
- loading/skeleton;
- stale-data label;
- refresh behavior.

## Acceptance gate

- Home first viewport is operationally prioritized;
- More is grouped rather than flat;
- primary navigation is predictable;
- no duplicate navigation stacks are introduced;
- role-based content remains correctly scoped;
- visual/device review completed on installed Partner preview app through OTA where appropriate.

---

# PHASE 2 — Customers, Policies, Renewals and Claims

## Objective

Make the core insurance servicing workflows production-grade.

## Customers

- scalable list;
- search-as-you-type with debounce/cancellation;
- retain search/filter/scroll state after returning from details;
- clearer customer cards;
- call/WhatsApp/email actions;
- renewal/claim/policy indicators;
- correctly support shared/intermediary mobile numbers across different customers;
- no assumption that mobile is unique identity.

## Policies

- clearly distinguish Motor / Non-Motor / Life / Health where data exists;
- consistent policy cards;
- customer;
- vehicle/risk;
- insurer;
- premium;
- validity;
- renewal state;
- claim relationship;
- source;
- documents where authorized;
- payout/commercial state where authorized.

## Renewals

Move beyond an expiry-only list toward an actionable work queue.

Target states may include:

- Due
- Contacted
- Quote requested
- Follow-up
- Renewal submitted
- Renewed
- Lost

Only add backend-persisted renewal workflow states when explicitly scoped and approved; UI must not invent persistent CRM state that does not exist.

High-value actions:

- Call
- WhatsApp
- Open policy
- Request quote / start approved renewal workflow where supported

## Claims

Detail hierarchy:

1. current stage;
2. what is happening;
3. what the user needs to do;
4. what happens next;
5. status history.

## Acceptance gate

- large books do not require rendering all records at once;
- filters/search are retained on return;
- field actions are reachable and understandable;
- no Partner can access another Partner's out-of-scope records;
- Motor and Non-Motor policy displays remain semantically correct.

---

# PHASE 3 — Policy Intake, Business, payout and Support

## Policy Intake

Production flow:

```text
Source
Customer mobile
Policy document
-> Uploading
-> Uploaded
-> Submitted
-> OCR / Operations processing
-> Review state
-> Booked or Attention Required
```

Refine:

- draft preservation;
- upload progress;
- retry;
- replace;
- prevention of accidental duplicate submission;
- clear result/reference number;
- persistent status tracking;
- network interruption recovery.

Do not allow Policy Intake to directly book or alter a policy outside the established Operations workflow.

## Business

Refine toward:

- this-month premium;
- policy count;
- customer count;
- trend;
- business mix;
- renewals;
- claims;
- generated/freshness timestamp.

## Payout

Expose only role-authorized Partner-facing commercial states.

Target concepts:

- Projected
- Eligible
- Approved
- Payment initiated
- Paid

Do not expose insurer/internal accounting reconciliation data merely because it exists in the portal.

## Support

Standardize:

- relationship contact;
- Operations queue summary;
- retry/error/offline states;
- call/email actions;
- support information without exposing internal staff directories.

## Acceptance gate

- interrupted Policy Intake never silently loses user state;
- upload state is explicit;
- commercial visibility matches server authorization;
- Support no longer has indefinite-loader failure behavior;
- business values show data freshness.

---

# PHASE 4 — Data layer, caching, performance, offline and auth lifecycle

## Objective

Replace per-screen ad-hoc loading with a coherent mobile data architecture.

## Shared query/data layer

Introduce a controlled cache/query abstraction supporting:

- request deduplication;
- caching;
- stale time;
- background refresh;
- retry policy;
- cancellation;
- invalidation after writes;
- auth-expiry propagation.

Any new third-party package must be evaluated for native-build impact before adoption.

## Lists

Migrate high-volume collections to:

- `FlatList`;
- `SectionList`;
- or another virtualized equivalent.

Add:

- pagination/infinite loading;
- stable keys;
- pull-to-refresh;
- list footer loading;
- retained scroll position.

## Network/offline behavior

Target behavior:

```text
You're offline
Showing information last refreshed at 11:42 AM
```

Use cached reads where safe.

Do not implement fully offline writes unless separately approved.

## Auth lifecycle

Add:

- auth-state listener;
- foreground/background session handling;
- token refresh lifecycle;
- graceful forced sign-out;
- disabled-account recovery;
- scope refresh where required.

## Acceptance gate

- large data sets remain responsive;
- navigation back does not unnecessarily refetch/reset everything;
- offline is distinguishable from server error;
- foregrounding after a long background period behaves correctly;
- no protected-data cache crosses identity/scope boundaries.

---

# PHASE 5 — Accessibility, resilience, observability readiness and testing

## Accessibility

Audit:

- touch target size;
- contrast;
- text scaling;
- screen-reader labels;
- selected/disabled state announcements;
- error announcements;
- focus order;
- modal focus;
- meaning not conveyed by color alone.

## Error boundary

Add app-level recovery for unexpected render/runtime errors.

## Form behavior

Standardize:

- keyboard avoidance;
- next/previous/done;
- masking;
- inline validation;
- unsaved-change protection;
- preservation after server error.

## Data freshness

Expose generated/refreshed time where useful.

## Testing

Add/expand:

- unit tests;
- formatting/calculation tests;
- Partner authorization tests;
- integration tests;
- Android smoke flows;
- accessibility checks;
- network interruption tests;
- OTA update/rollback checks.

Recommended native smoke journeys:

```text
Login
-> Customers
-> Customer detail
-> Policy
-> Back
```

```text
Login
-> New Policy Intake
-> Select document
-> Submit
-> Track status
```

## Acceptance gate

- key flows survive poor-network/error scenarios;
- app-level errors are recoverable;
- core flows have repeatable automated or scripted verification;
- accessibility review has no known P0 blocker.

---

# PHASE 6 — Batched native-capability upgrade

## Objective

Introduce native capabilities in one deliberately batched build to protect Expo quota.

## Candidate native capabilities

Only after Phases 0-5 stabilize, evaluate and batch:

- push notifications;
- native network-state module if required;
- crash-reporting native integration;
- biometric app re-entry;
- selective screen/app-switcher privacy;
- haptics where justified;
- notification icon/channel configuration.

Not every candidate must be implemented. The exact Phase 6 native set requires a dependency/build-impact review first.

## Push notification target

Examples:

- renewal due;
- claim status changed;
- Policy Intake needs attention;
- Policy Intake approved/rejected;
- missing document;
- payout eligible;
- payout paid.

Each notification must deep-link to the correct authorized destination.

## Biometric target

Optional local app lock after a defined background duration.

It is a local privacy gate, not server authentication.

## Screen privacy

Apply selectively to screens containing sensitive PII or documents.

Do not globally block screenshots unless explicitly approved.

## Build gate

**A new APK/native binary is forbidden until the user explicitly authorizes that exact build.**

The objective is one batched native preview build rather than separate builds per native capability.

## Acceptance gate

- native dependency set reviewed;
- runtime/version strategy reviewed;
- explicit user build authorization received;
- one preview native build created;
- installed-device verification completed;
- OTA compatibility verified afterward.

---

# PHASE 7 — Full UAT, security and production audit

## Role matrix

At minimum verify:

| Workflow | Partner | POSP | MISP | RM / hierarchy |
| --- | --- | --- | --- | --- |
| Login | ✓ | ✓ | ✓ | ✓ |
| Home scope | ✓ | ✓ | ✓ | ✓ |
| Customer visibility | ✓ | ✓ | ✓ | scope-dependent |
| Policies | ✓ | ✓ | ✓ | scope-dependent |
| Renewals | ✓ | ✓ | ✓ | scope-dependent |
| Claims | ✓ | ✓ | ✓ | scope-dependent |
| Policy Intake | ✓ | ✓ | ✓ | role-dependent |
| Payout visibility | authorized only | authorized only | authorized only | role-dependent |
| Subordinate/team business | where applicable | — | — | where applicable |

## Security matrix

For two independent identities, prove:

```text
Partner/POSP A
must not retrieve
Partner/POSP B customer
Partner/POSP B policy
Partner/POSP B claim
Partner/POSP B intake
Partner/POSP B payout
```

Test through:

- UI;
- RPC;
- direct authorized client query where applicable;
- API endpoint;
- document URL.

## Device matrix

At minimum:

- small Android phone;
- typical Android phone;
- tall/large phone;
- low-memory device where practical;
- gesture navigation;
- 3-button navigation;
- large text setting;
- slow network;
- offline/reconnect.

## Acceptance gate

No unresolved P0 security, authorization, data-loss, crash, navigation or accessibility issue.

---

# PHASE 8 — Production release

## Production package

- version 1.0.0 or approved production version;
- production runtime/channel;
- Android AAB;
- Play signing;
- final app icon/splash/notification assets;
- privacy policy;
- Data Safety;
- content rating;
- store screenshots;
- support details;
- release notes.

## Release method

Prefer staged rollout rather than immediate 100% release.

## Native-build rule

Production AAB is a separate explicit build authorization.

## Acceptance gate

- exact release commit identified;
- required migrations/config are applied and separately verified;
- production AAB succeeds;
- production channel mapping verified;
- production login and core smoke flows verified;
- release monitoring active.

---

## 6. Cross-cutting production requirements

These requirements apply to every phase.

### 6.1 Security

- never expose service-role credentials;
- protect private documents;
- enforce server-side scope;
- do not log PII;
- do not emit sensitive analytics payloads;
- do not weaken Supabase RLS for mobile convenience.

### 6.2 Currency and date consistency

Use:

- INR formatting;
- Indian locale conventions;
- one approved date display convention per context;
- stable status terminology shared with portal where the business meaning is the same.

### 6.3 Status semantics

A status must have:

- text;
- semantic tone;
- a clear meaning.

Never depend on color alone.

### 6.4 Confirmation

Use confirmation for irreversible or high-consequence actions such as:

- sign out;
- delete/replace document;
- cancel/withdraw request where supported.

### 6.5 Success feedback

Return useful business confirmation, for example:

```text
Policy Intake submitted
Reference: PI-10452
```

instead of only `Success`.

---

## 7. OTA and native-build strategy

### OTA-first work

Phases 0-5 should be implemented primarily as JS/TS/UI/business-logic changes compatible with the installed preview binary.

### Preview OTA flow

```text
Feature branch
-> CI
-> merge to main
-> publish exact main to Partner preview OTA
-> installed preview app
-> verify affected screens
```

Do not publish feature branches directly to the shared preview channel.

### Current update startup refinement target

Current configuration uses:

```text
checkAutomatically = ON_LOAD
fallbackToCacheTimeout = 10000
```

During the approved OTA refinement phase, target a faster startup policy where the currently cached compatible app launches immediately and non-critical updates download in the background, with explicit restart/update UX for important updates.

Any change to runtime/build compatibility must be reviewed separately.

### Runtime strategy

Current runtime policy is `appVersion`.

Before production, choose one:

1. retain `appVersion` with strict native-change/version-bump CI rules; or
2. migrate to a safer compatibility policy such as fingerprinting after build-impact review.

No runtime-policy change is authorized merely by this plan.

---

## 8. Expo quota protection

This is a hard project constraint.

### Native builds are expensive project events

Do not create a Partner APK/AAB for:

- visual polish;
- TS/JS business logic;
- list changes;
- form changes;
- navigation changes;
- normal bug fixes;
- diagnostic experimentation.

### Expected remaining native builds

Target:

1. one batched Phase 6 preview native build, only if Phase 6 native capabilities are approved;
2. one final production AAB.

Additional builds require a named native reason and explicit user approval.

---

## 9. Quality severity

### P0 — blocks production

Examples:

- unauthorized data exposure;
- data loss;
- crash/startup failure;
- broken authentication;
- broken Policy Intake submission;
- wrong Partner scope;
- unrecoverable navigation;
- incompatible OTA/native runtime;
- serious accessibility blocker on a core action.

### P1 — must fix before production

Examples:

- major UX inconsistency;
- weak-network unreliability;
- unusable large lists;
- missing retry;
- misleading status;
- broken filter preservation;
- tiny critical touch targets;
- poor form behavior.

### P2 — polish

Examples:

- animation;
- non-critical visual hierarchy;
- secondary engagement refinements.

P2 must not delay P0/P1 remediation.

---

## 10. Evidence states

Use repository evidence terminology consistently:

- **VERIFIED** — directly observed in source, logs, environment or repeatable test.
- **IMPLEMENTED** — committed code only.
- **APPLIED** — migration/config applied to target environment.
- **DEPLOYED** — target platform confirms exact release deployed.
- **LIVE VERIFIED** — authenticated installed-device user journey tested.
- **BLOCKED** — named dependency prevents completion.
- **LEARNING** — durable failure lesson.
- **UNVERIFIED** — expected but not directly proven.

Never call an OTA, APK or production release successful solely because a workflow was triggered.

---

## 11. Change-request protocol

This plan is intentionally frozen.

A request discovered later that is outside the current phase is handled as follows.

### Step 1 — classify

Is it:

- defect;
- security issue;
- production blocker;
- required dependency;
- new feature;
- UX preference;
- architecture change?

### Step 2 — determine impact

Document whether it affects:

- active phase;
- future phase;
- backend/schema;
- RLS/security;
- native binary;
- OTA runtime;
- Expo build quota;
- Play release.

### Step 3 — decision

#### If it is a P0 defect/security blocker

It may interrupt the phase, but must be explicitly recorded as an exception.

#### If it belongs to a future existing phase

Record it against that phase; do not implement early unless required by dependency.

#### If it is truly outside this plan

Treat it as a formal change request and obtain user approval before adding it to the master plan or implementing it.

### Step 4 — update

Only user-approved scope changes modify this master document.

Do not silently expand the roadmap from incidental implementation observations.

---

## 12. Phase tracking

Use this section as the compact source of progress.

| Phase | Status | Native build? | Notes |
| --- | --- | ---: | --- |
| 0 — Shared mobile foundation | VERIFIED COMPLETE | No | PR #800 merged; OTA applied; Customers + New Policy Intake visually verified on installed Android app |
| 1 — Navigation / Home / global states | VERIFIED COMPLETE | No | PR #808 merged; OTA applied; Home + More visually verified on installed Android app |
| 2 — Customers / Policies / Renewals / Claims | VERIFIED COMPLETE | No | PR #811 merged; OTA applied; list + policy detail + claim detail visually verified on installed Android app |
| 3 — Policy Intake / Business / Payout / Support | VERIFIED COMPLETE | No | PR #814 merged; payout RPC applied; Phase 3 UI verified; SecureStore hotfix PR #816 applied and OTA-published |
| 4 — Data/cache/offline/auth lifecycle | VERIFIED COMPLETE | No | PR #817 merged; OTA applied; cached Home + cached Policy book verified on installed Android app; duplicate-warning hotfix PR #819 published |
| 5 — Accessibility/resilience/testing | VERIFIED COMPLETE | No | PRs #821/#822/#828/#829/#835 merged; preview OTA published; installed-device Phase 5 smoke review accepted by user on 2026-08-30 |
| 6 — Batched native capabilities | IN PROGRESS | **Yes — approved for this preview build** | PR #849 merged; Android preview APK build #13 / EAS build `5469eb95-1f23-4b7e-8ebe-1b61d917a975` succeeded with the approved Partner icon; installed-device icon verification pending; other native capability candidates remain review-scoped |
| 7 — Full UAT/security audit | LOCKED | No | |
| 8 — Production release | LOCKED | **Production AAB approval required** | |

Status values:

- NOT STARTED
- IN PROGRESS
- BLOCKED
- READY FOR REVIEW
- VERIFIED COMPLETE

---

## 13. Phase completion update rule

At the end of each phase, update only:

- phase status;
- exact implementation PR/commit;
- checks actually completed;
- installed-device/OTA evidence when available;
- unresolved risk;
- next unlocked phase.

Do not turn this file into a development transcript.

---

## 14. Immediate authorized next action

The user has approved freezing this plan and executing it phase-by-phase.

The next implementation work is therefore:

> **Phase 6 — Batched native-capability review, beginning with the user-approved Partner app icon preview build**

**VERIFIED COMPLETE:** Phase 0 implementation merged in PR #800 as `5841fe44ed9e049aa39b1524e6e34337ed523236`. Canonical Partner verification run #38 passed route integrity, release identity, TypeScript, lint and Expo web review export. The deliberate main-only OTA trigger path was added in PR #801 and merged as `12908201517d0689dfac635ca56f2273c7670ccf`. Partner preview OTA run `33300628248` succeeded on project `8ade82c1-4c96-4f09-b90b-802270fb406d`, branch `preview`, runtime `0.1.0`, update group `536b65c6-a13a-4c6a-b794-506a4222ae1a`, exact Git commit `12908201517d0689dfac635ca56f2273c7670ccf`. On 2026-08-30, user-provided installed-device screenshots directly verified the refined Customers screen and New Policy Intake screen rendering correctly after OTA. Phase 0 is complete and Phase 1 is unlocked/in progress.

**VERIFIED COMPLETE:** Phase 1 implementation merged in PR #808 as `06434354955b12efffbf885fb7b05bdd82e5ec09`. Canonical Partner verification run #41 passed release identity, route integrity, TypeScript, lint and Expo web review export on exact head `bb692e52be714e86dd6f4f06fb16f8034dc0ab4c`. Partner preview OTA run `33303417106` succeeded on project `8ade82c1-4c96-4f09-b90b-802270fb406d`, branch `preview`, runtime `0.1.0`, update group `779ffe96-ca13-4df9-8478-d4e736f56f83`, exact Git commit `06434354955b12efffbf885fb7b05bdd82e5ec09`. On 2026-08-30, user-provided installed-device screenshots directly verified the action-first Home and grouped More screen after OTA; the updated bottom navigation was also visible and correctly selected. Phase 1 is complete and Phase 2 is unlocked/in progress.

**VERIFIED COMPLETE:** Phase 2 implementation merged in PR #811 as `526dfa0c944edd1ca2a75af1c837c22687d9140e`. Canonical Partner verification run #43 passed release identity, route integrity, TypeScript, lint and Expo web review export on exact head `71848a262d4eec7fd4ee2dced403bd7e6901f89d`. Partner preview OTA run `33304718833` succeeded on project `8ade82c1-4c96-4f09-b90b-802270fb406d`, branch `preview`, runtime `0.1.0`, update group `f38b2264-0215-4ca8-a3ab-f3444ff188ae`, exact Git commit `526dfa0c944edd1ca2a75af1c837c22687d9140e`. On 2026-08-30, user-provided installed-device screenshots directly verified Customers, Policies, Renewals and Claims plus representative Motor policy detail and active claim detail/journey screens after OTA. Phase 2 is complete and Phase 3 is unlocked/in progress.

**VERIFIED COMPLETE:** Phase 3 implementation merged in PR #814 as `6848907727d7b1a1a86833a71826a7bb80f6f077`. Canonical Partner verification run #45 (`33306719499`) passed release identity, route integrity, TypeScript, lint and Expo web review export. Production Supabase migration `partner_app_refinement_phase3_payout` was APPLIED and its payout RPC privilege boundary was verified. Partner preview OTA run `33306829054` published the Phase 3 implementation. On 2026-08-30, user-provided installed-device screenshots directly verified Business, employee/RM restricted payout visibility, Policy Intake submission history and Support. The screenshots also exposed one P0 SecureStore key defect in New Policy Intake; PR #816 fixed the invalid key characters, Partner Verify #47 passed, and Partner preview OTA run `33307619084` published hotfix commit `8019006045e0e757b7ace9c8fffd937ad6b5adb6` as update group `fbbd9412-13b4-4656-ac4d-f4a261d39b61`. The user then authorized continuation. Phase 3 is complete and Phase 4 is unlocked/in progress.

**VERIFIED COMPLETE:** Phase 4 implementation merged in PR #817 as `fd0af36e964a589bf9ce3175f5b36d86ad6e1103`. Exact-head Partner Verify #51 (`33310669425`) passed release identity, route integrity, TypeScript, lint and Expo web review export; Web portal verification run `33310669469` also passed. Partner preview OTA run `33311046411` published update group `7a521fc7-1d1d-4528-a5a7-0d3c7051c64c` on runtime `0.1.0`. On 2026-08-30, installed-device screenshots directly verified cached Home and cached Policy-book fallback while network refresh was unavailable: previously loaded data remained usable, refresh timestamps were preserved, and the app stayed signed in instead of failing blank. The Policy screenshot also exposed one duplicate cached/error warning; PR #819 removed the redundant secondary warning across Customers, Policies, Claims and Renewals. Partner Verify #52 and Web Verify #2297 passed for that hotfix, and Partner preview OTA run `33312428206` published exact commit `ed74f16713b0a6b1f5a7fcec0a6a815516f9f7d7` as update group `91082f67-941b-4bd0-8486-2f6f203da69e`. Phase 4 is complete and Phase 5 is unlocked/in progress.

**VERIFIED COMPLETE:** Phase 5 was delivered in focused slices without native dependencies: PR #821 added app-level error recovery and shared field/dialog accessibility semantics; PR #822 hardened login keyboard/focus/error behavior; PR #828 added deterministic resilience/accessibility/smoke-route CI contracts; PR #829 made Policy Intake progress semantics screen-reader accessible; and final hardening PR #835 merged as `cda5758fd3d154537dde2b259817ce35470d21cc`, adding sanitized observability readiness, a safe Return-to-Home recovery path, Policy Intake selected-file loss protection, minimum filter touch targets, and CI contracts for cache/offline/auth/OTA resilience. Exact-head Partner Verify #59 (`33323330120`) passed Phase 5 contracts, release identity, route integrity, TypeScript, lint and Expo web review export. Web Verify #2332 (`33323330322`) passed regressions, typecheck, lint and production build. Partner preview OTA run `33323478770` succeeded on project `8ade82c1-4c96-4f09-b90b-802270fb406d`, branch `preview`, runtime `0.1.0`, update group `99a81b03-1bc0-468f-810d-d1188eec6cee`, exact Git commit `cda5758fd3d154537dde2b259817ce35470d21cc`. On 2026-08-30, the user confirmed the installed-device Phase 5 smoke review is good, closing the remaining acceptance gate with no reported accessibility P0 blocker. Phase 5 is therefore VERIFIED COMPLETE. The user then explicitly approved the supplied distinct INSUREIT Partner app icon for Android/iOS native configuration and authorized proceeding with a new Partner preview APK build. This approval is limited to the icon/native preview-build step; other Phase 6 native capability candidates remain subject to dependency/build-impact review.


**PHASE 6 IN PROGRESS:** User-approved Partner native icon configuration merged in PR #849 as `71cc1d03b43d8526e02d06a6f7b59798ef458470`. The approved shield artwork is configured as the Partner app icon for Android and iOS. Partner Verify #61 (`33328385522`) and Web Verify #2362 (`33328385541`) passed before merge. GitHub Partner preview APK build #13 (`33328499560`) then completed successfully from exact `main`; EAS build `5469eb95-1f23-4b7e-8ebe-1b61d917a975` produced an internal Android APK for `com.insureit.partner`, app/runtime `0.1.0`, Android build version `3`, exact Git commit `71cc1d03b43d8526e02d06a6f7b59798ef458470`. Remaining gate for this native slice: install the new APK and visually verify the launcher icon plus normal cold launch/core navigation. iOS icon configuration is committed, but no iOS native binary was built in this slice. Other Phase 6 native capability candidates remain unapproved until dependency/build-impact review.

No later phase is authorized to be mixed into Phase 5 merely for convenience.

