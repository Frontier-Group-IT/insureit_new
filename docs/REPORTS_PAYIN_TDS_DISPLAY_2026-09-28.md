# Reports Pay-in TDS display — 2026-09-28

## Change
- Reports Overview PayIn KPI continues to show `payin_after_tds` as the main value and now shows the deducted amount as `Less TDS - ₹<amount>`.
- Reports Business Expected Pay-in card uses the same presentation.
- The displayed TDS amount is derived as `max(projected_payin - payin_after_tds, 0)` so the existing accounting calculation is not changed or deducted twice.

## Scope
UI/reporting presentation only. No mobile or APK changes.

## Branch
`refine/reports-payin-tds-amount-v2`
