# Accounts Dashboard Summary Tables — 2026-09-17

## Status

**IMPLEMENTED on feature branch; not merged or deployed.**

## Scope

The Accounts Dashboard `/accounts` replaces the instructional workflow card with two compact, filter-aware financial summary tables while leaving the existing reconciliation tools below unchanged.

### Insurer-wise Summary

Columns:
- Insurance Company
- Net Premium
- Projected Payin
- Received Payin

The summary is grouped by insurance company from the same filtered policy population used by the Accounts Dashboard KPIs. Net Premium comes from `policy_premium_details.net_premium`. Projected Payin comes from `policy_payin_details.payin_after_tds`. Received Payin uses actual `accounts_receipt_allocations.allocated_amount` through `accounts_invoice_lines`, keeping the value tied to invoices that contain policies inside the selected Accounts scope/filter set.

### Intermediary Payout Summary

Columns:
- Lead Source
- RM Name
- Intermediary Type & Code
- Net Premium
- Calculated Payout
- Released Payout
- Pending Payout

The summary groups by the policy's stored `lead_source`, `rm_name`, `intermediary_type`, and `intermediary_code`. Calculated Payout uses `policy_intermediary_payouts.gross_payout`. Released Payout uses actual `partner_payment_allocations.allocated_amount` through `partner_payables`, which keeps the released amount tied to the filtered policy population. Pending Payout is `max(Calculated Payout - Released Payout, 0)`.

## Filtering and access scope

Both summaries inherit the existing Accounts Dashboard period and insurer filters and the same `view_accounts` customer access scope. No separate or broader unscoped financial query is introduced. The current Branch filter remains disabled and unchanged.

## UI layout

Desktop uses an intentionally asymmetric two-column layout: the insurer table receives the smaller column and the intermediary payout table receives the larger column because it has more fields. Tables are compact, vertically scrollable, use sticky headers, right-aligned Indian-currency values, and stack on narrower screens.

## Database impact

No migration or schema change is required. The implementation only reads existing policies, premium, pay-in, payout, invoice/receipt allocation, payable, and partner-payment allocation tables.

## Continuation

Run the canonical `Verify web portal` PR gate. Do not merge or deploy until explicitly approved by the user.
