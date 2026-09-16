# Accounts Dashboard / Other Recon cleanup handoff

## Approved behavior

- `/accounts` is reserved for the real Accounts Dashboard and no longer acts as the launcher for all Accounts tools.
- The Accounts sidebar exposes only two submenus: `Accounts Dashboard` and `Other Recon`.
- `/accounts/other-recon` preserves the former `/accounts` launcher layout, card order, icons, destinations, and existing access guards.
- Existing destination routes are not removed or changed; they remain reachable from Other Recon cards.

## Implementation state

- Branch: `ui/accounts-dashboard-other-recon-cleanup`
- Accounts Dashboard: clean shell implemented at `/accounts`; functional KPI/dashboard content intentionally deferred until the user supplies the layout.
- Other Recon: former Accounts launcher moved to `/accounts/other-recon`.
- Navigation: direct Commercial Control / Insurer Reconciliation / Reconciliation History submenu entries removed from Accounts; only Accounts Dashboard and Other Recon remain.
- Database/schema/permissions/accounting logic: unchanged.

## Release boundary

- Do not merge or deploy until the user explicitly approves the PR after verification.
