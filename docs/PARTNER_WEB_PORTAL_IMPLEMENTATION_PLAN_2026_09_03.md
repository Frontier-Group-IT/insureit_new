# INSUREIT Partner Web Portal — Implementation Plan

> **Status:** USER-APPROVED GOAL / IMPLEMENTATION PLAN  
> **Created:** 2026-09-03 IST  
> **Target:** `apps/web-portal` on `https://portal.insureit.in`  
> **Primary route:** `/partner`

## Goal

Create a full Partner-facing web portal inside the existing INSUREIT web application.

- Partners continue signing in at `portal.insureit.in`.
- Intermediary/Partner identities are routed to the Partner portal.
- Operations users continue to the existing Operations portal.
- The Partner website exposes the important workflows and information already available in the INSUREIT Partner mobile app.
- The Partner website does **not** need to copy every engagement module from the mobile app.
- The Partner website must follow the **same design language, layout system, page density, shell geometry, header treatment, navigation treatment, spacing, typography and component style as the Operations portal**.
- Partner data and authorization must reuse the existing Partner-scoped identity/scope/RPC contracts. Do not build a second Partner authorization model and do not expose Operations-only data through frontend hiding.

## Product boundary

Core Partner Web modules:

1. Home
2. My Business
3. Customers
4. Policies
5. Renewals
6. Claims
7. Policy Intake
8. Payout
9. Network
10. Search
11. Activity
12. Account / Registration / Training
13. Profile
14. Support

Secondary mobile engagement modules such as Impact, Journey, Learn, Stories and Recognition may be added later only when useful on web; they are not required for the first production Partner Web release.

## Architecture

```text
portal.insureit.in/login
        |
        +-- Operations employee --> /dashboard
        |
        +-- Partner/POSP/MISP --> /partner
                                  |
                                  +-- Partner-scoped RPCs
                                  +-- same Partner identity resolver
                                  +-- same commercial-scope rules
                                  +-- Partner-only web shell
```

The mobile app and Partner website share business contracts, not UI code.

## Step-by-step implementation

### Phase 0 — Baseline and parity inventory

1. Freeze current Operations portal visual baseline.
2. Inventory Partner app routes and classify them as core, secondary or mobile-only.
3. Inventory every Partner RPC used by the core modules.
4. Record exact current output contracts and authorization assumptions.
5. Identify gaps where the existing static intermediary page still uses service-role/admin reads.
6. Create a parity matrix: Partner app screen -> Partner Web route -> existing RPC -> implementation status.
7. Do not change schema or RPC behavior in this phase.

**Gate:** approved route/module map with no unidentified authorization dependency.

### Phase 1 — Role routing and Partner route guard

1. Introduce `/partner` as the canonical Partner Web root.
2. Update post-login routing:
   - intermediary -> `/partner`
   - Operations roles -> existing requested Operations route/dashboard.
3. Keep `/intermediary-portal` as a compatibility route and redirect it safely to the appropriate new Partner route.
4. Add a server-side Partner route guard for every `/partner/*` route.
5. Resolve the authenticated intermediary through the existing portal-account / Partner identity contract.
6. Fail closed for disabled, inactive, ambiguous or unresolved identities.
7. Prevent Operations routes from becoming accessible merely because a user knows the URL.
8. Preserve logout, forgot-password, invite and browser-session behavior.

**Gate:** routing and authorization regression tests pass for Partner, POSP/MISP where supported, Operations user, inactive account and unauthorized user.

### Phase 2 — Partner Web shell matching Operations portal

1. Create a dedicated `PartnerPortalShell`.
2. Match the current Operations portal visual system:
   - 268px desktop navigation geometry;
   - sticky translucent/glass header;
   - route rail/breadcrumb treatment;
   - page background;
   - spacing scale;
   - card radius/border/shadow language;
   - typography hierarchy;
   - responsive/mobile navigation behavior;
   - user-menu treatment.
3. Do **not** reuse the Operations navigation menu itself.
4. Create Partner-only navigation:
   - Home
   - My Business
   - Customers
   - Policies
   - Renewals
   - Claims
   - Policy Intake
   - Payout
   - Network
   - Activity / Search
   - Account / Support
5. Reuse shared web primitives where safe instead of cloning CSS.
6. Make desktop/tablet/mobile web responsive.

**Gate:** shell visually matches Operations portal while exposing only Partner destinations.

### Phase 3 — Shared Partner Web data adapter

1. Add server-side web adapters for existing Partner RPCs.
2. Use the authenticated browser session, not service-role access, for normal business reads.
3. Centralize:
   - RPC invocation;
   - typed results;
   - pagination;
   - search/filter inputs;
   - safe error translation;
   - scope/unauthorized states.
4. Reuse existing contracts including:
   - `partner_app_home`
   - `partner_app_business_range`
   - `partner_app_business_performance`
   - customer summary/list/detail RPCs
   - policy summary/list/detail RPCs
   - renewal summary
   - claim summary/list/detail RPCs
   - Policy Intake contracts
   - payout/network contracts
   - universal search contracts.
5. Do not duplicate business calculations in Next.js.
6. Add focused contract regressions so Partner App and Partner Web remain numerically consistent.

**Gate:** same test Partner returns matching core totals in app contracts and web adapters.

### Phase 4 — Partner Home

1. Build `/partner`.
2. Use the Operations dashboard visual grammar rather than the Partner mobile dashboard layout.
3. Surface:
   - premium/business snapshot;
   - policy count;
   - customer count;
   - renewals;
   - active/attention claims;
   - Policy Intakes needing attention;
   - clear quick actions.
4. Add compact “Need your attention” work queue.
5. Link every metric/action to the relevant Partner route.
6. Keep nonessential engagement content out of the first viewport.

**Gate:** Home totals match `partner_app_home` and all drill-down routes are scope-safe.

### Phase 5 — My Business

1. Build `/partner/business`.
2. Reuse `partner_app_business_performance` and date-range contracts.
3. Provide Operations-style filter controls for:
   - this month;
   - previous period;
   - custom range.
4. Show:
   - gross premium;
   - policies;
   - customers;
   - renewals;
   - claims;
   - trend;
   - business mix.
5. Use desktop-friendly charts/summary cards while preserving the same underlying numbers as the app.

**Gate:** standard and custom date ranges reconcile with Partner app/backend results.

### Phase 6 — Customers

1. Build `/partner/customers`.
2. Add Partner-scoped search and pagination.
3. Build `/partner/customers/[id]`.
4. Customer detail should surface:
   - identity/contact summary;
   - policies;
   - vehicles;
   - claims;
   - renewals.
5. Add cross-navigation to scoped Policy and Claim details.
6. Never expose Operations edit/admin actions unless a separately approved Partner workflow explicitly allows them.

**Gate:** out-of-scope customer IDs fail closed.

### Phase 7 — Policies and Renewals

1. Build `/partner/policies`.
2. Provide lifecycle filtering:
   - all;
   - in force;
   - expiring;
   - expired;
   - upcoming.
3. Build `/partner/policies/[id]`.
4. Show policy, premium, customer, vehicle, insurer and authorized commercial information.
5. Build `/partner/renewals`.
6. Present overdue and due buckets using the canonical renewal summary.
7. Ensure Home, Policies and Renewals counts reconcile from the same contract semantics.

**Gate:** list, lifecycle counts, detail access and renewal totals match backend/app results.

### Phase 8 — Claims

1. Build `/partner/claims`.
2. Add all/active/completed states, search and pagination.
3. Build `/partner/claims/[id]`.
4. Show:
   - current status;
   - insurer claim number where available;
   - service/assistance mode;
   - customer/vehicle/policy;
   - financial values allowed by the Partner contract;
   - status history;
   - claim stages.
5. Keep Operations-only claim mutation/review controls hidden **and server-inaccessible**.

**Gate:** Partner can only open claims inside resolved commercial scope.

### Phase 9 — Policy Intake

1. Build `/partner/policy-intakes`.
2. Build intake detail and new intake routes.
3. Reuse the same Partner Intake backend workflow used by the app.
4. Make the desktop workflow easier for:
   - customer/policy input;
   - document upload;
   - status tracking;
   - replacement document response;
   - validation/errors.
5. Preserve Operations review as a separate internal workflow.
6. Add clear submission success and continuation states.

**Gate:** a Partner Web submission enters the same Operations Policy Intake queue as a Partner App submission.

### Phase 10 — Payout and Network

1. Build `/partner/payout`.
2. Reuse only the payout information explicitly exposed by Partner contracts.
3. Never expose internal accounting/reconciliation fields merely because the web screen has more space.
4. Build `/partner/network`.
5. Show the authorized Partner/POSP/MISP or employee hierarchy returned by the Partner scope contract.
6. Preserve the same server-side restricted-visibility behavior as mobile.

**Gate:** payout and hierarchy exposure exactly match authorization contracts.

### Phase 11 — Account, registration, training, profile and support

1. Migrate the useful content from the current `/intermediary-portal` page into `/partner/account`.
2. Preserve:
   - account state;
   - onboarding/registration state;
   - documents state;
   - training;
   - exam;
   - agreement;
   - IIB state;
   - iCall launch where applicable.
3. Replace direct service-role reads with Partner-scoped contracts where required before expanding this area.
4. Build Profile and Support pages using Operations portal styling.
5. Keep Settings minimal unless a real web setting exists.

**Gate:** no loss of the current static portal capability and no service-role expansion.

### Phase 12 — Search and Activity

1. Build global Partner search using the existing Partner-scoped search contracts.
2. Search Customers, Policies and Claims.
3. Preserve query/filter context when navigating into details and back.
4. Add Partner Activity using existing scoped activity sources.
5. Add header search/notifications only if backed by real Partner data.

**Gate:** search cannot discover out-of-scope records.

### Phase 13 — Optional secondary Partner modules

Evaluate after core UAT:

- Impact
- Journey
- Learn
- Stories
- Recognition
- other mobile engagement surfaces.

Only add those that provide real desktop value. Do not copy mobile content simply for feature-count parity.

### Phase 14 — Cross-platform parity, security and performance hardening

1. Run one-account parity checks across Partner App and Partner Web for:
   - Home;
   - Business;
   - Customers;
   - Policies;
   - Renewals;
   - Claims;
   - Policy Intakes;
   - Payout;
   - Network.
2. Test role/scope boundaries.
3. Verify browser-session expiry and disabled-account behavior.
4. Verify direct URL access cannot bypass navigation restrictions.
5. Ensure Partner pages do not use Operations service-role data paths.
6. Apply the existing web performance rules:
   - no unnecessary hard reloads;
   - no timestamp URL churn;
   - client-side filtering where data is already loaded;
   - pagination for high-volume registers;
   - on-demand document URLs;
   - no duplicate auth/profile/RPC waterfalls.
7. Add responsive and accessibility checks.
8. Run the canonical `Verify web portal` workflow.

**Gate:** green CI plus role/scope regression and authenticated UAT.

### Phase 15 — Controlled production release

1. Implement each major slice on a feature branch and PR.
2. Keep Partner Web work isolated from unrelated Operations or mobile changes.
3. Merge only after the relevant verification gate is green and user approval requirements are satisfied.
4. Use the normal production deployment workflow for `portal.insureit.in`.
5. Verify Vercel READY separately from GitHub CI.
6. Run authenticated production smoke tests for Partner and Operations identities.
7. Keep a rollback path to the pre-Partner-Web production commit.
8. Update this plan and `CURRENT_CHAT_HANDOFF.md` with verified evidence.

## Initial route map

```text
/partner
/partner/business
/partner/customers
/partner/customers/[id]
/partner/policies
/partner/policies/[id]
/partner/renewals
/partner/claims
/partner/claims/[id]
/partner/policy-intakes
/partner/policy-intakes/new
/partner/policy-intakes/[id]
/partner/payout
/partner/network
/partner/search
/partner/activity
/partner/account
/partner/profile
/partner/support
```

## Non-negotiable rules

- Same domain: `portal.insureit.in`.
- Same login surface.
- Partner role routes into Partner Web; Operations roles retain Operations Web.
- Partner Web must visually follow the Operations portal, not the Partner mobile-app layout.
- Important Partner App workflows are reused; complete pixel/feature parity is not required.
- Server authorization is authoritative; UI hiding is never authorization.
- Reuse Partner-scoped RPCs and identity/scope resolution.
- Do not introduce a second Partner business-data model.
- Do not use service-role/admin reads as the normal Partner Web business-data path.
- Do not expose Operations navigation or privileged actions to Partner users.
- No Partner mobile APK/AAB work is implied or authorized by this web project.
