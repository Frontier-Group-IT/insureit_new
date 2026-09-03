# INSUREIT Partner asset foundation

This folder contains the normalized asset library prepared from the 11 uploaded generation batches on 2026-09-03.

## Production rules

- Keep small interface glyphs (back, close, chevron, overflow, filter, calendar, eye) as lightweight vector/interface icons. Do not replace every control with these 3D assets.
- Use this library for feature identity, quick actions, product categories, meaningful statuses, empty/error states, banners, profile and support illustration.
- All files are transparent optimized PNGs.
- Raw source size: ~92.4 MiB.
- Optimized library size: ~2.0 MiB (97.8% smaller).
- 71 assets are exposed through `lib/partner-assets.ts`; the remaining variants are reserves and do not need to be bundled unless explicitly referenced.

## Folder roles

- `navigation/` — top-level feature identity assets.
- `actions/` — Quick Actions and operational shortcuts.
- `products/` — insurance product-family illustrations.
- `status/` — meaningful workflow/status/attention illustrations.
- `empty-states/` — empty, offline, error, validation and completion visuals.
- `banners/` — generated business-growth banner variants.
- `profile/` — avatar variants.

## Important audit note

The generated banner batch is visually consistent but is mostly generic business-growth artwork. It does **not** clearly encode every originally intended semantic banner (renewals, claims assistance, pending intake, Academy, announcements, cross-sell). Keep those variants as candidates/reserves until the matching screen copy and context are selected.

Likewise, the final uploaded profile batch contains seven avatar variants rather than the full originally requested profile/support illustration set. Existing support/empty-state artwork from other batches can cover several of those use cases, but do not silently label an avatar as a different illustration.

## Usage

```ts
import { PartnerAssets } from '@/lib/partner-assets';

<Image source={PartnerAssets.actions.addCustomer} />
<Image source={PartnerAssets.emptyStates.noPolicies} />
```

Do not import this registry into a screen merely to browse assets. Reference only intentional assets during each refinement phase.
