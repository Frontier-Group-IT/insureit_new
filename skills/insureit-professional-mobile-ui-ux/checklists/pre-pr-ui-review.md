# Pre-PR Mobile UI Review

Run this after implementation and before describing a mobile UI change as ready.

## Scope control

- [ ] Changed files match the approved UI/UX scope.
- [ ] No unrelated cleanup or architecture churn was included.
- [ ] No `app.json`, runtimeVersion, EAS config, native permissions/plugins, auth, production DB or RLS changes occurred unless explicitly approved.
- [ ] Existing navigation and persistence behavior was preserved unless behavior change was part of the request.

## Design-system consistency

- [ ] Existing theme/palette/component primitives were reused where suitable.
- [ ] New colors, spacing, radii or typography roles are justified and reusable.
- [ ] Adjacent screens still feel visually consistent.
- [ ] No consumer-style decoration was added without a clear UX/brand benefit.

## Layout and density

- [ ] Intended density level is preserved on small screens.
- [ ] Long insurer names, policy numbers, registration numbers, dates and currency values do not break the layout.
- [ ] No important value is hidden behind avoidable truncation.
- [ ] Right-side metadata zones do not squeeze the primary identity/context area below usability.
- [ ] Text-bearing rows/cards use flexible height where content may grow.

## Accessibility and interaction

- [ ] Important touch targets remain usable on iOS/Android-sized devices.
- [ ] Icon-only actions have meaningful accessible labels/roles.
- [ ] Expand/collapse/select/disabled state is accessible where custom controls are used.
- [ ] Status is not conveyed by color alone.
- [ ] Errors are specific and actionable.
- [ ] Keyboard/input types fit the data.

## Business correctness

- [ ] Event dates displayed to customers come from the correct business field.
- [ ] Audit timestamps are not mislabeled as business events.
- [ ] Amounts are the intended source/derived value and formatted consistently.
- [ ] Workflow ordering/locking still matches business rules.
- [ ] Editing historical data cannot create an impossible chronology where ordering is enforced.
- [ ] Sensitive fields remain masked/omitted appropriately.

## State coverage

- [ ] Loading state checked.
- [ ] Empty/partial state checked.
- [ ] Error state checked.
- [ ] Current/in-progress state checked.
- [ ] Completed state checked.
- [ ] Locked/upcoming/disabled state checked if applicable.

## Technical verification

- [ ] Mobile TypeScript check passes for the exact PR head.
- [ ] Mobile lint passes for the exact PR head.
- [ ] Expo web/review build passes when required by repository CI.
- [ ] GitHub Actions result is inspected rather than assumed.
- [ ] If OTA publication is requested, `docs/MOBILE_EXPO_PREVIEW_HANDOFF.md` is followed and Expo publish success is distinguished from installed-device verification.

## Final review question

Would a fleet owner understand the screen faster and make fewer mistakes than before without losing access to important information?

If not, the redesign is not finished.