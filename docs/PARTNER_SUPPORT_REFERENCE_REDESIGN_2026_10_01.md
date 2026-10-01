# Partner Support reference redesign — 2026-10-01

## Scope

Branch: `ui/partner-support-reference-redesign-2026-10-01`

The Partner App Support screen was redesigned against the user-provided reference while preserving the existing live support data and navigation.

## Implemented UI

- Removed the small `SUPPORT` eyebrow above the bold `Support` page title.
- Reworked the fallback `INSUREIT Operations Desk` card into the supplied light-blue illustrated overview treatment.
- Moved freshness into the overview/contact card and formats it as `Updated today · <time>`.
- Added the reference subtitle `Your operational overview` for the Operations Desk card.
- Kept the Operations Desk rows as one joined rounded white list with separators.
- Removed the large status icon tiles from all Operations Desk rows.
- Removed the right-side chevron arrows from all Operations Desk rows.
- Kept only the color-coded count badge plus title/helper copy in each row.
- The full row remains the touch target and preserves the existing routes:
  - Need your attention → `/policy-intakes`
  - Policy Intakes in progress → `/policy-intakes`
  - Active claims → `/(tabs)/claims`
- Added pressed-state feedback so rows remain visibly interactive without chevrons.

## Preserved behavior

- `getPartnerSupport()` remains the only data source.
- Existing loading/error/retry behavior remains intact.
- Relationship-contact call/email actions remain intact when a relationship contact is returned.
- No database, schema, RLS, permissions, accounting, native dependency, Expo runtime, APK or AAB change.

## Release state

**IMPLEMENTED on branch only.** PR/CI/merge/production runtime `0.2.0` OTA/device verification are pending. **NO APK/AAB CREATED.**
