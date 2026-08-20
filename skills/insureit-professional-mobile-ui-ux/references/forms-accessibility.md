# Forms and Accessibility

Use for onboarding, claim stages, quote inputs, policy/vehicle forms, profile editing and any interactive screen.

## Input hierarchy

Prefer, in order:

1. trusted auto-fill from existing app data
2. searchable/selectable options
3. constrained pickers or assisted inputs
4. free text only when the value cannot be safely constrained

Examples:

- date -> date picker
- time -> time picker
- amount -> numeric/currency input
- phone -> phone keyboard
- email -> email keyboard
- OTP -> numeric one-time-code field
- insurer/vehicle/category -> selection/search rather than arbitrary text when a canonical list exists

## Persistent labels

Do not rely on placeholder text alone for important fields. Place a durable label next to/above the control so the field meaning remains visible after input.

Use helper text only when it reduces ambiguity.

## Required fields

Required data must be obvious before submission.

- mark required fields consistently
- disable/withhold progression when essential values are missing when that pattern is already used safely
- otherwise validate inline and identify the exact field needing correction
- avoid generic `Error` messages

## Validation timing

Validate as close to the input as practical.

For workflow chronology:

- validate a date against earlier recorded stages
- when editing history, validate against later already-recorded stages too
- do not allow future dates when the business event cannot happen in the future
- use specific error copy: explain which earlier/later event creates the conflict

## Error copy

Good:

- `Payment Received Date cannot be earlier than Vehicle Received Date.`
- `Enter a valid 10-digit mobile number.`
- `Select an insurer before continuing.`

Avoid:

- `Invalid input`
- `Something went wrong` when a specific cause is known
- blame/scolding language

Errors should sit near their cause where possible and also be announced/accessibly exposed when needed.

## Touch targets

Use a practical cross-platform baseline of at least roughly 44pt on iOS and 48dp on Android for interactive touch areas. If a visible icon is smaller, enlarge the tappable container or use hit slop.

- keep adjacent actions separated enough to reduce accidental taps
- separate destructive actions from primary actions
- do not make a tiny icon the only reliable way to trigger an important workflow

## Accessibility labels and roles

For custom/interative controls:

- provide a meaningful `accessibilityRole`
- provide an `accessibilityLabel` when visible text does not already communicate the action sufficiently
- use `accessibilityState` for disabled/selected/checked/expanded states where applicable
- do not include the control type redundantly in the label (`Share`, not `Share button` when role is already button)
- hide decorative imagery from accessibility focus

## Focus and reading order

The screen-reader reading order should follow the visual/task hierarchy:

1. screen title/status
2. important context
3. current action/form fields
4. secondary/supporting content

Opening a modal should move context into it; closing should return users to a sensible trigger/context.

## Contrast and color

Target WCAG-style contrast expectations:

- normal text: about 4.5:1 or stronger
- large/bold text: about 3:1 or stronger
- meaningful component boundaries/icons: sufficient contrast against adjacent surfaces

Do not use color as the only status signal. Pair color with text, icon, shape or pattern.

## Typography and scaling

- avoid critical text below practical readable mobile sizes
- labels/captions should remain legible in bright light
- body content should scale without clipping
- avoid fixed-height text containers where increased font size can truncate content
- use `minHeight`, wrapping and flexible layout for text-bearing controls

## Keyboard and mobile ergonomics

- choose the correct keyboard type
- ensure keyboard does not cover the active field/action
- support sensible return-key behavior where available
- keep primary form progression reachable without forcing excessive hand travel
- do not put destructive actions in the easiest thumb zone beside primary actions without separation

## Imported/provider data

When using OCR, AuthBridge, insurer APIs or other providers:

- display returned data for review before applying if it can overwrite user data
- distinguish provider suggestions from already-saved canonical values
- do not expose unnecessary personal/sensitive fields
- confirm before replacing meaningful manual values

## Loading and submission

- prevent duplicate submission while saving
- show progress for operations that take noticeable time
- keep existing entered values visible during recoverable errors
- do not clear the whole form after a provider/network failure
- success feedback should confirm what happened and what comes next
