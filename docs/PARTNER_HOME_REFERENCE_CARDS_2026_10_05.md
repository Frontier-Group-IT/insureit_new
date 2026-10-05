# Partner Home reference card refinement — 2026-10-05

## Scope

User requested the Partner App Home page `This Month`, `Quick Actions`, `Pending Tasks` cards and their section/icon treatment to match the supplied reference image while preserving the accepted Home hero/search/Stories/bottom-navigation structure and existing data/navigation behavior.

## Implementation

Branch: `ui/partner-home-reference-cards-2026-10-05`

- `This Month` card is tightened to the reference proportions with a lighter border/shadow, compact period/report controls, stronger premium hierarchy and a smaller illustrated business-performance tile.
- Policies Sold and Commission Earned now use Partner image artwork instead of generic Ionicons, with a reference-style divider and compact value/label treatment.
- Quick Actions keeps Policy Intake / Renewals / Claims / Customers and the same routes, but uses the coordinated blue navigation artwork family, tighter tile geometry and reference-style light-blue icon wells. Policy Intake retains its local `1.22` image scale only.
- Pending Tasks keeps the live active-claim count and Claims route, but is tightened to the supplied light-blue reference composition with compact claim artwork, count badge, text hierarchy, chevron and pale decorative pending-review artwork.
- Home hero, greeting identity source, overlapping search, Stories, bottom navigation, business calculations/queries, authorization and routes are unchanged.

## Technical boundary

JS/TS/UI only. No schema, RLS, RPC, backend, permission, native dependency, runtime-version, Expo plugin, APK or AAB change.

## Evidence state

**IMPLEMENTED** on the feature branch. PR, CI, merge, production runtime `0.2.0` OTA and installed-device verification are pending.
