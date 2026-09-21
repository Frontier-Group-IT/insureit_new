# Shared vehicle brand logo resolver — 2026-09-21

## Problem identified

The Partner Vehicle Register and Partner Customer Fleet Summary each had their own small local logo resolver. Those resolvers only knew about a handful of manufacturers, even though PR #2158 imported a much larger vehicle-logo catalog into `apps/web-portal/public/assets/vehicle-brands/`.

That caused valid makes such as BharatBenz, TAFE, JCB and others to fall back to the generic vehicle icon even though the corresponding logo asset existed.

## Fix implemented

- Added one shared resolver: `apps/web-portal/lib/vehicle-brand-logo.ts`.
- The resolver covers the full current web vehicle-brand asset catalog.
- Added aliases for common database/manufacturer variations, including:
  - BharatBenz / Daimler / DICV -> BharatBenz asset
  - Eicher / VECV / VE Commercial Vehicles -> Eicher asset
  - Force / Force Motors -> Force Motors asset
  - Mahindra & Mahindra -> Mahindra asset
  - Tata Motors -> Tata asset
  - Mercedes / Mercedes-Benz -> Mercedes-Benz asset
- Partner Vehicle Register now uses the shared resolver.
- Partner Customer Fleet Summary now uses the same shared resolver.
- Unknown/unmapped makes still use the neutral vehicle fallback icon.
- Existing curated SVG assets for Tata, Mahindra, Ashok Leyland, Honda, Hyundai, Kia, Maruti Suzuki and Toyota remain preferred where present.

## Data / schema impact

None. UI asset resolution only.

## Release state

IMPLEMENTED on branch `fix/shared-vehicle-brand-logo-resolver`. Not merged and not deployed.
