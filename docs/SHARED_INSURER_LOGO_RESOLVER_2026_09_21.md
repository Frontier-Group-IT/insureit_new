# Shared insurer logo resolver — 2026-09-21

## Scope

Partner web portal Policy Register and Customer Fleet Summary.

## Implemented behavior

- Added shared insurer logo resolver at `apps/web-portal/lib/insurer-logo.ts`.
- Resolver uses the new PNG insurer catalog under `apps/web-portal/public/assets/insurers/`, which mirrors the catalog imported for the Partner app.
- National Insurance Company Limited now resolves to `/assets/insurers/national-insurance.png`.
- United India Insurance now resolves to the new PNG asset `/assets/insurers/united-india-insurance.png` instead of the older SVG.
- Partner Customer Fleet Summary uses the shared resolver for policy logos.
- Partner Policy Register uses the same resolver and shows insurer logo beside insurer name.
- Unknown/unmapped insurers keep a neutral shield fallback.

## Data / schema impact

None. UI/asset-resolution only.

## Release state

IMPLEMENTED on branch `fix/shared-insurer-logo-resolver`. Not merged and not deployed.
