# Product Design Principles

Use these principles whenever planning or reviewing InsureIt mobile UI.

## 1. Design for serious operational use

InsureIt serves users managing vehicles, insurance, claims, renewals, quotes and related operational work. The interface should communicate reliability and control.

Prioritize:

- clear state
- predictable actions
- concise labels
- readable dates and amounts
- visible urgency
- low error risk
- fast scanning

Do not optimize primarily for novelty or visual spectacle.

## 2. Start from the user's task

Before changing a screen, define:

- the primary task
- the most important decision
- the next likely action
- the information required for that action
- the information that can wait

If a section does not support the current task, reduce its visual weight, collapse it, move it later, or remove it when safe.

## 3. Preserve user agency

- Make consequential actions understandable before execution.
- Let users correct editable business data without creating hidden workflow inconsistencies.
- Avoid dead ends.
- Provide clear recovery from errors.
- Prefer reversible actions or explicit confirmation when loss is irreversible.
- Editing an older workflow event must not silently corrupt later chronology.

## 4. Familiarity beats invention

Prefer established mobile patterns for:

- back navigation
- lists
- expandable sections
- buttons
- date/time selection
- numeric input
- search
- status feedback
- bottom navigation
- modal confirmation

Invent a new interaction only when the existing patterns cannot express the task clearly.

## 5. Simplicity is not emptiness

A professional operational screen can be information-dense and still be simple.

Simplicity means:

- few competing hierarchies
- clear grouping
- predictable spacing
- minimal duplicate copy
- one obvious primary action
- secondary detail available without blocking the core task

Do not create large blank areas merely to make the screen look minimal.

## 6. Trust is built through precision

Insurance and financial UI should distinguish clearly between:

- actual business facts
- calculated values
- system-generated identifiers
- provider-returned data
- audit timestamps
- pending/unverified information

Use accurate labels. If data is unavailable, say so instead of substituting a misleading fallback.

## 7. Feedback should be proportional

Use feedback that matches the importance of the event.

Examples:

- saved field -> subtle confirmation/toast
- claim milestone completed -> clear status change and next step
- payment received -> confident success state and amount/date confirmation
- destructive action -> stronger confirmation and recovery guidance

Avoid playful celebration effects on routine operational tasks.

## 8. Reduce cognitive load

- Use persistent labels for important fields.
- Keep related values together.
- Put secondary explanations after the primary value.
- Prefer human-readable status language.
- Avoid exposing database vocabulary to customers unless it is already a business term.
- Use progressive disclosure for supporting history/documents.

## 9. Design every state

A screen is incomplete until these states are considered where applicable:

- loading
- loaded
- empty
- partial data
- error
- validation error
- offline/network failure
- disabled
- in-progress
- completed
- locked/upcoming
- success

Do not let empty/error states collapse the hierarchy or strand the user.

## 10. Preserve continuity across the app

When refining one screen, inspect adjacent screens and shared components. Do not introduce a new card style, color language, icon family, field pattern, or spacing rhythm that makes the screen feel like a different product unless the design system itself is being intentionally changed.