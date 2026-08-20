# Insurance, Claims and Fleet Domain UI

Use these rules whenever designing or reviewing claim, policy, vehicle, quote, premium, renewal or fleet-management interfaces.

## Claims

### Priority hierarchy

1. current milestone/status
2. required next action
3. vehicle and claim identity
4. event chronology
5. important financial progression
6. documents/supporting evidence
7. audit/history

### Event dates

Customer-facing claim journeys should show actual business-event dates whenever available.

Examples:

- incident date/time
- spot intimation date/time
- spot survey completed date
- claim intimation date
- approval received date
- repair completion / RI completion date
- bill date
- delivery-order date
- vehicle received date
- payment received date

Do not present save/entry timestamps as if they were the event date.

When editing milestones, preserve chronology in both directions: the edited event must remain after earlier recorded events and before later already-recorded events where the workflow requires that order.

### Amount progression

When applicable, show a compact progression of the main business amounts rather than every derived figure:

- estimate
- bill
- delivery order / approved amount
- amount received

Secondary calculations such as customer contribution or further deduction belong in detail/review contexts unless they are the current decision-driving value.

### Timeline cards

For operational claim trackers, a useful card/row structure is:

- left: status/timeline marker
- middle: stage identity + short state/context
- right: actual event date + primary amount + navigation affordance

Completed/current stages may be interactive if the workflow allows review/editing. Future locked stages should look unavailable without becoming visually dominant.

## Policies

### Priority hierarchy

1. active/expired/upcoming status and urgency
2. vehicle identity
3. insurer + policy number
4. validity/renewal date
5. product/coverage and main premium information
6. actions
7. supporting detail/documents

Do not make a long policy number visually stronger than an urgent expiry warning when renewal action is the primary task.

### Renewal urgency

Use clear text plus status color/icon. Avoid color-only urgency.

Examples:

- `Expires today`
- `Expires in 7 days`
- `Expired 3 days ago`

## Vehicles

### Priority hierarchy

1. registration/vehicle identity
2. make/model/type context
3. insurance status + expiry
4. claim/challan signals
5. quick operational actions
6. secondary registration metadata

For registration-pending vehicles, use the product's real registration-pending state. Do not invent a fake RC value in the UI.

## Quotes

The primary goal is comparison and confidence.

- make comparable attributes align visually
- show insurer identity consistently
- give the price/premium strong but not misleading prominence
- distinguish total payable from component premiums
- explain exclusions/conditions near the relevant quote
- avoid making the cheapest quote automatically look like the safest/best unless business logic actually ranks it that way

## Money

- use Indian currency grouping where product conventions support it
- align amounts consistently for scanning
- distinguish editable input, calculated amount, insurer-approved amount and received amount
- avoid unexplained decimals when the domain normally uses whole rupees
- do not hide negative/deduction values through weak contrast

## Dates

- distinguish date-only values from date-time values
- do not show artificial noon/midnight time for a date-only business field
- use compact human-readable display on cards and exact input controls on edit screens
- communicate temporal relationship (expired/upcoming/overdue) when more useful than the raw date alone

## Sensitive information

Do not use visual polish as a reason to surface extra identity information.

- show only fields needed for the current task
- mask sensitive identifiers according to existing product rules
- keep provider/raw responses out of customer UI
- avoid unnecessary owner details on vehicle/RC interfaces

## Professional tone

Insurance workflows often involve stress or financial uncertainty. Copy should be calm, specific and action-oriented.

Prefer:

- `Approval received`
- `Payment pending`
- `Upload the repair bill to continue`

Avoid vague or celebratory copy that obscures the actual state.