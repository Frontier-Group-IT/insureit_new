# Layout, Density and Hierarchy

InsureIt must support both focused consumer interactions and dense operational scanning. Do not use one spacing model for every screen.

## Density levels

### D1 — Focused

Use for login, OTP, confirmation, single-decision and low-information screens.

Characteristics:

- generous breathing room
- one dominant action
- minimal supporting detail
- large, clear controls
- low visual competition

### D2 — Standard

Use for onboarding, forms, guided claim stages and multi-field workflows.

Characteristics:

- clear section grouping
- moderate vertical rhythm
- compact explanations
- persistent field labels
- obvious primary action
- supporting context near the fields it affects

### D3 — Operational

Use for dashboards, trackers, registers, policy detail, vehicle detail and history-heavy screens.

Characteristics:

- compact rows/cards
- high scan efficiency
- restrained card padding
- strong alignment columns/zones
- visible dates, amounts and statuses
- collapsible secondary information
- touch areas remain accessible even when visual density is high

## Mixed-density screens

A screen can mix levels. Example Claim Tracker:

- header/summary: D2
- core metadata: D3
- current-action block: D2
- timeline: D3
- documents/history: D3 with progressive disclosure

## Spacing system

Prefer an intentional small scale such as 4 / 8 / 12 / 16 / 24 / 32 rather than arbitrary values.

Rules:

- related items sit closer together than unrelated sections
- a label and value form one unit
- separate conceptual groups more strongly than lines within a group
- card padding should match density; D3 cards should not inherit large marketing-style padding
- avoid repeated 24–32px padding when it reduces useful information without improving comprehension

## Value-first hierarchy

For operational data, values often deserve more visual weight than labels.

Prefer:

```text
₹1,24,500
Estimate Amount
```

or:

```text
20 Aug 2026
Payment received
```

when the number/date is the primary scanning target.

Use labels first when the user is filling a form or when ambiguity would result without the label.

## Screen hierarchy

A screen should usually have:

1. one page-level identity/title
2. one primary status or purpose
3. one primary action or next action
4. supporting sections in descending importance

Avoid multiple sections competing with the same large title weight.

## Cards

Use a card when it creates a meaningful group or interaction boundary. Do not put every row in a separate card by default.

Avoid:

- cards inside cards without a strong reason
- repeated thick borders
- large shadows on operational screens
- multiple accent colors competing within one card
- cards with large empty footers or headers

Prefer:

- subtle surface separation
- one status/accent treatment per card
- aligned left/center/right information zones
- predictable radius and border treatment from existing theme/components

## Right-side metadata zone

For trackers and list rows, reserve a consistent right-side area for compact metadata when it improves scanning:

- event date
- primary amount
- status count
- chevron/action indicator

Keep the middle area for identity and context. Keep the left area for stage/status iconography when applicable.

Do not force long labels into the right zone.

## Typography hierarchy

Use a limited number of roles rather than inventing a size for each element:

- page title
- section title
- primary value/title
- body/context
- secondary metadata
- compact label/eyebrow

Avoid excessive all-caps. Reserve it for short category/eyebrow labels when useful.

Never shrink critical information simply to make a card shorter. Re-layout before reducing legibility.

## Color hierarchy

Use color semantically:

- primary brand/accent for current/interactive emphasis
- green or equivalent success semantic for completed/positive states
- amber for attention/pending when appropriate
- red only for destructive/error/critical conditions
- neutral text and surfaces for most information

Never communicate status by color alone. Pair with text, icon or shape.

## Operational scan test

A D3 screen is successful if a user can quickly answer:

- which record is this?
- what is the current status?
- what changed or happened when?
- what amount matters?
- what requires action?

If decorative layout slows those answers, simplify it.