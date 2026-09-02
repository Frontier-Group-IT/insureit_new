# INSUREIT Partner Brand Experience — Batch 1 Tracker

> **Started:** 2026-09-02 (IST)
>
> Canonical brief: `docs/INSUREIT_PARTNER_BRAND_EXPERIENCE_ASSET_BRIEF_2026_09_02.md`

## Purpose

Batch 1 establishes the reusable branded visual system before any large dashboard restructuring. The goal is to avoid one-off artwork and instead create a coherent INSUREIT Partner visual language.

Locked reference mix:
- Kite for operational clarity;
- RenewBuy for branded dashboard personality;
- Naukri for premium lifecycle/empty-state/profile polish.

## Batch 1 deliverables

### 1. Custom INSUREIT Partner icon family
Target: 32 icons.

Status: **DESIGN CONCEPT / STYLE BOARD IN PROGRESS — NOT YET INTEGRATED**

Required families:
- navigation;
- business/workflow;
- product;
- utility/lifecycle;
- contact/support.

Acceptance criteria:
- one geometry/stroke language;
- consistent optical size;
- good at 16–24 px;
- transparent background;
- no copied third-party artwork;
- exportable to SVG;
- active/filled variants only where needed.

### 2. Dashboard Quick Action visuals
Target: 8.

Status: **DESIGN CONCEPT / STYLE BOARD IN PROGRESS — NOT YET INTEGRATED**

Actions:
- Policy Intake;
- Customers;
- Policies;
- Claims;
- Renewals;
- Search;
- Support;
- Insights.

### 3. Product-family visuals
Target: 5 primary.

Status: **DESIGN CONCEPT / STYLE BOARD IN PROGRESS — NOT YET INTEGRATED**

Families:
- Motor;
- Health;
- Life;
- Commercial;
- Other / General.

### 4. Ticker micro-icon system
Target: 10.

Status: **DESIGN CONCEPT / STYLE BOARD IN PROGRESS — NOT YET INTEGRATED**

Events:
- Renewal due;
- Claim alert;
- Premium growth;
- New customer;
- Policy issued;
- Document pending;
- Support update;
- Payout update;
- Opportunity;
- Insurer/product update.

### 5. Banner visual template system
Target: reusable visual language first, then 8–12 production banners.

Status: **DESIGN CONCEPT / STYLE BOARD IN PROGRESS — NOT YET INTEGRATED**

Initial themes:
- Growth / opportunity;
- Operational attention;
- Learning / product knowledge;
- Achievement / impact.

## Technical status

- No Partner app code changes in this batch yet.
- No backend/schema/RLS/auth changes.
- No native dependency/config changes.
- No APK/AAB/native build.
- No OTA publication.
- No device validation yet.

## Next gate

Before integration:
1. approve the visual language;
2. convert approved assets to production-safe app formats;
3. create a controlled Partner dashboard Brand Experience branch;
4. integrate only Batch 1 assets;
5. run exact-head Partner + Web CI;
6. merge only after safety check;
7. publish Partner preview OTA;
8. validate on real device;
9. record screenshots/findings here and in `CURRENT_CHAT_HANDOFF.md`.

## Continuity rule

Every material update to Batch 1 must record:
- generated asset family;
- approval status;
- source/master location;
- production export location;
- integration PR;
- CI;
- OTA;
- real-device validation;
- remaining asset gaps.
