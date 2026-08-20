---
name: insureit-professional-mobile-ui-ux
description: Use when reviewing, planning, redesigning, or implementing UI/UX in apps/mobile-app. Optimizes InsureIt mobile screens for business correctness, comprehension, trust, operational efficiency, accessibility, and professional visual polish while preserving existing workflows and React Native/Expo architecture.
---

# InsureIt Professional Mobile UI/UX

Use this skill for any task that changes or reviews the customer mobile experience in `apps/mobile-app`, including dashboards, vehicle/policy/claim screens, onboarding, forms, timelines, lists, status cards, actions, loading/error/empty states, navigation, accessibility, and visual refinement.

## Priority order

Resolve design decisions in this order:

1. **Business correctness** — never make the screen visually cleaner by hiding, relabeling, or reinterpreting important workflow facts.
2. **Comprehension** — the user should understand current state, next action, identity, important date, and important amount quickly.
3. **Trust** — insurance, claims, payments, policy and vehicle information must feel precise, calm, and reliable.
4. **Efficiency** — reduce unnecessary taps, scrolling, duplicate entry, and visual noise.
5. **Accessibility** — readable text, adequate contrast, meaningful labels, appropriate touch areas, non-color cues, and scalable layouts.
6. **Visual polish** — hierarchy, spacing, alignment, typography, status treatment, imagery, and motion should refine the experience without overpowering the information.

If a visual-design suggestion conflicts with workflow clarity or operational density, prefer workflow clarity.

## Required workflow

### 1. Inspect before redesigning

- Read the current screen, shared components, theme/tokens, navigation path, data source, and relevant business rules.
- Identify what comes before and after the screen.
- Identify which fields are user-entered business facts versus database/audit metadata.
- Preserve existing working flows unless the user explicitly asks to change behavior.
- For repository changes, follow `AGENTS.md` and applicable mobile handoff rules.

### 2. Classify the screen

Select one density level from `references/layout-density-hierarchy.md`:

- **D1 Focused** — login, OTP, confirmations, one-task screens.
- **D2 Standard** — onboarding, forms, guided workflow stages.
- **D3 Operational** — trackers, registers, dashboards, policy/vehicle details, claim histories.

A screen may combine levels by section, but do not default every section to large consumer-app spacing.

### 3. Define information hierarchy

Before styling, answer:

- What does the user need to know first?
- What must they do next?
- Which values are more important than their labels?
- Which information is status, identity, chronology, finance, supporting context, or audit history?
- What can be removed, collapsed, deferred, or derived?

For operational values, usually prefer **value > context > label**.

### 4. Load only relevant references

Read the smallest set that covers the task:

- `references/product-design-principles.md` — all redesign/review tasks.
- `references/layout-density-hierarchy.md` — spacing, cards, visual hierarchy, information density.
- `references/forms-accessibility.md` — forms, pickers, validation, touch targets, errors, accessibility.
- `references/react-native-implementation.md` — any implementation in React Native/Expo.
- `references/domain/insurance-claims-fleet.md` — claims, policies, vehicles, premiums, renewals, quotes, challans.
- `checklists/screen-audit.md` — screen-level design review.
- `checklists/pre-pr-ui-review.md` — before declaring UI implementation ready.
- `examples/claim-tracker.md` — external/self-tracked claim timeline work.

### 5. Separate UX from UI

First fix structure and interaction:

- task order
- next action
- input method
- validation
- navigation
- grouping
- disclosure
- loading/error/recovery

Then apply visual styling:

- typography
- spacing
- color
- cards
- icons
- imagery
- motion

Do not use styling to conceal a structural UX problem.

### 6. Preserve domain semantics

Permanent rules:

- **Business/event dates are not database timestamps.** A customer-facing journey should normally show the date the event actually happened. `created_at`, `updated_at`, and save timestamps are audit metadata unless explicitly requested.
- Use chronological validation where workflow stages have a real order. Editing an earlier event must not create an impossible sequence with already-recorded later events.
- Show the **main financial amount** needed for the decision or progression. Do not give every derived amount equal prominence.
- Do not silently overwrite user-entered values with fetched/provider values. Present review/confirmation when importing data.
- Do not expose unnecessary sensitive identity or vehicle information.

### 7. Use appropriate interaction patterns

Prefer this input hierarchy:

1. auto-fill from trusted existing data
2. selection/searchable selection
3. constrained picker or assisted input
4. free text only when necessary

Prefer persistent labels over placeholder-only forms. Use date/time pickers for dates and times; numeric/currency inputs for money; appropriate keyboard types for phone, email, OTP, numeric values, etc.

### 8. Keep visual language professional

InsureIt is a serious fleet/insurance product. Default characteristics:

- calm, business-focused surfaces
- strong identity and status hierarchy
- restrained use of accent colors
- consistent icons
- compact but readable operational cards
- limited decorative effects
- proportional success feedback

Avoid making operational workflows look like a lifestyle, gaming, crypto, or social app.

Do not add gradients, glassmorphism, glow, sparkles, illustrations, large empty areas, or animation merely because they are fashionable. Use them only when they materially support brand, comprehension, or feedback.

### 9. React Native implementation discipline

When implementing:

- reuse existing InsureIt components and tokens before introducing new primitives
- centralize reusable styling and semantic values
- avoid arbitrary raw colors/spacing repeated across screens
- use `Pressable`/existing button components with visible pressed/disabled states
- use `FlatList`/`SectionList` for large dynamic lists rather than rendering large collections inside `ScrollView`
- use `react-native-safe-area-context` patterns already established by the app
- use responsive layout APIs rather than fixed assumptions about one device width
- keep touch areas usable even when the visible icon is small
- give meaningful accessibility roles/labels to interactive controls
- avoid large screen files accumulating unrelated data, business, and rendering logic when a reusable component/helper is justified
- do not restructure healthy project architecture solely to match an external design methodology

### 10. Verification requirement

Before declaring a UI implementation ready:

- run the relevant mobile typecheck/lint/build gate through the repository workflow when available
- inspect the exact changed files
- verify no protected Expo/runtime/native configuration changed unless explicitly approved
- use `checklists/pre-pr-ui-review.md`
- for an OTA, follow `docs/MOBILE_EXPO_PREVIEW_HANDOFF.md`; publication success is not installed-device verification

## Core product hierarchy patterns

### Claim screen

1. current claim status/milestone
2. next required action
3. vehicle + claim identity
4. chronology
5. financial progression
6. documents/supporting details
7. audit/history

### Policy screen

1. policy status / expiry urgency
2. vehicle identity
3. insurer + policy number
4. validity / renewal timing
5. premium / coverage
6. actions and supporting details

### Vehicle screen

1. registration / vehicle identity
2. insurance status
3. renewal urgency
4. active claim/challan signals
5. operational actions
6. secondary metadata

## Design decision rule

When uncertain between two layouts, prefer the one that lets a serious fleet owner answer these questions faster:

- What is this record?
- What is its current state?
- Is anything urgent?
- What happened and when?
- What amount matters?
- What should I do next?

## Source note

This is an original InsureIt-specific skill. It was informed by public mobile-design, accessibility, platform-HIG, and React Native implementation material, but it does not copy external unlicensed skill text. See `references/source-influences.md`.