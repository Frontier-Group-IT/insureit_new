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


## Asset-generation audit — 2026-09-02

### Theme now approved

The user approved the newer **minimal realistic 3D** direction:
- faded black / graphite primary material;
- premium dark metallic surfaces;
- restrained electric/royal blue accents;
- realistic rather than exaggerated neon;
- transparent/no-background source assets for app placement;
- consistent visual language across icons, illustrations and banners.

The earlier highly neon/glossy generation is superseded by this more minimal realistic direction.

### Individually generated assets that are visually successful as concepts

These have been generated as separate image outputs and match the approved direction closely enough to retain as concept masters pending production normalization:

1. `secure_document_upload_icon.png`
2. `3d_analytics_growth_chart_icon.png`
3. `premium_insurance_shield_document.png`
4. `tech_support_shield_headset.png`
5. `3d_umbrella_shield_with_checkmark.png`
6. `security_shield_magnifier_icon.png`
7. `renewal_insurance_policy_icon.png`
8. `verified_team_shield.png`
9. `sleek_insured_sedan_shield.png`
10. `3d_insurance_finance_shield_composition.png`
11. `futuristic_neon_business_avatar.png`
12. `futuristic_blue_accented_briefcase_icon.png`
13. `3d_insurance_claims_alert_icon.png`
14. `neon_blue_metallic_notification_bell.png`
15. `cybersecurity_insured_home_icon.png`
16. `futuristic_neon_medical_shield.png`
17. `futuristic_family_protection_shield.png`
18. `neon_shield_corporate_building.png`
19. `futuristic_rupee_growth_icon.png`
20. `neon_bullseye_growth_icon.png`

**Important:** the filenames above describe generated working assets, but some still contain legacy “neon/futuristic” naming. Before app integration, rename into the canonical `partner-...` naming scheme and normalize crop, canvas, alpha, optical size and compression.

### Composite asset sheets generated successfully for direction/reference only

Two large catalog/sprite sheets were generated covering most of the intended family:
- navigation/core icons;
- business action icons;
- quick actions;
- product-family visuals;
- ticker/activity icons;
- notification icons;
- status badges;
- empty states;
- policy-intake illustrations;
- profile/settings visuals;
- insight mini-graphics;
- banners.

These sheets are useful **style references only**. They are not production-ready app assets because they contain many assets in one image and some rendered background/lighting context. Each approved element must still be generated/exported separately with transparent background.

### Coverage achieved conceptually

The generated sheets demonstrate successful visual concepts for:
- Home
- Business
- Policies
- Claims
- Customers
- Renewals
- Policy Intake
- Search
- Notifications
- Documents
- Support
- Insights
- Payout
- Opportunities
- Upload
- Timeline
- Motor
- Health
- Life
- Commercial
- Fleet
- External Policy
- Settings
- Help
- Account
- Preferences
- Security
- About
- Logout
- Success / Warning / Error / Pending / Approved / Rejected
- Quick Action set
- Product Family set
- Ticker concept set
- Notification concept set
- Empty-state concept set
- Support concept set
- Policy Intake lifecycle concept set
- Profile/header concept set
- Growth/Renewal/Claims/Learning banner concepts

### What still needs to be generated as separate production assets

#### A. Core 32-icon family — individual transparent masters still required
Most icons currently exist only in the composite sheet. Generate separately:
- Home
- Business
- Policies
- Claims
- Customers
- Renewals
- Policy Intake
- Search
- Notifications
- Profile
- Documents
- Support
- Insights
- Payout
- Opportunities
- Motor
- Health
- Life
- Commercial
- Fleet
- External Policy
- Upload
- Timeline
- Settings
- Help/Ticket
- Success
- Needs Attention
- Pending Review
- Rejected/Failed
- Call
- WhatsApp
- More

#### B. 8 Quick Action visuals — separate transparent assets required
- Policy Intake
- Customers
- Policies
- Claims
- Renewals
- Search
- Support
- Insights

#### C. 5 Product Family visuals — separate transparent assets required
- Motor
- Health
- Life
- Commercial
- Other / General

#### D. 10 Ticker micro-icons — separate compact transparent assets required
- Renewal due
- Claim alert
- Premium growth
- New customer
- Policy issued
- Document pending
- Support update
- Payout update
- Opportunity
- Insurer/product update

#### E. Notification category icons — separate assets required
- Policy issued
- Renewal reminder
- Claim update
- Claim attention
- Document required
- Business insight
- Support reply
- Operations/system announcement

#### F. Empty-state illustrations — separate transparent assets required
Still need individual final files for:
- No Policies
- No Claims
- No Renewals
- No Customers
- No Notifications
- No Search Results
- No Policy Intake History
- No Documents
- No Support Tickets
- Offline / Refresh Failed
- No Data in Date Range
- No Opportunities

#### G. Policy Intake lifecycle illustrations — separate final assets required
- Upload policy copy
- File selected
- Submission success
- Under Operations review
- Correction/replacement required
- Missing information
- Document verification

#### H. Profile / utility visuals — separate final assets required
- default profile avatar
- business partner avatar
- profile header background
- profile completion visual
- account/settings/help/about/update/logout utility icons where custom art is desired

#### I. Banner system — final production banners still required
The composite sheets demonstrate good direction, but final separate banners are still needed. First production set should include:
1. Grow Your Business
2. Renewal Opportunities
3. Claims Assistance / Claims Requiring Attention
4. Complete Pending Intakes
5. INSUREIT Academy / Product Learning
6. Stay Updated / Insurer Announcements
7. Your Impact / Achievement
8. Cross-sell / Coverage Opportunity

Banner artwork should preferably contain **minimal or no baked-in text** so app copy remains editable and accessible.

#### J. Native/store asset exports — intentionally deferred
Still pending for the explicitly approved native-build/store stage:
- final 1024x1024 app-icon master export normalization;
- Android adaptive foreground;
- Android monochrome;
- 512x512 Play Store icon;
- Play feature graphic;
- final store screenshots.

### Production-readiness issues to correct before integration

1. Verify actual alpha transparency on every separate PNG/WebP.
2. Remove any black/blue canvas baked into the image.
3. Use one consistent square master canvas for icon assets.
4. Normalize optical scale so icons look equal at 24/32/40 px.
5. Reduce blue glow to a restrained accent; avoid strong neon halo.
6. Keep graphite/black as the dominant material.
7. Avoid text inside icons/illustrations.
8. Keep banner text in React Native wherever possible.
9. Produce mobile-optimized WebP/PNG exports after visual approval.
10. Do not integrate composite sprite sheets into the app.

### Current assessment

- **Visual theme:** APPROVED.
- **Concept coverage:** approximately 80–90% of required categories represented.
- **Separate production-ready file coverage:** still incomplete.
- **App integration:** NOT STARTED.
- **OTA:** NOT PUBLISHED.
- **Native build:** NOT CREATED.

### Next generation queue

Generate **separate transparent assets**, not more sprite sheets, in this order:

1. remaining 32-icon family as individual files;
2. 8 Quick Action visuals;
3. 5 Product Family visuals;
4. 10 Ticker micro-icons;
5. 8 Notification category icons;
6. 12 Empty State illustrations;
7. 7 Policy Intake lifecycle illustrations;
8. 8 production banner artworks;
9. Profile/Settings/Support supplemental visuals.

After each family is generated, normalize names to the canonical `partner-...` scheme before integration.
