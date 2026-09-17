# Accounts Business MIS export and controlled Excel import — 2026-09-16

State: IMPLEMENTED ON FEATURE BRANCH, NOT MERGED, NOT DEPLOYED.

## Scope

This step extends the Accounts Dashboard with the user-requested final Business MIS export and completes the controlled Excel posting stage.

### Top-page Business MIS export

The Accounts Dashboard now has one `Export` action at the top of the page. It respects the active period/date/insurer filters and downloads a single `Business MIS` worksheet using the same 32-column structure as the Accounts workbook supplied for reference:

`Month | Policy Issuance Date | RM Name | Intermediary Type | Lead Source | Intermediary Code | Registration No. | Insured Name | OD Premium | Third Party Premium | CPA | Net Premium | Policy Number | Insurance Company | Valid Upto | Pay-in % OD | OD Pay-in Amount | Pay-in % TP | TP Pay-in Amount | Total Pay-in | Bill Number | Bill Amount | Bill Date | Difference | TDS | Payout OD % | Payout TP % | Gross Payout | Retention | Paid Amount | Paid Date | UTR Details`

The export includes the two-row grey summary/header treatment, bold wrapped headers, cell borders, compact row heights, matching column widths, Excel totals, Indian-style amount number formats and date formatting. Values come from live policy/commercial/accounting records. Bill data comes from Accounts invoice lines; payout payment data comes from partner payable/payment allocations.

`Difference` is system-calculated as projected Total Pay-in minus the policy bill amount. It is not entered manually.

### Confirm Import

The existing Excel reconciliation preview is extended with a controlled `Confirm Import` action. Confirm Import always re-runs server-side validation immediately before posting.

Posting is performed by the new `post_accounts_excel_reconciliation` database RPC in one PostgreSQL transaction. A failure in any bill, TDS, insurer receipt, payable or partner-payment step rolls the complete workbook batch back.

The RPC:

- creates and raises insurer brokerage bills from validated Pay-In lines;
- creates policy-level invoice lines using the live projected Pay-In as the recognized amount and the workbook Bill Amount as the posted line amount;
- records the variance as the invoice-line adjustment;
- posts the receivable ledger debit;
- posts actual TDS through the existing `post_accounts_tds` accounting function;
- posts bank receipts and invoice allocations through the existing `post_accounts_receipt` accounting function;
- creates/approves partner payables only when required through existing payable RPCs;
- posts partner payments and payable allocations through the existing `post_partner_payment` function;
- blocks duplicate insurer bill numbers, insurer receipt references and partner payment references.

No existing legacy reconciliation/billing/receivables screens are removed. They remain available under Other Recon while the Accounts Dashboard becomes the Excel-first operating surface.

## Database change

Migration: `supabase/migrations/202609161830_accounts_excel_reconciliation_posting.sql`

The migration adds only the transaction RPC described above. It does not add or alter business tables or columns.

The migration has NOT been applied to production in this feature-branch state.

## Safety notes

- Access remains gated by `view_accounts` and Policy Commercial access.
- Workbook preview continues to validate access scope, live commercial values and duplicate references before Confirm Import is enabled.
- Confirm Import repeats validation against live data to prevent stale-preview posting.
- Existing accounting RPCs remain the canonical receipt/TDS/partner-payment posting primitives.
- The final Business MIS export is an output of the system, not an upload/database source.
