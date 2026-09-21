# Partner vehicle registration display — 2026-09-21

## Scope

Partner web portal Vehicle Register and Vehicle Details only.

## Implemented behavior

- Registered vehicles continue to display the real registration number in the Vehicle column.
- RC-pending / unregistered vehicles now display the canonical temporary identity as **New-<normalized chassis number>** instead of the generic **Registration pending** label.
- The Registration column remains a status indicator and still shows **Registered** or **RC pending**.
- The existing **Update RC** next action remains unchanged.
- Partner Vehicle Details uses the same canonical registration display rule for the RC / Registration number field.

## Data / schema impact

None. This is an application-only presentation change. It reuses the shared vehicle registration display helper and the already-existing canonical database identity `NEW-<normalized chassis>`.

## Verification

The canonical NEW vehicle prefix regression now guards the Partner Vehicle Register and Partner Vehicle Details against reverting to the generic pending-label behavior.

## Release state

IMPLEMENTED on branch `fix/partner-vehicle-registration-display`. Not merged and not deployed.
