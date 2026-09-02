# INSUREIT Partner Brand Experience — Asset Production Brief

> **Locked:** 2026-09-02 (IST)
>
> This document is the durable production brief for the next INSUREIT Partner visual-brand phase. Read it together with `docs/CURRENT_CHAT_HANDOFF.md` and the Partner release-readiness handoff before changing the Partner app.
>
> **Do not treat this as permission to build a new APK/AAB.** The current work remains OTA-first. Native-only assets/configuration stay deferred until the user explicitly approves that exact native build.

## 1. Locked UI/UX direction

The final design reference mix is now:

- **Zerodha Kite:** information discipline, dense operational rows, predictable navigation, restrained chrome.
- **RenewBuy:** branded business dashboard personality, ticker/announcement rail, product-family modules, custom icons, informative/promotional banners.
- **Naukri:** premium consumer-app polish, contextual banners, illustrated empty states, strong screen hierarchy, lifecycle/status presentation, grouped utility/settings/navigation patterns.

The target is **not** to copy any of these products. INSUREIT Partner must have its own visual identity.

### Final design principle

> **INSUREIT Partner = Kite-level clarity + RenewBuy-style business personality + Naukri-level consumer polish and lifecycle UX.**

Operational screens remain clean and restrained. Brand expression is concentrated in Home, quick actions, product-family modules, banners, empty states, profile/settings/support, notifications, and milestone/lifecycle surfaces.

## 2. Asset-system goal

Create a coherent INSUREIT Partner asset library so the app no longer feels assembled from generic system icons/cards.

All assets must:
- feel like one family;
- work on light INSUREIT surfaces;
- remain readable at small mobile sizes;
- use consistent geometry, stroke weight, corner language, and color rules;
- avoid stock-art or clip-art appearance;
- avoid copying RenewBuy/Naukri/Kite artwork;
- preserve INSUREIT logo geometry and brand identity;
- be exportable as production-safe SVG/PNG/WebP as appropriate.

## 3. Color/visual direction

Use the existing INSUREIT visual language as the base:
- deep navy / dark ink for authority;
- INSUREIT purple as primary digital accent;
- light orange / warm gold as controlled secondary accent;
- limited semantic green / amber / red for status;
- soft neutral surfaces.

Do **not** make every module colorful. Product-family and campaign artwork may use controlled secondary colors, but operational screens should remain restrained.

## 4. Asset production list

### A. Core brand pack

Create:
1. Primary INSUREIT Partner logo — full color, transparent.
2. Light-background logo variant.
3. Dark-background / white logo variant.
4. Monochrome white mark.
5. Monochrome navy mark.
6. Simplified small-size brand mark for compact UI.
7. App-icon master, 1024x1024.
8. Android adaptive-icon foreground master.
9. Android monochrome icon.
10. Store-listing icon master.
11. 2–3 subtle abstract INSUREIT background textures/patterns.

**Important:** the already approved Partner logo/icon remains the native-build target. Do not replace its basic logo design without a new explicit decision.

### B. Custom INSUREIT Partner icon family

Create one consistent icon family in vector form.

#### Navigation / identity
1. Home
2. Business
3. Policies
4. Claims
5. More
6. Search
7. Notifications
8. Profile

#### Business / workflow
9. Customers
10. Renewals
11. Policy Intake
12. Documents
13. Support
14. Insights / Analytics
15. Payout / Earnings
16. Opportunities

#### Product families
17. Motor
18. Health
19. Life
20. Commercial
21. Fleet
22. External Policy

#### Utility / lifecycle
23. Upload
24. Timeline / Journey
25. Settings
26. Help / Ticket
27. Success / Completed
28. Attention / Needs Action
29. Pending Review
30. Rejected / Failed
31. Call
32. WhatsApp

Recommended deliverable: **32-icon master pack**.

Each icon should have:
- line/outline master;
- optional filled/active variant where needed;
- transparent background;
- SVG master;
- 1x/2x/3x raster exports only if implementation needs them.

### C. Dashboard quick-action tiles

Create branded quick-action visuals for:
1. New Policy Intake
2. Customers
3. Policies
4. Claims
5. Renewals
6. Search
7. Support
8. Insights

Each should have:
- icon-only asset;
- soft tile-background version;
- compact variant for smaller layouts.

### D. Product-family tiles

Create small branded tile/illustration sets for:
1. Motor
2. Health
3. Life
4. Commercial
5. Other / General

Optional extension:
6. Fleet
7. Personal Accident
8. Marine / SME

Each family should have its own restrained accent while remaining clearly INSUREIT.

### E. Ticker / live-insight micro-icons

Create 10 compact ticker icons:
1. Renewal due
2. Claim alert
3. Premium growth
4. New customer
5. Policy issued
6. Document pending
7. Support update
8. Payout update
9. Opportunity
10. Insurer / product update

These must remain legible around 14–18 px rendered size.

### F. Branded banner system

Create a reusable banner visual family rather than unrelated one-off artwork.

#### Growth / business
1. Grow your business this month
2. Renewal opportunity
3. Cross-sell opportunity
4. Customer retention / portfolio protection

#### Operational
5. Complete pending Policy Intake
6. Claims requiring attention
7. Missing documents follow-up
8. Operations status update

#### Learning / knowledge
9. Product knowledge
10. Claims-assistance tips
11. Documentation best practices
12. Partner learning / academy

#### Recognition / impact
13. Your impact this month
14. Partner milestone / achievement
15. Premium growth / portfolio milestone

Produce **8–12 final banners first**, with a system scalable to 15+.

For each selected banner concept, export:
- wide dashboard banner;
- compact inline banner;
- carousel banner;
- artwork-only version where useful.

### G. Empty-state illustration pack

Create branded illustrations for:
1. No Policies
2. No Claims
3. No Renewals
4. No Customers
5. No Notifications
6. No Search Results
7. No Policy Intake History
8. No Documents
9. No Support Tickets
10. Offline / Refresh Failed
11. No Data in Selected Date Range
12. No Opportunities

Style:
- optimistic, professional, modern;
- simple enough for mobile;
- clearly INSUREIT;
- no childish mascots;
- no stock vector appearance.

### H. Notification / alert visual pack

Create compact category visuals for:
1. Policy issued
2. Renewal reminder
3. Claim update
4. Claim needs attention
5. Document required
6. Business insight
7. Support reply
8. Operations/system announcement

Also define visual treatment for:
- success;
- warning;
- error;
- information;
- pending review;
- completed;
- rejected.

### I. Profile / More / Settings assets

Create:
1. Default profile avatar placeholder
2. Business-partner avatar placeholder
3. Profile header background / texture
4. Profile-completion visual

Utility icons:
5. Account
6. Business profile
7. Notifications
8. Help & Support
9. Documents
10. About INSUREIT
11. App Info / Update
12. Logout

### J. Support assets

Create:
1. Call Support
2. WhatsApp Support
3. Raise Ticket
4. FAQ / Help
5. Support empty state
6. Ticket resolved
7. Ticket pending / waiting

### K. Policy Intake / transactional illustrations

Create:
1. Upload policy copy
2. File selected
3. Submission success
4. Under Operations review
5. Correction / replacement required
6. Missing information
7. Document verification

### L. Insight / analytics micro-graphics

Create lightweight visual motifs for:
1. Premium growth
2. Portfolio mix
3. Renewals due
4. Claims trend
5. Customer growth
6. Conversion / success rate

These should support numbers, not compete with them.

### M. Campaign / promotional artwork

Create a reusable campaign language for:
1. Monthly business campaign
2. Motor renewal season
3. Health awareness / cross-sell
4. Claims assistance
5. Portfolio growth
6. Product spotlight

### N. Optional motion assets

Defer until static system is approved.

Potential Lottie/motion concepts:
1. Loading
2. Success
3. Upload progress
4. Empty-state subtle loop
5. Notification pulse
6. Ticker accent
7. Achievement confirmation

Motion must remain restrained and operationally appropriate.

## 5. Recommended production priority

### Batch 1 — identity and reusable system
1. 32-icon INSUREIT Partner master pack
2. 8 quick-action tiles
3. 5 product-family tiles
4. ticker micro-icon pack
5. banner visual template system

### Batch 2 — high-impact branded content
6. 8–12 branded banners
7. 12 empty-state illustrations
8. notification / alert visual pack
9. profile/settings/support asset pack

### Batch 3 — transactional and insight polish
10. Policy Intake illustrations
11. analytics micro-graphics
12. campaign artwork

### Batch 4 — native/store and motion
13. final native app-icon exports at native-build stage
14. store-listing graphic exports
15. motion/Lottie assets after static UAT

## 6. File naming convention

Use predictable lowercase kebab-case.

Examples:
- `partner-icon-renewals.svg`
- `partner-icon-claim-attention.svg`
- `partner-quick-action-policy-intake.svg`
- `partner-product-motor.svg`
- `partner-ticker-premium-growth.svg`
- `partner-banner-renewal-opportunity.webp`
- `partner-empty-no-claims.svg`
- `partner-notification-document-required.svg`

Keep source masters separate from app-optimized exports.

## 7. Technical output guidance

### Icons
- master: SVG;
- transparent background;
- stroke-safe at small size;
- avoid embedded fonts.

### Illustrations
- SVG preferred where practical;
- WebP/PNG for complex artwork;
- transparent background unless the composition intentionally owns its surface.

### Banners
- high-resolution master;
- WebP for app use;
- keep text out of artwork when possible so copy remains accessible/localizable and editable in code.

### Native app/store icon
- 1024x1024 master;
- final Android/iOS derivative exports only during the explicitly approved native-build/store-prep stage.

## 8. Implementation rules for the app

When integrating these assets:
- do not replace every existing system icon automatically;
- prioritize Home, More/Profile, Settings, Notifications, Empty States, Support and branded lifecycle surfaces first;
- keep dense Policies/Claims/Customers/Renewals rows mostly Kite-like and restrained;
- use custom art to create hierarchy, not visual noise;
- keep 48 px effective touch targets even when visible icons are smaller;
- preserve current Partner-scoped data/RPC/auth behavior;
- no backend/schema/RLS changes are implied by this brand phase.

## 9. Dashboard target composition

The planned branded Home composition is:

1. Header / Partner identity
2. Live ticker / insight rail
3. Business Snapshot
4. Branded Quick Actions
5. Priority / Opportunity layer
6. Business by Product
7. Smart Insights
8. One branded INSUREIT update/banner
9. Your Impact
10. Stories / Learning / Campaign

This structure is the current target, subject to real-device iteration after assets are integrated.

## 10. Handoff / continuity requirement

The user explicitly requested that this work be continuously documented so a new chat/agent can resume without reconstructing decisions.

Every material Partner Brand Experience change must record:
- date;
- branch/PR;
- exact head and merge commit;
- files/components/assets changed;
- CI evidence;
- OTA evidence;
- device-validation status;
- native-build status;
- next planned step;
- any asset still awaiting generation/approval.

Do not claim an asset is generated, integrated, deployed, or device-validated without direct evidence.
