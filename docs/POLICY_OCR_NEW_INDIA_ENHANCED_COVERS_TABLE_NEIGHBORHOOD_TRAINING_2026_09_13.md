# New India Enhanced Covers OCR — Table Neighborhood Training — 2026-09-13

## Status

IMPLEMENTED on feature branch. Not yet merged, deployed, or live-verified.

## Scope

Parser family: `new_india_motor_v1`

Policy type: New India Commercial Vehicle Package Policy — Enhanced Covers.

This round is intentionally limited to the repeated Section 02 residuals:

- Manufacturing Year
- Chassis Number
- Engine Number

Already-correct Make, Model, Fuel, GVW/Vehicle Capacity, RTO State, Vehicle Class, policy identity, dates, IDV, CPA, OD, and TP are not broadened by this round.

## Production replay state before this round

The previous structured-table-first round was verified and deployed, but a same-policy production replay still omitted Manufacturing Year, Chassis Number, and Engine Number. The UI supports all three keys and therefore was not the point of loss.

The remaining defect was narrowed to how the residual refiner interpreted the Layout Parser table shape.

## Root cause found in v5

Two structural cases were not covered:

1. Manufacturing Year could be returned with the label in one row and the four-digit value directly below the same column. v5 only checked the label cell and cells to its right.
2. The combined `Chassis no./Engine no.` header could be followed by Engine and Chassis evidence in separate neighboring or below cells. v5 expected both identifiers to survive inside one candidate cell before it could apply VIN-shape disambiguation.

These cases are consistent with a four-column Vehicle Details schedule where the Layout Parser preserves row/column structure but may separate nested text blocks differently from the source PDF's visual cell.

## v6 training behavior

### Manufacturing Year

When an explicit `Year of manufacture` cell is found on page 1, the refiner now checks:

- the same cell,
- cells to the right on the same row,
- the same column for up to two following rows.

Only one unique plausible 19xx/20xx value is accepted. Ambiguous evidence remains withheld.

### Chassis and Engine

When an explicit combined Chassis/Engine label is found, the refiner now evaluates a tightly bounded table neighborhood:

- cells after the label on the same row,
- up to two following rows,
- only columns near the label column.

The neighborhood is accepted only when it contains exactly:

- one unique 17-character mixed-alphanumeric VIN-shaped value -> Chassis Number,
- one other unique mixed-alphanumeric identifier -> Engine Number.

If more than one engine-like or chassis-like candidate exists, the neighborhood result is withheld rather than guessed.

### Privacy

No real customer, policy, chassis, engine, phone, address, GSTIN, or registration identifiers are committed in fixtures.

Regression cases use synthetic identifiers that preserve only the failure shape. Evidence strings generated for the neighborhood path mask identifier-like values by shape/length rather than persisting the real value in diagnostic evidence.

## Regression coverage added

The dedicated New India separated-identifier regression now protects:

- normal same-row structured Year and combined identifier values,
- flattened wrapped VIN fallback,
- ambiguous flattened Year withholding,
- structured Year overriding ambiguous flattened Year evidence,
- Year value directly below its label in the same table column,
- Engine and Chassis split across separate cells/rows near the combined label,
- VIN-shape disambiguation,
- ambiguity guard when another engine-like identifier appears in the neighborhood,
- incomplete registration evidence remaining withheld,
- OD/TP accounting remaining unchanged.

## Evidence-state rule

Do not mark this round `LIVE VERIFIED` from CI alone.

Required progression:

1. IMPLEMENTED
2. VERIFIED — canonical exact-head web-portal gate green
3. MERGED — only with explicit user approval
4. DEPLOYED — protected production workflow + matching Vercel deployment READY
5. LIVE VERIFIED — same policy replay visibly returns Manufacturing Year, Chassis Number, and Engine Number correctly

If live replay still omits any of the three fields, record the round as `DEPLOYED / LIVE TARGET STILL UNRESOLVED` and continue from actual production evidence rather than widening generic parsing rules.
