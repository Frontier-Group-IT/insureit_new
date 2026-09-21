# Add Vehicle unregistered registration fields — 2026-09-21

## Scope

Operations web portal `/vehicles/new`.

## Implemented behavior

- When **Unregistered** is selected while adding a new vehicle, Section 01 no longer shows **Registration Number** or **Registration Date**.
- Customer, Manufacturer, MFG Year and Model remain visible as before.
- Registered mode remains unchanged and still shows editable RC / Registration number and Registration date.
- Existing Vehicle Edit / Details keeps the agreed unregistered identity display, including **New-<Chassis No.>** and Registration Date where applicable.

## Data / schema impact

None. UI-only change. Existing vehicle creation rules still generate the canonical `NEW-<normalized chassis>` identity server-side for unregistered vehicles.

## Release state

IMPLEMENTED on branch `fix/add-vehicle-unregistered-hide-registration-fields`. Not merged and not deployed.
