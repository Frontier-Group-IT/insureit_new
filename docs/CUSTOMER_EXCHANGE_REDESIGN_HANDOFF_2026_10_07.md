# Customer Exchange Redesign Handoff — 2026-10-07

## Status

The existing Customer Exchange backend foundation is retained. The current Customer app Exchange UI is **not accepted as the target design** and should be treated as a functional backend-connected prototype.

The redesign direction was approved on 2026-10-07 after reviewing 43 current CarDekho mobile screenshots supplied by the owner and the existing Exchange implementation in `apps/mobile-app/app/customer/exchange.tsx`.

Do **not** revert the live Exchange backend or migrations simply because the UI is being redesigned.

## Existing backend foundation to preserve

Current Customer Exchange backend capabilities already implemented and merged:
- live marketplace feed
- customer favourites
- seller fleet selection
- persistent listing drafts
- private photo uploads
- listing submission/review
- buyer offers/bids
- managed contact requests without exposing phone numbers
- seller bid book / leading bid acceptance
- buyer deal confirmation
- My Exchange activity
- private `exchange-media` storage
- Customer runtime remains 0.3.0
- no APK/AAB required for redesign unless explicitly requested

Relevant previous Exchange PRs:
- #2846 first visual draft
- #2847 premium UX
- #2848 backend foundation
- #2849 live backend integration
- #2850 Exchange schema deployment gate
- #2851 explicit exclusion of unrelated migration 20261006110000 from portal parity
- #2852 skip Vercel hook for non-web releases

## Product decision

Exchange must evolve from an auction-dashboard style experience into a commercial-vehicle marketplace.

Target positioning:

> **InsureIT Exchange — Buy, sell and discover verified commercial vehicles.**

Primary user intents:
1. Buy
2. Sell
3. Value
4. My Exchange

Auction/bidding is one transaction method, not the identity of the product.

## Design principles derived from the approved reference study

Use the strongest CarDekho interaction patterns without copying its branding or consumer-car content:
- search-first marketplace entry
- location-aware discovery
- clean white commerce UI
- photography-first vehicle cards
- horizontal quick filters
- progressive disclosure instead of dashboard density
- strong price confidence / valuation language
- seller trust profile
- structured vehicle inspection and document status
- easy sell journey starting from registration / known vehicle
- recommendations, similar vehicles and budget discovery
- sticky actions on vehicle detail

InsureIT-specific differentiation:
- commercial-vehicle fields rather than passenger-car fields
- fleet-aware selling
- RC / insurance / fitness / permit / PUC / hypothecation context
- GVW, payload, axle, body type, wheelbase, emission standard
- operating hours and attachments for construction equipment
- managed contact privacy
- eventual Vehicle Health Report
- commercial vehicle valuation
- eventual finance and replacement intelligence

## Proposed information architecture

```text
EXCHANGE
│
├── Home
│   ├── Search
│   ├── Location
│   ├── Vehicle categories
│   ├── Buy / Sell / Value / My Exchange shortcuts
│   ├── Recommended
│   ├── Recently Added
│   ├── Near You
│   └── By Budget
│
├── Search / Inventory
│   ├── Filters
│   ├── Sort
│   ├── Saved search
│   └── Vehicle cards
│
├── Vehicle Detail
│   ├── Gallery
│   ├── Price / transaction method
│   ├── InsureIT Insight
│   ├── Market value
│   ├── Commercial specifications
│   ├── Vehicle Health Report
│   ├── Documents
│   ├── Seller profile
│   ├── Finance
│   └── Similar vehicles
│
├── Sell
│   ├── Select fleet vehicle / add another vehicle
│   ├── Valuation
│   ├── Condition
│   ├── Guided photos
│   ├── Expected price
│   ├── Fixed / Negotiable / Auction
│   ├── Preview
│   └── Verification
│
└── My Exchange
    ├── Buying
    ├── Selling
    ├── Saved
    └── Deals
```

## UX decisions

### Home
- white/minimal header
- location control
- prominent search: “Search trucks, tippers, buses, JCB...”
- visual categories: Truck, Tipper, Pickup, Bus, Construction, Other
- four primary shortcuts: Buy a Vehicle, Sell a Vehicle, Check Value, My Exchange
- recommendation sections should be commerce-oriented, not editorial/news-heavy

### Inventory cards
Primary hierarchy:
1. large vehicle photo
2. year + manufacturer/model
3. km / fuel / ownership
4. commercial field such as body/GVW
5. location
6. asking price
7. small trust indicators
8. single clear action

Avoid showing auction/bid details unless the listing uses auction mode.

### Vehicle detail
Must become a dedicated full-screen route, not a large modal.

Target sections:
- image gallery
- vehicle identity
- price
- transaction action
- InsureIT Insight
- market price band
- specifications
- Vehicle Health Report
- documents
- seller profile
- finance
- similar vehicles
- sticky bottom CTA

### Transaction modes
Support three modes over time:
- fixed price
- negotiable / make offer
- auction / live bid

### Seller flow
Preferred order:
1. select vehicle from customer fleet
2. auto-fill known vehicle data
3. estimated market value
4. condition
5. guided photos
6. expected price
7. sale method
8. preview
9. submit for verification

Do not ask the user to re-enter make/model/year/category when the data already exists in My Fleet.

### Guided photos
Suggested commercial-vehicle sequence:
- front
- rear
- driver side
- passenger side
- cabin
- tyres
- odometer
- engine

Construction equipment can use:
- front
- rear
- cabin
- engine
- tyres/tracks
- boom/arm
- attachment
- hour meter

### My Exchange
Replace generic activity with:
- Buying
- Selling
- Saved
- Deals

## Phased implementation plan

### Phase 0 — Product / code foundation
- refactor the current ~2,300-line Exchange screen into routes/components
- preserve backend contracts
- no visual rollout until mockups are approved
- suggested structure:
  - `exchange/index.tsx`
  - `exchange/search.tsx`
  - `exchange/vehicle/[id].tsx`
  - `exchange/sell/*`
  - `exchange/my-exchange.tsx`
  - `components/exchange/*`

### Phase 1 — Exchange Home + Inventory
- new home
- location + search
- commercial categories
- Buy / Sell / Value / My Exchange shortcuts
- recommended / recent / near you / budget sections
- inventory route
- quick filters
- full filter sheet
- sort
- redesigned listing card
- favourites

### Phase 2 — Vehicle Detail 2.0
- full-screen detail route
- gallery
- simplified price/identity
- commercial specs
- seller card
- verification indicators
- InsureIT Insight
- market price indicator
- similar vehicles
- sticky action

### Phase 3 — Seller Journey 2.0
- fleet vehicle selection
- auto-filled data
- guided condition
- guided photos
- valuation
- expected price
- transaction mode
- listing preview
- drafts
- review status

### Phase 4 — Vehicle Health & Trust
- RC
- insurance
- fitness
- permit
- PUC
- ownership
- finance/hypothecation
- challan
- photo/mechanical inspection
- verification source
- consolidated Vehicle Health Report

### Phase 5 — Offers, Bidding & Deal Room
- make offer
- counter-offer
- optional live bidding
- outbid alerts
- seller offer comparison
- accept/reject/counter
- managed buyer/seller connection
- deal lifecycle

### Phase 6 — Valuation Engine
Start deterministic/comparable-based, then improve with:
- make/model
- age
- km
- ownership
- location
- condition
- comparable listings
- accepted/rejected offers
- final deal price
- time-to-sell

### Phase 7 — Comparison + Finance
- compare 2–3 commercial vehicles
- EMI calculator
- finance eligibility
- loan enquiry
- down-payment / tenure modelling

### Phase 8 — Marketplace intelligence
Only after sufficient data:
- recommended for you
- good price / below market
- high demand
- price reduced
- similar vehicle sold
- replacement suggestions
- richer AI-generated interpretations

## Priority

P0:
- Home
- inventory/search
- listing cards
- Vehicle Detail 2.0

P1:
- sell journey
- Vehicle Health Report
- valuation

P2:
- offers/deal room
- comparison
- finance

P3:
- recommendation/AI layer

## Current design review finding

The current UI is considered too:
- auction-heavy
- dashboard-like
- visually dense
- badge-heavy
- concept-first instead of intent-first

The redesign should move toward:
- white / spacious
- photography-first
- commerce-oriented
- information rich but progressively disclosed
- InsureIT navy for primary actions
- green for verification / good price
- orange for offers / bidding / attention
- red for risk / expired / outbid

## Mockup milestone

Before implementation, create and review the following first mockup set:
1. Exchange Home
2. Search / Inventory
3. Vehicle Detail
4. Sell Vehicle

Implementation should begin only after these visual directions are accepted.

## Governance

- use separate reversible branches/PRs
- run canonical GitHub checks before merge
- do not merge implementation PRs before owner approval unless explicitly asked
- OTA-first for Customer app
- **DO NOT create APK/AAB unless explicitly requested**
- preserve Customer runtime compatibility unless a native dependency/runtime change is intentionally approved


## Implementation progress — R1 started 2026-10-07

Implementation branch:
- `feature/customer-exchange-marketplace-r1-2026-10-07`

### Completed in this implementation slice

Phase 0 / Phase 1 foundation has started without changing the Exchange backend contracts.

New component:
- `apps/mobile-app/components/exchange/ExchangeMarketplaceHome.tsx`

Updated integration:
- `apps/mobile-app/app/customer/exchange.tsx`

Implemented:
- separated the Buy/Explore experience from the large Exchange screen into a reusable marketplace component
- replaced the auction-dashboard-first default presentation with a commerce/discovery-first marketplace
- search remains connected to live Exchange data
- commercial vehicle categories remain connected to live filtering
- added Buy a Vehicle / Sell a Vehicle / Check Value / My Exchange intent cards
- added featured live vehicle rail
- added simplified photography-first inventory cards
- asking price is primary
- offer/bid information is only shown when a listing actually has bids
- added budget filtering
- added sorting by recommended / price / newest
- added a bottom-sheet filter interface
- changed the default Explore header from the old dark auction/dashboard treatment to a clean white marketplace header
- removed the redundant internal Explore/Sell/My Exchange tab strip from the marketplace home; Sell and My Exchange remain accessible as clear intent actions, while the legacy strip remains on those deeper flows during the staged migration
- retained favourites
- retained pull-to-refresh
- retained existing seller, activity, bid, contact, draft and deal backend flows
- no database migration in this slice
- no native dependency added
- no runtime change
- no APK/AAB

### Important R1 limitations / next work

This first implementation slice deliberately does **not** pretend the remaining phases are complete.

Still pending:
- dedicated Search/Inventory route instead of home + inventory on one scroll
- Make/Model/Year/Location advanced filters backed by real fields
- dedicated full-screen Vehicle Detail 2.0 route
- actual valuation engine and value route; current Check Value entry leads into the existing seller journey pending Phase 3
- seller profile redesign
- Vehicle Health Report
- guided seller photo capture
- Fixed / Negotiable / Auction listing modes
- Buying / Selling / Saved / Deals transaction centre
- comparison
- finance
- marketplace intelligence

### Next implementation sequence

1. validate R1 with canonical mobile + web checks
2. review the new Home/Inventory direction on device/preview
3. Phase 2: dedicated Vehicle Detail 2.0
4. Phase 3: seller journey + valuation foundation
5. continue updating this handoff after each implementation slice


## Phase 2 implementation progress — 2026-10-07

A dedicated full-screen vehicle detail route has now been added:

- `apps/mobile-app/app/customer/exchange/[listingId].tsx`

Marketplace and My Exchange vehicle actions now route to this dedicated page instead of opening the old detail modal.

Implemented in Vehicle Detail 2.0:
- clean white full-screen detail header
- live listing fetch by Exchange listing id using the existing marketplace service
- large vehicle image area with safe fallback when listing media is unavailable
- favourite action
- vehicle identity, odometer, fuel, ownership and location
- asking price as the primary commercial signal
- explicit verification state; no fabricated “fair price” calculation
- deterministic InsureIT Insight using only fields the backend actually supports
- commercial vehicle key specifications
- trust / health summary for owner verification, documents, inspection, tyre condition, permit and finance
- seller privacy / verified-owner card
- private Make Offer experience for non-active-bid listings, reusing the existing secure bid/offer primitive
- live-bid context only when the listing already has bids
- managed callback
- similar vehicles from the same category
- sticky Callback / Make Offer or Place Bid transaction bar
- pull-to-refresh
- no database change
- no native dependency
- no runtime change
- no APK/AAB

### Important Phase 2 data discipline

The redesigned detail page does **not** invent unsupported marketplace data.

Until Phase 3/4 backend work exists:
- no fake market valuation range
- no fake seller name/history
- no fake RC / fitness / PUC / challan status
- no fake GVW / payload / axle / wheelbase
- no fake mechanical inspection fields

Only current Exchange feed fields are presented as verified facts. Missing capabilities remain clearly labelled as future phases.

### Phase 2 follow-up

The legacy `VehicleDetailModal` and its duplicate bid/contact handlers have now been removed from `exchange.tsx` after the dedicated route passed mobile typecheck/lint and Exchange backend regression checks. The dedicated `/customer/exchange/[listingId]` route is now the single Customer Exchange vehicle-detail implementation.


## Phase 3 seller journey progress — 2026-10-07

New modular seller component:
- `apps/mobile-app/components/exchange/ExchangeSellJourney.tsx`

The old all-at-once Sell form in `exchange.tsx` has been replaced by a guided four-step seller journey while preserving the existing listing draft, photo upload and preview/submit backend actions.

Current guided flow:
1. Vehicle
   - select an eligible vehicle directly from My Fleet
   - active listings remain locked
   - customer/account ownership constraints remain unchanged
2. Details
   - registration / make-model / year remain auto-filled from fleet
   - enter current odometer
   - choose commercial category
   - enter expected selling price
   - valuation area explicitly states that a real market valuation is not available yet
3. Photos
   - guided ordered photo list
   - uploaded count
   - existing private Exchange media upload path is retained
   - each slot reports upload completion
4. Review
   - compact listing summary
   - privacy explanation
   - save draft
   - open existing listing preview before submission

Important:
- no fake valuation range is shown
- no manual vehicle creation was silently introduced; current phase remains fleet-first
- no transaction-mode schema change yet
- existing submit-for-review behavior remains
- no database migration
- no native dependency
- no runtime change
- no APK/AAB

### Phase 3 next backend/product slice

The next seller work should add the real foundations required by the approved plan rather than simulating them in UI:
- valuation input/output model
- Fixed / Negotiable / Auction transaction mode
- richer commercial condition attributes
- construction-equipment-specific condition fields where applicable
- guided camera capture improvements
- optional manual/add-another-vehicle path with correct ownership verification


## Cleanup checkpoint — 2026-10-07

After the dedicated Vehicle Detail 2.0 route passed the important mobile gates, the old modal implementation was removed from `apps/mobile-app/app/customer/exchange.tsx`.

Removed:
- legacy `VehicleDetailModal`
- duplicate modal-only bid handler
- duplicate modal-only managed-contact handler
- selected-vehicle modal state / refresh synchronization

This reduces duplicate transaction logic and prevents future work from accidentally modifying the obsolete detail screen.


## Regression update — 2026-10-07

After removing the obsolete detail modal, the Customer Exchange regression initially failed because the test still required `placeExchangeBid` and `requestExchangeContact` to exist inside the legacy `exchange.tsx` file.

The product code was correct; the regression assumption was stale.

Updated:
- `apps/mobile-app/scripts/customer-exchange-live-backend-regression.mjs`

The regression now validates the modular architecture across:
- `app/customer/exchange.tsx`
- `app/customer/exchange/[listingId].tsx`
- `components/exchange/ExchangeMarketplaceHome.tsx`
- `components/exchange/ExchangeSellJourney.tsx`
- `lib/exchange.ts`

It also explicitly checks that:
- the main screen uses the marketplace home component
- the main screen uses the guided seller component
- listing taps route to the dedicated detail route
- bidding and managed contact exist on the detail route
- live Exchange service/RPC contracts remain present
- local/demo marketplace data remains forbidden


## Recovery checkpoint and phase matrix — 2026-10-07

This section was added after the implementation chat stalled, so a future agent can resume from the exact state without replaying earlier work.

### Current PR / branch
- PR: #2883 — Customer Exchange marketplace redesign R1
- Branch: `feature/customer-exchange-marketplace-r1-2026-10-07`
- Keep PR open and reversible until owner approves merge.
- No OTA has been published from this redesign branch.
- No APK/AAB has been created.

### Phase completion status

#### Phase 0 — Product / code foundation: MOSTLY COMPLETE
Done:
- marketplace home extracted into `components/exchange/ExchangeMarketplaceHome.tsx`
- seller journey extracted into `components/exchange/ExchangeSellJourney.tsx`
- vehicle detail moved to dedicated `app/customer/exchange/[listingId].tsx`
- obsolete detail modal and duplicate transaction handlers removed
- Exchange regression updated for modular architecture

Still desirable later:
- split the remaining `exchange.tsx` activity/preview code into dedicated route/components
- dedicated search route rather than all inventory remaining on Exchange Home

#### Phase 1 — Exchange Home + Inventory: PARTIALLY COMPLETE
Done:
- white marketplace-first header
- live search
- commercial categories
- Buy / Sell / Value / My Exchange intent cards
- featured inventory
- photography-first vehicle cards
- favourites
- budget filters
- basic sort
- filter bottom sheet
- auction information no longer dominates normal listings

Still pending:
- dedicated Search / Inventory route
- real Make/Model/Year/Location advanced filters
- saved searches
- real Near You / location radius logic
- intentional Recommended / Recently Added / By Budget sections based on data rather than simple feed slicing

#### Phase 2 — Vehicle Detail 2.0: CORE COMPLETE
Done:
- dedicated full-screen detail route
- live listing lookup
- cover image / safe fallback
- favourite
- identity / odometer / fuel / ownership / location
- asking price
- verified-data-only InsureIT Insight
- commercial summary specs
- trust / health summary using existing fields
- seller privacy card
- managed callback
- similar vehicles
- sticky actions
- fixed / offers / auction behavior now driven by the real listing selling mode

Still pending:
- full media gallery rather than cover-only presentation
- richer commercial specs (GVW / payload / axle / wheelbase / body / emission)
- dedicated documents section
- richer seller profile/history
- true market value band
- finance section

#### Phase 3 — Seller Journey 2.0: CORE UX COMPLETE / BACKEND ENHANCEMENT IN PROGRESS
Done:
- four-step Vehicle → Details → Photos → Review flow
- My Fleet vehicle selection
- known identity auto-fill
- odometer
- commercial category
- expected selling price
- guided photo slots using existing private Exchange media
- review / draft / existing submit-for-review flow
- explicit no-fake-valuation behavior

New selling-mode implementation:
- confirmed `exchange_listings.selling_mode` already exists in production schema design
- migration `20261007125600_customer_exchange_selling_modes.sql` exposes the existing field safely through customer RPCs
- supported modes:
  - `fixed_price` → Fixed price
  - `open_bidding` → Open to offers
  - `managed_auction` → Managed auction
- service layer now persists `p_selling_mode`
- seller UI now lets the owner choose the mode
- marketplace cards render mode contextually
- vehicle detail uses mode-specific CTAs
- fixed-price listings do not expose offer/bid controls
- `exchange_place_bid` rejects fixed-price listings
- My Exchange activity RPC now includes selling mode
- dedicated schema workflow and production deployment gate updated for the new migration

Still pending in Phase 3:
- richer condition form
- construction-equipment-specific condition fields
- camera-first guided capture rather than gallery-only picker
- optional “Add another vehicle” path with correct ownership/verification
- true valuation engine

#### Phase 4 — Vehicle Health & Trust: PARTIAL UI ONLY
Existing fields currently surfaced:
- owner verification
- document verification
- inspection completion/score
- tyre condition
- permit summary
- finance summary

Still pending backend/product work:
- RC status/detail
- insurance status
- fitness
- PUC
- permit detail/expiry
- hypothecation
- challan
- mechanical inspection categories
- verification source and verification timestamps
- consolidated full Vehicle Health Report

#### Phase 5 — Offers, Bidding & Deal Room: FOUNDATION EXISTS / REDESIGN PENDING
Existing backend already supports:
- offers/bids
- seller leading-bid review
- leading-bid acceptance
- managed contact requests
- buyer deal confirmation
- deals/activity

Selling modes now make the transaction behavior clearer.

Still pending:
- counter-offer
- explicit accept/reject for non-auction private offers
- outbid / offer status UX
- seller offer comparison UI
- richer deal lifecycle screen
- deal room
- transactional notifications

#### Phase 6 — Valuation Engine: NOT IMPLEMENTED
Do not display fabricated valuation ranges.
Needed:
- comparable listing model
- make/model/age/km/location/ownership/condition inputs
- valuation range and confidence
- later: accepted/rejected offers, sold price and time-to-sell feedback loop

#### Phase 7 — Comparison + Finance: NOT IMPLEMENTED
Pending:
- compare 2–3 vehicles
- EMI calculator
- finance eligibility/enquiry
- down payment / tenure modelling

#### Phase 8 — Marketplace intelligence: NOT IMPLEMENTED
Pending until meaningful marketplace data exists:
- personalized recommendations
- good-price / high-demand signals
- price-drop alerts
- similar sold vehicle insights
- replacement suggestions
- AI interpretation layer

### Next implementation order from this checkpoint
1. make the selling-mode slice fully green in canonical CI
2. Phase 4 foundation: extend Vehicle Health data model only with fields that can be sourced/verified
3. redesign My Exchange into Buying / Selling / Saved / Deals
4. Phase 5 offer/deal lifecycle enhancements
5. valuation foundation
6. advanced inventory/search
7. comparison + finance
8. intelligence layer

### Selling-mode migration / release governance
New migration:
- `supabase/migrations/20261007125600_customer_exchange_selling_modes.sql`

Updated schema workflow:
- `.github/workflows/apply-customer-exchange-marketplace-backend.yml`

Updated deployment gate:
- `.github/workflows/deploy-production.yml`

The migration preserves old-client compatibility by keeping the same RPC names and making the new draft parameter optional. The marketplace feed keeps the same input signature and adds `selling_mode` to returned data.

The Exchange RPCs remain `SECURITY DEFINER` because the existing architecture intentionally uses ownership-checked customer RPCs instead of direct table grants. Every changed function retains explicit `auth.uid()` / customer-access checks, pinned search path, PUBLIC execute revocation and authenticated-only execute grants.


## Phase 4 authoritative Vehicle Health foundation — 2026-10-07

A production schema audit confirmed that the core vehicle/fleet tables already contain many of the commercial health fields the redesign needs. We are therefore reusing the existing vehicle and policy records instead of duplicating them in Exchange.

Authoritative existing sources confirmed:
- `vehicles.registration_status`
- `vehicles.registration_status_as_on`
- `vehicles.registration_date`
- `vehicles.fitness_expiry_date`
- `vehicles.puc_expiry_date`
- `vehicles.road_tax_expiry_date`
- `vehicles.permit_type`
- `vehicles.permit_valid_from`
- `vehicles.national_permit_expiry_date`
- `vehicles.local_permit_expiry_date`
- `vehicles.gvw_kg`
- `vehicles.unladen_weight_kg`
- `vehicles.wheel_base_mm`
- `vehicles.body_type`
- `vehicles.engine_capacity_cc`
- `vehicles.emission_norm`
- `vehicles.financed`
- `vehicles.financer_name`
- `vehicles.blacklist_status`
- `vehicles.authbridge_verified`
- `vehicles.authbridge_last_verified_at`
- linked policy validity from `policies` and `external_policies`

Added in the same pending migration `20261007125600_customer_exchange_selling_modes.sql`:
- `exchange_listing_detail(p_listing_id uuid)`
- authenticated-only / PUBLIC execute revoked
- live/deal listings are available to authenticated marketplace users
- non-live listings remain seller/customer scoped
- does not expose chassis/engine numbers or unmasked registration
- returns technical/compliance fields plus latest linked insurance validity

Service layer:
- added `getExchangeListingDetail`
- added typed `ExchangeListingDetail`

Vehicle Detail 2.0 now consumes this RPC opportunistically:
- if the pending migration is unavailable in a preview environment, the existing listing detail remains usable
- once the schema migration is deployed, the page adds:
  - AuthBridge/RC verification state
  - insurance validity + insurer
  - fitness validity
  - PUC validity
  - road-tax validity
  - permit type/expiry
  - blacklist field when available
  - finance/financer state
  - GVW
  - body type
  - wheelbase
  - emission norm

No fabricated health values are introduced.

Still pending for full Phase 4:
- proper standalone Vehicle Health Report screen/expandable section
- verified source/timestamp presentation per field
- inspection categories (engine, gearbox, clutch, brakes, suspension, body)
- challan integration/source
- richer permit semantics
- explicit RC document/registration detail policy


## My Exchange transaction centre — 2026-10-07

New component:
- `apps/mobile-app/components/exchange/ExchangeActivityCenter.tsx`

The previous long mixed activity feed has been replaced by the planned four-tab transaction centre:

### Buying
- private offers / bids
- current status
- managed buyer contact requests
- direct navigation back to the listing

### Selling
- seller listings
- selling mode (Fixed price / Open to offers / Auction)
- asking price
- buyer offer/bid count
- offer/bid review action
- buyer contact requests with Accept / Decline

### Saved
- favourites / shortlist
- asking price
- selling-mode context
- direct listing navigation

### Deals
- buying/selling side
- agreed value
- lifecycle status
- buyer confirmation when seller has accepted

The new component uses only the existing `exchange_my_activity` payload; no additional schema was required beyond the pending selling-mode payload enhancement.

The old `ActivityExperience`, `ActivitySection` and associated mixed-feed code were removed from `exchange.tsx`.

### Phase 5 status after this change
The My Exchange information architecture is now substantially aligned with the plan, but full Deal Room work is still pending:
- counter-offers
- explicit reject/counter actions for private offers
- richer seller offer comparison
- outbid/offer notifications
- inspection/payment/handover/RC-transfer task UI
- deal-specific conversation/support history


## Phase 5 seller offer review UX — 2026-10-07

New component:
- `apps/mobile-app/components/exchange/ExchangeOfferReviewSheet.tsx`

The old one-line Alert-based seller bid review has been replaced with a proper bottom-sheet review experience.

Implemented:
- loads the existing seller bid/offer book
- shows all recorded buyer responses returned by `exchange_seller_bid_book`
- highlights the current leading/best response
- uses selling-mode-aware language:
  - Open to offers → “Best offer” / “Accept best offer”
  - Managed auction → “Leading” / “Accept leading bid”
- buyer alias remains masked
- seller can accept the current leading/best response through the existing `exchange_accept_leading_bid` backend action
- accepting refreshes Exchange activity and moves the transaction into the existing deal flow
- fixed-price listings do not expose this review action

Still pending for full Phase 5:
- true independent private offers rather than the current leading/outbid bid-book model
- counter-offers
- explicit seller rejection of an individual offer
- buyer withdrawal
- offer expiry
- richer deal-room milestones and transactional notifications

Important architecture note:
The current `exchange_bids` data model still treats buyer responses as a ranked/leading sequence. The UI now uses offer terminology for `open_bidding`, but a future counter-offer implementation should not be bolted on blindly. Review whether private offers deserve a dedicated offer model or a controlled evolution of `exchange_bids` before changing transaction semantics.


## Dedicated Search / Inventory route — 2026-10-07

New route:
- `apps/mobile-app/app/customer/exchange/search.tsx`

Home integration:
- Buy a Vehicle now opens the dedicated inventory screen.
- Featured Vehicles → View all opens the dedicated inventory screen.
- A clear Browse all vehicles action is available from Exchange Home.

Implemented using live Exchange feed data:
- free-text search
- category filter
- manufacturer filter
- model filter
- year filter
- city/state location filter
- budget filter
- sort by recommended / price low / price high / newest model year
- favourites
- vehicle-detail navigation
- selling-mode-aware cards
- document/owner verification signal
- pull-to-refresh
- clear-all filters

Important scalability limitation:
The current route loads up to 100 live marketplace rows and performs advanced filtering client-side. This is acceptable for the current marketplace foundation and preserves the existing feed RPC contract, but it is **not** the final large-inventory architecture. Before inventory materially exceeds this range, move make/model/year/location/budget/sort filters into paginated server-side query/RPC inputs and add saved-search persistence.

No database migration was required for this Search route itself.


## Vehicle Detail private media gallery — 2026-10-07

The remaining Phase 2 gallery gap is now implemented using the existing private `exchange-media` architecture.

Backend:
- `exchange_listing_detail(uuid)` now includes ordered listing media metadata from `exchange_listing_media`.
- Media order is cover first, then explicit sort order / creation order.
- The RPC returns metadata only; the bucket remains private.

Mobile service:
- `getExchangeListingDetail` signs each returned private media object with a short-lived URL using the existing authenticated storage policy.

Vehicle Detail 2.0:
- primary image now follows the selected gallery photo
- horizontal photo thumbnails appear when multiple photos exist
- selected thumbnail state is visible
- gallery counter shows current photo / total
- existing cover URL remains a safe fallback while the pending detail RPC is unavailable
- no public bucket or direct permanent media URL was introduced

This completes the core multi-photo buyer research experience without weakening the private-media security model.

Still pending for richer media:
- video preview/playback
- full-screen zoom/lightbox
- image quality moderation


## Standalone Vehicle Health Report — 2026-10-07

New route:
- `apps/mobile-app/app/customer/exchange/health.tsx`

Vehicle Detail now exposes a dedicated **View full Vehicle Health Report** action.

The report is intentionally source-aware and does not invent missing facts.

### Sections
- Identity & RC
  - registration status
  - registration date
  - AuthBridge/source verification
  - AuthBridge last-verified date when present
- Compliance
  - fitness
  - PUC
  - road tax
  - permit type and available permit expiry
- Insurance
  - latest linked internal/external policy validity
  - insurer name when present
- Commercial specifications
  - GVW
  - unladen weight
  - wheelbase
  - body type
  - engine capacity
  - emission norm
- Finance & risk
  - financed / financer
  - blacklist field

### Source labelling
The report explicitly identifies the available source such as:
- AuthBridge verification
- vehicle registry/master record
- InsureIT policy record
- external linked policy record

Missing verification timestamps remain labelled as unavailable instead of being inferred.

### Unsupported data disclosure
The report explicitly states that:
- mechanical inspection categories (engine / gearbox / clutch / brakes / suspension / body) are not shown unless verified inspection data exists
- challan data is not currently connected

This completes the core Phase 4 consolidated Vehicle Health Report using already-authoritative data. Remaining Phase 4 work is deeper inspection capture/source integration rather than UI placeholders.


## Phase 5 managed Deal Room foundation — 2026-10-07

New customer route:
- `apps/mobile-app/app/customer/exchange/deal.tsx`

New participant-only RPC:
- `exchange_deal_detail(p_deal_id uuid)`

### Security / privacy contract
- authenticated user required
- caller must have access to either the buyer customer or seller customer attached to the deal
- no buyer/seller customer IDs or private contact details are returned
- full registration remains masked
- internal `staff_notes` are not returned
- PUBLIC execute revoked; authenticated execute granted

### Deal detail payload
- deal / listing identifiers
- vehicle title, make, model, year and masked registration
- selling mode
- buyer/seller side
- agreed value
- current deal status
- created timestamp
- buyer confirmation timestamp
- inspection completion timestamp
- payment confirmation timestamp
- handover completion timestamp
- RC-transfer completion timestamp
- completion/cancellation timestamp and cancellation reason when applicable

### Customer Deal Room UX
My Exchange → Deals now opens the dedicated lifecycle screen.

The screen:
- distinguishes Buying vs Selling
- shows agreed value and current lifecycle status
- lets a buyer confirm when the seller has accepted
- displays the managed progression:
  1. Seller accepted
  2. Buyer confirmed
  3. Inspection
  4. Inspection complete
  5. Payment
  6. Payment confirmed / handover next
  7. Vehicle handed over / RC transfer next
  8. RC transfer complete
- marks a milestone complete only when the existing workflow/status/timestamp supports it
- surfaces cancelled/disputed states separately
- links back to the vehicle listing
- explains Exchange privacy and managed-transaction safeguards

Still pending for full Deal Room:
- buyer withdrawal
- seller rejection of private offers
- counter-offer negotiation
- transactional notifications
- deal conversation/support history
- customer-facing staff appointment / payment / handover scheduling details

The existing staff workflow remains authoritative for inspection/payment/handover/RC-transfer progression. This change does not let customers mutate staff-managed milestones.


## Phase 5 private-offer withdrawal / rejection — 2026-10-07

The existing `exchange_bids` model is still used for both auctions and private offers, but the new behavior is deliberately restricted to `selling_mode = 'open_bidding'` so managed auctions are not altered.

New authenticated RPCs:
- `exchange_withdraw_offer(p_bid_id uuid)`
- `exchange_reject_leading_offer(p_listing_id uuid)`

### Buyer withdrawal
- only the buyer who owns the private offer can withdraw it
- listing must still be live
- managed-auction bids cannot be withdrawn through this action
- accepted/rejected/withdrawn offers cannot be withdrawn again
- if the withdrawn offer was the current leading offer, the next-highest prior `outbid` private offer is promoted to `leading`
- if none remains, `highest_bid_id` is cleared and `current_bid` returns to 0
- activity event: `offer_withdrawn`

My Exchange → Buying now shows **WITHDRAW** only for active `open_bidding` offers.

### Seller rejection
- only the listing seller can reject the current leading private offer
- listing must still be live
- only `open_bidding` listings are eligible
- managed auctions retain their existing leading-bid behavior
- the rejected leading offer becomes `rejected`
- the next-highest prior `outbid` offer is promoted to `leading`, when one exists
- listing `current_bid` / `highest_bid_id` are updated accordingly
- activity event: `offer_rejected`

The seller offer-review sheet now presents:
- **Reject offer** + **Accept best offer** for private-offer listings
- **Accept leading bid** only for managed auctions

### Still intentionally not implemented
- counter-offer
- free-form negotiation/chat
- auction bid withdrawal
- seller rejection of managed-auction bids

Those behaviors need a separate transaction-design decision and should not be emulated by relabelling the existing bid model.


## Phase 7 comparison foundation — 2026-10-07

New route:
- `apps/mobile-app/app/customer/exchange/compare.tsx`

Search integration:
- each Search result now has a Compare action
- user can select up to 3 vehicles
- sticky comparison bar appears after the first selection
- Compare action activates after at least 2 vehicles are selected

Comparison uses current live Exchange data plus authoritative listing detail data.

### Compared fields

Marketplace:
- asking price
- selling mode
- location
- owner verification
- document verification
- inspection status

Vehicle basics:
- make
- model
- year
- odometer
- fuel
- ownership

Commercial specifications:
- GVW
- unladen weight
- wheelbase
- body type
- engine capacity
- emission norm

Health / compliance:
- RC/AuthBridge verification
- fitness expiry
- PUC expiry
- road-tax expiry
- permit
- finance status

Each comparison column links back to the full vehicle detail screen.

Important:
- missing values stay shown as unavailable / dash
- no generated “winner” or fake scoring is added
- no valuation estimate is inferred
- comparison supports 2–3 vehicles only to preserve mobile readability
- no database migration is required

### Phase 7 remaining
- EMI / finance calculator
- finance enquiry / eligibility integration
- down-payment and tenure scenarios


## Phase 7 finance / EMI estimator — 2026-10-07

New route:
- `apps/mobile-app/app/customer/exchange/finance.tsx`

Vehicle Detail now exposes a compact **EMI** action beside the asking price.

The finance screen:
- starts from the current Exchange asking price
- supports editable down payment
- includes 10% / 20% / 25% / 30% down-payment shortcuts
- supports editable annual interest rate
- supports 12 / 24 / 36 / 48 / 60 month tenure
- calculates:
  - loan amount
  - estimated monthly EMI
  - total interest
  - total loan repayment
- links back to the vehicle detail screen

Important product / compliance behavior:
- the screen explicitly says this is a mathematical estimate only
- it is not represented as a lender quote, eligibility decision or approval
- no lender name, eligibility score or approval probability is fabricated
- taxes, fees, insurance, documentation and lender-specific costs are not silently included
- finance enquiry remains explicitly labelled as **not connected yet**

No backend migration or lender integration is introduced in this slice.

### Phase 7 status after finance
Core comparison + EMI estimation is now implemented.

Still pending:
- real finance enquiry workflow
- lender integration
- actual eligibility rules
- lender-specific rate / fee quotes
- application tracking


## Phase 3 seller condition + camera capture — 2026-10-07

The guided seller journey now captures richer **seller-declared** condition information without pretending it is an InsureIT inspection.

### Seller-declared fields
General:
- overall condition: Excellent / Good / Fair / Needs attention
- estimated tyre condition %
- body condition
- cabin condition
- optional known issues / disclosure

Construction-specific:
- optional operating hours
- hydraulic condition
- undercarriage condition

Persistence:
- structured condition values are stored in the existing `condition_details` JSON
- tyre condition also uses the existing `tyre_condition_percent` field
- `seller_declared: true` is persisted in condition details
- editable draft activity now returns odometer, tyre condition and condition details so draft edits can restore these values

Important separation:
- these fields are seller-provided declarations
- they are not presented as InsureIT-verified mechanical inspection
- verified Vehicle Health / inspection data remains a separate trust layer

### Guided photo capture
Each existing photo slot now offers:
- Camera
- Gallery
- Cancel

Camera path:
- uses installed `expo-image-picker`
- requests camera permission only when Camera is selected
- captures a single guided image
- uploads through the existing private `exchange-media` flow

Gallery path:
- retains the existing media-library permission and picker flow

No new native dependency or APK/AAB is introduced.

### Small correctness fix
The seller odometer / numeric inputs had an existing sanitization typo that removed the letter `D` rather than non-digits. The seller-condition work corrects numeric sanitization to use `/\D/g`.

### Phase 3 remaining after this slice
- optional manual “Add another vehicle” ownership/verification path
- image quality moderation / capture framing assistance
- deeper verified inspection workflow
- valuation remains deferred until real marketplace history exists


## Phase 3 Add another vehicle integration — 2026-10-07

Exchange now reuses the existing Customer Fleet Add Vehicle flow instead of introducing a second marketplace-specific vehicle onboarding form.

Seller journey:
- adds a clear **Add another vehicle** action
- routes to `/customer/add-vehicle?fromExchange=1`

Existing Add Vehicle flow remains authoritative for:
- customer-account selection
- duplicate vehicle checks
- RC lookup
- make/model/year
- chassis / engine handling
- fuel / vehicle class
- compliance dates
- policy linkage
- policy copy upload
- existing fleet ownership/account association

Return behavior:
- when opened from Exchange with `fromExchange=1`, a successful vehicle save returns to `/customer/exchange`
- normal Add Vehicle entry points keep their existing post-save destination

This closes the Phase 3 “Add another vehicle” path without creating duplicate ownership/verification logic.

No new backend schema, native dependency, APK or AAB is introduced.


## Verified implementation checkpoint — 2026-10-07

Current branch head before this documentation commit:
- `47c8e50477f70bfdc1242c7a364164ea85ab31b0`

Canonical verification on that head:
- Verify mobile app: **SUCCESS**
  - mobile typecheck
  - mobile lint
  - Customer Exchange live-backend regression
  - Expo web review export
- Verify web portal: **SUCCESS**
  - regression suite
  - typecheck
  - lint
  - production build

PR:
- #2883 remains **open and unmerged**
- no OTA published from this redesign branch
- no APK/AAB created

### Updated phase status

#### Phase 0 — architecture / modularization: COMPLETE foundation
- modular marketplace home
- modular guided seller journey
- dedicated Search route
- dedicated Vehicle Detail route
- dedicated Vehicle Health route
- dedicated Deal Room route
- modular My Exchange transaction centre
- modular seller offer review
- legacy detail/activity duplicate logic removed
- regression script updated for modular architecture

#### Phase 1 — Home + Inventory: COMPLETE foundation
Implemented:
- marketplace-first Exchange Home
- commercial categories
- search
- featured live inventory
- photography-first cards
- contextual selling-mode signals
- dedicated Search / Inventory route
- make/model/year/location/category/budget filters
- sorting
- favourites
- vehicle-detail routing
- compare selection

Future scale/enhancement:
- saved searches
- server-side paginated advanced filtering once inventory materially exceeds current limits
- location-radius / Near You
- richer recommendation sections once real inventory volume exists

#### Phase 2 — Vehicle Detail 2.0: COMPLETE foundation
Implemented:
- dedicated full-screen route
- private multi-photo gallery with signed URLs
- commercial specs
- source-aware health/trust
- seller privacy
- selling-mode-aware actions
- managed callback
- similar vehicles
- Vehicle Health Report link
- EMI estimator link

Future enhancement:
- full-screen image zoom
- video playback
- richer seller history/profile
- image moderation

#### Phase 3 — Seller Journey 2.0: COMPLETE foundation
Implemented:
- fleet-first Vehicle → Details → Photos → Review
- auto-filled vehicle identity
- odometer / expected price
- Fixed Price / Open to Offers / Managed Auction
- seller-declared overall/body/cabin/tyre/known-issue condition
- construction operating-hours / hydraulic / undercarriage declarations
- Camera or Gallery guided photo capture
- private media upload
- draft / preview / submit
- editable draft condition restoration
- Add another vehicle routed through existing Customer Fleet RC/ownership onboarding and returns to Exchange

Remaining enhancement:
- capture framing / quality moderation
- deeper verified inspection workflow

#### Phase 4 — Vehicle Health & Trust: COMPLETE authoritative-data foundation
Implemented:
- source-aware Vehicle Health Report
- RC/AuthBridge verification
- insurance validity
- fitness
- PUC
- road tax
- permit
- finance
- blacklist
- GVW / unladen weight / wheelbase / body / engine capacity / emission

Not connected yet:
- challan source
- detailed mechanical inspection categories unless a verified source is introduced

#### Phase 5 — Offers / Bidding / Deal Room: COMPLETE foundation
Implemented:
- mode-aware offers/bids
- seller review sheet
- best-offer / leading-bid acceptance
- private-offer withdrawal
- seller rejection of leading private offer
- promotion of next-highest private response
- managed contact
- buyer confirmation
- Buying / Selling / Saved / Deals centre
- participant-only Deal Room
- staff-managed inspection/payment/handover/RC-transfer milestone display

Deliberately pending:
- counter-offers
- free-form negotiation/chat
- auction bid withdrawal
- customer mutation of staff-managed milestones
- transactional notification system
- deal support-history thread

These require an explicit product/backend design rather than relabelling existing bid records.

#### Phase 6 — Valuation Engine: DEFERRED FOR DATA
Production audit on 2026-10-07 found:
- Exchange listings: **0**
- live listings: **0**
- buyer responses/bids: **0**
- deals: **0**
- completed deals: **0**
- deals with agreed price: **0**

Therefore:
- do not generate a fake market-value band
- do not call asking-price heuristics “AI valuation”
- collect real listings/offers/deals first
- design valuation once enough comparable transaction data exists or a trustworthy external valuation source is integrated

#### Phase 7 — Comparison + Finance: COMPLETE foundation
Implemented:
- select 2–3 vehicles from Search
- comparison route
- marketplace/basic/commercial/health comparison fields
- factual missing-value handling
- asking-price-based EMI estimator
- down-payment presets
- editable interest rate
- 12/24/36/48/60 month tenure
- EMI / loan amount / total interest / total repayment
- explicit estimate-only / no-approval disclaimer

Still external:
- lender integrations
- actual finance eligibility
- live quotes / fees
- application workflow

#### Phase 8 — Marketplace intelligence: DEFERRED FOR DATA
Do not implement synthetic demand/price intelligence while production Exchange has no transaction history.

Future triggers:
- meaningful live inventory
- search/favourite/offer behavior
- completed deals / agreed prices
- price changes and time-to-sell history

Only then add:
- personalized recommendations
- high-demand signals
- price-drop alerts
- sold-comparable insights
- replacement suggestions
- AI interpretation grounded in real marketplace evidence

### Recommended next product checkpoint

Before adding more major marketplace features:
1. review PR #2883 visually on a real Customer app/device build via the existing OTA/review process
2. validate flows with real Customer accounts:
   - Search / filter
   - Compare
   - Vehicle Detail / gallery
   - Vehicle Health
   - Sell / condition / Camera
   - Fixed / Offers / Auction
   - My Exchange
   - offer withdrawal/rejection
   - Deal Room
   - EMI estimator
3. seed or create controlled real test listings through the actual seller flow
4. only after behavioral acceptance decide whether to merge / publish production OTA
5. keep valuation / intelligence deferred until evidence exists
