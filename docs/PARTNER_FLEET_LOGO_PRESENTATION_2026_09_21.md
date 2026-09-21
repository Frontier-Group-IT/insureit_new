# Partner Fleet logo presentation — 2026-09-21

## Scope

Partner portal customer Fleet Summary page.

## Implemented behavior

- Vehicle manufacturer logos now render without the previous white tile, border, padding, or shadow.
- Insurance-company logos use the same transparent presentation.
- Both logo types are rendered larger so the brand mark is easier to recognize.
- Existing alignment with the vehicle number and policy number is preserved.
- The Make column remains text-only.
- Generic fallback icons remain available when a logo asset cannot be resolved.

## Data / schema impact

None. UI-only styling change.

## Release state

IMPLEMENTED on branch `fix/fleet-logo-transparent-larger`. Not merged and not deployed.
