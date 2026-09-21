# Partner Vehicle Register manufacturer logos — 2026-09-21

## Scope

Partner portal `/partner/vehicles`.

## Implemented behavior

- The Vehicle column now shows the vehicle manufacturer's logo immediately before the displayed registration number or `New-<Chassis No.>` identity.
- The logo is resolved strictly from the actual `vehicle.make` value, preventing decorative/random brand mismatches.
- Supported repository assets include Tata, Ashok Leyland, Mahindra, Maruti Suzuki, Hyundai, Honda, Toyota and Kia.
- If no matching manufacturer asset exists, the existing neutral vehicle icon is used as a fallback.
- The Make / Model column remains text-only.
- Registration-status badges and Update RC actions are unchanged.
- Logos use a transparent presentation with no white tile/background around the mark.

## Data / schema impact

None. UI-only asset resolution using vehicle make already returned by the Partner vehicle query.

## Release state

IMPLEMENTED on branch `feat/partner-vehicle-register-manufacturer-logos`. Not merged and not deployed.
