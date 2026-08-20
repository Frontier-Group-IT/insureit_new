# Example: External Claim Tracker

Use this example as a reasoning pattern, not as a fixed visual specification.

## Screen classification

- page header: D2 Standard
- claim metadata summary: D3 Operational
- current milestone/next action: D2 Standard
- claim journey: D3 Operational
- documents/history: D3 Operational with progressive disclosure

## Information hierarchy

1. current milestone / claim completion
2. vehicle and claim identity
3. immediate action
4. claim journey chronology
5. main financial progression
6. documents and history

## Stage-card pattern

```text
[status]  Stage name                         Event date
          Short state/context                Main amount
                                               chevron
```

The left status marker communicates completed/current/locked state. The center preserves stage identity. The right side is reserved for compact, highly scannable event metadata.

## Event-date mapping example

- Spot Intimation -> Spot Intimation Date/Time
- Spot Status -> Spot Survey Done Date
- Claim Intimation -> Claim Intimation Date
- Work Approval -> Approval Received Date
- Repair & RI -> RI Done Date when required; otherwise Repair Complete Date
- Billing -> Bill Date
- Delivery Order -> DO Date
- Vehicle Delivery -> Vehicle Received Date
- Payment Encashment -> Payment Received Date

`completed_at`, `created_at` and `updated_at` should remain audit/system metadata unless the user explicitly asks to inspect recording history.

## Chronology behavior

When editing an existing stage:

- it cannot become earlier than the applicable previous recorded business event
- it cannot become later than an already-recorded subsequent event
- intra-stage dates must also make sense (for example, RI Done cannot precede Repair Complete)

The UI should explain the exact conflict rather than emitting a generic validation error.

## Amount mapping example

Show the primary amount only where it improves scanning:

- Claim Intimation -> Estimate Amount
- Billing -> Bill Amount
- Delivery Order -> DO Amount
- Payment Encashment -> Amount Received

Keep secondary/derived values such as customer contribution or further deduction inside stage detail unless they are the current decision-driving value.

## Status behavior

- completed: check + completed text + actual event date
- current: strong but restrained accent + actionable affordance
- in progress: explicit in-progress copy
- upcoming: neutral/locked treatment
- historical completed stage: editable only if business rules permit correction

Do not make all states equally colorful.

## Vehicle Delivery example

`Vehicle Received = No` should not visually imply completion. If the workflow defines completion as actual receipt, keep the stage in progress until `Yes + Vehicle Received Date` is recorded.

## Copy style

Prefer short business-language labels:

- `Survey completed`
- `Approval received`
- `Bill dated`
- `DO issued`
- `Vehicle received`
- `Payment received`

Avoid verbose explanatory sentences inside every stage card.

## Audit questions

Before considering a Claim Tracker refinement complete:

- Can the user identify the current stage immediately?
- Are dates real business dates?
- Can the user scan the financial progression without opening every stage?
- Is the next action clear?
- Can historical corrections be made without producing impossible chronology?
- Are documents/history available but visually secondary?
- Does the tracker remain compact on a normal phone screen?
