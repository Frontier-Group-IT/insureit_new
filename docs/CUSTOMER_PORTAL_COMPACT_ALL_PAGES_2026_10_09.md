# Customer Portal: Compact All Pages Layout (2026-10-09)

## Scope
Branch: `ui/customer-portal-all-pages-compact-2026-10-09`. Customer Web namespace only. Designed from user reference screenshots: vehicle portfolio register (dense toolbar and table) and customer detail form (compact sections, label/value rows and documents).

## Implemented
- Scoped `customer-compact` CSS imported only in protected Customer Portal layout; all customer pages inherit reduced shell spacing, heading size, card padding/gaps and compact field heights. Responsive with focus styling.
- Customer Renewals converted from two-column cards to full-width dense table, preserving category filters, customer-scoped loader, status and vehicle links.
- Vehicle Details, Policy Details, Support Details, Exchange Details adopt a shared compact label/value grid rather than stacked tall detail cards.
- Existing Vehicle and Policy registers remain dense tables.
- Home, Claims, Profile, KYC, Exchange, Quote, E-Challan, Documents, forms and other protected pages share compact spacing through scoped layout styles.
- No changes to business logic, policies, claim stage state, database, Supabase, Operations/Partner or mobile apps.

## Verification / release gates
Implemented on branch; GitHub CI and authenticated browser visual verification still required before merge. Avoid treating CSS compactness as exact pixel parity on every viewport. Check large tables' horizontal scrolling and form usability on mobile. Do not generate APK/AAB. Do not merge or deploy without explicit approval.
