# React Native / Expo UI Implementation

Apply these rules when converting an approved UI/UX plan into code under `apps/mobile-app`.

## Preserve the current architecture

- Inspect existing shared components, theme modules and screen conventions before creating new primitives.
- Reuse the existing design system when it can express the intended UI.
- Do not reorganize the app into a new architectural methodology solely because an external guideline prefers it.
- Extract reusable components/helpers when repetition or complexity justifies it, not as ceremony.

## Styling

Prefer semantic theme values and reusable style roles over repeated raw values.

Avoid:

- many slightly different navy/blue/gray hex values across neighboring screens
- arbitrary spacing values with no system
- one-off card radii and border styles for each route
- inline style objects repeated throughout render functions when stable styles can live in `StyleSheet.create`

Use existing `palette`, `roleTheme`, design-system components and shared helpers where appropriate.

## Responsive layout

- Do not assume a single phone width.
- Prefer flexible `flex`, wrapping, min/max constraints and `useWindowDimensions()` when layout decisions depend on width.
- Avoid fixed heights for containers with user-generated or scalable text.
- Test long identifiers, insurer names, vehicle models, currency values and localized dates.

## Lists and long content

- Use `FlatList`/`SectionList` for large or dynamic collections.
- Avoid rendering large datasets by mapping everything inside a `ScrollView`.
- Keep row components stable and focused where list size makes render cost meaningful.
- Do not add premature memoization everywhere; optimize where the screen has evidence of cost.

## Interaction

- Prefer `Pressable` or existing button components for custom actions.
- Provide visible pressed/disabled state.
- Ensure small glyphs have sufficiently large touch containers/hit slop.
- Use platform/native behavior for back navigation, date/time selection, keyboard input and modal dismissal when feasible.

## Navigation

- Follow the existing Expo Router structure.
- Do not introduce a parallel navigation library for a local redesign.
- Preserve back behavior and expected route history.
- Use normal route navigation rather than hard reload behavior.

## Safe areas

Follow the existing `react-native-safe-area-context`/Screen wrapper behavior. Avoid adding nested safe-area padding that creates duplicate top/bottom gaps.

## Accessibility

Interactive custom controls should expose appropriate accessibility role, label and state.

Examples to check:

- icon-only buttons
- expandable section headers
- timeline stages
- custom radio/segmented choices
- modal close controls
- status toggles

Decorative artwork should not create noisy focus stops.

## Data and business logic

UI refactors must not silently change:

- Supabase query semantics
- authorization
- persistence
- claim/policy state transitions
- Expo runtime/native configuration
- dates/amount calculations
- production database behavior

If a UX improvement requires behavior change, describe it explicitly and verify it separately.

## Performance

- Avoid mounting heavy hidden content when it can be loaded on demand.
- Avoid new polling, global listeners or expensive effects for purely visual refinements.
- Avoid large image assets when a smaller optimized asset is sufficient.
- Preserve responsive touch feedback.
- Keep animations modest on operational screens and honor reduced-motion expectations where custom motion is introduced.

## Date/time and currency

- Store/display according to existing domain rules; do not conflate local display formatting with canonical stored timestamps.
- Use locale-aware formatting for customer-facing currency and dates when compatible with existing product requirements.
- Separate date-only business facts from artificial timestamps created only for persistence convenience.

## Pre-implementation check

Before editing code, identify:

- files to change
- existing components to reuse
- data fields being displayed
- behavioral changes, if any
- protected config that must remain untouched

After implementation, use `checklists/pre-pr-ui-review.md`.