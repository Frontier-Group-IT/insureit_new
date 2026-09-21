# Vehicle unregistered registration display — 2026-09-21

## Scope

Web portal Vehicle Master only.

## Implemented behavior

- Section 01 of an existing unregistered vehicle's edit/view form now shows **Registration Number** and **Registration Date** alongside Customer, Manufacturer, MFG Year and Model.
- An unregistered vehicle is displayed with the canonical temporary identifier **New-<normalized chassis number>**.
- The main Vehicle Portfolio now shows that same **New-<chassis>** identifier instead of the generic **Registration pending** text.
- The read-only/backoffice vehicle register and standalone vehicle details page use the same display rule.
- Registered vehicles continue to show their real registration number unchanged.
- RC-pending status badges and Update RC actions remain unchanged.

## Data / schema impact

None. This is an application/display refinement only. The existing database canonical identity remains `NEW-<normalized chassis>`; no migration, RLS, policy, claim, or workflow behavior is changed.

## Verification

`apps/web-portal/scripts/vehicle-registration-regression.mjs` now covers the canonical display helper and the Section 01/Vehicle Portfolio wiring.

## Release state

IMPLEMENTED on branch `fix/vehicle-unregistered-registration-display`. PR/CI/merge/deployment remain separate states.
