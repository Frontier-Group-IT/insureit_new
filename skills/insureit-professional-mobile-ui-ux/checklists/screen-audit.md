# Screen Audit Checklist

Use before proposing a redesign and again after implementation.

## Task and hierarchy

- [ ] Can the primary user goal be stated in one sentence?
- [ ] Is the current status/state visible quickly?
- [ ] Is the next required action obvious?
- [ ] Is the most important value more prominent than its label when appropriate?
- [ ] Are supporting/audit details visually secondary?
- [ ] Is duplicate explanatory copy removed?

## Density and layout

- [ ] Has the screen been assigned D1, D2 or D3 density (or an intentional mix)?
- [ ] Does spacing reflect relationships rather than arbitrary gaps?
- [ ] Are there large empty areas that do not improve comprehension?
- [ ] Are cards used as meaningful groups instead of decoration?
- [ ] Are important rows aligned for fast scanning?
- [ ] Do long names, IDs, dates and currency values wrap/truncate safely?

## Business semantics

- [ ] Are customer-facing dates actual business/event dates rather than database entry timestamps?
- [ ] Are calculated/derived values distinguishable from source values?
- [ ] Are statuses based on real workflow state?
- [ ] Are locked/upcoming/current/completed states visually and behaviorally consistent?
- [ ] Is sensitive information limited to what the task requires?

## Forms and interactions

- [ ] Could any free-text field be auto-filled, selected or constrained instead?
- [ ] Are date/time/money/phone/email inputs using appropriate controls/keyboards?
- [ ] Are required fields clear?
- [ ] Are validation messages specific and near their cause?
- [ ] Can users recover from mistakes?
- [ ] Are destructive actions separated from primary actions?

## Accessibility

- [ ] Are touch areas large enough even when visible icons are small?
- [ ] Are interactive controls labeled/role-described where needed?
- [ ] Is state communicated by more than color alone?
- [ ] Is normal text readable with adequate contrast?
- [ ] Can text expand/wrap without fixed-height clipping?
- [ ] Is focus/reading order logical?

## Feedback states

- [ ] Loading state exists where data/action delay is noticeable.
- [ ] Empty state explains what the user can do next.
- [ ] Error state preserves recoverable context and gives a remedy.
- [ ] Disabled state explains itself through context where needed.
- [ ] Success feedback is proportional and leads into the next step.

## Visual consistency

- [ ] Existing InsureIt components/tokens are reused where appropriate.
- [ ] Icon style is consistent.
- [ ] Accent colors are semantic and restrained.
- [ ] Typography roles are limited and predictable.
- [ ] The screen looks like the same product as adjacent routes.

## Efficiency test

For operational screens, verify the user can quickly answer:

- [ ] What record is this?
- [ ] What is its state?
- [ ] What is urgent?
- [ ] What happened and when?
- [ ] What amount matters?
- [ ] What should I do next?
