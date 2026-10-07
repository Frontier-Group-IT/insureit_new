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
