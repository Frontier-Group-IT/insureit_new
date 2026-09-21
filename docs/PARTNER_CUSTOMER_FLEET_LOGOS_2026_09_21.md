# Partner customer fleet logos — 2026-09-21

## Scope

Partner portal customer Fleet Summary page.

## Implemented behavior

- The leading icon in each vehicle summary row now uses the vehicle manufacturer's logo when a matching repository asset exists.
- The **Make** column remains text-only; no manufacturer logo is added there.
- Each expanded policy row now uses the insurance-company logo before the policy number when a matching insurer asset exists.
- United India Insurance is supported with a dedicated local logo asset.
- Existing repository assets are reused for Tata, Ashok Leyland, Mahindra, Maruti Suzuki, Hyundai, Honda, Toyota and Kia vehicle makes, and for the currently available insurer-logo set.
- Unknown manufacturers or insurers retain the existing generic vehicle/shield fallback icon.

## Data / schema impact

None. The page already receives vehicle make and insurer name; the change only resolves those values to presentation assets.

## Release state

IMPLEMENTED on branch `feat/fleet-summary-vehicle-insurer-logos`. Not merged and not deployed.
