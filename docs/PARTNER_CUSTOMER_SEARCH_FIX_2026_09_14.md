# Partner Customer Register search fix — 2026-09-14

Status: **IMPLEMENTED on feature branch; not merged; not deployed**.

Branch: `fix/partner-customer-live-search`

Scope:
- Fix `/partner/customers` search so typing updates filtered results automatically.
- Debounce search navigation by 350 ms.
- Preserve Enter-to-search behavior.
- Add a clear control that immediately removes the search filter.
- Reset pagination to page 1 whenever the search term changes.
- Keep filtering server-side through the existing `listPartnerWebCustomers()` → `partner_app_list_customers` RPC path.
- Preserve existing customer table, row navigation, pagination component, Partner scope, and backend contract.

Files:
- `apps/web-portal/app/partner/customers/customer-search.tsx`
- `apps/web-portal/app/partner/customers/page.tsx`

No database, schema, RPC, or API changes.
